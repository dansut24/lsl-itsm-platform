import { useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  Clock3,
  FileText,
  Headphones,
  Home,
  Inbox,
  KeyRound,
  LifeBuoy,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  PackageOpen,
  Search,
  Send,
  Sun,
  X,
} from 'lucide-react'
import { loginProfiles } from '../../data/demoData.jsx'
import { statusClass } from '../../lib/workspace.js'
import './SelfServicePortalApp.css'

function initials(value = '') {
  return String(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '??'
}

function isClosed(ticket) {
  return ['Resolved', 'Closed', 'Completed', 'Cancelled'].includes(ticket.status)
}

function customerVisibleLegacyComment(comment = '') {
  const value = String(comment)
  return /^customer comment:/i.test(value)
    || /submitted through the self-service portal/i.test(value)
    || /^system:\s*status changed/i.test(value)
}

function cleanLegacyComment(comment = '') {
  return String(comment)
    .replace(/^customer comment:\s*/i, '')
    .replace(/^system:\s*/i, '')
}

function portalRequestProgress(ticket) {
  const status = String(ticket.status || 'New')
  if (['Closed', 'Completed'].includes(status)) return 100
  if (status === 'Resolved') return 92
  if (['Review', 'Fix in Progress'].includes(status)) return 78
  if (['In Progress', 'Known Error', 'Scheduled'].includes(status)) return 58
  if (['Assigned', 'Approved', 'CAB Review', 'Under Investigation'].includes(status)) return 35
  if (['Pending', 'Pending Approval'].includes(status)) return 24
  return 12
}

export function PortalLoginScreen({
  accent,
  fillCredentials,
  loginError,
  loginForm,
  onLogin,
  setLoginForm,
  setTheme,
  tenantName,
  theme,
}) {
  const profile = loginProfiles.requester

  return (
    <main className="portal-login" data-accent={accent} data-theme={theme}>
      <section className="portal-login-card">
        <div className="portal-login-brand">
          <img src={`${import.meta.env.BASE_URL}hi5central-logo.png`} alt="Hi5Central" />
          <button className="portal-icon-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} type="button">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
        <div className="portal-login-copy">
          <span className="portal-kicker">{tenantName}</span>
          <h1>Welcome to your Help Centre</h1>
          <p>Sign in to request services, report an issue, read help articles and follow the progress of your requests.</p>
        </div>
        <form onSubmit={onLogin} className="portal-login-form">
          <label>Email address<input autoComplete="username" value={loginForm.username} onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })} placeholder={profile.username} /></label>
          <label>Password<input autoComplete="current-password" type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} placeholder="Enter your password" /></label>
          {loginError && <div className="portal-login-error"><AlertCircle size={16} />{loginError}</div>}
          <button className="portal-primary-button" type="submit"><LogIn size={17} /> Sign in</button>
        </form>
        <button className="portal-demo-credentials" onClick={() => fillCredentials('requester')} type="button">
          <KeyRound size={16} />
          <span><strong>Use demo employee</strong><small>{profile.username} · {profile.password}</small></span>
        </button>
      </section>
      <aside className="portal-login-aside">
        <div>
          <span className="portal-kicker">Self-service only</span>
          <h2>A simpler place to get help.</h2>
          <p>This portal contains only employee-facing services. Technician queues, internal notes, administration and configuration stay in the main Hi5Central tenant.</p>
        </div>
        <div className="portal-login-feature-grid">
          <span><LifeBuoy size={18} /> Report issues</span>
          <span><PackageOpen size={18} /> Request services</span>
          <span><Inbox size={18} /> Track requests</span>
          <span><BookOpen size={18} /> Find answers</span>
        </div>
      </aside>
    </main>
  )
}

function PortalRequestList({ openRequest, requests }) {
  if (!requests.length) {
    return <div className="portal-empty"><Inbox size={28} /><strong>No requests yet</strong><span>Anything you submit through this portal will appear here.</span></div>
  }
  return (
    <div className="portal-request-list">
      {requests.map((ticket) => (
        <button key={ticket.id} onClick={() => openRequest(ticket)} type="button">
          <span className="portal-request-type">{ticket.type}</span>
          <span className="portal-request-main"><strong>{ticket.title}</strong><small>{ticket.id} · Updated {ticket.updated}</small></span>
          <span className={`status-pill ${statusClass(ticket.status)}`}>{ticket.status}</span>
          <ChevronRight size={17} />
        </button>
      ))}
    </div>
  )
}

