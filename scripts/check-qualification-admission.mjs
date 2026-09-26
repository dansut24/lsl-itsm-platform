import fs from 'node:fs'

let failures = 0
function expect(condition, message) {
  if (condition) return
  failures += 1
  console.error('FAIL:', message)
}

const qualification = fs.readFileSync('api/src/rmmSoftwareQualification.js', 'utf8')
const patching = fs.readFileSync('api/src/rmmPatching.js', 'utf8')

expect(
  qualification.includes("c.source_metadata->'vulnerabilityIdentityAudit'->>'state'='no_published_identity'"),
  'Automatic admission must retain explicit no-published-identity handling.',
)
expect(
  qualification.includes("c.source_metadata->'vulnerabilityIdentityAudit'->>'state'='needs_review'"),
  'Automatic admission must recognize clean unresolved vulnerability identities.',
)
expect(
  qualification.includes("COALESCE(c.source_metadata->'vulnerabilityIdentityAudit'->>'error','')=''"),
  'Unresolved identity limitation must require an error-free audit.',
)
expect(
  qualification.includes("<>'transient_identity_source_error'"),
  'Transient vulnerability-source failures must not be treated as a qualification limitation.',
)
expect(
  qualification.includes("WHEN vulnerability_limited THEN 'identity_unresolved'"),
  'Automatic qualification evidence must distinguish unresolved identities.',
)
expect(
  qualification.includes('NVD/CVE/EPSS coverage remains limited until identity resolution succeeds.'),
  'Automatic limitation evidence must describe vulnerability coverage impact.',
)
expect(
  patching.includes('function vulnerabilityIdentityLimited(value)'),
  'RMM qualification UI/readiness must share the unresolved-identity limitation rule.',
)
expect(
  patching.includes("vulnerabilityLimited?'limited':'attention'"),
  'Qualification lab must render unresolved vulnerability identity as limited rather than attention.',
)
expect(
  qualification.includes("WHEN clean_queue_passed THEN 'qualified'"),
  'Current-version clean install/verify/uninstall must be sufficient for automatic deployment qualification.',
)
expect(
  qualification.includes("Automatically admitted after trusted current artifact, current-version install verification, and verified uninstall/cleanup."),
  'Automatic qualification notes must describe the core deployment qualification model.',
)
expect(
  !qualification.includes("AND upgrade_passed\n                 AND rollback_passed"),
  'Upgrade and rollback must not gate automatic deployment qualification.',
)
expect(
  patching.includes("const automaticAdmissionReady = Boolean(\n      sourceHealthy\n      && artifactVerified\n      && installTestPassed\n      && uninstallTestPassed,"),
  'Qualification readiness must use the same current-version install/verify/uninstall admission model.',
)
expect(
  !patching.includes("&& upgradeTestPassed\n      && rollbackTestPassed\n      && vulnerabilityCovered"),
  'Lifecycle and vulnerability coverage must not gate deployment qualification readiness.',
)

if (failures) process.exit(1)
console.log('Qualification admission contract check passed.')
