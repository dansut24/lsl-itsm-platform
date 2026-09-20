import { pool, withTransaction } from './db.js'
import { publicHttpsUrl } from './rmmTenantVendorSources.js'

function clean(value = '') { return String(value ?? '').trim() }
function lower(value = '') { return clean(value).toLowerCase() }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {} }

function htmlDecode(value = '') {
  return String(value)
    .replaceAll('&amp;', '&')
    .replaceAll('&#x2F;', '/')
    .replaceAll('&#47;', '/')
    .replaceAll('&quot;', '"')
}

function assetName(value = '') {
  try {
    const path = new URL(value, 'https://github.com').pathname
    return decodeURIComponent(path.split('/').filter(Boolean).at(-1) || '')
  } catch {
    return clean(value).split('/').at(-1) || ''
  }
}

function installerAssetScore(name = '', productName = '') {
  const value = lower(name)
  const product = lower(productName)
  const isMsi = value.endsWith('.msi')
  const isExe = value.endsWith('.exe')
  if (!isMsi && !isExe) return -Infinity
  if (/\b(?:arm64|aarch64|armv\d*|x86|win32|ia32|i[3-6]86|32[-_. ]?bit)\b/i.test(value)) return -Infinity
  if (/\b(?:portable|debug|symbols?|pdb|source|src|uninstall)\b/i.test(value)) return -Infinity
  if (isExe && !/(?:setup|installer|install)/i.test(value)) return -Infinity

  let score = isMsi ? 80 : 55
  if (/(?:windows|win64|win[-_.]?x64)/i.test(value)) score += 25
  if (/(?:x64|amd64|64[-_. ]?bit)/i.test(value)) score += 20
  if (/(?:setup|installer)/i.test(value)) score += 20
  if (/(?:enterprise|machine|allusers)/i.test(value)) score += 5
  if (/legacy/i.test(value) && !/legacy/i.test(product)) score -= 60
  if (/\bagent\b/i.test(value) && !/\bagent\b/i.test(product)) score -= 50
  if (/\bserver\b/i.test(value) && !/\bserver\b/i.test(product)) score -= 35
  if (/\bcli\b/i.test(value) && !/\bcli\b/i.test(product)) score -= 25
  if (/(?:web|bootstrap)/i.test(value)) score -= 8
  return score
}

function checksumAssetScore(name = '') {
  const value = lower(name)
  if (/sha256sums?|checksums?.*sha256|sha256.*checksums?/.test(value)) return 100
  if (/\.sha256(?:sum)?$/.test(value)) return 90
  if (/checksums?|shasums?/.test(value)) return 60
  return -Infinity
}

export function selectWindowsInstallerAsset(assets = [], productName = '') {
  return assets
    .map((asset) => ({ ...asset, score: installerAssetScore(asset?.name, productName) }))
    .filter((asset) => Number.isFinite(asset.score))
    .sort((a, b) => b.score - a.score || clean(a.name).localeCompare(clean(b.name)))[0] || null
}

export function selectChecksumAsset(assets = []) {
  return assets
    .map((asset) => ({ ...asset, score: checksumAssetScore(asset?.name) }))
    .filter((asset) => Number.isFinite(asset.score))
    .sort((a, b) => b.score - a.score || clean(a.name).localeCompare(clean(b.name)))[0] || null
}

