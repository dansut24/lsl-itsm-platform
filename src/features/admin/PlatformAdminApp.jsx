import { useEffect, useMemo, useState } from 'react'
import {
  Activity, Building2, Database, LogOut, Menu, Moon, PackageCheck,
  Plus, RefreshCw, Search, ServerCog, ShieldCheck, Sun, X,
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

function Qualification({ data, query }) {
  const active=(data.active||[]).filter(r=>!query||r.canonical_name.toLowerCase().includes(query.toLowerCase()))
  const recent=(data.recent||[]).filter(r=>!query||r.canonical_name.toLowerCase().includes(query.toLowerCase()))
  return <>
    <PageHeading view="qualification"/>
    <div className="h5a-runner-grid">{(data.runners||[]).map(r=><article className="rmm-card h5a-runner" key={r.id}><ServerCog size={22}/><div><span className="rmm-eyebrow">QUALIFICATION LAB</span><h2>{r.hostname||'Qualification lab'}</h2><p>Agent {r.agent_version||'—'} · PatchHost {r.patch_host_version||'—'}</p><div className="h5a-pill-row"><StatusPill value={r.websocket_status}/><StatusPill value={r.enabled?'enabled':'paused'}/></div></div></article>)}</div>
    <div className="rmm-card h5a-table-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">RUNNER</span><h2>Active queue</h2></div></div><DataTable rows={active} columns={['canonical_name','target_version','state','attempt_count','last_error']}/></div>
    <div className="rmm-card h5a-table-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">OUTCOMES</span><h2>Recent qualification results</h2></div></div><DataTable rows={recent} columns={['canonical_name','target_version','state','attempt_count','last_error']}/></div>
  </>
}
function Catalogue({ items, query }) {
  const filtered=useMemo(()=>items.filter(item=>!query||item.canonical_name.toLowerCase().includes(query.toLowerCase())||String(item.publisher||'').toLowerCase().includes(query.toLowerCase())),[items,query])
  return <>
    <PageHeading view="catalogue"/>
    <div className="rmm-card h5a-table-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">GLOBAL CATALOGUE</span><h2>{items.length} software entries</h2></div><span className="h5a-result-count">{filtered.length} shown</span></div><DataTable rows={filtered} columns={['canonical_name','publisher','target_version','qualification_state','installer_technology','deployment_limitation']}/></div>
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
  const [data,setData]=useState({overview:null,tenants:[],qualification:{runners:[],active:[],recent:[]},catalogue:[],audit:[]})
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
    if(view==='qualification')return <Qualification data={data.qualification} query={query}/>
    if(view==='catalogue')return <Catalogue items={data.catalogue} query={query}/>
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
