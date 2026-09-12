# Record Workspace Lab

This branch contains an isolated prototype of the proposed analyst record workspace. It does not replace the current record detail implementation.

Use these routes on a deployment of this branch:

- `/record-lab/incidents/<INC-reference>`
- `/record-lab/requests/<REQ-reference>`
- `/record-lab/problems/<PRB-reference>`
- `/record-lab/changes/<CHG-reference>`

The prototype mounts only when the URL matches `/record-lab/...`. Existing `/incidents/...`, `/requests/...`, `/problems/...`, and `/changes/...` routes continue to use the existing production record experience.

The prototype intentionally uses the live record APIs so analysts can evaluate notes, customer updates, assignment, resolution/completion and SLA presentation with real record data. The UI itself remains isolated to this branch until explicitly approved for production.
