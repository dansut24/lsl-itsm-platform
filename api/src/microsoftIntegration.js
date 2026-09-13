import { createHash, randomBytes } from 'node:crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { hasPermission } from './access.js'
import { deployment, originMatchesTenant } from './deploymentConfig.js'
import { pool, withTransaction } from './db.js'
import { ensureRedisConnected } from './redis.js'
import { createSession, resolveSession, setSessionCookie } from './session.js'

const CLIENT_ID = String(process.env.MICROSOFT_CLIENT_ID || '').trim()
const CLIENT_SECRET = String(process.env.MICROSOFT_CLIENT_SECRET || '').trim()
const CALLBACK_URI = String(process.env.MICROSOFT_REDIRECT_URI || `${deployment.apiUrl}/api/v1/auth/microsoft/callback`).trim()
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
const STATE_TTL_SECONDS = 600
const MICROSOFT_PROVIDER = 'microsoft_entra'

function connectorConfigured() { return Boolean(CLIENT_ID && CLIENT_SECRET && CALLBACK_URI) }
function normaliseEmail(value = '') { return String(value || '').trim().toLowerCase() }
function clean(value = '') { return String(value ?? '').trim() }
function hashText(value = '') { return createHash('sha256').update(String(value)).digest('hex').slice(0, 16) }
function randomToken(bytes = 32) { return randomBytes(bytes).toString('base64url') }
function stateKey(state) { return `microsoft-oauth:${state}` }
function isGuid(value = '') { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value)) }

async function storeState(payload) {
  const redis = await ensureRedisConnected()
  const state = randomToken(24)
  await redis.set(stateKey(state), JSON.stringify(payload), { EX: STATE_TTL_SECONDS })
  return state
}

async function consumeState(state) {
  if (!state) return null
  const redis = await ensureRedisConnected()
  const key = stateKey(state)
  const raw = await redis.get(key)
  if (!raw) return null
  await redis.del(key)
  try { return JSON.parse(raw) } catch { return null }
}

async function requireIntegrationManager(c) {
  const session = await resolveSession(c)
  if (!session) return { error: c.json({ error: 'Authentication required.' }, 401) }
  if (!originMatchesTenant(c.req.header('origin'), session.slug)) return { error: c.json({ error: 'Tenant session mismatch.' }, 403) }
  if (!hasPermission(session.access, 'integrations.manage') && !hasPermission(session.access, 'settings.integrations.manage')) {
    return { error: c.json({ error: 'You do not have permission to manage integrations.' }, 403) }
  }
  return { session }
}

async function clientCredentialToken(directoryTenantId) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: 'https://graph.microsoft.com/.default',
  })
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(directoryTenantId)}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || payload.error || 'Microsoft token request failed.')
  return payload.access_token
}

async function graphCollection(token, path) {
  const rows = []
  let url = path.startsWith('http') ? path : `${GRAPH_BASE}${path}`
  while (url) {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message = payload?.error?.message || payload?.error?.code || `Microsoft Graph request failed (${response.status}).`
      const error = new Error(message)
      error.status = response.status
      error.graphCode = payload?.error?.code || ''
      throw error
    }
    rows.push(...(Array.isArray(payload.value) ? payload.value : []))
    url = payload['@odata.nextLink'] || ''
  }
  return rows
}

async function upsertDepartment(client, tenantId, name) {
  const value = clean(name)
  if (!value) return null
  const source = { provider: 'microsoft365', label: 'Microsoft 365 / Entra ID', managedFields: ['name'], externalId: `department:${value}` }
  const result = await client.query(
    `INSERT INTO organisation_departments (tenant_id,external_key,name,source,active)
     VALUES ($1,$2,$3,$4::jsonb,true)
     ON CONFLICT (tenant_id,name) DO UPDATE SET source=EXCLUDED.source,active=true,updated_at=now()
     RETURNING id`,
    [tenantId, `entra-dept:${hashText(value.toLowerCase())}`, value, JSON.stringify(source)],
  )
  return result.rows[0]?.id || null
}

