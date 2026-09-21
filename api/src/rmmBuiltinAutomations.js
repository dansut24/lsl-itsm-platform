import { createHash } from 'node:crypto'
import { withTransaction } from './db.js'

function sha256(value = '') {
  return createHash('sha256').update(String(value)).digest('hex')
}

const DISK_ANALYSE = String.raw`$ErrorActionPreference = 'SilentlyContinue'
function Get-PathBytes([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return 0 }
  $item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
  if ($item -and -not $item.PSIsContainer) { return [int64]$item.Length }
  $sum = (Get-ChildItem -LiteralPath $Path -File -Recurse -Force -ErrorAction SilentlyContinue |
    Measure-Object -Property Length -Sum).Sum
  if ($null -eq $sum) { return 0 }
  return [int64]$sum
}
function Add-Path([System.Collections.Generic.List[object]]$List,[string]$Name,[string]$Path) {
  $bytes = Get-PathBytes $Path
  $List.Add([pscustomobject]@{ Name=$Name; Path=$Path; Bytes=$bytes; GiB=[math]::Round($bytes/1GB,2) })
}
$drive = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
$items = [System.Collections.Generic.List[object]]::new()
Add-Path $items 'Windows Temp' 'C:\Windows\Temp'
Add-Path $items 'Windows Update Downloads' 'C:\Windows\SoftwareDistribution\Download'
Add-Path $items 'Windows Error Reports' 'C:\ProgramData\Microsoft\Windows\WER'
Add-Path $items 'Windows Minidumps' 'C:\Windows\Minidump'
Add-Path $items 'Windows Memory Dump' 'C:\Windows\MEMORY.DMP'
Add-Path $items 'Delivery Optimization Cache' 'C:\Windows\ServiceProfiles\NetworkService\AppData\Local\Microsoft\Windows\DeliveryOptimization\Cache'
Get-ChildItem 'C:\Users' -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
  $profile = $_.FullName
  Add-Path $items ($_.Name + ' Temp') (Join-Path $profile 'AppData\Local\Temp')
  Add-Path $items ($_.Name + ' Chrome Cache') (Join-Path $profile 'AppData\Local\Google\Chrome\User Data\Default\Cache')
  Add-Path $items ($_.Name + ' Edge Cache') (Join-Path $profile 'AppData\Local\Microsoft\Edge\User Data\Default\Cache')
  $firefoxProfiles = Join-Path $profile 'AppData\Local\Mozilla\Firefox\Profiles'
  Get-ChildItem $firefoxProfiles -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
    Add-Path $items ($_.Name + ' Firefox Cache') (Join-Path $_.FullName 'cache2')
  }
}
$result = [pscustomobject]@{
  ComputerName=$env:COMPUTERNAME
  Drive='C:'
  TotalGiB=[math]::Round([int64]$drive.Size/1GB,2)
  FreeGiB=[math]::Round([int64]$drive.FreeSpace/1GB,2)
  FreePercent=[math]::Round(([double]$drive.FreeSpace/[double]$drive.Size)*100,2)
  CleanupCandidatesGiB=[math]::Round((($items | Measure-Object Bytes -Sum).Sum)/1GB,2)
  Candidates=$items | Sort-Object Bytes -Descending
}
$result | ConvertTo-Json -Depth 5 -Compress
`

