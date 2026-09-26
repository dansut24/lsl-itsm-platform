import { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowUp, Ban, Building2, CreditCard, Database, Download,
  LogOut, Menu, Moon, PackageCheck, PackageSearch, Pause, Play, Plus, RefreshCw,
  RotateCcw, Save, Search, ServerCog, ShieldCheck, Sun, Trash2, UserRound, Wrench, X,
} from 'lucide-react'
import { deploymentConfig } from '../../lib/deploymentConfig.js'
import '../rmm/RmmPlatformApp.css'
import './PlatformAdminApp.css'

const config = deploymentConfig()
const API = config.apiUrl || `https://api.${config.rootDomain}`

const navigation = [
  { id:'overview', label:'Overview', section:'Platform', icon:Database },
  { id:'tenants', label:'Tenants', section:'Customers', icon:Building2 },
  { id:'billing', label:'Billing', section:'Customers', icon:CreditCard },
  { id:'qualification', label:'Qualification', section:'Software', icon:PackageCheck },
  { id:'catalogue', label:'Software catalogue', section:'Software', icon:ShieldCheck },
  { id:'winget', label:'WinGet', section:'Software', icon:PackageSearch },
  { id:'audit', label:'Audit', section:'Governance', icon:Activity },
]
const pageMeta = {
  overview:['CONTROL PLANE','Platform overview','Hi5Central-wide operations, customers and software safety.'],
  tenants:['CUSTOMERS','Tenants','Manage tenant ownership, products, lifecycle and key workspace details.'],
  billing:['COMMERCIAL','Billing','Manage tenant plans, billing status, pricing, trials and renewals.'],
  qualification:['SOFTWARE SAFETY','Qualification','Qualification runners, active work and review outcomes.'],
  catalogue:['GLOBAL SOFTWARE INTELLIGENCE','Software catalogue','The approved global software catalogue consumed by customer RMM tenants.'],
  winget:['WINDOWS PACKAGE INTELLIGENCE','WinGet manifest index','Browse the full Microsoft WinGet source index and control its sync state.'],
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
function fmtMoney(pence, currency='GBP') {
  if (pence == null || pence === '') return '—'
  return new Intl.NumberFormat('en-GB', { style:'currency', currency:currency || 'GBP' }).format(Number(pence || 0) / 100)
}
function dateInput(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0,10)
}
function dateToIso(value) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null
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
  const [draft,setDraft]=useState(()=>({
    companyName:tenant.company_name,
    status:tenant.status,
    modules:{itsm:Boolean(tenant.modules?.itsm),rmm:Boolean(tenant.modules?.rmm)},
  }))
  const [ownerEmail,setOwnerEmail]=useState('')
  const [busy,setBusy]=useState('')
  const [notice,setNotice]=useState('')
  const [error,setError]=useState('')
  async function run(key,action){
    setBusy(key);setNotice('');setError('')
    try{await action();await onSaved()}catch(err){setError(err.message)}finally{setBusy('')}
  }
  async function save(){
    await run('save',()=>api(`/tenants/${tenant.id}`,{method:'PATCH',body:JSON.stringify(draft)}))
  }
  async function requestTransfer(){
    await run('owner',async()=>{
      const result=await api(`/tenants/${tenant.id}/owner-transfer`,{method:'POST',body:JSON.stringify({email:ownerEmail})})
      setOwnerEmail('')
      setNotice(`Approval sent to the current owner. Proposed owner: ${result.transfer?.proposedOwnerEmail||''}`)
    })
  }
  async function cancelTransfer(){
    await run('owner',async()=>{
      await api(`/tenants/${tenant.id}/owner-transfer/cancel`,{method:'POST',body:'{}'})
      setNotice('Pending owner transfer cancelled.')
    })
  }
  return <div className="h5a-tenant-admin">
    {notice?<div className="h5a-notice healthy">{notice}</div>:null}
    {error?<div className="h5a-page-error">{error}</div>:null}
    <div className="h5a-tenant-facts">
      <span><UserRound size={15}/><div><small>Tenant owner</small><strong>{tenant.owner_name||'Unassigned'}</strong><em>{tenant.owner_email||'No owner account'}</em></div></span>
      <span><Building2 size={15}/><div><small>Usage</small><strong>{tenant.user_count} users · {tenant.device_count} devices</strong><em>Created {fmtDate(tenant.created_at)}</em></div></span>
      <span><CreditCard size={15}/><div><small>Billing</small><strong>{tenant.plan_key||'custom'} · {tenant.billing_cycle||'monthly'}</strong><em>{fmtMoney(tenant.monthly_price_pence,tenant.currency)} / month · {String(tenant.billing_status||'trial').replaceAll('_',' ')}</em></div></span>
      <span><Activity size={15}/><div><small>Onboarding</small><strong>{tenant.onboarding_completed_at?'Completed':'In progress'}</strong><em>{tenant.onboarding_completed_at?fmtDate(tenant.onboarding_completed_at):'No completion date'}</em></div></span>
    </div>
    <div className="h5a-tenant-links">
      {tenant.tenant_url?<a href={tenant.tenant_url} target="_blank" rel="noreferrer">Workspace</a>:null}
      {tenant.portal_url?<a href={tenant.portal_url} target="_blank" rel="noreferrer">Portal</a>:null}
      {tenant.rmm_url?<a href={tenant.rmm_url} target="_blank" rel="noreferrer">RMM</a>:null}
    </div>
    <div className="h5a-tenant-edit-grid">
      <label>Company name<input value={draft.companyName} onChange={e=>setDraft({...draft,companyName:e.target.value})}/></label>
      <label>Status<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}><option value="active">Active</option><option value="pending_verification">Pending</option><option value="suspended">Suspended</option><option value="closed">Closed</option></select></label>
      <label className="h5a-check"><input type="checkbox" checked={draft.modules.itsm} onChange={e=>setDraft({...draft,modules:{...draft.modules,itsm:e.target.checked}})}/> ITSM</label>
      <label className="h5a-check"><input type="checkbox" checked={draft.modules.rmm} onChange={e=>setDraft({...draft,modules:{...draft.modules,rmm:e.target.checked}})}/> RMM</label>
      <button className="rmm-primary compact" onClick={save} disabled={Boolean(busy)}>{busy==='save'?'Saving…':'Save tenant'}</button>
    </div>
    <div className="h5a-owner-transfer">
      <div><span className="rmm-eyebrow">OWNER CONTROL</span><strong>Transfer tenant ownership</strong><p>Enter an existing active tenant user's email. The current owner must approve the emailed one-time request before anything changes.</p></div>
      {tenant.owner_transfer_id
        ? <div className="h5a-owner-pending"><div><small>Awaiting owner approval</small><strong>{tenant.proposed_owner_name||tenant.proposed_owner_email}</strong><span>{tenant.proposed_owner_email} · expires {fmtDate(tenant.owner_transfer_expires_at)}</span></div><button className="rmm-secondary compact danger" disabled={busy==='owner'} onClick={cancelTransfer}><X size={13}/>Cancel request</button></div>
        : <div className="h5a-owner-request"><input type="email" placeholder="new.owner@example.com" value={ownerEmail} onChange={e=>setOwnerEmail(e.target.value)}/><button className="rmm-secondary compact" disabled={busy==='owner'||!ownerEmail||!tenant.owner_email} onClick={requestTransfer}><UserRound size={13}/>{busy==='owner'?'Sending…':'Request owner change'}</button></div>}
    </div>
  </div>
}
function Tenants({ items, refresh, query }) {
  const [creating,setCreating]=useState(false)
  const [draft,setDraft]=useState({companyName:'',slug:'',modules:{itsm:true,rmm:false},planKey:'custom',billingStatus:'trial',billingCycle:'monthly'})
  const needle=query.toLowerCase()
  const filtered=useMemo(()=>items.filter(t=>!query||[
    t.company_name,t.slug,t.owner_name,t.owner_email,t.plan_key,t.billing_status,
  ].some(value=>String(value||'').toLowerCase().includes(needle))),[items,query,needle])
  async function create(event){
    event.preventDefault()
    await api('/tenants',{method:'POST',body:JSON.stringify(draft)})
    setCreating(false)
    setDraft({companyName:'',slug:'',modules:{itsm:true,rmm:false},planKey:'custom',billingStatus:'trial',billingCycle:'monthly'})
    await refresh()
  }
  return <>
    <PageHeading view="tenants" action={<button className="rmm-primary compact" onClick={()=>setCreating(!creating)}><Plus size={14}/>New tenant</button>}/>
    {creating?<form className="rmm-card h5a-create" onSubmit={create}><input placeholder="Company name" value={draft.companyName} onChange={e=>setDraft({...draft,companyName:e.target.value})} required/><input placeholder="tenant-slug" value={draft.slug} onChange={e=>setDraft({...draft,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'')})} required/><label className="h5a-check"><input type="checkbox" checked={draft.modules.itsm} onChange={e=>setDraft({...draft,modules:{...draft.modules,itsm:e.target.checked}})}/> ITSM</label><label className="h5a-check"><input type="checkbox" checked={draft.modules.rmm} onChange={e=>setDraft({...draft,modules:{...draft.modules,rmm:e.target.checked}})}/> RMM</label><button className="rmm-primary compact">Create tenant</button></form>:null}
    <div className="h5a-stack">{filtered.map(tenant=><article className="rmm-card" key={tenant.id}><div className="rmm-card-heading h5a-tenant-head"><div><span className="rmm-eyebrow">{tenant.slug}</span><h2>{tenant.company_name}</h2><p>{tenant.owner_email||'No owner'} · {tenant.user_count} users · {tenant.device_count} devices</p></div><StatusPill value={tenant.status}/></div><TenantEditor tenant={tenant} onSaved={refresh}/></article>)}</div>
  </>
}

