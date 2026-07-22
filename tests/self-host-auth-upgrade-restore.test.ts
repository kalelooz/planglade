import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import test from "node:test"
import { promisify } from "node:util"

import { assertIsolatedDatabaseUrl } from "./helpers/isolated-test-database"

const runFile = promisify(execFile)
const AUTH_MIGRATION = "20260711160000_local_auth_persistence"
const PRE_AUTH_MIGRATIONS = [
  "20260624000000_add_workspace_priority_display_style",
  "20260625000000_default_priority_display_badge",
  "20260709000000_unique_attachment_storage_key",
]
const POST_AUTH_MIGRATIONS = [
  AUTH_MIGRATION,
  "20260717010000_auth_throttle_workspace_scope",
  "20260717160000_map_production_foundation",
]

function databaseUrl(databasePath: string) {
  return `file:${databasePath.replaceAll("\\", "/")}`
}

async function sha256(filePath: string) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex")
}

async function applyMigrations(databasePath: string, migrations: string[]) {
  const database = new DatabaseSync(databasePath)
  try {
    for (const migration of migrations) {
      database.exec(await readFile(`prisma/migrations/${migration}/migration.sql`, "utf8"))
    }
    database.exec("PRAGMA foreign_keys = ON")
  } finally {
    database.close()
  }
}

