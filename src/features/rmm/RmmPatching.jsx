import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Clock3,
  GitBranch,
  Monitor,
  PackageCheck,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react'
import {
  approveVendorSource,
  archiveVendorSource,
  createPatchAssignment,
  createPatchPolicy,
  createSoftwareCatalogueEntry,
  createVendorSource,
  deletePatchAssignment,
  deleteSoftwareCatalogueEntry,
  deploySoftwarePatch,
  installSoftwareFromCatalogue,
  loadRmmPatching,
  loadRmmVulnerabilities,
  remediateVulnerabilityExposure,
  testVendorSource,
  updateVendorSource,
} from '../../lib/rmmPatchingApi.js'
import { loadRmmScope } from '../../lib/rmmScopeApi.js'
import './RmmPatching.css'

function StatusPill({ children, tone = 'neutral' }) {
  return <span className={`rmm-status-pill ${tone}`}>{children}</span>
}
function patchTone(status) {
  if (status === 'provider_blocked') return 'critical'
  if (status === 'update_available' || status === 'older_version_present') return 'warning'
  if (status === 'current') return 'healthy'
  if (status === 'detection_pending') return 'running'
  return 'neutral'
}

function versionAtLeast(current = '', required = '') {
  const left = String(current).match(/\d+/g)?.map(Number) || []
  const right = String(required).match(/\d+/g)?.map(Number) || []
  const size = Math.max(left.length, right.length)
  for (let index = 0; index < size; index += 1) {
    const delta = (left[index] || 0) - (right[index] || 0)
    if (delta) return delta > 0
  }
  return Boolean(left.length && right.length)
}

function patchLabel(status) {
  return ({
    update_available: 'Update available',
    provider_blocked: 'Provider blocked',
    current: 'Current',
    older_version_present: 'Target installed · older version remains',
    detection_pending: 'Detection pending',
    unmapped: 'Unmapped',
    unsupported: 'Unsupported',
  })[status] || status
}
function qualificationLabel(state) {
  return ({
    qualified: 'Qualified',
    deployment_candidate: 'Deployment candidate',
    intelligence_only: 'Intelligence only',
    blocked: 'Blocked',
  })[state] || 'Not classified'
}
function qualificationTone(state) {
  if (state === 'qualified') return 'healthy'
  if (state === 'deployment_candidate') return 'running'
  if (state === 'blocked') return 'critical'
  return 'neutral'
}

function PageHeading({ action }) {
  return (
    <div className="rmm-page-heading">
      <div>
        <span className="rmm-eyebrow">Maintenance</span>
        <h1>Patching</h1>
        <p>Software patching, Windows Update, vulnerability intelligence and patch policy targeting.</p>
      </div>
      {action}
    </div>
  )
}

function Metric({ icon: Icon, label, value, tone = '' }) {
  return <div className={tone}><span><Icon size={17} /></span><div><strong>{value}</strong><small>{label}</small></div></div>
}
function MappingModal({ application, onClose, onSave }) {
  const [form, setForm] = useState({
    canonicalName: application?.name || '',
    publisher: application?.publisher || '',
    namePattern: application?.name || '',
    publisherPattern: application?.publisher || '',
    provider: 'winget',
    packageId: '',
    targetVersion: '',
    releaseChannel: 'stable',
  })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const valid = form.canonicalName.trim().length > 1 && form.namePattern.trim().length > 1

  return <div className="rmm-patch-modal-backdrop">
    <form className="rmm-patch-modal" onSubmit={(event) => {
      event.preventDefault()
      if (valid) onSave(form)
    }}>
      <header>
        <div><span className="rmm-eyebrow">Software catalogue</span><h2>Map patchable software</h2></div>
        <button aria-label="Close" onClick={onClose} type="button"><X size={17} /></button>
      </header>
      <p>Map real inventory to a controlled patch provider. The complete catalogue remains server-side.</p>
      <div className="rmm-patch-form-grid">
        <label>Canonical application<input autoFocus value={form.canonicalName} onChange={(event) => update('canonicalName', event.target.value)} /></label>
        <label>Publisher<input value={form.publisher} onChange={(event) => update('publisher', event.target.value)} /></label>
        <label>Name contains<input value={form.namePattern} onChange={(event) => update('namePattern', event.target.value)} /></label>
        <label>Publisher contains<input value={form.publisherPattern} onChange={(event) => update('publisherPattern', event.target.value)} /></label>
        <label>Provider<select value={form.provider} onChange={(event) => update('provider', event.target.value)}><option value="winget">WinGet</option><option value="managed">Hi5Central managed</option><option value="vendor">Vendor updater</option></select></label>
        <label>Package ID<input value={form.packageId} onChange={(event) => update('packageId', event.target.value)} placeholder="e.g. Google.Chrome" /></label>
        <label>Target version<input value={form.targetVersion} onChange={(event) => update('targetVersion', event.target.value)} placeholder="Leave blank until confirmed" /></label>
        <label>Release channel<input value={form.releaseChannel} onChange={(event) => update('releaseChannel', event.target.value)} /></label>
      </div>
      <div className="rmm-patch-security-note">
        <ShieldCheck size={16} />
        <span><strong>Catalogue protection:</strong> only a per-job package manifest will ever be sent to PatchHost.</span>
      </div>
      <footer>
        <button onClick={onClose} type="button">Cancel</button>
        <button className="rmm-primary" disabled={!valid} type="submit"><PackageCheck size={15} /> Save mapping</button>
      </footer>
    </form>
  </div>
}

