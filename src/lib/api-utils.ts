import { NextResponse } from "next/server"
import type { WorkspaceRole } from "@prisma/client"
import { ZodSchema } from "zod"

import { resolveAuthenticatedUser } from "@/lib/permissions/session"
import {
  hasMinimumWorkspaceRole as hasMinimumWorkspaceRoleForSession,
  resolveWorkspaceActor,
} from "@/lib/permissions/workspace"

type Dict = Record<string, unknown>

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 })
}

export function unauthorized(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 401 })
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

export function parseDateValue(value?: string | null) {
  if (!value) return null
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export function hasMinimumWorkspaceRole(actual: WorkspaceRole, minimum: WorkspaceRole) {
  return hasMinimumWorkspaceRoleForSession(actual, minimum)
}

export async function requireWorkspaceRole(request: Request, workspaceId: string, minimumRole: WorkspaceRole) {
  const session = await resolveAuthenticatedUser(request)
  if (!session.ok) {
    const response =
      session.status === 401
        ? unauthorized(session.message, session.details)
        : serverError(session.message, session.details)
    return { ok: false as const, response }
  }

  const actor = await resolveWorkspaceActor(workspaceId, session.user.id)
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
