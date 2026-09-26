import { useEffect, useMemo, useState } from 'react'
import {
  Activity, Building2, Database, LogOut, PackageCheck, Plus,
  RefreshCw, Search, ServerCog, ShieldCheck,
} from 'lucide-react'
import { deploymentConfig } from '../../lib/deploymentConfig.js'
import './PlatformAdminApp.css'

const config = deploymentConfig()
const API = config.apiUrl || `https://api.${config.rootDomain}`

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
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
function StatusPill({ value }) {
  const text = String(value || 'unknown').replaceAll('_', ' ')
  return <span className={`h5a-pill h5a-pill--${String(value || 'unknown').toLowerCase()}`}>{text}</span>
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      onLogin(result.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return <main className="h5a-login">
    <section className="h5a-login-card">
      <div className="h5a-brand-mark">H5</div>
      <p className="h5a-kicker">Hi5Central control plane</p>
      <h1>Platform administration</h1>
      <p>Manage tenants, qualification and the global software catalogue.</p>
      <form onSubmit={submit}>
        <label>Email<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="username" required /></label>
        <label>Password<input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="current-password" required /></label>
        {error ? <div className="h5a-error">{error}</div> : null}
        <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </section>
  </main>
}

function Overview({ data, refresh }) {
  const cards = [
    ['Tenants', data?.tenants?.active ?? 0, `${data?.tenants?.total ?? 0} total`, Building2],
    ['Managed devices', data?.devices?.total ?? 0, `${data?.devices?.online ?? 0} online`, ServerCog],
    ['Qualified software', data?.catalogue?.qualified ?? 0, `${data?.catalogue?.total ?? 0} catalogue entries`, PackageCheck],
    ['Qualification queue', data?.qualification?.active ?? 0, `${data?.qualification?.review ?? 0} need review`, Activity],
  ]
  return <section>
    <div className="h5a-heading"><div><p className="h5a-kicker">Control plane</p><h2>Platform overview</h2></div><button className="h5a-secondary" onClick={refresh}><RefreshCw size={16}/> Refresh</button></div>
    <div className="h5a-metrics">
      {cards.map(([label,value,detail,Icon])=><article className="h5a-metric" key={label}><Icon/><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>)}
    </div>
    <article className="h5a-panel h5a-callout"><ShieldCheck/><div><h3>Qualification is platform-owned</h3><p>Customer tenants consume only Hi5Central-approved software. Install, verification and clean uninstall remain the deployment qualification gate.</p></div></article>
  </section>
}

function TenantEditor({ tenant, onSaved }) {
  const [draft, setDraft] = useState(()=>({
    companyName: tenant.company_name,
    status: tenant.status,
    modules: { itsm: Boolean(tenant.modules?.itsm), rmm: Boolean(tenant.modules?.rmm) },
    planKey: tenant.plan_key || 'custom',
    billingStatus: tenant.billing_status || 'trial',
    billingCycle: tenant.billing_cycle || 'monthly',
  }))
  const [busy,setBusy]=useState(false)
  async function save() {
    setBusy(true)
    try {
      await api(`/tenants/${tenant.id}`, { method:'PATCH', body:JSON.stringify(draft) })
      await onSaved()
    } finally {
      setBusy(false)
    }
  }
  return <div className="h5a-tenant-editor">
    <input value={draft.companyName} onChange={(e)=>setDraft({...draft,companyName:e.target.value})}/>
    <select value={draft.status} onChange={(e)=>setDraft({...draft,status:e.target.value})}>
      <option value="active">Active</option><option value="pending_verification">Pending</option><option value="suspended">Suspended</option><option value="closed">Closed</option>
    </select>
    <label className="h5a-check"><input type="checkbox" checked={draft.modules.itsm} onChange={(e)=>setDraft({...draft,modules:{...draft.modules,itsm:e.target.checked}})}/> ITSM</label>
    <label className="h5a-check"><input type="checkbox" checked={draft.modules.rmm} onChange={(e)=>setDraft({...draft,modules:{...draft.modules,rmm:e.target.checked}})}/> RMM</label>
    <input value={draft.planKey} onChange={(e)=>setDraft({...draft,planKey:e.target.value})} placeholder="Plan"/>
    <select value={draft.billingStatus} onChange={(e)=>setDraft({...draft,billingStatus:e.target.value})}>
      <option value="trial">Trial</option><option value="active">Active</option><option value="past_due">Past due</option><option value="suspended">Suspended</option><option value="cancelled">Cancelled</option>
    </select>
    <select value={draft.billingCycle} onChange={(e)=>setDraft({...draft,billingCycle:e.target.value})}>
      <option value="monthly">Monthly</option><option value="annual">Annual</option><option value="custom">Custom</option>
    </select>
    <button onClick={save} disabled={busy}>{busy?'Saving…':'Save'}</button>
  </div>
}

function Tenants({ items, refresh }) {
  const [creating,setCreating]=useState(false)
  const [draft,setDraft]=useState({companyName:'',slug:'',modules:{itsm:true,rmm:false},planKey:'custom',billingStatus:'trial',billingCycle:'monthly'})
  async function create(event) {
    event.preventDefault()
    await api('/tenants',{method:'POST',body:JSON.stringify(draft)})
    setCreating(false)
    setDraft({companyName:'',slug:'',modules:{itsm:true,rmm:false},planKey:'custom',billingStatus:'trial',billingCycle:'monthly'})
    await refresh()
  }
  return <section>
    <div className="h5a-heading"><div><p className="h5a-kicker">Customers</p><h2>Tenants</h2><p>{items.length} tenant{items.length===1?'':'s'} on the platform.</p></div><button onClick={()=>setCreating(!creating)}><Plus size={16}/> New tenant</button></div>
    {creating?<form className="h5a-create" onSubmit={create}>
      <input placeholder="Company name" value={draft.companyName} onChange={(e)=>setDraft({...draft,companyName:e.target.value})} required/>
      <input placeholder="tenant-slug" value={draft.slug} onChange={(e)=>setDraft({...draft,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'')})} required/>
      <label className="h5a-check"><input type="checkbox" checked={draft.modules.itsm} onChange={(e)=>setDraft({...draft,modules:{...draft.modules,itsm:e.target.checked}})}/> ITSM</label>
      <label className="h5a-check"><input type="checkbox" checked={draft.modules.rmm} onChange={(e)=>setDraft({...draft,modules:{...draft.modules,rmm:e.target.checked}})}/> RMM</label>
      <button>Create tenant</button>
    </form>:null}
    <div className="h5a-stack">{items.map((tenant)=><article className="h5a-panel" key={tenant.id}>
      <div className="h5a-tenant-head"><div><h3>{tenant.company_name}</h3><p>{tenant.slug} · {tenant.user_count} users · {tenant.device_count} devices</p></div><StatusPill value={tenant.status}/></div>
      <TenantEditor tenant={tenant} onSaved={refresh}/>
    </article>)}</div>
  </section>
}

