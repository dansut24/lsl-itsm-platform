import { createHash, randomBytes } from 'node:crypto'
import pg from 'pg'

const { Client } = pg
const API = 'http://127.0.0.1:3001'
const suffix = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
const slug = `ci-life-${suffix}`.slice(0, 42)
const origin = `https://${slug}.hi5central.com`
const token = randomBytes(32).toString('base64url')
const cookie = `hi5central_session=${token}`
const db = new Client({ connectionString: process.env.DATABASE_URL })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function json(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { Origin: origin, Cookie: cookie, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  return { response, payload }
}

await db.connect()
console.log(`Lifecycle tenant: ${slug}`)
const tenant = await db.query(`INSERT INTO tenants (slug, company_name, status) VALUES ($1, 'CI Lifecycle', 'active') RETURNING id`, [slug])
const tenantId = tenant.rows[0].id
const owner = await db.query(`INSERT INTO users (email, name, password_hash, email_verified_at) VALUES ($1, 'CI Lifecycle Owner', 'test-only', now()) RETURNING id`, [`life-${suffix}@hi5central.test`])
const ownerId = owner.rows[0].id
await db.query(`INSERT INTO tenant_memberships (tenant_id, user_id, role, status) VALUES ($1,$2,'owner','active')`, [tenantId, ownerId])
const configuration = {
  security: { requireMfa: false },
  itsm: {
    priorityMatrix: { 'High:High': 'Critical', 'High:Medium': 'High' },
    slaTargets: {
      Critical: { responseMinutes: 10, resolutionMinutes: 120 },
      High: { responseMinutes: 20, resolutionMinutes: 240 },
      Medium: { responseMinutes: 120, resolutionMinutes: 720 },
      Low: { responseMinutes: 240, resolutionMinutes: 1440 },
    },
  },
}
await db.query(
  `INSERT INTO tenant_settings (tenant_id, modules, onboarding_step, onboarding_completed_at, tenant_url, portal_url, onboarding_data, configuration)
   VALUES ($1, '{"itsm":true,"rmm":false}'::jsonb, 'complete', now(), $2, $3, $4::jsonb, $4::jsonb)`,
  [tenantId, origin, `https://${slug}-portal.hi5central.com`, JSON.stringify(configuration)],
)
await db.query(`INSERT INTO auth_sessions (tenant_id, user_id, token_hash, expires_at) VALUES ($1,$2,$3,now() + interval '1 hour')`, [tenantId, ownerId, createHash('sha256').update(token).digest('hex')])
const department = await db.query(`INSERT INTO organisation_departments (tenant_id, external_key, name) VALUES ($1,'DEPT-LIFE','IT') RETURNING id`, [tenantId])
const team = await db.query(`INSERT INTO organisation_teams (tenant_id, external_key, department_id, name) VALUES ($1,'TEAM-LIFE',$2,'Lifecycle Desk') RETURNING id`, [tenantId, department.rows[0].id])
await db.query(
  `INSERT INTO organisation_people (tenant_id, external_key, primary_team_id, department_id, name, email, job_title, access_profile, active)
   VALUES ($1,'USR-LIFE',$2,$3,'Lifecycle Requester',$4,'Employee','employee',true)`,
  [tenantId, team.rows[0].id, department.rows[0].id, `requester-${suffix}@hi5central.test`],
)

console.log('1. Create shared lifecycle records')
const incident = await json('/api/v1/itsm-records', { method: 'POST', body: { type: 'Incident', requesterId: 'USR-LIFE', requester: 'Lifecycle Requester', title: 'Lifecycle incident', description: 'Lifecycle E2E', service: 'Identity', category: 'Access', priority: 'Medium', status: 'New', team: 'Lifecycle Desk', impact: 'High', urgency: 'Medium' } })
const problem = await json('/api/v1/itsm-records', { method: 'POST', body: { type: 'Problem', title: 'Lifecycle problem', description: 'Root cause E2E', service: 'Identity', category: 'Access', priority: 'Medium', team: 'Lifecycle Desk' } })
const change = await json('/api/v1/itsm-records', { method: 'POST', body: { type: 'Change', title: 'Lifecycle change', description: 'Change E2E', service: 'Identity', category: 'Access', priority: 'Medium', status: 'Draft', team: 'Lifecycle Desk' } })
assert(incident.response.status === 201 && problem.response.status === 201 && change.response.status === 201, 'Could not create lifecycle seed records')

console.log('2. Initialise Incident SLA and matrix priority')
const detail = await json(`/api/v1/itsm-lifecycle/${encodeURIComponent(incident.payload.id)}`)
assert(detail.response.ok, `Lifecycle detail failed: ${detail.payload.error || detail.response.status}`)
assert(detail.payload.impact === 'High' && detail.payload.urgency === 'Medium', 'Incident classification did not persist')
assert(detail.payload.priority === 'High', `Expected High priority, got ${detail.payload.priority}`)
assert(detail.payload.sla?.response?.dueAt && detail.payload.sla?.resolution?.dueAt, 'Incident SLA was not initialised')

console.log('3. Reject stale technician edits')
const firstVersion = detail.payload.version
const patched = await json(`/api/v1/itsm-lifecycle/${encodeURIComponent(incident.payload.id)}`, { method: 'PATCH', body: { version: firstVersion, status: 'In Progress', impact: 'High', urgency: 'High' } })
assert(patched.response.ok && patched.payload.priority === 'Critical', 'Impact/urgency did not recalculate Critical priority')
const stale = await json(`/api/v1/itsm-lifecycle/${encodeURIComponent(incident.payload.id)}`, { method: 'PATCH', body: { version: firstVersion, status: 'Assigned' } })
assert(stale.response.status === 409 && stale.payload.conflict === true, 'Stale edit was not rejected')

console.log('4. Record first response and field audit')
const customer = await json(`/api/v1/itsm-lifecycle/${encodeURIComponent(incident.payload.id)}/activity`, { method: 'POST', body: { visibility: 'customer', text: 'We are investigating your Incident.' } })
assert(customer.response.status === 201 && customer.payload.firstResponseAt, 'Customer update did not complete first response SLA')
assert(customer.payload.activities.some((item) => item.kind === 'field_change'), 'Field-change audit event missing')

console.log('5. Persist cross-record relationship')
const linked = await json(`/api/v1/itsm-lifecycle/${encodeURIComponent(incident.payload.id)}/relationships`, { method: 'POST', body: { targetReference: problem.payload.id, relationshipType: 'caused-by' } })
assert(linked.response.status === 201 && linked.payload.relationships.some((item) => item.targetReference === problem.payload.id), 'Relationship was not persisted')

console.log('6. Persist attachment and verify SHA-256/download')
const attachmentText = `Lifecycle attachment ${suffix}`
const upload = await json(`/api/v1/itsm-lifecycle/${encodeURIComponent(incident.payload.id)}/attachments`, { method: 'POST', body: { fileName: 'lifecycle.txt', mimeType: 'text/plain', contentBase64: Buffer.from(attachmentText).toString('base64') } })
assert(upload.response.status === 201, `Attachment upload failed: ${upload.payload.error || upload.response.status}`)
const attachment = upload.payload.attachments.find((item) => item.fileName === 'lifecycle.txt')
assert(attachment?.sha256 === createHash('sha256').update(attachmentText).digest('hex'), 'Attachment fingerprint mismatch')
const download = await fetch(`${API}/api/v1/itsm-lifecycle/${encodeURIComponent(incident.payload.id)}/attachments/${encodeURIComponent(attachment.id)}`, { headers: { Origin: origin, Cookie: cookie } })
assert(download.ok && await download.text() === attachmentText, 'Attachment download mismatch')

console.log('7. Enforce and persist Incident resolution')
const invalid = await json(`/api/v1/itsm-lifecycle/${encodeURIComponent(incident.payload.id)}`, { method: 'PATCH', body: { version: upload.payload.version, status: 'Resolved', resolutionCode: '', resolutionSummary: '' } })
assert(invalid.response.status === 400, 'Incident resolved without mandatory resolution data')
const resolved = await json(`/api/v1/itsm-lifecycle/${encodeURIComponent(incident.payload.id)}`, { method: 'PATCH', body: { version: upload.payload.version, status: 'Resolved', resolutionCode: 'Fixed', resolutionSummary: 'Corrected the lifecycle test condition.' } })
assert(resolved.response.ok && resolved.payload.status === 'Resolved' && resolved.payload.resolvedAt, 'Incident resolution did not persist')

console.log('8. Reuse lifecycle contract for Problem and Change')
const problemDetail = await json(`/api/v1/itsm-lifecycle/${encodeURIComponent(problem.payload.id)}`)
const problemPatched = await json(`/api/v1/itsm-lifecycle/${encodeURIComponent(problem.payload.id)}`, { method: 'PATCH', body: { version: problemDetail.payload.version, status: 'Known Error', priority: 'High', recordData: { rootCause: 'Expired identity cache', workaround: 'Refresh identity token', knownError: true } } })
assert(problemPatched.response.ok && problemPatched.payload.recordData.knownError === true, 'Problem lifecycle fields did not persist')
const changeDetail = await json(`/api/v1/itsm-lifecycle/${encodeURIComponent(change.payload.id)}`)
const changePatched = await json(`/api/v1/itsm-lifecycle/${encodeURIComponent(change.payload.id)}`, { method: 'PATCH', body: { version: changeDetail.payload.version, status: 'Assessment', priority: 'High', recordData: { changeType: 'Normal', risk: 'High', implementationPlan: 'Apply policy', testPlan: 'Validate sign-in', backoutPlan: 'Restore snapshot' } } })
assert(changePatched.response.ok && changePatched.payload.recordData.backoutPlan === 'Restore snapshot', 'Change lifecycle plans did not persist')

console.log('9. Verify lifecycle rows in PostgreSQL')
const counts = await db.query(
  `SELECT
     (SELECT count(*)::int FROM itsm_record_relationships WHERE tenant_id = $1) AS relationships,
     (SELECT count(*)::int FROM itsm_record_attachments WHERE tenant_id = $1) AS attachments,
     (SELECT count(*)::int FROM itsm_record_activities WHERE tenant_id = $1 AND kind = 'field_change') AS field_changes`,
  [tenantId],
)
assert(counts.rows[0].relationships === 1, 'Expected one lifecycle relationship')
assert(counts.rows[0].attachments === 1, 'Expected one lifecycle attachment')
assert(counts.rows[0].field_changes >= 3, 'Expected lifecycle field-change audit rows')

await db.end()
console.log('Production ITSM lifecycle E2E passed')
