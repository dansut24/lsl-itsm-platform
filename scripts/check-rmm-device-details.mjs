import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const bootstrap = read('src/production/ProductionRmmBootstrap.jsx')
const platform = read('src/features/rmm/RmmPlatformApp.jsx')
const tools = read('src/features/rmm/RmmDeviceTools.jsx')
const toolCss = read('src/features/rmm/RmmDeviceTools.css')
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

// Registry must start at an explicit root chooser; API must reject empty roots.
expect(tools.includes("useState('')") && tools.includes('Select a registry hive') && tools.includes('HKEY_LOCAL_MACHINE'), 'Registry Editor must start at the hive chooser.')
expect(!tools.includes("useEffect(() => { load('HKLM:\\')"), 'Registry Editor must not auto-read HKLM on open.')
expect(toolApi.includes('Select a registry hive before reading registry data.'), 'Registry API must reject implicit/default hive reads.')

// Users & Sessions must surface inventory users, admins, and interactive sessions.
expect(tools.includes('device.inventory?.local_users') && tools.includes('Local administrators') && tools.includes('Interactive sessions'), 'Users & Sessions must show local users, admins and Windows sessions.')
expect(tools.includes('device.inventory?.security?.local_admins'), 'Users & Sessions must consume the Agent local-admin inventory.')

// Mobile embedded tools belong to page flow rather than a fixed mini viewport.
expect(toolCss.includes('.rmm-device-tool-workspace.is-embedded {\n    height: auto;') && toolCss.includes('overflow-y: visible;'), 'Embedded mobile tools must allow page-owned vertical scrolling.')
expect(toolCss.includes('contain: inline-size;') && toolCss.includes('overflow-x: clip;'), 'Embedded mobile tools must not widen or horizontally pan the Device Details page.')
expect(toolCss.includes('.rmm-device-tool-workspace.is-embedded .rmm-tool-table-head {\n    display: none;') && toolCss.includes('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;'), 'Phone tool tables must collapse to viewport-width cards instead of desktop-width horizontal tables.')
expect(activity.includes('window.setInterval(() => load(true), 5000)'), 'Device Activity must live-refresh silently while its tab is open.')

if (failures.length) {
  console.error('RMM Device Details contract check failed:')
  for (const failure of failures) console.error('- ' + failure)
  process.exit(1)
}
console.log('RMM Device Details contract check passed.')
