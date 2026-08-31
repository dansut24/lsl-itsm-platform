import { useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  ClipboardCheck,
  Clock3,
  Headphones,
  Inbox,
  KeyRound,
  LifeBuoy,
  ListChecks,
  LogIn,
  LogOut,
  MessageSquarePlus,
  Monitor,
  Moon,
  Palette,
  Plus,
  Search,
  Send,
  Server,
  Settings,
  SlidersHorizontal,
  Sun,
  UserCheck,
  UserRound,
  Users,
  Wrench
} from 'lucide-react'
import { accentOptions, demoUsers, incidentServices, loginProfiles, priorities, statusOptions, teams, types } from '../../data/demoData.jsx'
import { priorityClass, statusClass } from '../../lib/workspace.js'

export function LoginScreen({
  accent,
  fillCredentials,
  loginError,
  loginForm,
  loginMode,
  onLogin,
  setLoginForm,
  setLoginMode,
  setTheme,
  theme,
}) {
  const activeProfile = loginProfiles[loginMode]

  return (
    <main className="login-shell" data-accent={accent} data-theme={theme}>
      <section className="login-panel">
        <div className="login-brand">
          <img src={`${import.meta.env.BASE_URL}hi5central-logo.png`} alt="Hi5Central" />
          <button
            className="icon-button"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            type="button"
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>
        </div>

        <div>
          <span className="eyebrow">Demo access</span>
          <h1>Sign in to Hi5Central</h1>
          <p className="login-copy">{activeProfile.helper}</p>
        </div>

        <div className="login-mode-switch" aria-label="Choose login area">
          {Object.entries(loginProfiles).map(([mode, profile]) => (
            <button
              className={loginMode === mode ? 'active' : ''}
              key={mode}
              onClick={() => {
                setLoginMode(mode)
                setLoginForm({ username: '', password: '' })
              }}
              type="button"
            >
              {mode === 'analyst' ? <UserCheck size={16} /> : <LifeBuoy size={16} />}
              {profile.label}
            </button>
          ))}
        </div>

        <form className="login-form" onSubmit={onLogin}>
          <label>
            Username
            <input
              autoComplete="username"
              onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })}
              placeholder={activeProfile.username}
              value={loginForm.username}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
              placeholder="Enter demo password"
              type="password"
              value={loginForm.password}
            />
          </label>
          {loginError && <p className="login-error">{loginError}</p>}
          <button className="primary-action" type="submit">
            <LogIn size={17} aria-hidden="true" />
            Sign in
          </button>
        </form>

        <div className="mobile-credential-strip">
          <span>Baked-in credentials</span>
          {Object.entries(loginProfiles).map(([mode, profile]) => (
            <button key={mode} onClick={() => fillCredentials(mode)} type="button">
              <strong>{profile.label}</strong>
              <small>{profile.username}</small>
              <code>{profile.password}</code>
            </button>
          ))}
        </div>
      </section>

      <section className="credential-panel">
        <span className="eyebrow">Baked-in credentials</span>
        <h2>No database needed for this prototype.</h2>
        <div className="credential-stack">
          {Object.entries(loginProfiles).map(([mode, profile]) => (
            <button className="credential-card" key={mode} onClick={() => fillCredentials(mode)} type="button">
              <KeyRound size={18} aria-hidden="true" />
              <span>{profile.label}</span>
              <strong>{profile.username}</strong>
              <code>{profile.password}</code>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}

export function SelfServiceShell({
  accent,
  activeRequest,
  currentUser,
  handleLogout,
  handlePortalSubmit,
  openPortalHome,
  openPortalRequest,
  portalDraft,
  portalQuery,
  portalResults,
  serviceCatalog,
  setPortalDraft,
  setPortalQuery,
  setTheme,
  theme,
  tickets,
  toast,
}) {
  return (
    <div className="portal-shell" data-accent={accent} data-theme={theme}>
      <header className="portal-shell-header">
        <div className="portal-shell-brand">
          <img src={`${import.meta.env.BASE_URL}hi5central-logo.png`} alt="Hi5Central" />
          <div>
            <span>Technology Services</span>
            <strong>Self-Service Portal</strong>
          </div>
        </div>
        <div className="portal-shell-actions">
          <button
            className="icon-button"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            type="button"
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <button className="user-pill" onClick={handleLogout} title="Sign out" type="button">
            <span>{currentUser.initials}</span>
            <LogOut size={15} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="portal-page">
        {activeRequest ? (
          <PortalRequestView
            onBack={openPortalHome}
            request={activeRequest}
          />
        ) : (
          <SelfServicePortal
            currentUser={currentUser}
            handlePortalSubmit={handlePortalSubmit}
            openPortalRequest={openPortalRequest}
            portalDraft={portalDraft}
            portalQuery={portalQuery}
            portalResults={portalResults}
            serviceCatalog={serviceCatalog}
            setPortalDraft={setPortalDraft}
            setPortalQuery={setPortalQuery}
            tickets={tickets}
          />
        )}
      </main>

      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  )
}


export function PortalRequestView({ onBack, request }) {
  return (
    <div className="portal-request-detail">
      <button className="text-button portal-back-button" onClick={onBack} type="button">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to Self-Service
      </button>

      <section className="portal-request-card">
        <div className="detail-header">
          <div>
            <span className="eyebrow">{request.id}</span>
            <h2>{request.title}</h2>
          </div>
          <span className={`status-pill ${statusClass(request.status)}`}>{request.status}</span>
        </div>

        <div className="detail-grid">
          <InfoItem label="Type" value={request.type} icon={Inbox} />
          <InfoItem label="Service" value={request.service} icon={Server} />
          <InfoItem label="Priority" value={request.priority} icon={CircleGauge} />
          <InfoItem label="Updated" value={request.updated} icon={Clock3} />
        </div>

        <p className="detail-copy">{request.description}</p>

        <div className="next-step">
          <strong>What happens next</strong>
          <span>{request.nextStep}</span>
        </div>

        <div className="timeline">
          {request.comments.map((comment, index) => (
            <div className="timeline-item" key={`${request.id}-portal-${index}-${comment}`}>
              <span></span>
              <p>{comment}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export function NewTabView({ navItems, openNewRecord, openRecordTab, openTab, tickets }) {
  const [launcherQuery, setLauncherQuery] = useState('')
  const quickLinks = [
    ...navItems.filter((item) => item.id !== 'settings'),
    { id: 'settings', label: 'Settings' },
  ]
  const createActions = [
    ['Incident', 'Report and manage an interruption'],
    ['Service Request', 'Request access, hardware or a service'],
    ['Problem', 'Investigate a recurring root cause'],
    ['Change', 'Plan and approve a controlled change'],
  ]
  const normalizedQuery = launcherQuery.trim().toLowerCase()
  const matchingRecords = normalizedQuery
    ? tickets
        .filter((ticket) =>
          [ticket.id, ticket.title, ticket.requester, ticket.service, ticket.team]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery),
        )
        .slice(0, 8)
    : []
  const matchingWorkspaces = normalizedQuery
    ? quickLinks.filter((item) => item.label.toLowerCase().includes(normalizedQuery))
    : []

  return (
    <div className="new-tab-view launcher-view">
      <section className="launcher-shell">
        <div className="launcher-heading">
          <span className="eyebrow">Workspace launcher</span>
          <h2>What would you like to open?</h2>
          <p>Search records, create work or jump straight to another Hi5Central workspace.</p>
        </div>

        <label className="launcher-search">
          <Search size={18} aria-hidden="true" />
          <input
            autoFocus
            onChange={(event) => setLauncherQuery(event.target.value)}
            placeholder="Search records or workspaces"
            type="search"
            value={launcherQuery}
          />
          <span>Search</span>
        </label>

        {normalizedQuery ? (
          <div className="launcher-results">
            <section className="launcher-section">
              <div className="launcher-section-heading">
                <strong>Records</strong>
                <span>{matchingRecords.length} result{matchingRecords.length === 1 ? '' : 's'}</span>
              </div>
              <div className="launcher-record-list">
                {matchingRecords.map((ticket) => (
                  <button key={ticket.id} onClick={() => openRecordTab(ticket)} type="button">
                    <span className={`priority-dot ${priorityClass(ticket.priority)}`} />
                    <span className="launcher-record-id">{ticket.id}</span>
                    <strong>{ticket.title}</strong>
                    <small>{ticket.status} · {ticket.team}</small>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                ))}
                {!matchingRecords.length && (
                  <div className="launcher-empty">No records match “{launcherQuery.trim()}”.</div>
                )}
              </div>
            </section>

            {!!matchingWorkspaces.length && (
              <section className="launcher-section">
                <div className="launcher-section-heading">
                  <strong>Workspaces</strong>
                </div>
                <div className="launcher-workspace-grid compact">
                  {matchingWorkspaces.map((item) => (
                    <button key={item.id} onClick={() => openTab(item.id)} type="button">
                      <strong>{item.label}</strong>
                      <span>Open workspace</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="launcher-default-grid">
            <section className="launcher-section launcher-create-section">
              <div className="launcher-section-heading">
                <strong>Create</strong>
                <span>Start new work</span>
              </div>
              <div className="launcher-create-grid">
                {createActions.map(([recordType, description]) => (
                  <button key={recordType} onClick={() => openNewRecord(recordType)} type="button">
                    <span className="launcher-create-icon"><Plus size={16} aria-hidden="true" /></span>
                    <span>
                      <strong>{recordType}</strong>
                      <small>{description}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="launcher-section">
              <div className="launcher-section-heading">
                <strong>Open</strong>
                <span>Workspace</span>
              </div>
              <div className="launcher-workspace-grid">
                {quickLinks.map((item) => (
                  <button key={item.id} onClick={() => openTab(item.id)} type="button">
                    <strong>{item.label}</strong>
                    <span>{item.id === 'home' ? 'Operational dashboard' : `Open ${item.label.toLowerCase()}`}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="launcher-section launcher-recent-section">
              <div className="launcher-section-heading">
                <strong>Recent</strong>
                <span>Records</span>
              </div>
              <div className="launcher-record-list">
                {tickets.slice(0, 6).map((ticket) => (
                  <button key={ticket.id} onClick={() => openRecordTab(ticket)} type="button">
                    <span className={`priority-dot ${priorityClass(ticket.priority)}`} />
                    <span className="launcher-record-id">{ticket.id}</span>
                    <strong>{ticket.title}</strong>
                    <small>{ticket.status} · {ticket.team}</small>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  )
}

export function DashboardView({ metrics, openRecordTab, openTab, tickets }) {
  const watchList = tickets
    .filter((ticket) => ticket.slaPercent >= 45 && ticket.status !== 'Resolved')
    .sort((a, b) => b.slaPercent - a.slaPercent)
    .slice(0, 4)

  return (
    <div className="view-grid dashboard-grid">
      <section className="metric-row" aria-label="Operational metrics">
        <MetricCard label="Active Records" value={metrics.active} detail="Unresolved workload" icon={Inbox} tone="blue" />
        <MetricCard label="High Priority" value={metrics.highRisk} detail="Critical and high items" icon={AlertCircle} tone="red" />
        <MetricCard label="Approvals" value={metrics.approvals} detail="Awaiting owner or CAB" icon={ClipboardCheck} tone="amber" />
        <MetricCard label="SLA Watch" value={metrics.slaPressure} detail="Needs attention today" icon={Clock3} tone="amber" />
      </section>

      <section className="operational-band">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Today</span>
            <h2>Live Service Queue</h2>
          </div>
          <button className="text-button" onClick={() => openTab('tickets')} type="button">
            Open all records
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="queue-table">
          {watchList.map((ticket) => (
            <button
              className="queue-row"
              key={ticket.id}
              onClick={() => openRecordTab(ticket)}
              type="button"
            >
              <span className={`priority-dot ${priorityClass(ticket.priority)}`}></span>
              <span>
                <strong>{ticket.id}</strong>
                {ticket.title}
              </span>
              <span>{ticket.team}</span>
              <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
              <SlaBar value={ticket.slaPercent} label={ticket.sla} />
            </button>
          ))}
        </div>
      </section>

      <section className="workload-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Workload</span>
            <h2>Team Distribution</h2>
          </div>
        </div>
        <BarList data={metrics.teamCounts} />
      </section>

      <section className="workload-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Priority</span>
            <h2>Risk Mix</h2>
          </div>
        </div>
        <BarList data={metrics.priorityCounts} palette="risk" />
      </section>
    </div>
  )
}

export function TicketRecordView({
  addComment,
  newComment,
  openAssetByName,
  openRecordTab,
  selectedTicket,
  setNewComment,
  tickets,
  updateTicket,
}) {
  if (!selectedTicket) {
    return (
      <div className="record-page">
        <section className="record-primary empty-record">
          <span className="eyebrow">Record not found</span>
          <h2>This record is no longer available</h2>
          <p>The record may have been closed or removed from the current workspace data.</p>
        </section>
      </div>
    )
  }

  if (selectedTicket.type === 'Incident') {
    return (
      <IncidentRecordWorkspace
        addComment={addComment}
        key={selectedTicket.id}
        newComment={newComment}
        openAssetByName={openAssetByName}
        setNewComment={setNewComment}
        ticket={selectedTicket}
        updateTicket={updateTicket}
      />
    )
  }

  if (selectedTicket.type === 'Service Request') {
    return (
      <ServiceRequestRecordWorkspace
        addComment={addComment}
        key={selectedTicket.id}
        newComment={newComment}
        setNewComment={setNewComment}
        ticket={selectedTicket}
        updateTicket={updateTicket}
      />
    )
  }

  if (selectedTicket.type === 'Problem') {
    return (
      <ProblemRecordWorkspace
        addComment={addComment}
        key={selectedTicket.id}
        newComment={newComment}
        openAssetByName={openAssetByName}
        openRecordTab={openRecordTab}
        setNewComment={setNewComment}
        ticket={selectedTicket}
        tickets={tickets}
        updateTicket={updateTicket}
      />
    )
  }

  if (selectedTicket.type === 'Change') {
    return (
      <ChangeRecordWorkspace
        addComment={addComment}
        key={selectedTicket.id}
        newComment={newComment}
        openAssetByName={openAssetByName}
        openRecordTab={openRecordTab}
        setNewComment={setNewComment}
        ticket={selectedTicket}
        tickets={tickets}
        updateTicket={updateTicket}
      />
    )
  }

  return (
    <div className="record-page">
      <section className="record-primary">
        <TicketDetailContent
          addComment={addComment}
          newComment={newComment}
          setNewComment={setNewComment}
          ticket={selectedTicket}
          updateTicket={updateTicket}
        />
      </section>

      <aside className="record-context-panel">
        <div className="section-heading tight">
          <div>
            <span className="eyebrow">Record Context</span>
            <h2>{selectedTicket.id}</h2>
          </div>
        </div>

        <div className="record-fact-grid">
          <InfoItem label="Type" value={selectedTicket.type} icon={Inbox} />
          <InfoItem label="Priority" value={selectedTicket.priority} icon={CircleGauge} />
          <InfoItem label="Created" value={selectedTicket.created} icon={CalendarClock} />
          <InfoItem label="Updated" value={selectedTicket.updated} icon={Clock3} />
        </div>

        <div className="record-context-block">
          <span className="eyebrow">SLA Position</span>
          <SlaBar value={selectedTicket.slaPercent} label={selectedTicket.sla} />
        </div>

        <div className="record-context-block">
          <span className="eyebrow">Linked CIs</span>
          <div className="linked-ci-list">
            {(selectedTicket.linkedAssets?.length ? selectedTicket.linkedAssets : ['No CI linked']).map((asset) => (
              asset === 'No CI linked' ? (
                <span key={asset}>{asset}</span>
              ) : (
                <button className="linked-ci-button" key={asset} onClick={() => openAssetByName?.(asset)} type="button">
                  {asset}
                </button>
              )
            ))}
          </div>
        </div>

        {selectedTicket.requesterEmail && (
          <div className="record-context-block requester-record-context">
            <span className="eyebrow">Requester</span>
            <strong>{selectedTicket.requester}</strong>
            <span>{selectedTicket.requesterEmail}</span>
            {selectedTicket.requesterStaffNumber && <small>{selectedTicket.requesterStaffNumber}</small>}
            {selectedTicket.requesterDepartment && <small>{selectedTicket.requesterDepartment}</small>}
          </div>
        )}

        <div className="record-context-block">
          <span className="eyebrow">Requester Location</span>
          <strong>{selectedTicket.location}</strong>
        </div>
      </aside>
    </div>
  )
}

const incidentRecordSections = [
  { id: 'overview', label: 'Overview', icon: Inbox },
  { id: 'activity', label: 'Activity', icon: MessageSquarePlus },
  { id: 'related', label: 'Related', icon: Server },
  { id: 'sla', label: 'SLA', icon: Clock3 },
]

const incidentLifecycle = ['New', 'In Progress', 'Pending', 'Resolved', 'Closed']
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

function incidentLifecycleIndex(status) {
  if (status === 'Pending Approval' || status === 'CAB Review') return 2
  if (status === 'Monitoring') return 1
  const index = incidentLifecycle.indexOf(status)
  return index < 0 ? 0 : index
}

function incidentSlaTargets(priority) {
  if (priority === 'Critical') return { response: '15 min', resolution: '1 hr' }
  if (priority === 'High') return { response: '30 min', resolution: '4 hr' }
  if (priority === 'Medium') return { response: '1 hr', resolution: '8 hr' }
  return { response: '4 hr', resolution: '2 business days' }
}

function IncidentRecordWorkspace({
  addComment,
  newComment,
  openAssetByName,
  setNewComment,
  ticket,
  updateTicket,
}) {
  const [activeSection, setActiveSection] = useState('overview')
  const [workflowPanel, setWorkflowPanel] = useState(null)
  const [pendingReason, setPendingReason] = useState(ticket.pendingReason || 'Awaiting customer')
  const [resolutionCode, setResolutionCode] = useState(ticket.resolutionCode || incidentResolutionCodes[0])
  const [resolutionNotes, setResolutionNotes] = useState(ticket.resolutionNotes || '')
  const [noteMode, setNoteMode] = useState('work')
  const lifecycleIndex = incidentLifecycleIndex(ticket.status)
  const slaTargets = incidentSlaTargets(ticket.priority)
  const linkedAssets = ticket.linkedAssets || []
  const isResolved = ticket.status === 'Resolved' || ticket.status === 'Closed'
  const isPending = ticket.status === 'Pending'

  const knowledgeSuggestions = ticket.service === 'Identity'
    ? ['Resetting MFA on a new phone', 'Troubleshooting SSO sign-in failures']
    : ticket.service === 'Collaboration'
      ? ['Microsoft 365 mail flow checks', 'How to collect an Exchange message trace']
      : ['Service troubleshooting checklist', 'Collecting diagnostics before escalation']

  function confirmPending() {
    updateTicket(ticket.id, {
      status: 'Pending',
      pendingReason,
      nextStep: pendingReason,
    })
    setWorkflowPanel(null)
  }

  function confirmResolution() {
    if (!resolutionNotes.trim()) return
    updateTicket(ticket.id, {
      status: 'Resolved',
      resolutionCode,
      resolutionNotes: resolutionNotes.trim(),
      slaPercent: 100,
      sla: 'Met',
      nextStep: 'Confirm service restoration and close after validation.',
    })
    setWorkflowPanel(null)
  }

  function renderWorkflowPanel() {
    if (workflowPanel === 'pending') {
      return (
        <section className="incident-workflow-panel" aria-label="Place incident pending">
          <div>
            <span className="eyebrow">Status transition</span>
            <h3>Place incident on hold</h3>
            <p>Choose why progress is paused. This reason will later drive SLA pause rules and requester communication.</p>
          </div>
          <label>
            Pending reason
            <select value={pendingReason} onChange={(event) => setPendingReason(event.target.value)}>
              {incidentPendingReasons.map((reason) => <option key={reason}>{reason}</option>)}
            </select>
          </label>
          <div className="incident-workflow-actions">
            <button className="secondary-action" onClick={() => setWorkflowPanel(null)} type="button">Cancel</button>
            <button className="primary-action compact" onClick={confirmPending} type="button">Set pending</button>
          </div>
        </section>
      )
    }

    if (workflowPanel === 'resolve') {
      return (
        <section className="incident-workflow-panel" aria-label="Resolve incident">
          <div>
            <span className="eyebrow">Status transition</span>
            <h3>Resolve incident</h3>
            <p>Capture the resolution now so closure, reporting and future knowledge can use the same structured information.</p>
          </div>
          <div className="form-row">
            <label>
              Resolution code
              <select value={resolutionCode} onChange={(event) => setResolutionCode(event.target.value)}>
                {incidentResolutionCodes.map((code) => <option key={code}>{code}</option>)}
              </select>
            </label>
            <label>
              Resolution notes
              <textarea
                onChange={(event) => setResolutionNotes(event.target.value)}
                placeholder="What fixed the issue?"
                value={resolutionNotes}
              />
            </label>
          </div>
          <div className="incident-workflow-actions">
            <button className="secondary-action" onClick={() => setWorkflowPanel(null)} type="button">Cancel</button>
            <button className="primary-action compact" disabled={!resolutionNotes.trim()} onClick={confirmResolution} type="button">
              Resolve incident
            </button>
          </div>
        </section>
      )
    }

    return null
  }

  function renderOverview() {
    return (
      <div className="incident-overview-layout">
        <div className="incident-overview-main">
          <section className="incident-detail-section incident-user-summary">
            <div className="incident-section-heading">
              <div>
                <span className="eyebrow">Affected user</span>
                <h3>{ticket.requester}</h3>
              </div>
              <UserRound size={20} aria-hidden="true" />
            </div>
            <div className="incident-inline-facts">
              {ticket.requesterJobTitle && <span>{ticket.requesterJobTitle}</span>}
              {ticket.requesterDepartment && <span>{ticket.requesterDepartment}</span>}
              {ticket.requesterStaffNumber && <span>{ticket.requesterStaffNumber}</span>}
              <span>{ticket.location}</span>
            </div>
            {ticket.requesterEmail && <p className="incident-user-contact">{ticket.requesterEmail}</p>}
            {ticket.requesterManager && <p className="incident-user-contact">Manager: {ticket.requesterManager}</p>}
          </section>

          <section className="incident-detail-section">
            <div className="incident-section-heading">
              <div>
                <span className="eyebrow">Description</span>
                <h3>Issue summary</h3>
              </div>
              <ClipboardCheck size={20} aria-hidden="true" />
            </div>
            <p className="incident-description">{ticket.description}</p>
          </section>

          <section className="incident-detail-section">
            <div className="incident-section-heading">
              <div>
                <span className="eyebrow">Classification</span>
                <h3>Service and priority</h3>
              </div>
              <CircleGauge size={20} aria-hidden="true" />
            </div>
            <div className="incident-property-grid">
              <IncidentProperty label="Service" value={ticket.service} />
              <IncidentProperty label="Category" value={ticket.category || 'Not classified'} />
              <IncidentProperty label="Impact" value={ticket.impact || 'Not set'} />
              <IncidentProperty label="Urgency" value={ticket.urgency || 'Not set'} />
              <IncidentProperty label="Priority" value={ticket.priority} strong />
              <IncidentProperty label="Location" value={ticket.location} />
            </div>
          </section>

          <section className="incident-detail-section">
            <div className="incident-section-heading">
              <div>
                <span className="eyebrow">Assignment</span>
                <h3>Ownership</h3>
              </div>
              <Users size={20} aria-hidden="true" />
            </div>
            <div className="incident-assignment-grid">
              <label>
                Assignment group
                <select value={ticket.team} onChange={(event) => updateTicket(ticket.id, { team: event.target.value })}>
                  {teams.map((team) => <option key={team}>{team}</option>)}
                </select>
              </label>
              <label>
                Assigned to
                <select value={ticket.assignee} onChange={(event) => updateTicket(ticket.id, { assignee: event.target.value })}>
                  {['Unassigned', 'Dana Sinclair', 'Priya Raman', 'Noah Williams', 'Amara Okafor', 'Sam Taylor', 'Maya Ford'].map((assignee) => (
                    <option key={assignee}>{assignee}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="incident-next-step-panel">
            <span className="eyebrow">Next step</span>
            <strong>{ticket.nextStep}</strong>
            {isPending && <span>Pending reason: {ticket.pendingReason || pendingReason}</span>}
            {isResolved && ticket.resolutionCode && <span>{ticket.resolutionCode}</span>}
          </section>
        </div>

        <aside className="incident-overview-rail">
          <section className="incident-glance-panel">
            <span className="eyebrow">At a glance</span>
            <div className="incident-glance-list">
              <IncidentProperty label="Created" value={ticket.created} />
              <IncidentProperty label="Updated" value={ticket.updated} />
              <IncidentProperty label="SLA remaining" value={ticket.sla} />
              <IncidentProperty label="Configuration items" value={linkedAssets.length || 'None'} />
            </div>
          </section>

          <section className="incident-glance-panel">
            <span className="eyebrow">SLA position</span>
            <SlaBar value={ticket.slaPercent} label={ticket.sla} />
            <button className="text-button incident-inline-link" onClick={() => setActiveSection('sla')} type="button">
              View SLA detail <ChevronRight size={15} aria-hidden="true" />
            </button>
          </section>

          <section className="incident-glance-panel">
            <span className="eyebrow">Configuration items</span>
            <div className="linked-ci-list">
              {linkedAssets.length ? linkedAssets.map((asset) => (
                <button className="linked-ci-button" key={asset} onClick={() => openAssetByName?.(asset)} type="button">{asset}</button>
              )) : <span>No CI linked</span>}
            </div>
          </section>
        </aside>
      </div>
    )
  }

  function renderActivity() {
    const activityEntries = [
      ...ticket.comments.map((comment, index) => ({
        id: `comment-${index}`,
        kind: comment.toLowerCase().startsWith('customer comment:') ? 'customer' : 'work',
        actor: comment.toLowerCase().startsWith('customer comment:') ? 'Dana Sinclair · Customer comment' : 'Dana Sinclair · Work note',
        time: index === 0 ? 'Just now' : `${index * 12 + 6} min ago`,
        text: comment.replace(/^Customer comment:\s*/i, '').replace(/^Work note:\s*/i, '').replace(/\s*-\s*added now$/i, ''),
      })),
      {
        id: 'assignment',
        kind: 'system',
        actor: 'System · Assignment',
        time: ticket.updated,
        text: `${ticket.team} · ${ticket.assignee}`,
      },
      {
        id: 'created',
        kind: 'system',
        actor: 'System · Incident created',
        time: ticket.created,
        text: `Created for ${ticket.requester} from the analyst console.`,
      },
    ]

    return (
      <div className="incident-activity-layout">
        <section className="incident-activity-composer">
          <div className="incident-section-heading">
            <div>
              <span className="eyebrow">Add activity</span>
              <h3>Update this incident</h3>
            </div>
            <MessageSquarePlus size={20} aria-hidden="true" />
          </div>
          <div className="incident-note-mode" role="group" aria-label="Activity visibility">
            <button className={noteMode === 'work' ? 'active' : ''} onClick={() => setNoteMode('work')} type="button">Work note</button>
            <button className={noteMode === 'customer' ? 'active' : ''} onClick={() => setNoteMode('customer')} type="button">Customer comment</button>
          </div>
          <label className="incident-note-field">
            {noteMode === 'work' ? 'Internal work note' : 'Requester-visible comment'}
            <textarea
              onChange={(event) => setNewComment(event.target.value)}
              placeholder={noteMode === 'work' ? 'Add troubleshooting notes, handover detail or investigation findings' : 'Write an update the requester can see'}
              value={newComment}
            />
          </label>
          <div className="incident-composer-footer">
            <span>{noteMode === 'work' ? 'Visible to analysts only' : 'Visible to the requester'}</span>
            <button className="primary-action compact" disabled={!newComment.trim()} onClick={() => addComment(noteMode)} type="button">
              <MessageSquarePlus size={16} aria-hidden="true" />
              Add {noteMode === 'work' ? 'work note' : 'comment'}
            </button>
          </div>
        </section>

        <section className="incident-activity-timeline" aria-label="Incident activity timeline">
          <div className="incident-section-heading">
            <div>
              <span className="eyebrow">Timeline</span>
              <h3>Activity history</h3>
            </div>
          </div>
          {activityEntries.map((entry) => (
            <article className={`incident-activity-entry ${entry.kind}`} key={entry.id}>
              <span className="incident-activity-marker" aria-hidden="true" />
              <div>
                <div className="incident-activity-meta">
                  <strong>{entry.actor}</strong>
                  <span>{entry.time}</span>
                </div>
                <p>{entry.text}</p>
              </div>
            </article>
          ))}
        </section>
      </div>
    )
  }

  function renderRelated() {
    return (
      <div className="incident-related-layout">
        <section className="incident-related-section">
          <div className="incident-section-heading">
            <div>
              <span className="eyebrow">Configuration</span>
              <h3>Affected configuration items</h3>
            </div>
            <Server size={20} aria-hidden="true" />
          </div>
          {linkedAssets.length ? (
            <div className="incident-related-list">
              {linkedAssets.map((asset) => (
                <button className="incident-related-row" key={asset} onClick={() => openAssetByName?.(asset)} type="button">
                  <span className="incident-related-icon"><Server size={17} aria-hidden="true" /></span>
                  <span><strong>{asset}</strong><small>Configuration item</small></span>
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : <p className="incident-empty-related">No configuration items are linked yet.</p>}
        </section>

        <section className="incident-related-section">
          <div className="incident-section-heading">
            <div>
              <span className="eyebrow">Relationships</span>
              <h3>Related ITSM records</h3>
            </div>
            <ClipboardCheck size={20} aria-hidden="true" />
          </div>
          <div className="incident-relationship-grid">
            <IncidentRelationship label="Problem" value="No problem linked" />
            <IncidentRelationship label="Change" value="No change linked" />
            <IncidentRelationship label="Parent / major incident" value="Not linked" />
            <IncidentRelationship label="Child incidents" value="None" />
          </div>
        </section>

        <section className="incident-related-section">
          <div className="incident-section-heading">
            <div>
              <span className="eyebrow">Knowledge</span>
              <h3>Suggested articles</h3>
            </div>
          </div>
          <div className="incident-knowledge-suggestions">
            {knowledgeSuggestions.map((article) => (
              <div key={article}>
                <BookOpen size={17} aria-hidden="true" />
                <span><strong>{article}</strong><small>Suggested from {ticket.service}</small></span>
              </div>
            ))}
          </div>
        </section>
      </div>
    )
  }

  function renderSla() {
    const resolutionState = isResolved ? 'Met' : isPending ? 'Paused' : 'In progress'
    return (
      <div className="incident-sla-layout">
        <section className="incident-sla-hero">
          <div>
            <span className="eyebrow">Resolution SLA</span>
            <h3>{resolutionState}</h3>
            <p>{isResolved ? 'Resolution target completed.' : isPending ? `Clock behaviour follows the ${ticket.pendingReason || pendingReason} rule.` : `${ticket.sla} remaining against the current target.`}</p>
          </div>
          <div className="incident-sla-percent">
            <strong>{Math.min(100, ticket.slaPercent)}%</strong>
            <span>consumed</span>
          </div>
          <div className="incident-sla-progress"><span style={{ width: `${Math.min(100, ticket.slaPercent)}%` }} /></div>
        </section>

        <div className="incident-sla-card-grid">
          <section className="incident-sla-card met">
            <span className="eyebrow">First response</span>
            <div className="incident-sla-card-heading"><CheckCircle2 size={20} aria-hidden="true" /><strong>Met</strong></div>
            <IncidentProperty label="Target" value={slaTargets.response} />
            <IncidentProperty label="Completed" value="8 min" />
          </section>
          <section className={`incident-sla-card ${isResolved ? 'met' : isPending ? 'paused' : 'active'}`}>
            <span className="eyebrow">Resolution</span>
            <div className="incident-sla-card-heading"><Clock3 size={20} aria-hidden="true" /><strong>{resolutionState}</strong></div>
            <IncidentProperty label="Target" value={slaTargets.resolution} />
            <IncidentProperty label={isResolved ? 'Completed' : 'Remaining'} value={isResolved ? 'Within target' : ticket.sla} />
          </section>
        </div>

        <section className="incident-sla-policy">
          <span className="eyebrow">Clock behaviour</span>
          <h3>Designed for policy-driven SLA rules</h3>
          <p>When the backend is introduced, priority, service, business hours and pending reasons will determine target selection, pause behaviour, breaches and escalations.</p>
          <div className="incident-sla-policy-grid">
            <IncidentProperty label="Business hours" value="Service calendar" />
            <IncidentProperty label="Pending pause" value="Reason dependent" />
            <IncidentProperty label="Escalation" value="Before breach" />
          </div>
        </section>
      </div>
    )
  }

  const panel = activeSection === 'activity'
    ? renderActivity()
    : activeSection === 'related'
      ? renderRelated()
      : activeSection === 'sla'
        ? renderSla()
        : renderOverview()

  return (
    <div className="incident-record-workspace">
      <header className="incident-record-header">
        <div className="incident-record-identity">
          <div className="incident-record-reference-row">
            <span>{ticket.id}</span>
            <span>Updated {ticket.updated}</span>
          </div>
          <h2>{ticket.title}</h2>
          <div className="incident-record-badges">
            <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
            <span className={`incident-priority-badge ${priorityClass(ticket.priority)}`}>
              <span className={`priority-dot ${priorityClass(ticket.priority)}`} />
              {ticket.priority} priority
            </span>
            <span>{ticket.service}</span>
          </div>
        </div>

        <div className="incident-record-actions" aria-label="Incident actions">
          <button onClick={() => updateTicket(ticket.id, { assignee: 'Dana Sinclair' })} type="button">
            <UserCheck size={16} aria-hidden="true" />
            Assign to me
          </button>
          <button disabled={isResolved} onClick={() => updateTicket(ticket.id, { status: 'In Progress' })} type="button">
            <Wrench size={16} aria-hidden="true" />
            Start work
          </button>
          <button disabled={isResolved} onClick={() => setWorkflowPanel(workflowPanel === 'pending' ? null : 'pending')} type="button">
            <Clock3 size={16} aria-hidden="true" />
            Pending
          </button>
          {ticket.status === 'Closed' ? (
            <button disabled type="button">
              <CheckCircle2 size={16} aria-hidden="true" />
              Closed
            </button>
          ) : ticket.status === 'Resolved' ? (
            <button onClick={() => updateTicket(ticket.id, { status: 'Closed', nextStep: 'Incident closed.' })} type="button">
              <CheckCircle2 size={16} aria-hidden="true" />
              Close
            </button>
          ) : (
            <button onClick={() => setWorkflowPanel(workflowPanel === 'resolve' ? null : 'resolve')} type="button">
              <CheckCircle2 size={16} aria-hidden="true" />
              Resolve
            </button>
          )}
        </div>
      </header>

      <div className="incident-lifecycle" aria-label="Incident lifecycle">
        {incidentLifecycle.map((status, index) => {
          const isCurrent = index === lifecycleIndex
          const isComplete = index < lifecycleIndex
          return (
            <div className={isCurrent ? 'current' : isComplete ? 'complete' : ''} key={status}>
              <span>{isComplete ? '✓' : index + 1}</span>
              <strong>{status}</strong>
            </div>
          )
        })}
      </div>

      {renderWorkflowPanel()}

      <nav className="incident-record-tabs" aria-label="Incident record sections">
        {incidentRecordSections.map(({ id, label, icon: Icon }) => (
          <button
            aria-current={activeSection === id ? 'page' : undefined}
            className={activeSection === id ? 'active' : ''}
            key={id}
            onClick={() => setActiveSection(id)}
            type="button"
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>

      <div className="incident-record-panel">{panel}</div>
    </div>
  )
}

function IncidentProperty({ label, strong = false, value }) {
  return (
    <div className={strong ? 'incident-property strong' : 'incident-property'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function IncidentRelationship({ label, value }) {
  return (
    <div className="incident-relationship-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function TicketDetailContent({
  addComment,
  newComment,
  setNewComment,
  ticket,
  updateTicket,
}) {
  return (
    <section className="ticket-detail-content">
      <div className="detail-header">
        <div>
          <span className="eyebrow">{ticket.id}</span>
          <h2>{ticket.title}</h2>
        </div>
        <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
      </div>

      <div className="detail-grid">
        <InfoItem label="Requester" value={ticket.requester} icon={UserRound} />
        <InfoItem label="Service" value={ticket.service} icon={Server} />
        <InfoItem label="Team" value={ticket.team} icon={Users} />
        <InfoItem label="Assignee" value={ticket.assignee} icon={Headphones} />
      </div>

      {(ticket.category || ticket.impact || ticket.urgency) && (
        <div className="detail-grid incident-classification-grid">
          {ticket.category && <InfoItem label="Category" value={ticket.category} icon={ClipboardCheck} />}
          {ticket.impact && <InfoItem label="Impact" value={ticket.impact} icon={CircleGauge} />}
          {ticket.urgency && <InfoItem label="Urgency" value={ticket.urgency} icon={Clock3} />}
          <InfoItem label="Priority" value={ticket.priority} icon={AlertCircle} />
        </div>
      )}

      <p className="detail-copy">{ticket.description}</p>

      <div className="form-row">
        <label>
          Status
          <select
            onChange={(event) => updateTicket(ticket.id, { status: event.target.value })}
            value={ticket.status}
          >
            {statusOptions.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          Assignee
          <select
            onChange={(event) => updateTicket(ticket.id, { assignee: event.target.value })}
            value={ticket.assignee}
          >
            {['Unassigned', 'Priya Raman', 'Noah Williams', 'Amara Okafor', 'Sam Taylor', 'Maya Ford'].map((assignee) => (
              <option key={assignee}>{assignee}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="action-strip">
        <button onClick={() => updateTicket(ticket.id, { status: 'In Progress' })} type="button">
          <Wrench size={16} aria-hidden="true" />
          Start
        </button>
        <button onClick={() => updateTicket(ticket.id, { status: 'Pending Approval' })} type="button">
          <ClipboardCheck size={16} aria-hidden="true" />
          Approval
        </button>
        <button onClick={() => updateTicket(ticket.id, { status: 'Resolved', slaPercent: 100, sla: 'Met' })} type="button">
          <CheckCircle2 size={16} aria-hidden="true" />
          Resolve
        </button>
      </div>

      <div className="next-step">
        <strong>Next step</strong>
        <span>{ticket.nextStep}</span>
      </div>

      <div className="comment-box">
        <label>
          Activity note
          <textarea
            onChange={(event) => setNewComment(event.target.value)}
            placeholder="Add a visible work note"
            value={newComment}
          />
        </label>
        <button className="primary-action compact" onClick={addComment} type="button">
          <MessageSquarePlus size={16} aria-hidden="true" />
          Add note
        </button>
      </div>

      <div className="timeline">
        {ticket.comments.map((comment, index) => (
          <div className="timeline-item" key={`${ticket.id}-${index}-${comment}`}>
            <span></span>
            <p>{comment}</p>
          </div>
        ))}
      </div>
    </section>
  )
}


function IncidentQueueView({
  filters,
  filteredTickets,
  openNewRecord,
  openRecordTab,
  query,
  setFilters,
  setQuery,
  tickets,
  updateTicket,
}) {
  const [quickView, setQuickView] = useState('all')
  const [sortKey, setSortKey] = useState('sla')
  const [sortDirection, setSortDirection] = useState('desc')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [advancedFilters, setAdvancedFilters] = useState({
    team: 'All',
    assignee: 'All',
    service: 'All',
  })

  const incidentTickets = tickets.filter((ticket) => ticket.type === 'Incident')
  const openIncidents = incidentTickets.filter((ticket) => !['Resolved', 'Closed'].includes(ticket.status))
  const mineCount = openIncidents.filter((ticket) => ticket.assignee === 'Dana Sinclair').length
  const unassignedCount = openIncidents.filter((ticket) => !ticket.assignee || ticket.assignee === 'Unassigned').length
  const atRiskCount = openIncidents.filter((ticket) => ticket.slaPercent >= 60).length

  const availableTeams = ['All', ...new Set(incidentTickets.map((ticket) => ticket.team).filter(Boolean))]
  const availableAssignees = ['All', ...new Set(incidentTickets.map((ticket) => ticket.assignee).filter(Boolean))]
  const availableServices = ['All', ...new Set(incidentTickets.map((ticket) => ticket.service).filter(Boolean))]

  const applyQuickView = (ticket) => {
    if (quickView === 'mine') return ticket.assignee === 'Dana Sinclair' && !['Resolved', 'Closed'].includes(ticket.status)
    if (quickView === 'unassigned') return (!ticket.assignee || ticket.assignee === 'Unassigned') && !['Resolved', 'Closed'].includes(ticket.status)
    if (quickView === 'priority') return ['Critical', 'High'].includes(ticket.priority) && !['Resolved', 'Closed'].includes(ticket.status)
    if (quickView === 'risk') return ticket.slaPercent >= 60 && !['Resolved', 'Closed'].includes(ticket.status)
    if (quickView === 'pending') return ticket.status === 'Pending'
    if (quickView === 'resolved') return ['Resolved', 'Closed'].includes(ticket.status)
    return true
  }

  const priorityWeight = { Critical: 4, High: 3, Medium: 2, Low: 1 }
  const statusWeight = { New: 1, 'In Progress': 2, Pending: 3, Resolved: 4, Closed: 5 }
  const recordNumber = (id) => Number(String(id || '').match(/\d+/)?.[0] || 0)
  const ageMinutes = (value) => {
    const normalized = String(value || '').toLowerCase()
    if (normalized.includes('just now')) return 0
    const minutes = normalized.match(/(\d+)\s*min/)
    if (minutes) return Number(minutes[1])
    const hours = normalized.match(/(\d+)\s*hr/)
    if (hours) return Number(hours[1]) * 60
    if (normalized.includes('yesterday')) return 1440
    if (/^\d{1,2}:\d{2}$/.test(normalized)) return 720
    return 2880
  }

  const visibleTickets = filteredTickets
    .filter((ticket) =>
      (advancedFilters.team === 'All' || ticket.team === advancedFilters.team) &&
      (advancedFilters.assignee === 'All' || ticket.assignee === advancedFilters.assignee) &&
      (advancedFilters.service === 'All' || ticket.service === advancedFilters.service) &&
      applyQuickView(ticket),
    )
    .sort((a, b) => {
      let aValue
      let bValue
      if (sortKey === 'reference') {
        aValue = recordNumber(a.id)
        bValue = recordNumber(b.id)
      } else if (sortKey === 'priority') {
        aValue = priorityWeight[a.priority] || 0
        bValue = priorityWeight[b.priority] || 0
      } else if (sortKey === 'status') {
        aValue = statusWeight[a.status] || 0
        bValue = statusWeight[b.status] || 0
      } else if (sortKey === 'sla') {
        aValue = a.slaPercent || 0
        bValue = b.slaPercent || 0
      } else if (sortKey === 'updated') {
        aValue = ageMinutes(a.updated)
        bValue = ageMinutes(b.updated)
      } else {
        aValue = String(a[sortKey] || '').toLowerCase()
        bValue = String(b[sortKey] || '').toLowerCase()
      }
      const comparison = typeof aValue === 'string'
        ? aValue.localeCompare(bValue)
        : aValue - bValue
      return sortDirection === 'asc' ? comparison : -comparison
    })

  const sortBy = (key) => {
    if (sortKey === key) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
      return
    }
    setSortKey(key)
    setSortDirection(key === 'sla' || key === 'priority' ? 'desc' : 'asc')
  }

  const sortIndicator = (key) => sortKey === key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''
  const advancedCount = [advancedFilters.team, advancedFilters.assignee, advancedFilters.service].filter((value) => value !== 'All').length
  const filterCount = advancedCount + (filters.priority !== 'All' ? 1 : 0) + (filters.status !== 'All' ? 1 : 0)

  const toggleSelected = (id) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const bulkUpdate = (patch) => {
    selectedIds.forEach((id) => updateTicket(id, patch))
    setSelectedIds([])
  }

  const clearFilters = () => {
    setFilters({ ...filters, status: 'All', priority: 'All' })
    setAdvancedFilters({ team: 'All', assignee: 'All', service: 'All' })
    setQuickView('all')
  }

  const slaTone = (ticket) => {
    if (['Resolved', 'Closed'].includes(ticket.status)) return 'met'
    if (ticket.slaPercent >= 80) return 'critical'
    if (ticket.slaPercent >= 60) return 'watch'
    return 'healthy'
  }

  const quickViews = [
    ['all', 'All'],
    ['mine', 'Mine'],
    ['unassigned', 'Unassigned'],
    ['priority', 'P1 / P2'],
    ['risk', 'At risk'],
    ['pending', 'Pending'],
    ['resolved', 'Resolved'],
  ]

  return (
    <section className="incident-queue-v2">
      <header className="incident-queue-heading">
        <div>
          <span className="eyebrow">Service Desk</span>
          <h2>Incidents</h2>
          <p>Triage interruptions, protect SLA targets and keep ownership clear.</p>
        </div>
        <button className="primary-action compact" onClick={() => openNewRecord?.('Incident')} type="button">
          <Plus size={16} aria-hidden="true" />
          New Incident
        </button>
      </header>

      <div className="incident-queue-metrics" aria-label="Incident queue summary">
        <div><strong>{openIncidents.length}</strong><span>Open</span></div>
        <div><strong>{mineCount}</strong><span>Mine</span></div>
        <div><strong>{unassignedCount}</strong><span>Unassigned</span></div>
        <div className={atRiskCount ? 'attention' : ''}><strong>{atRiskCount}</strong><span>At risk</span></div>
      </div>

      <div className="incident-queue-toolbar">
        <label className="incident-queue-search">
          <Search size={18} aria-hidden="true" />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search reference, summary, requester, service..."
            type="search"
            value={query}
          />
        </label>
        <button className={filterCount ? 'incident-filter-button active' : 'incident-filter-button'} onClick={() => setFiltersOpen(true)} type="button">
          <SlidersHorizontal size={17} aria-hidden="true" />
          Filters
          {filterCount > 0 && <span>{filterCount}</span>}
        </button>
      </div>

      <div className="incident-quick-views" aria-label="Incident saved views">
        {quickViews.map(([id, label]) => (
          <button className={quickView === id ? 'active' : ''} key={id} onClick={() => setQuickView(id)} type="button">
            {label}
          </button>
        ))}
      </div>

      <div className="incident-queue-result-meta">
        <span><strong>{visibleTickets.length}</strong> incidents</span>
        <span className="incident-desktop-sort-summary">Sorted by {sortKey === 'sla' ? 'SLA position' : sortKey} {sortDirection === 'asc' ? 'ascending' : 'descending'}</span>
        <label className="incident-mobile-sort">
          <span>Sort</span>
          <select
            onChange={(event) => {
              const nextKey = event.target.value
              setSortKey(nextKey)
              setSortDirection(nextKey === 'sla' || nextKey === 'priority' ? 'desc' : 'asc')
            }}
            value={sortKey}
          >
            <option value="sla">SLA risk</option>
            <option value="priority">Priority</option>
            <option value="updated">Updated</option>
            <option value="reference">Reference</option>
          </select>
        </label>
      </div>

      {selectedIds.length > 0 && (
        <div className="incident-bulk-bar">
          <strong>{selectedIds.length} selected</strong>
          <div>
            <button onClick={() => bulkUpdate({ assignee: 'Dana Sinclair' })} type="button">Assign to me</button>
            <button onClick={() => bulkUpdate({ status: 'In Progress' })} type="button">Start work</button>
            <button onClick={() => setSelectedIds([])} type="button">Clear</button>
          </div>
        </div>
      )}

      {visibleTickets.length ? (
        <>
          <div className="incident-table-wrap">
            <table className="incident-queue-table">
              <thead>
                <tr>
                  <th className="select-column"><span className="sr-only">Select</span></th>
                  <th><button onClick={() => sortBy('reference')} type="button">Reference{sortIndicator('reference')}</button></th>
                  <th>Summary</th>
                  <th><button onClick={() => sortBy('priority')} type="button">Priority{sortIndicator('priority')}</button></th>
                  <th><button onClick={() => sortBy('status')} type="button">Status{sortIndicator('status')}</button></th>
                  <th><button onClick={() => sortBy('team')} type="button">Team{sortIndicator('team')}</button></th>
                  <th>Assignee</th>
                  <th><button onClick={() => sortBy('sla')} type="button">SLA{sortIndicator('sla')}</button></th>
                  <th><button onClick={() => sortBy('updated')} type="button">Updated{sortIndicator('updated')}</button></th>
                </tr>
              </thead>
              <tbody>
                {visibleTickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td className="select-column">
                      <input
                        aria-label={`Select ${ticket.id}`}
                        checked={selectedIds.includes(ticket.id)}
                        onChange={() => toggleSelected(ticket.id)}
                        type="checkbox"
                      />
                    </td>
                    <td>
                      <button className="incident-reference-link" onClick={() => openRecordTab(ticket)} type="button">
                        <span className={`priority-dot ${priorityClass(ticket.priority)}`} />
                        {ticket.id}
                      </button>
                    </td>
                    <td className="incident-summary-cell">
                      <button onClick={() => openRecordTab(ticket)} type="button">
                        <strong>{ticket.title}</strong>
                        <small>{ticket.requester} · {ticket.service}</small>
                      </button>
                    </td>
                    <td><span className={`incident-priority-text ${priorityClass(ticket.priority)}`}>{ticket.priority}</span></td>
                    <td><span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span></td>
                    <td>{ticket.team}</td>
                    <td>{ticket.assignee || 'Unassigned'}</td>
                    <td>
                      <div className={`incident-sla-cell ${slaTone(ticket)}`}>
                        <strong>{['Resolved', 'Closed'].includes(ticket.status) ? 'Met' : ticket.sla}</strong>
                        <span><i style={{ width: `${Math.min(100, ticket.slaPercent || 0)}%` }} /></span>
                      </div>
                    </td>
                    <td>{ticket.updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="incident-mobile-list">
            {visibleTickets.map((ticket) => (
              <button className="incident-mobile-card" key={ticket.id} onClick={() => openRecordTab(ticket)} type="button">
                <div className="incident-mobile-card-top">
                  <span className="incident-mobile-reference">
                    <span className={`priority-dot ${priorityClass(ticket.priority)}`} />
                    <strong>{ticket.id}</strong>
                  </span>
                  <span className={`incident-priority-text ${priorityClass(ticket.priority)}`}>{ticket.priority}</span>
                </div>
                <h3>{ticket.title}</h3>
                <div className="incident-mobile-card-state">
                  <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
                  <span>{ticket.team} · {ticket.assignee || 'Unassigned'}</span>
                </div>
                <div className="incident-mobile-card-context">
                  <span>{ticket.requester}</span>
                  <span className={`mobile-sla-label ${slaTone(ticket)}`}>{['Resolved', 'Closed'].includes(ticket.status) ? 'SLA met' : `${ticket.sla} SLA`}</span>
                </div>
                <div className="incident-mobile-card-footer">
                  <span>Updated {ticket.updated}</span>
                  <ChevronRight size={17} aria-hidden="true" />
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="incident-queue-empty">
          <CheckCircle2 size={28} aria-hidden="true" />
          <strong>No incidents match this view</strong>
          <span>Try another saved view or clear your filters.</span>
          <button onClick={clearFilters} type="button">Clear filters</button>
        </div>
      )}

      {filtersOpen && (
        <div className="incident-filter-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setFiltersOpen(false)
        }}>
          <aside className="incident-filter-panel" aria-label="Incident filters">
            <header>
              <div>
                <span className="eyebrow">Queue controls</span>
                <h3>Filter incidents</h3>
              </div>
              <button aria-label="Close filters" className="icon-button" onClick={() => setFiltersOpen(false)} type="button">×</button>
            </header>

            <div className="incident-filter-fields">
              <label>
                Status
                <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
                  <option>All</option>
                  {['New', 'In Progress', 'Pending', 'Resolved', 'Closed'].map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <label>
                Priority
                <select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}>
                  <option>All</option>
                  {priorities.map((priority) => <option key={priority}>{priority}</option>)}
                </select>
              </label>
              <label>
                Assignment group
                <select value={advancedFilters.team} onChange={(event) => setAdvancedFilters({ ...advancedFilters, team: event.target.value })}>
                  {availableTeams.map((team) => <option key={team}>{team}</option>)}
                </select>
              </label>
              <label>
                Assignee
                <select value={advancedFilters.assignee} onChange={(event) => setAdvancedFilters({ ...advancedFilters, assignee: event.target.value })}>
                  {availableAssignees.map((assignee) => <option key={assignee}>{assignee}</option>)}
                </select>
              </label>
              <label>
                Service
                <select value={advancedFilters.service} onChange={(event) => setAdvancedFilters({ ...advancedFilters, service: event.target.value })}>
                  {availableServices.map((service) => <option key={service}>{service}</option>)}
                </select>
              </label>
            </div>

            <footer>
              <button className="secondary-action" onClick={clearFilters} type="button">Clear all</button>
              <button className="primary-action compact" onClick={() => setFiltersOpen(false)} type="button">Apply filters</button>
            </footer>
          </aside>
        </div>
      )}
    </section>
  )
}



const serviceRequestSections = [
  { id: 'overview', label: 'Overview', icon: Inbox },
  { id: 'items', label: 'Requested items', icon: Server },
  { id: 'approvals', label: 'Approvals', icon: ClipboardCheck },
  { id: 'tasks', label: 'Tasks', icon: ListChecks },
  { id: 'activity', label: 'Activity', icon: MessageSquarePlus },
]

function requestItemsFor(ticket) {
  if (ticket.requestedItems?.length) return ticket.requestedItems
  return [
    {
      id: `CAT-${String(ticket.service || 'SERVICE').toUpperCase().replace(/\s+/g, '-')}`,
      name: ticket.title,
      category: ticket.service || 'Service',
      quantity: 1,
      unitCost: 0,
      options: ['Standard request configuration'],
    },
  ]
}

function requestApprovalsFor(ticket) {
  if (ticket.requestApprovals?.length) return ticket.requestApprovals
  if (ticket.status === 'Pending Approval') {
    return [
      {
        id: `${ticket.id}-APPROVAL-1`,
        label: 'Request approval',
        approver: 'Request approver',
        status: 'Pending',
        updated: 'Awaiting decision',
      },
    ]
  }
  return []
}

function requestTasksFor(ticket) {
  if (ticket.requestTasks?.length) return ticket.requestTasks
  return [
    {
      id: `${ticket.id}-TASK-1`,
      title: 'Review and validate request',
      team: ticket.team || 'Service Desk',
      assignee: ticket.assignee || 'Unassigned',
      status: 'Ready',
      dependsOn: [],
      due: 'Within 4 hr',
      instructions: 'Confirm the request information and requested items are complete before fulfilment begins.',
    },
    {
      id: `${ticket.id}-TASK-2`,
      title: 'Complete fulfilment',
      team: ticket.team || 'Service Desk',
      assignee: 'Unassigned',
      status: 'Waiting',
      dependsOn: [`${ticket.id}-TASK-1`],
      due: ticket.sla || 'Within SLA',
      instructions: 'Complete the requested service and record the fulfilment outcome.',
    },
  ]
}

function requestTotalCost(ticket) {
  return requestItemsFor(ticket).reduce(
    (total, item) => total + Number(item.unitCost || 0) * Number(item.quantity || 1),
    0,
  )
}

function formatRequestCost(value) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: value % 1 ? 2 : 0,
  }).format(value || 0)
}

function requestApprovalsComplete(ticket) {
  const approvals = requestApprovalsFor(ticket)
  return !approvals.length || approvals.every((approval) => approval.status === 'Approved')
}

function requestTaskUnlocked(task, tasks, approvalsComplete) {
  if (task.requiresApproval && !approvalsComplete) return false
  const dependencies = task.dependsOn || []
  return dependencies.every((dependencyId) =>
    tasks.find((candidate) => candidate.id === dependencyId)?.status === 'Completed',
  )
}

function requestVisibleTasks(ticket) {
  const tasks = requestTasksFor(ticket)
  const approvalsComplete = requestApprovalsComplete(ticket)
  return tasks.filter((task) => requestTaskUnlocked(task, tasks, approvalsComplete))
}

function requestWorkflowProgress(ticket) {
  const tasks = requestTasksFor(ticket)
  const completed = tasks.filter((task) => task.status === 'Completed').length
  const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 100
  return { completed, total: tasks.length, percent }
}

function ServiceRequestQueueView({
  filteredTickets,
  openNewRecord,
  openRecordTab,
  query,
  setQuery,
  tickets,
}) {
  const [quickView, setQuickView] = useState('all')
  const [sortKey, setSortKey] = useState('updated')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [advancedFilters, setAdvancedFilters] = useState({ service: 'All', team: 'All' })

  const requests = tickets.filter((ticket) => ticket.type === 'Service Request')
  const openRequests = requests.filter((ticket) => !['Resolved', 'Closed'].includes(ticket.status))
  const awaitingApproval = openRequests.filter((ticket) => !requestApprovalsComplete(ticket)).length
  const readyTasks = openRequests.reduce(
    (count, ticket) => count + requestVisibleTasks(ticket).filter((task) => ['Ready', 'Waiting'].includes(task.status)).length,
    0,
  )
  const totalValue = openRequests.reduce((sum, ticket) => sum + requestTotalCost(ticket), 0)

  const services = ['All', ...new Set(requests.map((ticket) => ticket.service).filter(Boolean))]
  const teamsAvailable = ['All', ...new Set(requests.map((ticket) => ticket.team).filter(Boolean))]

  const matchesQuickView = (ticket) => {
    const progress = requestWorkflowProgress(ticket)
    const ready = requestVisibleTasks(ticket).filter((task) => task.status !== 'Completed')
    if (quickView === 'approval') return !requestApprovalsComplete(ticket)
    if (quickView === 'fulfilment') return requestApprovalsComplete(ticket) && !['Resolved', 'Closed'].includes(ticket.status)
    if (quickView === 'ready') return ready.length > 0
    if (quickView === 'mine') return ready.some((task) => task.assignee === 'Dana Sinclair') || ticket.assignee === 'Dana Sinclair'
    if (quickView === 'complete') return ['Resolved', 'Closed'].includes(ticket.status) || progress.percent === 100
    return true
  }

  const ageMinutes = (value) => {
    const normalized = String(value || '').toLowerCase()
    const minutes = normalized.match(/(\d+)\s*min/)
    if (minutes) return Number(minutes[1])
    const hours = normalized.match(/(\d+)\s*hr/)
    if (hours) return Number(hours[1]) * 60
    if (normalized.includes('just now')) return 0
    if (normalized.includes('yesterday')) return 1440
    return 720
  }

  const visibleRequests = filteredTickets
    .filter((ticket) =>
      matchesQuickView(ticket) &&
      (advancedFilters.service === 'All' || ticket.service === advancedFilters.service) &&
      (advancedFilters.team === 'All' || ticket.team === advancedFilters.team),
    )
    .sort((a, b) => {
      if (sortKey === 'reference') return Number(String(b.id).replace(/\D/g, '')) - Number(String(a.id).replace(/\D/g, ''))
      if (sortKey === 'cost') return requestTotalCost(b) - requestTotalCost(a)
      if (sortKey === 'progress') return requestWorkflowProgress(a).percent - requestWorkflowProgress(b).percent
      return ageMinutes(a.updated) - ageMinutes(b.updated)
    })

  const quickViews = [
    ['all', 'All'],
    ['approval', 'Awaiting approval'],
    ['fulfilment', 'In fulfilment'],
    ['ready', 'Ready tasks'],
    ['mine', 'My work'],
    ['complete', 'Completed'],
  ]

  return (
    <section className="request-queue-v2">
      <header className="request-queue-heading">
        <div>
          <span className="eyebrow">Service Requests</span>
          <h2>Request fulfilment</h2>
          <p>Track approvals, requested items, cost and fulfilment work from one queue.</p>
        </div>
        <button className="primary-action compact" onClick={() => openNewRecord?.('Service Request')} type="button">
          <Plus size={16} aria-hidden="true" />
          New Service Request
        </button>
      </header>

      <div className="request-queue-metrics" aria-label="Service request queue summary">
        <div><strong>{openRequests.length}</strong><span>Open</span></div>
        <div><strong>{awaitingApproval}</strong><span>Awaiting approval</span></div>
        <div><strong>{readyTasks}</strong><span>Ready tasks</span></div>
        <div><strong>{formatRequestCost(totalValue)}</strong><span>Open value</span></div>
      </div>

      <div className="request-queue-toolbar">
        <label className="incident-queue-search request-queue-search">
          <Search size={17} aria-hidden="true" />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search requests, requester, service or team"
            type="search"
            value={query}
          />
        </label>
        <button className={filtersOpen ? 'secondary-action active' : 'secondary-action'} onClick={() => setFiltersOpen(true)} type="button">
          <SlidersHorizontal size={16} aria-hidden="true" />
          Filters
        </button>
      </div>

      <div className="request-quick-views" aria-label="Service request views">
        {quickViews.map(([id, label]) => (
          <button className={quickView === id ? 'active' : ''} key={id} onClick={() => setQuickView(id)} type="button">
            {label}
          </button>
        ))}
      </div>

      <div className="request-queue-subbar">
        <span><strong>{visibleRequests.length}</strong> requests</span>
        <label>
          Sort
          <select onChange={(event) => setSortKey(event.target.value)} value={sortKey}>
            <option value="updated">Recently updated</option>
            <option value="reference">Reference</option>
            <option value="cost">Highest cost</option>
            <option value="progress">Workflow progress</option>
          </select>
        </label>
      </div>

      <div className="request-desktop-table" role="table" aria-label="Service request queue">
        <div className="request-table-row request-table-head" role="row">
          <span>Reference / request</span>
          <span>Requester</span>
          <span>Approval</span>
          <span>Workflow</span>
          <span>Cost</span>
          <span>Updated</span>
        </div>
        {visibleRequests.map((ticket) => {
          const progress = requestWorkflowProgress(ticket)
          const approvalsComplete = requestApprovalsComplete(ticket)
          const ready = requestVisibleTasks(ticket).filter((task) => ['Ready', 'Waiting'].includes(task.status))
          return (
            <button className="request-table-row request-table-record" key={ticket.id} onClick={() => openRecordTab(ticket)} role="row" type="button">
              <span className="request-table-primary">
                <strong>{ticket.id}</strong>
                <span>{ticket.title}</span>
                <small>{ticket.service} · {ticket.team}</small>
              </span>
              <span><strong>{ticket.requester}</strong><small>{ticket.location}</small></span>
              <span><span className={`status-pill ${approvalsComplete ? 'resolved' : 'pending-approval'}`}>{approvalsComplete ? 'Approved' : 'Pending'}</span></span>
              <span className="request-progress-cell">
                <strong>{progress.completed}/{progress.total}</strong>
                <small>{ready.length ? `${ready.length} task${ready.length === 1 ? '' : 's'} ready` : progress.percent === 100 ? 'Complete' : 'Waiting'}</small>
                <span className="request-progress-track"><i style={{ width: `${progress.percent}%` }} /></span>
              </span>
              <span><strong>{formatRequestCost(requestTotalCost(ticket))}</strong></span>
              <span><strong>{ticket.updated}</strong><small>{ticket.status}</small></span>
            </button>
          )
        })}
      </div>

      <div className="request-mobile-list">
        {visibleRequests.map((ticket) => {
          const progress = requestWorkflowProgress(ticket)
          const approvalsComplete = requestApprovalsComplete(ticket)
          const ready = requestVisibleTasks(ticket).filter((task) => ['Ready', 'Waiting'].includes(task.status))
          return (
            <button className="request-mobile-card" key={ticket.id} onClick={() => openRecordTab(ticket)} type="button">
              <div className="request-mobile-card-top">
                <strong>{ticket.id}</strong>
                <span>{formatRequestCost(requestTotalCost(ticket))}</span>
              </div>
              <h3>{ticket.title}</h3>
              <div className="request-mobile-card-status">
                <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
                <span>{ticket.service}</span>
              </div>
              <div className="request-mobile-progress">
                <span><strong>{progress.completed}/{progress.total}</strong> workflow tasks</span>
                <span>{ready.length ? `${ready.length} ready` : approvalsComplete ? 'Waiting' : 'Approval required'}</span>
                <div><i style={{ width: `${progress.percent}%` }} /></div>
              </div>
              <footer>
                <span>{ticket.requester}</span>
                <span>{ticket.updated} <ChevronRight size={15} aria-hidden="true" /></span>
              </footer>
            </button>
          )
        })}
      </div>

      {!visibleRequests.length && (
        <div className="incident-queue-empty">
          <ListChecks size={24} aria-hidden="true" />
          <strong>No service requests match this view</strong>
          <span>Try another view or clear the active filters.</span>
        </div>
      )}

      {filtersOpen && (
        <div className="request-filter-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setFiltersOpen(false)}>
          <aside className="request-filter-panel" aria-label="Service request filters">
            <header>
              <div><span className="eyebrow">Queue filters</span><h3>Filter requests</h3></div>
              <button className="icon-button" onClick={() => setFiltersOpen(false)} type="button">×</button>
            </header>
            <div className="request-filter-fields">
              <label>Service<select value={advancedFilters.service} onChange={(event) => setAdvancedFilters({ ...advancedFilters, service: event.target.value })}>{services.map((service) => <option key={service}>{service}</option>)}</select></label>
              <label>Fulfilment team<select value={advancedFilters.team} onChange={(event) => setAdvancedFilters({ ...advancedFilters, team: event.target.value })}>{teamsAvailable.map((team) => <option key={team}>{team}</option>)}</select></label>
            </div>
            <footer>
              <button className="secondary-action" onClick={() => setAdvancedFilters({ service: 'All', team: 'All' })} type="button">Clear all</button>
              <button className="primary-action compact" onClick={() => setFiltersOpen(false)} type="button">Apply filters</button>
            </footer>
          </aside>
        </div>
      )}
    </section>
  )
}

function ServiceRequestRecordWorkspace({ addComment, newComment, setNewComment, ticket, updateTicket }) {
  const [activeSection, setActiveSection] = useState('overview')
  const [activityMode, setActivityMode] = useState('work')
  const items = requestItemsFor(ticket)
  const approvals = requestApprovalsFor(ticket)
  const tasks = requestTasksFor(ticket)
  const approvalsComplete = requestApprovalsComplete(ticket)
  const visibleTasks = requestVisibleTasks(ticket)
  const progress = requestWorkflowProgress(ticket)
  const totalCost = requestTotalCost(ticket)

  const writeTasks = (nextTasks, updates = {}) => {
    const completed = nextTasks.filter((task) => task.status === 'Completed').length
    const allComplete = nextTasks.length > 0 && completed === nextTasks.length
    updateTicket(ticket.id, {
      requestTasks: nextTasks,
      ...(allComplete ? { status: 'Resolved', nextStep: 'Fulfilment complete. Confirm requester acceptance and close the request.' } : {}),
      ...updates,
    })
  }

  const materialiseNewlyUnlockedTasks = (candidateTasks, approvalState = approvalsComplete) =>
    candidateTasks.map((task) => {
      if (!requestTaskUnlocked(task, candidateTasks, approvalState)) return task
      if (!['Waiting', 'Blocked'].includes(task.status)) return task
      return {
        ...task,
        status: 'Ready',
        assignee: task.autoAssignee || task.assignee || 'Unassigned',
      }
    })

  const updateTask = (taskId, updates) => {
    const nextTasks = materialiseNewlyUnlockedTasks(
      tasks.map((task) => task.id === taskId ? { ...task, ...updates } : task),
    )
    writeTasks(nextTasks)
  }

  const completeTask = (task) => {
    const completedTasks = tasks.map((candidate) =>
      candidate.id === task.id
        ? { ...candidate, status: 'Completed', completedAt: 'Just now', assignee: candidate.assignee || 'Dana Sinclair' }
        : candidate,
    )
    const nextTasks = materialiseNewlyUnlockedTasks(completedTasks)
    const newlyVisible = nextTasks.filter((candidate) =>
      candidate.status === 'Ready' && !visibleTasks.some((visible) => visible.id === candidate.id),
    )
    writeTasks(nextTasks, {
      comments: [
        `Work note: Fulfilment task completed — ${task.title}.`,
        ...(newlyVisible.length ? [`System: ${newlyVisible.map((candidate) => candidate.title).join(', ')} released to fulfilment.`] : []),
        ...ticket.comments,
      ],
    })
  }

  const updateApproval = (approvalId, status) => {
    const nextApprovals = approvals.map((approval) =>
      approval.id === approvalId ? { ...approval, status, updated: 'Just now' } : approval,
    )
    const nextApproved = nextApprovals.length > 0 && nextApprovals.every((approval) => approval.status === 'Approved')
    let nextTasks = tasks
    if (nextApproved) nextTasks = materialiseNewlyUnlockedTasks(tasks, true)
    updateTicket(ticket.id, {
      requestApprovals: nextApprovals,
      requestTasks: nextTasks,
      status: nextApproved ? 'In Progress' : ticket.status,
      nextStep: nextApproved ? 'Approval complete. Fulfilment tasks have been released.' : ticket.nextStep,
      comments: [
        `System: ${nextApprovals.find((approval) => approval.id === approvalId)?.label || 'Approval'} ${status.toLowerCase()}.`,
        ...ticket.comments,
      ],
    })
  }

  const taskDisplayStatus = (task) => task.status === 'Waiting' ? 'Ready' : task.status

  const renderOverview = () => (
    <div className="request-detail-overview">
      <section className="request-detail-section">
        <div className="request-section-heading"><span className="eyebrow">Requester</span><h3>{ticket.requester}</h3></div>
        <div className="request-requester-summary">
          <div className="request-avatar">{userInitials(ticket.requester)}</div>
          <div>
            <strong>{ticket.requester}</strong>
            <span>{ticket.requesterJobTitle || 'Requester'}{ticket.requesterDepartment ? ` · ${ticket.requesterDepartment}` : ''}</span>
            {ticket.requesterEmail && <small>{ticket.requesterEmail}</small>}
          </div>
        </div>
        <div className="request-information-grid">
          {(ticket.requestInformation?.length ? ticket.requestInformation : [
            { label: 'Location', value: ticket.location },
            { label: 'Service', value: ticket.service },
            { label: 'Priority', value: ticket.priority },
            { label: 'Fulfilment team', value: ticket.team },
          ]).map((field) => <IncidentProperty key={`${field.label}-${field.value}`} label={field.label} value={field.value} />)}
        </div>
      </section>

      <section className="request-detail-section">
        <div className="request-section-heading"><span className="eyebrow">Request</span><h3>Request information</h3></div>
        <p className="request-description-copy">{ticket.description}</p>
      </section>

      <section className="request-detail-summary-grid">
        <div><span>Requested items</span><strong>{items.reduce((sum, item) => sum + Number(item.quantity || 1), 0)}</strong><small>{formatRequestCost(totalCost)} cost snapshot</small></div>
        <div><span>Approvals</span><strong>{approvals.filter((approval) => approval.status === 'Approved').length}/{approvals.length || 0}</strong><small>{approvalsComplete ? 'Approval complete' : 'Awaiting approval'}</small></div>
        <div><span>Fulfilment</span><strong>{progress.completed}/{progress.total}</strong><small>{progress.percent}% complete</small></div>
      </section>

      <section className="request-next-step-card">
        <span className="eyebrow">Next step</span>
        <strong>{ticket.nextStep}</strong>
      </section>
    </div>
  )

  const renderItems = () => (
    <div className="request-items-panel">
      <div className="request-panel-intro">
        <div><span className="eyebrow">Cost snapshot</span><h3>Requested items</h3><p>Items and prices are captured with the request so later catalogue changes do not alter this record.</p></div>
        <div className="request-total-cost"><span>Total</span><strong>{formatRequestCost(totalCost)}</strong></div>
      </div>
      <div className="request-item-list">
        {items.map((item) => (
          <article className="request-item-card" key={item.id}>
            <div className="request-item-icon"><Server size={18} aria-hidden="true" /></div>
            <div className="request-item-main">
              <span>{item.category} · {item.id}</span>
              <h4>{item.name}</h4>
              <div className="request-item-options">{(item.options || []).map((option) => <span key={option}>{option}</span>)}</div>
            </div>
            <div className="request-item-price">
              <span>Qty {item.quantity || 1}</span>
              <strong>{formatRequestCost(Number(item.unitCost || 0) * Number(item.quantity || 1))}</strong>
              <small>{formatRequestCost(item.unitCost || 0)} each</small>
            </div>
          </article>
        ))}
      </div>
    </div>
  )

  const renderApprovals = () => (
    <div className="request-approvals-panel">
      <div className="request-panel-intro">
        <div><span className="eyebrow">Governance</span><h3>Approvals</h3><p>Fulfilment work that requires approval is not released until every required approval is complete.</p></div>
        <span className={`status-pill ${approvalsComplete ? 'resolved' : 'pending-approval'}`}>{approvalsComplete ? 'Approved' : 'Approval required'}</span>
      </div>
      {!approvals.length ? (
        <div className="request-empty-section"><CheckCircle2 size={22} /><strong>No approval required</strong><span>This request can move directly into fulfilment.</span></div>
      ) : (
        <div className="request-approval-list">
          {approvals.map((approval) => (
            <article className="request-approval-card" key={approval.id}>
              <div className={`request-approval-state ${approval.status.toLowerCase()}`}><ClipboardCheck size={18} aria-hidden="true" /></div>
              <div><span>{approval.label}</span><strong>{approval.approver}</strong><small>{approval.updated}</small></div>
              <span className={`status-pill ${approval.status === 'Approved' ? 'resolved' : approval.status === 'Rejected' ? 'closed' : 'pending-approval'}`}>{approval.status}</span>
              {approval.status === 'Pending' && (
                <div className="request-approval-actions">
                  <button onClick={() => updateApproval(approval.id, 'Rejected')} type="button">Reject</button>
                  <button className="primary-action compact" onClick={() => updateApproval(approval.id, 'Approved')} type="button">Approve</button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )

  const renderTasks = () => {
    const available = visibleTasks.filter((task) => task.status !== 'Completed')
    return (
      <div className="request-tasks-panel">
        <div className="request-panel-intro">
          <div>
            <span className="eyebrow">Fulfilment workflow</span>
            <h3>Tasks</h3>
            <p>Only work that is currently available is shown. Dependent tasks stay hidden and unassigned until their prerequisite task is completed.</p>
          </div>
          <div className="request-task-progress"><strong>{progress.completed}/{progress.total}</strong><span>complete</span></div>
        </div>

        <div className="request-task-context">
          <div><span className="eyebrow">Request context</span><strong>{ticket.requester}</strong><small>{ticket.requesterJobTitle || ticket.requesterDepartment || ticket.location}</small></div>
          <div><span className="eyebrow">Requested items</span><strong>{items.map((item) => `${item.name} ×${item.quantity || 1}`).join(' · ')}</strong><small>{formatRequestCost(totalCost)} captured cost</small></div>
        </div>

        <div className="request-task-list">
          {visibleTasks.map((task, index) => {
            const displayStatus = taskDisplayStatus(task)
            return (
              <article className={`request-task-card status-${displayStatus.toLowerCase().replace(/\s+/g, '-')}`} key={task.id}>
                <div className="request-task-index">{task.status === 'Completed' ? <CheckCircle2 size={18} /> : index + 1}</div>
                <div className="request-task-main">
                  <div className="request-task-title-row"><div><span>{task.id}</span><h4>{task.title}</h4></div><span className={`status-pill ${task.status === 'Completed' ? 'resolved' : task.status === 'In Progress' ? 'in-progress' : 'new'}`}>{displayStatus}</span></div>
                  <p>{task.instructions}</p>
                  <div className="request-task-meta">
                    <span><Users size={14} /> {task.team}</span>
                    <span><UserRound size={14} /> {task.assignee || 'Unassigned'}</span>
                    <span><Clock3 size={14} /> {task.due}</span>
                  </div>
                  {task.status !== 'Completed' && (
                    <div className="request-task-actions">
                      {(!task.assignee || task.assignee === 'Unassigned') && <button onClick={() => updateTask(task.id, { assignee: 'Dana Sinclair' })} type="button"><UserCheck size={15} /> Claim task</button>}
                      {['Ready', 'Waiting'].includes(task.status) && <button className="primary-action compact" onClick={() => updateTask(task.id, { status: 'In Progress', assignee: task.assignee === 'Unassigned' ? 'Dana Sinclair' : task.assignee })} type="button"><Wrench size={15} /> Start task</button>}
                      {task.status === 'In Progress' && <button className="primary-action compact" onClick={() => completeTask(task)} type="button"><CheckCircle2 size={15} /> Complete task</button>}
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>

        {!visibleTasks.length && (
          <div className="request-empty-section">
            <Clock3 size={22} aria-hidden="true" />
            <strong>{approvalsComplete ? 'No fulfilment work available yet' : 'Waiting for approval'}</strong>
            <span>{approvalsComplete ? 'The workflow will release its first task when its prerequisites are satisfied.' : 'No technician tasks are exposed or assigned until the required approvals are complete.'}</span>
          </div>
        )}
        {visibleTasks.length > 0 && !available.length && progress.percent < 100 && (
          <div className="request-empty-section compact"><Clock3 size={20} /><strong>Waiting for the next workflow transition</strong></div>
        )}
      </div>
    )
  }

  const renderActivity = () => (
    <div className="request-activity-panel">
      <div className="request-panel-intro"><div><span className="eyebrow">History</span><h3>Activity</h3><p>Keep internal fulfilment notes separate from updates intended for the requester.</p></div></div>
      <div className="incident-activity-composer request-activity-composer">
        <div className="incident-note-mode">
          <button className={activityMode === 'work' ? 'active' : ''} onClick={() => setActivityMode('work')} type="button">Work note</button>
          <button className={activityMode === 'customer' ? 'active' : ''} onClick={() => setActivityMode('customer')} type="button">Requester comment</button>
        </div>
        <textarea onChange={(event) => setNewComment(event.target.value)} placeholder={activityMode === 'work' ? 'Add fulfilment notes, handover details or task context' : 'Write an update the requester can see'} value={newComment} />
        <div className="incident-composer-footer"><span>{activityMode === 'work' ? 'Visible to analysts and fulfilment teams' : 'Visible to the requester'}</span><button className="primary-action compact" onClick={() => addComment(activityMode)} type="button"><Send size={15} /> Add update</button></div>
      </div>
      <div className="incident-activity-timeline request-activity-timeline">
        {ticket.comments.map((comment, index) => {
          const lower = comment.toLowerCase()
          const kind = lower.startsWith('customer comment') ? 'customer' : lower.startsWith('system') ? 'system' : 'work'
          return <article className={`incident-activity-event ${kind}`} key={`${ticket.id}-request-${index}-${comment}`}><span className="incident-event-dot" /><div><header><strong>{kind === 'system' ? 'System' : 'Dana Sinclair'}</strong><span>{kind === 'customer' ? 'Requester comment' : kind === 'system' ? 'Workflow event' : 'Work note'}</span></header><p>{comment.replace(/^(Customer comment:|Work note:|System:)\s*/i, '')}</p></div></article>
        })}
      </div>
    </div>
  )

  const panel = activeSection === 'items'
    ? renderItems()
    : activeSection === 'approvals'
      ? renderApprovals()
      : activeSection === 'tasks'
        ? renderTasks()
        : activeSection === 'activity'
          ? renderActivity()
          : renderOverview()

  return (
    <div className="service-request-record-v2">
      <header className="request-record-header">
        <div className="request-record-title">
          <span className="eyebrow">{ticket.id}</span>
          <h2>{ticket.title}</h2>
          <div className="request-record-badges"><span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span><span>{ticket.service}</span><span>{ticket.priority} priority</span></div>
        </div>
        <div className="request-record-summary">
          <div><span>Total cost</span><strong>{formatRequestCost(totalCost)}</strong></div>
          <div><span>Workflow</span><strong>{progress.completed}/{progress.total}</strong><small>{progress.percent}% complete</small></div>
        </div>
      </header>

      <div className="request-record-progress" aria-label="Request workflow progress"><span><i style={{ width: `${progress.percent}%` }} /></span></div>

      <nav className="request-record-tabs" aria-label="Service request sections">
        {serviceRequestSections.map(({ id, label, icon: Icon }) => (
          <button aria-current={activeSection === id ? 'page' : undefined} className={activeSection === id ? 'active' : ''} key={id} onClick={() => setActiveSection(id)} type="button"><Icon size={16} aria-hidden="true" />{label}</button>
        ))}
      </nav>

      <div className="request-record-panel">{panel}</div>
    </div>
  )
}


const problemRecordSections = [
  { id: 'overview', label: 'Overview', icon: Inbox },
  { id: 'investigation', label: 'Investigation', icon: Wrench },
  { id: 'related', label: 'Related', icon: Server },
  { id: 'known-error', label: 'Known Error', icon: AlertCircle },
  { id: 'activity', label: 'Activity', icon: MessageSquarePlus },
]

const problemLifecycle = ['New', 'Under Investigation', 'Known Error', 'Fix in Progress', 'Resolved', 'Closed']

function problemLifecycleIndex(status) {
  if (status === 'Monitoring') return 2
  const index = problemLifecycle.indexOf(status)
  return index < 0 ? 0 : index
}

function ProblemRecordWorkspace({
  addComment,
  newComment,
  openAssetByName,
  openRecordTab,
  setNewComment,
  ticket,
  tickets,
  updateTicket,
}) {
  const [activeSection, setActiveSection] = useState('overview')
  const lifecycleIndex = problemLifecycleIndex(ticket.status)
  const relatedIncidents = (ticket.relatedIncidents || [])
    .map((id) => tickets?.find((candidate) => candidate.id === id))
    .filter(Boolean)
  const relatedChanges = (ticket.relatedChanges || [])
    .map((id) => tickets?.find((candidate) => candidate.id === id))
    .filter(Boolean)
  const knownErrorActive = ticket.knownErrorStatus && ticket.knownErrorStatus !== 'Not declared'

  const setStatus = (status, nextStep) => {
    updateTicket(ticket.id, {
      status,
      nextStep,
      comments: [`System: Problem moved to ${status}.`, ...ticket.comments],
    })
  }

  const renderOverview = () => (
    <div className="problem-overview-grid">
      <section className="problem-section-card problem-statement-card">
        <div className="problem-section-heading"><span className="eyebrow">Problem statement</span><h3>Recurring issue</h3></div>
        <p>{ticket.description}</p>
        <div className="problem-impact-callout"><span>Impact scope</span><strong>{ticket.problemImpactScope || 'Scope still being established'}</strong></div>
      </section>

      <section className="problem-section-card">
        <div className="problem-section-heading"><span className="eyebrow">Ownership</span><h3>Investigation owner</h3></div>
        <div className="problem-property-grid">
          <IncidentProperty label="Service" value={ticket.service} />
          <IncidentProperty label="Assignment group" value={ticket.team} />
          <IncidentProperty label="Problem owner" value={ticket.assignee} />
          <IncidentProperty label="Priority" strong value={ticket.priority} />
          <IncidentProperty label="Location / scope" value={ticket.location} />
          <IncidentProperty label="Updated" value={ticket.updated} />
        </div>
      </section>

      <section className="problem-section-card problem-next-card">
        <div className="problem-section-heading"><span className="eyebrow">Current position</span><h3>What happens next</h3></div>
        <p>{ticket.nextStep}</p>
        <div className="problem-overview-counts">
          <div><span>Related incidents</span><strong>{ticket.relatedIncidents?.length || 0}</strong></div>
          <div><span>Affected CIs</span><strong>{ticket.linkedAssets?.length || 0}</strong></div>
          <div><span>Known error</span><strong>{knownErrorActive ? 'Declared' : 'No'}</strong></div>
        </div>
      </section>
    </div>
  )

  const renderInvestigation = () => (
    <div className="problem-investigation-layout">
      <section className="problem-section-card">
        <div className="problem-section-heading"><span className="eyebrow">Working theory</span><h3>Current hypothesis</h3></div>
        <textarea
          className="problem-editor"
          onChange={(event) => updateTicket(ticket.id, { problemHypothesis: event.target.value })}
          placeholder="What do we currently believe is causing the recurring issue?"
          value={ticket.problemHypothesis || ''}
        />
      </section>
      <section className="problem-section-card">
        <div className="problem-section-heading"><span className="eyebrow">Mitigation</span><h3>Current workaround</h3></div>
        <textarea
          className="problem-editor"
          onChange={(event) => updateTicket(ticket.id, { problemWorkaround: event.target.value })}
          placeholder="Document a safe workaround analysts can use while investigation continues."
          value={ticket.problemWorkaround || ''}
        />
      </section>
      <section className="problem-section-card">
        <div className="problem-section-heading"><span className="eyebrow">Confirmed cause</span><h3>Root cause</h3></div>
        <textarea
          className="problem-editor"
          onChange={(event) => updateTicket(ticket.id, { problemRootCause: event.target.value })}
          placeholder="Capture the confirmed technical or process root cause."
          value={ticket.problemRootCause || ''}
        />
      </section>
      <section className="problem-section-card">
        <div className="problem-section-heading"><span className="eyebrow">Permanent resolution</span><h3>Permanent fix</h3></div>
        <textarea
          className="problem-editor"
          onChange={(event) => updateTicket(ticket.id, { problemPermanentFix: event.target.value })}
          placeholder="Describe the permanent corrective action or linked change."
          value={ticket.problemPermanentFix || ''}
        />
      </section>
    </div>
  )

  const renderRelated = () => (
    <div className="problem-related-grid">
      <section className="problem-section-card">
        <div className="problem-section-heading"><span className="eyebrow">Recurring demand</span><h3>Related incidents</h3></div>
        <div className="problem-linked-record-list">
          {relatedIncidents.length ? relatedIncidents.map((incident) => (
            <button key={incident.id} onClick={() => openRecordTab?.(incident)} type="button">
              <span><strong>{incident.id}</strong><small>{incident.title}</small></span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          )) : <div className="problem-empty-state">No linked incidents yet.</div>}
        </div>
      </section>
      <section className="problem-section-card">
        <div className="problem-section-heading"><span className="eyebrow">Configuration</span><h3>Affected CIs</h3></div>
        <div className="problem-ci-grid">
          {(ticket.linkedAssets?.length ? ticket.linkedAssets : ['No CI linked']).map((asset) => asset === 'No CI linked' ? (
            <span key={asset}>{asset}</span>
          ) : (
            <button key={asset} onClick={() => openAssetByName?.(asset)} type="button"><Server size={15} />{asset}</button>
          ))}
        </div>
      </section>
      <section className="problem-section-card">
        <div className="problem-section-heading"><span className="eyebrow">Corrective work</span><h3>Related changes</h3></div>
        <div className="problem-linked-record-list">
          {relatedChanges.length ? relatedChanges.map((change) => (
            <button key={change.id} onClick={() => openRecordTab?.(change)} type="button">
              <span><strong>{change.id}</strong><small>{change.title}</small></span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          )) : <div className="problem-empty-state">No corrective change linked yet.</div>}
        </div>
      </section>
    </div>
  )

  const renderKnownError = () => (
    <div className="problem-known-error-layout">
      <section className={`problem-known-error-hero ${knownErrorActive ? 'active' : ''}`}>
        <div><span className="eyebrow">Known error status</span><h3>{knownErrorActive ? ticket.knownErrorStatus : 'Not declared'}</h3></div>
        <button
          className={knownErrorActive ? 'secondary-action compact' : 'primary-action compact'}
          onClick={() => updateTicket(ticket.id, {
            knownErrorStatus: knownErrorActive ? 'Not declared' : 'Published internally',
            status: knownErrorActive ? 'Under Investigation' : 'Known Error',
            knownErrorTitle: ticket.knownErrorTitle || ticket.title,
            comments: [`System: Known error ${knownErrorActive ? 'withdrawn' : 'declared'}.`, ...ticket.comments],
          })}
          type="button"
        >
          <AlertCircle size={16} />
          {knownErrorActive ? 'Withdraw known error' : 'Declare known error'}
        </button>
      </section>
      <section className="problem-section-card">
        <label>Known error title<input onChange={(event) => updateTicket(ticket.id, { knownErrorTitle: event.target.value })} value={ticket.knownErrorTitle || ''} /></label>
        <label>Published workaround<textarea onChange={(event) => updateTicket(ticket.id, { problemWorkaround: event.target.value })} value={ticket.problemWorkaround || ''} /></label>
      </section>
      <section className="problem-section-card">
        <div className="problem-section-heading"><span className="eyebrow">Affected versions / scope</span><h3>Known impact</h3></div>
        <div className="problem-version-chips">
          {(ticket.affectedVersions?.length ? ticket.affectedVersions : ['Scope not yet defined']).map((item) => <span key={item}>{item}</span>)}
        </div>
        <div className="problem-kb-link"><BookOpen size={16} /><span>{ticket.knowledgeArticle || 'No knowledge article linked yet'}</span></div>
      </section>
    </div>
  )

  const renderActivity = () => (
    <div className="problem-activity-layout">
      <div className="incident-activity-composer">
        <div className="incident-composer-heading"><span className="eyebrow">Investigation journal</span><strong>Add work note</strong></div>
        <textarea onChange={(event) => setNewComment(event.target.value)} placeholder="Add evidence, investigation progress or handover context" value={newComment} />
        <div className="incident-composer-footer"><span>Internal Problem Management activity</span><button className="primary-action compact" onClick={() => addComment('work')} type="button"><Send size={15} /> Add note</button></div>
      </div>
      <div className="incident-activity-timeline">
        {ticket.comments.map((comment, index) => {
          const system = comment.toLowerCase().startsWith('system:')
          return <article className={`incident-activity-event ${system ? 'system' : 'work'}`} key={`${ticket.id}-problem-${index}-${comment}`}><span className="incident-event-dot" /><div><header><strong>{system ? 'System' : 'Dana Sinclair'}</strong><span>{system ? 'Problem event' : 'Work note'}</span></header><p>{comment.replace(/^(Work note:|System:)\s*/i, '')}</p></div></article>
        })}
      </div>
    </div>
  )

  const panel = activeSection === 'investigation'
    ? renderInvestigation()
    : activeSection === 'related'
      ? renderRelated()
      : activeSection === 'known-error'
        ? renderKnownError()
        : activeSection === 'activity'
          ? renderActivity()
          : renderOverview()

  return (
    <div className="problem-record-v2">
      <header className="problem-record-header">
        <div className="problem-record-title">
          <span className="eyebrow">{ticket.id}</span>
          <h2>{ticket.title}</h2>
          <div className="problem-record-badges"><span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span><span>{ticket.service}</span><span>{ticket.priority} priority</span></div>
        </div>
        <div className="problem-record-actions">
          <button onClick={() => updateTicket(ticket.id, { assignee: 'Dana Sinclair' })} type="button"><UserCheck size={16} />Assign to me</button>
          {ticket.status === 'New' && <button onClick={() => setStatus('Under Investigation', 'Establish evidence, scope and current hypothesis.')} type="button"><Wrench size={16} />Start investigation</button>}
          {!knownErrorActive && !['Resolved', 'Closed'].includes(ticket.status) && <button onClick={() => { updateTicket(ticket.id, { knownErrorStatus: 'Published internally', knownErrorTitle: ticket.knownErrorTitle || ticket.title }); setStatus('Known Error', 'Publish the workaround and progress the permanent fix.') }} type="button"><AlertCircle size={16} />Known error</button>}
          {['Known Error', 'Monitoring'].includes(ticket.status) && <button onClick={() => setStatus('Fix in Progress', 'Implement or validate the permanent corrective action.')} type="button"><Wrench size={16} />Fix in progress</button>}
          {!['Resolved', 'Closed'].includes(ticket.status) && <button onClick={() => setStatus('Resolved', 'Monitor the permanent fix before closure.')} type="button"><CheckCircle2 size={16} />Resolve</button>}
          {ticket.status === 'Resolved' && <button onClick={() => setStatus('Closed', 'Problem closed.')} type="button"><CheckCircle2 size={16} />Close</button>}
        </div>
      </header>

      <div className="problem-lifecycle" aria-label="Problem lifecycle">
        {problemLifecycle.map((status, index) => <div className={index === lifecycleIndex ? 'current' : index < lifecycleIndex ? 'complete' : ''} key={status}><span>{index < lifecycleIndex ? '✓' : index + 1}</span><strong>{status}</strong></div>)}
      </div>

      <nav className="problem-record-tabs" aria-label="Problem record sections">
        {problemRecordSections.map(({ id, label, icon: Icon }) => <button aria-current={activeSection === id ? 'page' : undefined} className={activeSection === id ? 'active' : ''} key={id} onClick={() => setActiveSection(id)} type="button"><Icon size={16} />{label}</button>)}
      </nav>
      <div className="problem-record-panel">{panel}</div>
    </div>
  )
}

function ProblemQueueView({ openNewRecord, openRecordTab, query, setQuery, tickets }) {
  const [quickView, setQuickView] = useState('all')
  const [sortKey, setSortKey] = useState('updated')
  const problems = tickets.filter((ticket) => ticket.type === 'Problem')
  const openProblems = problems.filter((ticket) => !['Resolved', 'Closed'].includes(ticket.status))
  const knownErrors = problems.filter((ticket) => ticket.knownErrorStatus && ticket.knownErrorStatus !== 'Not declared')
  const relatedIncidentCount = problems.reduce((total, ticket) => total + (ticket.relatedIncidents?.length || 0), 0)

  const visible = problems
    .filter((ticket) => {
      const needle = query.trim().toLowerCase()
      const matchesQuery = !needle || [ticket.id, ticket.title, ticket.service, ticket.assignee, ticket.problemImpactScope].some((value) => String(value || '').toLowerCase().includes(needle))
      if (!matchesQuery) return false
      if (quickView === 'mine') return ticket.assignee === 'Dana Sinclair'
      if (quickView === 'investigation') return ['New', 'Under Investigation', 'Monitoring'].includes(ticket.status)
      if (quickView === 'known') return ticket.knownErrorStatus && ticket.knownErrorStatus !== 'Not declared'
      if (quickView === 'no-workaround') return !ticket.problemWorkaround
      if (quickView === 'resolved') return ['Resolved', 'Closed'].includes(ticket.status)
      return true
    })
    .sort((a, b) => {
      if (sortKey === 'priority') return priorities.indexOf(a.priority) - priorities.indexOf(b.priority)
      if (sortKey === 'incidents') return (b.relatedIncidents?.length || 0) - (a.relatedIncidents?.length || 0)
      return b.id.localeCompare(a.id)
    })

  const quickViews = [
    ['all', 'All'], ['mine', 'Mine'], ['investigation', 'Investigation'], ['known', 'Known errors'], ['no-workaround', 'No workaround'], ['resolved', 'Resolved'],
  ]

  return (
    <div className="problem-queue-v2">
      <header className="problem-queue-header">
        <div><span className="eyebrow">Problem Management</span><h2>Problems</h2><p>Find recurring causes, publish safe workarounds and drive permanent fixes.</p></div>
        <button className="primary-action compact" onClick={() => openNewRecord('Problem')} type="button"><Plus size={16} />New Problem</button>
      </header>
      <div className="problem-queue-metrics">
        <div><span>Open problems</span><strong>{openProblems.length}</strong></div>
        <div><span>Known errors</span><strong>{knownErrors.length}</strong></div>
        <div><span>Related incidents</span><strong>{relatedIncidentCount}</strong></div>
        <div><span>Fix in progress</span><strong>{problems.filter((ticket) => ticket.status === 'Fix in Progress').length}</strong></div>
      </div>
      <div className="problem-queue-toolbar">
        <label className="problem-search"><Search size={18} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Search problems, services, owners..." type="search" value={query} /></label>
        <label className="problem-sort">Sort<select onChange={(event) => setSortKey(event.target.value)} value={sortKey}><option value="updated">Updated</option><option value="priority">Priority</option><option value="incidents">Related incidents</option></select></label>
      </div>
      <div className="problem-quick-views">{quickViews.map(([id, label]) => <button className={quickView === id ? 'active' : ''} key={id} onClick={() => setQuickView(id)} type="button">{label}</button>)}</div>
      <div className="problem-queue-result-line"><strong>{visible.length} problems</strong><span>{quickViews.find(([id]) => id === quickView)?.[1]}</span></div>

      <div className="problem-table-wrap">
        <table className="problem-table"><thead><tr><th>Reference</th><th>Problem</th><th>Status</th><th>Related incidents</th><th>Service</th><th>Owner</th><th>Known error</th><th>Updated</th></tr></thead><tbody>{visible.map((ticket) => <tr key={ticket.id} onClick={() => openRecordTab(ticket)}><td><button onClick={(event) => { event.stopPropagation(); openRecordTab(ticket) }} type="button">{ticket.id}</button></td><td><strong>{ticket.title}</strong><small>{ticket.problemImpactScope || ticket.location}</small></td><td><span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span></td><td><strong>{ticket.relatedIncidents?.length || 0}</strong></td><td>{ticket.service}</td><td>{ticket.assignee}</td><td>{ticket.knownErrorStatus && ticket.knownErrorStatus !== 'Not declared' ? <span className="problem-known-chip">Declared</span> : '—'}</td><td>{ticket.updated}</td></tr>)}</tbody></table>
      </div>

      <div className="problem-mobile-list">{visible.map((ticket) => <button className="problem-mobile-card" key={ticket.id} onClick={() => openRecordTab(ticket)} type="button"><div className="problem-mobile-card-top"><strong>{ticket.id}</strong><span className={`priority-label ${priorityClass(ticket.priority)}`}>{ticket.priority}</span></div><h3>{ticket.title}</h3><div className="problem-mobile-state"><span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>{ticket.knownErrorStatus && ticket.knownErrorStatus !== 'Not declared' && <span className="problem-known-chip">Known error</span>}</div><div className="problem-mobile-meta"><span>{ticket.service} · {ticket.assignee}</span><span>{ticket.relatedIncidents?.length || 0} incidents</span></div><footer><span>Updated {ticket.updated}</span><ChevronRight size={17} /></footer></button>)}</div>
      {!visible.length && <div className="problem-empty-state queue">No problems match this view.</div>}
    </div>
  )
}

const changeRecordSections = [
  { id: 'overview', label: 'Overview', icon: Inbox },
  { id: 'plan', label: 'Plan', icon: ListChecks },
  { id: 'risk', label: 'Risk & Approval', icon: ClipboardCheck },
  { id: 'schedule', label: 'Schedule', icon: CalendarClock },
  { id: 'cis', label: 'Affected CIs', icon: Server },
  { id: 'implementation', label: 'Implementation', icon: Wrench },
  { id: 'activity', label: 'Activity', icon: MessageSquarePlus },
]

const changeLifecycle = ['Draft', 'Assessment', 'Pending Approval', 'Scheduled', 'Implementing', 'Review', 'Closed']

function changeLifecycleIndex(status) {
  if (status === 'CAB Review') return 2
  if (status === 'In Progress') return 4
  if (status === 'Approved') return 3
  const index = changeLifecycle.indexOf(status)
  return index < 0 ? 0 : index
}

function ChangeRecordWorkspace({ addComment, newComment, openAssetByName, openRecordTab, setNewComment, ticket, tickets, updateTicket }) {
  const [activeSection, setActiveSection] = useState('overview')
  const lifecycleIndex = changeLifecycleIndex(ticket.status)
  const relatedProblems = (ticket.relatedProblems || []).map((id) => tickets?.find((candidate) => candidate.id === id)).filter(Boolean)

  const transition = (status, nextStep, updates = {}) => updateTicket(ticket.id, {
    status,
    nextStep,
    ...updates,
    comments: [`System: Change moved to ${status}.`, ...ticket.comments],
  })

  const renderOverview = () => <div className="change-overview-grid">
    <section className="change-section-card change-reason-card"><div className="change-section-heading"><span className="eyebrow">Business reason</span><h3>Why this change is needed</h3></div><p>{ticket.businessReason || ticket.description}</p><div className="change-next-step"><span>Next step</span><strong>{ticket.nextStep}</strong></div></section>
    <section className="change-section-card"><div className="change-section-heading"><span className="eyebrow">Ownership</span><h3>Change record</h3></div><div className="problem-property-grid"><IncidentProperty label="Type" value={ticket.changeType || 'Normal'} /><IncidentProperty label="Service" value={ticket.service} /><IncidentProperty label="Owner" value={ticket.assignee} /><IncidentProperty label="Assignment group" value={ticket.team} /><IncidentProperty label="Risk" strong value={ticket.risk || 'Medium'} /><IncidentProperty label="Approval" value={ticket.approval || 'Not submitted'} /></div></section>
    {relatedProblems.length > 0 && <section className="change-section-card"><div className="change-section-heading"><span className="eyebrow">Related Problems</span><h3>Corrective context</h3></div><div className="problem-linked-record-list">{relatedProblems.map((problem) => <button key={problem.id} onClick={() => openRecordTab?.(problem)} type="button"><span><strong>{problem.id}</strong><small>{problem.title}</small></span><ChevronRight size={16} /></button>)}</div></section>}
  </div>

  const renderPlan = () => <div className="change-plan-grid">
    <section className="change-section-card"><div className="change-section-heading"><span className="eyebrow">Implementation</span><h3>Implementation plan</h3></div><textarea className="change-plan-editor" onChange={(event) => updateTicket(ticket.id, { implementationPlan: event.target.value })} value={ticket.implementationPlan || ''} /></section>
    <section className="change-section-card"><div className="change-section-heading"><span className="eyebrow">Validation</span><h3>Test plan</h3></div><textarea className="change-plan-editor" onChange={(event) => updateTicket(ticket.id, { testPlan: event.target.value })} value={ticket.testPlan || ''} /></section>
    <section className="change-section-card"><div className="change-section-heading"><span className="eyebrow">Recovery</span><h3>Backout plan</h3></div><textarea className="change-plan-editor" onChange={(event) => updateTicket(ticket.id, { backoutPlan: event.target.value })} value={ticket.backoutPlan || ''} /></section>
  </div>

  const renderRisk = () => <div className="change-risk-layout">
    <section className="change-risk-hero"><div><span className="eyebrow">Overall risk</span><h3>{ticket.risk || 'Medium'}</h3><p>{ticket.riskSummary || 'Risk assessment still needs to be completed.'}</p></div><label>Risk<select onChange={(event) => updateTicket(ticket.id, { risk: event.target.value })} value={ticket.risk || 'Medium'}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label></section>
    <section className="change-section-card"><div className="change-section-heading"><span className="eyebrow">Approval route</span><h3>{ticket.approvalRoute || 'CAB'}</h3></div><div className="change-approval-status"><span>Current decision</span><strong>{ticket.approval || 'Not submitted'}</strong></div><div className="change-approval-actions"><button className="secondary-action compact" onClick={() => transition('Pending Approval', 'Awaiting the configured approval route.', { approval: 'Pending' })} type="button"><ClipboardCheck size={16} />Submit</button><button className="primary-action compact" onClick={() => transition('Scheduled', 'Confirm implementation readiness for the approved window.', { approval: 'Approved' })} type="button"><CheckCircle2 size={16} />Approve</button><button className="secondary-action compact" onClick={() => updateTicket(ticket.id, { approval: 'Rejected', status: 'Assessment', nextStep: 'Address approval feedback before resubmitting.' })} type="button"><AlertCircle size={16} />Reject</button></div></section>
  </div>

  const renderSchedule = () => <div className="change-schedule-layout"><section className="change-schedule-hero"><div><span className="eyebrow">Implementation window</span><h3>{ticket.window || 'To be scheduled'}</h3><p>{ticket.downtime || 'No outage statement recorded'}</p></div><CalendarClock size={28} /></section><section className="change-section-card"><div className="change-schedule-grid"><label>Planned start<input onChange={(event) => updateTicket(ticket.id, { plannedStart: event.target.value, window: `${event.target.value || 'TBC'} → ${ticket.plannedEnd || 'TBC'}` })} value={ticket.plannedStart || ''} /></label><label>Planned end<input onChange={(event) => updateTicket(ticket.id, { plannedEnd: event.target.value, window: `${ticket.plannedStart || 'TBC'} → ${event.target.value || 'TBC'}` })} value={ticket.plannedEnd || ''} /></label><label className="span-two">Expected customer impact<input onChange={(event) => updateTicket(ticket.id, { downtime: event.target.value })} value={ticket.downtime || ''} /></label></div></section></div>

  const renderCis = () => <div className="change-ci-layout"><section className="change-section-card"><div className="change-section-heading"><span className="eyebrow">Configuration scope</span><h3>Affected configuration items</h3></div><div className="change-ci-grid">{(ticket.linkedAssets?.length ? ticket.linkedAssets : ['No CI linked']).map((asset) => asset === 'No CI linked' ? <span key={asset}>{asset}</span> : <button key={asset} onClick={() => openAssetByName?.(asset)} type="button"><Server size={16} /><strong>{asset}</strong><small>Open configuration item</small></button>)}</div></section><section className="change-section-card"><div className="change-section-heading"><span className="eyebrow">Service impact</span><h3>{ticket.service}</h3></div><p>{ticket.description}</p></section></div>

  const renderImplementation = () => <div className="change-implementation-layout"><section className="change-section-card"><div className="change-section-heading"><span className="eyebrow">Execution log</span><h3>Implementation notes</h3></div><textarea className="change-plan-editor" onChange={(event) => updateTicket(ticket.id, { implementationNotes: event.target.value })} placeholder="Record implementation evidence, timings and deviations from plan" value={ticket.implementationNotes || ''} /></section><section className="change-section-card"><div className="change-section-heading"><span className="eyebrow">Post implementation</span><h3>Review outcome</h3></div><textarea className="change-plan-editor" onChange={(event) => updateTicket(ticket.id, { reviewOutcome: event.target.value })} placeholder="Capture success criteria, issues, lessons learned and follow-up actions" value={ticket.reviewOutcome || ''} /></section></div>

  const renderActivity = () => <div className="change-activity-layout"><div className="incident-activity-composer"><div className="incident-composer-heading"><span className="eyebrow">Change journal</span><strong>Add work note</strong></div><textarea onChange={(event) => setNewComment(event.target.value)} placeholder="Add CAB context, implementation evidence or review notes" value={newComment} /><div className="incident-composer-footer"><span>Internal change activity</span><button className="primary-action compact" onClick={() => addComment('work')} type="button"><Send size={15} />Add note</button></div></div><div className="incident-activity-timeline">{ticket.comments.map((comment, index) => { const system = comment.toLowerCase().startsWith('system:'); return <article className={`incident-activity-event ${system ? 'system' : 'work'}`} key={`${ticket.id}-change-${index}-${comment}`}><span className="incident-event-dot" /><div><header><strong>{system ? 'System' : 'Dana Sinclair'}</strong><span>{system ? 'Change event' : 'Work note'}</span></header><p>{comment.replace(/^(Work note:|System:)\s*/i, '')}</p></div></article> })}</div></div>

  const panel = activeSection === 'plan' ? renderPlan() : activeSection === 'risk' ? renderRisk() : activeSection === 'schedule' ? renderSchedule() : activeSection === 'cis' ? renderCis() : activeSection === 'implementation' ? renderImplementation() : activeSection === 'activity' ? renderActivity() : renderOverview()

  return <div className="change-record-v2"><header className="change-record-header"><div className="change-record-title"><span className="eyebrow">{ticket.id}</span><h2>{ticket.title}</h2><div className="change-record-badges"><span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span><span>{ticket.changeType || 'Normal'} change</span><span className={`change-risk-badge ${String(ticket.risk || 'Medium').toLowerCase()}`}>{ticket.risk || 'Medium'} risk</span></div></div><div className="change-record-actions"><button onClick={() => updateTicket(ticket.id, { assignee: 'Dana Sinclair' })} type="button"><UserCheck size={16} />Assign to me</button>{ticket.status === 'Draft' && <button onClick={() => transition('Assessment', 'Complete risk, plan and schedule assessment before approval.')} type="button"><ListChecks size={16} />Start assessment</button>}{ticket.status === 'Assessment' && <button onClick={() => transition('Pending Approval', 'Awaiting the configured approval route.', { approval: 'Pending' })} type="button"><ClipboardCheck size={16} />Submit</button>}{['Pending Approval', 'CAB Review'].includes(ticket.status) && <button onClick={() => transition('Scheduled', 'Approved. Confirm readiness for the implementation window.', { approval: 'Approved' })} type="button"><CheckCircle2 size={16} />Approve</button>}{ticket.status === 'Scheduled' && <button onClick={() => transition('Implementing', 'Execute the approved implementation plan and capture evidence.')} type="button"><Wrench size={16} />Implement</button>}{ticket.status === 'Implementing' && <button onClick={() => transition('Review', 'Complete post-implementation validation and review.')} type="button"><ClipboardCheck size={16} />Review</button>}{ticket.status === 'Review' && <button onClick={() => transition('Closed', 'Change closed after successful review.')} type="button"><CheckCircle2 size={16} />Close</button>}</div></header><div className="change-lifecycle" aria-label="Change lifecycle">{changeLifecycle.map((status, index) => <div className={index === lifecycleIndex ? 'current' : index < lifecycleIndex ? 'complete' : ''} key={status}><span>{index < lifecycleIndex ? '✓' : index + 1}</span><strong>{status}</strong></div>)}</div><nav className="change-record-tabs" aria-label="Change record sections">{changeRecordSections.map(({ id, label, icon: Icon }) => <button aria-current={activeSection === id ? 'page' : undefined} className={activeSection === id ? 'active' : ''} key={id} onClick={() => setActiveSection(id)} type="button"><Icon size={16} />{label}</button>)}</nav><div className="change-record-panel">{panel}</div></div>
}


export function TicketsView({
  addComment,
  filters,
  filteredTickets,
  handleTicketSubmit,
  moduleConfig,
  newComment,
  openNewRecord,
  openRecordTab,
  query,
  selectedTicket,
  setFilters,
  setNewComment,
  setQuery,
  setSelectedTicketId,
  setTicketDraft,
  ticketDraft,
  tickets,
  updateTicket,
}) {
  if (moduleConfig?.type === 'Incident') {
    return (
      <IncidentQueueView
        filters={filters}
        filteredTickets={filteredTickets}
        openNewRecord={openNewRecord}
        openRecordTab={openRecordTab}
        query={query}
        setFilters={setFilters}
        setQuery={setQuery}
        tickets={tickets}
        updateTicket={updateTicket}
      />
    )
  }

  if (moduleConfig?.type === 'Service Request') {
    return (
      <ServiceRequestQueueView
        filteredTickets={filteredTickets}
        openNewRecord={openNewRecord}
        openRecordTab={openRecordTab}
        query={query}
        setQuery={setQuery}
        tickets={tickets}
      />
    )
  }

  if (moduleConfig?.type === 'Problem') {
    return (
      <ProblemQueueView
        openNewRecord={openNewRecord}
        openRecordTab={openRecordTab}
        query={query}
        setQuery={setQuery}
        tickets={tickets}
      />
    )
  }

  const moduleTickets = moduleConfig
    ? tickets.filter((ticket) => ticket.type === moduleConfig.type)
    : tickets
  const recordLabel = moduleConfig ? moduleConfig.label.toLowerCase() : 'records'
  const queueTitle = moduleConfig?.queueTitle || 'All Records'
  const createTitle = moduleConfig?.createTitle || 'New Record'
  const createLabel = moduleConfig?.createLabel || 'Create Record'
  const searchPlaceholder = moduleConfig?.searchPlaceholder || 'Record, requester, service'

  return (
    <div className="tickets-layout">
      <section className="ticket-list-zone">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{filteredTickets.length} of {moduleTickets.length} {recordLabel}</span>
            <h2>{queueTitle}</h2>
          </div>
          <button
            className="primary-action compact"
            onClick={() => openNewRecord?.(moduleConfig?.type || ticketDraft.type)}
            type="button"
          >
            <Plus size={16} aria-hidden="true" />
            {createLabel}
          </button>
        </div>

        <div className={moduleConfig ? 'filter-grid module-filter-grid' : 'filter-grid'}>
          <label>
            Search
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              type="search"
              value={query}
            />
          </label>
          {!moduleConfig && (
            <FilterSelect label="Type" options={['All', ...types]} value={filters.type} onChange={(type) => setFilters({ ...filters, type })} />
          )}
          <FilterSelect label="Priority" options={['All', ...priorities]} value={filters.priority} onChange={(priority) => setFilters({ ...filters, priority })} />
          <FilterSelect label="Status" options={['All', ...statusOptions]} value={filters.status} onChange={(status) => setFilters({ ...filters, status })} />
        </div>

        <div className="ticket-stack">
          {filteredTickets.map((ticket) => (
            <button
              className={selectedTicket?.id === ticket.id ? 'ticket-card selected' : 'ticket-card'}
              key={ticket.id}
              onClick={() => {
                setSelectedTicketId(ticket.id)
                openRecordTab(ticket)
              }}
              type="button"
            >
              <div className="ticket-card-top">
                <span className={`type-chip ${ticket.type.toLowerCase().replace(/\s+/g, '-')}`}>{ticket.type}</span>
                <span className={`priority-label ${priorityClass(ticket.priority)}`}>{ticket.priority}</span>
              </div>
              <strong>{ticket.title}</strong>
              <div className="ticket-meta">
                <span>{ticket.id}</span>
                <span>{ticket.requester}</span>
                <span>{ticket.team}</span>
              </div>
              <div className="ticket-card-bottom">
                <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
                <SlaBar value={ticket.slaPercent} label={ticket.sla} />
              </div>
            </button>
          ))}
        </div>
      </section>

      <aside className="ticket-detail-zone">
        {selectedTicket && (
          <TicketDetailContent
            addComment={addComment}
            newComment={newComment}
            setNewComment={setNewComment}
            ticket={selectedTicket}
            updateTicket={updateTicket}
          />
        )}

        <form className="new-ticket-form" id="new-ticket-form" onSubmit={handleTicketSubmit}>
          <div className="section-heading tight">
            <div>
              <span className="eyebrow">Quick Capture</span>
              <h2>{createTitle}</h2>
            </div>
          </div>
          <div className={moduleConfig ? '' : 'form-row'}>
            {!moduleConfig && (
              <label>
                Type
                <select value={ticketDraft.type} onChange={(event) => setTicketDraft({ ...ticketDraft, type: event.target.value })}>
                  {types.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Priority
              <select value={ticketDraft.priority} onChange={(event) => setTicketDraft({ ...ticketDraft, priority: event.target.value })}>
                {priorities.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Summary
            <input
              onChange={(event) => setTicketDraft({ ...ticketDraft, title: event.target.value })}
              placeholder="What needs attention?"
              value={ticketDraft.title}
            />
          </label>
          <label>
            Requester
            <input
              onChange={(event) => setTicketDraft({ ...ticketDraft, requester: event.target.value })}
              placeholder="Person or team"
              value={ticketDraft.requester}
            />
          </label>
          <div className="form-row">
            <label>
              Service
              <select value={ticketDraft.service} onChange={(event) => setTicketDraft({ ...ticketDraft, service: event.target.value })}>
                {['Collaboration', 'Identity', 'Hardware', 'Network Security', 'Wireless', 'Access'].map((service) => (
                  <option key={service}>{service}</option>
                ))}
              </select>
            </label>
            <label>
              Team
              <select value={ticketDraft.team} onChange={(event) => setTicketDraft({ ...ticketDraft, team: event.target.value })}>
                {teams.map((team) => (
                  <option key={team}>{team}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Description
            <textarea
              onChange={(event) => setTicketDraft({ ...ticketDraft, description: event.target.value })}
              placeholder="Impact, symptoms, desired outcome"
              value={ticketDraft.description}
            />
          </label>
          <button className="primary-action compact" type="submit">
            <Plus size={16} aria-hidden="true" />
            Quick create
          </button>
        </form>
      </aside>
    </div>
  )
}


function incidentPriority(impact, urgency) {
  const score = {
    High: 3,
    Medium: 2,
    Low: 1,
  }
  const total = (score[impact] || 2) + (score[urgency] || 2)
  if (impact === 'High' && urgency === 'High') return 'Critical'
  if (total >= 5) return 'High'
  if (total >= 4) return 'Medium'
  return 'Low'
}

function userInitials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function IncidentIntakeView({
  handleTicketSubmit,
  hasUnsavedChanges,
  setTicketDraft,
  ticketDraft,
}) {
  const [userQuery, setUserQuery] = useState('')
  const selectedUser = ticketDraft.requesterId
    ? demoUsers.find((user) => user.id === ticketDraft.requesterId)
    : null
  const normalizedQuery = userQuery.trim().toLowerCase()
  const userResults = normalizedQuery
    ? demoUsers
        .filter((user) =>
          [
            user.name,
            user.email,
            user.staffNumber,
            user.department,
            user.location,
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery),
        )
        .slice(0, 6)
    : []

  const selectUser = (user) => {
    setTicketDraft({
      ...ticketDraft,
      type: 'Incident',
      requesterId: user.id,
      requester: user.name,
      requesterEmail: user.email,
      requesterStaffNumber: user.staffNumber,
      requesterJobTitle: user.jobTitle,
      requesterDepartment: user.department,
      requesterLocation: user.location,
      requesterManager: user.manager,
    })
    setUserQuery('')
  }

  const clearUser = () => {
    setTicketDraft({
      ...ticketDraft,
      requesterId: '',
      requester: '',
      requesterEmail: '',
      requesterStaffNumber: '',
      requesterJobTitle: '',
      requesterDepartment: '',
      requesterLocation: '',
      requesterManager: '',
    })
    setUserQuery('')
  }

  const updateIncidentField = (field, value) => {
    const next = { ...ticketDraft, [field]: value }
    if (field === 'impact' || field === 'urgency') {
      next.priority = incidentPriority(
        field === 'impact' ? value : next.impact,
        field === 'urgency' ? value : next.urgency,
      )
    }
    if (field === 'service') {
      next.category = incidentServices.find((service) => service.name === value)?.categories[0] || ''
    }
    setTicketDraft(next)
  }

  const activeService =
    incidentServices.find((service) => service.name === ticketDraft.service) || incidentServices[0]

  return (
    <div className="new-record-page incident-intake-page">
      <section className="incident-intake-shell">
        <header className="incident-intake-header">
          <div>
            <span className="eyebrow">Create incident</span>
            <h2>New Incident</h2>
            <p>Identify the affected user, capture the issue, then submit it into the same workspace tab.</p>
          </div>
          {hasUnsavedChanges && <span className="draft-status">Unsaved changes</span>}
        </header>

        <ol className="incident-stepper" aria-label="Incident creation progress">
          <li className="complete">
            <span>1</span>
            <div>
              <strong>Find user</strong>
              <small>Name, email or staff number</small>
            </div>
          </li>
          <li className={selectedUser ? 'active' : ''}>
            <span>2</span>
            <div>
              <strong>Incident details</strong>
              <small>Impact and symptoms</small>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Submitted</strong>
              <small>Incident workspace</small>
            </div>
          </li>
        </ol>

        {!selectedUser ? (
          <section className="incident-stage-card user-lookup-stage">
            <div className="incident-stage-heading">
              <span className="stage-number">1</span>
              <div>
                <span className="eyebrow">Affected user</span>
                <h3>Who is experiencing the issue?</h3>
                <p>Search the people directory before recording any incident information.</p>
              </div>
            </div>

            <label className="incident-user-search">
              <Search size={20} aria-hidden="true" />
              <input
                autoFocus
                onChange={(event) => setUserQuery(event.target.value)}
                placeholder="Search name, email, staff number, department..."
                type="search"
                value={userQuery}
              />
            </label>

            {!normalizedQuery ? (
              <div className="incident-search-empty">
                <UserRound size={28} aria-hidden="true" />
                <strong>Start typing to find a user</strong>
                <span>Try “Eleanor”, “HC-10482” or an email address.</span>
              </div>
            ) : userResults.length ? (
              <div className="incident-user-results" aria-live="polite">
                {userResults.map((user) => (
                  <button key={user.id} onClick={() => selectUser(user)} type="button">
                    <span className="directory-avatar">{userInitials(user.name)}</span>
                    <span className="directory-primary">
                      <strong>{user.name}</strong>
                      <small>{user.email}</small>
                    </span>
                    <span className="directory-secondary">
                      <strong>{user.staffNumber}</strong>
                      <small>{user.jobTitle}</small>
                    </span>
                    <span className="directory-location">
                      <strong>{user.department}</strong>
                      <small>{user.location}</small>
                    </span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="incident-search-empty">
                <Search size={28} aria-hidden="true" />
                <strong>No matching users</strong>
                <span>Check the spelling, email address or staff number and try again.</span>
              </div>
            )}
          </section>
        ) : (
          <div className="incident-details-layout">
            <aside className="incident-requester-card">
              <div className="incident-stage-heading compact">
                <span className="stage-number complete">1</span>
                <div>
                  <span className="eyebrow">Affected user</span>
                  <h3>{selectedUser.name}</h3>
                </div>
              </div>

              <div className="requester-profile">
                <span className="directory-avatar large">{userInitials(selectedUser.name)}</span>
                <div>
                  <strong>{selectedUser.name}</strong>
                  <span>{selectedUser.jobTitle}</span>
                </div>
              </div>

              <dl className="requester-facts">
                <div><dt>Email</dt><dd>{selectedUser.email}</dd></div>
                <div><dt>Staff number</dt><dd>{selectedUser.staffNumber}</dd></div>
                <div><dt>Department</dt><dd>{selectedUser.department}</dd></div>
                <div><dt>Location</dt><dd>{selectedUser.location}</dd></div>
                <div><dt>Manager</dt><dd>{selectedUser.manager}</dd></div>
              </dl>

              <button className="secondary-action full-width" onClick={clearUser} type="button">
                Change user
              </button>
            </aside>

            <section className="incident-stage-card incident-form-stage">
              <div className="incident-stage-heading">
                <span className="stage-number">2</span>
                <div>
                  <span className="eyebrow">Incident information</span>
                  <h3>What is happening?</h3>
                  <p>Capture enough detail for triage without leaving this workspace.</p>
                </div>
              </div>

              <form className="new-record-form incident-form" onSubmit={handleTicketSubmit}>
                <label>
                  Short description
                  <input
                    autoFocus
                    onChange={(event) => updateIncidentField('title', event.target.value)}
                    placeholder="Briefly describe the issue"
                    value={ticketDraft.title}
                  />
                </label>

                <label>
                  Description
                  <textarea
                    onChange={(event) => updateIncidentField('description', event.target.value)}
                    placeholder="Symptoms, business impact, error messages and what the user was trying to do"
                    value={ticketDraft.description}
                  />
                </label>

                <div className="form-row">
                  <label>
                    Service
                    <select
                      onChange={(event) => updateIncidentField('service', event.target.value)}
                      value={ticketDraft.service}
                    >
                      {incidentServices.map((service) => (
                        <option key={service.name}>{service.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Category
                    <select
                      onChange={(event) => updateIncidentField('category', event.target.value)}
                      value={ticketDraft.category}
                    >
                      {activeService.categories.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="incident-priority-grid">
                  <label>
                    Impact
                    <select
                      onChange={(event) => updateIncidentField('impact', event.target.value)}
                      value={ticketDraft.impact}
                    >
                      {['High', 'Medium', 'Low'].map((value) => <option key={value}>{value}</option>)}
                    </select>
                  </label>
                  <label>
                    Urgency
                    <select
                      onChange={(event) => updateIncidentField('urgency', event.target.value)}
                      value={ticketDraft.urgency}
                    >
                      {['High', 'Medium', 'Low'].map((value) => <option key={value}>{value}</option>)}
                    </select>
                  </label>
                  <div className="calculated-priority" aria-live="polite">
                    <span>Calculated priority</span>
                    <strong className={`priority-text ${priorityClass(ticketDraft.priority)}`}>
                      {ticketDraft.priority}
                    </strong>
                  </div>
                </div>

                <div className="form-row">
                  <label>
                    Assignment group
                    <select
                      onChange={(event) => updateIncidentField('team', event.target.value)}
                      value={ticketDraft.team}
                    >
                      {teams.map((team) => <option key={team}>{team}</option>)}
                    </select>
                  </label>
                  <label>
                    Affected location
                    <input readOnly value={ticketDraft.requesterLocation || selectedUser.location} />
                  </label>
                </div>

                <div className="incident-submit-strip">
                  <div>
                    <span className="eyebrow">Next</span>
                    <strong>The tab will become the submitted incident.</strong>
                  </div>
                  <button className="primary-action" type="submit">
                    <Plus size={17} aria-hidden="true" />
                    Create Incident
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </section>
    </div>
  )
}



const serviceRequestCatalogTemplates = [
  {
    id: 'laptop-refresh',
    title: 'Laptop refresh',
    description: 'Replace an ageing or under-performing corporate laptop with the standard professional bundle.',
    service: 'Hardware',
    team: 'End User Compute',
    items: [
      { id: 'CAT-LAP-PRO-14', name: 'Lenovo ThinkPad T14 Gen 7', category: 'Laptop', quantity: 1, unitCost: 1249, options: ['Intel Core Ultra 7', '32 GB RAM', '1 TB SSD', '3-year onsite warranty'] },
      { id: 'CAT-DOCK-USBC', name: 'USB-C Performance Dock', category: 'Accessory', quantity: 1, unitCost: 189, options: ['135W power supply', 'Dual-display support'] },
    ],
    approvals: [
      { id: 'APPROVAL-1', label: 'Line manager approval', approver: 'Line manager', status: 'Pending', updated: 'Created with request' },
      { id: 'APPROVAL-2', label: 'Cost-centre approval', approver: 'Finance Operations', status: 'Pending', updated: 'Created with request' },
    ],
    tasks: [
      { id: 'TASK-1', title: 'Confirm stock and reserve device', team: 'End User Compute', assignee: 'Unassigned', autoAssignee: 'Noah Williams', status: 'Waiting', requiresApproval: true, dependsOn: [], due: 'Within 4 hr of approval', instructions: 'Confirm the approved configuration is available and reserve the serial number.' },
      { id: 'TASK-2', title: 'Build and secure laptop', team: 'End User Compute', assignee: 'Unassigned', status: 'Waiting', dependsOn: ['TASK-1'], due: '1 business day', instructions: 'Apply the corporate build, encryption, endpoint security and required applications.' },
      { id: 'TASK-3', title: 'Transfer profile and approved data', team: 'Service Desk', assignee: 'Unassigned', status: 'Waiting', dependsOn: ['TASK-2'], due: 'Before handover', instructions: 'Confirm cloud sync and transfer any approved local user data.' },
      { id: 'TASK-4', title: 'Arrange handover and collect old device', team: 'Service Desk', assignee: 'Unassigned', status: 'Waiting', dependsOn: ['TASK-3'], due: 'Required-by date', instructions: 'Arrange handover, verify identity, collect the replaced asset and update the asset record.' },
    ],
  },
  {
    id: 'new-starter-access',
    title: 'New starter access package',
    description: 'Provision the standard collaboration, VPN and shared-resource access required for a new employee.',
    service: 'Access',
    team: 'Service Desk',
    items: [
      { id: 'CAT-M365-E3', name: 'Microsoft 365 E3 licence', category: 'Software', quantity: 1, unitCost: 31, options: ['Monthly licence'] },
      { id: 'CAT-VPN-STD', name: 'Corporate VPN access', category: 'Access', quantity: 1, unitCost: 0, options: ['Standard employee profile'] },
      { id: 'CAT-SHARED-ACCESS', name: 'Department shared resources', category: 'Access', quantity: 1, unitCost: 0, options: ['Manager-approved standard groups'] },
    ],
    approvals: [
      { id: 'APPROVAL-1', label: 'Manager approval', approver: 'Line manager', status: 'Pending', updated: 'Created with request' },
    ],
    tasks: [
      { id: 'TASK-1', title: 'Create identity and licence', team: 'Identity', assignee: 'Unassigned', status: 'Waiting', requiresApproval: true, dependsOn: [], due: 'Within 4 hr of approval', instructions: 'Create the corporate identity and allocate the approved Microsoft 365 licence.' },
      { id: 'TASK-2', title: 'Provision shared-resource access', team: 'Service Desk', assignee: 'Unassigned', status: 'Waiting', dependsOn: ['TASK-1'], due: 'Before start date', instructions: 'Apply the approved department and project group memberships.' },
      { id: 'TASK-3', title: 'Assign VPN profile', team: 'Network', assignee: 'Unassigned', status: 'Waiting', dependsOn: ['TASK-2'], due: 'Before start date', instructions: 'Apply the standard VPN profile and confirm conditional-access prerequisites.' },
      { id: 'TASK-4', title: 'Validate starter access', team: 'Service Desk', assignee: 'Unassigned', status: 'Waiting', dependsOn: ['TASK-3'], due: 'Before start date', instructions: 'Validate the requested services and confirm the package is ready for the starter.' },
    ],
  },
  {
    id: 'software-access',
    title: 'Software access request',
    description: 'Request a standard licensed application for an existing employee.',
    service: 'Access',
    team: 'Service Desk',
    items: [
      { id: 'CAT-SOFTWARE-STD', name: 'Standard licensed application', category: 'Software', quantity: 1, unitCost: 24, options: ['Named-user licence', 'Standard support'] },
    ],
    approvals: [
      { id: 'APPROVAL-1', label: 'Manager approval', approver: 'Line manager', status: 'Pending', updated: 'Created with request' },
    ],
    tasks: [
      { id: 'TASK-1', title: 'Validate licence availability', team: 'Service Desk', assignee: 'Unassigned', status: 'Waiting', requiresApproval: true, dependsOn: [], due: 'Within 4 hr of approval', instructions: 'Confirm licence availability and validate the requested software is on the approved catalogue.' },
      { id: 'TASK-2', title: 'Assign licence and entitlement', team: 'Service Desk', assignee: 'Unassigned', status: 'Waiting', dependsOn: ['TASK-1'], due: '1 business day', instructions: 'Allocate the licence and apply the required entitlement group.' },
      { id: 'TASK-3', title: 'Confirm user access', team: 'Service Desk', assignee: 'Unassigned', status: 'Waiting', dependsOn: ['TASK-2'], due: 'Within SLA', instructions: 'Confirm the user can launch and authenticate to the requested application.' },
    ],
  },
  {
    id: 'shared-mailbox',
    title: 'Shared mailbox access',
    description: 'Add an employee to an existing shared mailbox with standard access permissions.',
    service: 'Collaboration',
    team: 'Service Desk',
    items: [
      { id: 'CAT-SHARED-MAILBOX', name: 'Shared mailbox access', category: 'Access', quantity: 1, unitCost: 0, options: ['Read and send-as access'] },
    ],
    approvals: [],
    tasks: [
      { id: 'TASK-1', title: 'Validate mailbox owner approval', team: 'Service Desk', assignee: 'Dana Sinclair', status: 'Ready', dependsOn: [], due: 'Within 2 hr', instructions: 'Confirm the request references the approved shared mailbox and owner.' },
      { id: 'TASK-2', title: 'Apply mailbox permissions', team: 'Collaboration', assignee: 'Unassigned', status: 'Waiting', dependsOn: ['TASK-1'], due: 'Within 4 hr', instructions: 'Apply the requested mailbox permissions and allow time for replication.' },
      { id: 'TASK-3', title: 'Validate access with requester', team: 'Service Desk', assignee: 'Unassigned', status: 'Waiting', dependsOn: ['TASK-2'], due: 'Within SLA', instructions: 'Confirm the mailbox is visible and the requested permissions are working.' },
    ],
  },
]

function ServiceRequestIntakeView({
  handleTicketSubmit,
  hasUnsavedChanges,
  setTicketDraft,
  ticketDraft,
}) {
  const [userQuery, setUserQuery] = useState('')
  const selectedUser = ticketDraft.requesterId
    ? demoUsers.find((user) => user.id === ticketDraft.requesterId)
    : null
  const selectedTemplate = serviceRequestCatalogTemplates.find((template) => template.id === ticketDraft.requestTemplateId)
  const normalizedQuery = userQuery.trim().toLowerCase()
  const userResults = normalizedQuery
    ? demoUsers.filter((user) => [user.name, user.email, user.staffNumber, user.department, user.location].join(' ').toLowerCase().includes(normalizedQuery)).slice(0, 6)
    : []

  const selectUser = (user) => {
    setTicketDraft({
      ...ticketDraft,
      type: 'Service Request',
      requesterId: user.id,
      requester: user.name,
      requesterEmail: user.email,
      requesterStaffNumber: user.staffNumber,
      requesterJobTitle: user.jobTitle,
      requesterDepartment: user.department,
      requesterLocation: user.location,
      requesterManager: user.manager,
    })
    setUserQuery('')
  }

  const clearUser = () => {
    setTicketDraft({
      ...ticketDraft,
      requesterId: '', requester: '', requesterEmail: '', requesterStaffNumber: '', requesterJobTitle: '', requesterDepartment: '', requesterLocation: '', requesterManager: '',
    })
  }

  const selectTemplate = (template) => {
    const approvals = template.approvals.map((approval) => ({
      ...approval,
      approver: approval.approver === 'Line manager' ? ticketDraft.requesterManager || 'Line manager' : approval.approver,
    }))
    setTicketDraft({
      ...ticketDraft,
      type: 'Service Request',
      requestTemplateId: template.id,
      title: template.title,
      service: template.service,
      team: template.team,
      priority: 'Medium',
      requestedItems: template.items.map((item) => ({ ...item })),
      requestApprovals: approvals,
      requestTasks: template.tasks.map((task) => ({ ...task })),
    })
  }

  const templateCost = selectedTemplate
    ? selectedTemplate.items.reduce((sum, item) => sum + Number(item.unitCost || 0) * Number(item.quantity || 1), 0)
    : 0

  return (
    <div className="new-record-page service-request-intake-page">
      <section className="service-request-intake-shell">
        <header className="incident-intake-header request-intake-header">
          <div><span className="eyebrow">Create request</span><h2>New Service Request</h2><p>Identify the requester, select a catalogue service, then capture the fulfilment information.</p></div>
          {hasUnsavedChanges && <span className="draft-status">Unsaved changes</span>}
        </header>

        <ol className="incident-stepper request-stepper" aria-label="Service request creation progress">
          <li className={selectedUser ? 'complete' : 'active'}><span>1</span><div><strong>Find requester</strong><small>Name, email or staff number</small></div></li>
          <li className={selectedUser && selectedTemplate ? 'complete' : selectedUser ? 'active' : ''}><span>2</span><div><strong>Choose service</strong><small>Catalogue item and cost</small></div></li>
          <li className={selectedUser && selectedTemplate ? 'active' : ''}><span>3</span><div><strong>Request details</strong><small>Submit into fulfilment</small></div></li>
        </ol>

        {!selectedUser ? (
          <section className="incident-stage-card user-lookup-stage">
            <div className="incident-stage-heading"><span className="stage-number">1</span><div><span className="eyebrow">Requester</span><h3>Who is this request for?</h3><p>Search the people directory before selecting the service.</p></div></div>
            <label className="incident-user-search"><Search size={20} /><input autoFocus onChange={(event) => setUserQuery(event.target.value)} placeholder="Search name, email, staff number, department..." type="search" value={userQuery} /></label>
            {!normalizedQuery ? (
              <div className="incident-search-empty"><UserRound size={28} /><strong>Start typing to find a user</strong><span>Try “Marcus”, “HC-10177” or an email address.</span></div>
            ) : userResults.length ? (
              <div className="incident-user-results">
                {userResults.map((user) => (
                  <button key={user.id} onClick={() => selectUser(user)} type="button"><span className="directory-avatar">{userInitials(user.name)}</span><span className="directory-primary"><strong>{user.name}</strong><small>{user.email}</small></span><span className="directory-secondary"><strong>{user.staffNumber}</strong><small>{user.jobTitle}</small></span><span className="directory-location"><strong>{user.department}</strong><small>{user.location}</small></span><ChevronRight size={18} /></button>
                ))}
              </div>
            ) : <div className="incident-search-empty"><Search size={28} /><strong>No matching users</strong><span>Check the spelling, email address or staff number.</span></div>}
          </section>
        ) : !selectedTemplate ? (
          <div className="request-catalogue-layout">
            <aside className="incident-requester-card request-intake-requester">
              <div className="requester-profile"><span className="directory-avatar large">{userInitials(selectedUser.name)}</span><div><strong>{selectedUser.name}</strong><span>{selectedUser.jobTitle}</span></div></div>
              <dl className="requester-facts"><div><dt>Email</dt><dd>{selectedUser.email}</dd></div><div><dt>Staff number</dt><dd>{selectedUser.staffNumber}</dd></div><div><dt>Department</dt><dd>{selectedUser.department}</dd></div><div><dt>Location</dt><dd>{selectedUser.location}</dd></div><div><dt>Manager</dt><dd>{selectedUser.manager}</dd></div></dl>
              <button className="secondary-action full-width" onClick={clearUser} type="button">Change requester</button>
            </aside>
            <section className="request-catalogue-stage">
              <div className="incident-stage-heading"><span className="stage-number">2</span><div><span className="eyebrow">Service catalogue</span><h3>What does {selectedUser.name.split(' ')[0]} need?</h3><p>Select a catalogue request. Costs and fulfilment workflow are captured with the request.</p></div></div>
              <div className="request-template-grid">
                {serviceRequestCatalogTemplates.map((template) => {
                  const cost = template.items.reduce((sum, item) => sum + Number(item.unitCost || 0) * Number(item.quantity || 1), 0)
                  return <button key={template.id} onClick={() => selectTemplate(template)} type="button"><span className="request-template-icon"><ListChecks size={19} /></span><span className="request-template-copy"><strong>{template.title}</strong><small>{template.description}</small><em>{template.items.length} item{template.items.length === 1 ? '' : 's'} · {template.tasks.length} workflow tasks</em></span><span className="request-template-cost">{formatRequestCost(cost)}<ChevronRight size={17} /></span></button>
                })}
              </div>
            </section>
          </div>
        ) : (
          <div className="request-details-layout">
            <aside className="request-selected-summary">
              <div className="requester-profile"><span className="directory-avatar large">{userInitials(selectedUser.name)}</span><div><strong>{selectedUser.name}</strong><span>{selectedUser.jobTitle}</span></div></div>
              <div className="request-selected-template"><span className="eyebrow">Selected service</span><strong>{selectedTemplate.title}</strong><small>{selectedTemplate.service} · {selectedTemplate.team}</small></div>
              <div className="request-selected-cost"><span>Cost snapshot</span><strong>{formatRequestCost(templateCost)}</strong><small>{selectedTemplate.items.length} requested item{selectedTemplate.items.length === 1 ? '' : 's'}</small></div>
              <button className="secondary-action full-width" onClick={() => setTicketDraft({ ...ticketDraft, requestTemplateId: '', requestedItems: [], requestApprovals: [], requestTasks: [], title: '' })} type="button">Change service</button>
            </aside>

            <section className="incident-stage-card request-form-stage">
              <div className="incident-stage-heading"><span className="stage-number">3</span><div><span className="eyebrow">Request information</span><h3>Complete the request</h3><p>This information and the current item prices will be stored with the submitted request.</p></div></div>
              <form className="new-record-form request-intake-form" onSubmit={handleTicketSubmit}>
                <label>Request summary<input onChange={(event) => setTicketDraft({ ...ticketDraft, title: event.target.value })} value={ticketDraft.title} /></label>
                <label>Business reason / additional information<textarea onChange={(event) => setTicketDraft({ ...ticketDraft, description: event.target.value })} placeholder="Explain why this service is needed and include any fulfilment detail" value={ticketDraft.description} /></label>
                <div className="form-row"><label>Cost centre<input onChange={(event) => setTicketDraft({ ...ticketDraft, requestCostCentre: event.target.value })} placeholder="e.g. FIN-4102" value={ticketDraft.requestCostCentre || ''} /></label><label>Required by<input onChange={(event) => setTicketDraft({ ...ticketDraft, requestRequiredBy: event.target.value })} placeholder="e.g. 04 Sep 2026" value={ticketDraft.requestRequiredBy || ''} /></label></div>
                <div className="request-intake-items"><span className="eyebrow">Requested items</span>{selectedTemplate.items.map((item) => <div key={item.id}><span><strong>{item.name}</strong><small>{item.options.join(' · ')}</small></span><strong>{formatRequestCost(item.unitCost * (item.quantity || 1))}</strong></div>)}</div>
                <div className="request-intake-workflow-summary"><div><span>Approvals</span><strong>{selectedTemplate.approvals.length || 'None'}</strong></div><div><span>Workflow tasks</span><strong>{selectedTemplate.tasks.length}</strong></div><div><span>Total cost</span><strong>{formatRequestCost(templateCost)}</strong></div></div>
                <div className="incident-submit-strip"><div><span className="eyebrow">Next</span><strong>The same tab becomes the submitted request.</strong></div><button className="primary-action" type="submit"><Plus size={17} />Submit Service Request</button></div>
              </form>
            </section>
          </div>
        )}
      </section>
    </div>
  )
}


function ProblemIntakeView({ handleTicketSubmit, hasUnsavedChanges, setTicketDraft, ticketDraft }) {
  return (
    <div className="problem-intake-page">
      <section className="problem-intake-panel">
        <header className="problem-intake-header">
          <div><span className="eyebrow">Problem Management</span><h2>New Problem</h2><p>Capture a recurring issue, its scope and the evidence needed to drive root-cause investigation.</p></div>
          {hasUnsavedChanges && <span className="draft-status">Unsaved changes</span>}
        </header>
        <form className="problem-intake-form" onSubmit={handleTicketSubmit}>
          <section className="problem-intake-section">
            <div className="problem-intake-section-title"><span>1</span><div><strong>Problem statement</strong><small>Describe the recurring pattern rather than a single user incident.</small></div></div>
            <label>Problem summary<input autoFocus onChange={(event) => setTicketDraft({ ...ticketDraft, title: event.target.value })} placeholder="e.g. Payroll SSO breaks after certificate rotations" value={ticketDraft.title} /></label>
            <label>Problem description<textarea onChange={(event) => setTicketDraft({ ...ticketDraft, description: event.target.value })} placeholder="Describe the recurring symptoms, pattern and business impact" value={ticketDraft.description} /></label>
            <div className="form-row"><label>Raised by<input onChange={(event) => setTicketDraft({ ...ticketDraft, requester: event.target.value })} placeholder="Team or person raising the problem" value={ticketDraft.requester} /></label><label>Impact scope<input onChange={(event) => setTicketDraft({ ...ticketDraft, problemImpactScope: event.target.value })} placeholder="Users, sites, services or versions affected" value={ticketDraft.problemImpactScope || ''} /></label></div>
          </section>

          <section className="problem-intake-section">
            <div className="problem-intake-section-title"><span>2</span><div><strong>Classification & ownership</strong><small>Set the service context and investigation owner.</small></div></div>
            <div className="problem-intake-grid three"><label>Priority<select onChange={(event) => setTicketDraft({ ...ticketDraft, priority: event.target.value })} value={ticketDraft.priority}>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label><label>Service<select onChange={(event) => setTicketDraft({ ...ticketDraft, service: event.target.value })} value={ticketDraft.service}>{['Collaboration', 'Identity', 'Hardware', 'Network Security', 'Wireless', 'Access', 'Print'].map((service) => <option key={service}>{service}</option>)}</select></label><label>Assignment group<select onChange={(event) => setTicketDraft({ ...ticketDraft, team: event.target.value })} value={ticketDraft.team}>{teams.map((team) => <option key={team}>{team}</option>)}</select></label></div>
            <label>Related incidents<input onChange={(event) => setTicketDraft({ ...ticketDraft, problemRelatedIncidentsText: event.target.value })} placeholder="INC-1032, INC-1044 (comma separated)" value={ticketDraft.problemRelatedIncidentsText || ''} /></label>
          </section>

          <section className="problem-intake-section">
            <div className="problem-intake-section-title"><span>3</span><div><strong>Investigation starting point</strong><small>Record the current theory and any safe workaround already known.</small></div></div>
            <label>Initial hypothesis<textarea onChange={(event) => setTicketDraft({ ...ticketDraft, problemHypothesis: event.target.value })} placeholder="What do we currently believe may be causing the pattern?" value={ticketDraft.problemHypothesis || ''} /></label>
            <label>Current workaround<textarea onChange={(event) => setTicketDraft({ ...ticketDraft, problemWorkaround: event.target.value })} placeholder="Optional: document a known safe mitigation" value={ticketDraft.problemWorkaround || ''} /></label>
          </section>

          <div className="problem-intake-submit"><div><span className="eyebrow">Create problem</span><strong>The same workspace tab becomes the submitted Problem record.</strong></div><button className="primary-action" type="submit"><Plus size={17} />Create Problem</button></div>
        </form>
      </section>
    </div>
  )
}

function ChangeIntakeView({ handleTicketSubmit, hasUnsavedChanges, setTicketDraft, ticketDraft }) {
  return (
    <div className="change-intake-page">
      <section className="change-intake-panel">
        <header className="change-intake-header">
          <div><span className="eyebrow">Change Management</span><h2>New Change</h2><p>Build the implementation, risk, schedule and recovery context before the change enters approval.</p></div>
          {hasUnsavedChanges && <span className="draft-status">Unsaved changes</span>}
        </header>
        <form className="change-intake-form" onSubmit={handleTicketSubmit}>
          <section className="change-intake-section">
            <div className="change-intake-section-title"><span>1</span><div><strong>Change overview</strong><small>Describe what is changing and why.</small></div></div>
            <label>Change summary<input autoFocus onChange={(event) => setTicketDraft({ ...ticketDraft, title: event.target.value })} placeholder="e.g. Upgrade perimeter firewall cluster" value={ticketDraft.title} /></label>
            <div className="change-intake-grid three"><label>Change type<select onChange={(event) => setTicketDraft({ ...ticketDraft, changeType: event.target.value })} value={ticketDraft.changeType || 'Normal'}><option>Standard</option><option>Normal</option><option>Emergency</option></select></label><label>Risk<select onChange={(event) => setTicketDraft({ ...ticketDraft, changeRisk: event.target.value, priority: event.target.value })} value={ticketDraft.changeRisk || 'Medium'}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label><label>Approval route<select onChange={(event) => setTicketDraft({ ...ticketDraft, changeApprovalRoute: event.target.value })} value={ticketDraft.changeApprovalRoute || 'CAB'}><option>CAB</option><option>Service owner</option><option>Security approval</option><option>Emergency CAB</option></select></label></div>
            <div className="form-row"><label>Requested by<input onChange={(event) => setTicketDraft({ ...ticketDraft, requester: event.target.value })} placeholder="Person or team requesting the change" value={ticketDraft.requester} /></label><label>Service<select onChange={(event) => setTicketDraft({ ...ticketDraft, service: event.target.value })} value={ticketDraft.service}>{['Collaboration', 'Identity', 'Hardware', 'Network Security', 'Wireless', 'Access'].map((service) => <option key={service}>{service}</option>)}</select></label></div>
            <div className="form-row"><label>Assignment group<select onChange={(event) => setTicketDraft({ ...ticketDraft, team: event.target.value })} value={ticketDraft.team}>{teams.map((team) => <option key={team}>{team}</option>)}</select></label><label>Affected CIs<input onChange={(event) => setTicketDraft({ ...ticketDraft, changeAffectedCisText: event.target.value })} placeholder="FW-EDGE-A, M365-TENANT" value={ticketDraft.changeAffectedCisText || ''} /></label></div>
            <label>Business reason<textarea onChange={(event) => setTicketDraft({ ...ticketDraft, changeBusinessReason: event.target.value, description: event.target.value })} placeholder="Why is the change required and what outcome should it deliver?" value={ticketDraft.changeBusinessReason || ''} /></label>
          </section>

          <section className="change-intake-section">
            <div className="change-intake-section-title"><span>2</span><div><strong>Implementation & recovery</strong><small>Plans should be detailed enough for another technician to execute safely.</small></div></div>
            <label>Implementation plan<textarea onChange={(event) => setTicketDraft({ ...ticketDraft, changeImplementationPlan: event.target.value })} placeholder="Ordered implementation steps" value={ticketDraft.changeImplementationPlan || ''} /></label>
            <div className="change-intake-plan-grid"><label>Test plan<textarea onChange={(event) => setTicketDraft({ ...ticketDraft, changeTestPlan: event.target.value })} placeholder="How success will be validated" value={ticketDraft.changeTestPlan || ''} /></label><label>Backout plan<textarea onChange={(event) => setTicketDraft({ ...ticketDraft, changeBackoutPlan: event.target.value })} placeholder="How the service will be restored if validation fails" value={ticketDraft.changeBackoutPlan || ''} /></label></div>
          </section>

          <section className="change-intake-section">
            <div className="change-intake-section-title"><span>3</span><div><strong>Schedule & customer impact</strong><small>Capture the proposed window; approval can adjust it later.</small></div></div>
            <div className="change-intake-grid three"><label>Planned start<input onChange={(event) => setTicketDraft({ ...ticketDraft, changePlannedStart: event.target.value })} placeholder="01 Sep 2026 · 22:00" value={ticketDraft.changePlannedStart || ''} /></label><label>Planned end<input onChange={(event) => setTicketDraft({ ...ticketDraft, changePlannedEnd: event.target.value })} placeholder="01 Sep 2026 · 23:00" value={ticketDraft.changePlannedEnd || ''} /></label><label>Expected impact<input onChange={(event) => setTicketDraft({ ...ticketDraft, changeDowntime: event.target.value })} placeholder="No outage expected" value={ticketDraft.changeDowntime || ''} /></label></div>
          </section>

          <div className="change-intake-submit"><div><span className="eyebrow">Create draft</span><strong>The change is created as Draft in this same workspace tab.</strong></div><button className="primary-action" type="submit"><Plus size={17} />Create Change</button></div>
        </form>
      </section>
    </div>
  )
}


function GenericNewRecordView({
  handleTicketSubmit,
  hasUnsavedChanges,
  recordType,
  setTicketDraft,
  ticketDraft,
}) {
  const title = {
    'Service Request': 'New Service Request',
    Problem: 'New Problem',
    Change: 'New Change',
  }[recordType] || 'New Record'

  return (
    <div className="new-record-page">
      <section className="new-record-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Create record</span>
            <h2>{title}</h2>
          </div>
          <div className="new-record-heading-status">
            {hasUnsavedChanges && <span className="draft-status">Unsaved changes</span>}
            <span className="type-chip">{recordType}</span>
          </div>
        </div>

        <form className="new-record-form" onSubmit={handleTicketSubmit}>
          <div className="form-row">
            <label>
              Priority
              <select
                value={ticketDraft.priority}
                onChange={(event) => setTicketDraft({ ...ticketDraft, priority: event.target.value })}
              >
                {priorities.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </label>
            <label>
              Requester
              <input
                onChange={(event) => setTicketDraft({ ...ticketDraft, requester: event.target.value })}
                placeholder="Person or team"
                value={ticketDraft.requester}
              />
            </label>
          </div>

          <label>
            Summary
            <input
              autoFocus
              onChange={(event) => setTicketDraft({ ...ticketDraft, title: event.target.value })}
              placeholder="What needs attention?"
              value={ticketDraft.title}
            />
          </label>

          <div className="form-row">
            <label>
              Service
              <select
                value={ticketDraft.service}
                onChange={(event) => setTicketDraft({ ...ticketDraft, service: event.target.value })}
              >
                {['Collaboration', 'Identity', 'Hardware', 'Network Security', 'Wireless', 'Access'].map((service) => (
                  <option key={service}>{service}</option>
                ))}
              </select>
            </label>
            <label>
              Team
              <select
                value={ticketDraft.team}
                onChange={(event) => setTicketDraft({ ...ticketDraft, team: event.target.value })}
              >
                {teams.map((team) => (
                  <option key={team}>{team}</option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Description
            <textarea
              onChange={(event) => setTicketDraft({ ...ticketDraft, description: event.target.value })}
              placeholder="Impact, symptoms, desired outcome"
              value={ticketDraft.description}
            />
          </label>

          <div className="new-record-actions">
            <button className="primary-action" type="submit">
              <Plus size={17} aria-hidden="true" />
              Create {recordType}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export function NewRecordView(props) {
  if (props.recordType === 'Incident') {
    return <IncidentIntakeView {...props} />
  }

  if (props.recordType === 'Service Request') {
    return <ServiceRequestIntakeView {...props} />
  }

  if (props.recordType === 'Problem') {
    return <ProblemIntakeView {...props} />
  }

  if (props.recordType === 'Change') {
    return <ChangeIntakeView {...props} />
  }

  return <GenericNewRecordView {...props} />
}

export function SelfServicePortal({
  currentUser,
  handlePortalSubmit,
  openPortalRequest,
  portalDraft,
  portalQuery,
  portalResults,
  serviceCatalog,
  setPortalDraft,
  setPortalQuery,
  tickets,
}) {
  const isRequester = currentUser?.role === 'requester' || currentUser?.profile === 'requester'
  const requesterName = isRequester ? currentUser.name : portalDraft.requester
  const requesterEmail = portalDraft.email || currentUser?.username || loginProfiles.requester.username
  const myRequests = tickets.filter((ticket) => ticket.requester === requesterName).slice(0, 3)
  const visibleRequests = myRequests.length ? myRequests : tickets.filter((ticket) => ticket.type === 'Service Request').slice(0, 3)

  return (
    <div className="portal-view">
      <section className="portal-hero">
        <div>
          <span className="eyebrow">Self-Service Portal</span>
          <h2>Get help, request access, and track IT work in one place.</h2>
        </div>
        <label className="portal-search">
          <Search size={19} aria-hidden="true" />
          <input
            onChange={(event) => setPortalQuery(event.target.value)}
            placeholder="Search help articles or services"
            type="search"
            value={portalQuery}
          />
        </label>
      </section>

      <section className="catalog-grid">
        {serviceCatalog.map(({ title, description, icon: Icon, accent }) => (
          <button
            className={`catalog-card ${accent}`}
            key={title}
            onClick={() => setPortalDraft({ ...portalDraft, category: title, title: title === 'Report an IT Issue' ? '' : title })}
            type="button"
          >
            <Icon size={22} aria-hidden="true" />
            <strong>{title}</strong>
            <span>{description}</span>
          </button>
        ))}
      </section>

      <div className="portal-columns">
        <form className="portal-form" onSubmit={handlePortalSubmit}>
          <div className="section-heading tight">
            <div>
              <span className="eyebrow">Raise a request</span>
              <h2>Tell IT what you need</h2>
            </div>
          </div>
          <div className="form-row">
            <label>
              Name
            <input
              onChange={(event) => setPortalDraft({ ...portalDraft, requester: event.target.value })}
              placeholder="Your name"
              value={portalDraft.requester || requesterName || ''}
            />
            </label>
            <label>
              Email
              <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setPortalDraft({ ...portalDraft, email: event.target.value })}
              placeholder="you@hi5central.com"
              type="text"
              value={requesterEmail}
            />
            </label>
          </div>
          <div className="form-row">
            <label>
              Category
              <select
                onChange={(event) => setPortalDraft({ ...portalDraft, category: event.target.value })}
                value={portalDraft.category}
              >
                {serviceCatalog.map((item) => (
                  <option key={item.title}>{item.title}</option>
                ))}
              </select>
            </label>
            <label>
              Urgency
              <select
                onChange={(event) => setPortalDraft({ ...portalDraft, urgency: event.target.value })}
                value={portalDraft.urgency}
              >
                {['High', 'Medium', 'Low'].map((urgency) => (
                  <option key={urgency}>{urgency}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Summary
            <input
              onChange={(event) => setPortalDraft({ ...portalDraft, title: event.target.value })}
              placeholder="Short summary"
              value={portalDraft.title}
            />
          </label>
          <label>
            Details
            <textarea
              onChange={(event) => setPortalDraft({ ...portalDraft, description: event.target.value })}
              placeholder="What is affected, who is impacted, and when did it start?"
              value={portalDraft.description}
            />
          </label>
          <button className="primary-action" type="submit">
            <Send size={17} aria-hidden="true" />
            Submit request
          </button>
        </form>

        <section className="portal-side">
          <div>
            <div className="section-heading tight">
              <div>
                <span className="eyebrow">Knowledge</span>
                <h2>Suggested Help</h2>
              </div>
            </div>
            <div className="article-list">
              {portalResults.slice(0, 3).map((article) => (
                <article className="article-row" key={article.title}>
                  <BookOpen size={17} aria-hidden="true" />
                  <div>
                    <strong>{article.title}</strong>
                    <span>{article.category} - {article.updated}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div>
            <div className="section-heading tight">
              <div>
                <span className="eyebrow">Tracking</span>
                <h2>Recent Requests</h2>
              </div>
            </div>
            <div className="mini-request-list">
              {visibleRequests.map((ticket) => (
                <button
                  className="mini-request mini-request-button"
                  key={ticket.id}
                  onClick={() => openPortalRequest?.(ticket)}
                  type="button"
                >
                  <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
                  <strong>{ticket.title}</strong>
                  <small>{ticket.id} - {ticket.updated}</small>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export function ChangesView({ openNewRecord, openRecordTab, tickets }) {
  const [query, setQuery] = useState('')
  const [quickView, setQuickView] = useState('all')
  const [sortKey, setSortKey] = useState('window')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [riskFilter, setRiskFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')

  const pendingApproval = tickets.filter((ticket) => ['Pending Approval', 'CAB Review'].includes(ticket.status)).length
  const scheduled = tickets.filter((ticket) => ticket.status === 'Scheduled').length
  const highRisk = tickets.filter((ticket) => ['High', 'Critical'].includes(ticket.risk)).length
  const implementing = tickets.filter((ticket) => ['Implementing', 'In Progress', 'Review'].includes(ticket.status)).length

  const quickViews = [
    ['all', 'All'],
    ['approval', 'Awaiting approval'],
    ['scheduled', 'Scheduled'],
    ['high-risk', 'High risk'],
    ['implementation', 'In progress'],
    ['closed', 'Closed'],
  ]

  const visible = tickets
    .filter((ticket) => {
      const needle = query.trim().toLowerCase()
      const matchesQuery = !needle || [ticket.id, ticket.title, ticket.service, ticket.assignee, ticket.window, ticket.requester].some((value) => String(value || '').toLowerCase().includes(needle))
      if (!matchesQuery) return false
      if (riskFilter !== 'All' && ticket.risk !== riskFilter) return false
      if (typeFilter !== 'All' && (ticket.changeType || 'Normal') !== typeFilter) return false
      if (quickView === 'approval') return ['Pending Approval', 'CAB Review'].includes(ticket.status)
      if (quickView === 'scheduled') return ticket.status === 'Scheduled'
      if (quickView === 'high-risk') return ['High', 'Critical'].includes(ticket.risk)
      if (quickView === 'implementation') return ['Implementing', 'In Progress', 'Review'].includes(ticket.status)
      if (quickView === 'closed') return ticket.status === 'Closed'
      return true
    })
    .sort((a, b) => {
      if (sortKey === 'risk') {
        const riskOrder = ['Critical', 'High', 'Medium', 'Low']
        return riskOrder.indexOf(a.risk || 'Medium') - riskOrder.indexOf(b.risk || 'Medium')
      }
      if (sortKey === 'status') return a.status.localeCompare(b.status)
      return b.id.localeCompare(a.id)
    })

  return (
    <div className="change-queue-v2">
      <header className="change-queue-header">
        <div><span className="eyebrow">Change Management</span><h2>Changes</h2><p>Assess risk, protect implementation windows and keep approvals visible before execution.</p></div>
        <button className="primary-action compact" onClick={() => openNewRecord('Change')} type="button"><Plus size={16} />New Change</button>
      </header>

      <div className="change-queue-metrics">
        <div><span>Awaiting approval</span><strong>{pendingApproval}</strong></div>
        <div><span>Scheduled</span><strong>{scheduled}</strong></div>
        <div><span>High risk</span><strong>{highRisk}</strong></div>
        <div><span>Implementing / review</span><strong>{implementing}</strong></div>
      </div>

      <div className="change-queue-toolbar">
        <label className="change-search"><Search size={18} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Search changes, services, owners..." type="search" value={query} /></label>
        <button className={filtersOpen || riskFilter !== 'All' || typeFilter !== 'All' ? 'change-filter-button active' : 'change-filter-button'} onClick={() => setFiltersOpen((current) => !current)} type="button"><SlidersHorizontal size={17} />Filters{(riskFilter !== 'All' || typeFilter !== 'All') && <span>{Number(riskFilter !== 'All') + Number(typeFilter !== 'All')}</span>}</button>
        <label className="change-sort">Sort<select onChange={(event) => setSortKey(event.target.value)} value={sortKey}><option value="window">Window</option><option value="risk">Risk</option><option value="status">Status</option></select></label>
      </div>

      {filtersOpen && <div className="change-filter-panel"><label>Risk<select onChange={(event) => setRiskFilter(event.target.value)} value={riskFilter}><option>All</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label><label>Change type<select onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}><option>All</option><option>Standard</option><option>Normal</option><option>Emergency</option></select></label><button className="text-button" onClick={() => { setRiskFilter('All'); setTypeFilter('All') }} type="button">Clear filters</button></div>}

      <div className="change-quick-views">{quickViews.map(([id, label]) => <button className={quickView === id ? 'active' : ''} key={id} onClick={() => setQuickView(id)} type="button">{label}</button>)}</div>
      <div className="change-queue-result-line"><strong>{visible.length} changes</strong><span>{quickViews.find(([id]) => id === quickView)?.[1]}</span></div>

      <div className="change-table-wrap"><table className="change-table"><thead><tr><th>Reference</th><th>Change</th><th>Type / risk</th><th>Status</th><th>Approval</th><th>Window</th><th>Owner</th><th>Affected CIs</th><th>Updated</th></tr></thead><tbody>{visible.map((ticket) => <tr key={ticket.id} onClick={() => openRecordTab(ticket)}><td><button onClick={(event) => { event.stopPropagation(); openRecordTab(ticket) }} type="button">{ticket.id}</button></td><td><strong>{ticket.title}</strong><small>{ticket.service}</small></td><td><span>{ticket.changeType || 'Normal'}</span><strong className={`change-risk-text ${String(ticket.risk || 'Medium').toLowerCase()}`}>{ticket.risk || 'Medium'}</strong></td><td><span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span></td><td>{ticket.approval || 'Not submitted'}</td><td><strong>{ticket.window || 'To be scheduled'}</strong><small>{ticket.downtime || ''}</small></td><td>{ticket.assignee}</td><td>{ticket.linkedAssets?.length || 0}</td><td>{ticket.updated}</td></tr>)}</tbody></table></div>

      <div className="change-mobile-list">{visible.map((ticket) => <button className="change-mobile-card" key={ticket.id} onClick={() => openRecordTab(ticket)} type="button"><div className="change-mobile-card-top"><strong>{ticket.id}</strong><span className={`change-risk-badge ${String(ticket.risk || 'Medium').toLowerCase()}`}>{ticket.risk || 'Medium'} risk</span></div><h3>{ticket.title}</h3><div className="change-mobile-state"><span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span><span>{ticket.changeType || 'Normal'} · {ticket.approval || 'Not submitted'}</span></div><div className="change-mobile-window"><CalendarClock size={15} /><span>{ticket.window || 'To be scheduled'}</span></div><div className="change-mobile-meta"><span>{ticket.service} · {ticket.assignee}</span><span>{ticket.linkedAssets?.length || 0} CIs</span></div><footer><span>Updated {ticket.updated}</span><ChevronRight size={17} /></footer></button>)}</div>
      {!visible.length && <div className="problem-empty-state queue">No changes match this view.</div>}
    </div>
  )
}

export function CmdbView({ assets, openAsset, tickets }) {
  return (
    <div className="cmdb-view">
      <section className="asset-grid">
        {assets.map((asset) => (
          <article className="asset-card" key={asset.name}>
            <div className="asset-icon">
              <Server size={22} aria-hidden="true" />
            </div>
            <div>
              <span className="eyebrow">{asset.className}</span>
              <h2>{asset.name}</h2>
            </div>
            <div className="asset-meta">
              <span>Owner: {asset.owner}</span>
              <span>Open incidents: {asset.incidents}</span>
            </div>
            <span className={`health-pill ${asset.health.toLowerCase().replace(/\s+/g, '-')}`}>{asset.health}</span>
            <div className="relationship-list">
              {asset.related.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <button className="text-button asset-open-button" onClick={() => openAsset(asset)} type="button">
              Open CI
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </article>
        ))}
      </section>

      <section className="operational-band">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Dependencies</span>
            <h2>Linked Records</h2>
          </div>
        </div>
        <div className="queue-table">
          {tickets.slice(0, 5).map((ticket) => (
            <div className="queue-row static" key={ticket.id}>
              <span className={`priority-dot ${priorityClass(ticket.priority)}`}></span>
              <span>
                <strong>{ticket.id}</strong>
                {ticket.title}
              </span>
              <span>{ticket.linkedAssets.join(', ') || 'No CI linked'}</span>
              <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}


export function CmdbRecordView({ asset, openRecordTab, tickets }) {
  const linkedTickets = tickets.filter((ticket) => ticket.linkedAssets?.includes(asset.name) || ticket.linkedAssets?.includes(asset.id))

  return (
    <div className="entity-detail-view">
      <section className="entity-detail-card">
        <div className="detail-header">
          <div>
            <span className="eyebrow">{asset.className}</span>
            <h2>{asset.name}</h2>
          </div>
          <span className={`health-pill ${asset.health.toLowerCase().replace(/\s+/g, '-')}`}>{asset.health}</span>
        </div>

        <div className="detail-grid">
          <InfoItem label="CI identifier" value={asset.id} icon={Server} />
          <InfoItem label="Owner" value={asset.owner} icon={Users} />
          <InfoItem label="Open incidents" value={asset.incidents} icon={AlertCircle} />
          <InfoItem label="Relationships" value={asset.related.length} icon={CircleGauge} />
        </div>

        <div className="record-context-block">
          <span className="eyebrow">Relationships</span>
          <div className="linked-ci-list">
            {asset.related.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="entity-related-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Operational context</span>
            <h2>Linked Records</h2>
          </div>
        </div>
        <div className="quick-record-list">
          {linkedTickets.length ? linkedTickets.map((ticket) => (
            <button key={ticket.id} onClick={() => openRecordTab(ticket)} type="button">
              <span>{ticket.id}</span>
              <strong>{ticket.title}</strong>
              <small>{ticket.status} - {ticket.team}</small>
            </button>
          )) : (
            <div className="empty-inline-state">No records are linked to this CI in the prototype data.</div>
          )}
        </div>
      </section>
    </div>
  )
}

export function KnowledgeArticleView({ article }) {
  return (
    <div className="knowledge-article-view">
      <article className="knowledge-article-card">
        <div className="knowledge-article-heading">
          <BookOpen size={24} aria-hidden="true" />
          <div>
            <span className="eyebrow">{article.category}</span>
            <h2>{article.title}</h2>
            <p>{article.updated} · {article.reads} reads</p>
          </div>
        </div>

        <p className="knowledge-summary">{article.summary}</p>

        <div className="article-steps">
          <span className="eyebrow">Guidance</span>
          <ol>
            {article.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </article>
    </div>
  )
}

export function KnowledgeView({ openArticle, portalQuery, portalResults, setPortalQuery }) {
  return (
    <div className="knowledge-view">
      <section className="portal-hero slim">
        <div>
          <span className="eyebrow">Knowledge Base</span>
          <h2>Reusable fixes, known errors, and standard request guidance.</h2>
        </div>
        <label className="portal-search">
          <Search size={19} aria-hidden="true" />
          <input
            onChange={(event) => setPortalQuery(event.target.value)}
            placeholder="Search the knowledge base"
            type="search"
            value={portalQuery}
          />
        </label>
      </section>
      <section className="knowledge-grid">
        {portalResults.map((article) => (
          <article className="knowledge-card" key={article.title}>
            <BookOpen size={20} aria-hidden="true" />
            <span className="eyebrow">{article.category}</span>
            <h2>{article.title}</h2>
            <p>{article.reads} reads - {article.updated}</p>
            <button className="text-button" onClick={() => openArticle(article)} type="button">
              Open article
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </article>
        ))}
      </section>
    </div>
  )
}

export function ReportsView({ metrics, tickets }) {
  const byType = metrics.typeCounts
  const resolution = {
    Met: tickets.filter((ticket) => ticket.sla === 'Met').length,
    Watch: tickets.filter((ticket) => ticket.slaPercent >= 60 && ticket.sla !== 'Met').length,
    Healthy: tickets.filter((ticket) => ticket.slaPercent < 60).length,
  }

  return (
    <div className="reports-view">
      <section className="report-band">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Performance</span>
            <h2>Service Management Snapshot</h2>
          </div>
        </div>
        <div className="metric-row">
          <MetricCard label="Total Records" value={tickets.length} detail="All active data" icon={ListChecks} tone="blue" />
          <MetricCard label="SLA Met" value={resolution.Met} detail="Resolved in target" icon={CheckCircle2} tone="blue" />
          <MetricCard label="Needs Review" value={resolution.Watch} detail="SLA pressure" icon={Clock3} tone="amber" />
        </div>
      </section>

      <section className="workload-panel wide">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Demand</span>
            <h2>Volume by Process</h2>
          </div>
        </div>
        <BarList data={byType} />
      </section>

      <section className="workload-panel wide">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Delivery</span>
            <h2>SLA Health</h2>
          </div>
        </div>
        <BarList data={resolution} palette="delivery" />
      </section>
    </div>
  )
}

export function SettingsView({
  accent,
  density,
  openSettingsSection,
  resolvedTheme,
  session,
  setAccent,
  setDensity,
  setSidebarMode,
  setTheme,
  settingsSection = 'appearance',
  sidebarMode,
  theme,
}) {
  const sections = [
    { id: 'appearance', label: 'Appearance' },
    { id: 'workspace', label: 'Workspace' },
    { id: 'profile', label: 'Profile' },
  ]

  return (
    <div className="settings-view settings-routed-view">
      <nav className="settings-subnav" aria-label="Settings sections">
        {sections.map((section) => (
          <button
            className={settingsSection === section.id ? 'active' : ''}
            key={section.id}
            onClick={() => openSettingsSection(section.id)}
            type="button"
          >
            {section.label}
          </button>
        ))}
      </nav>

      {settingsSection === 'appearance' && (
        <section className="settings-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Personalisation</span>
              <h2>Appearance</h2>
            </div>
            <Palette size={20} aria-hidden="true" />
          </div>

          <div className="setting-row">
            <div>
              <strong>Theme</strong>
              <span>Follow your device automatically, or force a light or dark workspace.</span>
              <small>Current appearance: {resolvedTheme}</small>
            </div>
            <div className="segmented-control three">
              <button className={theme === 'system' ? 'active' : ''} onClick={() => setTheme('system')} type="button">
                <Monitor size={15} aria-hidden="true" />
                System
              </button>
              <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')} type="button">
                <Sun size={15} aria-hidden="true" />
                Light
              </button>
              <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')} type="button">
                <Moon size={15} aria-hidden="true" />
                Dark
              </button>
            </div>
          </div>

          <div className="setting-row accent-setting-row">
            <div>
              <strong>Accent colour</strong>
              <span>Change highlights, active tabs, avatars, and primary workspace accents.</span>
            </div>
            <div className="accent-picker" role="group" aria-label="Accent colour">
              {accentOptions.map((option) => (
                <button
                  aria-label={`${option.label} accent`}
                  aria-pressed={accent === option.id}
                  className={accent === option.id ? 'accent-swatch active' : 'accent-swatch'}
                  key={option.id}
                  onClick={() => setAccent(option.id)}
                  style={{ '--swatch': option.value }}
                  title={option.label}
                  type="button"
                >
                  <span></span>
                  <small>{option.label}</small>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {settingsSection === 'workspace' && (
        <section className="settings-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Workspace</span>
              <h2>Layout & Density</h2>
            </div>
            <SlidersHorizontal size={20} aria-hidden="true" />
          </div>

          <div className="setting-row">
            <div>
              <strong>Sidebar</strong>
              <span>Choose the left navigation layout.</span>
            </div>
            <div className="segmented-control three">
              <button className={sidebarMode === 'expanded' ? 'active' : ''} onClick={() => setSidebarMode('expanded')} type="button">
                Expanded
              </button>
              <button className={sidebarMode === 'collapsed' ? 'active' : ''} onClick={() => setSidebarMode('collapsed')} type="button">
                Collapsed
              </button>
              <button className={sidebarMode === 'hidden' ? 'active' : ''} onClick={() => setSidebarMode('hidden')} type="button">
                Hidden
              </button>
            </div>
          </div>

          <div className="setting-row">
            <div>
              <strong>Density</strong>
              <span>Choose how much information is visible in each viewport.</span>
            </div>
            <div className="segmented-control">
              <button className={density === 'comfortable' ? 'active' : ''} onClick={() => setDensity('comfortable')} type="button">
                Comfortable
              </button>
              <button className={density === 'compact' ? 'active' : ''} onClick={() => setDensity('compact')} type="button">
                Compact
              </button>
            </div>
          </div>
        </section>
      )}

      {settingsSection === 'profile' && (
        <section className="settings-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Signed in</span>
              <h2>{session.name}</h2>
            </div>
            <span className="avatar-large">{session.initials}</span>
          </div>
          <div className="credential-readout">
            <span>{loginProfiles[session.profile].label}</span>
            <strong>{session.username}</strong>
            <small>Prototype authentication is backed by baked-in credentials only.</small>
          </div>
        </section>
      )}
    </div>
  )
}

function MetricCard({ label, value, detail, icon: Icon, tone }) {
  return (
    <article className={`metric-card ${tone}`}>
      <Icon size={21} aria-hidden="true" />
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        <small>{detail}</small>
      </div>
    </article>
  )
}

function FilterSelect({ label, options, value, onChange }) {
  return (
    <label>
      {label}
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

function InfoItem({ label, value, icon: Icon }) {
  return (
    <div className="info-item">
      <Icon size={17} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SlaBar({ value, label }) {
  return (
    <span className="sla-bar" aria-label={`SLA ${label}`}>
      <span style={{ width: `${Math.min(value, 100)}%` }}></span>
      <small>{label}</small>
    </span>
  )
}

function BarList({ data, palette = 'default' }) {
  const entries = Object.entries(data)
  const max = Math.max(...entries.map(([, value]) => value), 1)

  return (
    <div className={`bar-list ${palette}`}>
      {entries.map(([label, value]) => (
        <div className="bar-row" key={label}>
          <span>{label}</span>
          <div className="bar-track">
            <span style={{ width: `${(value / max) * 100}%` }}></span>
          </div>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  )
}
