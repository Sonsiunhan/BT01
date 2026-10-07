-- R13 SOURCE ONLY: apply only to an explicitly approved disposable target.
-- Adds the authoritative room play mode needed to distinguish manual and Bot history.
ALTER TABLE "Match" ADD COLUMN "playMode" TEXT NOT NULL DEFAULT 'MANUAL';
CREATE INDEX "Match_playMode_endedAt_idx" ON "Match"("playMode", "endedAt");
ALTER TABLE "Match" ADD COLUMN "botAdjudication" JSONB;