async function upsertSite(client, tenantId, name) {
  const value = clean(name)
  if (!value) return null
  const source = { provider: 'microsoft365', label: 'Microsoft 365 / Entra ID', managedFields: ['name'], externalId: `office:${value}` }
  const code = `MS-${hashText(value.toLowerCase()).slice(0, 8).toUpperCase()}`
  const result = await client.query(
    `INSERT INTO organisation_sites (tenant_id,external_key,code,name,source,active)
     VALUES ($1,$2,$3,$4,$5::jsonb,true)
     ON CONFLICT (tenant_id,name) DO UPDATE SET source=EXCLUDED.source,active=true,updated_at=now()
     RETURNING id`,
    [tenantId, `entra-site:${hashText(value.toLowerCase())}`, code, value, JSON.stringify(source)],
  )
  return result.rows[0]?.id || null
}

async function syncDirectoryUsers(client, tenantId, graphUsers) {
  const byObjectId = new Map()
  const byEmail = new Map()
  let imported = 0
  let updated = 0

  for (const user of graphUsers) {
    const email = normaliseEmail(user.mail || user.userPrincipalName)
    if (!email || !user.id) continue
    const departmentId = await upsertDepartment(client, tenantId, user.department)
    const siteId = await upsertSite(client, tenantId, user.officeLocation)
    const phone = clean(user.mobilePhone || (Array.isArray(user.businessPhones) ? user.businessPhones[0] : ''))
    const source = {
      provider: 'microsoft365', label: 'Microsoft 365 / Entra ID', externalId: user.id,
      managedFields: ['name','email','phone','jobTitle','department','site','active'], lastSyncedAt: new Date().toISOString(),
    }
    const existing = await client.query(
      `SELECT id,external_key FROM organisation_people
       WHERE tenant_id=$1 AND (lower(email)=lower($2) OR directory_source->>'externalId'=$3)
       ORDER BY CASE WHEN directory_source->>'externalId'=$3 THEN 0 ELSE 1 END LIMIT 1`,
      [tenantId, email, user.id],
    )
    let personId
    if (existing.rowCount) {
      personId = existing.rows[0].id
      await client.query(
        `UPDATE organisation_people SET name=$3,email=$4,phone=$5,job_title=$6,department_id=$7,site_id=$8,
         directory_source=$9::jsonb,active=$10,updated_at=now() WHERE tenant_id=$1 AND id=$2`,
        [tenantId, personId, clean(user.displayName) || email, email, phone, clean(user.jobTitle), departmentId, siteId, JSON.stringify(source), user.accountEnabled !== false],
      )
      updated += 1
    } else {
      const inserted = await client.query(
        `INSERT INTO organisation_people
         (tenant_id,external_key,name,email,phone,job_title,department_id,site_id,directory_source,active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) RETURNING id`,
        [tenantId, `entra:${user.id}`, clean(user.displayName) || email, email, phone, clean(user.jobTitle), departmentId, siteId, JSON.stringify(source), user.accountEnabled !== false],
      )
      personId = inserted.rows[0].id
      imported += 1
    }
    await client.query(
      `UPDATE organisation_people p SET user_id=u.id,updated_at=now()
       FROM users u JOIN tenant_memberships m ON m.user_id=u.id AND m.tenant_id=$1
       WHERE p.tenant_id=$1 AND p.id=$2 AND lower(u.email)=lower($3)`,
      [tenantId, personId, email],
    )
    byObjectId.set(user.id, personId)
    byEmail.set(email, personId)
  }
  return { byObjectId, byEmail, imported, updated }
}

function deviceReference(id) { return `INTUNE-${String(id || '').replace(/[^a-z0-9]/gi, '').slice(0, 12).toUpperCase()}` }

