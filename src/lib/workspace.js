import { viewMeta } from '../data/demoData.jsx'

export function ticketPrefix(type) {
  return {
    Incident: 'INC',
    'Service Request': 'REQ',
    Change: 'CHG',
    Problem: 'PRB',
  }[type] || 'TKT'
}

export function newTicketId(type) {
  const idNumber = String(Date.now()).slice(-5)
  return `${ticketPrefix(type)}-${idNumber}`
}

export function priorityClass(priority) {
  return priority.toLowerCase().replace(/\s+/g, '-')
}

export function statusClass(status) {
  return status.toLowerCase().replace(/\s+/g, '-')
}

export function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key]
    acc[value] = (acc[value] || 0) + 1
    return acc
  }, {})
}

export function processBreadcrumb(ticket) {
  if (ticket?.type === 'Service Request') {
    return {
      label: 'Service Requests',
      viewId: 'requests',
      key: 'requests',
      title: 'Service Requests',
      filter: { type: 'Service Request', priority: 'All', status: 'All' },
      query: '',
    }
  }
  if (ticket?.type === 'Change') {
    return { label: 'Changes', viewId: 'changes', key: 'changes', title: 'Changes' }
  }
  if (ticket?.type === 'Problem') {
    return {
      label: 'Problems',
      viewId: 'problems',
      key: 'problems',
      title: 'Problems',
      filter: { type: 'Problem', priority: 'All', status: 'All' },
      query: '',
    }
  }
  return {
    label: 'Incidents',
    viewId: 'incidents',
    key: 'incidents',
    title: 'Incidents',
    filter: { type: 'Incident', priority: 'All', status: 'All' },
    query: '',
  }
}

export function tabBreadcrumbLabel(tab) {
  return viewMeta[tab.viewId]?.label || tab.title
}

export function getBreadcrumbs(activeTab, selectedTicket, selectedAsset, selectedArticle) {
  const homeCrumb = { label: 'Home', viewId: 'home', key: 'home', title: 'Dashboard' }
  if (!activeTab || activeTab.viewId === 'home') return [homeCrumb]

  if (activeTab.viewId === 'tickets' && activeTab.recordId) {
    const recordTitle = selectedTicket?.id || activeTab.title
    return [
      homeCrumb,
      processBreadcrumb(selectedTicket),
      {
        label: recordTitle,
        viewId: 'tickets',
        key: `ticket-${recordTitle}`,
        title: recordTitle,
        recordId: recordTitle,
      },
    ]
  }

  if (activeTab.assetId) {
    return [
      homeCrumb,
      { label: 'CMDB', viewId: 'cmdb', key: 'cmdb', title: 'CMDB' },
      {
        label: selectedAsset?.name || activeTab.title,
        viewId: 'cmdb',
        key: activeTab.key,
        title: selectedAsset?.name || activeTab.title,
        assetId: activeTab.assetId,
      },
    ]
  }

  if (activeTab.articleSlug) {
    return [
      homeCrumb,
      { label: 'Knowledge', viewId: 'knowledge', key: 'knowledge', title: 'Knowledge' },
      {
        label: selectedArticle?.title || activeTab.title,
        viewId: 'knowledge',
        key: activeTab.key,
        title: selectedArticle?.title || activeTab.title,
        articleSlug: activeTab.articleSlug,
      },
    ]
  }

  if (activeTab.newRecordType) {
    return [
      homeCrumb,
      processBreadcrumb({ type: activeTab.newRecordType }),
      {
        label: activeTab.title,
        viewId: 'newrecord',
        key: activeTab.key,
        title: activeTab.title,
        newRecordType: activeTab.newRecordType,
      },
    ]
  }

  if (activeTab.settingsSection) {
    return [
      homeCrumb,
      {
        label: 'Settings',
        viewId: 'settings',
        key: 'settings-appearance',
        title: 'Settings',
        settingsSection: 'appearance',
      },
      {
        label: activeTab.title,
        viewId: 'settings',
        key: activeTab.key,
        title: activeTab.title,
        settingsSection: activeTab.settingsSection,
      },
    ]
  }

  return [
    homeCrumb,
    {
      label: tabBreadcrumbLabel(activeTab),
      viewId: activeTab.viewId,
      key: activeTab.key,
      title: activeTab.title,
    },
  ]
}

export function makeTab(viewId, overrides = {}) {
  return {
    key: overrides.key || viewId,
    viewId,
    title: overrides.title || viewMeta[viewId]?.label || 'Workspace',
    pinned: overrides.pinned || false,
    recordId: overrides.recordId,
    assetId: overrides.assetId,
    articleSlug: overrides.articleSlug,
    portalRequestId: overrides.portalRequestId,
    settingsSection: overrides.settingsSection,
    newRecordType: overrides.newRecordType,
    navId: overrides.navId,
  }
}
