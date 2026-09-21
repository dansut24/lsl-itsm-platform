import { pool, withTransaction } from './db.js'
import { agentSocketForDevice, sendAgentMessage } from './rmmAgent.js'
import { verificationVersionForRelease } from './rmmSoftwareVersioning.js'
import { COMMON_WINDOWS_SOFTWARE_LOWER } from './rmmCommonSoftware.js'

function clean(value = '') { return String(value ?? '').trim() }
function lower(value = '') { return clean(value).toLowerCase() }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {} }
function array(value) { return Array.isArray(value) ? value : [] }

function identityPhraseMatches(value, pattern) {
  const haystack = lower(value)
  const needle = lower(pattern)
  if (!needle) return true
  if (!haystack || haystack.length < needle.length) return false
  let from = 0
  while (from <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, from)
    if (index < 0) return false
    const before = index > 0 ? haystack[index - 1] : ''
    const after = index + needle.length < haystack.length ? haystack[index + needle.length] : ''
    if ((!before || !/[a-z0-9]/.test(before)) && (!after || !/[a-z0-9]/.test(after))) return true
    from = index + 1
  }
  return false
}
function installedMatches(sourcePayload, catalogue) {
  return array(object(object(sourcePayload).software).items)
    .filter((item) => clean(item?.name))
    .filter((item) => identityPhraseMatches(item?.name, catalogue.name_pattern)
      && identityPhraseMatches(item?.publisher, catalogue.publisher_pattern))
}

function verifiedPatchResult(value) {
  const result = object(value)
  return result.success !== false
    && result.fallbackUsed !== true
    && (!clean(result.provider) || lower(result.provider) === 'vendor_direct')
    && (result.verificationPassed === true || object(result.verification).meetsTarget === true)
}

function qualificationProviderFailure(value) {
  const result = object(value)
  if (result.fallbackUsed === true) return 'qualification_vendor_direct_fallback_used'
  if (clean(result.provider) && lower(result.provider) !== 'vendor_direct') return 'qualification_non_vendor_provider_used'
  return ''
}

function terminalJobFailure(job) {
  if (!job) return ''
  if (!['failed', 'cancelled'].includes(clean(job.status))) return ''
  return clean(job.error_message || object(job.result).error || job.status)
}

async function liveQualificationRunner() {
  const result = await pool.query(
    `SELECT q.agent_device_id,a.tenant_id,a.inventory_id,a.agent_version,a.patch_capabilities,
            a.websocket_status,a.last_telemetry_at,i.name AS device_name,i.reference AS device_reference,
            i.source_payload
       FROM rmm_software_vendor_qualification_runners q
       JOIN rmm_agent_devices a ON a.id=q.agent_device_id AND a.disabled_at IS NULL
       JOIN rmm_device_inventory i ON i.id=a.inventory_id AND i.active=true
      WHERE q.enabled=true
        AND a.websocket_status='Connected'
        AND a.last_telemetry_at>now()-interval '90 seconds'
        AND COALESCE((a.patch_capabilities->>'softwareInstall')::boolean,false)=true
      ORDER BY a.last_telemetry_at DESC
      LIMIT 1`,
  )
  return result.rows[0] || null
}

async function markReview(queueId, error, evidence = {}) {
  await pool.query(
    `UPDATE rmm_software_qualification_queue
        SET state='review_required',last_error=$2,
            evidence=evidence || $3::jsonb,completed_at=now(),updated_at=now()
      WHERE id=$1`,
    [queueId, clean(error).slice(0, 1000), JSON.stringify({ ...evidence, reviewRequiredAt: new Date().toISOString() })],
  )
}

async function qualificationRow(queueId) {
  const result = await pool.query(
    `SELECT q.*,c.canonical_name,c.publisher,c.name_pattern,c.publisher_pattern,c.provider,
            c.provider_package_id,c.target_version,c.installer_type,c.execution,c.verification,
            c.source_metadata,c.qualification_state,c.status AS catalogue_status,
            a.inventory_id AS runner_inventory_id,i.source_payload AS runner_source_payload
       FROM rmm_software_qualification_queue q
       JOIN rmm_software_catalogue c ON c.id=q.catalogue_id
       LEFT JOIN rmm_agent_devices a ON a.id=q.runner_agent_device_id
       LEFT JOIN rmm_device_inventory i ON i.id=a.inventory_id
      WHERE q.id=$1 LIMIT 1`,
    [queueId],
  )
  return result.rows[0] || null
}

async function dispatchUninstall(queue, runner, item) {
  const liveSocket = agentSocketForDevice(runner.agent_device_id)
  const canPush = Boolean(liveSocket && liveSocket.readyState === 1)

  const payload = {
    name: clean(item?.name),
    registry_key: clean(item?.registry_key),
    scope: clean(item?.scope),
    user_profile: clean(item?.user_profile),
  }
  if (!payload.name && !payload.registry_key) {
    await markReview(queue.id, 'qualification_uninstall_identity_missing')
    return { dispatched: false }
  }

  const inserted = await pool.query(
    `INSERT INTO rmm_agent_jobs
      (tenant_id,agent_device_id,job_type,payload,initiated_by,initiated_by_label,request_metadata)
     VALUES ($1,$2,'software.uninstall',$3::jsonb,'system','Catalogue qualification',$4::jsonb)
     RETURNING id,status,created_at`,
    [
      runner.tenant_id,
      runner.agent_device_id,
      JSON.stringify(payload),
      JSON.stringify({
        source: 'catalogue_qualification_cleanup',
        qualification_queue_id: queue.id,
        catalogue_id: queue.catalogue_id,
      }),
    ],
  )
  const job = inserted.rows[0]
  let delivery = 'queued_agent_channel'

  if (canPush) {
    const claimed = await pool.query(
      `UPDATE rmm_agent_jobs SET status='claimed',claimed_at=now(),updated_at=now()
        WHERE id=$1 AND status='queued' RETURNING id`,
      [job.id],
    )
    if (claimed.rowCount) {
      const pushed = sendAgentMessage(runner.agent_device_id, {
        type: 'job_execute',
        job: { id: job.id, job_type: 'software.uninstall', payload, created_at: job.created_at },
      })
      if (pushed) {
        delivery = 'websocket'
      } else {
        await pool.query(
          `UPDATE rmm_agent_jobs
              SET status='queued',claimed_at=NULL,error_message='',updated_at=now()
            WHERE id=$1 AND status='claimed'`,
          [job.id],
        )
      }
    }
  }

  await pool.query(
    `UPDATE rmm_software_qualification_queue
        SET state='cleanup_running',cleanup_job_id=$2,last_error='',
            evidence=evidence || $3::jsonb,updated_at=now()
      WHERE id=$1`,
    [queue.id, job.id, JSON.stringify({
      cleanupDispatchedAt: new Date().toISOString(),
      cleanupDelivery: delivery,
      uninstallName: payload.name,
      uninstallRegistryKey: payload.registry_key,
      installedDisplayName: clean(item?.name),
      installedPublisher: clean(item?.publisher),
      installLocation: clean(item?.install_location),
      installedScope: clean(item?.scope),
      installedUserProfile: clean(item?.user_profile),
    })],
  )
  return { dispatched: true, queued: delivery !== 'websocket', jobId: job.id }
}

