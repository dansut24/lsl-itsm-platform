import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  Bold,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Code2,
  Copy,
  Download,
  FileText,
  Italic,
  Link2,
  List,
  ListOrdered,
  MessageSquareText,
  Quote,
  RefreshCw,
  Save,
  Table2,
  Trash2,
  Underline,
  Upload,
  UserRoundCog,
  X,
} from 'lucide-react'
import './ProductionGenericRecordWorkbench.css'

const API_BASE = 'https://api.hi5central.com'
const TYPES = { incidents: 'Incident', problems: 'Problem', changes: 'Change' }
const SAFE_TAGS = new Set(['P','BR','STRONG','B','EM','I','U','S','UL','OL','LI','BLOCKQUOTE','PRE','CODE','TABLE','THEAD','TBODY','TFOOT','TR','TH','TD','H1','H2','H3','H4','HR','A','SPAN'])
const DROP_TAGS = new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','FORM','INPUT','BUTTON','SVG','MATH','META','LINK'])

function routeState() {
  const match = window.location.pathname.match(/^\/(incidents|problems|changes)\/([^/]+)\/?$/i)
  if (!match || match[2].toLowerCase() === 'new') return null
  const section = match[1].toLowerCase()
  return { section, type: TYPES[section], reference: decodeURIComponent(match[2]) }
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
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

function slug(value = '') { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-') }

async function apiJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
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

function sanitiseRichHtml(value = '') {
  if (!value || typeof DOMParser === 'undefined') return ''
  const doc = new DOMParser().parseFromString(`<body>${String(value).slice(0, 100000)}</body>`, 'text/html')
  const walk = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.COMMENT_NODE) { child.remove(); return }
      if (child.nodeType !== Node.ELEMENT_NODE) return
      if (DROP_TAGS.has(child.tagName)) { child.remove(); return }
      if (!SAFE_TAGS.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes))
        return
      }
      Array.from(child.attributes).forEach((attribute) => {
        const name = attribute.name.toLowerCase()
        const keep = (child.tagName === 'A' && ['href','title'].includes(name)) || (['TD','TH'].includes(child.tagName) && ['colspan','rowspan'].includes(name))
        if (!keep) child.removeAttribute(attribute.name)
      })
      if (child.tagName === 'A') {
        const href = child.getAttribute('href') || ''
        if (!/^(https?:|mailto:|#)/i.test(href)) child.removeAttribute('href')
        child.setAttribute('rel', 'noopener noreferrer')
        child.setAttribute('target', '_blank')
      }
      walk(child)
    })
  }
  walk(doc.body)
  return doc.body.innerHTML.slice(0, 100000)
}

function richPlainText(html = '') {
  if (!html || typeof DOMParser === 'undefined') return ''
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  return (doc.body.innerText || doc.body.textContent || '').trim().slice(0, 20000)
}

function formFor(detail) {
  const data = detail?.recordData || {}
  return {
    title: detail?.title || '', description: detail?.description || '', requesterId: detail?.requesterId || '',
    service: detail?.service || '', category: detail?.category || '', status: detail?.status || '', team: detail?.team || '',
    assignee: detail?.assignee || 'Unassigned', priority: detail?.priority || 'Medium', impact: detail?.impact || 'Medium', urgency: detail?.urgency || 'Medium',
    resolutionCode: detail?.resolutionCode || '', resolutionSummary: detail?.resolutionSummary || '',
    rootCause: data.rootCause || '', workaround: data.workaround || '', knownError: Boolean(data.knownError),
    changeType: data.changeType || 'Normal', risk: data.risk || detail?.priority || 'Medium', implementationPlan: data.implementationPlan || '',
    testPlan: data.testPlan || '', backoutPlan: data.backoutPlan || '', plannedStart: data.plannedStart || '', plannedEnd: data.plannedEnd || '',
  }
}

function Field({ label, children, hint }) {
  return <label className="record-workbench-field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>
}

