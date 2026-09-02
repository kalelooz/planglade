import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import test, { after, before } from "node:test"
import { NextRequest } from "next/server"

import { createIsolatedTestDatabase } from "./helpers/isolated-test-database"

const isolatedDatabase = createIsolatedTestDatabase()
const execFileAsync = promisify(execFile)
let storageRoot: string
let db: typeof import("../src/lib/db").db
let reserveAttachmentUpload: typeof import("../src/lib/attachment-reservations").reserveAttachmentUpload
let finalizeAttachmentReservation: typeof import("../src/lib/attachment-reservations").finalizeAttachmentReservation
let attachmentUploadDrainMs: number
let reapExpiredAttachmentUploads: typeof import("../src/lib/attachment-reaper").reapExpiredAttachmentUploads
let writeLocalStorageObject: typeof import("../src/lib/storage").writeLocalStorageObject
let storageObjectExists: typeof import("../src/lib/storage").storageObjectExists
let createAttachmentUploadTarget: typeof import("../src/lib/storage").createAttachmentUploadTarget
let deleteStorageObject: typeof import("../src/lib/storage").deleteStorageObject
let uploadLocalAttachment: typeof import("../src/app/api/attachments/upload-binary/route").PUT
let deleteAttachment: typeof import("../src/app/api/attachments/[attachmentId]/route").DELETE
let enqueueAttachmentDeletion: typeof import("../src/lib/attachment-deletion").enqueueAttachmentDeletion
let attemptAttachmentDeletion: typeof import("../src/lib/attachment-deletion").attemptAttachmentDeletion
let reapPendingAttachmentDeletions: typeof import("../src/lib/attachment-deletion").reapPendingAttachmentDeletions
let prepareAttachmentParentDeletion: typeof import("../src/lib/attachment-deletion").prepareAttachmentParentDeletion

before(async () => {
  storageRoot = await mkdtemp(path.join(tmpdir(), "planglade-reservations-"))
  process.env.PLANGLADE_STORAGE_PROVIDER = "local"
  process.env.PLANGLADE_LOCAL_STORAGE_DIR = storageRoot
  process.env.PLANGLADE_STORAGE_SIGNING_SECRET = "reservation-test-secret"
  process.env.PLANGLADE_WORKSPACE_STORAGE_QUOTA_BYTES = "100"
  ;({ db } = await import("../src/lib/db"))
  const attachmentReservations = await import("../src/lib/attachment-reservations")
  ;({ reserveAttachmentUpload, finalizeAttachmentReservation } = attachmentReservations)
  attachmentUploadDrainMs = attachmentReservations.ATTACHMENT_UPLOAD_DRAIN_MS
  ;({ reapExpiredAttachmentUploads } = await import("../src/lib/attachment-reaper"))
  ;({
    writeLocalStorageObject,
    storageObjectExists,
    createAttachmentUploadTarget,
    deleteStorageObject,
  } = await import("../src/lib/storage"))
  ;({ PUT: uploadLocalAttachment } = await import("../src/app/api/attachments/upload-binary/route"))
  ;({ DELETE: deleteAttachment } = await import("../src/app/api/attachments/[attachmentId]/route"))
  ;({
    enqueueAttachmentDeletion,
    attemptAttachmentDeletion,
    reapPendingAttachmentDeletions,
    prepareAttachmentParentDeletion,
  } = await import("../src/lib/attachment-deletion"))
  await db.user.create({ data: { id: "owner-1", email: "alex.morgan@planglade.dev", normalizedEmail: "alex.morgan@planglade.dev" } })
  await db.workspace.create({ data: { id: "workspace-1", slug: "workspace-1", name: "Workspace", ownerId: "owner-1" } })
  await db.workspaceMember.create({ data: { id: "owner-membership", workspaceId: "workspace-1", userId: "owner-1", role: "OWNER" } })
})

