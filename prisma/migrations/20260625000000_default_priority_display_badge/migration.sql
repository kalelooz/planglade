PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taskPriorityDisplayStyle" TEXT NOT NULL DEFAULT 'badge',
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Workspace" ("createdAt", "id", "name", "ownerId", "slug", "taskPriorityDisplayStyle", "updatedAt")
SELECT "createdAt", "id", "name", "ownerId", "slug", "taskPriorityDisplayStyle", "updatedAt" FROM "Workspace";

DROP TABLE "Workspace";
ALTER TABLE "new_Workspace" RENAME TO "Workspace";

CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
