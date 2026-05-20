import { NextRequest, NextResponse } from "next/server"

import { notFound, parseJsonBody, resolveActorUserId, serverError } from "@/lib/api-utils"
import { updateNoteSchema } from "@/lib/contracts"
import { db } from "@/lib/db"

type Params = { params: Promise<{ noteId: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const { noteId } = await params
  const parsed = await parseJsonBody(request, updateNoteSchema)
  if (!parsed.ok) return parsed.response

  try {
    const existing = await db.note.findUnique({
      where: { id: noteId },
      select: { id: true, workspaceId: true },
    })
    if (!existing) return notFound("Note not found")

    const actorUserId = await resolveActorUserId(
      existing.workspaceId,
      request.headers.get("x-flowboard-user-id") ?? undefined
    )

    const note = await db.note.update({
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

    return NextResponse.json({ note })
  } catch (error) {
    return serverError("Failed to update note", String(error))
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { noteId } = await params
  try {
    const existing = await db.note.findUnique({ where: { id: noteId }, select: { id: true } })
    if (!existing) return notFound("Note not found")

    await db.note.delete({ where: { id: noteId } })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return serverError("Failed to delete note", String(error))
  }
}
