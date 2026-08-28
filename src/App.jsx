import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BarChart3,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  ClipboardCheck,
  Clock3,
  Database,
  Headphones,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LogIn,
  LogOut,
  MessageSquarePlus,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Send,
  Server,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  UserCheck,
  UserRound,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import './App.css'

const statusOptions = [
  'New',
  'In Progress',
  'Pending Approval',
  'CAB Review',
  'Monitoring',
  'Resolved',
  'Closed',
]

const viewMeta = {
  home: { id: 'home', label: 'Dashboard', icon: LayoutDashboard },
  newtab: { id: 'newtab', label: 'New Tab', icon: Plus },
  tickets: { id: 'tickets', label: 'Tickets', icon: Inbox },
  portal: { id: 'portal', label: 'Self-Service', icon: LifeBuoy },
  changes: { id: 'changes', label: 'Changes', icon: ClipboardCheck },
  cmdb: { id: 'cmdb', label: 'CMDB', icon: Database },
  knowledge: { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
  reports: { id: 'reports', label: 'Reports', icon: BarChart3 },
  settings: { id: 'settings', label: 'Settings', icon: Settings },
}

const analystNavIds = ['home', 'tickets', 'changes', 'cmdb', 'knowledge', 'reports', 'settings']

const loginProfiles = {
  analyst: {
    label: 'Agent Workspace',
    role: 'analyst',
    name: 'Dana Sinclair',
    initials: 'DS',
    username: 'analyst@lsl.co.uk',
    password: 'LSLdesk!2026',
    landingView: 'home',
    landingTitle: 'Dashboard',
    helper: 'Full ITSM console with incidents, requests, changes, CMDB, reporting, and settings.',
  },
  requester: {
    label: 'Self-Service Portal',
    role: 'requester',
    name: 'Eleanor Shaw',
    initials: 'ES',
    username: 'employee@lsl.co.uk',
    password: 'LSLportal!2026',
    landingView: 'portal',
    landingTitle: 'Self-Service',
    helper: 'End-user portal for raising requests, checking progress, and searching knowledge.',
  },
}

const seedTickets = [
  {
    id: 'INC-1032',
    type: 'Incident',
    title: 'Exchange mail flow degraded for London users',
    requester: 'Eleanor Shaw',
    priority: 'Critical',
    status: 'In Progress',
    team: 'Infrastructure',
    assignee: 'Priya Raman',
    service: 'Collaboration',
    location: 'London HQ',
    sla: '43 min',
    slaPercent: 82,
    created: '09:18',
    updated: '12 min ago',
    description:
      'Users can send internally but external delivery is delayed. Vendor status confirms an upstream queue issue.',
    nextStep: 'Run mail trace and prepare comms for affected teams.',
    comments: [
      'Incident bridge opened with Infrastructure and Service Desk.',
      'Vendor ticket raised and tagged as business critical.',
    ],
    linkedAssets: ['EXCH-HYB-02', 'M365 Tenant'],
  },
  {
    id: 'REQ-2217',
    type: 'Service Request',
    title: 'Laptop refresh for Finance analyst',
    requester: 'Marcus Lee',
    priority: 'Medium',
    status: 'Pending Approval',
    team: 'End User Compute',
    assignee: 'Noah Williams',
    service: 'Hardware',
    location: 'Birmingham',
    sla: '1 day',
    slaPercent: 39,
    created: 'Yesterday',
    updated: '31 min ago',
    description:
      'Replacement device requested for a power user with expiring warranty and performance issues.',
    nextStep: 'Awaiting cost-centre approval from Finance Operations.',
    comments: ['Quote attached by EUC. Approval routed to line manager.'],
    linkedAssets: ['LAP-8841'],
  },
  {
    id: 'CHG-0891',
    type: 'Change',
    title: 'Firewall firmware upgrade for perimeter cluster',
    requester: 'Security Operations',
    priority: 'High',
    status: 'CAB Review',
    team: 'Network',
    assignee: 'Amara Okafor',
    service: 'Network Security',
    location: 'Data Centre',
    sla: 'Fri 18:00',
    slaPercent: 56,
    created: 'Mon',
    updated: '1 hr ago',
    description:
      'Upgrade perimeter firewalls to remediate vendor CVEs and unlock improved VPN telemetry.',
    nextStep: 'CAB to confirm low-usage window and rollback plan.',
    comments: ['Risk assessment completed. Backup configuration exported.'],
    linkedAssets: ['FW-EDGE-A', 'FW-EDGE-B'],
    risk: 'High',
    approval: 'CAB Review',
    window: '29 Aug, 22:00-23:30',
  },
  {
    id: 'PRB-0142',
    type: 'Problem',
    title: 'Recurring Wi-Fi drops in conference rooms',
    requester: 'Facilities',
    priority: 'Medium',
    status: 'Monitoring',
    team: 'Network',
    assignee: 'Iris Patel',
    service: 'Wireless',
    location: 'London HQ',
    sla: '3 days',
    slaPercent: 23,
    created: 'Tue',
    updated: '2 hr ago',
    description:
      'Multiple incidents show roaming failures when rooms are fully occupied during all-hands events.',
    nextStep: 'Compare AP channel plan with occupancy telemetry.',
    comments: ['Known error drafted. Test channel plan applied to Floor 3.'],
    linkedAssets: ['AP-LON-3A', 'AP-LON-3B'],
  },
  {
    id: 'INC-1044',
    type: 'Incident',
    title: 'Payroll SSO failures after certificate rotation',
    requester: 'Hannah Bell',
    priority: 'High',
    status: 'New',
    team: 'Applications',
    assignee: 'Unassigned',
    service: 'Identity',
    location: 'Remote',
    sla: '2 hr',
    slaPercent: 64,
    created: '10:47',
    updated: '10 min ago',
    description:
      'Payroll portal redirects to an expired certificate error for several HR approvers.',
    nextStep: 'Validate SAML metadata and assign to Applications.',
    comments: ['Screenshots added by requester.'],
    linkedAssets: ['PAYROLL-SaaS', 'ADFS-01'],
  },
  {
    id: 'REQ-2224',
    type: 'Service Request',
    title: 'New starter access package for project analyst',
    requester: 'Olivia Carter',
    priority: 'Low',
    status: 'In Progress',
    team: 'Service Desk',
    assignee: 'Sam Taylor',
    service: 'Access',
    location: 'Manchester',
    sla: '6 hr',
    slaPercent: 28,
    created: '08:35',
    updated: '45 min ago',
    description:
      'Provision Microsoft 365, ServiceNow analyst group, VPN, and shared project drive access.',
    nextStep: 'Complete VPN profile assignment after manager approval.',
    comments: ['M365 license assigned. Shared drive access pending.'],
    linkedAssets: ['AAD', 'VPN-GW-01'],
  },
  {
    id: 'CHG-0897',
    type: 'Change',
    title: 'Conditional access policy rollout for privileged users',
    requester: 'Identity Governance',
    priority: 'High',
    status: 'Pending Approval',
    team: 'Security',
    assignee: 'James Howard',
    service: 'Identity',
    location: 'Cloud',
    sla: 'Thu 16:00',
    slaPercent: 49,
    created: 'Wed',
    updated: '24 min ago',
    description:
      'Require compliant device and phishing-resistant MFA for privileged admin accounts.',
    nextStep: 'Approval required from Head of Security.',
    comments: ['Pilot group passed validation with no blocked sign-ins.'],
    linkedAssets: ['Azure AD', 'Intune'],
    risk: 'Medium',
    approval: 'Pending',
    window: '30 Aug, 20:00-21:00',
  },
  {
    id: 'INC-1050',
    type: 'Incident',
    title: 'Finance print queue stuck after driver update',
    requester: 'Tom Sinclair',
    priority: 'Low',
    status: 'Resolved',
    team: 'End User Compute',
    assignee: 'Maya Ford',
    service: 'Print',
    location: 'Leeds',
    sla: 'Met',
    slaPercent: 100,
    created: 'Yesterday',
    updated: '3 hr ago',
    description:
      'Shared print queue stopped accepting jobs after an automatic driver package update.',
    nextStep: 'Confirm with Finance team before closure.',
    comments: ['Driver rollback completed. Test page succeeded.'],
    linkedAssets: ['PRN-FIN-02'],
  },
]

const serviceCatalog = [
  {
    title: 'Report an IT Issue',
    description: 'Raise an incident for broken, slow, or unavailable services.',
    icon: AlertCircle,
    accent: 'red',
  },
  {
    title: 'Request Equipment',
    description: 'Order laptops, monitors, accessories, and replacement kit.',
    icon: BriefcaseBusiness,
    accent: 'blue',
  },
  {
    title: 'Access Request',
    description: 'Ask for application, shared mailbox, VPN, or folder access.',
    icon: ShieldCheck,
    accent: 'navy',
  },
  {
    title: 'Onboarding Support',
    description: 'Provision starter packs, software, and standard access.',
    icon: Users,
    accent: 'amber',
  },
]

const assets = [
  {
    name: 'M365 Tenant',
    className: 'Cloud Service',
    owner: 'Collaboration',
    health: 'Degraded',
    incidents: 2,
    related: ['Exchange Hybrid', 'Azure AD'],
  },
  {
    name: 'FW-EDGE-A',
    className: 'Network Appliance',
    owner: 'Network',
    health: 'Change Pending',
    incidents: 0,
    related: ['FW-EDGE-B', 'VPN-GW-01'],
  },
  {
    name: 'PAYROLL-SaaS',
    className: 'Business App',
    owner: 'Applications',
    health: 'At Risk',
    incidents: 1,
    related: ['ADFS-01', 'Azure AD'],
  },
  {
    name: 'LAP-8841',
    className: 'Endpoint',
    owner: 'Finance',
    health: 'Warranty Expiring',
    incidents: 1,
    related: ['Intune', 'Finance Apps'],
  },
]

const knowledgeArticles = [
  {
    title: 'Resetting MFA on a new phone',
    category: 'Identity',
    reads: 842,
    updated: 'Updated today',
  },
  {
    title: 'How to request a laptop refresh',
    category: 'Hardware',
    reads: 516,
    updated: 'Updated yesterday',
  },
  {
    title: 'VPN connection checks for remote staff',
    category: 'Network',
    reads: 691,
    updated: 'Updated this week',
  },
  {
    title: 'Known error: conference room Wi-Fi roaming',
    category: 'Known Errors',
    reads: 184,
    updated: 'Draft in review',
  },
]

const teams = ['Service Desk', 'Infrastructure', 'Network', 'Security', 'Applications', 'End User Compute']
const priorities = ['Critical', 'High', 'Medium', 'Low']
const types = ['Incident', 'Service Request', 'Change', 'Problem']

function safeLocalStorageRead(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

function readStoredTickets() {
  return safeLocalStorageRead('lsl-itsm-tickets', seedTickets)
}

function readStoredSession() {
  const storedSession = safeLocalStorageRead('lsl-itsm-session', null)
  const storedProfile = storedSession?.profile
  const profile = storedProfile ? loginProfiles[storedProfile] : null
  if (!profile) return null

  return {
    role: profile.role,
    name: profile.name,
    initials: profile.initials,
    username: profile.username,
    profile: storedProfile,
  }
}

function readStoredTheme() {
  return safeLocalStorageRead('lsl-itsm-theme', 'light')
}

function readStoredSidebarMode() {
  const storedMode = safeLocalStorageRead('lsl-itsm-sidebar-mode', 'expanded')
  return ['expanded', 'collapsed', 'hidden'].includes(storedMode) ? storedMode : 'expanded'
}

function ticketPrefix(type) {
  return {
    Incident: 'INC',
    'Service Request': 'REQ',
    Change: 'CHG',
    Problem: 'PRB',
  }[type] || 'TKT'
}

function newTicketId(type) {
  const idNumber = String(Date.now()).slice(-5)
  return `${ticketPrefix(type)}-${idNumber}`
}

function priorityClass(priority) {
  return priority.toLowerCase().replace(/\s+/g, '-')
}

function statusClass(status) {
  return status.toLowerCase().replace(/\s+/g, '-')
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key]
    acc[value] = (acc[value] || 0) + 1
    return acc
  }, {})
}

