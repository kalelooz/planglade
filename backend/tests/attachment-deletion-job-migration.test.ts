import assert from "node:assert/strict"
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import test from "node:test"

test("the attachment-deletion migration preserves attachments and keeps cleanup durable", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "planglade-attachment-deletion-migration-"))
  const database = new DatabaseSync(path.join(directory, "test.db"))
  const migrationName = "20260902203000_add_attachment_deletion_jobs"
  try {
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
      INSERT INTO "Attachment" ("id", "workspaceId", "uploadedById", "name", "storageKey", "createdAt")
      VALUES ('attachment-1', 'workspace-1', 'owner-1', 'existing.txt', 'workspace-1/existing.txt', CURRENT_TIMESTAMP);
    `)

    database.exec(await readFile(path.join(migrationsDirectory, migrationName, "migration.sql"), "utf8"))
    assert.equal(database.prepare('SELECT "name" FROM "Attachment" WHERE "id" = ?').get("attachment-1")?.name, "existing.txt")
    database.prepare(`
      INSERT INTO "AttachmentDeletionJob" ("id", "storageKey", "nextAttemptAt", "createdAt", "updatedAt")
      VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run("deletion-1", "workspace-1/existing.txt")
    database.exec('DELETE FROM "Workspace" WHERE "id" = \'workspace-1\'')
    assert.equal(database.prepare('SELECT "storageKey" FROM "AttachmentDeletionJob"').get()?.storageKey, "workspace-1/existing.txt")
  } finally {
    database.close()
    await rm(directory, { recursive: true, force: true })
  }
})
