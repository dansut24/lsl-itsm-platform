import { useEffect, useMemo, useState } from 'react'
import {
  CircleDot,
  KeyRound,
  Network,
  Play,
  Radar,
  RefreshCw,
  Router,
  Server,
  ShieldCheck,
  Wifi,
} from 'lucide-react'
import { deploymentConfig } from '../../lib/deploymentConfig.js'
import './RmmNetworkDiscovery.css'

const API_BASE = window.__HI5_API_BASE__ || deploymentConfig().apiUrl

async function request(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
    headers: options.body
      ? { 'Content-Type': 'application/json', ...(options.headers || {}) }
      : (options.headers || {}),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Network discovery request failed.')
  return payload
}

function when(value) {
  if (!value) return 'Never'
  try { return new Date(value).toLocaleString() } catch { return String(value) }
}

function StatusPill({ children, tone = 'neutral' }) {
  return <span className={'rmm-network-pill ' + tone}>{children}</span>
}

function deviceIcon(type = '') {
  const normalized = String(type).toLowerCase()
  if (normalized === 'switch' || normalized === 'router') return Router
  if (normalized === 'access_point') return Wifi
  if (normalized === 'firewall') return ShieldCheck
  if (normalized === 'server' || normalized === 'storage') return Server
  return Network
}

