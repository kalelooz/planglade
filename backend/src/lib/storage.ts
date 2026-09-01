import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"
import { createReadStream } from "node:fs"
import { link, mkdir, open, readFile, readdir, rm, stat, statfs, writeFile } from "node:fs/promises"
import path from "node:path"
import { Readable } from "node:stream"

import { readPlanGladeEnv } from "@/lib/env-config"
import { evaluateStorageConfiguration } from "@/lib/production-config.mjs"

export const VALID_STORAGE_PROVIDERS = ["firebase", "local"] as const
export type PlanGladeStorageProvider = (typeof VALID_STORAGE_PROVIDERS)[number]

export type StoredObjectMetadata = {
  mimeType: string | null
  sizeBytes: number | null
}

export class StorageObjectAlreadyExistsError extends Error {
  constructor() {
    super("Storage object already exists")
    this.name = "StorageObjectAlreadyExistsError"
  }
}

export class StorageObjectTooLargeError extends Error {}
export class StorageObjectEmptyError extends Error {}
export class StorageCapacityError extends Error {}

type SignedStorageMethod = "upload" | "download"

const DEFAULT_LOCAL_STORAGE_DIR = "storage/local-attachments"
const RUNTIME_LOCAL_SIGNING_SECRET = randomBytes(32).toString("hex")
const STORAGE_SIGNING_CONTEXT = "planglade:local-storage-signing:v1"

export function getConfiguredStorageProvider(): PlanGladeStorageProvider | "invalid" {
  return evaluateStorageConfiguration(process.env, {
    productionLike: process.env.NODE_ENV === "production",
  }).provider
}

export function getStorageConfigErrors() {
  return evaluateStorageConfiguration(process.env, {
    productionLike: process.env.NODE_ENV === "production",
  })
}

function getStorageProviderOrThrow(): PlanGladeStorageProvider {
  const provider = getConfiguredStorageProvider()
  if (provider === "invalid") {
    throw new Error("Invalid PLANGLADE_STORAGE_PROVIDER")
  }
  return provider
}

async function getConfiguredFirebaseStorageBucket() {
  const { getFirebaseStorageBucket } = await import("@/lib/firebase-admin")
  return getFirebaseStorageBucket()
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
    if (
      process.env.NODE_ENV === "production" &&
      configuredSecret === process.env.NEXTAUTH_SECRET
    ) {
      throw new Error("PLANGLADE_STORAGE_SIGNING_SECRET must not reuse NEXTAUTH_SECRET")
    }
    return configuredSecret
  }
  if (process.env.NEXTAUTH_SECRET) {
    return createHmac("sha256", process.env.NEXTAUTH_SECRET)
      .update(STORAGE_SIGNING_CONTEXT)
      .digest("hex")
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
  reservationId?: string
  expectedSizeBytes?: number
}) {
  return `${input.method}|${input.storageKey}|${input.mimeType}|${input.expiresAtMs}|${input.reservationId ?? ""}|${input.expectedSizeBytes ?? ""}`
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
  reservationId?: string
  expectedSizeBytes?: number
}) {
  const expiresAtMs = Date.now() + input.expiresInSeconds * 1000
  const payload = encodeLocalStorageTokenPayload({
    method: input.method,
    storageKey: input.storageKey,
    mimeType: input.mimeType,
    expiresAtMs,
    reservationId: input.reservationId,
    expectedSizeBytes: input.expectedSizeBytes,
  })
  const signature = signLocalStorageToken(payload)
  const params = new URLSearchParams({
    storageKey: input.storageKey,
    mimeType: input.mimeType,
    expires: String(expiresAtMs),
    signature,
    ...(input.reservationId ? { reservationId: input.reservationId } : {}),
    ...(input.expectedSizeBytes ? { expectedSizeBytes: String(input.expectedSizeBytes) } : {}),
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
  reservationId?: string
  expectedSizeBytes?: number
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
      reservationId: input.reservationId,
      expectedSizeBytes: input.expectedSizeBytes,
    })
  )

  return timingSafeStringEqual(expectedSignature, input.signature)
}

export function buildFirebaseUploadSignedUrlConfig(input: {
  mimeType: string
  expiresAtMs: number
}) {
  return {
    version: "v4" as const,
    action: "write" as const,
    expires: input.expiresAtMs,
    contentType: input.mimeType,
    queryParams: { ifGenerationMatch: "0" },
  }
}

export async function createAttachmentUploadTarget(input: {
  storageKey: string
  mimeType: string
  reservationId: string
  expectedSizeBytes: number
  expiresInSeconds?: number
}) {
  const provider = getStorageProviderOrThrow()
  const expiresInSeconds = input.expiresInSeconds ?? 900

  if (provider === "firebase") {
    const file = (await getConfiguredFirebaseStorageBucket()).file(input.storageKey)
    const [uploadUrl] = await file.getSignedUrl(
      buildFirebaseUploadSignedUrlConfig({
        mimeType: input.mimeType,
        expiresAtMs: Date.now() + expiresInSeconds * 1000,
      })
    )

    return {
      uploadUrl,
      method: "PUT" as const,
      requiredHeaders: {
        "Content-Type": input.mimeType,
      },
      expiresInSeconds,
      reservationId: input.reservationId,
      expectedSizeBytes: input.expectedSizeBytes,
    }
  }

  return {
    uploadUrl: buildLocalSignedStorageUrl({
      method: "upload",
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      expiresInSeconds,
      reservationId: input.reservationId,
      expectedSizeBytes: input.expectedSizeBytes,
    }),
    method: "PUT" as const,
    requiredHeaders: {
      "Content-Type": input.mimeType,
    },
    expiresInSeconds,
  }
}