export async function githubExpandedAssets(repository, tag) {
  const [owner, repo] = clean(repository).split('/')
  if (!owner || !repo || !clean(tag)) return []
  const url = await publicHttpsUrl(
    'https://github.com/' + owner + '/' + repo + '/releases/expanded_assets/' + encodeURIComponent(clean(tag)),
  )
  const response = await fetch(url, {
    headers: { Accept: 'text/html', 'User-Agent': 'Hi5Central-Software-Catalogue/1.0' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error('GitHub expanded assets HTTP ' + response.status)
  const body = await response.text()
  const seen = new Set()
  const assets = []
  const matcher = /href="([^"]*\/releases\/download\/[^"]+)"/gi
  for (const match of body.matchAll(matcher)) {
    const href = htmlDecode(match[1])
    const resolved = new URL(href, 'https://github.com').toString()
    if (seen.has(resolved)) continue
    seen.add(resolved)
    assets.push({ name: assetName(resolved), browser_download_url: resolved })
  }
  return assets
}

export async function discoverGithubWindowsInstaller(repository, tag, productName = '') {
  const assets = await githubExpandedAssets(repository, tag)
  return {
    installer: selectWindowsInstallerAsset(assets, productName),
    checksum: selectChecksumAsset(assets),
    assetsSeen: assets.length,
  }
}

export function vendorReleaseTrustProfile(input = {}) {
  const installerUrl = clean(input.installerUrl)
  const installerSha256 = clean(input.installerSha256).toUpperCase()
  const installerType = lower(input.installerType)
  const publisher = clean(input.publisher)
  const expectedSigner = clean(input.expectedSigner)
  const verification = object(input.verification)
  const wingetPackageId = clean(input.wingetPackageId)
  const existingMode = clean(input.deploymentMode)
  const verificationReady = Boolean(
    verification.method
    && (verification.productCode || verification.displayNameContains || verification.filePath || verification.packageId),
  )
  const directReady = Boolean(
    /^https:\/\//i.test(installerUrl)
    && /^[A-F0-9]{64}$/.test(installerSha256)
    && ['msi','exe'].includes(installerType)
    && expectedSigner.length >= 4
    && verificationReady
  )

  const trustState = directReady
    ? 'direct_ready'
    : installerUrl && ['msi','exe'].includes(installerType)
      ? 'asset_candidate'
      : 'version_only'

  const deploymentMode = directReady
    ? 'vendor_direct'
    : wingetPackageId
      ? 'winget_preferred'
      : existingMode === 'vendor_direct'
        ? 'intelligence_only'
        : (existingMode || 'intelligence_only')

  const qualificationState = directReady || wingetPackageId
    ? 'deployment_candidate'
    : 'intelligence_only'

  return {
    trustState,
    deploymentMode,
    qualificationState,
    expectedSigner: directReady ? expectedSigner : '',
    evidence: {
      automaticVendorRelease: true,
      installerSelected: Boolean(installerUrl),
      installerType,
      vendorChecksumPresent: /^[A-F0-9]{64}$/.test(installerSha256),
      signerExpectationSource: directReady ? 'curated_publisher' : 'not_ready',
      verificationReady,
      wingetFallback: Boolean(wingetPackageId),
    },
  }
}

function signerKey(value = '') {
  return lower(value)
    .replace(/[^a-z0-9]/g, '')
}

function signerEquivalent(left = '', right = '') {
  const a = signerKey(left)
  const b = signerKey(right)
  if (!a || !b) return false
  return a === b || (a.length >= 8 && b.length >= 8 && (a.includes(b) || b.includes(a)))
}

function probeResult(row = {}) {
  const result = object(row.result)
  return result
}

export async function reconcileVendorArtifactInspections() {
  const jobs = await pool.query(
    `SELECT j.id,j.status,j.result,j.error_message,j.request_metadata,
            r.id AS release_id,r.source_key,r.provider_package_id,r.canonical_name,r.version,
            r.installer_url,r.installer_sha256,r.installer_type,r.trust_state,
            b.metadata AS binding_metadata
       FROM rmm_agent_jobs j
       JOIN rmm_software_vendor_releases r
         ON r.id::text=j.request_metadata->>'vendor_release_id'

       LEFT JOIN rmm_software_vendor_bindings b
         ON b.source_key=r.source_key
        AND b.provider_package_id=r.provider_package_id
        AND b.channel=r.channel
        AND b.platform=r.platform
        AND b.architecture=r.architecture
      WHERE j.job_type='patch.vendor_artifact.inspect'
        AND j.request_metadata->>'source'='vendor_artifact_trust_probe'
        AND COALESCE(j.request_metadata->>'reconciled','false')<>'true'
        AND j.status IN ('completed','failed')
      ORDER BY j.completed_at NULLS LAST,j.created_at
      LIMIT 50`,
  )

  const reconciled = []
  for (const row of jobs.rows) {
    const result = probeResult(row)
    const actualSha = clean(result.sha256 || result.actualSha256).toUpperCase()
    const configuredSha = clean(row.installer_sha256).toUpperCase()
    const signer = clean(result.signer)
    const signatureVerified = result.signatureVerified === true
    const hashVerified = /^[A-F0-9]{64}$/.test(actualSha)
      && (!configuredSha || configuredSha === actualSha)
    const metadata = object(row.binding_metadata)
    const signerBaseline = clean(metadata.signerBaseline || metadata.expectedSigner)
    const inspectionError = lower(clean(result.error || row.error_message))

    let trustState = 'asset_candidate'
    let reason = clean(row.error_message || result.error) || 'inspection_incomplete'
    if (row.status === 'completed' && hashVerified && signatureVerified && signer) {
      if (signerBaseline && !signerEquivalent(signerBaseline, signer)) {
        trustState = 'signer_review_required'
        reason = 'signer_changed_from_baseline'
      } else {
        trustState = 'direct_ready'
        reason = 'authenticode_and_sha256_verified'
      }
    } else if (configuredSha && actualSha && configuredSha !== actualSha) {
      trustState = 'rejected'
      reason = 'vendor_checksum_mismatch'
    } else if (
      inspectionError === 'authenticode_invalid'
      || inspectionError === 'authenticode_signer_missing'
      || (row.status === 'completed' && !signatureVerified)
    ) {
      trustState = 'rejected'
      reason = inspectionError || 'authenticode_invalid'
    }

    const resolvedSha = trustState === 'direct_ready' ? (configuredSha || actualSha) : configuredSha
    const expectedSigner = trustState === 'direct_ready' ? (signerBaseline || signer) : signerBaseline
    const hashProvenance = configuredSha ? 'vendor_published_checksum' : 'endpoint_pinned_sha256'
    const evidence = {
      source: 'patchhost_artifact_inspection',
      jobId: row.id,
      inspectedAt: new Date().toISOString(),
      reason,
      sha256: actualSha,

      hashProvenance,
      signatureVerified,
      signer,
      signerBaseline: signerBaseline || signer,
      installerUrl: row.installer_url,
      installerType: row.installer_type,
      patchHostVersion: clean(object(result.capabilities).patchHostVersion),
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE rmm_software_vendor_releases
            SET installer_sha256=CASE WHEN $2<>'' THEN $2 ELSE installer_sha256 END,
                trust_state=$3,
                trust_evidence=trust_evidence || $4::jsonb,
                source_payload=source_payload || $5::jsonb,
                last_seen_at=now()
          WHERE id=$1`,
        [
          row.release_id,
          resolvedSha,
          trustState,
          JSON.stringify(evidence),
          JSON.stringify({
            trustState,
            deploymentMode: trustState === 'direct_ready' ? 'vendor_direct' : 'intelligence_only',
            expectedSigner,
            signerBaseline: signerBaseline || signer,
            artifactHashProvenance: hashProvenance,
          }),
        ],
      )

      if (trustState === 'direct_ready') {
        await client.query(
          `UPDATE rmm_software_vendor_bindings
              SET metadata=metadata || $3::jsonb
            WHERE source_key=$1 AND provider_package_id=$2 AND enabled=true`,
          [
            row.source_key,
            row.provider_package_id,
            JSON.stringify({
              deploymentMode: 'vendor_direct',
              expectedSigner,
              signerBaseline: signerBaseline || signer,
              trustState,
              installerType: row.installer_type,
              automaticVendorRelease: true,
              artifactHashProvenance: hashProvenance,
              trustedReleaseVersion: row.version,
              trustedReleaseSha256: resolvedSha,
            }),
          ],
        )

        await client.query(
          `UPDATE rmm_software_catalogue
              SET source_metadata=source_metadata || $2::jsonb,
                  qualification_state=CASE
                    WHEN qualification_state IN ('qualified','blocked') THEN qualification_state
                    ELSE 'deployment_candidate'
                  END,

                  qualification_evidence=qualification_evidence || $3::jsonb,
                  qualification_notes=CASE
                    WHEN qualification_notes<>'' THEN qualification_notes
                    ELSE 'Automatically promoted after non-executing PatchHost artifact trust inspection.'
                  END,
                  updated_at=now()
            WHERE tenant_id IS NULL
              AND catalogue_source='vendor'
              AND external_key=$1
              AND status='active'`,
          [
            row.provider_package_id,
            JSON.stringify({
              deploymentMode: 'vendor_direct',
              expectedSigner,
              signerBaseline: signerBaseline || signer,
              trustState,
              automaticVendorRelease: true,
              artifactHashProvenance: hashProvenance,
            }),
            JSON.stringify({
              source: 'automatic_vendor_release',
              vendorReleaseId: row.release_id,
              artifactInspectionJobId: row.id,
              authenticodeVerified: true,
              sha256Verified: true,
              signer: expectedSigner,
              hashProvenance,
            }),
          ],
        )
      } else {
        await client.query(
          `UPDATE rmm_software_catalogue
              SET source_metadata=source_metadata || $2::jsonb,updated_at=now()
            WHERE tenant_id IS NULL
              AND catalogue_source='vendor'
              AND external_key=$1
              AND status='active'`,
          [row.provider_package_id, JSON.stringify({ trustState, trustEvidence: evidence })],
        )
      }

      await client.query(
        `UPDATE rmm_agent_jobs
            SET request_metadata=request_metadata || $2::jsonb
          WHERE id=$1`,
        [row.id, JSON.stringify({
          reconciled: 'true',
          reconciledAt: new Date().toISOString(),
          trustState,
          trustReason: reason,
        })],
      )
    })
    reconciled.push({ releaseId: row.release_id, sourceKey: row.source_key, trustState, reason })
  }
  return reconciled
}

export async function queueVendorArtifactInspections(limit = 2) {
  const cappedLimit = Math.max(0, Math.min(5, Number(limit) || 0))
  if (!cappedLimit) return []

  const runners = await pool.query(
    `SELECT a.id AS agent_device_id,a.tenant_id,i.name AS device_name
       FROM rmm_software_vendor_qualification_runners q
       JOIN rmm_agent_devices a ON a.id=q.agent_device_id AND a.disabled_at IS NULL
       JOIN rmm_device_inventory i ON i.id=a.inventory_id AND i.active=true
      WHERE q.enabled=true
        AND a.websocket_status='Connected'
        AND a.last_telemetry_at>now()-interval '90 seconds'
        AND COALESCE((a.patch_capabilities->'vendorDirect'->>'artifactInspection')::boolean,false)=true
      ORDER BY a.last_telemetry_at DESC
      LIMIT 1`,
  )
  const runner = runners.rows[0]
  if (!runner) return []

  const active = await pool.query(
    `SELECT count(*)::int AS count
       FROM rmm_agent_jobs
      WHERE agent_device_id=$1
        AND job_type='patch.vendor_artifact.inspect'
        AND status IN ('queued','claimed')`,
    [runner.agent_device_id],
  )
  const availableSlots = Math.max(0, cappedLimit - Number(active.rows[0]?.count || 0))
  if (!availableSlots) return []

  const candidates = await pool.query(
    `SELECT DISTINCT ON (r.source_key,r.provider_package_id)
            r.id,r.source_key,r.provider_package_id,r.canonical_name,r.version,
            r.installer_url,r.installer_sha256,r.installer_type
       FROM rmm_software_vendor_releases r
      WHERE r.trust_state='asset_candidate'
        AND r.installer_url<>''
        AND r.installer_type IN ('msi','exe')

        AND NOT EXISTS (
          SELECT 1 FROM rmm_agent_jobs j
           WHERE j.job_type='patch.vendor_artifact.inspect'
             AND j.request_metadata->>'vendor_release_id'=r.id::text
             AND j.status IN ('queued','claimed')
        )
        AND NOT EXISTS (
          SELECT 1 FROM rmm_agent_jobs j
           WHERE j.job_type='patch.vendor_artifact.inspect'
             AND j.request_metadata->>'vendor_release_id'=r.id::text
             AND j.status IN ('completed','failed')
             AND j.created_at>now()-interval '24 hours'
        )
      ORDER BY r.source_key,r.provider_package_id,r.last_seen_at DESC
      LIMIT $1`,
    [availableSlots],
  )

  const queued = []
  for (const release of candidates.rows) {
    const safeUrl = await publicHttpsUrl(release.installer_url)
    const inserted = await pool.query(
      `INSERT INTO rmm_agent_jobs
        (tenant_id,agent_device_id,job_type,payload,initiated_by,initiated_by_label,request_metadata)
       VALUES ($1,$2,'patch.vendor_artifact.inspect',$3::jsonb,'system','Vendor catalogue trust',$4::jsonb)
       RETURNING id,status,created_at`,

      [
        runner.tenant_id,
        runner.agent_device_id,
        JSON.stringify({
          protocolVersion: 1,
          action: 'software.inspect',
          provider: 'vendor_direct',
          applicationName: release.canonical_name,
          targetVersion: release.version,
          downloadUrl: safeUrl.toString(),
          sha256: clean(release.installer_sha256),
          installerType: release.installer_type,
        }),
        JSON.stringify({
          source: 'vendor_artifact_trust_probe',
          vendor_release_id: release.id,
          vendor_source_key: release.source_key,
          canonical_name: release.canonical_name,
          expected_version: release.version,
        }),
      ],
    )
    queued.push({
      jobId: inserted.rows[0].id,
      releaseId: release.id,
      sourceKey: release.source_key,
      applicationName: release.canonical_name,
      version: release.version,
      deviceName: runner.device_name,
    })
  }
  return queued
}

export async function runVendorArtifactQualification({ inspectLimit = 2 } = {}) {
  const reconciled = await reconcileVendorArtifactInspections()
  const queued = await queueVendorArtifactInspections(inspectLimit)
  return { reconciled, queued }
}