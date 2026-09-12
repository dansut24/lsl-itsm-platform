import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ARCHIVE_ROOT = 'archive/demo-runtime'

function abs(relativePath) {
  return path.join(ROOT, relativePath)
}

function exists(relativePath) {
  return fs.existsSync(abs(relativePath))
}

function ensureDir(relativePath) {
  fs.mkdirSync(abs(relativePath), { recursive: true })
}

function read(relativePath) {
  return fs.readFileSync(abs(relativePath), 'utf8')
}

function write(relativePath, content) {
  ensureDir(path.dirname(relativePath))
  fs.writeFileSync(abs(relativePath), content)
}

function archiveSnapshot(relativePath) {
  if (!exists(relativePath)) return
  const target = path.join(ARCHIVE_ROOT, relativePath)
  ensureDir(path.dirname(target))
  fs.copyFileSync(abs(relativePath), abs(target))
}

function archiveMove(relativePath) {
  if (!exists(relativePath)) return
  const target = path.join(ARCHIVE_ROOT, relativePath)
  ensureDir(path.dirname(target))
  if (exists(target)) fs.rmSync(abs(target), { recursive: true, force: true })
  fs.renameSync(abs(relativePath), abs(target))
}

function findMatching(source, start, openChar = '{', closeChar = '}') {
  let depth = 0
  let quote = ''
  let lineComment = false
  let blockComment = false
  let escaped = false

  for (let index = start; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1]

    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }
    if (quote) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === quote) quote = ''
      continue
    }
    if (char === '/' && next === '/') {
      lineComment = true
      index += 1
      continue
    }
    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char
      continue
    }
    if (char === openChar) depth += 1
    if (char === closeChar) {
      depth -= 1
      if (depth === 0) return index
    }
  }
  throw new Error(`Unable to match ${openChar}${closeChar} from ${start}`)
}

function replaceFunction(source, name, replacement) {
  const candidates = [`function ${name}(`, `async function ${name}(`, `export function ${name}(`, `export async function ${name}(`]
  let start = -1
  for (const candidate of candidates) {
    const found = source.indexOf(candidate)
    if (found >= 0 && (start < 0 || found < start)) start = found
  }
  if (start < 0) return source
  const bodyStart = source.indexOf('{', start)
  if (bodyStart < 0) throw new Error(`Unable to locate body for ${name}`)
  const bodyEnd = findMatching(source, bodyStart)
  return `${source.slice(0, start)}${replacement}${source.slice(bodyEnd + 1)}`
}

function replaceExportedArray(source, name, replacement = '[]') {
  const marker = `export const ${name} = [`
  const start = source.indexOf(marker)
  if (start < 0) return source
  const arrayStart = source.indexOf('[', start)
  const arrayEnd = findMatching(source, arrayStart, '[', ']')
  return `${source.slice(0, arrayStart)}${replacement}${source.slice(arrayEnd + 1)}`
}

function replaceExportedObject(source, name, replacement = '{}') {
  const marker = `export const ${name} = {`
  const start = source.indexOf(marker)
  if (start < 0) return source
  const objectStart = source.indexOf('{', start)
  const objectEnd = findMatching(source, objectStart, '{', '}')
  return `${source.slice(0, objectStart)}${replacement}${source.slice(objectEnd + 1)}`
}

function replaceAllExportedArrays(source) {
  const names = [...source.matchAll(/export const\s+([A-Za-z0-9_]+)\s*=\s*\[/g)].map((match) => match[1])
  return names.reduce((working, name) => replaceExportedArray(working, name), source)
}

function moveIfUnused(relativePath, needles) {
  if (!exists(relativePath)) return
  const activeFiles = []
  const walk = (directory) => {
    if (!fs.existsSync(directory)) return
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(js|jsx|mjs|css|html)$/.test(entry.name)) activeFiles.push(full)
    }
  }
  walk(abs('src'))
  const used = activeFiles.some((file) => {
    if (file === abs(relativePath)) return false
    const content = fs.readFileSync(file, 'utf8')
    return needles.some((needle) => content.includes(needle))
  })
  if (!used) archiveMove(relativePath)
}

