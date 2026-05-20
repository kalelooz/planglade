import { NextResponse } from "next/server"
import type { WorkspaceRole } from "@prisma/client"
import { ZodSchema } from "zod"

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

export function serverError(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 500 })
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

export function parseDateValue(value?: string) {
  if (!value) return null
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export async function resolveActorUserId(workspaceId: string, requestedUserId?: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  })
  if (!workspace) return null

  if (!requestedUserId) {
    return workspace.ownerId
  }

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

  if (!requestedUserId) {
    return { userId: workspace.ownerId, role: "OWNER" as WorkspaceRole }
  }

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

export async function requireWorkspaceRole(workspaceId: string, requestedUserId: string | undefined, minimumRole: WorkspaceRole) {
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
