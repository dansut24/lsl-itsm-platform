import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apiRoot = path.join(repoRoot, 'api/src')
let changed = 0
let genericGuards = 0
let wrapperGuards = 0
let portalGuards = 0

function ensureImport(content, names) {
  const importPath = './deploymentConfig.js'
  const existing = content.match(/import \{([^}]+)\} from '\.\/deploymentConfig\.js'/)
  if (existing) {
    const current = existing[1].split(',').map((value) => value.trim()).filter(Boolean)
    const merged = [...new Set([...current, ...names])]
    return content.replace(existing[0], `import { ${merged.join(', ')} } from '${importPath}'`)
  }

  const importLines = [...content.matchAll(/^import .*$/gm)]
  if (!importLines.length) return `import { ${names.join(', ')} } from '${importPath}'\n${content}`
  const last = importLines.at(-1)
  const insertAt = last.index + last[0].length
  return `${content.slice(0, insertAt)}\nimport { ${names.join(', ')} } from '${importPath}'${content.slice(insertAt)}`
}

const genericPattern = /function originMatchesSession\(c, session\) \{\n\s*const origin = c\.req\.header\('origin'\)\n\s*if \(!origin\) return true\n\s*return new Set\(\[\n\s*`https:\/\/\$\{session\.slug\}\.hi5central\.com`,\n\s*`https:\/\/\$\{session\.slug\}-portal\.hi5central\.com`,\n\s*`https:\/\/\$\{session\.slug\}-rmm\.hi5central\.com`,\n\s*\]\)\.has\(origin\.toLowerCase\(\)\)\n\}/g

const genericReplacement = `function originMatchesSession(c, session) {\n  return originMatchesTenant(c.req.header('origin'), session.slug)\n}`

const wrapperPattern = /function originMatchesTenant\(c, slug\) \{\n\s*const origin = c\.req\.header\('origin'\)\n\s*if \(!origin\) return true\n\s*return new Set\(\[\n\s*`https:\/\/\$\{slug\}\.hi5central\.com`,\n\s*`https:\/\/\$\{slug\}-portal\.hi5central\.com`,\n\s*`https:\/\/\$\{slug\}-rmm\.hi5central\.com`,\n\s*\]\)\.has\(origin\.toLowerCase\(\)\)\n\}/g

const wrapperReplacement = `function originMatchesTenant(c, slug) {\n  return deploymentOriginMatchesTenant(c.req.header('origin'), slug)\n}`

const portalPattern = /function portalOrigin\(c, slug\) \{\n\s*const origin = String\(c\.req\.header\('origin'\) \|\| ''\)\.toLowerCase\(\)\n\s*if \(!origin\) return true\n\s*return origin === `https:\/\/\$\{slug\}-portal\.hi5central\.com`\n\}/g

const portalReplacement = `function portalOrigin(c, slug) {\n  return originMatchesPortalTenant(\n    c.req.header('origin'),\n    c.req.header('referer'),\n    slug,\n  )\n}`

for (const entry of fs.readdirSync(apiRoot, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.js')) continue
  const full = path.join(apiRoot, entry.name)
  const original = fs.readFileSync(full, 'utf8')
  let content = original

  let genericCount = 0
  content = content.replace(genericPattern, () => {
    genericCount += 1
    genericGuards += 1
    return genericReplacement
  })
  if (genericCount) content = ensureImport(content, ['originMatchesTenant'])

  let wrapperCount = 0
  content = content.replace(wrapperPattern, () => {
    wrapperCount += 1
    wrapperGuards += 1
    return wrapperReplacement
  })
  if (wrapperCount) content = ensureImport(content, ['originMatchesTenant as deploymentOriginMatchesTenant'])

  let portalCount = 0
  content = content.replace(portalPattern, () => {
    portalCount += 1
    portalGuards += 1
    return portalReplacement
  })
  if (portalCount) content = ensureImport(content, ['originMatchesPortalTenant'])

  if (content !== original) {
    fs.writeFileSync(full, content)
    changed += 1
    console.log(`migrated ${path.relative(repoRoot, full)} (${genericCount} generic, ${wrapperCount} wrappers, ${portalCount} portal)`)
  }
}

console.log(`API origin migration complete: ${genericGuards} generic guards, ${wrapperGuards} wrappers and ${portalGuards} Portal guards across ${changed} files.`)

if (!genericGuards && !wrapperGuards && !portalGuards) {
  console.log('No legacy API origin guards remained.')
}
