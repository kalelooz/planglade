PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "workItemId" TEXT,
    "noteId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attachment_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Attachment" ("createdAt", "id", "mimeType", "name", "noteId", "sizeBytes", "storageKey", "uploadedById", "workItemId", "workspaceId")
SELECT "createdAt", "id", "mimeType", "name", "noteId", "sizeBytes", "storageKey", "uploadedById", "workItemId", "workspaceId" FROM "Attachment";
DROP TABLE "Attachment";
ALTER TABLE "new_Attachment" RENAME TO "Attachment";
CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");
CREATE INDEX "Attachment_workItemId_idx" ON "Attachment"("workItemId");
CREATE INDEX "Attachment_noteId_idx" ON "Attachment"("noteId");

CREATE TABLE "new_AttachmentUploadReservation" (
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
    CONSTRAINT "AttachmentUploadReservation_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AttachmentUploadReservation_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AttachmentUploadReservation" ("actorUserId", "consumedAt", "createdAt", "expiresAt", "id", "mimeType", "noteId", "sizeBytes", "storageKey", "workItemId", "workspaceId")
SELECT "actorUserId", "consumedAt", "createdAt", "expiresAt", "id", "mimeType", "noteId", "sizeBytes", "storageKey", "workItemId", "workspaceId" FROM "AttachmentUploadReservation";
DROP TABLE "AttachmentUploadReservation";
ALTER TABLE "new_AttachmentUploadReservation" RENAME TO "AttachmentUploadReservation";
CREATE UNIQUE INDEX "AttachmentUploadReservation_storageKey_key" ON "AttachmentUploadReservation"("storageKey");
CREATE INDEX "AttachmentUploadReservation_workspaceId_expiresAt_consumedAt_idx" ON "AttachmentUploadReservation"("workspaceId", "expiresAt", "consumedAt");
CREATE INDEX "AttachmentUploadReservation_actorUserId_expiresAt_idx" ON "AttachmentUploadReservation"("actorUserId", "expiresAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
