import { rmmDevices } from './rmmData.js'
import { deviceMatchesManagedGroup, rmmManagedDeviceGroups, rmmManagedSites } from './rmmScopeData.js'

export const RMM_CUSTOM_MONITORING_POLICIES_STORAGE_KEY = 'hi5central:rmm:monitoring-policies:v1'
export const RMM_CUSTOM_MONITORING_ASSIGNMENTS_STORAGE_KEY = 'hi5central:rmm:monitoring-assignments:v1'
export const RMM_DEVICE_MONITORING_OVERRIDES_STORAGE_KEY = 'hi5central:rmm:monitoring-device-overrides:v1'

export const rmmMonitoringPolicies = [
  {
    id: 'MON-ENDPOINT-STD',
    name: 'Standard endpoint monitoring',
    status: 'Active',
    platform: 'Windows / macOS',
    category: 'Endpoint',
    description: 'Balanced availability, performance, storage and security monitoring for everyday user endpoints.',
    evaluation: 'Every 2 minutes',
    alertDelay: '5 minutes',
    autoResolve: true,
    checks: [
      { id: 'cpu', label: 'CPU utilisation', metric: 'CPU', condition: 'Above', warning: 85, critical: 95, unit: '%', duration: '10 min' },
      { id: 'memory', label: 'Memory utilisation', metric: 'Memory', condition: 'Above', warning: 85, critical: 95, unit: '%', duration: '10 min' },
      { id: 'disk', label: 'Disk utilisation', metric: 'Disk', condition: 'Above', warning: 85, critical: 92, unit: '%', duration: '5 min' },
      { id: 'offline', label: 'Agent availability', metric: 'Heartbeat', condition: 'Missing for', warning: 15, critical: 30, unit: 'min', duration: 'Immediate' },
      { id: 'security', label: 'Endpoint protection', metric: 'Security health', condition: 'Not healthy', warning: null, critical: null, unit: '', duration: 'Immediate' },
    ],
  },
  {
    id: 'MON-SERVER-PROD',
    name: 'Production Windows Server',
    status: 'Active',
    platform: 'Windows Server',
    category: 'Server',
    description: 'Tighter thresholds and faster availability detection for production Windows Server workloads.',
    evaluation: 'Every 60 seconds',
    alertDelay: '2 minutes',
    autoResolve: true,
    checks: [
      { id: 'cpu', label: 'CPU utilisation', metric: 'CPU', condition: 'Above', warning: 80, critical: 92, unit: '%', duration: '5 min' },
      { id: 'memory', label: 'Memory utilisation', metric: 'Memory', condition: 'Above', warning: 85, critical: 95, unit: '%', duration: '5 min' },
      { id: 'disk', label: 'Disk utilisation', metric: 'Disk', condition: 'Above', warning: 82, critical: 90, unit: '%', duration: '3 min' },
      { id: 'offline', label: 'Agent availability', metric: 'Heartbeat', condition: 'Missing for', warning: 3, critical: 5, unit: 'min', duration: 'Immediate' },
      { id: 'patch', label: 'Patch compliance', metric: 'Patch compliance', condition: 'Below', warning: 90, critical: 75, unit: '%', duration: '30 min' },
      { id: 'reboot', label: 'Pending reboot', metric: 'Reboot state', condition: 'Pending for', warning: 24, critical: 72, unit: 'hr', duration: 'Immediate' },
    ],
  },
  {
    id: 'MON-TECH',
    name: 'Technical workstation',
    status: 'Active',
    platform: 'Windows / macOS / Linux',
    category: 'Endpoint',
    description: 'Higher performance tolerance for development and engineering workstations while retaining availability and disk safeguards.',
    evaluation: 'Every 2 minutes',
    alertDelay: '5 minutes',
    autoResolve: true,
    checks: [
      { id: 'cpu', label: 'CPU utilisation', metric: 'CPU', condition: 'Above', warning: 92, critical: 98, unit: '%', duration: '15 min' },
      { id: 'memory', label: 'Memory utilisation', metric: 'Memory', condition: 'Above', warning: 90, critical: 97, unit: '%', duration: '10 min' },
      { id: 'disk', label: 'Disk utilisation', metric: 'Disk', condition: 'Above', warning: 88, critical: 95, unit: '%', duration: '5 min' },
      { id: 'offline', label: 'Agent availability', metric: 'Heartbeat', condition: 'Missing for', warning: 20, critical: 45, unit: 'min', duration: 'Immediate' },
    ],
  },
  {
    id: 'MON-VIP',
    name: 'VIP endpoint monitoring',
    status: 'Active',
    platform: 'Windows / macOS',
    category: 'Priority endpoint',
    description: 'Earlier warning thresholds and faster offline detection for VIP-tagged endpoints.',
    evaluation: 'Every 60 seconds',
    alertDelay: '2 minutes',
    autoResolve: true,
    checks: [
      { id: 'cpu', label: 'CPU utilisation', metric: 'CPU', condition: 'Above', warning: 75, critical: 90, unit: '%', duration: '10 min' },
      { id: 'memory', label: 'Memory utilisation', metric: 'Memory', condition: 'Above', warning: 75, critical: 90, unit: '%', duration: '10 min' },
      { id: 'disk', label: 'Disk utilisation', metric: 'Disk', condition: 'Above', warning: 80, critical: 90, unit: '%', duration: '5 min' },
      { id: 'offline', label: 'Agent availability', metric: 'Heartbeat', condition: 'Missing for', warning: 5, critical: 15, unit: 'min', duration: 'Immediate' },
      { id: 'security', label: 'Endpoint protection', metric: 'Security health', condition: 'Not healthy', warning: null, critical: null, unit: '', duration: 'Immediate' },
    ],
  },
  {
    id: 'MON-REMOTE',
    name: 'Remote workforce',
    status: 'Active',
    platform: 'Windows / macOS',
    category: 'Endpoint',
    description: 'Internet-friendly monitoring with longer availability tolerances for devices outside fixed corporate networks.',
    evaluation: 'Every 5 minutes',
    alertDelay: '10 minutes',
    autoResolve: true,
    checks: [
      { id: 'cpu', label: 'CPU utilisation', metric: 'CPU', condition: 'Above', warning: 90, critical: 97, unit: '%', duration: '15 min' },
      { id: 'memory', label: 'Memory utilisation', metric: 'Memory', condition: 'Above', warning: 90, critical: 97, unit: '%', duration: '15 min' },
      { id: 'disk', label: 'Disk utilisation', metric: 'Disk', condition: 'Above', warning: 88, critical: 95, unit: '%', duration: '10 min' },
      { id: 'offline', label: 'Agent availability', metric: 'Heartbeat', condition: 'Missing for', warning: 60, critical: 180, unit: 'min', duration: 'Immediate' },
    ],
  },
  {
    id: 'MON-NETWORK',
    name: 'Network monitoring',
    status: 'Active',
    platform: 'Network devices',
    category: 'Infrastructure',
    description: 'Availability and response monitoring for managed switches, firewalls and monitored network appliances.',
    evaluation: 'Every 60 seconds',
    alertDelay: '2 minutes',
    autoResolve: true,
    checks: [
      { id: 'availability', label: 'Device availability', metric: 'Ping / SNMP', condition: 'Unavailable for', warning: 2, critical: 5, unit: 'min', duration: 'Immediate' },
      { id: 'latency', label: 'Network latency', metric: 'Latency', condition: 'Above', warning: 80, critical: 150, unit: 'ms', duration: '5 min' },
      { id: 'packetloss', label: 'Packet loss', metric: 'Packet loss', condition: 'Above', warning: 5, critical: 15, unit: '%', duration: '5 min' },
    ],
  },
]

