import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"

import { db } from "@/lib/db"

export const ATTACHMENT_UPLOAD_DRAIN_MS = 60 * 60 * 1000

const DEFAULT_WORKSPACE_QUOTA_BYTES = 1024 * 1024 * 1024

export class WorkspaceStorageQuotaError extends Error {
  constructor() {
    super("Workspace attachment storage quota exceeded")
    this.name = "WorkspaceStorageQuotaError"
  }
}

export class AttachmentReservationConflictError extends Error {
  constructor() {
    super("Attachment upload reservation is invalid, expired, or already consumed")
    this.name = "AttachmentReservationConflictError"
  }
}

function configuredPositiveInteger(name: string, fallback: number) {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const value = Number(raw)
  return Number.isSafeInteger(value) && value > 0 ? value : fallback
}

export function getWorkspaceStorageQuotaBytes() {
  return configuredPositiveInteger("PLANGLADE_WORKSPACE_STORAGE_QUOTA_BYTES", DEFAULT_WORKSPACE_QUOTA_BYTES)
}

async function workspaceStorageDemand(tx: Prisma.TransactionClient, workspaceId: string, now: Date) {
  const [used, reserved] = await Promise.all([
    tx.attachment.aggregate({
      where: { workspaceId },
      _sum: { sizeBytes: true },
    }),
    tx.attachmentUploadReservation.aggregate({
      where: { workspaceId, consumedAt: null, expiresAt: { gt: now } },
      _sum: { sizeBytes: true },
    }),
  ])
  return (used._sum.sizeBytes ?? 0) + (reserved._sum.sizeBytes ?? 0)
}

export async function reserveAttachmentUpload(input: {
  workspaceId: string
  actorUserId: string
  workItemId?: string
  noteId?: string
  storageKey: string
  mimeType: string
  sizeBytes: number
  expiresAt: Date
}) {
  return db.$transaction(async (tx) => {
    const demand = await workspaceStorageDemand(tx, input.workspaceId, new Date())
    if (demand + input.sizeBytes > getWorkspaceStorageQuotaBytes()) {
      throw new WorkspaceStorageQuotaError()
    }
    return tx.attachmentUploadReservation.create({
      data: { id: randomUUID(), ...input },
    })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export async function finalizeAttachmentReservation(
  tx: Prisma.TransactionClient,
  input: { reservationId: string; workspaceId: string; now: Date },
) {
  const demand = await workspaceStorageDemand(tx, input.workspaceId, input.now)
  if (demand > getWorkspaceStorageQuotaBytes()) throw new WorkspaceStorageQuotaError()

  const claim = await tx.attachmentUploadReservation.updateMany({
    where: {
      id: input.reservationId,
      workspaceId: input.workspaceId,
      consumedAt: null,
      expiresAt: { gt: input.now },
    },
    data: { consumedAt: input.now },
  })
  if (claim.count !== 1) throw new AttachmentReservationConflictError()
}