function safeQualificationProgramPath(value = '') {
  const path = clean(value).replace(/\//g, '\\').replace(/\\+$/g, '')
  if (!/^C:\\Program Files(?: \(x86\))?\\[^\\]+/i.test(path)) return ''
  return path
}

function safeQualificationAlias(value = '') {
  const alias = clean(value)
    .replace(/\s+\((?:32|64)-bit\)$/i, '')
    .replace(/\s+\(x64\)$/i, '')
  if (!alias || alias.length > 100 || /[\\/:*?"<>|]/.test(alias)) return ''
  return alias
}

function psSingleQuoted(value = '') {
  return "'" + clean(value).replace(/'/g, "''") + "'"
}

async function dispatchQualificationResidueCleanup(queue, runner, {
  finalState = 'passed',
  finalError = '',
  uninstallCompletedAt = '',
} = {}) {
  const liveSocket = agentSocketForDevice(runner.agent_device_id)
  const canPush = Boolean(liveSocket && liveSocket.readyState === 1)
  const evidence = object(queue.evidence)
  const installLocation = safeQualificationProgramPath(evidence.installLocation)
  const aliases = [...new Set([
    safeQualificationAlias(queue.canonical_name),
    safeQualificationAlias(evidence.installedDisplayName),
    safeQualificationAlias(evidence.uninstallName),
  ].filter(Boolean))]
  const startedAt = clean(queue.started_at || evidence.dispatchedAt || evidence.installCompletedAt || new Date().toISOString())
  const patchHostWorkDir = clean(queue.agent_job_id)
    ? `C:\\ProgramData\\Hi5Central\\Agent\\PatchHost\\jobs\\${clean(queue.agent_job_id)}`
    : ''
  const command = [
    "$ErrorActionPreference='SilentlyContinue'",
    `$start=[DateTime]::Parse(${psSingleQuoted(startedAt)}).ToUniversalTime()`,
    '$removed=@();$retained=@()',
    'function Size-Bytes($p){if(!(Test-Path -LiteralPath $p)){return 0};$m=Get-ChildItem -LiteralPath $p -Force -Recurse -File -ErrorAction SilentlyContinue|Measure-Object Length -Sum;return [int64]($m.Sum)}',
    'function Remove-QualificationTree($p,$reason,$onlyNew){if(!$p -or !(Test-Path -LiteralPath $p)){return};$i=Get-Item -LiteralPath $p -Force -ErrorAction SilentlyContinue;if($onlyNew -and $i -and $i.CreationTimeUtc -lt $start.AddMinutes(-2)){$script:retained+=[pscustomobject]@{Path=$p;Reason="pre_existing";Bytes=(Size-Bytes $p)};return};$b=Size-Bytes $p;Remove-Item -LiteralPath $p -Force -Recurse -ErrorAction SilentlyContinue;if(Test-Path -LiteralPath $p){$script:retained+=[pscustomobject]@{Path=$p;Reason="remove_failed";Bytes=(Size-Bytes $p)}}else{$script:removed+=[pscustomobject]@{Path=$p;Reason=$reason;Bytes=$b}}}',
    '$disk=Get-CimInstance Win32_LogicalDisk -Filter "DeviceID=\'C:\'"',
    '$before=[int64]$disk.FreeSpace',
    installLocation ? `Remove-QualificationTree ${psSingleQuoted(installLocation)} 'captured_install_location' $false` : '',
    patchHostWorkDir ? `Remove-QualificationTree ${psSingleQuoted(patchHostWorkDir)} 'patchhost_job_workdir' $false` : '',
    `$aliases=@(${aliases.map(psSingleQuoted).join(',')})`,
    "foreach($u in Get-ChildItem 'C:\\Users' -Directory -ErrorAction SilentlyContinue){foreach($rel in @('AppData\\Local','AppData\\Roaming')){foreach($a in $aliases){$p=Join-Path (Join-Path $u.FullName $rel) $a;Remove-QualificationTree $p 'qualification_created_appdata' $true}}}",
    "foreach($a in $aliases){$p=Join-Path 'C:\\ProgramData' $a;Remove-QualificationTree $p 'qualification_created_programdata' $true}",
    '$after=[int64](Get-CimInstance Win32_LogicalDisk -Filter "DeviceID=\'C:\'").FreeSpace',
    '[pscustomobject]@{BeforeFreeBytes=$before;AfterFreeBytes=$after;ReclaimedMiB=[math]::Round((($after-$before)/1MB),2);InstallLocation=' + psSingleQuoted(installLocation) + ';Removed=$removed;Retained=$retained}|ConvertTo-Json -Depth 6 -Compress',
  ].filter(Boolean).join(';')

  const inserted = await pool.query(
    `INSERT INTO rmm_agent_jobs
      (tenant_id,agent_device_id,job_type,payload,initiated_by,initiated_by_label,request_metadata)
     VALUES ($1,$2,'custom.command',$3::jsonb,'system','Catalogue qualification residue cleanup',$4::jsonb)
     RETURNING id,status,created_at`,
    [
      runner.tenant_id,
      runner.agent_device_id,
      JSON.stringify({ command, timeout_seconds: 180 }),
      JSON.stringify({
        source: 'catalogue_qualification_residue_cleanup',
        qualification_queue_id: queue.id,
        catalogue_id: queue.catalogue_id,
      }),
    ],
  )
  const job = inserted.rows[0]
  let delivery = 'queued_agent_channel'
  if (canPush) {
    const claimed = await pool.query(
      `UPDATE rmm_agent_jobs SET status='claimed',claimed_at=now(),updated_at=now()
        WHERE id=$1 AND status='queued' RETURNING id`,
      [job.id],
    )
    if (claimed.rowCount) {
      const pushed = sendAgentMessage(runner.agent_device_id, {
        type: 'job_execute',
        job: { id: job.id, job_type: 'custom.command', payload: { command, timeout_seconds: 180 }, created_at: job.created_at },
      })
      if (pushed) delivery = 'websocket'
      else {
        await pool.query(
          `UPDATE rmm_agent_jobs SET status='queued',claimed_at=NULL,error_message='',updated_at=now()
            WHERE id=$1 AND status='claimed'`,
          [job.id],
        )
      }
    }
  }

  await pool.query(
    `UPDATE rmm_software_qualification_queue
        SET state='cleanup_running',cleanup_job_id=$2,
            evidence=evidence || $3::jsonb,updated_at=now()
      WHERE id=$1`,
    [queue.id, job.id, JSON.stringify({
      cleanupPhase: 'residue_cleanup',
      uninstallJobId: queue.cleanup_job_id,
      uninstallCompletedAt,
      residueCleanupDispatchedAt: new Date().toISOString(),
      residueCleanupDelivery: delivery,
      residueFinalState: finalState,
      residueFinalError: clean(finalError),
      residueInstallLocation: installLocation,
      residueAliases: aliases,
    })],
  )
  return { dispatched: true, queued: delivery !== 'websocket', jobId: job.id }
}

function residueCleanupSummary(job) {
  const result = object(job?.result)
  const parsed = object(result.parsed)
  const data = Object.keys(parsed).length ? parsed : result
  return {
    reclaimedMiB: Number(data.ReclaimedMiB || 0) || 0,
    installLocation: clean(data.InstallLocation),
    removed: array(data.Removed).map((item) => ({
      path: clean(item?.Path),
      reason: clean(item?.Reason),
      bytes: Number(item?.Bytes || 0) || 0,
    })),
    retained: array(data.Retained).map((item) => ({
      path: clean(item?.Path),
      reason: clean(item?.Reason),
      bytes: Number(item?.Bytes || 0) || 0,
    })),
  }
}

async function finalizeResidueCleanup(current, cleanup, { upgrade = false } = {}) {
  const failure = terminalJobFailure(cleanup)
  if (failure || clean(cleanup?.status) !== 'completed') {
    await markReview(current.id, failure || 'qualification_residue_cleanup_failed', { stage: 'residue_cleanup' })
    return { id: current.id, state: 'review_required' }
  }
  const evidence = object(current.evidence)
  const summary = residueCleanupSummary(cleanup)
  if (clean(evidence.residueFinalState) === 'review_required') {
    await markReview(current.id, clean(evidence.residueFinalError) || 'qualification_cleanup_failed', {
      stage: 'residue_cleanup',
      residueCleanup: summary,
      residueCleanupCompletedAt: cleanup.completed_at || new Date().toISOString(),
    })
    return { id: current.id, state: 'review_required' }
  }

  const now = new Date().toISOString()
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE rmm_software_qualification_queue
          SET state='passed',last_error='',completed_at=now(),
              evidence=evidence || $2::jsonb,updated_at=now()
        WHERE id=$1`,
      [current.id, JSON.stringify({
        stage: 'passed',
        residueCleanupCompletedAt: cleanup.completed_at || now,
        residueCleanup: summary,
        inventoryRemovalConfirmedAt: now,
      })],
    )
    await client.query(
      `UPDATE rmm_software_catalogue
          SET qualification_evidence=qualification_evidence || $2::jsonb,updated_at=now()
        WHERE id=$1`,
      [current.catalogue_id, JSON.stringify(upgrade ? {
        upgradeVerified: true,
        upgradeFromVersion: clean(evidence.previousVersion),
        upgradeVersion: current.target_version,
        upgradeVerifiedAt: now,
        upgradeQualificationQueueId: current.id,
        qualificationRunnerAgentDeviceId: current.runner_agent_device_id,
        residueCleanupVerified: true,
        residueCleanupVerifiedAt: now,
        residueCleanupReclaimedMiB: summary.reclaimedMiB,
      } : {
        cleanInstallVerified: true,
        cleanInstallVersion: current.target_version,
        cleanInstallVerifiedAt: now,
        uninstallVerified: true,
        uninstallVerifiedAt: now,
        qualificationQueueId: current.id,
        qualificationRunnerAgentDeviceId: current.runner_agent_device_id,
        residueCleanupVerified: true,
        residueCleanupVerifiedAt: now,
        residueCleanupReclaimedMiB: summary.reclaimedMiB,
      })],
    )
  })
  return { id: current.id, state: 'passed' }
}

async function directReleaseForCatalogue(catalogueId) {
  const result = await pool.query(
    `SELECT c.*,r.id AS vendor_release_id,r.source_key,r.version AS release_version,
            r.installer_url,r.installer_sha256,r.installer_type AS release_installer_type,
            r.trust_state,r.asset_health_state,r.source_payload AS release_source_payload,
            s.last_success_at AS source_last_success_at,s.last_error AS source_last_error,
            COALESCE(NULLIF(b.metadata->>'expectedSigner',''),
                     NULLIF(b.metadata->>'autoExpectedSigner',''),
                     NULLIF(b.metadata->>'signerBaseline',''),
                     NULLIF(r.source_payload->>'expectedSigner',''),
                     NULLIF(r.source_payload->>'signerBaseline',''),
                     NULLIF(r.trust_evidence->>'signer',''),
                     NULLIF(s.metadata->>'expectedSigner',''),
                     NULLIF(s.metadata->>'signerBaseline',''),
                     NULLIF(c.publisher,''),'') AS expected_signer,
            COALESCE(NULLIF(b.metadata->>'installerTechnology',''),
                     NULLIF(r.source_payload->>'installerTechnology',''),'') AS installer_technology,
            COALESCE(NULLIF(b.metadata->>'wingetPackageId',''),'') AS binding_winget_package_id
       FROM rmm_software_catalogue c
       JOIN rmm_software_vendor_releases r
         ON r.provider_package_id=c.external_key AND r.version=c.target_version
       JOIN rmm_software_vendor_sources s ON s.source_key=r.source_key AND s.enabled=true
       LEFT JOIN rmm_software_vendor_bindings b
         ON b.source_key=r.source_key AND b.provider_package_id=r.provider_package_id
        AND b.channel=r.channel AND b.platform=r.platform AND b.architecture=r.architecture
        AND b.enabled=true
      WHERE c.id=$1 AND c.tenant_id IS NULL AND c.status='active'
        AND c.qualification_state='deployment_candidate'
        AND r.trust_state='direct_ready'
      ORDER BY r.source_priority DESC,COALESCE(r.release_date,r.last_seen_at) DESC
      LIMIT 1`,
    [catalogueId],
  )
  return result.rows[0] || null
}

async function dispatchCleanInstall(queue, runner) {
  const liveSocket = agentSocketForDevice(runner.agent_device_id)
  if (!liveSocket || liveSocket.readyState !== 1) {
    return { dispatched: false, offline: true }
  }

  const catalogue = await directReleaseForCatalogue(queue.catalogue_id)
  if (!catalogue) {
    await markReview(queue.id, 'qualification_direct_release_not_ready')
    return { dispatched: false }
  }
  if (clean(catalogue.source_last_error) || !catalogue.source_last_success_at) {
    await markReview(queue.id, 'qualification_source_health_not_ready')
    return { dispatched: false }
  }
  if (clean(catalogue.asset_health_state) === 'dead') {
    await markReview(queue.id, 'qualification_vendor_asset_dead')
    return { dispatched: false }
  }
  if (!/^https:\/\//i.test(clean(catalogue.installer_url))
    || !/^[a-f0-9]{64}$/i.test(clean(catalogue.installer_sha256))
    || !['msi', 'exe'].includes(lower(catalogue.release_installer_type))
    || !clean(catalogue.expected_signer)) {
    await markReview(queue.id, 'qualification_artifact_gate_failed')
    return { dispatched: false }
  }

  const current = await qualificationRow(queue.id)
  if (!current) return { dispatched: false }
  if (installedMatches(runner.source_payload, current).length) {
    await markReview(queue.id, 'qualification_runner_not_clean', { stage: 'pre_install' })
    return { dispatched: false }
  }

  const sourceMetadata = object(catalogue.source_metadata)
  const execution = object(catalogue.execution)
  const verification = object(catalogue.verification)
  const fallbackPackageId = sourceMetadata.wingetFallbackReady === true
    ? clean(catalogue.binding_winget_package_id || sourceMetadata.wingetPackageId)
    : ''
  const executionPackageId = fallbackPackageId || clean(catalogue.provider_package_id)
  const verificationMethod = clean(verification.method || verification.provider || 'winget')
  if (!verificationMethod || !clean(catalogue.target_version)) {
    await markReview(queue.id, 'qualification_verification_gate_failed')
    return { dispatched: false }
  }

  const verificationTargetVersion = verificationVersionForRelease(catalogue.target_version, verification)
  const manifest = {
    protocolVersion: 1,
    action: 'software.install',
    intent: 'install',
    catalogueId: catalogue.id,
    applicationName: catalogue.canonical_name,
    publisher: catalogue.publisher,
    packageId: executionPackageId,
    installedVersion: '',
    targetVersion: clean(catalogue.target_version),
    provider: 'vendor_direct',
    vendorSource: clean(catalogue.source_key),
    downloadUrl: clean(catalogue.installer_url),
    sha256: clean(catalogue.installer_sha256).toUpperCase(),
    installerType: lower(catalogue.release_installer_type),
    installerTechnology: clean(catalogue.installer_technology),
    installArguments: clean(execution.installArguments),
    expectedSigner: clean(catalogue.expected_signer),
    fallbackProvider: '',
    verification: {
      ...verification,
      method: verificationMethod,
      packageId: clean(verification.packageId || executionPackageId),
      targetVersion: verificationTargetVersion,
    },
  }

  const created = await withTransaction(async (client) => {
    const jobResult = await client.query(
      `INSERT INTO rmm_agent_jobs
        (tenant_id,agent_device_id,job_type,payload,initiated_by,initiated_by_label,request_metadata)
       VALUES ($1,$2,'patch.software',$3::jsonb,'system','Catalogue qualification',$4::jsonb)
       RETURNING id,status,created_at`,
      [
        runner.tenant_id,
        runner.agent_device_id,
        JSON.stringify(manifest),
        JSON.stringify({
          source: 'catalogue_qualification_clean_install',
          qualification_queue_id: queue.id,
          catalogue_id: catalogue.id,
          vendor_release_id: catalogue.vendor_release_id,
          device_name: runner.device_name,
          device_reference: runner.device_reference,
        }),
      ],
    )
    const job = jobResult.rows[0]
    const deploymentResult = await client.query(
      `INSERT INTO rmm_patch_deployments
        (tenant_id,inventory_id,catalogue_id,agent_job_id,application_name,provider,provider_package_id,
         installed_version,target_version,status,result)
       VALUES ($1,$2,$3,$4,$5,'vendor_direct',$6,'',$7,'eligible',$8::jsonb)
       RETURNING id`,
      [
        runner.tenant_id,
        runner.inventory_id,
        catalogue.id,
        job.id,
        catalogue.canonical_name,
        executionPackageId,
        clean(catalogue.target_version),
        JSON.stringify({ qualificationTest: 'clean_install', vendorSource: catalogue.source_key }),
      ],
    )
    const deployment = deploymentResult.rows[0]
    await client.query(
      `UPDATE rmm_software_qualification_queue
          SET state='running',attempt_count=attempt_count+1,runner_agent_device_id=$2,
              agent_job_id=$3,deployment_id=$4,cleanup_job_id=NULL,last_error='',
              started_at=now(),completed_at=NULL,
              evidence=evidence || $5::jsonb,updated_at=now()
        WHERE id=$1`,
      [queue.id, runner.agent_device_id, job.id, deployment.id, JSON.stringify({
        stage: 'install_running',
        targetVersion: catalogue.target_version,
        vendorSource: catalogue.source_key,
        vendorReleaseId: catalogue.vendor_release_id,
        dispatchedAt: new Date().toISOString(),
      })],
    )
    return { job, deployment }
  })
  const claimed = await pool.query(
    `UPDATE rmm_agent_jobs SET status='claimed',claimed_at=now(),updated_at=now()
      WHERE id=$1 AND status='queued' RETURNING id`,
    [created.job.id],
  )
  const pushed = claimed.rowCount > 0 && sendAgentMessage(runner.agent_device_id, {
    type: 'job_execute',
    job: {
      id: created.job.id,
      job_type: 'patch.software',
      payload: manifest,
      created_at: created.job.created_at,
    },
  })

  if (!pushed) {
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE rmm_agent_jobs SET status='cancelled',claimed_at=NULL,completed_at=now(),
            error_message='Qualification runner went offline before install dispatch.',updated_at=now()
          WHERE id=$1`,
        [created.job.id],
      )
      await client.query(
        `UPDATE rmm_patch_deployments SET status='cancelled',completed_at=now(),updated_at=now()
          WHERE id=$1`,
        [created.deployment.id],
      )
      await client.query(
        `UPDATE rmm_software_qualification_queue
            SET state='queued',runner_agent_device_id=NULL,agent_job_id=NULL,deployment_id=NULL,
                last_error='runner_offline_before_install_dispatch',updated_at=now()
          WHERE id=$1`,
        [queue.id],
      )
    })
    return { dispatched: false, offline: true }
  }
  return { dispatched: true, jobId: created.job.id, deploymentId: created.deployment.id }
}

