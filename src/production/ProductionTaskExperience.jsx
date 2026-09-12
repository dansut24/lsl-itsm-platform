import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleStop,
  ExternalLink,
  ListChecks,
  PlayCircle,
  RefreshCw,
  Search,
} from 'lucide-react'
import './ProductionTaskExperience.css'

const API_BASE = window.__HI5_API_BASE__
const ACTIVE_STATUSES = ['Ready', 'In Progress', 'Blocked']

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
  if (!response.ok) throw new Error(payload.error || 'The Tasks operation failed.')
  return payload
}

function formatDate(value) {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function readSessionName() {
  try {
    return JSON.parse(window.localStorage.getItem('hi5central-production-session-v1') || '{}')?.name || ''
  } catch {
    return ''
  }
}

function statusClass(status) {
  return String(status || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function TaskNavButton({ active }) {
  return (
    <button
      aria-current={active ? 'page' : undefined}
      className={`nav-item production-task-nav ${active ? 'active' : ''}`}
      onClick={() => navigate('/tasks')}
      title="Tasks"
      type="button"
    >
      <ListChecks size={18} aria-hidden="true" />
      <span>Tasks</span>
    </button>
  )
}

function AwaitingApprovalButton({ active, onClick }) {
  return <button className={active ? 'is-active' : ''} onClick={onClick} type="button">Awaiting approval</button>
}

function useWorkspaceTargets(taskRoute) {
  const [content, setContent] = useState(null)
  const [navGroup, setNavGroup] = useState(null)
  const [approvalViews, setApprovalViews] = useState(null)
  const [approvalStatusSelect, setApprovalStatusSelect] = useState(null)

  useEffect(() => {
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const nextContent = taskRoute ? document.querySelector('.content-frame') : null
        setContent((current) => current === nextContent ? current : nextContent)

        const groups = [...document.querySelectorAll('.nav-stack > div')]
        const nextNav = groups.find((group) => group.querySelector('.nav-group-label')?.textContent?.trim() === 'Service Desk') || null
        setNavGroup((current) => current === nextNav ? current : nextNav)

        let nextViews = null
        let nextStatus = null
        if (window.location.pathname === '/requests') {
          const shells = [...document.querySelectorAll('.production-record-shell')]
          const requestShell = shells.find((shell) => shell.querySelector('.production-record-filter-heading strong')?.textContent?.trim() === 'Service Requests')
          nextViews = requestShell?.querySelector('.production-record-view-list') || null
          nextStatus = [...(requestShell?.querySelectorAll('.production-record-filter-field') || [])]
            .find((label) => label.querySelector(':scope > span')?.textContent?.trim() === 'Status')
            ?.querySelector('select') || null
        }
        setApprovalViews((current) => current === nextViews ? current : nextViews)
        setApprovalStatusSelect((current) => current === nextStatus ? current : nextStatus)
      })
    }

    measure()
    const observer = new MutationObserver(measure)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('popstate', measure)
    window.addEventListener('hi5-routechange', measure)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('popstate', measure)
      window.removeEventListener('hi5-routechange', measure)
    }
  }, [taskRoute])

  return { content, navGroup, approvalViews, approvalStatusSelect }
}