function BillingEditor({ tenant, onSaved }) {
  const [draft,setDraft]=useState(()=>({
    planKey:tenant.plan_key||'custom',
    billingStatus:tenant.billing_status||'trial',
    billingCycle:tenant.billing_cycle||'monthly',
    currency:tenant.currency||'GBP',
    monthlyPrice:tenant.monthly_price_pence==null?'':String(Number(tenant.monthly_price_pence)/100),
    trialEndsAt:dateInput(tenant.trial_ends_at),
    renewalAt:dateInput(tenant.renewal_at),
    billingNotes:tenant.billing_notes||'',
  }))
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  async function save(){
    setBusy(true);setError('')
    try{
      const monthlyPricePence=draft.monthlyPrice===''?null:Math.max(0,Math.round(Number(draft.monthlyPrice||0)*100))
      await api(`/tenants/${tenant.id}`,{method:'PATCH',body:JSON.stringify({
        planKey:draft.planKey,billingStatus:draft.billingStatus,billingCycle:draft.billingCycle,
        currency:draft.currency,monthlyPricePence,trialEndsAt:dateToIso(draft.trialEndsAt),
        renewalAt:dateToIso(draft.renewalAt),billingNotes:draft.billingNotes,
      })})
      await onSaved()
    }catch(err){setError(err.message)}finally{setBusy(false)}
  }
  return <div className="h5a-billing-editor">
    {error?<div className="h5a-page-error">{error}</div>:null}
    <div className="h5a-billing-grid">
      <label>Plan<input value={draft.planKey} onChange={e=>setDraft({...draft,planKey:e.target.value})}/></label>
      <label>Billing status<select value={draft.billingStatus} onChange={e=>setDraft({...draft,billingStatus:e.target.value})}><option value="trial">Trial</option><option value="active">Active</option><option value="past_due">Past due</option><option value="suspended">Suspended</option><option value="cancelled">Cancelled</option></select></label>
      <label>Cycle<select value={draft.billingCycle} onChange={e=>setDraft({...draft,billingCycle:e.target.value})}><option value="monthly">Monthly</option><option value="annual">Annual</option><option value="custom">Custom</option></select></label>
      <label>Currency<input maxLength={3} value={draft.currency} onChange={e=>setDraft({...draft,currency:e.target.value.toUpperCase()})}/></label>
      <label>Monthly price<input type="number" min="0" step="0.01" value={draft.monthlyPrice} onChange={e=>setDraft({...draft,monthlyPrice:e.target.value})}/></label>
      <label>Trial ends<input type="date" value={draft.trialEndsAt} onChange={e=>setDraft({...draft,trialEndsAt:e.target.value})}/></label>
      <label>Renewal<input type="date" value={draft.renewalAt} onChange={e=>setDraft({...draft,renewalAt:e.target.value})}/></label>
    </div>
    <label className="h5a-billing-notes">Internal billing notes<textarea value={draft.billingNotes} onChange={e=>setDraft({...draft,billingNotes:e.target.value})}/></label>
    <button className="rmm-primary compact" disabled={busy} onClick={save}><Save size={13}/>{busy?'Saving…':'Save billing'}</button>
  </div>
}
function Billing({ items, refresh, query }) {
  const needle=query.toLowerCase()
  const filtered=useMemo(()=>items.filter(t=>!query||[
    t.company_name,t.slug,t.owner_email,t.plan_key,t.billing_status,t.billing_cycle,
  ].some(value=>String(value||'').toLowerCase().includes(needle))),[items,query,needle])
  const active=items.filter(t=>t.billing_status==='active').length
  const pastDue=items.filter(t=>t.billing_status==='past_due').length
  const priced=items.filter(t=>t.monthly_price_pence!=null)
  const currencies=[...new Set(priced.map(t=>t.currency||'GBP'))]
  const monthlyPence=priced.reduce((sum,t)=>sum+(Number(t.monthly_price_pence)||0),0)
  const monthlyValue=currencies.length<=1?fmtMoney(monthlyPence,currencies[0]||'GBP'):`${currencies.length} currencies`
  return <>
    <PageHeading view="billing" action={<button className="rmm-primary compact" onClick={refresh}><RefreshCw size={14}/>Refresh</button>}/>
    <div className="rmm-metric-grid">
      <button type="button"><span className="rmm-metric-icon green"><CreditCard size={18}/></span><div><span>Active billing</span><strong>{active}</strong><small>{items.length} tenants</small></div></button>
      <button type="button"><span className="rmm-metric-icon red"><AlertTriangle size={18}/></span><div><span>Past due</span><strong>{pastDue}</strong><small>Requires review</small></div></button>
      <button type="button"><span className="rmm-metric-icon blue"><Database size={18}/></span><div><span>Configured monthly value</span><strong>{monthlyValue}</strong><small>{currencies.length<=1?'Across all configured tenant prices':'Values are shown per tenant below'}</small></div></button>
    </div>
    <div className="h5a-stack h5a-billing-stack">{filtered.map(tenant=><article className="rmm-card" key={tenant.id}><div className="rmm-card-heading h5a-tenant-head"><div><span className="rmm-eyebrow">{tenant.slug}</span><h2>{tenant.company_name}</h2><p>{tenant.owner_email||'No owner'} · {fmtMoney(tenant.monthly_price_pence,tenant.currency)} / month</p></div><StatusPill value={tenant.billing_status}/></div><BillingEditor tenant={tenant} onSaved={refresh}/></article>)}</div>
  </>
}

