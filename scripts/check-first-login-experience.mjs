import fs from 'node:fs'

const main = fs.readFileSync('src/main.jsx', 'utf8')
const firstLogin = fs.readFileSync('src/production/ProductionFirstLoginExperience.jsx', 'utf8')
const firstLoginCss = fs.readFileSync('src/production/ProductionFirstLoginExperience.css', 'utf8')
const navPrefs = fs.readFileSync('src/production/ProductionNavigationDockPreferences.jsx', 'utf8')
const navStyles = fs.readFileSync('src/production/ProductionNavigationStyles.css', 'utf8')
const api = fs.readFileSync('api/src/userPreferences.js', 'utf8')
const settings = fs.readFileSync('api/src/settings.js', 'utf8')
const migration = fs.readFileSync('api/migrations/015_user_preferences.sql', 'utf8')

const requirements = [
  [main, 'ProductionFirstLoginExperience', 'First Login Experience is not mounted.'],
  [firstLogin, '/api/v1/user-preferences', 'First Login Experience is not backed by per-user preferences.'],
  [firstLogin, 'firstLoginComplete: true', 'First login completion is not persisted.'],
  [firstLogin, 'coachmarksComplete: true', 'Coach mark completion is not persisted.'],
  [firstLogin, 'gettingStartedDismissed: true', 'Getting Started dismissal is not persisted.'],
  [firstLogin, 'Use organisation accent', 'Tenant accent inheritance is missing.'],
  [firstLogin, 'Personal accent', 'Personal accent override is missing.'],
  [firstLogin, 'Floating glass', 'Floating navigation style is missing.'],
  [firstLogin, 'Clean panel', 'Clean navigation style is missing.'],
  [firstLogin, 'Sidebar left', 'Left sidebar preference is missing.'],
  [firstLogin, 'Sidebar right', 'Right sidebar preference is missing.'],
  [firstLogin, 'Mobile button right', 'Mobile accessibility-side preference is missing.'],
  [firstLogin, 'Admin setup centre', 'Role-aware Admin Setup Centre is missing.'],
  [firstLogin, 'COACH_STEPS', 'Contextual coach marks are missing.'],
  [firstLoginCss, '.hi5-first-login-layer', 'First login responsive visual system is missing.'],
  [firstLoginCss, '.hi5-getting-started-card', 'Getting Started surface is missing.'],
  [firstLoginCss, "@media (max-width: 760px)", 'First login mobile layout is missing.'],
  [navPrefs, 'NAV_STYLE_KEY', 'Navigation style is not persisted in Settings.'],
  [navPrefs, 'hi5NavStyle', 'Navigation style is not applied to the workspace shell.'],
  [navStyles, "data-hi5-nav-style='clean'", 'Clean sidebar visual treatment is missing.'],
  [api, "app.get('/api/v1/user-preferences'", 'User preference read API is missing.'],
  [api, "app.patch('/api/v1/user-preferences'", 'User preference write API is missing.'],
  [settings, 'registerUserPreferenceRoutes(app)', 'User preference routes are not registered.'],
  [migration, 'CREATE TABLE IF NOT EXISTS user_preferences', 'User preference migration is missing.'],
  [migration, 'first_login_completed_at', 'First login completion is not durable.'],
]

for (const [source, token, message] of requirements) {
  if (!source.includes(token)) throw new Error(message)
}

for (const forbidden of ['<ProductionServiceDeskListV2 />', '<ProductionServiceDeskQueueRail />']) {
  if (main.includes(forbidden)) throw new Error(`Crash-prone Service Desk overlay has returned: ${forbidden}`)
}

console.log('First Login Experience v1 contract passed.')
