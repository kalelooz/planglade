import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { badRequest, serverError } from "@/lib/api-utils"
import { consumeSignedUploadThrottle, tooManyRequests } from "@/lib/auth-throttle"
import { MAX_ATTACHMENT_BYTES, isAllowedAttachmentMimeType } from "@/lib/contracts"
import {
  getConfiguredStorageProvider,
  StorageObjectAlreadyExistsError,
  verifyLocalSignedStorageUrl,
  writeLocalStorageObject,
} from "@/lib/storage"

const uploadBinaryQuerySchema = z.object({
  storageKey: z.string().min(1),
  mimeType: z.string().trim().min(1).max(120).refine(isAllowedAttachmentMimeType, "Unsupported attachment MIME type"),
  expires: z.coerce.number().int().positive(),
  signature: z.string().trim().min(32),
})

async function readBoundedUploadBody(request: Request) {
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

  if (!request.body) {
    return { ok: false as const, message: "Upload body is empty" }
  }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value || value.byteLength === 0) continue

    totalBytes += value.byteLength
    if (totalBytes > MAX_ATTACHMENT_BYTES) {
      await reader.cancel().catch(() => undefined)
      return { ok: false as const, message: "Upload exceeds the 50 MB limit" }
    }
    chunks.push(value)
  }

  if (totalBytes === 0) {
    return { ok: false as const, message: "Upload body is empty" }
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { ok: true as const, bytes }
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
    const throttle = await consumeSignedUploadThrottle(parsed.data.storageKey)
    if (!throttle.allowed) return tooManyRequests(throttle)

    const contentType = request.headers.get("content-type")?.trim()
    if (!contentType || contentType !== parsed.data.mimeType) {
      return badRequest("Content-Type header must match the signed upload MIME type")
    }

    const body = await readBoundedUploadBody(request)
    if (!body.ok) return badRequest(body.message)

    const saved = await writeLocalStorageObject({
      storageKey: parsed.data.storageKey,
      mimeType: parsed.data.mimeType,
      bytes: body.bytes,
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
    return serverError("Failed to store uploaded attachment", String(error))
  }
}
