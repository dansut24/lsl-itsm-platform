import fs from 'node:fs'

const changes = []

function update(path, transform) {
  const original = fs.readFileSync(path, 'utf8')
  const next = transform(original)
  if (next === original) return
  fs.writeFileSync(path, next)
  changes.push(path)
  console.log(`updated ${path}`)
}

function mustReplace(content, before, after, label) {
  if (!content.includes(before)) throw new Error(`Expected ${label} was not found.`)
  return content.replace(before, after)
}

update('api/src/portalAuth.js', (content) => mustReplace(
  content,
  "import {\nimport { originMatchesPortalTenant } from './deploymentConfig.js'\n  createSession,",
  "import { originMatchesPortalTenant } from './deploymentConfig.js'\nimport {\n  createSession,",
  'portalAuth malformed deployment import',
))

update('api/src/settings.js', (content) => {
  if (!content.includes("from './deploymentConfig.js'")) {
    content = content.replace(
      "import { pool, withTransaction } from './db.js'",
      "import { originMatchesTenant } from './deploymentConfig.js'\nimport { pool, withTransaction } from './db.js'",
    )
  }
  return mustReplace(
    content,
    `function originMatchesSession(c, session) {\n  const origin = c.req.header('origin')\n  if (!origin) return true\n  const expected = new Set([\n    \`https://\${session.slug}.hi5central.com\`,\n    \`https://\${session.slug}-portal.hi5central.com\`,\n    \`https://\${session.slug}-rmm.hi5central.com\`,\n  ])\n  return expected.has(origin.toLowerCase())\n}`,
    `function originMatchesSession(c, session) {\n  return originMatchesTenant(c.req.header('origin'), session.slug)\n}`,
    'settings origin guard',
  )
})

update('api/src/serviceRequests.js', (content) => {
  content = content.replace(
    "import { originMatchesTenant } from './deploymentConfig.js'",
    "import { originMatchesTenant, portalRequestFromHeaders } from './deploymentConfig.js'",
  )
  return mustReplace(
    content,
    "const portalSource = origin.toLowerCase().includes('-portal.hi5central.com') || auth.session.tenant_role === 'requester'",
    "const portalSource = portalRequestFromHeaders(origin, c.req.header('referer')) || auth.session.tenant_role === 'requester'",
    'service request Portal-source detection',
  )
})

update('src/features/marketing/MarketingApp.jsx', (content) => {
  if (!content.includes("../../lib/deploymentConfig.js")) {
    content = content.replace(
      "import './MarketingApp.css'",
      "import { deploymentConfig } from '../../lib/deploymentConfig.js'\nimport './MarketingApp.css'",
    )
  }
  content = content.replace(
    "const API_BASE = window.__HI5_API_BASE__",
    "const API_BASE = window.__HI5_API_BASE__\nconst DEPLOYMENT = deploymentConfig()",
  )
  return mustReplace(
    content,
    `  const tenantPreview = useMemo(() => {\n    const slug = form.tenantSlug || 'your-company'\n    return \`\${slug}.hi5central.com\`\n  }, [form.tenantSlug])`,
    `  const tenantPreview = useMemo(() => {\n    if (DEPLOYMENT.tenancyMode === 'single') return DEPLOYMENT.rootDomain\n    const slug = form.tenantSlug || 'your-company'\n    return \`\${slug}.\${DEPLOYMENT.rootDomain}\`\n  }, [form.tenantSlug])`,
    'embedded signup tenant preview',
  )
})

update('src/features/marketing/SignupPage.jsx', (content) => {
  if (!content.includes("../../lib/deploymentConfig.js")) {
    content = content.replace(
      "import { ArrowRight, CheckCircle2, MonitorCog, Wrench } from 'lucide-react'",
      "import { ArrowRight, CheckCircle2, MonitorCog, Wrench } from 'lucide-react'\nimport { deploymentConfig } from '../../lib/deploymentConfig.js'",
    )
  }
  content = content.replace(
    "const API_BASE = window.__HI5_API_BASE__",
    "const API_BASE = window.__HI5_API_BASE__\nconst DEPLOYMENT = deploymentConfig()",
  )
  content = mustReplace(
    content,
    "  const tenantPreview = useMemo(() => `${form.tenantSlug || 'your-company'}.hi5central.com`, [form.tenantSlug])",
    "  const tenantPreview = useMemo(() => DEPLOYMENT.tenancyMode === 'single' ? DEPLOYMENT.rootDomain : `${form.tenantSlug || 'your-company'}.${DEPLOYMENT.rootDomain}`, [form.tenantSlug])",
    'signup tenant preview',
  )
  return mustReplace(
    content,
    "              We created <strong>{created.tenant?.companyName}</strong> and reserved <strong>{created.tenant?.slug}.hi5central.com</strong> for you.",
    "              We created <strong>{created.tenant?.companyName}</strong> and reserved <strong>{created.tenant?.tenantUrl || tenantPreview}</strong> for you.",
    'signup created tenant URL',
  )
})

