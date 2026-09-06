import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  LockKeyhole,
  MonitorCog,
  Palette,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react'
import './OnboardingWizard.css'

const API_BASE = 'https://api.hi5central.com'

const stepMeta = {
  company: { label: 'Company', icon: Building2 },
  theme: { label: 'Theme', icon: Palette },
  users: { label: 'Users', icon: Users },
  groups: { label: 'Groups', icon: Users },
  permissions: { label: 'Permissions', icon: LockKeyhole },
  security: { label: 'Security', icon: ShieldCheck },
  itsm: { label: 'ITSM', icon: Wrench },
  rmm: { label: 'RMM', icon: MonitorCog },
  billing: { label: 'Billing', icon: Check },
  finish: { label: 'Finish', icon: Sparkles },
}

function sequenceFor(modules = {}) {
  return [
    'company', 'theme', 'users', 'groups', 'permissions', 'security',
    modules.itsm ? 'itsm' : null,
    modules.rmm ? 'rmm' : null,
    'billing', 'finish',
  ].filter(Boolean)
}

function defaultData(step, session) {
  const saved = session?.onboarding?.data?.[step]
  if (saved && typeof saved === 'object') return saved
  const defaults = {
    company: { displayName: session?.tenant?.companyName || '', timezone: 'Europe/London', locale: 'en-GB' },
    theme: { accent: 'amber', mode: 'system' },
    users: { inviteMode: 'later', invites: '' },
    groups: { serviceDeskTeam: 'Service Desk', firstDepartment: 'IT' },
    permissions: { preset: 'balanced' },
    security: { requireMfa: true, sessionHours: '12' },
    itsm: { supportEmail: 'support', defaultTeam: 'Service Desk' },
    rmm: { defaultSite: 'Main site', agentChannel: 'stable' },
    billing: { plan: 'trial', billingLater: true },
    finish: {},
  }
  return defaults[step] || {}
}

