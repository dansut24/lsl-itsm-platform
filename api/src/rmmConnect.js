import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { WebSocketServer } from 'ws'
import { hasPermission } from './access.js'
import { deployment, originMatchesTenant, tenantUrls } from './deploymentConfig.js'
import { pool } from './db.js'
import { recordRmmActivity } from './rmmActivity.js'
import { resolveSession } from './session.js'

const ROOT_DOMAIN = deployment.rootDomain
const CONNECT_PUBLIC_URL = process.env.CONNECT_PUBLIC_URL || `https://connect.${ROOT_DOMAIN}`
const CONNECT_VIEWER_WS_URL = process.env.CONNECT_VIEWER_WS_URL || `wss://rmm.${ROOT_DOMAIN}/connect/viewer/ws`
const VIEWER_DOWNLOAD_URL = process.env.VIEWER_DOWNLOAD_URL || `https://downloads.${ROOT_DOMAIN}/viewer/latest/Hi5CentralViewerSetup.exe`
const TURN_HOST = process.env.TURN_HOST || `turn.${ROOT_DOMAIN}`
const TURN_SHARED_SECRET_FILE = process.env.TURN_SHARED_SECRET_FILE || '/run/secrets/turn_shared_secret'
const WAITING_TTL_SECONDS = 20 * 60
const ACTIVE_TTL_SECONDS = 8 * 60 * 60
const MAX_WS_PAYLOAD_BYTES = 8 * 1024 * 1024
const CLAIM_WINDOW_MS = 60 * 1000
const CLAIM_ATTEMPTS_PER_WINDOW = 8

const activeConnectHosts = new Map()
const activeConnectViewers = new Map()
const claimBuckets = new Map()

const HOST_RELAY_TYPES = new Set([
  'webrtc_offer', 'offer', 'ice_candidate', 'candidate', 'webrtc_ice_candidate',
  'remote_state', 'remote_error', 'monitor_list', 'chat_message', 'chat_close',
])
const VIEWER_RELAY_TYPES = new Set([
  'webrtc_answer', 'answer', 'ice_candidate', 'candidate', 'viewer_answer',
  'switch_monitor', 'input_event', 'chat_message', 'chat_close',
  'viewer_disconnected', 'viewer_closed', 'viewer_left', 'end_session', 'stop_webrtc',
])

