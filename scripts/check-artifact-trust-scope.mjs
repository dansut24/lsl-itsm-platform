import fs from 'node:fs'

let failures = 0
function expect(condition, message) {
  if (condition) return
  failures += 1
  console.error('FAIL:', message)
}

const vendorIntel = fs.readFileSync('api/src/rmmSoftwareVendorIntel.js', 'utf8')
const enrichment = fs.readFileSync('api/src/rmmVendorReleaseEnrichment.js', 'utf8')
const qualification = fs.readFileSync('api/src/rmmSoftwareQualification.js', 'utf8')
const patching = fs.readFileSync('api/src/rmmPatching.js', 'utf8')
const ui = fs.readFileSync('src/features/rmm/RmmPatching.jsx', 'utf8')

expect(
  vendorIntel.includes("CASE WHEN source_revision IS DISTINCT FROM $4 THEN") &&
    vendorIntel.includes("- 'vendorReleaseId'") &&
    vendorIntel.includes("- 'artifactVerificationVersion'") &&
    vendorIntel.includes("- 'authenticodeVerified'") &&
    vendorIntel.includes("- 'sha256Verified'"),
  'Target-version changes must invalidate version-scoped artifact trust evidence.',
)
expect(
  enrichment.includes("AND target_version=$4") &&
    enrichment.includes("AND source_metadata->>'latestSource'=$5"),
  'Artifact inspection reconciliation must only stamp the matching current source/version.',
)
expect(
  enrichment.includes('artifactVerificationVersion: row.version') &&
    enrichment.includes('artifactVerifiedAt: new Date().toISOString()') &&
    enrichment.includes('signer,'),
  'Successful artifact inspection must record current version, verification time, and observed signer.',
)
expect(
  enrichment.includes("r.trust_state='direct_ready'") &&
    enrichment.includes("COALESCE(r.trust_evidence->>'signatureVerified','false')<>'true'"),
  'Direct-ready releases missing observed signatures must remain eligible for bounded inspection.',
)
expect(
  enrichment.includes("'artifactVerificationVersion',c.target_version") &&
    enrichment.includes("upper(r.trust_evidence->>'sha256')=upper(r.installer_sha256)"),
  'Catalogue trust reconciliation must bind observed hash evidence to the current target.',
)
expect(
  (qualification.match(/qualification_evidence->>'vendorReleaseId'=r\.id::text/g) || []).length >= 3 &&
    (qualification.match(/qualification_evidence->>'artifactVerificationVersion'=c\.target_version/g) || []).length >= 3,
  'Automatic qualification and admission must require current-release artifact evidence.',
)
expect(
  patching.includes('publishedSha256Present:') &&
    patching.includes('verifiedSigner:') &&
    patching.includes('currentRelease?.publishedSha256Present') &&
    patching.includes('currentRelease?.verifiedSigner'),
  'Qualification lab must distinguish published metadata from observed artifact verification.',
)
expect(
  ui.includes('<small>Expected signer</small>') &&
    ui.includes('<small>Verified signer</small>') &&
    ui.includes('<small>Published SHA-256</small>') &&
    ui.includes('<small>Artifact hash</small>'),
  'Qualification UI must label expected/published evidence separately from verified evidence.',
)
expect(
  vendorIntel.includes("WHEN source_revision IS DISTINCT FROM $4 THEN") &&
    vendorIntel.includes("qualification_version=CASE WHEN source_revision IS DISTINCT FROM $4 THEN '' ELSE qualification_version END") &&
    vendorIntel.includes("qualified_at=CASE WHEN source_revision IS DISTINCT FROM $4 THEN NULL ELSE qualified_at END"),
  'A target-version change must invalidate carried-forward qualification status metadata.',
)
expect(
  enrichment.includes("c.qualification_state IN ('qualified','qualified_limited')") &&
    enrichment.includes("THEN 'deployment_candidate'") &&
    enrichment.includes("endpoint artifact signature/hash inspection is pending"),
  'Qualified states must fall back to deployment candidate while the current artifact is unverified.',
)
expect(
  enrichment.includes("q.state IN ('queued','running','cleanup_pending','cleanup_running')") &&
    enrichment.includes('if (qualificationBusy.rowCount) return []'),
  'Artifact trust probes must yield to active or queued qualification work.',
)
expect(
  qualification.includes('export async function resetStaleQualificationQueuesForCurrentTargets') &&
    qualification.includes("last_error='qualification_target_version_changed'") &&
    qualification.includes("q.state IN ('queued','passed','review_required')"),
  'Stale inactive qualification results must be invalidated once when the target version changes.',
)
expect(
  qualification.includes("'qualification_target_version_changed'") &&
    qualification.includes("c.qualification_evidence->>'cleanInstallVersion'=c.target_version"),
  'Qualification requeue/admission paths must require current-version core install evidence.',
)
expect(
  !enrichment.includes("qualification_evidence->>'upgradeVersion'<>c.target_version") &&
    !enrichment.includes("qualification_evidence->>'rollbackRestoredVersion'<>c.target_version"),
  'Stale optional upgrade/rollback evidence must not demote core deployment qualification.',
)
expect(
  vendorIntel.includes('await resetStaleQualificationQueuesForCurrentTargets({ limit: 100 })') &&
    vendorIntel.indexOf('await resetStaleQualificationQueuesForCurrentTargets({ limit: 100 })')
      < vendorIntel.indexOf('await promoteAutomaticAdmissionReady({ limit: 50 })'),
  'Qualification progression must invalidate stale target-version results before admission.',
)
expect(
  enrichment.includes('Target version changed; current install/verify/uninstall qualification is required.'),
  'Qualified rows with stale core target-version evidence must self-heal back to deployment candidates.',
)

if (failures) process.exit(1)
console.log('Artifact trust scoping contract check passed.')
