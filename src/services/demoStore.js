import { loginProfiles, seedTickets } from '../data/demoData.jsx'
import { seedRotaEntries } from '../data/rotaData.js'
import { seedCalendarEvents } from '../data/calendarData.js'
import { defaultLiveChatPreferences, seedLiveChatConversations } from '../data/liveChatData.js'
import { seedProjects } from '../data/workPlanningData.js'
import { createSeedNotifications } from '../data/notificationData.js'

function readJson(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

function readMigratedJson(key, legacyKey, fallback) {
  const current = readJson(key, undefined)
  if (current !== undefined) return current

  const legacy = readJson(legacyKey, undefined)
  return legacy !== undefined ? legacy : fallback
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

function hydrateTicketEnhancements(tickets) {
  const seedsById = new Map(seedTickets.map((ticket) => [ticket.id, ticket]))
  const enhancementFields = [
    'requesterEmail',
    'requesterStaffNumber',
    'requesterJobTitle',
    'requesterDepartment',
    'requesterManager',
    'requestInformation',
    'requestedItems',
    'requestApprovals',
    'requestTasks',
    'problemImpactScope',
    'problemHypothesis',
    'problemWorkaround',
    'problemRootCause',
    'problemPermanentFix',
    'relatedIncidents',
    'relatedChanges',
    'knownErrorStatus',
    'knownErrorTitle',
    'affectedVersions',
    'knowledgeArticle',
    'changeType',
    'riskSummary',
    'approvalRoute',
    'businessReason',
    'implementationPlan',
    'testPlan',
    'backoutPlan',
    'plannedStart',
    'plannedEnd',
    'downtime',
    'relatedProblems',
    'implementationNotes',
    'reviewOutcome',
  ]

  return tickets.map((ticket) => {
    const seed = seedsById.get(ticket.id)
    if (!seed) return ticket

    const enhancements = {}
    for (const field of enhancementFields) {
      if (ticket[field] === undefined && seed[field] !== undefined) {
        enhancements[field] = seed[field]
      }
    }

    return Object.keys(enhancements).length ? { ...ticket, ...enhancements } : ticket
  })
}

export function loadTickets() {
  const tickets = readMigratedJson('hi5central-tickets', 'lsl-itsm-tickets', seedTickets)
  const hydrated = hydrateTicketEnhancements(Array.isArray(tickets) ? tickets : seedTickets)

  // Layout/demo migrations: add only the new Problem/Change examples introduced
  // for the dedicated module designs. Existing user-created demo records and
  // edits remain untouched.
  const supplementalIds = new Set(['PRB-0148', 'PRB-0151', 'CHG-0904', 'CHG-0906'])
  const currentIds = new Set(hydrated.map((ticket) => ticket.id))
  const supplemental = seedTickets.filter(
    (ticket) => supplementalIds.has(ticket.id) && !currentIds.has(ticket.id),
  )

  return [...hydrated, ...supplemental]
}

export function loadProjects() {
  const stored = readJson('hi5central-projects-v1', seedProjects)
  if (!Array.isArray(stored) || !stored.length) return seedProjects

  const seedsById = new Map(seedProjects.map((project) => [project.id, project]))
  return stored.map((project) => {
    const seed = seedsById.get(project.id)
    return {
      ...project,
      milestones: Array.isArray(project.milestones) ? project.milestones : seed?.milestones || [],
      tasks: Array.isArray(project.tasks) ? project.tasks : seed?.tasks || [],
      risks: Array.isArray(project.risks) ? project.risks : seed?.risks || [],
      activity: Array.isArray(project.activity) ? project.activity : seed?.activity || [],
      memberIds: Array.isArray(project.memberIds) ? project.memberIds : seed?.memberIds || [],
      linkedRecords: Array.isArray(project.linkedRecords) ? project.linkedRecords : seed?.linkedRecords || [],
    }
  })
}

export function loadRotaEntries() {
  const stored = readJson('hi5central-rota-v1', seedRotaEntries)
  if (!Array.isArray(stored)) return seedRotaEntries

  return stored.map((entry) => ({
    status: 'Confirmed',
    start: '',
    end: '',
    isOverride: false,
    coverForId: '',
    note: '',
    ...entry,
  }))
}

export function loadCalendarEvents() {
  const stored = readJson('hi5central-calendar-v1', seedCalendarEvents)
  if (!Array.isArray(stored)) return seedCalendarEvents
  return stored
}


export function loadLiveChatPreferences() {
  const stored = readJson('hi5central-live-chat-preferences-v1', defaultLiveChatPreferences)
  return {
    ...defaultLiveChatPreferences,
    ...(stored && typeof stored === 'object' ? stored : {}),
  }
}

export function loadLiveChatConversations() {
  const stored = readJson('hi5central-live-chat-conversations-v1', seedLiveChatConversations)
  return Array.isArray(stored) && stored.length ? stored : seedLiveChatConversations
}


export function loadNotifications() {
  const stored = readJson('hi5central-notifications-v1', null)
  if (!Array.isArray(stored)) return createSeedNotifications()

  return stored.map((notification) => ({
    source: 'itsm',
    tone: 'info',
    read: false,
    createdAt: new Date().toISOString(),
    ...notification,
  }))
}

export function loadSession() {
  const storedSession = readMigratedJson('hi5central-session', 'lsl-itsm-session', null)
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

export function loadTheme() {
  const storedTheme = readJson('hi5central-theme-mode', null)
  return ['system', 'light', 'dark'].includes(storedTheme) ? storedTheme : 'system'
}

export function loadAccent() {
  const storedAccent = readJson('hi5central-accent', 'amber')
  return ['amber', 'cyan', 'blue', 'violet', 'emerald', 'rose'].includes(storedAccent)
    ? storedAccent
    : 'amber'
}

export function loadDensity() {
  const storedDensity = readJson('hi5central-density', 'comfortable')
  return ['comfortable', 'compact'].includes(storedDensity) ? storedDensity : 'comfortable'
}

export function loadSidebarMode() {
  const storedMode = readMigratedJson('hi5central-sidebar-mode', 'lsl-itsm-sidebar-mode', 'expanded')
  return ['expanded', 'collapsed', 'hidden'].includes(storedMode) ? storedMode : 'expanded'
}



export function loadWorkspace() {
  const stored = readJson('hi5central-workspace-analyst', null)
  if (!stored || !Array.isArray(stored.tabs)) return null

  return {
    tabs: stored.tabs,
    activeTabKey: typeof stored.activeTabKey === 'string' ? stored.activeTabKey : null,
  }
}

export function saveWorkspace(workspace) {
  if (!workspace || !Array.isArray(workspace.tabs)) return
  writeJson('hi5central-workspace-analyst', workspace)
}

export function saveTickets(tickets) {
  writeJson('hi5central-tickets', tickets)
}

export function saveProjects(projects) {
  writeJson('hi5central-projects-v1', projects)
}

export function saveRotaEntries(entries) {
  writeJson('hi5central-rota-v1', entries)
}

export function saveCalendarEvents(events) {
  writeJson('hi5central-calendar-v1', events)
}


export function saveLiveChatPreferences(preferences) {
  writeJson('hi5central-live-chat-preferences-v1', preferences)
}

export function saveLiveChatConversations(conversations) {
  writeJson('hi5central-live-chat-conversations-v1', conversations)
}

export function saveNotifications(notifications) {
  writeJson('hi5central-notifications-v1', notifications)
}

export function saveTheme(theme) {
  writeJson('hi5central-theme-mode', theme)
}

export function saveAccent(accent) {
  writeJson('hi5central-accent', accent)
}

export function saveDensity(density) {
  writeJson('hi5central-density', density)
}

export function saveSidebarMode(mode) {
  writeJson('hi5central-sidebar-mode', mode)
}

export function saveSession(session) {
  if (session) {
    writeJson('hi5central-session', session)
    return
  }

  window.localStorage.removeItem('hi5central-session')
  window.localStorage.removeItem('lsl-itsm-session')
}
