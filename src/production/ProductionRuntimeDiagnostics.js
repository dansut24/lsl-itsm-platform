const DIAGNOSTIC_PARAM = 'hi5diag'
const STORE_KEY = 'hi5central-runtime-diagnostics-v1'
const MAX_ENTRIES = 320

function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function randomId(prefix) {
  try {
    return `${prefix}-${crypto.randomUUID()}`
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

function queryEnabled() {
  try {
    return new URL(window.location.href).searchParams.get(DIAGNOSTIC_PARAM) === '1'
  } catch {
    return false
  }
}

function readStore() {
  try {
    const parsed = safeJsonParse(window.localStorage.getItem(STORE_KEY), null)
    if (!parsed || !Array.isArray(parsed.entries)) return null
    return parsed
  } catch {
    return null
  }
}

function writeStore(store) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store))
    return true
  } catch {
    return false
  }
}

function persistedSidebarMode() {
  try {
    const raw = window.localStorage.getItem('hi5central-sidebar-mode')
      ?? window.localStorage.getItem('lsl-itsm-sidebar-mode')
    const value = safeJsonParse(raw, raw)
    return ['expanded', 'collapsed', 'hidden'].includes(value) ? value : String(value || 'unknown')
  } catch {
    return 'storage-unavailable'
  }
}

function navigationType() {
  try {
    return performance.getEntriesByType('navigation')?.[0]?.type || 'unknown'
  } catch {
    return 'unknown'
  }
}

function mediaSnapshot() {
  const matches = (query) => {
    try {
      return Boolean(window.matchMedia?.(query).matches)
    } catch {
      return false
    }
  }

  return {
    max680: matches('(max-width: 680px)'),
    short600: matches('(max-height: 600px)'),
    coarse: matches('(any-pointer: coarse)'),
    hoverNone: matches('(hover: none)'),
    phoneClass: matches('(max-width: 680px) and (any-pointer: coarse), (max-height: 600px) and (any-pointer: coarse)'),
  }
}

function viewportSnapshot() {
  const vv = window.visualViewport
  return {
    innerWidth: Math.round(window.innerWidth || 0),
    innerHeight: Math.round(window.innerHeight || 0),
    outerWidth: Math.round(window.outerWidth || 0),
    outerHeight: Math.round(window.outerHeight || 0),
    dpr: Number(window.devicePixelRatio || 1),
    visualWidth: vv ? Math.round(vv.width) : null,
    visualHeight: vv ? Math.round(vv.height) : null,
    visualScale: vv ? Number(vv.scale.toFixed(3)) : null,
    visualOffsetTop: vv ? Math.round(vv.offsetTop) : null,
    visualOffsetLeft: vv ? Math.round(vv.offsetLeft) : null,
    orientation: window.screen?.orientation?.type || null,
    angle: window.screen?.orientation?.angle ?? null,
  }
}

function shellSnapshot() {
  const shell = document.querySelector('.app-shell')
  const sidebar = document.querySelector('.sidebar')
  const nav = document.querySelector('.nav-stack')
  const main = document.querySelector('.main-frame')

  const rect = (element) => {
    if (!(element instanceof HTMLElement)) return null
    const box = element.getBoundingClientRect()
    return {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    }
  }

  return {
    shellClass: shell?.className || null,
    sidebarClass: sidebar?.className || null,
    sidebarMode: persistedSidebarMode(),
    shellRect: rect(shell),
    sidebarRect: rect(sidebar),
    mainRect: rect(main),
    navScrollTop: nav instanceof HTMLElement ? Math.round(nav.scrollTop) : null,
    navScrollHeight: nav instanceof HTMLElement ? Math.round(nav.scrollHeight) : null,
    navClientHeight: nav instanceof HTMLElement ? Math.round(nav.clientHeight) : null,
  }
}

function compactError(value) {
  if (value == null) return null
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: String(value.stack || '').split('\n').slice(0, 8).join('\n'),
    }
  }
  if (typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value))
    } catch {
      return String(value)
    }
  }
  return String(value)
}