function TaskQueue() {
  const sessionName = useMemo(readSessionName, [])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const [team, setTeam] = useState('All')
  const [assignee, setAssignee] = useState('All')
  const [service, setService] = useState('All')
  const [payload, setPayload] = useState({ items: [], total: 0, filters: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ limit: '100', offset: '0' })
      if (query.trim()) params.set('search', query.trim())
      if (status !== 'All') params.set('status', status)
      if (team !== 'All') params.set('team', team)
      if (assignee !== 'All') params.set('assignee', assignee)
      if (service !== 'All') params.set('service', service)
      setLoading(true)
      setError('')
      apiJson(`/api/v1/tasks?${params}`)
        .then((next) => { if (active) setPayload(next) })
        .catch((loadError) => { if (active) setError(loadError.message) })
        .finally(() => { if (active) setLoading(false) })
    }, query ? 220 : 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [assignee, query, revision, service, status, team])

  function quickView(view) {
    if (view === 'mine') { setAssignee(sessionName || 'All'); setStatus('All') }
    else if (view === 'unassigned') { setAssignee('Unassigned'); setStatus('All') }
    else if (view === 'blocked') { setAssignee('All'); setStatus('Blocked') }
    else if (view === 'completed') { setAssignee('All'); setStatus('Completed') }
    else { setAssignee('All'); setStatus('All') }
  }

  const filter = payload.filters || {}
  const quick = status === 'Completed' ? 'completed' : status === 'Blocked' ? 'blocked' : assignee === 'Unassigned' ? 'unassigned' : assignee === sessionName && sessionName ? 'mine' : 'all'

  return (
    <section className="production-task-experience production-record-shell">
      <aside className="production-task-filter-rail">
        <div className="production-task-filter-heading"><span>Work queue</span><strong>Tasks</strong></div>
        <div className="production-task-filter-content">
          <section>
            <span className="production-task-filter-label">Views</span>
            <div className="production-task-view-list">
              {[
                ['all', 'Active tasks'], ['mine', 'Assigned to me'], ['unassigned', 'Unassigned'], ['blocked', 'Blocked'], ['completed', 'Completed'],
              ].map(([id, label]) => <button className={quick === id ? 'is-active' : ''} key={id} onClick={() => quickView(id)} type="button">{label}</button>)}
            </div>
          </section>
          <section>
            <span className="production-task-filter-label">Filters</span>
            <TaskFilter label="Status" value={status} options={filter.statuses || ACTIVE_STATUSES} onChange={setStatus} />
            <TaskFilter label="Assignment group" value={team} options={filter.teams || []} onChange={setTeam} />
            <TaskFilter label="Assignee" value={assignee} options={filter.assignees || []} onChange={setAssignee} />
            <TaskFilter label="Service" value={service} options={filter.services || []} onChange={setService} />
            <button className="production-task-clear" onClick={() => { setStatus('All'); setTeam('All'); setAssignee('All'); setService('All'); setQuery('') }} type="button">Clear filters</button>
          </section>
          <p className="production-task-waiting-note">Future workflow steps stay on the primary request and appear here only when their dependencies are complete.</p>
        </div>
      </aside>

      <main className="production-task-main">
        <div className="production-task-toolbar">
          <label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search task or primary request…" type="search" /></label>
          <button aria-label="Refresh tasks" onClick={() => setRevision((value) => value + 1)} title="Refresh" type="button"><RefreshCw size={16} /></button>
        </div>
        <div className="production-task-result-line"><span><strong>{payload.total || 0}</strong> {payload.total === 1 ? 'task' : 'tasks'}</span><span>{status === 'All' ? 'Ready work only' : status}</span></div>
        <div className="production-task-scroll">
          {loading ? <div className="production-task-state">Loading Tasks…</div> : null}
          {!loading && error ? <div className="production-task-state is-error"><strong>Could not load Tasks</strong><span>{error}</span></div> : null}
          {!loading && !error && !payload.items?.length ? <div className="production-task-state"><strong>No tasks in this view</strong><span>Waiting workflow steps remain hidden until they are ready.</span></div> : null}
          {!loading && !error && payload.items?.length ? <TaskResults items={payload.items} /> : null}
        </div>
      </main>
    </section>
  )
}

function TaskFilter({ label, options, value, onChange }) {
  return (
    <label className="production-task-filter-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option>All</option>{options.filter((option) => option && option !== 'All').map((option) => <option key={option}>{option}</option>)}</select></label>
  )
}

