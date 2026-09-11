import { originMatchesTenant } from './deploymentConfig.js'
import { pool } from './db.js'
import { sendPlatformNotificationEmail } from './notificationMailer.js'
import { resolveSession } from './session.js'

const DEFAULT_PREFERENCES = Object.freeze({
  channels: { inApp: true, email: true, browser: false },
  categories: {
    incidents: true,
    serviceRequests: true,
    problems: true,
    changes: true,
    assignments: true,
    approvals: true,
    tasks: true,
    customerUpdates: true,
  },
})

let workerStarted = false
let workerBusy = false

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function boolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback
}

function normalisePreferences(input = {}, fallback = DEFAULT_PREFERENCES) {
  const data = object(input)
  const channels = object(data.channels)
  const categories = object(data.categories)
  return {
    channels: {
      inApp: boolean(channels.inApp, fallback.channels.inApp),
      email: boolean(channels.email, fallback.channels.email),
      browser: boolean(channels.browser, fallback.channels.browser),
    },
    categories: {
      incidents: boolean(categories.incidents, fallback.categories.incidents),
      serviceRequests: boolean(categories.serviceRequests, fallback.categories.serviceRequests),
      problems: boolean(categories.problems, fallback.categories.problems),
      changes: boolean(categories.changes, fallback.categories.changes),
      assignments: boolean(categories.assignments, fallback.categories.assignments),
      approvals: boolean(categories.approvals, fallback.categories.approvals),
      tasks: boolean(categories.tasks, fallback.categories.tasks),
      customerUpdates: boolean(categories.customerUpdates, fallback.categories.customerUpdates),
    },
  }
}

function mergePreferences(tenant, user) {
  const tenantPrefs = normalisePreferences(tenant || {})
  return normalisePreferences(user || {}, tenantPrefs)
}

function categoryForEvent(eventType = '') {
  const value = String(eventType).toLowerCase()
  if (value.includes('approval')) return 'approvals'
  if (value.includes('.task_') || value.includes('.task.')) return 'tasks'
  if (value.includes('customer_update')) return 'customerUpdates'
  if (value.includes('assigned') || value.includes('reassign')) return 'assignments'
  if (value.startsWith('service_request.')) return 'serviceRequests'
  if (value.startsWith('problem.')) return 'problems'
  if (value.startsWith('change.')) return 'changes'
  return 'incidents'
}

function eventEnabled(preferences, eventType) {
  const category = categoryForEvent(eventType)
  return preferences.categories[category] !== false
}

function originMatchesSession(c, session) {
  return originMatchesTenant(c.req.header('origin'), session.slug)
}

async function requireSession(c) {
  const session = await resolveSession(c)
  if (!session) return { error: c.json({ error: 'Authentication required.' }, 401) }
  if (!originMatchesSession(c, session)) return { error: c.json({ error: 'Tenant session mismatch.' }, 403) }
  return { session }
}

async function requireAdmin(c) {
  const auth = await requireSession(c)
  if (auth.error) return auth
  if (!['owner', 'admin'].includes(auth.session.tenant_role)) {
    return { error: c.json({ error: 'Tenant administrator access is required.' }, 403) }
  }
  return auth
}

async function tenantPreferences(tenantId, db = pool) {
  const result = await db.query(
    'SELECT settings FROM tenant_notification_settings WHERE tenant_id = $1 LIMIT 1',
    [tenantId],
  )
  return normalisePreferences(result.rows[0]?.settings || {})
}

async function userPreferences(tenantId, userId, db = pool) {
  const [tenant, user] = await Promise.all([
    tenantPreferences(tenantId, db),
    db.query(
      'SELECT preferences FROM user_notification_preferences WHERE tenant_id = $1 AND user_id = $2 LIMIT 1',
      [tenantId, userId],
    ),
  ])
  return mergePreferences(tenant, user.rows[0]?.preferences || {})
}

