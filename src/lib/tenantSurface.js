function normaliseSlug(value = '') {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
}

export function tenantDisplayName(slug = '') {
  const normalized = normaliseSlug(slug)
  if (!normalized) return 'Your organisation'
  return normalized
    .split('-')
    .filter(Boolean)
    .map((part) => part.length <= 3 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

export function resolveTenantSurface(location = window.location) {
  const hostname = String(location.hostname || '').toLowerCase()
  const pathname = String(location.pathname || '/')
  const params = new URLSearchParams(location.search || '')

  const portalHost = hostname.match(/^([a-z0-9-]+)-portal\.hi5central\.com$/i)
  if (portalHost) {
    const tenantSlug = normaliseSlug(portalHost[1])
    return {
      kind: 'portal',
      tenantSlug,
      tenantName: tenantDisplayName(tenantSlug),
      canonical: true,
      preview: false,
    }
  }

  const tenantHost = hostname.match(/^([a-z0-9-]+)\.hi5central\.com$/i)
  const tenantSlug = tenantHost && !['admin', 'api', 'reseller', 'downloads', 'turn', 'rmm'].includes(tenantHost[1])
    ? normaliseSlug(tenantHost[1])
    : 'demo-tenant'

  // A real tenant host remains the technician workspace even when somebody
  // manually enters /portal. The self-service surface exists on -portal only.
  if (tenantHost) {
    return {
      kind: 'workspace',
      tenantSlug,
      tenantName: tenantDisplayName(tenantSlug),
      canonical: true,
      preview: false,
    }
  }

  // Keep a route-based preview while the prototype is still hosted on one
  // Vercel origin. Production portal traffic uses the dedicated -portal host.
  const previewSlug = normaliseSlug(params.get('portal') || '')
  if (previewSlug || pathname === '/portal' || pathname.startsWith('/portal/')) {
    const portalTenantSlug = previewSlug || 'demo-tenant'
    return {
      kind: 'portal',
      tenantSlug: portalTenantSlug,
      tenantName: tenantDisplayName(portalTenantSlug),
      canonical: false,
      preview: true,
    }
  }

  return {
    kind: 'workspace',
    tenantSlug,
    tenantName: tenantDisplayName(tenantSlug),
    canonical: false,
    preview: true,
  }
}

export function portalRouteFromLocation(surface, location = window.location) {
  const pathname = String(location.pathname || '/')
  const patterns = surface?.canonical
    ? [/^\/requests\/([^/]+)$/i]
    : [/^\/portal\/requests\/([^/]+)$/i, /^\/requests\/([^/]+)$/i]

  for (const pattern of patterns) {
    const match = pathname.match(pattern)
    if (!match) continue
    const id = decodeURIComponent(match[1]).toUpperCase()
    return {
      kind: 'workspace',
      path: portalRequestPath(surface, id),
      viewId: 'portal',
      key: `portal-request-${id}`,
      title: id,
      portalRequestId: id,
    }
  }

  return {
    kind: 'workspace',
    path: portalHomePath(surface),
    viewId: 'portal',
    key: 'portal',
    title: 'Self-Service',
  }
}

export function portalHomePath(surface) {
  return surface?.canonical ? '/' : '/portal'
}

export function portalRequestPath(surface, id) {
  const encoded = encodeURIComponent(String(id || '').toUpperCase())
  return surface?.canonical ? `/requests/${encoded}` : `/portal/requests/${encoded}`
}
