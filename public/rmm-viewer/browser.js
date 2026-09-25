(() => {
  const raw = String(window.location.hash || '').replace(/^#/, '');
  if (!raw) return;
  const params = new URLSearchParams(raw);
  let iceServers = [];
  try {
    const encoded = params.get('ice') || '';
    if (encoded) {
      const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      iceServers = JSON.parse(atob(padded));
    }
  } catch {
    iceServers = [];
  }

  const launch = {
    session_id: params.get('session_id') || '',
    device_id: params.get('device_id') || '',
    token: params.get('token') || '',
    wss_url: params.get('wss_url') || '',
    ice_servers: Array.isArray(iceServers) ? iceServers : [],
    viewer_client: 'browser',
  };

  const valid = !!(launch.session_id && launch.device_id && launch.token && launch.wss_url);
  if (!valid) return;

  // Do not erase the one-time launch fragment until renderer.js has actually
  // exposed and accepted the Viewer API. This makes mobile launch resilient to
  // slow startup and prevents a transient renderer error from destroying the
  // only copy of the session token.
  let attempts = 0;
  const startWhenReady = () => {
    attempts += 1;
    if (window.hi5RemoteViewer?.start) {
      try {
        window.hi5RemoteViewer.start(launch);
        try { window.history.replaceState({}, '', window.location.pathname); } catch {}
        return;
      } catch (error) {
        console.error('[viewer] browser launch failed:', error);
      }
    }
    if (attempts < 100) window.setTimeout(startWhenReady, 50);
    else console.error('[viewer] browser launch timed out waiting for renderer');
  };
  startWhenReady();

  window.addEventListener('beforeunload', () => {
    try { window.hi5RemoteViewer?.disconnect(); } catch {}
  }, { once: true });
})();
