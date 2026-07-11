import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import test, { type TestContext } from "node:test"

const migrationPath =
  "prisma/migrations/20260711160000_local_auth_persistence/migration.sql"
const priorMigrationPaths = [
  "prisma/migrations/20260624000000_add_workspace_priority_display_style/migration.sql",
  "prisma/migrations/20260625000000_default_priority_display_badge/migration.sql",
  "prisma/migrations/20260709000000_unique_attachment_storage_key/migration.sql",
]

async function createBaseDatabase(t: TestContext) {
  const directory = await mkdtemp(path.join(tmpdir(), "planglade-local-auth-migration-"))
  const databasePath = path.join(directory, "test.db")
  const db = new DatabaseSync(databasePath)
  t.after(async () => {
    db.close()
    await rm(directory, { recursive: true, force: true })
  })

  for (const filePath of priorMigrationPaths) {
    db.exec(await readFile(filePath, "utf8"))
  }
  db.exec("PRAGMA foreign_keys = ON")
  return { db, databasePath }
}

function insertUser(db: DatabaseSync, id: string, email: string) {
  db.prepare('INSERT INTO "User" ("id", "email", "updatedAt") VALUES (?, ?, CURRENT_TIMESTAMP)')
    .run(id, email)
}

function databaseUrl(databasePath: string) {
  return `file:${databasePath.replaceAll("\\", "/")}`
}

