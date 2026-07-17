import { NextRequest, NextResponse } from "next/server"

import { badRequest, forbidden, parseQuery, requireWorkspaceRole, resolveRequestActorUserId, serverError } from "@/lib/api-utils"
import { consumeWorkspaceThrottle, tooManyRequests } from "@/lib/auth-throttle"
import { validateAttachmentProjectBoundary } from "@/lib/attachment-guards"
import { workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { canAccessNote } from "@/lib/note-access"
import { createAttachmentDownloadTarget, storageObjectExists } from "@/lib/storage"

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

export async function GET(request: NextRequest, { params }: Params) {
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
    const throttle = await consumeWorkspaceThrottle(
      "attachment-download-url",
      access.actor.userId,
      query.data.workspaceId,
    )
    if (!throttle.allowed) return tooManyRequests(throttle)

    const attachment = await db.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        workItem: { select: { id: true, projectId: true, workspaceId: true } },
        note: {
          select: {
            id: true,
            projectId: true,
            workspaceId: true,
            visibility: true,
            createdById: true,
          },
        },
      },
    })

    if (!attachment || attachment.workspaceId !== query.data.workspaceId) {
      return NextResponse.json({ error: "Attachment not found in workspace" }, { status: 404 })
    }
    if (
      attachment.note &&
      !canAccessNote(attachment.note, query.data.workspaceId, access.actor.userId)
    ) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 })
    }

    const projectId = attachment.workItem?.projectId ?? attachment.note?.projectId ?? null
    const flagError = await ensureProjectAttachmentsEnabled(query.data.workspaceId, projectId)
    if (flagError) return flagError

    const expectedPrefix = `${query.data.workspaceId}/`
    if (!attachment.storageKey.startsWith(expectedPrefix)) {
      return badRequest("Invalid attachment storage key")
    }

    const exists = await storageObjectExists(attachment.storageKey)
    if (!exists) {
      return NextResponse.json({ error: "Attachment file is missing from storage" }, { status: 404 })
    }

    const downloadTarget = await createAttachmentDownloadTarget({
      storageKey: attachment.storageKey,
      name: attachment.name,
      mimeType: attachment.mimeType,
      expiresInSeconds: 600,
    })

    return NextResponse.json({
      attachment: {
        id: attachment.id,
        name: attachment.name,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
      },
      downloadUrl: downloadTarget.downloadUrl,
      expiresInSeconds: downloadTarget.expiresInSeconds,
    })
  } catch (error) {
    return serverError("Failed to create attachment download URL", String(error))
  }
}