function TaskResults({ items }) {
  return (
    <>
      <div className="production-task-table-wrap">
        <table className="production-task-table">
          <thead><tr><th>Task</th><th>Summary</th><th>Primary request</th><th>Status</th><th>Service</th><th>Assignment</th><th>Updated</th><th /></tr></thead>
          <tbody>{items.map((task) => <tr key={task.id} onClick={() => navigate(`/tasks/${encodeURIComponent(task.id)}`)}><td><strong>{task.id}</strong></td><td><strong>{task.title}</strong><small>{task.primaryRequest?.requester || 'Requester not recorded'}</small></td><td><button onClick={(event) => { event.stopPropagation(); navigate(`/requests/${encodeURIComponent(task.primaryRequest.id)}`) }} type="button"><strong>{task.primaryRequest.id}</strong><small>{task.primaryRequest.title}</small></button></td><td><span className={`production-task-status is-${statusClass(task.status)}`}>{task.status}</span></td><td>{task.primaryRequest?.service || 'Unclassified'}</td><td><strong>{task.team}</strong><small>{task.assignee}</small></td><td>{formatDate(task.updatedAt)}</td><td><ChevronRight size={15} /></td></tr>)}</tbody>
        </table>
      </div>
      <div className="production-task-cards">{items.map((task) => <button className="production-task-card" key={task.id} onClick={() => navigate(`/tasks/${encodeURIComponent(task.id)}`)} type="button"><header><strong>{task.id}</strong><span className={`production-task-status is-${statusClass(task.status)}`}>{task.status}</span></header><h3>{task.title}</h3><div><span>Primary request</span><strong>{task.primaryRequest.id}</strong></div><div><span>Assignment</span><strong>{task.team} · {task.assignee}</strong></div><footer><span>{task.primaryRequest?.service || 'Unclassified'}</span><ChevronRight size={16} /></footer></button>)}</div>
    </>
  )
}

function TaskDetail({ taskKey }) {
  const [task, setTask] = useState(null)
  const [organisation, setOrganisation] = useState({ people: [], teams: [] })
  const [completionNotes, setCompletionNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const [taskPayload, org] = await Promise.all([
        apiJson(`/api/v1/tasks/${encodeURIComponent(taskKey)}`),
        apiJson('/api/v1/organisation').catch(() => ({ people: [], teams: [] })),
      ])
      setTask(taskPayload)
      setCompletionNotes(taskPayload.completionNotes || '')
      setOrganisation(org)
    } catch (loadError) {
      setError(loadError.message)
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [taskKey])

  async function update(body) {
    setSaving(true); setError('')
    try {
      const next = await apiJson(`/api/v1/tasks/${encodeURIComponent(taskKey)}`, { method: 'PATCH', body: JSON.stringify(body) })
      setTask(next)
      setCompletionNotes(next.completionNotes || completionNotes)
    } catch (updateError) {
      setError(updateError.message)
    } finally { setSaving(false) }
  }

  if (loading) return <section className="production-task-experience production-record-shell production-task-detail-shell"><div className="production-task-state">Loading task…</div></section>
  if (error && !task) return <section className="production-task-experience production-record-shell production-task-detail-shell"><div className="production-task-state is-error"><strong>Task unavailable</strong><span>{error}</span><button onClick={() => navigate('/tasks')} type="button">Back to Tasks</button></div></section>
  if (!task) return null

  const people = (organisation.people || []).filter((person) => person.active !== false)
  const teams = (organisation.teams || []).filter((team) => team.active !== false)
  const completed = task.status === 'Completed'

  return (
    <section className="production-task-experience production-record-shell production-task-detail-shell">
      <main className="production-task-detail">
        <header className="production-task-detail-topbar">
          <button onClick={() => navigate('/tasks')} type="button"><ArrowLeft size={16} />Tasks</button>
          <div><span>ITSM · Task</span><strong>{task.id}</strong></div>
          <button className="production-task-primary-link" onClick={() => navigate(`/requests/${encodeURIComponent(task.primaryRequest.id)}`)} type="button"><ExternalLink size={15} />Open primary request</button>
        </header>

        <div className="production-task-detail-scroll">
          <section className="production-task-hero">
            <div><span className={`production-task-status is-${statusClass(task.status)}`}>{task.status}</span><small>{task.primaryRequest.priority} priority · {task.primaryRequest.service}</small></div>
            <h1>{task.title}</h1>
            <p>{task.instructions || 'No task instructions were supplied.'}</p>
          </section>

          <div className="production-task-detail-grid">
            <section className="production-task-panel">
              <header><span>Task details</span><strong>Work to complete</strong></header>
              <dl>
                <div><dt>Primary request</dt><dd><button onClick={() => navigate(`/requests/${encodeURIComponent(task.primaryRequest.id)}`)} type="button">{task.primaryRequest.id} · {task.primaryRequest.title}</button></dd></div>
                <div><dt>Requester</dt><dd>{task.primaryRequest.requester || 'Not recorded'}</dd></div>
                <div><dt>Request status</dt><dd>{task.primaryRequest.status}</dd></div>
                <div><dt>Due</dt><dd>{formatDate(task.dueAt)}</dd></div>
                <div><dt>Dependencies</dt><dd>{task.dependencies?.length ? task.dependencies.join(', ') : 'None'}</dd></div>
                <div><dt>Updated</dt><dd>{formatDate(task.updatedAt)}</dd></div>
              </dl>
            </section>

            <section className="production-task-panel">
              <header><span>Assignment</span><strong>Task ownership</strong></header>
              <label><span>Assignment group</span><select disabled={completed || saving} value={task.teamId || ''} onChange={(event) => update({ teamId: event.target.value })}><option value="">Unassigned</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
              <label><span>Assignee</span><select disabled={completed || saving} value={task.assigneeId || ''} onChange={(event) => update({ assigneeId: event.target.value })}><option value="">Unassigned</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}{person.email ? ` · ${person.email}` : ''}</option>)}</select></label>
            </section>
          </div>

          <section className="production-task-panel production-task-completion">
            <header><span>Completion</span><strong>{completed ? 'Task completed' : 'Update task'}</strong></header>
            <label><span>Completion notes</span><textarea disabled={completed || saving} rows="5" value={completionNotes} onChange={(event) => setCompletionNotes(event.target.value)} placeholder="Record what was completed, changed or verified…" /></label>
            {completed ? <div className="production-task-completed"><CheckCircle2 size={18} /><span><strong>Completed {formatDate(task.completedAt)}</strong><small>{task.completionNotes}</small></span></div> : (
              <div className="production-task-actions">
                {task.status !== 'In Progress' ? <button disabled={saving} onClick={() => update({ status: 'In Progress' })} type="button"><PlayCircle size={16} />Start task</button> : null}
                {task.status !== 'Blocked' ? <button disabled={saving} onClick={() => update({ status: 'Blocked' })} type="button"><CircleStop size={16} />Block</button> : null}
                <button className="is-primary" disabled={saving || !completionNotes.trim()} onClick={() => update({ status: 'Completed', completionNotes })} type="button"><CheckCircle2 size={16} />Complete task</button>
              </div>
            )}
            {error ? <div className="production-task-inline-error">{error}</div> : null}
          </section>
        </div>
      </main>
    </section>
  )
}

