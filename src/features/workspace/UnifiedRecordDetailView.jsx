import { useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  ClipboardCheck,
  Clock3,
  FileText,
  Inbox,
  ListChecks,
  MessageSquarePlus,
  Paperclip,
  Plus,
  Send,
  Server,
  Share2,
  Trash2,
  UserCheck,
  UserRound,
  Users,
  Wrench,
} from 'lucide-react'
import { priorityClass, statusClass } from '../../lib/workspace.js'

const recordTypeMeta = {
  Incident: {
    className: 'incident',
    label: 'Incident',
    lifecycle: ['New', 'In Progress', 'Pending', 'Resolved', 'Closed'],
  },
  'Service Request': {
    className: 'request',
    label: 'Service Request',
    lifecycle: ['New', 'Pending Approval', 'In Progress', 'Resolved', 'Closed'],
  },
  Problem: {
    className: 'problem',
    label: 'Problem',
    lifecycle: ['New', 'Under Investigation', 'Known Error', 'Fix in Progress', 'Resolved', 'Closed'],
  },
  Change: {
    className: 'change',
    label: 'Change',
    lifecycle: ['Draft', 'Pending Approval', 'CAB Review', 'Scheduled', 'In Progress', 'Review', 'Closed'],
  },
}

const commonTabs = [
  { id: 'overview', label: 'Overview', icon: Inbox },
  { id: 'activity', label: 'Activity', icon: MessageSquarePlus },
  { id: 'tasks', label: 'Tasks', icon: ListChecks },
  { id: 'related', label: 'Related', icon: Share2 },
  { id: 'attachments', label: 'Attachments', icon: Paperclip },
]

const incidentPendingReasons = [
  'Awaiting customer',
  'Awaiting vendor',
  'Awaiting change',
  'Awaiting third party',
  'Scheduled',
]

const incidentResolutionCodes = [
  'Resolved - fix applied',
  'Resolved - workaround provided',
  'Resolved - user action',
  'Resolved - no fault found',
  'Resolved - duplicate',
]

function initials(value = '') {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '??'
}

function valueOrFallback(value, fallback = 'Not captured') {
  return value === undefined || value === null || value === '' ? fallback : value
}

function currency(value) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function fileSize(bytes = 0) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function incidentSlaTargets(priority) {
  if (priority === 'Critical') return { response: '15 min', resolution: '1 hr' }
  if (priority === 'High') return { response: '30 min', resolution: '4 hr' }
  if (priority === 'Medium') return { response: '1 hr', resolution: '8 hr' }
  return { response: '4 hr', resolution: '2 business days' }
}

function inferredImpact(priority) {
  if (priority === 'Critical') return 'Widespread / business critical'
  if (priority === 'High') return 'Multiple users / major service impact'
  if (priority === 'Medium') return 'Limited group / degraded service'
  return 'Single user / low business impact'
}

function inferredUrgency(priority) {
  if (priority === 'Critical') return 'Immediate'
  if (priority === 'High') return 'High'
  if (priority === 'Medium') return 'Normal'
  return 'Low'
}

function lifecycleIndex(ticket, lifecycle) {
  const direct = lifecycle.indexOf(ticket.status)
  if (direct >= 0) return direct

  const aliases = {
    Monitoring: 'In Progress',
    'Pending Approval': 'Pending Approval',
    'CAB Review': 'CAB Review',
    Scheduled: 'Scheduled',
    'Under Investigation': 'Under Investigation',
    'Known Error': 'Known Error',
    'Fix in Progress': 'Fix in Progress',
  }
  const alias = aliases[ticket.status]
  const index = alias ? lifecycle.indexOf(alias) : -1
  return index >= 0 ? index : 0
}

function relatedRecordIds(ticket, tickets) {
  const ids = new Set([
    ...(ticket.relatedIncidents || []),
    ...(ticket.relatedProblems || []),
    ...(ticket.relatedChanges || []),
    ...(ticket.relatedRequests || []),
    ...(ticket.relatedRecords || []),
  ])

  tickets.forEach((candidate) => {
    if (candidate.id === ticket.id) return
    const candidateLinks = [
      ...(candidate.relatedIncidents || []),
      ...(candidate.relatedProblems || []),
      ...(candidate.relatedChanges || []),
      ...(candidate.relatedRequests || []),
      ...(candidate.relatedRecords || []),
    ]
    if (candidateLinks.includes(ticket.id)) ids.add(candidate.id)
  })

  return ids
}

