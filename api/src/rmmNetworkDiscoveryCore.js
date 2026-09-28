import { pool, withTransaction } from './db.js'

function clean(value = '', max = 4096) {
  return String(value ?? '').trim().slice(0, max)
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function asInteger(value, fallback = null) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.trunc(number) : fallback
}

function inferVendor(sysObjectId = '', sysDescr = '') {
  const oid = clean(sysObjectId, 256)
  const descr = clean(sysDescr, 4096).toLowerCase()
  const enterprise = [
    ['1.3.6.1.4.1.9', 'Cisco'],
    ['1.3.6.1.4.1.11', 'HPE'],
    ['1.3.6.1.4.1.318', 'APC'],
    ['1.3.6.1.4.1.674', 'Dell'],
    ['1.3.6.1.4.1.253', 'Xerox'],
    ['1.3.6.1.4.1.1248', 'Epson'],
    ['1.3.6.1.4.1.14988', 'MikroTik'],
    ['1.3.6.1.4.1.12356', 'Fortinet'],
    ['1.3.6.1.4.1.14823', 'Aruba'],
    ['1.3.6.1.4.1.41112', 'Ubiquiti'],
    ['1.3.6.1.4.1.6574', 'Synology'],
    ['1.3.6.1.4.1.24681', 'QNAP'],
    ['1.3.6.1.4.1.2435', 'Brother'],
    ['1.3.6.1.4.1.1602', 'Canon'],
  ]
  for (const [prefix, vendor] of enterprise) {
    if (oid === prefix || oid.startsWith(prefix + '.')) return vendor
  }
  const words = [
    ['cisco', 'Cisco'], ['hewlett', 'HPE'], ['aruba', 'Aruba'], ['fortinet', 'Fortinet'],
    ['mikrotik', 'MikroTik'], ['ubiquiti', 'Ubiquiti'], ['synology', 'Synology'],
    ['qnap', 'QNAP'], ['brother', 'Brother'], ['xerox', 'Xerox'], ['epson', 'Epson'],
    ['canon', 'Canon'], ['dell', 'Dell'], ['apc', 'APC'],
  ]
  return words.find(([needle]) => descr.includes(needle))?.[1] || ''
}

function inferDeviceType(sysDescr = '', sysObjectId = '') {
  const value = (clean(sysDescr, 4096) + ' ' + clean(sysObjectId, 256)).toLowerCase()
  if (/firewall|fortigate|security appliance/.test(value)) return 'firewall'
  if (/wireless|access point|wifi|wi-fi/.test(value)) return 'access_point'
  if (/switch/.test(value)) return 'switch'
  if (/router|routing/.test(value)) return 'router'
  if (/printer|laserjet|officejet|imageclass/.test(value)) return 'printer'
  if (/ups|uninterruptible/.test(value)) return 'ups'
  if (/nas|storage|synology|qnap/.test(value)) return 'storage'
  if (/server/.test(value)) return 'server'
  return 'network_device'
}

