import { createHash, randomBytes } from 'node:crypto'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { pool, withTransaction } from './db.js'
import { deployment, tenantUrls } from './deploymentConfig.js'
import { verifyPassword } from './password.js'
import { ensureRedisConnected } from './redis.js'
import { requestIp, requestUserAgent } from './securityAudit.js'

const COOKIE_NAME = 'hi5central_admin_session'
const SESSION_SECONDS = 60 * 60 * 12
const ADMIN_ROLES = new Set(['owner','admin','support','catalogue','billing','read_only'])
const WRITE_ROLES = new Set(['owner','admin'])
const BILLING_ROLES = new Set(['owner','admin','billing'])

function clean(value, max = 500) { return String(value ?? '').trim().slice(0, max) }
function normaliseEmail(value) { return clean(value, 254).toLowerCase() }
function hash(value) { return createHash('sha256').update(String(value || '')).digest('hex') }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) }
function validSlug(value) { return /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(value) && !value.includes('--') }

function originAllowed(c) {
  const origin = clean(c.req.header('origin')).toLowerCase()
  if (!origin || process.env.NODE_ENV !== 'production') return true
  return origin === `https://admin.${deployment.rootDomain}`
}
function cookieOptions(extra = {}) {
  return { secure: true, httpOnly: true, sameSite: 'Lax', path: '/api/platform', ...extra }
}

async function rateLimit(key, max, seconds) {
  const redis = await ensureRedisConnected()
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, seconds)
  return count <= max
}

