import fs from 'node:fs'

function patch(path, transform) {
  const before = fs.readFileSync(path, 'utf8')
  const after = transform(before)
  if (after === before) throw new Error(`No changes were made to ${path}`)
  fs.writeFileSync(path, after)
  console.log(`updated ${path}`)
}

function replaceRequired(content, search, replacement, label) {
  if (!content.includes(search)) throw new Error(`Missing expected source for ${label}`)
  return content.replace(search, replacement)
}

patch('api/src/session.js', (source) => {
  let content = source
  content = replaceRequired(
    content,
    '            ts.modules,ts.onboarding_step,ts.onboarding_completed_at,ts.onboarding_data,ts.configuration,ts.tenant_url,ts.portal_url,ts.rmm_url\n     FROM auth_sessions s',
    '            ts.modules,ts.onboarding_step,ts.onboarding_completed_at,ts.onboarding_data,ts.configuration,ts.tenant_url,ts.portal_url,ts.rmm_url,\n            up.preferences AS user_preferences\n     FROM auth_sessions s',
    'session preference selection',
  )
  content = replaceRequired(
    content,
    '     JOIN tenant_settings ts ON ts.tenant_id=s.tenant_id\n     WHERE s.token_hash=$1',
    '     JOIN tenant_settings ts ON ts.tenant_id=s.tenant_id\n     LEFT JOIN user_preferences up ON up.tenant_id=s.tenant_id AND up.user_id=s.user_id\n     WHERE s.token_hash=$1',
    'session preference join',
  )
  content = replaceRequired(
    content,
    '    security: { mfaVerified: Boolean(session.mfa_verified_at) },\n    settings: configuration,\n',
    '    security: { mfaVerified: Boolean(session.mfa_verified_at) },\n    preferences: session.user_preferences || null,\n    settings: configuration,\n',
    'session preference payload',
  )
  return content
})

patch('src/production/ProductionWorkspaceBootstrap.jsx', (source) => {
  let content = source
  content = replaceRequired(
    content,
    '  saveAccent,\n  saveProductionSession,\n  saveTheme,\n',
    '  saveAccent,\n  saveDensity,\n  saveProductionSession,\n  saveSidebarMode,\n  saveTheme,\n',
    'runtime preference storage imports',
  )

  const oldFunction = `function applyTenantPreferences(apiSession) {\n  const configuration = effectiveSettings(apiSession)\n  const theme = configuration.theme || {}\n  const itsm = configuration.itsm || {}\n\n  if (['system', 'light', 'dark'].includes(theme.mode)) saveTheme(theme.mode)\n  if (['amber', 'cyan', 'blue', 'violet', 'emerald', 'rose'].includes(theme.accent)) saveAccent(theme.accent)\n\n  try {`
  const newFunction = `function applyTenantPreferences(apiSession) {\n  const configuration = effectiveSettings(apiSession)\n  const theme = configuration.theme || {}\n  const itsm = configuration.itsm || {}\n  const preferences = apiSession?.preferences || {}\n  const appearance = preferences.appearance || {}\n  const navigation = preferences.navigation || {}\n\n  const resolvedTheme = ['system', 'light', 'dark'].includes(appearance.theme)\n    ? appearance.theme\n    : theme.mode\n  const resolvedAccent = appearance.accentMode === 'personal'\n    && ['amber', 'cyan', 'blue', 'violet', 'emerald', 'rose'].includes(appearance.accent)\n      ? appearance.accent\n      : theme.accent\n\n  if (['system', 'light', 'dark'].includes(resolvedTheme)) saveTheme(resolvedTheme)\n  if (['amber', 'cyan', 'blue', 'violet', 'emerald', 'rose'].includes(resolvedAccent)) saveAccent(resolvedAccent)\n  if (['comfortable', 'compact'].includes(appearance.density)) saveDensity(appearance.density)\n  if (['expanded', 'collapsed', 'hidden'].includes(navigation.sidebarMode)) saveSidebarMode(navigation.sidebarMode)\n\n  try {`
  content = replaceRequired(content, oldFunction, newFunction, 'personal preference resolution')

  content = replaceRequired(
    content,
    '    security: apiSession.security,\n    onboarding: apiSession.onboarding,\n',
    '    security: apiSession.security,\n    preferences: apiSession.preferences || null,\n    onboarding: apiSession.onboarding,\n',
    'workspace session preferences',
  )

  content = replaceRequired(
    content,
    "    const themeKey = effectiveSettings(serverSession)?.theme || {}\n    const workspaceKey = `${themeKey.mode || 'system'}:${themeKey.accent || 'amber'}`\n",
    "    const themeKey = effectiveSettings(serverSession)?.theme || {}\n    const preferenceKey = serverSession?.preferences || {}\n    const appearanceKey = preferenceKey.appearance || {}\n    const navigationKey = preferenceKey.navigation || {}\n    const workspaceKey = [\n      appearanceKey.theme || themeKey.mode || 'system',\n      appearanceKey.accentMode === 'personal' ? (appearanceKey.accent || 'amber') : (themeKey.accent || 'amber'),\n      appearanceKey.density || 'comfortable',\n      navigationKey.sidebarMode || 'expanded',\n    ].join(':')\n",
    'preference-sensitive workspace key',
  )

  return content
})

console.log('Production profile preference hydration complete.')
