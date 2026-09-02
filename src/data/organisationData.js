export const organisationDepartments = [
  { id: 'DEPT-TECH', name: 'Technology', leadId: 'AGT-OLIVIA', description: 'Technology operations, service delivery, infrastructure and change.', location: 'UK', active: true },
  { id: 'DEPT-FIN', name: 'Finance', leadId: 'USR-HELEN', description: 'Finance operations, reporting and commercial controls.', location: 'UK', active: true },
  { id: 'DEPT-OPS', name: 'Operations', leadId: 'USR-AMELIA', description: 'Business operations and service coordination.', location: 'UK', active: true },
  { id: 'DEPT-PEOPLE', name: 'People', leadId: 'USR-SAM', description: 'People operations, employee experience and organisational support.', location: 'UK', active: true },
]

export const organisationTeams = [
  { id: 'TEAM-SD', name: 'Service Desk', leadId: 'AGT-DANA', departmentId: 'DEPT-TECH', colour: 'blue', description: 'First-line support, request fulfilment and customer communications.', active: true },
  { id: 'TEAM-INFRA', name: 'Infrastructure', leadId: 'AGT-JAMES', departmentId: 'DEPT-TECH', colour: 'violet', description: 'Cloud, network, identity and core platform engineering.', active: true },
  { id: 'TEAM-EUC', name: 'End User Compute', leadId: 'AGT-MAYA', departmentId: 'DEPT-TECH', colour: 'emerald', description: 'Devices, endpoint engineering and workplace technology.', active: true },
  { id: 'TEAM-CHANGE', name: 'Change Management', leadId: 'AGT-AISHA', departmentId: 'DEPT-TECH', colour: 'rose', description: 'Change governance, CAB coordination and release assurance.', active: true },
  { id: 'TEAM-LEADERSHIP', name: 'Technology Leadership', leadId: 'AGT-OLIVIA', departmentId: 'DEPT-TECH', colour: 'amber', description: 'Technology leadership, service strategy and governance.', active: true },
  { id: 'TEAM-FINANCE', name: 'Finance Operations', leadId: 'USR-HELEN', departmentId: 'DEPT-FIN', colour: 'cyan', description: 'Finance processing, analysis and business reporting.', active: true },
  { id: 'TEAM-BIZOPS', name: 'Business Operations', leadId: 'USR-AMELIA', departmentId: 'DEPT-OPS', colour: 'slate', description: 'Operational coordination and internal business services.', active: true },
  { id: 'TEAM-PEOPLE', name: 'People Operations', leadId: 'USR-SAM', departmentId: 'DEPT-PEOPLE', colour: 'rose', description: 'Employee lifecycle and people operations.', active: true },
]

const standardWeek = {
  monday: { enabled: true, start: '09:00', end: '17:00' },
  tuesday: { enabled: true, start: '09:00', end: '17:00' },
  wednesday: { enabled: true, start: '09:00', end: '17:00' },
  thursday: { enabled: true, start: '09:00', end: '17:00' },
  friday: { enabled: true, start: '09:00', end: '17:00' },
  saturday: { enabled: false, start: '', end: '' },
  sunday: { enabled: false, start: '', end: '' },
}

function person(overrides) {
  return {
    email: '',
    phone: '',
    managerId: '',
    departmentId: 'DEPT-TECH',
    teamId: '',
    status: 'Available',
    skills: [],
    workingPattern: standardWeek,
    capacityHours: 35,
    tone: 'blue',
    active: true,
    ...overrides,
  }
}