export function ProductionTaskExperience() {
  const [taskRoute, setTaskRoute] = useState(() => routeFromPath())
  const [awaitingActive, setAwaitingActive] = useState(false)
  const { content, navGroup, approvalViews, approvalStatusSelect } = useWorkspaceTargets(taskRoute)

  useEffect(() => {
    const sync = () => setTaskRoute(routeFromPath())
    window.addEventListener('popstate', sync)
    window.addEventListener('hi5-routechange', sync)
    const timer = window.setInterval(sync, 250)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hi5-routechange', sync); window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    if (!content || !taskRoute) return undefined
    content.classList.add('production-task-mounted')
    return () => content.classList.remove('production-task-mounted')
  }, [content, taskRoute])

  useEffect(() => {
    if (!approvalStatusSelect) { setAwaitingActive(false); return undefined }
    const sync = () => setAwaitingActive(approvalStatusSelect.value === 'Pending Approval')
    sync()
    approvalStatusSelect.addEventListener('change', sync)
    return () => approvalStatusSelect.removeEventListener('change', sync)
  }, [approvalStatusSelect])

  function showAwaitingApproval() {
    if (!approvalStatusSelect) return
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set
    if (setter) setter.call(approvalStatusSelect, 'Pending Approval')
    else approvalStatusSelect.value = 'Pending Approval'
    approvalStatusSelect.dispatchEvent(new Event('change', { bubbles: true }))
  }

  return (
    <>
      {navGroup ? createPortal(<TaskNavButton active={Boolean(taskRoute)} />, navGroup) : null}
      {approvalViews ? createPortal(<AwaitingApprovalButton active={awaitingActive} onClick={showAwaitingApproval} />, approvalViews) : null}
      {taskRoute && content ? createPortal(taskRoute.kind === 'detail' ? <TaskDetail taskKey={taskRoute.taskKey} /> : <TaskQueue />, content) : null}
    </>
  )
}
