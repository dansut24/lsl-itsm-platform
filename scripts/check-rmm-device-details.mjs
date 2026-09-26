import fs from 'node:fs'
import { rmmActivityPath, rmmDevicePath, rmmRouteFromLocation } from '../src/lib/tenantSurface.js'

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const bootstrap = read('src/production/ProductionRmmBootstrap.jsx')
const platform = read('src/features/rmm/RmmPlatformApp.jsx')
const tools = read('src/features/rmm/RmmDeviceTools.jsx')
const toolCss = read('src/features/rmm/RmmDeviceTools.css')
const platformCss = read('src/features/rmm/RmmPlatformApp.css')
const deviceApi = read('api/src/microsoftIntegration.js')
const toolApi = read('api/src/rmmDeviceTools.js')
const activity = read('src/features/rmm/RmmActivityViews.jsx')
const activityCss = read('src/features/rmm/RmmActivityViews.css')
const activityApi = read('api/src/rmmActivity.js')
const agentApi = read('api/src/rmmAgent.js')
const patchingApi = read('api/src/rmmPatching.js')

const failures = []
const expect = (value, message) => { if (!value) failures.push(message) }

// Live memory must win over stale/empty inventory memory.
expect(deviceApi.includes('AS agent_memory_total_bytes') && deviceApi.includes('AS agent_memory_used_bytes'), 'Device API must expose live Agent memory byte counters.')
expect(bootstrap.includes('row.agent_memory_total_bytes || row.memory_bytes'), 'Device model must prefer live Agent memory over inventory fallback.')
expect(platform.includes('device.memoryUsedBytes') && platform.includes('Installed RAM'), 'Device Details must show live memory context.')

// Network cards use inventory identity plus non-persisted live counters.
expect(toolApi.includes("'/api/v1/rmm/devices/:agentDeviceId/network-stats'"), 'Live network-stats endpoint is missing.')
expect(toolApi.includes("network_stats_request") && toolApi.includes('requestAgentProbe'), 'Network stats must use the lightweight Agent message probe, not persisted jobs.')
expect(toolApi.includes("versionAtLeast(device.agent_version, '0.1.149')"), 'Live network probe must be gated to the first Agent release that implements it.')
expect(platform.includes('function NetworkAdaptersPanel') && platform.includes('updates every 2 seconds'), 'Network adapter live graph is missing.')
expect(platform.includes('receive_link_speed_bps') && platform.includes('transmit_link_speed_bps'), 'Network adapter current link speeds are missing.')
expect(platform.includes("liveByName[String(adapter.description || '').toLowerCase()]"), 'Network live samples must fall back to the inventory adapter description when the Windows friendly name differs.')
expect(platform.includes("const adapterIsUp = String(adapter.status).toLowerCase() === 'up'") && platform.includes("{adapterIsUp && <div className=\"rmm-network-graph\"") && platform.includes(": 'Inactive'"), 'Inactive network adapters must not render live graphs or measuring states.')

// Registry must start at an explicit root chooser; API must reject empty roots.
expect(tools.includes("useState('')") && tools.includes('Select a registry hive') && tools.includes('HKEY_LOCAL_MACHINE'), 'Registry Editor must start at the hive chooser.')
expect(!tools.includes("useEffect(() => { load('HKLM:\\')"), 'Registry Editor must not auto-read HKLM on open.')
expect(toolApi.includes('Select a registry hive before reading registry data.'), 'Registry API must reject implicit/default hive reads.')

// Users & Sessions must surface inventory users, admins, and interactive sessions.
expect(tools.includes('device.inventory?.local_users') && tools.includes('Local administrators') && tools.includes('Interactive sessions'), 'Users & Sessions must show local users, admins and Windows sessions.')
expect(tools.includes('device.inventory?.security?.local_admins'), 'Users & Sessions must consume the Agent local-admin inventory.')
expect(tools.includes('function ToolStatusPill') && !tools.includes('<StatusPill'), 'Users & Sessions must use a tool-local status badge and must not depend on the private RMM page StatusPill.')