function VendorSourceModal({ source, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    displayName: source?.display_name || '',
    sourceType: source?.source_type || 'github_releases',
    canonicalName: source?.canonical_name || '',
    publisher: source?.publisher || '',
    repository: source?.repository || '',
    sourceUrl: source?.source_url || '',
    versionPath: source?.parser_config?.versionPath || '',
    releaseDatePath: source?.parser_config?.releaseDatePath || '',
    releaseUrlPath: source?.parser_config?.releaseUrlPath || '',
    installerUrlPath: source?.parser_config?.installerUrlPath || '',
    sha256Path: source?.parser_config?.sha256Path || '',
    productCodePath: source?.parser_config?.productCodePath || '',
    staticVersion: source?.parser_config?.staticVersion || source?.latest_version || '',
    staticInstallerUrl: source?.parser_config?.staticInstallerUrl || source?.latest_installer_url || '',
    staticSha256: source?.parser_config?.staticSha256 || source?.latest_installer_sha256 || '',
    staticReleaseUrl: source?.parser_config?.staticReleaseUrl || source?.source_url || '',
    deploymentMode: source?.deployment_mode || 'winget_preferred',
    providerPackageId: source?.provider_package_id || '',
    verificationMethod: source?.verification_config?.method || (source?.deployment_mode === 'vendor_direct' && !source?.provider_package_id ? 'uninstall_registry' : 'winget'),
    productCode: source?.verification_config?.productCode || '',
    verificationDisplayName: source?.verification_config?.displayNameContains || source?.name_pattern || source?.canonical_name || '',
    verificationPublisher: source?.verification_config?.publisherContains || source?.publisher_pattern || source?.publisher || '',
    filePath: source?.verification_config?.filePath || '',
    expectedSigner: source?.expected_signer || '',
    namePattern: source?.name_pattern || source?.canonical_name || '',
    publisherPattern: source?.publisher_pattern || source?.publisher || '',
    assetPattern: source?.asset_pattern || '',
    checksumAssetPattern: source?.checksum_asset_pattern || '',
    installerType: source?.installer_type || '',
    installArguments: source?.install_arguments || '',
    channel: source?.channel || 'stable',
    architecture: source?.architecture || 'x64',
    pollMinutes: source?.poll_minutes || 60,
  })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const direct = form.deploymentMode === 'vendor_direct'
  const winget = form.deploymentMode === 'winget_preferred'
  const github = form.sourceType === 'github_releases'
  const json = form.sourceType === 'vendor_json'
  const staticRelease = form.sourceType === 'static_release'
  const sourceReady = github
    ? form.repository.trim().length > 2
    : json
      ? form.sourceUrl.trim().startsWith('https://') && form.versionPath.trim()
      : Boolean(form.staticVersion.trim() && form.staticInstallerUrl.trim().startsWith('https://') && /^[A-Fa-f0-9]{64}$/.test(form.staticSha256.trim()))
  const directReady = !direct || (form.expectedSigner.trim()
    && (form.installerType !== 'exe' || form.installArguments.trim())
    && (github
      ? form.assetPattern.trim() && form.checksumAssetPattern.trim()
      : json
        ? form.installerUrlPath.trim() && form.sha256Path.trim()
        : form.staticInstallerUrl.trim() && form.staticSha256.trim()))
  const verificationReady = form.verificationMethod === 'winget'
    ? Boolean(form.providerPackageId.trim())
    : form.verificationMethod === 'uninstall_registry'
      ? Boolean(form.productCode.trim() || form.productCodePath.trim() || form.verificationDisplayName.trim())
      : Boolean(form.filePath.trim())
  const valid = form.displayName.trim().length > 1
    && form.canonicalName.trim().length > 1
    && sourceReady
    && (!winget || form.providerPackageId.trim())
    && directReady
    && verificationReady

  return <div className="rmm-patch-modal-backdrop">
    <form className="rmm-patch-modal vendor-source" onSubmit={(event) => {
      event.preventDefault()
      if (valid && !saving) onSave(form)
    }}>
      <header>
        <div><span className="rmm-eyebrow">Self-service vendor patching</span><h2>{source ? 'Edit vendor source' : 'Add vendor source'}</h2></div>
        <button aria-label="Close" onClick={onClose} type="button"><X size={17} /></button>
      </header>
      <p>Use GitHub Releases, a vendor JSON endpoint, or a manually entered static vendor release as authoritative patch intelligence. Sources must be tested and approved before they can affect patch targets.</p>
      <div className="rmm-patch-form-grid">
        <label>Source name<input autoFocus value={form.displayName} onChange={(event) => update('displayName', event.target.value)} placeholder="e.g. Tailscale Windows" /></label>
        <label>Source type<select value={form.sourceType} onChange={(event) => update('sourceType', event.target.value)}><option value="github_releases">GitHub Releases</option><option value="vendor_json">Vendor JSON API</option><option value="static_release">Static vendor release</option></select></label>
        {github ? <label className="wide">GitHub repository<input value={form.repository} onChange={(event) => update('repository', event.target.value)} placeholder="owner/repository or https://github.com/owner/repository" /></label> : json ? <><label className="wide">Vendor JSON URL<input value={form.sourceUrl} onChange={(event) => update('sourceUrl', event.target.value)} placeholder="https://vendor.example/api/releases" /></label><label>Version JSON path<input value={form.versionPath} onChange={(event) => update('versionPath', event.target.value)} placeholder="e.g. latest.version or releases.0.version" /></label><label>Release date path<input value={form.releaseDatePath} onChange={(event) => update('releaseDatePath', event.target.value)} placeholder="Optional" /></label><label>Release URL path<input value={form.releaseUrlPath} onChange={(event) => update('releaseUrlPath', event.target.value)} placeholder="Optional" /></label><label>Installer URL path<input value={form.installerUrlPath} onChange={(event) => update('installerUrlPath', event.target.value)} placeholder={direct ? 'Required for vendor direct' : 'Optional'} /></label><label>SHA-256 JSON path<input value={form.sha256Path} onChange={(event) => update('sha256Path', event.target.value)} placeholder={direct ? 'Required for vendor direct' : 'Optional'} /></label></> : <><label>Release version<input value={form.staticVersion} onChange={(event) => update('staticVersion', event.target.value)} placeholder="e.g. 4.91.0" /></label><label className="wide">Installer URL<input value={form.staticInstallerUrl} onChange={(event) => update('staticInstallerUrl', event.target.value)} placeholder="https://vendor.example/releases/app.exe" /></label><label className="wide">SHA-256<input value={form.staticSha256} onChange={(event) => update('staticSha256', event.target.value)} placeholder="64-character SHA-256" /></label><label className="wide">Vendor release page<input value={form.staticReleaseUrl} onChange={(event) => update('staticReleaseUrl', event.target.value)} placeholder="Optional HTTPS evidence page" /></label></>}
        <label>Application<input value={form.canonicalName} onChange={(event) => update('canonicalName', event.target.value)} /></label>
        <label>Publisher<input value={form.publisher} onChange={(event) => update('publisher', event.target.value)} /></label>
        <label>Deployment mode<select value={form.deploymentMode} onChange={(event) => update('deploymentMode', event.target.value)}><option value="winget_preferred">WinGet preferred</option><option value="vendor_direct">Vendor direct</option><option value="intelligence_only">Intelligence only</option></select></label>
        <label>WinGet package ID<input value={form.providerPackageId} onChange={(event) => update('providerPackageId', event.target.value)} placeholder="Required for WinGet preferred / optional fallback" /></label>
        <label>Post-install verification<select value={form.verificationMethod} onChange={(event) => update('verificationMethod', event.target.value)}><option value="winget">WinGet package identity</option><option value="uninstall_registry">Uninstall registry / MSI identity</option><option value="file_version">Installed EXE/DLL file version</option></select></label>
        {form.verificationMethod === 'uninstall_registry' && <><label>MSI ProductCode<input value={form.productCode} onChange={(event) => update('productCode', event.target.value)} placeholder="Optional static {GUID}" /></label>{json && <label>ProductCode JSON path<input value={form.productCodePath} onChange={(event) => update('productCodePath', event.target.value)} placeholder="e.g. productCode" /></label>}<label>Verification DisplayName<input value={form.verificationDisplayName} onChange={(event) => update('verificationDisplayName', event.target.value)} placeholder="Fallback uninstall entry match" /></label><label>Verification publisher<input value={form.verificationPublisher} onChange={(event) => update('verificationPublisher', event.target.value)} placeholder="Optional publisher match" /></label></>}
        {form.verificationMethod === 'file_version' && <label className="wide">Installed EXE/DLL path<input value={form.filePath} onChange={(event) => update('filePath', event.target.value)} placeholder="%ProgramFiles%\\Vendor\\App\\app.exe" /></label>}
        <label>Name contains<input value={form.namePattern} onChange={(event) => update('namePattern', event.target.value)} placeholder={form.canonicalName || 'Inventory detection'} /></label>
        <label>Publisher contains<input value={form.publisherPattern} onChange={(event) => update('publisherPattern', event.target.value)} /></label>
        <label>Channel<input value={form.channel} onChange={(event) => update('channel', event.target.value)} /></label>
        <label>Architecture<select value={form.architecture} onChange={(event) => update('architecture', event.target.value)}><option value="x64">x64</option><option value="arm64">arm64</option><option value="x86">x86</option></select></label>
        <label>Poll interval (minutes)<input min="15" max="10080" type="number" value={form.pollMinutes} onChange={(event) => update('pollMinutes', event.target.value)} /></label>
        <label>Installer type<select value={form.installerType} onChange={(event) => update('installerType', event.target.value)}><option value="">Auto-detect</option><option value="msi">MSI</option><option value="exe">EXE</option></select></label>{direct && form.installerType === 'exe' && <label className="wide">Silent installer arguments<input value={form.installArguments} onChange={(event) => update('installArguments', event.target.value)} placeholder="e.g. install --quiet --accept-license" /><small>Explicit arguments are required for vendor-direct EXE sources; Hi5Central never guesses vendor silent switches.</small></label>}
        {direct && github && <><label>Installer asset pattern<input value={form.assetPattern} onChange={(event) => update('assetPattern', event.target.value)} placeholder="e.g. *windows*x64*.msi" /></label><label>Checksum asset pattern<input value={form.checksumAssetPattern} onChange={(event) => update('checksumAssetPattern', event.target.value)} placeholder="e.g. *sha256*" /></label></>}
        {direct && <label className="wide">Expected Authenticode signer<input value={form.expectedSigner} onChange={(event) => update('expectedSigner', event.target.value)} placeholder="Exact trusted publisher identity" /></label>}
      </div>
      <div className="rmm-patch-security-note"><ShieldCheck size={16} /><span><strong>Approval gate:</strong> saving creates a draft. JSON selectors are fixed field paths only—no executable expressions. Test validates public HTTPS, release data and trust evidence. Post-install verification is explicit and independent from installer exit codes; approval is a separate action.</span></div>
      <footer><button onClick={onClose} type="button">Cancel</button><button className="rmm-primary" disabled={!valid || saving} type="submit">{saving ? 'Saving…' : source ? 'Save & retest' : 'Create draft'}</button></footer>
    </form>
  </div>
}

