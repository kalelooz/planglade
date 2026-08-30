import { Prisma, type PrismaClient } from "@prisma/client"

import { db } from "@/lib/db"
import { normalizeEmail } from "@/lib/local-auth-email"
import { hashPassword } from "@/lib/local-auth-password"
import { normalizeRecoveryCode, sha256Hex } from "@/lib/self-host-setup/security"

type RecoveryInput = {
  email: string
  recoveryCode: string
  newPassword: string
}

class RecoveryClaimConflict extends Error {}

export async function recoverLocalAccount(
  input: RecoveryInput,
  client: PrismaClient = db,
  now = new Date(),
) {
  const normalizedEmail = normalizeEmail(input.email)
  const normalizedCode = normalizeRecoveryCode(input.recoveryCode)
  if (!normalizedEmail || !normalizedCode) return { ok: false as const, reason: "invalid" as const }

  try {
    const recovery = await client.localRecoveryCode.findFirst({
      where: {
        codeHash: sha256Hex(normalizedCode),
        usedAt: null,
        user: { normalizedEmail },
      },
      include: { user: { include: { localCredential: true } } },
    })
    const credential = recovery?.user.localCredential
    if (!recovery || !credential || credential.disabledAt) {
      return { ok: false as const, reason: "invalid" as const }
    }

    const passwordHash = await hashPassword(input.newPassword)
    await client.$transaction(async (tx) => {
      const claimed = await tx.localRecoveryCode.updateMany({
        where: { id: recovery.id, usedAt: null },
        data: { usedAt: now },
      })
      if (claimed.count !== 1) throw new RecoveryClaimConflict()

      const changed = await tx.localCredential.updateMany({
        where: { id: credential.id, disabledAt: null },
        data: { passwordHash, passwordChangedAt: now },
      })
      if (changed.count !== 1) throw new RecoveryClaimConflict()

      await tx.user.update({
        where: { id: recovery.userId },
        data: { authVersion: { increment: 1 } },
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    return { ok: true as const, normalizedEmail }
  } catch (error) {
    if (error instanceof RecoveryClaimConflict) {
      return { ok: false as const, reason: "invalid" as const }
    }
    return { ok: false as const, reason: "temporary" as const }
  }
}
