import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Clock3,
  GitBranch,
  Monitor,
  PackageCheck,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react'
import {
  createPatchAssignment,
  createPatchPolicy,
  createSoftwareCatalogueEntry,
  deletePatchAssignment,
  deleteSoftwareCatalogueEntry,
  loadRmmPatching,
  loadRmmVulnerabilities,
} from '../../lib/rmmPatchingApi.js'
import { loadRmmScope } from '../../lib/rmmScopeApi.js'
import './RmmPatching.css'

function StatusPill({ children, tone = 'neutral' }) {
  return <span className={`rmm-status-pill ${tone}`}>{children}</span>
}
function patchTone(status) {
  if (status === 'update_available') return 'warning'
  if (status === 'current') return 'healthy'
  if (status === 'detection_pending') return 'running'
  return 'neutral'
}

function patchLabel(status) {
  return ({
    update_available: 'Update available',
    current: 'Current',
    detection_pending: 'Detection pending',
    unmapped: 'Unmapped',
    unsupported: 'Unsupported',
  })[status] || status
}

function PageHeading({ action }) {
  return (
    <div className="rmm-page-heading">
      <div>
        <span className="rmm-eyebrow">Maintenance</span>
        <h1>Patching</h1>
        <p>Software patching, Windows Update, vulnerability intelligence and patch policy targeting.</p>
      </div>
      {action}
    </div>
  )
}

function Metric({ icon: Icon, label, value, tone = '' }) {
  return <div className={tone}><span><Icon size={17} /></span><div><strong>{value}</strong><small>{label}</small></div></div>
}
function MappingModal({ application, onClose, onSave }) {
  const [form, setForm] = useState({
    canonicalName: application?.name || '',
    publisher: application?.publisher || '',
    namePattern: application?.name || '',
    publisherPattern: application?.publisher || '',
    provider: 'winget',
    packageId: '',
    targetVersion: '',
    releaseChannel: 'stable',
  })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const valid = form.canonicalName.trim().length > 1 && form.namePattern.trim().length > 1

  return <div className="rmm-patch-modal-backdrop">
    <form className="rmm-patch-modal" onSubmit={(event) => {
      event.preventDefault()
      if (valid) onSave(form)
    }}>
      <header>
        <div><span className="rmm-eyebrow">Software catalogue</span><h2>Map patchable software</h2></div>
        <button aria-label="Close" onClick={onClose} type="button"><X size={17} /></button>
      </header>
      <p>Map real inventory to a controlled patch provider. The complete catalogue remains server-side.</p>
      <div className="rmm-patch-form-grid">
        <label>Canonical application<input autoFocus value={form.canonicalName} onChange={(event) => update('canonicalName', event.target.value)} /></label>
        <label>Publisher<input value={form.publisher} onChange={(event) => update('publisher', event.target.value)} /></label>
        <label>Name contains<input value={form.namePattern} onChange={(event) => update('namePattern', event.target.value)} /></label>
        <label>Publisher contains<input value={form.publisherPattern} onChange={(event) => update('publisherPattern', event.target.value)} /></label>
        <label>Provider<select value={form.provider} onChange={(event) => update('provider', event.target.value)}><option value="winget">WinGet</option><option value="managed">Hi5Central managed</option><option value="vendor">Vendor updater</option></select></label>
        <label>Package ID<input value={form.packageId} onChange={(event) => update('packageId', event.target.value)} placeholder="e.g. Google.Chrome" /></label>
        <label>Target version<input value={form.targetVersion} onChange={(event) => update('targetVersion', event.target.value)} placeholder="Leave blank until confirmed" /></label>
        <label>Release channel<input value={form.releaseChannel} onChange={(event) => update('releaseChannel', event.target.value)} /></label>
      </div>
      <div className="rmm-patch-security-note">
        <ShieldCheck size={16} />
        <span><strong>Catalogue protection:</strong> only a per-job package manifest will ever be sent to PatchHost.</span>
      </div>
      <footer>
        <button onClick={onClose} type="button">Cancel</button>
        <button className="rmm-primary" disabled={!valid} type="submit"><PackageCheck size={15} /> Save mapping</button>
      </footer>
    </form>
  </div>
}

function PolicyModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    approvalMode: 'manual',
    deploymentDelayDays: 3,
    softwareEnabled: true,
    windowsEnabled: false,
    rebootPolicy: 'never',
    maxRetries: 2,
    maintenanceStart: '18:00',
    maintenanceEnd: '05:00',
  })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <div className="rmm-patch-modal-backdrop">
    <form className="rmm-patch-modal" onSubmit={(event) => {
      event.preventDefault()
      if (form.name.trim().length < 2) return
      onSave({
        ...form,
        maintenanceWindow: {
          start: form.maintenanceStart,
          end: form.maintenanceEnd,
          timezone: 'tenant',
        },
      })
    }}>
      <header>
        <div><span className="rmm-eyebrow">Reusable targeting</span><h2>New patch policy</h2></div>
        <button aria-label="Close" onClick={onClose} type="button"><X size={17} /></button>
      </header>
      <div className="rmm-patch-form-grid">
        <label className="wide">Policy name<input autoFocus value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Standard workstations" /></label>
        <label className="wide">Description<textarea rows="2" value={form.description} onChange={(event) => update('description', event.target.value)} /></label>
        <label>Approval mode<select value={form.approvalMode} onChange={(event) => update('approvalMode', event.target.value)}><option value="manual">Manual approval</option><option value="automatic">Automatic</option><option value="pilot">Pilot → production</option><option value="blocked">Blocked</option></select></label>
        <label>Deployment delay (days)<input min="0" max="365" type="number" value={form.deploymentDelayDays} onChange={(event) => update('deploymentDelayDays', event.target.value)} /></label>
        <label>Window starts<input type="time" value={form.maintenanceStart} onChange={(event) => update('maintenanceStart', event.target.value)} /></label>
        <label>Window ends<input type="time" value={form.maintenanceEnd} onChange={(event) => update('maintenanceEnd', event.target.value)} /></label>
        <label>Reboot policy<select value={form.rebootPolicy} onChange={(event) => update('rebootPolicy', event.target.value)}><option value="never">Never automatically</option><option value="maintenance_window">During maintenance window</option><option value="notify_user">Notify user</option></select></label>
        <label>Retries<input min="0" max="10" type="number" value={form.maxRetries} onChange={(event) => update('maxRetries', event.target.value)} /></label>
      </div>
      <div className="rmm-patch-checks">
        <label><input checked={form.softwareEnabled} onChange={(event) => update('softwareEnabled', event.target.checked)} type="checkbox" /><span><strong>Software patching</strong><small>Prioritised for the first execution release.</small></span></label>
        <label><input checked={form.windowsEnabled} onChange={(event) => update('windowsEnabled', event.target.checked)} type="checkbox" /><span><strong>Windows Update</strong><small>Uses the same PatchHost and policy framework.</small></span></label>
      </div>
      <footer><button onClick={onClose} type="button">Cancel</button><button className="rmm-primary" type="submit"><Plus size={15} /> Create policy</button></footer>
    </form>
  </div>
}

