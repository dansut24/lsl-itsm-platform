import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { MarketingApp } from './features/marketing/MarketingApp.jsx'
import { SignupPage } from './features/marketing/SignupPage.jsx'
import { ProductionWorkspaceBootstrap } from './production/ProductionWorkspaceBootstrap.jsx'
import { resolveTenantSurface } from './lib/tenantSurface.js'

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

createRoot(rootElement).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
)
