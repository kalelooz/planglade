import { NextRequest, NextResponse } from "next/server"

import { badRequest, forbidden, parseQuery, requireWorkspaceRole, serverError } from "@/lib/api-utils"
import { workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { getFirebaseStorageBucket } from "@/lib/firebase-admin"
import { normalizeProjectFeatureFlags } from "@/lib/project-flags"

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
      request.headers.get("x-flowboard-user-id") ?? undefined,
      "MEMBER"
    )
    if (!access.ok) return access.response

    const attachment = await db.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        workItem: { select: { id: true, projectId: true, workspaceId: true } },
        note: { select: { id: true, projectId: true, workspaceId: true } },
      },
    })

    if (!attachment || attachment.workspaceId !== query.data.workspaceId) {
      return NextResponse.json({ error: "Attachment not found in workspace" }, { status: 404 })
    }

    const projectId = attachment.workItem?.projectId ?? attachment.note?.projectId ?? null
    const flagError = await ensureProjectAttachmentsEnabled(query.data.workspaceId, projectId)
    if (flagError) return flagError

    const expectedPrefix = `${query.data.workspaceId}/`
    if (!attachment.storageKey.startsWith(expectedPrefix)) {
      return badRequest("Invalid attachment storage key")
    }

    const file = getFirebaseStorageBucket().file(attachment.storageKey)
    const [exists] = await file.exists()
    if (!exists) {
      return NextResponse.json({ error: "Attachment file is missing from storage" }, { status: 404 })
    }

    const [downloadUrl] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 10 * 60 * 1000,
      responseDisposition: `attachment; filename="${attachment.name.replace(/"/g, "_")}"`,
    })

    return NextResponse.json({
      attachment: {
        id: attachment.id,
        name: attachment.name,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
      },
      downloadUrl,
      expiresInSeconds: 600,
    })
  } catch (error) {
    return serverError("Failed to create attachment download URL", String(error))
  }
}