function processBreadcrumb(ticket) {
  if (ticket?.type === 'Service Request') {
    return {
      label: 'Request',
      viewId: 'tickets',
      key: 'requests',
      title: 'Requests',
      filter: { type: 'Service Request', priority: 'All', status: 'All' },
      query: '',
    }
  }
  if (ticket?.type === 'Change') {
    return { label: 'Changes', viewId: 'changes', key: 'changes', title: 'Changes' }
  }
  if (ticket?.type === 'Problem') {
    return {
      label: 'Problems',
      viewId: 'tickets',
      key: 'problems',
      title: 'Problems',
      filter: { type: 'Problem', priority: 'All', status: 'All' },
      query: '',
    }
  }
  return {
    label: 'Tickets',
    viewId: 'tickets',
    key: 'tickets',
    title: 'Tickets',
    filter: { type: 'Incident', priority: 'All', status: 'All' },
    query: '',
  }
}

function tabBreadcrumbLabel(tab) {
  if (tab.key === 'requests') return 'Request'
  if (tab.key === 'problems') return 'Problems'
  return viewMeta[tab.viewId]?.label || tab.title
}

function getBreadcrumbs(activeTab, selectedTicket) {
  const homeCrumb = { label: 'Home', viewId: 'home', key: 'home', title: 'Dashboard' }
  if (!activeTab || activeTab.viewId === 'home') return [homeCrumb]
  if (activeTab.viewId === 'tickets' && activeTab.recordId) {
    const recordTitle = selectedTicket?.id || activeTab.title
    return [
      homeCrumb,
      processBreadcrumb(selectedTicket),
      {
        label: recordTitle,
        viewId: 'tickets',
        key: `ticket-${recordTitle}`,
        title: recordTitle,
        recordId: recordTitle,
      },
    ]
  }
  return [
    homeCrumb,
    {
      label: tabBreadcrumbLabel(activeTab),
      viewId: activeTab.viewId,
      key: activeTab.key,
      title: activeTab.title,
    },
  ]
}

