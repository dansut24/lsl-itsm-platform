import { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, CheckCircle2, ChevronRight, Clock3, Filter,
  History, ListChecks, Monitor, Package, RefreshCw, Search, Server, ShieldCheck,
  TerminalSquare, User, X, XCircle,
} from 'lucide-react'
import { deploymentConfig } from '../../lib/deploymentConfig.js'
import './RmmActivityViews.css'

const API_BASE = window.__HI5_API_BASE__ || deploymentConfig().apiUrl
const deviceHistoryCache = new Map()
const HISTORY_CACHE_MS = 30000

function historyCacheGet(key) {
  const entry = deviceHistoryCache.get(key)
  return entry && Date.now() - entry.savedAt < HISTORY_CACHE_MS ? entry.value : null
}
function historyCacheSet(key, value) {
  deviceHistoryCache.set(key, { value, savedAt: Date.now() })
}

async function apiJson(path) {
  const response = await fetch(API_BASE + path, { credentials: 'include' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Unable to load RMM data.')
  return payload
}

function formatWhen(value) {
  if (!value) return 'Not reported'
  try { return new Date(value).toLocaleString() } catch { return String(value) }
}
function durationBetween(start, end) {
  if (!start || !end) return ''
  const seconds = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000))
  if (seconds < 60) return seconds + 's'
  const minutes = Math.floor(seconds / 60)
  const remain = seconds % 60
  return remain ? minutes + 'm ' + remain + 's' : minutes + 'm'
}
function jobLabel(type = '') {
  const map = {
    'software.uninstall': 'Uninstall software',
    'process.kill': 'End process',
    'process.restart': 'Restart process',
    'processes.list': 'Read processes',
    'services.list': 'Read services',
    'services.start': 'Start service',
    'services.stop': 'Stop service',
    'services.restart': 'Restart service',
    'services.set_start_type': 'Change service startup',
    'registry.list': 'Read registry',
    'registry.create_key': 'Create registry key',
    'registry.delete_key': 'Delete registry key',
    'registry.set_value': 'Change registry value',
    'registry.delete_value': 'Delete registry value',
    'events.list': 'Read event log',
    'files.list': 'Read files',
    'inventory.scan': 'Refresh inventory',
  }
  return map[type] || String(type || 'Device job').replaceAll('.', ' ')
}
function outcomeTone(value = '') {
  const normalized = String(value).toLowerCase()
  if (['success', 'completed'].includes(normalized)) return 'healthy'
  if (['failed', 'critical'].includes(normalized)) return 'critical'
  if (['running', 'claimed'].includes(normalized)) return 'running'
  if (['queued', 'requested', 'warning'].includes(normalized)) return 'warning'
  return 'neutral'
}
function activityIcon(category = '') {
  if (category === 'terminal') return TerminalSquare
  if (category === 'remote') return Monitor
  if (category === 'software') return Package
  if (category === 'service') return Server
  if (category === 'security') return ShieldCheck
  if (category === 'job') return ListChecks
  return Activity
}

function SkeletonRows({ count = 6 }) {
  return <div className="rmm-audit-skeleton" aria-label="Loading">
    {Array.from({ length: count }).map((_, index) => <div key={index}><span /><div><b /><i /></div><em /></div>)}
  </div>
}

function DetailModal({ detail, loading, onClose }) {
  if (!detail && !loading) return null
  const isTool = detail?.kind === 'tool'
  const payload = detail?.data || {}
  const title = isTool
    ? ((payload.shell === 'cmd' ? 'Command Prompt' : payload.shell === 'powershell' ? 'PowerShell' : payload.tool) + ' session')
    : jobLabel(payload.job_type)
  return <div className="rmm-audit-modal-backdrop" role="presentation">
    <section className="rmm-audit-modal" role="dialog" aria-modal="true" aria-label="Activity details">
      <header><div><span className="rmm-eyebrow">RMM audit detail</span><h2>{loading ? 'Loading details…' : title}</h2></div><button onClick={onClose} type="button" aria-label="Close"><X size={18} /></button></header>
      {loading ? <SkeletonRows count={4} /> : <>
        <div className="rmm-audit-detail-grid">
          <span><small>Status</small><strong>{payload.status || 'Completed'}</strong></span>
          <span><small>Technician</small><strong>{payload.initiated_by_label || payload.initiatedByLabel || 'SYSTEM'}</strong></span>
          <span><small>Started</small><strong>{formatWhen(payload.started_at || payload.created_at)}</strong></span>
          <span><small>Finished</small><strong>{formatWhen(payload.ended_at || payload.completed_at)}</strong></span>
          {isTool && <span><small>Commands</small><strong>{payload.command_count ?? 0}</strong></span>}
          {isTool && <span><small>Duration</small><strong>{durationBetween(payload.started_at, payload.ended_at) || '—'}</strong></span>}
        </div>
        {isTool ? <div className="rmm-audit-transcript">
          <div><strong>Session transcript</strong>{payload.transcript_truncated && <span>Transcript truncated at audit limit</span>}</div>
          <pre>{payload.transcript || 'No terminal output was captured for this session.'}</pre>
        </div> : <>
          <div className="rmm-audit-json-section"><strong>Request</strong><pre>{JSON.stringify(payload.payload || {}, null, 2)}</pre></div>
          <div className="rmm-audit-json-section"><strong>Result</strong><pre>{JSON.stringify(payload.result || {}, null, 2)}</pre></div>
          {payload.error_message && <div className="rmm-audit-error"><AlertTriangle size={15} />{payload.error_message}</div>}
        </>}
      </>}
    </section>
  </div>
}

