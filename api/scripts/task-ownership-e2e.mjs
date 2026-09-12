import { randomBytes } from 'node:crypto'
import pg from 'pg'
import { hashPassword } from '../src/password.js'

const { Client } = pg
const API = process.env.API_URL || 'http://127.0.0.1:3001'
const db = new Client({ connectionString: process.env.DATABASE_URL })
const suffix = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
const slug = `ci-task-owner-${suffix}`.slice(0, 42)
const password = `TaskOwner-${randomBytes(12).toString('base64url')}Aa1`
const tenantOrigin = `https://${slug}.hi5central.com`
const tech1Email = `tech-one-${suffix}@hi5central.test`
const tech2Email = `tech-two-${suffix}@hi5central.test`
const outsiderEmail = `outsider-${suffix}@hi5central.test`

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function cookieFrom(response, name) {
  const raw = response.headers.get('set-cookie') || ''
  const match = raw.match(new RegExp(`${name}=([^;]+)`))
  return match ? `${name}=${match[1]}` : ''
}

async function json(path, { method = 'GET', body, cookie = '' } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Origin: tenantOrigin,
      Referer: `${tenantOrigin}/`,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  return { response, payload }
}

async function createAnalyst(tenantId, email, name, externalKey, teamId = null) {
  const passwordHash = await hashPassword(password)
  const user = await db.query(
    `INSERT INTO users (email,name,password_hash,email_verified_at)
     VALUES ($1,$2,$3,now()) RETURNING id`,
    [email, name, passwordHash],
  )
  await db.query(
    `INSERT INTO tenant_memberships (tenant_id,user_id,role,status)
     VALUES ($1,$2,'analyst','active')`,
    [tenantId, user.rows[0].id],
  )
  const person = await db.query(
    `INSERT INTO organisation_people (
       tenant_id,external_key,user_id,primary_team_id,name,email,job_title,access_profile,active
     ) VALUES ($1,$2,$3,$4,$5,$6,'Service Desk Analyst','analyst',true)
     RETURNING id`,
    [tenantId, externalKey, user.rows[0].id, teamId, name, email],
  )
  if (teamId) {
    await db.query(
      `INSERT INTO organisation_team_memberships (tenant_id,person_id,team_id,role,is_primary)
       VALUES ($1,$2,$3,'member',true)`,
      [tenantId, person.rows[0].id, teamId],
    )
  }
  return { userId: user.rows[0].id, personId: person.rows[0].id, email, name }
}

async function login(email) {
  const result = await json('/api/v1/auth/login', {
    method: 'POST',
    body: { tenantSlug: slug, email, password },
  })
  assert(result.response.ok, `Login failed for ${email}: ${result.payload.error || result.response.status}`)
  const cookie = cookieFrom(result.response, 'hi5central_session')
  assert(cookie, `Workspace cookie missing for ${email}`)
  return cookie
}

await db.connect()
let tenantId = null
const userIds = []