function clean(value = '') { return String(value ?? '').trim() }
function sha256(value = '') { return createHash('sha256').update(String(value)).digest('hex') }
function randomSecret(prefix) { return `${prefix}_${randomBytes(32).toString('base64url')}` }
function safeSend(ws, payload) {
  if (!ws || ws.readyState !== 1) return false
  try { ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload)); return true } catch { return false }
}
function supportCode() {
  const digits = String(randomInt(10000000, 100000000))
  return `${digits.slice(0, 4)}-${digits.slice(4)}`
}
function normalizeCode(value = '') {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length === 8 ? digits : ''
}
function publicOriginAllowed(c) {
  const origin = clean(c.req.header('origin')).toLowerCase()
  return !origin || origin === CONNECT_PUBLIC_URL.toLowerCase()
}
function clientAddress(c) {
  return clean(c.req.header('x-forwarded-for')).split(',')[0].trim() || clean(c.req.header('x-real-ip')) || 'unknown'
}
function claimRateAllowed(c) {
  const key = clientAddress(c)
  const now = Date.now()
  const previous = claimBuckets.get(key)
  if (!previous || now - previous.startedAt >= CLAIM_WINDOW_MS) {
    claimBuckets.set(key, { startedAt: now, attempts: 1 })
    return true
  }
  previous.attempts += 1
  if (claimBuckets.size > 5000) {
    for (const [bucketKey, bucket] of claimBuckets) {
      if (now - bucket.startedAt >= CLAIM_WINDOW_MS) claimBuckets.delete(bucketKey)
    }
  }
  return previous.attempts <= CLAIM_ATTEMPTS_PER_WINDOW
}
function turnSharedSecret() {
  try { return clean(readFileSync(TURN_SHARED_SECRET_FILE, 'utf8')) } catch { return '' }
}
function iceConfiguration(sessionId) {
  const viewer = [
    { urls: `stun:${TURN_HOST}:3478` },
    { urls: 'stun:stun.l.google.com:19302' },
  ]
  const host = [`stun:${TURN_HOST}:3478`, 'stun:stun.l.google.com:19302']
  const secret = turnSharedSecret()
  if (!secret) return { viewer, host }
  const expiry = Math.floor(Date.now() / 1000) + WAITING_TTL_SECONDS + 300
  const username = `${expiry}:${clean(sessionId)}`
  const credential = createHmac('sha1', secret).update(username).digest('base64')
  viewer.push({
    urls: [`turn:${TURN_HOST}:3478?transport=udp`, `turn:${TURN_HOST}:3478?transport=tcp`],
    username,
    credential,
  })
  const user = encodeURIComponent(username)
  const pass = encodeURIComponent(credential)
  host.push(`turn:${user}:${pass}@${TURN_HOST}:3478?transport=udp`)
  return { viewer, host }
}
function browserLaunchUrl(slug, connection) {
  const ice = Buffer.from(JSON.stringify(connection.iceServers), 'utf8').toString('base64url')
  const fragment = new URLSearchParams({
    session_id: connection.sessionId,
    device_id: connection.deviceId,
    token: connection.token,
    wss_url: connection.wssUrl,
    mode: 'console',
    ice,
  })
  const base = tenantUrls(slug, { rmm: true }).rmmUrl || `https://${slug}-rmm.${ROOT_DOMAIN}`
  return `${base.replace(/\/$/, '')}/rmm-viewer/index.html#${fragment.toString()}`
}
function nativeLaunchUrl(connection) {
  const query = new URLSearchParams({
    session_id: connection.sessionId,
    device_id: connection.deviceId,
    token: connection.token,
    wss_url: connection.wssUrl,
    mode: 'console',
  })
  return `hi5central-viewer://connect?${query.toString()}`
}
function hostDownloadUrl(ticket) {
  const encoded = encodeURIComponent(ticket)
  return `https://downloads.${ROOT_DOMAIN}/connect/download/Hi5CentralConnect-${encoded}.exe`
}
async function requireConnectAccess(c) {
  const session = await resolveSession(c)
  if (!session) return { error: c.json({ error: 'Authentication required.' }, 401) }
  if (!originMatchesTenant(c.req.header('origin'), session.slug)) {
    return { error: c.json({ error: 'Tenant session mismatch.' }, 403) }
  }
  if (!hasPermission(session.access, 'rmm.devices.remote')) {
    return { error: c.json({ error: 'You do not have permission to create remote support sessions.' }, 403) }
  }
  return { session }
}
async function connectSessionForTenant(id, tenantId) {
  const result = await pool.query(
    `SELECT c.*,COALESCE(NULLIF(u.name,''),u.email,'Hi5Central technician') AS technician,
            COALESCE(NULLIF(t.company_name,''),t.slug,'Hi5Central') AS tenant_name,t.slug AS tenant_slug
       FROM rmm_connect_sessions c
       LEFT JOIN users u ON u.id=c.created_by_user_id
       JOIN tenants t ON t.id=c.tenant_id
      WHERE c.id=$1 AND c.tenant_id=$2 LIMIT 1`,
    [id, tenantId],
  )
  return result.rows[0] || null
}
async function expireOldSessions() {
  await pool.query(
    `UPDATE rmm_connect_sessions
        SET status='expired',ended_at=COALESCE(ended_at,now()),end_reason=COALESCE(end_reason,'expired'),updated_at=now()
      WHERE expires_at<=now() AND status IN ('waiting','claimed','host_connected','viewer_connected')`,
  ).catch(() => {})
}
async function endConnectSession(sessionId, reason, actor = null) {
  const result = await pool.query(
    `UPDATE rmm_connect_sessions
        SET status=CASE WHEN status='expired' THEN status ELSE 'ended' END,
            ended_at=COALESCE(ended_at,now()),end_reason=COALESCE(end_reason,$2),updated_at=now()
      WHERE id=$1 AND ended_at IS NULL
      RETURNING tenant_id,created_by_user_id,started_at,ended_at,status`,
    [sessionId, reason],
  )
  const hostWs = activeConnectHosts.get(String(sessionId))
  const viewerWs = activeConnectViewers.get(String(sessionId))
  safeSend(hostWs, { type: 'end_session', session_id: String(sessionId), reason })
  safeSend(viewerWs, { type: 'session_terminated', session_id: String(sessionId), reason })
  try { hostWs?.close(4000, 'Support session ended') } catch {}
  try { viewerWs?.close(4000, 'Support session ended') } catch {}
  activeConnectHosts.delete(String(sessionId))
  activeConnectViewers.delete(String(sessionId))
  if (result.rowCount) {
    const row = result.rows[0]
    const label = clean(actor?.label) || 'SYSTEM'
    recordRmmActivity({
      tenantId: row.tenant_id,
      actorUserId: actor?.userId || row.created_by_user_id || null,
      actorType: actor?.type || 'system',
      actorLabel: label,
      eventType: 'connect.session_ended',
      category: 'remote',
      summary: label + ' ended a Hi5Central Connect session',
      detail: 'Ad-hoc support access ended. No managed Agent enrollment was created.',
      outcome: 'success',
      metadata: { connectSessionId: String(sessionId), reason },
    }).catch(() => {})
  }
  return result.rows[0] || null
}

