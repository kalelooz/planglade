# PlanGlade backend

This package is not a second frontend. It contains only PlanGlade's API, authentication, and persistence services. Sign-in and first-run setup are owned by the Vite application in `../frontend`.

This service provides PlanGlade authentication, workspace-scoped APIs, SQLite persistence, migrations, and local attachment storage. The production user interface lives in the sibling `frontend/` directory.

Use the repository-root README for setup and release instructions. Backend-specific operational guidance is available in `docs/`.

The package supports Node.js 20.9 or newer and npm 10 or newer. The lockfile was generated with the `npm@11.6.2` version declared in `package.json`.
