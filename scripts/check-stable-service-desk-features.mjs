import fs from 'node:fs'

const main = fs.readFileSync('src/main.jsx', 'utf8')
const workspace = fs.readFileSync('src/production/ProductionItsmWorkspace.jsx', 'utf8')
const css = fs.readFileSync('src/production/ProductionItsmWorkspaceEnhancements.css', 'utf8')

const checks = [
  ['stable ProductionItsmWorkspace remains mounted', main.includes('<ProductionItsmWorkspace />')],
  ['List v2 renderer is not mounted', !main.includes('<ProductionServiceDeskListV2 />')],
  ['Queue Rail overlay is not mounted', !main.includes('<ProductionServiceDeskQueueRail />')],
  ['saved personal views live in stable queue', workspace.includes('SAVED_VIEWS_KEY') && workspace.includes('saveView()')],
  ['column chooser lives in stable queue', workspace.includes('production-record-columns-menu') && workspace.includes('dropColumn')],
  ['desktop columns support resizing', workspace.includes('production-record-column-resizer') && workspace.includes('beginResize')],
  ['list state is session-persisted', workspace.includes('LIST_STATE_PREFIX') && workspace.includes('persistListState')],
  ['return record is remembered', workspace.includes('returnRecord: record.id')],
  ['record Peek is direct, not observer-driven', workspace.includes('openPeek(recordPeek(record))')],
  ['requester Peek is direct', workspace.includes('openPeek(requesterPeek(record))')],
  ['assignment Peek is direct', workspace.includes('openPeek(assignmentPeek(record))')],
  ['mobile cards expose preview actions', workspace.includes('production-record-card-actions')],
  ['enhancement stylesheet is imported directly', workspace.includes("import './ProductionItsmWorkspaceEnhancements.css'")],
  ['sticky enhanced table header is present', css.includes('.production-record-table-enhanced thead') && css.includes('position: sticky')],
  ['touch card action scrollbar is hidden', css.includes('.production-record-card-actions::-webkit-scrollbar')],
]

const failed = checks.filter(([, ok]) => !ok)
if (failed.length) {
  console.error('Stable Service Desk feature contract failed:')
  for (const [name] of failed) console.error(` - ${name}`)
  process.exit(1)
}

console.log('Stable Service Desk feature contract passed.')
