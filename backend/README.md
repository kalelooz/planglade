# PlanGlade backend

This package is not a second frontend. It contains only PlanGlade's API, authentication, and persistence services. Sign-in and first-run setup are owned by the Vite application in `../frontend`.

This service provides PlanGlade authentication, workspace-scoped APIs, SQLite persistence, migrations, and local attachment storage. The production user interface lives in the sibling `frontend/` directory.

Use the repository-root README for setup and release instructions. Backend-specific operational guidance is available in `docs/`.

## Collaborative write preconditions

`PATCH` and `DELETE` requests for work items, projects, and notes must include the entity's
latest `updatedAt` value as `expectedUpdatedAt`. A missing precondition returns
`428` with the current entity; a stale value returns `409` with the winning
server state.

The work-item list response also includes `laneVersions`. A status change or
board reorder, plus deletion from a workflow lane, must send the current versions for every affected lane in
`expectedLaneVersions`. Clients should reload the affected collection after a
conflict before offering another save.

The package supports Node.js 20.9 or newer and npm 10 or newer. The lockfile was generated with the `npm@11.6.2` version declared in `package.json`.