const SAFE_DISK_CLEANUP = String.raw`$ErrorActionPreference = 'SilentlyContinue'
$before = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
$beforeFree = [int64]$before.FreeSpace
$cutoff = (Get-Date).AddDays(-2)
$weekCutoff = (Get-Date).AddDays(-7)
$results = [System.Collections.Generic.List[object]]::new()
function Remove-StaleFiles([string]$Name,[string]$Path,[datetime]$OlderThan) {
  if (-not (Test-Path -LiteralPath $Path)) { return }
  $beforeBytes = (Get-ChildItem -LiteralPath $Path -File -Recurse -Force -ErrorAction SilentlyContinue |
    Measure-Object Length -Sum).Sum
  if ($null -eq $beforeBytes) { $beforeBytes = 0 }
  Get-ChildItem -LiteralPath $Path -File -Recurse -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt $OlderThan } |
    Remove-Item -Force -ErrorAction SilentlyContinue
  Get-ChildItem -LiteralPath $Path -Directory -Recurse -Force -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Where-Object { -not (Get-ChildItem -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue) } |
    Remove-Item -Force -ErrorAction SilentlyContinue
  $afterBytes = (Get-ChildItem -LiteralPath $Path -File -Recurse -Force -ErrorAction SilentlyContinue |
    Measure-Object Length -Sum).Sum
  if ($null -eq $afterBytes) { $afterBytes = 0 }
  $results.Add([pscustomobject]@{
    Name=$Name; Path=$Path; FreedBytes=[math]::Max(0,[int64]$beforeBytes-[int64]$afterBytes)
  })
}
Remove-StaleFiles 'Windows Temp' 'C:\Windows\Temp' $cutoff
Remove-StaleFiles 'System Profile Temp' 'C:\Windows\System32\config\systemprofile\AppData\Local\Temp' $cutoff
Remove-StaleFiles 'Windows Error Reports' 'C:\ProgramData\Microsoft\Windows\WER\ReportArchive' $cutoff
Remove-StaleFiles 'Windows Error Queue' 'C:\ProgramData\Microsoft\Windows\WER\ReportQueue' $cutoff
Remove-StaleFiles 'Windows Minidumps' 'C:\Windows\Minidump' $cutoff
Remove-StaleFiles 'Windows Update Downloads' 'C:\Windows\SoftwareDistribution\Download' $weekCutoff
if (Test-Path 'C:\Windows\MEMORY.DMP') {
  $dump = Get-Item 'C:\Windows\MEMORY.DMP' -Force -ErrorAction SilentlyContinue
  if ($dump -and $dump.LastWriteTime -lt (Get-Date).AddDays(-7)) {
    $dumpBytes = [int64]$dump.Length
    Remove-Item -LiteralPath $dump.FullName -Force -ErrorAction SilentlyContinue
    if (-not (Test-Path -LiteralPath $dump.FullName)) {
      $results.Add([pscustomobject]@{Name='Windows Memory Dump';Path=$dump.FullName;FreedBytes=$dumpBytes})
    }
  }
}
Get-ChildItem 'C:\Users' -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
  $profile = $_.FullName
  Remove-StaleFiles ($_.Name + ' Temp') (Join-Path $profile 'AppData\Local\Temp') $cutoff
  Remove-StaleFiles ($_.Name + ' Chrome Cache') (Join-Path $profile 'AppData\Local\Google\Chrome\User Data\Default\Cache') $cutoff
  Remove-StaleFiles ($_.Name + ' Chrome Code Cache') (Join-Path $profile 'AppData\Local\Google\Chrome\User Data\Default\Code Cache') $cutoff
  Remove-StaleFiles ($_.Name + ' Edge Cache') (Join-Path $profile 'AppData\Local\Microsoft\Edge\User Data\Default\Cache') $cutoff
  Remove-StaleFiles ($_.Name + ' Edge Code Cache') (Join-Path $profile 'AppData\Local\Microsoft\Edge\User Data\Default\Code Cache') $cutoff
  $firefoxProfiles = Join-Path $profile 'AppData\Local\Mozilla\Firefox\Profiles'
  Get-ChildItem $firefoxProfiles -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-StaleFiles ($_.Name + ' Firefox Cache') (Join-Path $_.FullName 'cache2') $cutoff
  }
}
if (Get-Command Delete-DeliveryOptimizationCache -ErrorAction SilentlyContinue) {
  $doPath = 'C:\Windows\ServiceProfiles\NetworkService\AppData\Local\Microsoft\Windows\DeliveryOptimization\Cache'
  $doBefore = 0
  if (Test-Path $doPath) {
    $doBefore = (Get-ChildItem $doPath -File -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    if ($null -eq $doBefore) { $doBefore = 0 }
  }
  Delete-DeliveryOptimizationCache -Force -ErrorAction SilentlyContinue
  $doAfter = 0
  if (Test-Path $doPath) {
    $doAfter = (Get-ChildItem $doPath -File -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    if ($null -eq $doAfter) { $doAfter = 0 }
  }
  $results.Add([pscustomobject]@{Name='Delivery Optimization Cache';Path=$doPath;FreedBytes=[math]::Max(0,[int64]$doBefore-[int64]$doAfter)})
}
$after = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
$afterFree = [int64]$after.FreeSpace
[pscustomobject]@{
  ComputerName=$env:COMPUTERNAME
  BeforeFreeGiB=[math]::Round($beforeFree/1GB,2)
  AfterFreeGiB=[math]::Round($afterFree/1GB,2)
  ReclaimedGiB=[math]::Round(($afterFree-$beforeFree)/1GB,2)
  FreePercent=[math]::Round(([double]$afterFree/[double]$after.Size)*100,2)
  Categories=$results | Where-Object FreedBytes -gt 0 | Sort-Object FreedBytes -Descending
} | ConvertTo-Json -Depth 5 -Compress
`

