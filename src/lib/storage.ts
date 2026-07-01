import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"

import { readPlanGladeEnv } from "@/lib/env-config"
import { getFirebaseStorageBucket } from "@/lib/firebase-admin"

export const VALID_STORAGE_PROVIDERS = ["firebase", "local"] as const
export type PlanGladeStorageProvider = (typeof VALID_STORAGE_PROVIDERS)[number]

export type StoredObjectMetadata = {
  mimeType: string | null
  sizeBytes: number | null
}

type SignedStorageMethod = "upload" | "download"

const DEFAULT_LOCAL_STORAGE_DIR = "storage/local-attachments"
const RUNTIME_LOCAL_SIGNING_SECRET = randomBytes(32).toString("hex")

function lower(value: string | undefined, fallback: string) {
  return (value ?? fallback).toLowerCase()
}

function getDefaultStorageProvider() {
  return process.env.NODE_ENV === "production" ? "firebase" : "local"
}

export function getConfiguredStorageProvider(): PlanGladeStorageProvider | "invalid" {
  const provider = lower(readPlanGladeEnv("STORAGE_PROVIDER"), getDefaultStorageProvider())
  if ((VALID_STORAGE_PROVIDERS as readonly string[]).includes(provider)) {
    return provider as PlanGladeStorageProvider
  }
  return "invalid"
}

export function getStorageConfigErrors() {
  const provider = getConfiguredStorageProvider()
  const errors: string[] = []

  if (provider === "invalid") {
    errors.push("Invalid PLANGLADE_STORAGE_PROVIDER. Use one of: firebase, local.")
    return { provider, errors }
  }

  if (provider === "firebase") {
    if (!process.env.FIREBASE_PROJECT_ID) {
      errors.push("Missing FIREBASE_PROJECT_ID for firebase storage provider.")
    }
    if (!process.env.FIREBASE_STORAGE_BUCKET) {
      errors.push("Missing FIREBASE_STORAGE_BUCKET for firebase storage provider.")
    }
  }

  // Local file storage is supported as an explicit self-host opt-in, including
  // in production. It is confined to PLANGLADE_LOCAL_STORAGE_DIR, rejects path
  // traversal, and serves objects only through short-lived HMAC-signed URLs.
  // A dedicated PLANGLADE_STORAGE_SIGNING_SECRET (or NEXTAUTH_SECRET) is
  // required so signed URLs cannot be forged.
  if (provider === "local" && process.env.NODE_ENV === "production") {
    const hasSigningSecret = Boolean(
      readPlanGladeEnv("STORAGE_SIGNING_SECRET") ?? process.env.NEXTAUTH_SECRET
    )
    if (!hasSigningSecret) {
      errors.push(
        "Missing PLANGLADE_STORAGE_SIGNING_SECRET (or NEXTAUTH_SECRET) for local storage URL signing."
      )
    }
  }

  return { provider, errors }
}

function getStorageProviderOrThrow(): PlanGladeStorageProvider {
  const provider = getConfiguredStorageProvider()
  if (provider === "invalid") {
    throw new Error("Invalid PLANGLADE_STORAGE_PROVIDER")
  }
  return provider
}

function getLocalStorageRootDir() {
  const configuredDir = readPlanGladeEnv("LOCAL_STORAGE_DIR") ?? DEFAULT_LOCAL_STORAGE_DIR
  if (path.isAbsolute(configuredDir)) {
    return path.resolve(/* turbopackIgnore: true */ configuredDir)
  }
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), configuredDir)
}

function resolveLocalStoragePath(storageKey: string) {
  const normalized = storageKey.replace(/\\/g, "/").replace(/^\/+/, "")
  if (!normalized || normalized.includes("..")) {
    throw new Error("Invalid local storage key")
  }

  const rootDir = getLocalStorageRootDir()
  const targetPath = path.resolve(/* turbopackIgnore: true */ rootDir, normalized)
  const insideRoot = targetPath === rootDir || targetPath.startsWith(`${rootDir}${path.sep}`)
  if (!insideRoot) {
    throw new Error("Storage path escapes local storage root")
  }
  return targetPath
}

