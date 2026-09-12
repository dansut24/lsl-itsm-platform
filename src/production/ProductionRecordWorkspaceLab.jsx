import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  FileText,
  Link2,
  MessageSquareText,
  MoreHorizontal,
  Paperclip,
  RefreshCw,
  Send,
  ShieldCheck,
  UserRoundCog,
  X,
} from 'lucide-react'
import {
  addProductionServiceRequestActivity,
  fetchProductionServiceRequest,
  patchProductionServiceRequest,
  transitionProductionServiceRequest,
} from '../services/productionServiceRequests.js'
import './ProductionRecordWorkspaceLab.css'

const API_BASE = window.__HI5_API_BASE__
const GENERIC_TYPES = {
  incidents: 'Incident',
  problems: 'Problem',
  changes: 'Change',
}

function labRoute(pathname = window.location.pathname) {
  const match = pathname.match(/^\/record-lab\/(incidents|requests|problems|changes)\/([^/]+)\/?$/i)
  if (!match) return null
  const section = match[1].toLowerCase()
  return {
    section,
    type: section === 'requests' ? 'Service Request' : GENERIC_TYPES[section],
    reference: decodeURIComponent(match[2]),
  }
}

async function apiJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error || 'The request could not be completed.')
    error.status = response.status
    throw error
  }
  return payload
}

function formatDate(value, withYear = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function relativeTime(value) {
  if (!value) return '—'
  const delta = new Date(value).getTime() - Date.now()
  const absolute = Math.abs(delta)
  const [unit, divisor] = absolute >= 86400000
    ? ['day', 86400000]
    : absolute >= 3600000
      ? ['hour', 3600000]
      : ['minute', 60000]
  return new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' }).format(Math.round(delta / divisor), unit)
}

function money(value, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0))
}

