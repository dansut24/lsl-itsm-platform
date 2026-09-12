import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  AtSign,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  Clock3,
  Download,
  FileText,
  FileUp,
  Headphones,
  Home,
  Inbox,
  KeyRound,
  LifeBuoy,
  Link2,
  LockKeyhole,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  PackageOpen,
  Paperclip,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Sun,
  Table2,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  X,
} from 'lucide-react'
import { loginProfiles } from '../../data/demoData.jsx'
import {
  portalCatalogueCost,
  portalFieldVisible,
  portalRequestInformation,
  portalServiceCatalog,
} from '../../data/portalData.js'
import { statusClass } from '../../lib/workspace.js'
import { readLocalAttachment, removeLocalAttachment, storeLocalAttachment } from '../../services/localAttachmentStore.js'
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

function formatMoney(value) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(Number(value || 0))
}

function fileSize(bytes = 0) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const allowedRichTags = new Set([
  'A', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'DIV', 'EM', 'H1', 'H2', 'H3', 'HR', 'I', 'IMG',
  'LI', 'OL', 'P', 'PRE', 'S', 'SPAN', 'STRONG', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH',
  'THEAD', 'TR', 'U', 'UL',
])

function sanitizeRichHtml(html = '') {
  if (typeof document === 'undefined') return String(html || '')
  const template = document.createElement('template')
  template.innerHTML = String(html || '')

  const sanitizeNode = (node) => {
    Array.from(node.children || []).forEach((child) => {
      if (!allowedRichTags.has(child.tagName)) {
        sanitizeNode(child)
        child.replaceWith(...Array.from(child.childNodes))
        return
      }
      Array.from(child.attributes).forEach((attribute) => {
        const name = attribute.name.toLowerCase()
        const value = attribute.value || ''
        const allowed = ['href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'target'].includes(name)
        if (!allowed || name.startsWith('on')) child.removeAttribute(attribute.name)
        if ((name === 'href' || name === 'src') && /^javascript:/i.test(value.trim())) child.removeAttribute(attribute.name)
      })
      if (child.tagName === 'A') {
        child.setAttribute('target', '_blank')
        child.setAttribute('rel', 'noreferrer')
      }
      sanitizeNode(child)
    })
  }

  sanitizeNode(template.content)
  return template.innerHTML
}

function htmlToText(html = '') {
  if (typeof document === 'undefined') return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const template = document.createElement('template')
  template.innerHTML = sanitizeRichHtml(html)
  return (template.content.textContent || '').replace(/\s+/g, ' ').trim()
}

function insertHtml(html) {
  if (typeof document === 'undefined') return
  document.execCommand('insertHTML', false, sanitizeRichHtml(html))
}

function portalActivityVisible(activity) {
  return activity?.kind === 'customer' || activity?.visibility === 'customer' || activity?.source === 'self-service-portal'
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

function PortalAttachment({ attachment, imagePreview = false }) {
  const [url, setUrl] = useState(attachment?.dataUrl || '')

  useEffect(() => {
    let mounted = true
    let objectUrl = ''
    if (!attachment?.storageKey || attachment?.dataUrl) return undefined
    readLocalAttachment(attachment.storageKey)
      .then((blob) => {
        if (!mounted || !blob) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {})
    return () => {
      mounted = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachment?.dataUrl, attachment?.storageKey])

  if (!attachment) return null
  const isImage = String(attachment.type || '').startsWith('image/')
  if (imagePreview && isImage && url) {
    return (
      <a className="portal-rich-image" href={url} target="_blank" rel="noreferrer">
        <img alt={attachment.name} src={url} />
        <span>{attachment.name}</span>
      </a>
    )
  }

  return (
    <a className="portal-rich-file" href={url || undefined} download={attachment.name} target={url ? '_blank' : undefined} rel="noreferrer">
      <FileText size={16} />
      <span><strong>{attachment.name}</strong><small>{fileSize(attachment.size)} · {attachment.type || 'File'}</small></span>
      <Download size={15} />
    </a>
  )
}

function PortalRichComposer({
  compact = false,
  onChange,
  onSubmit,
  placeholder = 'Add details…',
  submitLabel = 'Send update',
}) {
  const editorRef = useRef(null)
  const fileInputRef = useRef(null)
  const [files, setFiles] = useState([])
  const [plainText, setPlainText] = useState('')

  function emit(nextFiles = files) {
    const html = sanitizeRichHtml(editorRef.current?.innerHTML || '')
    const text = htmlToText(html)
    setPlainText(text)
    onChange?.({ html, text, attachments: nextFiles })
  }

  async function queueFiles(fileList) {
    const queued = []
    for (const file of Array.from(fileList || [])) {
      const storageKey = `portal-${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`
      try {
        await storeLocalAttachment(storageKey, file)
      } catch {
        // Keep metadata even when browser storage is unavailable.
      }
      queued.push({
        id: `PORTAL-FILE-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name || 'Clipboard attachment',
        size: Number(file.size || 0),
        type: file.type || 'application/octet-stream',
        storageKey,
        uploaded: 'Just now',
        uploadedBy: 'Requester',
        visibility: 'customer',
      })
    }
    if (!queued.length) return
    const next = [...files, ...queued]
    setFiles(next)
    emit(next)
  }

  async function removeFile(file) {
    if (file.storageKey) {
      try { await removeLocalAttachment(file.storageKey) } catch {}
    }
    const next = files.filter((item) => item.id !== file.id)
    setFiles(next)
    emit(next)
  }

  async function handlePaste(event) {
    const clipboard = event.clipboardData
    const clipboardFiles = Array.from(clipboard?.files || [])
    if (clipboardFiles.length) {
      event.preventDefault()
      await queueFiles(clipboardFiles)
      return
    }

    const html = clipboard?.getData('text/html')
    if (html) {
      event.preventDefault()
      insertHtml(html)
      window.setTimeout(() => emit(files), 0)
    }
  }

  function exec(command, value) {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    emit(files)
  }

  function insertTable() {
    editorRef.current?.focus()
    insertHtml('<table><tbody><tr><th>Column 1</th><th>Column 2</th></tr><tr><td>Value</td><td>Value</td></tr></tbody></table><p><br></p>')
    emit(files)
  }

  function submit(event) {
    event?.preventDefault()
    const payload = {
      html: sanitizeRichHtml(editorRef.current?.innerHTML || ''),
      text: htmlToText(editorRef.current?.innerHTML || ''),
      attachments: files,
    }
    if (!payload.text && !payload.attachments.length) return
    onSubmit?.(payload)
    if (editorRef.current) editorRef.current.innerHTML = ''
    setFiles([])
    setPlainText('')
    onChange?.({ html: '', text: '', attachments: [] })
  }

  return (
    <div
      className={`portal-rich-composer ${compact ? 'compact' : ''}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={async (event) => { event.preventDefault(); await queueFiles(event.dataTransfer?.files) }}
    >
      <div className="portal-rich-toolbar">
        <button aria-label="Bold" onClick={() => exec('bold')} type="button"><strong>B</strong></button>
        <button aria-label="Bulleted list" onClick={() => exec('insertUnorderedList')} type="button">• List</button>
        <button aria-label="Insert link" onClick={() => { const url = window.prompt('Paste a link'); if (url) exec('createLink', url) }} type="button"><Link2 size={15} /></button>
        <button aria-label="Insert table" onClick={insertTable} type="button"><Table2 size={15} /></button>
        <span />
        <button aria-label="Attach files" onClick={() => fileInputRef.current?.click()} type="button"><FileUp size={15} /> Attach</button>
        <input hidden multiple ref={fileInputRef} type="file" onChange={async (event) => { await queueFiles(event.target.files); event.target.value = '' }} />
      </div>
      <div className="portal-rich-editor-shell">
        {!plainText && !editorRef.current?.innerText && <span className="portal-rich-placeholder">{placeholder}</span>}
        <div
          aria-label="Rich text details"
          className="portal-rich-editor"
          contentEditable
          onInput={() => emit(files)}
          onPaste={handlePaste}
          ref={editorRef}
          role="textbox"
          suppressContentEditableWarning
        />
      </div>
      {files.length > 0 && (
        <div className="portal-rich-pending">
          {files.map((file) => (
            <div key={file.id}>
              <Paperclip size={14} />
              <span><strong>{file.name}</strong><small>{fileSize(file.size)}</small></span>
              <button aria-label={`Remove ${file.name}`} onClick={() => removeFile(file)} type="button"><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="portal-rich-help">
        <span>Paste screenshots, files, formatted text or tables directly here. You can also drag files into this box.</span>
        {onSubmit && <button className="portal-primary-button compact" disabled={!plainText && !files.length} onClick={submit} type="button"><Send size={15} /> {submitLabel}</button>}
      </div>
    </div>
  )
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
          <p>Sign in to request services, report an issue, read help articles, chat with support and follow your requests.</p>
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
          <span><MessageCircle size={18} /> Live support</span>
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

function PortalActivityBody({ activity }) {
  const html = sanitizeRichHtml(activity.html || '')
  return (
    <>
      {html ? <div className="portal-rich-content" dangerouslySetInnerHTML={{ __html: html }} /> : <p>{activity.text}</p>}
      {!!activity.attachments?.length && (
        <div className="portal-activity-files">
          {activity.attachments.map((attachment) => <PortalAttachment attachment={attachment} imagePreview key={attachment.id || attachment.name} />)}
        </div>
      )}
    </>
  )
}

function PortalRequestDetail({ currentUser, onAddComment, onBack, request }) {
  const structured = (request.activities || []).filter(portalActivityVisible)
  const legacy = (request.comments || []).filter(customerVisibleLegacyComment).map((text, index) => ({
    id: `${request.id}-legacy-${index}`,
    actor: /^customer comment:/i.test(text) ? currentUser.name : 'Hi5Central',
    text: cleanLegacyComment(text),
    createdAtLabel: index === 0 ? request.updated : 'Earlier',
    attachments: [],
  }))
  const timeline = [...structured, ...legacy]
  const progress = portalRequestProgress(request)
  const cost = (request.requestedItems || []).reduce((sum, item) => sum + Number(item.unitCost || 0) * Number(item.quantity || 1), 0)

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
            {request.descriptionHtml
              ? <div className="portal-rich-content portal-detail-description" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(request.descriptionHtml) }} />
              : <p className="portal-detail-description">{request.description}</p>}
            <div className="portal-property-grid">
              <div><span>Service</span><strong>{request.service}</strong></div>
              <div><span>Priority</span><strong>{request.priority}</strong></div>
              <div><span>Reference</span><strong>{request.id}</strong></div>
              <div><span>Status</span><strong>{request.status}</strong></div>
            </div>
            {!!request.requestInformation?.length && (
              <div className="portal-submitted-fields">
                {request.requestInformation.map((item, index) => <div key={`${item.label}-${index}`}><span>{item.label}</span><strong>{item.value}</strong></div>)}
              </div>
            )}
          </section>

          {!!request.requestedItems?.length && (
            <section className="portal-panel">
              <span className="portal-kicker">Catalogue</span>
              <h2>Requested items</h2>
              <div className="portal-requested-items">
                {request.requestedItems.map((item) => (
                  <article key={item.id || item.name}>
                    <div><strong>{item.name}</strong><small>{item.category}{item.recurring ? ` · ${item.recurring}` : ''}</small></div>
                    <b>{formatMoney(Number(item.unitCost || 0) * Number(item.quantity || 1))}{item.recurring === 'monthly' ? '/mo' : ''}</b>
                  </article>
                ))}
                <footer><span>Captured cost</span><strong>{formatMoney(cost)}</strong></footer>
              </div>
            </section>
          )}

          {!!request.requestApprovals?.length && (
            <section className="portal-panel">
              <span className="portal-kicker">Approvals</span>
              <h2>Approval progress</h2>
              <div className="portal-approval-mini-list">
                {request.requestApprovals.map((approval) => <div key={approval.id}><span className={`status-pill ${statusClass(approval.status)}`}>{approval.status}</span><span><strong>{approval.label}</strong><small>{approval.approver} · {approval.updated}</small></span></div>)}
              </div>
            </section>
          )}

          <section className="portal-panel">
            <span className="portal-kicker">Updates</span>
            <h2>Conversation</h2>
            <PortalRichComposer compact onSubmit={(payload) => onAddComment(request.id, payload)} placeholder="Add information or reply to the support team… Paste screenshots, files or tables here." />
            <div className="portal-timeline">
              {timeline.length ? timeline.map((activity) => (
                <article key={activity.id}>
                  <span className="portal-avatar">{initials(activity.actor || 'Hi5Central')}</span>
                  <div>
                    <header><strong>{activity.actor || 'Hi5Central'}</strong><small>{activity.createdAtLabel || activity.created || 'Earlier'}</small></header>
                    <PortalActivityBody activity={activity} />
                  </div>
                </article>
              )) : <div className="portal-empty small"><MessageCircle size={22} /><strong>No updates yet</strong><span>Customer-facing updates from the support team will appear here.</span></div>}
            </div>
          </section>
        </div>

        <aside className="portal-detail-side">
          <section className="portal-panel compact-panel">
            <CircleGauge size={20} />
            <div><span className="portal-kicker">What happens next</span><strong>{request.nextStep || 'Support team review'}</strong><p>Only customer-facing updates appear here. Technician work notes and internal activity are never exposed.</p></div>
          </section>
          <section className="portal-panel compact-panel">
            <Headphones size={20} />
            <div><span className="portal-kicker">Need more help?</span><strong>Live chat with the Service Desk</strong><p>You can start a separate live support conversation from the Live chat area.</p></div>
          </section>
          {!!request.attachments?.length && (
            <section className="portal-panel">
              <span className="portal-kicker">Files</span>
              <h2>Attachments</h2>
              <div className="portal-attachment-stack">{request.attachments.filter((file) => file.visibility !== 'internal').map((file) => <PortalAttachment attachment={file} key={file.id || file.name} />)}</div>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function CatalogueField({ field, value, onChange }) {
  if (field.type === 'textarea') {
    return <label className="portal-catalogue-field wide">{field.label}{field.required && <b>*</b>}<textarea value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder || ''} /></label>
  }

  if (field.type === 'select') {
    return (
      <label className="portal-catalogue-field">{field.label}{field.required && <b>*</b>}
        <select value={value || ''} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select…</option>
          {field.options.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
    )
  }

  if (field.type === 'product') {
    return (
      <label className="portal-catalogue-field">{field.label}{field.required && <b>*</b>}
        <select value={value || ''} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select…</option>
          {field.options.map((option) => <option key={option.value} value={option.value}>{option.label} · {formatMoney(option.cost)}{option.recurring === 'monthly' ? '/mo' : ''}</option>)}
        </select>
      </label>
    )
  }

  if (field.type === 'checkbox-products') {
    const selected = Array.isArray(value) ? value : []
    return (
      <fieldset className="portal-catalogue-field portal-product-checks wide">
        <legend>{field.label}</legend>
        {field.options.map((option) => (
          <label key={option.value}>
            <input checked={selected.includes(option.value)} onChange={(event) => onChange(event.target.checked ? [...selected, option.value] : selected.filter((item) => item !== option.value))} type="checkbox" />
            <span><strong>{option.label}</strong><small>{formatMoney(option.cost)}</small></span>
          </label>
        ))}
      </fieldset>
    )
  }

  return <label className="portal-catalogue-field">{field.label}{field.required && <b>*</b>}<input type={field.type || 'text'} value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder || ''} /></label>
}

function PortalNewRequest({ currentUser, initialItem, onBack, onSubmit }) {
  const [catalogueId, setCatalogueId] = useState(initialItem?.id || portalServiceCatalog[0].id)
  const [values, setValues] = useState({})
  const [summary, setSummary] = useState(initialItem?.requestType === 'Incident' ? '' : initialItem?.title || '')
  const [urgency, setUrgency] = useState(initialItem?.basePriority || 'Medium')
  const [details, setDetails] = useState({ html: '', text: '', attachments: [] })
  const [error, setError] = useState('')
  const item = portalServiceCatalog.find((candidate) => candidate.id === catalogueId) || portalServiceCatalog[0]
  const visibleFields = item.fields.filter((field) => portalFieldVisible(field, values))
  const pricing = portalCatalogueCost(item, values)

  useEffect(() => {
    setValues({})
    setSummary(item.requestType === 'Incident' ? '' : item.title)
    setUrgency(item.basePriority || 'Medium')
    setDetails({ html: '', text: '', attachments: [] })
    setError('')
  }, [catalogueId])

  function submit(event) {
    event.preventDefault()
    const missing = visibleFields.filter((field) => field.required && (
      Array.isArray(values[field.id]) ? values[field.id].length === 0 : !String(values[field.id] || '').trim()
    ))
    if (!summary.trim()) {
      setError('Add a short summary before submitting.')
      return
    }
    if (missing.length) {
      setError(`Complete the required field${missing.length > 1 ? 's' : ''}: ${missing.map((field) => field.label).join(', ')}.`)
      return
    }
    onSubmit({
      catalogueItem: item,
      summary: summary.trim(),
      urgency,
      fields: values,
      requestInformation: portalRequestInformation(item, values),
      requestedItems: pricing.items,
      oneOffCost: pricing.oneOff,
      monthlyCost: pricing.monthly,
      details,
    })
  }

  return (
    <section className="portal-page-section narrow portal-new-request-page">
      <button className="portal-back" onClick={onBack} type="button"><ArrowLeft size={16} /> Back to services</button>
      <div className="portal-page-heading">
        <div><span className="portal-kicker">New request</span><h1>Tell us what you need</h1><p>Your identity is already attached. The form changes automatically for the selected service.</p></div>
      </div>

      <form className="portal-new-request enhanced" onSubmit={submit}>
        <section className="portal-form-section">
          <div className="portal-form-section-heading"><span>1</span><div><strong>Choose service</strong><small>Select the request that best matches what you need.</small></div></div>
          <label>Service
            <select value={catalogueId} onChange={(event) => setCatalogueId(event.target.value)}>
              {portalServiceCatalog.map((catalogueItem) => <option key={catalogueItem.id} value={catalogueItem.id}>{catalogueItem.title}</option>)}
            </select>
          </label>
          <div className="portal-service-selected"><PackageOpen size={20} /><span><strong>{item.title}</strong><small>{item.description}</small></span></div>
        </section>

        <section className="portal-form-section">
          <div className="portal-form-section-heading"><span>2</span><div><strong>Request information</strong><small>Fields below are specific to {item.title}.</small></div></div>
          <div className="portal-dynamic-field-grid">
            {visibleFields.map((field) => <CatalogueField field={field} key={field.id} value={values[field.id]} onChange={(value) => setValues((current) => ({ ...current, [field.id]: value }))} />)}
          </div>
          {(pricing.oneOff > 0 || pricing.monthly > 0) && (
            <div className="portal-cost-summary">
              <ShoppingCart size={18} />
              <span><strong>Estimated catalogue cost</strong><small>Captured on the request at the time you submit it.</small></span>
              <b>{pricing.oneOff > 0 && formatMoney(pricing.oneOff)}{pricing.oneOff > 0 && pricing.monthly > 0 ? ' + ' : ''}{pricing.monthly > 0 && `${formatMoney(pricing.monthly)}/mo`}</b>
            </div>
          )}
        </section>

        <section className="portal-form-section">
          <div className="portal-form-section-heading"><span>3</span><div><strong>Summary and details</strong><small>Paste screenshots, files, copied tables or formatted information directly into the details box.</small></div></div>
          <div className="portal-field-row">
            <label>Summary<input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="A short summary of what you need" /></label>
            <label>Urgency<select value={urgency} onChange={(event) => setUrgency(event.target.value)}><option>High</option><option>Medium</option><option>Low</option></select></label>
          </div>
          <PortalRichComposer key={catalogueId} onChange={setDetails} placeholder="Add useful details, error messages, copied tables, screenshots or supporting files…" submitLabel="" />
        </section>

        <section className="portal-form-section portal-requester-footer">
          <div className="portal-requester-summary"><span className="portal-avatar">{currentUser.initials}</span><div><span>Requesting as</span><strong>{currentUser.name}</strong><small>{currentUser.username}</small></div></div>
          {item.approval !== 'none' && <div className="portal-approval-warning"><ShieldCheck size={17} /><span><strong>Approval may be required</strong><small>Hi5Central will route the request automatically after submission.</small></span></div>}
        </section>
        {error && <div className="portal-form-error"><AlertCircle size={16} />{error}</div>}
        <button className="portal-primary-button submit" type="submit"><Send size={17} /> Submit request</button>
      </form>
    </section>
  )
}

function PortalKnowledge({ articles, query, setQuery, onStartRequest }) {
  const [article, setArticle] = useState(null)
  const [feedback, setFeedback] = useState('')

  if (article) {
    return (
      <section className="portal-page-section narrow portal-article-reader">
        <button className="portal-back" onClick={() => { setArticle(null); setFeedback('') }} type="button"><ArrowLeft size={16} /> Back to knowledge</button>
        <article className="portal-panel portal-article-full">
          <span className="portal-kicker">{article.category}</span>
          <h1>{article.title}</h1>
          <div className="portal-article-meta"><span>{article.updated}</span><span>{article.reads?.toLocaleString('en-GB') || 0} views</span></div>
          <p className="portal-article-summary">{article.summary}</p>
          {!!article.steps?.length && <ol>{article.steps.map((step) => <li key={step}>{step}</li>)}</ol>}
          {!!article.body?.length && article.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <div className="portal-article-feedback">
            <strong>Was this helpful?</strong>
            <div><button className={feedback === 'yes' ? 'active' : ''} onClick={() => setFeedback('yes')} type="button"><ThumbsUp size={15} /> Yes</button><button className={feedback === 'no' ? 'active' : ''} onClick={() => setFeedback('no')} type="button"><ThumbsDown size={15} /> Not really</button></div>
            {feedback && <small>Thanks — your feedback has been recorded for this prototype.</small>}
          </div>
        </article>
        <section className="portal-panel portal-still-need-help"><LifeBuoy size={22} /><div><strong>Still need help?</strong><span>Raise a request and include anything you already tried from this article.</span></div><button className="portal-primary-button compact" onClick={onStartRequest} type="button">Create request</button></section>
      </section>
    )
  }

  return (
    <section className="portal-page-section">
      <div className="portal-page-heading"><div><span className="portal-kicker">Knowledge</span><h1>Find an answer</h1><p>Search guidance published for employees in your organisation.</p></div></div>
      <label className="portal-global-search standalone"><Search size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, topics, summaries and guidance…" /></label>
      <div className="portal-knowledge-grid">
        {articles.map((item) => <article key={item.slug || item.title}><BookOpen size={20} /><span className="portal-kicker">{item.category}</span><h2>{item.title}</h2><p>{item.summary || 'Open this article for guidance and recommended steps.'}</p><button onClick={() => setArticle(item)} type="button">Read article <ChevronRight size={15} /></button></article>)}
      </div>
      {!articles.length && <div className="portal-empty"><Search size={26} /><strong>No matching articles</strong><span>Try a different phrase or raise a request if you still need help.</span></div>}
    </section>
  )
}

function PortalApprovals({ currentUser, onDecision, tickets }) {
  const [reason, setReason] = useState({})
  const approvals = tickets.flatMap((ticket) => (ticket.requestApprovals || [])
    .filter((approval) => approval.approver === currentUser.name || approval.approverEmail === currentUser.username || approval.approverId === currentUser.personId)
    .map((approval) => ({ ticket, approval })))
  const pending = approvals.filter(({ approval }) => approval.status === 'Pending')
  const history = approvals.filter(({ approval }) => approval.status !== 'Pending')

  return (
    <section className="portal-page-section">
      <div className="portal-page-heading"><div><span className="portal-kicker">Approvals</span><h1>Requests awaiting your decision</h1><p>Approve or reject requests that have been routed to you. You only see approvals assigned to your account.</p></div></div>
      <div className="portal-request-stats"><div><strong>{pending.length}</strong><span>Awaiting you</span></div><div><strong>{history.filter(({ approval }) => approval.status === 'Approved').length}</strong><span>Approved</span></div><div><strong>{history.filter(({ approval }) => approval.status === 'Rejected').length}</strong><span>Rejected</span></div></div>
      <div className="portal-approval-list">
        {pending.map(({ ticket, approval }) => {
          const total = (ticket.requestedItems || []).reduce((sum, item) => sum + Number(item.unitCost || 0) * Number(item.quantity || 1), 0)
          return (
            <article className="portal-panel" key={approval.id}>
              <header><div><span className="portal-kicker">{ticket.id} · {approval.label}</span><h2>{ticket.title}</h2><p>Requested by {ticket.requester} · {ticket.service}</p></div><span className={`status-pill ${statusClass(approval.status)}`}>{approval.status}</span></header>
              {!!ticket.requestedItems?.length && <div className="portal-approval-items">{ticket.requestedItems.map((item) => <span key={item.id || item.name}><strong>{item.name}</strong><small>{formatMoney(item.unitCost)}{item.recurring === 'monthly' ? '/mo' : ''}</small></span>)}<b>Total {formatMoney(total)}</b></div>}
              <p className="portal-detail-description">{ticket.description}</p>
              <label className="portal-approval-reason">Decision note (optional)<textarea value={reason[approval.id] || ''} onChange={(event) => setReason((current) => ({ ...current, [approval.id]: event.target.value }))} placeholder="Add context for the requester and fulfilment team…" /></label>
              <footer><button className="portal-secondary-button danger" onClick={() => onDecision(ticket.id, approval.id, 'Rejected', reason[approval.id] || '')} type="button"><X size={15} /> Reject</button><button className="portal-primary-button compact" onClick={() => onDecision(ticket.id, approval.id, 'Approved', reason[approval.id] || '')} type="button"><CheckCircle2 size={15} /> Approve</button></footer>
            </article>
          )
        })}
        {!pending.length && <div className="portal-empty portal-panel"><ShieldCheck size={28} /><strong>You are all caught up</strong><span>New approval requests assigned to you will appear here.</span></div>}
      </div>
      {!!history.length && <section className="portal-panel portal-approval-history"><span className="portal-kicker">Recent decisions</span><h2>Approval history</h2>{history.slice(0, 8).map(({ ticket, approval }) => <div key={approval.id}><span><strong>{ticket.title}</strong><small>{ticket.id} · {approval.updated}</small></span><span className={`status-pill ${statusClass(approval.status)}`}>{approval.status}</span></div>)}</section>}
    </section>
  )
}

function PortalLiveChat({ conversations, currentUser, onSend, onStart }) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')
  const matching = conversations
    .filter((conversation) => conversation.participant?.name === currentUser.name || conversation.participant?.email === currentUser.username)
    .sort((a, b) => (a.status === 'Closed') - (b.status === 'Closed'))
  const active = matching.find((conversation) => conversation.status !== 'Closed') || matching[0]

  function start(event) {
    event.preventDefault()
    if (!subject.trim() || !message.trim()) return
    onStart({ subject: subject.trim(), message: message.trim() })
    setSubject('')
    setMessage('')
  }

  function send(event) {
    event.preventDefault()
    if (!active || !reply.trim()) return
    onSend(active.id, reply.trim())
    setReply('')
  }

  return (
    <section className="portal-page-section portal-chat-page">
      <div className="portal-page-heading"><div><span className="portal-kicker">Live support</span><h1>Chat with the Service Desk</h1><p>Start a real-time support conversation without exposing technician tools or internal notes.</p></div></div>
      {active && active.status !== 'Closed' ? (
        <div className="portal-chat-shell">
          <header><div><span className="portal-avatar">SD</span><span><strong>Service Desk</strong><small>{active.assignedTo ? `Chatting with ${active.assignedTo}` : 'Waiting for an available technician'}</small></span></div><span className={`portal-chat-state ${active.status.toLowerCase()}`}>{active.status}</span></header>
          <div className="portal-chat-subject"><span>Topic</span><strong>{active.subject}</strong></div>
          <div className="portal-chat-messages">
            {active.messages.map((item) => (
              <div className={`portal-chat-message ${item.sender}`} key={item.id}>
                <span>{item.sender === 'requester' ? currentUser.initials : item.sender === 'agent' ? 'SD' : '•'}</span>
                <div><p>{item.text}</p><small>{item.time}</small></div>
              </div>
            ))}
          </div>
          <form className="portal-chat-reply" onSubmit={send}><input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Type a message…" /><button className="portal-primary-button compact" disabled={!reply.trim()} type="submit"><Send size={15} /> Send</button></form>
        </div>
      ) : (
        <form className="portal-panel portal-chat-start" onSubmit={start}>
          <Headphones size={28} />
          <span className="portal-kicker">Start a conversation</span>
          <h2>What can we help with?</h2>
          <label>Topic<input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="e.g. VPN won't connect" /></label>
          <label>Message<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell the Service Desk what is happening…" /></label>
          <button className="portal-primary-button" disabled={!subject.trim() || !message.trim()} type="submit"><MessageCircle size={16} /> Start live chat</button>
          {matching.length > 0 && <small>Your previous closed conversations remain stored in the technician chat history.</small>}
        </form>
      )}
    </section>
  )
}

function loadPortalPreferences() {
  try {
    const stored = window.localStorage.getItem('hi5central-portal-preferences-v1')
    return stored ? JSON.parse(stored) : { emailUpdates: true, approvalAlerts: true, chatAlerts: true }
  } catch {
    return { emailUpdates: true, approvalAlerts: true, chatAlerts: true }
  }
}

function PortalProfile({ currentPerson, departments, onSaveProfile, teams }) {
  const [form, setForm] = useState({ phone: currentPerson?.phone || '', location: currentPerson?.location || '' })
  const [preferences, setPreferences] = useState(loadPortalPreferences)
  const managedFields = new Set(currentPerson?.directorySource?.managedFields || [])
  const department = departments.find((item) => item.id === currentPerson?.departmentId)
  const team = teams.find((item) => item.id === currentPerson?.teamId)

  useEffect(() => {
    setForm({ phone: currentPerson?.phone || '', location: currentPerson?.location || '' })
  }, [currentPerson?.id, currentPerson?.phone, currentPerson?.location])

  useEffect(() => {
    try { window.localStorage.setItem('hi5central-portal-preferences-v1', JSON.stringify(preferences)) } catch {}
  }, [preferences])

  return (
    <section className="portal-page-section narrow">
      <div className="portal-page-heading"><div><span className="portal-kicker">Profile & preferences</span><h1>Your account</h1><p>View your organisational profile and manage employee-controlled contact details and portal preferences.</p></div></div>
      <div className="portal-profile-grid">
        <section className="portal-panel">
          <div className="portal-profile-heading"><span className="portal-avatar large">{currentPerson?.initials || initials(currentPerson?.name)}</span><div><h2>{currentPerson?.name}</h2><p>{currentPerson?.role}</p></div></div>
          <div className="portal-readonly-profile">
            <div><span>Email</span><strong>{currentPerson?.email}</strong>{managedFields.has('email') && <small><LockKeyhole size={12} /> Managed by {currentPerson?.directorySource?.label || 'integration'}</small>}</div>
            <div><span>Department</span><strong>{department?.name || 'Not set'}</strong>{managedFields.has('departmentId') && <small><LockKeyhole size={12} /> Managed externally</small>}</div>
            <div><span>Team</span><strong>{team?.name || currentPerson?.team || 'Not set'}</strong>{managedFields.has('teamId') && <small><LockKeyhole size={12} /> Managed externally</small>}</div>
          </div>
          <div className="portal-editable-profile">
            <label>Phone<input disabled={managedFields.has('phone')} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
            <label>Working location<input disabled={managedFields.has('location')} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
          </div>
          <button className="portal-primary-button compact" onClick={() => onSaveProfile({ phone: form.phone, location: form.location })} type="button"><UserRound size={15} /> Save profile</button>
        </section>
        <section className="portal-panel">
          <span className="portal-kicker">Notifications</span><h2>Portal preferences</h2>
          <div className="portal-preference-list">
            {[
              ['emailUpdates', 'Request updates by email', 'Receive customer-facing updates and resolution notifications.'],
              ['approvalAlerts', 'Approval alerts', 'Tell me when a request needs my approval.'],
              ['chatAlerts', 'Live chat alerts', 'Show alerts when the Service Desk replies to a live chat.'],
            ].map(([key, label, description]) => (
              <label key={key}><span><strong>{label}</strong><small>{description}</small></span><input checked={Boolean(preferences[key])} onChange={(event) => setPreferences({ ...preferences, [key]: event.target.checked })} type="checkbox" /></label>
            ))}
          </div>
          <div className="portal-integration-note"><Settings2 size={17} /><span><strong>Integration-aware profile</strong><small>Fields owned by a directory or HR integration stay read-only here so the source of truth is not overwritten.</small></span></div>
        </section>
      </div>
    </section>
  )
}

export function SelfServicePortalApp({
  accent,
  activeRequest,
  currentPerson,
  currentUser = loginProfiles.requester,
  departments = [],
  handleLogout,
  handlePortalSubmit,
  liveChatConversations = [],
  onAddPortalComment,
  onPortalApprovalDecision,
  onPortalChatSend,
  onPortalChatStart,
  onUpdatePortalProfile,
  openPortalHome,
  openPortalRequest,
  portalQuery = '',
  portalResults = [],
  setPortalQuery,
  setTheme,
  teams = [],
  tenantName,
  theme,
  tickets = [],
  toast,
}) {
  const [view, setView] = useState('home')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [selectedCatalogueItem, setSelectedCatalogueItem] = useState(null)
  const [serviceQuery, setServiceQuery] = useState('')
  const [serviceCategory, setServiceCategory] = useState('All')

  const myRequests = useMemo(() => tickets
    .filter((ticket) => ticket.requester === currentUser.name || (ticket.requesterEmail && ticket.requesterEmail === currentUser.username))
    .sort((a, b) => Number(isClosed(a)) - Number(isClosed(b))), [currentUser.name, currentUser.username, tickets])
  const openCount = myRequests.filter((ticket) => !isClosed(ticket)).length
  const approvalCount = tickets.reduce((count, ticket) => count + (ticket.requestApprovals || []).filter((approval) => approval.status === 'Pending' && (approval.approver === currentUser.name || approval.approverEmail === currentUser.username || approval.approverId === currentUser.personId)).length, 0)
  const liveChatCount = liveChatConversations.filter((conversation) => (conversation.participant?.name === currentUser.name || conversation.participant?.email === currentUser.username) && conversation.status !== 'Closed').length

  const serviceCategories = ['All', ...new Set(portalServiceCatalog.map((item) => item.category))]
  const filteredServices = portalServiceCatalog.filter((item) => {
    const queryMatch = !serviceQuery.trim() || [item.title, item.description, item.category, item.service].join(' ').toLowerCase().includes(serviceQuery.trim().toLowerCase())
    return queryMatch && (serviceCategory === 'All' || item.category === serviceCategory)
  })

  function navigate(nextView) {
    if (activeRequest) openPortalHome()
    setView(nextView)
    setMobileNavOpen(false)
  }

  function chooseService(item) {
    setSelectedCatalogueItem(item)
    setView('new')
    setMobileNavOpen(false)
  }

  function submitRequest(payload) {
    handlePortalSubmit(payload)
    setView('requests')
    setSelectedCatalogueItem(null)
  }

  if (activeRequest) {
    return (
      <div className="self-service-app" data-accent={accent} data-theme={theme}>
        <PortalHeader approvalCount={approvalCount} currentUser={currentUser} handleLogout={handleLogout} liveChatCount={liveChatCount} mobileNavOpen={mobileNavOpen} navigate={navigate} openCount={openCount} setMobileNavOpen={setMobileNavOpen} setTheme={setTheme} tenantName={tenantName} theme={theme} view="requests" />
        <main className="self-service-main"><PortalRequestDetail currentUser={currentUser} onAddComment={onAddPortalComment} onBack={() => { openPortalHome(); setView('requests') }} request={activeRequest} /></main>
        {toast && <div className="portal-toast"><CheckCircle2 size={17} />{toast}</div>}
      </div>
    )
  }

  return (
    <div className="self-service-app" data-accent={accent} data-theme={theme}>
      <PortalHeader approvalCount={approvalCount} currentUser={currentUser} handleLogout={handleLogout} liveChatCount={liveChatCount} mobileNavOpen={mobileNavOpen} navigate={navigate} openCount={openCount} setMobileNavOpen={setMobileNavOpen} setTheme={setTheme} tenantName={tenantName} theme={theme} view={view} />
      <main className="self-service-main">
        {view === 'home' && (
          <>
            <section className="portal-home-hero">
              <div><span className="portal-kicker">Hello {currentUser.name.split(' ')[0]}</span><h1>How can we help today?</h1><p>Search for an answer, report an issue, request a service or chat to the Service Desk.</p></div>
              <label className="portal-global-search"><Search size={20} /><input value={portalQuery} onChange={(event) => setPortalQuery(event.target.value)} placeholder="Search help and knowledge…" /></label>
            </section>
            <section className="portal-quick-actions">
              {portalServiceCatalog.slice(0, 4).map((item, index) => (
                <button key={item.id} onClick={() => chooseService(item)} type="button"><span className={`portal-action-icon action-${index + 1}`}>{item.requestType === 'Incident' ? <AlertCircle size={22} /> : <PackageOpen size={22} />}</span><strong>{item.title}</strong><small>{item.description}</small><ChevronRight size={17} /></button>
              ))}
            </section>
            <div className="portal-home-grid">
              <section className="portal-panel">
                <div className="portal-section-heading"><div><span className="portal-kicker">My work</span><h2>Recent requests</h2></div><button onClick={() => setView('requests')} type="button">View all <ChevronRight size={15} /></button></div>
                <PortalRequestList openRequest={openPortalRequest} requests={myRequests.slice(0, 4)} />
              </section>
              <section className="portal-panel portal-help-panel">
                <span className="portal-kicker">Popular help</span><h2>Suggested articles</h2>
                <div className="portal-article-list">{portalResults.slice(0, 4).map((article) => <button key={article.slug || article.title} onClick={() => { setPortalQuery(article.title); setView('knowledge') }} type="button"><BookOpen size={16} /><span><strong>{article.title}</strong><small>{article.category}</small></span><ChevronRight size={15} /></button>)}</div>
              </section>
            </div>
            <section className="portal-home-status-grid">
              <button onClick={() => setView('approvals')} type="button"><ShieldCheck size={20} /><span><strong>{approvalCount ? `${approvalCount} approval${approvalCount === 1 ? '' : 's'} waiting` : 'No approvals waiting'}</strong><small>Review requests assigned to you</small></span><ChevronRight size={16} /></button>
              <button onClick={() => setView('chat')} type="button"><MessageCircle size={20} /><span><strong>{liveChatCount ? 'Live chat in progress' : 'Start live chat'}</strong><small>Speak with the Service Desk</small></span><ChevronRight size={16} /></button>
              <button onClick={() => setView('profile')} type="button"><UserRound size={20} /><span><strong>Profile & preferences</strong><small>Contact details and alerts</small></span><ChevronRight size={16} /></button>
            </section>
          </>
        )}

        {view === 'requests' && (
          <section className="portal-page-section">
            <div className="portal-page-heading"><div><span className="portal-kicker">My requests</span><h1>Track your support and service requests</h1><p>Only requests raised by your account are shown here.</p></div><button className="portal-primary-button" onClick={() => chooseService(portalServiceCatalog[0])} type="button"><LifeBuoy size={17} /> New request</button></div>
            <div className="portal-request-stats"><div><strong>{openCount}</strong><span>Open</span></div><div><strong>{myRequests.length - openCount}</strong><span>Completed</span></div><div><strong>{myRequests.length}</strong><span>Total</span></div></div>
            <section className="portal-panel"><PortalRequestList openRequest={openPortalRequest} requests={myRequests} /></section>
          </section>
        )}

        {view === 'services' && (
          <section className="portal-page-section">
            <div className="portal-page-heading"><div><span className="portal-kicker">Service catalogue</span><h1>What do you need?</h1><p>Choose a service and Hi5Central will show the correct fields, options, costs and approval route.</p></div></div>
            <div className="portal-service-toolbar"><label><Search size={17} /><input value={serviceQuery} onChange={(event) => setServiceQuery(event.target.value)} placeholder="Search services…" /></label><div>{serviceCategories.map((category) => <button className={serviceCategory === category ? 'active' : ''} key={category} onClick={() => setServiceCategory(category)} type="button">{category}</button>)}</div></div>
            <div className="portal-service-grid">{filteredServices.map((item, index) => <button key={item.id} onClick={() => chooseService(item)} type="button"><span className={`portal-action-icon action-${(index % 4) + 1}`}><PackageOpen size={21} /></span><span className="portal-service-category">{item.category}</span><strong>{item.title}</strong><p>{item.description}</p><span className="portal-card-link">Start request <ChevronRight size={15} /></span></button>)}</div>
          </section>
        )}

        {view === 'knowledge' && <PortalKnowledge articles={portalResults} onStartRequest={() => chooseService(portalServiceCatalog[0])} query={portalQuery} setQuery={setPortalQuery} />}

        {view === 'new' && <PortalNewRequest currentUser={currentUser} initialItem={selectedCatalogueItem} onBack={() => setView('services')} onSubmit={submitRequest} />}

        {view === 'approvals' && <PortalApprovals currentUser={currentUser} onDecision={onPortalApprovalDecision} tickets={tickets} />}

        {view === 'chat' && <PortalLiveChat conversations={liveChatConversations} currentUser={currentUser} onSend={onPortalChatSend} onStart={onPortalChatStart} />}

        {view === 'profile' && <PortalProfile currentPerson={currentPerson} departments={departments} onSaveProfile={onUpdatePortalProfile} teams={teams} />}
      </main>
      {toast && <div className="portal-toast"><CheckCircle2 size={17} />{toast}</div>}
    </div>
  )
}

function PortalHeader({ approvalCount, currentUser, handleLogout, liveChatCount, mobileNavOpen, navigate, openCount, setMobileNavOpen, setTheme, tenantName, theme, view }) {
  const items = [
    ['home', 'Home', Home, 0],
    ['requests', 'My requests', Inbox, openCount],
    ['services', 'Services', PackageOpen, 0],
    ['knowledge', 'Knowledge', BookOpen, 0],
    ['approvals', 'Approvals', ShieldCheck, approvalCount],
    ['chat', 'Live chat', MessageCircle, liveChatCount],
    ['profile', 'Profile', UserRound, 0],
  ]

  return (
    <header className="self-service-header">
      <div className="self-service-brand"><img src={`${import.meta.env.BASE_URL}hi5central-logo.png`} alt="Hi5Central" /><span><strong>{tenantName}</strong><small>Help Centre</small></span></div>
      <nav className={mobileNavOpen ? 'open' : ''}>
        {items.map(([id, label, Icon, count]) => <button className={view === id ? 'active' : ''} key={id} onClick={() => navigate(id)} type="button"><Icon size={16} />{label}{count > 0 && <b>{count}</b>}</button>)}
        <button className="mobile-only portal-signout" onClick={handleLogout} type="button"><LogOut size={16} /> Sign out</button>
      </nav>
      <div className="self-service-actions"><button className="portal-icon-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} type="button">{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</button><button className="portal-user-button" onClick={() => navigate('profile')} type="button"><span>{currentUser.initials}</span><div><strong>{currentUser.name}</strong><small>Profile</small></div><ChevronRight size={14} /></button><button className="portal-mobile-menu" onClick={() => setMobileNavOpen((open) => !open)} type="button">{mobileNavOpen ? <X size={20} /> : <Menu size={20} />}</button></div>
    </header>
  )
}
