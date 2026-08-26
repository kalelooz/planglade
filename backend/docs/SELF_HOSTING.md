# PlanGlade self-hosting

PlanGlade is an early self-host preview, not a production-hardened managed
service. The bundled deployment is suitable for careful personal or small-team
evaluation when you use unique secrets, HTTPS, and tested backups.

## Architecture

The root `compose.yml` runs:

- `frontend`: the Vite SPA and Nginx gateway exposed on port 8080;
- `backend`: the internal Next.js API, authentication, and setup service;
- `migrate`: a one-shot schema and normalized-email data migration job;
- `planglade_data`: persistent SQLite data;
- `planglade_attachments`: persistent local attachment files.

The backend is not published directly. Browser traffic, API requests, setup,
and authentication share the frontend gateway origin.

## Requirements

- Docker Engine or Docker Desktop with Docker Compose.
- Node.js 22 or newer to generate the initial configuration.
- A terminal and text editor.

OAuth, Firebase, and an email provider are optional. Local email/password
authentication is the default self-host path.

## First run

1. Install only the root tooling needed by the repository, then generate the
   ignored `.env` file:

   ```bash
   npm run setup:local
   ```

   The command is idempotent. It enables local credentials, generates a strong
   `NEXTAUTH_SECRET` and one-time `PLANGLADE_SETUP_TOKEN`, preserves existing
   generated secrets, and prints the setup token. Never commit `.env`.

2. For a non-local deployment, edit `.env` and set:

   ```env
   PLANGLADE_PUBLIC_URL=https://plan.example.com
   ```

   OAuth remains optional. If you enable Google OAuth, uncomment its variables
   and configure this callback:

   ```text
   https://plan.example.com/api/auth/callback/google
   ```

3. Validate and build:

   ```bash
   docker compose -f compose.yml config
   docker compose -f compose.yml build
   ```

4. Start PlanGlade:

   ```bash
   docker compose -f compose.yml up -d
   docker compose -f compose.yml ps -a
   ```

   The `migrate` service must exit successfully before `backend` becomes
   healthy.

5. Open `http://localhost:8080/setup` (or your configured HTTPS origin), enter
   the token printed by `npm run setup:local`, create the first owner account,
   and store the recovery codes securely. After setup, sign in with that email
   and password.

6. Verify both health boundaries:

   ```bash
   curl http://localhost:8080/healthz
   curl http://localhost:8080/api/health
   ```

Before adding real data, verify sign-in, task create/edit/delete, refresh
persistence, and attachment upload/download.

## HTTPS and public exposure

The bundle does not terminate public TLS. Put a maintained HTTPS reverse proxy
or tunnel in front of port 8080 and keep the backend container private.

Before public exposure:

- set the final HTTPS `PLANGLADE_PUBLIC_URL` before sign-in;
- keep unique secrets and never put secrets in `NEXT_PUBLIC_*` variables;
- restrict firewall access to Docker and the host;
- establish off-machine backups for both named volumes;
- complete a restore drill;
- add monitoring, log retention, update procedures, and an incident plan.

## Data, migrations, and backups

SQLite is stored at `/app/db/planglade.db` in `planglade_data`. Attachments are
stored in `planglade_attachments`. Back up and restore them together.

Normal startup runs checked-in schema migrations and the transactional
normalized-email backfill automatically. Authentication starts only after both
complete. If an invalid legacy address or normalization collision blocks an
upgrade, keep the service stopped and follow the conflict procedure in the
production migration guide. Never run
`prisma db push`, `prisma migrate dev`, `prisma migrate reset`, or
`docker compose down -v` against self-host data.

Read:

- [Backup and restore](./BACKUP_RESTORE.md)
- [Production migrations](./PRODUCTION_MIGRATIONS.md)

## Stop and update

Stop while preserving data:

```bash
docker compose -f compose.yml down
```

For an update:

1. Stop PlanGlade with `docker compose -f compose.yml down`; this preserves the
   named volumes and prevents writes during backup and migration.
2. Back up and verify both volumes.
3. Review the changelog and environment changes.
4. Pull or check out the intended version.
5. Run:

   ```bash
   docker compose -f compose.yml build
   docker compose -f compose.yml up -d
   docker compose -f compose.yml ps -a
   curl http://localhost:8080/api/health
   ```

Rollback means stopping the new containers, restoring a backup compatible with
the earlier version when migrations changed data, checking out the earlier
source revision, rebuilding, and starting again.

## Local development without Docker

From the repository root:

```bash
npm run install:all
npm run dev
```

The launcher prepares `.runtime/planglade-dev.db`, runs the backend internally
on port 3000, and serves the product at `http://127.0.0.1:5173`. Development
authentication is local-only and cannot be enabled in production.

## Troubleshooting

- **Port 8080 is occupied:** set `PLANGLADE_PORT` in `.env` and keep
  `PLANGLADE_PUBLIC_URL` aligned.
- **Migration failed:** inspect `docker compose logs migrate`; do not delete the
  volume to hide the failure.
- **Backend is unhealthy:** inspect `docker compose logs --tail=100 backend`
  and `/api/health` for redacted configuration errors.
- **Sign-in fails:** verify the public URL, stable session secret, local-auth
  flag, and any optional OAuth callback.
- **Attachments fail:** verify the attachment volume is writable and the
  session/storage signing secret stayed stable.

## Known limitations

- No bundled TLS, automated backup, monitoring, alerting, or malware scanning.
- SQLite and the in-process import lock assume the bundled single-backend
  topology; horizontal scaling requires additional coordination.
- Releases and upgrade guarantees remain early-preview quality until a
  versioned release and restore rehearsal are published.
