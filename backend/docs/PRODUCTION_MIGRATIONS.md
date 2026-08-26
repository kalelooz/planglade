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

The `migrate` service first applies checked-in Prisma migrations, then runs the
application-owned normalized-email migration. The backend waits for both steps
to exit with code 0 and must not start against a failed or partially migrated
database.

The normalized-email step uses the same validation, trimming, and lowercasing
rules as authentication. It checks every user before writing, backfills all
valid legacy rows in one transaction, and verifies that no null
`normalizedEmail` values remain. Re-running it is safe.

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
npm run db:preflight:local-auth-emails --prefix backend
npm run db:migrate:status --prefix backend
npm run db:migrate:deploy --prefix backend
npm run db:check:local-auth-emails --prefix backend
```

Never print or paste `DATABASE_URL` or storage keys into logs or support issues.

## Normalized-email conflicts

The normalized-email preflight reports user IDs for invalid legacy addresses,
normalization collisions, and any inconsistent existing normalized value. It
does not change data. The migration uses the same preflight inside its
transaction, so a reported conflict also leaves every `normalizedEmail`
unchanged and prevents the backend from starting.

If the migration reports a conflict:

1. Keep PlanGlade stopped and preserve the verified pre-upgrade backup.
2. Inspect the reported `User` rows by ID using a trusted SQLite administration
   tool against the stopped database. Do not edit the backup.
3. For an invalid address, replace `User.email` with the verified user's valid,
   unique address. For a collision, establish which account owns each address
   and give each retained user a distinct valid address. Do not guess identity
   ownership and do not set `normalizedEmail` manually.
4. If colliding rows represent one person, PlanGlade does not currently bundle
   an account-merge operation. Restore the backup if necessary and resolve the
   duplicate identity with a reviewed merge procedure before continuing.
5. Re-run the preflight, deploy migration, and verification commands above.

For the bundled image, the same read-only preflight can be run before normal
startup with:

```bash
docker compose -f compose.yml run --rm migrate node scripts/migrate-normalized-auth-emails.mjs --preflight
```

## Failure and rollback

If a migration fails, stop application writes and inspect the migration log.
Do not reset or delete the database volume. A normalized-email validation or
write failure leaves its email backfill transaction unchanged; correct the
reported source data or restore the pre-upgrade database and attachment backup
together, check out the earlier compatible PlanGlade version, rebuild, and
start it.

Forward-only schema changes may make a new database incompatible with an older
binary. A source rollback without a compatible data restore is not guaranteed.
