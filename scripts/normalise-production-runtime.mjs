import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function file(relativePath) {
  return path.join(root, relativePath)
}

function update(relativePath, transform) {
  const target = file(relativePath)
  if (!fs.existsSync(target)) return
  const current = fs.readFileSync(target, 'utf8')
  const next = transform(current)
  if (next !== current) fs.writeFileSync(target, next)
}

function replaceAll(value, pairs) {
  return pairs.reduce((working, [from, to]) => working.split(from).join(to), value)
}

update('src/features/knowledge/KnowledgeContextEnhancer.jsx', (value) =>
  value.replace("from '../../data/demoData.jsx'", "from '../../runtime/workspaceConfig.jsx'"))

update('src/features/people/OrganisationSitesEnhancer.jsx', (value) =>
  value.replace("from '../../services/demoStore.js'", "from '../../services/runtimeState.js'"))

update('src/production/ProductionFirstLoginExperience.jsx', (value) =>
  value.replace("from '../services/demoStore.js'", "from '../services/runtimeState.js'"))

update('src/production/ProductionUniversalPeekV2.jsx', (value) =>
  value.replace("from '../data/demoData.jsx'", "from '../runtime/workspaceConfig.jsx'"))

update('src/lib/workspace.js', (value) =>
  value.replace("from '../data/demoData.jsx'", "from '../runtime/workspaceConfig.jsx'"))

update('src/services/productionServiceRequests.js', (value) => {
  let next = value.replace("import { seedTickets } from '../data/demoData.jsx'\n\n", '')
  next = next.replace('const base = Array.isArray(stored) ? stored : seedTickets', 'const base = Array.isArray(stored) ? stored : []')
  next = next.replace("const stored = readJson(TICKETS_KEY, seedTickets)", "const stored = readJson(TICKETS_KEY, [])")
  next = next.replace('const base = Array.isArray(stored) ? stored : seedTickets', 'const base = Array.isArray(stored) ? stored : []')
  return next
})

for (const relativePath of [
  'src/features/projects/ProjectWorkspaceV2.jsx',
  'src/features/workspace/UnifiedRecordDetailView.jsx',
  'src/features/workspace/WorkspaceViews.jsx',
  'src/lib/lifecycle.js',
]) {
  update(relativePath, (value) => replaceAll(value, [
    ['Dana Sinclair', 'Hi5Central User'],
    ['Eleanor Shaw', 'Requester'],
  ]))
}

// No active source file may retain a demo-named import after extraction.
const importRewrites = [
  ["../services/demoStore.js", "../services/runtimeState.js"],
  ["../../services/demoStore.js", "../../services/runtimeState.js"],
  ["./services/demoStore.js", "../services/runtimeState.js"],
  ["../data/demoData.jsx", "../runtime/workspaceConfig.jsx"],
  ["../../data/demoData.jsx", "../../runtime/workspaceConfig.jsx"],
]

function walk(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

for (const target of walk(file('src'))) {
  if (!/\.(js|jsx|mjs)$/.test(target)) continue
  const current = fs.readFileSync(target, 'utf8')
  let next = replaceAll(current, importRewrites)
  next = next.split('Dana Sinclair').join('Hi5Central User')
  if (next !== current) fs.writeFileSync(target, next)
}

console.log('Active runtime demo references normalised.')
