import { getServerSession } from "next-auth"

import { authOptions, hasAuthProviders } from "@/lib/auth-options"
import { getAuthConfigErrors } from "@/lib/auth-config"
import { db } from "@/lib/db"
import { verifyFirebaseIdToken } from "@/lib/firebase-admin"

export const DEV_USER_IDENTITY = {
  email: "alex.morgan@flowboard.dev",
  name: "Alex Morgan",
}

export type AuthenticatedUser = {
  id: string
  email: string
  name: string | null
}

type SessionUserResult =
  | { ok: true; user: AuthenticatedUser; authMode: "dev-session-scaffold" | "firebase" | "nextauth" }
  | { ok: false; status: 401 | 500; message: string; details?: unknown }

async function upsertSessionUser(identity: { email: string; name: string | null }) {
  return db.user.upsert({
    where: { email: identity.email },
    update: { name: identity.name },
    create: {
      email: identity.email,
      name: identity.name,
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  })
}

function getBearerToken(request: Request) {
  const tokenFromHeader = request.headers.get("authorization")
  const tokenFromCustomHeader = request.headers.get("x-flowboard-firebase-id-token")
  if (tokenFromHeader?.startsWith("Bearer ")) {
    return tokenFromHeader.slice("Bearer ".length).trim()
  }
  return tokenFromCustomHeader?.trim() || null
}

export async function resolveAuthenticatedUser(request: Request): Promise<SessionUserResult> {
  const authConfig = getAuthConfigErrors({ includeProductionDevBlock: true })
  if (authConfig.mode === "invalid") {
    return {
      ok: false,
      status: 500,
      message: authConfig.errors[0] ?? "Invalid FLOWBOARD_AUTH_MODE.",
      details: authConfig.errors,
    }
  }

  if (authConfig.errors.length > 0) {
    return {
      ok: false,
      status: 500,
      message: authConfig.errors[0],
      details: authConfig.errors,
    }
  }

  if (authConfig.mode === "dev") {
    const user = await upsertSessionUser(DEV_USER_IDENTITY)
    return { ok: true, user, authMode: "dev-session-scaffold" }
  }

  if (authConfig.mode === "firebase") {
    const authToken = getBearerToken(request)
    if (!authToken) {
      return { ok: false, status: 401, message: "No Firebase ID token provided" }
    }

    const verified = await verifyFirebaseIdToken(authToken)
    const user = await upsertSessionUser({
      email: verified.email,
      name: verified.name ?? verified.email.split("@")[0],
    })
    return { ok: true, user, authMode: "firebase" }
  }

  if (!hasAuthProviders()) {
    return {
      ok: false,
      status: 500,
      message: "FLOWBOARD_AUTH_MODE=nextauth requires at least one configured provider (Google or GitHub).",
    }
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return { ok: false, status: 401, message: "No authenticated session" }
  }

  const user = await upsertSessionUser({
    email: session.user.email,
    name: session.user.name ?? session.user.email.split("@")[0],
  })
  return { ok: true, user, authMode: "nextauth" }
}
