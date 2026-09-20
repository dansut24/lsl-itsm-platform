import fs from 'node:fs'
import zlib from 'node:zlib'
import { DatabaseSync } from 'node:sqlite'
import { pool } from './db.js'

const SOURCE_URL = 'https://cdn.winget.microsoft.com/cache/source2.msix'
const INDEX_DB_PATH = '/tmp/hi5central-winget-index.db'
const CACHE_MS = 6 * 60 * 60 * 1000
let lastIndexRefreshAt = 0
let lastSummary = null

function clean(value = '') { return String(value ?? '').trim() }
function normalizedName(value = '') {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '')
}
function normalizedPublisher(value = '') {
  return normalizedName(value)
    .replace(/(?:incorporated|corporation|company|limited|software|foundation|project|llc|ltd|inc|corp)$/g, '')
}
function versionParts(value = '') {
  const parts = clean(value).match(/\d+/g)
  return parts?.length ? parts.map(Number) : null
}
function compareVersions(leftValue, rightValue) {
  const left = versionParts(leftValue)
  const right = versionParts(rightValue)
  if (!left || !right) return null
  const size = Math.max(left.length, right.length)
  for (let index = 0; index < size; index += 1) {
    const delta = (left[index] || 0) - (right[index] || 0)
    if (delta) return delta < 0 ? -1 : 1
  }
  return 0
}
function u32(buffer, offset) { return buffer.readUInt32LE(offset) }
function u64(buffer, offset) {
  const value = buffer.readBigUInt64LE(offset)
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('WinGet source index is too large.')
  return Number(value)
}

function extractIndexDatabase(msix) {
  const eocdSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06])
  const eocd = msix.lastIndexOf(eocdSignature)
  if (eocd < 20) throw new Error('WinGet source is missing its ZIP end record.')
  const locator = eocd - 20
  if (u32(msix, locator) !== 0x07064b50) throw new Error('WinGet source is not ZIP64.')
  const zip64 = u64(msix, locator + 8)
  if (u32(msix, zip64) !== 0x06064b50) throw new Error('WinGet source ZIP64 directory is invalid.')
  const entries = u64(msix, zip64 + 32)
  const centralOffset = u64(msix, zip64 + 48)
  let cursor = centralOffset
  for (let index = 0; index < entries; index += 1) {
    if (u32(msix, cursor) !== 0x02014b50) throw new Error('WinGet central directory is invalid.')
    const method = msix.readUInt16LE(cursor + 10)
    const compressedSize = u32(msix, cursor + 20)
    const nameLength = msix.readUInt16LE(cursor + 28)
    const extraLength = msix.readUInt16LE(cursor + 30)
    const commentLength = msix.readUInt16LE(cursor + 32)
    const localOffset = u32(msix, cursor + 42)
    const name = msix.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8')
    if (name === 'Public/index.db') {
      if (u32(msix, localOffset) !== 0x04034b50) throw new Error('WinGet index local header is invalid.')
      const localNameLength = msix.readUInt16LE(localOffset + 26)
      const localExtraLength = msix.readUInt16LE(localOffset + 28)
      const start = localOffset + 30 + localNameLength + localExtraLength
      const compressed = msix.subarray(start, start + compressedSize)
      const output = method === 8 ? zlib.inflateRawSync(compressed) : compressed
      if (!output.subarray(0, 16).toString('ascii').startsWith('SQLite format 3')) {
        throw new Error('WinGet Public/index.db is not SQLite.')
      }
      return output
    }
    cursor += 46 + nameLength + extraLength + commentLength
  }
  throw new Error('WinGet source did not contain Public/index.db.')
}

async function downloadIndexDatabase() {
  const response = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': 'Hi5Central-Software-Catalogue/1.0' },
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) throw new Error('WinGet source returned HTTP ' + response.status)
  const length = Number(response.headers.get('content-length') || 0)
  if (length && length > 25 * 1024 * 1024) throw new Error('WinGet source exceeded the size limit.')
  const msix = Buffer.from(await response.arrayBuffer())
  if (msix.length > 25 * 1024 * 1024) throw new Error('WinGet source exceeded the size limit.')
  return extractIndexDatabase(msix)
}

async function ensureIndexDatabase(force = false) {
  const cacheFresh = !force
    && lastIndexRefreshAt
    && Date.now() - lastIndexRefreshAt < CACHE_MS
    && fs.existsSync(INDEX_DB_PATH)
  if (cacheFresh) return { path: INDEX_DB_PATH, refreshed: false }

  const indexBytes = await downloadIndexDatabase()
  fs.writeFileSync(INDEX_DB_PATH, indexBytes)
  lastIndexRefreshAt = Date.now()
  return { path: INDEX_DB_PATH, refreshed: true }
}

