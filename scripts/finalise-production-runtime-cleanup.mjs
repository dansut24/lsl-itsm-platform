import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const abs = (value) => path.join(root, value)
const read = (value) => fs.readFileSync(abs(value), 'utf8')
const write = (value, content) => {
  fs.mkdirSync(path.dirname(abs(value)), { recursive: true })
  fs.writeFileSync(abs(value), content)
}
const remove = (value) => fs.rmSync(abs(value), { recursive: true, force: true })
const update = (value, transform) => {
  if (!fs.existsSync(abs(value))) return
  const current = read(value)
  const next = transform(current)
  if (next !== current) write(value, next)
}

function removeRange(source, startMarker, endMarker, { keepEnd = true } = {}) {
  const start = source.indexOf(startMarker)
  if (start < 0) return source
  const end = source.indexOf(endMarker, start + startMarker.length)
  if (end < 0) throw new Error(`Could not find end marker ${endMarker} after ${startMarker}`)
  return `${source.slice(0, start)}${keepEnd ? source.slice(end) : source.slice(end + endMarker.length)}`
}

function replaceAll(source, from, to) {
  return source.split(from).join(to)
}

// Calendar: production configuration only; runtime entries come from state/API.
write('src/data/calendarData.js', `export const CALENDAR_TODAY = new Date().toISOString().slice(0, 10)\n\nexport const calendarEventTypes = [\n  'Meeting',\n  'Reminder',\n  'Focus time',\n  'Maintenance',\n  'Other',\n]\n`)
update('src/features/calendar/CalendarView.jsx', (source) =>
  source
    .replaceAll('CALENDAR_DEFAULT_TODAY', 'CALENDAR_TODAY')
    .replace("import { CALENDAR_TODAY, calendarEventTypes } from '../../data/calendarData.js'", "import { CALENDAR_TODAY, calendarEventTypes } from '../../data/calendarData.js'"))

// Rota: keep only generic product-level entry types. Coverage requirements are
// tenant configuration and therefore default to no hard-coded rules.
write('src/data/rotaData.js', `function isoDate(date) {\n  return date.toISOString().slice(0, 10)\n}\n\nfunction mondayFor(value = new Date()) {\n  const date = new Date(value)\n  const day = date.getUTCDay()\n  const offset = day === 0 ? -6 : 1 - day\n  date.setUTCDate(date.getUTCDate() + offset)\n  return isoDate(date)\n}\n\nexport const ROTA_TODAY = isoDate(new Date())\nexport const ROTA_WEEK_START = mondayFor()\n\nexport const rotaEntryTypes = [\n  { id: 'Early', label: 'Early', category: 'shift', start: '07:30', end: '15:30', capacityHours: 8 },\n  { id: 'Standard', label: 'Standard', category: 'shift', start: '09:00', end: '17:00', capacityHours: 8 },\n  { id: 'Late', label: 'Late', category: 'shift', start: '12:00', end: '20:00', capacityHours: 8 },\n  { id: 'On Call', label: 'On call', category: 'on-call', start: '17:00', end: '08:00', capacityHours: 0 },\n  { id: 'Leave', label: 'Annual leave', category: 'absence', start: '', end: '', capacityHours: 0 },\n  { id: 'Sickness', label: 'Sickness', category: 'absence', start: '', end: '', capacityHours: 0 },\n  { id: 'Unavailable', label: 'Unavailable', category: 'absence', start: '', end: '', capacityHours: 0 },\n]\n\n// Coverage rules are tenant-owned. The UI remains usable without them; it simply\n// omits coverage-gap warnings until rules are configured.\nexport const rotaCoverageRules = {}\n`)
update('src/features/rota/RotaView.jsx', (source) => {
  let next = source
    .replaceAll('ROTA_DEMO_TODAY', 'ROTA_TODAY')
    .replaceAll('ROTA_DEMO_WEEK_START', 'ROTA_WEEK_START')
  next = next.replace(
    "const eligibleTeams = useMemo(() => teams.filter((team) => rotaCoverageRules[team.name]), [teams])",
    "const eligibleTeams = useMemo(() => teams, [teams])",
  )
  return next
})

