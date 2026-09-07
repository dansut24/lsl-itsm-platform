import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const main = read('src/main.jsx')
const responsive = read('src/production/ProductionResponsiveViewport.css')
const planning = read('src/production/ProductionPlanningSurface.css')
const planningResponsive = read('src/production/ProductionPlanningResponsive.css')
const refinement = read('src/production/ProductionWorkspaceRefinement.css')
const projectEntry = read('src/features/projects/ProjectViews.jsx')
const projectsV2 = read('src/features/projects/ProjectWorkspaceV2.jsx')

const failures = []
const expect = (condition, message) => {
  if (!condition) failures.push(message)
}

const responsiveImport = "./production/ProductionResponsiveViewport.css"
const planningImport = "./production/ProductionPlanningSurface.css"
const planningResponsiveImport = "./production/ProductionPlanningResponsive.css"
const densityImport = "./production/ProductionWorkspaceDensity.css"

expect(main.includes(responsiveImport), 'ProductionResponsiveViewport.css must be imported by src/main.jsx')
expect(main.includes(planningImport), 'ProductionPlanningSurface.css must be imported by src/main.jsx')
expect(main.includes(planningResponsiveImport), 'ProductionPlanningResponsive.css must be imported by src/main.jsx')
expect(
  main.indexOf(planningImport) > main.indexOf(densityImport),
  'ProductionPlanningSurface.css must load after ProductionWorkspaceDensity.css',
)
expect(
  main.indexOf(planningResponsiveImport) > main.indexOf(planningImport),
  'ProductionPlanningResponsive.css must load after the planning surface contract',
)
expect(
  main.indexOf(responsiveImport) > main.indexOf(planningResponsiveImport),
  'ProductionResponsiveViewport.css must remain the final workspace layout authority',
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

expect(
  /\.calendar-toolbar\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*nowrap;/.test(planning),
  'Calendar toolbar must stay on one row',
)
expect(
  planningResponsive.includes('@media (max-width: 980px)') && planningResponsive.includes('@media (max-width: 720px)'),
  'Calendar responsive behaviour must be viewport-driven',
)
expect(
  /\.calendar-view\s*\{[\s\S]*?position:\s*relative;/.test(planningResponsive),
  'Calendar compact overlays must be anchored to the Calendar surface',
)
expect(
  planningResponsive.includes('.calendar-filter-bar.mobile-open'),
  'Calendar must provide a compact filter surface instead of squeezing filters',
)
expect(
  /\.cmdb-view \.asset-grid\s*\{[\s\S]*?repeat\(auto-fit,\s*minmax/.test(planning),
  'CMDB asset grid must adapt to available width',
)
expect(
  /\.cmdb-view \.queue-table\s*\{[\s\S]*?overflow-x:\s*auto;/.test(planning),
  'CMDB linked-record overflow must remain local to its table surface',
)
expect(
  /\.project-detail-tabs\s*\{[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?overflow-x:\s*auto;/.test(planning),
  'Project view tabs must never wrap and must scroll locally',
)
expect(
  planning.includes('.project-timeline-shell') && planning.includes('.project-workload-grid'),
  'Projects must retain responsive Timeline and Workload surfaces',
)
expect(
  projectEntry.includes("ProjectWorkspaceV2.jsx"),
  'ProjectViews.jsx must route the workspace to Projects v2',
)
for (const section of ['overview', 'list', 'board', 'timeline', 'milestones', 'workload', 'risks', 'team', 'activity']) {
  expect(projectsV2.includes(`id: '${section}'`), `Projects v2 is missing the ${section} view`)
}
expect(projectsV2.includes('dependsOn') && projectsV2.includes('linkedRecord'), 'Project tasks must retain dependency and ITSM linkage fields')

if (failures.length) {
  console.error('Responsive contract check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Responsive contract check passed.')
