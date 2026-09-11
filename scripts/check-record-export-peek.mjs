import fs from 'node:fs'

const main = fs.readFileSync('src/main.jsx', 'utf8')
const exportEngine = fs.readFileSync('src/lib/recordExport.js', 'utf8')
const exportEnhancer = fs.readFileSync('src/production/ProductionRecordExportEnhancer.jsx', 'utf8')
const peek = fs.readFileSync('src/production/ProductionUniversalPeekV2.jsx', 'utf8')
const workingPeek = fs.readFileSync('src/production/ProductionRecordWorkingPeek.jsx', 'utf8')
const finalCss = fs.readFileSync('src/production/ProductionRecordExperienceFinal.css', 'utf8')

const requirements = [
  [main, 'ProductionRecordExportEnhancer', 'Record export enhancer is not mounted.'],
  [main, 'ProductionRecordExperienceFinal.css', 'Final record experience CSS is not loaded.'],
  [exportEngine, "{ id: 'pdf'", 'PDF export is missing.'],
  [exportEngine, "{ id: 'xlsx'", 'XLSX export is missing.'],
  [exportEngine, "{ id: 'csv'", 'CSV export is missing.'],
  [exportEngine, "{ id: 'docx'", 'DOCX export is missing.'],
  [exportEngine, 'function zipStore', 'Open XML ZIP writer is missing.'],
  [exportEngine, 'exportRecordDocument', 'Shared export function is missing.'],
  [exportEnhancer, 'fetchWholeQueue', 'List export must export the whole filtered view.'],
  [exportEnhancer, 'genericDetailDocument', 'Generic record export model is missing.'],
  [exportEnhancer, 'serviceRequestDocument', 'Service Request export model is missing.'],
  [peek, 'ProductionRecordWorkingPeek', 'Working record Peek is not wired into Universal Peek.'],
  [peek, 'is-working-record', 'Working record Peek theme mode is missing.'],
  [workingPeek, '/activity', 'Working Peek note support is missing.'],
  [workingPeek, '/attachments', 'Working Peek attachment support is missing.'],
  [workingPeek, '/tasks', 'Working Peek task support is missing.'],
  [workingPeek, 'patchProductionServiceRequestTask', 'Service Request task editing is missing.'],
  [workingPeek, 'decideProductionServiceRequestApproval', 'Service Request approval actions are missing.'],
  [finalCss, '.hi5-universal-peek.is-working-record', 'Working Peek sizing/theme override is missing.'],
  [finalCss, 'background: var(--surface) !important', 'Peek must use the tenant surface rather than translucent grey.'],
  [finalCss, '.production-record-new', 'Stable mobile New button safeguard is missing.'],
  [finalCss, '.hi5-list-primary', 'Alternate mobile New button safeguard is missing.'],
  [finalCss, "input[type='checkbox']", 'Mobile checkbox/reference spacing safeguard is missing.'],
]

for (const [source, token, message] of requirements) {
  if (!source.includes(token)) throw new Error(message)
}

for (const forbidden of ['<ProductionServiceDeskListV2 />', '<ProductionServiceDeskQueueRail />']) {
  if (main.includes(forbidden)) throw new Error(`Crash-prone Service Desk overlay has returned: ${forbidden}`)
}

console.log('Record export and working Peek contract passed.')
