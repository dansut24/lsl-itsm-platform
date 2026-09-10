import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const main = read('src/main.jsx')
const responsive = read('src/production/ProductionResponsiveViewport.css')
const planning = read('src/production/ProductionPlanningSurface.css')
const planningResponsive = read('src/production/ProductionPlanningResponsive.css')
const refinement = read('src/production/ProductionWorkspaceRefinement.css')
const shell = read('src/production/ProductionWorkspaceShellV2.css')
const shellComponent = read('src/production/ProductionWorkspaceShellV2.jsx')
const glass = read('src/production/ProductionLiquidGlassWorkspace.css')
const corrections = read('src/production/ProductionShellV3Corrections.css')
const tabBehaviour = read('src/production/ProductionWorkspaceTabBehaviour.css')
const sharedRecordMasthead = read('src/production/ProductionSharedRecordMasthead.css')
const dockingPreferences = read('src/production/ProductionNavigationDockPreferences.jsx')
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
const correctionsImport = "./production/ProductionShellV3Corrections.css"
const tabBehaviourImport = "./production/ProductionWorkspaceTabBehaviour.css"
const sharedRecordMastheadImport = "./production/ProductionSharedRecordMasthead.css"
const planningImport = "./production/ProductionPlanningSurface.css"
const planningResponsiveImport = "./production/ProductionPlanningResponsive.css"
const densityImport = "./production/ProductionWorkspaceDensity.css"

expect(main.includes(responsiveImport), 'ProductionResponsiveViewport.css must be imported')
expect(main.includes(shellImport), 'Workspace shell CSS must be imported')
expect(main.includes(shellMobileImport), 'Workspace shell mobile CSS must be imported')
expect(main.includes(glassImport), 'Floating glass navigation CSS must be imported')
expect(main.includes(correctionsImport), 'Workspace Shell v3 corrections must be imported')
expect(main.includes(tabBehaviourImport), 'Workspace tab behaviour contract must be imported')
expect(main.includes(sharedRecordMastheadImport), 'Shared record masthead refinement must be imported')
expect(main.includes("ProductionWorkspaceShellV2 } from './production/ProductionWorkspaceShellV2.jsx'"), 'Workspace shell component must be imported')
expect(main.includes('<ProductionWorkspaceShellV2 />'), 'Workspace shell component must remain mounted')
expect(main.includes("ProductionNavigationDockPreferences } from './production/ProductionNavigationDockPreferences.jsx'"), 'Navigation docking preferences must be imported')
expect(main.includes('<ProductionNavigationDockPreferences />'), 'Navigation docking preferences must be mounted')
expect(!main.includes('ProductionFloatingLiveChat'), 'Floating Live Chat bubble must remain retired')

expect(main.indexOf(planningImport) > main.indexOf(densityImport), 'Planning surface must load after density rules')
expect(main.indexOf(planningResponsiveImport) > main.indexOf(planningImport), 'Planning responsive rules must load after planning surface')
expect(main.indexOf(responsiveImport) > main.indexOf(planningResponsiveImport), 'Global responsive contract must load after planning rules')
expect(main.indexOf(shellImport) > main.indexOf(responsiveImport), 'Workspace shell must load after responsive fallback')
expect(main.indexOf(shellMobileImport) > main.indexOf(shellImport), 'Mobile shell completion must load after workspace shell')
expect(main.indexOf(glassImport) > main.indexOf(shellMobileImport), 'Floating navigation must load after shell/mobile rules')
expect(main.indexOf(correctionsImport) > main.indexOf(glassImport), 'Workspace Shell v3 corrections must load after floating navigation')
expect(main.indexOf(tabBehaviourImport) > main.indexOf(correctionsImport), 'Workspace tab behaviour must load after Shell v3 corrections')
expect(main.indexOf(sharedRecordMastheadImport) > main.indexOf(tabBehaviourImport), 'Shared record masthead must remain the final record-density authority')

