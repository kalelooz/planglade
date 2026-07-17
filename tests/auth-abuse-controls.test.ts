import assert from "node:assert/strict"
import { readFile, readdir, rm, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import test from "node:test"
import { NextRequest } from "next/server"

import { createIsolatedTestDatabase } from "./helpers/isolated-test-database"

const migrationName = "20260717010000_auth_throttle_workspace_scope"

test("AUTH-ABUSE-CONTROLS-001: additive throttle migration preserves existing rows", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "planglade-throttle-migration-"))
  const database = new DatabaseSync(path.join(directory, "test.db"))
  try {
    const migrations = (await readdir("prisma/migrations", { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    const migrationIndex = migrations.indexOf(migrationName)
    assert.notEqual(migrationIndex, -1)

    for (const migration of migrations.slice(0, migrationIndex)) {
      database.exec(await readFile(path.join("prisma/migrations", migration, "migration.sql"), "utf8"))
    }
    database.prepare(
      'INSERT INTO "AuthThrottle" ("id", "scope", "subjectKey", "windowStartedAt", "attemptCount", "blockedUntil", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      "existing-throttle",
      "LOGIN_ACCOUNT",
      "opaque-existing-subject",
      "2026-07-16T00:00:00.000Z",
      4,
      "2026-07-16T00:15:00.000Z",
      "2026-07-16T00:00:00.000Z",
      "2026-07-16T00:01:00.000Z",
    )

    database.exec(
      await readFile(path.join("prisma/migrations", migrationName, "migration.sql"), "utf8"),
    )

    const preserved = database.prepare(
      'SELECT "id", "scope", "subjectKey", "attemptCount" FROM "AuthThrottle" WHERE "id" = ?',
    ).get("existing-throttle") as Record<string, unknown>
    assert.deepEqual(
      { ...preserved },
      {
        id: "existing-throttle",
        scope: "LOGIN_ACCOUNT",
        subjectKey: "opaque-existing-subject",
        attemptCount: 4,
      },
    )
    database.prepare(
      'INSERT INTO "AuthThrottle" ("id", "scope", "subjectKey", "windowStartedAt", "updatedAt") VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
    ).run("workspace-throttle", "WORKSPACE_OPERATION", "opaque-workspace-subject")
    assert.throws(
      () => database.prepare(
        'INSERT INTO "AuthThrottle" ("id", "scope", "subjectKey", "windowStartedAt", "updatedAt") VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      ).run("invalid-throttle", "UNTRUSTED_SCOPE", "opaque-invalid-subject"),
      /AuthThrottle scope/i,
    )
  } finally {
    database.close()
    await rm(directory, { recursive: true, force: true })
  }
})

test("AUTH-ABUSE-CONTROLS-001: limiter persists allowance, blocking, expiry, isolation, and cleanup", async () => {
  const isolated = createIsolatedTestDatabase()
  const originalSecret = process.env.PLANGLADE_THROTTLE_SECRET
  process.env.PLANGLADE_THROTTLE_SECRET = "persistent-throttle-test-secret"
  const { PrismaClient } = await import("@prisma/client")
  const {
    consumeSetupThrottle,
    consumeLoginThrottle,
    consumeThrottle,
    deriveThrottleSubjectKey,
    tooManyRequests,
  } = await import("../src/lib/auth-throttle")
  const firstClient = new PrismaClient()
  const secondClient = new PrismaClient()
  const start = new Date("2026-07-17T00:00:00.000Z")
  const policy = { limit: 2, windowMs: 60_000, blockMs: 120_000 }
  const protectedSubject = ["export", "actor-1", "workspace-1"]

  try {
    const expiredSetupKey = deriveThrottleSubjectKey(
      "SETUP",
      ["complete", "expired"],
      "persistent-throttle-test-secret",
    )
    await firstClient.authThrottle.create({
      data: {
        scope: "SETUP",
        subjectKey: expiredSetupKey,
        windowStartedAt: new Date(start.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
    })
    assert.deepEqual(
      await consumeThrottle(
        { scope: "WORKSPACE_OPERATION", subject: protectedSubject, policy, now: start },
        firstClient,
      ),
      { allowed: true },
    )
    assert.equal(
      await secondClient.authThrottle.count({
        where: { scope: "SETUP", subjectKey: expiredSetupKey },
      }),
      0,
    )
    assert.deepEqual(
      await consumeThrottle(
        { scope: "WORKSPACE_OPERATION", subject: protectedSubject, policy, now: start },
        secondClient,
      ),
      { allowed: true },
    )
    const blocked = await consumeThrottle(
      { scope: "WORKSPACE_OPERATION", subject: protectedSubject, policy, now: start },
      firstClient,
    )
    assert.deepEqual(blocked, { allowed: false, retryAfterSeconds: 120 })
    if (blocked.allowed) assert.fail("third request must be blocked")
    const response = tooManyRequests(blocked)
    assert.equal(response.status, 429)
    assert.equal(response.headers.get("retry-after"), "120")
    assert.deepEqual(await response.json(), { error: "Too many requests" })

    assert.deepEqual(
      await consumeThrottle(
        {
          scope: "WORKSPACE_OPERATION",
          subject: ["export", "actor-2", "workspace-1"],
          policy,
          now: start,
        },
        secondClient,
      ),
      { allowed: true },
    )
    assert.deepEqual(
      await consumeThrottle(
        {
          scope: "WORKSPACE_OPERATION",
          subject: ["import", "actor-1", "workspace-1"],
          policy,
          now: start,
        },
        secondClient,
      ),
      { allowed: true },
    )

    const stored = await secondClient.authThrottle.findMany()
    assert.ok(stored.length >= 3)
    assert.equal(stored.some((row) => row.subjectKey.includes("actor-1")), false)
    assert.equal(
      stored.some((row) => row.subjectKey === deriveThrottleSubjectKey(
        "WORKSPACE_OPERATION",
        protectedSubject,
        "persistent-throttle-test-secret",
      )),
      true,
    )

    assert.deepEqual(
      await consumeThrottle(
        {
          scope: "WORKSPACE_OPERATION",
          subject: protectedSubject,
          policy,
          now: new Date(start.getTime() + 121_000),
        },
        secondClient,
      ),
      { allowed: true },
    )

    for (const rotatedInvalidGuess of ["guess-a", "guess-b", "guess-c", "guess-d", "guess-e"]) {
      assert.match(rotatedInvalidGuess, /^guess-/)
      assert.deepEqual(await consumeSetupThrottle("claim", undefined, firstClient, start), {
        allowed: true,
      })
    }
    assert.deepEqual(await consumeSetupThrottle("claim", undefined, secondClient, start), {
      allowed: false,
      retryAfterSeconds: 900,
    })

    for (const expected of Array(5).fill({ allowed: true })) {
      assert.deepEqual(
        await consumeLoginThrottle("person@example.com", firstClient, start),
        expected,
      )
    }
    assert.deepEqual(
      await consumeLoginThrottle("person@example.com", secondClient, start),
      { allowed: false, retryAfterSeconds: 900 },
    )
    const { postNextAuthRequest } = await import("../src/app/api/auth/[...nextauth]/route")
    let downstreamCalled = false
    const loginResponse = await postNextAuthRequest(
      new NextRequest("http://localhost/api/auth/callback/credentials", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email: "PERSON@example.com", password: "not-used" }),
      }),
      { params: { nextauth: ["callback", "credentials"] } } as never,
      async (account) => {
        assert.equal(account, "person@example.com")
        return { allowed: false, retryAfterSeconds: 900 }
      },
      (async () => {
        downstreamCalled = true
        return new Response(null, { status: 500 })
      }) as never,
    )
    assert.equal(loginResponse.status, 429)
    assert.equal(loginResponse.headers.get("retry-after"), "900")
    assert.deepEqual(await loginResponse.json(), { error: "Too many requests" })
    assert.equal(downstreamCalled, false)

    const passThrough = await postNextAuthRequest(
      new NextRequest("http://localhost/api/auth/callback/credentials", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email: "person@example.com", password: "still-present" }),
      }),
      { params: { nextauth: ["callback", "credentials"] } } as never,
      async () => ({ allowed: true }),
      (async (request: NextRequest) => {
        const form = await request.formData()
        return Response.json({ password: form.get("password") })
      }) as never,
    )
    assert.deepEqual(await passThrough.json(), { password: "still-present" })
  } finally {
    await Promise.all([firstClient.$disconnect(), secondClient.$disconnect()])
    if (originalSecret === undefined) delete process.env.PLANGLADE_THROTTLE_SECRET
    else process.env.PLANGLADE_THROTTLE_SECRET = originalSecret
    await isolated.cleanup()
  }
})

