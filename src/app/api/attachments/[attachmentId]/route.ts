import { NextRequest, NextResponse } from "next/server"

import {
  badRequest,
  forbidden,
  notFound,
  parseJsonBody,
  parseQuery,
  requireWorkspaceRole,
  resolveRequestActorUserId,
  serverError,
} from "@/lib/api-utils"
import { logActivityEvent } from "@/lib/activity"
import { validateAttachmentProjectBoundary } from "@/lib/attachment-guards"
import { updateAttachmentSchema, workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { canAccessNote } from "@/lib/note-access"
import { deleteStorageObject } from "@/lib/storage"

type Params = { params: Promise<{ attachmentId: string }> }

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

export async function PATCH(request: NextRequest, { params }: Params) {
  const { attachmentId } = await params
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
    },
    workspaceQuerySchema
  )
  if (!query.ok) return query.response

  const parsed = await parseJsonBody(request, updateAttachmentSchema)
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      await resolveRequestActorUserId(request),
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const existing = await db.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        workItem: { select: { id: true, title: true, projectId: true } },
        note: {
          select: {
            id: true,
            title: true,
            projectId: true,
            workspaceId: true,
            visibility: true,
            createdById: true,
          },
        },
      },
    })
    if (!existing) return notFound("Attachment not found")
    if (existing.workspaceId !== query.data.workspaceId) return notFound("Attachment not found in workspace")
    if (existing.note && !canAccessNote(existing.note, query.data.workspaceId, actorUserId)) {
      return notFound("Attachment not found")
    }

    const projectId = existing.workItem?.projectId ?? existing.note?.projectId ?? null
    const flagError = await ensureProjectAttachmentsEnabled(query.data.workspaceId, projectId)
    if (flagError) return flagError

    const entityType = existing.workItem ? "WORK_ITEM" : "NOTE"
    const entityId = existing.workItem?.id ?? existing.note?.id ?? existing.id
    const entityTitle = existing.workItem?.title ?? existing.note?.title ?? "item"
    const changedFields = Object.entries(parsed.data)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key)

    const attachment = await db.$transaction(async (tx) => {
      const updatedAttachment = await tx.attachment.update({
        where: { id: attachmentId },
        data: { name: parsed.data.name },
      })

      await logActivityEvent(tx, {
        workspaceId: query.data.workspaceId,
        actorId: actorUserId,
        action: "UPDATED",
        entityType,
        entityId,
        summary: `Updated attachment "${existing.name}" on "${entityTitle}"`,
        metadata: {
          attachmentId: existing.id,
          changedFields,
        },
      })

      return updatedAttachment
    })

    return NextResponse.json({ attachment })
  } catch (error) {
    return serverError("Failed to update attachment", String(error))
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { attachmentId } = await params
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
    },
    workspaceQuerySchema
  )
  if (!query.ok) return query.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      await resolveRequestActorUserId(request),
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const existing = await db.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        workItem: { select: { id: true, title: true, projectId: true } },
        note: {
          select: {
            id: true,
            title: true,
            projectId: true,
            workspaceId: true,
            visibility: true,
            createdById: true,
          },
        },
      },
    })
    if (!existing) return notFound("Attachment not found")
    if (existing.workspaceId !== query.data.workspaceId) return notFound("Attachment not found in workspace")
    if (existing.note && !canAccessNote(existing.note, query.data.workspaceId, actorUserId)) {
      return notFound("Attachment not found")
    }

    const projectId = existing.workItem?.projectId ?? existing.note?.projectId ?? null
    const flagError = await ensureProjectAttachmentsEnabled(query.data.workspaceId, projectId)
    if (flagError) return flagError

    const entityType = existing.workItem ? "WORK_ITEM" : "NOTE"
    const entityId = existing.workItem?.id ?? existing.note?.id ?? existing.id
    const entityTitle = existing.workItem?.title ?? existing.note?.title ?? "item"

    await db.$transaction(async (tx) => {
      await tx.attachment.delete({ where: { id: attachmentId } })

      await logActivityEvent(tx, {
        workspaceId: query.data.workspaceId,
        actorId: actorUserId,
        action: "DELETED",
        entityType,
        entityId,
        summary: `Removed attachment "${existing.name}" from "${entityTitle}"`,
        metadata: {
          attachmentId: existing.id,
        },
      })
    })

    const storageDeleted = await deleteStorageObject(existing.storageKey)

    return NextResponse.json({ deleted: true, storageDeleted })
  } catch (error) {
    return serverError("Failed to delete attachment", String(error))
  }
}
