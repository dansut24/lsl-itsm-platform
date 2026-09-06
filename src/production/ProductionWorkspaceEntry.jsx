import { useEffect, useMemo, useState } from 'react'
import { OnboardingWizard } from '../features/onboarding/OnboardingWizard.jsx'
import { resolveTenantSurface } from '../lib/tenantSurface.js'
import { ProductionWorkspaceBootstrap } from './ProductionWorkspaceBootstrap.jsx'

const API_BASE = 'https://api.hi5central.com'
const SESSION_TIMEOUT_MS = 8000

function ResumeLoading({ tenantName }) {
  return (
    <div className="production-auth-shell">
      <div className="production-auth-card production-auth-loading">
        <img src="/hi5central-logo.png" alt="" />
        <strong>Opening {tenantName}</strong>
        <span>Resuming your secure Hi5Central session…</span>
      </div>
    </div>
  )
}

export function ProductionWorkspaceEntry() {
  const surface = useMemo(() => resolveTenantSurface(), [])
  const [mode, setMode] = useState('probing')
  const [session, setSession] = useState(null)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), SESSION_TIMEOUT_MS)

    async function probeSession() {
      try {
        const response = await fetch(`${API_BASE}/api/v1/auth/session`, {
          credentials: 'include',
          signal: controller.signal,
        })

        if (!response.ok) {
          if (active) setMode('delegate')
          return
        }

        const payload = await response.json()
        if (!active) return

        if (payload?.tenant?.slug !== surface.tenantSlug) {
          setMode('delegate')
          return
        }

        if (!payload?.onboarding?.completedAt) {
          setSession(payload)
          if (window.location.pathname !== '/onboarding') {
            window.history.replaceState({}, '', '/onboarding')
            window.dispatchEvent(new Event('hi5-routechange'))
          }
          setMode('onboarding')
          return
        }

        setMode('delegate')
      } catch {
        if (active) setMode('delegate')
      } finally {
        window.clearTimeout(timeout)
      }
    }

    probeSession()
    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [surface.tenantSlug])

  function acceptOnboardingSession(nextSession) {
    if (nextSession?.onboarding?.completedAt) {
      window.location.replace('/dashboard')
      return
    }

    setSession(nextSession)
    if (window.location.pathname !== '/onboarding') {
      window.history.replaceState({}, '', '/onboarding')
      window.dispatchEvent(new Event('hi5-routechange'))
    }
  }

  if (mode === 'probing') {
    return <ResumeLoading tenantName={surface.tenantName || surface.tenantSlug || 'Hi5Central'} />
  }

  if (mode === 'onboarding' && session) {
    return <OnboardingWizard session={session} onSessionChange={acceptOnboardingSession} />
  }

  return <ProductionWorkspaceBootstrap />
}
