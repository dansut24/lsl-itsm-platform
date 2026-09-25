import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const renderer = read('public/rmm-viewer/renderer.js')
const browser = read('public/rmm-viewer/browser.js')
const remote = read('api/src/rmmRemote.js')
const agent = read('api/src/rmmAgent.js')
const platform = read('src/features/rmm/RmmPlatformApp.jsx')
const viewerDetector = read('src/features/rmm/remoteViewerClient.js')
const { detectRemoteViewerClient } = await import('../src/features/rmm/remoteViewerClient.js')

const failures = []
const expect = (ok, message) => { if (!ok) failures.push(message) }

// Physical device-class launch selection ------------------------------------
const desktopUaOnIpad = detectRemoteViewerClient({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18 Safari/605.1.15',
  platform: 'MacIntel',
  vendor: 'Apple Computer, Inc.',
  maxTouchPoints: 5,
  userAgentData: { mobile: false, platform: 'macOS' },
})
expect(desktopUaOnIpad.viewerClient === 'browser', 'iPad/iOS desktop-UA browsers must use the browser Viewer.')
const windowsTouch = detectRemoteViewerClient({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  platform: 'Win32',
  vendor: 'Google Inc.',
  maxTouchPoints: 10,
  userAgentData: { mobile: false, platform: 'Windows' },
})
expect(windowsTouch.viewerClient === 'native', 'Windows touch devices must remain eligible for the native Viewer.')
const androidPhone = detectRemoteViewerClient({ userAgent: 'Mozilla/5.0 (Linux; Android 16; Pixel) Mobile', platform: 'Linux armv8l', maxTouchPoints: 5 })
expect(androidPhone.viewerClient === 'browser', 'Android phones must use the browser Viewer.')
expect(!/innerWidth|screen\.width|devicePixelRatio|max-width|min-width/.test(viewerDetector), 'Remote Viewer device-class detection must not depend on viewport/resolution.')
expect(platform.includes('detectRemoteViewerClient()') && platform.includes('viewerClient: viewerTarget.viewerClient'), 'RMM launch must explicitly send the detected Viewer client type.')
expect(remote.includes('viewerClientForRequest(c, body.viewerClient)'), 'API must honour the authenticated portal Viewer-client decision.')
expect(remote.includes("if (requested === 'browser' || requested === 'native') return requested"), 'API explicit Viewer-client selection is missing.')
expect(!remote.includes("requestedClient !== 'browser' || !isPortableUserAgent(request.headers['user-agent'])"), 'Browser Viewer WebSocket must not reclassify the device from a spoofable User-Agent.')

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
expect(renderer.includes('TOUCH_SCROLL_STEP_PX = 40'), 'Direct Touch natural-scroll step is missing or unexpectedly sensitive.')
expect(renderer.includes('remoteTouchScrolling') && renderer.includes('verticalIntent'), 'Direct Touch one-finger vertical scroll intent is missing.')
expect(renderer.includes("delta_y: steps * 120"), 'Mobile scrolling must emit fixed Windows wheel notches, not per-pixel wheel messages.')
expect(renderer.includes('RAIL_SCROLL_STEP_PX = 56'), 'Trackpad fallback rail must retain reduced scroll sensitivity.')
expect(renderer.includes("mobileInputMode === 'trackpad'") && renderer.includes('elMobileScrollRail.classList.toggle'), 'Scroll rail should be hidden in Direct Touch mode.')

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
for (const key of ['F12','Home','End','PageUp','PageDown','Insert','PrintScreen','Pause','ContextMenu']) expect(renderer.includes(key), `Mobile Fn keyboard is missing ${key}.`)
expect(renderer.includes('sendMobileTextEntry'), 'Mobile block text-entry path is missing.')
expect(renderer.includes('SHIFTED_PUNCTUATION_TEXT') && renderer.includes('SHIFTED_PUNCTUATION_TEXT[text]'), 'Mobile shifted punctuation mapping is incomplete.')

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
