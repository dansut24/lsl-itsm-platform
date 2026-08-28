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
      label: 'Request',
      viewId: 'tickets',
      key: 'requests',
      title: 'Requests',
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
      viewId: 'tickets',
      key: 'problems',
      title: 'Problems',
      filter: { type: 'Problem', priority: 'All', status: 'All' },
      query: '',
    }
  }
  return {
    label: 'Incidents',
    viewId: 'tickets',
    key: 'incidents',
    title: 'Incidents',
    filter: { type: 'Incident', priority: 'All', status: 'All' },
    query: '',
  }
}

export function tabBreadcrumbLabel(tab) {
  if (tab.key === 'incidents') return 'Incidents'
  if (tab.key === 'requests') return 'Requests'
  if (tab.key === 'problems') return 'Problems'
  return viewMeta[tab.viewId]?.label || tab.title
}

export function getBreadcrumbs(activeTab, selectedTicket) {
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
    title: overrides.title || viewMeta[viewId].label,
    pinned: overrides.pinned || false,
    recordId: overrides.recordId,
  }
}
