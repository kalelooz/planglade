import { db } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import { normalizeEmail } from "@/lib/local-auth-email"

type UserDatabase = Pick<Prisma.TransactionClient, "user">

const userSelect = {
  id: true,
  email: true,
  name: true,
  image: true,
  authVersion: true,
} as const satisfies Prisma.UserSelect

export type VerifiedApplicationUser = {
  id: string
  email: string
  name: string | null
  image: string | null
  authVersion: number
}

type VerifiedIdentity = {
  email: unknown
  name?: string | null
  image?: string | null
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002"
}

function matchingTransitionalUsers<T extends { email: string }>(users: T[], normalizedEmail: string): T[] {
  return users.filter((user) => normalizeEmail(user.email) === normalizedEmail)
}

export async function resolveVerifiedApplicationUser(
  identity: VerifiedIdentity,
  client: UserDatabase = db,
): Promise<VerifiedApplicationUser | null> {
  const normalizedEmail = normalizeEmail(identity.email)
  if (!normalizedEmail || typeof identity.email !== "string") return null
  const email = identity.email.trim()
  const existing = await client.user.findUnique({ where: { normalizedEmail }, select: userSelect })
  if (existing) return existing

  const transitionalUsers = matchingTransitionalUsers(
    await client.user.findMany({ where: { normalizedEmail: null }, select: userSelect }),
    normalizedEmail
  )
  if (transitionalUsers.length > 1) return null
  if (transitionalUsers.length === 1) {
    const transitional = transitionalUsers[0]
    try {
      return await client.user.update({
        where: { id: transitional.id },
        data: {
          normalizedEmail,
          ...(identity.name !== undefined ? { name: identity.name } : {}),
          ...(identity.image !== undefined ? { image: identity.image } : {}),
        },
        select: userSelect,
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) return null
      throw error
    }
  }

  try {
    return await client.user.create({
      data: {
        email,
        normalizedEmail,
        name: identity.name,
        image: identity.image,
      },
      select: userSelect,
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) return null
    throw error
  }
}

// Temporary compatibility for OAuth JWTs issued before userId/authVersion claims existed.
export async function resolveLegacyNextAuthUser(
  email: unknown,
  client: UserDatabase = db,
): Promise<VerifiedApplicationUser | null> {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return null

  const existing = await client.user.findUnique({ where: { normalizedEmail }, select: userSelect })
  if (existing) return existing.authVersion === 0 ? existing : null

  const transitionalUsers = matchingTransitionalUsers(
    await client.user.findMany({ where: { normalizedEmail: null }, select: userSelect }),
    normalizedEmail
  )
  return transitionalUsers.length === 1 && transitionalUsers[0].authVersion === 0
    ? transitionalUsers[0]
    : null
}
