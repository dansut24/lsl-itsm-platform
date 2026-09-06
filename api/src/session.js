import { createHash, randomBytes } from 'node:crypto'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { pool } from './db.js'
import { mfaRequiredFor, sessionNeedsMfa, sessionTtlSeconds } from './securityPolicy.js'

const COOKIE_NAME = 'hi5central_session'
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 12
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || '.hi5central.com'

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

async function sessionPolicy(client, tenantId, userId) {
  const result = await client.query(
    `SELECT
       ts.onboarding_completed_at,
       ts.onboarding_data,
       ts.configuration,
       m.role AS tenant_role
     FROM tenant_settings ts
     JOIN tenant_memberships m
       ON m.tenant_id = ts.tenant_id AND m.user_id = $2
     WHERE ts.tenant_id = $1
     LIMIT 1`,
    [tenantId, userId],
  )
  return result.rows[0] || null
}

export async function createSession(client, { tenantId, userId, mfaVerified = false, ttlSeconds = null }) {
  const policy = await sessionPolicy(client, tenantId, userId)
  if (!policy) throw new Error('Could not resolve the tenant session policy.')

  if (mfaRequiredFor(policy) && !mfaVerified) {
    const error = new Error('Multi-factor authentication is required for this account.')
    error.code = 'MFA_REQUIRED'
    error.status = 403
    throw error
  }

  const resolvedTtl = Math.max(
    60 * 60,
    Math.min(60 * 60 * 24, Number(ttlSeconds || sessionTtlSeconds(policy) || DEFAULT_SESSION_TTL_SECONDS)),
  )
  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashToken(token)

  await client.query(
    `INSERT INTO auth_sessions (
       tenant_id, user_id, token_hash, expires_at, mfa_verified_at
     ) VALUES (
       $1, $2, $3, now() + make_interval(secs => $4::int),
       CASE WHEN $5 THEN now() ELSE NULL END
     )`,
    [tenantId, userId, tokenHash, resolvedTtl, Boolean(mfaVerified)],
  )

  return token
}

export function setSessionCookie(c, token, maxAge = DEFAULT_SESSION_TTL_SECONDS) {
  const resolvedMaxAge = Math.max(60 * 60, Math.min(60 * 60 * 24, Number(maxAge || DEFAULT_SESSION_TTL_SECONDS)))
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    domain: COOKIE_DOMAIN,
    path: '/',
    maxAge: resolvedMaxAge,
  })
}

export function clearSessionCookie(c) {
  deleteCookie(c, COOKIE_NAME, {
    secure: true,
    sameSite: 'Lax',
    domain: COOKIE_DOMAIN,
    path: '/',
  })
}

export async function resolveSession(c) {
  const token = getCookie(c, COOKIE_NAME)
  if (!token) return null

  const tokenHash = hashToken(token)
  const result = await pool.query(
    `SELECT
       s.id AS session_id,
       s.tenant_id,
       s.user_id,
       s.expires_at,
       s.created_at AS session_created_at,
       s.mfa_verified_at,
       t.slug,
       t.company_name,
       t.status AS tenant_status,
       u.email,
       u.name,
       m.role AS tenant_role,
       m.status AS membership_status,
       ts.modules,
       ts.onboarding_step,
       ts.onboarding_completed_at,
       ts.onboarding_data,
       ts.configuration,
       ts.tenant_url,
       ts.portal_url,
       ts.rmm_url
     FROM auth_sessions s
     JOIN tenants t ON t.id = s.tenant_id
     JOIN users u ON u.id = s.user_id
     JOIN tenant_memberships m
       ON m.tenant_id = s.tenant_id AND m.user_id = s.user_id
     JOIN tenant_settings ts ON ts.tenant_id = s.tenant_id
     WHERE s.token_hash = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > now()
     LIMIT 1`,
    [tokenHash],
  )

  if (!result.rowCount) return null

  const session = result.rows[0]
  if (session.tenant_status !== 'active' || session.membership_status !== 'active') return null

  if (sessionNeedsMfa(session)) {
    pool.query(
      'UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE id = $1',
      [session.session_id],
    ).catch(() => {})
    return null
  }

  pool.query(
    'UPDATE auth_sessions SET last_seen_at = now() WHERE id = $1',
    [session.session_id],
  ).catch(() => {})

  return session
}

export async function revokeCurrentSession(c) {
  const token = getCookie(c, COOKIE_NAME)
  if (token) {
    await pool.query(
      `UPDATE auth_sessions
       SET revoked_at = COALESCE(revoked_at, now())
       WHERE token_hash = $1`,
      [hashToken(token)],
    )
  }
  clearSessionCookie(c)
}

export function sessionPayload(session) {
  const configuration = session.configuration && Object.keys(session.configuration).length
    ? session.configuration
    : session.onboarding_data || {}

  return {
    authenticated: true,
    user: {
      id: session.user_id,
      name: session.name,
      email: session.email,
      tenantRole: session.tenant_role,
    },
    tenant: {
      id: session.tenant_id,
      slug: session.slug,
      companyName: session.company_name,
      tenantUrl: session.tenant_url,
      portalUrl: session.portal_url,
      rmmUrl: session.rmm_url,
      modules: session.modules || {},
    },
    onboarding: {
      step: session.onboarding_step,
      completedAt: session.onboarding_completed_at,
      data: session.onboarding_data || {},
    },
    security: {
      mfaVerified: Boolean(session.mfa_verified_at),
    },
    settings: configuration,
  }
}
