import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  Columns3,
  ExternalLink,
  Filter,
  LayoutGrid,
  List,
  ListChecks,
  PanelLeftOpen,
  PlayCircle,
  RefreshCw,
  Search,
  TableProperties,
  X,
} from 'lucide-react'
import './ProductionItsmWorkspace.css'
import './ProductionItsmWorkspaceEnhancements.css'
import './ProductionActivityCanvasRecord.css'
import './ProductionActivityActionRecord.css'
import './ProductionTaskExperience.css'

const API_BASE = window.__HI5_API_BASE__
const PAGE_SIZES = [25, 50, 100]
const VIEW_STYLES = [
  { id: 'table', label: 'Table', icon: TableProperties },
  { id: 'compact', label: 'Compact', icon: List },
  { id: 'cards', label: 'Cards', icon: LayoutGrid },
]
const COLUMNS = [
  { key: 'reference', label: 'Reference', width: 150, locked: true },
  { key: 'summary', label: 'Summary', width: 260, locked: true },
  { key: 'priority', label: 'Priority / risk', width: 120 },
  { key: 'status', label: 'Status', width: 140 },
  { key: 'requester', label: 'Requester', width: 160 },
  { key: 'service', label: 'Service', width: 145 },
  { key: 'assignment', label: 'Assignment', width: 190 },
  { key: 'updated', label: 'Updated', width: 150 },
]
const DEFAULT_FILTERS = { status: 'All', priority: 'All', team: 'All', assignee: 'All', service: 'All', __view: 'all' }

function routeFromPath(pathname = window.location.pathname) {
  if (pathname === '/tasks' || pathname === '/tasks/') return { kind: 'list' }
  const match = pathname.match(/^\/tasks\/([^/]+)\/?$/i)
  return match ? { kind: 'detail', taskKey: decodeURIComponent(match[1]).toUpperCase() } : null
}

function navigate(path) {
  if (window.location.pathname === path) return
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.dispatchEvent(new CustomEvent('hi5-routechange', { detail: { path } }))
}

async function apiJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`)
  return payload
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function readSessionName() {
  try { return JSON.parse(window.localStorage.getItem('hi5central-production-session-v1') || '{}')?.name || '' } catch { return '' }
}

function statusClass(value = '') {
  return `is-${String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function priorityClass(value = '') {
  return `is-${String(value).toLowerCase().replace(/\s+/g, '-')}`
}

function taskRecord(task) {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.primaryRequest?.priority || 'Medium',
    requester: task.primaryRequest?.requester || 'Not recorded',
    service: task.primaryRequest?.service || 'Unclassified',
    team: task.team || 'Unassigned team',
    assignee: task.assignee || 'Unassigned',
    updatedAt: task.updatedAt,
    primaryRequest: task.primaryRequest?.id || '',
    dueAt: task.dueAt,
  }
}

function TaskNavButton({ target }) {
  if (!target) return null
  return createPortal(
    <button
      type="button"
      className={window.location.pathname.startsWith('/tasks') ? 'production-task-nav is-active' : 'production-task-nav'}
      onClick={() => navigate('/tasks')}
    >
      <ListChecks size={16} aria-hidden="true" />
      <span>Tasks</span>
    </button>,
    target,
  )
}

function AwaitingApprovalButton({ target, statusSelect }) {
  if (!target || !statusSelect) return null
  const active = statusSelect.value === 'Pending Approval'
  return createPortal(
    <button
      type="button"
      className={active ? 'is-active production-awaiting-approval-view' : 'production-awaiting-approval-view'}
      onClick={() => {
        statusSelect.value = 'Pending Approval'
        statusSelect.dispatchEvent(new Event('change', { bubbles: true }))
      }}
    >Awaiting approval</button>,
    target,
  )
}