function getLocalMetaPath(filePath: string) {
  return `${filePath}.meta.json`
}

function getStorageSigningSecret() {
  const configuredSecret = readPlanGladeEnv("STORAGE_SIGNING_SECRET")
  if (configuredSecret) {
    return configuredSecret
  }
  if (process.env.NEXTAUTH_SECRET) {
    return process.env.NEXTAUTH_SECRET
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing PLANGLADE_STORAGE_SIGNING_SECRET for secure storage URL signing in production.")
  }
  return RUNTIME_LOCAL_SIGNING_SECRET
}

function signLocalStorageToken(input: string) {
  return createHmac("sha256", getStorageSigningSecret()).update(input).digest("hex")
}

function encodeLocalStorageTokenPayload(input: {
  method: SignedStorageMethod
  storageKey: string
  mimeType: string
  expiresAtMs: number
}) {
  return `${input.method}|${input.storageKey}|${input.mimeType}|${input.expiresAtMs}`
}

function timingSafeStringEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left, "utf8")
  const rightBytes = Buffer.from(right, "utf8")
  if (leftBytes.length !== rightBytes.length) {
    return false
  }
  return timingSafeEqual(leftBytes, rightBytes)
}

function buildLocalSignedStorageUrl(input: {
  method: SignedStorageMethod
  storageKey: string
  mimeType: string
  expiresInSeconds: number
}) {
  const expiresAtMs = Date.now() + input.expiresInSeconds * 1000
  const payload = encodeLocalStorageTokenPayload({
    method: input.method,
    storageKey: input.storageKey,
    mimeType: input.mimeType,
    expiresAtMs,
  })
  const signature = signLocalStorageToken(payload)
  const params = new URLSearchParams({
    storageKey: input.storageKey,
    mimeType: input.mimeType,
    expires: String(expiresAtMs),
    signature,
  })

  const pathname =
    input.method === "upload"
      ? "/api/attachments/upload-binary"
      : "/api/attachments/download-binary"

  return `${pathname}?${params.toString()}`
}

export function verifyLocalSignedStorageUrl(input: {
  method: SignedStorageMethod
  storageKey: string
  mimeType: string
  expiresAtMs: number
  signature: string
}) {
  if (!Number.isFinite(input.expiresAtMs) || input.expiresAtMs <= 0) {
    return false
  }
  if (Date.now() > input.expiresAtMs) {
    return false
  }

  const expectedSignature = signLocalStorageToken(
    encodeLocalStorageTokenPayload({
      method: input.method,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      expiresAtMs: input.expiresAtMs,
    })
  )

  return timingSafeStringEqual(expectedSignature, input.signature)
}

export async function createAttachmentUploadTarget(input: {
  storageKey: string
  mimeType: string
  expiresInSeconds?: number
}) {
  const provider = getStorageProviderOrThrow()
  const expiresInSeconds = input.expiresInSeconds ?? 900

  if (provider === "firebase") {
    const file = getFirebaseStorageBucket().file(input.storageKey)
    const [uploadUrl] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + expiresInSeconds * 1000,
      contentType: input.mimeType,
    })

    return {
      uploadUrl,
      method: "PUT" as const,
      requiredHeaders: {
        "Content-Type": input.mimeType,
      },
      expiresInSeconds,
    }
  }

  return {
    uploadUrl: buildLocalSignedStorageUrl({
      method: "upload",
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      expiresInSeconds,
    }),
    method: "PUT" as const,
    requiredHeaders: {
      "Content-Type": input.mimeType,
    },
    expiresInSeconds,
  }
}

export async function createAttachmentDownloadTarget(input: {
  storageKey: string
  name: string
  mimeType?: string | null
  expiresInSeconds?: number
}) {
  const provider = getStorageProviderOrThrow()
  const expiresInSeconds = input.expiresInSeconds ?? 600
  const effectiveMimeType = input.mimeType ?? "application/octet-stream"

  if (provider === "firebase") {
    const file = getFirebaseStorageBucket().file(input.storageKey)
    const [downloadUrl] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + expiresInSeconds * 1000,
      responseDisposition: `attachment; filename="${input.name.replace(/"/g, "_")}"`,
    })

    return {
      downloadUrl,
      expiresInSeconds,
    }
  }

  return {
    downloadUrl: `${buildLocalSignedStorageUrl({
      method: "download",
      storageKey: input.storageKey,
      mimeType: effectiveMimeType,
      expiresInSeconds,
    })}&name=${encodeURIComponent(input.name)}`,
    expiresInSeconds,
  }
}

