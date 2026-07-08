import type { NoteVisibility, Prisma } from "@prisma/client"

import { db } from "@/lib/db"

export function buildNoteAccessWhere(
  workspaceId: string,
  actorUserId: string
): Prisma.NoteWhereInput {
  return {
    workspaceId,
    OR: [
      { visibility: "WORKSPACE" },
      { visibility: "PRIVATE", createdById: actorUserId },
    ],
  }
}

export function canAccessNote(
  note: {
    workspaceId: string
    visibility: NoteVisibility
    createdById: string
  },
  workspaceId: string,
  actorUserId: string
) {
  return (
    note.workspaceId === workspaceId &&
    (note.visibility === "WORKSPACE" || note.createdById === actorUserId)
  )
}

export async function validateNoteReferences(input: {
  workspaceId: string
  actorUserId: string
  noteIds: string[] | undefined
}) {
  if (input.noteIds === undefined) {
    return { ok: true as const, noteIds: undefined }
  }

  const noteIds = [...new Set(input.noteIds)]
  if (noteIds.length === 0) return { ok: true as const, noteIds }

  const accessibleCount = await db.note.count({
    where: {
      id: { in: noteIds },
      ...buildNoteAccessWhere(input.workspaceId, input.actorUserId),
    },
  })

  return accessibleCount === noteIds.length
    ? { ok: true as const, noteIds }
    : { ok: false as const, noteIds: undefined }
}
