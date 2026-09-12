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
  'openProfile()',
  "'/profile'",
  'settings.view',
  'production-account-chip',
])
expectFile('src/production/ProductionProfileWorkspace.jsx', [
  '/api/v1/profile',
  '/api/v1/user-preferences',
  'ProductionProfileSecurity',
  'Signed in as',
  'Assigned access roles',
  'Personal appearance',
  'Workspace preferences',
])
expectFile('src/production/ProductionProfileSecurity.jsx', [
  "'/api/v1/mfa/status'",
  "'/api/v1/mfa/setup'",
  "'/api/v1/mfa/confirm'",
  "'/api/v1/mfa/recovery-codes'",
  "'/api/v1/security/password/change'",
  "'/api/v1/security/sessions'",
  "'/api/v1/security/sessions/revoke-others'",
  "'/api/v1/security/mfa/remove'",
  'Personal security',
  'My multi-factor authentication',
  'My password',
  'My active sessions',
], [
  '/api/v1/security/audit',
  '/settings/security-mfa',
])
expectFile('src/features/settings/ProductionSettingsWorkspace.jsx', [
  'ProductionTenantSecurityAudit',
  "label: 'Security policy'",
  'Tenant-wide authentication, session, password and audit controls.',
  'Require administrator MFA',
], [
  'Your multi-factor authentication',
  'Password & account security',
  'Active sessions',
  '/api/v1/mfa/setup',
  '/api/v1/security/password/change',
  '/api/v1/security/sessions/revoke-others',
  '/api/v1/security/mfa/remove',
])
expectFile('src/features/settings/ProductionTenantSecurityAudit.jsx', [
  '/api/v1/security/audit?limit=80',
  'Tenant security audit',
], [
  '/api/v1/mfa/setup',
  '/api/v1/security/password/change',
])
expectFile('src/main.jsx', [], [
  'ProductionMfaSettingsEnhancer',
  'ProductionSecurityCenterEnhancer',
])
expectFile('api/src/settings.js', [
  'registerProfileRoutes',
  'registerProfileRoutes(app)',
])
expectFile('api/src/profile.js', [
  "app.get('/api/v1/profile'",
  'organisation_people',
  'organisation_team_memberships',
])
expectFile('api/src/security.js', [
  "hasPermission(session.access, permission)",
  "requireSession(c, 'settings.security.manage')",
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
