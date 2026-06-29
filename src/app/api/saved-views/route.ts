import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { parseJsonBody, parseQuery, requireWorkspaceRole, resolveRequestActorUserId, serverError } from "@/lib/api-utils"
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
    const access = await requireWorkspaceRole(
      parsed.data.workspaceId,
      await resolveRequestActorUserId(request),
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const data: Prisma.SavedViewUncheckedCreateInput = {
      workspaceId: parsed.data.workspaceId,
      projectId: parsed.data.projectId,
      createdById: actorUserId,
      name: parsed.data.name,
      layout: parsed.data.layout,
      groupBy: parsed.data.groupBy,
      orderBy: parsed.data.orderBy,
      filters: (parsed.data.filters as Prisma.InputJsonValue | undefined) ?? undefined,
      display: (parsed.data.display as Prisma.InputJsonValue | undefined) ?? undefined,
      isDefault: parsed.data.isDefault,
    }

    const savedView = await db.savedView.create({ data })
    return NextResponse.json({ savedView }, { status: 201 })
  } catch (error) {
    return serverError("Failed to create saved view", String(error))
  }
}