function makeTab(viewId, overrides = {}) {
  return {
    key: overrides.key || viewId,
    viewId,
    title: overrides.title || viewMeta[viewId].label,
    pinned: overrides.pinned || false,
    recordId: overrides.recordId,
  }
}

function App() {
  const [initialTickets] = useState(readStoredTickets)
  const [initialSession] = useState(readStoredSession)
  const [session, setSession] = useState(initialSession)
  const [theme, setTheme] = useState(readStoredTheme)
  const [sidebarMode, setSidebarMode] = useState(readStoredSidebarMode)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [density, setDensity] = useState('comfortable')
  const [tickets, setTickets] = useState(initialTickets)
  const [tabs, setTabs] = useState(() => {
    const profile = initialSession?.role === 'requester' ? loginProfiles.requester : loginProfiles.analyst
    return [makeTab(profile.landingView, { title: profile.landingTitle, pinned: true })]
  })
  const [activeTabKey, setActiveTabKey] = useState(() => {
    const profile = initialSession?.role === 'requester' ? loginProfiles.requester : loginProfiles.analyst
    return profile.landingView
  })
  const [selectedTicketId, setSelectedTicketId] = useState(
    initialTickets[0]?.id || seedTickets[0].id,
  )
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({
    status: 'All',
    priority: 'All',
    type: 'All',
  })
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
    window.localStorage.setItem('lsl-itsm-tickets', JSON.stringify(tickets))
  }, [tickets])

  useEffect(() => {
    window.localStorage.setItem('lsl-itsm-theme', JSON.stringify(theme))
  }, [theme])

  useEffect(() => {
    window.localStorage.setItem('lsl-itsm-sidebar-mode', JSON.stringify(sidebarMode))
  }, [sidebarMode])

  useEffect(() => {
    if (session) {
      window.localStorage.setItem('lsl-itsm-session', JSON.stringify(session))
    } else {
      window.localStorage.removeItem('lsl-itsm-session')
    }
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

  function openTab(viewId, overrides = {}) {
    const tab = makeTab(viewId, overrides)
    if (overrides.recordId) {
      setSelectedTicketId(overrides.recordId)
    }
    if (overrides.filter) {
      setFilters((currentFilters) => ({ ...currentFilters, ...overrides.filter }))
    }
    if (overrides.query !== undefined) {
      setQuery(overrides.query)
    }
    setTabs((currentTabs) =>
      currentTabs.some((currentTab) => currentTab.key === tab.key)
        ? currentTabs
        : [...currentTabs, tab],
    )
    setActiveTabKey(tab.key)
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
    setTabs((currentTabs) => [...currentTabs, makeTab('newtab', { key, title: 'New Tab' })])
    setActiveTabKey(key)
  }

  function activateTab(tab) {
    if (tab.recordId) {
      setSelectedTicketId(tab.recordId)
    }
    setActiveTabKey(tab.key)
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
      description: portalDraft.description.trim() || 'Submitted through the LSL self-service portal.',
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
    const profile = loginProfiles[loginMode]
    if (loginForm.username !== profile.username || loginForm.password !== profile.password) {
      setLoginError('Those demo credentials do not match this login area.')
      return
    }

    const nextSession = {
      role: profile.role,
      name: profile.name,
      initials: profile.initials,
      username: profile.username,
      profile: loginMode,
    }
    setSession(nextSession)
    setLoginError('')
    setTabs([makeTab(profile.landingView, { title: profile.landingTitle, pinned: true })])
    setActiveTabKey(profile.landingView)
    setPortalDraft({
      requester: profile.role === 'requester' ? profile.name : '',
      email: profile.role === 'requester' ? profile.username : '',
      category: 'Report an IT Issue',
      title: '',
      description: '',
      urgency: 'Medium',
    })
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
          <img src={`${import.meta.env.BASE_URL}lsl-logo.png`} alt="LSL" />
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
            <img src={`${import.meta.env.BASE_URL}lsl-logo.png`} alt="LSL" />
            <span>ITSM Platform</span>
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
              <span className="eyebrow">LSL Technology Services</span>
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

function LoginScreen({
  fillCredentials,
  loginError,
  loginForm,
  loginMode,
  onLogin,
  setLoginForm,
  setLoginMode,
  setTheme,
  theme,
}) {
  const activeProfile = loginProfiles[loginMode]

  return (
    <main className="login-shell" data-theme={theme}>
      <section className="login-panel">
        <div className="login-brand">
          <img src={`${import.meta.env.BASE_URL}lsl-logo.png`} alt="LSL" />
          <button
            className="icon-button"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            type="button"
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>
        </div>

        <div>
          <span className="eyebrow">Demo access</span>
          <h1>Sign in to LSL ITSM</h1>
          <p className="login-copy">{activeProfile.helper}</p>
        </div>

        <div className="login-mode-switch" aria-label="Choose login area">
          {Object.entries(loginProfiles).map(([mode, profile]) => (
            <button
              className={loginMode === mode ? 'active' : ''}
              key={mode}
              onClick={() => {
                setLoginMode(mode)
                setLoginForm({ username: '', password: '' })
              }}
              type="button"
            >
              {mode === 'analyst' ? <UserCheck size={16} /> : <LifeBuoy size={16} />}
              {profile.label}
            </button>
          ))}
        </div>

        <form className="login-form" onSubmit={onLogin}>
          <label>
            Username
            <input
              autoComplete="username"
              onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })}
              placeholder={activeProfile.username}
              value={loginForm.username}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
              placeholder="Enter demo password"
              type="password"
              value={loginForm.password}
            />
          </label>
          {loginError && <p className="login-error">{loginError}</p>}
          <button className="primary-action" type="submit">
            <LogIn size={17} aria-hidden="true" />
            Sign in
          </button>
        </form>

        <div className="mobile-credential-strip">
          <span>Baked-in credentials</span>
          {Object.entries(loginProfiles).map(([mode, profile]) => (
            <button key={mode} onClick={() => fillCredentials(mode)} type="button">
              <strong>{profile.label}</strong>
              <small>{profile.username}</small>
              <code>{profile.password}</code>
            </button>
          ))}
        </div>
      </section>

      <section className="credential-panel">
        <span className="eyebrow">Baked-in credentials</span>
        <h2>No database needed for this prototype.</h2>
        <div className="credential-stack">
          {Object.entries(loginProfiles).map(([mode, profile]) => (
            <button className="credential-card" key={mode} onClick={() => fillCredentials(mode)} type="button">
              <KeyRound size={18} aria-hidden="true" />
              <span>{profile.label}</span>
              <strong>{profile.username}</strong>
              <code>{profile.password}</code>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}

function SelfServiceShell({
  currentUser,
  handleLogout,
  handlePortalSubmit,
  portalDraft,
  portalQuery,
  portalResults,
  serviceCatalog,
  setPortalDraft,
  setPortalQuery,
  setTheme,
  theme,
  tickets,
  toast,
}) {
  return (
    <div className="portal-shell" data-theme={theme}>
      <header className="portal-shell-header">
        <div className="portal-shell-brand">
          <img src={`${import.meta.env.BASE_URL}lsl-logo.png`} alt="LSL" />
          <div>
            <span>Technology Services</span>
            <strong>Self-Service Portal</strong>
          </div>
        </div>
        <div className="portal-shell-actions">
          <button
            className="icon-button"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            type="button"
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <button className="user-pill" onClick={handleLogout} title="Sign out" type="button">
            <span>{currentUser.initials}</span>
            <LogOut size={15} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="portal-page">
        <SelfServicePortal
          currentUser={currentUser}
          handlePortalSubmit={handlePortalSubmit}
          portalDraft={portalDraft}
          portalQuery={portalQuery}
          portalResults={portalResults}
          serviceCatalog={serviceCatalog}
          setPortalDraft={setPortalDraft}
          setPortalQuery={setPortalQuery}
          tickets={tickets}
        />
      </main>

      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  )
}

function NewTabView({ navItems, openRecordTab, openTab, tickets }) {
  const quickLinks = [
    ...navItems.filter((item) => item.id !== 'settings'),
    { id: 'settings', label: 'Settings' },
  ]

  return (
    <div className="new-tab-view">
      <section className="quick-open-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Navigation</span>
            <h2>Open Workspace</h2>
          </div>
        </div>
        <div className="quick-open-list">
          {quickLinks.map((item) => (
            <button key={item.id} onClick={() => openTab(item.id)} type="button">
              <strong>{item.label}</strong>
              <span>{item.id === 'home' ? 'Operational dashboard' : `Open ${item.label.toLowerCase()}`}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="quick-open-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Recent</span>
            <h2>Open Record</h2>
          </div>
        </div>
        <div className="quick-record-list">
          {tickets.slice(0, 6).map((ticket) => (
            <button key={ticket.id} onClick={() => openRecordTab(ticket)} type="button">
              <span>{ticket.id}</span>
              <strong>{ticket.title}</strong>
              <small>{ticket.status} - {ticket.team}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function DashboardView({ metrics, openRecordTab, openTab, tickets }) {
  const watchList = tickets
    .filter((ticket) => ticket.slaPercent >= 45 && ticket.status !== 'Resolved')
    .sort((a, b) => b.slaPercent - a.slaPercent)
    .slice(0, 4)

  return (
    <div className="view-grid dashboard-grid">
      <section className="metric-row" aria-label="Operational metrics">
        <MetricCard label="Active Records" value={metrics.active} detail="Unresolved workload" icon={Inbox} tone="blue" />
        <MetricCard label="High Priority" value={metrics.highRisk} detail="Critical and high items" icon={AlertCircle} tone="red" />
        <MetricCard label="Approvals" value={metrics.approvals} detail="Awaiting owner or CAB" icon={ClipboardCheck} tone="amber" />
        <MetricCard label="SLA Watch" value={metrics.slaPressure} detail="Needs attention today" icon={Clock3} tone="amber" />
      </section>

      <section className="operational-band">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Today</span>
            <h2>Live Service Queue</h2>
          </div>
          <button className="text-button" onClick={() => openTab('tickets')} type="button">
            Open all tickets
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="queue-table">
          {watchList.map((ticket) => (
            <button
              className="queue-row"
              key={ticket.id}
              onClick={() => openRecordTab(ticket)}
              type="button"
            >
              <span className={`priority-dot ${priorityClass(ticket.priority)}`}></span>
              <span>
                <strong>{ticket.id}</strong>
                {ticket.title}
              </span>
              <span>{ticket.team}</span>
              <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
              <SlaBar value={ticket.slaPercent} label={ticket.sla} />
            </button>
          ))}
        </div>
      </section>

      <section className="workload-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Workload</span>
            <h2>Team Distribution</h2>
          </div>
        </div>
        <BarList data={metrics.teamCounts} />
      </section>

      <section className="workload-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Priority</span>
            <h2>Risk Mix</h2>
          </div>
        </div>
        <BarList data={metrics.priorityCounts} palette="risk" />
      </section>
    </div>
  )
}

function TicketRecordView({
  addComment,
  newComment,
  selectedTicket,
  setNewComment,
  updateTicket,
}) {
  if (!selectedTicket) {
    return (
      <div className="record-page">
        <section className="record-primary empty-record">
          <span className="eyebrow">Record not found</span>
          <h2>This incident is no longer available</h2>
          <p>The ticket may have been closed or removed from the current workspace data.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="record-page">
      <section className="record-primary">
        <TicketDetailContent
          addComment={addComment}
          newComment={newComment}
          setNewComment={setNewComment}
          ticket={selectedTicket}
          updateTicket={updateTicket}
        />
      </section>

      <aside className="record-context-panel">
        <div className="section-heading tight">
          <div>
            <span className="eyebrow">Record Context</span>
            <h2>{selectedTicket.id}</h2>
          </div>
        </div>

        <div className="record-fact-grid">
          <InfoItem label="Type" value={selectedTicket.type} icon={Inbox} />
          <InfoItem label="Priority" value={selectedTicket.priority} icon={CircleGauge} />
          <InfoItem label="Created" value={selectedTicket.created} icon={CalendarClock} />
          <InfoItem label="Updated" value={selectedTicket.updated} icon={Clock3} />
        </div>

        <div className="record-context-block">
          <span className="eyebrow">SLA Position</span>
          <SlaBar value={selectedTicket.slaPercent} label={selectedTicket.sla} />
        </div>

        <div className="record-context-block">
          <span className="eyebrow">Linked CIs</span>
          <div className="linked-ci-list">
            {(selectedTicket.linkedAssets?.length ? selectedTicket.linkedAssets : ['No CI linked']).map((asset) => (
              <span key={asset}>{asset}</span>
            ))}
          </div>
        </div>

        <div className="record-context-block">
          <span className="eyebrow">Requester Location</span>
          <strong>{selectedTicket.location}</strong>
        </div>
      </aside>
    </div>
  )
}

function TicketDetailContent({
  addComment,
  newComment,
  setNewComment,
  ticket,
  updateTicket,
}) {
  return (
    <section className="ticket-detail-content">
      <div className="detail-header">
        <div>
          <span className="eyebrow">{ticket.id}</span>
          <h2>{ticket.title}</h2>
        </div>
        <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
      </div>

      <div className="detail-grid">
        <InfoItem label="Requester" value={ticket.requester} icon={UserRound} />
        <InfoItem label="Service" value={ticket.service} icon={Server} />
        <InfoItem label="Team" value={ticket.team} icon={Users} />
        <InfoItem label="Assignee" value={ticket.assignee} icon={Headphones} />
      </div>

      <p className="detail-copy">{ticket.description}</p>

      <div className="form-row">
        <label>
          Status
          <select
            onChange={(event) => updateTicket(ticket.id, { status: event.target.value })}
            value={ticket.status}
          >
            {statusOptions.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          Assignee
          <select
            onChange={(event) => updateTicket(ticket.id, { assignee: event.target.value })}
            value={ticket.assignee}
          >
            {['Unassigned', 'Priya Raman', 'Noah Williams', 'Amara Okafor', 'Sam Taylor', 'Maya Ford'].map((assignee) => (
              <option key={assignee}>{assignee}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="action-strip">
        <button onClick={() => updateTicket(ticket.id, { status: 'In Progress' })} type="button">
          <Wrench size={16} aria-hidden="true" />
          Start
        </button>
        <button onClick={() => updateTicket(ticket.id, { status: 'Pending Approval' })} type="button">
          <ClipboardCheck size={16} aria-hidden="true" />
          Approval
        </button>
        <button onClick={() => updateTicket(ticket.id, { status: 'Resolved', slaPercent: 100, sla: 'Met' })} type="button">
          <CheckCircle2 size={16} aria-hidden="true" />
          Resolve
        </button>
      </div>

      <div className="next-step">
        <strong>Next step</strong>
        <span>{ticket.nextStep}</span>
      </div>

      <div className="comment-box">
        <label>
          Activity note
          <textarea
            onChange={(event) => setNewComment(event.target.value)}
            placeholder="Add a visible work note"
            value={newComment}
          />
        </label>
        <button className="primary-action compact" onClick={addComment} type="button">
          <MessageSquarePlus size={16} aria-hidden="true" />
          Add note
        </button>
      </div>

      <div className="timeline">
        {ticket.comments.map((comment, index) => (
          <div className="timeline-item" key={`${ticket.id}-${index}-${comment}`}>
            <span></span>
            <p>{comment}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function TicketsView({
  addComment,
  filters,
  filteredTickets,
  handleTicketSubmit,
  newComment,
  openRecordTab,
  query,
  selectedTicket,
  setFilters,
  setNewComment,
  setQuery,
  setSelectedTicketId,
  setTicketDraft,
  ticketDraft,
  tickets,
  updateTicket,
}) {
  return (
    <div className="tickets-layout">
      <section className="ticket-list-zone">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{filteredTickets.length} of {tickets.length} records</span>
            <h2>Service Desk Queue</h2>
          </div>
          <button className="primary-action compact" type="submit" form="new-ticket-form">
            <Plus size={16} aria-hidden="true" />
            Create
          </button>
        </div>

        <div className="filter-grid">
          <label>
            Search
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ticket, requester, service"
              type="search"
              value={query}
            />
          </label>
          <FilterSelect label="Type" options={['All', ...types]} value={filters.type} onChange={(type) => setFilters({ ...filters, type })} />
          <FilterSelect label="Priority" options={['All', ...priorities]} value={filters.priority} onChange={(priority) => setFilters({ ...filters, priority })} />
          <FilterSelect label="Status" options={['All', ...statusOptions]} value={filters.status} onChange={(status) => setFilters({ ...filters, status })} />
        </div>

        <div className="ticket-stack">
          {filteredTickets.map((ticket) => (
            <button
              className={selectedTicket?.id === ticket.id ? 'ticket-card selected' : 'ticket-card'}
              key={ticket.id}
              onClick={() => {
                setSelectedTicketId(ticket.id)
                openRecordTab(ticket)
              }}
              type="button"
            >
              <div className="ticket-card-top">
                <span className={`type-chip ${ticket.type.toLowerCase().replace(/\s+/g, '-')}`}>{ticket.type}</span>
                <span className={`priority-label ${priorityClass(ticket.priority)}`}>{ticket.priority}</span>
              </div>
              <strong>{ticket.title}</strong>
              <div className="ticket-meta">
                <span>{ticket.id}</span>
                <span>{ticket.requester}</span>
                <span>{ticket.team}</span>
              </div>
              <div className="ticket-card-bottom">
                <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
                <SlaBar value={ticket.slaPercent} label={ticket.sla} />
              </div>
            </button>
          ))}
        </div>
      </section>

      <aside className="ticket-detail-zone">
        {selectedTicket && (
          <TicketDetailContent
            addComment={addComment}
            newComment={newComment}
            setNewComment={setNewComment}
            ticket={selectedTicket}
            updateTicket={updateTicket}
          />
        )}

        <form className="new-ticket-form" id="new-ticket-form" onSubmit={handleTicketSubmit}>
          <div className="section-heading tight">
            <div>
              <span className="eyebrow">Quick Capture</span>
              <h2>New Record</h2>
            </div>
          </div>
          <div className="form-row">
            <label>
              Type
              <select value={ticketDraft.type} onChange={(event) => setTicketDraft({ ...ticketDraft, type: event.target.value })}>
                {types.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select value={ticketDraft.priority} onChange={(event) => setTicketDraft({ ...ticketDraft, priority: event.target.value })}>
                {priorities.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Summary
            <input
              onChange={(event) => setTicketDraft({ ...ticketDraft, title: event.target.value })}
              placeholder="What needs attention?"
              value={ticketDraft.title}
            />
          </label>
          <label>
            Requester
            <input
              onChange={(event) => setTicketDraft({ ...ticketDraft, requester: event.target.value })}
              placeholder="Person or team"
              value={ticketDraft.requester}
            />
          </label>
          <div className="form-row">
            <label>
              Service
              <select value={ticketDraft.service} onChange={(event) => setTicketDraft({ ...ticketDraft, service: event.target.value })}>
                {['Collaboration', 'Identity', 'Hardware', 'Network Security', 'Wireless', 'Access'].map((service) => (
                  <option key={service}>{service}</option>
                ))}
              </select>
            </label>
            <label>
              Team
              <select value={ticketDraft.team} onChange={(event) => setTicketDraft({ ...ticketDraft, team: event.target.value })}>
                {teams.map((team) => (
                  <option key={team}>{team}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Description
            <textarea
              onChange={(event) => setTicketDraft({ ...ticketDraft, description: event.target.value })}
              placeholder="Impact, symptoms, desired outcome"
              value={ticketDraft.description}
            />
          </label>
        </form>
      </aside>
    </div>
  )
}

function SelfServicePortal({
  currentUser,
  handlePortalSubmit,
  portalDraft,
  portalQuery,
  portalResults,
  serviceCatalog,
  setPortalDraft,
  setPortalQuery,
  tickets,
}) {
  const isRequester = currentUser?.role === 'requester' || currentUser?.profile === 'requester'
  const requesterName = isRequester ? currentUser.name : portalDraft.requester
  const requesterEmail = portalDraft.email || currentUser?.username || loginProfiles.requester.username
  const myRequests = tickets.filter((ticket) => ticket.requester === requesterName).slice(0, 3)
  const visibleRequests = myRequests.length ? myRequests : tickets.filter((ticket) => ticket.type === 'Service Request').slice(0, 3)

  return (
    <div className="portal-view">
      <section className="portal-hero">
        <div>
          <span className="eyebrow">Self-Service Portal</span>
          <h2>Get help, request access, and track IT work in one place.</h2>
        </div>
        <label className="portal-search">
          <Search size={19} aria-hidden="true" />
          <input
            onChange={(event) => setPortalQuery(event.target.value)}
            placeholder="Search help articles or services"
            type="search"
            value={portalQuery}
          />
        </label>
      </section>

      <section className="catalog-grid">
        {serviceCatalog.map(({ title, description, icon: Icon, accent }) => (
          <button
            className={`catalog-card ${accent}`}
            key={title}
            onClick={() => setPortalDraft({ ...portalDraft, category: title, title: title === 'Report an IT Issue' ? '' : title })}
            type="button"
          >
            <Icon size={22} aria-hidden="true" />
            <strong>{title}</strong>
            <span>{description}</span>
          </button>
        ))}
      </section>

      <div className="portal-columns">
        <form className="portal-form" onSubmit={handlePortalSubmit}>
          <div className="section-heading tight">
            <div>
              <span className="eyebrow">Raise a request</span>
              <h2>Tell IT what you need</h2>
            </div>
          </div>
          <div className="form-row">
            <label>
              Name
            <input
              onChange={(event) => setPortalDraft({ ...portalDraft, requester: event.target.value })}
              placeholder="Your name"
              value={portalDraft.requester || requesterName || ''}
            />
            </label>
            <label>
              Email
              <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setPortalDraft({ ...portalDraft, email: event.target.value })}
              placeholder="you@lsl.co.uk"
              type="text"
              value={requesterEmail}
            />
            </label>
          </div>
          <div className="form-row">
            <label>
              Category
              <select
                onChange={(event) => setPortalDraft({ ...portalDraft, category: event.target.value })}
                value={portalDraft.category}
              >
                {serviceCatalog.map((item) => (
                  <option key={item.title}>{item.title}</option>
                ))}
              </select>
            </label>
            <label>
              Urgency
              <select
                onChange={(event) => setPortalDraft({ ...portalDraft, urgency: event.target.value })}
                value={portalDraft.urgency}
              >
                {['High', 'Medium', 'Low'].map((urgency) => (
                  <option key={urgency}>{urgency}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Summary
            <input
              onChange={(event) => setPortalDraft({ ...portalDraft, title: event.target.value })}
              placeholder="Short summary"
              value={portalDraft.title}
            />
          </label>
          <label>
            Details
            <textarea
              onChange={(event) => setPortalDraft({ ...portalDraft, description: event.target.value })}
              placeholder="What is affected, who is impacted, and when did it start?"
              value={portalDraft.description}
            />
          </label>
          <button className="primary-action" type="submit">
            <Send size={17} aria-hidden="true" />
            Submit request
          </button>
        </form>

        <section className="portal-side">
          <div>
            <div className="section-heading tight">
              <div>
                <span className="eyebrow">Knowledge</span>
                <h2>Suggested Help</h2>
              </div>
            </div>
            <div className="article-list">
              {portalResults.slice(0, 3).map((article) => (
                <article className="article-row" key={article.title}>
                  <BookOpen size={17} aria-hidden="true" />
                  <div>
                    <strong>{article.title}</strong>
                    <span>{article.category} - {article.updated}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div>
            <div className="section-heading tight">
              <div>
                <span className="eyebrow">Tracking</span>
                <h2>Recent Requests</h2>
              </div>
            </div>
            <div className="mini-request-list">
              {visibleRequests.map((ticket) => (
                <div className="mini-request" key={ticket.id}>
                  <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
                  <strong>{ticket.title}</strong>
                  <small>{ticket.id} - {ticket.updated}</small>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function ChangesView({ approveChange, tickets }) {
  return (
    <div className="changes-view">
      {tickets.map((ticket) => (
        <article className="change-card" key={ticket.id}>
          <div className="change-main">
            <span className={`priority-label ${priorityClass(ticket.priority)}`}>{ticket.priority} risk</span>
            <h2>{ticket.title}</h2>
            <p>{ticket.description}</p>
            <div className="change-details">
              <InfoItem label="Owner" value={ticket.assignee} icon={UserRound} />
              <InfoItem label="Window" value={ticket.window || 'To be scheduled'} icon={CalendarClock} />
              <InfoItem label="Approval" value={ticket.approval || ticket.status} icon={ClipboardCheck} />
            </div>
          </div>
          <div className="approval-panel">
            <strong>{ticket.id}</strong>
            <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
            <button onClick={() => approveChange(ticket, 'Approved')} type="button">
              <CheckCircle2 size={16} aria-hidden="true" />
              Approve
            </button>
            <button onClick={() => approveChange(ticket, 'Rejected')} type="button">
              <AlertCircle size={16} aria-hidden="true" />
              Reject
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}

function CmdbView({ assets, tickets }) {
  return (
    <div className="cmdb-view">
      <section className="asset-grid">
        {assets.map((asset) => (
          <article className="asset-card" key={asset.name}>
            <div className="asset-icon">
              <Server size={22} aria-hidden="true" />
            </div>
            <div>
              <span className="eyebrow">{asset.className}</span>
              <h2>{asset.name}</h2>
            </div>
            <div className="asset-meta">
              <span>Owner: {asset.owner}</span>
              <span>Open incidents: {asset.incidents}</span>
            </div>
            <span className={`health-pill ${asset.health.toLowerCase().replace(/\s+/g, '-')}`}>{asset.health}</span>
            <div className="relationship-list">
              {asset.related.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="operational-band">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Dependencies</span>
            <h2>Linked Records</h2>
          </div>
        </div>
        <div className="queue-table">
          {tickets.slice(0, 5).map((ticket) => (
            <div className="queue-row static" key={ticket.id}>
              <span className={`priority-dot ${priorityClass(ticket.priority)}`}></span>
              <span>
                <strong>{ticket.id}</strong>
                {ticket.title}
              </span>
              <span>{ticket.linkedAssets.join(', ') || 'No CI linked'}</span>
              <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function KnowledgeView({ portalQuery, portalResults, setPortalQuery }) {
  return (
    <div className="knowledge-view">
      <section className="portal-hero slim">
        <div>
          <span className="eyebrow">Knowledge Base</span>
          <h2>Reusable fixes, known errors, and standard request guidance.</h2>
        </div>
        <label className="portal-search">
          <Search size={19} aria-hidden="true" />
          <input
            onChange={(event) => setPortalQuery(event.target.value)}
            placeholder="Search the knowledge base"
            type="search"
            value={portalQuery}
          />
        </label>
      </section>
      <section className="knowledge-grid">
        {portalResults.map((article) => (
          <article className="knowledge-card" key={article.title}>
            <BookOpen size={20} aria-hidden="true" />
            <span className="eyebrow">{article.category}</span>
            <h2>{article.title}</h2>
            <p>{article.reads} reads - {article.updated}</p>
            <button className="text-button" type="button">
              Open article
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </article>
        ))}
      </section>
    </div>
  )
}

function ReportsView({ metrics, tickets }) {
  const byType = metrics.typeCounts
  const resolution = {
    Met: tickets.filter((ticket) => ticket.sla === 'Met').length,
    Watch: tickets.filter((ticket) => ticket.slaPercent >= 60 && ticket.sla !== 'Met').length,
    Healthy: tickets.filter((ticket) => ticket.slaPercent < 60).length,
  }

  return (
    <div className="reports-view">
      <section className="report-band">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Performance</span>
            <h2>Service Management Snapshot</h2>
          </div>
        </div>
        <div className="metric-row">
          <MetricCard label="Total Records" value={tickets.length} detail="All active data" icon={ListChecks} tone="blue" />
          <MetricCard label="SLA Met" value={resolution.Met} detail="Resolved in target" icon={CheckCircle2} tone="blue" />
          <MetricCard label="Needs Review" value={resolution.Watch} detail="SLA pressure" icon={Clock3} tone="amber" />
        </div>
      </section>

      <section className="workload-panel wide">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Demand</span>
            <h2>Volume by Process</h2>
          </div>
        </div>
        <BarList data={byType} />
      </section>

      <section className="workload-panel wide">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Delivery</span>
            <h2>SLA Health</h2>
          </div>
        </div>
        <BarList data={resolution} palette="delivery" />
      </section>
    </div>
  )
}

function SettingsView({
  density,
  session,
  setDensity,
  setSidebarMode,
  setTheme,
  sidebarMode,
  theme,
}) {
  return (
    <div className="settings-view">
      <section className="settings-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Preferences</span>
            <h2>Workspace Settings</h2>
          </div>
          <SlidersHorizontal size={20} aria-hidden="true" />
        </div>

        <div className="setting-row">
          <div>
            <strong>Theme</strong>
            <span>Switch between light and dark mode.</span>
          </div>
          <div className="segmented-control">
            <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')} type="button">
              <Sun size={15} aria-hidden="true" />
              Light
            </button>
            <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')} type="button">
              <Moon size={15} aria-hidden="true" />
              Dark
            </button>
          </div>
        </div>

        <div className="setting-row">
          <div>
            <strong>Sidebar</strong>
            <span>Choose the left navigation layout.</span>
          </div>
          <div className="segmented-control three">
            <button className={sidebarMode === 'expanded' ? 'active' : ''} onClick={() => setSidebarMode('expanded')} type="button">
              Expanded
            </button>
            <button className={sidebarMode === 'collapsed' ? 'active' : ''} onClick={() => setSidebarMode('collapsed')} type="button">
              Collapsed
            </button>
            <button className={sidebarMode === 'hidden' ? 'active' : ''} onClick={() => setSidebarMode('hidden')} type="button">
              Hidden
            </button>
          </div>
        </div>

        <div className="setting-row">
          <div>
            <strong>Density</strong>
            <span>Choose how much information is visible in each viewport.</span>
          </div>
          <div className="segmented-control">
            <button className={density === 'comfortable' ? 'active' : ''} onClick={() => setDensity('comfortable')} type="button">
              Comfortable
            </button>
            <button className={density === 'compact' ? 'active' : ''} onClick={() => setDensity('compact')} type="button">
              Compact
            </button>
          </div>
        </div>
      </section>

      <section className="settings-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Signed in</span>
            <h2>{session.name}</h2>
          </div>
          <span className="avatar-large">{session.initials}</span>
        </div>
        <div className="credential-readout">
          <span>{loginProfiles[session.profile].label}</span>
          <strong>{session.username}</strong>
          <small>Prototype authentication is backed by baked-in credentials only.</small>
        </div>
      </section>
    </div>
  )
}

function MetricCard({ label, value, detail, icon: Icon, tone }) {
  return (
    <article className={`metric-card ${tone}`}>
      <Icon size={21} aria-hidden="true" />
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        <small>{detail}</small>
      </div>
    </article>
  )
}

function FilterSelect({ label, options, value, onChange }) {
  return (
    <label>
      {label}
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

function InfoItem({ label, value, icon: Icon }) {
  return (
    <div className="info-item">
      <Icon size={17} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SlaBar({ value, label }) {
  return (
    <span className="sla-bar" aria-label={`SLA ${label}`}>
      <span style={{ width: `${Math.min(value, 100)}%` }}></span>
      <small>{label}</small>
    </span>
  )
}

function BarList({ data, palette = 'default' }) {
  const entries = Object.entries(data)
  const max = Math.max(...entries.map(([, value]) => value), 1)

  return (
    <div className={`bar-list ${palette}`}>
      {entries.map(([label, value]) => (
        <div className="bar-row" key={label}>
          <span>{label}</span>
          <div className="bar-track">
            <span style={{ width: `${(value / max) * 100}%` }}></span>
          </div>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  )
}

export default App