function PortalRequestDetail({ currentUser, onAddComment, onBack, request }) {
  const [comment, setComment] = useState('')
  const structured = (request.activities || []).filter((activity) => activity.kind === 'customer')
  const legacy = (request.comments || []).filter(customerVisibleLegacyComment).map((text, index) => ({
    id: `${request.id}-legacy-${index}`,
    actor: /^customer comment:/i.test(text) ? currentUser.name : 'Hi5Central',
    text: cleanLegacyComment(text),
    createdAtLabel: index === 0 ? request.updated : 'Earlier',
  }))
  const timeline = [...structured, ...legacy]
  const progress = portalRequestProgress(request)

  function submitComment(event) {
    event.preventDefault()
    if (!comment.trim()) return
    onAddComment(request.id, comment.trim())
    setComment('')
  }

  return (
    <div className="portal-detail-view">
      <button className="portal-back" onClick={onBack} type="button"><ArrowLeft size={16} /> Back to my requests</button>
      <section className="portal-detail-hero">
        <div>
          <span className="portal-kicker">{request.id} · {request.type}</span>
          <h1>{request.title}</h1>
          <p>Submitted {request.created} · Updated {request.updated}</p>
        </div>
        <span className={`status-pill ${statusClass(request.status)}`}>{request.status}</span>
      </section>
      <section className="portal-progress-card">
        <div><strong>Request progress</strong><span>{request.nextStep || 'Our support team will review your request.'}</span></div>
        <b>{progress}%</b>
        <div className="portal-progress-track"><span style={{ width: `${progress}%` }} /></div>
      </section>
      <div className="portal-detail-grid">
        <div className="portal-detail-main">
          <section className="portal-panel">
            <span className="portal-kicker">Your request</span>
            <h2>Details</h2>
            <p className="portal-detail-description">{request.description}</p>
            <div className="portal-property-grid">
              <div><span>Service</span><strong>{request.service}</strong></div>
              <div><span>Priority</span><strong>{request.priority}</strong></div>
              <div><span>Reference</span><strong>{request.id}</strong></div>
              <div><span>Status</span><strong>{request.status}</strong></div>
            </div>
          </section>
          <section className="portal-panel">
            <span className="portal-kicker">Updates</span>
            <h2>Conversation</h2>
            <form className="portal-comment-form" onSubmit={submitComment}>
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add information or reply to the support team…" />
              <div><span>Visible to you and the support team</span><button className="portal-primary-button compact" disabled={!comment.trim()} type="submit"><Send size={15} /> Send update</button></div>
            </form>
            <div className="portal-timeline">
              {timeline.length ? timeline.map((activity) => (
                <article key={activity.id}>
                  <span className="portal-avatar">{initials(activity.actor || 'Hi5Central')}</span>
                  <div><header><strong>{activity.actor || 'Hi5Central'}</strong><small>{activity.createdAtLabel || activity.created || 'Earlier'}</small></header><p>{activity.text}</p></div>
                </article>
              )) : <div className="portal-empty small"><MessageCircle size={22} /><strong>No updates yet</strong><span>Updates from the support team will appear here.</span></div>}
            </div>
          </section>
        </div>
        <aside className="portal-detail-side">
          <section className="portal-panel compact-panel">
            <CircleGauge size={20} />
            <div><span className="portal-kicker">What happens next</span><strong>{request.nextStep || 'Support team review'}</strong><p>You will see customer-facing updates here. Internal technician notes are never shown in the portal.</p></div>
          </section>
          <section className="portal-panel compact-panel">
            <Headphones size={20} />
            <div><span className="portal-kicker">Need urgent help?</span><strong>Contact the Service Desk</strong><p>For business-critical issues, use the urgent support route configured by your organisation.</p></div>
          </section>
        </aside>
      </div>
    </div>
  )
}

