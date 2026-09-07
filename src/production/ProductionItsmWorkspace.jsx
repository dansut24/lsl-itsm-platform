import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Search,
  TableProperties,
  X,
} from 'lucide-react'
import { hydrateProductionItsmWorkspaceRecords } from '../services/productionItsmRecords.js'
import './ProductionItsmWorkspace.css'

const API_BASE = window.__HI5_API_BASE__
const ROUTES = {
  '/incidents': { type: 'Incident', title: 'Incidents', singular: 'incident', section: 'incidents' },
  '/requests': { type: 'Service Request', title: 'Service Requests', singular: 'service request', section: 'requests' },
  '/problems': { type: 'Problem', title: 'Problems', singular: 'problem', section: 'problems' },
  '/changes': { type: 'Change', title: 'Changes', singular: 'change', section: 'changes' },
}
const PAGE_SIZES = [25, 50, 100]
const VIEW_STYLES = [
  { id: 'table', label: 'Table', icon: TableProperties },
  { id: 'compact', label: 'Compact', icon: List },
  { id: 'cards', label: 'Cards', icon: LayoutGrid },
]

function currentRoute() {
  return ROUTES[window.location.pathname] || null
}

function readJson(key, fallback) {
  try {
    const value = window.localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function priorityClass(value = '') {
  return `is-${String(value).toLowerCase().replace(/\s+/g, '-')}`
}

function statusClass(value = '') {
  return `is-${String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function recordRoute(record) {
  const section = record.type === 'Incident' ? 'incidents'
    : record.type === 'Service Request' ? 'requests'
      : record.type === 'Problem' ? 'problems'
        : 'changes'
  return `/${section}/${encodeURIComponent(record.id)}`
}

async function fetchQueue(route, state) {
  const params = new URLSearchParams({
    type: route.type,
    limit: String(state.pageSize),
    offset: String(state.page * state.pageSize),
  })
  if (state.query.trim()) params.set('search', state.query.trim())
  for (const key of ['status', 'priority', 'team', 'assignee', 'service']) {
    const value = state.filters[key]
    if (value && value !== 'All') params.set(key, value)
  }
  const response = await fetch(`${API_BASE}/api/v1/itsm-queue?${params}`, { credentials: 'include' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Could not load ${route.title}.`)
  return payload
}

function FilterSelect({ label, options, value, onChange }) {
  return (
    <label className="production-record-filter-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option>All</option>
        {options.filter((option) => option && option !== 'All').map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  )
}

function QueueFilters({ filterOptions, filters, onChange, onClear, sessionName }) {
  const quickViews = [
    ['all', 'All records'],
    ['mine', 'Assigned to me'],
    ['unassigned', 'Unassigned'],
    ['high', 'High priority'],
    ['closed', 'Closed'],
  ]
  const activeQuick = filters.__view || 'all'

  function quick(id) {
    if (id === 'mine') onChange({ ...filters, __view: id, assignee: sessionName || 'All', status: 'All', priority: 'All' })
    else if (id === 'unassigned') onChange({ ...filters, __view: id, assignee: 'Unassigned', status: 'All', priority: 'All' })
    else if (id === 'high') onChange({ ...filters, __view: id, assignee: 'All', status: 'All', priority: 'High' })
    else if (id === 'closed') onChange({ ...filters, __view: id, assignee: 'All', status: 'Closed', priority: 'All' })
    else onChange({ status: 'All', priority: 'All', team: 'All', assignee: 'All', service: 'All', __view: 'all' })
  }

  return (
    <div className="production-record-filter-content">
      <section>
        <span className="production-record-filter-label">Views</span>
        <div className="production-record-view-list">
          {quickViews.map(([id, label]) => (
            <button className={activeQuick === id ? 'is-active' : ''} key={id} onClick={() => quick(id)} type="button">{label}</button>
          ))}
        </div>
      </section>
      <section>
        <span className="production-record-filter-label">Filters</span>
        <FilterSelect label="Status" options={filterOptions.statuses || []} value={filters.status} onChange={(value) => onChange({ ...filters, status: value, __view: 'custom' })} />
        <FilterSelect label="Priority / risk" options={filterOptions.priorities || []} value={filters.priority} onChange={(value) => onChange({ ...filters, priority: value, __view: 'custom' })} />
        <FilterSelect label="Assignment group" options={filterOptions.teams || []} value={filters.team} onChange={(value) => onChange({ ...filters, team: value, __view: 'custom' })} />
        <FilterSelect label="Assignee" options={filterOptions.assignees || []} value={filters.assignee} onChange={(value) => onChange({ ...filters, assignee: value, __view: 'custom' })} />
        <FilterSelect label="Service" options={filterOptions.services || []} value={filters.service} onChange={(value) => onChange({ ...filters, service: value, __view: 'custom' })} />
        <button className="production-record-clear" onClick={onClear} type="button">Clear filters</button>
      </section>
    </div>
  )
}

function RecordTable({ items, onOpen }) {
  return (
    <div className="production-record-table-wrap">
      <table className="production-record-table">
        <thead><tr><th>Reference</th><th>Summary</th><th>Priority / risk</th><th>Status</th><th>Requester</th><th>Service</th><th>Assignment</th><th>Updated</th></tr></thead>
        <tbody>
          {items.map((record) => (
            <tr key={record.id} onClick={() => onOpen(record)}>
              <td><button type="button" onClick={(event) => { event.stopPropagation(); onOpen(record) }}>{record.id}</button></td>
              <td><strong>{record.title}</strong><small>{record.category || record.type}</small></td>
              <td><span className={`production-record-priority ${priorityClass(record.priority)}`}>{record.priority}</span></td>
              <td><span className={`production-record-status ${statusClass(record.status)}`}>{record.status}</span></td>
              <td>{record.requester || 'Not recorded'}</td>
              <td>{record.service || 'Unclassified'}</td>
              <td><strong>{record.team || 'Unassigned team'}</strong><small>{record.assignee || 'Unassigned'}</small></td>
              <td>{formatDate(record.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CompactList({ items, onOpen }) {
  return (
    <div className="production-record-compact-list">
      {items.map((record) => (
        <button key={record.id} onClick={() => onOpen(record)} type="button">
          <strong>{record.id}</strong>
          <span>{record.title}</span>
          <span className={`production-record-priority ${priorityClass(record.priority)}`}>{record.priority}</span>
          <span className={`production-record-status ${statusClass(record.status)}`}>{record.status}</span>
          <small>{record.team || 'Unassigned'} · {record.assignee || 'Unassigned'}</small>
          <small>{formatDate(record.updatedAt)}</small>
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

function CardList({ items, onOpen }) {
  return (
    <div className="production-record-card-list">
      {items.map((record) => (
        <button className="production-record-card" key={record.id} onClick={() => onOpen(record)} type="button">
          <div><strong>{record.id}</strong><span className={`production-record-priority ${priorityClass(record.priority)}`}>{record.priority}</span></div>
          <h3>{record.title}</h3>
          <div className="production-record-card-state"><span className={`production-record-status ${statusClass(record.status)}`}>{record.status}</span><span>{record.service || 'Unclassified'}</span></div>
          <dl>
            <div><dt>Requester</dt><dd>{record.requester || 'Not recorded'}</dd></div>
            <div><dt>Assignment</dt><dd>{record.team || 'Unassigned'} · {record.assignee || 'Unassigned'}</dd></div>
          </dl>
          <footer><span>Updated {formatDate(record.updatedAt)}</span><ChevronRight size={16} /></footer>
        </button>
      ))}
    </div>
  )
}

function QueueSkeleton({ viewStyle }) {
  if (viewStyle === 'cards') {
    return <div className="production-record-skeleton-cards" aria-label="Loading records">{Array.from({ length: 6 }, (_, index) => <div className="production-skeleton production-record-skeleton-card" key={index}><i /><i /><i /><i /></div>)}</div>
  }
  if (viewStyle === 'compact') {
    return <div className="production-record-skeleton-compact" aria-label="Loading records">{Array.from({ length: 8 }, (_, index) => <div className="production-skeleton production-record-skeleton-line" key={index}><i /><i /><i /><i /></div>)}</div>
  }
  return (
    <div className="production-record-skeleton-table" aria-label="Loading records">
      <div className="production-record-skeleton-head">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div>
      {Array.from({ length: 7 }, (_, row) => <div className="production-skeleton production-record-skeleton-row" key={row}>{Array.from({ length: 8 }, (_, cell) => <i key={cell} />)}</div>)}
    </div>
  )
}

function ProductionQueue({ route }) {
  const productionSession = readJson('hi5central-production-session-v1', {})
  const savedStyles = readJson('hi5central-record-view-style-v1', {})
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ status: 'All', priority: 'All', team: 'All', assignee: 'All', service: 'All', __view: 'all' })
  const [viewStyle, setViewStyle] = useState(savedStyles[route.type] || (window.matchMedia?.('(max-width: 720px)').matches ? 'cards' : 'table'))
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(0)
  const [payload, setPayload] = useState({ items: [], total: 0, filters: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mobileFilters, setMobileFilters] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => { setPage(0) }, [query, filters, pageSize, route.type])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    fetchQueue(route, { query, filters, pageSize, page })
      .then((next) => { if (active) setPayload(next) })
      .catch((loadError) => { if (active) setError(loadError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filters, page, pageSize, query, revision, route])

  function changeViewStyle(value) {
    setViewStyle(value)
    const current = readJson('hi5central-record-view-style-v1', {})
    window.localStorage.setItem('hi5central-record-view-style-v1', JSON.stringify({ ...current, [route.type]: value }))
  }

  function clearFilters() {
    setFilters({ status: 'All', priority: 'All', team: 'All', assignee: 'All', service: 'All', __view: 'all' })
  }

  async function openRecord(record) {
    try { await hydrateProductionItsmWorkspaceRecords() } catch { /* Queue record still remains navigable. */ }
    window.location.assign(recordRoute(record))
  }

  function createRecord() {
    window.location.assign(`/${route.section}/new`)
  }

  const pageCount = Math.max(1, Math.ceil(Number(payload.total || 0) / pageSize))
  const start = payload.total ? page * pageSize + 1 : 0
  const end = Math.min((page + 1) * pageSize, Number(payload.total || 0))
  const ActiveViewIcon = VIEW_STYLES.find((item) => item.id === viewStyle)?.icon || TableProperties

  return (
    <section className="production-record-shell production-motion-enter">
      <aside className="production-record-filter-rail">
        <div className="production-record-filter-heading"><span>Queue</span><strong>{route.title}</strong></div>
        <QueueFilters filterOptions={payload.filters || {}} filters={filters} onChange={setFilters} onClear={clearFilters} sessionName={productionSession.name} />
      </aside>

      <main className="production-record-main">
        <div className="production-record-toolbar">
          <button className="production-record-filter-trigger" onClick={() => setMobileFilters(true)} type="button"><Filter size={15} />Filters</button>
          <label className="production-record-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${route.title.toLowerCase()}...`} type="search" /></label>
          <button className="production-record-refresh" onClick={() => setRevision((value) => value + 1)} type="button" title="Refresh"><RefreshCw size={16} /></button>
          <label className="production-record-view-select"><ActiveViewIcon size={15} /><select value={viewStyle} onChange={(event) => changeViewStyle(event.target.value)}>{VIEW_STYLES.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}</select></label>
          <button className="production-record-new" onClick={createRecord} type="button"><Plus size={16} />New</button>
        </div>

        <div className="production-record-result-line"><span><strong>{payload.total || 0}</strong> {Number(payload.total) === 1 ? route.singular : route.title.toLowerCase()}</span><span>{start}–{end} of {payload.total || 0}</span></div>

        <div className="production-record-content">
          {loading ? <QueueSkeleton viewStyle={viewStyle} /> : null}
          {!loading && error ? <div className="production-record-state is-error"><strong>Could not load this queue</strong><span>{error}</span><button onClick={() => setRevision((value) => value + 1)} type="button">Retry</button></div> : null}
          {!loading && !error && !payload.items?.length ? <div className="production-record-state"><strong>No {route.title.toLowerCase()} in this view</strong><span>Change the filters or create the first {route.singular}.</span></div> : null}
          {!loading && !error && payload.items?.length ? (
            <div className="production-motion-enter production-motion-enter-fast">
              {viewStyle === 'compact' ? <CompactList items={payload.items} onOpen={openRecord} />
                : viewStyle === 'cards' ? <CardList items={payload.items} onOpen={openRecord} />
                  : <RecordTable items={payload.items} onOpen={openRecord} />}
            </div>
          ) : null}
        </div>

        <footer className="production-record-pagination">
          <label>Rows <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{PAGE_SIZES.map((size) => <option key={size}>{size}</option>)}</select></label>
          <span>Page {Math.min(page + 1, pageCount)} of {pageCount}</span>
          <div><button disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} type="button"><ChevronLeft size={15} /></button><button disabled={page >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} type="button"><ChevronRight size={15} /></button></div>
        </footer>
      </main>

      {mobileFilters ? (
        <><button className="production-record-filter-backdrop" aria-label="Close filters" onClick={() => setMobileFilters(false)} type="button" /><aside className="production-record-mobile-filter production-motion-drawer"><header><div><span>Queue filters</span><strong>{route.title}</strong></div><button onClick={() => setMobileFilters(false)} type="button"><X size={17} /></button></header><QueueFilters filterOptions={payload.filters || {}} filters={filters} onChange={setFilters} onClear={clearFilters} sessionName={productionSession.name} /></aside></>
      ) : null}
    </section>
  )
}

export function ProductionItsmWorkspace() {
  const [route, setRoute] = useState(currentRoute)
  const [target, setTarget] = useState(null)

  useEffect(() => {
    let active = true
    const hydrate = async () => {
      try {
        const before = window.localStorage.getItem('hi5central-tickets') || '[]'
        const records = await hydrateProductionItsmWorkspaceRecords()
        const signature = records.map((record) => `${record.id}:${record.updatedAt || record.updated}`).join('|')
        const after = window.localStorage.getItem('hi5central-tickets') || '[]'
        const reloadKey = 'hi5central-production-itsm-hydrated-v1'
        if (active && before !== after && window.sessionStorage.getItem(reloadKey) !== signature) {
          window.sessionStorage.setItem(reloadKey, signature)
          window.location.reload()
        }
      } catch (error) {
        console.error('Production ITSM hydration failed', error)
      }
    }
    void hydrate()
    return () => { active = false }
  }, [])

  useEffect(() => {
    const updateRoute = () => setRoute(currentRoute())
    window.addEventListener('popstate', updateRoute)
    window.addEventListener('hi5-routechange', updateRoute)
    const timer = window.setInterval(updateRoute, 250)
    return () => {
      window.removeEventListener('popstate', updateRoute)
      window.removeEventListener('hi5-routechange', updateRoute)
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!route) {
      setTarget(null)
      document.querySelector('.content-frame')?.classList.remove('production-itsm-queue-mounted')
      return undefined
    }
    let mounted = null
    const attach = () => {
      const node = document.querySelector('.content-frame')
      if (!(node instanceof HTMLElement)) return false
      mounted = node
      node.classList.add('production-itsm-queue-mounted')
      setTarget(node)
      return true
    }
    if (attach()) return () => mounted?.classList.remove('production-itsm-queue-mounted')
    const observer = new MutationObserver(() => { if (attach()) observer.disconnect() })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect(); mounted?.classList.remove('production-itsm-queue-mounted') }
  }, [route])

  const key = useMemo(() => route?.type || 'none', [route])
  if (!route || !target) return null
  return createPortal(<ProductionQueue key={key} route={route} />, target)
}
