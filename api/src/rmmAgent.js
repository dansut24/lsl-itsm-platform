import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { WebSocketServer } from 'ws'
import { hasPermission } from './access.js'
import { originMatchesTenant } from './deploymentConfig.js'
import { pool, withTransaction } from './db.js'
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

async function authenticateAgent(deviceId, deviceSecret) {
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
    const result = await pool.query(
      `UPDATE rmm_agent_jobs
          SET status=$4,result=$5::jsonb,error_message=$6,completed_at=now(),updated_at=now()
        WHERE id=$1 AND agent_device_id=$2 AND tenant_id=$3 AND status IN ('claimed','queued')
        RETURNING id`,
      [clean(c.req.param('jobId')), agent.id, agent.tenant_id, success ? 'completed' : 'failed', JSON.stringify(body.result && typeof body.result === 'object' ? body.result : {}), clean(body.error).slice(0, 2000) || null],
    )
    if (!result.rowCount) return c.json({ success: false, error: 'Job not found or already completed.' }, 404)
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
    })
  })

  return wss
}