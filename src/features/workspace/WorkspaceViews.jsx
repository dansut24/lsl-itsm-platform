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
import { accentOptions, loginProfiles, priorities, statusOptions, teams, types } from '../../data/demoData.jsx'
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
  selectedTicket,
  setNewComment,
  updateTicket,
}) {
  if (!selectedTicket) {
    return (
      <div className="record-page">
        <section className="record-primary empty-record">
          <span className="eyebrow">Record not found</span>
          <h2>This incident is no longer available</h2>
          <p>The ticket may have been closed or removed from the current workspace data.</p>
        </section>
      </div>
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

        <div className="record-context-block">
          <span className="eyebrow">Requester Location</span>
          <strong>{selectedTicket.location}</strong>
        </div>
      </aside>
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


export function NewRecordView({
  handleTicketSubmit,
  hasUnsavedChanges,
  recordType,
  setTicketDraft,
  ticketDraft,
}) {
  const title = {
    Incident: 'New Incident',
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

export function ChangesView({ approveChange, openNewRecord, openRecordTab, tickets }) {
  return (
    <div className="changes-view">
      <div className="changes-toolbar">
        <div>
          <span className="eyebrow">Change Management</span>
          <h2>Planned Changes</h2>
        </div>
        <button className="primary-action compact" onClick={() => openNewRecord('Change')} type="button">
          <Plus size={16} aria-hidden="true" />
          New Change
        </button>
      </div>
      {tickets.map((ticket) => (
        <article className="change-card" key={ticket.id}>
          <div className="change-main">
            <span className={`priority-label ${priorityClass(ticket.priority)}`}>{ticket.priority} risk</span>
            <h2>{ticket.title}</h2>
            <p>{ticket.description}</p>
            <div className="change-details">
              <InfoItem label="Owner" value={ticket.assignee} icon={UserRound} />
              <InfoItem label="Window" value={ticket.window || 'To be scheduled'} icon={CalendarClock} />
              <InfoItem label="Approval" value={ticket.approval || ticket.status} icon={ClipboardCheck} />
            </div>
          </div>
          <div className="approval-panel">
            <button className="change-record-link" onClick={() => openRecordTab(ticket)} type="button">
              {ticket.id}
            </button>
            <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
            <button onClick={() => approveChange(ticket, 'Approved')} type="button">
              <CheckCircle2 size={16} aria-hidden="true" />
              Approve
            </button>
            <button onClick={() => approveChange(ticket, 'Rejected')} type="button">
              <AlertCircle size={16} aria-hidden="true" />
              Reject
            </button>
          </div>
        </article>
      ))}
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
