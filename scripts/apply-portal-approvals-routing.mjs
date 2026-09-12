import fs from 'node:fs'

function read(path) { return fs.readFileSync(path, 'utf8') }
function write(path, value) { fs.writeFileSync(path, value) }
function replaceOnce(text, before, after, label) {
  if (!text.includes(before)) throw new Error(`Missing transform anchor: ${label}`)
  return text.replace(before, after)
}

// Portal auth: approval assignees may enter the Portal even without requester catalogue access.
{
  const path = 'api/src/portalAuth.js'
  let text = read(path)
  text = replaceOnce(
    text,
    "import { registerPortalRequestViewRoutes } from './portalRequestViews.js'\n",
    "import { registerPortalRequestViewRoutes } from './portalRequestViews.js'\nimport { hasAssignedPortalApproval, portalApprovalCapabilities, registerPortalApprovalRoutes } from './portalApprovals.js'\n",
    'portal approval import',
  )
  text = replaceOnce(
    text,
    `function portalSessionPayload(session) {\n  const payload = sessionPayload(session)\n  return { ...payload, portal: true, user: { ...payload.user, role: 'requester' } }\n}\n\nasync function requirePortalSession(c) {\n  const session = await resolveSession(c)\n  if (!session) return { error: c.json({ error: 'Authentication required.' }, 401) }\n  if (!portalOrigin(c, session.slug)) return { error: c.json({ error: 'Portal session mismatch.' }, 403) }\n  if (!hasPermission(session.access, 'portal.access')) return { error: c.json({ error: 'Requester Portal access is required.' }, 403) }\n  if (!session.onboarding_completed_at) return { error: c.json({ error: 'This tenant has not completed setup.' }, 403) }\n  return { session }\n}\n`,
    `function portalSessionPayload(session, capabilities = { requests: true, approvals: false }) {\n  const payload = sessionPayload(session)\n  return { ...payload, portal: true, portalCapabilities: capabilities, user: { ...payload.user, role: 'requester' } }\n}\n\nasync function requirePortalSession(c) {\n  const session = await resolveSession(c)\n  if (!session) return { error: c.json({ error: 'Authentication required.' }, 401) }\n  if (!portalOrigin(c, session.slug)) return { error: c.json({ error: 'Portal session mismatch.' }, 403) }\n  if (!session.onboarding_completed_at) return { error: c.json({ error: 'This tenant has not completed setup.' }, 403) }\n  const capabilities = await portalApprovalCapabilities(session)\n  if (!capabilities.requests && !capabilities.approvals) return { error: c.json({ error: 'Requester Portal or approval access is required.' }, 403) }\n  return { session, capabilities }\n}\n`,
    'portal session capabilities',
  )
  text = replaceOnce(
    text,
    `export function registerPortalAuthRoutes(app) {\n  registerPortalRequestViewRoutes(app)\n`,
    `export function registerPortalAuthRoutes(app) {\n  registerPortalRequestViewRoutes(app)\n  registerPortalApprovalRoutes(app)\n`,
    'register portal approvals',
  )
  text = replaceOnce(
    text,
    `    return c.json(portalSessionPayload(auth.session))\n`,
    `    return c.json(portalSessionPayload(auth.session, auth.capabilities))\n`,
    'portal session response',
  )
  text = replaceOnce(
    text,
    `    const access = await effectiveAccessForUser(pool, account.tenant_id, account.user_id, account.tenant_role)\n    if (!access.portalAccess) {\n      await recordSecurityEvent({\n        tenantId: account.tenant_id,\n        actorUserId: account.user_id,\n        eventType: 'portal.login',\n        outcome: 'failure',\n        ipAddress: requestIp(c),\n        userAgent: requestUserAgent(c),\n        metadata: { reason: 'portal_access_denied' },\n      })\n      return c.json({\n        error: 'This account does not have access to the requester portal. Sign in to the Hi5Central workspace instead, or ask an administrator to add a Portal-enabled role.',\n      }, 403)\n    }\n    const resolvedAccount = attachAccess(account, access, 'portal')\n`,
    `    const access = await effectiveAccessForUser(pool, account.tenant_id, account.user_id, account.tenant_role)\n    const assignedApprovalAccess = await hasAssignedPortalApproval(pool, account.tenant_id, account.user_id)\n    if (!access.portalAccess && !assignedApprovalAccess) {\n      await recordSecurityEvent({\n        tenantId: account.tenant_id,\n        actorUserId: account.user_id,\n        eventType: 'portal.login',\n        outcome: 'failure',\n        ipAddress: requestIp(c),\n        userAgent: requestUserAgent(c),\n        metadata: { reason: 'portal_access_denied' },\n      })\n      return c.json({\n        error: 'This account does not currently have requester Portal access or any assigned approvals.',\n      }, 403)\n    }\n    const resolvedAccount = attachAccess(account, access, 'portal')\n    const capabilities = {\n      requests: access.portalAccess,\n      approvals: hasPermission(access, 'portal.approvals.view') || assignedApprovalAccess,\n    }\n`,
    'portal login entitlement',
  )
  text = replaceOnce(
    text,
    `    return c.json(portalSessionPayload(resolvedAccount))\n`,
    `    return c.json(portalSessionPayload(resolvedAccount, capabilities))\n`,
    'portal login capabilities response',
  )
  write(path, text)
}

