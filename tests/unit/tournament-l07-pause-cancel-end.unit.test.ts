import { describe, expect, it } from "vitest";
import {
  ContractPolicyEnvelopeSchema,
  DEFAULT_TOURNAMENT_RULE_PROFILE,
  type TournamentCoreConfig,
} from "@ottv2/contracts";
import {
  createTournamentRuntimeBundle,
  type TournamentRuntimeBundle,
} from "../../apps/server/src/modules/tournament-core/index.js";
import type { TournamentActorContext } from "../../apps/server/src/modules/tournament-foundation/tournament-store.js";

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

function buildCoreConfig(overrides?: Partial<TournamentCoreConfig>): TournamentCoreConfig {
  return {
    tournamentCode: "TOURNAMENT_L07",
    tournamentName: "Giải Đấu Vòng Đời L07",
    shortDescription: "",
    organizersText: "Khoa CNTT",
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
    scheduledEndAt: "2026-11-01T12:00:00.000Z",
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
    initialScore: 50,
    initialElo: 1000,
    kFactor: 32,
    scoreFloor: 0,
    botDeadlineAt: null,
    ...overrides,
  };
}

function setupL07Fixture(initialIso = "2026-10-22T08:00:00.000Z") {
  let currentTime = new Date(initialIso);
  const clockFn = () => currentTime;
  const bundle = createTournamentRuntimeBundle({ clockFn });

  const adminActor: TournamentActorContext = {
    userId: "admin-sa-1",
    principalType: "USER",
    roles: ["ADMIN"],
  };

  const taActor: TournamentActorContext = {
    userId: "ta-owner-1",
    principalType: "USER",
    roles: ["PLAYER", "TOURNAMENT_ADMIN"],
  };

  const setNow = (iso: string) => {
    currentTime = new Date(iso);
  };

  return { bundle, setNow, adminActor, taActor };
}

async function createStandardContract(
  bundle: TournamentRuntimeBundle,
  adminActor: TournamentActorContext,
  taActor: TournamentActorContext,
  contractCode = "HD_L07_2026"
) {
  const unit = await bundle.unitContractService.createUnit(adminActor, {
    unitCode: `UNIT_${contractCode}`,
    unitName: "Đơn Vị Nghiên Cứu",
    unitType: "KHOA",
    contactName: "Trưởng Đơn Vị",
    contactEmail: "contact@example.edu.vn",
    status: "ACTIVE",
  });

  const contract = await bundle.unitContractService.createContract(adminActor, {
    contractCode,
    unitId: unit.id,
    validFrom: "2026-10-01T00:00:00.000Z",
    validTo: "2026-12-31T23:59:59.000Z",
    maxTournamentsTotal: 5,
    maxParticipantsPerTournament: 16,
    maxParticipantsTotal: 32,
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
    initialTaUserIds: [taActor.userId],
  });

  return { unit, contract };
}

