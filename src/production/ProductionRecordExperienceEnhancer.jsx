import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowUpRight, X } from 'lucide-react'

const PEOPLE_KEY = 'hi5central-organisation-people-v1'
const ARRIVAL_KEY = 'hi5central-onboarding-arrival-v1'

function routeContext() {
  const match = window.location.pathname.match(/^\/(incidents|requests|problems|changes)\/([^/]+)\/?$/i)
  if (!match || match[2].toLowerCase() === 'new') return null
  const section = match[1].toLowerCase()
  const labels = { incidents: 'Incidents', requests: 'Service Requests', problems: 'Problems', changes: 'Changes' }
  return { section, label: labels[section], reference: decodeURIComponent(match[2]).toUpperCase() }
}

function readPeople() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PEOPLE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function navigate(path) {
  if (!path) return
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.dispatchEvent(new CustomEvent('hi5-routechange'))
}

function normaliseText(value = '') { return String(value).replace(/\s+/g, ' ').trim() }

function personPreview(name, email = '') {
  const people = readPeople()
  const person = people.find((item) => {
    const sameEmail = email && String(item.email || '').toLowerCase() === email.toLowerCase()
    const sameName = name && String(item.name || '').toLowerCase() === name.toLowerCase()
    return sameEmail || sameName
  })
  const resolved = person || { name, email }
  return {
    kind: 'Person',
    title: resolved.name || name || 'Requester',
    subtitle: resolved.email || email || 'No email recorded',
    fields: [
      ['Job title', resolved.jobTitle || resolved.title || 'Not recorded'],
      ['Department', resolved.department || 'Not recorded'],
      ['Site', resolved.site || resolved.location || 'Not recorded'],
      ['Manager', resolved.manager || 'Not recorded'],
    ],
    openLabel: 'Open People',
    openPath: '/people',
  }
}

function genericPreview(kind, title, subtitle = '', fields = [], openPath = '') {
  return { kind, title, subtitle, fields, openPath, openLabel: openPath ? 'Open in tab' : '' }
}

function previewForElement(element) {
  if (!(element instanceof HTMLElement)) return null

  const ribbon = element.closest('.activity-canvas-ribbon > span')
  if (ribbon) {
    const label = normaliseText(ribbon.querySelector('b')?.textContent || '')
    const raw = normaliseText(ribbon.textContent || '')
    const value = normaliseText(raw.slice(label.length))
    if (label === 'Requester') return personPreview(value)
    if (label === 'Assignment') {
      const [team, assignee] = value.split('/').map((part) => part.trim())
      return genericPreview('Assignment', assignee || team || 'Unassigned', team ? `Assignment group: ${team}` : '', [['Assignee', assignee || 'Unassigned'], ['Team', team || 'Unassigned']])
    }
    if (label === 'Service') return genericPreview('Service', value || 'Not recorded', 'Record service context', [['Service', value || 'Not recorded']])
    if (label === 'Category') return genericPreview('Category', value || 'Not recorded', 'Record classification', [['Category', value || 'Not recorded']])
    if (label === 'Priority') return genericPreview('Priority', value || 'Not recorded', 'Current record priority', [['Priority', value || 'Not recorded']])
    if (label === 'SLA') return genericPreview('SLA', value || 'Not recorded', 'Current service level state', [['State', value || 'Not recorded']])
    if (label === 'Items') return genericPreview('Requested items', value || '0', 'Catalogue fulfilment', [['Items', value || '0']])
    if (label === 'Cost') return genericPreview('Request cost', value || 'Not recorded', 'Submitted cost snapshot', [['Cost', value || 'Not recorded']])
  }

  const task = element.closest('.service-request-task')
  if (task && !element.closest('select,button,input,textarea,a')) {
    const title = normaliseText(task.querySelector('strong')?.textContent || 'Task')
    const meta = normaliseText(task.querySelector('small')?.textContent || '')
    const status = task.querySelector('select')?.value || 'Not recorded'
    return genericPreview('Task', title, meta, [['Status', status], ['Context', meta || 'Not recorded']])
  }

  const approval = element.closest('.service-request-approval')
  if (approval && !element.closest('button,select,input,textarea,a')) {
    const title = normaliseText(approval.querySelector('strong')?.textContent || 'Approval')
    const meta = normaliseText(approval.querySelector('small')?.textContent || '')
    return genericPreview('Approval', title, meta, [['Status', meta || 'Not recorded']])
  }

  const item = element.closest('.service-request-item')
  if (item && !element.closest('button,select,input,textarea,a')) {
    const title = normaliseText(item.querySelector('strong')?.textContent || 'Catalogue item')
    const meta = normaliseText(item.querySelector('small')?.textContent || '')
    const price = normaliseText(item.querySelector('b')?.textContent || '')
    return genericPreview('Catalogue item', title, meta, [['Details', meta || 'Not recorded'], ['Price', price || 'Not recorded']])
  }

  const related = element.closest('.activity-canvas-mini-list > div')
  if (related && !element.closest('button,a,input,select,textarea')) {
    const reference = normaliseText(related.querySelector('strong')?.textContent || '')
    const meta = normaliseText(related.querySelector('small')?.textContent || '')
    const prefix = reference.startsWith('INC-') ? 'incidents' : reference.startsWith('REQ-') ? 'requests' : reference.startsWith('PRB-') ? 'problems' : reference.startsWith('CHG-') ? 'changes' : 'tickets'
    return genericPreview('Related record', reference || 'Record', meta, [['Relationship', meta || 'Related record']], reference ? `/${prefix}/${encodeURIComponent(reference)}` : '')
  }

  const requesterCard = element.closest('.service-request-inspector-card')
  if (requesterCard && /requester/i.test(requesterCard.querySelector('span')?.textContent || '')) {
    return personPreview(normaliseText(requesterCard.querySelector('strong')?.textContent || ''), normaliseText(requesterCard.querySelector('small')?.textContent || ''))
  }

  return null
}

