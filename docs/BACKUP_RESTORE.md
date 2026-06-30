# PlanGlade Backup And Restore

Last updated: 2026-07-01

PlanGlade backup and restore is early and manual. There are no automated backups, hosted snapshots, retention policies, or monitored restore drills in this repo.

## Docker Data To Back Up

The Docker baseline has two data locations:

- SQLite database: `/app/db/planglade.db` in the `planglade_planglade_data` Docker volume.
- Attachments: Firebase Storage, outside Docker.

Keep the SQLite and Firebase backups from the same time window. Store `.env` securely outside git, but do not place it in an ordinary unencrypted backup.

## Docker SQLite Backup

Create a local `backups` folder, then stop the app so the SQLite copy is consistent:

```bash
mkdir -p backups
docker compose stop app
```

Copy the database from the named volume on Linux or macOS:

```bash
docker run --rm -v planglade_planglade_data:/data:ro -v "$(pwd)/backups:/backup" alpine cp /data/planglade.db /backup/planglade-2026-07-01.db
```

Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force backups
docker run --rm -v planglade_planglade_data:/data:ro -v "${PWD}\backups:/backup" alpine cp /data/planglade.db /backup/planglade-2026-07-01.db
```

Start the app again:

```bash
docker compose up -d
```

Confirm the backup file exists and has a non-zero size. Copy it to encrypted off-machine storage.

If the volume name differs, find it with `docker volume ls` rather than guessing.

## Docker SQLite Restore

Restoring replaces current data. Back up the current volume first.

Stop the stack:

```bash
docker compose down
```

Linux or macOS:

```bash
docker run --rm -v planglade_planglade_data:/data -v "$(pwd)/backups:/backup:ro" alpine cp /backup/planglade-2026-07-01.db /data/planglade.db
```

Windows PowerShell:

```powershell
docker run --rm -v planglade_planglade_data:/data -v "${PWD}\backups:/backup:ro" alpine cp /backup/planglade-2026-07-01.db /data/planglade.db
```

Start and verify:

```bash
docker compose up -d
docker compose ps -a
curl http://localhost:3000/api/health
```

Check sign-in and several known projects, tasks, notes, and settings. A healthy endpoint alone does not prove the data restored correctly.

## Firebase Attachment Backup

Docker does not store attachments locally. Use Firebase/Google Cloud tools or console exports appropriate to your bucket, access model, and retention needs. Record the exact bucket and backup time alongside the SQLite backup.

Restoring SQLite without its matching Firebase objects can leave attachment records pointing to missing files.

## Test Restores

Test restores regularly on a disposable Docker volume or separate machine:

1. Restore copies of the SQLite database and Firebase objects.
2. Start the same PlanGlade version that created the backup.
3. Check `/api/health`.
4. Sign in and inspect known projects, tasks, notes, settings, and attachments.
5. Record the result and time required.

A backup that has never been restored is unverified.

## Local Development Backup

The non-Docker local path still uses SQLite plus local attachments. Stop the app, then copy both:

```bash
cp db/custom.db backups/custom-2026-07-01.db
cp -R storage/local-attachments backups/local-attachments-2026-07-01
```

Windows PowerShell:

```powershell
Copy-Item db\custom.db backups\custom-2026-07-01.db
Copy-Item storage\local-attachments backups\local-attachments-2026-07-01 -Recurse
```

Restore both from the same backup window while the app is stopped.

## Workspace Export / Import

Settings includes workspace JSON export/import. It is useful for portability, but it is not a complete production backup because it does not replace database and attachment backups.

## Not Production-Ready Yet

Still needed before calling backups production-ready:

- Automated scheduled backups.
- Encrypted off-machine storage.
- Retention and deletion policies.
- Automated restore tests.
- Monitoring and alerts for failed backups.
- A reviewed disaster-recovery target and runbook.
