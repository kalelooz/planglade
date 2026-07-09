import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

try {
  const table = await prisma.$queryRaw`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Attachment'
  `

  if (table.length === 0) {
    console.log("Attachment table is not present yet; no storageKey duplicates to check.")
    process.exit(0)
  }

  const duplicateGroups = await prisma.$queryRaw`
    SELECT COUNT(*) AS count
    FROM (
      SELECT storageKey
      FROM Attachment
      WHERE storageKey IS NOT NULL
      GROUP BY storageKey
      HAVING COUNT(*) > 1
    )
  `
  const count = Number(duplicateGroups[0]?.count ?? 0)

  if (count > 0) {
    console.error(
      `Found ${count} duplicate Attachment.storageKey group(s). Clean them before running migrations.`
    )
    process.exit(1)
  }

  console.log("Attachment.storageKey duplicate check passed.")
} finally {
  await prisma.$disconnect()
}
