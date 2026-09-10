import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const main = read('src/main.jsx')
const responsive = read('src/production/ProductionResponsiveViewport.css')
const planning = read('src/production/ProductionPlanningSurface.css')
const planningResponsive = read('src/production/ProductionPlanningResponsive.css')
const refinement = read('src/production/ProductionWorkspaceRefinement.css')
const shell = read('src/production/ProductionWorkspaceShellV2.css')
const shellMobile = read('src/production/ProductionWorkspaceShellV2Mobile.css')
const shellComponent = read('src/production/ProductionWorkspaceShellV2.jsx')
const glass = read('src/production/ProductionLiquidGlassWorkspace.css')
const projectEntry = read('src/features/projects/ProjectViews.jsx')
const projectsV2 = read('src/features/projects/ProjectWorkspaceV2.jsx')

const failures = []
const expect = (condition, message) => {
  if (!condition) failures.push(message)
}

const responsiveImport = "./production/ProductionResponsiveViewport.css"
const shellImport = "./production/ProductionWorkspaceShellV2.css"
const shellMobileImport = "./production/ProductionWorkspaceShellV2Mobile.css"
const glassImport = "./production/ProductionLiquidGlassWorkspace.css"
const planningImport = "./production/ProductionPlanningSurface.css"
const planningResponsiveImport = "./production/ProductionPlanningResponsive.css"
const densityImport = "./production/ProductionWorkspaceDensity.css"

expect(main.includes(responsiveImport), 'ProductionResponsiveViewport.css must be imported')
expect(main.includes(shellImport), 'Workspace shell CSS must be imported')
expect(main.includes(shellMobileImport), 'Workspace shell mobile CSS must be imported')
expect(main.includes(glassImport), 'Floating glass navigation CSS must be imported')
expect(main.includes("ProductionWorkspaceShellV2 } from './production/ProductionWorkspaceShellV2.jsx'"), 'Workspace shell component must be imported')
expect(main.includes('<ProductionWorkspaceShellV2 />'), 'Workspace shell component must remain mounted')
expect(!main.includes('ProductionFloatingLiveChat'), 'Floating Live Chat bubble must remain retired')

expect(main.indexOf(planningImport) > main.indexOf(densityImport), 'Planning surface must load after density rules')
expect(main.indexOf(planningResponsiveImport) > main.indexOf(planningImport), 'Planning responsive rules must load after planning surface')
expect(main.indexOf(responsiveImport) > main.indexOf(planningResponsiveImport), 'Global responsive contract must load after planning rules')
expect(main.indexOf(shellImport) > main.indexOf(responsiveImport), 'Workspace shell must load after responsive fallback')
expect(main.indexOf(shellMobileImport) > main.indexOf(shellImport), 'Mobile shell completion must load after workspace shell')
expect(main.indexOf(glassImport) > main.indexOf(shellMobileImport), 'Floating glass navigation must load last')