function useWorkspaceTargets(taskRoute) {
  const [content, setContent] = useState(null)
  const [nav, setNav] = useState(null)
  const [approvalTarget, setApprovalTarget] = useState(null)
  const [approvalSelect, setApprovalSelect] = useState(null)

  useEffect(() => {
    const find = () => {
      setContent(taskRoute ? document.querySelector('.content-frame') : null)
      const serviceDesk = [...document.querySelectorAll('.nav-group')].find((node) => node.querySelector('.nav-group-title')?.textContent?.trim() === 'Service Desk')
      setNav(serviceDesk?.querySelector('.nav-items') || null)

      if (window.location.pathname === '/requests' || window.location.pathname === '/requests/') {
        const shell = [...document.querySelectorAll('.production-record-shell')].find((node) => node.querySelector('.production-record-filter-heading strong')?.textContent?.trim() === 'Service Requests')
        const viewList = shell?.querySelector('.production-record-view-list') || null
        const fields = [...(shell?.querySelectorAll('.production-record-filter-field') || [])]
        const statusField = fields.find((field) => field.querySelector('span')?.textContent?.trim() === 'Status')
        setApprovalTarget(viewList)
        setApprovalSelect(statusField?.querySelector('select') || null)
      } else {
        setApprovalTarget(null)
        setApprovalSelect(null)
      }
    }

    find()
    const observer = new MutationObserver(find)
    observer.observe(document.body, { childList: true, subtree: true })
    const timer = window.setInterval(find, 500)
    return () => { observer.disconnect(); window.clearInterval(timer) }
  }, [taskRoute])

  return { content, nav, approvalTarget, approvalSelect }
}

function FilterSelect({ label, value, options, onChange }) {
  return <label className="production-record-filter-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option>All</option>{(options || []).filter((option) => option && option !== 'All').map((option) => <option key={option}>{option}</option>)}</select></label>
}

function TaskFilters({ payload, filters, onChange, onClear }) {
  const sessionName = readSessionName()
  const quickViews = [
    ['all', 'All active'],
    ['mine', 'Assigned to me'],
    ['unassigned', 'Unassigned'],
    ['blocked', 'Blocked'],
    ['completed', 'Completed'],
  ]

  function quick(id) {
    if (id === 'mine') onChange({ ...DEFAULT_FILTERS, __view: id, assignee: sessionName || 'All' })
    else if (id === 'unassigned') onChange({ ...DEFAULT_FILTERS, __view: id, assignee: 'Unassigned' })
    else if (id === 'blocked') onChange({ ...DEFAULT_FILTERS, __view: id, status: 'Blocked' })
    else if (id === 'completed') onChange({ ...DEFAULT_FILTERS, __view: id, status: 'Completed' })
    else onChange({ ...DEFAULT_FILTERS })
  }

  const options = payload.filters || {}
  return <div className="production-record-filter-content">
    <section>
      <span className="production-record-filter-label">Views</span>
      <div className="production-record-view-list">
        {quickViews.map(([id, label]) => <button type="button" key={id} className={filters.__view === id ? 'is-active' : ''} onClick={() => quick(id)}>{label}</button>)}
      </div>
    </section>
    <section>
      <span className="production-record-filter-label">Filters</span>
      <FilterSelect label="Status" value={filters.status} options={options.statuses} onChange={(value) => onChange({ ...filters, status: value, __view: 'custom' })} />
      <FilterSelect label="Priority / risk" value={filters.priority} options={options.priorities} onChange={(value) => onChange({ ...filters, priority: value, __view: 'custom' })} />
      <FilterSelect label="Assignment group" value={filters.team} options={options.teams} onChange={(value) => onChange({ ...filters, team: value, __view: 'custom' })} />
      <FilterSelect label="Assignee" value={filters.assignee} options={options.assignees} onChange={(value) => onChange({ ...filters, assignee: value, __view: 'custom' })} />
      <FilterSelect label="Service" value={filters.service} options={options.services} onChange={(value) => onChange({ ...filters, service: value, __view: 'custom' })} />
      <button className="production-record-clear" type="button" onClick={onClear}>Clear filters</button>
    </section>
  </div>
}

function renderCell(record, key) {
  if (key === 'reference') return <strong className="production-record-reference">{record.id}</strong>
  if (key === 'summary') return <><strong>{record.title}</strong><small>{record.primaryRequest ? `Primary ${record.primaryRequest}` : 'Workflow task'}</small></>
  if (key === 'priority') return <span className={`production-record-priority ${priorityClass(record.priority)}`}>{record.priority}</span>
  if (key === 'status') return <span className={`production-record-status ${statusClass(record.status)}`}>{record.status}</span>
  if (key === 'requester') return <span>{record.requester}</span>
  if (key === 'service') return <span>{record.service}</span>
  if (key === 'assignment') return <span className="production-task-assignment"><strong>{record.team}</strong><small>{record.assignee}</small></span>
  if (key === 'updated') return <span>{formatDate(record.updatedAt)}</span>
  return null
}

