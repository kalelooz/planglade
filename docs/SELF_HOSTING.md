# PlanGlade Self-Hosting

Last updated: 2026-07-01

PlanGlade has an early Docker self-host baseline and remains in early self-hosting status. It is not production-ready or production-hardened. The Docker setup gives maintainers a repeatable build, migration, and startup path; it does not provide HTTPS, a reverse proxy, monitoring, automated backups, or security operations.

The existing local/developer self-host path remains documented below.

## What The Docker Baseline Uses

- One standalone Next.js app container.
- One short-lived migration container that runs `prisma migrate deploy` before the app starts.
- SQLite in a persistent Docker volume.
- NextAuth with a configured GitHub or Google OAuth provider.
- Local file attachment storage in a persistent Docker volume.
- `/api/health` as the container health check.

PostgreSQL is not included. The tracked Prisma schema uses SQLite, so changing database providers would be a separate migration project, not a Docker configuration change.

## Before You Start

You need:

- Docker Engine or Docker Desktop with Docker Compose.
- A GitHub or Google OAuth application for sign-in.
- A terminal and a text editor.

You do **not** need a Firebase project. The Docker default stores attachments on a local Docker volume and uses NextAuth for sign-in.

Do not expose PlanGlade publicly during initial setup. First configure real secrets, verify sign-in and storage, add HTTPS through a reverse proxy, and establish tested backups.

## First Run With Docker Compose

1. Copy the environment example.

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

2. Open `.env` and replace every Docker placeholder. The Docker default quick start needs only:

- `NEXTAUTH_URL`: `http://localhost:3000` for a local check, or your final HTTPS URL.
- `NEXTAUTH_SECRET`: a long random value. Generate one with `openssl rand -base64 32`.
- Either `GITHUB_ID` and `GITHUB_SECRET`, or `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

No Firebase values are required. The Docker Compose file sets `PLANGLADE_STORAGE_PROVIDER=local`, stores attachments in the `planglade_attachments` volume at `/app/storage/local-attachments`, and signs attachment URLs with `NEXTAUTH_SECRET` (or `PLANGLADE_STORAGE_SIGNING_SECRET` if you set it).

Never commit `.env`. Values beginning with `NEXT_PUBLIC_` are visible in the browser; do not put secrets in them.

For GitHub OAuth, use this callback URL for a local check:

```text
http://localhost:3000/api/auth/callback/github
```

3. Validate and build the configuration.

```bash
docker compose config
docker compose build
```

4. Start PlanGlade.

```bash
docker compose up -d
```

Compose first runs the `migrate` service with `prisma migrate deploy`. The app starts only after migrations succeed.

5. Check the containers and health endpoint.

```bash
docker compose ps -a
curl http://localhost:3000/api/health
```

The `migrate` container should show `Exited (0)`, the `app` container should become healthy, and the health response should report `"status":"ok"`.

6. Open `http://localhost:3000` and test sign-in and creating a task before wider use. Attachment storage and APIs are backend-only and feature-gated until a supported end-user attachment UI ships.

## Database And Migrations

Docker stores SQLite at `/app/db/planglade.db` in the `planglade_data` named volume. `docker compose down` keeps that volume. `docker compose down -v` deletes it and is destructive.

Docker uses the checked-in Prisma migration history:

```bash
docker compose run --rm migrate
```

Normal `docker compose up -d` already runs this step. Run it directly only for troubleshooting. Do not use `prisma migrate dev`, `prisma db push`, or `prisma migrate reset` against Docker self-host data.

The existing local development path remains SQLite with `npm run db:push`; it is separate from the Docker migration path.

## Local Attachment Storage (Docker Default)

The Docker default provisions local attachment storage inside the `planglade_attachments` Docker volume, mounted at `/app/storage/local-attachments`. The attachment API enforces workspace scope, short-lived HMAC-signed URLs, and path-traversal protection. This is backend/API-only and feature-gated; no supported end-user attachment UI ships yet.

Back up this volume alongside the SQLite volume. See `docs/BACKUP_RESTORE.md`.

## Stop, Restart, And Update

Stop while keeping data:

```bash
docker compose down
```

Restart:

```bash
docker compose up -d
```

Update safely:

1. Back up the SQLite volume and the local attachment volume.
2. Pull the new code.
3. Review release notes and environment changes.
4. Rebuild and start:

```bash
docker compose build
docker compose up -d
docker compose ps -a
curl http://localhost:3000/api/health
```

To roll back, stop the new containers, check out the previous known-good commit, restore a compatible backup if migrations changed the database, rebuild, and start again.

## Backup And Restore

Back up before every upgrade. Docker persists both the SQLite database volume and the local attachment volume by default.

Follow `docs/BACKUP_RESTORE.md`. Test restores on a disposable copy before relying on a backup procedure.

## Troubleshooting

### Docker is unavailable

If Docker reports that it cannot connect to the daemon, start Docker Desktop or the Docker service, then run `docker version` again.

### Port 3000 is already used

Set another host port in `.env`, for example `PLANGLADE_PORT="3001"`, then open `http://localhost:3001`. Keep `NEXTAUTH_URL` and the OAuth callback URL aligned with that port.

### Migration failed

Run:

```bash
docker compose logs migrate
```

Do not reset the volume to hide a migration error. Back up the data and investigate the failed migration.

### App is unhealthy

Run:

```bash
docker compose logs --tail=100 app
curl http://localhost:3000/api/health
```

A `degraded` health response lists configuration errors without returning secret values. Check auth/provider variables and storage settings.

### Sign-in fails

Confirm `NEXTAUTH_URL`, the OAuth callback URL, provider ID/secret, and HTTPS scheme all match. Docker defaults to NextAuth; dev auth is intentionally disabled in production mode.

### Attachment API maintenance

Attachment actions are not part of the supported end-user self-host workflow yet. If maintaining the feature-gated API, confirm the `planglade_attachments` volume is healthy and writable and that `PLANGLADE_STORAGE_SIGNING_SECRET` (or `NEXTAUTH_SECRET`) is stable across restarts. Changing the signing secret invalidates in-flight signed URLs but does not delete files.

## Local Development Without Docker

The existing developer path remains supported:

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:push
npm run dev
```

Use these local-only values:

```env
DATABASE_URL="file:../db/custom.db"
PLANGLADE_AUTH_MODE="dev"
NEXT_PUBLIC_PLANGLADE_AUTH_MODE="dev"
PLANGLADE_STORAGE_PROVIDER="local"
PLANGLADE_LOCAL_STORAGE_DIR="storage/local-attachments"
PLANGLADE_STORAGE_SIGNING_SECRET="replace-with-a-random-local-secret"
```

Open `http://localhost:3000`.

## Public Exposure Checklist

Before public exposure:

- Replace every placeholder and use strong unique secrets.
- Use a real NextAuth OAuth provider; never use dev auth.
- Put an HTTPS reverse proxy in front of the app.
- Restrict firewall access and keep Docker/SQLite volumes off shared or untrusted storage.
- Back up SQLite and local attachment volumes off-machine.
- Test a full restore.
- Add logging, monitoring, rate limiting, update procedures, and an incident plan.

## Known Limitations

- Not production-ready or production-hardened.
- SQLite is suitable for this early baseline, not a substitute for a reviewed multi-user database architecture.
- No PostgreSQL support or migration runbook.
- No bundled HTTPS, reverse proxy, automated backup, restore drill, monitoring, or alerting.
- Docker uses NextAuth plus local file storage by default.
