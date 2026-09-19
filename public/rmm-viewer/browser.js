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

  try { window.history.replaceState({}, '', window.location.pathname); } catch {}
  if (window.hi5RemoteViewer && launch.session_id && launch.device_id && launch.token && launch.wss_url) {
    window.hi5RemoteViewer.start(launch);
  }
  window.addEventListener('beforeunload', () => {
    try { window.hi5RemoteViewer?.disconnect(); } catch {}
  }, { once: true });
})();