async function syncDevices(client, tenantId, runId, graphDevices, people) {
  let imported = 0
  let updated = 0
  for (const device of graphDevices) {
    if (!device?.id) continue
    const email = normaliseEmail(device.userPrincipalName || device.emailAddress)
    const personId = people.byObjectId.get(device.userId) || people.byEmail.get(email) || null
    const values = [
      tenantId, device.id, deviceReference(device.id), clean(device.azureADDeviceId) || null,
      clean(device.deviceName || device.managedDeviceName) || `Intune device ${device.id.slice(0, 8)}`,
      clean(device.operatingSystem) || 'Unknown', clean(device.operatingSystem), clean(device.osVersion), clean(device.manufacturer), clean(device.model), clean(device.serialNumber),
      clean(device.userId) || null, personId, clean(device.userDisplayName), email, clean(device.managedDeviceOwnerType) || 'unknown', clean(device.complianceState) || 'unknown',
      clean(device.managementState) || 'managed', clean(device.managementAgent), clean(device.deviceEnrollmentType), clean(device.deviceRegistrationState), clean(device.deviceCategoryDisplayName),
      typeof device.isEncrypted === 'boolean' ? device.isEncrypted : null, Number.isFinite(Number(device.physicalMemoryInBytes)) ? Number(device.physicalMemoryInBytes) : null,
      Number.isFinite(Number(device.totalStorageSpaceInBytes)) ? Number(device.totalStorageSpaceInBytes) : null,
      Number.isFinite(Number(device.freeStorageSpaceInBytes)) ? Number(device.freeStorageSpaceInBytes) : null,
      clean(device.ethernetMacAddress), clean(device.wiFiMacAddress), device.enrolledDateTime || null, device.lastSyncDateTime || null,
      runId, JSON.stringify(device),
    ]
    const result = await client.query(
      `INSERT INTO rmm_device_inventory
       (tenant_id,source,source_device_id,reference,directory_device_id,name,platform,operating_system,os_version,manufacturer,model,serial_number,user_id_external,assigned_person_id,user_display_name,user_principal_name,owner_type,compliance_state,management_state,management_agent,enrollment_type,registration_state,category_name,is_encrypted,memory_bytes,storage_total_bytes,storage_free_bytes,ethernet_mac,wifi_mac,enrolled_at,source_last_sync_at,last_imported_at,last_seen_sync_run_id,active,source_payload)
       VALUES ($1,'intune',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,now(),$31,true,$32::jsonb)
       ON CONFLICT (tenant_id,source,source_device_id) DO UPDATE SET
       directory_device_id=EXCLUDED.directory_device_id,name=EXCLUDED.name,platform=EXCLUDED.platform,operating_system=EXCLUDED.operating_system,os_version=EXCLUDED.os_version,
       manufacturer=EXCLUDED.manufacturer,model=EXCLUDED.model,serial_number=EXCLUDED.serial_number,user_id_external=EXCLUDED.user_id_external,assigned_person_id=EXCLUDED.assigned_person_id,
       user_display_name=EXCLUDED.user_display_name,user_principal_name=EXCLUDED.user_principal_name,owner_type=EXCLUDED.owner_type,compliance_state=EXCLUDED.compliance_state,
       management_state=EXCLUDED.management_state,management_agent=EXCLUDED.management_agent,enrollment_type=EXCLUDED.enrollment_type,registration_state=EXCLUDED.registration_state,
       category_name=EXCLUDED.category_name,is_encrypted=EXCLUDED.is_encrypted,memory_bytes=EXCLUDED.memory_bytes,storage_total_bytes=EXCLUDED.storage_total_bytes,
       storage_free_bytes=EXCLUDED.storage_free_bytes,ethernet_mac=EXCLUDED.ethernet_mac,wifi_mac=EXCLUDED.wifi_mac,enrolled_at=EXCLUDED.enrolled_at,
       source_last_sync_at=EXCLUDED.source_last_sync_at,last_imported_at=now(),last_seen_sync_run_id=EXCLUDED.last_seen_sync_run_id,active=true,source_payload=EXCLUDED.source_payload,updated_at=now()
       RETURNING (xmax = 0) AS inserted`,
      values,
    )
    if (result.rows[0]?.inserted) imported += 1
    else updated += 1
  }
  const deactivated = await client.query(
    `UPDATE rmm_device_inventory SET active=false,updated_at=now()
     WHERE tenant_id=$1 AND source='intune' AND active=true AND last_seen_sync_run_id IS DISTINCT FROM $2`,
    [tenantId, runId],
  )
  return { imported, updated, deactivated: deactivated.rowCount }
}

const USER_SELECT = 'id,displayName,userPrincipalName,mail,jobTitle,department,officeLocation,mobilePhone,businessPhones,accountEnabled'
const DEVICE_SELECT = 'id,userId,deviceName,managedDeviceName,managedDeviceOwnerType,managementState,enrolledDateTime,lastSyncDateTime,operatingSystem,complianceState,managementAgent,osVersion,emailAddress,azureADDeviceId,deviceRegistrationState,deviceCategoryDisplayName,isEncrypted,userPrincipalName,model,manufacturer,serialNumber,userDisplayName,totalStorageSpaceInBytes,freeStorageSpaceInBytes,ethernetMacAddress,wiFiMacAddress,physicalMemoryInBytes,deviceEnrollmentType'