export function registerRmmConnectRoutes(app) {
  app.post('/api/v1/rmm/connect-sessions', async (c) => {
    const auth = await requireConnectAccess(c)
    if (auth.error) return auth.error
    await expireOldSessions()
    const id = randomUUID()
    const code = supportCode()
    const normalizedCode = normalizeCode(code)
    const expiresAt = new Date(Date.now() + WAITING_TTL_SECONDS * 1000)
    await pool.query(
      `INSERT INTO rmm_connect_sessions
         (id,tenant_id,created_by_user_id,support_code_hash,support_code_hint,status,expires_at,last_activity_at)
       VALUES ($1,$2,$3,$4,$5,'waiting',$6,now())`,
      [id, auth.session.tenant_id, auth.session.user_id, sha256(normalizedCode), normalizedCode.slice(-2), expiresAt],
    )
    const technician = clean(auth.session.name || auth.session.email) || 'Technician'
    recordRmmActivity({
      tenantId: auth.session.tenant_id,
      actorUserId: auth.session.user_id,
      actorType: 'technician',
      actorLabel: technician,
      eventType: 'connect.session_created',
      category: 'remote',
      summary: technician + ' created a Hi5Central Connect support code',
      detail: 'The code is short-lived and can be claimed once by the customer.',
      outcome: 'requested',
      metadata: { connectSessionId: id, expiresAt: expiresAt.toISOString() },
    }).catch(() => {})
    return c.json({
      session: {
        id,
        code,
        status: 'waiting',
        expiresAt: expiresAt.toISOString(),
        publicUrl: CONNECT_PUBLIC_URL,
      },
    }, 201)
  })

  app.get('/api/v1/rmm/connect-sessions', async (c) => {
    const auth = await requireConnectAccess(c)
    if (auth.error) return auth.error
    await expireOldSessions()
    const result = await pool.query(
      `SELECT c.id,c.support_code_hint,c.viewer_client,c.status,c.expires_at,c.claimed_at,c.host_connected_at,
              c.viewer_connected_at,c.started_at,c.ended_at,c.last_activity_at,c.end_reason,c.host_name,c.host_platform,
              c.host_version,c.created_at,COALESCE(NULLIF(u.name,''),u.email,'Hi5Central technician') AS technician
         FROM rmm_connect_sessions c
         LEFT JOIN users u ON u.id=c.created_by_user_id
        WHERE c.tenant_id=$1
        ORDER BY c.created_at DESC
        LIMIT 50`,
      [auth.session.tenant_id],
    )
    return c.json({ sessions: result.rows, publicUrl: CONNECT_PUBLIC_URL })
  })

  app.get('/api/v1/rmm/connect-sessions/:sessionId', async (c) => {
    const auth = await requireConnectAccess(c)
    if (auth.error) return auth.error
    await expireOldSessions()
    const row = await connectSessionForTenant(clean(c.req.param('sessionId')), auth.session.tenant_id)
    if (!row) return c.json({ error: 'Connect session not found.' }, 404)
    return c.json({ session: row, publicUrl: CONNECT_PUBLIC_URL })
  })

  app.post('/api/v1/rmm/connect-sessions/:sessionId/viewer', async (c) => {
    const auth = await requireConnectAccess(c)
    if (auth.error) return auth.error
    const sessionId = clean(c.req.param('sessionId'))
    const row = await connectSessionForTenant(sessionId, auth.session.tenant_id)
    if (!row) return c.json({ error: 'Connect session not found.' }, 404)
    if (!['host_connected','viewer_connected','active'].includes(row.status) || new Date(row.expires_at).getTime() <= Date.now()) {
      return c.json({ error: 'The customer Connect app is not online.' }, 409)
    }
    const body = await c.req.json().catch(() => ({}))
    const viewerClient = clean(body.viewerClient).toLowerCase() === 'native' ? 'native' : 'browser'
    const token = randomSecret('h5cv')
    await pool.query(
      `UPDATE rmm_connect_sessions
          SET viewer_token_hash=$2,viewer_client=$3,last_activity_at=now(),
              expires_at=GREATEST(expires_at,now() + ($4::text || ' seconds')::interval),updated_at=now()
        WHERE id=$1`,
      [sessionId, sha256(token), viewerClient, ACTIVE_TTL_SECONDS],
    )
    const ice = iceConfiguration(sessionId)
    const connection = {
      sessionId,
      deviceId: sessionId,
      token,
      wssUrl: CONNECT_VIEWER_WS_URL,
      mode: 'console',
      iceServers: ice.viewer,
    }
    return c.json({
      session: { id: sessionId, status: row.status, hostName: row.host_name || 'Customer computer' },
      viewerClient,
      connection,
      browserUrl: viewerClient === 'browser' ? browserLaunchUrl(auth.session.slug, connection) : null,
      nativeUrl: viewerClient === 'native' ? nativeLaunchUrl(connection) : null,
      viewerDownloadUrl: viewerClient === 'native' ? VIEWER_DOWNLOAD_URL : null,
    })
  })

  app.post('/api/v1/rmm/connect-sessions/:sessionId/terminate', async (c) => {
    const auth = await requireConnectAccess(c)
    if (auth.error) return auth.error
    const sessionId = clean(c.req.param('sessionId'))
    const row = await connectSessionForTenant(sessionId, auth.session.tenant_id)
    if (!row) return c.json({ error: 'Connect session not found.' }, 404)
    const technician = clean(auth.session.name || auth.session.email) || 'Technician'
    await endConnectSession(sessionId, 'terminated_by_technician', {
      userId: auth.session.user_id,
      type: 'technician',
      label: technician,
    })
    return c.json({ session: { id: sessionId, status: 'ended' } })
  })

  app.post('/api/v1/connect/lookup', async (c) => {
    if (!publicOriginAllowed(c)) return c.json({ error: 'Invalid Connect origin.' }, 403)
    if (!claimRateAllowed(c)) return c.json({ error: 'Too many code attempts. Please wait a minute and try again.' }, 429)
    const body = await c.req.json().catch(() => ({}))
    const normalizedCode = normalizeCode(body.code)
    if (!normalizedCode) return c.json({ error: 'Enter the 8-digit support code.' }, 400)
    await expireOldSessions()
    const result = await pool.query(
      `SELECT c.id,c.expires_at,
              COALESCE(NULLIF(u.name,''),u.email,'Hi5Central technician') AS technician,
              COALESCE(NULLIF(t.company_name,''),t.slug,'Hi5Central') AS tenant_name
         FROM rmm_connect_sessions c
         LEFT JOIN users u ON u.id=c.created_by_user_id
         JOIN tenants t ON t.id=c.tenant_id
        WHERE c.support_code_hash=$1 AND c.status='waiting' AND c.expires_at>now()
        LIMIT 1`,
      [sha256(normalizedCode)],
    )
    if (!result.rowCount) return c.json({ error: 'That support code is not valid or has expired.' }, 404)
    const row = result.rows[0]
    return c.json({
      session: {
        id: row.id,
        technician: row.technician,
        organisation: row.tenant_name,
        expiresAt: row.expires_at,
      },
    })
  })

  app.post('/api/v1/connect/claim', async (c) => {
    if (!publicOriginAllowed(c)) return c.json({ error: 'Invalid Connect origin.' }, 403)
    if (!claimRateAllowed(c)) return c.json({ error: 'Too many code attempts. Please wait a minute and try again.' }, 429)
    const body = await c.req.json().catch(() => ({}))
    if (body.consent !== true) return c.json({ error: 'Consent is required before downloading Hi5Central Connect.' }, 400)
    const normalizedCode = normalizeCode(body.code)
    if (!normalizedCode) return c.json({ error: 'Enter the 8-digit support code.' }, 400)
    await expireOldSessions()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await client.query(
        `SELECT c.id,c.tenant_id,c.created_by_user_id,c.status,c.expires_at,
                COALESCE(NULLIF(u.name,''),u.email,'Hi5Central technician') AS technician,
                COALESCE(NULLIF(t.company_name,''),t.slug,'Hi5Central') AS tenant_name
           FROM rmm_connect_sessions c
           LEFT JOIN users u ON u.id=c.created_by_user_id
           JOIN tenants t ON t.id=c.tenant_id
          WHERE c.support_code_hash=$1
          FOR UPDATE OF c
          LIMIT 1`,
        [sha256(normalizedCode)],
      )
      if (!result.rowCount) {
        await client.query('ROLLBACK')
        return c.json({ error: 'That support code is not valid or has expired.' }, 404)
      }
      const row = result.rows[0]
      if (row.status !== 'waiting' || new Date(row.expires_at).getTime() <= Date.now()) {
        await client.query('ROLLBACK')
        return c.json({ error: 'That support code has already been used or has expired.' }, 409)
      }
      const ticket = randomSecret('h5ch')
      await client.query(
        `UPDATE rmm_connect_sessions
            SET host_ticket_hash=$2,status='claimed',claimed_at=now(),customer_consent_at=now(),
                claim_attempt_count=claim_attempt_count+1,last_activity_at=now(),updated_at=now()
          WHERE id=$1`,
        [row.id, sha256(ticket)],
      )
      await client.query('COMMIT')
      recordRmmActivity({
        tenantId: row.tenant_id,
        actorType: 'user',
        actorLabel: 'Customer',
        eventType: 'connect.customer_claimed',
        category: 'remote',
        summary: 'Customer accepted a Hi5Central Connect support session',
        detail: 'The customer explicitly consented before receiving the one-time portable support app.',
        outcome: 'success',
        metadata: { connectSessionId: String(row.id) },
      }).catch(() => {})
      return c.json({
        session: {
          id: row.id,
          technician: row.technician,
          organisation: row.tenant_name,
          expiresAt: row.expires_at,
        },
        downloadUrl: hostDownloadUrl(ticket),
      })
    } catch (error) {
      try { await client.query('ROLLBACK') } catch {}
      throw error
    } finally {
      client.release()
    }
  })
}

