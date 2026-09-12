import { rmmDevices } from './rmmData.js'
import { deviceMatchesManagedGroup, rmmManagedDeviceGroups, rmmManagedSites } from './rmmScopeData.js'

export const RMM_CUSTOM_MONITORING_POLICIES_STORAGE_KEY = 'hi5central:rmm:monitoring-policies:v1'
export const RMM_CUSTOM_MONITORING_ASSIGNMENTS_STORAGE_KEY = 'hi5central:rmm:monitoring-assignments:v1'
export const RMM_DEVICE_MONITORING_OVERRIDES_STORAGE_KEY = 'hi5central:rmm:monitoring-device-overrides:v1'

export const rmmMonitoringPolicies = []

export const rmmMonitoringAssignments = []

export const rmmDeviceMonitoringOverrides = []

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
