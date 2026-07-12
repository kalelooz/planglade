import { Prisma, PrismaClient } from "@prisma/client"
import { randomUUID } from "node:crypto"

import { hashPassword } from "@/lib/local-auth-password"
import { createClaim, fixedDigestEqual, normalizeRecoveryCode, recoveryCodes, sha256Hex } from "@/lib/self-host-setup/security"

export type Eligibility = "eligible" | "actively_claimed" | "complete" | "blocked"

type Database = PrismaClient | Prisma.TransactionClient

const setupGlobal = globalThis as unknown as { setupPrisma?: PrismaClient }
const prisma = setupGlobal.setupPrisma ?? new PrismaClient()
if (process.env.NODE_ENV !== "production") setupGlobal.setupPrisma = prisma

export function disconnectSetupDatabaseForTests() {
  return prisma.$disconnect()
}

export type CompletionWrite = "user" | "credential" | "recovery" | "workspace" | "membership" | "complete"

export async function resolveSetupEligibility(db: Database = prisma, now = new Date()): Promise<Eligibility> {
  const [setup, users, credentials, recovery, workspaces, memberships, owners] = await Promise.all([
    db.selfHostSetup.findUnique({ where: { id: "singleton" } }),
    db.user.count(), db.localCredential.count(), db.localRecoveryCode.count(), db.workspace.count(),
    db.workspaceMember.count(), db.workspaceMember.count({ where: { role: "OWNER" } }),
  ])
  if (!setup) throw new Error("Setup singleton is unavailable")
  if (setup?.status === "COMPLETE" || workspaces || owners) return "complete"
  const empty = users === 0 && credentials === 0 && recovery === 0 && workspaces === 0 && memberships === 0
  if (!empty) return "blocked"
  if (setup?.status === "IN_PROGRESS" && setup.claimantHash && setup.claimExpiresAt && setup.claimExpiresAt > now) return "actively_claimed"
  if (setup?.status === "IN_PROGRESS" && (!setup.claimantHash || !setup.claimExpiresAt)) return "blocked"
  return "eligible"
}

export async function claimSetup(now = new Date(), client: PrismaClient = prisma) {
  const claim = createClaim()
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000)
  try {
    const won = await client.$transaction(async (tx) => {
      const acquired = await tx.selfHostSetup.updateMany({
        where: {
          id: "singleton",
          OR: [
            { status: "AVAILABLE" },
            { status: "IN_PROGRESS", claimExpiresAt: { lte: now } },
          ],
        },
        data: { status: "IN_PROGRESS", claimantHash: claim.digest, claimExpiresAt: expiresAt },
      })
      if (acquired.count !== 1) return false
      const [users, credentials, recovery, workspaces, memberships] = await Promise.all([
        tx.user.count(), tx.localCredential.count(), tx.localRecoveryCode.count(), tx.workspace.count(), tx.workspaceMember.count(),
      ])
      if (users || credentials || recovery || workspaces || memberships) throw new Error("SETUP_INELIGIBLE")
      return true
    }, { isolationLevel: "Serializable" })
    return won ? { ok: true as const, ...claim, expiresAt } : { ok: false as const, reason: "unavailable" as const }
  } catch (error) {
    if (error instanceof Error && error.message === "SETUP_INELIGIBLE") {
      return { ok: false as const, reason: "unavailable" as const }
    }
    return { ok: false as const, reason: "temporary" as const }
  }
}

function workspaceSlug(name: string) {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "workspace"
}

export async function completeSetup(
  input: { email: string; name: string; password: string; workspaceName: string },
  claimant: string,
  now = new Date(),
  client: PrismaClient = prisma,
  beforeWrite: (write: CompletionWrite) => void = () => {},
) {
  const claimantHash = sha256Hex(claimant)
  const passwordHash = await hashPassword(input.password)
  const codes = recoveryCodes()
  const codeHashes = codes.map((code) => sha256Hex(normalizeRecoveryCode(code)!))
  const userId = randomUUID(), workspaceId = randomUUID(), slug = workspaceSlug(input.workspaceName)
  try {
    const result = await client.$transaction(async (tx) => {
      const setup = await tx.selfHostSetup.findUnique({ where: { id: "singleton" } })
      if (setup?.status !== "IN_PROGRESS") return "unavailable" as const
      if (!setup.claimantHash || !fixedDigestEqual(setup.claimantHash, claimantHash)) return "invalid" as const
      if (!setup.claimExpiresAt || setup.claimExpiresAt <= now) {
        if (await resolveSetupEligibility(tx, now) === "eligible") {
          await tx.selfHostSetup.update({ where: { id: "singleton" }, data: { status: "AVAILABLE", claimantHash: null, claimExpiresAt: null } })
        }
        return "expired" as const
      }
      if (await resolveSetupEligibility(tx, now) !== "actively_claimed") return "conflict" as const
      const collision = await Promise.all([
        tx.user.findFirst({ where: { OR: [{ email: input.email }, { normalizedEmail: input.email }] }, select: { id: true } }),
        tx.workspace.findUnique({ where: { slug }, select: { id: true } }),
      ])
      if (collision.some(Boolean)) return "conflict" as const
      beforeWrite("user")
      await tx.user.create({ data: { id: userId, email: input.email, normalizedEmail: input.email, name: input.name } })
      beforeWrite("credential")
      await tx.localCredential.create({ data: { userId, passwordHash } })
      beforeWrite("recovery")
      await tx.localRecoveryCode.createMany({ data: codeHashes.map((codeHash) => ({ id: randomUUID(), userId, codeHash })) })
      beforeWrite("workspace")
      await tx.workspace.create({ data: { id: workspaceId, slug, name: input.workspaceName, ownerId: userId } })
      beforeWrite("membership")
      await tx.workspaceMember.create({ data: { workspaceId, userId, role: "OWNER" } })
      beforeWrite("complete")
      await tx.selfHostSetup.update({ where: { id: "singleton" }, data: { status: "COMPLETE", completedAt: now, completedById: userId, claimantHash: null, claimExpiresAt: null } })
      return "complete" as const
    }, { isolationLevel: "Serializable" })
    return result === "complete" ? { ok: true as const, recoveryCodes: codes } : { ok: false as const, reason: result }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2003"].includes(error.code)) {
      return { ok: false as const, reason: "conflict" as const }
    }
    return { ok: false as const, reason: "temporary" as const }
  }
}