export const organisationPeople = [
  person({ id: 'AGT-DANA', name: 'Dana Sinclair', initials: 'DS', role: 'Senior Service Desk Analyst', team: 'Service Desk', teamId: 'TEAM-SD', managerId: 'AGT-OLIVIA', location: 'London HQ', capacityHours: 35, tone: 'blue', email: 'dana.sinclair@hi5central.com', phone: '+44 20 7946 0101', skills: ['Incident Management', 'Service Requests', 'Microsoft 365'], status: 'Available' }),
  person({ id: 'AGT-SOFIA', name: 'Sofia Martinez', initials: 'SM', role: 'Service Desk Analyst', team: 'Service Desk', teamId: 'TEAM-SD', managerId: 'AGT-DANA', location: 'Manchester', capacityHours: 35, tone: 'rose', email: 'sofia.martinez@hi5central.com', phone: '+44 161 555 0123', skills: ['Customer Support', 'Identity', 'Knowledge'], status: 'Busy' }),
  person({ id: 'AGT-LEWIS', name: 'Lewis Morgan', initials: 'LM', role: 'Service Desk Analyst', team: 'Service Desk', teamId: 'TEAM-SD', managerId: 'AGT-DANA', location: 'London HQ', capacityHours: 35, tone: 'cyan', email: 'lewis.morgan@hi5central.com', skills: ['Hardware', 'Service Requests', 'VIP Support'], status: 'Available' }),
  person({ id: 'AGT-EMILY', name: 'Emily Chen', initials: 'EC', role: 'Service Desk Analyst', team: 'Service Desk', teamId: 'TEAM-SD', managerId: 'AGT-DANA', location: 'Birmingham', capacityHours: 35, tone: 'emerald', email: 'emily.chen@hi5central.com', skills: ['Microsoft 365', 'Access', 'Knowledge'], status: 'Away' }),
  person({ id: 'AGT-PRIYA', name: 'Priya Raman', initials: 'PR', role: 'Infrastructure Engineer', team: 'Infrastructure', teamId: 'TEAM-INFRA', managerId: 'AGT-JAMES', location: 'London HQ', capacityHours: 35, tone: 'violet', email: 'priya.raman@hi5central.com', skills: ['Azure', 'Networking', 'Identity', 'Security'], status: 'Busy' }),
  person({ id: 'AGT-NOAH', name: 'Noah Williams', initials: 'NW', role: 'EUC Analyst', team: 'End User Compute', teamId: 'TEAM-EUC', managerId: 'AGT-MAYA', location: 'Birmingham', capacityHours: 35, tone: 'emerald', email: 'noah.williams@hi5central.com', skills: ['Intune', 'Windows 11', 'Hardware'], status: 'Available' }),
  person({ id: 'AGT-MAYA', name: 'Maya Ford', initials: 'MF', role: 'EUC Team Lead', team: 'End User Compute', teamId: 'TEAM-EUC', managerId: 'AGT-OLIVIA', location: 'Birmingham', capacityHours: 28, tone: 'amber', email: 'maya.ford@hi5central.com', skills: ['Endpoint Management', 'Intune', 'Leadership'], status: 'Available' }),
  person({ id: 'AGT-AISHA', name: 'Aisha Khan', initials: 'AK', role: 'Change Manager', team: 'Change Management', teamId: 'TEAM-CHANGE', managerId: 'AGT-OLIVIA', location: 'Manchester', capacityHours: 30, tone: 'rose', email: 'aisha.khan@hi5central.com', skills: ['Change Management', 'CAB', 'Risk'], status: 'Available' }),
  person({ id: 'AGT-JAMES', name: 'James Howard', initials: 'JH', role: 'Infrastructure Lead', team: 'Infrastructure', teamId: 'TEAM-INFRA', managerId: 'AGT-OLIVIA', location: 'London HQ', capacityHours: 28, tone: 'cyan', email: 'james.howard@hi5central.com', skills: ['Infrastructure', 'Networking', 'Azure', 'Leadership'], status: 'Available' }),
  person({ id: 'AGT-OLIVIA', name: 'Olivia Grant', initials: 'OG', role: 'Technology Director', team: 'Technology Leadership', teamId: 'TEAM-LEADERSHIP', managerId: '', location: 'London HQ', capacityHours: 20, tone: 'slate', email: 'olivia.grant@hi5central.com', skills: ['Strategy', 'Governance', 'Leadership'], status: 'Busy' }),
  person({ id: 'USR-ELEANOR', name: 'Eleanor Shaw', initials: 'ES', role: 'Operations Coordinator', team: 'Business Operations', teamId: 'TEAM-BIZOPS', departmentId: 'DEPT-OPS', managerId: 'USR-AMELIA', location: 'London HQ', tone: 'blue', email: 'eleanor.shaw@hi5central.com', skills: ['Operations', 'Coordination'], status: 'Available' }),
  person({ id: 'USR-MARCUS', name: 'Marcus Lee', initials: 'ML', role: 'Senior Finance Analyst', team: 'Finance Operations', teamId: 'TEAM-FINANCE', departmentId: 'DEPT-FIN', managerId: 'USR-HELEN', location: 'Birmingham', tone: 'cyan', email: 'marcus.lee@hi5central.com', skills: ['Finance', 'Reporting', 'Excel'], status: 'Available' }),
  person({ id: 'USR-HELEN', name: 'Helen Brooks', initials: 'HB', role: 'Head of Finance Operations', team: 'Finance Operations', teamId: 'TEAM-FINANCE', departmentId: 'DEPT-FIN', managerId: '', location: 'London HQ', capacityHours: 30, tone: 'violet', email: 'helen.brooks@hi5central.com', skills: ['Finance', 'Leadership', 'Approvals'], status: 'Available' }),
  person({ id: 'USR-AMELIA', name: 'Amelia Clarke', initials: 'AC', role: 'Operations Manager', team: 'Business Operations', teamId: 'TEAM-BIZOPS', departmentId: 'DEPT-OPS', managerId: '', location: 'Manchester', capacityHours: 30, tone: 'emerald', email: 'amelia.clarke@hi5central.com', skills: ['Operations', 'Leadership'], status: 'Away' }),
  person({ id: 'USR-SAM', name: 'Sam Patel', initials: 'SP', role: 'People Operations Lead', team: 'People Operations', teamId: 'TEAM-PEOPLE', departmentId: 'DEPT-PEOPLE', managerId: '', location: 'London HQ', capacityHours: 30, tone: 'rose', email: 'sam.patel@hi5central.com', skills: ['People Operations', 'Onboarding', 'Policy'], status: 'Available' }),
]

export const availabilityOptions = ['Available', 'Busy', 'Away', 'On Leave', 'Offline']
export const organisationLocations = ['London HQ', 'Manchester', 'Birmingham', 'Remote']