export async function syncMicrosoftTenant(tenantId, startedByUserId = null) {
  const connectionResult = await pool.query('SELECT * FROM tenant_microsoft_connections WHERE tenant_id=$1 LIMIT 1', [tenantId])
  const connection = connectionResult.rows[0]
  if (!connection?.directory_tenant_id || connection.status !== 'connected') throw new Error('Microsoft 365 is not connected for this tenant.')
  const run = await pool.query(
    `INSERT INTO microsoft_sync_runs (tenant_id,sync_type,started_by_user_id) VALUES ($1,'intune_devices',$2) RETURNING id`,
    [tenantId, startedByUserId],
  )
  const runId = run.rows[0].id
  await pool.query(`UPDATE tenant_microsoft_connections SET last_sync_started_at=now(),last_sync_status='running',last_sync_error=NULL,updated_at=now() WHERE tenant_id=$1`, [tenantId])
  try {
    const token = await clientCredentialToken(connection.directory_tenant_id)
    const [graphUsers, graphDevices] = await Promise.all([
      graphCollection(token, `/users?$select=${encodeURIComponent(USER_SELECT)}&$top=999`),
      graphCollection(token, `/deviceManagement/managedDevices?$select=${encodeURIComponent(DEVICE_SELECT)}&$top=999`),
    ])
    const result = await withTransaction(async (client) => {
      const people = await syncDirectoryUsers(client, tenantId, graphUsers)
      const devices = await syncDevices(client, tenantId, runId, graphDevices, people)
      await client.query(
        `UPDATE microsoft_sync_runs SET status='completed',discovered_count=$2,imported_count=$3,updated_count=$4,deactivated_count=$5,completed_at=now() WHERE id=$1`,
        [runId, graphDevices.length, devices.imported, devices.updated, devices.deactivated],
      )
      await client.query(
        `UPDATE tenant_microsoft_connections SET intune_enabled=true,intune_sync_enabled=true,intune_status='ready',device_count=$2,last_validated_at=now(),last_sync_completed_at=now(),last_sync_status='completed',last_sync_error=NULL,updated_at=now() WHERE tenant_id=$1`,
        [tenantId, graphDevices.length],
      )
      return { users: graphUsers.length, peopleImported: people.imported, peopleUpdated: people.updated, devices: graphDevices.length, ...devices }
    })
    return { runId, ...result }
  } catch (error) {
    await pool.query(`UPDATE microsoft_sync_runs SET status='failed',error_message=$2,completed_at=now() WHERE id=$1`, [runId, String(error.message || error).slice(0, 2000)]).catch(() => {})
    await pool.query(`UPDATE tenant_microsoft_connections SET intune_status='error',last_sync_completed_at=now(),last_sync_status='failed',last_sync_error=$2,updated_at=now() WHERE tenant_id=$1`, [tenantId, String(error.message || error).slice(0, 2000)]).catch(() => {})
    throw error
  }
}

async function microsoftStatus(tenantId) {
  const result = await pool.query(
    `SELECT directory_tenant_id,status,sso_enabled,intune_enabled,intune_sync_enabled,intune_sync_interval_minutes,intune_status,device_count,last_validated_at,last_sync_started_at,last_sync_completed_at,last_sync_status,last_sync_error,admin_consent_at
     FROM tenant_microsoft_connections WHERE tenant_id=$1 LIMIT 1`, [tenantId],
  )
  const connection = result.rows[0] || null
  const run = await pool.query(`SELECT id,status,discovered_count,imported_count,updated_count,deactivated_count,error_message,started_at,completed_at FROM microsoft_sync_runs WHERE tenant_id=$1 ORDER BY started_at DESC LIMIT 1`, [tenantId])
  return { configured: connectorConfigured(), callbackUri: CALLBACK_URI, connection, lastRun: run.rows[0] || null }
}