export async function reconcileNetworkDiscoveryJobResult(completedJob, resultPayload = {}, success = false) {
  if (completedJob?.job_type !== 'network.discovery.scan') return

  const runId = clean(
    completedJob?.request_metadata?.network_discovery_run_id
      || completedJob?.payload?.runId,
    128,
  )
  if (!runId) return

  const runResult = await pool.query(
    `SELECT r.id,r.tenant_id,r.profile_id,r.agent_device_id,p.site_id
       FROM rmm_network_discovery_runs r
       JOIN rmm_network_discovery_profiles p
         ON p.id=r.profile_id AND p.tenant_id=r.tenant_id
      WHERE r.id=$1 AND r.tenant_id=$2
      LIMIT 1`,
    [runId, completedJob.tenant_id],
  )
  if (!runResult.rowCount) return

  const run = runResult.rows[0]
  const devices = asArray(resultPayload.devices).slice(0, 4096)
  const status = success ? 'completed' : 'failed'
  const addressesTotal = asInteger(resultPayload.addressesTotal ?? resultPayload.addresses_total, 0) || 0
  const addressesResponded = asInteger(
    resultPayload.addressesResponded ?? resultPayload.addresses_responded,
    devices.length,
  ) || 0
  const errorMessage = clean(
    completedJob.error_message || resultPayload.error || resultPayload.message,
    2000,
  )

  await withTransaction(async (client) => {
    if (success) {
      await client.query(
        `UPDATE rmm_network_devices
            SET status='offline',updated_at=now()
          WHERE tenant_id=$1 AND profile_id=$2`,
        [run.tenant_id, run.profile_id],
      )

      for (const raw of devices) {
        const ipAddress = clean(raw?.ipAddress ?? raw?.ip_address, 128)
        if (!ipAddress) continue
        const sysDescr = clean(raw?.sysDescr ?? raw?.sys_descr, 8192)
        const sysObjectId = clean(raw?.sysObjectId ?? raw?.sys_object_id, 512)
        const vendor = clean(raw?.vendor, 256) || inferVendor(sysObjectId, sysDescr)
        const deviceType = clean(raw?.deviceType ?? raw?.device_type, 64)
          || inferDeviceType(sysDescr, sysObjectId)

        await client.query(
          `INSERT INTO rmm_network_devices
            (tenant_id,profile_id,site_id,source_agent_device_id,ip_address,mac_address,hostname,
             snmp_version,sys_name,sys_descr,sys_object_id,sys_location,sys_contact,uptime_ticks,
             interface_count,vendor,model,device_type,status,interfaces,metadata,
             first_seen_at,last_seen_at,last_snmp_at,updated_at)
           VALUES
            ($1,$2,$3,$4,$5::inet,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'online',
             $19::jsonb,$20::jsonb,now(),now(),now(),now())
           ON CONFLICT (profile_id,ip_address)
           DO UPDATE SET
             site_id=EXCLUDED.site_id,
             source_agent_device_id=EXCLUDED.source_agent_device_id,
             mac_address=CASE WHEN EXCLUDED.mac_address<>'' THEN EXCLUDED.mac_address ELSE rmm_network_devices.mac_address END,
             hostname=CASE WHEN EXCLUDED.hostname<>'' THEN EXCLUDED.hostname ELSE rmm_network_devices.hostname END,
             snmp_version=EXCLUDED.snmp_version,
             sys_name=EXCLUDED.sys_name,
             sys_descr=EXCLUDED.sys_descr,
             sys_object_id=EXCLUDED.sys_object_id,
             sys_location=EXCLUDED.sys_location,
             sys_contact=EXCLUDED.sys_contact,
             uptime_ticks=EXCLUDED.uptime_ticks,
             interface_count=EXCLUDED.interface_count,
             vendor=CASE WHEN EXCLUDED.vendor<>'' THEN EXCLUDED.vendor ELSE rmm_network_devices.vendor END,
             model=CASE WHEN EXCLUDED.model<>'' THEN EXCLUDED.model ELSE rmm_network_devices.model END,
             device_type=EXCLUDED.device_type,
             status='online',
             interfaces=EXCLUDED.interfaces,
             metadata=EXCLUDED.metadata,
             last_seen_at=now(),
             last_snmp_at=now(),
             updated_at=now()`,
          [
            run.tenant_id,
            run.profile_id,
            run.site_id,
            run.agent_device_id,
            ipAddress,
            clean(raw?.macAddress ?? raw?.mac_address, 64),
            clean(raw?.hostname, 512),
            clean(raw?.snmpVersion ?? raw?.snmp_version, 32),
            clean(raw?.sysName ?? raw?.sys_name, 1024),
            sysDescr,
            sysObjectId,
            clean(raw?.sysLocation ?? raw?.sys_location, 2048),
            clean(raw?.sysContact ?? raw?.sys_contact, 2048),
            asInteger(raw?.uptimeTicks ?? raw?.uptime_ticks),
            asInteger(raw?.interfaceCount ?? raw?.interface_count),
            vendor,
            clean(raw?.model, 512),
            deviceType,
            JSON.stringify(asArray(raw?.interfaces).slice(0, 1024)),
            JSON.stringify(raw?.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
              ? raw.metadata
              : {}),
          ],
        )
      }
    }

    await client.query(
      `UPDATE rmm_network_discovery_runs
          SET status=$3,
              addresses_total=$4,
              addresses_responded=$5,
              snmp_devices=$6,
              result=$7::jsonb,
              error_message=$8,
              started_at=COALESCE(
                rmm_network_discovery_runs.started_at,
                job.claimed_started_at,
                rmm_network_discovery_runs.created_at
              ),
              completed_at=now(),
              updated_at=now()
        FROM (
          SELECT id,claimed_at AS claimed_started_at
            FROM rmm_agent_jobs
           WHERE id=$9
        ) job
       WHERE rmm_network_discovery_runs.id=$1
         AND rmm_network_discovery_runs.tenant_id=$2`,
      [
        run.id,
        run.tenant_id,
        status,
        addressesTotal,
        addressesResponded,
        devices.length,
        JSON.stringify(resultPayload),
        errorMessage,
        completedJob.id,
      ],
    )

    await client.query(
      `UPDATE rmm_network_discovery_profiles
          SET last_scan_at=now(),
              next_scan_at=CASE WHEN enabled
                THEN now() + make_interval(mins => scan_interval_minutes)
                ELSE NULL END,
              updated_at=now()
        WHERE id=$1 AND tenant_id=$2`,
      [run.profile_id, run.tenant_id],
    )
  })
}
