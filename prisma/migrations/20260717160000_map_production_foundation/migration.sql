-- CreateTable
CREATE TABLE "MapScope" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "projectId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MapScope_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MapScope_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MapTaskPlacement" (
    "mapScopeId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "sectionId" TEXT,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("mapScopeId", "workItemId"),
    CONSTRAINT "MapTaskPlacement_mapScopeId_fkey" FOREIGN KEY ("mapScopeId") REFERENCES "MapScope" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MapTaskPlacement_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MapTaskPlacement_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "MapSection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MapProjectPlacement" (
    "mapScopeId" TEXT NOT NULL,
    "containerKey" TEXT NOT NULL,
    "projectId" TEXT,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("mapScopeId", "containerKey"),
    CONSTRAINT "MapProjectPlacement_mapScopeId_fkey" FOREIGN KEY ("mapScopeId") REFERENCES "MapScope" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MapProjectPlacement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MapSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapScopeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "width" REAL NOT NULL,
    "height" REAL NOT NULL,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MapSection_mapScopeId_fkey" FOREIGN KEY ("mapScopeId") REFERENCES "MapScope" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MapPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapScopeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewportX" REAL NOT NULL DEFAULT 0,
    "viewportY" REAL NOT NULL DEFAULT 0,
    "viewportZoom" REAL NOT NULL DEFAULT 1,
    "statusFilter" TEXT NOT NULL DEFAULT 'open',
    "trayOpen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MapPreference_mapScopeId_fkey" FOREIGN KEY ("mapScopeId") REFERENCES "MapScope" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MapPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MapCollapsedProject" (
    "preferenceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    PRIMARY KEY ("preferenceId", "projectId"),
    CONSTRAINT "MapCollapsedProject_preferenceId_fkey" FOREIGN KEY ("preferenceId") REFERENCES "MapPreference" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MapCollapsedProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MapCollapsedSection" (
    "preferenceId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,

    PRIMARY KEY ("preferenceId", "sectionId"),
    CONSTRAINT "MapCollapsedSection_preferenceId_fkey" FOREIGN KEY ("preferenceId") REFERENCES "MapPreference" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MapCollapsedSection_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "MapSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MapScope_projectId_key" ON "MapScope"("projectId");

-- CreateIndex
CREATE INDEX "MapScope_workspaceId_scopeType_idx" ON "MapScope"("workspaceId", "scopeType");

-- CreateIndex
CREATE UNIQUE INDEX "MapScope_workspaceId_scopeKey_key" ON "MapScope"("workspaceId", "scopeKey");

-- CreateIndex
CREATE INDEX "MapTaskPlacement_workItemId_idx" ON "MapTaskPlacement"("workItemId");

-- CreateIndex
CREATE INDEX "MapTaskPlacement_sectionId_idx" ON "MapTaskPlacement"("sectionId");

-- CreateIndex
CREATE INDEX "MapProjectPlacement_projectId_idx" ON "MapProjectPlacement"("projectId");

-- CreateIndex
CREATE INDEX "MapSection_mapScopeId_idx" ON "MapSection"("mapScopeId");

-- CreateIndex
CREATE UNIQUE INDEX "MapSection_mapScopeId_sortOrder_key" ON "MapSection"("mapScopeId", "sortOrder");

-- CreateIndex
CREATE INDEX "MapPreference_userId_idx" ON "MapPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MapPreference_mapScopeId_userId_key" ON "MapPreference"("mapScopeId", "userId");

-- CreateIndex
CREATE INDEX "MapCollapsedProject_projectId_idx" ON "MapCollapsedProject"("projectId");

-- CreateIndex
CREATE INDEX "MapCollapsedSection_sectionId_idx" ON "MapCollapsedSection"("sectionId");
