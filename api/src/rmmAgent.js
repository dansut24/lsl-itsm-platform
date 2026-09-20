import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { WebSocketServer } from 'ws'
import { hasPermission } from './access.js'
import { originMatchesTenant } from './deploymentConfig.js'
import { pool, withTransaction } from './db.js'
import { recordJobCompletionActivity, recordRmmActivity } from './rmmActivity.js'
import { recalculateTenantVulnerabilityExposures } from './rmmVulnerabilityExposure.js'
import { resolveSession } from './session.js'

const AGENT_DOWNLOAD_URL = 'https://downloads.hi5central.com/agent/latest/Hi5CentralAgentSetup.exe'
const MAX_INVENTORY_BYTES = 4 * 1024 * 1024

function clean(value = '') { return String(value ?? '').trim() }
function sha256(value = '') { return createHash('sha256').update(String(value)).digest('hex') }
function secret(prefix) { return `${prefix}_${randomBytes(32).toString('base64url')}` }
function boundedNumber(value, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  return Math.min(max, Math.max(min, number))
}
function boundedInteger(value, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  return Math.min(max, Math.max(min, Math.trunc(number)))
}
async function requireRmmManager(c) {
  const session = await resolveSession(c)
  if (!session) return { error: c.json({ error: 'Authentication required.' }, 401) }
  if (!originMatchesTenant(c.req.header('origin'), session.slug)) {
    return { error: c.json({ error: 'Tenant session mismatch.' }, 403) }
  }
  if (!hasPermission(session.access, 'rmm.devices.control') && !hasPermission(session.access, 'rmm.policies.manage')) {
    return { error: c.json({ error: 'You do not have permission to manage RMM agents.' }, 403) }
  }
  return { session }
}

export async function authenticateAgent(deviceId, deviceSecret) {
  const id = clean(deviceId)
  const rawSecret = clean(deviceSecret)
  if (!id || !rawSecret) return null
  const result = await pool.query(
    `SELECT a.id,a.tenant_id,a.inventory_id,i.reference,i.name
       FROM rmm_agent_devices a
       JOIN rmm_device_inventory i ON i.id=a.inventory_id
      WHERE a.id::text=$1 AND a.secret_hash=$2 AND a.disabled_at IS NULL
      LIMIT 1`,
    [id, sha256(rawSecret)],
  )
  return result.rows[0] || null
}
function storageTotals(storage) {
  if (!Array.isArray(storage)) return { total: null, free: null }
  let total = 0
  let free = 0
  let seen = false
  for (const drive of storage) {
    const driveTotal = Number(drive?.total_bytes)
    const driveFree = Number(drive?.free_bytes)
    if (Number.isFinite(driveTotal) && driveTotal >= 0) { total += driveTotal; seen = true }
    if (Number.isFinite(driveFree) && driveFree >= 0) free += driveFree
  }
  return seen ? { total, free } : { total: null, free: null }
}


function softwareIdentity(app = {}) {
  return [
    clean(app.registry_key || app.registryKey),
    clean(app.scope),
    clean(app.name).toLowerCase(),
    clean(app.version).toLowerCase(),
  ].join('|')
}

function bitlockerVolumes(payload = {}) {
  const direct = Array.isArray(payload.security?.bitlocker) ? payload.security.bitlocker : []
  if (direct.length) return direct
  return (Array.isArray(payload.storage) ? payload.storage : []).map((drive) => ({
    drive: drive.drive || drive.mount,
    ...(drive.bitlocker && typeof drive.bitlocker === 'object' ? drive.bitlocker : {}),
    encryption_percentage: drive.encryption_percentage ?? drive.bitlocker?.encryption_percentage,
    protection_status: drive.bitlocker_status || drive.bitlocker?.protection_status,
  }))
}

