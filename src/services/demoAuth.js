import { loginProfiles } from '../data/demoData.jsx'

export function authenticateDemoUser(mode, credentials) {
  const profile = loginProfiles[mode]
  if (!profile) return null

  if (credentials.username !== profile.username || credentials.password !== profile.password) {
    return null
  }

  return {
    session: {
      role: profile.role,
      name: profile.name,
      initials: profile.initials,
      username: profile.username,
      profile: mode,
    },
    profile,
  }
}
