const commonWindowsSoftware = [
  { name: 'Google Chrome Enterprise', version: '153.0.8015.44', publisher: 'Google LLC', installed: '18 Aug 2026', managed: true },
  { name: 'Microsoft 365 Apps', version: '2608', publisher: 'Microsoft Corporation', installed: '04 Jul 2026', managed: true },
  { name: 'Microsoft Teams', version: '26080.1302', publisher: 'Microsoft Corporation', installed: '04 Jul 2026', managed: true },
  { name: '7-Zip', version: '25.01', publisher: 'Igor Pavlov', installed: '11 Jun 2026', managed: true },
]

const commonWindowsPatches = [
  { id: 'KB5074211', title: '2026-08 Cumulative Update for Windows 11 24H2', classification: 'Security', state: 'Pending', severity: 'Critical', released: '11 Aug 2026', reboot: true },
  { id: 'KB5073194', title: 'Microsoft Defender platform update', classification: 'Definition', state: 'Installed', severity: 'Important', released: '28 Aug 2026', reboot: false },
  { id: 'KB5073882', title: '.NET 9.0 servicing update', classification: 'Update', state: 'Installed', severity: 'Important', released: '11 Aug 2026', reboot: false },
]

const commonDeviceActivity = (name) => [
  { id: `${name}-ACT-1`, kind: 'inventory', title: 'Inventory refreshed', detail: 'Hardware, software and security inventory completed successfully.', time: '8 min ago', actor: 'Hi5Central Agent' },
  { id: `${name}-ACT-2`, kind: 'policy', title: 'Policy evaluation completed', detail: 'Assigned monitoring and maintenance policies evaluated with no configuration errors.', time: '24 min ago', actor: 'Policy Engine' },
  { id: `${name}-ACT-3`, kind: 'heartbeat', title: 'Agent heartbeat received', detail: 'Device checked in and telemetry was accepted by the RMM service.', time: '31 min ago', actor: 'Hi5Central Agent' },
]

function device(overrides) {
  return {
    userEmail: '',
    platform: 'Windows',
    osBuild: '',
    edition: '',
    siteId: '',
    groupId: '',
    publicIp: '81.142.18.20',
    gateway: '',
    mac: '',
    agentChannel: 'Stable',
    patchCompliance: 100,
    manufacturer: 'Lenovo',
    model: 'ThinkPad T14 Gen 6',
    serial: '',
    bios: 'N3MET28W 1.14',
    processor: 'Intel Core Ultra 7 265U',
    ramGb: 32,
    storageGb: 512,
    storageFreeGb: 180,
    uptime: '2d 4h',
    lastBoot: '02 Sep 2026 · 07:48',
    managedSince: '14 May 2026',
    timeZone: 'Europe/London',
    tags: [],
    policy: 'Standard Windows endpoint',
    security: {
      encryption: 'BitLocker',
      encryptionState: 'Protected',
      av: 'Microsoft Defender Antivirus',
      avState: 'Healthy',
      firewall: 'Enabled',
      secureBoot: 'Enabled',
      tpm: 'TPM 2.0 ready',
      edr: 'Microsoft Defender for Endpoint',
      edrState: 'Onboarded',
    },
    networkAdapters: [],
    installedSoftware: commonWindowsSoftware,
    patches: commonWindowsPatches,
    activity: [],
    relatedRecordIds: [],
    ...overrides,
  }
}

export const rmmSites = [
  { id: 'SITE-LON-HQ', name: 'London HQ', devices: 78, online: 77, warning: 1 },
  { id: 'SITE-LON-DC', name: 'London DC', devices: 28, online: 28, warning: 1 },
  { id: 'SITE-MAN', name: 'Manchester', devices: 31, online: 30, warning: 1 },
  { id: 'SITE-BHM', name: 'Birmingham', devices: 25, online: 24, warning: 1 },
  { id: 'SITE-REMOTE', name: 'Remote', devices: 22, online: 22, warning: 2 },
]