function SlaMetric({ label, metric }) {
  if (!metric) return null
  const percent = Math.min(100, Number(metric.percent || 0))
  return <div className={`record-workbench-sla is-${metric.state}`}><div><span>{label}</span><strong>{metric.state === 'met' ? 'Met' : metric.state === 'breached' ? 'Breached' : metric.state === 'warning' ? 'At risk' : 'On track'}</strong></div><div className="record-workbench-sla-track"><i style={{ width: `${percent}%` }} /></div><small><span>{metric.completedAt ? `Completed ${formatDate(metric.completedAt)}` : `Due ${relativeTime(metric.dueAt)}`}</span><span>{metric.percent}%</span></small></div>
}

function Accordion({ id, title, summary, count, children, open = false }) {
  return <details className="record-workbench-accordion" id={id} open={open}><summary><span><strong>{title}</strong>{summary ? <small>{summary}</small> : null}</span>{count !== undefined ? <em>{count}</em> : null}<ChevronDown size={17} /></summary><div className="record-workbench-accordion-body">{children}</div></details>
}

async function copyActivity(item, html) {
  const plain = item.text || richPlainText(html)
  try {
    if (html && navigator.clipboard?.write && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })])
      return
    }
    await navigator.clipboard.writeText(plain)
  } catch { /* Clipboard can be denied by browser policy. */ }
}

function ActivityCard({ item }) {
  const html = sanitiseRichHtml(item.metadata?.richHtml || '')
  const changes = Array.isArray(item.metadata?.changes) ? item.metadata.changes : []
  const kind = item.kind === 'field_change' || item.kind === 'relationship' || item.kind === 'attachment' ? 'system' : item.visibility === 'customer' ? 'customer' : 'internal'
  return <article className={`record-workbench-message is-${kind}`}>
    <header><div><strong>{item.actor || 'Hi5Central'}</strong><span>{formatDate(item.createdAt)}</span></div><div><em>{kind === 'customer' ? 'Customer visible' : kind === 'internal' ? 'Internal note' : 'System'}</em><button type="button" title="Copy update" onClick={() => copyActivity(item, html)}><Copy size={15} /></button></div></header>
    {html ? <div className="record-workbench-rich-output" dangerouslySetInnerHTML={{ __html: html }} /> : <p className="record-workbench-plain-message">{item.text}</p>}
    {changes.length ? <div className="record-workbench-change-list">{changes.map((change, index) => <div key={`${change.field}-${index}`}><strong>{change.field}</strong><span>{String(change.from || '—')} → {String(change.to || '—')}</span></div>)}</div> : null}
  </article>
}

function RichComposer({ editorRef, visibility, onVisibility, disabled, onPost }) {
  const command = (name, value = null) => {
    editorRef.current?.focus()
    document.execCommand(name, false, value)
  }
  const insertTable = () => command('insertHTML', '<table><tbody><tr><th>Heading</th><th>Heading</th></tr><tr><td>Value</td><td>Value</td></tr></tbody></table><p><br></p>')
  return <section className="record-workbench-composer">
    <div className="record-workbench-composer-top"><select value={visibility} onChange={(event) => onVisibility(event.target.value)}><option value="internal">Internal work note</option><option value="customer">Customer-visible update</option></select><span>Paste formatted content from documents, spreadsheets, tickets or code editors.</span></div>
    <div className="record-workbench-toolbar" role="toolbar" aria-label="Update formatting">
      <button type="button" title="Bold" onClick={() => command('bold')}><Bold size={16} /></button><button type="button" title="Italic" onClick={() => command('italic')}><Italic size={16} /></button><button type="button" title="Underline" onClick={() => command('underline')}><Underline size={16} /></button>
      <i />
      <button type="button" title="Bulleted list" onClick={() => command('insertUnorderedList')}><List size={16} /></button><button type="button" title="Numbered list" onClick={() => command('insertOrderedList')}><ListOrdered size={16} /></button><button type="button" title="Quote" onClick={() => command('formatBlock', 'blockquote')}><Quote size={16} /></button><button type="button" title="Code block" onClick={() => command('formatBlock', 'pre')}><Code2 size={16} /></button><button type="button" title="Insert table" onClick={insertTable}><Table2 size={16} /></button>
    </div>
    <div ref={editorRef} className="record-workbench-editor" contentEditable suppressContentEditableWarning data-placeholder="Add an update…" />
    <div className="record-workbench-composer-footer"><span>{visibility === 'customer' ? 'Visible to the requester' : 'Technicians only'}</span><button className="record-workbench-primary" disabled={disabled} onClick={onPost} type="button"><MessageSquareText size={16} />Add update</button></div>
  </section>
}