export const rmmMonitoringAssignments = [
  { id: 'ASG-ESTATE-DEFAULT', policyId: 'MON-ENDPOINT-STD', scopeType: 'Estate', scopeId: 'ALL', scopeName: 'Entire managed estate', priority: 100, source: 'Built-in', enabled: true },
  { id: 'ASG-SITE-LON-DC', policyId: 'MON-SERVER-PROD', scopeType: 'Site', scopeId: 'SITE-LON-DC', scopeName: 'London DC', priority: 220, source: 'Built-in', enabled: true },
  { id: 'ASG-SITE-REMOTE', policyId: 'MON-REMOTE', scopeType: 'Site', scopeId: 'SITE-REMOTE', scopeName: 'Remote', priority: 220, source: 'Built-in', enabled: true },
  { id: 'ASG-GRP-SERVERS', policyId: 'MON-SERVER-PROD', scopeType: 'Group', scopeId: 'GRP-SERVERS', scopeName: 'Servers', priority: 320, source: 'Built-in', enabled: true },
  { id: 'ASG-GRP-NETWORK', policyId: 'MON-NETWORK', scopeType: 'Group', scopeId: 'GRP-NETWORK', scopeName: 'Network', priority: 320, source: 'Built-in', enabled: true },
  { id: 'ASG-GRP-TECH', policyId: 'MON-TECH', scopeType: 'Group', scopeId: 'GRP-TECH', scopeName: 'Technology', priority: 320, source: 'Built-in', enabled: true },
  { id: 'ASG-GRP-VIP', policyId: 'MON-VIP', scopeType: 'Group', scopeId: 'GRP-DYN-VIP', scopeName: 'VIP endpoints', priority: 380, source: 'Built-in', enabled: true },
]