async function handleAdminConsentCallback(c, state, query) {
  const tenantUrl = state.tenantUrl || `https://${state.tenantSlug}.${deployment.rootDomain}`
  if (query.error) {
    await pool.query(`INSERT INTO tenant_microsoft_connections (tenant_id,status,last_sync_error) VALUES ($1,'error',$2) ON CONFLICT (tenant_id) DO UPDATE SET status='error',last_sync_error=EXCLUDED.last_sync_error,updated_at=now()`, [state.tenantId, clean(query.error_description || query.error)]).catch(() => {})
    return c.redirect(`${tenantUrl}/settings/integrations?microsoft=error`, 302)
  }
  if (String(query.admin_consent || '').toLowerCase() !== 'true') {
    return c.redirect(`${tenantUrl}/settings/integrations?microsoft=consent_required`, 302)
  }
  const directoryTenantId = clean(query.tenant)
  if (!isGuid(directoryTenantId)) return c.redirect(`${tenantUrl}/settings/integrations?microsoft=invalid_tenant`, 302)
  await pool.query(
    `INSERT INTO tenant_microsoft_connections (tenant_id,directory_tenant_id,status,sso_enabled,intune_enabled,intune_sync_enabled,intune_status,connected_by_user_id,admin_consent_at,last_validated_at)
     VALUES ($1,$2,'connected',true,true,true,'ready',$3,now(),now())
     ON CONFLICT (tenant_id) DO UPDATE SET directory_tenant_id=EXCLUDED.directory_tenant_id,status='connected',sso_enabled=true,intune_enabled=true,intune_sync_enabled=true,intune_status='ready',connected_by_user_id=EXCLUDED.connected_by_user_id,admin_consent_at=now(),last_validated_at=now(),last_sync_error=NULL,updated_at=now()`,
    [state.tenantId, directoryTenantId, state.userId],
  )
  try {
    await syncMicrosoftTenant(state.tenantId, state.userId)
    return c.redirect(`${tenantUrl}/settings/integrations?microsoft=connected`, 302)
  } catch (error) {
    console.error('Initial Microsoft sync failed', error)
    return c.redirect(`${tenantUrl}/settings/integrations?microsoft=connected_sync_error`, 302)
  }
}