function slug(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function serviceRequestToLab(request, organisation) {
  const activities = Array.isArray(request.activities) ? request.activities : []
  return {
    ...request,
    id: request.id,
    reference: request.id,
    type: 'Service Request',
    title: request.title || request.catalogueItemTitle || request.id,
    requester: request.requester || '',
    requesterEmail: request.requesterEmail || '',
    service: request.service || request.catalogueItemTitle || 'Service Catalogue',
    category: request.catalogueItemTitle || 'Catalogue request',
    status: request.status || 'New',
    priority: request.priority || 'Medium',
    team: request.team || 'Unassigned',
    assignee: request.assignee || 'Unassigned',
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    description: request.description || '',
    activities,
    requestInformation: Array.isArray(request.requestInformation) ? request.requestInformation : [],
    requestedItems: Array.isArray(request.requestedItems) ? request.requestedItems : [],
    requestTasks: Array.isArray(request.requestTasks) ? request.requestTasks : [],
    requestApprovals: Array.isArray(request.requestApprovals) ? request.requestApprovals : [],
    attachments: Array.isArray(request.attachments) ? request.attachments : [],
    relationships: Array.isArray(request.relationships) ? request.relationships : [],
    oneOffCost: Number(request.oneOffCost || 0),
    monthlyCost: Number(request.monthlyCost || 0),
    currency: request.currency || 'GBP',
    nextStep: request.nextStep || '',
    sla: request.sla && typeof request.sla === 'object' ? request.sla : null,
    slaLabel: typeof request.sla === 'string' ? request.sla : '',
    options: {
      people: organisation?.people || [],
      teams: organisation?.teams || [],
    },
  }
}

function activityText(item) {
  return item.text || item.label || item.message || 'Record updated'
}

function isSystemActivity(item) {
  if (!item) return false
  return ['field_change', 'relationship', 'attachment', 'system', 'state', 'status'].includes(item.kind)
    || item.visibility === 'system'
}

function isCustomerActivity(item) {
  return item?.kind === 'customer' || item?.visibility === 'customer'
}

function initials(name = '') {
  return String(name || 'H')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'HC'
}

function LabPill({ tone = 'neutral', children }) {
  return <span className={`record-lab-pill is-${tone}`}>{children}</span>
}

function Metric({ label, value, sub, tone = 'neutral', icon }) {
  return <div className={`record-lab-metric is-${tone}`}>
    <div className="record-lab-metric-icon">{icon}</div>
    <div><span>{label}</span><strong>{value}</strong>{sub ? <small>{sub}</small> : null}</div>
  </div>
}

function OverviewFact({ label, value, sub }) {
  return <div className="record-lab-fact"><span>{label}</span><strong>{value || 'Not recorded'}</strong>{sub ? <small>{sub}</small> : null}</div>
}

function TimelineItem({ item }) {
  if (isSystemActivity(item)) {
    const changes = Array.isArray(item.metadata?.changes) ? item.metadata.changes : []
    return <div className="record-lab-system-event">
      <i />
      <div><strong>{activityText(item)}</strong>{changes.length ? <small>{changes.map((change) => `${change.field}: ${String(change.from || '—')} → ${String(change.to || '—')}`).join(' · ')}</small> : null}</div>
      <time>{formatDate(item.createdAt)}</time>
    </div>
  }

  const customer = isCustomerActivity(item)
  return <article className={`record-lab-timeline-card${customer ? ' is-customer' : ''}`}>
    <div className="record-lab-avatar">{initials(item.actor || 'Hi5Central')}</div>
    <div>
      <header><span><strong>{item.actor || 'Hi5Central'}</strong><small>{formatDate(item.createdAt)}</small></span><LabPill tone={customer ? 'accent' : 'neutral'}>{customer ? 'Customer update' : 'Internal note'}</LabPill></header>
      <p>{activityText(item)}</p>
    </div>
  </article>
}

function SlaPanel({ detail }) {
  const response = detail?.sla?.response
  const resolution = detail?.sla?.resolution
  const paused = Boolean(detail?.sla?.paused)

  const statusFor = (metric) => {
    if (!metric) return { label: 'Not configured', tone: 'neutral', sub: 'No target on this record' }
    if (metric.state === 'met') return { label: 'Met', tone: 'good', sub: metric.completedAt ? `Completed ${formatDate(metric.completedAt)}` : 'Target met' }
    if (metric.state === 'breached') return { label: 'Breached', tone: 'danger', sub: metric.dueAt ? `${relativeTime(metric.dueAt)}` : 'Target exceeded' }
    if (metric.state === 'warning') return { label: metric.dueAt ? `${relativeTime(metric.dueAt)}` : 'At risk', tone: 'warning', sub: 'At risk' }
    return { label: metric.dueAt ? `${relativeTime(metric.dueAt)}` : 'On track', tone: 'good', sub: 'On track' }
  }

  const responseState = statusFor(response)
  const resolutionState = statusFor(resolution)

  if (!response && !resolution && detail?.slaLabel) {
    return <section className="record-lab-sla-card is-neutral">
      <Metric label="SLA" value={detail.slaLabel} sub="Service Request SLA preview" icon={<Clock3 size={18} />} />
      <div className="record-lab-sla-note">This prototype is ready to surface response and resolution timers as soon as the Service Request SLA engine supplies them.</div>
    </section>
  }

  return <section className="record-lab-sla-card">
    <Metric label="First response" value={responseState.label} sub={responseState.sub} tone={responseState.tone} icon={<MessageSquareText size={18} />} />
    <Metric label="Resolution" value={resolutionState.label} sub={resolutionState.sub} tone={resolutionState.tone} icon={<Clock3 size={18} />} />
    <Metric label="SLA clock" value={paused ? 'Paused' : 'Running'} sub={paused && detail.sla?.pausedAt ? `Since ${formatDate(detail.sla.pausedAt)}` : 'Current timer state'} tone={paused ? 'warning' : 'accent'} icon={<CircleDot size={18} />} />
  </section>
}

function ActionComposer({ mode, detail, saving, onClose, onPost, onReassign, onResolve, onPending }) {
  const [text, setText] = useState('')
  const [team, setTeam] = useState(detail.team || '')
  const [assignee, setAssignee] = useState(detail.assignee || 'Unassigned')
  const [pendingStatus, setPendingStatus] = useState('Pending Customer')
  const [resolutionCode, setResolutionCode] = useState('Fixed')
  const customer = mode === 'customer'

  const submit = async () => {
    if (mode === 'internal' || mode === 'customer') return onPost({ visibility: customer ? 'customer' : 'internal', text })
    if (mode === 'reassign') return onReassign({ team, assignee, note: text })
    if (mode === 'resolve') return onResolve({ resolutionCode, note: text })
    if (mode === 'pending') return onPending({ status: pendingStatus, note: text })
    return false
  }

  const label = {
    internal: 'Internal note',
    customer: 'Customer update',
    reassign: 'Reassign record',
    resolve: detail.type === 'Change' ? 'Complete change' : `Resolve ${detail.type.toLowerCase()}`,
    pending: 'Set pending',
  }[mode] || 'Update record'

  return <div className="record-lab-composer">
    <header><div><span>Working action</span><strong>{label}</strong></div><button type="button" onClick={onClose}><X size={16} />Close</button></header>
    {mode === 'reassign' ? <div className="record-lab-composer-fields"><label><span>Assignment group</span><select value={team} onChange={(event) => setTeam(event.target.value)}><option value="">Unassigned</option>{(detail.options?.teams || []).map((item) => <option value={item.name} key={item.id}>{item.name}</option>)}</select></label><label><span>Assignee</span><select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option>Unassigned</option>{(detail.options?.people || []).map((person) => <option value={person.name} key={person.id}>{person.name}</option>)}</select></label></div> : null}
    {mode === 'resolve' && detail.type === 'Incident' ? <div className="record-lab-composer-fields is-single"><label><span>Resolution code</span><select value={resolutionCode} onChange={(event) => setResolutionCode(event.target.value)}>{['Fixed','Workaround','User education','Configuration change','Known error','Duplicate','No fault found','Other'].map((value) => <option key={value}>{value}</option>)}</select></label></div> : null}
    {mode === 'pending' ? <div className="record-lab-composer-fields is-single"><label><span>Pending status</span><select value={pendingStatus} onChange={(event) => setPendingStatus(event.target.value)}><option>Pending Customer</option><option>Pending Vendor</option></select></label></div> : null}
    <textarea autoFocus value={text} onChange={(event) => setText(event.target.value)} placeholder={customer ? 'Write a customer-visible update…' : mode === 'reassign' ? 'Add a handoff note…' : mode === 'resolve' ? 'Add resolution notes…' : mode === 'pending' ? 'Why is this record being placed on hold?' : 'Write an internal work note…'} />
    <footer><span>{customer ? 'Visible to requester' : 'Technician workspace'}</span><button type="button" disabled={saving || ((mode === 'internal' || mode === 'customer') && !text.trim())} onClick={submit}><Send size={16} />{saving ? 'Saving…' : label}</button></footer>
  </div>
}

function RecordWorkspace({ route }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState('overview')
  const [composerMode, setComposerMode] = useState('')
  const scrollRef = useRef(null)

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true)
    setError('')
    try {
      if (route.type === 'Service Request') {
        const [request, organisation] = await Promise.all([
          fetchProductionServiceRequest(route.reference),
          apiJson('/api/v1/organisation').catch(() => ({ people: [], teams: [] })),
        ])
        setDetail(serviceRequestToLab(request, organisation))
      } else {
        const payload = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}`)
        setDetail(payload)
      }
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      if (!quiet) setLoading(false)
    }
  }

  useEffect(() => { void load() }, [route.reference, route.type])
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0 }, [tab])

  const run = async (handler, success) => {
    setSaving(true); setError(''); setNotice('')
    try {
      await handler()
      await load({ quiet: true })
      setComposerMode('')
      setNotice(success)
      return true
    } catch (actionError) {
      setError(actionError.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  const postNote = ({ visibility, text }) => run(async () => {
    if (route.type === 'Service Request') {
      await addProductionServiceRequestActivity(route.reference, { kind: visibility === 'customer' ? 'customer' : 'work', text, html: '', attachments: [] })
    } else {
      await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/activity`, { method: 'POST', body: JSON.stringify({ text, visibility }) })
    }
  }, visibility === 'customer' ? 'Customer update sent' : 'Internal note added')

  const reassign = ({ team, assignee, note }) => run(async () => {
    if (route.type === 'Service Request') {
      await patchProductionServiceRequest(route.reference, { team, assignee })
      if (note?.trim()) await addProductionServiceRequestActivity(route.reference, { kind: 'work', text: note.trim(), html: '', attachments: [] })
    } else {
      await apiJson(`/api/v1/itsm-actions/${encodeURIComponent(route.reference)}/reassign`, { method: 'POST', body: JSON.stringify({ version: detail.version, team, assignee, note }) })
    }
  }, 'Record reassigned')

  const resolve = ({ resolutionCode, note }) => run(async () => {
    if (route.type === 'Service Request') {
      await transitionProductionServiceRequest(route.reference, 'Completed', { completionNotes: note || 'Completed from Record Workspace Lab' })
    } else {
      await apiJson(`/api/v1/itsm-actions/${encodeURIComponent(route.reference)}/resolve`, { method: 'POST', body: JSON.stringify({ version: detail.version, resolutionCode, note, visibility: 'internal' }) })
    }
  }, route.type === 'Service Request' ? 'Request completed' : `${route.type} resolved`)

  const pending = ({ status, note }) => run(async () => {
    if (route.type === 'Service Request') {
      await transitionProductionServiceRequest(route.reference, 'In Progress', { completionNotes: note || '' })
    } else {
      await apiJson(`/api/v1/itsm-actions/${encodeURIComponent(route.reference)}/pending`, { method: 'POST', body: JSON.stringify({ version: detail.version, status, note, visibility: 'internal' }) })
    }
  }, 'Record placed on hold')

  if (loading) return <div className="record-lab-loading"><div /><span>Opening record workspace prototype…</span></div>
  if (!detail) return <div className="record-lab-failure"><AlertTriangle size={22} /><strong>Could not load this record</strong><span>{error}</span><button type="button" onClick={() => load()}>Retry</button></div>

  const activities = Array.isArray(detail.activities) ? [...detail.activities] : []
  if (detail.description?.trim() && route.type !== 'Service Request') {
    activities.unshift({ id: `origin-${detail.id}`, kind: 'customer', visibility: 'customer', actor: detail.requester || 'Requester', text: detail.description, createdAt: detail.createdAt })
  }
  activities.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
  const meaningfulActivities = activities.filter((item) => !isSystemActivity(item))
  const auditActivities = activities.filter((item) => isSystemActivity(item))
  const tasks = Array.isArray(detail.requestTasks) ? detail.requestTasks : []
  const approvals = Array.isArray(detail.requestApprovals) ? detail.requestApprovals : []
  const requestInformation = Array.isArray(detail.requestInformation) ? detail.requestInformation : []
  const requestedItems = Array.isArray(detail.requestedItems) ? detail.requestedItems : []
  const relationships = Array.isArray(detail.relationships) ? detail.relationships : []
  const attachments = Array.isArray(detail.attachments) ? detail.attachments : []
  const completeTasks = tasks.filter((item) => item.status === 'Completed').length
  const pendingApprovals = approvals.filter((item) => item.status === 'Pending').length
  const responseState = detail.sla?.response?.state
  const resolutionState = detail.sla?.resolution?.state
  const primarySlaTone = resolutionState === 'breached' ? 'danger' : resolutionState === 'warning' ? 'warning' : resolutionState === 'met' ? 'good' : 'accent'
  const primarySlaLabel = detail.sla?.resolution?.dueAt
    ? (resolutionState === 'breached' ? `Breached ${relativeTime(detail.sla.resolution.dueAt)}` : `${relativeTime(detail.sla.resolution.dueAt)}`)
    : detail.slaLabel || 'No SLA target'

  const tabs = route.type === 'Service Request'
    ? [
        ['overview', 'Overview'],
        ['request', `Request${requestInformation.length ? ` ${requestInformation.length}` : ''}`],
        ['activity', `Activity${activities.length ? ` ${activities.length}` : ''}`],
        ['tasks', `Tasks${tasks.length ? ` ${tasks.length}` : ''}`],
        ...(approvals.length ? [['approvals', `Approvals ${approvals.length}`]] : []),
        ['sla', 'SLA'],
        ['related', 'Related'],
        ['audit', 'Audit Log'],
      ]
    : [
        ['overview', 'Overview'],
        ['activity', `Activity${activities.length ? ` ${activities.length}` : ''}`],
        ['tasks', 'Tasks'],
        ['sla', 'SLA'],
        ['related', 'Related'],
        ['audit', 'Audit Log'],
      ]

  const latest = meaningfulActivities.slice(0, 4)

  const renderOverview = () => <div className="record-lab-overview-grid">
    <section className="record-lab-panel record-lab-summary-panel">
      <header><span>Record information</span><h2>{route.type === 'Service Request' ? 'Request summary' : 'What is happening?'}</h2></header>
      <div className="record-lab-description">{detail.description?.trim() || 'No description has been recorded.'}</div>
      <div className="record-lab-facts-grid">
        <OverviewFact label="Requester" value={detail.requester} sub={detail.requesterEmail} />
        <OverviewFact label="Service" value={detail.service} />
        <OverviewFact label="Category" value={detail.category || detail.catalogueItemTitle} />
        <OverviewFact label="Assignment" value={detail.team || 'Unassigned'} sub={detail.assignee || 'Unassigned'} />
        <OverviewFact label="Created" value={formatDate(detail.createdAt, true)} />
        <OverviewFact label="Last updated" value={formatDate(detail.updatedAt, true)} />
      </div>
    </section>

    <aside className="record-lab-work-rail">
      <section className="record-lab-panel">
        <header><span>Work</span><h3>Next attention</h3></header>
        {route.type === 'Service Request' ? <>
          <OverviewFact label="Fulfilment" value={tasks.length ? `${completeTasks} of ${tasks.length} tasks complete` : (detail.nextStep || detail.status)} />
          <OverviewFact label="Approvals" value={approvals.length ? (pendingApprovals ? `${pendingApprovals} pending` : 'Complete') : 'Not required'} />
          <OverviewFact label="Cost" value={`${money(detail.oneOffCost, detail.currency)} one-off`} sub={`${money(detail.monthlyCost, detail.currency)}/month`} />
        </> : <>
          <OverviewFact label="Priority" value={detail.priority || 'Medium'} sub={`${detail.impact || 'Medium'} impact · ${detail.urgency || 'Medium'} urgency`} />
          <OverviewFact label="SLA" value={primarySlaLabel} />
          <OverviewFact label="Resolution" value={detail.resolutionCode || 'Not resolved'} />
        </>}
      </section>
      <section className={`record-lab-panel record-lab-mini-sla is-${primarySlaTone}`} onClick={() => setTab('sla')} role="button" tabIndex="0">
        <span>Resolution SLA</span><strong>{primarySlaLabel}</strong><small>{responseState === 'met' ? 'First response met' : 'Open SLA detail'}</small>
      </section>
    </aside>

    <section className="record-lab-panel record-lab-recent-panel">
      <header><span>Recent activity</span><h2>Latest meaningful updates</h2><button type="button" onClick={() => setTab('activity')}>View all activity</button></header>
      <div className="record-lab-recent-list">{latest.length ? latest.map((item) => <TimelineItem item={item} key={item.id} />) : <div className="record-lab-empty">No notes or customer updates yet.</div>}</div>
    </section>
  </div>

  const renderRequest = () => <div className="record-lab-stack">
    <section className="record-lab-panel">
      <header><span>Submitted information</span><h2>Request answers</h2></header>
      <div className="record-lab-answer-grid">{requestInformation.length ? requestInformation.map((item, index) => <OverviewFact key={`${item.label}-${index}`} label={item.label} value={String(item.value ?? '—')} />) : <div className="record-lab-empty">No structured request answers were submitted.</div>}</div>
    </section>
    <section className="record-lab-panel">
      <header><span>Catalogue</span><h2>Items & cost snapshot</h2></header>
      <div className="record-lab-item-list">{requestedItems.length ? requestedItems.map((item) => <div className="record-lab-item" key={item.databaseId || item.id || item.name}><div><strong>{item.name}</strong><span>{item.category || 'Catalogue item'} · Qty {item.quantity || 1}</span></div><b>{Number(item.unitMonthlyCost || 0) > 0 ? `${money(item.unitMonthlyCost, item.currency || detail.currency)}/mo` : money(item.unitOneOffCost, item.currency || detail.currency)}</b></div>) : <div className="record-lab-empty">No priced catalogue items.</div>}</div>
      <footer className="record-lab-cost-footer"><span><small>One-off</small><strong>{money(detail.oneOffCost, detail.currency)}</strong></span><span><small>Monthly</small><strong>{money(detail.monthlyCost, detail.currency)}</strong></span></footer>
    </section>
  </div>

  const renderActivity = () => <section className="record-lab-panel record-lab-tab-panel"><header><span>Timeline</span><h2>Activity</h2></header><div className="record-lab-timeline">{activities.length ? activities.map((item) => <TimelineItem item={item} key={item.id} />) : <div className="record-lab-empty">No activity has been recorded yet.</div>}</div></section>

  const renderTasks = () => <section className="record-lab-panel record-lab-tab-panel"><header><span>Work</span><h2>{route.type === 'Service Request' ? 'Fulfilment tasks' : 'Record tasks'}</h2></header>{tasks.length ? <div className="record-lab-task-list">{tasks.map((task, index) => <div className={`record-lab-task is-${slug(task.status || 'waiting')}`} key={task.id || `${task.title}-${index}`}><span className="record-lab-task-state">{task.status === 'Completed' ? <CheckCircle2 size={18} /> : <CircleDot size={18} />}</span><div><strong>{task.title}</strong><small>{task.team || 'Unassigned team'} · {task.assignee || 'Unassigned'}{task.dueAt ? ` · due ${formatDate(task.dueAt)}` : ''}</small></div><LabPill tone={task.status === 'Completed' ? 'good' : task.status === 'Blocked' ? 'danger' : 'neutral'}>{task.status || 'Waiting'}</LabPill></div>)}</div> : <div className="record-lab-empty">No tasks are currently linked to this record.</div>}</section>

  const renderApprovals = () => <section className="record-lab-panel record-lab-tab-panel"><header><span>Governance</span><h2>Approvals</h2></header>{approvals.length ? <div className="record-lab-task-list">{approvals.map((approval) => <div className="record-lab-task" key={approval.id}><span className="record-lab-task-state"><ShieldCheck size={18} /></span><div><strong>{approval.label}</strong><small>{approval.approver || 'Approver'} · {approval.status}</small></div><LabPill tone={approval.status === 'Approved' ? 'good' : approval.status === 'Rejected' ? 'danger' : 'warning'}>{approval.status}</LabPill></div>)}</div> : <div className="record-lab-empty">No approval is required.</div>}</section>

  const renderRelated = () => <div className="record-lab-related-grid"><section className="record-lab-panel record-lab-tab-panel"><header><span>Relationships</span><h2>Related records</h2></header>{relationships.length ? <div className="record-lab-link-list">{relationships.map((item) => <div key={item.id}><Link2 size={18} /><span><strong>{item.targetReference || item.reference}</strong><small>{item.targetType || item.type} · {item.relationshipType || 'Related'}</small></span></div>)}</div> : <div className="record-lab-empty">No related records.</div>}</section><section className="record-lab-panel record-lab-tab-panel"><header><span>Evidence</span><h2>Attachments</h2></header>{attachments.length ? <div className="record-lab-link-list">{attachments.map((item) => <div key={item.id}><Paperclip size={18} /><span><strong>{item.fileName || item.name}</strong><small>{item.uploadedBy || 'Attached to record'}</small></span></div>)}</div> : <div className="record-lab-empty">No attachments.</div>}</section></div>

  const renderAudit = () => <section className="record-lab-panel record-lab-tab-panel"><header><span>Forensic history</span><h2>Audit Log</h2></header>{auditActivities.length ? <div className="record-lab-audit-list">{auditActivities.map((item) => { const changes = Array.isArray(item.metadata?.changes) ? item.metadata.changes : []; return <div className="record-lab-audit-row" key={item.id}><time>{formatDate(item.createdAt, true)}</time><div><strong>{activityText(item)}</strong>{changes.length ? changes.map((change, index) => <small key={`${change.field}-${index}`}><b>{change.field}</b><span>{String(change.from || '—')}</span><i>→</i><span>{String(change.to || '—')}</span></small>) : <small>{item.actor ? `By ${item.actor}` : 'System event'}</small>}</div></div> })}</div> : <div className="record-lab-empty">No system audit events are available for this record yet.</div>}</section>

  const backPath = `/${route.section}/${encodeURIComponent(route.reference)}`
  const tabContent = tab === 'overview' ? renderOverview()
    : tab === 'request' ? renderRequest()
      : tab === 'activity' ? renderActivity()
        : tab === 'tasks' ? renderTasks()
          : tab === 'approvals' ? renderApprovals()
            : tab === 'sla' ? <div className="record-lab-stack"><SlaPanel detail={detail} /><section className="record-lab-panel record-lab-tab-panel"><header><span>SLA history</span><h2>Timer context</h2></header><div className="record-lab-facts-grid"><OverviewFact label="Created" value={formatDate(detail.createdAt, true)} /><OverviewFact label="Last updated" value={formatDate(detail.updatedAt, true)} /><OverviewFact label="SLA clock" value={detail.sla?.paused ? 'Paused' : 'Active'} sub={detail.sla?.pausedAt ? `Paused ${formatDate(detail.sla.pausedAt)}` : ''} /><OverviewFact label="Current priority" value={detail.priority} /></div></section></div>
              : tab === 'related' ? renderRelated()
                : renderAudit()

  return <div className="record-lab-shell" ref={scrollRef}>
    <div className="record-lab-test-banner"><span>Record Workspace Lab</span><strong>Prototype only — current record pages are unchanged</strong><button type="button" onClick={() => { window.history.pushState({}, '', backPath); window.dispatchEvent(new PopStateEvent('popstate')); window.dispatchEvent(new CustomEvent('hi5-routechange', { detail: { path: backPath } })) }}><ArrowLeft size={15} />Open current page</button></div>

    <section className="record-lab-masthead">
      <div className="record-lab-heading"><div><strong>{detail.id || detail.reference}</strong><LabPill tone="accent">{detail.type || route.type}</LabPill><LabPill tone={['Resolved','Closed','Completed'].includes(detail.status) ? 'good' : 'neutral'}>{detail.status}</LabPill><LabPill tone={detail.priority === 'Critical' || detail.priority === 'High' ? 'danger' : detail.priority === 'Medium' ? 'warning' : 'good'}>{detail.priority}</LabPill></div><h1>{detail.title}</h1><p>{detail.requester || 'Requester not recorded'} · {detail.team || 'Unassigned'} / {detail.assignee || 'Unassigned'} · Updated {relativeTime(detail.updatedAt)}</p></div>
      <button type="button" className={`record-lab-sla-badge is-${primarySlaTone}`} onClick={() => setTab('sla')}><Clock3 size={18} /><span><small>Resolution SLA</small><strong>{primarySlaLabel}</strong></span></button>
    </section>

    <section className="record-lab-action-zone">
      <div className="record-lab-action-strip">
        <button type="button" className={composerMode === 'internal' ? 'is-active' : ''} onClick={() => setComposerMode('internal')}><MessageSquareText size={16} />Internal note</button>
        <button type="button" className={composerMode === 'customer' ? 'is-active' : ''} onClick={() => setComposerMode('customer')}><Send size={16} />Customer update</button>
        <i />
        <button type="button" className={composerMode === 'reassign' ? 'is-active' : ''} onClick={() => setComposerMode('reassign')}><UserRoundCog size={16} />Reassign</button>
        <button type="button" className={composerMode === 'resolve' ? 'is-active' : ''} onClick={() => setComposerMode('resolve')}><CheckCircle2 size={16} />{route.type === 'Service Request' ? 'Complete' : 'Resolve'}</button>
        {route.type === 'Incident' ? <button type="button" className={composerMode === 'pending' ? 'is-active' : ''} onClick={() => setComposerMode('pending')}><Clock3 size={16} />Pending</button> : null}
        <button type="button" onClick={() => setTab('related')}><Paperclip size={16} />Attach / link</button>
        <button type="button" className="record-lab-more"><MoreHorizontal size={18} /><span>More</span><ChevronDown size={14} /></button>
      </div>
      {composerMode ? <ActionComposer key={composerMode} mode={composerMode} detail={detail} saving={saving} onClose={() => setComposerMode('')} onPost={postNote} onReassign={reassign} onResolve={resolve} onPending={pending} /> : <button type="button" className="record-lab-quick-note" onClick={() => setComposerMode('internal')}><MessageSquareText size={18} /><span><strong>Add a work note…</strong><small>Internal note is always one click away</small></span></button>}
    </section>

    <div className="record-lab-sla-strip"><SlaPanel detail={detail} /></div>

    {error ? <div className="record-lab-notice is-error"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={() => setError('')}><X size={15} /></button></div> : null}
    {notice ? <div className="record-lab-notice is-success"><CheckCircle2 size={17} /><span>{notice}</span><button type="button" onClick={() => setNotice('')}><X size={15} /></button></div> : null}

    <nav className="record-lab-tabs" aria-label="Record workspace sections">{tabs.map(([value, label]) => <button type="button" key={value} className={tab === value ? 'is-active' : ''} onClick={() => setTab(value)}>{label}</button>)}<button type="button" className="record-lab-refresh" onClick={() => load({ quiet: true })}><RefreshCw size={15} />Refresh</button></nav>

    <main className="record-lab-content">{tabContent}</main>
  </div>
}

export function ProductionRecordWorkspaceLab() {
  const [route, setRoute] = useState(labRoute)
  const [target, setTarget] = useState(null)

  useEffect(() => {
    const update = () => setRoute(labRoute())
    window.addEventListener('popstate', update)
    window.addEventListener('hi5-routechange', update)
    const timer = window.setInterval(update, 250)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener('hi5-routechange', update)
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!route) {
      setTarget(null)
      document.querySelector('.content-frame')?.classList.remove('production-record-lab-mounted')
      return undefined
    }
    let mounted = null
    const attach = () => {
      const node = document.querySelector('.content-frame')
      if (!(node instanceof HTMLElement)) return false
      mounted = node
      node.classList.add('production-record-lab-mounted')
      setTarget(node)
      return true
    }
    if (attach()) return () => mounted?.classList.remove('production-record-lab-mounted')
    const observer = new MutationObserver(() => { if (attach()) observer.disconnect() })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      mounted?.classList.remove('production-record-lab-mounted')
    }
  }, [route])

  const key = useMemo(() => route ? `${route.type}:${route.reference}` : 'none', [route])
  if (!route || !target) return null
  return createPortal(<RecordWorkspace key={key} route={route} />, target)
}
