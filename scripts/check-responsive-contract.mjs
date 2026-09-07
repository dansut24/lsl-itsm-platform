import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const main = read('src/main.jsx')
const responsive = read('src/production/ProductionResponsiveViewport.css')
const refinement = read('src/production/ProductionWorkspaceRefinement.css')

const failures = []
const expect = (condition, message) => {
  if (!condition) failures.push(message)
}

const responsiveImport = "./production/ProductionResponsiveViewport.css"
const densityImport = "./production/ProductionWorkspaceDensity.css"

expect(main.includes(responsiveImport), 'ProductionResponsiveViewport.css must be imported by src/main.jsx')
expect(
  main.indexOf(responsiveImport) > main.indexOf(densityImport),
  'ProductionResponsiveViewport.css must load after ProductionWorkspaceDensity.css',
)

expect(responsive.includes('@media (max-width: 1180px)'), '1180px narrow-workspace breakpoint is missing')
expect(responsive.includes('@media (max-width: 880px)'), '880px page-rail breakpoint is missing')
expect(responsive.includes('@media (max-width: 680px)'), '680px compact-width breakpoint is missing')

expect(
  /\.main-frame\s*\{[\s\S]*?grid-template-rows:\s*48px 34px minmax\(0, 1fr\) !important;/.test(responsive),
  'Narrow workspace must reserve exactly one tabbar row',
)
expect(
  /\.tabbar\s*\{[\s\S]*?grid-template-rows:\s*48px !important;[\s\S]*?height:\s*48px !important;/.test(responsive),
  'Narrow workspace tabbar must remain a single 48px row',
)
expect(
  /\.chrome-actions\s*\{[\s\S]*?grid-row:\s*1 !important;[\s\S]*?flex-wrap:\s*nowrap !important;/.test(responsive),
  'Workspace command actions must remain on tabbar row 1 and never wrap',
)
expect(
  /\.sidebar,[\s\S]*?\.sidebar-collapsed \.sidebar\s*\{[\s\S]*?position:\s*fixed !important;/.test(responsive),
  'Narrow workspace primary navigation must use the fixed off-canvas contract',
)
expect(
  /\.production-settings-sidebar,[\s\S]*?display:\s*none !important;/.test(responsive),
  'Settings rail must yield at the narrow page-rail breakpoint',
)
expect(
  /\.workspace > \*,[\s\S]*?\.content-frame > \*\s*\{[\s\S]*?min-width:\s*0;/.test(responsive),
  'Common workspace children must be shrink-safe',
)
expect(
  refinement.includes('position: fixed;'),
  'Workspace refinement must preserve the fixed mobile sidebar safeguard',
)

if (failures.length) {
  console.error('Responsive contract check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Responsive contract check passed.')