function compareVersionish(a, b) {
  return clean(a).localeCompare(clean(b), undefined, { numeric: true, sensitivity: 'base' })
}

async function upgradeReleasePair(catalogueId) {
  const result = await pool.query(
    `SELECT c.*,r.id AS vendor_release_id,r.source_key,r.version AS release_version,
            r.installer_url,r.installer_sha256,r.installer_type AS release_installer_type,
            r.trust_state,r.asset_health_state,r.source_payload AS release_source_payload,
            r.trust_evidence AS release_trust_evidence,
            s.last_success_at AS source_last_success_at,s.last_error AS source_last_error,
            COALESCE(NULLIF(b.metadata->>'expectedSigner',''),
                     NULLIF(r.trust_evidence->>'signer',''),
                     NULLIF(r.source_payload->>'signerBaseline',''),
                     NULLIF(c.publisher,''),'') AS expected_signer,
            COALESCE(NULLIF(r.source_payload->>'installerTechnology',''),
                     NULLIF(b.metadata->>'installerTechnology',''),
                     NULLIF(r.installer_type,''),'') AS installer_technology
       FROM rmm_software_catalogue c
       JOIN rmm_software_vendor_releases r
         ON r.provider_package_id=c.external_key
        AND r.source_key=c.source_metadata->>'latestSource'
       JOIN rmm_software_vendor_sources s ON s.source_key=r.source_key AND s.enabled=true
       LEFT JOIN rmm_software_vendor_bindings b
         ON b.source_key=r.source_key AND b.provider_package_id=r.provider_package_id
        AND b.channel=r.channel AND b.platform=r.platform AND b.architecture=r.architecture
        AND b.enabled=true
      WHERE c.id=$1 AND c.tenant_id IS NULL AND c.status='active'
        AND c.qualification_state='deployment_candidate'
        AND r.trust_state='direct_ready'
      ORDER BY r.last_seen_at DESC`,
    [catalogueId],
  )
  const target = result.rows.find((row) => clean(row.release_version) === clean(row.target_version))
  const previous = result.rows
    .filter((row) => compareVersionish(row.release_version, row.target_version) < 0)
    .sort((a, b) => compareVersionish(b.release_version, a.release_version))[0]
  return { target: target || null, previous: previous || null }
}

