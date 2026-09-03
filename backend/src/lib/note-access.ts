import type { NoteVisibility, Prisma } from "@prisma/client"

import { db } from "@/lib/db"

type NoteReferenceClient = Pick<Prisma.TransactionClient, "note" | "$executeRaw">

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
}, client: Pick<NoteReferenceClient, "note"> = db) {
  if (input.noteIds === undefined) {
    return { ok: true as const, noteIds: undefined }
  }

  const noteIds = [...new Set(input.noteIds)]
  if (noteIds.length === 0) return { ok: true as const, noteIds }

  const accessibleCount = await client.note.count({
    where: {
      id: { in: noteIds },
      ...buildNoteAccessWhere(input.workspaceId, input.actorUserId),
    },
  })

  return accessibleCount === noteIds.length
    ? { ok: true as const, noteIds }
    : { ok: false as const, noteIds: undefined }
}

export async function unlinkDeletedNoteReferences(
  client: Pick<NoteReferenceClient, "$executeRaw">,
  workspaceId: string,
  noteId: string,
) {
  return client.$executeRaw`
    UPDATE "WorkItem"
    SET "noteIds" = (
      SELECT json_group_array(value)
      FROM json_each("WorkItem"."noteIds")
      WHERE value <> ${noteId}
    ),
    "updatedAt" = ${new Date()}
    WHERE "workspaceId" = ${workspaceId}
      AND json_type("noteIds") = 'array'
      AND EXISTS (
        SELECT 1
        FROM json_each("WorkItem"."noteIds")
        WHERE value = ${noteId}
      )
  `
}