// Project management: product-level statuses only. Projects are tenant/runtime data.
write('src/data/workPlanningData.js', `import { organisationPeople, organisationTeams } from './organisationData.js'\n\nexport const workPeople = organisationPeople\nexport const workTeams = organisationTeams\n\nexport const projectTaskStatuses = ['Backlog', 'To Do', 'In Progress', 'Blocked', 'Done']\nexport const projectStatuses = ['Planned', 'In Progress', 'On Hold', 'Complete']\nexport const projectHealthOptions = ['On Track', 'At Risk', 'Blocked', 'Complete']\n`)

// Live Chat has no client-side sample conversations or generated requester replies.
write('src/data/liveChatData.js', `export const defaultLiveChatPreferences = {\n  enabled: false,\n  availability: 'Offline',\n  soundEnabled: true,\n  messagePreviews: true,\n  enterToSend: true,\n}\n`)
update('src/runtime/workspaceConfig.jsx', (source) =>
  source.replace(/\nexport const liveChatReplyOptions = \[\]\n?/, '\n'))
update('src/runtime/WorkspaceRuntime.jsx', (source) => {
  let next = source.replace("import { liveChatReplyOptions } from './workspaceConfig.jsx'\n", '')
  next = next.replace('    let replyIndex = 0\n', '')
  next = next.replace(/\n\s*replyIndex = conversation\.messages\.length % liveChatReplyOptions\.length\n/, '\n')
  next = next.replace(/\n\s*if \(liveChatReplyOptions\.length\) window\.setTimeout\(\(\) => \{[\s\S]*?\n\s*\}, 1200\)\n/, '\n')
  return next
})

// RMM collections begin empty and are populated by the RMM service/runtime. No
// sample machines, software, patches, public IPs or activity exist in active src.
write('src/data/rmmData.js', `export const rmmSites = []\nexport const rmmDeviceGroups = []\nexport const rmmDevices = []\nexport const rmmAlerts = []\nexport const rmmPatchGroups = []\nexport const rmmJobs = []\nexport const rmmSoftware = []\nexport const rmmScripts = []\nexport const rmmPolicies = []\nexport const rmmActivity = []\n`)

write('src/data/rmmScopeData.js', `import { rmmDeviceGroups, rmmSites } from './rmmData.js'\n\nexport const rmmManagedSites = rmmSites.map((site) => ({\n  ...site,\n  source: site.source || 'Tenant',\n  status: site.status || (Number(site.warning || 0) > 0 ? 'Attention' : 'Healthy'),\n}))\n\nexport const rmmManagedDeviceGroups = rmmDeviceGroups.map((group) => ({\n  ...group,\n  source: group.source || 'Tenant',\n}))\n\nexport function deviceMatchesManagedGroup(device, groupId) {\n  if (!groupId || groupId === 'All') return true\n  const group = rmmManagedDeviceGroups.find((item) => item.id === groupId)\n  if (!group) return false\n  if (group.mode !== 'Dynamic') return device.groupId === group.id || device.group === group.name\n\n  const rule = group.rule || {}\n  if (rule.patchBelow != null && !(Number(device.patchCompliance) < Number(rule.patchBelow))) return false\n  if (rule.healthNot && device.health === rule.healthNot) return false\n  if (rule.platformIncludes && !String(device.platform || device.os || '').toLowerCase().includes(String(rule.platformIncludes).toLowerCase())) return false\n  if (rule.tag && !(device.tags || []).some((tag) => String(tag).toLowerCase() === String(rule.tag).toLowerCase())) return false\n  return true\n}\n\nexport const rmmDefaultSavedViews = []\nexport const RMM_SAVED_VIEWS_STORAGE_KEY = 'hi5central:rmm:saved-views:v1'\nexport const RMM_CUSTOM_SITES_STORAGE_KEY = 'hi5central:rmm:custom-sites:v1'\nexport const RMM_CUSTOM_GROUPS_STORAGE_KEY = 'hi5central:rmm:custom-groups:v1'\n`)

