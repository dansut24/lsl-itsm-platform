import assert from 'node:assert/strict'
import { qualificationFailureClass as classify, qualificationFailureGroups as group } from '../api/src/rmmQualificationFailureGroups.js'
assert.equal(classify({ last_error: 'target_version_not_verified' }), 'identity_version')
assert.equal(classify({ last_error: 'PatchHost did not return a result.' }), 'patchhost_result')
assert.equal(classify({ last_error: 'failed', cleanup_job_id: 'job' }), 'uninstall_cleanup')
assert.equal(classify({ last_error: 'qualification_scope_mismatch' }), 'install_scope')
assert.equal(classify({ last_error: 'vendor_download_failed' }), 'download')
const grouped = group([
  { state: 'passed', last_error: 'installer_failed' },
  { state: 'review_required', last_error: 'installer_failed', id: 'one' },
  { state: 'review_required', last_error: 'installer_timeout', id: 'two' },
])
assert.equal(grouped.length, 1)
assert.equal(grouped[0].count, 2)
process.env.DATABASE_URL ||= 'postgresql://unused:unused@127.0.0.1/unused'
const { resolvePreviousWingetVendorInstaller: resolve } = await import('../api/src/rmmWingetFallback.js')
const { pool } = await import('../api/src/db.js')
const { jetbrainsVendorBuild } = await import('../api/src/rmmSoftwareVendorIntel.js')
const { verificationVersionForRelease } = await import('../api/src/rmmSoftwareVersioning.js')
const originalFetch = globalThis.fetch
try {
  await assert.rejects(() => resolve('../bad', '2.0'), /invalid_winget/)
  globalThis.fetch = async () => ({ ok: true, json: async () => [
    { type: 'dir', name: '2.0' }, { type: 'dir', name: '3.0' },
    { type: 'dir', name: '1.0-beta' }, { type: 'file', name: '1.0' },
  ] })
  assert.equal(await resolve('Vendor.Package', '2.0'), null)
  globalThis.fetch = async () => ({ ok: false, status: 403 })
  await assert.rejects(() => resolve('Vendor.Package', '2.0'), /history HTTP 403/)
} finally {
  globalThis.fetch = originalFetch
  await pool.end()
}
const jetbrainsUrl='https://download.jetbrains.com/webstorm/WebStorm-263.5153.41.exe'
assert.equal(jetbrainsVendorBuild('jetbrains_webstorm','2026.3',jetbrainsUrl),'263.5153.41')
assert.equal(jetbrainsVendorBuild('jetbrains_webstorm','2026.2',jetbrainsUrl),'')
assert.equal(jetbrainsVendorBuild('jetbrains_clion','2026.3',jetbrainsUrl),'')
assert.equal(jetbrainsVendorBuild('jetbrains_webstorm','2026.3','https://evil.test/WebStorm-263.5153.41.exe'),'')
assert.equal(jetbrainsVendorBuild('jetbrains_webstorm','2026.3','https://download.jetbrains.com/webstorm/WebStorm-264.5153.41.exe'),'')
assert.equal(verificationVersionForRelease('2026.3',{versionTransform:'jetbrains_vendor_build',releaseVersion:'2026.3',vendorBuild:'263.5153.41'}),'263.5153.41')
assert.equal(verificationVersionForRelease('2026.2',{versionTransform:'jetbrains_vendor_build',releaseVersion:'2026.3',vendorBuild:'263.5153.41'}),'2026.2')
console.log('Qualification grouping, baseline and exact JetBrains build checks passed')
