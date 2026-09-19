import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
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
  GitBranch,
  Laptop,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPin,
  Menu,
  Monitor,
  Moon,
  MoreHorizontal,
  Network,
  Package,
  PackageCheck,
  Search,
  Server,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Tag,
  TerminalSquare,
  Trash2,
  Users,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react'
import {
  rmmAlerts,
  rmmDevices,
} from '../../data/rmmData.js'
import { deploymentConfig } from '../../lib/deploymentConfig.js'
import { resolveTenantSurface, rmmPath, rmmRouteFromLocation } from '../../lib/tenantSurface.js'
import { resolveDeviceMonitoringPolicy } from '../../data/rmmMonitoringData.js'
import {
  RmmDeviceGroupsManagement,
  RmmDeviceInventory,
  RmmSitesManagement,
} from './RmmEstateManagement.jsx'
import { RmmMonitoringPolicies } from './RmmMonitoringPolicies.jsx'
import { RmmAgentDeployment } from './RmmAgentDeployment.jsx'
import { RmmAutomation } from './RmmAutomationWorkspace.jsx'
import { DeviceActivityTimeline, DeviceJobsPanel, RmmAuditActivity, prefetchDeviceHistory } from './RmmActivityViews.jsx'
import { RmmDeviceToolWorkspace } from './RmmDeviceTools.jsx'
import './RmmPlatformApp.css'

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Workspace' },
  { id: 'devices', label: 'Devices', icon: Monitor, section: 'Manage' },
  { id: 'sites', label: 'Sites', icon: MapPin, section: 'Manage' },
  { id: 'groups', label: 'Device groups', icon: Users, section: 'Manage' },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle, section: 'Manage' },
  { id: 'patching', label: 'Patching', icon: ShieldCheck, section: 'Operate' },
  { id: 'software', label: 'Software', icon: PackageCheck, section: 'Operate' },
  { id: 'automation', label: 'Automation', icon: Code2, section: 'Operate' },
  { id: 'policies', label: 'Policies', icon: SlidersHorizontal, section: 'Configure' },
  { id: 'reports', label: 'Reports', icon: BarChart3, section: 'Insights' },
  { id: 'activity-audit', label: 'Activity audit', icon: History, section: 'Administration', requiresAudit: true },
  { id: 'agent-deployment', label: 'Agent deployment', icon: Download, section: 'Administration' },
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
  reports: ['Insights', 'Reports', 'Fleet health, patch compliance, software and operational reporting.'],
  'activity-audit': ['Administration', 'Activity audit', 'Search the tenant-wide RMM operational and technician audit history.'],
  'agent-deployment': ['Administration', 'Agent deployment', 'Download the Windows agent and create secure, expiring enrollment packages.'],
  settings: ['Administration', 'RMM settings', 'Agent, sites, credentials, maintenance and integration configuration.'],
}

