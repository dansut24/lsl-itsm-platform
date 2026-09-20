import { pool, withTransaction } from './db.js'
import {
  fetchPublicJson,
  globMatcher,
  installerType as detectInstallerType,
  jsonPathValue,
  latestGithubRelease,
  normalizedSha256,
  publicHttpsUrl,
  publishedChecksum,
  releaseDate as normalizedReleaseDate,
  releaseVersion,
  repositoryName,
} from './rmmTenantVendorSources.js'
import { recalculateAllTenantVulnerabilityExposures } from './rmmVulnerabilityExposure.js'

function clean(value = '') { return String(value ?? '').trim() }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {} }

async function fetchText(url, accept = '*/*') {
  const response = await fetch(url, {
    headers: { Accept: accept, 'User-Agent': 'Hi5Central-Software-Catalogue/1.0' },
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) throw new Error('HTTP ' + response.status + ' from ' + url)
  return response.text()
}

async function fetchJson(url) {
  const text = await fetchText(url, 'application/json')
  return JSON.parse(text)
}

function stripHtml(value = '') {
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseLooseDate(value = '') {
  const parsed = Date.parse(clean(value))
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}

async function sourceState(sourceKey) {
  const result = await pool.query(
    `SELECT source_key,display_name,source_type,source_url,enabled,priority,poll_minutes,cursor_value,
            last_attempt_at,last_success_at,last_error,records_seen,metadata
       FROM rmm_software_vendor_sources
      WHERE source_key=$1 LIMIT 1`,
    [sourceKey],
  )
  return result.rows[0] || null
}

async function markAttempt(sourceKey) {
  await pool.query(
    'UPDATE rmm_software_vendor_sources SET last_attempt_at=now(),updated_at=now() WHERE source_key=$1',
    [sourceKey],
  )
}

async function markFailure(sourceKey, error) {
  await pool.query(
    `UPDATE rmm_software_vendor_sources
        SET last_error=$2,updated_at=now()
      WHERE source_key=$1`,
    [sourceKey, clean(error?.message || error).slice(0, 2000)],
  ).catch(() => null)
}
async function upsertRelease({
  sourceKey,
  packageId,
  canonicalName,
  publisher,
  channel = 'stable',
  platform = 'windows',
  architecture = 'x64',
  version,
  releaseDate = null,
  installerUrl = '',
  installerSha256 = '',
  installerType = '',
  sourcePriority = 100,
  payload = {},
  catalogueProvider = 'winget',
  verification = {},
  execution = {},
  catalogueMetadata = {},
}) {
  const normalizedVersion = clean(version)
  if (!normalizedVersion) throw new Error(sourceKey + ' returned an empty version')

  return withTransaction(async (client) => {
    await client.query(
      `INSERT INTO rmm_software_vendor_releases
        (source_key,provider_package_id,canonical_name,publisher,channel,platform,architecture,
         version,release_date,installer_url,installer_sha256,installer_type,source_priority,source_payload,last_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,now())
       ON CONFLICT (source_key,provider_package_id,channel,platform,architecture,version)
       DO UPDATE SET release_date=COALESCE(EXCLUDED.release_date,rmm_software_vendor_releases.release_date),
         installer_url=CASE WHEN EXCLUDED.installer_url<>'' THEN EXCLUDED.installer_url ELSE rmm_software_vendor_releases.installer_url END,
         installer_sha256=CASE WHEN EXCLUDED.installer_sha256<>'' THEN EXCLUDED.installer_sha256 ELSE rmm_software_vendor_releases.installer_sha256 END,
         installer_type=CASE WHEN EXCLUDED.installer_type<>'' THEN EXCLUDED.installer_type ELSE rmm_software_vendor_releases.installer_type END,
         source_priority=EXCLUDED.source_priority,source_payload=EXCLUDED.source_payload,last_seen_at=now()
       RETURNING id`,
      [
        sourceKey, packageId, canonicalName, publisher, channel, platform, architecture,
        normalizedVersion, releaseDate, installerUrl, installerSha256, installerType,
        sourcePriority, JSON.stringify(payload),
      ],
    )

    const existing = await client.query(
      `SELECT id FROM rmm_software_catalogue
        WHERE tenant_id IS NULL AND catalogue_source='vendor' AND external_key=$1
          AND status<>'archived' LIMIT 1`,
      [packageId],
    )
    if (existing.rowCount) {
      await client.query(
        `UPDATE rmm_software_catalogue
            SET canonical_name=$2,publisher=$3,
                name_pattern=COALESCE(NULLIF($8,''),$2),publisher_pattern=COALESCE(NULLIF($9,''),$3),
                provider=$10,provider_package_id=$1,target_version=$4,
                release_channel=$5,installer_type=$11,verification=$12::jsonb,execution=$13::jsonb,source_revision=$4,
                source_metadata=source_metadata || $6::jsonb || $14::jsonb,updated_at=now()
          WHERE id=$7`,
        [
          packageId, canonicalName, publisher, normalizedVersion, channel,
          JSON.stringify({ latestSource: sourceKey, releaseDate, vendorPriority: sourcePriority }),
          existing.rows[0].id,
          clean(catalogueMetadata.namePattern),
          clean(catalogueMetadata.publisherPattern),
          catalogueProvider,
          installerType,
          JSON.stringify(verification || {}),
          JSON.stringify(execution || {}),
          JSON.stringify(catalogueMetadata || {}),
        ],
      )
    } else {
      await client.query(
        `INSERT INTO rmm_software_catalogue
          (tenant_id,canonical_name,publisher,name_pattern,publisher_pattern,provider,provider_package_id,
           target_version,release_channel,installer_type,verification,execution,catalogue_source,external_key,source_revision,source_metadata)
         VALUES (NULL,$2,$3,COALESCE(NULLIF($7,''),$2),COALESCE(NULLIF($8,''),$3),$9,$1,$4,$5,$10,$11::jsonb,$12::jsonb,'vendor',$1,$4,$6::jsonb || $13::jsonb)`,
        [
          packageId, canonicalName, publisher, normalizedVersion, channel,
          JSON.stringify({ latestSource: sourceKey, releaseDate, vendorPriority: sourcePriority }),
          clean(catalogueMetadata.namePattern),
          clean(catalogueMetadata.publisherPattern),
          catalogueProvider,
          installerType,
          JSON.stringify(verification || {}),
          JSON.stringify(execution || {}),
          JSON.stringify(catalogueMetadata || {}),
        ],
      )
    }

    await client.query(
      `UPDATE rmm_software_vendor_sources
          SET cursor_value=$2,last_success_at=now(),last_error='',records_seen=records_seen+1,
              metadata=metadata || $3::jsonb,updated_at=now()
        WHERE source_key=$1`,
      [sourceKey, normalizedVersion, JSON.stringify({ latestVersion: normalizedVersion, releaseDate })],
    )

    return normalizedVersion
  })
}
async function binding(sourceKey) {
  const result = await pool.query(
    `SELECT b.source_key,b.provider_package_id,b.canonical_name,b.publisher,b.channel,b.platform,b.architecture,
            b.metadata AS binding_metadata,s.priority,s.source_url,s.source_type,s.metadata AS source_metadata
       FROM rmm_software_vendor_bindings b
       JOIN rmm_software_vendor_sources s ON s.source_key=b.source_key
      WHERE b.source_key=$1 AND b.enabled=true AND s.enabled=true
      ORDER BY b.id LIMIT 1`,
    [sourceKey],
  )
  return result.rows[0] || null
}

async function syncGenericConfigured(sourceKey, state) {
  const b = await binding(sourceKey)
  if (!b) return null
  const config = { ...object(b.source_metadata), ...object(b.binding_metadata) }
  const parser = object(config.parserConfig)
  let version = ''
  let releaseDate = null
  let installerUrl = ''
  let installerSha256 = ''
  let resolvedInstallerType = clean(config.installerType).toLowerCase()
  let releaseUrl = ''
  let verificationProductCode = ''
  let payload = {}

  if (state.source_type === 'github_releases') {
    const repository = repositoryName(config.repository || state.source_url)
    if (!repository) throw new Error(sourceKey + ' has no valid GitHub repository')
    const release = await latestGithubRelease(repository)
    version = releaseVersion(release?.tag_name || release?.name)
    releaseDate = normalizedReleaseDate(release?.published_at || release?.created_at)
    releaseUrl = clean(release?.html_url)
    const assets = Array.isArray(release?.assets) ? release.assets : []
    const installerMatch = globMatcher(config.assetPattern)
    const checksumMatch = globMatcher(config.checksumAssetPattern)
    const installer = installerMatch ? assets.find((asset) => installerMatch.test(clean(asset?.name))) : null
    const checksum = checksumMatch ? assets.find((asset) => checksumMatch.test(clean(asset?.name))) : null
    installerUrl = clean(installer?.browser_download_url)
    if (installer && checksum) installerSha256 = await publishedChecksum(checksum.browser_download_url, installer.name)
    resolvedInstallerType = detectInstallerType(installer?.name, resolvedInstallerType)
    payload = { github: { id: release?.id, tag_name: release?.tag_name, html_url: release?.html_url } }
  } else if (state.source_type === 'vendor_json') {
    const response = await fetchPublicJson(state.source_url)
    version = releaseVersion(jsonPathValue(response, parser.versionPath))
    releaseDate = normalizedReleaseDate(jsonPathValue(response, parser.releaseDatePath))
    releaseUrl = clean(jsonPathValue(response, parser.releaseUrlPath))
    const rawInstaller = clean(jsonPathValue(response, parser.installerUrlPath))
    if (rawInstaller) installerUrl = (await publicHttpsUrl(new URL(rawInstaller, state.source_url).toString())).toString()
    installerSha256 = normalizedSha256(jsonPathValue(response, parser.sha256Path))
    verificationProductCode = clean(jsonPathValue(response, parser.productCodePath))
    if (verificationProductCode && !/^\{[0-9A-Fa-f-]{36}\}$/.test(verificationProductCode)) {
      throw new Error(sourceKey + ' returned an invalid MSI ProductCode')
    }
    resolvedInstallerType = detectInstallerType(installerUrl ? new URL(installerUrl).pathname : '', resolvedInstallerType)
    payload = { json: { paths: parser, selected: { version, releaseDate, releaseUrl, installerUrl: rawInstaller, productCode: verificationProductCode } } }
  } else if (state.source_type === 'static_release') {
    version = releaseVersion(config.staticVersion)
    installerUrl = config.staticInstallerUrl ? (await publicHttpsUrl(config.staticInstallerUrl)).toString() : ''
    installerSha256 = normalizedSha256(config.staticSha256)
    releaseUrl = config.staticReleaseUrl ? (await publicHttpsUrl(config.staticReleaseUrl)).toString() : ''
    resolvedInstallerType = detectInstallerType(installerUrl ? new URL(installerUrl).pathname : '', resolvedInstallerType)
    payload = { static: { version, installerUrl, releaseUrl } }
  } else {
    throw new Error('No generic software vendor resolver for source type ' + state.source_type)
  }

  if (!version) throw new Error(sourceKey + ' returned no usable release version')
  const verification = { ...object(config.verificationConfig) }
  if (verificationProductCode) verification.productCode = verificationProductCode
  const deploymentMode = clean(config.deploymentMode || 'winget_preferred')
  const vendorDirect = deploymentMode === 'vendor_direct'
  const trustState = vendorDirect
    && installerUrl
    && /^[A-F0-9]{64}$/.test(installerSha256)
    && clean(config.expectedSigner)
    && ['msi','exe'].includes(resolvedInstallerType)
    && (resolvedInstallerType !== 'exe' || clean(config.installArguments))
      ? 'direct_ready'
      : deploymentMode === 'winget_preferred' && clean(config.wingetPackageId || b.provider_package_id)
        ? 'winget_ready'
        : 'version_only'

  return upsertRelease({
    sourceKey: b.source_key,
    packageId: b.provider_package_id,
    canonicalName: b.canonical_name,
    publisher: b.publisher,
    channel: b.channel,
    platform: b.platform,
    architecture: b.architecture,
    version,
    releaseDate,
    installerUrl,
    installerSha256,
    installerType: resolvedInstallerType,
    sourcePriority: b.priority,
    payload: {
      ...payload,
      releaseUrl,
      trustState,
      expectedSigner: clean(config.expectedSigner),
      deploymentMode,
      verification,
      installArguments: clean(config.installArguments),
    },
    catalogueProvider: vendorDirect ? 'vendor' : 'winget',
    verification,
    execution: { installArguments: clean(config.installArguments) },
    catalogueMetadata: {
      namePattern: clean(config.namePattern || b.canonical_name),
      publisherPattern: clean(config.publisherPattern || b.publisher),
      latestSource: sourceKey,
      sourceType: state.source_type,
      deploymentMode,
      expectedSigner: clean(config.expectedSigner),
      trustState,
      releaseUrl,
      hasWingetFallback: Boolean(clean(config.wingetPackageId)),
      wingetPackageId: clean(config.wingetPackageId),
    },
  })
}

async function syncChrome() {
  const b = await binding('google_chrome')
  if (!b) return null
  const payload = await fetchJson(b.source_url + '?page_size=10')
  const versions = Array.isArray(payload?.versions) ? payload.versions : []
  const latest = clean(versions[0]?.version)
  if (!latest) throw new Error('Chrome VersionHistory returned no stable Windows versions')
  return upsertRelease({
    sourceKey: b.source_key,
    packageId: b.provider_package_id,
    canonicalName: b.canonical_name,
    publisher: b.publisher,
    channel: b.channel,
    platform: b.platform,
    architecture: b.architecture,
    version: latest,
    sourcePriority: b.priority,
    payload: { versions: versions.slice(0, 10) },
  })
}

async function syncEdge() {
  const b = await binding('microsoft_edge')
  if (!b) return null
  const products = await fetchJson(b.source_url)
  const stable = (Array.isArray(products) ? products : []).find((item) => clean(item?.Product).toLowerCase() === 'stable')
  const releases = (Array.isArray(stable?.Releases) ? stable.Releases : [])
    .filter((item) => clean(item?.Platform) === 'Windows' && clean(item?.Architecture).toLowerCase() === 'x64')
    .sort((a, z) => Date.parse(z?.PublishedTime || 0) - Date.parse(a?.PublishedTime || 0))
  const latest = releases[0]
  if (!latest?.ProductVersion) throw new Error('Edge enterprise feed returned no Stable Windows x64 release')
  const msi = (Array.isArray(latest.Artifacts) ? latest.Artifacts : []).find((item) => clean(item?.ArtifactName).toLowerCase() === 'msi')
  return upsertRelease({
    sourceKey: b.source_key,
    packageId: b.provider_package_id,
    canonicalName: b.canonical_name,
    publisher: b.publisher,
    channel: b.channel,
    platform: b.platform,
    architecture: b.architecture,
    version: latest.ProductVersion,
    releaseDate: parseLooseDate(latest.PublishedTime),
    installerUrl: clean(msi?.Location),
    installerSha256: clean(msi?.Hash),
    installerType: msi ? 'msi' : '',
    sourcePriority: b.priority,
    payload: latest,
  })
}
async function syncMozilla(sourceKey, versionField) {
  const b = await binding(sourceKey)
  if (!b) return null
  const payload = await fetchJson(b.source_url)
  const latest = clean(payload?.[versionField])
  if (!latest) throw new Error(sourceKey + ' returned no release version')
  const releaseDate = sourceKey === 'mozilla_firefox' ? parseLooseDate(payload?.LAST_RELEASE_DATE) : null
  return upsertRelease({
    sourceKey: b.source_key,
    packageId: b.provider_package_id,
    canonicalName: b.canonical_name,
    publisher: b.publisher,
    channel: b.channel,
    platform: b.platform,
    architecture: b.architecture,
    version: latest,
    releaseDate,
    sourcePriority: b.priority,
    payload,
  })
}

async function syncVsCode() {
  const b = await binding('microsoft_vscode')
  if (!b) return null
  const payload = await fetchJson(b.source_url)
  const latest = clean(Array.isArray(payload) ? payload[0] : '')
  if (!latest) throw new Error('VS Code release API returned no stable version')
  return upsertRelease({
    sourceKey: b.source_key,
    packageId: b.provider_package_id,
    canonicalName: b.canonical_name,
    publisher: b.publisher,
    channel: b.channel,
    platform: b.platform,
    architecture: b.architecture,
    version: latest,
    sourcePriority: b.priority,
    payload: { versions: payload.slice(0, 25) },
  })
}
async function syncSevenZip() {
  const b = await binding('sevenzip')
  if (!b) return null
  const html = await fetchText(b.source_url, 'text/html')
  const text = stripHtml(html)
  const match = text.match(/Download 7-Zip\s+([0-9]+(?:\.[0-9]+)+)\s+\((\d{4}-\d{2}-\d{2})\)\s+for Windows/i)
  if (!match) throw new Error('7-Zip download page did not contain the current Windows version')
  return upsertRelease({
    sourceKey: b.source_key,
    packageId: b.provider_package_id,
    canonicalName: b.canonical_name,
    publisher: b.publisher,
    channel: b.channel,
    platform: b.platform,
    architecture: b.architecture,
    version: match[1],
    releaseDate: parseLooseDate(match[2]),
    sourcePriority: b.priority,
    payload: { source: b.source_url },
  })
}

async function syncAdobeReader() {
  const b = await binding('adobe_acrobat_reader')
  if (!b) return null
  const html = await fetchText(b.source_url, 'text/html')
  const text = stripHtml(html)
  const match = text.match(/Continuous Track Installers.*?([0-9]{2}\.[0-9]{3}\.[0-9]{5})\s+(?:Out of cycle|Planned|Optional)?\s*update,\s*([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/i)
    || text.match(/([0-9]{2}\.[0-9]{3}\.[0-9]{5})\s+(?:Out of cycle|Planned|Optional)?\s*update,\s*([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/i)
  if (!match) throw new Error('Adobe Acrobat release notes did not contain a current Continuous track version')
  return upsertRelease({
    sourceKey: b.source_key,
    packageId: b.provider_package_id,
    canonicalName: b.canonical_name,
    publisher: b.publisher,
    channel: b.channel,
    platform: b.platform,
    architecture: b.architecture,
    version: match[1],
    releaseDate: parseLooseDate(match[2]),
    sourcePriority: b.priority,
    payload: { source: b.source_url },
  })
}
const adapters = {
  google_chrome: syncChrome,
  microsoft_edge: syncEdge,
  mozilla_firefox: () => syncMozilla('mozilla_firefox', 'LATEST_FIREFOX_VERSION'),
  mozilla_thunderbird: () => syncMozilla('mozilla_thunderbird', 'LATEST_THUNDERBIRD_VERSION'),
  microsoft_vscode: syncVsCode,
  sevenzip: syncSevenZip,
  adobe_acrobat_reader: syncAdobeReader,
}

export async function syncSoftwareVendorSource(sourceKey) {
  const state = await sourceState(sourceKey)
  if (!state?.enabled) return { sourceKey, skipped: true }
  const adapter = adapters[sourceKey]
    || (['github_releases','vendor_json','static_release'].includes(state.source_type)
      ? () => syncGenericConfigured(sourceKey, state)
      : null)
  if (!adapter) throw new Error('No software vendor adapter registered for ' + sourceKey + ' (' + state.source_type + ')')
  await markAttempt(sourceKey)
  try {
    const version = await adapter()
    return {
      sourceKey,
      version,
      changed: Boolean(clean(version) && clean(version) !== clean(state.cursor_value)),
      ok: true,
    }
  } catch (error) {
    await markFailure(sourceKey, error)
    throw error
  }
}

export async function syncDueSoftwareVendorSources() {
  const due = await pool.query(
    `SELECT source_key
       FROM rmm_software_vendor_sources
      WHERE enabled=true
        AND (last_attempt_at IS NULL OR last_attempt_at + (poll_minutes || ' minutes')::interval <= now())
      ORDER BY priority DESC,source_key`,
  )
  const results = []
  for (const row of due.rows) {
    try {
      results.push(await syncSoftwareVendorSource(row.source_key))
    } catch (error) {
      console.error('RMM software vendor sync failed', row.source_key, error.message)
      results.push({ sourceKey: row.source_key, ok: false, error: error.message })
    }
  }
  if (results.some((item) => item?.ok && item?.changed)) {
    recalculateAllTenantVulnerabilityExposures().catch((error) => {
      console.error('RMM vulnerability exposure refresh failed after vendor release change', error)
    })
  }
  return results
}

export async function softwareVendorSummary() {
  const [sources, releases] = await Promise.all([
    pool.query(
      `SELECT source_key,display_name,source_type,source_url,enabled,priority,poll_minutes,cursor_value,
              last_attempt_at,last_success_at,last_error,records_seen,metadata
         FROM rmm_software_vendor_sources ORDER BY priority DESC,display_name`,
    ),
    pool.query(
      `SELECT DISTINCT ON (provider_package_id,channel,platform,architecture)
              source_key,provider_package_id,canonical_name,publisher,channel,platform,architecture,
              version,release_date,installer_url,installer_sha256,installer_type,source_priority,last_seen_at
         FROM rmm_software_vendor_releases
        ORDER BY provider_package_id,channel,platform,architecture,source_priority DESC,
                 COALESCE(release_date,last_seen_at) DESC`,
    ),
  ])
  return { sources: sources.rows, latest: releases.rows }
}

let schedulerStarted = false

export function startSoftwareVendorSyncScheduler() {
  if (schedulerStarted) return
  schedulerStarted = true
  const run = () => syncDueSoftwareVendorSources().catch((error) => console.error('RMM software vendor scheduler failed', error))
  setTimeout(run, 10_000).unref?.()
  setInterval(run, 5 * 60 * 1000).unref?.()
}
