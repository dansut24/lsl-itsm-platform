import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  Columns3,
  Copy,
  Eye,
  Filter,
  GripVertical,
  LayoutList,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { fetchProductionItsmWorkspaceRecords } from '../services/productionItsmRecords.js'

const LIST_STATE_KEY = 'hi5central-service-desk-list-v2'
const SAVED_VIEWS_KEY = 'hi5central-service-desk-saved-views-v2'
const RETURN_KEY = 'hi5central-service-desk-return-v2'

const LISTS = {
  incidents: { title: 'Incidents', type: 'Incident', singular: 'Incident', newPath: '/incidents/new' },
  requests: { title: 'Service Requests', type: 'Service Request', singular: 'Service Request', newPath: '/requests/new' },
  problems: { title: 'Problems', type: 'Problem', singular: 'Problem', newPath: '/problems/new' },
  changes: { title: 'Changes', type: 'Change', singular: 'Change', newPath: '/changes/new' },
}

const COLUMN_DEFINITIONS = [
  { key: 'reference', label: 'Reference', width: 132, min: 105, locked: true },
  { key: 'summary', label: 'Summary', width: 320, min: 180, locked: true },
  { key: 'requester', label: 'Requester', width: 176, min: 130 },
  { key: 'priority', label: 'Priority', width: 112, min: 90 },
  { key: 'status', label: 'Status', width: 138, min: 105 },
  { key: 'team', label: 'Team', width: 160, min: 115 },
  { key: 'assignee', label: 'Assignee', width: 168, min: 120 },
  { key: 'updated', label: 'Updated', width: 152, min: 118 },
  { key: 'sla', label: 'SLA', width: 128, min: 100 },
]

const DEFAULT_WIDTHS = Object.fromEntries(COLUMN_DEFINITIONS.map((column) => [column.key, column.width]))
const DEFAULT_COLUMN_ORDER = COLUMN_DEFINITIONS.map((column) => column.key)
const QUICK_FILTERS = [
  ['all', 'All'],
  ['unassigned', 'Unassigned'],
  ['high', 'High priority'],
  ['attention', 'Needs attention'],
  ['today', 'Updated today'],
]

function readJson(key, fallback) {
  try {
    const value = window.localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* preferences are best effort */ }
}

function listContext(pathname = window.location.pathname) {
  const match = pathname.match(/^\/(incidents|requests|problems|changes)\/?$/i)
  if (!match) return null
  const section = match[1].toLowerCase()
  return { section, ...LISTS[section] }
}

function recordPath(record) {
  if (!record?.id) return ''
  const prefix = {
    Incident: 'incidents',
    'Service Request': 'requests',
    Problem: 'problems',
    Change: 'changes',
  }[record.type] || 'tickets'
  return `/${prefix}/${encodeURIComponent(record.id)}`
}

function navigate(path) {
  if (!path) return
  if (window.location.pathname !== path) window.history.pushState({}, '', path)
  const pop = typeof PopStateEvent === 'function' ? new PopStateEvent('popstate', { state: window.history.state }) : new Event('popstate')
  window.dispatchEvent(pop)
  window.dispatchEvent(new CustomEvent('hi5-routechange'))
}

function normalise(value = '') { return String(value || '').toLowerCase().trim() }
function slug(value = '') { return normalise(value).replace(/[^a-z0-9]+/g, '-') }

