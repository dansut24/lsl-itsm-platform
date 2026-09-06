import { loginProfiles, seedTickets } from '../data/demoData.jsx'
import { seedRotaEntries } from '../data/rotaData.js'
import { seedCalendarEvents } from '../data/calendarData.js'
import { defaultLiveChatPreferences, seedLiveChatConversations } from '../data/liveChatData.js'
import { seedProjects } from '../data/workPlanningData.js'
import { organisationDepartments, organisationPeople, organisationTeams } from '../data/organisationData.js'
import { createSeedNotifications } from '../data/notificationData.js'

const PRODUCTION_SESSION_KEY = 'hi5central-production-session-v1'
const API_BASE = 'https://api.hi5central.com'

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

function productionOrganisationEnabled() {
  const session = readJson(PRODUCTION_SESSION_KEY, null)
  return Boolean(session?.source === 'production' && session?.tenantSlug)
}

export async function syncOrganisationCollection(collection, items) {
  if (!productionOrganisationEnabled()) return null
  try {
    const response = await fetch(`${API_BASE}/api/v1/organisation/${encodeURIComponent(collection)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: Array.isArray(items) ? items : [] }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || `Could not save Organisation ${collection}.`)
    window.dispatchEvent(new CustomEvent('hi5-organisation-synchronised', { detail: { collection, snapshot: payload } }))
    return payload
  } catch (error) {
    console.error(`Organisation ${collection} synchronisation failed`, error)
    window.dispatchEvent(new CustomEvent('hi5-organisation-sync-error', { detail: { collection, message: error.message } }))
    return null
  }
}

function mirrorOrganisationCollection(collection, items) {
  syncOrganisationCollection(collection, items).catch(() => {})
}

function hydrateTicketEnhancements(tickets) {
  const seedsById = new Map(seedTickets.map((ticket) => [ticket.id, ticket]))
  const enhancementFields = [
    'requesterEmail', 'requesterStaffNumber', 'requesterJobTitle', 'requesterDepartment',
    'requesterManager', 'requestInformation', 'requestedItems', 'requestApprovals',
    'requestTasks', 'problemImpactScope', 'problemHypothesis', 'problemWorkaround',
    'problemRootCause', 'problemPermanentFix', 'relatedIncidents', 'relatedChanges',
    'knownErrorStatus', 'knownErrorTitle', 'affectedVersions', 'knowledgeArticle',
    'changeType', 'riskSummary', 'approvalRoute', 'businessReason', 'implementationPlan',
    'testPlan', 'backoutPlan', 'plannedStart', 'plannedEnd', 'downtime', 'relatedProblems',
    'implementationNotes', 'reviewOutcome', 'rmmDeviceId', 'rmmDeviceName', 'rmmAlertId',
    'rmmAlertPolicy', 'rmmSource',
  ]

  return tickets.map((ticket) => {
    const seed = seedsById.get(ticket.id)
    if (!seed) return ticket
    const enhancements = {}
    for (const field of enhancementFields) {
      if (ticket[field] === undefined && seed[field] !== undefined) enhancements[field] = seed[field]
    }
    return Object.keys(enhancements).length ? { ...ticket, ...enhancements } : ticket
  })
}

export function loadTickets() {
  const tickets = readMigratedJson('hi5central-tickets', 'lsl-itsm-tickets', seedTickets)
  const hydrated = hydrateTicketEnhancements(Array.isArray(tickets) ? tickets : seedTickets)
  const supplementalIds = new Set(['PRB-0148', 'PRB-0151', 'CHG-0904', 'CHG-0906', 'REQ-2231'])
  const currentIds = new Set(hydrated.map((ticket) => ticket.id))
  const supplemental = seedTickets.filter((ticket) => supplementalIds.has(ticket.id) && !currentIds.has(ticket.id))
  return [...hydrated, ...supplemental]
}

export function loadOrganisationPeople() {
  const stored = readJson('hi5central-organisation-people-v1', organisationPeople)
  if (!Array.isArray(stored) || !stored.length) return organisationPeople
  const seedsById = new Map(organisationPeople.map((person) => [person.id, person]))
  return stored.map((person) => ({ ...seedsById.get(person.id), ...person }))
}

export function loadOrganisationTeams() {
  const stored = readJson('hi5central-organisation-teams-v1', organisationTeams)
  if (!Array.isArray(stored) || !stored.length) return organisationTeams
  const seedsById = new Map(organisationTeams.map((team) => [team.id, team]))
  return stored.map((team) => ({ ...seedsById.get(team.id), ...team }))
}

export function loadOrganisationDepartments() {
  const stored = readJson('hi5central-organisation-departments-v1', organisationDepartments)
  if (!Array.isArray(stored) || !stored.length) return organisationDepartments
  const seedsById = new Map(organisationDepartments.map((department) => [department.id, department]))
  return stored.map((department) => ({ ...seedsById.get(department.id), ...department }))
}

export function loadOrganisationAudit() {
  const stored = readJson('hi5central-organisation-audit-v1', [])
  return Array.isArray(stored) ? stored : []
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
    status: 'Confirmed', start: '', end: '', isOverride: false, coverForId: '', note: '', ...entry,
  }))
}

export function loadCalendarEvents() {
  const stored = readJson('hi5central-calendar-v1', seedCalendarEvents)
  return Array.isArray(stored) ? stored : seedCalendarEvents
}

export function loadLiveChatPreferences() {
  const stored = readJson('hi5central-live-chat-preferences-v1', defaultLiveChatPreferences)
  return { ...defaultLiveChatPreferences, ...(stored && typeof stored === 'object' ? stored : {}) }
}

export function loadLiveChatConversations() {
  const stored = readJson('hi5central-live-chat-conversations-v1', seedLiveChatConversations)
  return Array.isArray(stored) && stored.length ? stored : seedLiveChatConversations
}

export function loadNotifications() {
  const stored = readJson('hi5central-notifications-v1', null)
  if (!Array.isArray(stored)) return createSeedNotifications()
  return stored.map((notification) => ({
    source: 'itsm', tone: 'info', read: false, createdAt: new Date().toISOString(), ...notification,
  }))
}

export function loadSession() {
  const production = readJson(PRODUCTION_SESSION_KEY, null)
  if (production?.source === 'production' && production?.role === 'analyst') return production

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

export function saveProductionSession(session) {
  if (session?.source === 'production' && session?.role === 'analyst') {
    writeJson(PRODUCTION_SESSION_KEY, session)
    return
  }
  window.localStorage.removeItem(PRODUCTION_SESSION_KEY)
}

export function clearProductionSession() {
  window.localStorage.removeItem(PRODUCTION_SESSION_KEY)
}

export function loadTheme() {
  const storedTheme = readJson('hi5central-theme-mode', null)
  return ['system', 'light', 'dark'].includes(storedTheme) ? storedTheme : 'system'
}

export function loadAccent() {
  const storedAccent = readJson('hi5central-accent', 'amber')
  return ['amber', 'cyan', 'blue', 'violet', 'emerald', 'rose'].includes(storedAccent) ? storedAccent : 'amber'
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
  if (workspace && Array.isArray(workspace.tabs)) writeJson('hi5central-workspace-analyst', workspace)
}

export function saveTickets(value) { writeJson('hi5central-tickets', value) }
export function saveOrganisationPeople(value) { writeJson('hi5central-organisation-people-v1', value); mirrorOrganisationCollection('people', value) }
export function saveOrganisationTeams(value) { writeJson('hi5central-organisation-teams-v1', value); mirrorOrganisationCollection('teams', value) }
export function saveOrganisationDepartments(value) { writeJson('hi5central-organisation-departments-v1', value); mirrorOrganisationCollection('departments', value) }
export function saveOrganisationAudit(value) { writeJson('hi5central-organisation-audit-v1', Array.isArray(value) ? value.slice(0, 500) : []) }
export function saveProjects(value) { writeJson('hi5central-projects-v1', value) }
export function saveRotaEntries(value) { writeJson('hi5central-rota-v1', value) }
export function saveCalendarEvents(value) { writeJson('hi5central-calendar-v1', value) }
export function saveLiveChatPreferences(value) { writeJson('hi5central-live-chat-preferences-v1', value) }
export function saveLiveChatConversations(value) { writeJson('hi5central-live-chat-conversations-v1', value) }
export function saveNotifications(value) { writeJson('hi5central-notifications-v1', value) }
export function saveTheme(value) { writeJson('hi5central-theme-mode', value) }
export function saveAccent(value) { writeJson('hi5central-accent', value) }
export function saveDensity(value) { writeJson('hi5central-density', value) }
export function saveSidebarMode(value) { writeJson('hi5central-sidebar-mode', value) }

export function loadPortalSession() {
  const stored = readJson('hi5central-portal-session', null)
  return stored?.role === 'requester' ? stored : null
}

export function savePortalSession(session) {
  if (session) {
    writeJson('hi5central-portal-session', session)
    return
  }
  window.localStorage.removeItem('hi5central-portal-session')
}

export function loadRmmSession() {
  const stored = readJson('hi5central-rmm-session', null)
  return stored?.role === 'rmm' ? stored : null
}

export function saveRmmSession(session) {
  if (session?.role === 'rmm') {
    writeJson('hi5central-rmm-session', session)
    return
  }
  window.localStorage.removeItem('hi5central-rmm-session')
}

export function saveSession(session) {
  if (session?.source === 'production') {
    saveProductionSession(session)
    return
  }

  if (session) {
    writeJson('hi5central-session', session)
    return
  }

  const hadProductionSession = Boolean(readJson(PRODUCTION_SESSION_KEY, null))
  window.localStorage.removeItem(PRODUCTION_SESSION_KEY)
  window.localStorage.removeItem('hi5central-session')
  window.localStorage.removeItem('lsl-itsm-session')

  if (hadProductionSession) {
    fetch(`${API_BASE}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {})
  }
}
