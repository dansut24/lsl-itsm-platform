"use strict";

/* -----------------------------------------
   UI elements
------------------------------------------ */

const elStatusDot    = document.getElementById("status-dot");
const elStatusLabel  = document.getElementById("status-label");
const elDeviceLabel  = document.getElementById("device-label");
const elBtnFiles     = document.getElementById("btn-files");
const elBtnChat      = document.getElementById("btn-chat");
const elBtnAudio     = document.getElementById("btn-audio");
const elBtnBlockInput = document.getElementById("btn-block-input");
const elBtnBackstage = document.getElementById("btn-backstage");
const elBtnConsole   = document.getElementById("btn-console");
const elBtnStartMenu = document.getElementById("btn-start-menu");
const elBtnCad       = document.getElementById("btn-cad");
const elBtnMonitor   = document.getElementById("btn-monitor");
const elMonitorMenu  = document.getElementById("monitor-menu");
const elBtnDisc      = document.getElementById("btn-disconnect");
const elFilesPanel   = document.getElementById("files-panel");
const elChatPanel    = document.getElementById("chat-panel");
const elFilesClose   = document.getElementById("files-close");
const elChatClose    = document.getElementById("chat-close");
const elFilePath     = document.getElementById("file-path");
const elFileRefresh  = document.getElementById("file-refresh");
const elFileUpload   = document.getElementById("file-upload");
const elFileUploadInput = document.getElementById("file-upload-input");
const elFileMobileStatus = document.getElementById("file-mobile-status");
const elFileList     = document.getElementById("file-list");
const elChatLog      = document.getElementById("chat-log");
const elChatInput    = document.getElementById("chat-input");
const elChatSend     = document.getElementById("chat-send");
const elVideo        = document.getElementById("remote-video");
const elMain         = document.getElementById("main");
const elAudio        = document.getElementById("remote-audio");
const elOverlay      = document.getElementById("overlay");
const elOverlayTitle = document.getElementById("overlay-title");
const elOverlaySub   = document.getElementById("overlay-sub");
const elSpinner      = document.getElementById("spinner");
const elErrorDetail  = document.getElementById("error-detail");
const elStatsBar     = document.getElementById("statsbar");
const elStatRes      = document.getElementById("stat-res");
const elStatState    = document.getElementById("stat-state");
const elStatCodec    = document.getElementById("stat-codec");
const elDiagIceState = document.getElementById("diag-ice-state");
const elDiagConnState = document.getElementById("diag-connection-state");
const elDiagCandidatePair = document.getElementById("diag-candidate-pair");
const elDiagBitrate = document.getElementById("diag-bitrate");
const elDiagFps = document.getElementById("diag-fps");
const elDiagFrames = document.getElementById("diag-frames");
const elDiagPacketsLost = document.getElementById("diag-packets-lost");
const elDiagRtt = document.getElementById("diag-rtt");
const elDiagIceServers = document.getElementById("diag-ice-servers");
const elMobileViewControls = document.getElementById("mobile-view-controls");
const elMobileZoomOut = document.getElementById("mobile-zoom-out");
const elMobileZoomFit = document.getElementById("mobile-zoom-fit");
const elMobileZoomIn = document.getElementById("mobile-zoom-in");
const elBtnKeyboard = document.getElementById("btn-keyboard");
const elMobileKeyboard = document.getElementById("mobile-keyboard");
const elMobileKeyboardRows = document.getElementById("mobile-keyboard-rows");
const elMobileKeyboardClose = document.getElementById("mobile-keyboard-close");
const elMobileTextInput = document.getElementById("mobile-text-input");
const elMobileTextSend = document.getElementById("mobile-text-send");

if (elVideo) {
  elVideo.autoplay = true;
  elVideo.playsInline = true;
  elVideo.muted = true;
  elVideo.defaultMuted = true;
  elVideo.setAttribute("playsinline", "");
  elVideo.setAttribute("webkit-playsinline", "");
  elVideo.setAttribute("autoplay", "");
  elVideo.setAttribute("muted", "");
}

/* -----------------------------------------
   State
------------------------------------------ */

let ws = null;
let pc = null;
let inputDc = null;

let currentSession = null;
let audioEnabled = false;
let localInputBlocked = false;
let remoteDescSet = false;
let pendingRemoteIce = [];

let statsTimer = null;
let transitionWatchdogTimer = null;
let lastStats = { tsMs: 0, bytes: 0, frames: 0, packetsLost: 0, jitterDelay: 0, jitterEmitted: 0 };

let inputBound = false;
let controlActive = false;
const pressedKeys = new Set();
let remoteAltTabActive = false;

let remoteCursorEl = null;
let lastCursorNorm = null;

let mobileViewZoom = 1;
let mobileViewPanX = 0;
let mobileViewPanY = 0;

function isMobileViewerSurface() {
  return window.matchMedia?.('(max-width: 820px), (pointer: coarse)')?.matches ?? false;
}

function clampMobileViewport() {
  if (!elVideo || !isMobileViewerSurface()) return;
  const main = elVideo.parentElement?.getBoundingClientRect?.();
  if (!main || !main.width || !main.height) return;
  const videoAspect = (elVideo.videoWidth || 16) / (elVideo.videoHeight || 9);
  const mainAspect = main.width / main.height;
  let baseWidth;
  let baseHeight;
  if (mainAspect > videoAspect) {
    baseHeight = main.height;
    baseWidth = baseHeight * videoAspect;
  } else {
    baseWidth = main.width;
    baseHeight = baseWidth / videoAspect;
  }
  // Let a zoomed monitor corner move inward from the physical screen edge,
  // but fade that allowance smoothly back to zero as zoom returns to Fit.
  // The old hard on/off margin caused a visible jump near 1x.
  const overscrollMax = Math.min(96, Math.max(36, Math.min(main.width, main.height) * 0.12));
  const overscrollBlend = Math.max(0, Math.min(1, (mobileViewZoom - 1) / 0.5));
  const overscroll = overscrollMax * overscrollBlend;
  const maxX = Math.max(0, (baseWidth * mobileViewZoom - main.width) / 2) + overscroll;
  const maxY = Math.max(0, (baseHeight * mobileViewZoom - main.height) / 2) + overscroll;
  mobileViewPanX = Math.max(-maxX, Math.min(maxX, mobileViewPanX));
  mobileViewPanY = Math.max(-maxY, Math.min(maxY, mobileViewPanY));
}

function applyMobileViewport({ clamp = true } = {}) {
  if (!elVideo) return;
  if (!isMobileViewerSurface()) {
    elVideo.style.transform = '';
    return;
  }
  mobileViewZoom = Math.max(1, Math.min(4, mobileViewZoom));
  // Do not feed clamped coordinates back into an active pinch. When zooming
  // out near an edge, the legal pan bounds shrink every frame; clamping here
  // makes the image visibly "tick" under the fingers. We settle bounds once
  // the gesture ends instead.
  if (clamp) clampMobileViewport();
  elVideo.style.transform = 'translate3d(' + mobileViewPanX + 'px, ' + mobileViewPanY + 'px, 0) scale(' + mobileViewZoom + ')';
  refreshRemoteCursorPosition();
}

function setMobileViewZoom(nextZoom) {
  mobileViewZoom = Math.max(1, Math.min(4, Number(nextZoom) || 1));
  if (mobileViewZoom === 1) { mobileViewPanX = 0; mobileViewPanY = 0; }
  applyMobileViewport();
}

function resetMobileViewport() {
  mobileViewZoom = 1;
  mobileViewPanX = 0;
  mobileViewPanY = 0;
  applyMobileViewport();
}

function setMobileViewControlsVisible(visible) {
  if (!elMobileViewControls) return;
  elMobileViewControls.classList.toggle('visible', !!visible && isMobileViewerSurface());
}

elMobileZoomOut?.addEventListener('click', () => setMobileViewZoom(mobileViewZoom - 0.5));
elMobileZoomIn?.addEventListener('click', () => setMobileViewZoom(mobileViewZoom + 0.5));
elMobileZoomFit?.addEventListener('click', resetMobileViewport);
window.addEventListener('resize', () => { if (isMobileViewerSurface()) applyMobileViewport(); });

let mobileKeyboardOpen = false;
let mobileKeyboardLayer = 'letters';
const mobileKeyboardModifiers = { shift: false, ctrl: false, alt: false };

const MOBILE_LETTER_ROWS = [
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  [{ label: 'Shift', modifier: 'shift', wide: true }, 'z','x','c','v','b','n','m', { label: '⌫', code: 'Backspace', key: 'Backspace', wide: true }],
  [{ label: '123', layer: 'symbols', wide: true }, { label: 'Ctrl', modifier: 'ctrl' }, { label: 'Alt', modifier: 'alt' }, { label: '⊞', action: 'start_menu' }, { label: 'Space', text: ' ', code: 'Space', space: true }, { label: 'Enter', code: 'Enter', key: 'Enter', wide: true }],
  [{ label: 'Esc', code: 'Escape', key: 'Escape' }, { label: 'Tab', code: 'Tab', key: 'Tab' }, { label: '←', code: 'ArrowLeft', key: 'ArrowLeft' }, { label: '↑', code: 'ArrowUp', key: 'ArrowUp' }, { label: '↓', code: 'ArrowDown', key: 'ArrowDown' }, { label: '→', code: 'ArrowRight', key: 'ArrowRight' }, { label: 'Del', code: 'Delete', key: 'Delete' }]
];
const MOBILE_SYMBOL_ROWS = [
  ['1','2','3','4','5','6','7','8','9','0'],
  ['-','=','[',']','\\',';','\'',',','.','/'],
  ['!','@','#','$','%','^','&','*','(',')'],
  [{ label: 'ABC', layer: 'letters', wide: true }, { label: 'Ctrl', modifier: 'ctrl' }, { label: 'Alt', modifier: 'alt' }, { label: '⊞', action: 'start_menu' }, { label: 'Space', text: ' ', code: 'Space', space: true }, { label: 'Enter', code: 'Enter', key: 'Enter', wide: true }],
  [{ label: 'Esc', code: 'Escape', key: 'Escape' }, { label: 'Tab', code: 'Tab', key: 'Tab' }, { label: '←', code: 'ArrowLeft', key: 'ArrowLeft' }, { label: '↑', code: 'ArrowUp', key: 'ArrowUp' }, { label: '↓', code: 'ArrowDown', key: 'ArrowDown' }, { label: '→', code: 'ArrowRight', key: 'ArrowRight' }, { label: 'Del', code: 'Delete', key: 'Delete' }]
];
const SHIFTED_NUMBER_TEXT = { '1':'!', '2':'@', '3':'#', '4':'$', '5':'%', '6':'^', '7':'&', '8':'*', '9':'(', '0':')' };

function keyboardCodeForText(text) {
  if (/^[a-z]$/i.test(text)) return 'Key' + text.toUpperCase();
  if (/^[0-9]$/.test(text)) return 'Digit' + text;
  if (text === ' ') return 'Space';
  const punctuation = {
    '`': 'Backquote', '-': 'Minus', '=': 'Equal',
    '[': 'BracketLeft', ']': 'BracketRight', '\\': 'Backslash',
    ';': 'Semicolon', "'": 'Quote', ',': 'Comma',
    '.': 'Period', '/': 'Slash'
  };
  return punctuation[text] || '';
}

function normalizeMobileKey(def) {
  if (typeof def === 'string') return { label: def.toUpperCase(), text: def, code: keyboardCodeForText(def) };
  return { ...def };
}

function clearMobileKeyboardModifiers() {
  mobileKeyboardModifiers.shift = false;
  mobileKeyboardModifiers.ctrl = false;
  mobileKeyboardModifiers.alt = false;
}

function updateMobileKeyboardModifierButtons() {
  if (!elMobileKeyboardRows) return;
  for (const button of elMobileKeyboardRows.querySelectorAll('[data-modifier]')) {
    button.classList.toggle('active', !!mobileKeyboardModifiers[button.dataset.modifier]);
  }
}

function sendMobileKeyCombo(def) {
  enterRemoteControlMode();
  const ctrl = mobileKeyboardModifiers.ctrl;
  const alt = mobileKeyboardModifiers.alt;
  const shift = mobileKeyboardModifiers.shift;
  const code = def.code || keyboardCodeForText(def.text || '');
  const key = def.key || def.text || def.label || '';

  if (def.action) {
    sendShortcut(def.action);
    clearMobileKeyboardModifiers();
    renderMobileKeyboard();
    return;
  }

  if (def.text != null && !ctrl && !alt) {
    let text = String(def.text);
    if (shift) {
      if (/^[a-z]$/i.test(text)) text = text.toUpperCase();
      else if (SHIFTED_NUMBER_TEXT[text]) text = SHIFTED_NUMBER_TEXT[text];
    }
    sendInput('text_input', { code, key: text, text, repeat: false }, true);
  } else if (code) {
    if (ctrl) sendInput('key_down', { code: 'ControlLeft', key: 'Control' }, true);
    if (alt) sendInput('key_down', { code: 'AltLeft', key: 'Alt' }, true);
    if (shift) sendInput('key_down', { code: 'ShiftLeft', key: 'Shift' }, true);
    sendInput('key_down', { code, key, repeat: false, ctrl, alt, shift }, true);
    sendInput('key_up', { code, key, ctrl, alt, shift }, true);
    if (shift) sendInput('key_up', { code: 'ShiftLeft', key: 'Shift' }, true);
    if (alt) sendInput('key_up', { code: 'AltLeft', key: 'Alt' }, true);
    if (ctrl) sendInput('key_up', { code: 'ControlLeft', key: 'Control' }, true);
  }

  clearMobileKeyboardModifiers();
  renderMobileKeyboard();
}