function ActivityRow({ event, onDetails }) {
  const Icon = activityIcon(event.category)
  const canOpen = Boolean(event.job_id || event.tool_session_id)
  return <article className="rmm-audit-event">
    <span className={'rmm-audit-event-icon ' + outcomeTone(event.outcome)}><Icon size={16} /></span>
    <div className="rmm-audit-event-copy">
      <strong>{event.summary}</strong>
      {event.detail && <p>{event.detail}</p>}
      <small>{formatWhen(event.created_at)} · {event.device_name || 'Device'} · {event.actor_label || 'SYSTEM'}</small>
    </div>
    <span className={'rmm-audit-outcome ' + outcomeTone(event.outcome)}>{event.outcome || 'info'}</span>
    {canOpen && <button className="rmm-audit-details-button" onClick={() => onDetails(event)} type="button">Details <ChevronRight size={13} /></button>}
  </article>
}

function useActivityDetails() {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  async function open(event) {
    setLoading(true)
    setDetail({ kind: event.tool_session_id ? 'tool' : 'job', data: {} })
    try {
      if (event.tool_session_id) {
        const payload = await apiJson('/api/v1/rmm/tool-sessions/' + encodeURIComponent(event.tool_session_id))
        setDetail({ kind: 'tool', data: payload.session || {} })
      } else if (event.job_id) {
        const payload = await apiJson('/api/v1/rmm/device-actions/' + encodeURIComponent(event.job_id))
        setDetail({ kind: 'job', data: payload.job || {} })
      }
    } catch (error) {
      setDetail({ kind: 'job', data: { status: 'failed', error_message: error.message } })
    } finally {
      setLoading(false)
    }
  }
  return { detail, loading, open, close: () => { setDetail(null); setLoading(false) } }
}

export async function prefetchDeviceHistory(device) {
  if (!device?.agentDeviceId) return
  const activityKey = 'activity:' + device.agentDeviceId
  const jobsKey = 'jobs:' + device.agentDeviceId
  const tasks = []
  if (!historyCacheGet(activityKey)) {
    tasks.push(apiJson('/api/v1/rmm/devices/' + encodeURIComponent(device.agentDeviceId) + '/activity?limit=120')
      .then((payload) => historyCacheSet(activityKey, payload.events || []))
      .catch(() => {}))
  }
  if (!historyCacheGet(jobsKey)) {
    tasks.push(apiJson('/api/v1/rmm/devices/' + encodeURIComponent(device.agentDeviceId) + '/actions?limit=100')
      .then((payload) => historyCacheSet(jobsKey, payload.jobs || []))
      .catch(() => {}))
  }
  await Promise.all(tasks)
}

