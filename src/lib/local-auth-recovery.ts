import { randomUUID } from "node:crypto"
import { Prisma, PrismaClient } from "@prisma/client"

import { db } from "@/lib/db"
import { hashPassword } from "@/lib/local-auth-password"
import {
  normalizeRecoveryCode,
  recoveryCodes,
  sha256Hex,
} from "@/lib/self-host-setup/security"

export const ADMIN_RECOVERY_PREFIX = "admin:v1:"
export const ADMIN_RECOVERY_SECONDS = 15 * 60
const ADMIN_TOKEN_PATTERN = /^r1\.[A-Za-z0-9_-]{43}$/

type Database = PrismaClient | Prisma.TransactionClient
type RecoverySecret = { codeHash: string; type: "permanent" | "admin" }

function preparedRecoveryCodes() {
  const codes = recoveryCodes()
  return {
    codes,
    rows: codes.map((code) => ({
      id: randomUUID(),
      codeHash: sha256Hex(normalizeRecoveryCode(code)!),
    })),
  }
}

export function hashAdminRecoveryToken(token: string) {
  return `${ADMIN_RECOVERY_PREFIX}${sha256Hex(`planglade:admin-recovery:v1\0${token}`)}`
}

export function resolveRecoverySecret(secret: string): RecoverySecret | null {
  const value = secret.trim()
  const permanent = normalizeRecoveryCode(value)
  if (permanent) return { codeHash: sha256Hex(permanent), type: "permanent" }
  if (ADMIN_TOKEN_PATTERN.test(value)) {
    return { codeHash: hashAdminRecoveryToken(value), type: "admin" }
  }
  return null
}

export function recoveryThrottleSubject(secret: string) {
  return resolveRecoverySecret(secret)?.codeHash ?? "invalid-recovery-secret"
}

async function ownerCredentialState(userId: string, client: Database) {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      localCredential: { select: { id: true } },
      memberships: { where: { role: "OWNER" }, take: 1, select: { id: true } },
    },
  })
  if (!user?.memberships.length) return "owner-required" as const
  return user.localCredential ? "enrolled" as const : "available" as const
}

export function getLocalCredentialEnrollmentStatus(
  userId: string,
  client: Database = db,
) {
  return ownerCredentialState(userId, client)
}

export async function enrollLocalCredential(
  userId: string,
  password: string,
  client: PrismaClient = db,
  now = new Date(),
) {
  const state = await ownerCredentialState(userId, client)
  if (state !== "available") return { ok: false as const, reason: state }

  const passwordHash = await hashPassword(password)
  const recovery = preparedRecoveryCodes()
  try {
    const result = await client.$transaction(async (tx) => {
      const current = await ownerCredentialState(userId, tx)
      if (current !== "available") return current
      await tx.localCredential.create({
        data: {
          userId,
          passwordHash,
          passwordCreatedAt: now,
          passwordChangedAt: now,
        },
      })
      await tx.localRecoveryCode.deleteMany({ where: { userId } })
      await tx.localRecoveryCode.createMany({
        data: recovery.rows.map((row) => ({ ...row, userId, createdAt: now })),
      })
      await tx.user.update({ where: { id: userId }, data: { authVersion: { increment: 1 } } })
      return "complete" as const
    }, { isolationLevel: "Serializable" })
    return result === "complete"
      ? { ok: true as const, recoveryCodes: recovery.codes }
      : { ok: false as const, reason: result }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false as const, reason: "enrolled" as const }
    }
    return { ok: false as const, reason: "temporary" as const }
  }
}

function grantIsUsable(
  grant: { createdAt: Date; user: { memberships: Array<{ id: string }> } },
  type: RecoverySecret["type"],
  now: Date,
) {
  if (!grant.user.memberships.length) return false
  return type === "permanent" ||
    grant.createdAt.getTime() + ADMIN_RECOVERY_SECONDS * 1000 > now.getTime()
}

export async function recoverLocalCredential(
  secret: string,
  password: string,
  client: PrismaClient = db,
  now = new Date(),
) {
  const resolved = resolveRecoverySecret(secret)
  if (!resolved) return { ok: false as const, reason: "invalid" as const }

  const matches = await client.localRecoveryCode.findMany({
    where: { codeHash: resolved.codeHash, usedAt: null },
    select: {
      id: true,
      userId: true,
      createdAt: true,
      user: {
        select: {
          memberships: { where: { role: "OWNER" }, take: 1, select: { id: true } },
        },
      },
    },
    take: 2,
  })
  if (matches.length !== 1 || !grantIsUsable(matches[0], resolved.type, now)) {
    return { ok: false as const, reason: "invalid" as const }
  }

  const passwordHash = await hashPassword(password)
  const recovery = preparedRecoveryCodes()
  const match = matches[0]
  try {
    const result = await client.$transaction(async (tx) => {
      const grant = await tx.localRecoveryCode.findUnique({
        where: { id: match.id },
        select: {
          id: true,
          userId: true,
          codeHash: true,
          usedAt: true,
          createdAt: true,
          user: {
            select: {
              memberships: { where: { role: "OWNER" }, take: 1, select: { id: true } },
            },
          },
        },
      })
      if (
        !grant ||
        grant.usedAt ||
        grant.codeHash !== resolved.codeHash ||
        !grantIsUsable(grant, resolved.type, now)
      ) return "invalid" as const

      const consumed = await tx.localRecoveryCode.updateMany({
        where: { id: grant.id, usedAt: null },
        data: { usedAt: now },
      })
      if (consumed.count !== 1) return "invalid" as const

      await tx.localCredential.upsert({
        where: { userId: grant.userId },
        create: {
          userId: grant.userId,
          passwordHash,
          passwordCreatedAt: now,
          passwordChangedAt: now,
        },
        update: { passwordHash, passwordChangedAt: now, disabledAt: null },
      })
      await tx.user.update({
        where: { id: grant.userId },
        data: { authVersion: { increment: 1 } },
      })
      await tx.localRecoveryCode.deleteMany({ where: { userId: grant.userId } })
      await tx.localRecoveryCode.createMany({
        data: recovery.rows.map((row) => ({ ...row, userId: grant.userId, createdAt: now })),
      })
      return "complete" as const
    }, { isolationLevel: "Serializable" })
    return result === "complete"
      ? { ok: true as const, recoveryCodes: recovery.codes }
      : { ok: false as const, reason: result }
  } catch {
    return { ok: false as const, reason: "temporary" as const }
  }
}
