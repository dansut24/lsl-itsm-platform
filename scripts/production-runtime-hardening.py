from pathlib import Path

ROOT = Path('.')


def read(path):
    return (ROOT / path).read_text()


def write(path, text):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text)


def replace(path, old, new, count=None, required=False):
    text = read(path)
    if old not in text:
        if required:
            raise RuntimeError(f'Missing expected text in {path}: {old[:120]!r}')
        return False
    text = text.replace(old, new, -1 if count is None else count)
    write(path, text)
    return True


def remove_between(path, start_marker, end_marker, include_end=True, required=False):
    text = read(path)
    start = text.find(start_marker)
    if start < 0:
        if required:
            raise RuntimeError(f'Missing start marker in {path}: {start_marker!r}')
        return False
    end = text.find(end_marker, start + len(start_marker))
    if end < 0:
        raise RuntimeError(f'Missing end marker in {path}: {end_marker!r}')
    end_index = end + (len(end_marker) if include_end else 0)
    write(path, text[:start] + text[end_index:])
    return True


def replace_between(path, start_marker, end_marker, replacement, keep_end=True, required=False):
    text = read(path)
    start = text.find(start_marker)
    if start < 0:
        if required:
            raise RuntimeError(f'Missing start marker in {path}: {start_marker!r}')
        return False
    end = text.find(end_marker, start + len(start_marker))
    if end < 0:
        raise RuntimeError(f'Missing end marker in {path}: {end_marker!r}')
    suffix = text[end:] if keep_end else text[end + len(end_marker):]
    write(path, text[:start] + replacement + suffix)
    return True


# Workspace runtime is workspace-only. Portal and RMM authentication/rendering are
# owned by their production bootstraps and must not retain simulated behaviour.
workspace = 'src/runtime/WorkspaceRuntime.jsx'
text = read(workspace)
text = text.replace("import { liveChatReplyOptions } from './workspaceConfig.jsx'\n", '')
text = text.replace('    let replyIndex = 0\n', '')
text = text.replace('      replyIndex = conversation.messages.length % liveChatReplyOptions.length\n', '')
start = text.find('\n    if (liveChatReplyOptions.length) window.setTimeout(() => {')
if start >= 0:
    end_marker = '\n    }, 1400)'
    end = text.find(end_marker, start)
    if end < 0:
        raise RuntimeError('Could not locate synthetic Live Chat reply block end')
    text = text[:start] + text[end + len(end_marker):]
write(workspace, text)
replace('src/runtime/workspaceConfig.jsx', '\nexport const liveChatReplyOptions = []', '')

# Production comments and copy must describe real runtime behaviour only.
replace('src/services/runtimeState.js', 'historical prototype browser stores', 'historical browser stores')
replace('src/lib/lifecycle.js', 'Pending demo approvals will be marked approved and recorded in the activity timeline.', 'Pending approvals will be marked approved and recorded in the activity timeline.')
replace('src/lib/tenantSurface.js', 'default\n  // prototype surface for those hosts.', 'default\n  // development surface for those hosts.')
replace('src/lib/deploymentConfig.js', "const DEFAULT_PRIMARY_TENANT = 'demo-tenant'", "const DEFAULT_PRIMARY_TENANT = ''", required=True)

# RMM active source starts empty and never presents sample inventory as live data.
replace('src/features/rmm/RmmEstateManagement.jsx', 'Demo state remains usable in-memory if storage is unavailable.', 'Local state remains usable in-memory if storage is unavailable.')
replace('src/features/rmm/RmmPlatformApp.jsx', 'applications are shown in this prototype inventory.', 'applications are reported by the device inventory.')
replace('src/features/rmm/RmmPlatformApp.jsx', 'Create an incident to demonstrate the explicit cross-product relationship.', 'Create an incident to link support history to this device.')
rmm_css = read('src/features/rmm/RmmPlatformApp.css')
rmm_css = '\n'.join(line for line in rmm_css.splitlines() if '.rmm-demo-login' not in line) + '\n'
write('src/features/rmm/RmmPlatformApp.css', rmm_css)

