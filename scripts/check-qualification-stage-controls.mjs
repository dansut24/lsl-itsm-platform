import fs from 'node:fs'

let failures = 0
function expect(condition, message) {
  if (condition) return
  failures += 1
  console.error('FAIL:', message)
}

const qualification = fs.readFileSync('api/src/rmmSoftwareQualification.js', 'utf8')
const vendorIntel = fs.readFileSync('api/src/rmmSoftwareVendorIntel.js', 'utf8')

expect(
  qualification.includes('RMM_QUALIFICATION_${clean(stage).toUpperCase()}_ENABLED') &&
    qualification.includes("const upgradeEnabled = qualificationStageEnabled('upgrade')") &&
    qualification.includes("const rollbackEnabled = qualificationStageEnabled('rollback')") &&
    qualification.includes('$1::boolean') &&
    qualification.includes('$2::boolean'),
  'Qualification dispatcher must gate upgrade/rollback stages with runtime flags.',
)

expect(
  vendorIntel.includes('RMM_QUALIFICATION_${clean(stage).toUpperCase()}_ENABLED') &&
    vendorIntel.includes("if (rollbackEnabled) await queueAutomaticRollbackQualifications") &&
    vendorIntel.includes("if (upgradeEnabled) await queueAutomaticUpgradeQualifications") &&
    vendorIntel.includes("...(upgradeEnabled ? ['upgrade'] : [])") &&
    vendorIntel.includes("...(rollbackEnabled ? ['rollback'] : [])"),
  'Qualification progression must skip disabled upgrade/rollback stages and their backlog.',
)

if (failures) process.exit(1)
console.log('Qualification stage controls contract check passed.')