function handleMobileKeyboardKey(def) {
  if (def.layer) {
    mobileKeyboardLayer = def.layer;
    renderMobileKeyboard();
    return;
  }
  if (def.modifier) {
    mobileKeyboardModifiers[def.modifier] = !mobileKeyboardModifiers[def.modifier];
    updateMobileKeyboardModifierButtons();
    return;
  }
  sendMobileKeyCombo(def);
}

function renderMobileKeyboard() {
  if (!elMobileKeyboardRows) return;
  elMobileKeyboardRows.innerHTML = '';
  const rows = mobileKeyboardLayer === 'symbols' ? MOBILE_SYMBOL_ROWS : MOBILE_LETTER_ROWS;
  for (const rowDefs of rows) {
    const row = document.createElement('div');
    row.className = 'remote-keyboard-row';
    for (const rawDef of rowDefs) {
      const def = normalizeMobileKey(rawDef);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'remote-key' + (def.wide ? ' wide' : '') + (def.space ? ' space' : '') + (def.layer ? ' layer' : '');
      button.textContent = def.label || def.text || def.key || '';
      if (def.modifier) {
        button.dataset.modifier = def.modifier;
        button.classList.toggle('active', !!mobileKeyboardModifiers[def.modifier]);
      }
      button.addEventListener('click', () => handleMobileKeyboardKey(def));
      row.appendChild(button);
    }
    elMobileKeyboardRows.appendChild(row);
  }
}

function toggleMobileKeyboard(force) {
  if (!elMobileKeyboard || !isMobileViewerSurface()) return;
  mobileKeyboardOpen = typeof force === 'boolean' ? force : !mobileKeyboardOpen;
  elMobileKeyboard.classList.toggle('visible', mobileKeyboardOpen);
  elBtnKeyboard?.classList.toggle('active', mobileKeyboardOpen);
  if (!mobileKeyboardOpen) clearMobileKeyboardModifiers();
  renderMobileKeyboard();
  window.requestAnimationFrame(() => applyMobileViewport());
}

function sendMobileTextEntry() {
  if (!elMobileTextInput) return;
  const text = String(elMobileTextInput.value || '');
  if (!text) return;
  enterRemoteControlMode();
  sendInput('text_input', { text }, true);
  elMobileTextInput.value = '';
  elMobileTextInput.focus({ preventScroll: true });
}

renderMobileKeyboard();
elBtnKeyboard?.addEventListener('click', () => toggleMobileKeyboard());
elMobileKeyboardClose?.addEventListener('click', () => toggleMobileKeyboard(false));
elMobileTextSend?.addEventListener('click', sendMobileTextEntry);
elMobileTextInput?.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && !ev.shiftKey) {
    ev.preventDefault();
    ev.stopPropagation();
    sendMobileTextEntry();
  }
});

let remoteMonitors = [];
let currentMonitorIndex = 0;
let monitorMenuOpen = false;
let monitorMenuCloseTimer = null;
let pendingMonitorIndex = null;
let chatMessages = [];
const chatMessageKeys = new Set();
let chatMessageSequence = 0;
let remoteFileEntries = [];
let remoteFilePath = "/";

/* transition state */
let hasEverRenderedFrame = false;
let lastFrameAtMs = 0;
let lastFramesDecoded = 0;
let passiveOverlayActive = false;
let secureDesktopLikely = false;
let secureDesktopActive = false;
let desktopHandoffActive = false;
let revealOnNextFrame = false;
let monitorSwitchUntilMs = 0;
let lastKeyframeRequestAtMs = 0;
let overlayMode = "hard";

/* -----------------------------------------
   TURN / ICE config
------------------------------------------ */

const FALLBACK_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function normalizeIceServers(value) {
  if (!Array.isArray(value)) return [...FALLBACK_ICE_SERVERS];
  const safe = value.filter((server) => {
    if (!server || typeof server !== "object") return false;
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some((url) => typeof url === "string" && /^(stun|stuns|turn|turns):/i.test(url));
  }).map((server) => ({
    urls: server.urls,
    ...(typeof server.username === "string" ? { username: server.username } : {}),
    ...(typeof server.credential === "string" ? { credential: server.credential } : {})
  }));
  return safe.length ? safe : [...FALLBACK_ICE_SERVERS];
}

function activeIceServers() {
  return normalizeIceServers(currentSession?.iceServers);
}

const FRAME_STALL_MS = 950;
const MONITOR_SWITCH_GRACE_MS = 1800;
const NEGOTIATION_GRACE_MS = 2500;

/* -----------------------------------------
   UI helpers
------------------------------------------ */

function setStatus(dotClass, label) {
  const text = String(label || "");
  const hideActiveStreamTag =
    text === "Streaming" ||
    text.startsWith("Streaming ·") ||
    text === "Switching…" ||
    text === "Switching...";

  const statusChip = elStatusLabel?.closest(".session-meta");
  if (statusChip) statusChip.style.display = hideActiveStreamTag ? "none" : "";

  if (elStatusDot) elStatusDot.className = dotClass || "";
  if (elStatusLabel) elStatusLabel.textContent = hideActiveStreamTag ? "" : text;
}

async function ensureRemoteVideoPlayback(reason = "") {
  if (!elVideo || !elVideo.srcObject) return false;
  elVideo.autoplay = true;
  elVideo.playsInline = true;
  elVideo.muted = true;
  elVideo.defaultMuted = true;
  elVideo.setAttribute("playsinline", "");
  elVideo.setAttribute("webkit-playsinline", "");
  try {
    await elVideo.play();
    return true;
  } catch (err) {
    console.warn("[video] play() deferred", { reason, error: err?.message || String(err) });
    return false;
  }
}

function armDecodedFrameReveal() {
  if (!elVideo || typeof elVideo.requestVideoFrameCallback !== "function") return;
  try {
    elVideo.requestVideoFrameCallback(() => {
      markFrameRendered();
      updateResolution();
      refreshRemoteCursorPosition();
    });
  } catch {}
}

function setOverlayMode(mode) {
  overlayMode = mode;
  if (!elOverlay) return;
  elOverlay.classList.toggle("passive", mode === "passive");
  elOverlay.classList.toggle("secure-black", mode === "secure-black");
  elOverlay.classList.toggle("silent", mode === "silent");
  elOverlay.classList.toggle("secure-black-silent", mode === "secure-black-silent");
  elOverlay.classList.toggle("transition-hold", mode === "transition-hold");
}

function showOverlay(title, sub, {
  spinner = false,
  error = "",
  keepVideo = false,
  passive = false,
  secureBlack = false,
  silent = false
} = {}) {
  if (elOverlay) elOverlay.classList.remove("hidden");
  setMobileViewControlsVisible(false);

  let mode = "hard";
  if (secureBlack && silent) mode = "secure-black-silent";
  else if (secureBlack) mode = "secure-black";
  else if (silent) mode = "silent";
  else if (passive) mode = "passive";

  setOverlayMode(mode);

  if (elVideo) {
    if (keepVideo) elVideo.classList.add("visible");
    else elVideo.classList.remove("visible");
  }

  if (elStatsBar) {
    if (keepVideo) elStatsBar.classList.add("visible");
    else elStatsBar.classList.remove("visible");
  }

  hideRemoteCursor();
  closeMonitorMenu();

  if (elOverlayTitle) elOverlayTitle.textContent = title || "";
  if (elOverlaySub) elOverlaySub.textContent = sub || "";

  if (elSpinner) elSpinner.style.display = spinner ? "block" : "none";
  if (elErrorDetail) {
    elErrorDetail.style.display = error ? "block" : "none";
    elErrorDetail.textContent = error || "";
  }
}

function showPassiveOverlay() {
  // Intentionally silent: keep the recovery logic, but do not show
  // transitional overlays for monitor switches, stream stalls, handshake,
  // or normal desktop return.
  passiveOverlayActive = false;
}

function showSecureBlackOverlay({ spinner = false } = {}) {
  passiveOverlayActive = false;
  secureDesktopActive = true;
  if (hasEverRenderedFrame) {
    if (elOverlay) {
      elOverlay.classList.remove("hidden", "passive", "secure-black", "secure-black-silent");
      elOverlay.classList.add("silent", "transition-hold");
    }
    if (elVideo) elVideo.classList.add("visible");
    if (elStatsBar) elStatsBar.classList.add("visible");
    hideRemoteCursor();
    return;
  }
  showOverlay("", "", { spinner, keepVideo: false, secureBlack: true, silent: true });
}

function clearSecureDesktopState() {
  secureDesktopActive = false;
  desktopHandoffActive = false;
  secureDesktopLikely = false;
  revealOnNextFrame = false;
}

function hideOverlay() {
  passiveOverlayActive = false;
  if (elOverlay) elOverlay.classList.add("hidden");
  setOverlayMode("hard");
}

function showStream() {
  hideOverlay();
  if (elVideo) elVideo.classList.add("visible");
  if (elStatsBar) elStatsBar.classList.add("visible");
  if (isMobileViewerSurface()) {
    applyMobileViewport();
    setMobileViewControlsVisible(true);
  }
}

function markFrameRendered() {
  const firstRenderedFrame = !hasEverRenderedFrame;
  hasEverRenderedFrame = true;
  lastFrameAtMs = Date.now();

  if (secureDesktopActive || desktopHandoffActive) {
    return;
  }

  if (firstRenderedFrame || revealOnNextFrame) {
    revealOnNextFrame = false;
    secureDesktopLikely = false;
    showStream();
    setStatus("online", "Streaming");
    return;
  }

  if (secureDesktopLikely || passiveOverlayActive) {
    secureDesktopLikely = false;
    showStream();
    setStatus("online", "Streaming");
  }
}

function updateResolution() {
  if (!elVideo) return;
  if (elVideo.videoWidth && elVideo.videoHeight && elStatRes) {
    elStatRes.textContent = `${elVideo.videoWidth}×${elVideo.videoHeight}`;
  }
  if (isMobileViewerSurface()) applyMobileViewport();
  refreshRemoteCursorPosition();
}
if (elVideo) elVideo.addEventListener("resize", updateResolution);

function physicalMonitorOrdinal(index) {
  const physicalMonitors = remoteMonitors.filter(m => m.index >= 0);
  return physicalMonitors.findIndex(m => m.index === index) + 1;
}

function getMonitorLabel(monitor) {
  if (!monitor) return "Monitors";
  if (monitor.index === -1) return "All Monitors";
  return `Monitor ${physicalMonitorOrdinal(monitor.index)}`;
}

function updateMonitorButton() {
  if (!elBtnMonitor) return;

  if (!currentSession || remoteMonitors.length === 0) {
    elBtnMonitor.disabled = true;
    elBtnMonitor.textContent = "Monitors";
    return;
  }

  const current = remoteMonitors.find(m => m.index === currentMonitorIndex) || remoteMonitors[0];
  if (!current) {
    elBtnMonitor.disabled = true;
    elBtnMonitor.textContent = "Monitors";
    return;
  }

  elBtnMonitor.textContent = getMonitorLabel(current);
  elBtnMonitor.title = current.name || getMonitorLabel(current);
  elBtnMonitor.disabled = remoteMonitors.length <= 1;
}

function renderMonitorMenu() {
  if (!elMonitorMenu) return;

  const items = remoteMonitors.filter(m => m.index !== currentMonitorIndex);

  elMonitorMenu.innerHTML = "";
  if (items.length === 0) return;

  for (const monitor of items) {
    const btn = document.createElement("button");
    btn.className = "monitor-item";
    btn.type = "button";

    const title = document.createElement("div");
    title.className = "monitor-title";
    title.textContent = getMonitorLabel(monitor);

    const sub = document.createElement("div");
    sub.className = "monitor-sub";
    sub.textContent = monitor.name || `${monitor.w}×${monitor.h}`;

    btn.appendChild(title);
    btn.appendChild(sub);

    btn.addEventListener("click", () => {
      if (!ws || ws.readyState !== WebSocket.OPEN || !currentSession) return;

      pendingMonitorIndex = monitor.index;
      monitorSwitchUntilMs = Date.now() + MONITOR_SWITCH_GRACE_MS;

      ws.send(JSON.stringify({
        type: "switch_monitor",
        session_id: currentSession.sessionId,
        monitor_index: monitor.index
      }));

      closeMonitorMenu();
    });

    elMonitorMenu.appendChild(btn);
  }
}

function clearMonitorMenuCloseTimer() {
  if (monitorMenuCloseTimer) {
    clearTimeout(monitorMenuCloseTimer);
    monitorMenuCloseTimer = null;
  }
}

function scheduleMonitorMenuClose() {
  clearMonitorMenuCloseTimer();
  monitorMenuCloseTimer = setTimeout(() => {
    closeMonitorMenu();
  }, 120);
}

