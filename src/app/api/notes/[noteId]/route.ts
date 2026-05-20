import { NextRequest, NextResponse } from "next/server"

import { badRequest, notFound, parseJsonBody, requireWorkspaceRole, serverError } from "@/lib/api-utils"
import { logActivityEvent } from "@/lib/activity"
import { updateNoteSchema, workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"

type Params = { params: Promise<{ noteId: string }> }

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
      request.headers.get("x-flowboard-user-id") ?? undefined,
      "MEMBER"
    )
    if (!access.ok) return access.response

    const existing = await db.note.findUnique({
      where: { id: noteId },
      select: { id: true, workspaceId: true, title: true },
    })
    if (!existing) return notFound("Note not found")
    if (existing.workspaceId !== query.data.workspaceId) return notFound("Note not found in workspace")

    const actorUserId = access.actor.userId
    const changedFields = Object.entries(parsed.data)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key)

    const note = await db.$transaction(async (tx) => {
      const updatedNote = await tx.note.update({
        where: { id: noteId },
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
      _request.headers.get("x-flowboard-user-id") ?? undefined,
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const existing = await db.note.findUnique({
      where: { id: noteId },
      select: { id: true, workspaceId: true, title: true },
    })
    if (!existing) return notFound("Note not found")
    if (existing.workspaceId !== query.data.workspaceId) return notFound("Note not found in workspace")

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
