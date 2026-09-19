import { rmmDevices } from './rmmData.js'

export const RMM_CUSTOM_MONITORING_POLICIES_STORAGE_KEY = 'hi5central:rmm:monitoring-policies:v1'
export const RMM_CUSTOM_MONITORING_ASSIGNMENTS_STORAGE_KEY = 'hi5central:rmm:monitoring-assignments:v1'
export const RMM_DEVICE_MONITORING_OVERRIDES_STORAGE_KEY = 'hi5central:rmm:monitoring-device-overrides:v1'

// Tenant monitoring records are created explicitly. Nothing is inserted into a production tenant by default.
export const rmmMonitoringPolicies = []

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
  if (assignment.scopeType === 'Group') return device.groupId === assignment.scopeId || device.group === assignment.scopeName
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
  const devices = options.devices || rmmDevices
  return devices.filter((device) => resolveDeviceMonitoringPolicy(device, options).policyId === policyId).length
}

export function monitoringScopeDeviceCount(scopeType, scopeId, options = {}) {
  const devices = options.devices || rmmDevices
  if (scopeType === 'Estate') return devices.length
  if (scopeType === 'Site') return devices.filter((device) => device.siteId === scopeId).length
  if (scopeType === 'Group') return devices.filter((device) => device.groupId === scopeId || device.group === scopeId).length
  if (scopeType === 'Device') return devices.some((device) => device.id === scopeId) ? 1 : 0
  return 0
}

export function monitoringScopeOptions(scopeType, options = {}) {
  const devices = options.devices || rmmDevices
  const sites = options.sites || []
  const groups = options.groups || []
  if (scopeType === 'Estate') return [{ id: 'ALL', name: 'Entire managed estate' }]
  if (scopeType === 'Site') return sites.filter((site) => site.active !== false).map((site) => ({ id: site.id, name: site.name }))
  if (scopeType === 'Group') return groups.map((group) => ({ id: group.id, name: group.name }))
  if (scopeType === 'Device') return devices.map((device) => ({ id: device.id, name: `${device.name} · ${device.user || device.type}` }))
  return []
}
