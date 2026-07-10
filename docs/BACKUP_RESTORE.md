# PlanGlade Backup And Restore

Last updated: 2026-07-01

PlanGlade backup and restore is early and manual. There are no automated backups, hosted snapshots, retention policies, or monitored restore drills in this repo.

## Docker Data To Back Up

The Docker default keeps all data in two Docker volumes:

- SQLite database: `/app/db/planglade.db` in the `planglade_planglade_data` Docker volume.
- Local attachments: `/app/storage/local-attachments` in the `planglade_planglade_attachments` Docker volume.

Keep both backups from the same time window so attachments stay aligned with their database records. Store `.env` securely outside git, but do not place it in an ordinary unencrypted backup.

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

## Docker Local Attachment Backup

With the default local storage provider, attachments live in the `planglade_planglade_attachments` volume. Back it up alongside the SQLite backup, while the app is stopped:

```bash
docker compose stop app
```

Linux or macOS:

```bash
docker run --rm -v planglade_planglade_attachments:/data:ro -v "$(pwd)/backups:/backup" alpine tar -C /data -cf /backup/local-attachments-2026-07-01.tar .
```

Windows PowerShell:

```powershell
docker run --rm -v planglade_planglade_attachments:/data:ro -v "${PWD}\backups:/backup" alpine tar -C /data -cf /backup/local-attachments-2026-07-01.tar .
```

Start the app again:

```bash
docker compose up -d
```

Confirm the tar archive exists and has a non-zero size. Copy it to encrypted off-machine storage.

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

## Docker Local Attachment Restore

Restore the attachment volume from the same backup window as the SQLite restore, while the stack is stopped:

Linux or macOS:

```bash
docker run --rm -v planglade_planglade_attachments:/data -v "$(pwd)/backups:/backup:ro" alpine sh -c "rm -rf /data/* /data/.* 2>/dev/null; tar -C /data -xf /backup/local-attachments-2026-07-01.tar"
```

Windows PowerShell:

```powershell
docker run --rm -v planglade_planglade_attachments:/data -v "${PWD}\backups:/backup:ro" alpine sh -c "rm -rf /data/* /data/.* 2>/dev/null; tar -C /data -xf /backup/local-attachments-2026-07-01.tar"
```

Start and verify:

```bash
docker compose up -d
docker compose ps -a
curl http://localhost:3000/api/health
```

Check sign-in and several known projects, tasks, notes, attachments, and settings. A healthy endpoint alone does not prove the data restored correctly.

## Test Restores

Test restores regularly on a disposable Docker volume or separate machine:

1. Restore copies of the SQLite database and the local attachment volume.
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