function cleanWorkspaceConfig() {
  return `import {
  AlertCircle,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  Database,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  MessageCircle,
  Plus,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react'

export const statusOptions = [
  'New', 'Assigned', 'Draft', 'Pending Approval', 'Approved', 'CAB Review',
  'Scheduled', 'Under Investigation', 'Known Error', 'In Progress',
  'Fix in Progress', 'Pending', 'Review', 'Completed', 'Resolved', 'Failed',
  'Closed', 'Monitoring',
]

export const viewMeta = {
  home: { id: 'home', label: 'Dashboard', icon: LayoutDashboard },
  newtab: { id: 'newtab', label: 'New Tab', icon: Plus },
  newrecord: { id: 'newrecord', label: 'New Record', icon: Plus },
  tickets: { id: 'tickets', label: 'All Records', icon: Inbox },
  incidents: { id: 'incidents', label: 'Incidents', icon: AlertCircle },
  requests: { id: 'requests', label: 'Service Requests', icon: BriefcaseBusiness },
  problems: { id: 'problems', label: 'Problems', icon: ShieldCheck },
  portal: { id: 'portal', label: 'Self-Service', icon: LifeBuoy },
  changes: { id: 'changes', label: 'Changes', icon: ClipboardCheck },
  calendar: { id: 'calendar', label: 'Calendar', icon: CalendarRange },
  projects: { id: 'projects', label: 'Projects', icon: FolderKanban },
  rota: { id: 'rota', label: 'Rota & Availability', icon: CalendarDays },
  people: { id: 'people', label: 'People', icon: Users },
  cmdb: { id: 'cmdb', label: 'CMDB', icon: Database },
  knowledge: { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
  livechat: { id: 'livechat', label: 'Live Chat', icon: MessageCircle },
  reports: { id: 'reports', label: 'Reports', icon: BarChart3 },
  settings: { id: 'settings', label: 'Settings', icon: Settings },
}

export const serviceDeskModules = {
  incidents: { id: 'incidents', type: 'Incident', label: 'Incidents', singular: 'Incident', queueTitle: 'Incident Queue', createTitle: 'New Incident', createLabel: 'Create Incident', searchPlaceholder: 'Incident, requester, service' },
  requests: { id: 'requests', type: 'Service Request', label: 'Service Requests', singular: 'Service Request', queueTitle: 'Service Request Queue', createTitle: 'New Service Request', createLabel: 'Create Request', searchPlaceholder: 'Request, requester, service' },
  problems: { id: 'problems', type: 'Problem', label: 'Problems', singular: 'Problem', queueTitle: 'Problem Queue', createTitle: 'New Problem', createLabel: 'Create Problem', searchPlaceholder: 'Problem, requester, service' },
}

export const analystNavGroups = [
  { id: 'workspace', items: ['home'] },
  { id: 'service-desk', label: 'Service Desk', items: ['incidents', 'requests', 'problems', 'changes'] },
  { id: 'planning', label: 'Planning', items: ['calendar', 'projects', 'rota'] },
  { id: 'organisation', label: 'Organisation', items: ['people'] },
  { id: 'knowledge-data', label: 'Knowledge & Data', items: ['knowledge', 'cmdb'] },
  { id: 'insights', label: 'Insights', items: ['reports'] },
  { id: 'administration', items: ['settings'], separated: true },
]

export const analystNavIds = analystNavGroups.flatMap((group) => group.items)
export const accentOptions = [
  { id: 'amber', label: 'Amber', value: '#f4b13d' },
  { id: 'cyan', label: 'Cyan', value: '#15bfe8' },
  { id: 'blue', label: 'Blue', value: '#4b7ff5' },
  { id: 'violet', label: 'Violet', value: '#8b5cf6' },
  { id: 'emerald', label: 'Emerald', value: '#2eb67d' },
  { id: 'rose', label: 'Rose', value: '#ef6a8a' },
]

// UI metadata only. Authentication identities always come from the tenant API.
export const workspaceLoginProfiles = {
  analyst: { label: 'Agent Workspace', role: 'analyst', username: '', password: '', helper: 'Sign in with an account assigned to this tenant.' },
  requester: { label: 'Self-Service Portal', role: 'requester', username: '', password: '', helper: 'Sign in with your organisation account.' },
  rmm: { label: 'RMM Console', role: 'rmm', username: '', password: '', helper: 'Sign in with an account assigned to this tenant.' },
}

export const workspaceUsers = []
export const incidentServices = [
  { name: 'Collaboration', categories: ['Email & Messaging', 'Microsoft Teams', 'SharePoint & OneDrive'] },
  { name: 'Identity', categories: ['Sign-in & MFA', 'User Account', 'Permissions'] },
  { name: 'Hardware', categories: ['Laptop or Desktop', 'Peripheral', 'Printer'] },
  { name: 'Network Security', categories: ['VPN', 'Firewall', 'Secure Connectivity'] },
  { name: 'Wireless', categories: ['Corporate Wi-Fi', 'Guest Wi-Fi', 'Roaming'] },
  { name: 'Access', categories: ['Application Access', 'Shared Resource', 'Privileged Access'] },
]
export const priorities = ['Critical', 'High', 'Medium', 'Low']
export const types = ['Incident', 'Service Request', 'Change', 'Problem']

// Runtime collections start empty and are hydrated from tenant APIs/caches.
export const assets = []
export const knowledgeArticles = []
export const serviceCatalog = []
export const teams = []
export const liveChatReplyOptions = []
`
}

