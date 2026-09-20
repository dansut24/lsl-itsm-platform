import { hasPermission } from './access.js'
import { originMatchesTenant } from './deploymentConfig.js'
import { pool, withTransaction } from './db.js'
import { agentSocketForDevice, authenticateAgent, sendAgentMessage } from './rmmAgent.js'
import { recordRmmActivity } from './rmmActivity.js'
import { recentVulnerabilities, vulnerabilitySummary } from './rmmVulnerabilityIntel.js'
import { softwareVendorSummary } from './rmmSoftwareVendorIntel.js'
import {
  approveTenantVendorSource,
  archiveTenantVendorSource,
  createTenantVendorSource,
  listTenantVendorSources,
  tenantVendorVerificationRecommendation,
  testTenantVendorSource,
  updateTenantVendorSource,
} from './rmmTenantVendorSources.js'
import { vulnerabilityExposureByInstallation, vulnerabilityExposureRows, vulnerabilityExposureSummary } from './rmmVulnerabilityExposure.js'
import { resolveSession } from './session.js'

function clean(value = '') { return String(value ?? '').trim() }
function lower(value = '') { return clean(value).toLowerCase() }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {} }
function array(value) { return Array.isArray(value) ? value : [] }
function contains(value, pattern) { return !clean(pattern) || lower(value).includes(lower(pattern)) }

async function requirePatchAccess(c, mode = 'view') {
  const session = await resolveSession(c)
  if (!session) return { error: c.json({ error: 'Authentication required.' }, 401) }
  if (!originMatchesTenant(c.req.header('origin'), session.slug)) {
    return { error: c.json({ error: 'Tenant session mismatch.' }, 403) }
  }
  const permissions = mode === 'software'
    ? ['rmm.software.manage']
    : mode === 'policy'
      ? ['rmm.policies.manage']
      : ['rmm.devices.view', 'rmm.policies.view', 'rmm.policies.manage', 'rmm.software.manage']
  if (!permissions.some((permission) => hasPermission(session.access, permission))) {
    return { error: c.json({ error: 'You do not have permission to access patching.' }, 403) }
  }
  return { session }
}
async function audit(session, eventType, summary, detail = '', metadata = {}) {
  return recordRmmActivity({
    tenantId: session.tenant_id,
    actorUserId: session.user_id,
    actorType: 'technician',
    actorLabel: session.name || session.email || 'Technician',
    eventType,
    category: 'patching',
    summary,
    detail,
    outcome: 'success',
    metadata,
  }).catch(() => null)
}

function psSingleQuote(value = '') {
  return "'" + clean(value).replaceAll("'", "''") + "'"
}

