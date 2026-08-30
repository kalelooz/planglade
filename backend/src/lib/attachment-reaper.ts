import { db } from "@/lib/db"
import { deleteStorageObject, removeAbandonedLocalUploadTemps } from "@/lib/storage"

export async function reapExpiredAttachmentUploads(now = new Date()) {
  const expired = await db.attachmentUploadReservation.findMany({
    where: { consumedAt: null, expiresAt: { lte: now } },
    orderBy: { expiresAt: "asc" },
    take: 100,
  })
  let reservationsRemoved = 0
  for (const reservation of expired) {
    await deleteStorageObject(reservation.storageKey)
    const removed = await db.attachmentUploadReservation.deleteMany({
      where: { id: reservation.id, consumedAt: null, expiresAt: { lte: now } },
    })
    reservationsRemoved += removed.count
  }

  const temporaryFilesRemoved = await removeAbandonedLocalUploadTemps(
    new Date(now.getTime() - 60 * 60 * 1000),
  )
  return { reservationsRemoved, temporaryFilesRemoved }
}