function openMonitorMenu() {
  if (!elMonitorMenu || !currentSession) return;
  renderMonitorMenu();
  if (!elMonitorMenu.children.length) return;
  clearMonitorMenuCloseTimer();
  elMonitorMenu.classList.add("visible");
  monitorMenuOpen = true;
}

function closeMonitorMenu() {
  clearMonitorMenuCloseTimer();
  if (!elMonitorMenu) return;
  elMonitorMenu.classList.remove("visible");
  monitorMenuOpen = false;
}

/* -----------------------------------------
   Remote cursor overlay
------------------------------------------ */

function ensureRemoteCursor() {
  if (remoteCursorEl) return remoteCursorEl;

  remoteCursorEl = document.createElement("div");
  remoteCursorEl.id = "remote-cursor-overlay";
  remoteCursorEl.style.position = "fixed";
  remoteCursorEl.style.left = "0";
  remoteCursorEl.style.top = "0";
  remoteCursorEl.style.width = "28px";
  remoteCursorEl.style.height = "28px";
  remoteCursorEl.style.pointerEvents = "none";
  remoteCursorEl.style.zIndex = "99999";
  remoteCursorEl.style.display = "none";
  remoteCursorEl.style.transform = "translate3d(0, 0, 0)";
  remoteCursorEl.style.willChange = "transform";
  remoteCursorEl.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.5))";

  remoteCursorEl.innerHTML = `
    <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible">
      <path d="M2 1 L2 22 L7.8 16.7 L11.6 25.4 L15.3 23.8 L11.5 15.2 L19.2 15.2 Z"
            fill="white" stroke="black" stroke-width="1.35" stroke-linejoin="round"/>
    </svg>
  `;

  document.body.appendChild(remoteCursorEl);
  return remoteCursorEl;
}

function hideRemoteCursor() {
  if (remoteCursorEl) {
    remoteCursorEl.style.display = "none";
  }
}

function moveRemoteCursorByClient(clientX, clientY) {
  if (isMobileViewerSurface()) { hideRemoteCursor(); return; }
  const cursor = ensureRemoteCursor();
  cursor.style.display = "block";
  cursor.style.transform = `translate3d(${Math.round(clientX)}px, ${Math.round(clientY)}px, 0)`;
}

async function openFileBrowserWindow() {
  try {
    if (typeof window.hi5OpenFileBrowserWindow === "function") {
      await window.hi5OpenFileBrowserWindow("");
      return true;
    }
    if (typeof window.hi5?.openFileBrowserWindow === "function") {
      await window.hi5.openFileBrowserWindow();
      return true;
    }
  } catch (e) {
    console.warn("[files] native file browser open failed:", e);
  }

  if (elFilesPanel) elFilesPanel.classList.add("visible");
  return false;
}

async function closeFileBrowserWindow() {
  try {
    if (typeof window.hi5CloseFileBrowserWindow === "function") {
      await window.hi5CloseFileBrowserWindow("");
    } else if (typeof window.hi5?.closeFileBrowserWindow === "function") {
      await window.hi5.closeFileBrowserWindow();
    }
  } catch {}
  if (elFilesPanel) elFilesPanel.classList.remove("visible");
}

function postFileToNativeWindow(msg) {
  const json = JSON.stringify(msg || {});
  try {
    if (typeof window.hi5PostFileMessageToWindow === "function") {
      window.hi5PostFileMessageToWindow(json);
    } else if (typeof window.hi5?.postFileMessageToWindow === "function") {
      window.hi5.postFileMessageToWindow(json);
    }
  } catch (e) {
    console.warn("[files] post to native file window failed:", e);
  }
}

function toggleFilesPanel(force) {
  const open = typeof force === "boolean" ? force : true;
  if (open) openFileBrowserWindow(); else closeFileBrowserWindow();
}

function getChatBody(msg) {
  return String(
    msg?.body ??
    msg?.message ??
    msg?.text ??
    msg?.content ??
    ""
  ).trim();
}

function normalizeChatSender(sender) {
  const s = String(sender || "").toLowerCase();
  return (s === "tech" || s === "technician" || s === "viewer" || s === "me") ? "tech" : "user";
}

function createChatMessageId() {
  try { if (crypto?.randomUUID) return crypto.randomUUID(); } catch {}
  chatMessageSequence += 1;
  return `chat-${Date.now()}-${chatMessageSequence}`;
}

function chatMessageKey(msg) {
  const id = String(msg?.message_id || msg?.messageId || "").trim();
  if (id) return `id:${id}`;
  const body = getChatBody(msg);
  const sender = normalizeChatSender(msg?.sender);
  const stamp = String(msg?.unix_ms ?? msg?.timestamp ?? msg?.ts ?? "");
  return stamp ? `event:${sender}:${stamp}:${body}` : "";
}

function appendChatMessage(msg) {
  if (!msg) return null;
  const body = getChatBody(msg);
  if (!body) return null;
  const messageId = String(msg.message_id || msg.messageId || "").trim() || createChatMessageId();
  const normalized = {
    ...msg,
    message_id: messageId,
    messageId: messageId,
    sender: normalizeChatSender(msg.sender),
    body,
    message: body,
    text: body
  };
  const key = chatMessageKey(normalized);
  if (key && chatMessageKeys.has(key)) return null;
  if (key) chatMessageKeys.add(key);
  chatMessages.push(normalized);
  return normalized;
}

async function openTechChatWindow() {
  leaveRemoteControlMode();
  if (isMobileViewerSurface()) toggleMobileKeyboard(false);
  try {
    if (typeof window.hi5OpenChatWindow === "function") {
      await window.hi5OpenChatWindow("");
      syncChatWindow();
      return true;
    }
    if (typeof window.hi5?.openChatWindow === "function") {
      await window.hi5.openChatWindow();
      syncChatWindow();
      return true;
    }
  } catch (e) {
    console.warn("[chat] native open chat failed:", e);
  }

  // Browser/mobile fallback: keep chat inside the Viewer and let the OS
  // keyboard own the text field instead of the remote keyboard interceptor.
  if (elChatPanel) elChatPanel.classList.add("visible");
  renderChat();
  if (isMobileViewerSurface() && elChatInput) {
    setTimeout(() => { try { elChatInput.focus({ preventScroll: true }); } catch { try { elChatInput.focus(); } catch {} } }, 60);
  }
  return false;
}

async function closeTechChatWindow() {
  try {
    if (typeof window.hi5CloseChatWindow === "function") {
      await window.hi5CloseChatWindow("");
    } else if (typeof window.hi5?.closeChatWindow === "function") {
      await window.hi5.closeChatWindow();
    }
  } catch {}
  if (elChatPanel) elChatPanel.classList.remove("visible");
}

function postChatToNativeWindow(msg) {
  const body = getChatBody(msg);
  if (!body) return;

  const payload = {
    ...msg,
    sender: normalizeChatSender(msg.sender),
    body,
    message: body,
    text: body
  };

  const json = JSON.stringify(payload);

  try {
    if (typeof window.hi5PostChatMessageToWindow === "function") {
      window.hi5PostChatMessageToWindow(json);
    } else if (typeof window.hi5?.postChatMessageToWindow === "function") {
      window.hi5.postChatMessageToWindow(json);
    }
  } catch (e) {
    console.warn("[chat] post to native chat window failed:", e);
  }
}

function syncChatWindow() {
  for (const msg of chatMessages) {
    postChatToNativeWindow(msg);
  }
}

function toggleChatPanel(force) {
  const open = typeof force === "boolean" ? force : true;
  if (open) {
    openTechChatWindow();
  } else {
    closeTechChatWindow();
  }
}

function renderChat() {
  if (!elChatLog) return;
  elChatLog.innerHTML = "";

  for (const msg of chatMessages) {
    const bodyText = getChatBody(msg);
    if (!bodyText) continue;

    const sender = normalizeChatSender(msg.sender);
    const item = document.createElement("div");
    item.className = `chat-bubble ${sender}`;

    const meta = document.createElement("div");
    meta.className = "chat-meta";
    meta.textContent = msg.display_name || msg.displayName || (sender === "tech" ? "Technician" : "Remote user");

    const body = document.createElement("div");
    body.className = "chat-body";
    body.textContent = bodyText;

    item.appendChild(meta);
    item.appendChild(body);
    elChatLog.appendChild(item);
  }

  elChatLog.scrollTop = elChatLog.scrollHeight;
}

function setMobileFileStatus(text) {
  if (elFileMobileStatus) elFileMobileStatus.textContent = text || "";
}

function joinRemoteFilePath(base, name) {
  base = String(base || "/");
  name = String(name || "").replace(/^[\\/]+/, "");
  if (!base || base === "/") return "/" + name;
  if (/[\\/]$/.test(base)) return base + name;
  return base + (base.includes("\\") ? "\\" : "/") + name;
}

function base64ToBytes(data) {
  const bin = atob(String(data || ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes) {
  let bin = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + step)));
  }
  return btoa(bin);
}