const COMPONENT_CLEANUP = String.raw`$ErrorActionPreference = 'Stop'
$before = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
$beforeFree = [int64]$before.FreeSpace
$analysis = & dism.exe /Online /Cleanup-Image /AnalyzeComponentStore 2>&1
$cleanup = & dism.exe /Online /Cleanup-Image /StartComponentCleanup /NoRestart 2>&1
$exitCode = $LASTEXITCODE
$after = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
$afterFree = [int64]$after.FreeSpace
[pscustomobject]@{
  ComputerName=$env:COMPUTERNAME
  ExitCode=$exitCode
  BeforeFreeGiB=[math]::Round($beforeFree/1GB,2)
  AfterFreeGiB=[math]::Round($afterFree/1GB,2)
  ReclaimedGiB=[math]::Round(($afterFree-$beforeFree)/1GB,2)
  Analysis=($analysis -join "\n")
  Cleanup=($cleanup -join "\n")
} | ConvertTo-Json -Depth 4 -Compress
if ($exitCode -ne 0) { exit $exitCode }
`
export const BUILTIN_AUTOMATIONS = [
  {
    key: 'disk-space-analyse',
    name: 'Disk Space - Analyse',
    description: 'Read-only disk pressure analysis for known Windows temporary, cache and crash-report locations. Deletes nothing.',
    category: 'Maintenance',
    timeoutSeconds: 600,
    scriptText: DISK_ANALYSE,
  },
  {
    key: 'disk-cleanup-safe',
    name: 'Disk Cleanup - Safe',
    description: 'Removes stale temporary files, crash reports and browser/Delivery Optimization caches. Does not touch Documents, Downloads, Recycle Bin or installed applications.',
    category: 'Maintenance',
    timeoutSeconds: 900,
    scriptText: SAFE_DISK_CLEANUP,
  },
  {
    key: 'windows-component-cleanup',
    name: 'Windows Component Cleanup',
    description: 'Runs DISM StartComponentCleanup without ResetBase. Removes superseded component-store payload while preserving update uninstall capability.',
    category: 'Maintenance',
    timeoutSeconds: 3600,
    scriptText: COMPONENT_CLEANUP,
  },
]

export async function ensureBuiltinAutomations(tenantId) {
  if (!tenantId) return { created: 0, existing: 0 }
  return withTransaction(async (client) => {
    let created = 0
    let existing = 0
    for (const item of BUILTIN_AUTOMATIONS) {
      const found = await client.query(
        "SELECT id FROM rmm_automations WHERE tenant_id=$1 AND lower(name)=lower($2) AND status<>'archived' LIMIT 1",
        [tenantId, item.name],
      )
      if (found.rowCount) {
        existing += 1
        continue
      }
      const automation = await client.query(
        `INSERT INTO rmm_automations
          (tenant_id,name,description,category,platform,language,status)
         VALUES ($1,$2,$3,$4,'windows','powershell','draft')
         RETURNING id`,
        [tenantId, item.name, item.description, item.category],
      )
      const automationId = automation.rows[0].id
      const version = await client.query(
        `INSERT INTO rmm_automation_versions
          (tenant_id,automation_id,version_number,state,script_text,content_sha256,timeout_seconds,run_as,release_notes,published_at)
         VALUES ($1,$2,1,'published',$3,$4,$5,'system',$6,now())
         RETURNING id`,
        [
          tenantId,
          automationId,
          item.scriptText,
          sha256(item.scriptText),
          item.timeoutSeconds,
          'Built-in Hi5Central maintenance automation. Initial published version.',
        ],
      )
      await client.query(
        `UPDATE rmm_automations
            SET status='published',published_version_id=$2,updated_at=now()
          WHERE id=$1`,
        [automationId, version.rows[0].id],
      )
      created += 1
    }
    return { created, existing }
  })
}