export function installProductionRuntimeDiagnostics() {
  if (!queryEnabled()) return () => {}

  const bootId = randomId('boot')
  const previous = readStore()
  const store = previous || {
    version: 1,
    sessionId: randomId('diag'),
    startedAt: new Date().toISOString(),
    entries: [],
  }

  const listeners = []
  let sequence = Number(store.entries.at(-1)?.seq || 0)
  let lastResizeAt = 0
  let lastTouchMoveAt = 0
  let lastPointerMoveAt = 0
  let lastShellSignature = ''
  let panel = null

  const record = (event, detail = {}, { includeShell = false } = {}) => {
    sequence += 1
    const entry = {
      seq: sequence,
      time: new Date().toISOString(),
      perfMs: Math.round(performance.now?.() || 0),
      bootId,
      event,
      href: `${window.location.pathname}${window.location.search}${window.location.hash}`,
      viewport: viewportSnapshot(),
      media: mediaSnapshot(),
      visibility: document.visibilityState,
      sidebarMode: persistedSidebarMode(),
      ...(includeShell ? { shell: shellSnapshot() } : {}),
      ...detail,
    }

    store.entries.push(entry)
    if (store.entries.length > MAX_ENTRIES) {
      store.entries.splice(0, store.entries.length - MAX_ENTRIES)
    }
    writeStore(store)
    renderPanel()
    return entry
  }

  const on = (target, type, handler, options) => {
    if (!target?.addEventListener) return
    target.addEventListener(type, handler, options)
    listeners.push(() => target.removeEventListener(type, handler, options))
  }

  const mediaListeners = []
  const watchMedia = (name, query) => {
    const media = window.matchMedia?.(query)
    if (!media) return
    const handler = (event) => record('media-change', { name, query, matches: event.matches }, { includeShell: true })
    media.addEventListener?.('change', handler)
    mediaListeners.push(() => media.removeEventListener?.('change', handler))
  }

  const shellSignature = () => {
    const shell = document.querySelector('.app-shell')
    const sidebar = document.querySelector('.sidebar')
    const nav = document.querySelector('.nav-stack')
    return [
      shell?.className || '',
      sidebar?.className || '',
      persistedSidebarMode(),
      shell instanceof HTMLElement ? `${shell.clientWidth}x${shell.clientHeight}` : '',
      sidebar instanceof HTMLElement ? `${sidebar.clientWidth}x${sidebar.clientHeight}` : '',
      nav instanceof HTMLElement ? `${nav.clientHeight}:${nav.scrollHeight}` : '',
    ].join('|')
  }

  const recordShellIfChanged = (reason) => {
    const next = shellSignature()
    if (next === lastShellSignature) return
    const previousSignature = lastShellSignature
    lastShellSignature = next
    record('shell-change', { reason, previousSignature, signature: next }, { includeShell: true })
  }

  function diagnosticText() {
    return JSON.stringify({
      version: store.version,
      sessionId: store.sessionId,
      startedAt: store.startedAt,
      currentBootId: bootId,
      navigationType: navigationType(),
      wasDiscarded: Boolean(document.wasDiscarded),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      current: {
        viewport: viewportSnapshot(),
        media: mediaSnapshot(),
        shell: shellSnapshot(),
        visibility: document.visibilityState,
      },
      entries: store.entries,
    }, null, 2)
  }

  function renderPanel() {
    if (!panel) return
    const summary = panel.querySelector('[data-hi5-diag-summary]')
    const output = panel.querySelector('[data-hi5-diag-output]')
    if (summary) {
      const last = store.entries.at(-1)
      summary.textContent = `${store.entries.length} events · boot ${bootId.slice(-8)} · nav=${navigationType()} · last=${last?.event || 'none'}`
    }
    if (output && panel.dataset.open === 'true') output.value = diagnosticText()
  }

  const installPanel = () => {
    if (document.getElementById('hi5-runtime-diagnostics')) return

    const host = document.createElement('div')
    host.id = 'hi5-runtime-diagnostics'
    host.dataset.open = 'false'
    host.innerHTML = `
      <button type="button" data-hi5-diag-toggle aria-label="Open Hi5Central diagnostics">DIAG</button>
      <section data-hi5-diag-panel hidden>
        <header>
          <div>
            <strong>Hi5Central runtime diagnostics</strong>
            <span data-hi5-diag-summary></span>
          </div>
          <button type="button" data-hi5-diag-close aria-label="Close diagnostics">×</button>
        </header>
        <div class="hi5-diag-actions">
          <button type="button" data-hi5-diag-snapshot>Snapshot</button>
          <button type="button" data-hi5-diag-copy>Copy log</button>
          <button type="button" data-hi5-diag-clear>Clear</button>
        </div>
        <textarea data-hi5-diag-output readonly spellcheck="false"></textarea>
        <small>Reproduce the sidebar Desktop → Mobile failure, reopen DIAG after the page returns, then Copy log.</small>
      </section>
    `

    const style = document.createElement('style')
    style.id = 'hi5-runtime-diagnostics-style'
    style.textContent = `
      #hi5-runtime-diagnostics{position:fixed;z-index:2147483647;right:8px;bottom:8px;font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#10213f}
      #hi5-runtime-diagnostics>[data-hi5-diag-toggle]{width:50px;height:32px;border:1px solid #64748b;border-radius:7px;background:#fff;color:#10213f;font:800 11px/1 system-ui;box-shadow:0 4px 16px rgba(15,23,42,.24)}
      #hi5-runtime-diagnostics>[data-hi5-diag-panel]{width:min(680px,calc(100vw - 16px));height:min(72vh,620px);border:1px solid #64748b;border-radius:10px;background:#fff;box-shadow:0 18px 50px rgba(15,23,42,.34);overflow:hidden}
      #hi5-runtime-diagnostics header{height:54px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 10px;border-bottom:1px solid #d8e1ee;background:#f8fafc}
      #hi5-runtime-diagnostics header>div{min-width:0;display:grid;gap:2px}
      #hi5-runtime-diagnostics header strong{font:800 13px/1.2 system-ui}
      #hi5-runtime-diagnostics header span{overflow:hidden;color:#64748b;font-size:10px;text-overflow:ellipsis;white-space:nowrap}
      #hi5-runtime-diagnostics header button{width:32px;height:32px;border:0;background:transparent;font-size:22px}
      #hi5-runtime-diagnostics .hi5-diag-actions{display:flex;gap:6px;padding:7px 9px;border-bottom:1px solid #e2e8f0}
      #hi5-runtime-diagnostics .hi5-diag-actions button{min-height:30px;padding:0 10px;border:1px solid #cbd5e1;border-radius:6px;background:#f8fafc;font:700 11px system-ui}
      #hi5-runtime-diagnostics textarea{box-sizing:border-box;width:100%;height:calc(100% - 132px);resize:none;border:0;outline:0;padding:9px;background:#0f172a;color:#e2e8f0;font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre;overflow:auto;-webkit-overflow-scrolling:touch}
      #hi5-runtime-diagnostics small{display:block;padding:6px 9px;color:#64748b;font:10px/1.25 system-ui}
      @media(max-width:680px){#hi5-runtime-diagnostics{right:4px;bottom:4px}#hi5-runtime-diagnostics>[data-hi5-diag-panel]{width:calc(100vw - 8px);height:min(76vh,620px)}}
    `

    document.head.appendChild(style)
    document.body.appendChild(host)
    panel = host

    const stop = (event) => event.stopPropagation()
    ;['touchstart', 'touchmove', 'touchend', 'pointerdown', 'pointerup', 'click'].forEach((type) => {
      host.addEventListener(type, stop, { passive: type !== 'touchmove' })
    })

    const setOpen = (open) => {
      host.dataset.open = open ? 'true' : 'false'
      host.querySelector('[data-hi5-diag-toggle]').hidden = open
      host.querySelector('[data-hi5-diag-panel]').hidden = !open
      if (open) {
        record('diagnostic-panel-opened', {}, { includeShell: true })
        renderPanel()
      }
    }

    host.querySelector('[data-hi5-diag-toggle]').addEventListener('click', () => setOpen(true))
    host.querySelector('[data-hi5-diag-close]').addEventListener('click', () => setOpen(false))
    host.querySelector('[data-hi5-diag-snapshot]').addEventListener('click', () => record('manual-snapshot', {}, { includeShell: true }))
    host.querySelector('[data-hi5-diag-copy]').addEventListener('click', async () => {
      const text = diagnosticText()
      const output = host.querySelector('[data-hi5-diag-output]')
      output.value = text
      try {
        await navigator.clipboard.writeText(text)
        host.querySelector('[data-hi5-diag-copy]').textContent = 'Copied'
        window.setTimeout(() => {
          const button = host.querySelector('[data-hi5-diag-copy]')
          if (button) button.textContent = 'Copy log'
        }, 1200)
      } catch {
        output.focus()
        output.select()
      }
    })
    host.querySelector('[data-hi5-diag-clear]').addEventListener('click', () => {
      store.entries.length = 0
      store.startedAt = new Date().toISOString()
      sequence = 0
      writeStore(store)
      record('diagnostics-cleared', {}, { includeShell: true })
    })

    renderPanel()
  }

  record('diagnostics-boot', {
    navigationType: navigationType(),
    wasDiscarded: Boolean(document.wasDiscarded),
    referrer: document.referrer || null,
  }, { includeShell: true })

  on(window, 'pageshow', (event) => record('pageshow', { persisted: Boolean(event.persisted) }, { includeShell: true }))
  on(window, 'pagehide', (event) => record('pagehide', { persisted: Boolean(event.persisted) }, { includeShell: true }))
  on(window, 'beforeunload', () => record('beforeunload', {}, { includeShell: true }))
  on(window, 'unload', () => record('unload'))
  on(window, 'focus', () => record('window-focus'))
  on(window, 'blur', () => record('window-blur'))
  on(window, 'online', () => record('online'))
  on(window, 'offline', () => record('offline'))
  on(document, 'visibilitychange', () => record('visibilitychange', { state: document.visibilityState }, { includeShell: true }))
  on(document, 'freeze', () => record('freeze', {}, { includeShell: true }))
  on(document, 'resume', () => record('resume', {}, { includeShell: true }))
  on(window, 'popstate', () => record('popstate', {}, { includeShell: true }))
  on(window, 'hi5-routechange', () => record('hi5-routechange', {}, { includeShell: true }))

  on(window, 'error', (event) => record('window-error', {
    message: event.message || null,
    filename: event.filename || null,
    line: event.lineno || null,
    column: event.colno || null,
    error: compactError(event.error),
  }, { includeShell: true }), true)

  on(window, 'unhandledrejection', (event) => record('unhandledrejection', {
    reason: compactError(event.reason),
  }, { includeShell: true }))

  const handleResize = (source) => {
    const now = Date.now()
    if (now - lastResizeAt < 80) return
    lastResizeAt = now
    record('resize', { source }, { includeShell: true })
    window.setTimeout(() => recordShellIfChanged(`${source}-settled`), 120)
  }

  on(window, 'resize', () => handleResize('window'))
  on(window, 'orientationchange', () => record('orientationchange', {}, { includeShell: true }))
  on(window.visualViewport, 'resize', () => handleResize('visualViewport'))
  on(window.visualViewport, 'scroll', () => record('visual-viewport-scroll'))

  const touchPoint = (event) => {
    const touch = event.touches?.[0] || event.changedTouches?.[0]
    return touch ? { x: Math.round(touch.clientX), y: Math.round(touch.clientY), touches: event.touches?.length ?? 0 } : { touches: 0 }
  }

  on(document, 'touchstart', (event) => record('touchstart', touchPoint(event), { includeShell: true }), { capture: true, passive: true })
  on(document, 'touchmove', (event) => {
    const now = Date.now()
    if (now - lastTouchMoveAt < 120) return
    lastTouchMoveAt = now
    record('touchmove', { ...touchPoint(event), cancelable: event.cancelable, defaultPrevented: event.defaultPrevented })
  }, { capture: true, passive: true })
  on(document, 'touchend', (event) => record('touchend', touchPoint(event), { includeShell: true }), { capture: true, passive: true })
  on(document, 'touchcancel', (event) => record('touchcancel', touchPoint(event), { includeShell: true }), { capture: true, passive: true })

  const pointerDetail = (event) => ({
    pointerType: event.pointerType,
    x: Math.round(event.clientX),
    y: Math.round(event.clientY),
    buttons: event.buttons,
  })
  on(document, 'pointerdown', (event) => record('pointerdown', pointerDetail(event), { includeShell: true }), true)
  on(document, 'pointermove', (event) => {
    const now = Date.now()
    if (now - lastPointerMoveAt < 160) return
    lastPointerMoveAt = now
    record('pointermove', pointerDetail(event))
  }, true)
  on(document, 'pointerup', (event) => record('pointerup', pointerDetail(event), { includeShell: true }), true)
  on(document, 'pointercancel', (event) => record('pointercancel', pointerDetail(event), { includeShell: true }), true)
  on(document, 'wheel', (event) => record('wheel', { deltaX: Math.round(event.deltaX), deltaY: Math.round(event.deltaY), ctrlKey: event.ctrlKey, metaKey: event.metaKey }), { capture: true, passive: true })

  watchMedia('max680', '(max-width: 680px)')
  watchMedia('short600', '(max-height: 600px)')
  watchMedia('coarse', '(any-pointer: coarse)')
  watchMedia('phoneClass', '(max-width: 680px) and (any-pointer: coarse), (max-height: 600px) and (any-pointer: coarse)')

  const shellTimer = window.setInterval(() => recordShellIfChanged('poll'), 250)
  const heartbeatTimer = window.setInterval(() => record('heartbeat', {}, { includeShell: true }), 5000)

  if (document.readyState === 'loading') {
    on(document, 'DOMContentLoaded', () => {
      installPanel()
      record('dom-content-loaded', {}, { includeShell: true })
    }, { once: true })
  } else {
    installPanel()
    record('dom-ready', {}, { includeShell: true })
  }

  return () => {
    listeners.forEach((remove) => remove())
    mediaListeners.forEach((remove) => remove())
    window.clearInterval(shellTimer)
    window.clearInterval(heartbeatTimer)
    panel?.remove()
    document.getElementById('hi5-runtime-diagnostics-style')?.remove()
  }
}