function strictDirectArtifactReady(release) {
  return Boolean(
    release
    && !clean(release.source_last_error)
    && release.source_last_success_at
    && clean(release.asset_health_state) !== 'dead'
    && /^https:\/\//i.test(clean(release.installer_url))
    && /^[a-f0-9]{64}$/i.test(clean(release.installer_sha256))
    && ['msi', 'exe'].includes(lower(release.release_installer_type))
    && clean(release.expected_signer),
  )
}

async function dispatchUpgradeInstall(queue, runner, release, { intent, installedVersion = '', stage }) {
  const liveSocket = agentSocketForDevice(runner.agent_device_id)
  if (!liveSocket || liveSocket.readyState !== 1) return { dispatched: false, offline: true }
  if (!strictDirectArtifactReady(release)) {
    await markReview(queue.id, 'qualification_upgrade_artifact_gate_failed', { stage, releaseVersion: clean(release?.release_version) })
    return { dispatched: false }
  }

  const verification = object(release.verification)
  const execution = object(release.execution)
  const targetVersion = clean(release.release_version)
  const packageId = clean(release.provider_package_id)
  const verificationMethod = clean(verification.method || verification.provider || 'uninstall_registry')
  if (!targetVersion || !verificationMethod) {
    await markReview(queue.id, 'qualification_upgrade_verification_gate_failed', { stage })
    return { dispatched: false }
  }

  const verificationTargetVersion = verificationVersionForRelease(targetVersion, verification)
  const manifest = {
    protocolVersion: 1,
    action: 'software.install',
    intent,
    catalogueId: release.id,
    applicationName: release.canonical_name,
    publisher: release.publisher,
    packageId,
    installedVersion: clean(installedVersion),
    targetVersion,
    provider: 'vendor_direct',
    vendorSource: clean(release.source_key),
    downloadUrl: clean(release.installer_url),
    sha256: clean(release.installer_sha256).toUpperCase(),
    installerType: lower(release.release_installer_type),
    installerTechnology: clean(release.installer_technology),
    installArguments: clean(execution.installArguments),
    expectedSigner: clean(release.expected_signer),
    fallbackProvider: '',
    verification: {
      ...verification,
      method: verificationMethod,
      packageId: clean(verification.packageId || packageId),
      targetVersion: verificationTargetVersion,
    },
  }

  const created = await withTransaction(async (client) => {
    const jobResult = await client.query(
      `INSERT INTO rmm_agent_jobs
        (tenant_id,agent_device_id,job_type,payload,initiated_by,initiated_by_label,request_metadata)
       VALUES ($1,$2,'patch.software',$3::jsonb,'system','Catalogue upgrade qualification',$4::jsonb)
       RETURNING id,status,created_at`,
      [
        runner.tenant_id,
        runner.agent_device_id,
        JSON.stringify(manifest),
        JSON.stringify({
          source: 'catalogue_qualification_upgrade',
          qualification_queue_id: queue.id,
          catalogue_id: release.id,
          vendor_release_id: release.vendor_release_id,
          stage,
          device_name: runner.device_name,
          device_reference: runner.device_reference,
        }),
      ],
    )
    const job = jobResult.rows[0]
    const deploymentResult = await client.query(
      `INSERT INTO rmm_patch_deployments
        (tenant_id,inventory_id,catalogue_id,agent_job_id,application_name,provider,provider_package_id,
         installed_version,target_version,status,result)
       VALUES ($1,$2,$3,$4,$5,'vendor_direct',$6,$7,$8,'eligible',$9::jsonb)
       RETURNING id`,
      [
        runner.tenant_id,
        runner.inventory_id,
        release.id,
        job.id,
        release.canonical_name,
        packageId,
        clean(installedVersion),
        targetVersion,
        JSON.stringify({ qualificationTest: 'upgrade', stage, vendorSource: release.source_key, intent }),
      ],
    )
    const deployment = deploymentResult.rows[0]
    await client.query(
      `UPDATE rmm_software_qualification_queue
          SET state='running',runner_agent_device_id=$2,agent_job_id=$3,deployment_id=$4,
              cleanup_job_id=NULL,last_error='',started_at=COALESCE(started_at,now()),completed_at=NULL,
              attempt_count=CASE WHEN $6='upgrade_baseline_running' THEN attempt_count+1 ELSE attempt_count END,
              evidence=evidence || $5::jsonb,updated_at=now()
        WHERE id=$1`,
      [queue.id, runner.agent_device_id, job.id, deployment.id, JSON.stringify({
        stage,
        releaseVersion: targetVersion,
        vendorReleaseId: release.vendor_release_id,
        dispatchedAt: new Date().toISOString(),
        ...(intent === 'install' ? { previousVersion: targetVersion } : { targetVersion }),
      }), stage],
    )
    return { job, deployment }
  })

  const claimed = await pool.query(
    `UPDATE rmm_agent_jobs SET status='claimed',claimed_at=now(),updated_at=now()
      WHERE id=$1 AND status='queued' RETURNING id`,
    [created.job.id],
  )
  const pushed = claimed.rowCount > 0 && sendAgentMessage(runner.agent_device_id, {
    type: 'job_execute',
    job: { id: created.job.id, job_type: 'patch.software', payload: manifest, created_at: created.job.created_at },
  })
  if (!pushed) {
    await markReview(queue.id, 'qualification_runner_offline_before_upgrade_dispatch', { stage })
    return { dispatched: false, offline: true }
  }
  return { dispatched: true, jobId: created.job.id, deploymentId: created.deployment.id }
}

async function dispatchUpgradeBaseline(queue, runner) {
  const current = await qualificationRow(queue.id)
  if (!current) return { dispatched: false }
  if (installedMatches(runner.source_payload, current).length) {
    await markReview(queue.id, 'qualification_runner_not_clean', { stage: 'upgrade_pre_install' })
    return { dispatched: false }
  }
  const pair = await upgradeReleasePair(queue.catalogue_id)
  if (!pair.target) {
    await markReview(queue.id, 'qualification_current_trusted_release_not_available', { stage: 'upgrade_pre_install' })
    return { dispatched: false }
  }
  if (!pair.previous) {
    await markReview(queue.id, 'previous_trusted_release_not_available', { stage: 'upgrade_pre_install' })
    return { dispatched: false }
  }
  return dispatchUpgradeInstall(queue, runner, pair.previous, {
    intent: 'install',
    installedVersion: '',
    stage: 'upgrade_baseline_running',
  })
}