function TaskTable({ items, columns, onOpen }) {
  return <div className="production-record-table-wrap"><table className="production-record-table production-record-table-enhanced"><colgroup>{columns.map((column) => <col key={column.key} style={{ width: `${column.width}px` }} />)}</colgroup><thead><tr>{columns.map((column) => <th key={column.key}><span>{column.label}</span></th>)}</tr></thead><tbody>{items.map((record) => <tr key={record.id} onClick={() => onOpen(record)}>{columns.map((column) => <td key={column.key}>{renderCell(record, column.key)}</td>)}</tr>)}</tbody></table></div>
}

function TaskCompactList({ items, onOpen }) {
  return <div className="production-record-compact-list">{items.map((record) => <button key={record.id} onClick={() => onOpen(record)} type="button"><strong>{record.id}</strong><span>{record.title}</span><span className={`production-record-priority ${priorityClass(record.priority)}`}>{record.priority}</span><span className={`production-record-status ${statusClass(record.status)}`}>{record.status}</span><small>{record.team} · {record.assignee}</small><small>{formatDate(record.updatedAt)}</small><ChevronRight size={15} /></button>)}</div>
}

function TaskCardList({ items, onOpen }) {
  return <div className="production-record-card-list">{items.map((record) => <article className="production-record-card production-record-card-enhanced" key={record.id}><button className="production-record-card-open" type="button" onClick={() => onOpen(record)}><div><strong>{record.id}</strong><span className={`production-record-priority ${priorityClass(record.priority)}`}>{record.priority}</span></div><h3>{record.title}</h3><div className="production-record-card-state"><span className={`production-record-status ${statusClass(record.status)}`}>{record.status}</span><span>{record.service}</span></div><dl><div><dt>Requester</dt><dd>{record.requester}</dd></div><div><dt>Assignment</dt><dd>{record.team} · {record.assignee}</dd></div></dl><footer><span>{record.primaryRequest ? `Primary ${record.primaryRequest}` : `Updated ${formatDate(record.updatedAt)}`}</span><ChevronRight size={16} /></footer></button></article>)}</div>
}

