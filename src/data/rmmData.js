export const rmmDevices = [
  { id: 'DEV-000184', name: 'LON-FIN-WS042', user: 'Eleanor Shaw', type: 'Windows laptop', os: 'Windows 11 24H2', site: 'London HQ', group: 'Finance', status: 'Online', health: 'Healthy', lastSeen: 'Now', ip: '10.24.18.42', agent: '1.6.2', cpu: 18, memory: 63, disk: 71, pendingPatches: 3, alerts: 0, warranty: '18 Jun 2028' },
  { id: 'DEV-000185', name: 'MAN-SALES-WS017', user: 'Chloe Bennett', type: 'Windows laptop', os: 'Windows 11 24H2', site: 'Manchester', group: 'Sales', status: 'Online', health: 'Warning', lastSeen: 'Now', ip: '10.31.7.17', agent: '1.6.2', cpu: 74, memory: 86, disk: 89, pendingPatches: 7, alerts: 2, warranty: '02 Mar 2027' },
  { id: 'DEV-000186', name: 'LON-INF-SRV01', user: 'Infrastructure', type: 'Windows server', os: 'Windows Server 2025', site: 'London DC', group: 'Servers', status: 'Online', health: 'Critical', lastSeen: 'Now', ip: '10.20.1.11', agent: '1.6.2', cpu: 91, memory: 78, disk: 94, pendingPatches: 5, alerts: 3, warranty: 'N/A' },
  { id: 'DEV-000187', name: 'BHM-EUC-WS031', user: 'Noah Williams', type: 'Windows laptop', os: 'Windows 11 24H2', site: 'Birmingham', group: 'Technology', status: 'Offline', health: 'Offline', lastSeen: '2 hr ago', ip: '10.48.4.31', agent: '1.6.1', cpu: 0, memory: 0, disk: 62, pendingPatches: 4, alerts: 1, warranty: '11 Jan 2028' },
  { id: 'DEV-000188', name: 'LON-OPS-MAC08', user: 'Amelia Brooks', type: 'MacBook', os: 'macOS 27.0', site: 'London HQ', group: 'Operations', status: 'Online', health: 'Healthy', lastSeen: 'Now', ip: '10.24.22.8', agent: '1.6.2', cpu: 12, memory: 58, disk: 44, pendingPatches: 1, alerts: 0, warranty: '29 Nov 2028' },
  { id: 'DEV-000189', name: 'LON-SEC-SRV02', user: 'Security Operations', type: 'Linux server', os: 'Ubuntu 26.04 LTS', site: 'London DC', group: 'Servers', status: 'Online', health: 'Healthy', lastSeen: 'Now', ip: '10.20.2.22', agent: '1.6.2', cpu: 27, memory: 49, disk: 53, pendingPatches: 2, alerts: 0, warranty: 'N/A' },
  { id: 'DEV-000190', name: 'REMOTE-MKT-014', user: 'Olivia Green', type: 'Windows laptop', os: 'Windows 11 24H2', site: 'Remote', group: 'Marketing', status: 'Online', health: 'Warning', lastSeen: '1 min ago', ip: '100.81.4.14', agent: '1.6.0', cpu: 33, memory: 71, disk: 84, pendingPatches: 9, alerts: 1, warranty: '21 Aug 2027' },
  { id: 'DEV-000191', name: 'LON-FIN-WS044', user: 'Marcus Lee', type: 'Windows laptop', os: 'Windows 11 24H2', site: 'London HQ', group: 'Finance', status: 'Online', health: 'Healthy', lastSeen: 'Now', ip: '10.24.18.44', agent: '1.6.2', cpu: 22, memory: 67, disk: 56, pendingPatches: 0, alerts: 0, warranty: '09 May 2028' },
  { id: 'DEV-000192', name: 'LON-NET-SW01', user: 'Network', type: 'Network appliance', os: 'Hi5 SNMP', site: 'London DC', group: 'Network', status: 'Online', health: 'Healthy', lastSeen: 'Now', ip: '10.20.10.2', agent: 'SNMP', cpu: 16, memory: 42, disk: 0, pendingPatches: 0, alerts: 0, warranty: '14 Feb 2029' },
  { id: 'DEV-000193', name: 'MAN-OPS-WS021', user: 'Daniel Cole', type: 'Windows desktop', os: 'Windows 11 24H2', site: 'Manchester', group: 'Operations', status: 'Offline', health: 'Offline', lastSeen: 'Yesterday 17:42', ip: '10.31.12.21', agent: '1.5.9', cpu: 0, memory: 0, disk: 73, pendingPatches: 11, alerts: 1, warranty: '03 Dec 2026' },
]

export const rmmAlerts = [
  { id: 'ALT-10428', severity: 'Critical', deviceId: 'DEV-000186', device: 'LON-INF-SRV01', title: 'System volume critically low', detail: 'C: has 5.8 GB free of 120 GB.', raised: '4 min ago', status: 'Open', policy: 'Server disk capacity' },
  { id: 'ALT-10427', severity: 'Critical', deviceId: 'DEV-000186', device: 'LON-INF-SRV01', title: 'CPU sustained above 90%', detail: 'CPU has remained above threshold for 12 minutes.', raised: '11 min ago', status: 'Open', policy: 'Server performance' },
  { id: 'ALT-10425', severity: 'High', deviceId: 'DEV-000185', device: 'MAN-SALES-WS017', title: 'Memory pressure detected', detail: 'Available memory has remained below 15%.', raised: '24 min ago', status: 'Open', policy: 'Endpoint performance' },
  { id: 'ALT-10421', severity: 'Medium', deviceId: 'DEV-000190', device: 'REMOTE-MKT-014', title: 'Agent version behind current channel', detail: 'Device is running agent 1.6.0. Current stable is 1.6.2.', raised: '1 hr ago', status: 'Open', policy: 'Agent health' },
  { id: 'ALT-10419', severity: 'Medium', deviceId: 'DEV-000187', device: 'BHM-EUC-WS031', title: 'Device offline beyond threshold', detail: 'No heartbeat has been received for more than 120 minutes.', raised: '2 hr ago', status: 'Open', policy: 'Endpoint availability' },
  { id: 'ALT-10410', severity: 'Low', deviceId: 'DEV-000193', device: 'MAN-OPS-WS021', title: 'Warranty expiry approaching', detail: 'Warranty expires within 120 days.', raised: 'Yesterday', status: 'Acknowledged', policy: 'Asset lifecycle' },
]

