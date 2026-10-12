-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "cursorSequence" INTEGER DEFAULT 0,
ADD COLUMN     "initialBoard" JSONB,
ADD COLUMN     "initialSeed" INTEGER,
ADD COLUMN     "initialSignature" TEXT,
ADD COLUMN     "rulesVersion" TEXT DEFAULT 'rps-v1',
ADD COLUMN     "setupVersion" TEXT;

-- AlterTable
ALTER TABLE "MatchCheckpoint" ADD COLUMN     "cursorSequence" INTEGER DEFAULT 0,
ADD COLUMN     "initialBoard" JSONB,
ADD COLUMN     "initialSeed" INTEGER,
ADD COLUMN     "initialSignature" TEXT,
ADD COLUMN     "lifecycleJson" JSONB,
ADD COLUMN     "rulesVersion" TEXT DEFAULT 'rps-v1',
ADD COLUMN     "setupVersion" TEXT;

-- CreateTable
CREATE TABLE "CommandLedgerEntry" (
    "id" TEXT NOT NULL,
    "principalId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "commandId" TEXT NOT NULL,
    "payloadDigest" TEXT,
    "outcome" TEXT NOT NULL,
    "stateVersion" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "ackPayload" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "CommandLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomContext" (
    "id" TEXT NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 1,
    "stateVersion" INTEGER NOT NULL DEFAULT 0,
    "activeMatchId" TEXT,
    "previousSetup" JSONB,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomMembership" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PLAYER',
    "side" TEXT,
    "principal" TEXT NOT NULL DEFAULT 'ACCOUNT',
    "connected" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotPrivateCheckpoint" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "turnNumber" INTEGER NOT NULL,
    "seed" INTEGER,
    "invocationEpoch" INTEGER,
    "invocationToken" TEXT,
    "memoryPayload" JSONB,
    "budgetRemaining" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotPrivateCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchSettlement" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" TEXT NOT NULL,
    "eloApplied" BOOLEAN NOT NULL DEFAULT false,
    "historyRecorded" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB,

    CONSTRAINT "MatchSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommandLedgerEntry_targetId_expiresAt_idx" ON "CommandLedgerEntry"("targetId", "expiresAt");

-- CreateIndex
CREATE INDEX "CommandLedgerEntry_commandId_idx" ON "CommandLedgerEntry"("commandId");

-- CreateIndex
CREATE UNIQUE INDEX "CommandLedgerEntry_principalId_targetId_operation_commandId_key" ON "CommandLedgerEntry"("principalId", "targetId", "operation", "commandId");

-- CreateIndex
CREATE INDEX "RoomContext_updatedAt_idx" ON "RoomContext"("updatedAt");

-- CreateIndex
CREATE INDEX "RoomMembership_roomId_role_idx" ON "RoomMembership"("roomId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMembership_roomId_userId_key" ON "RoomMembership"("roomId", "userId");

-- CreateIndex
CREATE INDEX "BotPrivateCheckpoint_matchId_turnNumber_idx" ON "BotPrivateCheckpoint"("matchId", "turnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BotPrivateCheckpoint_matchId_botId_key" ON "BotPrivateCheckpoint"("matchId", "botId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchSettlement_matchId_key" ON "MatchSettlement"("matchId");

-- CreateIndex
CREATE INDEX "MatchSettlement_settledAt_idx" ON "MatchSettlement"("settledAt");

-- AddForeignKey
ALTER TABLE "RoomMembership" ADD CONSTRAINT "RoomMembership_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "RoomContext"("id") ON DELETE CASCADE ON UPDATE CASCADE;
