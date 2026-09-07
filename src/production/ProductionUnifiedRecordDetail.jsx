import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Link2,
  MessageSquareText,
  Paperclip,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import {
  addProductionServiceRequestActivity,
  decideProductionServiceRequestApproval,
  fetchProductionServiceRequest,
  patchProductionServiceRequest,
  patchProductionServiceRequestTask,
  transitionProductionServiceRequest,
} from '../services/productionServiceRequests.js'
import './ProductionUnifiedRecordDetail.css'

const API_BASE = 'https://api.hi5central.com'
const SECTION_TYPES = {
  incidents: 'Incident',
  requests: 'Service Request',
  problems: 'Problem',
  changes: 'Change',
}
const SERVICE_REQUEST_STATUSES = ['New', 'Pending Approval', 'Approved', 'In Progress', 'Completed', 'Closed', 'Rejected']

function routeState() {
  const match = window.location.pathname.match(/^\/(incidents|requests|problems|changes)\/([^/]+)\/?$/i)
  if (!match || match[2].toLowerCase() === 'new') return null
  const section = match[1].toLowerCase()
  return { section, type: SECTION_TYPES[section], reference: decodeURIComponent(match[2]) }
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function relativeTime(value) {
  if (!value) return '—'
  const delta = new Date(value).getTime() - Date.now()
  const absolute = Math.abs(delta)
  const units = absolute >= 86400000 ? ['day', 86400000] : absolute >= 3600000 ? ['hour', 3600000] : ['minute', 60000]
  return new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' }).format(Math.round(delta / units[1]), units[0])
}

function formatBytes(value) {
  const bytes = Number(value || 0)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function money(value, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0))
}

function statusClass(value = '') {
  return `is-${String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function priorityClass(value = '') {
  return `is-${String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
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
    error.payload = payload
    throw error
  }
  return payload
}

function fileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || '').split(',').pop() || '')
    reader.onerror = () => reject(reader.error || new Error('Could not read the attachment.'))
    reader.readAsDataURL(file)
  })
}

function Field({ label, children, hint, wide = false }) {
  return <label className={`production-unified-field ${wide ? 'is-wide' : ''}`}><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>
}

function Panel({ id, title, description, children, className = '' }) {
  return (
    <section className={`production-unified-panel ${className}`.trim()} id={id} data-record-section={id}>
      <header><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div></header>
      <div className="production-unified-panel-body">{children}</div>
    </section>
  )
}

function ActivityEntry({ item }) {
  const changes = Array.isArray(item.metadata?.changes) ? item.metadata.changes : []
  return (
    <article className={`production-unified-activity is-${item.visibility || 'internal'}`}>
      <span className="production-unified-activity-icon">{item.visibility === 'customer' ? <MessageSquareText size={14} /> : item.kind === 'field_change' ? <RefreshCw size={14} /> : <ShieldCheck size={14} />}</span>
      <div>
        <div className="production-unified-activity-meta"><strong>{item.actor || 'Hi5Central'}</strong><span>{formatDate(item.createdAt)}</span><em>{item.visibility === 'customer' ? 'Customer visible' : 'Internal'}</em></div>
        <p>{item.text}</p>
        {changes.length ? <div className="production-unified-change-list">{changes.map((change, index) => <div key={`${change.field}-${index}`}><strong>{change.field}</strong><span>{String(change.from || '—')} → {String(change.to || '—')}</span></div>)}</div> : null}
      </div>
    </article>
  )
}

