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
})

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
    if (!request.body) return badRequest("Upload body is empty")

    const saved = await writeLocalStorageObjectStream({
      storageKey: parsed.data.storageKey,
      mimeType: parsed.data.mimeType,
      body: request.body,
      maxBytes: MAX_ATTACHMENT_BYTES,
    })

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