// Device sections/tools are durable deep links and toolbar selection follows the active tool.
const canonicalSurface = { canonical: true, pathBased: false }
const cmdPath = rmmDevicePath(canonicalSurface, 'INTUNE-BAD3-E6C7D788BE', 'tools', 'cmd')
expect(cmdPath === '/devices/INTUNE-BAD3-E6C7D788BE/tools/cmd', 'CMD deep link must use /devices/<id>/tools/cmd.')
const cmdRoute = rmmRouteFromLocation(canonicalSurface, { pathname: cmdPath, search: '', origin: 'https://test2-rmm.hi5central.com' })
expect(cmdRoute.deviceId === 'INTUNE-BAD3-E6C7D788BE' && cmdRoute.deviceSection === 'tools' && cmdRoute.deviceTool === 'cmd', 'CMD deep link must parse back to the same device/tool.')
const activityRoute = rmmRouteFromLocation(canonicalSurface, { pathname: '/devices/INTUNE-BAD3-E6C7D788BE/activity', search: '', origin: 'https://test2-rmm.hi5central.com' })
expect(activityRoute.deviceSection === 'activity' && activityRoute.deviceTool === '', 'Device Activity deep link must restore the Activity section.')
const auditDetailPath = rmmActivityPath(canonicalSurface, 'software', '123e4567-e89b-12d3-a456-426614174000')
expect(auditDetailPath === '/activity/software/123e4567-e89b-12d3-a456-426614174000', 'Audit details must use /activity/<category>/<id> paths.')
const auditDetailRoute = rmmRouteFromLocation(canonicalSurface, { pathname: auditDetailPath, search: '', origin: 'https://test2-rmm.hi5central.com' })
expect(auditDetailRoute.viewId === 'activity-audit' && auditDetailRoute.activityCategory === 'software' && auditDetailRoute.activityId === '123e4567-e89b-12d3-a456-426614174000', 'Audit detail routes must restore category and activity ID.')
const registryRoute = rmmRouteFromLocation(canonicalSurface, { pathname: '/devices/INTUNE-BAD3-E6C7D788BE/tools/registry', search: '', origin: 'https://test2-rmm.hi5central.com' })
expect(registryRoute.deviceSection === 'tools' && registryRoute.deviceTool === 'registry', 'Registry deep link must restore Registry Editor.')
expect(platform.includes('initialSection={selectedDeviceSection}') && platform.includes('initialTool={selectedDeviceTool}'), 'Device Details must hydrate its selected section/tool from the route.')
expect(tools.includes("nav.scrollTo({ left, behavior: 'smooth' })") && tools.includes('data-tool-id={id}'), 'Mobile tool toolbar must scroll the active tool into view.')

