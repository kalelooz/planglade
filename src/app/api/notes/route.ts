import { NextRequest, NextResponse } from "next/server"

import { parseJsonBody, parseQuery, requireWorkspaceRole, resolveRequestActorUserId, serverError } from "@/lib/api-utils"
import { logActivityEvent } from "@/lib/activity"
import { createNoteSchema, noteListQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
      projectId: request.nextUrl.searchParams.get("projectId") ?? undefined,
      pinned: request.nextUrl.searchParams.get("pinned") ?? undefined,
    },
    noteListQuerySchema
  )
  if (!query.ok) return query.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      await resolveRequestActorUserId(request),
      "VIEWER"
    )
    if (!access.ok) return access.response

    const notes = await db.note.findMany({
      where: {
        workspaceId: query.data.workspaceId,
        ...(query.data.projectId ? { projectId: query.data.projectId } : {}),
        ...(query.data.pinned ? { pinned: query.data.pinned === "true" } : {}),
      },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    })

    return NextResponse.json({ notes })
  } catch (error) {
    return serverError("Failed to load notes", String(error))
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, createNoteSchema)
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(
      parsed.data.workspaceId,
      await resolveRequestActorUserId(request),
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const note = await db.$transaction(async (tx) => {
      const createdNote = await tx.note.create({
        data: {
          workspaceId: parsed.data.workspaceId,
          projectId: parsed.data.projectId,
          title: parsed.data.title,
          body: parsed.data.body,
          visibility: parsed.data.visibility,
          pinned: parsed.data.pinned,
          tags: parsed.data.tags,
          createdById: actorUserId,
          updatedById: actorUserId,
        },
      })

      await logActivityEvent(tx, {
        workspaceId: parsed.data.workspaceId,
        actorId: actorUserId,
        action: "CREATED",
        entityType: "NOTE",
        entityId: createdNote.id,
        summary: `Created note "${createdNote.title}"`,
        metadata: {
          visibility: createdNote.visibility,
          pinned: createdNote.pinned,
          ...(createdNote.projectId ? { projectId: createdNote.projectId } : {}),
        },
      })

      return createdNote
    })

    return NextResponse.json({ note }, { status: 201 })
  } catch (error) {
    return serverError("Failed to create note", String(error))
  }
}