update('src/features/rmm/RmmPlatformApp.jsx', (content) => {
  if (!content.includes("../../lib/deploymentConfig.js")) {
    content = content.replace(
      "import { resolveTenantSurface, rmmPath, rmmRouteFromLocation } from '../../lib/tenantSurface.js'",
      "import { deploymentConfig } from '../../lib/deploymentConfig.js'\nimport { resolveTenantSurface, rmmPath, rmmRouteFromLocation } from '../../lib/tenantSurface.js'",
    )
  }
  return mustReplace(
    content,
    `function itsmRecordHref(ticket) {\n  const path = \`/\${recordPrefix(ticket)}/\${encodeURIComponent(ticket.id)}\`\n  const surface = resolveTenantSurface()\n  if (surface?.canonical && surface?.tenantSlug) {\n    return \`https://\${surface.tenantSlug}.hi5central.com\${path}\`\n  }\n  return path\n}`,
    `function itsmRecordHref(ticket) {\n  const path = \`/\${recordPrefix(ticket)}/\${encodeURIComponent(ticket.id)}\`\n  const surface = resolveTenantSurface()\n  const deployment = deploymentConfig()\n  if (deployment.tenancyMode === 'single') return path\n  if (surface?.canonical && surface?.tenantSlug) {\n    return \`https://\${surface.tenantSlug}.\${deployment.rootDomain}\${path}\`\n  }\n  return path\n}`,
    'RMM to ITSM link',
  )
})

update('src/features/security/ProductionMfaLoginEnhancer.jsx', (content) => {
  if (!content.includes("../../lib/tenantSurface.js")) {
    content = content.replace(
      "import { storeProductionAuthHandoff } from '../../production/productionSessionBridge.js'",
      "import { resolveTenantSurface } from '../../lib/tenantSurface.js'\nimport { storeProductionAuthHandoff } from '../../production/productionSessionBridge.js'",
    )
  }
  return mustReplace(
    content,
    `      const host = window.location.hostname.toLowerCase()\n      const tenantSlug = host.endsWith('.hi5central.com') ? host.slice(0, -'.hi5central.com'.length) : ''\n      if (!tenantSlug || tenantSlug.endsWith('-portal') || tenantSlug.endsWith('-rmm')) return`,
    `      const surface = resolveTenantSurface()\n      const tenantSlug = surface?.kind === 'workspace' ? surface.tenantSlug : ''\n      if (!tenantSlug) return`,
    'MFA tenant detection',
  )
})

update('src/features/workspace/UnifiedRecordDetailView.jsx', (content) => {
  if (!content.includes("../../lib/deploymentConfig.js")) {
    content = content.replace(
      "import { priorityClass, statusClass } from '../../lib/workspace.js'",
      "import { deploymentConfig } from '../../lib/deploymentConfig.js'\nimport { priorityClass, statusClass } from '../../lib/workspace.js'",
    )
  }
  return mustReplace(
    content,
    `function rmmDeviceHref(deviceId) {\n  const encoded = encodeURIComponent(String(deviceId || '').toUpperCase())\n  const surface = resolveTenantSurface()\n  if (surface?.canonical && surface?.tenantSlug) {\n    return \`https://\${surface.tenantSlug}-rmm.hi5central.com/devices/\${encoded}\`\n  }\n  return \`/rmm/devices/\${encoded}\`\n}`,
    `function rmmDeviceHref(deviceId) {\n  const encoded = encodeURIComponent(String(deviceId || '').toUpperCase())\n  const surface = resolveTenantSurface()\n  const deployment = deploymentConfig()\n  if (deployment.tenancyMode === 'single') return \`/rmm/devices/\${encoded}\`\n  if (surface?.canonical && surface?.tenantSlug) {\n    return \`https://\${surface.tenantSlug}-rmm.\${deployment.rootDomain}/devices/\${encoded}\`\n  }\n  return \`/rmm/devices/\${encoded}\`\n}`,
    'ITSM to RMM device link',
  )
})

console.log(`Deployment portability cleanup complete: ${changes.length} files changed.`)
