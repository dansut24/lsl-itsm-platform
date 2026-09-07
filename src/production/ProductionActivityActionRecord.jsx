import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Bold,
  CheckCircle2,
  ChevronRight,
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
  PanelLeftOpen,
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
import './ProductionActivityCanvasRecord.css'
import './ProductionActivityActionRecord.css'

const API_BASE = 'https://api.hi5central.com'
const TYPES = { incidents: 'Incident', problems: 'Problem', changes: 'Change' }
const SAFE_TAGS = new Set(['P','BR','STRONG','B','EM','I','U','S','UL','OL','LI','BLOCKQUOTE','PRE','CODE','TABLE','THEAD','TBODY','TFOOT','TR','TH','TD','H1','H2','H3','H4','HR','A','SPAN'])
const DROP_TAGS = new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','FORM','INPUT','BUTTON','SVG','MATH','META','LINK'])
const SYSTEM_KINDS = new Set(['field_change', 'relationship', 'attachment'])
const ACTION_KINDS = new Set(['reassign', 'resolution', 'pending', 'task'])

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
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
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
    throw error
  }
  return payload
}

function fileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || '').split(',').pop() || '')
    reader.onerror = () => reject(reader.error || new Error('Could not read attachment.'))
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
        walk(child)
        child.replaceWith(...Array.from(child.childNodes))
        return
      }
      Array.from(child.attributes).forEach((attribute) => {
        const name = attribute.name.toLowerCase()
        const keep = (child.tagName === 'A' && ['href', 'title'].includes(name)) || (['TD','TH'].includes(child.tagName) && ['colspan','rowspan'].includes(name))
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
  return doc.body.innerHTML.slice(0, 45000)
}

function richPlainText(html = '') {
  if (!html || typeof DOMParser === 'undefined') return ''
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  return (doc.body.innerText || doc.body.textContent || '').trim().slice(0, 20000)
}

function formFor(detail) {
  const data = detail?.recordData || {}
  return {
    title: detail?.title || '', requesterId: detail?.requesterId || '', service: detail?.service || '', category: detail?.category || '',
    status: detail?.status || '', team: detail?.team || '', assignee: detail?.assignee || 'Unassigned', priority: detail?.priority || 'Medium',
    impact: detail?.impact || 'Medium', urgency: detail?.urgency || 'Medium', resolutionCode: detail?.resolutionCode || '', resolutionSummary: detail?.resolutionSummary || '',
    rootCause: data.rootCause || '', workaround: data.workaround || '', knownError: Boolean(data.knownError),
    changeType: data.changeType || 'Normal', risk: data.risk || detail?.priority || 'Medium', implementationPlan: data.implementationPlan || '',
    testPlan: data.testPlan || '', backoutPlan: data.backoutPlan || '', plannedStart: data.plannedStart || '', plannedEnd: data.plannedEnd || '',
  }
}

function Field({ label, children, hint }) {
  return <label className="activity-canvas-field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>
}

function SlaMetric({ label, metric }) {
  if (!metric) return null
  const percent = Math.min(100, Number(metric.percent || 0))
  const state = metric.state === 'met' ? 'Met' : metric.state === 'breached' ? 'Breached' : metric.state === 'warning' ? 'At risk' : 'On track'
  return <div className={`activity-canvas-sla is-${metric.state}`}><div><span>{label}</span><strong>{state}</strong></div><div className="activity-canvas-sla-track"><i style={{ width: `${percent}%` }} /></div><small><span>{metric.completedAt ? `Completed ${formatDate(metric.completedAt)}` : `Due ${relativeTime(metric.dueAt)}`}</span><span>{metric.percent}%</span></small></div>
}

function InspectorRow({ label, value, meta, count, onClick }) {
  return <button type="button" className="activity-canvas-inspector-row" onClick={onClick}><span><small>{label}</small><strong>{value || 'Not recorded'}</strong>{meta ? <em>{meta}</em> : null}</span>{count !== undefined ? <b>{count}</b> : null}<ChevronRight size={17} /></button>
}

async function copyActivity(item, html) {
  const plain = item.text || richPlainText(html)
  try {
    if (html && navigator.clipboard?.write && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })])
      return
    }
    await navigator.clipboard.writeText(plain)
  } catch { /* Clipboard can be denied. */ }
}

function activityLabel(item, kind) {
  if (item.kind === 'origin') return 'Original description'
  if (item.kind === 'reassign') return 'Reassigned'
  if (item.kind === 'resolution') return 'Resolved'
  if (item.kind === 'pending') return 'Set pending'
  if (item.kind === 'task') return 'Task created'
  if (kind === 'customer') return 'Customer visible'
  return 'Internal note'
}

