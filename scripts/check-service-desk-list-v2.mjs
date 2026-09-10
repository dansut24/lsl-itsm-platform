import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const main = read('src/main.jsx')
const list = read('src/production/ProductionServiceDeskListV2.jsx')
const css = read('src/production/ProductionServiceDeskListV2.css')
const guard = read('src/production/ProductionServiceDeskListV2Final.css')

const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

expect(main.includes("ProductionServiceDeskListV2 } from './production/ProductionServiceDeskListV2.jsx'"), 'Service Desk List v2 component must be imported')
expect(main.includes('<ProductionServiceDeskListV2 />'), 'Service Desk List v2 must be mounted')
expect(main.includes("./production/ProductionServiceDeskListV2.css"), 'Service Desk List v2 CSS must be loaded')
expect(main.includes("./production/ProductionServiceDeskListV2Final.css"), 'Service Desk List final layout guard must be loaded')

for (const route of ['incidents', 'requests', 'problems', 'changes']) {
  expect(list.includes(route), `List v2 must support ${route}`)
}
for (const feature of ['savedViews', 'toggleSort', 'toggleSelected', 'toggleColumn', 'reorderColumn', 'beginResize', 'openSelected']) {
  expect(list.includes(feature), `List v2 is missing ${feature}`)
}
expect(list.includes('fetchProductionItsmWorkspaceRecords'), 'List v2 must use production ITSM records')
expect(list.includes('window.sessionStorage.setItem(`${LIST_STATE_KEY}:scroll:'), 'List scroll position must be preserved')
expect(list.includes('window.sessionStorage.setItem(`${RETURN_KEY}:'), 'Returning from a record must retain row context')
expect(list.includes("openLabel: 'Open in tab'"), 'Record quick preview must support Open in tab')
expect(list.includes("openLabel: 'Open People'"), 'Person/assignment quick preview must support People workspace')
expect(list.includes('hi5-list-mobile-cards'), 'Purpose-built mobile record cards are missing')
expect(list.includes('hi5-list-columns-popover'), 'Column chooser is missing')
expect(list.includes('draggable'), 'Column reorder interaction is missing')
expect(list.includes('hi5-list-selection-bar'), 'Bulk selection action bar is missing')
expect(list.includes("['attention', 'Needs attention']"), 'Needs-attention quick filter is missing')
expect(list.includes("['today', 'Updated today']"), 'Updated-today quick filter is missing')

expect(css.includes('.hi5-list-table thead') && css.includes('position: sticky'), 'Desktop table header must remain sticky')
expect(css.includes('.hi5-list-resizer'), 'Desktop column resize affordance is missing')
expect(css.includes('@media (max-width: 760px)') && css.includes('.hi5-list-table-wrap { display:none; }'), 'Mobile must switch away from desktop table')
expect(css.includes('.hi5-list-mobile-cards { display:grid;'), 'Mobile cards must be enabled at compact widths')
expect(css.includes('scrollbar-width:none') && css.includes('::-webkit-scrollbar'), 'Touch filter/selection scrollbars must stay hidden')
expect(css.includes('rgb(var(--accent-rgb))'), 'Tenant accent variables must drive List v2')
expect(css.includes('.hi5-list-preview'), 'Universal list quick preview surface is missing')
expect(css.includes('@media (prefers-reduced-motion: reduce)'), 'List v2 must respect reduced motion')
expect(guard.includes('grid-row: 6'), 'List scroll viewport placement guard is missing')
expect(guard.includes('production-itsm-queue-mounted.production-service-desk-v2-mounted > .hi5-service-desk-v2'), 'List v2 must override the legacy queue visibility rule')
expect(guard.includes('> .production-record-shell') && guard.includes('display: none !important'), 'Legacy production queue shell must be hidden while List v2 owns the route')

if (failures.length) {
  console.error('Service Desk List v2 contract failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Service Desk List v2 contract passed.')