function saveBrowserFile(name, parts) {
  const blob = new Blob(parts, { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name || "download";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const browserDownloadPaths = new Set();
const browserChunkDownloads = new Map();

function requestBrowserDownload(entry) {
  const path = String(entry?.path || "");
  if (!path) return;
  browserDownloadPaths.add(path);
  setMobileFileStatus(`Downloading ${entry.name || "file"}…`);
  if (!sendRemoteFileRequest("remote_file_download_request", { path })) {
    browserDownloadPaths.delete(path);
    setMobileFileStatus("Could not start download.");
  }
}

async function uploadBrowserFiles(files) {
  const list = Array.from(files || []);
  if (!list.length) return;
  const inlineBytes = 384 * 1024;
  const chunkBytes = 48 * 1024;
  for (const file of list) {
    const dest = joinRemoteFilePath(remoteFilePath, file.name);
    setMobileFileStatus(`Uploading ${file.name}…`);
    if (file.size <= inlineBytes) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!sendRemoteFileRequest("remote_file_upload_request", { path: dest, data: bytesToBase64(bytes) })) {
        setMobileFileStatus(`Could not upload ${file.name}.`);
        break;
      }
      continue;
    }
    const transferId = `ul-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    if (!sendRemoteFileRequest("remote_file_upload_start", { transfer_id: transferId, path: dest, name: file.name, size: file.size })) {
      setMobileFileStatus(`Could not start upload for ${file.name}.`);
      break;
    }
    let offset = 0;
    let chunkIndex = 0;
    while (offset < file.size) {
      const end = Math.min(file.size, offset + chunkBytes);
      const bytes = new Uint8Array(await file.slice(offset, end).arrayBuffer());
      if (!sendRemoteFileRequest("remote_file_upload_chunk", { transfer_id: transferId, path: dest, chunk_index: chunkIndex++, offset, size: bytes.length, data: bytesToBase64(bytes) })) {
        setMobileFileStatus(`Upload interrupted for ${file.name}.`);
        return;
      }
      offset = end;
      setMobileFileStatus(`Uploading ${file.name}… ${Math.round(offset / file.size * 100)}%`);
      if ((chunkIndex % 8) === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    sendRemoteFileRequest("remote_file_upload_complete_request", { transfer_id: transferId, path: dest, size: file.size });
  }
}

function renderRemoteFiles() {
  if (!elFileList) return;
  elFileList.innerHTML = "";
  for (const entry of remoteFileEntries) {
    const row = document.createElement("div");
    row.className = "file-entry";
    const main = document.createElement("div");
    main.className = "file-main";
    const title = document.createElement("div");
    title.textContent = `${entry.is_dir ? "📁" : "📄"} ${entry.name}`;
    const meta = document.createElement("div");
    meta.className = "file-meta";
    meta.textContent = entry.is_dir ? "Folder" : `${entry.size || 0} bytes`;
    main.appendChild(title);
    main.appendChild(meta);
    row.appendChild(main);
    if (entry.is_dir) {
      row.addEventListener("click", () => requestRemoteFileList(entry.path || entry.name));
    } else {
      const dl = document.createElement("button");
      dl.className = "file-download";
      dl.type = "button";
      dl.textContent = "Download";
      dl.addEventListener("click", (ev) => { ev.stopPropagation(); requestBrowserDownload(entry); });
      row.appendChild(dl);
    }
    elFileList.appendChild(row);
  }
}

function sendRemoteFileRequest(fileType, payload = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !currentSession) return false;

  const directPayload = {
    type: fileType,
    session_id: currentSession.sessionId,
    sessionId: currentSession.sessionId,
    ...payload
  };

  // Direct file-browser path only. The control server now forwards remote_file_*
  // and file_transfer_* messages, so do not tunnel through chat_message.
  try { ws.send(JSON.stringify(directPayload)); } catch { return false; }
  return true;
}

function normalizeFileMessage(msg) {
  if (!msg) return null;
  if (msg.channel === "file_browser") {
    const nested = msg.payload && typeof msg.payload === "object" ? msg.payload : {};
    return { ...msg, ...nested, type: msg.file_type || msg.fileType || nested.type };
  }
  return msg;
}

function requestRemoteFileList(path) {
  remoteFilePath = path || "/";
  if (elFilePath) elFilePath.value = remoteFilePath;
  sendRemoteFileRequest("remote_file_list_request", { path: remoteFilePath });
}

const pendingRemoteDownloads = new Map();

window.__hi5FilesRequestRemoteList = function(path) {
  requestRemoteFileList(path || "/");
};

window.__hi5FilesUploadRemote = function(req) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !currentSession || !req) return false;
  return sendRemoteFileRequest("remote_file_upload_request", { path: req.path, data: req.data || "" });
};

window.__hi5FilesDownloadRemote = function(req) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !currentSession || !req) return false;
  if (req.local_dir) pendingRemoteDownloads.set(String(req.path || ""), String(req.local_dir));
  return sendRemoteFileRequest("remote_file_download_request", { path: req.path });
};

window.__hi5FilesDeleteRemote = function(path) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !currentSession) return false;
  return sendRemoteFileRequest("remote_file_delete_request", { path });
};

window.__hi5FilesMkdirRemote = function(path) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !currentSession) return false;
  return sendRemoteFileRequest("remote_file_mkdir_request", { path });
};

window.__hi5FilesRenameRemote = function(req) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !currentSession || !req) return false;
  return sendRemoteFileRequest("remote_file_rename_request", { from: req.from, to: req.to });
};

function sendChatMessageBody(body) {
  body = String(body || "").trim();
  if (!body || !ws || ws.readyState !== WebSocket.OPEN || !currentSession) return false;

  const messageId = createChatMessageId();
  const payload = {
    type: "chat_message",
    session_id: currentSession.sessionId,
    sessionId: currentSession.sessionId,
    message_id: messageId,
    messageId: messageId,
    sender: "tech",
    display_name: "Technician",
    displayName: "Technician",
    body,
    message: body,
    text: body
  };

  ws.send(JSON.stringify(payload));

  const appended = appendChatMessage(payload);
  if (appended) {
    renderChat();
    postChatToNativeWindow(appended);
  }
  return true;
}

function sendChatMessage() {
  const body = (elChatInput?.value || "").trim();
  if (!sendChatMessageBody(body)) return;
  if (elChatInput) {
    elChatInput.value = "";
    try { elChatInput.focus(); } catch {}
  }
}

window.__hi5ChatSendFromNative = function(body) {
  return sendChatMessageBody(body);
};

function showRemoteCursor() {
  if (isMobileViewerSurface()) { hideRemoteCursor(); return; }
  const el = ensureRemoteCursor();
  el.style.display = "block";
}

function getVideoContentRect(el) {
  const rect = el.getBoundingClientRect();
  const objectFit = String(getComputedStyle(el).objectFit || "fill").toLowerCase();

  if (objectFit === "fill") {
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }

  const vw = el.videoWidth || 1;
  const vh = el.videoHeight || 1;
  const elementAspect = rect.width / rect.height;
  const videoAspect = vw / vh;

  let drawWidth, drawHeight, offsetX, offsetY;
  if (elementAspect > videoAspect) {
    drawHeight = rect.height;
    drawWidth = drawHeight * videoAspect;
    offsetX = (rect.width - drawWidth) / 2;
    offsetY = 0;
  } else {
    drawWidth = rect.width;
    drawHeight = drawWidth / videoAspect;
    offsetX = 0;
    offsetY = (rect.height - drawHeight) / 2;
  }

  return {
    left: rect.left + offsetX,
    top: rect.top + offsetY,
    width: drawWidth,
    height: drawHeight
  };
}

function moveRemoteCursorByNorm(xNorm, yNorm) {
  if (!elVideo || !elVideo.videoWidth || !elVideo.videoHeight) return;

  lastCursorNorm = {
    x_norm: Math.max(0, Math.min(1, xNorm)),
    y_norm: Math.max(0, Math.min(1, yNorm))
  };

  const r = getVideoContentRect(elVideo);
  const x = r.left + (lastCursorNorm.x_norm * r.width);
  const y = r.top + (lastCursorNorm.y_norm * r.height);

  moveRemoteCursorByClient(x, y);
}

function refreshRemoteCursorPosition() {
  if (!lastCursorNorm) return;
  moveRemoteCursorByNorm(lastCursorNorm.x_norm, lastCursorNorm.y_norm);
}

/* -----------------------------------------
   Cleanup / control mode
------------------------------------------ */

function stopStatsPoll() {
  if (statsTimer) {
    clearInterval(statsTimer);
    statsTimer = null;
  }
  if (transitionWatchdogTimer) {
    clearInterval(transitionWatchdogTimer);
    transitionWatchdogTimer = null;
  }
  lastStats = { tsMs: 0, bytes: 0, frames: 0, packetsLost: 0, jitterDelay: 0, jitterEmitted: 0 };
  lastFramesDecoded = 0;
}

function startTransitionWatchdog() {
  if (transitionWatchdogTimer) return;

  transitionWatchdogTimer = setInterval(() => {
    if (!pc || pc.connectionState !== "connected") return;

    const now = Date.now();

    if (!hasEverRenderedFrame) {
      if (lastFrameAtMs && now >= lastFrameAtMs) {
        requestRemoteKeyframe("initial-frame-timeout");
        ensureRemoteVideoPlayback("initial-frame-timeout");
      }
      return;
    }

    if (monitorSwitchUntilMs && now < monitorSwitchUntilMs) {
      return;
    }

    if (secureDesktopActive || desktopHandoffActive) {
      return;
    }

    if (now - lastFrameAtMs > FRAME_STALL_MS) {
      secureDesktopLikely = true;
      requestRemoteKeyframe("decoded-frame-stall");
      ensureRemoteVideoPlayback("decoded-frame-stall");
    }
  }, 250);
}

function enterRemoteControlMode() {
  controlActive = true;
  if (elVideo) {
    elVideo.style.cursor = "none";
    try { elVideo.focus(); } catch {}
  }
  showRemoteCursor();
  refreshRemoteCursorPosition();
}

function requestRemoteKeyframe(reason = "viewer-recovery") {
  if (!currentSession || !inputDc || inputDc.readyState !== "open") return false;
  const now = Date.now();
  if (now - lastKeyframeRequestAtMs < 1200) return false;
  lastKeyframeRequestAtMs = now;
  try {
    inputDc.send(JSON.stringify({ kind: "request_keyframe", reason }));
    console.log("[video] requested remote keyframe", { reason });
    return true;
  } catch (err) {
    console.warn("[video] keyframe request failed", err);
    return false;
  }
}

function sendInput(kind, extra = {}, force = false) {
  if (!currentSession) return;
  if (!force && !controlActive) return;

  const payload = JSON.stringify({ kind, ...extra });

  if (inputDc && inputDc.readyState === "open") {
    inputDc.send(payload);
    return;
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: "input_event",
      kind,
      session_id: currentSession.sessionId,
      ...extra,
    }));
  }
}

function updateSessionToggleButtons() {
  if (elBtnAudio) {
    elBtnAudio.classList.toggle("session-toggle-active", audioEnabled);
    elBtnAudio.innerHTML = `${audioEnabled ? "🔊" : "🔇"}<span class="label">Audio</span>`;
    elBtnAudio.title = audioEnabled ? "Mute remote audio" : "Play remote audio";
  }
  if (elBtnBlockInput) {
    elBtnBlockInput.classList.toggle("session-toggle-active", localInputBlocked);
    elBtnBlockInput.innerHTML = `${localInputBlocked ? "🔒" : "🔓"}<span class="label">User input</span>`;
    elBtnBlockInput.title = localInputBlocked
      ? "Allow the local user's keyboard and mouse"
      : "Block the local user's keyboard and mouse";
  }
}

function setRemoteAudioEnabled(enabled) {
  audioEnabled = !!enabled;
  if (elAudio) {
    elAudio.muted = !audioEnabled;
    elAudio.defaultMuted = !audioEnabled;
    if (audioEnabled) elAudio.play().catch(() => {});
  }
  updateSessionToggleButtons();
}

function setLocalInputBlocked(blocked, notifyAgent = true) {
  localInputBlocked = !!blocked;
  if (notifyAgent && currentSession) {
    sendInput("local_input_block", { blocked: localInputBlocked }, true);
  }
  updateSessionToggleButtons();
}

function sendShortcut(action) {
  if (!currentSession) return false;
  enterRemoteControlMode();

  // Ctrl+Alt+Del is special: send a dedicated service-side command first,
  // then also send the normal shortcut as a nested/VM fallback.
  if (action === "ctrl_alt_del" || action === "ctrl_alt_del_service" || action === "sas") {
    const servicePayload = {
      type: "service_shortcut",
      kind: "service_shortcut",
      action: "ctrl_alt_del_service",
      session_id: currentSession.sessionId,
    };

    try {
      if (inputDc && inputDc.readyState === "open") {
        inputDc.send(JSON.stringify(servicePayload));
        return true;
      }
    } catch {}

    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(servicePayload));
        return true;
      }
    } catch {}

    return false;
  }

  sendInput("shortcut", { action }, true);
  return true;
}

const NON_TEXT_KEYS = new Set([
  "Alt", "AltGraph", "CapsLock", "Control", "Dead", "Delete", "End",
  "Enter", "Escape", "Fn", "FnLock", "Home", "Hyper", "Insert",
  "Meta", "NumLock", "OS", "PageDown", "PageUp", "Process",
  "ScrollLock", "Shift", "Super", "Symbol", "SymbolLock",
  "Tab", "Unidentified", "ContextMenu", "Pause", "PrintScreen"
]);

function isModifierCode(code) {
  return code === "ShiftLeft" || code === "ShiftRight" ||
    code === "ControlLeft" || code === "ControlRight" ||
    code === "AltLeft" || code === "AltRight" ||
    code === "MetaLeft" || code === "MetaRight";
}

function isPrintableKey(ev) {
  if (!ev || ev.metaKey) return false;
  const altGraph = !!ev.getModifierState?.("AltGraph");
  // Browsers commonly expose AltGr as Ctrl+Alt. When AltGraph produced a
  // printable character, send the actual Unicode character instead of a
  // physical US-layout key combination.
  if ((ev.ctrlKey || ev.altKey) && !altGraph) return false;
  if (isModifierCode(ev.code)) return false;
  if (typeof ev.key !== "string") return false;
  if (ev.key.length === 0) return false;
  if (NON_TEXT_KEYS.has(ev.key)) return false;
  return Array.from(ev.key).length === 1;
}

window.__hi5NativeShortcut = function(action) {
  try {
    if (typeof action === "string" && action.length > 0) {
      releaseAllKeys();
      sendShortcut(action);
      return true;
    }
  } catch (err) {
    console.warn("[viewer] native shortcut dispatch failed", err);
  }
  return false;
};

function sendBackstageMode(enabled) {
  if (!currentSession) return false;
  const targetMode = enabled ? "backstage" : "console";
  if (currentSession.launchMode && currentSession.launchMode !== targetMode) {
    console.warn("[viewer] remote mode switch rejected by immutable session mode", { launchMode: currentSession.launchMode, targetMode });
    return false;
  }

  const type = enabled ? "backstage_start" : "backstage_stop";
  const payload = JSON.stringify({
    type,
    kind: type,
    session_id: currentSession.sessionId,
  });

  let sent = false;

  // Prefer the established WebRTC data channel. The control server may not
  // forward new viewer->agent message types, but the data channel goes direct
  // to the agent's active session input handler.
  if (inputDc && inputDc.readyState === "open") {
    try {
      inputDc.send(payload);
      sent = true;
      console.log("[backstage] sent over datachannel", { type });
    } catch (err) {
      console.warn("[backstage] datachannel send failed", err);
    }
  }

  // Fallback for older agents/control servers.
  if (!sent && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, session_id: currentSession.sessionId }));
    sent = true;
    console.log("[backstage] sent over websocket fallback", { type });
  }

  if (!sent) return false;

  setStatus("online", enabled ? "Backstage Desktop" : "Streaming");
  if (enabled) {
    showOverlay("Backstage Desktop", "Starting private tools workspace…", { spinner: true, keepVideo: true, passive: true });
  } else {
    showOverlay("Console", "Returning to interactive console…", { spinner: true, keepVideo: true, passive: true });
  }
  return true;
}

function releaseAllKeys() {
  if (!currentSession) {
    pressedKeys.clear();
    return;
  }

  for (const code of Array.from(pressedKeys)) {
    sendInput("key_up", { code }, true);
  }
  pressedKeys.clear();
}

function leaveRemoteControlMode() {
  releaseAllKeys();
  controlActive = false;

  if (elVideo) {
    elVideo.style.cursor = "default";
  }
  hideRemoteCursor();
}

function resetTransitionState() {
  hasEverRenderedFrame = false;
  lastFrameAtMs = 0;
  lastFramesDecoded = 0;
  passiveOverlayActive = false;
  secureDesktopLikely = false;
  secureDesktopActive = false;
  desktopHandoffActive = false;
  revealOnNextFrame = false;
  monitorSwitchUntilMs = 0;
  lastKeyframeRequestAtMs = 0;
  overlayMode = "hard";
}

function disconnect(reason, options = {}) {
  const silent = !!options.silent;
  const closeNative = !!options.closeNative;
  console.log("[viewer] disconnect called:", reason || "(none)", silent ? "silent" : "", closeNative ? "close-native" : "");
  stopStatsPoll();

  remoteDescSet = false;
  pendingRemoteIce = [];
  lastCursorNorm = null;

  remoteMonitors = [];
  currentMonitorIndex = 0;
  pendingMonitorIndex = null;
  updateMonitorButton();
  closeMonitorMenu();

  leaveRemoteControlMode();
  hideRemoteCursor();
  resetTransitionState();

  if (localInputBlocked && currentSession) {
    try { sendInput("local_input_block", { blocked: false }, true); } catch {}
    localInputBlocked = false;
  }
  setRemoteAudioEnabled(false);
  updateSessionToggleButtons();

  if (!silent && ws && ws.readyState === WebSocket.OPEN && currentSession) {
    try {
      ws.send(JSON.stringify({
        type: "chat_close",
        session_id: currentSession.sessionId,
        close_remote: true,
        reason: reason || "viewer_disconnect"
      }));
    } catch {}
    try {
      ws.send(JSON.stringify({
        type: "viewer_disconnected",
        session_id: currentSession.sessionId
      }));
    } catch {}
  }

  try { closeTechChatWindow(); } catch {}

  if (inputDc) {
    try { inputDc.close(); } catch {}
    inputDc = null;
  }

  if (pc) {
    try { pc.close(); } catch {}
    pc = null;
  }
  if (ws) {
    try { ws.onopen = null; ws.onmessage = null; ws.onerror = null; ws.onclose = null; } catch {}
    try { ws.close(); } catch {}
    ws = null;
  }

  if (elVideo) {
    try { elVideo.pause(); } catch {}
    elVideo.srcObject = null;
    elVideo.classList.remove("visible");
  }

  if (elBtnDisc) elBtnDisc.disabled = true;
  if (elBtnFiles) elBtnFiles.disabled = true;
  if (elBtnChat) elBtnChat.disabled = true;
  if (elBtnAudio) elBtnAudio.disabled = true;
  if (elBtnBlockInput) elBtnBlockInput.disabled = true;
  if (elBtnKeyboard) elBtnKeyboard.disabled = true;
  if (mobileKeyboardOpen) toggleMobileKeyboard(false);
  if (elBtnBackstage) elBtnBackstage.disabled = true;
  if (elBtnConsole) elBtnConsole.disabled = true;
  if (elBtnStartMenu) elBtnStartMenu.disabled = true;
  if (elBtnCad) elBtnCad.disabled = true;
  if (elDeviceLabel) elDeviceLabel.textContent = "";
  currentSession = null;

  setStatus("", reason || "Disconnected");
  showOverlay(
    reason ? "Disconnected" : "Hi5Central Viewer",
    reason || "Launch this app from Hi5Central to start a remote desktop session."
  );

  if (!silent) {
    try { window.hi5?.notifyDisconnected?.(); } catch {}
  }
  if (closeNative) {
    try { window.hi5?.closeViewer?.(); } catch {}
  }
}

window.__hi5NativeCloseRequested = function() {
  disconnect("Disconnected by technician", { closeNative: true });
};

if (elBtnDisc) {
  elBtnDisc.addEventListener("click", () => disconnect("Disconnected by technician", { closeNative: true }));
}
if (elBtnAudio) {
  elBtnAudio.addEventListener("click", () => setRemoteAudioEnabled(!audioEnabled));
}
if (elBtnBlockInput) {
  elBtnBlockInput.addEventListener("click", () => setLocalInputBlocked(!localInputBlocked, true));
}

if (elBtnMonitor) {
  elBtnMonitor.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (monitorMenuOpen) {
      closeMonitorMenu();
    } else {
      openMonitorMenu();
    }
  });

  elBtnMonitor.addEventListener("mouseenter", () => {
    if (currentSession && remoteMonitors.length > 1) {
      openMonitorMenu();
    }
  });

  elBtnMonitor.addEventListener("mouseleave", () => {
    scheduleMonitorMenuClose();
  });
}

if (elMonitorMenu) {
  elMonitorMenu.addEventListener("mouseenter", () => {
    clearMonitorMenuCloseTimer();
  });

  elMonitorMenu.addEventListener("mouseleave", () => {
    scheduleMonitorMenuClose();
  });
}

document.addEventListener("click", (ev) => {
  if (!monitorMenuOpen) return;
  if (elMonitorMenu?.contains(ev.target)) return;
  if (elBtnMonitor?.contains(ev.target)) return;
  closeMonitorMenu();
});

/* -----------------------------------------
   Stats
------------------------------------------ */

function startStatsPoll() {
  if (statsTimer) return;
  statsTimer = setInterval(() => pollStatsOnce().catch(() => {}), 1000);
  startTransitionWatchdog();
}

function fmtKbps(kbps) {
  if (!isFinite(kbps) || kbps < 0) return "—";
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(2)} Mbps`;
  return `${Math.round(kbps)} kbps`;
}

async function pollStatsOnce() {
  if (!pc) return;
  const stats = await pc.getStats();

  let inbound = null;
  let selectedPair = null;

  stats.forEach((r) => {
    if (r.type === "inbound-rtp") {
      const isVideo = (r.kind === "video") || (r.mediaType === "video");
      if (isVideo) inbound = r;
    }
    if (r.type === "candidate-pair" && r.nominated && (r.state === "succeeded" || r.state === "in-progress")) {
      selectedPair = r;
    }
  });

  const nowMs = Date.now();

  let bitrateKbps = NaN;
  let fps = NaN;
  let framesDecoded = null;
  let packetsLost = null;
  let jitterMs = null;
  let jitterBufferMs = null;

  if (inbound) {
    const bytesReceived = Number(inbound.bytesReceived || 0);
    framesDecoded = Number(inbound.framesDecoded || 0);
    packetsLost = Number(inbound.packetsLost || 0);
    jitterMs = Number.isFinite(Number(inbound.jitter)) ? Number(inbound.jitter) * 1000 : null;
    const jitterDelay = Number(inbound.jitterBufferDelay || 0);
    const jitterEmitted = Number(inbound.jitterBufferEmittedCount || 0);
    if (jitterEmitted > lastStats.jitterEmitted) {
      const emittedDelta = jitterEmitted - lastStats.jitterEmitted;
      const delayDelta = jitterDelay - lastStats.jitterDelay;
      if (emittedDelta > 0 && delayDelta >= 0) jitterBufferMs = (delayDelta / emittedDelta) * 1000;
    }

    if (framesDecoded > lastFramesDecoded) {
      lastFramesDecoded = framesDecoded;
      markFrameRendered();
      if (monitorSwitchUntilMs && nowMs >= monitorSwitchUntilMs) {
        monitorSwitchUntilMs = 0;
      }
    }

    if (lastStats.tsMs) {
      const dt = (nowMs - lastStats.tsMs) / 1000;
      if (dt > 0.2) {
        const dBytes = bytesReceived - lastStats.bytes;
        bitrateKbps = (dBytes * 8) / dt / 1000;

        const dFrames = framesDecoded - lastStats.frames;
        fps = dFrames / dt;
      }
    }

    lastStats.tsMs = nowMs;
    lastStats.bytes = bytesReceived;
    lastStats.frames = framesDecoded;
    lastStats.packetsLost = packetsLost;
    lastStats.jitterDelay = jitterDelay;
    lastStats.jitterEmitted = jitterEmitted;
  }

  const rttMs = selectedPair && isFinite(selectedPair.currentRoundTripTime)
    ? Math.round(selectedPair.currentRoundTripTime * 1000)
    : null;

  // Diagnostics are advisory and should never fall back to the signaling WebSocket
  // as an input event. Send them only on the established WebRTC control channel.
  if (inputDc && inputDc.readyState === "open") {
    try {
      inputDc.send(JSON.stringify({
        kind: "viewer_diagnostics",
        rtt_ms: rttMs ?? 0,
        jitter_ms: Number.isFinite(jitterMs) ? jitterMs : 0,
        jitter_buffer_ms: Number.isFinite(jitterBufferMs) ? jitterBufferMs : 0,
        bitrate_kbps: Number.isFinite(bitrateKbps) ? bitrateKbps : 0,
        fps: Number.isFinite(fps) ? fps : 0,
        packets_lost: packetsLost ?? 0
      }));
    } catch {}
  }

  const state = pc.connectionState || pc.iceConnectionState || "—";
  const brStr  = fmtKbps(bitrateKbps);
  const fpsStr = isFinite(fps) ? `${Math.round(fps)} fps` : "— fps";
  const frmStr = (framesDecoded != null) ? `frames ${framesDecoded}` : "frames —";
  const lossStr = (packetsLost != null) ? `lost ${packetsLost}` : "lost —";
  const rttStr = (rttMs != null) ? `rtt ${rttMs}ms` : "rtt —";

  if (elStatState) {
    elStatState.textContent = `${state} · ${brStr} · ${fpsStr} · ${frmStr} · ${lossStr} · ${rttStr}`;
  }
  if (elDiagIceState) elDiagIceState.textContent = pc.iceConnectionState || "—";
  if (elDiagConnState) elDiagConnState.textContent = pc.connectionState || "—";
  if (elDiagCandidatePair) elDiagCandidatePair.textContent = selectedPair ? `${selectedPair.localCandidateId || "local"} → ${selectedPair.remoteCandidateId || "remote"}` : "—";
  if (elDiagBitrate) elDiagBitrate.textContent = brStr;
  if (elDiagFps) elDiagFps.textContent = fpsStr;
  if (elDiagFrames) elDiagFrames.textContent = String(framesDecoded ?? "—");
  if (elDiagPacketsLost) elDiagPacketsLost.textContent = String(packetsLost ?? "—");
  if (elDiagRtt) elDiagRtt.textContent = rttMs != null ? `${rttMs}ms` : "—";
  if (elDiagIceServers) elDiagIceServers.textContent = activeIceServers().map(s => Array.isArray(s.urls) ? s.urls.join(",") : s.urls).join(" | ");

  updateSelectedCodecFromStats();
  console.log("[stats]", { state, bitrate: brStr, fps, framesDecoded, packetsLost, rttMs });
}

/* -----------------------------------------
   Input helpers
------------------------------------------ */

function getNormalizedPointer(ev) {
  const r = getVideoContentRect(elVideo);
  const x = (ev.clientX - r.left) / r.width;
  const y = (ev.clientY - r.top) / r.height;

  return {
    x_norm: Math.max(0, Math.min(1, x)),
    y_norm: Math.max(0, Math.min(1, y))
  };
}

function bindRemoteInput() {
  if (inputBound || !elVideo) return;
  inputBound = true;

  elVideo.tabIndex = 0;
  elVideo.style.outline = "none";
  elVideo.style.border = "none";
  elVideo.style.cursor = "default";
  elVideo.style.touchAction = "none";

  // Some mobile browsers/WebViews emit compatibility mouse events after
  // PointerEvents. Suppress that duplicate path so one tap is one remote click.
  let suppressCompatibilityMouseUntilMs = 0;
  const noteTouchInteraction = () => {
    suppressCompatibilityMouseUntilMs = Date.now() + 1200;
  };
  const compatibilityMouseSuppressed = () => Date.now() < suppressCompatibilityMouseUntilMs;

  elVideo.addEventListener("mouseenter", (ev) => {
    if (!pc || pc.connectionState !== "connected") return;
    enterRemoteControlMode();
    moveRemoteCursorByClient(ev.clientX, ev.clientY);
  });

  elVideo.addEventListener("mouseleave", () => {
    leaveRemoteControlMode();
  });

  elVideo.addEventListener("mousedown", (ev) => {
    if (compatibilityMouseSuppressed()) { ev.preventDefault(); return; }
    enterRemoteControlMode();
    moveRemoteCursorByClient(ev.clientX, ev.clientY);

    moveRemoteCursorByClient(ev.clientX, ev.clientY);
    const p = getNormalizedPointer(ev);
    moveRemoteCursorByNorm(p.x_norm, p.y_norm);
    sendInput("mouse_move", p);
    sendInput("mouse_down", { button: ev.button });

    ev.preventDefault();
  });

  window.addEventListener("mouseup", (ev) => {
    if (compatibilityMouseSuppressed()) return;
    if (!controlActive) return;
    sendInput("mouse_up", { button: ev.button });
  });

  elVideo.addEventListener("mousemove", (ev) => {
    if (compatibilityMouseSuppressed()) return;
    if (!controlActive) enterRemoteControlMode();
    moveRemoteCursorByClient(ev.clientX, ev.clientY);
    const p = getNormalizedPointer(ev);
    lastCursorNorm = p;
    sendInput("mouse_move", p);
  });

  elVideo.addEventListener("wheel", (ev) => {
    if (compatibilityMouseSuppressed()) { ev.preventDefault(); return; }
    // Trackpads fire wheel events without a physical wheel click. Treat wheel
    // as an intent to control the remote/backstage surface so two-finger
    // scrolling works even before a click focuses the viewer.
    if (!controlActive) {
      enterRemoteControlMode();
    }
    if (!controlActive) return;

    const p = getNormalizedPointer(ev);
    moveRemoteCursorByNorm(p.x_norm, p.y_norm);

    sendInput("wheel", {
      ...p,
      delta_x: Math.round(ev.deltaX),
      delta_y: Math.round(ev.deltaY),
      delta_mode: ev.deltaMode || 0,
      shift: !!ev.shiftKey,
      ctrl: !!ev.ctrlKey,
      alt: !!ev.altKey
    });

    ev.preventDefault();
  }, { passive: false });

  // Mobile/tablet direct-touch controls. A single state machine owns every
  // touch pointer on the viewer canvas. The previous split implementation let
  // #main and #remote-video capture the same pointer independently; after a
  // pinch one side could miss pointerup/pointercancel and leave touch stuck.
  //
  // One finger on the rendered monitor = remote touch/drag.
  // Two fingers anywhere on the viewer canvas = viewport pinch/pan.
  const gestureSurface = elMain || elVideo.parentElement || elVideo;
  const mobilePointers = new Map();
  let remoteTouchId = null;
  let remoteTouchStart = null;
  let remoteTouchDragging = false;
  let remoteTouchLongPressTimer = null;
  let remoteTouchLongPressFired = false;
  let viewportGesture = null;
  let viewportGestureConsumed = false;
  let viewportGestureRaf = 0;

  if (gestureSurface && isMobileViewerSurface()) {
    gestureSurface.style.touchAction = "none";
  }

  const clearRemoteLongPress = () => {
    if (remoteTouchLongPressTimer) clearTimeout(remoteTouchLongPressTimer);
    remoteTouchLongPressTimer = null;
  };

  const pointerDistance = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  const isPointInsideRemoteVideo = (clientX, clientY) => {
    if (!elVideo || !elVideo.videoWidth || !elVideo.videoHeight) return false;
    const r = getVideoContentRect(elVideo);
    return clientX >= r.left && clientX <= r.left + r.width &&
      clientY >= r.top && clientY <= r.top + r.height;
  };

  const mobilePair = () => Array.from(mobilePointers.values()).slice(0, 2);

  const cancelRemoteTouchForViewport = () => {
    clearRemoteLongPress();
    if (remoteTouchDragging) {
      sendInput("mouse_up", { button: 0 }, true);
    }
    remoteTouchDragging = false;
    remoteTouchLongPressFired = false;
    remoteTouchId = null;
    remoteTouchStart = null;
  };

  const beginViewportGesture = () => {
    const pts = mobilePair();
    if (pts.length < 2 || !gestureSurface) return false;

    cancelRemoteTouchForViewport();
    const a = pts[0];
    const b = pts[1];
    const centerX = (a.clientX + b.clientX) / 2;
    const centerY = (a.clientY + b.clientY) / 2;
    const rect = gestureSurface.getBoundingClientRect();
    const zoom = Math.max(1, mobileViewZoom);

    const distance = Math.max(1, pointerDistance(a, b));
    viewportGesture = {
      distance,
      zoom,
      anchorX: (centerX - (rect.left + rect.width / 2) - mobileViewPanX) / zoom,
      anchorY: (centerY - (rect.top + rect.height / 2) - mobileViewPanY) / zoom,
      smoothCenterX: centerX,
      smoothCenterY: centerY,
      smoothDistance: distance
    };
    viewportGestureConsumed = true;
    return true;
  };

  const updateViewportGesture = () => {
    const pts = mobilePair();
    if (pts.length < 2 || !gestureSurface) return false;
    if (!viewportGesture && !beginViewportGesture()) return false;

    const a = pts[0];
    const b = pts[1];
    const rawCenterX = (a.clientX + b.clientX) / 2;
    const rawCenterY = (a.clientY + b.clientY) / 2;
    const rawDistance = Math.max(1, pointerDistance(a, b));

    // Pointer events for the two fingers do not necessarily arrive in the same
    // browser frame. A light one-frame low-pass removes the alternating-centre
    // wobble without making the gesture feel heavy or delayed.
    const alpha = 0.72;
    viewportGesture.smoothCenterX += (rawCenterX - viewportGesture.smoothCenterX) * alpha;
    viewportGesture.smoothCenterY += (rawCenterY - viewportGesture.smoothCenterY) * alpha;
    viewportGesture.smoothDistance += (rawDistance - viewportGesture.smoothDistance) * alpha;
    const centerX = viewportGesture.smoothCenterX;
    const centerY = viewportGesture.smoothCenterY;
    const distance = viewportGesture.smoothDistance;
    const ratio = distance / Math.max(1, viewportGesture.distance);
    const nextZoom = Math.max(1, Math.min(4, viewportGesture.zoom * ratio));
    const rect = gestureSurface.getBoundingClientRect();

    // Preserve the remote point that was under the initial pinch centre.
    // This keeps both zoom-in and zoom-out stable instead of recentering.
    mobileViewZoom = nextZoom;
    mobileViewPanX = (centerX - (rect.left + rect.width / 2)) - viewportGesture.anchorX * nextZoom;
    mobileViewPanY = (centerY - (rect.top + rect.height / 2)) - viewportGesture.anchorY * nextZoom;

    applyMobileViewport({ clamp: false });
    return true;
  };

  const scheduleViewportGestureUpdate = () => {
    if (viewportGestureRaf) return;
    viewportGestureRaf = window.requestAnimationFrame(() => {
      viewportGestureRaf = 0;
      if (mobilePointers.size >= 2 && viewportGesture) updateViewportGesture();
    });
  };

  const resetMobileGestureWhenReleased = () => {
    if (mobilePointers.size !== 0) return;
    if (viewportGestureRaf) {
      window.cancelAnimationFrame(viewportGestureRaf);
      viewportGestureRaf = 0;
    }
    clearRemoteLongPress();
    remoteTouchId = null;
    remoteTouchStart = null;
    remoteTouchDragging = false;
    remoteTouchLongPressFired = false;
    viewportGesture = null;
    viewportGestureConsumed = false;
  };

  const mobilePointerAllowed = (ev) => {
    if (!isMobileViewerSurface()) return false;
    if (ev.pointerType !== "touch" && ev.pointerType !== "pen") return false;
    // Do not steal touches intended for Viewer controls/panels. Black canvas
    // space and the transformed video itself are the viewport gesture surface.
    return ev.target === gestureSurface || ev.target === elVideo;
  };

  gestureSurface?.addEventListener("pointerdown", (ev) => {
    if (!mobilePointerAllowed(ev)) return;
    noteTouchInteraction();
    ev.preventDefault();

    mobilePointers.set(ev.pointerId, {
      id: ev.pointerId,
      clientX: ev.clientX,
      clientY: ev.clientY
    });

    // Capture every mobile pointer in exactly one place. All move/up/cancel
    // events now return here, even if a finger crosses outside the video.
    try { gestureSurface.setPointerCapture(ev.pointerId); } catch {}

    if (mobilePointers.size >= 2) {
      beginViewportGesture();
      return;
    }

    if (!isPointInsideRemoteVideo(ev.clientX, ev.clientY)) {
      // A first finger in the black surround is intentionally inert; adding a
      // second finger turns it into a canvas-wide pinch without remote clicks.
      return;
    }

    enterRemoteControlMode();
    remoteTouchId = ev.pointerId;
    remoteTouchStart = { clientX: ev.clientX, clientY: ev.clientY };
    remoteTouchDragging = false;
    remoteTouchLongPressFired = false;

    const p = getNormalizedPointer(ev);
    moveRemoteCursorByNorm(p.x_norm, p.y_norm);
    sendInput("mouse_move", p);

    clearRemoteLongPress();
    remoteTouchLongPressTimer = setTimeout(() => {
      if (mobilePointers.size === 1 && remoteTouchId === ev.pointerId && !remoteTouchDragging) {
        sendInput("mouse_down", { button: 2 }, true);
        sendInput("mouse_up", { button: 2 }, true);
        remoteTouchLongPressFired = true;
      }
    }, 650);
  }, { passive: false });

  gestureSurface?.addEventListener("pointermove", (ev) => {
    const point = mobilePointers.get(ev.pointerId);
    if (!point) return;
    noteTouchInteraction();
    ev.preventDefault();

    point.clientX = ev.clientX;
    point.clientY = ev.clientY;
    mobilePointers.set(ev.pointerId, point);

    if (mobilePointers.size >= 2 || viewportGesture) {
      scheduleViewportGestureUpdate();
      return;
    }

    if (viewportGestureConsumed || ev.pointerId !== remoteTouchId) return;

    const p = getNormalizedPointer(ev);
    moveRemoteCursorByNorm(p.x_norm, p.y_norm);
    sendInput("mouse_move", p);

    if (remoteTouchStart && pointerDistance(ev, remoteTouchStart) > 8) {
      clearRemoteLongPress();
      if (!remoteTouchDragging && !remoteTouchLongPressFired) {
        sendInput("mouse_down", { button: 0 }, true);
        remoteTouchDragging = true;
      }
    }
  }, { passive: false });

  const finishMobilePointer = (ev, cancelled) => {
    if (!mobilePointers.has(ev.pointerId)) return;
    noteTouchInteraction();
    ev.preventDefault();

    const wasRemoteTouch = ev.pointerId === remoteTouchId;
    const wasViewportGesture = viewportGestureConsumed || mobilePointers.size >= 2;
    mobilePointers.delete(ev.pointerId);
    try { gestureSurface.releasePointerCapture(ev.pointerId); } catch {}

    if (wasRemoteTouch) {
      clearRemoteLongPress();
      if (remoteTouchDragging) {
        sendInput("mouse_up", { button: 0 }, true);
      } else if (!cancelled && !wasViewportGesture && !remoteTouchLongPressFired) {
        const p = getNormalizedPointer(ev);
        moveRemoteCursorByNorm(p.x_norm, p.y_norm);
        sendInput("mouse_move", p, true);
        sendInput("mouse_down", { button: 0 }, true);
        sendInput("mouse_up", { button: 0 }, true);
      }
      remoteTouchId = null;
      remoteTouchStart = null;
      remoteTouchDragging = false;
      remoteTouchLongPressFired = false;
    }

    if (wasViewportGesture) {
      if (viewportGestureRaf) {
        window.cancelAnimationFrame(viewportGestureRaf);
        viewportGestureRaf = 0;
      }
      // Settle exactly to Fit only after the pinch has ended, never while the
      // fingers are moving. This avoids threshold bounce during zoom-out.
      if (mobileViewZoom < 1.02) {
        mobileViewZoom = 1;
        mobileViewPanX = 0;
        mobileViewPanY = 0;
      }
      // Settle edge bounds exactly once after the fingers stop moving.
      // This may correct an intentional overscroll but cannot feed jitter back
      // into the active gesture.
      applyMobileViewport({ clamp: true });
      // Once a two-finger gesture begins, the remaining finger stays inert
      // until all fingers lift. This prevents pinch-end from becoming a click
      // or drag and guarantees the next touch starts from a clean state.
      viewportGesture = null;
      viewportGestureConsumed = true;
      cancelRemoteTouchForViewport();
    }

    resetMobileGestureWhenReleased();
  };

  gestureSurface?.addEventListener("pointerup", (ev) => finishMobilePointer(ev, false), { passive: false });
  gestureSurface?.addEventListener("pointercancel", (ev) => finishMobilePointer(ev, true), { passive: false });

  window.addEventListener("blur", () => {
    if (remoteAltTabActive) {
      sendShortcut("alt_tab_end");
      remoteAltTabActive = false;
    }
    leaveRemoteControlMode();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      leaveRemoteControlMode();
    } else {
      ensureRemoteVideoPlayback("visibility-resume");
      armDecodedFrameReveal();
    }
  });

  document.addEventListener("pointerdown", () => {
    if (isMobileViewerSurface() && elVideo?.srcObject) {
      ensureRemoteVideoPlayback("mobile-user-gesture");
      armDecodedFrameReveal();
    }
  }, { passive: true });

  function isLocalViewerInputTarget(target) {
    const el = target instanceof Element ? target : null;
    if (!el) return false;
    if (el.closest("#chat-panel, #settings-panel, #files-panel")) return true;
    const tag = String(el.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || !!el.closest("[contenteditable='true']");
  }

  function shortcutFromKeyboardEvent(ev) {
    if (!ev) return "";

    // Windows-key combinations. The native viewer hook handles these when
    // maximised, but keep this path for WebView builds that also surface Meta.
    if (ev.metaKey || ev.key === "Meta" || ev.key === "OS") {
      switch (ev.code) {
        case "KeyD": return "win_d";
        case "KeyR": return "win_r";
        case "KeyE": return "win_e";
        case "KeyL": return "lock";
        case "Tab": return "win_tab";
        case "Escape": return "start_menu";
        case "MetaLeft":
        case "MetaRight":
          return "start_menu";
        default:
          break;
      }
    }

    if (ev.altKey && ev.code === "Tab") return remoteAltTabActive ? "alt_tab_next" : "alt_tab_begin";
    if (ev.altKey && ev.code === "F4") return "alt_f4";
    if (ev.ctrlKey && ev.shiftKey && ev.code === "Escape") return "ctrl_shift_esc";
    if (ev.ctrlKey && ev.code === "Escape") return "ctrl_esc";
    if (ev.ctrlKey && ev.altKey && (ev.code === "Delete" || ev.code === "End")) return "ctrl_alt_del";
    return "";
  }

  window.addEventListener("keydown", (ev) => {
    if (isLocalViewerInputTarget(ev.target)) return;
    if (!controlActive || !pc || pc.connectionState !== "connected") return;

    const keyboardShortcut = shortcutFromKeyboardEvent(ev);
    if (keyboardShortcut) {
      releaseAllKeys();
      sendShortcut(keyboardShortcut);
      if (keyboardShortcut === "alt_tab_begin" || keyboardShortcut === "alt_tab_next") {
        remoteAltTabActive = true;
      }
      ev.preventDefault();
      return;
    }

    if (!ev.metaKey) {
      if (pressedKeys.has("MetaLeft")) {
        sendInput("key_up", { code: "MetaLeft" }, true);
        pressedKeys.delete("MetaLeft");
      }
      if (pressedKeys.has("MetaRight")) {
        sendInput("key_up", { code: "MetaRight" }, true);
        pressedKeys.delete("MetaRight");
      }
    }
    if (!ev.ctrlKey) {
      if (pressedKeys.has("ControlLeft")) {
        sendInput("key_up", { code: "ControlLeft" }, true);
        pressedKeys.delete("ControlLeft");
      }
      if (pressedKeys.has("ControlRight")) {
        sendInput("key_up", { code: "ControlRight" }, true);
        pressedKeys.delete("ControlRight");
      }
    }
    if (!ev.shiftKey) {
      if (pressedKeys.has("ShiftLeft")) {
        sendInput("key_up", { code: "ShiftLeft" }, true);
        pressedKeys.delete("ShiftLeft");
      }
      if (pressedKeys.has("ShiftRight")) {
        sendInput("key_up", { code: "ShiftRight" }, true);
        pressedKeys.delete("ShiftRight");
      }
    }
    if (!ev.altKey) {
      if (pressedKeys.has("AltLeft")) {
        sendInput("key_up", { code: "AltLeft" }, true);
        pressedKeys.delete("AltLeft");
      }
      if (pressedKeys.has("AltRight")) {
        sendInput("key_up", { code: "AltRight" }, true);
        pressedKeys.delete("AltRight");
      }
    }

    if (isPrintableKey(ev)) {
      sendInput("text_input", {
        code: ev.code,
        key: ev.key,
        text: ev.key,
        repeat: !!ev.repeat
      });
      ev.preventDefault();
      return;
    }

    if (!pressedKeys.has(ev.code)) {
      pressedKeys.add(ev.code);
      sendInput("key_down", {
        code: ev.code,
        key: ev.key || "",
        repeat: false,
        shift: !!ev.shiftKey,
        ctrl: !!ev.ctrlKey,
        alt: !!ev.altKey,
        meta: !!ev.metaKey
      });
    } else if (ev.repeat) {
      sendInput("key_down", {
        code: ev.code,
        key: ev.key || "",
        repeat: true,
        shift: !!ev.shiftKey,
        ctrl: !!ev.ctrlKey,
        alt: !!ev.altKey,
        meta: !!ev.metaKey
      });
    }

    if (ev.code === "MetaLeft" || ev.code === "MetaRight") {
      setTimeout(() => {
        if (pressedKeys.has(ev.code)) {
          sendInput("key_up", { code: ev.code }, true);
          pressedKeys.delete(ev.code);
        }
      }, 250);
    }

    ev.preventDefault();
  });

  window.addEventListener("keyup", (ev) => {
    if (isLocalViewerInputTarget(ev.target)) return;
    if (!pc || pc.connectionState !== "connected") return;

    if (remoteAltTabActive && (ev.key === "Alt" || ev.code === "AltLeft" || ev.code === "AltRight")) {
      sendShortcut("alt_tab_end");
      remoteAltTabActive = false;
      ev.preventDefault();
      return;
    }

    if (remoteAltTabActive && ev.code === "Tab") {
      ev.preventDefault();
      return;
    }

    if (pressedKeys.has(ev.code)) {
      pressedKeys.delete(ev.code);
    }

    sendInput("key_up", {
      code: ev.code,
      key: ev.key || "",
      shift: !!ev.shiftKey,
      ctrl: !!ev.ctrlKey,
      alt: !!ev.altKey,
      meta: !!ev.metaKey
    });

    ev.preventDefault();
  });
}

/* -----------------------------------------
   ICE normalization
------------------------------------------ */

function normalizeRemoteIce(msg) {
  if (!msg) return null;

  let candidateStr = null;
  let mid = null;
  let mline = null;

  if (typeof msg.candidate === "string") {
    candidateStr = msg.candidate;
  } else if (msg.candidate && typeof msg.candidate === "object") {
    candidateStr = typeof msg.candidate.candidate === "string" ? msg.candidate.candidate : null;
    mid = msg.candidate.sdpMid ?? msg.candidate.mid ?? null;
    mline = msg.candidate.sdpMLineIndex ?? msg.candidate.mline_index ?? null;
  }

  mid = msg.mid ?? mid;
  mline = msg.mline_index ?? msg.sdpMLineIndex ?? mline;

  if (!candidateStr) return null;

  return { candidate: candidateStr, mid: mid ?? null, mline_index: (mline != null ? Number(mline) : null) };
}

async function applyRemoteIce(msg) {
  const iceMsg = normalizeRemoteIce(msg);
  if (!iceMsg) return;

  if (!pc || !remoteDescSet) {
    pendingRemoteIce.push(iceMsg);
    return;
  }

  try {
    const ice = {
      candidate: iceMsg.candidate,
      ...(iceMsg.mid != null ? { sdpMid: iceMsg.mid } : {}),
      ...(iceMsg.mline_index != null ? { sdpMLineIndex: iceMsg.mline_index } : {}),
    };
    await pc.addIceCandidate(ice);
  } catch (e) {
    console.warn("[rtc] addIceCandidate failed:", e?.message || e, msg);
  }
}

async function flushPendingIce() {
  if (!pc || !remoteDescSet || pendingRemoteIce.length === 0) return;
  const batch = pendingRemoteIce;
  pendingRemoteIce = [];
  for (const m of batch) await applyRemoteIce(m);
}


function extractSdpVideoCodecs(sdp) {
  const lines = String(sdp || "").split(/\r?\n/);
  const rtpmap = new Map();
  const fmtp = new Map();
  for (const line of lines) {
    let m = line.match(/^a=rtpmap:(\d+)\s+([^/\s]+)\/([^\s]+)/i);
    if (m) rtpmap.set(m[1], `${m[2]}/${m[3]}`);
    m = line.match(/^a=fmtp:(\d+)\s+(.+)$/i);
    if (m) fmtp.set(m[1], m[2]);
  }
  return Array.from(rtpmap.entries()).map(([pt, codec]) => ({ pt, codec, fmtp: fmtp.get(pt) || "" }));
}

function logSdpCodecSummary(label, sdp) {
  const codecs = extractSdpVideoCodecs(sdp);
  console.log(`[codec] ${label}`, codecs);
  return codecs;
}

function setViewerCodecLabel(value) {
  if (elStatCodec) elStatCodec.textContent = value || "—";
}

async function updateSelectedCodecFromStats() {
  if (!pc) return;
  try {
    const stats = await pc.getStats();
    let inbound = null;
    stats.forEach((r) => {
      if (r.type === "inbound-rtp" && ((r.kind === "video") || (r.mediaType === "video"))) inbound = r;
    });
    if (!inbound || !inbound.codecId) return;
    const codec = stats.get(inbound.codecId);
    if (codec) {
      const mime = codec.mimeType || codec.mime || "";
      const label = `${mime.replace(/^video\//i, "").toUpperCase()} pt=${codec.payloadType ?? "?"}`;
      setViewerCodecLabel(label);
      console.log("[codec] selected inbound codec", { mimeType: codec.mimeType, payloadType: codec.payloadType, clockRate: codec.clockRate, sdpFmtpLine: codec.sdpFmtpLine });
    }
  } catch (e) {
    console.warn("[codec] selected codec stats failed", e?.message || e);
  }
}

/* -----------------------------------------
   WebRTC negotiation
------------------------------------------ */

async function handleOffer(msg) {
  const offerSdp = msg?.sdp;
  if (!offerSdp) return;

  logSdpCodecSummary("remote offer", offerSdp);

  setStatus("", "Negotiating…");

  pc = new RTCPeerConnection({ iceServers: activeIceServers() });

  let transceiver = null;
  try {
    transceiver = pc.addTransceiver("video", { direction: "recvonly" });
  } catch (e) {
    console.warn("[rtc] addTransceiver failed:", e?.message || e);
  }

  try {
    const caps = RTCRtpReceiver.getCapabilities?.("video");
    const codecs = caps?.codecs || [];

    if (transceiver && transceiver.setCodecPreferences && codecs.length) {
      // Prefer codecs that keep browser/mobile sessions sharp without forcing
      // the conservative H.264 level-3.1 720p ceiling. The Agent still makes
      // the final choice from the codecs actually returned in our SDP answer.
      const vp8 = codecs.filter(c => String(c.mimeType).toLowerCase() === "video/vp8");
      const h264 = codecs.filter(c => String(c.mimeType).toLowerCase() === "video/h264");
      const vp9 = codecs.filter(c => String(c.mimeType).toLowerCase() === "video/vp9");
      const rest = codecs.filter(c => {
        const mt = String(c.mimeType).toLowerCase();
        return mt !== "video/vp8" && mt !== "video/h264" && mt !== "video/vp9";
      });
      console.log("[codec] viewer codec preference", { vp8: vp8.length, h264: h264.length, vp9: vp9.length, rest: rest.length });
      transceiver.setCodecPreferences([...vp8, ...h264, ...vp9, ...rest]);
    }
  } catch (e) {
    console.warn("[webrtc] codec preference step failed:", e?.message || e);
  }

  pc.ondatachannel = (ev) => {
    if (!ev.channel) return;

    if (ev.channel.label === "input") {
      inputDc = ev.channel;

      inputDc.onopen = () => {};
      inputDc.onclose = () => {
        inputDc = null;
      };
      inputDc.onerror = () => {};
    }
  };

  pc.ontrack = async (ev) => {
    console.log("[rtc] ontrack", { trackKind: ev.track?.kind, streams: ev.streams?.length || 0 });
    setTimeout(updateSelectedCodecFromStats, 500);
    setTimeout(updateSelectedCodecFromStats, 1500);
    const stream = (ev.streams && ev.streams[0])
      ? ev.streams[0]
      : new MediaStream([ev.track]);

    if (ev.track?.kind === "audio") {
      if (!elAudio) return;
      elAudio.autoplay = true;
      elAudio.muted = !audioEnabled;
      elAudio.defaultMuted = !audioEnabled;
      elAudio.srcObject = stream;
      if (audioEnabled) {
        try { await elAudio.play(); } catch {}
      }
      return;
    }

    if (ev.track?.kind !== "video" || !elVideo) return;

    elVideo.autoplay = true;
    elVideo.playsInline = true;
    elVideo.muted = true;
    elVideo.defaultMuted = true;
    elVideo.controls = false;

    elVideo.onloadedmetadata = null;
    elVideo.onloadeddata = null;
    elVideo.oncanplay = null;
    elVideo.onplaying = null;
    elVideo.onpause = null;
    elVideo.onerror = null;

    elVideo.onloadedmetadata = async () => {
      updateResolution();
      refreshRemoteCursorPosition();
      await ensureRemoteVideoPlayback("loadedmetadata");
      armDecodedFrameReveal();
    };

    elVideo.onloadeddata = () => {
      markFrameRendered();
      armDecodedFrameReveal();
    };

    elVideo.oncanplay = async () => {
      await ensureRemoteVideoPlayback("canplay");
      armDecodedFrameReveal();
    };

    elVideo.onplaying = () => {
      clearSecureDesktopState();
      markFrameRendered();
      updateResolution();
      refreshRemoteCursorPosition();
      armDecodedFrameReveal();
    };

    elVideo.onerror = () => {
      console.error("[video] error", elVideo.error);
    };

    if (elVideo.srcObject !== stream) {
      elVideo.srcObject = stream;
    }

    ev.track.onunmute = () => {
      ensureRemoteVideoPlayback("track-unmute");
      armDecodedFrameReveal();
    };

    bindRemoteInput();
    refreshRemoteCursorPosition();
    setStatus("", "Connected · waiting for video");

    await ensureRemoteVideoPlayback("ontrack");
    armDecodedFrameReveal();

    try { window.hi5?.notifyConnected?.(currentSession?.deviceId); } catch {}

    startStatsPoll();

    if (!hasEverRenderedFrame) {
      lastFrameAtMs = Date.now() + NEGOTIATION_GRACE_MS;
    }
  };

  pc.onicegatheringstatechange = () => console.log("[rtc] iceGatheringState:", pc.iceGatheringState);
  pc.oniceconnectionstatechange = () => console.log("[rtc] iceConnectionState:", pc.iceConnectionState);
  pc.onconnectionstatechange = () => {
    console.log("[rtc] connectionState:", pc.connectionState);

    if (pc.connectionState === "connected") {
      ensureRemoteVideoPlayback("peer-connected");
      armDecodedFrameReveal();
      if (hasEverRenderedFrame) {
        showStream();
        setStatus("online", "Streaming");
      } else {
        setStatus("", "Connected · waiting for video");
      }
    }
  };
  pc.onsignalingstatechange = () => console.log("[rtc] signalingState:", pc.signalingState);

  pc.onicecandidate = (ev) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (ev.candidate) {
      ws.send(JSON.stringify({
        type: "ice_candidate",
        session_id: currentSession.sessionId,
        candidate: ev.candidate.candidate,
        mid: ev.candidate.sdpMid ?? null,
        mline_index: ev.candidate.sdpMLineIndex ?? null
      }));
    }
  };

  await pc.setRemoteDescription({ type: "offer", sdp: offerSdp });
  remoteDescSet = true;
  await flushPendingIce();

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  logSdpCodecSummary("local answer", answer.sdp);

  ws.send(JSON.stringify({
    type: "webrtc_answer",
    session_id: currentSession.sessionId,
    sdp: answer.sdp,
    sdp_type: answer.type
  }));
}

/* -----------------------------------------
   Signaling / session start
------------------------------------------ */

async function onSignalMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw.data);
  } catch {
    return;
  }

  console.log("[signal] raw message:", msg);

  switch (msg.type) {
    case "viewer_connected":
      break;

    case "session_config": {
      if (currentSession) {
        currentSession.iceServers = normalizeIceServers(msg.ice_servers || msg.iceServers || []);
        if (elDiagIceServers) elDiagIceServers.textContent = activeIceServers().map((server) => Array.isArray(server.urls) ? server.urls.join(",") : server.urls).join(" | ");
      }
      break;
    }

    case "start_webrtc_sent":
      break;

    case "webrtc_offer":
      await handleOffer(msg);
      break;

    case "ice_candidate":
      await applyRemoteIce(msg);
      break;

    case "monitor_info": {
      remoteMonitors = Array.isArray(msg.monitors) ? msg.monitors : [];
      currentMonitorIndex = Number(msg.current ?? 0);

      if (pendingMonitorIndex != null && currentMonitorIndex === pendingMonitorIndex) {
        pendingMonitorIndex = null;
        monitorSwitchUntilMs = 0;
        setStatus("online", "Streaming");
        showStream();
      }

      updateMonitorButton();
      if (monitorMenuOpen) {
        renderMonitorMenu();
      }
      break;
    }

    case "shortcut_result": {
      const action = String(msg.action || "").toLowerCase();
      if (action === "ctrl_alt_del" || action === "cad" || action === "sas") {
        if (!msg.ok) {
          const text = msg.message || "Ctrl+Alt+Del could not be sent by Windows.";
          console.warn("[viewer] CAD unavailable", msg.code || "sas_failed", text);
          setStatus("error", text);
          setTimeout(() => {
            if (pc && pc.connectionState === "connected") setStatus("online", "Streaming");
          }, 4500);
        }
      }
      break;
    }

    case "agent_presence": {
      if (msg.technician_name) {
        setStatus("online", `Streaming · ${msg.technician_name}`);
      }
      break;
    }

    case "chat_message": {
      const appended = appendChatMessage({ ...msg, sender: msg.sender || "user" });
      if (appended) {
        renderChat();
        openTechChatWindow();
        postChatToNativeWindow(appended);
      }
      break;
    }

    case "remote_file_list": {
      remoteFileEntries = Array.isArray(msg.entries) ? msg.entries : [];
      remoteFilePath = msg.path || "/";
      if (elFilePath) elFilePath.value = remoteFilePath;
      renderRemoteFiles();
      postFileToNativeWindow(msg);
      break;
    }

    case "remote_file_download": {
      const path = String(msg.path || "");
      if (browserDownloadPaths.has(path)) {
        browserDownloadPaths.delete(path);
        saveBrowserFile(msg.name || "download", [base64ToBytes(msg.data || "")]);
        setMobileFileStatus(`Downloaded ${msg.name || "file"}.`);
        break;
      }
      const localDir = pendingRemoteDownloads.get(path);
      if (localDir) {
        msg.local_dir = localDir;
        pendingRemoteDownloads.delete(path);
      }
      postFileToNativeWindow(msg);
      break;
    }

    case "file_transfer_start": {
      const path = String(msg.path || "");
      if (msg.direction === "download" && browserDownloadPaths.has(path)) {
        browserDownloadPaths.delete(path);
        browserChunkDownloads.set(String(msg.transfer_id || ""), { name: msg.name || "download", parts: [], received: 0, total: Number(msg.size || 0) });
        setMobileFileStatus(`Downloading ${msg.name || "file"}…`);
        break;
      }
      postFileToNativeWindow(msg);
      break;
    }
    case "file_transfer_chunk": {
      const st = browserChunkDownloads.get(String(msg.transfer_id || ""));
      if (st) {
        st.parts.push(base64ToBytes(msg.data || ""));
        st.received += Number(msg.size || 0);
        const pct = st.total ? Math.min(100, Math.round(st.received / st.total * 100)) : 0;
        setMobileFileStatus(`Downloading ${st.name}… ${pct}%`);
        break;
      }
      postFileToNativeWindow(msg);
      break;
    }
    case "file_transfer_complete": {
      const id = String(msg.transfer_id || "");
      const st = browserChunkDownloads.get(id);
      if (st) {
        browserChunkDownloads.delete(id);
        saveBrowserFile(st.name, st.parts);
        setMobileFileStatus(`Downloaded ${st.name}.`);
        break;
      }
      postFileToNativeWindow(msg);
      break;
    }
    case "file_transfer_error": {
      const id = String(msg.transfer_id || "");
      if (browserChunkDownloads.has(id)) {
        browserChunkDownloads.delete(id);
        setMobileFileStatus(msg.error || "File transfer failed.");
        break;
      }
      postFileToNativeWindow(msg);
      break;
    }
    case "remote_file_upload_complete": {
      setMobileFileStatus("Upload complete.");
      requestRemoteFileList(remoteFilePath || "/");
      postFileToNativeWindow(msg);
      break;
    }
    case "remote_file_delete_complete":
    case "remote_file_mkdir_complete":
    case "remote_file_rename_complete":
    case "remote_file_download_error":
    case "remote_file_upload_error":
    case "remote_file_delete_error":
    case "remote_file_mkdir_error":
    case "remote_file_rename_error": {
      postFileToNativeWindow(msg);
      break;
    }

    case "session_state": {
      const state = msg.state || "";

      if (state === "secure_desktop_entering") {
        secureDesktopActive = true;
        desktopHandoffActive = false;
        revealOnNextFrame = false;
        secureDesktopLikely = false;
        showSecureBlackOverlay();
        break;
      }

      if (state === "secure_desktop_ready") {
        secureDesktopActive = false;
        desktopHandoffActive = false;
        secureDesktopLikely = false;
        revealOnNextFrame = true;
        setStatus("online", "Streaming");
        break;
      }

      if (state === "secure_desktop_exited") {
        clearSecureDesktopState();
        break;
      }

      if (state === "desktop_handoff_entering") {
        desktopHandoffActive = true;
        secureDesktopActive = false;
        revealOnNextFrame = false;
        secureDesktopLikely = false;
        showSecureBlackOverlay();
        break;
      }

      if (state === "desktop_handoff_ready") {
        desktopHandoffActive = false;
        secureDesktopActive = false;
        secureDesktopLikely = false;
        revealOnNextFrame = true;
        setStatus("online", "Streaming");
        break;
      }

      break;
    }

    case "viewer_disconnected":
      disconnect("Disconnected by user");
      break;

    default:
      break;
  }
}

