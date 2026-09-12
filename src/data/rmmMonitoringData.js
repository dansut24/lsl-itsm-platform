import { rmmDevices } from './rmmData.js'
import { deviceMatchesManagedGroup, rmmManagedDeviceGroups, rmmManagedSites } from './rmmScopeData.js'

export const RMM_CUSTOM_MONITORING_POLICIES_STORAGE_KEY = 'hi5central:rmm:monitoring-policies:v1'
export const RMM_CUSTOM_MONITORING_ASSIGNMENTS_STORAGE_KEY = 'hi5central:rmm:monitoring-assignments:v1'
export const RMM_DEVICE_MONITORING_OVERRIDES_STORAGE_KEY = 'hi5central:rmm:monitoring-device-overrides:v1'

// Product defaults only. Tenant assignments, overrides and estate records are
// loaded from tenant state and are never seeded into the runtime.
export const rmmMonitoringPolicies = [
  {
    id: 'MON-ENDPOINT-STD',
    name: 'Standard endpoint monitoring',
    status: 'Active',
    platform: 'Windows / macOS',
    category: 'Endpoint',
    description: 'Balanced availability, performance, storage and security monitoring for user endpoints.',
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
    description: 'Tighter thresholds and faster availability detection for production server workloads.',
    evaluation: 'Every 60 seconds',
    alertDelay: '2 minutes',
    autoResolve: true,
    checks: [
      { id: 'cpu', label: 'CPU utilisation', metric: 'CPU', condition: 'Above', warning: 80, critical: 92, unit: '%', duration: '5 min' },
      { id: 'memory', label: 'Memory utilisation', metric: 'Memory', condition: 'Above', warning: 85, critical: 95, unit: '%', duration: '5 min' },
      { id: 'disk', label: 'Disk utilisation', metric: 'Disk', condition: 'Above', warning: 82, critical: 90, unit: '%', duration: '3 min' },
      { id: 'offline', label: 'Agent availability', metric: 'Heartbeat', condition: 'Missing for', warning: 3, critical: 5, unit: 'min', duration: 'Immediate' },
      { id: 'patch', label: 'Patch compliance', metric: 'Patch compliance', condition: 'Below', warning: 90, critical: 75, unit: '%', duration: '30 min' },
    ],
  },
  {
    id: 'MON-NETWORK',
    name: 'Network monitoring',
    status: 'Active',
    platform: 'Network devices',
    category: 'Infrastructure',
    description: 'Availability and response monitoring for managed network appliances.',
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

export const rmmMonitoringAssignments = Object.freeze([])
export const rmmDeviceMonitoringOverrides = Object.freeze([])

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
    window.localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []))
  } catch {
    // Local preference persistence must not break the RMM surface.
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
  const effectivePolicyId = deviceOverride?.policyId || winningAssignment?.policyId || policies[0]?.id || ''
  const policy = policies.find((item) => item.id === effectivePolicyId) || policies[0] || null

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
    assignment: deviceOverride || winningAssignment || null,
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