function timestamp(value) {
  const date = new Date(value || 0)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function formatUpdated(record) {
  const value = record.updatedAt || record.updated || record.createdAt || record.created
  const date = new Date(value || '')
  if (Number.isNaN(date.getTime())) return String(value || '—')
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  return new Intl.DateTimeFormat('en-GB', sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function isToday(record) {
  const value = record.updatedAt || record.createdAt
  const date = new Date(value || 0)
  return !Number.isNaN(date.getTime()) && date.toDateString() === new Date().toDateString()
}

function needsAttention(record) {
  const priority = normalise(record.priority)
  const sla = normalise(record.sla?.resolution?.state || record.sla || record.slaState)
  const percent = Number(record.slaPercent || record.sla?.resolution?.percent || 0)
  return priority === 'critical' || priority === 'high' || sla.includes('risk') || sla.includes('breach') || sla.includes('warning') || percent >= 80
}

function cachedRecords() {
  const records = readJson('hi5central-tickets', [])
  return Array.isArray(records) ? records : []
}

function defaultState(section) {
  const stored = readJson(LIST_STATE_KEY, {})?.[section] || {}
  return {
    query: String(stored.query || ''),
    quick: QUICK_FILTERS.some(([key]) => key === stored.quick) ? stored.quick : 'all',
    status: String(stored.status || 'All'),
    priority: String(stored.priority || 'All'),
    sortKey: String(stored.sortKey || 'updated'),
    sortDir: stored.sortDir === 'asc' ? 'asc' : 'desc',
    density: stored.density === 'compact' ? 'compact' : 'comfortable',
    columns: Array.isArray(stored.columns) && stored.columns.length ? stored.columns : DEFAULT_COLUMN_ORDER,
    hidden: Array.isArray(stored.hidden) ? stored.hidden : [],
    widths: { ...DEFAULT_WIDTHS, ...(stored.widths || {}) },
  }
}

function saveListState(section, state) {
  const current = readJson(LIST_STATE_KEY, {}) || {}
  writeJson(LIST_STATE_KEY, { ...current, [section]: state })
}

function savedViewsFor(section) {
  const value = readJson(SAVED_VIEWS_KEY, {})?.[section]
  return Array.isArray(value) ? value : []
}

function saveViews(section, views) {
  const current = readJson(SAVED_VIEWS_KEY, {}) || {}
  writeJson(SAVED_VIEWS_KEY, { ...current, [section]: views })
}

function cellValue(record, key) {
  if (key === 'reference') return record.id || ''
  if (key === 'summary') return record.title || ''
  if (key === 'requester') return record.requester || ''
  if (key === 'priority') return record.priority || ''
  if (key === 'status') return record.status || ''
  if (key === 'team') return record.team || ''
  if (key === 'assignee') return record.assignee || ''
  if (key === 'updated') return timestamp(record.updatedAt || record.updated || record.createdAt || record.created)
  if (key === 'sla') return record.sla?.resolution?.state || record.sla || record.slaState || ''
  return ''
}

function previewRecord(record) {
  return {
    kind: record.type || 'Record',
    title: record.id || 'Record',
    subtitle: record.title || 'No summary',
    fields: [
      ['Status', record.status || 'Not recorded'],
      ['Priority', record.priority || 'Not recorded'],
      ['Requester', record.requester || 'Not recorded'],
      ['Service', record.service || 'Not recorded'],
      ['Category', record.category || 'Not recorded'],
      ['Team', record.team || 'Unassigned'],
      ['Assignee', record.assignee || 'Unassigned'],
      ['Updated', formatUpdated(record)],
    ],
    openPath: recordPath(record),
    openLabel: 'Open in tab',
  }
}

function previewPerson(record, role) {
  const requester = role === 'Requester'
  const name = requester ? record.requester : record.assignee
  const email = requester ? record.requesterEmail : record.assigneeEmail
  return {
    kind: role,
    title: name || (requester ? 'Requester not recorded' : 'Unassigned'),
    subtitle: email || (requester ? 'No email recorded' : record.team || 'No assignment'),
    fields: requester
      ? [
          ['Email', email || 'Not recorded'],
          ['Job title', record.requesterJobTitle || 'Not recorded'],
          ['Department', record.requesterDepartment || 'Not recorded'],
          ['Site', record.requesterSite || record.requesterLocation || record.location || 'Not recorded'],
        ]
      : [
          ['Team', record.team || 'Unassigned'],
          ['Assignee', name || 'Unassigned'],
          ['Email', email || 'Not recorded'],
          ['Record', record.id || '—'],
        ],
    openPath: '/people',
    openLabel: 'Open People',
  }
}

function QuickPreview({ preview, onClose }) {
  if (!preview) return null
  return createPortal(
    <div className="hi5-list-preview-layer">
      <button type="button" className="hi5-list-preview-backdrop" aria-label="Close preview" onClick={onClose} />
      <section className="hi5-list-preview" role="dialog" aria-modal="true" aria-label={`${preview.kind} preview`}>
        <header>
          <div className="hi5-list-preview-icon">{preview.kind === 'Requester' ? <UserRound size={19} /> : preview.kind === 'Assignment' ? <Users size={19} /> : <Eye size={19} />}</div>
          <div><span>{preview.kind}</span><strong>{preview.title}</strong><small>{preview.subtitle}</small></div>
          <button type="button" aria-label="Close preview" onClick={onClose}><X size={17} /></button>
        </header>
        <div className="hi5-list-preview-body">
          <div className="hi5-list-preview-fields">
            {(preview.fields || []).map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
          </div>
        </div>
        <footer>
          <button type="button" onClick={onClose}>Close</button>
          {preview.openPath ? <button type="button" className="is-primary" onClick={() => { onClose(); navigate(preview.openPath) }}>{preview.openLabel || 'Open in tab'}<ArrowUpRight size={14} /></button> : null}
        </footer>
      </section>
    </div>,
    document.body,
  )
}

function EmptyState({ context, filtered, onReset, onNew }) {
  return <div className="hi5-list-empty">
    <div><Sparkles size={20} /></div>
    <strong>{filtered ? 'Nothing matches this view' : `No ${context.title.toLowerCase()} yet`}</strong>
    <span>{filtered ? 'Clear the current search and filters or switch to another saved view.' : `Create the first ${context.singular.toLowerCase()} when work arrives.`}</span>
    <div>{filtered ? <button type="button" onClick={onReset}>Clear filters</button> : null}<button type="button" className="is-primary" onClick={onNew}><Plus size={14} />New {context.singular}</button></div>
  </div>
}

function LoadingState() {
  return <div className="hi5-list-loading" aria-label="Loading records">
    <div className="hi5-list-loading-toolbar" />
    {Array.from({ length: 8 }, (_, index) => <div className="hi5-list-loading-row" key={index}><span /><span /><span /><span /><span /></div>)}
  </div>
}

function ServiceDeskList({ context }) {
  const scrollRef = useRef(null)
  const initialRecords = cachedRecords().filter((record) => record.type === context.type)
  const [records, setRecords] = useState(initialRecords)
  const [loading, setLoading] = useState(() => initialRecords.length === 0)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [state, setState] = useState(() => defaultState(context.section))
  const [savedViews, setSavedViews] = useState(() => savedViewsFor(context.section))
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [dragColumn, setDragColumn] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [preview, setPreview] = useState(null)
  const [returnHighlight, setReturnHighlight] = useState('')

  useEffect(() => {
    setState(defaultState(context.section))
    setSavedViews(savedViewsFor(context.section))
    setSelected(new Set())
    setColumnsOpen(false)
    setPreview(null)
  }, [context.section])

  useEffect(() => { saveListState(context.section, state) }, [context.section, state])
  useEffect(() => { saveViews(context.section, savedViews) }, [context.section, savedViews])

  async function load({ quiet = false } = {}) {
    if (quiet) setRefreshing(true)
    else if (!records.length) setLoading(true)
    setError('')
    try {
      const payload = await fetchProductionItsmWorkspaceRecords()
      const next = payload.filter((record) => record.type === context.type)
      setRecords(next)
    } catch (loadError) {
      setError(loadError.message || 'Records could not be loaded.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { void load() }, [context.section])

  useEffect(() => {
    const onHydrated = (event) => {
      const items = Array.isArray(event.detail?.tickets) ? event.detail.tickets : []
      if (items.length) setRecords(items.filter((record) => record.type === context.type))
    }
    window.addEventListener('hi5-production-itsm-hydrated', onHydrated)
    return () => window.removeEventListener('hi5-production-itsm-hydrated', onHydrated)
  }, [context.type])

  useEffect(() => {
    const key = `${RETURN_KEY}:${context.section}`
    const record = window.sessionStorage.getItem(key) || ''
    if (record) {
      setReturnHighlight(record)
      window.sessionStorage.removeItem(key)
      const timer = window.setTimeout(() => setReturnHighlight(''), 1800)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [context.section])

  useEffect(() => {
    if (loading || !scrollRef.current) return
    const saved = Number(window.sessionStorage.getItem(`${LIST_STATE_KEY}:scroll:${context.section}`) || 0)
    if (!saved) return
    window.requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = saved
    })
  }, [context.section, loading])

  const statuses = useMemo(() => ['All', ...new Set(records.map((record) => record.status).filter(Boolean))], [records])
  const priorities = useMemo(() => ['All', ...new Set(records.map((record) => record.priority).filter(Boolean))], [records])

  const visibleColumns = useMemo(() => {
    const known = new Set(COLUMN_DEFINITIONS.map((column) => column.key))
    const order = [...state.columns.filter((key) => known.has(key)), ...DEFAULT_COLUMN_ORDER.filter((key) => !state.columns.includes(key))]
    const hidden = new Set(state.hidden)
    return order.map((key) => COLUMN_DEFINITIONS.find((column) => column.key === key)).filter((column) => column && (!hidden.has(column.key) || column.locked))
  }, [state.columns, state.hidden])

  const filteredRecords = useMemo(() => {
    const query = normalise(state.query)
    return records.filter((record) => {
      if (query) {
        const haystack = normalise([record.id, record.title, record.requester, record.requesterEmail, record.service, record.category, record.status, record.priority, record.team, record.assignee].join(' '))
        if (!haystack.includes(query)) return false
      }
      if (state.status !== 'All' && record.status !== state.status) return false
      if (state.priority !== 'All' && record.priority !== state.priority) return false
      if (state.quick === 'unassigned' && normalise(record.assignee) !== 'unassigned' && normalise(record.assignee) !== '') return false
      if (state.quick === 'high' && !['high', 'critical'].includes(normalise(record.priority))) return false
      if (state.quick === 'attention' && !needsAttention(record)) return false
      if (state.quick === 'today' && !isToday(record)) return false
      return true
    })
  }, [records, state.priority, state.query, state.quick, state.status])

  const sortedRecords = useMemo(() => {
    const direction = state.sortDir === 'asc' ? 1 : -1
    return [...filteredRecords].sort((left, right) => {
      const a = cellValue(left, state.sortKey)
      const b = cellValue(right, state.sortKey)
      if (typeof a === 'number' || typeof b === 'number') return (Number(a || 0) - Number(b || 0)) * direction
      return String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' }) * direction
    })
  }, [filteredRecords, state.sortDir, state.sortKey])

  useEffect(() => {
    const ids = new Set(sortedRecords.map((record) => record.id))
    setSelected((current) => {
      const next = new Set([...current].filter((id) => ids.has(id)))
      return next.size === current.size ? current : next
    })
  }, [sortedRecords])

  function openRecord(record) {
    if (!record) return
    window.sessionStorage.setItem(`${RETURN_KEY}:${context.section}`, record.id)
    if (scrollRef.current) window.sessionStorage.setItem(`${LIST_STATE_KEY}:scroll:${context.section}`, String(scrollRef.current.scrollTop))
    navigate(recordPath(record))
  }

  function resetFilters() {
    setState((current) => ({ ...current, query: '', quick: 'all', status: 'All', priority: 'All' }))
  }

  function toggleSort(key) {
    setState((current) => ({
      ...current,
      sortKey: key,
      sortDir: current.sortKey === key && current.sortDir === 'asc' ? 'desc' : 'asc',
    }))
  }

  function toggleSelected(id) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((current) => {
      if (current.size === sortedRecords.length && sortedRecords.length) return new Set()
      return new Set(sortedRecords.map((record) => record.id))
    })
  }

  function copySelected() {
    const refs = sortedRecords.filter((record) => selected.has(record.id)).map((record) => record.id).join('\n')
    navigator.clipboard?.writeText?.(refs)?.catch?.(() => {})
  }

  function openSelected() {
    sortedRecords.filter((record) => selected.has(record.id)).slice(0, 5).forEach((record) => navigate(recordPath(record)))
  }

  function saveView() {
    const name = window.prompt('Name this personal view')?.trim()
    if (!name) return
    const snapshot = { query: state.query, quick: state.quick, status: state.status, priority: state.priority, sortKey: state.sortKey, sortDir: state.sortDir, density: state.density }
    setSavedViews((current) => [...current.filter((view) => view.name !== name), { id: crypto.randomUUID?.() || `${Date.now()}`, name, state: snapshot }].slice(-8))
  }

  function applyView(view) {
    setState((current) => ({ ...current, ...view.state }))
  }

  function deleteView(id) {
    setSavedViews((current) => current.filter((view) => view.id !== id))
  }

  function toggleColumn(key) {
    const definition = COLUMN_DEFINITIONS.find((column) => column.key === key)
    if (definition?.locked) return
    setState((current) => {
      const hidden = new Set(current.hidden)
      if (hidden.has(key)) hidden.delete(key)
      else hidden.add(key)
      return { ...current, hidden: [...hidden] }
    })
  }

  function reorderColumn(targetKey) {
    if (!dragColumn || dragColumn === targetKey) return
    setState((current) => {
      const order = [...current.columns]
      const from = order.indexOf(dragColumn)
      const to = order.indexOf(targetKey)
      if (from < 0 || to < 0) return current
      order.splice(from, 1)
      order.splice(to, 0, dragColumn)
      return { ...current, columns: order }
    })
    setDragColumn('')
  }

  function beginResize(event, column) {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startWidth = Number(state.widths[column.key] || column.width)
    const move = (moveEvent) => {
      const next = Math.max(column.min || 90, Math.min(520, startWidth + moveEvent.clientX - startX))
      setState((current) => ({ ...current, widths: { ...current.widths, [column.key]: next } }))
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop, { once: true })
  }

  const activeFilters = Boolean(state.query || state.quick !== 'all' || state.status !== 'All' || state.priority !== 'All')
  const allSelected = Boolean(sortedRecords.length && selected.size === sortedRecords.length)

  function renderCell(record, column) {
    if (column.key === 'reference') return <button type="button" className="hi5-list-reference" onClick={(event) => { event.stopPropagation(); openRecord(record) }}>{record.id}</button>
    if (column.key === 'summary') return <span className="hi5-list-summary">{record.title || 'Untitled record'}</span>
    if (column.key === 'requester') return <button type="button" className="hi5-list-link-cell" onClick={(event) => { event.stopPropagation(); setPreview(previewPerson(record, 'Requester')) }}>{record.requester || 'Not recorded'}</button>
    if (column.key === 'priority') return <span className={`hi5-list-pill is-${slug(record.priority)}`}>{record.priority || '—'}</span>
    if (column.key === 'status') return <span className={`hi5-list-pill is-${slug(record.status)}`}>{record.status || '—'}</span>
    if (column.key === 'team') return <button type="button" className="hi5-list-link-cell" onClick={(event) => { event.stopPropagation(); setPreview(previewPerson(record, 'Assignment')) }}>{record.team || 'Unassigned'}</button>
    if (column.key === 'assignee') return <button type="button" className="hi5-list-link-cell" onClick={(event) => { event.stopPropagation(); setPreview(previewPerson(record, 'Assignment')) }}>{record.assignee || 'Unassigned'}</button>
    if (column.key === 'updated') return <span className="hi5-list-muted">{formatUpdated(record)}</span>
    if (column.key === 'sla') return <span className={`hi5-list-sla${needsAttention(record) ? ' is-attention' : ''}`}>{typeof record.sla === 'string' ? record.sla : record.sla?.resolution?.state || '—'}</span>
    return <span>—</span>
  }

  return <section className={`hi5-service-desk-v2 is-${state.density}`}>
    <header className="hi5-list-header">
      <div className="hi5-list-heading"><span>Service Desk</span><div><h1>{context.title}</h1><em>{sortedRecords.length} of {records.length}</em></div></div>
      <div className="hi5-list-header-actions">
        <button type="button" className="hi5-list-icon-button" title="Refresh" onClick={() => load({ quiet: true })} disabled={refreshing}>{refreshing ? <LoaderCircle className="is-spinning" size={16} /> : <RefreshCw size={16} />}</button>
        <button type="button" className="hi5-list-primary" onClick={() => navigate(context.newPath)}><Plus size={15} />New <span>{context.singular}</span></button>
      </div>
    </header>

    <div className="hi5-list-toolbar">
      <label className="hi5-list-search"><Search size={15} /><input value={state.query} onChange={(event) => setState((current) => ({ ...current, query: event.target.value }))} placeholder={`Search ${context.title.toLowerCase()}…`} />{state.query ? <button type="button" aria-label="Clear search" onClick={() => setState((current) => ({ ...current, query: '' }))}><X size={14} /></button> : null}</label>
      <div className="hi5-list-filter-select"><Filter size={14} /><select value={state.status} onChange={(event) => setState((current) => ({ ...current, status: event.target.value }))}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div>
      <div className="hi5-list-filter-select"><SlidersHorizontal size={14} /><select value={state.priority} onChange={(event) => setState((current) => ({ ...current, priority: event.target.value }))}>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></div>
      <button type="button" className="hi5-list-density" onClick={() => setState((current) => ({ ...current, density: current.density === 'compact' ? 'comfortable' : 'compact' }))}><LayoutList size={15} /><span>{state.density === 'compact' ? 'Compact' : 'Comfortable'}</span></button>
      <div className="hi5-list-columns-wrap">
        <button type="button" className="hi5-list-columns-button" aria-expanded={columnsOpen} onClick={() => setColumnsOpen((open) => !open)}><Columns3 size={15} /><span>Columns</span><ChevronDown size={13} /></button>
        {columnsOpen ? <div className="hi5-list-columns-popover">
          <header><strong>Columns</strong><span>Drag to reorder</span></header>
          <div>{state.columns.map((key) => {
            const column = COLUMN_DEFINITIONS.find((item) => item.key === key)
            if (!column) return null
            const visible = column.locked || !state.hidden.includes(key)
            return <button type="button" draggable onDragStart={() => setDragColumn(key)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorderColumn(key)} key={key} className={visible ? 'is-visible' : ''}><GripVertical size={13} /><span>{column.label}</span><i onClick={(event) => { event.stopPropagation(); toggleColumn(key) }}>{visible ? <Check size={13} /> : null}</i></button>
          })}</div>
        </div> : null}
      </div>
      <button type="button" className="hi5-list-save-view" onClick={saveView}>Save view</button>
    </div>

    <div className="hi5-list-views-row">
      <div className="hi5-list-quick-filters">{QUICK_FILTERS.map(([key, label]) => <button type="button" className={state.quick === key ? 'is-active' : ''} onClick={() => setState((current) => ({ ...current, quick: key }))} key={key}>{label}</button>)}</div>
      {savedViews.length ? <div className="hi5-list-saved-views"><span>Saved</span>{savedViews.map((view) => <div key={view.id}><button type="button" onClick={() => applyView(view)}>{view.name}</button><button type="button" aria-label={`Delete ${view.name}`} onClick={() => deleteView(view.id)}><X size={11} /></button></div>)}</div> : null}
    </div>

    {selected.size ? <div className="hi5-list-selection-bar"><strong>{selected.size} selected</strong><span>Safe workspace actions</span><button type="button" onClick={copySelected}><Copy size={13} />Copy references</button><button type="button" onClick={openSelected}><ArrowUpRight size={13} />Open {Math.min(selected.size, 5)} in tabs</button><button type="button" onClick={() => setSelected(new Set())}>Clear</button></div> : null}
    {error ? <div className="hi5-list-error"><span>{error}</span><button type="button" onClick={() => load()}>Retry</button></div> : null}

    <div className="hi5-list-scroll" ref={scrollRef} onScroll={(event) => window.sessionStorage.setItem(`${LIST_STATE_KEY}:scroll:${context.section}`, String(event.currentTarget.scrollTop))}>
      {loading ? <LoadingState /> : sortedRecords.length ? <>
        <div className="hi5-list-table-wrap">
          <table className="hi5-list-table">
            <colgroup><col className="is-select" />{visibleColumns.map((column) => <col key={column.key} style={{ width: `${state.widths[column.key] || column.width}px` }} />)}<col className="is-peek" /></colgroup>
            <thead><tr><th className="is-select"><input type="checkbox" aria-label="Select all records" checked={allSelected} onChange={toggleAll} /></th>{visibleColumns.map((column) => <th key={column.key}><button type="button" onClick={() => toggleSort(column.key)}><span>{column.label}</span>{state.sortKey === column.key ? state.sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : null}</button><i className="hi5-list-resizer" onPointerDown={(event) => beginResize(event, column)} /></th>)}<th className="is-peek" /></tr></thead>
            <tbody>{sortedRecords.map((record) => <tr key={record.id} className={`${selected.has(record.id) ? 'is-selected ' : ''}${returnHighlight === record.id ? 'is-returned' : ''}`} onClick={() => openRecord(record)}><td className="is-select"><input type="checkbox" aria-label={`Select ${record.id}`} checked={selected.has(record.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleSelected(record.id)} /></td>{visibleColumns.map((column) => <td key={column.key}>{renderCell(record, column)}</td>)}<td className="is-peek"><button type="button" title={`Preview ${record.id}`} onClick={(event) => { event.stopPropagation(); setPreview(previewRecord(record)) }}><Eye size={14} /></button></td></tr>)}</tbody>
          </table>
        </div>

        <div className="hi5-list-mobile-cards">{sortedRecords.map((record) => <article key={record.id} className={`${selected.has(record.id) ? 'is-selected ' : ''}${returnHighlight === record.id ? 'is-returned' : ''}`} onClick={() => openRecord(record)}>
          <header><input type="checkbox" aria-label={`Select ${record.id}`} checked={selected.has(record.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleSelected(record.id)} /><button type="button" onClick={(event) => { event.stopPropagation(); openRecord(record) }}>{record.id}</button><span className={`hi5-list-pill is-${slug(record.status)}`}>{record.status || '—'}</span><button type="button" className="hi5-list-mobile-peek" aria-label={`Preview ${record.id}`} onClick={(event) => { event.stopPropagation(); setPreview(previewRecord(record)) }}><Eye size={15} /></button></header>
          <h2>{record.title || 'Untitled record'}</h2>
          <div className="hi5-list-mobile-meta"><button type="button" onClick={(event) => { event.stopPropagation(); setPreview(previewPerson(record, 'Requester')) }}><span>Requester</span><strong>{record.requester || 'Not recorded'}</strong></button><button type="button" onClick={(event) => { event.stopPropagation(); setPreview(previewPerson(record, 'Assignment')) }}><span>Assignment</span><strong>{record.assignee && record.assignee !== 'Unassigned' ? record.assignee : record.team || 'Unassigned'}</strong></button></div>
          <footer><span className={`hi5-list-pill is-${slug(record.priority)}`}>{record.priority || '—'}</span>{needsAttention(record) ? <em>Needs attention</em> : null}<time>{formatUpdated(record)}</time></footer>
        </article>)}</div>
      </> : <EmptyState context={context} filtered={activeFilters} onReset={resetFilters} onNew={() => navigate(context.newPath)} />}
    </div>

    <QuickPreview preview={preview} onClose={() => setPreview(null)} />
  </section>
}

export function ProductionServiceDeskListV2() {
  const [context, setContext] = useState(() => listContext())
  const [target, setTarget] = useState(null)

  useEffect(() => {
    const update = () => setContext(listContext())
    window.addEventListener('popstate', update)
    window.addEventListener('hi5-routechange', update)
    const timer = window.setInterval(update, 300)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener('hi5-routechange', update)
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    let mounted = null
    const detach = () => {
      if (mounted) mounted.classList.remove('production-service-desk-v2-mounted')
      mounted = null
      setTarget(null)
    }
    if (!context) { detach(); return undefined }

    const attach = () => {
      const node = document.querySelector('.content-frame')
      if (!(node instanceof HTMLElement)) return false
      if (mounted && mounted !== node) mounted.classList.remove('production-service-desk-v2-mounted')
      mounted = node
      node.classList.add('production-service-desk-v2-mounted')
      setTarget(node)
      return true
    }

    if (attach()) return () => mounted?.classList.remove('production-service-desk-v2-mounted')
    const observer = new MutationObserver(() => { if (attach()) observer.disconnect() })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect(); mounted?.classList.remove('production-service-desk-v2-mounted') }
  }, [context?.section])

  if (!context || !target) return null
  return createPortal(<ServiceDeskList key={context.section} context={context} />, target)
}