function publisherEvidence(db, packageRowId, publisher) {
  const expected = normalizedPublisher(publisher)
  if (!expected) return { matched: false, values: [] }
  const values = db.prepare('SELECT norm_publisher FROM norm_publishers2 WHERE package=? LIMIT 25')
    .all(packageRowId).map((row) => normalizedPublisher(row.norm_publisher)).filter(Boolean)
  const matched = values.some((value) => value === expected || value.includes(expected) || expected.includes(value))
  return { matched, values }
}
async function catalogueBindings() {
  const result = await pool.query(
    `SELECT b.source_key,b.provider_package_id,b.canonical_name,b.publisher,b.metadata,
            c.id AS catalogue_id,c.target_version,c.qualification_state,c.source_metadata,
            vr.trust_state AS vendor_trust_state,vr.installer_url AS vendor_installer_url
       FROM rmm_software_vendor_bindings b
       JOIN rmm_software_vendor_sources s ON s.source_key=b.source_key AND s.enabled=true
       LEFT JOIN rmm_software_catalogue c
         ON c.tenant_id IS NULL AND c.status='active'
        AND c.catalogue_source='vendor' AND c.external_key=b.provider_package_id
       LEFT JOIN LATERAL (
         SELECT r.trust_state,r.installer_url
           FROM rmm_software_vendor_releases r
          WHERE r.source_key=b.source_key
            AND r.provider_package_id=b.provider_package_id
            AND r.channel=b.channel
            AND r.platform=b.platform
            AND r.architecture=b.architecture
          ORDER BY r.last_seen_at DESC
          LIMIT 1
       ) vr ON true
      WHERE b.enabled=true AND b.platform='windows'
        AND b.architecture IN ('x64','amd64')
      ORDER BY lower(b.canonical_name)`
  )
  return result.rows
}

