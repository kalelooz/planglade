# Production migrations

PlanGlade currently supports SQLite. The bundled Docker release stores the
database in the persistent `planglade_data` volume and runs checked-in Prisma
migrations through the one-shot `migrate` service before the backend starts.

## Upgrade rule

Before every upgrade:

1. Record the current PlanGlade version or commit.
2. Back up both the SQLite and attachment volumes from the same stopped state.
3. Verify that the backup files are non-empty and complete a periodic restore
   drill on a disposable installation.
4. Read the changelog for migrations, environment changes, and rollback notes.

Do not use `prisma db push`, `prisma migrate dev`, `prisma migrate reset`, or
`docker compose down -v` against self-host data.

## Docker migration path

Normal startup is the supported migration mechanism:

```bash
docker compose -f compose.yml build
docker compose -f compose.yml up -d
docker compose -f compose.yml ps -a
docker compose -f compose.yml logs migrate
```

The `migrate` service must exit with code 0. The backend waits for that result
and must not start against a failed or partially migrated database.

Afterward, verify:

```bash
curl http://localhost:8080/api/health
```

Then sign in and inspect known tasks, projects, notes, settings, and attachment
downloads. A healthy endpoint alone does not prove application data is intact.

## Operator diagnostics

For an explicitly configured persistent database outside Compose, run commands
from the repository root with `DATABASE_URL` supplied through a protected
operator environment:

```bash
npm run db:check:attachment-storage-keys --prefix backend
npm run db:migrate:status --prefix backend
npm run db:migrate:deploy --prefix backend
```

Never print or paste `DATABASE_URL` or storage keys into logs or support issues.

## Failure and rollback

If a migration fails, stop application writes and inspect the migration log.
Do not reset or delete the database volume. Restore the pre-upgrade database
and attachment backup together, check out the earlier compatible PlanGlade
version, rebuild, and start it.

Forward-only schema changes may make a new database incompatible with an older
binary. A source rollback without a compatible data restore is not guaranteed.
