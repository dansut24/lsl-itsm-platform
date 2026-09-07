import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const sourceRef = '4592ac1fe7a27ca82a8bc9bd925d39ec07723da1'
const path = 'api/src/mfa.js'

let content = execFileSync('git', ['show', `${sourceRef}:${path}`], { encoding: 'utf8' })

const broken = "import {\nimport { originMatchesTenant as deploymentOriginMatchesTenant } from './deploymentConfig.js'\n  mfaGraceEndsAt,"
const repaired = "import { originMatchesTenant as deploymentOriginMatchesTenant } from './deploymentConfig.js'\nimport {\n  mfaGraceEndsAt,"

if (!content.includes(broken)) {
  throw new Error('Expected malformed MFA import was not found in source snapshot.')
}

content = content.replace(broken, repaired)
fs.writeFileSync(path, content)
console.log('Restored exact MFA module and repaired deployment-aware import.')