export function DeviceActivityTimeline({ device }) {
  const initialEvents = device?.agentDeviceId ? historyCacheGet('activity:' + device.agentDeviceId) : null
  const [events, setEvents] = useState(() => initialEvents || [])
  const [loading, setLoading] = useState(!initialEvents)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('')
  const details = useActivityDetails()

  async function load(silent = false) {
    if (!device?.agentDeviceId) { setLoading(false); setEvents([]); return }
    if (!silent) setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: '120' })
      if (category) params.set('category', category)
      const payload = await apiJson('/api/v1/rmm/devices/' + encodeURIComponent(device.agentDeviceId) + '/activity?' + params.toString())
      const nextEvents = payload.events || []
      setEvents(nextEvents)
      if (!category) historyCacheSet('activity:' + device.agentDeviceId, nextEvents)
    } catch (err) {
      if (!silent) { setError(err.message); setEvents([]) }
    } finally { if (!silent) setLoading(false) }
  }
  useEffect(() => {
    const cached = !category && device?.agentDeviceId ? historyCacheGet('activity:' + device.agentDeviceId) : null
    load(Boolean(cached))
  }, [device?.agentDeviceId, category])

  return <section className="rmm-audit-card">
    <div className="rmm-device-section-heading">
      <div><span className="rmm-eyebrow">Device history</span><h2>Activity</h2><p>Technician actions, remote sessions, jobs and Agent-detected changes for this device.</p></div>
      <div className="rmm-audit-toolbar compact">
        <select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All activity</option><option value="remote">Remote</option><option value="terminal">Terminal</option><option value="files">Files</option><option value="software">Software</option><option value="process">Processes</option><option value="service">Services</option><option value="registry">Registry</option><option value="security">Security</option><option value="updates">Updates</option><option value="session">Sessions</option><option value="inventory">Inventory</option><option value="device">Device</option><option value="job">Jobs</option></select>
        <button onClick={load} type="button"><RefreshCw size={14} /> Refresh</button>
      </div>
    </div>
    {loading ? <SkeletonRows /> : error ? <div className="rmm-audit-empty"><AlertTriangle size={22} /><strong>Activity could not be loaded</strong><span>{error}</span></div> : events.length ? <div className="rmm-audit-timeline">{events.map((event) => <ActivityRow event={event} key={event.id} onDetails={details.open} />)}</div> : <div className="rmm-audit-empty"><History size={24} /><strong>No activity recorded yet</strong><span>New remote sessions, terminal work, jobs and Agent-detected changes will appear here automatically.</span></div>}
    <DetailModal detail={details.detail} loading={details.loading} onClose={details.close} />
  </section>
}

export function DeviceJobsPanel({ device }) {
  const initialJobs = device?.agentDeviceId ? historyCacheGet('jobs:' + device.agentDeviceId) : null
  const [jobs, setJobs] = useState(() => initialJobs || [])
  const [loading, setLoading] = useState(!initialJobs)
  const [error, setError] = useState('')
  const [selectedJob, setSelectedJob] = useState(null)

  async function load(silent = false) {
    if (!device?.agentDeviceId) { setLoading(false); setJobs([]); return }
    if (!silent) setLoading(true)
    try {
      const payload = await apiJson('/api/v1/rmm/devices/' + encodeURIComponent(device.agentDeviceId) + '/actions?limit=100')
      const nextJobs = payload.jobs || []
      setJobs(nextJobs)
      historyCacheSet('jobs:' + device.agentDeviceId, nextJobs)
      setError('')
    } catch (err) { if (!silent) setError(err.message) } finally { if (!silent) setLoading(false) }
  }
  useEffect(() => {
    const cached = device?.agentDeviceId ? historyCacheGet('jobs:' + device.agentDeviceId) : null
    load(Boolean(cached))
    const timer = window.setInterval(() => {
      if (jobs.some((job) => ['queued', 'claimed'].includes(job.status))) load(true)
    }, 2500)
    return () => window.clearInterval(timer)
  }, [device?.agentDeviceId, jobs.some((job) => ['queued', 'claimed'].includes(job.status))])

  return <section className="rmm-audit-card">
    <div className="rmm-device-section-heading"><div><span className="rmm-eyebrow">Execution history</span><h2>Jobs</h2><p>Queued, running, successful and failed work for this device only.</p></div><button className="rmm-audit-refresh" onClick={() => load()} type="button"><RefreshCw size={14} /> Refresh</button></div>
    {loading ? <SkeletonRows /> : error ? <div className="rmm-audit-empty"><AlertTriangle size={22} /><strong>Jobs could not be loaded</strong><span>{error}</span></div> : jobs.length ? <div className="rmm-device-jobs">
      <div className="rmm-device-job-head"><span>Job</span><span>Status</span><span>Requested by</span><span>Started</span><span>Duration</span><span /></div>
      {jobs.map((job) => <button className="rmm-device-job-row" key={job.id} onClick={() => setSelectedJob({ kind: 'job', data: job })} type="button">
        <span><strong>{jobLabel(job.job_type)}</strong><small>{job.job_type}</small></span>
        <span className={'rmm-audit-outcome ' + outcomeTone(job.status)}>{job.status}</span>
        <span>{job.initiated_by_label || job.initiated_by || 'SYSTEM'}</span>
        <span>{formatWhen(job.claimed_at || job.created_at)}</span>
        <span>{durationBetween(job.claimed_at || job.created_at, job.completed_at || job.updated_at) || '—'}</span>
        <ChevronRight size={15} />
      </button>)}
    </div> : <div className="rmm-audit-empty"><ListChecks size={24} /><strong>No jobs for this device</strong><span>Device actions, maintenance and automation jobs will appear here.</span></div>}
    <DetailModal detail={selectedJob} loading={false} onClose={() => setSelectedJob(null)} />
  </section>
}

