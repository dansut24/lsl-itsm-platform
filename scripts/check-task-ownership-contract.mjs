import fs from 'node:fs'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const api = fs.readFileSync('api/src/taskOwnership.js', 'utf8')
const state = fs.readFileSync('api/src/serviceRequestState.js', 'utf8')
const catalogue = fs.readFileSync('api/src/catalogue.js', 'utf8')
const ui = fs.readFileSync('src/production/ProductionTaskExperience.jsx', 'utf8')

assert(api.includes("app.post('/api/v1/tasks/:taskKey/take'"), 'Task take route is missing')
assert(api.includes("app.post('/api/v1/tasks/:taskKey/release'"), 'Task release route is missing')
assert(api.includes('FOR UPDATE OF t, r'), 'Task ownership routes must lock the task/request rows')
assert(api.includes('organisation_team_memberships'), 'Task take must verify assignment-group membership')
assert(api.includes("task.status !== 'Ready'"), 'Task take/release must be limited to Ready tasks')
assert(api.includes('task.assignee_person_id'), 'Task ownership must be stored on the task')
assert(!api.includes('SET fulfilment_team_id'), 'Task ownership must not assign the parent Service Request team')
assert(!api.includes('SET assigned_person_id'), 'Task ownership must not assign the parent Service Request person')

assert(catalogue.includes("registerTaskOwnershipRoutes(app)"), 'Task ownership routes are not registered')
assert(state.includes("Take this task before starting, blocking or completing work."), 'Server-side task owner work guard is missing')
assert(state.includes('task.assignee_person_id !== actor.person.id'), 'Task work must be restricted to the current task owner')

assert(ui.includes("/take`"), 'Tasks UI does not call the take route')
assert(ui.includes("/release`"), 'Tasks UI does not call the release route')
assert(ui.includes('Take task'), 'Tasks UI is missing the Take task action')
assert(ui.includes('Release task'), 'Tasks UI is missing the Release task action')
assert(ui.includes('const taskIsMine'), 'Tasks UI is missing current-owner detection')
assert(ui.includes('disabled={saving || completed || !taskIsMine}'), 'Task status controls are not owner-gated')
assert(ui.includes('disabled={saving || !taskIsMine || !completionNotes.trim()}'), 'Task completion is not owner-gated')

console.log('Task ownership contract passed')
