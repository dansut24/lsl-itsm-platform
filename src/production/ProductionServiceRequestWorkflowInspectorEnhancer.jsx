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

function element(tag, className = '', value = '') {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (value !== '') node.textContent = value
  return node
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
  return {
    dependencies: dependencies.map((id) => taskById.get(id)?.title || id).filter(Boolean),
    instructions: text(task.instructions),
    completionNotes: text(task.completionNotes),
  }
}

function workflowSignature(tasks) {
  return tasks.map((task) => [
    task.id,
    task.title,
    task.status,
    task.team,
    task.assignee,
    (task.dependencies || []).join(','),
    task.instructions,
    task.completionNotes,
  ].join('|')).join('::')
}

function buildEnhancement(detail) {
  const tasks = Array.isArray(detail.requestTasks) ? detail.requestTasks : []
  const wrapper = element('section', 'service-request-workflow-enhancement')
  wrapper.dataset.hi5WorkflowEnhancement = 'true'
  wrapper.dataset.workflowSignature = workflowSignature(tasks)

  const completed = tasks.filter((task) => task.status === 'Completed').length
  const active = tasks.find((task) => ['Ready', 'In Progress', 'Blocked'].includes(task.status))
  const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0

  const header = element('div', 'service-request-workflow-summary')
  const headerCopy = element('div')
  headerCopy.append(
    element('span', '', 'Task workflow'),
    element('strong', '', `${completed} of ${tasks.length} completed`),
    element('small', '', active ? `Current: ${active.title}` : (tasks.length ? 'All workflow tasks completed' : 'No fulfilment workflow')),
  )
  header.append(headerCopy, element('b', '', `${percent}%`))
  wrapper.appendChild(header)

  const progress = element('div', 'service-request-workflow-progress')
  progress.setAttribute('aria-label', `${percent}% of fulfilment tasks completed`)
  const progressValue = element('i')
  progressValue.style.width = `${percent}%`
  progress.appendChild(progressValue)
  wrapper.appendChild(progress)

  if (!tasks.length) return wrapper

  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const list = element('div', 'service-request-workflow-steps')

  tasks.forEach((task, index) => {
    const meta = taskMeta(task, taskById)
    const item = element('article', `service-request-workflow-step is-${statusClass(task.status)}`)
    const copy = element('div', 'service-request-workflow-step-copy')
    const title = element('div', 'service-request-workflow-step-title')
    title.append(
      element('strong', '', text(task.title)),
      element('span', `is-${statusClass(task.status)}`, text(task.status)),
    )

    const dependencyText = meta.dependencies.length
      ? `After ${meta.dependencies.join(', ')}`
      : 'No prerequisite task'
    const routing = [task.team || 'Unassigned team', task.assignee || 'Unassigned'].filter(Boolean).join(' · ')

    copy.append(title, element('small', '', routing), element('small', '', dependencyText))
    if (meta.instructions) copy.appendChild(element('p', '', meta.instructions))
    if (meta.completionNotes) copy.appendChild(element('em', '', `Completion: ${meta.completionNotes}`))
    item.append(element('div', 'service-request-workflow-step-index', String(index + 1)), copy)
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
    let timer = null
    const taskRefreshTimers = new Set()
    let lastReference = ''
    let lastTarget = null
    let forceReload = false

    async function render() {
      if (disposed || !inspectorIsTasks()) return
      const reference = routeReference()
      const target = taskListTarget()
      if (!reference || !target) return

      const existing = target.parentElement?.querySelector('[data-hi5-workflow-enhancement="true"]')
      if (!forceReload && reference === lastReference && target === lastTarget && existing) return

      forceReload = false
      lastReference = reference
      lastTarget = target

      try {
        const payload = await requestDetail(reference)
        if (disposed || reference !== routeReference() || !inspectorIsTasks()) return
        const latestTarget = taskListTarget()
        if (!latestTarget) return
        const next = buildEnhancement(payload)
        const current = latestTarget.parentElement?.querySelector('[data-hi5-workflow-enhancement="true"]')
        if (current?.dataset.workflowSignature === next.dataset.workflowSignature) return
        current?.remove()
        latestTarget.before(next)
      } catch {
        // The existing task inspector remains fully functional if enrichment cannot load.
      }
    }

    function schedule({ reload = false, delay = 60 } = {}) {
      if (reload) forceReload = true
      window.clearTimeout(timer)
      timer = window.setTimeout(() => { void render() }, delay)
    }

    function scheduleTaskRefresh(delay) {
      const refreshTimer = window.setTimeout(() => {
        taskRefreshTimers.delete(refreshTimer)
        schedule({ reload: true })
      }, delay)
      taskRefreshTimers.add(refreshTimer)
    }

    const observer = new MutationObserver(() => schedule())
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    const onRoute = () => {
      lastReference = ''
      lastTarget = null
      schedule({ reload: true })
    }
    const onChange = (event) => {
      if (event.target instanceof HTMLSelectElement && event.target.closest('.service-request-task-list')) {
        scheduleTaskRefresh(350)
        scheduleTaskRefresh(1400)
      }
    }

    window.addEventListener('popstate', onRoute)
    window.addEventListener('hi5-routechange', onRoute)
    document.addEventListener('change', onChange)
    schedule({ reload: true })

    return () => {
      disposed = true
      window.clearTimeout(timer)
      taskRefreshTimers.forEach((refreshTimer) => window.clearTimeout(refreshTimer))
      taskRefreshTimers.clear()
      observer.disconnect()
      window.removeEventListener('popstate', onRoute)
      window.removeEventListener('hi5-routechange', onRoute)
      document.removeEventListener('change', onChange)
      document.querySelectorAll('[data-hi5-workflow-enhancement="true"]').forEach((node) => node.remove())
    }
  }, [])

  return null
}
