import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck } from 'lucide-react'
import App from '../App.jsx'
import { OnboardingWizard } from '../features/onboarding/OnboardingWizard.jsx'
import { ProductionSettingsWorkspace } from '../features/settings/ProductionSettingsWorkspace.jsx'
import { resolveTenantSurface } from '../lib/tenantSurface.js'
import {
  clearProductionSession,
  saveAccent,
  saveProductionSession,
  saveTheme,
} from '../services/demoStore.js'
import './ProductionWorkspaceBootstrap.css'

const API_BASE = 'https://api.hi5central.com'
const PRODUCTION_SESSION_KEY = 'hi5central-production-session-v1'
const TENANT_RUNTIME_CONFIG_KEY = 'hi5central-tenant-runtime-config-v1'

function initials(name = '') {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'HC'
}

function effectiveSettings(apiSession) {
  return apiSession?.settings && Object.keys(apiSession.settings).length
    ? apiSession.settings
    : apiSession?.onboarding?.data || {}
}

function toWorkspaceSession(apiSession) {
  return {
    role: 'analyst',
    source: 'production',
    tenantRole: apiSession.user.tenantRole,
    userId: apiSession.user.id,
    tenantId: apiSession.tenant.id,
    tenantSlug: apiSession.tenant.slug,
    name: apiSession.user.name,
    initials: initials(apiSession.user.name),
    username: apiSession.user.email,
    tenant: apiSession.tenant,
    user: apiSession.user,
    onboarding: apiSession.onboarding,
    settings: effectiveSettings(apiSession),
  }
}

function applyTenantPreferences(apiSession) {
  const configuration = effectiveSettings(apiSession)
  const theme = configuration.theme || {}
  const itsm = configuration.itsm || {}

  if (['system', 'light', 'dark'].includes(theme.mode)) saveTheme(theme.mode)
  if (['amber', 'cyan', 'blue', 'violet', 'emerald', 'rose'].includes(theme.accent)) saveAccent(theme.accent)

  try {
    window.localStorage.setItem(TENANT_RUNTIME_CONFIG_KEY, JSON.stringify({
      tenantSlug: apiSession?.tenant?.slug || '',
      theme: {
        mode: theme.mode || 'system',
        accent: theme.accent || 'amber',
      },
      recordNumbering: {
        mode: itsm.numberingMode || 'default',
        prefixes: itsm.recordPrefixes || {},
        digits: itsm.recordDigits || '5',
      },
      microsoft365: configuration.users?.microsoft365 || {},
      itsm,
      rmm: configuration.rmm || {},
    }))
  } catch {
    // Local runtime preferences are a bridge for the current demo UI.
  }
}

function LoadingScreen({ tenantName }) {
  return (
    <div className="production-auth-shell">
      <div className="production-auth-card production-auth-loading">
        <img src="/hi5central-logo.png" alt="" />
        <strong>Opening {tenantName}</strong>
        <span>Checking your secure Hi5Central session…</span>
      </div>
    </div>
  )
}

function ProductionLogin({ tenant, onAuthenticated }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: tenant.slug,
          email: form.email,
          password: form.password,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Sign in failed.')
      onAuthenticated(payload)
    } catch (loginError) {
      setError(loginError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="production-auth-shell">
      <div className="production-auth-layout">
        <section className="production-auth-copy">
          <img src="/hi5central-logo.png" alt="" />
          <span className="production-auth-kicker"><ShieldCheck size={15} /> Secure tenant sign-in</span>
          <h1>Welcome back to {tenant.companyName || tenant.slug}.</h1>
          <p>Sign in with the administrator or technician account assigned to this Hi5Central tenant.</p>
          <div className="production-auth-points">
            <span><CheckCircle2 size={17} /> Tenant-isolated session</span>
            <span><CheckCircle2 size={17} /> HttpOnly secure cookie</span>
            <span><CheckCircle2 size={17} /> PostgreSQL-backed identity</span>
          </div>
        </section>

        <form className="production-auth-card" onSubmit={submit}>
          <div className="production-auth-card-heading">
            <span className="production-auth-icon"><LockKeyhole size={19} /></span>
            <div><span>Hi5Central ITSM</span><strong>{tenant.slug}.hi5central.com</strong></div>
          </div>

          {tenant.status === 'pending_verification' ? (
            <div className="production-auth-notice">
              This workspace is waiting for its owner email to be verified. Use the verification email sent during signup before signing in.
            </div>
          ) : null}

          <label>
            <span>Email address</span>
            <input type="email" autoComplete="username" required value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label>
            <span>Password</span>
            <input type="password" autoComplete="current-password" required value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
          </label>

          {error ? <div className="production-auth-error">{error}</div> : null}

          <button type="submit" disabled={submitting || tenant.status !== 'active'}>
            {submitting ? 'Signing in…' : 'Sign in'}
            {!submitting ? <ArrowRight size={17} /> : null}
          </button>
          <a href="https://hi5central.com">Back to hi5central.com</a>
        </form>
      </div>
    </div>
  )
}

