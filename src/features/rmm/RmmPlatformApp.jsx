import { useEffect, useState } from 'react'
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
  Cpu,
  Database,
  Download,
  ExternalLink,
  HardDrive,
  History,
  KeyRound,
  Laptop,
  LayoutDashboard,
  ListChecks,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  Monitor,
  Moon,
  MoreHorizontal,
  Network,
  Package,
  PackageCheck,
  Play,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Tag,
  TerminalSquare,
  Users,
  Wifi,
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
import { resolveTenantSurface, rmmPath, rmmRouteFromLocation } from '../../lib/tenantSurface.js'
import {
  RmmDeviceGroupsManagement,
  RmmDeviceInventory,
  RmmSitesManagement,
} from './RmmEstateManagement.jsx'
import './RmmPlatformApp.css'

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Workspace' },
  { id: 'devices', label: 'Devices', icon: Monitor, section: 'Manage' },
  { id: 'sites', label: 'Sites', icon: MapPin, section: 'Manage' },
  { id: 'groups', label: 'Device groups', icon: Users, section: 'Manage' },
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
  sites: ['Estate structure', 'Sites', 'Organise devices by location and define default management scope.'],
  groups: ['Estate structure', 'Device groups', 'Build static and dynamic scopes for policy and deployment targeting.'],
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

function recordPrefix(ticket) {
  if (ticket?.type === 'Incident') return 'incidents'
  if (ticket?.type === 'Service Request') return 'requests'
  if (ticket?.type === 'Problem') return 'problems'
  if (ticket?.type === 'Change') return 'changes'
  const id = String(ticket?.id || '')
  if (id.startsWith('INC-')) return 'incidents'
  if (id.startsWith('REQ-')) return 'requests'
  if (id.startsWith('PRB-')) return 'problems'
  if (id.startsWith('CHG-')) return 'changes'
  return 'tickets'
}

function itsmRecordHref(ticket) {
  const path = `/${recordPrefix(ticket)}/${encodeURIComponent(ticket.id)}`
  const surface = resolveTenantSurface()
  if (surface?.canonical && surface?.tenantSlug) {
    return `https://${surface.tenantSlug}.hi5central.com${path}`
  }
  return path
}

function securityTone(value = '') {
  const normalized = String(value).toLowerCase()
  if (normalized.includes('disabled') || normalized.includes('not protected') || normalized.includes('not onboarded')) return 'critical'
  if (normalized.includes('warning') || normalized.includes('attention')) return 'warning'
  if (normalized.includes('protected') || normalized.includes('healthy') || normalized.includes('enabled') || normalized.includes('ready') || normalized.includes('onboarded') || normalized.includes('full security')) return 'healthy'
  return 'neutral'
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
      <label className="rmm-global-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search devices, users, sites, groups, alerts…" /></label>
      <div className="rmm-topbar-actions"><button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} type="button">{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</button><button className="rmm-notification-button" onClick={() => navigate('alerts')} type="button"><Bell size={17} /><b>{rmmAlerts.filter((alert) => alert.status === 'Open').length}</b></button><button className="rmm-user" onClick={onLogout} type="button"><span>{currentUser.initials}</span><div><strong>{currentUser.name}</strong><small>Sign out</small></div><LogOut size={14} /></button></div>
    </header>
  )
}

