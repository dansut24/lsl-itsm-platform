import { readFile } from 'node:fs/promises'

const read = (path) => readFile(path, 'utf8')
const [api, accessGate, index, migration, resilienceMigration, ui, platform, surface, publicHtml, publicJs, viewerHtml, viewerRenderer] = await Promise.all([
  read('api/src/rmmConnect.js'),
  read('api/src/accessGate.js'),
  read('api/src/index.js'),
  read('api/migrations/089_rmm_connect_sessions.sql'),
  read('api/migrations/090_rmm_connect_resilience.sql'),
  read('src/features/rmm/RmmConnect.jsx'),
  read('src/features/rmm/RmmPlatformApp.jsx'),
  read('src/lib/tenantSurface.js'),
  read('public/connect/index.html'),
  read('public/connect/connect.js'),
  read('public/rmm-viewer/index.html'),
  read('public/rmm-viewer/renderer.js'),
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
expect(resilienceMigration.includes('held_until') && resilienceMigration.includes('host_disconnected_at'), 'Connect resilience migration must preserve hold and reconnect state.')
expect(resilienceMigration.includes('host_elevated') && resilienceMigration.includes('file_access_granted_at'), 'Connect resilience migration must record elevation and file-access consent.')
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
expect(api.includes("/connect-sessions/:sessionId/hold") && api.includes("/connect-sessions/:sessionId/resume"), 'Connect technician APIs must support customer-approved hold and resume.')
expect(api.includes("'connect_permission_request'") && api.includes("'connect_permission_response'"), 'Connect permission requests must be relayed explicitly.')
expect(api.includes("'session_state'"), 'Connect must relay secure-desktop transition state from the attended host to the Viewer.')
expect(api.includes('files_granted: permissions.files === true'), 'Connect host reconnect/elevation handoff must preserve already-approved file access.')
expect(api.includes("'remote_file_list_request'") && api.includes("'file_transfer_chunk'"), 'Connect WebSocket bridge must relay consent-gated file browser traffic.')
expect(api.includes("type: 'host_disconnected'") && api.includes("type: 'host_reconnected'"), 'Connect must preserve sessions across temporary host disconnects.')
expect(api.includes("if (type === 'end_session')") && api.includes("['viewer_disconnected','viewer_closed','viewer_left','stop_webrtc']"), 'Only an explicit technician End action may terminate a Connect session when the viewer leaves.')
expect(api.includes("No managed Agent enrollment was created."), 'Connect audit must explicitly distinguish ad-hoc support from managed enrollment.')
expect(api.includes("'customer_ended_session'") && api.includes("type: 'customer'") && api.includes("label: 'Customer'"), 'Customer End session must be audited distinctly from closing the Connect app.')
expect(ui.includes('Hi5Central Connect'), 'Technician Connect workspace is missing.')
expect(platform.includes("requiresRemote: true"), 'Connect navigation must remain hidden without remote-access permission.')
expect(platform.includes("activeView === 'connect' && !canRemote"), 'Direct Connect routes must fall back safely when remote permission is absent.')
expect(ui.includes('Create support code'), 'Technician code-generation action is missing.')
expect(ui.includes('/hold') && ui.includes('/resume') && ui.includes('held_until'), 'Connect workspace must expose Hold/Resume and held-session state.')
expect(viewerHtml.includes('id="btn-elevate"'), 'Connect Viewer must expose an attended administrator-access request action.')
expect(viewerRenderer.includes('requestConnectPermission("files")'), 'Connect file browser must request customer permission before use.')
expect(viewerRenderer.includes('requestConnectPermission("elevation")'), 'Connect elevation must request explicit customer approval.')
expect(viewerRenderer.includes('case "host_disconnected"') && viewerRenderer.includes('case "host_reconnected"'), 'Connect Viewer must survive customer-app reconnects.')
expect(viewerRenderer.includes('connectSessionHeld'), 'Connect Viewer must suppress reconnect loops while a session is intentionally held.')
expect(ui.includes('connect.hi5central.com'), 'Technician workflow must surface the public Connect URL.')
expect(surface.includes('|connect|'), 'RMM Connect route is missing from tenant routing.')
expect(publicHtml.includes('No permanent installation.'), 'Public page must explain that no permanent Agent is installed.')
expect(publicHtml.includes('I understand that the named technician'), 'Public page must contain explicit control consent.')
expect(publicJs.includes('/api/v1/connect/lookup'), 'Public page must verify the requester before consent.')
expect(publicJs.includes('/api/v1/connect/claim'), 'Public page must claim the one-time session before download.')
expect(!api.includes('INSERT INTO rmm_agent_devices'), 'Connect must never enroll an ad-hoc customer as a managed RMM device.')
expect(!api.includes('rmm_device_inventory'), 'Connect must not create managed inventory for ad-hoc customers.')

console.log('RMM Connect contract check passed.')