// Base responsive fallback ----------------------------------------------------
expect(responsive.includes('@media (max-width: 1180px)'), '1180px narrow-workspace breakpoint is missing')
expect(responsive.includes('@media (max-width: 880px)'), '880px page-rail breakpoint is missing')
expect(responsive.includes('@media (max-width: 680px)'), '680px compact-width breakpoint is missing')
expect(/\.sidebar,[\s\S]*?\.sidebar-collapsed \.sidebar\s*\{[\s\S]*?position:\s*fixed !important;/.test(responsive), 'Responsive fallback must retain fixed off-canvas navigation')
expect(/\.workspace > \*,[\s\S]*?\.content-frame > \*\s*\{[\s\S]*?min-width:\s*0;/.test(responsive), 'Workspace children must remain shrink-safe')
expect(refinement.includes('position: fixed;'), 'Mobile sidebar fixed-position safeguard must remain')

// Workspace Shell v3 ---------------------------------------------------------
expect(shellComponent.includes("const TAB_SELECTOR = '.tab-list .workspace-tab'"), 'Visible tabs must reuse the proven hidden tab engine')
expect(shellComponent.includes('data-hi5-workspace-shell="v3"'), 'Workspace Shell v3 marker is missing')
expect(shellComponent.includes('visibleTabs.map((tab)'), 'Visible workspace tab rendering is missing')
expect(shellComponent.includes("tab.key === 'livechat' || tab.module === 'livechat'"), 'Live Chat must receive a permanent visible tab treatment')
expect(shellComponent.includes('production-workspace-tab-unread'), 'Live Chat/workspace unread badge is missing')
expect(shellComponent.includes("invokeLegacyContextAction(active.key, 'Duplicate tab')"), 'Duplicate-current behaviour must be preserved')
expect(shellComponent.includes("invokeLegacyContextAction(active.key, 'Close all tabs')"), 'Close-all behaviour must be preserved')
expect(shellComponent.includes("proxyClick('.record-create-trigger')"), 'New Record experience must remain wired')
expect(shellComponent.includes("proxyClick('.tabbar-brand')"), 'Mobile navigation trigger must remain wired')

expect(shell.includes('.production-workspace-tabdock'), 'Floating workspace tab dock styles are missing')
expect(shell.includes('.production-workspace-tabs') && shell.includes('overflow-x: auto'), 'Workspace tabs must scroll locally instead of squeezing')
expect(shell.includes('.production-workspace-tab.is-livechat'), 'Live Chat visible tab styling is missing')
expect(shell.includes('var(--accent-rgb)') && shell.includes('var(--accent-ink)'), 'Workspace tabs/actions must remain accent-aware')
expect(shell.includes('@media (max-width: 680px)'), 'Workspace Shell v3 mobile breakpoint is missing')
expect(shellMobile.includes('grid-template-columns: 30px minmax(0, 1fr) auto'), 'Mobile tab dock must reserve flexible width for tabs')
expect(shellMobile.includes('min-width: max-content'), 'Mobile fixed actions must not be squeezed or wrapped')

// Floating navigation --------------------------------------------------------
expect(glass.includes('backdrop-filter: blur(28px)'), 'Floating navigation glass treatment is missing')
expect(glass.includes('border-radius: 24px'), 'Floating navigation must remain curved')
expect(glass.includes('@media (max-width: 1180px)'), 'Floating navigation narrow-screen contract is missing')
expect(/height:\s*calc\(100dvh - 16px\) !important;/.test(glass), 'Mobile/tablet floating navigation must retain real viewport height')
expect(/\.sidebar\.mobile-open,[\s\S]*?transform:\s*translateX\(0\) !important;/.test(glass), 'Mobile floating navigation must have an explicit open transform')
expect(/\.nav-stack,[\s\S]*?min-height:\s*0 !important;[\s\S]*?overflow-y:\s*auto !important;/.test(glass), 'Mobile navigation list must remain scrollable and non-collapsing')
expect(glass.includes('.mobile-nav-backdrop') && glass.includes('backdrop-filter: blur(12px)'), 'Mobile navigation backdrop must retain glass treatment')

// Planning surfaces ----------------------------------------------------------
expect(/\.calendar-toolbar\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*nowrap;/.test(planning), 'Calendar toolbar must stay on one row')
expect(planningResponsive.includes('@media (max-width: 980px)') && planningResponsive.includes('@media (max-width: 720px)'), 'Calendar responsive behaviour must remain viewport-driven')
expect(planningResponsive.includes('.calendar-filter-bar.mobile-open'), 'Calendar compact filter surface is missing')
expect(/\.cmdb-view \.asset-grid\s*\{[\s\S]*?repeat\(auto-fit,\s*minmax/.test(planning), 'CMDB asset grid must adapt to width')
expect(/\.cmdb-view \.queue-table\s*\{[\s\S]*?overflow-x:\s*auto;/.test(planning), 'CMDB linked-record overflow must remain local')
expect(/\.project-detail-tabs\s*\{[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?overflow-x:\s*auto;/.test(planning), 'Project detail tabs must stay single-row and locally scrollable')
expect(projectEntry.includes('ProjectWorkspaceV2.jsx'), 'Projects v2 routing must remain active')
for (const section of ['overview', 'list', 'board', 'timeline', 'milestones', 'workload', 'risks', 'team', 'activity']) {
  expect(projectsV2.includes(`id: '${section}'`), `Projects v2 is missing the ${section} view`)
}
expect(projectsV2.includes('dependsOn') && projectsV2.includes('linkedRecord'), 'Project dependency and ITSM linkage fields must remain')

if (failures.length) {
  console.error('Responsive contract check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Responsive contract check passed.')
