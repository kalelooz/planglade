import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test, { after, before } from "node:test"

import { createIsolatedTestDatabase } from "./helpers/isolated-test-database"

const isolatedDatabase = createIsolatedTestDatabase()
let storageRoot: string
let db: typeof import("../src/lib/db").db
let reserveAttachmentUpload: typeof import("../src/lib/attachment-reservations").reserveAttachmentUpload
let finalizeAttachmentReservation: typeof import("../src/lib/attachment-reservations").finalizeAttachmentReservation
let reapExpiredAttachmentUploads: typeof import("../src/lib/attachment-reaper").reapExpiredAttachmentUploads
let writeLocalStorageObject: typeof import("../src/lib/storage").writeLocalStorageObject
let storageObjectExists: typeof import("../src/lib/storage").storageObjectExists

before(async () => {
  storageRoot = await mkdtemp(path.join(tmpdir(), "planglade-reservations-"))
  process.env.PLANGLADE_STORAGE_PROVIDER = "local"
  process.env.PLANGLADE_LOCAL_STORAGE_DIR = storageRoot
  process.env.PLANGLADE_STORAGE_SIGNING_SECRET = "reservation-test-secret"
  process.env.PLANGLADE_WORKSPACE_STORAGE_QUOTA_BYTES = "100"
  ;({ db } = await import("../src/lib/db"))
  ;({ reserveAttachmentUpload, finalizeAttachmentReservation } = await import("../src/lib/attachment-reservations"))
  ;({ reapExpiredAttachmentUploads } = await import("../src/lib/attachment-reaper"))
  ;({ writeLocalStorageObject, storageObjectExists } = await import("../src/lib/storage"))
  await db.user.create({ data: { id: "owner-1", email: "owner@example.com", normalizedEmail: "owner@example.com" } })
  await db.workspace.create({ data: { id: "workspace-1", slug: "workspace-1", name: "Workspace", ownerId: "owner-1" } })
})

after(async () => {
  await db.$disconnect()
  for (const key of [
    "PLANGLADE_STORAGE_PROVIDER",
    "PLANGLADE_LOCAL_STORAGE_DIR",
    "PLANGLADE_STORAGE_SIGNING_SECRET",
    "PLANGLADE_WORKSPACE_STORAGE_QUOTA_BYTES",
  ]) delete process.env[key]
  await Promise.all([
    isolatedDatabase.cleanup(),
    rm(storageRoot, { recursive: true, force: true }),
  ])
})

function reservationInput(storageKey: string, sizeBytes: number) {
  return {
    workspaceId: "workspace-1",
    actorUserId: "owner-1",
    storageKey,
    mimeType: "text/plain",
    sizeBytes,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  }
}

test("parallel reservations cannot exceed the workspace quota", async () => {
  const results = await Promise.allSettled([
    reserveAttachmentUpload(reservationInput("workspace-1/one", 60)),
    reserveAttachmentUpload(reservationInput("workspace-1/two", 60)),
  ])
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1)
  const reserved = await db.attachmentUploadReservation.aggregate({
    where: { workspaceId: "workspace-1", consumedAt: null },
    _sum: { sizeBytes: true },
  })
  assert.equal(reserved._sum.sizeBytes, 60)
})

test("a reservation has one finalization winner", async () => {
  await db.attachmentUploadReservation.deleteMany()
  const reservation = await reserveAttachmentUpload(reservationInput("workspace-1/finalize", 40))
  await db.$transaction((tx) => finalizeAttachmentReservation(tx, {
    reservationId: reservation.id,
    workspaceId: "workspace-1",
    now: new Date(),
  }))
  await assert.rejects(
    db.$transaction((tx) => finalizeAttachmentReservation(tx, {
      reservationId: reservation.id,
      workspaceId: "workspace-1",
      now: new Date(),
    })),
    /invalid, expired, or already consumed/,
  )
})

test("the reaper removes expired unfinalized objects and reservation records", async () => {
  const storageKey = "workspace-1/expired-object"
  await writeLocalStorageObject({
    storageKey,
    mimeType: "text/plain",
    bytes: new TextEncoder().encode("orphan"),
  })
  await db.attachmentUploadReservation.create({
    data: {
      id: "expired-reservation",
      workspaceId: "workspace-1",
      actorUserId: "owner-1",
      storageKey,
      mimeType: "text/plain",
      sizeBytes: 6,
      expiresAt: new Date(Date.now() - 1000),
    },
  })

  const result = await reapExpiredAttachmentUploads()
  assert.equal(result.reservationsRemoved, 1)
  assert.equal(await storageObjectExists(storageKey), false)
  assert.equal(await db.attachmentUploadReservation.findUnique({ where: { id: "expired-reservation" } }), null)
})