function startSession(params) {
  console.log("[viewer] starting authorised remote session");

  disconnect(undefined, { silent: true });

  params = params || {};

  const sessionId = params.session_id || params.sessionId || "";
  const token = params.token || params.viewer_token || params.viewerToken || "";
  const deviceId = params.device_id || params.deviceId || "";
  const wssUrl = params.wss_url || params.wssUrl || params.signaling_url || params.signalingUrl || "";
  const iceServers = normalizeIceServers(params.ice_servers || params.iceServers || []);
  const viewerClient = params.viewer_client || params.viewerClient || '';
  const modeValue = String(params.mode || params.session_mode || params.sessionMode || "console").toLowerCase();
  const launchMode = (modeValue === "backstage" || modeValue === "background" || modeValue === "background_mode") ? "backstage" : "console";

  if (!sessionId || !deviceId || !token || !wssUrl) {
    console.error("[viewer] invalid connection parameters");
    disconnect("Invalid connection parameters");
    return;
  }

  currentSession = {
    sessionId,
    token,
    deviceId,
    wssUrl,
    iceServers,
    viewerClient,
    launchMode
  };

  remoteMonitors = [];
  currentMonitorIndex = 0;
  pendingMonitorIndex = null;
  updateMonitorButton();
  closeMonitorMenu();

  if (elBtnDisc) elBtnDisc.disabled = false;
  if (elBtnFiles) elBtnFiles.disabled = false;
  if (elBtnChat) elBtnChat.disabled = false;
  if (elBtnAudio) elBtnAudio.disabled = false;
  if (elBtnBlockInput) elBtnBlockInput.disabled = false;
  setRemoteAudioEnabled(false);
  setLocalInputBlocked(false, false);
  if (elBtnKeyboard) elBtnKeyboard.disabled = false;
  if (elBtnBackstage) {
    elBtnBackstage.hidden = launchMode !== "backstage";
    elBtnBackstage.disabled = true;
    elBtnBackstage.classList.toggle("session-toggle-active", launchMode === "backstage");
  }
  if (elBtnConsole) {
    elBtnConsole.hidden = launchMode !== "console";
    elBtnConsole.disabled = true;
    elBtnConsole.classList.toggle("session-toggle-active", launchMode === "console");
  }
  if (elBtnStartMenu) elBtnStartMenu.disabled = false;
  if (elBtnCad) elBtnCad.disabled = false;
  if (elDeviceLabel) elDeviceLabel.textContent = deviceId || "";

  setStatus("", "Connecting…");
  showOverlay("Connecting", "Starting remote session…", { spinner: true });

  const url =
    `${wssUrl}?session_id=${encodeURIComponent(sessionId)}` +
    `&device_id=${encodeURIComponent(deviceId)}` +
    (token ? `&token=${encodeURIComponent(token)}` : "") +
    (viewerClient ? `&client=${encodeURIComponent(viewerClient)}` : "");
  console.log(`[viewer] opening signaling socket session=${sessionId} device=${deviceId}`);

  ws = new WebSocket(url);

  ws.onopen = () => {
    setStatus("", "Connected");
  };

  ws.onmessage = onSignalMessage;

  ws.onerror = () => {
    disconnect("Connection error");
  };

  ws.onclose = () => {
    disconnect("Disconnected");
  };
}