function ProductionSettingsLayer({ currentPath, session, onSessionChange }) {
  const [target, setTarget] = useState(null)

  useEffect(() => {
    let mountedTarget = null

    const attach = () => {
      const nextTarget = document.querySelector('.content-frame')
      if (!(nextTarget instanceof HTMLElement)) return false

      if (mountedTarget && mountedTarget !== nextTarget) {
        mountedTarget.classList.remove('production-settings-mounted')
      }

      mountedTarget = nextTarget
      mountedTarget.classList.add('production-settings-mounted')
      setTarget(nextTarget)
      return true
    }

    if (attach()) {
      return () => mountedTarget?.classList.remove('production-settings-mounted')
    }

    const observer = new MutationObserver(() => {
      if (attach()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mountedTarget?.classList.remove('production-settings-mounted')
    }
  }, [])

  if (!target) return null

  return createPortal(
    <ProductionSettingsWorkspace
      currentPath={currentPath}
      onSessionChange={onSessionChange}
      session={session}
    />,
    target,
  )
}

export function ProductionWorkspaceBootstrap() {
  const surface = useMemo(() => resolveTenantSurface(), [])
  const [serverSession, setServerSession] = useState(null)
  const [tenantState, setTenantState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const notify = () => setCurrentPath(window.location.pathname)
    const originalPushState = window.history.pushState
    const originalReplaceState = window.history.replaceState

    window.history.pushState = function patchedPushState(...args) {
      const result = originalPushState.apply(this, args)
      notify()
      return result
    }
    window.history.replaceState = function patchedReplaceState(...args) {
      const result = originalReplaceState.apply(this, args)
      notify()
      return result
    }

    window.addEventListener('popstate', notify)
    window.addEventListener('hi5-routechange', notify)

    return () => {
      window.history.pushState = originalPushState
      window.history.replaceState = originalReplaceState
      window.removeEventListener('popstate', notify)
      window.removeEventListener('hi5-routechange', notify)
    }
  }, [])

  useEffect(() => {
    let active = true

    async function bootstrap() {
      try {
        const response = await fetch(`${API_BASE}/api/v1/auth/session`, {
          credentials: 'include',
        })
        if (response.ok) {
          const payload = await response.json()
          if (!active) return
          if (payload.tenant?.slug !== surface.tenantSlug) {
            clearProductionSession()
          } else {
            applyTenantPreferences(payload)
            if (payload.onboarding?.completedAt) saveProductionSession(toWorkspaceSession(payload))
            setServerSession(payload)
            setTenantState({ managed: true, slug: payload.tenant.slug, companyName: payload.tenant.companyName, status: 'active' })
            return
          }
        }

        clearProductionSession()
        const stateResponse = await fetch(`${API_BASE}/api/v1/auth/tenant-state/${encodeURIComponent(surface.tenantSlug)}`)
        const statePayload = await stateResponse.json().catch(() => ({ managed: false }))
        if (active) setTenantState(statePayload)
      } catch {
        clearProductionSession()
        if (active) setTenantState({ managed: false, unavailable: true })
      } finally {
        if (active) setLoading(false)
      }
    }

    bootstrap()
    return () => { active = false }
  }, [surface.tenantSlug])

  useEffect(() => {
    if (!serverSession) return

    applyTenantPreferences(serverSession)

    if (serverSession.onboarding?.completedAt) {
      saveProductionSession(toWorkspaceSession(serverSession))
      if (window.location.pathname === '/onboarding') {
        window.history.replaceState({}, '', '/dashboard')
      }
      return
    }

    if (window.location.pathname !== '/onboarding') {
      window.history.replaceState({}, '', '/onboarding')
    }
  }, [serverSession])

  useEffect(() => {
    if (!serverSession?.onboarding?.completedAt) return undefined

    let closing = false
    const timer = window.setInterval(async () => {
      if (closing) return
      const localProductionSession = window.localStorage.getItem(PRODUCTION_SESSION_KEY)
      if (localProductionSession) return

      closing = true
      try {
        await fetch(`${API_BASE}/api/v1/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        })
      } catch {
        // The local session is already gone; continue to the production login screen.
      }

      clearProductionSession()
      setTenantState((current) => ({
        managed: true,
        slug: current?.slug || surface.tenantSlug,
        companyName: current?.companyName || serverSession.tenant?.companyName || surface.tenantName,
        status: 'active',
      }))
      setServerSession(null)
      if (window.location.pathname !== '/login') {
        window.history.replaceState({}, '', '/login')
      }
    }, 300)

    return () => window.clearInterval(timer)
  }, [serverSession, surface.tenantName, surface.tenantSlug])

  function acceptSession(nextSession) {
    applyTenantPreferences(nextSession)
    if (nextSession.onboarding?.completedAt) saveProductionSession(toWorkspaceSession(nextSession))
    setServerSession(nextSession)
    setTenantState({
      managed: true,
      slug: nextSession.tenant.slug,
      companyName: nextSession.tenant.companyName,
      status: 'active',
    })
  }

  if (loading) return <LoadingScreen tenantName={surface.tenantName} />

  if (serverSession && !serverSession.onboarding?.completedAt) {
    return <OnboardingWizard session={serverSession} onSessionChange={acceptSession} />
  }

  if (serverSession?.onboarding?.completedAt) {
    const settingsOpen = currentPath === '/settings' || currentPath.startsWith('/settings/')
    const themeKey = effectiveSettings(serverSession)?.theme || {}
    const workspaceKey = `${themeKey.mode || 'system'}:${themeKey.accent || 'amber'}`

    return (
      <>
        <App key={workspaceKey} />
        {settingsOpen ? (
          <ProductionSettingsLayer
            key={workspaceKey}
            currentPath={currentPath}
            onSessionChange={acceptSession}
            session={serverSession}
          />
        ) : null}
      </>
    )
  }

  if (tenantState?.managed) {
    return <ProductionLogin tenant={tenantState} onAuthenticated={acceptSession} />
  }

  return <App />
}
