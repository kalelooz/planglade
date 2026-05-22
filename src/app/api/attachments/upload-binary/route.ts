import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { badRequest, serverError } from "@/lib/api-utils"
import {
  getConfiguredStorageProvider,
  verifyLocalSignedStorageUrl,
  writeLocalStorageObject,
} from "@/lib/storage"

const uploadBinaryQuerySchema = z.object({
  storageKey: z.string().min(1),
  mimeType: z.string().trim().min(1).max(120),
  expires: z.coerce.number().int().positive(),
  signature: z.string().trim().min(32),
})

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

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

    const payload = new Uint8Array(await request.arrayBuffer())
    if (payload.byteLength === 0) {
      return badRequest("Upload body is empty")
    }
    if (payload.byteLength > MAX_UPLOAD_BYTES) {
      return badRequest("Upload exceeds the 50 MB limit")
    }

    const saved = await writeLocalStorageObject({
      storageKey: parsed.data.storageKey,
      mimeType: parsed.data.mimeType,
      bytes: payload,
    })

    return NextResponse.json({
      uploaded: true,
      storageKey: parsed.data.storageKey,
      sizeBytes: saved.sizeBytes,
      mimeType: parsed.data.mimeType,
    })
  } catch (error) {
    return serverError("Failed to store uploaded attachment", String(error))
  }
}
