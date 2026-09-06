import { useEffect, useMemo, useState } from 'react'
import App from '../App.jsx'
import { portalServiceCatalog } from '../data/portalData.js'
import { resolveTenantSurface } from '../lib/tenantSurface.js'
import './ProductionPortalBootstrap.css'

const API_BASE = 'https://api.hi5central.com'

function replaceCatalogue(items) {
  portalServiceCatalog.splice(0, portalServiceCatalog.length, ...items)
}

function PortalBootstrapState({ error, onRetry, tenantName }) {
  return (
    <main className="production-portal-bootstrap">
      <section>
        <img src="/hi5central-logo.png" alt="Hi5Central" />
        <span>{tenantName}</span>
        {error ? (
          <>
            <h1>We couldn’t load the Help Centre.</h1>
            <p>{error}</p>
            <button onClick={onRetry} type="button">Try again</button>
          </>
        ) : (
          <>
            <h1>Opening your Help Centre…</h1>
            <p>Loading the services published for your organisation.</p>
          </>
        )}
      </section>
    </main>
  )
}

export function ProductionPortalBootstrap() {
  const surface = useMemo(() => resolveTenantSurface(), [])
  const [state, setState] = useState({ status: 'loading', attempt: 0, error: '' })

  useEffect(() => {
    let active = true

    async function load() {
      setState((current) => ({ ...current, status: 'loading', error: '' }))
      try {
        const response = await fetch(`${API_BASE}/api/v1/portal/catalogue/${encodeURIComponent(surface.tenantSlug)}`)
        const payload = await response.json().catch(() => ({}))

        if (response.status === 404 || payload.managed === false) {
          // Unmanaged canonical hosts such as the permanent beta demo retain the
          // bundled Portal catalogue. Real tenant hosts never receive another
          // tenant's data because the API resolves solely from the host slug.
          if (active) setState((current) => ({ ...current, status: 'ready', error: '' }))
          return
        }

        if (!response.ok) throw new Error(payload.error || 'The service catalogue is temporarily unavailable.')
        if (!Array.isArray(payload.items)) throw new Error('The service catalogue response was invalid.')

        replaceCatalogue(payload.items)
        if (active) setState((current) => ({ ...current, status: 'ready', error: '' }))
      } catch (error) {
        if (active) setState((current) => ({ ...current, status: 'error', error: error.message || 'The service catalogue is temporarily unavailable.' }))
      }
    }

    load()
    return () => { active = false }
  }, [state.attempt, surface.tenantSlug])

  if (state.status !== 'ready') {
    return (
      <PortalBootstrapState
        error={state.status === 'error' ? state.error : ''}
        onRetry={() => setState((current) => ({ ...current, attempt: current.attempt + 1 }))}
        tenantName={surface.tenantName || surface.tenantSlug}
      />
    )
  }

  return <App />
}
