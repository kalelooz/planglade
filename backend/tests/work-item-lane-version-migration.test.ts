import assert from "node:assert/strict"
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import test from "node:test"

test("the lane-version migration preserves populated workspaces and cascades cleanup", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "planglade-lane-migration-"))
  const database = new DatabaseSync(path.join(directory, "test.db"))
  const migrationName = "20260902160000_add_work_item_lane_versions"
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
      INSERT INTO "WorkItem" ("id", "workspaceId", "title", "status", "priority", "createdById", "createdAt", "updatedAt")
      VALUES ('task-1', 'workspace-1', 'Existing task', 'TODO', 'MEDIUM', 'owner-1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `)

    database.exec(await readFile(path.join(migrationsDirectory, migrationName, "migration.sql"), "utf8"))
    assert.equal(database.prepare('SELECT "title" FROM "WorkItem" WHERE "id" = ?').get("task-1")?.title, "Existing task")
    database.prepare(`
      INSERT INTO "WorkItemLaneVersion" ("workspaceId", "status", "version", "createdAt", "updatedAt")
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run("workspace-1", "TODO", 1)
    assert.equal(database.prepare('SELECT "version" FROM "WorkItemLaneVersion"').get()?.version, 1)
    database.exec('DELETE FROM "Workspace" WHERE "id" = \'workspace-1\'')
    assert.equal(database.prepare('SELECT COUNT(*) AS "count" FROM "WorkItemLaneVersion"').get()?.count, 0)
  } finally {
    database.close()
    await rm(directory, { recursive: true, force: true })
  }
})
