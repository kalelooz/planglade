import { NextRequest, NextResponse } from "next/server"

import { badRequest, notFound, parseDateValue, parseJsonBody, requireWorkspaceRole, serverError } from "@/lib/api-utils"
import { logActivityEvent } from "@/lib/activity"
import { updateProjectSchema, workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { toProjectFeatureFlagsJson } from "@/lib/project-flags"

type Params = { params: Promise<{ projectId: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const { projectId } = await params
  const query = workspaceQuerySchema.safeParse({
    workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
  })
  if (!query.success) return badRequest("workspaceId query is required", query.error.flatten())

  const parsed = await parseJsonBody(request, updateProjectSchema)
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(request, query.data.workspaceId, "MEMBER")
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const existing = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true, name: true },
    })
    if (!existing) return notFound("Project not found")
    if (existing.workspaceId !== query.data.workspaceId) return notFound("Project not found in workspace")

    const changedFields = Object.entries(parsed.data)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key)

    const project = await db.$transaction(async (tx) => {
      const updatedProject = await tx.project.update({
        where: { id: projectId },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.slug !== undefined ? { slug: parsed.data.slug } : {}),
          ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
          ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
          ...(parsed.data.mode !== undefined ? { mode: parsed.data.mode } : {}),
          ...(parsed.data.featureFlags !== undefined
            ? { featureFlags: toProjectFeatureFlagsJson(parsed.data.featureFlags) }
            : {}),
          ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
          ...(parsed.data.startDate !== undefined
            ? { startDate: parseDateValue(parsed.data.startDate) }
            : {}),
          ...(parsed.data.dueDate !== undefined ? { dueDate: parseDateValue(parsed.data.dueDate) } : {}),
        },
      })

      await logActivityEvent(tx, {
        workspaceId: query.data.workspaceId,
        actorId: actorUserId,
        action: "UPDATED",
        entityType: "PROJECT",
        entityId: projectId,
        summary: `Updated project "${existing.name}"`,
        metadata: { changedFields },
      })

      return updatedProject
    })

    return NextResponse.json({ project })
  } catch (error) {
    return serverError("Failed to update project", String(error))
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { projectId } = await params
  const query = workspaceQuerySchema.safeParse({
    workspaceId: _request.nextUrl.searchParams.get("workspaceId") ?? undefined,
  })
  if (!query.success) return badRequest("workspaceId query is required", query.error.flatten())

  try {
    const access = await requireWorkspaceRole(_request, query.data.workspaceId, "MEMBER")
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const existing = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true, name: true },
    })
    if (!existing) return notFound("Project not found")
    if (existing.workspaceId !== query.data.workspaceId) return notFound("Project not found in workspace")

    await db.$transaction(async (tx) => {
      await tx.project.delete({ where: { id: projectId } })
      await logActivityEvent(tx, {
        workspaceId: query.data.workspaceId,
        actorId: actorUserId,
        action: "DELETED",
        entityType: "PROJECT",
        entityId: projectId,
        summary: `Deleted project "${existing.name}"`,
      })
    })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return serverError("Failed to delete project", String(error))
  }
}
