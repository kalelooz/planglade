import { NextRequest, NextResponse } from "next/server"

import { badRequest, parseJsonBody, parseQuery, resolveActorUserId, serverError } from "@/lib/api-utils"
import { createSavedViewSchema, workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  const query = parseQuery(
    { workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined },
    workspaceQuerySchema
  )
  if (!query.ok) return query.response

  try {
    const savedViews = await db.savedView.findMany({
      where: { workspaceId: query.data.workspaceId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    })
    return NextResponse.json({ savedViews })
  } catch (error) {
    return serverError("Failed to load saved views", String(error))
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, createSavedViewSchema)
  if (!parsed.ok) return parsed.response

  try {
    const actorUserId = await resolveActorUserId(
      parsed.data.workspaceId,
      request.headers.get("x-flowboard-user-id") ?? undefined
    )
    if (!actorUserId) return badRequest("Workspace not found")

    const savedView = await db.savedView.create({
      data: {
        workspaceId: parsed.data.workspaceId,
        projectId: parsed.data.projectId,
        createdById: actorUserId,
        name: parsed.data.name,
        layout: parsed.data.layout,
        groupBy: parsed.data.groupBy,
        orderBy: parsed.data.orderBy,
        filters: parsed.data.filters,
        display: parsed.data.display,
        isDefault: parsed.data.isDefault,
      },
    })
    return NextResponse.json({ savedView }, { status: 201 })
  } catch (error) {
    return serverError("Failed to create saved view", String(error))
  }
}
