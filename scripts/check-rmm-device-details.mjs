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
const recoveryApi = read('api/src/rmmRecoveryKeys.js')
const recoveryMigration = read('api/migrations/088_endpoint_intelligence_bitlocker_recovery.sql')
const accessApi = read('api/src/access.js')

const failures = []
const expect = (value, message) => { if (!value) failures.push(message) }

// Live memory must win over stale/empty inventory memory.
expect(deviceApi.includes('AS agent_memory_total_bytes') && deviceApi.includes('AS agent_memory_used_bytes'), 'Device API must expose live Agent memory byte counters.')
expect(bootstrap.includes('row.agent_memory_total_bytes || row.memory_bytes'), 'Device model must prefer live Agent memory over inventory fallback.')
expect(platform.includes('device.memoryUsedBytes') && platform.includes('Installed RAM'), 'Device Details must show live memory context.')

// Device patch compliance must come from real qualified/installable software state plus Windows Update inventory.
expect(deviceApi.includes('agent_patch_current_count') && deviceApi.includes('patch_state.current_count') && deviceApi.includes('rmm_device_patch_rejections'), 'Device API must expose real patch-state counts and honour device patch exceptions.')
expect(!bootstrap.includes('patchCompliance: null') && bootstrap.includes('agent_patch_pending_count') && bootstrap.includes('pendingWindowsPatches'), 'Production device mapping must calculate patch compliance and keep software/Windows pending counts separate.')
expect(platform.includes('patchPendingText') && platform.includes("selectSection('patching')"), 'Patch compliance card must show the real pending breakdown and open the Patching tab.')

// Header controls should use durable device workspaces and audited power actions.
expect(toolApi.includes("'/api/v1/rmm/devices/:agentDeviceId/power'") && toolApi.includes("source: 'device_power_action'"), 'Device power actions must use a dedicated authenticated/audited endpoint.')
expect(platform.includes('async function restartDevice') && platform.includes("selectSection('tools')") && !platform.includes('toolsOpen'), 'Device header must expose Restart and route Tools directly to the Tools tab without a duplicate popover.')
expect(platform.includes("scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })"), 'Device section navigation must scroll the active tab into view.')
expect(activityApi.includes("requestMetadata.source) === 'device_power_action'") && activity.includes("powerAction === 'restart'"), 'Restart actions must be human-readable in Activity rather than exposed as custom commands.')

// Hardware/software inventory should expose useful fields the Agent already collects.
expect(platform.includes('GPU & displays') && platform.includes('Battery & power') && platform.includes('Volumes & encryption'), 'Hardware tab must expose graphics, battery and storage inventory.')
expect(platform.includes('Plugged in · fully charged') && platform.includes('Plugged in · not actively charging') && platform.includes('On battery'), 'Battery UI must distinguish AC connection from the Windows active-charging flag.')
expect(bootstrap.includes('cpuLogicalProcessors') && bootstrap.includes('deviceUuid') && bootstrap.includes('storageVolumes'), 'Production device mapping must retain richer hardware inventory.')
expect(platform.includes('Scope / size') && platform.includes('softwareScopeLabel(app.scope)'), 'Software inventory must expose install scope and reported size.')

// Deep endpoint intelligence must be technician-findable rather than merely stored in source_payload.
expect(platform.includes("['windows', 'Windows', Settings]") && platform.includes('function DeviceWindows'), 'Device Details must expose a dedicated Windows intelligence tab.')
expect(platform.includes('Physical memory modules') && platform.includes('Disks & SMART health') && platform.includes('Physical monitors') && platform.includes('USB devices'), 'Hardware must expose DIMMs, physical disk health, monitor identity and USB inventory.')
expect(platform.includes('IP & DHCP configuration') && platform.includes('Wi-Fi interfaces') && platform.includes('Default routes'), 'Hardware/network inventory must expose DHCP/DNS, Wi-Fi and routing detail.')
expect(platform.includes('Installed updates / KB history') && platform.includes('Installed device drivers') && platform.includes('Local user accounts') && platform.includes('Scheduled tasks') && platform.includes('Enabled optional features'), 'Windows tab must expose update, driver, account, task and optional-feature inventory.')
expect(platform.includes('Microsoft Defender') && platform.includes('Windows Firewall profiles') && platform.includes('Machine certificates') && platform.includes('BitLockerRecoveryPanel'), 'Security tab must expose Defender, firewall, machine-certificate and BitLocker recovery detail.')
expect(bootstrap.includes('memoryModules') && bootstrap.includes('physicalDisks') && bootstrap.includes('machineCertificates') && bootstrap.includes('directoryJoin') && bootstrap.includes('wifiInterfaces'), 'Production device mapping must preserve deep endpoint inventory.')