// Parent SR ownership is independent from catalogue task routing.
{
  const path = 'api/src/serviceRequests.js'
  let text = read(path)
  const before = `            teamId || null,\n            JSON.stringify({ id: teamId || '', name: teamName }),\n            JSON.stringify(fields),`
  const after = `            null,\n            JSON.stringify({}),\n            JSON.stringify(fields),`
  text = replaceOnce(text, before, after, 'service request starts unassigned')
  write(path, text)
}

// Assigned approvers may decide from an ITSM record even when they are not fulfilment technicians.
{
  const path = 'api/src/accessGate.js'
  let text = read(path)
  text = replaceOnce(
    text,
    `  if (path.startsWith('/api/v1/service-requests')) {\n    if (method === 'GET') return rule(['itsm.requests.view','itsm.records.view_all'])\n`,
    `  if (path.startsWith('/api/v1/service-requests')) {\n    if (method === 'POST' && /\\/approvals\\/[^/]+\\/decision\\/?$/i.test(path)) return null\n    if (method === 'GET') return rule(['itsm.requests.view','itsm.records.view_all'])\n`,
    'approval decision assigned-user gate',
  )
  write(path, text)
}

// Workspace workflow payload identifies approvals the signed-in user can decide.
{
  const path = 'api/src/itsmWorkflows.js'
  let text = read(path)
  text = replaceOnce(text, 'async function serviceRequestWorkflow(db, row) {', 'async function serviceRequestWorkflow(db, row, session) {', 'service request workflow session')
  text = replaceOnce(
    text,
    `      \`SELECT id, label, status, approver_snapshot, decision_note, decided_at, sequence\n       FROM service_request_approvals WHERE request_id = $1 ORDER BY sequence, created_at\`,`,
    `      \`SELECT id, label, status, approver_user_id, approver_person_id, approver_snapshot, decision_note, decided_at, sequence\n       FROM service_request_approvals WHERE request_id = $1 ORDER BY sequence, created_at\`,`,
    'workflow approval assignee columns',
  )
  text = replaceOnce(
    text,
    `    note: item.decision_note,\n    decidedAt: item.decided_at,\n  }))`,
    `    note: item.decision_note,\n    decidedAt: item.decided_at,\n    canDecide: item.status === 'Pending' && (item.approver_user_id === session?.user_id || ['owner', 'admin'].includes(session?.tenant_role)),\n  }))`,
    'workflow approval canDecide',
  )
  text = replaceOnce(
    text,
    `  const stage = row.status === 'Rejected' ? 'Rejected'\n    : row.status === 'Closed' ? 'Closed'\n      : row.status === 'Completed' ? 'Completion'\n        : pending > 0 || row.status === 'Pending Approval' ? 'Approval'\n          : ['Approved', 'In Progress'].includes(row.status) ? 'Fulfilment'\n            : 'Submitted'`,
    `  const approvalComplete = mappedApprovals.length > 0 && mappedApprovals.every((item) => item.status === 'Approved')\n  const stage = row.status === 'Rejected' ? 'Rejected'\n    : row.status === 'Closed' ? 'Closed'\n      : row.status === 'Completed' ? 'Completion'\n        : pending > 0 || row.status === 'Pending Approval' ? 'Approval'\n          : approvalComplete || ['Approved', 'In Progress'].includes(row.status) ? 'Fulfilment'\n            : 'Submitted'`,
    'workflow approved-new stage',
  )
  text = replaceOnce(
    text,
    `    actions: SERVICE_REQUEST_TRANSITIONS[row.status] || [],\n`,
    `    actions: approvalComplete && row.status === 'New' ? ['In Progress'] : (SERVICE_REQUEST_TRANSITIONS[row.status] || []),\n`,
    'workflow approved-new actions',
  )
  text = replaceOnce(
    text,
    `async function workflowPayload(db, found, tenantId) {\n  return found.kind === 'request'\n    ? serviceRequestWorkflow(db, found.row)\n    : genericWorkflow(db, found.row, tenantId)\n}`,
    `async function workflowPayload(db, found, tenantId, session = null) {\n  return found.kind === 'request'\n    ? serviceRequestWorkflow(db, found.row, session)\n    : genericWorkflow(db, found.row, tenantId)\n}`,
    'workflow payload session',
  )
  text = text.replaceAll('workflowPayload(pool, found, auth.session.tenant_id)', 'workflowPayload(pool, found, auth.session.tenant_id, auth.session)')
  text = text.replaceAll('workflowPayload(pool, result.found, auth.session.tenant_id)', 'workflowPayload(pool, result.found, auth.session.tenant_id, auth.session)')
  write(path, text)
}

