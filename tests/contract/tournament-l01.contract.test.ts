import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AccountOnboardingDTOSchema,
  ActorSummarySchema,
  ApprovalDecisionInputSchema,
  ApprovalRequestViewSchema,
  AssignIncidentCommandSchema,
  AuthoritativeAckSchema,
  BotReadinessViewSchema,
  CANDIDATE_POLICY_DEFAULTS_V1,
  CapabilitySetSchema,
  ConsoleShellViewSchema,
  ContractPolicyEnvelopeSchema,
  CreateTournamentContractInputSchema,
  CreateUnitInputSchema,
  D00AccountTtlConfigSchema,
  D00_SYNTHETIC_FIXTURES,
  DecideAdjudicationCommandSchema,
  DecideExtensionCommandSchema,
  DecisionResponseSchema,
  DEFAULT_TOURNAMENT_RULE_PROFILE,
  DETECTOR_POLICY_MATRIX_V1,
  evaluateRuleProfileEnvelope,
  ExtensionRequestViewSchema,
  G1_APPROVED_POLICY_DEFAULTS_V1,
  G1_CAPABILITIES_LIMITS_REGISTRY,
  G1BoardCoordinateSchema,
  IncidentViewSchema,
  MatchCenterViewSchema,
  MutationEnvelopeSchema,
  normalizeTournamentCoreConfig,
  OfflineHubViewSchema,
  PieceMovementPatternSchema,
  PrincipalSummarySchema,
  RequestContextSchema,
  ResolutionSnapshotSchema,
  ResourceMetaSchema,
  ReverseRefereeDecisionCommandSchema,
  RosterImportRowDTOSchema,
  RuleProfileDraftSchema,
  RuleSnapshotSchema,
  S00ControlModeSchema,
  ScheduleComparisonSchema,
  SnapshotRefSchema,
  StaffInvitationDTOSchema,
  SupportRequestDTOSchema,
  TargetContextRefSchema,
  TournamentCoreConfigSchema,
  TournamentListQuerySchema,
  TournamentRuleProfileSchema,
  ValidatedRuleProfileSchema,
  validateTournamentCoreConfigSemantics,
} from "@ottv2/contracts";
// @ts-expect-error -- mjs script helper imported for contract safety verification
import { runGuardSelfCheck, validateDisposableDbUrl } from "../../scripts/network/disposable-db.mjs";

const sampleEnvelope = ContractPolicyEnvelopeSchema.parse({
  allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT", "HYBRID"],
  turnSecondsMin: 10,
  turnSecondsMax: 60,
  totalMatchSecondsMin: 120,
  totalMatchSecondsMax: 1800,
  turnLimitMin: 40,
  turnLimitMax: 200,
  allowedNoProgressPlies: [40, 60, 80],
  allowedRepetitionThresholds: [3, 4],
  allowedTieBreakPolicies: ["RANDOM_SEEDED", "MANUAL_REFEREE"],
});