function TaskQueue() {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS })
  const [viewStyle, setViewStyle] = useState(window.matchMedia?.('(max-width: 720px)').matches ? 'cards' : 'table')
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(0)
  const [payload, setPayload] = useState({ items: [], total: 0, filters: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [mobileFilters, setMobileFilters] = useState(false)
  const [hiddenColumns, setHiddenColumns] = useState([])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize) })
    if (query.trim()) params.set('search', query.trim())
    for (const key of ['status', 'priority', 'team', 'assignee', 'service']) {
      if (filters[key] && filters[key] !== 'All') params.set(key, filters[key])
    }
    apiJson(`/api/v1/tasks?${params}`)
      .then((next) => { if (active) setPayload(next) })
      .catch((loadError) => { if (active) setError(loadError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filters, page, pageSize, query, revision])

  const records = useMemo(() => (payload.items || []).map(taskRecord), [payload.items])
  const columns = COLUMNS.filter((column) => column.locked || !hiddenColumns.includes(column.key))
  const total = Number(payload.total || 0)
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const start = total ? page * pageSize + 1 : 0
  const end = Math.min((page + 1) * pageSize, total)
  const ActiveViewIcon = VIEW_STYLES.find((item) => item.id === viewStyle)?.icon || TableProperties
  const changeFilters = (next) => { setFilters(next); setPage(0) }
  const clearFilters = () => { setFilters({ ...DEFAULT_FILTERS }); setPage(0) }

  return <section className="production-task-experience production-record-shell production-motion-enter production-record-shell-enhanced">
    <aside className="production-record-filter-rail"><div className="production-record-filter-heading"><span>Queue</span><strong>Tasks</strong></div><TaskFilters payload={payload} filters={filters} onChange={changeFilters} onClear={clearFilters} /></aside>

    <main className="production-record-main">
      <div className="production-record-toolbar">
        <button className="production-record-filter-trigger" type="button" onClick={() => setMobileFilters(true)}><Filter size={15} />Filters</button>
        <label className="production-record-search"><Search size={17} /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0) }} placeholder="Search tasks..." /></label>
        <button className="production-record-refresh" type="button" title="Refresh" onClick={() => setRevision((value) => value + 1)}><RefreshCw size={16} /></button>
        <label className="production-record-view-select"><ActiveViewIcon size={15} /><select value={viewStyle} onChange={(event) => setViewStyle(event.target.value)}>{VIEW_STYLES.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}</select></label>
        {viewStyle === 'table' ? <details className="production-record-columns-menu"><summary><Columns3 size={15} /><span>Columns</span><ChevronDown size={13} /></summary><div><header><strong>Columns</strong><small>Choose visible fields</small></header>{COLUMNS.map((column) => { const visible = column.locked || !hiddenColumns.includes(column.key); return <button type="button" key={column.key} className={visible ? 'is-visible' : ''} disabled={column.locked} onClick={() => setHiddenColumns((current) => current.includes(column.key) ? current.filter((key) => key !== column.key) : [...current, column.key])}><span>{column.label}</span><i>{visible ? <Check size={13} /> : null}</i></button> })}</div></details> : null}
      </div>

      <div className="production-record-result-line"><span><strong>{total}</strong> {total === 1 ? 'task' : 'tasks'}</span><span>{start}–{end} of {total}</span></div>

      <div className="production-record-content">
        {loading ? <div className="production-record-state"><strong>Loading tasks…</strong><span>Checking the ready work queue.</span></div> : null}
        {!loading && error ? <div className="production-record-state is-error"><strong>Could not load this queue</strong><span>{error}</span><button type="button" onClick={() => setRevision((value) => value + 1)}>Retry</button></div> : null}
        {!loading && !error && !records.length ? <div className="production-record-state"><strong>No tasks in this view</strong><span>Waiting workflow steps stay hidden until their dependencies are complete.</span></div> : null}
        {!loading && !error && records.length ? <div className="production-motion-enter production-motion-enter-fast">{viewStyle === 'compact' ? <TaskCompactList items={records} onOpen={(record) => navigate(`/tasks/${encodeURIComponent(record.id)}`)} /> : viewStyle === 'cards' ? <TaskCardList items={records} onOpen={(record) => navigate(`/tasks/${encodeURIComponent(record.id)}`)} /> : <TaskTable items={records} columns={columns} onOpen={(record) => navigate(`/tasks/${encodeURIComponent(record.id)}`)} />}</div> : null}
      </div>

      <footer className="production-record-pagination"><label>Rows <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}>{PAGE_SIZES.map((size) => <option key={size}>{size}</option>)}</select></label><span>Page {Math.min(page + 1, pageCount)} of {pageCount}</span><div><button disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} type="button"><ChevronLeft size={15} /></button><button disabled={page >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} type="button"><ChevronRight size={15} /></button></div></footer>
    </main>

    {mobileFilters ? <><button className="production-record-filter-backdrop" aria-label="Close filters" type="button" onClick={() => setMobileFilters(false)} /><aside className="production-record-mobile-filter production-motion-drawer"><header><div><span>Queue filters</span><strong>Tasks</strong></div><button type="button" onClick={() => setMobileFilters(false)}><X size={17} /></button></header><TaskFilters payload={payload} filters={filters} onChange={(next) => { changeFilters(next); setMobileFilters(false) }} onClear={clearFilters} /></aside></> : null}
  </section>
}

function Field({ label, children, hint }) {
  return <label className="activity-canvas-field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>
}

function InspectorRow({ label, value, meta, onClick }) {
  return <button type="button" className="activity-canvas-inspector-row" onClick={onClick}><span><small>{label}</small><strong>{value || 'Not recorded'}</strong>{meta ? <em>{meta}</em> : null}</span><ChevronRight size={17} /></button>
}

