import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  Clock3,
  FolderKanban,
  Link2,
  MessageSquareText,
  Plus,
  Search,
  Target,
  Users,
  X,
} from 'lucide-react'
import {
  projectHealthOptions,
  projectStatuses,
  projectTaskStatuses,
} from '../../data/workPlanningData.js'

const projectSections = [
  { id: 'overview', label: 'Overview', icon: CircleGauge },
  { id: 'board', label: 'Task board', icon: FolderKanban },
  { id: 'milestones', label: 'Milestones', icon: Target },
  { id: 'risks', label: 'Risks & issues', icon: AlertTriangle },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'activity', label: 'Activity', icon: MessageSquareText },
]

function slug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function formatDate(value) {
  if (!value) return 'Not scheduled'
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed)
}

function projectProgress(project) {
  const tasks = project.tasks || []
  if (!tasks.length) return 0
  return Math.round((tasks.filter((task) => task.status === 'Done').length / tasks.length) * 100)
}

function personById(people, id) {
  return people.find((person) => person.id === id)
}

function ProjectAvatar({ person, small = false }) {
  return (
    <span
      className={`project-avatar tone-${person?.tone || 'slate'} ${small ? 'small' : ''}`}
      title={person?.name || 'Unassigned'}
    >
      {person?.initials || '—'}
    </span>
  )
}

function ProjectState({ children, kind = 'status' }) {
  return <span className={`project-state ${kind}-${slug(children)}`}>{children}</span>
}

function ProjectCreatePanel({ onClose, onCreate, people, teams }) {
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    ownerId: people[0]?.id || '',
    team: teams[0]?.name || '',
    priority: 'Medium',
    startDate: '2026-09-01',
    targetDate: '2026-10-30',
  })

  const close = () => {
    const dirty = draft.name.trim() || draft.description.trim()
    if (dirty && !window.confirm('Discard this unsaved project?')) return
    onClose()
  }

  const submit = (event) => {
    event.preventDefault()
    if (!draft.name.trim()) return
    onCreate({ ...draft, name: draft.name.trim(), description: draft.description.trim() })
  }

  return (
    <>
      <button aria-label="Close new project" className="project-panel-backdrop" onClick={close} type="button" />
      <aside aria-label="Create project" className="project-create-panel">
        <header>
          <div><span className="eyebrow">Project Management</span><h2>Create project</h2></div>
          <button aria-label="Close" onClick={close} type="button"><X size={18} /></button>
        </header>
        <form onSubmit={submit}>
          <label>Project name<input autoFocus onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Service desk telephony replacement" value={draft.name} /></label>
          <label>Description<textarea onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Outcome, scope and business reason" rows="5" value={draft.description} /></label>
          <div className="project-form-grid">
            <label>Owner<select onChange={(event) => setDraft({ ...draft, ownerId: event.target.value })} value={draft.ownerId}>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
            <label>Team<select onChange={(event) => setDraft({ ...draft, team: event.target.value })} value={draft.team}>{teams.map((team) => <option key={team.id}>{team.name}</option>)}</select></label>
            <label>Priority<select onChange={(event) => setDraft({ ...draft, priority: event.target.value })} value={draft.priority}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label>
            <label>Start date<input onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} type="date" value={draft.startDate} /></label>
            <label>Target date<input onChange={(event) => setDraft({ ...draft, targetDate: event.target.value })} type="date" value={draft.targetDate} /></label>
          </div>
          <div className="project-panel-actions">
            <button onClick={close} type="button">Cancel</button>
            <button className="primary-action compact" disabled={!draft.name.trim()} type="submit"><Plus size={15} />Create project</button>
          </div>
        </form>
      </aside>
    </>
  )
}

