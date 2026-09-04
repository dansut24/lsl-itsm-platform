import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Box,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  Clock3,
  Code2,
  Download,
  HardDrive,
  KeyRound,
  Laptop,
  LayoutDashboard,
  ListChecks,
  LogIn,
  LogOut,
  Menu,
  Monitor,
  Moon,
  MoreHorizontal,
  Network,
  PackageCheck,
  Play,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  TerminalSquare,
  Users,
  Wifi,
  Wrench,
  X,
  Zap,
} from 'lucide-react'
import { loginProfiles } from '../../data/demoData.jsx'
import {
  rmmActivity,
  rmmAlerts,
  rmmDevices,
  rmmJobs,
  rmmPatchGroups,
  rmmPolicies,
  rmmScripts,
  rmmSoftware,
} from '../../data/rmmData.js'
import { rmmPath, rmmRouteFromLocation } from '../../lib/tenantSurface.js'
import './RmmPlatformApp.css'

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Workspace' },
  { id: 'devices', label: 'Devices', icon: Monitor, section: 'Manage' },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle, section: 'Manage' },
  { id: 'remote', label: 'Remote access', icon: TerminalSquare, section: 'Operate' },
  { id: 'patching', label: 'Patching', icon: ShieldCheck, section: 'Operate' },
  { id: 'software', label: 'Software', icon: PackageCheck, section: 'Operate' },
  { id: 'automation', label: 'Automation', icon: Code2, section: 'Operate' },
  { id: 'policies', label: 'Policies', icon: SlidersHorizontal, section: 'Configure' },
  { id: 'jobs', label: 'Jobs', icon: ListChecks, section: 'Configure' },
  { id: 'reports', label: 'Reports', icon: BarChart3, section: 'Insights' },
  { id: 'settings', label: 'RMM settings', icon: Settings, section: 'Administration' },
]

const pageMeta = {
  dashboard: ['RMM overview', 'Dashboard', 'Health, alerts, automation and fleet activity across your managed estate.'],
  devices: ['Estate', 'Devices', 'Search and manage every endpoint, server and monitored network device.'],
  alerts: ['Monitoring', 'Alerts', 'Prioritise active monitoring conditions and device health exceptions.'],
  remote: ['Support', 'Remote access', 'Connect to managed endpoints using remote desktop, terminal and file tools.'],
  patching: ['Maintenance', 'Patching', 'Track update compliance, maintenance rings and deployment failures.'],
  software: ['Applications', 'Software', 'Understand installed software and manage application deployments.'],
  automation: ['Automation', 'Scripts & automation', 'Run trusted scripts, recurring maintenance and remediation actions.'],
  policies: ['Configuration', 'Policies', 'Control monitoring, maintenance, agent and security settings by scope.'],
  jobs: ['Execution', 'Jobs', 'Follow queued, running, completed and failed work across the RMM service.'],
  reports: ['Insights', 'Reports', 'Fleet health, patch compliance, software and operational reporting.'],
  settings: ['Administration', 'RMM settings', 'Agent, sites, credentials, maintenance and integration configuration.'],
}

function initials(value = '') {
  return String(value).split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '??'
}

function healthClass(value = '') {
  const normalized = String(value).toLowerCase()
  if (['critical', 'failed'].includes(normalized)) return 'critical'
  if (['warning', 'high'].includes(normalized)) return 'warning'
  if (['offline'].includes(normalized)) return 'offline'
  if (['healthy', 'online', 'completed', 'active'].includes(normalized)) return 'healthy'
  if (['running'].includes(normalized)) return 'running'
  return 'neutral'
}

function metricTone(value, warning = 75, critical = 90) {
  if (Number(value) >= critical) return 'critical'
  if (Number(value) >= warning) return 'warning'
  return 'healthy'
}

function DeviceIcon({ device, size = 18 }) {
  if (String(device?.type).toLowerCase().includes('server')) return <Server size={size} />
  if (String(device?.type).toLowerCase().includes('network')) return <Network size={size} />
  if (String(device?.type).toLowerCase().includes('mac')) return <Laptop size={size} />
  return <Monitor size={size} />
}

function StatusPill({ children, tone }) {
  return <span className={`rmm-status-pill ${tone || healthClass(children)}`}>{children}</span>
}

