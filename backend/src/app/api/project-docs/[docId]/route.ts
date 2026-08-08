import { NextRequest, NextResponse } from "next/server"

import {
  badRequest,
  notFound,
  parseJsonBody,
  requireWorkspaceRole,
  resolveRequestActorUserId,
  serverError,
} from "@/lib/api-utils"
import { logActivityEvent } from "@/lib/activity"
import { updateProjectDocSchema, workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { projectBelongsToWorkspace } from "@/lib/project-docs"

type Params = { params: Promise<{ docId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { docId } = await params
  const query = workspaceQuerySchema.safeParse({
    workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
  })
  if (!query.success) return badRequest("workspaceId query is required", query.error.flatten())

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      await resolveRequestActorUserId(request),
      "VIEWER"
    )
    if (!access.ok) return access.response

    const doc = await db.projectDoc.findFirst({
      where: { id: docId, workspaceId: query.data.workspaceId },
    })
    if (!doc) return notFound("Project doc not found")

    return NextResponse.json({ doc })
  } catch (error) {
    return serverError("Failed to load project doc", String(error))
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { docId } = await params
  const query = workspaceQuerySchema.safeParse({
    workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
  })
  if (!query.success) return badRequest("workspaceId query is required", query.error.flatten())

  const parsed = await parseJsonBody(request, updateProjectDocSchema)
  if (!parsed.ok) return parsed.response

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
      select: { id: true, workspaceId: true, title: true },
    })
    if (!existing) return notFound("Project doc not found")
    if (existing.workspaceId !== query.data.workspaceId) {
      return notFound("Project doc not found in workspace")
    }

    if (
      typeof parsed.data.projectId === "string" &&
      !(await projectBelongsToWorkspace(parsed.data.projectId, query.data.workspaceId))
    ) {
      return notFound("Project not found in workspace")
    }

    const changedFields = ["title", "body", "projectId"].filter(
      (key) => parsed.data[key as keyof typeof parsed.data] !== undefined
    )

    const doc = await db.$transaction(async (tx) => {
      const updatedDoc = await tx.projectDoc.update({
        where: { id: docId },
        data: {
          ...(parsed.data.projectId !== undefined ? { projectId: parsed.data.projectId } : {}),
          ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
          ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
          updatedById: actorUserId,
        },
      })

      await logActivityEvent(tx, {
        workspaceId: query.data.workspaceId,
        actorId: actorUserId,
        action: "UPDATED",
        entityType: "PROJECT_DOC",
        entityId: docId,
        summary: `Updated project doc "${existing.title}"`,
        metadata: { changedFields },
      })

      return updatedDoc
    })

    return NextResponse.json({ doc })
  } catch (error) {
    return serverError("Failed to update project doc", String(error))
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
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
      select: { id: true, workspaceId: true, title: true },
    })
    if (!existing) return notFound("Project doc not found")
    if (existing.workspaceId !== query.data.workspaceId) {
      return notFound("Project doc not found in workspace")
    }

    await db.$transaction(async (tx) => {
      await tx.projectDoc.delete({ where: { id: docId } })
      await logActivityEvent(tx, {
        workspaceId: query.data.workspaceId,
        actorId: actorUserId,
        action: "DELETED",
        entityType: "PROJECT_DOC",
        entityId: docId,
        summary: `Deleted project doc "${existing.title}"`,
      })
    })

    return NextResponse.json({ deleted: true })
  } catch (error) {
    return serverError("Failed to delete project doc", String(error))
  }
}