function inventoryDeltaEvents(previous = {}, current = {}) {
  const events = []
  if (!previous || !Object.keys(previous).length) return events

  const previousBitlocker = new Map(bitlockerVolumes(previous).map((drive) => [clean(drive.drive || drive.mount_point), drive]))
  for (const drive of bitlockerVolumes(current)) {
    const key = clean(drive.drive || drive.mount_point)
    if (!key) continue
    const before = previousBitlocker.get(key)
    if (!before) continue

    const beforePct = Number(before.encryption_percentage)
    const afterPct = Number(drive.encryption_percentage)
    const beforeProtection = clean(before.protection_status)
    const afterProtection = clean(drive.protection_status)
    const beforeVolume = clean(before.volume_status)
    const afterVolume = clean(drive.volume_status)

    if (Number.isFinite(beforePct) && Number.isFinite(afterPct) && beforePct <= 0 && afterPct > 0 && afterPct < 100) {
      events.push({ eventType: 'bitlocker.encrypting', category: 'security', summary: 'SYSTEM: ' + key + ' started encrypting', detail: 'BitLocker encryption progressed from ' + beforePct + '% to ' + afterPct + '%.', outcome: 'info', metadata: { drive: key, before: beforePct, after: afterPct } })
    } else if (Number.isFinite(beforePct) && Number.isFinite(afterPct) && beforePct < 100 && afterPct >= 100) {
      events.push({ eventType: 'bitlocker.encrypted', category: 'security', summary: 'SYSTEM: ' + key + ' finished encrypting', detail: 'BitLocker encryption reached 100%.', outcome: 'success', metadata: { drive: key, before: beforePct, after: afterPct } })
    } else if (Number.isFinite(beforePct) && Number.isFinite(afterPct) && beforePct > 0 && afterPct < beforePct && afterPct < 100) {
      events.push({ eventType: 'bitlocker.decrypting', category: 'security', summary: 'SYSTEM: ' + key + ' started decrypting', detail: 'BitLocker encryption changed from ' + beforePct + '% to ' + afterPct + '%.', outcome: 'info', severity: 'warning', metadata: { drive: key, before: beforePct, after: afterPct } })
    }

    if (beforeProtection && afterProtection && beforeProtection !== afterProtection) {
      if (/on|protected/i.test(beforeProtection) && /off|suspended/i.test(afterProtection)) {
        events.push({ eventType: 'bitlocker.suspended', category: 'security', summary: 'SYSTEM: BitLocker was suspended on ' + key, detail: beforeProtection + ' → ' + afterProtection, outcome: 'info', severity: 'warning', metadata: { drive: key, before: beforeProtection, after: afterProtection } })
      } else if (/off|suspended/i.test(beforeProtection) && /on|protected/i.test(afterProtection)) {
        events.push({ eventType: 'bitlocker.resumed', category: 'security', summary: 'SYSTEM: BitLocker protection resumed on ' + key, detail: beforeProtection + ' → ' + afterProtection, outcome: 'success', metadata: { drive: key, before: beforeProtection, after: afterProtection } })
      }
    }

    if (beforeVolume !== afterVolume && /fullyencrypted/i.test(afterVolume) && !(Number.isFinite(afterPct) && afterPct >= 100)) {
      events.push({ eventType: 'bitlocker.encrypted', category: 'security', summary: 'SYSTEM: ' + key + ' finished encrypting', detail: 'BitLocker reports the volume as fully encrypted.', outcome: 'success', metadata: { drive: key, before: beforeVolume, after: afterVolume } })
    }
  }

  const previousSoftware = Array.isArray(previous.software?.items) ? previous.software.items : []
  const currentSoftware = Array.isArray(current.software?.items) ? current.software.items : []
  if (previousSoftware.length && currentSoftware.length) {
    const beforeMap = new Map(previousSoftware.map((app) => [softwareIdentity(app), app]))
    const afterMap = new Map(currentSoftware.map((app) => [softwareIdentity(app), app]))
    for (const [key, app] of afterMap) {
      if (!beforeMap.has(key)) {
        events.push({ eventType: 'software.detected', category: 'software', summary: 'SYSTEM: detected software installation “' + clean(app.name) + '”', detail: [app.version, app.publisher].filter(Boolean).join(' · '), outcome: 'info', metadata: { software: app } })
      }
    }
    for (const [key, app] of beforeMap) {
      if (!afterMap.has(key)) {
        events.push({ eventType: 'software.removed', category: 'software', summary: 'SYSTEM: detected software removal “' + clean(app.name) + '”', detail: [app.version, app.publisher].filter(Boolean).join(' · '), outcome: 'info', metadata: { software: app } })
      }
    }
  }

  const beforeHost = clean(previous.summary?.hostname)
  const afterHost = clean(current.summary?.hostname)
  if (beforeHost && afterHost && beforeHost !== afterHost) {
    events.push({ eventType: 'device.hostname_changed', category: 'inventory', summary: 'SYSTEM: device hostname changed to ' + afterHost, detail: beforeHost + ' → ' + afterHost, outcome: 'info', metadata: { before: beforeHost, after: afterHost } })
  }

  const beforeOs = clean(previous.summary?.os_version || previous.os?.version)
  const afterOs = clean(current.summary?.os_version || current.os?.version)
  const beforeBuild = clean(previous.summary?.os_build || previous.os?.build)
  const afterBuild = clean(current.summary?.os_build || current.os?.build)
  if (beforeOs && afterOs && (beforeOs !== afterOs || (beforeBuild && afterBuild && beforeBuild !== afterBuild))) {
    events.push({ eventType: 'os.updated', category: 'inventory', summary: 'SYSTEM: Windows version changed to ' + afterOs, detail: [beforeOs + (beforeBuild ? ' (' + beforeBuild + ')' : ''), afterOs + (afterBuild ? ' (' + afterBuild + ')' : '')].join(' → '), outcome: 'success', metadata: { beforeVersion: beforeOs, afterVersion: afterOs, beforeBuild, afterBuild } })
  }

  const beforeMemory = Number(previous.summary?.total_memory_bytes ?? previous.memory?.total_bytes)
  const afterMemory = Number(current.summary?.total_memory_bytes ?? current.memory?.total_bytes)
  if (Number.isFinite(beforeMemory) && Number.isFinite(afterMemory) && beforeMemory > 0 && afterMemory > 0 && beforeMemory !== afterMemory) {
    events.push({ eventType: 'hardware.memory_changed', category: 'inventory', summary: 'SYSTEM: installed memory changed', detail: Math.round(beforeMemory / 1073741824) + ' GB → ' + Math.round(afterMemory / 1073741824) + ' GB', outcome: 'info', metadata: { beforeBytes: beforeMemory, afterBytes: afterMemory } })
  }

  const beforeUser = clean(previous.summary?.logged_in_user || previous.sessions?.active_console_user || previous.sessions?.current_user)
  const afterUser = clean(current.summary?.logged_in_user || current.sessions?.active_console_user || current.sessions?.current_user)
  if (beforeUser && afterUser && beforeUser !== afterUser) {
    events.push({ eventType: 'session.console_user_changed', category: 'session', summary: 'SYSTEM: active console user changed to ' + afterUser, detail: beforeUser + ' → ' + afterUser, outcome: 'info', metadata: { before: beforeUser, after: afterUser } })
  }

  const securityFields = [
    ['firewall_enabled', 'Windows Firewall', 'security.firewall_changed'],
    ['defender_enabled', 'Microsoft Defender', 'security.defender_changed'],
    ['defender_realtime_enabled', 'Defender real-time protection', 'security.defender_realtime_changed'],
    ['secure_boot_enabled', 'Secure Boot', 'security.secure_boot_changed'],
  ]
  for (const [field, label, eventType] of securityFields) {
    const before = previous.security?.[field]
    const after = current.security?.[field]
    if (typeof before === 'boolean' && typeof after === 'boolean' && before !== after) {
      events.push({ eventType, category: 'security', summary: 'SYSTEM: ' + label + ' was ' + (after ? 'enabled' : 'disabled'), detail: String(before) + ' → ' + String(after), outcome: after ? 'success' : 'info', severity: after ? 'info' : 'warning', metadata: { before, after } })
    }
  }

  const beforeAdmins = Number(previous.security?.local_admin_count)
  const afterAdmins = Number(current.security?.local_admin_count)
  if (Number.isFinite(beforeAdmins) && Number.isFinite(afterAdmins) && beforeAdmins !== afterAdmins) {
    events.push({ eventType: 'security.local_admins_changed', category: 'security', summary: 'SYSTEM: local administrator membership changed', detail: beforeAdmins + ' → ' + afterAdmins + ' members', outcome: 'info', severity: afterAdmins > beforeAdmins ? 'warning' : 'info', metadata: { before: beforeAdmins, after: afterAdmins } })
  }

  const beforePending = Number(previous.windows_updates?.pending_count)
  const afterPending = Number(current.windows_updates?.pending_count)
  if (Number.isFinite(beforePending) && Number.isFinite(afterPending) && beforePending !== afterPending) {
    events.push({ eventType: 'windows_updates.pending_changed', category: 'updates', summary: 'SYSTEM: Windows Update pending count changed to ' + afterPending, detail: beforePending + ' → ' + afterPending + ' pending update' + (afterPending === 1 ? '' : 's'), outcome: afterPending < beforePending ? 'success' : 'info', metadata: { before: beforePending, after: afterPending } })
  }

  return events.slice(0, 50)
}