function ActivityItem({ item }) {
  const html = sanitiseRichHtml(item.metadata?.richHtml || '')
  const changes = Array.isArray(item.metadata?.changes) ? item.metadata.changes : []
  const isOrigin = item.kind === 'origin'
  const isSystem = SYSTEM_KINDS.has(item.kind)
  const isAction = ACTION_KINDS.has(item.kind)
  const kind = isOrigin ? 'origin' : isSystem ? 'system' : isAction ? 'action' : item.visibility === 'customer' ? 'customer' : 'internal'

  if (kind === 'system') {
    return <div className="activity-canvas-system-event"><i /><div><span>{item.text}</span>{changes.length ? <small>{changes.map((change) => `${change.field}: ${String(change.from || '—')} → ${String(change.to || '—')}`).join(' · ')}</small> : null}</div><time>{formatDate(item.createdAt)}</time></div>
  }

  return <article className={`activity-canvas-message is-${kind}${item.visibility === 'customer' ? ' is-customer-action' : ''}`}>
    <div className="activity-canvas-avatar">{String(item.actor || 'H').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>
    <div className="activity-canvas-message-card">
      <header><div><strong>{item.actor || 'Hi5Central'}</strong><span>{formatDate(item.createdAt)}</span></div><div><em>{activityLabel(item, kind)}</em><button type="button" title="Copy update" onClick={() => copyActivity(item, html)}><Copy size={15} /></button></div></header>
      {html ? <div className="activity-canvas-rich-output" dangerouslySetInnerHTML={{ __html: html }} /> : <p>{item.text}</p>}
      {isAction && item.metadata?.action ? <div className="activity-action-meta">{item.kind === 'reassign' && changes.length ? changes.map((change) => <span key={change.field}><b>{change.field}</b>{String(change.from || '—')} → {String(change.to || '—')}</span>) : null}{item.kind === 'resolution' && item.metadata?.resolutionCode ? <span><b>Resolution</b>{item.metadata.resolutionCode}</span> : null}{item.kind === 'pending' && item.metadata?.toStatus ? <span><b>Status</b>{item.metadata.toStatus}</span> : null}{item.kind === 'task' && item.metadata?.title ? <span><b>Task</b>{item.metadata.title}</span> : null}</div> : null}
    </div>
  </article>
}

function FormattingToolbar({ editorRef }) {
  const command = (name, value = null) => { editorRef.current?.focus(); document.execCommand(name, false, value) }
  const insertTable = () => command('insertHTML', '<table><tbody><tr><th>Heading</th><th>Heading</th></tr><tr><td>Value</td><td>Value</td></tr></tbody></table><p><br></p>')
  return <div className="activity-canvas-toolbar" role="toolbar" aria-label="Update formatting"><button type="button" title="Bold" onClick={() => command('bold')}><Bold size={16} /></button><button type="button" title="Italic" onClick={() => command('italic')}><Italic size={16} /></button><button type="button" title="Underline" onClick={() => command('underline')}><Underline size={16} /></button><i /><button type="button" title="Bulleted list" onClick={() => command('insertUnorderedList')}><List size={16} /></button><button type="button" title="Numbered list" onClick={() => command('insertOrderedList')}><ListOrdered size={16} /></button><button type="button" title="Quote" onClick={() => command('formatBlock', 'blockquote')}><Quote size={16} /></button><button type="button" title="Code block" onClick={() => command('formatBlock', 'pre')}><Code2 size={16} /></button><button type="button" title="Table" onClick={insertTable}><Table2 size={16} /></button></div>
}

function ActionButton({ active, icon, children, onClick, disabled }) {
  return <button type="button" className={active ? 'is-active' : ''} onClick={onClick} disabled={disabled}>{icon}{children}</button>
}

function ActionComposer({
  open, mode, onMode, onOpen, onClose, editorRef, disabled, routeType, canResolve, people, teams, relatedRecords,
  onPostNote, onReassign, onResolve, onPending, onLink, onTask, onAttach,
}) {
  const [team, setTeam] = useState('')
  const [assignee, setAssignee] = useState('Unassigned')
  const [resolutionCode, setResolutionCode] = useState('')
  const [resolutionVisibility, setResolutionVisibility] = useState('customer')
  const [pendingStatus, setPendingStatus] = useState('Pending Customer')
  const [pendingVisibility, setPendingVisibility] = useState('customer')
  const [relationshipType, setRelationshipType] = useState('related')
  const [relationshipReference, setRelationshipReference] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskTeam, setTaskTeam] = useState('')
  const [taskAssignee, setTaskAssignee] = useState('Unassigned')
  const [taskDueAt, setTaskDueAt] = useState('')
  const [file, setFile] = useState(null)

  const choose = (next) => {
    onMode(next)
    onOpen()
    window.setTimeout(() => editorRef.current?.focus(), 0)
  }

  const richPayload = () => {
    const html = sanitiseRichHtml(editorRef.current?.innerHTML || '')
    return { html, text: richPlainText(html) }
  }

  const clearEditor = () => { if (editorRef.current) editorRef.current.innerHTML = '' }

  const submitTextAction = async (handler, values = {}) => {
    const rich = richPayload()
    const ok = await handler({ ...values, note: rich.text, richHtml: rich.html })
    if (ok) clearEditor()
  }

  const primaryModes = [
    ['internal', <MessageSquareText size={15} />, 'Internal note'],
    ['customer', <MessageSquareText size={15} />, 'Customer update'],
    ['reassign', <UserRoundCog size={15} />, 'Reassign'],
    ...(canResolve ? [['resolve', <CheckCircle2 size={15} />, 'Resolve']] : []),
  ]
  const secondaryModes = [
    ...(routeType === 'Incident' ? [['pending', <Clock3 size={15} />, 'Set pending']] : []),
    ['link', <Link2 size={15} />, 'Link record'],
    ['task', <FileText size={15} />, 'Add task'],
    ['attach', <Upload size={15} />, 'Attach file'],
  ]

  const actionStrip = <div className="activity-action-strip">
    {primaryModes.map(([value, icon, label]) => <ActionButton key={value} active={mode === value} icon={icon} onClick={() => choose(value)} disabled={disabled}>{label}</ActionButton>)}
    <i />
    {secondaryModes.map(([value, icon, label]) => <ActionButton key={value} active={mode === value} icon={icon} onClick={() => choose(value)} disabled={disabled}>{label}</ActionButton>)}
  </div>

  if (!open) return <div className="activity-action-dock">{actionStrip}<button type="button" className="activity-canvas-composer-collapsed" onClick={() => choose(mode || 'internal')}><MessageSquareText size={18} /><span>Add a note, customer update or take an action…</span><strong>Open composer</strong></button></div>

  const needsEditor = ['internal', 'customer', 'reassign', 'resolve', 'pending', 'task'].includes(mode)
  const placeholder = mode === 'reassign' ? 'Add a handoff note…' : mode === 'resolve' ? 'Add resolution notes…' : mode === 'pending' ? 'Why is this Incident being placed on hold?' : mode === 'task' ? 'Add task instructions…' : mode === 'customer' ? 'Write a customer-visible update…' : 'Write an internal note…'

  let fields = null
  if (mode === 'reassign') fields = <div className="activity-action-fields is-two"><Field label="Assignment group"><select value={team} onChange={(event) => setTeam(event.target.value)}><option value="">Unassigned team</option>{teams.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></Field><Field label="Assignee"><select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option>Unassigned</option>{people.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}</select></Field></div>
  if (mode === 'resolve') fields = <div className="activity-action-fields is-two">{routeType === 'Incident' ? <Field label="Resolution code"><select value={resolutionCode} onChange={(event) => setResolutionCode(event.target.value)}><option value="">Choose resolution</option>{['Fixed','Workaround','User education','Configuration change','Known error','Duplicate','No fault found','Other'].map((value) => <option key={value}>{value}</option>)}</select></Field> : <div />}<Field label="Resolution note visibility"><select value={resolutionVisibility} onChange={(event) => setResolutionVisibility(event.target.value)}><option value="customer">Customer visible</option><option value="internal">Internal only</option></select></Field></div>
  if (mode === 'pending') fields = <div className="activity-action-fields is-two"><Field label="Pending status"><select value={pendingStatus} onChange={(event) => setPendingStatus(event.target.value)}><option>Pending Customer</option><option>Pending Vendor</option></select></Field><Field label="Note visibility"><select value={pendingVisibility} onChange={(event) => setPendingVisibility(event.target.value)}><option value="customer">Customer visible</option><option value="internal">Internal only</option></select></Field></div>
  if (mode === 'link') fields = <div className="activity-action-fields is-two"><Field label="Relationship"><select value={relationshipType} onChange={(event) => setRelationshipType(event.target.value)}>{['related','caused-by','resolved-by','duplicates','blocks','blocked-by'].map((value) => <option value={value} key={value}>{value.replaceAll('-', ' ')}</option>)}</select></Field><Field label="Record"><select value={relationshipReference} onChange={(event) => setRelationshipReference(event.target.value)}><option value="">Choose record</option>{relatedRecords.map((record) => <option value={record.reference} key={`${record.type}-${record.reference}`}>{record.reference} · {record.title}</option>)}</select></Field></div>
  if (mode === 'task') fields = <div className="activity-action-fields is-task"><Field label="Task title"><input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="What needs to be done?" /></Field><Field label="Assignment group"><select value={taskTeam} onChange={(event) => setTaskTeam(event.target.value)}><option value="">Unassigned team</option>{teams.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></Field><Field label="Assignee"><select value={taskAssignee} onChange={(event) => setTaskAssignee(event.target.value)}><option>Unassigned</option>{people.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}</select></Field><Field label="Due"><input type="datetime-local" value={taskDueAt} onChange={(event) => setTaskDueAt(event.target.value)} /></Field></div>
  if (mode === 'attach') fields = <div className="activity-action-fields"><Field label="File"><input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} hint={file ? `${file.name} · ${formatBytes(file.size)}` : 'Maximum 5 MB'} /></div>

  let submitLabel = 'Add note'
  let submitIcon = <MessageSquareText size={16} />
  let submit = () => submitTextAction(onPostNote, { visibility: mode === 'customer' ? 'customer' : 'internal' })
  let submitDisabled = disabled
  if (mode === 'reassign') { submitLabel = 'Reassign'; submitIcon = <UserRoundCog size={16} />; submit = () => submitTextAction(onReassign, { team, assignee }) }
  if (mode === 'resolve') { submitLabel = routeType === 'Change' ? 'Complete change' : `Resolve ${routeType.toLowerCase()}`; submitIcon = <CheckCircle2 size={16} />; submit = () => submitTextAction(onResolve, { resolutionCode, visibility: resolutionVisibility }); submitDisabled = disabled || (routeType === 'Incident' && !resolutionCode) }
  if (mode === 'pending') { submitLabel = 'Set pending'; submitIcon = <Clock3 size={16} />; submit = () => submitTextAction(onPending, { status: pendingStatus, visibility: pendingVisibility }) }
  if (mode === 'link') { submitLabel = 'Link record'; submitIcon = <Link2 size={16} />; submit = () => onLink({ targetReference: relationshipReference, relationshipType }); submitDisabled = disabled || !relationshipReference }
  if (mode === 'task') { submitLabel = 'Create task'; submitIcon = <FileText size={16} />; submit = () => submitTextAction(onTask, { title: taskTitle, team: taskTeam, assignee: taskAssignee, dueAt: taskDueAt }); submitDisabled = disabled || taskTitle.trim().length < 2 }
  if (mode === 'attach') { submitLabel = 'Upload file'; submitIcon = <Upload size={16} />; submit = () => onAttach(file); submitDisabled = disabled || !file }

  return <section className="activity-canvas-composer-tray activity-action-composer">
    <div className="activity-action-composer-head">{actionStrip}<button type="button" onClick={onClose}><X size={17} />Close</button></div>
    {fields}
    {needsEditor ? <><FormattingToolbar editorRef={editorRef} /><div ref={editorRef} className="activity-canvas-editor" contentEditable suppressContentEditableWarning data-placeholder={placeholder} /></> : null}
    <footer><span>{mode === 'customer' ? 'Visible to requester' : mode === 'internal' ? 'Technicians only' : mode === 'resolve' ? (resolutionVisibility === 'customer' ? 'Resolution note visible to requester' : 'Resolution note is internal') : mode === 'pending' ? (pendingVisibility === 'customer' ? 'Pending note visible to requester' : 'Pending note is internal') : mode === 'reassign' ? 'Assignment and handoff are saved together' : mode === 'task' ? 'Task is linked to this record' : mode === 'link' ? 'Relationship is added to this record' : 'File is stored against this record'}</span><button type="button" className="activity-canvas-primary" disabled={submitDisabled} onClick={submit}>{submitIcon}{submitLabel}</button></footer>
  </section>
}

function Skeleton() {
  return <section className="activity-canvas-shell is-loading" aria-label="Loading record"><header className="activity-canvas-top"><div className="activity-canvas-skeleton is-heading" /><div className="activity-canvas-skeleton is-actions" /></header><div className="activity-canvas-skeleton is-ribbon" /><div className="activity-canvas-body"><aside><div className="activity-canvas-skeleton is-inspector" /></aside><main><div className="activity-canvas-skeleton is-activity-head" />{Array.from({ length: 5 }, (_, index) => <div className="activity-canvas-skeleton is-message" key={index} />)}<div className="activity-canvas-skeleton is-action-dock" /></main></div></section>
}

function Workbench({ route }) {
  const [detail, setDetail] = useState(null)
  const [tasks, setTasks] = useState([])
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [inspectorView, setInspectorView] = useState('home')
  const [mobileDetails, setMobileDetails] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerMode, setComposerMode] = useState('internal')
  const [activityFilter, setActivityFilter] = useState('all')
  const [relationshipReference, setRelationshipReference] = useState('')
  const [relationshipType, setRelationshipType] = useState('related')
  const [attachment, setAttachment] = useState(null)
  const editorRef = useRef(null)
  const listRef = useRef(null)

  async function load({ quiet = false } = {}) {
    if (!quiet) setLoading(true)
    setError('')
    try {
      const [payload, taskPayload] = await Promise.all([
        apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}`),
        apiJson(`/api/v1/itsm-actions/${encodeURIComponent(route.reference)}/tasks`).catch(() => ({ tasks: [] })),
      ])
      setDetail(payload); setForm(formFor(payload)); setTasks(taskPayload.tasks || [])
    } catch (loadError) { setError(loadError.message) } finally { if (!quiet) setLoading(false) }
  }

  useEffect(() => { void load() }, [route.reference, route.type])
  useEffect(() => {
    if (!detail?.id) return
    const timer = window.setTimeout(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight }, 0)
    return () => window.clearTimeout(timer)
  }, [detail?.id])

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
    await patchRecord({ title: form.title, requesterId: form.requesterId, service: form.service, category: form.category, status: form.status, team: form.team, assignee: form.assignee, priority: form.priority, impact: form.impact, urgency: form.urgency, resolutionCode: form.resolutionCode, resolutionSummary: form.resolutionSummary, recordData: recordData() }, { success: 'Record saved' })
  }

  async function autosaveTitle(value) {
    const title = value.trim()
    if (!title || title === detail.title) return
    await patchRecord({ title }, { success: 'Summary saved' })
  }

  async function changeStatus(status) {
    if (status === detail.status) return
    const patch = { status }
    if (route.type === 'Incident') { patch.resolutionCode = form.resolutionCode; patch.resolutionSummary = form.resolutionSummary }
    await patchRecord(patch, { success: `Status changed to ${status}` })
  }

  async function postNote({ visibility, note, richHtml }) {
    if (!note && !richHtml) return false
    setSaving(true); setError('')
    try {
      const payload = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/activity`, { method: 'POST', body: JSON.stringify({ text: note, visibility, metadata: richHtml ? { richHtml, format: 'rich' } : {} }) })
      setDetail(payload); setForm(formFor(payload)); setNotice(visibility === 'customer' ? 'Customer update sent' : 'Internal note added'); setComposerOpen(false)
      window.setTimeout(() => { if (listRef.current) listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }) }, 0)
      return true
    } catch (actionError) { setError(actionError.message); return false } finally { setSaving(false) }
  }

  async function atomicAction(action, body, success) {
    if (!detail) return false
    setSaving(true); setError(''); setNotice('')
    try {
      await apiJson(`/api/v1/itsm-actions/${encodeURIComponent(route.reference)}/${action}`, { method: 'POST', body: JSON.stringify({ version: detail.version, ...body, metadata: body.richHtml ? { richHtml: body.richHtml, format: 'rich' } : {} }) })
      await load({ quiet: true }); setNotice(success); setComposerOpen(false)
      window.setTimeout(() => { if (listRef.current) listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }) }, 0)
      return true
    } catch (actionError) { setError(actionError.status === 409 ? 'Another technician changed this record before you applied the action. Reload and try again.' : actionError.message); return false } finally { setSaving(false) }
  }

  async function quickLink({ targetReference, relationshipType: type }) {
    if (!targetReference) return false
    setSaving(true); setError('')
    try {
      const payload = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/relationships`, { method: 'POST', body: JSON.stringify({ targetReference, relationshipType: type }) })
      setDetail(payload); setForm(formFor(payload)); setNotice(`Linked ${targetReference}`); setComposerOpen(false); return true
    } catch (actionError) { setError(actionError.message); return false } finally { setSaving(false) }
  }

  async function quickAttach(file) {
    if (!file) return false
    if (file.size > 5 * 1024 * 1024) { setError('Attachments are limited to 5 MB each.'); return false }
    setSaving(true); setError('')
    try {
      const contentBase64 = await fileBase64(file)
      const payload = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/attachments`, { method: 'POST', body: JSON.stringify({ fileName: file.name, mimeType: file.type || 'application/octet-stream', contentBase64 }) })
      setDetail(payload); setForm(formFor(payload)); setNotice(`${file.name} attached`); setComposerOpen(false); return true
    } catch (actionError) { setError(actionError.message); return false } finally { setSaving(false) }
  }

  async function addRelationship() {
    if (!relationshipReference) return
    setSaving(true); setError('')
    try { const payload = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/relationships`, { method: 'POST', body: JSON.stringify({ targetReference: relationshipReference, relationshipType }) }); setDetail(payload); setForm(formFor(payload)); setRelationshipReference('') }
    catch (relationshipError) { setError(relationshipError.message) } finally { setSaving(false) }
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
    try { const contentBase64 = await fileBase64(attachment); const payload = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/attachments`, { method: 'POST', body: JSON.stringify({ fileName: attachment.name, mimeType: attachment.type || 'application/octet-stream', contentBase64 }) }); setDetail(payload); setForm(formFor(payload)); setAttachment(null) }
    catch (attachmentError) { setError(attachmentError.message) } finally { setSaving(false) }
  }

  async function removeAttachment(id) {
    setSaving(true); setError('')
    try { const payload = await apiJson(`/api/v1/itsm-lifecycle/${encodeURIComponent(route.reference)}/attachments/remove`, { method: 'POST', body: JSON.stringify({ attachmentId: id }) }); setDetail(payload); setForm(formFor(payload)) }
    catch (attachmentError) { setError(attachmentError.message) } finally { setSaving(false) }
  }

  if (loading) return <Skeleton />
  if (!detail) return <section className="activity-canvas-shell"><div className="activity-canvas-failure"><strong>Could not open this record</strong><span>{error}</span><button type="button" onClick={() => load()}>Retry</button></div></section>

  const people = detail.options?.people || []
  const teams = detail.options?.teams || []
  const origin = detail.description?.trim() ? { id: `origin-${detail.id}`, kind: 'origin', visibility: 'customer', actor: detail.requester || 'Original requester', text: detail.description.trim(), createdAt: detail.createdAt, metadata: {} } : null
  const activities = [...(origin ? [origin] : []), ...(detail.activities || [])].sort((a, b) => {
    const delta = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    if (delta !== 0) return delta
    if (a.kind === 'origin') return -1
    if (b.kind === 'origin') return 1
    return 0
  })
  const visibleActivities = activities.filter((item) => {
    if (activityFilter === 'all') return true
    if (activityFilter === 'system') return SYSTEM_KINDS.has(item.kind)
    if (activityFilter === 'customer') return item.kind === 'origin' || item.visibility === 'customer'
    return item.visibility === 'internal' && !SYSTEM_KINDS.has(item.kind)
  })
  const canResolve = route.type !== 'Change' ? !['Resolved','Closed'].includes(detail.status) : !['Completed','Cancelled'].includes(detail.status)
  const isDirty = JSON.stringify(form) !== JSON.stringify(formFor(detail))
  const slaState = detail.sla?.resolution?.state === 'breached' ? 'Breached' : detail.sla?.resolution?.state === 'warning' ? 'At risk' : detail.sla?.resolution?.state === 'met' ? 'Met' : 'On track'

  function inspectorContent() {
    if (inspectorView === 'home') return <>
      <div className="activity-canvas-inspector-facts">
        <InspectorRow label="Requester" value={detail.requester || 'Not recorded'} meta={detail.requesterEmail} onClick={() => setInspectorView('core')} />
        <InspectorRow label="Service" value={detail.service || 'Not recorded'} onClick={() => setInspectorView('core')} />
        <InspectorRow label="Category" value={detail.category || 'Not recorded'} onClick={() => setInspectorView('core')} />
        <InspectorRow label="Assignment" value={detail.team || 'Unassigned'} meta={detail.assignee || 'Unassigned'} onClick={() => setInspectorView('core')} />
      </div>
      {route.type === 'Incident' ? <><InspectorRow label="Classification" value={`${detail.priority} priority`} meta={`${detail.impact} impact · ${detail.urgency} urgency`} onClick={() => setInspectorView('classification')} /><InspectorRow label="SLA" value={slaState} meta={detail.sla?.resolution?.dueAt ? `Resolution due ${relativeTime(detail.sla.resolution.dueAt)}` : 'No target'} onClick={() => setInspectorView('classification')} /><InspectorRow label="Resolution" value={detail.resolutionCode || 'Not resolved'} onClick={() => setInspectorView('resolution')} /></> : null}
      {route.type === 'Problem' ? <InspectorRow label="Investigation" value={form.knownError ? 'Known error' : 'Root cause analysis'} onClick={() => setInspectorView('investigation')} /> : null}
      {route.type === 'Change' ? <><InspectorRow label="Assessment" value={`${form.changeType} · ${form.risk} risk`} onClick={() => setInspectorView('assessment')} /><InspectorRow label="Plans" value="Implementation / test / backout" onClick={() => setInspectorView('plans')} /></> : null}
      <InspectorRow label="Tasks" value="Record tasks" count={tasks.length} onClick={() => setInspectorView('tasks')} />
      <InspectorRow label="Relationships" value="Related records" count={detail.relationships?.length || 0} onClick={() => setInspectorView('relationships')} />
      <InspectorRow label="Attachments" value="Files and evidence" count={detail.attachments?.length || 0} onClick={() => setInspectorView('attachments')} />
    </>

    const back = <button type="button" className="activity-canvas-inspector-back" onClick={() => setInspectorView('home')}><ArrowLeft size={16} />Record details</button>
    if (inspectorView === 'core') return <>{back}<div className="activity-canvas-inspector-form"><Field label="Requester"><select value={form.requesterId} onChange={(event) => setForm((value) => ({ ...value, requesterId: event.target.value }))}><option value="">Not recorded</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.email}</option>)}</select></Field><Field label="Service"><input value={form.service} onChange={(event) => setForm((value) => ({ ...value, service: event.target.value }))} /></Field><Field label="Category"><input value={form.category} onChange={(event) => setForm((value) => ({ ...value, category: event.target.value }))} /></Field><Field label="Assignment group"><select value={form.team} onChange={(event) => setForm((value) => ({ ...value, team: event.target.value }))}><option value="">Unassigned team</option>{teams.map((team) => <option key={team.id} value={team.name}>{team.name}</option>)}</select></Field><Field label="Assignee"><select value={form.assignee} onChange={(event) => setForm((value) => ({ ...value, assignee: event.target.value }))}><option>Unassigned</option>{people.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}</select></Field></div></>
    if (inspectorView === 'classification') return <>{back}<div className="activity-canvas-inspector-form"><div className="activity-canvas-field-grid"><Field label="Impact"><select value={form.impact} onChange={(event) => setForm((value) => ({ ...value, impact: event.target.value }))}>{['Low','Medium','High'].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Urgency"><select value={form.urgency} onChange={(event) => setForm((value) => ({ ...value, urgency: event.target.value }))}>{['Low','Medium','High'].map((value) => <option key={value}>{value}</option>)}</select></Field></div><div className="activity-canvas-calculated"><span>Calculated priority</span><strong>{detail.priority}</strong></div><SlaMetric label="First response" metric={detail.sla?.response} /><SlaMetric label="Resolution" metric={detail.sla?.resolution} />{detail.sla?.paused ? <div className="activity-canvas-sla-paused"><Clock3 size={16} />Paused since {formatDate(detail.sla.pausedAt)}</div> : null}</div></>
    if (inspectorView === 'resolution') return <>{back}<div className="activity-canvas-inspector-form"><Field label="Resolution code"><select value={form.resolutionCode} onChange={(event) => setForm((value) => ({ ...value, resolutionCode: event.target.value }))}><option value="">Select resolution</option>{['Fixed','Workaround','User education','Configuration change','Known error','Duplicate','No fault found','Other'].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Resolution summary"><textarea rows="6" value={form.resolutionSummary} onChange={(event) => setForm((value) => ({ ...value, resolutionSummary: event.target.value }))} /></Field></div></>
    if (inspectorView === 'investigation') return <>{back}<div className="activity-canvas-inspector-form"><Field label="Known error"><select value={form.knownError ? 'Yes' : 'No'} onChange={(event) => setForm((value) => ({ ...value, knownError: event.target.value === 'Yes' }))}><option>No</option><option>Yes</option></select></Field><Field label="Root cause"><textarea rows="6" value={form.rootCause} onChange={(event) => setForm((value) => ({ ...value, rootCause: event.target.value }))} /></Field><Field label="Workaround"><textarea rows="6" value={form.workaround} onChange={(event) => setForm((value) => ({ ...value, workaround: event.target.value }))} /></Field></div></>
    if (inspectorView === 'assessment') return <>{back}<div className="activity-canvas-inspector-form"><Field label="Change type"><select value={form.changeType} onChange={(event) => setForm((value) => ({ ...value, changeType: event.target.value }))}>{['Standard','Normal','Emergency'].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Risk"><select value={form.risk} onChange={(event) => setForm((value) => ({ ...value, risk: event.target.value }))}>{['Low','Medium','High','Critical'].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Planned start"><input type="datetime-local" value={form.plannedStart} onChange={(event) => setForm((value) => ({ ...value, plannedStart: event.target.value }))} /></Field><Field label="Planned end"><input type="datetime-local" value={form.plannedEnd} onChange={(event) => setForm((value) => ({ ...value, plannedEnd: event.target.value }))} /></Field></div></>
    if (inspectorView === 'plans') return <>{back}<div className="activity-canvas-inspector-form"><Field label="Implementation plan"><textarea rows="7" value={form.implementationPlan} onChange={(event) => setForm((value) => ({ ...value, implementationPlan: event.target.value }))} /></Field><Field label="Test plan"><textarea rows="6" value={form.testPlan} onChange={(event) => setForm((value) => ({ ...value, testPlan: event.target.value }))} /></Field><Field label="Backout plan"><textarea rows="6" value={form.backoutPlan} onChange={(event) => setForm((value) => ({ ...value, backoutPlan: event.target.value }))} /></Field></div></>
    if (inspectorView === 'tasks') return <>{back}<div className="activity-canvas-mini-list activity-task-list">{tasks.length ? tasks.map((task) => <div key={task.id}><FileText size={17} /><span><strong>{task.title}</strong><small>{task.status} · {task.team || 'Unassigned'} / {task.assignee || 'Unassigned'}{task.dueAt ? ` · due ${formatDate(task.dueAt)}` : ''}</small></span></div>) : <div className="activity-canvas-empty">No tasks yet. Use Add task in the Activity action bar.</div>}</div></>
    if (inspectorView === 'relationships') return <>{back}<div className="activity-canvas-inspector-form"><Field label="Relationship"><select value={relationshipType} onChange={(event) => setRelationshipType(event.target.value)}>{['related','caused-by','resolved-by','duplicates','blocks','blocked-by'].map((value) => <option value={value} key={value}>{value.replaceAll('-', ' ')}</option>)}</select></Field><Field label="Record"><select value={relationshipReference} onChange={(event) => setRelationshipReference(event.target.value)}><option value="">Choose record</option>{(detail.options?.relatedRecords || []).map((record) => <option value={record.reference} key={`${record.type}-${record.reference}`}>{record.reference} · {record.title}</option>)}</select></Field><button type="button" className="activity-canvas-secondary" disabled={!relationshipReference || saving} onClick={addRelationship}><Link2 size={16} />Link record</button><div className="activity-canvas-mini-list">{(detail.relationships || []).map((item) => <div key={item.id}><span><strong>{item.targetReference}</strong><small>{item.targetType} · {item.relationshipType}</small></span><button type="button" onClick={() => removeRelationship(item.id)}><Trash2 size={15} /></button></div>)}</div></div></>
    if (inspectorView === 'attachments') return <>{back}<div className="activity-canvas-inspector-form"><Field label="Add attachment"><input type="file" onChange={(event) => setAttachment(event.target.files?.[0] || null)} /></Field>{attachment ? <small>{attachment.name} · {formatBytes(attachment.size)}</small> : null}<button type="button" className="activity-canvas-secondary" disabled={!attachment || saving} onClick={uploadAttachment}><Upload size={16} />Upload attachment</button><div className="activity-canvas-mini-list">{(detail.attachments || []).map((item) => <div key={item.id}><FileText size={17} /><span><strong>{item.fileName}</strong><small>{formatBytes(item.byteSize)} · {item.uploadedBy}</small></span><a href={`${API_BASE}/api/v1/itsm-lifecycle/${encodeURIComponent(detail.id)}/attachments/${encodeURIComponent(item.id)}`} target="_blank" rel="noreferrer"><Download size={15} /></a><button type="button" onClick={() => removeAttachment(item.id)}><Trash2 size={15} /></button></div>)}</div></div></>
    return null
  }

  return <section className="activity-canvas-shell production-motion-enter">
    <header className="activity-canvas-top"><div className="activity-canvas-title"><div><strong>{detail.id}</strong><span className={`activity-canvas-pill is-${slug(detail.status)}`}>{detail.status}</span><span className={`activity-canvas-pill is-${slug(detail.priority)}`}>{detail.priority}</span></div><input aria-label="Summary" value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} onBlur={(event) => autosaveTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} /></div><div className="activity-canvas-commands"><button type="button" className="activity-canvas-mobile-details" onClick={() => setMobileDetails(true)}><PanelLeftOpen size={17} />Details</button><label><span>Status</span><select disabled={saving} value={detail.status} onChange={(event) => changeStatus(event.target.value)}>{(detail.allowedStatuses || []).map((status) => <option key={status}>{status}</option>)}</select></label><button type="button" className="activity-canvas-icon" title="Reload latest" onClick={() => load({ quiet: true })}><RefreshCw size={17} /></button>{isDirty ? <button type="button" className="activity-canvas-primary" disabled={saving} onClick={saveAll}><Save size={17} />{saving ? 'Saving…' : 'Save'}</button> : null}</div></header>

    <div className="activity-canvas-ribbon"><span><b>Requester</b>{detail.requester || 'Not recorded'}</span><span><b>Service</b>{detail.service || '—'}</span><span><b>Category</b>{detail.category || '—'}</span><span><b>Assignment</b>{detail.team || 'Unassigned'} / {detail.assignee || 'Unassigned'}</span>{route.type === 'Incident' ? <><span><b>Priority</b>{detail.priority}</span><span className={`is-sla-${detail.sla?.resolution?.state || 'none'}`}><b>SLA</b>{slaState}</span></> : null}</div>

    {error ? <div className="activity-canvas-banner is-error"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={() => setError('')}><X size={15} /></button></div> : null}
    {notice ? <div className="activity-canvas-banner is-success"><CheckCircle2 size={17} /><span>{notice}</span><button type="button" onClick={() => setNotice('')}><X size={15} /></button></div> : null}

    <div className="activity-canvas-body">
      {mobileDetails ? <button type="button" className="activity-canvas-drawer-backdrop" aria-label="Close details" onClick={() => setMobileDetails(false)} /> : null}
      <aside className={`activity-canvas-inspector${mobileDetails ? ' is-mobile-open' : ''}`}><header><div><span>Record inspector</span><h2>{inspectorView === 'home' ? 'Details' : inspectorView.replace(/^./, (value) => value.toUpperCase())}</h2></div><button type="button" className="activity-canvas-drawer-close" onClick={() => setMobileDetails(false)}><X size={17} /></button></header><div className="activity-canvas-inspector-scroll">{inspectorContent()}</div>{isDirty ? <footer><button type="button" className="activity-canvas-primary" disabled={saving} onClick={saveAll}><Save size={16} />Save changes</button></footer> : null}</aside>

      <main className={`activity-canvas-activity${composerOpen ? ' has-composer' : ''}`}><header><div><span>Timeline</span><h2>Activity</h2></div><div className="activity-canvas-filters">{['all','internal','customer','system'].map((filter) => <button type="button" className={activityFilter === filter ? 'is-active' : ''} onClick={() => setActivityFilter(filter)} key={filter}>{filter[0].toUpperCase() + filter.slice(1)}</button>)}</div></header><div ref={listRef} className="activity-canvas-list">{visibleActivities.length ? visibleActivities.map((item) => <ActivityItem item={item} key={item.id} />) : <div className="activity-canvas-empty">No activity matches this filter.</div>}</div><ActionComposer open={composerOpen} mode={composerMode} onMode={setComposerMode} onOpen={() => setComposerOpen(true)} onClose={() => setComposerOpen(false)} editorRef={editorRef} disabled={saving} routeType={route.type} canResolve={canResolve} people={people} teams={teams} relatedRecords={detail.options?.relatedRecords || []} onPostNote={postNote} onReassign={(values) => atomicAction('reassign', values, 'Record reassigned')} onResolve={(values) => atomicAction('resolve', values, `${route.type} resolved`)} onPending={(values) => atomicAction('pending', values, 'Incident set to pending')} onLink={quickLink} onTask={(values) => atomicAction('tasks', values, 'Task created')} onAttach={quickAttach} /></main>
    </div>
  </section>
}