async function audit(c, session, action, targetType = '', targetId = '', metadata = {}, db = pool) {
  await db.query(
    `INSERT INTO platform_admin_audit_events
      (actor_user_id,session_id,action,target_type,target_id,ip_address,user_agent,metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
    [session?.user_id || null, session?.session_id || null, clean(action,160), clean(targetType,80),
      clean(targetId,160), requestIp(c), requestUserAgent(c), JSON.stringify(metadata || {})],
  )
}

async function resolveAdminSession(c) {
  const token = getCookie(c, COOKIE_NAME)
  if (!token) return null
  const result = await pool.query(
    `SELECT s.id AS session_id,s.user_id,s.expires_at,u.email,u.name,m.role,m.status
       FROM platform_admin_sessions s
       JOIN users u ON u.id=s.user_id
       JOIN platform_admin_members m ON m.user_id=s.user_id
      WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now()
      LIMIT 1`,
    [hash(token)],
  )
  const row = result.rows[0]
  if (!row || row.status !== 'active' || !ADMIN_ROLES.has(row.role)) return null
  pool.query('UPDATE platform_admin_sessions SET last_seen_at=now() WHERE id=$1', [row.session_id]).catch(() => {})
  return row
}

async function requireAdmin(c, roles = null) {
  if (!originAllowed(c)) return { error: c.json({ error: 'Admin origin required.' }, 403) }
  const session = await resolveAdminSession(c)
  if (!session) return { error: c.json({ error: 'Platform administrator authentication required.' }, 401) }
  if (roles && !roles.has(session.role)) return { error: c.json({ error: 'This platform role cannot perform that action.' }, 403) }
  return { session }
}

function adminPayload(session) {
  return { authenticated: true, user: { id: session.user_id, name: session.name, email: session.email, role: session.role } }
}

export function registerPlatformAdminRoutes(app) {
  app.post('/api/platform/v1/auth/login', async (c) => {
    if (!originAllowed(c)) return c.json({ error: 'Admin origin required.' }, 403)
    let body
    try { body = await c.req.json() } catch { return c.json({ error: 'A valid JSON request body is required.' }, 400) }
    const email = normaliseEmail(body?.email)
    const password = String(body?.password || '')
    if (!validEmail(email) || !password) return c.json({ error: 'Enter a valid email address and password.' }, 400)
    if (!await rateLimit(`platform-admin-login:${requestIp(c)}:${email}`, 8, 900)) {
      return c.json({ error: 'Too many sign-in attempts. Try again later.' }, 429)
    }
    const result = await pool.query(
      `SELECT u.id AS user_id,u.email,u.name,u.password_hash,m.role,m.status
         FROM users u JOIN platform_admin_members m ON m.user_id=u.id
        WHERE u.email=$1 LIMIT 1`,
      [email],
    )
    const account = result.rows[0]
    if (!account || account.status !== 'active' || !await verifyPassword(password, account.password_hash)) {
      return c.json({ error: 'Email address or password is incorrect.' }, 401)
    }
    const token = randomBytes(32).toString('base64url')
    const created = await pool.query(
      `INSERT INTO platform_admin_sessions (user_id,token_hash,expires_at)
       VALUES ($1,$2,now()+make_interval(secs=>$3::int)) RETURNING id`,
      [account.user_id, hash(token), SESSION_SECONDS],
    )
    const session = { ...account, session_id: created.rows[0].id }
    setCookie(c, COOKIE_NAME, token, cookieOptions({ maxAge: SESSION_SECONDS }))
    await audit(c, session, 'platform.auth.login')
    return c.json(adminPayload(session))
  })

  app.get('/api/platform/v1/auth/session', async (c) => {
    const auth = await requireAdmin(c)
    if (auth.error) return auth.error
    return c.json(adminPayload(auth.session))
  })

  app.post('/api/platform/v1/auth/logout', async (c) => {
    const session = await resolveAdminSession(c)
    const token = getCookie(c, COOKIE_NAME)
    if (token) await pool.query(
      'UPDATE platform_admin_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE token_hash=$1',
      [hash(token)],
    )
    if (session) await audit(c, session, 'platform.auth.logout')
    deleteCookie(c, COOKIE_NAME, cookieOptions())
    return c.json({ ok: true })
  })

  app.get('/api/platform/v1/overview', async (c) => {
    const auth = await requireAdmin(c)
    if (auth.error) return auth.error
    const [tenants, devices, catalogue, qualification, runners] = await Promise.all([
      pool.query(`SELECT count(*)::int total,count(*) FILTER (WHERE status='active')::int active FROM tenants`),
      pool.query(`SELECT count(*)::int total,count(*) FILTER (WHERE websocket_status='Connected')::int online FROM rmm_agent_devices`),
      pool.query(`SELECT count(*) FILTER (WHERE tenant_id IS NULL AND status='active')::int total,
                         count(*) FILTER (WHERE tenant_id IS NULL AND status='active' AND qualification_state='qualified')::int qualified,
                         count(*) FILTER (WHERE tenant_id IS NULL AND status='active' AND qualification_state='deployment_candidate')::int candidates
                    FROM rmm_software_catalogue`),
      pool.query(`SELECT count(*) FILTER (WHERE state IN ('queued','running','cleanup_pending','cleanup_running'))::int active,
                         count(*) FILTER (WHERE state='review_required')::int review
                    FROM rmm_software_qualification_queue`),
      pool.query(`SELECT count(*)::int total,count(*) FILTER (WHERE enabled)::int enabled
                    FROM rmm_software_vendor_qualification_runners`),
    ])
    return c.json({
      tenants: tenants.rows[0],
      devices: devices.rows[0],
      catalogue: catalogue.rows[0],
      qualification: qualification.rows[0],
      runners: runners.rows[0],
    })
  })

  app.get('/api/platform/v1/tenants', async (c) => {
    const auth = await requireAdmin(c)
    if (auth.error) return auth.error
    const result = await pool.query(
      `SELECT t.id,t.slug,t.company_name,t.status,t.created_at,t.updated_at,
              ts.modules,ts.tenant_url,ts.portal_url,ts.rmm_url,ts.onboarding_completed_at,
              COALESCE(cs.plan_key,'custom') AS plan_key,COALESCE(cs.billing_status,'trial') AS billing_status,
              COALESCE(cs.billing_cycle,'monthly') AS billing_cycle,COALESCE(cs.currency,'GBP') AS currency,
              cs.monthly_price_pence,cs.trial_ends_at,cs.renewal_at,COALESCE(cs.notes,'') AS billing_notes,
              count(DISTINCT m.user_id)::int AS user_count,
              count(DISTINCT d.id)::int AS device_count
         FROM tenants t
         JOIN tenant_settings ts ON ts.tenant_id=t.id
         LEFT JOIN tenant_commercial_settings cs ON cs.tenant_id=t.id
         LEFT JOIN tenant_memberships m ON m.tenant_id=t.id
         LEFT JOIN rmm_agent_devices d ON d.tenant_id=t.id
        GROUP BY t.id,ts.tenant_id,cs.tenant_id
        ORDER BY lower(t.company_name)`,
    )
    return c.json({ items: result.rows })
  })

  app.post('/api/platform/v1/tenants', async (c) => {
    const auth = await requireAdmin(c, WRITE_ROLES)
    if (auth.error) return auth.error
    let body
    try { body = await c.req.json() } catch { return c.json({ error: 'A valid JSON request body is required.' }, 400) }
    const companyName = clean(body?.companyName, 120)
    const slug = clean(body?.slug, 48).toLowerCase()
    if (companyName.length < 2 || !validSlug(slug)) {
      return c.json({ error: 'Company name and a valid tenant slug are required.' }, 400)
    }
    const itsm = body?.modules?.itsm !== false
    const rmm = body?.modules?.rmm === true
    const status = ['pending_verification','active','suspended','closed'].includes(body?.status) ? body.status : 'active'
    const urls = tenantUrls(slug, { rmm })
    try {
      const tenant = await withTransaction(async (db) => {
        const inserted = await db.query(
          `INSERT INTO tenants (slug,company_name,status) VALUES ($1,$2,$3)
           RETURNING id,slug,company_name,status,created_at`,
          [slug, companyName, status],
        )
        const row = inserted.rows[0]
        await db.query(
          `INSERT INTO tenant_settings (tenant_id,modules,onboarding_step,tenant_url,portal_url,rmm_url)
           VALUES ($1,$2::jsonb,'company',$3,$4,$5)`,
          [row.id, JSON.stringify({ itsm, rmm }), urls.tenantUrl, urls.portalUrl, urls.rmmUrl],
        )
        await db.query(
          `INSERT INTO tenant_commercial_settings (tenant_id,plan_key,billing_status,billing_cycle)
           VALUES ($1,$2,$3,$4)`,
          [row.id, clean(body?.planKey,80) || 'custom',
            ['trial','active','past_due','suspended','cancelled'].includes(body?.billingStatus) ? body.billingStatus : 'trial',
            ['monthly','annual','custom'].includes(body?.billingCycle) ? body.billingCycle : 'monthly'],
        )
        await audit(c, auth.session, 'tenant.created', 'tenant', row.id, { slug, companyName, modules: { itsm, rmm } }, db)
        return row
      })
      return c.json({ tenant }, 201)
    } catch (error) {
      if (error?.code === '23505') return c.json({ error: 'That tenant slug already exists.' }, 409)
      throw error
    }
  })

  app.patch('/api/platform/v1/tenants/:id', async (c) => {
    const auth = await requireAdmin(c)
    if (auth.error) return auth.error
    const tenantId = clean(c.req.param('id'), 80)
    let body
    try { body = await c.req.json() } catch { return c.json({ error: 'A valid JSON request body is required.' }, 400) }
    const touchesBilling = ['planKey','billingStatus','billingCycle','currency','monthlyPricePence','trialEndsAt','renewalAt','billingNotes']
      .some((key) => Object.hasOwn(body || {}, key))
    const touchesTenant = ['companyName','status','modules'].some((key) => Object.hasOwn(body || {}, key))
    if (touchesBilling && !BILLING_ROLES.has(auth.session.role)) return c.json({ error: 'Billing permission required.' }, 403)
    if (touchesTenant && !WRITE_ROLES.has(auth.session.role)) return c.json({ error: 'Platform admin permission required.' }, 403)
    const existing = await pool.query(
      `SELECT t.*,ts.modules FROM tenants t JOIN tenant_settings ts ON ts.tenant_id=t.id WHERE t.id=$1 LIMIT 1`,
      [tenantId],
    )
    if (!existing.rowCount) return c.json({ error: 'Tenant not found.' }, 404)
    const current = existing.rows[0]
    const modules = {
      itsm: body?.modules?.itsm ?? Boolean(current.modules?.itsm),
      rmm: body?.modules?.rmm ?? Boolean(current.modules?.rmm),
    }
    const urls = tenantUrls(current.slug, { rmm: modules.rmm })
    await withTransaction(async (db) => {
      if (touchesTenant) {
        const companyName = Object.hasOwn(body,'companyName') ? clean(body.companyName,120) : current.company_name
        const status = Object.hasOwn(body,'status')
          && ['pending_verification','active','suspended','closed'].includes(body.status) ? body.status : current.status
        await db.query(
          'UPDATE tenants SET company_name=$2,status=$3,updated_at=now() WHERE id=$1',
          [tenantId, companyName, status],
        )
        await db.query(
          `UPDATE tenant_settings SET modules=$2::jsonb,tenant_url=$3,portal_url=$4,rmm_url=$5,updated_at=now()
            WHERE tenant_id=$1`,
          [tenantId, JSON.stringify(modules), urls.tenantUrl, urls.portalUrl, urls.rmmUrl],
        )
      }
      if (touchesBilling) {
        await db.query(
          'INSERT INTO tenant_commercial_settings (tenant_id) VALUES ($1) ON CONFLICT (tenant_id) DO NOTHING',
          [tenantId],
        )
        await db.query(
          `UPDATE tenant_commercial_settings SET
             plan_key=COALESCE($2,plan_key),billing_status=COALESCE($3,billing_status),
             billing_cycle=COALESCE($4,billing_cycle),currency=COALESCE($5,currency),
             monthly_price_pence=CASE WHEN $6::boolean THEN $7 ELSE monthly_price_pence END,
             trial_ends_at=CASE WHEN $8::boolean THEN $9::timestamptz ELSE trial_ends_at END,
             renewal_at=CASE WHEN $10::boolean THEN $11::timestamptz ELSE renewal_at END,
             notes=COALESCE($12,notes),updated_at=now()
           WHERE tenant_id=$1`,
          [tenantId,
            Object.hasOwn(body,'planKey') ? clean(body.planKey,80) : null,
            Object.hasOwn(body,'billingStatus') && ['trial','active','past_due','suspended','cancelled'].includes(body.billingStatus) ? body.billingStatus : null,
            Object.hasOwn(body,'billingCycle') && ['monthly','annual','custom'].includes(body.billingCycle) ? body.billingCycle : null,
            Object.hasOwn(body,'currency') ? clean(body.currency,3).toUpperCase() : null,
            Object.hasOwn(body,'monthlyPricePence'), body.monthlyPricePence == null ? null : Math.max(0, Number(body.monthlyPricePence) || 0),
            Object.hasOwn(body,'trialEndsAt'), body.trialEndsAt || null,
            Object.hasOwn(body,'renewalAt'), body.renewalAt || null,
            Object.hasOwn(body,'billingNotes') ? clean(body.billingNotes,4000) : null],
        )
      }
      await audit(c, auth.session, 'tenant.updated', 'tenant', tenantId, { fields: Object.keys(body || {}) }, db)
    })
    return c.json({ ok: true })
  })

  app.get('/api/platform/v1/software/catalogue', async (c) => {
    const auth = await requireAdmin(c)
    if (auth.error) return auth.error
    const result = await pool.query(
      `SELECT id,canonical_name,publisher,target_version,qualification_state,status,installer_type,
              source_metadata->>'installerTechnology' AS installer_technology,
              source_metadata->>'deploymentLimitation' AS deployment_limitation,
              qualification_notes,updated_at
         FROM rmm_software_catalogue
        WHERE tenant_id IS NULL AND status<>'archived'
        ORDER BY lower(canonical_name)
        LIMIT 1500`,
    )
    return c.json({ items: result.rows })
  })

  app.get('/api/platform/v1/qualification', async (c) => {
    const auth = await requireAdmin(c)
    if (auth.error) return auth.error
    const [runners, active, recent] = await Promise.all([
      pool.query(
        `SELECT r.agent_device_id AS id,r.agent_device_id,r.enabled,r.updated_at,i.name AS hostname,
                a.agent_version,a.websocket_status,a.patch_capabilities->>'patchHostVersion' AS patch_host_version,
                a.last_telemetry_at
           FROM rmm_software_vendor_qualification_runners r
           LEFT JOIN rmm_agent_devices a ON a.id=r.agent_device_id
           LEFT JOIN rmm_device_inventory i ON i.id=a.inventory_id
          ORDER BY r.updated_at DESC`,
      ),
      pool.query(
        `SELECT q.id,c.canonical_name,c.target_version,q.test_type,q.state,q.priority,q.attempt_count,q.last_error,q.updated_at
           FROM rmm_software_qualification_queue q JOIN rmm_software_catalogue c ON c.id=q.catalogue_id
          WHERE q.state IN ('queued','running','cleanup_pending','cleanup_running')
          ORDER BY q.priority DESC,q.updated_at LIMIT 100`,
      ),
      pool.query(
        `SELECT q.id,c.canonical_name,c.target_version,q.test_type,q.state,q.attempt_count,q.last_error,q.updated_at
           FROM rmm_software_qualification_queue q JOIN rmm_software_catalogue c ON c.id=q.catalogue_id
          WHERE q.state IN ('passed','review_required','cancelled')
          ORDER BY q.updated_at DESC LIMIT 100`,
      ),
    ])
    return c.json({ runners: runners.rows, active: active.rows, recent: recent.rows })
  })

  app.get('/api/platform/v1/audit', async (c) => {
    const auth = await requireAdmin(c, new Set(['owner','admin','read_only']))
    if (auth.error) return auth.error
    const result = await pool.query(
      `SELECT a.id,a.action,a.target_type,a.target_id,a.metadata,a.created_at,u.name AS actor_name
         FROM platform_admin_audit_events a LEFT JOIN users u ON u.id=a.actor_user_id
        ORDER BY a.created_at DESC LIMIT 200`,
    )
    return c.json({ items: result.rows })
  })
}
