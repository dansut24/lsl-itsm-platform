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

walk(sourceRoot)
console.log(`Runtime API migration complete: ${replacements} replacements in ${changedFiles} files.`)
