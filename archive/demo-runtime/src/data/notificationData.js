const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString()

export const notificationSourceLabels = {
  itsm: 'ITSM',
  livechat: 'Live Chat',
  projects: 'Projects',
  calendar: 'Calendar',
  rota: 'Rota',
}

export function createSeedNotifications() {
  return [
    {
      id: 'livechat-chat-1041',
      source: 'livechat',
      title: 'New chat waiting',
      detail: 'James Smith is waiting for help with a new laptop setup.',
      target: { type: 'livechat', conversationId: 'CHAT-1041' },
      createdAt: minutesAgo(4),
      tone: 'info',
      read: false,
    },
    {
      id: 'sla-inc-1032',
      source: 'itsm',
      title: 'SLA at risk',
      detail: 'INC-1032 has 43 minutes remaining on its resolution target.',
      target: { type: 'ticket', recordId: 'INC-1032' },
      createdAt: minutesAgo(8),
      tone: 'critical',
      read: false,
    },
    {
      id: 'project-task-4203',
      source: 'projects',
      title: 'Project task assigned to you',
      detail: 'Draft analyst support playbook is due on 18 September.',
      target: { type: 'project', projectId: 'PRJ-0042' },
      createdAt: minutesAgo(13),
      tone: 'warning',
      read: false,
    },
    {
      id: 'approval-req-2217',
      source: 'itsm',
      title: 'Approval required',
      detail: 'REQ-2217 is waiting for an approval before fulfilment can continue.',
      target: { type: 'ticket', recordId: 'REQ-2217' },
      createdAt: minutesAgo(18),
      tone: 'warning',
      read: false,
    },
    {
      id: 'rota-cover-dana',
      source: 'rota',
      title: 'Rota cover updated',
      detail: 'Emily Chen is covering Dana Sinclair while Dana is on annual leave.',
      target: { type: 'rota' },
      createdAt: minutesAgo(31),
      tone: 'info',
      read: true,
    },
    {
      id: 'calendar-copilot-checkpoint',
      source: 'calendar',
      title: 'Upcoming calendar event',
      detail: 'Copilot readiness checkpoint is scheduled for 14:00 tomorrow.',
      target: { type: 'calendar', eventId: 'CAL-0002' },
      createdAt: minutesAgo(47),
      tone: 'info',
      read: true,
    },
    {
      id: 'change-chg-0891',
      source: 'itsm',
      title: 'Change window approaching',
      detail: 'CHG-0891 is scheduled for implementation this evening.',
      target: { type: 'ticket', recordId: 'CHG-0891' },
      createdAt: minutesAgo(26 * 60),
      tone: 'info',
      read: true,
    },
  ]
}

export function createNotification(notification) {
  return {
    id: `NOT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    source: 'itsm',
    tone: 'info',
    read: false,
    createdAt: new Date().toISOString(),
    ...notification,
  }
}
