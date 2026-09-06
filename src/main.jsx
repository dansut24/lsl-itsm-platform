import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { MarketingApp } from './features/marketing/MarketingApp.jsx'
import { SignupPage } from './features/marketing/SignupPage.jsx'
import { ServiceCatalogueSettingsEnhancer } from './features/catalogue/ServiceCatalogueSettingsEnhancer.jsx'
import { KnowledgeContextEnhancer } from './features/knowledge/KnowledgeContextEnhancer.jsx'
import { OrganisationSitesEnhancer } from './features/people/OrganisationSitesEnhancer.jsx'
import { ProductionPortalBootstrap } from './production/ProductionPortalBootstrap.jsx'
import { ProductionWorkspaceBootstrap } from './production/ProductionWorkspaceBootstrap.jsx'
import { resolveTenantSurface } from './lib/tenantSurface.js'
import './features/settings/ProductionSettingsFloating.css'
import './features/people/OrganisationContextual.css'
import './PlatformCurves.css'
import './ContextualSurfaces.css'

const rootElement = document.getElementById('root')
const initialSurface = resolveTenantSurface()
document.documentElement.dataset.hi5Surface = initialSurface.kind
document.body.dataset.hi5Surface = initialSurface.kind
if (rootElement) rootElement.dataset.hi5Surface = initialSurface.kind

let RootApp = App
if (initialSurface.kind === 'marketing') {
  RootApp = window.location.pathname === '/signup' || window.location.pathname.startsWith('/signup/')
    ? SignupPage
    : MarketingApp
}
if (initialSurface.kind === 'workspace' && initialSurface.canonical) RootApp = ProductionWorkspaceBootstrap
if (initialSurface.kind === 'portal' && initialSurface.canonical) RootApp = ProductionPortalBootstrap

createRoot(rootElement).render(
  <StrictMode>
    <RootApp />
    {initialSurface.kind === 'workspace' ? <KnowledgeContextEnhancer /> : null}
    {initialSurface.kind === 'workspace' ? <OrganisationSitesEnhancer /> : null}
    {initialSurface.kind === 'workspace' ? <ServiceCatalogueSettingsEnhancer /> : null}
  </StrictMode>,
)
