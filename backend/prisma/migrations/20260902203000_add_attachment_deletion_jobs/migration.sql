CREATE TABLE "AttachmentDeletionJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storageKey" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" DATETIME,
    "lastError" TEXT,
    "claimId" TEXT,
    "claimExpiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "AttachmentDeletionJob_storageKey_key" ON "AttachmentDeletionJob"("storageKey");
CREATE UNIQUE INDEX "AttachmentDeletionJob_claimId_key" ON "AttachmentDeletionJob"("claimId");
CREATE INDEX "AttachmentDeletionJob_nextAttemptAt_claimExpiresAt_idx" ON "AttachmentDeletionJob"("nextAttemptAt", "claimExpiresAt");
