import fs from 'node:fs'

let failures = 0
function expect(condition, message) {
  if (!condition) {
    console.error('FAIL:', message)
    failures += 1
  }
}

const source = fs.readFileSync('api/src/rmmSoftwareQualification.js', 'utf8')
expect(source.includes('dispatchPrecleanUninstall'), 'Manual qualification must pre-clean an already installed target.')
expect(source.includes('manualRequalification === true'), 'Automatic qualification must not remove preinstalled software.')
expect(source.includes("cleanupPhase: 'preclean'"), 'Qualification pre-clean must have an explicit reconciliation phase.')
expect(source.includes('precleanVerifiedAt'), 'Qualification must verify target absence before beginning the clean install.')
expect(source.includes('qualification_preclean_residue_detected'), 'Qualification pre-clean must fail safely if the target remains installed.')
expect(source.includes('qualification_preclean_reboot_required'), 'Qualification pre-clean must preserve reboot-required failures instead of collapsing them to failed.')
expect(source.includes('uninstallReason: cleanupReason'), 'Qualification pre-clean must preserve the Agent uninstall reason in evidence.')
expect(source.includes('catalogue_qualification_preclean'), 'Qualification pre-clean jobs must be auditable separately from normal cleanup.')
expect(source.includes("installerTechnology: 'office_odt_sfx'"), 'Microsoft 365 qualification uninstall must use the Office Deployment Tool transport.')
expect(source.includes("intent: 'uninstall'"), 'Office Click-to-Run qualification cleanup must declare uninstall intent.')
expect(source.includes('expectAbsent: true'), 'Office Click-to-Run uninstall must verify product absence.')
expect(source.includes('officeClickToRunUninstall'), 'Qualification must gate Office uninstall on PatchHost capability.')

if (failures) process.exit(1)
console.log('Qualification pre-clean contract check passed.')
