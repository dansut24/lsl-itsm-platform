import { useEffect, useMemo, useState } from 'react'
import { RmmPlatformApp } from '../features/rmm/RmmPlatformApp.jsx'
import { resolveTenantSurface } from '../lib/tenantSurface.js'

const API_BASE = window.__HI5_API_BASE__

export function ProductionRmmBootstrap() {
  const surface = useMemo(() => resolveTenantSurface(), [])
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    let active = true
    fetch(`${API_BASE}/api/v1/auth/session`, { credentials: 'include' })
      .then(async (response) => ({ response, payload: await response.json().catch(() => ({})) }))
      .then(({ response, payload }) => {
        if (active && response.ok && payload?.tenant?.slug === surface.tenantSlug) setSession(payload)
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [surface.tenantSlug])

  async function login(event) {
    event.preventDefault()
    setError('')
    const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantSlug: surface.tenantSlug, email: form.email, password: form.password }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) { setError(payload.error || 'Sign in failed.'); return }
    setSession(payload)
  }

  async function logout() {
    await fetch(`${API_BASE}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})
    setSession(null)
  }

  if (loading) return <main className="production-auth-shell"><div className="production-auth-card">Opening RMM…</div></main>
  if (!session) {
    return (
      <main className="production-auth-shell">
        <form className="production-auth-card" onSubmit={login}>
          <img src="/hi5central-logo.png" alt="Hi5Central" />
          <h1>RMM sign in</h1>
          <p>Sign in with an account assigned to {surface.tenantName || surface.tenantSlug}.</p>
          <label><span>Email address</span><input type="email" autoComplete="username" required value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
          <label><span>Password</span><input type="password" autoComplete="current-password" required value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /></label>
          {error ? <div className="production-auth-error">{error}</div> : null}
          <button type="submit">Sign in</button>
        </form>
      </main>
    )
  }

  return (
    <RmmPlatformApp
      accent="amber"
      currentUser={{ role: 'rmm', name: session.user?.name || session.user?.email || 'RMM user', username: session.user?.email || '' }}
      handleLogout={logout}
      onCreateItsmIncident={() => null}
      setTheme={setTheme}
      tenantName={session.tenant?.companyName || surface.tenantName || surface.tenantSlug}
      theme={theme}
      tickets={[]}
    />
  )
}
