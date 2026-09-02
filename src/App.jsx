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
import { workPeople, workTeams } from './data/workPlanningData.js'
import { liveChatReplyOptions } from './data/liveChatData.js'
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
  loadCalendarEvents,
  loadDensity,
  loadLiveChatConversations,
  loadLiveChatPreferences,
  loadSession,
  loadSidebarMode,
  loadTheme,
  loadTickets,
  loadProjects,
  loadRotaEntries,
  loadWorkspace,
  saveAccent,
  saveCalendarEvents,
  saveDensity,
  saveLiveChatConversations,
  saveLiveChatPreferences,
  saveSession,
  saveSidebarMode,
  saveTheme,
  saveTickets,
  saveProjects,
  saveRotaEntries,
  saveWorkspace,
} from './services/demoStore.js'
import { CalendarView } from './features/calendar/CalendarView.jsx'
import { ProjectManagementView } from './features/projects/ProjectViews.jsx'
import { RotaView } from './features/rota/RotaView.jsx'
import { LiveChatView } from './features/live-chat/LiveChatView.jsx'
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

function workspaceTabModule(tab) {
  if (tab?.navId) return tab.navId
  if (tab?.projectId) return 'projects'

  const recordId = String(tab?.recordId || '').toUpperCase()
  if (recordId.startsWith('INC-')) return 'incidents'
  if (recordId.startsWith('REQ-')) return 'requests'
  if (recordId.startsWith('PRB-')) return 'problems'
  if (recordId.startsWith('CHG-')) return 'changes'

  if (tab?.newRecordType === 'Incident') return 'incidents'
  if (tab?.newRecordType === 'Service Request') return 'requests'
  if (tab?.newRecordType === 'Problem') return 'problems'
  if (tab?.newRecordType === 'Change') return 'changes'

  return tab?.viewId || 'tickets'
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
    // The workspace launcher is a singleton. Older builds created timestamped
    // /new-tab/:key routes; canonicalise all of them back to one tab identity.
    key: route.viewId === 'newtab' ? NEW_TAB_KEY : route.key,
    title: asset?.name || article?.title || route.title,
    pinned: route.viewId === 'home' || route.viewId === 'livechat' || (route.viewId === 'portal' && !route.portalRequestId),
    recordId: route.recordId,
    assetId: route.assetId,
    articleSlug: route.articleSlug,
    projectId: route.projectId,
    portalRequestId: route.portalRequestId,
    settingsSection: route.settingsSection,
    newRecordType: route.newRecordType,
    navId: route.navId,
    filter: route.filter,
    query: route.query,
  })
}

const demoNotifications = [
  {
    id: 'sla-inc-1032',
    title: 'SLA at risk',
    detail: 'INC-1032 has 43 minutes remaining on its resolution target.',
    recordId: 'INC-1032',
    meta: '8 min ago',
    tone: 'critical',
    read: false,
  },
  {
    id: 'approval-req-2217',
    title: 'Approval required',
    detail: 'REQ-2217 is waiting for an approval before fulfilment can continue.',
    recordId: 'REQ-2217',
    meta: '18 min ago',
    tone: 'warning',
    read: false,
  },
  {
    id: 'change-chg-0891',
    title: 'Change window approaching',
    detail: 'CHG-0891 is scheduled for implementation this evening.',
    recordId: 'CHG-0891',
    meta: '42 min ago',
    tone: 'info',
    read: true,
  },
]

const MAX_WORKSPACE_TABS = 12
const NEW_TAB_KEY = 'newtab'
const LIVE_CHAT_TAB_KEY = 'livechat'

function liveChatTab() {
  return makeTab('livechat', { key: LIVE_CHAT_TAB_KEY, title: 'Live Chat', pinned: true })
}

function syncLiveChatFixedTab(currentTabs, enabled) {
  const withoutLiveChat = currentTabs.filter((tab) => tab.key !== LIVE_CHAT_TAB_KEY)
  if (!enabled) {
    return withoutLiveChat.length
      ? withoutLiveChat
      : [makeTab('home', { key: 'home', title: 'Dashboard', pinned: true })]
  }

  const fixedTab = liveChatTab()
  const homeIndex = withoutLiveChat.findIndex((tab) => tab.key === 'home')
  const insertAt = homeIndex >= 0 ? homeIndex + 1 : 0
  const nextTabs = [...withoutLiveChat]
  nextTabs.splice(insertAt, 0, fixedTab)

  if (nextTabs.length <= MAX_WORKSPACE_TABS) return nextTabs

  const removableIndex = nextTabs.findLastIndex?.((tab) => !tab.pinned) ?? -1
  if (removableIndex >= 0) nextTabs.splice(removableIndex, 1)
  return nextTabs.slice(0, MAX_WORKSPACE_TABS)
}

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
    requestTemplateId: '',
    requestedItems: [],
    requestApprovals: [],
    requestTasks: [],
    requestCostCentre: '',
    requestRequiredBy: '',
    problemImpactScope: '',
    problemHypothesis: '',
    problemWorkaround: '',
    problemRootCause: '',
    problemPermanentFix: '',
    problemRelatedIncidentsText: '',
    changeType: 'Normal',
    changeRisk: 'Medium',
    changeApprovalRoute: 'CAB',
    changeBusinessReason: '',
    changeImplementationPlan: '',
    changeTestPlan: '',
    changeBackoutPlan: '',
    changePlannedStart: '',
    changePlannedEnd: '',
    changeDowntime: 'No outage expected',
    changeAffectedCisText: '',
  }
}

function isTicketDraftDirty(draft, type = draft?.type || 'Incident') {
  if (!draft) return false
  const baseline = emptyTicketDraft(type)
  return Object.keys(baseline).some((key) => {
    if (key === 'type') return false
    const current = draft[key]
    const initial = baseline[key]
    if (Array.isArray(current) || Array.isArray(initial)) {
      return JSON.stringify(current || []) !== JSON.stringify(initial || [])
    }
    return current !== initial
  })
}