# Onboarding: remove simulated Microsoft 365 connection actions and mark unavailable
# integrations honestly until the production connectors are configured.
onboarding = 'src/features/onboarding/OnboardingWizard.jsx'
text = read(onboarding)
text = text.replace('  KeyRound,\n', '')
text = text.replace('  RefreshCw,\n', '')
text = text.replace("  billing: { label: 'Plan', icon: Check, description: 'Choose how this demo tenant should start.' },", "  billing: { label: 'Plan', icon: Check, description: 'Choose the initial subscription state for this tenant.' },")
text = text.replace('  const [connecting365, setConnecting365] = useState(false)\n', '')
func_start = text.find('  function connectMicrosoft365Demo() {')
if func_start >= 0:
    func_end = text.find('  async function saveStep() {', func_start)
    if func_end < 0:
        raise RuntimeError('Could not remove simulated Microsoft 365 onboarding functions')
    text = text[:func_start] + text[func_end:]
write(onboarding, text)

users_start = '              <Section title="Microsoft 365" description="For this demo, the connection is simulated. Later this button becomes the real Microsoft OAuth / Graph consent flow.">'
users_end = '              <Section title="User provisioning" description="Choose what a future live Microsoft 365 sync should manage.">'
users_section = '''              <Section title="Microsoft 365" description="Directory connections are established through the production Microsoft connector.">
                <div className={`onboarding-integration-card ${data.microsoft365?.status === 'connected' ? 'is-connected' : ''}`}>
                  <div className="onboarding-integration-logo"><Cloud size={24} /></div>
                  <div className="onboarding-integration-copy">
                    <div className="onboarding-integration-title">
                      <strong>Microsoft 365 directory</strong>
                      {data.microsoft365?.status === 'connected' ? <span><CheckCircle2 size={14} /> Connected</span> : <span>Not connected</span>}
                    </div>
                    {data.microsoft365?.status === 'connected' ? (
                      <p>{data.microsoft365.tenantName || 'Microsoft 365'} · {data.microsoft365.directoryUsers || 0} users · {data.microsoft365.directoryGroups || 0} groups discovered.</p>
                    ) : (
                      <p>Configure Microsoft 365 from Settings → Integrations after onboarding. No directory data is created locally.</p>
                    )}
                  </div>
                  <button className="onboarding-secondary" disabled type="button">{data.microsoft365?.status === 'connected' ? 'Managed by connector' : 'Configure after onboarding'}</button>
                </div>
                <div className="onboarding-integration-note"><ShieldCheck size={16} /><span>Hi5Central only treats Microsoft 365 as connected after the production OAuth and Microsoft Graph connector reports a successful connection.</span></div>
              </Section>

'''
replace_between(onboarding, users_start, users_end, users_section, keep_end=True, required=True)

replacements = {
    'Optional for the demo. Separate email addresses with commas.': 'Optional. Separate email addresses with commas.',
    'These are tenant defaults. MFA is still demo configuration until the enforcement service is connected.': 'These are tenant defaults and are enforced by the tenant security service where supported.',
    'Use Hi5Central defaults or choose your own prefixes. These demo prefixes now apply when you create records in the workspace.': 'Use Hi5Central defaults or choose your own prefixes for records created in this tenant.',
    'Demo record IDs use a timestamp-derived numeric suffix; this controls how many digits are displayed.': 'This controls how many numeric digits are displayed in generated record IDs.',
    'Used as a demo default for catalogue cost approvals.': 'Used as the default threshold for catalogue cost approvals.',
    'Store AI as enabled for the demo; the production AI service is not connected yet.': 'Enable the tenant AI preference. AI features remain unavailable until the production AI service is configured.',
    "saved365.status === 'connected_demo' ? 'Demo connected' : 'Not connected'": "saved365.status === 'connected' ? 'Connected' : 'Not connected'",
    'onboarding-demo-note': 'onboarding-integration-note',
    'All settings in this onboarding pass are persisted to the tenant. Microsoft 365, MFA enforcement, inbound email and billing remain demo configuration until their production integrations are connected.': 'All settings in this onboarding pass are persisted to the tenant. Microsoft 365, inbound email, AI and billing features remain unavailable until their production integrations are connected.',
}
for old, new in replacements.items():
    replace(onboarding, old, new)

