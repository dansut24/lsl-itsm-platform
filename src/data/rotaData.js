export const ROTA_DEMO_WEEK_START = '2026-08-31'
export const ROTA_DEMO_TODAY = '2026-09-01'

export const rotaEntryTypes = []

export const rotaCoverageRules = {
  'Service Desk': {
    weekday: ['Early', 'Late'],
    weekend: ['On Call'],
  },
  Infrastructure: {
    weekday: ['Standard'],
    weekend: ['On Call'],
  },
  'End User Compute': {
    weekday: ['Standard'],
    weekend: [],
  },
  'Change Management': {
    weekday: ['Standard'],
    weekend: [],
  },
}

let seedId = 0

function rotaEntry(personId, date, type, overrides = {}) {
  const preset = rotaEntryTypes.find((item) => item.id === type)
  seedId += 1
  return {
    id: `ROT-${String(seedId).padStart(4, '0')}`,
    personId,
    date,
    type,
    start: preset?.start || '',
    end: preset?.end || '',
    status: 'Confirmed',
    isOverride: false,
    coverForId: '',
    note: '',
    ...overrides,
  }
}

function weekdayEntries(personId, dates, type, overrides = {}) {
  return dates.map((date) => rotaEntry(personId, date, type, overrides))
}

const previousWeekdays = ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28']
const currentWeekdays = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']

export const seedRotaEntries = []