function syntheticTasks(ticket) {
  if (ticket.requestTasks?.length) return ticket.requestTasks

  if (ticket.type === 'Incident') {
    const progressed = ticket.status !== 'New'
    const resolved = ['Resolved', 'Closed'].includes(ticket.status)
    return [
      {
        id: `${ticket.id}-TRIAGE`,
        title: 'Triage and validate impact',
        team: ticket.team,
        assignee: ticket.assignee,
        status: progressed ? 'Completed' : 'Ready',
        due: 'Immediate',
        instructions: 'Confirm symptoms, affected users, service impact and initial diagnostics.',
      },
      {
        id: `${ticket.id}-RESTORE`,
        title: 'Investigate and restore service',
        team: ticket.team,
        assignee: ticket.assignee,
        status: resolved ? 'Completed' : progressed ? 'In Progress' : 'Waiting',
        due: ticket.sla,
        instructions: 'Progress technical investigation and apply the safest available restoration action.',
      },
      {
        id: `${ticket.id}-CONFIRM`,
        title: 'Confirm restoration and resolution',
        team: 'Service Desk',
        assignee: ticket.assignee,
        status: ticket.status === 'Closed' ? 'Completed' : ticket.status === 'Resolved' ? 'Ready' : 'Waiting',
        due: 'Before closure',
        instructions: 'Validate service restoration with the requester and capture the final resolution.',
      },
    ]
  }

  if (ticket.type === 'Problem') {
    return [
      {
        id: `${ticket.id}-ANALYSE`,
        title: 'Analyse related incidents and evidence',
        team: ticket.team,
        assignee: ticket.assignee,
        status: ticket.problemHypothesis ? 'Completed' : 'In Progress',
        due: 'Investigation',
        instructions: 'Correlate incident symptoms, affected configuration and recurring patterns.',
      },
      {
        id: `${ticket.id}-RCA`,
        title: 'Validate root cause and workaround',
        team: ticket.team,
        assignee: ticket.assignee,
        status: ticket.problemRootCause ? 'Completed' : ticket.problemWorkaround ? 'In Progress' : 'Waiting',
        due: 'Before known error',
        instructions: 'Prove or disprove the working hypothesis and document a safe workaround.',
      },
      {
        id: `${ticket.id}-FIX`,
        title: 'Deliver permanent corrective action',
        team: ticket.team,
        assignee: ticket.assignee,
        status: ticket.status === 'Resolved' || ticket.status === 'Closed' ? 'Completed' : ticket.relatedChanges?.length ? 'In Progress' : 'Waiting',
        due: 'Problem target',
        instructions: 'Coordinate the permanent fix, normally through a controlled change, and verify the outcome.',
      },
    ]
  }

  if (ticket.type === 'Change') {
    const approved = ['Scheduled', 'In Progress', 'Review', 'Closed'].includes(ticket.status) || ticket.approval === 'Approved'
    const implementing = ['In Progress', 'Review', 'Closed'].includes(ticket.status)
    return [
      {
        id: `${ticket.id}-ASSESS`,
        title: 'Risk assessment and approval',
        team: ticket.team,
        assignee: ticket.assignee,
        status: approved ? 'Completed' : 'In Progress',
        due: ticket.window || 'Before implementation',
        instructions: 'Confirm risk, affected CIs, approvals, implementation window and backout readiness.',
      },
      {
        id: `${ticket.id}-IMPLEMENT`,
        title: 'Implement approved change',
        team: ticket.team,
        assignee: ticket.assignee,
        status: ticket.status === 'Closed' || ticket.status === 'Review' ? 'Completed' : implementing ? 'In Progress' : 'Waiting',
        due: ticket.plannedStart || ticket.window || 'Scheduled window',
        instructions: ticket.implementationPlan || 'Execute the approved implementation plan.',
      },
      {
        id: `${ticket.id}-REVIEW`,
        title: 'Validate and complete post-change review',
        team: ticket.team,
        assignee: ticket.assignee,
        status: ticket.status === 'Closed' ? 'Completed' : ticket.status === 'Review' ? 'Ready' : 'Waiting',
        due: 'After implementation',
        instructions: ticket.testPlan || 'Validate service health and record the change outcome.',
      },
    ]
  }

  return []
}

function DetailProperty({ label, value, emphasis = false }) {
  return (
    <div className={emphasis ? 'unified-detail-property emphasis' : 'unified-detail-property'}>
      <span>{label}</span>
      <strong>{valueOrFallback(value)}</strong>
    </div>
  )
}

