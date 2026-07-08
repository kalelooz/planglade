import { NextRequest, NextResponse } from "next/server"

import {
  badRequest,
  forbidden,
  parseJsonBody,
  parseQuery,
  requireWorkspaceRole,
  resolveRequestActorUserId,
  serverError,
} from "@/lib/api-utils"
import { logActivityEvent } from "@/lib/activity"
import { validateAttachmentProjectBoundary } from "@/lib/attachment-guards"
import {
  MAX_ATTACHMENT_BYTES,
  attachmentListQuerySchema,
  createAttachmentSchema,
  isAllowedAttachmentMimeType,
} from "@/lib/contracts"
import { db } from "@/lib/db"
import { buildNoteAccessWhere, canAccessNote } from "@/lib/note-access"
import { readStorageObjectMetadata, storageObjectExists } from "@/lib/storage"

async function validateAttachmentTarget(
  workspaceId: string,
  actorUserId: string,
  input: { workItemId?: string; noteId?: string }
) {
  if (input.workItemId && input.noteId) {
    return { response: badRequest("Attachment must target either workItemId or noteId, not both") }
  }
  if (!input.workItemId && !input.noteId) {
    return { response: badRequest("Attachment target is required (workItemId or noteId)") }
  }

  if (input.workItemId) {
    const workItem = await db.workItem.findUnique({
      where: { id: input.workItemId },
      select: { id: true, workspaceId: true, projectId: true, title: true },
    })
    if (!workItem || workItem.workspaceId !== workspaceId) {
      return { response: badRequest("Work item not found in workspace") }
    }
    return {
      target: {
        kind: "WORK_ITEM" as const,
        id: workItem.id,
        projectId: workItem.projectId,
        title: workItem.title,
      },
    }
  }

  const note = await db.note.findUnique({
    where: { id: input.noteId },
    select: {
      id: true,
      workspaceId: true,
      projectId: true,
      title: true,
      visibility: true,
      createdById: true,
    },
  })
  if (!note || !canAccessNote(note, workspaceId, actorUserId)) {
    return { response: NextResponse.json({ error: "Note not found" }, { status: 404 }) }
  }
  return {
    target: {
      kind: "NOTE" as const,
      id: note.id,
      projectId: note.projectId,
      title: note.title,
    },
  }
}

async function ensureProjectAttachmentsEnabled(workspaceId: string, projectId: string | null) {
  if (!projectId) return null

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, workspaceId: true, featureFlags: true },
  })
  const boundary = validateAttachmentProjectBoundary({
    workspaceId,
    project,
  })
  if (!boundary.ok) {
    return boundary.kind === "forbidden"
      ? forbidden(boundary.message)
      : badRequest(boundary.message)
  }
  return null
}