// Mobile embedded tools belong to page flow rather than a fixed mini viewport.
expect(toolCss.includes('.rmm-device-tool-workspace.is-embedded {\n    height: auto;') && toolCss.includes('overflow-y: visible;'), 'Embedded mobile tools must allow page-owned vertical scrolling.')
expect(toolCss.includes('contain: inline-size;') && toolCss.includes('overflow-x: clip;'), 'Embedded mobile tools must not widen or horizontally pan the Device Details page.')
expect(platform.includes('rmm-device-software-card') && platform.includes('rmm-device-app-patching-card') && platform.includes('rmm-device-windows-patching-card'), 'Device Software/Patching sections must expose mobile containment hooks.')
expect(platformCss.includes('.rmm-device-software-card,') && platformCss.includes('.rmm-device-app-patching-card,') && platformCss.includes('overflow-x: clip;'), 'Software/Patching mobile sections must not horizontally pan the Device Details page.')
expect(platformCss.includes('.rmm-device-software-table .rmm-table-head,') && platformCss.includes("content: 'Publisher';"), 'Software table must collapse to labelled mobile cards.')
expect(platformCss.includes('.rmm-app-patch-table .rmm-table-row > span:nth-child(6)') && platformCss.includes("content: 'Vulnerabilities';"), 'Application patching table must collapse to labelled mobile cards.')
expect(platform.includes('function DevicePatchVulnerabilityDetails') && platform.includes('rmm-linked-cves') && platform.includes('CVSS') && platform.includes('EPSS') && platform.includes('CISA KEV'), 'Device patch rows must open their linked vulnerability details with CVSS, EPSS and KEV context.')
expect(platform.includes("createPortal(modal, document.querySelector('.rmm-app') || document.body)"), 'Device patch vulnerability details must portal above the RMM shell on mobile.')
expect(platformCss.includes('.rmm-patch-vuln-sheet') && platformCss.includes('padding: calc(env(safe-area-inset-top) + 8px) 0 0;'), 'Device patch vulnerability details must be mobile safe-area aware.')
expect(platformCss.includes('.rmm-device-windows-patching-card .rmm-device-patch-table') && platformCss.includes("content: 'Reboot';"), 'Windows Update table must collapse to labelled mobile cards.')
expect(toolCss.includes('.rmm-device-tool-workspace.is-embedded .rmm-tool-table-head {\n    display: none;') && toolCss.includes('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;'), 'Phone tool tables must collapse to viewport-width cards instead of desktop-width horizontal tables.')
expect(activity.includes('window.setInterval(() => load(true), 5000)'), 'Device Activity must live-refresh silently while its tab is open.')
expect(activity.includes("createPortal(modal, document.querySelector('.rmm-app') || document.body)"), 'Audit detail modal must portal outside the scrolling page so the mobile header cannot cover it.')
expect(activityCss.includes('padding: calc(env(safe-area-inset-top) + 8px) 0 0;') && activityCss.includes('overscroll-behavior: contain;'), 'Mobile audit details must respect the safe-area top and own their scrolling.')
expect(activityApi.includes("'/api/v1/rmm/activity/:eventId'"), 'Durable audit detail routes require a tenant-scoped activity-record endpoint.')

// Bulk patching must report partial success per application instead of flattening the whole batch into failure.
expect(activity.includes('function BulkPatchResults') && activity.includes('Completed with issues') && activity.includes('Needs old-version cleanup'), 'Bulk patch job details must show per-application success, restart, cleanup and failure outcomes.')
expect(activityCss.includes('.rmm-bulk-result-summary') && activityCss.includes('.rmm-bulk-result-item'), 'Bulk patch visual results require summary and per-item styles.')
expect(agentApi.includes("serverStatus: deploymentStatus") && agentApi.includes("remediationRequired") && agentApi.includes("serverSummary"), 'Bulk Agent results must be reconciled into per-item server statuses and batch summary counts.')
expect(patchingApi.includes('evidence.upgradeVerified === true') && patchingApi.includes("return 'replace'"), 'Fully lifecycle-qualified applications must be eligible for superseded-version cleanup unless explicitly overridden.')
expect(activityApi.includes("type === 'patch.software.bulk'") && activityApi.includes('require old-version cleanup'), 'Bulk patch activity must describe mixed outcomes without recording the whole batch as a hard failure.')

// Agent upgrades must not accumulate every installer and scheduled runner forever.
expect(agentApi.includes("Filter 'Hi5CentralAgentSetup-*.exe'") && agentApi.includes("AddHours(-6)"), 'Agent upgrade dispatch must scavenge stale downloaded installers.')
expect(agentApi.includes("Filter 'installer-*.log'") && agentApi.includes("AddDays(-7)") && agentApi.includes("Select-Object -Skip 3"), 'Agent upgrade logs must be age- and count-bounded.')
expect(agentApi.includes("Remove-Item -LiteralPath $installer -Force -ErrorAction SilentlyContinue } catch"), 'Agent upgrade runner must delete a successful downloaded installer.')
expect(agentApi.includes("Remove-Item -LiteralPath $installer -Force -ErrorAction SilentlyContinue; exit 1"), 'Agent upgrade runner must delete a failed downloaded installer.')
expect(agentApi.includes("Unregister-ScheduledTask") && agentApi.includes("Hi5CentralAgentUpgrade-*"), 'Old Agent upgrade scheduled tasks must be removed before the next upgrade.')

if (failures.length) {
  console.error('RMM Device Details contract check failed:')
  for (const failure of failures) console.error('- ' + failure)
  process.exit(1)
}
console.log('RMM Device Details contract check passed.')
