-- SELF-HOST-AUTH-SCHEMA-001
-- JavaScript will normalize auth email with trim().toLowerCase(). SQLite's
-- lower() is ASCII-only, so fail before mutation unless SQL can reproduce it.
BEGIN IMMEDIATE;

CREATE TEMP TABLE "_LocalAuthEmailSafety" (
    "ok" INTEGER NOT NULL,
    CONSTRAINT "local-auth email preflight: run npm run db:check:local-auth-emails" CHECK ("ok" = 1)
);

INSERT INTO "_LocalAuthEmailSafety" ("ok")
SELECT CASE WHEN EXISTS (
    SELECT 1
    FROM "User"
    WHERE length(CAST("email" AS BLOB)) <> length("email")
       OR length(lower(trim("email", char(9) || char(10) || char(11) || char(12) || char(13) || ' '))) = 0
) THEN 0 ELSE 1 END;

DROP TABLE "_LocalAuthEmailSafety";

CREATE TEMP TABLE "_LocalAuthEmailCollision" (
    "ok" INTEGER NOT NULL,
    CONSTRAINT "local-auth email preflight: resolve normalized email collisions" CHECK ("ok" = 1)
);

INSERT INTO "_LocalAuthEmailCollision" ("ok")
SELECT CASE WHEN EXISTS (
    SELECT lower(trim("email", char(9) || char(10) || char(11) || char(12) || char(13) || ' '))
    FROM "User"
    GROUP BY lower(trim("email", char(9) || char(10) || char(11) || char(12) || char(13) || ' '))
    HAVING COUNT(*) > 1
) THEN 0 ELSE 1 END;

DROP TABLE "_LocalAuthEmailCollision";

ALTER TABLE "User" ADD COLUMN "normalizedEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;

UPDATE "User"
SET "normalizedEmail" = lower(trim("email", char(9) || char(10) || char(11) || char(12) || char(13) || ' '));

CREATE UNIQUE INDEX "User_normalizedEmail_key" ON "User"("normalizedEmail");

CREATE TABLE "LocalCredential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "disabledAt" DATETIME,
    "passwordCreatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passwordChangedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LocalCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "LocalRecoveryCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LocalRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SelfHostSetup" (
    "id" TEXT NOT NULL DEFAULT 'singleton' PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "claimantHash" TEXT,
    "claimExpiresAt" DATETIME,
    "completedAt" DATETIME,
    "completedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SelfHostSetup singleton" CHECK ("id" = 'singleton'),
    CONSTRAINT "SelfHostSetup status" CHECK ("status" IN ('AVAILABLE', 'IN_PROGRESS', 'COMPLETE')),
    CONSTRAINT "SelfHostSetup state" CHECK (
        ("status" = 'AVAILABLE' AND "claimantHash" IS NULL AND "claimExpiresAt" IS NULL AND "completedAt" IS NULL AND "completedById" IS NULL)
        OR ("status" = 'IN_PROGRESS' AND "claimantHash" IS NOT NULL AND "claimExpiresAt" IS NOT NULL AND "completedAt" IS NULL AND "completedById" IS NULL)
        OR ("status" = 'COMPLETE' AND "claimantHash" IS NULL AND "claimExpiresAt" IS NULL AND "completedAt" IS NOT NULL)
    ),
    CONSTRAINT "SelfHostSetup_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AuthThrottle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "windowStartedAt" DATETIME NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "blockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuthThrottle scope" CHECK ("scope" IN ('LOGIN_ACCOUNT', 'LOGIN_GLOBAL', 'SETUP', 'RECOVERY')),
    CONSTRAINT "AuthThrottle attempt count" CHECK ("attemptCount" >= 0)
);

CREATE UNIQUE INDEX "LocalCredential_userId_key" ON "LocalCredential"("userId");
CREATE INDEX "LocalRecoveryCode_userId_usedAt_idx" ON "LocalRecoveryCode"("userId", "usedAt");
CREATE UNIQUE INDEX "LocalRecoveryCode_userId_codeHash_key" ON "LocalRecoveryCode"("userId", "codeHash");
CREATE INDEX "SelfHostSetup_completedById_idx" ON "SelfHostSetup"("completedById");
CREATE INDEX "AuthThrottle_windowStartedAt_idx" ON "AuthThrottle"("windowStartedAt");
CREATE UNIQUE INDEX "AuthThrottle_scope_subjectKey_key" ON "AuthThrottle"("scope", "subjectKey");

INSERT INTO "SelfHostSetup" ("id", "status", "completedAt", "updatedAt")
SELECT
    'singleton',
    CASE WHEN EXISTS (SELECT 1 FROM "Workspace")
           OR EXISTS (SELECT 1 FROM "WorkspaceMember" WHERE "role" = 'OWNER')
         THEN 'COMPLETE' ELSE 'AVAILABLE' END,
    CASE WHEN EXISTS (SELECT 1 FROM "Workspace")
           OR EXISTS (SELECT 1 FROM "WorkspaceMember" WHERE "role" = 'OWNER')
         THEN CURRENT_TIMESTAMP ELSE NULL END,
    CURRENT_TIMESTAMP;

COMMIT;
