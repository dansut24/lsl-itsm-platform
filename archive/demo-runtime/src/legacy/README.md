# Legacy preview code

This directory marks the boundary for prototype/demo-only behaviour that must never become active on a canonical Hi5Central production tenant.

The current workspace shell still reuses some earlier UI components and local-cache helpers while those areas are being replaced incrementally. For that reason, moving every historical component at once would risk breaking production features that still depend on the shared shell.

Production is therefore fenced first:

- Canonical tenant workspaces mount `ProductionLegacyBoundary`.
- Legacy local demo-session keys are removed on production workspace load.
- Production sign-out is intercepted and sent directly to the server-backed logout flow, so the baked-in demo login cannot flash between states.
- Production Settings routes hide the older Settings surface while the PostgreSQL-backed Settings workspace is mounted.
- A one-shot Settings recovery reload is used if the production Settings shell fails to attach during navigation.

As individual screens are replaced by production-native equivalents, their obsolete demo code should be moved under this directory or deleted. Preview-only authentication and seeded-data helpers are not production sources of truth.
