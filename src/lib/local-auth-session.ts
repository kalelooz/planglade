import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"

type SessionDatabase = Pick<typeof db, "user">
type SessionIdentity = {
  user?: { id?: unknown; authVersion?: unknown } | null
} | null | undefined

export async function resolveVerifiedNextAuthSessionUser(
  session: SessionIdentity,
  client: SessionDatabase = db,
) {
  const userId = session?.user?.id
  const authVersion = session?.user?.authVersion
  if (typeof userId !== "string" || !userId || !Number.isInteger(authVersion)) return null

  const user = await client.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, image: true, authVersion: true },
  })
  if (!user || user.authVersion !== authVersion) return null
  return user
}

export async function getVerifiedNextAuthUser() {
  return resolveVerifiedNextAuthSessionUser(await getServerSession(authOptions))
}