function safeVerificationFilePath(value = '') {
  const filePath = clean(value)
  return Boolean(filePath
    && /^(?:[A-Za-z]:\\|%ProgramFiles%\\|%ProgramFiles\(x86\)%\\|%ProgramData%\\)/i.test(filePath)
    && !filePath.includes('..')
    && !/["\r\n]/.test(filePath)
    && /\.(?:exe|dll)$/i.test(filePath))
}

function fileVersionProbeScript(filePath) {
  return [
    "$ErrorActionPreference = 'Stop'",
    '$path = [Environment]::ExpandEnvironmentVariables(' + psSingleQuote(filePath) + ')',
    "if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw ('Verification file was not found: ' + $path) }",
    '$info = (Get-Item -LiteralPath $path).VersionInfo',
    '[pscustomobject]@{',
    "  status = 'ok'",
    '  path = $path',
    '  file_version = [string]$info.FileVersion',
    '  product_version = [string]$info.ProductVersion',
    '  file_description = [string]$info.FileDescription',
    '  product_name = [string]$info.ProductName',
    '  original_filename = [string]$info.OriginalFilename',
    '} | ConvertTo-Json -Compress',
  ].join('\n')
}

export async function queueVendorVerificationProbe({ tenantId, userId = null, actorLabel = 'Technician', initiatedBy = 'technician', sourceId, agentDeviceId = '' }) {
  const selected = await pool.query(
    `SELECT s.id AS source_id,s.display_name,s.status,s.verification_config,
            a.id AS agent_device_id,a.inventory_id,a.websocket_status,a.last_telemetry_at,
            i.name AS device_name,i.reference AS device_reference
       FROM rmm_tenant_vendor_sources s
       JOIN rmm_agent_devices a ON a.tenant_id=s.tenant_id AND a.disabled_at IS NULL
       JOIN rmm_device_inventory i ON i.id=a.inventory_id AND i.active=true
      WHERE s.tenant_id=$1 AND s.id=$2 AND s.status IN ('tested','active')
        AND (
          ($3<>'' AND a.id::text=$3)
          OR
          ($3='' AND EXISTS (
            SELECT 1
              FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(i.source_payload->'software'->'items')='array'
                  THEN i.source_payload->'software'->'items'
                  ELSE '[]'::jsonb END
              ) item
             WHERE lower(COALESCE(item->>'name','')) LIKE '%' || lower(COALESCE(NULLIF(s.name_pattern,''),s.canonical_name)) || '%'
               AND (
                 COALESCE(NULLIF(s.publisher_pattern,''),s.publisher,'')=''
                 OR lower(COALESCE(item->>'publisher','')) LIKE '%' || lower(COALESCE(NULLIF(s.publisher_pattern,''),s.publisher)) || '%'
               )
          ))
        )
      ORDER BY
        (a.websocket_status='Connected' AND a.last_telemetry_at > now()-interval '90 seconds') DESC,
        a.last_telemetry_at DESC NULLS LAST
      LIMIT 1`,
    [tenantId, sourceId, clean(agentDeviceId)],
  )
  const row = selected.rows[0]
  if (!row) return { error: 'Vendor source or managed endpoint was not found.', status: 404 }

  const verification = object(row.verification_config)
  const filePath = clean(verification.filePath)
  if (!safeVerificationFilePath(filePath)) {
    return { error: 'The configured verification file path is not allowed.', status: 409 }
  }
  const telemetryFresh = row.last_telemetry_at && Date.now() - new Date(row.last_telemetry_at).getTime() <= 90_000
  if (row.websocket_status !== 'Connected' || !telemetryFresh) {
    return { error: 'This device is offline. No verification probe was queued.', status: 409, offline: true }
  }

  const existing = await pool.query(
    `SELECT id,status FROM rmm_agent_jobs
      WHERE tenant_id=$1 AND agent_device_id=$2 AND job_type='custom.command'
        AND request_metadata->>'source'='vendor_verification_probe'
        AND request_metadata->>'vendor_source_id'=$3
        AND status IN ('queued','claimed')
      ORDER BY created_at DESC LIMIT 1`,
    [tenantId, row.agent_device_id, sourceId],
  )
  if (existing.rowCount) return { error: 'A verification probe is already running for this source and device.', status: 409, jobId: existing.rows[0].id }

  const command = fileVersionProbeScript(filePath)
  const inserted = await pool.query(
    `INSERT INTO rmm_agent_jobs
      (tenant_id,agent_device_id,job_type,payload,queued_by_user_id,initiated_by,initiated_by_label,request_metadata)
     VALUES ($1,$2,'custom.command',$3::jsonb,$4,$5,$6,$7::jsonb)
     RETURNING id,status,created_at`,
    [
      tenantId,
      row.agent_device_id,
      JSON.stringify({ command, timeout_seconds: 30 }),
      userId,
      ['system','technician'].includes(clean(initiatedBy)) ? clean(initiatedBy) : 'technician',
      clean(actorLabel || 'Technician').slice(0, 255),
      JSON.stringify({
        source: 'vendor_verification_probe',
        vendor_source_id: sourceId,
        verification_method: 'file_version',
        verification_file_path: filePath,
        device_name: row.device_name,
        device_reference: row.device_reference,
      }),
    ],
  )
  await recordRmmActivity({
    tenantId,
    agentDeviceId: row.agent_device_id,
    inventoryId: row.inventory_id,
    actorUserId: userId,
    actorType: clean(initiatedBy) === 'system' ? 'system' : 'technician',
    actorLabel: clean(actorLabel || 'Technician').slice(0, 255),
    eventType: 'patch.vendor_verification_probe.requested',
    category: 'patching',
    summary: clean(actorLabel || 'Technician') + ' started vendor verification probe “' + row.display_name + '”',
    detail: 'Read-only file VERSIONINFO probe · ' + filePath,
    outcome: 'requested',
    jobId: inserted.rows[0].id,
    metadata: { sourceId, method: 'file_version', filePath },
  }).catch(() => null)
  return { success: true, job: inserted.rows[0], filePath, deviceName: row.device_name }
}

async function queueAutomaticVendorVerificationProbes(tenantId) {
  const candidates = await pool.query(
    `SELECT s.id
       FROM rmm_tenant_vendor_sources s
      WHERE s.tenant_id=$1
        AND s.status IN ('tested','active')
        AND COALESCE(s.verification_config->>'filePath','')<>''
        AND EXISTS (
          SELECT 1
            FROM rmm_agent_devices a
            JOIN rmm_device_inventory i ON i.id=a.inventory_id AND i.active=true
           WHERE a.tenant_id=s.tenant_id
             AND a.disabled_at IS NULL
             AND a.websocket_status='Connected'
             AND a.last_telemetry_at > now()-interval '90 seconds'
             AND EXISTS (
               SELECT 1
                 FROM jsonb_array_elements(
                   CASE WHEN jsonb_typeof(i.source_payload->'software'->'items')='array'
                     THEN i.source_payload->'software'->'items'
                     ELSE '[]'::jsonb END
                 ) item
                WHERE lower(COALESCE(item->>'name','')) LIKE '%' || lower(COALESCE(NULLIF(s.name_pattern,''),s.canonical_name)) || '%'
                  AND (
                    COALESCE(NULLIF(s.publisher_pattern,''),s.publisher,'')=''
                    OR lower(COALESCE(item->>'publisher','')) LIKE '%' || lower(COALESCE(NULLIF(s.publisher_pattern,''),s.publisher)) || '%'
                  )
             )
        )
        AND NOT EXISTS (
          SELECT 1
            FROM rmm_agent_jobs j
           WHERE j.tenant_id=s.tenant_id
             AND j.job_type='custom.command'
             AND j.request_metadata->>'source'='vendor_verification_probe'
             AND j.request_metadata->>'vendor_source_id'=s.id::text
             AND j.request_metadata->>'verification_file_path'=s.verification_config->>'filePath'
             AND j.status IN ('queued','claimed','completed','failed')
        )
      ORDER BY s.updated_at
      LIMIT 5`,
    [tenantId],
  )
  const queued = []
  for (const candidate of candidates.rows) {
    const result = await queueVendorVerificationProbe({
      tenantId,
      sourceId: candidate.id,
      actorLabel: 'SYSTEM',
      initiatedBy: 'system',
    })
    if (result?.success) queued.push({ sourceId: candidate.id, jobId: result.job?.id, deviceName: result.deviceName })
  }
  return queued
}

function versionParts(value) {
  const matches = clean(value).match(/\d+/g)
  if (!matches?.length) return null
  return matches.map((part) => Number(part))
}

function compareVersions(installed, target) {
  const installedText = clean(installed)
  const targetText = clean(target)
  const left = versionParts(installedText)
  const right = versionParts(targetText)
  if (!left || !right) return null
  const size = Math.max(left.length, right.length)
  for (let index = 0; index < size; index += 1) {
    const a = left[index] || 0
    const b = right[index] || 0
    if (a < b) return -1
    if (a > b) return 1
  }

  // WinGet can report an installed version as "< X" when the exact installed
  // version is not known but is known to be lower than the available package.
  // Preserve that ordering instead of flattening both values to the same digits.
  if (/^\s*</.test(installedText) && !/^\s*<=/.test(installedText)) return -1
  if (/^\s*>/.test(installedText) && !/^\s*>=/.test(installedText)) return 1

  return 0
}
async function patchDeviceRows(tenantId) {
  const result = await pool.query(
    `SELECT i.id AS inventory_id,i.reference,i.name,i.source_payload,
            a.id AS agent_device_id,a.agent_version,a.websocket_status,a.last_telemetry_at,
            a.patch_capabilities,a.patch_capabilities_at,a.patch_discovery_at,
            p.name AS assigned_person_name,p.email AS assigned_person_email,
            s.external_key AS site_id,s.name AS site_name,
            CASE WHEN a.websocket_status='Connected' AND a.last_telemetry_at>now()-interval '90 seconds'
                 THEN true ELSE false END AS online
       FROM rmm_agent_devices a
       JOIN rmm_device_inventory i ON i.id=a.inventory_id AND i.active=true
       LEFT JOIN organisation_people p ON p.tenant_id=i.tenant_id AND p.id=i.assigned_person_id
       LEFT JOIN organisation_sites s ON s.tenant_id=i.tenant_id AND s.id=p.site_id
      WHERE a.tenant_id=$1 AND a.disabled_at IS NULL
      ORDER BY i.name`,
    [tenantId],
  )
  return result.rows
}

async function catalogueRows(tenantId) {
  const result = await pool.query(
    `SELECT id,tenant_id,canonical_name,publisher,name_pattern,publisher_pattern,platform,provider,
            provider_package_id,target_version,release_channel,installer_type,detection,execution,verification,status,
            catalogue_source,external_key,source_metadata,created_at,updated_at
       FROM rmm_software_catalogue
      WHERE status<>'archived' AND (tenant_id=$1 OR tenant_id IS NULL)
      ORDER BY tenant_id NULLS FIRST,lower(canonical_name)`,
    [tenantId],
  )
  return result.rows
}
async function patchDiscoveryRows(tenantId) {
  const [observations, candidates] = await Promise.all([
    pool.query(
      `SELECT o.inventory_id,o.application_name,o.display_name,o.publisher,o.installed_version,
              o.provider,o.provider_package_id,o.available_version,o.patch_status,o.evidence,o.source_name,
              o.discovery_method,o.match_confidence,o.observed_at,
              i.reference AS device_reference,i.name AS device_name
         FROM rmm_software_patch_observations o
         JOIN rmm_device_inventory i ON i.id=o.inventory_id
        WHERE o.tenant_id=$1
        ORDER BY o.patch_status='update_available' DESC,lower(o.application_name),lower(i.name)`,
      [tenantId],
    ),
    pool.query(
      `SELECT id,provider,provider_package_id,display_name,publisher,latest_observed_version,
              devices_seen,updates_seen,first_seen_at,last_seen_at,state,metadata
         FROM rmm_patch_catalogue_candidates
        WHERE tenant_id=$1
        ORDER BY updates_seen DESC,devices_seen DESC,lower(display_name),lower(provider_package_id)`,
      [tenantId],
    ),
  ])
  return { observations: observations.rows, candidates: candidates.rows }
}

async function policyRows(tenantId) {
  const result = await pool.query(
    `SELECT id,name,description,software_enabled,windows_enabled,approval_mode,deployment_delay_days,
            maintenance_window,reboot_policy,max_retries,software_rules,windows_rules,status,created_at,updated_at
       FROM rmm_patch_policies
      WHERE tenant_id=$1 AND status<>'archived'
      ORDER BY lower(name)`,
    [tenantId],
  )
  return result.rows
}

async function assignmentRows(tenantId) {
  const result = await pool.query(
    `SELECT id,policy_id,scope_type,scope_id,scope_name,priority,enabled,created_at,updated_at
       FROM rmm_patch_assignments
      WHERE tenant_id=$1
      ORDER BY priority DESC,created_at`,
    [tenantId],
  )
  return result.rows
}

function catalogueMatch(app, catalogue) {
  const candidates = catalogue.filter((entry) => (
    entry.status === 'active'
    && contains(app.name, entry.name_pattern)
    && contains(app.publisher, entry.publisher_pattern)
  ))
  return candidates.sort((a, b) => {
    const tenantWeight = Number(Boolean(b.tenant_id)) - Number(Boolean(a.tenant_id))
    if (tenantWeight) return tenantWeight
    const sourceWeight = (entry) => {
      if (entry.catalogue_source === 'tenant_vendor') return 30
      if (entry.catalogue_source === 'patchhost') return 10
      return 20
    }
    const sourceDelta = sourceWeight(b) - sourceWeight(a)
    if (sourceDelta) return sourceDelta
    const patternDelta = clean(b.name_pattern).length - clean(a.name_pattern).length
    if (patternDelta) return patternDelta
    return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
  })[0] || null
}
function classifyInstallation(app, catalogue) {
  const match = catalogueMatch(app, catalogue)
  if (!match) return { patchStatus: 'unmapped', catalogue: null, targetVersion: '' }
  const targetVersion = clean(match.target_version)
  if (!targetVersion) return { patchStatus: 'detection_pending', catalogue: match, targetVersion: '' }
  const comparison = compareVersions(app.version, targetVersion)
  if (comparison == null) return { patchStatus: 'detection_pending', catalogue: match, targetVersion }
  return {
    patchStatus: comparison < 0 ? 'update_available' : 'current',
    catalogue: match,
    targetVersion,
  }
}

function targetProductCodeInstalled(items, catalogue) {
  const verification = object(catalogue?.verification)
  if (clean(verification.method) !== 'uninstall_registry') return false
  const productCode = lower(verification.productCode)
  const targetVersion = clean(catalogue?.target_version)
  if (!productCode || !targetVersion) return false
  return items.some((item) => lower(item?.registry_key) === productCode
    && (compareVersions(clean(item?.version), targetVersion) ?? -1) >= 0)
}

function softwareItems(row) {
  return array(object(object(row.source_payload).software).items)
    .filter((item) => clean(item?.name))
}

function appIdentity(app) {
  return lower(app.name) + '|' + lower(app.publisher)
}

function publicCatalogue(entry) {
  if (!entry) return null
  const sourceMetadata = object(entry.source_metadata)
  const deploymentMode = clean(sourceMetadata.deploymentMode)
  const wingetPackageId = clean(sourceMetadata.wingetPackageId || (entry.provider === 'winget' ? entry.provider_package_id : ''))
  const installable = Boolean(
    clean(entry.target_version)
    && sourceMetadata.sourceEnabled !== false
    && (
      (deploymentMode === 'winget_preferred' && wingetPackageId)
      || deploymentMode === 'vendor_direct'
      || (entry.provider === 'winget' && clean(entry.provider_package_id))
    )
  )
  return {
    id: entry.id,
    builtIn: !entry.tenant_id,
    canonicalName: entry.canonical_name,
    publisher: entry.publisher,
    namePattern: entry.name_pattern,
    publisherPattern: entry.publisher_pattern,
    provider: entry.provider,
    packageId: entry.provider_package_id,
    executionPackageId: wingetPackageId,
    targetVersion: entry.target_version,
    releaseChannel: entry.release_channel,
    installerType: entry.installer_type,
    deploymentMode,
    installable,
    status: entry.status,
    catalogueSource: clean(entry.catalogue_source),
  }
}
async function vulnerabilityHydrationRows(deviceSoftware = []) {
  const mapped = deviceSoftware.filter((item) => item.catalogue?.id)
  const catalogueIds = [...new Set(mapped.map((item) => item.catalogue.id))]
  if (!catalogueIds.length) return []

  const result = await pool.query(
    `SELECT DISTINCT ON (catalogue_id)
            catalogue_id,vendor,product,cpe,confidence,metadata,updated_at
       FROM rmm_software_vulnerability_identities
      WHERE source='nvd' AND enabled=true AND catalogue_id=ANY($1::uuid[])
      ORDER BY catalogue_id,updated_at DESC`,
    [catalogueIds],
  )
  const identities = new Map(result.rows.map((row) => [row.catalogue_id, row]))
  const hydration = new Map()

  for (const item of mapped) {
    const catalogueId = item.catalogue.id
    const version = clean(item.installedVersion)
    const key = [item.inventoryId, catalogueId, version].join('|')
    if (hydration.has(key)) continue

    const identity = identities.get(catalogueId)
    const metadata = object(identity?.metadata)
    const hydratedVersions = new Set(array(metadata.hydratedVersions).map(clean).filter(Boolean))
    const versionResult = object(object(metadata.versionResults)[version])
    const checked = Boolean(version && hydratedVersions.has(version))

    hydration.set(key, {
      inventory_id: item.inventoryId,
      catalogue_id: catalogueId,
      application_name: item.name,
      installed_version: version,
      status: checked ? 'checked' : identity ? 'pending_version' : 'pending_identity',
      checked,
      applicable_cves: checked ? Number(versionResult.applicableCves || 0) : null,
      family_total: checked ? Number(versionResult.familyTotal || 0) : null,
      checked_at: checked ? clean(versionResult.hydratedAt || metadata.hydratedAt) : '',
      nvd_vendor: clean(identity?.vendor),
      nvd_product: clean(identity?.product),
      nvd_cpe: clean(identity?.cpe),
    })
  }

  return [...hydration.values()]
}

function buildSoftware(devices, catalogue, observations = []) {
  const applications = new Map()
  const deviceSoftware = []
  const observationMap = new Map(
    observations.map((item) => [
      item.inventory_id + '|' + lower(item.provider_package_id),
      item,
    ]),
  )
  for (const device of devices) {
    const items = softwareItems(device)
    for (const app of items) {
      const state = classifyInstallation(app, catalogue)
      if (state.catalogue && targetProductCodeInstalled(items, state.catalogue)) {
        const verification = object(state.catalogue.verification)
        const targetCode = lower(verification.productCode)
        const appCode = lower(app?.registry_key)
        const comparison = compareVersions(clean(app?.version), state.targetVersion)
        state.patchStatus = appCode === targetCode || (comparison != null && comparison >= 0)
          ? 'current'
          : 'older_version_present'
      }
      const observation = state.catalogue?.provider_package_id
        ? observationMap.get(device.inventory_id + '|' + lower(state.catalogue.provider_package_id))
        : null
      if (state.patchStatus === 'update_available' && observation?.patch_status === 'provider_blocked') {
        state.patchStatus = 'provider_blocked'
      }
      const key = appIdentity(app)
      const row = {
        key,
        deviceId: device.reference,
        inventoryId: device.inventory_id,
        agentDeviceId: device.agent_device_id,
        deviceName: device.name,
        online: device.online,
        name: clean(app.name),
        publisher: clean(app.publisher),
        installedVersion: clean(app.version),
        scope: clean(app.scope),
        registryKey: clean(app.registry_key),
        patchStatus: state.patchStatus,
        targetVersion: state.targetVersion,
        providerBlockedReason: state.patchStatus === 'provider_blocked'
          ? clean(object(observation?.evidence).providerBlockedDetail || object(observation?.evidence).providerBlockedReason)
          : '',
        catalogue: publicCatalogue(state.catalogue),
      }
      deviceSoftware.push(row)
      const grouped = applications.get(key) || {
        key,
        name: row.catalogue?.canonicalName || row.name,
        publisher: row.catalogue?.publisher || row.publisher,
        installs: 0,
        deviceIds: new Set(),
        versions: new Map(),
        updateAvailable: 0,
        providerBlocked: 0,
        olderVersionPresent: 0,
        current: 0,
        detectionPending: 0,
        unmapped: 0,
        catalogue: row.catalogue,
      }
      grouped.installs += 1
      grouped.deviceIds.add(row.deviceId)
      grouped.versions.set(row.installedVersion || 'Not reported', (grouped.versions.get(row.installedVersion || 'Not reported') || 0) + 1)
      if (state.patchStatus === 'update_available') grouped.updateAvailable += 1
      else if (state.patchStatus === 'provider_blocked') grouped.providerBlocked += 1
      else if (state.patchStatus === 'older_version_present') grouped.olderVersionPresent += 1
      else if (state.patchStatus === 'current') grouped.current += 1
      else if (state.patchStatus === 'detection_pending') grouped.detectionPending += 1
      else grouped.unmapped += 1
      applications.set(key, grouped)
    }
  }
  return {
    applications: [...applications.values()].map((item) => ({
      ...item,
      deviceCount: item.deviceIds.size,
      deviceIds: [...item.deviceIds],
      versions: [...item.versions.entries()]
        .map(([version, count]) => ({ version, count }))
        .sort((a, b) => compareVersions(a.version, b.version) ?? a.version.localeCompare(b.version)),
    })).sort((a, b) => a.name.localeCompare(b.name)),
    deviceSoftware,
  }
}

async function reconcileTerminalPatchDeployments(tenantId) {
  await pool.query(
    `UPDATE rmm_patch_deployments d
        SET status=CASE
              WHEN j.status='completed'
                AND lower(COALESCE(j.result->>'rebootRequired',j.result->>'reboot_required','false'))='true'
                THEN 'reboot_required'
              WHEN j.status='completed' THEN 'succeeded'
              WHEN j.status='cancelled' THEN 'cancelled'
              WHEN j.status='failed'
                AND lower(COALESCE(j.result->>'verificationFailed',j.result->>'verification_failed','false'))='true'
                THEN 'verification_failed'
              ELSE 'failed'
            END,
            result=COALESCE(j.result,'{}'::jsonb),
            completed_at=COALESCE(d.completed_at,j.completed_at,now()),
            updated_at=now()
       FROM rmm_agent_jobs j
      WHERE d.tenant_id=$1
        AND d.agent_job_id=j.id
        AND d.status IN ('eligible','running')
        AND j.status IN ('completed','failed','cancelled')`,
    [tenantId],
  )
}

async function reconcileVendorProductCodeDeployments(tenantId) {
  const result = await pool.query(
    `SELECT d.id,d.agent_job_id,d.inventory_id,d.application_name,d.installed_version,d.target_version,d.provider,
            c.verification,i.source_payload,
            COALESCE(NULLIF(j.initiated_by_label,''),'Technician') AS actor_label
       FROM rmm_patch_deployments d
       JOIN rmm_software_catalogue c ON c.id=d.catalogue_id
       JOIN rmm_device_inventory i ON i.id=d.inventory_id
       LEFT JOIN rmm_agent_jobs j ON j.id=d.agent_job_id
      WHERE d.tenant_id=$1
        AND d.status='verification_failed'
        AND d.provider='vendor_direct'
        AND COALESCE(c.verification->>'method','')='uninstall_registry'
        AND COALESCE(c.verification->>'productCode','')<>''
        AND d.completed_at>now()-interval '24 hours'
      ORDER BY d.created_at DESC`,
    [tenantId],
  )

  for (const deployment of result.rows) {
    if (!targetProductCodeInstalled(
      softwareItems({ source_payload: deployment.source_payload }),
      { verification: deployment.verification, target_version: deployment.target_version },
    )) continue

    const reconciliation = {
      success: true,
      verificationPassed: true,
      verificationFailed: false,
      lateVerification: true,
      lateVerifiedVersion: clean(deployment.target_version),
      lateVerifiedAt: new Date().toISOString(),
      reconciliationSource: 'target_product_code_inventory',
      targetProductCode: clean(object(deployment.verification).productCode),
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE rmm_patch_deployments
            SET status='succeeded',
                result=(result - 'error') || $3::jsonb,
                updated_at=now()
          WHERE tenant_id=$1 AND id=$2 AND status='verification_failed'`,
        [tenantId, deployment.id, JSON.stringify(reconciliation)],
      )
      if (deployment.agent_job_id) {
        await client.query(
          `UPDATE rmm_agent_jobs
              SET status='completed',
                  result=(result - 'error') || $3::jsonb,
                  error_message=NULL,
                  updated_at=now()
            WHERE tenant_id=$1 AND id=$2 AND status='failed'`,
          [tenantId, deployment.agent_job_id, JSON.stringify(reconciliation)],
        )
        await client.query(
          `UPDATE rmm_activity_events
              SET outcome='success',
                  severity='info',
                  summary=$3,
                  detail=$4,
                  metadata=metadata || $5::jsonb
            WHERE tenant_id=$1 AND job_id=$2 AND event_type='patch.software'`,
          [
            tenantId,
            deployment.agent_job_id,
            deployment.actor_label + ' patched “' + deployment.application_name + '”',
            [
              clean(deployment.installed_version) && clean(deployment.target_version)
                ? clean(deployment.installed_version) + ' → ' + clean(deployment.target_version)
                : '',
              'Provider: vendor_direct',
              'Verified by target MSI ProductCode after inventory refresh',
              'Job successful · See details',
            ].filter(Boolean).join(' · '),
            JSON.stringify(reconciliation),
          ],
        )
      }
    })
  }
}

async function patchBundle(tenantId) {
  await reconcileTerminalPatchDeployments(tenantId)
  await reconcileVendorProductCodeDeployments(tenantId)
  const [devices, catalogue, policies, assignments, vulnerabilities, discovery, vendorIntel, tenantVendorSources, exposureSummary, softwareVulnerabilityExposures, vulnerabilityExposureRowsData, deployments] = await Promise.all([
    patchDeviceRows(tenantId),
    catalogueRows(tenantId),
    policyRows(tenantId),
    assignmentRows(tenantId),
    vulnerabilitySummary(),
    patchDiscoveryRows(tenantId),
    softwareVendorSummary(),
    listTenantVendorSources(tenantId),
    vulnerabilityExposureSummary(tenantId),
    vulnerabilityExposureByInstallation(tenantId),
    vulnerabilityExposureRows(tenantId, 250),
    patchDeploymentRows(tenantId),
  ])
  const software = buildSoftware(devices, catalogue, discovery.observations)
  const vulnerabilityHydration = await vulnerabilityHydrationRows(software.deviceSoftware)
  const updateAvailable = software.deviceSoftware.filter((item) => item.patchStatus === 'update_available').length
  const mapped = software.deviceSoftware.filter((item) => item.catalogue).length
  return {
    overview: {
      agentDevices: devices.length,
      softwareInstallations: software.deviceSoftware.length,
      mappedInstallations: mapped,
      updateAvailable,
      unmappedInstallations: software.deviceSoftware.length - mapped,
      autoDiscoveredPackages: discovery.candidates.length,
      autoDiscoveredUpdates: discovery.observations.filter((item) => item.patch_status === 'update_available').length,
    },
    catalogue: catalogue.map(publicCatalogue),
    catalogueCandidates: discovery.candidates,
    patchObservations: discovery.observations,
    applications: software.applications,
    deviceSoftware: software.deviceSoftware,
    policies,
    assignments,
    deployments,
    vulnerabilities,
    vulnerabilityExposures: exposureSummary,
    softwareVulnerabilityExposures,
    vulnerabilityHydration,
    vulnerabilityExposureRows: vulnerabilityExposureRowsData,
    vendorIntel: { ...vendorIntel, tenantSources: tenantVendorSources },
    devices: devices.map((device) => ({
      id: device.reference,
      inventoryId: device.inventory_id,
      agentDeviceId: device.agent_device_id,
      name: device.name,
      online: device.online,
      siteId: device.site_id || '',
      site: device.site_name || '',
      agentVersion: device.agent_version || '',
      patchCapabilities: object(device.patch_capabilities),
      patchCapabilitiesAt: device.patch_capabilities_at,
      patchDiscoveryAt: device.patch_discovery_at,
    })),
  }
}
function normalizePatchDiscoveryPackage(value = {}) {
  const packageId = clean(value.packageId || value.id)
  if (!packageId || packageId.length > 240) return null
  const installedVersion = clean(value.installedVersion || value.version).slice(0, 120)
  const availableVersion = clean(value.availableVersion).slice(0, 120)
  const installedInstances = array(value.installedInstances)
    .map((version) => clean(version).slice(0, 120))
    .filter(Boolean)
    .slice(0, 50)
  return {
    packageId,
    name: clean(value.name || value.displayName || packageId).slice(0, 320),
    publisher: clean(value.publisher).slice(0, 240),
    installedVersion,
    installedInstances,
    availableVersion,
    source: clean(value.source || 'winget').slice(0, 80),
    scope: clean(value.scope).slice(0, 80),
    architecture: clean(value.architecture).slice(0, 80),
  }
}

async function reconcilePatchDeploymentFromDiscovery(client, agent, catalogueId, item, targetVersion) {
  if (!catalogueId || !targetVersion || compareVersions(item.installedVersion, targetVersion) < 0) return null

  const result = await client.query(
    `SELECT d.id,d.agent_job_id,d.application_name,d.installed_version,d.target_version,d.provider,
            COALESCE(NULLIF(j.initiated_by_label,''),'Technician') AS actor_label
       FROM rmm_patch_deployments d
       LEFT JOIN rmm_agent_jobs j ON j.id=d.agent_job_id
      WHERE d.tenant_id=$1 AND d.inventory_id=$2 AND d.catalogue_id=$3
        AND d.target_version=$4
        AND d.provider='winget'
        AND d.status='verification_failed'
        AND COALESCE(d.result->>'error','')='target_version_not_verified'
        AND d.completed_at>now()-interval '6 hours'
      ORDER BY d.created_at DESC
      LIMIT 1
      FOR UPDATE OF d`,
    [agent.tenant_id, agent.inventory_id, catalogueId, targetVersion],
  )
  const deployment = result.rows[0]
  if (!deployment) return null

  const reconciliation = {
    success: true,
    verificationPassed: true,
    verificationFailed: false,
    lateVerification: true,
    lateVerifiedVersion: item.installedVersion,
    lateVerifiedAt: new Date().toISOString(),
    reconciliationSource: 'patchhost_discovery',
  }

  await client.query(
    `UPDATE rmm_patch_deployments
        SET status='succeeded',
            result=(result - 'error') || $4::jsonb,
            updated_at=now()
      WHERE tenant_id=$1 AND inventory_id=$2 AND id=$3`,
    [agent.tenant_id, agent.inventory_id, deployment.id, JSON.stringify(reconciliation)],
  )
  await client.query(
    `UPDATE rmm_agent_jobs
        SET status='completed',
            result=(result - 'error') || $3::jsonb,
            error_message=NULL,
            updated_at=now()
      WHERE tenant_id=$1 AND id=$2`,
    [agent.tenant_id, deployment.agent_job_id, JSON.stringify(reconciliation)],
  )

  const detail = [
    clean(deployment.installed_version) && clean(deployment.target_version)
      ? clean(deployment.installed_version) + ' → ' + clean(deployment.target_version)
      : '',
    clean(deployment.provider) ? 'Provider: ' + clean(deployment.provider) : '',
    'Verified after inventory refresh',
    'Job successful · See details',
  ].filter(Boolean).join(' · ')

  await client.query(
    `UPDATE rmm_activity_events
        SET outcome='success',
            severity='info',
            summary=$3,
            detail=$4,
            metadata=metadata || $5::jsonb
      WHERE tenant_id=$1 AND job_id=$2 AND event_type='patch.software'`,
    [
      agent.tenant_id,
      deployment.agent_job_id,
      deployment.actor_label + ' patched “' + deployment.application_name + '”',
      detail,
      JSON.stringify({
        lateVerification: true,
        lateVerifiedVersion: item.installedVersion,
        reconciliationSource: 'patchhost_discovery',
      }),
    ],
  )

  return deployment.id
}

async function ingestPatchDiscovery(agent, body = {}) {
  const packages = array(body.packages)
    .slice(0, 2500)
    .map(normalizePatchDiscoveryPackage)
    .filter(Boolean)
  const capabilities = object(body.capabilities)
  const hostVersion = clean(capabilities.patchHostVersion || capabilities.version).slice(0, 80)
  let reconciledDeployments = 0

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE rmm_agent_devices
          SET patch_capabilities=$2::jsonb,patch_capabilities_at=now(),patch_discovery_at=now(),updated_at=now()
        WHERE id=$1`,
      [agent.id, JSON.stringify({ ...capabilities, patchHostVersion: hostVersion })],
    )

    await client.query(
      `DELETE FROM rmm_software_patch_observations
        WHERE tenant_id=$1 AND inventory_id=$2 AND discovery_method='patchhost_winget'`,
      [agent.tenant_id, agent.inventory_id],
    )

    for (const item of packages) {
      const applicationKey = 'winget|' + lower(item.packageId)
      let catalogue = await client.query(
        `SELECT id,target_version,tenant_id,catalogue_source
           FROM rmm_software_catalogue
          WHERE status='active' AND provider='winget' AND lower(provider_package_id)=lower($2)
            AND (tenant_id=$1 OR tenant_id IS NULL)
          ORDER BY tenant_id NULLS LAST
          LIMIT 1`,
        [agent.tenant_id, item.packageId],
      )

      if (!catalogue.rowCount) {
        const automaticTarget = item.availableVersion
        catalogue = await client.query(
          `INSERT INTO rmm_software_catalogue
            (tenant_id,canonical_name,publisher,name_pattern,publisher_pattern,provider,provider_package_id,
             target_version,release_channel,detection,verification,catalogue_source,external_key,source_metadata)
           SELECT $1,$2,$3,$2,$3,'winget',$4,$5,'stable',$6::jsonb,$7::jsonb,'patchhost',$8,$9::jsonb
            WHERE NOT EXISTS (
              SELECT 1 FROM rmm_software_catalogue
               WHERE tenant_id=$1 AND status='active' AND provider='winget'
                 AND lower(provider_package_id)=lower($4)
            )
           RETURNING id,target_version,tenant_id,catalogue_source`,
          [
            agent.tenant_id,
            item.name || item.packageId,
            item.publisher,
            item.packageId,
            automaticTarget,
            JSON.stringify({ source: 'patchhost_winget', confidence: 'source' }),
            JSON.stringify({ provider: 'winget', packageId: item.packageId }),
            'winget:' + lower(item.packageId),
            JSON.stringify({ firstObservedFromAgent: agent.id, sourceName: item.source }),
          ],
        )
        if (!catalogue.rowCount) {
          catalogue = await client.query(
            `SELECT id,target_version,tenant_id,catalogue_source
               FROM rmm_software_catalogue
              WHERE tenant_id=$1 AND status='active' AND provider='winget'
                AND lower(provider_package_id)=lower($2)
              LIMIT 1`,
            [agent.tenant_id, item.packageId],
          )
        }
      } else if (
        catalogue.rows[0]?.tenant_id
        && catalogue.rows[0]?.catalogue_source === 'patchhost'
        && item.availableVersion
      ) {
        catalogue = await client.query(
          `UPDATE rmm_software_catalogue
              SET target_version=$3,
                  canonical_name=CASE WHEN $4<>'' THEN $4 ELSE canonical_name END,
                  publisher=CASE WHEN $5<>'' THEN $5 ELSE publisher END,
                  source_metadata=source_metadata || $6::jsonb,
                  updated_at=now()
            WHERE id=$1 AND tenant_id=$2
            RETURNING id,target_version,tenant_id,catalogue_source`,
          [
            catalogue.rows[0].id,
            agent.tenant_id,
            item.availableVersion,
            item.name,
            item.publisher,
            JSON.stringify({ lastObservedFromAgent: agent.id, sourceName: item.source }),
          ],
        )
      }

      const targetVersion = clean(catalogue.rows[0]?.target_version)
      const availableVersion = item.availableVersion || targetVersion
      const comparison = availableVersion ? compareVersions(item.installedVersion, availableVersion) : null
      const patchStatus = availableVersion && comparison != null
        ? (comparison < 0 ? 'update_available' : 'current')
        : 'current'

      await client.query(
        `INSERT INTO rmm_software_patch_observations
          (tenant_id,inventory_id,catalogue_id,application_key,application_name,display_name,publisher,
           installed_version,provider,provider_package_id,available_version,patch_status,evidence,
           source_name,discovery_method,match_confidence,observed_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$5,$6,$7,'winget',$8,$9,$10,$11::jsonb,$12,'patchhost_winget','source',now(),now())
         ON CONFLICT (tenant_id,inventory_id,application_key) DO UPDATE SET
           catalogue_id=EXCLUDED.catalogue_id,application_name=EXCLUDED.application_name,display_name=EXCLUDED.display_name,
           publisher=EXCLUDED.publisher,installed_version=EXCLUDED.installed_version,provider=EXCLUDED.provider,
           provider_package_id=EXCLUDED.provider_package_id,available_version=EXCLUDED.available_version,
           patch_status=CASE
             WHEN rmm_software_patch_observations.patch_status='provider_blocked'
               AND rmm_software_patch_observations.available_version=EXCLUDED.available_version
               AND rmm_software_patch_observations.evidence->'installedInstances'=EXCLUDED.evidence->'installedInstances'
             THEN 'provider_blocked'
             ELSE EXCLUDED.patch_status
           END,
           evidence=CASE
             WHEN rmm_software_patch_observations.patch_status='provider_blocked'
               AND rmm_software_patch_observations.available_version=EXCLUDED.available_version
               AND rmm_software_patch_observations.evidence->'installedInstances'=EXCLUDED.evidence->'installedInstances'
             THEN EXCLUDED.evidence || jsonb_build_object(
               'providerBlockedReason',rmm_software_patch_observations.evidence->>'providerBlockedReason',
               'providerBlockedAt',rmm_software_patch_observations.evidence->>'providerBlockedAt',
               'providerBlockedJobId',rmm_software_patch_observations.evidence->>'providerBlockedJobId',
               'providerBlockedDetail',rmm_software_patch_observations.evidence->>'providerBlockedDetail'
             )
             ELSE EXCLUDED.evidence
           END,
           source_name=EXCLUDED.source_name,
           discovery_method=EXCLUDED.discovery_method,match_confidence=EXCLUDED.match_confidence,
           observed_at=now(),updated_at=now()`,
        [
          agent.tenant_id,
          agent.inventory_id,
          catalogue.rows[0]?.id || null,
          applicationKey,
          item.name,
          item.publisher,
          item.installedVersion,
          item.packageId,
          availableVersion,
          patchStatus,
          JSON.stringify({
            scope: item.scope,
            architecture: item.architecture,
            patchHostVersion: hostVersion,
            installedInstances: item.installedInstances,
          }),
          item.source,
        ],
      )
      if (patchStatus === 'current' && catalogue.rows[0]?.id && targetVersion) {
        const reconciled = await reconcilePatchDeploymentFromDiscovery(
          client,
          agent,
          catalogue.rows[0].id,
          item,
          targetVersion,
        )
        if (reconciled) reconciledDeployments += 1
      }
    }

    await client.query(
      `INSERT INTO rmm_patch_catalogue_candidates
        (tenant_id,provider,provider_package_id,display_name,publisher,latest_observed_version,devices_seen,updates_seen,last_seen_at,metadata)
       SELECT tenant_id,'winget',provider_package_id,
              COALESCE(max(NULLIF(display_name,'')),provider_package_id),
              COALESCE(max(NULLIF(publisher,'')),''),
              COALESCE(max(NULLIF(available_version,'')),max(NULLIF(installed_version,'')),''),
              count(DISTINCT inventory_id)::int,
              count(*) FILTER (WHERE patch_status='update_available')::int,
              now(),jsonb_build_object('discovery','patchhost_winget')
         FROM rmm_software_patch_observations
        WHERE tenant_id=$1 AND provider='winget' AND provider_package_id<>''
        GROUP BY tenant_id,provider_package_id
       ON CONFLICT (tenant_id,provider,provider_package_id) DO UPDATE SET
         display_name=EXCLUDED.display_name,publisher=EXCLUDED.publisher,
         latest_observed_version=EXCLUDED.latest_observed_version,devices_seen=EXCLUDED.devices_seen,
         updates_seen=EXCLUDED.updates_seen,last_seen_at=now(),
         metadata=rmm_patch_catalogue_candidates.metadata || EXCLUDED.metadata`,
      [agent.tenant_id],
    )

    await client.query(
      `UPDATE rmm_patch_catalogue_candidates c
          SET state=CASE WHEN EXISTS (
                SELECT 1 FROM rmm_software_catalogue s
                 WHERE s.status='active' AND s.provider=c.provider
                   AND lower(s.provider_package_id)=lower(c.provider_package_id)
                   AND (s.tenant_id=c.tenant_id OR s.tenant_id IS NULL)
              ) THEN 'mapped' ELSE CASE WHEN c.state='mapped' THEN 'observed' ELSE c.state END END,
              last_seen_at=now()
        WHERE c.tenant_id=$1`,
      [agent.tenant_id],
    )
  })

  return { packages: packages.length, patchHostVersion: hostVersion, reconciledDeployments }
}

