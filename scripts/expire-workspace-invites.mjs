import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const now = new Date()
  const result = await prisma.workspaceInvite.updateMany({
    where: {
      status: "PENDING",
      expiresAt: { lte: now },
    },
    data: {
      status: "EXPIRED",
    },
  })

  console.log(
    JSON.stringify(
      {
        ok: true,
        expiredCount: result.count,
        executedAt: now.toISOString(),
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error("Failed to expire workspace invites", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
