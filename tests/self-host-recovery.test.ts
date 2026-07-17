import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { promisify } from "node:util"

import { createIsolatedTestDatabase } from "./helpers/isolated-test-database"

const runFile = promisify(execFile)

test("SELF-HOST-AUTH-RECOVERY-001: OWNER enrollment and recovery rotate secrets and sessions", async () => {
  const isolated = createIsolatedTestDatabase()
  const originalSecret = process.env.PLANGLADE_THROTTLE_SECRET
  process.env.PLANGLADE_THROTTLE_SECRET = "self-host-recovery-test-secret"
  const { PrismaClient } = await import("@prisma/client")
  const {
    ADMIN_RECOVERY_SECONDS,
    enrollLocalCredential,
    getLocalCredentialEnrollmentStatus,
    hashAdminRecoveryToken,
    recoverLocalCredential,
  } = await import("../src/lib/local-auth-recovery")
  const { verifyPassword } = await import("../src/lib/local-auth-password")
  const client = new PrismaClient()
  const now = new Date("2026-07-17T12:00:00.000Z")

  try {
    await client.user.create({
      data: { id: "owner-1", email: "owner@example.com", normalizedEmail: "owner@example.com" },
    })
    await client.user.create({
      data: { id: "user-2", email: "member@example.com", normalizedEmail: "member@example.com" },
    })
    await client.workspace.create({
      data: { id: "workspace-1", slug: "workspace-1", name: "Workspace", ownerId: "owner-1" },
    })
    await client.workspaceMember.create({
      data: { workspaceId: "workspace-1", userId: "owner-1", role: "OWNER" },
    })

    assert.equal(await getLocalCredentialEnrollmentStatus("owner-1", client), "available")
    assert.equal(await getLocalCredentialEnrollmentStatus("user-2", client), "owner-required")
    assert.deepEqual(
      await enrollLocalCredential("user-2", "member-password-long", client, now),
      { ok: false, reason: "owner-required" },
    )

    const enrolled = await enrollLocalCredential("owner-1", "owner-password-long", client, now)
    assert.equal(enrolled.ok, true)
    if (!enrolled.ok) assert.fail("OWNER enrollment must succeed")
    assert.equal(enrolled.recoveryCodes.length, 10)
    assert.equal(await getLocalCredentialEnrollmentStatus("owner-1", client), "enrolled")
    assert.equal((await client.user.findUniqueOrThrow({ where: { id: "owner-1" } })).authVersion, 1)
    const enrolledCredential = await client.localCredential.findUniqueOrThrow({ where: { userId: "owner-1" } })
    assert.equal(await verifyPassword("owner-password-long", enrolledCredential.passwordHash), true)

    const recovered = await recoverLocalCredential(
      enrolled.recoveryCodes[0],
      "recovered-password-long",
      client,
      new Date(now.getTime() + 1000),
    )
    assert.equal(recovered.ok, true)
    if (!recovered.ok) assert.fail("permanent recovery code must work")
    assert.equal(recovered.recoveryCodes.length, 10)
    assert.deepEqual(
      await recoverLocalCredential(
        enrolled.recoveryCodes[0],
        "replay-password-long",
        client,
        new Date(now.getTime() + 2000),
      ),
      { ok: false, reason: "invalid" },
    )
    assert.equal((await client.user.findUniqueOrThrow({ where: { id: "owner-1" } })).authVersion, 2)
    const recoveredCredential = await client.localCredential.findUniqueOrThrow({ where: { userId: "owner-1" } })
    assert.equal(await verifyPassword("recovered-password-long", recoveredCredential.passwordHash), true)

    const expiredToken = `r1.${"a".repeat(43)}`
    await client.localRecoveryCode.create({
      data: {
        id: "expired-admin-grant",
        userId: "owner-1",
        codeHash: hashAdminRecoveryToken(expiredToken),
        createdAt: new Date(now.getTime() - ADMIN_RECOVERY_SECONDS * 1000),
      },
    })
    assert.deepEqual(
      await recoverLocalCredential(expiredToken, "expired-password-long", client, now),
      { ok: false, reason: "invalid" },
    )

    const issued = await runFile(
      process.execPath,
      ["scripts/create-local-recovery-link.mjs", "owner@example.com"],
      {
        cwd: process.cwd(),
        env: { ...process.env, NEXTAUTH_URL: "http://localhost:3000" },
      },
    )
    assert.equal(issued.stderr, "")
    assert.match(issued.stdout, /http:\/\/localhost:3000\/recover#r1\.[A-Za-z0-9_-]{43}/)
    assert.doesNotMatch(issued.stdout, /\/recover\?[^\n]*token/)
    const adminToken = issued.stdout.match(/#(r1\.[A-Za-z0-9_-]{43})/)?.[1]
    assert.ok(adminToken)
    const issuedGrant = await client.localRecoveryCode.findFirstOrThrow({
      where: { userId: "owner-1", codeHash: { startsWith: "admin:v1:" } },
    })
    await client.localRecoveryCode.update({ where: { id: issuedGrant.id }, data: { createdAt: now } })
    const adminRecovered = await recoverLocalCredential(
      adminToken,
      "admin-recovered-password-long",
      client,
      new Date(now.getTime() + 1000),
    )
    assert.equal(adminRecovered.ok, true)
    assert.deepEqual(
      await recoverLocalCredential(
        adminToken,
        "admin-replay-password-long",
        client,
        new Date(now.getTime() + 2000),
      ),
      { ok: false, reason: "invalid" },
    )
    assert.equal((await client.user.findUniqueOrThrow({ where: { id: "owner-1" } })).authVersion, 3)
    assert.equal(await client.user.count(), 2)
    assert.equal(await client.workspace.count(), 1)
    assert.equal(await client.workspaceMember.count({ where: { role: "OWNER" } }), 1)
  } finally {
    await client.$disconnect()
    if (originalSecret === undefined) delete process.env.PLANGLADE_THROTTLE_SECRET
    else process.env.PLANGLADE_THROTTLE_SECRET = originalSecret
    await isolated.cleanup()
  }
})

test("SELF-HOST-AUTH-RECOVERY-001: recovery boundary is throttled and never accepts identity input", async () => {
  const [route, enrollment, service, script] = await Promise.all([
    readFile("src/app/api/auth/recovery/route.ts", "utf8"),
    readFile("src/app/api/auth/local-credential/route.ts", "utf8"),
    readFile("src/lib/local-auth-recovery.ts", "utf8"),
    readFile("scripts/create-local-recovery-link.mjs", "utf8"),
  ])

  assert.match(route, /consumeRecoveryThrottle/)
  assert.doesNotMatch(route, /searchParams|workspaceId|userId|email|console\./)
  assert.match(enrollment, /resolveRequestActorUserId[\s\S]*getLocalCredentialEnrollmentStatus/)
  assert.match(service, /memberships: \{ where: \{ role: "OWNER" \}/)
  assert.match(service, /authVersion: \{ increment: 1 \}/)
  assert.match(service, /usedAt: null[\s\S]*updateMany[\s\S]*usedAt: now/)
  assert.match(script, /codeHash: \{ startsWith: ADMIN_RECOVERY_PREFIX \}/)
  assert.match(script, /\/recover#\$\{token\}/)
  assert.doesNotMatch(script, /\/recover\?[^"'`]*token/)
})