function Field({ label, children, hint }) {
  return (
    <label className="onboarding-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  )
}

export function OnboardingWizard({ session, onSessionChange }) {
  const modules = session?.tenant?.modules || {}
  const sequence = useMemo(() => sequenceFor(modules), [modules])
  const step = sequence.includes(session?.onboarding?.step) ? session.onboarding.step : sequence[0]
  const index = Math.max(0, sequence.indexOf(step))
  const [data, setData] = useState(() => defaultData(step, session))
  const [activeStep, setActiveStep] = useState(step)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (activeStep !== step) {
    setActiveStep(step)
    setData(defaultData(step, session))
  }

  const meta = stepMeta[step]
  const Icon = meta?.icon || Sparkles
  const progress = Math.round(((index + 1) / sequence.length) * 100)

  function update(field, value) {
    setData((current) => ({ ...current, [field]: value }))
    setError('')
  }

  async function saveStep() {
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/api/v1/onboarding/step`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, data }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'We could not save this onboarding step.')
      onSessionChange(payload)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function complete() {
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/api/v1/onboarding/complete`, {
        method: 'POST',
        credentials: 'include',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'We could not complete onboarding.')
      onSessionChange(payload)
    } catch (completeError) {
      setError(completeError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="onboarding-shell">
      <aside className="onboarding-sidebar">
        <div className="onboarding-brand">
          <img src="/hi5central-logo.png" alt="" />
          <div><strong>Hi5Central</strong><span>{session.tenant.companyName}</span></div>
        </div>
        <div className="onboarding-progress-copy"><span>Workspace setup</span><strong>{progress}%</strong></div>
        <div className="onboarding-progress"><span style={{ width: `${progress}%` }} /></div>
        <nav className="onboarding-steps" aria-label="Onboarding progress">
          {sequence.map((item, itemIndex) => {
            const ItemIcon = stepMeta[item]?.icon || Check
            const complete = itemIndex < index
            const current = item === step
            return (
              <div className={`onboarding-step ${complete ? 'is-complete' : ''} ${current ? 'is-current' : ''}`} key={item}>
                <span className="onboarding-step-icon">{complete ? <Check size={15} /> : <ItemIcon size={15} />}</span>
                <span>{stepMeta[item]?.label}</span>
              </div>
            )
          })}
        </nav>
      </aside>

      <main className="onboarding-main">
        <div className="onboarding-card">
          <div className="onboarding-heading">
            <span className="onboarding-heading-icon"><Icon size={21} /></span>
            <div><span>Step {index + 1} of {sequence.length}</span><h1>{meta?.label}</h1></div>
          </div>

          {step === 'company' ? (
            <div className="onboarding-form-grid">
              <Field label="Organisation name"><input value={data.displayName || ''} onChange={(event) => update('displayName', event.target.value)} /></Field>
              <Field label="Time zone"><select value={data.timezone || 'Europe/London'} onChange={(event) => update('timezone', event.target.value)}><option>Europe/London</option><option>Europe/Dublin</option><option>UTC</option><option>America/New_York</option></select></Field>
              <Field label="Locale"><select value={data.locale || 'en-GB'} onChange={(event) => update('locale', event.target.value)}><option value="en-GB">English (UK)</option><option value="en-US">English (US)</option></select></Field>
            </div>
          ) : null}

          {step === 'theme' ? (
            <div className="onboarding-form-grid">
              <Field label="Default appearance"><select value={data.mode || 'system'} onChange={(event) => update('mode', event.target.value)}><option value="system">Use device setting</option><option value="light">Light</option><option value="dark">Dark</option></select></Field>
              <Field label="Accent"><select value={data.accent || 'amber'} onChange={(event) => update('accent', event.target.value)}><option value="amber">Amber</option><option value="blue">Blue</option><option value="cyan">Cyan</option><option value="emerald">Emerald</option><option value="violet">Violet</option></select></Field>
            </div>
          ) : null}

          {step === 'users' ? (
            <div className="onboarding-form-grid onboarding-form-grid-one">
              <Field label="Initial user setup"><select value={data.inviteMode || 'later'} onChange={(event) => update('inviteMode', event.target.value)}><option value="later">Invite users later</option><option value="list">Prepare an invite list now</option></select></Field>
              {data.inviteMode === 'list' ? <Field label="Email addresses" hint="Separate addresses with commas. Invitations will be enabled when directory/user provisioning is connected."><textarea value={data.invites || ''} onChange={(event) => update('invites', event.target.value)} rows={4} /></Field> : null}
            </div>
          ) : null}

          {step === 'groups' ? (
            <div className="onboarding-form-grid">
              <Field label="Primary support team"><input value={data.serviceDeskTeam || ''} onChange={(event) => update('serviceDeskTeam', event.target.value)} /></Field>
              <Field label="First department"><input value={data.firstDepartment || ''} onChange={(event) => update('firstDepartment', event.target.value)} /></Field>
            </div>
          ) : null}

          {step === 'permissions' ? (
            <div className="onboarding-choice-grid">
              {[
                ['balanced', 'Balanced', 'Owners and admins configure the platform; analysts work operational records.'],
                ['restricted', 'Restricted', 'Start with tighter analyst permissions and open access deliberately.'],
              ].map(([value, title, copy]) => <button type="button" onClick={() => update('preset', value)} className={data.preset === value ? 'is-selected' : ''} key={value}><strong>{title}</strong><span>{copy}</span></button>)}
            </div>
          ) : null}

          {step === 'security' ? (
            <div className="onboarding-form-grid">
              <Field label="Administrator MFA"><select value={data.requireMfa ? 'required' : 'optional'} onChange={(event) => update('requireMfa', event.target.value === 'required')}><option value="required">Require MFA</option><option value="optional">Optional initially</option></select></Field>
              <Field label="Maximum session length"><select value={data.sessionHours || '12'} onChange={(event) => update('sessionHours', event.target.value)}><option value="8">8 hours</option><option value="12">12 hours</option><option value="24">24 hours</option></select></Field>
            </div>
          ) : null}

          {step === 'itsm' ? (
            <div className="onboarding-form-grid">
              <Field label="Support address" hint="We will connect inbound email routing later."><div className="onboarding-prefix-input"><input value={data.supportEmail || 'support'} onChange={(event) => update('supportEmail', event.target.value)} /><span>@{session.tenant.slug}.hi5central.com</span></div></Field>
              <Field label="Default assignment team"><input value={data.defaultTeam || 'Service Desk'} onChange={(event) => update('defaultTeam', event.target.value)} /></Field>
            </div>
          ) : null}

          {step === 'rmm' ? (
            <div className="onboarding-form-grid">
              <Field label="Default site"><input value={data.defaultSite || 'Main site'} onChange={(event) => update('defaultSite', event.target.value)} /></Field>
              <Field label="Agent update channel"><select value={data.agentChannel || 'stable'} onChange={(event) => update('agentChannel', event.target.value)}><option value="stable">Stable</option><option value="early">Early access</option></select></Field>
            </div>
          ) : null}

          {step === 'billing' ? (
            <div className="onboarding-choice-grid">
              <button type="button" onClick={() => update('plan', 'trial')} className={data.plan === 'trial' ? 'is-selected' : ''}><strong>Start trial</strong><span>Continue without entering payment details while we complete the product test path.</span></button>
            </div>
          ) : null}

          {step === 'finish' ? (
            <div className="onboarding-finish">
              <span><Sparkles size={24} /></span>
              <h2>Your workspace is ready.</h2>
              <p>We’ll take you directly into {modules.itsm ? 'Hi5Central ITSM' : 'your Hi5Central workspace'} using the verified owner session you just created.</p>
              <div className="onboarding-summary">
                <div><span>Tenant</span><strong>{session.tenant.slug}.hi5central.com</strong></div>
                <div><span>Owner</span><strong>{session.user.email}</strong></div>
                <div><span>Products</span><strong>{[modules.itsm ? 'ITSM' : null, modules.rmm ? 'RMM' : null].filter(Boolean).join(' + ')}</strong></div>
              </div>
            </div>
          ) : null}

          {error ? <div className="onboarding-error">{error}</div> : null}

          <div className="onboarding-actions">
            <span className="onboarding-saved">Your progress is saved to this tenant.</span>
            <button className="onboarding-primary" disabled={saving} onClick={step === 'finish' ? complete : saveStep} type="button">
              {saving ? 'Saving…' : step === 'finish' ? 'Open Hi5Central' : 'Continue'}
              {!saving ? <ArrowRight size={17} /> : null}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
