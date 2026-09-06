import { pool } from './db.js'
import { resolveSession } from './session.js'

function originMatchesSession(c, session) {
  const origin = c.req.header('origin')
  if (!origin) return true
  return new Set([
    `https://${session.slug}.hi5central.com`,
    `https://${session.slug}-portal.hi5central.com`,
    `https://${session.slug}-rmm.hi5central.com`,
  ]).has(origin.toLowerCase())
}

async function requireSession(c) {
  const session = await resolveSession(c)
  if (!session) return { error: c.json({ error: 'Authentication required.' }, 401) }
  if (!originMatchesSession(c, session)) return { error: c.json({ error: 'Tenant session mismatch.' }, 403) }
  return { session }
}

function text(value, max = 255) {
  return String(value ?? '').trim().slice(0, max)
}

function stateFromRow(row) {
  return {
    reference: row.reference,
    status: row.status,
    priority: row.priority,
    assignee: row.assignee_name || 'Unassigned',
    assigneeId: row.assignee_external_key || '',
    assigneeEmail: row.assignee_email || '',
    operationalData: row.operational_data || {},
    updatedAt: row.updated_at,
  }
}

export function registerServiceRequestStateRoutes(app) {
  app.get('/api/v1/service-request-state', async (c) => {
    const auth = await requireSession(c)
    if (auth.error) return auth.error

    const values = [auth.session.tenant_id]
    const requesterClause = auth.session.tenant_role === 'requester' ? 'AND r.requester_user_id = $2' : ''
    if (auth.session.tenant_role === 'requester') values.push(auth.session.user_id)

    const result = await pool.query(
      `SELECT
         r.reference,
         r.status,
         r.priority,
         r.operational_data,
         r.updated_at,
         p.external_key AS assignee_external_key,
         p.name AS assignee_name,
         p.email AS assignee_email
       FROM service_requests r
       LEFT JOIN organisation_people p ON p.id = r.assigned_person_id
       WHERE r.tenant_id = $1 ${requesterClause}
       ORDER BY r.updated_at DESC`,
      values,
    )

    return c.json({ items: result.rows.map(stateFromRow) })
  })

  app.get('/api/v1/service-request-state/:reference', async (c) => {
    const auth = await requireSession(c)
    if (auth.error) return auth.error

    const values = [auth.session.tenant_id, text(c.req.param('reference'), 40).toUpperCase()]
    const requesterClause = auth.session.tenant_role === 'requester' ? 'AND r.requester_user_id = $3' : ''
    if (auth.session.tenant_role === 'requester') values.push(auth.session.user_id)

    const result = await pool.query(
      `SELECT
         r.reference,
         r.status,
         r.priority,
         r.operational_data,
         r.updated_at,
         p.external_key AS assignee_external_key,
         p.name AS assignee_name,
         p.email AS assignee_email
       FROM service_requests r
       LEFT JOIN organisation_people p ON p.id = r.assigned_person_id
       WHERE r.tenant_id = $1 AND r.reference = $2 ${requesterClause}
       LIMIT 1`,
      values,
    )

    if (!result.rowCount) return c.json({ error: 'Service Request not found.' }, 404)
    return c.json(stateFromRow(result.rows[0]))
  })
}
