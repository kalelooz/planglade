# PlanGlade Backup And Restore

Last updated: 2026-07-17

PlanGlade includes a manual, local backup/restore command for the public SQLite and local-attachment self-host path. It is not a complete production backup system: scheduling, encryption, off-machine transfer, retention, monitoring, and restore drills remain operator responsibilities.

## What A Bundle Contains

One versioned directory bundle contains:

- `database.sqlite`: the SQLite database.
- `attachments/`: every local attachment and metadata sidecar.
- `manifest.json`: bundle format/version, SQLite format metadata, file sizes, and SHA-256 checksums.

The command rejects links and special files. Restore rejects incompatible manifests, unsafe or path-traversal entries, missing or unlisted files, checksum mismatches, invalid SQLite headers/versions, and failed SQLite integrity checks before replacing live data. Restore copies both replacements into staging paths. If installation fails, it automatically rolls both destinations back to the original database and attachment directory.

The bundle is a directory, not a compressed archive. Copy the whole directory without changing its contents. Store it encrypted and off-machine.

## Docker Data Locations

The standard Compose app service mounts both persistent sources used by the command:

- SQLite: `/app/db/planglade.db` in `planglade_planglade_data`.
- Attachments: `/app/storage/local-attachments` in `planglade_planglade_attachments`.

If your Compose project name differs, confirm volume names with `docker volume ls`. Do not guess or edit volume contents manually.

## Create A Docker Backup

Use the current standard app image. Stop the app first so SQLite and attachments cannot change while they are copied. The output directory must not already exist.

Linux or macOS:

```bash
mkdir -p backups
docker compose stop app
docker compose run --rm --no-deps --user root -v "$PWD/backups:/backups" app npm run backup:create -- /backups/planglade-2026-07-17T120000Z
docker compose start app
```

Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force backups
docker compose stop app
docker compose run --rm --no-deps --user root -v "${PWD}\backups:/backups" app npm run backup:create -- /backups/planglade-2026-07-17T120000Z
docker compose start app
```

Choose a new timestamped directory name for every run. `--user root` is limited to this one-off offline operator container so it can write the host bind mount; the normal app still runs as the non-root `nextjs` user.

The command refuses an existing output, an ambiguous data path, a non-local storage provider, links/special files, and active SQLite journal/WAL sidecars. If it reports that data changed, keep the app stopped and retry. It prints status only, never environment secrets or file contents.

After creation, copy the entire bundle directory to encrypted off-machine storage. Do not store `.env` in the bundle.

## Restore A Docker Backup

Restore replaces the current database and attachment tree together. First create a separate backup of the current data. Run the app version that created the bundle, or a version documented as bundle-compatible.

Stop and remove the app container without deleting volumes:

```bash
docker compose down
```

Linux or macOS:

```bash
docker compose run --rm --no-deps --user root -v "$PWD/backups:/backups:ro" app npm run backup:restore -- /backups/planglade-2026-07-17T120000Z --confirm-replace
```

Windows PowerShell:

```powershell
docker compose run --rm --no-deps --user root -v "${PWD}\backups:/backups:ro" app npm run backup:restore -- /backups/planglade-2026-07-17T120000Z --confirm-replace
```

The exact `--confirm-replace` flag is mandatory. Bundle validation finishes before destination staging or replacement. Do not delete `.planglade-restore-*` or `.planglade-rollback-*` artifacts if a crash or rollback warning leaves one behind; preserve them and investigate before retrying.

Start and verify:

```bash
docker compose up -d
docker compose ps -a
curl http://localhost:3000/api/health
```

The health endpoint is status-only. A `{"status":"ok"}` response proves basic auth, storage, and database readiness; it does not prove restored records are correct. Sign in and inspect known projects, tasks, notes, settings, and several attachment downloads.

## Local Node Backup And Restore

The local CLI requires Node.js 22.5 or newer because it uses the Node standard SQLite module. Stop the local app, and ensure `.env` explicitly contains the SQLite and attachment paths:

```env
DATABASE_URL="file:../db/custom.db"
PLANGLADE_STORAGE_PROVIDER="local"
PLANGLADE_LOCAL_STORAGE_DIR="storage/local-attachments"
```

Create a new bundle:

```bash
mkdir -p backups
npm run backup:create -- backups/planglade-2026-07-17T120000Z
```

Restore it only after stopping the app and backing up current data:

```bash
npm run backup:restore -- backups/planglade-2026-07-17T120000Z --confirm-replace
```

Relative `DATABASE_URL` paths follow Prisma's schema-directory convention; the example resolves to `db/custom.db`. The attachment example resolves from the repository root to `storage/local-attachments`.

## Test Restores

Test restores regularly on disposable volumes or a separate machine:

1. Copy a complete bundle into the test environment.
2. Restore it with the same PlanGlade version that created it.
3. Start the stack and check `/api/health`.
4. Sign in and inspect known projects, tasks, notes, settings, and attachments.
5. Record the result and recovery time.

A backup that has never been restored is unverified. Workspace JSON export/import remains useful for portability, but it is not a full backup because it does not replace the SQLite database and attachment tree.

## Still Operator-Managed

- Automated scheduled backups.
- Encryption and off-machine transfer.
- Retention and secure deletion.
- Automated restore tests.
- Monitoring and alerts for failed backups.
- Recovery-time and recovery-point objectives.
