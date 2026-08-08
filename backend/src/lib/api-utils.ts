import { NextResponse } from "next/server"
import type { WorkspaceRole } from "@prisma/client"
import { ZodSchema } from "zod"

import { getConfiguredAuthMode } from "@/lib/auth-config"
import { db } from "@/lib/db"

type Dict = Record<string, unknown>

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 })
}

export function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 })
}

export function forbidden(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 403 })
}

export function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function serverError(message: string, details?: unknown) {
  console.error(message, details)
  return NextResponse.json(
    {
      error: message,
      ...(process.env.NODE_ENV === "production" ? {} : { details }),
    },
    { status: 500 }
  )
}

export async function parseJsonBody<T>(request: Request, schema: ZodSchema<T>) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { ok: false as const, response: badRequest("Request body must be valid JSON") }
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false as const,
      response: badRequest("Request body validation failed", parsed.error.flatten()),
    }
  }

  return { ok: true as const, data: parsed.data }
}

export function parseQuery<T extends Dict>(input: Dict, schema: ZodSchema<T>) {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, response: badRequest("Invalid query", parsed.error.flatten()) }
  }
  return { ok: true as const, data: parsed.data }
}

export function parseDateValue(value?: string | null) {
  if (!value) return null
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function extractFirebaseToken(request: Request) {
  const tokenFromHeader = request.headers.get("authorization")
  const tokenFromCustomHeader = request.headers.get("x-planglade-firebase-id-token")
  if (tokenFromHeader?.startsWith("Bearer ")) {
    return tokenFromHeader.slice("Bearer ".length).trim()
  }
  return tokenFromCustomHeader?.trim() || null
}

export async function resolveRequestActorUserId(request: Request): Promise<string | undefined> {
  const authMode = getConfiguredAuthMode()

  if (authMode === "invalid") {
    throw new Error("Authentication configuration is invalid")
  }
  if (process.env.NODE_ENV === "production" && authMode === "dev") {
    throw new Error("Development authentication is disabled in production")
  }

  if (authMode === "firebase") {
    const token = extractFirebaseToken(request)
    if (!token) return undefined
    const { verifyFirebaseIdToken } = await import("@/lib/firebase-admin")
    try {
      const verified = await verifyFirebaseIdToken(token)
      const { resolveVerifiedApplicationUser } = await import("@/lib/local-auth-identity")
      const user = await resolveVerifiedApplicationUser({
        email: verified.email,
        name: verified.name,
      })
      return user?.id
    } catch {
      return undefined
    }
  }

  if (authMode === "nextauth") {
    const { getVerifiedNextAuthUser } = await import("@/lib/local-auth-session")
    const user = await getVerifiedNextAuthUser()
    return user?.id
  }

  const { resolveAuthenticatedUser } = await import("@/lib/permissions/session")
  const session = await resolveAuthenticatedUser(request)
  return session.ok ? session.user.id : undefined
}

export async function resolveActorUserId(workspaceId: string, requestedUserId?: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  })
  if (!workspace) return null

  if (!requestedUserId) return null

  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: requestedUserId } },
    select: { userId: true },
  })

  return membership?.userId ?? null
}

const ROLE_RANK: Record<WorkspaceRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
}

export async function resolveWorkspaceActor(workspaceId: string, requestedUserId?: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, ownerId: true },
  })
  if (!workspace) return null

  if (!requestedUserId) return null

  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: requestedUserId } },
    select: { userId: true, role: true },
  })
  if (!membership) return null

  return { userId: membership.userId, role: membership.role }
}

export function hasMinimumWorkspaceRole(actual: WorkspaceRole, minimum: WorkspaceRole) {
  return ROLE_RANK[actual] >= ROLE_RANK[minimum]
}

export function requireWorkspaceRole(request: Request, workspaceId: string, minimumRole: WorkspaceRole): Promise<
  | { ok: false; response: NextResponse }
  | { ok: true; actor: { userId: string; role: WorkspaceRole } }
>
export function requireWorkspaceRole(workspaceId: string, requestedUserId: string | undefined, minimumRole: WorkspaceRole): Promise<
  | { ok: false; response: NextResponse }
  | { ok: true; actor: { userId: string; role: WorkspaceRole } }
>
export async function requireWorkspaceRole(
  requestOrWorkspaceId: Request | string,
  workspaceIdOrUserId: string | undefined,
  minimumRole: WorkspaceRole
) {
  const workspaceId = typeof requestOrWorkspaceId === "string" ? requestOrWorkspaceId : workspaceIdOrUserId
  let requestedUserId = workspaceIdOrUserId
  if (typeof requestOrWorkspaceId !== "string") {
    const { resolveAuthenticatedUser } = await import("@/lib/permissions/session")
    const session = await resolveAuthenticatedUser(requestOrWorkspaceId)
    if (!session.ok) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: session.message }, { status: session.status }),
      }
    }
    requestedUserId = session.user.id
  }
  if (!workspaceId) {
    return { ok: false as const, response: badRequest("workspaceId is required") }
  }
  if (!requestedUserId) {
    return { ok: false as const, response: unauthorized("Authentication required") }
  }

  const actor = await resolveWorkspaceActor(workspaceId, requestedUserId)
  if (!actor) {
    return { ok: false as const, response: forbidden("You do not have access to this workspace") }
  }
  if (!hasMinimumWorkspaceRole(actor.role, minimumRole)) {
    return {
      ok: false as const,
      response: forbidden(`This action requires ${minimumRole} role or higher`, { role: actor.role }),
    }
  }
  return { ok: true as const, actor }
}
