import { rmmDeviceGroups, rmmSites } from './rmmData.js'

export const rmmManagedSites = rmmSites.map((site) => ({
  ...site,
  source: site.source || 'Tenant',
  status: site.status || (Number(site.warning || 0) > 0 ? 'Attention' : 'Healthy'),
}))

export const rmmManagedDeviceGroups = rmmDeviceGroups.map((group) => ({
  ...group,
  source: group.source || 'Tenant',
}))

export function deviceMatchesManagedGroup(device, groupId) {
  if (!groupId || groupId === 'All') return true
  const group = rmmManagedDeviceGroups.find((item) => item.id === groupId)
  if (!group) return false
  if (group.mode !== 'Dynamic') return device.groupId === group.id || device.group === group.name

  const rule = group.rule || {}
  if (rule.patchBelow != null && !(Number(device.patchCompliance) < Number(rule.patchBelow))) return false
  if (rule.healthNot && device.health === rule.healthNot) return false
  if (rule.platformIncludes && !String(device.platform || device.os || '').toLowerCase().includes(String(rule.platformIncludes).toLowerCase())) return false
  if (rule.tag && !(device.tags || []).some((tag) => String(tag).toLowerCase() === String(rule.tag).toLowerCase())) return false
  return true
}

export const rmmDefaultSavedViews = []
export const RMM_SAVED_VIEWS_STORAGE_KEY = 'hi5central:rmm:saved-views:v1'
export const RMM_CUSTOM_SITES_STORAGE_KEY = 'hi5central:rmm:custom-sites:v1'
export const RMM_CUSTOM_GROUPS_STORAGE_KEY = 'hi5central:rmm:custom-groups:v1'
