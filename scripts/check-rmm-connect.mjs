import { readFile } from 'node:fs/promises'

const read = (path) => readFile(path, 'utf8')
const [api, accessGate, index, migration, ui, platform, surface, publicHtml, publicJs] = await Promise.all([
  read('api/src/rmmConnect.js'),
  read('api/src/accessGate.js'),
  read('api/src/index.js'),
  read('api/migrations/089_rmm_connect_sessions.sql'),
  read('src/features/rmm/RmmConnect.jsx'),
  read('src/features/rmm/RmmPlatformApp.jsx'),
  read('src/lib/tenantSurface.js'),
  read('public/connect/index.html'),
  read('public/connect/connect.js'),
])

function expect(condition, message) {
  if (!condition) throw new Error(message)
}

expect(index.includes("registerRmmConnectRoutes(app)"), 'Connect API routes are not registered.')
expect(accessGate.includes("path.includes('/connect-sessions')") && accessGate.includes("rmm.devices.remote"), 'Connect must use the dedicated remote-access permission gate.')
expect(index.includes("attachRmmConnectWebSockets(server)"), 'Connect WebSocket bridge is not attached.')
expect(index.includes("'connect'"), 'Connect must remain a reserved managed-host slug.')
expect(migration.includes('CREATE TABLE IF NOT EXISTS rmm_connect_sessions'), 'Connect session table is missing.')
expect(migration.includes('support_code_hash'), 'Support codes must be stored hashed.')
expect(migration.includes('host_ticket_hash'), 'Portable host tickets must be stored hashed.')
expect(migration.includes('viewer_token_hash'), 'Viewer launch tokens must be stored hashed.')
expect(api.includes("WAITING_TTL_SECONDS = 20 * 60"), 'Support codes must remain short-lived.')
expect(api.includes("CLAIM_ATTEMPTS_PER_WINDOW"), 'Public code claims must remain rate limited.')
expect(api.includes('CONNECT_CODE_HMAC_KEY') && api.includes('supportCodeHash(normalizedCode)'), 'Short support codes must use the dedicated HMAC secret rather than a plain hash.')
expect(!api.includes('sha256(normalizedCode)'), 'Short support codes must never fall back to plain SHA-256.')
expect(!api.includes('SELECT c.*'), 'Technician Connect APIs must never expose stored code or token digests through a wildcard session query.')
expect(api.includes("body.consent !== true"), 'Customer consent must remain mandatory before download.')
expect(api.includes("status='claimed'") || api.includes("status='claimed'".replaceAll("'", "\'")) || api.includes("status='claimed'"), 'Connect claim must transition to one-time claimed state.')
expect(api.includes("/connect/host/ws"), 'Dedicated portable host WebSocket is missing.')
expect(api.includes("/connect/viewer/ws"), 'Dedicated Connect viewer WebSocket is missing.')
expect(api.includes("'switch_monitor', 'input_event'"), 'Connect viewer WebSocket must continue relaying authenticated input_event controls.')
expect(api.includes("No managed Agent enrollment was created."), 'Connect audit must explicitly distinguish ad-hoc support from managed enrollment.')
expect(api.includes("'customer_ended_session'") && api.includes("type: 'customer'") && api.includes("label: 'Customer'"), 'Customer End session must be audited distinctly from closing the Connect app.')
expect(ui.includes('Hi5Central Connect'), 'Technician Connect workspace is missing.')
expect(platform.includes("requiresRemote: true"), 'Connect navigation must remain hidden without remote-access permission.')
expect(platform.includes("activeView === 'connect' && !canRemote"), 'Direct Connect routes must fall back safely when remote permission is absent.')
expect(ui.includes('Create support code'), 'Technician code-generation action is missing.')
expect(ui.includes('connect.hi5central.com'), 'Technician workflow must surface the public Connect URL.')
expect(surface.includes('|connect|'), 'RMM Connect route is missing from tenant routing.')
expect(publicHtml.includes('No permanent installation.'), 'Public page must explain that no permanent Agent is installed.')
expect(publicHtml.includes('I understand that the named technician'), 'Public page must contain explicit control consent.')
expect(publicJs.includes('/api/v1/connect/lookup'), 'Public page must verify the requester before consent.')
expect(publicJs.includes('/api/v1/connect/claim'), 'Public page must claim the one-time session before download.')
expect(!api.includes('INSERT INTO rmm_agent_devices'), 'Connect must never enroll an ad-hoc customer as a managed RMM device.')
expect(!api.includes('rmm_device_inventory'), 'Connect must not create managed inventory for ad-hoc customers.')

console.log('RMM Connect contract check passed.')