export function RmmNetworkDiscovery() {
  const [bundle, setBundle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [credential, setCredential] = useState({ name: '', snmpVersion: 'v2c', community: '' })
  const [profile, setProfile] = useState({
    name: '',
    cidr: '',
    probeAgentDeviceId: '',
    credentialId: '',
    siteId: '',
    scanIntervalMinutes: 60,
    timeoutMs: 800,
    retries: 1,
    concurrency: 32,
  })

  async function load({ quiet = false } = {}) {
    if (!quiet) setLoading(true)
    try {
      const payload = await request('/api/v1/rmm/network-discovery')
      setBundle(payload)
      setError('')
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      if (!quiet) setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const active = (bundle?.runs || []).some((run) => ['queued', 'running'].includes(run.status))
    if (!active) return undefined
    const timer = window.setInterval(() => load({ quiet: true }), 4000)
    return () => window.clearInterval(timer)
  }, [bundle?.runs])

  const probes = bundle?.probes || []
  const credentials = bundle?.credentials || []
  const profiles = bundle?.profiles || []
  const devices = bundle?.devices || []
  const runs = bundle?.runs || []
  const sites = bundle?.sites || []

  const probeById = useMemo(
    () => new Map(probes.map((item) => [item.agent_device_id, item])),
    [probes],
  )
  const selectedProbe = probeById.get(profile.probeAgentDeviceId)
  const suggestedRanges = Array.isArray(selectedProbe?.suggested_cidrs)
    ? selectedProbe.suggested_cidrs
    : []

  async function createCredential(event) {
    event.preventDefault()
    setBusy('credential')
    setError('')
    setNotice('')
    try {
      const payload = await request('/api/v1/rmm/network-discovery/credentials', {
        method: 'POST',
        body: JSON.stringify(credential),
      })
      setBundle(payload.bundle)
      setCredential({ name: '', snmpVersion: 'v2c', community: '' })
      setNotice('SNMP credential saved securely.')
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy('')
    }
  }

  async function createProfile(event) {
    event.preventDefault()
    setBusy('profile')
    setError('')
    setNotice('')
    try {
      const payload = await request('/api/v1/rmm/network-discovery/profiles', {
        method: 'POST',
        body: JSON.stringify({
          ...profile,
          scanIntervalMinutes: Number(profile.scanIntervalMinutes),
          timeoutMs: Number(profile.timeoutMs),
          retries: Number(profile.retries),
          concurrency: Number(profile.concurrency),
        }),
      })
      setBundle(payload.bundle)
      setProfile({
        name: '',
        cidr: '',
        probeAgentDeviceId: '',
        credentialId: '',
        siteId: '',
        scanIntervalMinutes: 60,
        timeoutMs: 800,
        retries: 1,
        concurrency: 32,
      })
      setNotice('Discovery profile created.')
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy('')
    }
  }

  async function runScan(profileId) {
    setBusy('scan:' + profileId)
    setError('')
    setNotice('')
    try {
      const payload = await request('/api/v1/rmm/network-discovery/profiles/' + encodeURIComponent(profileId) + '/scan', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setBundle(payload.bundle)
      setNotice('SNMP discovery scan started on the selected probe.')
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy('')
    }
  }

  async function toggleProfile(item) {
    const key = 'profile:' + item.id
    setBusy(key)
    setError('')
    try {
      const payload = await request('/api/v1/rmm/network-discovery/profiles/' + encodeURIComponent(item.id), {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !item.enabled }),
      })
      setBundle(payload.bundle)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy('')
    }
  }

  const summary = bundle?.summary || {}
  const capabilities = bundle?.capabilities || {}

  return <div className="rmm-network-discovery">
    <div className="rmm-page-heading">
      <div>
        <span className="rmm-eyebrow">Network management</span>
        <h1>Network discovery</h1>
        <p>Use a managed Agent as an on-site probe to discover switches, routers, firewalls, printers, access points and other SNMP devices.</p>
      </div>
      <button className="rmm-primary compact" disabled={loading} onClick={() => load()} type="button">
        <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
      </button>
    </div>

    {error && <div className="rmm-network-message error">{error}</div>}
    {notice && <div className="rmm-network-message success">{notice}</div>}

    <div className="rmm-network-metrics">
      <article className="rmm-card"><Radar size={19} /><span>Discovery profiles</span><strong>{summary.profiles ?? 0}</strong><small>Enabled network ranges</small></article>
      <article className="rmm-card"><Network size={19} /><span>Discovered devices</span><strong>{summary.devices ?? 0}</strong><small>{summary.onlineDevices ?? 0} online · {summary.offlineDevices ?? 0} offline</small></article>
      <article className="rmm-card"><Server size={19} /><span>SNMP-capable probes</span><strong>{summary.snmpCapableProbes ?? 0}</strong><small>{summary.onlineProbes ?? 0} online · requires Agent {capabilities.minAgentVersion || '0.1.231'}+</small></article>
      <article className="rmm-card"><ShieldCheck size={19} /><span>SNMP support</span><strong>v1 / v2c</strong><small>{capabilities.snmpV3 ? 'SNMPv3 enabled' : 'SNMPv3 schema ready · probe support next'}</small></article>
    </div>

    <div className="rmm-network-config-grid">
      <section className="rmm-card rmm-network-config-card">
        <div className="rmm-card-heading">
          <div><span className="rmm-eyebrow">Credentials</span><h2>SNMP credentials</h2><p>Secrets are encrypted at rest and only sent to the selected live probe during a scan.</p></div>
          <KeyRound size={19} />
        </div>
        <form className="rmm-network-form" onSubmit={createCredential}>
          <label><span>Name</span><input value={credential.name} onChange={(e) => setCredential({ ...credential, name: e.target.value })} placeholder="e.g. Site A network" required /></label>
          <label><span>Version</span><select value={credential.snmpVersion} onChange={(e) => setCredential({ ...credential, snmpVersion: e.target.value })}><option value="v2c">SNMP v2c</option><option value="v1">SNMP v1</option><option value="v3" disabled>SNMP v3 — probe support next</option></select></label>
          <label className="wide"><span>Community string</span><input type="password" value={credential.community} onChange={(e) => setCredential({ ...credential, community: e.target.value })} autoComplete="new-password" placeholder="Stored encrypted — never displayed again" required /></label>
          <button className="rmm-primary" disabled={busy === 'credential'} type="submit">{busy === 'credential' ? 'Saving…' : 'Save credential'}</button>
        </form>
        <div className="rmm-network-credential-list">
          {credentials.map((item) => <div key={item.id}><span><strong>{item.name}</strong><small>{item.snmpVersion.toUpperCase()} · secret {item.secretConfigured ? 'configured' : 'missing'}</small></span><StatusPill tone={item.enabled ? 'healthy' : 'neutral'}>{item.enabled ? 'Enabled' : 'Disabled'}</StatusPill></div>)}
          {!credentials.length && <div className="rmm-network-mini-empty">No SNMP credentials configured yet.</div>}
        </div>
      </section>

      <section className="rmm-card rmm-network-config-card">
        <div className="rmm-card-heading">
          <div><span className="rmm-eyebrow">Ranges & probes</span><h2>Create discovery profile</h2><p>Choose an Agent on the same customer network and the IPv4 range it should scan.</p></div>
          <Radar size={19} />
        </div>
        <form className="rmm-network-form" onSubmit={createProfile}>
          <label><span>Profile name</span><input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="e.g. Head Office LAN" required /></label>
          <label><span>IPv4 CIDR</span><input value={profile.cidr} onChange={(e) => setProfile({ ...profile, cidr: e.target.value })} placeholder="192.168.1.0/24" required /><small>{suggestedRanges.length > 0 ? 'Suggested from probe inventory: ' + suggestedRanges.join(', ') : 'Private RFC1918 ranges only · /20 to /32'}</small></label>
          <label><span>Probe endpoint</span><select value={profile.probeAgentDeviceId} onChange={(e) => {
            const probeId = e.target.value
            const probe = probeById.get(probeId)
            const suggested = Array.isArray(probe?.suggested_cidrs) ? probe.suggested_cidrs[0] : ''
            setProfile((current) => ({
              ...current,
              probeAgentDeviceId: probeId,
              cidr: current.cidr || suggested || '',
            }))
          }} required><option value="">Select probe…</option>{probes.map((item) => <option value={item.agent_device_id} key={item.agent_device_id}>{item.name || item.reference} {item.online ? (item.snmp_capable ? '· SNMP ready' : '· Upgrade Agent') : '· Offline'}</option>)}</select></label>
          <label><span>Credential</span><select value={profile.credentialId} onChange={(e) => setProfile({ ...profile, credentialId: e.target.value })} required><option value="">Select credential…</option>{credentials.filter((item) => item.enabled).map((item) => <option value={item.id} key={item.id}>{item.name} · {item.snmpVersion.toUpperCase()}</option>)}</select></label>
          <label><span>Site</span><select value={profile.siteId} onChange={(e) => setProfile({ ...profile, siteId: e.target.value })}><option value="">No site assignment</option>{sites.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label><span>Poll interval</span><select value={profile.scanIntervalMinutes} onChange={(e) => setProfile({ ...profile, scanIntervalMinutes: e.target.value })}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option><option value="240">4 hours</option><option value="1440">Daily</option></select></label>
          <details className="wide rmm-network-advanced"><summary>Advanced scan settings</summary><div>
            <label><span>Timeout (ms)</span><input type="number" min="100" max="10000" value={profile.timeoutMs} onChange={(e) => setProfile({ ...profile, timeoutMs: e.target.value })} /></label>
            <label><span>Retries</span><input type="number" min="0" max="5" value={profile.retries} onChange={(e) => setProfile({ ...profile, retries: e.target.value })} /></label>
            <label><span>Concurrency</span><input type="number" min="1" max="128" value={profile.concurrency} onChange={(e) => setProfile({ ...profile, concurrency: e.target.value })} /></label>
          </div></details>
          <button className="rmm-primary" disabled={busy === 'profile' || !credentials.length || !probes.length} type="submit">{busy === 'profile' ? 'Creating…' : 'Create profile'}</button>
        </form>
      </section>
    </div>

    <section className="rmm-table-card rmm-network-profile-card">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Discovery scopes</span><h2>Network ranges</h2><p>Each range is scanned from its assigned on-site Agent probe.</p></div></div>
      <div className="rmm-network-table profiles">
        <div className="head"><span>Profile</span><span>Range</span><span>Probe</span><span>Credential</span><span>Last scan</span><span>Status</span><span /></div>
        {profiles.map((item) => {
          const probe = probeById.get(item.probe_agent_device_id)
          const scanning = runs.some((run) => run.profile_id === item.id && ['queued', 'running'].includes(run.status))
          return <div className="row" key={item.id}>
            <span><strong>{item.name}</strong><small>{item.site_name || 'No site assigned'} · every {item.scan_interval_minutes} min</small></span>
            <span><strong>{item.cidr}</strong><small>UDP/{item.snmp_port} · {item.timeout_ms}ms · {item.concurrency} workers</small></span>
            <span><strong>{item.probe_name || item.probe_reference}</strong><small>{probe?.agent_version || 'Agent'} · {probe?.online ? 'Online' : 'Offline'}</small></span>
            <span><strong>{item.credential_name}</strong><small>{String(item.snmp_version).toUpperCase()}</small></span>
            <span><strong>{when(item.last_scan_at)}</strong><small>Next: {item.enabled ? when(item.next_scan_at) : 'Disabled'}</small></span>
            <span><StatusPill tone={item.enabled ? (probe?.online && probe?.snmp_capable ? 'healthy' : 'warning') : 'neutral'}>{item.enabled ? (!probe?.online ? 'Probe offline' : probe?.snmp_capable ? 'Ready' : 'Upgrade Agent') : 'Disabled'}</StatusPill></span>
            <span className="actions"><button disabled={!item.enabled || !probe?.online || !probe?.snmp_capable || scanning || busy === 'scan:' + item.id} onClick={() => runScan(item.id)} type="button"><Play size={13} /> {scanning ? 'Scanning…' : 'Scan now'}</button><button disabled={busy === 'profile:' + item.id} onClick={() => toggleProfile(item)} type="button">{item.enabled ? 'Disable' : 'Enable'}</button></span>
          </div>
        })}
      </div>
      {!profiles.length && <div className="rmm-empty compact"><Radar size={22} /><strong>No discovery ranges yet</strong><span>Create a credential and profile above to start finding network devices.</span></div>}
    </section>

    <section className="rmm-table-card rmm-network-devices-card">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">SNMP inventory</span><h2>Discovered network devices</h2><p>Standard SNMP system identity returned by devices on configured ranges.</p></div><span>{devices.length} device{devices.length === 1 ? '' : 's'}</span></div>
      <div className="rmm-network-table devices">
        <div className="head"><span>Device</span><span>Address</span><span>Vendor / type</span><span>SNMP identity</span><span>Interfaces</span><span>Last seen</span><span>Status</span></div>
        {devices.map((item) => {
          const Icon = deviceIcon(item.device_type)
          return <div className="row" key={item.id}>
            <span className="device"><i><Icon size={16} /></i><span><strong>{item.sys_name || item.hostname || item.ip_address}</strong><small>{item.profile_name}{item.site_name ? ' · ' + item.site_name : ''}</small></span></span>
            <span><strong>{item.ip_address}</strong><small>{item.mac_address || 'MAC not resolved'}</small></span>
            <span><strong>{item.vendor || 'Unknown vendor'}</strong><small>{String(item.device_type || 'network_device').replaceAll('_', ' ')}</small></span>
            <span><strong>{item.sys_object_id || 'Object ID not reported'}</strong><small title={item.sys_descr}>{item.sys_descr || 'Description not reported'}</small></span>
            <span><strong>{item.interface_count ?? '—'}</strong><small>{String(item.snmp_version || '').toUpperCase()}</small></span>
            <span><strong>{when(item.last_seen_at)}</strong><small>{item.sys_location || 'Location not reported'}</small></span>
            <span><StatusPill tone={item.status === 'online' ? 'healthy' : 'offline'}>{item.status}</StatusPill></span>
          </div>
        })}
      </div>
      {!devices.length && <div className="rmm-empty compact"><Network size={22} /><strong>No SNMP devices discovered yet</strong><span>Run a profile scan to populate network inventory.</span></div>}
    </section>

    <section className="rmm-card rmm-network-runs-card">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">History</span><h2>Recent discovery runs</h2></div></div>
      <div className="rmm-network-run-list">
        {runs.slice(0, 12).map((run) => <div key={run.id}><CircleDot size={13} /><span><strong>{run.profile_name}</strong><small>{when(run.created_at)} · {run.addresses_total || 0} addresses · {run.snmp_devices || 0} SNMP devices</small></span><StatusPill tone={run.status === 'completed' ? 'healthy' : run.status === 'failed' ? 'critical' : run.status === 'running' ? 'running' : 'neutral'}>{run.status}</StatusPill></div>)}
        {!runs.length && <div className="rmm-network-mini-empty">No network discovery scans have run yet.</div>}
      </div>
    </section>
  </div>
}
