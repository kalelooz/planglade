import { NextResponse } from "next/server"
import type { WorkspaceRole } from "@prisma/client"
import { ZodSchema } from "zod"

import { db } from "@/lib/db"
import {
  hasMinimumWorkspaceRole,
  resolveRequestPrincipal,
  resolveWorkspaceActor,
} from "@/lib/permissions/principal"

type Dict = Record<string, unknown>

const DEFAULT_JSON_BODY_BYTES = 1024 * 1024
const DEFAULT_JSON_MAX_DEPTH = 40
const DEFAULT_JSON_MAX_NODES = 50_000

type JsonBodyOptions = {
  maxBytes?: number
  maxDepth?: number
  maxNodes?: number
}

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

export function payloadTooLarge(message: string) {
  return NextResponse.json({ error: message }, { status: 413 })
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

function validateJsonComplexity(raw: unknown, maxDepth: number, maxNodes: number) {
  const pending: Array<{ value: unknown; depth: number }> = [{ value: raw, depth: 0 }]
  let nodes = 0

  while (pending.length > 0) {
    const current = pending.pop()!
    nodes += 1
    if (nodes > maxNodes) return "Request JSON contains too many values"
    if (current.depth > maxDepth) return "Request JSON is nested too deeply"
    if (typeof current.value !== "object" || current.value === null) continue

    const children = Array.isArray(current.value)
      ? current.value
      : Object.values(current.value as Record<string, unknown>)
    for (const child of children) pending.push({ value: child, depth: current.depth + 1 })
  }

  return null
}

async function readBoundedJson(request: Request, maxBytes: number) {
  const contentEncoding = request.headers.get("content-encoding")?.trim().toLowerCase()
  if (contentEncoding && contentEncoding !== "identity") {
    return { ok: false as const, response: badRequest("Compressed JSON request bodies are not supported") }
  }

  const declaredLength = request.headers.get("content-length")
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength)
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
      return { ok: false as const, response: badRequest("Content-Length must be a valid byte count") }
    }
    if (parsedLength > maxBytes) {
      return { ok: false as const, response: payloadTooLarge("Request body is too large") }
    }
  }

  const reader = request.body?.getReader()
  if (!reader) return { ok: true as const, text: "" }

  const decoder = new TextDecoder("utf-8", { fatal: true })
  const parts: string[] = []
  let bytesRead = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytesRead += value.byteLength
      if (bytesRead > maxBytes) {
        await reader.cancel()
        return { ok: false as const, response: payloadTooLarge("Request body is too large") }
      }
      parts.push(decoder.decode(value, { stream: true }))
    }
    parts.push(decoder.decode())
  } catch {
    return { ok: false as const, response: badRequest("Request body must be valid UTF-8 JSON") }
  }
  return { ok: true as const, text: parts.join("") }
}

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodSchema<T>,
  options: JsonBodyOptions = {}
) {
  const maxBytes = options.maxBytes ?? DEFAULT_JSON_BODY_BYTES
  const body = await readBoundedJson(request, maxBytes)
  if (!body.ok) return body

  let raw: unknown
  try {
    raw = JSON.parse(body.text)
  } catch {
    return { ok: false as const, response: badRequest("Request body must be valid JSON") }
  }

  const complexityError = validateJsonComplexity(
    raw,
    options.maxDepth ?? DEFAULT_JSON_MAX_DEPTH,
    options.maxNodes ?? DEFAULT_JSON_MAX_NODES
  )
  if (complexityError) {
    return { ok: false as const, response: badRequest(complexityError) }
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

export async function resolveRequestActorUserId(request: Request): Promise<string | undefined> {
  const principal = await resolveRequestPrincipal(request)
  if (principal.ok) return principal.user.id
  if (principal.status === 500) throw new Error(principal.message)
  return undefined
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

export { hasMinimumWorkspaceRole, resolveWorkspaceActor }

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
    const principal = await resolveRequestPrincipal(requestOrWorkspaceId)
    if (!principal.ok) {
      return {
        ok: false as const,
        response: NextResponse.json(
          {
            error: principal.message,
            ...(process.env.NODE_ENV === "production" ? {} : { details: principal.details }),
          },
          { status: principal.status }
        ),
      }
    }
    requestedUserId = principal.user.id
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
