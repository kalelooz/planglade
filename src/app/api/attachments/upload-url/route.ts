import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"

import { badRequest, forbidden, parseJsonBody, requireWorkspaceRole, serverError } from "@/lib/api-utils"
import { validateAttachmentProjectBoundary } from "@/lib/attachment-guards"
import { createAttachmentUploadUrlSchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { createAttachmentUploadTarget } from "@/lib/storage"

function sanitizeFilename(input: string) {
  const cleaned = input.trim().replace(/[^\w.\- ]+/g, "_")
  return cleaned.length > 0 ? cleaned : "attachment"
}

async function validateAttachmentTarget(
  workspaceId: string,
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
      select: { id: true, workspaceId: true, projectId: true },
    })
    if (!workItem || workItem.workspaceId !== workspaceId) {
      return { response: badRequest("Work item not found in workspace") }
    }
    return {
      target: {
        projectId: workItem.projectId,
      },
    }
  }

  const note = await db.note.findUnique({
    where: { id: input.noteId },
    select: { id: true, workspaceId: true, projectId: true },
  })
  if (!note || note.workspaceId !== workspaceId) {
    return { response: badRequest("Note not found in workspace") }
  }
  return {
    target: {
      projectId: note.projectId,
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

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, createAttachmentUploadUrlSchema)
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(request, parsed.data.workspaceId, "MEMBER")
    if (!access.ok) return access.response

    const target = await validateAttachmentTarget(parsed.data.workspaceId, {
      workItemId: parsed.data.workItemId,
      noteId: parsed.data.noteId,
    })
    if (target.response) return target.response
    if (!target.target) return badRequest("Attachment target resolution failed")

    const flagError = await ensureProjectAttachmentsEnabled(parsed.data.workspaceId, target.target.projectId)
    if (flagError) return flagError

    const now = new Date()
    const safeName = sanitizeFilename(parsed.data.name)
    const storageKey = `${parsed.data.workspaceId}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}-${safeName}`
    const uploadTarget = await createAttachmentUploadTarget({
      storageKey,
      mimeType: parsed.data.mimeType,
      expiresInSeconds: 900,
    })

    return NextResponse.json({
      uploadUrl: uploadTarget.uploadUrl,
      storageKey,
      method: uploadTarget.method,
      expiresInSeconds: uploadTarget.expiresInSeconds,
      requiredHeaders: uploadTarget.requiredHeaders,
      finalizePayload: {
        workspaceId: parsed.data.workspaceId,
        workItemId: parsed.data.workItemId ?? undefined,
        noteId: parsed.data.noteId ?? undefined,
        name: parsed.data.name,
        storageKey,
        mimeType: parsed.data.mimeType,
        sizeBytes: parsed.data.sizeBytes,
      },
    })
  } catch (error) {
    return serverError("Failed to generate upload URL", String(error))
  }
}
