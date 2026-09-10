import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookmarkPlus, Filter, SlidersHorizontal, X } from 'lucide-react'

const QUICK_LABELS = ['All', 'Unassigned', 'High priority', 'Needs attention', 'Updated today']

function routeTitle(pathname = window.location.pathname) {
  const section = pathname.match(/^\/(incidents|requests|problems|changes)\/?$/i)?.[1]?.toLowerCase()
  return {
    incidents: 'Incidents',
    requests: 'Service Requests',
    problems: 'Problems',
    changes: 'Changes',
  }[section] || ''
}

function nativeValue(element, value) {
  if (!element) return
  const prototype = element instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  if (setter) setter.call(element, value)
  else element.value = value
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
}

function QueueRailContent({ snapshot, onQuick, onStatus, onPriority, onSaved, onDeleteSaved, onSave, onClear, mobile = false, onClose }) {
  return (
    <aside className={`hi5-queue-rail${mobile ? ' is-mobile-sheet' : ''}`} aria-label="Queue views and filters">
      <header className="hi5-queue-rail-header">
        <div><span>Queue</span><strong>{snapshot.title || 'Service Desk'}</strong></div>
        {mobile ? <button type="button" aria-label="Close queue navigation" onClick={onClose}><X size={17} /></button> : null}
      </header>

      <div className="hi5-queue-rail-scroll">
        <section className="hi5-queue-rail-section">
          <span className="hi5-queue-rail-label">Views</span>
          <nav className="hi5-queue-rail-views" aria-label="Queue views">
            {QUICK_LABELS.map((label) => (
              <button type="button" className={snapshot.quick === label ? 'is-active' : ''} onClick={() => onQuick(label)} key={label}>
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </section>

        {snapshot.saved.length ? (
          <section className="hi5-queue-rail-section">
            <span className="hi5-queue-rail-label">Saved views</span>
            <div className="hi5-queue-rail-saved">
              {snapshot.saved.map((view) => (
                <div key={view.name}>
                  <button type="button" onClick={() => onSaved(view.name)}>{view.name}</button>
                  <button type="button" aria-label={`Delete ${view.name}`} onClick={() => onDeleteSaved(view.name)}><X size={12} /></button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="hi5-queue-rail-section hi5-queue-rail-filters">
          <span className="hi5-queue-rail-label">Filters</span>
          <label>
            <span>Status</span>
            <select value={snapshot.status} onChange={(event) => onStatus(event.target.value)}>
              {snapshot.statusOptions.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>Priority / risk</span>
            <select value={snapshot.priority} onChange={(event) => onPriority(event.target.value)}>
              {snapshot.priorityOptions.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <button className="hi5-queue-rail-clear" type="button" onClick={onClear}>Clear filters</button>
        </section>
      </div>

      <footer className="hi5-queue-rail-footer">
        <button type="button" onClick={onSave}><BookmarkPlus size={14} /> Save current view</button>
      </footer>
    </aside>
  )
}

export function ProductionServiceDeskQueueRail() {
  const [host, setHost] = useState(null)
  const [toolbar, setToolbar] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [snapshot, setSnapshot] = useState({
    title: '', quick: 'All', saved: [], status: 'All', priority: 'All', statusOptions: ['All'], priorityOptions: ['All'],
  })
  const signatureRef = useRef('')

  useEffect(() => {
    const scan = () => {
      const nextHost = document.querySelector('.hi5-service-desk-v2')
      if (!(nextHost instanceof HTMLElement) || !routeTitle()) {
        if (host instanceof HTMLElement) host.classList.remove('has-queue-rail')
        setHost(null)
        setToolbar(null)
        setMobileOpen(false)
        return
      }

      nextHost.classList.add('has-queue-rail')
      setHost((current) => current === nextHost ? current : nextHost)
      const nextToolbar = nextHost.querySelector('.hi5-list-toolbar')
      setToolbar((current) => current === nextToolbar ? current : nextToolbar)

      const quickButtons = [...nextHost.querySelectorAll('.hi5-list-quick-filters > button')]
      const activeQuick = quickButtons.find((button) => button.classList.contains('is-active'))?.textContent?.trim() || 'All'
      const saved = [...nextHost.querySelectorAll('.hi5-list-saved-views > div')].map((row) => ({
        name: row.querySelector('button:first-child')?.textContent?.trim() || '',
      })).filter((item) => item.name)
      const selects = [...nextHost.querySelectorAll('.hi5-list-filter-select select')]
      const status = selects[0]?.value || 'All'
      const priority = selects[1]?.value || 'All'
      const statusOptions = selects[0] ? [...selects[0].options].map((option) => option.value) : ['All']
      const priorityOptions = selects[1] ? [...selects[1].options].map((option) => option.value) : ['All']
      const title = routeTitle() || nextHost.querySelector('.hi5-list-heading h1')?.textContent?.trim() || 'Service Desk'
      const signature = JSON.stringify({ title, activeQuick, saved, status, priority, statusOptions, priorityOptions })
      if (signature !== signatureRef.current) {
        signatureRef.current = signature
        setSnapshot({ title, quick: activeQuick, saved, status, priority, statusOptions, priorityOptions })
      }
    }

    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    window.addEventListener('hi5-routechange', scan)
    window.addEventListener('popstate', scan)
    const timer = window.setInterval(scan, 450)
    return () => {
      observer.disconnect()
      window.removeEventListener('hi5-routechange', scan)
      window.removeEventListener('popstate', scan)
      window.clearInterval(timer)
      document.querySelector('.hi5-service-desk-v2')?.classList.remove('has-queue-rail')
    }
  }, [])

  const controls = useMemo(() => ({
    quick(label) {
      const button = [...(host?.querySelectorAll('.hi5-list-quick-filters > button') || [])].find((item) => item.textContent?.trim() === label)
      button?.click()
    },
    status(value) {
      nativeValue(host?.querySelectorAll('.hi5-list-filter-select select')?.[0], value)
    },
    priority(value) {
      nativeValue(host?.querySelectorAll('.hi5-list-filter-select select')?.[1], value)
    },
    saved(name) {
      const button = [...(host?.querySelectorAll('.hi5-list-saved-views > div > button:first-child') || [])].find((item) => item.textContent?.trim() === name)
      button?.click()
    },
    deleteSaved(name) {
      const row = [...(host?.querySelectorAll('.hi5-list-saved-views > div') || [])].find((item) => item.querySelector('button:first-child')?.textContent?.trim() === name)
      row?.querySelector('button:last-child')?.click()
    },
    save() {
      host?.querySelector('.hi5-list-save-view')?.click()
    },
    clear() {
      const search = host?.querySelector('.hi5-list-search input')
      if (search?.value) nativeValue(search, '')
      const all = [...(host?.querySelectorAll('.hi5-list-quick-filters > button') || [])].find((item) => item.textContent?.trim() === 'All')
      all?.click()
      nativeValue(host?.querySelectorAll('.hi5-list-filter-select select')?.[0], 'All')
      nativeValue(host?.querySelectorAll('.hi5-list-filter-select select')?.[1], 'All')
    },
  }), [host])

  if (!host) return null

  const contentProps = {
    snapshot,
    onQuick: controls.quick,
    onStatus: controls.status,
    onPriority: controls.priority,
    onSaved: controls.saved,
    onDeleteSaved: controls.deleteSaved,
    onSave: controls.save,
    onClear: controls.clear,
  }

  return (
    <>
      {createPortal(<QueueRailContent {...contentProps} />, host)}
      {toolbar ? createPortal(
        <button type="button" className="hi5-queue-rail-mobile-trigger" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}>
          <Filter size={15} /><span>Views & filters</span><SlidersHorizontal size={14} />
        </button>,
        toolbar,
      ) : null}
      {mobileOpen ? createPortal(
        <div className="hi5-queue-rail-mobile-layer">
          <button type="button" className="hi5-queue-rail-mobile-backdrop" aria-label="Close queue navigation" onClick={() => setMobileOpen(false)} />
          <QueueRailContent {...contentProps} mobile onClose={() => setMobileOpen(false)} />
        </div>,
        document.body,
      ) : null}
    </>
  )
}