function TaskDetail({ taskKey }) {
  const [task, setTask] = useState(null)
  const [organisation, setOrganisation] = useState({ people: [], teams: [] })
  const [team, setTeam] = useState('')
  const [assignee, setAssignee] = useState('Unassigned')
  const [completionNotes, setCompletionNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [inspectorView, setInspectorView] = useState('home')
  const [mobileDetails, setMobileDetails] = useState(false)

  async function load({ quiet = false } = {}) {
    if (!quiet) setLoading(true)
    setError('')
    try {
      const [nextTask, nextOrganisation] = await Promise.all([
        apiJson(`/api/v1/tasks/${encodeURIComponent(taskKey)}`),
        apiJson('/api/v1/organisation').catch(() => ({ people: [], teams: [] })),
      ])
      setTask(nextTask)
      setOrganisation(nextOrganisation)
      setTeam(nextTask.team || '')
      setAssignee(nextTask.assignee || 'Unassigned')
      setCompletionNotes(nextTask.completionNotes || '')
    } catch (loadError) { setError(loadError.message) } finally { if (!quiet) setLoading(false) }
  }

  useEffect(() => { void load() }, [taskKey])

  async function patch(body, success) {
    setSaving(true); setError(''); setNotice('')
    try {
      const next = await apiJson(`/api/v1/tasks/${encodeURIComponent(taskKey)}`, { method: 'PATCH', body: JSON.stringify(body) })
      setTask(next); setTeam(next.team || ''); setAssignee(next.assignee || 'Unassigned'); setCompletionNotes(next.completionNotes || '')
      if (success) setNotice(success)
      return true
    } catch (saveError) { setError(saveError.message); return false } finally { setSaving(false) }
  }

  if (loading) return <section className="production-task-experience activity-canvas-shell is-loading" aria-label="Loading task"><header className="activity-canvas-top"><div className="activity-canvas-skeleton is-heading" /><div className="activity-canvas-skeleton is-actions" /></header><div className="activity-canvas-skeleton is-ribbon" /><div className="activity-canvas-body"><aside><div className="activity-canvas-skeleton is-inspector" /></aside><main><div className="activity-canvas-skeleton is-activity-head" /><div className="activity-canvas-skeleton is-message" /><div className="activity-canvas-skeleton is-message" /><div className="activity-canvas-skeleton is-action-dock" /></main></div></section>
  if (!task) return <section className="production-task-experience activity-canvas-shell"><div className="activity-canvas-failure"><strong>Could not open this task</strong><span>{error}</span><button type="button" onClick={() => load()}>Retry</button></div></section>

  const people = organisation.people || []
  const teams = organisation.teams || []
  const completed = task.status === 'Completed'
  const assignmentDirty = team !== (task.team || '') || assignee !== (task.assignee || 'Unassigned')
  const parent = task.primaryRequest || {}

  function inspectorContent() {
    if (inspectorView === 'home') return <>
      <div className="activity-canvas-inspector-facts">
        <InspectorRow label="Primary request" value={parent.id} meta={parent.title} onClick={() => setInspectorView('parent')} />
        <InspectorRow label="Requester" value={parent.requester || 'Not recorded'} meta={parent.requesterEmail} onClick={() => setInspectorView('parent')} />
        <InspectorRow label="Service" value={parent.service || 'Not recorded'} onClick={() => setInspectorView('parent')} />
        <InspectorRow label="Assignment" value={task.team || 'Unassigned'} meta={task.assignee || 'Unassigned'} onClick={() => setInspectorView('assignment')} />
      </div>
      <InspectorRow label="Dependencies" value={task.dependencies?.length ? `${task.dependencies.length} prerequisite${task.dependencies.length === 1 ? '' : 's'}` : 'No prerequisites'} onClick={() => setInspectorView('dependencies')} />
      <InspectorRow label="Completion" value={completed ? 'Completed' : 'Work in progress'} meta={completed ? formatDate(task.completedAt) : task.dueAt ? `Due ${formatDate(task.dueAt)}` : 'No due date'} onClick={() => setInspectorView('completion')} />
    </>

    const back = <button type="button" className="activity-canvas-inspector-back" onClick={() => setInspectorView('home')}><ArrowLeft size={16} />Task details</button>
    if (inspectorView === 'assignment') return <>{back}<div className="activity-canvas-inspector-form"><Field label="Assignment group"><select disabled={completed || saving} value={team} onChange={(event) => setTeam(event.target.value)}><option value="">Unassigned team</option>{teams.map((item) => <option key={item.id || item.name} value={item.name}>{item.name}</option>)}</select></Field><Field label="Assignee"><select disabled={completed || saving} value={assignee} onChange={(event) => setAssignee(event.target.value)}><option>Unassigned</option>{people.map((person) => <option key={person.id || person.email} value={person.name}>{person.name}{person.email ? ` · ${person.email}` : ''}</option>)}</select></Field>{assignmentDirty && !completed ? <button className="activity-canvas-primary" type="button" disabled={saving} onClick={() => patch({ team, assignee }, 'Assignment saved')}><Check size={16} />Save assignment</button> : null}</div></>
    if (inspectorView === 'dependencies') return <>{back}<div className="activity-canvas-mini-list">{task.dependencies?.length ? task.dependencies.map((dependency) => <div key={dependency}><ListChecks size={17} /><span><strong>{dependency}</strong><small>Completed before this task became available</small></span></div>) : <div className="activity-canvas-empty">This task has no prerequisites.</div>}</div></>
    if (inspectorView === 'parent') return <>{back}<div className="activity-canvas-inspector-facts"><InspectorRow label="Request" value={parent.id} meta={parent.title} onClick={() => navigate(`/requests/${encodeURIComponent(parent.id)}`)} /><InspectorRow label="Status" value={parent.status} meta={`${parent.priority || 'Medium'} priority`} /><InspectorRow label="Requester" value={parent.requester || 'Not recorded'} meta={parent.requesterEmail} /><InspectorRow label="Service" value={parent.service || 'Not recorded'} meta={parent.team || 'Unassigned team'} /></div></>
    if (inspectorView === 'completion') return <>{back}<div className="activity-canvas-inspector-form"><Field label="Completion notes" hint={completed ? `Completed ${formatDate(task.completedAt)}` : 'Required before completing this task'}><textarea rows="8" disabled={completed || saving} value={completionNotes} onChange={(event) => setCompletionNotes(event.target.value)} placeholder="Record what was completed and any relevant outcome…" /></Field>{completed ? null : <button className="activity-canvas-primary" type="button" disabled={saving || !completionNotes.trim()} onClick={() => patch({ status: 'Completed', completionNotes }, 'Task completed')}><CheckCircle2 size={16} />Complete task</button>}</div></>
    return null
  }

  return <section className="production-task-experience activity-canvas-shell production-motion-enter">
    <header className="activity-canvas-top">
      <div className="activity-canvas-title"><div><strong>{task.id}</strong><span className={`activity-canvas-pill ${statusClass(task.status)}`}>{task.status}</span><span className={`activity-canvas-pill ${priorityClass(parent.priority || 'Medium')}`}>{parent.priority || 'Medium'}</span></div><input aria-label="Summary" value={task.title} readOnly /></div>
      <div className="activity-canvas-commands">
        <button type="button" className="activity-canvas-mobile-details" onClick={() => setMobileDetails(true)}><PanelLeftOpen size={17} />Details</button>
        <label><span>Status</span><select value={task.status} disabled={saving || completed} onChange={(event) => { const value = event.target.value; if (value === 'In Progress') void patch({ status: value }, 'Task started'); else if (value === 'Blocked') void patch({ status: value }, 'Task blocked'); else if (value === 'Ready') void patch({ status: value }, 'Task returned to Ready') }}><option>Ready</option><option>In Progress</option><option>Blocked</option>{completed ? <option>Completed</option> : null}</select></label>
        <button type="button" className="activity-canvas-icon" title="Reload latest" onClick={() => load({ quiet: true })}><RefreshCw size={17} /></button>
        <button type="button" className="activity-canvas-primary production-task-open-primary" onClick={() => navigate(`/requests/${encodeURIComponent(parent.id)}`)}><ExternalLink size={16} />Open primary request</button>
      </div>
    </header>

    <div className="activity-canvas-ribbon"><span><b>Primary request</b>{parent.id || '—'}</span><span><b>Requester</b>{parent.requester || 'Not recorded'}</span><span><b>Service</b>{parent.service || '—'}</span><span><b>Assignment</b>{task.team || 'Unassigned'} / {task.assignee || 'Unassigned'}</span><span><b>Priority</b>{parent.priority || 'Medium'}</span><span><b>Due</b>{task.dueAt ? formatDate(task.dueAt) : 'No due date'}</span></div>

    {error ? <div className="activity-canvas-banner is-error"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={() => setError('')}><X size={15} /></button></div> : null}
    {notice ? <div className="activity-canvas-banner is-success"><CheckCircle2 size={17} /><span>{notice}</span><button type="button" onClick={() => setNotice('')}><X size={15} /></button></div> : null}

    <div className="activity-canvas-body">
      {mobileDetails ? <button type="button" className="activity-canvas-drawer-backdrop" aria-label="Close details" onClick={() => setMobileDetails(false)} /> : null}
      <aside className={`activity-canvas-inspector${mobileDetails ? ' is-mobile-open' : ''}`}><header><div><span>Record inspector</span><h2>{inspectorView === 'home' ? 'Task details' : inspectorView.replace(/^./, (value) => value.toUpperCase())}</h2></div><button type="button" className="activity-canvas-drawer-close" onClick={() => setMobileDetails(false)}><X size={17} /></button></header><div className="activity-canvas-inspector-scroll">{inspectorContent()}</div></aside>

      <main className="activity-canvas-activity production-task-workspace"><header><div><span>Work</span><h2>Task activity</h2></div></header><div className="activity-canvas-list production-task-work-list"><article className="activity-canvas-message is-internal"><div className="activity-canvas-avatar"><ListChecks size={17} /></div><div className="activity-canvas-message-card"><header><div><strong>Task instructions</strong><span>{formatDate(task.createdAt)}</span></div><div><em>Internal fulfilment</em></div></header><p>{task.instructions || 'No additional instructions were supplied for this task.'}</p></div></article>{completed ? <div className="activity-canvas-system-event"><i /><div><span>Task completed.</span>{task.completionNotes ? <small>{task.completionNotes}</small> : null}</div><time>{formatDate(task.completedAt)}</time></div> : null}</div>

        {!completed ? <div className="activity-action-dock production-task-action-dock"><div className="activity-action-strip"><button type="button" className={task.status === 'In Progress' ? 'is-active' : ''} disabled={saving} onClick={() => patch({ status: 'In Progress' }, 'Task started')}><PlayCircle size={15} />Start</button><button type="button" className={task.status === 'Blocked' ? 'is-active' : ''} disabled={saving} onClick={() => patch({ status: 'Blocked' }, 'Task blocked')}><CircleStop size={15} />Block</button><i /><button type="button" disabled={saving || !completionNotes.trim()} onClick={() => patch({ status: 'Completed', completionNotes }, 'Task completed')}><CheckCircle2 size={15} />Complete</button></div><div className="production-task-completion-composer"><Field label="Completion notes" hint="Technician-only fulfilment detail; completing the task does not email the requester."><textarea rows="3" value={completionNotes} disabled={saving} onChange={(event) => setCompletionNotes(event.target.value)} placeholder="Record the completed work before finishing this task…" /></Field></div></div> : null}
      </main>
    </div>
  </section>
}

export function ProductionTaskExperience() {
  const [taskRoute, setTaskRoute] = useState(() => routeFromPath())
  const targets = useWorkspaceTargets(taskRoute)

  useEffect(() => {
    const update = () => setTaskRoute(routeFromPath())
    window.addEventListener('popstate', update)
    window.addEventListener('hi5-routechange', update)
    const timer = window.setInterval(update, 250)
    return () => { window.removeEventListener('popstate', update); window.removeEventListener('hi5-routechange', update); window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    const node = targets.content
    if (!(node instanceof HTMLElement) || !taskRoute) return undefined
    node.classList.add('production-task-mounted')
    return () => node.classList.remove('production-task-mounted')
  }, [targets.content, taskRoute])

  return <>
    <TaskNavButton target={targets.nav} />
    <AwaitingApprovalButton target={targets.approvalTarget} statusSelect={targets.approvalSelect} />
    {taskRoute && targets.content ? createPortal(taskRoute.kind === 'detail' ? <TaskDetail key={taskRoute.taskKey} taskKey={taskRoute.taskKey} /> : <TaskQueue />, targets.content) : null}
  </>
}
