-- Additive Guest ownership. Production execution requires separate approval
-- and a verified backup. Operational rollback keeps these rows intact.
CREATE TABLE "GuestSession" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuestSession_tokenHash_key" ON "GuestSession"("tokenHash");
CREATE INDEX "GuestSession_expiresAt_idx" ON "GuestSession"("expiresAt");
ALTER TABLE "BotLibrary" ALTER COLUMN "ownerUserId" DROP NOT NULL;
ALTER TABLE "BotLibrary" ADD COLUMN "ownerGuestId" TEXT;
ALTER TABLE "BotLibrary" ADD CONSTRAINT "BotLibrary_guest_owner_fkey"
  FOREIGN KEY ("ownerGuestId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Existing account rows satisfy this constraint. NOT VALID avoids scanning
-- historical rows during expansion; new/updated rows are still enforced.
ALTER TABLE "BotLibrary" ADD CONSTRAINT "BotLibrary_exactly_one_owner"
  CHECK (("ownerUserId" IS NULL) <> ("ownerGuestId" IS NULL)) NOT VALID;