function Qualification({ data }) {
  return <section>
    <div className="h5a-heading"><div><p className="h5a-kicker">Software safety</p><h2>Qualification</h2><p>The qualification runner and review queue now live in the Hi5Central control plane.</p></div></div>
    <div className="h5a-runner-grid">{(data.runners||[]).map(r=><article className="h5a-panel" key={r.id}><ServerCog/><h3>{r.hostname||'Qualification lab'}</h3><p>Agent {r.agent_version||'—'} · PatchHost {r.patch_host_version||'—'}</p><div><StatusPill value={r.websocket_status}/><StatusPill value={r.enabled?'enabled':'paused'}/></div></article>)}</div>
    <article className="h5a-panel"><h3>Active queue</h3><DataTable rows={data.active||[]} columns={['canonical_name','target_version','state','attempt_count','last_error']}/></article>
    <article className="h5a-panel"><h3>Recent outcomes</h3><DataTable rows={data.recent||[]} columns={['canonical_name','target_version','state','attempt_count','last_error']}/></article>
  </section>
}

function DataTable({ rows, columns }) {
  if (!rows.length) return <div className="h5a-empty">No records.</div>
  return <div className="h5a-table-wrap"><table><thead><tr>{columns.map(c=><th key={c}>{c.replaceAll('_',' ')}</th>)}</tr></thead><tbody>
    {rows.map((row,index)=><tr key={row.id||index}>{columns.map(c=><td key={c}>{c==='state'||c==='qualification_state'?<StatusPill value={row[c]}/>:String(row[c]??'—')}</td>)}</tr>)}
  </tbody></table></div>
}

