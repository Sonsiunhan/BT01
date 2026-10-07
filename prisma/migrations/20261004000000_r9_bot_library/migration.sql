-- R9 SOURCE ONLY: apply only to an explicitly approved disposable target.
-- Account-owned Bot Library storage; private sourceText is never serialized in public API snapshots.
CREATE TABLE "BotLibrary" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BotLibrary_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BotLibrary_ownerUserId_name_key" ON "BotLibrary"("ownerUserId", "name");
CREATE INDEX "BotLibrary_ownerUserId_updatedAt_idx" ON "BotLibrary"("ownerUserId", "updatedAt");
ALTER TABLE "BotLibrary" ADD CONSTRAINT "BotLibrary_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BotRevision" (
  "id" TEXT NOT NULL,
  "botLibraryId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "sdkVersion" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "sourceDigest" TEXT NOT NULL,
  "sourceBytes" INTEGER NOT NULL,
  "sourceText" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "validationCode" TEXT,
  "validationMessage" TEXT,
  "preflightMs" INTEGER,
  "memoryPolicy" TEXT NOT NULL DEFAULT 'RESET_ON_NEW_REVISION',
  "activeForMatchId" TEXT,
  "pendingForMatchId" TEXT,
  "sourceExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BotRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BotRevision_botLibraryId_revisionNumber_key" ON "BotRevision"("botLibraryId", "revisionNumber");
CREATE UNIQUE INDEX "BotRevision_botLibraryId_sourceDigest_key" ON "BotRevision"("botLibraryId", "sourceDigest");
CREATE INDEX "BotRevision_botLibraryId_updatedAt_idx" ON "BotRevision"("botLibraryId", "updatedAt");
ALTER TABLE "BotRevision" ADD CONSTRAINT "BotRevision_botLibraryId_fkey" FOREIGN KEY ("botLibraryId") REFERENCES "BotLibrary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