// Base responsive fallback ----------------------------------------------------
expect(responsive.includes('@media (max-width: 1180px)'), '1180px narrow-workspace breakpoint is missing')
expect(responsive.includes('@media (max-width: 880px)'), '880px page-rail breakpoint is missing')
expect(responsive.includes('@media (max-width: 680px)'), '680px compact-width breakpoint is missing')
expect(/\.sidebar,[\s\S]*?\.sidebar-collapsed \.sidebar\s*\{[\s\S]*?position:\s*fixed !important;/.test(responsive), 'Responsive fallback must retain fixed off-canvas navigation')
expect(/\.workspace > \*,[\s\S]*?\.content-frame > \*\s*\{[\s\S]*?min-width:\s*0;/.test(responsive), 'Workspace children must remain shrink-safe')
expect(refinement.includes('position: fixed;'), 'Mobile sidebar fixed-position safeguard must remain')

// Visible workspace tabs -----------------------------------------------------
expect(shellComponent.includes("const TAB_SELECTOR = '.tab-list .workspace-tab'"), 'Visible tabs must reuse the proven hidden tab engine')
expect(shellComponent.includes('data-hi5-workspace-shell="v3"'), 'Workspace Shell v3 marker is missing')
expect(shellComponent.includes('visibleTabs.map((tab)'), 'Visible workspace tab rendering is missing')
expect(shellComponent.includes("tab.key === 'livechat' || tab.module === 'livechat'"), 'Live Chat must receive permanent visible tab treatment')
expect(shellComponent.includes('production-workspace-tab-unread'), 'Live Chat/workspace unread badge is missing')
expect(shellComponent.includes('semanticTabIdentity') && shellComponent.includes('dedupeWorkspaceTabs'), 'Workspace shell must suppress duplicate semantic tabs')
expect(shellComponent.includes("invokeLegacyContextAction(active.key, 'Duplicate tab')"), 'Duplicate-current behaviour must be preserved')
expect(shellComponent.includes("invokeLegacyContextAction(active.key, 'Close all tabs')"), 'Close-all behaviour must be preserved')
expect(shellComponent.includes("proxyClick('.record-create-trigger')"), 'New Record experience must remain wired')
expect(shellComponent.includes("proxyClick('.tabbar-brand')"), 'Mobile navigation trigger must remain wired')
expect(shellComponent.includes('production-workspace-tabdock is-searching') || shellComponent.includes("searchOpen ? ' is-searching'"), 'Mobile search state must explicitly control the tab dock')
expect(shellComponent.includes("scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })"), 'Active mobile workspace must be automatically brought into view')

expect(shell.includes('.production-workspace-tabdock'), 'Floating workspace tab dock styles are missing')
expect(shell.includes('.production-workspace-tabs') && shell.includes('overflow-x: auto'), 'Workspace tabs must retain local horizontal scrolling capability')
expect(shell.includes('.production-workspace-tab.is-livechat'), 'Live Chat visible tab styling is missing')
expect(shell.includes('var(--accent-rgb)') && shell.includes('var(--accent-ink)'), 'Workspace tabs/actions must remain accent-aware')

// Corrective chrome contract -------------------------------------------------
expect(corrections.includes('.production-workspace-tabs-viewport') && corrections.includes('flex: 1 1 auto'), 'Tab viewport must own only the remaining toolbar width')
expect(corrections.includes('.production-workspace-tabdock-actions') && corrections.includes('min-width: max-content'), 'Toolbar actions must remain fixed and unsqueezed')
expect(corrections.includes('.production-workspace-search input:focus-visible') && corrections.includes('outline: 0 !important'), 'Shell search must suppress the escaping global focus ring')
expect(shellComponent.includes('production-workspace-menu-floating') && shellComponent.includes('document.body'), 'Workspace menu must be portalled outside page stacking contexts')
expect(corrections.includes('.production-workspace-menu-backdrop') && corrections.includes('z-index: 9999'), 'Workspace menu must stay above page content')
expect(corrections.includes('.sidebar .sidebar-status') && corrections.includes('display: none !important'), 'Service Health card must remain removed from primary navigation')
expect(corrections.includes('.sidebar .nav-item.active') && corrections.includes('rgba(var(--accent-rgb), 0.075)'), 'Primary navigation active state must use the professional Settings-style accent treatment')

// Tab interaction contract ---------------------------------------------------
expect(tabBehaviour.includes('scrollbar-width: none !important'), 'Touch tab scrollbar must remain hidden')
expect(tabBehaviour.includes(".production-workspace-tabs::-webkit-scrollbar"), 'WebKit touch tab scrollbar must remain hidden')
expect(/@media \(hover: none\), \(pointer: coarse\)[\s\S]*?overflow-x:\s*auto !important;/.test(tabBehaviour), 'Touch tabs must remain locally swipeable')
expect(/@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?overflow-x:\s*hidden !important;/.test(tabBehaviour), 'Desktop tabs must never horizontally scroll')
expect(/@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.production-workspace-tab\s*\{[\s\S]*?flex:\s*1 1 0 !important;/.test(tabBehaviour), 'Desktop tabs must compress to share available width')
expect(/\.production-workspace-tab-add\s*\{[\s\S]*?flex:\s*0 0 31px !important;/.test(tabBehaviour), 'Workspace launcher must remain fixed while desktop tabs compress')

// Shared record-detail density -----------------------------------------------
expect(sharedRecordMasthead.includes('Incidents, Service Requests, Problems and Changes'), 'Shared masthead must explicitly cover all four ITSM record types')
expect(/@media \(max-width: 700px\)[\s\S]*?\.activity-canvas-top\s*\{[\s\S]*?display:\s*grid !important;/.test(sharedRecordMasthead), 'Mobile record masthead must use compact shared grid geometry')
expect(/\.activity-canvas-mobile-details\s*\{[\s\S]*?width:\s*34px !important;[\s\S]*?font-size:\s*0 !important;/.test(sharedRecordMasthead), 'Mobile record inspector must remain an icon-sized control')
expect(/\.activity-canvas-commands\s*\{[\s\S]*?flex-wrap:\s*nowrap !important;[\s\S]*?scrollbar-width:\s*none;/.test(sharedRecordMasthead), 'Mobile record commands must remain a compact single-row rail without a visible scrollbar')
expect(/\.activity-canvas-ribbon\s*\{[\s\S]*?min-height:\s*36px !important;/.test(sharedRecordMasthead), 'Shared record facts ribbon must remain compact on mobile')

// Left/right navigation accessibility ---------------------------------------
expect(dockingPreferences.includes("hi5central-primary-nav-side-v1"), 'Desktop navigation-side preference key is missing')
expect(dockingPreferences.includes("hi5central-mobile-nav-side-v1"), 'Mobile navigation-side preference key is missing')
expect(dockingPreferences.includes('Desktop sidebar dock') && dockingPreferences.includes('Mobile navigation button'), 'Navigation side controls must be exposed in Settings')
expect(dockingPreferences.includes("window.dispatchEvent(new CustomEvent('hi5-navigation-side-change'"), 'Navigation docking changes must apply immediately')
expect(corrections.includes("data-hi5-nav-side='right'"), 'Desktop right-docked navigation CSS is missing')
expect(corrections.includes("data-hi5-mobile-nav-side='right'"), 'Mobile right-docked navigation CSS is missing')
expect(corrections.includes('translateX(calc(100% + 24px))'), 'Right-docked mobile drawer must enter from the right')

// Floating navigation --------------------------------------------------------
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
