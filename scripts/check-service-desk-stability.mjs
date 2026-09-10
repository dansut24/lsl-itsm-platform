import fs from 'node:fs'

const main = fs.readFileSync('src/main.jsx', 'utf8')
const workspace = fs.readFileSync('src/production/ProductionItsmWorkspace.jsx', 'utf8')

const required = [
  "<ProductionItsmWorkspace />",
  "className=\"production-record-filter-rail\"",
  "className=\"production-record-view-list\"",
  "production-record-table-enhanced",
]

for (const token of required) {
  const source = token.includes('ProductionItsmWorkspace') ? main : workspace
  if (!source.includes(token)) throw new Error(`Missing stable Service Desk contract token: ${token}`)
}

if (!workspace.includes('production-record-table')) {
  throw new Error('Stable Service Desk table base class is missing.')
}

for (const forbidden of [
  '<ProductionServiceDeskListV2 />',
  '<ProductionServiceDeskQueueRail />',
  "ProductionServiceDeskListV2.css",
  "ProductionServiceDeskQueueRail.css",
]) {
  if (main.includes(forbidden)) throw new Error(`Crash-prone Service Desk overlay is still mounted: ${forbidden}`)
}

if (!main.includes('<ProductionUniversalPeekV2 />')) {
  throw new Error('Universal Peek v2 must remain mounted.')
}

console.log('Service Desk stability contract passed.')
