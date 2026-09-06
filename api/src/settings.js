import { pool, withTransaction } from './db.js'
import { registerMfaRoutes } from './mfa.js'
import { registerSecurityRoutes } from './security.js'
import { registerSecurityInstrumentation } from './securityInstrumentation.js'
import {
  pruneSecurityAuditForTenant,
  recordSecurityEvent,
  requestIp,
  requestUserAgent,
} from './securityAudit.js'
import { resolveSession, sessionPayload } from './session.js'

const writableAreas = new Set([
  'company',
  'theme',
  'users',
  'groups',
  'permissions',
  'security',
  'itsm',
  'rmm',
  'integrations',
  'billing',
])

function originMatchesSession(c, session) {
  const origin = c.req.header('origin')
  if (!origin) return true
  const expected = new Set([
    `https://${session.slug}.hi5central.com`,
    `https://${session.slug}-portal.hi5central.com`,
    `https://${session.slug}-rmm.hi5central.com`,
  ])
  return expected.has(origin.toLowerCase())
}

async function requireTenantAdmin(c) {
  const session = await resolveSession(c)
  if (!session) return { error: c.json({ error: 'Authentication required.' }, 401) }
  if (!originMatchesSession(c, session)) return { error: c.json({ error: 'Tenant session mismatch.' }, 403) }
  if (!['owner', 'admin'].includes(session.tenant_role)) {
    return { error: c.json({ error: 'Tenant administrator access is required.' }, 403) }
  }
  return { session }
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function effectiveConfiguration(row) {
  if (row?.configuration && Object.keys(row.configuration).length) return row.configuration
  return row?.onboarding_data || {}
}

function normaliseSecurity(input, current) {
  const data = asObject(input)
  const previous = asObject(current)
  const sessionHours = ['8', '12', '24'].includes(String(data.sessionHours || '12'))
    ? String(data.sessionHours || '12')
    : '12'
  const auditRetention = ['90', '365', '730'].includes(String(data.auditRetention || '365'))
    ? String(data.auditRetention || '365')
    : '365'
  const requireMfa = Boolean(data.requireMfa)
  const wasRequired = Boolean(previous.requireMfa)

  return {
    data: {
      ...data,
      requireMfa,
      sessionHours,
      passwordPolicy: data.passwordPolicy === 'standard' ? 'standard' : 'strong',
      auditRetention,
      mfaEnforcedAt: requireMfa
        ? (wasRequired && previous.mfaEnforcedAt ? previous.mfaEnforcedAt : new Date().toISOString())
        : null,
    },
    newlyEnforced: requireMfa && !wasRequired,
  }
}

export function registerSettingsRoutes(app) {
  app.get('/api/v1/settings', async (c) => {
    const auth = await requireTenantAdmin(c)
    if (auth.error) return auth.error
    return c.json(sessionPayload(auth.session))
  })

  app.post('/api/v1/settings/:area', async (c) => {
    const auth = await requireTenantAdmin(c)
    if (auth.error) return auth.error

    const area = String(c.req.param('area') || '').trim()
    if (!writableAreas.has(area)) return c.json({ error: 'Unknown settings area.' }, 404)

    let body
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'A valid JSON request body is required.' }, 400)
    }

    let data = body?.data
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return c.json({ error: 'Settings data must be an object.' }, 400)
    }
    if (JSON.stringify(data).length > 40_000) {
      return c.json({ error: 'Settings data is too large.' }, 413)
    }

    await withTransaction(async (client) => {
      let newlyEnforcedMfa = false
      let previousSecurity = null
      if (area === 'security') {
        const currentResult = await client.query(
          `SELECT onboarding_data, configuration
           FROM tenant_settings
           WHERE tenant_id = $1
           LIMIT 1
           FOR UPDATE`,
          [auth.session.tenant_id],
        )
        previousSecurity = asObject(effectiveConfiguration(currentResult.rows[0] || {}).security)
        const normalised = normaliseSecurity(data, previousSecurity)
        data = normalised.data
        newlyEnforcedMfa = normalised.newlyEnforced
      }

      await client.query(
        `UPDATE tenant_settings
         SET configuration = jsonb_set(
               CASE
                 WHEN configuration = '{}'::jsonb THEN COALESCE(onboarding_data, '{}'::jsonb)
                 ELSE configuration
               END,
               ARRAY[$2::text],
               $3::jsonb,
               true
             ),
             updated_at = now()
         WHERE tenant_id = $1`,
        [auth.session.tenant_id, area, JSON.stringify(data)],
      )

      if (area === 'company') {
        const displayName = String(data.displayName || '').trim()
        if (displayName.length >= 2 && displayName.length <= 120) {
          await client.query(
            `UPDATE tenants
             SET company_name = $2, updated_at = now()
             WHERE id = $1`,
            [auth.session.tenant_id, displayName],
          )
        }
      }

      if (area === 'security' && newlyEnforcedMfa) {
        await client.query(
          `UPDATE auth_sessions s
           SET revoked_at = COALESCE(s.revoked_at, now()),
               revoked_reason = COALESCE(s.revoked_reason, 'mfa_policy_enabled')
           WHERE s.tenant_id = $1
             AND s.id <> $2
             AND s.revoked_at IS NULL
             AND s.user_id IN (
               SELECT m.user_id
               FROM tenant_memberships m
               WHERE m.tenant_id = $1
                 AND m.role IN ('owner', 'admin')
                 AND m.status = 'active'
             )`,
          [auth.session.tenant_id, auth.session.session_id],
        )
      }

      if (area === 'security') {
        await recordSecurityEvent({
          db: client,
          tenantId: auth.session.tenant_id,
          actorUserId: auth.session.user_id,
          sessionId: auth.session.session_id,
          eventType: 'security.policy_changed',
          ipAddress: requestIp(c),
          userAgent: requestUserAgent(c),
          metadata: {
            previous: {
              requireMfa: Boolean(previousSecurity?.requireMfa),
              sessionHours: String(previousSecurity?.sessionHours || '12'),
              passwordPolicy: previousSecurity?.passwordPolicy === 'standard' ? 'standard' : 'strong',
              auditRetention: String(previousSecurity?.auditRetention || '365'),
            },
            current: {
              requireMfa: data.requireMfa,
              sessionHours: data.sessionHours,
              passwordPolicy: data.passwordPolicy,
              auditRetention: data.auditRetention,
            },
          },
        })
      }
    })

    if (area === 'security') {
      await pruneSecurityAuditForTenant(auth.session.tenant_id, Number(data.auditRetention)).catch(() => {})
    }

    const refreshed = await resolveSession(c)
    if (!refreshed) return c.json({ error: 'Your security policy changed. Sign in again to continue.' }, 401)
    return c.json(sessionPayload(refreshed))
  })

  registerSecurityInstrumentation(app)
  registerMfaRoutes(app)
  registerSecurityRoutes(app)
}
