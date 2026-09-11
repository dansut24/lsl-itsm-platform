import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { MarketingApp } from './features/marketing/MarketingApp.jsx'
import { SignupPage } from './features/marketing/SignupPage.jsx'
import { ServiceCatalogueSettingsEnhancer } from './features/catalogue/ServiceCatalogueSettingsEnhancer.jsx'
import { KnowledgeContextEnhancer } from './features/knowledge/KnowledgeContextEnhancer.jsx'
import { OrganisationSitesEnhancer } from './features/people/OrganisationSitesEnhancer.jsx'
import { OnboardingMfaEnhancer } from './features/security/OnboardingMfaEnhancer.jsx'
import { ProductionMfaLoginEnhancer } from './features/security/ProductionMfaLoginEnhancer.jsx'
import { ProductionMfaSettingsEnhancer } from './features/security/ProductionMfaSettingsEnhancer.jsx'
import { ProductionPasswordRecoveryEnhancer } from './features/security/ProductionPasswordRecoveryEnhancer.jsx'
import { ProductionSecurityCenterEnhancer } from './features/security/ProductionSecurityCenterEnhancer.jsx'
import { ProductionFirstLoginExperience } from './production/ProductionFirstLoginExperience.jsx'
import { ProductionFirstLoginRouteBridge } from './production/ProductionFirstLoginRouteBridge.jsx'
import { ProductionItsmWorkspace } from './production/ProductionItsmWorkspace.jsx'
import { ProductionNavigationDockPreferences } from './production/ProductionNavigationDockPreferences.jsx'
import { ProductionOnboardingBootstrap } from './production/ProductionOnboardingBootstrap.jsx'
import { ProductionOrganisationWriteThrough } from './production/ProductionOrganisationWriteThrough.jsx'
import { ProductionPortalBootstrap } from './production/ProductionPortalBootstrap.jsx'
import { ProductionPortalThemeBridge } from './production/ProductionPortalThemeBridge.jsx'
import { ProductionPremiumWorkspaceExperience } from './production/ProductionPremiumWorkspaceExperience.jsx'
import { ProductionRecordDetailRouter } from './production/ProductionRecordDetailRouter.jsx'
import { ProductionRecordExportEnhancer } from './production/ProductionRecordExportEnhancer.jsx'
import { ProductionRecordListInteractionEnhancer } from './production/ProductionRecordListInteractionEnhancer.jsx'
import { ProductionServiceRequestIntake } from './production/ProductionServiceRequestIntake.jsx'
import { ProductionUniversalPeekV2 } from './production/ProductionUniversalPeekV2.jsx'
import { ProductionWorkspaceBootstrap } from './production/ProductionWorkspaceBootstrap.jsx'
import { ProductionWorkspaceRefinement } from './production/ProductionWorkspaceRefinement.jsx'
import { ProductionWorkspaceShellV2 } from './production/ProductionWorkspaceShellV2.jsx'
import { resolveTenantSurface } from './lib/tenantSurface.js'
import './features/settings/ProductionSettingsFloating.css'
import './features/people/OrganisationContextual.css'
import './features/onboarding/OnboardingViewportFix.css'
import './production/ProductionItsmMobileViewFix.css'
import './production/ProductionItsmSurfacePolish.css'
import './production/ProductionWorkspaceFinalPolish.css'
import './PlatformCurves.css'
import './ContextualSurfaces.css'
import './production/ProductionWorkspaceVisualSystem.css'
import './production/ProductionActivityFirstRecord.css'
import './production/ProductionWorkspaceDensity.css'
import './production/ProductionPlanningSurface.css'
import './production/ProductionPlanningResponsive.css'
import './production/ProductionResponsiveViewport.css'
import './production/ProductionWorkspaceShellV2.css'
import './production/ProductionWorkspaceShellV2Mobile.css'
import './production/ProductionLiquidGlassWorkspace.css'
import './production/ProductionShellV3Corrections.css'
import './production/ProductionWorkspaceTabBehaviour.css'
import './production/ProductionSharedRecordMasthead.css'
import './production/ProductionPremiumWorkspaceExperience.css'
import './production/ProductionUniversalPeekV2.css'
import './production/ProductionRecordInspectorClassic.css'
import './production/ProductionRecordExperienceFinal.css'