export function RmmLoginScreen({ accent, fillCredentials, loginError, loginForm, onLogin, setLoginForm, setTheme, tenantName, theme }) {
  const profile = loginProfiles.rmm
  return (
    <main className="rmm-login" data-accent={accent} data-theme={theme}>
      <section className="rmm-login-panel">
        <div className="rmm-login-brand"><img src={`${import.meta.env.BASE_URL}hi5central-logo.png`} alt="Hi5Central" /><span>RMM</span></div>
        <div className="rmm-login-copy"><span className="rmm-eyebrow">{tenantName}</span><h1>Remote Monitoring & Management</h1><p>Sign in to monitor devices, resolve alerts, deploy software, patch systems and start secure remote support sessions.</p></div>
        <form className="rmm-login-form" onSubmit={onLogin}>
          <label>Email address<input autoComplete="username" value={loginForm.username} onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })} placeholder={profile.username} /></label>
          <label>Password<input autoComplete="current-password" type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} placeholder="Enter your password" /></label>
          {loginError && <div className="rmm-login-error"><AlertTriangle size={16} />{loginError}</div>}
          <button className="rmm-primary" type="submit"><LogIn size={17} /> Sign in to RMM</button>
        </form>
        <button className="rmm-demo-login" onClick={() => fillCredentials('rmm')} type="button"><KeyRound size={17} /><span><strong>Use demo RMM account</strong><small>{profile.username} · {profile.password}</small></span></button>
      </section>
      <aside className="rmm-login-visual">
        <div className="rmm-login-visual-head"><button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} type="button">{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button></div>
        <div className="rmm-login-preview">
          <span className="rmm-eyebrow">Live estate preview</span><h2>One operational view of every managed device.</h2>
          <div className="rmm-login-preview-grid"><div><Monitor size={21} /><strong>184</strong><span>Managed devices</span></div><div><CheckCircle2 size={21} /><strong>96%</strong><span>Patch compliance</span></div><div><AlertTriangle size={21} /><strong>2</strong><span>Critical alerts</span></div><div><Zap size={21} /><strong>5</strong><span>Active jobs</span></div></div>
        </div>
      </aside>
    </main>
  )
}