after(async () => {
  await db.$disconnect()
  for (const key of [
    "PLANGLADE_STORAGE_PROVIDER",
    "PLANGLADE_LOCAL_STORAGE_DIR",
    "PLANGLADE_STORAGE_SIGNING_SECRET",
    "PLANGLADE_WORKSPACE_STORAGE_QUOTA_BYTES",
    "PLANGLADE_AUTH_MODE",
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

function deletionResult(stdout: string) {
  const match = stdout.match(/ATTACHMENT_DELETION_RESULT=(\{[^\r\n]+\})/)
  assert.ok(match, "cleanup subprocess must report its result")
  return JSON.parse(match[1])
}

function deletionAttemptResult(stdout: string) {
  const match = stdout.match(/ATTACHMENT_DELETION_ATTEMPT=(deleted|failed|skipped)/)
  assert.ok(match, "deletion subprocess must report its result")
  return match[1]
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
      expiresAt: new Date(Date.now() - attachmentUploadDrainMs - 1000),
    },
  })

  const result = await reapExpiredAttachmentUploads()
  assert.equal(result.reservationsRemoved, 1)
  assert.equal(await storageObjectExists(storageKey), false)
  assert.equal(await db.attachmentUploadReservation.findUnique({ where: { id: "expired-reservation" } }), null)
})

test("the reaper preserves an object when finalization wins the cleanup race", async () => {
  const storageKey = "workspace-1/finalized-during-reap"
  await writeLocalStorageObject({
    storageKey,
    mimeType: "text/plain",
    bytes: new TextEncoder().encode("kept"),
  })
  const reservation = await db.attachmentUploadReservation.create({
    data: {
      id: "finalized-during-reap",
      workspaceId: "workspace-1",
      actorUserId: "owner-1",
      storageKey,
      mimeType: "text/plain",
      sizeBytes: 4,
      expiresAt: new Date(Date.now() - attachmentUploadDrainMs - 1000),
    },
  })

  const originalFindMany = db.attachmentUploadReservation.findMany
  ;(db.attachmentUploadReservation as typeof db.attachmentUploadReservation).findMany = (async (args) => {
    const listed = await originalFindMany(args)
    await db.$transaction(async (tx) => {
      await finalizeAttachmentReservation(tx, {
        reservationId: reservation.id,
        workspaceId: "workspace-1",
        now: new Date(reservation.expiresAt.getTime() - 1),
      })
      await tx.attachment.create({
        data: {
          workspaceId: "workspace-1",
          uploadedById: "owner-1",
          name: "kept.txt",
          storageKey,
          mimeType: "text/plain",
          sizeBytes: 4,
        },
      })
    })
    return listed
  }) as typeof db.attachmentUploadReservation.findMany

  try {
    const result = await reapExpiredAttachmentUploads()
    assert.equal(result.reservationsRemoved, 0)
    assert.equal(await storageObjectExists(storageKey), true)
    assert.ok(await db.attachment.findUnique({ where: { storageKey } }))
  } finally {
    ;(db.attachmentUploadReservation as typeof db.attachmentUploadReservation).findMany = originalFindMany
  }
})

test("parallel deletion workers claim one provider attempt", async () => {
  const queued = await db.$transaction((tx) => enqueueAttachmentDeletion(
    tx,
    "workspace-1/parallel-delete.txt",
  ))
  let providerCalls = 0
  const deleteObject = async () => {
    providerCalls += 1
    await new Promise((resolve) => setTimeout(resolve, 25))
    return true
  }

  const results = await Promise.all([
    attemptAttachmentDeletion(queued.id, { deleteObject, clock: () => queued.nextAttemptAt }),
    attemptAttachmentDeletion(queued.id, { deleteObject, clock: () => queued.nextAttemptAt }),
  ])

  assert.deepEqual(results.sort(), ["deleted", "skipped"])
  assert.equal(providerCalls, 1)
  assert.equal(await db.attachmentDeletionJob.findUnique({ where: { id: queued.id } }), null)
})

