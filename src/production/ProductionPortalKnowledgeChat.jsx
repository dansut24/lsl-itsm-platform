import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, BookOpen, CheckCircle2, ChevronRight, MessageCircle, Plus, Search, Send, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import './ProductionKnowledgeLiveChat.css'

const API_BASE = window.__HI5_API_BASE__

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Help Centre request failed.')
  return payload
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function initials(name = '') {
  return String(name).split(/\s+/).filter(Boolean).slice(0,2).map((part) => part[0]).join('').toUpperCase() || 'HC'
}

function PortalKnowledge({ initialItems, onClose }) {
  const [items, setItems] = useState(initialItems || [])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [feedbackSaved, setFeedbackSaved] = useState(false)
  const [error, setError] = useState('')

  async function search(value) {
    setQuery(value)
    try {
      const payload = await api(`/api/v1/portal/knowledge${value.trim() ? `?q=${encodeURIComponent(value.trim())}` : ''}`)
      setItems(payload.items || [])
    } catch (err) { setError(err.message) }
  }

  async function open(article) {
    try {
      const detail = await api(`/api/v1/portal/knowledge/${encodeURIComponent(article.slug || article.reference)}`)
      setSelected(detail); setFeedbackSaved(false); setError('')
      window.history.replaceState({}, '', `/knowledge/${encodeURIComponent(detail.slug || detail.reference)}`)
    } catch (err) { setError(err.message) }
  }

  async function feedback(helpful) {
    if (!selected) return
    try {
      await api(`/api/v1/portal/knowledge/${encodeURIComponent(selected.slug || selected.reference)}/feedback`, { method: 'POST', body: JSON.stringify({ helpful }) })
      setFeedbackSaved(true)
    } catch (err) { setError(err.message) }
  }

  if (selected) return <section className="ppx-page"><button className="ppx-back" onClick={() => { setSelected(null); window.history.replaceState({}, '', '/knowledge') }}><ArrowLeft size={16} /> Knowledge</button>{error ? <div className="ppx-error">{error}</div> : null}<article className="ppx-article"><header><span>{selected.reference} · {selected.category}</span><h1>{selected.title}</h1><p>{selected.summary}</p><div>{(selected.tags || []).map((tag) => <small key={tag}>{tag}</small>)}</div></header><div className="ppx-article-body">{String(selected.bodyText || '').split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div><footer><strong>Was this article helpful?</strong>{feedbackSaved ? <span className="ppx-feedback-saved"><CheckCircle2 size={16} /> Thanks for your feedback</span> : <div><button onClick={() => feedback(true)}><ThumbsUp size={16} /> Yes</button><button onClick={() => feedback(false)}><ThumbsDown size={16} /> No</button></div>}</footer></article></section>

  return <section className="ppx-page"><div className="ppx-heading"><span>Knowledge Base</span><h1>Find an answer before you wait for IT</h1><p>Search published guidance from your organisation. You can still raise an incident at any time.</p></div>{error ? <div className="ppx-error">{error}</div> : null}<label className="ppx-search"><Search size={18} /><input value={query} onChange={(e) => search(e.target.value)} placeholder="Search help articles…" /></label>{items.length ? <div className="ppx-knowledge-grid">{items.map((article) => <button key={article.reference} onClick={() => open(article)}><span><BookOpen size={19} /></span><small>{article.category} · {article.reference}</small><strong>{article.title}</strong><p>{article.summary}</p><em>Read article <ChevronRight size={14} /></em></button>)}</div> : <div className="ppx-empty"><BookOpen size={30} /><strong>No published articles found</strong><span>Your Service Desk can publish internal knowledge to the portal.</span></div>}</section>
}

function PortalLiveChat({ initialState }) {
  const [enabled, setEnabled] = useState(Boolean(initialState?.enabled))
  const [items, setItems] = useState(initialState?.items || [])
  const [selectedRef, setSelectedRef] = useState('')
  const [detail, setDetail] = useState(null)
  const [creating, setCreating] = useState(false)
  const [subject, setSubject] = useState('')
  const [firstMessage, setFirstMessage] = useState('')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const selectedRefRef = useRef('')

  useEffect(() => { selectedRefRef.current = selectedRef }, [selectedRef])

  async function load({ quiet = false } = {}) {
    try {
      const state = await api('/api/v1/portal/live-chat')
      setEnabled(Boolean(state.enabled)); setItems(state.items || [])
      if (!selectedRefRef.current && state.items?.length) setSelectedRef(state.items[0].reference)
    } catch (err) { if (!quiet) setError(err.message) }
  }

  async function loadDetail(reference, { quiet = false } = {}) {
    if (!reference) { setDetail(null); return }
    try {
      const next = await api(`/api/v1/portal/live-chat/${encodeURIComponent(reference)}`)
      setDetail(next)
      if (Number(next.unread || 0) > 0) await api(`/api/v1/portal/live-chat/${encodeURIComponent(reference)}/read`, { method: 'POST' })
    } catch (err) { if (!quiet) setError(err.message) }
  }

  useEffect(() => {
    load()
    const timer = window.setInterval(() => { load({ quiet: true }); if (selectedRefRef.current) loadDetail(selectedRefRef.current, { quiet: true }) }, 3000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => { if (selectedRef) loadDetail(selectedRef) }, [selectedRef])

  async function start(event) {
    event.preventDefault()
    if (!subject.trim() || !firstMessage.trim()) return
    setBusy(true); setError('')
    try {
      const next = await api('/api/v1/portal/live-chat', { method: 'POST', body: JSON.stringify({ subject: subject.trim(), message: firstMessage.trim() }) })
      setSubject(''); setFirstMessage(''); setCreating(false); setSelectedRef(next.reference); setDetail(next); await load({ quiet: true })
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function send(event) {
    event.preventDefault()
    if (!detail || !draft.trim()) return
    setBusy(true); setError('')
    try {
      const next = await api(`/api/v1/portal/live-chat/${encodeURIComponent(detail.reference)}/messages`, { method: 'POST', body: JSON.stringify({ message: draft.trim() }) })
      setDraft(''); setDetail(next); await load({ quiet: true })
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  if (!enabled) return <section className="ppx-page"><div className="ppx-empty large"><MessageCircle size={40} /><strong>Live Chat is not enabled for your account</strong><span>Your Service Desk can enable it from your Person profile in Hi5Central.</span></div></section>

  if (creating) return <section className="ppx-page"><button className="ppx-back" onClick={() => setCreating(false)}><ArrowLeft size={16} /> Live Chat</button><div className="ppx-heading"><span>New conversation</span><h1>Start Live Chat</h1><p>Send a message directly to the Service Desk.</p></div><form className="ppx-chat-start" onSubmit={start}><label><span>Subject</span><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What do you need help with?" /></label><label><span>Message</span><textarea rows={6} value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} placeholder="Describe the issue or question…" /></label>{error ? <div className="ppx-error">{error}</div> : null}<button className="ppx-primary" disabled={busy || !subject.trim() || !firstMessage.trim()}><Send size={16} /> {busy ? 'Starting…' : 'Start conversation'}</button></form></section>

  if (detail) return <section className="ppx-page ppx-chat-page"><button className="ppx-back" onClick={() => { setSelectedRef(''); setDetail(null) }}><ArrowLeft size={16} /> Conversations</button><div className="ppx-chat-thread"><header><span className="ppx-avatar">{initials(detail.assignedTo || 'IT')}</span><div><small>{detail.reference} · {detail.status}</small><h1>{detail.subject}</h1><p>{detail.assignedTo ? `You’re chatting with ${detail.assignedTo}` : 'Waiting for the Service Desk to join'}</p></div></header>{error ? <div className="ppx-error">{error}</div> : null}<div className="ppx-chat-messages">{(detail.messages || []).map((message) => message.sender === 'system' ? <div className="ppx-chat-system" key={message.id}>{message.text} <small>{formatTime(message.createdAt)}</small></div> : <div className={`ppx-chat-message ${message.sender}`} key={message.id}><p>{message.text}</p><span>{message.senderName} · {formatTime(message.createdAt)}</span></div>)}</div>{detail.status === 'Closed' ? <div className="ppx-chat-closed">This conversation has been closed by the Service Desk.</div> : <form className="ppx-chat-composer" onSubmit={send}><textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type your message…" /><button className="ppx-primary" disabled={busy || !draft.trim()}><Send size={16} /> Send</button></form>}</div></section>

  return <section className="ppx-page"><div className="ppx-heading row"><div><span>Live Chat</span><h1>Talk to the Service Desk</h1><p>Real conversations are saved to your account so you can return to them later.</p></div><button className="ppx-primary" onClick={() => setCreating(true)}><Plus size={16} /> New chat</button></div>{error ? <div className="ppx-error">{error}</div> : null}{items.length ? <div className="ppx-chat-list">{items.map((item) => <button key={item.reference} onClick={() => setSelectedRef(item.reference)}><span><small>{item.reference} · {item.status}</small><strong>{item.subject}</strong><em>{item.lastMessage || 'Conversation started'}</em></span><span>{item.unread ? <i>{item.unread}</i> : null}<ChevronRight size={17} /></span></button>)}</div> : <div className="ppx-empty"><MessageCircle size={30} /><strong>No conversations yet</strong><span>Start a chat when you need help from the Service Desk.</span><button className="ppx-primary" onClick={() => setCreating(true)}><Plus size={16} /> Start Live Chat</button></div>}</section>
}

function IncidentSuggestions({ items, target }) {
  const [text, setText] = useState('')
  useEffect(() => {
    const form = document.querySelector('.prp-request-form')
    if (!(form instanceof HTMLElement)) return undefined
    const inputs = [...form.querySelectorAll('input, textarea')].slice(0, 2)
    const sync = () => setText(inputs.map((input) => input.value || '').join(' ').trim())
    inputs.forEach((input) => input.addEventListener('input', sync)); sync()
    return () => inputs.forEach((input) => input.removeEventListener('input', sync))
  }, [target])
  const suggestions = useMemo(() => {
    const words = new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3))
    if (!words.size) return []
    return items.map((item) => {
      const hay = `${item.title} ${item.summary} ${item.category} ${item.bodyText}`.toLowerCase()
      return { item, score: [...words].filter((word) => hay.includes(word)).length }
    }).filter((x) => x.score > 0).sort((a,b) => b.score - a.score).slice(0,3).map((x) => x.item)
  }, [items, text])
  if (!suggestions.length || !target) return null
  return createPortal(<div className="ppx-suggestions prp-card"><span>Knowledge suggestions</span><strong>These articles might solve this first</strong>{suggestions.map((item) => <a key={item.reference} href={`/knowledge/${encodeURIComponent(item.slug || item.reference)}`}><BookOpen size={15} /><span><b>{item.title}</b><small>{item.summary}</small></span><ChevronRight size={14} /></a>)}<small>You can still raise the incident if these do not help.</small></div>, target)
}

export function ProductionPortalKnowledgeChat() {
  const [shell, setShell] = useState(null)
  const [desktopNav, setDesktopNav] = useState(null)
  const [mobileNav, setMobileNav] = useState(null)
  const [content, setContent] = useState(null)
  const [suggestionTarget, setSuggestionTarget] = useState(null)
  const [mode, setMode] = useState(() => window.location.pathname.startsWith('/knowledge') ? 'knowledge' : window.location.pathname.startsWith('/live-chat') ? 'chat' : null)
  const [knowledge, setKnowledge] = useState([])
  const [chatState, setChatState] = useState({ enabled: false, items: [] })

  useEffect(() => {
    const scan = () => {
      const nextShell = document.querySelector('.prp-shell')
      setShell(nextShell instanceof HTMLElement ? nextShell : null)
      setDesktopNav(document.querySelector('.prp-header nav'))
      setMobileNav(document.querySelector('.prp-mobile-nav'))
      setContent(document.querySelector('.prp-content'))
      setSuggestionTarget(document.querySelector('.prp-request-summary'))
    }
    scan()
    const observer = new MutationObserver(scan); observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!shell) return
    Promise.allSettled([api('/api/v1/portal/knowledge'), api('/api/v1/portal/live-chat')]).then(([kb, chat]) => {
      if (kb.status === 'fulfilled') setKnowledge(kb.value.items || [])
      if (chat.status === 'fulfilled') setChatState(chat.value)
    })
  }, [shell])

  useEffect(() => {
    if (!(content instanceof HTMLElement)) return
    content.classList.toggle('production-portal-addon-mounted', Boolean(mode))
    return () => content.classList.remove('production-portal-addon-mounted')
  }, [content, mode])

  useEffect(() => {
    const nativeNavigation = (event) => {
      const button = event.target.closest?.('.prp-header nav button, .prp-mobile-nav button')
      if (button && !button.dataset.hi5PortalAddon) setMode(null)
    }
    document.addEventListener('click', nativeNavigation, true)
    return () => document.removeEventListener('click', nativeNavigation, true)
  }, [])

  function open(next) {
    setMode(next)
    window.history.replaceState({}, '', next === 'knowledge' ? '/knowledge' : '/live-chat')
  }

  if (!shell) return null

  const knowledgeButton = <button data-hi5-portal-addon="knowledge" className={mode === 'knowledge' ? 'active' : ''} onClick={() => open('knowledge')}><BookOpen size={17} /> Knowledge</button>
  const chatButton = chatState.enabled ? <button data-hi5-portal-addon="chat" className={mode === 'chat' ? 'active' : ''} onClick={() => open('chat')}><MessageCircle size={17} /> Live Chat{chatState.items?.some((item) => item.unread) ? <i className="ppx-nav-unread">{chatState.items.reduce((sum,item) => sum + Number(item.unread || 0),0)}</i> : null}</button> : null

  return <>{desktopNav ? createPortal(<>{knowledgeButton}{chatButton}</>, desktopNav) : null}{mobileNav ? createPortal(<><button data-hi5-portal-addon="knowledge" onClick={() => open('knowledge')}><BookOpen size={18} /> Knowledge</button>{chatState.enabled ? <button data-hi5-portal-addon="chat" onClick={() => open('chat')}><MessageCircle size={18} /> Live Chat</button> : null}</>, mobileNav) : null}{mode && content ? createPortal(<div className="production-portal-addon-root">{mode === 'knowledge' ? <PortalKnowledge initialItems={knowledge} onClose={() => setMode(null)} /> : <PortalLiveChat initialState={chatState} />}</div>, content) : null}{!mode && window.location.pathname === '/incident' ? <IncidentSuggestions items={knowledge} target={suggestionTarget} /> : null}</>
}
