import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/production/ProductionTaskExperience.jsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/production/ProductionTaskExperience.css', import.meta.url), 'utf8')

const required = [
  'production-record-shell production-motion-enter production-record-shell-enhanced',
  'production-record-filter-rail',
  'production-record-toolbar',
  'production-record-result-line',
  'production-record-content',
  'production-record-pagination',
  'production-record-table production-record-table-enhanced',
  'activity-canvas-shell production-motion-enter',
  'activity-canvas-top',
  'activity-canvas-ribbon',
  'activity-canvas-body',
  'activity-canvas-inspector',
  'activity-canvas-activity',
  'Open primary request',
]

for (const token of required) {
  if (!source.includes(token)) throw new Error(`Tasks layout contract is missing: ${token}`)
}

for (const obsolete of ['production-task-filter-rail', 'production-task-detail-topbar', 'production-task-hero', 'production-task-panel']) {
  if (source.includes(obsolete) || css.includes(obsolete)) throw new Error(`Obsolete bespoke Tasks layout remains: ${obsolete}`)
}

if (!css.includes('@media (max-width: 720px)')) throw new Error('Tasks layout is missing its mobile refinement contract.')
if (!source.includes('Waiting workflow steps stay hidden until their dependencies are complete.')) throw new Error('Tasks queue no longer explains hidden dependency-gated tasks.')

console.log('Tasks shared-layout contract passed')
