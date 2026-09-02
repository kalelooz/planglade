import { randomUUID } from "node:crypto"
import type { Prisma } from "@prisma/client"

import { ATTACHMENT_UPLOAD_DRAIN_MS } from "@/lib/attachment-reservations"
import { db } from "@/lib/db"
import { deleteStorageObject } from "@/lib/storage"

const CLAIM_DURATION_MS = 5 * 60 * 1000
const MIN_RETRY_DELAY_MS = 5 * 1000
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000

type DeleteObject = (storageKey: string) => Promise<boolean>
type Clock = () => Date

type DeletionAttemptOptions = {
  deleteObject?: DeleteObject
  clock?: Clock
}

type AttachmentParent =
  | { workItemId: string }
  | { noteId: string }

export class AttachmentParentChangedError extends Error {}

class StorageDeletionIncompleteError extends Error {
  constructor() {
    super("Storage object deletion did not complete")
    this.name = "StorageDeletionIncompleteError"
  }
}

function safeErrorName(error: unknown) {
  const candidate = error instanceof Error ? error.name : "StorageDeletionError"
  return /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(candidate)
    ? candidate
    : "StorageDeletionError"
}

function retryDelayMs(attemptCount: number) {
  return Math.min(
    MAX_RETRY_DELAY_MS,
    MIN_RETRY_DELAY_MS * 2 ** Math.min(Math.max(attemptCount - 1, 0), 10),
  )
}

export function enqueueAttachmentDeletion(
  tx: Prisma.TransactionClient,
  storageKey: string,
  now = new Date(),
) {
  return tx.attachmentDeletionJob.upsert({
    where: { storageKey },
    update: {},
    create: { storageKey, nextAttemptAt: now },
  })
}

function deletionNotBefore(now: Date, reservationExpiresAt?: Date) {
  if (!reservationExpiresAt) return now
  return new Date(Math.max(
    now.getTime(),
    reservationExpiresAt.getTime() + ATTACHMENT_UPLOAD_DRAIN_MS,
  ))
}

export async function enqueueAttachmentStorageDeletion(
  tx: Prisma.TransactionClient,
  storageKey: string,
  now = new Date(),
) {
  const reservation = await tx.attachmentUploadReservation.findUnique({
    where: { storageKey },
    select: { expiresAt: true },
  })
  return enqueueAttachmentDeletion(tx, storageKey, deletionNotBefore(now, reservation?.expiresAt))
}

export async function prepareAttachmentParentDeletion(
  tx: Prisma.TransactionClient,
  parent: AttachmentParent,
) {
  const where = "workItemId" in parent
    ? { workItemId: parent.workItemId }
    : { noteId: parent.noteId }
  const [attachments, reservations] = await Promise.all([
    tx.attachment.findMany({ where, select: { id: true, storageKey: true } }),
    tx.attachmentUploadReservation.findMany({
      where,
      select: { id: true, storageKey: true, expiresAt: true },
    }),
  ])
  const now = new Date()
  const deletionTimes = new Map<string, Date>()
  for (const attachment of attachments) {
    deletionTimes.set(attachment.storageKey, now)
  }
  for (const reservation of reservations) {
    const notBefore = deletionNotBefore(now, reservation.expiresAt)
    const current = deletionTimes.get(reservation.storageKey)
    if (!current || notBefore > current) deletionTimes.set(reservation.storageKey, notBefore)
  }
  const jobs = await Promise.all([...deletionTimes].map(([storageKey, notBefore]) => (
    enqueueAttachmentDeletion(tx, storageKey, notBefore)
  )))
  const [attachmentsRemoved, reservationsRemoved] = await Promise.all([
    tx.attachment.deleteMany({ where: { id: { in: attachments.map(({ id }) => id) } } }),
    tx.attachmentUploadReservation.deleteMany({
      where: { id: { in: reservations.map(({ id }) => id) } },
    }),
  ])
  if (
    attachmentsRemoved.count !== attachments.length
    || reservationsRemoved.count !== reservations.length
  ) throw new AttachmentParentChangedError()
  return jobs
}

export async function attemptAttachmentDeletion(
  jobId: string,
  options: DeletionAttemptOptions = {},
) {
  const deleteObject = options.deleteObject ?? deleteStorageObject
  const clock = options.clock ?? (() => new Date())
  const startedAt = clock()
  const claimId = randomUUID()
  const claimExpiresAt = new Date(startedAt.getTime() + CLAIM_DURATION_MS)
  const claimed = await db.attachmentDeletionJob.updateMany({
    where: {
      id: jobId,
      nextAttemptAt: { lte: startedAt },
      OR: [
        { claimExpiresAt: null },
        { claimExpiresAt: { lte: startedAt } },
      ],
    },
    data: {
      claimId,
      claimExpiresAt,
      lastAttemptAt: startedAt,
      attemptCount: { increment: 1 },
    },
  })
  if (claimed.count !== 1) return "skipped" as const

  const job = await db.attachmentDeletionJob.findFirst({ where: { id: jobId, claimId } })
  if (!job) return "skipped" as const

  try {
    if (!await deleteObject(job.storageKey)) throw new StorageDeletionIncompleteError()
    const removed = await db.attachmentDeletionJob.deleteMany({ where: { id: job.id, claimId } })
    return removed.count === 1 ? "deleted" as const : "skipped" as const
  } catch (error) {
    const errorName = safeErrorName(error)
    const failedAt = clock()
    const rescheduled = await db.attachmentDeletionJob.updateMany({
      where: { id: job.id, claimId },
      data: {
        claimId: null,
        claimExpiresAt: null,
        nextAttemptAt: new Date(failedAt.getTime() + retryDelayMs(job.attemptCount)),
        lastError: errorName,
      },
    })
    if (rescheduled.count !== 1) return "skipped" as const
    console.error("Attachment storage deletion failed", { jobId: job.id, error: errorName })
    return "failed" as const
  }
}

export async function reapPendingAttachmentDeletions(
  now = new Date(),
  options: DeletionAttemptOptions = {},
) {
  const jobs = await db.attachmentDeletionJob.findMany({
    where: {
      nextAttemptAt: { lte: now },
      OR: [
        { claimExpiresAt: null },
        { claimExpiresAt: { lte: now } },
      ],
    },
    orderBy: { nextAttemptAt: "asc" },
    take: 100,
    select: { id: true },
  })
  let deletionsRemoved = 0
  let deletionFailures = 0
  for (const job of jobs) {
    const result = await attemptAttachmentDeletion(job.id, options)
    if (result === "deleted") deletionsRemoved += 1
    if (result === "failed") deletionFailures += 1
  }
  return { deletionsRemoved, deletionFailures }
}
