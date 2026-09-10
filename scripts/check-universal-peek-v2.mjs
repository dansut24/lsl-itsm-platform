import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const main = read('src/main.jsx')
const peek = read('src/production/ProductionUniversalPeekV2.jsx')
const css = read('src/production/ProductionUniversalPeekV2.css')
const listGuard = read('src/production/ProductionServiceDeskListV2Final.css')

const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

expect(main.includes("ProductionUniversalPeekV2 } from './production/ProductionUniversalPeekV2.jsx'"), 'Universal Peek v2 must be imported')
expect(main.includes('<ProductionUniversalPeekV2 />'), 'Universal Peek v2 must be mounted')
expect(main.includes("./production/ProductionUniversalPeekV2.css"), 'Universal Peek v2 CSS must be loaded')
expect(peek.includes("const PEEK_EVENT = 'hi5-universal-peek'"), 'Universal Peek event contract is missing')
expect(peek.includes("window.__HI5_PEEK__"), 'Universal Peek programmatic API is missing')
for (const selector of ['.org-person-card', '.org-entity-card', '.org-site-card', '.asset-card', '.knowledge-card']) {
  expect(peek.includes(selector), `Universal Peek must cover ${selector}`)
}
for (const kind of ['Person', 'Team', 'Department', 'Site', 'Configuration item', 'Knowledge']) {
  expect(peek.includes(`kind: '${kind}'`) || peek.includes(`kind: department ? 'Department' : 'Team'`), `Universal Peek must support ${kind}`)
}
expect(peek.includes("manageLabel = 'Open full profile'"), 'People preview must preserve full-profile access')
expect(peek.includes("openLabel: 'Open in tab'"), 'Deep previews must support Open in tab')
expect(peek.includes("new CustomEvent('hi5-routechange')"), 'Universal Peek navigation must wake the workspace route engine')
expect(peek.includes("event.key === 'Escape'"), 'Universal Peek must support Escape to close')
expect(css.includes('z-index: 16000'), 'Universal Peek must float above workspace content')
expect(css.includes('rgb(var(--accent-rgb))'), 'Universal Peek must honour tenant accent colours')
expect(css.includes('@media (max-width: 700px)') && css.includes('place-items: end center'), 'Universal Peek must become a mobile bottom sheet')
expect(css.includes('@media (prefers-reduced-motion: reduce)'), 'Universal Peek must respect reduced motion')
expect(listGuard.includes('production-itsm-queue-mounted.production-service-desk-v2-mounted'), 'Service Desk List v2 legacy ownership fix is missing')

if (failures.length) {
  console.error('Universal Peek v2 contract failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Universal Peek v2 contract passed.')
