import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sun,
  X,
} from 'lucide-react'
import {
  analystNavIds,
  assets,
  knowledgeArticles,
  loginProfiles,
  seedTickets,
  serviceCatalog,
  viewMeta,
} from './data/demoData.jsx'
import {
  countBy,
  getBreadcrumbs,
  makeTab,
  newTicketId,
} from './lib/workspace.js'
import {
  allTicketFilters,
  defaultRouteForRole,
  pathForTab,
  resolveRouteForRole,
  routeFromLocation,
  writeRoute,
} from './lib/routes.js'
import { authenticateDemoUser } from './services/demoAuth.js'
import {
  loadSession,
  loadSidebarMode,
  loadTheme,
  loadTickets,
  saveSession,
  saveSidebarMode,
  saveTheme,
  saveTickets,
} from './services/demoStore.js'
import {
  ChangesView,
  CmdbView,
  DashboardView,
  KnowledgeView,
  LoginScreen,
  NewTabView,
  ReportsView,
  SelfServicePortal,
  SelfServiceShell,
  SettingsView,
  TicketRecordView,
  TicketsView,
} from './features/workspace/WorkspaceViews.jsx'
import './App.css'

function App() {
  const [initialTickets] = useState(loadTickets)
  const [initialSession] = useState(loadSession)
  const [initialRoute] = useState(routeFromLocation)
  const initialWorkspaceRoute = resolveRouteForRole(
    initialRoute,
    initialSession?.role || 'analyst',
  )
  const [session, setSession] = useState(initialSession)
  const [theme, setTheme] = useState(loadTheme)
  const [sidebarMode, setSidebarMode] = useState(loadSidebarMode)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [density, setDensity] = useState('comfortable')
  const [tickets, setTickets] = useState(initialTickets)
  const [tabs, setTabs] = useState(() => [
    makeTab(initialWorkspaceRoute.viewId, {
      key: initialWorkspaceRoute.key,
      title: initialWorkspaceRoute.title,
      pinned: initialWorkspaceRoute.viewId === 'home' || initialWorkspaceRoute.viewId === 'portal',
      recordId: initialWorkspaceRoute.recordId,
    }),
  ])
  const [activeTabKey, setActiveTabKey] = useState(initialWorkspaceRoute.key)
  const [selectedTicketId, setSelectedTicketId] = useState(
    initialWorkspaceRoute.recordId || initialTickets[0]?.id || seedTickets[0].id,
  )
  const [query, setQuery] = useState(initialWorkspaceRoute.query || '')
  const [filters, setFilters] = useState(
    initialWorkspaceRoute.filter || allTicketFilters(),
  )
  const [toast, setToast] = useState('')
  const [newComment, setNewComment] = useState('')
  const [portalQuery, setPortalQuery] = useState('')
  const [loginMode, setLoginMode] = useState('analyst')
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [ticketDraft, setTicketDraft] = useState({
    type: 'Incident',
    title: '',
    requester: '',
    priority: 'Medium',
    service: 'Collaboration',
    team: 'Service Desk',
    description: '',
  })
  const [portalDraft, setPortalDraft] = useState({
    requester: initialSession?.role === 'requester' ? initialSession.name : '',
    email: initialSession?.role === 'requester' ? loginProfiles.requester.username : '',
    category: 'Report an IT Issue',
    title: '',
    description: '',
    urgency: 'Medium',
  })

  useEffect(() => {
    saveTickets(tickets)
  }, [tickets])

  useEffect(() => {
    saveTheme(theme)
  }, [theme])

  useEffect(() => {
    saveSidebarMode(sidebarMode)
  }, [sidebarMode])

  useEffect(() => {
    saveSession(session)
  }, [session])

  useEffect(() => {
    const currentRoute = routeFromLocation()

    if (!session) {
      writeRoute('/login', { replace: true })
      return
    }

    const resolvedRoute = resolveRouteForRole(currentRoute, session.role)
    if (resolvedRoute.path !== currentRoute.path) {
      writeRoute(resolvedRoute.path, { replace: true })
    }
  }, [session])

  useEffect(() => {
    function handlePopState() {
      if (!session) return

      const currentRoute = routeFromLocation()
      const route = resolveRouteForRole(currentRoute, session.role)

      if (session.role === 'requester') {
        writeRoute('/portal', { replace: true })
        return
      }

      if (route.path !== currentRoute.path) {
        writeRoute(route.path, { replace: true })
      }

      const tab = makeTab(route.viewId, {
        key: route.key,
        title: route.title,
        recordId: route.recordId,
      })

      if (route.recordId) {
        setSelectedTicketId(route.recordId)
      }
      if (route.filter) {
        setFilters(route.filter)
      }
      if (route.query !== undefined) {
        setQuery(route.query)
      }

      setTabs((currentTabs) =>
        currentTabs.some((currentTab) => currentTab.key === tab.key)
          ? currentTabs
          : [...currentTabs, tab],
      )
      setActiveTabKey(tab.key)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [session])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const activeTab = tabs.find((tab) => tab.key === activeTabKey) || tabs[0]
  const activeView = activeTab?.viewId || 'home'
  const selectedTicket =
    tickets.find((ticket) => ticket.id === (activeTab?.recordId || selectedTicketId)) || tickets[0]
  const navItems = analystNavIds.map((id) => viewMeta[id])
  const breadcrumbs = getBreadcrumbs(activeTab, selectedTicket)
  const sidebarCollapsed = sidebarMode === 'collapsed'
  const sidebarHidden = sidebarMode === 'hidden'

  const filteredTickets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return tickets.filter((ticket) => {
      const matchesQuery =
        !normalizedQuery ||
        [ticket.id, ticket.title, ticket.requester, ticket.service, ticket.team, ticket.assignee]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      const matchesStatus = filters.status === 'All' || ticket.status === filters.status
      const matchesPriority = filters.priority === 'All' || ticket.priority === filters.priority
      const matchesType = filters.type === 'All' || ticket.type === filters.type
      return matchesQuery && matchesStatus && matchesPriority && matchesType
    })
  }, [filters, query, tickets])

  const metrics = useMemo(() => {
    const active = tickets.filter((ticket) => !['Closed', 'Resolved'].includes(ticket.status))
    const highRisk = tickets.filter((ticket) => ['Critical', 'High'].includes(ticket.priority))
    const awaitingApproval = tickets.filter((ticket) =>
      ['Pending Approval', 'CAB Review'].includes(ticket.status),
    )
    const slaPressure = tickets.filter((ticket) => ticket.slaPercent >= 60 && ticket.status !== 'Resolved')

    return {
      active: active.length,
      highRisk: highRisk.length,
      approvals: awaitingApproval.length,
      slaPressure: slaPressure.length,
      typeCounts: countBy(tickets, 'type'),
      teamCounts: countBy(tickets, 'team'),
      priorityCounts: countBy(tickets, 'priority'),
    }
  }, [tickets])

  const portalResults = useMemo(() => {
    const normalizedQuery = portalQuery.trim().toLowerCase()
    if (!normalizedQuery) return knowledgeArticles
    return knowledgeArticles.filter((article) =>
      [article.title, article.category].join(' ').toLowerCase().includes(normalizedQuery),
    )
  }, [portalQuery])

  function openTab(viewId, overrides = {}, navigation = {}) {
    const normalizedOverrides =
      viewId === 'tickets' && !overrides.recordId && !overrides.filter && !overrides.key
        ? {
            ...overrides,
            key: 'tickets',
            title: 'Tickets',
            filter: allTicketFilters(),
            query: '',
          }
        : overrides

    const tab = makeTab(viewId, normalizedOverrides)
    if (normalizedOverrides.recordId) {
      setSelectedTicketId(normalizedOverrides.recordId)
    }
    if (normalizedOverrides.filter) {
      setFilters((currentFilters) => ({ ...currentFilters, ...normalizedOverrides.filter }))
    }
    if (normalizedOverrides.query !== undefined) {
      setQuery(normalizedOverrides.query)
    }
    setTabs((currentTabs) =>
      currentTabs.some((currentTab) => currentTab.key === tab.key)
        ? currentTabs
        : [...currentTabs, tab],
    )
    setActiveTabKey(tab.key)

    if (navigation.syncRoute !== false) {
      writeRoute(pathForTab(tab, tickets), { replace: navigation.replaceRoute })
    }
  }

  function openBreadcrumb(crumb) {
    if (!crumb.viewId) return
    openTab(crumb.viewId, {
      filter: crumb.filter,
      key: crumb.key,
      query: crumb.query,
      recordId: crumb.recordId,
      title: crumb.title,
    })
  }

  function openSidebarTab(viewId) {
    openTab(viewId)
    setMobileNavOpen(false)
  }

  function openNewTab() {
    const key = `newtab-${Date.now()}`
    const tab = makeTab('newtab', { key, title: 'New Tab' })
    setTabs((currentTabs) => [...currentTabs, tab])
    setActiveTabKey(key)
    writeRoute(pathForTab(tab, tickets))
  }

  function activateTab(tab) {
    if (tab.recordId) {
      setSelectedTicketId(tab.recordId)
    }
    setActiveTabKey(tab.key)
    writeRoute(pathForTab(tab, tickets))
  }

  function closeTab(key) {
    const index = tabs.findIndex((tab) => tab.key === key)
    const nextTabs = tabs.filter((tab) => tab.key !== key)
    if (!nextTabs.length) return
    setTabs(nextTabs)
    if (activeTabKey === key) {
      const fallbackIndex = Math.max(0, index - 1)
      const fallbackTab = nextTabs[fallbackIndex] || nextTabs[0]
      if (fallbackTab.recordId) {
        setSelectedTicketId(fallbackTab.recordId)
      }
      setActiveTabKey(fallbackTab.key)
      writeRoute(pathForTab(fallbackTab, tickets), { replace: true })
    }
  }

  function updateTicket(id, updates) {
    setTickets((currentTickets) =>
      currentTickets.map((ticket) =>
        ticket.id === id ? { ...ticket, ...updates, updated: 'Just now' } : ticket,
      ),
    )
  }

  function addComment() {
    if (!newComment.trim() || !selectedTicket) return
    updateTicket(selectedTicket.id, {
      comments: [`${newComment.trim()} - added now`, ...selectedTicket.comments],
    })
    setNewComment('')
    setToast(`Comment added to ${selectedTicket.id}`)
  }

  function handleTicketSubmit(event) {
    event.preventDefault()
    if (!ticketDraft.title.trim() || !ticketDraft.requester.trim()) {
      setToast('Add a title and requester first')
      return
    }

    const createdTicket = {
      id: newTicketId(ticketDraft.type),
      type: ticketDraft.type,
      title: ticketDraft.title.trim(),
      requester: ticketDraft.requester.trim(),
      priority: ticketDraft.priority,
      status: ticketDraft.type === 'Change' ? 'Pending Approval' : 'New',
      team: ticketDraft.team,
      assignee: 'Unassigned',
      service: ticketDraft.service,
      location: 'Unconfirmed',
      sla: ticketDraft.priority === 'Critical' ? '1 hr' : '8 hr',
      slaPercent: ticketDraft.priority === 'Critical' ? 72 : 18,
      created: 'Just now',
      updated: 'Just now',
      description: ticketDraft.description.trim() || 'No description supplied.',
      nextStep: 'Triage and assign an owner.',
      comments: ['Created from the analyst console.'],
      linkedAssets: [],
      risk: ticketDraft.type === 'Change' ? 'Medium' : undefined,
      approval: ticketDraft.type === 'Change' ? 'Pending' : undefined,
      window: ticketDraft.type === 'Change' ? 'To be scheduled' : undefined,
    }

    setTickets((currentTickets) => [createdTicket, ...currentTickets])
    openTab('tickets', { key: `ticket-${createdTicket.id}`, title: createdTicket.id, recordId: createdTicket.id })
    setTicketDraft({
      type: 'Incident',
      title: '',
      requester: '',
      priority: 'Medium',
      service: 'Collaboration',
      team: 'Service Desk',
      description: '',
    })
    setToast(`${createdTicket.id} created`)
  }

  function handlePortalSubmit(event) {
    event.preventDefault()
    const requestEmail = portalDraft.email.trim() || (session?.role === 'requester' ? session.username : '')
    const requesterName = portalDraft.requester.trim() || (session?.role === 'requester' ? session.name : '')
    if (!requesterName || !portalDraft.title.trim()) {
      setToast('Add your name and request summary')
      return
    }

    const createdTicket = {
      id: newTicketId('Service Request'),
      type: portalDraft.category.includes('Issue') ? 'Incident' : 'Service Request',
      title: portalDraft.title.trim(),
      requester: requesterName,
      priority: portalDraft.urgency,
      status: 'New',
      team: 'Service Desk',
      assignee: 'Unassigned',
      service: portalDraft.category.replace('Report an ', ''),
      location: requestEmail || 'Self-service portal',
      sla: portalDraft.urgency === 'High' ? '4 hr' : '1 day',
      slaPercent: portalDraft.urgency === 'High' ? 48 : 12,
      created: 'Just now',
      updated: 'Just now',
      description: portalDraft.description.trim() || 'Submitted through the Hi5Central self-service portal.',
      nextStep: 'Service Desk triage.',
      comments: ['Submitted through the self-service portal.'],
      linkedAssets: [],
    }

    setTickets((currentTickets) => [createdTicket, ...currentTickets])
    setPortalDraft({
      requester: session?.role === 'requester' ? session.name : '',
      email: session?.role === 'requester' ? session.username : '',
      category: 'Report an IT Issue',
      title: '',
      description: '',
      urgency: 'Medium',
    })
    setToast(`${createdTicket.id} submitted through self-service`)
  }

  function approveChange(ticket, approval) {
    updateTicket(ticket.id, {
      approval,
      status: approval === 'Approved' ? 'In Progress' : 'Pending Approval',
      comments: [`Change ${approval.toLowerCase()} from CAB panel.`, ...ticket.comments],
    })
    setToast(`${ticket.id} marked ${approval.toLowerCase()}`)
  }

  function handleLogin(event) {
    event.preventDefault()
    const authenticated = authenticateDemoUser(loginMode, loginForm)
    if (!authenticated) {
      setLoginError('Those demo credentials do not match this login area.')
      return
    }

    const { profile, session: nextSession } = authenticated
    const requestedRoute =
      initialRoute.kind === 'workspace'
        ? resolveRouteForRole(initialRoute, profile.role)
        : defaultRouteForRole(profile.role)
    const tab = makeTab(requestedRoute.viewId, {
      key: requestedRoute.key,
      title: requestedRoute.title,
      pinned: requestedRoute.viewId === 'home' || requestedRoute.viewId === 'portal',
      recordId: requestedRoute.recordId,
    })

    setSession(nextSession)
    setLoginError('')
    setTabs([tab])
    setActiveTabKey(tab.key)
    if (requestedRoute.recordId) {
      setSelectedTicketId(requestedRoute.recordId)
    }
    if (requestedRoute.filter) {
      setFilters(requestedRoute.filter)
    }
    if (requestedRoute.query !== undefined) {
      setQuery(requestedRoute.query)
    }
    setPortalDraft({
      requester: profile.role === 'requester' ? profile.name : '',
      email: profile.role === 'requester' ? profile.username : '',
      category: 'Report an IT Issue',
      title: '',
      description: '',
      urgency: 'Medium',
    })
    writeRoute(requestedRoute.path, { replace: true })
    setToast(`Signed in as ${profile.label}`)
  }

  function fillCredentials(mode) {
    const profile = loginProfiles[mode]
    setLoginMode(mode)
    setLoginForm({ username: profile.username, password: profile.password })
    setLoginError('')
  }

  function handleLogout() {
    setSession(null)
    setLoginForm({ username: '', password: '' })
    setLoginMode('analyst')
    setTabs([makeTab('home', { title: 'Dashboard', pinned: true })])
    setActiveTabKey('home')
    setPortalDraft({
      requester: '',
      email: '',
      category: 'Report an IT Issue',
      title: '',
      description: '',
      urgency: 'Medium',
    })
    writeRoute('/login', { replace: true })
  }

  function renderActiveView() {
    if (activeView === 'newtab') {
      return (
        <NewTabView
          navItems={navItems}
          openRecordTab={(ticket) =>
            openTab('tickets', { key: `ticket-${ticket.id}`, title: ticket.id, recordId: ticket.id })
          }
          openTab={openTab}
          tickets={tickets}
        />
      )
    }

    if (activeView === 'home') {
      return (
        <DashboardView
          metrics={metrics}
          openRecordTab={(ticket) =>
            openTab('tickets', { key: `ticket-${ticket.id}`, title: ticket.id, recordId: ticket.id })
          }
          openTab={openTab}
          tickets={tickets}
        />
      )
    }

    if (activeView === 'tickets') {
      if (activeTab?.recordId) {
        return (
          <TicketRecordView
            addComment={addComment}
            newComment={newComment}
            selectedTicket={selectedTicket}
            setNewComment={setNewComment}
            updateTicket={updateTicket}
          />
        )
      }

      return (
        <TicketsView
          addComment={addComment}
          filters={filters}
          filteredTickets={filteredTickets}
          handleTicketSubmit={handleTicketSubmit}
          newComment={newComment}
          openRecordTab={(ticket) =>
            openTab('tickets', { key: `ticket-${ticket.id}`, title: ticket.id, recordId: ticket.id })
          }
          query={query}
          selectedTicket={selectedTicket}
          setFilters={setFilters}
          setNewComment={setNewComment}
          setQuery={setQuery}
          setSelectedTicketId={setSelectedTicketId}
          setTicketDraft={setTicketDraft}
          ticketDraft={ticketDraft}
          tickets={tickets}
          updateTicket={updateTicket}
        />
      )
    }

    if (activeView === 'portal') {
      return (
        <SelfServicePortal
          currentUser={session}
          handlePortalSubmit={handlePortalSubmit}
          portalDraft={portalDraft}
          portalQuery={portalQuery}
          portalResults={portalResults}
          serviceCatalog={serviceCatalog}
          setPortalDraft={setPortalDraft}
          setPortalQuery={setPortalQuery}
          tickets={tickets}
        />
      )
    }

    if (activeView === 'changes') {
      return (
        <ChangesView
          approveChange={approveChange}
          openRecordTab={(ticket) =>
            openTab('tickets', { key: `ticket-${ticket.id}`, title: ticket.id, recordId: ticket.id })
          }
          tickets={tickets.filter((ticket) => ticket.type === 'Change')}
        />
      )
    }

    if (activeView === 'cmdb') {
      return <CmdbView assets={assets} tickets={tickets} />
    }

    if (activeView === 'knowledge') {
      return (
        <KnowledgeView
          portalQuery={portalQuery}
          portalResults={portalResults}
          setPortalQuery={setPortalQuery}
        />
      )
    }

    if (activeView === 'reports') {
      return <ReportsView metrics={metrics} tickets={tickets} />
    }

    return (
      <SettingsView
        density={density}
        session={session}
        setDensity={setDensity}
        setSidebarMode={setSidebarMode}
        setTheme={setTheme}
        sidebarMode={sidebarMode}
        theme={theme}
      />
    )
  }

  if (!session) {
    return (
      <LoginScreen
        fillCredentials={fillCredentials}
        loginError={loginError}
        loginForm={loginForm}
        loginMode={loginMode}
        onLogin={handleLogin}
        setLoginForm={setLoginForm}
        setLoginMode={setLoginMode}
        setTheme={setTheme}
        theme={theme}
      />
    )
  }

  if (session.role === 'requester') {
    return (
      <SelfServiceShell
        currentUser={session}
        handleLogout={handleLogout}
        handlePortalSubmit={handlePortalSubmit}
        portalDraft={portalDraft}
        portalQuery={portalQuery}
        portalResults={portalResults}
        serviceCatalog={serviceCatalog}
        setPortalDraft={setPortalDraft}
        setPortalQuery={setPortalQuery}
        setTheme={setTheme}
        theme={theme}
        tickets={tickets}
        toast={toast}
      />
    )
  }

  return (
    <div
      className={`app-shell sidebar-${sidebarMode} density-${density}`}
      data-theme={theme}
    >
      <header className="mobile-topbar" aria-label="Mobile workspace controls">
        <button
          className="mobile-logo-button"
          onClick={() => setMobileNavOpen(true)}
          title="Open navigation"
          type="button"
        >
          <img src={`${import.meta.env.BASE_URL}hi5central-logo.png`} alt="Hi5Central" />
        </button>

        <div className="mobile-topbar-actions">
          <button className="mobile-icon-action mobile-new-ticket" onClick={() => openTab('tickets')} title="New ticket" type="button">
            <Plus size={18} aria-hidden="true" />
          </button>
          <button
            className="mobile-icon-action"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            type="button"
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <button className="mobile-icon-action" title="Notifications" type="button">
            <Bell size={17} aria-hidden="true" />
          </button>
          <button className="mobile-icon-action" onClick={() => openTab('settings')} title="Settings" type="button">
            <Settings size={17} aria-hidden="true" />
          </button>
          <button className="mobile-icon-action" onClick={handleLogout} title="Sign out" type="button">
            <LogOut size={17} aria-hidden="true" />
          </button>
        </div>
      </header>

      {(!sidebarHidden || mobileNavOpen) && <aside className={mobileNavOpen ? 'sidebar mobile-open' : 'sidebar'} aria-label="Primary navigation">
        <div className="sidebar-top">
          <div className="brand">
            <img src={`${import.meta.env.BASE_URL}hi5central-logo.png`} alt="Hi5Central" />
            <span>Hi5Central</span>
          </div>
          <button
            className="sidebar-toggle desktop-sidebar-toggle"
            onClick={() => setSidebarMode(sidebarCollapsed ? 'expanded' : 'collapsed')}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            type="button"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button
            className="mobile-drawer-close"
            onClick={() => setMobileNavOpen(false)}
            title="Close navigation"
            type="button"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <nav className="nav-stack">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              className={activeView === id ? 'nav-item active' : 'nav-item'}
              key={id}
              onClick={() => openSidebarTab(id)}
              title={label}
              type="button"
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-status">
          <div>
            <strong>Service Health</strong>
            <span>{metrics.slaPressure} SLA watch items</span>
          </div>
          <CircleGauge size={22} aria-hidden="true" />
        </div>
      </aside>}

      {mobileNavOpen && (
        <button
          aria-label="Close navigation"
          className="mobile-nav-backdrop"
          onClick={() => setMobileNavOpen(false)}
          type="button"
        />
      )}

      <section className="main-frame">
        <header className="tabbar" aria-label="Open workspace tabs">
          <div className="tab-list">
            {tabs.map((tab) => (
                <button
                  className={activeTabKey === tab.key ? 'workspace-tab active' : 'workspace-tab'}
                  key={tab.key}
                  onClick={() => activateTab(tab)}
                  type="button"
                >
                  <span>{tab.title}</span>
                  {!tab.pinned && (
                    <span
                      className="tab-close"
                      onClick={(event) => {
                        event.stopPropagation()
                        closeTab(tab.key)
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <X size={13} aria-hidden="true" />
                    </span>
                  )}
                </button>
              ))}
            <button className="tab-add" onClick={openNewTab} title="Open new tab" type="button">
              <Plus size={17} aria-hidden="true" />
            </button>
          </div>

          <div className="chrome-actions">
            {sidebarHidden && (
              <button
                className="icon-button"
                onClick={() => setSidebarMode('expanded')}
                title="Show sidebar"
                type="button"
              >
                <PanelLeftOpen size={17} aria-hidden="true" />
              </button>
            )}
            <button
              className="new-ticket-button"
              onClick={() => openTab('tickets')}
              type="button"
            >
              <Plus size={16} aria-hidden="true" />
              New Ticket
            </button>
            <label className="chrome-search">
              <Search size={16} aria-hidden="true" />
              <input
                aria-label="Search tickets"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search records"
                type="search"
                value={query}
              />
            </label>
            <button
              className="icon-button"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              type="button"
            >
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <button className="icon-button" title="Notifications" type="button">
              <Bell size={17} aria-hidden="true" />
            </button>
            <button className="icon-button" onClick={() => openTab('settings')} title="Settings" type="button">
              <Settings size={17} aria-hidden="true" />
            </button>
            <button className="user-pill" onClick={handleLogout} title="Sign out" type="button">
              <span>{session.initials}</span>
              <LogOut size={15} aria-hidden="true" />
            </button>
          </div>
        </header>

        <nav className="breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => (
            <span className="breadcrumb-segment" key={`${crumb.label}-${crumb.key || index}`}>
              {index > 0 && <ChevronRight className="breadcrumb-separator" size={14} aria-hidden="true" />}
              <button
                aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}
                className={index === breadcrumbs.length - 1 ? 'breadcrumb-item current' : 'breadcrumb-item'}
                onClick={() => openBreadcrumb(crumb)}
                type="button"
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </nav>

        <main className="workspace">
          <header className="view-header">
            <div>
              <span className="eyebrow">Hi5Central</span>
              <h1>{activeTab.title || viewMeta[activeView].label}</h1>
            </div>
            <div className="view-header-meta">
              <span>{session.name}</span>
              <span>{loginProfiles[session.profile]?.label}</span>
            </div>
          </header>

          <section className="content-frame">{renderActiveView()}</section>
        </main>
      </section>

      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  )
}


export default App
