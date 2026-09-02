CREATE TABLE "WorkspaceImportOperation" (
    "workspaceId" TEXT NOT NULL,
    "sourceChecksum" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("workspaceId", "sourceChecksum"),
    CONSTRAINT "WorkspaceImportOperation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "WorkspaceImportLease" (
    "workspaceId" TEXT NOT NULL PRIMARY KEY,
    "claimId" TEXT NOT NULL,
    "sourceChecksum" TEXT NOT NULL,
    "leaseExpiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkspaceImportLease_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WorkspaceImportLease_claimId_key" ON "WorkspaceImportLease"("claimId");
CREATE INDEX "WorkspaceImportLease_leaseExpiresAt_idx" ON "WorkspaceImportLease"("leaseExpiresAt");