function DataTable({ rows, columns }) {
  if(!rows.length)return <div className="h5a-empty">No records.</div>
  return <div className="h5a-table-wrap"><table><thead><tr>{columns.map(c=><th key={c}>{c.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={row.id||index}>{columns.map(c=><td key={c}>{c==='state'||c==='qualification_state'?<StatusPill value={row[c]}/>:String(row[c]??'—')}</td>)}</tr>)}</tbody></table></div>
}

function durationLabel(milliseconds) {
  if (!Number.isFinite(milliseconds)) return '—'
  const negative = milliseconds < 0
  let seconds = Math.max(0, Math.floor(Math.abs(milliseconds) / 1000))
  const hours = Math.floor(seconds / 3600)
  seconds %= 3600
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  const value = hours
    ? `${hours}:${String(minutes).padStart(2,'0')}:${String(remainder).padStart(2,'0')}`
    : `${minutes}:${String(remainder).padStart(2,'0')}`
  return negative ? `+${value} overdue` : value
}

function LiveQualificationTimer({ timing }) {
  const [now,setNow]=useState(Date.now())
  useEffect(()=>{
    const timer=setInterval(()=>setNow(Date.now()),1000)
    return ()=>clearInterval(timer)
  },[])
  if(!timing)return null
  const overallStart=Date.parse(timing.overallStartedAt||'')
  const phaseStart=Date.parse(timing.phaseStartedAt||'')
  const deadline=Date.parse(timing.deadlineAt||'')
  const totalElapsed=Number.isFinite(overallStart)?now-overallStart:NaN
  const phaseElapsed=Number.isFinite(phaseStart)?now-phaseStart:NaN
  const remaining=Number.isFinite(deadline)?deadline-now:NaN
  const overdue=Number.isFinite(remaining)&&remaining<0
  const totalWindow=Number.isFinite(deadline)&&Number.isFinite(phaseStart)?Math.max(1,deadline-phaseStart):0
  const used=totalWindow?Math.min(100,Math.max(0,((now-phaseStart)/totalWindow)*100)):0
  return <div className={`h5a-live-timer ${overdue?'is-overdue':''}`}>
    <div className="h5a-timer-cell"><span>Total elapsed</span><strong>{durationLabel(totalElapsed)}</strong></div>
    <div className="h5a-timer-cell"><span>Current phase</span><strong>{timing.phaseLabel||timing.phase||'—'}</strong><small>{durationLabel(phaseElapsed)} elapsed</small></div>
    <div className="h5a-timer-cell h5a-timer-deadline"><span>{timing.deadlineLabel||'Phase deadline'}</span><strong>{Number.isFinite(remaining)?durationLabel(remaining):'No countdown'}</strong>{timing.deadlineAt?<small>{fmtDate(timing.deadlineAt)}</small>:null}</div>
    <div className="h5a-timer-cell"><span>Next</span><strong>{timing.nextPhaseLabel||'—'}</strong></div>
    {totalWindow?<div className="h5a-timer-progress" aria-hidden="true"><span style={{width:`${used}%`}}/></div>:null}
  </div>
}

function QualificationQueueTable({ rows, recent = false, onAction, busyId }) {
  if (!rows.length) return <div className="h5a-empty">No qualification rows.</div>
  return <div className="h5a-table-wrap"><table><thead><tr>
    <th>Software</th><th>Version</th><th>State</th><th>Attempt</th><th>Last error</th><th>Actions</th>
  </tr></thead><tbody>{rows.map(row=><tr key={row.id}>
    <td className={row.timing?'h5a-active-software-cell':''}><strong>{row.canonical_name}</strong><small className="h5a-cell-sub">{row.test_type}</small>{row.timing?<LiveQualificationTimer timing={row.timing}/>:null}</td>
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
  useEffect(()=>{
    const timer=setInterval(()=>{
      if(document.visibilityState==='visible') refresh()
    },5000)
    return ()=>clearInterval(timer)
  },[refresh])
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
  const [exporting,setExporting]=useState(false)
  const [error,setError]=useState('')
  const filtered=useMemo(()=>items.filter(item=>!query||item.canonical_name.toLowerCase().includes(query.toLowerCase())||String(item.publisher||'').toLowerCase().includes(query.toLowerCase())),[items,query])
  async function exportMarkdown(){
    setExporting(true);setError('')
    try{
      const response=await fetch(`${API}/api/platform/v1/software/catalogue/export.md`,{credentials:'include'})
      if(!response.ok){
        const body=await response.json().catch(()=>({}))
        throw new Error(body.error||'Catalogue export failed.')
      }
      const blob=await response.blob()
      const disposition=response.headers.get('content-disposition')||''
      const filename=disposition.match(/filename="?([^"]+)"?/i)?.[1]||'hi5central-software-catalogue.md'
      const url=URL.createObjectURL(blob)
      const anchor=document.createElement('a')
      anchor.href=url;anchor.download=filename
      document.body.appendChild(anchor);anchor.click();anchor.remove()
      URL.revokeObjectURL(url)
    }catch(err){setError(err.message)}finally{setExporting(false)}
  }
  return <>
    <PageHeading view="catalogue" action={<button className="rmm-primary compact" disabled={exporting} onClick={exportMarkdown}><Download size={14}/>{exporting?'Exporting…':'Export all (.md)'}</button>}/>
    {error?<div className="h5a-page-error">{error}</div>:null}
    {selected?<SoftwareDetail catalogueId={selected} onClose={()=>setSelected('')} onChanged={refresh}/>:null}
    <div className="rmm-card h5a-table-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">GLOBAL CATALOGUE</span><h2>{items.length} software entries</h2><p>Export includes every global catalogue item, including archived entries.</p></div><span className="h5a-result-count">{filtered.length} shown</span></div>
      <div className="h5a-table-wrap"><table><thead><tr><th>Software</th><th>Publisher</th><th>Target</th><th>Qualification</th><th>Technology</th><th>Limitation</th><th></th></tr></thead><tbody>{filtered.map(item=><tr key={item.id}><td><strong>{item.canonical_name}</strong></td><td>{item.publisher||'—'}</td><td>{item.target_version||'—'}</td><td><StatusPill value={item.qualification_state}/></td><td>{item.installer_technology||'—'}</td><td>{item.deployment_limitation||'—'}</td><td><button className="rmm-secondary compact" onClick={()=>setSelected(item.id)}><Wrench size={13}/>Manage</button></td></tr>)}</tbody></table></div>
    </div>
  </>
}

function Winget({ query, refreshKey }) {
  const [data,setData]=useState({packages:[],page:1,pages:1,total:0,sync:null,source:'',indexRefreshedAt:null})
  const [page,setPage]=useState(1)
  const [loading,setLoading]=useState(true)
  const [syncing,setSyncing]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  useEffect(()=>{
    let cancelled=false
    const timer=setTimeout(async()=>{
      setLoading(true);setError('')
      try{
        const result=await api(`/winget?q=${encodeURIComponent(query)}&page=${page}&pageSize=100`)
        if(!cancelled)setData(result)
      }catch(err){if(!cancelled)setError(err.message)}
      finally{if(!cancelled)setLoading(false)}
    },query?250:0)
    return ()=>{cancelled=true;clearTimeout(timer)}
  },[query,page,refreshKey])
  async function sync(){
    setSyncing(true);setError('');setNotice('')
    try{
      const result=await api('/winget/sync',{method:'POST',body:'{}'})
      setNotice(`WinGet source synced successfully. ${Number(result.total||0).toLocaleString()} packages indexed.`)
      const refreshed=await api(`/winget?q=${encodeURIComponent(query)}&page=${page}&pageSize=100`)
      setData(refreshed)
    }catch(err){setError(err.message)}finally{setSyncing(false)}
  }
  const packages=data.packages||[]
  const syncState=data.sync||{}
  const lastSync=syncState.last_success_at||data.indexRefreshedAt
  return <>
    <PageHeading view="winget" action={<button className="rmm-primary compact" disabled={syncing} onClick={sync}><RefreshCw size={14}/>{syncing?'Syncing…':'Sync WinGet now'}</button>}/>
    {notice?<div className="h5a-notice healthy">{notice}</div>:null}
    {error?<div className="h5a-page-error">{error}</div>:null}
    <div className="h5a-winget-summary">
      <article className="rmm-card"><PackageSearch size={18}/><div><span>Packages</span><strong>{Number(data.total||0).toLocaleString()}</strong><small>Latest package records in the Microsoft source index</small></div></article>
      <article className="rmm-card"><RefreshCw size={18}/><div><span>Last successful sync</span><strong>{fmtDate(lastSync)}</strong><small>{syncState.status==='failed'?'Last attempt failed':syncState.status==='running'?'Sync in progress':'Repository cache ready'}</small></div></article>
      <article className="rmm-card"><Database size={18}/><div><span>Source</span><strong>Microsoft WinGet</strong><small>{data.source||'Official WinGet package source'}</small></div></article>
    </div>
    {syncState.last_error?<div className="h5a-page-error">Last WinGet sync error: {syncState.last_error}</div>:null}
    <div className="rmm-card h5a-table-card">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">MANIFEST INDEX</span><h2>{query?'Matches for “'+query+'”':'All WinGet packages'}</h2><p>This index shows each package ID with its latest published version. Use the global search above to filter the full repository.</p></div><span className="h5a-result-count">Page {data.page||page} of {data.pages||1}</span></div>
      {loading?<div className="h5a-empty">Loading WinGet manifest index…</div>:packages.length?<div className="h5a-table-wrap"><table className="h5a-winget-table"><thead><tr><th>Package</th><th>Package ID</th><th>Latest version</th><th>Publisher identities</th><th>Moniker</th></tr></thead><tbody>{packages.map(item=><tr key={item.id}><td><strong>{item.name||item.id}</strong></td><td><code>{item.id}</code></td><td>{item.version||'—'}</td><td>{(item.publishers||[]).join(', ')||'—'}</td><td>{item.moniker||'—'}</td></tr>)}</tbody></table></div>:<div className="h5a-empty">No WinGet packages match this search.</div>}
      <div className="h5a-pager">
        <button className="rmm-secondary compact" disabled={loading||page<=1} onClick={()=>setPage(value=>Math.max(1,value-1))}>Previous</button>
        <span>{Number(data.total||0).toLocaleString()} packages · page {data.page||page} / {data.pages||1}</span>
        <button className="rmm-secondary compact" disabled={loading||page>=(data.pages||1)} onClick={()=>setPage(value=>Math.min(data.pages||1,value+1))}>Next</button>
      </div>
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
  const [data,setData]=useState({overview:null,tenants:[],billing:[],qualification:{runners:[],active:[],pending:[],recent:[]},catalogue:[],audit:[]})
  const [wingetRefreshKey,setWingetRefreshKey]=useState(0)
  const [error,setError]=useState('')
  function setTheme(value){setThemeState(value);localStorage.setItem('hi5central-admin-theme',value)}
  useEffect(()=>{api('/auth/session').then(r=>setUser(r.user)).catch(()=>{}).finally(()=>setLoading(false))},[])
  async function load(target=view){
    if(!user||target==='winget')return
    setError('')
    try{
      const path={overview:'/overview',tenants:'/tenants',billing:'/tenants',qualification:'/qualification',catalogue:'/software/catalogue',audit:'/audit'}[target]
      if(!path)return
      const result=await api(path)
      const value=['tenants','billing','catalogue','audit'].includes(target)?result.items:result
      setData(prev=>({...prev,[target]:value}))
    }catch(err){if(err.status===401)setUser(null);else setError(err.message)}
  }
  useEffect(()=>{if(user&&view!=='winget')load(view)},[user,view])
  useEffect(()=>{document.querySelector('.rmm-main-scroll')?.scrollTo?.({top:0,behavior:'auto'})},[view])
  if(loading)return <div className="h5a-loading">Loading Hi5Central Admin…</div>
  if(!user)return <Login onLogin={setUser} theme={theme} setTheme={setTheme}/>
  function navigate(next){setView(next);setQuery('');setMobileOpen(false)}
  async function logout(){await api('/auth/logout',{method:'POST'}).catch(()=>{});setUser(null)}
  function refreshCurrent(){if(view==='winget')setWingetRefreshKey(value=>value+1);else load(view)}
  function renderPage(){
    if(view==='overview')return <Overview data={data.overview} refresh={()=>load('overview')}/>
    if(view==='tenants')return <Tenants items={data.tenants} refresh={()=>load('tenants')} query={query}/>
    if(view==='billing')return <Billing items={data.billing} refresh={()=>load('billing')} query={query}/>
    if(view==='qualification')return <Qualification data={data.qualification} query={query} refresh={()=>load('qualification')}/>
    if(view==='catalogue')return <Catalogue items={data.catalogue} query={query} refresh={()=>load('catalogue')}/>
    if(view==='winget')return <Winget key={query} query={query} refreshKey={wingetRefreshKey}/>
    return <Audit items={data.audit} query={query}/>
  }
  return <div className="rmm-app h5a-rmm-shell" data-accent="amber" data-theme={theme}>
    <AdminSidebar activeView={view} mobileOpen={mobileOpen} navigate={navigate} onClose={()=>setMobileOpen(false)}/>
    <div className="rmm-shell-main">
      <AdminTopbar activeView={view} user={user} onLogout={logout} onMenu={()=>setMobileOpen(true)} query={query} setQuery={setQuery} theme={theme} setTheme={setTheme} refresh={refreshCurrent}/>
      <main className="rmm-main-scroll"><div className="rmm-page">{error?<div className="h5a-page-error">{error}</div>:null}{renderPage()}</div></main>
    </div>
  </div>
}
