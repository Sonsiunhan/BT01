-- R4 SOURCE ONLY: apply only to an explicitly approved disposable target.
-- This migration is intentionally not executed by the Wave worker.
CREATE TABLE "MatchMove" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "stateVersion" INTEGER NOT NULL,
  "side" TEXT NOT NULL,
  "fromCoordinate" TEXT NOT NULL,
  "toCoordinate" TEXT NOT NULL,
  "capturedPieceId" TEXT,
  "committedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchMove_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MatchMove_matchId_sequence_key" ON "MatchMove"("matchId", "sequence");
CREATE INDEX "MatchMove_matchId_stateVersion_idx" ON "MatchMove"("matchId", "stateVersion");
ALTER TABLE "MatchMove" ADD CONSTRAINT "MatchMove_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MatchCheckpoint" (
  "matchId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "stateVersion" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MatchCheckpoint_pkey" PRIMARY KEY ("matchId")
);
CREATE INDEX "MatchCheckpoint_roomId_updatedAt_idx" ON "MatchCheckpoint"("roomId", "updatedAt");
ALTER TABLE "MatchCheckpoint" ADD CONSTRAINT "MatchCheckpoint_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MatchEvent" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "stateVersion" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MatchEvent_matchId_sequence_key" ON "MatchEvent"("matchId", "sequence");
CREATE INDEX "MatchEvent_matchId_createdAt_idx" ON "MatchEvent"("matchId", "createdAt");
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
