import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CheckCircle2,
  Clock3,
  KeyRound,
  Laptop,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react'
import './ProductionSecurityCenterEnhancer.css'

const API_BASE = window.__HI5_API_BASE__

function formatDate(value) {
  if (!value) return '—'
  try { return new Date(value).toLocaleString('en-GB') } catch { return '—' }
}

function shortAgent(value) {
  const agent = String(value || '')
  if (!agent || agent === 'unknown') return 'Browser session'
  if (/iphone|ipad/i.test(agent)) return 'Safari on iPhone / iPad'
  if (/android/i.test(agent)) return 'Browser on Android'
  if (/windows/i.test(agent)) return 'Browser on Windows'
  if (/macintosh|mac os/i.test(agent)) return 'Browser on macOS'
  if (/linux/i.test(agent)) return 'Browser on Linux'
  return 'Browser session'
}

function eventLabel(type) {
  const labels = {
    'security.policy_changed': 'Security policy changed',
    'password.changed': 'Password changed',
    'password.change': 'Password change failed',
    'password.reset_requested': 'Password reset requested',
    'password.reset_completed': 'Password reset completed',
    'sessions.revoked_others': 'Other sessions revoked',
    'session.revoked': 'Session revoked',
    'mfa.removed': 'Authenticator removed',
  }
  return labels[type] || String(type || '').replaceAll('.', ' ')
}