export const rmmDeviceGroups = [
  { id: 'GRP-FIN', name: 'Finance', type: 'Department', devices: 24, policy: 'Standard Windows endpoint' },
  { id: 'GRP-SALES', name: 'Sales', type: 'Department', devices: 31, policy: 'Standard Windows endpoint' },
  { id: 'GRP-TECH', name: 'Technology', type: 'Department', devices: 38, policy: 'Technical workstation' },
  { id: 'GRP-OPS', name: 'Operations', type: 'Department', devices: 27, policy: 'Standard Windows endpoint' },
  { id: 'GRP-MKT', name: 'Marketing', type: 'Department', devices: 22, policy: 'Standard Windows endpoint' },
  { id: 'GRP-SERVERS', name: 'Servers', type: 'Infrastructure', devices: 18, policy: 'Production server' },
  { id: 'GRP-NETWORK', name: 'Network', type: 'Infrastructure', devices: 14, policy: 'Network monitoring' },
]

export const rmmDevices = [
  device({
    id: 'DEV-000184', name: 'LON-FIN-WS042', user: 'Eleanor Shaw', userEmail: 'eleanor.shaw@hi5central.com', type: 'Windows laptop', os: 'Windows 11 24H2', osBuild: '26100.4946', edition: 'Enterprise', site: 'London HQ', siteId: 'SITE-LON-HQ', group: 'Finance', groupId: 'GRP-FIN', status: 'Online', health: 'Healthy', lastSeen: 'Now', ip: '10.24.18.42', gateway: '10.24.18.1', mac: '54:14:F3:28:9B:42', agent: '1.6.2', cpu: 18, memory: 63, disk: 71, pendingPatches: 3, patchCompliance: 94, alerts: 0, warranty: '18 Jun 2028', serial: 'PF5K8T42', storageFreeGb: 148, uptime: '1d 13h', lastBoot: '03 Sep 2026 · 08:15', managedSince: '14 May 2026', tags: ['Finance', 'VIP user', 'Windows 11'], relatedRecordIds: ['INC-1032'],
    networkAdapters: [
      { name: 'Intel Wi-Fi 7 BE201', type: 'Wi-Fi', address: '10.24.18.42', mac: '54:14:F3:28:9B:42', status: 'Connected' },
      { name: 'Intel I219-LM', type: 'Ethernet', address: 'DHCP', mac: '54:14:F3:28:9B:43', status: 'Disconnected' },
    ],
    installedSoftware: [...commonWindowsSoftware, { name: 'Power BI Desktop', version: '2.147.1086.0', publisher: 'Microsoft Corporation', installed: '21 Aug 2026', managed: true }],
    activity: [
      { id: 'DEV184-ACT-REMOTE', kind: 'remote', title: 'Remote support session completed', detail: 'Dana Sinclair connected for 18 minutes using Remote Desktop.', time: 'Yesterday · 15:42', actor: 'Dana Sinclair' },
      ...commonDeviceActivity('DEV184'),
    ],
  }),
  device({
    id: 'DEV-000185', name: 'MAN-SALES-WS017', user: 'Chloe Bennett', userEmail: 'chloe.bennett@hi5central.com', type: 'Windows laptop', os: 'Windows 11 24H2', osBuild: '26100.4946', edition: 'Enterprise', site: 'Manchester', siteId: 'SITE-MAN', group: 'Sales', groupId: 'GRP-SALES', status: 'Online', health: 'Warning', lastSeen: 'Now', ip: '10.31.7.17', gateway: '10.31.7.1', mac: '8C:17:59:91:44:17', agent: '1.6.2', cpu: 74, memory: 86, disk: 89, pendingPatches: 7, patchCompliance: 78, alerts: 2, warranty: '02 Mar 2027', manufacturer: 'Dell', model: 'Latitude 7450', serial: 'DL7450S017', processor: 'Intel Core Ultra 7 165U', ramGb: 16, storageGb: 512, storageFreeGb: 56, uptime: '4d 9h', lastBoot: '31 Aug 2026 · 09:02', tags: ['Sales', 'Needs attention'], relatedRecordIds: ['REQ-2231'],
    security: { encryption: 'BitLocker', encryptionState: 'Protected', av: 'Microsoft Defender Antivirus', avState: 'Healthy', firewall: 'Enabled', secureBoot: 'Enabled', tpm: 'TPM 2.0 ready', edr: 'Microsoft Defender for Endpoint', edrState: 'Onboarded' },
    networkAdapters: [{ name: 'Intel Wi-Fi 6E AX211', type: 'Wi-Fi', address: '10.31.7.17', mac: '8C:17:59:91:44:17', status: 'Connected' }],
    activity: [{ id: 'DEV185-ACT-ALERT', kind: 'alert', title: 'Memory alert opened', detail: 'Available memory remained below the configured threshold.', time: '24 min ago', actor: 'Monitoring Engine' }, ...commonDeviceActivity('DEV185')],
  }),
  device({
    id: 'DEV-000186', name: 'LON-INF-SRV01', user: 'Infrastructure', type: 'Windows server', platform: 'Windows Server', os: 'Windows Server 2025', osBuild: '26100.4202', edition: 'Datacenter', site: 'London DC', siteId: 'SITE-LON-DC', group: 'Servers', groupId: 'GRP-SERVERS', status: 'Online', health: 'Critical', lastSeen: 'Now', ip: '10.20.1.11', publicIp: 'N/A', gateway: '10.20.1.1', mac: '00:25:90:FA:01:11', agent: '1.6.2', cpu: 91, memory: 78, disk: 94, pendingPatches: 5, patchCompliance: 72, alerts: 3, warranty: 'N/A', manufacturer: 'VMware', model: 'Virtual Platform', serial: 'VM-LON-INF-SRV01', bios: 'VMware 6.00', processor: 'Intel Xeon Gold 6430 · 8 vCPU', ramGb: 32, storageGb: 1024, storageFreeGb: 61, uptime: '37d 18h', lastBoot: '29 Jul 2026 · 03:12', managedSince: '04 Feb 2026', tags: ['Production', 'Tier 1', 'Server'], policy: 'Production Windows Server',
    security: { encryption: 'Volume encryption', encryptionState: 'Protected', av: 'Microsoft Defender Antivirus', avState: 'Healthy', firewall: 'Enabled', secureBoot: 'Enabled', tpm: 'Virtual TPM 2.0', edr: 'Microsoft Defender for Endpoint', edrState: 'Onboarded' },
    networkAdapters: [{ name: 'vmxnet3 Ethernet Adapter', type: 'Ethernet', address: '10.20.1.11', mac: '00:25:90:FA:01:11', status: 'Connected' }],
    installedSoftware: [
      { name: 'Microsoft Defender for Endpoint', version: '10.8760.12041.1009', publisher: 'Microsoft Corporation', installed: '04 Feb 2026', managed: true },
      { name: 'VMware Tools', version: '13.0.1', publisher: 'VMware', installed: '14 Jul 2026', managed: true },
      { name: 'Microsoft .NET Runtime', version: '9.0.8', publisher: 'Microsoft Corporation', installed: '13 Aug 2026', managed: true },
    ],
    patches: [
      { id: 'KB5074219', title: '2026-08 Cumulative Update for Windows Server 2025', classification: 'Security', state: 'Pending', severity: 'Critical', released: '11 Aug 2026', reboot: true },
      { id: 'KB5073951', title: '.NET security and quality rollup', classification: 'Security', state: 'Pending', severity: 'Important', released: '11 Aug 2026', reboot: true },
    ],
    activity: [{ id: 'DEV186-ACT-DISK', kind: 'alert', title: 'Critical disk alert opened', detail: 'System volume free space crossed the critical threshold.', time: '4 min ago', actor: 'Monitoring Engine' }, ...commonDeviceActivity('DEV186')],
  }),
  device({ id: 'DEV-000187', name: 'BHM-EUC-WS031', user: 'Noah Williams', userEmail: 'noah.williams@hi5central.com', type: 'Windows laptop', os: 'Windows 11 24H2', site: 'Birmingham', siteId: 'SITE-BHM', group: 'Technology', groupId: 'GRP-TECH', status: 'Offline', health: 'Offline', lastSeen: '2 hr ago', ip: '10.48.4.31', gateway: '10.48.4.1', mac: '44:AF:28:19:31:AA', agent: '1.6.1', cpu: 0, memory: 0, disk: 62, pendingPatches: 4, patchCompliance: 86, alerts: 1, warranty: '11 Jan 2028', serial: 'PF9BHM031', uptime: 'Offline', lastBoot: '03 Sep 2026 · 07:14', tags: ['Technology', 'Offline'], activity: [{ id: 'DEV187-ACT-OFFLINE', kind: 'alert', title: 'Device offline', detail: 'No agent heartbeat has been received for more than 120 minutes.', time: '2 hr ago', actor: 'Monitoring Engine' }, ...commonDeviceActivity('DEV187')] }),
  device({ id: 'DEV-000188', name: 'LON-OPS-MAC08', user: 'Amelia Brooks', userEmail: 'amelia.brooks@hi5central.com', type: 'MacBook', platform: 'macOS', os: 'macOS 27.0', osBuild: '26A5318f', edition: 'Tahoe', site: 'London HQ', siteId: 'SITE-LON-HQ', group: 'Operations', groupId: 'GRP-OPS', status: 'Online', health: 'Healthy', lastSeen: 'Now', ip: '10.24.22.8', gateway: '10.24.22.1', mac: 'A8:5C:2C:82:00:08', agent: '1.6.2', cpu: 12, memory: 58, disk: 44, pendingPatches: 1, patchCompliance: 97, alerts: 0, warranty: '29 Nov 2028', manufacturer: 'Apple', model: 'MacBook Air (M4, 2026)', serial: 'FVFGMAC08Q05', bios: 'iBoot 13822.0.0.0.1', processor: 'Apple M4 · 10-core', ramGb: 24, storageGb: 512, storageFreeGb: 287, uptime: '6d 2h', lastBoot: '29 Aug 2026 · 08:06', tags: ['Operations', 'macOS'], policy: 'macOS standard', security: { encryption: 'FileVault', encryptionState: 'Protected', av: 'Microsoft Defender for Endpoint', avState: 'Healthy', firewall: 'Enabled', secureBoot: 'Full Security', tpm: 'Secure Enclave', edr: 'Microsoft Defender for Endpoint', edrState: 'Onboarded' }, installedSoftware: [{ name: 'Google Chrome', version: '153.0.8015.44', publisher: 'Google LLC', installed: '18 Aug 2026', managed: true }, { name: 'Microsoft 365', version: '16.101', publisher: 'Microsoft Corporation', installed: '05 Jul 2026', managed: true }, { name: 'Microsoft Teams', version: '26080.1302', publisher: 'Microsoft Corporation', installed: '05 Jul 2026', managed: true }], patches: [{ id: 'macOS-27.0.1', title: 'macOS 27.0.1', classification: 'OS update', state: 'Pending', severity: 'Important', released: '02 Sep 2026', reboot: true }], networkAdapters: [{ name: 'Wi-Fi', type: 'Wi-Fi', address: '10.24.22.8', mac: 'A8:5C:2C:82:00:08', status: 'Connected' }], activity: commonDeviceActivity('DEV188') }),
  device({ id: 'DEV-000189', name: 'LON-SEC-SRV02', user: 'Security Operations', type: 'Linux server', platform: 'Linux', os: 'Ubuntu 26.04 LTS', osBuild: '6.17.0-12-generic', edition: 'Server', site: 'London DC', siteId: 'SITE-LON-DC', group: 'Servers', groupId: 'GRP-SERVERS', status: 'Online', health: 'Healthy', lastSeen: 'Now', ip: '10.20.2.22', publicIp: 'N/A', gateway: '10.20.2.1', mac: '00:50:56:AC:02:22', agent: '1.6.2', cpu: 27, memory: 49, disk: 53, pendingPatches: 2, patchCompliance: 96, alerts: 0, warranty: 'N/A', manufacturer: 'VMware', model: 'Virtual Platform', serial: 'VM-LON-SEC-SRV02', bios: 'VMware 6.00', processor: 'AMD EPYC 9654 · 4 vCPU', ramGb: 16, storageGb: 256, storageFreeGb: 120, uptime: '18d 7h', lastBoot: '17 Aug 2026 · 02:14', tags: ['Security', 'Server'], policy: 'Linux server baseline', security: { encryption: 'LUKS', encryptionState: 'Protected', av: 'Microsoft Defender for Endpoint', avState: 'Healthy', firewall: 'UFW enabled', secureBoot: 'Enabled', tpm: 'Virtual TPM', edr: 'Microsoft Defender for Endpoint', edrState: 'Onboarded' }, installedSoftware: [{ name: 'OpenSSH Server', version: '10.0p1', publisher: 'Ubuntu', installed: '17 Aug 2026', managed: true }, { name: 'Microsoft Defender for Endpoint', version: '101.26082.0001', publisher: 'Microsoft', installed: '17 Aug 2026', managed: true }], patches: [{ id: 'USN-7794-1', title: 'Linux kernel security update', classification: 'Security', state: 'Pending', severity: 'Important', released: '01 Sep 2026', reboot: true }], networkAdapters: [{ name: 'ens192', type: 'Ethernet', address: '10.20.2.22', mac: '00:50:56:AC:02:22', status: 'Connected' }], activity: commonDeviceActivity('DEV189') }),
  device({ id: 'DEV-000190', name: 'REMOTE-MKT-014', user: 'Olivia Green', userEmail: 'olivia.green@hi5central.com', type: 'Windows laptop', os: 'Windows 11 24H2', site: 'Remote', siteId: 'SITE-REMOTE', group: 'Marketing', groupId: 'GRP-MKT', status: 'Online', health: 'Warning', lastSeen: '1 min ago', ip: '100.81.4.14', publicIp: '86.142.51.99', gateway: '100.81.4.1', mac: '98:5F:D3:1A:04:14', agent: '1.6.0', cpu: 33, memory: 71, disk: 84, pendingPatches: 9, patchCompliance: 74, alerts: 1, warranty: '21 Aug 2027', manufacturer: 'HP', model: 'EliteBook 840 G11', serial: '5CGMKT014', processor: 'Intel Core Ultra 5 135U', ramGb: 16, storageGb: 512, storageFreeGb: 82, uptime: '7d 11h', lastBoot: '28 Aug 2026 · 09:41', tags: ['Remote', 'Marketing', 'Agent update'], activity: [{ id: 'DEV190-ACT-AGENT', kind: 'alert', title: 'Agent update required', detail: 'Device is two releases behind the current stable channel.', time: '1 hr ago', actor: 'Agent Health' }, ...commonDeviceActivity('DEV190')] }),
  device({ id: 'DEV-000191', name: 'LON-FIN-WS044', user: 'Marcus Lee', userEmail: 'marcus.lee@hi5central.com', type: 'Windows laptop', os: 'Windows 11 24H2', site: 'London HQ', siteId: 'SITE-LON-HQ', group: 'Finance', groupId: 'GRP-FIN', status: 'Online', health: 'Healthy', lastSeen: 'Now', ip: '10.24.18.44', gateway: '10.24.18.1', mac: '54:14:F3:28:9B:44', agent: '1.6.2', cpu: 22, memory: 67, disk: 56, pendingPatches: 0, patchCompliance: 100, alerts: 0, warranty: '09 May 2028', serial: 'PF5K8T44', storageFreeGb: 225, tags: ['Finance', 'Windows 11'], relatedRecordIds: ['REQ-2217'], activity: [{ id: 'DEV191-ACT-SCRIPT', kind: 'automation', title: 'BitLocker status collected', detail: 'Recovery protector and encryption state inventory completed.', time: 'Today · 19:15', actor: 'Dana Sinclair' }, ...commonDeviceActivity('DEV191')] }),
  device({ id: 'DEV-000192', name: 'LON-NET-SW01', user: 'Network', type: 'Network appliance', platform: 'Network', os: 'Cisco IOS XE 17.15.4', osBuild: '17.15.04', edition: 'Enterprise', site: 'London DC', siteId: 'SITE-LON-DC', group: 'Network', groupId: 'GRP-NETWORK', status: 'Online', health: 'Healthy', lastSeen: 'Now', ip: '10.20.10.2', publicIp: 'N/A', gateway: '10.20.10.1', mac: '00:1E:F6:AA:10:02', agent: 'SNMP', cpu: 16, memory: 42, disk: 0, pendingPatches: 0, patchCompliance: 100, alerts: 0, warranty: '14 Feb 2029', manufacturer: 'Cisco', model: 'Catalyst 9300-48P', serial: 'FCW2921L0N2', bios: 'ROMMON 17.12.1r', processor: 'Cisco UADP 2.0', ramGb: 8, storageGb: 8, storageFreeGb: 4, uptime: '112d 9h', lastBoot: '15 May 2026 · 01:18', tags: ['Core network', 'Switch'], policy: 'Network monitoring', security: { encryption: 'N/A', encryptionState: 'N/A', av: 'N/A', avState: 'N/A', firewall: 'Control plane protection enabled', secureBoot: 'Trust Anchor enabled', tpm: 'Hardware trust anchor', edr: 'N/A', edrState: 'N/A' }, installedSoftware: [], patches: [], networkAdapters: [{ name: 'Vlan10', type: 'Management', address: '10.20.10.2', mac: '00:1E:F6:AA:10:02', status: 'Connected' }], activity: commonDeviceActivity('DEV192') }),
  device({ id: 'DEV-000193', name: 'MAN-OPS-WS021', user: 'Daniel Cole', userEmail: 'daniel.cole@hi5central.com', type: 'Windows desktop', os: 'Windows 11 24H2', site: 'Manchester', siteId: 'SITE-MAN', group: 'Operations', groupId: 'GRP-OPS', status: 'Offline', health: 'Offline', lastSeen: 'Yesterday 17:42', ip: '10.31.12.21', gateway: '10.31.12.1', mac: '40:A8:F0:88:12:21', agent: '1.5.9', cpu: 0, memory: 0, disk: 73, pendingPatches: 11, patchCompliance: 61, alerts: 1, warranty: '03 Dec 2026', manufacturer: 'Dell', model: 'OptiPlex 7020', serial: 'DL7020OPS21', processor: 'Intel Core i5-14500', ramGb: 16, storageGb: 512, storageFreeGb: 138, uptime: 'Offline', lastBoot: '03 Sep 2026 · 08:02', tags: ['Operations', 'Offline', 'Warranty'], activity: [{ id: 'DEV193-ACT-WARRANTY', kind: 'alert', title: 'Warranty expiry approaching', detail: 'Warranty expires within the configured lifecycle threshold.', time: 'Yesterday', actor: 'Asset Lifecycle' }, ...commonDeviceActivity('DEV193')] }),
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