// Expose approval actions inside the existing Service Request workflow panel.
{
  const path = 'src/production/ProductionWorkflowExperience.jsx'
  let text = read(path)
  const start = text.indexOf('function ServiceRequestWorkflow(')
  const end = text.indexOf('\nfunction ProblemEditor(', start)
  if (start < 0 || end < 0) throw new Error('Missing transform anchor: ServiceRequestWorkflow block')
  const replacement = `function ServiceRequestWorkflow({ workflow, busy, onTransition, onDecision }) {\n  const metrics = workflow.metrics || {}\n  return <>\n    <div className="hi5-workflow-metrics">\n      <Metric label="Approvals pending" value={metrics.pendingApprovals || 0} tone={metrics.pendingApprovals ? 'warning' : 'good'} />\n      <Metric label="Tasks complete" value={\`${'${metrics.taskComplete || 0}'}/${'${metrics.taskTotal || 0}'}\`} tone={metrics.taskBlocked ? 'warning' : workflow.readyForCompletion ? 'good' : ''} />\n      <Metric label="Blocked tasks" value={metrics.taskBlocked || 0} tone={metrics.taskBlocked ? 'danger' : 'good'} />\n    </div>\n    {workflow.readyForCompletion && workflow.status === 'In Progress' ? <div className="hi5-workflow-ready"><CheckCircle2 size={16} /><span><strong>Ready for completion</strong><small>All required fulfilment tasks are complete.</small></span></div> : null}\n    {workflow.tasks?.length ? <details className="hi5-workflow-details"><summary>Fulfilment tasks <b>{metrics.taskComplete || 0}/{metrics.taskTotal || 0}</b></summary><div>{workflow.tasks.map((task) => <div className="hi5-workflow-task" key={task.id}><span><strong>{task.title}</strong><small>{task.assignee || task.team || 'Unassigned'}{task.dependencies?.length ? \` · after ${'${task.dependencies.join(\', \')}'}\` : ''}</small></span><em className={\`is-${'${String(task.status).toLowerCase().replace(/\\s+/g, \'-\')}'}\`}>{task.status}</em></div>)}</div></details> : null}\n    {workflow.approvals?.length ? <div className="hi5-workflow-approvals"><div className="hi5-workflow-subheading"><ShieldCheck size={15} /><span>Approvals</span></div>{workflow.approvals.map((approval) => <div className="hi5-workflow-approval" key={approval.id}><span><strong>{approval.label || 'Approval'}</strong><small>{approval.approver}{approval.note ? \` · ${'${approval.note}'}\` : ''}</small></span><em>{approval.status}</em>{approval.canDecide ? <div><button disabled={busy} onClick={() => onDecision(approval.id, 'Approved')} type="button">Approve</button><button className="is-danger" disabled={busy} onClick={() => onDecision(approval.id, 'Rejected')} type="button">Reject</button></div> : null}</div>)}</div> : null}\n    <WorkflowActions workflow={workflow} busy={busy} onTransition={onTransition} />\n  </>\n}\n`
  text = text.slice(0, start) + replacement + text.slice(end)
  text = replaceOnce(
    text,
    `      const next = await apiJson(\`/api/v1/workflows/${'${encodeURIComponent(reference)}'}/approvals/${'${encodeURIComponent(approvalId)}'}/decision\`, { method: 'POST', body: JSON.stringify({ decision, note }) })\n      setWorkflow(next); setDraft(next.data || draft); setNotice(\`Approval ${'${decision.toLowerCase()}'}\`)`,
    `      if (workflow?.type === 'Service Request') {\n        await apiJson(\`/api/v1/service-requests/${'${encodeURIComponent(reference)}'}/approvals/${'${encodeURIComponent(approvalId)}'}/decision\`, { method: 'POST', body: JSON.stringify({ decision, note }) })\n        await load()\n        setNotice(\`Approval ${'${decision.toLowerCase()}'}\`)\n      } else {\n        const next = await apiJson(\`/api/v1/workflows/${'${encodeURIComponent(reference)}'}/approvals/${'${encodeURIComponent(approvalId)}'}/decision\`, { method: 'POST', body: JSON.stringify({ decision, note }) })\n        setWorkflow(next); setDraft(next.data || draft); setNotice(\`Approval ${'${decision.toLowerCase()}'}\`)\n      }`,
    'workflow decision endpoint',
  )
  text = replaceOnce(
    text,
    `<ServiceRequestWorkflow workflow={workflow} busy={busy} onTransition={transition} />`,
    `<ServiceRequestWorkflow workflow={workflow} busy={busy} onTransition={transition} onDecision={decide} />`,
    'service request workflow decision prop',
  )
  write(path, text)
}