test("parallel processes claim one deletion attempt", async () => {
  const storageKey = "workspace-1/process-delete.txt"
  await writeLocalStorageObject({
    storageKey,
    mimeType: "text/plain",
    bytes: new TextEncoder().encode("delete once"),
  })
  const queued = await db.$transaction((tx) => enqueueAttachmentDeletion(tx, storageKey))
  const attemptAt = new Date(queued.nextAttemptAt.getTime() + 1000).toISOString()
  const attempts = await Promise.all([
    execFileAsync(
      process.execPath,
      ["--import", "tsx", "tests/helpers/attempt-attachment-deletion.ts", queued.id, attemptAt],
      { cwd: path.resolve("."), env: { ...process.env }, windowsHide: true },
    ),
    execFileAsync(
      process.execPath,
      ["--import", "tsx", "tests/helpers/attempt-attachment-deletion.ts", queued.id, attemptAt],
      { cwd: path.resolve("."), env: { ...process.env }, windowsHide: true },
    ),
  ])

  assert.deepEqual(attempts.map(({ stdout }) => deletionAttemptResult(stdout)).sort(), ["deleted", "skipped"])
  assert.equal(await storageObjectExists(storageKey), false)
  assert.equal(await db.attachmentDeletionJob.findUnique({ where: { id: queued.id } }), null)
})

test("an expired deletion claim is recovered after a worker stops", async () => {
  const now = new Date()
  const queued = await db.attachmentDeletionJob.create({
    data: {
      storageKey: "workspace-1/abandoned-delete.txt",
      nextAttemptAt: new Date(now.getTime() - 2000),
      claimId: "abandoned-worker",
      claimExpiresAt: new Date(now.getTime() - 1000),
    },
  })
  let providerCalls = 0

  const result = await attemptAttachmentDeletion(queued.id, {
    clock: () => now,
    deleteObject: async () => {
      providerCalls += 1
      return true
    },
  })

  assert.equal(result, "deleted")
  assert.equal(providerCalls, 1)
  assert.equal(await db.attachmentDeletionJob.findUnique({ where: { id: queued.id } }), null)
})

test("a stale worker cannot overwrite a newer claim result", async () => {
  const startedAt = new Date()
  const queued = await db.attachmentDeletionJob.create({
    data: {
      storageKey: "workspace-1/stale-worker-delete.txt",
      nextAttemptAt: startedAt,
    },
  })
  let releaseFirstAttempt: ((deleted: boolean) => void) | undefined
  let firstAttemptStarted: (() => void) | undefined
  const started = new Promise<void>((resolve) => { firstAttemptStarted = resolve })
  const firstAttempt = attemptAttachmentDeletion(queued.id, {
    clock: () => startedAt,
    deleteObject: () => new Promise<boolean>((resolve) => {
      releaseFirstAttempt = resolve
      firstAttemptStarted?.()
    }),
  })
  await started

  const takeoverAt = new Date(startedAt.getTime() + 6 * 60 * 1000)
  const takeover = await attemptAttachmentDeletion(queued.id, {
    clock: () => takeoverAt,
    deleteObject: async () => true,
  })
  releaseFirstAttempt?.(false)

  assert.equal(takeover, "deleted")
  assert.equal(await firstAttempt, "skipped")
  assert.equal(await db.attachmentDeletionJob.findUnique({ where: { id: queued.id } }), null)
})

test("retry timing uses failure completion and caps exponential backoff", async () => {
  const startedAt = new Date()
  const failedAt = new Date(startedAt.getTime() + 20_000)
  const growing = await db.attachmentDeletionJob.create({
    data: {
      storageKey: "workspace-1/growing-backoff.txt",
      attemptCount: 1,
      nextAttemptAt: startedAt,
    },
  })
  const growingTimes = [startedAt, failedAt]
  assert.equal(await attemptAttachmentDeletion(growing.id, {
    clock: () => growingTimes.shift() ?? failedAt,
    deleteObject: async () => false,
  }), "failed")
  const rescheduled = await db.attachmentDeletionJob.findUniqueOrThrow({ where: { id: growing.id } })
  assert.equal(rescheduled.nextAttemptAt.getTime(), failedAt.getTime() + 10_000)

  const capped = await db.attachmentDeletionJob.create({
    data: {
      storageKey: "workspace-1/capped-backoff.txt",
      attemptCount: 10,
      nextAttemptAt: startedAt,
    },
  })
  assert.equal(await attemptAttachmentDeletion(capped.id, {
    clock: () => failedAt,
    deleteObject: async () => false,
  }), "failed")
  const cappedJob = await db.attachmentDeletionJob.findUniqueOrThrow({ where: { id: capped.id } })
  assert.equal(cappedJob.nextAttemptAt.getTime(), failedAt.getTime() + 60 * 60 * 1000)
  await db.attachmentDeletionJob.deleteMany({ where: { id: { in: [growing.id, capped.id] } } })
})

