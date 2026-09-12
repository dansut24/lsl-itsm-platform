import { useEffect } from 'react'
import './ProductionServiceRequestWorkflowInspectorEnhancer.css'

const API_BASE = window.__HI5_API_BASE__

function routeReference() {
  const match = window.location.pathname.match(/^\/requests\/([^/]+)\/?$/i)
  if (!match || match[1].toLowerCase() === 'new') return ''
  return decodeURIComponent(match[1])
}

function text(value) {
  return String(value ?? '').trim()
}

function statusClass(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

async function requestDetail(reference) {
  const response = await fetch(`${API_BASE}/api/v1/service-requests/${encodeURIComponent(reference)}`, {
    credentials: 'include',
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Could not load fulfilment workflow.')
  return payload
}

function taskMeta(task, taskById) {
  const dependencies = Array.isArray(task.dependencies) ? task.dependencies : []
  const dependencyLabels = dependencies.map((id) => taskById.get(id)?.title || id).filter(Boolean)
  return {
    dependencies: dependencyLabels,
    instructions: text(task.instructions),
    completionNotes: text(task.completionNotes),
  }
}

function buildEnhancement(detail) {
  const tasks = Array.isArray(detail.requestTasks) ? detail.requestTasks : []
  const wrapper = document.createElement('section')
  wrapper.className = 'service-request-workflow-enhancement'
  wrapper.dataset.hi5WorkflowEnhancement = 'true'

  const completed = tasks.filter((task) => task.status === 'Completed').length
  const active = tasks.find((task) => ['Ready', 'In Progress', 'Blocked'].includes(task.status))
  const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0

  const header = document.createElement('div')
  header.className = 'service-request-workflow-summary'
  header.innerHTML = `
    <div>
      <span>Task workflow</span>
      <strong>${completed} of ${tasks.length} completed</strong>
      <small>${active ? `Current: ${active.title}` : (tasks.length ? 'All workflow tasks completed' : 'No fulfilment workflow')}</small>
    </div>
    <b>${percent}%</b>
  `
  wrapper.appendChild(header)

  const progress = document.createElement('div')
  progress.className = 'service-request-workflow-progress'
  progress.setAttribute('aria-label', `${percent}% of fulfilment tasks completed`)
  progress.innerHTML = `<i style="width:${percent}%"></i>`
  wrapper.appendChild(progress)

  if (!tasks.length) return wrapper

  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const list = document.createElement('div')
  list.className = 'service-request-workflow-steps'

  tasks.forEach((task, index) => {
    const meta = taskMeta(task, taskById)
    const item = document.createElement('article')
    item.className = `service-request-workflow-step is-${statusClass(task.status)}`

    const dependencyText = meta.dependencies.length
      ? `After ${meta.dependencies.join(', ')}`
      : 'No prerequisite task'
    const routing = [task.team || 'Unassigned team', task.assignee || 'Unassigned'].filter(Boolean).join(' · ')

    item.innerHTML = `
      <div class="service-request-workflow-step-index">${index + 1}</div>
      <div class="service-request-workflow-step-copy">
        <div class="service-request-workflow-step-title">
          <strong>${text(task.title)}</strong>
          <span class="is-${statusClass(task.status)}">${text(task.status)}</span>
        </div>
        <small>${routing}</small>
        <small>${dependencyText}</small>
        ${meta.instructions ? `<p>${meta.instructions}</p>` : ''}
        ${meta.completionNotes ? `<em>Completion: ${meta.completionNotes}</em>` : ''}
      </div>
    `
    list.appendChild(item)
  })

  wrapper.appendChild(list)
  return wrapper
}

function inspectorIsTasks() {
  const inspector = document.querySelector('.activity-canvas-inspector')
  const heading = inspector?.querySelector(':scope > header h2')
  return text(heading?.textContent).toLowerCase() === 'tasks'
}

function taskListTarget() {
  return document.querySelector('.activity-canvas-inspector-scroll .service-request-task-list')
}

export function ProductionServiceRequestWorkflowInspectorEnhancer() {
  useEffect(() => {
    let disposed = false
    let currentReference = ''
    let cached = null
    let loading = null

    async function detail(reference) {
      if (cached && currentReference === reference) return cached
      if (loading && currentReference === reference) return loading
      currentReference = reference
      loading = requestDetail(reference)
        .then((payload) => {
          if (currentReference === reference) cached = payload
          return payload
        })
        .finally(() => { loading = null })
      return loading
    }

    async function render() {
      if (disposed) return
      const reference = routeReference()
      if (!reference || !inspectorIsTasks()) return
      const target = taskListTarget()
      if (!target) return
      target.parentElement?.querySelector('[data-hi5-workflow-enhancement="true"]')?.remove()
      try {
        const payload = await detail(reference)
        if (disposed || reference !== routeReference() || !inspectorIsTasks()) return
        const latestTarget = taskListTarget()
        if (!latestTarget) return
        latestTarget.parentElement?.querySelector('[data-hi5-workflow-enhancement="true"]')?.remove()
        latestTarget.before(buildEnhancement(payload))
      } catch {
        // The existing task inspector remains fully functional if enrichment cannot load.
      }
    }

    const observer = new MutationObserver(() => { void render() })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    const onRoute = () => {
      currentReference = ''
      cached = null
      void render()
    }
    window.addEventListener('popstate', onRoute)
    window.addEventListener('hi5-routechange', onRoute)
    void render()

    return () => {
      disposed = true
      observer.disconnect()
      window.removeEventListener('popstate', onRoute)
      window.removeEventListener('hi5-routechange', onRoute)
      document.querySelectorAll('[data-hi5-workflow-enhancement="true"]').forEach((node) => node.remove())
    }
  }, [])

  return null
}
