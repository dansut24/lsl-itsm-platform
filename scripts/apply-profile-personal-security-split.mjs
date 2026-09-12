import fs from 'node:fs'

function read(path) { return fs.readFileSync(path, 'utf8') }
function write(path, content) { fs.writeFileSync(path, content) }
function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Could not find ${label}`)
  return source.replace(search, replacement)
}

// Remove the two legacy personal-security enhancers from the root runtime.
{
  const path = 'src/main.jsx'
  let source = read(path)
  source = source.replace("import { ProductionMfaSettingsEnhancer } from './features/security/ProductionMfaSettingsEnhancer.jsx'\n", '')
  source = source.replace("import { ProductionSecurityCenterEnhancer } from './features/security/ProductionSecurityCenterEnhancer.jsx'\n", '')
  source = source.replace("    {productionWorkspace && !productionOnboarding ? <ProductionMfaSettingsEnhancer /> : null}\n", '')
  source = source.replace("    {productionWorkspace && !productionOnboarding ? <ProductionSecurityCenterEnhancer /> : null}\n", '')
  write(path, source)
}

// Make personal security a first-class part of Profile.
{
  const path = 'src/production/ProductionProfileWorkspace.jsx'
  let source = read(path)
  source = replaceOnce(
    source,
    "import './ProductionProfileWorkspace.css'",
    "import { ProductionProfileSecurity } from './ProductionProfileSecurity.jsx'\nimport './ProductionProfileWorkspace.css'",
    'Profile security import',
  )
  source = replaceOnce(
    source,
    'Your signed-in identity, organisation details and personal workspace preferences.',
    'Your signed-in identity, personal security and workspace preferences.',
    'Profile description',
  )
  source = replaceOnce(
    source,
    '              <Section title="Personal appearance" description="These settings affect only your account. Tenant branding remains under tenant Settings.">',
    '              <ProductionProfileSecurity />\n\n              <Section title="Personal appearance" description="These settings affect only your account. Tenant branding remains under tenant Settings.">',
    'Profile personal appearance section',
  )
  write(path, source)
}

// Keep tenant Settings strictly administrative: policy + tenant audit only.
{
  const path = 'src/features/settings/ProductionSettingsWorkspace.jsx'
  let source = read(path)
  source = replaceOnce(
    source,
    "import './ProductionSettingsWorkspace.css'",
    "import { ProductionTenantSecurityAudit } from './ProductionTenantSecurityAudit.jsx'\nimport './ProductionSettingsWorkspace.css'",
    'tenant security audit import',
  )
  source = source.replace("label: 'Security & MFA'", "label: 'Security policy'")
  const securityStart = source.indexOf('function Security({ config, update })')
  const securityEnd = source.indexOf('\n\nfunction ItsmNumbering', securityStart)
  if (securityStart < 0 || securityEnd < 0) throw new Error('Could not locate tenant Security component')
  const replacement = `function Security({ config, update }) {
  return <>
    <Panel title="Security policy" description="Tenant-wide authentication, session, password and audit controls. Personal account security is managed from Profile.">
      <div className="production-settings-toggle-list">
        <Toggle
          checked={Boolean(config.requireMfa)}
          onChange={(value) => update('requireMfa', value)}
          title="Require administrator MFA"
          description="Require tenant owners and administrators to complete authenticator MFA. This policy is enforced by the production authentication service."
        />
      </div>
      <div className="production-settings-grid">
        <Field label="Session length"><select value={config.sessionHours || '12'} onChange={(event) => update('sessionHours', event.target.value)}><option value="8">8 hours</option><option value="12">12 hours</option><option value="24">24 hours</option></select></Field>
        <Field label="Password policy"><select value={config.passwordPolicy || 'strong'} onChange={(event) => update('passwordPolicy', event.target.value)}><option value="strong">Strong</option><option value="standard">Standard</option></select></Field>
        <Field label="Audit retention"><select value={config.auditRetention || '365'} onChange={(event) => update('auditRetention', event.target.value)}><option value="90">90 days</option><option value="365">365 days</option><option value="730">730 days</option></select></Field>
      </div>
    </Panel>
    <ProductionTenantSecurityAudit />
  </>
}`
  source = `${source.slice(0, securityStart)}${replacement}${source.slice(securityEnd)}`
  write(path, source)
}

// Security audit follows the granular Settings permission model rather than a hard-coded role check.
{
  const path = 'api/src/security.js'
  let source = read(path)
  if (!source.includes("import { hasPermission } from './access.js'")) {
    source = `import { hasPermission } from './access.js'\n${source}`
  }
  const requireStart = source.indexOf('async function requireSession(c, admin = false)')
  const requireEnd = source.indexOf('\n\nasync function rateLimit', requireStart)
  if (requireStart < 0 || requireEnd < 0) throw new Error('Could not locate security requireSession helper')
  const requireReplacement = `async function requireSession(c, permission = null) {
  const session = await resolveSession(c)
  if (!session) return { error: c.json({ error: 'Authentication required.' }, 401) }
  if (!originMatchesTenant(c, session.slug)) return { error: c.json({ error: 'Tenant session mismatch.' }, 403) }
  if (permission && !hasPermission(session.access, permission)) {
    return { error: c.json({ error: 'You do not have permission to view this tenant security information.', permission }, 403) }
  }
  return { session }
}`
  source = `${source.slice(0, requireStart)}${requireReplacement}${source.slice(requireEnd)}`
  source = replaceOnce(
    source,
    "const auth = await requireSession(c, true)",
    "const auth = await requireSession(c, 'settings.security.manage')",
    'tenant security audit permission',
  )
  write(path, source)
}

// Strengthen the permanent contract so personal security cannot drift back into Settings.
{
  const path = 'scripts/check-profile-settings-contract.mjs'
  const source = `import fs from 'node:fs'

const checks = []
function expectFile(path, includes = [], excludes = []) {
  const content = fs.readFileSync(path, 'utf8')
  for (const token of includes) {
    if (!content.includes(token)) checks.push(\`${'${path}'} is missing required contract token: ${'${token}'}\`)
  }
  for (const token of excludes) {
    if (content.includes(token)) checks.push(\`${'${path}'} contains forbidden contract token: ${'${token}'}\`)
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
  checks.forEach((failure) => console.error(\`- ${'${failure}'}\`))
  process.exit(1)
}

console.log('Profile/settings contract check passed')
`
  write(path, source)
}

console.log('Profile personal-security split applied')
