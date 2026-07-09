# Production Migrations

Last updated: 2026-07-09

This repo currently has one production-facing migration risk:

```text
prisma/migrations/20260709000000_unique_attachment_storage_key/migration.sql
```

It creates a unique index on `Attachment.storageKey`.

## Current Database Architecture

Evidence in this repo:

- `prisma/schema.prisma` uses SQLite only.
- `docker-compose.yml` stores SQLite at `/app/db/planglade.db` in a persistent Docker volume.
- `docs/SELF_HOSTING.md` documents a one-shot Docker migration container that runs `prisma migrate deploy` before the app starts.
- `netlify.toml` only runs `npx prisma generate && npm run build`.
- `docs/NETLIFY_PREVIEW.md` uses `DATABASE_URL="file:/tmp/planglade.db"` for Netlify preview/public-site checks.
- `middleware.ts` redirects `/app` to `/` in production when NextAuth has no configured provider, leaving the Netlify site as public landing plus read-only demo.

Conclusion: the repo-confirmed persistent app database is Docker SQLite. The Netlify configuration is for the public website/read-only demo path and must not be treated as a persistent production database. A Netlify `file:/tmp/...` SQLite database is ephemeral.

Do not add `prisma migrate deploy` to the Netlify build command unless Netlify is changed to use a real persistent database and authenticated app traffic.

## Production Status For This Migration

As of this runbook, production migration state is:

```text
Not confirmed against a persistent production database.
```

Reason: the repo does not expose the real Netlify dashboard environment. If Netlify still uses `file:/tmp/planglade.db`, there is no persistent production database to migrate there.

Before running anything against production, confirm only the provider and persistence model. Do not print or paste the secret value of `DATABASE_URL`.

Record one of these outcomes:

- Netlify uses `file:/tmp/...`: no persistent production DB; do not run migrations in Netlify.
- Docker self-host uses `file:/app/db/planglade.db`: persistent SQLite; Docker migration service is the migration mechanism.
- Another hosted SQL database exists: document the provider, backup status, and operator command before use.

## Safe Migration Mechanism

Selected mechanism for now: documented operator-run migration against the persistent database, with Docker Compose already automated for Docker self-host.

For Docker self-host, normal startup already runs:

```bash
docker compose up -d
```

The `migrate` service must exit with code 0 before the app starts.

For any non-Docker persistent database, run migrations from an operator machine or protected deployment job that has access to that database. Do not run them from the Netlify build filesystem.

## Preflight

1. Confirm the target database is persistent.
2. Confirm a backup or snapshot exists and a restore has been tested enough for the risk.
3. Generate Prisma client:

```bash
npm run db:generate
```

4. Check duplicate attachment storage keys:

```bash
npm run db:check:attachment-storage-keys
```

This command does not print `DATABASE_URL` or storage keys.

5. Check migration state:

```bash
npm run db:migrate:status
```

If `20260709000000_unique_attachment_storage_key` is pending and duplicate storage keys exist, stop and clean the data first.

## Apply

Run only against the confirmed persistent database:

```bash
npm run db:migrate:deploy
```

Never use these against production or self-host data:

```bash
npm run db:push
npm run db:migrate
npm run db:reset
prisma migrate reset
```

## Verify

After migration:

```bash
npm run db:migrate:status
curl https://<deployment-host>/api/health
```

Then sign in and check a known workspace, task list, notes page, and attachment flow if attachments are enabled.

For Docker self-host:

```bash
docker compose ps -a
docker compose logs migrate
curl http://localhost:3000/api/health
```

## Rollback And Recovery

The safe rollback for a failed schema migration is restore from the backup taken before the migration, then redeploy the previous known-good app version.

Do not attempt a destructive reset. Do not delete the SQLite volume to make migration errors disappear.

If the unique index migration fails because duplicates exist:

1. Stop the app or prevent writes.
2. Restore backup if the database is partially changed.
3. Identify and resolve duplicate `Attachment.storageKey` rows.
4. Rerun the duplicate check.
5. Rerun `npm run db:migrate:deploy`.
