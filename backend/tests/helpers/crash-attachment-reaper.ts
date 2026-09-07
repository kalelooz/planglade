import { db } from "../../src/lib/db"
import { reapExpiredAttachmentUploads } from "../../src/lib/attachment-reaper"

// Crash after a persisted claim, without running the reaper's exception handler.
const claimReservation = db.attachmentUploadReservation.updateMany.bind(db.attachmentUploadReservation)
db.attachmentUploadReservation.updateMany = (async (args) => {
  const result = await claimReservation(args)
  if (result.count) process.exit(73)
  return result
}) as typeof db.attachmentUploadReservation.updateMany
const claimDeletion = db.attachmentDeletionJob.updateMany.bind(db.attachmentDeletionJob)
db.attachmentDeletionJob.updateMany = (async (args) => {
  const result = await claimDeletion(args)
  if (result.count) process.exit(73)
  return result
}) as typeof db.attachmentDeletionJob.updateMany

void reapExpiredAttachmentUploads().then(() => db.$disconnect()).catch(() => { process.exitCode = 1 })