text = read(onboarding)
billing_start = '              <Section title="Demo plan" description="No payment details are collected during this test phase.">'
start = text.find(billing_start)
if start >= 0:
    end = text.find('              </Section>', start)
    if end < 0:
        raise RuntimeError('Could not locate onboarding billing section end')
    end += len('              </Section>')
    billing = '''              <Section title="Plan" description="Choose the tenant subscription state. Payment activation is handled by the production billing service.">
                <div className="onboarding-choice-grid">
                  <button type="button" onClick={() => update('plan', 'trial')} className={data.plan === 'trial' ? 'is-selected' : ''}><strong>Start trial</strong><span>Use the enabled Hi5Central products during the evaluation period.</span></button>
                  <button type="button" onClick={() => update('plan', 'internal')} className={data.plan === 'internal' ? 'is-selected' : ''}><strong>Internal test tenant</strong><span>Mark this tenant as a non-billable controlled validation environment.</span></button>
                </div>
                <div className="onboarding-form-grid onboarding-form-grid-spaced">
                  <Field label="Expected technicians"><input type="number" min="1" value={data.expectedTechnicians || '5'} onChange={(event) => update('expectedTechnicians', event.target.value)} /></Field>
                  {modules.rmm ? <Field label="Expected managed devices"><input type="number" min="1" value={data.expectedDevices || '100'} onChange={(event) => update('expectedDevices', event.target.value)} /></Field> : null}
                </div>
              </Section>'''
    text = text[:start] + billing + text[end:]
write(onboarding, text)

replace('src/features/onboarding/OnboardingWizard.css', '.onboarding-demo-note', '.onboarding-integration-note')
replace('src/features/security/OnboardingMfaEnhancer.jsx', 'Microsoft 365, inbound email and billing remain demo configuration until their production integrations are connected.', 'Microsoft 365, inbound email and billing remain unavailable until their production integrations are connected.')

# Settings: connection cards report connector state but never manufacture a connection.
settings = 'src/features/settings/ProductionSettingsWorkspace.jsx'
text = read(settings)
start = text.find('function IntegrationCard(')
end = text.find('\nfunction normalisePrefix', start)
if start >= 0 and end > start:
    integration_card = '''function IntegrationCard({ name, description, status, icon: Icon = Link2 }) {
  const connected = status === 'connected'
  return (
    <div className="production-integration-card">
      <span className="production-integration-icon"><Icon size={20} /></span>
      <div><strong>{name}</strong><p>{description}</p><small>{connected ? 'Connected' : 'Not connected'}</small></div>
      <button disabled type="button">{connected ? 'Managed by connector' : 'Configure connector'}</button>
    </div>
  )
}
'''
    text = text[:start] + integration_card + text[end:]
text = text.replace('    // Runtime cache is only a bridge for the current demo record engine.', '    // Runtime cache bridges persisted tenant settings into the workspace shell.')
func_start = text.find('  function toggleDemoIntegration(')
if func_start >= 0:
    func_end = text.find('  async function saveActive() {', func_start)
    if func_end < 0:
        raise RuntimeError('Could not remove simulated settings integration toggle')
    text = text[:func_start] + text[func_end:]
text = text.replace("toggle={(key) => toggleDemoIntegration('integrations', key)} ", '')
write(settings, text)