function DetailSection({ children, eyebrow, icon: Icon, title, className = '' }) {
  return (
    <section className={`unified-detail-section ${className}`.trim()}>
      <header className="unified-detail-section-heading">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h3>{title}</h3>
        </div>
        {Icon && <Icon size={19} aria-hidden="true" />}
      </header>
      {children}
    </section>
  )
}

function RequestOverview({ ticket }) {
  const items = ticket.requestedItems || []
  const approvals = ticket.requestApprovals || []
  const tasks = ticket.requestTasks || []
  const totalCost = items.reduce((sum, item) => sum + (item.unitCost || 0) * (item.quantity || 1), 0)
  const completedTasks = tasks.filter((task) => task.status === 'Completed').length
  const approved = approvals.filter((approval) => approval.status === 'Approved').length

  return (
    <div className="unified-type-overview request">
      <div className="unified-detail-metric-grid">
        <div><span>Requested items</span><strong>{items.length}</strong><small>{currency(totalCost)} captured cost</small></div>
        <div><span>Approvals</span><strong>{approved}/{approvals.length || 0}</strong><small>{approvals.some((item) => item.status === 'Pending') ? 'Approval outstanding' : 'No approval blocker'}</small></div>
        <div><span>Fulfilment</span><strong>{completedTasks}/{tasks.length || 0}</strong><small>Tasks completed</small></div>
      </div>

      <DetailSection eyebrow="Submitted fields" icon={UserRound} title="Request information">
        <div className="unified-detail-property-grid three">
          {(ticket.requestInformation?.length
            ? ticket.requestInformation
            : [
                { label: 'Requester', value: ticket.requester },
                { label: 'Department', value: ticket.requesterDepartment },
                { label: 'Job title', value: ticket.requesterJobTitle },
              ]
          ).map((item, index) => (
            <DetailProperty key={`${item.label}-${index}`} label={item.label} value={item.value} />
          ))}
        </div>
      </DetailSection>

      <DetailSection eyebrow="Catalogue" icon={ClipboardCheck} title="Requested items">
        {items.length ? (
          <div className="unified-detail-item-list">
            {items.map((item) => (
              <article key={item.id || item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.category} · Qty {item.quantity || 1}</span>
                  {!!item.options?.length && <small>{item.options.join(' · ')}</small>}
                </div>
                <b>{currency((item.unitCost || 0) * (item.quantity || 1))}</b>
              </article>
            ))}
          </div>
        ) : <p className="unified-detail-empty-copy">No structured catalogue items are attached to this request.</p>}
      </DetailSection>

      <DetailSection eyebrow="Governance" icon={CheckCircle2} title="Approvals">
        {approvals.length ? (
          <div className="unified-detail-approval-list">
            {approvals.map((approval) => (
              <article key={approval.id}>
                <span className={`unified-detail-state ${statusClass(approval.status)}`}>{approval.status}</span>
                <div><strong>{approval.label}</strong><small>{approval.approver} · {approval.updated}</small></div>
              </article>
            ))}
          </div>
        ) : <p className="unified-detail-empty-copy">This request has no approval stage.</p>}
      </DetailSection>
    </div>
  )
}

function IncidentOverview({ ticket }) {
  const targets = incidentSlaTargets(ticket.priority)
  return (
    <div className="unified-type-overview incident">
      <div className="unified-detail-metric-grid">
        <div><span>First response</span><strong>{targets.response}</strong><small>Target</small></div>
        <div><span>Resolution</span><strong>{targets.resolution}</strong><small>{ticket.sla} remaining / target state</small></div>
        <div><span>SLA consumed</span><strong>{Math.min(100, ticket.slaPercent || 0)}%</strong><small>{ticket.status === 'Pending' ? 'Pending clock rules apply' : ticket.sla}</small></div>
      </div>

      <DetailSection eyebrow="Service management" icon={CircleGauge} title="Impact, urgency & SLA">
        <div className="unified-detail-property-grid three">
          <DetailProperty label="Impact" value={ticket.impact || inferredImpact(ticket.priority)} />
          <DetailProperty label="Urgency" value={ticket.urgency || inferredUrgency(ticket.priority)} />
          <DetailProperty label="Priority" value={ticket.priority} emphasis />
          <DetailProperty label="Response target" value={targets.response} />
          <DetailProperty label="Resolution target" value={targets.resolution} />
          <DetailProperty label="SLA position" value={`${Math.min(100, ticket.slaPercent || 0)}% consumed`} />
        </div>
        <div className="unified-detail-progress" aria-label={`${ticket.slaPercent || 0}% of SLA consumed`}>
          <span style={{ width: `${Math.min(100, ticket.slaPercent || 0)}%` }} />
        </div>
      </DetailSection>

      {(ticket.pendingReason || ticket.resolutionCode || ticket.resolutionNotes) && (
        <DetailSection eyebrow="Current state" icon={CheckCircle2} title="Resolution and hold information">
          <div className="unified-detail-property-grid two">
            <DetailProperty label="Pending reason" value={ticket.pendingReason} />
            <DetailProperty label="Resolution code" value={ticket.resolutionCode} />
          </div>
          {ticket.resolutionNotes && <p className="unified-detail-long-copy">{ticket.resolutionNotes}</p>}
        </DetailSection>
      )}
    </div>
  )
}

