import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const main = read('src/main.jsx')
const experience = read('src/production/ProductionPremiumWorkspaceExperience.jsx')
const premium = read('src/production/ProductionPremiumWorkspaceExperience.css')
const tabs = read('src/production/ProductionWorkspaceTabBehaviour.css')
const masthead = read('src/production/ProductionSharedRecordMasthead.css')
const onboarding = read('src/production/ProductionOnboardingBootstrap.jsx')

const failures = []
const expect = (condition, message) => {
  if (!condition) failures.push(message)
}

expect(main.includes("ProductionPremiumWorkspaceExperience } from './production/ProductionPremiumWorkspaceExperience.jsx'"), 'Premium workspace component must be imported')
expect(main.includes('<ProductionPremiumWorkspaceExperience />'), 'Premium workspace component must be mounted')
expect(main.includes("./production/ProductionPremiumWorkspaceExperience.css"), 'Premium workspace CSS must be imported')
expect(main.indexOf("./production/ProductionPremiumWorkspaceExperience.css") > main.indexOf("./production/ProductionSharedRecordMasthead.css"), 'Premium visual layer must load after shared masthead rules')

expect(experience.includes("const PREVIEWABLE_ROWS = new Set"), 'Shared inspector quick-preview contract is missing')
for (const label of ['Requester', 'Assignment', 'Tasks', 'Approvals', 'Items & cost', 'Relationships', 'Attachments']) {
  expect(experience.includes(`'${label}'`), `Quick preview must support ${label}`)
}
expect(experience.includes("openLabel: 'Open People'"), 'Person preview must offer an internal workspace action')
expect(experience.includes("openLabel: 'Open record'"), 'Related-record preview must offer Open in tab')
expect(experience.includes("window.history.pushState({}, '', path)"), 'Quick preview/back navigation must reuse the internal workspace route engine')
expect(experience.includes("new PopStateEvent('popstate'"), 'Internal preview navigation must wake the existing tab engine')
expect(experience.includes('hi5-record-back-button'), 'Shared record-list back control is missing')
expect(experience.includes("listPath: `/${section}`"), 'Back control must resolve the relevant record list')
expect(experience.includes("active.offsetLeft - Math.max(0, (scroller.clientWidth - active.offsetWidth) / 2)"), 'Touch active tabs must auto-centre into view')
expect(experience.includes("target.animate(["), 'Workspace switching transition is missing')
expect(experience.includes('consumeOnboardingHandoff'), 'First-run dashboard handoff is missing')

expect(premium.includes('.production-workspace-tab.is-active'), 'Selected-tab depth styling is missing')
expect(premium.includes('translateY(-1px)'), 'Selected tab must have subtle raised depth')
expect(premium.includes('.hi5-quick-preview'), 'Quick preview floating surface styles are missing')
expect(premium.includes('.hi5-first-run-card'), 'First-run handoff styles are missing')
expect(premium.includes('.activity-canvas-empty'), 'Shared empty-state polish is missing')
expect(premium.includes('.activity-canvas-skeleton'), 'Shared loading-state polish is missing')
expect(premium.includes('@media (prefers-reduced-motion: reduce)'), 'Motion must respect reduced-motion preferences')

expect(tabs.includes('scrollbar-width: none !important'), 'Touch tab scrollbar must remain hidden')
expect(tabs.includes('overflow-x: hidden !important'), 'Desktop tab rail must remain non-scrollable')
expect(tabs.includes('flex: 1 1 0 !important'), 'Desktop tabs must compress instead of scroll')
expect(masthead.includes('.activity-canvas-mobile-details'), 'Shared record inspector icon treatment is missing')
expect(masthead.includes('font-size: 0 !important'), 'Mobile inspector control must remain icon-only')

expect(onboarding.includes("const ONBOARDING_HANDOFF_KEY = 'hi5central-onboarding-handoff-v1'"), 'Onboarding handoff key is missing')
expect(onboarding.includes('markOnboardingHandoff(nextSession)'), 'Successful onboarding must mark the dashboard handoff')
expect(onboarding.includes("window.location.replace('/dashboard')"), 'Successful onboarding must still land on Dashboard')

if (failures.length) {
  console.error('Premium workspace contract check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Premium workspace contract check passed.')
