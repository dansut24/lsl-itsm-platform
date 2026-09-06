import { pool, withTransaction } from './db.js'
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

    const data = body?.data
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return c.json({ error: 'Settings data must be an object.' }, 400)
    }
    if (JSON.stringify(data).length > 40_000) {
      return c.json({ error: 'Settings data is too large.' }, 413)
    }

    await withTransaction(async (client) => {
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
    })

    const refreshed = await resolveSession(c)
    return c.json(sessionPayload(refreshed))
  })
}
