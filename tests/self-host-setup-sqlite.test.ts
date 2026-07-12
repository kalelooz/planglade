import assert from "node:assert/strict"
import test from "node:test"

import { createIsolatedTestDatabase } from "./helpers/isolated-test-database"

const clock = (preflightNow: Date, transactionNow = preflightNow) => ({
  preflightNow: () => preflightNow,
  transactionNow: () => transactionNow,
})

test("real SQLite permits one claimant and atomically creates one installation", async () => {
  const isolated = createIsolatedTestDatabase()
  const previous = process.env.DATABASE_URL
  const { PrismaClient } = await import("@prisma/client")
  const { claimSetup, completeSetup, resolveSetupEligibility } = await import("../src/lib/self-host-setup/service")
  const first = new PrismaClient(), second = new PrismaClient()
  try {
    assert.equal(await resolveSetupEligibility(first), "eligible")
    const claims = await Promise.all([claimSetup(new Date(), first), claimSetup(new Date(), second)])
    assert.equal(claims.filter((claim) => claim.ok).length, 1)
    const winner = claims.find((claim) => claim.ok)
    assert.ok(winner?.ok)
    assert.equal(await resolveSetupEligibility(first), "actively_claimed")

    const input = { email: "owner@example.com", name: "Owner", password: "correct horse battery staple", workspaceName: "My Workspace" }
    for (const stage of ["user", "credential", "recovery", "workspace", "membership", "complete"] as const) {
      const failed = await completeSetup(input, winner.secret, clock(new Date()), first, (write) => {
        if (write === stage) throw new Error("injected rollback")
      })
      assert.equal(failed.ok, false)
      assert.deepEqual(await Promise.all([
        first.user.count(), first.localCredential.count(), first.localRecoveryCode.count(), first.workspace.count(), first.workspaceMember.count(),
      ]), [0, 0, 0, 0, 0])
    }
    const completions = await Promise.all([
      completeSetup(input, winner.secret, clock(new Date()), first),
      completeSetup(input, winner.secret, clock(new Date()), second),
    ])
    assert.equal(completions.filter((result) => result.ok).length, 1)
    assert.deepEqual(await Promise.all([
      first.user.count(), first.localCredential.count(), first.localRecoveryCode.count(),
      first.workspace.count(), first.workspaceMember.count({ where: { role: "OWNER" } }),
      first.selfHostSetup.count({ where: { status: "COMPLETE", claimantHash: null, claimExpiresAt: null } }),
    ]), [1, 1, 10, 1, 1, 1])
    const stored = await first.localRecoveryCode.findMany({ select: { codeHash: true } })
    assert.ok(stored.every(({ codeHash }) => /^[0-9a-f]{64}$/.test(codeHash)))
    assert.equal(completions.filter((result) => result.ok).length, 1, "a retry cannot replay recovery codes")
  } finally {
    await Promise.allSettled([first.$disconnect(), second.$disconnect()])
    if (previous) process.env.DATABASE_URL = previous
    else delete process.env.DATABASE_URL
    await isolated.cleanup()
  }
})

test("expired claims reopen only an otherwise empty installation", async () => {
  const isolated = createIsolatedTestDatabase()
  const { PrismaClient } = await import("@prisma/client")
  const { completeSetup, resolveSetupEligibility } = await import("../src/lib/self-host-setup/service")
  const client = new PrismaClient()
  const expired = new Date(Date.now() - 60_000)
  try {
    const { sha256Hex } = await import("../src/lib/self-host-setup/security")
    await client.selfHostSetup.update({ where: { id: "singleton" }, data: { status: "IN_PROGRESS", claimantHash: sha256Hex("claimant"), claimExpiresAt: expired } })
    const expiredEmpty = await completeSetup({ email: "owner@example.com", name: "Owner", password: "correct horse battery staple", workspaceName: "Workspace" }, "claimant", clock(new Date()), client)
    assert.deepEqual(expiredEmpty, { ok: false, reason: "expired" })
    assert.equal((await client.selfHostSetup.findUniqueOrThrow({ where: { id: "singleton" } })).status, "AVAILABLE")

    await client.selfHostSetup.update({ where: { id: "singleton" }, data: { status: "IN_PROGRESS", claimantHash: sha256Hex("claimant"), claimExpiresAt: expired } })
    await client.user.create({ data: { email: "collision@example.com", normalizedEmail: "collision@example.com" } })
    const blocked = await completeSetup({ email: "owner@example.com", name: "Owner", password: "correct horse battery staple", workspaceName: "Workspace" }, "claimant", clock(new Date()), client)
    assert.deepEqual(blocked, { ok: false, reason: "expired" })
    assert.equal((await client.selfHostSetup.findUniqueOrThrow({ where: { id: "singleton" } })).status, "IN_PROGRESS")
    assert.equal(await resolveSetupEligibility(client), "blocked")
  } finally {
    await client.$disconnect()
    await isolated.cleanup()
  }
})

