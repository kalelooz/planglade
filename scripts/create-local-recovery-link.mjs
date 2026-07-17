import { createHash, randomBytes, randomUUID } from "node:crypto"
import { PrismaClient } from "@prisma/client"

const ADMIN_RECOVERY_PREFIX = "admin:v1:"
const ADMIN_RECOVERY_SECONDS = 15 * 60

function normalizeEmail(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : ""
  return normalized && normalized.length <= 320 && /^[^\s@]+@[^\s@]+$/.test(normalized)
    ? normalized
    : null
}

function canonicalBaseUrl(value) {
  try {
    const url = new URL(value)
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    return url.protocol === "https:" || (url.protocol === "http:" && loopback) ? url.origin : null
  } catch {
    return null
  }
}

function adminTokenHash(token) {
  return `${ADMIN_RECOVERY_PREFIX}${createHash("sha256")
    .update("planglade:admin-recovery:v1\0")
    .update(token)
    .digest("hex")}`
}

async function main() {
  const email = normalizeEmail(process.argv[2])
  const baseUrl = canonicalBaseUrl(process.env.NEXTAUTH_URL)
  if (!email || !baseUrl) {
    throw new Error("Usage: npm run auth:create-recovery-link -- owner@example.com (NEXTAUTH_URL must be configured)")
  }

  const db = new PrismaClient()
  try {
    const user = await db.user.findUnique({
      where: { normalizedEmail: email },
      select: {
        id: true,
        email: true,
        memberships: { where: { role: "OWNER" }, take: 1, select: { id: true } },
      },
    })
    if (!user?.memberships.length) throw new Error("No existing workspace OWNER matches that email")

    const token = `r1.${randomBytes(32).toString("base64url")}`
    const now = new Date()
    await db.$transaction(async (tx) => {
      await tx.localRecoveryCode.deleteMany({
        where: { userId: user.id, codeHash: { startsWith: ADMIN_RECOVERY_PREFIX } },
      })
      await tx.localRecoveryCode.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          codeHash: adminTokenHash(token),
          createdAt: now,
        },
      })
    })

    process.stdout.write([
      "One-time PlanGlade recovery link (valid for 15 minutes):",
      `${baseUrl}/recover#${token}`,
      `Existing OWNER: ${user.email}`,
      "The secret is shown once. Do not paste it into logs or request URLs.",
      "",
    ].join("\n"))
  } finally {
    await db.$disconnect()
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Failed to create recovery link"}\n`)
  process.exitCode = 1
})