test("AUTH-ABUSE-CONTROLS-001: sensitive routes use trusted subjects without forwarding headers", async () => {
  const files = await Promise.all([
    "src/lib/auth-throttle.ts",
    "src/app/api/auth/[...nextauth]/route.ts",
    "src/app/api/auth/setup/claim/route.ts",
    "src/app/api/auth/setup/complete/route.ts",
    "src/app/api/workspace/invitations/route.ts",
    "src/app/api/workspace/invitations/test-send/route.ts",
    "src/app/api/workspace/import-preview/route.ts",
    "src/app/api/workspace/import-local/route.ts",
    "src/app/api/workspace/export/route.ts",
    "src/app/api/attachments/route.ts",
    "src/app/api/attachments/upload-url/route.ts",
    "src/app/api/attachments/upload-binary/route.ts",
    "src/app/api/attachments/[attachmentId]/download-url/route.ts",
  ].map((file) => readFile(file, "utf8")))
  const combined = files.join("\n")

  assert.doesNotMatch(combined, /x-forwarded-for|forwarded-for|request\.ip/i)
  assert.match(files[1], /callback\/credentials[\s\S]*throttleLogin[\s\S]*nextHandler\(request, context\)/)
  assert.match(files[2], /const throttle = await consumeSetupThrottle\("claim"\)[\s\S]*authorizeSetupToken/)
  assert.match(files[3], /const throttle = await consumeSetupThrottle\("complete", claimant\)[\s\S]*const result = await complete/)
  for (const source of files.slice(4, 13)) {
    assert.match(source, /consume(?:Workspace|SignedUpload)Throttle/)
  }
  await assert.rejects(readdir("src/app/api/auth/recovery"), /ENOENT/)
})