export const rmmPatchGroups = [
  { id: 'PG-01', name: 'Windows endpoints', devices: 126, compliant: 109, pending: 13, failed: 4, window: 'Wed 19:00–22:00', policy: 'Endpoint monthly ring' },
  { id: 'PG-02', name: 'Production servers', devices: 18, compliant: 15, pending: 2, failed: 1, window: 'Sat 22:00–02:00', policy: 'Server maintenance ring' },
  { id: 'PG-03', name: 'macOS endpoints', devices: 22, compliant: 20, pending: 2, failed: 0, window: 'Thu 19:00–22:00', policy: 'macOS stable ring' },
]

export const rmmJobs = [
  { id: 'JOB-7831', title: 'Windows patch scan', target: 'Windows endpoints', status: 'Running', progress: 68, started: '20:42', initiatedBy: 'Schedule', type: 'Patch' },
  { id: 'JOB-7829', title: 'Collect BitLocker status', target: 'Finance', status: 'Completed', progress: 100, started: '19:15', initiatedBy: 'Dana Sinclair', type: 'Script' },
  { id: 'JOB-7828', title: 'Deploy Chrome 153', target: 'Pilot devices', status: 'Completed', progress: 100, started: '18:35', initiatedBy: 'Software policy', type: 'Software' },
  { id: 'JOB-7827', title: 'Restart print spooler', target: 'LON-FIN-WS044', status: 'Failed', progress: 42, started: '17:58', initiatedBy: 'Dana Sinclair', type: 'Command' },
  { id: 'JOB-7825', title: 'Inventory refresh', target: 'All managed devices', status: 'Queued', progress: 0, started: 'Scheduled 22:00', initiatedBy: 'Schedule', type: 'Inventory' },
]

export const rmmSoftware = [
  { name: 'Google Chrome Enterprise', version: '153.0.8015.44', installed: 148, latest: true, updates: 0, managed: true },
  { name: 'Microsoft 365 Apps', version: '2608', installed: 131, latest: true, updates: 0, managed: true },
  { name: '7-Zip', version: '25.01', installed: 97, latest: true, updates: 0, managed: true },
  { name: 'Adobe Acrobat Reader', version: '2026.003.20122', installed: 86, latest: false, updates: 12, managed: true },
  { name: 'Microsoft Teams', version: '26080.1302', installed: 144, latest: false, updates: 9, managed: true },
  { name: 'VLC media player', version: '3.0.21', installed: 21, latest: true, updates: 0, managed: false },
]

export const rmmScripts = [
  { id: 'SCR-101', name: 'Collect BitLocker status', platform: 'Windows', language: 'PowerShell', lastRun: 'Today 19:15', success: 99, scope: 'All endpoints' },
  { id: 'SCR-102', name: 'Reset Windows Update components', platform: 'Windows', language: 'PowerShell', lastRun: 'Yesterday', success: 94, scope: 'On demand' },
  { id: 'SCR-103', name: 'Clear temporary files', platform: 'Windows', language: 'PowerShell', lastRun: 'Today 03:00', success: 100, scope: 'Weekly schedule' },
  { id: 'SCR-104', name: 'macOS inventory diagnostics', platform: 'macOS', language: 'Shell', lastRun: 'Mon', success: 100, scope: 'macOS endpoints' },
]

export const rmmPolicies = [
  { id: 'POL-001', name: 'Standard Windows endpoint', scope: '126 devices', status: 'Active', settings: 14, drift: 3 },
  { id: 'POL-002', name: 'Production Windows Server', scope: '12 devices', status: 'Active', settings: 19, drift: 1 },
  { id: 'POL-003', name: 'macOS standard', scope: '22 devices', status: 'Active', settings: 11, drift: 0 },
  { id: 'POL-004', name: 'Remote worker security', scope: '34 devices', status: 'Active', settings: 8, drift: 2 },
]

export const rmmActivity = [
  { id: 'RAC-01', title: 'Remote session started', detail: 'Dana Sinclair → LON-FIN-WS044', time: '8 min ago', kind: 'remote' },
  { id: 'RAC-02', title: 'Critical alert opened', detail: 'LON-INF-SRV01 · System volume critically low', time: '11 min ago', kind: 'alert' },
  { id: 'RAC-03', title: 'Software deployment completed', detail: 'Google Chrome 153 · 12 pilot devices', time: '28 min ago', kind: 'software' },
  { id: 'RAC-04', title: 'Policy drift detected', detail: '3 endpoints differ from Standard Windows endpoint', time: '46 min ago', kind: 'policy' },
  { id: 'RAC-05', title: 'Patch scan scheduled', detail: 'Windows endpoints · tonight 22:00', time: '1 hr ago', kind: 'patch' },
]