text = read(settings)
start = text.find('function Directory(')
end = text.find('\nfunction TeamsDepartments', start)
if start >= 0 and end > start:
    directory = '''function Directory({ config, update }) {
  const connected = config.microsoft365?.status === 'connected'
  return <><Panel title="People & directory" description="Choose the source of truth for people, groups and profile fields."><div className="production-settings-grid"><Field label="Directory source"><select value={config.source || 'microsoft365'} onChange={(e) => update('source', e.target.value)}><option value="microsoft365">Microsoft 365 / Entra ID</option><option value="manual">Hi5Central managed</option><option value="hr">HR integration</option></select></Field></div><div className="production-settings-toggle-list"><Toggle checked={Boolean(config.syncUsers)} onChange={(v) => update('syncUsers', v)} title="Synchronise users" description="Import and update directory people after a connector is established." /><Toggle checked={Boolean(config.syncGroups)} onChange={(v) => update('syncGroups', v)} title="Synchronise groups" description="Use Microsoft groups as governed sources after a connector is established." /></div></Panel><Panel title="Microsoft 365" description="Connection state is reported by the production OAuth and Microsoft Graph connector."><div className="production-365-card"><span><Cloud size={22} /></span><div><strong>{connected ? config.microsoft365.tenantName || 'Microsoft 365' : 'Microsoft 365 not connected'}</strong><p>{connected ? `${config.microsoft365.directoryUsers || 0} users · ${config.microsoft365.directoryGroups || 0} groups discovered` : 'Configure the Microsoft 365 connector in Integrations. No directory connection is created from this screen.'}</p></div><button disabled type="button">{connected ? 'Managed by connector' : 'Configure in Integrations'}</button></div></Panel></>
}
'''
    text = text[:start] + directory + text[end:]
text = text.replace('Default service-level targets used by the current ITSM demo and future policy engine.', 'Default service-level targets used by the tenant ITSM policy engine.')
text = text.replace('Demo tenant preference only until the AI service is connected.', 'Tenant preference. AI features remain unavailable until the production AI service is connected.')
text = text.replace('Use the approved standard-change template as the authority for demo records.', 'Use the approved standard-change template as the authority for tenant records.')
write(settings, text)

text = read(settings)
start = text.find('function Integrations(')
end = text.find('\nfunction Subscription', start)
if start >= 0 and end > start:
    integrations = '''function Integrations({ config, users, update }) {
  const m365 = users?.microsoft365 || {}
  return <><Panel title="Integrations" description="Connection catalogue for directory, collaboration, service-management and API integrations."><div className="production-integration-grid"><div className="production-integration-card"><span className="production-integration-icon"><Cloud size={20} /></span><div><strong>Microsoft 365</strong><p>Entra ID / Graph directory and email/calendar integration.</p><small>{m365.status === 'connected' ? 'Connected in People & directory' : 'Not connected'}</small></div><button disabled type="button">{m365.status === 'connected' ? 'Managed by connector' : 'Configure connector'}</button></div><IntegrationCard name="Microsoft Teams" description="Service notifications and collaboration actions." icon={Users} status={config.microsoftTeams?.status} /><IntegrationCard name="Slack" description="Notifications and workflow actions." icon={Mail} status={config.slack?.status} /><IntegrationCard name="Jira" description="Link engineering work and service records." icon={GitBranch} status={config.jira?.status} /></div></Panel><Panel title="Developer integrations"><div className="production-settings-toggle-list"><Toggle checked={Boolean(config.apiAccess?.enabled)} onChange={(v) => update('apiAccess', { ...(config.apiAccess || {}), enabled: v })} title="API access" description="Prepare this tenant for scoped API credentials." /><Toggle checked={Boolean(config.webhooks?.enabled)} onChange={(v) => update('webhooks', { ...(config.webhooks || {}), enabled: v })} title="Webhooks" description="Allow outbound event delivery when webhook management is enabled." /></div></Panel></>
}
'''
    text = text[:start] + integrations + text[end:]
