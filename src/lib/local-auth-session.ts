import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"

export async function getVerifiedNextAuthUser() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  const authVersion = session?.user?.authVersion
  if (!userId || !Number.isInteger(authVersion)) return null

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, image: true, authVersion: true },
  })
  if (!user || user.authVersion !== authVersion) return null
  return user
}
