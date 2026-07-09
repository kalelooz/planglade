import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { NextRequest } from "next/server"

import { POST as createAttachment } from "../src/app/api/attachments/route"
import { PUT as uploadLocalAttachment } from "../src/app/api/attachments/upload-binary/route"
import { MAX_ATTACHMENT_BYTES, updateAttachmentSchema } from "../src/lib/contracts"
import { db } from "../src/lib/db"
import {
  buildFirebaseUploadSignedUrlConfig,
  createAttachmentUploadTarget,
  readLocalStorageObject,
  storageObjectExists,
} from "../src/lib/storage"

const originalEnv = {
  PLANGLADE_STORAGE_PROVIDER: process.env.PLANGLADE_STORAGE_PROVIDER,
  PLANGLADE_LOCAL_STORAGE_DIR: process.env.PLANGLADE_LOCAL_STORAGE_DIR,
  PLANGLADE_STORAGE_SIGNING_SECRET: process.env.PLANGLADE_STORAGE_SIGNING_SECRET,
  FLOWBOARD_AUTH_MODE: process.env.FLOWBOARD_AUTH_MODE,
}
const originalWorkspaceFindUnique = db.workspace.findUnique
const originalMemberFindUnique = db.workspaceMember.findUnique
const originalWorkItemFindUnique = db.workItem.findUnique
const originalAttachmentFindFirst = db.attachment.findFirst
const originalAttachmentCreate = db.attachment.create
const originalTransaction = db.$transaction

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  ;(db.workspace as typeof db.workspace).findUnique = originalWorkspaceFindUnique
  ;(db.workspaceMember as typeof db.workspaceMember).findUnique = originalMemberFindUnique
  ;(db.workItem as typeof db.workItem).findUnique = originalWorkItemFindUnique
  ;(db.attachment as typeof db.attachment).findFirst = originalAttachmentFindFirst
  ;(db.attachment as typeof db.attachment).create = originalAttachmentCreate
  ;(db as typeof db).$transaction = originalTransaction
}

async function withLocalStorage(fn: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(tmpdir(), "planglade-attachment-"))
  process.env.PLANGLADE_STORAGE_PROVIDER = "local"
  process.env.PLANGLADE_LOCAL_STORAGE_DIR = root
  process.env.PLANGLADE_STORAGE_SIGNING_SECRET = "attachment-security-test-secret"
  try {
    await fn(root)
  } finally {
    restoreEnv()
    await rm(root, { recursive: true, force: true })
  }
}

async function uploadUrl(storageKey: string) {
  const target = await createAttachmentUploadTarget({
    storageKey,
    mimeType: "text/plain",
    expiresInSeconds: 60,
  })
  return new URL(target.uploadUrl, "http://localhost")
}

function chunkStream(chunkSizes: number[], onPull?: () => void) {
  let index = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      onPull?.()
      const size = chunkSizes[index]
      index += 1
      if (size === undefined) {
        controller.close()
        return
      }
      controller.enqueue(new Uint8Array(size).fill(65))
    },
  })
}

test("local upload capability is create-only and replay cannot alter bytes", async () => {
  await withLocalStorage(async () => {
    const storageKey = "ws-1/2026/07/replay.txt"
    const url = await uploadUrl(storageKey)

    const first = await uploadLocalAttachment(
      new NextRequest(url, {
        method: "PUT",
        headers: { "content-type": "text/plain" },
        body: new TextEncoder().encode("first bytes"),
      })
    )
    const second = await uploadLocalAttachment(
      new NextRequest(url, {
        method: "PUT",
        headers: { "content-type": "text/plain" },
        body: new TextEncoder().encode("replacement bytes"),
      })
    )
    const stored = await readLocalStorageObject({ storageKey })

    assert.equal(first.status, 200)
    assert.equal(second.status, 409)
    assert.equal(new TextDecoder().decode(stored.bytes), "first bytes")
  })
})

test("oversized Content-Length is rejected before body consumption", async () => {
  await withLocalStorage(async () => {
    const url = await uploadUrl("ws-1/2026/07/content-length.txt")
    let bodyRead = false
    const request = {
      nextUrl: url,
      headers: new Headers({
        "content-type": "text/plain",
        "content-length": String(MAX_ATTACHMENT_BYTES + 1),
      }),
      body: {
        getReader() {
          bodyRead = true
          throw new Error("body must not be consumed")
        },
      },
    } as unknown as NextRequest

    const response = await uploadLocalAttachment(request)

    assert.equal(response.status, 400)
    assert.equal(bodyRead, false)
  })
})

test("oversized chunked body is stopped and leaves no object", async () => {
  await withLocalStorage(async () => {
    const storageKey = "ws-1/2026/07/chunked.txt"
    const url = await uploadUrl(storageKey)
    const oneMiB = 1024 * 1024
    const request = {
      nextUrl: url,
      headers: new Headers({ "content-type": "text/plain" }),
      body: chunkStream([...Array(50).fill(oneMiB), 1]),
    } as unknown as NextRequest

    const response = await uploadLocalAttachment(request)

    assert.equal(response.status, 400)
    assert.equal(await storageObjectExists(storageKey), false)
  })
})

