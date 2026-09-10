import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const main = read('src/main.jsx')
const responsive = read('src/production/ProductionResponsiveViewport.css')
const planning = read('src/production/ProductionPlanningSurface.css')
const planningResponsive = read('src/production/ProductionPlanningResponsive.css')
const refinement = read('src/production/ProductionWorkspaceRefinement.css')
const shellV2 = read('src/production/ProductionWorkspaceShellV2.css')
const shellV2Component = read('src/production/ProductionWorkspaceShellV2.jsx')
const floatingGlass = read('src/production/ProductionLiquidGlassWorkspace.css')
const floatingLiveChat = read('src/production/ProductionFloatingLiveChat.jsx')
const projectEntry = read('src/features/projects/ProjectViews.jsx')
const projectsV2 = read('src/features/projects/ProjectWorkspaceV2.jsx')

const failures = []
const expect = (condition, message) => {
  if (!condition) failures.push(message)
}

const responsiveImport = "./production/ProductionResponsiveViewport.css"
const shellV2Import = "./production/ProductionWorkspaceShellV2.css"
const shellV2MobileImport = "./production/ProductionWorkspaceShellV2Mobile.css"
const floatingGlassImport = "./production/ProductionLiquidGlassWorkspace.css"
const planningImport = "./production/ProductionPlanningSurface.css"
const planningResponsiveImport = "./production/ProductionPlanningResponsive.css"
const densityImport = "./production/ProductionWorkspaceDensity.css"

expect(main.includes(responsiveImport), 'ProductionResponsiveViewport.css must be imported by src/main.jsx')
expect(main.includes(shellV2Import), 'ProductionWorkspaceShellV2.css must be imported by src/main.jsx')
expect(main.includes("ProductionWorkspaceShellV2 } from './production/ProductionWorkspaceShellV2.jsx'"), 'Workspace Shell v2 component must be imported by src/main.jsx')
expect(main.includes('<ProductionWorkspaceShellV2 />'), 'Workspace Shell v2 must be mounted in production workspace')
expect(main.includes("ProductionFloatingLiveChat } from './production/ProductionFloatingLiveChat.jsx'"), 'Floating Live Chat component must be imported by src/main.jsx')
expect(main.includes('<ProductionFloatingLiveChat />'), 'Floating Live Chat must be mounted in production workspace')
expect(main.includes(floatingGlassImport), 'ProductionLiquidGlassWorkspace.css must be imported by src/main.jsx')
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
  'ProductionResponsiveViewport.css must load after planning responsive rules',
)
expect(
  main.indexOf(shellV2Import) > main.indexOf(responsiveImport),
  'ProductionWorkspaceShellV2.css must load after the responsive fallback',
)
expect(
  main.indexOf(floatingGlassImport) > main.indexOf(shellV2MobileImport),
  'ProductionLiquidGlassWorkspace.css must remain the final workspace chrome authority',
)

expect(responsive.includes('@media (max-width: 1180px)'), '1180px narrow-workspace breakpoint is missing')
expect(responsive.includes('@media (max-width: 880px)'), '880px page-rail breakpoint is missing')
expect(responsive.includes('@media (max-width: 680px)'), '680px compact-width breakpoint is missing')

