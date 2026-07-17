import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, readdirSync } from "node:fs"
import { rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import test from "node:test"

const MAP_MIGRATION = "20260717160000_map_production_foundation"

test("Map migration upgrades current main data and fails safely when reapplied", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "planglade-map-migration-"))
  const databasePath = path.join(directory, "upgrade.db")
  const database = new DatabaseSync(databasePath)

  try {
    database.exec("PRAGMA foreign_keys = ON")
    const migrationsDirectory = path.resolve("prisma", "migrations")
    const migrations = readdirSync(migrationsDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== MAP_MIGRATION)
      .map((entry) => entry.name)
      .sort()
    for (const migration of migrations) {
      database.exec(
        readFileSync(path.join(migrationsDirectory, migration, "migration.sql"), "utf8"),
      )
    }

    const now = "2026-07-17T00:00:00.000Z"
    database
      .prepare("INSERT INTO User (id, email, createdAt, updatedAt) VALUES (?, ?, ?, ?)")
      .run("upgrade-user", "upgrade@example.test", now, now)
    database
      .prepare(
        "INSERT INTO Workspace (id, slug, name, ownerId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run("upgrade-workspace", "upgrade", "Upgrade", "upgrade-user", now, now)
    database
      .prepare(
        "INSERT INTO Project (id, workspaceId, name, slug, createdById, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        "upgrade-project",
        "upgrade-workspace",
        "Upgrade project",
        "upgrade-project",
        "upgrade-user",
        now,
        now,
      )
    database
      .prepare(
        "INSERT INTO WorkItem (id, workspaceId, projectId, title, createdById, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        "upgrade-task",
        "upgrade-workspace",
        "upgrade-project",
        "Upgrade task",
        "upgrade-user",
        now,
        now,
      )

    const mapSql = readFileSync(
      path.join(migrationsDirectory, MAP_MIGRATION, "migration.sql"),
      "utf8",
    )
    database.exec(mapSql)
    database
      .prepare(
        "INSERT INTO MapScope (id, workspaceId, scopeType, scopeKey, updatedAt) VALUES (?, ?, ?, ?, ?)",
      )
      .run("upgrade-map", "upgrade-workspace", "WORKSPACE", "workspace", now)
    database
      .prepare(
        "INSERT INTO MapProjectPlacement (mapScopeId, containerKey, projectId, x, y, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run("upgrade-map", "no-project", null, 10, 20, now)
    database
      .prepare(
        "INSERT INTO MapTaskPlacement (mapScopeId, workItemId, x, y, updatedAt) VALUES (?, ?, ?, ?, ?)",
      )
      .run("upgrade-map", "upgrade-task", 30, 40, now)

    assert.equal(
      (
        database
          .prepare("SELECT COUNT(*) AS count FROM WorkItem WHERE id = ?")
          .get("upgrade-task") as { count: number }
      ).count,
      1,
    )
    assert.throws(() => database.exec(mapSql), /already exists/)
    assert.equal(
      (
        database
          .prepare("SELECT COUNT(*) AS count FROM Workspace WHERE id = ?")
          .get("upgrade-workspace") as { count: number }
      ).count,
      1,
    )

    database.prepare("DELETE FROM WorkItem WHERE id = ?").run("upgrade-task")
    assert.equal(
      (
        database
          .prepare("SELECT COUNT(*) AS count FROM MapTaskPlacement")
          .get() as { count: number }
      ).count,
      0,
    )
  } finally {
    database.close()
    await rm(directory, { recursive: true, force: true })
  }
})
