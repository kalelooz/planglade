ALTER TABLE "User" ADD COLUMN "firebaseUid" TEXT;

CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");