async function authenticateHost(ticket) {
  if (!clean(ticket)) return null
  const result = await pool.query(
    `SELECT c.id,c.tenant_id,c.created_by_user_id,c.status,c.expires_at,
            COALESCE(NULLIF(u.name,''),u.email,'Hi5Central technician') AS technician,
            COALESCE(NULLIF(t.company_name,''),t.slug,'Hi5Central') AS tenant_name
       FROM rmm_connect_sessions c
       LEFT JOIN users u ON u.id=c.created_by_user_id
       JOIN tenants t ON t.id=c.tenant_id
      WHERE c.host_ticket_hash=$1
        AND c.status IN ('claimed','host_connected','viewer_connected','active')
        AND c.expires_at>now()
      LIMIT 1`,
    [sha256(ticket)],
  )
  return result.rows[0] || null
}

async function authenticateConnectViewer(sessionId, token) {
  if (!clean(sessionId) || !clean(token)) return null
  const result = await pool.query(
    `SELECT c.id,c.tenant_id,c.created_by_user_id,c.status,c.expires_at,c.viewer_client,c.host_name,
            COALESCE(NULLIF(u.name,''),u.email,'Hi5Central technician') AS technician
       FROM rmm_connect_sessions c
       LEFT JOIN users u ON u.id=c.created_by_user_id
      WHERE c.id=$1 AND c.viewer_token_hash=$2
        AND c.status IN ('host_connected','viewer_connected','active')
        AND c.expires_at>now()
      LIMIT 1`,
    [clean(sessionId), sha256(token)],
  )
  return result.rows[0] || null
}