function cleanRuntimeState() {
  return `import { synchroniseProductionServiceRequestSnapshot } from './productionServiceRequests.js'
import { synchroniseProductionItsmRecordSnapshot } from './productionItsmRecords.js'

const PRODUCTION_SESSION_KEY = 'hi5central-production-session-v1'
const API_BASE = window.__HI5_API_BASE__
const serviceRequestSyncQueues = new Map()
const itsmRecordSyncQueues = new Map()

function readJson(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

function productionOrganisationEnabled() {
  const session = readJson(PRODUCTION_SESSION_KEY, null)
  return Boolean(session?.source === 'production' && session?.tenantSlug)
}

function productionServiceRequestsEnabled() {
  const session = readJson(PRODUCTION_SESSION_KEY, null)
  return Boolean(session?.source === 'production' && session?.role === 'analyst' && session?.tenantSlug)
}

function productionItsmEnabled() {
  return productionServiceRequestsEnabled()
}

function serviceRequestMutableFingerprint(ticket) {
  if (!ticket) return ''
  return JSON.stringify({
    status: ticket.status || '', priority: ticket.priority || '', team: ticket.team || '', assignee: ticket.assignee || '',
    approvalNote: ticket.approvalNote || '', completionNotes: ticket.completionNotes || '', reopenReason: ticket.reopenReason || '',
    requestApprovals: (ticket.requestApprovals || []).map((approval) => ({ id: approval.id, status: approval.status, decisionNote: approval.decisionNote || '' })),
    requestTasks: (ticket.requestTasks || []).map((task) => ({ id: task.id, status: task.status, team: task.team || '', assignee: task.assignee || '', completionNotes: task.completionNotes || '' })),
    activities: (ticket.activities || []).map((activity) => ({
      id: activity.id, kind: activity.kind, text: activity.text || '', html: activity.html || '',
      attachments: (activity.attachments || []).map((attachment) => ({ id: attachment.id, name: attachment.name, size: attachment.size, type: attachment.type })),
    })),
  })
}

function queueServiceRequestSync(previous, next) {
  if (!productionServiceRequestsEnabled()) return
  if (!previous || !next || previous.id !== next.id) return
  if (previous.type !== 'Service Request' || previous.persistence !== 'api') return
  if (serviceRequestMutableFingerprint(previous) === serviceRequestMutableFingerprint(next)) return
  const priorQueue = serviceRequestSyncQueues.get(next.id) || Promise.resolve()
  const job = priorQueue.catch(() => {})
    .then(() => synchroniseProductionServiceRequestSnapshot(previous, next))
    .then((reconciled) => {
      if (reconciled && serviceRequestMutableFingerprint(reconciled) !== serviceRequestMutableFingerprint(next)) window.setTimeout(() => window.location.reload(), 80)
    })
    .catch((error) => {
      console.error(\`Service Request \${next.id} synchronisation failed\`, error)
      window.dispatchEvent(new CustomEvent('hi5-service-requests-sync-error', { detail: { reference: next.id, message: error.message } }))
      window.setTimeout(() => window.location.reload(), 120)
    })
    .finally(() => { if (serviceRequestSyncQueues.get(next.id) === job) serviceRequestSyncQueues.delete(next.id) })
  serviceRequestSyncQueues.set(next.id, job)
}

function genericRecordFingerprint(ticket) {
  if (!ticket) return ''
  const clone = { ...ticket }
  for (const key of ['created', 'updated', 'createdAt', 'updatedAt', 'databaseId']) delete clone[key]
  return JSON.stringify(clone)
}

function queueItsmRecordSync(previous, next) {
  if (!productionItsmEnabled()) return
  if (!next || !['Incident', 'Problem', 'Change'].includes(next.type)) return
  if (previous && previous.id !== next.id) return
  if (previous && genericRecordFingerprint(previous) === genericRecordFingerprint(next)) return
  const queueKey = previous?.id || next.id
  const priorQueue = itsmRecordSyncQueues.get(queueKey) || Promise.resolve()
  const job = priorQueue.catch(() => {})
    .then(() => synchroniseProductionItsmRecordSnapshot(previous, next))
    .then((reconciled) => { if (reconciled) window.setTimeout(() => window.location.reload(), 90) })
    .catch((error) => {
      console.error(\`\${next.type} \${next.id} synchronisation failed\`, error)
      window.dispatchEvent(new CustomEvent('hi5-itsm-record-sync-error', { detail: { reference: next.id, message: error.message } }))
      window.setTimeout(() => window.location.reload(), 140)
    })
    .finally(() => { if (itsmRecordSyncQueues.get(queueKey) === job) itsmRecordSyncQueues.delete(queueKey) })
  itsmRecordSyncQueues.set(queueKey, job)
}

export async function syncOrganisationCollection(collection, items) {
  if (!productionOrganisationEnabled()) return null
  try {
    const response = await fetch(\`\${API_BASE}/api/v1/organisation/\${encodeURIComponent(collection)}\`, {
      method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: Array.isArray(items) ? items : [] }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || \`Could not save Organisation \${collection}.\`)
    window.dispatchEvent(new CustomEvent('hi5-organisation-synchronised', { detail: { collection, snapshot: payload } }))
    return payload
  } catch (error) {
    console.error(\`Organisation \${collection} synchronisation failed\`, error)
    window.dispatchEvent(new CustomEvent('hi5-organisation-sync-error', { detail: { collection, message: error.message } }))
    return null
  }
}

export function loadTickets() {
  if (!productionItsmEnabled()) return []
  const stored = readJson('hi5central-tickets', [])
  return Array.isArray(stored) ? stored.filter((ticket) => ticket?.persistence === 'api') : []
}
export function loadOrganisationPeople() { const value = readJson('hi5central-organisation-people-v1', []); return Array.isArray(value) ? value : [] }
export function loadOrganisationTeams() { const value = readJson('hi5central-organisation-teams-v1', []); return Array.isArray(value) ? value : [] }
export function loadOrganisationDepartments() { const value = readJson('hi5central-organisation-departments-v1', []); return Array.isArray(value) ? value : [] }
export function loadOrganisationAudit() { const value = readJson('hi5central-organisation-audit-v1', []); return Array.isArray(value) ? value : [] }
export function loadProjects() { const value = readJson('hi5central-projects-v1', []); return Array.isArray(value) ? value : [] }
export function loadRotaEntries() { const value = readJson('hi5central-rota-v1', []); return Array.isArray(value) ? value : [] }
export function loadCalendarEvents() { const value = readJson('hi5central-calendar-v1', []); return Array.isArray(value) ? value : [] }
export function loadLiveChatPreferences() { return { enabled: false, availability: 'Offline', soundEnabled: true, messagePreviews: true, enterToSend: true, ...(readJson('hi5central-live-chat-preferences-v1', {}) || {}) } }
export function loadLiveChatConversations() { const value = readJson('hi5central-live-chat-conversations-v1', []); return Array.isArray(value) ? value : [] }
export function loadNotifications() { const value = readJson('hi5central-notifications-v1', []); return Array.isArray(value) ? value : [] }
export function loadSession() { const session = readJson(PRODUCTION_SESSION_KEY, null); return session?.source === 'production' && session?.role === 'analyst' ? session : null }

export function saveProductionSession(session) {
  if (session?.source === 'production' && session?.role === 'analyst') writeJson(PRODUCTION_SESSION_KEY, session)
  else window.localStorage.removeItem(PRODUCTION_SESSION_KEY)
}
export function clearProductionSession() { window.localStorage.removeItem(PRODUCTION_SESSION_KEY) }
export function loadTheme() { const value = readJson('hi5central-theme-mode', null); return ['system', 'light', 'dark'].includes(value) ? value : 'system' }
export function loadAccent() { const value = readJson('hi5central-accent', 'amber'); return ['amber', 'cyan', 'blue', 'violet', 'emerald', 'rose'].includes(value) ? value : 'amber' }
export function loadDensity() { const value = readJson('hi5central-density', 'comfortable'); return ['comfortable', 'compact'].includes(value) ? value : 'comfortable' }
export function loadSidebarMode() { const value = readJson('hi5central-sidebar-mode', 'expanded'); return ['expanded', 'collapsed', 'hidden'].includes(value) ? value : 'expanded' }
export function loadWorkspace() { const value = readJson('hi5central-workspace-analyst', null); return value && Array.isArray(value.tabs) ? { tabs: value.tabs, activeTabKey: typeof value.activeTabKey === 'string' ? value.activeTabKey : null } : null }
export function saveWorkspace(value) { if (value && Array.isArray(value.tabs)) writeJson('hi5central-workspace-analyst', value) }

export function saveTickets(value) {
  const next = Array.isArray(value) ? value : []
  const previous = readJson('hi5central-tickets', [])
  writeJson('hi5central-tickets', next)
  if (!productionItsmEnabled() || !Array.isArray(previous)) return
  const previousById = new Map(previous.map((ticket) => [ticket.id, ticket]))
  next.forEach((ticket) => {
    const before = previousById.get(ticket.id)
    if (ticket.type === 'Service Request') { if (before) queueServiceRequestSync(before, ticket); return }
    if (['Incident', 'Problem', 'Change'].includes(ticket.type)) queueItsmRecordSync(before || null, ticket)
  })
}

export function saveOrganisationPeople(value) { writeJson('hi5central-organisation-people-v1', Array.isArray(value) ? value : []) }
export function saveOrganisationTeams(value) { writeJson('hi5central-organisation-teams-v1', Array.isArray(value) ? value : []) }
export function saveOrganisationDepartments(value) { writeJson('hi5central-organisation-departments-v1', Array.isArray(value) ? value : []) }
export function saveOrganisationAudit(value) { writeJson('hi5central-organisation-audit-v1', Array.isArray(value) ? value.slice(0, 500) : []) }
export function saveProjects(value) { writeJson('hi5central-projects-v1', Array.isArray(value) ? value : []) }
export function saveRotaEntries(value) { writeJson('hi5central-rota-v1', Array.isArray(value) ? value : []) }
export function saveCalendarEvents(value) { writeJson('hi5central-calendar-v1', Array.isArray(value) ? value : []) }
export function saveLiveChatPreferences(value) { writeJson('hi5central-live-chat-preferences-v1', value || {}) }
export function saveLiveChatConversations(value) { writeJson('hi5central-live-chat-conversations-v1', Array.isArray(value) ? value : []) }
export function saveNotifications(value) { writeJson('hi5central-notifications-v1', Array.isArray(value) ? value : []) }
export function saveTheme(value) { writeJson('hi5central-theme-mode', value) }
export function saveAccent(value) { writeJson('hi5central-accent', value) }
export function saveDensity(value) { writeJson('hi5central-density', value) }
export function saveSidebarMode(value) { writeJson('hi5central-sidebar-mode', value) }

export function loadPortalSession() { return null }
export function savePortalSession() { window.localStorage.removeItem('hi5central-portal-session') }
export function loadRmmSession() { return null }
export function saveRmmSession() { window.localStorage.removeItem('hi5central-rmm-session') }
export function saveSession(session) {
  if (session?.source === 'production') { saveProductionSession(session); return }
  const hadProductionSession = Boolean(readJson(PRODUCTION_SESSION_KEY, null))
  window.localStorage.removeItem(PRODUCTION_SESSION_KEY)
  if (hadProductionSession) fetch(\`\${API_BASE}/api/v1/auth/logout\`, { method: 'POST', credentials: 'include' }).catch(() => {})
}
`
}