test("completion preflight rejects cheap failures before preparation and transaction rechecks stale claims", async () => {
  const isolated = createIsolatedTestDatabase()
  const { PrismaClient } = await import("@prisma/client")
  const service = await import("../src/lib/self-host-setup/service")
  const { sha256Hex } = await import("../src/lib/self-host-setup/security")
  const client = new PrismaClient()
  const claimant = "active-claimant"
  const future = new Date(Date.now() + 15 * 60_000)
  const input = { email: "owner@example.com", name: "Owner", password: "correct horse battery staple", workspaceName: "Workspace" }
  let preparations = 0
  const prepare = async (value: typeof input) => {
    preparations += 1
    return service.prepareSetupCompletion(value)
  }
  try {
    await client.selfHostSetup.update({ where: { id: "singleton" }, data: { status: "IN_PROGRESS", claimantHash: sha256Hex(claimant), claimExpiresAt: future } })

    assert.deepEqual(await service.completeSetup(input, "wrong-claimant", clock(new Date()), client, undefined, prepare), { ok: false, reason: "invalid" })
    assert.equal(preparations, 0)

    await client.selfHostSetup.update({ where: { id: "singleton" }, data: { status: "COMPLETE", completedAt: new Date(), claimantHash: null, claimExpiresAt: null } })
    assert.deepEqual(await service.completeSetup(input, claimant, clock(new Date()), client, undefined, prepare), { ok: false, reason: "unavailable" })
    assert.equal(preparations, 0)

    await client.selfHostSetup.update({ where: { id: "singleton" }, data: { status: "IN_PROGRESS", completedAt: null, claimantHash: sha256Hex(claimant), claimExpiresAt: new Date(Date.now() - 1) } })
    assert.deepEqual(await service.completeSetup(input, claimant, clock(new Date()), client, undefined, prepare), { ok: false, reason: "expired" })
    assert.equal(preparations, 0)

    await client.selfHostSetup.update({ where: { id: "singleton" }, data: { status: "IN_PROGRESS", claimantHash: sha256Hex(claimant), claimExpiresAt: future } })
    await client.user.create({ data: { email: "blocked@example.com", normalizedEmail: "blocked@example.com" } })
    assert.deepEqual(await service.completeSetup(input, claimant, clock(new Date()), client, undefined, prepare), { ok: false, reason: "conflict" })
    assert.equal(preparations, 0)
    await client.user.deleteMany()

    const failingClient = { $transaction: async () => { throw new Error("C:\\private\\database.db PRISMA_MARKER STACK_MARKER") } }
    assert.deepEqual(await service.completeSetup(input, claimant, clock(new Date()), failingClient as never, undefined, prepare), { ok: false, reason: "temporary" })
    assert.equal(preparations, 0)

    await client.selfHostSetup.update({ where: { id: "singleton" }, data: { status: "IN_PROGRESS", claimantHash: sha256Hex(claimant), claimExpiresAt: future } })
    const stale = await service.completeSetup(input, claimant, clock(new Date()), client, undefined, async (value) => {
      const prepared = await prepare(value)
      await client.selfHostSetup.update({ where: { id: "singleton" }, data: { status: "AVAILABLE", claimantHash: null, claimExpiresAt: null } })
      return prepared
    })
    assert.deepEqual(stale, { ok: false, reason: "unavailable" })
    assert.equal(preparations, 1)
    assert.equal(await client.user.count(), 0)
  } finally {
    await client.$disconnect()
    await isolated.cleanup()
  }
})

test("completion rejects a claim that expires during preparation without persisting prepared data", async () => {
  const isolated = createIsolatedTestDatabase()
  const { PrismaClient } = await import("@prisma/client")
  const service = await import("../src/lib/self-host-setup/service")
  const { sha256Hex } = await import("../src/lib/self-host-setup/security")
  const client = new PrismaClient()
  const claimant = "expiring-claimant"
  const preflightNow = new Date("2026-01-01T00:00:00.000Z")
  const expiresAt = new Date("2026-01-01T00:01:00.000Z")
  const transactionNow = new Date("2026-01-01T00:02:00.000Z")
  const input = { email: "owner@example.com", name: "Owner", password: "correct horse battery staple", workspaceName: "Workspace" }
  let preparations = 0
  try {
    await client.selfHostSetup.update({ where: { id: "singleton" }, data: { status: "IN_PROGRESS", claimantHash: sha256Hex(claimant), claimExpiresAt: expiresAt } })
    const result = await service.completeSetup(input, claimant, clock(preflightNow, transactionNow), client, undefined, async (value) => {
      preparations += 1
      return service.prepareSetupCompletion(value)
    })

    assert.deepEqual(result, { ok: false, reason: "expired" })
    assert.equal(preparations, 1)
    assert.deepEqual(await Promise.all([
      client.user.count(), client.localCredential.count(), client.localRecoveryCode.count(), client.workspace.count(),
      client.workspaceMember.count(), client.selfHostSetup.count({ where: { status: "COMPLETE" } }),
    ]), [0, 0, 0, 0, 0, 0])
    assert.deepEqual(await client.selfHostSetup.findUniqueOrThrow({ where: { id: "singleton" }, select: { status: true, claimantHash: true, claimExpiresAt: true, completedAt: true, completedById: true } }), {
      status: "AVAILABLE", claimantHash: null, claimExpiresAt: null, completedAt: null, completedById: null,
    })
  } finally {
    await client.$disconnect()
    await isolated.cleanup()
  }
})

