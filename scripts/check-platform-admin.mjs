import fs from 'node:fs'

const api = fs.readFileSync('api/src/platformAdmin.js', 'utf8')
const index = fs.readFileSync('api/src/index.js', 'utf8')
const surface = fs.readFileSync('src/lib/tenantSurface.js', 'utf8')
const app = fs.readFileSync('src/features/admin/PlatformAdminApp.jsx', 'utf8')

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
]

let failures = 0
for (const [ok, message] of checks) {
  if (ok) continue
  failures += 1
  console.error('FAIL:', message)
}
if (failures) process.exit(1)
console.log('Platform admin contract check passed.')