export function ProductionSecurityCenterEnhancer() {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname)
  const [target, setTarget] = useState(null)
  const [summary, setSummary] = useState(null)
  const [sessions, setSessions] = useState([])
  const [audit, setAudit] = useState({ items: [], retentionDays: 365 })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [removePassword, setRemovePassword] = useState('')
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
    if (!open) { setTarget(null); return undefined }
    const attach = () => {
      const node = document.querySelector('.production-settings-content')
      if (!(node instanceof HTMLElement)) return false
      setTarget(node)
      const heading = node.querySelector('.production-settings-panel header p')
      if (heading?.textContent?.includes('Authentication defaults stored')) {
        heading.textContent = 'Authentication, password, session and audit controls enforced for this tenant.'
      }
      return true
    }
    if (attach()) return undefined
    const observer = new MutationObserver(() => { if (attach()) observer.disconnect() })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [open])

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...options })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Security request failed.')
    return payload
  }

  async function loadAll({ quiet = false } = {}) {
    if (!open) return
    if (!quiet) setLoading(true)
    setError('')
    try {
      const [summaryPayload, sessionsPayload, auditPayload] = await Promise.all([
        api('/api/v1/security/summary'),
        api('/api/v1/security/sessions'),
        api('/api/v1/security/audit?limit=80'),
      ])
      setSummary(summaryPayload)
      setSessions(sessionsPayload.items || [])
      setAudit(auditPayload)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      if (!quiet) setLoading(false)
    }
  }

  useEffect(() => {
    if (open) loadAll()
  }, [open])

  async function changePassword(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    if (passwords.next !== passwords.confirm) {
      setError('New password confirmation does not match.')
      return
    }
    setLoading(true)
    try {
      await api('/api/v1/security/password/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.next }),
      })
      setPasswords({ current: '', next: '', confirm: '' })
      setMessage('Password changed. Every other session has been revoked.')
      await loadAll({ quiet: true })
    } catch (changeError) {
      setError(changeError.message)
    } finally {
      setLoading(false)
    }
  }

  async function revokeSession(id) {
    setMessage('')
    setError('')
    try {
      await api(`/api/v1/security/sessions/${encodeURIComponent(id)}/revoke`, { method: 'POST' })
      setMessage('Session revoked.')
      await loadAll({ quiet: true })
    } catch (revokeError) {
      setError(revokeError.message)
    }
  }

  async function revokeOthers() {
    setMessage('')
    setError('')
    try {
      const payload = await api('/api/v1/security/sessions/revoke-others', { method: 'POST' })
      setMessage(`${payload.revoked || 0} other session${payload.revoked === 1 ? '' : 's'} revoked.`)
      await loadAll({ quiet: true })
    } catch (revokeError) {
      setError(revokeError.message)
    }
  }

  async function removeAuthenticator(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    setLoading(true)
    try {
      await api('/api/v1/security/mfa/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: removePassword }),
      })
      setRemovePassword('')
      setMessage('Authenticator removed. Refreshing security state…')
      window.setTimeout(() => window.location.reload(), 450)
    } catch (removeError) {
      setError(removeError.message)
      setLoading(false)
    }
  }

  const activeSessions = useMemo(() => sessions.filter((item) => !item.revokedAt && new Date(item.expiresAt).getTime() > Date.now()), [sessions])
  if (!open || !target) return null

  return createPortal(
    <div className="production-security-center">
      <section className="production-settings-panel production-security-account-panel">
        <header><div><h2>Password & account security</h2><p>The selected tenant password policy is enforced when passwords are changed or reset.</p></div><LockKeyhole size={20} /></header>
        <div className="production-settings-panel-body">
          <div className="production-security-status-grid production-security-account-summary">
            <div><span>Password policy</span><strong>{summary?.policy?.passwordPolicy === 'standard' ? 'Standard · 10+ chars' : 'Strong · 12+ chars'}</strong></div>
            <div><span>Last password change</span><strong>{formatDate(summary?.passwordChangedAt)}</strong></div>
            <div><span>Active sessions</span><strong>{summary?.activeSessions ?? activeSessions.length}</strong></div>
          </div>
          <form className="production-security-form" onSubmit={changePassword}>
            <label><span>Current password</span><input type="password" autoComplete="current-password" value={passwords.current} onChange={(e) => setPasswords((v) => ({ ...v, current: e.target.value }))} required /></label>
            <label><span>New password</span><input type="password" autoComplete="new-password" value={passwords.next} onChange={(e) => setPasswords((v) => ({ ...v, next: e.target.value }))} required /></label>
            <label><span>Confirm new password</span><input type="password" autoComplete="new-password" value={passwords.confirm} onChange={(e) => setPasswords((v) => ({ ...v, confirm: e.target.value }))} required /></label>
            <button className="production-security-primary" disabled={loading} type="submit"><KeyRound size={16} /> Change password</button>
          </form>
        </div>
      </section>

      <section className="production-settings-panel">
        <header><div><h2>Active sessions</h2><p>Review where your account is signed in and revoke sessions you no longer recognise.</p></div><button className="production-security-refresh" onClick={() => loadAll()} disabled={loading} type="button"><RefreshCw size={16} /></button></header>
        <div className="production-settings-panel-body">
          <div className="production-security-session-actions"><button onClick={revokeOthers} type="button" disabled={activeSessions.length <= 1}>Sign out everywhere else</button></div>
          <div className="production-security-sessions">
            {sessions.length ? sessions.map((item) => (
              <article className={`production-security-session ${item.current ? 'is-current' : ''} ${item.revokedAt ? 'is-revoked' : ''}`} key={item.id}>
                <span className="production-security-session-icon">{/iphone|ipad|android/i.test(item.userAgent || '') ? <Smartphone size={18} /> : <Laptop size={18} />}</span>
                <div><strong>{shortAgent(item.userAgent)} {item.current ? '· This device' : ''}</strong><small>Last active {formatDate(item.lastSeenAt)} · Created {formatDate(item.createdAt)}</small><small>{item.ipAddress || 'IP not recorded'} · {item.mfaVerified ? 'MFA verified' : 'Password session'}</small></div>
                <div className="production-security-session-state"><span>{item.revokedAt ? 'Ended' : new Date(item.expiresAt).getTime() <= Date.now() ? 'Expired' : 'Active'}</span>{!item.current && !item.revokedAt && new Date(item.expiresAt).getTime() > Date.now() ? <button onClick={() => revokeSession(item.id)} type="button"><Trash2 size={14} /> Revoke</button> : null}</div>
              </article>
            )) : <div className="production-security-empty">No session history is available yet.</div>}
          </div>
        </div>
      </section>

      <section className="production-settings-panel">
        <header><div><h2>Authenticator management</h2><p>Recovery-code rotation is available above. Removing the authenticator requires password confirmation and is blocked while administrator MFA is required.</p></div><ShieldCheck size={20} /></header>
        <div className="production-settings-panel-body">
          <form className="production-security-danger-row" onSubmit={removeAuthenticator}>
            <div><strong>Remove current authenticator</strong><span>{summary?.policy?.requireMfa ? 'Disable the administrator MFA policy first if you genuinely need to remove it.' : 'This revokes other sessions and removes the TOTP secret and recovery codes.'}</span></div>
            <input type="password" autoComplete="current-password" placeholder="Confirm password" value={removePassword} onChange={(event) => setRemovePassword(event.target.value)} />
            <button disabled={loading || !removePassword} type="submit"><ShieldAlert size={15} /> Remove</button>
          </form>
        </div>
      </section>

      <section className="production-settings-panel">
        <header><div><h2>Security audit</h2><p>Security events are retained for {audit.retentionDays || summary?.policy?.auditRetention || 365} days according to the tenant policy and are automatically pruned.</p></div><Clock3 size={20} /></header>
        <div className="production-settings-panel-body">
          <div className="production-security-audit">
            {audit.items?.length ? audit.items.map((item) => (
              <article key={item.id}>
                <span className={`production-security-audit-dot is-${item.outcome || 'success'}`} />
                <div><strong>{eventLabel(item.type)}</strong><small>{item.actor} · {formatDate(item.createdAt)}</small><small>{item.ipAddress || 'IP not recorded'} · {item.outcome}</small></div>
              </article>
            )) : <div className="production-security-empty">Security events will appear here as authentication and account actions occur.</div>}
          </div>
        </div>
      </section>

      {message ? <div className="production-security-global-success"><CheckCircle2 size={16} /> {message}</div> : null}
      {error ? <div className="production-security-global-error"><ShieldAlert size={16} /> {error}</div> : null}
    </div>,
    target,
  )
}