function SlaMetric({ label, metric }) {
  if (!metric) return null
  const percent = Math.min(100, Number(metric.percent || 0))
  return (
    <div className={`production-unified-sla is-${metric.state}`}>
      <div><span>{label}</span><strong>{metric.state === 'met' ? 'Met' : metric.state === 'breached' ? 'Breached' : metric.state === 'warning' ? 'At risk' : 'On track'}</strong></div>
      <div className="production-unified-sla-track"><span style={{ width: `${percent}%` }} /></div>
      <small><span>{metric.completedAt ? `Completed ${formatDate(metric.completedAt)}` : `Due ${relativeTime(metric.dueAt)}`}</span><span>{metric.percent}%</span></small>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <section className="production-unified-detail-shell production-unified-skeleton-shell" aria-label="Loading record">
      <aside className="production-unified-rail">
        <div className="production-skeleton production-unified-skeleton-reference"><i /><i /><i /></div>
        <div className="production-skeleton production-unified-skeleton-nav">{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</div>
      </aside>
      <main className="production-unified-main">
        <div className="production-unified-actionbar production-skeleton"><i /><i /></div>
        <div className="production-unified-scroll"><div className="production-unified-content">{Array.from({ length: 5 }, (_, index) => <div className="production-skeleton production-unified-skeleton-panel" key={index}><i /><i /><i /><i /></div>)}</div></div>
      </main>
    </section>
  )
}

function genericForm(detail) {
  const data = detail?.recordData || {}
  return {
    title: detail?.title || '', description: detail?.description || '', requesterId: detail?.requesterId || '',
    service: detail?.service || '', category: detail?.category || '', status: detail?.status || '', team: detail?.team || '',
    assignee: detail?.assignee || 'Unassigned', priority: detail?.priority || 'Medium', impact: detail?.impact || 'Medium', urgency: detail?.urgency || 'Medium',
    resolutionCode: detail?.resolutionCode || '', resolutionSummary: detail?.resolutionSummary || '', rootCause: data.rootCause || '', workaround: data.workaround || '', knownError: Boolean(data.knownError),
    changeType: data.changeType || 'Normal', risk: data.risk || detail?.priority || 'Medium', implementationPlan: data.implementationPlan || '', testPlan: data.testPlan || '', backoutPlan: data.backoutPlan || '', plannedStart: data.plannedStart || '', plannedEnd: data.plannedEnd || '',
  }
}

function serviceRequestForm(detail) {
  return {
    priority: detail?.priority || 'Medium', status: detail?.status || 'New', team: detail?.team || '', assignee: detail?.assignee || 'Unassigned',
    completionNotes: detail?.operationalData?.completionNotes || '', reopenReason: detail?.operationalData?.reopenReason || '', approvalNote: detail?.operationalData?.approvalNote || '',
  }
}

async function loadServiceRequest(reference) {
  const [request, organisation] = await Promise.all([
    fetchProductionServiceRequest(reference),
    apiJson('/api/v1/organisation').catch(() => ({ people: [], teams: [] })),
  ])
  return {
    ...request,
    id: request.id || reference,
    reference: request.id || reference,
    type: 'Service Request',
    options: { people: organisation.people || [], teams: organisation.teams || [] },
  }
}

function sectionsFor(route) {
  if (route.type === 'Incident') return [['overview', 'Overview'], ['activity', 'Activity'], ['classification', 'Classification & SLA'], ['resolution', 'Resolution'], ['relationships', 'Relationships'], ['attachments', 'Attachments']]
  if (route.type === 'Problem') return [['overview', 'Overview'], ['activity', 'Activity'], ['investigation', 'Investigation'], ['relationships', 'Relationships'], ['attachments', 'Attachments']]
  if (route.type === 'Change') return [['overview', 'Overview'], ['activity', 'Activity'], ['assessment', 'Assessment'], ['plans', 'Plans'], ['relationships', 'Relationships'], ['attachments', 'Attachments']]
  return [['overview', 'Overview'], ['activity', 'Activity'], ['request-details', 'Request details'], ['items', 'Items & cost'], ['fulfilment', 'Approvals & tasks']]
}

function RecordRail({ detail, route, sections, activeSection, onSection }) {
  return (
    <aside className="production-unified-rail">
      <div className="production-unified-identity">
        <button className="production-unified-back" onClick={() => window.location.assign(`/${route.section}`)} type="button"><ArrowLeft size={16} />Back</button>
        <strong>{detail.id || detail.reference}</strong>
        <span>{detail.title}</span>
        <div><em className={`production-unified-pill ${statusClass(detail.status)}`}>{detail.status}</em><em className={`production-unified-pill ${priorityClass(detail.priority)}`}>{detail.priority}</em></div>
      </div>
      <div className="production-unified-rail-context">
        <dl>
          <div><dt>Requester</dt><dd>{detail.requester || 'Not recorded'}</dd></div>
          <div><dt>Assignment</dt><dd>{detail.team || 'Unassigned'} · {detail.assignee || 'Unassigned'}</dd></div>
          <div><dt>Updated</dt><dd>{formatDate(detail.updatedAt)}</dd></div>
          {route.type === 'Incident' && detail.sla?.resolution ? <div><dt>Resolution SLA</dt><dd>{detail.sla.resolution.state === 'breached' ? 'Breached' : relativeTime(detail.sla.resolution.dueAt)}</dd></div> : null}
        </dl>
      </div>
      <nav className="production-unified-detail-nav-scroll" aria-label={`${route.type} record sections`}>
        {sections.map(([id, label]) => <button className={activeSection === id ? 'is-active' : ''} key={id} onClick={() => onSection(id)} type="button">{label}</button>)}
      </nav>
    </aside>
  )
}

function ProductionDetail({ route }) {
  const [detail, setDetail] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activeSection, setActiveSection] = useState('overview')
  const [activityText, setActivityText] = useState('')
  const [activityVisibility, setActivityVisibility] = useState('internal')
  const [relationshipReference, setRelationshipReference] = useState('')
  const [relationshipType, setRelationshipType] = useState('related')
  const [attachment, setAttachment] = useState(null)
  const scrollRef = useRef(null)
  const sections = useMemo(() => sectionsFor(route), [route])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const payload = route.type === 'Service Request'
        ? await loadServiceRequest(route.reference)
        : await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}`)
      setDetail(payload)
      setForm(route.type === 'Service Request' ? serviceRequestForm(payload) : genericForm(payload))
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [route.reference, route.type])

  useEffect(() => {
    const root = scrollRef.current
    if (!(root instanceof HTMLElement) || !detail) return undefined
    const targets = sections.map(([id]) => root.querySelector(`[data-record-section="${id}"]`)).filter(Boolean)
    if (!targets.length) return undefined
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (visible?.target?.dataset?.recordSection) setActiveSection(visible.target.dataset.recordSection)
    }, { root, rootMargin: '-12% 0px -68% 0px', threshold: [0, .1, .25, .5] })
    targets.forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [detail, sections])

  function jump(id) {
    const root = scrollRef.current
    const target = root?.querySelector(`[data-record-section="${id}"]`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveSection(id)
  }

  function genericRecordData() {
    if (route.type === 'Problem') return { rootCause: form.rootCause, workaround: form.workaround, knownError: form.knownError }
    if (route.type === 'Change') return { changeType: form.changeType, risk: form.risk, implementationPlan: form.implementationPlan, testPlan: form.testPlan, backoutPlan: form.backoutPlan, plannedStart: form.plannedStart, plannedEnd: form.plannedEnd }
    return detail?.recordData || {}
  }

  async function saveGeneric() {
    const payload = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        version: detail.version, title: form.title, description: form.description, requesterId: form.requesterId,
        service: form.service, category: form.category, status: form.status, team: form.team, assignee: form.assignee,
        priority: form.priority, impact: form.impact, urgency: form.urgency, resolutionCode: form.resolutionCode,
        resolutionSummary: form.resolutionSummary, recordData: genericRecordData(),
      }),
    })
    setDetail(payload)
    setForm(genericForm(payload))
  }

  async function saveServiceRequest() {
    if (form.priority !== detail.priority || form.team !== detail.team || form.assignee !== detail.assignee) {
      await patchProductionServiceRequest(route.reference, { priority: form.priority, team: form.team, assignee: form.assignee })
    }
    if (form.status !== detail.status) {
      await transitionProductionServiceRequest(route.reference, form.status, {
        completionNotes: form.completionNotes,
        reopenReason: form.reopenReason,
        approvalNote: form.approvalNote,
      })
    }
    const payload = await loadServiceRequest(route.reference)
    setDetail(payload)
    setForm(serviceRequestForm(payload))
  }

  async function save() {
    if (!detail) return
    setSaving(true); setError(''); setNotice('')
    try {
      if (route.type === 'Service Request') await saveServiceRequest()
      else await saveGeneric()
      setNotice('Saved')
    } catch (saveError) {
      setError(saveError.status === 409 ? 'Another technician changed this record before you saved. Reload the latest version and reapply your change.' : saveError.message)
    } finally { setSaving(false) }
  }

  async function postActivity() {
    if (!activityText.trim()) return
    setSaving(true); setError('')
    try {
      if (route.type === 'Service Request') {
        await addProductionServiceRequestActivity(route.reference, { kind: activityVisibility === 'internal' ? 'work' : 'customer', text: activityText, html: '', attachments: [] })
        const payload = await loadServiceRequest(route.reference)
        setDetail(payload); setForm(serviceRequestForm(payload))
      } else {
        const payload = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/activity`, { method: 'POST', body: JSON.stringify({ text: activityText, visibility: activityVisibility }) })
        setDetail(payload); setForm(genericForm(payload))
      }
      setActivityText('')
    } catch (activityError) { setError(activityError.message) } finally { setSaving(false) }
  }

  async function addRelationship() {
    if (!relationshipReference || route.type === 'Service Request') return
    setSaving(true); setError('')
    try {
      const payload = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/relationships`, { method: 'POST', body: JSON.stringify({ targetReference: relationshipReference, relationshipType }) })
      setDetail(payload); setForm(genericForm(payload)); setRelationshipReference('')
    } catch (relationshipError) { setError(relationshipError.message) } finally { setSaving(false) }
  }

  async function removeRelationship(id) {
    setSaving(true); setError('')
    try {
      const payload = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/relationships/remove`, { method: 'POST', body: JSON.stringify({ relationshipId: id }) })
      setDetail(payload); setForm(genericForm(payload))
    } catch (relationshipError) { setError(relationshipError.message) } finally { setSaving(false) }
  }

  async function uploadAttachment() {
    if (!attachment || route.type === 'Service Request') return
    if (attachment.size > 5 * 1024 * 1024) return setError('Attachments are limited to 5 MB each.')
    setSaving(true); setError('')
    try {
      const contentBase64 = await fileBase64(attachment)
      const payload = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/attachments`, { method: 'POST', body: JSON.stringify({ fileName: attachment.name, mimeType: attachment.type || 'application/octet-stream', contentBase64 }) })
      setDetail(payload); setForm(genericForm(payload)); setAttachment(null)
      const input = document.querySelector('#production-unified-attachment-input'); if (input) input.value = ''
    } catch (attachmentError) { setError(attachmentError.message) } finally { setSaving(false) }
  }

  async function removeAttachment(id) {
    setSaving(true); setError('')
    try {
      const payload = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/attachments/remove`, { method: 'POST', body: JSON.stringify({ attachmentId: id }) })
      setDetail(payload); setForm(genericForm(payload))
    } catch (attachmentError) { setError(attachmentError.message) } finally { setSaving(false) }
  }

  async function decideApproval(approval, decision) {
    setSaving(true); setError('')
    try {
      await decideProductionServiceRequestApproval(route.reference, approval.id, decision, form.approvalNote || '')
      const payload = await loadServiceRequest(route.reference); setDetail(payload); setForm(serviceRequestForm(payload))
    } catch (approvalError) { setError(approvalError.message) } finally { setSaving(false) }
  }

  async function updateTask(task, status) {
    setSaving(true); setError('')
    try {
      await patchProductionServiceRequestTask(route.reference, task.id, { status })
      const payload = await loadServiceRequest(route.reference); setDetail(payload); setForm(serviceRequestForm(payload))
    } catch (taskError) { setError(taskError.message) } finally { setSaving(false) }
  }

  if (loading) return <DetailSkeleton />
  if (!detail) return <section className="production-unified-detail-shell"><div className="production-unified-load-error"><strong>Could not open this record</strong><span>{error}</span><button onClick={load} type="button">Retry</button></div></section>

  const people = detail.options?.people || []
  const teams = detail.options?.teams || []
  const activities = detail.activities || []

  return (
    <section className="production-unified-detail-shell production-motion-enter">
      <RecordRail detail={detail} route={route} sections={sections} activeSection={activeSection} onSection={jump} />
      <main className="production-unified-main">
        <div className="production-unified-actionbar">
          <div className="production-unified-action-context"><strong>{detail.id || detail.reference}</strong><span>{detail.title}</span></div>
          <div><button className="production-unified-icon-button" onClick={load} title="Reload latest" type="button"><RefreshCw size={16} /></button><button className="production-unified-save" disabled={saving} onClick={save} type="button"><Save size={16} />{saving ? 'Saving…' : 'Save'}</button></div>
        </div>
        {error ? <div className="production-unified-banner is-error"><AlertTriangle size={16} /><span>{error}</span><button onClick={() => setError('')} type="button"><X size={14} /></button></div> : null}
        {notice ? <div className="production-unified-banner is-success"><CheckCircle2 size={16} /><span>{notice}</span><button onClick={() => setNotice('')} type="button"><X size={14} /></button></div> : null}
        <div className="production-unified-scroll" ref={scrollRef}>
          <div className="production-unified-content">
            <Panel id="overview" title="Overview" description="Core record information and assignment.">
              {route.type === 'Service Request' ? (
                <div className="production-unified-field-grid">
                  <Field label="Summary" wide><div className="production-unified-readonly">{detail.title}</div></Field>
                  <Field label="Requester"><div className="production-unified-readonly">{detail.requester || 'Not recorded'}</div></Field>
                  <Field label="Service"><div className="production-unified-readonly">{detail.service || 'Service Catalogue'}</div></Field>
                  <Field label="Status"><select value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value }))}>{[...new Set([detail.status, ...SERVICE_REQUEST_STATUSES])].map((value) => <option key={value}>{value}</option>)}</select></Field>
                  <Field label="Priority"><select value={form.priority} onChange={(e) => setForm((v) => ({ ...v, priority: e.target.value }))}>{['Low','Medium','High','Critical'].map((value) => <option key={value}>{value}</option>)}</select></Field>
                  <Field label="Assignment group"><select value={form.team} onChange={(e) => setForm((v) => ({ ...v, team: e.target.value }))}><option value="">Unassigned team</option>{teams.map((team) => <option key={team.id} value={team.name}>{team.name}</option>)}</select></Field>
                  <Field label="Assignee"><select value={form.assignee} onChange={(e) => setForm((v) => ({ ...v, assignee: e.target.value }))}><option>Unassigned</option>{people.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}</select></Field>
                  <Field label="Description" wide><div className="production-unified-readonly is-multiline">{detail.description || 'No description supplied.'}</div></Field>
                </div>
              ) : (
                <div className="production-unified-field-grid">
                  <Field label="Summary" wide><input value={form.title} onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))} /></Field>
                  <Field label="Description" wide><textarea rows="5" value={form.description} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} /></Field>
                  <Field label="Requester"><select value={form.requesterId} onChange={(e) => setForm((v) => ({ ...v, requesterId: e.target.value }))}><option value="">Not recorded</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.email}</option>)}</select></Field>
                  <Field label="Status"><select value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value }))}>{(detail.allowedStatuses || []).map((status) => <option key={status}>{status}</option>)}</select></Field>
                  <Field label="Service"><input value={form.service} onChange={(e) => setForm((v) => ({ ...v, service: e.target.value }))} /></Field>
                  <Field label="Category"><input value={form.category} onChange={(e) => setForm((v) => ({ ...v, category: e.target.value }))} /></Field>
                  <Field label="Assignment group"><select value={form.team} onChange={(e) => setForm((v) => ({ ...v, team: e.target.value }))}><option value="">Unassigned team</option>{teams.map((team) => <option key={team.id} value={team.name}>{team.name}</option>)}</select></Field>
                  <Field label="Assignee"><select value={form.assignee} onChange={(e) => setForm((v) => ({ ...v, assignee: e.target.value }))}><option>Unassigned</option>{people.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}</select></Field>
                </div>
              )}
            </Panel>

            <Panel id="activity" title={`Activity (${activities.length})`} description="Messages and work notes are visible immediately when the record opens.">
              <div className="production-unified-activity-composer">
                <select value={activityVisibility} onChange={(e) => setActivityVisibility(e.target.value)}><option value="internal">Internal work note</option><option value="customer">Customer-visible update</option></select>
                <textarea rows="3" placeholder="Add an update…" value={activityText} onChange={(e) => setActivityText(e.target.value)} />
                <button disabled={saving || !activityText.trim()} onClick={postActivity} type="button"><MessageSquareText size={16} />Add update</button>
              </div>
              <div className="production-unified-activity-list">{activities.length ? activities.slice().reverse().map((item) => <ActivityEntry item={item} key={item.id} />) : <div className="production-unified-empty">No activity yet.</div>}</div>
            </Panel>

            {route.type === 'Incident' ? <>
              <Panel id="classification" title="Classification & SLA" description="Impact and urgency calculate priority on the server using the tenant matrix.">
                <div className="production-unified-field-grid"><Field label="Impact"><select value={form.impact} onChange={(e) => setForm((v) => ({ ...v, impact: e.target.value }))}>{['Low','Medium','High'].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Urgency"><select value={form.urgency} onChange={(e) => setForm((v) => ({ ...v, urgency: e.target.value }))}>{['Low','Medium','High'].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Calculated priority"><div className={`production-unified-readonly production-unified-priority ${priorityClass(detail.priority)}`}>{detail.priority}</div></Field></div>
                <div className="production-unified-sla-list"><SlaMetric label="First response" metric={detail.sla?.response} /><SlaMetric label="Resolution" metric={detail.sla?.resolution} />{detail.sla?.paused ? <div className="production-unified-sla-paused"><Clock3 size={16} />SLA paused since {formatDate(detail.sla.pausedAt)}</div> : null}</div>
              </Panel>
              <Panel id="resolution" title="Resolution" description="Resolution code and summary are required before moving the Incident to Resolved or Closed."><div className="production-unified-field-grid"><Field label="Resolution code"><select value={form.resolutionCode} onChange={(e) => setForm((v) => ({ ...v, resolutionCode: e.target.value }))}><option value="">Select resolution</option>{['Fixed','Workaround','User education','Configuration change','Known error','Duplicate','No fault found','Other'].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Resolution summary" wide><textarea rows="4" value={form.resolutionSummary} onChange={(e) => setForm((v) => ({ ...v, resolutionSummary: e.target.value }))} /></Field></div></Panel>
            </> : null}

            {route.type === 'Problem' ? <Panel id="investigation" title="Investigation" description="Capture root cause and reusable workaround, then promote to Known Error when appropriate."><div className="production-unified-field-grid"><Field label="Known error"><select value={form.knownError ? 'Yes' : 'No'} onChange={(e) => setForm((v) => ({ ...v, knownError: e.target.value === 'Yes' }))}><option>No</option><option>Yes</option></select></Field><Field label="Root cause" wide><textarea rows="5" value={form.rootCause} onChange={(e) => setForm((v) => ({ ...v, rootCause: e.target.value }))} /></Field><Field label="Workaround" wide><textarea rows="5" value={form.workaround} onChange={(e) => setForm((v) => ({ ...v, workaround: e.target.value }))} /></Field></div></Panel> : null}

            {route.type === 'Change' ? <>
              <Panel id="assessment" title="Assessment"><div className="production-unified-field-grid"><Field label="Change type"><select value={form.changeType} onChange={(e) => setForm((v) => ({ ...v, changeType: e.target.value }))}>{['Standard','Normal','Emergency'].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Risk"><select value={form.risk} onChange={(e) => setForm((v) => ({ ...v, risk: e.target.value }))}>{['Low','Medium','High','Critical'].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Planned start"><input type="datetime-local" value={form.plannedStart} onChange={(e) => setForm((v) => ({ ...v, plannedStart: e.target.value }))} /></Field><Field label="Planned end"><input type="datetime-local" value={form.plannedEnd} onChange={(e) => setForm((v) => ({ ...v, plannedEnd: e.target.value }))} /></Field></div></Panel>
              <Panel id="plans" title="Plans"><div className="production-unified-field-grid"><Field label="Implementation plan" wide><textarea rows="5" value={form.implementationPlan} onChange={(e) => setForm((v) => ({ ...v, implementationPlan: e.target.value }))} /></Field><Field label="Test plan" wide><textarea rows="4" value={form.testPlan} onChange={(e) => setForm((v) => ({ ...v, testPlan: e.target.value }))} /></Field><Field label="Backout plan" wide><textarea rows="4" value={form.backoutPlan} onChange={(e) => setForm((v) => ({ ...v, backoutPlan: e.target.value }))} /></Field></div></Panel>
            </> : null}

            {route.type !== 'Service Request' ? <>
              <Panel id="relationships" title={`Relationships (${detail.relationships?.length || 0})`} description="Link related Incidents, Problems, Changes and Service Requests."><div className="production-unified-relationship-add"><select value={relationshipType} onChange={(e) => setRelationshipType(e.target.value)}>{['related','caused-by','resolved-by','duplicates','blocks','blocked-by'].map((value) => <option key={value} value={value}>{value.replaceAll('-', ' ')}</option>)}</select><select value={relationshipReference} onChange={(e) => setRelationshipReference(e.target.value)}><option value="">Choose record</option>{(detail.options?.relatedRecords || []).map((record) => <option key={`${record.type}-${record.reference}`} value={record.reference}>{record.reference} · {record.title}</option>)}</select><button disabled={!relationshipReference || saving} onClick={addRelationship} type="button"><Link2 size={16} />Link</button></div><div className="production-unified-relationship-list">{(detail.relationships || []).length ? detail.relationships.map((item) => <div key={item.id}><span><strong>{item.targetReference}</strong><small>{item.targetType} · {item.relationshipType}</small></span><button onClick={() => removeRelationship(item.id)} title="Remove relationship" type="button"><Trash2 size={15} /></button></div>) : <div className="production-unified-empty">No related records yet.</div>}</div></Panel>
              <Panel id="attachments" title={`Attachments (${detail.attachments?.length || 0})`} description="Attachments are stored with SHA-256 evidence."><div className="production-unified-attachment-add"><input id="production-unified-attachment-input" type="file" onChange={(e) => setAttachment(e.target.files?.[0] || null)} /><button disabled={!attachment || saving} onClick={uploadAttachment} type="button"><Upload size={16} />Upload</button></div>{attachment ? <small className="production-unified-selected-file">{attachment.name} · {formatBytes(attachment.size)}</small> : null}<div className="production-unified-attachment-list">{(detail.attachments || []).length ? detail.attachments.map((item) => <div key={item.id}><FileText size={18} /><span><strong>{item.fileName}</strong><small>{formatBytes(item.byteSize)} · {item.uploadedBy} · {formatDate(item.createdAt)}</small></span><a href={`${API_BASE}/api/v1/itsm-lifecycle/${encodeURIComponent(detail.id)}/attachments/${encodeURIComponent(item.id)}`} target="_blank" rel="noreferrer" title="Download"><Download size={16} /></a><button onClick={() => removeAttachment(item.id)} title="Remove attachment" type="button"><Trash2 size={15} /></button></div>) : <div className="production-unified-empty">No attachments yet.</div>}</div></Panel>
            </> : null}

            {route.type === 'Service Request' ? <>
              <Panel id="request-details" title="Request details" description="Submitted catalogue answers are immutable request evidence."><div className="production-unified-info-list">{(detail.requestInformation || []).length ? detail.requestInformation.map((item, index) => <div key={`${item.label}-${index}`}><span>{item.label}</span><strong>{item.value}</strong></div>) : <div className="production-unified-empty">No structured answers were submitted.</div>}</div></Panel>
              <Panel id="items" title="Items & cost"><div className="production-unified-items">{(detail.requestedItems || []).length ? detail.requestedItems.map((item) => <div key={item.databaseId || item.id}><span><strong>{item.name}</strong><small>{item.category || 'Catalogue item'} · Qty {item.quantity || 1}</small></span><strong>{Number(item.unitMonthlyCost || 0) > 0 ? `${money(item.unitMonthlyCost, item.currency)}/mo` : money(item.unitOneOffCost, item.currency)}</strong></div>) : <div className="production-unified-empty">No priced items on this request.</div>}</div><div className="production-unified-cost-summary"><span>One-off <strong>{money(detail.oneOffCost, detail.currency)}</strong></span><span>Monthly <strong>{money(detail.monthlyCost, detail.currency)}</strong></span></div></Panel>
              <Panel id="fulfilment" title="Approvals & tasks"><div className="production-unified-fulfilment-grid"><div><h3>Approvals</h3>{(detail.requestApprovals || []).length ? detail.requestApprovals.map((approval) => <div className="production-unified-approval" key={approval.id}><span><strong>{approval.label}</strong><small>{approval.approver} · {approval.status}</small></span>{approval.status === 'Pending' ? <div><button disabled={saving} onClick={() => decideApproval(approval, 'Approved')} type="button">Approve</button><button disabled={saving} onClick={() => decideApproval(approval, 'Rejected')} type="button">Reject</button></div> : null}</div>) : <div className="production-unified-empty">No approval required.</div>}</div><div><h3>Fulfilment tasks</h3>{(detail.requestTasks || []).length ? detail.requestTasks.map((task) => <div className="production-unified-task" key={task.id}><span><strong>{task.title}</strong><small>{task.team || 'Unassigned team'} · {task.assignee || 'Unassigned'} · {task.status}</small></span><select disabled={saving} value={task.status} onChange={(e) => updateTask(task, e.target.value)}>{[...new Set([task.status, 'Waiting','Ready','In Progress','Completed','Blocked'])].map((value) => <option key={value}>{value}</option>)}</select></div>) : <div className="production-unified-empty">No fulfilment tasks.</div>}</div></div>{['Completed','Closed'].includes(form.status) ? <Field label="Completion notes" wide><textarea rows="3" value={form.completionNotes} onChange={(e) => setForm((v) => ({ ...v, completionNotes: e.target.value }))} /></Field> : null}</Panel>
            </> : null}
          </div>
        </div>
      </main>
    </section>
  )
}

export function ProductionUnifiedRecordDetail() {
  const [route, setRoute] = useState(routeState)
  const [target, setTarget] = useState(null)

  useEffect(() => {
    const update = () => setRoute(routeState())
    window.addEventListener('popstate', update)
    window.addEventListener('hi5-routechange', update)
    const timer = window.setInterval(update, 250)
    return () => { window.removeEventListener('popstate', update); window.removeEventListener('hi5-routechange', update); window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    if (!route) {
      setTarget(null)
      document.querySelector('.content-frame')?.classList.remove('production-unified-detail-mounted')
      return undefined
    }
    let mounted = null
    const attach = () => {
      const node = document.querySelector('.content-frame')
      if (!(node instanceof HTMLElement)) return false
      mounted = node
      node.classList.add('production-unified-detail-mounted')
      setTarget(node)
      return true
    }
    if (attach()) return () => mounted?.classList.remove('production-unified-detail-mounted')
    const observer = new MutationObserver(() => { if (attach()) observer.disconnect() })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect(); mounted?.classList.remove('production-unified-detail-mounted') }
  }, [route])

  const key = useMemo(() => route ? `${route.type}:${route.reference}` : 'none', [route])
  if (!route || !target) return null
  return createPortal(<ProductionDetail key={key} route={route} />, target)
}
