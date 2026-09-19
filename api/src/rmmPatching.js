import { hasPermission } from './access.js'
import { originMatchesTenant } from './deploymentConfig.js'
import { pool, withTransaction } from './db.js'
import { authenticateAgent } from './rmmAgent.js'
import { recordRmmActivity } from './rmmActivity.js'
import { recentVulnerabilities, vulnerabilitySummary } from './rmmVulnerabilityIntel.js'
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

function versionParts(value) {
  const matches = clean(value).match(/\d+/g)
  if (!matches?.length) return null
  return matches.map((part) => Number(part))
}

function compareVersions(installed, target) {
  const left = versionParts(installed)
  const right = versionParts(target)
  if (!left || !right) return null
  const size = Math.max(left.length, right.length)
  for (let index = 0; index < size; index += 1) {
    const a = left[index] || 0
    const b = right[index] || 0
    if (a < b) return -1
    if (a > b) return 1
  }
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
            created_at,updated_at
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
              o.provider,o.provider_package_id,o.available_version,o.patch_status,o.source_name,
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
    return clean(b.name_pattern).length - clean(a.name_pattern).length
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

function softwareItems(row) {
  return array(object(object(row.source_payload).software).items)
    .filter((item) => clean(item?.name))
}

function appIdentity(app) {
  return lower(app.name) + '|' + lower(app.publisher)
}

function publicCatalogue(entry) {
  if (!entry) return null
  return {
    id: entry.id,
    builtIn: !entry.tenant_id,
    canonicalName: entry.canonical_name,
    publisher: entry.publisher,
    namePattern: entry.name_pattern,
    publisherPattern: entry.publisher_pattern,
    provider: entry.provider,
    packageId: entry.provider_package_id,
    targetVersion: entry.target_version,
    releaseChannel: entry.release_channel,
    installerType: entry.installer_type,
    status: entry.status,
  }
}
function buildSoftware(devices, catalogue) {
  const applications = new Map()
  const deviceSoftware = []
  for (const device of devices) {
    for (const app of softwareItems(device)) {
      const state = classifyInstallation(app, catalogue)
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
        current: 0,
        detectionPending: 0,
        unmapped: 0,
        catalogue: row.catalogue,
      }
      grouped.installs += 1
      grouped.deviceIds.add(row.deviceId)
      grouped.versions.set(row.installedVersion || 'Not reported', (grouped.versions.get(row.installedVersion || 'Not reported') || 0) + 1)
      if (state.patchStatus === 'update_available') grouped.updateAvailable += 1
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
      versions: [...item.versions.entries()].map(([version, count]) => ({ version, count })),
    })).sort((a, b) => a.name.localeCompare(b.name)),
    deviceSoftware,
  }
}

async function patchBundle(tenantId) {
  const [devices, catalogue, policies, assignments, vulnerabilities, discovery] = await Promise.all([
    patchDeviceRows(tenantId),
    catalogueRows(tenantId),
    policyRows(tenantId),
    assignmentRows(tenantId),
    vulnerabilitySummary(),
    patchDiscoveryRows(tenantId),
  ])
  const software = buildSoftware(devices, catalogue)
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
    vulnerabilities,
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
  return {
    packageId,
    name: clean(value.name || value.displayName || packageId).slice(0, 320),
    publisher: clean(value.publisher).slice(0, 240),
    installedVersion,
    availableVersion,
    source: clean(value.source || 'winget').slice(0, 80),
    scope: clean(value.scope).slice(0, 80),
    architecture: clean(value.architecture).slice(0, 80),
  }
}

async function ingestPatchDiscovery(agent, body = {}) {
  const packages = array(body.packages)
    .slice(0, 2500)
    .map(normalizePatchDiscoveryPackage)
    .filter(Boolean)
  const capabilities = object(body.capabilities)
  const hostVersion = clean(capabilities.patchHostVersion || capabilities.version).slice(0, 80)

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
      const catalogue = await client.query(
        `SELECT id,target_version
           FROM rmm_software_catalogue
          WHERE status='active' AND provider='winget' AND lower(provider_package_id)=lower($2)
            AND (tenant_id=$1 OR tenant_id IS NULL)
          ORDER BY tenant_id NULLS LAST
          LIMIT 1`,
        [agent.tenant_id, item.packageId],
      )
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
           patch_status=EXCLUDED.patch_status,evidence=EXCLUDED.evidence,source_name=EXCLUDED.source_name,
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
          JSON.stringify({ scope: item.scope, architecture: item.architecture, patchHostVersion: hostVersion }),
          item.source,
        ],
      )
    }

    await client.query(
      `INSERT INTO rmm_patch_catalogue_candidates
        (tenant_id,provider,provider_package_id,display_name,publisher,latest_observed_version,devices_seen,updates_seen,last_seen_at,metadata)
       SELECT tenant_id,'winget',provider_package_id,
              max(NULLIF(display_name,'')),max(NULLIF(publisher,'')),
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
  })

  return { packages: packages.length, patchHostVersion: hostVersion }
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
    await recordRmmActivity({
      tenantId: agent.tenant_id,
      agentDeviceId: agent.id,
      inventoryId: agent.inventory_id,
      actorType: 'agent',
      actorLabel: 'SYSTEM',
      eventType: 'patch.discovery',
      category: 'patching',
      summary: 'SYSTEM: PatchHost refreshed software patch discovery',
      detail: result.packages + ' WinGet package mappings reported',
      outcome: 'success',
      metadata: result,
    }).catch(() => null)
    return c.json({ success: true, ...result })
  })

  app.get('/api/v1/rmm/patching', async (c) => {
    const auth = await requirePatchAccess(c)
    if (auth.error) return auth.error
    return c.json(await patchBundle(auth.session.tenant_id))
  })

  app.get('/api/v1/rmm/vulnerabilities', async (c) => {
    const auth = await requirePatchAccess(c)
    if (auth.error) return auth.error
    return c.json({ summary: await vulnerabilitySummary(), vulnerabilities: await recentVulnerabilities(c.req.query('limit')) })
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