test("exactly-at-limit upload succeeds and one-byte-over-limit fails", async () => {
  await withLocalStorage(async () => {
    const oneMiB = 1024 * 1024
    const exactKey = "ws-1/2026/07/exact.txt"
    const exactUrl = await uploadUrl(exactKey)
    const exact = await uploadLocalAttachment({
      nextUrl: exactUrl,
      headers: new Headers({ "content-type": "text/plain" }),
      body: chunkStream(Array(50).fill(oneMiB)),
    } as unknown as NextRequest)

    const overKey = "ws-1/2026/07/over.txt"
    const overUrl = await uploadUrl(overKey)
    const over = await uploadLocalAttachment({
      nextUrl: overUrl,
      headers: new Headers({ "content-type": "text/plain" }),
      body: chunkStream([...Array(50).fill(oneMiB), 1]),
    } as unknown as NextRequest)

    assert.equal(exact.status, 200)
    assert.equal(over.status, 400)
    assert.equal(await storageObjectExists(exactKey), true)
    assert.equal(await storageObjectExists(overKey), false)
  })
})

test("empty, tampered, and expired uploads fail safely", async () => {
  await withLocalStorage(async () => {
    const url = await uploadUrl("ws-1/2026/07/invalid.txt")
    const empty = await uploadLocalAttachment(
      new NextRequest(url, {
        method: "PUT",
        headers: { "content-type": "text/plain" },
      })
    )

    const tamperedUrl = new URL(url)
    tamperedUrl.searchParams.set("signature", "0".repeat(64))
    const tampered = await uploadLocalAttachment(
      new NextRequest(tamperedUrl, {
        method: "PUT",
        headers: { "content-type": "text/plain" },
        body: new Uint8Array([1]),
      })
    )

    const expiredUrl = new URL(url)
    expiredUrl.searchParams.set("expires", "1")
    const expired = await uploadLocalAttachment(
      new NextRequest(expiredUrl, {
        method: "PUT",
        headers: { "content-type": "text/plain" },
        body: new Uint8Array([1]),
      })
    )

    assert.equal(empty.status, 400)
    assert.equal(tampered.status, 401)
    assert.equal(expired.status, 401)
  })
})

test("finalized attachment storage fields are immutable", () => {
  assert.equal(updateAttachmentSchema.safeParse({ name: "renamed.txt" }).success, true)
  assert.equal(updateAttachmentSchema.safeParse({ storageKey: "ws-1/other" }).success, false)
  assert.equal(updateAttachmentSchema.safeParse({ mimeType: "text/plain" }).success, false)
  assert.equal(updateAttachmentSchema.safeParse({ sizeBytes: 1 }).success, false)
})

test("attachment storage keys are unique in the data model", async () => {
  const schema = await readFile("prisma/schema.prisma", "utf8")
  assert.match(schema, /@@unique\(\[storageKey\]\)/)
})

test("attachment finalization rejects reuse of an already finalized storage key", async () => {
  process.env.FLOWBOARD_AUTH_MODE = "dev"
  try {
    ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
      id: "ws-1",
      ownerId: "owner-1",
    })) as unknown) as typeof db.workspace.findUnique
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
      userId: "member-1",
      role: "MEMBER",
    })) as unknown) as typeof db.workspaceMember.findUnique
    ;(db.workItem as typeof db.workItem).findUnique = ((async () => ({
      id: "task-1",
      workspaceId: "ws-1",
      projectId: null,
      title: "Task",
    })) as unknown) as typeof db.workItem.findUnique
    ;(db.attachment as typeof db.attachment).findFirst = ((async () => ({
      id: "attachment-1",
    })) as unknown) as typeof db.attachment.findFirst

    let created = false
    ;(db as typeof db).$transaction = (async () => {
      created = true
      throw new Error("duplicate storage key must not create another attachment")
    }) as typeof db.$transaction

    const response = await createAttachment(
      new NextRequest("http://localhost/api/attachments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-flowboard-user-id": "member-1",
        },
        body: JSON.stringify({
          workspaceId: "ws-1",
          workItemId: "task-1",
          name: "notes.txt",
          storageKey: "ws-1/2026/07/replay.txt",
          mimeType: "text/plain",
          sizeBytes: 10,
        }),
      })
    )

    assert.equal(response.status, 400)
    assert.equal(created, false)
  } finally {
    restoreEnv()
  }
})

test("Firebase upload target requires create-only object generation", async () => {
  const source = await readFile("src/lib/storage.ts", "utf8")
  assert.match(source, /queryParams:\s*\{\s*ifGenerationMatch:\s*"0"\s*\}/)

  const config = buildFirebaseUploadSignedUrlConfig({
    mimeType: "text/plain",
    expiresAtMs: 123,
  })
  assert.deepEqual(config.queryParams, { ifGenerationMatch: "0" })
})