update('src/data/rmmMonitoringData.js', (source) => {
  let next = source.replace('    // Prototype persistence should not break the RMM UI if storage is blocked.', '    // Browser persistence must not break the RMM UI if storage is blocked.')
  next = next.replace("  const effectivePolicyId = deviceOverride?.policyId || winningAssignment?.policyId || 'MON-ENDPOINT-STD'", "  const effectivePolicyId = deviceOverride?.policyId || winningAssignment?.policyId || policies[0]?.id || ''")
  return next
})

// The production portal bootstrap owns authentication and renders
// ProductionRequesterPortalV2. The old self-service application is archive-only.
update('src/runtime/WorkspaceRuntime.jsx', (source) =>
  source.replace("import { PortalLoginScreen, SelfServicePortalApp } from '../features/portal/SelfServicePortalApp.jsx'\n", ''))
remove('src/features/portal/SelfServicePortalApp.jsx')
remove('src/features/portal/SelfServicePortalApp.css')

// RMM authentication is owned by ProductionRmmBootstrap. Keep the operational
// RMM application, but remove the old in-component credential helper/login UI.
update('src/features/rmm/RmmPlatformApp.jsx', (source) => {
  let next = source.replace("import { workspaceLoginProfiles } from '../../runtime/workspaceConfig.jsx'\n", '')
  const start = next.indexOf('export function RmmLoginScreen(')
  const end = next.indexOf('\nfunction RmmDashboard(', start)
  if (start >= 0 && end > start) next = `${next.slice(0, start)}${next.slice(end + 1)}`
  next = next.replace(/\n\s*KeyRound,/, '')
  return next
})
update('src/runtime/WorkspaceRuntime.jsx', (source) =>
  source.replace("import { RmmLoginScreen, RmmPlatformApp } from '../features/rmm/RmmPlatformApp.jsx'", "import { RmmPlatformApp } from '../features/rmm/RmmPlatformApp.jsx'"))

