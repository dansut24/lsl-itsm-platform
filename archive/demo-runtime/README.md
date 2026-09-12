# Archived prototype/demo runtime

This directory contains the historical Hi5Central prototype runtime and its seeded sample data. It is retained only for source history and must never be imported by the active application.

Archived material includes the old baked-in login identities/credentials, sample ITSM records, sample organisation people/teams, Projects/Rota/Calendar data, synthetic Live Chat/notifications, sample Portal catalogue content, fake RMM estate data and the one-off extraction tooling used to establish the production boundary.

**`test2` is not demo data and is not part of this archive.** It is a legitimate production-style tenant used to test the real onboarding, domain, API and PostgreSQL paths. No active runtime logic should special-case `test2` or any other tenant slug.

Active runtime code lives under `src/runtime`, `src/production`, `src/features`, `src/services` and the production-safe `src/data` modules. `npm run check:production-runtime` enforces that the archived prototype cannot leak back into active source.
