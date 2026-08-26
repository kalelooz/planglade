import { pathToFileURL } from "node:url"

import { PrismaClient } from "@prisma/client"

import { normalizeEmail } from "../src/lib/local-auth-email.mjs"

export class NormalizedEmailMigrationError extends Error {
  constructor(issues) {
    super(["Normalized-email migration blocked. No email data was changed.", ...issues].join("\n"))
    this.name = "NormalizedEmailMigrationError"
  }
}

export function inspectNormalizedEmailUsers(users) {
  const invalidUserIds = []
  const mismatches = []
  const usersByNormalizedEmail = new Map()
  const updates = []

  for (const user of users) {
    const expected = normalizeEmail(user.email)
    if (!expected) {
      invalidUserIds.push(user.id)
      continue
    }

    const matchingUsers = usersByNormalizedEmail.get(expected) ?? []
    matchingUsers.push(user.id)
    usersByNormalizedEmail.set(expected, matchingUsers)

    if (user.normalizedEmail === null) updates.push({ id: user.id, normalizedEmail: expected })
    else if (user.normalizedEmail !== expected) {
      mismatches.push({ id: user.id, actual: user.normalizedEmail, expected })
    }
  }

  const collisions = [...usersByNormalizedEmail]
    .filter(([, userIds]) => userIds.length > 1)
    .map(([normalizedEmail, userIds]) => ({ normalizedEmail, userIds }))

  const issues = [
    ...invalidUserIds.map((id) => `Invalid legacy email for user ID ${JSON.stringify(id)}.`),
    ...collisions.map(({ normalizedEmail, userIds }) => (
      `Normalization collision for ${JSON.stringify(normalizedEmail)}: user IDs ${userIds.map((id) => JSON.stringify(id)).join(", ")}.`
    )),
    ...mismatches.map(({ id, actual, expected }) => (
      `Stored normalized email mismatch for user ID ${JSON.stringify(id)}: found ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}.`
    )),
  ]

  return { issues, updates }
}

export async function migrateNormalizedAuthEmails(prisma, { checkOnly = false, preflightOnly = false } = {}) {
  return prisma.$transaction(async (tx) => {
    const users = await tx.user.findMany({
      orderBy: { id: "asc" },
      select: { id: true, email: true, normalizedEmail: true },
    })
    const plan = inspectNormalizedEmailUsers(users)
    if (plan.issues.length > 0) throw new NormalizedEmailMigrationError(plan.issues)

    if (preflightOnly) return { checked: users.length, pending: plan.updates.length, updated: 0 }
    if (checkOnly && plan.updates.length > 0) {
      throw new NormalizedEmailMigrationError([
        `${plan.updates.length} user(s) still have no normalized email. Run the normalized-email migration before starting authentication.`,
      ])
    }

    for (const update of plan.updates) {
      await tx.user.update({ where: { id: update.id }, data: { normalizedEmail: update.normalizedEmail } })
    }

    const remaining = await tx.user.count({ where: { normalizedEmail: null } })
    if (remaining !== 0) {
      throw new NormalizedEmailMigrationError([
        `Verification found ${remaining} user(s) without a normalized email after backfill.`,
      ])
    }

    return { checked: users.length, pending: 0, updated: plan.updates.length }
  }, { maxWait: 10_000, timeout: 60_000 })
}

async function main() {
  const option = process.argv[2]
  if (option && !["--check", "--preflight"].includes(option)) {
    throw new Error("Usage: node scripts/migrate-normalized-auth-emails.mjs [--preflight|--check]")
  }

  const prisma = new PrismaClient()
  try {
    const result = await migrateNormalizedAuthEmails(prisma, {
      checkOnly: option === "--check",
      preflightOnly: option === "--preflight",
    })
    if (option === "--preflight") {
      console.log(`Normalized-email preflight passed for ${result.checked} user(s); ${result.pending} require backfill.`)
    } else if (option === "--check") {
      console.log(`Normalized-email verification passed for ${result.checked} user(s).`)
    } else {
      console.log(`Normalized-email migration passed for ${result.checked} user(s); backfilled ${result.updated}.`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Normalized-email migration failed.")
    process.exitCode = 1
  })
}
