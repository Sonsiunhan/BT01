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

function buildBaseCoreConfig(tournamentCode: string) {
  return {
    tournamentCode,
    tournamentName: `Giải ${tournamentCode}`,
    shortDescription: "",
    organizersText: "BTC Giải",
    competitionMode: "HUMAN_ONLINE" as const,
    audienceScope: "PUBLIC_REGISTERED" as const,
    allowedUnitCodes: [],
    registrationIntakeMode: "IMPORT_ONLY" as const,
    maxParticipants: 16,
    minParticipantsToStart: 2,
    timezone: "Asia/Ho_Chi_Minh",
    registrationOpenAt: null,
    registrationCloseAt: null,
    checkinRequired: false,
    checkinOpenAt: null,
    checkinCloseAt: null,
    scheduledStartAt: "2026-11-10T08:00:00.000Z",
    scheduledEndAt: "2026-11-10T18:00:00.000Z",
    format: "ARENA_CONTINUOUS" as const,
    pairingMethod: "SWISS_SCORE_ADJACENT" as const,
    maxMatchesPerPlayer: null,
    maxPairMeetings: 2,
    rematchCooldownMinutes: 5,
    maxConcurrentMatches: 8,
    byeScorePoints: 0,
    spectatorPolicy: "PUBLIC_WATCH" as const,
    chatPolicy: "SPECTATOR_MUTED" as const,
    leaderboardVisibility: "LIVE_PUBLIC" as const,
    topNExportCount: 3,
    finalizationMode: "AUTO_FINAL" as const,
    scoringFormulaPreset: "ELO_WEIGHTED_V1" as const,
    initialScore: 0,
    initialElo: 1000,
    kFactor: 32,
    scoreFloor: 0,
    botDeadlineAt: null,
  };
}