start = text.find('function Subscription(')
if start >= 0:
    subscription = '''function Subscription({ config, update, modules }) { return <><Panel title="Subscription" description="Subscription metadata for this tenant. Billing activation is handled by the production billing service."><div className="production-settings-grid"><Field label="Plan"><select value={config.plan || 'trial'} onChange={(e) => update('plan', e.target.value)}><option value="trial">Trial</option><option value="business">Business</option><option value="enterprise">Enterprise</option><option value="internal">Internal test tenant</option></select></Field><Field label="Billing contact"><input type="email" value={config.billingContact || ''} onChange={(e) => update('billingContact', e.target.value)} /></Field><Field label="Expected technicians"><input type="number" min="1" value={config.expectedTechnicians || '5'} onChange={(e) => update('expectedTechnicians', e.target.value)} /></Field><Field label="Expected devices"><input type="number" min="0" value={config.expectedDevices || '100'} onChange={(e) => update('expectedDevices', e.target.value)} /></Field></div></Panel><Panel title="Enabled products"><div className="production-product-summary">{modules.itsm ? <div><Wrench size={18} /><span><strong>Hi5Central ITSM</strong><small>Technician workspace + Portal</small></span></div> : null}{modules.rmm ? <div><MonitorCog size={18} /><span><strong>Hi5Central RMM</strong><small>Endpoint management</small></span></div> : null}</div></Panel></> }
'''
    text = text[:start] + subscription
write(settings, text)

# Service Catalogue local mode is an empty/offline fallback, never a seeded presentation mode.
for catalogue in ['src/features/catalogue/ServiceCatalogueAdmin.jsx', 'src/features/catalogue/ServiceCatalogueAdminV2.jsx']:
    if not (ROOT / catalogue).exists():
        continue
    text = read(catalogue)
    text = text.replace("source: 'local-demo'", "source: 'local'")
    text = text.replace("productionCatalogueEnabled() ? 'loading' : 'demo'", "productionCatalogueEnabled() ? 'loading' : 'local'")
    text = text.replace("syncState !== 'demo'", "syncState !== 'local'")
    write(catalogue, text)

# Organisation/RMM linkage must be read-only until a real RMM linkage service reports it.
sites = 'src/features/people/OrganisationSitesEnhancer.jsx'
replace(sites, "const linked = draft.rmmSite?.status === 'linked_demo'", "const linked = draft.rmmSite?.status === 'linked'")
text = read(sites)
section_start = '          <section>\n            <div className="org-site-section-heading"><span>RMM</span><strong>Site linkage</strong></div>'
start = text.find(section_start)
if start >= 0:
    end = text.find('          </section>', start)
    if end < 0:
        raise RuntimeError('Could not locate Organisation site RMM section end')
    end += len('          </section>')
    section = '''          <section>
            <div className="org-site-section-heading"><span>RMM</span><strong>Site linkage</strong></div>
            <div className={`org-site-rmm-link ${linked ? 'is-linked' : ''}`}>
              <Server size={20} />
              <div><strong>{linked ? 'RMM site linked' : 'No RMM site linked'}</strong><span>{linked ? draft.rmmSite?.label || draft.name : 'RMM linkage is managed by the production RMM service and cannot be simulated from the organisation editor.'}</span></div>
              <button disabled type="button">{linked ? 'Managed by RMM' : 'Configure in RMM'}</button>
            </div>
          </section>'''
    text = text[:start] + section + text[end:]
text = text.replace("site.rmmSite?.status === 'linked_demo'", "site.rmmSite?.status === 'linked'")
text = text.replace("{linked ? 'Demo linked' : 'Not linked'}", "{linked ? 'Linked' : 'Not linked'}")
write(sites, text)

# Workspace copy/storage no longer exposes prototype-era semantics.
workspace_views = 'src/features/workspace/WorkspaceViews.jsx'
replace(workspace_views, "const DASHBOARD_STORAGE_KEY = 'hi5central-demo-dashboards-v3'", "const DASHBOARD_STORAGE_KEY = 'hi5central-dashboards-v3'")
replace(workspace_views, 'Demo persistence is best-effort only.', 'Browser persistence is best-effort only.')
replace(workspace_views, 'Share this dashboard with teams or individual users. Permissions here are demo-only until the backend is connected.', 'Dashboard sharing requires the server-side sharing service. Local-only sharing changes are disabled.')
replace(workspace_views, '<button onClick={addShare} type="button">Add</button>', '<button disabled type="button">Server sharing required</button>')
replace(workspace_views, 'No records are linked to this CI in the prototype data.', 'No records are linked to this CI yet.')
replace(workspace_views, 'Prototype authentication is backed by baked-in credentials only.', 'Authentication is provided by the tenant identity service.')

