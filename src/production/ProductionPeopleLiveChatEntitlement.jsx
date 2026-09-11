import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, MessageCircle, MoreHorizontal, RefreshCw, X } from 'lucide-react'
import './ProductionKnowledgeLiveChat.css'

const API_BASE = window.__HI5_API_BASE__

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(payload.error || 'Could not update Live Chat access.'), { status: response.status })
  return payload
}

function drawerEmail(drawer) {
  const facts = [...drawer.querySelectorAll('.org-profile-facts > div')]
  const emailFact = facts.find((item) => item.querySelector('span')?.textContent?.trim() === 'Email')
  return emailFact?.querySelector('strong')?.textContent?.trim().toLowerCase() || ''
}

export function ProductionPeopleLiveChatEntitlement() {
  const [target, setTarget] = useState(null)
  const [drawer, setDrawer] = useState(null)
  const [person, setPerson] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const scan = async () => {
      const nextDrawer = document.querySelector('.org-person-drawer')
      const nextTarget = nextDrawer?.querySelector('.org-drawer-actions')
      if (!(nextDrawer instanceof HTMLElement) || !(nextTarget instanceof HTMLElement)) {
        setDrawer(null); setTarget(null); setPerson(null); setMenuOpen(false); return
      }
      if (nextDrawer === drawer) return
      setDrawer(nextDrawer); setTarget(nextTarget); setMenuOpen(false); setError('')
      const email = drawerEmail(nextDrawer)
      if (!email) return
      try {
        const organisation = await api('/api/v1/organisation')
        const matched = (organisation.people || []).find((item) => String(item.email || '').toLowerCase() === email)
        if (!matched) return
        const entitlement = await api(`/api/v1/live-chat/entitlements/${encodeURIComponent(matched.id)}`)
        setPerson({ ...matched, liveChatEnabled: Boolean(entitlement.liveChatEnabled) })
      } catch (err) { setError(err.message) }
    }
    scan()
    const observer = new MutationObserver(scan); observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [drawer])

  async function toggle() {
    if (!person) return
    setLoading(true); setError('')
    try {
      const result = await api(`/api/v1/live-chat/entitlements/${encodeURIComponent(person.id)}`, { method: 'PATCH', body: JSON.stringify({ enabled: !person.liveChatEnabled }) })
      setPerson((current) => ({ ...current, liveChatEnabled: Boolean(result.liveChatEnabled) }))
      setMenuOpen(false)
    } catch (err) { setError(err.status === 403 ? 'Only a tenant owner or administrator can change Live Chat access.' : err.message) }
    finally { setLoading(false) }
  }

  if (!target || !person) return null

  return createPortal(<div className="ppe-wrap"><button className="org-icon-button" onClick={() => setMenuOpen((value) => !value)} title="More person actions" type="button"><MoreHorizontal size={19} /></button>{menuOpen ? <><button className="ppe-backdrop" aria-label="Close person actions" onClick={() => setMenuOpen(false)} /><div className="ppe-menu"><header><div><small>Person access</small><strong>{person.name}</strong></div><button onClick={() => setMenuOpen(false)}><X size={16} /></button></header><div className="ppe-status"><MessageCircle size={17} /><span><strong>Portal Live Chat</strong><small>{person.liveChatEnabled ? 'Enabled for this user' : 'Not enabled for this user'}</small></span><i className={person.liveChatEnabled ? 'on' : ''}>{person.liveChatEnabled ? <Check size={13} /> : null}</i></div>{error ? <div className="ppe-error">{error}</div> : null}<button className={person.liveChatEnabled ? 'ppe-disable' : 'ppe-enable'} disabled={loading || person.active === false} onClick={toggle}>{loading ? <RefreshCw className="is-spinning" size={16} /> : <MessageCircle size={16} />}{person.liveChatEnabled ? 'Disable Live Chat' : 'Enable Live Chat'}</button>{person.active === false ? <small className="ppe-note">Activate this Person before enabling Portal Live Chat.</small> : <small className="ppe-note">The requester will see Live Chat in their Help Centre immediately after this changes.</small>}</div></> : null}</div>, target)
}
