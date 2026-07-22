# PlanGlade Self-Hosting

Last updated: 2026-07-22

PlanGlade has an early Docker self-host baseline and remains in early self-hosting status. It is not production-ready or production-hardened. The Docker path provides a repeatable standalone build, SQLite migrations, local credentials, local attachment storage, and checked backup/restore commands. It does not provide HTTPS, a reverse proxy, automated backups, monitoring, or security operations.

The local/developer self-host path remains supported below.

## Verified Public Standalone Architecture

- Node.js 22.5 or newer; the Docker image currently uses Node 22 Alpine.
- One non-root standalone Next.js app container.
- One short-lived migration container running `prisma migrate deploy` before app startup.
- SQLite at `/app/db/planglade.db` in the `planglade_data` volume.
- Local attachments at `/app/storage/local-attachments` in the `planglade_attachments` volume.
- NextAuth with supported local credentials; GitHub or Google OAuth is optional.
- `/api/health` returning only `{"status":"ok"}`, `{"status":"degraded"}`, or `{"status":"error"}`.

The tracked schema is SQLite-only. PostgreSQL is not included. Changing database providers is a separate migration project, not an environment switch.

## Before You Start

You need:

- Docker Engine or Docker Desktop with Docker Compose.
- A terminal and text editor.
- Strong random values for `NEXTAUTH_SECRET` and the one-time `PLANGLADE_SETUP_TOKEN`.

You do **not** need a Firebase project. You also do not need an OAuth application when local credentials are enabled. OAuth can be added later as an optional sign-in method.

Do not expose PlanGlade publicly during setup. Configure real secrets, create and verify the first OWNER, add HTTPS through a reverse proxy, and establish tested off-machine backups first.

## First Run With Docker Compose

1. Copy the environment example.

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

2. Edit `.env` and replace every active placeholder.

The no-OAuth public standalone path requires:

```env
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-long-random-value"
PLANGLADE_LOCAL_AUTH_ENABLED="true"
PLANGLADE_SETUP_TOKEN="replace-with-a-separate-one-time-random-value"
```

Compose sets `PLANGLADE_AUTH_MODE=nextauth`, `NEXT_PUBLIC_PLANGLADE_AUTH_MODE=nextauth`, `PLANGLADE_STORAGE_PROVIDER=local`, the SQLite path, and the local attachment path. No Firebase values are required.

GitHub and Google OAuth are optional. If enabled, add the corresponding provider ID/secret and use a callback such as:

```text
http://localhost:3000/api/auth/callback/github
```

Never commit `.env`. Values beginning with `NEXT_PUBLIC_` are visible in the browser; never put secrets there.

3. Validate and build.

```bash
docker compose config
docker compose build
```

4. Start PlanGlade.

```bash
docker compose up -d
```

Compose runs `prisma migrate deploy`; the app starts only after the migration service exits successfully.

5. Check status.

```bash
docker compose ps -a
curl http://localhost:3000/api/health
```

The migration container should show `Exited (0)` and the app should become healthy. The endpoint deliberately returns status only. It does not expose configuration details, paths, provider names, or secrets.

6. Open `http://localhost:3000/setup`, enter `PLANGLADE_SETUP_TOKEN`, and create the first OWNER, local password, and workspace.

Setup can complete only once. It creates exactly one initial OWNER and workspace, then shows ten permanent recovery codes one time. Each code works once and remains valid until used or replaced. Save them offline before continuing.

7. Remove `PLANGLADE_SETUP_TOKEN` from `.env`, then recreate the app container so the token is no longer present:

```bash
docker compose up -d --force-recreate app
```

8. Sign in, create a task, and upload/download an attachment before wider use.

## Sign-In And Recovery

Local credentials are a supported no-OAuth path when `PLANGLADE_LOCAL_AUTH_ENABLED="true"`. OAuth-created OWNER accounts can enroll a local password later from **Settings > Account > Local sign-in** without creating another user or workspace.

Normal recovery uses one saved permanent recovery code at `/recover`. A successful password reset consumes the supplied code, invalidates existing sessions, rotates all recovery codes, and shows the replacements once.

If the OWNER has no saved code, a host administrator can create a 15-minute one-time link for an existing current OWNER:

```bash
docker compose run --rm --no-deps app npm run auth:create-recovery-link -- owner@example.com
```

The standard Compose runner contains this command and mounts the live SQLite volume. It does not create a new user or workspace. The secret appears only in the URL fragment (`/recover#...`), so browsers do not send it in HTTP request URLs. The one-off container is removed by `--rm`; do not redirect or paste the printed link into shared logs, tickets, or chat.

PlanGlade does not send password-reset email. If the host link expires, create a new one.

## Data, Migrations, And Storage

Docker's exact persistent paths are:

- Database: `/app/db/planglade.db` in `planglade_planglade_data` with the default Compose project name.
- Attachments: `/app/storage/local-attachments` in `planglade_planglade_attachments`.

