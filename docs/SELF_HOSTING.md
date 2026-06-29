# PlanGlade Self-Hosting

Last updated: 2026-06-28

PlanGlade is in early self-hosting status.

This guide is accurate for a local/developer self-host path. It does not make a production readiness claim, and you should review hardening needs before exposing PlanGlade to the public internet.

## Current Maturity Status

Supported today:

- Local development with Node.js, npm, Prisma, and SQLite.
- Local file attachment storage.
- Health check diagnostics at `/api/health`.
- Workspace JSON export/import from Settings for data portability.

Present but not a final generic self-host path:

- Firebase App Hosting notes exist in `docs/DEPLOYMENT_FIREBASE_APP_HOSTING.md`.
- `apphosting.yaml` still contains project-specific values and should be cleaned before public release.
- Firebase and NextAuth auth modes exist, but production deployment guidance needs review for your environment.

Not currently supported:

- Docker image or Docker Compose setup.
- Generic VPS guide.
- PostgreSQL or managed database runbook. The tracked Prisma datasource is SQLite.
- Automated backups, monitoring, TLS, reverse proxy, or public internet hardening.

## Requirements

- Node.js 20.9 or newer.
- npm 10 or newer.
- A local `.env` file copied from `.env.example`.
- Enough comfort with a terminal to run npm and Prisma commands.

The Node requirement comes from the current Next.js 16 app.

## Local / Developer Self-Host Path

Install dependencies:

```bash
npm install
```

Copy the environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

For local development, use dev auth and local storage:

```env
DATABASE_URL="file:../db/custom.db"
FLOWBOARD_AUTH_MODE="dev"
NEXT_PUBLIC_FLOWBOARD_AUTH_MODE="dev"
FLOWBOARD_STORAGE_PROVIDER="local"
FLOWBOARD_LOCAL_STORAGE_DIR="storage/local-attachments"
FLOWBOARD_STORAGE_SIGNING_SECRET="replace-with-a-random-local-secret"
```

Generate Prisma client and create/update the local SQLite database:

```bash
npm run db:generate
npm run db:push
```

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

Verify the API health endpoint:

```bash
curl http://localhost:3000/api/health
```

Expected status is `ok` when auth and storage config are valid. A `degraded` response means the endpoint is reachable but one or more config checks failed.

## Docker Compose

Docker is not finalized in this repo.

There is currently no committed `Dockerfile` or `docker-compose.yml`, so do not follow any Docker instructions from older planning notes. Add Docker support through a separate ticket that includes a persistent database volume, attachment storage decision, environment mapping, and a tested startup path.

## Environment Variables

Start from `.env.example`.

Required for the local/developer path:

- `DATABASE_URL`: SQLite database URL. Example: `file:../db/custom.db`.
- `FLOWBOARD_AUTH_MODE`: use `dev` locally. Valid modes are `dev`, `firebase`, and `nextauth`.
- `NEXT_PUBLIC_FLOWBOARD_AUTH_MODE`: browser-visible auth mode. Match `FLOWBOARD_AUTH_MODE`.
- `FLOWBOARD_STORAGE_PROVIDER`: use `local` locally. Valid providers are `local` and `firebase`.
- `FLOWBOARD_LOCAL_STORAGE_DIR`: attachment directory for local storage.
- `FLOWBOARD_STORAGE_SIGNING_SECRET`: random secret used for local signed attachment URLs.

Optional local seed labels:

- `FLOWBOARD_WORKSPACE_SLUG`
- `FLOWBOARD_WORKSPACE_NAME`

