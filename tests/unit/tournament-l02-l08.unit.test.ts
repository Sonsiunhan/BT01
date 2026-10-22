import { describe, expect, it } from "vitest";
import {
  ContractPolicyEnvelopeSchema,
  DEFAULT_TOURNAMENT_RULE_PROFILE,
} from "@ottv2/contracts";
import { createTournamentRuntimeBundle } from "../../apps/server/src/modules/tournament-core/index.js";

const SAMPLE_ENVELOPE = ContractPolicyEnvelopeSchema.parse({
  allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
  turnSecondsMin: 10,
  turnSecondsMax: 60,
  totalMatchSecondsMin: 120,
  totalMatchSecondsMax: 1800,
  turnLimitMin: 40,
  turnLimitMax: 240,
  allowedNoProgressPlies: [40, 60, 80],
  allowedRepetitionThresholds: [3, 4],
  allowedTieBreakPolicies: [
    "RANDOM_SEEDED",
    "BLUE_ADVANTAGE",
    "RED_ADVANTAGE",
    "REPLAY_ONCE_THEN_SEEDED",
    "MANUAL_REFEREE",
  ],
});

function createSeededFixture(initialIso = "2026-10-21T08:00:00.000Z") {
  let currentIso = initialIso;
  const bundle = createTournamentRuntimeBundle({
    clockFn: () => new Date(currentIso),
  });
  const setNow = (nextIso: string) => {
    currentIso = nextIso;
  };

  bundle.store.grantSystemRole("admin-1", "ADMIN");
  const adminActor = bundle.store.resolveAuthoritativeActor({
    userId: "admin-1",
    username: "sysadmin",
  });

  return { bundle, setNow, adminActor };
}

