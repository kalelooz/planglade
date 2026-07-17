import { NextRequest, NextResponse } from "next/server"

import {
  badRequest,
  forbidden,
  parseJsonBody,
  parseQuery,
  requireWorkspaceRole,
  resolveRequestActorUserId,
  serverError,
} from "@/lib/api-utils"
import {
  mapQuerySchema,
  saveMapPreferencesSchema,
  saveMapSharedLayoutSchema,
} from "@/lib/map-contracts"
import {
  canEditSharedMap,
  MapLayoutConflictError,
  MapReferenceError,
  readMapState,
  resolveMapDescriptor,
  saveMapPreferences,
  saveSharedMapLayout,
  validatePreferenceReferences,
  validateSharedMapReferences,
} from "@/lib/map-service"

function parseMapQuery(request: NextRequest) {
  return parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
      projectId: request.nextUrl.searchParams.get("projectId") ?? undefined,
    },
    mapQuerySchema,
  )
}

async function authorizeMap(request: NextRequest) {
  const query = parseMapQuery(request)
  if (!query.ok) return query
  const access = await requireWorkspaceRole(
    query.data.workspaceId,
    await resolveRequestActorUserId(request),
    "VIEWER",
  )
  if (!access.ok) return access
  const descriptor = await resolveMapDescriptor(query.data)
  if (!descriptor) {
    return { ok: false as const, response: badRequest("Map scope not found in workspace") }
  }
  return { ok: true as const, query: query.data, actor: access.actor, descriptor }
}

export async function GET(request: NextRequest) {
  try {
    const authorized = await authorizeMap(request)
    if (!authorized.ok) return authorized.response
    const state = await readMapState({
      workspaceId: authorized.query.workspaceId,
      actorUserId: authorized.actor.userId,
      actorRole: authorized.actor.role,
      descriptor: authorized.descriptor,
    })
    return NextResponse.json(state, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    return serverError("Failed to load Map state", error)
  }
}

export async function PUT(request: NextRequest) {
  const parsed = await parseJsonBody(request, saveMapSharedLayoutSchema)
  if (!parsed.ok) return parsed.response

  try {
    const authorized = await authorizeMap(request)
    if (!authorized.ok) return authorized.response
    await validateSharedMapReferences({
      workspaceId: authorized.query.workspaceId,
      descriptor: authorized.descriptor,
      layout: parsed.data,
    })
    if (!canEditSharedMap(authorized.actor.role)) {
      return forbidden("This action requires MEMBER role or higher")
    }
    const saved = await saveSharedMapLayout({
      workspaceId: authorized.query.workspaceId,
      descriptor: authorized.descriptor,
      layout: parsed.data,
    })
    return NextResponse.json(saved)
  } catch (error) {
    if (error instanceof MapLayoutConflictError) {
      return NextResponse.json(
        {
          error: "Map layout changed since it was loaded",
          code: "MAP_LAYOUT_CONFLICT",
          revision: error.revision,
        },
        { status: 409 },
      )
    }
    if (error instanceof MapReferenceError) return badRequest(error.message)
    return serverError("Failed to save Map layout", error)
  }
}

export async function PATCH(request: NextRequest) {
  const parsed = await parseJsonBody(request, saveMapPreferencesSchema)
  if (!parsed.ok) return parsed.response

  try {
    const authorized = await authorizeMap(request)
    if (!authorized.ok) return authorized.response
    await validatePreferenceReferences({
      workspaceId: authorized.query.workspaceId,
      descriptor: authorized.descriptor,
      preferences: parsed.data,
    })
    await saveMapPreferences({
      workspaceId: authorized.query.workspaceId,
      actorUserId: authorized.actor.userId,
      descriptor: authorized.descriptor,
      preferences: parsed.data,
    })
    return NextResponse.json({ saved: true })
  } catch (error) {
    if (error instanceof MapReferenceError) return badRequest(error.message)
    return serverError("Failed to save Map preferences", error)
  }
}
