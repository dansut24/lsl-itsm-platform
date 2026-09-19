import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  GitBranch,
  Layers3,
  Monitor,
  Plus,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import {
  RMM_CUSTOM_MONITORING_ASSIGNMENTS_STORAGE_KEY,
  RMM_CUSTOM_MONITORING_POLICIES_STORAGE_KEY,
  RMM_DEVICE_MONITORING_OVERRIDES_STORAGE_KEY,
  monitoringPolicyCoverage,
  monitoringScopeDeviceCount,
  monitoringScopeOptions,
  readMonitoringStoredList,
  resolveDeviceMonitoringPolicy,
  rmmDeviceMonitoringOverrides,
  rmmMonitoringAssignments,
  rmmMonitoringPolicies,
  writeMonitoringStoredList,
} from '../../data/rmmMonitoringData.js'
import './RmmMonitoringPolicies.css'

function PageHeading({ action }) {
  return (
    <div className="rmm-page-heading">
      <div><span className="rmm-eyebrow">Monitoring configuration</span><h1>Monitoring policies</h1><p>Define reusable monitoring checks, assign them to estate scopes and understand exactly which policy wins for every device.</p></div>
      {action}
    </div>
  )
}

function StatusPill({ children, tone = 'healthy' }) {
  return <span className={`rmm-status-pill ${tone}`}>{children}</span>
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`
}

function PolicyIcon({ category }) {
  if (String(category).toLowerCase().includes('server')) return <Server size={18} />
  if (String(category).toLowerCase().includes('infrastructure')) return <Layers3 size={18} />
  return <Monitor size={18} />
}

function PolicyCard({ assignments, customOptions, onAssign, onSelect, policy, selected }) {
  const coverage = monitoringPolicyCoverage(policy.id, customOptions)
  const directAssignments = assignments.filter((assignment) => assignment.policyId === policy.id && assignment.enabled !== false)
  return (
    <article className={`rmm-monitor-policy-card ${selected ? 'selected' : ''}`}>
      <button className="rmm-monitor-policy-main" onClick={() => onSelect(policy.id)} type="button">
        <span className="rmm-monitor-policy-icon"><PolicyIcon category={policy.category} /></span>
        <span className="rmm-monitor-policy-copy">
          <span className="rmm-eyebrow">{policy.id} · {policy.category}</span>
          <strong>{policy.name}</strong>
          <small>{policy.description}</small>
          <span className="rmm-monitor-policy-tags"><b>{policy.platform}</b><b>{policy.evaluation}</b><b>{policy.checks?.length || 0} checks</b></span>
        </span>
        <span className="rmm-monitor-policy-summary"><StatusPill>{policy.status || 'Active'}</StatusPill><strong>{coverage}</strong><small>effective devices</small><ChevronRight size={16} /></span>
      </button>
      <footer><span>{directAssignments.length} direct scope assignment{directAssignments.length === 1 ? '' : 's'}</span><button onClick={() => onAssign(policy.id)} type="button"><GitBranch size={14} /> Assign scope</button></footer>
    </article>
  )
}

function CheckTable({ checks = [] }) {
  return (
    <div className="rmm-monitor-check-list">
      {checks.map((check) => (
        <div key={check.id}>
          <span className="rmm-monitor-check-icon"><CircleGauge size={15} /></span>
          <span><strong>{check.label}</strong><small>{check.metric} · {check.condition}</small></span>
          <span><small>Warning</small><strong>{check.warning == null ? 'Event' : `${check.warning}${check.unit}`}</strong></span>
          <span><small>Critical</small><strong>{check.critical == null ? 'Event' : `${check.critical}${check.unit}`}</strong></span>
          <span><small>Duration</small><strong>{check.duration}</strong></span>
        </div>
      ))}
    </div>
  )
}

function AssignmentRow({ assignment, canDelete, customOptions, onDelete, policies }) {
  const policy = policies.find((item) => item.id === assignment.policyId)
  return (
    <div className="rmm-monitor-assignment-row">
      <span className={`rmm-monitor-scope-icon ${String(assignment.scopeType).toLowerCase().replace(/\s+/g, '-')}`}>
        {assignment.scopeType === 'Site' ? <Building2 size={15} /> : assignment.scopeType === 'Group' ? <Users size={15} /> : assignment.scopeType === 'Device' ? <Monitor size={15} /> : <Layers3 size={15} />}
      </span>
      <span><strong>{assignment.scopeName}</strong><small>{assignment.scopeType} · priority {assignment.priority}</small></span>
      <span><strong>{policy?.name || assignment.policyId}</strong><small>{monitoringScopeDeviceCount(assignment.scopeType, assignment.scopeId, customOptions)} devices in scope</small></span>
      <StatusPill tone={assignment.enabled === false ? 'neutral' : 'healthy'}>{assignment.enabled === false ? 'Disabled' : 'Active'}</StatusPill>
      {canDelete ? <button aria-label={`Delete ${assignment.scopeName} assignment`} onClick={() => onDelete(assignment.id)} type="button"><Trash2 size={14} /></button> : <span className="rmm-monitor-built-in">Built-in</span>}
    </div>
  )
}

function DeviceResolution({ customOptions, deviceId, onDeviceChange }) {
  const devices = customOptions.devices || []
  const device = devices.find((item) => item.id === deviceId) || devices[0]
  if (!device) return <section className="rmm-monitor-resolution-card"><div className="rmm-empty"><Monitor size={24} /><strong>No devices enrolled</strong><span>Monitoring resolution will appear when a real managed device is available.</span></div></section>
  const resolution = resolveDeviceMonitoringPolicy(device, customOptions)
  return (
    <section className="rmm-monitor-resolution-card">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Effective policy resolver</span><h2>Why this device gets this policy</h2></div><StatusPill>{resolution.override ? 'Device override' : 'Inherited'}</StatusPill></div>
      <label className="rmm-monitor-device-picker">Preview device<select value={device.id} onChange={(event) => onDeviceChange(event.target.value)}>{devices.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.site || 'No site'} · {item.group || 'No group'}</option>)}</select></label>
      <div className="rmm-monitor-effective-policy"><span><ShieldCheck size={20} /></span><div><small>Effective monitoring policy</small><strong>{resolution.policy?.name || 'No policy assigned'}</strong><p>{resolution.policy ? (resolution.override?.reason || 'Highest-priority matching scope assignment wins.') : 'This device has no explicit monitoring policy assignment.'}</p></div><b>{resolution.policy?.id || '—'}</b></div>
      <div className="rmm-monitor-chain">
        {resolution.chain.map((step, index) => (
          <div className={step.winning ? 'winning' : ''} key={step.id}>
            <span>{index + 1}</span>
            <div><small>{step.scopeType}</small><strong>{step.scopeName}</strong><p>{step.policy?.name || step.policyId}</p></div>
            <b>Priority {step.priority}</b>
            {step.winning && <StatusPill>Effective</StatusPill>}
          </div>
        ))}
      </div>
      {resolution.override && <div className="rmm-monitor-override-note"><AlertTriangle size={15} /><span><strong>Per-device threshold override active.</strong> The policy remains {resolution.policy?.name}, but selected checks use tighter thresholds for this device.</span></div>}
    </section>
  )
}

function AssignmentModal({ customOptions, initialPolicyId, onClose, onSave, policies }) {
  const [policyId, setPolicyId] = useState(initialPolicyId || policies[0]?.id || '')
  const [scopeType, setScopeType] = useState('Estate')
  const options = monitoringScopeOptions(scopeType, customOptions)
  const [scopeId, setScopeId] = useState(options[0]?.id || '')

  function changeScopeType(next) {
    setScopeType(next)
    setScopeId(monitoringScopeOptions(next, customOptions)[0]?.id || '')
  }

  function submit(event) {
    event.preventDefault()
    const selected = monitoringScopeOptions(scopeType, customOptions).find((item) => item.id === scopeId)
    if (!policyId || !selected) return
    const priorityBase = { Estate: 100, Site: 220, Group: 340, Device: 900 }[scopeType] || 200
    onSave({
      id: createId('ASG'),
      policyId,
      scopeType,
      scopeId,
      scopeName: selected.name,
      priority: priorityBase + 5,
      source: 'Custom',
      enabled: true,
    })
  }

  return (
    <div className="rmm-monitor-modal-backdrop">
      <form className="rmm-monitor-modal" onSubmit={submit}>
        <header><div><span className="rmm-eyebrow">Policy targeting</span><h2>Assign monitoring policy</h2></div><button aria-label="Close" onClick={onClose} type="button"><X size={17} /></button></header>
        <p>More specific scopes take precedence over broader scopes. A device override always wins.</p>
        <label>Policy<select value={policyId} onChange={(event) => setPolicyId(event.target.value)}>{policies.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}</select></label>
        <div className="rmm-monitor-scope-type"><span>Scope type</span><div>{['Estate', 'Site', 'Group', 'Device'].map((type) => <button className={scopeType === type ? 'active' : ''} key={type} onClick={() => changeScopeType(type)} type="button">{type}</button>)}</div></div>
        <label>Target<select value={scopeId} onChange={(event) => setScopeId(event.target.value)}>{monitoringScopeOptions(scopeType, customOptions).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="rmm-monitor-modal-info"><GitBranch size={16} /><span><strong>Automatic precedence:</strong> Estate → Site → Group → Device. Only explicit tenant assignments participate in resolution.</span></div>
        <footer><button onClick={onClose} type="button">Cancel</button><button className="rmm-primary" type="submit"><CheckCircle2 size={15} /> Assign policy</button></footer>
      </form>
    </div>
  )
}

function NewPolicyModal({ onClose, onSave }) {
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState('Windows')
  const [description, setDescription] = useState('')

  function submit(event) {
    event.preventDefault()
    if (!name.trim()) return
    onSave({
      id: createId('MON'),
      name: name.trim(),
      platform,
      category: 'Endpoint',
      description: description.trim() || 'Tenant-created monitoring policy.',
      evaluation: 'Every 2 minutes',
      alertDelay: '5 minutes',
      autoResolve: true,
      status: 'Active',
      custom: true,
      checks: [
        { id: 'cpu', label: 'CPU utilisation', metric: 'CPU', condition: 'Above', warning: 85, critical: 95, unit: '%', duration: '10 min' },
        { id: 'memory', label: 'Memory utilisation', metric: 'Memory', condition: 'Above', warning: 85, critical: 95, unit: '%', duration: '10 min' },
        { id: 'disk', label: 'Disk utilisation', metric: 'Disk', condition: 'Above', warning: 85, critical: 92, unit: '%', duration: '5 min' },
        { id: 'offline', label: 'Agent availability', metric: 'Heartbeat', condition: 'Missing for', warning: 15, critical: 30, unit: 'min', duration: 'Immediate' },
      ],
    })
  }

  return (
    <div className="rmm-monitor-modal-backdrop">
      <form className="rmm-monitor-modal" onSubmit={submit}>
        <header><div><span className="rmm-eyebrow">Reusable configuration</span><h2>New monitoring policy</h2></div><button aria-label="Close" onClick={onClose} type="button"><X size={17} /></button></header>
        <p>No policy records are inserted automatically. This creates a real tenant policy with editable starter thresholds.</p>
        <label>Policy name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Finance critical endpoints" /></label>
        <label>Platform<select value={platform} onChange={(event) => setPlatform(event.target.value)}><option>Windows</option><option>Windows / macOS</option><option>Windows Server</option><option>Linux</option><option>Network devices</option></select></label>
        <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What should this policy protect?" rows="3" /></label>
        <footer><button onClick={onClose} type="button">Cancel</button><button className="rmm-primary" type="submit"><Plus size={15} /> Create policy</button></footer>
      </form>
    </div>
  )
}

export function RmmMonitoringPolicies({ devices = [], openDevice, sites = [] }) {
  const [customPolicies, setCustomPolicies] = useState(() => readMonitoringStoredList(RMM_CUSTOM_MONITORING_POLICIES_STORAGE_KEY))
  const [customAssignments, setCustomAssignments] = useState(() => readMonitoringStoredList(RMM_CUSTOM_MONITORING_ASSIGNMENTS_STORAGE_KEY))
  const [customOverrides] = useState(() => readMonitoringStoredList(RMM_DEVICE_MONITORING_OVERRIDES_STORAGE_KEY))
  const [selectedPolicyId, setSelectedPolicyId] = useState('')
  const [previewDeviceId, setPreviewDeviceId] = useState('')
  const [assignPolicyId, setAssignPolicyId] = useState('')
  const [showNewPolicy, setShowNewPolicy] = useState(false)
  const [tab, setTab] = useState('policies')

  const policies = useMemo(() => [...rmmMonitoringPolicies, ...customPolicies], [customPolicies])
  const assignments = useMemo(() => [...rmmMonitoringAssignments, ...customAssignments], [customAssignments])
  const customOptions = useMemo(() => ({ customPolicies, customAssignments, customOverrides, devices, sites, groups: [] }), [customPolicies, customAssignments, customOverrides, devices, sites])
  const selectedPolicy = policies.find((policy) => policy.id === selectedPolicyId) || policies[0] || null
  const activeOverrides = [...rmmDeviceMonitoringOverrides, ...customOverrides].filter((item) => item.enabled !== false).length
  const coveredDevices = devices.filter((device) => resolveDeviceMonitoringPolicy(device, customOptions).policy).length

  function addAssignment(assignment) {
    const next = [...customAssignments, assignment]
    setCustomAssignments(next)
    writeMonitoringStoredList(RMM_CUSTOM_MONITORING_ASSIGNMENTS_STORAGE_KEY, next)
    setAssignPolicyId('')
    setTab('assignments')
  }

  function deleteAssignment(assignmentId) {
    const next = customAssignments.filter((assignment) => assignment.id !== assignmentId)
    setCustomAssignments(next)
    writeMonitoringStoredList(RMM_CUSTOM_MONITORING_ASSIGNMENTS_STORAGE_KEY, next)
  }

  function addPolicy(policy) {
    const next = [...customPolicies, policy]
    setCustomPolicies(next)
    writeMonitoringStoredList(RMM_CUSTOM_MONITORING_POLICIES_STORAGE_KEY, next)
    setSelectedPolicyId(policy.id)
    setShowNewPolicy(false)
    setTab('policies')
  }

  return (
    <>
      <PageHeading action={<div className="rmm-monitor-heading-actions"><button disabled={!selectedPolicy} onClick={() => selectedPolicy && setAssignPolicyId(selectedPolicy.id)} type="button"><GitBranch size={15} /> Assign scope</button><button className="rmm-primary compact" onClick={() => setShowNewPolicy(true)} type="button"><Plus size={15} /> New policy</button></div>} />

      <div className="rmm-monitor-summary-grid">
        <div><span><SlidersHorizontal size={17} /></span><div><strong>{policies.length}</strong><small>Monitoring policies</small></div></div>
        <div><span><GitBranch size={17} /></span><div><strong>{assignments.filter((item) => item.enabled !== false).length}</strong><small>Scope assignments</small></div></div>
        <div><span><Monitor size={17} /></span><div><strong>{coveredDevices}</strong><small>Devices resolved</small></div></div>
        <div><span className="warning"><AlertTriangle size={17} /></span><div><strong>{activeOverrides}</strong><small>Device overrides</small></div></div>
      </div>

      <section className="rmm-monitor-inheritance-banner">
        <div><span className="rmm-monitor-inheritance-icon"><GitBranch size={20} /></span><div><span className="rmm-eyebrow">Deterministic inheritance</span><strong>Broad assignments, precise exceptions</strong><p>Only explicit tenant assignments are evaluated. Site assignments replace Estate, Group replaces Site, and an explicit Device override wins last.</p></div></div>
        <div className="rmm-monitor-inheritance-flow"><span>Estate<small>100</small></span><ArrowDown size={14} /><span>Site<small>220</small></span><ArrowDown size={14} /><span>Group<small>340+</small></span><ArrowDown size={14} /><span>Device<small>900+</small></span></div>
      </section>

      <div className="rmm-monitor-tabs">
        <button className={tab === 'policies' ? 'active' : ''} onClick={() => setTab('policies')} type="button">Policies</button>
        <button className={tab === 'assignments' ? 'active' : ''} onClick={() => setTab('assignments')} type="button">Scope assignments <b>{assignments.length}</b></button>
        <button className={tab === 'resolver' ? 'active' : ''} onClick={() => setTab('resolver')} type="button">Effective policy resolver</button>
      </div>

      {tab === 'policies' && (
        policies.length ? <div className="rmm-monitor-policy-layout">
          <div className="rmm-monitor-policy-list">
            {policies.map((policy) => <PolicyCard assignments={assignments} customOptions={customOptions} key={policy.id} onAssign={setAssignPolicyId} onSelect={setSelectedPolicyId} policy={policy} selected={selectedPolicy?.id === policy.id} />)}
          </div>
          {selectedPolicy && <aside className="rmm-monitor-policy-detail">
            <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Selected policy</span><h2>{selectedPolicy.name}</h2></div><StatusPill>{selectedPolicy.status || 'Active'}</StatusPill></div>
            <p>{selectedPolicy.description}</p>
            <div className="rmm-monitor-policy-meta"><span><small>Platform</small><strong>{selectedPolicy.platform}</strong></span><span><small>Evaluation</small><strong>{selectedPolicy.evaluation}</strong></span><span><small>Alert delay</small><strong>{selectedPolicy.alertDelay || 'Not set'}</strong></span><span><small>Auto resolve</small><strong>{selectedPolicy.autoResolve ? 'Enabled' : 'Disabled'}</strong></span></div>
            <div className="rmm-card-heading compact"><div><span className="rmm-eyebrow">Checks</span><h3>Thresholds & conditions</h3></div></div>
            <CheckTable checks={selectedPolicy.checks} />
          </aside>}
        </div> : <div className="rmm-empty"><ShieldCheck size={24} /><strong>No monitoring policies configured</strong><span>Create the first tenant policy when you are ready. No policy records are inserted automatically.</span></div>
      )}

      {tab === 'assignments' && (
        <section className="rmm-monitor-assignment-card">
          <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Targeting</span><h2>Scope assignments</h2><p>Assignments are evaluated by priority so overlapping scopes remain predictable.</p></div><button className="rmm-primary compact" disabled={!selectedPolicy} onClick={() => selectedPolicy && setAssignPolicyId(selectedPolicy.id)} type="button"><Plus size={14} /> Assign policy</button></div>
          <div className="rmm-monitor-assignment-head"><span>Scope</span><span>Effective candidate</span><span>Status</span><span /></div>
          {assignments.slice().sort((a, b) => Number(b.priority) - Number(a.priority)).map((assignment) => <AssignmentRow assignment={assignment} canDelete={assignment.source === 'Custom'} customOptions={customOptions} key={assignment.id} onDelete={deleteAssignment} policies={policies} />)}
          {!assignments.length && <div className="rmm-empty"><GitBranch size={24} /><strong>No scope assignments</strong><span>Policies do not affect devices until you explicitly assign them.</span></div>}
          <div className="rmm-monitor-device-overrides"><div><span><AlertTriangle size={15} /></span><strong>Explicit device overrides</strong><small>Overrides are intentionally separate from normal scope assignments so exceptions are easy to audit.</small></div>{[...rmmDeviceMonitoringOverrides, ...customOverrides].map((override) => { const device = devices.find((item) => item.id === override.deviceId); const policy = policies.find((item) => item.id === override.policyId); return <button key={override.id} onClick={() => device && openDevice?.(device)} type="button"><span><strong>{device?.name || override.deviceId}</strong><small>{override.reason || 'Device-specific monitoring override'}</small></span><span>{policy?.name || override.policyId}</span><ChevronRight size={15} /></button> })}</div>
        </section>
      )}

      {tab === 'resolver' && <DeviceResolution customOptions={customOptions} deviceId={previewDeviceId} onDeviceChange={setPreviewDeviceId} />}

      {assignPolicyId && <AssignmentModal customOptions={customOptions} initialPolicyId={assignPolicyId} onClose={() => setAssignPolicyId('')} onSave={addAssignment} policies={policies} />}
      {showNewPolicy && <NewPolicyModal onClose={() => setShowNewPolicy(false)} onSave={addPolicy} />}
    </>
  )
}
