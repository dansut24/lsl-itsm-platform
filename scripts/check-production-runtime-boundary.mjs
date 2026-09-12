import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const forbiddenPaths = [
  'src/App.jsx',
  'src/services/demoAuth.js',
  'src/services/demoStore.js',
  'src/data/demoData.jsx',
  'src/legacy',
  'src/features/portal/SelfServicePortalApp.jsx',
  'src/production/ProductionLegacyBoundary.jsx',
]
const forbiddenTokens = [
  'demoData', 'demoStore', 'demoAuth', 'authenticateDemoUser',
  'seedTickets', 'seedProjects', 'seedRotaEntries', 'seedCalendarEvents', 'seedLiveChatConversations',
  'liveChatReplyOptions', 'ROTA_DEMO_', 'CALENDAR_DEMO_',
  'analyst@hi5central.com', 'employee@hi5central.com', 'rmm@hi5central.com',
  'Hi5Desk!2026', 'Hi5Portal!2026', 'Hi5RMM!2026',
  'Dana Sinclair', 'Eleanor Shaw', 'AGT-DANA', 'PRJ-0042', 'SITE-LON-HQ', 'KB5074211',
  'portal-demo-credentials', 'rmm-demo-login', 'Use demo employee', 'Use demo RMM account',
]

const failures = []
for (const relativePath of forbiddenPaths) {
  if (fs.existsSync(path.join(root, relativePath))) failures.push(`Forbidden active runtime path: ${relativePath}`)
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
  for (const token of forbiddenTokens) {
    if (content.includes(token)) failures.push(`${relative} contains forbidden runtime token: ${token}`)
  }
  if (/(^|[^a-z])demo([^a-z]|$)/i.test(content)) failures.push(`${relative} still contains demo vocabulary`)
  const withoutPrototypeMembers = content.replace(/\.prototype\b/g, '.__member__')
  if (/(^|[^a-z])prototype([^a-z]|$)/i.test(withoutPrototypeMembers)) failures.push(`${relative} still contains prototype vocabulary`)
  if (content.includes('archive/')) failures.push(`${relative} imports archived code`)
}

const workspaceRuntime = fs.readFileSync(path.join(root, 'src/runtime/WorkspaceRuntime.jsx'), 'utf8')
for (const token of ['PortalLoginScreen', 'RmmLoginScreen', 'SelfServicePortalApp', '<RmmPlatformApp', '<LoginScreen']) {
  if (workspaceRuntime.includes(token)) failures.push(`WorkspaceRuntime contains legacy surface reference: ${token}`)
}

for (const required of [
  'src/runtime/WorkspaceRuntime.jsx',
  'src/runtime/workspaceConfig.jsx',
  'src/services/runtimeState.js',
  'src/production/ProductionSessionBoundary.jsx',
  'archive/demo-runtime/src/App.jsx',
  'archive/demo-runtime/src/data/demoData.jsx',
  'archive/demo-runtime/src/services/demoStore.js',
]) {
  if (!fs.existsSync(path.join(root, required))) failures.push(`Missing production/archive boundary file: ${required}`)
}

if (failures.length) {
  console.error('Production runtime boundary check failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Production runtime boundary check passed')
