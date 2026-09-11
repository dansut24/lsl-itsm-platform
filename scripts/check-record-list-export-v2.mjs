import fs from 'node:fs'

const main = fs.readFileSync('src/main.jsx', 'utf8')
const listEnhancer = fs.readFileSync('src/production/ProductionRecordListInteractionEnhancer.jsx', 'utf8')
const listCss = fs.readFileSync('src/production/ProductionRecordListInteractionEnhancer.css', 'utf8')
const exportEnhancer = fs.readFileSync('src/production/ProductionRecordExportEnhancer.jsx', 'utf8')
const exportMenu = fs.readFileSync('src/production/ProductionRecordExportMenu.jsx', 'utf8')
const premiumExport = fs.readFileSync('src/lib/recordExportPremium.js', 'utf8')
const themeBridge = fs.readFileSync('src/production/ProductionPortalThemeBridge.jsx', 'utf8')
const finalCss = fs.readFileSync('src/production/ProductionRecordExperienceFinal.css', 'utf8')

const requirements = [
  [main, 'ProductionRecordListInteractionEnhancer', 'Stable list interaction enhancer is not mounted.'],
  [main, 'ProductionPortalThemeBridge', 'Portal theme bridge is not mounted.'],
  [listEnhancer, 'hi5-record-selection-changed', 'Record selection event is missing.'],
  [listEnhancer, 'hi5-record-selector', 'Record selector controls are missing.'],
  [listEnhancer, 'Select page', 'Page selection control is missing.'],
  [listEnhancer, 'hi5-mobile-record-search-trigger', 'Mobile search trigger is missing.'],
  [listCss, '.production-record-toolbar.hi5-mobile-search-open .production-record-search', 'Slide-out mobile search CSS is missing.'],
  [listCss, '.production-record-card > .hi5-record-selector', 'Mobile card selection positioning is missing.'],
  [exportMenu, "id: 'selected'", 'Selected-record export scope is missing.'],
  [exportMenu, "id: 'current'", 'Current-view export scope is missing.'],
  [exportMenu, "id: 'all'", 'All-record export scope is missing.'],
  [exportEnhancer, 'recordsForScope', 'Scope-aware list export loader is missing.'],
  [exportEnhancer, "scope === 'selected'", 'Selected-record export filtering is missing.'],
  [exportEnhancer, "scope === 'all'", 'All-record export mode is missing.'],
  [exportEnhancer, 'recordExportPremium.js', 'Premium export renderer is not wired in.'],
  [premiumExport, 'buildPremiumPdf', 'Premium PDF renderer is missing.'],
  [premiumExport, 'buildPremiumDocx', 'Premium DOCX renderer is missing.'],
  [premiumExport, 'SERVICE MANAGEMENT EXPORT', 'Branded document header is missing.'],
  [themeBridge, "'--accent-rgb'", 'Accent colour is not bridged to portals.'],
  [themeBridge, "'--surface'", 'Surface colour is not bridged to portals.'],
  [finalCss, 'background: var(--surface, #ffffff) !important', 'Opaque Peek surface fallback is missing.'],
  [finalCss, '.hi5-working-peek-composer', 'Working Peek solid composer override is missing.'],
]

for (const [source, token, message] of requirements) {
  if (!source.includes(token)) throw new Error(message)
}

for (const forbidden of ['<ProductionServiceDeskListV2 />', '<ProductionServiceDeskQueueRail />']) {
  if (main.includes(forbidden)) throw new Error(`Crash-prone duplicate Service Desk renderer returned: ${forbidden}`)
}

console.log('Record selection, scoped export and themed Peek contract passed.')
