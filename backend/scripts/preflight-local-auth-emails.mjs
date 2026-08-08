import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function normalizeAuthEmail(value) {
  return value.trim().toLowerCase()
}

function sqliteCanReproduceNormalization(value, normalized) {
  if (!/^[\x00-\x7f]*$/.test(value)) return false
  const sqliteEquivalent = value
    .replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, "")
    .replace(/[A-Z]/g, (character) => character.toLowerCase())
  return normalized.length > 0 && normalized === sqliteEquivalent
}

try {
  const table = await prisma.$queryRaw`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'User'
  `
  if (table.length === 0) {
    console.log("Local-auth email preflight passed: User table is not present yet.")
    process.exit(0)
  }

  const users = await prisma.$queryRaw`SELECT id, email FROM User`
  const seen = new Map()
  let unsafeCount = 0
  let collisionCount = 0

  for (const user of users) {
    const email = typeof user.email === "string" ? user.email : ""
    const normalized = normalizeAuthEmail(email)
    if (!sqliteCanReproduceNormalization(email, normalized)) {
      unsafeCount += 1
      continue
    }
    if (seen.has(normalized)) collisionCount += 1
    else seen.set(normalized, user.id)
  }

  if (unsafeCount > 0) {
    console.error(
      `Found ${unsafeCount} email value(s) whose JavaScript normalization cannot be reproduced safely by SQLite. Resolve or replace those values before applying the local-auth migration. No data was changed.`
    )
    process.exitCode = 1
  } else if (collisionCount > 0) {
    console.error(
      `Found ${collisionCount} normalized email collision(s). Resolve the duplicate identities before applying the local-auth migration. No data was changed.`
    )
    process.exitCode = 1
  } else {
    console.log(`Local-auth email preflight passed for ${users.length} existing user(s).`)
  }
} finally {
  await prisma.$disconnect()
}
