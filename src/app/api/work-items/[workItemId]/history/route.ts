import { NextRequest, NextResponse } from "next/server"

import { badRequest, requireWorkspaceRole, resolveRequestActorUserId, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"
import { workspaceQuerySchema } from "@/lib/contracts"

type Params = { params: Promise<{ workItemId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { workItemId } = await params
  const query = workspaceQuerySchema.safeParse({
    workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
  })
  if (!query.success) return badRequest("workspaceId query is required", query.error.flatten())

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      await resolveRequestActorUserId(request),
      "MEMBER"
    )
    if (!access.ok) return access.response

    const workItem = await db.workItem.findUnique({
      where: { id: workItemId },
      select: { id: true, workspaceId: true },
    })
    if (!workItem || workItem.workspaceId !== query.data.workspaceId) {
      return NextResponse.json({ events: [] })
    }

    const events = await db.activityEvent.findMany({
      where: {
        workspaceId: query.data.workspaceId,
        entityType: "WORK_ITEM",
        entityId: workItemId,
      },
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })

    return NextResponse.json({
      events: events.map((event) => ({
        id: event.id,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        summary: event.summary,
        metadata: event.metadata,
        actor: event.actor,
        createdAt: event.createdAt,
      })),
    })
  } catch (error) {
    return serverError("Failed to load work item history", String(error))
  }
}