function SoftwarePatchModal({ application, installs, devices, onClose, onPatch, saving }) {
  return <div className="rmm-patch-modal-backdrop">
    <div className="rmm-patch-modal">
      <header>
        <div><span className="rmm-eyebrow">Controlled deployment</span><h2>Patch {application.name}</h2></div>
        <button aria-label="Close" onClick={onClose} type="button"><X size={17} /></button>
      </header>
      <p>Select one managed endpoint. Hi5Central resolves the safest available provider at dispatch time and PatchHost verifies the installed version before reporting success.</p>
      <div className="rmm-patch-device-picker">
        {installs.map((install) => {
          const device = devices.find((item) => item.agentDeviceId === install.agentDeviceId)
          const installReady = Boolean(device?.online && device?.patchCapabilities?.softwareInstall)
          return <article key={install.inventoryId + ':' + install.key}>
            <div>
              <strong>{install.deviceName}</strong>
              <small>{install.installedVersions?.length > 1 ? install.installedVersions.join(' · ') : install.installedVersion || 'Version not reported'} → {install.targetVersion || application.catalogue?.targetVersion || 'Target pending'}</small>
              {install.registrationCount > 1 && <small>{install.behindRegistrations} of {install.registrationCount} registrations behind target</small>}
            </div>
            <div className="rmm-patch-device-state">
              {!device?.online
                ? <StatusPill tone="neutral"><WifiOff size={12} /> Offline</StatusPill>
                : device?.patchCapabilities?.softwareInstall
                  ? <StatusPill tone="healthy">PatchHost ready</StatusPill>
                  : <StatusPill tone="warning">Install capability pending</StatusPill>}
            </div>
            <button className="rmm-primary compact" disabled={saving || !installReady || !application.catalogue?.id} onClick={() => onPatch(install)} type="button">
              <PackageCheck size={14} /> Patch this device
            </button>
          </article>
        })}
      </div>
      {!installs.length && <div className="rmm-empty"><CheckCircle2 size={22} /><strong>No devices require this update</strong><span>All detected installations are already current or do not have a confirmed target.</span></div>}
      <div className="rmm-patch-security-note"><ShieldCheck size={16} /><span>Offline devices are never queued. Vendor-direct jobs require HTTPS, SHA-256 and a valid Authenticode signer before installation.</span></div>
      <footer><button onClick={onClose} type="button">Close</button></footer>
    </div>
  </div>
}

function PolicyModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    approvalMode: 'manual',
    deploymentDelayDays: 3,
    softwareEnabled: true,
    windowsEnabled: false,
    rebootPolicy: 'never',
    maxRetries: 2,
    maintenanceStart: '18:00',
    maintenanceEnd: '05:00',
  })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <div className="rmm-patch-modal-backdrop">
    <form className="rmm-patch-modal" onSubmit={(event) => {
      event.preventDefault()
      if (form.name.trim().length < 2) return
      onSave({
        ...form,
        maintenanceWindow: {
          start: form.maintenanceStart,
          end: form.maintenanceEnd,
          timezone: 'tenant',
        },
      })
    }}>
      <header>
        <div><span className="rmm-eyebrow">Reusable targeting</span><h2>New patch policy</h2></div>
        <button aria-label="Close" onClick={onClose} type="button"><X size={17} /></button>
      </header>
      <div className="rmm-patch-form-grid">
        <label className="wide">Policy name<input autoFocus value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Standard workstations" /></label>
        <label className="wide">Description<textarea rows="2" value={form.description} onChange={(event) => update('description', event.target.value)} /></label>
        <label>Approval mode<select value={form.approvalMode} onChange={(event) => update('approvalMode', event.target.value)}><option value="manual">Manual approval</option><option value="automatic">Automatic</option><option value="pilot">Pilot → production</option><option value="blocked">Blocked</option></select></label>
        <label>Deployment delay (days)<input min="0" max="365" type="number" value={form.deploymentDelayDays} onChange={(event) => update('deploymentDelayDays', event.target.value)} /></label>
        <label>Window starts<input type="time" value={form.maintenanceStart} onChange={(event) => update('maintenanceStart', event.target.value)} /></label>
        <label>Window ends<input type="time" value={form.maintenanceEnd} onChange={(event) => update('maintenanceEnd', event.target.value)} /></label>
        <label>Reboot policy<select value={form.rebootPolicy} onChange={(event) => update('rebootPolicy', event.target.value)}><option value="never">Never automatically</option><option value="maintenance_window">During maintenance window</option><option value="notify_user">Notify user</option></select></label>
        <label>Retries<input min="0" max="10" type="number" value={form.maxRetries} onChange={(event) => update('maxRetries', event.target.value)} /></label>
      </div>
      <div className="rmm-patch-checks">
        <label><input checked={form.softwareEnabled} onChange={(event) => update('softwareEnabled', event.target.checked)} type="checkbox" /><span><strong>Software patching</strong><small>Prioritised for the first execution release.</small></span></label>
        <label><input checked={form.windowsEnabled} onChange={(event) => update('windowsEnabled', event.target.checked)} type="checkbox" /><span><strong>Windows Update</strong><small>Uses the same PatchHost and policy framework.</small></span></label>
      </div>
      <footer><button onClick={onClose} type="button">Cancel</button><button className="rmm-primary" type="submit"><Plus size={15} /> Create policy</button></footer>
    </form>
  </div>
}

