import fs from 'node:fs'

let failures = 0
function expect(condition, message) {
  if (!condition) {
    console.error('FAIL:', message)
    failures += 1
  }
}

const patching = fs.readFileSync('api/src/rmmPatching.js', 'utf8')
const vendorIntel = fs.readFileSync('api/src/rmmSoftwareVendorIntel.js', 'utf8')
const enrichment = fs.readFileSync('api/src/rmmVendorReleaseEnrichment.js', 'utf8')

expect(enrichment.includes('rankWindowsInstallerAssets') && enrichment.includes('installer_continuity_'), 'Vendor asset ranking must support installer-type continuity.')
expect(vendorIntel.includes('githubInstallerContinuityCandidates') && vendorIntel.includes('installers: installerContinuityCandidates'), 'GitHub vendor releases must retain signed/checksummed MSI/EXE continuity alternatives.')
expect(vendorIntel.includes("compareVersionValues(clean(z?.ProductVersion), clean(a?.ProductVersion))"), 'Microsoft Edge Stable selection must prefer the highest stable version, not merely the newest publication timestamp.')
expect(patching.includes('inventoryInstallerTechnology') && patching.includes('installedInstallerTechnology'), 'Patch planning must infer the installed installer technology from inventory.')
expect(patching.includes('continuityInstallerForVendor') && patching.includes('installerContinuitySelected'), 'Patch planning must select a same-technology vendor asset when available.')
expect(patching.includes('targetVersionInstalledForCatalogue') && patching.includes("'older_version_present'"), 'A target-version sibling must suppress repeat patching of an older residual registration.')
expect(patching.includes('Installer technology migration required') && patching.includes('installerTechnologyMigrationRequired: true'), 'Unqualified EXE/MSI technology changes must be blocked explicitly.')
expect(patching.includes("fallbackProvider: vendorDirect && fallbackPackageId && !continuitySensitiveUpdate ? 'winget' : ''"), 'Continuity-sensitive vendor updates must not fall back to an uncontrolled WinGet technology change.')

if (failures) process.exit(1)
console.log('Installer continuity contract check passed.')
