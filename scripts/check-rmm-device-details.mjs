import fs from 'node:fs'
import { rmmDevicePath, rmmRouteFromLocation } from '../src/lib/tenantSurface.js'

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const bootstrap = read('src/production/ProductionRmmBootstrap.jsx')
const platform = read('src/features/rmm/RmmPlatformApp.jsx')
const tools = read('src/features/rmm/RmmDeviceTools.jsx')
const toolCss = read('src/features/rmm/RmmDeviceTools.css')
const platformCss = read('src/features/rmm/RmmPlatformApp.css')
const deviceApi = read('api/src/microsoftIntegration.js')
const toolApi = read('api/src/rmmDeviceTools.js')
const activity = read('src/features/rmm/RmmActivityViews.jsx')

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
expect(platformCss.includes('.rmm-device-windows-patching-card .rmm-device-patch-table') && platformCss.includes("content: 'Reboot';"), 'Windows Update table must collapse to labelled mobile cards.')
expect(toolCss.includes('.rmm-device-tool-workspace.is-embedded .rmm-tool-table-head {\n    display: none;') && toolCss.includes('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;'), 'Phone tool tables must collapse to viewport-width cards instead of desktop-width horizontal tables.')
expect(activity.includes('window.setInterval(() => load(true), 5000)'), 'Device Activity must live-refresh silently while its tab is open.')

if (failures.length) {
  console.error('RMM Device Details contract check failed:')
  for (const failure of failures) console.error('- ' + failure)
  process.exit(1)
}
console.log('RMM Device Details contract check passed.')
