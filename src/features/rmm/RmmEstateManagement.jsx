import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Columns3,
  Download,
  FilterX,
  Laptop,
  Lock,
  MapPin,
  Monitor,
  Network,
  Plus,
  Save,
  Server,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
  Wifi,
  X,
} from 'lucide-react'
import { rmmDevices } from '../../data/rmmData.js'
import {
  deviceMatchesManagedGroup,
  RMM_CUSTOM_GROUPS_STORAGE_KEY,
  RMM_CUSTOM_SITES_STORAGE_KEY,
  RMM_SAVED_VIEWS_STORAGE_KEY,
  rmmDefaultSavedViews,
  rmmManagedDeviceGroups,
  rmmManagedSites,
} from '../../data/rmmScopeData.js'
import './RmmEstateManagement.css'

const DEFAULT_COLUMNS = ['device', 'user', 'siteGroup', 'health', 'resources', 'patch', 'lastSeen']
const COLUMN_OPTIONS = [
  ['device', 'Device'],
  ['user', 'User'],
  ['siteGroup', 'Site / group'],
  ['health', 'Health'],
  ['resources', 'Resources'],
  ['patch', 'Patch'],
  ['lastSeen', 'Last seen'],
]

const HEALTH_ORDER = { Critical: 5, Warning: 4, Offline: 3, Healthy: 1, Online: 1 }

function readStoredList(key) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function writeStoredList(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Demo state remains usable in-memory if storage is unavailable.
  }
}

