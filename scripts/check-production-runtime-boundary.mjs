import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const forbiddenPaths = [
  'src/App.jsx', 'src/services/demoAuth.js', 'src/services/demoStore.js', 'src/data/demoData.jsx', 'src/legacy',
]
const forbiddenText = [
  'demoData', 'demoStore', 'demoAuth', 'authenticateDemoUser', 'CALENDAR_DEMO_TODAY',
  'analyst@hi5central.com', 'employee@hi5central.com', 'rmm@hi5central.com',
  'Hi5Desk!2026', 'Hi5Portal!2026', 'Hi5RMM!2026', 'Dana Sinclair', 'Eleanor Shaw',
]

const failures = []
for (const relativePath of forbiddenPaths) {
  if (fs.existsSync(path.join(root, relativePath))) failures.push(`Forbidden active runtime path: ${relativePath}`)
}

function walk(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

for (const file of walk(path.join(root, 'src'))) {
  if (!/.(js|jsx|mjs|css|html)$/.test(file)) continue
  const relative = path.relative(root, file)
  const content = fs.readFileSync(file, 'utf8')
  for (const token of forbiddenText) {
    if (content.includes(token)) failures.push(`${relative} contains forbidden runtime token: ${token}`)
  }
  if (content.includes('archive/')) failures.push(`${relative} imports archived code`)
}

for (const required of [
  'src/runtime/WorkspaceRuntime.jsx',
  'src/runtime/workspaceConfig.jsx',
  'src/services/runtimeState.js',
  'archive/demo-runtime/src/App.jsx',
  'archive/demo-runtime/src/data/demoData.jsx',
  'archive/demo-runtime/src/services/demoStore.js',
]) {
  if (!fs.existsSync(path.join(root, required))) failures.push(`Missing production/archive boundary file: ${required}`)
}

if (failures.length) {
  console.error('Production runtime boundary check failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Production runtime boundary check passed')