Firebase auth/storage variables:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` or `FIREBASE_PRIVATE_KEY_BASE64`

NextAuth variables:

- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`, such as `http://localhost:3000` locally or the public app URL for a real deployment.
- Provider credentials such as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` or `GITHUB_ID` / `GITHUB_SECRET`.

Invite email variables:

- `FLOWBOARD_EMAIL_PROVIDER`
- `FLOWBOARD_EMAIL_FROM`
- `RESEND_API_KEY`
- `FLOWBOARD_MAINTENANCE_TOKEN`

Some names still use the legacy `FLOWBOARD_` prefix. They are current config names and should not be renamed casually.

## Database Setup

The tracked Prisma datasource is SQLite.

For local development:

```env
DATABASE_URL="file:../db/custom.db"
```

Use:

```bash
npm run db:generate
npm run db:push
```

For a migration-style local workflow, `npm run db:migrate` is also available. For the current self-host guide, `db:push` is the documented setup path.

`npm run db:reset` is destructive. Use it only with an isolated local database.

Production database guidance is not finalized in this repo. Do not assume PostgreSQL, Neon, or another managed database is ready just because older planning docs mention production options.

## Storage Notes

Local development can use local signed attachment routes:

- `PUT /api/attachments/upload-binary`
- `GET /api/attachments/download-binary`

Set:

```env
FLOWBOARD_STORAGE_PROVIDER="local"
FLOWBOARD_LOCAL_STORAGE_DIR="storage/local-attachments"
FLOWBOARD_STORAGE_SIGNING_SECRET="replace-with-a-random-local-secret"
```

Firebase Storage support exists in the app, but production setup still needs public-safe deployment documentation.

## Where Data Is Stored

With the documented local settings:

- SQLite data is stored at the path in `DATABASE_URL`. With `file:../db/custom.db`, the database file is under `db/custom.db` relative to Prisma's schema location.
- Local attachments are stored under `FLOWBOARD_LOCAL_STORAGE_DIR`.
- Real secrets live only in your local `.env` or deployment secret store.

Do not delete the database file or attachment directory unless you intend to delete local app data.

## Backup Basics

See `docs/BACKUP_RESTORE.md` for the current backup and restore notes.

Current honest status:

- SQLite file copy backups are the only documented database-level backup path.
- Local attachment backups require copying `FLOWBOARD_LOCAL_STORAGE_DIR`.
- Workspace JSON export/import is useful for portability, but it is not a complete production backup system.
- Automated backups are not included.

## Restore Basics

Stop the app before replacing a SQLite database file or attachment directory. Restore both the database and attachment directory from the same backup window when possible.

Workspace JSON import can restore exported workspace data through the app, but it is not equivalent to a full database restore.

## Upgrade Basics

Before upgrading:

1. Stop the app.
2. Back up the SQLite database file.
3. Back up the local attachment directory.
4. Pull or apply the new code.
5. Run `npm install`.
6. Run `npm run db:generate`.
7. Run `npm run db:push`.
8. Start the app and check `/api/health`.

Review release notes or git diffs before upgrading. The project is still moving quickly.

## Production Deployment Status

Production deployment is not finalized as a generic self-host guide.

What exists:

- `next.config.ts` uses standalone output.
- `npm run build` runs auth config validation and creates the Next.js build.
- `npm run start` starts the standalone server after a successful build.
- Firebase App Hosting notes exist in `docs/DEPLOYMENT_FIREBASE_APP_HOSTING.md`.
- `/api/health` reports auth and storage readiness.

What remains before public self-hosting can be called ready:

- Replace project-specific Firebase config with public-safe placeholders.
- Decide and document the production database path.
- Document production auth setup clearly.
- Document storage setup clearly.
- Harden and test backup/restore procedures.
- Add Docker/container support only if implemented and tested.
- Add reverse proxy, TLS, logging, monitoring, and incident guidance.

## Security Notes

- Do not run `FLOWBOARD_AUTH_MODE=dev` in production. The build validation blocks this in production-like environments.
- Do not expose a local SQLite file or local attachment directory to untrusted users or shared disks.
- Use strong random values for `NEXTAUTH_SECRET`, `FLOWBOARD_STORAGE_SIGNING_SECRET`, and maintenance tokens.
- Review auth provider callback URLs before exposing the app publicly.
- Put TLS, proxy headers, logs, and rate limits in front of the app before public internet use.
- Keep real `.env` files out of git.

## Known Limitations

- Not production-ready.
- No Docker setup.
- No final generic deployment guide.
- PlanGlade is licensed under AGPL-3.0; see the root `LICENSE` file.
- Some environment variable names still carry legacy naming.
- The current Firebase deployment notes are not suitable as the primary public self-host guide.
