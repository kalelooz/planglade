import type { WorkspaceRole } from "@prisma/client"

import { getAuthConfigErrors } from "@/lib/auth-config"
import { db } from "@/lib/db"
import { resolveVerifiedApplicationUser } from "@/lib/local-auth-identity"
import { getVerifiedNextAuthUser } from "@/lib/local-auth-session"

export const DEV_USER_IDENTITY = {
  email: "alex.morgan@planglade.dev",
  name: "Alex Morgan",
} as const

export type AuthenticatedPrincipal = {
  id: string
  email: string
  name: string | null
}

export type PrincipalResult =
  | { ok: true; user: AuthenticatedPrincipal }
  | { ok: false; status: 401 | 500; message: string; details?: unknown }

const ROLE_RANK: Record<WorkspaceRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
}

function extractFirebaseToken(request: Request) {
  const authorization = request.headers.get("authorization")
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim()
  }
  return request.headers.get("x-planglade-firebase-id-token")?.trim() || null
}

export async function resolveRequestPrincipal(request: Request): Promise<PrincipalResult> {
  const authConfig = getAuthConfigErrors()
  if (authConfig.errors.length > 0) {
    return { ok: false, status: 500, message: authConfig.errors[0], details: authConfig.errors }
  }

  if (authConfig.mode === "dev") {
    const user = await resolveVerifiedApplicationUser(DEV_USER_IDENTITY)
    return user
      ? { ok: true, user }
      : { ok: false, status: 500, message: "Failed to resolve the development user" }
  }

  if (authConfig.mode === "firebase") {
    const token = extractFirebaseToken(request)
    if (!token) return { ok: false, status: 401, message: "No Firebase ID token provided" }
    try {
      const { verifyFirebaseIdToken } = await import("@/lib/firebase-admin")
      const verified = await verifyFirebaseIdToken(token)
      const user = await resolveVerifiedApplicationUser({
        email: verified.email,
        name: verified.name ?? verified.email.split("@")[0],
      })
      return user
        ? { ok: true, user }
        : { ok: false, status: 401, message: "Invalid Firebase identity" }
    } catch {
      return { ok: false, status: 401, message: "Invalid Firebase ID token" }
    }
  }

  const user = await getVerifiedNextAuthUser()
  return user
    ? { ok: true, user }
    : { ok: false, status: 401, message: "No authenticated session" }
}

export async function resolveWorkspaceActor(workspaceId: string, userId: string) {
  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { userId: true, role: true },
  })
  return membership ? { userId: membership.userId, role: membership.role } : null
}

export function hasMinimumWorkspaceRole(actual: WorkspaceRole, minimum: WorkspaceRole) {
  return ROLE_RANK[actual] >= ROLE_RANK[minimum]
}
