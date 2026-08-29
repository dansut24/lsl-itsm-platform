import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sun,
  X,
} from 'lucide-react'
import {
  analystNavGroups,
  analystNavIds,
  assets,
  knowledgeArticles,
  loginProfiles,
  seedTickets,
  serviceCatalog,
  serviceDeskModules,
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
  loadAccent,
  loadDensity,
  loadSession,
  loadSidebarMode,
  loadTheme,
  loadTickets,
  loadWorkspace,
  saveAccent,
  saveDensity,
  saveSession,
  saveSidebarMode,
  saveTheme,
  saveTickets,
  saveWorkspace,
} from './services/demoStore.js'
import {
  ChangesView,
  CmdbRecordView,
  CmdbView,
  DashboardView,
  KnowledgeArticleView,
  KnowledgeView,
  LoginScreen,
  NewRecordView,
  NewTabView,
  ReportsView,
  SelfServicePortal,
  SelfServiceShell,
  SettingsView,
  TicketRecordView,
  TicketsView,
} from './features/workspace/WorkspaceViews.jsx'
import './App.css'

const settingsSectionTitles = {
  appearance: 'Appearance',
  workspace: 'Workspace',
  profile: 'Profile',
}

function getSystemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function tabFromRoute(route) {
  const asset = route.assetId ? assets.find((item) => item.id === route.assetId) : undefined
  const article = route.articleSlug
    ? knowledgeArticles.find((item) => item.slug === route.articleSlug)
    : undefined

  return makeTab(route.viewId, {
    key: route.key,
    title: asset?.name || article?.title || route.title,
    pinned: route.viewId === 'home' || (route.viewId === 'portal' && !route.portalRequestId),
    recordId: route.recordId,
    assetId: route.assetId,
    articleSlug: route.articleSlug,
    portalRequestId: route.portalRequestId,
    settingsSection: route.settingsSection,
    newRecordType: route.newRecordType,
    navId: route.navId,
    filter: route.filter,
    query: route.query,
  })
}

const MAX_WORKSPACE_TABS = 12

function emptyTicketDraft(type = 'Incident') {
  return {
    type,
    requesterId: '',
    requester: '',
    requesterEmail: '',
    requesterStaffNumber: '',
    requesterJobTitle: '',
    requesterDepartment: '',
    requesterLocation: '',
    requesterManager: '',
    title: '',
    description: '',
    impact: 'Medium',
    urgency: 'Medium',
    priority: 'Medium',
    service: 'Collaboration',
    category: 'Email & Messaging',
    team: 'Service Desk',
  }
}

function isTicketDraftDirty(draft, type = draft?.type || 'Incident') {
  if (!draft) return false
  const baseline = emptyTicketDraft(type)
  return Object.keys(baseline).some((key) => key !== 'type' && draft[key] !== baseline[key])
}

function restoreWorkspaceTabs(workspace, routeTab) {
  const savedTabs = Array.isArray(workspace?.tabs)
    ? workspace.tabs
        .filter((tab) => tab && typeof tab.key === 'string' && typeof tab.viewId === 'string')
        .map((tab) => makeTab(tab.viewId, tab))
    : []

  const deduped = savedTabs.filter(
    (tab, index, list) => list.findIndex((candidate) => candidate.key === tab.key) === index,
  )

  if (!deduped.some((tab) => tab.key === routeTab.key)) {
    deduped.push(routeTab)
  }

  if (!deduped.length) return [routeTab]
  if (deduped.length <= MAX_WORKSPACE_TABS) return deduped

  const essentials = deduped.filter((tab) => tab.pinned || tab.key === routeTab.key)
  const recent = deduped
    .filter((tab) => !essentials.some((essential) => essential.key === tab.key))
    .slice(-(MAX_WORKSPACE_TABS - essentials.length))

  return [...essentials, ...recent].slice(-MAX_WORKSPACE_TABS)
}

function addWorkspaceTab(currentTabs, tab) {
  if (currentTabs.some((currentTab) => currentTab.key === tab.key)) return currentTabs

  const nextTabs = [...currentTabs, tab]
  if (nextTabs.length <= MAX_WORKSPACE_TABS) return nextTabs

  const removableIndex = nextTabs.findIndex(
    (currentTab) => !currentTab.pinned && currentTab.key !== tab.key,
  )
  if (removableIndex >= 0) nextTabs.splice(removableIndex, 1)

  return nextTabs.slice(-MAX_WORKSPACE_TABS)
}

