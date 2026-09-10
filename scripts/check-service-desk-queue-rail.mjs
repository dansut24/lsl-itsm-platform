import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const main = read('src/main.jsx')
const rail = read('src/production/ProductionServiceDeskQueueRail.jsx')
const css = read('src/production/ProductionServiceDeskQueueRail.css')

const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

expect(main.includes("ProductionServiceDeskQueueRail } from './production/ProductionServiceDeskQueueRail.jsx'"), 'Queue rail component must be imported')
expect(main.includes('<ProductionServiceDeskQueueRail />'), 'Queue rail component must be mounted')
expect(main.includes("./production/ProductionServiceDeskQueueRail.css"), 'Queue rail CSS must be loaded after List v2')

for (const label of ['All', 'Unassigned', 'High priority', 'Needs attention', 'Updated today']) {
  expect(rail.includes(`'${label}'`), `Queue rail must retain ${label} view`)
}
expect(rail.includes('hi5-list-filter-select select'), 'Queue rail must reuse List v2 status/priority filter state')
expect(rail.includes("host?.querySelector('.hi5-list-save-view')?.click()"), 'Saved-view creation must remain available from the rail')
expect(rail.includes('hi5-queue-rail-mobile-trigger'), 'Mobile must expose Views & filters without permanent width')
expect(rail.includes('hi5-queue-rail-mobile-layer'), 'Mobile queue rail must open as an off-canvas layer')

expect(css.includes('.hi5-service-desk-v2.has-queue-rail > .hi5-list-views-row') && css.includes('display: none !important'), 'Old horizontal view pills must be hidden')
expect(css.includes('@media (min-width: 761px)') && css.includes('padding-left: 224px'), 'Desktop must reserve a permanent queue rail')
expect(css.includes('.hi5-queue-rail-views > button.is-active::before'), 'Selected queue view must use the professional accent-edge treatment')
expect(css.includes('@media (max-width: 760px)') && css.includes('.hi5-queue-rail-mobile-trigger'), 'Mobile must use the compact queue rail trigger')
expect(css.includes('rgb(var(--accent-rgb'), 'Queue rail must remain tenant-accent aware')
expect(css.includes('@media (prefers-reduced-motion: reduce)'), 'Queue rail must respect reduced motion')

if (failures.length) {
  console.error('Service Desk queue rail contract failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Service Desk queue rail contract passed.')
