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

  const rmmHost = hostname.match(/^([a-z0-9-]+)-rmm\.hi5central\.com$/i)
  if (rmmHost) {
    const tenantSlug = normaliseSlug(rmmHost[1])
    return {
      kind: 'rmm',
      tenantSlug,
      tenantName: tenantDisplayName(tenantSlug),
      canonical: true,
      preview: false,
    }
  }

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

  // Keep route-based previews while the prototype is still hosted on one
  // Vercel origin. Production RMM traffic uses the dedicated -rmm host.
  const rmmPreviewSlug = normaliseSlug(params.get('rmm') || '')
  if (rmmPreviewSlug || pathname === '/rmm' || pathname.startsWith('/rmm/')) {
    const rmmTenantSlug = rmmPreviewSlug || 'demo-tenant'
    return {
      kind: 'rmm',
      tenantSlug: rmmTenantSlug,
      tenantName: tenantDisplayName(rmmTenantSlug),
      canonical: false,
      preview: true,
    }
  }

  // Production portal traffic uses the dedicated -portal host.
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


export function rmmRouteFromLocation(surface = resolveTenantSurface(), location = window.location) {
  const pathname = String(location.pathname || '/')
  const prefix = surface?.canonical ? '' : '/rmm'
  const normalized = prefix && pathname.startsWith(prefix) ? pathname.slice(prefix.length) || '/' : pathname

  const deviceMatch = normalized.match(/^\/devices\/([^/]+)$/i)
  if (deviceMatch) {
    const deviceId = decodeURIComponent(deviceMatch[1]).toUpperCase()
    return { viewId: 'devices', deviceId, path: rmmPath(surface, 'devices', deviceId) }
  }

  const pageMatch = normalized.match(/^\/(dashboard|devices|alerts|remote|patching|software|automation|policies|jobs|reports|settings)$/i)
  if (pageMatch) {
    const viewId = pageMatch[1].toLowerCase()
    return { viewId, path: rmmPath(surface, viewId) }
  }

  return { viewId: 'dashboard', path: rmmPath(surface, 'dashboard') }
}

export function rmmPath(surface = resolveTenantSurface(), viewId = 'dashboard', recordId = '') {
  const page = String(viewId || 'dashboard').toLowerCase()
  const suffix = page === 'dashboard' ? '' : `/${page}`
  const recordSuffix = recordId ? `/${encodeURIComponent(String(recordId).toUpperCase())}` : ''
  const canonicalPath = `${suffix}${recordSuffix}` || '/'
  return surface?.canonical ? canonicalPath : `/rmm${canonicalPath === '/' ? '' : canonicalPath}`
}