describe("Task L07 — Pause / Cancel / End & Persistence Boundary Unit Tests", () => {
  it("T027: Differentiates ADMISSION_PAUSE_ONLY vs FULL_MATCH_STOP and freezes/resumes matches properly", async () => {
    const { bundle, adminActor, taActor } = setupL07Fixture();

    const { contract } = await createStandardContract(
      bundle,
      adminActor,
      taActor,
      "HD_T027"
    );

    const draft = await bundle.coreDraftService.createDraft(taActor, {
      contractId: contract.id,
      coreConfig: buildCoreConfig({ tournamentCode: "T027_PAUSE" }),
      ruleProfile: {
        ...DEFAULT_TOURNAMENT_RULE_PROFILE,
        tieBreakPolicy: "MANUAL_REFEREE",
      },
    });

    const submitted = await bundle.coreDraftService.submitDraft(taActor, draft.id, {
      expectedRevision: draft.revision,
    });
    const approved = await bundle.approvalService.decideInitialApproval(
      adminActor,
      draft.id,
      {
        decision: "APPROVE",
        expectedRevision: submitted.revision,
        note: "Duyệt hồ sơ",
      }
    );

    // Enroll 2 participants
    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "PK_1",
      userId: "u1",
      displayName: "Thí Sinh 1",
      unitCode: "KHOA",
      eligibilityStatus: "ELIGIBLE",
    });
    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "PK_2",
      userId: "u2",
      displayName: "Thí Sinh 2",
      unitCode: "KHOA",
      eligibilityStatus: "ELIGIBLE",
    });

    await bundle.lifecycleService.startRunning(taActor, approved.id);

    // Create 1 active match
    const { match } = await bundle.admissionGateService.createMatchWithPinnedVersion({
      tournamentId: approved.id,
      roomId: "room-t027",
      blueParticipantId: "u1",
      redParticipantId: "u2",
    });
    expect(match.status).toBe("RUNNING");

    // Case A: ADMISSION_PAUSE_ONLY (default)
    const pausedAdmission = await bundle.lifecycleService.pauseTournament(
      taActor,
      approved.id,
      "Tạm dừng mở trận mới để kiểm tra kỹ thuật",
      undefined,
      "ADMISSION_PAUSE_ONLY"
    );
    expect(pausedAdmission.status).toBe("PAUSED");
    // Match stays RUNNING so existing players can finish their turn
    expect(bundle.store.matches.get(match.matchId)!.status).toBe("RUNNING");

    // Resume back to RUNNING
    await bundle.lifecycleService.resumeTournament(taActor, approved.id);
    expect(bundle.coreDraftService.getTournament(approved.id).status).toBe("RUNNING");

    // Case B: FULL_MATCH_STOP (Emergency stoppage - clocks frozen)
    const pausedFull = await bundle.lifecycleService.pauseTournament(
      taActor,
      approved.id,
      "Dừng khẩn cấp toàn bộ các trận đấu trên sàn",
      undefined,
      "FULL_MATCH_STOP"
    );
    expect(pausedFull.status).toBe("PAUSED");
    // Match is now stopped (PAUSED)
    expect(bundle.store.matches.get(match.matchId)!.status).toBe("PAUSED");

    // Resume back: match is restored to RUNNING
    await bundle.lifecycleService.resumeTournament(taActor, approved.id);
    expect(bundle.store.matches.get(match.matchId)!.status).toBe("RUNNING");
  });

  it("T028: Automatically transitions to ENDED when serverNow >= scheduledEndAt and prohibits terminal resume", async () => {
    const { bundle, adminActor, taActor, setNow } = setupL07Fixture(
      "2026-10-22T08:00:00.000Z"
    );

    const { contract } = await createStandardContract(
      bundle,
      adminActor,
      taActor,
      "HD_T028"
    );

    const draft = await bundle.coreDraftService.createDraft(taActor, {
      contractId: contract.id,
      coreConfig: buildCoreConfig({
        tournamentCode: "T028_AUTO_END",
        scheduledStartAt: "2026-11-01T08:00:00.000Z",
        scheduledEndAt: "2026-11-01T12:00:00.000Z",
      }),
      ruleProfile: {
        ...DEFAULT_TOURNAMENT_RULE_PROFILE,
        tieBreakPolicy: "MANUAL_REFEREE",
      },
    });

    const submitted = await bundle.coreDraftService.submitDraft(taActor, draft.id, {
      expectedRevision: draft.revision,
    });
    const approved = await bundle.approvalService.decideInitialApproval(
      adminActor,
      draft.id,
      {
        decision: "APPROVE",
        expectedRevision: submitted.revision,
        note: "Duyệt",
      }
    );

    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "PK_1",
      userId: "u1",
      displayName: "Thí Sinh 1",
      unitCode: "KHOA",
      eligibilityStatus: "ELIGIBLE",
    });
    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "PK_2",
      userId: "u2",
      displayName: "Thí Sinh 2",
      unitCode: "KHOA",
      eligibilityStatus: "ELIGIBLE",
    });

    await bundle.lifecycleService.startRunning(taActor, approved.id);

    // Pause tournament at 11:30:00Z
    setNow("2026-11-01T11:30:00.000Z");
    await bundle.lifecycleService.pauseTournament(
      taActor,
      approved.id,
      "Tạm dừng tại 11h30"
    );

    // scheduledEndAt must NOT be auto-extended
    const pausedT = bundle.coreDraftService.getTournament(approved.id);
    expect(pausedT.coreConfig.scheduledEndAt).toBe("2026-11-01T12:00:00.000Z");

    // Advance clock past scheduledEndAt to 12:05:00Z
    setNow("2026-11-01T12:05:00.000Z");
    const endedList = await bundle.lifecycleService.evaluateAutoEndAtWindow();
    expect(endedList.some((t) => t.id === approved.id)).toBe(true);

    const endedT = bundle.coreDraftService.getTournament(approved.id);
    expect(endedT.status).toBe("ENDED");
    expect(endedT.endedAt).toBe("2026-11-01T12:05:00.000Z");

    // Prohibit terminal resume
    await expect(
      bundle.lifecycleService.resumeTournament(taActor, approved.id)
    ).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: "INVALID_STATE_TRANSITION" },
    });
  });

  it("T029: Cancellation CAS hooks cancel WAITING adjudications, in-progress matches, and pending change requests with quota refund invariants", async () => {
    const { bundle, adminActor, taActor } = setupL07Fixture();

    const { contract } = await createStandardContract(
      bundle,
      adminActor,
      taActor,
      "HD_T029"
    );

    // 1. Unapproved draft cancellation: must refund quota (everApproved === false)
    const unapprovedDraft = await bundle.coreDraftService.createDraft(taActor, {
      contractId: contract.id,
      coreConfig: buildCoreConfig({ tournamentCode: "T029_UNAPPROVED" }),
    });
    expect(bundle.store.contracts.get(contract.id)!.quotaReservedCount).toBe(1);

    const cancelUnapproved = await bundle.lifecycleService.cancelTournament(
      taActor,
      unapprovedDraft.id,
      "Hủy bản nháp chưa duyệt"
    );
    expect(cancelUnapproved.tournament.status).toBe("CANCELLED");
    // Quota refunded back to 0
    expect(bundle.store.contracts.get(contract.id)!.quotaReservedCount).toBe(0);

    // 2. Approved tournament cancellation: never refunds quota (everApproved === true, T013)
    const draft2 = await bundle.coreDraftService.createDraft(taActor, {
      contractId: contract.id,
      coreConfig: buildCoreConfig({ tournamentCode: "T029_APPROVED" }),
      ruleProfile: {
        ...DEFAULT_TOURNAMENT_RULE_PROFILE,
        tieBreakPolicy: "MANUAL_REFEREE",
      },
    });
    expect(bundle.store.contracts.get(contract.id)!.quotaReservedCount).toBe(1);

    const sub2 = await bundle.coreDraftService.submitDraft(taActor, draft2.id, {
      expectedRevision: draft2.revision,
    });
    const approved2 = await bundle.approvalService.decideInitialApproval(
      adminActor,
      draft2.id,
      {
        decision: "APPROVE",
        expectedRevision: sub2.revision,
        note: "Duyệt",
      }
    );

    await bundle.coreDraftService.enrollParticipant(taActor, approved2.id, {
      personKey: "PK_1",
      userId: "u1",
      displayName: "Thí Sinh 1",
      unitCode: "KHOA",
      eligibilityStatus: "ELIGIBLE",
    });
    await bundle.coreDraftService.enrollParticipant(taActor, approved2.id, {
      personKey: "PK_2",
      userId: "u2",
      displayName: "Thí Sinh 2",
      unitCode: "KHOA",
      eligibilityStatus: "ELIGIBLE",
    });

    await bundle.lifecycleService.startRunning(taActor, approved2.id);

    // Create match and manual adjudication request
    const { match } = await bundle.admissionGateService.createMatchWithPinnedVersion({
      tournamentId: approved2.id,
      roomId: "room-t029",
      blueParticipantId: "u1",
      redParticipantId: "u2",
    });

    bundle.store.adjudicationRequests.set("adj-t029-1", {
      id: "adj-t029-1",
      tournamentId: approved2.id,
      matchId: match.matchId,
      status: "WAITING",
      createdAt: "2026-10-22T08:00:00.000Z",
      deadlineAt: "2026-10-22T08:30:00.000Z",
      fallbackPolicy: "RANDOM_SEEDED",
      finishSequence: null,
      verdictWinnerSide: null,
      decisionReason: null,
      decidedByUserId: null,
      decidedAt: null,
      updatedAt: "2026-10-22T08:00:00.000Z",
    });

    // Create a pending ChangeRequest
    const changeReq = await bundle.lifecycleService.createChangeRequest(
      taActor,
      approved2.id,
      {
        reason: "Xin tăng turnSeconds",
        effectiveAt: "2026-11-01T10:00:00.000Z",
        proposedRuleProfilePatch: { turnSeconds: 45 },
      }
    );
    expect(changeReq.status).toBe("PENDING");

    // Cancel the running tournament
    const currentRunningT = bundle.coreDraftService.getTournament(approved2.id);
    const cancelRes = await bundle.lifecycleService.cancelTournament(
      taActor,
      approved2.id,
      "Hủy giải đấu do sự cố bất khả kháng",
      currentRunningT.revision
    );

    expect(cancelRes.tournament.status).toBe("CANCELLED");
    expect(cancelRes.cancelledAdjudicationsCount).toBe(1);
    expect(cancelRes.cancelledMatchesCount).toBe(1);
    expect(cancelRes.cancelledChangeRequestsCount).toBe(1);

    // Invariant T013: Quota is NOT refunded for an approved tournament
    expect(bundle.store.contracts.get(contract.id)!.quotaReservedCount).toBe(1);

    // Verify cascade cancel records
    expect(bundle.store.adjudicationRequests.get("adj-t029-1")!.status).toBe("CANCELLED");
    expect(bundle.store.matches.get(match.matchId)!.status).toBe("CANCELLED");
    expect(bundle.store.changeRequests.get(changeReq.id)!.status).toBe("CANCELLED");
  });

  it("T030: Finalize gate blocks on pending WAITING adjudications and finalizes once settled", async () => {
    const { bundle, adminActor, taActor, setNow } = setupL07Fixture(
      "2026-10-22T08:00:00.000Z"
    );

    const { contract } = await createStandardContract(
      bundle,
      adminActor,
      taActor,
      "HD_T030"
    );

    const draft = await bundle.coreDraftService.createDraft(taActor, {
      contractId: contract.id,
      coreConfig: buildCoreConfig({
        tournamentCode: "T030_FINALIZE",
        scheduledStartAt: "2026-11-01T08:00:00.000Z",
        scheduledEndAt: "2026-11-01T12:00:00.000Z",
      }),
      ruleProfile: {
        ...DEFAULT_TOURNAMENT_RULE_PROFILE,
        tieBreakPolicy: "MANUAL_REFEREE",
      },
    });

    const sub = await bundle.coreDraftService.submitDraft(taActor, draft.id, {
      expectedRevision: draft.revision,
    });
    const approved = await bundle.approvalService.decideInitialApproval(
      adminActor,
      draft.id,
      {
        decision: "APPROVE",
        expectedRevision: sub.revision,
        note: "Duyệt",
      }
    );

    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "PK_1",
      userId: "u1",
      displayName: "Thí Sinh 1",
      unitCode: "KHOA",
      eligibilityStatus: "ELIGIBLE",
    });
    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "PK_2",
      userId: "u2",
      displayName: "Thí Sinh 2",
      unitCode: "KHOA",
      eligibilityStatus: "ELIGIBLE",
    });

    await bundle.lifecycleService.startRunning(taActor, approved.id);

    // End tournament
    setNow("2026-11-01T12:05:00.000Z");
    await bundle.lifecycleService.evaluateAutoEndAtWindow();
    expect(bundle.coreDraftService.getTournament(approved.id).status).toBe("ENDED");

    // Add a WAITING adjudication request
    bundle.store.adjudicationRequests.set("adj-t030-pending", {
      id: "adj-t030-pending",
      tournamentId: approved.id,
      matchId: "match-t030-1",
      status: "WAITING",
      createdAt: "2026-11-01T11:00:00.000Z",
      deadlineAt: "2026-11-01T13:00:00.000Z", // Deadline in future
      fallbackPolicy: "RANDOM_SEEDED",
      finishSequence: null,
      verdictWinnerSide: null,
      decisionReason: null,
      decidedByUserId: null,
      decidedAt: null,
      updatedAt: "2026-11-01T11:00:00.000Z",
    });

    // Attempting to finalize must be BLOCKED
    await expect(
      bundle.lifecycleService.finalizeTournament(taActor, approved.id)
    ).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: "PENDING_MANUAL_ADJUDICATION" },
    });

    // Settle the adjudication
    bundle.store.adjudicationRequests.set("adj-t030-pending", {
      ...bundle.store.adjudicationRequests.get("adj-t030-pending")!,
      status: "DECIDED",
      verdictWinnerSide: "BLUE",
      decidedAt: "2026-11-01T12:15:00.000Z",
    });

    // Finalize succeeds once settled
    const finalized = await bundle.lifecycleService.finalizeTournament(
      taActor,
      approved.id
    );
    expect(finalized.status).toBe("ARCHIVED");
    expect(finalized.finalizedAt).toBe("2026-11-01T12:05:00.000Z");
  });
});
