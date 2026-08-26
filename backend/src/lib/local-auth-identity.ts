import { db } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import { normalizeEmail } from "@/lib/local-auth-email"

const identityUserSelect = {
  id: true,
  email: true,
  normalizedEmail: true,
  firebaseUid: true,
  name: true,
  image: true,
  authVersion: true,
} as const satisfies Prisma.UserSelect

export type VerifiedApplicationUser = { id: string; email: string; name: string | null; image: string | null; authVersion: number }
type IdentityUser = Prisma.UserGetPayload<{ select: typeof identityUserSelect }>
type VerifiedIdentity = { email: unknown; firebaseUid?: string; name?: string | null; image?: string | null }

function toVerifiedApplicationUser(user: IdentityUser): VerifiedApplicationUser {
  return { id: user.id, email: user.email, name: user.name, image: user.image, authVersion: user.authVersion }
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002"
}

export async function resolveVerifiedApplicationUser(identity: VerifiedIdentity): Promise<VerifiedApplicationUser | null> {
  const firebaseUid = identity.firebaseUid?.trim() || null
  const normalizedEmail = normalizeEmail(identity.email)
  if (!normalizedEmail || typeof identity.email !== "string") return null
  const email = identity.email.trim()
  if (firebaseUid) {
    const existingFirebaseUser = await db.user.findUnique({ where: { firebaseUid }, select: identityUserSelect })
    if (existingFirebaseUser) {
      if (existingFirebaseUser.email === email && existingFirebaseUser.normalizedEmail === normalizedEmail) {
        return toVerifiedApplicationUser(existingFirebaseUser)
      }
      try {
        return toVerifiedApplicationUser(await db.user.update({
          where: { id: existingFirebaseUser.id },
          data: {
            email,
            normalizedEmail,
            ...(identity.name !== undefined ? { name: identity.name } : {}),
            ...(identity.image !== undefined ? { image: identity.image } : {}),
          },
          select: identityUserSelect,
        }))
      } catch (error) {
        if (isUniqueConstraintError(error)) return null
        throw error
      }
    }
  }

  const existing = await db.user.findUnique({ where: { normalizedEmail }, select: identityUserSelect })
  if (existing) {
    if (firebaseUid && existing.firebaseUid && existing.firebaseUid !== firebaseUid) return null
    if (!firebaseUid || existing.firebaseUid === firebaseUid) return toVerifiedApplicationUser(existing)
    try {
      return toVerifiedApplicationUser(await db.user.update({
        where: { id: existing.id },
        data: { firebaseUid },
        select: identityUserSelect,
      }))
    } catch (error) {
      if (isUniqueConstraintError(error)) return null
      throw error
    }
  }

  try {
    return toVerifiedApplicationUser(await db.user.create({
      data: { email, normalizedEmail, ...(firebaseUid ? { firebaseUid } : {}), name: identity.name, image: identity.image },
      select: identityUserSelect,
    }))
  } catch (error) {
    if (isUniqueConstraintError(error)) return null
    throw error
  }
}

// Temporary compatibility for OAuth JWTs issued before userId/authVersion claims existed.
export async function resolveLegacyNextAuthUser(email: unknown): Promise<VerifiedApplicationUser | null> {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return null
  const existing = await db.user.findUnique({ where: { normalizedEmail }, select: identityUserSelect })
  return existing?.authVersion === 0 ? toVerifiedApplicationUser(existing) : null
}