function targetUrl(row) {
  const root = row.tenant_role === 'requester'
    ? (row.portal_url || row.tenant_url || '')
    : (row.tenant_url || '')
  if (!root) return ''
  if (row.tenant_role === 'requester') return root
  const reference = encodeURIComponent(row.target_reference || '')
  if (!reference) return `${root}/dashboard`
  const type = String(row.target_type || '').toLowerCase()
  const section = type === 'service request' ? 'requests'
    : type === 'problem' ? 'problems'
      : type === 'change' ? 'changes'
        : 'incidents'
  return `${root}/${section}/${reference}`
}

async function processEmailDeliveries() {
  if (workerBusy) return
  workerBusy = true
  try {
    const result = await pool.query(
      `SELECT
         d.id AS delivery_id,
         d.notification_id,
         d.attempts,
         n.tenant_id,
         n.user_id,
         n.event_type,
         n.title,
         n.body,
         n.target_type,
         n.target_reference,
         u.email,
         m.role AS tenant_role,
         t.company_name,
         ts.tenant_url,
         ts.portal_url
       FROM notification_deliveries d
       JOIN platform_notifications n ON n.id = d.notification_id
       JOIN users u ON u.id = n.user_id
       JOIN tenant_memberships m ON m.tenant_id = n.tenant_id AND m.user_id = n.user_id
       JOIN tenants t ON t.id = n.tenant_id
       JOIN tenant_settings ts ON ts.tenant_id = n.tenant_id
       WHERE d.channel = 'email'
         AND d.status IN ('pending', 'failed')
         AND d.next_attempt_at <= now()
         AND d.attempts < 5
       ORDER BY d.created_at
       LIMIT 12`,
    )

    for (const row of result.rows) {
      const preferences = await userPreferences(row.tenant_id, row.user_id)
      if (!preferences.channels.email || !eventEnabled(preferences, row.event_type)) {
        await pool.query(
          `UPDATE notification_deliveries
           SET status = 'suppressed', updated_at = now()
           WHERE id = $1`,
          [row.delivery_id],
        )
        continue
      }

      await pool.query(
        `UPDATE notification_deliveries
         SET status = 'sending', attempts = attempts + 1, updated_at = now()
         WHERE id = $1`,
        [row.delivery_id],
      )

      try {
        await sendPlatformNotificationEmail({
          to: row.email,
          companyName: row.company_name,
          title: row.title,
          body: row.body,
          actionUrl: targetUrl(row),
          eventType: row.event_type,
        })
        await pool.query(
          `UPDATE notification_deliveries
           SET status = 'sent', sent_at = now(), last_error = '', updated_at = now()
           WHERE id = $1`,
          [row.delivery_id],
        )
      } catch (error) {
        const attempts = Number(row.attempts || 0) + 1
        await pool.query(
          `UPDATE notification_deliveries
           SET status = CASE WHEN $2 >= 5 THEN 'suppressed' ELSE 'failed' END,
               last_error = $3,
               next_attempt_at = now() + make_interval(mins => LEAST(60, GREATEST(2, $2 * 5))),
               updated_at = now()
           WHERE id = $1`,
          [row.delivery_id, attempts, String(error?.message || error || 'Email delivery failed').slice(0, 1000)],
        )
      }
    }
  } catch (error) {
    console.error('Notification delivery worker failed', error)
  } finally {
    workerBusy = false
  }
}

function startDeliveryWorker() {
  if (workerStarted) return
  workerStarted = true
  const timer = setInterval(() => void processEmailDeliveries(), 30000)
  timer.unref?.()
  setTimeout(() => void processEmailDeliveries(), 2500).unref?.()
}