async function patchDeploymentRows(tenantId) {
  const result = await pool.query(
    `SELECT d.id,d.inventory_id,d.catalogue_id,d.policy_id,d.agent_job_id,d.application_name,
            d.provider,d.provider_package_id,d.installed_version,d.target_version,d.status,d.result,
            d.created_at,d.started_at,d.completed_at,
            i.reference AS device_reference,i.name AS device_name
       FROM rmm_patch_deployments d
       JOIN rmm_device_inventory i ON i.id=d.inventory_id
      WHERE d.tenant_id=$1
      ORDER BY d.created_at DESC
      LIMIT 100`,
    [tenantId],
  )
  return result.rows
}

function installedSoftwareForCatalogue(sourcePayload, catalogue) {
  const matches = array(object(sourcePayload).software?.items)
    .filter((item) => contains(item?.name, catalogue.name_pattern)
      && contains(item?.publisher, catalogue.publisher_pattern))
  if (!matches.length) return null

  const ordered = [...matches].sort((a, b) => {
    const comparison = compareVersions(clean(a?.version), clean(b?.version))
    if (comparison == null) return clean(a?.version).localeCompare(clean(b?.version))
    return comparison
  })
  return {
    ...ordered[0],
    matchingInstances: ordered.map((item) => ({
      version: clean(item?.version),
      scope: clean(item?.scope),
      registryKey: clean(item?.registry_key),
      uninstallString: clean(item?.uninstall_string),
    })),
  }
}

