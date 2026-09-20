import { pool, withTransaction } from './db.js'
import {
  fetchPublicJson,
  fetchPublicText,
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
import { syncAutomaticWingetFallbacks } from './rmmWingetFallback.js'
import {
  discoverGithubWindowsInstaller,
  runVendorArtifactQualification,
  selectChecksumAsset,
  selectWindowsInstallerAsset,
  vendorReleaseTrustProfile,
} from './rmmVendorReleaseEnrichment.js'

function clean(value = '') { return String(value ?? '').trim() }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {} }
function versionNumbers(value = '') { return clean(value).match(/\d+/g)?.map(Number) || [] }
function compareVersionValues(a, b) {
  const left = versionNumbers(a), right = versionNumbers(b)
  const size = Math.max(left.length, right.length)
  for (let i = 0; i < size; i += 1) {
    const delta = (left[i] || 0) - (right[i] || 0)
    if (delta) return delta
  }
  return clean(a).localeCompare(clean(b))
}

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
  releaseUrl = '',
  assetName = '',
  trustState = 'version_only',
  trustEvidence = {},
  qualificationState = 'intelligence_only',
  qualificationEvidence = {},
  qualificationNotes = '',
  sourcePriority = 100,
  payload = {},
  catalogueProvider = 'winget',
  verification = {},
  execution = {},
  catalogueMetadata = {},
}) {
  const normalizedVersion = clean(version)
  if (!normalizedVersion) throw new Error(sourceKey + ' returned an empty version')

  const legacyWingetFallback = catalogueProvider === 'winget'
    && clean(packageId)
    && !clean(packageId).startsWith('vendor:')
  if (legacyWingetFallback) {
    verification = {
      method: 'winget',
      packageId: clean(packageId),
      productCode: '',
      displayNameContains: clean(canonicalName),
      publisherContains: clean(publisher),
      filePath: '',
      ...object(verification),
    }
    trustState = trustState === 'version_only' ? 'winget_ready' : trustState
    trustEvidence = {
      sourceOfTruth: 'vendor_feed',
      deploymentTransport: 'winget',
      ...object(trustEvidence),
    }
    qualificationState = qualificationState === 'intelligence_only' ? 'deployment_candidate' : qualificationState
    qualificationEvidence = {
      vendorAuthoritativeVersion: true,
      wingetFallback: true,
      ...object(qualificationEvidence),
    }
    qualificationNotes = qualificationNotes
      || 'Vendor feed is authoritative for the target version; WinGet is used only as the deployment transport.'
    catalogueMetadata = {
      deploymentMode: 'winget_preferred',
      trustState,
      wingetPackageId: clean(packageId),
      hasWingetFallback: true,
      automaticVendorRelease: true,
      ...object(catalogueMetadata),
    }
  }

  return withTransaction(async (client) => {
    await client.query(
      `INSERT INTO rmm_software_vendor_releases
        (source_key,provider_package_id,canonical_name,publisher,channel,platform,architecture,
         version,release_date,installer_url,installer_sha256,installer_type,release_url,asset_name,
         trust_state,trust_evidence,source_priority,source_payload,last_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18::jsonb,now())
       ON CONFLICT (source_key,provider_package_id,channel,platform,architecture,version)
       DO UPDATE SET release_date=COALESCE(EXCLUDED.release_date,rmm_software_vendor_releases.release_date),
         installer_url=EXCLUDED.installer_url,
         installer_sha256=EXCLUDED.installer_sha256,
         installer_type=EXCLUDED.installer_type,
         release_url=EXCLUDED.release_url,
         asset_name=EXCLUDED.asset_name,
         trust_state=CASE
           WHEN rmm_software_vendor_releases.trust_state IN ('rejected','signer_review_required','installer_review_required')
             THEN rmm_software_vendor_releases.trust_state
           WHEN rmm_software_vendor_releases.trust_state='direct_ready'
             AND EXCLUDED.trust_state<>'direct_ready'
             THEN 'direct_ready'
           ELSE EXCLUDED.trust_state
         END,
         trust_evidence=rmm_software_vendor_releases.trust_evidence || EXCLUDED.trust_evidence,
         source_priority=EXCLUDED.source_priority,
         source_payload=(rmm_software_vendor_releases.source_payload || EXCLUDED.source_payload)
           || jsonb_build_object(
             'trustState',
             CASE
               WHEN rmm_software_vendor_releases.trust_state IN ('rejected','signer_review_required','installer_review_required')
                 THEN rmm_software_vendor_releases.trust_state
               WHEN rmm_software_vendor_releases.trust_state='direct_ready'
                 AND EXCLUDED.trust_state<>'direct_ready'
                 THEN 'direct_ready'
               ELSE EXCLUDED.trust_state
             END
           ),
         last_seen_at=now()
       RETURNING id,trust_state,trust_evidence,source_payload`,
      [
        sourceKey, packageId, canonicalName, publisher, channel, platform, architecture,
        normalizedVersion, releaseDate, installerUrl, installerSha256, installerType,
        releaseUrl, assetName, trustState, JSON.stringify(trustEvidence || {}),
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
                source_metadata=(source_metadata || $6::jsonb || $14::jsonb)
                  || jsonb_build_object(
                    'trustState',
                    CASE
                      WHEN source_revision=$4
                        AND source_metadata->>'trustState' IN ('rejected','signer_review_required','installer_review_required')
                        THEN source_metadata->>'trustState'
                      WHEN source_revision=$4
                        AND source_metadata->>'trustState'='direct_ready'
                        AND COALESCE($14::jsonb->>'trustState','')<>'direct_ready'
                        THEN 'direct_ready'
                      ELSE COALESCE(NULLIF($14::jsonb->>'trustState',''),source_metadata->>'trustState','version_only')
                    END,
                    'deploymentMode',
                    CASE
                      WHEN source_revision=$4
                        AND source_metadata->>'trustState' IN ('rejected','signer_review_required','installer_review_required')
                        THEN 'intelligence_only'
                      WHEN source_revision=$4
                        AND source_metadata->>'trustState'='direct_ready'
                        AND COALESCE($14::jsonb->>'trustState','')<>'direct_ready'
                        THEN 'vendor_direct'
                      ELSE COALESCE(NULLIF($14::jsonb->>'deploymentMode',''),source_metadata->>'deploymentMode','intelligence_only')
                    END
                  ),
                qualification_state=CASE
                  WHEN qualification_state IN ('qualified','blocked') THEN qualification_state
                  WHEN source_revision=$4 AND source_metadata->>'trustState'='direct_ready' THEN 'deployment_candidate'
                  WHEN source_revision=$4
                    AND source_metadata->>'trustState' IN ('rejected','signer_review_required','installer_review_required') THEN 'intelligence_only'
                  ELSE $15
                END,
                qualification_evidence=qualification_evidence || $16::jsonb,
                qualification_notes=CASE WHEN qualification_notes<>'' THEN qualification_notes ELSE $17 END,
                updated_at=now()
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
          qualificationState,
          JSON.stringify(qualificationEvidence || {}),
          clean(qualificationNotes).slice(0, 1000),
        ],
      )
    } else {
      await client.query(
        `INSERT INTO rmm_software_catalogue
          (tenant_id,canonical_name,publisher,name_pattern,publisher_pattern,provider,provider_package_id,
           target_version,release_channel,installer_type,verification,execution,catalogue_source,external_key,source_revision,source_metadata,
           qualification_state,qualification_evidence,qualification_notes)
         VALUES (NULL,$2,$3,COALESCE(NULLIF($7,''),$2),COALESCE(NULLIF($8,''),$3),$9,$1,$4,$5,$10,$11::jsonb,$12::jsonb,'vendor',$1,$4,
           $6::jsonb || $13::jsonb,$14,$15::jsonb,$16)`,
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
          qualificationState,
          JSON.stringify(qualificationEvidence || {}),
          clean(qualificationNotes).slice(0, 1000),
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

async function latestGithubTagViaRedirect(repository) {
  let current = await publicHttpsUrl('https://github.com/' + repository + '/releases/latest')
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(current, {
      headers: { 'User-Agent': 'Hi5Central-Software-Catalogue/1.0' },
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    })
    if ([301,302,303,307,308].includes(response.status)) {
      const location = clean(response.headers.get('location'))
      if (!location) throw new Error('GitHub latest release redirected without a location')
      current = await publicHttpsUrl(new URL(location, current).toString())
      continue
    }
    if (!response.ok) throw new Error('GitHub latest release HTTP ' + response.status)
    const match = current.pathname.match(/\/releases\/tag\/(.+)$/)
    if (!match) throw new Error(repository + ' has no usable latest GitHub release')
    return {
      tag: decodeURIComponent(match[1]),
      releaseUrl: current.toString(),
    }
  }
  throw new Error('GitHub latest release redirected too many times')
}

function normalizedGithubVersion(value = '') {
  const raw = clean(value)
  if (/^v?\d/i.test(raw)) return releaseVersion(raw)
  const numeric = raw.match(/\d+(?:[._]\d+)+/)
  return numeric ? numeric[0].replaceAll('_', '.') : releaseVersion(raw)
}

async function matchingGithubRelease(repository, pattern) {
  const matcher = globMatcher(pattern)
  if (!matcher) throw new Error(repository + ' has an invalid releaseTagPattern')
  const response = await fetch('https://api.github.com/repos/' + repository + '/releases?per_page=50', {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Hi5Central-Software-Catalogue/1.0' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error('GitHub Releases HTTP ' + response.status)
  const releases = await response.json()
  const release = (Array.isArray(releases) ? releases : [])
    .find((item) => !item?.draft && matcher.test(clean(item?.tag_name)))
  if (!release) throw new Error(repository + ' has no release matching ' + pattern)
  return release
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
  let selectedAssetReason = ''
  let payload = {}

  if (state.source_type === 'github_releases') {
    const repository = repositoryName(config.repository || state.source_url)
    if (!repository) throw new Error(sourceKey + ' has no valid GitHub repository')
    if (!clean(config.releaseTagPattern) && !clean(config.assetPattern) && !clean(config.checksumAssetPattern)) {
      const lightweight = await latestGithubTagViaRedirect(repository)
      version = normalizedGithubVersion(lightweight.tag)
      releaseUrl = lightweight.releaseUrl
      const discovery = await discoverGithubWindowsInstaller(repository, lightweight.tag, b.canonical_name)
      const installer = discovery.installer
      const checksum = discovery.checksum
      selectedAssetReason = clean(installer?.selectionReason)
      installerUrl = clean(installer?.browser_download_url)
      if (installer && checksum) {
        installerSha256 = await publishedChecksum(checksum.browser_download_url, installer.name).catch(() => '')
      }
      resolvedInstallerType = detectInstallerType(installer?.name, resolvedInstallerType)
      payload = { github: {
        tag_name: lightweight.tag,
        html_url: lightweight.releaseUrl,
        lightweight: true,
        automaticAssetDiscovery: true,
        assetsSeen: discovery.assetsSeen,
        selectedAsset: clean(installer?.name),
        selectedAssetReason,
        checksumAsset: clean(checksum?.name),
      } }
    } else {
      const release = clean(config.releaseTagPattern)
        ? await matchingGithubRelease(repository, config.releaseTagPattern)
        : await latestGithubRelease(repository)
      version = normalizedGithubVersion(release?.tag_name || release?.name)
      releaseDate = normalizedReleaseDate(release?.published_at || release?.created_at)
      releaseUrl = clean(release?.html_url)
      const assets = Array.isArray(release?.assets) ? release.assets : []
      const installerMatch = globMatcher(config.assetPattern)
      const checksumMatch = globMatcher(config.checksumAssetPattern)
      const installer = installerMatch
        ? assets.find((asset) => installerMatch.test(clean(asset?.name)))
        : selectWindowsInstallerAsset(assets, b.canonical_name)
      const checksum = checksumMatch
        ? assets.find((asset) => checksumMatch.test(clean(asset?.name)))
        : selectChecksumAsset(assets)
      selectedAssetReason = installerMatch ? 'configured_asset_pattern' : clean(installer?.selectionReason)
      installerUrl = clean(installer?.browser_download_url)
      if (installer && checksum) {
        installerSha256 = await publishedChecksum(checksum.browser_download_url, installer.name).catch(() => '')
      }
      resolvedInstallerType = detectInstallerType(installer?.name, resolvedInstallerType)
      payload = { github: {
        id: release?.id,
        tag_name: release?.tag_name,
        html_url: release?.html_url,
        lightweight: false,
        releaseTagPattern: clean(config.releaseTagPattern),
        selectedAsset: clean(installer?.name),
        selectedAssetReason,
      } }
    }
  } else if (state.source_type === 'gitlab_releases') {
    const releases = await fetchPublicJson(state.source_url)
    const release = Array.isArray(releases) ? releases[0] : null
    if (!release) throw new Error(sourceKey + ' returned no GitLab releases')
    const rawVersion = clean(release.tag_name || release.name)
    const numeric = rawVersion.match(/\d+(?:[._-]\d+)+/)
    version = releaseVersion(numeric ? numeric[0].replaceAll('_', '.') : rawVersion)
    releaseDate = normalizedReleaseDate(release.released_at || release.created_at)
    releaseUrl = clean(release?._links?.self || release?._links?.tag || '')
    payload = { gitlab: { name: release.name, tag_name: release.tag_name, released_at: release.released_at } }
  } else if (state.source_type === 'vendor_json') {
    const response = await fetchPublicJson(state.source_url)
    if (sourceKey === 'go_golang') {
      const releases = Array.isArray(response) ? response : []
      const latest = releases.find((item) => item?.stable !== false) || releases[0]
      if (!latest?.version) throw new Error('Go release feed returned no stable release')
      version = clean(latest.version)
      const file = (Array.isArray(latest.files) ? latest.files : []).find((item) =>
        clean(item?.os) === 'windows'
        && clean(item?.arch) === 'amd64'
        && clean(item?.kind) === 'installer'
        && clean(item?.filename).toLowerCase().endsWith('.msi')
      )
      if (!file) throw new Error('Go release feed returned no Windows amd64 MSI installer')
      installerUrl = (await publicHttpsUrl('https://go.dev/dl/' + clean(file.filename))).toString()
      installerSha256 = normalizedSha256(file.sha256)
      resolvedInstallerType = 'msi'
      releaseUrl = 'https://go.dev/dl/'
      selectedAssetReason = 'vendor_published_installer'
      payload = { go: { version: latest.version, filename: file.filename, sha256: file.sha256, kind: file.kind } }
    } else if (sourceKey === 'nodejs') {
      const releases = Array.isArray(response) ? response : []
      const latest = releases[0]
      const rawVersion = clean(latest?.version)
      if (!rawVersion) throw new Error('Node.js release feed returned no current release')
      version = releaseVersion(rawVersion)
      const files = Array.isArray(latest?.files) ? latest.files : []
      if (!files.includes('win-x64-msi')) throw new Error('Node.js release feed did not advertise a Windows x64 MSI')
      const filename = 'node-' + rawVersion + '-x64.msi'
      const distBase = 'https://nodejs.org/dist/' + rawVersion + '/'
      installerUrl = (await publicHttpsUrl(distBase + filename)).toString()
      const shasums = await fetchPublicText(distBase + 'SHASUMS256.txt', { maxBytes: 2 * 1024 * 1024 })
      const checksumLine = shasums.split(/\r?\n/).find((line) => line.trim().endsWith('  ' + filename))
      installerSha256 = normalizedSha256(clean(checksumLine).split(/\s+/)[0])
      if (!installerSha256) throw new Error('Node.js SHASUMS256.txt did not contain ' + filename)
      resolvedInstallerType = 'msi'
      releaseDate = normalizedReleaseDate(latest?.date)
      releaseUrl = distBase
      selectedAssetReason = 'vendor_published_installer'
      payload = { nodejs: { version: rawVersion, filename, sha256: installerSha256, files } }
    } else {
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
    }
  } else if (state.source_type === 'python_releases') {
    const releases = await fetchPublicJson(state.source_url)
    const candidates = (Array.isArray(releases) ? releases : [])
      .filter((item) => item?.is_published !== false && !item?.pre_release)
      .map((item) => ({ item, version: clean(item?.name).match(/^Python\s+(\d+\.\d+\.\d+)$/i)?.[1] || '' }))
      .filter((item) => item.version)
      .sort((a, b) => compareVersionValues(a.version, b.version))
    const latest = candidates.at(-1)
    if (!latest) throw new Error(sourceKey + ' returned no stable Python release')
    version = latest.version
    releaseDate = normalizedReleaseDate(latest.item.release_date)
    const releaseId = clean(latest.item.resource_uri).match(/\/release\/(\d+)\/?$/)?.[1] || ''
    if (!releaseId) throw new Error(sourceKey + ' latest Python release has no usable release ID')
    const files = await fetchPublicJson('https://www.python.org/api/v2/downloads/release_file/?release=' + releaseId)
    const installer = (Array.isArray(files) ? files : []).find((item) =>
      /^Windows installer \(64-bit\)$/i.test(clean(item?.name))
      && clean(item?.url).toLowerCase().endsWith('-amd64.exe')
    )
    if (!installer?.url) throw new Error(sourceKey + ' returned no Windows 64-bit installer')
    installerUrl = (await publicHttpsUrl(installer.url)).toString()
    installerSha256 = normalizedSha256(installer.sha256_sum)
    if (!installerSha256) throw new Error(sourceKey + ' Windows installer did not include SHA-256')
    resolvedInstallerType = 'exe'
    releaseUrl = clean(latest.item.resource_uri)
    selectedAssetReason = 'vendor_published_installer'
    payload = {
      python: {
        name: latest.item.name,
        slug: latest.item.slug,
        release_date: latest.item.release_date,
        releaseId,
        installer: installer.name,
        sha256: installer.sha256_sum,
      },
    }
  } else if (state.source_type === 'hashicorp_releases') {
    const response = JSON.parse(await fetchPublicText(state.source_url, {
      accept: 'application/vnd+hashicorp.releases-api.v0+json, application/json',
      maxBytes: 5 * 1024 * 1024,
    }))
    const versions = Object.keys(object(response?.versions))
      .filter((item) => /^\d+\.\d+\.\d+$/.test(item))
      .sort(compareVersionValues)
    version = versions.at(-1) || ''
    const selected = object(response?.versions?.[version])
    const build = (Array.isArray(selected.builds) ? selected.builds : [])
      .find((item) => clean(item?.os) === 'windows' && clean(item?.arch) === 'amd64')
    installerUrl = build?.url ? (await publicHttpsUrl(build.url)).toString() : ''
    releaseUrl = version ? new URL(version + '/', new URL('.', state.source_url)).toString() : ''
    payload = { hashicorp: { version, filename: build?.filename || '', shasums: selected.shasums || '' } }
  } else if (state.source_type === 'adoptium') {
    const info = await fetchPublicJson(state.source_url)
    const lts = Number(info?.most_recent_lts || 0)
    if (!lts) throw new Error(sourceKey + ' returned no current Adoptium LTS')
    const assetsUrl = 'https://api.adoptium.net/v3/assets/latest/' + lts + '/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse'
    const assets = await fetchPublicJson(assetsUrl)
    const asset = Array.isArray(assets) ? assets[0] : null
    if (!asset) throw new Error(sourceKey + ' returned no Windows x64 JDK asset')
    version = clean(asset?.version?.openjdk_version || asset?.version?.semver || asset?.release_name)
    releaseDate = normalizedReleaseDate(asset?.binary?.updated_at)
    releaseUrl = clean(asset?.release_link)
    const installer = asset?.binary?.installer
    installerUrl = installer?.link ? (await publicHttpsUrl(installer.link)).toString() : ''
    installerSha256 = normalizedSha256(installer?.checksum)
    resolvedInstallerType = detectInstallerType(installer?.name, resolvedInstallerType)
    payload = { adoptium: { lts, release_name: asset.release_name, installer: installer?.name || '' } }
  } else if (state.source_type === 'vendor_text') {
    const body = await fetchPublicText(state.source_url, { maxBytes: 5 * 1024 * 1024 })
    if (config.adapter === 'signal_yaml') {
      version = clean(body.match(/^version:\s*([^\s]+)\s*$/mi)?.[1])
      releaseDate = normalizedReleaseDate(body.match(/^releaseDate:\s*['"]?([^'"\r\n]+)['"]?\s*$/mi)?.[1])
      const path = clean(body.match(/^path:\s*([^\s]+)\s*$/mi)?.[1])
      installerUrl = path ? (await publicHttpsUrl(new URL(path, state.source_url).toString())).toString() : ''
      resolvedInstallerType = detectInstallerType(path, resolvedInstallerType)
      payload = { text: { adapter: config.adapter, path } }
    } else if (config.adapter === 'vlc_directory') {
      const match = body.match(/vlc-([0-9]+(?:\.[0-9]+)+)-win64\.exe/i)
      version = clean(match?.[1])
      const name = match?.[0] || ''
      installerUrl = name ? (await publicHttpsUrl(new URL(name, state.source_url).toString())).toString() : ''
      resolvedInstallerType = detectInstallerType(name, resolvedInstallerType)
      payload = { text: { adapter: config.adapter, filename: name } }
    } else if (config.adapter === 'element_windows_index') {
      const candidates = [...body.matchAll(
        /href="(Element Setup ([0-9]+(?:\.[0-9]+)+)\.exe)"[\s\S]{0,350}?<td class="date">([^<]+)<\/td>/gi,
      )].map((match) => ({
        name: clean(match[1]),
        version: clean(match[2]),
        date: clean(match[3]),
      })).filter((item) => item.name && item.version)
      candidates.sort((a, b) => compareVersionValues(a.version, b.version))
      const latest = candidates.at(-1)
      if (!latest) throw new Error(sourceKey + ' returned no versioned Windows x64 Element installer')
      version = latest.version
      releaseDate = normalizedReleaseDate(latest.date)
      installerUrl = (await publicHttpsUrl(new URL(latest.name, state.source_url).toString())).toString()
      resolvedInstallerType = 'exe'
      releaseUrl = state.source_url
      selectedAssetReason = 'official_vendor_channel_installer'
      payload = { text: { adapter: config.adapter, filename: latest.name, version, releaseDate } }
    } else if (config.adapter === 'grafana_windows_download') {
      const match = body.match(
        /SHA256:\s*(?:<!-- -->)?([a-f0-9]{64})[\s\S]{0,1000}?href="(https:\/\/dl\.grafana\.com\/grafana\/release\/([0-9.]+)\/grafana_[^"]+_windows_amd64\.msi)"/i,
      )
      if (!match) throw new Error(sourceKey + ' returned no Grafana Windows amd64 MSI metadata')
      installerSha256 = normalizedSha256(match[1])
      installerUrl = (await publicHttpsUrl(match[2])).toString()
      version = clean(match[3])
      resolvedInstallerType = 'msi'
      releaseUrl = state.source_url
      selectedAssetReason = 'vendor_published_installer'
      payload = { text: { adapter: config.adapter, version, installerUrl, sha256: installerSha256 } }
    } else if (config.adapter === 'nextcloud_windows_index') {
      const candidates = [...body.matchAll(
        /href="(Nextcloud-([0-9]+(?:\.[0-9]+)+)-x64\.msi)"/gi,
      )].map((match) => ({
        name: clean(match[1]),
        version: clean(match[2]),
      })).filter((item) => item.name && item.version)
      candidates.sort((a, b) => compareVersionValues(a.version, b.version))
      const latest = candidates.at(-1)
      if (!latest) throw new Error(sourceKey + ' returned no versioned Windows x64 Nextcloud MSI')
      version = latest.version
      installerUrl = (await publicHttpsUrl(new URL(latest.name, state.source_url).toString())).toString()
      resolvedInstallerType = 'msi'
      releaseUrl = state.source_url
      selectedAssetReason = 'official_vendor_channel_installer'
      payload = { text: { adapter: config.adapter, filename: latest.name, version } }
    } else if (config.adapter === 'qgis_windows_download') {
      const candidates = [...body.matchAll(
        /href=["']?(https:\/\/download\.qgis\.org\/downloads\/(QGIS-OSGeo4W-([0-9]+(?:\.[0-9]+)+)-[0-9]+\.msi))/gi,
      )].map((match) => ({
        url: clean(match[1]),
        name: clean(match[2]),
        version: clean(match[3]),
      })).filter((item) => item.url && item.version)
      candidates.sort((a, b) => compareVersionValues(a.version, b.version))
      const latest = candidates.at(-1)
      if (!latest) throw new Error(sourceKey + ' returned no current QGIS Windows MSI')
      version = latest.version
      installerUrl = (await publicHttpsUrl(latest.url)).toString()
      const metaUrl = await publicHttpsUrl('https://dl1.qgis.org/downloads/' + latest.name + '.meta4')
      const metalink = await fetchPublicText(metaUrl.toString(), { maxBytes: 2 * 1024 * 1024 })
      installerSha256 = normalizedSha256(
        metalink.match(/<hash\s+type=["']sha-256["']>([a-f0-9]{64})<\/hash>/i)?.[1],
      )
      if (!installerSha256) throw new Error(sourceKey + ' QGIS Metalink did not contain SHA-256')
      resolvedInstallerType = 'msi'
      releaseUrl = state.source_url
      selectedAssetReason = 'vendor_published_installer'
      payload = {
        text: {
          adapter: config.adapter,
          filename: latest.name,
          version,
          sha256: installerSha256,
          metalink: metaUrl.toString(),
        },
      }
    } else if (config.adapter === 'gimp_windows_index') {
      const candidates = [...body.matchAll(
        /href="(gimp-([0-9]+(?:\.[0-9]+)+)-setup\.exe)"/gi,
      )].map((match) => ({
        name: clean(match[1]),
        version: clean(match[2]),
      })).filter((item) => item.name && item.version)
      candidates.sort((a, b) => compareVersionValues(a.version, b.version))
      const latest = candidates.at(-1)
      if (!latest) throw new Error(sourceKey + ' returned no stable GIMP Windows setup executable')
      version = latest.version
      installerUrl = (await publicHttpsUrl(new URL(latest.name, state.source_url).toString())).toString()
      const sumsUrl = await publicHttpsUrl(new URL('SHA256SUMS', state.source_url).toString())
      const sums = await fetchPublicText(sumsUrl.toString(), { maxBytes: 2 * 1024 * 1024 })
      const checksumLine = sums.split(/\r?\n/).find((line) => line.trim().endsWith('  ' + latest.name))
      installerSha256 = normalizedSha256(clean(checksumLine).split(/\s+/)[0])
      if (!installerSha256) throw new Error(sourceKey + ' GIMP SHA256SUMS did not contain ' + latest.name)
      resolvedInstallerType = 'exe'
      releaseUrl = state.source_url
      selectedAssetReason = 'vendor_published_installer'
      payload = {
        text: {
          adapter: config.adapter,
          filename: latest.name,
          version,
          sha256: installerSha256,
          sums: sumsUrl.toString(),
        },
      }
    } else if (config.adapter === 'wazuh_windows_packages') {
      const matches = [...body.matchAll(
        /href="(https:\/\/packages\.wazuh\.com\/4\.x\/windows\/(wazuh-agent-([0-9]+(?:\.[0-9]+)+)-([0-9]+)\.msi))"/gi,
      )].map((match) => ({
        url: clean(match[1]),
        name: clean(match[2]),
        version: clean(match[3]),
        revision: Number(match[4] || 0),
      }))
      matches.sort((a, b) => compareVersionValues(a.version, b.version) || a.revision - b.revision)
      const latest = matches.at(-1)
      if (!latest) throw new Error(sourceKey + ' returned no Wazuh Windows MSI package')
      version = latest.version
      installerUrl = (await publicHttpsUrl(latest.url)).toString()
      resolvedInstallerType = 'msi'
      releaseUrl = state.source_url
      selectedAssetReason = 'official_vendor_channel_installer'
      payload = {
        text: {
          adapter: config.adapter,
          filename: latest.name,
          version,
          revision: latest.revision,
        },
      }
    } else if (config.adapter === 'jenkins_jsonp') {
      const wrapped = body.match(/^\s*updateCenter\.post\(([\s\S]*)\);?\s*$/)
      if (!wrapped) throw new Error(sourceKey + ' returned invalid Jenkins update-center JSONP')
      const response = JSON.parse(wrapped[1])
      version = clean(response?.core?.version)
      releaseDate = normalizedReleaseDate(response?.core?.buildDate)
      installerUrl = response?.core?.url ? (await publicHttpsUrl(response.core.url)).toString() : ''
      if (response?.core?.sha256) installerSha256 = Buffer.from(response.core.sha256, 'base64').toString('hex').toUpperCase()
      payload = { text: { adapter: config.adapter, core: { version, url: installerUrl } } }
    } else {
      throw new Error(sourceKey + ' has an unsupported vendor text adapter')
    }
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
  if (!installerSha256 && clean(config.trustedReleaseVersion) === clean(version)) {
    installerSha256 = normalizedSha256(config.trustedReleaseSha256)
  }
  const verification = { ...object(config.verificationConfig) }
  if (verificationProductCode) verification.productCode = verificationProductCode
  const wingetPackageId = clean(config.wingetPackageId || config.autoWingetPackageId)
  const configuredExpectedSigner = clean(config.autoExpectedSigner || config.expectedSigner)
  const configuredDeploymentMode = clean(config.autoDeploymentMode || config.deploymentMode)
  const trust = vendorReleaseTrustProfile({
    installerUrl,
    installerSha256,
    installerType: resolvedInstallerType,
    publisher: b.publisher,
    expectedSigner: configuredExpectedSigner,
    verification,
    wingetPackageId,
    deploymentMode: configuredDeploymentMode,
  })
  const deploymentMode = trust.deploymentMode
  const trustState = trust.trustState
  const expectedSigner = trust.expectedSigner || configuredExpectedSigner
  const selectedAssetName = installerUrl
    ? decodeURIComponent(new URL(installerUrl).pathname.split('/').filter(Boolean).at(-1) || '')
    : ''
  const qualificationEvidence = {
    ...trust.evidence,
    sourceKey,
    releaseUrl,
    selectedAsset: selectedAssetName,
    selectedAssetReason,
  }

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
    releaseUrl,
    assetName: selectedAssetName,
    trustState,
    trustEvidence: qualificationEvidence,
    qualificationState: trust.qualificationState,
    qualificationEvidence,
    qualificationNotes: trust.qualificationState === 'deployment_candidate'
      ? 'Automatically promoted from the authoritative vendor release feed with deployable trust metadata.'
      : '',
    sourcePriority: b.priority,
    payload: {
      ...payload,
      releaseUrl,
      trustState,
      trustEvidence: qualificationEvidence,
      expectedSigner,
      deploymentMode,
      verification,
      installArguments: clean(config.installArguments),
    },
    catalogueProvider: 'managed',
    verification,
    execution: { installArguments: clean(config.installArguments) },
    catalogueMetadata: {
      namePattern: clean(config.namePattern || b.canonical_name),
      publisherPattern: clean(config.publisherPattern || b.publisher),
      latestSource: sourceKey,
      sourceType: state.source_type,
      deploymentMode,
      expectedSigner,
      autoExpectedSigner: clean(config.autoExpectedSigner),
      autoDeploymentMode: clean(config.autoDeploymentMode),
      autoTrustState: clean(config.autoTrustState),
      trustState,
      trustEvidence: qualificationEvidence,
      releaseUrl,
      selectedAsset: selectedAssetName,
      selectedAssetReason,
      automaticVendorRelease: true,
      hasWingetFallback: Boolean(wingetPackageId),
      wingetPackageId: clean(config.wingetPackageId),
      autoWingetPackageId: clean(config.autoWingetPackageId),
      autoWingetConfidence: clean(config.autoWingetConfidence),
    },
  })
}

async function syncChrome() {
  const b = await binding('google_chrome')
  if (!b) return null
  const response = await fetchJson(b.source_url + '?page_size=10')
  const versions = Array.isArray(response?.versions) ? response.versions : []
  const latest = clean(versions[0]?.version)
  if (!latest) throw new Error('Chrome VersionHistory returned no stable Windows versions')

  const config = { ...object(b.source_metadata), ...object(b.binding_metadata) }
  const installerUrl = (await publicHttpsUrl(
    'https://dl.google.com/dl/chrome/install/googlechromestandaloneenterprise64.msi',
  )).toString()
  const verification = {
    method: 'uninstall_registry',
    packageId: '',
    productCode: '',
    displayNameContains: 'Google Chrome',
    publisherContains: 'Google LLC',
    filePath: '',
  }
  const wingetPackageId = clean(config.wingetPackageId || config.autoWingetPackageId || 'Google.Chrome')
  const trust = vendorReleaseTrustProfile({
    installerUrl,
    installerSha256: '',
    installerType: 'msi',
    publisher: b.publisher,
    expectedSigner: clean(config.expectedSigner),
    verification,
    wingetPackageId,
    deploymentMode: clean(config.deploymentMode),
  })
  const evidence = {
    ...trust.evidence,
    sourceKey: b.source_key,
    releaseUrl: b.source_url,
    selectedAsset: 'googlechromestandaloneenterprise64.msi',
    selectedAssetReason: 'official_vendor_channel_installer',
  }
  return upsertRelease({
    sourceKey: b.source_key,
    packageId: b.provider_package_id,
    canonicalName: b.canonical_name,
    publisher: b.publisher,
    channel: b.channel,
    platform: b.platform,
    architecture: b.architecture,
    version: latest,
    installerUrl,
    installerType: 'msi',
    releaseUrl: b.source_url,
    assetName: 'googlechromestandaloneenterprise64.msi',
    trustState: trust.trustState,
    trustEvidence: evidence,
    qualificationState: trust.qualificationState,
    qualificationEvidence: evidence,
    sourcePriority: b.priority,
    payload: {
      versions: versions.slice(0, 10),
      releaseUrl: b.source_url,
      trustState: trust.trustState,
      trustEvidence: evidence,
      expectedSigner: '',
      deploymentMode: trust.deploymentMode,
      verification,
      installArguments: '',
    },
    catalogueProvider: 'managed',
    verification,
    execution: { installArguments: '' },
    catalogueMetadata: {
      namePattern: 'Google Chrome',
      publisherPattern: 'Google LLC',
      latestSource: b.source_key,
      sourceType: 'vendor_api',
      deploymentMode: trust.deploymentMode,
      trustState: trust.trustState,
      trustEvidence: evidence,
      releaseUrl: b.source_url,
      selectedAsset: 'googlechromestandaloneenterprise64.msi',
      selectedAssetReason: 'official_vendor_channel_installer',
      automaticVendorRelease: true,
      hasWingetFallback: Boolean(wingetPackageId),
      wingetPackageId,
    },
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
    || (['github_releases','gitlab_releases','vendor_json','vendor_text','hashicorp_releases','python_releases','adoptium','static_release'].includes(state.source_type)
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

  try {
    const fallback = await syncAutomaticWingetFallbacks()
    if (fallback?.mapped) {
      const ready = fallback.mappings.filter((item) => item.transportReady).length
      const lagging = fallback.mappings.filter((item) => !item.transportReady).length
      console.log('RMM WinGet fallback verification', { mapped: fallback.mapped, ready, lagging })
    }
  } catch (error) {
    console.error('RMM automatic WinGet fallback verification failed', error.message)
  }

  try {
    const qualification = await runVendorArtifactQualification({ inspectLimit: 2 })
    if (qualification.reconciled.length || qualification.queued.length) {
      console.log('RMM vendor artifact qualification', qualification)
    }
  } catch (error) {
    console.error('RMM vendor artifact qualification failed', error.message)
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
              version,release_date,release_url,asset_name,installer_url,installer_sha256,installer_type,
              trust_state,trust_evidence,source_priority,last_seen_at
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
  const qualify = () => runVendorArtifactQualification({ inspectLimit: 2 })
    .catch((error) => console.error('RMM vendor artifact qualification scheduler failed', error))
  setTimeout(run, 10_000).unref?.()
  setInterval(run, 5 * 60 * 1000).unref?.()
  setTimeout(qualify, 30_000).unref?.()
  setInterval(qualify, 60_000).unref?.()
}