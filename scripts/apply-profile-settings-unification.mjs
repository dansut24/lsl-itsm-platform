import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function write(path, content) {
  fs.writeFileSync(path, content)
  console.log(`updated ${path}`)
}

function replaceRequired(content, search, replacement, label) {
  if (!content.includes(search)) throw new Error(`Missing expected source for ${label}`)
  return content.replace(search, replacement)
}

function replaceRegexRequired(content, regex, replacement, label) {
  if (!regex.test(content)) throw new Error(`Missing expected source for ${label}`)
  return content.replace(regex, replacement)
}

// API: register a session-scoped profile endpoint that does not require tenant-settings permission.
{
  const path = 'api/src/settings.js'
  let content = read(path)
  content = replaceRequired(
    content,
    "import { registerNotificationRoutes } from './notifications.js'\n",
    "import { registerNotificationRoutes } from './notifications.js'\nimport { registerProfileRoutes } from './profile.js'\n",
    'profile route import',
  )
  content = replaceRequired(
    content,
    '  registerAccessRoutes(app)\n  registerUserPreferenceRoutes(app)\n',
    '  registerAccessRoutes(app)\n  registerProfileRoutes(app)\n  registerUserPreferenceRoutes(app)\n',
    'profile route registration',
  )
  write(path, content)
}

// Routing: Profile is a first-class workspace route. The old personal-settings URLs become aliases.
{
  const path = 'src/lib/routes.js'
  let content = read(path)
  const settingsMarker = "  '/settings': {\n"
  const profileRoute = "  '/profile': {\n    kind: 'workspace',\n    path: '/profile',\n    viewId: 'profile',\n    key: 'profile',\n    title: 'Profile',\n  },\n"
  content = replaceRequired(content, settingsMarker, `${profileRoute}${settingsMarker}`, 'profile route')
  content = replaceRegexRequired(
    content,
    /  '\/settings\/workspace': \{[\s\S]*?  \},\n  '\/settings\/profile': \{[\s\S]*?  \},\n/,
    '',
    'legacy settings workspace/profile routes',
  )
  content = replaceRequired(
    content,
    "const ALIASES = {\n  '/home': '/dashboard',\n  '/self-service': '/portal',\n}",
    "const ALIASES = {\n  '/home': '/dashboard',\n  '/self-service': '/portal',\n  '/settings/workspace': '/profile',\n  '/settings/profile': '/profile',\n}",
    'profile aliases',
  )
  content = replaceRequired(
    content,
    "    reports: '/reports',\n    settings: '/settings/appearance',\n",
    "    reports: '/reports',\n    settings: '/settings/appearance',\n    profile: '/profile',\n",
    'profile pathForTab mapping',
  )
  write(path, content)
}

// Workspace metadata: Profile is available as a routable tab but not a tenant-admin nav item.
{
  const path = 'src/runtime/workspaceConfig.jsx'
  let content = read(path)
  content = replaceRequired(
    content,
    "  settings: { id: 'settings', label: 'Settings', icon: Settings },\n",
    "  settings: { id: 'settings', label: 'Settings', icon: Settings },\n  profile: { id: 'profile', label: 'Profile', icon: Users },\n",
    'profile view metadata',
  )
  write(path, content)
}