function healthClass(value = '') {
  const normalized = String(value).toLowerCase()
  if (['critical', 'failed'].includes(normalized)) return 'critical'
  if (['warning', 'high', 'attention'].includes(normalized)) return 'warning'
  if (['offline'].includes(normalized)) return 'offline'
  if (['healthy', 'online', 'completed', 'active'].includes(normalized)) return 'healthy'
  return 'neutral'
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

function PageHeading({ eyebrow, title, description, action }) {
  return <div className="rmm-page-heading"><div><span className="rmm-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

function normalizeInventoryFilters(filters = {}) {
  return {
    quickView: filters.quickView || 'all',
    siteId: filters.siteId || 'All',
    groupId: filters.groupId || 'All',
    platform: filters.platform || 'All',
    health: filters.health || 'All',
    patchState: filters.patchState || 'All',
  }
}

function deviceMatchesQuickView(device, quickView) {
  if (quickView === 'attention') return device.health !== 'Healthy'
  if (quickView === 'online') return device.status === 'Online'
  if (quickView === 'offline') return device.status === 'Offline'
  if (quickView === 'servers') return String(device.type).toLowerCase().includes('server')
  if (quickView === 'laptops') return String(device.type).toLowerCase().includes('laptop') || String(device.type).toLowerCase().includes('macbook')
  return true
}

function deviceMatchesPatchState(device, patchState) {
  if (patchState === 'At risk') return Number(device.patchCompliance) < 90
  if (patchState === 'Compliant') return Number(device.patchCompliance) >= 90
  return true
}

function sortDevices(devices, sort) {
  const direction = sort.direction === 'desc' ? -1 : 1
  return [...devices].sort((a, b) => {
    if (sort.field === 'health') return ((HEALTH_ORDER[a.health] || 0) - (HEALTH_ORDER[b.health] || 0)) * direction
    if (sort.field === 'patch') return (Number(a.patchCompliance || 0) - Number(b.patchCompliance || 0)) * direction
    if (sort.field === 'site') return String(a.site || '').localeCompare(String(b.site || '')) * direction
    return String(a.name || '').localeCompare(String(b.name || '')) * direction
  })
}

function buildGridTemplate(columns) {
  const widths = {
    device: 'minmax(250px, 2fr)',
    user: 'minmax(180px, 1.15fr)',
    siteGroup: 'minmax(170px, 1fr)',
    health: 'minmax(120px, .72fr)',
    resources: 'minmax(180px, 1fr)',
    patch: 'minmax(125px, .72fr)',
    lastSeen: 'minmax(135px, .78fr)',
  }
  return `${columns.map((column) => widths[column]).join(' ')} 36px`
}

function renderColumnHeader(column) {
  return COLUMN_OPTIONS.find(([id]) => id === column)?.[1] || column
}

function SavedViewModal({ filters, onClose, onSave, sort, visibleColumns }) {
  const [name, setName] = useState('')
  const [visibility, setVisibility] = useState('Private')
  const valid = name.trim().length >= 2

  return (
    <div className="rmm-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="rmm-modal rmm-save-view-modal" role="dialog" aria-modal="true" aria-label="Save device view">
        <header><div><span className="rmm-eyebrow">Device inventory</span><h2>Save current view</h2><p>Store these filters, sorting and visible columns for quick reuse.</p></div><button aria-label="Close" onClick={onClose} type="button"><X size={18} /></button></header>
        <div className="rmm-modal-body">
          <label>View name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. London patch risk" /></label>
          <fieldset><legend>Visibility</legend><button className={visibility === 'Private' ? 'active' : ''} onClick={() => setVisibility('Private')} type="button"><Lock size={16} /><span><strong>Private</strong><small>Only visible to you</small></span></button><button className={visibility === 'Shared' ? 'active' : ''} onClick={() => setVisibility('Shared')} type="button"><Share2 size={16} /><span><strong>Shared</strong><small>Available to RMM technicians</small></span></button></fieldset>
          <div className="rmm-saved-view-summary"><strong>Will save</strong><span>{Object.values(filters).filter((value) => value && value !== 'All' && value !== 'all').length} active filters</span><span>{visibleColumns.length} visible columns</span><span>Sort: {sort.field} · {sort.direction}</span></div>
        </div>
        <footer><button onClick={onClose} type="button">Cancel</button><button className="rmm-primary" disabled={!valid} onClick={() => valid && onSave({ name: name.trim(), visibility })} type="button"><Save size={15} /> Save view</button></footer>
      </section>
    </div>
  )
}

function ColumnChooser({ columns, onChange, onClose }) {
  return (
    <div className="rmm-column-popover">
      <header><strong>Visible columns</strong><button aria-label="Close columns" onClick={onClose} type="button"><X size={14} /></button></header>
      {COLUMN_OPTIONS.map(([id, label]) => {
        const required = ['device', 'health'].includes(id)
        const checked = columns.includes(id)
        return <label key={id}><input checked={checked} disabled={required} onChange={() => onChange(checked ? columns.filter((column) => column !== id) : [...columns, id])} type="checkbox" /><span>{label}</span>{required && <small>Required</small>}</label>
      })}
    </div>
  )
}

export function RmmDeviceInventory({ openDevice, query, preset, onPresetApplied }) {
  const [filters, setFilters] = useState(() => normalizeInventoryFilters())
  const [sort, setSort] = useState({ field: 'name', direction: 'asc' })
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS)
  const [customViews, setCustomViews] = useState(() => readStoredList(RMM_SAVED_VIEWS_STORAGE_KEY))
  const [customSites] = useState(() => readStoredList(RMM_CUSTOM_SITES_STORAGE_KEY))
  const [customGroups] = useState(() => readStoredList(RMM_CUSTOM_GROUPS_STORAGE_KEY))
  const [activeViewId, setActiveViewId] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showColumns, setShowColumns] = useState(false)
  const normalized = query.trim().toLowerCase()

  const allViews = useMemo(() => [...rmmDefaultSavedViews, ...customViews], [customViews])
  const allSites = useMemo(() => [...rmmManagedSites, ...customSites], [customSites])
  const allGroups = useMemo(() => [...rmmManagedDeviceGroups, ...customGroups], [customGroups])

  useEffect(() => {
    if (!preset) return
    setFilters((current) => normalizeInventoryFilters({ ...current, ...preset }))
    setActiveViewId('')
    onPresetApplied?.()
  }, [preset, onPresetApplied])

  function setFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }))
    setActiveViewId('')
  }

  function applySavedView(view) {
    setFilters(normalizeInventoryFilters(view.filters))
    setSort(view.sort || { field: 'name', direction: 'asc' })
    setVisibleColumns(Array.isArray(view.columns) && view.columns.length ? view.columns : DEFAULT_COLUMNS)
    setActiveViewId(view.id)
    setShowColumns(false)
  }

  function resetView() {
    setFilters(normalizeInventoryFilters())
    setSort({ field: 'name', direction: 'asc' })
    setVisibleColumns(DEFAULT_COLUMNS)
    setActiveViewId('')
  }

  function saveCurrentView({ name, visibility }) {
    const next = {
      id: createId('VIEW'),
      name,
      visibility,
      owner: 'You',
      builtIn: false,
      description: 'Custom device inventory view.',
      filters,
      sort,
      columns: visibleColumns,
    }
    const updated = [...customViews, next]
    setCustomViews(updated)
    writeStoredList(RMM_SAVED_VIEWS_STORAGE_KEY, updated)
    setActiveViewId(next.id)
    setShowSaveModal(false)
  }

  function deleteView(viewId) {
    const updated = customViews.filter((view) => view.id !== viewId)
    setCustomViews(updated)
    writeStoredList(RMM_SAVED_VIEWS_STORAGE_KEY, updated)
    if (activeViewId === viewId) setActiveViewId('')
  }

  const visible = useMemo(() => sortDevices(rmmDevices.filter((device) => {
    const searchMatch = !normalized || [
      device.id,
      device.name,
      device.user,
      device.userEmail,
      device.os,
      device.site,
      device.group,
      device.ip,
      device.publicIp,
      device.manufacturer,
      device.model,
      device.serial,
      ...(device.tags || []),
    ].join(' ').toLowerCase().includes(normalized)
    if (!searchMatch || !deviceMatchesQuickView(device, filters.quickView)) return false
    if (filters.siteId !== 'All' && device.siteId !== filters.siteId) return false
    if (!deviceMatchesManagedGroup(device, filters.groupId)) return false
    if (filters.platform !== 'All' && device.platform !== filters.platform) return false
    if (filters.health !== 'All' && device.health !== filters.health) return false
    if (!deviceMatchesPatchState(device, filters.patchState)) return false
    return true
  }), sort), [filters, normalized, sort])

  const needsAttention = rmmDevices.filter((device) => device.health !== 'Healthy').length
  const offline = rmmDevices.filter((device) => device.status === 'Offline').length
  const patchRisk = rmmDevices.filter((device) => Number(device.patchCompliance) < 90).length
  const quickViews = [['all', 'All devices'], ['attention', 'Needs attention'], ['online', 'Online'], ['offline', 'Offline'], ['servers', 'Servers'], ['laptops', 'Laptops']]
  const activeFilters = Object.values(filters).filter((value) => value && value !== 'All' && value !== 'all').length
  const gridTemplateColumns = buildGridTemplate(visibleColumns)

  return (
    <>
      <PageHeading eyebrow="Estate" title="Devices" description="Search, scope and manage every endpoint, server and monitored network device." action={<button className="rmm-primary compact" type="button"><Download size={15} /> Deploy agent</button>} />

      <div className="rmm-device-inventory-metrics">
        <div><span><Monitor size={17} /></span><div><strong>{rmmDevices.length}</strong><small>Inventory records</small></div></div>
        <div><span className="warning"><AlertTriangle size={17} /></span><div><strong>{needsAttention}</strong><small>Need attention</small></div></div>
        <div><span className="offline"><Wifi size={17} /></span><div><strong>{offline}</strong><small>Offline</small></div></div>
        <div><span className="warning"><ShieldCheck size={17} /></span><div><strong>{patchRisk}</strong><small>Below 90% patch</small></div></div>
      </div>

      <section className="rmm-saved-views-card">
        <div className="rmm-saved-views-heading"><div><span className="rmm-eyebrow">Saved views</span><strong>Reusable estate views</strong><small>Saved views remember filters, sort order and visible columns.</small></div><button className="rmm-primary compact" onClick={() => setShowSaveModal(true)} type="button"><Plus size={14} /> Save current view</button></div>
        <div className="rmm-saved-view-strip">
          {allViews.map((view) => <div className={`rmm-saved-view-chip ${activeViewId === view.id ? 'active' : ''}`} key={view.id}><button onClick={() => applySavedView(view)} type="button"><span>{view.visibility === 'Private' ? <Lock size={13} /> : <Share2 size={13} />}</span><strong>{view.name}</strong><small>{view.description}</small></button>{!view.builtIn && <button aria-label={`Delete ${view.name}`} className="delete" onClick={() => deleteView(view.id)} type="button"><Trash2 size={13} /></button>}</div>)}
        </div>
      </section>

      <div className="rmm-list-toolbar rmm-device-toolbar rmm-device-toolbar-v2">
        <div className="rmm-filter-pills">{quickViews.map(([id, label]) => <button className={filters.quickView === id ? 'active' : ''} key={id} onClick={() => setFilter('quickView', id)} type="button">{label}</button>)}</div>
        <label>Site<select value={filters.siteId} onChange={(event) => setFilter('siteId', event.target.value)}><option value="All">All</option>{allSites.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Group<select value={filters.groupId} onChange={(event) => setFilter('groupId', event.target.value)}><option value="All">All</option>{allGroups.map((item) => <option key={item.id} value={item.id}>{item.name}{item.mode === 'Dynamic' ? ' · dynamic' : ''}</option>)}</select></label>
        <label>Platform<select value={filters.platform} onChange={(event) => setFilter('platform', event.target.value)}><option>All</option>{[...new Set(rmmDevices.map((device) => device.platform))].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Health<select value={filters.health} onChange={(event) => setFilter('health', event.target.value)}><option>All</option>{['Healthy', 'Warning', 'Critical', 'Offline'].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Patch<select value={filters.patchState} onChange={(event) => setFilter('patchState', event.target.value)}><option>All</option><option>At risk</option><option>Compliant</option></select></label>
        <label>Sort<select value={`${sort.field}:${sort.direction}`} onChange={(event) => { const [field, direction] = event.target.value.split(':'); setSort({ field, direction }); setActiveViewId('') }}><option value="name:asc">Device A–Z</option><option value="health:desc">Health priority</option><option value="patch:asc">Patch lowest first</option><option value="site:asc">Site A–Z</option></select></label>
        <div className="rmm-column-control"><button className="rmm-toolbar-button" onClick={() => setShowColumns((value) => !value)} type="button"><Columns3 size={14} /> Columns</button>{showColumns && <ColumnChooser columns={visibleColumns} onChange={(value) => { setVisibleColumns(value); setActiveViewId('') }} onClose={() => setShowColumns(false)} />}</div>
        {activeFilters > 0 && <button className="rmm-toolbar-button" onClick={resetView} type="button"><FilterX size={14} /> Reset</button>}
        <span>{visible.length} shown</span>
      </div>

      <section className="rmm-table-card rmm-inventory-table-card">
        <div className="rmm-table rmm-device-table inventory rmm-device-table-v2">
          <div className="rmm-table-head" style={{ gridTemplateColumns }}>{visibleColumns.map((column) => <span key={column}>{renderColumnHeader(column)}</span>)}<span /></div>
          {visible.map((device) => <button className="rmm-table-row" key={device.id} onClick={() => openDevice(device)} style={{ gridTemplateColumns }} type="button">
            {visibleColumns.includes('device') && <span className="rmm-device-cell"><span className={`rmm-device-icon ${healthClass(device.health)}`}><DeviceIcon device={device} /></span><span><strong>{device.name}</strong><small>{device.manufacturer} {device.model} · {device.os}</small></span></span>}
            {visibleColumns.includes('user') && <span><strong>{device.user}</strong><small>{device.userEmail || device.type}</small></span>}
            {visibleColumns.includes('siteGroup') && <span><strong>{device.site}</strong><small>{device.group}</small></span>}
            {visibleColumns.includes('health') && <span><StatusPill>{device.health}</StatusPill><small>{device.alerts} alerts</small></span>}
            {visibleColumns.includes('resources') && <span><strong>CPU {device.cpu}% · RAM {device.memory}%</strong><small>Disk {device.disk}%</small></span>}
            {visibleColumns.includes('patch') && <span><strong>{device.patchCompliance}%</strong><small>{device.pendingPatches} pending</small></span>}
            {visibleColumns.includes('lastSeen') && <span><strong>{device.lastSeen}</strong><small>Agent {device.agent}</small></span>}
            <span><ChevronRight size={16} /></span>
          </button>)}
        </div>
        {!visible.length && <div className="rmm-empty"><AlertTriangle size={24} /><strong>No devices match this view</strong><span>Change the search, scope or saved view filters.</span></div>}
      </section>
      {showSaveModal && <SavedViewModal filters={filters} onClose={() => setShowSaveModal(false)} onSave={saveCurrentView} sort={sort} visibleColumns={visibleColumns} />}
    </>
  )
}

function SiteModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', code: '', type: 'Office', location: '', timeZone: 'Europe/London', monitoringPolicy: 'Standard endpoint monitoring', patchRing: 'Production endpoints', maintenanceWindow: 'Wed 22:00–02:00' })
  const valid = form.name.trim().length >= 2 && form.code.trim().length >= 2
  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }))
  return <div className="rmm-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="rmm-modal" role="dialog" aria-modal="true"><header><div><span className="rmm-eyebrow">RMM scope</span><h2>New site</h2><p>Create a location boundary that policies and deployments can target.</p></div><button onClick={onClose} type="button"><X size={18} /></button></header><div className="rmm-modal-body rmm-form-grid"><label>Site name<input autoFocus value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Leeds Office" /></label><label>Site code<input value={form.code} onChange={(event) => update('code', event.target.value.toUpperCase())} placeholder="LDS" /></label><label>Type<select value={form.type} onChange={(event) => update('type', event.target.value)}><option>Office</option><option>Datacentre</option><option>Remote</option><option>Branch</option><option>Cloud</option></select></label><label>Location<input value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="Leeds, United Kingdom" /></label><label>Time zone<input value={form.timeZone} onChange={(event) => update('timeZone', event.target.value)} /></label><label>Monitoring policy<input value={form.monitoringPolicy} onChange={(event) => update('monitoringPolicy', event.target.value)} /></label><label>Patch ring<input value={form.patchRing} onChange={(event) => update('patchRing', event.target.value)} /></label><label>Maintenance window<input value={form.maintenanceWindow} onChange={(event) => update('maintenanceWindow', event.target.value)} /></label></div><footer><button onClick={onClose} type="button">Cancel</button><button className="rmm-primary" disabled={!valid} onClick={() => valid && onSave(form)} type="button"><Plus size={15} /> Create site</button></footer></section></div>
}

