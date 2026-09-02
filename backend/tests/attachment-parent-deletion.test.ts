import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { NextRequest } from "next/server"

import { createIsolatedTestDatabase } from "./helpers/isolated-test-database"

test("task and note deletion retain cleanup intent when storage is unavailable", async () => {
  const isolated = createIsolatedTestDatabase()
  const storageRoot = await mkdtemp(path.join(tmpdir(), "planglade-parent-deletion-"))
  process.env.PLANGLADE_AUTH_MODE = "dev"
  process.env.PLANGLADE_STORAGE_PROVIDER = "local"
  process.env.PLANGLADE_LOCAL_STORAGE_DIR = storageRoot
  process.env.PLANGLADE_STORAGE_SIGNING_SECRET = "parent-deletion-test-secret"

  const { db } = await import("../src/lib/db")
  const { DELETE: deleteTask } = await import("../src/app/api/work-items/[workItemId]/route")
  const { DELETE: deleteNote } = await import("../src/app/api/notes/[noteId]/route")
  const { ATTACHMENT_UPLOAD_DRAIN_MS } = await import("../src/lib/attachment-reservations")
  const { prepareAttachmentParentDeletion, reapPendingAttachmentDeletions } = await import("../src/lib/attachment-deletion")
  const { deleteStorageObject, storageObjectExists, writeLocalStorageObject } = await import("../src/lib/storage")

  try {
    await db.user.create({
      data: {
        id: "owner-1",
        email: "alex.morgan@planglade.dev",
        normalizedEmail: "alex.morgan@planglade.dev",
      },
    })
    await db.workspace.create({
      data: {
        id: "workspace-1",
        slug: "workspace-1",
        name: "Workspace",
        ownerId: "owner-1",
        memberships: { create: { userId: "owner-1", role: "OWNER" } },
      },
    })
    const task = await db.workItem.create({
      data: {
        id: "task-1",
        workspaceId: "workspace-1",
        title: "Task with attachment",
        status: "TODO",
        createdById: "owner-1",
      },
    })
    const note = await db.note.create({
      data: {
        id: "note-1",
        workspaceId: "workspace-1",
        title: "Note with attachment",
        createdById: "owner-1",
        updatedById: "owner-1",
        visibility: "WORKSPACE",
      },
    })
    const child = await db.workItem.create({
      data: {
        id: "child-task",
        workspaceId: "workspace-1",
        parentId: task.id,
        title: "Preserved child",
        status: "TODO",
        createdById: "owner-1",
      },
    })
    const attachments = [
      { id: "task-attachment", workItemId: task.id, noteId: null, storageKey: "workspace-1/task.txt" },
      { id: "note-attachment", workItemId: null, noteId: note.id, storageKey: "workspace-1/note.txt" },
      { id: "child-attachment", workItemId: child.id, noteId: null, storageKey: "workspace-1/child.txt" },
    ]
    for (const attachment of attachments) {
      await writeLocalStorageObject({
        storageKey: attachment.storageKey,
        mimeType: "text/plain",
        bytes: new TextEncoder().encode(attachment.id),
      })
      await db.attachment.create({
        data: {
          ...attachment,
          workspaceId: "workspace-1",
          uploadedById: "owner-1",
          name: `${attachment.id}.txt`,
          mimeType: "text/plain",
          sizeBytes: attachment.id.length,
        },
      })
    }
    const pendingStorageKey = "workspace-1/pending-upload.txt"
    const pendingExpiresAt = new Date(Date.now() + 60_000)
    const finalizedExpiresAt = new Date(Date.now() + 120_000)
    await writeLocalStorageObject({
      storageKey: pendingStorageKey,
      mimeType: "text/plain",
      bytes: new TextEncoder().encode("pending"),
    })
    await db.attachmentUploadReservation.create({
      data: {
        id: "pending-task-upload",
        workspaceId: "workspace-1",
        actorUserId: "owner-1",
        workItemId: task.id,
        storageKey: pendingStorageKey,
        mimeType: "text/plain",
        sizeBytes: 7,
        expiresAt: pendingExpiresAt,
      },
    })
    await db.attachmentUploadReservation.create({
      data: {
        id: "finalized-task-upload",
        workspaceId: "workspace-1",
        actorUserId: "owner-1",
        workItemId: task.id,
        storageKey: "workspace-1/task.txt",
        mimeType: "text/plain",
        sizeBytes: "task-attachment".length,
        expiresAt: finalizedExpiresAt,
        consumedAt: new Date(),
      },
    })

    const rollbackNote = await db.note.create({
      data: {
        id: "rollback-note",
        workspaceId: "workspace-1",
        title: "Rollback note",
        createdById: "owner-1",
        updatedById: "owner-1",
      },
    })
    const rollbackStorageKey = "workspace-1/rollback-note.txt"
    await writeLocalStorageObject({
      storageKey: rollbackStorageKey,
      mimeType: "text/plain",
      bytes: new TextEncoder().encode("rollback"),
    })
    await db.attachment.create({
      data: {
        id: "rollback-note-attachment",
        workspaceId: "workspace-1",
        noteId: rollbackNote.id,
        uploadedById: "owner-1",
        name: "rollback.txt",
        storageKey: rollbackStorageKey,
      },
    })
    await assert.rejects(db.$transaction(async (tx) => {
      await prepareAttachmentParentDeletion(tx, { noteId: rollbackNote.id })
      await tx.note.delete({ where: { id: rollbackNote.id } })
      throw new Error("simulated activity failure")
    }), /simulated activity failure/)
    assert.ok(await db.note.findUnique({ where: { id: rollbackNote.id } }))
    assert.ok(await db.attachment.findUnique({ where: { id: "rollback-note-attachment" } }))
    assert.equal(await db.attachmentDeletionJob.findUnique({ where: { storageKey: rollbackStorageKey } }), null)
    await db.attachment.delete({ where: { id: "rollback-note-attachment" } })
    await db.note.delete({ where: { id: rollbackNote.id } })
    await deleteStorageObject(rollbackStorageKey)

    const laneConflictTask = await db.workItem.create({
      data: {
        id: "lane-conflict-task",
        workspaceId: "workspace-1",
        title: "Lane conflict task",
        status: "IN_PROGRESS",
        createdById: "owner-1",
      },
    })
    const laneConflictStorageKey = "workspace-1/lane-conflict.txt"
    await writeLocalStorageObject({
      storageKey: laneConflictStorageKey,
      mimeType: "text/plain",
      bytes: new TextEncoder().encode("lane conflict"),
    })
    await db.attachment.create({
      data: {
        id: "lane-conflict-attachment",
        workspaceId: "workspace-1",
        workItemId: laneConflictTask.id,
        uploadedById: "owner-1",
        name: "lane-conflict.txt",
        storageKey: laneConflictStorageKey,
      },
    })
    const laneConflictResponse = await deleteTask(new NextRequest(
      "http://localhost/api/work-items/lane-conflict-task?workspaceId=workspace-1",
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedUpdatedAt: laneConflictTask.updatedAt.toISOString(),
          expectedLaneVersions: { IN_PROGRESS: 1 },
        }),
      },
    ), { params: Promise.resolve({ workItemId: laneConflictTask.id }) })
    assert.equal(laneConflictResponse.status, 409)
    assert.ok(await db.workItem.findUnique({ where: { id: laneConflictTask.id } }))
    assert.ok(await db.attachment.findUnique({ where: { id: "lane-conflict-attachment" } }))
    assert.equal(await db.attachmentDeletionJob.findUnique({ where: { storageKey: laneConflictStorageKey } }), null)
    await db.attachment.delete({ where: { id: "lane-conflict-attachment" } })
    await db.workItem.delete({ where: { id: laneConflictTask.id } })
    await deleteStorageObject(laneConflictStorageKey)

    process.env.PLANGLADE_STORAGE_PROVIDER = "temporarily-unavailable"
    const taskResponse = await deleteTask(new NextRequest(
      "http://localhost/api/work-items/task-1?workspaceId=workspace-1",
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedUpdatedAt: task.updatedAt.toISOString(),
          expectedLaneVersions: { TODO: 0 },
        }),
      },
    ), { params: Promise.resolve({ workItemId: task.id }) })
    const noteResponse = await deleteNote(new NextRequest(
      "http://localhost/api/notes/note-1?workspaceId=workspace-1",
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedUpdatedAt: note.updatedAt.toISOString() }),
      },
    ), { params: Promise.resolve({ noteId: note.id }) })
    process.env.PLANGLADE_STORAGE_PROVIDER = "local"

    assert.deepEqual([taskResponse.status, noteResponse.status], [200, 200])
    assert.equal(await db.attachment.count(), 1)
    assert.equal(await db.attachmentUploadReservation.count(), 0)
    assert.deepEqual(
      await db.workItem.findUnique({ where: { id: child.id }, select: { parentId: true } }),
      { parentId: null },
    )
    assert.ok(await db.attachment.findUnique({ where: { id: "child-attachment" } }))
    const jobs = await db.attachmentDeletionJob.findMany({ orderBy: { storageKey: "asc" } })
    assert.deepEqual(jobs.map((job) => job.storageKey), [
      "workspace-1/note.txt",
      "workspace-1/pending-upload.txt",
      "workspace-1/task.txt",
    ])
    const immediateJob = jobs.find((job) => job.storageKey === "workspace-1/note.txt")
    assert.ok(immediateJob)
    assert.equal(immediateJob.attemptCount, 1)
    assert.equal(immediateJob.lastError, "Error")
    const finalizedJob = jobs.find((job) => job.storageKey === "workspace-1/task.txt")
    assert.ok(finalizedJob)
    assert.equal(finalizedJob.attemptCount, 0)
    assert.equal(
      finalizedJob.nextAttemptAt.getTime(),
      finalizedExpiresAt.getTime() + ATTACHMENT_UPLOAD_DRAIN_MS,
    )
    const pendingJob = jobs.find((job) => job.storageKey === pendingStorageKey)
    assert.ok(pendingJob)
    assert.equal(pendingJob.attemptCount, 0)
    assert.equal(
      pendingJob.nextAttemptAt.getTime(),
      pendingExpiresAt.getTime() + ATTACHMENT_UPLOAD_DRAIN_MS,
    )
    assert.equal(await storageObjectExists("workspace-1/task.txt"), true)
    assert.equal(await storageObjectExists("workspace-1/note.txt"), true)
    assert.equal(await storageObjectExists(pendingStorageKey), true)
    assert.equal(await storageObjectExists("workspace-1/child.txt"), true)

    const retryAt = new Date(Math.max(...jobs.map((job) => job.nextAttemptAt.getTime())) + 1000)
    assert.deepEqual(
      await reapPendingAttachmentDeletions(retryAt, { clock: () => retryAt }),
      { deletionsRemoved: 3, deletionFailures: 0 },
    )
    assert.equal(await storageObjectExists("workspace-1/task.txt"), false)
    assert.equal(await storageObjectExists("workspace-1/note.txt"), false)
    assert.equal(await storageObjectExists(pendingStorageKey), false)
    assert.equal(await storageObjectExists("workspace-1/child.txt"), true)
    assert.equal(await db.attachmentDeletionJob.count(), 0)
  } finally {
    await db.$disconnect()
    for (const key of [
      "PLANGLADE_AUTH_MODE",
      "PLANGLADE_STORAGE_PROVIDER",
      "PLANGLADE_LOCAL_STORAGE_DIR",
      "PLANGLADE_STORAGE_SIGNING_SECRET",
    ]) delete process.env[key]
    await Promise.all([
      isolated.cleanup(),
      rm(storageRoot, { recursive: true, force: true }),
    ])
  }
})