async function reconcileUpgradeQueueRow(queue, runner) {
  const current = await qualificationRow(queue.id)
  if (!current) return { id: queue.id, state: 'missing' }
  const evidence = object(current.evidence)

  if (current.state === 'running') {
    const jobResult = await pool.query(
      `SELECT status,result,error_message,completed_at FROM rmm_agent_jobs WHERE id=$1 LIMIT 1`,
      [current.agent_job_id],
    )
    const job = jobResult.rows[0]
    if (!job || ['queued', 'claimed'].includes(clean(job.status))) return { id: current.id, state: current.state }
    const failure = terminalJobFailure(job)
    const providerFailure = qualificationProviderFailure(job.result)
    if (failure || providerFailure || clean(job.status) !== 'completed' || !verifiedPatchResult(job.result)) {
      if (current.deployment_id) {
        await pool.query(
          `UPDATE rmm_patch_deployments SET status=$2,result=COALESCE($3::jsonb,'{}'::jsonb),
              completed_at=COALESCE(completed_at,now()),updated_at=now() WHERE id=$1`,
          [current.deployment_id, clean(job.status) === 'cancelled' ? 'cancelled' : 'verification_failed', JSON.stringify(object(job?.result))],
        )
      }
      await markReview(current.id, failure || providerFailure || 'qualification_upgrade_verification_failed', { stage: clean(evidence.stage) })
      return { id: current.id, state: 'review_required' }
    }

    if (current.deployment_id) {
      await pool.query(
        `UPDATE rmm_patch_deployments SET status='succeeded',result=$2::jsonb,
            completed_at=COALESCE(completed_at,$3,now()),updated_at=now() WHERE id=$1`,
        [current.deployment_id, JSON.stringify(object(job.result)), job.completed_at || null],
      )
    }

    if (clean(evidence.stage) === 'upgrade_baseline_running') {
      if (!runner || clean(current.runner_agent_device_id) !== clean(runner.agent_device_id)) {
        return { id: current.id, state: current.state }
      }
      const pair = await upgradeReleasePair(current.catalogue_id)
      if (!pair.target || !pair.previous) {
        await markReview(current.id, 'qualification_upgrade_release_pair_lost', { stage: 'upgrade_target_dispatch' })
        return { id: current.id, state: 'review_required' }
      }
      const result = await dispatchUpgradeInstall(current, runner, pair.target, {
        intent: 'update',
        installedVersion: clean(pair.previous.release_version),
        stage: 'upgrade_target_running',
      })
      return { id: current.id, state: result.dispatched ? 'running' : 'review_required' }
    }

    if (clean(evidence.stage) === 'upgrade_target_running') {
      const result = object(job.result)
      await pool.query(
        `UPDATE rmm_software_qualification_queue
            SET state='cleanup_pending',last_error='',
                evidence=evidence || $2::jsonb,updated_at=now()
          WHERE id=$1`,
        [current.id, JSON.stringify({
          stage: 'upgrade_cleanup_pending',
          upgradeCompletedAt: job.completed_at || new Date().toISOString(),
          verifiedVersion: clean(result.verifiedVersion || object(result.verification).installedVersion),
        })],
      )
      return { id: current.id, state: 'cleanup_pending' }
    }

    await markReview(current.id, 'qualification_upgrade_unknown_stage', { stage: clean(evidence.stage) })
    return { id: current.id, state: 'review_required' }
  }

  if (current.state === 'cleanup_pending') {
    if (!runner || clean(current.runner_agent_device_id) !== clean(runner.agent_device_id)) return { id: current.id, state: current.state }
    const installed = installedMatches(runner.source_payload, current)
    if (installed.length) {
      const dispatched = await dispatchUninstall(current, runner, installed[installed.length - 1])
      return { id: current.id, state: dispatched.dispatched ? 'cleanup_running' : 'cleanup_pending' }
    }
    const completedAt = Date.parse(clean(evidence.upgradeCompletedAt))
    if (Number.isFinite(completedAt) && Date.now() - completedAt > 10 * 60 * 1000) {
      await markReview(current.id, 'qualification_upgrade_not_visible_in_inventory', { stage: 'upgrade_cleanup_pending' })
      return { id: current.id, state: 'review_required' }
    }
    return { id: current.id, state: current.state }
  }

  if (current.state === 'cleanup_running') {
    const cleanupResult = await pool.query(
      `SELECT status,result,error_message,completed_at FROM rmm_agent_jobs WHERE id=$1 LIMIT 1`,
      [current.cleanup_job_id],
    )
    const cleanup = cleanupResult.rows[0]
    if (!cleanup || ['queued', 'claimed'].includes(clean(cleanup.status))) return { id: current.id, state: current.state }
    if (clean(object(current.evidence).cleanupPhase) === 'residue_cleanup') {
      return finalizeResidueCleanup(current, cleanup, { upgrade: true })
    }
    const failure = terminalJobFailure(cleanup)
    if (failure || clean(cleanup.status) !== 'completed') {
      if (runner && clean(current.runner_agent_device_id) === clean(runner.agent_device_id)
        && !installedMatches(runner.source_payload, current).length) {
        const dispatched = await dispatchQualificationResidueCleanup(current, runner, {
          finalState: 'review_required',
          finalError: failure || 'qualification_upgrade_cleanup_failed',
          uninstallCompletedAt: cleanup.completed_at || '',
        })
        return { id: current.id, state: dispatched.dispatched ? 'cleanup_running' : current.state }
      }
      await markReview(current.id, failure || 'qualification_upgrade_cleanup_failed', { stage: 'upgrade_cleanup' })
      return { id: current.id, state: 'review_required' }
    }
    if (!runner || clean(current.runner_agent_device_id) !== clean(runner.agent_device_id)) return { id: current.id, state: current.state }
    const remaining = installedMatches(runner.source_payload, current)
    if (remaining.length) {
      const completedAt = Date.parse(clean(cleanup.completed_at))
      if (Number.isFinite(completedAt) && Date.now() - completedAt > 10 * 60 * 1000) {
        await markReview(current.id, 'qualification_upgrade_uninstall_residue_detected', {
          stage: 'upgrade_cleanup',
          remaining: remaining.map((item) => ({ name: clean(item?.name), version: clean(item?.version), registryKey: clean(item?.registry_key) })),
        })
        return { id: current.id, state: 'review_required' }
      }
      return { id: current.id, state: current.state }
    }

    const dispatched = await dispatchQualificationResidueCleanup(current, runner, {
      finalState: 'passed',
      uninstallCompletedAt: cleanup.completed_at || '',
    })
    return { id: current.id, state: dispatched.dispatched ? 'cleanup_running' : current.state }
  }

  return { id: current.id, state: current.state }
}