async function ingestInventory(agent, payload) {
  const summary = payload?.summary && typeof payload.summary === 'object' ? payload.summary : {}
  const hardware = payload?.hardware && typeof payload.hardware === 'object' ? payload.hardware : {}
  const os = payload?.os && typeof payload.os === 'object' ? payload.os : {}
  const memory = payload?.memory && typeof payload.memory === 'object' ? payload.memory : {}
  const agentInfo = payload?.agent && typeof payload.agent === 'object' ? payload.agent : {}
  const storage = storageTotals(payload?.storage)
  const collectedAt = clean(payload?.collected_at) || new Date().toISOString()
  const hostname = clean(summary.hostname) || agent.name || 'Windows device'
  await withTransaction(async (client) => {
    const previousResult = await client.query(
      'SELECT source_payload FROM rmm_device_inventory WHERE id=$1 FOR UPDATE',
      [agent.inventory_id],
    )
    const previousPayload = previousResult.rows[0]?.source_payload && typeof previousResult.rows[0].source_payload === 'object'
      ? previousResult.rows[0].source_payload
      : {}

    await client.query(
      `UPDATE rmm_device_inventory SET
         name=$2,
         platform='Windows',
         operating_system=$3,
         os_version=$4,
         manufacturer=$5,
         model=$6,
         serial_number=$7,
         memory_bytes=$8,
         storage_total_bytes=$9,
         storage_free_bytes=$10,
         management_state='managed',
         management_agent='Hi5Central Agent',
         source_last_sync_at=$11::timestamptz,
         last_imported_at=now(),
         active=true,
         source_payload=$12::jsonb,
         updated_at=now()
       WHERE id=$1`,
      [agent.inventory_id, hostname, clean(summary.operating_system || summary.os_name || os.name || 'Windows'), clean(summary.os_version || os.version), clean(hardware.manufacturer || summary.manufacturer), clean(hardware.model || summary.model), clean(hardware.serial_number || summary.serial_number), boundedInteger(memory.total_bytes ?? summary.total_memory_bytes, 0, Number.MAX_SAFE_INTEGER), storage.total, storage.free, collectedAt, JSON.stringify(payload)],
    )
    await client.query(
      `UPDATE rmm_agent_devices SET
         agent_version=COALESCE(NULLIF($2,''),agent_version),
         last_inventory_at=$3::timestamptz,
         last_authenticated_at=now(),
         updated_at=now()
       WHERE id=$1`,
      [agent.id, clean(agentInfo.version), collectedAt],
    )

    for (const event of inventoryDeltaEvents(previousPayload, payload)) {
      await recordRmmActivity({
        tenantId: agent.tenant_id,
        agentDeviceId: agent.id,
        inventoryId: agent.inventory_id,
        actorType: 'system',
        actorLabel: 'SYSTEM',
        ...event,
      }, client)
    }
  })
  recalculateTenantVulnerabilityExposures(agent.tenant_id, [agent.inventory_id]).catch((error) => {
    console.error('RMM vulnerability exposure recalculation failed', agent.inventory_id, error.message)
  })
}