test("a delayed deletion batch gives each job a fresh claim and retry time", async () => {
  const batchAt = new Date()
  const delayedAt = new Date(batchAt.getTime() + 6 * 60 * 1000)
  const first = await db.attachmentDeletionJob.create({
    data: { storageKey: "workspace-1/delayed-first.txt", nextAttemptAt: new Date(batchAt.getTime() - 2000) },
  })
  const second = await db.attachmentDeletionJob.create({
    data: { storageKey: "workspace-1/delayed-second.txt", nextAttemptAt: new Date(batchAt.getTime() - 1000) },
  })
  const times = [batchAt, delayedAt, delayedAt]
  let secondClaimExpiresAtMs: number | undefined
  const result = await reapPendingAttachmentDeletions(batchAt, {
    clock: () => times.shift() ?? delayedAt,
    deleteObject: async (storageKey) => {
      if (storageKey === first.storageKey) return false
      secondClaimExpiresAtMs = (await db.attachmentDeletionJob.findUniqueOrThrow({ where: { id: second.id } })).claimExpiresAt?.getTime()
      return true
    },
  })

  assert.deepEqual(result, { deletionsRemoved: 1, deletionFailures: 1 })
  assert.equal(secondClaimExpiresAtMs, delayedAt.getTime() + 5 * 60 * 1000)
  const failed = await db.attachmentDeletionJob.findUniqueOrThrow({ where: { id: first.id } })
  assert.equal(failed.nextAttemptAt.getTime(), delayedAt.getTime() + 5000)
  await db.attachmentDeletionJob.delete({ where: { id: first.id } })
})

test("deletion intent rolls back with the attachment transaction", async () => {
  const storageKey = "workspace-1/rollback-delete.txt"
  await db.attachment.create({
    data: {
      id: "rollback-delete-attachment",
      workspaceId: "workspace-1",
      uploadedById: "owner-1",
      name: "rollback-delete.txt",
      storageKey,
      mimeType: "text/plain",
      sizeBytes: 1,
    },
  })

  await assert.rejects(db.$transaction(async (tx) => {
    await enqueueAttachmentDeletion(tx, storageKey)
    await tx.attachment.delete({ where: { id: "rollback-delete-attachment" } })
    throw new Error("simulated activity failure")
  }), /simulated activity failure/)

  assert.ok(await db.attachment.findUnique({ where: { id: "rollback-delete-attachment" } }))
  assert.equal(await db.attachmentDeletionJob.findUnique({ where: { storageKey } }), null)
  await db.attachment.delete({ where: { id: "rollback-delete-attachment" } })
})

