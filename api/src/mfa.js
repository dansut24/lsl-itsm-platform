import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import { originMatchesTenant as deploymentOriginMatchesTenant } from './deploymentConfig.js'
import { pool, withTransaction } from './db.js'
import { verifyPassword } from './password.js'
import { ensureRedisConnected } from './redis.js'
import {
  createSession,
  resolveSession,
  sessionPayload,
  setSessionCookie,
} from './session.js'
import {
  mfaGraceEndsAt,
  mfaRequiredFor,
  securitySettings,
  sessionTtlSeconds,
} from './securityPolicy.js'

const TOTP_PERIOD_SECONDS = 30
const TOTP_DIGITS = 6
const CHALLENGE_SECONDS = 10 * 60
const MAX_CHALLENGE_ATTEMPTS = 8
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function text(value, max = 255) {
  return String(value ?? '').trim().slice(0, max)
}

function normaliseEmail(value = '') {
  return String(value).trim().toLowerCase()
}

function normaliseSlug(value = '') {
  return String(value).trim().toLowerCase()
}

function validSlug(slug) {
  return /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(slug) && !slug.includes('--')
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
}

function hashToken(value) {
  return createHash('sha256').update(String(value || '')).digest('hex')
}

function requestIp(c) {
  const forwarded = c.req.header('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return c.req.header('x-real-ip') || 'unknown'
}

async function rateLimit(key, max, seconds) {
  const redis = await ensureRedisConnected()
  const attempts = await redis.incr(key)
  if (attempts === 1) await redis.expire(key, seconds)
  return attempts <= max
}

function originMatchesTenant(c, slug) {
  return deploymentOriginMatchesTenant(c.req.header('origin'), slug)
}

function encryptionKey() {
  const raw = String(process.env.MFA_ENCRYPTION_KEY || '').trim()
  if (!raw) {
    const error = new Error('MFA encryption is not configured on this Hi5Central environment.')
    error.status = 503
    throw error
  }

  let key
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    key = Buffer.from(raw, 'hex')
  } else {
    try {
      key = Buffer.from(raw, 'base64url')
    } catch {
      key = null
    }
  }

  if (!key || key.length !== 32) {
    const error = new Error('MFA_ENCRYPTION_KEY must contain exactly 32 bytes of key material.')
    error.status = 503
    throw error
  }
  return key
}

function encryptSecret(secret) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`
}

function decryptSecret(envelope) {
  const [version, ivValue, tagValue, ciphertextValue] = String(envelope || '').split('.')
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error('Stored MFA secret is invalid.')
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

function base32Encode(buffer) {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return output
}

function base32Decode(input) {
  const clean = String(input || '').toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '')
  let bits = 0
  let value = 0
  const bytes = []
  for (const character of clean) {
    const index = BASE32_ALPHABET.indexOf(character)
    if (index < 0) throw new Error('Invalid base32 MFA secret.')
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

function totpForStep(secret, step) {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const digest = createHmac('sha1', base32Decode(secret)).update(counter).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary = (
    ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff)
  ) >>> 0
  return String(binary % (10 ** TOTP_DIGITS)).padStart(TOTP_DIGITS, '0')
}

function constantTimeCodeEqual(left, right) {
  const a = Buffer.from(String(left || ''))
  const b = Buffer.from(String(right || ''))
  return a.length === b.length && timingSafeEqual(a, b)
}

function verifyTotp(secret, code, lastUsedStep = null, now = Date.now()) {
  if (!/^\d{6}$/.test(String(code || ''))) return null
  const currentStep = Math.floor(now / 1000 / TOTP_PERIOD_SECONDS)
  for (const drift of [-1, 0, 1]) {
    const step = currentStep + drift
    if (lastUsedStep !== null && lastUsedStep !== undefined && step <= Number(lastUsedStep)) continue
    if (constantTimeCodeEqual(totpForStep(secret, step), code)) return step
  }
  return null
}

function recoveryCode() {
  let raw = ''
  for (let index = 0; index < 12; index += 1) {
    raw += RECOVERY_ALPHABET[randomBytes(1)[0] % RECOVERY_ALPHABET.length]
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`
}

function normaliseRecoveryCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function recoveryHash(value) {
  return createHash('sha256').update(normaliseRecoveryCode(value)).digest('hex')
}

function createRecoveryCodes() {
  const codes = Array.from({ length: 10 }, () => recoveryCode())
  return { codes, hashes: codes.map(recoveryHash) }
}

function otpauthUri({ secret, companyName, email }) {
  const issuer = 'Hi5Central'
  const account = `${companyName || 'Hi5Central'}:${email}`
  return `otpauth://totp/${encodeURIComponent(account)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
}

async function accountByCredentials(tenantSlug, email) {
  const result = await pool.query(
    `SELECT
       t.id AS tenant_id,
       t.slug,
       t.company_name,
       t.status AS tenant_status,
       u.id AS user_id,
       u.email,
       u.name,
       u.password_hash,
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
     FROM tenants t
     JOIN tenant_memberships m ON m.tenant_id = t.id
     JOIN users u ON u.id = m.user_id
     JOIN tenant_settings ts ON ts.tenant_id = t.id
     WHERE t.slug = $1 AND u.email = $2
     LIMIT 1`,
    [tenantSlug, email],
  )
  return result.rows[0] || null
}

async function accountByIds(db, tenantId, userId) {
  const result = await db.query(
    `SELECT
       t.id AS tenant_id,
       t.slug,
       t.company_name,
       t.status AS tenant_status,
       u.id AS user_id,
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
     FROM tenants t
     JOIN tenant_memberships m ON m.tenant_id = t.id
     JOIN users u ON u.id = m.user_id
     JOIN tenant_settings ts ON ts.tenant_id = t.id
     WHERE t.id = $1 AND u.id = $2
     LIMIT 1`,
    [tenantId, userId],
  )
  return result.rows[0] || null
}

async function enabledMethod(db, tenantId, userId) {
  const result = await db.query(
    `SELECT * FROM user_mfa_methods
     WHERE tenant_id = $1 AND user_id = $2 AND method = 'totp'
     LIMIT 1`,
    [tenantId, userId],
  )
  return result.rows[0] || null
}

async function createChallenge(db, tenantId, userId, purpose) {
  await db.query(
    `UPDATE auth_mfa_challenges
     SET used_at = COALESCE(used_at, now())
     WHERE tenant_id = $1 AND user_id = $2 AND purpose = $3 AND used_at IS NULL`,
    [tenantId, userId, purpose],
  )
  const token = randomBytes(32).toString('base64url')
  await db.query(
    `INSERT INTO auth_mfa_challenges (tenant_id, user_id, token_hash, purpose, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(secs => $5::int))`,
    [tenantId, userId, hashToken(token), purpose, CHALLENGE_SECONDS],
  )
  return token
}

async function challengeAccount(db, token, expectedPurpose, lock = false) {
  const result = await db.query(
    `SELECT
       c.id AS challenge_id,
       c.purpose,
       c.expires_at AS challenge_expires_at,
       c.attempts AS challenge_attempts,
       t.id AS tenant_id,
       t.slug,
       t.company_name,
       t.status AS tenant_status,
       u.id AS user_id,
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
     FROM auth_mfa_challenges c
     JOIN tenants t ON t.id = c.tenant_id
     JOIN users u ON u.id = c.user_id
     JOIN tenant_memberships m ON m.tenant_id = c.tenant_id AND m.user_id = c.user_id
     JOIN tenant_settings ts ON ts.tenant_id = c.tenant_id
     WHERE c.token_hash = $1
       AND c.purpose = $2
       AND c.used_at IS NULL
       AND c.expires_at > now()
       AND c.attempts < $3
     LIMIT 1${lock ? ' FOR UPDATE OF c' : ''}`,
    [hashToken(token), expectedPurpose, MAX_CHALLENGE_ATTEMPTS],
  )
  return result.rows[0] || null
}

async function provisionSecret(db, tenantId, userId) {
  const existing = await enabledMethod(db, tenantId, userId)
  if (existing?.enabled) {
    const error = new Error('MFA is already enrolled for this account.')
    error.status = 409
    throw error
  }

  if (existing && !existing.enabled) {
    return decryptSecret(existing.secret_encrypted)
  }

  const secret = base32Encode(randomBytes(20))
  await db.query(
    `INSERT INTO user_mfa_methods (
       tenant_id, user_id, method, secret_encrypted, enabled, recovery_code_hashes, updated_at
     ) VALUES ($1, $2, 'totp', $3, false, '[]'::jsonb, now())
     ON CONFLICT (tenant_id, user_id, method) DO UPDATE SET
       secret_encrypted = EXCLUDED.secret_encrypted,
       enabled = false,
       verified_at = NULL,
       recovery_code_hashes = '[]'::jsonb,
       last_used_step = NULL,
       updated_at = now()`,
    [tenantId, userId, encryptSecret(secret)],
  )
  return secret
}

function verifyMethodCode(method, code, { allowRecovery = true } = {}) {
  const secret = decryptSecret(method.secret_encrypted)
  const totpStep = verifyTotp(secret, String(code || '').trim(), method.last_used_step)
  if (totpStep !== null) return { ok: true, type: 'totp', step: totpStep }

  if (allowRecovery) {
    const hashes = Array.isArray(method.recovery_code_hashes) ? method.recovery_code_hashes : []
    const candidate = recoveryHash(code)
    const index = hashes.findIndex((hash) => constantTimeCodeEqual(hash, candidate))
    if (index >= 0) {
      return {
        ok: true,
        type: 'recovery',
        remainingHashes: hashes.filter((_, hashIndex) => hashIndex !== index),
      }
    }
  }
  return { ok: false }
}

async function requireSession(c) {
  const session = await resolveSession(c)
  if (!session) return { error: c.json({ error: 'Authentication required.' }, 401) }
  if (!originMatchesTenant(c, session.slug)) return { error: c.json({ error: 'Tenant session mismatch.' }, 403) }
  return { session }
}

function methodStatus(session, method) {
  const graceEnds = mfaGraceEndsAt(session)
  return {
    requiredForCurrentUser: mfaRequiredFor(session),
    enrolled: Boolean(method?.enabled && method?.verified_at),
    verifiedAt: method?.verified_at || null,
    recoveryCodesRemaining: Array.isArray(method?.recovery_code_hashes) ? method.recovery_code_hashes.length : 0,
    sessionVerified: Boolean(session.mfa_verified_at),
    sessionHours: securitySettings(session).sessionHours,
    graceEndsAt: graceEnds ? graceEnds.toISOString() : null,
  }
}

export function registerMfaRoutes(app) {
  app.post('/api/v1/auth/login-secure', async (c) => {
    let body
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'A valid JSON request body is required.' }, 400)
    }

    const tenantSlug = normaliseSlug(body?.tenantSlug)
    const email = normaliseEmail(body?.email)
    const password = String(body?.password || '')
    if (!validSlug(tenantSlug) || !validEmail(email) || !password) {
      return c.json({ error: 'Enter a valid email address and password.' }, 400)
    }

    if (!originMatchesTenant(c, tenantSlug)) return c.json({ error: 'Tenant sign-in origin mismatch.' }, 403)

    const allowed = await rateLimit(`secure-login:${requestIp(c)}:${tenantSlug}:${email}`, 10, 900)
    if (!allowed) return c.json({ error: 'Too many sign-in attempts. Please try again later.' }, 429)

    const account = await accountByCredentials(tenantSlug, email)
    if (!account) return c.json({ error: 'Email address or password is incorrect.' }, 401)
    if (account.tenant_status !== 'active' || account.membership_status !== 'active') {
      return c.json({ error: 'This Hi5Central account is not currently active.' }, 403)
    }

    const validPassword = await verifyPassword(password, account.password_hash)
    if (!validPassword) return c.json({ error: 'Email address or password is incorrect.' }, 401)

    const policyRequiresMfa = mfaRequiredFor(account)
    const method = await enabledMethod(pool, account.tenant_id, account.user_id)
    if (!policyRequiresMfa) {
      const token = await withTransaction((client) => createSession(client, {
        tenantId: account.tenant_id,
        userId: account.user_id,
        mfaVerified: Boolean(method?.enabled),
      }))
      setSessionCookie(c, token, sessionTtlSeconds(account))
      return c.json(sessionPayload(account))
    }

    if (!method?.enabled) {
      const challenge = await withTransaction((client) => createChallenge(
        client,
        account.tenant_id,
        account.user_id,
        'enrolment',
      ))
      return c.json({
        status: 'mfa_enrolment_required',
        challenge,
        tenant: {
          slug: account.slug,
          companyName: account.company_name,
        },
        user: {
          email: account.email,
          name: account.name,
        },
      }, 428)
    }

    const challenge = await withTransaction((client) => createChallenge(
      client,
      account.tenant_id,
      account.user_id,
      'login',
    ))
    return c.json({
      status: 'mfa_required',
      challenge,
      tenant: { slug: account.slug, companyName: account.company_name },
      user: { email: account.email, name: account.name },
    }, 202)
  })

  app.post('/api/v1/auth/mfa/enrol', async (c) => {
    let body
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'A valid JSON request body is required.' }, 400)
    }

    const challenge = text(body?.challenge, 256)
    const code = String(body?.code || '').trim()
    if (!challenge) return c.json({ error: 'An MFA enrolment challenge is required.' }, 400)

    const preview = await challengeAccount(pool, challenge, 'enrolment')
    if (!preview) return c.json({ error: 'The MFA enrolment challenge has expired. Sign in again.' }, 401)
    if (!originMatchesTenant(c, preview.slug)) return c.json({ error: 'Tenant sign-in origin mismatch.' }, 403)

    if (!code) {
      const secret = await withTransaction((client) => provisionSecret(
        client,
        preview.tenant_id,
        preview.user_id,
      ))
      return c.json({
        status: 'mfa_setup_required',
        secret,
        otpauthUri: otpauthUri({
          secret,
          companyName: preview.company_name,
          email: preview.email,
        }),
      })
    }

    const completed = await withTransaction(async (client) => {
      const account = await challengeAccount(client, challenge, 'enrolment', true)
      if (!account) return null
      const method = await enabledMethod(client, account.tenant_id, account.user_id)
      if (!method) return { error: 'Start MFA setup again before entering the verification code.' }
      const result = verifyMethodCode(method, code, { allowRecovery: false })
      if (!result.ok || result.type !== 'totp') {
        await client.query(
          'UPDATE auth_mfa_challenges SET attempts = attempts + 1 WHERE id = $1',
          [account.challenge_id],
        )
        return { error: 'The verification code was not accepted. Check the current authenticator code.' }
      }

      const recovery = createRecoveryCodes()
      await client.query(
        `UPDATE user_mfa_methods
         SET enabled = true,
             verified_at = now(),
             recovery_code_hashes = $4::jsonb,
             last_used_step = $5,
             updated_at = now()
         WHERE tenant_id = $1 AND user_id = $2 AND method = $3`,
        [account.tenant_id, account.user_id, 'totp', JSON.stringify(recovery.hashes), result.step],
      )
      await client.query('UPDATE auth_mfa_challenges SET used_at = now() WHERE id = $1', [account.challenge_id])
      const token = await createSession(client, {
        tenantId: account.tenant_id,
        userId: account.user_id,
        mfaVerified: true,
        ttlSeconds: sessionTtlSeconds(account),
      })
      return { account, token, recoveryCodes: recovery.codes }
    })

    if (!completed) return c.json({ error: 'The MFA enrolment challenge has expired. Sign in again.' }, 401)
    if (completed.error) return c.json({ error: completed.error }, 400)
    setSessionCookie(c, completed.token, sessionTtlSeconds(completed.account))
    return c.json({
      status: 'mfa_enrolled',
      recoveryCodes: completed.recoveryCodes,
      session: sessionPayload(completed.account),
    })
  })

  app.post('/api/v1/auth/mfa/verify', async (c) => {
    let body
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'A valid JSON request body is required.' }, 400)
    }

    const challenge = text(body?.challenge, 256)
    const code = String(body?.code || '').trim()
    if (!challenge || !code) return c.json({ error: 'Enter your authentication or recovery code.' }, 400)

    const preview = await challengeAccount(pool, challenge, 'login')
    if (!preview) return c.json({ error: 'The MFA sign-in challenge has expired. Sign in again.' }, 401)
    if (!originMatchesTenant(c, preview.slug)) return c.json({ error: 'Tenant sign-in origin mismatch.' }, 403)

    const completed = await withTransaction(async (client) => {
      const account = await challengeAccount(client, challenge, 'login', true)
      if (!account) return null
      const method = await enabledMethod(client, account.tenant_id, account.user_id)
      if (!method?.enabled) return { error: 'MFA is not currently available for this account.' }
      const result = verifyMethodCode(method, code)
      if (!result.ok) {
        await client.query(
          'UPDATE auth_mfa_challenges SET attempts = attempts + 1 WHERE id = $1',
          [account.challenge_id],
        )
        return { error: 'The authentication code was not accepted.' }
      }

      if (result.type === 'totp') {
        await client.query(
          `UPDATE user_mfa_methods
           SET last_used_step = $4, updated_at = now()
           WHERE tenant_id = $1 AND user_id = $2 AND method = $3`,
          [account.tenant_id, account.user_id, 'totp', result.step],
        )
      } else {
        await client.query(
          `UPDATE user_mfa_methods
           SET recovery_code_hashes = $4::jsonb, updated_at = now()
           WHERE tenant_id = $1 AND user_id = $2 AND method = $3`,
          [account.tenant_id, account.user_id, 'totp', JSON.stringify(result.remainingHashes)],
        )
      }
      await client.query('UPDATE auth_mfa_challenges SET used_at = now() WHERE id = $1', [account.challenge_id])
      const token = await createSession(client, {
        tenantId: account.tenant_id,
        userId: account.user_id,
        mfaVerified: true,
        ttlSeconds: sessionTtlSeconds(account),
      })
      return { account, token }
    })

    if (!completed) return c.json({ error: 'The MFA sign-in challenge has expired. Sign in again.' }, 401)
    if (completed.error) return c.json({ error: completed.error }, 400)
    setSessionCookie(c, completed.token, sessionTtlSeconds(completed.account))
    return c.json(sessionPayload(completed.account))
  })

  app.get('/api/v1/security/mfa/status', async (c) => {
    const auth = await requireSession(c)
    if (auth.error) return auth.error
    const method = await enabledMethod(pool, auth.session.tenant_id, auth.session.user_id)
    return c.json(methodStatus(auth.session, method))
  })

  app.post('/api/v1/security/mfa/enrol', async (c) => {
    const auth = await requireSession(c)
    if (auth.error) return auth.error
    const existing = await enabledMethod(pool, auth.session.tenant_id, auth.session.user_id)
    if (existing?.enabled) return c.json({ error: 'MFA is already enrolled for this account.' }, 409)
    const secret = await withTransaction((client) => provisionSecret(
      client,
      auth.session.tenant_id,
      auth.session.user_id,
    ))
    return c.json({
      status: 'mfa_setup_required',
      secret,
      otpauthUri: otpauthUri({
        secret,
        companyName: auth.session.company_name,
        email: auth.session.email,
      }),
    })
  })

  app.post('/api/v1/security/mfa/confirm', async (c) => {
    const auth = await requireSession(c)
    if (auth.error) return auth.error
    let body
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'A valid JSON request body is required.' }, 400)
    }

    const method = await enabledMethod(pool, auth.session.tenant_id, auth.session.user_id)
    if (!method) return c.json({ error: 'Start MFA setup before entering a verification code.' }, 409)
    const result = verifyMethodCode(method, body?.code, { allowRecovery: false })
    if (!result.ok || result.type !== 'totp') return c.json({ error: 'The verification code was not accepted.' }, 400)

    const recovery = createRecoveryCodes()
    await pool.query(
      `UPDATE user_mfa_methods
       SET enabled = true,
           verified_at = now(),
           recovery_code_hashes = $4::jsonb,
           last_used_step = $5,
           updated_at = now()
       WHERE tenant_id = $1 AND user_id = $2 AND method = $3`,
      [auth.session.tenant_id, auth.session.user_id, 'totp', JSON.stringify(recovery.hashes), result.step],
    )
    return c.json({ status: 'mfa_enrolled', recoveryCodes: recovery.codes })
  })

  app.post('/api/v1/security/mfa/recovery-codes', async (c) => {
    const auth = await requireSession(c)
    if (auth.error) return auth.error
    let body
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'A valid JSON request body is required.' }, 400)
    }

    const password = String(body?.password || '')
    const code = String(body?.code || '').trim()
    if (!password || !code) return c.json({ error: 'Enter your password and current authenticator code.' }, 400)

    const account = await accountByIds(pool, auth.session.tenant_id, auth.session.user_id)
    const validPassword = await verifyPassword(password, account?.password_hash)
    if (!validPassword) return c.json({ error: 'Your password was not accepted.' }, 401)
    const method = await enabledMethod(pool, auth.session.tenant_id, auth.session.user_id)
    if (!method?.enabled) return c.json({ error: 'MFA is not enrolled for this account.' }, 409)
    const result = verifyMethodCode(method, code, { allowRecovery: false })
    if (!result.ok || result.type !== 'totp') return c.json({ error: 'The authentication code was not accepted.' }, 400)

    const recovery = createRecoveryCodes()
    await pool.query(
      `UPDATE user_mfa_methods
       SET recovery_code_hashes = $4::jsonb,
           last_used_step = $5,
           updated_at = now()
       WHERE tenant_id = $1 AND user_id = $2 AND method = $3`,
      [auth.session.tenant_id, auth.session.user_id, 'totp', JSON.stringify(recovery.hashes), result.step],
    )
    return c.json({ recoveryCodes: recovery.codes })
  })

  app.post('/api/v1/security/mfa/disable', async (c) => {
    const auth = await requireSession(c)
    if (auth.error) return auth.error
    let body
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'A valid JSON request body is required.' }, 400)
    }

    const password = String(body?.password || '')
    const code = String(body?.code || '').trim()
    if (!password || !code) return c.json({ error: 'Enter your password and current authentication code.' }, 400)

    const account = await accountByIds(pool, auth.session.tenant_id, auth.session.user_id)
    const validPassword = await verifyPassword(password, account?.password_hash)
    if (!validPassword) return c.json({ error: 'Your password was not accepted.' }, 401)
    const method = await enabledMethod(pool, auth.session.tenant_id, auth.session.user_id)
    if (!method?.enabled) return c.json({ error: 'MFA is not enrolled for this account.' }, 409)
    const result = verifyMethodCode(method, code)
    if (!result.ok) return c.json({ error: 'The authentication code was not accepted.' }, 400)

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE user_mfa_methods
         SET enabled = false,
             verified_at = NULL,
             recovery_code_hashes = '[]'::jsonb,
             last_used_step = NULL,
             updated_at = now()
         WHERE tenant_id = $1 AND user_id = $2 AND method = 'totp'`,
        [auth.session.tenant_id, auth.session.user_id],
      )
      await client.query(
        `UPDATE auth_sessions
         SET revoked_at = COALESCE(revoked_at, now())
         WHERE tenant_id = $1 AND user_id = $2 AND id <> $3`,
        [auth.session.tenant_id, auth.session.user_id, auth.session.session_id],
      )
    })
    return c.json({ status: 'mfa_disabled' })
  })
}