export function RmmSitesManagement({ query, onViewDevices }) {
  const [customSites, setCustomSites] = useState(() => readStoredList(RMM_CUSTOM_SITES_STORAGE_KEY))
  const [showModal, setShowModal] = useState(false)
  const normalized = query.trim().toLowerCase()
  const sites = useMemo(() => [...rmmManagedSites, ...customSites], [customSites])
  const visible = sites.filter((site) => !normalized || [site.name, site.code, site.location, site.type, site.monitoringPolicy, site.patchRing].join(' ').toLowerCase().includes(normalized))
  const totalDevices = sites.reduce((sum, site) => sum + Number(site.devices || 0), 0)
  const totalOnline = sites.reduce((sum, site) => sum + Number(site.online || 0), 0)
  const attention = sites.filter((site) => Number(site.warning || 0) > 0 || Number(site.critical || 0) > 0 || Number(site.offline || 0) > 0).length

  function addSite(form) {
    const site = { id: createId('SITE'), ...form, devices: 0, online: 0, warning: 0, critical: 0, offline: 0, networkRanges: ['Not configured'], contact: 'Not assigned', description: 'Custom tenant site.', source: 'Custom', status: 'Healthy' }
    const updated = [...customSites, site]
    setCustomSites(updated)
    writeStoredList(RMM_CUSTOM_SITES_STORAGE_KEY, updated)
    setShowModal(false)
  }

  function deleteSite(siteId) {
    const updated = customSites.filter((site) => site.id !== siteId)
    setCustomSites(updated)
    writeStoredList(RMM_CUSTOM_SITES_STORAGE_KEY, updated)
  }

  return <>
    <PageHeading eyebrow="Estate structure" title="Sites" description="Organise devices by physical, cloud or remote location and assign default management scope." action={<button className="rmm-primary compact" onClick={() => setShowModal(true)} type="button"><Plus size={15} /> New site</button>} />
    <div className="rmm-scope-metrics"><div><span><Building2 size={17} /></span><div><strong>{sites.length}</strong><small>Managed sites</small></div></div><div><span><Monitor size={17} /></span><div><strong>{totalDevices}</strong><small>Scoped devices</small></div></div><div><span><Wifi size={17} /></span><div><strong>{totalDevices ? Math.round(totalOnline / totalDevices * 100) : 100}%</strong><small>Reported online</small></div></div><div><span className="warning"><AlertTriangle size={17} /></span><div><strong>{attention}</strong><small>Sites need attention</small></div></div></div>
    <div className="rmm-scope-explainer"><SlidersHorizontal size={18} /><div><strong>Sites are management boundaries</strong><span>Monitoring policies, patch rings, software deployments and automation can inherit from site scope. Device-group targeting can then refine that scope further.</span></div></div>
    <div className="rmm-site-grid">{visible.map((site) => <article className="rmm-card rmm-site-card" key={site.id}><header><span className={`rmm-site-icon ${site.type === 'Datacentre' ? 'datacentre' : site.type === 'Remote' ? 'remote' : ''}`}>{site.type === 'Datacentre' ? <Server size={20} /> : site.type === 'Remote' ? <Wifi size={20} /> : <Building2 size={20} />}</span><div><span className="rmm-eyebrow">{site.code} · {site.type}</span><h2>{site.name}</h2><p><MapPin size={13} /> {site.location}</p></div><StatusPill tone={Number(site.warning || 0) || Number(site.critical || 0) ? 'warning' : 'healthy'}>{Number(site.warning || 0) || Number(site.critical || 0) ? 'Attention' : 'Healthy'}</StatusPill></header><div className="rmm-site-stats"><span><strong>{site.devices}</strong><small>Devices</small></span><span><strong>{site.online}</strong><small>Online</small></span><span><strong>{Number(site.warning || 0) + Number(site.critical || 0)}</strong><small>Health issues</small></span><span><strong>{site.offline || Math.max(0, Number(site.devices || 0) - Number(site.online || 0))}</strong><small>Offline</small></span></div><div className="rmm-scope-properties"><span><small>Monitoring</small><strong>{site.monitoringPolicy}</strong></span><span><small>Patch ring</small><strong>{site.patchRing}</strong></span><span><small>Maintenance</small><strong>{site.maintenanceWindow}</strong></span><span><small>Time zone</small><strong>{site.timeZone}</strong></span></div><div className="rmm-network-ranges">{(site.networkRanges || []).map((range) => <span key={range}><Network size={12} />{range}</span>)}</div><footer><button onClick={() => onViewDevices?.({ siteId: site.id })} type="button">View devices <ChevronRight size={14} /></button>{site.source === 'Custom' && <button className="danger-text" onClick={() => deleteSite(site.id)} type="button"><Trash2 size={14} /> Remove empty site</button>}</footer></article>)}</div>
    {!visible.length && <div className="rmm-empty"><Building2 size={24} /><strong>No sites match your search</strong><span>Try another site name, code, location or policy.</span></div>}
    {showModal && <SiteModal onClose={() => setShowModal(false)} onSave={addSite} />}
  </>
}

function GroupModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', mode: 'Static', scope: 'All sites', ruleText: 'Manually assigned membership', monitoringPolicy: 'Inherited', patchRing: 'Inherited', softwareProfile: 'Inherited', automationProfile: 'Inherited' })
  const valid = form.name.trim().length >= 2 && (form.mode === 'Static' || form.ruleText.trim().length >= 3)
  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }))
  return <div className="rmm-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="rmm-modal" role="dialog" aria-modal="true"><header><div><span className="rmm-eyebrow">RMM scope</span><h2>New device group</h2><p>Create a static or dynamic scope for policy and deployment targeting.</p></div><button onClick={onClose} type="button"><X size={18} /></button></header><div className="rmm-modal-body rmm-form-grid"><label>Group name<input autoFocus value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Windows kiosks" /></label><label>Membership<select value={form.mode} onChange={(event) => update('mode', event.target.value)}><option>Static</option><option>Dynamic</option></select></label><label>Scope<select value={form.scope} onChange={(event) => update('scope', event.target.value)}><option>All sites</option>{rmmManagedSites.map((site) => <option key={site.id}>{site.name}</option>)}</select></label><label className="wide">{form.mode === 'Dynamic' ? 'Dynamic rule' : 'Membership note'}<input value={form.ruleText} onChange={(event) => update('ruleText', event.target.value)} placeholder={form.mode === 'Dynamic' ? 'Platform = Windows AND tag contains Kiosk' : 'Manually assigned membership'} /></label><label>Monitoring policy<input value={form.monitoringPolicy} onChange={(event) => update('monitoringPolicy', event.target.value)} /></label><label>Patch ring<input value={form.patchRing} onChange={(event) => update('patchRing', event.target.value)} /></label><label>Software profile<input value={form.softwareProfile} onChange={(event) => update('softwareProfile', event.target.value)} /></label><label>Automation profile<input value={form.automationProfile} onChange={(event) => update('automationProfile', event.target.value)} /></label></div><footer><button onClick={onClose} type="button">Cancel</button><button className="rmm-primary" disabled={!valid} onClick={() => valid && onSave(form)} type="button"><Plus size={15} /> Create group</button></footer></section></div>
}

