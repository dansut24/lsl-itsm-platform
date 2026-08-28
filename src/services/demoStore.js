import { loginProfiles, seedTickets } from '../data/demoData.jsx'

function readJson(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

export function loadTickets() {
  return readJson('lsl-itsm-tickets', seedTickets)
}

export function loadSession() {
  const storedSession = readJson('lsl-itsm-session', null)
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
  return readJson('lsl-itsm-theme', 'light')
}

export function loadSidebarMode() {
  const storedMode = readJson('lsl-itsm-sidebar-mode', 'expanded')
  return ['expanded', 'collapsed', 'hidden'].includes(storedMode) ? storedMode : 'expanded'
}

export function saveTickets(tickets) {
  writeJson('lsl-itsm-tickets', tickets)
}

export function saveTheme(theme) {
  writeJson('lsl-itsm-theme', theme)
}

export function saveSidebarMode(mode) {
  writeJson('lsl-itsm-sidebar-mode', mode)
}

export function saveSession(session) {
  if (session) {
    writeJson('lsl-itsm-session', session)
    return
  }

  window.localStorage.removeItem('lsl-itsm-session')
}
