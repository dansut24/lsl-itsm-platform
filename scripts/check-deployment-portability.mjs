import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const roots = ['src', 'api/src']
const allowedDomainFiles = new Set([
  'src/lib/deploymentConfig.js',
  'api/src/deploymentConfig.js',
])
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx'])
const failures = []

function hasDeploymentDomainDependency(content) {
  // Product/marketing links and demo email addresses may legitimately mention
  // hi5central.com. This guard targets operational coupling: API origins,
  // tenant/Portal/RMM hostname construction and hostname/domain checks.
  const withoutEmails = content.replace(/[a-z0-9._%+-]+@(?:[a-z0-9-]+\.)*hi5central\.com/gi, '')
  return (
    /https?:\/\/api\.hi5central\.com/i.test(withoutEmails)
    || /\$\{[^}]+\}(?:-portal|-rmm)?\.hi5central\.com/i.test(withoutEmails)
    || /https?:\/\/[a-z0-9-]+-(?:portal|rmm)\.hi5central\.com/i.test(withoutEmails)
    || /['"`]\.?hi5central\.com['"`]/i.test(withoutEmails)
    || /(?:endsWith|includes|startsWith|match|test)\([^\n)]*hi5central\.com/i.test(withoutEmails)
  )
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      walk(full)
      continue
    }
    if (!sourceExtensions.has(path.extname(entry.name))) continue

    const relative = path.relative(repoRoot, full).replaceAll(path.sep, '/')
    const content = fs.readFileSync(full, 'utf8')

    if (!allowedDomainFiles.has(relative) && hasDeploymentDomainDependency(content)) {
      failures.push(`${relative}: contains a hard-coded Hi5Central operational domain dependency`)
    }
  }
}

for (const root of roots) walk(path.join(repoRoot, root))

const index = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8')
if (!index.includes('/runtime-config.js')) {
  failures.push('index.html: runtime-config.js must load before the application')
}

const dockerfile = fs.readFileSync(path.join(repoRoot, 'Dockerfile.production'), 'utf8')
if (!dockerfile.includes('hi5-runtime-entrypoint')) {
  failures.push('Dockerfile.production: runtime deployment configuration entrypoint is missing')
}

if (failures.length) {
  console.error('Deployment portability check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Deployment portability check passed.')