async function reconcileQueueRow(queue, runner) {
  const current = await qualificationRow(queue.id)
  if (!current) return { id: queue.id, state: 'missing' }

  if (current.state === 'running') {
    const jobResult = await pool.query(
      `SELECT status,result,error_message,completed_at FROM rmm_agent_jobs WHERE id=$1 LIMIT 1`,
      [current.agent_job_id],
    )
    const job = jobResult.rows[0]
    if (!job || ['queued', 'claimed'].includes(clean(job.status))) return { id: current.id, state: current.state }
    const failure = terminalJobFailure(job)
    const providerFailure = qualificationProviderFailure(job.result)
    if (failure || providerFailure || clean(job.status) !== 'completed' || !verifiedPatchResult(job.result)) {
      if (current.deployment_id) {
        await pool.query(
          `UPDATE rmm_patch_deployments SET status=$2,result=COALESCE($3::jsonb,'{}'::jsonb),
              completed_at=COALESCE(completed_at,now()),updated_at=now() WHERE id=$1`,
          [current.deployment_id, clean(job.status) === 'cancelled' ? 'cancelled' : 'verification_failed', JSON.stringify(object(job?.result))],
        )
      }
      await markReview(current.id, failure || providerFailure || 'qualification_install_verification_failed', { stage: 'install' })
      return { id: current.id, state: 'review_required' }
    }

    if (current.deployment_id) {
      await pool.query(
        `UPDATE rmm_patch_deployments SET status='succeeded',result=$2::jsonb,
            completed_at=COALESCE(completed_at,$3,now()),updated_at=now() WHERE id=$1`,
        [current.deployment_id, JSON.stringify(object(job.result)), job.completed_at || null],
      )
    }
    const result = object(job.result)
    await pool.query(
      `UPDATE rmm_software_qualification_queue
          SET state='cleanup_pending',last_error='',
              evidence=evidence || $2::jsonb,updated_at=now()
        WHERE id=$1`,
      [current.id, JSON.stringify({
        stage: 'cleanup_pending',
        installCompletedAt: job.completed_at || new Date().toISOString(),
        verifiedVersion: clean(result.verifiedVersion || object(result.verification).installedVersion),
        installProvider: clean(result.provider),
      })],
    )
    return { id: current.id, state: 'cleanup_pending' }
  }
  if (current.state === 'cleanup_pending') {
    if (!runner || clean(current.runner_agent_device_id) !== clean(runner.agent_device_id)) {
      return { id: current.id, state: current.state }
    }
    const installed = installedMatches(runner.source_payload, current)
    if (installed.length) {
      const dispatched = await dispatchUninstall(current, runner, installed[installed.length - 1])
      return { id: current.id, state: dispatched.dispatched ? 'cleanup_running' : 'cleanup_pending' }
    }
    const completedAt = Date.parse(clean(object(current.evidence).installCompletedAt))
    if (Number.isFinite(completedAt) && Date.now() - completedAt > 10 * 60 * 1000) {
      await markReview(current.id, 'qualification_install_not_visible_in_inventory', { stage: 'cleanup_pending' })
      return { id: current.id, state: 'review_required' }
    }
    return { id: current.id, state: current.state }
  }

  if (current.state === 'cleanup_running') {
    const cleanupResult = await pool.query(
      `SELECT status,result,error_message,completed_at FROM rmm_agent_jobs WHERE id=$1 LIMIT 1`,
      [current.cleanup_job_id],
    )
    const cleanup = cleanupResult.rows[0]
    if (!cleanup || ['queued', 'claimed'].includes(clean(cleanup.status))) return { id: current.id, state: current.state }
    if (clean(object(current.evidence).cleanupPhase) === 'residue_cleanup') {
      return finalizeResidueCleanup(current, cleanup)
    }
    const failure = terminalJobFailure(cleanup)
    if (failure || clean(cleanup.status) !== 'completed') {
      if (runner && clean(current.runner_agent_device_id) === clean(runner.agent_device_id)
        && !installedMatches(runner.source_payload, current).length) {
        const dispatched = await dispatchQualificationResidueCleanup(current, runner, {
          finalState: 'review_required',
          finalError: failure || 'qualification_cleanup_failed',
          uninstallCompletedAt: cleanup.completed_at || '',
        })
        return { id: current.id, state: dispatched.dispatched ? 'cleanup_running' : current.state }
      }
      await markReview(current.id, failure || 'qualification_cleanup_failed', { stage: 'cleanup' })
      return { id: current.id, state: 'review_required' }
    }
    if (!runner || clean(current.runner_agent_device_id) !== clean(runner.agent_device_id)) {
      return { id: current.id, state: current.state }
    }
    const remaining = installedMatches(runner.source_payload, current)
    if (remaining.length) {
      const completedAt = Date.parse(clean(cleanup.completed_at))
      if (Number.isFinite(completedAt) && Date.now() - completedAt > 10 * 60 * 1000) {
        await markReview(current.id, 'qualification_uninstall_residue_detected', {
          stage: 'cleanup',
          remaining: remaining.map((item) => ({ name: clean(item?.name), version: clean(item?.version), registryKey: clean(item?.registry_key) })),
        })
        return { id: current.id, state: 'review_required' }
      }
      return { id: current.id, state: current.state }
    }

    const dispatched = await dispatchQualificationResidueCleanup(current, runner, {
      finalState: 'passed',
      uninstallCompletedAt: cleanup.completed_at || '',
    })
    return { id: current.id, state: dispatched.dispatched ? 'cleanup_running' : current.state }
  }

  return { id: current.id, state: current.state }
}

export async function queueCommonSoftwareQualifications({ limit = 50 } = {}) {
  const safeLimit = Math.max(1, Math.min(COMMON_WINDOWS_SOFTWARE_LOWER.length, Number(limit) || 50))
  const result = await pool.query(
    `WITH candidates AS (
       SELECT c.id AS catalogue_id,c.canonical_name,
              2000-array_position($1::text[],lower(c.canonical_name)) AS priority
         FROM rmm_software_catalogue c
         JOIN rmm_software_vendor_sources s
           ON s.source_key=c.source_metadata->>'latestSource' AND s.enabled=true
         JOIN rmm_software_vendor_releases r
           ON r.provider_package_id=c.external_key
          AND r.source_key=c.source_metadata->>'latestSource'
          AND r.version=c.target_version
        WHERE c.tenant_id IS NULL
          AND c.status='active'
          AND c.qualification_state='deployment_candidate'
          AND lower(c.canonical_name)=ANY($1::text[])
          AND c.source_metadata->>'deploymentMode'='vendor_direct'
          AND c.source_metadata->>'trustState'='direct_ready'
          AND lower(COALESCE(c.installer_type,'')) IN ('msi','exe')
          AND COALESCE(c.target_version,'')<>''
          AND c.target_version !~* '(alpha|beta|rc|preview|eap|nightly|dev|canary)'
          AND s.last_success_at IS NOT NULL
          AND COALESCE(s.last_error,'')=''
          AND r.trust_state='direct_ready'
          AND r.installer_type IN ('msi','exe')
          AND r.installer_url LIKE 'https://%'
          AND r.installer_sha256 ~* '^[a-f0-9]{64}$'
          AND COALESCE(
            NULLIF(c.source_metadata->>'expectedSigner',''),
            NULLIF(r.source_payload->>'expectedSigner',''),
            NULLIF(r.trust_evidence->>'signer','')
          ) IS NOT NULL
          AND lower(COALESCE(c.qualification_evidence->>'sha256Verified','false'))='true'
          AND lower(COALESCE(c.qualification_evidence->>'authenticodeVerified','false'))='true'
          AND c.source_metadata->'vulnerabilityIdentityAudit'->>'state'='covered'
          AND EXISTS (
            SELECT 1
              FROM rmm_software_vulnerability_identities vi
             WHERE vi.catalogue_id=c.id AND vi.enabled=true
          )
          AND NOT EXISTS (
            SELECT 1
              FROM rmm_software_qualification_queue q
             WHERE q.catalogue_id=c.id AND q.test_type='clean_install'
          )
        ORDER BY priority DESC,lower(c.canonical_name)
        LIMIT $2
     )
     INSERT INTO rmm_software_qualification_queue
       (catalogue_id,test_type,state,priority,attempt_count,last_error,evidence,created_at,updated_at)
     SELECT catalogue_id,'clean_install','queued',priority,0,'',
            jsonb_build_object(
              'automaticCleanInstallQualification',true,
              'qualificationCohort','common_50',
              'vendorDirectRequired',true,
              'wingetQualificationAllowed',false,
              'queuedAt',now()
            ),
            now(),now()
       FROM candidates
     ON CONFLICT (catalogue_id,test_type) DO NOTHING
     RETURNING id,catalogue_id,test_type,state,priority`,
    [COMMON_WINDOWS_SOFTWARE_LOWER, safeLimit],
  )
  return result.rows
}

