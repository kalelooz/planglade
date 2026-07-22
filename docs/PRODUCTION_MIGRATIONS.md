# Production Migrations

Last updated: 2026-07-22

## Current Persistent Database Path

The public repository confirms one persistent standalone application database:

- `prisma/schema.prisma` uses SQLite.
- Docker Compose stores it at `/app/db/planglade.db` in `planglade_planglade_data`.
- The `migrate` service runs checked-in migrations with `prisma migrate deploy` before the app starts.
- Local attachments are separate files at `/app/storage/local-attachments` in `planglade_planglade_attachments` and must be backed up with the database.

The Netlify preview/public-site configuration uses ephemeral SQLite at `file:/tmp/planglade.db` and is not a persistent production database. Do not add `prisma migrate deploy` to the Netlify build command unless that architecture changes to a reviewed persistent database.

Never print or paste `DATABASE_URL`, authentication secrets, storage signing secrets, recovery tokens, or `.env` contents into migration logs or tickets.

## Docker Migration Mechanism

Normal startup is the supported operator path:

```bash
docker compose build
docker compose up -d
```

Compose starts the app only after `migrate` exits successfully. `docker compose run --rm migrate` is for troubleshooting, not a second normal migration step.

For a reviewed persistent non-Docker deployment, the equivalent checked-in command is `npm run db:migrate:deploy`. Do not run it against the Netlify preview database or as a second step after the Compose migrator.

Never run these against persistent self-host data:

```bash
npm run db:push
npm run db:migrate
npm run db:reset
prisma migrate reset
```

## Pre-Upgrade Backup

Before any upgrade that can apply migrations, stop writes and create one checked SQLite-plus-attachment bundle. The destination must not exist.

Linux or macOS:

```bash
mkdir -p backups
docker compose stop app
docker compose run --rm --no-deps --user root -v "$PWD/backups:/backups" app npm run backup:create -- /backups/planglade-pre-upgrade-2026-07-17T120000Z
```

Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force backups
docker compose stop app
docker compose run --rm --no-deps --user root -v "${PWD}\backups:/backups" app npm run backup:create -- /backups/planglade-pre-upgrade-2026-07-17T120000Z
```

Copy the entire bundle directory to encrypted off-machine storage. Do not include `.env`. See [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) for bundle validation, restore, and test-restore instructions.

If migration will not follow immediately, restart the unchanged app with `docker compose start app`.

## Preflight

1. Confirm the target is the persistent Docker SQLite volume, not an ephemeral preview filesystem.
2. Confirm the pre-upgrade bundle completed and an older bundle has been test-restored.
3. Review checked-in migration SQL and release notes.
4. Check for documented data preconditions. For the unique attachment storage-key migration, a non-Docker operator checkout can run:

```bash
npm run db:check:attachment-storage-keys
npm run db:migrate:status
```

This preflight does not print `DATABASE_URL` or storage keys. Stop if it fails; do not use a reset as remediation.

Before the local-auth persistence migration, run `npm run db:check:local-auth-emails` against the stopped installation. It rejects normalized-email collisions and values SQLite cannot normalize safely before changing the schema, without printing the affected addresses.

## Apply And Verify

With the app stopped and backup secured:

```bash
docker compose build
docker compose up -d
docker compose ps -a
docker compose logs migrate
curl http://localhost:3000/api/health
```

The health endpoint returns status only. `{"status":"ok"}` confirms basic readiness, not record correctness. Sign in and verify a known workspace, task list, note, settings value, and local attachment upload/download.

## Rollback And Recovery

Application rollback alone may be unsafe after a schema change. The reliable rollback is the previous known-good app version plus its compatible pre-upgrade bundle. There is no supported in-place authentication-schema downgrade.

If verification fails, stop writes and restore from the backup before reopening the previous application version.

1. Stop the new stack without deleting volumes:

```bash
docker compose down
```

2. Check out and build the previous known-good version.
3. Restore the bundle with explicit confirmation:

```bash
docker compose run --rm --no-deps --user root -v "$PWD/backups:/backups:ro" app npm run backup:restore -- /backups/planglade-pre-upgrade-2026-07-17T120000Z --confirm-replace
```

4. Start and verify the previous version:

```bash
docker compose up -d
docker compose ps -a
curl http://localhost:3000/api/health
```

Do not delete volumes or run a destructive reset to make migration errors disappear. If restore reports a rollback artifact, preserve it and investigate before retrying.

Exercise the previous version and restored pre-upgrade bundle only on disposable copies or isolated volumes before relying on this procedure. Never use the live upgraded database for a downgrade drill.