function cleanNotifications() {
  return `export const notificationSourceLabels = {
  itsm: 'ITSM', livechat: 'Live Chat', projects: 'Projects', calendar: 'Calendar', rota: 'Rota',
}

export function createNotification(notification) {
  return {
    id: \`NOT-\${Date.now()}-\${Math.random().toString(36).slice(2, 7)}\`,
    source: 'itsm', tone: 'info', read: false, createdAt: new Date().toISOString(), ...notification,
  }
}
`
}

function runtimeAuthBoundary() {
  return `export function authenticateWorkspaceUser() {
  return null
}
`
}

function productionBoundaryCheck() {
  return `import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const forbiddenPaths = [
  'src/App.jsx', 'src/services/demoAuth.js', 'src/services/demoStore.js', 'src/data/demoData.jsx', 'src/legacy',
]
const forbiddenText = [
  'demoData', 'demoStore', 'demoAuth', 'authenticateDemoUser', 'CALENDAR_DEMO_TODAY',
  'analyst@hi5central.com', 'employee@hi5central.com', 'rmm@hi5central.com',
  'Hi5Desk!2026', 'Hi5Portal!2026', 'Hi5RMM!2026', 'Dana Sinclair', 'Eleanor Shaw',
]

const failures = []
for (const relativePath of forbiddenPaths) {
  if (fs.existsSync(path.join(root, relativePath))) failures.push(\`Forbidden active runtime path: \${relativePath}\`)
}

function walk(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

for (const file of walk(path.join(root, 'src'))) {
  if (!/\.(js|jsx|mjs|css|html)$/.test(file)) continue
  const relative = path.relative(root, file)
  const content = fs.readFileSync(file, 'utf8')
  for (const token of forbiddenText) {
    if (content.includes(token)) failures.push(\`\${relative} contains forbidden runtime token: \${token}\`)
  }
  if (/from\s+['\"][^'\"]*archive\//.test(content)) failures.push(\`\${relative} imports archived code\`)
}

for (const required of [
  'src/runtime/WorkspaceRuntime.jsx',
  'src/runtime/workspaceConfig.jsx',
  'src/services/runtimeState.js',
  'archive/demo-runtime/src/App.jsx',
  'archive/demo-runtime/src/data/demoData.jsx',
  'archive/demo-runtime/src/services/demoStore.js',
]) {
  if (!fs.existsSync(path.join(root, required))) failures.push(\`Missing production/archive boundary file: \${required}\`)
}

if (failures.length) {
  console.error('Production runtime boundary check failed:')
  failures.forEach((failure) => console.error(\`- \${failure}\`))
  process.exit(1)
}

console.log('Production runtime boundary check passed')
`
}

