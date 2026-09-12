import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { defaultCatalogueState } from '../src/data/defaultCatalogueV2.js'

const catalogue = defaultCatalogueState()
const serviceRequests = catalogue.items.filter((item) => item.kind === 'request-form' && item.requestType === 'Service Request')

if (!serviceRequests.length) throw new Error('Default Catalogue v2 has no Service Request templates.')

for (const item of serviceRequests) {
  if (item.visibility !== 'portal') throw new Error(`${item.title} is not Portal visible.`)
  if (item.active !== true) throw new Error(`${item.title} is not active by default.`)
  if (!Array.isArray(item.formSchema) || !item.formSchema.length) throw new Error(`${item.title} has no request form.`)
  if (!Array.isArray(item.workflowTasks) || !item.workflowTasks.length) throw new Error(`${item.title} has no fulfilment workflow.`)
}

for (const required of ['CAT-ONBOARDING', 'CAT-MOVER', 'CAT-LEAVER']) {
  if (!serviceRequests.some((item) => item.id === required)) throw new Error(`Missing required default template: ${required}`)
}

const resetScript = fs.readFileSync('api/scripts/reset-service-request-defaults.mjs', 'utf8')
const resetRequirements = [
  ["kind = 'request-form'", 'Reset is not limited to request forms.'],
  ["request_type = 'Service Request'", 'Reset is not limited to Service Request catalogue forms.'],
  ["record_type = 'service_request'", 'Service Request counter reset is missing.'],
  ["visibility: 'portal'", 'Reset does not force canonical defaults to Portal visibility.'],
  ['defaultCatalogueState()', 'Reset is not sourced from Default Catalogue v2.'],
]
for (const [token, message] of resetRequirements) {
  if (!resetScript.includes(token)) throw new Error(message)
}

if (resetScript.includes('DELETE FROM itsm_records')) {
  throw new Error('Service Request reset must not delete Incidents, Problems or Changes.')
}

const inspector = fs.readFileSync('src/production/ProductionServiceRequestWorkflowInspectorEnhancer.jsx', 'utf8')
if (!inspector.includes("inspectorIsTasks()")) throw new Error('Workflow enrichment is not scoped to the existing Tasks inspector.')
if (inspector.includes('innerHTML')) throw new Error('Workflow inspector must not inject tenant-authored HTML.')

execFileSync(process.execPath, ['--check', 'api/scripts/reset-service-request-defaults.mjs'], { stdio: 'inherit' })

console.log(`Default Catalogue v2 contract passed for ${serviceRequests.length} Portal Service Request templates.`)
