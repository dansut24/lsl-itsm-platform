import fs from 'node:fs'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const ui = fs.readFileSync('src/production/ProductionTaskExperience.jsx', 'utf8')
const css = fs.readFileSync('src/production/ProductionTaskExperience.css', 'utf8')
const api = fs.readFileSync('api/src/taskOwnership.js', 'utf8')

for (const label of ['My Tasks', 'Team Queue', 'Unassigned', 'Blocked']) {
  assert(ui.includes(label), `Tasks UI is missing ${label}`)
}

assert(ui.includes('/api/v1/task-work-queue'), 'Tasks UI does not use the server-authoritative work queue endpoint')
assert(ui.includes("{ key: 'due', label: 'Due / target'"), 'Tasks table is missing the Due / target column')
assert(ui.includes("due: 'All'"), 'Tasks UI is missing the due-date filter state')
assert(ui.includes('production-task-work-views'), 'Tasks UI is missing the primary work-view switcher')
assert(ui.includes('production-task-due'), 'Tasks UI is missing due-target indicators')
assert(css.includes('.production-task-work-views'), 'Task work-view responsive styling is missing')
assert(css.includes('.production-task-due.is-overdue'), 'Task overdue styling is missing')
assert(css.includes('@media (max-width: 760px)'), 'Task queue mobile styling is missing')

assert(api.includes("app.get('/api/v1/task-work-queue'"), 'Task work queue API route is missing')
assert(api.includes("const queueScopes = new Set(['mine', 'team', 'unassigned', 'blocked', 'all', 'completed'])"), 'Task work queue scopes are incomplete')
assert(api.includes('organisation_team_memberships'), 'Team Queue is not derived from tenant team membership')
assert(api.includes("due === 'Overdue'"), 'Task work queue overdue filter is missing')
assert(api.includes("due === 'Next 24 hours'"), 'Task work queue near-due filter is missing')
assert(api.includes('views:'), 'Task work queue view counts are missing')

console.log('Task queue polish contract passed')
