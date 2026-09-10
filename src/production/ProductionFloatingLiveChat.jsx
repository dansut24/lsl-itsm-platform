import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MessageCircleMore } from 'lucide-react'

const LIVE_CHAT_SELECTOR = '.workspace-tab-livechat, .workspace-tab[data-tab-module="livechat"]'

function readLiveChatState() {
  const tab = document.querySelector(LIVE_CHAT_SELECTOR)
  if (!(tab instanceof HTMLElement)) return null

  const unreadText = tab.querySelector('.live-chat-tab-notification')?.textContent || ''
  const unread = Number.parseInt(String(unreadText).match(/\d+/)?.[0] || '0', 10)

  return {
    active: tab.classList.contains('active'),
    unread: Number.isFinite(unread) ? unread : 0,
  }
}

function stateSignature(state) {
  return state ? `${state.active ? 1 : 0}:${state.unread}` : 'disabled'
}

export function ProductionFloatingLiveChat() {
  const [portalRoot, setPortalRoot] = useState(null)
  const [liveChat, setLiveChat] = useState(() => readLiveChatState())
  const signatureRef = useRef('')

  useEffect(() => {
    const scan = () => {
      const nextRoot = document.querySelector('.app-shell')
      if (nextRoot instanceof HTMLElement) {
        setPortalRoot((current) => current === nextRoot ? current : nextRoot)
      }

      const nextLiveChat = readLiveChatState()
      const signature = stateSignature(nextLiveChat)
      if (signature !== signatureRef.current) {
        signatureRef.current = signature
        setLiveChat(nextLiveChat)
      }
    }

    scan()

    const observer = new MutationObserver(scan)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    })

    const timer = window.setInterval(scan, 800)
    window.addEventListener('hi5-routechange', scan)
    window.addEventListener('hi5-runtime-preferences-applied', scan)

    return () => {
      observer.disconnect()
      window.clearInterval(timer)
      window.removeEventListener('hi5-routechange', scan)
      window.removeEventListener('hi5-runtime-preferences-applied', scan)
    }
  }, [])

  if (!(portalRoot instanceof HTMLElement) || !liveChat) return null

  const openLiveChat = () => {
    const tab = document.querySelector(LIVE_CHAT_SELECTOR)
    if (tab instanceof HTMLElement) tab.click()
  }

  const unreadLabel = liveChat.unread > 0
    ? `${liveChat.unread} unread Live Chat message${liveChat.unread === 1 ? '' : 's'}`
    : 'Open Live Chat'

  return createPortal(
    <button
      aria-current={liveChat.active ? 'page' : undefined}
      aria-label={unreadLabel}
      className={`production-floating-live-chat${liveChat.active ? ' is-active' : ''}${liveChat.unread > 0 ? ' has-unread' : ''}`}
      data-hi5-live-chat-dock="true"
      onClick={openLiveChat}
      title={unreadLabel}
      type="button"
    >
      <span className="production-floating-live-chat-icon" aria-hidden="true">
        <MessageCircleMore size={20} strokeWidth={2.1} />
      </span>
      <span className="production-floating-live-chat-copy">
        <small>Support</small>
        <strong>Live Chat</strong>
      </span>
      {liveChat.unread > 0 && (
        <span className="production-floating-live-chat-unread" aria-hidden="true">
          {liveChat.unread > 99 ? '99+' : liveChat.unread}
        </span>
      )}
    </button>,
    portalRoot,
  )
}