if (elBtnBackstage) {
  elBtnBackstage.addEventListener("click", () => sendBackstageMode(true));
}
if (elBtnConsole) {
  elBtnConsole.addEventListener("click", () => sendBackstageMode(false));
}
if (elBtnStartMenu) {
  elBtnStartMenu.addEventListener("click", () => sendShortcut("start_menu"));
}
if (elBtnCad) {
  elBtnCad.addEventListener("click", () => sendShortcut("ctrl_alt_del"));
}

/* -----------------------------------------
   App entry
------------------------------------------ */

showOverlay(
  "Hi5Central Viewer",
  "Launch this app from Hi5Central to start a remote desktop session."
);
updateMonitorButton();

try {
  window.hi5?.onConnect((params) => {
    console.log("[viewer] native launch received");
    startSession(params);
  });
} catch (e) {
  console.error("[viewer] failed to bind hi5 connect hook:", e);
}

// Browser/mobile shells can start the same WebRTC viewer without the native
// WebView host. The server supplies a short-lived session token and per-session ICE credentials.
window.hi5RemoteViewer = Object.freeze({
  start: (params) => startSession(params),
  disconnect: () => disconnect("Disconnected by technician", { closeNative: true }),
  isConnected: () => !!(pc && pc.connectionState === "connected")
});

if (elBtnFiles) elBtnFiles.addEventListener("click", () => { toggleFilesPanel(); if (elFilesPanel.classList.contains("visible")) requestRemoteFileList(elFilePath?.value || "/"); });
if (elBtnChat) elBtnChat.addEventListener("click", () => toggleChatPanel(true));
if (elFilesClose) elFilesClose.addEventListener("click", () => toggleFilesPanel(false));
if (elChatClose) elChatClose.addEventListener("click", () => toggleChatPanel(false));
if (elFileRefresh) elFileRefresh.addEventListener("click", () => requestRemoteFileList(elFilePath?.value || "/"));
if (elFileUpload) elFileUpload.addEventListener("click", () => elFileUploadInput?.click());
if (elFileUploadInput) elFileUploadInput.addEventListener("change", async () => {
  await uploadBrowserFiles(elFileUploadInput.files);
  elFileUploadInput.value = "";
  requestRemoteFileList(remoteFilePath || "/");
});
if (elChatSend) elChatSend.addEventListener("click", sendChatMessage);
if (elChatInput) elChatInput.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } });
