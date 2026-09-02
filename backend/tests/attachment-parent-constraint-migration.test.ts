import assert from "node:assert/strict"
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import test from "node:test"

test("restrictive attachment parents preserve data and roll back an unseen child", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "planglade-attachment-parent-migration-"))
  const database = new DatabaseSync(path.join(directory, "test.db"))
  const migrationName = "20260902213000_restrict_attachment_parent_deletion"
  try {
    database.exec("PRAGMA foreign_keys = ON")
    const migrationsDirectory = path.resolve("prisma", "migrations")
    const migrations = (await readdir(migrationsDirectory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    for (const migration of migrations.filter((name) => name !== migrationName)) {
      database.exec(await readFile(path.join(migrationsDirectory, migration, "migration.sql"), "utf8"))
    }
    database.exec(`
      INSERT INTO "User" ("id", "email", "authVersion", "createdAt", "updatedAt")
      VALUES ('owner-1', 'owner@example.com', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
      INSERT INTO "Workspace" ("id", "slug", "name", "ownerId", "createdAt", "updatedAt")
      VALUES ('workspace-1', 'workspace-1', 'Existing workspace', 'owner-1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
      INSERT INTO "WorkItem" ("id", "workspaceId", "title", "createdById", "createdAt", "updatedAt")
      VALUES ('task-1', 'workspace-1', 'Existing task', 'owner-1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
      INSERT INTO "Note" ("id", "workspaceId", "title", "createdById", "updatedById", "createdAt", "updatedAt")
      VALUES ('note-1', 'workspace-1', 'Existing note', 'owner-1', 'owner-1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
      INSERT INTO "Attachment" ("id", "workspaceId", "workItemId", "uploadedById", "name", "storageKey", "createdAt")
      VALUES
        ('attachment-scanned', 'workspace-1', 'task-1', 'owner-1', 'scanned.txt', 'workspace-1/scanned.txt', CURRENT_TIMESTAMP),
        ('attachment-late', 'workspace-1', 'task-1', 'owner-1', 'late.txt', 'workspace-1/late.txt', CURRENT_TIMESTAMP);
      INSERT INTO "AttachmentUploadReservation" ("id", "workspaceId", "actorUserId", "noteId", "storageKey", "mimeType", "sizeBytes", "expiresAt")
      VALUES ('reservation-1', 'workspace-1', 'owner-1', 'note-1', 'workspace-1/pending.txt', 'text/plain', 7, CURRENT_TIMESTAMP);
    `)

    database.exec(await readFile(path.join(migrationsDirectory, migrationName, "migration.sql"), "utf8"))
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM "Attachment"').get()?.count, 2)
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM "AttachmentUploadReservation"').get()?.count, 1)
    const attachmentParents = database.prepare('PRAGMA foreign_key_list("Attachment")').all()
      .filter((foreignKey) => foreignKey.table === "WorkItem" || foreignKey.table === "Note")
    const reservationParents = database.prepare('PRAGMA foreign_key_list("AttachmentUploadReservation")').all()
      .filter((foreignKey) => foreignKey.table === "WorkItem" || foreignKey.table === "Note")
    assert.ok([...attachmentParents, ...reservationParents].every((foreignKey) => foreignKey.on_delete === "RESTRICT"))

    database.exec("BEGIN")
    database.exec(`
      INSERT INTO "AttachmentDeletionJob" ("id", "storageKey", "nextAttemptAt", "createdAt", "updatedAt")
      VALUES ('deletion-1', 'workspace-1/scanned.txt', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
      DELETE FROM "Attachment" WHERE "id" = 'attachment-scanned';
    `)
    assert.throws(
      () => database.exec('DELETE FROM "WorkItem" WHERE "id" = \'task-1\''),
      /FOREIGN KEY constraint failed/,
    )
    database.exec("ROLLBACK")
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM "WorkItem" WHERE "id" = ?').get("task-1")?.count, 1)
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM "Attachment" WHERE "workItemId" = ?').get("task-1")?.count, 2)
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM "AttachmentDeletionJob"').get()?.count, 0)
  } finally {
    database.close()
    await rm(directory, { recursive: true, force: true })
  }
})