test("completion stores the authoritative transaction time", async () => {
  const isolated = createIsolatedTestDatabase()
  const { PrismaClient } = await import("@prisma/client")
  const service = await import("../src/lib/self-host-setup/service")
  const { sha256Hex } = await import("../src/lib/self-host-setup/security")
  const client = new PrismaClient()
  const claimant = "successful-claimant"
  const preflightNow = new Date("2026-01-01T00:00:00.000Z")
  const transactionNow = new Date("2026-01-01T00:01:00.000Z")
  const expiresAt = new Date("2026-01-01T00:02:00.000Z")
  try {
    await client.selfHostSetup.update({ where: { id: "singleton" }, data: { status: "IN_PROGRESS", claimantHash: sha256Hex(claimant), claimExpiresAt: expiresAt } })
    const result = await service.completeSetup(
      { email: "owner@example.com", name: "Owner", password: "correct horse battery staple", workspaceName: "Workspace" },
      claimant, clock(preflightNow, transactionNow), client,
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.recoveryCodes.length, 10)
    const setup = await client.selfHostSetup.findUniqueOrThrow({ where: { id: "singleton" } })
    assert.equal(setup.completedAt?.toISOString(), transactionNow.toISOString())
    assert.notEqual(setup.completedAt?.toISOString(), preflightNow.toISOString())
    assert.equal(setup.status, "COMPLETE")
    assert.equal(setup.claimantHash, null)
    assert.equal(setup.claimExpiresAt, null)
    assert.deepEqual(await Promise.all([
      client.user.count(), client.localCredential.count(), client.localRecoveryCode.count(), client.workspace.count(),
      client.workspaceMember.count({ where: { role: "OWNER" } }),
    ]), [1, 1, 10, 1, 1])
  } finally {
    await client.$disconnect()
    await isolated.cleanup()
  }
})

test("expiry during preparation remains fail-closed when blocking evidence appears", async () => {
  const isolated = createIsolatedTestDatabase()
  const { PrismaClient } = await import("@prisma/client")
  const service = await import("../src/lib/self-host-setup/service")
  const { sha256Hex } = await import("../src/lib/self-host-setup/security")
  const client = new PrismaClient()
  const claimant = "blocked-expiring-claimant"
  const preflightNow = new Date("2026-01-01T00:00:00.000Z")
  const transactionNow = new Date("2026-01-01T00:02:00.000Z")
  try {
    await client.selfHostSetup.update({ where: { id: "singleton" }, data: { status: "IN_PROGRESS", claimantHash: sha256Hex(claimant), claimExpiresAt: new Date("2026-01-01T00:01:00.000Z") } })
    const result = await service.completeSetup(
      { email: "owner@example.com", name: "Owner", password: "correct horse battery staple", workspaceName: "Workspace" },
      claimant, clock(preflightNow, transactionNow), client, undefined, async (value) => {
        const prepared = await service.prepareSetupCompletion(value)
        await client.user.create({ data: { id: "blocking-user", email: "blocked@example.com", normalizedEmail: "blocked@example.com" } })
        return prepared
      },
    )

    assert.deepEqual(result, { ok: false, reason: "expired" })
    const setup = await client.selfHostSetup.findUniqueOrThrow({ where: { id: "singleton" } })
    assert.equal(setup.status, "IN_PROGRESS")
    assert.equal(setup.claimantHash, sha256Hex(claimant))
    assert.equal(await client.user.count(), 1)
    assert.equal((await client.user.findUniqueOrThrow({ where: { id: "blocking-user" } })).email, "blocked@example.com")
    assert.deepEqual(await Promise.all([
      client.localCredential.count(), client.localRecoveryCode.count(), client.workspace.count(), client.workspaceMember.count(),
    ]), [0, 0, 0, 0])
  } finally {
    await client.$disconnect()
    await isolated.cleanup()
  }
})