function Catalogue({ items }) {
  const [query,setQuery]=useState('')
  const filtered=useMemo(()=>items.filter(item=>!query||item.canonical_name.toLowerCase().includes(query.toLowerCase())||String(item.publisher||'').toLowerCase().includes(query.toLowerCase())),[items,query])
  return <section>
    <div className="h5a-heading"><div><p className="h5a-kicker">Global software intelligence</p><h2>Software catalogue</h2><p>{items.length} global entries · customer RMM will only consume approved deployment states.</p></div></div>
    <label className="h5a-search"><Search size={16}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search software or publisher"/></label>
    <article className="h5a-panel"><DataTable rows={filtered} columns={['canonical_name','publisher','target_version','qualification_state','installer_technology','deployment_limitation']}/></article>
  </section>
}

function Audit({ items }) {
  const rows=items.map(x=>({...x,created_at:fmtDate(x.created_at)}))
  return <section><div className="h5a-heading"><div><p className="h5a-kicker">Governance</p><h2>Platform audit</h2></div></div>
    <article className="h5a-panel"><DataTable rows={rows} columns={['created_at','actor_name','action','target_type','target_id']}/></article>
  </section>
}

export function PlatformAdminApp() {
  const [user,setUser]=useState(null)
  const [loading,setLoading]=useState(true)
  const [view,setView]=useState('overview')
  const [data,setData]=useState({overview:null,tenants:[],qualification:{runners:[],active:[],recent:[]},catalogue:[],audit:[]})
  const [error,setError]=useState('')

  useEffect(()=>{ api('/auth/session').then(r=>setUser(r.user)).catch(()=>{}).finally(()=>setLoading(false)) },[])

  async function load(target=view) {
    if (!user) return
    setError('')
    try {
      const path={overview:'/overview',tenants:'/tenants',qualification:'/qualification',catalogue:'/software/catalogue',audit:'/audit'}[target]
      const result=await api(path)
      const value=target==='tenants'||target==='catalogue'||target==='audit' ? result.items : result
      setData(prev=>({...prev,[target]:value}))
    } catch(err) {
      if(err.status===401)setUser(null)
      else setError(err.message)
    }
  }
  useEffect(()=>{ if(user)load(view) },[user,view])

  if (loading) return <div className="h5a-loading">Loading Hi5Central Admin…</div>
  if (!user) return <Login onLogin={setUser}/>

  const nav=[
    ['overview','Overview',Database],
    ['tenants','Tenants',Building2],
    ['qualification','Qualification',PackageCheck],
    ['catalogue','Software catalogue',ShieldCheck],
    ['audit','Audit',Activity],
  ]
  async function logout(){
    await api('/auth/logout',{method:'POST'}).catch(()=>{})
    setUser(null)
  }

  return <div className="h5a-app">
    <aside>
      <div className="h5a-logo"><span>H5</span><div><strong>Hi5Central</strong><small>Admin</small></div></div>
      <nav>{nav.map(([key,label,Icon])=><button className={view===key?'active':''} onClick={()=>setView(key)} key={key}><Icon size={18}/>{label}</button>)}</nav>
      <div className="h5a-user"><strong>{user.name}</strong><small>{user.role}</small><button onClick={logout}><LogOut size={16}/> Sign out</button></div>
    </aside>
    <main className="h5a-main">
      <header><div><strong>Platform control plane</strong><span>admin.hi5central.com</span></div><button className="h5a-icon-button" onClick={()=>load(view)} title="Refresh"><RefreshCw size={17}/></button></header>
      {error?<div className="h5a-error h5a-page-error">{error}</div>:null}
      <div className="h5a-content">
        {view==='overview'?<Overview data={data.overview} refresh={()=>load('overview')}/>:null}
        {view==='tenants'?<Tenants items={data.tenants} refresh={()=>load('tenants')}/>:null}
        {view==='qualification'?<Qualification data={data.qualification}/>:null}
        {view==='catalogue'?<Catalogue items={data.catalogue}/>:null}
        {view==='audit'?<Audit items={data.audit}/>:null}
      </div>
    </main>
  </div>
}