// Remove the old personal Settings implementation from active workspace views.
{
  const path = 'src/features/workspace/WorkspaceViews.jsx'
  let content = read(path)
  content = replaceRegexRequired(
    content,
    /export function SettingsView\(\{[\s\S]*?\n\}\n\nfunction MetricCard/,
    'function MetricCard',
    'legacy SettingsView',
  )
  content = replaceRegexRequired(
    content,
    /  const quickLinks = \[\n    \.\.\.navItems\.filter\(\(item\) => item\.id !== 'settings'\),\n    \{ id: 'settings', label: 'Settings' \},\n  \]/,
    '  const quickLinks = navItems',
    'permission-safe launcher links',
  )
  write(path, content)
}

// Workspace runtime: no hidden SettingsView fallback; navigation reflects effective settings permission.
{
  const path = 'src/runtime/WorkspaceRuntime.jsx'
  let content = read(path)
  content = content.replace(/\n\s*SettingsView,/, '')
  content = replaceRegexRequired(
    content,
    /\nconst settingsSectionTitles = \{[\s\S]*?\n\}\n/,
    '\n',
    'settings section titles',
  )
  content = replaceRequired(
    content,
    "import './WorkspaceRuntime.css'\n",
    `import './WorkspaceRuntime.css'\n\nfunction sessionHasPermission(session, permission) {\n  const effective = session?.access?.effectivePermissions || []\n  const grants = session?.access?.permissions || []\n  if (effective.includes(permission) || grants.includes('*') || grants.includes(permission)) return true\n  return grants.some((grant) => grant.endsWith('*') && permission.startsWith(grant.slice(0, -1)))\n}\n`,
    'workspace permission helper',
  )
  content = replaceRequired(
    content,
    "  const navItems = analystNavIds.map((id) => viewMeta[id])\n  const navGroups = analystNavGroups.map((group) => ({\n    ...group,\n    items: group.items.map((id) => viewMeta[id]),\n  }))\n",
    "  const canViewSettings = sessionHasPermission(session, 'settings.view')\n  const visibleNavIds = analystNavIds.filter((id) => id !== 'settings' || canViewSettings)\n  const navItems = visibleNavIds.map((id) => viewMeta[id])\n  const navGroups = analystNavGroups\n    .map((group) => ({\n      ...group,\n      items: group.items.filter((id) => id !== 'settings' || canViewSettings).map((id) => viewMeta[id]),\n    }))\n    .filter((group) => group.items.length)\n",
    'permission-aware navigation',
  )
  content = replaceRequired(
    content,
    "        key: 'settings-appearance',\n        title: 'Appearance',\n        settingsSection: 'appearance',\n",
    "        key: 'settings-appearance',\n        title: 'Settings',\n        settingsSection: 'appearance',\n",
    'canonical settings tab title',
  )
  content = replaceRegexRequired(
    content,
    /\n  function openSettingsSection\(section\) \{[\s\S]*?\n  \}\n\n  function openPortalRequest/,
    '\n\n  function openPortalRequest',
    'legacy settings section opener',
  )
  content = replaceRegexRequired(
    content,
    /    return \(\n      <SettingsView[\s\S]*?\n      \/>\n    \)\n  \}/,
    "    return null\n  }",
    'legacy settings renderer',
  )
  write(path, content)
}

