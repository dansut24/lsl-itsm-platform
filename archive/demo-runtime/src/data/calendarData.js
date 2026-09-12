export const CALENDAR_DEMO_TODAY = '2026-09-01'

export const calendarEventTypes = [
  'Meeting',
  'Reminder',
  'Focus time',
  'Maintenance',
  'Other',
]

export const seedCalendarEvents = [
  {
    id: 'CAL-0001',
    title: 'Service Desk daily stand-up',
    date: '2026-09-01',
    start: '09:15',
    end: '09:30',
    allDay: false,
    type: 'Meeting',
    team: 'Service Desk',
    personId: 'AGT-DANA',
    description: 'Daily queue review, blockers and handover priorities.',
  },
  {
    id: 'CAL-0002',
    title: 'Copilot readiness checkpoint',
    date: '2026-09-03',
    start: '14:00',
    end: '14:45',
    allDay: false,
    type: 'Meeting',
    team: 'Service Desk',
    personId: 'AGT-DANA',
    description: 'Review security evidence and support-readiness actions for PRJ-0042.',
  },
  {
    id: 'CAL-0003',
    title: 'September service review pack',
    date: '2026-09-04',
    start: '',
    end: '',
    allDay: true,
    type: 'Reminder',
    team: 'Technology Leadership',
    personId: 'AGT-OLIVIA',
    description: 'Prepare the first draft of the monthly service review pack.',
  },
]
