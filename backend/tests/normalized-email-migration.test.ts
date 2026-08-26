import assert from "node:assert/strict"
import test, { after, before, beforeEach } from "node:test"

import { createIsolatedTestDatabase } from "./helpers/isolated-test-database"

const isolatedDatabase = createIsolatedTestDatabase()
let client: import("@prisma/client").PrismaClient
let migrateNormalizedAuthEmails: typeof import("../scripts/migrate-normalized-auth-emails.mjs").migrateNormalizedAuthEmails

before(async () => {
  const { PrismaClient } = await import("@prisma/client")
  ;({ migrateNormalizedAuthEmails } = await import("../scripts/migrate-normalized-auth-emails.mjs"))
  client = new PrismaClient()
})

beforeEach(async () => {
  await client.$executeRawUnsafe('DROP TRIGGER IF EXISTS "fail_normalized_email_update"')
  await client.user.deleteMany()
})

after(async () => {
  await client.$disconnect()
  await isolatedDatabase.cleanup()
})

test("preflight and migration use application normalization, backfill transactionally, and verify completion", async () => {
  await client.user.createMany({
    data: [
      { id: "mixed-case", email: "  Person@Example.COM " },
      { id: "plus-address", email: "Name+tag.Example@Example.COM" },
    ],
  })

  assert.deepEqual(
    await migrateNormalizedAuthEmails(client, { preflightOnly: true }),
    { checked: 2, pending: 2, updated: 0 },
  )
  assert.equal(await client.user.count({ where: { normalizedEmail: null } }), 2)

  assert.deepEqual(
    await migrateNormalizedAuthEmails(client),
    { checked: 2, pending: 0, updated: 2 },
  )
  assert.deepEqual(
    await client.user.findMany({ orderBy: { id: "asc" }, select: { id: true, normalizedEmail: true } }),
    [
      { id: "mixed-case", normalizedEmail: "person@example.com" },
      { id: "plus-address", normalizedEmail: "name+tag.example@example.com" },
    ],
  )
  assert.deepEqual(
    await migrateNormalizedAuthEmails(client, { checkOnly: true }),
    { checked: 2, pending: 0, updated: 0 },
  )
  assert.deepEqual(await migrateNormalizedAuthEmails(client), { checked: 2, pending: 0, updated: 0 })
})

test("invalid legacy emails are reported before any row is mutated", async () => {
  await client.user.createMany({
    data: [
      { id: "invalid", email: "not-an-email" },
      { id: "valid", email: "valid@example.com" },
    ],
  })

  await assert.rejects(
    migrateNormalizedAuthEmails(client),
    /Invalid legacy email for user ID "invalid"/,
  )
  assert.equal(await client.user.count({ where: { normalizedEmail: null } }), 2)
})

test("normalization collisions are reported before any row is mutated", async () => {
  await client.user.createMany({
    data: [
      { id: "collision-a", email: "person@example.com", normalizedEmail: "person@example.com" },
      { id: "collision-b", email: " PERSON@EXAMPLE.COM " },
      { id: "valid", email: "valid@example.com" },
    ],
  })

  await assert.rejects(
    migrateNormalizedAuthEmails(client),
    /Normalization collision for "person@example.com": user IDs "collision-a", "collision-b"/,
  )
  assert.equal(await client.user.count({ where: { normalizedEmail: null } }), 2)
})

test("database failures roll back every normalized-email update", async () => {
  await client.user.createMany({
    data: [
      { id: "rollback-a", email: "first@example.com" },
      { id: "rollback-b", email: "second@example.com" },
    ],
  })
  await client.$executeRawUnsafe(`
    CREATE TRIGGER "fail_normalized_email_update"
    BEFORE UPDATE OF "normalizedEmail" ON "User"
    WHEN NEW."id" = 'rollback-b'
    BEGIN
      SELECT RAISE(ABORT, 'simulated normalized-email write failure');
    END
  `)

  await assert.rejects(migrateNormalizedAuthEmails(client))
  assert.equal(await client.user.count({ where: { normalizedEmail: null } }), 2)
})

test("verification fails while any transitional row remains", async () => {
  await client.user.create({ data: { id: "pending", email: "pending@example.com" } })

  await assert.rejects(
    migrateNormalizedAuthEmails(client, { checkOnly: true }),
    /1 user\(s\) still have no normalized email/,
  )
  assert.equal((await client.user.findUniqueOrThrow({ where: { id: "pending" } })).normalizedEmail, null)
})
