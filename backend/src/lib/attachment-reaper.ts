import { db } from "@/lib/db"
import { enqueueAttachmentDeletion, reapPendingAttachmentDeletions } from "@/lib/attachment-deletion"
import { ATTACHMENT_UPLOAD_DRAIN_MS } from "@/lib/attachment-reservations"
import { removeAbandonedLocalUploadTemps } from "@/lib/storage"

export async function reapExpiredAttachmentUploads(now = new Date()) {
  const expiredBefore = new Date(now.getTime() - ATTACHMENT_UPLOAD_DRAIN_MS)
  const expired = await db.attachmentUploadReservation.findMany({
    where: { consumedAt: null, expiresAt: { lte: expiredBefore } },
    orderBy: { expiresAt: "asc" },
    take: 100,
  })
  let reservationsRemoved = 0
  for (const reservation of expired) {
    reservationsRemoved += await db.$transaction(async (tx) => {
      const removed = await tx.attachmentUploadReservation.deleteMany({
        where: { id: reservation.id, consumedAt: null, expiresAt: { lte: expiredBefore } },
      })
      if (removed.count === 1) await enqueueAttachmentDeletion(tx, reservation.storageKey, now)
      return removed.count
    })
  }

  const deletionResult = await reapPendingAttachmentDeletions(now)

  const temporaryFilesRemoved = await removeAbandonedLocalUploadTemps(
    new Date(now.getTime() - 60 * 60 * 1000),
  )
  return { ...deletionResult, reservationsRemoved, temporaryFilesRemoved }
}
