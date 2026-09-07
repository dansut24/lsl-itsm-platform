import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(repoRoot, 'src')
const extensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx'])
let changedFiles = 0
let replacements = 0

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      walk(full)
      continue
    }
    if (!extensions.has(path.extname(entry.name))) continue

    const original = fs.readFileSync(full, 'utf8')
    let content = original

    content = content.replace(/(['"])https:\/\/api\.hi5central\.com\1/g, () => {
      replacements += 1
      return 'window.__HI5_API_BASE__'
    })

    if (content !== original) {
      fs.writeFileSync(full, content)
      changedFiles += 1
      console.log(`migrated ${path.relative(repoRoot, full)}`)
    }
  }
}

function wireLicensing() {
  const indexPath = path.join(repoRoot, 'api/src/index.js')
  const original = fs.readFileSync(indexPath, 'utf8')
  let content = original

  if (!content.includes("from './licensing.js'")) {
    content = content.replace(
      "import { registerCatalogueRoutes } from './catalogue.js'",
      "import { registerCatalogueRoutes } from './catalogue.js'\nimport { registerLicensingRoutes } from './licensing.js'",
    )
  }

  if (!content.includes('registerLicensingRoutes(app)')) {
    content = content.replace(
      'registerCatalogueRoutes(app)',
      'registerLicensingRoutes(app)\nregisterCatalogueRoutes(app)',
    )
  }

  if (content !== original) {
    fs.writeFileSync(indexPath, content)
    changedFiles += 1
    console.log('wired api/src/index.js licensing routes')
  }
}

walk(sourceRoot)
wireLicensing()
console.log(`Runtime API migration complete: ${replacements} API-origin replacements across ${changedFiles} changed files.`)
