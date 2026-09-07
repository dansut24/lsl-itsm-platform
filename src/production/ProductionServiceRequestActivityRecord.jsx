import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Coins,
  FileText,
  MessageSquareText,
  RefreshCw,
  Save,
  ShieldCheck,
  UserRoundCog,
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
import './ProductionActivityCanvasRecord.css'
import './ProductionActivityActionRecord.css'
import './ProductionServiceRequestActivityRecord.css'

const API_BASE = window.__HI5_API_BASE__
const SERVICE_REQUEST_STATUSES = ['New', 'Pending Approval', 'Approved', 'In Progress', 'Completed', 'Closed', 'Rejected']

function routeState() {
  const match = window.location.pathname.match(/^\/requests\/([^/]+)\/?$/i)
  if (!match || match[1].toLowerCase() === 'new') return null
  return { section: 'requests', type: 'Service Request', reference: decodeURIComponent(match[1]) }
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function money(value, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0))
}

function slug(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

async function apiJson(path) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'The request could not be completed.')
  return payload
}

function formFor(detail) {
  return {
    priority: detail?.priority || 'Medium',
    team: detail?.team || '',
    assignee: detail?.assignee || 'Unassigned',
    completionNotes: detail?.operationalData?.completionNotes || '',
    reopenReason: detail?.operationalData?.reopenReason || '',
    approvalNote: detail?.operationalData?.approvalNote || '',
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

function Field({ label, children, hint }) {
  return <label className="activity-canvas-field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>
}

function InspectorRow({ label, value, meta, count, onClick }) {
  return <button type="button" className="activity-canvas-inspector-row" onClick={onClick}><span><small>{label}</small><strong>{value || 'Not recorded'}</strong>{meta ? <em>{meta}</em> : null}</span>{count !== undefined ? <b>{count}</b> : null}<ChevronRight size={17} /></button>
}

function RequestActivityItem({ item }) {
  const isCustomer = item.kind === 'customer' || item.visibility === 'customer'
  const isSystem = !['work', 'customer'].includes(item.kind) && !['internal', 'customer'].includes(item.visibility)
  if (isSystem) return <div className="service-request-activity-system"><i /><span>{item.text || item.label || 'Request updated'}</span><time>{formatDate(item.createdAt)}</time></div>
  const kind = isCustomer ? 'customer' : 'internal'
  return <article className={`activity-canvas-message is-${kind}`}>
    <div className="activity-canvas-avatar">{String(item.actor || 'H').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>
    <div className="activity-canvas-message-card">
      <header><div><strong>{item.actor || 'Hi5Central'}</strong><span>{formatDate(item.createdAt)}</span></div><div><em>{isCustomer ? 'Customer visible' : 'Internal note'}</em></div></header>
      <p>{item.text || ''}</p>
    </div>
  </article>
}

function Skeleton() {
  return <section className="activity-canvas-shell is-loading" aria-label="Loading service request"><header className="activity-canvas-top"><div className="activity-canvas-skeleton is-heading" /><div className="activity-canvas-skeleton is-actions" /></header><div className="activity-canvas-skeleton is-ribbon" /><div className="activity-canvas-body"><aside><div className="activity-canvas-skeleton is-inspector" /></aside><main><div className="activity-canvas-skeleton is-activity-head" />{Array.from({ length: 4 }, (_, index) => <div className="activity-canvas-skeleton is-message" key={index} />)}<div className="activity-canvas-skeleton is-action-dock" /></main></div></section>
}

function ServiceRequestWorkbench({ route }) {
  const [detail, setDetail] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [inspectorView, setInspectorView] = useState('home')
  const [mobileDetails, setMobileDetails] = useState(false)
  const [activityFilter, setActivityFilter] = useState('all')
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerVisibility, setComposerVisibility] = useState('internal')
  const [composerText, setComposerText] = useState('')
  const listRef = useRef(null)

  async function load({ quiet = false } = {}) {
    if (!quiet) setLoading(true)
    setError('')
    try {
      const payload = await loadServiceRequest(route.reference)
      setDetail(payload)
      setForm(formFor(payload))
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      if (!quiet) setLoading(false)
    }
  }

  useEffect(() => { void load() }, [route.reference])

  useEffect(() => {
    if (!detail?.id) return
    const timer = window.setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
    }, 0)
    return () => window.clearTimeout(timer)
  }, [detail?.id])

  function openInspector(view) {
    setInspectorView(view)
    if (window.matchMedia('(max-width: 700px)').matches) setMobileDetails(true)
  }

  async function saveCore() {
    if (!detail) return
    setSaving(true); setError(''); setNotice('')
    try {
      await patchProductionServiceRequest(route.reference, {
        priority: form.priority,
        team: form.team,
        assignee: form.assignee,
      })
      await load({ quiet: true })
      setNotice('Request assignment saved')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(status) {
    if (!detail || status === detail.status) return
    setSaving(true); setError(''); setNotice('')
    try {
      await transitionProductionServiceRequest(route.reference, status, {
        completionNotes: form.completionNotes,
        reopenReason: form.reopenReason,
        approvalNote: form.approvalNote,
      })
      await load({ quiet: true })
      setNotice(`Status changed to ${status}`)
    } catch (transitionError) {
      setError(transitionError.message)
    } finally {
      setSaving(false)
    }
  }

  async function postActivity() {
    if (!composerText.trim()) return
    setSaving(true); setError(''); setNotice('')
    try {
      await addProductionServiceRequestActivity(route.reference, {
        kind: composerVisibility === 'customer' ? 'customer' : 'work',
        text: composerText.trim(),
        html: '',
        attachments: [],
      })
      setComposerText('')
      setComposerOpen(false)
      await load({ quiet: true })
      setNotice(composerVisibility === 'customer' ? 'Customer update sent' : 'Internal note added')
      window.setTimeout(() => {
        if (listRef.current) listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
      }, 0)
    } catch (activityError) {
      setError(activityError.message)
    } finally {
      setSaving(false)
    }
  }

  async function decideApproval(approval, decision) {
    setSaving(true); setError(''); setNotice('')
    try {
      await decideProductionServiceRequestApproval(route.reference, approval.id, decision, form.approvalNote || '')
      await load({ quiet: true })
      setNotice(`${approval.label} ${decision.toLowerCase()}`)
    } catch (approvalError) {
      setError(approvalError.message)
    } finally {
      setSaving(false)
    }
  }

  async function updateTask(task, status) {
    setSaving(true); setError(''); setNotice('')
    try {
      await patchProductionServiceRequestTask(route.reference, task.id, { status })
      await load({ quiet: true })
      setNotice(`${task.title} updated`)
    } catch (taskError) {
      setError(taskError.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Skeleton />
  if (!detail) return <section className="activity-canvas-shell"><div className="activity-canvas-failure"><strong>Could not open this Service Request</strong><span>{error}</span><button type="button" onClick={() => load()}>Retry</button></div></section>

  const people = detail.options?.people || []
  const teams = detail.options?.teams || []
  const activities = Array.isArray(detail.activities) ? detail.activities : []
  const requestInformation = Array.isArray(detail.requestInformation) ? detail.requestInformation : []
  const requestedItems = Array.isArray(detail.requestedItems) ? detail.requestedItems : []
  const approvals = Array.isArray(detail.requestApprovals) ? detail.requestApprovals : []
  const tasks = Array.isArray(detail.requestTasks) ? detail.requestTasks : []
  const pendingApprovals = approvals.filter((approval) => approval.status === 'Pending').length
  const completeTasks = tasks.filter((task) => task.status === 'Completed').length
  const isDirty = form.priority !== detail.priority || form.team !== detail.team || form.assignee !== detail.assignee
  const visibleActivities = activities.filter((item) => {
    const customer = item.kind === 'customer' || item.visibility === 'customer'
    const internal = item.kind === 'work' || item.visibility === 'internal'
    if (activityFilter === 'all') return true
    if (activityFilter === 'customer') return customer
    if (activityFilter === 'internal') return internal
    return !customer && !internal
  })

  function inspectorContent() {
    if (inspectorView === 'home') return <>
      <div className="activity-canvas-inspector-facts">
        <InspectorRow label="Requester" value={detail.requester || 'Not recorded'} meta={detail.requesterEmail} onClick={() => openInspector('request')} />
        <InspectorRow label="Service" value={detail.service || detail.catalogueItemTitle || 'Service Catalogue'} meta={detail.catalogueItemTitle || ''} onClick={() => openInspector('request')} />
        <InspectorRow label="Assignment" value={detail.team || 'Unassigned'} meta={detail.assignee || 'Unassigned'} onClick={() => openInspector('core')} />
      </div>
      <InspectorRow label="Request details" value="Submitted information" count={requestInformation.length} onClick={() => openInspector('request')} />
      <InspectorRow label="Items & cost" value={requestedItems.length ? `${requestedItems.length} catalogue item${requestedItems.length === 1 ? '' : 's'}` : 'No priced items'} meta={`${money(detail.oneOffCost, detail.currency)} one-off · ${money(detail.monthlyCost, detail.currency)}/mo`} onClick={() => openInspector('items')} />
      <InspectorRow label="Approvals" value={pendingApprovals ? `${pendingApprovals} pending` : approvals.length ? 'Approval complete' : 'No approval required'} count={approvals.length} onClick={() => openInspector('approvals')} />
      <InspectorRow label="Tasks" value={tasks.length ? `${completeTasks} of ${tasks.length} completed` : 'No fulfilment tasks'} count={tasks.length} onClick={() => openInspector('tasks')} />
      <InspectorRow label="Fulfilment" value={detail.nextStep || detail.status} meta={`Updated ${formatDate(detail.updatedAt)}`} onClick={() => openInspector('fulfilment')} />
    </>

    const back = <button type="button" className="activity-canvas-inspector-back" onClick={() => setInspectorView('home')}>← Record details</button>

    if (inspectorView === 'core') return <>{back}<div className="activity-canvas-inspector-form"><Field label="Priority"><select value={form.priority} onChange={(event) => setForm((value) => ({ ...value, priority: event.target.value }))}>{['Low','Medium','High','Critical'].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Assignment group"><select value={form.team} onChange={(event) => setForm((value) => ({ ...value, team: event.target.value }))}><option value="">Unassigned team</option>{teams.map((team) => <option key={team.id} value={team.name}>{team.name}</option>)}</select></Field><Field label="Assignee"><select value={form.assignee} onChange={(event) => setForm((value) => ({ ...value, assignee: event.target.value }))}><option>Unassigned</option>{people.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}</select></Field></div></>

    if (inspectorView === 'request') return <>{back}<div className="service-request-inspector-summary"><div className="service-request-inspector-card"><span>Requester</span><strong>{detail.requester || 'Not recorded'}</strong><small>{detail.requesterEmail || 'No email recorded'}</small></div><div className="service-request-inspector-card"><span>Description</span><strong>{detail.description || 'No description supplied.'}</strong></div><div className="service-request-answer-list">{requestInformation.length ? requestInformation.map((item, index) => <div className="service-request-answer" key={`${item.label}-${index}`}><span>{item.label}</span><strong>{item.value}</strong></div>) : <div className="activity-canvas-empty">No structured answers were submitted.</div>}</div></div></>

    if (inspectorView === 'items') return <>{back}<div className="service-request-item-list">{requestedItems.length ? requestedItems.map((item) => <div className="service-request-item" key={item.databaseId || item.id || item.name}><div><span><strong>{item.name}</strong><small>{item.category || 'Catalogue item'} · Qty {item.quantity || 1}</small></span><b>{Number(item.unitMonthlyCost || 0) > 0 ? `${money(item.unitMonthlyCost, item.currency)}/mo` : money(item.unitOneOffCost, item.currency)}</b></div></div>) : <div className="activity-canvas-empty">No priced items on this request.</div>}<div className="service-request-cost-total"><div><span>One-off</span><strong>{money(detail.oneOffCost, detail.currency)}</strong></div><div><span>Monthly</span><strong>{money(detail.monthlyCost, detail.currency)}</strong></div></div></div></>

    if (inspectorView === 'approvals') return <>{back}<div className="activity-canvas-inspector-form"><Field label="Approval note"><textarea rows="3" value={form.approvalNote} onChange={(event) => setForm((value) => ({ ...value, approvalNote: event.target.value }))} placeholder="Optional approval decision note" /></Field><div className="service-request-approval-list">{approvals.length ? approvals.map((approval) => <div className="service-request-approval" key={approval.id}><div><span><strong>{approval.label}</strong><small>{approval.approver || 'Approver'} · {approval.status}</small></span></div>{approval.status === 'Pending' ? <div className="service-request-approval-actions"><button type="button" disabled={saving} onClick={() => decideApproval(approval, 'Approved')}>Approve</button><button type="button" disabled={saving} onClick={() => decideApproval(approval, 'Rejected')}>Reject</button></div> : null}</div>) : <div className="activity-canvas-empty">No approval required.</div>}</div></div></>

    if (inspectorView === 'tasks') return <>{back}<div className="service-request-task-list">{tasks.length ? tasks.map((task) => <div className="service-request-task" key={task.id}><div><span><strong>{task.title}</strong><small>{task.team || 'Unassigned team'} · {task.assignee || 'Unassigned'}{task.dueAt ? ` · due ${formatDate(task.dueAt)}` : ''}</small></span></div><select disabled={saving} value={task.status} onChange={(event) => updateTask(task, event.target.value)}>{[...new Set([task.status, 'Waiting','Ready','In Progress','Completed','Blocked'])].map((value) => <option key={value}>{value}</option>)}</select></div>) : <div className="activity-canvas-empty">No fulfilment tasks.</div>}</div></>

    if (inspectorView === 'fulfilment') return <>{back}<div className="activity-canvas-inspector-form"><div className="service-request-inspector-card"><span>Current state</span><strong>{detail.status}</strong><small>{detail.nextStep || 'Service Desk review and fulfilment'}</small></div><Field label="Completion notes"><textarea rows="5" value={form.completionNotes} onChange={(event) => setForm((value) => ({ ...value, completionNotes: event.target.value }))} placeholder="Required when completing the request" /></Field><Field label="Reopen reason"><textarea rows="4" value={form.reopenReason} onChange={(event) => setForm((value) => ({ ...value, reopenReason: event.target.value }))} placeholder="Used if this request is reopened" /></Field></div></>

    return null
  }

  return <section className="activity-canvas-shell production-motion-enter">
    <header className="activity-canvas-top"><div className="activity-canvas-title"><div><strong>{detail.id || detail.reference}</strong><span className={`activity-canvas-pill is-${slug(detail.status)}`}>{detail.status}</span><span className={`activity-canvas-pill is-${slug(detail.priority)}`}>{detail.priority}</span></div><input aria-label="Summary" readOnly value={detail.title || ''} /></div><div className="activity-canvas-commands"><button type="button" className="activity-canvas-mobile-details" onClick={() => setMobileDetails(true)}><ClipboardList size={17} />Details</button><label><span>Status</span><select disabled={saving} value={detail.status} onChange={(event) => changeStatus(event.target.value)}>{[...new Set([detail.status, ...SERVICE_REQUEST_STATUSES])].map((status) => <option key={status}>{status}</option>)}</select></label><button type="button" className="activity-canvas-icon" title="Reload latest" onClick={() => load({ quiet: true })}><RefreshCw size={17} /></button>{isDirty ? <button type="button" className="activity-canvas-primary" disabled={saving} onClick={saveCore}><Save size={17} />{saving ? 'Saving…' : 'Save'}</button> : null}</div></header>

    <div className="activity-canvas-ribbon"><span><b>Requester</b>{detail.requester || 'Not recorded'}</span><span><b>Service</b>{detail.service || detail.catalogueItemTitle || 'Service Catalogue'}</span><span><b>Assignment</b>{detail.team || 'Unassigned'} / {detail.assignee || 'Unassigned'}</span><span><b>Priority</b>{detail.priority}</span><span><b>Items</b>{requestedItems.length}</span><span><b>Cost</b>{money(detail.oneOffCost, detail.currency)} + {money(detail.monthlyCost, detail.currency)}/mo</span></div>

    {error ? <div className="activity-canvas-banner is-error"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={() => setError('')}><X size={15} /></button></div> : null}
    {notice ? <div className="activity-canvas-banner is-success"><CheckCircle2 size={17} /><span>{notice}</span><button type="button" onClick={() => setNotice('')}><X size={15} /></button></div> : null}

    <div className="activity-canvas-body">
      {mobileDetails ? <button type="button" className="activity-canvas-drawer-backdrop" aria-label="Close details" onClick={() => setMobileDetails(false)} /> : null}
      <aside className={`activity-canvas-inspector${mobileDetails ? ' is-mobile-open' : ''}`}><header><div><span>Record inspector</span><h2>{inspectorView === 'home' ? 'Details' : inspectorView.replace(/^./, (value) => value.toUpperCase())}</h2></div><button type="button" className="activity-canvas-drawer-close" onClick={() => setMobileDetails(false)}><X size={17} /></button></header><div className="activity-canvas-inspector-scroll">{inspectorContent()}</div>{isDirty ? <footer><button type="button" className="activity-canvas-primary" disabled={saving} onClick={saveCore}><Save size={16} />Save changes</button></footer> : null}</aside>

      <main className={`activity-canvas-activity${composerOpen ? ' has-composer' : ''}`}><header><div><span>Timeline</span><h2>Activity</h2></div><div className="activity-canvas-filters">{['all','internal','customer','system'].map((filter) => <button type="button" className={activityFilter === filter ? 'is-active' : ''} onClick={() => setActivityFilter(filter)} key={filter}>{filter[0].toUpperCase() + filter.slice(1)}</button>)}</div></header><div ref={listRef} className="activity-canvas-list">{visibleActivities.length ? visibleActivities.map((item) => <RequestActivityItem item={item} key={item.id} />) : <div className="activity-canvas-empty">No activity matches this filter.</div>}</div><div className="activity-action-dock"><div className="activity-action-strip"><button type="button" className={composerOpen && composerVisibility === 'internal' ? 'is-active' : ''} onClick={() => { setComposerVisibility('internal'); setComposerOpen(true) }} disabled={saving}><MessageSquareText size={15} />Internal note</button><button type="button" className={composerOpen && composerVisibility === 'customer' ? 'is-active' : ''} onClick={() => { setComposerVisibility('customer'); setComposerOpen(true) }} disabled={saving}><MessageSquareText size={15} />Customer update</button><button type="button" onClick={() => openInspector('core')} disabled={saving}><UserRoundCog size={15} />Reassign</button><i /><button type="button" onClick={() => openInspector('tasks')}><FileText size={15} />Tasks</button>{approvals.length ? <button type="button" onClick={() => openInspector('approvals')}><ShieldCheck size={15} />Approvals</button> : null}<button type="button" onClick={() => openInspector('items')}><Coins size={15} />Items & cost</button></div><button type="button" className="activity-canvas-composer-collapsed" onClick={() => setComposerOpen(true)}><MessageSquareText size={18} /><span>Add a note, customer update or manage fulfilment…</span><strong>Open composer</strong></button></div>{composerOpen ? <section className="activity-canvas-composer-tray service-request-composer"><div className="activity-action-composer-head"><div className="activity-action-strip"><button type="button" className={composerVisibility === 'internal' ? 'is-active' : ''} onClick={() => setComposerVisibility('internal')}><MessageSquareText size={15} />Internal note</button><button type="button" className={composerVisibility === 'customer' ? 'is-active' : ''} onClick={() => setComposerVisibility('customer')}><MessageSquareText size={15} />Customer update</button></div><button type="button" onClick={() => setComposerOpen(false)}><X size={17} />Close</button></div><textarea value={composerText} onChange={(event) => setComposerText(event.target.value)} placeholder={composerVisibility === 'customer' ? 'Write a customer-visible update…' : 'Write an internal work note…'} /><footer><span>{composerVisibility === 'customer' ? 'Visible to requester' : 'Technicians only'}</span><button type="button" className="activity-canvas-primary" disabled={saving || !composerText.trim()} onClick={postActivity}><MessageSquareText size={16} />{composerVisibility === 'customer' ? 'Send update' : 'Add note'}</button></footer></section> : null}</main>
    </div>
  </section>
}

export function ProductionServiceRequestActivityRecord() {
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
      document.querySelector('.content-frame')?.classList.remove('production-activity-canvas-mounted')
      return undefined
    }
    let mounted = null
    const attach = () => {
      const node = document.querySelector('.content-frame')
      if (!(node instanceof HTMLElement)) return false
      mounted = node
      node.classList.add('production-activity-canvas-mounted')
      setTarget(node)
      return true
    }
    if (attach()) return () => mounted?.classList.remove('production-activity-canvas-mounted')
    const observer = new MutationObserver(() => { if (attach()) observer.disconnect() })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      mounted?.classList.remove('production-activity-canvas-mounted')
    }
  }, [route])

  const key = useMemo(() => route ? `${route.type}:${route.reference}` : 'none', [route])
  if (!route || !target) return null
  return createPortal(<ServiceRequestWorkbench key={key} route={route} />, target)
}