// Replace the migration-era "Legacy" boundary with a production session boundary.
const oldBoundaryCss = 'src/production/ProductionLegacyBoundary.css'
if (fs.existsSync(abs(oldBoundaryCss))) {
  write('src/production/ProductionSessionBoundary.css', read(oldBoundaryCss))
  remove(oldBoundaryCss)
}
write('src/production/ProductionSessionBoundary.jsx', `import { useEffect } from 'react'\nimport './ProductionSessionBoundary.css'\n\nconst API_BASE = window.__HI5_API_BASE__\nconst PRODUCTION_SESSION_KEY = 'hi5central-production-session-v1'\nconst DEPRECATED_SESSION_KEYS = ['hi5central-session', 'lsl-itsm-session']\nconst SETTINGS_RECOVERY_KEY = 'hi5central-production-settings-recovery-v1'\n\nfunction clearDeprecatedSessionKeys() {\n  for (const key of DEPRECATED_SESSION_KEYS) {\n    try { window.localStorage.removeItem(key) } catch { /* best effort */ }\n  }\n}\n\nfunction productionSessionExists() {\n  try {\n    const raw = window.localStorage.getItem(PRODUCTION_SESSION_KEY)\n    if (!raw) return false\n    const session = JSON.parse(raw)\n    return session?.source === 'production' && Boolean(session?.tenantSlug)\n  } catch {\n    return false\n  }\n}\n\nfunction settingsPath() {\n  return window.location.pathname === '/settings' || window.location.pathname.startsWith('/settings/')\n}\n\nexport function ProductionSessionBoundary() {\n  useEffect(() => {\n    clearDeprecatedSessionKeys()\n    document.documentElement.dataset.hi5ProductionBoundary = 'true'\n    document.body.dataset.hi5ProductionBoundary = 'true'\n\n    let signingOut = false\n    let settingsMissingSince = 0\n\n    function protectSettingsSurface() {\n      const frame = document.querySelector('.content-frame')\n      const inSettings = settingsPath()\n      if (frame instanceof HTMLElement) frame.classList.toggle('hi5-production-settings-route', inSettings)\n\n      if (!inSettings) {\n        settingsMissingSince = 0\n        try { window.sessionStorage.removeItem(SETTINGS_RECOVERY_KEY) } catch { /* best effort */ }\n        return\n      }\n\n      const shell = document.querySelector('.production-settings-shell')\n      if (shell instanceof HTMLElement) {\n        settingsMissingSince = 0\n        try { window.sessionStorage.removeItem(SETTINGS_RECOVERY_KEY) } catch { /* best effort */ }\n        return\n      }\n\n      if (!productionSessionExists()) return\n      if (!settingsMissingSince) { settingsMissingSince = Date.now(); return }\n      if (Date.now() - settingsMissingSince < 1800) return\n\n      try {\n        if (window.sessionStorage.getItem(SETTINGS_RECOVERY_KEY) === '1') return\n        window.sessionStorage.setItem(SETTINGS_RECOVERY_KEY, '1')\n      } catch { return }\n      window.location.reload()\n    }\n\n    async function signOutFromProduction() {\n      if (signingOut) return\n      signingOut = true\n      try {\n        await fetch(\`${API_BASE}/api/v1/auth/logout\`, { method: 'POST', credentials: 'include' })\n      } catch {\n        // Continue to sign-in even when the network is unavailable.\n      } finally {\n        try { window.localStorage.removeItem(PRODUCTION_SESSION_KEY) } catch { /* best effort */ }\n        clearDeprecatedSessionKeys()\n        try { window.sessionStorage.removeItem(SETTINGS_RECOVERY_KEY) } catch { /* best effort */ }\n        window.location.replace('/login')\n      }\n    }\n\n    function handleSignOut(event) {\n      const button = event.target instanceof Element ? event.target.closest('button') : null\n      if (!(button instanceof HTMLButtonElement)) return\n      const isSignOut = button.classList.contains('chrome-logout')\n        || button.getAttribute('aria-label') === 'Sign out'\n        || button.getAttribute('title') === 'Sign out'\n      if (!isSignOut) return\n\n      const dirty = document.querySelector('.workspace-tab.dirty, .unsaved-dot')\n      if (dirty && !window.confirm('You have unsaved changes. Sign out and discard them?')) {\n        event.preventDefault()\n        event.stopPropagation()\n        event.stopImmediatePropagation?.()\n        return\n      }\n\n      event.preventDefault()\n      event.stopPropagation()\n      event.stopImmediatePropagation?.()\n      void signOutFromProduction()\n    }\n\n    function routeChanged() {\n      settingsMissingSince = 0\n      window.setTimeout(protectSettingsSurface, 0)\n    }\n\n    document.addEventListener('click', handleSignOut, true)\n    window.addEventListener('popstate', routeChanged)\n    window.addEventListener('hi5-routechange', routeChanged)\n\n    const observer = new MutationObserver(protectSettingsSurface)\n    observer.observe(document.body, { childList: true, subtree: true })\n    const interval = window.setInterval(protectSettingsSurface, 450)\n    protectSettingsSurface()\n\n    return () => {\n      document.removeEventListener('click', handleSignOut, true)\n      window.removeEventListener('popstate', routeChanged)\n      window.removeEventListener('hi5-routechange', routeChanged)\n      observer.disconnect()\n      window.clearInterval(interval)\n      document.querySelector('.content-frame')?.classList.remove('hi5-production-settings-route')\n      delete document.documentElement.dataset.hi5ProductionBoundary\n      delete document.body.dataset.hi5ProductionBoundary\n    }\n  }, [])\n\n  return null\n}\n`)
remove('src/production/ProductionLegacyBoundary.jsx')
update('src/main.jsx', (source) => source
  .replace("import { ProductionLegacyBoundary } from './production/ProductionLegacyBoundary.jsx'", "import { ProductionSessionBoundary } from './production/ProductionSessionBoundary.jsx'")
  .replaceAll('<ProductionLegacyBoundary />', '<ProductionSessionBoundary />'))

