import { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowUp, Ban, Building2, Database, LogOut, Menu, Moon,
  PackageCheck, Pause, Play, Plus, RefreshCw, RotateCcw, Save, Search, ServerCog,
  ShieldCheck, Sun, Trash2, Wrench, X,
} from 'lucide-react'
import { deploymentConfig } from '../../lib/deploymentConfig.js'
import '../rmm/RmmPlatformApp.css'
import './PlatformAdminApp.css'

const config = deploymentConfig()
const API = config.apiUrl || `https://api.${config.rootDomain}`

const navigation = [
  { id:'overview', label:'Overview', section:'Platform', icon:Database },
  { id:'tenants', label:'Tenants', section:'Customers', icon:Building2 },
  { id:'qualification', label:'Qualification', section:'Software', icon:PackageCheck },
  { id:'catalogue', label:'Software catalogue', section:'Software', icon:ShieldCheck },
  { id:'audit', label:'Audit', section:'Governance', icon:Activity },
]
const pageMeta = {
  overview:['CONTROL PLANE','Platform overview','Hi5Central-wide operations, customers and software safety.'],
  tenants:['CUSTOMERS','Tenants','Create and manage customer products, status and commercial settings.'],
  qualification:['SOFTWARE SAFETY','Qualification','Qualification runners, active work and review outcomes.'],
  catalogue:['GLOBAL SOFTWARE INTELLIGENCE','Software catalogue','The approved global software catalogue consumed by customer RMM tenants.'],
  audit:['GOVERNANCE','Platform audit','Administrative actions performed in the Hi5Central control plane.'],
}

