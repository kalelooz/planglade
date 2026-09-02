CREATE TABLE "WorkspaceImportOperation" (
    "workspaceId" TEXT NOT NULL PRIMARY KEY,
    "claimId" TEXT NOT NULL,
    "sourceChecksum" TEXT NOT NULL,
    "leaseExpiresAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "result" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkspaceImportOperation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WorkspaceImportOperation_claimId_key" ON "WorkspaceImportOperation"("claimId");
CREATE INDEX "WorkspaceImportOperation_leaseExpiresAt_idx" ON "WorkspaceImportOperation"("leaseExpiresAt");
