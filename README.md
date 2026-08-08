# PlanGlade

PlanGlade is a calm, self-hostable workspace for tasks, projects, notes, calendar planning, and the connections between them.

This repository is the complete core application:

- `frontend/` contains the production React interface.
- `backend/` contains authentication, workspace APIs, SQLite persistence, migrations, and local attachment storage.
- `compose.yml` serves both behind one origin on port 8080.

## Available today

- Home, Inbox, Tasks, Board, Projects, Notes, Calendar, Connections, and Settings.
- Shared task data across list, board, timeline, and calendar views.
- NextAuth sign-in, workspace isolation, local SQLite storage, and local attachments.
- JSON export and guarded import.
- Docker-based migration, health checks, and persistent volumes.

## Run with Docker

Copy the environment template and replace every placeholder before exposing the app:

```bash
cp .env.example .env
docker compose -f compose.yml config
docker compose -f compose.yml build
docker compose -f compose.yml up -d
```

Open `http://localhost:8080`. Health endpoints are available at `/healthz` and `/api/health`.

For an internet-facing installation, use the final HTTPS origin for `PLANGLADE_PUBLIC_URL`, configure the matching Google callback at `/api/auth/callback/google`, terminate TLS in front of the app, and back up both Docker volumes.

## Local development

```bash
npm run install:all
cp backend/.env.example backend/.env
npm run dev --prefix frontend
```

The frontend runs at `http://127.0.0.1:5173`; the backend runs internally on port 3000.

## Verification

```bash
npm run check:public
npm run lint
npm run typecheck
npm test
npm run build
```

Operational documentation is under `backend/docs/`, including self-hosting, production migrations, backup/restore, task ordering, and implemented presentation behavior.

## License and security

PlanGlade is licensed under the GNU Affero General Public License v3.0. Security issues should be reported privately as described in [SECURITY.md](./SECURITY.md).
