import { NextResponse } from "next/server"
import { ZodSchema } from "zod"

import { db } from "@/lib/db"

type Dict = Record<string, unknown>

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 })
}

export function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 })
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

  if (!requestedUserId) return workspace.ownerId

  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: requestedUserId } },
    select: { userId: true },
  })

  return membership?.userId ?? workspace.ownerId
}