function ProjectListView({ onCreateProject, onOpenProject, people, projects, teams }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const [health, setHealth] = useState('All')
  const [createOpen, setCreateOpen] = useState(false)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return projects.filter((project) => {
      const matchesQuery = !needle || [project.id, project.name, project.description, project.team]
        .join(' ')
        .toLowerCase()
        .includes(needle)
      return matchesQuery && (status === 'All' || project.status === status) && (health === 'All' || project.health === health)
    })
  }, [health, projects, query, status])

  const active = projects.filter((project) => !['Complete', 'Cancelled'].includes(project.status)).length
  const atRisk = projects.filter((project) => ['At Risk', 'Blocked'].includes(project.health)).length
  const openTasks = projects.reduce((total, project) => total + (project.tasks || []).filter((task) => task.status !== 'Done').length, 0)
  const milestones = projects.reduce((total, project) => total + (project.milestones || []).filter((milestone) => milestone.status !== 'Complete').length, 0)

  return (
    <div className="project-list-view">
      <header className="project-list-header">
        <div><span className="eyebrow">Planning & Delivery</span><h2>Projects</h2><p>Coordinate delivery work, milestones, risks and linked service-management records.</p></div>
        <button className="primary-action compact" onClick={() => setCreateOpen(true)} type="button"><Plus size={16} />New project</button>
      </header>

      <section className="project-kpi-strip" aria-label="Project summary">
        <article><span>Active projects</span><strong>{active}</strong><small>{projects.length} total</small></article>
        <article><span>At risk / blocked</span><strong>{atRisk}</strong><small>Needs attention</small></article>
        <article><span>Open tasks</span><strong>{openTasks}</strong><small>Across all projects</small></article>
        <article><span>Open milestones</span><strong>{milestones}</strong><small>Delivery checkpoints</small></article>
      </section>

      <section className="project-list-shell">
        <div className="project-list-toolbar">
          <label className="project-search"><Search size={17} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Search projects, teams or references" type="search" value={query} /></label>
          <label><span>Status</span><select onChange={(event) => setStatus(event.target.value)} value={status}><option>All</option>{projectStatuses.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Health</span><select onChange={(event) => setHealth(event.target.value)} value={health}><option>All</option>{projectHealthOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        <div className="project-result-line"><strong>{visible.length} project{visible.length === 1 ? '' : 's'}</strong><span>{status === 'All' && health === 'All' ? 'All delivery work' : 'Filtered view'}</span></div>

        <div className="project-table-wrap">
          <table className="project-table">
            <thead><tr><th>Project</th><th>Status</th><th>Health</th><th>Progress</th><th>Owner / team</th><th>Target</th><th>Open work</th><th></th></tr></thead>
            <tbody>{visible.map((project) => {
              const owner = personById(people, project.ownerId)
              const progress = projectProgress(project)
              const remaining = (project.tasks || []).filter((task) => task.status !== 'Done').length
              return (
                <tr key={project.id} onClick={() => onOpenProject(project)}>
                  <td><span>{project.id}</span><strong>{project.name}</strong><small>{project.description}</small></td>
                  <td><ProjectState>{project.status}</ProjectState></td>
                  <td><ProjectState kind="health">{project.health}</ProjectState></td>
                  <td><div className="project-progress-cell"><span><i style={{ width: `${progress}%` }} /></span><strong>{progress}%</strong></div></td>
                  <td><div className="project-owner-cell"><ProjectAvatar person={owner} small /><span><strong>{owner?.name || 'Unassigned'}</strong><small>{project.team}</small></span></div></td>
                  <td><strong>{formatDate(project.targetDate)}</strong><small>Updated {project.updated}</small></td>
                  <td><strong>{remaining} task{remaining === 1 ? '' : 's'}</strong><small>{(project.risks || []).filter((risk) => risk.status !== 'Closed').length} risks/issues</small></td>
                  <td><ChevronRight size={17} /></td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>

        <div className="project-mobile-list">{visible.map((project) => {
          const owner = personById(people, project.ownerId)
          const progress = projectProgress(project)
          return (
            <button className="project-mobile-card" key={project.id} onClick={() => onOpenProject(project)} type="button">
              <header><span>{project.id}</span><ProjectState kind="health">{project.health}</ProjectState></header>
              <h3>{project.name}</h3>
              <p>{project.description}</p>
              <div className="project-mobile-progress"><span><i style={{ width: `${progress}%` }} /></span><strong>{progress}%</strong></div>
              <footer><span><ProjectAvatar person={owner} small />{owner?.name}</span><span>{formatDate(project.targetDate)}<ChevronRight size={16} /></span></footer>
            </button>
          )
        })}</div>
        {!visible.length && <div className="project-empty-state"><FolderKanban size={26} /><strong>No projects match this view</strong><span>Adjust the search or clear one of the filters.</span></div>}
      </section>

      {createOpen && <ProjectCreatePanel onClose={() => setCreateOpen(false)} onCreate={onCreateProject} people={people} teams={teams} />}
    </div>
  )
}

function ProjectTaskComposer({ onAdd, onClose, people, project }) {
  const [draft, setDraft] = useState({
    title: '',
    status: 'To Do',
    priority: 'Medium',
    assigneeId: project.ownerId,
    dueDate: project.targetDate,
    plannedHours: 4,
    milestoneId: project.milestones?.[0]?.id || '',
  })

  const submit = (event) => {
    event.preventDefault()
    if (!draft.title.trim()) return
    onAdd({ ...draft, title: draft.title.trim(), plannedHours: Number(draft.plannedHours) || 0 })
  }

  return (
    <>
      <button aria-label="Close new task" className="project-panel-backdrop" onClick={onClose} type="button" />
      <aside aria-label="Add project task" className="project-create-panel project-task-panel">
        <header><div><span className="eyebrow">{project.id}</span><h2>Add task</h2></div><button aria-label="Close" onClick={onClose} type="button"><X size={18} /></button></header>
        <form onSubmit={submit}>
          <label>Task title<input autoFocus onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="What needs to be delivered?" value={draft.title} /></label>
          <div className="project-form-grid">
            <label>Status<select onChange={(event) => setDraft({ ...draft, status: event.target.value })} value={draft.status}>{projectTaskStatuses.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Priority<select onChange={(event) => setDraft({ ...draft, priority: event.target.value })} value={draft.priority}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label>
            <label>Assignee<select onChange={(event) => setDraft({ ...draft, assigneeId: event.target.value })} value={draft.assigneeId}>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
            <label>Due date<input onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} type="date" value={draft.dueDate} /></label>
            <label>Planned hours<input min="0" onChange={(event) => setDraft({ ...draft, plannedHours: event.target.value })} type="number" value={draft.plannedHours} /></label>
            <label>Milestone<select onChange={(event) => setDraft({ ...draft, milestoneId: event.target.value })} value={draft.milestoneId}><option value="">No milestone</option>{(project.milestones || []).map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.title}</option>)}</select></label>
          </div>
          <div className="project-panel-actions"><button onClick={onClose} type="button">Cancel</button><button className="primary-action compact" disabled={!draft.title.trim()} type="submit"><Plus size={15} />Add task</button></div>
        </form>
      </aside>
    </>
  )
}

function ProjectDetailView({ onOpenRecord, onUpdateProject, people, project, tickets }) {
  const [activeSection, setActiveSection] = useState('overview')
  const [taskComposerOpen, setTaskComposerOpen] = useState(false)
  const [activityNote, setActivityNote] = useState('')
  const progress = projectProgress(project)
  const owner = personById(people, project.ownerId)
  const sponsor = personById(people, project.sponsorId)
  const ticketById = new Map(tickets.map((ticket) => [ticket.id, ticket]))
  const openTasks = (project.tasks || []).filter((task) => task.status !== 'Done')
  const openRisks = (project.risks || []).filter((risk) => risk.status !== 'Closed')

  const addActivity = (action) => ({
    id: `ACT-${project.id}-${project.activity.length + 1}`,
    actor: 'Dana Sinclair',
    action,
    meta: 'Just now',
  })

  const updateTask = (taskId, updates) => {
    const task = project.tasks.find((item) => item.id === taskId)
    onUpdateProject(project.id, {
      tasks: project.tasks.map((item) => item.id === taskId ? { ...item, ...updates } : item),
      activity: [addActivity(`moved “${task?.title || taskId}” to ${updates.status || 'a new state'}`), ...project.activity],
    })
  }

  const addTask = (draft) => {
    const task = { ...draft, id: `${project.id}-TASK-${project.tasks.length + 1}` }
    onUpdateProject(project.id, {
      tasks: [...project.tasks, task],
      activity: [addActivity(`added project task “${task.title}”`), ...project.activity],
    })
    setTaskComposerOpen(false)
  }

  const updateMilestone = (milestoneId) => {
    const milestone = project.milestones.find((item) => item.id === milestoneId)
    const nextStatus = milestone.status === 'Complete' ? 'In Progress' : 'Complete'
    onUpdateProject(project.id, {
      milestones: project.milestones.map((item) => item.id === milestoneId ? { ...item, status: nextStatus } : item),
      activity: [addActivity(`${nextStatus === 'Complete' ? 'completed' : 'reopened'} milestone “${milestone.title}”`), ...project.activity],
    })
  }

  const closeRisk = (riskId) => {
    const risk = project.risks.find((item) => item.id === riskId)
    onUpdateProject(project.id, {
      risks: project.risks.map((item) => item.id === riskId ? { ...item, status: 'Closed' } : item),
      activity: [addActivity(`closed ${risk.kind.toLowerCase()} “${risk.title}”`), ...project.activity],
    })
  }

  const postActivity = () => {
    if (!activityNote.trim()) return
    onUpdateProject(project.id, {
      activity: [addActivity(activityNote.trim()), ...project.activity],
    })
    setActivityNote('')
  }

  const renderLinkedRecord = (recordId) => {
    const ticket = ticketById.get(recordId)
    return (
      <button disabled={!ticket} key={recordId} onClick={() => ticket && onOpenRecord(ticket)} type="button">
        <span>{recordId}</span><strong>{ticket?.title || 'Record unavailable'}</strong><small>{ticket ? `${ticket.type} · ${ticket.status}` : 'Not in prototype data'}</small><ChevronRight size={16} />
      </button>
    )
  }

  const overview = (
    <div className="project-overview-grid">
      <section className="project-detail-card project-summary-card">
        <div className="project-section-heading"><div><span className="eyebrow">Delivery summary</span><h3>Current position</h3></div><CircleGauge size={20} /></div>
        <p>{project.summary || project.description}</p>
        <div className="project-progress-large"><header><span>Overall progress</span><strong>{progress}%</strong></header><div><i style={{ width: `${progress}%` }} /></div><footer><span>{project.tasks.filter((task) => task.status === 'Done').length} completed</span><span>{openTasks.length} remaining</span></footer></div>
      </section>
      <section className="project-detail-card">
        <div className="project-section-heading"><div><span className="eyebrow">Ownership</span><h3>Project team</h3></div><Users size={20} /></div>
        <div className="project-property-list"><div><span>Owner</span><strong>{owner?.name || 'Unassigned'}</strong></div><div><span>Sponsor</span><strong>{sponsor?.name || 'Unassigned'}</strong></div><div><span>Delivery team</span><strong>{project.team}</strong></div><div><span>Priority</span><strong>{project.priority}</strong></div></div>
      </section>
      <section className="project-detail-card">
        <div className="project-section-heading"><div><span className="eyebrow">Schedule</span><h3>Key dates</h3></div><CalendarDays size={20} /></div>
        <div className="project-date-band"><div><span>Start</span><strong>{formatDate(project.startDate)}</strong></div><ChevronRight size={18} /><div><span>Target</span><strong>{formatDate(project.targetDate)}</strong></div></div>
        <div className="project-next-milestone"><span>Next milestone</span><strong>{project.milestones.find((milestone) => milestone.status !== 'Complete')?.title || 'All milestones complete'}</strong></div>
      </section>
      <section className="project-detail-card project-span-two">
        <div className="project-section-heading"><div><span className="eyebrow">Delivery plan</span><h3>Upcoming milestones</h3></div><button onClick={() => setActiveSection('milestones')} type="button">View all</button></div>
        <div className="project-milestone-compact">{project.milestones.slice(0, 4).map((milestone) => <article key={milestone.id}><span className={milestone.status === 'Complete' ? 'complete' : ''}>{milestone.status === 'Complete' ? <CheckCircle2 size={16} /> : <Target size={16} />}</span><div><strong>{milestone.title}</strong><small>{formatDate(milestone.dueDate)}</small></div><ProjectState>{milestone.status}</ProjectState></article>)}</div>
      </section>
      <section className="project-detail-card">
        <div className="project-section-heading"><div><span className="eyebrow">Attention</span><h3>Open risks & issues</h3></div><AlertTriangle size={20} /></div>
        <div className="project-risk-summary"><strong>{openRisks.length}</strong><span>open item{openRisks.length === 1 ? '' : 's'}</span><small>{openRisks.filter((risk) => ['High', 'Critical'].includes(risk.severity)).length} high/critical</small></div>
        <button className="project-card-link" onClick={() => setActiveSection('risks')} type="button">Review risks and issues<ChevronRight size={16} /></button>
      </section>
      <section className="project-detail-card project-span-two">
        <div className="project-section-heading"><div><span className="eyebrow">Service context</span><h3>Linked ITSM records</h3></div><Link2 size={20} /></div>
        <div className="project-linked-records">{project.linkedRecords.length ? project.linkedRecords.map(renderLinkedRecord) : <div className="project-inline-empty">No service-management records are linked.</div>}</div>
      </section>
    </div>
  )

  const board = (
    <div className="project-board-wrap">
      <div className="project-board-actions"><div><strong>{project.tasks.length} tasks</strong><span>{openTasks.length} open · {project.tasks.reduce((total, task) => total + (Number(task.plannedHours) || 0), 0)} planned hours</span></div><button className="primary-action compact" onClick={() => setTaskComposerOpen(true)} type="button"><Plus size={15} />Add task</button></div>
      <div className="project-board">{projectTaskStatuses.map((status) => {
        const tasks = project.tasks.filter((task) => task.status === status)
        return (
          <section className={`project-board-column status-${slug(status)}`} key={status}>
            <header><span>{status}</span><strong>{tasks.length}</strong></header>
            <div>{tasks.map((task) => {
              const assignee = personById(people, task.assigneeId)
              return (
                <article className="project-task-card" key={task.id}>
                  <div className="project-task-top"><span>{task.id}</span><em className={`priority-${slug(task.priority)}`}>{task.priority}</em></div>
                  <h4>{task.title}</h4>
                  {task.linkedRecord && <button onClick={() => ticketById.get(task.linkedRecord) && onOpenRecord(ticketById.get(task.linkedRecord))} type="button"><Link2 size={12} />{task.linkedRecord}</button>}
                  <div className="project-task-meta"><span><ProjectAvatar person={assignee} small />{assignee?.name || 'Unassigned'}</span><span><Clock3 size={13} />{task.plannedHours || 0}h</span></div>
                  <div className="project-task-due"><span>Due {formatDate(task.dueDate)}</span><select aria-label={`Move ${task.title}`} onChange={(event) => updateTask(task.id, { status: event.target.value })} value={task.status}>{projectTaskStatuses.map((item) => <option key={item}>{item}</option>)}</select></div>
                </article>
              )
            })}{!tasks.length && <div className="project-column-empty">No tasks</div>}</div>
          </section>
        )
      })}</div>
    </div>
  )

  const milestones = (
    <div className="project-milestone-view">
      <header><div><span className="eyebrow">Delivery checkpoints</span><h3>Milestones</h3><p>Track significant outcomes against the project target.</p></div><strong>{project.milestones.filter((item) => item.status === 'Complete').length}/{project.milestones.length} complete</strong></header>
      <div className="project-milestone-list">{project.milestones.map((milestone, index) => {
        const tasks = project.tasks.filter((task) => task.milestoneId === milestone.id)
        const done = tasks.filter((task) => task.status === 'Done').length
        return <article key={milestone.id}><div className={`project-milestone-marker ${milestone.status === 'Complete' ? 'complete' : ''}`}>{milestone.status === 'Complete' ? <CheckCircle2 size={18} /> : index + 1}</div><div><span>{milestone.id}</span><h4>{milestone.title}</h4><p>{done}/{tasks.length} linked tasks complete</p></div><div><strong>{formatDate(milestone.dueDate)}</strong><ProjectState>{milestone.status}</ProjectState></div><button onClick={() => updateMilestone(milestone.id)} type="button">{milestone.status === 'Complete' ? 'Reopen' : 'Complete'}</button></article>
      })}</div>
    </div>
  )

  const risks = (
    <div className="project-risk-view">
      <header><div><span className="eyebrow">Project assurance</span><h3>Risks & issues</h3><p>Keep threats, active delivery problems and their responses visible.</p></div><div><strong>{openRisks.length}</strong><span>open</span></div></header>
      <div className="project-risk-list">{project.risks.map((risk) => {
        const riskOwner = personById(people, risk.ownerId)
        return <article className={risk.status === 'Closed' ? 'closed' : ''} key={risk.id}><div className={`project-risk-icon severity-${slug(risk.severity)}`}><AlertTriangle size={18} /></div><div><span>{risk.kind} · {risk.id}</span><h4>{risk.title}</h4><p>{risk.response}</p><small><ProjectAvatar person={riskOwner} small />Owned by {riskOwner?.name || 'Unassigned'}</small></div><div><ProjectState>{risk.severity}</ProjectState><ProjectState>{risk.status}</ProjectState>{risk.status !== 'Closed' && <button onClick={() => closeRisk(risk.id)} type="button">Close item</button>}</div></article>
      })}{!project.risks.length && <div className="project-empty-state"><CheckCircle2 size={26} /><strong>No risks or issues recorded</strong><span>This project currently has a clear delivery path.</span></div>}</div>
    </div>
  )

  const team = (
    <div className="project-team-view">
      <header><div><span className="eyebrow">Delivery team</span><h3>Members & planned work</h3><p>Project workload now uses the shared people model that will also drive Rota and My Work.</p></div><strong>{project.memberIds.length} members</strong></header>
      <div className="project-team-grid">{project.memberIds.map((memberId) => {
        const person = personById(people, memberId)
        const assigned = project.tasks.filter((task) => task.assigneeId === memberId)
        const remainingHours = assigned.filter((task) => task.status !== 'Done').reduce((total, task) => total + (Number(task.plannedHours) || 0), 0)
        return <article key={memberId}><ProjectAvatar person={person} /><div><h4>{person?.name}</h4><span>{person?.role}</span><small>{person?.team} · {person?.location}</small></div><div><strong>{remainingHours}h</strong><span>remaining</span><small>{assigned.filter((task) => task.status !== 'Done').length} open tasks</small></div></article>
      })}</div>
    </div>
  )

  const activity = (
    <div className="project-activity-view">
      <section className="project-activity-composer"><div><span className="eyebrow">Project journal</span><strong>Add update</strong></div><textarea onChange={(event) => setActivityNote(event.target.value)} placeholder="Record a decision, status update, handover or delivery note" value={activityNote} /><footer><span>Visible to the project team</span><button className="primary-action compact" disabled={!activityNote.trim()} onClick={postActivity} type="button">Add update</button></footer></section>
      <section className="project-activity-list">{project.activity.map((item) => <article key={item.id}><span className="project-activity-dot" /><div><header><strong>{item.actor}</strong><span>{item.meta}</span></header><p>{item.action}</p></div></article>)}</section>
    </div>
  )

  const panels = { overview, board, milestones, risks, team, activity }

  return (
    <div className="project-detail-view">
      <header className="project-detail-header">
        <div className="project-detail-title"><span className="eyebrow">{project.id}</span><h2>{project.name}</h2><p>{project.description}</p><div><ProjectState>{project.status}</ProjectState><ProjectState kind="health">{project.health}</ProjectState><span>{project.priority} priority</span><span>{project.team}</span></div></div>
        <div className="project-detail-controls"><label>Status<select onChange={(event) => onUpdateProject(project.id, { status: event.target.value })} value={project.status}>{projectStatuses.map((item) => <option key={item}>{item}</option>)}</select></label><label>Health<select onChange={(event) => onUpdateProject(project.id, { health: event.target.value })} value={project.health}>{projectHealthOptions.map((item) => <option key={item}>{item}</option>)}</select></label></div>
      </header>
      <section className="project-detail-summary"><div><span>Progress</span><strong>{progress}%</strong></div><div><span>Open tasks</span><strong>{openTasks.length}</strong></div><div><span>Open risks/issues</span><strong>{openRisks.length}</strong></div><div><span>Target date</span><strong>{formatDate(project.targetDate)}</strong></div><div className="project-detail-members"><span>Project team</span><strong>{project.memberIds.slice(0, 4).map((id) => <ProjectAvatar key={id} person={personById(people, id)} small />)}{project.memberIds.length > 4 && <em>+{project.memberIds.length - 4}</em>}</strong></div></section>
      <nav aria-label="Project sections" className="project-detail-tabs">{projectSections.map(({ id, label, icon: Icon }) => <button aria-current={activeSection === id ? 'page' : undefined} className={activeSection === id ? 'active' : ''} key={id} onClick={() => setActiveSection(id)} type="button"><Icon size={15} />{label}</button>)}</nav>
      <main className="project-detail-panel">{panels[activeSection]}</main>
      {taskComposerOpen && <ProjectTaskComposer onAdd={addTask} onClose={() => setTaskComposerOpen(false)} people={people} project={project} />}
    </div>
  )
}

export function ProjectManagementView({
  onCreateProject,
  onOpenProject,
  onOpenRecord,
  onUpdateProject,
  people,
  projects,
  selectedProject,
  teams,
  tickets,
}) {
  if (selectedProject) {
    return <ProjectDetailView onOpenRecord={onOpenRecord} onUpdateProject={onUpdateProject} people={people} project={selectedProject} tickets={tickets} />
  }

  return <ProjectListView onCreateProject={onCreateProject} onOpenProject={onOpenProject} people={people} projects={projects} teams={teams} />
}
