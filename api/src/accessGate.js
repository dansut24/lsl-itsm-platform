import { effectiveAccessForUser, hasPermission } from './access.js'
import { pool } from './db.js'
import { originMatchesTenant } from './deploymentConfig.js'
import { resolveSession } from './session.js'

function typePermission(type, action = 'view') {
  const key = String(type || '').toLowerCase()
  if (key === 'incident') return `itsm.incidents.${action}`
  if (key === 'service request') return `itsm.requests.${action}`
  if (key === 'problem') return `itsm.problems.${action}`
  if (key === 'change') return `itsm.changes.${action}`
  return ''
}

function queueType(c) {
  const type = String(c.req.query('type') || '').trim()
  return type || ''
}

async function recordType(tenantId, reference) {
  const generic = await pool.query(
    `SELECT record_type FROM itsm_records WHERE tenant_id=$1 AND upper(reference)=upper($2) LIMIT 1`,
    [tenantId, reference],
  )
  if (generic.rowCount) return generic.rows[0].record_type
  const request = await pool.query(
    `SELECT 'Service Request'::text AS record_type FROM service_requests WHERE tenant_id=$1 AND upper(reference)=upper($2) LIMIT 1`,
    [tenantId, reference],
  )
  return request.rows[0]?.record_type || ''
}

function anyPermission(access, permissions) {
  return permissions.some((permission) => hasPermission(access, permission))
}

async function requiredPermission(c, session) {
  const path = c.req.path
  const method = c.req.method.toUpperCase()

  if (path.startsWith('/api/v1/access/')) {
    if (method === 'GET') return ['access.roles.view']
    if (path.includes('/users/') && path.endsWith('/roles')) return ['access.roles.assign']
    return ['access.roles.manage']
  }

  if (path === '/api/v1/itsm-queue') {
    const type = queueType(c)
    return type ? [typePermission(type, 'view')] : ['itsm.records.view_all']
  }

  if (path === '/api/v1/itsm-records') {
    const type = queueType(c)
    if (method === 'GET') return type ? [typePermission(type, 'view')] : ['itsm.records.view_all']
    return [typePermission(String(c.req.header('x-hi5-record-type') || ''), 'create'), 'itsm.records.create_all']
  }

  const recordMatch = path.match(/^\/api\/v1\/(?:itsm-records|itsm-lifecycle)\/([^/]+)/i)
  if (recordMatch) {
    const type = await recordType(session.tenant_id, decodeURIComponent(recordMatch[1]))
    if (!type) return []
    if (method === 'GET') return [typePermission(type, 'view'), 'itsm.records.view_all']
    if (path.includes('/attachments') || path.includes('/relationships') || path.includes('/activity')) {
      return [typePermission(type, 'edit')]
    }
    return [typePermission(type, 'edit')]
  }

  const actionMatch = path.match(/^\/api\/v1\/itsm-actions\/([^/]+)\/(.+)$/i)
  if (actionMatch) {
    const type = await recordType(session.tenant_id, decodeURIComponent(actionMatch[1]))
    if (!type) return []
    const action = actionMatch[2]
    if (action.startsWith('reassign')) return [typePermission(type, 'assign')]
    if (action.startsWith('resolve')) return [typePermission(type, type === 'Change' ? 'implement' : 'resolve')]
    if (action.startsWith('pending')) return [typePermission(type, 'edit')]
    if (action.startsWith('tasks')) return [method === 'GET' ? 'itsm.tasks.view' : 'itsm.tasks.manage']
    return [typePermission(type, 'edit')]
  }

  if (path.startsWith('/api/v1/service-requests')) {
    if (method === 'GET') return ['itsm.requests.view', 'itsm.records.view_all']
    if (path.includes('/approve') || path.includes('/decision')) return ['itsm.requests.fulfil']
    return ['itsm.requests.edit']
  }

  if (path.startsWith('/api/v1/knowledge')) {
    if (method === 'GET') return ['knowledge.view_internal']
    if (path.includes('/links')) return ['knowledge.link']
    return ['knowledge.edit', 'knowledge.create']
  }

  if (path.startsWith('/api/v1/live-chat')) {
    if (method === 'GET') return ['live_chat.view']
    if (path.includes('/claim')) return ['live_chat.claim']
    if (path.includes('/transfer')) return ['live_chat.transfer']
    if (path.includes('/close') || path.includes('/reopen')) return ['live_chat.close']
    if (path.includes('/canned')) return ['live_chat.manage_canned']
    if (path.includes('/service-settings') || path.includes('/hours')) return ['live_chat.manage_hours']
    return ['live_chat.reply']
  }

  if (path.startsWith('/api/v1/organisation')) {
    if (method === 'GET') return ['organisation.people.view','organisation.teams.view','organisation.departments.view','organisation.sites.view']
    const collection = path.split('/').filter(Boolean).at(-1)
    if (collection === 'people') return ['organisation.people.edit','organisation.people.create']
    if (collection === 'teams') return ['organisation.teams.manage']
    if (collection === 'departments') return ['organisation.departments.manage']
    if (collection === 'sites') return ['organisation.sites.manage']
    return ['organisation.people.edit','organisation.teams.manage','organisation.departments.manage','organisation.sites.manage']
  }

  if (path.startsWith('/api/v1/catalogue')) return [method === 'GET' ? 'catalogue.view' : 'catalogue.manage']
  if (path.startsWith('/api/v1/notifications')) return [method === 'GET' ? 'notifications.view' : 'notifications.manage']

  const settingsMatch = path.match(/^\/api\/v1\/settings(?:\/([^/]+))?$/i)
  if (settingsMatch) {
    if (method === 'GET') return ['settings.view']
    const area = settingsMatch[1] || ''
    const map = {
      company: 'settings.organisation.manage',
      theme: 'settings.appearance.manage',
      users: 'settings.directory.manage',
      groups: 'settings.directory.manage',
      permissions: 'settings.roles.manage',
      security: 'settings.security.manage',
      itsm: 'settings.itsm.manage',
      rmm: 'rmm.policies.manage',
      integrations: 'settings.integrations.manage',
      billing: 'settings.billing.manage',
    }
    return map[area] ? [map[area]] : ['settings.view']
  }

  return []
}

export async function enforceWorkspacePermissions(c, next) {
  const path = c.req.path
  if (!path.startsWith('/api/v1/')) return next()
  if (path.startsWith('/api/v1/auth/') || path.startsWith('/api/v1/portal/') || path.startsWith('/api/v1/system/')) return next()

  const session = await resolveSession(c)
  if (!session) return next()
  if (!originMatchesTenant(c.req.header('origin'), session.slug)) return next()

  const access = session.access || await effectiveAccessForUser(pool, session.tenant_id, session.user_id, session.legacy_tenant_role || session.tenant_role)
  const required = (await requiredPermission(c, session)).filter(Boolean)
  if (!required.length) return next()
  if (anyPermission(access, required)) return next()

  return c.json({
    error: 'You do not have permission to perform this action.',
    requiredPermissions: required,
  }, 403)
}
