const ALL_TICKET_FILTERS = {
  status: 'All',
  priority: 'All',
  type: 'All',
}

const LIST_ROUTES = {
  '/dashboard': {
    kind: 'workspace',
    path: '/dashboard',
    viewId: 'home',
    key: 'home',
    title: 'Dashboard',
  },
  '/tickets': {
    kind: 'workspace',
    path: '/tickets',
    viewId: 'tickets',
    key: 'tickets',
    title: 'Tickets',
    filter: ALL_TICKET_FILTERS,
    query: '',
  },
  '/incidents': {
    kind: 'workspace',
    path: '/incidents',
    viewId: 'tickets',
    key: 'incidents',
    title: 'Incidents',
    filter: { ...ALL_TICKET_FILTERS, type: 'Incident' },
    query: '',
  },
  '/requests': {
    kind: 'workspace',
    path: '/requests',
    viewId: 'tickets',
    key: 'requests',
    title: 'Requests',
    filter: { ...ALL_TICKET_FILTERS, type: 'Service Request' },
    query: '',
  },
  '/problems': {
    kind: 'workspace',
    path: '/problems',
    viewId: 'tickets',
    key: 'problems',
    title: 'Problems',
    filter: { ...ALL_TICKET_FILTERS, type: 'Problem' },
    query: '',
  },
  '/changes': {
    kind: 'workspace',
    path: '/changes',
    viewId: 'changes',
    key: 'changes',
    title: 'Changes',
  },
  '/cmdb': {
    kind: 'workspace',
    path: '/cmdb',
    viewId: 'cmdb',
    key: 'cmdb',
    title: 'CMDB',
  },
  '/knowledge': {
    kind: 'workspace',
    path: '/knowledge',
    viewId: 'knowledge',
    key: 'knowledge',
    title: 'Knowledge',
  },
  '/reports': {
    kind: 'workspace',
    path: '/reports',
    viewId: 'reports',
    key: 'reports',
    title: 'Reports',
  },
  '/settings': {
    kind: 'workspace',
    path: '/settings',
    viewId: 'settings',
    key: 'settings',
    title: 'Settings',
  },
  '/portal': {
    kind: 'workspace',
    path: '/portal',
    viewId: 'portal',
    key: 'portal',
    title: 'Self-Service',
  },
  '/new-tab': {
    kind: 'workspace',
    path: '/new-tab',
    viewId: 'newtab',
    key: 'newtab',
    title: 'New Tab',
  },
}

const ALIASES = {
  '/home': '/dashboard',
  '/self-service': '/portal',
}

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') return '/'
  const withoutTrailingSlash = pathname.replace(/\/+$/, '')
  return withoutTrailingSlash || '/'
}

function recordRoute(id, pathPrefix, type) {
  return {
    kind: 'workspace',
    path: `/${pathPrefix}/${id}`,
    viewId: 'tickets',
    key: `ticket-${id}`,
    title: id,
    recordId: id,
    filter: type ? { ...ALL_TICKET_FILTERS, type } : undefined,
    query: '',
  }
}

export function routeFromLocation(location = window.location) {
  let pathname = normalizePathname(location.pathname)
  pathname = ALIASES[pathname] || pathname

  if (pathname === '/' || pathname === '/login') {
    return {
      kind: 'login',
      path: '/login',
    }
  }

  if (LIST_ROUTES[pathname]) {
    return { ...LIST_ROUTES[pathname] }
  }

  const newTabMatch = pathname.match(/^\/new-tab\/([^/]+)$/i)
  if (newTabMatch) {
    const key = decodeURIComponent(newTabMatch[1])
    return {
      kind: 'workspace',
      path: `/new-tab/${encodeURIComponent(key)}`,
      viewId: 'newtab',
      key,
      title: 'New Tab',
    }
  }

  const recordMatch = pathname.match(
    /^\/(incidents|requests|problems|changes|tickets)\/([^/]+)$/i,
  )

  if (recordMatch) {
    const [, section, rawId] = recordMatch
    const id = decodeURIComponent(rawId).toUpperCase()
    const routeMap = {
      incidents: ['incidents', 'Incident'],
      requests: ['requests', 'Service Request'],
      problems: ['problems', 'Problem'],
      changes: ['changes', 'Change'],
      tickets: ['tickets', undefined],
    }
    const [prefix, type] = routeMap[section.toLowerCase()]
    return recordRoute(id, prefix, type)
  }

  return {
    kind: 'not-found',
    path: pathname,
  }
}

export function defaultRouteForRole(role) {
  return role === 'requester' ? { ...LIST_ROUTES['/portal'] } : { ...LIST_ROUTES['/dashboard'] }
}

export function resolveRouteForRole(route, role) {
  if (role === 'requester') {
    return defaultRouteForRole('requester')
  }

  if (route?.kind === 'workspace') {
    return route
  }

  return defaultRouteForRole('analyst')
}

function recordPrefixFromTicket(ticket, recordId = '') {
  if (ticket?.type === 'Incident') return 'incidents'
  if (ticket?.type === 'Service Request') return 'requests'
  if (ticket?.type === 'Problem') return 'problems'
  if (ticket?.type === 'Change') return 'changes'

  if (recordId.startsWith('INC-')) return 'incidents'
  if (recordId.startsWith('REQ-')) return 'requests'
  if (recordId.startsWith('PRB-')) return 'problems'
  if (recordId.startsWith('CHG-')) return 'changes'

  return 'tickets'
}

export function pathForTab(tab, tickets = []) {
  if (!tab) return '/dashboard'

  if (tab.recordId) {
    const ticket = tickets.find((item) => item.id === tab.recordId)
    return `/${recordPrefixFromTicket(ticket, tab.recordId)}/${encodeURIComponent(tab.recordId)}`
  }

  if (tab.key === 'incidents') return '/incidents'
  if (tab.key === 'requests') return '/requests'
  if (tab.key === 'problems') return '/problems'

  return {
    home: '/dashboard',
    tickets: '/tickets',
    portal: '/portal',
    changes: '/changes',
    cmdb: '/cmdb',
    knowledge: '/knowledge',
    reports: '/reports',
    settings: '/settings',
    newtab: tab.key && tab.key !== 'newtab' ? `/new-tab/${encodeURIComponent(tab.key)}` : '/new-tab',
  }[tab.viewId] || '/dashboard'
}

export function writeRoute(path, { replace = false } = {}) {
  const normalizedPath = normalizePathname(path)
  if (normalizePathname(window.location.pathname) === normalizedPath) return

  const method = replace ? 'replaceState' : 'pushState'
  window.history[method]({}, '', normalizedPath)
}

export function allTicketFilters() {
  return { ...ALL_TICKET_FILTERS }
}