export async function queueAutomaticCleanInstallQualifications({ limit = 8, maxPending = 12 } = {}) {
  const safeLimit = Math.max(1, Math.min(25, Number(limit) || 8))
  const safeMaxPending = Math.max(1, Math.min(50, Number(maxPending) || 12))
  const pending = await pool.query(
    `SELECT count(*)::int AS count
       FROM rmm_software_qualification_queue
      WHERE test_type='clean_install'
        AND state IN ('queued','running','cleanup_pending','cleanup_running')`,
  )
  const available = Math.max(0, safeMaxPending - Number(pending.rows[0]?.count || 0))
  if (!available) return []

  const result = await pool.query(
    `WITH candidates AS (
       SELECT c.id AS catalogue_id,c.canonical_name,
              CASE
                WHEN lower(c.canonical_name)='google chrome' THEN 350
                WHEN lower(c.canonical_name)='microsoft edge' THEN 345
                WHEN lower(c.canonical_name)='adobe acrobat reader' THEN 340
                WHEN lower(c.canonical_name)='mozilla firefox' THEN 335
                WHEN lower(c.canonical_name)='7-zip' THEN 330
                WHEN lower(c.canonical_name) LIKE 'microsoft teams%' THEN 325
                WHEN lower(c.canonical_name) LIKE 'zoom%' THEN 320
                WHEN lower(c.canonical_name)='vlc media player' THEN 315
                WHEN lower(c.canonical_name)='notepad++' THEN 310
                WHEN lower(COALESCE(c.installer_type,''))='msi' THEN 110
                ELSE 100
              END AS priority
         FROM rmm_software_catalogue c
         JOIN rmm_software_vendor_sources s
           ON s.source_key=c.source_metadata->>'latestSource' AND s.enabled=true
         JOIN rmm_software_vendor_releases r
           ON r.provider_package_id=c.external_key
          AND r.source_key=c.source_metadata->>'latestSource'
          AND r.version=c.target_version
        WHERE c.tenant_id IS NULL
          AND c.status='active'
          AND c.qualification_state='deployment_candidate'
          AND c.source_metadata->>'deploymentMode'='vendor_direct'
          AND c.source_metadata->>'trustState'='direct_ready'
          AND lower(COALESCE(c.installer_type,'')) IN ('msi','exe')
          AND COALESCE(c.target_version,'')<>''
          AND c.target_version !~* '(alpha|beta|rc|preview|eap|nightly|dev|canary)'
          AND s.last_success_at IS NOT NULL
          AND COALESCE(s.last_error,'')=''
          AND r.trust_state='direct_ready'
          AND r.installer_type IN ('msi','exe')
          AND r.installer_url LIKE 'https://%'
          AND r.installer_sha256 ~* '^[a-f0-9]{64}$'
          AND COALESCE(
            NULLIF(c.source_metadata->>'expectedSigner',''),
            NULLIF(r.source_payload->>'expectedSigner',''),
            NULLIF(r.trust_evidence->>'signer','')
          ) IS NOT NULL
          AND lower(COALESCE(c.qualification_evidence->>'sha256Verified','false'))='true'
          AND lower(COALESCE(c.qualification_evidence->>'authenticodeVerified','false'))='true'
          AND c.source_metadata->'vulnerabilityIdentityAudit'->>'state'='covered'
          AND EXISTS (
            SELECT 1
              FROM rmm_software_vulnerability_identities vi
             WHERE vi.catalogue_id=c.id AND vi.enabled=true
          )
          AND NOT EXISTS (
            SELECT 1
              FROM rmm_software_qualification_queue existing
             WHERE existing.catalogue_id=c.id
               AND existing.test_type='clean_install'
               AND NOT (
                 existing.state='review_required'
                 AND existing.last_error IN (
                   'qualification_artifact_gate_failed',
                   'qualification_source_health_not_ready'
                 )
               )
          )
        ORDER BY priority DESC,lower(c.canonical_name)
        LIMIT $1
     )
     INSERT INTO rmm_software_qualification_queue
       (catalogue_id,test_type,state,priority,attempt_count,last_error,evidence,created_at,updated_at)
     SELECT catalogue_id,'clean_install','queued',priority,0,'',
            jsonb_build_object(
              'automaticCleanInstallQualification',true,
              'queuedAt',now()
            ),
            now(),now()
       FROM candidates
     ON CONFLICT (catalogue_id,test_type)
     DO UPDATE SET
       state='queued',
       priority=EXCLUDED.priority,
       attempt_count=0,
       runner_agent_device_id=NULL,
       agent_job_id=NULL,
       deployment_id=NULL,
       cleanup_job_id=NULL,
       last_error='',
       evidence=rmm_software_qualification_queue.evidence || EXCLUDED.evidence
         || jsonb_build_object('recoveredGateAt',now()),
       started_at=NULL,
       completed_at=NULL,
       updated_at=now()
     WHERE rmm_software_qualification_queue.state='review_required'
       AND rmm_software_qualification_queue.last_error IN (
         'qualification_artifact_gate_failed',
         'qualification_source_health_not_ready'
       )
     RETURNING id,catalogue_id,test_type,state,priority`,
    [Math.min(safeLimit, available)],
  )
  return result.rows
}

export async function queueAutomaticUpgradeQualifications({ limit = 12 } = {}) {
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 12))
  const result = await pool.query(
    `WITH candidates AS (
       SELECT c.id AS catalogue_id,c.canonical_name,q.priority
         FROM rmm_software_catalogue c
         JOIN rmm_software_qualification_queue q
           ON q.catalogue_id=c.id
          AND q.test_type='clean_install'
          AND q.state='passed'
        WHERE c.tenant_id IS NULL
          AND c.status='active'
          AND c.qualification_state='deployment_candidate'
          AND c.source_metadata->>'deploymentMode'='vendor_direct'
          AND c.source_metadata->>'trustState'='direct_ready'
          AND EXISTS (
            SELECT 1
              FROM rmm_software_vendor_releases current_release
             WHERE current_release.provider_package_id=c.external_key
               AND current_release.source_key=c.source_metadata->>'latestSource'
               AND current_release.version=c.target_version
               AND current_release.trust_state='direct_ready'
          )
          AND EXISTS (
            SELECT 1
              FROM rmm_software_vendor_releases previous_release
             WHERE previous_release.provider_package_id=c.external_key
               AND previous_release.source_key=c.source_metadata->>'latestSource'
               AND previous_release.version<>c.target_version
               AND previous_release.trust_state='direct_ready'
          )
          AND NOT EXISTS (
            SELECT 1
              FROM rmm_software_qualification_queue existing_upgrade
             WHERE existing_upgrade.catalogue_id=c.id
               AND existing_upgrade.test_type='upgrade'
               AND existing_upgrade.state IN ('queued','running','cleanup_pending','cleanup_running','passed')
          )
        ORDER BY q.priority DESC,lower(c.canonical_name)
        LIMIT $1
     )
     INSERT INTO rmm_software_qualification_queue
       (catalogue_id,test_type,state,priority,attempt_count,last_error,evidence,created_at,updated_at)
     SELECT catalogue_id,'upgrade','queued',priority,0,'',
            jsonb_build_object(
              'automaticUpgradeQualification',true,
              'queuedAt',now()
            ),
            now(),now()
       FROM candidates
     ON CONFLICT (catalogue_id,test_type)
     DO UPDATE SET
       state='queued',
       priority=EXCLUDED.priority,
       attempt_count=0,
       runner_agent_device_id=NULL,
       agent_job_id=NULL,
       deployment_id=NULL,
       cleanup_job_id=NULL,
       last_error='',
       evidence=rmm_software_qualification_queue.evidence || EXCLUDED.evidence,
       started_at=NULL,
       completed_at=NULL,
       updated_at=now()
     WHERE rmm_software_qualification_queue.state='review_required'
       AND rmm_software_qualification_queue.last_error IN (
         'previous_trusted_release_not_available',
         'qualification_current_trusted_release_not_available'
       )
     RETURNING id,catalogue_id,test_type,state,priority`,
    [safeLimit],
  )
  return result.rows
}

export async function promoteAutomaticAdmissionReady({ limit = 12 } = {}) {
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 12))
  const result = await pool.query(
    `WITH ready AS (
       SELECT c.id,c.canonical_name,c.target_version
         FROM rmm_software_catalogue c
         JOIN rmm_software_vendor_sources s
           ON s.source_key=c.source_metadata->>'latestSource' AND s.enabled=true
        WHERE c.tenant_id IS NULL
          AND c.status='active'
          AND c.qualification_state='deployment_candidate'
          AND c.source_metadata->>'deploymentMode'='vendor_direct'
          AND c.source_metadata->>'trustState'='direct_ready'
          AND lower(COALESCE(c.installer_type,'')) IN ('msi','exe')
          AND s.last_success_at IS NOT NULL
          AND COALESCE(s.last_error,'')=''
          AND lower(COALESCE(c.qualification_evidence->>'sha256Verified','false'))='true'
          AND lower(COALESCE(c.qualification_evidence->>'authenticodeVerified','false'))='true'
          AND lower(COALESCE(c.qualification_evidence->>'cleanInstallVerified','false'))='true'
          AND c.qualification_evidence->>'cleanInstallVersion'=c.target_version
          AND lower(COALESCE(c.qualification_evidence->>'uninstallVerified','false'))='true'
          AND c.source_metadata->'vulnerabilityIdentityAudit'->>'state'='covered'
          AND EXISTS (
            SELECT 1
              FROM rmm_software_vulnerability_identities vi
             WHERE vi.catalogue_id=c.id AND vi.enabled=true
          )
          AND EXISTS (
            SELECT 1
              FROM rmm_software_qualification_queue qi
             WHERE qi.catalogue_id=c.id
               AND qi.test_type='clean_install'
               AND qi.state='passed'
          )
          AND EXISTS (
            SELECT 1
              FROM rmm_software_qualification_queue qu
             WHERE qu.catalogue_id=c.id
               AND qu.test_type='upgrade'
               AND qu.state='passed'
          )
          AND EXISTS (
            SELECT 1
              FROM rmm_patch_deployments d
              JOIN rmm_agent_devices a
                ON a.inventory_id=d.inventory_id AND a.disabled_at IS NULL
              JOIN rmm_software_vendor_qualification_runners qr
                ON qr.agent_device_id=a.id AND qr.enabled=true
             WHERE d.catalogue_id=c.id
               AND d.status='succeeded'
               AND d.target_version=c.target_version
               AND lower(COALESCE(d.result->>'verificationPassed',d.result->'verification'->>'meetsTarget','false'))='true'
               AND COALESCE(
                 NULLIF(d.result->>'intent',''),
                 CASE WHEN COALESCE(d.installed_version,'')='' THEN 'install' ELSE 'update' END
               )='update'
          )
        ORDER BY lower(c.canonical_name)
        LIMIT $1
     )
     UPDATE rmm_software_catalogue c
        SET qualification_state='qualified',
            qualification_notes=CASE
              WHEN COALESCE(c.qualification_notes,'')='' THEN 'Automatically admitted after trusted source, artifact, clean-install, uninstall, upgrade and vulnerability-identity qualification.'
              ELSE c.qualification_notes
            END,
            qualification_evidence=c.qualification_evidence || jsonb_build_object(
              'automaticAdmissionVerified',true,
              'automaticAdmissionVersion',c.target_version,
              'automaticAdmissionVerifiedAt',now()
            ),
            updated_at=now()
       FROM ready
      WHERE c.id=ready.id
      RETURNING c.id,c.canonical_name,c.target_version`,
    [safeLimit],
  )
  return result.rows
}

