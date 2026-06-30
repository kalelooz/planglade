# PlanGlade Backup And Restore

Last updated: 2026-06-28

PlanGlade backup and restore is early and manual. There are no automated backups, hosted snapshots, or monitored restore drills in this repo.

These notes cover the current local/developer self-host path: SQLite plus local attachment storage.

## What To Back Up

Back up these together:

- The SQLite database file from `DATABASE_URL`.
- The local attachment directory from `PLANGLADE_LOCAL_STORAGE_DIR`.
- Your `.env` values, stored securely outside git.

With the example local config:

```env
DATABASE_URL="file:../db/custom.db"
PLANGLADE_LOCAL_STORAGE_DIR="storage/local-attachments"
```

the database is the `db/custom.db` file relative to Prisma's schema location, and attachments live in `storage/local-attachments`.

## Manual SQLite Backup

Stop the app first when possible.

Then copy the database file to a dated backup location:

```bash
cp db/custom.db backups/custom-2026-06-28.db
```

On Windows PowerShell:

```powershell
Copy-Item db\custom.db backups\custom-2026-06-28.db
```

Also copy the local attachment directory:

```bash
cp -R storage/local-attachments backups/local-attachments-2026-06-28
```

On Windows PowerShell:

```powershell
Copy-Item storage\local-attachments backups\local-attachments-2026-06-28 -Recurse
```

## Manual Restore

Stop the app before restore.

Replace the current database file with the backup:

```bash
cp backups/custom-2026-06-28.db db/custom.db
```

On Windows PowerShell:

```powershell
Copy-Item backups\custom-2026-06-28.db db\custom.db
```

Restore the matching attachment directory from the same backup window:

```bash
rm -rf storage/local-attachments
cp -R backups/local-attachments-2026-06-28 storage/local-attachments
```

On Windows PowerShell:

```powershell
Remove-Item storage\local-attachments -Recurse
Copy-Item backups\local-attachments-2026-06-28 storage\local-attachments -Recurse
```

Start the app and check:

```bash
curl http://localhost:3000/api/health
```

## Workspace Export / Import

Settings includes workspace JSON export/import.

Use it for portability or a small manual safety copy. Do not treat it as a complete production backup because it does not replace a full database and attachment backup.

## Not Production-Ready Yet

Still needed before calling backups production-ready:

- Automated scheduled backups.
- Off-machine storage.
- Restore tests.
- Backup retention policy.
- Monitoring and alerting.
- Clear production database guidance beyond SQLite.