// Runtime should never infer Service Desk ownership when the parent request is unassigned.
{
  const path = 'src/services/productionServiceRequests.js'
  let text = read(path)
  text = replaceOnce(text, `    team: request.team || 'Service Desk',`, `    team: request.team || 'Unassigned',`, 'service request UI unassigned fallback')
  write(path, text)
}

// Portal navigation and home experience gain My Approvals, including approval-only Portal sessions.
{
  const path = 'src/production/ProductionRequesterPortal.jsx'
  let text = read(path)
  text = replaceOnce(text, `  CheckCircle2,\n  ChevronRight,`, `  CheckCircle2,\n  ClipboardCheck,\n  ChevronRight,`, 'portal approvals icon')
  text = replaceOnce(text, `import './ProductionRequesterPortal.css'`, `import { ProductionPortalApprovals } from './ProductionPortalApprovals.jsx'\nimport './ProductionRequesterPortal.css'`, 'portal approvals component import')
  text = replaceOnce(
    text,
    `  const [section, setSection] = useState('home')`,
    `  const [section, setSection] = useState(() => {\n    const route = window.location.pathname.split('/').filter(Boolean)[0] || 'home'\n    return ['incident', 'catalogue', 'requests', 'approvals'].includes(route) ? route : 'home'\n  })`,
    'portal route-aware section',
  )
  const marker = `  const user = session.user || {}`
  const start = text.indexOf(marker)
  if (start < 0) throw new Error('Missing transform anchor: portal authenticated tail')
  const tail = `  const user = session.user || {}\n  const capabilities = session.portalCapabilities || { requests: true, approvals: false }\n  const canRequest = capabilities.requests !== false\n  const canApprove = Boolean(capabilities.approvals)\n  const activeSection = !canRequest && ['incident', 'catalogue', 'requests'].includes(section)\n    ? (canApprove ? 'approvals' : 'home')\n    : section\n  const serviceItems = (catalogue.items || []).filter((item) => item.requestType !== 'Incident')\n  const navigate = (next) => { setSection(next); setSelectedRequest(''); setMobileNav(false); window.history.replaceState({}, '', next === 'home' ? '/' : \`/${'${next}'}\`) }\n  const submitted = (request) => { setSelectedRequest(request.reference || request.id); setSection('requests'); setRefreshKey((value) => value + 1) }\n\n  const requestNav = canRequest ? <>\n    <button className={activeSection === 'incident' ? 'active' : ''} onClick={() => navigate('incident')}><LifeBuoy size={17} /> Raise incident</button>\n    <button className={activeSection === 'catalogue' ? 'active' : ''} onClick={() => navigate('catalogue')}><PackageOpen size={17} /> Services</button>\n    <button className={activeSection === 'requests' ? 'active' : ''} onClick={() => navigate('requests')}><Inbox size={17} /> My Requests</button>\n  </> : null\n\n  const mobileRequestNav = canRequest ? <>\n    <button onClick={() => navigate('incident')}><LifeBuoy size={18} /> Raise incident</button>\n    <button onClick={() => navigate('catalogue')}><PackageOpen size={18} /> Services</button>\n    <button onClick={() => navigate('requests')}><Inbox size={18} /> My Requests</button>\n  </> : null\n\n  return (\n    <div className="prp-shell">\n      <header className="prp-header">\n        <div className="prp-brand"><img src="/hi5central-logo.png" alt="" /><span><strong>{tenant.companyName}</strong><small>Help Centre</small></span></div>\n        <nav>\n          <button className={activeSection === 'home' ? 'active' : ''} onClick={() => navigate('home')}><Home size={17} /> Home</button>\n          {requestNav}\n          {canApprove ? <button className={activeSection === 'approvals' ? 'active' : ''} onClick={() => navigate('approvals')}><ClipboardCheck size={17} /> My Approvals</button> : null}\n        </nav>\n        <div className="prp-user"><span>{initials(user.name)}</span><div><strong>{user.name}</strong><small>{user.email}</small></div><button title="Sign out" onClick={signOut}><LogOut size={17} /></button></div>\n        <button className="prp-mobile-menu" onClick={() => setMobileNav(true)}><Menu size={21} /></button>\n      </header>\n      {mobileNav ? <div className="prp-mobile-nav"><div><strong>{tenant.companyName}</strong><button onClick={() => setMobileNav(false)}><X size={20} /></button></div><button onClick={() => navigate('home')}><Home size={18} /> Home</button>{mobileRequestNav}{canApprove ? <button onClick={() => navigate('approvals')}><ClipboardCheck size={18} /> My Approvals</button> : null}<button onClick={signOut}><LogOut size={18} /> Sign out</button></div> : null}\n      <main className="prp-content">\n        {activeSection === 'approvals' && canApprove ? <ProductionPortalApprovals />\n          : activeSection === 'incident' && canRequest ? <RaiseIncident onSubmitted={submitted} />\n            : activeSection === 'catalogue' && canRequest ? <Catalogue items={serviceItems} onSubmitted={submitted} />\n              : activeSection === 'requests' && canRequest ? <Requests selectedReference={selectedRequest} onSelect={setSelectedRequest} refreshKey={refreshKey} />\n                : <section className="prp-home">\n                    <div className="prp-hero">\n                      <span>Hi {user.name?.split(' ')[0] || 'there'}</span>\n                      <h1>{canRequest ? 'What can IT help you with?' : 'Approvals waiting for your review.'}</h1>\n                      <p>{canRequest ? 'Report incidents, request services, follow progress and keep every customer-visible update in one place.' : 'Review Service Requests assigned to you without needing Service Desk workspace access.'}</p>\n                      <div>{canRequest ? <><button className="prp-primary" onClick={() => navigate('incident')}><LifeBuoy size={17} /> Raise incident</button><button className="prp-secondary" onClick={() => navigate('catalogue')}><Plus size={17} /> Request a service</button></> : null}{canApprove ? <button className={canRequest ? 'prp-secondary' : 'prp-primary'} onClick={() => navigate('approvals')}><ClipboardCheck size={17} /> My Approvals</button> : null}</div>\n                    </div>\n                    <div className="prp-home-grid">\n                      {canRequest ? <><button onClick={() => navigate('incident')}><span className="prp-icon"><LifeBuoy size={20} /></span><strong>Raise incident</strong><p>Tell the Service Desk when something is broken or stopping you from working.</p><ChevronRight size={17} /></button><button onClick={() => navigate('catalogue')}><span className="prp-icon"><PackageOpen size={20} /></span><strong>Service catalogue</strong><p>Browse the services and products your organisation has published.</p><ChevronRight size={17} /></button><button onClick={() => navigate('requests')}><span className="prp-icon"><Inbox size={20} /></span><strong>My Requests</strong><p>See incidents, service requests, fulfilment and customer updates.</p><ChevronRight size={17} /></button></> : null}\n                      {canApprove ? <button onClick={() => navigate('approvals')}><span className="prp-icon"><ClipboardCheck size={20} /></span><strong>My Approvals</strong><p>Review requests assigned to you and approve or reject them securely.</p><ChevronRight size={17} /></button> : null}\n                      <div><span className="prp-icon"><ShieldCheck size={20} /></span><strong>Private by default</strong><p>{canRequest ? 'You can only see requests associated with your authenticated account.' : 'You can only see approvals explicitly assigned to your account.'}</p></div>\n                    </div>\n                  </section>}\n      </main>\n    </div>\n  )\n}\n`
  text = text.slice(0, start) + tail
  write(path, text)
}

console.log('Portal approvals and Service Request ownership refactor applied.')
