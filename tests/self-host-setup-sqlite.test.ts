import assert from "node:assert/strict"
import test from "node:test"

import { createIsolatedTestDatabase } from "./helpers/isolated-test-database"

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
      const failed = await completeSetup(input, winner.secret, new Date(), first, (write) => {
        if (write === stage) throw new Error("injected rollback")
      })
      assert.equal(failed.ok, false)
      assert.deepEqual(await Promise.all([
        first.user.count(), first.localCredential.count(), first.localRecoveryCode.count(), first.workspace.count(), first.workspaceMember.count(),
      ]), [0, 0, 0, 0, 0])
    }
    const completions = await Promise.all([
      completeSetup(input, winner.secret, new Date(), first),
      completeSetup(input, winner.secret, new Date(), second),
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
    const expiredEmpty = await completeSetup({ email: "owner@example.com", name: "Owner", password: "correct horse battery staple", workspaceName: "Workspace" }, "claimant", new Date(), client)
    assert.deepEqual(expiredEmpty, { ok: false, reason: "expired" })
    assert.equal((await client.selfHostSetup.findUniqueOrThrow({ where: { id: "singleton" } })).status, "AVAILABLE")

    await client.selfHostSetup.update({ where: { id: "singleton" }, data: { status: "IN_PROGRESS", claimantHash: sha256Hex("claimant"), claimExpiresAt: expired } })
    await client.user.create({ data: { email: "collision@example.com", normalizedEmail: "collision@example.com" } })
    const blocked = await completeSetup({ email: "owner@example.com", name: "Owner", password: "correct horse battery staple", workspaceName: "Workspace" }, "claimant", new Date(), client)
    assert.deepEqual(blocked, { ok: false, reason: "expired" })
    assert.equal((await client.selfHostSetup.findUniqueOrThrow({ where: { id: "singleton" } })).status, "IN_PROGRESS")
    assert.equal(await resolveSetupEligibility(client), "blocked")
  } finally {
    await client.$disconnect()
    await isolated.cleanup()
  }
})