export function SelfServicePortalApp({
  accent,
  activeRequest,
  currentUser,
  handleLogout,
  handlePortalSubmit,
  onAddPortalComment,
  openPortalHome,
  openPortalRequest,
  portalDraft,
  portalQuery,
  portalResults,
  serviceCatalog,
  setPortalDraft,
  setPortalQuery,
  setTheme,
  tenantName,
  theme,
  tickets,
  toast,
}) {
  const [view, setView] = useState('home')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const myRequests = useMemo(() => tickets
    .filter((ticket) => ticket.requester === currentUser.name || (ticket.requesterEmail && ticket.requesterEmail === currentUser.username))
    .sort((a, b) => Number(isClosed(a)) - Number(isClosed(b))), [currentUser.name, currentUser.username, tickets])
  const openCount = myRequests.filter((ticket) => !isClosed(ticket)).length

  function navigate(nextView) {
    if (activeRequest) openPortalHome()
    setView(nextView)
    setMobileNavOpen(false)
  }

  function chooseService(item) {
    setPortalDraft({ ...portalDraft, category: item.title, title: item.title === 'Report an IT Issue' ? '' : item.title })
    setView('new')
    setMobileNavOpen(false)
  }

  if (activeRequest) {
    return (
      <div className="self-service-app" data-accent={accent} data-theme={theme}>
        <PortalHeader currentUser={currentUser} handleLogout={handleLogout} mobileNavOpen={mobileNavOpen} navigate={navigate} openCount={openCount} setMobileNavOpen={setMobileNavOpen} setTheme={setTheme} tenantName={tenantName} theme={theme} view="requests" />
        <main className="self-service-main"><PortalRequestDetail currentUser={currentUser} onAddComment={onAddPortalComment} onBack={() => { openPortalHome(); setView('requests') }} request={activeRequest} /></main>
        {toast && <div className="portal-toast"><CheckCircle2 size={17} />{toast}</div>}
      </div>
    )
  }

  return (
    <div className="self-service-app" data-accent={accent} data-theme={theme}>
      <PortalHeader currentUser={currentUser} handleLogout={handleLogout} mobileNavOpen={mobileNavOpen} navigate={navigate} openCount={openCount} setMobileNavOpen={setMobileNavOpen} setTheme={setTheme} tenantName={tenantName} theme={theme} view={view} />
      <main className="self-service-main">
        {view === 'home' && (
          <>
            <section className="portal-home-hero">
              <div><span className="portal-kicker">Hello {currentUser.name.split(' ')[0]}</span><h1>How can we help today?</h1><p>Search for an answer, report an issue or request something from your service catalogue.</p></div>
              <label className="portal-global-search"><Search size={20} /><input value={portalQuery} onChange={(event) => setPortalQuery(event.target.value)} placeholder="Search help and knowledge…" /></label>
            </section>
            <section className="portal-quick-actions">
              {serviceCatalog.slice(0, 4).map((item, index) => (
                <button key={item.title} onClick={() => chooseService(item)} type="button"><span className={`portal-action-icon action-${index + 1}`}>{index === 0 ? <AlertCircle size={22} /> : <PackageOpen size={22} />}</span><strong>{item.title}</strong><small>{item.description}</small><ChevronRight size={17} /></button>
              ))}
            </section>
            <div className="portal-home-grid">
              <section className="portal-panel">
                <div className="portal-section-heading"><div><span className="portal-kicker">My work</span><h2>Recent requests</h2></div><button onClick={() => setView('requests')} type="button">View all <ChevronRight size={15} /></button></div>
                <PortalRequestList openRequest={openPortalRequest} requests={myRequests.slice(0, 4)} />
              </section>
              <section className="portal-panel portal-help-panel">
                <span className="portal-kicker">Popular help</span><h2>Suggested articles</h2>
                <div className="portal-article-list">{portalResults.slice(0, 4).map((article) => <button key={article.title} type="button"><BookOpen size={16} /><span><strong>{article.title}</strong><small>{article.category}</small></span><ChevronRight size={15} /></button>)}</div>
              </section>
            </div>
          </>
        )}
        {view === 'requests' && (
          <section className="portal-page-section">
            <div className="portal-page-heading"><div><span className="portal-kicker">My requests</span><h1>Track your support and service requests</h1><p>Only requests raised by your account are shown here.</p></div><button className="portal-primary-button" onClick={() => setView('new')} type="button"><LifeBuoy size={17} /> New request</button></div>
            <div className="portal-request-stats"><div><strong>{openCount}</strong><span>Open</span></div><div><strong>{myRequests.length - openCount}</strong><span>Completed</span></div><div><strong>{myRequests.length}</strong><span>Total</span></div></div>
            <section className="portal-panel"><PortalRequestList openRequest={openPortalRequest} requests={myRequests} /></section>
          </section>
        )}
        {view === 'services' && (
          <section className="portal-page-section"><div className="portal-page-heading"><div><span className="portal-kicker">Service catalogue</span><h1>What do you need?</h1><p>Choose a service and we will guide you through the request.</p></div></div><div className="portal-service-grid">{serviceCatalog.map((item, index) => <button key={item.title} onClick={() => chooseService(item)} type="button"><span className={`portal-action-icon action-${(index % 4) + 1}`}><PackageOpen size={21} /></span><strong>{item.title}</strong><p>{item.description}</p><span className="portal-card-link">Start request <ChevronRight size={15} /></span></button>)}</div></section>
        )}
        {view === 'knowledge' && (
          <section className="portal-page-section"><div className="portal-page-heading"><div><span className="portal-kicker">Knowledge</span><h1>Find an answer</h1><p>Search guidance published for employees in your organisation.</p></div></div><label className="portal-global-search standalone"><Search size={20} /><input value={portalQuery} onChange={(event) => setPortalQuery(event.target.value)} placeholder="Search knowledge articles…" /></label><div className="portal-knowledge-grid">{portalResults.map((article) => <article key={article.title}><BookOpen size={20} /><span className="portal-kicker">{article.category}</span><h2>{article.title}</h2><p>{article.summary || 'Open this article for guidance and recommended steps.'}</p><button type="button">Read article <ChevronRight size={15} /></button></article>)}</div></section>
        )}
        {view === 'new' && (
          <section className="portal-page-section narrow"><button className="portal-back" onClick={() => setView('home')} type="button"><ArrowLeft size={16} /> Back</button><div className="portal-page-heading"><div><span className="portal-kicker">New request</span><h1>Tell us what you need</h1><p>Your identity is already attached to this request.</p></div></div><form className="portal-new-request" onSubmit={(event) => { handlePortalSubmit(event); setView('requests') }}><div className="portal-field-row"><label>Service<select value={portalDraft.category} onChange={(event) => setPortalDraft({ ...portalDraft, category: event.target.value })}>{serviceCatalog.map((item) => <option key={item.title}>{item.title}</option>)}</select></label><label>Urgency<select value={portalDraft.urgency} onChange={(event) => setPortalDraft({ ...portalDraft, urgency: event.target.value })}><option>High</option><option>Medium</option><option>Low</option></select></label></div><label>Summary<input value={portalDraft.title} onChange={(event) => setPortalDraft({ ...portalDraft, title: event.target.value })} placeholder="A short summary of what you need" /></label><label>Details<textarea value={portalDraft.description} onChange={(event) => setPortalDraft({ ...portalDraft, description: event.target.value })} placeholder="Add useful details, error messages, dates or anything else that will help…" /></label><div className="portal-requester-summary"><span className="portal-avatar">{currentUser.initials}</span><div><span>Requesting as</span><strong>{currentUser.name}</strong><small>{currentUser.username}</small></div></div><button className="portal-primary-button submit" type="submit"><Send size={17} /> Submit request</button></form></section>
        )}
      </main>
      {toast && <div className="portal-toast"><CheckCircle2 size={17} />{toast}</div>}
    </div>
  )
}

