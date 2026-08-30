CREATE TABLE "AttachmentUploadReservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "workItemId" TEXT,
    "noteId" TEXT,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttachmentUploadReservation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttachmentUploadReservation_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttachmentUploadReservation_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttachmentUploadReservation_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AttachmentUploadReservation_storageKey_key" ON "AttachmentUploadReservation"("storageKey");
CREATE INDEX "AttachmentUploadReservation_workspaceId_expiresAt_consumedAt_idx" ON "AttachmentUploadReservation"("workspaceId", "expiresAt", "consumedAt");
CREATE INDEX "AttachmentUploadReservation_actorUserId_expiresAt_idx" ON "AttachmentUploadReservation"("actorUserId", "expiresAt");