async function handleSsoCallback(c, state, query) {
  const tenantUrl = state.targetUrl || state.tenantUrl || `https://${state.tenantSlug}.${deployment.rootDomain}`
  if (query.error) return c.redirect(`${tenantUrl}/?microsoft=error`, 302)
  const code = clean(query.code)
  if (!code) return c.redirect(`${tenantUrl}/?microsoft=missing_code`, 302)
  const tokenBody = new URLSearchParams({
    client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'authorization_code', code,
    redirect_uri: CALLBACK_URI, code_verifier: state.codeVerifier, scope: 'openid profile email',
  })
  const tokenResponse = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(state.directoryTenantId)}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: tokenBody,
  })
  const tokenPayload = await tokenResponse.json().catch(() => ({}))
  if (!tokenResponse.ok || !tokenPayload.id_token) return c.redirect(`${tenantUrl}/?microsoft=token_error`, 302)
  const jwks = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${state.directoryTenantId}/discovery/v2.0/keys`))
  const verified = await jwtVerify(tokenPayload.id_token, jwks, {
    issuer: `https://login.microsoftonline.com/${state.directoryTenantId}/v2.0`, audience: CLIENT_ID,
  })
  const claims = verified.payload
  if (String(claims.tid || '').toLowerCase() !== String(state.directoryTenantId).toLowerCase()) return c.redirect(`${tenantUrl}/?microsoft=tenant_mismatch`, 302)
  const oid = clean(claims.oid)
  const subject = clean(claims.sub)
  const email = normaliseEmail(claims.preferred_username || claims.email)
  if (!subject || !email) return c.redirect(`${tenantUrl}/?microsoft=identity_missing`, 302)

  const account = await pool.query(
    `SELECT t.id AS tenant_id,t.slug,t.company_name,t.status AS tenant_status,u.id AS user_id,u.email,u.name,m.role AS tenant_role,m.status AS membership_status,
            ts.modules,ts.onboarding_step,ts.onboarding_completed_at,ts.onboarding_data,ts.configuration,ts.tenant_url,ts.portal_url,ts.rmm_url
     FROM tenants t JOIN tenant_memberships m ON m.tenant_id=t.id JOIN users u ON u.id=m.user_id JOIN tenant_settings ts ON ts.tenant_id=t.id
     LEFT JOIN user_external_identities x ON x.tenant_id=t.id AND x.user_id=u.id AND x.provider=$3 AND x.issuer_tenant_id=$4
     WHERE t.id=$1 AND (x.subject=$5 OR x.object_id=$6 OR lower(u.email)=lower($2)) LIMIT 1`,
    [state.tenantId, email, MICROSOFT_PROVIDER, state.directoryTenantId, subject, oid || null],
  )
  if (!account.rowCount) return c.redirect(`${tenantUrl}/?microsoft=not_assigned`, 302)
  const row = account.rows[0]
  if (row.tenant_status !== 'active' || row.membership_status !== 'active') return c.redirect(`${tenantUrl}/?microsoft=inactive`, 302)
  const amr = Array.isArray(claims.amr) ? claims.amr.map(String) : []
  const microsoftMfa = amr.includes('mfa')
  const sessionToken = await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO user_external_identities (tenant_id,user_id,provider,issuer_tenant_id,subject,object_id,principal_name,last_login_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now())
       ON CONFLICT (tenant_id,provider,issuer_tenant_id,subject) DO UPDATE SET user_id=EXCLUDED.user_id,object_id=EXCLUDED.object_id,principal_name=EXCLUDED.principal_name,last_login_at=now(),updated_at=now()`,
      [row.tenant_id, row.user_id, MICROSOFT_PROVIDER, state.directoryTenantId, subject, oid || null, email],
    )
    return createSession(client, { tenantId: row.tenant_id, userId: row.user_id, surface: 'workspace', mfaVerified: microsoftMfa })
  })
  setSessionCookie(c, sessionToken)
  const returnTo = String(state.returnTo || '/').startsWith('/') ? state.returnTo : '/'
  return c.redirect(`${tenantUrl}${returnTo}`, 302)
}

export function registerMicrosoftRoutes(app) {
  app.get('/api/v1/auth/microsoft/status/:slug', async (c) => {
    const slug = clean(c.req.param('slug')).toLowerCase()
    const result = await pool.query(
      `SELECT mc.status,mc.sso_enabled FROM tenants t LEFT JOIN tenant_microsoft_connections mc ON mc.tenant_id=t.id WHERE t.slug=$1 LIMIT 1`, [slug],
    )
    const row = result.rows[0] || {}
    return c.json({ configured: connectorConfigured(), connected: row.status === 'connected', ssoEnabled: Boolean(row.sso_enabled) })
  })

  app.get('/api/v1/auth/microsoft/start', async (c) => {
    if (!connectorConfigured()) return c.json({ error: 'Microsoft SSO is not configured on this Hi5Central installation.' }, 503)
    const tenantSlug = clean(c.req.query('tenantSlug')).toLowerCase()
    const tenantResult = await pool.query(
      `SELECT t.id,t.slug,ts.tenant_url,ts.rmm_url,mc.directory_tenant_id,mc.status,mc.sso_enabled FROM tenants t JOIN tenant_settings ts ON ts.tenant_id=t.id JOIN tenant_microsoft_connections mc ON mc.tenant_id=t.id WHERE t.slug=$1 LIMIT 1`, [tenantSlug],
    )
    const tenant = tenantResult.rows[0]
    if (!tenant || tenant.status !== 'connected' || !tenant.sso_enabled || !tenant.directory_tenant_id) return c.json({ error: 'Microsoft SSO is not enabled for this tenant.' }, 404)
    const requestedSurface = clean(c.req.query('surface')).toLowerCase()
    const targetUrl = requestedSurface === 'rmm' && tenant.rmm_url ? tenant.rmm_url : tenant.tenant_url
    const codeVerifier = randomToken(48)
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
    const state = await storeState({ kind: 'sso', tenantId: tenant.id, tenantSlug: tenant.slug, tenantUrl: tenant.tenant_url, targetUrl, directoryTenantId: tenant.directory_tenant_id, codeVerifier, returnTo: c.req.query('returnTo') || '/' })
    const params = new URLSearchParams({ client_id: CLIENT_ID, response_type: 'code', redirect_uri: CALLBACK_URI, response_mode: 'query', scope: 'openid profile email', state, code_challenge: codeChallenge, code_challenge_method: 'S256', prompt: 'select_account' })
    return c.redirect(`https://login.microsoftonline.com/${tenant.directory_tenant_id}/oauth2/v2.0/authorize?${params.toString()}`, 302)
  })

  app.get('/api/v1/auth/microsoft/callback', async (c) => {
    const state = await consumeState(c.req.query('state'))
    if (!state) return c.json({ error: 'Microsoft sign-in state expired or is invalid.' }, 400)
    const query = Object.fromEntries(new URL(c.req.url).searchParams.entries())
    if (state.kind === 'admin_consent') return handleAdminConsentCallback(c, state, query)
    if (state.kind === 'sso') return handleSsoCallback(c, state, query)
    return c.json({ error: 'Unknown Microsoft authentication flow.' }, 400)
  })

  app.get('/api/v1/integrations/microsoft', async (c) => {
    const auth = await requireIntegrationManager(c)
    if (auth.error) return auth.error
    return c.json(await microsoftStatus(auth.session.tenant_id))
  })

  app.get('/api/v1/integrations/microsoft/connect', async (c) => {
    const auth = await requireIntegrationManager(c)
    if (auth.error) return auth.error
    if (!connectorConfigured()) return c.json({ error: 'Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET before connecting Microsoft 365.', callbackUri: CALLBACK_URI }, 503)
    const state = await storeState({ kind: 'admin_consent', tenantId: auth.session.tenant_id, tenantSlug: auth.session.slug, tenantUrl: auth.session.tenant_url, userId: auth.session.user_id })
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: CALLBACK_URI,
      state,
      scope: 'https://graph.microsoft.com/.default',
    })
    return c.redirect(`https://login.microsoftonline.com/organizations/v2.0/adminconsent?${params.toString()}`, 302)
  })

  app.post('/api/v1/integrations/microsoft/sync', async (c) => {
    const auth = await requireIntegrationManager(c)
    if (auth.error) return auth.error
    try { return c.json({ status: 'completed', ...(await syncMicrosoftTenant(auth.session.tenant_id, auth.session.user_id)) }) }
    catch (error) { return c.json({ error: error.message || 'Microsoft sync failed.' }, Number(error.status) || 502) }
  })

  app.post('/api/v1/integrations/microsoft/disconnect', async (c) => {
    const auth = await requireIntegrationManager(c)
    if (auth.error) return auth.error
    await pool.query(`UPDATE tenant_microsoft_connections SET status='disconnected',sso_enabled=false,intune_sync_enabled=false,updated_at=now() WHERE tenant_id=$1`, [auth.session.tenant_id])
    return c.json({ status: 'disconnected' })
  })

  app.get('/api/v1/rmm/devices', async (c) => {
    const session = await resolveSession(c)
    if (!session) return c.json({ error: 'Authentication required.' }, 401)
    if (!originMatchesTenant(c.req.header('origin'), session.slug)) return c.json({ error: 'Tenant session mismatch.' }, 403)
    const personId = clean(c.req.query('personId'))
    const params = [session.tenant_id]
    let where = `d.tenant_id=$1 AND d.active=true`
    if (personId) { params.push(personId); where += ` AND d.assigned_person_id=$2` }
    const result = await pool.query(
      `SELECT d.id,d.reference,d.source,d.source_device_id,d.directory_device_id,d.name,d.platform,d.operating_system,d.os_version,d.manufacturer,d.model,d.serial_number,d.user_display_name,d.user_principal_name,d.owner_type,d.compliance_state,d.management_state,d.management_agent,d.enrollment_type,d.registration_state,d.category_name,d.is_encrypted,d.memory_bytes,d.storage_total_bytes,d.storage_free_bytes,d.enrolled_at,d.source_last_sync_at,d.last_imported_at,d.assigned_person_id,
              p.name AS assigned_person_name,p.email AS assigned_person_email
       FROM rmm_device_inventory d LEFT JOIN organisation_people p ON p.tenant_id=d.tenant_id AND p.id=d.assigned_person_id
       WHERE ${where} ORDER BY d.name`, params,
    )
    return c.json({ devices: result.rows })
  })
}

let schedulerStarted = false
export function startMicrosoftSyncScheduler() {
  if (schedulerStarted || !connectorConfigured()) return
  schedulerStarted = true
  const runDueSyncs = async () => {
    try {
      const due = await pool.query(
        `SELECT tenant_id FROM tenant_microsoft_connections WHERE status='connected' AND intune_sync_enabled=true AND (last_sync_completed_at IS NULL OR last_sync_completed_at + make_interval(mins=>intune_sync_interval_minutes) <= now()) LIMIT 10`,
      )
      for (const row of due.rows) await syncMicrosoftTenant(row.tenant_id).catch((error) => console.error('Scheduled Microsoft sync failed', row.tenant_id, error.message))
    } catch (error) { console.error('Microsoft sync scheduler failed', error) }
  }
  setTimeout(runDueSyncs, 10_000).unref?.()
  setInterval(runDueSyncs, 5 * 60 * 1000).unref?.()
}
