import { organisationPeople, organisationTeams } from './organisationData.js'

// Backwards-compatible aliases for existing planning imports. The organisation
// directory is now the single source of truth for people and teams.
export const workPeople = organisationPeople
export const workTeams = organisationTeams

export const projectTaskStatuses = []
export const projectStatuses = []
export const projectHealthOptions = []

export const seedProjects = []
