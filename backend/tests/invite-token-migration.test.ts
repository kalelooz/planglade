import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"
import path from "node:path"
import test from "node:test"

function migrationSql(name: string) {
  return readFileSync(path.resolve("prisma", "migrations", name, "migration.sql"), "utf8")
}

test("invite token migration removes recoverable secrets and revokes pending links", () => {
  const database = new DatabaseSync(":memory:")
  try {
    database.exec(migrationSql("20260808020000_initial_public_schema"))
    database.prepare(`
      INSERT INTO "User" ("id", "email", "updatedAt")
      VALUES ('owner-1', 'owner@example.com', CURRENT_TIMESTAMP)
    `).run()
    database.prepare(`
      INSERT INTO "Workspace" ("id", "slug", "name", "ownerId", "updatedAt")
      VALUES ('workspace-1', 'workspace', 'Workspace', 'owner-1', CURRENT_TIMESTAMP)
    `).run()
    database.prepare(`
      INSERT INTO "WorkspaceInvite" (
        "id", "workspaceId", "email", "messageBody", "token", "expiresAt",
        "invitedById", "updatedAt"
      ) VALUES (
        'invite-1', 'workspace-1', 'person@example.com',
        'Join at https://example.com/invite?inviteToken=raw-secret-token',
        'raw-secret-token', '2100-01-01T00:00:00.000Z', 'owner-1', CURRENT_TIMESTAMP
      )
    `).run()

    database.exec(migrationSql("20260830120000_hash_workspace_invite_tokens"))

    const columns = database.prepare(`PRAGMA table_info("WorkspaceInvite")`).all() as Array<{
      name: string
    }>
    const invite = database.prepare(`
      SELECT "tokenHash", "tokenVersion", "status" FROM "WorkspaceInvite" WHERE "id" = 'invite-1'
    `).get() as { tokenHash: string; tokenVersion: number; status: string }

    assert.equal(columns.some((column) => column.name === "token"), false)
    assert.equal(columns.some((column) => column.name === "messageBody"), false)
    assert.equal(columns.some((column) => column.name === "tokenHash"), true)
    assert.match(invite.tokenHash, /^[a-f0-9]{64}$/)
    assert.notEqual(invite.tokenHash, "raw-secret-token")
    assert.equal(invite.tokenVersion, 1)
    assert.equal(invite.status, "REVOKED")
  } finally {
    database.close()
  }
})
