-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'SYSTEM_ADMIN', 'TOURNAMENT_ADMIN', 'REFEREE', 'BROADCAST_OBSERVER');

-- AlterTable
ALTER TABLE "TournamentStaffAssignmentRecord" ADD COLUMN     "invitationId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "TournamentStaffInvitation" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'TOURNAMENT_STAFF_INVITE',
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "tokenHash" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "inviterUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "TournamentStaffInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportRecoveryTicket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "requestType" TEXT NOT NULL DEFAULT 'ACCOUNT_RECOVERY',
    "targetUserId" TEXT NOT NULL,
    "requesterUserId" TEXT,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignedOperatorUserId" TEXT,
    "verificationReference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "recoveryTokenHash" TEXT,
    "recoveryTokenPurpose" TEXT,
    "recoveryTokenExpiresAt" TIMESTAMP(3),
    "recoveryTokenIssuedAt" TIMESTAMP(3),
    "recoveryTokenConsumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "SupportRecoveryTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentRulesAcknowledgement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "configVersionId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidenceKind" TEXT NOT NULL DEFAULT 'AUTHENTICATED_EXPLICIT_ACK',

    CONSTRAINT "TournamentRulesAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtifactRetentionPolicyRecord" (
    "artifact" TEXT NOT NULL,
    "policy" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtifactRetentionPolicyRecord_pkey" PRIMARY KEY ("artifact")
);

-- CreateIndex
CREATE UNIQUE INDEX "TournamentStaffInvitation_tokenHash_key" ON "TournamentStaffInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "TournamentStaffInvitation_tournamentId_status_idx" ON "TournamentStaffInvitation"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "TournamentStaffInvitation_recipientUserId_status_idx" ON "TournamentStaffInvitation"("recipientUserId", "status");

-- CreateIndex
CREATE INDEX "TournamentStaffInvitation_expiresAt_status_idx" ON "TournamentStaffInvitation"("expiresAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentStaffInvitation_tournamentId_idempotencyKey_key" ON "TournamentStaffInvitation"("tournamentId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "SupportRecoveryTicket_recoveryTokenHash_key" ON "SupportRecoveryTicket"("recoveryTokenHash");

-- CreateIndex
CREATE INDEX "SupportRecoveryTicket_tenantId_status_createdAt_idx" ON "SupportRecoveryTicket"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SupportRecoveryTicket_targetUserId_status_idx" ON "SupportRecoveryTicket"("targetUserId", "status");

-- CreateIndex
CREATE INDEX "SupportRecoveryTicket_assignedOperatorUserId_status_idx" ON "SupportRecoveryTicket"("assignedOperatorUserId", "status");

-- CreateIndex
CREATE INDEX "SupportRecoveryTicket_recoveryTokenExpiresAt_idx" ON "SupportRecoveryTicket"("recoveryTokenExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportRecoveryTicket_targetUserId_idempotencyKey_key" ON "SupportRecoveryTicket"("targetUserId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "TournamentRulesAcknowledgement_contractId_tournamentId_idx" ON "TournamentRulesAcknowledgement"("contractId", "tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentRulesAcknowledgement_userId_contractId_tournament_key" ON "TournamentRulesAcknowledgement"("userId", "contractId", "tournamentId", "configVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentConfigVersionRecord_id_tournamentId_key" ON "TournamentConfigVersionRecord"("id", "tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentStaffAssignmentRecord_invitationId_key" ON "TournamentStaffAssignmentRecord"("invitationId");

-- RenameForeignKey
ALTER TABLE "BotLibrary" RENAME CONSTRAINT "BotLibrary_guest_owner_fkey" TO "BotLibrary_ownerGuestId_fkey";

-- AddForeignKey
ALTER TABLE "TournamentStaffAssignmentRecord" ADD CONSTRAINT "TournamentStaffAssignmentRecord_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "TournamentStaffInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentStaffInvitation" ADD CONSTRAINT "TournamentStaffInvitation_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentRulesAcknowledgement" ADD CONSTRAINT "TournamentRulesAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentRulesAcknowledgement" ADD CONSTRAINT "TournamentRulesAcknowledgement_configVersionId_tournamentI_fkey" FOREIGN KEY ("configVersionId", "tournamentId") REFERENCES "TournamentConfigVersionRecord"("id", "tournamentId") ON DELETE RESTRICT ON UPDATE CASCADE;

