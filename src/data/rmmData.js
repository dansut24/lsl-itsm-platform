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

export const rmmSites = []

export const rmmDeviceGroups = []

export const rmmDevices = []

export const rmmAlerts = []

export const rmmPatchGroups = []

export const rmmJobs = []

export const rmmSoftware = []

export const rmmScripts = []

export const rmmPolicies = []

export const rmmActivity = []