function ChangeOverview({ ticket }) {
  return (
    <div className="unified-type-overview change">
      <div className="unified-detail-metric-grid">
        <div><span>Change type</span><strong>{valueOrFallback(ticket.changeType, 'Normal')}</strong><small>{ticket.risk || ticket.priority} risk</small></div>
        <div><span>Approval</span><strong>{valueOrFallback(ticket.approval, ticket.status)}</strong><small>{valueOrFallback(ticket.approvalRoute, 'Standard route')}</small></div>
        <div><span>Window</span><strong>{valueOrFallback(ticket.window, 'Not scheduled')}</strong><small>{valueOrFallback(ticket.downtime, 'Downtime not defined')}</small></div>
      </div>

      <DetailSection eyebrow="Assessment" icon={AlertCircle} title="Risk and governance">
        <div className="unified-detail-property-grid three">
          <DetailProperty label="Change type" value={ticket.changeType || 'Normal'} />
          <DetailProperty label="Risk" value={ticket.risk || ticket.priority} emphasis />
          <DetailProperty label="Approval route" value={ticket.approvalRoute} />
          <DetailProperty label="Planned start" value={ticket.plannedStart || ticket.window} />
          <DetailProperty label="Planned end" value={ticket.plannedEnd} />
          <DetailProperty label="Expected downtime" value={ticket.downtime} />
        </div>
        {ticket.riskSummary && <div className="unified-detail-callout"><span>Risk summary</span><strong>{ticket.riskSummary}</strong></div>}
      </DetailSection>

      <div className="unified-detail-plan-grid">
        <DetailSection eyebrow="Why" title="Business reason"><p className="unified-detail-long-copy">{valueOrFallback(ticket.businessReason)}</p></DetailSection>
        <DetailSection eyebrow="Plan" title="Implementation"><p className="unified-detail-long-copy">{valueOrFallback(ticket.implementationPlan)}</p></DetailSection>
        <DetailSection eyebrow="Validation" title="Test plan"><p className="unified-detail-long-copy">{valueOrFallback(ticket.testPlan)}</p></DetailSection>
        <DetailSection eyebrow="Recovery" title="Backout plan"><p className="unified-detail-long-copy">{valueOrFallback(ticket.backoutPlan)}</p></DetailSection>
      </div>
    </div>
  )
}

function ProblemOverview({ ticket }) {
  return (
    <div className="unified-type-overview problem">
      <div className="unified-detail-metric-grid">
        <div><span>Related incidents</span><strong>{ticket.relatedIncidents?.length || 0}</strong><small>Linked symptoms / impact</small></div>
        <div><span>Corrective changes</span><strong>{ticket.relatedChanges?.length || 0}</strong><small>Permanent-fix activity</small></div>
        <div><span>Known error</span><strong>{valueOrFallback(ticket.knownErrorStatus, 'Not declared')}</strong><small>{ticket.knowledgeArticle || 'Knowledge not linked'}</small></div>
      </div>

      <DetailSection eyebrow="Investigation" icon={Wrench} title="Problem analysis">
        <div className="unified-detail-stack">
          <div><span>Impact scope</span><p>{valueOrFallback(ticket.problemImpactScope)}</p></div>
          <div><span>Working hypothesis</span><p>{valueOrFallback(ticket.problemHypothesis)}</p></div>
          <div><span>Current workaround</span><p>{valueOrFallback(ticket.problemWorkaround)}</p></div>
        </div>
      </DetailSection>

      <DetailSection eyebrow="Known error" icon={BookOpen} title={ticket.knownErrorTitle || 'Known error record'}>
        <div className="unified-detail-property-grid two">
          <DetailProperty label="Status" value={ticket.knownErrorStatus || 'Not declared'} />
          <DetailProperty label="Knowledge article" value={ticket.knowledgeArticle} />
        </div>
        {!!ticket.affectedVersions?.length && (
          <div className="unified-detail-chip-row">
            {ticket.affectedVersions.map((version) => <span key={version}>{version}</span>)}
          </div>
        )}
      </DetailSection>

      <DetailSection eyebrow="Permanent resolution" icon={CheckCircle2} title="Root cause and corrective action">
        <div className="unified-detail-stack">
          <div><span>Root cause</span><p>{valueOrFallback(ticket.problemRootCause)}</p></div>
          <div><span>Permanent fix</span><p>{valueOrFallback(ticket.problemPermanentFix)}</p></div>
        </div>
      </DetailSection>
    </div>
  )
}

