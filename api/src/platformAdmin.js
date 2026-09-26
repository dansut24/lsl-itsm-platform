import { createHash, randomBytes } from 'node:crypto'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { pool, withTransaction } from './db.js'
import { deployment, tenantUrls } from './deploymentConfig.js'
import { verifyPassword } from './password.js'
import { ensureRedisConnected } from './redis.js'
import { requestIp, requestUserAgent } from './securityAudit.js'
import {
  cancelSoftwareQualificationQueue,
  forceQualificationCleanup,
  prioritiseSoftwareQualificationQueue,
  qualificationRunnerContaminantsForAdmin,
  retrySoftwareQualification,
  runSoftwareQualificationQueue,
  setQualificationRunnerDispatch,
} from './rmmSoftwareQualification.js'
import { syncSoftwareVendorSource } from './rmmSoftwareVendorIntel.js'

const COOKIE_NAME = 'hi5central_admin_session'
const SESSION_SECONDS = 60 * 60 * 12
const ADMIN_ROLES = new Set(['owner','admin','support','catalogue','billing','read_only'])
const WRITE_ROLES = new Set(['owner','admin'])
const BILLING_ROLES = new Set(['owner','admin','billing'])
const CATALOGUE_ROLES = new Set(['owner','admin','catalogue'])

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
        `SELECT r.agent_device_id AS id,r.agent_device_id,r.enabled,r.dispatch_enabled,
                r.pause_reason,r.paused_at,r.updated_at,i.name AS hostname,
                a.agent_version,a.websocket_status,a.patch_capabilities->>'patchHostVersion' AS patch_host_version,
                a.last_telemetry_at,a.last_inventory_at
           FROM rmm_software_vendor_qualification_runners r
           LEFT JOIN rmm_agent_devices a ON a.id=r.agent_device_id
           LEFT JOIN rmm_device_inventory i ON i.id=a.inventory_id
          ORDER BY r.updated_at DESC`,
      ),
      pool.query(
        `SELECT q.id,q.catalogue_id,c.canonical_name,c.target_version,q.test_type,q.state,q.priority,
                q.attempt_count,q.last_error,q.runner_agent_device_id,q.agent_job_id,q.cleanup_job_id,
                q.evidence,q.started_at,q.updated_at,
                install_job.status AS agent_job_status,cleanup_job.status AS cleanup_job_status
           FROM rmm_software_qualification_queue q
           JOIN rmm_software_catalogue c ON c.id=q.catalogue_id
           LEFT JOIN rmm_agent_jobs install_job ON install_job.id=q.agent_job_id
           LEFT JOIN rmm_agent_jobs cleanup_job ON cleanup_job.id=q.cleanup_job_id
          WHERE q.state IN ('queued','running','cleanup_pending','cleanup_running')
          ORDER BY q.priority DESC,q.updated_at LIMIT 100`,
      ),
      pool.query(
        `SELECT q.id,q.catalogue_id,c.canonical_name,c.target_version,q.test_type,q.state,q.priority,
                q.attempt_count,q.last_error,q.runner_agent_device_id,q.agent_job_id,q.cleanup_job_id,
                q.evidence,q.started_at,q.completed_at,q.updated_at
           FROM rmm_software_qualification_queue q
           JOIN rmm_software_catalogue c ON c.id=q.catalogue_id
          WHERE q.state IN ('passed','review_required','cancelled')
          ORDER BY q.updated_at DESC LIMIT 150`,
      ),
    ])
    const runnerItems = await Promise.all(runners.rows.map(async (runner) => ({
      ...runner,
      contaminants: await qualificationRunnerContaminantsForAdmin(runner.agent_device_id),
    })))
    return c.json({ runners: runnerItems, active: active.rows, recent: recent.rows })
  })

  app.post('/api/platform/v1/qualification/runners/:agentDeviceId/action', async (c) => {
    const auth = await requireAdmin(c, CATALOGUE_ROLES)
    if (auth.error) return auth.error
    let body = {}
    try { body = await c.req.json() } catch {}
    const agentDeviceId = clean(c.req.param('agentDeviceId'), 80)
    const action = clean(body.action, 40).toLowerCase()
    let result
    if (action === 'pause' || action === 'drain') {
      result = await setQualificationRunnerDispatch(agentDeviceId, {
        dispatchEnabled: false,
        reason: clean(body.reason, 500) || (action === 'drain' ? 'Drain requested from Hi5Central Admin' : 'Paused from Hi5Central Admin'),
        userId: auth.session.user_id,
      })
    } else if (action === 'resume') {
      result = await setQualificationRunnerDispatch(agentDeviceId, {
        dispatchEnabled: true,
        userId: auth.session.user_id,
      })
    } else if (action === 'tick' || action === 'reconcile') {
      result = await runSoftwareQualificationQueue({ dispatchLimit: 1 })
    } else if (action === 'cleanup_contaminants') {
      const contaminants = await qualificationRunnerContaminantsForAdmin(agentDeviceId)
      if (!contaminants.length) {
        result = { ok: true, clean: true, contaminants: [] }
      } else {
        const contaminant = contaminants[0]
        result = await forceQualificationCleanup(contaminant.queueId, { userId: auth.session.user_id })
        result.contaminant = contaminant
      }
    } else {
      return c.json({ error: 'Unsupported runner action.' }, 400)
    }
    if (!result) return c.json({ error: 'Qualification runner not found.' }, 404)
    if (result?.ok === false) return c.json({ error: result.reason || 'Runner action could not be completed.', result }, 409)
    await audit(c, auth.session, 'qualification.runner.' + action, 'agent_device', agentDeviceId, { result })
    return c.json({ ok: true, result })
  })

  app.post('/api/platform/v1/qualification/queue/:queueId/action', async (c) => {
    const auth = await requireAdmin(c, CATALOGUE_ROLES)
    if (auth.error) return auth.error
    let body = {}
    try { body = await c.req.json() } catch {}
    const queueId = clean(c.req.param('queueId'), 80)
    const action = clean(body.action, 40).toLowerCase()
    const current = await pool.query(
      `SELECT q.id,q.catalogue_id,q.test_type,q.state,c.canonical_name
         FROM rmm_software_qualification_queue q
         JOIN rmm_software_catalogue c ON c.id=q.catalogue_id
        WHERE q.id=$1 LIMIT 1`,
      [queueId],
    )
    const row = current.rows[0]
    if (!row) return c.json({ error: 'Qualification queue item not found.' }, 404)
    let result
    if (action === 'cancel') {
      result = await cancelSoftwareQualificationQueue(queueId, { userId: auth.session.user_id })
    } else if (action === 'cleanup') {
      result = await forceQualificationCleanup(queueId, { userId: auth.session.user_id })
    } else if (action === 'run_now') {
      const prioritised = await prioritiseSoftwareQualificationQueue(queueId, { priority: body.priority || 50000 })
      if (!prioritised) return c.json({ error: 'Only queued qualification items can be run now.' }, 409)
      result = { prioritised, dispatch: await runSoftwareQualificationQueue({ dispatchLimit: 1 }) }
    } else if (action === 'requeue') {
      result = await retrySoftwareQualification(row.catalogue_id, { mode: 'clean_only' })
      if (result.queued && body.runNow !== false) {
        await prioritiseSoftwareQualificationQueue(result.queue?.id, { priority: body.priority || 50000 })
        result.dispatch = await runSoftwareQualificationQueue({ dispatchLimit: 1 })
      }
    } else if (action === 'reconcile') {
      result = await runSoftwareQualificationQueue({ dispatchLimit: 1 })
    } else {
      return c.json({ error: 'Unsupported qualification queue action.' }, 400)
    }
    if (result?.ok === false || result?.queued === false) {
      return c.json({ error: result.reason || 'Qualification action could not be completed.', result }, 409)
    }
    await audit(c, auth.session, 'qualification.queue.' + action, 'qualification_queue', queueId, {
      catalogueId: row.catalogue_id,
      applicationName: row.canonical_name,
      priorState: row.state,
      result,
    })
    return c.json({ ok: true, result })
  })

  app.get('/api/platform/v1/software/catalogue/:catalogueId', async (c) => {
    const auth = await requireAdmin(c)
    if (auth.error) return auth.error
    const catalogueId = clean(c.req.param('catalogueId'), 80)
    const software = await pool.query(
      `SELECT c.*,
              s.source_key,s.source_type,s.source_url,s.enabled AS source_enabled,
              s.last_success_at AS source_last_success_at,s.last_error AS source_last_error,
              r.id AS release_id,r.version AS release_version,r.installer_url,r.installer_sha256,
              r.installer_type AS release_installer_type,r.trust_state,r.asset_health_state,
              r.source_payload AS release_source_payload,r.trust_evidence,
              b.metadata AS binding_metadata
         FROM rmm_software_catalogue c
         LEFT JOIN rmm_software_vendor_sources s ON s.source_key=c.source_metadata->>'latestSource'
         LEFT JOIN rmm_software_vendor_releases r
           ON r.source_key=s.source_key AND r.provider_package_id=c.external_key AND r.version=c.target_version
         LEFT JOIN rmm_software_vendor_bindings b
           ON b.source_key=s.source_key AND b.provider_package_id=c.external_key AND b.enabled=true
        WHERE c.id=$1 AND c.tenant_id IS NULL
        ORDER BY r.source_priority DESC NULLS LAST,r.last_seen_at DESC NULLS LAST
        LIMIT 1`,
      [catalogueId],
    )
    if (!software.rowCount) return c.json({ error: 'Software catalogue entry not found.' }, 404)
    const [queues, jobs] = await Promise.all([
      pool.query(
        `SELECT id,test_type,state,priority,attempt_count,runner_agent_device_id,agent_job_id,
                cleanup_job_id,last_error,evidence,started_at,completed_at,created_at,updated_at
           FROM rmm_software_qualification_queue
          WHERE catalogue_id=$1 ORDER BY test_type`,
        [catalogueId],
      ),
      pool.query(
        `SELECT id,job_type,status,error_message,request_metadata,result,created_at,claimed_at,completed_at
           FROM rmm_agent_jobs
          WHERE request_metadata->>'catalogue_id'=$1
             OR request_metadata->>'catalogueId'=$1
          ORDER BY created_at DESC LIMIT 40`,
        [catalogueId],
      ),
    ])
    return c.json({ software: software.rows[0], queues: queues.rows, jobs: jobs.rows })
  })

  app.patch('/api/platform/v1/software/catalogue/:catalogueId', async (c) => {
    const auth = await requireAdmin(c, CATALOGUE_ROLES)
    if (auth.error) return auth.error
    let body
    try { body = await c.req.json() } catch { return c.json({ error: 'A valid JSON request body is required.' }, 400) }
    const catalogueId = clean(c.req.param('catalogueId'), 80)
    const currentResult = await pool.query(
      `SELECT * FROM rmm_software_catalogue WHERE id=$1 AND tenant_id IS NULL LIMIT 1`,
      [catalogueId],
    )
    const current = currentResult.rows[0]
    if (!current) return c.json({ error: 'Software catalogue entry not found.' }, 404)
    const active = await pool.query(
      `SELECT id,state FROM rmm_software_qualification_queue
        WHERE catalogue_id=$1 AND state IN ('running','cleanup_pending','cleanup_running') LIMIT 1`,
      [catalogueId],
    )
    const touchesValidation = ['canonicalName','publisher','installArguments','installerTechnology','expectedSigner','verification']
      .some((key) => Object.hasOwn(body || {}, key))
    if (touchesValidation && active.rowCount) {
      return c.json({ error: 'Finish or safely cancel the active qualification before editing validation settings.', state: active.rows[0].state }, 409)
    }
    const canonicalName = Object.hasOwn(body,'canonicalName') ? clean(body.canonicalName, 180) : current.canonical_name
    const publisher = Object.hasOwn(body,'publisher') ? clean(body.publisher, 180) : current.publisher
    const status = Object.hasOwn(body,'status') && ['active','disabled','archived'].includes(clean(body.status))
      ? clean(body.status) : current.status
    if (!canonicalName) return c.json({ error: 'Canonical name is required.' }, 400)
    const execution = { ...(current.execution || {}) }
    const verification = { ...(current.verification || {}) }
    const sourceMetadata = { ...(current.source_metadata || {}) }
    if (Object.hasOwn(body,'installArguments')) execution.installArguments = clean(body.installArguments, 4000)
    if (body.verification && typeof body.verification === 'object') Object.assign(verification, body.verification)
    if (Object.hasOwn(body,'installerTechnology')) sourceMetadata.installerTechnology = clean(body.installerTechnology, 80)
    if (Object.hasOwn(body,'expectedSigner')) sourceMetadata.expectedSigner = clean(body.expectedSigner, 500)
    if (Object.hasOwn(body,'deploymentLimitation')) sourceMetadata.deploymentLimitation = clean(body.deploymentLimitation, 160)
    const qualificationNotes = Object.hasOwn(body,'qualificationNotes')
      ? clean(body.qualificationNotes, 4000) : current.qualification_notes
    const latestSource = clean(sourceMetadata.latestSource)
    await withTransaction(async (db) => {
      await db.query(
        `UPDATE rmm_software_catalogue
            SET canonical_name=$2,publisher=$3,status=$4,execution=$5::jsonb,verification=$6::jsonb,
                source_metadata=$7::jsonb,qualification_notes=$8,updated_by_user_id=$9,
                qualification_state=CASE WHEN $10::boolean AND qualification_state<>'blocked' THEN 'deployment_candidate' ELSE qualification_state END,
                qualification_version=CASE WHEN $10::boolean THEN '' ELSE qualification_version END,
                qualified_at=CASE WHEN $10::boolean THEN NULL ELSE qualified_at END,
                qualification_evidence=CASE WHEN $10::boolean THEN
                  qualification_evidence
                    - 'cleanInstallVerified' - 'cleanInstallVersion' - 'cleanInstallVerifiedAt'
                    - 'uninstallVerified' - 'uninstallVerifiedAt'
                    - 'automaticAdmissionVerified' - 'automaticAdmissionState'
                  ELSE qualification_evidence END,
                updated_at=now()
          WHERE id=$1`,
        [catalogueId, canonicalName, publisher, status, JSON.stringify(execution), JSON.stringify(verification),
          JSON.stringify(sourceMetadata), qualificationNotes, auth.session.user_id, touchesValidation],
      )
      if (latestSource) {
        const bindingPatch = {
          ...(Object.hasOwn(body,'installArguments') ? { installArguments: execution.installArguments, manualExecutionOverride: true, manualExecutionOverrideAt: new Date().toISOString() } : {}),
          ...(Object.hasOwn(body,'installerTechnology') ? { installerTechnology: sourceMetadata.installerTechnology } : {}),
          ...(Object.hasOwn(body,'expectedSigner') ? { expectedSigner: sourceMetadata.expectedSigner } : {}),
          ...(body.verification ? { verificationConfig: verification } : {}),
        }
        if (Object.keys(bindingPatch).length) {
          await db.query(
            `UPDATE rmm_software_vendor_bindings
                SET metadata=metadata || $3::jsonb
              WHERE source_key=$1 AND provider_package_id=$2 AND enabled=true`,
            [latestSource, current.external_key, JSON.stringify(bindingPatch)],
          )
          await db.query(
            `UPDATE rmm_software_vendor_releases
                SET source_payload=source_payload || $3::jsonb,
                    trust_state=CASE WHEN $4::boolean THEN 'asset_candidate' ELSE trust_state END
              WHERE source_key=$1 AND provider_package_id=$2 AND version=$5`,
            [latestSource, current.external_key, JSON.stringify({
              ...(Object.hasOwn(body,'installerTechnology') ? { installerTechnology: sourceMetadata.installerTechnology } : {}),
              ...(Object.hasOwn(body,'installArguments') ? { installArguments: execution.installArguments } : {}),
              ...(Object.hasOwn(body,'expectedSigner') ? { expectedSigner: sourceMetadata.expectedSigner } : {}),
              ...(body.verification ? { verification } : {}),
            }), Object.hasOwn(body,'expectedSigner'), current.target_version],
          )
        }
      }
      if (touchesValidation) {
        await db.query(
          `UPDATE rmm_software_qualification_queue
              SET state='cancelled',last_error='admin_software_edit',completed_at=now(),updated_at=now()
            WHERE catalogue_id=$1 AND state NOT IN ('running','cleanup_pending','cleanup_running')`,
          [catalogueId],
        )
      }
      await audit(c, auth.session, 'software.updated', 'software_catalogue', catalogueId, {
        fields: Object.keys(body || {}),
        qualificationReset: touchesValidation,
      }, db)
    })
    return c.json({ ok: true, qualificationReset: touchesValidation })
  })

  app.post('/api/platform/v1/software/catalogue/:catalogueId/requeue', async (c) => {
    const auth = await requireAdmin(c, CATALOGUE_ROLES)
    if (auth.error) return auth.error
    const catalogueId = clean(c.req.param('catalogueId'), 80)
    let body = {}
    try { body = await c.req.json() } catch {}
    const result = await retrySoftwareQualification(catalogueId, { mode: 'clean_only' })
    if (!result.queued) return c.json({ error: result.reason || 'Software could not be requeued.', result }, 409)
    if (body.runNow !== false) {
      await prioritiseSoftwareQualificationQueue(result.queue?.id, { priority: body.priority || 50000 })
      result.dispatch = await runSoftwareQualificationQueue({ dispatchLimit: 1 })
    }
    await audit(c, auth.session, 'software.requeued', 'software_catalogue', catalogueId, { result })
    return c.json({ ok: true, result })
  })

  app.post('/api/platform/v1/software/catalogue/:catalogueId/revalidate', async (c) => {
    const auth = await requireAdmin(c, CATALOGUE_ROLES)
    if (auth.error) return auth.error
    const catalogueId = clean(c.req.param('catalogueId'), 80)
    const current = await pool.query(
      `SELECT source_metadata->>'latestSource' AS source_key,canonical_name
         FROM rmm_software_catalogue WHERE id=$1 AND tenant_id IS NULL LIMIT 1`,
      [catalogueId],
    )
    if (!current.rowCount) return c.json({ error: 'Software catalogue entry not found.' }, 404)
    const sourceKey = clean(current.rows[0].source_key)
    if (!sourceKey) return c.json({ error: 'This software has no vendor source to revalidate.' }, 409)
    const result = await syncSoftwareVendorSource(sourceKey)
    await audit(c, auth.session, 'software.source_revalidated', 'software_catalogue', catalogueId, { sourceKey, result })
    return c.json({ ok: true, result })
  })

  app.post('/api/platform/v1/software/catalogue/:catalogueId/classify', async (c) => {
    const auth = await requireAdmin(c, CATALOGUE_ROLES)
    if (auth.error) return auth.error
    let body = {}
    try { body = await c.req.json() } catch {}
    const catalogueId = clean(c.req.param('catalogueId'), 80)
    const allowed = new Set([
      '', 'user_scope_only', 'vendor_install_failure', 'vendor_install_rollback',
      'response_file_required', 'reboot_prerequisite', 'vendor_silent_uninstall_unsupported',
      'interactive_setup_required', 'source_unavailable', 'architecture_unsupported', 'other',
    ])
    const classification = clean(body.classification, 160)
    if (!allowed.has(classification)) return c.json({ error: 'Unsupported limitation classification.' }, 400)
    const notes = clean(body.notes, 4000)
    const result = await pool.query(
      `UPDATE rmm_software_catalogue
          SET source_metadata=(source_metadata - 'deploymentLimitation') || CASE
                WHEN $2='' THEN '{}'::jsonb
                ELSE jsonb_build_object('deploymentLimitation',$2::text,'deploymentLimitationUpdatedAt',now())
              END,
              qualification_notes=CASE WHEN $3<>'' THEN $3 ELSE qualification_notes END,
              updated_by_user_id=$4,updated_at=now()
        WHERE id=$1 AND tenant_id IS NULL
        RETURNING id,canonical_name,qualification_state,qualification_notes,
                  source_metadata->>'deploymentLimitation' AS deployment_limitation`,
      [catalogueId, classification, notes, auth.session.user_id],
    )
    if (!result.rowCount) return c.json({ error: 'Software catalogue entry not found.' }, 404)
    await audit(c, auth.session, 'software.classified', 'software_catalogue', catalogueId, {
      classification, notes,
    })
    return c.json({ ok: true, software: result.rows[0] })
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