function runPreflight(databasePath: string) {
  return execFileSync(process.execPath, ["scripts/preflight-local-auth-emails.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl(databasePath) },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
}

test("SELF-HOST-AUTH-SCHEMA-001: Prisma schema declares the staged local-auth persistence models", async () => {
  const schema = await readFile("prisma/schema.prisma", "utf8")

  assert.match(schema, /enum SelfHostSetupStatus\s*{[\s\S]*?AVAILABLE[\s\S]*?IN_PROGRESS[\s\S]*?COMPLETE[\s\S]*?}/)
  assert.match(schema, /enum AuthThrottleScope\s*{[\s\S]*?LOGIN_ACCOUNT[\s\S]*?LOGIN_GLOBAL[\s\S]*?SETUP[\s\S]*?RECOVERY[\s\S]*?}/)
  assert.match(schema, /model User\s*{[\s\S]*?normalizedEmail\s+String\?\s+@unique[\s\S]*?authVersion\s+Int\s+@default\(0\)/)
  assert.match(schema, /model LocalCredential\s*{[\s\S]*?userId\s+String\s+@unique[\s\S]*?passwordHash\s+String[\s\S]*?disabledAt\s+DateTime\?/)
  assert.match(schema, /model LocalRecoveryCode\s*{[\s\S]*?codeHash\s+String[\s\S]*?@@unique\(\[userId, codeHash\]\)[\s\S]*?@@index\(\[userId, usedAt\]\)/)
  assert.match(schema, /model SelfHostSetup\s*{[\s\S]*?status\s+SelfHostSetupStatus[\s\S]*?claimantHash\s+String\?[\s\S]*?completedById\s+String\?[\s\S]*?@@index\(\[completedById\]\)/)
  assert.match(schema, /model AuthThrottle\s*{[\s\S]*?scope\s+AuthThrottleScope[\s\S]*?subjectKey\s+String[\s\S]*?@@unique\(\[scope, subjectKey\]\)[\s\S]*?@@index\(\[windowStartedAt\]\)/)
})

test("SELF-HOST-AUTH-SCHEMA-001: preflight uses JavaScript normalization and rejects unsafe existing data", async (t) => {
  const safe = await createBaseDatabase(t)
  insertUser(safe.db, "safe-1", " Owner+tag@Example.COM ")
  assert.match(runPreflight(safe.databasePath), /preflight passed/i)

  const collision = await createBaseDatabase(t)
  insertUser(collision.db, "collision-1", "Alice@example.com")
  insertUser(collision.db, "collision-2", " alice@EXAMPLE.com ")
  assert.throws(
    () => runPreflight(collision.databasePath),
    (error: unknown) => {
      const stderr = String((error as { stderr?: string }).stderr ?? error)
      assert.match(stderr, /normalized email collision/i)
      assert.match(stderr, /resolve.*before.*migration/i)
      assert.doesNotMatch(stderr, /Alice@example\.com/i)
      return true
    }
  )

  const unsafe = await createBaseDatabase(t)
  insertUser(unsafe.db, "unsafe-1", "tést@example.com")
  assert.throws(
    () => runPreflight(unsafe.databasePath),
    (error: unknown) => {
      const stderr = String((error as { stderr?: string }).stderr ?? error)
      assert.match(stderr, /cannot be reproduced safely by SQLite/i)
      assert.match(stderr, /resolve.*before.*migration/i)
      assert.doesNotMatch(stderr, /tést@example\.com/i)
      return true
    }
  )
})

test("SELF-HOST-AUTH-SCHEMA-001: fresh migration creates an unclaimed setup and empty auth tables", async (t) => {
  const { db } = await createBaseDatabase(t)
  db.exec(await readFile(migrationPath, "utf8"))

  const setup = db.prepare('SELECT * FROM "SelfHostSetup"').get() as Record<string, unknown>
  assert.equal(setup.id, "singleton")
  assert.equal(setup.status, "AVAILABLE")
  assert.equal(setup.claimantHash, null)
  assert.equal(setup.claimExpiresAt, null)
  assert.equal(setup.completedAt, null)
  assert.equal(setup.completedById, null)

  for (const table of ["User", "LocalCredential", "LocalRecoveryCode", "AuthThrottle"]) {
    const row = db.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get() as { count: number }
    assert.equal(row.count, 0)
  }

  const columns = db.prepare('PRAGMA table_info("User")').all() as Array<Record<string, unknown>>
  assert.equal(columns.find((column) => column.name === "normalizedEmail")?.notnull, 0)
  assert.equal(columns.find((column) => column.name === "authVersion")?.dflt_value, "0")
})

test("SELF-HOST-AUTH-SCHEMA-001: claimed installation preserves identity and initializes setup complete", async (t) => {
  const { db, databasePath } = await createBaseDatabase(t)
  insertUser(db, "owner-1", " Owner+tag@Example.COM ")
  db.prepare(
    'INSERT INTO "Workspace" ("id", "slug", "name", "ownerId", "updatedAt") VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)'
  ).run("workspace-1", "existing", "Existing Workspace", "owner-1")

  assert.match(runPreflight(databasePath), /preflight passed/i)
  db.exec(await readFile(migrationPath, "utf8"))

  const user = db.prepare('SELECT * FROM "User" WHERE "id" = ?').get("owner-1") as Record<string, unknown>
  assert.equal(user.email, " Owner+tag@Example.COM ")
  assert.equal(user.normalizedEmail, "owner+tag@example.com")
  assert.equal(user.authVersion, 0)
  assert.equal(
    (db.prepare('SELECT "id" FROM "Workspace"').get() as { id: string }).id,
    "workspace-1"
  )
  const setup = db.prepare('SELECT "status", "completedAt" FROM "SelfHostSetup"').get() as Record<string, unknown>
  assert.equal(setup.status, "COMPLETE")
  assert.notEqual(setup.completedAt, null)
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM "LocalCredential"').get() as { count: number }).count,
    0
  )
})

test("SELF-HOST-AUTH-SCHEMA-001: collision and unsafe email guards fail before schema mutation", async (t) => {
  const migration = await readFile(migrationPath, "utf8")
  for (const emails of [
    ["Alice@example.com", " alice@EXAMPLE.com "],
    ["tést@example.com"],
  ]) {
    const { db } = await createBaseDatabase(t)
    emails.forEach((email, index) => insertUser(db, `user-${emails.length}-${index}`, email))

    assert.throws(() => db.exec(migration), /local-auth email preflight/i)
    const columns = db.prepare('PRAGMA table_info("User")').all() as Array<{ name: string }>
    assert.equal(columns.some((column) => column.name === "normalizedEmail"), false)
    assert.equal(columns.some((column) => column.name === "authVersion"), false)
  }
})

test("SELF-HOST-AUTH-SCHEMA-001: singleton, uniqueness, and cascade constraints are enforced", async (t) => {
  const { db } = await createBaseDatabase(t)
  db.exec(await readFile(migrationPath, "utf8"))
  insertUser(db, "user-1", "user@example.com")
  db.prepare('UPDATE "User" SET "normalizedEmail" = ? WHERE "id" = ?').run("user@example.com", "user-1")

  assert.throws(
    () => db.prepare('INSERT INTO "SelfHostSetup" ("id", "status", "updatedAt") VALUES (?, ?, CURRENT_TIMESTAMP)').run("second", "AVAILABLE"),
    /SelfHostSetup singleton/i
  )

  db.prepare(
    'INSERT INTO "LocalCredential" ("id", "userId", "passwordHash", "passwordCreatedAt", "passwordChangedAt", "updatedAt") VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
  ).run("credential-1", "user-1", "scrypt$placeholder")
  assert.throws(
    () => db.prepare(
      'INSERT INTO "LocalCredential" ("id", "userId", "passwordHash", "passwordCreatedAt", "passwordChangedAt", "updatedAt") VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
    ).run("credential-2", "user-1", "scrypt$other"),
    /UNIQUE/
  )

  db.prepare('INSERT INTO "LocalRecoveryCode" ("id", "userId", "codeHash") VALUES (?, ?, ?)')
    .run("code-1", "user-1", "hash-1")
  assert.throws(
    () => db.prepare('INSERT INTO "LocalRecoveryCode" ("id", "userId", "codeHash") VALUES (?, ?, ?)')
      .run("code-2", "user-1", "hash-1"),
    /UNIQUE/
  )

  db.prepare(
    'INSERT INTO "AuthThrottle" ("id", "scope", "subjectKey", "windowStartedAt", "updatedAt") VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
  ).run("throttle-1", "LOGIN_ACCOUNT", "hashed-subject")
  assert.throws(
    () => db.prepare(
      'INSERT INTO "AuthThrottle" ("id", "scope", "subjectKey", "windowStartedAt", "updatedAt") VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
    ).run("throttle-2", "LOGIN_ACCOUNT", "hashed-subject"),
    /UNIQUE/
  )

  db.prepare('DELETE FROM "User" WHERE "id" = ?').run("user-1")
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM "LocalCredential"').get() as { count: number }).count,
    0
  )
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM "LocalRecoveryCode"').get() as { count: number }).count,
    0
  )
})