export async function storageObjectExists(storageKey: string) {
  const provider = getStorageProviderOrThrow()

  if (provider === "firebase") {
    const [exists] = await getFirebaseStorageBucket().file(storageKey).exists()
    return exists
  }

  try {
    await stat(/* turbopackIgnore: true */ resolveLocalStoragePath(storageKey))
    return true
  } catch {
    return false
  }
}

export async function deleteStorageObject(storageKey: string) {
  const provider = getStorageProviderOrThrow()

  if (provider === "firebase") {
    await getFirebaseStorageBucket().file(storageKey).delete({ ignoreNotFound: true })
    return true
  }

  const filePath = resolveLocalStoragePath(storageKey)
  const results = await Promise.allSettled([
    rm(filePath, { force: true }),
    rm(getLocalMetaPath(filePath), { force: true }),
  ])

  return results.every((result) => result.status === "fulfilled")
}

export async function readStorageObjectMetadata(storageKey: string): Promise<StoredObjectMetadata | null> {
  const provider = getStorageProviderOrThrow()

  if (provider === "firebase") {
    const [metadata] = await getFirebaseStorageBucket().file(storageKey).getMetadata()
    const sizeBytes =
      metadata.size && !Number.isNaN(Number(metadata.size)) ? Number(metadata.size) : null
    return {
      mimeType: metadata.contentType ?? null,
      sizeBytes,
    }
  }

  try {
    const filePath = resolveLocalStoragePath(storageKey)
    const [fileStat, rawMeta] = await Promise.all([
      stat(/* turbopackIgnore: true */ filePath),
      readFile(/* turbopackIgnore: true */ getLocalMetaPath(filePath), "utf8").catch(() => null),
    ])
    const parsedMeta = rawMeta ? (JSON.parse(rawMeta) as { mimeType?: unknown }) : null
    return {
      mimeType:
        parsedMeta && typeof parsedMeta.mimeType === "string"
          ? parsedMeta.mimeType
          : null,
      sizeBytes: fileStat.size,
    }
  } catch {
    return null
  }
}

export async function writeLocalStorageObject(input: {
  storageKey: string
  mimeType: string
  bytes: Uint8Array
}) {
  const provider = getStorageProviderOrThrow()
  if (provider !== "local") {
    throw new Error("Local object writes require PLANGLADE_STORAGE_PROVIDER=local")
  }

  const filePath = resolveLocalStoragePath(input.storageKey)
  await mkdir(path.dirname(filePath), { recursive: true })
  const buffer = Buffer.from(input.bytes)
  await writeFile(filePath, buffer)
  await writeFile(
    getLocalMetaPath(filePath),
    JSON.stringify(
      {
        mimeType: input.mimeType,
      },
      null,
      2
    )
  )

  return {
    sizeBytes: buffer.byteLength,
    path: filePath,
  }
}

export async function readLocalStorageObject(input: { storageKey: string }) {
  const provider = getStorageProviderOrThrow()
  if (provider !== "local") {
    throw new Error("Local object reads require PLANGLADE_STORAGE_PROVIDER=local")
  }

  const filePath = resolveLocalStoragePath(input.storageKey)
  const [buffer, metaRaw] = await Promise.all([
    readFile(/* turbopackIgnore: true */ filePath),
    readFile(/* turbopackIgnore: true */ getLocalMetaPath(filePath), "utf8").catch(() => null),
  ])
  const meta = metaRaw ? (JSON.parse(metaRaw) as { mimeType?: unknown }) : null
  return {
    bytes: buffer,
    mimeType: typeof meta?.mimeType === "string" ? meta.mimeType : "application/octet-stream",
  }
}