function AssignmentModal({ devices, groups, onClose, onSave, policy }) {
  const [scopeType, setScopeType] = useState('Estate')
  const siteOptions = useMemo(() => [...new Map(devices.filter((d) => d.site).map((d) => [d.siteId || d.site, { id: d.siteId || d.site, name: d.site }])).values()], [devices])
  const options = scopeType === 'Estate'
    ? [{ id: 'ALL', name: 'Entire estate' }]
    : scopeType === 'Site'
      ? siteOptions
      : scopeType === 'Group'
        ? groups.map((group) => ({ id: group.id, name: group.name }))
        : devices.map((device) => ({ id: device.id, name: device.name }))
  const [scopeId, setScopeId] = useState('ALL')

  function changeScopeType(nextType) {
    setScopeType(nextType)
    const nextOptions = nextType === 'Estate'
      ? [{ id: 'ALL', name: 'Entire estate' }]
      : nextType === 'Site'
        ? siteOptions
        : nextType === 'Group'
          ? groups.map((group) => ({ id: group.id, name: group.name }))
          : devices.map((device) => ({ id: device.id, name: device.name }))
    setScopeId(nextOptions[0]?.id || '')
  }

  const selected = options.find((item) => item.id === scopeId)
  return <div className="rmm-patch-modal-backdrop">
    <form className="rmm-patch-modal small" onSubmit={(event) => {
      event.preventDefault()
      if (!selected) return
      onSave({
        policyId: policy.id,
        scopeType,
        scopeId: selected.id,
        scopeName: selected.name,
      })
    }}>
      <header><div><span className="rmm-eyebrow">Patch targeting</span><h2>Assign {policy.name}</h2></div><button aria-label="Close" onClick={onClose} type="button"><X size={17} /></button></header>
      <label>Scope type<select value={scopeType} onChange={(event) => changeScopeType(event.target.value)}><option>Estate</option><option>Site</option><option>Group</option><option>Device</option></select></label>
      <label>Target<select value={scopeId} onChange={(event) => setScopeId(event.target.value)}>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="rmm-patch-security-note"><GitBranch size={16} /><span>Precedence follows Estate → Site → Group → Device.</span></div>
      <footer><button onClick={onClose} type="button">Cancel</button><button className="rmm-primary" disabled={!selected} type="submit">Assign policy</button></footer>
    </form>
  </div>
}
export function RmmPatching({ devices = [] }) {
  const [tab, setTab] = useState('software')
  const [bundle, setBundle] = useState(null)
  const [scope, setScope] = useState({ groups: [] })
  const [vulnerabilities, setVulnerabilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [remediatingExposureId, setRemediatingExposureId] = useState('')
  const [error, setError] = useState('')
  const [mappingApp, setMappingApp] = useState(null)
  const [patchApp, setPatchApp] = useState(null)
  const [catalogueInstallDeviceId, setCatalogueInstallDeviceId] = useState('')
  const [catalogueInstallId, setCatalogueInstallId] = useState('')
  const [showVendorSource, setShowVendorSource] = useState(false)
  const [editingVendorSource, setEditingVendorSource] = useState(null)
  const [showPolicy, setShowPolicy] = useState(false)
  const [assignPolicy, setAssignPolicy] = useState(null)

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const [patching, scopePayload, vulnPayload] = await Promise.all([
        loadRmmPatching(),
        loadRmmScope(),
        loadRmmVulnerabilities(75),
      ])
      setBundle(patching)
      setScope(scopePayload || { groups: [] })
      setVulnerabilities(vulnPayload.vulnerabilities || [])
    } catch (requestError) {
      setError(requestError?.message || 'Unable to load patching data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([loadRmmPatching(), loadRmmScope(), loadRmmVulnerabilities(75)])
      .then(([patching, scopePayload, vulnPayload]) => {
        if (!active) return
        setBundle(patching)
        setScope(scopePayload || { groups: [] })
        setVulnerabilities(vulnPayload.vulnerabilities || [])
      })
      .catch((requestError) => {
        if (active) setError(requestError?.message || 'Unable to load patching data.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const applications = bundle?.applications || []
  const catalogue = bundle?.catalogue || []
  const patchDevices = bundle?.devices || []
  const catalogueCandidates = bundle?.catalogueCandidates || []
  const patchObservations = bundle?.patchObservations || []
  const vendorSources = bundle?.vendorIntel?.sources || []
  const vendorLatest = bundle?.vendorIntel?.latest || []
  const tenantVendorSources = bundle?.vendorIntel?.tenantSources || []
  const policies = bundle?.policies || []
  const assignments = bundle?.assignments || []
  const deviceSoftware = bundle?.deviceSoftware || []
  const deployments = bundle?.deployments || []
  const softwareVulnerabilityExposures = bundle?.softwareVulnerabilityExposures || []
  const vulnerabilityHydration = bundle?.vulnerabilityHydration || []
  const vulnerabilityExposureRows = bundle?.vulnerabilityExposureRows || []
  const exposureSummary = bundle?.vulnerabilityExposures || {}
  const overview = bundle?.overview || {}
  const exposedApps = applications.filter((item) => item.updateAvailable > 0)
  const mappedApps = applications.filter((item) => item.catalogue)
  const windowsReported = devices.filter((device) => device.pendingPatches != null)
  const windowsPending = windowsReported.reduce((sum, device) => sum + Number(device.pendingPatches || 0), 0)
  const patchHostReady = patchDevices.filter((device) => device.patchCapabilities?.softwareDiscovery).length
  const patchHostInstallReady = patchDevices.filter((device) => device.patchCapabilities?.softwareInstall).length
  const onlineInstallDevices = patchDevices.filter((device) => device.online)
  const selectedInstallDevice = onlineInstallDevices.find((device) => device.agentDeviceId === catalogueInstallDeviceId) || null
  const selectedDeviceInstalledCatalogueIds = new Set(
    deviceSoftware
      .filter((item) => item.agentDeviceId === catalogueInstallDeviceId && item.catalogue?.id)
      .map((item) => item.catalogue.id),
  )
  const installableCatalogue = catalogue
    .filter((item) => item.installable && !selectedDeviceInstalledCatalogueIds.has(item.id))
    .sort((a, b) => String(a.canonicalName || '').localeCompare(String(b.canonicalName || '')))
  const selectedCatalogueInstall = installableCatalogue.find((item) => item.id === catalogueInstallId) || null
  const selectedInstallPatchHost = selectedInstallDevice?.patchCapabilities?.patchHostVersion
    || selectedInstallDevice?.patchCapabilities?.version
    || ''
  const selectedInstallCapabilityReady = Boolean(
    selectedInstallDevice?.patchCapabilities?.softwareInstall
    && versionAtLeast(selectedInstallPatchHost, '0.2.5'),
  )

  useEffect(() => {
    if (!catalogueInstallDeviceId && onlineInstallDevices.length) {
      setCatalogueInstallDeviceId(onlineInstallDevices[0].agentDeviceId)
    }
  }, [catalogueInstallDeviceId, onlineInstallDevices])

  useEffect(() => {
    if (catalogueInstallId && !installableCatalogue.some((item) => item.id === catalogueInstallId)) {
      setCatalogueInstallId('')
    }
  }, [catalogueInstallId, installableCatalogue])

  function patchInstallsForApplication(application) {
    const grouped = new Map()
    for (const item of deviceSoftware.filter((entry) => entry.key === application?.key)) {
      const key = item.agentDeviceId || item.inventoryId
      const existing = grouped.get(key) || {
        ...item,
        installedVersions: [],
        registrationCount: 0,
        behindRegistrations: 0,
      }
      existing.registrationCount += 1
      if (item.installedVersion && !existing.installedVersions.includes(item.installedVersion)) {
        existing.installedVersions.push(item.installedVersion)
      }
      if (item.patchStatus === 'update_available') {
        existing.behindRegistrations += 1
        if (existing.behindRegistrations === 1) {
          existing.installedVersion = item.installedVersion
          existing.targetVersion = item.targetVersion
          existing.patchStatus = item.patchStatus
        }
      }
      grouped.set(key, existing)
    }
    return [...grouped.values()].filter((item) => item.behindRegistrations > 0)
  }

  function exposureForApplication(application) {
    const installationKeys = new Set(
      deviceSoftware
        .filter((item) => item.key === application.key && item.catalogue?.id)
        .map((item) => item.inventoryId + '|' + item.catalogue.id),
    )
    const exposure = softwareVulnerabilityExposures
      .filter((item) => installationKeys.has(item.inventory_id + '|' + item.catalogue_id))
      .reduce((summary, item) => ({
        open: summary.open + Number(item.open_count || 0),
        kev: summary.kev + Number(item.kev_count || 0),
        critical: summary.critical + Number(item.critical_count || 0),
        maxCvss: Math.max(summary.maxCvss, Number(item.max_cvss || 0)),
      }), { open: 0, kev: 0, critical: 0, maxCvss: 0 })

    const hydration = vulnerabilityHydration
      .filter((item) => installationKeys.has(item.inventory_id + '|' + item.catalogue_id))
      .reduce((summary, item) => ({
        total: summary.total + 1,
        checked: summary.checked + Number(item.checked === true || item.status === 'checked'),
        pending: summary.pending + Number(item.checked !== true && item.status !== 'checked'),
      }), { total: 0, checked: 0, pending: 0 })

    return { ...exposure, ...hydration }
  }

  async function saveMapping(form) {
    setSaving(true)
    setError('')
    try {
      const result = await createSoftwareCatalogueEntry(form)
      setBundle(result.bundle)
      setMappingApp(null)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to save software mapping.')
    } finally {
      setSaving(false)
    }
  }

  async function removeMapping(application) {
    if (!application.catalogue?.id || application.catalogue.builtIn) return
    if (!window.confirm('Archive the patch mapping for ' + application.name + '?')) return
    setSaving(true)
    try {
      const result = await deleteSoftwareCatalogueEntry(application.catalogue.id)
      setBundle(result.bundle)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to archive software mapping.')
    } finally {
      setSaving(false)
    }
  }

  async function runSoftwarePatch(install) {
    if (!patchApp?.catalogue?.id || !install?.agentDeviceId) return
    setSaving(true)
    setError('')
    try {
      const result = await deploySoftwarePatch(install.agentDeviceId, patchApp.catalogue.id)
      setBundle(result.bundle)
      setPatchApp(null)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to start software patch.')
    } finally {
      setSaving(false)
    }
  }

  async function runCatalogueInstall() {
    if (!catalogueInstallDeviceId || !catalogueInstallId || !selectedInstallCapabilityReady) return
    setSaving(true)
    setError('')
    try {
      const result = await installSoftwareFromCatalogue(catalogueInstallDeviceId, catalogueInstallId)
      setBundle(result.bundle)
      setCatalogueInstallId('')
    } catch (requestError) {
      setError(requestError?.message || 'Unable to start software installation.')
    } finally {
      setSaving(false)
    }
  }

  async function saveVendorSource(form) {
    setSaving(true)
    setError('')
    try {
      const result = editingVendorSource?.id
        ? await updateVendorSource(editingVendorSource.id, form)
        : await createVendorSource(form)
      setBundle(result.bundle)
      setShowVendorSource(false)
      setEditingVendorSource(null)
      setTab('vendors')
    } catch (requestError) {
      setError(requestError?.message || 'Unable to save vendor source.')
    } finally {
      setSaving(false)
    }
  }

  async function runVendorSourceTest(source) {
    setSaving(true)
    setError('')
    try {
      const result = await testVendorSource(source.id)
      setBundle(result.bundle)
    } catch (requestError) {
      setError(requestError?.message || 'Vendor source test failed.')
    } finally {
      setSaving(false)
    }
  }

  async function runVendorSourceApproval(source) {
    setSaving(true)
    setError('')
    try {
      const result = await approveVendorSource(source.id)
      setBundle(result.bundle)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to approve vendor source.')
    } finally {
      setSaving(false)
    }
  }

  async function removeVendorSource(source) {
    if (!window.confirm('Archive vendor source ' + source.display_name + '?')) return
    setSaving(true)
    setError('')
    try {
      const result = await archiveVendorSource(source.id)
      setBundle(result.bundle)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to archive vendor source.')
    } finally {
      setSaving(false)
    }
  }

  async function remediateExposure(exposure) {
    if (!exposure?.id || remediatingExposureId) return
    setRemediatingExposureId(exposure.id)
    setError('')
    try {
      const result = await remediateVulnerabilityExposure(exposure.id)
      setBundle(result.bundle)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to start vulnerability remediation.')
    } finally {
      setRemediatingExposureId('')
    }
  }

  async function savePolicy(form) {
    setSaving(true)
    try {
      const result = await createPatchPolicy(form)
      setBundle(result.bundle)
      setShowPolicy(false)
      setTab('policies')
    } catch (requestError) {
      setError(requestError?.message || 'Unable to create patch policy.')
    } finally {
      setSaving(false)
    }
  }
  async function saveAssignment(assignment) {
    setSaving(true)
    try {
      const result = await createPatchAssignment(assignment)
      setBundle(result.bundle)
      setAssignPolicy(null)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to assign patch policy.')
    } finally {
      setSaving(false)
    }
  }

  async function removeAssignment(assignment) {
    setSaving(true)
    try {
      const result = await deletePatchAssignment(assignment.id)
      setBundle(result.bundle)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to remove patch assignment.')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <PageHeading action={<div className="rmm-patch-heading-actions"><button disabled={loading} onClick={refresh} type="button"><RefreshCw size={15} /> Refresh</button><button className="rmm-primary compact" onClick={() => setShowPolicy(true)} type="button"><Plus size={15} /> New policy</button></div>} />
    {error && <div className="rmm-patch-error"><AlertTriangle size={16} /><span>{error}</span></div>}

    <div className="rmm-patch-metrics">
      <Metric icon={PackageCheck} label="Software installations" value={loading ? '…' : overview.softwareInstallations ?? 0} />
      <Metric icon={AlertTriangle} label="Software updates available" value={loading ? '…' : overview.updateAvailable ?? 0} tone="warning" />
      <Metric icon={ShieldCheck} label="Open CVE exposures" value={loading ? '…' : exposureSummary.open ?? 0} tone={Number(exposureSummary.open || 0) > 0 ? 'critical' : ''} />
      <Metric icon={Monitor} label="Windows updates pending" value={windowsPending} />
    </div>
    <section className="rmm-patch-security-banner">
      <ShieldCheck size={20} />
      <div><strong>Server-authoritative patch intelligence</strong><span>The full software/CVE catalogue stays in Hi5Central. PatchHost receives only short-lived per-job manifests and never receives the estate-wide catalogue.</span></div>
      <StatusPill tone="healthy">Protected design</StatusPill>
    </section>

    <nav className="rmm-patch-tabs">
      {[
        ['software', 'Software', exposedApps.length],
        ['vendors', 'Vendors', vendorSources.length + tenantVendorSources.length],
        ['vulnerabilities', 'Vulnerabilities', bundle?.vulnerabilities?.kev || 0],
        ['windows', 'Windows Update', windowsPending],
        ['policies', 'Policies', policies.length],
      ].map(([id, label, count]) => <button className={tab === id ? 'active' : ''} key={id} onClick={() => setTab(id)} type="button">{label}<b>{count}</b></button>)}
    </nav>

    {tab === 'software' && <section className="rmm-patch-panel">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Software patch catalogue</span><h2>Patchability by application</h2><p>{mappedApps.length} mapped application{mappedApps.length === 1 ? '' : 's'} · {applications.length - mappedApps.length} awaiting mapping · {catalogueCandidates.length} automatically discovered package{catalogueCandidates.length === 1 ? '' : 's'} · {overview.qualifiedCatalogue || 0} qualified · {overview.candidateCatalogue || 0} deployment candidates.</p></div></div>
      <div className="rmm-catalogue-install-card">
        <div className="intro"><PackageCheck size={18} /><div><strong>Install from catalogue</strong><span>Install approved catalogue software on an online managed device. Existing installations stay in the normal Patch workflow.</span></div></div>
        <div className="controls">
          <label>Device<select value={catalogueInstallDeviceId} onChange={(event) => { setCatalogueInstallDeviceId(event.target.value); setCatalogueInstallId('') }}>
            <option value="">Select device</option>
            {onlineInstallDevices.map((device) => <option key={device.agentDeviceId} value={device.agentDeviceId}>{device.name}</option>)}
          </select></label>
          <label>Application<select value={catalogueInstallId} onChange={(event) => setCatalogueInstallId(event.target.value)} disabled={!catalogueInstallDeviceId}>
            <option value="">Select application</option>
            {installableCatalogue.map((item) => <option key={item.id} value={item.id}>{item.canonicalName} · {item.targetVersion} · {qualificationLabel(item.qualificationState)}</option>)}
          </select></label>
          <div className="install-meta">
            <span><small>Target</small><strong>{selectedCatalogueInstall?.targetVersion || '—'}</strong></span>
            <span><small>Provider</small><strong>{selectedCatalogueInstall?.executionPackageId ? 'WinGet' : selectedCatalogueInstall?.deploymentMode?.replaceAll('_', ' ') || '—'}</strong></span>
            <span><small>Qualification</small><strong>{qualificationLabel(selectedCatalogueInstall?.qualificationState)}</strong></span>
            <span><small>PatchHost</small><strong>{selectedInstallPatchHost || 'Not reported'}</strong></span>
          </div>
          <button className="rmm-primary" disabled={saving || !selectedCatalogueInstall || !selectedInstallCapabilityReady} onClick={runCatalogueInstall} type="button"><Plus size={14} /> Install</button>
        </div>
        {selectedInstallDevice && !selectedInstallCapabilityReady && <small className="capability-note">Catalogue installation requires PatchHost 0.2.5 or newer. {selectedInstallPatchHost ? 'This device currently reports ' + selectedInstallPatchHost + '.' : 'This device has not reported a compatible PatchHost version yet.'}</small>}
        {catalogueInstallDeviceId && !installableCatalogue.length && <small className="capability-note">No installable catalogue applications remain for this device.</small>}
      </div>
      <div className="rmm-patch-table software">
        <div className="head"><span>Application</span><span>Installed</span><span>Target</span><span>Patch state</span><span>Vulnerabilities</span><span>Provider</span><span /></div>
        {applications.map((application) => {
          const status = application.updateAvailable
            ? 'update_available'
            : application.providerBlocked
              ? 'provider_blocked'
              : application.olderVersionPresent
                ? 'older_version_present'
                : application.catalogue?.targetVersion
                ? 'current'
                : application.catalogue
                  ? 'detection_pending'
                  : 'unmapped'
          const exposure = exposureForApplication(application)
          return <div className="row" key={application.key}>
            <span><strong>{application.name}</strong><small>{application.publisher || 'Publisher not reported'} · {application.deviceCount} device{application.deviceCount === 1 ? '' : 's'}</small></span>
            <span className="versions"><strong title={application.versions?.map((version) => version.version).join(' · ') || ''}>{application.versions?.map((version) => version.version).join(' · ') || 'Not reported'}</strong>{application.installs > application.deviceCount && <small>{application.installs} registrations across {application.deviceCount} device{application.deviceCount === 1 ? '' : 's'}</small>}</span>
            <span><strong>{application.catalogue?.targetVersion || 'Not set'}</strong><small>{application.catalogue?.packageId || 'No package ID'}</small></span>
            <span><StatusPill tone={patchTone(status)}>{patchLabel(status)}</StatusPill>{application.updateAvailable > 0 && <small>{application.updateAvailable} install{application.updateAvailable === 1 ? '' : 's'} behind</small>}{status === 'provider_blocked' && <small>WinGet reports no applicable upgrade; retry is suppressed until detection changes.</small>}{status === 'older_version_present' && <small>{application.olderVersionPresent} older side-by-side install{application.olderVersionPresent === 1 ? '' : 's'} remain. The approved target is installed; remove older majors separately if they are no longer required.</small>}</span>
            <span>{exposure.open > 0
              ? <StatusPill tone={exposure.kev > 0 || exposure.critical > 0 ? 'critical' : 'warning'}>{exposure.open} open</StatusPill>
              : !application.catalogue
                ? <StatusPill tone="neutral">Unmapped</StatusPill>
                : exposure.checked > 0 && exposure.pending === 0
                  ? <StatusPill tone="healthy">None known</StatusPill>
                  : <StatusPill tone="running">Checking NVD</StatusPill>}
              <small>{[
                exposure.kev > 0 ? exposure.kev + ' CISA KEV' : exposure.maxCvss > 0 ? 'Max CVSS ' + exposure.maxCvss : '',
                application.catalogue && exposure.pending > 0
                  ? exposure.checked > 0
                    ? exposure.checked + ' checked · ' + exposure.pending + ' pending'
                    : 'Installed version awaiting NVD lookup'
                  : application.catalogue && exposure.checked > 0
                    ? 'NVD checked for installed version'
                    : '',
              ].filter(Boolean).join(' · ')}</small>
            </span>
            <span><strong>{application.catalogue?.provider || 'Unmapped'}</strong>{application.catalogue
              ? <><StatusPill tone={qualificationTone(application.catalogue.qualificationState)}>{qualificationLabel(application.catalogue.qualificationState)}</StatusPill><small>{application.catalogue.builtIn ? 'Hi5Central catalogue' : 'Tenant mapping'}{application.catalogue.qualificationVersion ? ' · tested ' + application.catalogue.qualificationVersion : ''}</small></>
              : <small>Needs mapping</small>}</span>
            <span className="actions">{application.catalogue ? <>
              <button disabled={saving || application.updateAvailable < 1} onClick={() => setPatchApp(application)} type="button"><PackageCheck size={14} /> Patch</button>
              {!application.catalogue.builtIn && <button aria-label={'Archive ' + application.name} disabled={saving} onClick={() => removeMapping(application)} type="button"><Trash2 size={14} /></button>}
            </> : <button disabled={saving} onClick={() => setMappingApp(application)} type="button"><Plus size={14} /> Map</button>}</span>
          </div>
        })}
      </div>
      {!applications.length && <div className="rmm-empty"><Box size={24} /><strong>{loading ? 'Loading software inventory…' : 'No software inventory'}</strong><span>Patchability appears after an Agent reports installed applications.</span></div>}
      {!!catalogueCandidates.length && <div className="rmm-patch-candidate-section">
        <div><span className="rmm-eyebrow">PatchHost discovery</span><h3>Automatically learned package mappings</h3><p>These package IDs came from WinGet matching on managed endpoints. They are catalogue candidates, not manually entered records.</p></div>
        <div className="rmm-patch-table candidates">
          <div className="head"><span>Package</span><span>Provider ID</span><span>Devices</span><span>Updates</span><span>Latest observed</span></div>
          {catalogueCandidates.map((candidate) => <div className="row" key={candidate.id}>
            <span><strong>{candidate.display_name || candidate.provider_package_id}</strong><small>{candidate.publisher || 'Publisher pending enrichment'}</small></span>
            <span><strong>{candidate.provider_package_id}</strong><small>{candidate.provider}</small></span>
            <span><strong>{candidate.devices_seen}</strong></span>
            <span><StatusPill tone={candidate.updates_seen > 0 ? 'warning' : 'healthy'}>{candidate.updates_seen}</StatusPill></span>
            <span><strong>{candidate.latest_observed_version || 'Not reported'}</strong><small>{candidate.state}</small></span>
          </div>)}
        </div>
        <small className="rmm-patch-candidate-footnote">{patchObservations.length} endpoint package observation{patchObservations.length === 1 ? '' : 's'} currently back these candidates.</small>
      </div>}
      <div className="rmm-patch-execution-gate"><Clock3 size={17} /><div><strong>Capability-gated deployment</strong><span>{patchHostReady} endpoint{patchHostReady === 1 ? '' : 's'} report PatchHost discovery · {patchHostInstallReady} report software-install capability. Offline devices and endpoints without install capability cannot receive patch jobs.</span></div></div>
      {!!deployments.length && <div className="rmm-patch-deployment-history">
        <div><span className="rmm-eyebrow">Execution history</span><h3>Recent software patch deployments</h3></div>
        <div className="rmm-patch-table deployments">
          <div className="head"><span>Application</span><span>Device</span><span>Version</span><span>Provider</span><span>Status</span></div>
          {deployments.slice(0, 20).map((deployment) => <div className="row" key={deployment.id}>
            <span><strong>{deployment.application_name}</strong><small>{new Date(deployment.created_at).toLocaleString()}</small></span>
            <span><strong>{deployment.device_name}</strong><small>{deployment.device_reference}</small></span>
            <span><strong>{deployment.installed_version || 'Unknown'} → {deployment.target_version || 'Unknown'}</strong></span>
            <span><strong>{deployment.provider || 'Pending'}</strong><small>{deployment.provider_package_id || ''}</small></span>
            <span><StatusPill tone={['succeeded'].includes(deployment.status) ? 'healthy' : ['failed', 'verification_failed'].includes(deployment.status) ? 'critical' : ['running', 'eligible'].includes(deployment.status) ? 'running' : 'neutral'}>{deployment.status.replaceAll('_', ' ')}</StatusPill></span>
          </div>)}
        </div>
      </div>}
    </section>}

    {tab === 'vendors' && <section className="rmm-patch-panel">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Vendor-first freshness</span><h2>Vendor software catalogue</h2><p>Built-in feeds provide Hi5Central-maintained intelligence. Tenant sources can use GitHub Releases, vendor JSON APIs, or manually entered vendor releases; every source must be tested and explicitly approved before it can influence patch targets.</p></div><button className="rmm-primary compact" onClick={() => { setEditingVendorSource(null); setShowVendorSource(true) }} type="button"><Plus size={14} /> Add vendor source</button></div>
      <div className="rmm-patch-tenant-vendors">
        <div className="rmm-patch-subheading"><div><span className="rmm-eyebrow">Self-service sources</span><h3>Tenant vendor sources</h3><p>Draft → Test → Approve. Editing an approved source resets it to draft so changed trust rules can never silently enter production.</p></div></div>
        <div className="rmm-patch-table tenant-vendors">
          <div className="head"><span>Source</span><span>Deployment</span><span>Latest</span><span>Trust</span><span>State</span><span /></div>
          {tenantVendorSources.map((source) => {
            const blockers = Array.isArray(source.last_test_result?.blockers) ? source.last_test_result.blockers : []
            const stateTone = source.status === 'active' ? 'healthy' : source.status === 'quarantined' ? 'critical' : source.status === 'tested' ? 'running' : 'neutral'
            const trustTone = source.trust_state === 'direct_ready' || source.trust_state === 'winget_ready' ? 'healthy' : source.trust_state === 'quarantined' ? 'critical' : 'neutral'
            const recommendation = source.verification_recommendation
            const recommendationLabel = recommendation?.recommendedVariant
              ? recommendation.recommendedVariant.replaceAll('_', ' ')
              : recommendation?.recommendedMethod?.replaceAll('_', ' ')
            const recommendationState = recommendation?.validated
              ? 'validated'
              : recommendation?.autoProbeRecommended
                ? 'probe needed'
                : recommendation?.recommendedMethod
                  ? 'awaiting endpoint'
                  : 'not available'
            return <div className="row" key={source.id}>
              <span><strong>{source.display_name}</strong><small>{source.source_type === 'github_releases' ? source.repository : source.source_url || source.parser_config?.staticReleaseUrl || 'Manual release'} · {(source.source_type || 'github_releases').replaceAll('_', ' ')} · every {source.poll_minutes} min</small></span>
              <span><strong>{(source.deployment_mode || '').replaceAll('_', ' ')}</strong><small>{source.provider_package_id || 'No WinGet fallback'} · configured {(source.verification_config?.method || 'winget').replaceAll('_', ' ')}</small>{recommendationLabel && <small><b>Recommended:</b> {recommendationLabel} · {recommendationState}</small>}</span>
              <span><strong>{source.release_version || source.latest_version || 'Not tested'}</strong><small>{source.release_date ? new Date(source.release_date).toLocaleDateString() : source.last_success_at ? 'Tested ' + new Date(source.last_success_at).toLocaleString() : 'Awaiting test'}</small></span>
              <span><StatusPill tone={trustTone}>{(source.trust_state || 'untested').replaceAll('_', ' ')}</StatusPill><small>{source.installer_sha256 ? (source.source_type === 'static_release' ? 'SHA-256 pinned from vendor release evidence' : 'SHA-256 verified from release metadata') : blockers[0] || (source.deployment_mode === 'vendor_direct' ? 'Direct-install trust incomplete' : 'Execution provider performs install verification')}</small></span>
              <span><StatusPill tone={stateTone}>{source.status}</StatusPill><small>{source.last_error || (source.approved_at ? 'Approved ' + new Date(source.approved_at).toLocaleDateString() : '')}</small></span>
              <span className="actions"><button disabled={saving} onClick={() => runVendorSourceTest(source)} type="button"><RefreshCw size={13} /> Test</button>{source.status === 'tested' && <button className="rmm-primary compact" disabled={saving} onClick={() => runVendorSourceApproval(source)} type="button"><ShieldCheck size={13} /> Approve</button>}<button disabled={saving} onClick={() => { setEditingVendorSource(source); setShowVendorSource(true) }} type="button">Edit</button><button aria-label={'Archive ' + source.display_name} disabled={saving} onClick={() => removeVendorSource(source)} type="button"><Trash2 size={13} /></button></span>
            </div>
          })}
        </div>
        {!tenantVendorSources.length && <div className="rmm-empty compact"><GitBranch size={22} /><strong>No self-service sources yet</strong><span>Add a public GitHub Releases or vendor JSON source to test vendor-first version intelligence without changing the global Hi5Central catalogue.</span></div>}
      </div>
      <div className="rmm-patch-vendor-section standalone">
        <div className="rmm-patch-vendor-grid">
          {vendorSources.map((source) => {
            const latest = vendorLatest.find((item) => item.source_key === source.source_key)
            return <article key={source.source_key}>
              <div><strong>{source.display_name}</strong><small>{source.source_type.replaceAll('_', ' ')} · every {source.poll_minutes} min</small></div>
              <span><strong>{latest?.version || source.cursor_value || 'Pending first sync'}</strong><small>{latest?.channel || ''}{latest?.release_date ? ' · ' + new Date(latest.release_date).toLocaleDateString() : ''}</small></span>
              <StatusPill tone={source.last_error ? 'warning' : source.last_success_at ? 'healthy' : 'neutral'}>{source.last_error ? 'Attention' : source.last_success_at ? 'Live' : 'Pending'}</StatusPill>
            </article>
          })}
        </div>
      </div>
      <div className="rmm-patch-table vendors">
        <div className="head"><span>Application</span><span>Package ID</span><span>Vendor latest</span><span>Published</span><span>Installer</span></div>
        {vendorLatest.map((item) => <div className="row" key={item.source_key + ':' + item.provider_package_id}>
          <span><strong>{item.canonical_name}</strong><small>{item.publisher || item.source_key}</small></span>
          <span><strong>{item.provider_package_id}</strong><small>{item.channel} · {item.architecture}</small></span>
          <span><strong>{item.version}</strong><small>{item.source_key.replaceAll('_', ' ')}</small></span>
          <span><strong>{item.release_date ? new Date(item.release_date).toLocaleDateString() : 'Not published'}</strong><small>{item.last_seen_at ? 'Seen ' + new Date(item.last_seen_at).toLocaleString() : ''}</small></span>
          <span>{item.installer_url ? <StatusPill tone="healthy">{item.installer_type ? item.installer_type.toUpperCase() : 'Vendor'}</StatusPill> : <StatusPill tone="neutral">Version feed</StatusPill>}<small>{item.installer_sha256 ? 'SHA-256 supplied' : 'Installer metadata via execution provider'}</small></span>
        </div>)}
      </div>
      {!vendorSources.length && <div className="rmm-empty"><PackageCheck size={24} /><strong>No vendor sources configured</strong><span>Vendor adapters will appear here as they are added to the Hi5Central global catalogue.</span></div>}
    </section>}

    {tab === 'vulnerabilities' && <section className="rmm-patch-panel">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Threat intelligence + remediation</span><h2>Endpoint vulnerability exposure</h2><p>Hi5Central correlates authoritative vulnerability intelligence to software actually installed on managed endpoints, then tracks whether a verified remediation is available and completed.</p></div></div>
      <div className="rmm-vuln-exposure-summary">
        <div><small>Open exposures</small><strong>{exposureSummary.open ?? 0}</strong></div>
        <div><small>Known / active exploitation</small><strong>{exposureSummary.active_exploitation_open ?? exposureSummary.kev_open ?? 0}</strong></div>
        <div><small>Fix available</small><strong>{exposureSummary.fix_available_open ?? 0}</strong></div>
        <div><small>Provider blocked</small><strong>{exposureSummary.provider_blocked_open ?? 0}</strong></div>
        <div><small>Overdue SLA</small><strong>{exposureSummary.overdue_open ?? 0}</strong></div>
        <div><small>CISA KEV exposures</small><strong>{exposureSummary.kev_open ?? 0}</strong></div>
        <div><small>Remediated</small><strong>{exposureSummary.remediated ?? 0}</strong></div>
      </div>
      <div className="rmm-vuln-source-grid">
        {(bundle?.vulnerabilities?.sources || []).map((source) => <article key={source.source}><span><CheckCircle2 size={16} /></span><div><strong>{source.source.replaceAll('_', ' ').toUpperCase()}</strong><small>{source.last_success_at ? 'Last successful sync ' + new Date(source.last_success_at).toLocaleString() : 'Awaiting first successful sync'}</small></div><StatusPill tone={source.last_error ? 'warning' : source.last_success_at ? 'healthy' : 'neutral'}>{source.last_error ? 'Attention' : source.last_success_at ? 'Live' : 'Pending'}</StatusPill></article>)}
      </div>

      <div className="rmm-vuln-table exposures">
        <div className="head"><span>CVE</span><span>Risk</span><span>CVSS</span><span>EPSS</span><span>CISA KEV</span><span>Exploitation</span><span>Published</span><span>Fix</span><span>Exposed devices</span><span>Vulnerable software</span><span>Remediation</span></div>
        {vulnerabilityExposureRows.map((item) => {
          const epss = item.epss_score == null ? null : Number(item.epss_score)
          const percentile = item.epss_percentile == null ? null : Number(item.epss_percentile)
          const exploitation = (item.ssvc_exploitation || '').toLowerCase()
          const riskCritical = item.kev || exploitation === 'active' || Number(item.cvss_score || 0) >= 9
          const providerBlocked = item.status === 'open' && item.patch_status === 'provider_blocked'
          const canRemediate = item.status === 'open' && item.remediation_state === 'available' && !providerBlocked
          const remediating = remediatingExposureId === item.id
          const remediationTone = providerBlocked
            ? 'critical'
            : item.remediation_state === 'remediated'
              ? 'healthy'
              : item.remediation_state === 'in_progress'
                ? 'running'
                : item.remediation_state === 'available'
                  ? 'warning'
                  : 'neutral'
          const remediationLabel = providerBlocked ? 'provider blocked' : (item.remediation_state || 'unavailable')
          const blockedDetail = item.patch_evidence?.providerBlockedDetail || 'The selected provider cannot currently remediate this detected installation.'
          return <div className="row" key={item.id}>
            <span><strong>{item.cve_id}</strong><small>{item.source}</small></span>
            <span><StatusPill tone={riskCritical ? 'critical' : Number(item.cvss_score || 0) >= 7 ? 'warning' : 'neutral'}>{item.severity || 'Observed'}</StatusPill><small>{item.remediation_sla_class ? item.remediation_sla_class.replaceAll('_', ' ') : ''}</small></span>
            <span><strong>{item.cvss_score ?? '—'}</strong><small>{item.cvss_version || 'Score pending'}</small></span>
            <span><strong>{epss == null ? '—' : (epss * 100).toFixed(1) + '%'}</strong><small>{percentile == null ? 'EPSS pending' : Math.round(percentile * 100) + 'th percentile'}</small></span>
            <span>{item.kev ? <StatusPill tone="critical">Yes</StatusPill> : <StatusPill tone="neutral">No</StatusPill>}<small>{item.kev_due_at ? 'Due ' + new Date(item.kev_due_at).toLocaleDateString() : item.kev_added_at ? 'Added ' + new Date(item.kev_added_at).toLocaleDateString() : ''}</small></span>
            <span>{item.kev ? <StatusPill tone="critical">Known exploited</StatusPill> : exploitation ? <StatusPill tone={exploitation === 'active' ? 'critical' : exploitation === 'poc' ? 'warning' : 'neutral'}>{exploitation === 'poc' ? 'PoC observed' : exploitation}</StatusPill> : <StatusPill tone="neutral">Not reported</StatusPill>}<small>{item.known_ransomware_use ? 'Ransomware: ' + item.known_ransomware_use : item.ssvc_automatable ? 'Automatable: ' + item.ssvc_automatable : ''}</small></span>
            <span><strong>{item.published_at ? new Date(item.published_at).toLocaleDateString() : '—'}</strong><small>{item.modified_at ? 'Updated ' + new Date(item.modified_at).toLocaleDateString() : ''}</small></span>
            <span><strong>{item.remediation_target_version || item.fixed_version || '—'}</strong><small>{item.remediation_provider ? 'via ' + item.remediation_provider : item.fixed_version ? 'Vendor fixed version' : 'No verified fix route yet'}</small></span>
            <span><strong>{item.device_name}</strong><small>{item.device_online ? 'Online' : 'Offline'}</small></span>
            <span><strong>{item.application_name}</strong><small>{item.installed_version ? 'Installed ' + item.installed_version : 'Version unavailable'}</small></span>
            <span className="rmm-vuln-remediation"><StatusPill tone={remediationTone}>{remediationLabel.replaceAll('_', ' ')}</StatusPill><small>{item.remediation_due_at ? 'SLA due ' + new Date(item.remediation_due_at).toLocaleDateString() : ''}</small>{providerBlocked ? <small className="rmm-vuln-blocked-detail">{blockedDetail}</small> : canRemediate ? <button className="rmm-vuln-remediate" disabled={!item.device_online || remediating} onClick={() => remediateExposure(item)} type="button"><Wrench size={12} /> {remediating ? 'Starting…' : item.device_online ? 'Remediate' : 'Device offline'}</button> : null}</span>
          </div>
        })}
      </div>
      {!vulnerabilityExposureRows.length && <div className="rmm-empty"><ShieldCheck size={24} /><strong>{loading ? 'Correlating endpoint exposures…' : 'No endpoint vulnerability exposures'}</strong><span>Global vulnerability feeds remain active below; endpoint rows appear only after a verified catalogue identity matches installed software and an affected version range.</span></div>}

      <div className="rmm-vuln-feed-heading"><span className="rmm-eyebrow">Global intelligence</span><h3>Recent CVE intelligence</h3><p>These records are supporting threat intelligence. They do not become endpoint exposures until a verified product identity and affected version match.</p></div>
      <div className="rmm-vuln-table feed">
        <div className="head"><span>CVE</span><span>Priority</span><span>CVSS / EPSS</span><span>Published / due</span><span>Summary</span></div>
        {vulnerabilities.map((item) => <div className="row" key={item.cve_id}>
          <span><strong>{item.cve_id}</strong><small>{item.source}</small></span>
          <span>{item.kev ? <StatusPill tone="critical">CISA KEV</StatusPill> : item.ssvc_exploitation === 'active' ? <StatusPill tone="critical">Active exploitation</StatusPill> : <StatusPill tone="neutral">{item.severity || 'Observed'}</StatusPill>}</span>
          <span><strong>{item.cvss_score ?? 'Pending'}</strong><small>{item.epss_score == null ? item.cvss_version || '' : 'EPSS ' + (Number(item.epss_score) * 100).toFixed(1) + '%'}</small></span>
          <span><strong>{item.kev_added_at || item.published_at ? new Date(item.kev_added_at || item.published_at).toLocaleDateString() : 'Not reported'}</strong><small>{item.kev_due_at ? 'CISA due ' + new Date(item.kev_due_at).toLocaleDateString() : ''}</small></span>
          <span><strong>{item.summary || 'Description pending enrichment'}</strong><small>{item.known_ransomware_use ? 'Ransomware use: ' + item.known_ransomware_use : item.required_action || ''}</small></span>
        </div>)}
      </div>
      {!vulnerabilities.length && <div className="rmm-empty"><ShieldCheck size={24} /><strong>{loading ? 'Loading vulnerability feeds…' : 'No vulnerability records yet'}</strong><span>The first central intelligence sync runs automatically after deployment.</span></div>}
    </section>}

    {tab === 'windows' && <section className="rmm-patch-panel">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Windows Update</span><h2>Endpoint update inventory</h2><p>Windows patch execution will use the same PatchHost, job history and maintenance policies as software patching.</p></div></div>
      <div className="rmm-patch-table windows">
        <div className="head"><span>Device</span><span>Pending</span><span>Last seen</span><span>Agent</span><span>Status</span></div>
        {windowsReported.map((device) => <div className="row" key={device.id}><span><strong>{device.name}</strong><small>{device.user} · {device.site || 'No site'}</small></span><span><strong>{device.pendingPatches}</strong></span><span><strong>{device.lastSeen}</strong></span><span><strong>{device.agent}</strong></span><span>{device.status === 'Offline' ? <StatusPill tone="neutral"><WifiOff size={12} /> Offline</StatusPill> : <StatusPill tone={device.pendingPatches > 0 ? 'warning' : 'healthy'}>{device.pendingPatches > 0 ? 'Updates pending' : 'Current'}</StatusPill>}</span></div>)}
      </div>
      {!windowsReported.length && <div className="rmm-empty"><Monitor size={24} /><strong>No Windows Update inventory yet</strong><span>Agent inventory will populate this view.</span></div>}
    </section>}
    {tab === 'policies' && <section className="rmm-patch-panel">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Targeting</span><h2>Patch policies</h2><p>Policies use the same Estate → Site → Group → Device targeting model as Monitoring.</p></div><button className="rmm-primary compact" onClick={() => setShowPolicy(true)} type="button"><Plus size={14} /> New policy</button></div>
      <div className="rmm-patch-policy-grid">
        {policies.map((policy) => <article key={policy.id}>
          <header><div><span className="rmm-eyebrow">{policy.approval_mode}</span><h3>{policy.name}</h3></div><StatusPill tone={policy.status === 'active' ? 'healthy' : 'neutral'}>{policy.status}</StatusPill></header>
          <p>{policy.description || 'No description provided.'}</p>
          <div className="meta"><span><small>Software</small><strong>{policy.software_enabled ? 'Enabled' : 'Disabled'}</strong></span><span><small>Windows</small><strong>{policy.windows_enabled ? 'Enabled' : 'Disabled'}</strong></span><span><small>Delay</small><strong>{policy.deployment_delay_days} days</strong></span><span><small>Reboot</small><strong>{policy.reboot_policy}</strong></span></div>
          <footer><span>{assignments.filter((assignment) => assignment.policy_id === policy.id && assignment.enabled !== false).length} assignments</span><button disabled={saving} onClick={() => setAssignPolicy(policy)} type="button"><GitBranch size={14} /> Assign scope</button></footer>
        </article>)}
      </div>
      {!policies.length && <div className="rmm-empty"><GitBranch size={24} /><strong>No patch policies yet</strong><span>Create a software-first policy, then target it to Estate, Site, Group or Device.</span></div>}
      {!!assignments.length && <div className="rmm-patch-assignments">
        <div className="head"><span>Scope</span><span>Policy</span><span>Priority</span><span /></div>
        {assignments.map((assignment) => <div className="row" key={assignment.id}><span><strong>{assignment.scope_name || assignment.scope_id}</strong><small>{assignment.scope_type}</small></span><span><strong>{policies.find((policy) => policy.id === assignment.policy_id)?.name || assignment.policy_id}</strong></span><span><strong>{assignment.priority}</strong></span><span><button disabled={saving} onClick={() => removeAssignment(assignment)} type="button"><Trash2 size={14} /></button></span></div>)}
      </div>}
    </section>}

    {mappingApp && <MappingModal application={mappingApp} onClose={() => setMappingApp(null)} onSave={saveMapping} />}
    {showVendorSource && <VendorSourceModal source={editingVendorSource} saving={saving} onClose={() => { setShowVendorSource(false); setEditingVendorSource(null) }} onSave={saveVendorSource} />}
    {patchApp && <SoftwarePatchModal
      application={patchApp}
      devices={bundle?.devices || []}
      installs={patchInstallsForApplication(patchApp)}
      onClose={() => setPatchApp(null)}
      onPatch={runSoftwarePatch}
      saving={saving}
    />}
    {showPolicy && <PolicyModal onClose={() => setShowPolicy(false)} onSave={savePolicy} />}
    {assignPolicy && <AssignmentModal devices={bundle?.devices || devices} groups={scope.groups || []} onClose={() => setAssignPolicy(null)} onSave={saveAssignment} policy={assignPolicy} />}
  </>
}