export function ProductionActivityActionRecord() {
  const [route, setRoute] = useState(routeState)
  const [target, setTarget] = useState(null)
  useEffect(() => {
    const update = () => setRoute(routeState())
    window.addEventListener('popstate', update); window.addEventListener('hi5-routechange', update)
    const timer = window.setInterval(update, 250)
    return () => { window.removeEventListener('popstate', update); window.removeEventListener('hi5-routechange', update); window.clearInterval(timer) }
  }, [])
  useEffect(() => {
    if (!route) { setTarget(null); document.querySelector('.content-frame')?.classList.remove('production-activity-canvas-mounted'); return undefined }
    let mounted = null
    const attach = () => { const node = document.querySelector('.content-frame'); if (!(node instanceof HTMLElement)) return false; mounted = node; node.classList.add('production-activity-canvas-mounted'); setTarget(node); return true }
    if (attach()) return () => mounted?.classList.remove('production-activity-canvas-mounted')
    const observer = new MutationObserver(() => { if (attach()) observer.disconnect() }); observer.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect(); mounted?.classList.remove('production-activity-canvas-mounted') }
  }, [route])
  const key = useMemo(() => route ? `${route.type}:${route.reference}` : 'none', [route])
  if (!route || !target) return null
  return createPortal(<Workbench key={key} route={route} />, target)
}