# Production comments should describe migration/runtime state without prototype labels.
replace('src/production/ProductionShellV3Corrections.css', 'historical local/demo counter', 'historical local counter')
replace('src/production/ProductionLiveChatBadgeBridge.jsx', 'historical local/demo unread state', 'historical local unread state')

# Rename local variables named exactly "prototype" while preserving JavaScript's
# required .prototype member access.
for target in ['src/production/ProductionServiceDeskQueueRail.jsx', 'src/production/ProductionLiveChatOperations.jsx']:
    if not (ROOT / target).exists():
        continue
    text = read(target)
    text = text.replace('const prototype =', 'const elementPrototype =')
    text = text.replace('getOwnPropertyDescriptor(prototype,', 'getOwnPropertyDescriptor(elementPrototype,')
    write(target, text)

# Permanent boundary check: ban actual archived/demo vocabulary while allowing
# standard JavaScript .prototype member access.
checker = r'''import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const forbiddenPaths = [
  'src/App.jsx',
  'src/services/demoAuth.js',
  'src/services/demoStore.js',
  'src/data/demoData.jsx',
  'src/legacy',
  'src/features/portal/SelfServicePortalApp.jsx',
  'src/production/ProductionLegacyBoundary.jsx',
]
const forbiddenTokens = [
  'demoData', 'demoStore', 'demoAuth', 'authenticateDemoUser',
  'seedTickets', 'seedProjects', 'seedRotaEntries', 'seedCalendarEvents', 'seedLiveChatConversations',
  'liveChatReplyOptions', 'ROTA_DEMO_', 'CALENDAR_DEMO_',
  'analyst@hi5central.com', 'employee@hi5central.com', 'rmm@hi5central.com',
  'Hi5Desk!2026', 'Hi5Portal!2026', 'Hi5RMM!2026',
  'Dana Sinclair', 'Eleanor Shaw', 'AGT-DANA', 'PRJ-0042', 'SITE-LON-HQ', 'KB5074211',
  'portal-demo-credentials', 'rmm-demo-login', 'Use demo employee', 'Use demo RMM account',
]

const failures = []
for (const relativePath of forbiddenPaths) {
  if (fs.existsSync(path.join(root, relativePath))) failures.push(`Forbidden active runtime path: ${relativePath}`)
}

function walk(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

for (const file of walk(path.join(root, 'src'))) {
  if (!/\.(js|jsx|mjs|css|html)$/.test(file)) continue
  const relative = path.relative(root, file)
  const content = fs.readFileSync(file, 'utf8')
  for (const token of forbiddenTokens) {
    if (content.includes(token)) failures.push(`${relative} contains forbidden runtime token: ${token}`)
  }
  if (/(^|[^a-z])demo([^a-z]|$)/i.test(content)) failures.push(`${relative} still contains demo vocabulary`)
  const withoutPrototypeMembers = content.replace(/\.prototype\b/g, '.__prototype_member__')
  if (/(^|[^a-z])prototype([^a-z]|$)/i.test(withoutPrototypeMembers)) failures.push(`${relative} still contains prototype vocabulary`)
  if (content.includes('archive/')) failures.push(`${relative} imports archived code`)
}

for (const required of [
  'src/runtime/WorkspaceRuntime.jsx',
  'src/runtime/workspaceConfig.jsx',
  'src/services/runtimeState.js',
  'src/production/ProductionSessionBoundary.jsx',
  'archive/demo-runtime/src/App.jsx',
  'archive/demo-runtime/src/data/demoData.jsx',
  'archive/demo-runtime/src/services/demoStore.js',
]) {
  if (!fs.existsSync(path.join(root, required))) failures.push(`Missing production/archive boundary file: ${required}`)
}

if (failures.length) {
  console.error('Production runtime boundary check failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Production runtime boundary check passed')
'''
write('scripts/check-production-runtime-boundary.mjs', checker)

print('Production runtime hardening applied.')