function Skeleton() {
  return <section className="record-workbench-shell is-loading" aria-label="Loading record"><header className="record-workbench-header"><div className="record-workbench-skeleton is-title" /><div className="record-workbench-skeleton is-actions" /></header><div className="record-workbench-hero"><div className="record-workbench-skeleton is-summary" /><div className="record-workbench-skeleton is-description" /></div><div className="record-workbench-body"><aside className="record-workbench-details"><div className="record-workbench-skeleton is-detail" /><div className="record-workbench-skeleton is-detail" /><div className="record-workbench-skeleton is-detail" /></aside><main className="record-workbench-activity"><div className="record-workbench-skeleton is-composer" />{Array.from({ length: 4 }, (_, index) => <div className="record-workbench-skeleton is-message" key={index} />)}</main></div></section>
}

function Workbench({ route }) {
  const [detail, setDetail] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activityVisibility, setActivityVisibility] = useState('internal')
  const [relationshipReference, setRelationshipReference] = useState('')
  const [relationshipType, setRelationshipType] = useState('related')
  const [attachment, setAttachment] = useState(null)
  const editorRef = useRef(null)

  async function load({ quiet = false } = {}) {
    if (!quiet) setLoading(true)
    setError('')
    try {
      const payload = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}`)
      setDetail(payload); setForm(formFor(payload))
    } catch (loadError) { setError(loadError.message) } finally { if (!quiet) setLoading(false) }
  }

  useEffect(() => { void load() }, [route.reference, route.type])

  function recordData(next = form) {
    if (route.type === 'Problem') return { rootCause: next.rootCause, workaround: next.workaround, knownError: next.knownError }
    if (route.type === 'Change') return { changeType: next.changeType, risk: next.risk, implementationPlan: next.implementationPlan, testPlan: next.testPlan, backoutPlan: next.backoutPlan, plannedStart: next.plannedStart, plannedEnd: next.plannedEnd }
    return detail?.recordData || {}
  }

  async function patchRecord(patch, { success = '' } = {}) {
    if (!detail) return null
    setSaving(true); setError(''); setNotice('')
    try {
      const payload = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}`, { method: 'PATCH', body: JSON.stringify({ version: detail.version, ...patch }) })
      setDetail(payload); setForm(formFor(payload)); if (success) setNotice(success); return payload
    } catch (saveError) {
      setError(saveError.status === 409 ? 'Another technician changed this record before you saved. Reload the latest version and reapply your change.' : saveError.message)
      return null
    } finally { setSaving(false) }
  }

  async function saveAll() {
    await patchRecord({ title: form.title, description: form.description, requesterId: form.requesterId, service: form.service, category: form.category, status: form.status, team: form.team, assignee: form.assignee, priority: form.priority, impact: form.impact, urgency: form.urgency, resolutionCode: form.resolutionCode, resolutionSummary: form.resolutionSummary, recordData: recordData() }, { success: 'Record saved' })
  }

  async function autosave(field, value) {
    if (!detail || value === detail[field]) return
    await patchRecord({ [field]: value }, { success: `${field === 'title' ? 'Summary' : 'Description'} saved` })
  }

  async function changeStatus(status) {
    if (status === detail.status) return
    const patch = { status }
    if (route.type === 'Incident') { patch.resolutionCode = form.resolutionCode; patch.resolutionSummary = form.resolutionSummary }
    await patchRecord(patch, { success: `Status changed to ${status}` })
  }

  async function resolveRecord() {
    if (route.type === 'Incident' && (!form.resolutionCode || form.resolutionSummary.trim().length < 3)) {
      document.querySelector('#record-resolution')?.setAttribute('open', '')
      setNotice('Add a resolution code and summary, then choose Resolve again.')
      document.querySelector('#record-resolution')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      return
    }
    const target = route.type === 'Change' ? 'Completed' : 'Resolved'
    await patchRecord({ status: target, ...(route.type === 'Incident' ? { resolutionCode: form.resolutionCode, resolutionSummary: form.resolutionSummary } : {}) }, { success: `${route.type} resolved` })
  }

  async function postActivity() {
    const raw = editorRef.current?.innerHTML || ''
    const html = sanitiseRichHtml(raw)
    const text = richPlainText(html)
    if (!text && !html) return
    setSaving(true); setError('')
    try {
      const payload = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/activity`, { method: 'POST', body: JSON.stringify({ text, visibility: activityVisibility, metadata: html ? { richHtml: html, format: 'rich' } : {} }) })
      setDetail(payload); setForm(formFor(payload)); if (editorRef.current) editorRef.current.innerHTML = ''
    } catch (activityError) { setError(activityError.message) } finally { setSaving(false) }
  }

  async function addRelationship() {
    if (!relationshipReference) return
    setSaving(true); setError('')
    try {
      const payload = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/relationships`, { method: 'POST', body: JSON.stringify({ targetReference: relationshipReference, relationshipType }) })
      setDetail(payload); setForm(formFor(payload)); setRelationshipReference('')
    } catch (relationshipError) { setError(relationshipError.message) } finally { setSaving(false) }
  }

  async function removeRelationship(id) {
    setSaving(true); setError('')
    try { const payload = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/relationships/remove`, { method: 'POST', body: JSON.stringify({ relationshipId: id }) }); setDetail(payload); setForm(formFor(payload)) }
    catch (relationshipError) { setError(relationshipError.message) } finally { setSaving(false) }
  }

  async function uploadAttachment() {
    if (!attachment) return
    if (attachment.size > 5 * 1024 * 1024) { setError('Attachments are limited to 5 MB each.'); return }
    setSaving(true); setError('')
    try {
      const contentBase64 = await fileBase64(attachment)
      const payload = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/attachments`, { method: 'POST', body: JSON.stringify({ fileName: attachment.name, mimeType: attachment.type || 'application/octet-stream', contentBase64 }) })
      setDetail(payload); setForm(formFor(payload)); setAttachment(null)
    } catch (attachmentError) { setError(attachmentError.message) } finally { setSaving(false) }
  }

  async function removeAttachment(id) {
    setSaving(true); setError('')
    try { const payload = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/attachments/remove`, { method: 'POST', body: JSON.stringify({ attachmentId: id }) }); setDetail(payload); setForm(formFor(payload)) }
    catch (attachmentError) { setError(attachmentError.message) } finally { setSaving(false) }
  }

  if (loading) return <Skeleton />
  if (!detail) return <section className="record-workbench-shell"><div className="record-workbench-failure"><strong>Could not open this record</strong><span>{error}</span><button type="button" onClick={() => load()}>Retry</button></div></section>

  const people = detail.options?.people || []
  const teams = detail.options?.teams || []
  const activities = (detail.activities || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const canResolve = route.type !== 'Change' ? !['Resolved','Closed'].includes(detail.status) : !['Completed','Cancelled'].includes(detail.status)

  return <section className="record-workbench-shell production-motion-enter">
    <header className="record-workbench-header">
      <div className="record-workbench-reference"><strong>{detail.id}</strong><span className={`record-workbench-pill is-${slug(detail.status)}`}>{detail.status}</span><span className={`record-workbench-pill is-${slug(detail.priority)}`}>{detail.priority}</span></div>
      <div className="record-workbench-commands">
        <label className="record-workbench-status-command"><span>Status</span><select disabled={saving} value={detail.status} onChange={(event) => changeStatus(event.target.value)}>{(detail.allowedStatuses || []).map((status) => <option key={status}>{status}</option>)}</select></label>
        {canResolve ? <button type="button" className="record-workbench-command" onClick={resolveRecord}>Resolve</button> : null}
        <details className="record-workbench-reassign"><summary><UserRoundCog size={17} />Reassign</summary><div><Field label="Assignment group"><select value={form.team} onChange={(event) => setForm((value) => ({ ...value, team: event.target.value }))}><option value="">Unassigned team</option>{teams.map((team) => <option key={team.id} value={team.name}>{team.name}</option>)}</select></Field><Field label="Assignee"><select value={form.assignee} onChange={(event) => setForm((value) => ({ ...value, assignee: event.target.value }))}><option>Unassigned</option>{people.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}</select></Field><button type="button" className="record-workbench-primary" disabled={saving} onClick={() => patchRecord({ team: form.team, assignee: form.assignee }, { success: 'Assignment updated' })}>Apply assignment</button></div></details>
        <button type="button" className="record-workbench-icon" title="Reload latest" onClick={() => load({ quiet: true })}><RefreshCw size={17} /></button>
        <button type="button" className="record-workbench-primary" disabled={saving} onClick={saveAll}><Save size={17} />{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </header>

    <section className="record-workbench-hero">
      <input className="record-workbench-summary" aria-label="Summary" value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} onBlur={(event) => autosave('title', event.target.value.trim())} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} />
      <textarea className="record-workbench-description" aria-label="Description" rows="2" placeholder="Add a description…" value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} onBlur={(event) => autosave('description', event.target.value)} />
      <small>Summary and description save independently when you leave the field.</small>
    </section>

    {error ? <div className="record-workbench-banner is-error"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={() => setError('')}><X size={15} /></button></div> : null}
    {notice ? <div className="record-workbench-banner is-success"><CheckCircle2 size={17} /><span>{notice}</span><button type="button" onClick={() => setNotice('')}><X size={15} /></button></div> : null}

    <div className="record-workbench-body">
      <aside className="record-workbench-details">
        <header><div><span>Record</span><h2>Details</h2></div><small>Updated {formatDate(detail.updatedAt)}</small></header>
        <div className="record-workbench-details-scroll">
          <section className="record-workbench-core-fields">
            <Field label="Requester"><select value={form.requesterId} onChange={(event) => setForm((value) => ({ ...value, requesterId: event.target.value }))}><option value="">Not recorded</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.email}</option>)}</select></Field>
            <Field label="Service"><input value={form.service} onChange={(event) => setForm((value) => ({ ...value, service: event.target.value }))} /></Field>
            <Field label="Category"><input value={form.category} onChange={(event) => setForm((value) => ({ ...value, category: event.target.value }))} /></Field>
            <Field label="Assignment group"><select value={form.team} onChange={(event) => setForm((value) => ({ ...value, team: event.target.value }))}><option value="">Unassigned team</option>{teams.map((team) => <option key={team.id} value={team.name}>{team.name}</option>)}</select></Field>
            <Field label="Assignee"><select value={form.assignee} onChange={(event) => setForm((value) => ({ ...value, assignee: event.target.value }))}><option>Unassigned</option>{people.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}</select></Field>
          </section>

          {route.type === 'Incident' ? <>
            <Accordion title="Classification & SLA" summary={`${detail.priority} priority`} open>
              <div className="record-workbench-grid"><Field label="Impact"><select value={form.impact} onChange={(event) => setForm((value) => ({ ...value, impact: event.target.value }))}>{['Low','Medium','High'].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Urgency"><select value={form.urgency} onChange={(event) => setForm((value) => ({ ...value, urgency: event.target.value }))}>{['Low','Medium','High'].map((value) => <option key={value}>{value}</option>)}</select></Field></div>
              <div className="record-workbench-sla-list"><SlaMetric label="First response" metric={detail.sla?.response} /><SlaMetric label="Resolution" metric={detail.sla?.resolution} />{detail.sla?.paused ? <div className="record-workbench-sla-paused"><Clock3 size={16} />Paused since {formatDate(detail.sla.pausedAt)}</div> : null}</div>
            </Accordion>
            <Accordion id="record-resolution" title="Resolution" summary={detail.resolutionCode || 'Not resolved'}>
              <Field label="Resolution code"><select value={form.resolutionCode} onChange={(event) => setForm((value) => ({ ...value, resolutionCode: event.target.value }))}><option value="">Select resolution</option>{['Fixed','Workaround','User education','Configuration change','Known error','Duplicate','No fault found','Other'].map((value) => <option key={value}>{value}</option>)}</select></Field>
              <Field label="Resolution summary"><textarea rows="4" value={form.resolutionSummary} onChange={(event) => setForm((value) => ({ ...value, resolutionSummary: event.target.value }))} /></Field>
            </Accordion>
          </> : null}

          {route.type === 'Problem' ? <Accordion title="Investigation" summary={form.knownError ? 'Known error' : 'Root cause analysis'} open><Field label="Known error"><select value={form.knownError ? 'Yes' : 'No'} onChange={(event) => setForm((value) => ({ ...value, knownError: event.target.value === 'Yes' }))}><option>No</option><option>Yes</option></select></Field><Field label="Root cause"><textarea rows="5" value={form.rootCause} onChange={(event) => setForm((value) => ({ ...value, rootCause: event.target.value }))} /></Field><Field label="Workaround"><textarea rows="5" value={form.workaround} onChange={(event) => setForm((value) => ({ ...value, workaround: event.target.value }))} /></Field></Accordion> : null}

          {route.type === 'Change' ? <><Accordion title="Assessment" summary={`${form.changeType} · ${form.risk} risk`} open><div className="record-workbench-grid"><Field label="Change type"><select value={form.changeType} onChange={(event) => setForm((value) => ({ ...value, changeType: event.target.value }))}>{['Standard','Normal','Emergency'].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Risk"><select value={form.risk} onChange={(event) => setForm((value) => ({ ...value, risk: event.target.value }))}>{['Low','Medium','High','Critical'].map((value) => <option key={value}>{value}</option>)}</select></Field></div><Field label="Planned start"><input type="datetime-local" value={form.plannedStart} onChange={(event) => setForm((value) => ({ ...value, plannedStart: event.target.value }))} /></Field><Field label="Planned end"><input type="datetime-local" value={form.plannedEnd} onChange={(event) => setForm((value) => ({ ...value, plannedEnd: event.target.value }))} /></Field></Accordion><Accordion title="Plans" summary="Implementation, test & backout"><Field label="Implementation plan"><textarea rows="6" value={form.implementationPlan} onChange={(event) => setForm((value) => ({ ...value, implementationPlan: event.target.value }))} /></Field><Field label="Test plan"><textarea rows="5" value={form.testPlan} onChange={(event) => setForm((value) => ({ ...value, testPlan: event.target.value }))} /></Field><Field label="Backout plan"><textarea rows="5" value={form.backoutPlan} onChange={(event) => setForm((value) => ({ ...value, backoutPlan: event.target.value }))} /></Field></Accordion></> : null}

          <Accordion title="Relationships" count={detail.relationships?.length || 0} summary="Related ITSM records">
            <div className="record-workbench-stack"><select value={relationshipType} onChange={(event) => setRelationshipType(event.target.value)}>{['related','caused-by','resolved-by','duplicates','blocks','blocked-by'].map((value) => <option value={value} key={value}>{value.replaceAll('-', ' ')}</option>)}</select><select value={relationshipReference} onChange={(event) => setRelationshipReference(event.target.value)}><option value="">Choose record</option>{(detail.options?.relatedRecords || []).map((record) => <option value={record.reference} key={`${record.type}-${record.reference}`}>{record.reference} · {record.title}</option>)}</select><button type="button" className="record-workbench-secondary" disabled={!relationshipReference || saving} onClick={addRelationship}><Link2 size={16} />Link record</button></div>
            <div className="record-workbench-mini-list">{(detail.relationships || []).map((item) => <div key={item.id}><span><strong>{item.targetReference}</strong><small>{item.targetType} · {item.relationshipType}</small></span><button type="button" onClick={() => removeRelationship(item.id)}><Trash2 size={15} /></button></div>)}</div>
          </Accordion>

          <Accordion title="Attachments" count={detail.attachments?.length || 0} summary="Files and evidence">
            <div className="record-workbench-stack"><input type="file" onChange={(event) => setAttachment(event.target.files?.[0] || null)} />{attachment ? <small>{attachment.name} · {formatBytes(attachment.size)}</small> : null}<button type="button" className="record-workbench-secondary" disabled={!attachment || saving} onClick={uploadAttachment}><Upload size={16} />Upload attachment</button></div>
            <div className="record-workbench-mini-list">{(detail.attachments || []).map((item) => <div key={item.id}><FileText size={17} /><span><strong>{item.fileName}</strong><small>{formatBytes(item.byteSize)} · {item.uploadedBy}</small></span><a href={`${API_BASE}/api/v1/itsm-lifecycle/${encodeURIComponent(detail.id)}/attachments/${encodeURIComponent(item.id)}`} target="_blank" rel="noreferrer"><Download size={15} /></a><button type="button" onClick={() => removeAttachment(item.id)}><Trash2 size={15} /></button></div>)}</div>
          </Accordion>
        </div>
      </aside>

      <main className="record-workbench-activity">
        <header><div><span>Timeline</span><h2>Activity</h2></div><em>{activities.length} update{activities.length === 1 ? '' : 's'}</em></header>
        <RichComposer editorRef={editorRef} visibility={activityVisibility} onVisibility={setActivityVisibility} disabled={saving} onPost={postActivity} />
        <div className="record-workbench-message-list">{activities.length ? activities.map((item) => <ActivityCard item={item} key={item.id} />) : <div className="record-workbench-empty">No activity yet.</div>}</div>
      </main>
    </div>
  </section>
}

export function ProductionGenericRecordWorkbench() {
  const [route, setRoute] = useState(routeState)
  const [target, setTarget] = useState(null)
  useEffect(() => {
    const update = () => setRoute(routeState())
    window.addEventListener('popstate', update); window.addEventListener('hi5-routechange', update)
    const timer = window.setInterval(update, 250)
    return () => { window.removeEventListener('popstate', update); window.removeEventListener('hi5-routechange', update); window.clearInterval(timer) }
  }, [])
  useEffect(() => {
    if (!route) { setTarget(null); document.querySelector('.content-frame')?.classList.remove('production-generic-workbench-mounted'); return undefined }
    let mounted = null
    const attach = () => { const node = document.querySelector('.content-frame'); if (!(node instanceof HTMLElement)) return false; mounted = node; node.classList.add('production-generic-workbench-mounted'); setTarget(node); return true }
    if (attach()) return () => mounted?.classList.remove('production-generic-workbench-mounted')
    const observer = new MutationObserver(() => { if (attach()) observer.disconnect() }); observer.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect(); mounted?.classList.remove('production-generic-workbench-mounted') }
  }, [route])
  const key = useMemo(() => route ? `${route.type}:${route.reference}` : 'none', [route])
  if (!route || !target) return null
  return createPortal(<Workbench key={key} route={route} />, target)
}