export function registerNotificationRoutes(app) {
  app.get('/api/v1/notifications', async (c) => {
    const auth = await requireSession(c)
    if (auth.error) return auth.error
    const requestedLimit = Number(c.req.query('limit') || 100)
    const limit = Math.max(20, Math.min(250, Number.isFinite(requestedLimit) ? requestedLimit : 100))
    const preferences = await userPreferences(auth.session.tenant_id, auth.session.user_id)
    const result = await pool.query(
      `SELECT id, event_type, title, body, target_type, target_reference, metadata, read_at, created_at
       FROM platform_notifications
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [auth.session.tenant_id, auth.session.user_id, limit],
    )
    const items = preferences.channels.inApp
      ? result.rows.filter((row) => eventEnabled(preferences, row.event_type)).map((row) => ({
          id: row.id,
          eventType: row.event_type,
          category: categoryForEvent(row.event_type),
          title: row.title,
          body: row.body,
          target: { type: row.target_type, reference: row.target_reference },
          metadata: row.metadata || {},
          read: Boolean(row.read_at),
          readAt: row.read_at,
          createdAt: row.created_at,
        }))
      : []
    return c.json({
      items,
      unreadCount: items.filter((item) => !item.read).length,
      preferences,
    })
  })

  app.post('/api/v1/notifications/:id/read', async (c) => {
    const auth = await requireSession(c)
    if (auth.error) return auth.error
    await pool.query(
      `UPDATE platform_notifications
       SET read_at = COALESCE(read_at, now())
       WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
      [c.req.param('id'), auth.session.tenant_id, auth.session.user_id],
    )
    return c.json({ ok: true })
  })

  app.post('/api/v1/notifications/read-all', async (c) => {
    const auth = await requireSession(c)
    if (auth.error) return auth.error
    await pool.query(
      `UPDATE platform_notifications
       SET read_at = COALESCE(read_at, now())
       WHERE tenant_id = $1 AND user_id = $2 AND read_at IS NULL`,
      [auth.session.tenant_id, auth.session.user_id],
    )
    return c.json({ ok: true })
  })

  app.post('/api/v1/notifications/:id/browser-delivered', async (c) => {
    const auth = await requireSession(c)
    if (auth.error) return auth.error
    await pool.query(
      `UPDATE notification_deliveries d
       SET status = 'sent', sent_at = COALESCE(sent_at, now()), updated_at = now()
       FROM platform_notifications n
       WHERE d.notification_id = n.id
         AND d.notification_id = $1
         AND d.channel = 'browser'
         AND n.tenant_id = $2
         AND n.user_id = $3`,
      [c.req.param('id'), auth.session.tenant_id, auth.session.user_id],
    )
    return c.json({ ok: true })
  })

  app.get('/api/v1/notification-preferences', async (c) => {
    const auth = await requireSession(c)
    if (auth.error) return auth.error
    const [preferences, tenant] = await Promise.all([
      userPreferences(auth.session.tenant_id, auth.session.user_id),
      tenantPreferences(auth.session.tenant_id),
    ])
    return c.json({ preferences, tenantDefaults: tenant })
  })

  app.patch('/api/v1/notification-preferences', async (c) => {
    const auth = await requireSession(c)
    if (auth.error) return auth.error
    let body
    try { body = await c.req.json() } catch { return c.json({ error: 'A valid JSON request body is required.' }, 400) }
    const tenant = await tenantPreferences(auth.session.tenant_id)
    const preferences = normalisePreferences(body?.preferences || {}, tenant)
    await pool.query(
      `INSERT INTO user_notification_preferences (tenant_id, user_id, preferences, updated_at)
       VALUES ($1,$2,$3::jsonb,now())
       ON CONFLICT (tenant_id, user_id)
       DO UPDATE SET preferences = EXCLUDED.preferences, updated_at = now()`,
      [auth.session.tenant_id, auth.session.user_id, JSON.stringify(preferences)],
    )
    return c.json({ preferences })
  })

  app.get('/api/v1/notification-settings', async (c) => {
    const auth = await requireAdmin(c)
    if (auth.error) return auth.error
    return c.json({ settings: await tenantPreferences(auth.session.tenant_id) })
  })

  app.patch('/api/v1/notification-settings', async (c) => {
    const auth = await requireAdmin(c)
    if (auth.error) return auth.error
    let body
    try { body = await c.req.json() } catch { return c.json({ error: 'A valid JSON request body is required.' }, 400) }
    const settings = normalisePreferences(body?.settings || {})
    await pool.query(
      `INSERT INTO tenant_notification_settings (tenant_id, settings, updated_at)
       VALUES ($1,$2::jsonb,now())
       ON CONFLICT (tenant_id)
       DO UPDATE SET settings = EXCLUDED.settings, updated_at = now()`,
      [auth.session.tenant_id, JSON.stringify(settings)],
    )
    return c.json({ settings })
  })

  startDeliveryWorker()
}