function RmmSidebar({ activeView, mobileOpen, navigate, onClose, tenantName }) {
  const sections = [...new Set(navigation.map((item) => item.section))]
  return (
    <>
      {mobileOpen && <button className="rmm-sidebar-backdrop" aria-label="Close navigation" onClick={onClose} type="button" />}
      <aside className={`rmm-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="rmm-sidebar-brand"><img src={`${import.meta.env.BASE_URL}hi5central-logo.png`} alt="Hi5Central" /><div><strong>{tenantName}</strong><span>RMM</span></div><button className="rmm-mobile-close" onClick={onClose} type="button"><X size={19} /></button></div>
        <div className="rmm-estate-chip"><span><Wifi size={15} /></span><div><strong>Estate connected</strong><small>181 / 184 devices online</small></div></div>
        <nav className="rmm-nav">
          {sections.map((section) => <div className="rmm-nav-section" key={section}><span>{section}</span>{navigation.filter((item) => item.section === section).map(({ id, label, icon: Icon }) => <button className={activeView === id ? 'active' : ''} key={id} onClick={() => navigate(id)} type="button"><Icon size={17} /><span>{label}</span>{id === 'alerts' && <b>{rmmAlerts.filter((alert) => alert.status === 'Open').length}</b>}</button>)}</div>)}
        </nav>
        <div className="rmm-sidebar-footer"><div><span>HC</span><div><strong>Hi5Central Agent</strong><small>Stable channel · 1.6.2</small></div></div></div>
      </aside>
    </>
  )
}

function RmmTopbar({ activeView, currentUser, navigate, onLogout, onMenu, query, setQuery, setTheme, theme }) {
  const [, title] = pageMeta[activeView] || pageMeta.dashboard
  return (
    <header className="rmm-topbar">
      <div className="rmm-topbar-title"><button className="rmm-menu-button" onClick={onMenu} type="button"><Menu size={19} /></button><div><span>RMM</span><strong>{title}</strong></div></div>
      <label className="rmm-global-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search devices, users, alerts…" /></label>
      <div className="rmm-topbar-actions"><button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} type="button">{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</button><button className="rmm-notification-button" onClick={() => navigate('alerts')} type="button"><Bell size={17} /><b>{rmmAlerts.filter((alert) => alert.status === 'Open').length}</b></button><button className="rmm-user" onClick={onLogout} type="button"><span>{currentUser.initials}</span><div><strong>{currentUser.name}</strong><small>Sign out</small></div><LogOut size={14} /></button></div>
    </header>
  )
}

function PageHeading({ activeView, action }) {
  const [eyebrow, title, description] = pageMeta[activeView] || pageMeta.dashboard
  return <div className="rmm-page-heading"><div><span className="rmm-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function RmmDashboard({ navigate, openDevice }) {
  const online = rmmDevices.filter((device) => device.status === 'Online').length
  const critical = rmmAlerts.filter((alert) => alert.severity === 'Critical' && alert.status === 'Open').length
  const patchTotal = rmmPatchGroups.reduce((sum, group) => sum + group.devices, 0)
  const patchCompliant = rmmPatchGroups.reduce((sum, group) => sum + group.compliant, 0)
  const compliance = Math.round((patchCompliant / patchTotal) * 100)
  const activeJobs = rmmJobs.filter((job) => ['Running', 'Queued'].includes(job.status)).length
  return (
    <>
      <PageHeading activeView="dashboard" action={<button className="rmm-primary compact" onClick={() => navigate('devices')} type="button"><Monitor size={16} /> View devices</button>} />
      <div className="rmm-metric-grid">
        <button onClick={() => navigate('devices')} type="button"><span className="rmm-metric-icon blue"><Monitor size={19} /></span><div><span>Managed devices</span><strong>184</strong><small>181 online · 3 offline</small></div><ChevronRight size={16} /></button>
        <button onClick={() => navigate('alerts')} type="button"><span className="rmm-metric-icon red"><AlertTriangle size={19} /></span><div><span>Critical alerts</span><strong>{critical}</strong><small>{rmmAlerts.filter((alert) => alert.status === 'Open').length} alerts need attention</small></div><ChevronRight size={16} /></button>
        <button onClick={() => navigate('patching')} type="button"><span className="rmm-metric-icon green"><ShieldCheck size={19} /></span><div><span>Patch compliance</span><strong>{compliance}%</strong><small>{patchTotal - patchCompliant} devices pending</small></div><ChevronRight size={16} /></button>
        <button onClick={() => navigate('jobs')} type="button"><span className="rmm-metric-icon violet"><Zap size={19} /></span><div><span>Active jobs</span><strong>{activeJobs}</strong><small>1 failed in the last 24 hr</small></div><ChevronRight size={16} /></button>
      </div>
      <div className="rmm-dashboard-grid">
        <section className="rmm-card rmm-health-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">Estate health</span><h2>Device health</h2></div><button onClick={() => navigate('devices')} type="button">All devices <ChevronRight size={14} /></button></div><div className="rmm-health-summary"><div className="rmm-health-ring"><strong>96%</strong><span>Healthy</span></div><div className="rmm-health-legend"><span><b className="healthy" />Healthy<strong>176</strong></span><span><b className="warning" />Warning<strong>4</strong></span><span><b className="critical" />Critical<strong>1</strong></span><span><b className="offline" />Offline<strong>3</strong></span></div></div><div className="rmm-health-list">{rmmDevices.filter((device) => device.health !== 'Healthy').slice(0, 4).map((device) => <button key={device.id} onClick={() => openDevice(device)} type="button"><span className={`rmm-device-icon ${healthClass(device.health)}`}><DeviceIcon device={device} /></span><span><strong>{device.name}</strong><small>{device.user} · {device.site}</small></span><StatusPill>{device.health}</StatusPill><ChevronRight size={15} /></button>)}</div></section>
        <section className="rmm-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">Monitoring</span><h2>Alerts requiring attention</h2></div><button onClick={() => navigate('alerts')} type="button">Open alerts <ChevronRight size={14} /></button></div><div className="rmm-alert-mini-list">{rmmAlerts.slice(0, 5).map((alert) => <article key={alert.id}><span className={`rmm-alert-dot ${healthClass(alert.severity)}`} /><div><strong>{alert.title}</strong><span>{alert.device}</span><small>{alert.raised} · {alert.policy}</small></div><StatusPill tone={healthClass(alert.severity)}>{alert.severity}</StatusPill></article>)}</div></section>
      </div>
      <div className="rmm-dashboard-lower">
        <section className="rmm-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">Execution</span><h2>Jobs</h2></div><button onClick={() => navigate('jobs')} type="button">View all <ChevronRight size={14} /></button></div><div className="rmm-job-mini-list">{rmmJobs.slice(0, 4).map((job) => <article key={job.id}><span className={`rmm-job-icon ${healthClass(job.status)}`}>{job.type === 'Patch' ? <ShieldCheck size={16} /> : job.type === 'Software' ? <PackageCheck size={16} /> : <Code2 size={16} />}</span><div><strong>{job.title}</strong><small>{job.target} · {job.started}</small>{job.status === 'Running' && <div className="rmm-mini-progress"><span style={{ width: `${job.progress}%` }} /></div>}</div><StatusPill>{job.status}</StatusPill></article>)}</div></section>
        <section className="rmm-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">Recent</span><h2>Activity</h2></div></div><div className="rmm-activity-list">{rmmActivity.map((item) => <article key={item.id}><span className="rmm-activity-icon">{item.kind === 'alert' ? <AlertTriangle size={15} /> : item.kind === 'remote' ? <TerminalSquare size={15} /> : item.kind === 'patch' ? <ShieldCheck size={15} /> : <Zap size={15} />}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div><time>{item.time}</time></article>)}</div></section>
      </div>
    </>
  )
}

function RmmDevices({ openDevice, query }) {
  const [status, setStatus] = useState('All')
  const [group, setGroup] = useState('All')
  const groups = ['All', ...new Set(rmmDevices.map((device) => device.group))]
  const normalized = query.trim().toLowerCase()
  const visible = rmmDevices.filter((device) => (!normalized || [device.name, device.user, device.site, device.group, device.os, device.ip].join(' ').toLowerCase().includes(normalized)) && (status === 'All' || device.status === status) && (group === 'All' || device.group === group))
  return (
    <><PageHeading activeView="devices" action={<button className="rmm-primary compact" type="button"><Download size={16} /> Deploy agent</button>} />
      <div className="rmm-list-toolbar"><div className="rmm-filter-pills">{['All', 'Online', 'Offline'].map((value) => <button className={status === value ? 'active' : ''} key={value} onClick={() => setStatus(value)} type="button">{value}</button>)}</div><label>Group<select value={group} onChange={(event) => setGroup(event.target.value)}>{groups.map((value) => <option key={value}>{value}</option>)}</select></label><span>{visible.length} shown</span></div>
      <section className="rmm-table-card"><div className="rmm-table rmm-device-table"><div className="rmm-table-head"><span>Device</span><span>User / group</span><span>Site</span><span>Health</span><span>Last seen</span><span>Patches</span><span /></div>{visible.map((device) => <button className="rmm-table-row" key={device.id} onClick={() => openDevice(device)} type="button"><span className="rmm-device-cell"><span className={`rmm-device-icon ${healthClass(device.health)}`}><DeviceIcon device={device} /></span><span><strong>{device.name}</strong><small>{device.os}</small></span></span><span><strong>{device.user}</strong><small>{device.group}</small></span><span><strong>{device.site}</strong><small>{device.ip}</small></span><span><StatusPill>{device.health}</StatusPill></span><span><strong>{device.lastSeen}</strong><small>Agent {device.agent}</small></span><span><strong>{device.pendingPatches}</strong><small>pending</small></span><span><ChevronRight size={16} /></span></button>)}</div></section>
    </>
  )
}

function DeviceMetric({ icon: Icon, label, value, suffix = '%', tone }) {
  return <div className={`rmm-device-metric ${tone}`}><span><Icon size={17} /></span><div><small>{label}</small><strong>{value}{suffix}</strong></div><div className="rmm-device-meter"><span style={{ width: `${Math.min(100, Number(value) || 0)}%` }} /></div></div>
}

function RmmDeviceDetail({ device, onBack, navigate }) {
  return (
    <div className="rmm-device-detail"><button className="rmm-back" onClick={onBack} type="button"><ChevronRight size={15} /> Back to devices</button><header className="rmm-device-hero"><div className={`rmm-device-hero-icon ${healthClass(device.health)}`}><DeviceIcon device={device} size={28} /></div><div className="rmm-device-hero-copy"><span className="rmm-eyebrow">{device.id}</span><h1>{device.name}</h1><p>{device.user} · {device.site} · {device.group}</p><div><StatusPill>{device.status}</StatusPill><StatusPill>{device.health}</StatusPill><span>{device.os}</span></div></div><div className="rmm-device-actions"><button className="rmm-primary compact" onClick={() => navigate('remote')} type="button"><TerminalSquare size={16} /> Connect</button><button type="button"><Code2 size={16} /> Run script</button><button type="button"><MoreHorizontal size={17} /></button></div></header>
      <div className="rmm-device-metric-grid"><DeviceMetric icon={CircleGauge} label="CPU" value={device.cpu} tone={metricTone(device.cpu)} /><DeviceMetric icon={Activity} label="Memory" value={device.memory} tone={metricTone(device.memory)} /><DeviceMetric icon={HardDrive} label="Disk" value={device.disk} tone={metricTone(device.disk, 80, 92)} /><div className="rmm-device-metric patch"><span><ShieldCheck size={17} /></span><div><small>Pending patches</small><strong>{device.pendingPatches}</strong></div><small>{device.pendingPatches ? 'Maintenance required' : 'Fully compliant'}</small></div></div>
      <div className="rmm-device-detail-grid"><section className="rmm-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">Inventory</span><h2>Device information</h2></div></div><div className="rmm-property-grid"><div><span>Hostname</span><strong>{device.name}</strong></div><div><span>IP address</span><strong>{device.ip}</strong></div><div><span>Operating system</span><strong>{device.os}</strong></div><div><span>Agent version</span><strong>{device.agent}</strong></div><div><span>Site</span><strong>{device.site}</strong></div><div><span>Device group</span><strong>{device.group}</strong></div><div><span>Assigned user</span><strong>{device.user}</strong></div><div><span>Warranty</span><strong>{device.warranty}</strong></div></div></section><section className="rmm-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">Monitoring</span><h2>Current alerts</h2></div><button onClick={() => navigate('alerts')} type="button">Alerts <ChevronRight size={14} /></button></div><div className="rmm-alert-mini-list">{rmmAlerts.filter((alert) => alert.deviceId === device.id).length ? rmmAlerts.filter((alert) => alert.deviceId === device.id).map((alert) => <article key={alert.id}><span className={`rmm-alert-dot ${healthClass(alert.severity)}`} /><div><strong>{alert.title}</strong><span>{alert.detail}</span><small>{alert.raised}</small></div><StatusPill tone={healthClass(alert.severity)}>{alert.severity}</StatusPill></article>) : <div className="rmm-empty"><CheckCircle2 size={24} /><strong>No active alerts</strong><span>This device currently passes its assigned monitoring policies.</span></div>}</div></section></div>
    </div>
  )
}

function RmmAlerts({ openDevice, query }) {
  const [severity, setSeverity] = useState('All')
  const normalized = query.trim().toLowerCase()
  const visible = rmmAlerts.filter((alert) => (severity === 'All' || alert.severity === severity) && (!normalized || [alert.title, alert.device, alert.detail, alert.policy].join(' ').toLowerCase().includes(normalized)))
  return <><PageHeading activeView="alerts" action={<button className="rmm-primary compact" type="button"><CheckCircle2 size={16} /> Acknowledge selected</button>} /><div className="rmm-list-toolbar"><div className="rmm-filter-pills">{['All', 'Critical', 'High', 'Medium'].map((value) => <button className={severity === value ? 'active' : ''} key={value} onClick={() => setSeverity(value)} type="button">{value}</button>)}</div><span>{visible.filter((alert) => alert.status === 'Open').length} open</span></div><div className="rmm-alert-list">{visible.map((alert) => <article className="rmm-card" key={alert.id}><div className={`rmm-alert-severity ${healthClass(alert.severity)}`}><AlertTriangle size={19} /></div><div className="rmm-alert-copy"><div><span className="rmm-eyebrow">{alert.id} · {alert.policy}</span><h2>{alert.title}</h2><p>{alert.detail}</p></div><button onClick={() => openDevice(rmmDevices.find((device) => device.id === alert.deviceId))} type="button"><Monitor size={14} /> {alert.device}</button></div><div className="rmm-alert-meta"><StatusPill tone={healthClass(alert.severity)}>{alert.severity}</StatusPill><span>{alert.raised}</span><button type="button">Acknowledge</button><button type="button"><MoreHorizontal size={16} /></button></div></article>)}</div></>
}

function RmmRemote({ openDevice }) {
  const online = rmmDevices.filter((device) => device.status === 'Online')
  return <><PageHeading activeView="remote" /><div className="rmm-remote-layout"><section className="rmm-card rmm-remote-launch"><span className="rmm-remote-hero-icon"><TerminalSquare size={28} /></span><span className="rmm-eyebrow">Secure support</span><h2>Start a remote session</h2><p>Select an online endpoint and choose the support tool you need. RMM does not use workspace tabs; sessions launch from the current device context.</p><label><Search size={16} /><select defaultValue=""><option value="" disabled>Select an online device…</option>{online.map((device) => <option key={device.id} value={device.id}>{device.name} · {device.user}</option>)}</select></label><div className="rmm-remote-actions"><button className="rmm-primary" type="button"><Monitor size={17} /> Remote desktop</button><button type="button"><TerminalSquare size={17} /> Terminal</button><button type="button"><Box size={17} /> Files</button></div></section><section className="rmm-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">Recent</span><h2>Recent devices</h2></div></div><div className="rmm-health-list">{online.slice(0, 6).map((device) => <button key={device.id} onClick={() => openDevice(device)} type="button"><span className={`rmm-device-icon ${healthClass(device.health)}`}><DeviceIcon device={device} /></span><span><strong>{device.name}</strong><small>{device.user} · {device.site}</small></span><StatusPill>{device.status}</StatusPill><ChevronRight size={15} /></button>)}</div></section></div></>
}

function RmmPatching() {
  const total = rmmPatchGroups.reduce((sum, item) => sum + item.devices, 0)
  const compliant = rmmPatchGroups.reduce((sum, item) => sum + item.compliant, 0)
  return <><PageHeading activeView="patching" action={<button className="rmm-primary compact" type="button"><RefreshCw size={16} /> Run patch scan</button>} /><div className="rmm-request-stats"><div><strong>{Math.round(compliant / total * 100)}%</strong><span>Compliant</span></div><div><strong>{rmmPatchGroups.reduce((sum, item) => sum + item.pending, 0)}</strong><span>Pending</span></div><div><strong>{rmmPatchGroups.reduce((sum, item) => sum + item.failed, 0)}</strong><span>Failed</span></div><div><strong>14</strong><span>Approved today</span></div></div><div className="rmm-patch-grid">{rmmPatchGroups.map((group) => <article className="rmm-card" key={group.id}><header><span className="rmm-metric-icon green"><ShieldCheck size={18} /></span><div><span className="rmm-eyebrow">{group.policy}</span><h2>{group.name}</h2><p>{group.devices} managed devices · {group.window}</p></div></header><div className="rmm-patch-progress"><span style={{ width: `${Math.round(group.compliant / group.devices * 100)}%` }} /></div><div className="rmm-patch-counts"><span><b>{group.compliant}</b>Compliant</span><span><b>{group.pending}</b>Pending</span><span><b>{group.failed}</b>Failed</span></div><footer><button type="button">View devices</button><button className="rmm-primary compact" type="button"><Play size={14} /> Deploy now</button></footer></article>)}</div></>
}

function RmmSoftware() {
  return <><PageHeading activeView="software" action={<button className="rmm-primary compact" type="button"><PackageCheck size={16} /> New deployment</button>} /><section className="rmm-table-card"><div className="rmm-table rmm-software-table"><div className="rmm-table-head"><span>Application</span><span>Version</span><span>Installed</span><span>Updates</span><span>Management</span><span /></div>{rmmSoftware.map((app) => <div className="rmm-table-row" key={app.name}><span className="rmm-device-cell"><span className="rmm-device-icon neutral"><Box size={17} /></span><span><strong>{app.name}</strong><small>{app.latest ? 'Current release' : 'Update available'}</small></span></span><span><strong>{app.version}</strong></span><span><strong>{app.installed}</strong><small>devices</small></span><span><strong>{app.updates}</strong><small>required</small></span><span><StatusPill tone={app.managed ? 'healthy' : 'neutral'}>{app.managed ? 'Managed' : 'Observed'}</StatusPill></span><span><button type="button"><MoreHorizontal size={16} /></button></span></div>)}</div></section></>
}

function RmmAutomation() {
  return <><PageHeading activeView="automation" action={<button className="rmm-primary compact" type="button"><Code2 size={16} /> New script</button>} /><div className="rmm-automation-grid">{rmmScripts.map((script) => <article className="rmm-card" key={script.id}><div className="rmm-script-icon"><Code2 size={20} /></div><span className="rmm-eyebrow">{script.id} · {script.platform}</span><h2>{script.name}</h2><p>{script.language} · {script.scope}</p><div className="rmm-script-meta"><span><strong>{script.success}%</strong><small>Success rate</small></span><span><strong>{script.lastRun}</strong><small>Last run</small></span></div><footer><button type="button">Edit</button><button className="rmm-primary compact" type="button"><Play size={14} /> Run</button></footer></article>)}</div></>
}

function RmmPolicies() {
  return <><PageHeading activeView="policies" action={<button className="rmm-primary compact" type="button"><SlidersHorizontal size={16} /> New policy</button>} /><div className="rmm-policy-list">{rmmPolicies.map((policy) => <article className="rmm-card" key={policy.id}><span className="rmm-policy-icon"><SlidersHorizontal size={18} /></span><div><span className="rmm-eyebrow">{policy.id}</span><h2>{policy.name}</h2><p>{policy.scope} · {policy.settings} configured settings</p></div><div className="rmm-policy-state"><StatusPill>{policy.status}</StatusPill><span className={policy.drift ? 'drift' : ''}><strong>{policy.drift}</strong> drift</span></div><button type="button"><ChevronRight size={17} /></button></article>)}</div></>
}

function RmmJobs() {
  return <><PageHeading activeView="jobs" /><section className="rmm-table-card"><div className="rmm-table rmm-jobs-table"><div className="rmm-table-head"><span>Job</span><span>Target</span><span>Status</span><span>Progress</span><span>Started</span><span>Initiated by</span></div>{rmmJobs.map((job) => <div className="rmm-table-row" key={job.id}><span><strong>{job.title}</strong><small>{job.id} · {job.type}</small></span><span><strong>{job.target}</strong></span><span><StatusPill>{job.status}</StatusPill></span><span>{job.status === 'Running' ? <div className="rmm-job-progress"><div><span style={{ width: `${job.progress}%` }} /></div><b>{job.progress}%</b></div> : <strong>{job.progress}%</strong>}</span><span><strong>{job.started}</strong></span><span><strong>{job.initiatedBy}</strong></span></div>)}</div></section></>
}

function RmmReports() {
  const cards = [['Fleet health', '94%', 'Healthy across managed devices', CircleGauge], ['Patch compliance', '96%', '+2% from last month', ShieldCheck], ['Alert resolution', '38 min', 'Median time to acknowledge', Clock3], ['Automation success', '98.2%', 'Across 2,814 job executions', Bot]]
  return <><PageHeading activeView="reports" /><div className="rmm-report-metrics">{cards.map(([title, value, detail, Icon]) => <article className="rmm-card" key={title}><Icon size={20} /><span>{title}</span><strong>{value}</strong><small>{detail}</small></article>)}</div><div className="rmm-dashboard-grid"><section className="rmm-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">30 day trend</span><h2>Patch compliance</h2></div></div><div className="rmm-placeholder-chart"><BarChart3 size={34} /><strong>Compliance trend</strong><span>Reporting foundation ready for API-backed historical metrics.</span></div></section><section className="rmm-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">Operations</span><h2>Top alert policies</h2></div></div><div className="rmm-report-list"><span><strong>Endpoint performance</strong><b>18</b></span><span><strong>Disk capacity</strong><b>13</b></span><span><strong>Endpoint availability</strong><b>9</b></span><span><strong>Agent health</strong><b>6</b></span></div></section></div></>
}

function RmmSettings() {
  const settings = [{ icon: Download, title: 'Agent deployment', detail: 'Installer packages, enrollment tokens and stable/preview channels.' }, { icon: Users, title: 'Sites & device groups', detail: 'Organise endpoints by customer site, department, role or platform.' }, { icon: ShieldCheck, title: 'Maintenance windows', detail: 'Control when patching, restarts and automated remediation may run.' }, { icon: KeyRound, title: 'Credentials & secrets', detail: 'Secure credentials used by remote actions, scripts and integrations.' }, { icon: Bell, title: 'Alerting & notifications', detail: 'Thresholds, escalation targets and integrations for monitoring events.' }, { icon: Network, title: 'Network discovery', detail: 'Discovery ranges, SNMP credentials and monitored network devices.' }]
  return <><PageHeading activeView="settings" /><div className="rmm-settings-grid">{settings.map(({ icon: Icon, title, detail }) => <button className="rmm-card" key={title} type="button"><span><Icon size={19} /></span><div><strong>{title}</strong><small>{detail}</small></div><ChevronRight size={17} /></button>)}</div></>
}

export function RmmPlatformApp({ accent, currentUser, handleLogout, setTheme, tenantName, theme }) {
  const initialRoute = rmmRouteFromLocation()
  const [activeView, setActiveView] = useState(initialRoute.viewId || 'dashboard')
  const [selectedDeviceId, setSelectedDeviceId] = useState(initialRoute.deviceId || '')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selectedDevice = rmmDevices.find((device) => device.id === selectedDeviceId)

  useEffect(() => {
    const handlePop = () => {
      const route = rmmRouteFromLocation()
      setActiveView(route.viewId || 'dashboard')
      setSelectedDeviceId(route.deviceId || '')
      setMobileOpen(false)
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  function navigate(viewId, options = {}) {
    setActiveView(viewId)
    setSelectedDeviceId('')
    setMobileOpen(false)
    setQuery('')
    const path = rmmPath(undefined, viewId)
    window.history.pushState({}, '', path)
    if (options.scroll !== false) document.querySelector('.rmm-main-scroll')?.scrollTo?.({ top: 0, behavior: 'auto' })
  }

  function openDevice(device) {
    if (!device) return
    setActiveView('devices')
    setSelectedDeviceId(device.id)
    setMobileOpen(false)
    window.history.pushState({}, '', rmmPath(undefined, 'devices', device.id))
    document.querySelector('.rmm-main-scroll')?.scrollTo?.({ top: 0, behavior: 'auto' })
  }

  function renderPage() {
    if (selectedDevice) return <RmmDeviceDetail device={selectedDevice} navigate={navigate} onBack={() => { setSelectedDeviceId(''); window.history.pushState({}, '', rmmPath(undefined, 'devices')) }} />
    if (activeView === 'devices') return <RmmDevices openDevice={openDevice} query={query} />
    if (activeView === 'alerts') return <RmmAlerts openDevice={openDevice} query={query} />
    if (activeView === 'remote') return <RmmRemote openDevice={openDevice} />
    if (activeView === 'patching') return <RmmPatching />
    if (activeView === 'software') return <RmmSoftware />
    if (activeView === 'automation') return <RmmAutomation />
    if (activeView === 'policies') return <RmmPolicies />
    if (activeView === 'jobs') return <RmmJobs />
    if (activeView === 'reports') return <RmmReports />
    if (activeView === 'settings') return <RmmSettings />
    return <RmmDashboard navigate={navigate} openDevice={openDevice} />
  }

  return (
    <div className="rmm-app" data-accent={accent} data-theme={theme}>
      <RmmSidebar activeView={activeView} mobileOpen={mobileOpen} navigate={navigate} onClose={() => setMobileOpen(false)} tenantName={tenantName} />
      <div className="rmm-shell-main">
        <RmmTopbar activeView={activeView} currentUser={currentUser} navigate={navigate} onLogout={handleLogout} onMenu={() => setMobileOpen(true)} query={query} setQuery={setQuery} setTheme={setTheme} theme={theme} />
        <main className="rmm-main-scroll"><div className="rmm-page">{renderPage()}</div></main>
      </div>
    </div>
  )
}