function App() {
  const [initialTickets] = useState(loadTickets)
  const [initialSession] = useState(loadSession)
  const [initialWorkspace] = useState(loadWorkspace)
  const [initialRoute] = useState(routeFromLocation)
  const initialWorkspaceRoute = resolveRouteForRole(
    initialRoute,
    initialSession?.role || 'analyst',
  )
  const initialRouteTab = tabFromRoute(initialWorkspaceRoute)
  const initialTabs = initialSession?.role === 'analyst'
    ? restoreWorkspaceTabs(initialWorkspace, initialRouteTab)
    : [initialRouteTab]
  const initialActiveTab = initialTabs.find((tab) => tab.key === initialRouteTab.key) || initialRouteTab
  const [session, setSession] = useState(initialSession)
  const [theme, setTheme] = useState(loadTheme)
  const [systemTheme, setSystemTheme] = useState(getSystemTheme)
  const [accent, setAccent] = useState(loadAccent)
  const [sidebarMode, setSidebarMode] = useState(loadSidebarMode)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [mobileHeaderHidden, setMobileHeaderHidden] = useState(false)
  const [pullRefreshDragging, setPullRefreshDragging] = useState(false)
  const [pullRefreshArmed, setPullRefreshArmed] = useState(false)
  const [pullRefreshing, setPullRefreshing] = useState(false)
  const [density, setDensity] = useState(loadDensity)
  const tabListRef = useRef(null)
  const mainFrameRef = useRef(null)
  const mobileScrollPositionsRef = useRef(new WeakMap())
  const pullRefreshGestureRef = useRef({
    active: false,
    engaged: false,
    startX: 0,
    startY: 0,
    distance: 0,
    scrollTarget: null,
    refreshing: false,
  })
  const pullRefreshTimerRef = useRef(null)
  const [tickets, setTickets] = useState(initialTickets)
  const [tabs, setTabs] = useState(initialTabs)
  const [activeTabKey, setActiveTabKey] = useState(initialRouteTab.key)
  const initialRouteType =
    initialActiveTab.newRecordType ||
    (initialActiveTab.filter?.type && initialActiveTab.filter.type !== 'All'
      ? initialActiveTab.filter.type
      : undefined)
  const initialModuleTicket = initialRouteType
    ? initialTickets.find((ticket) => ticket.type === initialRouteType)
    : undefined
  const [selectedTicketId, setSelectedTicketId] = useState(
    initialWorkspaceRoute.recordId || initialModuleTicket?.id || initialTickets[0]?.id || seedTickets[0].id,
  )
  const [query, setQuery] = useState(initialActiveTab.query || '')
  const [filters, setFilters] = useState(
    initialActiveTab.filter || allTicketFilters(),
  )
  const [toast, setToast] = useState('')
  const [newComment, setNewComment] = useState('')
  const [portalQuery, setPortalQuery] = useState('')
  const [loginMode, setLoginMode] = useState('analyst')
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [ticketDraft, setTicketDraft] = useState(() => emptyTicketDraft(initialRouteType || 'Incident'))
  const [portalDraft, setPortalDraft] = useState({
    requester: initialSession?.role === 'requester' ? initialSession.name : '',
    email: initialSession?.role === 'requester' ? loginProfiles.requester.username : '',
    category: 'Report an IT Issue',
    title: '',
    description: '',
    urgency: 'Medium',
  })

  const resolvedTheme = theme === 'system' ? systemTheme : theme

  useEffect(() => {
    saveTickets(tickets)
  }, [tickets])

  useEffect(() => {
    saveTheme(theme)
  }, [theme])

  useEffect(() => {
    saveAccent(accent)
  }, [accent])

  useEffect(() => {
    saveDensity(density)
  }, [density])

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return undefined

    const handleSystemThemeChange = (event) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }

    setSystemTheme(media.matches ? 'dark' : 'light')
    media.addEventListener?.('change', handleSystemThemeChange)
    return () => media.removeEventListener?.('change', handleSystemThemeChange)
  }, [])

  useEffect(() => {
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 680px)')
    if (!media) return undefined

    const handleWorkspaceScroll = (event) => {
      if (!media.matches) return

      const target = event.target
      const mainFrame = mainFrameRef.current

      if (!(target instanceof HTMLElement) || !mainFrame?.contains(target)) return
      if (target.classList.contains('tab-list')) return
      if (target.scrollHeight <= target.clientHeight + 4) return

      const maxScrollTop = Math.max(0, target.scrollHeight - target.clientHeight)
      const currentTop = Math.min(
        maxScrollTop,
        Math.max(0, target.scrollTop),
      )
      const previousTop = mobileScrollPositionsRef.current.get(target) ?? currentTop
      const delta = currentTop - previousTop

      mobileScrollPositionsRef.current.set(target, currentTop)

      if (currentTop <= 10) {
        setMobileHeaderHidden(false)
        return
      }

      if (delta > 5 && currentTop > 48) {
        setMobileHeaderHidden(true)
      } else if (delta < -3) {
        setMobileHeaderHidden(false)
      }
    }

    const handleViewportChange = () => {
      if (!media.matches) setMobileHeaderHidden(false)
    }

    document.addEventListener('scroll', handleWorkspaceScroll, true)
    media.addEventListener?.('change', handleViewportChange)

    return () => {
      document.removeEventListener('scroll', handleWorkspaceScroll, true)
      media.removeEventListener?.('change', handleViewportChange)
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 680px)')
    const mainFrame = mainFrameRef.current
    if (!media || !mainFrame || session?.role !== 'analyst') return undefined

    const PULL_THRESHOLD = 58
    const PULL_MAX = 96
    const REFRESH_HOLD = 48

    const setPullDistance = (distance) => {
      mainFrame.style.setProperty('--pull-refresh-distance', `${Math.max(0, distance)}px`)
    }

    const isScrollable = (element) => {
      if (!(element instanceof HTMLElement) || element.getClientRects().length === 0) return false

      const style = window.getComputedStyle(element)
      return (
        /(auto|scroll)/.test(style.overflowY) &&
        element.scrollHeight > element.clientHeight + 2
      )
    }

    const findScrollTarget = (element) => {
      let current = element instanceof HTMLElement ? element : element?.parentElement

      while (current && current !== mainFrame) {
        if (isScrollable(current)) return current
        current = current.parentElement
      }

      return null
    }

    const findActiveScrollTarget = () => {
      const workspace = mainFrame.querySelector('.workspace')
      if (!(workspace instanceof HTMLElement)) return null

      if (isScrollable(workspace)) return workspace

      return Array.from(workspace.querySelectorAll('*')).find(isScrollable) || null
    }

    const resetGesture = ({ animate = true } = {}) => {
      const gesture = pullRefreshGestureRef.current
      gesture.active = false
      gesture.engaged = false
      gesture.distance = 0
      gesture.scrollTarget = null
      setPullRefreshArmed(false)
      setPullRefreshDragging(false)

      if (animate) {
        window.requestAnimationFrame(() => setPullDistance(0))
      } else {
        setPullDistance(0)
      }
    }

    const finishRefresh = () => {
      pullRefreshGestureRef.current.refreshing = false
      setTickets(loadTickets())
      setPullRefreshing(false)
      setPullRefreshArmed(false)
      setToast('Workspace refreshed')
      window.requestAnimationFrame(() => setPullDistance(0))
    }

    const beginRefresh = () => {
      pullRefreshGestureRef.current.refreshing = true
      setPullRefreshDragging(false)
      setPullRefreshArmed(false)
      setPullRefreshing(true)
      setMobileHeaderHidden(false)
      setPullDistance(REFRESH_HOLD)

      if (pullRefreshTimerRef.current) {
        window.clearTimeout(pullRefreshTimerRef.current)
      }

      pullRefreshTimerRef.current = window.setTimeout(finishRefresh, 650)
    }

    const handleTouchStart = (event) => {
      if (
        !media.matches ||
        pullRefreshGestureRef.current.refreshing ||
        event.touches.length !== 1
      ) return

      const rawTarget = event.target
      if (!(rawTarget instanceof Element) || !mainFrame.contains(rawTarget)) return

      const target = rawTarget instanceof HTMLElement ? rawTarget : rawTarget.parentElement
      if (!target) return

      const inWorkspace = Boolean(target.closest('.workspace'))
      const inBreadcrumbs = Boolean(target.closest('.breadcrumbs'))
      if (!inWorkspace && !inBreadcrumbs) return

      // The tab strip remains horizontal-swipe only. Form controls should also
      // keep their native touch behaviour. Breadcrumbs, however, are a valid
      // top-edge pull target on compact mobile layouts.
      if (target.closest('.tab-list, .mobile-topbar, .sidebar, input, textarea, select')) return

      const scrollTarget = findScrollTarget(target) || findActiveScrollTarget()
      if (scrollTarget && scrollTarget.scrollTop > 1) return

      const touch = event.touches[0]
      pullRefreshGestureRef.current = {
        active: true,
        engaged: false,
        startX: touch.clientX,
        startY: touch.clientY,
        distance: 0,
        scrollTarget,
        refreshing: false,
      }
    }

    const handleTouchMove = (event) => {
      const gesture = pullRefreshGestureRef.current
      if (!gesture.active || gesture.refreshing || event.touches.length !== 1) return

      if (gesture.scrollTarget && gesture.scrollTarget.scrollTop > 1) {
        resetGesture()
        return
      }

      const touch = event.touches[0]
      const deltaX = touch.clientX - gesture.startX
      const deltaY = touch.clientY - gesture.startY

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
        resetGesture()
        return
      }

      if (deltaY <= 0) {
        if (gesture.engaged) resetGesture()
        return
      }

      if (deltaY < 5) return

      // Capture the vertical gesture before iOS Safari turns it into its
      // native rubber-band / browser pull-to-refresh behaviour.
      if (event.cancelable) event.preventDefault()
      event.stopPropagation()
      setMobileHeaderHidden(false)

      if (!gesture.engaged) {
        gesture.engaged = true
        setPullRefreshDragging(true)
      }

      const resistedDistance = Math.min(PULL_MAX, deltaY * 0.52)
      gesture.distance = resistedDistance
      setPullDistance(resistedDistance)

      const armed = resistedDistance >= PULL_THRESHOLD
      setPullRefreshArmed((current) => (current === armed ? current : armed))
    }

    const handleTouchEnd = () => {
      const gesture = pullRefreshGestureRef.current
      if (!gesture.active) return

      const shouldRefresh = gesture.engaged && gesture.distance >= PULL_THRESHOLD
      gesture.active = false
      gesture.engaged = false
      gesture.scrollTarget = null

      if (shouldRefresh) {
        beginRefresh()
        return
      }

      resetGesture()
    }

    const handleViewportChange = () => {
      if (!media.matches) {
        resetGesture({ animate: false })
        pullRefreshGestureRef.current.refreshing = false
        setPullRefreshing(false)
      }
    }

    // iOS Safari can keep the native elastic scroll gesture inside nested
    // overflow containers before an ancestor bubble listener gets a chance to
    // cancel it. Capture on document instead, then scope the gesture back to
    // the current Hi5Central main frame in handleTouchStart.
    document.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true, capture: true })
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true, capture: true })
    media.addEventListener?.('change', handleViewportChange)

    return () => {
      document.removeEventListener('touchstart', handleTouchStart, true)
      document.removeEventListener('touchmove', handleTouchMove, true)
      document.removeEventListener('touchend', handleTouchEnd, true)
      document.removeEventListener('touchcancel', handleTouchEnd, true)
      media.removeEventListener?.('change', handleViewportChange)
      resetGesture({ animate: false })
      if (pullRefreshTimerRef.current) {
        window.clearTimeout(pullRefreshTimerRef.current)
      }
    }
  }, [session?.role])

  useEffect(() => {
    setMobileHeaderHidden(false)
  }, [activeTabKey, mobileNavOpen])

  useEffect(() => {
    saveSidebarMode(sidebarMode)
  }, [sidebarMode])

  useEffect(() => {
    saveSession(session)
  }, [session])

  useEffect(() => {
    if (session?.role !== 'analyst') return
    saveWorkspace({ tabs: tabs.slice(-MAX_WORKSPACE_TABS), activeTabKey })
  }, [activeTabKey, session?.role, tabs])

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
      const currentTab = tabs.find((tab) => tab.key === activeTabKey)
      const leavingDirtyDraft =
        currentTab?.viewId === 'newrecord' &&
        route.key !== currentTab.key &&
        isTicketDraftDirty(ticketDraft, currentTab.newRecordType)

      if (leavingDirtyDraft) {
        const confirmed = window.confirm('You have unsaved changes. Leave this record without saving?')
        if (!confirmed) {
          writeRoute(pathForTab(currentTab, tickets), { replace: true })
          return
        }
        setTicketDraft(emptyTicketDraft(currentTab.newRecordType || ticketDraft.type))
      }

      if (route.path !== currentRoute.path) {
        writeRoute(route.path, { replace: true })
      }

      const tab = tabFromRoute(route)

      if (route.recordId) {
        setSelectedTicketId(route.recordId)
      } else if (route.newRecordType) {
        setTicketDraft((currentDraft) => ({ ...currentDraft, type: route.newRecordType }))
      } else if (route.filter?.type && route.filter.type !== 'All') {
        const firstModuleTicket = tickets.find((ticket) => ticket.type === route.filter.type)
        if (firstModuleTicket) setSelectedTicketId(firstModuleTicket.id)
        setTicketDraft((currentDraft) => ({ ...currentDraft, type: route.filter.type }))
      }
      if (route.filter) {
        setFilters(route.filter)
      }
      if (route.query !== undefined) {
        setQuery(route.query)
      }

      setTabs((currentTabs) => addWorkspaceTab(currentTabs, tab))
      setActiveTabKey(tab.key)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [activeTabKey, session, tabs, ticketDraft, tickets])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const list = tabListRef.current
    const activeTabElement = list
      ? Array.from(list.children).find((element) => element.dataset?.tabKey === activeTabKey)
      : undefined
    if (!list || !activeTabElement) return

    const left = activeTabElement.offsetLeft
    const right = left + activeTabElement.offsetWidth
    const visibleLeft = list.scrollLeft
    const visibleRight = visibleLeft + list.clientWidth

    if (left < visibleLeft || right > visibleRight) {
      list.scrollTo({
        left: Math.max(0, left - 12),
        behavior: 'smooth',
      })
    }
  }, [activeTabKey, tabs.length])

  const activeTab = tabs.find((tab) => tab.key === activeTabKey) || tabs[0]
  const activeView = activeTab?.viewId || 'home'
  const activeModule = serviceDeskModules[activeView]
  const activeModuleType = activeModule?.type
  const activeHasUnsavedChanges =
    activeView === 'newrecord' && isTicketDraftDirty(ticketDraft, activeTab?.newRecordType)

  useEffect(() => {
    if (!activeHasUnsavedChanges) return undefined

    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [activeHasUnsavedChanges])

  useEffect(() => {
    if (!(activeView === 'tickets' || serviceDeskModules[activeView])) return

    setTabs((currentTabs) =>
      currentTabs.map((tab) => {
        if (tab.key !== activeTabKey) return tab

        const currentFilter = tab.filter || {}
        const filterUnchanged =
          currentFilter.status === filters.status &&
          currentFilter.priority === filters.priority &&
          currentFilter.type === filters.type
        const queryUnchanged = (tab.query || '') === query

        if (filterUnchanged && queryUnchanged) return tab
        return { ...tab, filter: { ...filters }, query }
      }),
    )
  }, [activeTabKey, activeView, filters, query])

  const selectedTicket =
    tickets.find((ticket) => ticket.id === (activeTab?.recordId || selectedTicketId)) ||
    (activeModuleType ? tickets.find((ticket) => ticket.type === activeModuleType) : undefined) ||
    tickets[0]
  const selectedAsset = activeTab?.assetId
    ? assets.find((asset) => asset.id === activeTab.assetId)
    : undefined
  const selectedArticle = activeTab?.articleSlug
    ? knowledgeArticles.find((article) => article.slug === activeTab.articleSlug)
    : undefined
  const selectedPortalRequest = activeTab?.portalRequestId
    ? tickets.find((ticket) => ticket.id === activeTab.portalRequestId)
    : undefined
  const navItems = analystNavIds.map((id) => viewMeta[id])
  const navGroups = analystNavGroups.map((group) => ({
    ...group,
    items: group.items.map((id) => viewMeta[id]),
  }))
  const activeNavId =
    activeView === 'tickets' && activeTab?.recordId
      ? {
          Incident: 'incidents',
          'Service Request': 'requests',
          Problem: 'problems',
          Change: 'changes',
        }[selectedTicket?.type]
      : activeView === 'newrecord'
        ? activeTab?.navId || {
            Incident: 'incidents',
            'Service Request': 'requests',
            Problem: 'problems',
            Change: 'changes',
          }[activeTab?.newRecordType]
        : activeView
  const breadcrumbs = getBreadcrumbs(activeTab, selectedTicket, selectedAsset, selectedArticle)
  const sidebarCollapsed = sidebarMode === 'collapsed'
  const sidebarHidden = sidebarMode === 'hidden'

  useEffect(() => {
    const title = activeTab?.title || 'Hi5Central'
    document.title = title === 'Hi5Central' ? title : `${title} · Hi5Central`
  }, [activeTab?.title])

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
      const matchesType = activeModuleType
        ? ticket.type === activeModuleType
        : filters.type === 'All' || ticket.type === filters.type
      return matchesQuery && matchesStatus && matchesPriority && matchesType
    })
  }, [activeModuleType, filters, query, tickets])

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

  function confirmLeavingDraft() {
    if (!activeHasUnsavedChanges) return true

    const confirmed = window.confirm('You have unsaved changes. Leave this record without saving?')
    if (confirmed) {
      setTicketDraft(emptyTicketDraft(activeTab?.newRecordType || ticketDraft.type))
    }
    return confirmed
  }

  function openTab(viewId, overrides = {}, navigation = {}) {
    const moduleConfig = serviceDeskModules[viewId]
    let normalizedOverrides = overrides

    if (moduleConfig && !overrides.recordId) {
      normalizedOverrides = {
        key: moduleConfig.id,
        title: moduleConfig.label,
        filter: { ...allTicketFilters(), type: moduleConfig.type },
        query: '',
        ...overrides,
      }
    } else if (viewId === 'settings' && !overrides.settingsSection) {
      normalizedOverrides = {
        ...overrides,
        key: 'settings-appearance',
        title: 'Appearance',
        settingsSection: 'appearance',
      }
    } else if (viewId === 'tickets' && !overrides.recordId && !overrides.filter && !overrides.key) {
      normalizedOverrides = {
        ...overrides,
        key: 'tickets',
        title: 'All Records',
        filter: allTicketFilters(),
        query: '',
      }
    }

    const tab = makeTab(viewId, normalizedOverrides)
    if (
      tab.key !== activeTabKey &&
      navigation.skipUnsavedCheck !== true &&
      !confirmLeavingDraft()
    ) {
      return
    }

    if (normalizedOverrides.recordId) {
      setSelectedTicketId(normalizedOverrides.recordId)
    } else if (normalizedOverrides.newRecordType) {
      setTicketDraft((currentDraft) => ({ ...currentDraft, type: normalizedOverrides.newRecordType }))
    } else if (moduleConfig) {
      const firstModuleTicket = tickets.find((ticket) => ticket.type === moduleConfig.type)
      if (firstModuleTicket) setSelectedTicketId(firstModuleTicket.id)
      setTicketDraft((currentDraft) => ({ ...currentDraft, type: moduleConfig.type }))
    }
    if (normalizedOverrides.filter) {
      setFilters((currentFilters) => ({ ...currentFilters, ...normalizedOverrides.filter }))
    }
    if (normalizedOverrides.query !== undefined) {
      setQuery(normalizedOverrides.query)
    }
    setTabs((currentTabs) => {
      let nextTabs = addWorkspaceTab(currentTabs, tab)
      if (navigation.replaceTabKey && navigation.replaceTabKey !== tab.key) {
        nextTabs = nextTabs.filter((currentTab) => currentTab.key !== navigation.replaceTabKey)
      }
      return nextTabs
    })
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
      assetId: crumb.assetId,
      articleSlug: crumb.articleSlug,
      settingsSection: crumb.settingsSection,
      newRecordType: crumb.newRecordType,
      title: crumb.title,
    })
  }

  function openNewRecord(recordType = 'Incident', navigation = {}) {
    const config = {
      Incident: { navId: 'incidents', section: 'incidents', title: 'New Incident' },
      'Service Request': { navId: 'requests', section: 'requests', title: 'New Service Request' },
      Problem: { navId: 'problems', section: 'problems', title: 'New Problem' },
      Change: { navId: 'changes', section: 'changes', title: 'New Change' },
    }[recordType] || { navId: 'incidents', section: 'incidents', title: 'New Incident' }

    openTab(
      'newrecord',
      {
        key: `new-${config.section}`,
        title: config.title,
        newRecordType: recordType,
        navId: config.navId,
      },
      navigation,
    )
  }

  function openAsset(asset) {
    openTab('cmdb', {
      key: `asset-${asset.id}`,
      title: asset.name,
      assetId: asset.id,
    })
  }

  function openAssetByName(assetName) {
    const asset = assets.find((item) => item.name === assetName || item.id === assetName)
    if (!asset) {
      setToast(`${assetName} is not in the prototype CMDB yet`)
      return
    }
    openAsset(asset)
  }

  function openArticle(article) {
    openTab('knowledge', {
      key: `knowledge-${article.slug}`,
      title: article.title,
      articleSlug: article.slug,
    })
  }

  function openSettingsSection(section) {
    openTab('settings', {
      key: `settings-${section}`,
      title: settingsSectionTitles[section] || 'Settings',
      settingsSection: section,
    })
  }

  function openPortalRequest(ticket) {
    const tab = makeTab('portal', {
      key: `portal-request-${ticket.id}`,
      title: ticket.id,
      portalRequestId: ticket.id,
    })
    setTabs((currentTabs) =>
      currentTabs.some((currentTab) => currentTab.key === tab.key)
        ? currentTabs
        : [...currentTabs, tab],
    )
    setActiveTabKey(tab.key)
    writeRoute(pathForTab(tab, tickets))
  }

  function openPortalHome() {
    const tab = makeTab('portal', { key: 'portal', title: 'Self-Service', pinned: true })
    setTabs((currentTabs) =>
      currentTabs.some((currentTab) => currentTab.key === tab.key)
        ? currentTabs
        : [...currentTabs, tab],
    )
    setActiveTabKey(tab.key)
    writeRoute('/portal')
  }

  function openSidebarTab(viewId) {
    openTab(viewId)
    setMobileNavOpen(false)
  }

  function openNewTab() {
    if (!confirmLeavingDraft()) return

    const key = `newtab-${Date.now()}`
    const tab = makeTab('newtab', { key, title: 'New Tab' })
    setTabs((currentTabs) => addWorkspaceTab(currentTabs, tab))
    setActiveTabKey(key)
    writeRoute(pathForTab(tab, tickets))
  }

  function activateTab(tab) {
    if (tab.key === activeTabKey) return
    if (!confirmLeavingDraft()) return

    if (tab.recordId) {
      setSelectedTicketId(tab.recordId)
    } else if (tab.newRecordType) {
      setTicketDraft((currentDraft) => ({ ...currentDraft, type: tab.newRecordType }))
    } else if (serviceDeskModules[tab.viewId]) {
      const moduleConfig = serviceDeskModules[tab.viewId]
      const firstModuleTicket = tickets.find((ticket) => ticket.type === moduleConfig.type)
      if (firstModuleTicket) setSelectedTicketId(firstModuleTicket.id)
      setTicketDraft((currentDraft) => ({ ...currentDraft, type: moduleConfig.type }))
      setFilters(tab.filter || { ...allTicketFilters(), type: moduleConfig.type })
      setQuery(tab.query || '')
    } else if (tab.viewId === 'tickets') {
      setFilters(tab.filter || allTicketFilters())
      setQuery(tab.query || '')
    }
    setActiveTabKey(tab.key)
    writeRoute(pathForTab(tab, tickets))
  }

  function closeTab(key) {
    if (key === activeTabKey && !confirmLeavingDraft()) return

    const index = tabs.findIndex((tab) => tab.key === key)
    const nextTabs = tabs.filter((tab) => tab.key !== key)
    if (!nextTabs.length) return
    setTabs(nextTabs)
    if (activeTabKey === key) {
      const fallbackIndex = Math.max(0, index - 1)
      const fallbackTab = nextTabs[fallbackIndex] || nextTabs[0]
      if (fallbackTab.recordId) {
        setSelectedTicketId(fallbackTab.recordId)
      } else if (fallbackTab.newRecordType) {
        setTicketDraft((currentDraft) => ({ ...currentDraft, type: fallbackTab.newRecordType }))
      } else if (serviceDeskModules[fallbackTab.viewId]) {
        const moduleConfig = serviceDeskModules[fallbackTab.viewId]
        const firstModuleTicket = tickets.find((ticket) => ticket.type === moduleConfig.type)
        if (firstModuleTicket) setSelectedTicketId(firstModuleTicket.id)
        setTicketDraft((currentDraft) => ({ ...currentDraft, type: moduleConfig.type }))
        setFilters(fallbackTab.filter || { ...allTicketFilters(), type: moduleConfig.type })
        setQuery(fallbackTab.query || '')
      } else if (fallbackTab.viewId === 'tickets') {
        setFilters(fallbackTab.filter || allTicketFilters())
        setQuery(fallbackTab.query || '')
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

  function addComment(noteMode = 'work') {
    if (!newComment.trim() || !selectedTicket) return
    const prefix = noteMode === 'customer' ? 'Customer comment: ' : 'Work note: '
    updateTicket(selectedTicket.id, {
      comments: [`${prefix}${newComment.trim()} - added now`, ...selectedTicket.comments],
    })
    setNewComment('')
    setToast(`${noteMode === 'customer' ? 'Customer comment' : 'Work note'} added to ${selectedTicket.id}`)
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
      requesterId: ticketDraft.requesterId || undefined,
      requesterEmail: ticketDraft.requesterEmail || undefined,
      requesterStaffNumber: ticketDraft.requesterStaffNumber || undefined,
      requesterJobTitle: ticketDraft.requesterJobTitle || undefined,
      requesterDepartment: ticketDraft.requesterDepartment || undefined,
      requesterManager: ticketDraft.requesterManager || undefined,
      impact: ticketDraft.impact || undefined,
      urgency: ticketDraft.urgency || undefined,
      priority: ticketDraft.priority,
      category: ticketDraft.category || undefined,
      status: ticketDraft.type === 'Change' ? 'Pending Approval' : 'New',
      team: ticketDraft.team,
      assignee: 'Unassigned',
      service: ticketDraft.service,
      location: ticketDraft.requesterLocation || 'Unconfirmed',
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
    setTicketDraft(emptyTicketDraft(createdTicket.type))

    const createdTab = makeTab('tickets', {
      key: `ticket-${createdTicket.id}`,
      title: createdTicket.id,
      recordId: createdTicket.id,
    })

    if (activeView === 'newrecord') {
      setTabs((currentTabs) =>
        currentTabs.map((tab) => (tab.key === activeTabKey ? createdTab : tab)),
      )
      setActiveTabKey(createdTab.key)
      setSelectedTicketId(createdTicket.id)
      writeRoute(pathForTab(createdTab, [createdTicket, ...tickets]), { replace: true })
    } else {
      openTab(
        'tickets',
        { key: createdTab.key, title: createdTab.title, recordId: createdTab.recordId },
        { skipUnsavedCheck: true },
      )
    }

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
    if (session?.role === 'requester') {
      openPortalRequest(createdTicket)
    }
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
    const explicitWorkspaceRoute = initialRoute.kind === 'workspace'
    const requestedRoute = explicitWorkspaceRoute
      ? resolveRouteForRole(initialRoute, profile.role)
      : defaultRouteForRole(profile.role)
    const requestedTab = tabFromRoute(requestedRoute)
    const storedWorkspace = profile.role === 'analyst' ? loadWorkspace() : null
    const savedActiveTab = !explicitWorkspaceRoute
      ? storedWorkspace?.tabs?.find((tab) => tab.key === storedWorkspace.activeTabKey)
      : null
    const activeLoginTab = savedActiveTab
      ? makeTab(savedActiveTab.viewId, savedActiveTab)
      : requestedTab
    const nextTabs = profile.role === 'analyst'
      ? restoreWorkspaceTabs(storedWorkspace, activeLoginTab)
      : [requestedTab]

    setSession(nextSession)
    setLoginError('')
    setTabs(nextTabs)
    setActiveTabKey(activeLoginTab.key)

    if (activeLoginTab.recordId) {
      setSelectedTicketId(activeLoginTab.recordId)
    } else if (activeLoginTab.newRecordType) {
      setTicketDraft(emptyTicketDraft(activeLoginTab.newRecordType))
    } else if (serviceDeskModules[activeLoginTab.viewId]) {
      const moduleConfig = serviceDeskModules[activeLoginTab.viewId]
      const firstModuleTicket = tickets.find((ticket) => ticket.type === moduleConfig.type)
      if (firstModuleTicket) setSelectedTicketId(firstModuleTicket.id)
      setTicketDraft(emptyTicketDraft(moduleConfig.type))
    }

    if (activeLoginTab.filter) {
      setFilters(activeLoginTab.filter)
    } else if (serviceDeskModules[activeLoginTab.viewId]) {
      setFilters({ ...allTicketFilters(), type: serviceDeskModules[activeLoginTab.viewId].type })
    } else {
      setFilters(allTicketFilters())
    }
    setQuery(activeLoginTab.query || '')

    setPortalDraft({
      requester: profile.role === 'requester' ? profile.name : '',
      email: profile.role === 'requester' ? profile.username : '',
      category: 'Report an IT Issue',
      title: '',
      description: '',
      urgency: 'Medium',
    })

    const nextPath = profile.role === 'analyst'
      ? pathForTab(activeLoginTab, tickets)
      : requestedRoute.path
    writeRoute(nextPath, { replace: true })
    setToast(`Signed in as ${profile.label}`)
  }

  function fillCredentials(mode) {
    const profile = loginProfiles[mode]
    setLoginMode(mode)
    setLoginForm({ username: profile.username, password: profile.password })
    setLoginError('')
  }

  function handleLogout() {
    if (!confirmLeavingDraft()) return

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
          openNewRecord={(recordType) =>
            openNewRecord(recordType, { replaceTabKey: activeTab.key })
          }
          openRecordTab={(ticket) =>
            openTab(
              'tickets',
              { key: `ticket-${ticket.id}`, title: ticket.id, recordId: ticket.id },
              { replaceTabKey: activeTab.key },
            )
          }
          openTab={(viewId) => openTab(viewId, {}, { replaceTabKey: activeTab.key })}
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

    if (activeView === 'newrecord') {
      return (
        <NewRecordView
          handleTicketSubmit={handleTicketSubmit}
          hasUnsavedChanges={activeHasUnsavedChanges}
          recordType={activeTab.newRecordType || ticketDraft.type}
          setTicketDraft={setTicketDraft}
          ticketDraft={ticketDraft}
        />
      )
    }

    if (activeView === 'tickets' && activeTab?.recordId) {
      return (
        <TicketRecordView
          addComment={addComment}
          newComment={newComment}
          openAssetByName={openAssetByName}
          selectedTicket={selectedTicket}
          setNewComment={setNewComment}
          updateTicket={updateTicket}
        />
      )
    }

    if (activeView === 'tickets' || serviceDeskModules[activeView]) {
      return (
        <TicketsView
          addComment={addComment}
          filters={filters}
          filteredTickets={filteredTickets}
          handleTicketSubmit={handleTicketSubmit}
          moduleConfig={serviceDeskModules[activeView]}
          newComment={newComment}
          openNewRecord={openNewRecord}
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
          openPortalRequest={openPortalRequest}
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
          openNewRecord={openNewRecord}
          openRecordTab={(ticket) =>
            openTab('tickets', { key: `ticket-${ticket.id}`, title: ticket.id, recordId: ticket.id })
          }
          tickets={tickets.filter((ticket) => ticket.type === 'Change')}
        />
      )
    }

    if (activeView === 'cmdb') {
      if (selectedAsset) {
        return (
          <CmdbRecordView
            asset={selectedAsset}
            openRecordTab={(ticket) =>
              openTab('tickets', { key: `ticket-${ticket.id}`, title: ticket.id, recordId: ticket.id })
            }
            tickets={tickets}
          />
        )
      }
      return <CmdbView assets={assets} openAsset={openAsset} tickets={tickets} />
    }

    if (activeView === 'knowledge') {
      if (selectedArticle) {
        return <KnowledgeArticleView article={selectedArticle} />
      }
      return (
        <KnowledgeView
          openArticle={openArticle}
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
        accent={accent}
        density={density}
        openSettingsSection={openSettingsSection}
        resolvedTheme={resolvedTheme}
        session={session}
        setAccent={setAccent}
        setDensity={setDensity}
        setSidebarMode={setSidebarMode}
        setTheme={setTheme}
        settingsSection={activeTab?.settingsSection || 'appearance'}
        sidebarMode={sidebarMode}
        theme={theme}
      />
    )
  }

  if (!session) {
    return (
      <LoginScreen
        accent={accent}
        fillCredentials={fillCredentials}
        loginError={loginError}
        loginForm={loginForm}
        loginMode={loginMode}
        onLogin={handleLogin}
        setLoginForm={setLoginForm}
        setLoginMode={setLoginMode}
        setTheme={setTheme}
        theme={resolvedTheme}
      />
    )
  }

  if (session.role === 'requester') {
    return (
      <SelfServiceShell
        accent={accent}
        activeRequest={selectedPortalRequest}
        currentUser={session}
        handleLogout={handleLogout}
        handlePortalSubmit={handlePortalSubmit}
        openPortalHome={openPortalHome}
        openPortalRequest={openPortalRequest}
        portalDraft={portalDraft}
        portalQuery={portalQuery}
        portalResults={portalResults}
        serviceCatalog={serviceCatalog}
        setPortalDraft={setPortalDraft}
        setPortalQuery={setPortalQuery}
        setTheme={setTheme}
        theme={resolvedTheme}
        tickets={tickets}
        toast={toast}
      />
    )
  }

  return (
    <div
      className={[
        `app-shell sidebar-${sidebarMode} density-${density}`,
        mobileHeaderHidden ? 'mobile-header-hidden' : '',
      ].filter(Boolean).join(' ')}
      data-accent={accent}
      data-theme={resolvedTheme}
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
          <button className="mobile-icon-action mobile-new-ticket" onClick={() => openNewRecord('Incident')} title="New incident" type="button">
            <Plus size={18} aria-hidden="true" />
          </button>
          <button
            className="mobile-icon-action"
            onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
            title={resolvedTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            type="button"
          >
            {resolvedTheme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
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
          {navGroups.map((group) => {
            const groupIsActive = group.items.some(({ id }) => id === activeNavId)

            return (
              <div
                className={[
                  'nav-group',
                  group.separated ? 'nav-group-separated' : '',
                  groupIsActive ? 'nav-group-active' : '',
                ].filter(Boolean).join(' ')}
                key={group.id}
              >
                {group.label && <span className="nav-group-label">{group.label}</span>}
                {group.items.map(({ id, label, icon: Icon }) => {
                  const itemIsActive = activeNavId === id

                  return (
                    <button
                      aria-current={itemIsActive ? 'page' : undefined}
                      className={itemIsActive ? 'nav-item active' : 'nav-item'}
                      key={id}
                      onClick={() => openSidebarTab(id)}
                      title={label}
                      type="button"
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
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

      <section
        className={[
          'main-frame',
          pullRefreshDragging ? 'pull-refresh-dragging' : '',
          pullRefreshArmed ? 'pull-refresh-armed' : '',
          pullRefreshing ? 'pull-refresh-refreshing' : '',
        ].filter(Boolean).join(' ')}
        ref={mainFrameRef}
      >
        <div
          aria-live="polite"
          className="pull-refresh-indicator"
          role="status"
        >
          <span className="pull-refresh-icon" aria-hidden="true">
            {pullRefreshing ? <RefreshCw size={16} /> : <ArrowDown size={16} />}
          </span>
          <span>
            {pullRefreshing
              ? 'Refreshing…'
              : pullRefreshArmed
                ? 'Release to refresh'
                : 'Pull to refresh'}
          </span>
        </div>

        <header className="tabbar" aria-label="Open workspace tabs">
          <button
            aria-label="Open Hi5Central navigation"
            className="tabbar-brand"
            onClick={() => setMobileNavOpen(true)}
            title="Open navigation"
            type="button"
          >
            <img src={`${import.meta.env.BASE_URL}hi5central-logo.png`} alt="" aria-hidden="true" />
          </button>

          <div className="tab-list" ref={tabListRef}>
            {tabs.map((tab) => (
                <button
                  className={[
                    'workspace-tab',
                    activeTabKey === tab.key ? 'active' : '',
                    activeTabKey === tab.key && activeHasUnsavedChanges ? 'dirty' : '',
                  ].filter(Boolean).join(' ')}
                  data-tab-key={tab.key}
                  key={tab.key}
                  onClick={() => activateTab(tab)}
                  type="button"
                >
                  <span className="workspace-tab-label">
                    {tab.title}
                    {activeTabKey === tab.key && activeHasUnsavedChanges && (
                      <span className="unsaved-dot" aria-label="Unsaved changes" />
                    )}
                  </span>
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
              onClick={() => openNewRecord('Incident')}
              type="button"
            >
              <Plus size={16} aria-hidden="true" />
              New Incident
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
              onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
              title={resolvedTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              type="button"
            >
              {resolvedTheme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
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