async function softwarePatchPlan(tenantId, agentDeviceId, catalogueId, options = {}) {
  const intent = clean(options.intent) === 'install' ? 'install' : 'update'
  const result = await pool.query(
    `SELECT a.id AS agent_device_id,a.inventory_id,a.architecture,a.agent_version,a.websocket_status,
            a.last_telemetry_at,a.patch_capabilities,
            i.reference,i.name AS device_name,i.source_payload,
            c.id AS catalogue_id,c.canonical_name,c.publisher,c.name_pattern,c.publisher_pattern,
            c.provider,c.provider_package_id,c.target_version,c.release_channel,c.installer_type,
            c.execution,c.verification,c.catalogue_source,c.external_key,c.source_metadata,
            c.tenant_id AS catalogue_tenant_id
       FROM rmm_agent_devices a
       JOIN rmm_device_inventory i ON i.id=a.inventory_id AND i.active=true
       JOIN rmm_software_catalogue c ON c.id=$3 AND c.status='active'
         AND (c.tenant_id=$1 OR c.tenant_id IS NULL)
      WHERE a.tenant_id=$1 AND a.id::text=$2 AND a.disabled_at IS NULL
      LIMIT 1`,
    [tenantId, agentDeviceId, catalogueId],
  )
  const row = result.rows[0]
  if (!row) return { error: 'Device or software catalogue entry was not found.', status: 404 }

  const liveSocket = agentSocketForDevice(row.agent_device_id)
  const telemetryFresh = row.last_telemetry_at && Date.now() - new Date(row.last_telemetry_at).getTime() <= 90_000
  if (!liveSocket || liveSocket.readyState !== 1 || !telemetryFresh) {
    return { error: 'This device is offline. No patch job was queued.', status: 409, offline: true }
  }

  const capabilities = object(row.patch_capabilities)
  if (capabilities.softwareInstall !== true) {
    return { error: 'This device has not reported PatchHost software-install capability yet.', status: 409, capabilityMissing: true }
  }
  const hostVersion = clean(capabilities.patchHostVersion || capabilities.version)
  if (intent === 'install') {
    const installHostComparison = compareVersions(hostVersion, '0.2.5')
    if (!hostVersion || installHostComparison == null || installHostComparison < 0) {
      return {
        error: 'Installing software from the catalogue requires PatchHost 0.2.5 or newer on the endpoint.',
        status: 409,
        capabilityMissing: true,
        requiredPatchHostVersion: '0.2.5',
      }
    }
  }
  const verificationMethod = clean(object(row.verification).method || object(row.verification).provider || 'winget')
  if (verificationMethod !== 'winget') {
    const hostComparison = compareVersions(hostVersion, '0.2.4')
    if (!hostVersion || hostComparison == null || hostComparison < 0) {
      return {
        error: 'This verification method requires PatchHost 0.2.4 or newer on the endpoint.',
        status: 409,
        capabilityMissing: true,
        requiredPatchHostVersion: '0.2.4',
      }
    }
  }

  const sourceItems = softwareItems(row)
  if (targetProductCodeInstalled(sourceItems, row)) {
    return { error: 'The target MSI identity is already installed at or above the approved version.', status: 409, current: true }
  }

  const installed = installedSoftwareForCatalogue(row.source_payload, row)
  if (intent === 'install' && installed) {
    return { error: 'The selected application is already detected on this device. Use Patch for an existing installation.', status: 409, current: true }
  }
  if (intent !== 'install' && !installed) {
    return { error: 'The selected application is not currently detected on this device.', status: 409 }
  }

  const installedVersion = installed ? clean(installed.version) : ''
  const targetVersion = clean(row.target_version)
  if (!targetVersion) return { error: 'The software catalogue does not have an approved target version.', status: 409 }

  if (installed && clean(row.provider_package_id)) {
    const blocked = await pool.query(
      `SELECT patch_status,available_version,evidence
         FROM rmm_software_patch_observations
        WHERE tenant_id=$1 AND inventory_id=$2
          AND lower(provider_package_id)=lower($3)
        ORDER BY observed_at DESC
        LIMIT 1`,
      [tenantId, row.inventory_id, clean(row.provider_package_id)],
    )
    const observation = blocked.rows[0]
    if (observation?.patch_status === 'provider_blocked'
      && clean(observation.available_version) === targetVersion) {
      return {
        error: clean(object(observation.evidence).providerBlockedDetail)
          || 'The selected deployment provider cannot currently remediate this detected update.',
        status: 409,
        providerBlocked: true,
      }
    }
  }

  if (installed) {
    const comparison = compareVersions(installedVersion, targetVersion)
    if (comparison != null && comparison >= 0) {
      return { error: 'The application is already at or above the approved target version.', status: 409, current: true }
    }
  }

  const duplicate = await pool.query(
    `SELECT id,status
       FROM rmm_agent_jobs
      WHERE tenant_id=$1 AND agent_device_id=$2 AND job_type='patch.software'
        AND payload->>'catalogueId'=$3
        AND status IN ('queued','claimed')
      ORDER BY created_at DESC LIMIT 1`,
    [tenantId, row.agent_device_id, row.catalogue_id],
  )
  if (duplicate.rowCount) {
    return { error: 'A software deployment for this application is already running on the device.', status: 409, duplicateJobId: duplicate.rows[0].id }
  }

  const sourceMetadata = object(row.source_metadata)
  const tenantVendorSourceId = clean(sourceMetadata.tenantVendorSourceId)
  const sourceMode = clean(sourceMetadata.deploymentMode)
  if (sourceMode === 'intelligence_only') {
    return { error: 'This vendor source is configured for version intelligence only and cannot deploy software.', status: 409 }
  }

  let vendor = null
  if (tenantVendorSourceId) {
    const tenantRelease = await pool.query(
      `SELECT 'tenant_' || s.source_type AS source_key,r.version,r.release_date,r.installer_url,r.installer_sha256,
              r.installer_type,1000 AS source_priority,r.trust_state,s.expected_signer,s.deployment_mode
         FROM rmm_tenant_vendor_releases r
         JOIN rmm_tenant_vendor_sources s ON s.id=r.source_id AND s.tenant_id=$1 AND s.status='active'
        WHERE r.source_id=$2 AND r.version=$3
        ORDER BY COALESCE(r.release_date,r.last_seen_at) DESC LIMIT 1`,
      [tenantId, tenantVendorSourceId, targetVersion],
    )
    vendor = tenantRelease.rows[0] || null
  } else {
    const release = await pool.query(
      `SELECT r.source_key,r.version,r.release_date,r.installer_url,r.installer_sha256,r.installer_type,r.source_priority,
              COALESCE(NULLIF(r.source_payload->>'trustState',''),NULLIF(b.metadata->>'trustState',''),'') AS trust_state,
              COALESCE(NULLIF(r.source_payload->>'expectedSigner',''),NULLIF(b.metadata->>'expectedSigner',''),NULLIF(s.metadata->>'expectedSigner',''),'') AS expected_signer,
              COALESCE(NULLIF(r.source_payload->>'deploymentMode',''),NULLIF(b.metadata->>'deploymentMode',''),'winget_preferred') AS deployment_mode,
              COALESCE(NULLIF(b.metadata->>'wingetPackageId',''),'') AS winget_package_id
         FROM rmm_software_vendor_releases r
         JOIN rmm_software_vendor_sources s ON s.source_key=r.source_key AND s.enabled=true
         LEFT JOIN rmm_software_vendor_bindings b
           ON b.source_key=r.source_key
          AND b.provider_package_id=r.provider_package_id
          AND b.channel=r.channel
          AND b.platform=r.platform
          AND b.architecture=r.architecture
          AND b.enabled=true
        WHERE r.provider_package_id=$1 AND r.version=$2
        ORDER BY r.source_priority DESC,COALESCE(r.release_date,r.last_seen_at) DESC
        LIMIT 1`,
      [clean(row.provider_package_id), targetVersion],
    )
    vendor = release.rows[0] || null
  }

  const deploymentMode = clean(vendor?.deployment_mode || sourceMetadata.deploymentMode || (row.provider === 'winget' ? 'winget_preferred' : ''))
  const vendorDirect = vendor
    && deploymentMode === 'vendor_direct'
    && clean(vendor.trust_state) === 'direct_ready'
    && /^https:\/\//i.test(clean(vendor.installer_url))
    && /^[a-f0-9]{64}$/i.test(clean(vendor.installer_sha256))
    && clean(vendor.expected_signer || row.publisher)

  const globalWingetFallback = clean(vendor?.winget_package_id || sourceMetadata.wingetPackageId)
  const fallbackPackageId = tenantVendorSourceId
    ? clean(row.provider_package_id)
    : (globalWingetFallback || (deploymentMode === 'winget_preferred' && row.provider === 'winget' ? clean(row.provider_package_id) : ''))
  if (!vendorDirect && !fallbackPackageId) {
    return { error: 'No safe deployment provider is available for this catalogue entry.', status: 409 }
  }
  const executionPackageId = vendorDirect ? (fallbackPackageId || clean(row.provider_package_id)) : fallbackPackageId
  const provider = vendorDirect ? 'vendor_direct' : 'winget'

  return {
    device: row,
    installed,
    provider,
    manifest: {
      protocolVersion: 1,
      action: 'software.install',
      intent,
      catalogueId: row.catalogue_id,
      applicationName: row.canonical_name,
      publisher: row.publisher,
      packageId: executionPackageId,
      installedVersion,
      targetVersion,
      provider,
      vendorSource: vendorDirect ? clean(vendor.source_key) : '',
      downloadUrl: vendorDirect ? clean(vendor.installer_url) : '',
      sha256: vendorDirect ? clean(vendor.installer_sha256).toUpperCase() : '',
      installerType: vendorDirect ? clean(vendor.installer_type || row.installer_type) : '',
      installArguments: vendorDirect ? clean(object(row.execution).installArguments) : '',
      expectedSigner: clean(vendor?.expected_signer || row.publisher),
      fallbackProvider: vendorDirect && fallbackPackageId ? 'winget' : '',
      verification: {
        ...object(row.verification),
        method: clean(object(row.verification).method || object(row.verification).provider || 'winget'),
        packageId: clean(object(row.verification).packageId || executionPackageId),
        targetVersion,
      },
    },
  }
}