function restoreWorkspaceTabs(workspace, routeTab) {
  const normalizeWorkspaceTab = (tab) =>
    tab?.viewId === 'newtab'
      ? makeTab('newtab', { ...tab, key: NEW_TAB_KEY, title: 'New Tab' })
      : tab

  const normalizedRouteTab = normalizeWorkspaceTab(routeTab)
  const savedTabs = Array.isArray(workspace?.tabs)
    ? workspace.tabs
        .filter((tab) => tab && typeof tab.key === 'string' && typeof tab.viewId === 'string')
        .map((tab) => normalizeWorkspaceTab(makeTab(tab.viewId, tab)))
    : []

  // This also cleans up duplicate launcher tabs persisted by older builds.
  const deduped = savedTabs.filter(
    (tab, index, list) => list.findIndex((candidate) => candidate.key === tab.key) === index,
  )

  if (!deduped.some((tab) => tab.key === normalizedRouteTab.key)) {
    deduped.push(normalizedRouteTab)
  }

  if (!deduped.length) return [normalizedRouteTab]
  if (deduped.length <= MAX_WORKSPACE_TABS) return deduped

  const essentials = deduped.filter((tab) => tab.pinned || tab.key === normalizedRouteTab.key)
  const recent = deduped
    .filter((tab) => !essentials.some((essential) => essential.key === tab.key))
    .slice(-(MAX_WORKSPACE_TABS - essentials.length))

  return [...essentials, ...recent].slice(-MAX_WORKSPACE_TABS)
}

function addWorkspaceTab(currentTabs, tab) {
  const normalizedTab =
    tab?.viewId === 'newtab'
      ? makeTab('newtab', { ...tab, key: NEW_TAB_KEY, title: 'New Tab' })
      : tab

  if (
    currentTabs.some(
      (currentTab) =>
        currentTab.key === normalizedTab.key ||
        (normalizedTab.viewId === 'newtab' && currentTab.viewId === 'newtab'),
    )
  ) {
    return currentTabs
  }

  const nextTabs = [...currentTabs, normalizedTab]
  if (nextTabs.length <= MAX_WORKSPACE_TABS) return nextTabs

  const removableIndex = nextTabs.findIndex(
    (currentTab) => !currentTab.pinned && currentTab.key !== normalizedTab.key,
  )
  if (removableIndex >= 0) nextTabs.splice(removableIndex, 1)

  return nextTabs.slice(-MAX_WORKSPACE_TABS)
}