// BitLocker recovery secrets must live outside ordinary inventory and use a privileged audited reveal path.
expect(accessApi.includes("'rmm.security.recovery_keys.read'"), 'Recovery-key reveal permission is missing.')
expect(recoveryMigration.includes('rmm_bitlocker_recovery_keys') && recoveryMigration.includes('recovery_password_encrypted'), 'Dedicated encrypted BitLocker recovery-key storage is missing.')
expect(recoveryApi.includes("createCipheriv('aes-256-gcm'") && recoveryApi.includes('RMM_RECOVERY_KEY_ENCRYPTION_KEY'), 'BitLocker recovery escrow must use dedicated AES-256-GCM key material.')
expect(recoveryApi.includes("eventType: 'bitlocker.recovery_key.revealed'") && recoveryApi.includes('reason.length < 3'), 'Recovery-key reveal must require a reason and write an audit event.')
expect(recoveryApi.includes("Cache-Control', 'no-store, private'"), 'Recovery-key reveal responses must be non-cacheable.')
expect(agentApi.includes('bitLockerRecoveryEscrowNeeded') && agentApi.includes("type: 'bitlocker_recovery_escrow_request'") && agentApi.includes("versionCompare(agent.agent_version, '0.1.171') < 0"), 'Inventory ingest must request escrow only from Agent 0.1.171+ when a recovery protector is unescrowed.')
expect(agentApi.includes('MAX_INVENTORY_BYTES = 8 * 1024 * 1024'), 'Endpoint intelligence WebSocket must support the bounded 8 MiB inventory payload.')
expect(toolApi.includes("bitlocker-recovery/escrow") && toolApi.includes("versionAtLeast(device.agent_version, '0.1.171')"), 'Manual recovery-key escrow must be available only to the supporting Agent release.')
expect(platform.includes('Reveal recovery key') && platform.includes('Why do you need to reveal this BitLocker recovery key?') && platform.includes('60_000'), 'Recovery-key UI must require an audited reason and automatically hide the secret.')
expect(recoveryApi.includes('microsoftBitLockerRecoveryKeysForInventory') && recoveryApi.includes('revealMicrosoftBitLockerRecoveryKeyForInventory'), 'Recovery-key API must support Microsoft Entra backup as well as Agent escrow.')
expect(platform.includes('Microsoft Entra recovery backup') && platform.includes('Reveal Entra key') && platform.includes('Also escrow in Hi5Central'), 'Recovery-key UI must show Microsoft Entra recovery keys and offer local escrow as an independent backup.')
expect(platform.includes('BitLockerKey.Read.All') && platform.includes('Permission required'), 'Recovery-key UI must clearly identify missing Microsoft Graph recovery permission.')

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
expect(activity.includes('function HumanJobDetails') && activity.includes('<HumanJobDetails job={payload} />'), 'All device-job details must use technician-friendly text instead of raw structured payloads.')
expect(!activity.includes('JSON.stringify(payload.payload') && !activity.includes('JSON.stringify(payload.result'), 'Technician activity details must never render raw Request/Result JSON.')
expect(activity.includes("type === 'patch.software'") && activity.includes("type === 'software.uninstall'") && activity.includes("type.startsWith('services.')") && activity.includes("type.startsWith('registry.')"), 'Human job details must cover software, service and registry actions.')
expect(activityCss.includes('.rmm-bulk-result-summary') && activityCss.includes('.rmm-bulk-result-item') && activityCss.includes('.rmm-job-human-grid'), 'Technician-friendly activity results require structured visual styles.')
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
