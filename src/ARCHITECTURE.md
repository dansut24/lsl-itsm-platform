# Frontend architecture

This first refactor intentionally preserves the prototype UI and behaviour while separating responsibilities.

- `App.jsx` — application state, workspace orchestration and top-level analyst shell.
- `data/demoData.jsx` — demo-only seed data and UI configuration. This is the future seam for API-backed data.
- `data/workPlanningData.js` — shared people, team, project and task seed data used by planning features.
- `lib/workspace.js` — pure workspace/tab and record-formatting helpers.
- `services/demoStore.js` — current browser persistence boundary; replace this with API calls later.
- `services/demoAuth.js` — current demo authentication boundary; replace this with real authentication later.
- `features/workspace/WorkspaceViews.jsx` — current feature/view components, extracted from the original monolithic App component.
- `features/projects/ProjectViews.jsx` — project list, creation, delivery workspace and cross-ITSM links.
- `App.css` — retained unchanged during this pass to minimise visual regressions. It can be split by feature after screenshot comparison.

## Next architectural seam

Replace localStorage/demo authentication behind service interfaces before adding production data. The UI should not directly know whether records come from demo data, REST endpoints or another backend.
