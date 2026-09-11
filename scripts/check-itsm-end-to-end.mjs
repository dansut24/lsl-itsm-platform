import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const main = fs.readFileSync('src/main.jsx', 'utf8')
const workflowUi = fs.readFileSync('src/production/ProductionWorkflowExperience.jsx', 'utf8')
const workflowCss = fs.readFileSync('src/production/ProductionWorkflowExperience.css', 'utf8')
const notificationUi = fs.readFileSync('src/production/ProductionNotificationCenter.jsx', 'utf8')
const notificationCss = fs.readFileSync('src/production/ProductionNotificationCenter.css', 'utf8')
const workflows = fs.readFileSync('api/src/itsmWorkflows.js', 'utf8')
const notifications = fs.readFileSync('api/src/notifications.js', 'utf8')
const mailer = fs.readFileSync('api/src/notificationMailer.js', 'utf8')
const settings = fs.readFileSync('api/src/settings.js', 'utf8')
const migration = fs.readFileSync('api/migrations/016_workflows_notifications.sql', 'utf8')
const refinements = fs.readFileSync('api/migrations/017_workflow_trigger_refinements.sql', 'utf8')

for (const file of [
  'api/src/itsmWorkflows.js',
  'api/src/notifications.js',
  'api/src/notificationMailer.js',
  'api/src/settings.js',
  'api/src/index.js',
  'api/src/serviceRequests.js',
  'api/src/serviceRequestOperations.js',
  'api/src/itsmLifecycle.js',
]) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' })
}

const requirements = [
  [main, '<ProductionWorkflowExperience />', 'Workflow experience is not mounted.'],
  [main, '<ProductionNotificationCenter />', 'Platform notification centre is not mounted.'],
  [workflowUi, "workflow.type === 'Service Request'", 'Service Request workflow surface is missing.'],
  [workflowUi, "workflow.type === 'Problem'", 'Problem workflow surface is missing.'],
  [workflowUi, "workflow.type === 'Change'", 'Change workflow surface is missing.'],
  [workflowUi, 'Fulfilment summary', 'Service Request completion summary gate is missing.'],
  [workflowUi, 'Known Error title', 'Problem Known Error workflow is missing.'],
  [workflowUi, 'Root cause', 'Problem root-cause workflow is missing.'],
  [workflowUi, 'Permanent fix', 'Problem permanent-fix workflow is missing.'],
  [workflowUi, 'Implementation plan', 'Change implementation planning is missing.'],
  [workflowUi, 'Backout plan', 'Change backout planning is missing.'],
  [workflowUi, 'Post-implementation review', 'Change PIR workflow is missing.'],
  [workflowUi, "['Failed', 'Backed Out']", 'Change failure/backout outcomes are missing.'],
  [workflowCss, '@media(max-width:760px)', 'Workflow mobile layout is missing.'],
  [workflows, 'PROBLEM_TRANSITIONS', 'Problem lifecycle definition is missing.'],
  [workflows, 'CHANGE_TRANSITIONS', 'Change lifecycle definition is missing.'],
  [workflows, 'SERVICE_REQUEST_TRANSITIONS', 'Service Request lifecycle definition is missing.'],
  [workflows, "app.get('/api/v1/workflows/:reference'", 'Workflow read API is missing.'],
  [workflows, "app.post('/api/v1/workflows/:reference/transition'", 'Workflow transition API is missing.'],
  [workflows, "app.patch('/api/v1/workflows/:reference/data'", 'Workflow data API is missing.'],
  [workflows, 'change.approval_required', 'Change approval event is missing.'],
  [workflows, 'standardChangeAutoApprove', 'Standard Change automatic approval policy is missing.'],
  [migration, 'CREATE TABLE IF NOT EXISTS domain_events', 'Domain event store is missing.'],
  [migration, 'CREATE TABLE IF NOT EXISTS workflow_approvals', 'Shared workflow approvals are missing.'],
  [migration, 'CREATE TABLE IF NOT EXISTS platform_notifications', 'Platform notifications table is missing.'],
  [migration, 'CREATE TABLE IF NOT EXISTS notification_deliveries', 'Notification delivery queue is missing.'],
  [migration, 'hi5_service_request_approval_reconcile', 'Service Request approval reconciliation is missing.'],
  [migration, 'hi5_service_request_task_reconcile', 'Service Request task reconciliation is missing.'],
  [refinements, "v_request.status IN ('Approved', 'In Progress')", 'Task dependency release is not approval-gated.'],
  [refinements, "IF NEW.kind = 'workflow'", 'Duplicate workflow timeline notifications are not suppressed.'],
  [notifications, "app.get('/api/v1/notifications'", 'Notification list API is missing.'],
  [notifications, "app.post('/api/v1/notifications/client-event'", 'Cross-platform client event bridge is missing.'],
  [notifications, "app.patch('/api/v1/notification-preferences'", 'Personal notification settings are missing.'],
  [notifications, "app.patch('/api/v1/notification-settings'", 'Tenant notification settings are missing.'],
  [notifications, 'liveChat: true', 'Live Chat notification category is missing.'],
  [notifications, 'projects: true', 'Projects notification category is missing.'],
  [notifications, 'calendar: true', 'Calendar notification category is missing.'],
  [notifications, 'rmm: true', 'RMM notification category is missing.'],
  [mailer, 'sendPlatformNotificationEmail', 'Email notification delivery is missing.'],
  [notificationUi, 'NotificationSettingsSurface', 'Notification Settings surface is missing.'],
  [notificationUi, 'LOCAL_NOTIFICATIONS_KEY', 'Existing platform notification bridge is missing.'],
  [notificationUi, 'Notification.requestPermission', 'Browser notification opt-in is missing.'],
  [notificationCss, '.hi5-notification-drawer', 'Notification drawer styling is missing.'],
  [settings, 'registerWorkflowRoutes(app)', 'Workflow routes are not registered.'],
  [settings, 'registerNotificationRoutes(app)', 'Notification routes are not registered.'],
]

for (const [source, token, message] of requirements) {
  if (!source.includes(token)) throw new Error(message)
}

for (const forbidden of ['<ProductionServiceDeskListV2 />', '<ProductionServiceDeskQueueRail />']) {
  if (main.includes(forbidden)) throw new Error(`Crash-prone Service Desk renderer returned: ${forbidden}`)
}

console.log('End-to-end ITSM workflow and notification contract passed.')