export function attachRmmConnectWebSockets(server) {
  const hostWss = new WebSocketServer({ noServer: true, maxPayload: MAX_WS_PAYLOAD_BYTES })
  const viewerWss = new WebSocketServer({ noServer: true, maxPayload: MAX_WS_PAYLOAD_BYTES })

  server.on('upgrade', async (request, socket, head) => {
    let url
    try { url = new URL(request.url || '/', 'http://localhost') } catch { return }
    if (url.pathname === '/connect/host/ws') {
      const hostSession = await authenticateHost(url.searchParams.get('ticket')).catch(() => null)
      if (!hostSession) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
        socket.destroy()
        return
      }
      hostWss.handleUpgrade(request, socket, head, (ws) => {
        ws.hi5ConnectSession = hostSession
        hostWss.emit('connection', ws, request)
      })
      return
    }
    if (url.pathname === '/connect/viewer/ws') {
      const viewerSession = await authenticateConnectViewer(
        url.searchParams.get('session_id'),
        url.searchParams.get('token'),
      ).catch(() => null)
      if (!viewerSession) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
        socket.destroy()
        return
      }
      const requestedClient = clean(url.searchParams.get('client')).toLowerCase()
      if (viewerSession.viewer_client === 'browser' && requestedClient !== 'browser') {
        socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
        socket.destroy()
        return
      }
      if (viewerSession.viewer_client === 'native' && requestedClient === 'browser') {
        socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
        socket.destroy()
        return
      }
      viewerWss.handleUpgrade(request, socket, head, (ws) => {
        ws.hi5ConnectSession = viewerSession
        viewerWss.emit('connection', ws, request)
      })
    }
  })

  hostWss.on('connection', async (hostWs) => {
    const remote = hostWs.hi5ConnectSession
    const sessionId = String(remote.id)
    const previous = activeConnectHosts.get(sessionId)
    if (previous && previous !== hostWs) {
      try { previous.close(4001, 'Reconnected') } catch {}
    }
    activeConnectHosts.set(sessionId, hostWs)
    await pool.query(
      `UPDATE rmm_connect_sessions
          SET status=CASE WHEN status='active' THEN status WHEN status='viewer_connected' THEN status ELSE 'host_connected' END,
              host_connected_at=COALESCE(host_connected_at,now()),last_activity_at=now(),
              expires_at=GREATEST(expires_at,now() + ($2::text || ' seconds')::interval),updated_at=now()
        WHERE id=$1`,
      [sessionId, ACTIVE_TTL_SECONDS],
    ).catch(() => {})
    safeSend(hostWs, {
      type: 'connect_ready',
      session_id: sessionId,
      technician_name: remote.technician,
      organisation_name: remote.tenant_name,
    })

    hostWs.on('message', (buffer) => {
      const text = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer)
      let payload
      try { payload = JSON.parse(text) } catch { return }
      const type = clean(payload?.type)
      if (type === 'connect_hello') {
        pool.query(
          `UPDATE rmm_connect_sessions
              SET host_name=$2,host_platform=$3,host_version=$4,last_activity_at=now(),updated_at=now()
            WHERE id=$1`,
          [sessionId, clean(payload.host_name).slice(0, 255), clean(payload.platform).slice(0, 120), clean(payload.version).slice(0, 80)],
        ).catch(() => {})
        return
      }
      if (type === 'session_ended' || type === 'host_closed') {
        endConnectSession(sessionId, 'customer_closed_app').catch(() => {})
        return
      }
      if (!HOST_RELAY_TYPES.has(type)) return
      payload.session_id = sessionId
      delete payload.sessionId
      const viewerWs = activeConnectViewers.get(sessionId)
      safeSend(viewerWs, payload)
      if (type === 'webrtc_offer' || type === 'offer') {
        pool.query(
          `UPDATE rmm_connect_sessions
              SET status='active',started_at=COALESCE(started_at,now()),last_activity_at=now(),updated_at=now()
            WHERE id=$1`,
          [sessionId],
        ).then(() => {
          recordRmmActivity({
            tenantId: remote.tenant_id,
            actorUserId: remote.created_by_user_id,
            actorType: 'technician',
            actorLabel: remote.technician,
            eventType: 'connect.session_started',
            category: 'remote',
            summary: remote.technician + ' started a Hi5Central Connect remote support session',
            detail: 'The customer is running the temporary Hi5Central Connect app. No managed Agent was installed.',
            outcome: 'success',
            metadata: { connectSessionId: sessionId },
          }).catch(() => {})
        }).catch(() => {})
      } else {
        pool.query(`UPDATE rmm_connect_sessions SET last_activity_at=now(),updated_at=now() WHERE id=$1`, [sessionId]).catch(() => {})
      }
    })

    let closed = false
    const handleClose = () => {
      if (closed) return
      closed = true
      if (activeConnectHosts.get(sessionId) !== hostWs) return
      activeConnectHosts.delete(sessionId)
      endConnectSession(sessionId, 'customer_closed_app').catch(() => {})
    }
    hostWs.once('close', handleClose)
    hostWs.once('error', handleClose)
  })

  viewerWss.on('connection', async (viewerWs) => {
    const remote = viewerWs.hi5ConnectSession
    const sessionId = String(remote.id)
    const hostWs = activeConnectHosts.get(sessionId)
    if (!hostWs || hostWs.readyState !== 1) {
      safeSend(viewerWs, { type: 'viewer_error', session_id: sessionId, error: 'Customer Connect app is not online.' })
      try { viewerWs.close(4004, 'Customer offline') } catch {}
      return
    }
    const previous = activeConnectViewers.get(sessionId)
    if (previous && previous !== viewerWs) {
      try { previous.close(4001, 'Viewer superseded') } catch {}
    }
    activeConnectViewers.set(sessionId, viewerWs)
    await pool.query(
      `UPDATE rmm_connect_sessions
          SET status=CASE WHEN started_at IS NULL THEN 'viewer_connected' ELSE 'active' END,
              viewer_connected_at=COALESCE(viewer_connected_at,now()),last_activity_at=now(),
              expires_at=GREATEST(expires_at,now() + ($2::text || ' seconds')::interval),updated_at=now()
        WHERE id=$1`,
      [sessionId, ACTIVE_TTL_SECONDS],
    ).catch(() => {})
    const ice = iceConfiguration(sessionId)
    safeSend(viewerWs, { type: 'viewer_connected', session_id: sessionId })
    safeSend(viewerWs, { type: 'session_config', session_id: sessionId, mode: 'console', ice_servers: ice.viewer })
    safeSend(hostWs, {
      type: 'start_webrtc',
      session_id: sessionId,
      mode: 'console',
      technician_name: remote.technician,
      iceServers: ice.host,
    })

    viewerWs.on('message', (buffer) => {
      const text = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer)
      let payload
      try { payload = JSON.parse(text) } catch { return }
      const type = clean(payload?.type)
      if (!VIEWER_RELAY_TYPES.has(type)) return
      payload.session_id = sessionId
      delete payload.sessionId
      if (['viewer_disconnected','viewer_closed','viewer_left','end_session','stop_webrtc'].includes(type)) {
        safeSend(hostWs, payload)
        endConnectSession(sessionId, 'viewer_ended_session', {
          userId: remote.created_by_user_id,
          type: 'technician',
          label: remote.technician,
        }).catch(() => {})
        return
      }
      safeSend(hostWs, payload)
      pool.query(`UPDATE rmm_connect_sessions SET last_activity_at=now(),updated_at=now() WHERE id=$1`, [sessionId]).catch(() => {})
    })

    const handleViewerClose = () => {
      if (activeConnectViewers.get(sessionId) !== viewerWs) return
      activeConnectViewers.delete(sessionId)
      pool.query(
        `UPDATE rmm_connect_sessions
            SET status=CASE WHEN status='active' THEN 'host_connected' ELSE status END,last_activity_at=now(),updated_at=now()
          WHERE id=$1 AND ended_at IS NULL`,
        [sessionId],
      ).catch(() => {})
    }
    viewerWs.once('close', handleViewerClose)
    viewerWs.once('error', handleViewerClose)
  })

  return { hostWss, viewerWss }
}