try {
  console.log(`Task ownership tenant: ${slug}`)
  const tenant = await db.query(
    `INSERT INTO tenants (slug,company_name,status)
     VALUES ($1,'Task Ownership E2E','active') RETURNING id`,
    [slug],
  )
  tenantId = tenant.rows[0].id
  await db.query(
    `INSERT INTO tenant_settings (
       tenant_id,modules,onboarding_step,onboarding_completed_at,onboarding_data,configuration,tenant_url,portal_url,rmm_url
     ) VALUES ($1,'{"itsm":true,"rmm":false}'::jsonb,'complete',now(),'{}'::jsonb,'{}'::jsonb,$2,NULL,NULL)`,
    [tenantId, tenantOrigin],
  )

  const team = await db.query(
    `INSERT INTO organisation_teams (tenant_id,external_key,name,description,active)
     VALUES ($1,'TEAM-SERVICE-DESK','Service Desk','Task ownership E2E team',true) RETURNING id`,
    [tenantId],
  )

  const tech1 = await createAnalyst(tenantId, tech1Email, 'CI Technician One', 'PERSON-TECH-ONE', team.rows[0].id)
  const tech2 = await createAnalyst(tenantId, tech2Email, 'CI Technician Two', 'PERSON-TECH-TWO', team.rows[0].id)
  const outsider = await createAnalyst(tenantId, outsiderEmail, 'CI Outsider', 'PERSON-OUTSIDER', null)
  userIds.push(tech1.userId, tech2.userId, outsider.userId)

  const request = await db.query(
    `INSERT INTO service_requests (
       tenant_id,reference,requester_user_id,requester_person_id,requester_snapshot,
       title,status,priority,service,fulfilment_team_id,fulfilment_team_snapshot,
       assigned_person_id,created_by_user_id
     ) VALUES (
       $1,'REQ-OWNERSHIP-0001',$2,$3,$4::jsonb,
       'Task ownership race test','Approved','Medium','Access Management',NULL,'{}'::jsonb,NULL,$2
     ) RETURNING id`,
    [tenantId, tech1.userId, tech1.personId, JSON.stringify({ name: tech1.name, email: tech1.email })],
  )

  await db.query(
    `INSERT INTO service_request_tasks (
       tenant_id,request_id,external_key,title,status,team_id,team_snapshot,
       assignee_person_id,assignee_snapshot,dependencies,instructions
     ) VALUES (
       $1,$2,'REQ-OWNERSHIP-0001-T01','Review access requirement','Ready',$3,$4::jsonb,
       NULL,'{}'::jsonb,'[]'::jsonb,'Review and validate the access requirement.'
     )`,
    [tenantId, request.rows[0].id, team.rows[0].id, JSON.stringify({ id: 'TEAM-SERVICE-DESK', name: 'Service Desk' })],
  )

  const [tech1Cookie, tech2Cookie, outsiderCookie] = await Promise.all([
    login(tech1Email),
    login(tech2Email),
    login(outsiderEmail),
  ])

  console.log('1. Reject an analyst who is not in the task assignment group')
  const outsiderTake = await json('/api/v1/tasks/REQ-OWNERSHIP-0001-T01/take', {
    method: 'POST', cookie: outsiderCookie,
  })
  assert(outsiderTake.response.status === 403, `Non-team analyst take should be 403, got ${outsiderTake.response.status}`)

  console.log('2. Race two Service Desk technicians for the same Ready task')
  const [take1, take2] = await Promise.all([
    json('/api/v1/tasks/REQ-OWNERSHIP-0001-T01/take', { method: 'POST', cookie: tech1Cookie }),
    json('/api/v1/tasks/REQ-OWNERSHIP-0001-T01/take', { method: 'POST', cookie: tech2Cookie }),
  ])
  const takes = [
    { technician: tech1, cookie: tech1Cookie, result: take1 },
    { technician: tech2, cookie: tech2Cookie, result: take2 },
  ]
  const winners = takes.filter((entry) => entry.result.response.ok)
  const losers = takes.filter((entry) => !entry.result.response.ok)
  assert(winners.length === 1, `Exactly one technician must win the task race; got ${winners.length}`)
  assert(losers.length === 1, `Exactly one technician must lose the task race; got ${losers.length}`)
  assert(losers[0].result.response.status === 409, `Race loser should receive 409, got ${losers[0].result.response.status}`)

  const winner = winners[0]
  const loser = losers[0]
  const claimed = await db.query(
    `SELECT t.status,t.team_id,t.assignee_person_id,p.email AS assignee_email
     FROM service_request_tasks t
     LEFT JOIN organisation_people p ON p.id=t.assignee_person_id
     WHERE t.request_id=$1 AND t.external_key='REQ-OWNERSHIP-0001-T01'`,
    [request.rows[0].id],
  )
  assert(claimed.rows[0]?.status === 'Ready', 'Taking a task changed its Ready state')
  assert(claimed.rows[0]?.team_id === team.rows[0].id, 'Taking a task changed its assignment group')
  assert(claimed.rows[0]?.assignee_email === winner.technician.email, 'Database owner does not match race winner')

  const parentAfterTake = await db.query(
    `SELECT fulfilment_team_id,assigned_person_id FROM service_requests WHERE id=$1`,
    [request.rows[0].id],
  )
  assert(parentAfterTake.rows[0]?.fulfilment_team_id === null, 'Taking a task assigned the parent Service Request team')
  assert(parentAfterTake.rows[0]?.assigned_person_id === null, 'Taking a task assigned the parent Service Request person')

  const takenEvents = await db.query(
    `SELECT count(*)::int AS count
     FROM service_request_activities
     WHERE request_id=$1 AND metadata->>'event'='request.task.taken'`,
    [request.rows[0].id],
  )
  assert(takenEvents.rows[0].count === 1, 'Task race created an incorrect number of taken activities')

  console.log('3. Only the current owner can release the Ready task')
  const wrongRelease = await json('/api/v1/tasks/REQ-OWNERSHIP-0001-T01/release', {
    method: 'POST', cookie: loser.cookie,
  })
  assert(wrongRelease.response.status === 403, `Non-owner release should be 403, got ${wrongRelease.response.status}`)

  const release = await json('/api/v1/tasks/REQ-OWNERSHIP-0001-T01/release', {
    method: 'POST', cookie: winner.cookie,
  })
  assert(release.response.ok, `Owner could not release task: ${release.payload.error || release.response.status}`)

  const released = await db.query(
    `SELECT status,team_id,assignee_person_id,assignee_snapshot
     FROM service_request_tasks
     WHERE request_id=$1 AND external_key='REQ-OWNERSHIP-0001-T01'`,
    [request.rows[0].id],
  )
  assert(released.rows[0]?.status === 'Ready', 'Released task did not remain Ready')
  assert(released.rows[0]?.team_id === team.rows[0].id, 'Released task lost its assignment group')
  assert(released.rows[0]?.assignee_person_id === null, 'Released task still has an assignee')
  assert(Object.keys(released.rows[0]?.assignee_snapshot || {}).length === 0, 'Released task retained an assignee snapshot')

  console.log('4. The other Service Desk technician can take the released task')
  const secondTake = await json('/api/v1/tasks/REQ-OWNERSHIP-0001-T01/take', {
    method: 'POST', cookie: loser.cookie,
  })
  assert(secondTake.response.ok, `Released task could not be retaken: ${secondTake.payload.error || secondTake.response.status}`)

  console.log('5. Starting fulfilment is server-gated to the current task owner')
  const formerOwnerStart = await json('/api/v1/tasks/REQ-OWNERSHIP-0001-T01', {
    method: 'PATCH', cookie: winner.cookie, body: { status: 'In Progress' },
  })
  assert(formerOwnerStart.response.status === 409, `Former owner start should be 409, got ${formerOwnerStart.response.status}`)

  const currentOwnerStart = await json('/api/v1/tasks/REQ-OWNERSHIP-0001-T01', {
    method: 'PATCH', cookie: loser.cookie, body: { status: 'In Progress' },
  })
  assert(currentOwnerStart.response.ok, `Current owner could not start task: ${currentOwnerStart.payload.error || currentOwnerStart.response.status}`)
  assert(currentOwnerStart.payload.status === 'In Progress', 'Task did not enter In Progress')

  const parentAfterStart = await db.query(
    `SELECT fulfilment_team_id,assigned_person_id FROM service_requests WHERE id=$1`,
    [request.rows[0].id],
  )
  assert(parentAfterStart.rows[0]?.fulfilment_team_id === null, 'Starting a task assigned the parent Service Request team')
  assert(parentAfterStart.rows[0]?.assigned_person_id === null, 'Starting a task assigned the parent Service Request person')

  const releasedEvents = await db.query(
    `SELECT count(*)::int AS count
     FROM service_request_activities
     WHERE request_id=$1 AND metadata->>'event'='request.task.released'`,
    [request.rows[0].id],
  )
  assert(releasedEvents.rows[0].count === 1, 'Task release activity was not recorded exactly once')

  console.log('Task ownership E2E passed')
} finally {
  if (tenantId) await db.query('DELETE FROM tenants WHERE id=$1', [tenantId]).catch(() => {})
  for (const userId of userIds) await db.query('DELETE FROM users WHERE id=$1', [userId]).catch(() => {})
  await db.end()
}