test("attachment deletion survives a temporary storage-provider failure", async () => {
  const storageKey = "workspace-1/delete-retry.txt"
  await writeLocalStorageObject({
    storageKey,
    mimeType: "text/plain",
    bytes: new TextEncoder().encode("retry me"),
  })
  await db.workItem.create({
    data: {
      id: "delete-retry-task",
      workspaceId: "workspace-1",
      title: "Delete retry",
      createdById: "owner-1",
    },
  })
  await db.attachment.create({
    data: {
      id: "delete-retry-attachment",
      workspaceId: "workspace-1",
      workItemId: "delete-retry-task",
      uploadedById: "owner-1",
      name: "delete-retry.txt",
      storageKey,
      mimeType: "text/plain",
      sizeBytes: 8,
    },
  })

  process.env.PLANGLADE_AUTH_MODE = "dev"
  process.env.PLANGLADE_STORAGE_PROVIDER = "temporarily-unavailable"
  const response = await deleteAttachment(
    new NextRequest("http://localhost/api/attachments/delete-retry-attachment?workspaceId=workspace-1", {
      method: "DELETE",
      headers: { "x-planglade-user-id": "owner-1" },
    }),
    { params: Promise.resolve({ attachmentId: "delete-retry-attachment" }) },
  )
  process.env.PLANGLADE_STORAGE_PROVIDER = "local"

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { deleted: true, storageDeleted: false })
  assert.equal(await db.attachment.findUnique({ where: { id: "delete-retry-attachment" } }), null)
  assert.equal(await storageObjectExists(storageKey), true)
  const queued = await db.attachmentDeletionJob.findUnique({ where: { storageKey } })
  assert.ok(queued)
  assert.equal(queued.attemptCount, 1)
  assert.equal(queued.lastError, "Error")

  const retryAt = new Date(queued.nextAttemptAt.getTime() + 1000).toISOString()
  const firstRetry = await execFileAsync(
    process.execPath,
    ["--import", "tsx", "tests/helpers/reap-attachment-deletions.ts", retryAt],
    { cwd: path.resolve("."), env: { ...process.env, PLANGLADE_STORAGE_PROVIDER: "local" }, windowsHide: true },
  )
  assert.deepEqual(deletionResult(firstRetry.stdout), { deletionsRemoved: 1, deletionFailures: 0 })
  assert.equal(await storageObjectExists(storageKey), false)
  assert.equal(await db.attachmentDeletionJob.findUnique({ where: { storageKey } }), null)

  const repeatedRetry = await execFileAsync(
    process.execPath,
    ["--import", "tsx", "tests/helpers/reap-attachment-deletions.ts", new Date(Date.parse(retryAt) + 1000).toISOString()],
    { cwd: path.resolve("."), env: { ...process.env, PLANGLADE_STORAGE_PROVIDER: "local" }, windowsHide: true },
  )
  assert.deepEqual(deletionResult(repeatedRetry.stdout), { deletionsRemoved: 0, deletionFailures: 0 })
})

test("parent deletion keeps cleanup pending while an admitted upload drains", async () => {
  const storageKey = "workspace-1/slow-parent-upload.txt"
  const expiresAt = new Date(Date.now() + 60_000)
  let releaseUpload!: () => void
  const uploadGate = new Promise<void>((resolve) => {
    releaseUpload = resolve
  })
  let markUploadStarted!: () => void
  const uploadStarted = new Promise<void>((resolve) => {
    markUploadStarted = resolve
  })
  const source = new ReadableStream<Uint8Array>({
    async pull(controller) {
      await uploadGate
      controller.enqueue(new TextEncoder().encode("slow"))
      controller.close()
    },
  })

  await db.note.create({
    data: {
      id: "slow-upload-note",
      workspaceId: "workspace-1",
      title: "Slow upload parent",
      createdById: "owner-1",
      updatedById: "owner-1",
    },
  })
  const reservation = await db.attachmentUploadReservation.create({
    data: {
      id: "00000000-0000-4000-8000-000000000099",
      workspaceId: "workspace-1",
      actorUserId: "owner-1",
      noteId: "slow-upload-note",
      storageKey,
      mimeType: "text/plain",
      sizeBytes: 4,
      expiresAt,
    },
  })
  const target = await createAttachmentUploadTarget({
    storageKey,
    mimeType: "text/plain",
    reservationId: reservation.id,
    expectedSizeBytes: 4,
    expiresAt,
  })
  const uploadUrl = new URL(target.uploadUrl, "http://localhost")
  assert.equal(Number(uploadUrl.searchParams.get("expires")), expiresAt.getTime())

  const upload = uploadLocalAttachment({
    nextUrl: uploadUrl,
    headers: new Headers({ "content-type": "text/plain" }),
    body: {
      getReader() {
        markUploadStarted()
        return source.getReader()
      },
    },
  } as unknown as NextRequest)

  try {
    await uploadStarted
    const jobs = await db.$transaction(async (tx) => {
      const queued = await prepareAttachmentParentDeletion(tx, { noteId: "slow-upload-note" })
      await tx.note.delete({ where: { id: "slow-upload-note" } })
      return queued
    })
    assert.equal(jobs.length, 1)
    assert.equal(
      jobs[0]?.nextAttemptAt.getTime(),
      expiresAt.getTime() + attachmentUploadDrainMs,
    )

    const afterCapabilityExpiry = new Date(expiresAt.getTime() + 1)
    await reapExpiredAttachmentUploads(afterCapabilityExpiry)
    assert.ok(await db.attachmentDeletionJob.findUnique({ where: { storageKey } }))
    assert.equal(await storageObjectExists(storageKey), false)

    releaseUpload()
    assert.equal((await upload).status, 200)
    assert.equal(await storageObjectExists(storageKey), true)

    const afterDrain = new Date(expiresAt.getTime() + attachmentUploadDrainMs + 1)
    await reapPendingAttachmentDeletions(afterDrain, { clock: () => afterDrain })
    assert.equal(await storageObjectExists(storageKey), false)
    assert.equal(await db.attachmentDeletionJob.findUnique({ where: { storageKey } }), null)
  } finally {
    releaseUpload()
    await upload.catch(() => undefined)
    await Promise.all([
      deleteStorageObject(storageKey),
      db.attachmentDeletionJob.deleteMany({ where: { storageKey } }),
      db.attachmentUploadReservation.deleteMany({ where: { id: reservation.id } }),
      db.note.deleteMany({ where: { id: "slow-upload-note" } }),
    ])
  }
})

