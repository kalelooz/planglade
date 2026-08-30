import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { badRequest, serverError } from "@/lib/api-utils"
import { MAX_ATTACHMENT_BYTES, isAllowedAttachmentMimeType } from "@/lib/contracts"
import {
  getConfiguredStorageProvider,
  StorageObjectAlreadyExistsError,
  StorageObjectEmptyError,
  StorageObjectTooLargeError,
  verifyLocalSignedStorageUrl,
  writeLocalStorageObjectStream,
} from "@/lib/storage"

const uploadBinaryQuerySchema = z.object({
  storageKey: z.string().min(1),
  mimeType: z.string().trim().min(1).max(120).refine(isAllowedAttachmentMimeType, "Unsupported attachment MIME type"),
  expires: z.coerce.number().int().positive(),
  signature: z.string().trim().min(32),
  reservationId: z.string().uuid(),
  expectedSizeBytes: z.coerce.number().int().positive().max(MAX_ATTACHMENT_BYTES),
})

const activeUploadsByWorkspace = new Map<string, number>()
let activeUploads = 0

function claimUploadSlot(storageKey: string) {
  const workspaceId = storageKey.split("/", 1)[0]
  const globalLimit = 4
  const workspaceLimit = 2
  const workspaceActive = activeUploadsByWorkspace.get(workspaceId) ?? 0
  if (activeUploads >= globalLimit || workspaceActive >= workspaceLimit) return null
  activeUploads += 1
  activeUploadsByWorkspace.set(workspaceId, workspaceActive + 1)
  return () => {
    activeUploads -= 1
    const remaining = (activeUploadsByWorkspace.get(workspaceId) ?? 1) - 1
    if (remaining > 0) activeUploadsByWorkspace.set(workspaceId, remaining)
    else activeUploadsByWorkspace.delete(workspaceId)
  }
}

function validateUploadContentLength(request: Request) {
  const contentLength = request.headers.get("content-length")
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      return { ok: false as const, message: "Content-Length header is invalid" }
    }
    const declaredBytes = Number(contentLength)
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes > MAX_ATTACHMENT_BYTES) {
      return { ok: false as const, message: "Upload exceeds the 50 MB limit" }
    }
  }

  return { ok: true as const }
}

export async function PUT(request: NextRequest) {
  try {
    if (getConfiguredStorageProvider() !== "local") {
      return NextResponse.json(
        { error: "Binary upload route is available only for local storage provider" },
        { status: 404 }
      )
    }

    const parsed = uploadBinaryQuerySchema.safeParse({
      storageKey: request.nextUrl.searchParams.get("storageKey") ?? undefined,
      mimeType: request.nextUrl.searchParams.get("mimeType") ?? undefined,
      expires: request.nextUrl.searchParams.get("expires") ?? undefined,
      signature: request.nextUrl.searchParams.get("signature") ?? undefined,
      reservationId: request.nextUrl.searchParams.get("reservationId") ?? undefined,
      expectedSizeBytes: request.nextUrl.searchParams.get("expectedSizeBytes") ?? undefined,
    })
    if (!parsed.success) {
      return badRequest("Invalid upload URL", parsed.error.flatten())
    }

    const isValid = verifyLocalSignedStorageUrl({
      method: "upload",
      storageKey: parsed.data.storageKey,
      mimeType: parsed.data.mimeType,
      expiresAtMs: parsed.data.expires,
      signature: parsed.data.signature,
      reservationId: parsed.data.reservationId,
      expectedSizeBytes: parsed.data.expectedSizeBytes,
    })
    if (!isValid) {
      return NextResponse.json({ error: "Upload URL is invalid or expired" }, { status: 401 })
    }

    const contentType = request.headers.get("content-type")?.trim()
    if (!contentType || contentType !== parsed.data.mimeType) {
      return badRequest("Content-Type header must match the signed upload MIME type")
    }

    const contentLength = validateUploadContentLength(request)
    if (!contentLength.ok) return badRequest(contentLength.message)
    const declaredLength = request.headers.get("content-length")
    if (declaredLength !== null && Number(declaredLength) > parsed.data.expectedSizeBytes) {
      return badRequest("Upload exceeds its reserved size")
    }
    if (!request.body) return badRequest("Upload body is empty")

    const releaseUploadSlot = claimUploadSlot(parsed.data.storageKey)
    if (!releaseUploadSlot) {
      return NextResponse.json({ error: "Too many concurrent attachment uploads" }, { status: 429 })
    }
    let saved
    try {
      saved = await writeLocalStorageObjectStream({
        storageKey: parsed.data.storageKey,
        mimeType: parsed.data.mimeType,
        body: request.body,
        maxBytes: parsed.data.expectedSizeBytes,
      })
    } finally {
      releaseUploadSlot()
    }

    return NextResponse.json({
      uploaded: true,
      storageKey: parsed.data.storageKey,
      sizeBytes: saved.sizeBytes,
      mimeType: parsed.data.mimeType,
    })
  } catch (error) {
    if (error instanceof StorageObjectAlreadyExistsError) {
      return NextResponse.json({ error: "Upload target already contains an object" }, { status: 409 })
    }
    if (error instanceof StorageObjectTooLargeError) {
      return badRequest("Upload exceeds the 50 MB limit")
    }
    if (error instanceof StorageObjectEmptyError) {
      return badRequest("Upload body is empty")
    }
    return serverError("Failed to store uploaded attachment", String(error))
  }
}