// Bootstrap: Settings is permission-gated; personal preferences live under Profile.
{
  const path = 'src/production/ProductionWorkspaceBootstrap.jsx'
  let content = read(path)
  content = replaceRequired(
    content,
    "import { ProductionSettingsWorkspace } from '../features/settings/ProductionSettingsWorkspace.jsx'\n",
    "import { ProductionSettingsWorkspace } from '../features/settings/ProductionSettingsWorkspace.jsx'\nimport { ProductionIdentityBridge } from './ProductionIdentityBridge.jsx'\nimport { ProductionProfileWorkspace } from './ProductionProfileWorkspace.jsx'\n",
    'production profile imports',
  )
  content = content.replace('  loadSidebarMode,\n', '').replace('  saveSidebarMode,\n', '')
  content = replaceRequired(
    content,
    "function effectiveSettings(apiSession) {\n  return apiSession?.settings && Object.keys(apiSession.settings).length\n    ? apiSession.settings\n    : apiSession?.onboarding?.data || {}\n}\n",
    "function effectiveSettings(apiSession) {\n  return apiSession?.settings && Object.keys(apiSession.settings).length\n    ? apiSession.settings\n    : apiSession?.onboarding?.data || {}\n}\n\nfunction sessionHasPermission(apiSession, permission) {\n  const effective = apiSession?.access?.effectivePermissions || []\n  const grants = apiSession?.access?.permissions || []\n  if (effective.includes(permission) || grants.includes('*') || grants.includes(permission)) return true\n  return grants.some((grant) => grant.endsWith('*') && permission.startsWith(grant.slice(0, -1)))\n}\n",
    'bootstrap permission helper',
  )
  content = replaceRequired(
    content,
    "    user: apiSession.user,\n    onboarding: apiSession.onboarding,\n",
    "    user: apiSession.user,\n    access: apiSession.access,\n    security: apiSession.security,\n    onboarding: apiSession.onboarding,\n",
    'workspace session access data',
  )
  content = replaceRegexRequired(
    content,
    /\nfunction WorkspaceSidebarPreferenceCard\(\) \{[\s\S]*?\nfunction ProductionSettingsLayer/,
    '\nfunction ProductionSettingsLayer',
    'legacy personal preference settings layer',
  )
  content = replaceRequired(
    content,
    "  return createPortal(\n    <>\n      <ProductionSettingsWorkspace\n        currentPath={currentPath}\n        onSessionChange={onSessionChange}\n        session={session}\n      />\n      <WorkspaceSidebarPreferenceLayer currentPath={currentPath} />\n    </>,\n    target,\n  )\n}\n",
    "  return createPortal(\n    <ProductionSettingsWorkspace\n      currentPath={currentPath}\n      onSessionChange={onSessionChange}\n      session={session}\n    />,\n    target,\n  )\n}\n\nfunction ProductionProfileLayer({ session }) {\n  const [target, setTarget] = useState(null)\n\n  useEffect(() => {\n    let mountedTarget = null\n    const attach = () => {\n      const nextTarget = document.querySelector('.content-frame')\n      if (!(nextTarget instanceof HTMLElement)) return false\n      if (mountedTarget && mountedTarget !== nextTarget) mountedTarget.classList.remove('production-profile-mounted')\n      mountedTarget = nextTarget\n      mountedTarget.classList.add('production-profile-mounted')\n      setTarget(nextTarget)\n      return true\n    }\n    if (attach()) return () => mountedTarget?.classList.remove('production-profile-mounted')\n    const observer = new MutationObserver(() => { if (attach()) observer.disconnect() })\n    observer.observe(document.body, { childList: true, subtree: true })\n    return () => {\n      observer.disconnect()\n      mountedTarget?.classList.remove('production-profile-mounted')\n    }\n  }, [])\n\n  if (!target) return null\n  return createPortal(<ProductionProfileWorkspace session={session} />, target)\n}\n",
    'profile content layer',
  )
  content = replaceRequired(
    content,
    "  useEffect(() => {\n    if (!serverSession) return\n\n    applyTenantPreferences(serverSession)\n",
    "  useEffect(() => {\n    if (!serverSession) return\n\n    applyTenantPreferences(serverSession)\n",
    'bootstrap session effect anchor',
  )
  const redirectAnchor = "  useEffect(() => {\n    if (!serverSession?.onboarding?.completedAt) return undefined\n\n    let closing = false\n"
  const redirectEffect = `  useEffect(() => {\n    if (!serverSession?.onboarding?.completedAt) return\n    const oldPersonalSettings = currentPath === '/settings/profile' || currentPath === '/settings/workspace'\n    const deniedTenantSettings = currentPath.startsWith('/settings') && !sessionHasPermission(serverSession, 'settings.view')\n    if (!oldPersonalSettings && !deniedTenantSettings) return\n    if (window.location.pathname === '/profile') return\n    window.history.replaceState({}, '', '/profile')\n    setCurrentPath('/profile')\n    window.dispatchEvent(new PopStateEvent('popstate'))\n    window.dispatchEvent(new CustomEvent('hi5-routechange', { detail: { path: '/profile', replace: true } }))\n  }, [currentPath, serverSession])\n\n`
  content = replaceRequired(content, redirectAnchor, `${redirectEffect}${redirectAnchor}`, 'settings/profile redirect guard')
  content = replaceRequired(
    content,
    "    const settingsOpen = currentPath === '/settings' || currentPath.startsWith('/settings/')\n    const themeKey = effectiveSettings(serverSession)?.theme || {}\n",
    "    const canViewSettings = sessionHasPermission(serverSession, 'settings.view')\n    const settingsOpen = canViewSettings && (currentPath === '/settings' || currentPath.startsWith('/settings/'))\n    const profileOpen = currentPath === '/profile'\n    const themeKey = effectiveSettings(serverSession)?.theme || {}\n",
    'profile/settings render state',
  )
  content = replaceRequired(
    content,
    "        <WorkspaceRuntime key={workspaceKey} />\n        {settingsOpen ? (\n",
    "        <WorkspaceRuntime key={workspaceKey} />\n        <ProductionIdentityBridge session={serverSession} />\n        {settingsOpen ? (\n",
    'identity bridge mount',
  )
  content = replaceRequired(
    content,
    "        ) : null}\n      </>\n",
    "        ) : null}\n        {profileOpen ? <ProductionProfileLayer session={serverSession} /> : null}\n      </>\n",
    'profile layer mount',
  )
  write(path, content)
}

// Permanent production guard: the old active SettingsView must never return.
{
  const path = 'scripts/check-production-runtime-boundary.mjs'
  let content = read(path)
  content = replaceRequired(
    content,
    "  'portal-demo-credentials', 'rmm-demo-login', 'Use demo employee', 'Use demo RMM account',\n",
    "  'portal-demo-credentials', 'rmm-demo-login', 'Use demo employee', 'Use demo RMM account',\n  'export function SettingsView(',\n",
    'SettingsView boundary token',
  )
  content = replaceRequired(
    content,
    "  'src/production/ProductionSessionBoundary.jsx',\n",
    "  'src/production/ProductionSessionBoundary.jsx',\n  'src/production/ProductionProfileWorkspace.jsx',\n  'src/production/ProductionIdentityBridge.jsx',\n  'api/src/profile.js',\n",
    'profile boundary required files',
  )
  write(path, content)
}

console.log('Profile/settings unification source migration complete.')
