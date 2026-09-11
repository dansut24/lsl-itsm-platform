import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, ChevronDown, Loader2, Plus, Trash2, UsersRound } from 'lucide-react'
import './ServiceRequestFulfilmentBuilder.css'

const API_BASE = window.__HI5_API_BASE__
const AUTO_DATE = '__auto__'
const NO_DATE = '__none__'

async function api(path) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include', cache: 'no-store' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Could not load fulfilment settings.')
  return payload
}

function createTask(index, titleDateFieldId = AUTO_DATE) {
  return {
    id: `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title: '',
    team: '',
    teamId: '',
    instructions: '',
    dependsOn: [],
    titleDateFieldId,
    order: index,
  }
}

function cleanTasks(value) {
  return (Array.isArray(value) ? value : []).map((task, index) => ({
    id: task?.id || `task-${index + 1}`,
    title: task?.title || '',
    team: task?.team || '',
    teamId: task?.teamId || '',
    instructions: task?.instructions || '',
    dependsOn: Array.isArray(task?.dependsOn) ? task.dependsOn : [],
    titleDateFieldId: task?.titleDateFieldId || AUTO_DATE,
    order: index,
  }))
}

function buildStages(tasks) {
  const stageById = new Map()
  const stages = []

  tasks.forEach((task, index) => {
    const prerequisiteStages = task.dependsOn
      .map((dependency) => stageById.get(dependency))
      .filter((stage) => Number.isInteger(stage))
    const stageNumber = prerequisiteStages.length ? Math.max(...prerequisiteStages) + 1 : 1
    stageById.set(task.id, stageNumber)
    const stageIndex = stageNumber - 1
    if (!stages[stageIndex]) stages[stageIndex] = []
    stages[stageIndex].push({ ...task, taskNumber: index + 1 })
  })

  return stages.filter(Boolean)
}

export function ServiceRequestFulfilmentBuilder({ itemKey = '', production = false, value = [], onChange, formSchema = [] }) {
  const tasks = cleanTasks(value)
  const [teams, setTeams] = useState([])
  const [remoteDateFields, setRemoteDateFields] = useState([])
  const [loading, setLoading] = useState(production)
  const [error, setError] = useState('')
  const [titleDateFieldId, setTitleDateFieldId] = useState(() => tasks[0]?.titleDateFieldId || AUTO_DATE)

  useEffect(() => {
    if (!production) {
      setLoading(false)
      return undefined
    }
    let active = true
    setLoading(true)
    setError('')

    async function hydrate() {
      try {
        const [options, flow] = await Promise.all([
          api('/api/v1/catalogue/fulfilment-options'),
          itemKey ? api(`/api/v1/catalogue/${encodeURIComponent(itemKey)}/fulfilment`) : Promise.resolve({ tasks: [], dateFields: [] }),
        ])
        if (!active) return
        setTeams(options.teams || [])
        setRemoteDateFields(Array.isArray(flow.dateFields) ? flow.dateFields : [])
        if (itemKey && Array.isArray(flow.tasks)) {
          const hydrated = cleanTasks(flow.tasks)
          setTitleDateFieldId(hydrated[0]?.titleDateFieldId || AUTO_DATE)
          onChange(hydrated)
        }
      } catch (loadError) {
        if (active) setError(loadError.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    hydrate()
    return () => { active = false }
  }, [itemKey, production])

  const taskNames = useMemo(() => new Map(tasks.map((task, index) => [task.id, task.title || `Task ${index + 1}`])), [tasks])
  const stages = useMemo(() => buildStages(tasks), [tasks])
  const dateFields = useMemo(() => {
    const local = (Array.isArray(formSchema) ? formSchema : [])
      .filter((field) => ['date', 'datetime-local'].includes(field?.type) && field?.id)
      .map((field) => ({ id: field.id, label: field.label || field.id, type: field.type }))
    return local.length ? local : remoteDateFields
  }, [formSchema, remoteDateFields])
  const selectedDateField = useMemo(() => {
    if (titleDateFieldId === NO_DATE) return null
    if (titleDateFieldId === AUTO_DATE) return dateFields.length === 1 ? dateFields[0] : null
    return dateFields.find((field) => field.id === titleDateFieldId) || null
  }, [dateFields, titleDateFieldId])
  const missingTeamCount = tasks.filter((task) => !task.teamId && !task.team).length
  const dateNeedsChoice = titleDateFieldId === AUTO_DATE && dateFields.length > 1

  function updateTask(index, patch) {
    const next = tasks.map((task, taskIndex) => taskIndex === index ? { ...task, ...patch } : task)
    onChange(next)
  }

  function addTask() {
    onChange([...tasks, createTask(tasks.length, titleDateFieldId)])
  }

  function removeTask(index) {
    const removedId = tasks[index]?.id
    onChange(tasks
      .filter((_, taskIndex) => taskIndex !== index)
      .map((task, order) => ({ ...task, order, dependsOn: task.dependsOn.filter((dependency) => dependency !== removedId) })))
  }

  function toggleDependency(index, dependencyId) {
    const current = tasks[index]
    const selected = current.dependsOn.includes(dependencyId)
    updateTask(index, {
      dependsOn: selected
        ? current.dependsOn.filter((dependency) => dependency !== dependencyId)
        : [...current.dependsOn, dependencyId],
    })
  }

  function chooseTeam(index, teamId) {
    const team = teams.find((candidate) => candidate.id === teamId)
    updateTask(index, { teamId, team: team?.name || '' })
  }

  function chooseTitleDate(nextValue) {
    setTitleDateFieldId(nextValue)
    onChange(tasks.map((task) => ({ ...task, titleDateFieldId: nextValue })))
  }

  function previewTitle(task) {
    const base = task.title || `Task ${task.taskNumber}`
    return selectedDateField ? `${base} · [${selectedDateField.label || 'request date'}]` : base
  }

  return (
    <div className="catalogue-flow-builder">
      <div className="catalogue-flow-intro">
        <CheckCircle2 size={18} />
        <div><strong>Fulfilment tasks</strong><span>Keep it simple: choose what each team does and which earlier work must finish first. Hi5Central unlocks the next stage automatically.</span></div>
      </div>

      {loading ? <div className="catalogue-flow-state"><Loader2 className="is-spinning" size={16} /> Loading teams and flow…</div> : null}
      {error ? <div className="catalogue-flow-state is-error">{error}</div> : null}

      {dateFields.length ? (
        <div className="catalogue-flow-date-setting">
          <CalendarDays size={18} />
          <div><strong>Task title date</strong><span>Add the request's important date to every generated task so queues stay immediately understandable.</span></div>
          <label>
            <span>Date</span>
            <select value={titleDateFieldId} onChange={(event) => chooseTitleDate(event.target.value)}>
              <option value={AUTO_DATE}>{dateFields.length === 1 ? `Automatic · ${dateFields[0].label}` : 'Automatic when there is one date field'}</option>
              {dateFields.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}
              <option value={NO_DATE}>Do not add a date</option>
            </select>
          </label>
        </div>
      ) : null}

      {dateNeedsChoice ? <div className="catalogue-flow-hint is-warning">This request has more than one date field. Choose which date should appear in task titles.</div> : null}

      {tasks.length ? (
        <section className="catalogue-flow-preview" aria-label="Flow at a glance">
          <header>
            <div><span>Flow at a glance</span><strong>{stages.length} {stages.length === 1 ? 'stage' : 'stages'} · {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}</strong></div>
            {missingTeamCount ? <small>{missingTeamCount} {missingTeamCount === 1 ? 'task needs' : 'tasks need'} a team</small> : <small className="is-ready">Ready to save</small>}
          </header>
          <div className="catalogue-flow-stages">
            {stages.map((stage, stageIndex) => (
              <div className="catalogue-flow-stage-wrap" key={`stage-${stageIndex + 1}`}>
                {stageIndex > 0 ? <div className="catalogue-flow-stage-arrow"><ChevronDown size={16} /></div> : null}
                <div className="catalogue-flow-stage">
                  <div className="catalogue-flow-stage-heading"><strong>Stage {stageIndex + 1}</strong><span>{stage.length > 1 ? `${stage.length} tasks run together` : stageIndex === 0 ? 'Starts immediately' : 'Starts when prerequisites finish'}</span></div>
                  <div className="catalogue-flow-stage-tasks">
                    {stage.map((task) => (
                      <div className="catalogue-flow-stage-task" key={task.id}>
                        <span>{task.taskNumber}</span>
                        <div><strong>{previewTitle(task)}</strong><small className={!task.team ? 'is-warning' : ''}>{task.team || 'Choose a team'}</small></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="catalogue-flow-list">
        {tasks.map((task, index) => {
          const earlierTasks = tasks.slice(0, index)
          const waitsForTasks = task.dependsOn.length > 0
          return (
            <article className="catalogue-flow-task" key={task.id}>
              <header>
                <span className="catalogue-flow-number">{index + 1}</span>
                <label className="catalogue-flow-title"><span>Task</span><input placeholder="What needs to be done?" value={task.title} onChange={(event) => updateTask(index, { title: event.target.value })} /></label>
                <button aria-label={`Remove task ${index + 1}`} className="catalogue-flow-remove" onClick={() => removeTask(index)} type="button"><Trash2 size={16} /></button>
              </header>

              <div className="catalogue-flow-row">
                <label><span>Assign to team</span><select value={task.teamId || ''} onChange={(event) => chooseTeam(index, event.target.value)}><option value="">Unassigned</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
                <label><span>Starts</span><select disabled={!earlierTasks.length} value={waitsForTasks ? 'after' : 'now'} onChange={(event) => updateTask(index, { dependsOn: event.target.value === 'now' ? [] : task.dependsOn.length ? task.dependsOn : [earlierTasks[earlierTasks.length - 1].id] })}><option value="now">Immediately</option>{earlierTasks.length ? <option value="after">After earlier task(s)</option> : null}</select></label>
              </div>

              {waitsForTasks && earlierTasks.length ? (
                <div className="catalogue-flow-dependencies">
                  <span>Wait for</span>
                  <div>{earlierTasks.map((earlier, earlierIndex) => <label key={earlier.id}><input checked={task.dependsOn.includes(earlier.id)} onChange={() => toggleDependency(index, earlier.id)} type="checkbox" /><span>{taskNames.get(earlier.id) || `Task ${earlierIndex + 1}`}</span></label>)}</div>
                </div>
              ) : null}

              <label className="catalogue-flow-instructions"><span>Instructions <small>optional</small></span><textarea rows="2" placeholder="Short fulfilment notes for the team" value={task.instructions || ''} onChange={(event) => updateTask(index, { instructions: event.target.value })} /></label>
            </article>
          )
        })}
      </div>

      {!tasks.length ? <div className="catalogue-flow-empty"><UsersRound size={20} /><span>No task flow yet. Add the first task and choose who should receive it.</span></div> : null}
      <button className="catalogue-flow-add" onClick={addTask} type="button"><Plus size={16} /> Add task</button>
    </div>
  )
}
