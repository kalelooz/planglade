import { NextRequest, NextResponse } from "next/server"

import {
  badRequest,
  forbidden,
  notFound,
  parseJsonBody,
  parseQuery,
  requireWorkspaceRole,
  serverError,
} from "@/lib/api-utils"
import { logActivityEvent } from "@/lib/activity"
import { updateAttachmentSchema, workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { normalizeProjectFeatureFlags } from "@/lib/project-flags"
import { storageObjectExists } from "@/lib/storage"

type Params = { params: Promise<{ attachmentId: string }> }

async function ensureProjectAttachmentsEnabled(workspaceId: string, projectId: string | null) {
  if (!projectId) return null

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, workspaceId: true, featureFlags: true },
  })
  if (!project || project.workspaceId !== workspaceId) {
    return badRequest("Project not found in workspace")
  }

  const flags = normalizeProjectFeatureFlags(project.featureFlags)
  if (!flags.attachments) {
    return forbidden("Attachments are disabled for this project")
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
      request.headers.get("x-flowboard-user-id") ?? undefined,
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const existing = await db.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        workItem: { select: { id: true, title: true, projectId: true } },
        note: { select: { id: true, title: true, projectId: true } },
      },
    })
    if (!existing) return notFound("Attachment not found")
    if (existing.workspaceId !== query.data.workspaceId) return notFound("Attachment not found in workspace")

    const projectId = existing.workItem?.projectId ?? existing.note?.projectId ?? null
    const flagError = await ensureProjectAttachmentsEnabled(query.data.workspaceId, projectId)
    if (flagError) return flagError

    const entityType = existing.workItem ? "WORK_ITEM" : "NOTE"
    const entityId = existing.workItem?.id ?? existing.note?.id ?? existing.id
    const entityTitle = existing.workItem?.title ?? existing.note?.title ?? "item"
    const changedFields = Object.entries(parsed.data)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key)

    if (parsed.data.storageKey !== undefined) {
      const expectedPrefix = `${existing.workspaceId}/`
      if (!parsed.data.storageKey.startsWith(expectedPrefix)) {
        return badRequest("Invalid storageKey for workspace")
      }
      const exists = await storageObjectExists(parsed.data.storageKey)
      if (!exists) {
        return badRequest("Uploaded file not found in storage for the provided storageKey")
      }
    }

    const attachment = await db.$transaction(async (tx) => {
      const updatedAttachment = await tx.attachment.update({
        where: { id: attachmentId },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.storageKey !== undefined ? { storageKey: parsed.data.storageKey } : {}),
          ...(parsed.data.mimeType !== undefined ? { mimeType: parsed.data.mimeType } : {}),
          ...(parsed.data.sizeBytes !== undefined ? { sizeBytes: parsed.data.sizeBytes } : {}),
        },
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
      request.headers.get("x-flowboard-user-id") ?? undefined,
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const existing = await db.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        workItem: { select: { id: true, title: true, projectId: true } },
        note: { select: { id: true, title: true, projectId: true } },
      },
    })
    if (!existing) return notFound("Attachment not found")
    if (existing.workspaceId !== query.data.workspaceId) return notFound("Attachment not found in workspace")

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

    return NextResponse.json({ deleted: true })
  } catch (error) {
    return serverError("Failed to delete attachment", String(error))
  }
}
