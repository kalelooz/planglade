import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

test("the import-operation migration preserves a populated workspace", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "planglade-import-migration-"),
  );
  const databasePath = path.join(directory, "test.db");
  const database = new DatabaseSync(databasePath);
  try {
    const migrationsDirectory = path.resolve("prisma", "migrations");
    const migrations = (
      await readdir(migrationsDirectory, { withFileTypes: true })
    )
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const importMigration = "20260902080000_add_workspace_import_operations";
    for (const migration of migrations.filter(
      (name) => name !== importMigration,
    )) {
      database.exec(
        await readFile(
          path.join(migrationsDirectory, migration, "migration.sql"),
          "utf8",
        ),
      );
    }

    database.exec(`
      INSERT INTO "User" ("id", "email", "authVersion", "createdAt", "updatedAt")
      VALUES ('owner-1', 'owner@example.com', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
      INSERT INTO "Workspace" ("id", "slug", "name", "ownerId", "createdAt", "updatedAt")
      VALUES ('workspace-1', 'workspace-1', 'Existing workspace', 'owner-1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `);

    database.exec(
      await readFile(
        path.join(migrationsDirectory, importMigration, "migration.sql"),
        "utf8",
      ),
    );

    const workspace = database
      .prepare('SELECT "id", "name" FROM "Workspace"')
      .get();
    assert.equal(workspace?.id, "workspace-1");
    assert.equal(workspace?.name, "Existing workspace");
    database
      .prepare(
        `
      INSERT INTO "WorkspaceImportOperation"
        ("workspaceId", "claimId", "sourceChecksum", "leaseExpiresAt", "createdAt", "updatedAt")
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
      )
      .run(
        "workspace-1",
        "claim-1",
        `sha256:${"a".repeat(64)}`,
        "2026-09-02T12:00:00.000Z",
      );
    assert.equal(
      database
        .prepare('SELECT COUNT(*) AS "count" FROM "WorkspaceImportOperation"')
        .get()?.count,
      1,
    );
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
