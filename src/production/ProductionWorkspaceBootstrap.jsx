import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck } from 'lucide-react'
import App from '../App.jsx'
import { OnboardingWizard } from '../features/onboarding/OnboardingWizard.jsx'
import { resolveTenantSurface } from '../lib/tenantSurface.js'
import { clearProductionSession, saveProductionSession } from '../services/demoStore.js'
import './ProductionWorkspaceBootstrap.css'

const API_BASE = 'https://api.hi5central.com'

function initials(name = '') {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'HC'
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

export function ProductionWorkspaceBootstrap() {
  const surface = useMemo(() => resolveTenantSurface(), [])
  const [serverSession, setServerSession] = useState(null)
  const [tenantState, setTenantState] = useState(null)
  const [loading, setLoading] = useState(true)

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

  function acceptSession(nextSession) {
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

  if (serverSession?.onboarding?.completedAt) return <App />

  if (tenantState?.managed) {
    return <ProductionLogin tenant={tenantState} onAuthenticated={acceptSession} />
  }

  return <App />
}
