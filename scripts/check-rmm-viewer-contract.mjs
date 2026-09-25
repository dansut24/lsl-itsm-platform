import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const renderer = read('public/rmm-viewer/renderer.js')
const browser = read('public/rmm-viewer/browser.js')
const remote = read('api/src/rmmRemote.js')
const agent = read('api/src/rmmAgent.js')

const failures = []
const expect = (ok, message) => { if (!ok) failures.push(message) }

// Launch/bootstrap safety ----------------------------------------------------
expect(browser.includes('startWhenReady'), 'Browser Viewer must wait for renderer readiness before launching.')
expect(browser.indexOf('window.hi5RemoteViewer.start(launch)') < browser.indexOf('window.history.replaceState'), 'Launch fragment must only be removed after Viewer start accepts it.')
const initialUiMarker = renderer.indexOf('// Initial mobile UI rendering must happen after monitor/session state is')
expect(initialUiMarker > renderer.indexOf('let remoteMonitors = []') && renderer.indexOf('updateMobileModeUi();', initialUiMarker) > initialUiMarker, 'Mobile UI must not render diagnostics before monitor state initialises.')

// Mobile gesture stability --------------------------------------------------
expect(renderer.includes("document.addEventListener('touchstart'") && renderer.includes('mobileEdgeTouchIds'), 'iOS browser edge-navigation guard is missing.')
expect(renderer.includes("recoverMobileViewerFromBrowserGesture('pointercancel-recovery')"), 'Pointer-cancel recovery is missing.')
expect(renderer.includes('captureMobileViewportAnchor') && renderer.includes('restoreMobileViewportAnchor'), 'Viewport focal-point preservation is missing.')
const pinchRelease = renderer.slice(renderer.indexOf('if(wasViewport){'), renderer.indexOf('resetMobileGestureWhenReleased();', renderer.indexOf('if(wasViewport){')))
expect(pinchRelease.includes('applyMobileViewport({clamp:false})') && !pinchRelease.includes('applyMobileViewport({clamp:true})'), 'Pinch release must remain free of release-time recentering.')

// Static frames and real transport recovery --------------------------------
expect(renderer.includes('Never escalate frame age alone'), 'Static desktop frames must never trigger a full reconnect.')
expect(!/decoded-frame-stall[^\n]{0,120}scheduleMobileSessionReconnect/.test(renderer), 'Decoded-frame stall must not directly rebuild the session.')
expect(renderer.includes('scheduleMobileTransportHealthProbe'), 'Delayed transport health probe is missing.')
expect(renderer.includes('mobileReconnectCooldownUntil = Date.now() + 10000'), 'Post-recovery transport cooldown is missing.')
expect(renderer.includes("media-negotiation-timeout"), 'Recovered signaling must have a media-negotiation timeout.')

// Connection-quality hysteresis --------------------------------------------
expect(renderer.includes('10s window'), 'Connection quality must use a rolling measurement window.')
expect(renderer.includes('packetTotal >= 120'), 'Packet loss must have a minimum RTP sample size.')
expect(renderer.includes("sustained-poor-network"), 'Adaptive stream downgrade must require sustained Poor quality.')
expect(renderer.includes("current === 'poor'"), 'Adaptive degradation must be based on confirmed Poor quality.')

// Endpoint restart continuity -----------------------------------------------
expect(renderer.includes('mobileEndpointRestartUntil'), 'Browser Viewer endpoint-restart state is missing.')
expect(renderer.includes('case "agent_reconnecting"') && renderer.includes('Waiting for endpoint'), 'Browser Viewer must wait for an endpoint restart instead of disconnecting.')
expect(renderer.includes('case "agent_reconnected"'), 'Browser Viewer endpoint-return handling is missing.')
expect(remote.includes('AGENT_RESTART_GRACE_MS'), 'API Agent restart grace is missing.')
expect(remote.includes('VIEWER_RECONNECT_GRACE_MS'), 'API Viewer reconnect grace is missing.')
expect(remote.includes('bindAgentSocket') && remote.includes("type: 'start_webrtc'"), 'API must rebind a returning Agent and restart WebRTC.')
expect(remote.includes('subscribeAgentConnections'), 'Remote session layer must subscribe to Agent reconnect events.')
expect(agent.includes('subscribeAgentConnections') && agent.includes("type: 'connected'") && agent.includes("type: 'disconnected'"), 'Agent WebSocket registry must publish connection lifecycle events.')
expect(agent.includes('A replacement Agent socket is already authoritative'), 'Superseded Agent sockets must never mark a replacement connection offline.')
expect(remote.includes('remote.transport_interrupted') && remote.includes('remote.transport_recovered'), 'Restart continuity must be auditable without creating a second remote session.')
expect(remote.includes('ACTIVE_RECONNECT_TTL_SECONDS') && remote.includes("interval '8 hours'"), 'Active remote sessions must keep a sliding reconnect token horizon.')
expect(remote.includes('explicitViewerClose'), 'Explicit technician disconnect must bypass reconnect grace.')
expect(remote.includes('const AGENT_RESTART_GRACE_MS = 10 * 60 * 1000'), 'Endpoint restart grace must remain ten minutes.')
expect(remote.includes('const ACTIVE_RECONNECT_TTL_SECONDS = 8 * 60 * 60'), 'Active remote sessions must retain bounded reconnect authorisation.')
expect(renderer.includes('mobileReconnectDeadline = now + 85000'), 'Mobile Viewer signaling recovery window must align with the server grace.')
expect(remote.includes('remote.viewer_transport_interrupted') && remote.includes('remote.viewer_transport_recovered'), 'Viewer transport interruptions/recoveries must be auditable on the same session.')
expect(remote.includes("previousActive.agentWs.off('message', previousActive.relayFromAgent)"), 'Superseded Viewer sessions must detach stale Agent relay listeners.')

// Keyboard/input contract ----------------------------------------------------
expect(renderer.includes("getModifierState?.('AltGraph')"), 'AltGraph-aware printable-key handling is missing.')
expect(renderer.includes('commandModified'), 'Printable keys with Ctrl/Alt/Meta must use physical key semantics.')
expect(renderer.includes("'ArrowUp'") || renderer.includes('ArrowUp'), 'Mobile keyboard/navigation key support is missing.')
expect(renderer.includes('sendMobileTextEntry'), 'Mobile block text-entry path is missing.')

// Secure desktop / UI continuity --------------------------------------------
for (const state of ['secure_desktop_entering','secure_desktop_ready','desktop_handoff_entering','desktop_handoff_ready']) {
  expect(renderer.includes(state), `Viewer is missing secure-desktop state ${state}.`)
}
expect(renderer.includes('revealOnNextFrame = true'), 'Secure desktop return must reveal on the next valid frame.')

if (failures.length) {
  console.error('RMM Viewer contract check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log('RMM Viewer contract check passed.')
