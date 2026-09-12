export const rmmManagedSites = Object.freeze([])
export const rmmManagedDeviceGroups = Object.freeze([])

export function deviceMatchesManagedGroup(device, groupId) {
  if (!groupId || groupId === 'All') return true
  const group = rmmManagedDeviceGroups.find((item) => item.id === groupId)
  if (!group) return false
  if (group.mode !== 'Dynamic') return device?.groupId === group.id || device?.group === group.name

  const rule = group.rule || {}
  if (rule.patchBelow != null && !(Number(device?.patchCompliance) < Number(rule.patchBelow))) return false
  if (rule.healthNot && device?.health === rule.healthNot) return false
  if (rule.platformIncludes && !String(device?.platform || device?.os || '').toLowerCase().includes(String(rule.platformIncludes).toLowerCase())) return false
  if (rule.tag && !(device?.tags || []).some((tag) => String(tag).toLowerCase() === String(rule.tag).toLowerCase())) return false
  return true
}

// Saved-view definitions are product UI configuration, not tenant estate data.
export const rmmDefaultSavedViews = [
  {
    id: 'VIEW-ATTENTION',
    name: 'Needs attention',
    visibility: 'Shared',
    owner: 'Hi5Central',
    builtIn: true,
    description: 'Warning, critical and offline devices.',
    filters: { quickView: 'attention', siteId: 'All', groupId: 'All', platform: 'All', health: 'All', patchState: 'All' },
    sort: { field: 'health', direction: 'desc' },
    columns: ['device', 'user', 'siteGroup', 'health', 'resources', 'patch', 'lastSeen'],
  },
]

export const RMM_SAVED_VIEWS_STORAGE_KEY = 'hi5central:rmm:saved-views:v1'
export const RMM_CUSTOM_SITES_STORAGE_KEY = 'hi5central:rmm:custom-sites:v1'
export const RMM_CUSTOM_GROUPS_STORAGE_KEY = 'hi5central:rmm:custom-groups:v1'
