import { deploymentConfig } from './deploymentConfig.js'

function normaliseSlug(value = '') {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
}

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function urlMatchesOrigin(url, location) {
  if (!url) return false
  try {
    return new URL(url).origin.toLowerCase() === String(location.origin || '').toLowerCase()
  } catch {
    return false
  }
}

function singleTenantSurface(location, config) {
  const pathname = String(location.pathname || '/')
  const tenantSlug = normaliseSlug(config.primaryTenantSlug)
  const tenantName = tenantDisplayName(tenantSlug)

  if (pathname === '/signup' || pathname.startsWith('/signup/')) {
    return {
      kind: 'marketing',
      tenantSlug: '',
      tenantName: 'Hi5Central',
      canonical: true,
      preview: false,
      pathBased: false,
    }
  }

  if (urlMatchesOrigin(config.portalUrl, location) && !urlMatchesOrigin(config.appUrl, location)) {
    return {
      kind: 'portal',
      tenantSlug,
      tenantName,
      canonical: true,
      preview: false,
      pathBased: false,
    }
  }

  if (urlMatchesOrigin(config.rmmUrl, location) && !urlMatchesOrigin(config.appUrl, location)) {
    return {
      kind: 'rmm',
      tenantSlug,
      tenantName,
      canonical: true,
      preview: false,
      pathBased: false,
    }
  }

  if (pathname === '/portal' || pathname.startsWith('/portal/')) {
    return {
      kind: 'portal',
      tenantSlug,
      tenantName,
      canonical: true,
      preview: false,
      pathBased: true,
    }
  }

  if (pathname === '/rmm' || pathname.startsWith('/rmm/')) {
    return {
      kind: 'rmm',
      tenantSlug,
      tenantName,
      canonical: true,
      preview: false,
      pathBased: true,
    }
  }

  return {
    kind: 'workspace',
    tenantSlug,
    tenantName,
    canonical: true,
    preview: false,
    pathBased: false,
  }
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
  const config = deploymentConfig()
  const hostname = String(location.hostname || '').toLowerCase()
  const pathname = String(location.pathname || '/')
  const params = new URLSearchParams(location.search || '')

  if (config.tenancyMode === 'single') return singleTenantSurface(location, config)

  const rootDomain = escapeRegex(config.rootDomain)
  const rootHost = config.rootDomain.toLowerCase()

  if (hostname === rootHost || hostname === `www.${rootHost}`) {
    return {
      kind: 'marketing',
      tenantSlug: '',
      tenantName: 'Hi5Central',
      canonical: true,
      preview: false,
      pathBased: false,
    }
  }

  // Keep /signup testable on localhost/Vercel without changing the default
  // development surface for those hosts.
  if (pathname === '/signup' && !hostname.endsWith(`.${rootHost}`)) {
    return {
      kind: 'marketing',
      tenantSlug: '',
      tenantName: 'Hi5Central',
      canonical: false,
      preview: true,
      pathBased: false,
    }
  }

  const rmmHost = hostname.match(new RegExp(`^([a-z0-9-]+)-rmm\\.${rootDomain}$`, 'i'))
  if (rmmHost) {
    const tenantSlug = normaliseSlug(rmmHost[1])
    return {
      kind: 'rmm',
      tenantSlug,
      tenantName: tenantDisplayName(tenantSlug),
      canonical: true,
      preview: false,
      pathBased: false,
    }
  }

  const portalHost = hostname.match(new RegExp(`^([a-z0-9-]+)-portal\\.${rootDomain}$`, 'i'))
  if (portalHost) {
    const tenantSlug = normaliseSlug(portalHost[1])
    return {
      kind: 'portal',
      tenantSlug,
      tenantName: tenantDisplayName(tenantSlug),
      canonical: true,
      preview: false,
      pathBased: false,
    }
  }

  const tenantHost = hostname.match(new RegExp(`^([a-z0-9-]+)\\.${rootDomain}$`, 'i'))
  const tenantSlug = tenantHost && !['admin', 'api', 'reseller', 'downloads', 'turn', 'rmm'].includes(tenantHost[1])
    ? normaliseSlug(tenantHost[1])
    : config.primaryTenantSlug

  if (tenantHost) {
    return {
      kind: 'workspace',
      tenantSlug,
      tenantName: tenantDisplayName(tenantSlug),
      canonical: true,
      preview: false,
      pathBased: false,
    }
  }

  // Keep route-based previews while development/test environments still use
  // a single origin. Production multi-tenant traffic uses dedicated hosts.
  const rmmPreviewSlug = normaliseSlug(params.get('rmm') || '')
  if (rmmPreviewSlug || pathname === '/rmm' || pathname.startsWith('/rmm/')) {
    const rmmTenantSlug = rmmPreviewSlug || config.primaryTenantSlug
    return {
      kind: 'rmm',
      tenantSlug: rmmTenantSlug,
      tenantName: tenantDisplayName(rmmTenantSlug),
      canonical: false,
      preview: true,
      pathBased: true,
    }
  }

  const previewSlug = normaliseSlug(params.get('portal') || '')
  if (previewSlug || pathname === '/portal' || pathname.startsWith('/portal/')) {
    const portalTenantSlug = previewSlug || config.primaryTenantSlug
    return {
      kind: 'portal',
      tenantSlug: portalTenantSlug,
      tenantName: tenantDisplayName(portalTenantSlug),
      canonical: false,
      preview: true,
      pathBased: true,
    }
  }

  return {
    kind: 'workspace',
    tenantSlug,
    tenantName: tenantDisplayName(tenantSlug),
    canonical: false,
    preview: true,
    pathBased: false,
  }
}

export function portalRouteFromLocation(surface, location = window.location) {
  const pathname = String(location.pathname || '/')
  const patterns = surface?.pathBased
    ? [/^\/portal\/requests\/([^/]+)$/i, /^\/requests\/([^/]+)$/i]
    : [/^\/requests\/([^/]+)$/i]

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
  return surface?.pathBased || !surface?.canonical ? '/portal' : '/'
}

export function portalRequestPath(surface, id) {
  const encoded = encodeURIComponent(String(id || '').toUpperCase())
  return surface?.pathBased || !surface?.canonical ? `/portal/requests/${encoded}` : `/requests/${encoded}`
}

export function rmmRouteFromLocation(surface = resolveTenantSurface(), location = window.location) {
  const pathname = String(location.pathname || '/')
  const prefix = surface?.pathBased || !surface?.canonical ? '/rmm' : ''
  const normalized = prefix && pathname.startsWith(prefix) ? pathname.slice(prefix.length) || '/' : pathname

  const deviceMatch = normalized.match(/^\/devices\/([^/]+)$/i)
  if (deviceMatch) {
    const deviceId = decodeURIComponent(deviceMatch[1]).toUpperCase()
    return { viewId: 'devices', deviceId, path: rmmPath(surface, 'devices', deviceId) }
  }

  const pageMatch = normalized.match(/^\/(dashboard|devices|sites|groups|alerts|remote|patching|software|automation|policies|jobs|reports|settings)$/i)
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
  return surface?.pathBased || !surface?.canonical
    ? `/rmm${canonicalPath === '/' ? '' : canonicalPath}`
    : canonicalPath
}
