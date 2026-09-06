import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react'
import './ProductionMfaSettingsEnhancer.css'

const API_BASE = 'https://api.hi5central.com'

function RecoveryCodes({ codes }) {
  if (!Array.isArray(codes) || !codes.length) return null
  return (
    <div className="production-security-recovery">
      <strong>Save these recovery codes now</strong>
      <p>Each code works once. Store them in a secure password manager or another protected location.</p>
      <div>{codes.map((code) => <code key={code}>{code}</code>)}</div>
    </div>
  )
}

export function ProductionMfaSettingsEnhancer() {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname)
  const [target, setTarget] = useState(null)
  const [status, setStatus] = useState(null)
  const [setup, setSetup] = useState(null)
  const [code, setCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const open = currentPath === '/settings/security-mfa'

  useEffect(() => {
    const update = () => setCurrentPath(window.location.pathname)
    window.addEventListener('popstate', update)
    window.addEventListener('hi5-routechange', update)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener('hi5-routechange', update)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setTarget(null)
      return undefined
    }

    const attach = () => {
      const nextTarget = document.querySelector('.production-settings-content')
      if (!(nextTarget instanceof HTMLElement)) return false
      setTarget(nextTarget)

      const toggles = [...document.querySelectorAll('.production-settings-toggle')]
      const mfaToggle = toggles.find((button) => button.querySelector('strong')?.textContent?.includes('Require administrator MFA'))
      const description = mfaToggle?.querySelector('small')
      if (description) {
        description.textContent = 'Require tenant owners and administrators to complete authenticator MFA before a normal workspace session is issued.'
      }
      return true
    }

    if (attach()) return undefined
    const observer = new MutationObserver(() => {
      if (attach()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [open])

  async function loadStatus() {
    if (!open) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/api/v1/mfa/status`, { credentials: 'include' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not load MFA status.')
      setStatus(payload)
    } catch (statusError) {
      setError(statusError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    loadStatus()
  }, [open])

  async function startSetup() {
    setLoading(true)
    setError('')
    setSaved('')
    setRecoveryCodes(null)
    try {
      const response = await fetch(`${API_BASE}/api/v1/mfa/setup`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not start MFA setup.')
      setSetup(payload)
      setCode('')
    } catch (setupError) {
      setError(setupError.message)
    } finally {
      setLoading(false)
    }
  }

  async function confirmSetup() {
    if (!setup?.setupToken || !code.trim()) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/api/v1/mfa/confirm`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupToken: setup.setupToken, code: code.trim() }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not confirm MFA setup.')
      setStatus(payload)
      setRecoveryCodes(payload.recoveryCodes || null)
      setSetup(null)
      setCode('')
      setSaved('Authenticator MFA enabled for your account.')
    } catch (confirmError) {
      setError(confirmError.message)
    } finally {
      setLoading(false)
    }
  }

  async function regenerateRecoveryCodes() {
    if (!code.trim()) return
    setLoading(true)
    setError('')
    setSaved('')
    try {
      const response = await fetch(`${API_BASE}/api/v1/mfa/recovery-codes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not generate recovery codes.')
      setRecoveryCodes(payload.recoveryCodes || [])
      setCode('')
      setSaved('A new recovery-code set has been generated. Previous recovery codes are no longer valid.')
      await loadStatus()
    } catch (recoveryError) {
      setError(recoveryError.message)
    } finally {
      setLoading(false)
    }
  }

  if (!open || !target) return null

  return createPortal(
    <section className="production-settings-panel production-security-mfa-panel">
      <header>
        <div>
          <h2>Your multi-factor authentication</h2>
          <p>Authenticator enrollment is stored against your tenant membership and enforced by the production authentication service.</p>
        </div>
        <button className="production-security-refresh" onClick={loadStatus} disabled={loading} type="button" aria-label="Refresh MFA status">
          <RefreshCw size={16} />
        </button>
      </header>

      <div className="production-settings-panel-body">
        {loading && !status ? <div className="production-security-loading">Checking your MFA status…</div> : null}

        {status ? (
          <div className="production-security-status-grid">
            <div><span>Tenant policy</span><strong>{status.requiredForCurrentUser ? 'MFA required' : 'MFA optional'}</strong></div>
            <div><span>Your authenticator</span><strong>{status.enrolled ? 'Enrolled' : 'Not enrolled'}</strong></div>
            <div><span>Current session</span><strong>{status.sessionVerified ? 'MFA verified' : 'Password session'}</strong></div>
            <div><span>Session length</span><strong>{status.sessionHours} hours</strong></div>
            <div><span>Recovery codes</span><strong>{status.recoveryCodesRemaining} remaining</strong></div>
          </div>
        ) : null}

        {status?.requiredForCurrentUser && !status.enrolled ? (
          <div className="production-security-warning">
            <ShieldCheck size={18} />
            <div>
              <strong>Administrator MFA is required for this tenant</strong>
              <span>Set up your authenticator now. If the setup grace window expires, your next workspace request will return you to secure sign-in.</span>
            </div>
          </div>
        ) : null}

        {!status?.enrolled && !setup ? (
          <button className="production-security-primary" onClick={startSetup} disabled={loading} type="button">
            <KeyRound size={17} /> Set up authenticator
          </button>
        ) : null}

        {setup ? (
          <div className="production-security-setup">
            <div>
              <strong>1. Add Hi5Central to your authenticator</strong>
              <p>Use Microsoft Authenticator, Google Authenticator, 1Password or another TOTP-compatible app.</p>
            </div>
            <div className="production-security-secret">
              <span>Setup key</span>
              <code>{setup.secret}</code>
              <small>{setup.account}</small>
              <a href={setup.otpauthUri}>Open in authenticator app</a>
            </div>
            <label>
              <span>2. Enter the six-digit code</span>
              <input autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} placeholder="000000" />
            </label>
            <button className="production-security-primary" onClick={confirmSetup} disabled={loading || code.trim().length !== 6} type="button">
              <CheckCircle2 size={17} /> Verify and enable MFA
            </button>
          </div>
        ) : null}

        {status?.enrolled && !setup ? (
          <div className="production-security-management">
            <div>
              <strong>Authenticator is active</strong>
              <p>{status.verifiedAt ? `Verified ${new Date(status.verifiedAt).toLocaleString('en-GB')}.` : 'Your authenticator is verified.'} Generate a new recovery set if the existing codes have been exposed or lost.</p>
            </div>
            <label>
              <span>Current six-digit authenticator code</span>
              <input autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} placeholder="000000" />
            </label>
            <button onClick={regenerateRecoveryCodes} disabled={loading || code.trim().length !== 6} type="button">Generate new recovery codes</button>
          </div>
        ) : null}

        <RecoveryCodes codes={recoveryCodes} />
        {saved ? <div className="production-security-success">{saved}</div> : null}
        {error ? <div className="production-security-error">{error}</div> : null}
      </div>
    </section>,
    target,
  )
}