export async function syncAutomaticWingetFallbacks({ force = false, dryRun = false } = {}) {
  const index = await ensureIndexDatabase(force)
  const db = new DatabaseSync(index.path, { readOnly: true })
  try {
    const packages = db.prepare('SELECT rowid,id,name,latest_version FROM packages').all()
    const byName = new Map()
    const byId = new Map()
    for (const item of packages) {
      const idKey = clean(item.id).toLowerCase()
      if (idKey) byId.set(idKey, item)
      const key = normalizedName(item.name)
      if (!key) continue
      if (!byName.has(key)) byName.set(key, [])
      byName.get(key).push(item)
    }

    const bindings = await catalogueBindings()
    const mappings = []
    let ambiguous = 0
    let unmatched = 0
    for (const binding of bindings) {
      const metadata = binding.metadata && typeof binding.metadata === 'object' ? binding.metadata : {}
      const automaticPackageId = clean(metadata.autoWingetPackageId)
      const knownPackageId = clean(metadata.wingetPackageId || automaticPackageId)
      const curatedPackageId = Boolean(knownPackageId && !automaticPackageId)
      let match = null
      let confidence = ''
      let publisher = { matched: false, values: [] }

      if (knownPackageId) {
        match = byId.get(knownPackageId.toLowerCase()) || null
        if (!match) {
          unmatched += 1
          continue
        }
        publisher = publisherEvidence(db, match.rowid, binding.publisher)
        confidence = curatedPackageId
          ? (publisher.matched ? 'curated_package_id_publisher' : 'curated_package_id')
          : (publisher.matched ? 'automatic_package_id_publisher' : 'automatic_package_id')
      } else {
        const matches = byName.get(normalizedName(binding.canonical_name)) || []
        if (matches.length !== 1) {
          if (matches.length > 1) ambiguous += 1
          else unmatched += 1
          continue
        }
        match = matches[0]
        publisher = publisherEvidence(db, match.rowid, binding.publisher)
        if (clean(binding.publisher) && !publisher.matched) {
          unmatched += 1
          continue
        }
        confidence = publisher.matched ? 'exact_name_publisher' : 'exact_unique_name'
      }

      const versionComparison = compareVersions(match.latest_version, binding.target_version)
      mappings.push({
        sourceKey: binding.source_key,
        providerPackageId: binding.provider_package_id,
        catalogueId: binding.catalogue_id,
        packageId: clean(match.id),
        packageName: clean(match.name),
        packageVersion: clean(match.latest_version),
        targetVersion: clean(binding.target_version),
        vendorTrustState: clean(binding.vendor_trust_state || 'version_only'),
        vendorHasAsset: Boolean(clean(binding.vendor_installer_url)),
        vendorDirectReady: clean(binding.vendor_trust_state) === 'direct_ready',
        transportReady: Boolean(clean(binding.target_version))
          && versionComparison !== null
          && versionComparison >= 0,
        confidence,
        curatedPackageId,
      })
    }

    if (!dryRun) {
      for (const mapping of mappings) {
        const evidence = {
          wingetPackageId: mapping.packageId,
          wingetPackageName: mapping.packageName,
          wingetPackageVersion: mapping.packageVersion,
          wingetTargetVersion: mapping.targetVersion,
          wingetPackageConfidence: mapping.confidence,
          wingetPackageSource: SOURCE_URL,
          wingetPackageMappedAt: new Date().toISOString(),
          wingetPackageMapping: mapping.curatedPackageId ? 'curated' : 'automatic',
          wingetFallbackReady: mapping.transportReady,
          hasWingetFallback: mapping.transportReady,
          deploymentMode: mapping.vendorDirectReady
            ? 'vendor_direct'
            : mapping.transportReady
              ? 'winget_preferred'
              : 'intelligence_only',
          trustState: mapping.vendorDirectReady
            ? 'direct_ready'
            : mapping.transportReady
              ? 'winget_ready'
              : mapping.vendorHasAsset
                ? 'asset_candidate'
                : 'version_only',
        }
        if (!mapping.curatedPackageId) {
          evidence.autoWingetPackageId = mapping.packageId
          evidence.autoWingetPackageName = mapping.packageName
          evidence.autoWingetVersion = mapping.packageVersion
          evidence.autoWingetTargetVersion = mapping.targetVersion
          evidence.autoWingetConfidence = mapping.confidence
          evidence.autoWingetSource = SOURCE_URL
          evidence.autoWingetMappedAt = evidence.wingetPackageMappedAt
        }

        await pool.query(
          `UPDATE rmm_software_vendor_bindings
              SET metadata=metadata || $3::jsonb
            WHERE source_key=$1 AND provider_package_id=$2 AND enabled=true`,
          [mapping.sourceKey, mapping.providerPackageId, JSON.stringify(evidence)],
        )
        await pool.query(
          `UPDATE rmm_software_vendor_releases
              SET trust_state=$4,
                  trust_evidence=trust_evidence || $5::jsonb,
                  source_payload=source_payload || $6::jsonb,
                  last_seen_at=now()
            WHERE source_key=$1
              AND provider_package_id=$2
              AND version=$3`,
          [
            mapping.sourceKey,
            mapping.providerPackageId,
            mapping.targetVersion,
            evidence.trustState,
            JSON.stringify({
              wingetPackageId: mapping.packageId,
              wingetPackageVersion: mapping.packageVersion,
              wingetTargetVersion: mapping.targetVersion,
              wingetFallbackReady: mapping.transportReady,
              wingetPackageMapping: evidence.wingetPackageMapping,
            }),
            JSON.stringify({
              trustState: evidence.trustState,
              deploymentMode: evidence.deploymentMode,
              wingetFallbackReady: mapping.transportReady,
            }),
          ],
        )
        if (mapping.catalogueId) {
          await pool.query(
            `UPDATE rmm_software_catalogue
                SET source_metadata=source_metadata || $2::jsonb,
                    qualification_evidence=qualification_evidence || $2::jsonb,
                    qualification_state=CASE
                      WHEN qualification_state IN ('qualified','blocked') THEN qualification_state
                      WHEN $3 OR $4 THEN 'deployment_candidate'
                      ELSE 'intelligence_only'
                    END,
                    qualification_notes=CASE
                      WHEN $4 THEN qualification_notes
                      WHEN $3 THEN 'Vendor feed is authoritative; WinGet is a version-verified fallback transport.'
                      ELSE 'Vendor feed is authoritative; the matched WinGet fallback is behind the vendor target.'
                    END,
                    updated_at=now()
              WHERE id=$1 AND tenant_id IS NULL AND status='active'`,
            [
              mapping.catalogueId,
              JSON.stringify(evidence),
              mapping.transportReady,
              mapping.vendorDirectReady,
            ],
          )
        }
      }
    }

    const summary = {
      checked: bindings.length,
      mapped: mappings.length,
      ambiguous,
      unmatched,
      dryRun,
      source: SOURCE_URL,
      indexRefreshed: index.refreshed,
      mappings,
    }
    if (!dryRun) {
      lastSummary = { ...summary, mappings: mappings.slice(0, 25) }
    }
    return summary
  } finally {
    db.close()
  }
}

export function automaticWingetFallbackSummary() {
  return lastSummary
}