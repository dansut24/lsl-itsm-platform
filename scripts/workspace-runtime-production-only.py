from pathlib import Path

path = Path('src/runtime/WorkspaceRuntime.jsx')
text = path.read_text()

text = text.replace("import { RmmPlatformApp } from '../features/rmm/RmmPlatformApp.jsx'\n", '')
text = text.replace('  LoginScreen,\n', '')

start_marker = "  const expectedSurfaceRole = isPortalSurface ? 'requester' : isRmmSurface ? 'rmm' : 'analyst'\n"
end_marker = "  return (\n    <div\n      className={`app-shell sidebar-${sidebarMode} density-${density}`}"
start = text.find(start_marker)
end = text.find(end_marker, start if start >= 0 else 0)
if start < 0 or end < 0:
    raise SystemExit('Could not locate legacy surface rendering block in WorkspaceRuntime')

replacement = "  if (!session || session.role !== 'analyst') return null\n\n"
text = text[:start] + replacement + text[end:]

for forbidden in ['PortalLoginScreen', 'RmmLoginScreen', 'SelfServicePortalApp', '<RmmPlatformApp', '<LoginScreen']:
    if forbidden in text:
        raise SystemExit(f'Legacy workspace surface reference still present: {forbidden}')

path.write_text(text)

checker = Path('scripts/check-production-runtime-boundary.mjs')
check_text = checker.read_text()
anchor = "for (const required of [\n"
extra = """const workspaceRuntime = fs.readFileSync(path.join(root, 'src/runtime/WorkspaceRuntime.jsx'), 'utf8')
for (const token of ['PortalLoginScreen', 'RmmLoginScreen', 'SelfServicePortalApp', '<RmmPlatformApp', '<LoginScreen']) {
  if (workspaceRuntime.includes(token)) failures.push(`WorkspaceRuntime contains legacy surface reference: ${token}`)
}

"""
if extra not in check_text:
    if anchor not in check_text:
        raise SystemExit('Could not extend production runtime boundary checker')
    check_text = check_text.replace(anchor, extra + anchor, 1)
    checker.write_text(check_text)

print('WorkspaceRuntime is production-workspace-only.')
