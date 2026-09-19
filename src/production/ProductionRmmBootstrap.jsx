import { useEffect, useMemo, useState } from 'react'
import { RmmPlatformApp } from '../features/rmm/RmmPlatformApp.jsx'
import { resolveTenantSurface } from '../lib/tenantSurface.js'
import './ProductionWorkspaceBootstrap.css'

const API_BASE = window.__HI5_API_BASE__

function sessionHasPermission(session, permission) {
  const effective = session?.access?.effectivePermissions || []
  const grants = session?.access?.permissions || []
  if (effective.includes(permission) || grants.includes('*') || grants.includes(permission)) return true
  return grants.some((grant) => grant.endsWith('*') && permission.startsWith(grant.slice(0, -1)))
}

function deviceToRmm(row) {
  const inventory = row.agent_inventory_payload && typeof row.agent_inventory_payload === 'object' ? row.agent_inventory_payload : {}
  const summary = inventory.summary || {}
  const security = inventory.security || {}
  const software = Array.isArray(inventory.software?.items) ? inventory.software.items : []
  const total = Number(row.storage_total_bytes || summary.storage_total_bytes || 0)
  const free = Number(row.storage_free_bytes || summary.storage_free_bytes || 0)
  const hasAgent = Boolean(row.agent_device_id)
  const compliant = String(row.compliance_state || '').toLowerCase() === 'compliant'
  const uptimeSeconds = row.agent_uptime_seconds == null ? null : Number(row.agent_uptime_seconds)
  const uptime = uptimeSeconds == null ? 'Not reported' : uptimeSeconds >= 86400 ? `${Math.floor(uptimeSeconds / 86400)}d ${Math.floor((uptimeSeconds % 86400) / 3600)}h` : `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`
  return {
    id: row.reference, agentDeviceId: row.agent_device_id || '', rmmReference: row.rmm_reference || '', rmmMatchMethod: row.rmm_match_method || '',
    sourceDeviceId: row.source_device_id, directoryDeviceId: row.directory_device_id, name: row.name,
    type: String(row.operating_system || '').toLowerCase().includes('windows') ? 'Windows device' : (row.platform || 'Device'),
    platform: row.platform || row.operating_system || 'Unknown', os: [row.operating_system, row.os_version].filter(Boolean).join(' '), edition: '', osBuild: row.os_version || '',
    user: row.assigned_person_name || row.user_display_name || row.agent_active_user || 'Unassigned', userEmail: row.assigned_person_email || row.user_principal_name || '', assignedPersonId: row.assigned_person_id || '',
    site: row.assigned_site_name || 'Unassigned', siteId: row.assigned_site_external_key || '', group: hasAgent ? 'Hi5Central Agent' : 'Microsoft Intune', groupId: hasAgent ? 'agent' : 'intune', policy: hasAgent ? 'Agent managed' : 'Intune managed',
    sourceTenant: row.source_connection_name || '', sourceDirectoryTenantId: row.source_directory_tenant_id || '', sourceConnectionId: row.microsoft_connection_id || '',
    status: hasAgent ? (row.agent_online ? 'Online' : 'Offline') : 'Managed', health: hasAgent ? (row.agent_online ? 'Healthy' : 'Warning') : (compliant ? 'Healthy' : 'Warning'), alerts: hasAgent && !row.agent_online ? 1 : (compliant ? 0 : 1),
    cpu: row.agent_cpu_percent == null ? null : Math.round(Number(row.agent_cpu_percent)), memory: row.agent_memory_used_percent == null ? null : Math.round(Number(row.agent_memory_used_percent)), disk: row.agent_disk_used_percent == null ? null : Math.round(Number(row.agent_disk_used_percent)), patchCompliance: null, pendingPatches: inventory.windows_updates?.pending_count ?? null,
    manufacturer: row.manufacturer || summary.manufacturer || 'Unknown', model: row.model || summary.model || 'Unknown', serial: row.serial_number || summary.serial_number || 'Not reported', processor: inventory.cpu?.name || 'Not reported',
    lastSeen: row.agent_last_telemetry_at ? new Date(row.agent_last_telemetry_at).toLocaleString() : (row.source_last_sync_at ? new Date(row.source_last_sync_at).toLocaleString() : 'Not reported'), uptime, lastBoot: inventory.os?.last_boot || 'Not reported',
    managedSince: row.enrolled_at ? new Date(row.enrolled_at).toLocaleDateString() : 'Not reported', agent: hasAgent ? (row.agent_version ? `Hi5Central ${row.agent_version}` : 'Hi5Central Agent') : (row.management_agent || 'Intune'), agentChannel: hasAgent ? 'Stable' : 'Microsoft',
    storageGb: total ? Math.round(total / (1024 ** 3)) : null, storageFreeGb: free ? Math.round(free / (1024 ** 3)) : null, ramGb: row.memory_bytes ? Math.round(Number(row.memory_bytes) / (1024 ** 3)) : (inventory.memory?.total_bytes ? Math.round(Number(inventory.memory.total_bytes) / (1024 ** 3)) : null),
    security: { encryptionState: security.bitlocker_status === 'On' ? 'Protected' : (row.is_encrypted ? 'Protected' : 'Not reported'), encryption: security.bitlocker_status === 'On' ? 'BitLocker enabled' : (row.is_encrypted ? 'Intune reports encrypted' : 'Not reported'), avState: security.defender_enabled === true ? 'Enabled' : security.defender_enabled === false ? 'Disabled' : 'Not reported', av: security.defender_realtime_enabled === true ? 'Real-time protection enabled' : 'Not reported', firewall: security.firewall_enabled === true ? 'Enabled' : security.firewall_enabled === false ? 'Disabled' : 'Not reported', secureBoot: security.secure_boot || 'Not reported', edrState: 'Not reported', edr: 'Not reported', tpm: security.tpm_present === true ? 'Present' : 'Not reported' },
    tags: [row.source === 'intune' ? 'Intune' : null, hasAgent ? 'Hi5Central Agent' : null, row.source_connection_name, row.compliance_state].filter(Boolean),
    installedSoftware: software.map((app) => ({
      name: app.name, version: app.version || '', publisher: app.publisher || '', installed: app.install_date || '', managed: false,
      registryKey: app.registry_key || '', scope: app.scope || '', userSid: app.user_sid || '', userProfile: app.user_profile || '',
      uninstallString: app.uninstall_string || '', quietUninstallString: app.quiet_uninstall_string || '',
      estimatedSizeKb: app.estimated_size_kb ?? null, installLocation: app.install_location || '',
    })),
    patches: Array.isArray(inventory.windows_updates?.updates) ? inventory.windows_updates.updates : [],
    activity: [], networkAdapters: Array.isArray(inventory.network?.adapters) ? inventory.network.adapters : [], relatedRecordIds: [],
    ip: inventory.network?.primary_ipv4 || '', publicIp: inventory.network?.public_ip || '', gateway: inventory.network?.gateway || '', mac: inventory.network?.mac || '',
    bios: [inventory.hardware?.bios_vendor, inventory.hardware?.bios_version].filter(Boolean).join(' '), warranty: 'Not reported',
    timeZone: inventory.os?.timezone || 'Not reported', inventory,
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
  const [sites, setSites] = useState([])
  const [passwordStep, setPasswordStep] = useState(false)
  const [submitting, setSubmitting] = useState(false)

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
    if (!session) return undefined
    let active = true
    Promise.all([
      fetch(`${API_BASE}/api/v1/rmm/devices`, { credentials: 'include' }).then(async (response) => ({ response, payload: await response.json().catch(() => ({})) })),
      fetch(`${API_BASE}/api/v1/organisation`, { credentials: 'include' }).then(async (response) => ({ response, payload: await response.json().catch(() => ({})) })),
    ]).then(([deviceResult, organisationResult]) => {
      if (!active) return
      setDevices(deviceResult.response.ok ? (deviceResult.payload.devices || []).map(deviceToRmm) : [])
      setSites(organisationResult.response.ok ? (organisationResult.payload.sites || []).filter((site) => site.active !== false) : [])
    }).catch(() => {
      if (!active) return
      setDevices([])
      setSites([])
    })
    return () => { active = false }
  }, [session])

  async function login(event) {
    event.preventDefault()
    setError('')
    const email = form.email.trim()
    if (!email) { setError('Enter your email address to continue.'); return }
    if (!passwordStep) {
      setSubmitting(true)
      try {
        const response = await fetch(`${API_BASE}/api/v1/auth/microsoft/discover/${encodeURIComponent(surface.tenantSlug)}?email=${encodeURIComponent(email)}`)
        const payload = await response.json().catch(() => ({}))
        if (response.ok && payload.method === 'microsoft') {
          const params = new URLSearchParams({ tenantSlug: surface.tenantSlug, surface: 'rmm', returnTo: '/devices', loginHint: email })
          window.location.href = `${API_BASE}/api/v1/auth/microsoft/start?${params.toString()}`
          return
        }
        setPasswordStep(true)
      } finally { setSubmitting(false) }
      return
    }
    setSubmitting(true)
    const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantSlug: surface.tenantSlug, email, password: form.password }),
    })
    const payload = await response.json().catch(() => ({}))
    setSubmitting(false)
    if (!response.ok) { setError(payload.error || 'Sign in failed.'); return }
    setSession(payload)
  }

  async function saveSites(nextSites) {
    const response = await fetch(`${API_BASE}/api/v1/organisation/sites`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: nextSites }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Unable to save organisation sites.')
    const updated = (payload.sites || []).filter((site) => site.active !== false)
    setSites(updated)
    return updated
  }

  async function logout() {
    await fetch(`${API_BASE}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})
    setDevices([])
    setSites([])
    setSession(null)
  }

  if (loading) return <main className="production-auth-shell"><div className="production-auth-card">Opening RMM…</div></main>
  if (!session) {
    return (
      <main className="production-auth-shell">
        <form className="production-auth-card" onSubmit={login}>
          <img src="/hi5central-logo.png" alt="Hi5Central" />
          <h1>RMM sign in</h1>
          <p>Enter your email address and Hi5Central will use the sign-in method configured by {surface.tenantName || surface.tenantSlug}.</p>
          <label><span>Email address</span><input type="email" autoComplete="username" required value={form.email} onChange={(event) => { setForm((current) => ({ ...current, email: event.target.value })); if (passwordStep) setPasswordStep(false); setError('') }} /></label>
          {passwordStep ? <label><span>Password</span><input type="password" autoComplete="current-password" required autoFocus value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /></label> : <p className="production-auth-method-note">Your organisation may continue with Microsoft 365 or ask for your Hi5Central password.</p>}
          {error ? <div className="production-auth-error">{error}</div> : null}
          <button disabled={submitting} type="submit">{submitting ? (passwordStep ? 'Signing in…' : 'Checking sign-in…') : passwordStep ? 'Sign in' : 'Continue'}</button>
          {passwordStep ? <button className="production-auth-secondary-action" type="button" onClick={() => { setPasswordStep(false); setForm((current) => ({ ...current, password: '' })); setError('') }}>Use a different email</button> : null}
        </form>
      </main>
    )
  }

  return (
    <RmmPlatformApp
      accent="amber"
      devices={devices}
      sites={sites}
      canRemote={sessionHasPermission(session, 'rmm.devices.remote')}
      canBackstageRemote={sessionHasPermission(session, 'rmm.devices.backstage')}
      currentUser={{ role: 'rmm', name: session.user?.name || session.user?.email || 'RMM user', username: session.user?.email || '' }}
      handleLogout={logout}
      onCreateItsmIncident={() => null}
      onSitesChange={saveSites}
      setTheme={setTheme}
      tenantName={session.tenant?.companyName || surface.tenantName || surface.tenantSlug}
      theme={theme}
      tickets={[]}
    />
  )
}