`docker compose down` keeps both volumes. `docker compose down -v` deletes both and is destructive.

Normal startup runs checked-in migrations. For troubleshooting only:

```bash
docker compose run --rm migrate
```

Never use `prisma migrate dev`, `prisma db push`, `prisma migrate reset`, or `npm run db:reset` against self-host data. Attachment reads and writes remain confined to the configured local directory and use short-lived signed URLs.

## Backup, Restore, And Upgrade

The standard runner includes `npm run backup:create` and `npm run backup:restore`. One versioned directory bundle contains SQLite, attachments, a manifest, and SHA-256 checksums. Follow [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) for the exact Docker and local commands.

Safe Docker upgrade sequence:

1. Read the release notes and `.env.example` changes.
2. Stop the app and create a new checked bundle using the command in `docs/BACKUP_RESTORE.md`.
3. Copy that bundle to encrypted off-machine storage.
4. Pull or check out the intended release.
5. Run:

```bash
docker compose build
docker compose up -d
docker compose ps -a
curl http://localhost:3000/api/health
```

6. Sign in and verify a known workspace, task, note, setting, and attachment.

For an authentication-changing release, also verify that an existing OAuth account keeps the same user and workspace access, an enrolled local password still works, recovery-code state is present, and workspace ownership and membership roles are unchanged. A restored database retains `authVersion`; sessions issued for an older version remain invalid. Rotating `NEXTAUTH_SECRET` deliberately invalidates every existing NextAuth session, so schedule that rotation separately from data verification.

To roll back after a schema-changing upgrade, stop the new stack, check out and rebuild the previous known-good version, restore its compatible pre-upgrade bundle, then start and verify. Do not reverse the authentication migration in place or run a destructive reset to hide a migration failure. Rehearse downgrade/rollback only on disposable copies or isolated Docker volumes.

## Troubleshooting

### Docker is unavailable

Start Docker Desktop or the Docker service, then confirm `docker version` and `docker compose version` work.

### Port 3000 is already used

Set `PLANGLADE_PORT="3001"` and set `NEXTAUTH_URL` to the matching public URL. Keep optional OAuth callback URLs aligned.

### Migration failed

```bash
docker compose logs migrate
```

Keep the volumes and backup intact. Do not reset or delete them.

### App is unhealthy

```bash
docker compose logs --tail=100 app
curl http://localhost:3000/api/health
```

`degraded` is intentionally status-only. Inspect container logs and validate `.env`; the endpoint will not return diagnostic configuration or secrets.

### Local sign-in or setup fails

Confirm `PLANGLADE_LOCAL_AUTH_ENABLED="true"`, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET`. Initial setup also needs the exact `PLANGLADE_SETUP_TOKEN` and an empty setup state. After setup completes, use `/login`; setup cannot create a second OWNER.

### OAuth sign-in fails

If optional OAuth is enabled, confirm its provider ID/secret, `NEXTAUTH_URL`, callback URL, and HTTPS scheme all match.

### Recovery link fails

Host links expire after 15 minutes and work once. Create a new link for the existing OWNER. Do not move the fragment secret into a query string.

### Backup is refused

Keep the app stopped. Use a new absent output directory. Confirm the standard local storage provider and exact data paths are active. Preserve any `.planglade-restore-*` or `.planglade-rollback-*` artifact for investigation.

### Attachment actions fail

Confirm the attachment volume is writable and `PLANGLADE_STORAGE_SIGNING_SECRET` (or `NEXTAUTH_SECRET`) is stable. Rotating the signing secret invalidates in-flight signed URLs but does not delete files.

## Local Development Without Docker

Local development requires Node.js 22.5 or newer and npm:

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:push
npm run dev
```

Use the documented local paths:

```env
DATABASE_URL="file:../db/custom.db"
PLANGLADE_AUTH_MODE="dev"
NEXT_PUBLIC_PLANGLADE_AUTH_MODE="dev"
PLANGLADE_STORAGE_PROVIDER="local"
PLANGLADE_LOCAL_STORAGE_DIR="storage/local-attachments"
PLANGLADE_STORAGE_SIGNING_SECRET="replace-with-a-random-local-secret"
```

Dev auth is for local development only, never public exposure.

## Public Exposure Checklist

- Replace every placeholder with strong unique values and remove the setup token after first use.
- Put an HTTPS reverse proxy in front of the app.
- Restrict firewall access and protect Docker/SQLite volumes from untrusted users.
- Keep encrypted off-machine backups and test a full restore.
- Add logging, monitoring, update procedures, and an incident plan.
- Keep Node, the container base image, PlanGlade, and dependencies patched.

## Known Limitations

- Not production-ready or production-hardened.
- SQLite is the only tracked database provider.
- No bundled HTTPS, reverse proxy, scheduled backup, restore drill, monitoring, or alerting.
- Public standalone defaults to NextAuth, supported local credentials, and local file storage; OAuth is optional.
