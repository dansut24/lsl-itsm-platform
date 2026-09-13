import { useEffect, useMemo, useState } from 'react'
import { RmmPlatformApp } from '../features/rmm/RmmPlatformApp.jsx'
import { resolveTenantSurface } from '../lib/tenantSurface.js'

const API_BASE = window.__HI5_API_BASE__

function intuneDeviceToRmm(row) {
  const total = Number(row.storage_total_bytes || 0)
  const free = Number(row.storage_free_bytes || 0)
  const usedPercent = total > 0 ? Math.max(0, Math.min(100, Math.round(((total - free) / total) * 100))) : 0
  const compliant = String(row.compliance_state || '').toLowerCase() === 'compliant'
  return {
    id: row.reference,
    sourceDeviceId: row.source_device_id,
    directoryDeviceId: row.directory_device_id,
    name: row.name,
    type: String(row.operating_system || '').toLowerCase().includes('windows') ? 'Windows device' : (row.platform || 'Device'),
    platform: row.platform || row.operating_system || 'Unknown',
    os: [row.operating_system, row.os_version].filter(Boolean).join(' '),
    edition: '', osBuild: row.os_version || '',
    user: row.assigned_person_name || row.user_display_name || 'Unassigned',
    userEmail: row.assigned_person_email || row.user_principal_name || '',
    assignedPersonId: row.assigned_person_id || '',
    site: row.source_connection_name || 'Microsoft Intune', siteId: row.microsoft_connection_id || 'intune', group: 'Microsoft Intune', groupId: 'intune', policy: 'Intune managed',
    sourceTenant: row.source_connection_name || 'Microsoft Intune', sourceDirectoryTenantId: row.source_directory_tenant_id || '', sourceConnectionId: row.microsoft_connection_id || '',
    status: 'Managed', health: compliant ? 'Healthy' : 'Warning', alerts: compliant ? 0 : 1,
    cpu: 0, memory: 0, disk: usedPercent, patchCompliance: 0, pendingPatches: 0,
    manufacturer: row.manufacturer || 'Unknown', model: row.model || 'Unknown', serial: row.serial_number || 'Not reported',
    lastSeen: row.source_last_sync_at ? new Date(row.source_last_sync_at).toLocaleString() : 'Not reported',
    managedSince: row.enrolled_at ? new Date(row.enrolled_at).toLocaleDateString() : 'Not reported',
    agent: row.management_agent || 'Intune', agentChannel: 'Microsoft',
    storageGb: total ? Math.round(total / (1024 ** 3)) : 0, storageFreeGb: free ? Math.round(free / (1024 ** 3)) : 0,
    ramGb: row.memory_bytes ? Math.round(Number(row.memory_bytes) / (1024 ** 3)) : 0,
    security: { encryptionState: row.is_encrypted ? 'Protected' : 'Not reported', encryption: row.is_encrypted ? 'Intune reports encrypted' : 'Not reported', avState: 'Not reported', av: 'Not reported', firewall: 'Not reported', secureBoot: 'Not reported', edrState: 'Not reported', edr: 'Not reported', tpm: 'Not reported' },
    tags: ['Intune', row.source_connection_name || 'Microsoft Intune', row.compliance_state || 'unknown'], installedSoftware: [], patches: [], activity: [], networkAdapters: [], relatedRecordIds: [],
    complianceState: row.compliance_state || 'unknown', managementState: row.management_state || 'managed', enrollmentType: row.enrollment_type || '', categoryName: row.category_name || '',
  }
}

export function ProductionRmmBootstrap() {
  const surface = useMemo(() => resolveTenantSurface(), [])
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [theme, setTheme] = useState('light')
  const [devices, setDevices] = useState([])
  const [microsoftEnabled, setMicrosoftEnabled] = useState(false)

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

  useEffect(() => {
    let active = true
    fetch(`${API_BASE}/api/v1/auth/microsoft/status/${encodeURIComponent(surface.tenantSlug)}`)
      .then(async (response) => ({ response, payload: await response.json().catch(() => ({})) }))
      .then(({ response, payload }) => {
        if (active && response.ok) setMicrosoftEnabled(Boolean(payload.connected && payload.ssoEnabled))
      })
      .catch(() => {})
    return () => { active = false }
  }, [surface.tenantSlug])

  useEffect(() => {
    if (!session) return undefined
    let active = true
    fetch(`${API_BASE}/api/v1/rmm/devices`, { credentials: 'include' })
      .then(async (response) => ({ response, payload: await response.json().catch(() => ({})) }))
      .then(({ response, payload }) => { if (active && response.ok) setDevices((payload.devices || []).map(intuneDeviceToRmm)) })
      .catch(() => { if (active) setDevices([]) })
    return () => { active = false }
  }, [session])

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
    setDevices([])
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
          {microsoftEnabled ? <><div className="production-auth-divider"><span>or</span></div><button className="production-auth-microsoft" onClick={() => { window.location.href = `${API_BASE}/api/v1/auth/microsoft/start?tenantSlug=${encodeURIComponent(surface.tenantSlug)}&surface=rmm&returnTo=%2Fdevices` }} type="button">Sign in with Microsoft</button></> : null}
        </form>
      </main>
    )
  }

  return (
    <RmmPlatformApp
      accent="amber"
      devices={devices}
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