describe("L09 — Dedicated Concurrency, CAS & Replay Determinism Suite", () => {
  it("Race 1 (T011/T012): 10 concurrent createDraft requests on maxTournamentsTotal=2 allow exactly 2 and reject 8 with 409 CONTRACT_QUOTA_EXHAUSTED", async () => {
    const bundle = createTournamentRuntimeBundle({
      clockFn: () => new Date("2026-10-21T08:00:00.000Z"),
    });
    bundle.store.grantSystemRole("admin-1", "ADMIN");
    const adminActor = bundle.store.resolveAuthoritativeActor({ userId: "admin-1" });

    const unit = await bundle.unitContractService.createUnit(adminActor, {
      unitCode: "KHOA_RACE",
      unitName: "Khoa Kiểm Thử Đồng Thời",
      unitType: "KHOA",
      contactName: "Nguyễn Race",
      contactEmail: "race@example.edu.vn",
      status: "ACTIVE",
    });

    const contract = await bundle.unitContractService.createContract(adminActor, {
      contractCode: "HD_RACE_QUOTA",
      unitId: unit.id,
      validFrom: "2026-10-01T00:00:00.000Z",
      validTo: "2026-12-31T23:59:59.000Z",
      maxTournamentsTotal: 2,
      maxParticipantsPerTournament: 16,
      maxParticipantsTotal: 64,
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
      initialTaUserIds: ["ta-race"],
    });

    const taActor = bundle.store.resolveAuthoritativeActor({ userId: "ta-race" });

    const outcomes = await Promise.allSettled(
      Array.from({ length: 10 }, (_, idx) =>
        bundle.coreDraftService.createDraft(taActor, {
          contractId: contract.id,
          coreConfig: buildBaseCoreConfig(`RACE_DRAFT_${idx + 1}`),
          ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
        })
      )
    );

    const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
    const rejected = outcomes.filter(
      (o): o is PromiseRejectedResult => o.status === "rejected"
    );

    expect(fulfilled).toHaveLength(2);
    expect(rejected).toHaveLength(8);
    for (const r of rejected) {
      expect(r.reason).toMatchObject({
        statusCode: 409,
        details: { reason: "CONTRACT_QUOTA_EXHAUSTED" },
      });
    }

    const updatedContract = bundle.unitContractService.getContract(contract.id);
    expect(updatedContract.quotaReservedCount).toBe(2);
    expect(updatedContract.quotaRemainingCount).toBe(0);
  });

  it("Race 2 (T012/T013): concurrent deleteDraft never double-refunds quota, and CANCELLED after APPROVED never refunds quota", async () => {
    const bundle = createTournamentRuntimeBundle({
      clockFn: () => new Date("2026-10-21T08:00:00.000Z"),
    });
    bundle.store.grantSystemRole("admin-1", "ADMIN");
    const adminActor = bundle.store.resolveAuthoritativeActor({ userId: "admin-1" });

    const unit = await bundle.unitContractService.createUnit(adminActor, {
      unitCode: "KHOA_REFUND",
      unitName: "Khoa Hoàn Quota",
      unitType: "KHOA",
      contactName: "Nguyễn Refund",
      contactEmail: "refund@example.edu.vn",
      status: "ACTIVE",
    });

    const contract = await bundle.unitContractService.createContract(adminActor, {
      contractCode: "HD_REFUND_TEST",
      unitId: unit.id,
      validFrom: "2026-10-01T00:00:00.000Z",
      validTo: "2026-12-31T23:59:59.000Z",
      maxTournamentsTotal: 2,
      maxParticipantsPerTournament: 16,
      maxParticipantsTotal: 64,
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
      initialTaUserIds: ["ta-refund"],
    });

    const taActor = bundle.store.resolveAuthoritativeActor({ userId: "ta-refund" });

    const draftA = await bundle.coreDraftService.createDraft(taActor, {
      contractId: contract.id,
      coreConfig: buildBaseCoreConfig("DRAFT_A"),
      ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
    });
    const draftB = await bundle.coreDraftService.createDraft(taActor, {
      contractId: contract.id,
      coreConfig: buildBaseCoreConfig("DRAFT_B"),
      ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
    });

    expect(bundle.unitContractService.getContract(contract.id).quotaReservedCount).toBe(
      2
    );

    // 5 concurrent deleteDraft calls on draftA -> only 1 succeeds and quotaReservedCount drops from 2 to 1 (never 0)
    const deleteResults = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        bundle.coreDraftService.deleteDraft(taActor, draftA.id)
      )
    );
    expect(deleteResults.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(bundle.unitContractService.getContract(contract.id).quotaReservedCount).toBe(
      1
    );

    // Approve draftB, then cancel it -> T013: quotaReservedCount MUST stay 1 (no refund after APPROVED)
    const subB = await bundle.coreDraftService.submitDraft(taActor, draftB.id, {
      expectedRevision: draftB.revision,
    });
    await bundle.approvalService.decideInitialApproval(adminActor, draftB.id, {
      decision: "APPROVE",
      expectedRevision: subB.revision,
    });
    await bundle.lifecycleService.cancelTournament(
      taActor,
      draftB.id,
      "Hủy giải vì lý do bất khả kháng"
    );

    const afterCancelContract = bundle.unitContractService.getContract(contract.id);
    expect(afterCancelContract.quotaReservedCount).toBe(1);
    expect(afterCancelContract.quotaConsumedCount).toBe(1);
  });

  it("Race 3 (T021): concurrent patchDraft and decideInitialApproval with same expectedRevision allow 1 and reject stale contenders with 409 STALE_VERSION", async () => {
    const bundle = createTournamentRuntimeBundle({
      clockFn: () => new Date("2026-10-21T08:00:00.000Z"),
    });
    bundle.store.grantSystemRole("admin-1", "ADMIN");
    const adminActor = bundle.store.resolveAuthoritativeActor({ userId: "admin-1" });

    const unit = await bundle.unitContractService.createUnit(adminActor, {
      unitCode: "KHOA_CAS",
      unitName: "Khoa Kiểm Thử CAS",
      unitType: "KHOA",
      contactName: "Nguyễn CAS",
      contactEmail: "cas@example.edu.vn",
      status: "ACTIVE",
    });

    const contract = await bundle.unitContractService.createContract(adminActor, {
      contractCode: "HD_CAS_TEST",
      unitId: unit.id,
      validFrom: "2026-10-01T00:00:00.000Z",
      validTo: "2026-12-31T23:59:59.000Z",
      maxTournamentsTotal: 5,
      maxParticipantsPerTournament: 16,
      maxParticipantsTotal: 64,
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
      initialTaUserIds: ["ta-cas"],
    });

    const taActor = bundle.store.resolveAuthoritativeActor({ userId: "ta-cas" });
    const draft = await bundle.coreDraftService.createDraft(taActor, {
      contractId: contract.id,
      coreConfig: buildBaseCoreConfig("CAS_DRAFT_01"),
      ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
    });

    // 6 concurrent patchDraft calls all passing expectedRevision = 1
    const patchOutcomes = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        bundle.coreDraftService.patchDraft(taActor, draft.id, {
          expectedRevision: 1,
          coreConfig: { shortDescription: `Bản sửa đồng thời #${i}` },
        })
      )
    );

    expect(patchOutcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    const staleFailures = patchOutcomes.filter(
      (o): o is PromiseRejectedResult => o.status === "rejected"
    );
    expect(staleFailures).toHaveLength(5);
    for (const f of staleFailures) {
      expect(f.reason).toMatchObject({
        statusCode: 409,
        details: { reason: "STALE_VERSION" },
      });
    }
  });

  it("Race 4 (T060/T029): 8 concurrent submitManualVerdict calls on a WAITING request commit exactly 1 verdict, and tournament cancel cancels WAITING adjudications", async () => {
    const bundle = createTournamentRuntimeBundle({
      clockFn: () => new Date("2026-10-21T08:00:00.000Z"),
    });
    bundle.store.grantSystemRole("admin-1", "ADMIN");
    const adminActor = bundle.store.resolveAuthoritativeActor({ userId: "admin-1" });

    const unit = await bundle.unitContractService.createUnit(adminActor, {
      unitCode: "KHOA_ADJ",
      unitName: "Khoa Phán Quyết",
      unitType: "KHOA",
      contactName: "Nguyễn Adj",
      contactEmail: "adj@example.edu.vn",
      status: "ACTIVE",
    });

    const contract = await bundle.unitContractService.createContract(adminActor, {
      contractCode: "HD_ADJ_TEST",
      unitId: unit.id,
      validFrom: "2026-10-01T00:00:00.000Z",
      validTo: "2026-12-31T23:59:59.000Z",
      maxTournamentsTotal: 5,
      maxParticipantsPerTournament: 16,
      maxParticipantsTotal: 64,
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
      initialTaUserIds: ["ta-adj"],
    });

    const taActor = bundle.store.resolveAuthoritativeActor({ userId: "ta-adj" });
    const draft = await bundle.coreDraftService.createDraft(taActor, {
      contractId: contract.id,
      coreConfig: buildBaseCoreConfig("ADJ_RACE_01"),
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
      { decision: "APPROVE", expectedRevision: sub.revision }
    );

    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "P1",
      userId: "u-1",
      displayName: "Đấu thủ 1",
      unitCode: "KHOA_ADJ",
    });
    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "P2",
      userId: "u-2",
      displayName: "Đấu thủ 2",
      unitCode: "KHOA_ADJ",
    });

    await bundle.lifecycleService.startRunning(taActor, approved.id);

    const adj1 =
      await bundle.adjudicationLedgerService.openManualAdjudicationRequest({
        tournamentId: approved.id,
        matchId: "match-race-1",
        roomId: "room-race-1",
        blueParticipantId: "u-1",
        redParticipantId: "u-2",
        frozenSnapshot: { turn: 120 },
      });

    // 8 concurrent manual verdicts on adj1 (alternating BLUE and RED)
    const verdictOutcomes = await Promise.allSettled(
      Array.from({ length: 8 }, (_, idx) =>
        bundle.adjudicationLedgerService.submitManualVerdict(taActor, adj1.id, {
          winnerSide: idx % 2 === 0 ? "BLUE" : "RED",
          reason: `Phán quyết đồng thời #${idx + 1}`,
        })
      )
    );

    expect(verdictOutcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    expect(verdictOutcomes.filter((o) => o.status === "rejected")).toHaveLength(7);

    // Open a second adjudication request and cancel the tournament -> adj2 becomes CANCELLED
    const adj2 =
      await bundle.adjudicationLedgerService.openManualAdjudicationRequest({
        tournamentId: approved.id,
        matchId: "match-race-2",
        roomId: "room-race-2",
        blueParticipantId: "u-1",
        redParticipantId: "u-2",
        frozenSnapshot: { turn: 120 },
      });

    const cancelRes = await bundle.lifecycleService.cancelTournament(
      taActor,
      approved.id,
      "Hủy giải khẩn cấp"
    );
    expect(cancelRes.cancelledAdjudicationsCount).toBe(1);

    await expect(
      bundle.adjudicationLedgerService.submitManualVerdict(taActor, adj2.id, {
        winnerSide: "BLUE",
        reason: "Thử phán quyết sau khi giải đã hủy",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: "ADJUDICATION_ALREADY_RESOLVED" },
    });
  });

  it("Race 5 (T081): out-of-order wall-clock match completions produce deterministic standings via canonical finish_sequence replay", async () => {
    const bundle = createTournamentRuntimeBundle({
      clockFn: () => new Date("2026-10-21T08:00:00.000Z"),
    });
    bundle.store.grantSystemRole("admin-1", "ADMIN");
    const adminActor = bundle.store.resolveAuthoritativeActor({ userId: "admin-1" });

    const unit = await bundle.unitContractService.createUnit(adminActor, {
      unitCode: "KHOA_LEDGER",
      unitName: "Khoa Sổ Cái",
      unitType: "KHOA",
      contactName: "Nguyễn Ledger",
      contactEmail: "ledger@example.edu.vn",
      status: "ACTIVE",
    });

    const contract = await bundle.unitContractService.createContract(adminActor, {
      contractCode: "HD_LEDGER_TEST",
      unitId: unit.id,
      validFrom: "2026-10-01T00:00:00.000Z",
      validTo: "2026-12-31T23:59:59.000Z",
      maxTournamentsTotal: 5,
      maxParticipantsPerTournament: 16,
      maxParticipantsTotal: 64,
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
      initialTaUserIds: ["ta-ledger"],
    });

    const taActor = bundle.store.resolveAuthoritativeActor({ userId: "ta-ledger" });
    const draft = await bundle.coreDraftService.createDraft(taActor, {
      contractId: contract.id,
      coreConfig: buildBaseCoreConfig("LEDGER_REPLAY_01"),
      ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
    });
    const sub = await bundle.coreDraftService.submitDraft(taActor, draft.id, {
      expectedRevision: draft.revision,
    });
    const approved = await bundle.approvalService.decideInitialApproval(
      adminActor,
      draft.id,
      { decision: "APPROVE", expectedRevision: sub.revision }
    );

    for (const [key, uid, name] of [
      ["SV_A", "user-a", "Đấu thủ A"],
      ["SV_B", "user-b", "Đấu thủ B"],
      ["SV_C", "user-c", "Đấu thủ C"],
      ["SV_D", "user-d", "Đấu thủ D"],
    ] as const) {
      await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
        personKey: key,
        userId: uid,
        displayName: name,
        unitCode: "KHOA_LEDGER",
      });
    }

    await bundle.lifecycleService.startRunning(taActor, approved.id);

    // Record 4 matches concurrently (even with non-monotonic finishedAtIso timestamps)
    const settlements = await Promise.all([
      bundle.adjudicationLedgerService.recordNormalMatchFinish({
        tournamentId: approved.id,
        matchId: "m-1",
        blueParticipantId: "user-a",
        redParticipantId: "user-b",
        winnerSide: "BLUE",
        finishedAtIso: "2026-11-10T09:05:00.000Z",
      }),
      bundle.adjudicationLedgerService.recordNormalMatchFinish({
        tournamentId: approved.id,
        matchId: "m-2",
        blueParticipantId: "user-c",
        redParticipantId: "user-d",
        winnerSide: "RED",
        finishedAtIso: "2026-11-10T09:01:00.000Z",
      }),
      bundle.adjudicationLedgerService.recordNormalMatchFinish({
        tournamentId: approved.id,
        matchId: "m-3",
        blueParticipantId: "user-a",
        redParticipantId: "user-d",
        winnerSide: "BLUE",
        finishedAtIso: "2026-11-10T09:10:00.000Z",
      }),
      bundle.adjudicationLedgerService.recordNormalMatchFinish({
        tournamentId: approved.id,
        matchId: "m-4",
        blueParticipantId: "user-b",
        redParticipantId: "user-c",
        winnerSide: "RED",
        finishedAtIso: "2026-11-10T09:02:00.000Z",
      }),
    ]);

    expect(settlements.map((s) => s.finishSequence)).toEqual([1, 2, 3, 4]);

    // Scramble the in-memory ledger array order and verify computeLeaderboardSnapshot
    // still sorts by finishSequence (1..4) and produces identical standings!
    const snapshot1 =
      bundle.adjudicationLedgerService.computeLeaderboardSnapshot(approved.id);
    const currentLedger = bundle.store.scoreLedger.get(approved.id)!;
    bundle.store.scoreLedger.set(approved.id, [...currentLedger].reverse());
    const snapshot2 =
      bundle.adjudicationLedgerService.computeLeaderboardSnapshot(approved.id);

    expect(snapshot2.standings).toEqual(snapshot1.standings);
    expect(snapshot2.topNExport).toEqual(snapshot1.topNExport);
    expect(snapshot2.standings[0]?.participantId).toBe("user-a");
    expect(snapshot2.standings[0]?.wins).toBe(2);
    // Verify scoreFloor = 0 clamped loser user-b (0 wins, 2 losses, initialScore = 0)
    const userBRow = snapshot2.standings.find((r) => r.participantId === "user-b");
    expect(userBRow?.tournamentScore).toBe(0);
  });

  it("Race 6 (T062): concurrent match creations across effectiveAt boundary pin immutable rule versions deterministically", async () => {
    let currentTime = new Date("2026-10-21T08:00:00.000Z");
    const bundle = createTournamentRuntimeBundle({
      clockFn: () => currentTime,
    });
    bundle.store.grantSystemRole("admin-1", "ADMIN");
    const adminActor = bundle.store.resolveAuthoritativeActor({ userId: "admin-1" });

    const unit = await bundle.unitContractService.createUnit(adminActor, {
      unitCode: "KHOA_PINNING",
      unitName: "Khoa Phiên Bản Luật",
      unitType: "KHOA",
      contactName: "Nguyễn Pin",
      contactEmail: "pin@example.edu.vn",
      status: "ACTIVE",
    });

    const contract = await bundle.unitContractService.createContract(adminActor, {
      contractCode: "HD_PIN_TEST",
      unitId: unit.id,
      validFrom: "2026-10-01T00:00:00.000Z",
      validTo: "2026-12-31T23:59:59.000Z",
      maxTournamentsTotal: 5,
      maxParticipantsPerTournament: 16,
      maxParticipantsTotal: 64,
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
      initialTaUserIds: ["ta-pin"],
    });

    const taActor = bundle.store.resolveAuthoritativeActor({ userId: "ta-pin" });
    const draft = await bundle.coreDraftService.createDraft(taActor, {
      contractId: contract.id,
      coreConfig: buildBaseCoreConfig("PIN_RACE_01"),
      ruleProfile: {
        ...DEFAULT_TOURNAMENT_RULE_PROFILE,
        turnSeconds: 30,
      },
    });

    const sub = await bundle.coreDraftService.submitDraft(taActor, draft.id, {
      expectedRevision: draft.revision,
    });
    const approved = await bundle.approvalService.decideInitialApproval(
      adminActor,
      draft.id,
      { decision: "APPROVE", expectedRevision: sub.revision }
    );

    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "P_BLUE",
      userId: "u-blue",
      displayName: "Đấu thủ Xanh",
      unitCode: "KHOA_PINNING",
    });
    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "P_RED",
      userId: "u-red",
      displayName: "Đấu thủ Đỏ",
      unitCode: "KHOA_PINNING",
    });

    // Start running
    currentTime = new Date("2026-11-10T08:00:00.000Z");
    await bundle.lifecycleService.startRunning(taActor, approved.id);

    // TA publishes v2 with turnSeconds=40, effective at 09:00:00Z
    const currentT = bundle.coreDraftService.getTournament(approved.id);
    await bundle.lifecycleService.publishWithinEnvelopeRuleUpdate(
      taActor,
      approved.id,
      {
        expectedRevision: currentT.revision,
        effectiveAt: "2026-11-10T09:00:00.000Z",
        changeSummary: "Tăng thời gian mỗi lượt lên 40s từ 09h00",
        ruleProfilePatch: { turnSeconds: 40 },
      }
    );

    // Concurrently create matches: 2 before effectiveAt and 2 after effectiveAt
    const matchCreations = await Promise.all([
      bundle.admissionGateService.createMatchWithPinnedVersion({
        tournamentId: approved.id,
        roomId: "room-pre-1",
        blueParticipantId: "u-blue",
        redParticipantId: "u-red",
        matchId: "m-pre-1",
        createdAtIso: "2026-11-10T08:55:00.000Z",
      }),
      bundle.admissionGateService.createMatchWithPinnedVersion({
        tournamentId: approved.id,
        roomId: "room-pre-2",
        blueParticipantId: "u-blue",
        redParticipantId: "u-red",
        matchId: "m-pre-2",
        createdAtIso: "2026-11-10T08:59:00.000Z",
      }),
      bundle.admissionGateService.createMatchWithPinnedVersion({
        tournamentId: approved.id,
        roomId: "room-post-1",
        blueParticipantId: "u-blue",
        redParticipantId: "u-red",
        matchId: "m-post-1",
        createdAtIso: "2026-11-10T09:01:00.000Z",
      }),
      bundle.admissionGateService.createMatchWithPinnedVersion({
        tournamentId: approved.id,
        roomId: "room-post-2",
        blueParticipantId: "u-blue",
        redParticipantId: "u-red",
        matchId: "m-post-2",
        createdAtIso: "2026-11-10T09:05:00.000Z",
      }),
    ]);

    // Matches created before 09:00:00Z must pin version 1
    expect(matchCreations[0].match.pinnedConfigVersionNumber).toBe(1);
    expect(matchCreations[0].pinnedVersion.versionNumber).toBe(1);
    expect(matchCreations[1].match.pinnedConfigVersionNumber).toBe(1);
    expect(matchCreations[1].pinnedVersion.versionNumber).toBe(1);

    // Matches created after 09:00:00Z must pin version 2
    expect(matchCreations[2].match.pinnedConfigVersionNumber).toBe(2);
    expect(matchCreations[2].pinnedVersion.versionNumber).toBe(2);
    expect(matchCreations[3].match.pinnedConfigVersionNumber).toBe(2);
    expect(matchCreations[3].pinnedVersion.versionNumber).toBe(2);
  });

  it("Race 7 (BR-32 & T060): concurrent timeout sweep and manual adjudication verdict execution commit exactly one resolution", async () => {
    let currentTime = new Date("2026-10-21T08:00:00.000Z");
    const bundle = createTournamentRuntimeBundle({
      clockFn: () => currentTime,
    });
    bundle.store.grantSystemRole("admin-1", "ADMIN");
    const adminActor = bundle.store.resolveAuthoritativeActor({ userId: "admin-1" });

    const unit = await bundle.unitContractService.createUnit(adminActor, {
      unitCode: "KHOA_TIMEOUT",
      unitName: "Khoa Timeout Phán Quyết",
      unitType: "KHOA",
      contactName: "Nguyễn Timeout",
      contactEmail: "timeout@example.edu.vn",
      status: "ACTIVE",
    });

    const contract = await bundle.unitContractService.createContract(adminActor, {
      contractCode: "HD_TIMEOUT_TEST",
      unitId: unit.id,
      validFrom: "2026-10-01T00:00:00.000Z",
      validTo: "2026-12-31T23:59:59.000Z",
      maxTournamentsTotal: 5,
      maxParticipantsPerTournament: 16,
      maxParticipantsTotal: 64,
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
      initialTaUserIds: ["ta-timeout"],
    });

    const taActor = bundle.store.resolveAuthoritativeActor({ userId: "ta-timeout" });
    const draft = await bundle.coreDraftService.createDraft(taActor, {
      contractId: contract.id,
      coreConfig: buildBaseCoreConfig("TIMEOUT_RACE_01"),
      ruleProfile: {
        ...DEFAULT_TOURNAMENT_RULE_PROFILE,
        tieBreakPolicy: "MANUAL_REFEREE",
        manualAdjudicationDeadlineSeconds: 300,
        manualAdjudicationFallbackPolicy: "RED_ADVANTAGE",
      },
    });

    const sub = await bundle.coreDraftService.submitDraft(taActor, draft.id, {
      expectedRevision: draft.revision,
    });
    const approved = await bundle.approvalService.decideInitialApproval(
      adminActor,
      draft.id,
      { decision: "APPROVE", expectedRevision: sub.revision }
    );

    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "P1",
      userId: "u-1",
      displayName: "Đấu thủ 1",
      unitCode: "KHOA_TIMEOUT",
    });
    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "P2",
      userId: "u-2",
      displayName: "Đấu thủ 2",
      unitCode: "KHOA_TIMEOUT",
    });

    currentTime = new Date("2026-11-10T08:00:00.000Z");
    await bundle.lifecycleService.startRunning(taActor, approved.id);

    // Open WAITING adjudication request at 08:00:00Z -> deadline is 08:05:00Z
    const adjReq = await bundle.adjudicationLedgerService.openManualAdjudicationRequest({
      tournamentId: approved.id,
      matchId: "match-race-timeout-1",
      roomId: "room-race-timeout-1",
      blueParticipantId: "u-1",
      redParticipantId: "u-2",
      frozenSnapshot: { ply: 50 },
    });

    // Advance clock past deadline to 08:05:01Z
    currentTime = new Date("2026-11-10T08:05:01.000Z");

    // Concurrently trigger timeout sweep and manual adjudication verdict submit
    const results = await Promise.allSettled([
      bundle.adjudicationLedgerService.sweepExpiredAdjudications(approved.id),
      bundle.adjudicationLedgerService.submitManualVerdict(taActor, adjReq.id, {
        winnerSide: "BLUE",
        reason: "Cố nộp phán quyết đúng lúc hết hạn",
      }),
    ]);

    // Inspect results: exactly one resolution path committed
    // Either sweep resolved it (status=FALLBACK_APPLIED) or submitManualVerdict was rejected
    const ledger = bundle.adjudicationLedgerService.getLedgerEntries(approved.id);
    const matchLedgerEntries = ledger.filter((e) => e.matchId === "match-race-timeout-1");
    expect(matchLedgerEntries).toHaveLength(1);
    expect(matchLedgerEntries[0]?.finishSequence).toBe(1);

    const storedReq = bundle.adjudicationLedgerService.getAdjudicationRequest(adjReq.id);
    expect(storedReq?.status).toBe("FALLBACK_APPLIED");
    expect(storedReq?.winnerSide).toBe("RED"); // Based on manualAdjudicationFallbackPolicy: "RED_ADVANTAGE"
  });
});