function TypeOverview({ ticket }) {
  if (ticket.type === 'Service Request') return <RequestOverview ticket={ticket} />
  if (ticket.type === 'Change') return <ChangeOverview ticket={ticket} />
  if (ticket.type === 'Problem') return <ProblemOverview ticket={ticket} />
  return <IncidentOverview ticket={ticket} />
}

function activityActor(comment) {
  if (/^system:/i.test(comment)) return 'System'
  if (/^customer comment:/i.test(comment)) return 'Requester'
  if (/^work note:/i.test(comment)) return 'Dana Sinclair'
  return 'Service Desk'
}

export function UnifiedRecordDetailView({
  addComment,
  newComment,
  openAssetByName,
  openRecordTab,
  setNewComment,
  ticket,
  tickets,
  updateTicket,
}) {
  const [activeTab, setActiveTab] = useState('overview')
  const [noteMode, setNoteMode] = useState('work')
  const [workflowMode, setWorkflowMode] = useState(null)
  const [pendingReason, setPendingReason] = useState(ticket.pendingReason || incidentPendingReasons[0])
  const [resolutionCode, setResolutionCode] = useState(ticket.resolutionCode || incidentResolutionCodes[0])
  const [resolutionNotes, setResolutionNotes] = useState(ticket.resolutionNotes || '')
  const fileInputRef = useRef(null)
  const meta = recordTypeMeta[ticket.type] || recordTypeMeta.Incident
  const currentLifecycleIndex = lifecycleIndex(ticket, meta.lifecycle)
  const tasks = useMemo(() => syntheticTasks(ticket), [ticket])
  const attachments = ticket.attachments || []

  const relatedRecords = useMemo(() => {
    const ids = relatedRecordIds(ticket, tickets)
    return tickets.filter((candidate) => ids.has(candidate.id))
  }, [ticket, tickets])

  const requesterRecords = useMemo(() => (
    tickets
      .filter((candidate) => candidate.id !== ticket.id && candidate.requester === ticket.requester)
      .slice(0, 6)
  ), [ticket, tickets])

  function handleStatusChange(event) {
    const status = event.target.value
    updateTicket(ticket.id, {
      status,
      nextStep: status === 'Closed' ? `${meta.label} closed.` : ticket.nextStep,
    })
  }

  function confirmPending() {
    updateTicket(ticket.id, {
      status: 'Pending',
      pendingReason,
      nextStep: pendingReason,
    })
    setWorkflowMode(null)
  }

  function confirmResolution() {
    if (!resolutionNotes.trim()) return
    updateTicket(ticket.id, {
      status: 'Resolved',
      resolutionCode,
      resolutionNotes: resolutionNotes.trim(),
      sla: 'Met',
      slaPercent: 100,
      nextStep: 'Confirm service restoration and close after validation.',
    })
    setWorkflowMode(null)
  }

  function attachFiles(event) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    const created = files.map((file, index) => ({
      id: `${ticket.id}-ATT-${Date.now()}-${index}`,
      name: file.name,
      size: file.size,
      type: file.type || 'File',
      uploaded: 'Just now',
      uploadedBy: 'Dana Sinclair',
    }))
    updateTicket(ticket.id, { attachments: [...attachments, ...created] })
    event.target.value = ''
  }

  function removeAttachment(id) {
    updateTicket(ticket.id, { attachments: attachments.filter((attachment) => attachment.id !== id) })
  }

  function renderWorkflowPanel() {
    if (ticket.type !== 'Incident' || !workflowMode) return null

    if (workflowMode === 'pending') {
      return (
        <section className="unified-detail-workflow-panel">
          <div><span className="eyebrow">Status transition</span><h3>Place incident on hold</h3><p>Capture why progress is paused so SLA and requester communication can follow the correct rule.</p></div>
          <label>Pending reason<select value={pendingReason} onChange={(event) => setPendingReason(event.target.value)}>{incidentPendingReasons.map((reason) => <option key={reason}>{reason}</option>)}</select></label>
          <footer><button onClick={() => setWorkflowMode(null)} type="button">Cancel</button><button className="primary-action compact" onClick={confirmPending} type="button">Set pending</button></footer>
        </section>
      )
    }

    return (
      <section className="unified-detail-workflow-panel">
        <div><span className="eyebrow">Status transition</span><h3>Resolve incident</h3><p>Capture a structured resolution before moving the incident to Resolved.</p></div>
        <div className="unified-detail-form-grid two">
          <label>Resolution code<select value={resolutionCode} onChange={(event) => setResolutionCode(event.target.value)}>{incidentResolutionCodes.map((code) => <option key={code}>{code}</option>)}</select></label>
          <label>Resolution notes<textarea value={resolutionNotes} onChange={(event) => setResolutionNotes(event.target.value)} placeholder="What restored the service?" /></label>
        </div>
        <footer><button onClick={() => setWorkflowMode(null)} type="button">Cancel</button><button className="primary-action compact" disabled={!resolutionNotes.trim()} onClick={confirmResolution} type="button">Resolve incident</button></footer>
      </section>
    )
  }

  function renderOverview() {
    return (
      <div className="unified-detail-overview-layout">
        <div className="unified-detail-overview-main">
          <DetailSection eyebrow={`${meta.label} summary`} icon={FileText} title="Description">
            <p className="unified-detail-description">{ticket.description}</p>
            <div className="unified-detail-callout next-step"><span>Next action</span><strong>{valueOrFallback(ticket.nextStep, 'Review and progress this record.')}</strong></div>
          </DetailSection>
          <TypeOverview ticket={ticket} />
        </div>

        <aside className="unified-detail-context-column">
          <DetailSection eyebrow="Requester" icon={UserRound} title={ticket.requester} className="requester">
            <div className="unified-detail-requester">
              <span className="unified-detail-avatar">{initials(ticket.requester)}</span>
              <div>
                <strong>{ticket.requester}</strong>
                <span>{ticket.requesterEmail || ticket.requesterJobTitle || 'Requester / stakeholder'}</span>
                {ticket.requesterDepartment && <small>{ticket.requesterDepartment}</small>}
              </div>
            </div>
          </DetailSection>

          <DetailSection eyebrow="Record context" icon={Users} title="Assignment & service">
            <div className="unified-detail-property-grid one">
              <DetailProperty label="Assignment group" value={ticket.team} />
              <DetailProperty label="Assigned to" value={ticket.assignee} />
              <DetailProperty label="Service" value={ticket.service} />
              <DetailProperty label="Location" value={ticket.location} />
            </div>
          </DetailSection>

          <DetailSection eyebrow="Audit" icon={CalendarClock} title="Record timing">
            <div className="unified-detail-property-grid one">
              <DetailProperty label="Created" value={ticket.created} />
              <DetailProperty label="Updated" value={ticket.updated} />
              <DetailProperty label={ticket.type === 'Change' ? 'Window / target' : 'SLA / target'} value={ticket.type === 'Change' ? ticket.window || ticket.sla : ticket.sla} />
            </div>
          </DetailSection>
        </aside>
      </div>
    )
  }

  function renderActivity() {
    return (
      <div className="unified-detail-activity-layout">
        <DetailSection eyebrow="Conversation" icon={MessageSquarePlus} title="Add activity">
          <div className="unified-detail-note-toggle" role="group" aria-label="Activity type">
            <button className={noteMode === 'work' ? 'active' : ''} onClick={() => setNoteMode('work')} type="button">Internal work note</button>
            <button className={noteMode === 'customer' ? 'active' : ''} onClick={() => setNoteMode('customer')} type="button">Customer comment</button>
          </div>
          <textarea className="unified-detail-comment-box" value={newComment} onChange={(event) => setNewComment(event.target.value)} placeholder={noteMode === 'work' ? 'Add troubleshooting, handover or investigation notes…' : 'Write an update visible to the requester…'} />
          <div className="unified-detail-comment-actions">
            <span>{noteMode === 'work' ? 'Visible to technicians only' : 'Requester-facing update'}</span>
            <button className="primary-action compact" disabled={!newComment.trim()} onClick={() => addComment(noteMode)} type="button"><Send size={15} /> Add {noteMode === 'work' ? 'work note' : 'comment'}</button>
          </div>
        </DetailSection>

        <DetailSection eyebrow="Timeline" icon={Clock3} title="Activity history">
          <div className="unified-detail-timeline">
            {(ticket.comments || []).length ? ticket.comments.map((comment, index) => (
              <article key={`${ticket.id}-activity-${index}`}>
                <span className="unified-detail-timeline-marker" />
                <div>
                  <header><strong>{activityActor(comment)}</strong><span>{index === 0 ? ticket.updated : 'Earlier'}</span></header>
                  <p>{comment}</p>
                </div>
              </article>
            )) : <p className="unified-detail-empty-copy">No activity has been recorded yet.</p>}
          </div>
        </DetailSection>
      </div>
    )
  }

  function renderTasks() {
    const completed = tasks.filter((task) => task.status === 'Completed').length
    return (
      <div className="unified-detail-task-layout">
        <div className="unified-detail-tab-intro">
          <div><span className="eyebrow">Work management</span><h3>Tasks</h3><p>{ticket.type === 'Service Request' ? 'Fulfilment tasks and workflow dependencies attached to this request.' : `Operational task plan for this ${meta.label.toLowerCase()}.`}</p></div>
          <div><strong>{completed}/{tasks.length}</strong><span>complete</span></div>
        </div>
        {tasks.length ? (
          <div className="unified-detail-task-list">
            {tasks.map((task, index) => (
              <article key={task.id || `${ticket.id}-task-${index}`}>
                <div className="unified-detail-task-number">{index + 1}</div>
                <div className="unified-detail-task-main">
                  <header><strong>{task.title}</strong><span className={`unified-detail-state ${statusClass(task.status || 'Waiting')}`}>{task.status || 'Waiting'}</span></header>
                  <p>{task.instructions}</p>
                  <dl>
                    <div><dt>Team</dt><dd>{task.team || ticket.team}</dd></div>
                    <div><dt>Assignee</dt><dd>{task.assignee || 'Unassigned'}</dd></div>
                    <div><dt>Due</dt><dd>{task.due || 'Not set'}</dd></div>
                    {!!task.dependsOn?.length && <div><dt>Depends on</dt><dd>{task.dependsOn.join(', ')}</dd></div>}
                  </dl>
                </div>
              </article>
            ))}
          </div>
        ) : <div className="unified-detail-empty"><ListChecks size={22} /><strong>No tasks yet</strong><span>Tasks created by workflow or fulfilment will appear here.</span></div>}
      </div>
    )
  }

  function renderRelated() {
    const assets = ticket.linkedAssets || []
    return (
      <div className="unified-detail-related-grid">
        <DetailSection eyebrow="Relationships" icon={Share2} title="Related ITSM records">
          {relatedRecords.length ? (
            <div className="unified-detail-related-list">
              {relatedRecords.map((record) => (
                <button key={record.id} onClick={() => openRecordTab?.(record)} type="button">
                  <span><strong>{record.id}</strong><small>{record.type}</small></span>
                  <span className={`status-pill ${statusClass(record.status)}`}>{record.status}</span>
                  <span className="unified-detail-related-title">{record.title}</span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          ) : <p className="unified-detail-empty-copy">No ITSM record relationships are linked yet.</p>}
        </DetailSection>

        <DetailSection eyebrow="Configuration" icon={Server} title="Affected configuration items">
          {assets.length ? (
            <div className="unified-detail-ci-list">
              {assets.map((asset) => (
                <button key={asset} onClick={() => openAssetByName?.(asset)} type="button"><span><Server size={16} /><strong>{asset}</strong></span><ChevronRight size={16} /></button>
              ))}
            </div>
          ) : <p className="unified-detail-empty-copy">No configuration items are linked yet.</p>}
        </DetailSection>

        <DetailSection eyebrow="Requester history" icon={UserRound} title={`Other records for ${ticket.requester}`}>
          {requesterRecords.length ? (
            <div className="unified-detail-requester-records">
              {requesterRecords.map((record) => (
                <button key={record.id} onClick={() => openRecordTab?.(record)} type="button">
                  <span><strong>{record.id}</strong><small>{record.type}</small></span>
                  <span>{record.title}</span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          ) : <p className="unified-detail-empty-copy">No other current records were found for this requester.</p>}
        </DetailSection>
      </div>
    )
  }

  function renderAttachments() {
    return (
      <div className="unified-detail-attachment-layout">
        <div className="unified-detail-tab-intro">
          <div><span className="eyebrow">Files</span><h3>Attachments</h3><p>Screenshots, approvals, diagnostics and supporting documents remain attached to the record.</p></div>
          <button className="primary-action compact" onClick={() => fileInputRef.current?.click()} type="button"><Plus size={15} /> Add attachment</button>
          <input hidden multiple ref={fileInputRef} type="file" onChange={attachFiles} />
        </div>
        {attachments.length ? (
          <div className="unified-detail-attachment-list">
            {attachments.map((attachment) => (
              <article key={attachment.id}>
                <span className="unified-detail-file-icon"><FileText size={18} /></span>
                <div><strong>{attachment.name}</strong><small>{fileSize(attachment.size)} · {attachment.uploadedBy || 'Service Desk'} · {attachment.uploaded || 'Previously'}</small></div>
                <button aria-label={`Remove ${attachment.name}`} onClick={() => removeAttachment(attachment.id)} type="button"><Trash2 size={15} /></button>
              </article>
            ))}
          </div>
        ) : <div className="unified-detail-empty"><Paperclip size={23} /><strong>No attachments</strong><span>Add screenshots, logs, approval evidence or supporting files to this record.</span><button className="secondary-action" onClick={() => fileInputRef.current?.click()} type="button">Choose files</button></div>}
      </div>
    )
  }

  const activePanel = activeTab === 'activity'
    ? renderActivity()
    : activeTab === 'tasks'
      ? renderTasks()
      : activeTab === 'related'
        ? renderRelated()
        : activeTab === 'attachments'
          ? renderAttachments()
          : renderOverview()

  return (
    <div className={`unified-detail-page ${meta.className}`}>
      <div className="unified-detail-shell">
        <header className="unified-detail-header">
          <div className="unified-detail-identity">
            <div className="unified-detail-reference-row">
              <span>{ticket.id}</span>
              <span>{meta.label}</span>
              <span>Updated {ticket.updated}</span>
            </div>
            <h2>{ticket.title}</h2>
            <div className="unified-detail-badges">
              <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
              <span className={`unified-detail-priority ${priorityClass(ticket.priority)}`}><span className={`priority-dot ${priorityClass(ticket.priority)}`} />{ticket.priority}</span>
              <span>{ticket.service}</span>
              <span>{ticket.team}</span>
            </div>
          </div>

          <div className="unified-detail-header-actions">
            <button onClick={() => updateTicket(ticket.id, { assignee: 'Dana Sinclair' })} type="button"><UserCheck size={15} /> Assign to me</button>
            {ticket.type === 'Incident' && !['Resolved', 'Closed'].includes(ticket.status) && (
              <>
                <button onClick={() => updateTicket(ticket.id, { status: 'In Progress' })} type="button"><Wrench size={15} /> Start work</button>
                <button onClick={() => setWorkflowMode(workflowMode === 'pending' ? null : 'pending')} type="button"><Clock3 size={15} /> Pending</button>
                <button className="primary" onClick={() => setWorkflowMode(workflowMode === 'resolve' ? null : 'resolve')} type="button"><CheckCircle2 size={15} /> Resolve</button>
              </>
            )}
            {ticket.type === 'Incident' && ticket.status === 'Resolved' && <button className="primary" onClick={() => updateTicket(ticket.id, { status: 'Closed', nextStep: 'Incident closed.' })} type="button"><CheckCircle2 size={15} /> Close</button>}
            <label className="unified-detail-status-control">
              <span>Status</span>
              <select value={ticket.status} onChange={handleStatusChange}>
                {!meta.lifecycle.includes(ticket.status) && <option>{ticket.status}</option>}
                {meta.lifecycle.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
          </div>
        </header>

        <div className="unified-detail-lifecycle" aria-label={`${meta.label} lifecycle`}>
          {meta.lifecycle.map((status, index) => {
            const complete = index < currentLifecycleIndex
            const current = index === currentLifecycleIndex
            return (
              <div className={current ? 'current' : complete ? 'complete' : ''} key={status}>
                <span>{complete ? '✓' : index + 1}</span>
                <strong>{status}</strong>
              </div>
            )
          })}
        </div>

        {renderWorkflowPanel()}

        <nav className="unified-detail-tabs" aria-label="Record sections">
          {commonTabs.map(({ id, label, icon: Icon }) => (
            <button className={activeTab === id ? 'active' : ''} key={id} onClick={() => setActiveTab(id)} type="button">
              <Icon size={16} />
              <span>{label}</span>
              {id === 'tasks' && <b>{tasks.length}</b>}
              {id === 'related' && <b>{relatedRecords.length}</b>}
              {id === 'attachments' && <b>{attachments.length}</b>}
            </button>
          ))}
        </nav>

        <main className="unified-detail-panel">{activePanel}</main>
      </div>
    </div>
  )
}
