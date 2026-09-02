import { db } from "@/lib/db"
import { reapPendingAttachmentDeletions } from "@/lib/attachment-deletion"
import { deleteStorageObject, removeAbandonedLocalUploadTemps } from "@/lib/storage"

export async function reapExpiredAttachmentUploads(now = new Date()) {
  const deletionResult = await reapPendingAttachmentDeletions(now)
  const expired = await db.attachmentUploadReservation.findMany({
    where: { consumedAt: null, expiresAt: { lte: now } },
    orderBy: { expiresAt: "asc" },
    take: 100,
  })
  let reservationsRemoved = 0
  for (const reservation of expired) {
    const claimed = await db.attachmentUploadReservation.updateMany({
      where: { id: reservation.id, consumedAt: null, expiresAt: { lte: now } },
      data: { consumedAt: now },
    })
    if (claimed.count !== 1) continue

    try {
      await deleteStorageObject(reservation.storageKey)
      const removed = await db.attachmentUploadReservation.deleteMany({
        where: { id: reservation.id, consumedAt: now, expiresAt: { lte: now } },
      })
      reservationsRemoved += removed.count
    } catch (error) {
      await db.attachmentUploadReservation.updateMany({
        where: { id: reservation.id, consumedAt: now, expiresAt: { lte: now } },
        data: { consumedAt: null },
      })
      throw error
    }
  }

  const temporaryFilesRemoved = await removeAbandonedLocalUploadTemps(
    new Date(now.getTime() - 60 * 60 * 1000),
  )
  return { ...deletionResult, reservationsRemoved, temporaryFilesRemoved }
}