function deviceIsOnline(device) {
  return Boolean(device?.agentDeviceId) && String(device?.status || '').toLowerCase() === 'online'
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
  const deployment = deploymentConfig()
  if (deployment.tenancyMode === 'single') return path
  if (surface?.canonical && surface?.tenantSlug) {
    return `https://${surface.tenantSlug}.${deployment.rootDomain}${path}`
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

function RmmSidebar({ activeView, canAudit = false, mobileOpen, navigate, onClose, tenantName }) {
  const visibleNavigation = navigation.filter((item) => !item.requiresAudit || canAudit)
  const sections = [...new Set(visibleNavigation.map((item) => item.section))]
  return <><button className={`rmm-sidebar-backdrop ${mobileOpen ? 'is-open' : ''}`} aria-label="Close navigation" onClick={onClose} type="button" /><aside className={`rmm-sidebar ${mobileOpen ? 'mobile-open' : ''}`}><div className="rmm-sidebar-brand"><img src={`${import.meta.env.BASE_URL}hi5central-logo.png`} alt="Hi5Central" /><div><strong>{tenantName}</strong><span>RMM</span></div><button className="rmm-mobile-close" onClick={onClose} type="button"><X size={19} /></button></div><nav className="rmm-nav">{sections.map((section) => <div className="rmm-nav-section" key={section}><span>{section}</span>{visibleNavigation.filter((item) => item.section === section).map(({ id, label, icon: Icon }) => <button className={activeView === id ? 'active' : ''} key={id} onClick={() => navigate(id)} type="button"><Icon size={17} /><span>{label}</span>{id === 'alerts' && <b>{rmmAlerts.filter((alert) => alert.status === 'Open').length}</b>}</button>)}</div>)}</nav><div className="rmm-sidebar-footer"><div><span>HC</span><div><strong>Hi5Central</strong><small>Microsoft-connected estate</small></div></div></div></aside></>
}

function RmmPageSkeleton() {
  return <div className="rmm-page-skeleton" aria-label="Loading RMM data">
    <div className="rmm-page-skeleton-heading"><span /><strong /><small /></div>
    <div className="rmm-page-skeleton-metrics">{Array.from({ length: 4 }).map((_, index) => <div key={index}><i /><span><b /><small /></span></div>)}</div>
    <div className="rmm-page-skeleton-panel">
      <div className="rmm-page-skeleton-toolbar"><strong /><span /></div>
      {Array.from({ length: 7 }).map((_, index) => <div className="rmm-page-skeleton-row" key={index}><i /><span /><span /><span /></div>)}
    </div>
  </div>
}

function RmmTopbar({ activeView, currentUser, navigate, onLogout, onMenu, query, setQuery, setTheme, theme }) {
  const [, title] = pageMeta[activeView] || pageMeta.dashboard
  const initials = String(currentUser?.name || 'HC').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'HC'
  return <header className="rmm-topbar"><div className="rmm-topbar-title"><button className="rmm-menu-button" onClick={onMenu} type="button"><Menu size={19} /></button><div><span>RMM</span><strong>{title}</strong></div></div><label className="rmm-global-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search devices, users, sites, groups, alerts…" /></label><div className="rmm-topbar-actions"><button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} type="button">{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</button><button className="rmm-notification-button" onClick={() => navigate('alerts')} type="button"><Bell size={17} /><b>{rmmAlerts.filter((alert) => alert.status === 'Open').length}</b></button><button className="rmm-user" onClick={onLogout} type="button"><span>{initials}</span><div><strong>{currentUser?.name || 'Hi5Central user'}</strong><small>Sign out</small></div><LogOut size={14} /></button></div></header>
}

function PageHeading({ activeView, action }) {
  const [eyebrow, title, description] = pageMeta[activeView] || pageMeta.dashboard
  return <div className="rmm-page-heading"><div><span className="rmm-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function RmmDashboard({ devices = [], navigate, openDevice }) {
  const online = devices.filter((device) => device.status === 'Online').length
  const offline = devices.filter((device) => device.status === 'Offline').length
  const healthy = devices.filter((device) => device.health === 'Healthy').length
  const warning = devices.filter((device) => device.health === 'Warning').length
  const criticalDevices = devices.filter((device) => device.health === 'Critical').length
  const attentionDevices = devices.filter((device) => device.health !== 'Healthy')
  const criticalAlerts = rmmAlerts.filter((alert) => alert.severity === 'Critical' && alert.status === 'Open').length
  const openAlerts = rmmAlerts.filter((alert) => alert.status === 'Open').length
  const patchReported = devices.filter((device) => Number.isFinite(Number(device.patchCompliance)))
  const compliance = patchReported.length ? Math.round(patchReported.reduce((sum, device) => sum + Number(device.patchCompliance), 0) / patchReported.length) : null
  const pendingPatches = devices.reduce((sum, device) => sum + (Number.isFinite(Number(device.pendingPatches)) ? Number(device.pendingPatches) : 0), 0)
  const healthPercent = devices.length ? Math.round((healthy / devices.length) * 100) : null

  return (
    <>
      <PageHeading activeView="dashboard" action={<button className="rmm-primary compact" onClick={() => navigate('devices')} type="button"><Monitor size={16} /> View devices</button>} />
      <div className="rmm-metric-grid">
        <button onClick={() => navigate('devices')} type="button"><span className="rmm-metric-icon blue"><Monitor size={19} /></span><div><span>Managed devices</span><strong>{devices.length}</strong><small>{devices.length ? `${online} online · ${offline} offline` : 'No devices enrolled'}</small></div><ChevronRight size={16} /></button>
        <button onClick={() => navigate('alerts')} type="button"><span className="rmm-metric-icon red"><AlertTriangle size={19} /></span><div><span>Critical alerts</span><strong>{criticalAlerts}</strong><small>{openAlerts ? `${openAlerts} open alert${openAlerts === 1 ? '' : 's'}` : 'No real alerts reported'}</small></div><ChevronRight size={16} /></button>
        <button onClick={() => navigate('patching')} type="button"><span className="rmm-metric-icon green"><ShieldCheck size={19} /></span><div><span>Patch compliance</span><strong>{compliance == null ? '—' : `${compliance}%`}</strong><small>{patchReported.length ? `${pendingPatches} pending update${pendingPatches === 1 ? '' : 's'}` : 'Not reported by enrolled devices'}</small></div><ChevronRight size={16} /></button>
        <button onClick={() => navigate('devices')} type="button"><span className="rmm-metric-icon violet"><Zap size={19} /></span><div><span>Device jobs</span><strong>Per device</strong><small>Open a managed device to view execution history</small></div><ChevronRight size={16} /></button>
      </div>

      <div className="rmm-dashboard-grid">
        <section className="rmm-card rmm-health-card">
          <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Estate health</span><h2>Device health</h2></div><button onClick={() => navigate('devices')} type="button">All devices <ChevronRight size={14} /></button></div>
          {devices.length ? <>
            <div className="rmm-health-summary">
              <div className="rmm-health-ring" style={{ background: `conic-gradient(#239e63 0 ${healthPercent}%, var(--rmm-soft-strong) ${healthPercent}% 100%)` }}><strong>{healthPercent}%</strong><span>Healthy</span></div>
              <div className="rmm-health-legend"><span><b className="healthy" />Healthy<strong>{healthy}</strong></span><span><b className="warning" />Warning<strong>{warning}</strong></span><span><b className="critical" />Critical<strong>{criticalDevices}</strong></span><span><b className="offline" />Offline<strong>{offline}</strong></span></div>
            </div>
            <div className="rmm-health-list">{attentionDevices.slice(0, 4).map((device) => <button key={device.id} onClick={() => openDevice(device)} type="button"><span className={`rmm-device-icon ${healthClass(device.health)}`}><DeviceIcon device={device} /></span><span><strong>{device.name}</strong><small>{device.user} · {device.site || 'No site'}</small></span><StatusPill>{device.health}</StatusPill><ChevronRight size={15} /></button>)}</div>
          </> : <div className="rmm-empty"><Monitor size={24} /><strong>No managed devices yet</strong><span>Enroll the Hi5Central Agent or connect Microsoft Intune to populate this dashboard with real device data.</span></div>}
        </section>

        <section className="rmm-card">
          <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Monitoring</span><h2>Alerts requiring attention</h2></div><button onClick={() => navigate('alerts')} type="button">Open alerts <ChevronRight size={14} /></button></div>
          <div className="rmm-alert-mini-list">{rmmAlerts.slice(0, 5).map((alert) => <article key={alert.id}><span className={`rmm-alert-dot ${healthClass(alert.severity)}`} /><div><strong>{alert.title}</strong><span>{alert.device}</span><small>{alert.raised} · {alert.policy}</small></div><StatusPill tone={healthClass(alert.severity)}>{alert.severity}</StatusPill></article>)}{!rmmAlerts.length && <div className="rmm-empty compact"><CheckCircle2 size={22} /><strong>No real alert records</strong><span>Alerts will appear here when monitoring reports a condition.</span></div>}</div>
        </section>
      </div>

      <div className="rmm-dashboard-lower">
        <section className="rmm-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">Execution</span><h2>Device jobs</h2></div><button onClick={() => navigate('devices')} type="button">Open devices <ChevronRight size={14} /></button></div><div className="rmm-empty compact"><ListChecks size={22} /><strong>Jobs live with each device</strong><span>Open a managed device and use its Jobs tab for queued, running, successful and failed work.</span></div></section>
        <section className="rmm-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">Audit</span><h2>Operational activity</h2></div></div><div className="rmm-empty compact"><History size={22} /><strong>Activity is captured centrally</strong><span>Device Activity tabs show endpoint history; administrators can search the tenant-wide Activity audit.</span></div></section>
      </div>
    </>
  )
}

function DeviceMetric({ icon: Icon, label, value, suffix = '%', tone }) {
  const reported = value !== null && value !== undefined && Number.isFinite(Number(value))
  return <div className={`rmm-device-metric ${reported ? tone : 'neutral'}`}><span><Icon size={17} /></span><div><small>{label}</small><strong>{reported ? `${value}${suffix}` : 'Not reported'}</strong></div><div className="rmm-device-meter"><span style={{ width: reported ? `${Math.min(100, Number(value))}%` : '0%' }} /></div></div>
}

function DeviceProperty({ label, value, detail }) {
  return <div><span>{label}</span><strong>{value || 'Not reported'}</strong>{detail && <small>{detail}</small>}</div>
}

function DeviceOverview({ device, deviceAlerts, monitoringResolution, relatedTickets, navigate, onCreateIncident }) {
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

        <section className="rmm-card rmm-device-monitoring-card">
          <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Monitoring</span><h2>Effective policy</h2></div><StatusPill>{monitoringResolution?.override ? 'Override' : 'Inherited'}</StatusPill></div>
          <p>Resolved through estate, site, group and device precedence.</p>
          <div className="rmm-device-monitoring-effective"><span><SlidersHorizontal size={16} /></span><div><strong>{monitoringResolution?.policy?.name || 'No monitoring policy assigned'}</strong><small>{monitoringResolution?.policy ? `${monitoringResolution.checks?.length || 0} checks · ${monitoringResolution.policy.evaluation || 'Evaluation not set'}` : 'Assign a tenant policy from Monitoring policies'}</small></div></div>
          <button onClick={() => navigate('policies')} type="button"><GitBranch size={14} /> View policy inheritance</button>
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
  const deviceOnline = deviceIsOnline(device)
  const [search, setSearch] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [removedKeys, setRemovedKeys] = useState([])
  const [resultByKey, setResultByKey] = useState({})
  const [visibleLimit, setVisibleLimit] = useState(120)
  const apiBase = window.__HI5_API_BASE__ || deploymentConfig().apiUrl

  function softwareKey(app) {
    return `${app.scope || 'unknown'}:${app.registryKey || app.name}:${app.version || ''}`
  }

  function protectedSoftware(app) {
    const value = `${app.name || ''} ${app.publisher || ''}`.toLowerCase()
    return [
      'hi5central', 'chatpass', 'microsoft defender', 'windows defender', 'crowdstrike', 'sentinelone',
      'sophos', 'bitdefender', 'eset', 'malwarebytes', 'webroot', 'cylance', 'carbon black',
      'symantec endpoint', 'trend micro', 'mcafee', 'trellix', 'forticlient', 'huntress',
      'cisco secure', 'cisco amp', 'cortex xdr', 'palo alto cortex', 'avast', 'avg antivirus',
      'kaspersky', 'f-secure', 'withsecure',
    ].some((term) => value.includes(term))
  }

  function uninstallMessage(result) {
    const reason = result?.reason || ''
    if (result?.status === 'uninstalled') return result?.reboot_required ? 'Uninstalled successfully · restart required' : 'Uninstalled successfully'
    if (reason === 'protected_security_or_agent') return result?.detail || 'Protected Agent or security software cannot be removed here.'
    if (reason === 'password_or_vendor_protection_required') return 'The vendor requires a password, tamper-protection change or another authorised removal method.'
    if (reason === 'no_safe_silent_uninstaller_found') return 'No safe silent uninstall method was found for this application.'
    if (reason === 'user_context_or_silent_uninstall_failed') return 'The application is installed for a user profile and could not be removed silently from the available user/system context.'
    if (reason === 'silent_uninstall_failed') return 'Silent uninstall methods were attempted but the application is still installed.'
    return result?.error || 'The uninstall could not be completed.'
  }

  async function waitForAction(jobId) {
    for (let attempt = 0; attempt < 450; attempt += 1) {
      const response = await fetch(`${apiBase}/api/v1/rmm/device-actions/${encodeURIComponent(jobId)}`, { credentials: 'include' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to read uninstall status.')
      if (['completed', 'failed', 'cancelled'].includes(payload.job?.status)) return payload.job
      await new Promise((resolve) => window.setTimeout(resolve, 500))
    }
    throw new Error('The uninstall is still running. Check Jobs for its final result.')
  }

  async function uninstallSoftware(app) {
    if (!deviceOnline || !device.agentDeviceId || busyKey || protectedSoftware(app)) return
    const key = softwareKey(app)
    if (!window.confirm(`Uninstall ${app.name} silently from ${device.name}? Hi5Central will try the vendor command first, verify removal, then try recognised silent fallbacks if needed.`)) return
    setBusyKey(key)
    setResultByKey((current) => ({ ...current, [key]: { tone: 'running', message: 'Preparing silent uninstall…' } }))
    try {
      const response = await fetch(`${apiBase}/api/v1/rmm/devices/${encodeURIComponent(device.agentDeviceId)}/actions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'software.uninstall',
          payload: { name: app.name, registry_key: app.registryKey, scope: app.scope, user_profile: app.userProfile },
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to queue the uninstall.')
      setResultByKey((current) => ({ ...current, [key]: { tone: 'running', message: 'Uninstall running in the background…' } }))
      const job = await waitForAction(payload.job?.id)
      const result = job?.result || {}
      const success = job?.status === 'completed' && result?.status === 'uninstalled'
      setResultByKey((current) => ({ ...current, [key]: { tone: success ? 'healthy' : 'critical', message: uninstallMessage(result), result } }))
      if (success) setRemovedKeys((current) => [...current, key])
    } catch (error) {
      setResultByKey((current) => ({ ...current, [key]: { tone: 'critical', message: error?.message || 'Uninstall failed.' } }))
    } finally {
      setBusyKey('')
    }
  }

  const normalized = search.trim().toLowerCase()
  const visibleSoftware = (device.installedSoftware || []).filter((app) => {
    const key = softwareKey(app)
    if (removedKeys.includes(key)) return false
    return !normalized || [app.name, app.version, app.publisher, app.installLocation].join(' ').toLowerCase().includes(normalized)
  })
  const renderedSoftware = visibleSoftware.slice(0, visibleLimit)

  return (
    <section className="rmm-table-card">
      <div className="rmm-device-section-heading">
        <div><span className="rmm-eyebrow">Inventory</span><h2>Installed software</h2><p>{visibleSoftware.length} applications are reported by the latest real device inventory.</p></div>
        <label className="rmm-device-inline-search"><Search size={15} /><input value={search} onChange={(event) => { setSearch(event.target.value); setVisibleLimit(120) }} placeholder="Search installed software…" /></label>
      </div>
      <div className="rmm-table rmm-device-software-table">
        <div className="rmm-table-head"><span>Application</span><span>Version</span><span>Publisher</span><span>Installed</span><span>Removal</span></div>
        {renderedSoftware.map((app) => {
          const key = softwareKey(app)
          const protectedApp = protectedSoftware(app)
          const status = resultByKey[key]
          return <div className="rmm-table-row" key={key}>
            <span className="rmm-device-cell"><span className="rmm-device-icon neutral"><Package size={16} /></span><span><strong>{app.name}</strong><small>{app.installLocation || app.scope || 'Observed software'}</small>{status && <small className={`rmm-software-action-state ${status.tone}`}>{status.message}</small>}</span></span>
            <span><strong>{app.version || 'Not reported'}</strong></span>
            <span><strong>{app.publisher || 'Not reported'}</strong></span>
            <span><strong>{app.installed || 'Not reported'}</strong></span>
            <span>{protectedApp ? <StatusPill tone="neutral">Protected</StatusPill> : !device.agentDeviceId ? <StatusPill tone="neutral">Agent required</StatusPill> : !deviceOnline ? <button className="rmm-software-uninstall" disabled title="Device is offline" type="button"><WifiOff size={13} /> Offline</button> : <button className="rmm-software-uninstall" disabled={busyKey === key} onClick={() => uninstallSoftware(app)} type="button"><Trash2 size={13} /> {busyKey === key ? 'Uninstalling…' : 'Uninstall'}</button>}</span>
          </div>
        })}
      </div>
      {visibleSoftware.length > renderedSoftware.length && <div className="rmm-software-load-more"><button type="button" onClick={() => setVisibleLimit((current) => current + 120)}>Show 120 more <span>{renderedSoftware.length} of {visibleSoftware.length}</span></button></div>}
      {!visibleSoftware.length && <div className="rmm-empty"><Package size={24} /><strong>{search ? 'No software matches this search' : 'No software inventory'}</strong><span>{search ? 'Try another application, version or publisher.' : 'This device does not report installed application inventory.'}</span></div>}
    </section>
  )
}

function DevicePatching({ device }) {
  const updates = device.patches || []
  const lastScan = device.inventory?.windows_updates?.last_scan_utc
  return (
    <>
      <div className="rmm-device-patch-summary">
        <div><span><ShieldCheck size={18} /></span><div><strong>{device.pendingPatches == null ? 'Not reported' : device.pendingPatches}</strong><small>Pending updates</small></div></div>
        <div><span><Download size={18} /></span><div><strong>{updates.filter((patch) => patch.downloaded).length}</strong><small>Downloaded</small></div></div>
        <div><span><Clock3 size={18} /></span><div><strong>{lastScan ? new Date(lastScan).toLocaleString() : 'Not reported'}</strong><small>Last Windows Update scan</small></div></div>
      </div>
      <section className="rmm-table-card">
        <div className="rmm-device-section-heading"><div><span className="rmm-eyebrow">Live inventory</span><h2>Pending Windows updates</h2><p>Reported directly by the Windows Update Agent on this endpoint.</p></div></div>
        <div className="rmm-table rmm-device-patch-table">
          <div className="rmm-table-head"><span>Update</span><span>Categories</span><span>Severity</span><span>Downloaded</span><span>Mandatory</span><span>Reboot</span></div>
          {updates.map((patch, index) => <div className="rmm-table-row" key={(patch.kb || []).join('-') || patch.title || index}><span><strong>{patch.title || 'Windows update'}</strong><small>{(patch.kb || []).map((kb) => 'KB' + kb).join(', ') || 'No KB reference'}</small></span><span><strong>{(patch.categories || []).join(', ') || 'Not classified'}</strong></span><span><StatusPill tone={healthClass(patch.severity)}>{patch.severity || 'Not rated'}</StatusPill></span><span><strong>{patch.downloaded ? 'Yes' : 'No'}</strong></span><span><strong>{patch.mandatory ? 'Yes' : 'No'}</strong></span><span><strong>{patch.reboot_required ? 'Required' : 'No'}</strong></span></div>)}
        </div>
        {!updates.length && <div className="rmm-empty"><ShieldCheck size={24} /><strong>{device.pendingPatches === 0 ? 'No pending updates' : 'No update inventory reported'}</strong><span>{device.pendingPatches === 0 ? 'Windows Update currently reports this device as clear.' : 'Run or wait for an Agent inventory scan to populate this view.'}</span></div>}
      </section>
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

function DeviceItsm({ relatedTickets, onCreateIncident }) {
  return (
    <div className="rmm-device-itsm-layout">
      <section className="rmm-card rmm-itsm-bridge-intro"><span className="rmm-itsm-logo"><Database size={24} /></span><span className="rmm-eyebrow">Native product bridge</span><h2>RMM device ↔ ITSM service context</h2><p>Keep Hi5Central RMM and Hi5Central ITSM as separate products while sharing device identity, requester context and operational history when both modules are licensed.</p><div><span><CheckCircle2 size={15} /> Create an ITSM incident directly from a device or alert</span><span><CheckCircle2 size={15} /> Carry hostname, device ID and alert metadata into the incident</span><span><CheckCircle2 size={15} /> Open related ITSM records without putting ITSM navigation inside RMM</span><span><CheckCircle2 size={15} /> Open the originating RMM device again from the ITSM record</span></div><button className="rmm-primary" onClick={() => onCreateIncident()} type="button"><AlertTriangle size={15} /> Create incident for this device</button></section>
      <section className="rmm-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">Related records</span><h2>ITSM history</h2></div></div><div className="rmm-device-itsm-records">{relatedTickets.length ? relatedTickets.map((ticket) => <a href={itsmRecordHref(ticket)} key={ticket.id} target="_blank" rel="noreferrer"><span className={`rmm-itsm-record-type ${String(ticket.type).toLowerCase().replace(/\s+/g, '-')}`}>{ticket.type}</span><span><strong>{ticket.id} · {ticket.title}</strong><small>{ticket.status} · {ticket.team || 'Unassigned group'} · Updated {ticket.updated}</small></span><ExternalLink size={15} /></a>) : <div className="rmm-empty"><Database size={24} /><strong>No ITSM history for this device yet</strong><span>Create an incident to link support history to this device.</span></div>}</div></section>
    </div>
  )
}

function RmmDeviceDetail({ canBackstageRemote = false, canRemote = false, device, onBack, navigate, onCreateIncident, tickets = [] }) {
  const [section, setSection] = useState('overview')
  const hasLiveAgent = Boolean(device.agentDeviceId)
  const deviceOnline = deviceIsOnline(device)
  const deviceOffline = hasLiveAgent && !deviceOnline
  const [tool, setTool] = useState('')
  const [toolsOpen, setToolsOpen] = useState(false)
  const [remoteState, setRemoteState] = useState('')
  const [remoteBusy, setRemoteBusy] = useState(false)
  const monitoringResolution = resolveDeviceMonitoringPolicy(device)
  const deviceAlerts = rmmAlerts.filter((alert) => alert.deviceId === device.id)
  const relatedTickets = tickets.filter((ticket) => (
    ticket.rmmDeviceId === device.id
    || ticket.rmmDeviceName === device.name
    || (ticket.linkedAssets || []).includes(device.id)
    || (ticket.linkedAssets || []).includes(device.name)
    || (device.relatedRecordIds || []).includes(ticket.id)
    || (device.user && ticket.requester === device.user)
  ))
  const apiBase = window.__HI5_API_BASE__ || deploymentConfig().apiUrl

  useEffect(() => {
    prefetchDeviceHistory(device).catch(() => {})
  }, [device.agentDeviceId])

  const sections = [
    ['overview', 'Overview', CircleGauge],
    ['hardware', 'Hardware', Cpu],
    ['software', 'Software', Package],
    ['patching', 'Patching', ShieldCheck],
    ['security', 'Security', ShieldCheck],
    ['activity', 'Activity', History],
    ['jobs', 'Jobs', ListChecks],
    ['itsm', 'ITSM', Database],
  ]

  function createIncident(alert) {
    onCreateIncident?.({ device, alert })
  }

  async function startRemote(mode = 'console') {
    if (!hasLiveAgent) {
      setRemoteState('Remote tools require the Hi5Central Agent on this device.')
      return
    }
    if (!deviceOnline) {
      setRemoteState('This device is offline. Live remote sessions cannot be started.')
      return
    }
    if (mode === 'backstage' && !canBackstageRemote) {
      setRemoteState('Your role does not include Background remote access.')
      return
    }
    if (mode === 'console' && !canRemote) {
      setRemoteState('Your role does not include unattended remote access.')
      return
    }
    setRemoteBusy(true)
    setRemoteState(mode === 'backstage' ? 'Starting Background session…' : 'Starting remote desktop…')
    try {
      const response = await fetch(apiBase + '/api/v1/rmm/remote-sessions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentDeviceId: device.agentDeviceId, mode }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to start remote session.')
      const launchUrl = payload.browserUrl || payload.nativeUrl
      if (!launchUrl) throw new Error('The remote session was created but no viewer launch URL was returned.')
      setRemoteState(mode === 'backstage' ? 'Background session ready.' : 'Remote session ready.')
      if (payload.browserUrl) window.open(payload.browserUrl, '_blank', 'noopener,noreferrer')
      else window.location.href = payload.nativeUrl
    } catch (error) {
      setRemoteState(error?.message || 'Unable to start remote session.')
    } finally {
      setRemoteBusy(false)
    }
  }

  function openTool(nextTool) {
    setToolsOpen(false)
    if (!hasLiveAgent) {
      setRemoteState('Live device tools require the Hi5Central Agent.')
      return
    }
    if (!deviceOnline) {
      setRemoteState('This device is offline. Live device tools are unavailable until the Agent reconnects.')
      return
    }
    setTool(nextTool)
  }

  let content
  if (section === 'hardware') content = <DeviceHardware device={device} />
  else if (section === 'software') content = <DeviceSoftware device={device} />
  else if (section === 'patching') content = <DevicePatching device={device} />
  else if (section === 'security') content = <DeviceSecurity device={device} />
  else if (section === 'activity') content = <DeviceActivityTimeline device={device} />
  else if (section === 'jobs') content = <DeviceJobsPanel device={device} />
  else if (section === 'itsm') content = <DeviceItsm device={device} onCreateIncident={createIncident} relatedTickets={relatedTickets} />
  else content = <DeviceOverview device={device} deviceAlerts={deviceAlerts} monitoringResolution={monitoringResolution} navigate={navigate} onCreateIncident={createIncident} relatedTickets={relatedTickets} />

  return (
    <div className={`rmm-device-detail ${deviceOnline ? 'is-online' : deviceOffline ? 'is-offline' : 'is-agentless'}`}>
      <button className="rmm-back" onClick={onBack} type="button"><ChevronRight size={15} /> Back to devices</button>
      <header className="rmm-device-hero">
        <div className={'rmm-device-hero-icon ' + healthClass(device.health)}><DeviceIcon device={device} size={28} /></div>
        <div className="rmm-device-hero-copy">
          <span className="rmm-eyebrow">{device.id} · {device.serial}</span>
          <h1>{device.name}</h1>
          <p>{device.user} · {device.site || 'No site'} · {device.group || 'No group'}</p>
          <div><StatusPill>{device.status}</StatusPill><StatusPill>{device.health}</StatusPill><span>{device.os}</span><span>Agent {device.agent}</span></div>
          {remoteState && <small className="rmm-device-action-message">{remoteState}</small>}
        </div>
        <div className="rmm-device-actions">
          <button className="rmm-primary compact" disabled={remoteBusy || !hasLiveAgent || !canRemote || !deviceOnline} title={!hasLiveAgent ? 'Hi5Central Agent required' : !deviceOnline ? 'Device is offline' : canRemote ? 'Start unattended console remote session' : 'Your role does not include unattended remote access'} onClick={() => startRemote('console')} type="button"><Monitor size={16} /> {remoteBusy ? 'Starting…' : 'Remote desktop'}</button>
          <div className="rmm-device-tools-menu">
            <button disabled={!deviceOnline || !hasLiveAgent} title={!hasLiveAgent ? 'Hi5Central Agent required' : deviceOnline ? 'Open live device tools' : 'Device is offline'} onClick={() => setToolsOpen((value) => !value)} type="button"><TerminalSquare size={16} /> Tools <MoreHorizontal size={14} /></button>
            {toolsOpen && <div className="rmm-device-tools-popover">
              <button onClick={() => openTool('powershell')} type="button"><TerminalSquare size={15} /><span><strong>PowerShell</strong><small>Native ConPTY</small></span></button>
              <button onClick={() => openTool('cmd')} type="button"><Code2 size={15} /><span><strong>Command Prompt</strong><small>Native ConPTY</small></span></button>
              <button onClick={() => openTool('files')} type="button"><Box size={15} /><span><strong>File browser</strong><small>Upload, download and manage</small></span></button>
              <button onClick={() => openTool('processes')} type="button"><ListChecks size={15} /><span><strong>Task Manager</strong><small>End and restart processes</small></span></button>
              <button onClick={() => openTool('services')} type="button"><Server size={15} /><span><strong>Services</strong><small>State and startup type</small></span></button>
              <button onClick={() => openTool('registry')} type="button"><Database size={15} /><span><strong>Registry Editor</strong><small>Browse and edit registry</small></span></button>
              <button onClick={() => openTool('disks')} type="button"><HardDrive size={15} /><span><strong>Disk Management</strong><small>Volumes and BitLocker state</small></span></button>
              <button onClick={() => openTool('sessions')} type="button"><Users size={15} /><span><strong>Users & Sessions</strong><small>Interactive and RDP sessions</small></span></button>
              <button onClick={() => openTool('events')} type="button"><History size={15} /><span><strong>Event Logs</strong><small>Event health and diagnostics</small></span></button>
              {canBackstageRemote && <button disabled={!deviceOnline} onClick={() => { setToolsOpen(false); startRemote('backstage') }} type="button"><Monitor size={15} /><span><strong>Background Mode</strong><small>Private Hi5 maintenance desktop</small></span></button>}
            </div>}
          </div>
          <button onClick={() => createIncident()} type="button"><AlertTriangle size={16} /> ITSM incident</button>
        </div>
      </header>

      {deviceOffline && <div className="rmm-device-offline-banner"><WifiOff size={17} /><div><strong>Device offline</strong><span>Live controls are disabled and no new Agent jobs will be queued. Last-known inventory, Activity, Jobs and ITSM history remain available.</span></div><small>Last seen {device.lastSeen || 'not reported'}</small></div>}
      {!hasLiveAgent && <div className="rmm-device-offline-banner agentless"><Monitor size={17} /><div><strong>Hi5Central Agent not installed</strong><span>This device can show synchronized inventory, but live RMM controls require the Hi5Central Agent.</span></div></div>}

      <div className="rmm-device-metric-grid">
        <DeviceMetric icon={CircleGauge} label="CPU" value={device.cpu} tone={metricTone(device.cpu)} />
        <DeviceMetric icon={Activity} label="Memory" value={device.memory} tone={metricTone(device.memory)} />
        <DeviceMetric icon={HardDrive} label="Disk" value={device.disk} tone={metricTone(device.disk, 80, 92)} />
        <div className={'rmm-device-metric patch ' + (device.patchCompliance == null ? 'neutral' : device.patchCompliance < 90 ? 'warning' : 'healthy')}><span><ShieldCheck size={17} /></span><div><small>Patch compliance</small><strong>{device.patchCompliance == null ? 'Not reported' : device.patchCompliance + '%'}</strong></div><small>{device.pendingPatches == null ? 'Update state not reported' : device.pendingPatches + ' pending update' + (device.pendingPatches === 1 ? '' : 's')}</small></div>
      </div>

      <nav className="rmm-device-subnav" aria-label="Device detail sections">
        {sections.map(([id, label, Icon]) => <button className={section === id ? 'active' : ''} key={id} onClick={() => setSection(id)} type="button"><Icon size={14} />{label}{id === 'itsm' && relatedTickets.length > 0 && <b>{relatedTickets.length}</b>}</button>)}
      </nav>

      <div className="rmm-device-section">{content}</div>
      {tool && <RmmDeviceToolWorkspace device={device} initialTool={tool} onClose={() => setTool('')} />}
    </div>
  )
}

function RmmAlerts({ onCreateIncident, openDevice, query }) {
  const [severity, setSeverity] = useState('All')
  const normalized = query.trim().toLowerCase()
  const visible = rmmAlerts.filter((alert) => (severity === 'All' || alert.severity === severity) && (!normalized || [alert.title, alert.device, alert.detail, alert.policy].join(' ').toLowerCase().includes(normalized)))
  return <><PageHeading activeView="alerts" action={<button className="rmm-primary compact" type="button"><CheckCircle2 size={16} /> Acknowledge selected</button>} /><div className="rmm-list-toolbar"><div className="rmm-filter-pills">{['All', 'Critical', 'High', 'Medium'].map((value) => <button className={severity === value ? 'active' : ''} key={value} onClick={() => setSeverity(value)} type="button">{value}</button>)}</div><span>{visible.filter((alert) => alert.status === 'Open').length} open</span></div><div className="rmm-alert-list">{visible.map((alert) => <article className="rmm-card" key={alert.id}><div className={`rmm-alert-severity ${healthClass(alert.severity)}`}><AlertTriangle size={19} /></div><div className="rmm-alert-copy"><div><span className="rmm-eyebrow">{alert.id} · {alert.policy}</span><h2>{alert.title}</h2><p>{alert.detail}</p></div><button onClick={() => openDevice(rmmDevices.find((device) => device.id === alert.deviceId))} type="button"><Monitor size={14} /> {alert.device}</button></div><div className="rmm-alert-meta"><StatusPill tone={healthClass(alert.severity)}>{alert.severity}</StatusPill><span>{alert.raised}</span><button onClick={() => onCreateIncident?.({ alert, device: rmmDevices.find((device) => device.id === alert.deviceId) })} type="button">Create incident</button><button type="button">Acknowledge</button><button type="button"><MoreHorizontal size={16} /></button></div></article>)}</div></>
}

function RmmPatching({ devices = [] }) {
  const reported = devices.filter((device) => device.pendingPatches != null)
  const pending = reported.reduce((sum, device) => sum + Number(device.pendingPatches || 0), 0)
  const current = reported.filter((device) => Number(device.pendingPatches || 0) === 0).length
  const atRisk = reported.filter((device) => Number(device.pendingPatches || 0) > 0)
  return <><PageHeading activeView="patching" /><div className="rmm-request-stats"><div><strong>{reported.length}</strong><span>Devices reporting updates</span></div><div><strong>{pending}</strong><span>Pending updates</span></div><div><strong>{current}</strong><span>No pending updates</span></div><div><strong>{devices.length - reported.length}</strong><span>Not yet reported</span></div></div><section className="rmm-table-card"><div className="rmm-table rmm-software-table"><div className="rmm-table-head"><span>Device</span><span>Pending</span><span>Last seen</span><span>Source</span><span>Status</span><span /></div>{reported.map((device) => <div className="rmm-table-row" key={device.id}><span className="rmm-device-cell"><span className="rmm-device-icon neutral"><Monitor size={16} /></span><span><strong>{device.name}</strong><small>{device.user} · {device.site || 'No site'}</small></span></span><span><strong>{device.pendingPatches}</strong></span><span><strong>{device.lastSeen}</strong></span><span><strong>{device.agent}</strong></span><span><StatusPill tone={device.pendingPatches > 0 ? 'warning' : 'healthy'}>{device.pendingPatches > 0 ? 'Updates pending' : 'Current'}</StatusPill></span><span /></div>)}</div>{!reported.length && <div className="rmm-empty"><ShieldCheck size={24} /><strong>No Windows Update inventory yet</strong><span>Pending update counts will appear after the Hi5Central Agent completes an inventory scan.</span></div>}</section>{atRisk.length > 0 && <div className="rmm-scope-explainer"><AlertTriangle size={18} /><div><strong>{atRisk.length} device{atRisk.length === 1 ? '' : 's'} require patch attention</strong><span>This view is using the live Windows Update inventory reported by each device; no placeholder compliance figures are inserted.</span></div></div>}</>
}

function RmmSoftware({ devices = [] }) {
  const applications = useMemo(() => {
    const map = new Map()
    for (const device of devices) {
      for (const app of device.installedSoftware || []) {
        const key = [String(app.name || '').toLowerCase(), String(app.version || '').toLowerCase(), String(app.publisher || '').toLowerCase()].join('|')
        const current = map.get(key) || { name: app.name || 'Unnamed application', version: app.version || 'Not reported', publisher: app.publisher || 'Not reported', devices: new Set(), scopes: new Set() }
        current.devices.add(device.id)
        if (app.scope) current.scopes.add(app.scope.startsWith('user:') ? 'Per-user' : app.scope.startsWith('machine') ? 'Machine' : app.scope)
        map.set(key, current)
      }
    }
    return [...map.values()].map((app) => ({ ...app, deviceCount: app.devices.size, scopeLabel: [...app.scopes].join(', ') || 'Not reported' })).sort((a, b) => a.name.localeCompare(b.name))
  }, [devices])
  const reportingDevices = devices.filter((device) => (device.installedSoftware || []).length > 0).length
  return <><PageHeading activeView="software" /><div className="rmm-request-stats"><div><strong>{applications.length}</strong><span>Unique application versions</span></div><div><strong>{reportingDevices}</strong><span>Devices reporting software</span></div><div><strong>{devices.length - reportingDevices}</strong><span>Awaiting inventory</span></div><div><strong>{applications.reduce((sum, app) => sum + app.deviceCount, 0)}</strong><span>Observed installations</span></div></div><section className="rmm-table-card"><div className="rmm-table rmm-software-table"><div className="rmm-table-head"><span>Application</span><span>Version</span><span>Installed</span><span>Publisher</span><span>Scope</span><span /></div>{applications.map((app) => <div className="rmm-table-row" key={[app.name, app.version, app.publisher].join('|')}><span className="rmm-device-cell"><span className="rmm-device-icon neutral"><Box size={17} /></span><span><strong>{app.name}</strong><small>Observed from live device inventory</small></span></span><span><strong>{app.version}</strong></span><span><strong>{app.deviceCount}</strong><small>device{app.deviceCount === 1 ? '' : 's'}</small></span><span><strong>{app.publisher}</strong></span><span><StatusPill tone="neutral">{app.scopeLabel}</StatusPill></span><span /></div>)}</div>{!applications.length && <div className="rmm-empty"><PackageCheck size={24} /><strong>No software inventory yet</strong><span>Applications appear here after managed devices report their installed-software inventory.</span></div>}</section></>
}

function SoftwareInventoryReport({ devices = [] }) {
  const [search, setSearch] = useState('')
  const installations = useMemo(() => {
    const rows = []
    for (const device of devices) {
      for (const app of device.installedSoftware || []) {
        rows.push({
          key: [device.id, app.registryKey, app.scope, app.name, app.version].join('|'),
          name: app.name || 'Unnamed application',
          version: app.version || 'Not reported',
          publisher: app.publisher || 'Not reported',
          installed: app.installed || 'Not reported',
          scope: app.scope || 'Not reported',
          device: device.name,
          deviceId: device.id,
          user: device.user || 'Unassigned',
          site: device.site || 'Unassigned',
        })
      }
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name) || a.device.localeCompare(b.device))
  }, [devices])
  const normalized = search.trim().toLowerCase()
  const visible = installations.filter((row) => !normalized || [row.name, row.version, row.publisher, row.device, row.user, row.site, row.installed, row.scope].join(' ').toLowerCase().includes(normalized))

  function exportCsv() {
    const quote = (value) => '"' + String(value ?? '').replaceAll('"', '""') + '"'
    const lines = [
      ['Software', 'Version', 'Publisher', 'Device', 'User', 'Site', 'Install date', 'Scope'].map(quote).join(','),
      ...visible.map((row) => [row.name, row.version, row.publisher, row.device, row.user, row.site, row.installed, row.scope].map(quote).join(',')),
    ]
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'hi5central-installed-software.csv'
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <section className="rmm-card rmm-software-report-card">
    <div className="rmm-card-heading">
      <div><span className="rmm-eyebrow">Installed software report</span><h2>Every observed installation</h2><p>Current Agent inventory with device, assigned user, site, version, publisher and install date where Windows reports it.</p></div>
      <div className="rmm-software-report-actions">
        <label><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search software or device…" /></label>
        <button disabled={!visible.length} onClick={exportCsv} type="button"><Download size={14} /> Export CSV</button>
      </div>
    </div>
    <div className="rmm-software-report">
      <div className="rmm-software-report-head"><span>Software</span><span>Version</span><span>Device</span><span>Publisher</span><span>Install date</span><span>Scope</span></div>
      {visible.map((row) => <div className="rmm-software-report-row" key={row.key}>
        <span><strong>{row.name}</strong><small>{row.publisher}</small></span>
        <span data-label="Version">{row.version}</span>
        <span data-label="Device"><strong>{row.device}</strong><small>{row.user} · {row.site}</small></span>
        <span data-label="Publisher">{row.publisher}</span>
        <span data-label="Install date">{row.installed}</span>
        <span data-label="Scope">{row.scope}</span>
      </div>)}
    </div>
    {!visible.length && <div className="rmm-empty compact"><PackageCheck size={22} /><strong>{installations.length ? 'No matching software' : 'No software inventory yet'}</strong><span>{installations.length ? 'Change the search to see other installations.' : 'Managed-device software will appear here after Agent inventory is received.'}</span></div>}
  </section>
}

function RmmReports({ devices = [] }) {
  const total = devices.length
  const online = devices.filter((device) => device.status === 'Online').length
  const healthy = devices.filter((device) => device.health === 'Healthy').length
  const softwareReported = devices.filter((device) => (device.installedSoftware || []).length > 0).length
  const updatesReported = devices.filter((device) => device.pendingPatches != null).length
  const siteAssigned = devices.filter((device) => device.siteId).length
  const cards = [
    ['Online devices', total ? Math.round(online / total * 100) + '%' : '—', total ? online + ' of ' + total + ' devices currently online' : 'No managed devices', Wifi],
    ['Healthy devices', total ? Math.round(healthy / total * 100) + '%' : '—', total ? healthy + ' of ' + total + ' devices healthy' : 'No managed devices', CircleGauge],
    ['Software inventory', total ? Math.round(softwareReported / total * 100) + '%' : '—', softwareReported + ' devices reporting applications', PackageCheck],
    ['Update inventory', total ? Math.round(updatesReported / total * 100) + '%' : '—', updatesReported + ' devices reporting Windows Update state', ShieldCheck],
  ]
  return <><PageHeading activeView="reports" /><div className="rmm-report-metrics">{cards.map(([title, value, detail, Icon]) => <article className="rmm-card" key={title}><Icon size={20} /><span>{title}</span><strong>{value}</strong><small>{detail}</small></article>)}</div><div className="rmm-dashboard-grid"><section className="rmm-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">Inventory coverage</span><h2>Device reporting</h2></div></div><div className="rmm-report-list"><span><strong>Managed devices</strong><b>{total}</b></span><span><strong>Online now</strong><b>{online}</b></span><span><strong>Software inventory reported</strong><b>{softwareReported}</b></span><span><strong>Windows Update inventory reported</strong><b>{updatesReported}</b></span></div></section><section className="rmm-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">Organisation scope</span><h2>Site assignment</h2></div></div><div className="rmm-report-list"><span><strong>Assigned to an organisation site</strong><b>{siteAssigned}</b></span><span><strong>Unassigned</strong><b>{Math.max(0, total - siteAssigned)}</b></span><span><strong>Agent-backed</strong><b>{devices.filter((device) => device.agentDeviceId).length}</b></span><span><strong>Encrypted / protected</strong><b>{devices.filter((device) => device.security?.encryptionState === 'Protected').length}</b></span></div></section></div><SoftwareInventoryReport devices={devices} /><div className="rmm-scope-explainer"><BarChart3 size={18} /><div><strong>Reports now use current device inventory only</strong><span>Historical trend charts will appear when time-series reporting data exists; fabricated percentages and example alert counts are no longer used here.</span></div></div></>
}

function RmmSettings({ navigate }) {
  const settings = [
    { icon: Download, title: 'Agent deployment', detail: 'Installer packages, enrollment tokens and stable/preview channels.', target: 'agent-deployment' },
    { icon: MapPin, title: 'Sites & device groups', detail: 'Organise endpoints by location, department, role or dynamic rule.', target: 'sites' },
    { icon: SlidersHorizontal, title: 'Monitoring policies & inheritance', detail: 'Set estate defaults, target Sites or Groups and audit per-device overrides.', target: 'policies' },
    { icon: ShieldCheck, title: 'Maintenance windows', detail: 'Control when patching, restarts and automated remediation may run.' },
    { icon: KeyRound, title: 'Credentials & secrets', detail: 'Secure credentials used by remote actions, scripts and integrations.' },
    { icon: Bell, title: 'Alerting & notifications', detail: 'Thresholds, escalation targets and integrations for monitoring events.' },
    { icon: Network, title: 'Network discovery', detail: 'Discovery ranges, SNMP credentials and monitored network devices.' },
  ]
  return <><PageHeading activeView="settings" /><div className="rmm-settings-grid">{settings.map(({ icon: Icon, title, detail, target }) => <button className="rmm-card" key={title} onClick={() => target && navigate(target)} type="button"><span><Icon size={19} /></span><div><strong>{title}</strong><small>{detail}</small></div><ChevronRight size={17} /></button>)}</div></>
}

export function RmmPlatformApp({ accent, canAudit = false, canBackstageRemote = false, canRemote = false, currentUser, dataLoading = false, devices = rmmDevices, sites = [], handleLogout, onCreateItsmIncident, onSitesChange, setTheme, tenantName, theme, tickets = [] }) {
  const initialRoute = rmmRouteFromLocation()
  const [activeView, setActiveView] = useState(initialRoute.viewId || 'dashboard')
  const [selectedDeviceId, setSelectedDeviceId] = useState(initialRoute.deviceId || '')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const [inventoryPreset, setInventoryPreset] = useState(null)
  const selectedDevice = devices.find((device) => device.id === selectedDeviceId)
  const visibleActiveView = activeView === 'activity-audit' && !canAudit ? 'dashboard' : activeView

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
    if (dataLoading && !selectedDevice && ['dashboard','devices','sites','groups','patching','software','reports'].includes(activeView)) return <RmmPageSkeleton />
    if (selectedDevice) return <RmmDeviceDetail canBackstageRemote={canBackstageRemote} canRemote={canRemote} device={selectedDevice} navigate={navigate} onBack={() => { setSelectedDeviceId(''); window.history.pushState({}, '', rmmPath(undefined, 'devices')) }} onCreateIncident={createItsmIncident} tickets={tickets} />
    if (activeView === 'devices') return <RmmDeviceInventory devices={devices} sites={sites} openDevice={openDevice} query={query} preset={inventoryPreset} onPresetApplied={() => setInventoryPreset(null)} />
    if (activeView === 'sites') return <RmmSitesManagement devices={devices} query={query} sites={sites} onSitesChange={onSitesChange} onViewDevices={openScopedInventory} />
    if (activeView === 'groups') return <RmmDeviceGroupsManagement devices={devices} query={query} sites={sites} onViewDevices={openScopedInventory} />
    if (activeView === 'alerts') return <RmmAlerts onCreateIncident={createItsmIncident} openDevice={openDevice} query={query} />
    if (activeView === 'remote') return <RmmDeviceInventory devices={devices} sites={sites} openDevice={openDevice} query={query} preset={inventoryPreset} onPresetApplied={() => setInventoryPreset(null)} />
    if (activeView === 'patching') return <RmmPatching devices={devices} />
    if (activeView === 'software') return <RmmSoftware devices={devices} />
    if (activeView === 'automation') return <RmmAutomation />
    if (activeView === 'policies') return <RmmMonitoringPolicies devices={devices} openDevice={openDevice} sites={sites} />
    if (activeView === 'reports') return <RmmReports devices={devices} />
    if (activeView === 'activity-audit') return canAudit ? <RmmAuditActivity devices={devices} /> : <RmmDashboard devices={devices} navigate={navigate} openDevice={openDevice} />
    if (activeView === 'agent-deployment') return <RmmAgentDeployment />
    if (activeView === 'settings') return <RmmSettings navigate={navigate} />
    return <RmmDashboard devices={devices} navigate={navigate} openDevice={openDevice} />
  }

  return (
    <div className="rmm-app" data-accent={accent} data-theme={theme}>
      <RmmSidebar activeView={visibleActiveView} canAudit={canAudit} mobileOpen={mobileOpen} navigate={navigate} onClose={() => setMobileOpen(false)} tenantName={tenantName} />
      <div className="rmm-shell-main">
        <RmmTopbar activeView={visibleActiveView} currentUser={currentUser} navigate={navigate} onLogout={handleLogout} onMenu={() => setMobileOpen(true)} query={query} setQuery={setQuery} setTheme={setTheme} theme={theme} />
        <main className="rmm-main-scroll"><div className="rmm-page">{renderPage()}</div></main>
      </div>
      {toast && <div className="rmm-toast"><CheckCircle2 size={16} />{toast}</div>}
    </div>
  )
}