// Remove old component-login UI where production bootstraps already own auth.
update('src/features/portal/SelfServicePortalApp.jsx', (source) => source)

// Strengthen the permanent boundary. Active src must not contain the vocabulary
// or identifiers of the archived prototype implementation.
write('scripts/check-production-runtime-boundary.mjs', `import fs from 'node:fs'\nimport path from 'node:path'\n\nconst root = process.cwd()\nconst forbiddenPaths = [\n  'src/App.jsx',\n  'src/services/demoAuth.js',\n  'src/services/demoStore.js',\n  'src/data/demoData.jsx',\n  'src/legacy',\n  'src/features/portal/SelfServicePortalApp.jsx',\n  'src/production/ProductionLegacyBoundary.jsx',\n]\nconst forbiddenTokens = [\n  'demoData', 'demoStore', 'demoAuth', 'authenticateDemoUser',\n  'seedTickets', 'seedProjects', 'seedRotaEntries', 'seedCalendarEvents', 'seedLiveChatConversations',\n  'liveChatReplyOptions', 'ROTA_DEMO_', 'CALENDAR_DEMO_',\n  'analyst@hi5central.com', 'employee@hi5central.com', 'rmm@hi5central.com',\n  'Hi5Desk!2026', 'Hi5Portal!2026', 'Hi5RMM!2026',\n  'Dana Sinclair', 'Eleanor Shaw', 'AGT-DANA', 'PRJ-0042', 'SITE-LON-HQ', 'KB5074211',\n  'portal-demo-credentials', 'rmm-demo-login', 'Use demo employee', 'Use demo RMM account',\n]\n\nconst failures = []\nfor (const relativePath of forbiddenPaths) {\n  if (fs.existsSync(path.join(root, relativePath))) failures.push(\`Forbidden active runtime path: \${relativePath}\`)\n}\n\nfunction walk(directory) {\n  if (!fs.existsSync(directory)) return []\n  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {\n    const full = path.join(directory, entry.name)\n    return entry.isDirectory() ? walk(full) : [full]\n  })\n}\n\nfor (const file of walk(path.join(root, 'src'))) {\n  if (!/\\.(js|jsx|mjs|css|html)$/.test(file)) continue\n  const relative = path.relative(root, file)\n  const content = fs.readFileSync(file, 'utf8')\n  const lower = content.toLowerCase()\n  for (const token of forbiddenTokens) {\n    if (content.includes(token)) failures.push(\`\${relative} contains forbidden runtime token: \${token}\`)\n  }\n  if (/(^|[^a-z])demo([^a-z]|$)/i.test(content)) failures.push(\`\${relative} still contains demo vocabulary\`)\n  if (lower.includes('prototype')) failures.push(\`\${relative} still contains prototype vocabulary\`)\n  if (content.includes('archive/')) failures.push(\`\${relative} imports archived code\`)\n}\n\nfor (const required of [\n  'src/runtime/WorkspaceRuntime.jsx',\n  'src/runtime/workspaceConfig.jsx',\n  'src/services/runtimeState.js',\n  'src/production/ProductionSessionBoundary.jsx',\n  'archive/demo-runtime/src/App.jsx',\n  'archive/demo-runtime/src/data/demoData.jsx',\n  'archive/demo-runtime/src/services/demoStore.js',\n]) {\n  if (!fs.existsSync(path.join(root, required))) failures.push(\`Missing production/archive boundary file: \${required}\`)\n}\n\nif (failures.length) {\n  console.error('Production runtime boundary check failed:')\n  failures.forEach((failure) => console.error(\`- \${failure}\`))\n  process.exit(1)\n}\n\nconsole.log('Production runtime boundary check passed')\n`)

console.log('Final production runtime cleanup applied.')