async function api(path, options = {}) {
  const response = await fetch(`${API}/api/platform/v1${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(body.error || 'Request failed.')
    error.status = response.status
    throw error
  }
  return body
}
function fmtDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', { dateStyle:'medium', timeStyle:'short' }).format(new Date(value))
}
function initials(name='HC') {
  return String(name).split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]?.toUpperCase()).join('') || 'HC'
}
function tone(value='') {
  const v=String(value).toLowerCase()
  if (['qualified','passed','active','connected','enabled'].includes(v)) return 'healthy'
  if (['review_required','failed','past_due','cancelled','suspended'].includes(v)) return 'critical'
  if (['deployment_candidate','queued','cleanup_pending','trial','pending_verification'].includes(v)) return 'warning'
  if (['running','cleanup_running'].includes(v)) return 'running'
  return 'neutral'
}
function StatusPill({ value }) {
  return <span className={`rmm-status-pill ${tone(value)}`}>{String(value||'unknown').replaceAll('_',' ')}</span>
}

function Login({ onLogin, theme, setTheme }) {
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  async function submit(event){
    event.preventDefault(); setBusy(true); setError('')
    try {
      const result=await api('/auth/login',{method:'POST',body:JSON.stringify({email,password})})
      onLogin(result.user)
    } catch(err){ setError(err.message) } finally { setBusy(false) }
  }
  return <div className="rmm-login" data-accent="amber" data-theme={theme}>
    <section className="rmm-login-panel">
      <div className="rmm-login-brand"><img src={`${import.meta.env.BASE_URL}hi5central-logo.png`} alt="Hi5Central"/><span>ADMIN</span></div>
      <div className="rmm-login-copy"><span className="rmm-eyebrow">HI5CENTRAL CONTROL PLANE</span><h1>Platform administration</h1><p>Manage tenants, qualification and the global software catalogue from the Hi5Central control plane.</p></div>
      <form className="rmm-login-form" onSubmit={submit}>
        <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required/></label>
        <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label>
        {error?<div className="rmm-login-error">{error}</div>:null}
        <button className="rmm-primary" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
      </form>
    </section>
    <section className="rmm-login-visual">
      <div className="rmm-login-visual-head"><button onClick={()=>setTheme(theme==='light'?'dark':'light')} type="button">{theme==='light'?<Moon size={18}/>:<Sun size={18}/>}</button></div>
      <div className="rmm-login-preview"><span className="rmm-eyebrow">PLATFORM OPERATIONS</span><h2>One control plane for every Hi5Central tenant.</h2><div className="rmm-login-preview-grid"><div><Building2/><strong>Tenants</strong><span>Products, billing and lifecycle</span></div><div><PackageCheck/><strong>Qualification</strong><span>Software safety and deployment readiness</span></div></div></div>
    </section>
  </div>
}
function AdminSidebar({ activeView, mobileOpen, navigate, onClose }) {
  const sections=[...new Set(navigation.map(item=>item.section))]
  return <>
    <button className={`rmm-sidebar-backdrop ${mobileOpen?'is-open':''}`} aria-label="Close navigation" onClick={onClose} type="button"/>
    <aside className={`rmm-sidebar ${mobileOpen?'mobile-open':''}`}>
      <div className="rmm-sidebar-brand">
        <img src={`${import.meta.env.BASE_URL}hi5central-logo.png`} alt="Hi5Central"/>
        <div><strong>Hi5Central</strong><span>ADMIN</span></div>
        <button className="rmm-mobile-close" onClick={onClose} type="button"><X size={19}/></button>
      </div>
      <div className="rmm-estate-chip"><span><ShieldCheck size={16}/></span><div><strong>Platform control plane</strong><small>Hi5Central internal administration</small></div></div>
      <nav className="rmm-nav">
        {sections.map(section=><div className="rmm-nav-section" key={section}><span>{section}</span>{navigation.filter(item=>item.section===section).map(({id,label,icon:Icon})=><button className={activeView===id?'active':''} key={id} onClick={()=>navigate(id)} type="button"><Icon size={17}/><span>{label}</span></button>)}</div>)}
      </nav>
      <div className="rmm-sidebar-footer"><div><span>HC</span><div><strong>Hi5Central</strong><small>Platform administration</small></div></div></div>
    </aside>
  </>
}

function AdminTopbar({ activeView, user, onLogout, onMenu, query, setQuery, theme, setTheme, refresh }) {
  const [,title]=pageMeta[activeView]
  return <header className="rmm-topbar">
    <div className="rmm-topbar-title"><button className="rmm-menu-button" onClick={onMenu} type="button"><Menu size={19}/></button><div><span>ADMIN</span><strong>{title}</strong></div></div>
    <label className="rmm-global-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search tenants, software, qualification…"/></label>
    <div className="rmm-topbar-actions"><button onClick={refresh} type="button" title="Refresh"><RefreshCw size={17}/></button><button onClick={()=>setTheme(theme==='light'?'dark':'light')} type="button">{theme==='light'?<Moon size={17}/>:<Sun size={17}/>}</button><button className="rmm-user" onClick={onLogout} type="button"><span>{initials(user?.name)}</span><div><strong>{user?.name||'Hi5Central admin'}</strong><small>{user?.role||'Sign out'}</small></div><LogOut size={14}/></button></div>
  </header>
}

function PageHeading({ view, action }) {
  const [eyebrow,title,description]=pageMeta[view]
  return <div className="rmm-page-heading"><div><span className="rmm-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>
}
function Overview({ data, refresh }) {
  const cards=[
    ['Tenants',data?.tenants?.active??0,`${data?.tenants?.total??0} total`,Building2,'blue'],
    ['Managed devices',data?.devices?.total??0,`${data?.devices?.online??0} online`,ServerCog,'green'],
    ['Qualified software',data?.catalogue?.qualified??0,`${data?.catalogue?.total??0} catalogue entries`,PackageCheck,'violet'],
    ['Qualification queue',data?.qualification?.active??0,`${data?.qualification?.review??0} need review`,Activity,'red'],
  ]
  return <>
    <PageHeading view="overview" action={<button className="rmm-primary compact" onClick={refresh}><RefreshCw size={14}/>Refresh</button>}/>
    <div className="rmm-metric-grid">{cards.map(([label,value,detail,Icon,color])=><button type="button" key={label}><span className={`rmm-metric-icon ${color}`}><Icon size={18}/></span><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></button>)}</div>
    <div className="rmm-card h5a-info-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">DEPLOYMENT SAFETY</span><h2>Qualification is platform-owned</h2></div></div><div className="h5a-card-body"><ShieldCheck size={22}/><p>Customer tenants consume only Hi5Central-approved software. Current-version install, verification and clean uninstall remain the deployment qualification gate.</p></div></div>
  </>
}

function TenantEditor({ tenant, onSaved }) {
  const [draft,setDraft]=useState(()=>({companyName:tenant.company_name,status:tenant.status,modules:{itsm:Boolean(tenant.modules?.itsm),rmm:Boolean(tenant.modules?.rmm)},planKey:tenant.plan_key||'custom',billingStatus:tenant.billing_status||'trial',billingCycle:tenant.billing_cycle||'monthly'}))
  const [busy,setBusy]=useState(false)
  async function save(){setBusy(true);try{await api(`/tenants/${tenant.id}`,{method:'PATCH',body:JSON.stringify(draft)});await onSaved()}finally{setBusy(false)}}
  return <div className="h5a-tenant-editor">
    <input value={draft.companyName} onChange={e=>setDraft({...draft,companyName:e.target.value})}/>
    <select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}><option value="active">Active</option><option value="pending_verification">Pending</option><option value="suspended">Suspended</option><option value="closed">Closed</option></select>
    <label className="h5a-check"><input type="checkbox" checked={draft.modules.itsm} onChange={e=>setDraft({...draft,modules:{...draft.modules,itsm:e.target.checked}})}/> ITSM</label>
    <label className="h5a-check"><input type="checkbox" checked={draft.modules.rmm} onChange={e=>setDraft({...draft,modules:{...draft.modules,rmm:e.target.checked}})}/> RMM</label>
    <input value={draft.planKey} onChange={e=>setDraft({...draft,planKey:e.target.value})} placeholder="Plan"/>
    <select value={draft.billingStatus} onChange={e=>setDraft({...draft,billingStatus:e.target.value})}><option value="trial">Trial</option><option value="active">Active</option><option value="past_due">Past due</option><option value="suspended">Suspended</option><option value="cancelled">Cancelled</option></select>
    <select value={draft.billingCycle} onChange={e=>setDraft({...draft,billingCycle:e.target.value})}><option value="monthly">Monthly</option><option value="annual">Annual</option><option value="custom">Custom</option></select>
    <button className="rmm-primary compact" onClick={save} disabled={busy}>{busy?'Saving…':'Save'}</button>
  </div>
}
function Tenants({ items, refresh, query }) {
  const [creating,setCreating]=useState(false)
  const [draft,setDraft]=useState({companyName:'',slug:'',modules:{itsm:true,rmm:false},planKey:'custom',billingStatus:'trial',billingCycle:'monthly'})
  const filtered=useMemo(()=>items.filter(t=>!query||t.company_name.toLowerCase().includes(query.toLowerCase())||t.slug.toLowerCase().includes(query.toLowerCase())),[items,query])
  async function create(event){event.preventDefault();await api('/tenants',{method:'POST',body:JSON.stringify(draft)});setCreating(false);setDraft({companyName:'',slug:'',modules:{itsm:true,rmm:false},planKey:'custom',billingStatus:'trial',billingCycle:'monthly'});await refresh()}
  return <>
    <PageHeading view="tenants" action={<button className="rmm-primary compact" onClick={()=>setCreating(!creating)}><Plus size={14}/>New tenant</button>}/>
    {creating?<form className="rmm-card h5a-create" onSubmit={create}><input placeholder="Company name" value={draft.companyName} onChange={e=>setDraft({...draft,companyName:e.target.value})} required/><input placeholder="tenant-slug" value={draft.slug} onChange={e=>setDraft({...draft,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'')})} required/><label className="h5a-check"><input type="checkbox" checked={draft.modules.itsm} onChange={e=>setDraft({...draft,modules:{...draft.modules,itsm:e.target.checked}})}/> ITSM</label><label className="h5a-check"><input type="checkbox" checked={draft.modules.rmm} onChange={e=>setDraft({...draft,modules:{...draft.modules,rmm:e.target.checked}})}/> RMM</label><button className="rmm-primary compact">Create tenant</button></form>:null}
    <div className="h5a-stack">{filtered.map(tenant=><article className="rmm-card" key={tenant.id}><div className="rmm-card-heading h5a-tenant-head"><div><span className="rmm-eyebrow">{tenant.slug}</span><h2>{tenant.company_name}</h2><p>{tenant.user_count} users · {tenant.device_count} devices</p></div><StatusPill value={tenant.status}/></div><TenantEditor tenant={tenant} onSaved={refresh}/></article>)}</div>
  </>
}

function DataTable({ rows, columns }) {
  if(!rows.length)return <div className="h5a-empty">No records.</div>
  return <div className="h5a-table-wrap"><table><thead><tr>{columns.map(c=><th key={c}>{c.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={row.id||index}>{columns.map(c=><td key={c}>{c==='state'||c==='qualification_state'?<StatusPill value={row[c]}/>:String(row[c]??'—')}</td>)}</tr>)}</tbody></table></div>
}

function QualificationQueueTable({ rows, recent = false, onAction, busyId }) {
  if (!rows.length) return <div className="h5a-empty">No qualification rows.</div>
  return <div className="h5a-table-wrap"><table><thead><tr>
    <th>Software</th><th>Version</th><th>State</th><th>Attempt</th><th>Last error</th><th>Actions</th>
  </tr></thead><tbody>{rows.map(row=><tr key={row.id}>
    <td><strong>{row.canonical_name}</strong><small className="h5a-cell-sub">{row.test_type}</small></td>
    <td>{row.target_version||'—'}</td><td><StatusPill value={row.state}/></td><td>{row.attempt_count??0}</td>
    <td className="h5a-error-cell">{row.last_error||'—'}</td>
    <td><div className="h5a-row-actions">
      {row.state==='queued'?<button className="rmm-secondary compact" disabled={busyId===row.id} onClick={()=>onAction(row,'run_now')}><Play size={13}/>Run now</button>:null}
      {['queued','running','cleanup_pending','cleanup_running'].includes(row.state)?<button className="rmm-secondary compact" disabled={busyId===row.id} onClick={()=>onAction(row,'cancel')}><Trash2 size={13}/>{row.state==='queued'?'Cancel':'Cancel safely'}</button>:null}
      {['review_required','cancelled','passed'].includes(row.state)?<button className="rmm-secondary compact" disabled={busyId===row.id} onClick={()=>onAction(row,'requeue')}><RotateCcw size={13}/>Requeue</button>:null}
      {['review_required','cancelled','cleanup_pending'].includes(row.state)?<button className="rmm-secondary compact" disabled={busyId===row.id} onClick={()=>onAction(row,'cleanup')}><Wrench size={13}/>Cleanup</button>:null}
    </div></td>
  </tr>)}</tbody></table></div>
}

function PendingPriorityControl({ row, busyId, onAction }) {
  const [priority,setPriority]=useState(String(row.priority ?? 100))
  useEffect(()=>{setPriority(String(row.priority ?? 100))},[row.priority])
  const waiting = row.retry_not_before && new Date(row.retry_not_before).getTime() > Date.now()
  return <div className="h5a-priority-control">
    <input
      type="number"
      min="1"
      step="1"
      value={priority}
      disabled={busyId===row.id}
      onChange={e=>setPriority(e.target.value)}
      title="Higher priority runs first within the same qualification stage."
    />
    <button className="rmm-secondary compact" disabled={busyId===row.id} onClick={()=>onAction(row,'set_priority',{priority:Number(priority)})}><Save size={12}/>Save</button>
    <button className="rmm-secondary compact" disabled={busyId===row.id} onClick={()=>onAction(row,'push_top')}><ArrowUp size={12}/>Top</button>
    {waiting?<span className="h5a-retry-wait">Wait until {fmtDate(row.retry_not_before)}</span>:null}
  </div>
}

function PendingQueueTable({ rows, onAction, busyId }) {
  if (!rows.length) return <div className="h5a-empty">Nothing is waiting in the qualification queue.</div>
  return <div className="h5a-table-wrap"><table><thead><tr>
    <th>#</th><th>Software</th><th>Version</th><th>Stage</th><th>Priority</th><th>Queued</th><th>Actions</th>
  </tr></thead><tbody>{rows.map(row=><tr key={row.id}>
    <td className="h5a-position">#{row.position}</td>
    <td><strong>{row.canonical_name}</strong>{row.last_error?<small className="h5a-cell-sub">{row.last_error}</small>:null}</td>
    <td>{row.target_version||'—'}</td>
    <td><span className="h5a-stage-label">{String(row.test_type||'').replaceAll('_',' ')}</span></td>
    <td><PendingPriorityControl row={row} busyId={busyId} onAction={onAction}/></td>
    <td>{fmtDate(row.created_at)}</td>
    <td><div className="h5a-row-actions">
      <button className="rmm-primary compact" disabled={busyId===row.id} onClick={()=>onAction(row,'run_now')}><Play size={12}/>Run now</button>
      <button className="rmm-secondary compact" disabled={busyId===row.id} onClick={()=>onAction(row,'cancel')}><Trash2 size={12}/>Cancel</button>
    </div></td>
  </tr>)}</tbody></table></div>
}

function Qualification({ data, query, refresh }) {
  const [busy,setBusy]=useState('')
  const [notice,setNotice]=useState('')
  const [error,setError]=useState('')
  const active=(data.active||[]).filter(r=>!query||r.canonical_name.toLowerCase().includes(query.toLowerCase()))
  const pending=(data.pending||[]).filter(r=>!query||r.canonical_name.toLowerCase().includes(query.toLowerCase()))
  const recent=(data.recent||[]).filter(r=>!query||r.canonical_name.toLowerCase().includes(query.toLowerCase()))
  async function runnerAction(runner,action){
    setBusy(runner.id);setError('');setNotice('')
    try{
      await api(`/qualification/runners/${runner.id}/action`,{method:'POST',body:JSON.stringify({action})})
      setNotice(
        action==='resume' ? 'Runner resumed.' :
        action==='reconcile' ? 'Current qualification state reconciled. No new software was dispatched.' :
        action==='run_next' ? 'Run-next requested. The next eligible queued application will dispatch if the lab is clean and idle.' :
        action==='cleanup_contaminants' ? 'Contaminant cleanup requested.' :
        'Runner will finish safe cleanup but dispatch no new software.'
      )
      await refresh()
    }catch(err){setError(err.message)}finally{setBusy('')}
  }
  async function queueAction(row,action,payload={}){
    setBusy(row.id);setError('');setNotice('')
    try{
      await api(`/qualification/queue/${row.id}/action`,{method:'POST',body:JSON.stringify({action,runNow:true,...payload})})
      const message =
        action==='cancel'&&row.state!=='queued' ? 'Safe cancellation requested; cleanup will complete before cancellation.' :
        action==='push_top' ? `${row.canonical_name} moved to the top of its pending stage.` :
        action==='set_priority' ? `${row.canonical_name} priority updated.` :
        `${row.canonical_name}: ${action.replaceAll('_',' ')} completed.`
      setNotice(message)
      await refresh()
    }catch(err){setError(err.message)}finally{setBusy('')}
  }
  return <>
    <PageHeading view="qualification"/>
    {notice?<div className="h5a-notice healthy">{notice}</div>:null}{error?<div className="h5a-page-error">{error}</div>:null}
    <div className="h5a-runner-grid">{(data.runners||[]).map(r=>{
      const paused=r.dispatch_enabled===false
      const contaminants=r.contaminants||[]
      return <article className="rmm-card h5a-runner h5a-runner-control" key={r.id}><ServerCog size={22}/><div className="h5a-runner-body"><span className="rmm-eyebrow">QUALIFICATION LAB</span><h2>{r.hostname||'Qualification lab'}</h2><p>Agent {r.agent_version||'—'} · PatchHost {r.patch_host_version||'—'}</p><div className="h5a-pill-row"><StatusPill value={r.websocket_status}/><StatusPill value={paused?'paused':'enabled'}/><StatusPill value={contaminants.length?'contaminated':'clean'}/>{r.pause_reason?<span className="h5a-runner-reason">{r.pause_reason}</span>:null}</div>{contaminants.length?<div className="h5a-contaminants"><AlertTriangle size={14}/><div><strong>{contaminants.length} contaminant{contaminants.length===1?'':'s'} detected</strong><span>{contaminants.map(x=>x.canonicalName).join(', ')}</span></div></div>:null}<div className="h5a-runner-actions">
        {paused?<button className="rmm-primary compact" disabled={busy===r.id} onClick={()=>runnerAction(r,'resume')}><Play size={13}/>Resume</button>:<><button className="rmm-secondary compact" disabled={busy===r.id} onClick={()=>runnerAction(r,'pause')}><Pause size={13}/>Pause</button><button className="rmm-secondary compact" disabled={busy===r.id} onClick={()=>runnerAction(r,'drain')}><Pause size={13}/>Drain</button></>}
        <button className="rmm-secondary compact" disabled={busy===r.id} onClick={()=>runnerAction(r,'reconcile')} title="Update the current qualification state only. This never starts another application."><RefreshCw size={13}/>Reconcile</button>
        <button className="rmm-primary compact" disabled={busy===r.id||paused} onClick={()=>runnerAction(r,'run_next')} title={paused?'Resume the runner before dispatching new software.':'Explicitly dispatch the next eligible queued application.'}><Play size={13}/>Run next</button>
        {contaminants.length?<button className="rmm-secondary compact danger" disabled={busy===r.id} onClick={()=>runnerAction(r,'cleanup_contaminants')}><Wrench size={13}/>Cleanup contaminant</button>:null}
      </div></div></article>})}</div>
    <div className="rmm-card h5a-table-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">CURRENT WORK</span><h2>Active qualification</h2><p>Only work currently installing, verifying or cleaning appears here. Safe cancel always cleans before cancellation.</p></div></div><QualificationQueueTable rows={active} onAction={queueAction} busyId={busy}/></div>
    <div className="rmm-card h5a-table-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">PENDING QUEUE</span><h2>What runs next</h2><p>{pending.length} queued item{pending.length===1?'':'s'}. Higher priority runs first within the same qualification stage. Push to top changes order only; Run now is the explicit dispatch action.</p></div><span className="h5a-result-count">{pending.length} queued</span></div><PendingQueueTable rows={pending} onAction={queueAction} busyId={busy}/></div>
    <div className="rmm-card h5a-table-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">OUTCOMES</span><h2>Recent qualification results</h2></div></div><QualificationQueueTable rows={recent} recent onAction={queueAction} busyId={busy}/></div>
  </>
}

function SoftwareDetail({ catalogueId, onClose, onChanged }) {
  const [detail,setDetail]=useState(null)
  const [draft,setDraft]=useState(null)
  const [busy,setBusy]=useState('')
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  async function load(){
    setError('')
    try{
      const result=await api(`/software/catalogue/${catalogueId}`)
      setDetail(result)
      const s=result.software
      setDraft({
        canonicalName:s.canonical_name||'',publisher:s.publisher||'',status:s.status||'active',
        installArguments:s.execution?.installArguments||'',
        installerTechnology:s.source_metadata?.installerTechnology||s.release_source_payload?.installerTechnology||'',
        expectedSigner:s.source_metadata?.expectedSigner||s.release_source_payload?.expectedSigner||'',
        qualificationNotes:s.qualification_notes||'',
        deploymentLimitation:s.source_metadata?.deploymentLimitation||'',
        verificationMethod:s.verification?.method||s.verification?.provider||'uninstall_registry',
        productCode:s.verification?.productCode||'',displayNameContains:s.verification?.displayNameContains||'',
        publisherContains:s.verification?.publisherContains||'',packageId:s.verification?.packageId||'',
        filePath:s.verification?.filePath||'',versionTransform:s.verification?.versionTransform||'',
      })
    }catch(err){setError(err.message)}
  }
  useEffect(()=>{load()},[catalogueId])
  async function action(name,request){
    setBusy(name);setError('');setNotice('')
    try{await request();setNotice(name+' completed.');await load();await onChanged?.()}catch(err){setError(err.message)}finally{setBusy('')}
  }
  if(!detail||!draft)return <section className="rmm-card h5a-software-detail"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">SOFTWARE MANAGEMENT</span><h2>Loading…</h2></div><button className="rmm-secondary compact" onClick={onClose}><X size={14}/>Close</button></div>{error?<div className="h5a-page-error">{error}</div>:null}</section>
  const s=detail.software
  const verification={
    ...(s.verification||{}),method:draft.verificationMethod,productCode:draft.productCode,
    displayNameContains:draft.displayNameContains,publisherContains:draft.publisherContains,
    packageId:draft.packageId,filePath:draft.filePath,versionTransform:draft.versionTransform,
  }
  return <section className="rmm-card h5a-software-detail">
    <div className="rmm-card-heading"><div><span className="rmm-eyebrow">SOFTWARE MANAGEMENT</span><h2>{s.canonical_name}</h2><p>{s.target_version||'No target version'} · {s.source_key||'No source'}</p></div><div className="h5a-row-actions"><StatusPill value={s.qualification_state}/><button className="rmm-secondary compact" onClick={onClose}><X size={14}/>Close</button></div></div>
    {notice?<div className="h5a-notice healthy">{notice}</div>:null}{error?<div className="h5a-page-error">{error}</div>:null}
    <div className="h5a-software-actions">
      <button className="rmm-primary compact" disabled={busy} onClick={()=>action('Requeue',()=>api(`/software/catalogue/${catalogueId}/requeue`,{method:'POST',body:JSON.stringify({runNow:true})}))}><RotateCcw size={14}/>Requeue + run</button>
      <button className="rmm-secondary compact" disabled={busy} onClick={()=>action('Source revalidation',()=>api(`/software/catalogue/${catalogueId}/revalidate`,{method:'POST',body:'{}'}))}><RefreshCw size={14}/>Revalidate source</button>
      <button className="rmm-secondary compact" disabled={busy} onClick={()=>action(draft.status==='active'?'Disable':'Enable',()=>api(`/software/catalogue/${catalogueId}`,{method:'PATCH',body:JSON.stringify({status:draft.status==='active'?'disabled':'active'})}))}>{draft.status==='active'?<Ban size={14}/>:<Play size={14}/>} {draft.status==='active'?'Disable deployment':'Enable deployment'}</button>
    </div>
    <div className="h5a-detail-grid">
      <div className="h5a-detail-section"><h3>Identity & deployment</h3>
        <label>Canonical name<input value={draft.canonicalName} onChange={e=>setDraft({...draft,canonicalName:e.target.value})}/></label>
        <label>Publisher<input value={draft.publisher} onChange={e=>setDraft({...draft,publisher:e.target.value})}/></label>
        <label>Target version<input value={s.target_version||''} disabled/></label>
        <label>Installer technology<input value={draft.installerTechnology} onChange={e=>setDraft({...draft,installerTechnology:e.target.value})}/></label>
        <label>Install arguments<textarea value={draft.installArguments} onChange={e=>setDraft({...draft,installArguments:e.target.value})}/></label>
        <label>Expected signer<input value={draft.expectedSigner} onChange={e=>setDraft({...draft,expectedSigner:e.target.value})}/></label>
      </div>
      <div className="h5a-detail-section"><h3>Verification</h3>
        <label>Method<select value={draft.verificationMethod} onChange={e=>setDraft({...draft,verificationMethod:e.target.value})}><option value="uninstall_registry">Uninstall registry</option><option value="winget">WinGet</option><option value="file_version">File version</option></select></label>
        <label>ProductCode<input value={draft.productCode} onChange={e=>setDraft({...draft,productCode:e.target.value})}/></label>
        <label>Display name contains<input value={draft.displayNameContains} onChange={e=>setDraft({...draft,displayNameContains:e.target.value})}/></label>
        <label>Publisher contains<input value={draft.publisherContains} onChange={e=>setDraft({...draft,publisherContains:e.target.value})}/></label>
        <label>Package ID<input value={draft.packageId} onChange={e=>setDraft({...draft,packageId:e.target.value})}/></label>
        <label>File path<input value={draft.filePath} onChange={e=>setDraft({...draft,filePath:e.target.value})}/></label>
      </div>
      <div className="h5a-detail-section"><h3>Qualification & limitation</h3>
        <label>Limitation<select value={draft.deploymentLimitation} onChange={e=>setDraft({...draft,deploymentLimitation:e.target.value})}><option value="">None</option><option value="user_scope_only">User scope only</option><option value="vendor_install_failure">Vendor install failure</option><option value="vendor_install_rollback">Vendor install rollback</option><option value="response_file_required">Response file required</option><option value="reboot_prerequisite">Reboot prerequisite</option><option value="vendor_silent_uninstall_unsupported">Silent uninstall unsupported</option><option value="interactive_setup_required">Interactive setup required</option><option value="source_unavailable">Source unavailable</option><option value="architecture_unsupported">Architecture unsupported</option><option value="other">Other</option></select></label>
        <label>Qualification notes<textarea value={draft.qualificationNotes} onChange={e=>setDraft({...draft,qualificationNotes:e.target.value})}/></label>
        <div className="h5a-detail-facts"><span>Source health <strong>{s.source_last_error?'Error':'Healthy'}</strong></span><span>Artifact trust <strong>{s.trust_state||'—'}</strong></span><span>Installer SHA <strong>{s.installer_sha256?'Present':'Missing'}</strong></span><span>Current status <strong>{s.status}</strong></span></div>
      </div>
    </div>
    <div className="h5a-detail-save">
      <button className="rmm-primary compact" disabled={busy} onClick={()=>action('Save',()=>api(`/software/catalogue/${catalogueId}`,{method:'PATCH',body:JSON.stringify({canonicalName:draft.canonicalName,publisher:draft.publisher,installArguments:draft.installArguments,installerTechnology:draft.installerTechnology,expectedSigner:draft.expectedSigner,qualificationNotes:draft.qualificationNotes,deploymentLimitation:draft.deploymentLimitation,verification})}))}><Save size={14}/>Save validation settings</button>
      <button className="rmm-secondary compact" disabled={busy} onClick={()=>action('Classification',()=>api(`/software/catalogue/${catalogueId}/classify`,{method:'POST',body:JSON.stringify({classification:draft.deploymentLimitation,notes:draft.qualificationNotes})}))}><AlertTriangle size={14}/>Save classification only</button>
    </div>
    <div className="h5a-detail-grid h5a-detail-grid--history">
      <div className="h5a-detail-section"><h3>Qualification rows</h3><DataTable rows={detail.queues||[]} columns={['test_type','state','attempt_count','last_error','updated_at']}/></div>
      <div className="h5a-detail-section"><h3>Recent Agent jobs</h3><DataTable rows={(detail.jobs||[]).slice(0,12)} columns={['job_type','status','error_message','created_at']}/></div>
    </div>
  </section>
}

function Catalogue({ items, query, refresh }) {
  const [selected,setSelected]=useState('')
  const filtered=useMemo(()=>items.filter(item=>!query||item.canonical_name.toLowerCase().includes(query.toLowerCase())||String(item.publisher||'').toLowerCase().includes(query.toLowerCase())),[items,query])
  return <>
    <PageHeading view="catalogue"/>
    {selected?<SoftwareDetail catalogueId={selected} onClose={()=>setSelected('')} onChanged={refresh}/>:null}
    <div className="rmm-card h5a-table-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">GLOBAL CATALOGUE</span><h2>{items.length} software entries</h2></div><span className="h5a-result-count">{filtered.length} shown</span></div>
      <div className="h5a-table-wrap"><table><thead><tr><th>Software</th><th>Publisher</th><th>Target</th><th>Qualification</th><th>Technology</th><th>Limitation</th><th></th></tr></thead><tbody>{filtered.map(item=><tr key={item.id}><td><strong>{item.canonical_name}</strong></td><td>{item.publisher||'—'}</td><td>{item.target_version||'—'}</td><td><StatusPill value={item.qualification_state}/></td><td>{item.installer_technology||'—'}</td><td>{item.deployment_limitation||'—'}</td><td><button className="rmm-secondary compact" onClick={()=>setSelected(item.id)}><Wrench size={13}/>Manage</button></td></tr>)}</tbody></table></div>
    </div>
  </>
}

function Audit({ items, query }) {
  const rows=items.map(x=>({...x,created_at:fmtDate(x.created_at)})).filter(x=>!query||String(x.actor_name||'').toLowerCase().includes(query.toLowerCase())||String(x.action||'').toLowerCase().includes(query.toLowerCase()))
  return <><PageHeading view="audit"/><div className="rmm-card h5a-table-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">PLATFORM EVENTS</span><h2>Administrative audit trail</h2></div></div><DataTable rows={rows} columns={['created_at','actor_name','action','target_type','target_id']}/></div></>
}

export function PlatformAdminApp() {
  const [user,setUser]=useState(null)
  const [loading,setLoading]=useState(true)
  const [view,setView]=useState('overview')
  const [query,setQuery]=useState('')
  const [mobileOpen,setMobileOpen]=useState(false)
  const [theme,setThemeState]=useState(()=>localStorage.getItem('hi5central-admin-theme')||'light')
  const [data,setData]=useState({overview:null,tenants:[],qualification:{runners:[],active:[],pending:[],recent:[]},catalogue:[],audit:[]})
  const [error,setError]=useState('')
  function setTheme(value){setThemeState(value);localStorage.setItem('hi5central-admin-theme',value)}
  useEffect(()=>{api('/auth/session').then(r=>setUser(r.user)).catch(()=>{}).finally(()=>setLoading(false))},[])
  async function load(target=view){if(!user)return;setError('');try{const path={overview:'/overview',tenants:'/tenants',qualification:'/qualification',catalogue:'/software/catalogue',audit:'/audit'}[target];const result=await api(path);const value=['tenants','catalogue','audit'].includes(target)?result.items:result;setData(prev=>({...prev,[target]:value}))}catch(err){if(err.status===401)setUser(null);else setError(err.message)}}
  useEffect(()=>{if(user)load(view)},[user,view])
  useEffect(()=>{document.querySelector('.rmm-main-scroll')?.scrollTo?.({top:0,behavior:'auto'})},[view])
  if(loading)return <div className="h5a-loading">Loading Hi5Central Admin…</div>
  if(!user)return <Login onLogin={setUser} theme={theme} setTheme={setTheme}/>
  function navigate(next){setView(next);setQuery('');setMobileOpen(false)}
  async function logout(){await api('/auth/logout',{method:'POST'}).catch(()=>{});setUser(null)}
  function renderPage(){
    if(view==='overview')return <Overview data={data.overview} refresh={()=>load('overview')}/>
    if(view==='tenants')return <Tenants items={data.tenants} refresh={()=>load('tenants')} query={query}/>
    if(view==='qualification')return <Qualification data={data.qualification} query={query} refresh={()=>load('qualification')}/>
    if(view==='catalogue')return <Catalogue items={data.catalogue} query={query} refresh={()=>load('catalogue')}/>
    return <Audit items={data.audit} query={query}/>
  }
  return <div className="rmm-app h5a-rmm-shell" data-accent="amber" data-theme={theme}>
    <AdminSidebar activeView={view} mobileOpen={mobileOpen} navigate={navigate} onClose={()=>setMobileOpen(false)}/>
    <div className="rmm-shell-main">
      <AdminTopbar activeView={view} user={user} onLogout={logout} onMenu={()=>setMobileOpen(true)} query={query} setQuery={setQuery} theme={theme} setTheme={setTheme} refresh={()=>load(view)}/>
      <main className="rmm-main-scroll"><div className="rmm-page">{error?<div className="h5a-page-error">{error}</div>:null}{renderPage()}</div></main>
    </div>
  </div>
}