export async function ensureLocalStorageHeadroom(requestedBytes: number) {
  if (getStorageProviderOrThrow() !== "local") return
  const rootDir = getLocalStorageRootDir()
  await mkdir(rootDir, { recursive: true })
  const filesystem = await statfs(rootDir)
  const availableBytes = filesystem.bavail * filesystem.bsize
  const configured = Number(process.env.PLANGLADE_STORAGE_MIN_FREE_BYTES)
  const minimumFreeBytes = Number.isSafeInteger(configured) && configured >= 0
    ? configured
    : 256 * 1024 * 1024
  if (availableBytes - requestedBytes < minimumFreeBytes) throw new StorageCapacityError()
}

export async function removeAbandonedLocalUploadTemps(olderThan: Date) {
  if (getStorageProviderOrThrow() !== "local") return 0
  const rootDir = getLocalStorageRootDir()
  let removed = 0

  async function visit(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(entryPath)
      } else if (/\.upload-[0-9a-f-]{36}$/i.test(entry.name)) {
        const entryStat = await stat(entryPath).catch(() => null)
        if (entryStat && entryStat.mtime < olderThan) {
          await rm(entryPath, { force: true })
          removed += 1
        }
      }
    }
  }

  await visit(rootDir)
  return removed
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
    const file = (await getConfiguredFirebaseStorageBucket()).file(input.storageKey)
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
    const bucket = await getConfiguredFirebaseStorageBucket()
    const [exists] = await bucket.file(storageKey).exists()
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
    const bucket = await getConfiguredFirebaseStorageBucket()
    await bucket.file(storageKey).delete({ ignoreNotFound: true })
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
    const bucket = await getConfiguredFirebaseStorageBucket()
    const [metadata] = await bucket.file(storageKey).getMetadata()
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
  try {
    await writeFile(filePath, buffer, { flag: "wx" })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new StorageObjectAlreadyExistsError()
    }
    throw error
  }

  try {
    await writeFile(
      getLocalMetaPath(filePath),
      JSON.stringify(
        {
          mimeType: input.mimeType,
        },
        null,
        2
      ),
      { flag: "wx" }
    )
  } catch (error) {
    await rm(filePath, { force: true })
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new StorageObjectAlreadyExistsError()
    }
    throw error
  }

  return {
    sizeBytes: buffer.byteLength,
    path: filePath,
  }
}

export async function writeLocalStorageObjectStream(input: {
  storageKey: string
  mimeType: string
  body: ReadableStream<Uint8Array>
  maxBytes: number
}) {
  const provider = getStorageProviderOrThrow()
  if (provider !== "local") {
    throw new Error("Local object writes require PLANGLADE_STORAGE_PROVIDER=local")
  }

  const filePath = resolveLocalStoragePath(input.storageKey)
  const tempPath = `${filePath}.upload-${randomUUID()}`
  const metaPath = getLocalMetaPath(filePath)
  await mkdir(path.dirname(filePath), { recursive: true })

  const reader = input.body.getReader()
  const handle = await open(tempPath, "wx")
  let totalBytes = 0
  let objectLinked = false
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.byteLength === 0) continue
      totalBytes += value.byteLength
      if (totalBytes > input.maxBytes) {
        await reader.cancel().catch(() => undefined)
        throw new StorageObjectTooLargeError()
      }
      await handle.writeFile(value)
    }
    if (totalBytes === 0) throw new StorageObjectEmptyError()
    await handle.sync()
    await handle.close()

    try {
      await link(tempPath, filePath)
      objectLinked = true
      await writeFile(metaPath, JSON.stringify({ mimeType: input.mimeType }, null, 2), {
        flag: "wx",
      })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new StorageObjectAlreadyExistsError()
      }
      throw error
    }

    return { sizeBytes: totalBytes, path: filePath }
  } catch (error) {
    if (objectLinked) await rm(filePath, { force: true }).catch(() => undefined)
    throw error
  } finally {
    await handle.close().catch(() => undefined)
    await rm(tempPath, { force: true }).catch(() => undefined)
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

export async function streamLocalStorageObject(input: { storageKey: string }) {
  const provider = getStorageProviderOrThrow()
  if (provider !== "local") {
    throw new Error("Local object reads require PLANGLADE_STORAGE_PROVIDER=local")
  }

  const filePath = resolveLocalStoragePath(input.storageKey)
  const [fileStat, metaRaw] = await Promise.all([
    stat(/* turbopackIgnore: true */ filePath),
    readFile(/* turbopackIgnore: true */ getLocalMetaPath(filePath), "utf8").catch(() => null),
  ])
  const meta = metaRaw ? (JSON.parse(metaRaw) as { mimeType?: unknown }) : null
  return {
    body: Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>,
    mimeType: typeof meta?.mimeType === "string" ? meta.mimeType : "application/octet-stream",
    sizeBytes: fileStat.size,
  }
}
