import { NextRequest, NextResponse } from "next/server"

import { badRequest, forbidden, notFound, parseQuery, requireWorkspaceRole, serverError } from "@/lib/api-utils"
import { logActivityEvent } from "@/lib/activity"
import { db } from "@/lib/db"
import { workspaceQuerySchema } from "@/lib/contracts"
import { validateRelationProjectsBoundary } from "@/lib/work-item-relation-guards"

type Params = { params: Promise<{ relationId: string }> }

async function ensureRelationsEnabled(workspaceId: string, projectIds: Array<string | null | undefined>) {
  const uniqueProjectIds = Array.from(
    new Set(projectIds.filter((projectId): projectId is string => typeof projectId === "string" && projectId.length > 0))
  )
  if (uniqueProjectIds.length === 0) return null

  const projects = await db.project.findMany({
    where: { id: { in: uniqueProjectIds } },
    select: { id: true, workspaceId: true, featureFlags: true },
  })
  const boundary = validateRelationProjectsBoundary({
    workspaceId,
    projectIds,
    projects,
  })
  if (!boundary.ok) {
    return boundary.kind === "forbidden"
      ? forbidden(boundary.message)
      : badRequest(boundary.message)
  }
  return null
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { relationId } = await params
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
    },
    workspaceQuerySchema
  )
  if (!query.ok) return query.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      request.headers.get("x-flowboard-user-id") ?? undefined,
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const existing = await db.workItemRelation.findUnique({
      where: { id: relationId },
      include: {
        source: { select: { id: true, title: true, projectId: true } },
        target: { select: { id: true, title: true, projectId: true } },
      },
    })
    if (!existing) return notFound("Work-item relation not found")
    if (existing.workspaceId !== query.data.workspaceId) {
      return notFound("Work-item relation not found in workspace")
    }

    const flagError = await ensureRelationsEnabled(query.data.workspaceId, [
      existing.source.projectId,
      existing.target.projectId,
    ])
    if (flagError) return flagError

    await db.$transaction(async (tx) => {
      await tx.workItemRelation.delete({ where: { id: relationId } })

      await logActivityEvent(tx, {
        workspaceId: query.data.workspaceId,
        actorId: actorUserId,
        action: "UPDATED",
        entityType: "WORK_ITEM",
        entityId: existing.source.id,
        summary: `Removed ${existing.relationType} relation from "${existing.source.title}" to "${existing.target.title}"`,
        metadata: {
          relationId: existing.id,
          relationType: existing.relationType,
          sourceId: existing.source.id,
          targetId: existing.target.id,
        },
      })
    })

    return NextResponse.json({ deleted: true })
  } catch (error) {
    return serverError("Failed to delete work-item relation", String(error))
  }
}
