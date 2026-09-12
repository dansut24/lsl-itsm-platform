import fs from 'node:fs'

const path = 'api/src/portalAuth.js'
let text = fs.readFileSync(path, 'utf8')
const before = "error: 'This account does not currently have requester Portal access or any assigned approvals.',"
const after = "error: 'This account does not have access to the requester portal and has no approvals assigned to it.',"
if (!text.includes(before)) throw new Error('Portal denial copy anchor was not found.')
text = text.replace(before, after)
fs.writeFileSync(path, text)
console.log('Portal approval denial copy updated.')