function AssignmentModal({ devices, groups, onClose, onSave, policy }) {
  const [scopeType, setScopeType] = useState('Estate')
  const siteOptions = useMemo(() => [...new Map(devices.filter((d) => d.site).map((d) => [d.siteId || d.site, { id: d.siteId || d.site, name: d.site }])).values()], [devices])
  const options = scopeType === 'Estate'
    ? [{ id: 'ALL', name: 'Entire estate' }]
    : scopeType === 'Site'
      ? siteOptions
      : scopeType === 'Group'
        ? groups.map((group) => ({ id: group.id, name: group.name }))
        : devices.map((device) => ({ id: device.id, name: device.name }))
  const [scopeId, setScopeId] = useState('ALL')

  function changeScopeType(nextType) {
    setScopeType(nextType)
    const nextOptions = nextType === 'Estate'
      ? [{ id: 'ALL', name: 'Entire estate' }]
      : nextType === 'Site'
        ? siteOptions
        : nextType === 'Group'
          ? groups.map((group) => ({ id: group.id, name: group.name }))
          : devices.map((device) => ({ id: device.id, name: device.name }))
    setScopeId(nextOptions[0]?.id || '')
  }

  const selected = options.find((item) => item.id === scopeId)
  return <div className="rmm-patch-modal-backdrop">
    <form className="rmm-patch-modal small" onSubmit={(event) => {
      event.preventDefault()
      if (!selected) return
      onSave({
        policyId: policy.id,
        scopeType,
        scopeId: selected.id,
        scopeName: selected.name,
      })
    }}>
      <header><div><span className="rmm-eyebrow">Patch targeting</span><h2>Assign {policy.name}</h2></div><button aria-label="Close" onClick={onClose} type="button"><X size={17} /></button></header>
      <label>Scope type<select value={scopeType} onChange={(event) => changeScopeType(event.target.value)}><option>Estate</option><option>Site</option><option>Group</option><option>Device</option></select></label>
      <label>Target<select value={scopeId} onChange={(event) => setScopeId(event.target.value)}>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="rmm-patch-security-note"><GitBranch size={16} /><span>Precedence follows Estate → Site → Group → Device.</span></div>
      <footer><button onClick={onClose} type="button">Cancel</button><button className="rmm-primary" disabled={!selected} type="submit">Assign policy</button></footer>
    </form>
  </div>
}
export function RmmPatching({ devices = [] }) {
  const [tab, setTab] = useState('software')
  const [bundle, setBundle] = useState(null)
  const [scope, setScope] = useState({ groups: [] })
  const [vulnerabilities, setVulnerabilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [mappingApp, setMappingApp] = useState(null)
  const [showPolicy, setShowPolicy] = useState(false)
  const [assignPolicy, setAssignPolicy] = useState(null)

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const [patching, scopePayload, vulnPayload] = await Promise.all([
        loadRmmPatching(),
        loadRmmScope(),
        loadRmmVulnerabilities(75),
      ])
      setBundle(patching)
      setScope(scopePayload || { groups: [] })
      setVulnerabilities(vulnPayload.vulnerabilities || [])
    } catch (requestError) {
      setError(requestError?.message || 'Unable to load patching data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([loadRmmPatching(), loadRmmScope(), loadRmmVulnerabilities(75)])
      .then(([patching, scopePayload, vulnPayload]) => {
        if (!active) return
        setBundle(patching)
        setScope(scopePayload || { groups: [] })
        setVulnerabilities(vulnPayload.vulnerabilities || [])
      })
      .catch((requestError) => {
        if (active) setError(requestError?.message || 'Unable to load patching data.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const applications = bundle?.applications || []
  const catalogueCandidates = bundle?.catalogueCandidates || []
  const patchObservations = bundle?.patchObservations || []
  const policies = bundle?.policies || []
  const assignments = bundle?.assignments || []
  const overview = bundle?.overview || {}
  const exposedApps = applications.filter((item) => item.updateAvailable > 0)
  const mappedApps = applications.filter((item) => item.catalogue)
  const windowsReported = devices.filter((device) => device.pendingPatches != null)
  const windowsPending = windowsReported.reduce((sum, device) => sum + Number(device.pendingPatches || 0), 0)
  const patchHostReady = (bundle?.devices || []).filter((device) => device.patchCapabilities?.softwareDiscovery).length

  async function saveMapping(form) {
    setSaving(true)
    setError('')
    try {
      const result = await createSoftwareCatalogueEntry(form)
      setBundle(result.bundle)
      setMappingApp(null)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to save software mapping.')
    } finally {
      setSaving(false)
    }
  }

  async function removeMapping(application) {
    if (!application.catalogue?.id || application.catalogue.builtIn) return
    if (!window.confirm('Archive the patch mapping for ' + application.name + '?')) return
    setSaving(true)
    try {
      const result = await deleteSoftwareCatalogueEntry(application.catalogue.id)
      setBundle(result.bundle)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to archive software mapping.')
    } finally {
      setSaving(false)
    }
  }

  async function savePolicy(form) {
    setSaving(true)
    try {
      const result = await createPatchPolicy(form)
      setBundle(result.bundle)
      setShowPolicy(false)
      setTab('policies')
    } catch (requestError) {
      setError(requestError?.message || 'Unable to create patch policy.')
    } finally {
      setSaving(false)
    }
  }
  async function saveAssignment(assignment) {
    setSaving(true)
    try {
      const result = await createPatchAssignment(assignment)
      setBundle(result.bundle)
      setAssignPolicy(null)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to assign patch policy.')
    } finally {
      setSaving(false)
    }
  }

  async function removeAssignment(assignment) {
    setSaving(true)
    try {
      const result = await deletePatchAssignment(assignment.id)
      setBundle(result.bundle)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to remove patch assignment.')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <PageHeading action={<div className="rmm-patch-heading-actions"><button disabled={loading} onClick={refresh} type="button"><RefreshCw size={15} /> Refresh</button><button className="rmm-primary compact" onClick={() => setShowPolicy(true)} type="button"><Plus size={15} /> New policy</button></div>} />
    {error && <div className="rmm-patch-error"><AlertTriangle size={16} /><span>{error}</span></div>}

    <div className="rmm-patch-metrics">
      <Metric icon={PackageCheck} label="Software installations" value={loading ? '…' : overview.softwareInstallations ?? 0} />
      <Metric icon={AlertTriangle} label="Software updates available" value={loading ? '…' : overview.updateAvailable ?? 0} tone="warning" />
      <Metric icon={ShieldCheck} label="Known exploited CVEs" value={loading ? '…' : bundle?.vulnerabilities?.kev ?? 0} tone="critical" />
      <Metric icon={Monitor} label="Windows updates pending" value={windowsPending} />
    </div>
    <section className="rmm-patch-security-banner">
      <ShieldCheck size={20} />
      <div><strong>Server-authoritative patch intelligence</strong><span>The full software/CVE catalogue stays in Hi5Central. PatchHost receives only short-lived per-job manifests and never receives the estate-wide catalogue.</span></div>
      <StatusPill tone="healthy">Protected design</StatusPill>
    </section>

    <nav className="rmm-patch-tabs">
      {[
        ['software', 'Software', exposedApps.length],
        ['vulnerabilities', 'Vulnerabilities', bundle?.vulnerabilities?.kev || 0],
        ['windows', 'Windows Update', windowsPending],
        ['policies', 'Policies', policies.length],
      ].map(([id, label, count]) => <button className={tab === id ? 'active' : ''} key={id} onClick={() => setTab(id)} type="button">{label}<b>{count}</b></button>)}
    </nav>

    {tab === 'software' && <section className="rmm-patch-panel">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Software patch catalogue</span><h2>Patchability by application</h2><p>{mappedApps.length} mapped application{mappedApps.length === 1 ? '' : 's'} · {applications.length - mappedApps.length} awaiting mapping · {catalogueCandidates.length} automatically discovered package{catalogueCandidates.length === 1 ? '' : 's'}.</p></div></div>
      <div className="rmm-patch-table software">
        <div className="head"><span>Application</span><span>Installed</span><span>Target</span><span>Exposure</span><span>Provider</span><span /></div>
        {applications.map((application) => {
          const status = application.updateAvailable ? 'update_available' : application.catalogue?.targetVersion ? 'current' : application.catalogue ? 'detection_pending' : 'unmapped'
          return <div className="row" key={application.key}>
            <span><strong>{application.name}</strong><small>{application.publisher || 'Publisher not reported'} · {application.deviceCount} device{application.deviceCount === 1 ? '' : 's'}</small></span>
            <span><strong>{application.versions?.map((version) => version.version).slice(0, 2).join(', ') || 'Not reported'}</strong></span>
            <span><strong>{application.catalogue?.targetVersion || 'Not set'}</strong><small>{application.catalogue?.packageId || 'No package ID'}</small></span>
            <span><StatusPill tone={patchTone(status)}>{patchLabel(status)}</StatusPill>{application.updateAvailable > 0 && <small>{application.updateAvailable} install{application.updateAvailable === 1 ? '' : 's'} behind</small>}</span>
            <span><strong>{application.catalogue?.provider || 'Unmapped'}</strong><small>{application.catalogue?.builtIn ? 'Hi5Central catalogue' : application.catalogue ? 'Tenant mapping' : 'Needs mapping'}</small></span>
            <span className="actions">{application.catalogue ? <>{!application.catalogue.builtIn && <button aria-label={'Archive ' + application.name} disabled={saving} onClick={() => removeMapping(application)} type="button"><Trash2 size={14} /></button>}</> : <button disabled={saving} onClick={() => setMappingApp(application)} type="button"><Plus size={14} /> Map</button>}</span>
          </div>
        })}
      </div>
      {!applications.length && <div className="rmm-empty"><Box size={24} /><strong>{loading ? 'Loading software inventory…' : 'No software inventory'}</strong><span>Patchability appears after an Agent reports installed applications.</span></div>}
      {!!catalogueCandidates.length && <div className="rmm-patch-candidate-section">
        <div><span className="rmm-eyebrow">PatchHost discovery</span><h3>Automatically learned package mappings</h3><p>These package IDs came from WinGet matching on managed endpoints. They are catalogue candidates, not manually entered records.</p></div>
        <div className="rmm-patch-table candidates">
          <div className="head"><span>Package</span><span>Provider ID</span><span>Devices</span><span>Updates</span><span>Latest observed</span></div>
          {catalogueCandidates.map((candidate) => <div className="row" key={candidate.id}>
            <span><strong>{candidate.display_name || candidate.provider_package_id}</strong><small>{candidate.publisher || 'Publisher pending enrichment'}</small></span>
            <span><strong>{candidate.provider_package_id}</strong><small>{candidate.provider}</small></span>
            <span><strong>{candidate.devices_seen}</strong></span>
            <span><StatusPill tone={candidate.updates_seen > 0 ? 'warning' : 'healthy'}>{candidate.updates_seen}</StatusPill></span>
            <span><strong>{candidate.latest_observed_version || 'Not reported'}</strong><small>{candidate.state}</small></span>
          </div>)}
        </div>
        <small className="rmm-patch-candidate-footnote">{patchObservations.length} endpoint package observation{patchObservations.length === 1 ? '' : 's'} currently back these candidates.</small>
      </div>}
      <div className="rmm-patch-execution-gate"><Clock3 size={17} /><div><strong>Deployment intentionally gated</strong><span>{patchHostReady} endpoint{patchHostReady === 1 ? '' : 's'} currently report PatchHost software-discovery capability. Software deployment controls will enable only when the endpoint reports the later install capability too.</span></div></div>
    </section>}

    {tab === 'vulnerabilities' && <section className="rmm-patch-panel">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Threat intelligence</span><h2>Vulnerability intelligence</h2><p>CISA KEV is ingested centrally now; NVD, MSRC, OSV and vendor adapters share the same source-health model.</p></div></div>
      <div className="rmm-vuln-source-grid">
        {(bundle?.vulnerabilities?.sources || []).map((source) => <article key={source.source}><span><CheckCircle2 size={16} /></span><div><strong>{source.source.replaceAll('_', ' ').toUpperCase()}</strong><small>{source.last_success_at ? 'Last successful sync ' + new Date(source.last_success_at).toLocaleString() : 'Awaiting first successful sync'}</small></div><StatusPill tone={source.last_error ? 'warning' : source.last_success_at ? 'healthy' : 'neutral'}>{source.last_error ? 'Attention' : source.last_success_at ? 'Live' : 'Pending'}</StatusPill></article>)}
      </div>
      <div className="rmm-vuln-table">
        <div className="head"><span>CVE</span><span>Priority</span><span>CVSS</span><span>Published / due</span><span>Summary</span></div>
        {vulnerabilities.map((item) => <div className="row" key={item.cve_id}>
          <span><strong>{item.cve_id}</strong><small>{item.source}</small></span>
          <span>{item.kev ? <StatusPill tone="critical">CISA KEV</StatusPill> : <StatusPill tone="neutral">{item.severity || 'Observed'}</StatusPill>}</span>
          <span><strong>{item.cvss_score ?? 'Pending enrichment'}</strong><small>{item.cvss_version || ''}</small></span>
          <span><strong>{item.kev_added_at || item.published_at ? new Date(item.kev_added_at || item.published_at).toLocaleDateString() : 'Not reported'}</strong><small>{item.kev_due_at ? 'Due ' + new Date(item.kev_due_at).toLocaleDateString() : ''}</small></span>
          <span><strong>{item.summary || 'Description pending enrichment'}</strong><small>{item.known_ransomware_use ? 'Ransomware use: ' + item.known_ransomware_use : item.required_action || ''}</small></span>
        </div>)}
      </div>
      {!vulnerabilities.length && <div className="rmm-empty"><ShieldCheck size={24} /><strong>{loading ? 'Loading vulnerability feeds…' : 'No vulnerability records yet'}</strong><span>The first central intelligence sync runs automatically after deployment.</span></div>}
    </section>}

    {tab === 'windows' && <section className="rmm-patch-panel">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Windows Update</span><h2>Endpoint update inventory</h2><p>Windows patch execution will use the same PatchHost, job history and maintenance policies as software patching.</p></div></div>
      <div className="rmm-patch-table windows">
        <div className="head"><span>Device</span><span>Pending</span><span>Last seen</span><span>Agent</span><span>Status</span></div>
        {windowsReported.map((device) => <div className="row" key={device.id}><span><strong>{device.name}</strong><small>{device.user} · {device.site || 'No site'}</small></span><span><strong>{device.pendingPatches}</strong></span><span><strong>{device.lastSeen}</strong></span><span><strong>{device.agent}</strong></span><span>{device.status === 'Offline' ? <StatusPill tone="neutral"><WifiOff size={12} /> Offline</StatusPill> : <StatusPill tone={device.pendingPatches > 0 ? 'warning' : 'healthy'}>{device.pendingPatches > 0 ? 'Updates pending' : 'Current'}</StatusPill>}</span></div>)}
      </div>
      {!windowsReported.length && <div className="rmm-empty"><Monitor size={24} /><strong>No Windows Update inventory yet</strong><span>Agent inventory will populate this view.</span></div>}
    </section>}
    {tab === 'policies' && <section className="rmm-patch-panel">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Targeting</span><h2>Patch policies</h2><p>Policies use the same Estate → Site → Group → Device targeting model as Monitoring.</p></div><button className="rmm-primary compact" onClick={() => setShowPolicy(true)} type="button"><Plus size={14} /> New policy</button></div>
      <div className="rmm-patch-policy-grid">
        {policies.map((policy) => <article key={policy.id}>
          <header><div><span className="rmm-eyebrow">{policy.approval_mode}</span><h3>{policy.name}</h3></div><StatusPill tone={policy.status === 'active' ? 'healthy' : 'neutral'}>{policy.status}</StatusPill></header>
          <p>{policy.description || 'No description provided.'}</p>
          <div className="meta"><span><small>Software</small><strong>{policy.software_enabled ? 'Enabled' : 'Disabled'}</strong></span><span><small>Windows</small><strong>{policy.windows_enabled ? 'Enabled' : 'Disabled'}</strong></span><span><small>Delay</small><strong>{policy.deployment_delay_days} days</strong></span><span><small>Reboot</small><strong>{policy.reboot_policy}</strong></span></div>
          <footer><span>{assignments.filter((assignment) => assignment.policy_id === policy.id && assignment.enabled !== false).length} assignments</span><button disabled={saving} onClick={() => setAssignPolicy(policy)} type="button"><GitBranch size={14} /> Assign scope</button></footer>
        </article>)}
      </div>
      {!policies.length && <div className="rmm-empty"><GitBranch size={24} /><strong>No patch policies yet</strong><span>Create a software-first policy, then target it to Estate, Site, Group or Device.</span></div>}
      {!!assignments.length && <div className="rmm-patch-assignments">
        <div className="head"><span>Scope</span><span>Policy</span><span>Priority</span><span /></div>
        {assignments.map((assignment) => <div className="row" key={assignment.id}><span><strong>{assignment.scope_name || assignment.scope_id}</strong><small>{assignment.scope_type}</small></span><span><strong>{policies.find((policy) => policy.id === assignment.policy_id)?.name || assignment.policy_id}</strong></span><span><strong>{assignment.priority}</strong></span><span><button disabled={saving} onClick={() => removeAssignment(assignment)} type="button"><Trash2 size={14} /></button></span></div>)}
      </div>}
    </section>}

    {mappingApp && <MappingModal application={mappingApp} onClose={() => setMappingApp(null)} onSave={saveMapping} />}
    {showPolicy && <PolicyModal onClose={() => setShowPolicy(false)} onSave={savePolicy} />}
    {assignPolicy && <AssignmentModal devices={bundle?.devices || devices} groups={scope.groups || []} onClose={() => setAssignPolicy(null)} onSave={saveAssignment} policy={assignPolicy} />}
  </>
}