export async function GET(request: NextRequest) {
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
      workItemId: request.nextUrl.searchParams.get("workItemId") ?? undefined,
      noteId: request.nextUrl.searchParams.get("noteId") ?? undefined,
    },
    attachmentListQuerySchema
  )
  if (!query.ok) return query.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      await resolveRequestActorUserId(request),
      "MEMBER"
    )
    if (!access.ok) return access.response

    if (query.data.workItemId && query.data.noteId) {
      return badRequest("Filter by either workItemId or noteId, not both")
    }

    if (query.data.workItemId || query.data.noteId) {
      const target = await validateAttachmentTarget(
        query.data.workspaceId,
        access.actor.userId,
        {
          workItemId: query.data.workItemId,
          noteId: query.data.noteId,
        }
      )
      if (target.response) return target.response
      if (target.target) {
        const flagError = await ensureProjectAttachmentsEnabled(query.data.workspaceId, target.target.projectId)
        if (flagError) return flagError
      }
    }

    const attachments = await db.attachment.findMany({
      where: {
        workspaceId: query.data.workspaceId,
        OR: [
          { noteId: null },
          {
            note: {
              is: buildNoteAccessWhere(query.data.workspaceId, access.actor.userId),
            },
          },
        ],
        ...(query.data.workItemId ? { workItemId: query.data.workItemId } : {}),
        ...(query.data.noteId ? { noteId: query.data.noteId } : {}),
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })

    return NextResponse.json({
      attachments: attachments.map((attachment) => ({
        id: attachment.id,
        workspaceId: attachment.workspaceId,
        workItemId: attachment.workItemId,
        noteId: attachment.noteId,
        name: attachment.name,
        storageKey: attachment.storageKey,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        uploadedById: attachment.uploadedById,
        uploadedBy: attachment.uploadedBy,
        createdAt: attachment.createdAt,
      })),
    })
  } catch (error) {
    return serverError("Failed to load attachments", String(error))
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, createAttachmentSchema)
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(
      parsed.data.workspaceId,
      await resolveRequestActorUserId(request),
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const target = await validateAttachmentTarget(
      parsed.data.workspaceId,
      actorUserId,
      {
        workItemId: parsed.data.workItemId,
        noteId: parsed.data.noteId,
      }
    )
    if (target.response) return target.response
    if (!target.target) return badRequest("Attachment target resolution failed")

    const flagError = await ensureProjectAttachmentsEnabled(parsed.data.workspaceId, target.target.projectId)
    if (flagError) return flagError

    const expectedPrefix = `${parsed.data.workspaceId}/`
    if (!parsed.data.storageKey.startsWith(expectedPrefix)) {
      return badRequest("Invalid storageKey for workspace")
    }

    const exists = await storageObjectExists(parsed.data.storageKey)
    if (!exists) {
      return badRequest("Uploaded file not found in storage for the provided storageKey")
    }

    const metadata = await readStorageObjectMetadata(parsed.data.storageKey)
    if (!metadata) {
      return badRequest("Could not load uploaded file metadata from storage")
    }
    if (metadata.mimeType && !isAllowedAttachmentMimeType(metadata.mimeType)) {
      return badRequest("Uploaded file MIME type is not supported")
    }
    if (metadata.sizeBytes !== null && metadata.sizeBytes > MAX_ATTACHMENT_BYTES) {
      return badRequest("Uploaded file exceeds the 50 MB limit")
    }
    if (parsed.data.mimeType && metadata.mimeType && metadata.mimeType !== parsed.data.mimeType) {
      return badRequest("Uploaded file MIME type does not match attachment payload")
    }
    if (
      parsed.data.sizeBytes !== undefined &&
      metadata.sizeBytes !== null &&
      metadata.sizeBytes !== parsed.data.sizeBytes
    ) {
      return badRequest("Uploaded file size does not match attachment payload")
    }

    const attachment = await db.$transaction(async (tx) => {
      const createdAttachment = await tx.attachment.create({
        data: {
          workspaceId: parsed.data.workspaceId,
          workItemId: parsed.data.workItemId,
          noteId: parsed.data.noteId,
          uploadedById: actorUserId,
          name: parsed.data.name,
          storageKey: parsed.data.storageKey,
          mimeType: parsed.data.mimeType,
          sizeBytes: parsed.data.sizeBytes,
        },
      })

      await logActivityEvent(tx, {
        workspaceId: parsed.data.workspaceId,
        actorId: actorUserId,
        action: "UPDATED",
        entityType: target.target.kind,
        entityId: target.target.id,
        summary: `Attached "${parsed.data.name}" to "${target.target.title}"`,
        metadata: {
          attachmentId: createdAttachment.id,
          attachmentName: createdAttachment.name,
          mimeType: createdAttachment.mimeType,
          sizeBytes: createdAttachment.sizeBytes,
        },
      })

      return createdAttachment
    })

    return NextResponse.json({ attachment }, { status: 201 })
  } catch (error) {
    return serverError("Failed to create attachment", String(error))
  }
}