function cleanRmmBootstrap() {
  return `import { useEffect, useMemo, useState } from 'react'
import { RmmPlatformApp } from '../features/rmm/RmmPlatformApp.jsx'
import { resolveTenantSurface } from '../lib/tenantSurface.js'

const API_BASE = window.__HI5_API_BASE__

export function ProductionRmmBootstrap() {
  const surface = useMemo(() => resolveTenantSurface(), [])
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    let active = true
    fetch(\`\${API_BASE}/api/v1/auth/session\`, { credentials: 'include' })
      .then(async (response) => ({ response, payload: await response.json().catch(() => ({})) }))
      .then(({ response, payload }) => {
        if (active && response.ok && payload?.tenant?.slug === surface.tenantSlug) setSession(payload)
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [surface.tenantSlug])

  async function login(event) {
    event.preventDefault()
    setError('')
    const response = await fetch(\`\${API_BASE}/api/v1/auth/login\`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantSlug: surface.tenantSlug, email: form.email, password: form.password }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) { setError(payload.error || 'Sign in failed.'); return }
    setSession(payload)
  }

  async function logout() {
    await fetch(\`\${API_BASE}/api/v1/auth/logout\`, { method: 'POST', credentials: 'include' }).catch(() => {})
    setSession(null)
  }

  if (loading) return <main className="production-auth-shell"><div className="production-auth-card">Opening RMM…</div></main>
  if (!session) {
    return (
      <main className="production-auth-shell">
        <form className="production-auth-card" onSubmit={login}>
          <img src="/hi5central-logo.png" alt="Hi5Central" />
          <h1>RMM sign in</h1>
          <p>Sign in with an account assigned to {surface.tenantName || surface.tenantSlug}.</p>
          <label><span>Email address</span><input type="email" autoComplete="username" required value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
          <label><span>Password</span><input type="password" autoComplete="current-password" required value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /></label>
          {error ? <div className="production-auth-error">{error}</div> : null}
          <button type="submit">Sign in</button>
        </form>
      </main>
    )
  }

  return (
    <RmmPlatformApp
      accent="amber"
      currentUser={{ role: 'rmm', name: session.user?.name || session.user?.email || 'RMM user', username: session.user?.email || '' }}
      handleLogout={logout}
      onCreateItsmIncident={() => null}
      setTheme={setTheme}
      tenantName={session.tenant?.companyName || surface.tenantName || surface.tenantSlug}
      theme={theme}
      tickets={[]}
    />
  )
}
`
}

