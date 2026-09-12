import { organisationPeople, organisationTeams } from './organisationData.js'

// Backwards-compatible aliases for existing planning imports. The organisation
// directory is now the single source of truth for people and teams.
export const workPeople = organisationPeople
export const workTeams = organisationTeams

export const projectTaskStatuses = ['Backlog', 'To Do', 'In Progress', 'Blocked', 'Done']
export const projectStatuses = ['Planned', 'In Progress', 'On Hold', 'Complete']
export const projectHealthOptions = ['On Track', 'At Risk', 'Blocked', 'Complete']

export const seedProjects = [
  {
    id: 'PRJ-0042',
    name: 'Microsoft 365 Copilot readiness',
    description: 'Prepare identity, information protection, support readiness and controlled adoption for the first Copilot pilot group.',
    status: 'In Progress',
    health: 'On Track',
    priority: 'High',
    ownerId: 'AGT-DANA',
    sponsorId: 'AGT-OLIVIA',
    team: 'Service Desk',
    startDate: '2026-08-18',
    targetDate: '2026-10-09',
    updated: '18 min ago',
    summary: 'Pilot readiness is progressing to plan. The remaining focus is support enablement and security sign-off.',
    memberIds: ['AGT-DANA', 'AGT-PRIYA', 'AGT-AISHA', 'AGT-OLIVIA'],
    linkedRecords: ['REQ-2224', 'CHG-0906', 'INC-1032'],
    milestones: [
      { id: 'MS-42-1', title: 'Discovery and pilot scope', dueDate: '2026-08-22', status: 'Complete' },
      { id: 'MS-42-2', title: 'Security and data-readiness review', dueDate: '2026-09-11', status: 'In Progress' },
      { id: 'MS-42-3', title: 'Support model approved', dueDate: '2026-09-25', status: 'Planned' },
      { id: 'MS-42-4', title: 'Pilot launch', dueDate: '2026-10-09', status: 'Planned' },
    ],
    tasks: [
      { id: 'PT-4201', title: 'Confirm pilot user cohort', status: 'Done', priority: 'Medium', assigneeId: 'AGT-DANA', dueDate: '2026-08-21', plannedHours: 4, milestoneId: 'MS-42-1', linkedRecord: 'REQ-2224' },
      { id: 'PT-4202', title: 'Review information-protection controls', status: 'In Progress', priority: 'High', assigneeId: 'AGT-PRIYA', dueDate: '2026-09-08', plannedHours: 12, milestoneId: 'MS-42-2', linkedRecord: 'CHG-0906' },
      { id: 'PT-4203', title: 'Draft analyst support playbook', status: 'In Progress', priority: 'Medium', assigneeId: 'AGT-DANA', dueDate: '2026-09-18', plannedHours: 10, milestoneId: 'MS-42-3' },
      { id: 'PT-4204', title: 'Agree pilot success measures', status: 'To Do', priority: 'Medium', assigneeId: 'AGT-OLIVIA', dueDate: '2026-09-15', plannedHours: 5, milestoneId: 'MS-42-3' },
      { id: 'PT-4205', title: 'Complete security approval', status: 'Blocked', priority: 'High', assigneeId: 'AGT-AISHA', dueDate: '2026-09-11', plannedHours: 6, milestoneId: 'MS-42-2', linkedRecord: 'CHG-0906' },
      { id: 'PT-4206', title: 'Schedule pilot communications', status: 'Backlog', priority: 'Low', assigneeId: 'AGT-DANA', dueDate: '2026-09-29', plannedHours: 3, milestoneId: 'MS-42-4' },
    ],
    risks: [
      { id: 'RI-42-1', kind: 'Risk', title: 'Security approval may delay the pilot', severity: 'High', status: 'Open', ownerId: 'AGT-AISHA', response: 'Run twice-weekly control reviews until the approval evidence is complete.' },
      { id: 'RI-42-2', kind: 'Issue', title: 'Two pilot users do not have the required licence', severity: 'Medium', status: 'Mitigating', ownerId: 'AGT-DANA', response: 'Licence request linked to the onboarding service request.' },
    ],
    activity: [
      { id: 'ACT-42-1', actor: 'Dana Sinclair', action: 'updated the support-readiness milestone', meta: '18 min ago' },
      { id: 'ACT-42-2', actor: 'Aisha Khan', action: 'recorded a security approval risk', meta: 'Yesterday · 15:42' },
      { id: 'ACT-42-3', actor: 'Priya Raman', action: 'started the information-protection review', meta: 'Yesterday · 09:16' },
    ],
  },
  {
    id: 'PRJ-0041',
    name: 'London network resilience',
    description: 'Remove single points of failure across the London office edge, wireless controller and carrier failover services.',
    status: 'In Progress',
    health: 'At Risk',
    priority: 'Critical',
    ownerId: 'AGT-PRIYA',
    sponsorId: 'AGT-JAMES',
    team: 'Infrastructure',
    startDate: '2026-07-27',
    targetDate: '2026-09-30',
    updated: '1 hr ago',
    summary: 'Carrier lead time has compressed the test window. Technical delivery remains achievable if equipment arrives this week.',
    memberIds: ['AGT-PRIYA', 'AGT-JAMES', 'AGT-AISHA'],
    linkedRecords: ['INC-1032', 'CHG-0891', 'CHG-0904'],
    milestones: [
      { id: 'MS-41-1', title: 'Resilience design approved', dueDate: '2026-08-07', status: 'Complete' },
      { id: 'MS-41-2', title: 'Secondary carrier installed', dueDate: '2026-09-12', status: 'At Risk' },
      { id: 'MS-41-3', title: 'Failover validation', dueDate: '2026-09-24', status: 'Planned' },
    ],
    tasks: [
      { id: 'PT-4101', title: 'Complete edge dependency map', status: 'Done', priority: 'High', assigneeId: 'AGT-PRIYA', dueDate: '2026-08-05', plannedHours: 8, milestoneId: 'MS-41-1' },
      { id: 'PT-4102', title: 'Confirm carrier delivery date', status: 'Blocked', priority: 'Critical', assigneeId: 'AGT-JAMES', dueDate: '2026-09-03', plannedHours: 3, milestoneId: 'MS-41-2' },
      { id: 'PT-4103', title: 'Prepare firewall failover change', status: 'In Progress', priority: 'High', assigneeId: 'AGT-PRIYA', dueDate: '2026-09-10', plannedHours: 10, milestoneId: 'MS-41-2', linkedRecord: 'CHG-0904' },
      { id: 'PT-4104', title: 'Book out-of-hours test support', status: 'To Do', priority: 'Medium', assigneeId: 'AGT-AISHA', dueDate: '2026-09-14', plannedHours: 4, milestoneId: 'MS-41-3' },
    ],
    risks: [
      { id: 'RI-41-1', kind: 'Issue', title: 'Secondary carrier hardware is delayed', severity: 'Critical', status: 'Open', ownerId: 'AGT-JAMES', response: 'Escalated to the supplier account director; temporary test equipment requested.' },
    ],
    activity: [
      { id: 'ACT-41-1', actor: 'James Howard', action: 'escalated the carrier delivery issue', meta: '1 hr ago' },
      { id: 'ACT-41-2', actor: 'Priya Raman', action: 'linked CHG-0904 to the delivery plan', meta: 'Yesterday · 13:05' },
    ],
  },
  {
    id: 'PRJ-0040',
    name: 'Windows 11 deployment wave 3',
    description: 'Deploy the approved Windows 11 build to Finance and Operations devices with readiness checks and floor-walking support.',
    status: 'Planned',
    health: 'On Track',
    priority: 'Medium',
    ownerId: 'AGT-NOAH',
    sponsorId: 'AGT-MAYA',
    team: 'End User Compute',
    startDate: '2026-09-14',
    targetDate: '2026-11-06',
    updated: 'Yesterday',
    summary: 'Device eligibility is confirmed and the deployment plan is ready for final business scheduling.',
    memberIds: ['AGT-NOAH', 'AGT-MAYA', 'AGT-DANA'],
    linkedRecords: ['REQ-2217', 'INC-1050'],
    milestones: [
      { id: 'MS-40-1', title: 'Business schedule confirmed', dueDate: '2026-09-18', status: 'Planned' },
      { id: 'MS-40-2', title: 'Finance deployment complete', dueDate: '2026-10-16', status: 'Planned' },
      { id: 'MS-40-3', title: 'Operations deployment complete', dueDate: '2026-11-06', status: 'Planned' },
    ],
    tasks: [
      { id: 'PT-4001', title: 'Validate device eligibility report', status: 'Done', priority: 'Medium', assigneeId: 'AGT-NOAH', dueDate: '2026-08-28', plannedHours: 6, milestoneId: 'MS-40-1' },
      { id: 'PT-4002', title: 'Confirm Finance deployment groups', status: 'To Do', priority: 'Medium', assigneeId: 'AGT-MAYA', dueDate: '2026-09-15', plannedHours: 5, milestoneId: 'MS-40-1' },
      { id: 'PT-4003', title: 'Prepare floor-walking rota', status: 'Backlog', priority: 'Low', assigneeId: 'AGT-DANA', dueDate: '2026-10-02', plannedHours: 4, milestoneId: 'MS-40-2' },
    ],
    risks: [],
    activity: [
      { id: 'ACT-40-1', actor: 'Noah Williams', action: 'completed the eligibility review', meta: 'Yesterday · 11:24' },
    ],
  },
  {
    id: 'PRJ-0038',
    name: 'Service catalogue launch',
    description: 'Design and launch the initial hardware, access and onboarding catalogue for the employee self-service portal.',
    status: 'Complete',
    health: 'Complete',
    priority: 'High',
    ownerId: 'AGT-DANA',
    sponsorId: 'AGT-OLIVIA',
    team: 'Service Desk',
    startDate: '2026-05-11',
    targetDate: '2026-08-14',
    updated: '18 Aug 2026',
    summary: 'The first catalogue release is live with hardware and onboarding request experiences.',
    memberIds: ['AGT-DANA', 'AGT-NOAH', 'AGT-AISHA'],
    linkedRecords: ['REQ-2217', 'REQ-2224'],
    milestones: [
      { id: 'MS-38-1', title: 'Catalogue design', dueDate: '2026-06-12', status: 'Complete' },
      { id: 'MS-38-2', title: 'Workflow validation', dueDate: '2026-07-24', status: 'Complete' },
      { id: 'MS-38-3', title: 'Production launch', dueDate: '2026-08-14', status: 'Complete' },
    ],
    tasks: [
      { id: 'PT-3801', title: 'Publish laptop catalogue items', status: 'Done', priority: 'High', assigneeId: 'AGT-NOAH', dueDate: '2026-07-10', plannedHours: 12, milestoneId: 'MS-38-1', linkedRecord: 'REQ-2217' },
      { id: 'PT-3802', title: 'Validate onboarding workflow', status: 'Done', priority: 'High', assigneeId: 'AGT-DANA', dueDate: '2026-07-24', plannedHours: 16, milestoneId: 'MS-38-2', linkedRecord: 'REQ-2224' },
      { id: 'PT-3803', title: 'Complete launch review', status: 'Done', priority: 'Medium', assigneeId: 'AGT-AISHA', dueDate: '2026-08-17', plannedHours: 4, milestoneId: 'MS-38-3' },
    ],
    risks: [
      { id: 'RI-38-1', kind: 'Risk', title: 'Request costs may become stale', severity: 'Medium', status: 'Closed', ownerId: 'AGT-DANA', response: 'Catalogue submissions now carry a price snapshot.' },
    ],
    activity: [
      { id: 'ACT-38-1', actor: 'Dana Sinclair', action: 'closed the project after launch review', meta: '18 Aug 2026 · 16:20' },
    ],
  },
]