export const rmmDeviceMonitoringOverrides = [
  {
    id: 'OVR-DEV-000186',
    deviceId: 'DEV-000186',
    policyId: 'MON-SERVER-PROD',
    source: 'Built-in',
    enabled: true,
    reason: 'Tier 1 infrastructure override',
    checkOverrides: {
      disk: { warning: 80, critical: 88, duration: '2 min' },
      offline: { warning: 2, critical: 4, duration: 'Immediate' },
    },
  },
]

export function readMonitoringStoredList(key) {
  if (typeof window === 'undefined') return []
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

export function writeMonitoringStoredList(key, value) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Prototype persistence should not break the RMM UI if storage is blocked.
  }
}

export function assignmentMatchesDevice(device, assignment) {
  if (!device || !assignment?.enabled) return false
  if (assignment.scopeType === 'Estate') return true
  if (assignment.scopeType === 'Site') return device.siteId === assignment.scopeId
  if (assignment.scopeType === 'Group') return deviceMatchesManagedGroup(device, assignment.scopeId)
  if (assignment.scopeType === 'Device') return device.id === assignment.scopeId
  return false
}

function mergePolicyChecks(policy, checkOverrides = {}) {
  if (!policy) return []
  return (policy.checks || []).map((check) => ({ ...check, ...(checkOverrides?.[check.id] || {}) }))
}

export function resolveDeviceMonitoringPolicy(device, options = {}) {
  const policies = [...rmmMonitoringPolicies, ...(options.customPolicies || [])]
  const assignments = [...rmmMonitoringAssignments, ...(options.customAssignments || [])]
  const overrides = [...rmmDeviceMonitoringOverrides, ...(options.customOverrides || [])]

  const matchingAssignments = assignments
    .filter((assignment) => assignmentMatchesDevice(device, assignment))
    .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0))

  const deviceOverride = overrides
    .filter((override) => override.enabled !== false && override.deviceId === device?.id)
    .slice(-1)[0]

  const winningAssignment = matchingAssignments[matchingAssignments.length - 1]
  const effectivePolicyId = deviceOverride?.policyId || winningAssignment?.policyId || 'MON-ENDPOINT-STD'
  const policy = policies.find((item) => item.id === effectivePolicyId) || policies[0]

  const chain = matchingAssignments.map((assignment) => ({
    ...assignment,
    policy: policies.find((item) => item.id === assignment.policyId),
    winning: !deviceOverride && assignment.id === winningAssignment?.id,
  }))

  if (deviceOverride) {
    chain.push({
      id: deviceOverride.id,
      policyId: deviceOverride.policyId,
      scopeType: 'Device override',
      scopeId: deviceOverride.deviceId,
      scopeName: device?.name || deviceOverride.deviceId,
      priority: 1000,
      source: deviceOverride.source,
      policy,
      winning: true,
      reason: deviceOverride.reason,
    })
  }

  return {
    policy,
    policyId: policy?.id,
    assignment: deviceOverride || winningAssignment,
    chain,
    checks: mergePolicyChecks(policy, deviceOverride?.checkOverrides),
    override: deviceOverride || null,
  }
}

export function monitoringPolicyCoverage(policyId, options = {}) {
  return rmmDevices.filter((device) => resolveDeviceMonitoringPolicy(device, options).policyId === policyId).length
}

export function monitoringScopeDeviceCount(scopeType, scopeId) {
  if (scopeType === 'Estate') return rmmDevices.length
  if (scopeType === 'Site') return rmmDevices.filter((device) => device.siteId === scopeId).length
  if (scopeType === 'Group') return rmmDevices.filter((device) => deviceMatchesManagedGroup(device, scopeId)).length
  if (scopeType === 'Device') return rmmDevices.some((device) => device.id === scopeId) ? 1 : 0
  return 0
}

export function monitoringScopeOptions(scopeType) {
  if (scopeType === 'Estate') return [{ id: 'ALL', name: 'Entire managed estate' }]
  if (scopeType === 'Site') return rmmManagedSites.map((site) => ({ id: site.id, name: site.name }))
  if (scopeType === 'Group') return rmmManagedDeviceGroups.map((group) => ({ id: group.id, name: group.name }))
  if (scopeType === 'Device') return rmmDevices.map((device) => ({ id: device.id, name: `${device.name} · ${device.user || device.type}` }))
  return []
}