test("direct deletion delays cleanup while a finalized upload capability can replay", async () => {
  const storageKey = "workspace-1/finalized-replay.txt"
  const expiresAt = new Date(Date.now() + 60_000)
  process.env.PLANGLADE_AUTH_MODE = "dev"
  await db.workItem.create({
    data: {
      id: "finalized-replay-task",
      workspaceId: "workspace-1",
      title: "Finalized replay",
      createdById: "owner-1",
    },
  })
  const reservation = await db.attachmentUploadReservation.create({
    data: {
      id: "00000000-0000-4000-8000-000000000098",
      workspaceId: "workspace-1",
      actorUserId: "owner-1",
      workItemId: "finalized-replay-task",
      storageKey,
      mimeType: "text/plain",
      sizeBytes: 8,
      expiresAt,
      consumedAt: new Date(),
    },
  })
  await writeLocalStorageObject({
    storageKey,
    mimeType: "text/plain",
    bytes: new TextEncoder().encode("original"),
  })
  await db.attachment.create({
    data: {
      id: "finalized-replay-attachment",
      workspaceId: "workspace-1",
      workItemId: "finalized-replay-task",
      uploadedById: "owner-1",
      name: "finalized-replay.txt",
      storageKey,
      mimeType: "text/plain",
      sizeBytes: 8,
    },
  })
  const target = await createAttachmentUploadTarget({
    storageKey,
    mimeType: "text/plain",
    reservationId: reservation.id,
    expectedSizeBytes: 8,
    expiresAt,
  })

  try {
    const response = await deleteAttachment(
      new NextRequest(
        "http://localhost/api/attachments/finalized-replay-attachment?workspaceId=workspace-1",
        { method: "DELETE", headers: { "x-planglade-user-id": "owner-1" } },
      ),
      { params: Promise.resolve({ attachmentId: "finalized-replay-attachment" }) },
    )
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { deleted: true, storageDeleted: false })
    const job = await db.attachmentDeletionJob.findUniqueOrThrow({ where: { storageKey } })
    assert.equal(job.nextAttemptAt.getTime(), expiresAt.getTime() + attachmentUploadDrainMs)
    assert.equal(await storageObjectExists(storageKey), true)

    const replay = await uploadLocalAttachment(new NextRequest(
      new URL(target.uploadUrl, "http://localhost"),
      {
        method: "PUT",
        headers: { "content-type": "text/plain" },
        body: new TextEncoder().encode("replayed"),
      },
    ))
    assert.equal(replay.status, 409)
    assert.equal(await storageObjectExists(storageKey), true)

    const afterDrain = new Date(expiresAt.getTime() + attachmentUploadDrainMs + 1)
    await reapPendingAttachmentDeletions(afterDrain, { clock: () => afterDrain })
    assert.equal(await storageObjectExists(storageKey), false)
    assert.equal(await db.attachmentDeletionJob.findUnique({ where: { storageKey } }), null)
  } finally {
    await Promise.all([
      deleteStorageObject(storageKey),
      db.attachment.deleteMany({ where: { id: "finalized-replay-attachment" } }),
      db.attachmentDeletionJob.deleteMany({ where: { storageKey } }),
    ])
    await db.attachmentUploadReservation.deleteMany({ where: { id: reservation.id } })
    await db.workItem.deleteMany({ where: { id: "finalized-replay-task" } })
  }
})
