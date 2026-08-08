import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import {
  parseQuery,
  requireWorkspaceRole,
  resolveRequestActorUserId,
  serverError,
} from "@/lib/api-utils"
import { db } from "@/lib/db"

const teamEventsQuerySchema = z.object({
  workspaceId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(200).default(40),
})

function isTeamEvent(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return false
  const record = metadata as Record<string, unknown>
  return (
    typeof record.inviteId === "string" ||
    typeof record.memberUserId === "string" ||
    typeof record.memberEmail === "string"
  )
}

export async function GET(request: NextRequest) {
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? "40",
    },
    teamEventsQuerySchema
  )
  if (!query.ok) return query.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      await resolveRequestActorUserId(request),
      "ADMIN"
    )
    if (!access.ok) return access.response

    const events = await db.activityEvent.findMany({
      where: {
        workspaceId: query.data.workspaceId,
        entityType: "WORKSPACE",
      },
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: query.data.limit * 3,
    })

    const filtered = events
      .filter((event) => isTeamEvent(event.metadata))
      .slice(0, query.data.limit)
      .map((event) => ({
        id: event.id,
        action: event.action,
        summary: event.summary,
        createdAt: event.createdAt.toISOString(),
        metadata: event.metadata,
        actor: event.actor,
      }))

    return NextResponse.json({ events: filtered })
  } catch (error) {
    return serverError("Failed to load team events", String(error))
  }
}