async function packageRows(tenantId) {
  const result = await pool.query(
    `SELECT id,label,token_hint,expires_at,max_uses,use_count,last_used_at,revoked_at,created_at
       FROM rmm_agent_enrollment_packages
      WHERE tenant_id=$1
      ORDER BY created_at DESC
      LIMIT 25`,
    [tenantId],
  )
  return result.rows
}
export function registerRmmAgentRoutes(app) {
  app.get('/api/v1/rmm/agent/enrollment-packages', async (c) => {
    const auth = await requireRmmManager(c)
    if (auth.error) return auth.error
    return c.json({ packages: await packageRows(auth.session.tenant_id), downloadUrl: AGENT_DOWNLOAD_URL })
  })

  app.post('/api/v1/rmm/agent/enrollment-packages', async (c) => {
    const auth = await requireRmmManager(c)
    if (auth.error) return auth.error
    const body = await c.req.json().catch(() => ({}))
    const ttlMinutes = boundedInteger(body.ttlMinutes ?? 60, 5, 1440) || 60
    const maxUses = boundedInteger(body.maxUses ?? 1, 1, 100) || 1
    const token = secret('h5e')
    const label = clean(body.label).slice(0, 120) || 'Windows Agent'
    const result = await pool.query(
      `INSERT INTO rmm_agent_enrollment_packages
         (tenant_id,label,token_hash,token_hint,expires_at,max_uses,created_by_user_id)
       VALUES ($1,$2,$3,$4,now()+make_interval(mins=>$5),$6,$7)
       RETURNING id,label,token_hint,expires_at,max_uses,use_count,created_at`,
      [auth.session.tenant_id, label, sha256(token), token.slice(-6), ttlMinutes, maxUses, auth.session.user_id],
    )
    const pkg = result.rows[0]
    const installCommand = `.\\Hi5CentralAgentSetup.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /ENROLLMENT_TOKEN="${token}" /TENANT_ID="${auth.session.tenant_id}" /PACKAGE_ID="${pkg.id}" /INSTALL_SOURCE="rmm-portal"`
    return c.json({ package: pkg, enrollmentToken: token, downloadUrl: AGENT_DOWNLOAD_URL, installCommand }, 201)
  })

  app.post('/api/v1/rmm/agent/enrollment-packages/:packageId/revoke', async (c) => {
    const auth = await requireRmmManager(c)
    if (auth.error) return auth.error
    const result = await pool.query(
      `UPDATE rmm_agent_enrollment_packages SET revoked_at=now(),updated_at=now()
        WHERE id=$1 AND tenant_id=$2 AND revoked_at IS NULL
        RETURNING id`,
      [clean(c.req.param('packageId')), auth.session.tenant_id],
    )
    if (!result.rowCount) return c.json({ error: 'Enrollment package not found.' }, 404)
    return c.json({ success: true })
  })

  app.post('/api/v1/agent/enroll', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const enrollmentToken = clean(body.enrollmentToken || body.enrollment_token)
    if (!enrollmentToken || enrollmentToken.length > 200) return c.json({ success: false, error: 'A valid enrollment token is required.' }, 400)
    const hostname = clean(body.hostname).slice(0, 255) || 'Windows device'
    const platform = clean(body.platform).slice(0, 50) || 'windows'
    const architecture = clean(body.architecture).slice(0, 50)
    const agentVersion = clean(body.agentVersion || body.agent_version).slice(0, 80)
    const fingerprint = clean(body.fingerprint || body.device_fingerprint).slice(0, 255)
    const tokenHash = sha256(enrollmentToken)

    const enrolled = await withTransaction(async (client) => {
      const packageResult = await client.query(
        `SELECT id,tenant_id,max_uses,use_count,expires_at,revoked_at
           FROM rmm_agent_enrollment_packages
          WHERE token_hash=$1
          FOR UPDATE`,
        [tokenHash],
      )
      const pkg = packageResult.rows[0]
      if (!pkg) return { error: 'Enrollment token is invalid.', status: 401 }
      if (pkg.revoked_at) return { error: 'Enrollment token has been revoked.', status: 410 }
      if (new Date(pkg.expires_at).getTime() <= Date.now()) return { error: 'Enrollment token has expired.', status: 410 }
      if (Number(pkg.use_count) >= Number(pkg.max_uses)) return { error: 'Enrollment token has already been used.', status: 410 }
      const deviceId = randomUUID()
      const deviceKey = secret('h5d')
      const reference = `RMM-${deviceId.slice(0, 8).toUpperCase()}`
      const inventoryResult = await client.query(
        `INSERT INTO rmm_device_inventory
           (tenant_id,source,source_device_id,reference,name,platform,operating_system,
            management_state,management_agent,enrolled_at,source_last_sync_at,active,source_payload)
         VALUES ($1,'hi5central_agent',$2,$3,$4,$5,'Windows','managed','Hi5Central Agent',now(),now(),true,$6::jsonb)
         RETURNING id`,
        [pkg.tenant_id, deviceId, reference, hostname, platform, JSON.stringify({ enrollment: { architecture, agentVersion, fingerprint } })],
      )
      await client.query(
        `INSERT INTO rmm_agent_devices
           (id,tenant_id,inventory_id,secret_hash,fingerprint,architecture,agent_version,enrollment_package_id,last_authenticated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())`,
        [deviceId, pkg.tenant_id, inventoryResult.rows[0].id, sha256(deviceKey), fingerprint, architecture, agentVersion, pkg.id],
      )
      await client.query(
        `UPDATE rmm_agent_enrollment_packages
            SET use_count=use_count+1,last_used_at=now(),updated_at=now()
          WHERE id=$1`,
        [pkg.id],
      )
      return { deviceId, deviceKey, tenantId: pkg.tenant_id, packageId: pkg.id, reference }
    })
    if (enrolled.error) return c.json({ success: false, error: enrolled.error }, enrolled.status)
    recordRmmActivity({
      tenantId: enrolled.tenantId,
      agentDeviceId: enrolled.deviceId,
      actorType: 'agent',
      actorLabel: 'SYSTEM',
      eventType: 'device.enrolled',
      category: 'device',
      summary: 'SYSTEM: Hi5Central Agent enrolled ' + hostname,
      detail: 'Device reference ' + enrolled.reference,
      outcome: 'success',
      metadata: { hostname, architecture, agentVersion, reference: enrolled.reference },
    }).catch(() => {})
    return c.json({
      success: true,
      device_id: enrolled.deviceId,
      device_key: enrolled.deviceKey,
      tenant_id: enrolled.tenantId,
      enrollment_package_id: enrolled.packageId,
      reference: enrolled.reference,
    }, 201)
  })

  app.post('/api/v1/agent/devices/telemetry', async (c) => {
    const agent = await authenticateAgent(c.req.header('x-hi5-device-id'), c.req.header('x-hi5-agent-secret'))
    if (!agent) return c.json({ success: false, error: 'Agent authentication failed.' }, 401)
    const body = await c.req.json().catch(() => ({}))
    await pool.query(
      `UPDATE rmm_agent_devices SET
         cpu_percent=$2,memory_used_percent=$3,memory_total_bytes=$4,memory_used_bytes=$5,
         disk_used_percent=$6,uptime_seconds=$7,active_user=$8,service_status=$9,websocket_status=$10,
         last_authenticated_at=now(),last_telemetry_at=now(),updated_at=now()
       WHERE id=$1`,
      [agent.id, boundedNumber(body.cpuPercent, 0, 100), boundedNumber(body.memoryUsedPercent, 0, 100), boundedInteger(body.memoryTotalBytes, 0, Number.MAX_SAFE_INTEGER), boundedInteger(body.memoryUsedBytes, 0, Number.MAX_SAFE_INTEGER), boundedNumber(body.diskUsedPercent, 0, 100), boundedInteger(body.uptimeSeconds, 0, Number.MAX_SAFE_INTEGER), clean(body.activeUser).slice(0, 255), clean(body.serviceStatus).slice(0, 80), clean(body.websocketStatus).slice(0, 80)],
    )
    await pool.query(`UPDATE rmm_device_inventory SET source_last_sync_at=now(),last_imported_at=now(),updated_at=now() WHERE id=$1`, [agent.inventory_id])
    return c.json({ success: true })
  })
  app.get('/api/v1/agent/devices/jobs', async (c) => {
    const agent = await authenticateAgent(c.req.header('x-hi5-device-id'), c.req.header('x-hi5-agent-secret'))
    if (!agent) return c.json({ success: false, error: 'Agent authentication failed.' }, 401)
    const jobs = await withTransaction(async (client) => {
      await client.query(
        `UPDATE rmm_agent_jobs
            SET status='queued',claimed_at=NULL,updated_at=now()
          WHERE agent_device_id=$1 AND status='claimed'
            AND claimed_at < now()-interval '2 minutes'`,
        [agent.id],
      )
      const result = await client.query(
        `WITH picked AS (
           SELECT id FROM rmm_agent_jobs
            WHERE agent_device_id=$1 AND status='queued'
            ORDER BY created_at
            FOR UPDATE SKIP LOCKED
            LIMIT 10
         )
         UPDATE rmm_agent_jobs j
            SET status='claimed',claimed_at=now(),updated_at=now()
           FROM picked
          WHERE j.id=picked.id
          RETURNING j.id,j.job_type,j.payload,j.created_at`,
        [agent.id],
      )
      return result.rows
    })
    await pool.query(`UPDATE rmm_agent_devices SET last_authenticated_at=now(),updated_at=now() WHERE id=$1`, [agent.id])
    return c.json({ success: true, jobs })
  })

  app.post('/api/v1/agent/devices/jobs/:jobId/result', async (c) => {
    const agent = await authenticateAgent(c.req.header('x-hi5-device-id'), c.req.header('x-hi5-agent-secret'))
    if (!agent) return c.json({ success: false, error: 'Agent authentication failed.' }, 401)
    const body = await c.req.json().catch(() => ({}))
    const success = Boolean(body.success)
    const resultPayload = body.result && typeof body.result === 'object' ? body.result : {}
    const errorMessage = clean(body.error).slice(0, 2000) || null
    const result = await pool.query(
      `UPDATE rmm_agent_jobs
          SET status=$4,result=$5::jsonb,error_message=$6,completed_at=now(),updated_at=now()
        WHERE id=$1 AND agent_device_id=$2 AND tenant_id=$3 AND status IN ('claimed','queued')
        RETURNING id,tenant_id,agent_device_id,job_type,payload,status,result,error_message,
                  queued_by_user_id,initiated_by,initiated_by_label,correlation_id,request_metadata,created_at,claimed_at,completed_at`,
      [clean(c.req.param('jobId')), agent.id, agent.tenant_id, success ? 'completed' : 'failed', JSON.stringify(resultPayload), errorMessage],
    )
    if (!result.rowCount) return c.json({ success: false, error: 'Job not found or already completed.' }, 404)
    const completedJob = { ...result.rows[0], inventory_id: agent.inventory_id }

    if (completedJob.job_type === 'patch.software') {
      const rebootRequired = Boolean(resultPayload.rebootRequired || resultPayload.reboot_required)
      const verificationFailed = Boolean(resultPayload.verificationFailed || resultPayload.verification_failed)
      const installerOutput = clean(resultPayload.installerOutput || resultPayload.installer_output).toLowerCase()
      const providerNoUpgrade = verificationFailed
        && clean(resultPayload.provider).toLowerCase() === 'winget'
        && (
          clean(resultPayload.error).toLowerCase() === 'provider_no_upgrade'
          || installerOutput.includes('no available upgrade found')
          || installerOutput.includes('no newer package versions are available')
        )
      const deploymentStatus = success
        ? (rebootRequired ? 'reboot_required' : 'succeeded')
        : (verificationFailed ? 'verification_failed' : 'failed')
      await withTransaction(async (client) => {
        const deployment = await client.query(
          `UPDATE rmm_patch_deployments
              SET status=$4,result=$5::jsonb,completed_at=now(),updated_at=now()
            WHERE tenant_id=$1 AND agent_job_id=$2 AND inventory_id=$3
            RETURNING catalogue_id`,
          [agent.tenant_id, completedJob.id, agent.inventory_id, deploymentStatus, JSON.stringify(resultPayload)],
        )
        if (!success && deployment.rowCount && deployment.rows[0].catalogue_id) {
          await client.query(
            `UPDATE rmm_vulnerability_exposures
                SET remediation_state='available',last_seen_at=now()
              WHERE tenant_id=$1 AND inventory_id=$2 AND catalogue_id=$3
                AND status='open' AND remediation_state='in_progress'`,
            [agent.tenant_id, agent.inventory_id, deployment.rows[0].catalogue_id],
          )
        }

        if (providerNoUpgrade) {
          const packageId = clean(resultPayload.packageId || completedJob.payload?.packageId)
          if (packageId) {
            await client.query(
              `UPDATE rmm_software_patch_observations
                  SET patch_status='provider_blocked',
                      evidence=evidence || jsonb_build_object(
                        'providerBlockedReason','winget_no_available_upgrade',
                        'providerBlockedAt',now(),
                        'providerBlockedJobId',$4,
                        'providerBlockedDetail','WinGet reports no available upgrade while exact-package verification still finds an instance below target.'
                      ),
                      updated_at=now()
                WHERE tenant_id=$1 AND inventory_id=$2
                  AND lower(provider_package_id)=lower($3)`,
              [agent.tenant_id, agent.inventory_id, packageId, completedJob.id],
            )
          }
        }
      }).catch((error) => console.error('RMM patch deployment result update failed', completedJob.id, error.message))
    }

    await recordJobCompletionActivity(completedJob, success, resultPayload, errorMessage).catch((error) => {
      console.error('RMM activity job logging failed', completedJob.id, error.message)
    })
    await pool.query(`UPDATE rmm_agent_devices SET last_authenticated_at=now(),updated_at=now() WHERE id=$1`, [agent.id])
    return c.json({ success: true })
  })
}

