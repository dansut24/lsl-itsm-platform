import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MessageCircleMore, RefreshCw } from 'lucide-react'

const API_BASE = window.__HI5_API_BASE__
const LIVE_CHAT_PREFERENCES_KEY = 'hi5central-live-chat-preferences-v1'
const LIVE_CHAT_TAB_SELECTOR = '.workspace-tab-livechat, .workspace-tab[data-tab-module="livechat"]'
const MENU_SELECTOR = '.production-workspace-menu'
const MENU_ANCHOR_ATTRIBUTE = 'data-hi5-live-chat-menu-anchor'

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw Object.assign(new Error(payload.error || 'Could not update Live Chat.'), {
      status: response.status,
    })
  }
  return payload
}

function selectedPersonEmail() {
  const drawer = document.querySelector('.org-person-drawer')
  if (!(drawer instanceof HTMLElement)) return ''

  const facts = [...drawer.querySelectorAll('.org-profile-facts > div')]
  const emailFact = facts.find((item) => item.querySelector('span')?.textContent?.trim() === 'Email')
  return emailFact?.querySelector('strong')?.textContent?.trim().toLowerCase() || ''
}

function liveChatWorkspaceEnabled() {
  return document.querySelector(LIVE_CHAT_TAB_SELECTOR) instanceof HTMLElement
}

function ensureMenuAnchor(menu) {
  let anchor = menu.querySelector(`[${MENU_ANCHOR_ATTRIBUTE}]`)
  if (anchor instanceof HTMLElement) return anchor

  anchor = document.createElement('div')
  anchor.setAttribute(MENU_ANCHOR_ATTRIBUTE, 'true')
  anchor.style.display = 'contents'

  const buttons = Array.from(menu.querySelectorAll(':scope > button'))
  const settingsButton = buttons.find((button) => button.textContent?.trim() === 'Settings')
  const signOutButton = buttons.find((button) => button.textContent?.trim() === 'Sign out')
  menu.insertBefore(anchor, settingsButton || signOutButton || null)
  return anchor
}

function closeWorkspaceMenu() {
  const backdrop = document.querySelector('.production-workspace-menu-backdrop')
  if (backdrop instanceof HTMLElement) backdrop.click()
}

function toggleLocalWorkspacePreference(enabled) {
  let current = {}
  try {
    current = JSON.parse(window.localStorage.getItem(LIVE_CHAT_PREFERENCES_KEY) || '{}') || {}
  } catch {
    current = {}
  }

  window.localStorage.setItem(LIVE_CHAT_PREFERENCES_KEY, JSON.stringify({
    ...current,
    enabled,
  }))
}

export function ProductionWorkspaceLiveChatMenu() {
  const [menuAnchor, setMenuAnchor] = useState(null)
  const [workspaceEnabled, setWorkspaceEnabled] = useState(() => liveChatWorkspaceEnabled())
  const [personEmail, setPersonEmail] = useState(() => selectedPersonEmail())
  const [person, setPerson] = useState(null)
  const [personLoading, setPersonLoading] = useState(false)
  const [error, setError] = useState('')
  const personRequestRef = useRef(0)

  useEffect(() => {
    const scan = () => {
      const menu = document.querySelector(MENU_SELECTOR)
      setMenuAnchor((current) => {
        if (!(menu instanceof HTMLElement)) return null
        const next = ensureMenuAnchor(menu)
        return current === next ? current : next
      })

      setWorkspaceEnabled(liveChatWorkspaceEnabled())

      const email = selectedPersonEmail()
      setPersonEmail((current) => current === email ? current : email)
    }

    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    })

    const timer = window.setInterval(scan, 700)
    window.addEventListener('hi5-routechange', scan)
    window.addEventListener('hi5-organisation-hydrated', scan)

    return () => {
      observer.disconnect()
      window.clearInterval(timer)
      window.removeEventListener('hi5-routechange', scan)
      window.removeEventListener('hi5-organisation-hydrated', scan)
    }
  }, [])

  useEffect(() => {
    const requestId = personRequestRef.current + 1
    personRequestRef.current = requestId
    setPerson(null)
    setError('')

    if (!personEmail) return undefined

    let active = true
    setPersonLoading(true)

    ;(async () => {
      try {
        const organisation = await api('/api/v1/organisation')
        const matched = (organisation.people || []).find(
          (item) => String(item.email || '').trim().toLowerCase() === personEmail,
        )
        if (!matched) return

        const entitlement = await api(`/api/v1/live-chat/entitlements/${encodeURIComponent(matched.id)}`)
        if (!active || personRequestRef.current !== requestId) return

        setPerson({
          ...matched,
          liveChatEnabled: Boolean(entitlement.liveChatEnabled),
        })
      } catch (nextError) {
        if (active && personRequestRef.current === requestId) setError(nextError.message)
      } finally {
        if (active && personRequestRef.current === requestId) setPersonLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [personEmail])

  function toggleWorkspaceLiveChat() {
    toggleLocalWorkspacePreference(!workspaceEnabled)
    closeWorkspaceMenu()
    window.location.reload()
  }

  async function togglePersonLiveChat() {
    if (!person || personLoading) return
    setPersonLoading(true)
    setError('')

    try {
      const result = await api(`/api/v1/live-chat/entitlements/${encodeURIComponent(person.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !person.liveChatEnabled }),
      })
      setPerson((current) => current ? {
        ...current,
        liveChatEnabled: Boolean(result.liveChatEnabled),
      } : current)
      closeWorkspaceMenu()
    } catch (nextError) {
      setError(nextError.status === 403
        ? 'Only a tenant owner or administrator can change Portal Live Chat access.'
        : nextError.message)
    } finally {
      setPersonLoading(false)
    }
  }

  if (!(menuAnchor instanceof HTMLElement)) return null

  return createPortal(
    <>
      <span className="production-workspace-menu-separator" role="separator" />
      <button onClick={toggleWorkspaceLiveChat} role="menuitem" type="button">
        <MessageCircleMore size={14} aria-hidden="true" />
        {workspaceEnabled ? 'Disable Live Chat workspace' : 'Enable Live Chat workspace'}
      </button>
      {person ? (
        <button
          disabled={personLoading || person.active === false}
          onClick={togglePersonLiveChat}
          role="menuitem"
          title={`${person.liveChatEnabled ? 'Disable' : 'Enable'} Portal Live Chat for ${person.name}`}
          type="button"
        >
          {personLoading
            ? <RefreshCw className="is-spinning" size={14} aria-hidden="true" />
            : <MessageCircleMore size={14} aria-hidden="true" />}
          {person.liveChatEnabled ? 'Disable' : 'Enable'} Portal Chat · {person.name}
        </button>
      ) : null}
      {error ? (
        <div
          role="status"
          style={{
            padding: '5px 9px 7px',
            color: 'var(--danger, #b42318)',
            fontSize: '10px',
            lineHeight: 1.35,
          }}
        >
          {error}
        </div>
      ) : null}
    </>,
    menuAnchor,
  )
}
