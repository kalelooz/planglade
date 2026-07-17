PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_AuthThrottle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "windowStartedAt" DATETIME NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "blockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuthThrottle scope" CHECK ("scope" IN ('LOGIN_ACCOUNT', 'LOGIN_GLOBAL', 'SETUP', 'RECOVERY', 'WORKSPACE_OPERATION')),
    CONSTRAINT "AuthThrottle attempt count" CHECK ("attemptCount" >= 0)
);

INSERT INTO "new_AuthThrottle" ("attemptCount", "blockedUntil", "createdAt", "id", "scope", "subjectKey", "updatedAt", "windowStartedAt")
SELECT "attemptCount", "blockedUntil", "createdAt", "id", "scope", "subjectKey", "updatedAt", "windowStartedAt" FROM "AuthThrottle";

DROP TABLE "AuthThrottle";
ALTER TABLE "new_AuthThrottle" RENAME TO "AuthThrottle";

CREATE INDEX "AuthThrottle_windowStartedAt_idx" ON "AuthThrottle"("windowStartedAt");
CREATE UNIQUE INDEX "AuthThrottle_scope_subjectKey_key" ON "AuthThrottle"("scope", "subjectKey");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
