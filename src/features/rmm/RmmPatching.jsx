import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCode2,
  GitBranch,
  Monitor,
  PackageCheck,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
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
  deploySoftwarePatches,
  installSoftwareFromCatalogue,
  loadRmmPatching,
  loadRmmVulnerabilities,
  loadSoftwareQualificationLab,
  planSoftwarePatches,
  remediateVulnerabilityExposure,
  searchWingetRepository,
  testVendorSource,
  updateVendorSource,
  updateSoftwareValidation,
  revalidateSoftwareCatalogueEntry,
  retrySoftwareQualification,
  runSoftwareQualificationAction,
} from '../../lib/rmmPatchingApi.js'
import { loadRmmScope } from '../../lib/rmmScopeApi.js'
import './RmmPatching.css'

function StatusPill({ children, tone = 'neutral' }) {
  return <span className={`rmm-status-pill ${tone}`}>{children}</span>
}

function rmmPortalThemeStyle() {
  if (typeof document === 'undefined') return {}
  const root = document.querySelector('.rmm-app')
  if (!root) return {}
  const computed = window.getComputedStyle(root)
  const names = [
    '--rmm-bg',
    '--rmm-surface',
    '--rmm-soft',
    '--rmm-soft-strong',
    '--rmm-text',
    '--rmm-muted',
    '--rmm-border',
    '--rmm-sidebar',
    '--rmm-sidebar-2',
    '--rmm-accent',
    '--rmm-accent-soft',
    '--rmm-shadow',
  ]
  return Object.fromEntries(names.map((name) => [name, computed.getPropertyValue(name).trim()]))
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
    qualified_limited: 'Qualified — limited capabilities',
    deployment_candidate: 'Deployment candidate',
    intelligence_only: 'Intelligence only',
    blocked: 'Blocked',
  })[state] || 'Not classified'
}
function qualificationTone(state) {
  if (state === 'qualified') return 'healthy'
  if (state === 'qualified_limited') return 'warning'
  if (state === 'deployment_candidate') return 'running'
  if (state === 'blocked') return 'critical'
  return 'neutral'
}
function readinessTone(state) {
  if (['ready', 'healthy', 'verified', 'passed', 'covered'].includes(state)) return 'healthy'
  if (['attention', 'blocked', 'failed', 'review_required'].includes(state)) return 'critical'
  if (['missing', 'legacy_pass', 'unavailable', 'limited', 'unsupported', 'no_published_identity'].includes(state)) return 'warning'
  if (['queued', 'not_tested', 'pending', 'cancelled', 'not_implemented'].includes(state)) return 'neutral'
  return 'running'
}
function readinessLabel(state) {
  return String(state || 'pending').replaceAll('_', ' ')
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

function SoftwareValidationModal({ application, source, onClose, onSave, saving }) {
  const catalogue = application?.catalogue || {}
  const sourceMeta = source?.metadata || {}
  const verification = catalogue.verification || {}
  const execution = catalogue.execution || {}
  const vulnerabilityIdentity = catalogue.vulnerabilityIdentity || {}
  const vulnerabilityAudit = catalogue.vulnerabilityIdentityAudit || {}
  const [feedback, setFeedback] = useState(null)
  const [form, setForm] = useState({
    canonicalName: catalogue.canonicalName || application?.name || '',
    publisher: catalogue.publisher || application?.publisher || '',
    namePattern: catalogue.namePattern || application?.name || '',
    publisherPattern: catalogue.publisherPattern || application?.publisher || '',
    sourceUrl: source?.source_url || '',
    repository: sourceMeta.repository || '',
    assetPattern: sourceMeta.assetPattern || '',
    checksumAssetPattern: sourceMeta.checksumAssetPattern || '',
    releaseTagPattern: sourceMeta.releaseTagPattern || '',
    staticInstallerUrl: sourceMeta.staticInstallerUrl || '',
    staticSha256: sourceMeta.staticSha256 || '',
    staticReleaseUrl: sourceMeta.staticReleaseUrl || '',
    expectedSigner: catalogue.expectedSigner || '',
    verificationMethod: verification.method || verification.provider || 'winget',
    verificationPackageId: verification.packageId || catalogue.executionPackageId || catalogue.packageId || '',
    productCode: verification.productCode || '',
    filePath: verification.filePath || '',
    displayNameContains: verification.displayNameContains || catalogue.namePattern || '',
    verificationPublisher: verification.publisherContains || catalogue.publisherPattern || '',
    versionTransform: verification.versionTransform || '',
    installArguments: execution.installArguments || '',
    responseFileName: execution.responseFile?.fileName || '',
    responseFileContent: execution.responseFile?.content || '',
    nvdVendor: vulnerabilityIdentity.nvdVendor || '',
    nvdProduct: vulnerabilityIdentity.nvdProduct || '',
    osvEcosystem: vulnerabilityIdentity.osvEcosystem || '',
    osvPackage: vulnerabilityIdentity.osvPackage || '',
    githubRepository: vulnerabilityIdentity.githubRepository || '',
    vulnerabilityDisposition: vulnerabilityIdentity.disposition || '',
    vulnerabilityIdentityNote: vulnerabilityIdentity.note || '',
  })
  const update = (key, value) => {
    setFeedback(null)
    setForm((current) => ({ ...current, [key]: value }))
  }
  const vendorManaged = Boolean(catalogue.builtIn && catalogue.sourceKey)

  async function submitValidation(event) {
    event.preventDefault()
    setFeedback({ tone: 'running', message: 'Saving validation settings and running validation…' })
    const result = await onSave({
      canonicalName: form.canonicalName,
      publisher: form.publisher,
      namePattern: form.namePattern,
      publisherPattern: form.publisherPattern,
      sourceUrl: form.sourceUrl,
      repository: form.repository,
      assetPattern: form.assetPattern,
      checksumAssetPattern: form.checksumAssetPattern,
      releaseTagPattern: form.releaseTagPattern,
      staticInstallerUrl: form.staticInstallerUrl,
      staticSha256: form.staticSha256,
      staticReleaseUrl: form.staticReleaseUrl,
      expectedSigner: form.expectedSigner,
      verification: {
        ...verification,
        method: form.verificationMethod,
        packageId: form.verificationPackageId,
        productCode: form.productCode,
        filePath: form.filePath,
        displayNameContains: form.displayNameContains,
        publisherContains: form.verificationPublisher,
        versionTransform: form.versionTransform,
      },
      execution: {
        ...execution,
        installArguments: form.installArguments,
        responseFile: form.responseFileName || form.responseFileContent
          ? { fileName: form.responseFileName, content: form.responseFileContent }
          : null,
      },
      vulnerabilityIdentity: {
        nvdVendor: form.nvdVendor,
        nvdProduct: form.nvdProduct,
        osvEcosystem: form.osvEcosystem,
        osvPackage: form.osvPackage,
        githubRepository: form.githubRepository,
        disposition: form.vulnerabilityDisposition,
        note: form.vulnerabilityIdentityNote,
      },
    })
    if (result?.success) {
      setFeedback({
        tone: result.warning ? 'warning' : 'success',
        message: result.message || 'Saved successfully. Source revalidation has started.',
      })
      if (result.installArguments !== undefined) {
        setForm((current) => ({ ...current, installArguments: result.installArguments }))
      }
      return
    }
    setFeedback({
      tone: result?.saved ? 'warning' : 'error',
      message: result?.error || 'Unable to save and revalidate this software.',
    })
  }

  return <div className="rmm-patch-modal-backdrop">
    <form className="rmm-patch-modal" onSubmit={submitValidation}>
      <header>
        <div><span className="rmm-eyebrow">Per-software validation</span><h2>{catalogue.canonicalName || application?.name}</h2></div>
        <button aria-label="Close" onClick={onClose} type="button"><X size={17} /></button>
      </header>
      <p>Changes affect only this catalogue item. Trust-affecting edits remove its previous qualification until the source, artifact and endpoint tests pass again.</p>
      <div className="rmm-patch-form-grid">
        <label>Canonical application<input value={form.canonicalName} onChange={(event) => update('canonicalName', event.target.value)} /></label>
        <label>Publisher<input value={form.publisher} onChange={(event) => update('publisher', event.target.value)} /></label>
        <label>Installed name contains<input value={form.namePattern} onChange={(event) => update('namePattern', event.target.value)} /></label>
        <label>Installed publisher contains<input value={form.publisherPattern} onChange={(event) => update('publisherPattern', event.target.value)} /></label>
        {vendorManaged && <><label>Vendor source URL<input value={form.sourceUrl} onChange={(event) => update('sourceUrl', event.target.value)} /></label>
        <label>Repository<input value={form.repository} onChange={(event) => update('repository', event.target.value)} placeholder="owner/repository" /></label>
        <label>Installer asset pattern<input value={form.assetPattern} onChange={(event) => update('assetPattern', event.target.value)} /></label>
        <label>Checksum asset pattern<input value={form.checksumAssetPattern} onChange={(event) => update('checksumAssetPattern', event.target.value)} /></label>
        <label>Release tag pattern<input value={form.releaseTagPattern} onChange={(event) => update('releaseTagPattern', event.target.value)} /></label>
        <label>Static installer URL<input value={form.staticInstallerUrl} onChange={(event) => update('staticInstallerUrl', event.target.value)} /></label>
        <label>Static SHA-256<input value={form.staticSha256} onChange={(event) => update('staticSha256', event.target.value)} /></label>
        <label>Static release URL<input value={form.staticReleaseUrl} onChange={(event) => update('staticReleaseUrl', event.target.value)} /></label>
        <label>Expected Authenticode signer<input value={form.expectedSigner} onChange={(event) => update('expectedSigner', event.target.value)} /></label></>}
        <div className="rmm-validation-section-title wide">
          <strong>Install & verification</strong>
          <span>These values are used by clean install, upgrade and rollback qualification. The installed result is verified independently from installer exit code.</span>
        </div>
        <label>Verification method<select value={form.verificationMethod} onChange={(event) => update('verificationMethod', event.target.value)}><option value="winget">WinGet package identity</option><option value="uninstall_registry">Uninstall registry / MSI identity</option><option value="file_version">Installed EXE/DLL file version</option></select></label>
        {form.verificationMethod === 'winget' && <label>Verification package ID<input value={form.verificationPackageId} onChange={(event) => update('verificationPackageId', event.target.value)} placeholder="e.g. timokoessler.2FAGuard" /></label>}
        {form.verificationMethod === 'uninstall_registry' && <label>MSI ProductCode<input value={form.productCode} onChange={(event) => update('productCode', event.target.value)} placeholder="Optional {GUID}" /></label>}
        {form.verificationMethod === 'file_version' && <label className="wide">Installed EXE/DLL path<input value={form.filePath} onChange={(event) => update('filePath', event.target.value)} placeholder="%ProgramFiles%\\Vendor\\App\\app.exe" /></label>}
        <label>Verification display name<input value={form.displayNameContains} onChange={(event) => update('displayNameContains', event.target.value)} /></label>
        <label>Verification publisher<input value={form.verificationPublisher} onChange={(event) => update('verificationPublisher', event.target.value)} /></label>
        <label>Version transform<input value={form.versionTransform} onChange={(event) => update('versionTransform', event.target.value)} placeholder="Normally blank" /></label>
        <label>Silent install arguments<input value={form.installArguments} onChange={(event) => update('installArguments', event.target.value)} /></label>
        <label className="wide">Vendor response-file name<input value={form.responseFileName} onChange={(event) => update('responseFileName', event.target.value)} placeholder="Optional, e.g. setup.xml" /></label>
        <label className="wide">Vendor response-file content<textarea rows={8} value={form.responseFileContent} onChange={(event) => update('responseFileContent', event.target.value)} placeholder="Optional. Use {HI5_TARGET_VERSION} for the release being tested. Silent arguments must reference {HI5_RESPONSE_FILE}." /></label>
        {(form.responseFileName || form.responseFileContent) && <div className="rmm-validation-identity-state wide">
          <FileCode2 size={15} />
          <span><strong>Job-scoped response file:</strong> written only inside the PatchHost job directory, substituted into <code>{'{HI5_RESPONSE_FILE}'}</code>, then purged after the job.</span>
        </div>}

        <div className="rmm-validation-section-title wide">
          <strong>Vulnerability identity</strong>
          <span>Use the authoritative identity source that actually tracks this application. You can keep unused identity types blank.</span>
        </div>
        <label className="wide">Identity disposition<select value={form.vulnerabilityDisposition} onChange={(event) => {
          const value = event.target.value
          setFeedback(null)
          setForm((current) => value === 'no_published_identity'
            ? { ...current, vulnerabilityDisposition: value, nvdVendor: '', nvdProduct: '', osvEcosystem: '', osvPackage: '', githubRepository: '' }
            : { ...current, vulnerabilityDisposition: value })
        }}><option value="">Authoritative identity required / still researching</option><option value="no_published_identity">No published authoritative identity found</option></select></label>
        {form.vulnerabilityDisposition === 'no_published_identity'
          ? <label className="wide">Review note<input value={form.vulnerabilityIdentityNote} onChange={(event) => update('vulnerabilityIdentityNote', event.target.value)} placeholder="What was checked / why no authoritative identity is available" /></label>
          : <>
        <label className="wide">GitHub repository<input value={form.githubRepository} onChange={(event) => update('githubRepository', event.target.value)} placeholder="owner/repository — e.g. timokoessler/2FAGuard" /></label>
        <label>NVD vendor<input value={form.nvdVendor} onChange={(event) => update('nvdVendor', event.target.value)} placeholder="CPE vendor token" /></label>
        <label>NVD product<input value={form.nvdProduct} onChange={(event) => update('nvdProduct', event.target.value)} placeholder="CPE product token" /></label>
        <label>OSV ecosystem<input value={form.osvEcosystem} onChange={(event) => update('osvEcosystem', event.target.value)} placeholder="e.g. npm, PyPI, GIT" /></label>
        <label>OSV package<input value={form.osvPackage} onChange={(event) => update('osvPackage', event.target.value)} placeholder="Package name / repository URI" /></label>
        </>}
        <div className="rmm-validation-identity-state wide">
          <ShieldCheck size={15} />
          <span><strong>Current identity:</strong> {readinessLabel(vulnerabilityAudit.state || 'needs_review')}{vulnerabilityAudit.resolvedSource ? ' · ' + vulnerabilityAudit.resolvedSource : ''}{vulnerabilityAudit.checkedAt ? ' · checked ' + labDate(vulnerabilityAudit.checkedAt) : ''}</span>
        </div>
      </div>
      <div className="rmm-patch-security-note"><ShieldCheck size={16} /><span><strong>Fail closed:</strong> a changed source or signer is not deployable again until validation succeeds.</span></div>
      {feedback && <div className={'rmm-validation-feedback ' + feedback.tone} role={feedback.tone === 'error' ? 'alert' : 'status'} aria-live="polite">
        {feedback.tone === 'success'
          ? <CheckCircle2 size={16} />
          : feedback.tone === 'running'
            ? <RefreshCw size={16} className="spin" />
            : <AlertTriangle size={16} />}
        <span>{feedback.message}</span>
      </div>}
      <footer><button onClick={onClose} type="button">{feedback?.tone === 'success' ? 'Close' : 'Cancel'}</button><button className="rmm-primary" disabled={saving || form.canonicalName.trim().length < 2 || form.namePattern.trim().length < 2} type="submit"><RefreshCw size={15} /> {saving ? 'Saving & revalidating…' : 'Save & revalidate'}</button></footer>
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
    criticalExploited: 'automatic',
    critical: 'automatic',
    high: 'manual',
    medium: 'manual',
    low: 'skip',
    advisory: 'skip',
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
        softwareRules: {
          vulnerabilityRules: {
            critical_exploited: form.criticalExploited,
            critical: form.critical,
            high: form.high,
            medium: form.medium,
            low: form.low,
            advisory: form.advisory,
          },
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
        <div className="wide"><strong>Vulnerability-driven approvals</strong><small>Automatic still requires a qualified, trusted remediation. Skip suppresses automatic deployment, not vulnerability visibility.</small></div>
        {[
          ['criticalExploited', 'Critical / known exploited'],
          ['critical', 'Critical (CVSS ≥ 9.0)'],
          ['high', 'High (CVSS 7.0–8.9)'],
          ['medium', 'Medium (CVSS 4.0–6.9)'],
          ['low', 'Low (CVSS < 4.0)'],
          ['advisory', 'Advisory / no scored CVE'],
        ].map(([key, label]) => <label key={key}>{label}<select value={form[key]} onChange={(event) => update(key, event.target.value)}><option value="automatic">Auto approve</option><option value="manual">Manual approval</option><option value="skip">Skip automatic patching</option></select></label>)}
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
function labDate(value) {
  if (!value) return 'Not yet'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString()
}

function QualificationWorkspace({
  item,
  lab,
  loading,
  busyAction,
  onAction,
  onEdit,
  onRevalidate,
  onRefresh,
  onMarkLimited,
  onClearLimited,
}) {
  const manualLimitation = lab?.application?.qualificationLimitations?.manual || {}
  const limitationKey = [
    item?.id || '',
    manualLimitation.reason || '',
    ...(Array.isArray(manualLimitation.unsupportedCapabilities) ? manualLimitation.unsupportedCapabilities : []),
  ].join('|')
  const [limitEditorOpen, setLimitEditorOpen] = useState(false)
  const [limitReason, setLimitReason] = useState('')
  const [limitUnsupported, setLimitUnsupported] = useState(['uninstall', 'rollback'])
  useEffect(() => {
    const existing = Array.isArray(manualLimitation.unsupportedCapabilities)
      ? manualLimitation.unsupportedCapabilities
      : []
    setLimitReason(manualLimitation.reason || '')
    setLimitUnsupported(existing.length ? existing : ['uninstall', 'rollback'])
    setLimitEditorOpen(false)
  }, [limitationKey])

  if (!item) return <div className="rmm-qualification-empty"><PackageCheck size={20} /><strong>Select an application</strong><span>Open one catalogue application to inspect and run its qualification layers.</span></div>
  if (loading && !lab) return <div className="rmm-qualification-empty"><Clock3 size={20} /><strong>Loading qualification workspace…</strong><span>Reading release, trust and runner evidence.</span></div>
  if (!lab) return <div className="rmm-qualification-empty"><AlertTriangle size={20} /><strong>Qualification details unavailable</strong><span>Refresh this application to retry.</span></div>

  const current = lab.releases?.current
  const previous = lab.releases?.previous
  const clean = lab.tests?.cleanInstall || {}
  const verification = lab.tests?.verification || {}
  const uninstall = lab.tests?.uninstall || {}
  const upgrade = lab.tests?.upgrade || {}
  const rollback = lab.tests?.rollback || {}
  const actions = lab.actions || {}
  const capabilities = lab.application?.qualificationCapabilities || {}
  const limitations = lab.application?.qualificationLimitations || {}
  const runnerOnline = lab.runner?.online
  const layerIcon = {
    source: Box,
    vulnerability: ShieldCheck,
    clean: PackageCheck,
    history: GitBranch,
    upgrade: RefreshCw,
    rollback: RotateCcw,
  }

  function actionButton(action, enabled, label, Icon, title = '') {
    return <button
      disabled={Boolean(busyAction) || !enabled}
      onClick={() => onAction(action)}
      title={!enabled && title ? title : undefined}
      type="button"
    ><Icon size={14} />{busyAction === action ? 'Working…' : label}</button>
  }

  return <div className="rmm-qualification-workspace">
    <header className="rmm-qualification-workspace-head">
      <div>
        <span className="rmm-eyebrow">Qualification workspace</span>
        <h3>{lab.application?.name || item.canonicalName}</h3>
        <p>{lab.application?.publisher || item.publisher || 'Publisher not reported'} · target {lab.application?.targetVersion || item.targetVersion || '—'} · {readinessLabel(lab.application?.deploymentMode || 'pending')}</p>
        <StatusPill tone={qualificationTone(lab.application?.qualificationState)}>{qualificationLabel(lab.application?.qualificationState)}</StatusPill>
      </div>
      <div className="rmm-qualification-runner">
        <small>Qualification runner</small>
        <strong>{lab.runner?.deviceName || 'Not configured'}</strong>
        <StatusPill tone={runnerOnline ? 'healthy' : 'critical'}>{runnerOnline ? 'Online' : 'Offline'}</StatusPill>
      </div>
    </header>

    {lab.application?.qualificationState === 'qualified_limited' && <div className="rmm-qualification-limited">
      <AlertTriangle size={17} />
      <div>
        <strong>Qualified — limited capabilities</strong>
        <span>{manualLimitation.state === 'declared'
          ? 'A technician has explicitly limited unsupported lifecycle operations. Supported operations remain available; unsupported operations are not treated as successful tests.'
          : 'Every available qualification check passed. Upstream limitations remain explicit and are not treated as successful tests.'}</span>
        <div className="rmm-qualification-capability-grid">
          <span><small>Clean install</small><b>{readinessLabel(capabilities.cleanInstall || 'verified')}</b></span>
          <span><small>Uninstall</small><b>{readinessLabel(capabilities.uninstall || 'verified')}</b></span>
          <span><small>Upgrade</small><b>{readinessLabel(capabilities.upgrade || 'unavailable')}</b></span>
          <span><small>Rollback</small><b>{readinessLabel(capabilities.rollback || 'unavailable')}</b></span>
          <span><small>Vulnerability coverage</small><b>{readinessLabel(capabilities.vulnerabilityCoverage || 'limited')}</b></span>
        </div>
        {limitations.historicalInstaller && <p>Historical installer: {readinessLabel(limitations.historicalInstaller.state)}{limitations.historicalInstaller.previousVersion ? ' · ' + limitations.historicalInstaller.previousVersion : ''}{limitations.historicalInstaller.reason ? ' · ' + readinessLabel(limitations.historicalInstaller.reason) : ''}</p>}
        {limitations.vulnerabilityIdentity && <p>Vulnerability identity: {readinessLabel(limitations.vulnerabilityIdentity.state)}{limitations.vulnerabilityIdentity.note ? ' · ' + limitations.vulnerabilityIdentity.note : ''}</p>}
        {manualLimitation.state === 'declared' && <p><strong>Declared limitation:</strong> {(manualLimitation.unsupportedCapabilities || []).map(readinessLabel).join(', ')} · {manualLimitation.reason}</p>}
      </div>
    </div>}

    <div className="rmm-qualification-actions">
      <button disabled={Boolean(busyAction)} onClick={onEdit} type="button"><Wrench size={14} /> Edit validation</button>
      <button disabled={Boolean(busyAction) || !actions.canRevalidate} onClick={onRevalidate} type="button"><RefreshCw size={14} /> Revalidate source</button>
      {actionButton('prepare_previous', actions.canPreparePrevious, 'Prepare previous release', GitBranch, lab.releases?.previousReady ? 'A trusted previous release is already retained.' : 'Automatic history discovery is not available for this source.')}
      {actionButton('clean_cycle', actions.canRunClean, 'Run clean cycle', PackageCheck, 'Current source and artifact trust must be ready first.')}
      {actionButton('upgrade', actions.canRunUpgrade, 'Run upgrade test', RefreshCw, 'Clean install/uninstall and a trusted previous release must pass first.')}
      {actionButton('rollback', actions.canRunRollback, 'Run rollback test', RotateCcw, 'A clean cycle, current upgrade proof, update_available detection and a trusted previous release must pass first.')}
      {actionButton('full', actions.canRunFull, 'Run full qualification', ShieldCheck, 'Current source and artifact trust must be ready first.')}
      <button disabled={Boolean(busyAction)} onClick={() => setLimitEditorOpen((open) => !open)} type="button"><AlertTriangle size={14} /> {lab.application?.qualificationState === 'qualified_limited' ? 'Edit limitations' : 'Mark limited'}</button>
      {lab.application?.qualificationState === 'qualified_limited' && manualLimitation.state === 'declared' && <button disabled={Boolean(busyAction)} onClick={onClearLimited} type="button"><RotateCcw size={14} /> Return to candidate</button>}
      <button disabled={Boolean(busyAction) || loading} onClick={onRefresh} type="button"><RefreshCw size={14} /> Refresh</button>
    </div>

    {limitEditorOpen && <div className="rmm-qualification-limit-editor">
      <div><strong>Limited capability declaration</strong><span>Use this only when a vendor or operating-system restriction makes part of the normal lifecycle genuinely unsupported. Source and installer trust are still required.</span></div>
      <div className="capabilities">
        {[
          ['clean_install', 'Clean install'],
          ['uninstall', 'Uninstall'],
          ['upgrade', 'Upgrade'],
          ['rollback', 'Rollback'],
          ['vulnerability_coverage', 'Vulnerability coverage'],
        ].map(([value, label]) => <label key={value}><input
          checked={limitUnsupported.includes(value)}
          onChange={(event) => setLimitUnsupported((current) => event.target.checked
            ? [...new Set([...current, value])]
            : current.filter((item) => item !== value))}
          type="checkbox"
        /><span>{label}</span></label>)}
      </div>
      <label className="reason">Reason<textarea
        maxLength={1000}
        onChange={(event) => setLimitReason(event.target.value)}
        placeholder="e.g. Windows-integrated component; vendor/OS blocks reliable removal."
        rows={3}
        value={limitReason}
      /></label>
      <div className="actions">
        <button disabled={Boolean(busyAction)} onClick={() => setLimitEditorOpen(false)} type="button">Cancel</button>
        <button className="rmm-primary" disabled={Boolean(busyAction) || !limitUnsupported.length || limitReason.trim().length < 8} onClick={async () => {
          const saved = await onMarkLimited(limitUnsupported, limitReason.trim())
          if (saved) setLimitEditorOpen(false)
        }} type="button">{busyAction === 'mark_limited' ? 'Saving…' : 'Save limited qualification'}</button>
      </div>
    </div>}

    <div className="rmm-qualification-layers">
      {(lab.layers || []).map((layer) => {
        const Icon = layerIcon[layer.id] || PackageCheck
        return <article className={'rmm-qualification-layer ' + (layer.state || '')} key={layer.id}>
          <header>
            <span className="icon"><Icon size={16} /></span>
            <div><strong>{layer.label}</strong><small>{layer.id === 'clean' ? 'Install → verify → uninstall' : layer.id === 'upgrade' ? 'Detect outdated → patch → verify' : layer.id === 'rollback' ? 'Controlled previous-version restore' : 'Qualification evidence'}</small></div>
            <StatusPill tone={readinessTone(layer.state)}>{readinessLabel(layer.state)}</StatusPill>
          </header>

          {layer.id === 'source' && <div className="rmm-qualification-facts">
            <span><small>Source</small><strong>{lab.source?.sourceType?.replaceAll('_', ' ') || '—'}</strong></span>
            <span><small>Host</small><strong>{lab.source?.sourceHost || '—'}</strong></span>
            <span><small>Current artifact</small><strong>{current?.version || lab.application?.targetVersion || '—'}</strong></span>
            <span><small>Expected signer</small><strong>{current?.expectedSigner || 'Not configured'}</strong></span>
            <span><small>Verified signer</small><strong>{current?.signatureVerified && current?.verifiedSigner ? current.verifiedSigner : 'Pending inspection'}</strong></span>
            <span><small>Published SHA-256</small><strong>{current?.publishedSha256Present ? 'Recorded' : 'Missing'}</strong></span>
            <span><small>Artifact hash</small><strong>{current?.sha256Verified ? 'Verified' : 'Pending inspection'}</strong></span>
            <span><small>Last source sync</small><strong>{labDate(lab.source?.lastSuccessAt)}</strong></span>
            {lab.source?.error && <span className="wide"><small>Source error</small><strong>{readinessLabel(lab.source.error)}</strong></span>}
          </div>}

          {layer.id === 'vulnerability' && <div className="rmm-qualification-facts">
            <span><small>Identity state</small><strong>{readinessLabel(lab.vulnerability?.state)}</strong></span>
            <span><small>Validated identities</small><strong>{lab.vulnerability?.identities?.length || 0}</strong></span>
            <span><small>Method</small><strong>{readinessLabel(lab.vulnerability?.method || 'not checked')}</strong></span>
            <span><small>Source</small><strong>{lab.vulnerability?.resolvedSource || '—'}</strong></span>
            {(lab.vulnerability?.identities || []).slice(0, 3).map((identity) => <span className="wide" key={identity.id}><small>{identity.sourceType || 'identity'}</small><strong>{[identity.vendor, identity.product, identity.packageName].filter(Boolean).join(' / ') || 'Validated mapping'}</strong></span>)}
            {lab.vulnerability?.state === 'no_published_identity' && <span className="wide"><small>Coverage limitation</small><strong>No authoritative NVD, OSV or GitHub identity is currently published. Hi5Central will keep rechecking.</strong></span>}
            {lab.vulnerability?.dispositionNote && <span className="wide"><small>Review note</small><strong>{lab.vulnerability.dispositionNote}</strong></span>}
          </div>}

          {layer.id === 'clean' && <div className="rmm-qualification-step-grid">
            <span><small>Install</small><StatusPill tone={readinessTone(clean.state)}>{readinessLabel(clean.state)}</StatusPill><em>{clean.version || lab.application?.targetVersion || '—'}</em></span>
            <span><small>Verify</small><StatusPill tone={readinessTone(verification.state)}>{readinessLabel(verification.state)}</StatusPill><em>{verification.version || 'Inventory target'}</em></span>
            <span><small>Uninstall</small><StatusPill tone={readinessTone(uninstall.state)}>{readinessLabel(uninstall.state)}</StatusPill><em>{uninstall.residueCleanupVerified ? 'Residue cleanup verified' : 'Cleanup required'}</em></span>
            {(clean.error || uninstall.error) && <p>{clean.error || uninstall.error}</p>}
          </div>}

          {layer.id === 'history' && <div className="rmm-release-pair">
            <div><small>Previous stable</small><strong>{previous?.version || 'Not retained'}</strong><span>{lab.releases?.previousUnavailable ? 'Unavailable upstream · ' + readinessLabel(lab.releases?.previousUnavailableReason || previous?.trustReason || 'historical artifact not retrievable') : previous ? readinessLabel(previous.trustState) + ' · ' + (previous.installerType || 'installer') : 'Prepare a trusted previous release before upgrade testing.'}</span></div>
            <ChevronRight size={17} />
            <div><small>Current stable</small><strong>{current?.version || lab.application?.targetVersion || '—'}</strong><span>{current ? readinessLabel(current.trustState) + ' · ' + (current.installerType || 'installer') : 'Current release evidence unavailable.'}</span></div>
          </div>}

          {layer.id === 'upgrade' && <div className="rmm-qualification-facts">
            <span><small>Upgrade state</small><strong>{readinessLabel(upgrade.state)}</strong></span>
            <span><small>From</small><strong>{upgrade.fromVersion || previous?.version || '—'}</strong></span>
            <span><small>Target</small><strong>{upgrade.targetVersion || lab.application?.targetVersion || '—'}</strong></span>
            <span><small>Patch detection</small><strong>{upgrade.patchDetectionVerified ? 'update_available verified' : 'Not yet verified'}</strong></span>
            <span><small>Detected installed</small><strong>{upgrade.patchDetectionInstalledVersion || '—'}</strong></span>
            <span><small>Verified at</small><strong>{labDate(upgrade.verifiedAt)}</strong></span>
            {upgrade.state === 'legacy_pass' && <p>Upgrade passed before the newer patch-detection gate existed. Re-run to prove update_available detection.</p>}
            {upgrade.error && <p>{upgrade.error}</p>}
          </div>}

          {layer.id === 'rollback' && <div className="rmm-qualification-facts">
            <span><small>Rollback state</small><strong>{readinessLabel(rollback.state)}</strong></span>
            <span><small>Version path</small><strong>{rollback.fromVersion || lab.application?.targetVersion || '—'} → {rollback.previousVersion || previous?.version || '—'} → {rollback.restoredVersion || lab.application?.targetVersion || '—'}</strong></span>
            <span><small>Current install</small><strong>{rollback.currentInstallVerified ? 'Verified' : 'Pending'}</strong></span>
            <span><small>Current uninstall</small><strong>{rollback.currentUninstallVerified ? 'Verified' : 'Pending'}</strong></span>
            <span><small>Previous install</small><strong>{rollback.previousInstallVerified ? 'Verified' : 'Pending'}</strong></span>
            <span><small>Previous inventory</small><strong>{rollback.previousInventoryVerified ? 'Verified' : 'Pending'}</strong></span>
            <span><small>Restore detection</small><strong>{rollback.restorePatchDetectionVerified ? 'update_available verified' : 'Pending'}</strong></span>
            <span><small>Restore target</small><strong>{rollback.restoreVerified ? 'Verified' : 'Pending'}</strong></span>
            <span><small>Final uninstall</small><strong>{rollback.finalUninstallVerified ? 'Verified' : 'Pending'}</strong></span>
            <span><small>Residue cleanup</small><strong>{rollback.residueCleanupVerified ? 'Verified' : 'Pending'}</strong></span>
            <span className="wide"><small>Safety boundary</small><strong>Rollback runs only on the qualification runner. Normal patch policies never downgrade managed endpoints.</strong></span>
            {rollback.error && <p>{rollback.error}</p>}
          </div>}
        </article>
      })}
    </div>

    <details className="rmm-qualification-history">
      <summary>Recent qualification activity · {lab.recentJobs?.length || 0}</summary>
      <div>
        {(lab.recentJobs || []).slice(0, 10).map((job) => <span key={job.id}>
          <strong>{job.jobType?.replaceAll('.', ' ') || 'Qualification job'}</strong>
          <small>{readinessLabel(job.status)}{job.stage ? ' · ' + readinessLabel(job.stage) : ''}{job.verifiedVersion ? ' · verified ' + job.verifiedVersion : ''}</small>
          {job.error && <em>{job.error}</em>}
        </span>)}
        {!lab.recentJobs?.length && <span><strong>No qualification jobs yet</strong><small>Run a clean cycle or full qualification to begin.</small></span>}
      </div>
    </details>
  </div>
}

export function RmmPatching({ devices = [], softwareOnly = false }) {
  const [tab, setTab] = useState('software')
  const [bundle, setBundle] = useState(null)
  const [scope, setScope] = useState({ groups: [] })
  const [vulnerabilities, setVulnerabilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [remediatingExposureId, setRemediatingExposureId] = useState('')
  const [error, setError] = useState('')
  const [mappingApp, setMappingApp] = useState(null)
  const [validationApp, setValidationApp] = useState(null)
  const [patchApp, setPatchApp] = useState(null)
  const [catalogueInstallDeviceId, setCatalogueInstallDeviceId] = useState('')
  const [catalogueInstallId, setCatalogueInstallId] = useState('')
  const [catalogueMaintenanceId, setCatalogueMaintenanceId] = useState('')
  const [qualificationLab, setQualificationLab] = useState(null)
  const [qualificationLabLoading, setQualificationLabLoading] = useState(false)
  const [qualificationAction, setQualificationAction] = useState('')
  const [bulkPatchDeviceId, setBulkPatchDeviceId] = useState('')
  const [bulkPatchMode, setBulkPatchMode] = useState('selected_catalogue')
  const [bulkPatchSelected, setBulkPatchSelected] = useState([])
  const [bulkPatchPreview, setBulkPatchPreview] = useState(null)
  const [bulkPatchBusy, setBulkPatchBusy] = useState(false)
  const [softwareSearch, setSoftwareSearch] = useState('')
  const [softwareStateFilter, setSoftwareStateFilter] = useState('all')
  const [softwareProviderFilter, setSoftwareProviderFilter] = useState('all')
  const [softwareSourceFilter, setSoftwareSourceFilter] = useState('all')
  const [softwareHealthFilter, setSoftwareHealthFilter] = useState('all')
  const [softwareQualificationFilter, setSoftwareQualificationFilter] = useState('all')
  const [softwarePage, setSoftwarePage] = useState(1)
  const [softwarePageSize, setSoftwarePageSize] = useState(25)
  const [wingetQuery, setWingetQuery] = useState('')
  const [wingetPage, setWingetPage] = useState(1)
  const [wingetPageSize, setWingetPageSize] = useState(50)
  const [wingetRepository, setWingetRepository] = useState({ packages: [], total: 0, pages: 1, page: 1 })
  const [wingetLoading, setWingetLoading] = useState(false)
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

  useEffect(() => {
    setWingetPage(1)
  }, [wingetQuery, wingetPageSize])

  useEffect(() => {
    if (!catalogueMaintenanceId) return undefined
    let active = true
    let first = true
    const load = async () => {
      try {
        const result = await loadSoftwareQualificationLab(catalogueMaintenanceId)
        if (active) setQualificationLab(result.lab || null)
      } catch (requestError) {
        if (active) {
          setQualificationLab(null)
          setError(requestError?.message || 'Unable to load catalogue qualification workspace.')
        }
      } finally {
        if (active && first) setQualificationLabLoading(false)
        first = false
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 5000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [catalogueMaintenanceId])

  useEffect(() => {
    if (tab !== 'winget') return undefined
    let active = true
    const timer = window.setTimeout(() => {
      setWingetLoading(true)
      searchWingetRepository(wingetQuery, wingetPage, wingetPageSize)
        .then((result) => { if (active) setWingetRepository(result) })
        .catch((requestError) => { if (active) setError(requestError?.message || 'Unable to load WinGet repository.') })
        .finally(() => { if (active) setWingetLoading(false) })
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [tab, wingetQuery, wingetPage, wingetPageSize])

  const applications = bundle?.applications || []
  const catalogue = bundle?.catalogue || []
  const catalogueMaintenanceItems = [...catalogue].sort((a, b) => String(a.canonicalName || '').localeCompare(String(b.canonicalName || '')))
  const selectedCatalogueMaintenance = catalogueMaintenanceItems.find((item) => item.id === catalogueMaintenanceId) || null
  const selectedCatalogueMaintenanceApp = selectedCatalogueMaintenance
    ? { name: selectedCatalogueMaintenance.canonicalName, publisher: selectedCatalogueMaintenance.publisher, catalogue: selectedCatalogueMaintenance }
    : null
  const patchDevices = bundle?.devices || []
  const catalogueCandidates = bundle?.catalogueCandidates || []
  const patchObservations = bundle?.patchObservations || []
  const vendorSources = bundle?.vendorIntel?.sources || []
  const validationSource = validationApp?.catalogue?.sourceKey
    ? vendorSources.find((source) => source.source_key === validationApp.catalogue.sourceKey) || null
    : null
  const vendorLatest = bundle?.vendorIntel?.latest || []
  const vendorReview = vendorLatest.filter((item) => ['rejected', 'signer_review_required', 'installer_review_required'].includes(item.trust_state))
  const vendorReviewCounts = vendorReview.reduce((counts, item) => ({ ...counts, [item.trust_state]: (counts[item.trust_state] || 0) + 1 }), {})
  const vendorReadiness = bundle?.vendorIntel?.readiness || []
  const vendorReadinessCounts = bundle?.vendorIntel?.readinessCounts || {}
  const vendorBacklog = vendorReadiness.filter((item) => item.state === 'automation_backlog')
  const vendorIntelligenceOnly = vendorReadiness.filter((item) => item.state === 'intelligence_only')
  const vendorSourceHealth = bundle?.vendorIntel?.sourceHealth || []
  const vendorSourceHealthMap = new Map(vendorSourceHealth.map((item) => [item.source_key, item]))
  const vendorHealth = bundle?.vendorIntel?.health || {}
  const tenantVendorSources = bundle?.vendorIntel?.tenantSources || []
  const policies = bundle?.policies || []
  const assignments = bundle?.assignments || []
  const deviceSoftware = bundle?.deviceSoftware || []
  const deployments = bundle?.deployments || []
  const softwareVulnerabilityExposures = bundle?.softwareVulnerabilityExposures || []
  const vulnerabilityHydration = bundle?.vulnerabilityHydration || []
  const vulnerabilityExposureRows = bundle?.vulnerabilityExposureRows || []
  const vulnerabilityCatalogue = bundle?.vulnerabilityCatalogue || {}
  const qualificationQueue = bundle?.qualificationQueue || []
  const qualificationQueueCounts = qualificationQueue.reduce((counts, item) => ({
    ...counts,
    [item.state]: (counts[item.state] || 0) + 1,
  }), {})
  const qualificationReview = qualificationQueue.filter((item) => item.state === 'review_required')
  const qualificationProgress = bundle?.qualificationProgress || {}
  const qualificationFailureGroups = qualificationProgress.failureGroups || []
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
  const selectedCatalogueReadiness = selectedCatalogueInstall?.qualificationReadiness || {}
  const selectedInstallPatchHost = selectedInstallDevice?.patchCapabilities?.patchHostVersion
    || selectedInstallDevice?.patchCapabilities?.version
    || ''
  const selectedInstallCapabilityReady = Boolean(
    selectedInstallDevice?.patchCapabilities?.softwareInstall
    && versionAtLeast(selectedInstallPatchHost, '0.2.5'),
  )


  const bulkPatchDevice = patchDevices.find((device) => device.agentDeviceId === bulkPatchDeviceId) || null
  const bulkPatchDeviceUpdates = deviceSoftware
    .filter((item) => item.agentDeviceId === bulkPatchDeviceId && item.patchStatus === 'update_available' && item.catalogue?.id)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  const bulkPatchCapabilityReady = Boolean(bulkPatchDevice?.online && bulkPatchDevice?.patchCapabilities?.softwareBulk)
  const bulkPatchSelectedIds = bulkPatchMode === 'selected_catalogue'
    ? bulkPatchSelected.filter((id) => bulkPatchDeviceUpdates.some((item) => item.catalogue?.id === id))
    : []
  const bulkCatalogueUpdateCount = bulkPatchDeviceUpdates.filter((item) => item.catalogue?.catalogueSource !== 'patchhost').length
  const bulkWingetUpdateCount = patchObservations.filter((item) => item.inventory_id === bulkPatchDevice?.inventoryId && item.provider === 'winget' && item.patch_status === 'update_available').length

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

  useEffect(() => {
    if (!bulkPatchDeviceId && onlineInstallDevices.length) {
      setBulkPatchDeviceId(onlineInstallDevices[0].agentDeviceId)
    }
  }, [bulkPatchDeviceId, onlineInstallDevices])

  useEffect(() => {
    setBulkPatchPreview(null)
    if (bulkPatchMode !== 'selected_catalogue') setBulkPatchSelected([])
  }, [bulkPatchDeviceId, bulkPatchMode])

  useEffect(() => {
    setBulkPatchSelected((current) => current.filter((id) => bulkPatchDeviceUpdates.some((item) => item.catalogue?.id === id)))
  }, [bulkPatchDeviceId, bundle])

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
        unresolvedIdentity: summary.unresolvedIdentity + Number(item.status === 'pending_identity'),
        unresolvedVersion: summary.unresolvedVersion + Number(item.status === 'pending_version'),
      }), { total: 0, checked: 0, pending: 0, unresolvedIdentity: 0, unresolvedVersion: 0 })

    return { ...exposure, ...hydration }
  }

  function applicationPatchState(application) {
    if (application.updateAvailable) return 'update_available'
    if (application.providerBlocked) return 'provider_blocked'
    if (application.olderVersionPresent) return 'older_version_present'
    if (application.catalogue?.targetVersion) return 'current'
    if (application.catalogue) return 'detection_pending'
    return 'unmapped'
  }

  function applicationSourceState(application) {
    if (!application.catalogue) return { type: 'unmapped', health: 'unmapped' }
    const type = application.catalogue.sourceType || application.catalogue.catalogueSource || 'other'
    if (application.catalogue.sourceEnabled === false) return { type, health: 'disabled' }
    const monitored = application.catalogue.sourceKey ? vendorSourceHealthMap.get(application.catalogue.sourceKey) : null
    return { type, health: monitored?.state || (application.catalogue.catalogueSource === 'patchhost' ? 'endpoint' : 'unmonitored') }
  }

  const softwareSourceOptions = [...new Set(applications.map((application) => applicationSourceState(application).type).filter(Boolean))].sort()
  const softwareQuery = softwareSearch.trim().toLowerCase()
  const filteredApplications = applications.filter((application) => {
    const state = applicationPatchState(application)
    const exposure = exposureForApplication(application)
    const provider = String(application.catalogue?.provider || 'unmapped').toLowerCase()
    const source = applicationSourceState(application)
    const qualification = application.catalogue?.qualificationState || 'unmapped'
    if (softwareStateFilter === 'updates' && !['update_available', 'older_version_present', 'provider_blocked'].includes(state)) return false
    if (softwareStateFilter === 'vulnerable' && Number(exposure.open || 0) < 1) return false
    if (softwareStateFilter === 'unmapped' && state !== 'unmapped') return false
    if (softwareStateFilter === 'current' && state !== 'current') return false
    if (softwareProviderFilter !== 'all' && provider !== softwareProviderFilter) return false
    if (softwareSourceFilter !== 'all' && source.type !== softwareSourceFilter) return false
    if (softwareHealthFilter !== 'all' && source.health !== softwareHealthFilter) return false
    if (softwareQualificationFilter !== 'all' && qualification !== softwareQualificationFilter) return false
    if (!softwareQuery) return true
    const searchable = [
      application.name,
      application.publisher,
      application.catalogue?.canonicalName,
      application.catalogue?.packageId,
      application.catalogue?.provider,
      application.catalogue?.targetVersion,
      application.catalogue?.sourceKey,
      application.catalogue?.sourceType,
      application.catalogue?.registry,
      application.catalogue?.trustState,
      qualification,
      source.health,
      ...(application.versions || []).map((item) => item.version),
      state,
    ].filter(Boolean).join(' ').toLowerCase()
    return searchable.includes(softwareQuery)
  })
  const softwarePageCount = Math.max(1, Math.ceil(filteredApplications.length / softwarePageSize))
  const safeSoftwarePage = Math.min(softwarePage, softwarePageCount)
  const pagedApplications = filteredApplications.slice((safeSoftwarePage - 1) * softwarePageSize, safeSoftwarePage * softwarePageSize)

  useEffect(() => {
    setSoftwarePage(1)
  }, [softwareSearch, softwareStateFilter, softwareProviderFilter, softwareSourceFilter, softwareHealthFilter, softwareQualificationFilter, softwarePageSize])

  useEffect(() => {
    if (softwarePage > softwarePageCount) setSoftwarePage(softwarePageCount)
  }, [softwarePage, softwarePageCount])

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

  async function saveSoftwareValidation(form) {
    if (!validationApp?.catalogue?.id) {
      return { success: false, error: 'No catalogue application is selected.' }
    }
    setSaving(true)
    setError('')
    let settingsSaved = false
    try {
      const updated = await updateSoftwareValidation(validationApp.catalogue.id, form)
      settingsSaved = true
      if (updated.bundle) setBundle(updated.bundle)

      let finalPayload = updated
      if (updated.revalidateSource !== false) {
        try {
          const validated = await revalidateSoftwareCatalogueEntry(validationApp.catalogue.id)
          if (validated.bundle) setBundle(validated.bundle)
          finalPayload = validated
        } catch (requestError) {
          if (requestError?.data?.bundle) setBundle(requestError.data.bundle)
          const message = requestError?.message || 'Source revalidation failed.'
          setError(message)
          return {
            success: false,
            saved: true,
            error: 'Validation settings were saved, but source revalidation failed: ' + message,
          }
        }
      }

      const vulnerabilityValidation = updated.vulnerabilityValidation
      const vulnerabilityResolved = vulnerabilityValidation
        && ['covered', 'no_published_identity'].includes(vulnerabilityValidation.state)
      if (vulnerabilityValidation && !vulnerabilityResolved) {
        const reason = vulnerabilityValidation.error
          || vulnerabilityValidation.method
          || vulnerabilityValidation.state
          || 'needs review'
        const message = 'Validation settings were saved, but vulnerability identity validation did not resolve: '
          + String(reason).replaceAll('_', ' ')
        setError(message)
        return { success: false, saved: true, error: message }
      }

      const persisted = (finalPayload?.bundle?.catalogue || updated?.bundle?.catalogue || [])
        .find((item) => item.id === validationApp.catalogue.id)
      const identitySource = vulnerabilityValidation?.resolvedSource || ''
      const advisoryCount = Number(vulnerabilityValidation?.advisoryValidation?.advisoriesSeen)
      const advisorySuffix = Number.isFinite(advisoryCount)
        ? ' · ' + advisoryCount + ' published advisor' + (advisoryCount === 1 ? 'y' : 'ies') + ' checked'
        : ''
      const noPublishedIdentity = vulnerabilityValidation?.state === 'no_published_identity'
      const message = noPublishedIdentity
        ? 'Saved successfully. No published authoritative vulnerability identity was resolved. Hi5Central will keep rechecking this application periodically; vulnerability coverage remains limited.'
        : updated.revalidateSource !== false
          ? vulnerabilityValidation?.state === 'covered'
            ? 'Saved successfully. Source revalidation started and vulnerability identity validated via ' + identitySource + advisorySuffix + '.'
            : 'Saved successfully. Validation settings updated and source revalidation started.'
          : vulnerabilityValidation?.state === 'covered'
            ? 'Saved successfully. Vulnerability identity validated via ' + identitySource + advisorySuffix + '. Existing endpoint qualification evidence was preserved.'
            : 'Saved successfully. Validation settings updated.'

      return {
        success: true,
        warning: noPublishedIdentity,
        message,
        installArguments: persisted?.execution?.installArguments ?? form.execution?.installArguments ?? '',
        vulnerabilityValidation,
      }
    } catch (requestError) {
      if (requestError?.data?.bundle) setBundle(requestError.data.bundle)
      const message = requestError?.message || 'Unable to update and revalidate this software.'
      setError(message)
      return { success: false, saved: settingsSaved, error: message }
    } finally {
      setSaving(false)
    }
  }

  function selectCatalogueMaintenance(value) {
    setCatalogueMaintenanceId(value)
    setQualificationLab(null)
    setQualificationLabLoading(Boolean(value))
    setQualificationAction('')
  }

  async function runQualificationWorkspaceAction(action) {
    if (!catalogueMaintenanceId || qualificationAction) return
    setQualificationAction(action)
    setError('')
    try {
      const result = await runSoftwareQualificationAction(catalogueMaintenanceId, action)
      if (result.bundle) setBundle(result.bundle)
      if (result.lab) setQualificationLab(result.lab)
    } catch (requestError) {
      if (requestError?.data?.bundle) setBundle(requestError.data.bundle)
      if (requestError?.data?.lab) setQualificationLab(requestError.data.lab)
      setError(requestError?.message || 'Unable to run catalogue qualification action.')
    } finally {
      setQualificationAction('')
    }
  }

  async function markQualificationLimited(unsupportedCapabilities, reason) {
    if (!catalogueMaintenanceId || qualificationAction) return false
    setQualificationAction('mark_limited')
    setError('')
    try {
      const result = await runSoftwareQualificationAction(catalogueMaintenanceId, 'mark_limited', {
        unsupportedCapabilities,
        reason,
      })
      if (result.bundle) setBundle(result.bundle)
      if (result.lab) setQualificationLab(result.lab)
      return true
    } catch (requestError) {
      if (requestError?.data?.bundle) setBundle(requestError.data.bundle)
      if (requestError?.data?.lab) setQualificationLab(requestError.data.lab)
      setError(requestError?.message || 'Unable to mark this application as limited.')
      return false
    } finally {
      setQualificationAction('')
    }
  }

  async function clearQualificationLimited() {
    if (!catalogueMaintenanceId || qualificationAction) return
    setQualificationAction('clear_limited')
    setError('')
    try {
      const result = await runSoftwareQualificationAction(catalogueMaintenanceId, 'clear_limited')
      if (result.bundle) setBundle(result.bundle)
      if (result.lab) setQualificationLab(result.lab)
    } catch (requestError) {
      if (requestError?.data?.bundle) setBundle(requestError.data.bundle)
      if (requestError?.data?.lab) setQualificationLab(requestError.data.lab)
      setError(requestError?.message || 'Unable to remove limited qualification.')
    } finally {
      setQualificationAction('')
    }
  }

  async function refreshQualificationWorkspace() {
    if (!catalogueMaintenanceId || qualificationLabLoading) return
    setQualificationLabLoading(true)
    setError('')
    try {
      const result = await loadSoftwareQualificationLab(catalogueMaintenanceId)
      setQualificationLab(result.lab || null)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to refresh catalogue qualification workspace.')
    } finally {
      setQualificationLabLoading(false)
    }
  }

  async function revalidateApplication(application) {
    if (!application?.catalogue?.id || !application.catalogue.sourceKey) return
    setSaving(true)
    setError('')
    try {
      const result = await revalidateSoftwareCatalogueEntry(application.catalogue.id)
      setBundle(result.bundle)
      if (application.catalogue.id === catalogueMaintenanceId) {
        const lab = await loadSoftwareQualificationLab(application.catalogue.id)
        setQualificationLab(lab.lab || null)
      }
    } catch (requestError) {
      if (requestError?.data?.bundle) setBundle(requestError.data.bundle)
      setError(requestError?.message || 'Software validation failed.')
    } finally {
      setSaving(false)
    }
  }

  async function retryApplicationQualification(application) {
    if (!application?.catalogue?.id) return
    setSaving(true)
    setError('')
    try {
      const result = await retrySoftwareQualification(application.catalogue.id)
      setBundle(result.bundle)
    } catch (requestError) {
      if (requestError?.data?.bundle) setBundle(requestError.data.bundle)
      setError(requestError?.message || 'Unable to retry software qualification.')
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

  async function previewBulkSoftwarePatch() {
    if (!bulkPatchDeviceId) return
    if (bulkPatchMode === 'selected_catalogue' && !bulkPatchSelectedIds.length) {
      setError('Select at least one application to preview.')
      return
    }
    setBulkPatchBusy(true)
    setError('')
    try {
      const preview = await planSoftwarePatches(bulkPatchDeviceId, bulkPatchSelectedIds, bulkPatchMode)
      setBulkPatchPreview(preview)
    } catch (requestError) {
      setBulkPatchPreview(requestError?.data || null)
      setError(requestError?.message || 'Unable to preview software patches.')
    } finally {
      setBulkPatchBusy(false)
    }
  }

  async function executeBulkSoftwarePatch() {
    if (!bulkPatchDeviceId || !bulkPatchPreview?.eligibleCount || !bulkPatchCapabilityReady) return
    setBulkPatchBusy(true)
    setError('')
    try {
      const result = await deploySoftwarePatches(bulkPatchDeviceId, bulkPatchSelectedIds, bulkPatchMode)
      setBundle(result.bundle)
      setBulkPatchPreview(null)
      setBulkPatchSelected([])
    } catch (requestError) {
      setBulkPatchPreview(requestError?.data || bulkPatchPreview)
      setError(requestError?.message || 'Unable to start bulk software patching.')
    } finally {
      setBulkPatchBusy(false)
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
    {!softwareOnly && <PageHeading action={<div className="rmm-patch-heading-actions"><button disabled={loading} onClick={refresh} type="button"><RefreshCw size={15} /> Refresh</button><button className="rmm-primary compact" onClick={() => setShowPolicy(true)} type="button"><Plus size={15} /> New policy</button></div>} />}
    {error && <div className="rmm-patch-error"><AlertTriangle size={16} /><span>{error}</span></div>}

    {!softwareOnly && <div className="rmm-patch-metrics">
      <Metric icon={PackageCheck} label="Software installations" value={loading ? '…' : overview.softwareInstallations ?? 0} />
      <Metric icon={AlertTriangle} label="Software updates available" value={loading ? '…' : overview.updateAvailable ?? 0} tone="warning" />
      <Metric icon={ShieldCheck} label="Open CVE exposures" value={loading ? '…' : exposureSummary.open ?? 0} tone={Number(exposureSummary.open || 0) > 0 ? 'critical' : ''} />
      <Metric icon={Monitor} label="Windows updates pending" value={windowsPending} />
    </div>}
    {!softwareOnly && <section className="rmm-patch-security-banner">
      <ShieldCheck size={20} />
      <div><strong>Server-authoritative patch intelligence</strong><span>The full software/CVE catalogue stays in Hi5Central. PatchHost receives only short-lived per-job manifests and never receives the estate-wide catalogue.</span></div>
      <StatusPill tone="healthy">Protected design</StatusPill>
    </section>}

    {!softwareOnly && <nav className="rmm-patch-tabs">
      {[
        ['software', 'Software', exposedApps.length],
        ['winget', 'WinGet Repository', wingetRepository.total || 0],
        ['vendors', 'Vendors', vendorSources.length + tenantVendorSources.length],
        ['vulnerabilities', 'Vulnerabilities', bundle?.vulnerabilities?.kev || 0],
        ['windows', 'Windows Update', windowsPending],
        ['policies', 'Policies', policies.length],
      ].map(([id, label, count]) => <button className={tab === id ? 'active' : ''} key={id} onClick={() => setTab(id)} type="button">{label}<b>{count}</b></button>)}
    </nav>}

    {tab === 'software' && <section className="rmm-patch-panel">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Software patch catalogue</span><h2>Patchability by application</h2><p>{mappedApps.length} mapped application{mappedApps.length === 1 ? '' : 's'} · {applications.length - mappedApps.length} awaiting mapping · {catalogueCandidates.length} automatically discovered package{catalogueCandidates.length === 1 ? '' : 's'} · {overview.qualifiedCatalogue || 0} qualified · {overview.automaticAdmissionReadyCatalogue || 0} automatic-admission ready · {overview.candidateCatalogue || 0} deployment candidates.</p></div></div>
      <div className="rmm-vulnerability-coverage"><div><ShieldCheck size={17} /><span><strong>Catalogue vulnerability identity validation</strong><small>{vulnerabilityCatalogue.covered ?? 0} of {vulnerabilityCatalogue.total ?? catalogue.length} catalogue applications have completed source validation. NVD CPE and exact OSV identities are checked independently; endpoint exposures are still created only when that software/version is actually installed.</small></span></div><div className="stats"><span><small>NVD mapped</small><strong>{vulnerabilityCatalogue.nvd ?? 0}</strong></span><span><small>OSV mapped</small><strong>{vulnerabilityCatalogue.osv ?? 0}</strong></span><span><small>Validated</small><strong>{vulnerabilityCatalogue.covered ?? 0}</strong></span><span><small>Unchecked</small><strong>{vulnerabilityCatalogue.unchecked ?? 0}</strong></span><span><small>Mapping to validate</small><strong>{vulnerabilityCatalogue.validationPending ?? 0}</strong></span><span><small>Needs identity</small><strong>{vulnerabilityCatalogue.needsIdentity ?? 0}</strong></span><span><small>Source pending</small><strong>{vulnerabilityCatalogue.sourcePending ?? 0}</strong></span></div></div>
      {!!qualificationQueue.length && <div className="rmm-vulnerability-coverage"><div><PackageCheck size={17} /><span><strong>Automatic catalogue qualification</strong><small>One candidate at a time is clean-installed on the designated qualification runner, verified by PatchHost, uninstalled, then confirmed absent from inventory. Failures stop for review instead of retrying blindly.</small></span></div><div className="stats"><span><small>Queued</small><strong>{qualificationQueueCounts.queued || 0}</strong></span><span><small>Installing</small><strong>{qualificationQueueCounts.running || 0}</strong></span><span><small>Cleanup</small><strong>{(qualificationQueueCounts.cleanup_pending || 0) + (qualificationQueueCounts.cleanup_running || 0)}</strong></span><span><small>Passed</small><strong>{qualificationQueueCounts.passed || 0}</strong></span><span><small>Review</small><strong>{qualificationQueueCounts.review_required || 0}</strong></span></div>{!!qualificationReview.length && <div className="rmm-patch-candidate-footnote">{qualificationReview.slice(0, 5).map((item) => <span key={item.id}><strong>{item.canonical_name}</strong> · {item.target_version} · {readinessLabel(item.last_error || 'review required')}</span>)}</div>}</div>}
      {!!qualificationQueue.length && <div className="rmm-vulnerability-coverage">
        <div><PackageCheck size={17} /><span><strong>Progress toward full qualification</strong><small>Install and removal, upgrade, and full admission are tracked separately. Review groups identify fixes that can help several applications.</small></span></div>
        <div className="stats">
          <span><small>Install / removal passed</small><strong>{qualificationProgress.cleanInstallPassed || 0}</strong></span>
          <span><small>Upgrade passed</small><strong>{qualificationProgress.upgradePassed || 0}</strong></span>
          <span><small>Rollback passed</small><strong>{qualificationProgress.rollbackPassed || 0}</strong></span>
          <span><small>Fully qualified</small><strong>{qualificationProgress.fullyQualified || 0}</strong></span>
          <span><small>Qualified · limited</small><strong>{qualificationProgress.limitedQualified || 0}</strong></span>
        </div>
        {!!qualificationFailureGroups.length && <div style={{width: '100%', display: 'grid', gap: '8px'}}>
          {qualificationFailureGroups.map(group => <details key={group.key}>
            <summary>{group.label} · {group.count}</summary>
            <p>{group.nextAction}</p>
            <ul>{group.applications.map(item => <li key={item.id}><strong>{item.name}</strong> · {item.installerTechnology} · {readinessLabel(item.error || 'review required')}</li>)}</ul>
          </details>)}
        </div>}
      </div>}

      <section className="rmm-qualification-shell">
        <div className="rmm-qualification-selector">
          <div><Wrench size={18} /><span><strong>Catalogue qualification lab</strong><small>Inspect every admission layer and run controlled install, verify, uninstall and upgrade tests from Hi5Central.</small></span></div>
          <label>Application<select value={catalogueMaintenanceId} onChange={(event) => selectCatalogueMaintenance(event.target.value)}>
            <option value="">Select catalogue application</option>
            {catalogueMaintenanceItems.map((item) => <option key={item.id} value={item.id}>{item.canonicalName} · {item.targetVersion || 'No target'} · {qualificationLabel(item.qualificationState)}</option>)}
          </select></label>
          {selectedCatalogueMaintenance && <div className="rmm-qualification-selector-meta">
            <span><small>Target</small><strong>{selectedCatalogueMaintenance.targetVersion || '—'}</strong></span>
            <span><small>Provider</small><strong>{selectedCatalogueMaintenance.deploymentMode?.replaceAll('_', ' ') || selectedCatalogueMaintenance.provider || '—'}</strong></span>
            <span><small>Trust</small><StatusPill tone={readinessTone(selectedCatalogueMaintenance.trustState)}>{readinessLabel(selectedCatalogueMaintenance.trustState || 'pending')}</StatusPill></span>
            <span><small>Qualification</small><StatusPill tone={qualificationTone(selectedCatalogueMaintenance.qualificationState)}>{qualificationLabel(selectedCatalogueMaintenance.qualificationState)}</StatusPill></span>
          </div>}
        </div>
        <QualificationWorkspace
          item={selectedCatalogueMaintenance}
          lab={qualificationLab}
          loading={qualificationLabLoading}
          busyAction={qualificationAction}
          onAction={runQualificationWorkspaceAction}
          onEdit={() => selectedCatalogueMaintenanceApp && setValidationApp(selectedCatalogueMaintenanceApp)}
          onRevalidate={() => selectedCatalogueMaintenanceApp && revalidateApplication(selectedCatalogueMaintenanceApp)}
          onRefresh={refreshQualificationWorkspace}
          onMarkLimited={markQualificationLimited}
          onClearLimited={clearQualificationLimited}
        />
      </section>
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
            <span><small>Admission</small><strong>{readinessLabel(selectedCatalogueReadiness.state)}</strong></span>
            <span><small>PatchHost</small><strong>{selectedInstallPatchHost || 'Not reported'}</strong></span>
          </div>
          {selectedCatalogueInstall && <div className="install-meta">
            <span><small>Source</small><StatusPill tone={readinessTone(selectedCatalogueReadiness.source?.state)}>{readinessLabel(selectedCatalogueReadiness.source?.state)}</StatusPill></span>
            <span><small>Artifact</small><StatusPill tone={readinessTone(selectedCatalogueReadiness.artifact?.state)}>{readinessLabel(selectedCatalogueReadiness.artifact?.state)}</StatusPill></span>
            <span><small>Clean install</small><StatusPill tone={readinessTone(selectedCatalogueReadiness.installTest?.state)}>{readinessLabel(selectedCatalogueReadiness.installTest?.state)}</StatusPill></span>
            <span><small>Uninstall</small><StatusPill tone={readinessTone(selectedCatalogueReadiness.uninstallTest?.state)}>{readinessLabel(selectedCatalogueReadiness.uninstallTest?.state)}</StatusPill></span>
            <span><small>Upgrade</small><StatusPill tone={readinessTone(selectedCatalogueReadiness.upgradeTest?.state)}>{readinessLabel(selectedCatalogueReadiness.upgradeTest?.state)}</StatusPill></span>
            <span><small>Vulnerability</small><StatusPill tone={readinessTone(selectedCatalogueReadiness.vulnerability?.state)}>{readinessLabel(selectedCatalogueReadiness.vulnerability?.state)}</StatusPill></span>
          </div>}
          <button className="rmm-primary" disabled={saving || !selectedCatalogueInstall || !selectedInstallCapabilityReady} onClick={runCatalogueInstall} type="button"><Plus size={14} /> Install</button>
        </div>
        {selectedInstallDevice && !selectedInstallCapabilityReady && <small className="capability-note">Catalogue installation requires PatchHost 0.2.5 or newer. {selectedInstallPatchHost ? 'This device currently reports ' + selectedInstallPatchHost + '.' : 'This device has not reported a compatible PatchHost version yet.'}</small>}
        {catalogueInstallDeviceId && !installableCatalogue.length && <small className="capability-note">No installable catalogue applications remain for this device.</small>}
      </div>
      <div className="rmm-bulk-patch-card">
        <div className="intro"><ShieldCheck size={18} /><div><strong>Bulk application patching</strong><span>Preview an endpoint-specific plan before anything is queued. Choose selected catalogue applications, every eligible Hi5Central catalogue update, or every WinGet-discovered update.</span></div></div>
        <div className="controls">
          <label>Device<select value={bulkPatchDeviceId} onChange={(event) => setBulkPatchDeviceId(event.target.value)}><option value="">Select online device</option>{onlineInstallDevices.map((device) => <option key={device.agentDeviceId} value={device.agentDeviceId}>{device.name}</option>)}</select></label>
          <label>Patch mode<select value={bulkPatchMode} onChange={(event) => setBulkPatchMode(event.target.value)}><option value="selected_catalogue">Selected catalogue applications</option><option value="all_catalogue">All Hi5Central catalogue updates ({bulkCatalogueUpdateCount})</option><option value="all_winget">All WinGet updates ({bulkWingetUpdateCount})</option></select></label>
          <button disabled={bulkPatchBusy || !bulkPatchDeviceId || (bulkPatchMode === 'selected_catalogue' && !bulkPatchSelectedIds.length)} onClick={previewBulkSoftwarePatch} type="button"><Search size={14} /> Preview plan</button>
        </div>
        {bulkPatchMode === 'selected_catalogue' && <div className="rmm-bulk-patch-selection"><div className="selection-head"><strong>{bulkPatchDeviceUpdates.length} updates detected</strong><button disabled={!bulkPatchDeviceUpdates.length} onClick={() => setBulkPatchSelected(bulkPatchSelectedIds.length === bulkPatchDeviceUpdates.length ? [] : bulkPatchDeviceUpdates.map((item) => item.catalogue.id))} type="button">{bulkPatchSelectedIds.length === bulkPatchDeviceUpdates.length && bulkPatchDeviceUpdates.length ? 'Clear all' : 'Select all'}</button></div>{bulkPatchDeviceUpdates.map((item) => <label key={item.catalogue.id}><input checked={bulkPatchSelectedIds.includes(item.catalogue.id)} onChange={(event) => setBulkPatchSelected((current) => event.target.checked ? [...new Set([...current, item.catalogue.id])] : current.filter((id) => id !== item.catalogue.id))} type="checkbox" /><span><strong>{item.name}</strong><small>{item.installedVersion || 'Unknown'} → {item.targetVersion || 'Unknown'} · {item.catalogue.provider}</small></span></label>)}</div>}
        {bulkPatchDevice && !bulkPatchCapabilityReady && <small className="capability-note">This endpoint is online but has not reported verified bulk software-patch capability yet. Upgrade the Agent before executing a bulk plan.</small>}
        {bulkPatchPreview && <div className="rmm-bulk-patch-preview"><div className="stats"><span><small>Eligible</small><strong>{bulkPatchPreview.eligibleCount || 0}</strong></span><span><small>Ignored</small><strong>{bulkPatchPreview.ignoredCount || 0}</strong></span><span><small>Skipped</small><strong>{bulkPatchPreview.rejectedCount || 0}</strong></span></div><div className="items">{(bulkPatchPreview.items || []).map((item) => <span key={item.catalogueId}><strong>{item.applicationName}</strong><small>{item.installedVersion} → {item.targetVersion} · {item.provider}</small></span>)}</div><button className="rmm-primary" disabled={bulkPatchBusy || !bulkPatchCapabilityReady || !bulkPatchPreview.eligibleCount} onClick={executeBulkSoftwarePatch} type="button"><PackageCheck size={14} /> Patch {bulkPatchPreview.eligibleCount || 0} application{bulkPatchPreview.eligibleCount === 1 ? '' : 's'}</button></div>}
      </div>
      <div className="rmm-software-toolbar">
        <label className="search"><Search size={14} /><input value={softwareSearch} onChange={(event) => setSoftwareSearch(event.target.value)} placeholder="Search application, publisher, package ID, provider or version…" /></label>
        <select aria-label="Software state filter" value={softwareStateFilter} onChange={(event) => setSoftwareStateFilter(event.target.value)}><option value="all">All states</option><option value="updates">Updates / attention</option><option value="vulnerable">Vulnerable</option><option value="current">Current</option><option value="unmapped">Unmapped</option></select>
        <select aria-label="Software provider filter" value={softwareProviderFilter} onChange={(event) => setSoftwareProviderFilter(event.target.value)}><option value="all">All providers</option><option value="winget">WinGet</option><option value="managed">Hi5Central managed</option><option value="vendor">Vendor</option><option value="unmapped">Unmapped</option></select>
        <select aria-label="Software source filter" value={softwareSourceFilter} onChange={(event) => setSoftwareSourceFilter(event.target.value)}><option value="all">All sources</option>{softwareSourceOptions.map((source) => <option key={source} value={source}>{source.replaceAll('_', ' ')}</option>)}</select>
        <select aria-label="Software source health filter" value={softwareHealthFilter} onChange={(event) => setSoftwareHealthFilter(event.target.value)}><option value="all">All source health</option><option value="healthy">Healthy</option><option value="attention">Needs attention</option><option value="stale">Stale</option><option value="pending">Pending</option><option value="disabled">Disabled</option><option value="endpoint">Endpoint discovery</option><option value="unmonitored">Unmonitored</option></select>
        <select aria-label="Software qualification filter" value={softwareQualificationFilter} onChange={(event) => setSoftwareQualificationFilter(event.target.value)}><option value="all">All qualification</option><option value="qualified">Qualified</option><option value="qualified_limited">Qualified — limited</option><option value="deployment_candidate">Deployment candidate</option><option value="intelligence_only">Intelligence only</option><option value="blocked">Blocked</option><option value="unmapped">Unmapped</option></select>
        <select aria-label="Rows per page" value={softwarePageSize} onChange={(event) => setSoftwarePageSize(Number(event.target.value))}><option value={10}>10 / page</option><option value={25}>25 / page</option><option value={50}>50 / page</option><option value={100}>100 / page</option></select>
        <span className="summary">{filteredApplications.length} of {applications.length} applications</span>
      </div>
      <div className="rmm-patch-table software">
        <div className="head"><span>Application</span><span>Installed</span><span>Target</span><span>Patch state</span><span>Vulnerabilities</span><span>Provider</span><span /></div>
        {pagedApplications.map((application) => {
          const status = applicationPatchState(application)
          const exposure = exposureForApplication(application)
          const sourceState = applicationSourceState(application)
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
                  ? <StatusPill tone="healthy">Covered · none known</StatusPill>
                  : exposure.unresolvedIdentity > 0
                    ? <StatusPill tone="warning">Coverage unresolved</StatusPill>
                    : <StatusPill tone="running">Coverage pending</StatusPill>}
              <small>{[
                exposure.kev > 0 ? exposure.kev + ' CISA KEV' : exposure.maxCvss > 0 ? 'Max CVSS ' + exposure.maxCvss : '',
                application.catalogue && exposure.pending > 0
                  ? exposure.checked > 0
                    ? exposure.checked + ' checked · ' + exposure.pending + ' pending'
                    : exposure.unresolvedIdentity > 0
                      ? 'No validated vulnerability identity yet; zero is not asserted'
                      : 'Installed version awaiting vulnerability lookup'
                  : application.catalogue && exposure.checked > 0
                    ? 'Installed version assessed; zero means no applicable known vulnerabilities'
                    : '',
              ].filter(Boolean).join(' · ')}</small>
            </span>
            <span><strong>{application.catalogue?.provider || 'Unmapped'}</strong>{application.catalogue
              ? <><StatusPill tone={qualificationTone(application.catalogue.qualificationState)}>{qualificationLabel(application.catalogue.qualificationState)}</StatusPill><small>{application.catalogue.builtIn ? 'Hi5Central catalogue' : 'Tenant mapping'}{application.catalogue.qualificationVersion ? ' · tested ' + application.catalogue.qualificationVersion : ''}</small><small>{sourceState.type.replaceAll('_', ' ')} · source {sourceState.health.replaceAll('_', ' ')}</small></>
              : <small>Needs mapping</small>}</span>
            <span className="actions">{application.catalogue ? <>
              <button disabled={saving || application.updateAvailable < 1} onClick={() => setPatchApp(application)} type="button"><PackageCheck size={14} /> Patch</button>
              <button disabled={saving} onClick={() => setValidationApp(application)} type="button"><Wrench size={14} /> Edit</button>
              {application.catalogue.sourceKey && <button disabled={saving} onClick={() => revalidateApplication(application)} type="button"><RefreshCw size={14} /> Validate</button>}
              {application.catalogue.deploymentMode === 'vendor_direct' && !['qualified','qualified_limited'].includes(application.catalogue.qualificationState) && <button disabled={saving} onClick={() => retryApplicationQualification(application)} type="button"><ShieldCheck size={14} /> Retry</button>}
              {!application.catalogue.builtIn && <button aria-label={'Archive ' + application.name} disabled={saving} onClick={() => removeMapping(application)} type="button"><Trash2 size={14} /></button>}
            </> : <button disabled={saving} onClick={() => setMappingApp(application)} type="button"><Plus size={14} /> Map</button>}</span>
          </div>
        })}
      </div>
      {!!filteredApplications.length && <div className="rmm-software-pagination"><span>Showing {(safeSoftwarePage - 1) * softwarePageSize + 1}–{Math.min(safeSoftwarePage * softwarePageSize, filteredApplications.length)} of {filteredApplications.length}</span><div><button disabled={safeSoftwarePage <= 1} onClick={() => setSoftwarePage((page) => Math.max(1, page - 1))} type="button"><ChevronLeft size={14} /> Previous</button><strong>Page {safeSoftwarePage} of {softwarePageCount}</strong><button disabled={safeSoftwarePage >= softwarePageCount} onClick={() => setSoftwarePage((page) => Math.min(softwarePageCount, page + 1))} type="button">Next <ChevronRight size={14} /></button></div></div>}
      {!applications.length && <div className="rmm-empty"><Box size={24} /><strong>{loading ? 'Loading software inventory…' : 'No software inventory'}</strong><span>Patchability appears after an Agent reports installed applications.</span></div>}
      {!!applications.length && !filteredApplications.length && <div className="rmm-empty compact"><Search size={22} /><strong>No matching software</strong><span>Clear the search or filters to see the full software inventory.</span></div>}
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

    {tab === 'winget' && <section className="rmm-patch-panel">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Microsoft WinGet source</span><h2>Full WinGet repository</h2><p>{wingetLoading ? 'Refreshing repository index…' : (wingetRepository.total || 0) + ' packages available from the current WinGet community source index.'} This repository is searchable independently from the curated Hi5Central catalogue.</p></div></div>
      <div className="rmm-patch-security-banner inline"><PackageCheck size={18} /><div><strong>Repository ≠ automatic trust</strong><span>WinGet provides broad Windows package coverage. Hi5Central still keeps curated vendor sources and vulnerability identities separate, and only creates vulnerability exposures for software actually detected on an endpoint.</span></div><StatusPill tone="healthy">Live index</StatusPill></div>
      <div className="rmm-winget-toolbar">
        <label><Search size={14} /><input value={wingetQuery} onChange={(event) => setWingetQuery(event.target.value)} placeholder="Search all WinGet packages, IDs, monikers or publishers…" /></label>
        <select value={wingetPageSize} onChange={(event) => setWingetPageSize(Number(event.target.value))}><option value={25}>25 / page</option><option value={50}>50 / page</option><option value={100}>100 / page</option></select>
        <span>{wingetLoading ? 'Searching…' : (wingetRepository.total || 0) + ' matches'}</span>
      </div>
      <div className="rmm-patch-table winget-repository">
        <div className="head"><span>Application</span><span>Package ID</span><span>Latest version</span><span>Publisher</span></div>
        {(wingetRepository.packages || []).map((item) => <div className="row" key={item.id}>
          <span><strong>{item.name || item.id}</strong><small>{item.moniker || 'No moniker'}</small></span>
          <span><strong>{item.id}</strong><small>WinGet community source</small></span>
          <span><strong>{item.version || 'Unknown'}</strong></span>
          <span><strong>{item.publishers?.[0] || 'Not reported'}</strong><small>{item.publishers?.slice(1).join(' · ')}</small></span>
        </div>)}
      </div>
      {!wingetLoading && !(wingetRepository.packages || []).length && <div className="rmm-empty compact"><Search size={22} /><strong>No WinGet packages matched</strong><span>Try another application name, package ID or publisher.</span></div>}
      <div className="rmm-software-pagination"><span>Page {wingetRepository.page || wingetPage} of {wingetRepository.pages || 1}</span><div><button disabled={wingetLoading || Number(wingetRepository.page || wingetPage) <= 1} onClick={() => setWingetPage((page) => Math.max(1, page - 1))} type="button"><ChevronLeft size={14} /> Previous</button><strong>{wingetRepository.total || 0} packages</strong><button disabled={wingetLoading || Number(wingetRepository.page || wingetPage) >= Number(wingetRepository.pages || 1)} onClick={() => setWingetPage((page) => Math.min(Number(wingetRepository.pages || 1), page + 1))} type="button">Next <ChevronRight size={14} /></button></div></div>
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
      <div className="rmm-vendor-health-summary"><div><small>Sources</small><strong>{vendorHealth.total ?? vendorSources.length}</strong></div><div><small>Healthy</small><strong>{vendorHealth.healthy ?? 0}</strong></div><div><small>Needs attention</small><strong>{Number(vendorHealth.attention || 0) + Number(vendorHealth.stale || 0)}</strong></div><div><small>Unhealthy assets</small><strong>{vendorHealth.unhealthy_assets ?? 0}</strong></div><div><small>Awaiting asset check</small><strong>{vendorHealth.unknown_assets ?? 0}</strong></div></div>
      <div className="rmm-patch-security-banner inline"><RefreshCw size={18} /><div><strong>Automatic VPS qualification</strong><span>Hi5Central continuously discovers releases, checks deployment transports, probes vendor assets and promotes only artifacts that satisfy the trust gates. Items that fail cryptographic, signer or installer-technology checks stay non-deployable and appear in Manual review below.</span></div><StatusPill tone={vendorReview.length ? 'warning' : 'healthy'}>{vendorReview.length ? vendorReview.length + ' to review' : 'No failures'}</StatusPill></div>
      {!!vendorReadiness.length && <div className="rmm-patch-deployment-history"><div><span className="rmm-eyebrow">Readiness backlog</span><h3>Why software is not deployable yet</h3><p>This is the live automatic qualification backlog. Ecosystem packages remain useful for version and vulnerability intelligence without being treated as Windows installers.</p></div><div className="rmm-vendor-health-summary"><div><small>Automation backlog</small><strong>{vendorBacklog.length}</strong></div><div><small>Intelligence only</small><strong>{vendorIntelligenceOnly.length}</strong></div><div><small>Missing Windows asset</small><strong>{vendorReadinessCounts.vendor_windows_asset_missing || 0}</strong></div><div><small>Target missing</small><strong>{vendorReadinessCounts.target_version_missing || 0}</strong></div></div><div className="rmm-patch-table deployments"><div className="head"><span>Application</span><span>Target</span><span>Source</span><span>Platform</span><span>Blocker</span></div>{vendorReadiness.slice(0, 80).map((item) => <div className="row" key={'readiness:' + item.id + ':' + item.source_key}><span><strong>{item.canonical_name}</strong><small>{item.state.replaceAll('_', ' ')}</small></span><span><strong>{item.target_version || 'Not resolved'}</strong><small>{item.trust_state.replaceAll('_', ' ')}</small></span><span><strong>{item.registry || item.source_key?.replaceAll('_', ' ') || 'Inventory-derived'}</strong><small>{item.winget_package_id || 'No verified fallback'}</small></span><span><strong>{item.platform || 'Inventory'}</strong><small>{item.architecture || '—'}</small></span><span><StatusPill tone={item.state === 'manual_review' ? 'critical' : item.state === 'intelligence_only' ? 'neutral' : 'warning'}>{item.blocker.replaceAll('_', ' ')}</StatusPill></span></div>)}</div></div>}
      {!!vendorReview.length && <div className="rmm-patch-deployment-history"><div><span className="rmm-eyebrow">Manual review</span><h3>Automatic qualification failures</h3><p>These releases remain intelligence-only. Review the evidence before changing a source or trust rule; Hi5Central will not deploy them automatically.</p></div><div className="rmm-vendor-health-summary"><div><small>Rejected</small><strong>{vendorReviewCounts.rejected || 0}</strong></div><div><small>Signer review</small><strong>{vendorReviewCounts.signer_review_required || 0}</strong></div><div><small>Installer review</small><strong>{vendorReviewCounts.installer_review_required || 0}</strong></div></div><div className="rmm-patch-table deployments"><div className="head"><span>Application</span><span>Version</span><span>Source</span><span>Installer</span><span>Review state</span></div>{vendorReview.map((item) => <div className="row" key={'review:' + item.source_key + ':' + item.provider_package_id}><span><strong>{item.canonical_name}</strong><small>{item.publisher || item.provider_package_id}</small></span><span><strong>{item.version}</strong><small>{item.channel} · {item.architecture}</small></span><span><strong>{item.source_key.replaceAll('_', ' ')}</strong><small>{item.release_date ? new Date(item.release_date).toLocaleDateString() : 'Current release'}</small></span><span><strong>{item.installer_type ? item.installer_type.toUpperCase() : 'Unknown'}</strong><small>{item.installer_sha256 ? 'SHA-256 recorded' : 'No published SHA-256'}</small></span><span><StatusPill tone={item.trust_state === 'rejected' ? 'critical' : 'warning'}>{item.trust_state.replaceAll('_', ' ')}</StatusPill><small>{item.trust_evidence?.reason || item.asset_health_error || 'Trust evidence requires review'}</small></span></div>)}</div></div>}
      {!!vendorSourceHealth.length && <div className="rmm-patch-table source-health"><div className="head"><span>Source health</span><span>State</span><span>Releases</span><span>Assets</span><span>Last success</span></div>{vendorSourceHealth.map((item) => <div className="row" key={item.source_key}><span><strong>{item.display_name}</strong><small>{item.records_seen} records observed</small></span><span><StatusPill tone={item.state === 'healthy' ? 'healthy' : item.state === 'pending' ? 'neutral' : 'warning'}>{item.state}</StatusPill><small>{item.last_error || (item.stale ? 'Feed is older than its freshness window' : '')}</small></span><span><strong>{item.release_count}</strong></span><span><strong>{item.healthy_assets} healthy</strong><small>{item.unhealthy_assets} unhealthy · {item.unknown_assets} awaiting check</small></span><span><strong>{item.last_success_at ? new Date(item.last_success_at).toLocaleString() : 'Pending'}</strong></span></div>)}</div>}
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

    {typeof document !== 'undefined' && createPortal(
      <div className="rmm-patch-portal-theme" style={rmmPortalThemeStyle()}>
        {mappingApp && <MappingModal application={mappingApp} onClose={() => setMappingApp(null)} onSave={saveMapping} />}
        {validationApp && <SoftwareValidationModal application={validationApp} source={validationSource} saving={saving} onClose={() => setValidationApp(null)} onSave={saveSoftwareValidation} />}
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
      </div>,
      document.body,
    )}
  </>
}