function App() {
  const [initialTickets] = useState(loadTickets)
  const [initialProjects] = useState(loadProjects)
  const [initialRotaEntries] = useState(loadRotaEntries)
  const [initialCalendarEvents] = useState(loadCalendarEvents)
  const [initialLiveChatConversations] = useState(loadLiveChatConversations)
  const [initialLiveChatPreferences] = useState(loadLiveChatPreferences)
  const [initialSession] = useState(loadSession)
  const [initialWorkspace] = useState(loadWorkspace)
  const [initialRoute] = useState(routeFromLocation)
  const initialWorkspaceRoute = resolveRouteForRole(
    initialRoute,
    initialSession?.role || 'analyst',
  )
  const initialRouteTab = tabFromRoute(initialWorkspaceRoute)
  const restoredInitialTabs = initialSession?.role === 'analyst'
    ? restoreWorkspaceTabs(initialWorkspace, initialRouteTab)
    : [initialRouteTab]
  const initialTabs = initialSession?.role === 'analyst'
    ? syncLiveChatFixedTab(restoredInitialTabs, initialLiveChatPreferences.enabled)
    : restoredInitialTabs
  const initialActiveTab =
    initialTabs.find((tab) => tab.key === initialRouteTab.key) ||
    initialTabs.find((tab) => tab.key === initialWorkspace?.activeTabKey) ||
    initialTabs[0] ||
    initialRouteTab
  const [session, setSession] = useState(initialSession)
  const [theme, setTheme] = useState(loadTheme)
  const [systemTheme, setSystemTheme] = useState(getSystemTheme)
  const [accent, setAccent] = useState(loadAccent)
  const [sidebarMode, setSidebarMode] = useState(loadSidebarMode)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [pullRefreshDragging, setPullRefreshDragging] = useState(false)
  const [pullRefreshArmed, setPullRefreshArmed] = useState(false)
  const [pullRefreshing, setPullRefreshing] = useState(false)
  const [density, setDensity] = useState(loadDensity)
  const tabListRef = useRef(null)
  const mainFrameRef = useRef(null)
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
  const [projects, setProjects] = useState(initialProjects)
  const [rotaEntries, setRotaEntries] = useState(initialRotaEntries)
  const [calendarEvents, setCalendarEvents] = useState(initialCalendarEvents)
  const [liveChatConversations, setLiveChatConversations] = useState(initialLiveChatConversations)
  const [liveChatPreferences, setLiveChatPreferences] = useState(initialLiveChatPreferences)
  const [selectedLiveChatId, setSelectedLiveChatId] = useState(() => initialLiveChatConversations.find((conversation) => conversation.status !== 'Closed')?.id || initialLiveChatConversations[0]?.id || '')
  const [tabs, setTabs] = useState(initialTabs)
  const [activeTabKey, setActiveTabKey] = useState(initialActiveTab.key)
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
  const [notifications, setNotifications] = useState(demoNotifications)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('')
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [tabContextMenu, setTabContextMenu] = useState(null)
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
    saveProjects(projects)
  }, [projects])

  useEffect(() => {
    saveRotaEntries(rotaEntries)
  }, [rotaEntries])

  useEffect(() => {
    saveCalendarEvents(calendarEvents)
  }, [calendarEvents])

  useEffect(() => {
    saveLiveChatConversations(liveChatConversations)
  }, [liveChatConversations])

  useEffect(() => {
    saveLiveChatPreferences(liveChatPreferences)
  }, [liveChatPreferences])

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
    const media = window.matchMedia?.('(max-width: 680px) and (any-pointer: coarse), (max-height: 600px) and (any-pointer: coarse)')
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
      if (target.closest('.tab-list, .sidebar, .breadcrumb-mobile-actions, .notifications-panel, .global-search-panel, .header-overlay-backdrop, input, textarea, select')) return

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
    if (session?.role !== 'analyst') return
    setTabs((currentTabs) => syncLiveChatFixedTab(currentTabs, liveChatPreferences.enabled))
  }, [liveChatPreferences.enabled, session?.role])

  useEffect(() => {
    const currentRoute = routeFromLocation()

    if (!session) {
      writeRoute('/login', { replace: true })
      return
    }

    if (session.role === 'analyst' && currentRoute.viewId === 'livechat' && !liveChatPreferences.enabled) {
      writeRoute('/dashboard', { replace: true })
      return
    }

    const resolvedRoute = resolveRouteForRole(currentRoute, session.role)
    if (resolvedRoute.path !== currentRoute.path) {
      writeRoute(resolvedRoute.path, { replace: true })
    }
  }, [liveChatPreferences.enabled, session])

  useEffect(() => {
    function handlePopState() {
      if (!session) return

      const currentRoute = routeFromLocation()
      const route = resolveRouteForRole(currentRoute, session.role)

      if (session.role === 'analyst' && route.viewId === 'livechat' && !liveChatPreferences.enabled) {
        const fallback = tabs.find((tab) => tab.key === 'home') || tabs.find((tab) => tab.key !== LIVE_CHAT_TAB_KEY)
        if (fallback) {
          setActiveTabKey(fallback.key)
          writeRoute(pathForTab(fallback, tickets), { replace: true })
        }
        return
      }

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
  }, [activeTabKey, liveChatPreferences.enabled, session, tabs, ticketDraft, tickets])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!tabContextMenu) return undefined

    const handlePointerDown = (event) => {
      if (event.target.closest?.('.tab-context-menu')) return
      setTabContextMenu(null)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setTabContextMenu(null)
    }
    const closeMenu = () => setTabContextMenu(null)

    document.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [tabContextMenu])

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
  const contextMenuTab = tabContextMenu
    ? tabs.find((tab) => tab.key === tabContextMenu.tabKey)
    : undefined
  const activeView = activeTab?.viewId || 'home'
  const liveChatUnreadCount = useMemo(
    () => liveChatConversations.reduce((total, conversation) => total + (Number(conversation.unread) || 0), 0),
    [liveChatConversations],
  )
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
    if (activeView !== 'livechat' || !selectedLiveChatId) return
    setLiveChatConversations((current) => {
      let changed = false
      const next = current.map((conversation) => {
        if (conversation.id !== selectedLiveChatId || !conversation.unread) return conversation
        changed = true
        return { ...conversation, unread: 0 }
      })
      return changed ? next : current
    })
  }, [activeView, liveChatConversations, selectedLiveChatId])

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
  const selectedProject = activeTab?.projectId
    ? projects.find((project) => project.id === activeTab.projectId)
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
  const breadcrumbs = getBreadcrumbs(activeTab, selectedTicket, selectedAsset, selectedArticle, selectedProject)
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

  const unreadNotificationCount = notifications.filter((notification) => !notification.read).length

  const globalSearchResults = useMemo(() => {
    const normalizedQuery = globalSearchQuery.trim().toLowerCase()
    if (!normalizedQuery) return { tickets: [], assets: [], articles: [] }

    return {
      tickets: tickets
        .filter((ticket) =>
          [ticket.id, ticket.title, ticket.requester, ticket.service, ticket.team, ticket.assignee]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery),
        )
        .slice(0, 6),
      assets: assets
        .filter((asset) =>
          [asset.id, asset.name, asset.type, asset.owner, asset.status]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery),
        )
        .slice(0, 4),
      articles: knowledgeArticles
        .filter((article) =>
          [article.title, article.category, article.slug]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery),
        )
        .slice(0, 4),
    }
  }, [globalSearchQuery, tickets])

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
      projectId: crumb.projectId,
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

  function openProject(project) {
    openTab('projects', {
      key: `project-${project.id}`,
      title: project.id,
      projectId: project.id,
    })
  }

  function createProject(draft) {
    const highestId = projects.reduce((highest, project) => {
      const numericId = Number(String(project.id).replace(/\D/g, ''))
      return Number.isFinite(numericId) ? Math.max(highest, numericId) : highest
    }, 0)
    const id = `PRJ-${String(highestId + 1).padStart(4, '0')}`
    const owner = workPeople.find((person) => person.id === draft.ownerId)
    const teamLead = workTeams.find((team) => team.name === draft.team)?.leadId
    const createdProject = {
      id,
      name: draft.name,
      description: draft.description || 'New delivery initiative created in Hi5Central.',
      summary: 'Project created. Confirm the delivery plan, milestones and first tasks.',
      status: 'Planned',
      health: 'On Track',
      priority: draft.priority,
      ownerId: draft.ownerId,
      sponsorId: teamLead || draft.ownerId,
      team: draft.team,
      startDate: draft.startDate,
      targetDate: draft.targetDate,
      updated: 'Just now',
      memberIds: [...new Set([draft.ownerId, teamLead].filter(Boolean))],
      linkedRecords: [],
      milestones: [
        { id: `MS-${id.replace(/\D/g, '')}-1`, title: 'Delivery complete', dueDate: draft.targetDate, status: 'Planned' },
      ],
      tasks: [],
      risks: [],
      activity: [
        { id: `ACT-${Date.now()}`, actor: owner?.name || session?.name || 'Dana Sinclair', action: 'created the project', meta: 'Just now' },
      ],
    }
    setProjects((current) => [createdProject, ...current])
    openProject(createdProject)
    setToast(`${id} created`)
  }

  function updateProject(projectId, updates) {
    setProjects((current) => current.map((project) => project.id === projectId
      ? { ...project, ...updates, updated: 'Just now' }
      : project))
  }

  function liveChatTimestamp() {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date())
  }

  function setLiveChatEnabled(enabled) {
    setLiveChatPreferences((current) => ({ ...current, enabled }))
    setTabs((currentTabs) => syncLiveChatFixedTab(currentTabs, enabled))

    if (!enabled && activeTabKey === LIVE_CHAT_TAB_KEY) {
      const fallback = tabs.find((tab) => tab.key === 'home') || tabs.find((tab) => tab.key !== LIVE_CHAT_TAB_KEY)
      if (fallback) {
        setActiveTabKey(fallback.key)
        writeRoute(pathForTab(fallback, tickets), { replace: true })
      }
    }

    setToast(enabled ? 'Live Chat enabled — the workspace tab is now fixed' : 'Live Chat disabled')
  }

  function markLiveChatConversationRead(conversationId) {
    setLiveChatConversations((current) => current.map((conversation) =>
      conversation.id === conversationId && conversation.unread
        ? { ...conversation, unread: 0 }
        : conversation,
    ))
  }

  function claimLiveChatConversation(conversationId) {
    const timestamp = liveChatTimestamp()
    setLiveChatConversations((current) => current.map((conversation) => {
      if (conversation.id !== conversationId) return conversation
      return {
        ...conversation,
        status: 'Open',
        assignedTo: session?.name || 'Dana Sinclair',
        unread: 0,
        updatedAt: 'Now',
        messages: [
          ...conversation.messages,
          {
            id: `MSG-${Date.now()}`,
            sender: 'system',
            text: `${session?.name || 'Dana Sinclair'} joined the conversation.`,
            time: timestamp,
          },
        ],
      }
    }))
    setSelectedLiveChatId(conversationId)
    setToast('Conversation claimed')
  }

  function toggleLiveChatConversationClosed(conversationId) {
    const timestamp = liveChatTimestamp()
    setLiveChatConversations((current) => current.map((conversation) => {
      if (conversation.id !== conversationId) return conversation
      const reopening = conversation.status === 'Closed'
      return {
        ...conversation,
        status: reopening ? 'Open' : 'Closed',
        updatedAt: 'Now',
        messages: [
          ...conversation.messages,
          {
            id: `MSG-${Date.now()}`,
            sender: 'system',
            text: reopening
              ? `Conversation reopened by ${session?.name || 'Dana Sinclair'}.`
              : `Conversation closed by ${session?.name || 'Dana Sinclair'}.`,
            time: timestamp,
          },
        ],
      }
    }))
  }

  function sendLiveChatMessage(conversationId, body) {
    const timestamp = liveChatTimestamp()
    let replyIndex = 0

    setLiveChatConversations((current) => current.map((conversation) => {
      if (conversation.id !== conversationId) return conversation
      replyIndex = conversation.messages.length % liveChatReplyOptions.length
      const claimMessage = conversation.status === 'Waiting'
        ? [{
            id: `MSG-${Date.now()}-claim`,
            sender: 'system',
            text: `${session?.name || 'Dana Sinclair'} joined the conversation.`,
            time: timestamp,
          }]
        : []
      return {
        ...conversation,
        status: 'Open',
        assignedTo: conversation.assignedTo || session?.name || 'Dana Sinclair',
        unread: 0,
        updatedAt: 'Now',
        lastMessage: body,
        messages: [
          ...conversation.messages,
          ...claimMessage,
          {
            id: `MSG-${Date.now()}`,
            sender: 'agent',
            text: body,
            time: timestamp,
            state: 'Sent',
          },
        ],
      }
    }))

    window.setTimeout(() => {
      const incomingText = liveChatReplyOptions[replyIndex]
      const incomingTime = liveChatTimestamp()
      setLiveChatConversations((current) => current.map((conversation) => {
        if (conversation.id !== conversationId || conversation.status === 'Closed') return conversation
        return {
          ...conversation,
          unread: (Number(conversation.unread) || 0) + 1,
          updatedAt: 'Now',
          lastMessage: incomingText,
          messages: [
            ...conversation.messages,
            {
              id: `MSG-${Date.now()}-reply`,
              sender: 'requester',
              text: incomingText,
              time: incomingTime,
            },
          ],
        }
      }))
    }, 1400)
  }

  function saveRotaEntry(entry) {
    const person = workPeople.find((item) => item.id === entry.personId)
    if (entry.id) {
      setRotaEntries((current) => current.map((item) => item.id === entry.id ? entry : item))
      setToast(`${entry.type} updated for ${person?.name || 'team member'}`)
      return
    }

    const created = { ...entry, id: `ROT-${Date.now()}` }
    setRotaEntries((current) => [...current, created])
    setToast(`${entry.type} added for ${person?.name || 'team member'}`)
  }

  function deleteRotaEntry(entryId) {
    setRotaEntries((current) => current.filter((entry) => entry.id !== entryId))
    setToast('Rota entry removed')
  }

  function copyRotaEntries(entriesToCopy) {
    const batchId = Date.now()
    const created = entriesToCopy.map((entry, index) => ({
      ...entry,
      id: `ROT-${batchId}-${String(index + 1).padStart(2, '0')}`,
    }))
    setRotaEntries((current) => [...current, ...created])
    setToast(`${created.length} rota entries copied`)
  }

  function saveCalendarEvent(event) {
    if (event.id) {
      setCalendarEvents((current) => current.map((item) => item.id === event.id ? event : item))
      setToast('Calendar event updated')
      return
    }

    const created = { ...event, id: `CAL-${Date.now()}` }
    setCalendarEvents((current) => [...current, created])
    setToast('Calendar event created')
  }

  function deleteCalendarEvent(eventId) {
    setCalendarEvents((current) => current.filter((event) => event.id !== eventId))
    setToast('Calendar event removed')
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

    const existingLauncher = tabs.find((tab) => tab.viewId === 'newtab')
    if (existingLauncher) {
      setActiveTabKey(existingLauncher.key)
      writeRoute(pathForTab(existingLauncher, tickets))
      return
    }

    const tab = makeTab('newtab', { key: NEW_TAB_KEY, title: 'New Tab' })
    setTabs((currentTabs) => addWorkspaceTab(currentTabs, tab))
    setActiveTabKey(NEW_TAB_KEY)
    writeRoute(pathForTab(tab, tickets))
  }

  function selectWorkspaceTab(tab, { replaceRoute = false } = {}) {
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
    writeRoute(pathForTab(tab, tickets), { replace: replaceRoute })
  }

  function activateTab(tab) {
    setTabContextMenu(null)
    if (tab.key === activeTabKey) return
    if (!confirmLeavingDraft()) return
    selectWorkspaceTab(tab)
  }

  function closeTab(key) {
    setTabContextMenu(null)
    if (key === activeTabKey && !confirmLeavingDraft()) return

    const index = tabs.findIndex((tab) => tab.key === key)
    const nextTabs = tabs.filter((tab) => tab.key !== key)
    if (!nextTabs.length) return
    setTabs(nextTabs)
    if (activeTabKey === key) {
      const fallbackIndex = Math.max(0, index - 1)
      const fallbackTab = nextTabs[fallbackIndex] || nextTabs[0]
      selectWorkspaceTab(fallbackTab, { replaceRoute: true })
    }
  }

  function openTabContextMenu(event, tab) {
    const supportsDesktopContextMenu = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
    if (!supportsDesktopContextMenu) return

    event.preventDefault()
    event.stopPropagation()
    closeHeaderOverlays()

    const menuWidth = 218
    const menuHeight = 226
    const x = Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8))
    const y = Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8))

    setTabContextMenu({ tabKey: tab.key, x, y })
  }

  function duplicateWorkspaceTab(tabKey) {
    const sourceTab = tabs.find((tab) => tab.key === tabKey)
    if (!sourceTab || sourceTab.viewId === 'newtab' || sourceTab.viewId === 'livechat') return
    if (sourceTab.key !== activeTabKey && !confirmLeavingDraft()) return

    const duplicate = {
      ...sourceTab,
      key: `${sourceTab.key}-copy-${Date.now().toString(36)}`,
      pinned: false,
    }

    setTabs((currentTabs) => {
      let workingTabs = [...currentTabs]
      if (workingTabs.length >= MAX_WORKSPACE_TABS) {
        const removableIndex = workingTabs.findIndex(
          (tab) => !tab.pinned && tab.key !== sourceTab.key && tab.viewId !== 'newtab',
        )
        if (removableIndex >= 0) workingTabs.splice(removableIndex, 1)
      }

      const sourceIndex = workingTabs.findIndex((tab) => tab.key === sourceTab.key)
      const insertIndex = sourceIndex >= 0 ? sourceIndex + 1 : workingTabs.length
      workingTabs.splice(insertIndex, 0, duplicate)
      return workingTabs.slice(0, MAX_WORKSPACE_TABS)
    })

    selectWorkspaceTab(duplicate)
    setTabContextMenu(null)
  }

  function closeTabGroup(keysToClose, fallbackKey) {
    const closableKeys = new Set(
      keysToClose.filter((key) => tabs.some((tab) => tab.key === key && !tab.pinned)),
    )
    if (!closableKeys.size) {
      setTabContextMenu(null)
      return
    }

    const removesActiveTab = closableKeys.has(activeTabKey)
    if (removesActiveTab && !confirmLeavingDraft()) return

    const nextTabs = tabs.filter((tab) => !closableKeys.has(tab.key))
    if (!nextTabs.length) return

    setTabs(nextTabs)

    if (removesActiveTab) {
      const fallbackTab =
        nextTabs.find((tab) => tab.key === fallbackKey) ||
        nextTabs.find((tab) => tab.pinned) ||
        nextTabs[0]
      selectWorkspaceTab(fallbackTab, { replaceRoute: true })
    }

    setTabContextMenu(null)
  }

  function closeOtherTabs(tabKey) {
    closeTabGroup(
      tabs.filter((tab) => !tab.pinned && tab.key !== tabKey).map((tab) => tab.key),
      tabKey,
    )
  }

  function closeTabsToRight(tabKey) {
    const targetIndex = tabs.findIndex((tab) => tab.key === tabKey)
    if (targetIndex < 0) return
    closeTabGroup(
      tabs.slice(targetIndex + 1).filter((tab) => !tab.pinned).map((tab) => tab.key),
      tabKey,
    )
  }

  function closeAllClosableTabs() {
    closeTabGroup(
      tabs.filter((tab) => !tab.pinned).map((tab) => tab.key),
      tabs.find((tab) => tab.pinned)?.key,
    )
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
      requestInformation: ticketDraft.type === 'Service Request'
        ? [
            { label: 'Employee name', value: ticketDraft.requester.trim() },
            ...(ticketDraft.requesterStaffNumber ? [{ label: 'Staff number', value: ticketDraft.requesterStaffNumber }] : []),
            ...(ticketDraft.requesterJobTitle ? [{ label: 'Job title', value: ticketDraft.requesterJobTitle }] : []),
            ...(ticketDraft.requesterDepartment ? [{ label: 'Department', value: ticketDraft.requesterDepartment }] : []),
            ...(ticketDraft.requestCostCentre ? [{ label: 'Cost centre', value: ticketDraft.requestCostCentre }] : []),
            ...(ticketDraft.requestRequiredBy ? [{ label: 'Required by', value: ticketDraft.requestRequiredBy }] : []),
          ]
        : undefined,
      requestedItems: ticketDraft.type === 'Service Request' ? ticketDraft.requestedItems || [] : undefined,
      requestApprovals: ticketDraft.type === 'Service Request' ? ticketDraft.requestApprovals || [] : undefined,
      requestTasks: ticketDraft.type === 'Service Request' ? ticketDraft.requestTasks || [] : undefined,
      problemImpactScope: ticketDraft.type === 'Problem' ? ticketDraft.problemImpactScope || 'Scope to be confirmed' : undefined,
      problemHypothesis: ticketDraft.type === 'Problem' ? ticketDraft.problemHypothesis || '' : undefined,
      problemWorkaround: ticketDraft.type === 'Problem' ? ticketDraft.problemWorkaround || '' : undefined,
      problemRootCause: ticketDraft.type === 'Problem' ? ticketDraft.problemRootCause || '' : undefined,
      problemPermanentFix: ticketDraft.type === 'Problem' ? ticketDraft.problemPermanentFix || '' : undefined,
      relatedIncidents: ticketDraft.type === 'Problem'
        ? (ticketDraft.problemRelatedIncidentsText || '').split(',').map((value) => value.trim()).filter(Boolean)
        : undefined,
      knownErrorStatus: ticketDraft.type === 'Problem' ? 'Not declared' : undefined,
      changeType: ticketDraft.type === 'Change' ? ticketDraft.changeType || 'Normal' : undefined,
      risk: ticketDraft.type === 'Change' ? ticketDraft.changeRisk || 'Medium' : undefined,
      approval: ticketDraft.type === 'Change' ? 'Not submitted' : undefined,
      approvalRoute: ticketDraft.type === 'Change' ? ticketDraft.changeApprovalRoute || 'CAB' : undefined,
      businessReason: ticketDraft.type === 'Change' ? ticketDraft.changeBusinessReason || ticketDraft.description.trim() : undefined,
      implementationPlan: ticketDraft.type === 'Change' ? ticketDraft.changeImplementationPlan || '' : undefined,
      testPlan: ticketDraft.type === 'Change' ? ticketDraft.changeTestPlan || '' : undefined,
      backoutPlan: ticketDraft.type === 'Change' ? ticketDraft.changeBackoutPlan || '' : undefined,
      plannedStart: ticketDraft.type === 'Change' ? ticketDraft.changePlannedStart || '' : undefined,
      plannedEnd: ticketDraft.type === 'Change' ? ticketDraft.changePlannedEnd || '' : undefined,
      downtime: ticketDraft.type === 'Change' ? ticketDraft.changeDowntime || 'No outage expected' : undefined,
      linkedAssets: ticketDraft.type === 'Change'
        ? (ticketDraft.changeAffectedCisText || '').split(',').map((value) => value.trim()).filter(Boolean)
        : [],
      window: ticketDraft.type === 'Change'
        ? [ticketDraft.changePlannedStart, ticketDraft.changePlannedEnd].filter(Boolean).join(' → ') || 'To be scheduled'
        : undefined,
    }

    if (createdTicket.type === 'Problem') {
      createdTicket.status = 'New'
      createdTicket.nextStep = 'Begin investigation and link recurring incidents.'
      createdTicket.comments = ['Problem record created from the analyst console.']
    }

    if (createdTicket.type === 'Change') {
      createdTicket.status = 'Draft'
      createdTicket.nextStep = 'Complete the plan and submit the change for approval.'
      createdTicket.comments = ['Change record created in Draft.']
    }

    if (createdTicket.type === 'Service Request') {
      const approvalRequired = createdTicket.requestApprovals?.some((approval) => approval.status === 'Pending')
      createdTicket.status = approvalRequired ? 'Pending Approval' : 'In Progress'
      createdTicket.nextStep = approvalRequired
        ? 'Awaiting required approval before fulfilment tasks are released.'
        : 'Approval not required. The first fulfilment task is ready.'
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
    const restoredLoginTabs = profile.role === 'analyst'
      ? restoreWorkspaceTabs(storedWorkspace, activeLoginTab)
      : [requestedTab]
    const nextTabs = profile.role === 'analyst'
      ? syncLiveChatFixedTab(restoredLoginTabs, liveChatPreferences.enabled)
      : restoredLoginTabs
    const resolvedLoginTab = nextTabs.find((tab) => tab.key === activeLoginTab.key) || nextTabs[0] || requestedTab

    setSession(nextSession)
    setLoginError('')
    setTabs(nextTabs)
    setActiveTabKey(resolvedLoginTab.key)

    if (resolvedLoginTab.recordId) {
      setSelectedTicketId(resolvedLoginTab.recordId)
    } else if (resolvedLoginTab.newRecordType) {
      setTicketDraft(emptyTicketDraft(resolvedLoginTab.newRecordType))
    } else if (serviceDeskModules[resolvedLoginTab.viewId]) {
      const moduleConfig = serviceDeskModules[resolvedLoginTab.viewId]
      const firstModuleTicket = tickets.find((ticket) => ticket.type === moduleConfig.type)
      if (firstModuleTicket) setSelectedTicketId(firstModuleTicket.id)
      setTicketDraft(emptyTicketDraft(moduleConfig.type))
    }

    if (resolvedLoginTab.filter) {
      setFilters(resolvedLoginTab.filter)
    } else if (serviceDeskModules[resolvedLoginTab.viewId]) {
      setFilters({ ...allTicketFilters(), type: serviceDeskModules[resolvedLoginTab.viewId].type })
    } else {
      setFilters(allTicketFilters())
    }
    setQuery(resolvedLoginTab.query || '')

    setPortalDraft({
      requester: profile.role === 'requester' ? profile.name : '',
      email: profile.role === 'requester' ? profile.username : '',
      category: 'Report an IT Issue',
      title: '',
      description: '',
      urgency: 'Medium',
    })

    const nextPath = profile.role === 'analyst'
      ? pathForTab(resolvedLoginTab, tickets)
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

  function toggleNotifications() {
    setGlobalSearchOpen(false)
    setNotificationsOpen((open) => !open)
  }

  function toggleGlobalSearch() {
    setNotificationsOpen(false)
    setGlobalSearchOpen((open) => !open)
  }

  function closeHeaderOverlays() {
    setNotificationsOpen(false)
    setGlobalSearchOpen(false)
  }

  function openTicketRecord(ticket) {
    if (!ticket) return
    closeHeaderOverlays()
    setGlobalSearchQuery('')
    openTab('tickets', { key: `ticket-${ticket.id}`, title: ticket.id, recordId: ticket.id })
  }

  function openNotification(notification) {
    setNotifications((current) =>
      current.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
    )
    const ticket = tickets.find((item) => item.id === notification.recordId)
    if (ticket) {
      openTicketRecord(ticket)
    } else {
      closeHeaderOverlays()
      setToast('That demo record is not available in this workspace yet')
    }
  }

  function openGlobalSearchAsset(asset) {
    closeHeaderOverlays()
    setGlobalSearchQuery('')
    openAsset(asset)
  }

  function openGlobalSearchArticle(article) {
    closeHeaderOverlays()
    setGlobalSearchQuery('')
    openArticle(article)
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
          currentUser={session}
          openRecordTab={(ticket) =>
            openTab('tickets', { key: `ticket-${ticket.id}`, title: ticket.id, recordId: ticket.id })
          }
          openTab={openTab}
          sidebarMode={sidebarMode}
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
          tickets={tickets}
          updateTicket={updateTicket}
          openRecordTab={(ticket) =>
            openTab('tickets', { key: `ticket-${ticket.id}`, title: ticket.id, recordId: ticket.id })
          }
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

    if (activeView === 'livechat') {
      return (
        <LiveChatView
          conversations={liveChatConversations}
          currentUser={session}
          onClaimConversation={claimLiveChatConversation}
          onCloseConversation={toggleLiveChatConversationClosed}
          onDisableLiveChat={() => setLiveChatEnabled(false)}
          onMarkRead={markLiveChatConversationRead}
          onSendMessage={sendLiveChatMessage}
          onUpdatePreferences={(updates) => setLiveChatPreferences((current) => ({ ...current, ...updates }))}
          preferences={liveChatPreferences}
          selectedConversationId={selectedLiveChatId}
          setSelectedConversationId={setSelectedLiveChatId}
        />
      )
    }

    if (activeView === 'calendar') {
      return (
        <CalendarView
          calendarEvents={calendarEvents}
          onDeleteCalendarEvent={deleteCalendarEvent}
          onOpenProject={(projectId) => {
            const project = projects.find((item) => item.id === projectId)
            if (project) openProject(project)
          }}
          onOpenRecord={(recordId) => {
            const ticket = tickets.find((item) => item.id === recordId)
            if (ticket) openTab('tickets', { key: `ticket-${ticket.id}`, title: ticket.id, recordId: ticket.id })
          }}
          onOpenRota={() => openTab('rota')}
          onSaveCalendarEvent={saveCalendarEvent}
          people={workPeople}
          projects={projects}
          rotaEntries={rotaEntries}
          teams={workTeams}
          tickets={tickets}
        />
      )
    }

    if (activeView === 'projects') {
      return (
        <ProjectManagementView
          onCreateProject={createProject}
          onOpenProject={openProject}
          onOpenRecord={(ticket) =>
            openTab('tickets', { key: `ticket-${ticket.id}`, title: ticket.id, recordId: ticket.id })
          }
          onUpdateProject={updateProject}
          people={workPeople}
          projects={projects}
          selectedProject={selectedProject}
          teams={workTeams}
          tickets={tickets}
        />
      )
    }

    if (activeView === 'rota') {
      return (
        <RotaView
          entries={rotaEntries}
          onCopyEntries={copyRotaEntries}
          onDeleteEntry={deleteRotaEntry}
          onSaveEntry={saveRotaEntry}
          people={workPeople}
          teams={workTeams}
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
        liveChatEnabled={liveChatPreferences.enabled}
        onSetLiveChatEnabled={setLiveChatEnabled}
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
      className={`app-shell sidebar-${sidebarMode} density-${density}`}
      data-accent={accent}
      data-theme={resolvedTheme}
    >
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
          <div className="tabbar-tab-zone">
            <div className="tab-list" ref={tabListRef}>
            {tabs.map((tab) => {
              const tabModule = workspaceTabModule(tab)

              return (
                <button
                  className={[
                    'workspace-tab',
                    tab.viewId === 'livechat' ? 'workspace-tab-livechat' : '',
                    activeTabKey === tab.key ? 'active' : '',
                    activeTabKey === tab.key && activeHasUnsavedChanges ? 'dirty' : '',
                  ].filter(Boolean).join(' ')}
                  data-tab-key={tab.key}
                  data-tab-module={tabModule}
                  key={tab.key}
                  onClick={() => activateTab(tab)}
                  onContextMenu={(event) => openTabContextMenu(event, tab)}
                  type="button"
                >
                  <span className="workspace-tab-label">
                    {tab.title}
                    {tab.viewId === 'livechat' && liveChatUnreadCount > 0 && (
                      <span className="live-chat-tab-notification" aria-label={`${liveChatUnreadCount} unread Live Chat messages`}>
                        <Bell size={10} aria-hidden="true" />
                        {liveChatUnreadCount}
                      </span>
                    )}
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
              )
            })}
            <button
              aria-label="Open Hi5 workspace launcher"
              className="tab-add"
              onClick={openNewTab}
              title="Open Hi5 workspace launcher"
              type="button"
            >
              <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
            </button>
            </div>

            <button
              aria-label="Open Hi5Central navigation"
              className="tabbar-brand"
              onClick={() => setMobileNavOpen(true)}
              title="Open navigation"
              type="button"
            >
              <img src={`${import.meta.env.BASE_URL}hi5central-logo.png`} alt="" aria-hidden="true" />
            </button>
          </div>

          <div className="chrome-actions">
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
                aria-label="Search Hi5Central"
                onChange={(event) => {
                  setGlobalSearchQuery(event.target.value)
                  setGlobalSearchOpen(true)
                  setNotificationsOpen(false)
                }}
                onFocus={() => {
                  setGlobalSearchOpen(true)
                  setNotificationsOpen(false)
                }}
                placeholder="Search records"
                type="search"
                value={globalSearchQuery}
              />
            </label>
            <button
              aria-label="Sign out"
              className="icon-button chrome-logout"
              onClick={handleLogout}
              title="Sign out"
              type="button"
            >
              <LogOut size={17} aria-hidden="true" />
            </button>
          </div>
        </header>

        {tabContextMenu && contextMenuTab && (
          <div
            className="tab-context-menu"
            onContextMenu={(event) => event.preventDefault()}
            role="menu"
            style={{ left: tabContextMenu.x, top: tabContextMenu.y }}
          >
            <button
              disabled={contextMenuTab.viewId === 'newtab' || contextMenuTab.viewId === 'livechat'}
              onClick={() => duplicateWorkspaceTab(contextMenuTab.key)}
              role="menuitem"
              type="button"
            >
              Duplicate tab
            </button>
            <div className="tab-context-menu-separator" role="separator" />
            <button
              disabled={contextMenuTab.pinned}
              onClick={() => closeTab(contextMenuTab.key)}
              role="menuitem"
              type="button"
            >
              Close tab
            </button>
            <button
              disabled={!tabs.some((tab) => !tab.pinned && tab.key !== contextMenuTab.key)}
              onClick={() => closeOtherTabs(contextMenuTab.key)}
              role="menuitem"
              type="button"
            >
              Close other tabs
            </button>
            <button
              disabled={!tabs.slice(tabs.findIndex((tab) => tab.key === contextMenuTab.key) + 1).some((tab) => !tab.pinned)}
              onClick={() => closeTabsToRight(contextMenuTab.key)}
              role="menuitem"
              type="button"
            >
              Close tabs to the right
            </button>
            <button
              disabled={!tabs.some((tab) => !tab.pinned)}
              onClick={closeAllClosableTabs}
              role="menuitem"
              type="button"
            >
              Close all tabs
            </button>
          </div>
        )}

        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <div className="breadcrumb-trail">
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
          </div>

          <label className="breadcrumb-compact-search">
            <Search size={15} aria-hidden="true" />
            <input
              aria-label="Search Hi5Central"
              onChange={(event) => {
                setGlobalSearchQuery(event.target.value)
                setGlobalSearchOpen(true)
                setNotificationsOpen(false)
              }}
              onFocus={() => {
                setGlobalSearchOpen(true)
                setNotificationsOpen(false)
              }}
              placeholder="Search records"
              type="search"
              value={globalSearchQuery}
            />
          </label>

          <div className="breadcrumb-desktop-actions" aria-label="Workspace quick actions">
            {sidebarHidden && (
              <button
                className="breadcrumb-desktop-action"
                onClick={() => setSidebarMode('expanded')}
                title="Show sidebar"
                type="button"
              >
                <PanelLeftOpen size={16} aria-hidden="true" />
              </button>
            )}
            <button
              className="breadcrumb-desktop-action"
              onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
              title={resolvedTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              type="button"
            >
              {resolvedTheme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button
              aria-expanded={notificationsOpen}
              className="breadcrumb-desktop-action notification-trigger"
              onClick={toggleNotifications}
              title="Notifications"
              type="button"
            >
              <Bell size={16} aria-hidden="true" />
              {unreadNotificationCount > 0 && (
                <span className="notification-badge" aria-label={`${unreadNotificationCount} unread notifications`}>
                  {unreadNotificationCount}
                </span>
              )}
            </button>
            <button
              className="breadcrumb-desktop-action"
              onClick={() => openTab('settings')}
              title="Settings"
              type="button"
            >
              <Settings size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="breadcrumb-mobile-actions" aria-label="Mobile quick actions">
            <button
              aria-expanded={notificationsOpen}
              className="breadcrumb-mobile-action notification-trigger"
              onClick={toggleNotifications}
              title="Notifications"
              type="button"
            >
              <Bell size={16} aria-hidden="true" />
              {unreadNotificationCount > 0 && <span className="notification-dot" aria-hidden="true" />}
            </button>
            <button
              className="breadcrumb-mobile-action"
              onClick={() => openTab('settings')}
              title="Settings"
              type="button"
            >
              <Settings size={16} aria-hidden="true" />
            </button>
            <button
              className="breadcrumb-mobile-action"
              onClick={handleLogout}
              title="Sign out"
              type="button"
            >
              <LogOut size={16} aria-hidden="true" />
            </button>
          </div>
        </nav>

        {(notificationsOpen || globalSearchOpen) && (
          <button
            aria-label="Close header panel"
            className="header-overlay-backdrop"
            onClick={closeHeaderOverlays}
            type="button"
          />
        )}

        {notificationsOpen && (
          <aside className="notifications-panel" aria-label="Notifications">
            <div className="header-panel-heading">
              <div>
                <span className="eyebrow">Inbox</span>
                <strong>Notifications</strong>
              </div>
              <div className="notification-panel-actions">
                <button
                  disabled={!unreadNotificationCount}
                  onClick={() =>
                    setNotifications((current) => current.map((item) => ({ ...item, read: true })))
                  }
                  type="button"
                >
                  Mark all read
                </button>
                <button
                  aria-label="Close notifications"
                  className="notification-panel-close"
                  onClick={() => setNotificationsOpen(false)}
                  title="Close notifications"
                  type="button"
                >
                  <X size={17} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="notification-list">
              {notifications.map((notification) => (
                <button
                  className={notification.read ? 'notification-item read' : 'notification-item'}
                  key={notification.id}
                  onClick={() => openNotification(notification)}
                  type="button"
                >
                  <span className={`notification-tone ${notification.tone}`} aria-hidden="true" />
                  <span className="notification-copy">
                    <strong>{notification.title}</strong>
                    <span>{notification.detail}</span>
                    <small>{notification.meta}</small>
                  </span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              ))}
            </div>
          </aside>
        )}

        {globalSearchOpen && (
          <aside className="global-search-panel" aria-label="Global search results">
            <div className="header-panel-heading">
              <div>
                <span className="eyebrow">Search</span>
                <strong>{globalSearchQuery.trim() ? `Results for “${globalSearchQuery.trim()}”` : 'Search Hi5Central'}</strong>
              </div>
              <button onClick={() => setGlobalSearchQuery('')} type="button">Clear</button>
            </div>
            {!globalSearchQuery.trim() ? (
              <div className="global-search-empty">Search incidents, requests, problems, changes, CIs and knowledge.</div>
            ) : (
              <div className="global-search-results">
                {!!globalSearchResults.tickets.length && (
                  <section>
                    <span className="global-search-group-label">Records</span>
                    {globalSearchResults.tickets.map((ticket) => (
                      <button key={ticket.id} onClick={() => openTicketRecord(ticket)} type="button">
                        <span>
                          <strong>{ticket.id}</strong>
                          <small>{ticket.type} · {ticket.status}</small>
                        </span>
                        <span className="global-search-result-title">{ticket.title}</span>
                        <ChevronRight size={15} aria-hidden="true" />
                      </button>
                    ))}
                  </section>
                )}
                {!!globalSearchResults.assets.length && (
                  <section>
                    <span className="global-search-group-label">Configuration items</span>
                    {globalSearchResults.assets.map((asset) => (
                      <button key={asset.id} onClick={() => openGlobalSearchAsset(asset)} type="button">
                        <span>
                          <strong>{asset.name}</strong>
                          <small>{asset.type} · {asset.status}</small>
                        </span>
                        <ChevronRight size={15} aria-hidden="true" />
                      </button>
                    ))}
                  </section>
                )}
                {!!globalSearchResults.articles.length && (
                  <section>
                    <span className="global-search-group-label">Knowledge</span>
                    {globalSearchResults.articles.map((article) => (
                      <button key={article.slug} onClick={() => openGlobalSearchArticle(article)} type="button">
                        <span>
                          <strong>{article.title}</strong>
                          <small>{article.category}</small>
                        </span>
                        <ChevronRight size={15} aria-hidden="true" />
                      </button>
                    ))}
                  </section>
                )}
                {!globalSearchResults.tickets.length && !globalSearchResults.assets.length && !globalSearchResults.articles.length && (
                  <div className="global-search-empty">No demo records match that search.</div>
                )}
              </div>
            )}
          </aside>
        )}

        <main className="workspace">
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
