import { NextRequest, NextResponse } from "next/server"

import {
  badRequest,
  forbidden,
  notFound,
  parseJsonBody,
  requireWorkspaceRole,
  resolveRequestActorUserId,
  serverError,
} from "@/lib/api-utils"
import { logActivityEvent } from "@/lib/activity"
import { updateNoteSchema, workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { canAccessNote } from "@/lib/note-access"
import { canDeleteWorkspaceContent } from "@/lib/permissions/content"

type Params = { params: Promise<{ noteId: string }> }

class StaleNoteMutationError extends Error {}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { noteId } = await params
  const query = workspaceQuerySchema.safeParse({
    workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
  })
  if (!query.success) return badRequest("workspaceId query is required", query.error.flatten())

  const parsed = await parseJsonBody(request, updateNoteSchema)
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      await resolveRequestActorUserId(request),
      "MEMBER"
    )
    if (!access.ok) return access.response

    const existing = await db.note.findUnique({
      where: { id: noteId },
      select: {
        id: true,
        workspaceId: true,
        title: true,
        visibility: true,
        createdById: true,
        updatedAt: true,
      },
    })
    if (!existing) return notFound("Note not found")
    if (!canAccessNote(existing, query.data.workspaceId, access.actor.userId)) {
      return notFound("Note not found")
    }
    if (!parsed.data.expectedUpdatedAt) {
      return NextResponse.json(
        {
          error: "expectedUpdatedAt is required",
          current: await db.note.findUnique({ where: { id: noteId } }),
        },
        { status: 428 },
      )
    }
    const expectedUpdatedAt = parsed.data.expectedUpdatedAt

    if (parsed.data.projectId) {
      const project = await db.project.findFirst({
        where: { id: parsed.data.projectId, workspaceId: query.data.workspaceId },
        select: { id: true },
      })
      if (!project) return badRequest("Project not found in workspace")
    }

    const actorUserId = access.actor.userId
    const changedFields = Object.entries(parsed.data)
      .filter(([key, value]) => key !== "expectedUpdatedAt" && value !== undefined)
      .map(([key]) => key)

    const note = await db.$transaction(async (tx) => {
      const claim = await tx.note.updateMany({
        where: { id: noteId, updatedAt: new Date(expectedUpdatedAt) },
        data: {
          ...(parsed.data.projectId !== undefined ? { projectId: parsed.data.projectId } : {}),
          ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
          ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
          ...(parsed.data.visibility !== undefined ? { visibility: parsed.data.visibility } : {}),
          ...(parsed.data.pinned !== undefined ? { pinned: parsed.data.pinned } : {}),
          ...(parsed.data.tags !== undefined ? { tags: parsed.data.tags } : {}),
          ...(actorUserId ? { updatedById: actorUserId } : {}),
        },
      })
      if (claim.count !== 1) throw new StaleNoteMutationError()
      const updatedNote = await tx.note.findUniqueOrThrow({ where: { id: noteId } })

      await logActivityEvent(tx, {
        workspaceId: query.data.workspaceId,
        actorId: actorUserId,
        action: "UPDATED",
        entityType: "NOTE",
        entityId: noteId,
        summary: `Updated note "${existing.title}"`,
        metadata: { changedFields },
      })

      return updatedNote
    })

    return NextResponse.json({ note })
  } catch (error) {
    if (error instanceof StaleNoteMutationError) {
      return NextResponse.json(
        {
          error: "Note changed since it was loaded",
          current: await db.note.findFirst({
            where: { id: noteId, workspaceId: query.data.workspaceId },
          }),
        },
        { status: 409 },
      )
    }
    return serverError("Failed to update note", String(error))
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { noteId } = await params
  const query = workspaceQuerySchema.safeParse({
    workspaceId: _request.nextUrl.searchParams.get("workspaceId") ?? undefined,
  })
  if (!query.success) return badRequest("workspaceId query is required", query.error.flatten())

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      await resolveRequestActorUserId(_request),
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const existing = await db.note.findUnique({
      where: { id: noteId },
      select: {
        id: true,
        workspaceId: true,
        title: true,
        visibility: true,
        createdById: true,
      },
    })
    if (!existing) return notFound("Note not found")
    if (!canAccessNote(existing, query.data.workspaceId, actorUserId)) {
      return notFound("Note not found")
    }
    if (!canDeleteWorkspaceContent({
      role: access.actor.role,
      actorUserId,
      creatorUserId: existing.createdById,
    })) return forbidden("Only the note creator or a workspace admin can delete this note")

    await db.$transaction(async (tx) => {
      await tx.note.delete({ where: { id: noteId } })
      await logActivityEvent(tx, {
        workspaceId: query.data.workspaceId,
        actorId: actorUserId,
        action: "DELETED",
        entityType: "NOTE",
        entityId: noteId,
        summary: `Deleted note "${existing.title}"`,
      })
    })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return serverError("Failed to delete note", String(error))
  }
}