expect(
  /\.main-frame\s*\{[\s\S]*?grid-template-rows:\s*48px 34px minmax\(0, 1fr\) !important;/.test(responsive),
  'Responsive fallback must retain the pre-v2 narrow workspace shell contract',
)
expect(
  /\.tabbar\s*\{[\s\S]*?grid-template-rows:\s*48px !important;[\s\S]*?height:\s*48px !important;/.test(responsive),
  'Responsive fallback tabbar must remain a single row',
)
expect(
  /\.chrome-actions\s*\{[\s\S]*?grid-row:\s*1 !important;[\s\S]*?flex-wrap:\s*nowrap !important;/.test(responsive),
  'Workspace command actions must retain their no-wrap fallback contract',
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

// Hi5Central Workspace Shell v2 ------------------------------------------------
expect(
  /html\[data-hi5-surface='workspace'\] \.main-frame\s*\{[\s\S]*?grid-template-rows:\s*44px minmax\(0, 1fr\) !important;/.test(shellV2),
  'Workspace Shell v2 must collapse legacy tab + breadcrumb chrome into one 44px desktop row',
)
expect(
  /html\[data-hi5-surface='workspace'\] \.tabbar\s*\{[\s\S]*?grid-template-rows:\s*44px !important;[\s\S]*?height:\s*44px !important;/.test(shellV2),
  'Workspace Shell v2 command bar must remain one 44px row',
)
expect(
  shellV2.includes(".tabbar-tab-zone,\nhtml[data-hi5-surface='workspace'] .breadcrumbs") && shellV2.includes('display: none !important;'),
  'Legacy browser tabs and the separate breadcrumb row must remain visually retired',
)
expect(
  shellV2.includes('var(--accent-rgb)') && shellV2.includes('var(--accent-ink)'),
  'Workspace Shell v2 must derive emphasis from tenant accent tokens',
)
expect(
  shellV2.includes('@media (max-width: 680px)') && /grid-template-rows:\s*42px minmax\(0, 1fr\) !important;/.test(shellV2),
  'Workspace Shell v2 must provide a compact single-row mobile contract',
)
expect(
  shellV2.includes('.production-open-work-panel') && shellV2.includes('.production-open-work-trigger'),
  'Workspace Shell v2 must retain the Open Work switcher surface',
)
expect(
  shellV2Component.includes("const TAB_SELECTOR = '.tab-list .workspace-tab'"),
  'Workspace Shell v2 must reuse the proven tab engine rather than replacing workspace state',
)
expect(
  shellV2Component.includes('data-hi5-workspace-shell="v2"') && shellV2Component.includes('Open work'),
  'Workspace Shell v2 command bar and Open Work control are missing',
)
expect(
  shellV2Component.includes("invokeLegacyContextAction(tabKey, 'Duplicate')")
    && shellV2Component.includes("invokeLegacyContextAction(source.key, 'Close all tabs')"),
  'Open Work must preserve duplicate and close-all workspace behaviour',
)
expect(
  shellV2Component.includes("proxyClick('.record-create-trigger')")
    && shellV2.includes('.chrome-actions .record-create-trigger'),
  'Workspace Shell v2 must preserve the existing New Record experience',
)
expect(
  shellV2Component.includes("proxyClick('.tabbar-brand')")
    && shellV2.includes('.production-workspace-mobile-nav'),
  'Workspace Shell v2 must preserve mobile navigation access',
)

// Floating glass shell ---------------------------------------------------------
expect(
  floatingGlass.includes("html[data-hi5-surface='workspace'] .sidebar")
    && floatingGlass.includes('border-radius: 24px')
    && floatingGlass.includes('backdrop-filter: blur(28px)'),
  'Primary navigation must retain the curved floating glass treatment',
)
expect(
  floatingGlass.includes('@media (max-width: 1180px)')
    && floatingGlass.includes('translateX(calc(-100% - 24px))')
    && floatingGlass.includes('.sidebar.mobile-open'),
  'Floating navigation must preserve the width-driven off-canvas mobile/tablet contract',
)
expect(
  floatingGlass.includes("grid-template-rows: 56px minmax(0, 1fr) !important")
    && floatingGlass.includes('width: calc(100% - 16px) !important'),
  'Workspace command bar must remain detached from the viewport as a floating surface',
)
expect(
  floatingGlass.includes('var(--accent-rgb)')
    && floatingGlass.includes('.production-floating-live-chat'),
  'Floating workspace surfaces must remain tenant-accent aware',
)
expect(
  floatingGlass.includes('@media (max-width: 680px)')
    && floatingGlass.includes('width: 48px')
    && floatingGlass.includes('safe-area-inset-bottom'),
  'Live Chat dock must compact safely on phones',
)
expect(
  floatingLiveChat.includes('LIVE_CHAT_SELECTOR')
    && floatingLiveChat.includes('.live-chat-tab-notification')
    && floatingLiveChat.includes('tab.click()'),
  'Floating Live Chat must reuse the fixed Live Chat workspace and unread source of truth',
)
expect(
  floatingLiveChat.includes('data-hi5-live-chat-dock="true"')
    && floatingLiveChat.includes('ProductionFloatingLiveChat'),
  'Floating Live Chat dock contract is missing',
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
