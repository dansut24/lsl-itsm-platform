import fs from 'node:fs'

const checks = []
function expectFile(path, includes = [], excludes = []) {
  const content = fs.readFileSync(path, 'utf8')
  for (const token of includes) {
    if (!content.includes(token)) checks.push(`${path} is missing required contract token: ${token}`)
  }
  for (const token of excludes) {
    if (content.includes(token)) checks.push(`${path} contains forbidden contract token: ${token}`)
  }
}

expectFile('src/features/workspace/WorkspaceViews.jsx', [], [
  'export function SettingsView(',
  'Personalisation',
])
expectFile('src/runtime/WorkspaceRuntime.jsx', [
  "sessionHasPermission(session, 'settings.view')",
  "activeView === 'profile'",
], [
  'SettingsView',
  'openSettingsSection',
])
expectFile('src/lib/routes.js', [
  "'/profile': {",
  "viewId: 'profile'",
  "'/settings/workspace': '/profile'",
  "'/settings/profile': '/profile'",
  "profile: '/profile'",
])
expectFile('src/production/ProductionWorkspaceBootstrap.jsx', [
  'ProductionIdentityBridge',
  'ProductionProfileWorkspace',
  "sessionHasPermission(serverSession, 'settings.view')",
  "const profileOpen = currentPath === '/profile'",
  "currentPath === '/settings/profile'",
  "currentPath === '/settings/workspace'",
])
expectFile('src/production/ProductionIdentityBridge.jsx', [
  "openProfile()",
  "'/profile'",
  "settings.view",
  'production-account-chip',
])
expectFile('src/production/ProductionProfileWorkspace.jsx', [
  '/api/v1/profile',
  '/api/v1/user-preferences',
  'Signed in as',
  'Assigned access roles',
  'Personal appearance',
  'Workspace preferences',
])
expectFile('api/src/settings.js', [
  "registerProfileRoutes",
  'registerProfileRoutes(app)',
])
expectFile('api/src/profile.js', [
  "app.get('/api/v1/profile'",
  'organisation_people',
  'organisation_team_memberships',
])
expectFile('scripts/check-production-runtime-boundary.mjs', [
  "'export function SettingsView('",
  "'src/production/ProductionProfileWorkspace.jsx'",
  "'src/production/ProductionIdentityBridge.jsx'",
])

if (checks.length) {
  console.error('Profile/settings contract check failed:')
  checks.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Profile/settings contract check passed')
