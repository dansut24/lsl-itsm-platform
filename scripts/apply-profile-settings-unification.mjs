import fs from 'node:fs'

const path = 'src/runtime/WorkspaceRuntime.jsx'
let content = fs.readFileSync(path, 'utf8')
const anchor = "    if (activeView === 'reports') {\n      return <ReportsView metrics={metrics} tickets={tickets} />\n    }\n\n    return null\n"
const replacement = "    if (activeView === 'reports') {\n      return <ReportsView metrics={metrics} tickets={tickets} />\n    }\n\n    // Tenant Settings and personal Profile are production-owned surfaces.\n    // Their components are mounted by ProductionWorkspaceBootstrap so this\n    // runtime must never fall back to an older workspace implementation.\n    if (activeView === 'settings' || activeView === 'profile') return null\n\n    return null\n"

if (!content.includes(anchor)) {
  if (content.includes("if (activeView === 'settings' || activeView === 'profile') return null")) {
    console.log('Workspace runtime is already finalised.')
    process.exit(0)
  }
  throw new Error('Could not locate the WorkspaceRuntime production-surface fallback.')
}

content = content.replace(anchor, replacement)
fs.writeFileSync(path, content)
console.log('Finalised production-owned Settings/Profile surfaces.')