const liveAgentSockets = new Map()
const agentMessageSubscribers = new Map()

export function agentSocketForDevice(deviceId) {
  return liveAgentSockets.get(String(deviceId)) || null
}

export function sendAgentMessage(deviceId, payload) {
  const socket = agentSocketForDevice(deviceId)
  if (!socket || socket.readyState !== 1) return false
  try {
    socket.send(typeof payload === 'string' ? payload : JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export function subscribeAgentMessages(deviceId, handler) {
  const key = String(deviceId)
  if (!agentMessageSubscribers.has(key)) agentMessageSubscribers.set(key, new Set())
  const subscribers = agentMessageSubscribers.get(key)
  subscribers.add(handler)
  return () => {
    subscribers.delete(handler)
    if (!subscribers.size) agentMessageSubscribers.delete(key)
  }
}

export function attachRmmAgentWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_INVENTORY_BYTES })
  server.on('upgrade', async (request, socket, head) => {
    let url
    try { url = new URL(request.url || '/', 'http://localhost') } catch { return }
    if (url.pathname !== '/agent/ws') return

    const deviceId = clean(url.searchParams.get('device_id'))
    const deviceKey = clean(url.searchParams.get('device_key'))
    const agent = await authenticateAgent(deviceId, deviceKey).catch(() => null)
    if (!agent) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.hi5Agent = agent
      wss.emit('connection', ws, request)
    })
  })

  wss.on('connection', async (ws) => {
    const agent = ws.hi5Agent
    liveAgentSockets.set(String(agent.id), ws)
    await pool.query(
      `UPDATE rmm_agent_devices SET websocket_status='Connected',websocket_connected_at=now(),last_authenticated_at=now(),updated_at=now() WHERE id=$1`,
      [agent.id],
    ).catch(() => {})
    recordRmmActivity({
      tenantId: agent.tenant_id,
      agentDeviceId: agent.id,
      inventoryId: agent.inventory_id,
      actorType: 'agent',
      actorLabel: 'SYSTEM',
      eventType: 'agent.connected',
      category: 'device',
      summary: 'SYSTEM: Hi5Central Agent connected',
      detail: agent.name || agent.reference || '',
      outcome: 'success',
      metadata: { reference: agent.reference || '', deviceName: agent.name || '' },
    }).catch(() => {})
    ws.on('message', (buffer) => {
      const text = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer)
      let payload
      try { payload = JSON.parse(text) } catch { return }
      if (!payload || typeof payload !== 'object') return

      const subscribers = agentMessageSubscribers.get(String(agent.id))
      if (subscribers?.size) {
        for (const handler of [...subscribers]) {
          try { handler(payload) } catch {}
        }
      }

      if (payload.type === 'hello') {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'hello_ack' }))
        return
      }
      if (payload.type === 'inventory_snapshot') {
        if (clean(payload.device_id) && clean(payload.device_id) !== String(agent.id)) return
        ingestInventory(agent, payload).catch((error) => console.error('RMM inventory ingest failed', agent.id, error.message))
      }
    })

    ws.on('close', () => {
      if (liveAgentSockets.get(String(agent.id)) === ws) liveAgentSockets.delete(String(agent.id))
      pool.query(
        `UPDATE rmm_agent_devices SET websocket_status='Disconnected',websocket_disconnected_at=now(),updated_at=now() WHERE id=$1`,
        [agent.id],
      ).catch(() => {})
      pool.query(
        `UPDATE rmm_agent_jobs
            SET status='cancelled',completed_at=now(),updated_at=now(),
                error_message=COALESCE(error_message,'Device went offline before the job started. The job was not retained for reconnect.')
          WHERE agent_device_id=$1 AND tenant_id=$2 AND status='queued'
          RETURNING id,job_type,initiated_by_label,queued_by_user_id,correlation_id`,
        [agent.id, agent.tenant_id],
      ).then((cancelled) => Promise.all(cancelled.rows.map((job) => recordRmmActivity({
        tenantId: agent.tenant_id,
        agentDeviceId: agent.id,
        inventoryId: agent.inventory_id,
        actorUserId: job.queued_by_user_id,
        actorType: 'system',
        actorLabel: 'SYSTEM',
        eventType: 'job.cancelled_offline',
        category: 'job',
        summary: 'SYSTEM: cancelled queued ' + job.job_type + ' because the device went offline',
        detail: job.initiated_by_label ? 'Originally requested by ' + job.initiated_by_label + '.' : 'The job had not started.',
        outcome: 'cancelled',
        severity: 'warning',
        jobId: job.id,
        correlationId: job.correlation_id,
        metadata: { reason: 'device_offline_before_start', requestedBy: job.initiated_by_label || '' },
      })))).catch(() => {})
      recordRmmActivity({
        tenantId: agent.tenant_id,
        agentDeviceId: agent.id,
        inventoryId: agent.inventory_id,
        actorType: 'agent',
        actorLabel: 'SYSTEM',
        eventType: 'agent.disconnected',
        category: 'device',
        summary: 'SYSTEM: Hi5Central Agent disconnected',
        detail: agent.name || agent.reference || '',
        outcome: 'info',
        severity: 'warning',
        metadata: { reference: agent.reference || '', deviceName: agent.name || '' },
      }).catch(() => {})
    })
  })

  return wss
}
