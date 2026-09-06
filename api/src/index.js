import { createHash, randomBytes, scrypt } from 'node:crypto'
import { promisify } from 'node:util'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { pool, withTransaction } from './db.js'
import { ensureRedisConnected, redis } from './redis.js'

const scryptAsync = promisify(scrypt)
const app = new Hono()
const port = Number(process.env.PORT || 3001)

const reservedSlugs = new Set([
  'admin',
  'api',
  'app',
  'auth',
  'downloads',
  'help',
  'login',
  'mail',
  'portal',
  'reseller',
  'rmm',
  'signup',
  'smtp',
  'status',
  'support',
  'turn',
  'www',
])

function normaliseEmail(value = '') {
  return String(value).trim().toLowerCase()
}

function normaliseSlug(value = '') {
  return String(value).trim().toLowerCase()
}

function validSlug(slug) {
  return (
    /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(slug) &&
    !slug.includes('--') &&
    !slug.endsWith('-portal') &&
    !slug.endsWith('-rmm') &&
    !reservedSlugs.has(slug)
  )
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
}

async function hashPassword(password) {
  const salt = randomBytes(16)
  const derived = await scryptAsync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  })
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function requestIp(c) {
  const forwarded = c.req.header('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return c.req.header('x-real-ip') || 'unknown'
}

function allowedOrigin(origin) {
  if (!origin) return ''
  if (origin === 'https://hi5central.com' || origin === 'https://www.hi5central.com') return origin
  if (/^https:\/\/[a-z0-9-]+(?:-portal|-rmm)?\.hi5central\.com$/i.test(origin)) return origin
  if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(origin)) return origin
  return ''
}

app.use('*', secureHeaders())
app.use('/api/*', cors({
  origin: allowedOrigin,
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 600,
}))

app.get('/live', (c) => c.json({ status: 'ok', service: 'hi5central-api' }))

app.get('/health', async (c) => {
  try {
    await pool.query('SELECT 1')
    const redisClient = await ensureRedisConnected()
    await redisClient.ping()
    return c.json({ status: 'ok', postgres: 'ok', redis: 'ok' })
  } catch (error) {
    console.error('Health check failed', error)
    return c.json({ status: 'error' }, 503)
  }
})

app.get('/api/v1/auth/tenant-slug/:slug', async (c) => {
  const slug = normaliseSlug(c.req.param('slug'))
  if (!validSlug(slug)) {
    return c.json({ slug, available: false, reason: 'invalid' }, 200)
  }

  const result = await pool.query('SELECT 1 FROM tenants WHERE slug = $1 LIMIT 1', [slug])
  return c.json({ slug, available: result.rowCount === 0 })
})

