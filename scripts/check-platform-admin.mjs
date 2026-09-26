import fs from 'node:fs'

const api = fs.readFileSync('api/src/platformAdmin.js', 'utf8')
const index = fs.readFileSync('api/src/index.js', 'utf8')
const surface = fs.readFileSync('src/lib/tenantSurface.js', 'utf8')
const app = fs.readFileSync('src/features/admin/PlatformAdminApp.jsx', 'utf8')
const qualification = fs.readFileSync('api/src/rmmSoftwareQualification.js', 'utf8')
const vendorIntel = fs.readFileSync('api/src/rmmSoftwareVendorIntel.js', 'utf8')

const checks = [
  [api.includes("hi5central_admin_session"), 'Platform admin must use a dedicated session cookie.'],
  [api.includes("/api/platform/v1/auth/login"), 'Platform admin login route must exist.'],
  [api.includes("/api/platform/v1/tenants"), 'Platform tenant-management routes must exist.'],
  [api.includes("/api/platform/v1/qualification"), 'Platform qualification routes must exist.'],
  [index.includes('registerPlatformAdminRoutes(app)'), 'Platform admin routes must be registered outside tenant API middleware.'],
  [surface.includes("kind: 'admin'"), 'admin.hi5central.com must resolve to the admin surface.'],
  [app.includes('Platform control plane') && app.includes('Software catalogue'), 'Admin shell must expose control-plane navigation.'],
  [app.includes("import '../rmm/RmmPlatformApp.css'"), 'Admin must reuse the RMM platform shell styling.'],
  [app.includes('className="rmm-app h5a-rmm-shell"') && app.includes('className="rmm-main-scroll"') && app.includes('className="rmm-page"'), 'Admin must use the RMM fixed shell with an internal vertical scroller.'],
  [api.includes('/api/platform/v1/qualification/runners/:agentDeviceId/action') && api.includes('setQualificationRunnerDispatch'), 'Admin must expose audited runner pause/resume controls.'],
  [api.includes('/api/platform/v1/qualification/queue/:queueId/action') && api.includes('forceQualificationCleanup') && api.includes('cancelSoftwareQualificationQueue'), 'Admin must expose safe queue cancel and cleanup controls.'],
  [api.includes('/api/platform/v1/software/catalogue/:catalogueId/requeue') && api.includes('/api/platform/v1/software/catalogue/:catalogueId/revalidate'), 'Admin must expose software requeue and source revalidation controls.'],
  [app.includes('Requeue + run') && app.includes('Save validation settings') && app.includes('Cancel safely'), 'Admin UI must surface qualification and software management actions.'],
  [app.includes('Cleanup contaminant') && api.includes('cleanup_contaminants'), 'Admin must expose runner contamination cleanup without VPS SQL.'],
  [qualification.includes('export async function reconcileSoftwareQualificationQueue()') && qualification.includes('dispatchAttempted: false'), 'Qualification must expose a reconcile-only path that never dispatches new software.'],
  [api.includes("action === 'reconcile'") && api.includes('reconcileSoftwareQualificationQueue()') && api.includes("action === 'run_next'"), 'Admin must keep Reconcile and Run next as separate actions.'],
  [app.includes('>Reconcile</button>') && app.includes('>Run next</button>') && app.includes('No new software was dispatched.'), 'Admin UI must clearly distinguish Reconcile from Run next.'],
  [api.includes('pending: pending.rows') && app.includes('PENDING QUEUE') && app.includes('What runs next'), 'Admin qualification must expose a dedicated pending queue.'],
  [qualification.includes('export async function setSoftwareQualificationPriority') && qualification.includes('export async function pushSoftwareQualificationToTop'), 'Qualification must expose non-dispatching priority management.'],
  [qualification.includes("'adminPriorityUpdatedAt'") && !qualification.match(/setSoftwareQualificationPriority[\s\S]{0,1600}adminRunNowRequestedAt/), 'Changing queue priority must not clear retry gates or imply Run now.'],
  [api.includes("action === 'set_priority'") && api.includes("action === 'push_top'") && app.includes('>Top</button>'), 'Admin must allow queued software to be reprioritised and pushed to the top.'],
  [qualification.includes('limit = 2000') && !qualification.includes('maxPending = 12') && !qualification.includes('safeMaxPending'), 'Automatic clean qualification must materialise the full eligible backlog instead of a rolling pending buffer.'],
  [vendorIntel.includes('queueAutomaticCleanInstallQualifications({\n      limit: 2000,\n      allowUnresolvedVulnerability: true') && !vendorIntel.includes('maxPending: 12') && !vendorIntel.includes('maxPending: 1'), 'Qualification progression must continuously seed the full clean-install backlog.'],
]

let failures = 0
for (const [ok, message] of checks) {
  if (ok) continue
  failures += 1
  console.error('FAIL:', message)
}
if (failures) process.exit(1)
console.log('Platform admin contract check passed.')
