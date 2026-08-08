import { NextRequest, NextResponse } from "next/server"

import {
  badRequest,
  notFound,
  requireWorkspaceRole,
  resolveRequestActorUserId,
  serverError,
} from "@/lib/api-utils"
import { logActivityEvent } from "@/lib/activity"
import { workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"

type Params = { params: Promise<{ docId: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { docId } = await params
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
    const actorUserId = access.actor.userId

    const existing = await db.projectDoc.findUnique({
      where: { id: docId },
      select: { id: true, workspaceId: true, title: true, status: true, archivedAt: true },
    })
    if (!existing) return notFound("Project doc not found")
    if (existing.workspaceId !== query.data.workspaceId) {
      return notFound("Project doc not found in workspace")
    }

    const doc = await db.$transaction(async (tx) => {
      const archivedDoc = await tx.projectDoc.update({
        where: { id: docId },
        data: {
          status: "ARCHIVED",
          archivedAt: existing.archivedAt ?? new Date(),
          updatedById: actorUserId,
        },
      })

      if (existing.status !== "ARCHIVED") {
        await logActivityEvent(tx, {
          workspaceId: query.data.workspaceId,
          actorId: actorUserId,
          action: "UPDATED",
          entityType: "PROJECT_DOC",
          entityId: docId,
          summary: `Archived project doc "${existing.title}"`,
          metadata: { changedFields: ["status", "archivedAt"] },
        })
      }

      return archivedDoc
    })

    return NextResponse.json({ doc })
  } catch (error) {
    return serverError("Failed to archive project doc", String(error))
  }
}