describe("L01 — Tournament Initialization Shared Contracts & Expand-Only Migration", () => {
  it("validates P06 Unit creation inputs and rejects lowercase/invalid unitCode", () => {
    const valid = CreateUnitInputSchema.safeParse({
      unitCode: "KHOA_CNTT_01",
      unitName: "Khoa Công nghệ Thông tin",
      unitType: "KHOA",
      contactName: "Nguyễn Văn A",
      contactEmail: "cntt@example.edu.vn",
    });
    expect(valid.success).toBe(true);

    const invalid = CreateUnitInputSchema.safeParse({
      unitCode: "khoa cntt",
      unitName: "A",
      unitType: "KHOA",
      contactName: "B",
      contactEmail: "bad-email",
    });
    expect(invalid.success).toBe(false);
  });

  it("validates P07 TournamentContract inputs including validFrom < validTo and participant ceilings", () => {
    const valid = CreateTournamentContractInputSchema.safeParse({
      contractCode: "HD_CNTT_2026",
      unitId: "unit-1",
      validFrom: "2026-10-01T00:00:00.000Z",
      validTo: "2026-12-31T23:59:59.000Z",
      maxTournamentsTotal: 3,
      maxParticipantsPerTournament: 128,
      maxParticipantsTotal: 300,
      allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
      policyEnvelope: sampleEnvelope,
    });
    expect(valid.success).toBe(true);

    const invalidDates = CreateTournamentContractInputSchema.safeParse({
      contractCode: "HD_CNTT_2026",
      unitId: "unit-1",
      validFrom: "2026-12-31T23:59:59.000Z",
      validTo: "2026-10-01T00:00:00.000Z",
      maxTournamentsTotal: 3,
      maxParticipantsPerTournament: 500,
      maxParticipantsTotal: 300,
      allowedModes: ["HUMAN_ONLINE"],
      policyEnvelope: sampleEnvelope,
    });
    expect(invalidDates.success).toBe(false);
  });

  it("T071: normalizes conditional fields in TournamentCoreConfig when parent toggles change", () => {
    const raw = TournamentCoreConfigSchema.parse({
      tournamentCode: "OTT_FALL_2026",
      tournamentName: "Giải Mùa Thu 2026",
      shortDescription: "Giải đấu cấp Khoa",
      organizersText: "CLB AI & Khoa CNTT",
      competitionMode: "HUMAN_ONLINE",
      audienceScope: "PUBLIC_REGISTERED",
      allowedUnitCodes: ["KHOA_CNTT_01", "CLB_AI"],
      registrationIntakeMode: "IMPORT_ONLY",
      maxParticipants: 64,
      minParticipantsToStart: 8,
      checkinRequired: false,
      checkinOpenAt: "2026-11-01T07:00:00.000Z",
      checkinCloseAt: "2026-11-01T07:45:00.000Z",
      scheduledStartAt: "2026-11-01T08:00:00.000Z",
      scheduledEndAt: "2026-11-01T12:00:00.000Z",
      botDeadlineAt: "2026-11-01T06:00:00.000Z",
    });

    const normalized = normalizeTournamentCoreConfig(raw);
    expect(normalized.allowedUnitCodes).toEqual([]);
    expect(normalized.checkinOpenAt).toBeNull();
    expect(normalized.checkinCloseAt).toBeNull();
    expect(normalized.botDeadlineAt).toBeNull();

    const semanticIssues = validateTournamentCoreConfigSemantics(normalized, {
      requireFutureStartAt: true,
      serverNowIso: "2026-10-21T00:00:00.000Z",
    });
    expect(semanticIssues).toHaveLength(0);
  });

  it("T017 & T061: evaluates RuleProfile strictly against ContractPolicyEnvelope", () => {
    const within = evaluateRuleProfileEnvelope(DEFAULT_TOURNAMENT_RULE_PROFILE, sampleEnvelope);
    expect(within.withinEnvelope).toBe(true);
    expect(within.violations).toHaveLength(0);

    const outOfEnvelope = TournamentRuleProfileSchema.parse({
      ...DEFAULT_TOURNAMENT_RULE_PROFILE,
      turnSeconds: 90,
      noProgressPlies: 100,
      tieBreakPolicy: "BLUE_ADVANTAGE",
    });
    const check = evaluateRuleProfileEnvelope(outOfEnvelope, sampleEnvelope);
    expect(check.withinEnvelope).toBe(false);
    expect(check.violations.map((v) => v.field)).toEqual([
      "turnSeconds",
      "noProgressPlies",
      "tieBreakPolicy",
    ]);
  });

  it("T022: requires mandatory note when Admin rejects or requests changes", () => {
    expect(
      ApprovalDecisionInputSchema.safeParse({
        decision: "APPROVE",
        expectedRevision: 1,
      }).success
    ).toBe(true);

    expect(
      ApprovalDecisionInputSchema.safeParse({
        decision: "REJECT",
        expectedRevision: 1,
      }).success
    ).toBe(false);

    expect(
      ApprovalDecisionInputSchema.safeParse({
        decision: "REQUEST_CHANGES",
        expectedRevision: 1,
        note: "Vui lòng cập nhật lại lịch thi đấu.",
      }).success
    ).toBe(true);
  });

  it("exposes candidate policy defaults tagged with G0_PENDING_CONFIRMATION and D00 DTO schemas + fixtures", () => {
    expect(CANDIDATE_POLICY_DEFAULTS_V1.g0ApprovalStatus).toBe("G0_PENDING_CONFIRMATION");
    expect(CANDIDATE_POLICY_DEFAULTS_V1.scoringFormulaPreset).toBe("ELO_WEIGHTED_V1");
    expect(CANDIDATE_POLICY_DEFAULTS_V1.manualAdjudicationDeadlineSeconds).toBe(300);

    expect(
      PrincipalSummarySchema.safeParse({
        principalId: "FIX-SYS-ADMIN",
        principalType: "USER",
        email: "sysadmin@ott.test",
        displayName: "Quản trị Hệ thống",
        systemRoles: ["ADMIN"],
      }).success
    ).toBe(true);

    expect(
      D00AccountTtlConfigSchema.safeParse({
        activationTokenTtlSeconds: 86400,
        resetTokenTtlSeconds: 1800,
        staffInviteTtlSeconds: 259200,
        rosterStagingTtlSeconds: 86400,
        supportAuditRetentionDays: 365,
      }).success
    ).toBe(true);

    expect(
      AccountOnboardingDTOSchema.safeParse({
        tenantId: "unit-1",
        userId: "user-1",
        email: "sv01@example.edu.vn",
        initialState: "UNCLAIMED",
      }).success
    ).toBe(true);
    expect(
      RosterImportRowDTOSchema.safeParse({
        sourceRowId: "row-1",
        personKey: "SV001",
        displayName: "Trần Thị B",
      }).success
    ).toBe(true);
    expect(
      StaffInvitationDTOSchema.safeParse({
        invitationId: "inv-1",
        tenantId: "unit-1",
        staffEmail: "referee@example.edu.vn",
        role: "REFEREE",
        expiresAt: "2026-10-25T00:00:00.000Z",
        token: "tok-123",
        status: "PENDING",
      }).success
    ).toBe(true);
    expect(
      SupportRequestDTOSchema.safeParse({
        requestId: "req-1",
        tenantId: "unit-1",
        userId: "user-1",
        description: "Cần cấp lại mã kích hoạt",
        status: "OPEN",
        createdAt: "2026-10-21T00:00:00.000Z",
      }).success
    ).toBe(true);

    expect(D00_SYNTHETIC_FIXTURES.actors).toHaveLength(6);
    expect(D00_SYNTHETIC_FIXTURES.onboardingTokens).toHaveLength(3);
    expect(D00_SYNTHETIC_FIXTURES.staffInvitations).toHaveLength(4);
    expect(D00_SYNTHETIC_FIXTURES.supportRequests).toHaveLength(3);
    expect(D00_SYNTHETIC_FIXTURES.rosterRows).toHaveLength(10);
  });

  it("validates N00 G1 approved policy defaults, RAY/LEAP movement, zero-based coordinates, incidents, extensions, and resolution DTOs", () => {
    expect(G1_APPROVED_POLICY_DEFAULTS_V1.g0ResultStatus).toBe("PASS_REQUIREMENTS_ONLY_93_OF_93");
    expect(G1_APPROVED_POLICY_DEFAULTS_V1.coordinateWireFormat).toBe("ZERO_BASED_FILE_RANK_INDEX");
    expect(G1_APPROVED_POLICY_DEFAULTS_V1.movementFamilies).toEqual(["RAY", "LEAP"]);
    expect(G1_APPROVED_POLICY_DEFAULTS_V1.comparatorChain).toEqual([
      "WEIGHTED_MATERIAL",
      "GOAL_DISTANCE",
      "MOBILITY",
    ]);
    expect(G1_APPROVED_POLICY_DEFAULTS_V1.finalTiePolicyDefault).toBe("SECOND_MOVER_WINS");
    expect(G1_APPROVED_POLICY_DEFAULTS_V1.extensionPolicyDefaults.maxCumulativeExtensionMinutes).toBe(
      120
    );

    expect(G1_CAPABILITIES_LIMITS_REGISTRY.boardSizeBounds).toEqual({ min: 5, max: 15 });
    expect(G1_CAPABILITIES_LIMITS_REGISTRY.botComputeCaps.turnMs).toBe(500);
    expect(G1_CAPABILITIES_LIMITS_REGISTRY.botComputeCaps.preflightMs).toBe(250);
    expect(DETECTOR_POLICY_MATRIX_V1.DISCONNECT_TIMEOUT.autoActionAllowed).toBe(true);
    expect(DETECTOR_POLICY_MATRIX_V1.ADMIN_FLAGGED_SUSPICIOUS.autoActionAllowed).toBe(false);

    expect(
      G1BoardCoordinateSchema.safeParse({ fileIndex: 0, rankIndex: 8 }).success
    ).toBe(true);
    expect(
      G1BoardCoordinateSchema.safeParse({ fileIndex: 15, rankIndex: 0 }).success
    ).toBe(false);

    expect(
      PieceMovementPatternSchema.safeParse({
        family: "RAY",
        directions: ["N", "NE", "NW"],
        minDistance: 1,
        maxDistance: 3,
        canJump: false,
      }).success
    ).toBe(true);

    expect(
      PieceMovementPatternSchema.safeParse({
        family: "LEAP",
        offsets: [
          { dx: 1, dy: 2 },
          { dx: -1, dy: 2 },
        ],
      }).success
    ).toBe(true);

    const validRuleDraft = RuleProfileDraftSchema.safeParse({
      schemaVersion: 1,
      boardSize: 9,
      winConditions: ["EXTINCTION", "GOAL_REACHED"],
      goalPlacement: {
        mode: "STATIC",
        blueGoal: { fileIndex: 4, rankIndex: 8 },
        redGoal: { fileIndex: 4, rankIndex: 0 },
      },
      materialWeights: { R: 1, P: 1, S: 1 },
      drawEnabled: false,
      finalTiePolicy: "SECOND_MOVER_WINS",
      manualTieTimeoutSeconds: 300,
      manualTieFallbackPolicy: "SECOND_MOVER_WINS",
      firstMovePolicy: "BLUE_FIRST",
      sideSwapPolicy: "ALTERNATE_BY_PAIR",
      maxPlies: 120,
      noProgressPlies: 60,
      repetitionThreshold: 3,
    });
    expect(validRuleDraft.success).toBe(true);

    expect(
      ValidatedRuleProfileSchema.safeParse({
        draft: validRuleDraft.data,
        withinContractEnvelope: true,
        requiresSaApproval: false,
        initialReachabilityPassed: true,
        warnings: [],
        errors: [],
      }).success
    ).toBe(true);

    expect(
      RuleSnapshotSchema.safeParse({
        snapshotId: "snap-v1",
        tournamentId: "tour-1",
        versionNumber: 1,
        effectiveAt: "2026-10-21T10:00:00.000Z",
        publishedByUserId: "ta-1",
        profile: validRuleDraft.data,
      }).success
    ).toBe(true);

    expect(
      ResolutionSnapshotSchema.safeParse({
        matchId: "match-1",
        tournamentId: "tour-1",
        ruleSnapshotId: "snap-v1",
        plyCount: 120,
        terminationReason: "MAX_PLIES_REACHED",
        criteriaChain: [
          {
            criterion: "WEIGHTED_MATERIAL",
            blueValue: 5,
            redValue: 5,
            decidedWinner: null,
          },
          {
            criterion: "GOAL_DISTANCE",
            blueValue: 2,
            redValue: 2,
            decidedWinner: null,
          },
          {
            criterion: "MOBILITY",
            blueValue: 4,
            redValue: 4,
            decidedWinner: null,
          },
        ],
        finalOutcome: "MANUAL_EXACT_TIE_PENDING",
        winnerSide: null,
        boardStatePublic: { boardSize: 9, pieces: [] },
      }).success
    ).toBe(true);

    expect(
      DecideAdjudicationCommandSchema.safeParse({
        adjudicationId: "adj-1",
        expectedRevision: 1,
        winnerSide: "RED",
        reason: "Đỏ chủ động tấn công mục tiêu ở thế cân bằng.",
      }).success
    ).toBe(true);

    expect(
      DecisionResponseSchema.safeParse({
        adjudicationId: "adj-1",
        settlementState: "SETTLED",
        winnerSide: "RED",
        finishSequence: 12,
        decidedAt: "2026-10-21T10:05:00.000Z",
      }).success
    ).toBe(true);

    expect(
      TargetContextRefSchema.safeParse({
        contextType: "TOURNAMENT",
        tournamentId: "tour-1",
        ruleSnapshotId: "snap-v1",
      }).success
    ).toBe(true);

    expect(
      BotReadinessViewSchema.safeParse({
        participantId: "part-1",
        botRevisionId: "bot-rev-1",
        targetContext: {
          contextType: "TOURNAMENT",
          tournamentId: "tour-1",
          ruleSnapshotId: "snap-v1",
        },
        readinessStatus: "READY",
        preflightDurationMs: 120,
        lastCheckedAt: "2026-10-21T10:00:00.000Z",
        publicReason: "Bot tương thích với phiên bản luật hiện hành.",
      }).success
    ).toBe(true);

    expect(
      IncidentViewSchema.safeParse({
        incidentId: "inc-1",
        tournamentId: "tour-1",
        matchId: "match-1",
        detectorType: "ADMIN_FLAGGED_SUSPICIOUS",
        status: "ASSIGNED",
        assignedRefereeUserId: "ref-1",
        summary: "Nghi vấn dàn xếp nước đi ở bàn 3.",
        createdAt: "2026-10-21T10:00:00.000Z",
      }).success
    ).toBe(true);

    expect(
      AssignIncidentCommandSchema.safeParse({
        incidentId: "inc-1",
        refereeUserId: "ref-1",
        note: "Phân công Trọng tài phụ trách kiểm tra biên bản bàn 3.",
      }).success
    ).toBe(true);

    expect(
      ReverseRefereeDecisionCommandSchema.safeParse({
        incidentId: "inc-1",
        expectedRevision: 2,
        newAction: "ANNUL_AND_REPLAY",
        reason: "TA huỷ quyết định xử thua do phát hiện sự cố mạng khách quan.",
      }).success
    ).toBe(true);

    expect(
      ScheduleComparisonSchema.safeParse({
        currentEndAt: "2026-11-01T12:00:00.000Z",
        requestedAddMinutes: 45,
        proposedEndAt: "2026-11-01T12:45:00.000Z",
        cumulativeExtendedMinutesBefore: 30,
        remainingExtensionBudgetMinutes: 90,
      }).success
    ).toBe(true);

    expect(
      ExtensionRequestViewSchema.safeParse({
        requestId: "ext-1",
        tournamentId: "tour-1",
        requestedByTaUserId: "ta-1",
        requestedMinutes: 45,
        approvedMinutes: null,
        status: "PENDING",
        reason: "Giải cần thêm 45 phút cho loạt trận chung kết nhánh.",
        scheduleComparison: {
          currentEndAt: "2026-11-01T12:00:00.000Z",
          requestedAddMinutes: 45,
          proposedEndAt: "2026-11-01T12:45:00.000Z",
          cumulativeExtendedMinutesBefore: 30,
          remainingExtensionBudgetMinutes: 90,
        },
        createdAt: "2026-11-01T11:15:00.000Z",
      }).success
    ).toBe(true);

    expect(
      DecideExtensionCommandSchema.safeParse({
        requestId: "ext-1",
        decision: "APPROVE_PARTIAL",
        approvedMinutes: 30,
        note: "Phê duyệt gia hạn 30 phút để không trùng ca chiều.",
      }).success
    ).toBe(true);
  });

  it("validates S00 Console DTOs and L00 transport/envelope/approval contracts", () => {
    expect(S00ControlModeSchema.safeParse("HUMAN_ONLY").success).toBe(true);
    expect(S00ControlModeSchema.safeParse("BOT_ONLY").success).toBe(true);

    expect(
      ActorSummarySchema.safeParse({
        principalId: "ta-1",
        displayName: "Quản trị giải CNTT",
        role: "TOURNAMENT_ADMIN",
        unitIds: ["unit-1"],
        contractIds: ["contract-1"],
      }).success
    ).toBe(true);

    expect(
      CapabilitySetSchema.safeParse({
        canManageUnits: false,
        canManageContracts: false,
        canApproveTournaments: false,
        canCreateTournamentDraft: true,
        canEditDraft: true,
        canSubmitForApproval: true,
        canManageRoster: true,
        canManageStaff: true,
        canAdjudicateExactTie: true,
        canRequestExtension: true,
        canReverseRefereeDecision: true,
        canViewAuditLogs: true,
      }).success
    ).toBe(true);

    expect(
      ConsoleShellViewSchema.safeParse({
        actor: {
          principalId: "ta-1",
          displayName: "Quản trị giải CNTT",
          role: "TOURNAMENT_ADMIN",
          unitIds: ["unit-1"],
          contractIds: ["contract-1"],
        },
        capabilities: {
          canManageUnits: false,
          canManageContracts: false,
          canApproveTournaments: false,
          canCreateTournamentDraft: true,
          canEditDraft: true,
          canSubmitForApproval: true,
          canManageRoster: true,
          canManageStaff: true,
          canAdjudicateExactTie: true,
          canRequestExtension: true,
          canReverseRefereeDecision: true,
          canViewAuditLogs: true,
        },
        navigation: [
          {
            key: "tournaments",
            label: "Danh sách giải đấu",
            path: "/console/tournaments",
            badgeCount: 2,
          },
        ],
      }).success
    ).toBe(true);

    expect(
      TournamentListQuerySchema.safeParse({
        status: "RUNNING",
        controlMode: "HUMAN_ONLY",
        page: 1,
        pageSize: 20,
      }).success
    ).toBe(true);

    expect(
      MatchCenterViewSchema.safeParse({
        tournamentId: "tour-1",
        activeRound: "CTF",
        ctfSchedule: {
          roundLabel: "Vòng loại CTF",
          startsAt: "2026-11-01T08:00:00.000Z",
          endsAt: "2026-11-01T10:00:00.000Z",
        },
        customSchedule: null,
        broadcast: {
          enabled: true,
          delaySeconds: 15,
          featuredMatchId: "match-1",
        },
        matches: [
          {
            matchId: "match-1",
            roomId: "room-1",
            roundType: "CTF",
            status: "RUNNING",
            blueDisplayName: "Nguyễn Văn A",
            redDisplayName: "Trần Thị B",
            assignedRefereeName: "Trọng tài 01",
            openIncidentCount: 0,
          },
        ],
        openIncidents: [],
        pendingExtensions: [],
      }).success
    ).toBe(true);

    expect(
      OfflineHubViewSchema.safeParse({
        offlineAllowedWhileTournamentRunning: true,
        entries: [
          {
            modeKey: "AI_PRACTICE",
            title: "Đấu với Máy (Offline)",
            description: "Luyện tập chiến thuật không cần kết nối giải.",
            available: true,
          },
        ],
      }).success
    ).toBe(true);

    expect(
      MutationEnvelopeSchema.safeParse({
        commandId: "cmd-001",
        expectedRevision: 3,
        reason: "Cập nhật lịch thi đấu theo đề nghị của Khoa.",
        payload: { scheduledStartAt: "2026-11-01T08:30:00.000Z" },
      }).success
    ).toBe(true);

    expect(
      AuthoritativeAckSchema.safeParse({
        acknowledged: true,
        resourceId: "tour-1",
        revision: 4,
        serverTimestamp: "2026-10-21T10:00:00.000Z",
        auditEventId: "aud-101",
      }).success
    ).toBe(true);

    expect(
      RequestContextSchema.safeParse({
        requestId: "req-101",
        actorUserId: "ta-1",
        actorRole: "TOURNAMENT_ADMIN",
        unitIds: ["unit-1"],
        contractIds: ["contract-1"],
        receivedAt: "2026-10-21T10:00:00.000Z",
      }).success
    ).toBe(true);

    expect(
      ResourceMetaSchema.safeParse({
        id: "tour-1",
        revision: 2,
        createdAt: "2026-10-20T00:00:00.000Z",
        updatedAt: "2026-10-21T00:00:00.000Z",
      }).success
    ).toBe(true);

    expect(
      SnapshotRefSchema.safeParse({
        snapshotId: "snap-1",
        versionNumber: 1,
        digestSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        capturedAt: "2026-10-21T00:00:00.000Z",
      }).success
    ).toBe(true);

    expect(
      ApprovalRequestViewSchema.safeParse({
        requestId: "apr-1",
        requestKind: "INITIAL_APPROVAL",
        tournamentId: "tour-1",
        tournamentCode: "OTT_FALL_2026",
        tournamentName: "Giải Mùa Thu 2026",
        contractId: "contract-1",
        unitId: "unit-1",
        requestedByTaUserId: "ta-1",
        status: "PENDING",
        expectedRevision: 1,
        diffs: [],
        fieldNotes: [],
        submittedAt: "2026-10-21T09:00:00.000Z",
      }).success
    ).toBe(true);
  });

  it("verifies L01 SQL migration is strictly expand-only across L00/N00/S00/D00 tables and disposable DB guard blocks default DB", () => {
    const sqlPath = resolve(
      process.cwd(),
      "prisma/migrations/20261021100000_l01_tournament_initialization/migration.sql"
    );
    const sql = readFileSync(sqlPath, "utf8");

    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT)\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).toContain('CREATE TABLE "Unit"');
    expect(sql).toContain('CREATE TABLE "TournamentContract"');
    expect(sql).toContain('CREATE TABLE "TournamentContractTaBinding"');
    expect(sql).toContain('CREATE TABLE "Tournament"');
    expect(sql).toContain('CREATE TABLE "TournamentConfigVersionRecord"');
    expect(sql).toContain('CREATE TABLE "TournamentChangeRequestRecord"');
    expect(sql).toContain('CREATE TABLE "TournamentEnrollmentRecord"');
    expect(sql).toContain('CREATE TABLE "TournamentStaffAssignmentRecord"');
    expect(sql).toContain('CREATE TABLE "ManualAdjudicationRequestRecord"');
    expect(sql).toContain('CREATE TABLE "TournamentScoreLedgerRecord"');
    expect(sql).toContain('CREATE TABLE "TournamentAuditLogRecord"');
    expect(sql).toContain('CREATE TABLE "TournamentQuotaLedgerRecord"');
    expect(sql).toContain('CREATE TABLE "SystemRoleAssignment"');
    expect(sql).toContain('CREATE TABLE "AccountClaimToken"');
    expect(sql).toContain('CREATE TABLE "RosterImportBatch"');
    expect(sql).toContain('CREATE TABLE "RosterImportStageRow"');
    expect(sql).toContain('CREATE TABLE "SupportRecoveryTicket"');
    expect(sql).toContain('CREATE TABLE "TournamentRegulationsAckRecord"');
    expect(sql).toContain('CREATE TABLE "TournamentIncidentRecord"');
    expect(sql).toContain('CREATE TABLE "TournamentExtensionRequestRecord"');
    expect(sql).toContain('CREATE TABLE "BotCompatibilityReceiptRecord"');
    expect(sql).toContain('ALTER TABLE "Match" ADD COLUMN "finishSequence" INTEGER');

    const guardCheck = runGuardSelfCheck();
    expect(guardCheck.passed).toBe(true);

    expect(() =>
      validateDisposableDbUrl("postgresql://postgres:postgres@localhost:5432/ott")
    ).toThrow(/lacks required disposable marker/);

    expect(
      validateDisposableDbUrl("postgresql://postgres:postgres@127.0.0.1:5432/ott_l01_test", {
        databaseUrl: "postgresql://postgres:postgres@127.0.0.1:5432/ott",
      }).sanitizedIdentifier
    ).toMatchObject({
      host: "127.0.0.1",
      database: "ott_l01_test",
      disposable: true,
    });
  });
});