function QuickPreview({ preview, onClose }) {
  if (!preview) return null
  return createPortal(<>
    <button className="production-preview-backdrop" type="button" aria-label="Close preview" onClick={onClose} />
    <section className="production-quick-preview" role="dialog" aria-modal="true" aria-label={`${preview.kind} preview`}>
      <header>
        <div className="production-quick-preview-heading"><span>{preview.kind}</span><strong>{preview.title}</strong>{preview.subtitle ? <small>{preview.subtitle}</small> : null}</div>
        <button className="production-quick-preview-close" type="button" aria-label="Close preview" onClick={onClose}><X size={17} /></button>
      </header>
      <div className="production-quick-preview-body">
        <div className="production-quick-preview-card"><strong>{preview.title}</strong>{preview.subtitle ? <small>{preview.subtitle}</small> : null}</div>
        {preview.fields?.length ? <div className="production-quick-preview-meta">{preview.fields.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value || 'Not recorded'}</strong></div>)}</div> : null}
      </div>
      <footer>
        <button type="button" onClick={onClose}>Close</button>
        {preview.openPath ? <button type="button" className="is-primary" onClick={() => { onClose(); navigate(preview.openPath) }}>{preview.openLabel || 'Open in tab'} <ArrowUpRight size={14} /></button> : null}
      </footer>
    </section>
  </>, document.body)
}

export function ProductionRecordExperienceEnhancer() {
  const [context, setContext] = useState(routeContext)
  const [titleTarget, setTitleTarget] = useState(null)
  const [preview, setPreview] = useState(null)
  const [arrival, setArrival] = useState(false)

  useEffect(() => {
    const update = () => { setContext(routeContext()); setPreview(null) }
    window.addEventListener('popstate', update)
    window.addEventListener('hi5-routechange', update)
    return () => { window.removeEventListener('popstate', update); window.removeEventListener('hi5-routechange', update) }
  }, [])

  useEffect(() => {
    if (!context) { setTitleTarget(null); return undefined }
    const find = () => {
      const node = document.querySelector('.activity-canvas-title > div')
      if (!(node instanceof HTMLElement)) return false
      setTitleTarget(node)
      return true
    }
    if (find()) return undefined
    const observer = new MutationObserver(() => { if (find()) observer.disconnect() })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [context?.reference])

  useEffect(() => {
    const markPreviewTargets = () => {
      document.querySelectorAll('.activity-canvas-ribbon > span, .service-request-task, .service-request-approval, .service-request-item, .activity-canvas-mini-list > div, .service-request-inspector-card').forEach((node) => {
        if (node instanceof HTMLElement) node.classList.add('production-preview-enabled')
      })
    }
    markPreviewTargets()
    const observer = new MutationObserver(markPreviewTargets)
    observer.observe(document.body, { childList: true, subtree: true })
    const onClick = (event) => {
      const next = previewForElement(event.target)
      if (!next) return
      event.preventDefault()
      event.stopPropagation()
      setPreview(next)
    }
    document.addEventListener('click', onClick, true)
    return () => { observer.disconnect(); document.removeEventListener('click', onClick, true) }
  }, [])

  useEffect(() => {
    if (window.sessionStorage.getItem(ARRIVAL_KEY) !== 'ready') return
    window.sessionStorage.removeItem(ARRIVAL_KEY)
    setArrival(true)
    const timer = window.setTimeout(() => setArrival(false), 2100)
    return () => window.clearTimeout(timer)
  }, [])

  const back = useMemo(() => context ? `Back to ${context.label}` : '', [context])

  return <>
    {context && titleTarget ? createPortal(<button type="button" className="production-record-back" title={back} aria-label={back} onClick={() => navigate(`/${context.section}`)}><ArrowLeft size={15} /></button>, titleTarget) : null}
    <QuickPreview preview={preview} onClose={() => setPreview(null)} />
    {arrival ? createPortal(<div className="production-first-arrival"><div className="production-first-arrival-card"><img src="/hi5central-logo.png" alt="" /><strong>Your workspace is ready</strong><span>Welcome to Hi5Central. Your setup has been applied.</span></div></div>, document.body) : null}
  </>
}
