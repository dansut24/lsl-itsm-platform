import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, Plus, Trash2, UsersRound } from 'lucide-react'
import './ServiceRequestFulfilmentBuilder.css'

const API_BASE = window.__HI5_API_BASE__

async function api(path) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include', cache: 'no-store' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Could not load fulfilment settings.')
  return payload
}

function createTask(index) {
  return {
    id: `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title: '',
    team: '',
    teamId: '',
    instructions: '',
    dependsOn: [],
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
    order: index,
  }))
}

export function ServiceRequestFulfilmentBuilder({ itemKey = '', production = false, value = [], onChange }) {
  const tasks = cleanTasks(value)
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(production)
  const [error, setError] = useState('')

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
          itemKey ? api(`/api/v1/catalogue/${encodeURIComponent(itemKey)}/fulfilment`) : Promise.resolve({ tasks: [] }),
        ])
        if (!active) return
        setTeams(options.teams || [])
        if (itemKey && Array.isArray(flow.tasks)) onChange(cleanTasks(flow.tasks))
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

  function updateTask(index, patch) {
    const next = tasks.map((task, taskIndex) => taskIndex === index ? { ...task, ...patch } : task)
    onChange(next)
  }

  function addTask() {
    onChange([...tasks, createTask(tasks.length)])
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

  return (
    <div className="catalogue-flow-builder">
      <div className="catalogue-flow-intro">
        <CheckCircle2 size={18} />
        <div><strong>Fulfilment tasks</strong><span>Tasks with no prerequisite start together. Waiting tasks become ready automatically when every selected earlier task is completed.</span></div>
      </div>

      {loading ? <div className="catalogue-flow-state"><Loader2 className="is-spinning" size={16} /> Loading teams and flow…</div> : null}
      {error ? <div className="catalogue-flow-state is-error">{error}</div> : null}

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