export function RmmAuditActivity({ devices = [] }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ q: '', actor: '', agentDeviceId: '', category: '', outcome: '', from: '', to: '' })
  const [applied, setApplied] = useState(filters)
  const details = useActivityDetails()

  async function load(next = applied) {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ limit: '200' })
      Object.entries(next).forEach(([key, value]) => {
        if (!value) return
        if (key === 'from') params.set(key, value + 'T00:00:00')
        else if (key === 'to') params.set(key, value + 'T23:59:59')
        else params.set(key, value)
      })
      const payload = await apiJson('/api/v1/rmm/activity?' + params.toString())
      setEvents(payload.events || [])
    } catch (err) { setError(err.message); setEvents([]) } finally { setLoading(false) }
  }
  useEffect(() => { load(applied) }, [applied])

  function apply(event) { event.preventDefault(); setApplied({ ...filters }) }
  function clear() {
    const empty = { q: '', actor: '', agentDeviceId: '', category: '', outcome: '', from: '', to: '' }
    setFilters(empty); setApplied(empty)
  }

  const categories = useMemo(() => ['remote', 'terminal', 'files', 'software', 'process', 'service', 'registry', 'security', 'updates', 'session', 'inventory', 'device', 'job'], [])
  return <>
    <div className="rmm-page-heading"><div><span className="rmm-eyebrow">Administration</span><h1>RMM activity audit</h1><p>Tenant-wide immutable operational history, filterable by device, technician, activity and outcome.</p></div></div>
    <form className="rmm-audit-filters" onSubmit={apply}>
      <label className="wide"><Search size={15} /><input value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} placeholder="Search activity, devices or details…" /></label>
      <label><User size={14} /><input value={filters.actor} onChange={(event) => setFilters((current) => ({ ...current, actor: event.target.value }))} placeholder="Technician" /></label>
      <select value={filters.agentDeviceId} onChange={(event) => setFilters((current) => ({ ...current, agentDeviceId: event.target.value }))}><option value="">All devices</option>{devices.filter((device) => device.agentDeviceId).map((device) => <option key={device.agentDeviceId} value={device.agentDeviceId}>{device.name}</option>)}</select>
      <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}><option value="">All categories</option>{categories.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select>
      <select value={filters.outcome} onChange={(event) => setFilters((current) => ({ ...current, outcome: event.target.value }))}><option value="">All outcomes</option><option value="success">Success</option><option value="failed">Failed</option><option value="requested">Requested</option><option value="running">Running</option><option value="info">Info</option></select>
      <label><Clock3 size={14} /><input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} /></label>
      <label><Clock3 size={14} /><input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} /></label>
      <button className="rmm-primary compact" type="submit"><Filter size={14} /> Apply</button>
      <button onClick={clear} type="button">Clear</button>
    </form>
    <section className="rmm-audit-card">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Audit stream</span><h2>{events.length} activities</h2></div><button onClick={() => load()} type="button"><RefreshCw size={14} /> Refresh</button></div>
      {loading ? <SkeletonRows count={8} /> : error ? <div className="rmm-audit-empty"><XCircle size={24} /><strong>Audit log could not be loaded</strong><span>{error}</span></div> : events.length ? <div className="rmm-audit-timeline admin">{events.map((event) => <ActivityRow event={event} key={event.id} onDetails={details.open} />)}</div> : <div className="rmm-audit-empty"><CheckCircle2 size={24} /><strong>No matching activity</strong><span>Adjust the filters or wait for managed-device activity to be recorded.</span></div>}
    </section>
    <DetailModal detail={details.detail} loading={details.loading} onClose={details.close} />
  </>
}

export { SkeletonRows }