const rootElement = document.getElementById('root')
const initialSurface = resolveTenantSurface()
document.documentElement.dataset.hi5Surface = initialSurface.kind
document.body.dataset.hi5Surface = initialSurface.kind
if (rootElement) rootElement.dataset.hi5Surface = initialSurface.kind

const productionWorkspace = initialSurface.kind === 'workspace' && initialSurface.canonical
const productionOnboarding = productionWorkspace
  && (window.location.pathname === '/onboarding' || window.location.pathname.startsWith('/onboarding/'))

let RootApp = App
if (initialSurface.kind === 'marketing') {
  RootApp = window.location.pathname === '/signup' || window.location.pathname.startsWith('/signup/')
    ? SignupPage
    : MarketingApp
}
if (productionWorkspace) RootApp = productionOnboarding ? ProductionOnboardingBootstrap : ProductionWorkspaceBootstrap
if (initialSurface.kind === 'portal' && initialSurface.canonical) RootApp = ProductionPortalBootstrap

createRoot(rootElement).render(
  <StrictMode>
    <RootApp />
    {initialSurface.kind === 'workspace' && !productionOnboarding ? <KnowledgeContextEnhancer /> : null}
    {initialSurface.kind === 'workspace' && !productionOnboarding ? <OrganisationSitesEnhancer /> : null}
    {initialSurface.kind === 'workspace' && !productionOnboarding ? <ServiceCatalogueSettingsEnhancer /> : null}
    {productionWorkspace && !productionOnboarding ? <ProductionOrganisationWriteThrough /> : null}
    {productionWorkspace && !productionOnboarding ? <ProductionItsmWorkspace /> : null}
    {productionWorkspace && !productionOnboarding ? <ProductionRecordDetailRouter /> : null}
    {productionWorkspace && !productionOnboarding ? <ProductionRecordExportEnhancer /> : null}
    {productionWorkspace && !productionOnboarding ? <ProductionRecordListInteractionEnhancer /> : null}
    {productionWorkspace && !productionOnboarding ? <ProductionServiceRequestIntake /> : null}
    {productionWorkspace && !productionOnboarding ? <ProductionWorkspaceRefinement /> : null}
    {productionWorkspace && !productionOnboarding ? <ProductionNavigationDockPreferences /> : null}
    {productionWorkspace && !productionOnboarding ? <ProductionWorkspaceShellV2 /> : null}
    {productionWorkspace && !productionOnboarding ? <ProductionPremiumWorkspaceExperience /> : null}
    {productionWorkspace && !productionOnboarding ? <ProductionPortalThemeBridge /> : null}
    {productionWorkspace && !productionOnboarding ? <ProductionUniversalPeekV2 /> : null}
    {productionWorkspace && !productionOnboarding ? <ProductionFirstLoginRouteBridge /> : null}
    {productionWorkspace && !productionOnboarding ? <ProductionFirstLoginExperience /> : null}
    {productionWorkspace && !productionOnboarding ? <ProductionMfaLoginEnhancer /> : null}
    {productionWorkspace && !productionOnboarding ? <ProductionMfaSettingsEnhancer /> : null}
    {productionWorkspace && productionOnboarding ? <OnboardingMfaEnhancer /> : null}
    {productionWorkspace && !productionOnboarding ? <ProductionSecurityCenterEnhancer /> : null}
    {productionWorkspace && !productionOnboarding ? <ProductionPasswordRecoveryEnhancer /> : null}
  </StrictMode>,
)
