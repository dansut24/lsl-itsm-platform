import { pool } from './db.js'
import { resolveSession } from './session.js'
import { originMatchesPortalTenant } from './deploymentConfig.js'

function text(value, max = 255) {
  return String(value ?? '').trim().slice(0, max)
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function portalOrigin(c, slug) {
  return originMatchesPortalTenant(
    c.req.header('origin'),
    c.req.header('referer'),
    slug,
  )
}

async function requireRequester(c) {
  const session = await resolveSession(c)
  if (!session) return { error: c.json({ error: 'Authentication required.' }, 401) }
  if (!portalOrigin(c, session.slug)) return { error: c.json({ error: 'Portal session mismatch.' }, 403) }
  if (session.tenant_role !== 'requester') return { error: c.json({ error: 'Requester Portal access is required.' }, 403) }
  return { session }
}

function listRow(row) {
  return {
    id: row.reference,
    reference: row.reference,
    title: row.title,
    catalogueItemTitle: row.catalogue_item_title_snapshot,
    requestType: row.request_type,
    service: row.service,
    priority: row.priority,
    status: row.status,
    source: row.source,
    oneOffCost: Number(row.one_off_cost || 0),
    monthlyCost: Number(row.monthly_cost || 0),
    currency: row.currency || 'GBP',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function detailPayload(request) {
  const [items, approvals, tasks, activities] = await Promise.all([
    pool.query(
      `SELECT catalogue_item_key_snapshot, name_snapshot, category_snapshot, quantity,
              unit_one_off_cost, unit_monthly_cost, currency, options_snapshot, product_snapshot
       FROM service_request_items
       WHERE request_id = $1
       ORDER BY created_at, id`,
      [request.id],
    ),
    pool.query(
      `SELECT id, sequence, label, status, updated_at
       FROM service_request_approvals
       WHERE request_id = $1
       ORDER BY sequence, created_at`,
      [request.id],
    ),
    pool.query(
      `SELECT external_key, title, status, due_at, completed_at
       FROM service_request_tasks
       WHERE request_id = $1
       ORDER BY created_at, id`,
      [request.id],
    ),
    pool.query(
      `SELECT id, actor_snapshot, kind, visibility, body_text, body_html, attachments, metadata, created_at
       FROM service_request_activities
       WHERE request_id = $1 AND visibility = 'customer'
       ORDER BY created_at, id`,
      [request.id],
    ),
  ])

  return {
    ...listRow(request),
    description: request.description,
    descriptionHtml: request.description_html,
    requester: asObject(request.requester_snapshot),
    requestInformation: asArray(request.request_information),
    submittedFields: asObject(request.submitted_fields),
    items: items.rows.map((row) => ({
      id: row.catalogue_item_key_snapshot,
      name: row.name_snapshot,
      category: row.category_snapshot,
      quantity: Number(row.quantity || 1),
      unitOneOffCost: Number(row.unit_one_off_cost || 0),
      unitMonthlyCost: Number(row.unit_monthly_cost || 0),
      currency: row.currency || 'GBP',
      options: asArray(row.options_snapshot),
      product: asObject(row.product_snapshot),
    })),
    approvals: approvals.rows.map((row) => ({
      id: row.id,
      sequence: row.sequence,
      label: row.label,
      status: row.status,
      updatedAt: row.updated_at,
    })),
    tasks: tasks.rows.map((row) => ({
      id: row.external_key,
      title: row.title,
      status: row.status,
      dueAt: row.due_at,
      completedAt: row.completed_at,
    })),
    activities: activities.rows.map((row) => ({
      id: row.id,
      actor: asObject(row.actor_snapshot).name || 'Hi5Central',
      kind: row.kind,
      text: row.body_text,
      html: row.body_html,
      attachments: asArray(row.attachments),
      metadata: asObject(row.metadata),
      createdAt: row.created_at,
    })),
  }
}

export function registerPortalRequestViewRoutes(app) {
  app.get('/api/v1/portal/requests', async (c) => {
    const auth = await requireRequester(c)
    if (auth.error) return auth.error

    const limit = Math.max(1, Math.min(100, Number(c.req.query('limit') || 50)))
    const offset = Math.max(0, Number(c.req.query('offset') || 0))
    const result = await pool.query(
      `SELECT *
       FROM service_requests
       WHERE tenant_id = $1 AND requester_user_id = $2
       ORDER BY updated_at DESC
       LIMIT $3 OFFSET $4`,
      [auth.session.tenant_id, auth.session.user_id, limit, offset],
    )
    return c.json({ items: result.rows.map(listRow), limit, offset })
  })

  app.get('/api/v1/portal/requests/:reference', async (c) => {
    const auth = await requireRequester(c)
    if (auth.error) return auth.error

    const reference = text(c.req.param('reference'), 40).toUpperCase()
    const result = await pool.query(
      `SELECT *
       FROM service_requests
       WHERE tenant_id = $1 AND requester_user_id = $2 AND reference = $3
       LIMIT 1`,
      [auth.session.tenant_id, auth.session.user_id, reference],
    )
    if (!result.rowCount) return c.json({ error: 'Service Request not found.' }, 404)
    return c.json(await detailPayload(result.rows[0]))
  })
}