export async function runSoftwareQualificationQueue({ dispatchLimit = 1 } = {}) {
  const runner = await liveQualificationRunner()
  const active = await pool.query(
    `SELECT id,state,test_type FROM rmm_software_qualification_queue
      WHERE state IN ('running','cleanup_pending','cleanup_running')
      ORDER BY updated_at LIMIT 20`,
  )
  const reconciled = []
  for (const row of active.rows) {
    reconciled.push(row.test_type === 'upgrade'
      ? await reconcileUpgradeQueueRow(row, runner)
      : await reconcileQueueRow(row, runner))
  }

  if (!runner) return { runner: null, reconciled, dispatched: [] }

  const stillActive = await pool.query(
    `SELECT count(*)::int AS count
       FROM rmm_software_qualification_queue
      WHERE state IN ('running','cleanup_pending','cleanup_running')`,
  )
  if (Number(stillActive.rows[0]?.count || 0) > 0) {
    return { runner: runner.device_name, reconciled, dispatched: [] }
  }

  const queued = await pool.query(
    `SELECT q.id,q.catalogue_id,q.test_type,q.priority,c.canonical_name,c.target_version
       FROM rmm_software_qualification_queue q
       JOIN rmm_software_catalogue c ON c.id=q.catalogue_id
      WHERE q.state='queued'
        AND c.status='active' AND c.qualification_state='deployment_candidate'
        AND (
          q.test_type='clean_install'
          OR (
            q.test_type='upgrade'
            AND EXISTS (
              SELECT 1 FROM rmm_software_qualification_queue qi
               WHERE qi.catalogue_id=q.catalogue_id
                 AND qi.test_type='clean_install'
                 AND qi.state='passed'
            )
          )
        )
      ORDER BY CASE q.test_type WHEN 'clean_install' THEN 0 ELSE 1 END,
               q.priority DESC,q.created_at
      LIMIT $1`,
    [Math.max(1, Math.min(3, Number(dispatchLimit) || 1))],
  )
  const dispatched = []
  for (const queue of queued.rows) {
    const result = queue.test_type === 'upgrade'
      ? await dispatchUpgradeBaseline(queue, runner)
      : await dispatchCleanInstall(queue, runner)
    dispatched.push({ id: queue.id, applicationName: queue.canonical_name, testType: queue.test_type, ...result })
    if (result.dispatched) break
  }
  return { runner: runner.device_name, reconciled, dispatched }
}

export async function retrySoftwareQualification(catalogueId) {
  const ready = await pool.query(
    `SELECT c.id,c.canonical_name,c.target_version,c.installer_type,
            c.source_metadata->>'latestSource' AS source_key,
            s.last_success_at,s.last_error,
            r.id AS release_id,r.trust_state,r.asset_health_state,r.installer_url,r.installer_sha256,
            COALESCE(NULLIF(c.source_metadata->>'expectedSigner',''),NULLIF(r.source_payload->>'expectedSigner',''),NULLIF(r.trust_evidence->>'signer','')) AS expected_signer
       FROM rmm_software_catalogue c
       JOIN rmm_software_vendor_sources s
         ON s.source_key=c.source_metadata->>'latestSource' AND s.enabled=true
       JOIN rmm_software_vendor_releases r
         ON r.provider_package_id=c.external_key
        AND r.source_key=c.source_metadata->>'latestSource'
        AND r.version=c.target_version
      WHERE c.id=$1 AND c.tenant_id IS NULL AND c.status='active'
      LIMIT 1`,
    [catalogueId],
  )
  const row = ready.rows[0]
  if (!row) return { queued: false, reason: 'catalogue_vendor_release_not_found' }
  if (!row.last_success_at || clean(row.last_error)) return { queued: false, reason: 'source_health_not_ready' }
  if (clean(row.trust_state) !== 'direct_ready'
    || clean(row.asset_health_state) === 'dead'
    || !/^https:\/\//i.test(clean(row.installer_url))
    || !/^[a-f0-9]{64}$/i.test(clean(row.installer_sha256))
    || !clean(row.expected_signer)) {
    return { queued: false, reason: 'artifact_validation_not_ready' }
  }

  const active = await pool.query(
    `SELECT id,test_type,state
       FROM rmm_software_qualification_queue
      WHERE catalogue_id=$1
        AND state IN ('running','cleanup_pending','cleanup_running')
      LIMIT 1`,
    [catalogueId],
  )
  if (active.rowCount) return { queued: false, active: true, state: active.rows[0].state }

  const queue = await withTransaction(async (client) => {
    await client.query(
      `UPDATE rmm_software_catalogue
          SET qualification_state='deployment_candidate',
              qualification_version='',
              qualified_at=NULL,
              qualification_evidence=qualification_evidence
                - 'cleanInstallVerified'
                - 'cleanInstallVersion'
                - 'cleanInstallVerifiedAt'
                - 'uninstallVerified'
                - 'uninstallVerifiedAt'
                - 'upgradeVerified'
                - 'upgradeFromVersion'
                - 'upgradeVersion'
                - 'upgradeVerifiedAt'
                || jsonb_build_object('manualRequalificationRequestedAt',now()),
              updated_at=now()
        WHERE id=$1`,
      [catalogueId],
    )
    await client.query(
      `UPDATE rmm_software_qualification_queue
          SET state='cancelled',last_error='manual_revalidation_reset',
              completed_at=now(),updated_at=now()
        WHERE catalogue_id=$1 AND test_type='upgrade'
          AND state NOT IN ('running','cleanup_pending','cleanup_running')`,
      [catalogueId],
    )
    const result = await client.query(
      `INSERT INTO rmm_software_qualification_queue
        (catalogue_id,test_type,state,priority,attempt_count,last_error,evidence,created_at,updated_at)
       VALUES ($1,'clean_install','queued',
               CASE WHEN lower(COALESCE($2,''))='msi' THEN 120 ELSE 110 END,
               0,'',jsonb_build_object('manualRequalification',true,'queuedAt',now()),now(),now())
       ON CONFLICT (catalogue_id,test_type)
       DO UPDATE SET state='queued',
         priority=EXCLUDED.priority,
         attempt_count=0,
         runner_agent_device_id=NULL,
         agent_job_id=NULL,
         deployment_id=NULL,
         cleanup_job_id=NULL,
         last_error='',
         evidence=rmm_software_qualification_queue.evidence || EXCLUDED.evidence,
         started_at=NULL,
         completed_at=NULL,
         updated_at=now()
       RETURNING id,state,priority`,
      [catalogueId, row.installer_type],
    )
    return result.rows[0]
  })
  return { queued: true, catalogueId, applicationName: row.canonical_name, targetVersion: row.target_version, queue }
}

export async function qualificationQueueSummary(tenantId) {
  const hasRunner = await pool.query(
    `SELECT 1
       FROM rmm_software_vendor_qualification_runners q
       JOIN rmm_agent_devices a ON a.id=q.agent_device_id
      WHERE q.enabled=true AND a.tenant_id=$1
      LIMIT 1`,
    [tenantId],
  )
  if (!hasRunner.rowCount) return []

  const result = await pool.query(
    `SELECT q.id,q.catalogue_id,q.test_type,q.state,q.priority,q.attempt_count,
            q.runner_agent_device_id,q.agent_job_id,q.deployment_id,q.cleanup_job_id,
            q.last_error,q.evidence,q.started_at,q.completed_at,q.created_at,q.updated_at,
            c.canonical_name,c.target_version,c.qualification_state,
            i.name AS runner_device_name
       FROM rmm_software_qualification_queue q
       JOIN rmm_software_catalogue c ON c.id=q.catalogue_id
       LEFT JOIN rmm_agent_devices a ON a.id=q.runner_agent_device_id
       LEFT JOIN rmm_device_inventory i ON i.id=a.inventory_id
      ORDER BY CASE q.state
        WHEN 'review_required' THEN 0
        WHEN 'running' THEN 1
        WHEN 'cleanup_pending' THEN 2
        WHEN 'cleanup_running' THEN 3
        WHEN 'queued' THEN 4
        ELSE 5 END,
        q.priority DESC,q.updated_at DESC`,
  )
  return result.rows
}