function PageHeading({ activeView, action }) {
  const [eyebrow, title, description] = pageMeta[activeView] || pageMeta.dashboard
  return <div className="rmm-page-heading"><div><span className="rmm-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function RmmDashboard({ navigate, openDevice }) {
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

function DeviceMetric({ icon: Icon, label, value, suffix = '%', tone }) {
  return <div className={`rmm-device-metric ${tone}`}><span><Icon size={17} /></span><div><small>{label}</small><strong>{value}{suffix}</strong></div><div className="rmm-device-meter"><span style={{ width: `${Math.min(100, Number(value) || 0)}%` }} /></div></div>
}

function DeviceProperty({ label, value, detail }) {
  return <div><span>{label}</span><strong>{value || 'Not reported'}</strong>{detail && <small>{detail}</small>}</div>
}

function DeviceOverview({ device, deviceAlerts, relatedTickets, navigate, onCreateIncident }) {
  const security = device.security || {}
  return (
    <div className="rmm-device-overview-layout">
      <div className="rmm-device-overview-main">
        <section className="rmm-card">
          <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Inventory</span><h2>System & ownership</h2></div></div>
          <div className="rmm-property-grid detailed">
            <DeviceProperty label="Assigned user" value={device.user} detail={device.userEmail} />
            <DeviceProperty label="Manufacturer / model" value={`${device.manufacturer} ${device.model}`} detail={device.serial} />
            <DeviceProperty label="Operating system" value={device.os} detail={`${device.edition || ''}${device.osBuild ? ` · build ${device.osBuild}` : ''}`} />
            <DeviceProperty label="Processor" value={device.processor} />
            <DeviceProperty label="Memory" value={`${device.ramGb} GB`} />
            <DeviceProperty label="Storage" value={`${device.storageGb} GB`} detail={`${device.storageFreeGb} GB free`} />
            <DeviceProperty label="Site" value={device.site} />
            <DeviceProperty label="Device group" value={device.group} detail={device.policy} />
          </div>
        </section>

        <section className="rmm-card">
          <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Network</span><h2>Connectivity</h2></div></div>
          <div className="rmm-property-grid detailed">
            <DeviceProperty label="Private IP" value={device.ip} />
            <DeviceProperty label="Public IP" value={device.publicIp} />
            <DeviceProperty label="Gateway" value={device.gateway} />
            <DeviceProperty label="Primary MAC" value={device.mac} />
            <DeviceProperty label="Last seen" value={device.lastSeen} />
            <DeviceProperty label="Uptime" value={device.uptime} detail={`Last boot ${device.lastBoot}`} />
          </div>
        </section>

        <section className="rmm-card">
          <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Monitoring</span><h2>Current alerts</h2></div><button onClick={() => navigate('alerts')} type="button">All alerts <ChevronRight size={14} /></button></div>
          <div className="rmm-alert-mini-list">
            {deviceAlerts.length ? deviceAlerts.map((alert) => (
              <article key={alert.id}>
                <span className={`rmm-alert-dot ${healthClass(alert.severity)}`} />
                <div><strong>{alert.title}</strong><span>{alert.detail}</span><small>{alert.raised} · {alert.policy}</small></div>
                <div className="rmm-device-alert-actions"><StatusPill tone={healthClass(alert.severity)}>{alert.severity}</StatusPill><button onClick={() => onCreateIncident(alert)} type="button">Create incident</button></div>
              </article>
            )) : <div className="rmm-empty compact"><CheckCircle2 size={24} /><strong>No active alerts</strong><span>This device currently passes its assigned monitoring policies.</span></div>}
          </div>
        </section>
      </div>

      <aside className="rmm-device-overview-side">
        <section className="rmm-card rmm-security-summary">
          <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Security</span><h2>Security posture</h2></div></div>
          {[
            ['Encryption', security.encryptionState, security.encryption],
            ['Antivirus', security.avState, security.av],
            ['Firewall', security.firewall, 'Host firewall'],
            ['Secure boot', security.secureBoot, 'Platform integrity'],
            ['EDR', security.edrState, security.edr],
          ].map(([label, value, detail]) => <div key={label}><span className={`rmm-security-state ${securityTone(value)}`}><ShieldCheck size={15} /></span><span><strong>{label}</strong><small>{detail}</small></span><StatusPill tone={securityTone(value)}>{value}</StatusPill></div>)}
        </section>

        <section className="rmm-card rmm-itsm-bridge-card">
          <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Hi5Central ITSM</span><h2>Related service records</h2></div></div>
          <p>When ITSM and RMM are licensed together, device context can travel with incidents without merging the two product interfaces.</p>
          {relatedTickets.slice(0, 4).map((ticket) => <a href={itsmRecordHref(ticket)} key={ticket.id} target="_blank" rel="noreferrer"><span><strong>{ticket.id}</strong><small>{ticket.type}</small></span><span>{ticket.title}</span><ExternalLink size={14} /></a>)}
          {!relatedTickets.length && <div className="rmm-empty compact"><Database size={22} /><strong>No linked ITSM records</strong><span>Create an incident to establish an explicit device relationship.</span></div>}
          <button className="rmm-primary compact" onClick={() => onCreateIncident()} type="button"><AlertTriangle size={14} /> Create ITSM incident</button>
        </section>

        <section className="rmm-card rmm-device-tags-card">
          <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Classification</span><h2>Tags & management</h2></div></div>
          <div className="rmm-device-tags">{(device.tags || []).map((tag) => <span key={tag}><Tag size={12} />{tag}</span>)}</div>
          <div className="rmm-device-management-meta"><span><strong>{device.agent}</strong><small>Agent · {device.agentChannel}</small></span><span><strong>{device.managedSince}</strong><small>Managed since</small></span><span><strong>{device.timeZone}</strong><small>Time zone</small></span></div>
        </section>
      </aside>
    </div>
  )
}

function DeviceHardware({ device }) {
  return (
    <div className="rmm-device-section-grid">
      <section className="rmm-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">System</span><h2>Hardware inventory</h2></div></div><div className="rmm-property-grid detailed"><DeviceProperty label="Manufacturer" value={device.manufacturer} /><DeviceProperty label="Model" value={device.model} /><DeviceProperty label="Serial number" value={device.serial} /><DeviceProperty label="BIOS / firmware" value={device.bios} /><DeviceProperty label="Processor" value={device.processor} /><DeviceProperty label="Installed RAM" value={`${device.ramGb} GB`} /><DeviceProperty label="Storage capacity" value={`${device.storageGb} GB`} detail={`${device.storageFreeGb} GB available`} /><DeviceProperty label="Warranty" value={device.warranty} /></div></section>
      <section className="rmm-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">Interfaces</span><h2>Network adapters</h2></div></div><div className="rmm-adapter-list">{(device.networkAdapters || []).map((adapter) => <article key={adapter.name}><span><Network size={17} /></span><div><strong>{adapter.name}</strong><small>{adapter.type} · {adapter.mac}</small></div><div><strong>{adapter.address}</strong><StatusPill>{adapter.status}</StatusPill></div></article>)}</div></section>
    </div>
  )
}

function DeviceSoftware({ device }) {
  return (
    <section className="rmm-table-card">
      <div className="rmm-device-section-heading"><div><span className="rmm-eyebrow">Inventory</span><h2>Installed software</h2><p>{device.installedSoftware?.length || 0} applications are shown in this prototype inventory.</p></div><button className="rmm-primary compact" type="button"><PackageCheck size={14} /> Deploy software</button></div>
      <div className="rmm-table rmm-device-software-table">
        <div className="rmm-table-head"><span>Application</span><span>Version</span><span>Publisher</span><span>Installed</span><span>Management</span></div>
        {(device.installedSoftware || []).map((app) => <div className="rmm-table-row" key={`${app.name}-${app.version}`}><span className="rmm-device-cell"><span className="rmm-device-icon neutral"><Package size={16} /></span><span><strong>{app.name}</strong><small>{app.managed ? 'Managed application' : 'Observed software'}</small></span></span><span><strong>{app.version}</strong></span><span><strong>{app.publisher}</strong></span><span><strong>{app.installed}</strong></span><span><StatusPill tone={app.managed ? 'healthy' : 'neutral'}>{app.managed ? 'Managed' : 'Observed'}</StatusPill></span></div>)}
      </div>
      {!device.installedSoftware?.length && <div className="rmm-empty"><Package size={24} /><strong>No software inventory</strong><span>This device does not report installed application inventory.</span></div>}
    </section>
  )
}

function DevicePatching({ device }) {
  return (
    <>
      <div className="rmm-device-patch-summary"><div><span><ShieldCheck size={18} /></span><div><strong>{device.patchCompliance}%</strong><small>Patch compliance</small></div></div><div><span><Download size={18} /></span><div><strong>{device.pendingPatches}</strong><small>Pending updates</small></div></div><div><span><Clock3 size={18} /></span><div><strong>{device.policy}</strong><small>Assigned maintenance policy</small></div></div></div>
      <section className="rmm-table-card"><div className="rmm-device-section-heading"><div><span className="rmm-eyebrow">Update inventory</span><h2>Operating system patches</h2></div><button className="rmm-primary compact" type="button"><Play size={14} /> Deploy approved</button></div><div className="rmm-table rmm-device-patch-table"><div className="rmm-table-head"><span>Update</span><span>Classification</span><span>Severity</span><span>Released</span><span>State</span><span>Reboot</span></div>{(device.patches || []).map((patch) => <div className="rmm-table-row" key={patch.id}><span><strong>{patch.title}</strong><small>{patch.id}</small></span><span><strong>{patch.classification}</strong></span><span><StatusPill tone={healthClass(patch.severity)}>{patch.severity}</StatusPill></span><span><strong>{patch.released}</strong></span><span><StatusPill tone={patch.state === 'Installed' ? 'healthy' : 'warning'}>{patch.state}</StatusPill></span><span><strong>{patch.reboot ? 'Required' : 'No'}</strong></span></div>)}</div></section>
    </>
  )
}

function DeviceSecurity({ device }) {
  const security = device.security || {}
  const checks = [
    ['Disk encryption', security.encryptionState, security.encryption],
    ['Antivirus', security.avState, security.av],
    ['Endpoint detection', security.edrState, security.edr],
    ['Host firewall', security.firewall, 'Operating system firewall state'],
    ['Secure boot', security.secureBoot, 'Boot integrity'],
    ['TPM / trust', security.tpm, 'Hardware-backed trust capability'],
  ]
  return <div className="rmm-security-grid">{checks.map(([label, state, detail]) => <article className="rmm-card" key={label}><span className={`rmm-security-card-icon ${securityTone(state)}`}><ShieldCheck size={20} /></span><span className="rmm-eyebrow">{label}</span><h2>{state || 'Not reported'}</h2><p>{detail}</p><StatusPill tone={securityTone(state)}>{securityTone(state) === 'healthy' ? 'Compliant' : securityTone(state) === 'critical' ? 'Action required' : 'Observed'}</StatusPill></article>)}</div>
}

function DeviceActivity({ device }) {
  return <section className="rmm-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">Device history</span><h2>Recent activity</h2></div></div><div className="rmm-device-activity-list">{(device.activity || []).map((event) => <article key={event.id}><span><History size={15} /></span><div><strong>{event.title}</strong><p>{event.detail}</p><small>{event.time} · {event.actor}</small></div></article>)}</div></section>
}

function DeviceItsm({ relatedTickets, onCreateIncident }) {
  return (
    <div className="rmm-device-itsm-layout">
      <section className="rmm-card rmm-itsm-bridge-intro"><span className="rmm-itsm-logo"><Database size={24} /></span><span className="rmm-eyebrow">Native product bridge</span><h2>RMM device ↔ ITSM service context</h2><p>Keep Hi5Central RMM and Hi5Central ITSM as separate products while sharing device identity, requester context and operational history when both modules are licensed.</p><div><span><CheckCircle2 size={15} /> Create an ITSM incident directly from a device or alert</span><span><CheckCircle2 size={15} /> Carry hostname, device ID and alert metadata into the incident</span><span><CheckCircle2 size={15} /> Open related ITSM records without putting ITSM navigation inside RMM</span><span><CheckCircle2 size={15} /> Open the originating RMM device again from the ITSM record</span></div><button className="rmm-primary" onClick={() => onCreateIncident()} type="button"><AlertTriangle size={15} /> Create incident for this device</button></section>
      <section className="rmm-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">Related records</span><h2>ITSM history</h2></div></div><div className="rmm-device-itsm-records">{relatedTickets.length ? relatedTickets.map((ticket) => <a href={itsmRecordHref(ticket)} key={ticket.id} target="_blank" rel="noreferrer"><span className={`rmm-itsm-record-type ${String(ticket.type).toLowerCase().replace(/\s+/g, '-')}`}>{ticket.type}</span><span><strong>{ticket.id} · {ticket.title}</strong><small>{ticket.status} · {ticket.team || 'Unassigned group'} · Updated {ticket.updated}</small></span><ExternalLink size={15} /></a>) : <div className="rmm-empty"><Database size={24} /><strong>No ITSM history for this device yet</strong><span>Create an incident to demonstrate the explicit cross-product relationship.</span></div>}</div></section>
    </div>
  )
}

function RmmDeviceDetail({ device, onBack, navigate, onCreateIncident, tickets = [] }) {
  const [section, setSection] = useState('overview')
  const deviceAlerts = rmmAlerts.filter((alert) => alert.deviceId === device.id)
  const relatedTickets = tickets.filter((ticket) => (
    ticket.rmmDeviceId === device.id
    || ticket.rmmDeviceName === device.name
    || (ticket.linkedAssets || []).includes(device.id)
    || (ticket.linkedAssets || []).includes(device.name)
    || (device.relatedRecordIds || []).includes(ticket.id)
    || (device.user && ticket.requester === device.user)
  ))

  const sections = [
    ['overview', 'Overview', CircleGauge],
    ['hardware', 'Hardware', Cpu],
    ['software', 'Software', Package],
    ['patching', 'Patching', ShieldCheck],
    ['security', 'Security', ShieldCheck],
    ['activity', 'Activity', History],
    ['itsm', 'ITSM', Database],
  ]

  function createIncident(alert) {
    onCreateIncident?.({ device, alert })
  }

  let content
  if (section === 'hardware') content = <DeviceHardware device={device} />
  else if (section === 'software') content = <DeviceSoftware device={device} />
  else if (section === 'patching') content = <DevicePatching device={device} />
  else if (section === 'security') content = <DeviceSecurity device={device} />
  else if (section === 'activity') content = <DeviceActivity device={device} />
  else if (section === 'itsm') content = <DeviceItsm device={device} onCreateIncident={createIncident} relatedTickets={relatedTickets} />
  else content = <DeviceOverview device={device} deviceAlerts={deviceAlerts} navigate={navigate} onCreateIncident={createIncident} relatedTickets={relatedTickets} />

  return (
    <div className="rmm-device-detail">
      <button className="rmm-back" onClick={onBack} type="button"><ChevronRight size={15} /> Back to devices</button>
      <header className="rmm-device-hero">
        <div className={`rmm-device-hero-icon ${healthClass(device.health)}`}><DeviceIcon device={device} size={28} /></div>
        <div className="rmm-device-hero-copy">
          <span className="rmm-eyebrow">{device.id} · {device.serial}</span>
          <h1>{device.name}</h1>
          <p>{device.user} · {device.site} · {device.group}</p>
          <div><StatusPill>{device.status}</StatusPill><StatusPill>{device.health}</StatusPill><span>{device.os}</span><span>Agent {device.agent}</span></div>
        </div>
        <div className="rmm-device-actions">
          <button className="rmm-primary compact" onClick={() => navigate('remote')} type="button"><Monitor size={16} /> Remote desktop</button>
          <button onClick={() => navigate('remote')} type="button"><TerminalSquare size={16} /> Terminal</button>
          <button onClick={() => navigate('remote')} type="button"><Box size={16} /> Files</button>
          <button onClick={() => createIncident()} type="button"><AlertTriangle size={16} /> ITSM incident</button>
        </div>
      </header>

      <div className="rmm-device-metric-grid">
        <DeviceMetric icon={CircleGauge} label="CPU" value={device.cpu} tone={metricTone(device.cpu)} />
        <DeviceMetric icon={Activity} label="Memory" value={device.memory} tone={metricTone(device.memory)} />
        <DeviceMetric icon={HardDrive} label="Disk" value={device.disk} tone={metricTone(device.disk, 80, 92)} />
        <div className={`rmm-device-metric patch ${device.patchCompliance < 90 ? 'warning' : 'healthy'}`}><span><ShieldCheck size={17} /></span><div><small>Patch compliance</small><strong>{device.patchCompliance}%</strong></div><small>{device.pendingPatches} pending update{device.pendingPatches === 1 ? '' : 's'}</small></div>
      </div>

      <nav className="rmm-device-subnav" aria-label="Device detail sections">
        {sections.map(([id, label, Icon]) => <button className={section === id ? 'active' : ''} key={id} onClick={() => setSection(id)} type="button"><Icon size={14} />{label}{id === 'itsm' && relatedTickets.length > 0 && <b>{relatedTickets.length}</b>}</button>)}
      </nav>

      <div className="rmm-device-section">{content}</div>
    </div>
  )
}

function RmmAlerts({ onCreateIncident, openDevice, query }) {
  const [severity, setSeverity] = useState('All')
  const normalized = query.trim().toLowerCase()
  const visible = rmmAlerts.filter((alert) => (severity === 'All' || alert.severity === severity) && (!normalized || [alert.title, alert.device, alert.detail, alert.policy].join(' ').toLowerCase().includes(normalized)))
  return <><PageHeading activeView="alerts" action={<button className="rmm-primary compact" type="button"><CheckCircle2 size={16} /> Acknowledge selected</button>} /><div className="rmm-list-toolbar"><div className="rmm-filter-pills">{['All', 'Critical', 'High', 'Medium'].map((value) => <button className={severity === value ? 'active' : ''} key={value} onClick={() => setSeverity(value)} type="button">{value}</button>)}</div><span>{visible.filter((alert) => alert.status === 'Open').length} open</span></div><div className="rmm-alert-list">{visible.map((alert) => <article className="rmm-card" key={alert.id}><div className={`rmm-alert-severity ${healthClass(alert.severity)}`}><AlertTriangle size={19} /></div><div className="rmm-alert-copy"><div><span className="rmm-eyebrow">{alert.id} · {alert.policy}</span><h2>{alert.title}</h2><p>{alert.detail}</p></div><button onClick={() => openDevice(rmmDevices.find((device) => device.id === alert.deviceId))} type="button"><Monitor size={14} /> {alert.device}</button></div><div className="rmm-alert-meta"><StatusPill tone={healthClass(alert.severity)}>{alert.severity}</StatusPill><span>{alert.raised}</span><button onClick={() => onCreateIncident?.({ alert, device: rmmDevices.find((device) => device.id === alert.deviceId) })} type="button">Create incident</button><button type="button">Acknowledge</button><button type="button"><MoreHorizontal size={16} /></button></div></article>)}</div></>
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

function RmmSettings({ navigate }) {
  const settings = [
    { icon: Download, title: 'Agent deployment', detail: 'Installer packages, enrollment tokens and stable/preview channels.' },
    { icon: MapPin, title: 'Sites & device groups', detail: 'Organise endpoints by location, department, role or dynamic rule.', target: 'sites' },
    { icon: ShieldCheck, title: 'Maintenance windows', detail: 'Control when patching, restarts and automated remediation may run.' },
    { icon: KeyRound, title: 'Credentials & secrets', detail: 'Secure credentials used by remote actions, scripts and integrations.' },
    { icon: Bell, title: 'Alerting & notifications', detail: 'Thresholds, escalation targets and integrations for monitoring events.' },
    { icon: Network, title: 'Network discovery', detail: 'Discovery ranges, SNMP credentials and monitored network devices.' },
  ]
  return <><PageHeading activeView="settings" /><div className="rmm-settings-grid">{settings.map(({ icon: Icon, title, detail, target }) => <button className="rmm-card" key={title} onClick={() => target && navigate(target)} type="button"><span><Icon size={19} /></span><div><strong>{title}</strong><small>{detail}</small></div><ChevronRight size={17} /></button>)}</div></>
}

export function RmmPlatformApp({ accent, currentUser, handleLogout, onCreateItsmIncident, setTheme, tenantName, theme, tickets = [] }) {
  const initialRoute = rmmRouteFromLocation()
  const [activeView, setActiveView] = useState(initialRoute.viewId || 'dashboard')
  const [selectedDeviceId, setSelectedDeviceId] = useState(initialRoute.deviceId || '')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const [inventoryPreset, setInventoryPreset] = useState(null)
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

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  function createItsmIncident(context) {
    const created = onCreateItsmIncident?.(context)
    if (created?.id) setToast(`${created.id} created in Hi5Central ITSM`)
    return created
  }

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

  function openScopedInventory(preset) {
    setInventoryPreset({ ...preset, requestedAt: Date.now() })
    navigate('devices')
  }

  function renderPage() {
    if (selectedDevice) return <RmmDeviceDetail device={selectedDevice} navigate={navigate} onBack={() => { setSelectedDeviceId(''); window.history.pushState({}, '', rmmPath(undefined, 'devices')) }} onCreateIncident={createItsmIncident} tickets={tickets} />
    if (activeView === 'devices') return <RmmDeviceInventory openDevice={openDevice} query={query} preset={inventoryPreset} onPresetApplied={() => setInventoryPreset(null)} />
    if (activeView === 'sites') return <RmmSitesManagement query={query} onViewDevices={openScopedInventory} />
    if (activeView === 'groups') return <RmmDeviceGroupsManagement query={query} onViewDevices={openScopedInventory} />
    if (activeView === 'alerts') return <RmmAlerts onCreateIncident={createItsmIncident} openDevice={openDevice} query={query} />
    if (activeView === 'remote') return <RmmRemote openDevice={openDevice} />
    if (activeView === 'patching') return <RmmPatching />
    if (activeView === 'software') return <RmmSoftware />
    if (activeView === 'automation') return <RmmAutomation />
    if (activeView === 'policies') return <RmmPolicies />
    if (activeView === 'jobs') return <RmmJobs />
    if (activeView === 'reports') return <RmmReports />
    if (activeView === 'settings') return <RmmSettings navigate={navigate} />
    return <RmmDashboard navigate={navigate} openDevice={openDevice} />
  }

  return (
    <div className="rmm-app" data-accent={accent} data-theme={theme}>
      <RmmSidebar activeView={activeView} mobileOpen={mobileOpen} navigate={navigate} onClose={() => setMobileOpen(false)} tenantName={tenantName} />
      <div className="rmm-shell-main">
        <RmmTopbar activeView={activeView} currentUser={currentUser} navigate={navigate} onLogout={handleLogout} onMenu={() => setMobileOpen(true)} query={query} setQuery={setQuery} setTheme={setTheme} theme={theme} />
        <main className="rmm-main-scroll"><div className="rmm-page">{renderPage()}</div></main>
      </div>
      {toast && <div className="rmm-toast"><CheckCircle2 size={16} />{toast}</div>}
    </div>
  )
}