function PortalHeader({ currentUser, handleLogout, mobileNavOpen, navigate, openCount, setMobileNavOpen, setTheme, tenantName, theme, view }) {
  const items = [
    ['home', 'Home', Home],
    ['requests', 'My requests', Inbox],
    ['services', 'Services', PackageOpen],
    ['knowledge', 'Knowledge', BookOpen],
  ]
  return (
    <header className="self-service-header">
      <div className="self-service-brand"><img src={`${import.meta.env.BASE_URL}hi5central-logo.png`} alt="Hi5Central" /><span><strong>{tenantName}</strong><small>Help Centre</small></span></div>
      <nav className={mobileNavOpen ? 'open' : ''}>{items.map(([id, label, Icon]) => <button className={view === id ? 'active' : ''} key={id} onClick={() => navigate(id)} type="button"><Icon size={16} />{label}{id === 'requests' && openCount > 0 && <b>{openCount}</b>}</button>)}<button className="mobile-only portal-signout" onClick={handleLogout} type="button"><LogOut size={16} /> Sign out</button></nav>
      <div className="self-service-actions"><button className="portal-icon-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} type="button">{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</button><button className="portal-user-button" onClick={handleLogout} type="button"><span>{currentUser.initials}</span><div><strong>{currentUser.name}</strong><small>Sign out</small></div><LogOut size={14} /></button><button className="portal-mobile-menu" onClick={() => setMobileNavOpen((open) => !open)} type="button">{mobileNavOpen ? <X size={20} /> : <Menu size={20} />}</button></div>
    </header>
  )
}
