import { loginProfiles, seedTickets } from '../data/demoData.jsx'

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
  return hydrateTicketEnhancements(Array.isArray(tickets) ? tickets : seedTickets)
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