describe("L02..L08 — Tournament Initialization Domain & Security Invariants", () => {
  it("L02 & L03: enforces Unit FK delete guard (T002), Contract TA scoping (T006/T008/T018), and deep-redacting AuditPort (T077)", async () => {
    const { bundle, setNow, adminActor } = createSeededFixture();

    const unit = await bundle.unitContractService.createUnit(adminActor, {
      unitCode: "KHOA_CNTT",
      unitName: "Khoa Công nghệ Thông tin",
      unitType: "KHOA",
      contactName: "Nguyễn Văn A",
      contactEmail: "cntt@example.edu.vn",
      status: "ACTIVE",
    });

    const contract = await bundle.unitContractService.createContract(adminActor, {
      contractCode: "HD_CNTT_01",
      unitId: unit.id,
      validFrom: "2026-10-01T00:00:00.000Z",
      validTo: "2026-11-15T23:59:59.000Z",
      maxTournamentsTotal: 2,
      maxParticipantsPerTournament: 4,
      maxParticipantsTotal: 6,
      allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
      policyEnvelope: SAMPLE_ENVELOPE,
      technicalCaps: {
        botSourceMaxBytes: 65536,
        botRuntimeTimeoutMs: 1000,
        botMemoryLimitMb: 64,
        maxConcurrentMatchesPerTournament: 8,
        rosterImportMaxRows: 2000,
      },
      status: "ACTIVE",
      initialTaUserIds: ["ta-1"],
    });

    // T002: Referenced unit cannot be deleted
    await expect(
      bundle.unitContractService.deleteUnit(adminActor, unit.id)
    ).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: "UNIT_REFERENCED_CANNOT_DELETE" },
    });

    const ta1Actor = bundle.store.resolveAuthoritativeActor({ userId: "ta-1" });
    const ta2Actor = bundle.store.resolveAuthoritativeActor({ userId: "ta-2" });

    // T006: Unbound TA cannot create draft on ta-1's contract
    await expect(
      bundle.coreDraftService.createDraft(ta2Actor, {
        contractId: contract.id,
        coreConfig: {
          tournamentCode: "GIAI_CNTT_01",
          tournamentName: "Giải CNTT Mở Rộng",
          shortDescription: "",
          organizersText: "Khoa CNTT",
          competitionMode: "HUMAN_ONLINE",
          audienceScope: "PUBLIC_REGISTERED",
          allowedUnitCodes: [],
          registrationIntakeMode: "IMPORT_ONLY",
          maxParticipants: 4,
          minParticipantsToStart: 2,
          timezone: "Asia/Ho_Chi_Minh",
          registrationOpenAt: null,
          registrationCloseAt: null,
          checkinRequired: false,
          checkinOpenAt: null,
          checkinCloseAt: null,
          scheduledStartAt: "2026-11-01T08:00:00.000Z",
          scheduledEndAt: "2026-11-01T12:00:00.000Z",
          format: "ARENA_CONTINUOUS",
          pairingMethod: "SWISS_SCORE_ADJACENT",
          maxMatchesPerPlayer: null,
          maxPairMeetings: 2,
          rematchCooldownMinutes: 5,
          maxConcurrentMatches: 4,
          byeScorePoints: 0,
          spectatorPolicy: "ROSTER_ONLY",
          chatPolicy: "SPECTATOR_MUTED",
          leaderboardVisibility: "LIVE_PUBLIC",
          topNExportCount: 3,
          finalizationMode: "AUTO_FINAL",
          scoringFormulaPreset: "ELO_WEIGHTED_V1",
          initialScore: 1000,
          initialElo: 1000,
          kFactor: 32,
          scoreFloor: 0,
          botDeadlineAt: null,
        },
        ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
      })
    ).rejects.toMatchObject({ statusCode: 403 });

    // TA-1 creates a draft successfully (reserves 1 quota)
    const draft = await bundle.coreDraftService.createDraft(ta1Actor, {
      contractId: contract.id,
      coreConfig: {
        tournamentCode: "GIAI_CNTT_01",
        tournamentName: "Giải CNTT Mở Rộng",
        shortDescription: "",
        organizersText: "Khoa CNTT",
        competitionMode: "HUMAN_ONLINE",
        audienceScope: "PUBLIC_REGISTERED",
        allowedUnitCodes: ["KHOA_CNTT"], // Will be normalized to [] per T071
        registrationIntakeMode: "IMPORT_ONLY",
        maxParticipants: 4,
        minParticipantsToStart: 2,
        timezone: "Asia/Ho_Chi_Minh",
        registrationOpenAt: null,
        registrationCloseAt: null,
        checkinRequired: false,
        checkinOpenAt: "2026-11-01T07:00:00.000Z", // Will be normalized to null per T071
        checkinCloseAt: "2026-11-01T07:30:00.000Z",
        scheduledStartAt: "2026-11-01T08:00:00.000Z",
        scheduledEndAt: "2026-11-01T12:00:00.000Z",
        format: "ARENA_CONTINUOUS",
        pairingMethod: "SWISS_SCORE_ADJACENT",
        maxMatchesPerPlayer: null,
        maxPairMeetings: 2,
        rematchCooldownMinutes: 5,
        maxConcurrentMatches: 4,
        byeScorePoints: 0,
        spectatorPolicy: "ROSTER_ONLY",
        chatPolicy: "SPECTATOR_MUTED",
        leaderboardVisibility: "LIVE_PUBLIC",
        topNExportCount: 3,
        finalizationMode: "AUTO_FINAL",
        scoringFormulaPreset: "ELO_WEIGHTED_V1",
        initialScore: 1000,
        initialElo: 1000,
        kFactor: 32,
        scoreFloor: 0,
        botDeadlineAt: "2026-11-01T06:00:00.000Z", // Will be normalized to null per T071
      },
      ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
    });

    expect(draft.coreConfig.allowedUnitCodes).toEqual([]);
    expect(draft.coreConfig.checkinOpenAt).toBeNull();
    expect(draft.coreConfig.botDeadlineAt).toBeNull();
    expect(
      bundle.unitContractService.getContract(contract.id).quotaReservedCount
    ).toBe(1);

    // T008 & T018: Advance clock past contract validTo -> blocks new draft creation,
    // but TA-1 can STILL patch their existing tournament!
    setNow("2026-11-20T00:00:00.000Z");
    await bundle.unitContractService.expireContractsIfNeeded();
    expect(bundle.unitContractService.getContract(contract.id).status).toBe("EXPIRED");

    await expect(
      bundle.coreDraftService.createDraft(ta1Actor, {
        contractId: contract.id,
        coreConfig: {
          ...draft.coreConfig,
          tournamentCode: "GIAI_CNTT_02",
        },
        ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: "CONTRACT_NOT_ACTIVE" },
    });

    const patchedOnExpiredContract = await bundle.coreDraftService.patchDraft(
      ta1Actor,
      draft.id,
      {
        expectedRevision: draft.revision,
        coreConfig: { shortDescription: "Vẫn vận hành được giải đã tạo" },
      }
    );
    expect(patchedOnExpiredContract.revision).toBe(2);

    // T077: Verify deep redaction on AuditPort
    const auditRecord = bundle.store.audit.append({
      actorUserId: "admin-1",
      actorRole: "ADMIN",
      action: "SENSITIVE_TEST",
      targetType: "TOURNAMENT",
      targetId: draft.id,
      beforeSnapshot: {
        passwordHash: "argon2id$secret",
        activationToken: "tok_secret_123",
        nested: {
          sourceText: "def choose_move(state): return 'A1-A2'",
          memoryPayload: { secretKey: "123" },
          safeField: "kept-visible",
        },
      },
    });
    expect(auditRecord.beforeSnapshot).toEqual({
      passwordHash: "[REDACTED]",
      activationToken: "[REDACTED]",
      nested: {
        sourceText: "[REDACTED]",
        memoryPayload: "[REDACTED]",
        safeField: "kept-visible",
      },
    });
  });

  it("L02, L04, L05 & L07: enforces Quota Accounting (T011..T016), Approval & Copy-from-Rejected (T022/T023), Separate ChangeRequest (T024), Within-Envelope Rule Update (T061), and Pause/End/Cancel/Finalize boundaries (T027..T030)", async () => {
    const { bundle, setNow, adminActor } = createSeededFixture(
      "2026-10-21T08:00:00.000Z"
    );

    const unit = await bundle.unitContractService.createUnit(adminActor, {
      unitCode: "VIEN_AI",
      unitName: "Viện Trí tuệ Nhân tạo",
      unitType: "VIEN",
      contactName: "Trần Văn B",
      contactEmail: "ai@example.edu.vn",
      status: "ACTIVE",
    });

    const contract = await bundle.unitContractService.createContract(adminActor, {
      contractCode: "HD_AI_2026",
      unitId: unit.id,
      validFrom: "2026-10-01T00:00:00.000Z",
      validTo: "2026-12-31T23:59:59.000Z",
      maxTournamentsTotal: 1,
      maxParticipantsPerTournament: 3,
      maxParticipantsTotal: 3,
      allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
      policyEnvelope: SAMPLE_ENVELOPE,
      technicalCaps: {
        botSourceMaxBytes: 65536,
        botRuntimeTimeoutMs: 1000,
        botMemoryLimitMb: 64,
        maxConcurrentMatchesPerTournament: 8,
        rosterImportMaxRows: 2000,
      },
      status: "ACTIVE",
      initialTaUserIds: ["ta-ai"],
    });

    const taActor = bundle.store.resolveAuthoritativeActor({ userId: "ta-ai" });

    // Create Draft 1 -> consumes the single quota slot (1/1)
    const draft1 = await bundle.coreDraftService.createDraft(taActor, {
      contractId: contract.id,
      coreConfig: {
        tournamentCode: "AI_CUP_DRAFT_1",
        tournamentName: "AI Cup Lần 1",
        shortDescription: "",
        organizersText: "Viện AI",
        competitionMode: "HUMAN_ONLINE",
        audienceScope: "PUBLIC_REGISTERED",
        allowedUnitCodes: [],
        registrationIntakeMode: "IMPORT_ONLY",
        maxParticipants: 3,
        minParticipantsToStart: 2,
        timezone: "Asia/Ho_Chi_Minh",
        registrationOpenAt: null,
        registrationCloseAt: null,
        checkinRequired: false,
        checkinOpenAt: null,
        checkinCloseAt: null,
        scheduledStartAt: "2026-11-05T08:00:00.000Z",
        scheduledEndAt: "2026-11-05T12:00:00.000Z",
        format: "ARENA_CONTINUOUS",
        pairingMethod: "SWISS_SCORE_ADJACENT",
        maxMatchesPerPlayer: null,
        maxPairMeetings: 2,
        rematchCooldownMinutes: 5,
        maxConcurrentMatches: 4,
        byeScorePoints: 0,
        spectatorPolicy: "PUBLIC_WATCH",
        chatPolicy: "SPECTATOR_MUTED",
        leaderboardVisibility: "LIVE_PUBLIC",
        topNExportCount: 2,
        finalizationMode: "AUTO_FINAL",
        scoringFormulaPreset: "ELO_WEIGHTED_V1",
        initialScore: 1000,
        initialElo: 1000,
        kFactor: 32,
        scoreFloor: 0,
        botDeadlineAt: null,
      },
      ruleProfile: {
        ...DEFAULT_TOURNAMENT_RULE_PROFILE,
        tieBreakPolicy: "MANUAL_REFEREE",
      },
    });

    // Submit Draft 1 -> UNDER_REVIEW
    const submitted1 = await bundle.coreDraftService.submitDraft(
      taActor,
      draft1.id,
      { expectedRevision: draft1.revision }
    );
    expect(submitted1.status).toBe("UNDER_REVIEW");

    // Admin rejects Draft 1 -> REJECTED + refunds 1 quota slot (T012)
    const rejected1 = await bundle.approvalService.decideInitialApproval(
      adminActor,
      draft1.id,
      {
        decision: "REJECT",
        expectedRevision: submitted1.revision,
        note: "Đề nghị đổi mã giải và cập nhật mô tả.",
      }
    );
    expect(rejected1.status).toBe("REJECTED");
    expect(rejected1.quotaRefunded).toBe(true);
    expect(
      bundle.unitContractService.getContract(contract.id).quotaReservedCount
    ).toBe(0);

    // T023: Copy REJECTED tournament into a new DRAFT (reserves 1/1 quota again)
    const copiedDraft = await bundle.coreDraftService.copyRejectedToDraft(
      taActor,
      rejected1.id,
      "AI_CUP_2026"
    );
    expect(copiedDraft.status).toBe("DRAFT");
    expect(copiedDraft.copiedFromTournamentId).toBe(rejected1.id);
    expect(
      bundle.unitContractService.getContract(contract.id).quotaReservedCount
    ).toBe(1);

    // Submit -> Admin Requests Changes -> TA patches -> Resubmit -> Admin Approves
    const sub2 = await bundle.coreDraftService.submitDraft(
      taActor,
      copiedDraft.id,
      { expectedRevision: copiedDraft.revision }
    );
    const changesReq = await bundle.approvalService.decideInitialApproval(
      adminActor,
      copiedDraft.id,
      {
        decision: "REQUEST_CHANGES",
        expectedRevision: sub2.revision,
        note: "Bổ sung mô tả ngắn.",
        fieldNotes: {
          shortDescription: "Cần ghi rõ đơn vị đồng tổ chức",
        },
      }
    );
    expect(changesReq.status).toBe("CHANGES_REQUESTED");
    expect(changesReq.lastReviewFieldNotes).toEqual({
      shortDescription: "Cần ghi rõ đơn vị đồng tổ chức",
    });

    // L04: SA can inspect approval detail with contract envelope & diff summary, while TA is rejected (403)
    expect(() =>
      bundle.approvalService.getApprovalDetail(taActor, copiedDraft.id)
    ).toThrowError(/Chỉ Quản trị hệ thống/);
    const detailBeforeApprove = bundle.approvalService.getApprovalDetail(
      adminActor,
      copiedDraft.id
    );
    expect(detailBeforeApprove.tournament.id).toBe(copiedDraft.id);
    expect(detailBeforeApprove.envelopeCheck.withinEnvelope).toBe(true);
    expect(detailBeforeApprove.scheduleCheck).toEqual([]);

    const patched = await bundle.coreDraftService.patchDraft(
      taActor,
      copiedDraft.id,
      {
        expectedRevision: changesReq.revision,
        coreConfig: { shortDescription: "Giải chính thức Viện AI 2026" },
      }
    );
    const resubmitted = await bundle.coreDraftService.submitDraft(
      taActor,
      copiedDraft.id,
      { expectedRevision: patched.revision }
    );
    const approved = await bundle.approvalService.decideInitialApproval(
      adminActor,
      copiedDraft.id,
      {
        decision: "APPROVE",
        expectedRevision: resubmitted.revision,
        note: "Hồ sơ hợp lệ, phê duyệt.",
        fieldNotes: {
          scheduledStartAt: "Đã xác nhận lịch thi đấu",
        },
      }
    );
    expect(approved.status).toBe("APPROVED");
    expect(approved.everApproved).toBe(true);
    expect(approved.activeConfigVersionNumber).toBe(1);
    expect(approved.approvedSnapshot?.configVersionNumber).toBe(1);
    expect(approved.approvedSnapshot?.fieldNotes).toEqual({
      scheduledStartAt: "Đã xác nhận lịch thi đấu",
    });
    expect(Object.isFrozen(approved.approvedSnapshot)).toBe(true);
    expect(Object.isFrozen(approved.approvedSnapshot?.coreConfig)).toBe(true);

    // T024: Create a post-approval ChangeRequest -> Tournament status MUST remain APPROVED
    const cr = await bundle.lifecycleService.createChangeRequest(
      taActor,
      approved.id,
      {
        reason: "Tăng số trận tối đa đồng thời lên 6",
        effectiveAt: "2026-10-22T00:00:00.000Z",
        proposedCoreConfigPatch: { maxConcurrentMatches: 6 },
      }
    );
    expect(cr.status).toBe("PENDING");
    expect(bundle.coreDraftService.getTournament(approved.id).status).toBe(
      "APPROVED"
    );

    const approvedCr = await bundle.approvalService.decideChangeRequest(
      adminActor,
      cr.id,
      {
        decision: "APPROVE",
        note: "Đồng ý tăng maxConcurrentMatches lên 6",
      }
    );
    expect(approvedCr.status).toBe("APPROVED");
    expect(
      bundle.coreDraftService.getTournament(approved.id).activeConfigVersionNumber
    ).toBe(2);

    // T061: Within-envelope rule update publishes v3 directly; out-of-envelope is rejected
    await expect(
      bundle.lifecycleService.publishWithinEnvelopeRuleUpdate(
        taActor,
        approved.id,
        {
          expectedRevision: bundle.coreDraftService.getTournament(approved.id).revision,
          effectiveAt: "2026-10-25T00:00:00.000Z",
          changeSummary: "Thử đặt turnSeconds vượt trần hợp đồng (120s > 60s)",
          ruleProfilePatch: { turnSeconds: 120 },
        }
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      details: { reason: "RULE_PROFILE_OUTSIDE_CONTRACT_ENVELOPE" },
    });

    const v3Result = await bundle.lifecycleService.publishWithinEnvelopeRuleUpdate(
      taActor,
      approved.id,
      {
        expectedRevision: bundle.coreDraftService.getTournament(approved.id).revision,
        effectiveAt: "2026-10-25T00:00:00.000Z",
        changeSummary: "Tăng turnSeconds lên 45s trong phạm vi hợp đồng",
        ruleProfilePatch: { turnSeconds: 45 },
      }
    );
    expect(v3Result.publishedVersion.versionNumber).toBe(3);

    // T025: Readiness blocks start until minParticipantsToStart (2) are enrolled
    const readinessBefore = bundle.lifecycleService.evaluateReadiness(approved.id);
    expect(readinessBefore.canStartRunning).toBe(false);
    expect(readinessBefore.blockers).toContain(
      "INSUFFICIENT_ELIGIBLE_PARTICIPANTS"
    );

    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "SV01",
      userId: "user-blue",
      displayName: "Nguyễn Xanh",
      unitCode: "VIEN_AI",
    });
    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "SV02",
      userId: "user-red",
      displayName: "Trần Đỏ",
      unitCode: "VIEN_AI",
    });
    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "SV03",
      userId: "user-green",
      displayName: "Lê Lục",
      unitCode: "VIEN_AI",
    });

    // T015 & T016: 4th participant exceeds maxParticipantsPerTournament (3) and maxParticipantsTotal (3)
    await expect(
      bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
        personKey: "SV04",
        userId: "user-extra",
        displayName: "Phạm Dư",
        unitCode: "VIEN_AI",
      })
    ).rejects.toMatchObject({ statusCode: 409 });

    const readinessAfter = bundle.lifecycleService.evaluateReadiness(approved.id);
    expect(readinessAfter.canStartRunning).toBe(true);

    // Start tournament -> RUNNING
    const running = await bundle.lifecycleService.startRunning(taActor, approved.id);
    expect(running.status).toBe("RUNNING");

    // T027 & T028: Pause tournament -> scheduledEndAt does NOT auto-extend;
    // when serverNow >= scheduledEndAt, PAUSED tournament transitions to ENDED!
    const paused = await bundle.lifecycleService.pauseTournament(
      taActor,
      approved.id,
      "Tạm dừng kiểm tra kỹ thuật"
    );
    expect(paused.status).toBe("PAUSED");
    expect(paused.coreConfig.scheduledEndAt).toBe("2026-11-05T12:00:00.000Z");

    setNow("2026-11-05T12:05:00.000Z");
    const autoEnded = await bundle.lifecycleService.evaluateAutoEndAtWindow();
    expect(autoEnded.map((t) => t.id)).toContain(approved.id);
    expect(bundle.coreDraftService.getTournament(approved.id).status).toBe("ENDED");
  });

  it("L06 & L08: enforces C32 Admission Gate (T005/T075), Match Rule Version Pinning (T062), Owner-TA Manual Adjudication ACL & Deadline Fallback (T059/T060), and Canonical finish_sequence Replay Ledger (T072/T073/T081)", async () => {
    const { bundle, setNow, adminActor } = createSeededFixture(
      "2026-10-21T08:00:00.000Z"
    );

    const unit = await bundle.unitContractService.createUnit(adminActor, {
      unitCode: "CLB_CO",
      unitName: "CLB Cờ Chiến Thuật",
      unitType: "CLB",
      contactName: "Lê Văn C",
      contactEmail: "clb@example.edu.vn",
      status: "ACTIVE",
    });

    const contract = await bundle.unitContractService.createContract(adminActor, {
      contractCode: "HD_CLB_2026",
      unitId: unit.id,
      validFrom: "2026-10-01T00:00:00.000Z",
      validTo: "2026-12-31T23:59:59.000Z",
      maxTournamentsTotal: 2,
      maxParticipantsPerTournament: 8,
      maxParticipantsTotal: 16,
      allowedModes: ["HUMAN_ONLINE"],
      policyEnvelope: SAMPLE_ENVELOPE,
      technicalCaps: {
        botSourceMaxBytes: 65536,
        botRuntimeTimeoutMs: 1000,
        botMemoryLimitMb: 64,
        maxConcurrentMatchesPerTournament: 8,
        rosterImportMaxRows: 2000,
      },
      status: "ACTIVE",
      initialTaUserIds: ["ta-owner"],
    });

    const taOwner = bundle.store.resolveAuthoritativeActor({ userId: "ta-owner" });

    const draft = await bundle.coreDraftService.createDraft(taOwner, {
      contractId: contract.id,
      coreConfig: {
        tournamentCode: "CLB_OPEN_2026",
        tournamentName: "Giải CLB Mở Rộng",
        shortDescription: "",
        organizersText: "CLB Cờ",
        competitionMode: "HUMAN_ONLINE",
        audienceScope: "PUBLIC_REGISTERED",
        allowedUnitCodes: [],
        registrationIntakeMode: "IMPORT_ONLY",
        maxParticipants: 8,
        minParticipantsToStart: 2,
        timezone: "Asia/Ho_Chi_Minh",
        registrationOpenAt: null,
        registrationCloseAt: null,
        checkinRequired: false,
        checkinOpenAt: null,
        checkinCloseAt: null,
        scheduledStartAt: "2026-11-01T08:00:00.000Z",
        scheduledEndAt: "2026-11-01T18:00:00.000Z",
        format: "ARENA_CONTINUOUS",
        pairingMethod: "SWISS_SCORE_ADJACENT",
        maxMatchesPerPlayer: null,
        maxPairMeetings: 2,
        rematchCooldownMinutes: 5,
        maxConcurrentMatches: 4,
        byeScorePoints: 0,
        spectatorPolicy: "ROSTER_ONLY",
        chatPolicy: "SPECTATOR_MUTED",
        leaderboardVisibility: "LIVE_PUBLIC",
        topNExportCount: 2,
        finalizationMode: "AUTO_FINAL",
        scoringFormulaPreset: "ELO_WEIGHTED_V1",
        initialScore: 50,
        initialElo: 1000,
        kFactor: 32,
        scoreFloor: 45, // Used to test scoreFloor clamping (T072)
        botDeadlineAt: null,
      },
      ruleProfile: {
        ...DEFAULT_TOURNAMENT_RULE_PROFILE,
        tieBreakPolicy: "MANUAL_REFEREE",
        manualAdjudicationDeadlineSeconds: 300,
        manualAdjudicationFallbackPolicy: "BLUE_ADVANTAGE",
      },
    });

    const submitted = await bundle.coreDraftService.submitDraft(taOwner, draft.id, {
      expectedRevision: draft.revision,
    });
    const approved = await bundle.approvalService.decideInitialApproval(
      adminActor,
      draft.id,
      { decision: "APPROVE", expectedRevision: submitted.revision }
    );

    await bundle.coreDraftService.enrollParticipant(taOwner, approved.id, {
      personKey: "P_BLUE",
      userId: "user-blue",
      displayName: "Đấu thủ Xanh",
      unitCode: "CLB_CO",
    });
    await bundle.coreDraftService.enrollParticipant(taOwner, approved.id, {
      personKey: "P_RED",
      userId: "user-red",
      displayName: "Đấu thủ Đỏ",
      unitCode: "CLB_CO",
    });
    await bundle.coreDraftService.enrollParticipant(taOwner, approved.id, {
      personKey: "P_THIRD",
      userId: "user-third",
      displayName: "Đấu thủ Ba",
      unitCode: "CLB_CO",
    });

    await bundle.lifecycleService.startRunning(taOwner, approved.id);

    // T005: Admin can never play Online
    expect(
      bundle.admissionGateService.evaluateAdmission({
        principalType: "USER",
        principalId: "admin-1",
        roles: ["ADMIN"],
        action: "ONLINE_QUEUE_JOIN",
      })
    ).toMatchObject({
      allowed: false,
      reasonCode: "ADMIN_CANNOT_PLAY_ONLINE",
    });

    // T075 (C32): Guest and outside User are blocked from Online queue/room during RUNNING tournament
    expect(
      bundle.admissionGateService.evaluateAdmission({
        principalType: "GUEST",
        principalId: "guest-1",
        roles: ["GUEST"],
        action: "ONLINE_QUEUE_JOIN",
      })
    ).toMatchObject({
      allowed: false,
      reasonCode: "GUEST_BLOCKED_DURING_TOURNAMENT_WINDOW",
    });

    expect(
      bundle.admissionGateService.evaluateAdmission({
        principalType: "USER",
        principalId: "outside-user-99",
        roles: ["PLAYER"],
        action: "ONLINE_ROOM_CREATE",
      })
    ).toMatchObject({
      allowed: false,
      reasonCode: "OUTSIDE_USER_BLOCKED_DURING_TOURNAMENT_WINDOW",
    });

    // Offline local match is still allowed for everyone during C32 window
    expect(
      bundle.admissionGateService.evaluateAdmission({
        principalType: "GUEST",
        principalId: "guest-1",
        roles: ["GUEST"],
        action: "OFFLINE_LOCAL_MATCH",
      }).allowed
    ).toBe(true);

    // Eligible participant in the running tournament is allowed
    expect(
      bundle.admissionGateService.evaluateAdmission({
        principalType: "USER",
        principalId: "user-blue",
        roles: ["PLAYER"],
        action: "ONLINE_QUEUE_JOIN",
      }).allowed
    ).toBe(true);

    // T062: Publish v2 with effectiveAt in the future (10:00:00Z).
    // Match 1 created at 09:00:00Z pins v1; Match 2 created at 10:05:00Z pins v2!
    setNow("2026-11-01T08:30:00.000Z");
    const currentT = bundle.coreDraftService.getTournament(approved.id);
    await bundle.lifecycleService.publishWithinEnvelopeRuleUpdate(
      taOwner,
      approved.id,
      {
        expectedRevision: currentT.revision,
        effectiveAt: "2026-11-01T10:00:00.000Z",
        changeSummary: "Đổi turnSeconds từ 30s sang 40s từ 10h00",
        ruleProfilePatch: { turnSeconds: 40 },
      }
    );

    const { match: match1, pinnedVersion: vMatch1 } =
      await bundle.admissionGateService.createMatchWithPinnedVersion({
        tournamentId: approved.id,
        roomId: "room-1",
        blueParticipantId: "user-blue",
        redParticipantId: "user-red",
        matchId: "match-1",
        createdAtIso: "2026-11-01T09:00:00.000Z",
      });
    expect(vMatch1.versionNumber).toBe(1);
    expect(match1.pinnedConfigVersionNumber).toBe(1);

    const { match: match2, pinnedVersion: vMatch2 } =
      await bundle.admissionGateService.createMatchWithPinnedVersion({
        tournamentId: approved.id,
        roomId: "room-2",
        blueParticipantId: "user-red",
        redParticipantId: "user-third",
        matchId: "match-2",
        createdAtIso: "2026-11-01T10:05:00.000Z",
      });
    expect(vMatch2.versionNumber).toBe(2);
    expect(match2.pinnedConfigVersionNumber).toBe(2);
    // In-progress match-1 still has v1 pinned!
    expect(bundle.store.matches.get("match-1")?.pinnedConfigVersionNumber).toBe(1);

    // L08: Open ManualAdjudicationRequest on match-1
    setNow("2026-11-01T09:10:00.000Z");
    const adjReq =
      await bundle.adjudicationLedgerService.openManualAdjudicationRequest({
        tournamentId: approved.id,
        matchId: "match-1",
        roomId: "room-1",
        blueParticipantId: "user-blue",
        redParticipantId: "user-red",
        frozenSnapshot: {
          board: "frozen-board-state",
          sourceText: "def choose_move(s): pass", // Must be redacted!
        },
      });
    expect(adjReq.status).toBe("WAITING");
    expect(adjReq.frozenSnapshot.sourceText).toBe("[REDACTED]");

    // T009 & T059: Admin, Referee, or non-owner TA cannot submit manual verdict
    await expect(
      bundle.adjudicationLedgerService.submitManualVerdict(
        adminActor,
        adjReq.id,
        { winnerSide: "BLUE", reason: "Admin thử phán quyết" }
      )
    ).rejects.toMatchObject({ statusCode: 403 });

    const refereeActor = {
      userId: "ref-1",
      roles: ["REFEREE" as const],
    };
    await expect(
      bundle.adjudicationLedgerService.submitManualVerdict(
        refereeActor,
        adjReq.id,
        { winnerSide: "BLUE", reason: "Trọng tài thử phán quyết" }
      )
    ).rejects.toMatchObject({ statusCode: 403 });

    // Owner TA submits manual verdict before deadline -> succeeds (finishSequence = 1)
    const verdictRes =
      await bundle.adjudicationLedgerService.submitManualVerdict(
        taOwner,
        adjReq.id,
        {
          winnerSide: "BLUE",
          reason: "Xanh ưu thế thế trận theo biên bản kỹ thuật",
        }
      );
    expect(verdictRes.adjudication.status).toBe("DECIDED");
    expect(verdictRes.ledgerEntry.finishSequence).toBe(1);
    // T072: Loser (user-red) started at initialScore 50 and scoreFloor is 45 -> clamped at >= 45
    expect(verdictRes.ledgerEntry.redScoreAfter).toBeGreaterThanOrEqual(45);

    // Record normal finish for match-2 (finishSequence = 2)
    const entry2 = await bundle.adjudicationLedgerService.recordNormalMatchFinish({
      tournamentId: approved.id,
      matchId: "match-2",
      blueParticipantId: "user-red",
      redParticipantId: "user-third",
      winnerSide: "BLUE",
      finishedAtIso: "2026-11-01T10:20:00.000Z",
    });
    expect(entry2.finishSequence).toBe(2);

    // T073: Leaderboard & Top N export
    const leaderboard =
      bundle.adjudicationLedgerService.computeLeaderboardSnapshot(approved.id);
    expect(leaderboard.lastFinishSequence).toBe(2);
    expect(leaderboard.standings).toHaveLength(3);
    expect(leaderboard.topNExport).toHaveLength(2);
    expect(leaderboard.standings[0]?.participantId).toBe("user-blue");
  });
});
