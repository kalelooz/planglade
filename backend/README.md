# PlanGlade backend

This package is not a second frontend. It contains PlanGlade's API plus the minimal sign-in and first-run self-host setup screens required by the main Vite application in `../frontend`.

This service provides PlanGlade authentication, workspace-scoped APIs, SQLite persistence, migrations, and local attachment storage. The production user interface lives in the sibling `frontend/` directory.

Use the repository-root README for setup and release instructions. Backend-specific operational guidance is available in `docs/`.
