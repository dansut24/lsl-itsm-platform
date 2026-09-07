import { useEffect, useMemo, useState } from 'react'
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
import './ProductionItsmRecordDetail.css'

const API_BASE = window.__HI5_API_BASE__
const SECTION_TYPES = {
  incidents: 'Incident',
  problems: 'Problem',
  changes: 'Change',
}

function routeState() {
  const match = window.location.pathname.match(/^\/(incidents|problems|changes)\/([^/]+)\/?$/i)
  if (!match || match[2].toLowerCase() === 'new') return null
  const section = match[1].toLowerCase()
  return { section, type: SECTION_TYPES[section], reference: decodeURIComponent(match[2]) }
}

function formatDate(value, withSeconds = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
  }).format(date)
}

function relativeTime(value) {
  if (!value) return '—'
  const delta = new Date(value).getTime() - Date.now()
  const absolute = Math.abs(delta)
  const units = absolute >= 86400000 ? ['day', 86400000] : absolute >= 3600000 ? ['hour', 3600000] : ['minute', 60000]
  const amount = Math.round(delta / units[1])
  return new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' }).format(amount, units[0])
}

function formatBytes(value) {
  const bytes = Number(value || 0)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusClass(value = '') {
  return `is-${String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function priorityClass(value = '') {
  return `is-${String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

async function request(path, options = {}) {
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

function initialForm(detail) {
  const data = detail?.recordData || {}
  return {
    title: detail?.title || '',
    description: detail?.description || '',
    requesterId: detail?.requesterId || '',
    service: detail?.service || '',
    category: detail?.category || '',
    status: detail?.status || '',
    team: detail?.team || '',
    assignee: detail?.assignee || 'Unassigned',
    priority: detail?.priority || 'Medium',
    impact: detail?.impact || 'Medium',
    urgency: detail?.urgency || 'Medium',
    resolutionCode: detail?.resolutionCode || '',
    resolutionSummary: detail?.resolutionSummary || '',
    rootCause: data.rootCause || '',
    workaround: data.workaround || '',
    knownError: Boolean(data.knownError),
    changeType: data.changeType || 'Normal',
    risk: data.risk || detail?.priority || 'Medium',
    implementationPlan: data.implementationPlan || '',
    testPlan: data.testPlan || '',
    backoutPlan: data.backoutPlan || '',
    plannedStart: data.plannedStart || '',
    plannedEnd: data.plannedEnd || '',
  }
}

function Field({ label, children, hint, className = '' }) {
  return (
    <label className={`production-detail-field ${className}`.trim()}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  )
}

function Panel({ title, description, children, className = '' }) {
  return (
    <section className={`production-detail-panel ${className}`.trim()}>
      <header>
        <div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>
      </header>
      <div className="production-detail-panel-body">{children}</div>
    </section>
  )
}

function SlaMetric({ label, metric }) {
  if (!metric) return null
  const percent = Math.min(100, Number(metric.percent || 0))
  return (
    <div className={`production-detail-sla-metric is-${metric.state}`}>
      <div className="production-detail-sla-heading">
        <span>{label}</span>
        <strong>{metric.state === 'met' ? 'Met' : metric.state === 'breached' ? 'Breached' : metric.state === 'warning' ? 'At risk' : 'On track'}</strong>
      </div>
      <div className="production-detail-sla-track"><span style={{ width: `${percent}%` }} /></div>
      <div className="production-detail-sla-meta">
        <span>{metric.completedAt ? `Completed ${formatDate(metric.completedAt)}` : `Due ${relativeTime(metric.dueAt)}`}</span>
        <span>{metric.percent}%</span>
      </div>
    </div>
  )
}

function ActivityEntry({ item }) {
  const changes = Array.isArray(item.metadata?.changes) ? item.metadata.changes : []
  return (
    <article className={`production-detail-activity is-${item.visibility}`}>
      <div className="production-detail-activity-marker">
        {item.kind === 'field_change' ? <RefreshCw size={14} /> : item.visibility === 'customer' ? <MessageSquareText size={14} /> : <ShieldCheck size={14} />}
      </div>
      <div>
        <div className="production-detail-activity-heading">
          <strong>{item.actor}</strong>
          <span>{formatDate(item.createdAt)}</span>
          <em>{item.visibility === 'customer' ? 'Customer visible' : 'Internal'}</em>
        </div>
        <p>{item.text}</p>
        {changes.length ? (
          <div className="production-detail-change-list">
            {changes.map((change, index) => (
              <div key={`${change.field}-${index}`}>
                <strong>{change.field}</strong>
                <span>{String(change.from || '—')} → {String(change.to || '—')}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}

function IncidentOverview({ detail, form, setForm }) {
  const resolving = ['Resolved', 'Closed'].includes(form.status)
  return (
    <>
      <Panel title="Incident classification" description="Impact and urgency calculate priority on the server using the tenant matrix.">
        <div className="production-detail-field-grid">
          <Field label="Impact">
            <select value={form.impact} onChange={(event) => setForm((value) => ({ ...value, impact: event.target.value }))}>
              {['Low', 'Medium', 'High'].map((value) => <option key={value}>{value}</option>)}
            </select>
          </Field>
          <Field label="Urgency">
            <select value={form.urgency} onChange={(event) => setForm((value) => ({ ...value, urgency: event.target.value }))}>
              {['Low', 'Medium', 'High'].map((value) => <option key={value}>{value}</option>)}
            </select>
          </Field>
          <Field label="Calculated priority">
            <div className={`production-detail-readonly-priority ${priorityClass(detail.priority)}`}>{detail.priority}</div>
          </Field>
        </div>
      </Panel>

      <Panel title="SLA" description="Response and resolution clocks are calculated server-side. Pending customer/vendor states pause the Incident clock.">
        <div className="production-detail-sla-list">
          <SlaMetric label="First response" metric={detail.sla?.response} />
          <SlaMetric label="Resolution" metric={detail.sla?.resolution} />
          {detail.sla?.paused ? <div className="production-detail-sla-paused"><Clock3 size={16} /><span>SLA paused since {formatDate(detail.sla.pausedAt)}</span></div> : null}
        </div>
      </Panel>

      <Panel title="Resolution" description="Resolution data becomes mandatory before an Incident can move to Resolved or Closed.">
        <div className="production-detail-field-grid">
          <Field label="Resolution code">
            <select value={form.resolutionCode} onChange={(event) => setForm((value) => ({ ...value, resolutionCode: event.target.value }))}>
              <option value="">Select resolution</option>
              {['Fixed', 'Workaround', 'User education', 'Configuration change', 'Known error', 'Duplicate', 'No fault found', 'Other'].map((value) => <option key={value}>{value}</option>)}
            </select>
          </Field>
          <Field label="Resolution summary" className="is-wide" hint={resolving ? 'Required for the selected status.' : 'Complete this before resolving the Incident.'}>
            <textarea rows="4" value={form.resolutionSummary} onChange={(event) => setForm((value) => ({ ...value, resolutionSummary: event.target.value }))} />
          </Field>
        </div>
      </Panel>
    </>
  )
}

function ProblemOverview({ form, setForm }) {
  return (
    <Panel title="Problem investigation" description="Capture root cause and a reusable workaround, then promote the Problem to Known Error when appropriate.">
      <div className="production-detail-field-grid">
        <Field label="Known error">
          <select value={form.knownError ? 'Yes' : 'No'} onChange={(event) => setForm((value) => ({ ...value, knownError: event.target.value === 'Yes' }))}>
            <option>No</option><option>Yes</option>
          </select>
        </Field>
        <Field label="Root cause" className="is-wide">
          <textarea rows="5" value={form.rootCause} onChange={(event) => setForm((value) => ({ ...value, rootCause: event.target.value }))} />
        </Field>
        <Field label="Workaround" className="is-wide">
          <textarea rows="5" value={form.workaround} onChange={(event) => setForm((value) => ({ ...value, workaround: event.target.value }))} />
        </Field>
      </div>
    </Panel>
  )
}

function ChangeOverview({ form, setForm }) {
  return (
    <>
      <Panel title="Change assessment" description="The shared record shell keeps assignment and activity consistent while Change-specific execution data stays structured.">
        <div className="production-detail-field-grid">
          <Field label="Change type">
            <select value={form.changeType} onChange={(event) => setForm((value) => ({ ...value, changeType: event.target.value }))}>
              {['Standard', 'Normal', 'Emergency'].map((value) => <option key={value}>{value}</option>)}
            </select>
          </Field>
          <Field label="Risk">
            <select value={form.risk} onChange={(event) => setForm((value) => ({ ...value, risk: event.target.value }))}>
              {['Low', 'Medium', 'High', 'Critical'].map((value) => <option key={value}>{value}</option>)}
            </select>
          </Field>
          <Field label="Planned start"><input type="datetime-local" value={form.plannedStart} onChange={(event) => setForm((value) => ({ ...value, plannedStart: event.target.value }))} /></Field>
          <Field label="Planned end"><input type="datetime-local" value={form.plannedEnd} onChange={(event) => setForm((value) => ({ ...value, plannedEnd: event.target.value }))} /></Field>
        </div>
      </Panel>
      <Panel title="Implementation plan">
        <div className="production-detail-field-grid">
          <Field label="Implementation" className="is-wide"><textarea rows="5" value={form.implementationPlan} onChange={(event) => setForm((value) => ({ ...value, implementationPlan: event.target.value }))} /></Field>
          <Field label="Test plan" className="is-wide"><textarea rows="4" value={form.testPlan} onChange={(event) => setForm((value) => ({ ...value, testPlan: event.target.value }))} /></Field>
          <Field label="Backout plan" className="is-wide"><textarea rows="4" value={form.backoutPlan} onChange={(event) => setForm((value) => ({ ...value, backoutPlan: event.target.value }))} /></Field>
        </div>
      </Panel>
    </>
  )
}

function ProductionDetail({ route }) {
  const [detail, setDetail] = useState(null)
  const [form, setForm] = useState({})
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activityText, setActivityText] = useState('')
  const [activityVisibility, setActivityVisibility] = useState('internal')
  const [relationshipReference, setRelationshipReference] = useState('')
  const [relationshipType, setRelationshipType] = useState('related')
  const [attachment, setAttachment] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const payload = await request(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}`)
      setDetail(payload)
      setForm(initialForm(payload))
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [route.reference])

  function buildRecordData() {
    if (route.type === 'Problem') return { rootCause: form.rootCause, workaround: form.workaround, knownError: form.knownError }
    if (route.type === 'Change') return {
      changeType: form.changeType,
      risk: form.risk,
      implementationPlan: form.implementationPlan,
      testPlan: form.testPlan,
      backoutPlan: form.backoutPlan,
      plannedStart: form.plannedStart,
      plannedEnd: form.plannedEnd,
    }
    return detail?.recordData || {}
  }

  async function save() {
    if (!detail) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const payload = await request(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          version: detail.version,
          title: form.title,
          description: form.description,
          requesterId: form.requesterId,
          service: form.service,
          category: form.category,
          status: form.status,
          team: form.team,
          assignee: form.assignee,
          priority: form.priority,
          impact: form.impact,
          urgency: form.urgency,
          resolutionCode: form.resolutionCode,
          resolutionSummary: form.resolutionSummary,
          recordData: buildRecordData(),
        }),
      })
      setDetail(payload)
      setForm(initialForm(payload))
      setNotice('Record saved to PostgreSQL.')
    } catch (saveError) {
      if (saveError.status === 409) setError('Another technician changed this record before you saved. Reload the latest version and reapply your change.')
      else setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function postActivity() {
    if (!activityText.trim()) return
    setSaving(true)
    setError('')
    try {
      const payload = await request(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/activity`, {
        method: 'POST', body: JSON.stringify({ text: activityText, visibility: activityVisibility }),
      })
      setDetail(payload)
      setForm(initialForm(payload))
      setActivityText('')
    } catch (activityError) { setError(activityError.message) } finally { setSaving(false) }
  }

  async function addRelationship() {
    if (!relationshipReference) return
    setSaving(true)
    setError('')
    try {
      const payload = await request(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/relationships`, {
        method: 'POST', body: JSON.stringify({ targetReference: relationshipReference, relationshipType }),
      })
      setDetail(payload)
      setForm(initialForm(payload))
      setRelationshipReference('')
    } catch (relationshipError) { setError(relationshipError.message) } finally { setSaving(false) }
  }

  async function removeRelationship(relationshipId) {
    setSaving(true)
    try {
      const payload = await request(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/relationships/remove`, {
        method: 'POST', body: JSON.stringify({ relationshipId }),
      })
      setDetail(payload)
      setForm(initialForm(payload))
    } catch (relationshipError) { setError(relationshipError.message) } finally { setSaving(false) }
  }

  async function uploadAttachment() {
    if (!attachment) return
    if (attachment.size > 5 * 1024 * 1024) {
      setError('Attachments are limited to 5 MB each.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const contentBase64 = await fileBase64(attachment)
      const payload = await request(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/attachments`, {
        method: 'POST', body: JSON.stringify({ fileName: attachment.name, mimeType: attachment.type || 'application/octet-stream', contentBase64 }),
      })
      setDetail(payload)
      setForm(initialForm(payload))
      setAttachment(null)
      const input = document.querySelector('#production-detail-attachment-input')
      if (input) input.value = ''
    } catch (attachmentError) { setError(attachmentError.message) } finally { setSaving(false) }
  }

  async function removeAttachment(attachmentId) {
    setSaving(true)
    try {
      const payload = await request(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/attachments/remove`, {
        method: 'POST', body: JSON.stringify({ attachmentId }),
      })
      setDetail(payload)
      setForm(initialForm(payload))
    } catch (attachmentError) { setError(attachmentError.message) } finally { setSaving(false) }
  }

  if (loading) return <section className="production-itsm-detail-shell"><div className="production-detail-loading">Loading {route.type.toLowerCase()}…</div></section>
  if (!detail) return <section className="production-itsm-detail-shell"><div className="production-detail-loading is-error"><strong>Could not open this record</strong><span>{error}</span><button onClick={load} type="button">Retry</button></div></section>

  const people = detail.options?.people || []
  const teams = detail.options?.teams || []
  const tabs = [
    ['overview', 'Overview'],
    ['activity', `Activity (${detail.activities?.length || 0})`],
    ['relationships', `Relationships (${detail.relationships?.length || 0})`],
    ['attachments', `Attachments (${detail.attachments?.length || 0})`],
  ]

  return (
    <section className="production-itsm-detail-shell">
      <header className="production-detail-header">
        <button className="production-detail-back" onClick={() => window.location.assign(`/${route.section}`)} type="button"><ArrowLeft size={18} />Back</button>
        <div className="production-detail-heading">
          <div className="production-detail-reference-row">
            <strong>{detail.id}</strong>
            <span className={`production-detail-status ${statusClass(detail.status)}`}>{detail.status}</span>
            <span className={`production-detail-priority ${priorityClass(detail.priority)}`}>{detail.priority}</span>
          </div>
          <h1>{detail.title}</h1>
          <p>Updated {formatDate(detail.updatedAt)} · Version {detail.version}</p>
        </div>
        <div className="production-detail-header-actions">
          <button className="production-detail-reload" onClick={load} type="button" title="Reload latest"><RefreshCw size={16} /></button>
          <button className="production-detail-save" disabled={saving} onClick={save} type="button"><Save size={16} />{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </header>

      <nav className="production-detail-tabs" aria-label={`${route.type} sections`}>
        {tabs.map(([id, label]) => <button className={tab === id ? 'is-active' : ''} key={id} onClick={() => setTab(id)} type="button">{label}</button>)}
      </nav>

      {error ? <div className="production-detail-banner is-error"><AlertTriangle size={17} /><span>{error}</span><button onClick={() => setError('')} type="button"><X size={15} /></button></div> : null}
      {notice ? <div className="production-detail-banner is-success"><CheckCircle2 size={17} /><span>{notice}</span><button onClick={() => setNotice('')} type="button"><X size={15} /></button></div> : null}

      <div className="production-detail-scroll">
        {tab === 'overview' ? (
          <div className="production-detail-overview-grid">
            <div className="production-detail-primary">
              <Panel title="Record" description="Core fields are persisted directly against the production ITSM record.">
                <div className="production-detail-field-grid">
                  <Field label="Summary" className="is-wide"><input value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} /></Field>
                  <Field label="Description" className="is-wide"><textarea rows="6" value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} /></Field>
                  <Field label="Requester">
                    <select value={form.requesterId} onChange={(event) => setForm((value) => ({ ...value, requesterId: event.target.value }))}>
                      <option value="">Not recorded</option>
                      {people.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.email}</option>)}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select value={form.status} onChange={(event) => setForm((value) => ({ ...value, status: event.target.value }))}>
                      {(detail.allowedStatuses || []).map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </Field>
                  <Field label="Service"><input value={form.service} onChange={(event) => setForm((value) => ({ ...value, service: event.target.value }))} /></Field>
                  <Field label="Category"><input value={form.category} onChange={(event) => setForm((value) => ({ ...value, category: event.target.value }))} /></Field>
                  <Field label="Assignment group">
                    <select value={form.team} onChange={(event) => setForm((value) => ({ ...value, team: event.target.value }))}>
                      <option value="">Unassigned team</option>
                      {teams.map((team) => <option key={team.id} value={team.name}>{team.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Assignee">
                    <select value={form.assignee} onChange={(event) => setForm((value) => ({ ...value, assignee: event.target.value }))}>
                      <option>Unassigned</option>
                      {people.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}
                    </select>
                  </Field>
                </div>
              </Panel>
              {route.type === 'Incident' ? <IncidentOverview detail={detail} form={form} setForm={setForm} /> : null}
              {route.type === 'Problem' ? <ProblemOverview form={form} setForm={setForm} /> : null}
              {route.type === 'Change' ? <ChangeOverview form={form} setForm={setForm} /> : null}
            </div>

            <aside className="production-detail-sidebar">
              <Panel title="Record context">
                <dl className="production-detail-summary-list">
                  <div><dt>Type</dt><dd>{detail.type}</dd></div>
                  <div><dt>Source</dt><dd>{detail.source || 'Technician'}</dd></div>
                  <div><dt>Created</dt><dd>{formatDate(detail.createdAt)}</dd></div>
                  <div><dt>Updated</dt><dd>{formatDate(detail.updatedAt)}</dd></div>
                  <div><dt>Requester</dt><dd>{detail.requester || 'Not recorded'}</dd></div>
                  <div><dt>Requester email</dt><dd>{detail.requesterEmail || '—'}</dd></div>
                  {route.type === 'Incident' ? <div><dt>First response</dt><dd>{formatDate(detail.firstResponseAt)}</dd></div> : null}
                  {detail.resolvedAt ? <div><dt>Resolved</dt><dd>{formatDate(detail.resolvedAt)}</dd></div> : null}
                </dl>
              </Panel>
              <Panel title="Lifecycle health">
                <div className="production-detail-health">
                  <div><ShieldCheck size={18} /><span><strong>Version protected</strong><small>Concurrent edits cannot silently overwrite this record.</small></span></div>
                  <div><Link2 size={18} /><span><strong>{detail.relationships?.length || 0} relationships</strong><small>Cross-record context stays tenant isolated.</small></span></div>
                  <div><Paperclip size={18} /><span><strong>{detail.attachments?.length || 0} attachments</strong><small>Stored with SHA-256 evidence.</small></span></div>
                </div>
              </Panel>
            </aside>
          </div>
        ) : null}

        {tab === 'activity' ? (
          <div className="production-detail-tab-page">
            <Panel title="Add activity" description="Internal work notes remain technician-only. Customer updates are explicitly marked customer-visible.">
              <div className="production-detail-activity-composer">
                <select value={activityVisibility} onChange={(event) => setActivityVisibility(event.target.value)}>
                  <option value="internal">Internal work note</option>
                  <option value="customer">Customer-visible update</option>
                </select>
                <textarea rows="4" placeholder="Add an update…" value={activityText} onChange={(event) => setActivityText(event.target.value)} />
                <button disabled={saving || !activityText.trim()} onClick={postActivity} type="button"><MessageSquareText size={16} />Add update</button>
              </div>
            </Panel>
            <Panel title="Activity history">
              <div className="production-detail-activity-list">
                {(detail.activities || []).length ? detail.activities.map((item) => <ActivityEntry item={item} key={item.id} />) : <div className="production-detail-empty">No activity yet.</div>}
              </div>
            </Panel>
          </div>
        ) : null}

        {tab === 'relationships' ? (
          <div className="production-detail-tab-page">
            <Panel title="Link another record" description="Incidents, Problems, Changes and Service Requests can be related without crossing tenant boundaries.">
              <div className="production-detail-relationship-add">
                <select value={relationshipType} onChange={(event) => setRelationshipType(event.target.value)}>
                  <option value="related">Related</option>
                  <option value="caused-by">Caused by</option>
                  <option value="resolved-by">Resolved by</option>
                  <option value="duplicates">Duplicates</option>
                  <option value="blocks">Blocks</option>
                  <option value="blocked-by">Blocked by</option>
                </select>
                <select value={relationshipReference} onChange={(event) => setRelationshipReference(event.target.value)}>
                  <option value="">Choose record</option>
                  {(detail.options?.relatedRecords || []).map((record) => <option key={`${record.type}-${record.reference}`} value={record.reference}>{record.reference} · {record.title}</option>)}
                </select>
                <button disabled={!relationshipReference || saving} onClick={addRelationship} type="button"><Link2 size={16} />Link record</button>
              </div>
            </Panel>
            <Panel title="Relationships">
              <div className="production-detail-relationship-list">
                {(detail.relationships || []).length ? detail.relationships.map((relationship) => (
                  <div key={relationship.id}>
                    <span><strong>{relationship.targetReference}</strong><small>{relationship.targetType} · {relationship.relationshipType}</small></span>
                    <button onClick={() => removeRelationship(relationship.id)} type="button" title="Remove relationship"><Trash2 size={15} /></button>
                  </div>
                )) : <div className="production-detail-empty">No related records yet.</div>}
              </div>
            </Panel>
          </div>
        ) : null}

        {tab === 'attachments' ? (
          <div className="production-detail-tab-page">
            <Panel title="Add attachment" description="Files are limited to 5 MB each in this release and stored with a SHA-256 fingerprint.">
              <div className="production-detail-attachment-add">
                <input id="production-detail-attachment-input" type="file" onChange={(event) => setAttachment(event.target.files?.[0] || null)} />
                <button disabled={!attachment || saving} onClick={uploadAttachment} type="button"><Upload size={16} />Upload</button>
              </div>
              {attachment ? <small className="production-detail-selected-file">{attachment.name} · {formatBytes(attachment.size)}</small> : null}
            </Panel>
            <Panel title="Attachments">
              <div className="production-detail-attachment-list">
                {(detail.attachments || []).length ? detail.attachments.map((item) => (
                  <div key={item.id}>
                    <FileText size={18} />
                    <span><strong>{item.fileName}</strong><small>{formatBytes(item.byteSize)} · {item.uploadedBy} · {formatDate(item.createdAt)}</small></span>
                    <a href={`${API_BASE}/api/v1/itsm-lifecycle/${encodeURIComponent(detail.id)}/attachments/${encodeURIComponent(item.id)}`} target="_blank" rel="noreferrer" title="Download"><Download size={16} /></a>
                    <button onClick={() => removeAttachment(item.id)} type="button" title="Remove attachment"><Trash2 size={15} /></button>
                  </div>
                )) : <div className="production-detail-empty">No attachments yet.</div>}
              </div>
            </Panel>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function ProductionItsmRecordDetail() {
  const [route, setRoute] = useState(routeState)
  const [target, setTarget] = useState(null)

  useEffect(() => {
    const update = () => setRoute(routeState())
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
      document.querySelector('.content-frame')?.classList.remove('production-itsm-detail-mounted')
      return undefined
    }
    let mounted = null
    const attach = () => {
      const node = document.querySelector('.content-frame')
      if (!(node instanceof HTMLElement)) return false
      mounted = node
      node.classList.add('production-itsm-detail-mounted')
      setTarget(node)
      return true
    }
    if (attach()) return () => mounted?.classList.remove('production-itsm-detail-mounted')
    const observer = new MutationObserver(() => { if (attach()) observer.disconnect() })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect(); mounted?.classList.remove('production-itsm-detail-mounted') }
  }, [route])

  const key = useMemo(() => route ? `${route.type}:${route.reference}` : 'none', [route])
  if (!route || !target) return null
  return createPortal(<ProductionDetail key={key} route={route} />, target)
}