app.post('/api/v1/auth/signup', async (c) => {
  const redisClient = await ensureRedisConnected()
  const rateKey = `signup:${requestIp(c)}:${Math.floor(Date.now() / 60000)}`
  const attempts = await redisClient.incr(rateKey)
  if (attempts === 1) await redisClient.expire(rateKey, 60)
  if (attempts > 5) {
    return c.json({ error: 'Too many signup attempts. Please try again shortly.' }, 429)
  }

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'A valid JSON request body is required.' }, 400)
  }

  const companyName = String(body?.companyName || '').trim()
  const tenantSlug = normaliseSlug(body?.tenantSlug)
  const name = String(body?.name || '').trim()
  const email = normaliseEmail(body?.email)
  const password = String(body?.password || '')
  const requestedModules = Array.isArray(body?.modules) ? body.modules.map(String) : ['itsm']
  const modules = [...new Set(requestedModules.filter((item) => ['itsm', 'rmm'].includes(item)))]

  if (companyName.length < 2 || companyName.length > 120) {
    return c.json({ error: 'Company name must be between 2 and 120 characters.' }, 400)
  }
  if (!validSlug(tenantSlug)) {
    return c.json({ error: 'Choose a valid tenant URL using 3-48 lowercase letters, numbers or hyphens.' }, 400)
  }
  if (name.length < 2 || name.length > 120) {
    return c.json({ error: 'Your name must be between 2 and 120 characters.' }, 400)
  }
  if (!validEmail(email)) {
    return c.json({ error: 'Enter a valid email address.' }, 400)
  }
  if (password.length < 12 || password.length > 256) {
    return c.json({ error: 'Use a password or passphrase of at least 12 characters.' }, 400)
  }
  if (!modules.length) {
    return c.json({ error: 'Select at least one Hi5Central product.' }, 400)
  }

  const [slugExists, emailExists] = await Promise.all([
    pool.query('SELECT 1 FROM tenants WHERE slug = $1 LIMIT 1', [tenantSlug]),
    pool.query('SELECT 1 FROM users WHERE email = $1 LIMIT 1', [email]),
  ])

  if (slugExists.rowCount) {
    return c.json({ error: 'That tenant URL is already in use.', field: 'tenantSlug' }, 409)
  }
  if (emailExists.rowCount) {
    return c.json({ error: 'An account already exists for that email address.', field: 'email' }, 409)
  }

  const passwordHash = await hashPassword(password)
  const verificationToken = randomBytes(32).toString('base64url')
  const verificationTokenHash = hashToken(verificationToken)
  const tenantUrl = `https://${tenantSlug}.hi5central.com`
  const portalUrl = `https://${tenantSlug}-portal.hi5central.com`
  const rmmUrl = modules.includes('rmm') ? `https://${tenantSlug}-rmm.hi5central.com` : null

  try {
    const result = await withTransaction(async (client) => {
      const tenantResult = await client.query(
        `INSERT INTO tenants (slug, company_name)
         VALUES ($1, $2)
         RETURNING id, slug, company_name, status`,
        [tenantSlug, companyName],
      )
      const tenant = tenantResult.rows[0]

      const userResult = await client.query(
        `INSERT INTO users (email, name, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, email, name`,
        [email, name, passwordHash],
      )
      const user = userResult.rows[0]

      await client.query(
        `INSERT INTO tenant_memberships (tenant_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [tenant.id, user.id],
      )

      await client.query(
        `INSERT INTO tenant_settings
           (tenant_id, modules, onboarding_step, tenant_url, portal_url, rmm_url)
         VALUES ($1, $2::jsonb, 'verify_email', $3, $4, $5)`,
        [
          tenant.id,
          JSON.stringify({ itsm: modules.includes('itsm'), rmm: modules.includes('rmm') }),
          tenantUrl,
          portalUrl,
          rmmUrl,
        ],
      )

      await client.query(
        `INSERT INTO user_email_verifications
           (tenant_id, user_id, token_hash, redirect_url, expires_at)
         VALUES ($1, $2, $3, $4, now() + interval '24 hours')`,
        [tenant.id, user.id, verificationTokenHash, tenantUrl],
      )

      return { tenant, user }
    })

    return c.json({
      status: 'pending_verification',
      verificationRequired: true,
      onboardingStep: 'verify_email',
      tenant: {
        slug: result.tenant.slug,
        companyName: result.tenant.company_name,
        tenantUrl,
        portalUrl,
        rmmUrl,
      },
      admin: {
        name: result.user.name,
        email: result.user.email,
      },
    }, 201)
  } catch (error) {
    if (error?.code === '23505') {
      return c.json({ error: 'That tenant URL or email address is already registered.' }, 409)
    }
    throw error
  }
})

app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((error, c) => {
  console.error('Unhandled API error', error)
  return c.json({ error: 'Internal server error' }, 500)
})

await pool.query('SELECT 1')
await ensureRedisConnected()

const server = serve({
  fetch: app.fetch,
  hostname: '0.0.0.0',
  port,
})

console.log(`Hi5Central API listening on port ${port}`)

async function shutdown(signal) {
  console.log(`Received ${signal}; shutting down`)
  server.close(async () => {
    try {
      if (redis.isOpen) await redis.quit()
      await pool.end()
    } finally {
      process.exit(0)
    }
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
