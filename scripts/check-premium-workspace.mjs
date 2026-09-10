import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const main = read('src/main.jsx')
const tabs = read('src/production/ProductionWorkspaceTabBehaviour.css')
const masthead = read('src/production/ProductionSharedRecordMasthead.css')
const premium = read('src/production/ProductionPremiumWorkspace.css')
const enhancer = read('src/production/ProductionRecordExperienceEnhancer.jsx')

const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

expect(main.includes("ProductionRecordExperienceEnhancer"), 'Premium record enhancer must be mounted')
expect(main.includes("ProductionPremiumWorkspace.css"), 'Premium workspace CSS must be loaded')
expect(tabs.includes('scrollbar-width: none') && tabs.includes('::-webkit-scrollbar'), 'Touch tab scrollbar must remain hidden')
expect(tabs.includes('@media (hover: hover) and (pointer: fine)') && tabs.includes('overflow-x: hidden !important'), 'Desktop tabs must never horizontally scroll')
expect(tabs.includes('flex: 1 1 0 !important'), 'Desktop tabs must compress to available width')
expect(masthead.includes('.activity-canvas-mobile-details') && masthead.includes('font-size: 0 !important'), 'Record inspector control must remain icon-only on compact records')
expect(premium.includes('.production-workspace-tab.is-active') && premium.includes('box-shadow'), 'Selected tab depth treatment is missing')
expect(premium.includes('@keyframes hi5-record-enter'), 'Record transition animation is missing')
expect(premium.includes('.activity-canvas-skeleton::after'), 'Premium loading shimmer is missing')
expect(enhancer.includes('Back to ${context.label}') && enhancer.includes('production-record-back'), 'Shared back-to-list control is missing')
expect(enhancer.includes('service-request-task') && enhancer.includes('personPreview'), 'Task/person quick previews are missing')
expect(enhancer.includes("openLabel: 'Open People'") && enhancer.includes('openPath'), 'Quick previews must support opening full workspaces')
expect(enhancer.includes('hi5central-onboarding-arrival-v1'), 'Onboarding handoff marker is missing')

if (failures.length) {
  console.error('Premium workspace contract failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log('Premium workspace contract passed.')
