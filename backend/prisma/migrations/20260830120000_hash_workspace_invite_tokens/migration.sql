-- Outstanding bearer links are intentionally revoked. Operators must resend them
-- so the application can issue a new raw token while persisting only its hash.
DROP INDEX "WorkspaceInvite_token_key";

ALTER TABLE "WorkspaceInvite" RENAME COLUMN "token" TO "tokenHash";
ALTER TABLE "WorkspaceInvite" DROP COLUMN "messageBody";
ALTER TABLE "WorkspaceInvite" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 1;

UPDATE "WorkspaceInvite"
SET "tokenHash" = lower(hex(randomblob(32))),
    "status" = CASE WHEN "status" = 'PENDING' THEN 'REVOKED' ELSE "status" END;

CREATE UNIQUE INDEX "WorkspaceInvite_tokenHash_key" ON "WorkspaceInvite"("tokenHash");