async function createAndDispatchSoftwarePatch(session, plan, context = {}) {
  const label = clean(session.name || session.email || 'Technician').slice(0, 255)
  const cveId = clean(context.cveId)
  const exposureId = clean(context.exposureId)
  const requestSource = clean(context.source) || 'rmm_patching'
  const created = await withTransaction(async (client) => {
    const jobResult = await client.query(
      `INSERT INTO rmm_agent_jobs
        (tenant_id,agent_device_id,job_type,payload,queued_by_user_id,initiated_by,initiated_by_label,request_metadata)
       VALUES ($1,$2,'patch.software',$3::jsonb,$4,'technician',$5,$6::jsonb)
       RETURNING id,status,correlation_id,created_at`,
      [
        session.tenant_id,
        plan.device.agent_device_id,
        JSON.stringify(plan.manifest),
        session.user_id,
        label,
        JSON.stringify({
          source: requestSource,
          device_name: plan.device.device_name,
          device_reference: plan.device.reference,
          catalogue_id: plan.device.catalogue_id,
          provider: plan.provider,
          intent: plan.manifest.intent || 'update',
          ...(cveId ? { cve_id: cveId } : {}),
          ...(exposureId ? { vulnerability_exposure_id: exposureId } : {}),
        }),
      ],
    )
    const job = jobResult.rows[0]
    const deploymentResult = await client.query(
      `INSERT INTO rmm_patch_deployments
        (tenant_id,inventory_id,catalogue_id,agent_job_id,application_name,provider,provider_package_id,
         installed_version,target_version,status,requested_by_user_id,result)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'eligible',$10,$11::jsonb)
       RETURNING *`,
      [
        session.tenant_id,
        plan.device.inventory_id,
        plan.device.catalogue_id,
        job.id,
        plan.manifest.applicationName,
        plan.provider,
        plan.manifest.packageId,
        plan.manifest.installedVersion,
        plan.manifest.targetVersion,
        session.user_id,
        JSON.stringify({ requestedProvider: plan.provider, vendorSource: plan.manifest.vendorSource || '' }),
      ],
    )
    return { job, deployment: deploymentResult.rows[0] }
  })

  const claimed = await pool.query(
    `UPDATE rmm_agent_jobs
        SET status='claimed',claimed_at=now(),updated_at=now()
      WHERE id=$1 AND tenant_id=$2 AND status='queued'
      RETURNING status,claimed_at,updated_at`,
    [created.job.id, session.tenant_id],
  )
  if (!claimed.rowCount) throw new Error('Patch job could not be claimed for immediate dispatch.')

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE rmm_patch_deployments
          SET status='running',started_at=now(),updated_at=now()
        WHERE id=$1 AND tenant_id=$2`,
      [created.deployment.id, session.tenant_id],
    )
    await client.query(
      `UPDATE rmm_vulnerability_exposures
          SET remediation_state='in_progress',last_seen_at=now()
        WHERE tenant_id=$1 AND inventory_id=$2 AND catalogue_id=$3
          AND status='open' AND remediation_state='available'`,
      [session.tenant_id, plan.device.inventory_id, plan.device.catalogue_id],
    )
  })

  const pushed = sendAgentMessage(plan.device.agent_device_id, {
    type: 'job_execute',
    job: {
      id: created.job.id,
      job_type: 'patch.software',
      payload: plan.manifest,
      created_at: created.job.created_at,
    },
  })

  if (!pushed) {
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE rmm_agent_jobs
            SET status='cancelled',claimed_at=NULL,completed_at=now(),
                error_message='Device went offline before the patch could be dispatched. The job was not retained for reconnect.',
                updated_at=now()
          WHERE id=$1 AND tenant_id=$2 AND status='claimed'`,
        [created.job.id, session.tenant_id],
      )
      await client.query(
        `UPDATE rmm_patch_deployments
            SET status='cancelled',completed_at=now(),updated_at=now(),
                result=result || '{"reason":"device_offline_before_dispatch"}'::jsonb
          WHERE id=$1 AND tenant_id=$2`,
        [created.deployment.id, session.tenant_id],
      )
      await client.query(
        `UPDATE rmm_vulnerability_exposures
            SET remediation_state='available',last_seen_at=now()
          WHERE tenant_id=$1 AND inventory_id=$2 AND catalogue_id=$3
            AND status='open' AND remediation_state='in_progress'`,
        [session.tenant_id, plan.device.inventory_id, plan.device.catalogue_id],
      )
    })
    return { ...created, dispatched: false, offline: true }
  }

  const installIntent = plan.manifest.intent === 'install'
  await recordRmmActivity({
    tenantId: session.tenant_id,
    agentDeviceId: plan.device.agent_device_id,
    inventoryId: plan.device.inventory_id,
    actorUserId: session.user_id,
    actorType: 'technician',
    actorLabel: label,
    eventType: installIntent ? 'software.install.requested' : 'patch.software.requested',
    category: installIntent ? 'software' : 'patching',
    summary: installIntent
      ? label + ' started software install “' + plan.manifest.applicationName + '”'
      : label + ' started software patch “' + plan.manifest.applicationName + '”',
    detail: installIntent
      ? 'Target ' + plan.manifest.targetVersion + ' via ' + plan.provider
      : plan.manifest.installedVersion + ' → ' + plan.manifest.targetVersion + ' via ' + plan.provider
        + (cveId ? ' · ' + cveId : ''),
    outcome: 'requested',
    correlationId: created.job.correlation_id,
    jobId: created.job.id,
    metadata: { deploymentId: created.deployment.id, manifest: { ...plan.manifest, downloadUrl: plan.manifest.downloadUrl ? '[vendor URL]' : '' } },
  }).catch(() => null)

  return { ...created, dispatched: true }
}

