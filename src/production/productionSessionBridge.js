const API_BASE = 'https://api.hi5central.com'
const AUTH_HANDOFF_KEY = 'hi5central-auth-handoff-v1'
const HANDOFF_MAX_AGE_MS = 2 * 60 * 1000
const SESSION_TIMEOUT_MS = 8000
const INSTALL_FLAG = '__hi5centralProductionSessionBridgeInstalled'

function tenantSlugFromHost() {
  const host = window.location.hostname.toLowerCase()
  const match = host.match(/^([a-z0-9-]+)\.hi5central\.com$/)
  if (!match) return ''
  const slug = match[1]
  if (slug.endsWith('-portal') || slug.endsWith('-rmm')) return ''
  return slug
}

function takeAuthHandoff() {
  try {
    const raw = window.sessionStorage.getItem(AUTH_HANDOFF_KEY)
    if (!raw) return null

    const stored = JSON.parse(raw)
    const payload = stored?.payload || stored
    const createdAt = Number(stored?.createdAt || 0)
    const tenantSlug = tenantSlugFromHost()

    const stale = createdAt > 0 && Date.now() - createdAt > HANDOFF_MAX_AGE_MS
    const valid = !stale
      && payload?.authenticated === true
      && payload?.tenant?.slug === tenantSlug

    window.sessionStorage.removeItem(AUTH_HANDOFF_KEY)
    return valid ? payload : null
  } catch {
    try {
      window.sessionStorage.removeItem(AUTH_HANDOFF_KEY)
    } catch {
      // Ignore storage failures; the HttpOnly session cookie remains authoritative.
    }
    return null
  }
}

function requestUrl(input) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url
  return ''
}

function requestMethod(input, init) {
  if (init?.method) return String(init.method).toUpperCase()
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method.toUpperCase()
  return 'GET'
}

function isSessionLookup(input, init) {
  if (requestMethod(input, init) !== 'GET') return false
  try {
    return new URL(requestUrl(input), window.location.origin).href === `${API_BASE}/api/v1/auth/session`
  } catch {
    return false
  }
}

export function installProductionSessionBridge() {
  if (window[INSTALL_FLAG]) return
  window[INSTALL_FLAG] = true

  const nativeFetch = window.fetch.bind(window)

  window.fetch = async function hi5centralFetch(input, init = undefined) {
    if (!isSessionLookup(input, init)) return nativeFetch(input, init)

    const handoff = takeAuthHandoff()
    if (handoff) {
      return new Response(JSON.stringify(handoff), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const controller = new AbortController()
    const sourceSignal = init?.signal
      || (typeof Request !== 'undefined' && input instanceof Request ? input.signal : null)

    const abortFromSource = () => controller.abort(sourceSignal?.reason)
    if (sourceSignal?.aborted) abortFromSource()
    else sourceSignal?.addEventListener?.('abort', abortFromSource, { once: true })

    const timer = window.setTimeout(() => controller.abort(), SESSION_TIMEOUT_MS)

    try {
      return await nativeFetch(input, { ...(init || {}), signal: controller.signal })
    } finally {
      window.clearTimeout(timer)
      sourceSignal?.removeEventListener?.('abort', abortFromSource)
    }
  }
}
