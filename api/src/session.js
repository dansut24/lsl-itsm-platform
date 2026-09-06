import { createHash, randomBytes } from 'node:crypto'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { pool } from './db.js'

const COOKIE_NAME = 'hi5central_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || '.hi5central.com'

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(client, { tenantId, userId }) {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashToken(token)

  await client.query(
    `INSERT INTO auth_sessions (tenant_id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, now() + ($4 || ' seconds')::interval)`,
    [tenantId, userId, tokenHash, SESSION_TTL_SECONDS],
  )

  return token
}

export function setSessionCookie(c, token) {
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    domain: COOKIE_DOMAIN,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
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
  if (session.tenant_status !== 'active' || session.membership_status !== 'active') {
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
  }
}