function seedPreAuthInstallation(databasePath: string) {
  const database = new DatabaseSync(databasePath)
  try {
    database.exec("PRAGMA foreign_keys = ON")
    const timestamp = "2026-07-10T10:00:00.000Z"
    const insertUser = database.prepare(
      'INSERT INTO "User" ("id", "email", "name", "image", "locale", "timezone", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    insertUser.run("owner-1", " Owner+tag@Example.COM ", "Owner One", "owner.png", "en", "UTC", timestamp, timestamp)
    insertUser.run("owner-2", "second@example.com", "Owner Two", null, "en", "UTC", timestamp, timestamp)
    insertUser.run("oauth-only", "oauth-only@example.com", "OAuth Only", null, "en", "UTC", timestamp, timestamp)

    const insertWorkspace = database.prepare(
      'INSERT INTO "Workspace" ("id", "slug", "name", "ownerId", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?)',
    )
    insertWorkspace.run("workspace-1", "first", "First Workspace", "owner-1", timestamp, timestamp)
    insertWorkspace.run("workspace-2", "second", "Second Workspace", "owner-2", timestamp, timestamp)

    const insertMembership = database.prepare(
      'INSERT INTO "WorkspaceMember" ("id", "workspaceId", "userId", "role", "joinedAt") VALUES (?, ?, ?, ?, ?)',
    )
    insertMembership.run("membership-1", "workspace-1", "owner-1", "OWNER", timestamp)
    insertMembership.run("membership-2", "workspace-1", "owner-2", "MEMBER", timestamp)
    insertMembership.run("membership-3", "workspace-2", "owner-2", "OWNER", timestamp)
    insertMembership.run("membership-4", "workspace-2", "oauth-only", "VIEWER", timestamp)

    database.prepare(
      'INSERT INTO "Project" ("id", "workspaceId", "name", "slug", "description", "createdById", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run("project-1", "workspace-1", "Existing Project", "existing-project", "Preserve me", "owner-1", timestamp, timestamp)
  } finally {
    database.close()
  }
}

function installationSnapshot(databasePath: string) {
  const database = new DatabaseSync(databasePath, { readOnly: true })
  try {
    return {
      users: database.prepare(
        'SELECT "id", "email", "name", "image", "locale", "timezone", "createdAt", "updatedAt" FROM "User" ORDER BY "id"',
      ).all(),
      workspaces: database.prepare(
        'SELECT "id", "slug", "name", "taskPriorityDisplayStyle", "ownerId", "createdAt", "updatedAt" FROM "Workspace" ORDER BY "id"',
      ).all(),
      memberships: database.prepare(
        'SELECT "id", "workspaceId", "userId", "role", "joinedAt" FROM "WorkspaceMember" ORDER BY "id"',
      ).all(),
      projects: database.prepare(
        'SELECT "id", "workspaceId", "name", "slug", "description", "createdById", "createdAt", "updatedAt" FROM "Project" ORDER BY "id"',
      ).all(),
    }
  } finally {
    database.close()
  }
}

function authState(databasePath: string) {
  const database = new DatabaseSync(databasePath, { readOnly: true })
  try {
    return {
      users: database.prepare(
        'SELECT "id", "email", "normalizedEmail", "authVersion" FROM "User" ORDER BY "id"',
      ).all(),
      credentials: database.prepare(
        'SELECT "id", "userId", "passwordHash", "disabledAt", "passwordCreatedAt", "passwordChangedAt", "createdAt", "updatedAt" FROM "LocalCredential" ORDER BY "userId"',
      ).all(),
      recovery: database.prepare(
        'SELECT "id", "userId", "codeHash", "usedAt", "createdAt" FROM "LocalRecoveryCode" ORDER BY "userId", "id"',
      ).all(),
      setup: database.prepare(
        'SELECT "id", "status", "claimantHash", "claimExpiresAt", "completedAt", "completedById", "createdAt", "updatedAt" FROM "SelfHostSetup"',
      ).all(),
      throttle: database.prepare(
        'SELECT "id", "scope", "subjectKey", "windowStartedAt", "attemptCount", "blockedUntil", "createdAt", "updatedAt" FROM "AuthThrottle" ORDER BY "id"',
      ).all(),
      workspaces: database.prepare(
        'SELECT "id", "ownerId", "slug", "name" FROM "Workspace" ORDER BY "id"',
      ).all(),
      memberships: database.prepare(
        'SELECT "id", "workspaceId", "userId", "role" FROM "WorkspaceMember" ORDER BY "id"',
      ).all(),
    }
  } finally {
    database.close()
  }
}

function selfHostEnv(databasePath: string, attachmentsPath: string) {
  return {
    ...process.env,
    DATABASE_URL: databaseUrl(databasePath),
    PLANGLADE_STORAGE_PROVIDER: "local",
    PLANGLADE_LOCAL_STORAGE_DIR: attachmentsPath,
    NODE_NO_WARNINGS: "1",
  }
}

function runDataCli(operation: "backup" | "restore", args: string[], env: NodeJS.ProcessEnv) {
  return runFile(process.execPath, ["scripts/self-host-data.mjs", operation, ...args], {
    cwd: process.cwd(),
    env,
    windowsHide: true,
  })
}

test("SELF-HOST-AUTH-UPGRADE-RESTORE-001: OAuth installation upgrades, enrolls, restores, and rolls back without identity drift", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "planglade-auth-upgrade-restore-"))
  const preUpgradeDatabase = path.join(root, "pre-upgrade.db")
  const upgradedDatabase = path.join(root, "upgraded.db")
  const restoredDatabase = path.join(root, "restored.db")
  const rollbackDatabase = path.join(root, "rollback.db")
  const preUpgradeAttachments = path.join(root, "pre-upgrade-attachments")
  const upgradedAttachments = path.join(root, "upgraded-attachments")
  const restoredAttachments = path.join(root, "restored-attachments")
  const rollbackAttachments = path.join(root, "rollback-attachments")
  const preUpgradeBundle = path.join(root, "pre-upgrade-bundle")
  const upgradedBundle = path.join(root, "upgraded-bundle")
  const originalEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    PLANGLADE_LOCAL_AUTH_ENABLED: process.env.PLANGLADE_LOCAL_AUTH_ENABLED,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  }
  let applicationDb: { $disconnect(): Promise<void> } | undefined
  let restoredClient: { $disconnect(): Promise<void> } | undefined

  try {
    for (const databasePath of [preUpgradeDatabase, upgradedDatabase, restoredDatabase, rollbackDatabase]) {
      assert.equal(assertIsolatedDatabaseUrl(databaseUrl(databasePath), root), databasePath)
    }

    await applyMigrations(preUpgradeDatabase, PRE_AUTH_MIGRATIONS)
    seedPreAuthInstallation(preUpgradeDatabase)
    await mkdir(preUpgradeAttachments)
    await writeFile(path.join(preUpgradeAttachments, "pre-upgrade.txt"), "pre-upgrade attachment")
    const preUpgradeSnapshot = installationSnapshot(preUpgradeDatabase)
    const preUpgradeHash = await sha256(preUpgradeDatabase)

    await runDataCli(
      "backup",
      [preUpgradeBundle],
      selfHostEnv(preUpgradeDatabase, preUpgradeAttachments),
    )
    assert.equal(await sha256(preUpgradeDatabase), preUpgradeHash, "pre-upgrade backup must not mutate its source")

    await copyFile(preUpgradeDatabase, upgradedDatabase)
    const preflight = await runFile(process.execPath, ["scripts/preflight-local-auth-emails.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl(upgradedDatabase) },
      windowsHide: true,
    })
    assert.match(preflight.stdout, /preflight passed for 3 existing user\(s\)/i)
    assert.equal(preflight.stderr, "")
    assert.doesNotMatch(preflight.stdout, /owner|oauth|example\.com/i)

    await applyMigrations(upgradedDatabase, POST_AUTH_MIGRATIONS)
    assert.equal(
      JSON.stringify(installationSnapshot(upgradedDatabase)) === JSON.stringify(preUpgradeSnapshot),
      true,
      "upgrade must preserve users, workspaces, memberships, ownership, and project data",
    )
    assert.equal(await sha256(preUpgradeDatabase), preUpgradeHash, "upgrade must operate on a copy")

    const migrated = new DatabaseSync(upgradedDatabase, { readOnly: true })
    try {
      const users = migrated.prepare(
        'SELECT "id", "email", "normalizedEmail", "authVersion" FROM "User" ORDER BY "id"',
      ).all() as Array<{ id: string; email: string; normalizedEmail: string; authVersion: number }>
      assert.equal(users.length, 3)
      assert.equal(users.find((user) => user.id === "owner-1")?.email, " Owner+tag@Example.COM ")
      assert.equal(users.find((user) => user.id === "owner-1")?.normalizedEmail, "owner+tag@example.com")
      assert.equal(users.every((user) => user.authVersion === 0), true)
      assert.equal((migrated.prepare('SELECT COUNT(*) AS count FROM "LocalCredential"').get() as { count: number }).count, 0)
      assert.equal((migrated.prepare('SELECT COUNT(*) AS count FROM "LocalRecoveryCode"').get() as { count: number }).count, 0)
      assert.equal((migrated.prepare('SELECT "status" FROM "SelfHostSetup"').get() as { status: string }).status, "COMPLETE")
    } finally {
      migrated.close()
    }

    process.env.DATABASE_URL = databaseUrl(upgradedDatabase)
    process.env.PLANGLADE_LOCAL_AUTH_ENABLED = "true"
    process.env.GOOGLE_CLIENT_ID = "gate-google-client"
    process.env.GOOGLE_CLIENT_SECRET = "gate-google-secret"

    const [{ db }, { getAuthOptions, authorizeLocalCredentials }, recovery, session, identity, password, prisma] = await Promise.all([
      import("../src/lib/db"),
      import("../src/lib/auth-options"),
      import("../src/lib/local-auth-recovery"),
      import("../src/lib/local-auth-session"),
      import("../src/lib/local-auth-identity"),
      import("../src/lib/local-auth-password"),
      import("@prisma/client"),
    ])
    applicationDb = db

    const signIn = getAuthOptions().callbacks?.signIn
    assert.ok(signIn)
    const oauthUser: import("next-auth").User = {
      id: "provider-subject",
      email: "owner+tag@example.com",
      name: "Provider Name",
    }
    assert.equal(await signIn({
      user: oauthUser,
      account: { provider: "google", type: "oauth", providerAccountId: "provider-subject" },
      profile: { email: "owner+tag@example.com", email_verified: true } as import("next-auth").Profile,
    }), true)
    assert.equal(oauthUser.id, "owner-1")
    assert.equal(await db.user.count(), 3)

    const workspaceBeforeEnrollment = await db.workspace.findMany({ orderBy: { id: "asc" } })
    const membershipsBeforeEnrollment = await db.workspaceMember.findMany({ orderBy: { id: "asc" } })
    const enrolled = await recovery.enrollLocalCredential(
      "owner-1",
      "gate-owner-password-long",
      db,
      new Date("2026-07-18T10:00:00.000Z"),
    )
    assert.equal(enrolled.ok, true)
    if (!enrolled.ok) assert.fail("existing OAuth OWNER must be able to enroll")
    assert.equal(await db.user.count(), 3)
    assert.equal(await db.localCredential.count(), 1)
    assert.equal(await db.localRecoveryCode.count({ where: { userId: "owner-1" } }), 10)
    assert.equal(
      JSON.stringify(await db.workspace.findMany({ orderBy: { id: "asc" } })) === JSON.stringify(workspaceBeforeEnrollment),
      true,
    )
    assert.equal(
      JSON.stringify(await db.workspaceMember.findMany({ orderBy: { id: "asc" } })) === JSON.stringify(membershipsBeforeEnrollment),
      true,
    )
    assert.deepEqual(
      await recovery.enrollLocalCredential("owner-1", "different-password-long", db),
      { ok: false, reason: "enrolled" },
    )
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: "oauth-only" }, include: { localCredential: true } })).localCredential, null)

    const localUser = await authorizeLocalCredentials({
      email: " OWNER+TAG@example.com ",
      password: "gate-owner-password-long",
    })
    assert.equal(localUser?.id, "owner-1")
    assert.equal(await db.user.count(), 3)

    const currentVersion = (await db.user.findUniqueOrThrow({ where: { id: "owner-1" } })).authVersion
    assert.equal(currentVersion, 1)
    assert.equal(
      await session.resolveVerifiedNextAuthSessionUser({ user: { id: "owner-1", authVersion: 0 } }, db),
      null,
    )
    assert.equal(
      (await session.resolveVerifiedNextAuthSessionUser({ user: { id: "owner-1", authVersion: 1 } }, db))?.id,
      "owner-1",
    )

    const recoveryRows = await db.localRecoveryCode.findMany({
      where: { userId: "owner-1" },
      orderBy: { id: "asc" },
    })
    const stateTime = new Date("2026-07-18T11:00:00.000Z")
    await db.localRecoveryCode.update({ where: { id: recoveryRows[0].id }, data: { usedAt: stateTime } })
    await db.localCredential.update({ where: { userId: "owner-1" }, data: { disabledAt: stateTime } })
    await db.selfHostSetup.update({ where: { id: "singleton" }, data: { completedById: "owner-1" } })
    await db.authThrottle.create({
      data: {
        id: "gate-throttle",
        scope: "RECOVERY",
        subjectKey: "opaque-gate-subject",
        windowStartedAt: stateTime,
        attemptCount: 2,
        blockedUntil: new Date("2026-07-18T11:05:00.000Z"),
      },
    })
    assert.equal(await authorizeLocalCredentials({
      email: "owner+tag@example.com",
      password: "gate-owner-password-long",
    }), null, "disabled credentials must not authenticate")

    await mkdir(upgradedAttachments)
    await writeFile(path.join(upgradedAttachments, "auth-state.txt"), "restored with authentication state")
    const expectedAuthState = authState(upgradedDatabase)
    const upgradedHash = await sha256(upgradedDatabase)
    await db.$disconnect()
    applicationDb = undefined

    await runDataCli(
      "backup",
      [upgradedBundle],
      selfHostEnv(upgradedDatabase, upgradedAttachments),
    )
    assert.equal(await sha256(upgradedDatabase), upgradedHash, "auth backup must not mutate its source")
    await runDataCli(
      "restore",
      [upgradedBundle, "--confirm-replace"],
      selfHostEnv(restoredDatabase, restoredAttachments),
    )
    assert.equal(
      JSON.stringify(authState(restoredDatabase)) === JSON.stringify(expectedAuthState),
      true,
      "restore must preserve complete auth, workspace, membership, and ownership state",
    )
    assert.equal(await readFile(path.join(restoredAttachments, "auth-state.txt"), "utf8"), "restored with authentication state")

    process.env.DATABASE_URL = databaseUrl(restoredDatabase)
    const restored = new prisma.PrismaClient()
    restoredClient = restored
    const restoredCredential = await restored.localCredential.findUniqueOrThrow({ where: { userId: "owner-1" } })
    assert.equal(await password.verifyPassword("gate-owner-password-long", restoredCredential.passwordHash), true)
    assert.equal(restoredCredential.disabledAt?.toISOString(), stateTime.toISOString())
    assert.equal(await restored.localRecoveryCode.count({ where: { userId: "owner-1", usedAt: null } }), 9)
    assert.equal(await restored.localRecoveryCode.count({ where: { userId: "owner-1", usedAt: { not: null } } }), 1)
    assert.equal((await restored.selfHostSetup.findUniqueOrThrow({ where: { id: "singleton" } })).completedById, "owner-1")
    assert.equal((await restored.authThrottle.findUniqueOrThrow({ where: { id: "gate-throttle" } })).attemptCount, 2)
    assert.equal(
      (await identity.resolveVerifiedApplicationUser({ email: "owner+tag@example.com" }, restored))?.id,
      "owner-1",
    )
    assert.equal(
      await session.resolveVerifiedNextAuthSessionUser({ user: { id: "owner-1", authVersion: 0 } }, restored),
      null,
    )
    assert.equal(
      (await session.resolveVerifiedNextAuthSessionUser({ user: { id: "owner-1", authVersion: 1 } }, restored))?.id,
      "owner-1",
    )
    await restored.$disconnect()
    restoredClient = undefined

    const upgradedHashBeforeRollbackDrill = await sha256(upgradedDatabase)
    await runDataCli(
      "restore",
      [preUpgradeBundle, "--confirm-replace"],
      selfHostEnv(rollbackDatabase, rollbackAttachments),
    )
    assert.equal(
      JSON.stringify(installationSnapshot(rollbackDatabase)) === JSON.stringify(preUpgradeSnapshot),
      true,
      "the pre-auth schema must read the restored pre-upgrade installation unchanged",
    )
    const rollback = new DatabaseSync(rollbackDatabase, { readOnly: true })
    try {
      const userColumns = rollback.prepare('PRAGMA table_info("User")').all() as Array<{ name: string }>
      assert.equal(userColumns.some((column) => column.name === "normalizedEmail"), false)
      assert.equal(userColumns.some((column) => column.name === "authVersion"), false)
      assert.equal((rollback.prepare('SELECT COUNT(*) AS count FROM "Workspace"').get() as { count: number }).count, 2)
      assert.equal((rollback.prepare('SELECT COUNT(*) AS count FROM "WorkspaceMember"').get() as { count: number }).count, 4)
    } finally {
      rollback.close()
    }
    assert.equal(await sha256(preUpgradeDatabase), preUpgradeHash)
    assert.equal(await sha256(upgradedDatabase), upgradedHashBeforeRollbackDrill)
  } finally {
    await applicationDb?.$disconnect()
    await restoredClient?.$disconnect()
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key as keyof typeof originalEnv]
      else process.env[key as keyof typeof originalEnv] = value
    }
    await rm(root, { recursive: true, force: true })
  }
})

test("SELF-HOST-AUTH-UPGRADE-RESTORE-001: real NextAuth secret rotation rejects old JWTs", async () => {
  const { encode, decode } = await import("next-auth/jwt")
  const secretA = "a".repeat(32)
  const secretB = "b".repeat(32)
  const oldToken = await encode({
    token: { userId: "owner-1", authVersion: 1 },
    secret: secretA,
  })
  assert.equal((await decode({ token: oldToken, secret: secretA }))?.userId, "owner-1")
  await assert.rejects(decode({ token: oldToken, secret: secretB }))

  const newToken = await encode({
    token: { userId: "owner-1", authVersion: 1 },
    secret: secretB,
  })
  assert.equal((await decode({ token: newToken, secret: secretB }))?.userId, "owner-1")
})
