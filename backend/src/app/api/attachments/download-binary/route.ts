import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { badRequest, serverError } from "@/lib/api-utils"
import {
  getConfiguredStorageProvider,
  readLocalStorageObject,
  verifyLocalSignedStorageUrl,
} from "@/lib/storage"

const downloadBinaryQuerySchema = z.object({
  storageKey: z.string().min(1),
  mimeType: z.string().trim().min(1).max(120),
  expires: z.coerce.number().int().positive(),
  signature: z.string().trim().min(32),
  name: z.string().trim().min(1).max(240).optional(),
})

export async function GET(request: NextRequest) {
  try {
    if (getConfiguredStorageProvider() !== "local") {
      return NextResponse.json(
        { error: "Binary download route is available only for local storage provider" },
        { status: 404 }
      )
    }

    const parsed = downloadBinaryQuerySchema.safeParse({
      storageKey: request.nextUrl.searchParams.get("storageKey") ?? undefined,
      mimeType: request.nextUrl.searchParams.get("mimeType") ?? undefined,
      expires: request.nextUrl.searchParams.get("expires") ?? undefined,
      signature: request.nextUrl.searchParams.get("signature") ?? undefined,
      name: request.nextUrl.searchParams.get("name") ?? undefined,
    })
    if (!parsed.success) {
      return badRequest("Invalid download URL", parsed.error.flatten())
    }

    const isValid = verifyLocalSignedStorageUrl({
      method: "download",
      storageKey: parsed.data.storageKey,
      mimeType: parsed.data.mimeType,
      expiresAtMs: parsed.data.expires,
      signature: parsed.data.signature,
    })
    if (!isValid) {
      return NextResponse.json({ error: "Download URL is invalid or expired" }, { status: 401 })
    }

    const object = await readLocalStorageObject({ storageKey: parsed.data.storageKey }).catch(() => null)
    if (!object) {
      return NextResponse.json({ error: "Attachment file is missing from storage" }, { status: 404 })
    }

    const filename = (parsed.data.name ?? "attachment").replace(/["\r\n]/g, "_")
    return new NextResponse(object.bytes, {
      status: 200,
      headers: {
        "Content-Type": object.mimeType || parsed.data.mimeType,
        "Content-Length": String(object.bytes.byteLength),
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    return serverError("Failed to stream attachment download", String(error))
  }
}
