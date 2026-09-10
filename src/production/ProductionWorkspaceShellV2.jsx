import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bell,
  CircleGauge,
  Copy,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sun,
  X,
} from 'lucide-react'

const TAB_SELECTOR = '.tab-list .workspace-tab'

const MODULE_LABELS = {
  home: 'Dashboard',
  incidents: 'Incidents',
  requests: 'Service Requests',
  changes: 'Changes',
  problems: 'Problems',
  knowledge: 'Knowledge',
  cmdb: 'CMDB',
  people: 'People',
  projects: 'Projects',
  calendar: 'Calendar',
  rota: 'Staff Rota',
  livechat: 'Live Chat',
  reports: 'Reports',
  settings: 'Settings',
  newtab: 'Workspace',
}

function readableModule(value = '') {
  const normalized = String(value || '').trim().toLowerCase()
  if (MODULE_LABELS[normalized]) return MODULE_LABELS[normalized]
  if (!normalized) return 'Workspace'
  return normalized
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() || ''}${part.slice(1)}`)
    .join(' ')
}

function cleanTabTitle(button) {
  const label = button?.querySelector('.workspace-tab-label')
  if (!(label instanceof HTMLElement)) return button?.textContent?.trim() || 'Workspace'
  const clone = label.cloneNode(true)
  clone.querySelectorAll('.live-chat-tab-notification, .unsaved-dot').forEach((node) => node.remove())
  return clone.textContent?.replace(/\s+/g, ' ').trim() || 'Workspace'
}

function originalTabButton(tabKey) {
  return Array.from(document.querySelectorAll(TAB_SELECTOR))
    .find((node) => node instanceof HTMLElement && node.dataset.tabKey === tabKey) || null
}

function actionByTitle(title) {
  return Array.from(document.querySelectorAll('button[title]'))
    .find((node) => node instanceof HTMLButtonElement && node.title === title) || null
}

function readWorkspaceSnapshot() {
  const buttons = Array.from(document.querySelectorAll(TAB_SELECTOR))
    .filter((node) => node instanceof HTMLElement)

  const tabs = buttons.map((button, index) => {
    const unreadText = button.querySelector('.live-chat-tab-notification')?.textContent || ''
    const unread = Number.parseInt(String(unreadText).match(/\d+/)?.[0] || '0', 10)
    return {
      key: button.dataset.tabKey || `workspace-${index}`,
      module: button.dataset.tabModule || '',
      title: cleanTabTitle(button),
      active: button.classList.contains('active'),
      dirty: button.classList.contains('dirty') || Boolean(button.querySelector('.unsaved-dot')),
      closable: Boolean(button.querySelector('.tab-close')),
      unread: Number.isFinite(unread) ? unread : 0,
    }
  })

  const active = tabs.find((tab) => tab.active) || tabs[0] || null
  const breadcrumbs = Array.from(document.querySelectorAll('.breadcrumb-trail .breadcrumb-item'))
    .map((node) => node.textContent?.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const shell = document.querySelector('.app-shell')
  const searchInput = document.querySelector('.chrome-search input')
  const notificationCounter = document.querySelector('.notification-trigger .notification-count, .notification-trigger .notification-badge')
  const parsedNotifications = Number.parseInt(notificationCounter?.textContent?.match(/\d+/)?.[0] || '0', 10)
  const brandImage = document.querySelector('.tabbar-brand img')

  return {
    tabs,
    active,
    breadcrumbs,
    theme: shell instanceof HTMLElement ? shell.dataset.theme || 'light' : 'light',
    sidebarHidden: shell instanceof HTMLElement ? shell.classList.contains('sidebar-hidden') : false,
    searchValue: searchInput instanceof HTMLInputElement ? searchInput.value : '',
    unreadNotifications: Number.isFinite(parsedNotifications) ? parsedNotifications : 0,
    brandSrc: brandImage instanceof HTMLImageElement ? brandImage.src : '/hi5central-logo.png',
  }
}

function snapshotSignature(snapshot) {
  return JSON.stringify({
    tabs: snapshot.tabs,
    breadcrumbs: snapshot.breadcrumbs,
    theme: snapshot.theme,
    sidebarHidden: snapshot.sidebarHidden,
    searchValue: snapshot.searchValue,
    unreadNotifications: snapshot.unreadNotifications,
    brandSrc: snapshot.brandSrc,
  })
}

function syncReactInput(input, value) {
  if (!(input instanceof HTMLInputElement)) return false
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  if (setter) setter.call(input, value)
  else input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

function proxyClick(selector) {
  const target = document.querySelector(selector)
  if (!(target instanceof HTMLElement)) return false
  target.click()
  return true
}

function invokeLegacyContextAction(tabKey, actionPrefix) {
  const target = originalTabButton(tabKey)
  if (!(target instanceof HTMLElement)) return

  document.body.classList.add('hi5-workspace-v2-programmatic-tab-menu')
  target.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: 4,
    clientY: 4,
    view: window,
  }))

  window.requestAnimationFrame(() => {
    const menu = document.querySelector('.tab-context-menu')
    const action = Array.from(menu?.querySelectorAll('button') || [])
      .find((button) => button.textContent?.trim().toLowerCase().startsWith(actionPrefix.toLowerCase()))
    if (action instanceof HTMLButtonElement && !action.disabled) action.click()
    document.body.classList.remove('hi5-workspace-v2-programmatic-tab-menu')
  })
}

function WorkspaceItem({ tab, onActivate, onClose, onDuplicate }) {
  return (
    <div
      className={`production-open-work-item${tab.active ? ' is-active' : ''}`}
      data-workspace-key={tab.key}
      onContextMenu={(event) => {
        event.preventDefault()
        if (tab.key !== 'livechat' && tab.key !== 'newtab') onDuplicate(tab.key)
      }}
    >
      <button className="production-open-work-main" onClick={() => onActivate(tab.key)} type="button">
        <span className="production-open-work-state" aria-hidden="true" />
        <span className="production-open-work-copy">
          <strong>{tab.title}</strong>
          <small>{readableModule(tab.module)}{tab.dirty ? ' · Unsaved changes' : ''}</small>
        </span>
        {tab.unread > 0 && <span className="production-open-work-unread">{tab.unread}</span>}
      </button>

      <div className="production-open-work-actions">
        {tab.key !== 'livechat' && tab.key !== 'newtab' && (
          <button aria-label={`Duplicate ${tab.title}`} onClick={() => onDuplicate(tab.key)} title="Duplicate" type="button">
            <Copy size={14} aria-hidden="true" />
          </button>
        )}
        {tab.closable && (
          <button aria-label={`Close ${tab.title}`} onClick={() => onClose(tab.key)} title="Close" type="button">
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}

export function ProductionWorkspaceShellV2() {
  const [tabbar, setTabbar] = useState(null)
  const [portalRoot, setPortalRoot] = useState(null)
  const [snapshot, setSnapshot] = useState(() => readWorkspaceSnapshot())
  const [openWork, setOpenWork] = useState(false)
  const [openWorkQuery, setOpenWorkQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [panelLeft, setPanelLeft] = useState(12)
  const snapshotRef = useRef('')
  const openWorkButtonRef = useRef(null)
  const searchInputRef = useRef(null)

  useEffect(() => {
    const scan = () => {
      const nextTabbar = document.querySelector('.tabbar')
      const nextPortalRoot = document.querySelector('.app-shell') || document.body
      if (nextTabbar instanceof HTMLElement) setTabbar((current) => current === nextTabbar ? current : nextTabbar)
      if (nextPortalRoot instanceof HTMLElement) setPortalRoot((current) => current === nextPortalRoot ? current : nextPortalRoot)

      const next = readWorkspaceSnapshot()
      const signature = snapshotSignature(next)
      if (signature !== snapshotRef.current) {
        snapshotRef.current = signature
        setSnapshot(next)
        if (!searchOpen) setSearchValue(next.searchValue)
      }
    }

    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true })
    const timer = window.setInterval(scan, 700)
    window.addEventListener('hi5-routechange', scan)
    window.addEventListener('hi5-runtime-preferences-applied', scan)
    window.addEventListener('resize', scan)

    return () => {
      observer.disconnect()
      window.clearInterval(timer)
      window.removeEventListener('hi5-routechange', scan)
      window.removeEventListener('hi5-runtime-preferences-applied', scan)
      window.removeEventListener('resize', scan)
    }
  }, [searchOpen])

  useEffect(() => {
    if (!openWork && !searchOpen) return undefined
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      if (searchOpen) setSearchOpen(false)
      else setOpenWork(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openWork, searchOpen])

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  const visibleTabs = useMemo(() => snapshot.tabs.filter((tab) => tab.key !== 'newtab'), [snapshot.tabs])
  const filteredTabs = useMemo(() => {
    const normalized = openWorkQuery.trim().toLowerCase()
    if (!normalized) return visibleTabs
    return visibleTabs.filter((tab) => `${tab.title} ${readableModule(tab.module)}`.toLowerCase().includes(normalized))
  }, [openWorkQuery, visibleTabs])

  const pinnedTabs = filteredTabs.filter((tab) => !tab.closable)
  const workingTabs = filteredTabs.filter((tab) => tab.closable)
  const active = snapshot.active
  const activeCrumb = snapshot.breadcrumbs.at(-1) || active?.title || 'Workspace'
  const parentCrumb = snapshot.breadcrumbs.length > 1
    ? snapshot.breadcrumbs.at(-2)
    : readableModule(active?.module)

  const openSwitcher = () => {
    const rect = openWorkButtonRef.current?.getBoundingClientRect()
    if (rect) {
      const width = Math.min(440, Math.max(320, window.innerWidth - 24))
      setPanelLeft(Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)))
    }
    setOpenWorkQuery('')
    setOpenWork(true)
    setSearchOpen(false)
  }

  const activateWorkspace = (tabKey) => {
    const button = originalTabButton(tabKey)
    if (button instanceof HTMLElement) button.click()
    setOpenWork(false)
  }

  const closeWorkspace = (tabKey) => {
    const button = originalTabButton(tabKey)
    const close = button?.querySelector('.tab-close')
    if (close instanceof HTMLElement) close.click()
  }

  const duplicateWorkspace = (tabKey) => {
    invokeLegacyContextAction(tabKey, 'Duplicate')
  }

  const closeAllWork = () => {
    const source = snapshot.tabs.find((tab) => tab.active) || snapshot.tabs[0]
    if (source) invokeLegacyContextAction(source.key, 'Close all tabs')
    setOpenWork(false)
  }

  const updateSearch = (value) => {
    setSearchValue(value)
    const input = document.querySelector('.chrome-search input') || document.querySelector('.breadcrumb-compact-search input')
    syncReactInput(input, value)
  }

  const toggleTheme = () => {
    const button = Array.from(document.querySelectorAll('button[title]'))
      .find((node) => node instanceof HTMLButtonElement && node.title.startsWith('Switch to '))
    button?.click()
  }

  const openNotifications = () => {
    proxyClick('.breadcrumb-desktop-actions .notification-trigger, .breadcrumb-mobile-actions .notification-trigger, .notification-trigger')
  }

  const openSettings = () => {
    actionByTitle('Settings')?.click()
  }

  const signOut = () => {
    proxyClick('.chrome-logout, .breadcrumb-mobile-action[title="Sign out"]')
  }

  const showSidebar = () => {
    actionByTitle('Show sidebar')?.click()
  }

  const openNewRecord = () => {
    proxyClick('.record-create-trigger')
  }

  const commandBar = (
    <div className="production-workspace-commandbar" data-hi5-workspace-shell="v2">
      <button
        aria-label="Open Hi5Central navigation"
        className="production-workspace-mobile-nav"
        onClick={() => proxyClick('.tabbar-brand')}
        title="Open navigation"
        type="button"
      >
        {snapshot.brandSrc ? <img src={snapshot.brandSrc} alt="" aria-hidden="true" /> : <Menu size={17} aria-hidden="true" />}
      </button>

      <div className="production-workspace-context" title={`${parentCrumb} / ${activeCrumb}`}>
        <span className="production-workspace-context-mark" aria-hidden="true" />
        <span className="production-workspace-context-copy">
          <small>{parentCrumb}</small>
          <strong>{activeCrumb}</strong>
        </span>
        {active?.dirty && <span className="production-workspace-dirty" aria-label="Unsaved changes" />}
      </div>

      <div className="production-workspace-primary-actions">
        <button
          aria-expanded={openWork}
          className="production-open-work-trigger"
          onClick={openSwitcher}
          ref={openWorkButtonRef}
          title="Open work"
          type="button"
        >
          <CircleGauge size={15} aria-hidden="true" />
          <span>Open work</span>
          <strong>{visibleTabs.length}</strong>
        </button>

        <button
          aria-label="Open workspace launcher"
          className="production-workspace-icon-action production-workspace-launcher"
          onClick={() => proxyClick('.tab-add')}
          title="Open workspace launcher"
          type="button"
        >
          <Plus size={17} aria-hidden="true" />
        </button>
      </div>

      <div className={`production-workspace-search${searchOpen ? ' is-open' : ''}`}>
        {searchOpen ? (
          <>
            <Search size={15} aria-hidden="true" />
            <input
              aria-label="Search Hi5Central"
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search records"
              ref={searchInputRef}
              type="search"
              value={searchValue}
            />
            <button aria-label="Close search" onClick={() => setSearchOpen(false)} type="button">
              <X size={14} aria-hidden="true" />
            </button>
          </>
        ) : (
          <button
            aria-label="Search Hi5Central"
            className="production-workspace-icon-action"
            onClick={() => {
              setSearchValue(snapshot.searchValue)
              setSearchOpen(true)
              setOpenWork(false)
            }}
            title="Search"
            type="button"
          >
            <Search size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="production-workspace-utility-actions">
        {snapshot.sidebarHidden && (
          <button aria-label="Show sidebar" onClick={showSidebar} title="Show sidebar" type="button">
            <PanelLeftOpen size={16} aria-hidden="true" />
          </button>
        )}
        <button aria-label="Switch theme" onClick={toggleTheme} title="Switch theme" type="button">
          {snapshot.theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
        </button>
        <button className="production-workspace-notifications" aria-label="Notifications" onClick={openNotifications} title="Notifications" type="button">
          <Bell size={16} aria-hidden="true" />
          {snapshot.unreadNotifications > 0 && <span>{snapshot.unreadNotifications}</span>}
        </button>
        <button aria-label="Settings" onClick={openSettings} title="Settings" type="button">
          <Settings size={16} aria-hidden="true" />
        </button>
        <button aria-label="Sign out" onClick={signOut} title="Sign out" type="button">
          <LogOut size={16} aria-hidden="true" />
        </button>
      </div>

      <button className="production-workspace-mobile-new" onClick={openNewRecord} type="button">
        <Plus size={15} aria-hidden="true" />
        <span>New</span>
      </button>
    </div>
  )

  const switcher = openWork && portalRoot
    ? createPortal(
        <div className="production-open-work-backdrop" onMouseDown={() => setOpenWork(false)}>
          <section
            aria-label="Open work"
            aria-modal="true"
            className="production-open-work-panel"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            style={{ '--production-open-work-left': `${panelLeft}px` }}
          >
            <header className="production-open-work-heading">
              <div>
                <span>Workspace</span>
                <strong>Open work</strong>
              </div>
              <div>
                {workingTabs.length > 0 && (
                  <button className="production-open-work-close-all" onClick={closeAllWork} type="button">Close all</button>
                )}
                <button aria-label="Close Open work" onClick={() => setOpenWork(false)} type="button">
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            </header>

            <label className="production-open-work-search">
              <Search size={15} aria-hidden="true" />
              <input
                autoFocus
                onChange={(event) => setOpenWorkQuery(event.target.value)}
                placeholder="Find open work"
                type="search"
                value={openWorkQuery}
              />
            </label>

            <div className="production-open-work-list">
              {pinnedTabs.length > 0 && (
                <section>
                  <div className="production-open-work-section-heading">
                    <span>Fixed</span>
                    <small>{pinnedTabs.length}</small>
                  </div>
                  {pinnedTabs.map((tab) => (
                    <WorkspaceItem
                      key={tab.key}
                      tab={tab}
                      onActivate={activateWorkspace}
                      onClose={closeWorkspace}
                      onDuplicate={duplicateWorkspace}
                    />
                  ))}
                </section>
              )}

              {workingTabs.length > 0 && (
                <section>
                  <div className="production-open-work-section-heading">
                    <span>Working set</span>
                    <small>{workingTabs.length}</small>
                  </div>
                  {workingTabs.map((tab) => (
                    <WorkspaceItem
                      key={tab.key}
                      tab={tab}
                      onActivate={activateWorkspace}
                      onClose={closeWorkspace}
                      onDuplicate={duplicateWorkspace}
                    />
                  ))}
                </section>
              )}

              {!filteredTabs.length && (
                <div className="production-open-work-empty">
                  <CircleGauge size={20} aria-hidden="true" />
                  <strong>No open work matches this search.</strong>
                  <span>Try another title or workspace name.</span>
                </div>
              )}
            </div>

            <footer className="production-open-work-footer">
              <button onClick={() => {
                setOpenWork(false)
                proxyClick('.tab-add')
              }} type="button">
                <Plus size={15} aria-hidden="true" />
                Open another workspace
              </button>
              <span>Right-click a work item to duplicate it.</span>
            </footer>
          </section>
        </div>,
        portalRoot,
      )
    : null

  if (!(tabbar instanceof HTMLElement)) return switcher

  return (
    <>
      {createPortal(commandBar, tabbar)}
      {switcher}
    </>
  )
}
