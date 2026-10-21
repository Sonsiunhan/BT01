-- Expand-only migration for L01 Tournament Initialization (BA+SA v1.0)
-- Safe for existing rows: only nullable columns added to "Match" and new tables created.

-- 1. Extend Match with optional tournament linkage & canonical finish_sequence
ALTER TABLE "Match" ADD COLUMN "tournamentId" TEXT;
ALTER TABLE "Match" ADD COLUMN "pinnedConfigVersionId" TEXT;
ALTER TABLE "Match" ADD COLUMN "finishSequence" INTEGER;

CREATE INDEX "Match_tournamentId_finishSequence_idx" ON "Match"("tournamentId", "finishSequence");

-- 2. Create Unit table (P06)
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "unitType" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Unit_unitCode_key" ON "Unit"("unitCode");
CREATE INDEX "Unit_status_idx" ON "Unit"("status");

-- 3. Create TournamentContract table (P07)
CREATE TABLE "TournamentContract" (
    "id" TEXT NOT NULL,
    "contractCode" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "maxTournamentsTotal" INTEGER NOT NULL,
    "quotaReservedCount" INTEGER NOT NULL DEFAULT 0,
    "quotaConsumedCount" INTEGER NOT NULL DEFAULT 0,
    "maxParticipantsPerTournament" INTEGER NOT NULL,
    "maxParticipantsTotal" INTEGER NOT NULL,
    "allowedModes" JSONB NOT NULL,
    "policyEnvelope" JSONB NOT NULL,
    "technicalCaps" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentContract_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TournamentContract_contractCode_key" ON "TournamentContract"("contractCode");
CREATE INDEX "TournamentContract_unitId_status_idx" ON "TournamentContract"("unitId", "status");
CREATE INDEX "TournamentContract_validTo_idx" ON "TournamentContract"("validTo");

-- 4. Create TournamentContractTaBinding table (P07)
CREATE TABLE "TournamentContractTaBinding" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "grantedByUserId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,

    CONSTRAINT "TournamentContractTaBinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TournamentContractTaBinding_contractId_userId_key" ON "TournamentContractTaBinding"("contractId", "userId");
CREATE INDEX "TournamentContractTaBinding_userId_status_idx" ON "TournamentContractTaBinding"("userId", "status");

-- 5. Create Tournament table (P02, P03, P08)
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "tournamentCode" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "ownerTaUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "coreConfig" JSONB NOT NULL,
    "ruleProfile" JSONB NOT NULL,
    "activeConfigVersionId" TEXT,
    "activeConfigVersionNumber" INTEGER NOT NULL DEFAULT 0,
    "approvedSnapshot" JSONB,
    "everApproved" BOOLEAN NOT NULL DEFAULT false,
    "quotaRefunded" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "changesRequestedAt" TIMESTAMP(3),
    "lastReviewNote" TEXT,
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "pauseReason" TEXT,
    "endedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "copiedFromTournamentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tournament_tournamentCode_key" ON "Tournament"("tournamentCode");
CREATE INDEX "Tournament_contractId_status_idx" ON "Tournament"("contractId", "status");
CREATE INDEX "Tournament_status_idx" ON "Tournament"("status");
CREATE INDEX "Tournament_ownerTaUserId_idx" ON "Tournament"("ownerTaUserId");

-- 6. Create TournamentConfigVersionRecord table (P04)
CREATE TABLE "TournamentConfigVersionRecord" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "coreConfigSnapshot" JSONB NOT NULL,
    "ruleProfileSnapshot" JSONB NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "publishedByUserId" TEXT NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentConfigVersionRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TournamentConfigVersionRecord_tournamentId_versionNumber_key" ON "TournamentConfigVersionRecord"("tournamentId", "versionNumber");
CREATE INDEX "TournamentConfigVersionRecord_tournamentId_effectiveAt_idx" ON "TournamentConfigVersionRecord"("tournamentId", "effectiveAt");

-- 7. Create TournamentChangeRequestRecord table (P08)
CREATE TABLE "TournamentChangeRequestRecord" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "requestedByTaUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "proposedCoreConfigPatch" JSONB,
    "proposedRuleProfilePatch" JSONB,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "diffs" JSONB NOT NULL,
    "reviewedByAdminUserId" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "appliedConfigVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentChangeRequestRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TournamentChangeRequestRecord_tournamentId_status_idx" ON "TournamentChangeRequestRecord"("tournamentId", "status");
CREATE INDEX "TournamentChangeRequestRecord_status_idx" ON "TournamentChangeRequestRecord"("status");

-- 8. Create TournamentEnrollmentRecord table (P09, P10)
CREATE TABLE "TournamentEnrollmentRecord" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "personKey" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "email" TEXT,
    "seedRating" INTEGER NOT NULL DEFAULT 1000,
    "eligibilityStatus" TEXT NOT NULL DEFAULT 'ELIGIBLE',
    "checkedInAt" TIMESTAMP(3),
    "pinnedBotRevisionId" TEXT,
    "botReadinessStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentEnrollmentRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TournamentEnrollmentRecord_tournamentId_personKey_key" ON "TournamentEnrollmentRecord"("tournamentId", "personKey");
CREATE INDEX "TournamentEnrollmentRecord_contractId_idx" ON "TournamentEnrollmentRecord"("contractId");
CREATE INDEX "TournamentEnrollmentRecord_tournamentId_eligibilityStatus_idx" ON "TournamentEnrollmentRecord"("tournamentId", "eligibilityStatus");
CREATE INDEX "TournamentEnrollmentRecord_userId_tournamentId_idx" ON "TournamentEnrollmentRecord"("userId", "tournamentId");

-- 9. Create TournamentStaffAssignmentRecord table (P11, P17)
CREATE TABLE "TournamentStaffAssignmentRecord" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "assignedRooms" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentStaffAssignmentRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TournamentStaffAssignmentRecord_tournamentId_userId_role_key" ON "TournamentStaffAssignmentRecord"("tournamentId", "userId", "role");
CREATE INDEX "TournamentStaffAssignmentRecord_userId_status_idx" ON "TournamentStaffAssignmentRecord"("userId", "status");

-- 10. Create ManualAdjudicationRequestRecord table (P05)
CREATE TABLE "ManualAdjudicationRequestRecord" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "blueParticipantId" TEXT NOT NULL,
    "redParticipantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "frozenSnapshot" JSONB NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "fallbackPolicy" TEXT NOT NULL,
    "winnerSide" TEXT,
    "decidedByUserId" TEXT,
    "decisionReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "finishSequence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualAdjudicationRequestRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManualAdjudicationRequestRecord_matchId_key" ON "ManualAdjudicationRequestRecord"("matchId");
CREATE INDEX "ManualAdjudicationRequestRecord_tournamentId_status_idx" ON "ManualAdjudicationRequestRecord"("tournamentId", "status");
CREATE INDEX "ManualAdjudicationRequestRecord_deadlineAt_status_idx" ON "ManualAdjudicationRequestRecord"("deadlineAt", "status");

-- 11. Create TournamentScoreLedgerRecord table (P05)
CREATE TABLE "TournamentScoreLedgerRecord" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "finishSequence" INTEGER NOT NULL,
    "blueParticipantId" TEXT NOT NULL,
    "redParticipantId" TEXT NOT NULL,
    "winnerSide" TEXT NOT NULL,
    "resolutionSource" TEXT NOT NULL,
    "blueEloBefore" INTEGER NOT NULL,
    "blueEloAfter" INTEGER NOT NULL,
    "blueScoreBefore" INTEGER NOT NULL,
    "blueScoreAfter" INTEGER NOT NULL,
    "redEloBefore" INTEGER NOT NULL,
    "redEloAfter" INTEGER NOT NULL,
    "redScoreBefore" INTEGER NOT NULL,
    "redScoreAfter" INTEGER NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentScoreLedgerRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TournamentScoreLedgerRecord_matchId_key" ON "TournamentScoreLedgerRecord"("matchId");
CREATE UNIQUE INDEX "TournamentScoreLedgerRecord_tournamentId_finishSequence_key" ON "TournamentScoreLedgerRecord"("tournamentId", "finishSequence");
CREATE INDEX "TournamentScoreLedgerRecord_tournamentId_finishSequence_idx" ON "TournamentScoreLedgerRecord"("tournamentId", "finishSequence");

-- 12. Create TournamentAuditLogRecord table (P14)
CREATE TABLE "TournamentAuditLogRecord" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "beforeSnapshot" JSONB,
    "afterSnapshot" JSONB,
    "reason" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentAuditLogRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TournamentAuditLogRecord_targetType_targetId_createdAt_idx" ON "TournamentAuditLogRecord"("targetType", "targetId", "createdAt");
CREATE INDEX "TournamentAuditLogRecord_actorUserId_createdAt_idx" ON "TournamentAuditLogRecord"("actorUserId", "createdAt");

-- 13. Create TournamentQuotaLedgerRecord table (L00 / P07 append-only quota ledger)
CREATE TABLE "TournamentQuotaLedgerRecord" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "deltaReserved" INTEGER NOT NULL,
    "deltaConsumed" INTEGER NOT NULL,
    "quotaReservedAfter" INTEGER NOT NULL,
    "quotaConsumedAfter" INTEGER NOT NULL,
    "quotaRemainingAfter" INTEGER NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentQuotaLedgerRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TournamentQuotaLedgerRecord_contractId_createdAt_idx" ON "TournamentQuotaLedgerRecord"("contractId", "createdAt");
CREATE INDEX "TournamentQuotaLedgerRecord_tournamentId_createdAt_idx" ON "TournamentQuotaLedgerRecord"("tournamentId", "createdAt");

-- 14. Create SystemRoleAssignment table (D00 / L01 system roles ADMIN & SUPPORT)
CREATE TABLE "SystemRoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "grantedByUserId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,

    CONSTRAINT "SystemRoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SystemRoleAssignment_userId_role_key" ON "SystemRoleAssignment"("userId", "role");
CREATE INDEX "SystemRoleAssignment_role_status_idx" ON "SystemRoleAssignment"("role", "status");

-- 15. Create AccountClaimToken table (D00 P09 / P13 activation & reset tokens)
CREATE TABLE "AccountClaimToken" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL DEFAULT 'ACTIVATION',
    "tokenHash" TEXT NOT NULL,
    "initialState" TEXT NOT NULL DEFAULT 'UNCLAIMED',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountClaimToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountClaimToken_tokenHash_key" ON "AccountClaimToken"("tokenHash");
CREATE INDEX "AccountClaimToken_tenantId_userId_status_idx" ON "AccountClaimToken"("tenantId", "userId", "status");
CREATE INDEX "AccountClaimToken_expiresAt_status_idx" ON "AccountClaimToken"("expiresAt", "status");

-- 16. Create RosterImportBatch & RosterImportStageRow tables (D00 P10)
CREATE TABLE "RosterImportBatch" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STAGED',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RosterImportBatch_tournamentId_idempotencyKey_key" ON "RosterImportBatch"("tournamentId", "idempotencyKey");
CREATE INDEX "RosterImportBatch_tournamentId_status_idx" ON "RosterImportBatch"("tournamentId", "status");
CREATE INDEX "RosterImportBatch_expiresAt_status_idx" ON "RosterImportBatch"("expiresAt", "status");

CREATE TABLE "RosterImportStageRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sourceRowId" TEXT NOT NULL,
    "personKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "metadata" JSONB,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RosterImportStageRow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RosterImportStageRow_batchId_sourceRowId_key" ON "RosterImportStageRow"("batchId", "sourceRowId");
CREATE INDEX "RosterImportStageRow_batchId_personKey_idx" ON "RosterImportStageRow"("batchId", "personKey");

-- 17. Create SupportRecoveryTicket & TournamentRegulationsAckRecord tables (D00 P12 & P18)
CREATE TABLE "SupportRecoveryTicket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "resolvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportRecoveryTicket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportRecoveryTicket_tenantId_status_createdAt_idx" ON "SupportRecoveryTicket"("tenantId", "status", "createdAt");
CREATE INDEX "SupportRecoveryTicket_userId_status_idx" ON "SupportRecoveryTicket"("userId", "status");

CREATE TABLE "TournamentRegulationsAckRecord" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "configVersionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personKey" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentRegulationsAckRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TournamentRegulationsAckRecord_tournamentId_configVersionId_userId_key" ON "TournamentRegulationsAckRecord"("tournamentId", "configVersionId", "userId");
CREATE INDEX "TournamentRegulationsAckRecord_tournamentId_personKey_idx" ON "TournamentRegulationsAckRecord"("tournamentId", "personKey");

-- 18. Create TournamentIncidentRecord, TournamentExtensionRequestRecord & BotCompatibilityReceiptRecord (N00 IE02-IE12 & P16)
CREATE TABLE "TournamentIncidentRecord" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "detectorType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "assignedRefereeUserId" TEXT,
    "summary" TEXT NOT NULL,
    "decisionAction" TEXT,
    "decisionReason" TEXT,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "reversedByTaUserId" TEXT,
    "reverseReason" TEXT,
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentIncidentRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TournamentIncidentRecord_tournamentId_status_idx" ON "TournamentIncidentRecord"("tournamentId", "status");
CREATE INDEX "TournamentIncidentRecord_matchId_status_idx" ON "TournamentIncidentRecord"("matchId", "status");

CREATE TABLE "TournamentExtensionRequestRecord" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "requestedByTaUserId" TEXT NOT NULL,
    "requestedMinutes" INTEGER NOT NULL,
    "approvedMinutes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "scheduleComparison" JSONB NOT NULL,
    "reviewedByAdminUserId" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentExtensionRequestRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TournamentExtensionRequestRecord_tournamentId_status_idx" ON "TournamentExtensionRequestRecord"("tournamentId", "status");
CREATE INDEX "TournamentExtensionRequestRecord_status_createdAt_idx" ON "TournamentExtensionRequestRecord"("status", "createdAt");

CREATE TABLE "BotCompatibilityReceiptRecord" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "botRevisionId" TEXT NOT NULL,
    "ruleSnapshotId" TEXT NOT NULL,
    "readinessStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "preflightDurationMs" INTEGER,
    "publicReason" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotCompatibilityReceiptRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BotCompatibilityReceiptRecord_tournamentId_participantId_botRevisionId_ruleSnapshotId_key" ON "BotCompatibilityReceiptRecord"("tournamentId", "participantId", "botRevisionId", "ruleSnapshotId");
CREATE INDEX "BotCompatibilityReceiptRecord_tournamentId_readinessStatus_idx" ON "BotCompatibilityReceiptRecord"("tournamentId", "readinessStatus");

-- 19. Foreign Key Constraints (Restrict on Unit/Contract reference, Cascade on child records)
ALTER TABLE "TournamentContract" ADD CONSTRAINT "TournamentContract_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TournamentContractTaBinding" ADD CONSTRAINT "TournamentContractTaBinding_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "TournamentContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "TournamentContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TournamentConfigVersionRecord" ADD CONSTRAINT "TournamentConfigVersionRecord_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentChangeRequestRecord" ADD CONSTRAINT "TournamentChangeRequestRecord_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentEnrollmentRecord" ADD CONSTRAINT "TournamentEnrollmentRecord_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentEnrollmentRecord" ADD CONSTRAINT "TournamentEnrollmentRecord_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "TournamentContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TournamentStaffAssignmentRecord" ADD CONSTRAINT "TournamentStaffAssignmentRecord_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualAdjudicationRequestRecord" ADD CONSTRAINT "ManualAdjudicationRequestRecord_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentScoreLedgerRecord" ADD CONSTRAINT "TournamentScoreLedgerRecord_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentQuotaLedgerRecord" ADD CONSTRAINT "TournamentQuotaLedgerRecord_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "TournamentContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TournamentQuotaLedgerRecord" ADD CONSTRAINT "TournamentQuotaLedgerRecord_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RosterImportBatch" ADD CONSTRAINT "RosterImportBatch_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RosterImportStageRow" ADD CONSTRAINT "RosterImportStageRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "RosterImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentRegulationsAckRecord" ADD CONSTRAINT "TournamentRegulationsAckRecord_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentIncidentRecord" ADD CONSTRAINT "TournamentIncidentRecord_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentExtensionRequestRecord" ADD CONSTRAINT "TournamentExtensionRequestRecord_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BotCompatibilityReceiptRecord" ADD CONSTRAINT "BotCompatibilityReceiptRecord_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