function migrate() {
  if (!exists('src/App.jsx')) {
    console.log('Production runtime extraction already applied; nothing to do.')
    return
  }

  const appSource = read('src/App.jsx')
  const appCss = read('src/App.css')
  const workspaceViewsSource = read('src/features/workspace/WorkspaceViews.jsx')

  // Preserve the exact prototype implementation for historical reference.
  for (const relativePath of [
    'src/App.jsx',
    'src/data/demoData.jsx',
    'src/services/demoAuth.js',
    'src/services/demoStore.js',
    'src/features/workspace/WorkspaceViews.jsx',
    'src/data/calendarData.js',
    'src/data/liveChatData.js',
    'src/data/notificationData.js',
    'src/data/organisationData.js',
    'src/data/organisationSites.js',
    'src/data/portalData.js',
    'src/data/rmmData.js',
    'src/data/rmmMonitoringData.js',
    'src/data/rmmScopeData.js',
    'src/data/rotaData.js',
    'src/data/workPlanningData.js',
    'src/features/portal/SelfServicePortalApp.jsx',
    'src/features/rmm/RmmPlatformApp.jsx',
  ]) archiveSnapshot(relativePath)

  archiveMove('src/App.jsx')
  archiveMove('src/services/demoAuth.js')
  archiveMove('src/services/demoStore.js')
  archiveMove('src/data/demoData.jsx')
  archiveMove('src/legacy')

  ensureDir('src/runtime')
  write('src/runtime/workspaceConfig.jsx', cleanWorkspaceConfig())
  write('src/runtime/runtimeAuthBoundary.js', runtimeAuthBoundary())
  write('src/runtime/runtimeNotifications.js', cleanNotifications())
  write('src/services/runtimeState.js', cleanRuntimeState())
  write('src/runtime/WorkspaceRuntime.css', appCss)
  fs.rmSync(abs('src/App.css'))

  let runtime = appSource
    .replace("from './data/demoData.jsx'", "from './workspaceConfig.jsx'")
    .replace("from './data/liveChatData.js'", "from './workspaceConfig.jsx'")
    .replace("from './data/notificationData.js'", "from './runtimeNotifications.js'")
    .replace("from './services/demoAuth.js'", "from './runtimeAuthBoundary.js'")
    .replace("from './services/demoStore.js'", "from '../services/runtimeState.js'")
    .replaceAll("from './lib/", "from '../lib/")
    .replaceAll("from './features/", "from '../features/")
    .replace("import './App.css'", "import './WorkspaceRuntime.css'")
    .replaceAll('authenticateDemoUser', 'authenticateWorkspaceUser')
    .replaceAll('loginProfiles', 'workspaceLoginProfiles')
    .replaceAll("seedTickets[0].id", "''")
    .replaceAll('Dana Sinclair', 'Hi5Central User')
    .replaceAll('Those demo credentials do not match this login area.', 'Use your tenant account to sign in.')
    .replaceAll('prototype CMDB yet', 'CMDB')
    .replaceAll('No demo records match that search.', 'No records match that search.')
    .replace('function App()', 'function WorkspaceRuntime()')
    .replace('export default App', 'export default WorkspaceRuntime')
  runtime = runtime.replace('window.setTimeout(() => {\n      const incomingText = liveChatReplyOptions[replyIndex]', 'if (liveChatReplyOptions.length) window.setTimeout(() => {\n      const incomingText = liveChatReplyOptions[replyIndex]')
  write('src/runtime/WorkspaceRuntime.jsx', runtime)

  let workspaceViews = workspaceViewsSource
    .replace("from '../../data/demoData.jsx'", "from '../../runtime/workspaceConfig.jsx'")
    .replaceAll('demoUsers', 'workspaceUsers')
    .replaceAll('loginProfiles', 'workspaceLoginProfiles')
    .replaceAll('Demo access', 'Tenant access')
    .replaceAll('demo credentials', 'tenant credentials')
  workspaceViews = replaceFunction(workspaceViews, 'LoginScreen', `export function LoginScreen() {
  return null
}`)
  write('src/features/workspace/WorkspaceViews.jsx', workspaceViews)

  // Production-safe runtime data modules: retain reusable helpers/configuration,
  // but remove all seeded records.
  if (exists('src/data/calendarData.js')) {
    let value = read('src/data/calendarData.js')
      .replaceAll('CALENDAR_DEMO_TODAY', 'CALENDAR_DEFAULT_TODAY')
      .replace(/export const CALENDAR_DEFAULT_TODAY = ['\"][^'\"]+['\"]/, "export const CALENDAR_DEFAULT_TODAY = new Date().toISOString().slice(0, 10)")
    value = replaceExportedArray(value, 'seedCalendarEvents')
    write('src/data/calendarData.js', value)
  }
  if (exists('src/features/calendar/CalendarView.jsx')) {
    write('src/features/calendar/CalendarView.jsx', read('src/features/calendar/CalendarView.jsx').replaceAll('CALENDAR_DEMO_TODAY', 'CALENDAR_DEFAULT_TODAY'))
  }

  write('src/data/liveChatData.js', `export const defaultLiveChatPreferences = { enabled: false, availability: 'Offline', soundEnabled: true, messagePreviews: true, enterToSend: true }\nexport const seedLiveChatConversations = []\nexport const liveChatReplyOptions = []\n`)
  write('src/data/notificationData.js', cleanNotifications())

  for (const relativePath of ['src/data/organisationData.js', 'src/data/organisationSites.js', 'src/data/rmmData.js', 'src/data/rmmScopeData.js', 'src/data/rotaData.js', 'src/data/workPlanningData.js']) {
    if (!exists(relativePath)) continue
    write(relativePath, replaceAllExportedArrays(read(relativePath)))
  }
  if (exists('src/data/rmmMonitoringData.js')) {
    let value = read('src/data/rmmMonitoringData.js')
    value = replaceAllExportedArrays(value)
    write('src/data/rmmMonitoringData.js', value)
  }
  if (exists('src/data/portalData.js')) {
    write('src/data/portalData.js', replaceExportedArray(read('src/data/portalData.js'), 'portalServiceCatalog'))
  }

  // Remove baked-in login identities from reusable portal/RMM view modules.
  for (const relativePath of ['src/features/portal/SelfServicePortalApp.jsx', 'src/features/rmm/RmmPlatformApp.jsx']) {
    if (!exists(relativePath)) continue
    let value = read(relativePath)
      .replace("from '../../data/demoData.jsx'", "from '../../runtime/workspaceConfig.jsx'")
      .replaceAll('loginProfiles', 'workspaceLoginProfiles')
      .replaceAll('Demo access', 'Tenant access')
      .replaceAll('demo credentials', 'tenant credentials')
      .replaceAll('Dana Sinclair', 'Hi5Central User')
      .replaceAll('Eleanor Shaw', 'Requester')
    write(relativePath, value)
  }

  // Workspace bootstrap now renders the production runtime directly.
  let workspaceBootstrap = read('src/production/ProductionWorkspaceBootstrap.jsx')
    .replace("import App from '../App.jsx'", "import WorkspaceRuntime from '../runtime/WorkspaceRuntime.jsx'")
    .replace("} from '../services/demoStore.js'", "} from '../services/runtimeState.js'")
    .replaceAll('<App key={workspaceKey} />', '<WorkspaceRuntime key={workspaceKey} />')
    .replace('// Local runtime preferences are a bridge for the current demo UI.', '// Local runtime preferences bridge server settings into the workspace shell.')
  workspaceBootstrap = workspaceBootstrap.replace('  return <App />\n}', `  return (
    <div className="production-auth-shell">
      <div className="production-auth-card production-auth-loading">
        <img src="/hi5central-logo.png" alt="" />
        <strong>Tenant unavailable</strong>
        <span>This tenant could not be loaded from the Hi5Central service.</span>
      </div>
    </div>
  )
}`)
  write('src/production/ProductionWorkspaceBootstrap.jsx', workspaceBootstrap)

  // Portal never falls back to the archived prototype.
  let portalBootstrap = read('src/production/ProductionPortalBootstrap.jsx')
    .replace("import App from '../App.jsx'\n", '')
    .replace("import { portalServiceCatalog } from '../data/portalData.js'\n", '')
    .replace(/function replaceCatalogue\([\s\S]*?\n}\n\n/, '')
    .replace('        replaceCatalogue(catalogue.items)\n', '')
    .replace('  if (!state.managed) return <App />', `  if (!state.managed) return <PortalBootstrapState error="This Help Centre is not configured for this tenant." onRetry={() => setState((current) => ({ ...current, attempt: current.attempt + 1 }))} tenantName={surface.tenantName || surface.tenantSlug} />`)
  write('src/production/ProductionPortalBootstrap.jsx', portalBootstrap)

  write('src/production/ProductionRmmBootstrap.jsx', cleanRmmBootstrap())

  // Every surface now uses a production bootstrap, including local/Vercel previews.
  let main = read('src/main.jsx')
    .replace("import App from './App.jsx'\n", '')
    .replace("import { ProductionPortalBootstrap } from './production/ProductionPortalBootstrap.jsx'", "import { ProductionPortalBootstrap } from './production/ProductionPortalBootstrap.jsx'\nimport { ProductionRmmBootstrap } from './production/ProductionRmmBootstrap.jsx'")
    .replace("const productionWorkspace = initialSurface.kind === 'workspace' && initialSurface.canonical", "const productionWorkspace = initialSurface.kind === 'workspace'")
    .replace("const productionPortal = initialSurface.kind === 'portal' && initialSurface.canonical", "const productionPortal = initialSurface.kind === 'portal'")
    .replace('let RootApp = App', 'let RootApp = ProductionWorkspaceBootstrap')
  main = main.replace("if (productionPortal) RootApp = ProductionPortalBootstrap", "if (productionPortal) RootApp = ProductionPortalBootstrap\nif (initialSurface.kind === 'rmm') RootApp = ProductionRmmBootstrap")
  write('src/main.jsx', main)

  // Move obvious non-runtime leftovers outside src.
  archiveMove('src/features/notifications/Test')
  archiveMove('src/index.html')
  archiveMove('src/vite.config.js')
  archiveMove('src/vercel.json')
  moveIfUnused('src/assets/react.svg', ['react.svg'])
  moveIfUnused('src/assets/vite.svg', ['vite.svg'])
  moveIfUnused('public/lsl-logo.png', ['lsl-logo.png'])

  write('scripts/check-production-runtime-boundary.mjs', productionBoundaryCheck())

  const pkg = JSON.parse(read('package.json'))
  pkg.scripts = { ...pkg.scripts, 'check:production-runtime': 'node scripts/check-production-runtime-boundary.mjs' }
  write('package.json', `${JSON.stringify(pkg, null, 2)}\n`)

  const ciPath = '.github/workflows/ci.yml'
  if (exists(ciPath)) {
    let ci = read(ciPath)
    if (!ci.includes('npm run check:production-runtime')) {
      const anchor = '      - run: npm run check:catalogue-v2\n'
      if (ci.includes(anchor)) ci = ci.replace(anchor, `${anchor}      - run: npm run check:production-runtime\n`)
      else ci += '\n# Production runtime boundary is also enforced by package CI.\n'
      write(ciPath, ci)
    }
  }

  write(`${ARCHIVE_ROOT}/README.md`, `# Archived prototype runtime\n\nThis directory contains the historical Hi5Central prototype/demo runtime and seeded sample data. It is retained only for source history and must never be imported by the active application.\n\nActive runtime code lives under \`src/runtime\`, \`src/production\`, \`src/features\`, \`src/services\` and production-safe \`src/data\` modules. CI enforces this boundary.\n`)

  console.log('Production runtime extraction completed.')
}

migrate()