function validProvider(value) {
  return ['winget', 'managed', 'vendor'].includes(value) ? value : 'winget'
}

function validApproval(value) {
  return ['automatic', 'manual', 'pilot', 'blocked'].includes(value) ? value : 'manual'
}

function validReboot(value) {
  return ['never', 'maintenance_window', 'notify_user'].includes(value) ? value : 'never'
}

function priorityForScope(scopeType) {
  return ({ Estate: 100, Site: 220, Group: 340, Device: 900 })[scopeType] || 100
}

export function registerRmmPatchingRoutes(app) {
  app.post('/api/v1/agent/devices/patch-discovery', async (c) => {
    const agent = await authenticateAgent(c.req.header('x-hi5-device-id'), c.req.header('x-hi5-agent-secret'))
    if (!agent) return c.json({ success: false, error: 'Agent authentication failed.' }, 401)
    const body = await c.req.json().catch(() => ({}))
    const result = await ingestPatchDiscovery(agent, body)
    const automaticVerificationProbes = await queueAutomaticVendorVerificationProbes(agent.tenant_id).catch(() => [])
    const discoveryResult = { ...result, automaticVerificationProbes }
    await recordRmmActivity({
      tenantId: agent.tenant_id,
      agentDeviceId: agent.id,
      inventoryId: agent.inventory_id,
      actorType: 'agent',
      actorLabel: 'SYSTEM',
      eventType: 'patch.discovery',
      category: 'patching',
      summary: 'SYSTEM: PatchHost refreshed software patch discovery',
      detail: [
        result.packages + ' WinGet package mappings reported',
        automaticVerificationProbes.length ? automaticVerificationProbes.length + ' vendor verification probe(s) queued' : '',
      ].filter(Boolean).join(' · '),
      outcome: 'success',
      metadata: discoveryResult,
    }).catch(() => null)
    return c.json({ success: true, ...discoveryResult })
  })

  app.get('/api/v1/rmm/patching', async (c) => {
    const auth = await requirePatchAccess(c)
    if (auth.error) return auth.error
    return c.json(await patchBundle(auth.session.tenant_id))
  })

  app.post('/api/v1/rmm/vendor-sources', async (c) => {
    const auth = await requirePatchAccess(c, 'software')
    if (auth.error) return auth.error
    const body = await c.req.json().catch(() => ({}))
    try {
      const source = await createTenantVendorSource(auth.session, body)
      await audit(auth.session, 'patch.vendor_source.created', 'Created vendor source “' + clean(body.displayName) + '”', 'Draft · Test required before approval', { sourceId: source.id })
      return c.json({ success: true, source, bundle: await patchBundle(auth.session.tenant_id) }, 201)
    } catch (error) {
      return c.json({ error: clean(error?.message || error) || 'Unable to create vendor source.' }, 400)
    }
  })

  app.put('/api/v1/rmm/vendor-sources/:sourceId', async (c) => {
    const auth = await requirePatchAccess(c, 'software')
    if (auth.error) return auth.error
    const body = await c.req.json().catch(() => ({}))
    try {
      const source = await updateTenantVendorSource(auth.session, clean(c.req.param('sourceId')), body)
      await audit(auth.session, 'patch.vendor_source.updated', 'Updated vendor source “' + clean(body.displayName) + '”', 'Approval reset · Source must be tested again', { sourceId: source.id })
      return c.json({ success: true, source, bundle: await patchBundle(auth.session.tenant_id) })
    } catch (error) {
      return c.json({ error: clean(error?.message || error) || 'Unable to update vendor source.' }, 400)
    }
  })

  app.post('/api/v1/rmm/vendor-sources/:sourceId/test', async (c) => {
    const auth = await requirePatchAccess(c, 'software')
    if (auth.error) return auth.error
    try {
      const sourceId = clean(c.req.param('sourceId'))
      const result = await testTenantVendorSource(auth.session.tenant_id, sourceId)
      let verificationProbe = null
      if (result.verificationRecommendation?.autoProbeRecommended) {
        verificationProbe = await queueVendorVerificationProbe({
          tenantId: auth.session.tenant_id,
          userId: auth.session.user_id,
          actorLabel: auth.session.name || auth.session.email || 'Technician',
          sourceId,
        })
        if (verificationProbe?.error && [404, 409].includes(verificationProbe.status)) verificationProbe = { queued: false, reason: verificationProbe.error }
        else if (verificationProbe?.success) verificationProbe = { queued: true, ...verificationProbe }
      }
      const recommendation = await tenantVendorVerificationRecommendation(auth.session.tenant_id, sourceId)
      await audit(
        auth.session,
        'patch.vendor_source.tested',
        'Tested vendor source',
        [
          result.version,
          result.trustState,
          recommendation.recommendedMethod ? 'Recommended: ' + recommendation.recommendedMethod.replaceAll('_', ' ') : '',
          recommendation.validated ? 'Validated' : recommendation.autoProbeRecommended ? 'Validation queued' : 'Awaiting validation',
        ].filter(Boolean).join(' · '),
        { sourceId: result.sourceId, result, recommendation, verificationProbe },
      )
      return c.json({ success: true, result: { ...result, verificationRecommendation: recommendation }, verificationProbe, bundle: await patchBundle(auth.session.tenant_id) })
    } catch (error) {
      return c.json({ error: clean(error?.message || error) || 'Vendor source test failed.' }, 409)
    }
  })

  app.post('/api/v1/rmm/vendor-sources/:sourceId/probe-verification', async (c) => {
    const auth = await requirePatchAccess(c, 'software')
    if (auth.error) return auth.error
    const body = await c.req.json().catch(() => ({}))
    const result = await queueVendorVerificationProbe({
      tenantId: auth.session.tenant_id,
      userId: auth.session.user_id,
      actorLabel: auth.session.name || auth.session.email || 'Technician',
      sourceId: clean(c.req.param('sourceId')),
      agentDeviceId: clean(body.agentDeviceId),
    })
    if (result.error) return c.json({ error: result.error, ...result }, result.status || 409)
    return c.json(result, 202)
  })

  app.post('/api/v1/rmm/vendor-sources/:sourceId/approve', async (c) => {
    const auth = await requirePatchAccess(c, 'software')
    if (auth.error) return auth.error
    try {
      const result = await approveTenantVendorSource(auth.session, clean(c.req.param('sourceId')))
      await audit(auth.session, 'patch.vendor_source.approved', 'Approved vendor source “' + result.source.display_name + '”', result.release.version + ' · ' + result.release.trustState, { sourceId: result.source.id })
      return c.json({ success: true, result, bundle: await patchBundle(auth.session.tenant_id) })
    } catch (error) {
      return c.json({ error: clean(error?.message || error) || 'Vendor source approval failed.' }, 409)
    }
  })

  app.delete('/api/v1/rmm/vendor-sources/:sourceId', async (c) => {
    const auth = await requirePatchAccess(c, 'software')
    if (auth.error) return auth.error
    try {
      const result = await archiveTenantVendorSource(auth.session, clean(c.req.param('sourceId')))
      await audit(auth.session, 'patch.vendor_source.archived', 'Archived vendor source “' + result.display_name + '”', '', { sourceId: result.id })
      return c.json({ success: true, bundle: await patchBundle(auth.session.tenant_id) })
    } catch (error) {
      return c.json({ error: clean(error?.message || error) || 'Unable to archive vendor source.' }, 404)
    }
  })

  app.get('/api/v1/rmm/vulnerabilities', async (c) => {
    const auth = await requirePatchAccess(c)
    if (auth.error) return auth.error
    return c.json({ summary: await vulnerabilitySummary(), vulnerabilities: await recentVulnerabilities(c.req.query('limit')) })
  })

  app.post('/api/v1/rmm/patching/software/deploy', async (c) => {
    const auth = await requirePatchAccess(c, 'software')
    if (auth.error) return auth.error
    if (!hasPermission(auth.session.access, 'rmm.devices.control')) {
      return c.json({ error: 'You do not have permission to control RMM devices.' }, 403)
    }

    const body = await c.req.json().catch(() => ({}))
    const agentDeviceId = clean(body.agentDeviceId)
    const catalogueId = clean(body.catalogueId)
    if (!agentDeviceId || !catalogueId) {
      return c.json({ error: 'Device and software catalogue entry are required.' }, 400)
    }

    const plan = await softwarePatchPlan(auth.session.tenant_id, agentDeviceId, catalogueId)
    if (plan.error) return c.json({ error: plan.error, offline: plan.offline, capabilityMissing: plan.capabilityMissing, current: plan.current, providerBlocked: plan.providerBlocked }, plan.status || 400)

    const dispatched = await createAndDispatchSoftwarePatch(auth.session, plan)
    if (!dispatched.dispatched) {
      return c.json({ error: 'The device went offline before the patch could be dispatched. No patch job was retained.', offline: true }, 409)
    }

    return c.json({
      success: true,
      job: dispatched.job,
      deployment: dispatched.deployment,
      provider: plan.provider,
      bundle: await patchBundle(auth.session.tenant_id),
    }, 202)
  })

  app.post('/api/v1/rmm/patching/software/install', async (c) => {
    const auth = await requirePatchAccess(c, 'software')
    if (auth.error) return auth.error
    if (!hasPermission(auth.session.access, 'rmm.devices.control')) {
      return c.json({ error: 'You do not have permission to control RMM devices.' }, 403)
    }

    const body = await c.req.json().catch(() => ({}))
    const agentDeviceId = clean(body.agentDeviceId)
    const catalogueId = clean(body.catalogueId)
    if (!agentDeviceId || !catalogueId) {
      return c.json({ error: 'Device and software catalogue entry are required.' }, 400)
    }

    const plan = await softwarePatchPlan(auth.session.tenant_id, agentDeviceId, catalogueId, { intent: 'install' })
    if (plan.error) {
      return c.json({
        error: plan.error,
        offline: plan.offline,
        capabilityMissing: plan.capabilityMissing,
        requiredPatchHostVersion: plan.requiredPatchHostVersion,
        current: plan.current,
      }, plan.status || 400)
    }

    const dispatched = await createAndDispatchSoftwarePatch(auth.session, plan, { source: 'rmm_catalogue_install' })
    if (!dispatched.dispatched) {
      return c.json({ error: 'The device went offline before the install could be dispatched. No install job was retained.', offline: true }, 409)
    }

    return c.json({
      success: true,
      job: dispatched.job,
      deployment: dispatched.deployment,
      provider: plan.provider,
      bundle: await patchBundle(auth.session.tenant_id),
    }, 202)
  })

  app.post('/api/v1/rmm/vulnerability-exposures/:exposureId/remediate', async (c) => {
    const auth = await requirePatchAccess(c, 'software')
    if (auth.error) return auth.error
    if (!hasPermission(auth.session.access, 'rmm.devices.control')) {
      return c.json({ error: 'You do not have permission to control RMM devices.' }, 403)
    }

    const exposureId = clean(c.req.param('exposureId'))
    const exposureResult = await pool.query(
      `SELECT e.id::text,e.cve_id,e.status,e.remediation_state,e.catalogue_id,
              a.agent_device_id
         FROM rmm_vulnerability_exposures e
         LEFT JOIN LATERAL (
           SELECT id::text AS agent_device_id
             FROM rmm_agent_devices
            WHERE tenant_id=e.tenant_id AND inventory_id=e.inventory_id AND disabled_at IS NULL
            ORDER BY last_telemetry_at DESC NULLS LAST
            LIMIT 1
         ) a ON true
        WHERE e.tenant_id=$1 AND e.id::text=$2
        LIMIT 1`,
      [auth.session.tenant_id, exposureId],
    )
    const exposure = exposureResult.rows[0]
    if (!exposure) return c.json({ error: 'Vulnerability exposure not found.' }, 404)
    if (exposure.status !== 'open') {
      return c.json({ error: 'This vulnerability exposure is no longer open.' }, 409)
    }
    if (exposure.remediation_state !== 'available' || !exposure.catalogue_id) {
      return c.json({ error: 'No verified software remediation is currently available for this exposure.' }, 409)
    }
    if (!exposure.agent_device_id) {
      return c.json({ error: 'This device is offline. No patch job was queued.', offline: true }, 409)
    }

    const plan = await softwarePatchPlan(
      auth.session.tenant_id,
      exposure.agent_device_id,
      exposure.catalogue_id,
    )
    if (plan.error) {
      return c.json({
        error: plan.error,
        offline: plan.offline,
        capabilityMissing: plan.capabilityMissing,
        current: plan.current,
        providerBlocked: plan.providerBlocked,
      }, plan.status || 400)
    }

    const dispatched = await createAndDispatchSoftwarePatch(auth.session, plan, {
      source: 'rmm_vulnerability_remediation',
      cveId: exposure.cve_id,
      exposureId: exposure.id,
    })
    if (!dispatched.dispatched) {
      return c.json({
        error: 'The device went offline before the remediation could be dispatched. No patch job was retained.',
        offline: true,
      }, 409)
    }

    return c.json({
      success: true,
      cveId: exposure.cve_id,
      job: dispatched.job,
      deployment: dispatched.deployment,
      provider: plan.provider,
      bundle: await patchBundle(auth.session.tenant_id),
    }, 202)
  })

  app.post('/api/v1/rmm/software-catalogue', async (c) => {
    const auth = await requirePatchAccess(c, 'software')
    if (auth.error) return auth.error
    const body = await c.req.json().catch(() => ({}))
    const canonicalName = clean(body.canonicalName)
    const namePattern = clean(body.namePattern || canonicalName)
    if (canonicalName.length < 2 || namePattern.length < 2) {
      return c.json({ error: 'Application name and detection pattern are required.' }, 400)
    }
    const provider = validProvider(clean(body.provider))
    const result = await pool.query(
      `INSERT INTO rmm_software_catalogue
        (tenant_id,canonical_name,publisher,name_pattern,publisher_pattern,provider,provider_package_id,
         target_version,release_channel,installer_type,detection,execution,verification,created_by_user_id,updated_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14,$14)
       RETURNING id`,
      [
        auth.session.tenant_id,
        canonicalName,
        clean(body.publisher),
        namePattern,
        clean(body.publisherPattern),
        provider,
        clean(body.packageId),
        clean(body.targetVersion),
        clean(body.releaseChannel || 'stable') || 'stable',
        clean(body.installerType),
        JSON.stringify(object(body.detection)),
        JSON.stringify(object(body.execution)),
        JSON.stringify(object(body.verification)),
        auth.session.user_id,
      ],
    )
    await audit(auth.session, 'software_catalogue.created', 'Created software patch mapping “' + canonicalName + '”', provider, { catalogueId: result.rows[0].id })
    return c.json({ success: true, id: result.rows[0].id, bundle: await patchBundle(auth.session.tenant_id) }, 201)
  })

  app.put('/api/v1/rmm/software-catalogue/:catalogueId', async (c) => {
    const auth = await requirePatchAccess(c, 'software')
    if (auth.error) return auth.error
    const body = await c.req.json().catch(() => ({}))
    const canonicalName = clean(body.canonicalName)
    const namePattern = clean(body.namePattern || canonicalName)
    if (canonicalName.length < 2 || namePattern.length < 2) return c.json({ error: 'Application name and detection pattern are required.' }, 400)
    const result = await pool.query(
      `UPDATE rmm_software_catalogue
          SET canonical_name=$3,publisher=$4,name_pattern=$5,publisher_pattern=$6,provider=$7,
              provider_package_id=$8,target_version=$9,release_channel=$10,installer_type=$11,
              updated_by_user_id=$12,updated_at=now()
        WHERE id=$1 AND tenant_id=$2 AND status<>'archived'
        RETURNING id`,
      [
        clean(c.req.param('catalogueId')), auth.session.tenant_id, canonicalName, clean(body.publisher),
        namePattern, clean(body.publisherPattern), validProvider(clean(body.provider)), clean(body.packageId),
        clean(body.targetVersion), clean(body.releaseChannel || 'stable') || 'stable', clean(body.installerType),
        auth.session.user_id,
      ],
    )
    if (!result.rowCount) return c.json({ error: 'Software patch mapping not found.' }, 404)
    await audit(auth.session, 'software_catalogue.updated', 'Updated software patch mapping “' + canonicalName + '”', '', { catalogueId: result.rows[0].id })
    return c.json({ success: true, bundle: await patchBundle(auth.session.tenant_id) })
  })

  app.delete('/api/v1/rmm/software-catalogue/:catalogueId', async (c) => {
    const auth = await requirePatchAccess(c, 'software')
    if (auth.error) return auth.error
    const result = await pool.query(
      `UPDATE rmm_software_catalogue SET status='archived',updated_by_user_id=$3,updated_at=now()
        WHERE id=$1 AND tenant_id=$2 AND status<>'archived' RETURNING id,canonical_name`,
      [clean(c.req.param('catalogueId')), auth.session.tenant_id, auth.session.user_id],
    )
    if (!result.rowCount) return c.json({ error: 'Software patch mapping not found.' }, 404)
    await audit(auth.session, 'software_catalogue.archived', 'Archived software patch mapping “' + result.rows[0].canonical_name + '”', '', { catalogueId: result.rows[0].id })
    return c.json({ success: true, bundle: await patchBundle(auth.session.tenant_id) })
  })
  app.post('/api/v1/rmm/patch-policies', async (c) => {
    const auth = await requirePatchAccess(c, 'policy')
    if (auth.error) return auth.error
    const body = await c.req.json().catch(() => ({}))
    const name = clean(body.name)
    if (name.length < 2) return c.json({ error: 'Policy name is required.' }, 400)
    const result = await pool.query(
      `INSERT INTO rmm_patch_policies
        (tenant_id,name,description,software_enabled,windows_enabled,approval_mode,deployment_delay_days,
         maintenance_window,reboot_policy,max_retries,software_rules,windows_rules,created_by_user_id,updated_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11::jsonb,$12::jsonb,$13,$13)
       RETURNING id`,
      [
        auth.session.tenant_id, name, clean(body.description), body.softwareEnabled !== false,
        Boolean(body.windowsEnabled), validApproval(clean(body.approvalMode)),
        Math.max(0, Math.min(365, Number(body.deploymentDelayDays) || 0)),
        JSON.stringify(object(body.maintenanceWindow)), validReboot(clean(body.rebootPolicy)),
        Math.max(0, Math.min(10, Number(body.maxRetries) || 2)),
        JSON.stringify(object(body.softwareRules)), JSON.stringify(object(body.windowsRules)),
        auth.session.user_id,
      ],
    )
    await audit(auth.session, 'patch_policy.created', 'Created patch policy “' + name + '”', '', { policyId: result.rows[0].id })
    return c.json({ success: true, id: result.rows[0].id, bundle: await patchBundle(auth.session.tenant_id) }, 201)
  })

  app.post('/api/v1/rmm/patch-assignments', async (c) => {
    const auth = await requirePatchAccess(c, 'policy')
    if (auth.error) return auth.error
    const body = await c.req.json().catch(() => ({}))
    const scopeType = clean(body.scopeType)
    if (!['Estate', 'Site', 'Group', 'Device'].includes(scopeType)) return c.json({ error: 'Invalid patch scope.' }, 400)
    const scopeId = clean(body.scopeId || (scopeType === 'Estate' ? 'ALL' : ''))
    if (!scopeId) return c.json({ error: 'Patch scope target is required.' }, 400)
    const result = await pool.query(
      `INSERT INTO rmm_patch_assignments
        (tenant_id,policy_id,scope_type,scope_id,scope_name,priority,enabled,created_by_user_id)
       SELECT $1,p.id,$3,$4,$5,$6,true,$7
         FROM rmm_patch_policies p
        WHERE p.id=$2 AND p.tenant_id=$1 AND p.status='active'
       ON CONFLICT (tenant_id,policy_id,scope_type,scope_id)
       DO UPDATE SET scope_name=EXCLUDED.scope_name,priority=EXCLUDED.priority,enabled=true,updated_at=now()
       RETURNING id`,
      [
        auth.session.tenant_id, clean(body.policyId), scopeType, scopeId, clean(body.scopeName),
        Number.isFinite(Number(body.priority)) ? Number(body.priority) : priorityForScope(scopeType),
        auth.session.user_id,
      ],
    )
    if (!result.rowCount) return c.json({ error: 'Patch policy not found.' }, 404)
    await audit(auth.session, 'patch_assignment.updated', 'Assigned patch policy to ' + (clean(body.scopeName) || scopeType), scopeType, { assignmentId: result.rows[0].id, policyId: clean(body.policyId), scopeId })
    return c.json({ success: true, id: result.rows[0].id, bundle: await patchBundle(auth.session.tenant_id) }, 201)
  })

  app.delete('/api/v1/rmm/patch-assignments/:assignmentId', async (c) => {
    const auth = await requirePatchAccess(c, 'policy')
    if (auth.error) return auth.error
    const result = await pool.query(
      'DELETE FROM rmm_patch_assignments WHERE id=$1 AND tenant_id=$2 RETURNING id,scope_name',
      [clean(c.req.param('assignmentId')), auth.session.tenant_id],
    )
    if (!result.rowCount) return c.json({ error: 'Patch assignment not found.' }, 404)
    await audit(auth.session, 'patch_assignment.deleted', 'Removed patch assignment from ' + (result.rows[0].scope_name || 'scope'), '', { assignmentId: result.rows[0].id })
    return c.json({ success: true, bundle: await patchBundle(auth.session.tenant_id) })
  })
}