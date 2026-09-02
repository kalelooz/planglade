import { NextRequest, NextResponse } from "next/server"

import {
  badRequest,
  forbidden,
  notFound,
  parseDateValue,
  parseJsonBody,
  requireWorkspaceRole,
  resolveRequestActorUserId,
  serverError,
} from "@/lib/api-utils"
import { logActivityEvent } from "@/lib/activity"
import { deleteProjectSchema, updateProjectSchema, workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { canDeleteWorkspaceContent } from "@/lib/permissions/content"
import { toProjectFeatureFlagsJson } from "@/lib/project-flags"

type Params = { params: Promise<{ projectId: string }> }

class StaleProjectMutationError extends Error {}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { projectId } = await params
  const query = workspaceQuerySchema.safeParse({
    workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
  })
  if (!query.success) return badRequest("workspaceId query is required", query.error.flatten())

  const parsed = await parseJsonBody(request, updateProjectSchema)
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      await resolveRequestActorUserId(request),
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const existing = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true, name: true, mode: true, featureFlags: true, startDate: true, dueDate: true, updatedAt: true },
    })
    if (!existing) return notFound("Project not found")
    if (existing.workspaceId !== query.data.workspaceId) return notFound("Project not found in workspace")
    const nextStartDate = parsed.data.startDate !== undefined ? parseDateValue(parsed.data.startDate) : existing.startDate
    const nextDueDate = parsed.data.dueDate !== undefined ? parseDateValue(parsed.data.dueDate) : existing.dueDate
    if (nextStartDate && nextDueDate && nextDueDate < nextStartDate) {
      return badRequest("Due date must be on or after the start date")
    }
    if (!parsed.data.expectedUpdatedAt) {
      return NextResponse.json(
        {
          error: "expectedUpdatedAt is required",
          current: await db.project.findUnique({ where: { id: projectId } }),
        },
        { status: 428 },
      )
    }
    const expectedUpdatedAt = parsed.data.expectedUpdatedAt

    const changedFields = Object.entries(parsed.data)
      .filter(([key, value]) => key !== "expectedUpdatedAt" && value !== undefined)
      .map(([key]) => key)
    const nextMode = parsed.data.mode ?? existing.mode
    const nextFeatureFlagsInput =
      parsed.data.featureFlags !== undefined || parsed.data.mode !== undefined
        ? parsed.data.featureFlags ?? existing.featureFlags
        : undefined

    const project = await db.$transaction(async (tx) => {
      const claim = await tx.project.updateMany({
        where: { id: projectId, updatedAt: new Date(expectedUpdatedAt) },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.slug !== undefined ? { slug: parsed.data.slug } : {}),
          ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
          ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
          ...(parsed.data.mode !== undefined ? { mode: parsed.data.mode } : {}),
          ...(nextFeatureFlagsInput !== undefined
            ? { featureFlags: toProjectFeatureFlagsJson(nextFeatureFlagsInput, { mode: nextMode }) }
            : {}),
          ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
          ...(parsed.data.icon !== undefined ? { icon: parsed.data.icon } : {}),
          ...(parsed.data.startDate !== undefined
            ? { startDate: nextStartDate }
            : {}),
          ...(parsed.data.dueDate !== undefined ? { dueDate: nextDueDate } : {}),
        },
      })
      if (claim.count !== 1) throw new StaleProjectMutationError()
      const updatedProject = await tx.project.findUniqueOrThrow({ where: { id: projectId } })

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
    if (error instanceof StaleProjectMutationError) {
      return NextResponse.json(
        {
          error: "Project changed since it was loaded",
          current: await db.project.findFirst({
            where: { id: projectId, workspaceId: query.data.workspaceId },
          }),
        },
        { status: 409 },
      )
    }
    return serverError("Failed to update project", String(error))
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { projectId } = await params
  const query = workspaceQuerySchema.safeParse({
    workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
  })
  if (!query.success) return badRequest("workspaceId query is required", query.error.flatten())
  const parsed = await parseJsonBody(request, deleteProjectSchema, { allowEmptyObject: true })
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      await resolveRequestActorUserId(request),
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const existing = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true, name: true, createdById: true, updatedAt: true },
    })
    if (!existing) return notFound("Project not found")
    if (existing.workspaceId !== query.data.workspaceId) return notFound("Project not found in workspace")
    if (!canDeleteWorkspaceContent({
      role: access.actor.role,
      actorUserId,
      creatorUserId: existing.createdById,
    })) return forbidden("Only the project creator or a workspace admin can delete this project")
    if (!parsed.data.expectedUpdatedAt) {
      return NextResponse.json(
        { error: "expectedUpdatedAt is required", current: await db.project.findUnique({ where: { id: projectId } }) },
        { status: 428 },
      )
    }

    await db.$transaction(async (tx) => {
      const claim = await tx.project.deleteMany({
        where: { id: projectId, updatedAt: new Date(parsed.data.expectedUpdatedAt!) },
      })
      if (claim.count !== 1) throw new StaleProjectMutationError()
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
    if (error instanceof StaleProjectMutationError) {
      return NextResponse.json(
        {
          error: "Project changed since it was loaded",
          current: await db.project.findFirst({ where: { id: projectId, workspaceId: query.data.workspaceId } }),
        },
        { status: 409 },
      )
    }
    return serverError("Failed to delete project", String(error))
  }
}
