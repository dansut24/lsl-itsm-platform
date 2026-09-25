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
expect(source.includes('catalogue_qualification_preclean'), 'Qualification pre-clean jobs must be auditable separately from normal cleanup.')

if (failures) process.exit(1)
console.log('Qualification pre-clean contract check passed.')
