# Qualification recovery handoff — 22 September 2026

Baseline before this pass: 29 fully qualified applications, 73 passed tests,
37 review-required and 2 cancelled. Agent 0.1.116 on DESKTOP-2JHH2ON.
Git registry/version fix was already deployed in 67504ad.

## Implemented
- Patching API and page expose review failure groups, installer type and suggested action.
- Separate install/removal, upgrade-test and fully qualified application counts.
- Dedicated baseline preparation every five minutes, up to four applications per pass.
- Passed clean-install applications take priority; eligible vendor-direct candidates can prepare ahead.
- Per-source six-hour discovery cooldown; newly passed clean installs get an immediate opportunity.
- GitHub stable release history and WinGet manifest version history supply older vendor installers.
- WinGet history examines up to three prior numeric versions and rejects user-only/ARM installers.
- Previous installers enter asset_candidate, then existing endpoint artifact inspection.
- Qualification still requires trusted artifacts and existing verification gates; catalogue targets stay current.
- No automatic blind retry of reviewed install failures; no new test VMs provisioned.

## Observed after deployment
1Password 8.12.34.34 reached direct_ready and an upgrade test started.
ActivePresenter 9.3.0 and Shotcut 26.6.25 were discovered for inspection.
The bounded search did not find suitable previous 3CX installers.
Both production API and web containers were healthy.

## Validation
API syntax checks, failure classification checks, baseline invalid-identity/prerelease/
equal-newer-version/API-error checks; API and production web builds passed.
Reusable checks: node scripts/check-qualification-recovery.mjs (Node 24, API dependencies).

## Next
Observe the new upgrade tests and cleanup. Continue through review groups.
Git still requires clean-endpoint requalification; VeraCrypt requires endpoint download diagnosis.
Expand to isolated runners separately; this pass retains the single designated runner.