export function RmmDeviceGroupsManagement({ query, onViewDevices }) {
  const [customGroups, setCustomGroups] = useState(() => readStoredList(RMM_CUSTOM_GROUPS_STORAGE_KEY))
  const [showModal, setShowModal] = useState(false)
  const normalized = query.trim().toLowerCase()
  const groups = useMemo(() => [...rmmManagedDeviceGroups, ...customGroups], [customGroups])
  const visible = groups.filter((group) => !normalized || [group.name, group.type, group.mode, group.scope, group.ruleText, group.monitoringPolicy, group.patchRing].join(' ').toLowerCase().includes(normalized))
  const dynamicCount = groups.filter((group) => group.mode === 'Dynamic').length
  const staticCount = groups.filter((group) => group.mode !== 'Dynamic').length

  function addGroup(form) {
    const group = { id: createId('GRP'), type: form.mode === 'Dynamic' ? 'Smart group' : 'Custom', devices: 0, description: 'Custom tenant device group.', source: 'Custom', ...form }
    const updated = [...customGroups, group]
    setCustomGroups(updated)
    writeStoredList(RMM_CUSTOM_GROUPS_STORAGE_KEY, updated)
    setShowModal(false)
  }

  function deleteGroup(groupId) {
    const updated = customGroups.filter((group) => group.id !== groupId)
    setCustomGroups(updated)
    writeStoredList(RMM_CUSTOM_GROUPS_STORAGE_KEY, updated)
  }

  return <>
    <PageHeading eyebrow="Estate structure" title="Device groups" description="Build static and dynamic device scopes for policies, patching, software and automation." action={<button className="rmm-primary compact" onClick={() => setShowModal(true)} type="button"><Plus size={15} /> New group</button>} />
    <div className="rmm-scope-metrics"><div><span><Users size={17} /></span><div><strong>{groups.length}</strong><small>Total groups</small></div></div><div><span><Users size={17} /></span><div><strong>{staticCount}</strong><small>Static groups</small></div></div><div><span><SlidersHorizontal size={17} /></span><div><strong>{dynamicCount}</strong><small>Dynamic groups</small></div></div><div><span><ShieldCheck size={17} /></span><div><strong>{groups.filter((group) => group.monitoringPolicy && group.monitoringPolicy !== 'Inherited').length}</strong><small>Policy overrides</small></div></div></div>
    <div className="rmm-scope-explainer"><Users size={18} /><div><strong>Groups can cross site boundaries</strong><span>Static groups use explicit membership. Dynamic groups continuously evaluate device properties such as platform, health, patch compliance and tags.</span></div></div>
    <div className="rmm-group-list">{visible.map((group) => <article className="rmm-card rmm-group-card" key={group.id}><span className={`rmm-group-icon ${group.mode === 'Dynamic' ? 'dynamic' : ''}`}>{group.mode === 'Dynamic' ? <SlidersHorizontal size={18} /> : <Users size={18} />}</span><div className="rmm-group-main"><div><span className="rmm-eyebrow">{group.id} · {group.scope}</span><h2>{group.name}</h2><p>{group.description}</p></div><div className="rmm-group-rule"><span>{group.mode === 'Dynamic' ? 'Dynamic membership' : 'Static membership'}</span><strong>{group.ruleText}</strong></div></div><div className="rmm-group-targeting"><span><small>Devices</small><strong>{group.devices}</strong></span><span><small>Monitoring</small><strong>{group.monitoringPolicy || group.policy}</strong></span><span><small>Patch ring</small><strong>{group.patchRing}</strong></span><span><small>Software</small><strong>{group.softwareProfile}</strong></span><span><small>Automation</small><strong>{group.automationProfile}</strong></span></div><div className="rmm-group-actions"><StatusPill tone={group.mode === 'Dynamic' ? 'running' : 'neutral'}>{group.mode}</StatusPill><button onClick={() => onViewDevices?.({ groupId: group.id })} type="button">View devices <ChevronRight size={14} /></button>{group.source === 'Custom' && <button aria-label={`Delete ${group.name}`} className="danger-text icon-only" onClick={() => deleteGroup(group.id)} type="button"><Trash2 size={14} /></button>}</div></article>)}</div>
    {!visible.length && <div className="rmm-empty"><Users size={24} /><strong>No device groups match your search</strong><span>Try another name, membership rule or policy.</span></div>}
    {showModal && <GroupModal onClose={() => setShowModal(false)} onSave={addGroup} />}
  </>
}
