export const ROTA_DEMO_WEEK_START = '2026-08-31'
export const ROTA_DEMO_TODAY = '2026-09-01'

export const rotaEntryTypes = [
  { id: 'Early', label: 'Early', category: 'shift', start: '07:30', end: '15:30', capacityHours: 8 },
  { id: 'Standard', label: 'Standard', category: 'shift', start: '09:00', end: '17:00', capacityHours: 8 },
  { id: 'Late', label: 'Late', category: 'shift', start: '12:00', end: '20:00', capacityHours: 8 },
  { id: 'On Call', label: 'On call', category: 'on-call', start: '17:00', end: '08:00', capacityHours: 0 },
  { id: 'Leave', label: 'Annual leave', category: 'absence', start: '', end: '', capacityHours: 0 },
  { id: 'Sickness', label: 'Sickness', category: 'absence', start: '', end: '', capacityHours: 0 },
  { id: 'Unavailable', label: 'Unavailable', category: 'absence', start: '', end: '', capacityHours: 0 },
]

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

export const seedRotaEntries = [
  // A complete prior week gives Copy previous week a useful source schedule.
  ...weekdayEntries('AGT-SOFIA', previousWeekdays, 'Early'),
  ...weekdayEntries('AGT-DANA', previousWeekdays, 'Standard'),
  ...weekdayEntries('AGT-EMILY', previousWeekdays, 'Standard'),
  ...weekdayEntries('AGT-LEWIS', previousWeekdays, 'Late'),
  rotaEntry('AGT-DANA', '2026-08-24', 'On Call'),
  rotaEntry('AGT-LEWIS', '2026-08-25', 'On Call'),
  rotaEntry('AGT-EMILY', '2026-08-26', 'On Call'),
  rotaEntry('AGT-SOFIA', '2026-08-27', 'On Call'),
  rotaEntry('AGT-DANA', '2026-08-28', 'On Call'),
  rotaEntry('AGT-LEWIS', '2026-08-29', 'On Call'),
  rotaEntry('AGT-EMILY', '2026-08-30', 'On Call'),

  // Current Service Desk week intentionally contains three visible coverage gaps.
  ...weekdayEntries('AGT-SOFIA', currentWeekdays, 'Early'),
  ...weekdayEntries('AGT-DANA', currentWeekdays.slice(0, 3), 'Standard'),
  rotaEntry('AGT-DANA', '2026-09-03', 'Leave', { note: 'Annual leave' }),
  rotaEntry('AGT-DANA', '2026-09-04', 'Leave', { note: 'Annual leave' }),
  ...weekdayEntries('AGT-EMILY', currentWeekdays.filter((date) => date !== '2026-09-03'), 'Standard'),
  rotaEntry('AGT-LEWIS', '2026-08-31', 'Late'),
  rotaEntry('AGT-LEWIS', '2026-09-01', 'Late'),
  rotaEntry('AGT-LEWIS', '2026-09-02', 'Sickness', { note: 'Reported before shift' }),
  rotaEntry('AGT-LEWIS', '2026-09-03', 'Late'),
  rotaEntry('AGT-LEWIS', '2026-09-04', 'Unavailable', { note: 'Training commitment' }),
  rotaEntry('AGT-DANA', '2026-08-31', 'On Call'),
  rotaEntry('AGT-LEWIS', '2026-09-01', 'On Call'),
  rotaEntry('AGT-EMILY', '2026-09-02', 'On Call'),
  rotaEntry('AGT-SOFIA', '2026-09-03', 'On Call'),
  rotaEntry('AGT-DANA', '2026-09-04', 'On Call'),
  rotaEntry('AGT-LEWIS', '2026-09-05', 'On Call'),
  rotaEntry('AGT-EMILY', '2026-09-03', 'Standard', {
    isOverride: true,
    coverForId: 'AGT-DANA',
    note: 'Temporary cover while Dana is on annual leave',
  }),

  // Supporting IT-team examples make the team selector useful without turning
  // this prototype into payroll or HR absence management.
  ...weekdayEntries('AGT-PRIYA', currentWeekdays.filter((date) => date !== '2026-09-02'), 'Standard'),
  rotaEntry('AGT-PRIYA', '2026-09-02', 'Leave', { note: 'Annual leave' }),
  ...weekdayEntries('AGT-JAMES', currentWeekdays, 'Standard'),
  rotaEntry('AGT-JAMES', '2026-08-31', 'On Call'),
  rotaEntry('AGT-PRIYA', '2026-09-01', 'On Call'),
  rotaEntry('AGT-JAMES', '2026-09-02', 'On Call'),
  rotaEntry('AGT-PRIYA', '2026-09-03', 'On Call'),
  rotaEntry('AGT-JAMES', '2026-09-04', 'On Call'),
  rotaEntry('AGT-PRIYA', '2026-09-05', 'On Call'),
  rotaEntry('AGT-JAMES', '2026-09-06', 'On Call'),
  ...weekdayEntries('AGT-NOAH', currentWeekdays, 'Standard'),
  ...weekdayEntries('AGT-MAYA', currentWeekdays.slice(0, 4), 'Standard'),
  rotaEntry('AGT-MAYA', '2026-09-04', 'Unavailable', { note: 'Leadership workshop' }),
  ...weekdayEntries('AGT-AISHA', currentWeekdays, 'Standard'),
]
