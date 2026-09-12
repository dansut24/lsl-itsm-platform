import fs from 'node:fs'

const path = 'api/src/session.js'
let text = fs.readFileSync(path, 'utf8')

function replaceOnce(before, after, label) {
  if (!text.includes(before)) throw new Error(`Missing transform anchor: ${label}`)
  text = text.replace(before, after)
}

replaceOnce(
  `async function sessionPolicy(client, tenantId, userId) {\n  const result = await client.query(\n    \`SELECT ts.onboarding_completed_at,ts.onboarding_data,ts.configuration,m.role AS tenant_role\n     FROM tenant_settings ts\n     JOIN tenant_memberships m ON m.tenant_id=ts.tenant_id AND m.user_id=$2\n     WHERE ts.tenant_id=$1 LIMIT 1\`,\n    [tenantId, userId],\n  )\n  return result.rows[0] || null\n}\n`,
  `async function sessionPolicy(client, tenantId, userId) {\n  const result = await client.query(\n    \`SELECT ts.onboarding_completed_at,ts.onboarding_data,ts.configuration,m.role AS tenant_role\n     FROM tenant_settings ts\n     JOIN tenant_memberships m ON m.tenant_id=ts.tenant_id AND m.user_id=$2\n     WHERE ts.tenant_id=$1 LIMIT 1\`,\n    [tenantId, userId],\n  )\n  return result.rows[0] || null\n}\n\nasync function hasPortalApprovalAssignment(client, tenantId, userId) {\n  const result = await client.query(\n    \`SELECT 1\n     FROM service_request_approvals a\n     LEFT JOIN organisation_people p\n       ON p.tenant_id = a.tenant_id\n      AND p.id = a.approver_person_id\n      AND p.active = true\n     WHERE a.tenant_id = $1\n       AND (a.approver_user_id = $2 OR p.user_id = $2)\n     LIMIT 1\`,\n    [tenantId, userId],\n  )\n  return result.rowCount > 0\n}\n`,
  'approval portal assignment helper',
)

replaceOnce(
  `  const access = await effectiveAccessForUser(client, tenantId, userId, policy.tenant_role)\n  const accessAllowed = surface === 'portal' ? access.portalAccess : access.workspaceAccess\n  if (!accessAllowed) {`,
  `  const access = await effectiveAccessForUser(client, tenantId, userId, policy.tenant_role)\n  const approvalPortalAccess = surface === 'portal' && !access.portalAccess\n    ? await hasPortalApprovalAssignment(client, tenantId, userId)\n    : false\n  const accessAllowed = surface === 'portal' ? (access.portalAccess || approvalPortalAccess) : access.workspaceAccess\n  if (!accessAllowed) {`,
  'create portal approval session',
)

replaceOnce(
  `  const surface = portalRequest(c) ? 'portal' : 'workspace'\n  const access = await effectiveAccessForUser(pool, session.tenant_id, session.user_id, session.tenant_role)\n  if (surface === 'portal' && !access.portalAccess) return null\n  if (surface === 'workspace' && !access.workspaceAccess) return null`,
  `  const surface = portalRequest(c) ? 'portal' : 'workspace'\n  const access = await effectiveAccessForUser(pool, session.tenant_id, session.user_id, session.tenant_role)\n  if (surface === 'portal' && !access.portalAccess && !await hasPortalApprovalAssignment(pool, session.tenant_id, session.user_id)) return null\n  if (surface === 'workspace' && !access.workspaceAccess) return null`,
  'restore approval-only portal session',
)

fs.writeFileSync(path, text)
console.log('Approval-only Portal session entitlement applied.')
