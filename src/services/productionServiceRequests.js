import { seedTickets } from '../data/demoData.jsx'

const API_BASE = 'https://api.hi5central.com'
const TICKETS_KEY = 'hi5central-tickets'

function readJson(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

function formatDate(value) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function nextStepFor(status) {
  if (status === 'Pending Approval') return 'Waiting for approval'
  if (status === 'Rejected') return 'Approval was rejected'
  if (status === 'Completed' || status === 'Closed') return 'Request completed'
  if (status === 'In Progress') return 'Fulfilment is in progress'
  return 'Service Desk review and fulfilment'
}

function activityForUi(activity) {
  return {
    ...activity,
    created: formatDate(activity.createdAt),
    createdAtLabel: formatDate(activity.createdAt),
  }
}

export function serviceRequestForWorkspace(request) {
  return {
    id: request.id,
    databaseId: request.databaseId,
    type: 'Service Request',
    title: request.title,
    description: request.description || '',
    descriptionHtml: request.descriptionHtml || '',
    requester: request.requester || '',
    requesterEmail: request.requesterEmail || '',
    requesterJobTitle: request.requesterJobTitle || '',
    requesterDepartment: request.requesterDepartment || '',
    requesterSite: request.requesterSite || '',
    service: request.service || 'Service Catalogue',
    team: request.team || 'Service Desk',
    assignee: 'Unassigned',
    priority: request.priority || 'Medium',
    status: request.status || 'New',
    created: formatDate(request.createdAt),
    updated: formatDate(request.updatedAt),
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    sla: request.status === 'Pending Approval' ? 'Paused for approval' : 'Not yet calculated',
    slaPercent: 0,
    nextStep: nextStepFor(request.status),
    catalogueItemId: request.catalogueItemId || '',
    catalogueItemTitle: request.catalogueItemTitle || '',
    requestInformation: Array.isArray(request.requestInformation) ? request.requestInformation : [],
    submittedFields: request.submittedFields || {},
    requestedItems: Array.isArray(request.requestedItems) ? request.requestedItems : [],
    requestApprovals: Array.isArray(request.requestApprovals) ? request.requestApprovals : [],
    requestTasks: Array.isArray(request.requestTasks) ? request.requestTasks : [],
    activities: Array.isArray(request.activities) ? request.activities.map(activityForUi) : [],
    comments: [],
    attachments: [],
    oneOffCost: Number(request.oneOffCost || 0),
    monthlyCost: Number(request.monthlyCost || 0),
    currency: request.currency || 'GBP',
    approvalMode: request.approvalMode || 'none',
    approvalThreshold: request.approvalThreshold,
    workflow: request.workflow || '',
    source: 'production-api',
    persistence: 'api',
  }
}

export async function fetchProductionServiceRequests() {
  const response = await fetch(`${API_BASE}/api/v1/service-requests?limit=200`, {
    credentials: 'include',
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Could not load Service Requests.')
  return Array.isArray(payload.items) ? payload.items : []
}

export function cacheProductionServiceRequests(requests) {
  const apiTickets = requests.map(serviceRequestForWorkspace)
  const stored = readJson(TICKETS_KEY, null)
  const base = Array.isArray(stored) ? stored : seedTickets
  const nonServiceRequests = base.filter((ticket) => ticket.type !== 'Service Request')
  const next = [...apiTickets, ...nonServiceRequests]
  window.localStorage.setItem(TICKETS_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('hi5-service-requests-hydrated', { detail: { requests: apiTickets } }))
  return next
}

export async function hydrateProductionServiceRequests() {
  const requests = await fetchProductionServiceRequests()
  cacheProductionServiceRequests(requests)
  return requests
}

export async function createProductionServiceRequest(payload) {
  const response = await fetch(`${API_BASE}/api/v1/service-requests`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Could not create the Service Request.')
  return result
}

export async function decideProductionServiceRequestApproval(reference, approvalId, decision, note = '') {
  const response = await fetch(`${API_BASE}/api/v1/service-requests/${encodeURIComponent(reference)}/approvals/${encodeURIComponent(approvalId)}/decision`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, note }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Could not save the approval decision.')
  return result
}
