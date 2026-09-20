import { pool, withTransaction } from './db.js'
import { recalculateAllTenantVulnerabilityExposures } from './rmmVulnerabilityExposure.js'

function clean(value = '') { return String(value ?? '').trim() }

function repositoryName(value = '') {
  const input = clean(value).replace(/\.git$/i, '')
  const direct = input.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/)
  if (direct) return direct[1] + '/' + direct[2]
  try {
    const url = new URL(input)
    if (url.protocol !== 'https:' || !['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())) return ''
    const parts = url.pathname.split('/').filter(Boolean)
    return parts.length >= 2 ? parts[0] + '/' + parts[1] : ''
  } catch {
    return ''
  }
}

function globMatcher(pattern = '') {
  const value = clean(pattern)
  if (!value || value.length > 240) return null
  const escaped = value.replace(/[.+^$(){}|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp('^' + escaped + '$', 'i')
}
function releaseVersion(value = '') {
  const version = clean(value)
  return /^v\d/i.test(version) ? version.slice(1) : version
}

function releaseDate(value = '') {
  const parsed = Date.parse(clean(value))
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}

function installerType(name = '', configured = '') {
  const explicit = clean(configured).toLowerCase()
  if (['msi', 'exe'].includes(explicit)) return explicit
  const lower = clean(name).toLowerCase()
  if (lower.endsWith('.msi')) return 'msi'
  if (lower.endsWith('.exe')) return 'exe'
  return ''
}

async function latestGithubRelease(repository) {
  const response = await fetch('https://api.github.com/repos/' + repository + '/releases/latest', {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Hi5Central-Software-Catalogue/1.0' },
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) throw new Error('GitHub Releases HTTP ' + response.status)
  return response.json()
}
async function publishedChecksum(assetUrl, installerName) {
  if (!assetUrl) return ''
  const url = new URL(assetUrl)
  if (url.protocol !== 'https:' || !['github.com', 'objects.githubusercontent.com'].includes(url.hostname.toLowerCase())) {
    throw new Error('Checksum asset must be hosted by GitHub.')
  }
  const response = await fetch(assetUrl, {
    headers: { Accept: 'text/plain', 'User-Agent': 'Hi5Central-Software-Catalogue/1.0' },
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) throw new Error('Checksum download HTTP ' + response.status)
  const length = Number(response.headers.get('content-length') || 0)
  if (length > 2 * 1024 * 1024) throw new Error('Checksum asset is unexpectedly large.')
  const bytes = new Uint8Array(await response.arrayBuffer()).slice(0, 2 * 1024 * 1024)
  let body = ''
  if (bytes[0] === 0xff && bytes[1] === 0xfe) body = new TextDecoder('utf-16le').decode(bytes)
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) body = new TextDecoder('utf-16be').decode(bytes)
  else body = new TextDecoder('utf-8').decode(bytes)
  const escaped = clean(installerName).replace(/[.*+?^$(){}|[\]\\]/g, '\\$&')
  const match = body.match(new RegExp('([A-Fa-f0-9]{64})\\s+[* ]?' + escaped + '(?:\\s|$)', 'i'))
    || body.match(new RegExp('SHA256\\s*\\(' + escaped + '\\)\\s*=\\s*([A-Fa-f0-9]{64})', 'i'))
  return clean(match?.[1]).toUpperCase()
}

function deploymentMode(value = '') {
  return ['winget_preferred', 'vendor_direct', 'intelligence_only'].includes(clean(value))
    ? clean(value)
    : 'winget_preferred'
}
function normalizeInput(body = {}) {
  const mode = deploymentMode(body.deploymentMode)
  const input = {
    displayName: clean(body.displayName).slice(0, 160),
    repository: repositoryName(body.repository),
    canonicalName: clean(body.canonicalName).slice(0, 200),
    publisher: clean(body.publisher).slice(0, 200),
    expectedSigner: clean(body.expectedSigner).slice(0, 300),
    providerPackageId: clean(body.providerPackageId).slice(0, 240),
    namePattern: clean(body.namePattern || body.canonicalName).slice(0, 200),
    publisherPattern: clean(body.publisherPattern || body.publisher).slice(0, 200),
    channel: clean(body.channel || 'stable').slice(0, 80) || 'stable',
    architecture: clean(body.architecture || 'x64').slice(0, 40) || 'x64',
    deploymentMode: mode,
    assetPattern: clean(body.assetPattern).slice(0, 240),
    checksumAssetPattern: clean(body.checksumAssetPattern).slice(0, 240),
    installerType: clean(body.installerType).toLowerCase().slice(0, 20),
    pollMinutes: Math.max(15, Math.min(10080, Number(body.pollMinutes) || 60)),
  }
  if (input.displayName.length < 2 || input.canonicalName.length < 2 || input.namePattern.length < 2) {
    throw new Error('Display name, application name and detection name are required.')
  }
  if (!input.repository) throw new Error('A valid public GitHub repository is required.')
  if (mode === 'winget_preferred' && !input.providerPackageId) {
    throw new Error('A WinGet package ID is required for WinGet-preferred sources.')
  }
  if (mode === 'vendor_direct' && (!input.assetPattern || !input.checksumAssetPattern || !input.expectedSigner)) {
    throw new Error('Vendor-direct sources require installer pattern, checksum pattern and expected signer.')
  }
  if (input.installerType && !['msi', 'exe'].includes(input.installerType)) {
    throw new Error('Installer type must be MSI or EXE.')
  }
  return input
}

async function sourceById(tenantId, sourceId) {
  const result = await pool.query(
    `SELECT * FROM rmm_tenant_vendor_sources
      WHERE tenant_id=$1 AND id=$2 AND status<>'archived' LIMIT 1`,
    [tenantId, sourceId],
  )
  return result.rows[0] || null
}

function trustState(source, release) {
  if (source.deployment_mode === 'intelligence_only') return 'version_only'
  if (source.deployment_mode === 'winget_preferred') return source.provider_package_id ? 'winget_ready' : 'version_only'
  if (release.installerUrl
    && /^[A-F0-9]{64}$/.test(release.installerSha256)
    && clean(source.expected_signer)
    && ['msi', 'exe'].includes(release.installerType)) return 'direct_ready'
  return 'quarantined'
}

async function resolveGithubSource(source) {
  const payload = await latestGithubRelease(source.repository)
  const version = releaseVersion(payload?.tag_name || payload?.name)
  if (!version) throw new Error('GitHub latest release did not contain a usable version.')
  const assets = Array.isArray(payload?.assets) ? payload.assets : []
  const installerMatch = globMatcher(source.asset_pattern)
  const checksumMatch = globMatcher(source.checksum_asset_pattern)
  const installer = installerMatch ? assets.find((asset) => installerMatch.test(clean(asset?.name))) : null
  const checksum = checksumMatch ? assets.find((asset) => checksumMatch.test(clean(asset?.name))) : null
  const release = {
    version,
    releaseDate: releaseDate(payload?.published_at || payload?.created_at),
    releaseUrl: clean(payload?.html_url),
    installerUrl: clean(installer?.browser_download_url),
    installerSha256: '',
    installerType: installerType(installer?.name, source.installer_type),
    installerName: clean(installer?.name),
    checksumName: clean(checksum?.name),
  }
  if (installer && checksum) release.installerSha256 = await publishedChecksum(checksum.browser_download_url, installer.name)
  release.trustState = trustState(source, release)
  return { release, payload }
}

async function storeRelease(source, release, payload) {
  const evidence = {
    repository: source.repository,
    installerAsset: release.installerName,
    checksumAsset: release.checksumName,
    sha256Present: /^[A-F0-9]{64}$/.test(release.installerSha256),
    expectedSigner: clean(source.expected_signer),
    deploymentMode: source.deployment_mode,
  }
  await pool.query(
    `INSERT INTO rmm_tenant_vendor_releases
      (source_id,tenant_id,version,release_date,release_url,installer_url,installer_sha256,installer_type,
       trust_state,trust_evidence,source_payload,last_seen_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,now())
     ON CONFLICT (source_id,version) DO UPDATE SET
       release_date=EXCLUDED.release_date,release_url=EXCLUDED.release_url,
       installer_url=EXCLUDED.installer_url,installer_sha256=EXCLUDED.installer_sha256,
       installer_type=EXCLUDED.installer_type,trust_state=EXCLUDED.trust_state,
       trust_evidence=EXCLUDED.trust_evidence,source_payload=EXCLUDED.source_payload,last_seen_at=now()`,
    [
      source.id, source.tenant_id, release.version, release.releaseDate, release.releaseUrl,
      release.installerUrl, release.installerSha256, release.installerType, release.trustState,
      JSON.stringify(evidence),
      JSON.stringify({ github: { id: payload?.id, tag_name: payload?.tag_name, html_url: payload?.html_url } }),
    ],
  )
  return evidence
}

async function applyCatalogue(source, release, db = pool) {
  const provider = source.deployment_mode === 'winget_preferred' ? 'winget' : 'vendor'
  const metadata = {
    tenantVendorSourceId: source.id,
    sourceType: source.source_type,
    repository: source.repository,
    deploymentMode: source.deployment_mode,
    expectedSigner: source.expected_signer,
    trustState: release.trustState,
    releaseUrl: release.releaseUrl,
  }
  const existing = await db.query(
    `SELECT id FROM rmm_software_catalogue
      WHERE tenant_id=$1 AND catalogue_source='tenant_vendor' AND external_key=$2
        AND status<>'archived' LIMIT 1`,
    [source.tenant_id, source.id],
  )
  if (existing.rowCount) {
    await db.query(
      `UPDATE rmm_software_catalogue
          SET canonical_name=$2,publisher=$3,name_pattern=$4,publisher_pattern=$5,
              provider=$6,provider_package_id=$7,target_version=$8,release_channel=$9,
              installer_type=$10,source_revision=$8,source_metadata=$11::jsonb,status='active',updated_at=now()
        WHERE id=$1`,
      [
        existing.rows[0].id, source.canonical_name, source.publisher, source.name_pattern,
        source.publisher_pattern, provider, source.provider_package_id, release.version,
        source.channel, release.installerType, JSON.stringify(metadata),
      ],
    )
  } else {
    await db.query(
      `INSERT INTO rmm_software_catalogue
        (tenant_id,canonical_name,publisher,name_pattern,publisher_pattern,provider,provider_package_id,
         target_version,release_channel,installer_type,catalogue_source,external_key,source_revision,source_metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'tenant_vendor',$11,$8,$12::jsonb)`,
      [
        source.tenant_id, source.canonical_name, source.publisher, source.name_pattern,
        source.publisher_pattern, provider, source.provider_package_id, release.version,
        source.channel, release.installerType, source.id, JSON.stringify(metadata),
      ],
    )
  }
}
async function syncSourceRow(source, testOnly = false) {
  await pool.query('UPDATE rmm_tenant_vendor_sources SET last_attempt_at=now(),updated_at=now() WHERE id=$1', [source.id])
  try {
    const resolved = await resolveGithubSource(source)
    const evidence = await storeRelease(source, resolved.release, resolved.payload)
    const blockers = []
    if (source.deployment_mode === 'vendor_direct' && resolved.release.trustState !== 'direct_ready') {
      if (!resolved.release.installerUrl) blockers.push('No installer asset matched.')
      if (!resolved.release.installerSha256) blockers.push('No matching published SHA-256 was found.')
      if (!resolved.release.installerType) blockers.push('Installer must be MSI or EXE.')
      if (!clean(source.expected_signer)) blockers.push('Expected signer is required.')
    }
    const result = {
      ok: blockers.length === 0,
      version: resolved.release.version,
      releaseDate: resolved.release.releaseDate,
      releaseUrl: resolved.release.releaseUrl,
      installerAsset: resolved.release.installerName,
      checksumAsset: resolved.release.checksumName,
      installerType: resolved.release.installerType,
      sha256: resolved.release.installerSha256,
      trustState: resolved.release.trustState,
      blockers,
      evidence,
    }
    let status = source.status
    if (testOnly && source.status !== 'active') status = 'tested'
    if (!testOnly && source.status === 'active' && blockers.length) status = 'quarantined'
    await pool.query(
      `UPDATE rmm_tenant_vendor_sources
          SET latest_version=$2,latest_release_date=$3,latest_release_url=$4,
              latest_installer_url=$5,latest_installer_sha256=$6,last_test_result=$7::jsonb,
              last_success_at=now(),last_error='',status=$8,updated_at=now()
        WHERE id=$1`,
      [
        source.id, resolved.release.version, resolved.release.releaseDate, resolved.release.releaseUrl,
        resolved.release.installerUrl, resolved.release.installerSha256, JSON.stringify(result), status,
      ],
    )
    if (!testOnly && status === 'active') await applyCatalogue(source, resolved.release)
    return { sourceId: source.id, status, ...result }
  } catch (error) {
    const message = clean(error?.message || error).slice(0, 2000)
    await pool.query(
      `UPDATE rmm_tenant_vendor_sources
          SET last_error=$2,status=CASE WHEN status='active' THEN 'quarantined' ELSE status END,updated_at=now()
        WHERE id=$1`,
      [source.id, message],
    )
    throw error
  }
}
export async function listTenantVendorSources(tenantId) {
  const result = await pool.query(
    `SELECT s.*,
            r.version AS release_version,r.release_date,r.release_url,r.installer_url,
            r.installer_sha256,r.installer_type,r.trust_state,r.trust_evidence
       FROM rmm_tenant_vendor_sources s
       LEFT JOIN LATERAL (
         SELECT version,release_date,release_url,installer_url,installer_sha256,
                installer_type,trust_state,trust_evidence
           FROM rmm_tenant_vendor_releases
          WHERE source_id=s.id
          ORDER BY COALESCE(release_date,last_seen_at) DESC,last_seen_at DESC
          LIMIT 1
       ) r ON true
      WHERE s.tenant_id=$1 AND s.status<>'archived'
      ORDER BY s.status='quarantined' DESC,s.status='draft' DESC,lower(s.display_name)`,
    [tenantId],
  )
  return result.rows
}

export async function createTenantVendorSource(session, body) {
  const input = normalizeInput(body)
  const result = await pool.query(
    `INSERT INTO rmm_tenant_vendor_sources
      (tenant_id,display_name,source_type,repository,canonical_name,publisher,expected_signer,
       provider_package_id,name_pattern,publisher_pattern,channel,architecture,deployment_mode,
       asset_pattern,checksum_asset_pattern,installer_type,poll_minutes,created_by_user_id,updated_by_user_id)
     VALUES ($1,$2,'github_releases',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17)
     RETURNING id`,
    [
      session.tenant_id, input.displayName, input.repository, input.canonicalName, input.publisher,
      input.expectedSigner, input.providerPackageId, input.namePattern, input.publisherPattern,
      input.channel, input.architecture, input.deploymentMode, input.assetPattern,
      input.checksumAssetPattern, input.installerType, input.pollMinutes, session.user_id,
    ],
  )
  return result.rows[0]
}

export async function updateTenantVendorSource(session, sourceId, body) {
  const input = normalizeInput(body)
  return withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE rmm_tenant_vendor_sources
          SET display_name=$3,repository=$4,canonical_name=$5,publisher=$6,expected_signer=$7,
              provider_package_id=$8,name_pattern=$9,publisher_pattern=$10,channel=$11,
              architecture=$12,deployment_mode=$13,asset_pattern=$14,checksum_asset_pattern=$15,
              installer_type=$16,poll_minutes=$17,status='draft',approved_at=NULL,approved_by_user_id=NULL,
              updated_by_user_id=$18,updated_at=now()
        WHERE id=$1 AND tenant_id=$2 AND status<>'archived' RETURNING id`,
      [
        sourceId, session.tenant_id, input.displayName, input.repository, input.canonicalName,
        input.publisher, input.expectedSigner, input.providerPackageId, input.namePattern,
        input.publisherPattern, input.channel, input.architecture, input.deploymentMode,
        input.assetPattern, input.checksumAssetPattern, input.installerType, input.pollMinutes,
        session.user_id,
      ],
    )
    if (!result.rowCount) throw new Error('Vendor source not found.')
    await client.query(
      `UPDATE rmm_software_catalogue
          SET status='disabled',updated_by_user_id=$3,updated_at=now()
        WHERE tenant_id=$1 AND catalogue_source='tenant_vendor' AND external_key=$2 AND status='active'`,
      [session.tenant_id, sourceId, session.user_id],
    )
    return result.rows[0]
  })
}

export async function testTenantVendorSource(tenantId, sourceId) {
  const source = await sourceById(tenantId, sourceId)
  if (!source) throw new Error('Vendor source not found.')
  return syncSourceRow(source, true)
}

export async function approveTenantVendorSource(session, sourceId) {
  return withTransaction(async (client) => {
    const sourceResult = await client.query(
      `SELECT * FROM rmm_tenant_vendor_sources
        WHERE tenant_id=$1 AND id=$2 AND status='tested' LIMIT 1 FOR UPDATE`,
      [session.tenant_id, sourceId],
    )
    const source = sourceResult.rows[0]
    if (!source) throw new Error('Test this vendor source successfully before approving it.')
    const releaseResult = await client.query(
      `SELECT * FROM rmm_tenant_vendor_releases
        WHERE tenant_id=$1 AND source_id=$2
        ORDER BY COALESCE(release_date,last_seen_at) DESC,last_seen_at DESC LIMIT 1`,
      [session.tenant_id, sourceId],
    )
    const releaseRow = releaseResult.rows[0]
    if (!releaseRow) throw new Error('No tested release is available for approval.')
    if (source.deployment_mode === 'vendor_direct' && releaseRow.trust_state !== 'direct_ready') {
      throw new Error('Vendor-direct approval requires a verified checksum, MSI/EXE asset and expected signer.')
    }
    if (source.deployment_mode === 'winget_preferred' && !clean(source.provider_package_id)) {
      throw new Error('WinGet-preferred approval requires a package ID.')
    }
    await client.query(
      `UPDATE rmm_tenant_vendor_sources
          SET status='active',approved_at=now(),approved_by_user_id=$3,updated_by_user_id=$3,updated_at=now()
        WHERE tenant_id=$1 AND id=$2`,
      [session.tenant_id, sourceId, session.user_id],
    )
    const activeSource = { ...source, status: 'active' }
    const release = {
      version: releaseRow.version,
      releaseDate: releaseRow.release_date,
      releaseUrl: releaseRow.release_url,
      installerUrl: releaseRow.installer_url,
      installerSha256: releaseRow.installer_sha256,
      installerType: releaseRow.installer_type,
      trustState: releaseRow.trust_state,
    }
    await applyCatalogue(activeSource, release, client)
    return { source: activeSource, release }
  })
}

export async function archiveTenantVendorSource(session, sourceId) {
  const result = await withTransaction(async (client) => {
    const archived = await client.query(
      `UPDATE rmm_tenant_vendor_sources
          SET status='archived',updated_by_user_id=$3,updated_at=now()
        WHERE tenant_id=$1 AND id=$2 AND status<>'archived'
        RETURNING id,display_name`,
      [session.tenant_id, sourceId, session.user_id],
    )
    if (!archived.rowCount) return null
    await client.query(
      `UPDATE rmm_software_catalogue
          SET status='archived',updated_by_user_id=$3,updated_at=now()
        WHERE tenant_id=$1 AND catalogue_source='tenant_vendor' AND external_key=$2 AND status<>'archived'`,
      [session.tenant_id, sourceId, session.user_id],
    )
    return archived.rows[0]
  })
  if (!result) throw new Error('Vendor source not found.')
  return result
}
export async function syncDueTenantVendorSources() {
  const due = await pool.query(
    `SELECT * FROM rmm_tenant_vendor_sources
      WHERE status='active'
        AND (last_attempt_at IS NULL OR last_attempt_at + (poll_minutes || ' minutes')::interval <= now())
      ORDER BY last_attempt_at NULLS FIRST,created_at`,
  )
  const results = []
  let changed = false
  for (const source of due.rows) {
    try {
      const previous = clean(source.latest_version)
      const result = await syncSourceRow(source, false)
      results.push(result)
      if (result.status === 'active' && clean(result.version) !== previous) changed = true
    } catch (error) {
      results.push({ sourceId: source.id, ok: false, error: clean(error?.message || error) })
    }
  }
  if (changed) {
    recalculateAllTenantVulnerabilityExposures().catch((error) => {
      console.error('RMM vulnerability exposure refresh failed after tenant vendor release change', error)
    })
  }
  return results
}

let tenantSchedulerStarted = false
export function startTenantVendorSourceScheduler() {
  if (tenantSchedulerStarted) return
  tenantSchedulerStarted = true
  const run = () => syncDueTenantVendorSources()
    .catch((error) => console.error('RMM tenant vendor source scheduler failed', error))
  setTimeout(run, 20_000).unref?.()
  setInterval(run, 5 * 60 * 1000).unref?.()
}
