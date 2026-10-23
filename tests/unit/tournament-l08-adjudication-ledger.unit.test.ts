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
    tournamentCode: "TOURNAMENT_L08",
    tournamentName: "Giải Đấu Phán Quyết L08",
    shortDescription: "Kiểm thử L08 manual adjudication & score ledger",
    organizersText: "Hội Đồng Trọng Tài",
    competitionMode: "HUMAN_ONLINE",
    audienceScope: "PUBLIC_REGISTERED",
    allowedUnitCodes: [],
    registrationIntakeMode: "IMPORT_ONLY",
    maxParticipants: 16,
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
    maxConcurrentMatches: 8,
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
    scoreFloor: 45, // Score floor to test score clamping (T072)
    botDeadlineAt: null,
    ...overrides,
  };
}

function canonicalSnapshot(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    board: { rows: 1, columns: 1, cells: [{ row: 0, column: 0, side: null, pieceType: null }] },
    sideToMove: "BLUE",
    ruleVersion: "rps-v1",
    tieIndicators: {
      blue: { materialByType: { R: 0, P: 0, S: 0 }, goalDistance: null, mobility: 0 },
      red: { materialByType: { R: 0, P: 0, S: 0 }, goalDistance: null, mobility: 0 },
    },
    ...extra,
  };
}

function setupL08Fixture(initialIso = "2026-10-22T08:00:00.000Z") {
  let currentTime = new Date(initialIso);
  const clockFn = () => currentTime;
  const bundle = createTournamentRuntimeBundle({ clockFn });

  const adminActor: TournamentActorContext = {
    userId: "admin-sa-1",
    roles: ["ADMIN"],
  };
  bundle.store.grantSystemRole("admin-sa-1", "ADMIN");

  const taActor: TournamentActorContext = {
    userId: "ta-owner-1",
    roles: ["TOURNAMENT_ADMIN"],
  };
  bundle.store.grantSystemRole("ta-owner-1", "TOURNAMENT_ADMIN");

  const taOtherActor: TournamentActorContext = {
    userId: "ta-other-2",
    roles: ["TOURNAMENT_ADMIN"],
  };
  bundle.store.grantSystemRole("ta-other-2", "TOURNAMENT_ADMIN");

  const refereeActor: TournamentActorContext = {
    userId: "ref-1",
    roles: ["REFEREE"],
  };
  bundle.store.grantSystemRole("ref-1", "REFEREE");

  const setNow = (isoString: string) => {
    currentTime = new Date(isoString);
  };

  return {
    bundle,
    adminActor,
    taActor,
    taOtherActor,
    refereeActor,
    setNow,
  };
}

let unitCounter = 1;

async function createRunningL08Tournament(
  fixture: ReturnType<typeof setupL08Fixture>,
  configOverrides?: Partial<TournamentCoreConfig>,
  ruleProfileOverrides?: Record<string, unknown>
) {
  const { bundle, adminActor, taActor, setNow } = fixture;
  const currentUnitId = unitCounter++;

  // Step 1: Set time to draft creation time before scheduledStartAt
  setNow("2026-10-22T08:00:00.000Z");

  const unit = await bundle.unitContractService.createUnit(adminActor, {
    unitCode: `UNIT_L08_${currentUnitId}`,
    unitName: "Khoa CNTT Trọng Tài",
    unitType: "KHOA",
    contactName: "Trưởng ban Phán quyết",
    contactEmail: "referee@example.edu.vn",
    status: "ACTIVE",
  });

  const contract = await bundle.unitContractService.createContract(adminActor, {
    contractCode: `HD_L08_${currentUnitId}`,
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

  const draft = await bundle.coreDraftService.createDraft(taActor, {
    contractId: contract.id,
    coreConfig: buildCoreConfig(configOverrides),
    ruleProfile: {
      ...DEFAULT_TOURNAMENT_RULE_PROFILE,
      tieBreakPolicy: "MANUAL_REFEREE",
      manualAdjudicationDeadlineSeconds: 300,
      manualAdjudicationFallbackPolicy: "BLUE_ADVANTAGE",
      ...ruleProfileOverrides,
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
    }
  );

  // Enroll participants
  const participants = [
    { personKey: "SV01", userId: "user-p1", displayName: "Đấu thủ 1" },
    { personKey: "SV02", userId: "user-p2", displayName: "Đấu thủ 2" },
    { personKey: "SV03", userId: "user-p3", displayName: "Đấu thủ 3" },
    { personKey: "SV04", userId: "user-p4", displayName: "Đấu thủ 4" },
  ];

  for (const p of participants) {
    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: p.personKey,
      userId: p.userId,
      displayName: p.displayName,
      unitCode: unit.unitCode,
    });
  }

  // Fast-forward to scheduledStartAt and start running
  setNow("2026-11-01T08:00:00.000Z");
  const running = await bundle.lifecycleService.startRunning(taActor, approved.id);

  return { unit, contract, tournament: running, participants };
}

describe("Task L08 — Manual Adjudication Transaction & Ledger Handoff Unit Tests", () => {
  it("T009 & T059: Strictly enforces Owner-TA ACL for manual adjudication; rejects Admin, Referee, other TAs, and Players with 403", async () => {
    const fixture = setupL08Fixture();
    const { tournament } = await createRunningL08Tournament(fixture);
    const { bundle, adminActor, taActor, taOtherActor, refereeActor } = fixture;

    // Open WAITING adjudication request
    const adjReq = await bundle.adjudicationLedgerService.openManualAdjudicationRequest({
      tournamentId: tournament.id,
      matchId: "match-acl-1",
      roomId: "room-acl-1",
      blueParticipantId: "user-p1",
      redParticipantId: "user-p2",
      frozenSnapshot: canonicalSnapshot({ scenario: "state-1" }),
    });

    expect(adjReq.status).toBe("WAITING");

    // 1. Admin attempts to adjudicate -> 403 FORBIDDEN_ROLE
    await expect(
      bundle.adjudicationLedgerService.submitManualVerdict(adminActor, adjReq.id, {
        winnerSide: "BLUE",
        reason: "Admin can thiệp phân xử trái phép",
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { reason: "FORBIDDEN_ROLE" },
    });

    // 2. Referee attempts to adjudicate -> 403 FORBIDDEN_ROLE
    await expect(
      bundle.adjudicationLedgerService.submitManualVerdict(refereeActor, adjReq.id, {
        winnerSide: "RED",
        reason: "Trọng tài bàn can thiệp phán quyết TA",
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { reason: "FORBIDDEN_ROLE" },
    });

    // 3. Unrelated TA attempts to adjudicate -> 403 FORBIDDEN_ROLE
    await expect(
      bundle.adjudicationLedgerService.submitManualVerdict(taOtherActor, adjReq.id, {
        winnerSide: "BLUE",
        reason: "TA khác phân xử chéo giải",
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { reason: "FORBIDDEN_ROLE" },
    });

    // 4. Player attempts to adjudicate -> 403 FORBIDDEN_ROLE
    const playerActor: TournamentActorContext = {
      userId: "user-p1",
      roles: ["PLAYER"],
    };
    await expect(
      bundle.adjudicationLedgerService.submitManualVerdict(playerActor, adjReq.id, {
        winnerSide: "BLUE",
        reason: "Người chơi tự phân xử cho mình",
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { reason: "FORBIDDEN_ROLE" },
    });

    // 5. Owner TA submits valid verdict -> 200 OK
    const verdictRes = await bundle.adjudicationLedgerService.submitManualVerdict(
      taActor,
      adjReq.id,
      {
        winnerSide: "BLUE",
        reason: "Xanh chiếm ưu thế trung tâm tuyệt đối",
      }
    );

    expect(verdictRes.adjudication.status).toBe("DECIDED");
    expect(verdictRes.adjudication.winnerSide).toBe("BLUE");
    expect(verdictRes.adjudication.decidedByUserId).toBe(taActor.userId);
    expect(verdictRes.ledgerEntry.finishSequence).toBe(1);
    expect(verdictRes.ledgerEntry.resolutionSource).toBe("MANUAL_ADJUDICATION");
  });

  it("T060 & BR-32: Enforces 300s deadline expiry; fallbackPolicy takes priority over late manual verdict", async () => {
    const fixture = setupL08Fixture("2026-11-01T08:00:00.000Z");
    const { tournament } = await createRunningL08Tournament(fixture, undefined, {
      manualAdjudicationDeadlineSeconds: 300,
      manualAdjudicationFallbackPolicy: "RED_ADVANTAGE",
    });
    const { bundle, taActor, setNow } = fixture;

    // Open WAITING adjudication request at 08:00:00Z -> deadline is 08:05:00Z
    const adjReq = await bundle.adjudicationLedgerService.openManualAdjudicationRequest({
      tournamentId: tournament.id,
      matchId: "match-deadline-1",
      roomId: "room-deadline-1",
      blueParticipantId: "user-p1",
      redParticipantId: "user-p2",
      frozenSnapshot: canonicalSnapshot({ turn: 50 }),
    });

    expect(adjReq.deadlineAt).toBe("2026-11-01T08:05:00.000Z");

    // Fast-forward time past deadline to 08:05:01Z
    setNow("2026-11-01T08:05:01.000Z");

    // Case A: TA submits late verdict without prior sweep
    // System automatically applies fallbackPolicy (RED_ADVANTAGE) and rejects TA with 409 ADJUDICATION_DEADLINE_EXPIRED
    await expect(
      bundle.adjudicationLedgerService.submitManualVerdict(taActor, adjReq.id, {
        winnerSide: "BLUE",
        reason: "Phán quyết nộp muộn sau khi hết hạn",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      details: {
        reason: "ADJUDICATION_DEADLINE_EXPIRED",
        adjudicationRequestId: adjReq.id,
      },
    });

    // Inspect stored request state: must be FALLBACK_APPLIED with winner RED
    const storedReq = bundle.adjudicationLedgerService.getAdjudicationRequest(adjReq.id);
    expect(storedReq?.status).toBe("FALLBACK_APPLIED");
    expect(storedReq?.winnerSide).toBe("RED");
    expect(storedReq?.finishSequence).toBe(1);

    // Case B: Open second match, sweep expired, then TA tries to submit
    setNow("2026-11-01T08:10:00.000Z");
    const adjReq2 = await bundle.adjudicationLedgerService.openManualAdjudicationRequest({
      tournamentId: tournament.id,
      matchId: "match-deadline-2",
      roomId: "room-deadline-2",
      blueParticipantId: "user-p3",
      redParticipantId: "user-p4",
      frozenSnapshot: canonicalSnapshot({ turn: 60 }),
    });

    setNow("2026-11-01T08:15:30.000Z"); // 5m30s later (past 300s deadline)

    const swept = await bundle.adjudicationLedgerService.sweepExpiredAdjudications(tournament.id);
    expect(swept.map((s) => s.id)).toContain(adjReq2.id);

    const sweptReq2 = bundle.adjudicationLedgerService.getAdjudicationRequest(adjReq2.id);
    expect(sweptReq2?.status).toBe("FALLBACK_APPLIED");
    expect(sweptReq2?.finishSequence).toBe(2);

    // TA attempts to override after sweep -> 409 ADJUDICATION_ALREADY_RESOLVED
    await expect(
      bundle.adjudicationLedgerService.submitManualVerdict(taActor, adjReq2.id, {
        winnerSide: "BLUE",
        reason: "Cố ghi đè kết quả đã được giải quyết bằng fallback",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: "ADJUDICATION_ALREADY_RESOLVED" },
    });
  });

  it("T060 & AC-L08: Enforces CAS on WAITING; guarantees exactly-one verdict and prevents double points in score ledger", async () => {
    const fixture = setupL08Fixture("2026-11-01T08:00:00.000Z");
    const { tournament } = await createRunningL08Tournament(fixture);
    const { bundle, taActor } = fixture;

    const adjReq = await bundle.adjudicationLedgerService.openManualAdjudicationRequest({
      tournamentId: tournament.id,
      matchId: "match-cas-single",
      roomId: "room-cas-single",
      blueParticipantId: "user-p1",
      redParticipantId: "user-p2",
      frozenSnapshot: canonicalSnapshot({ ply: 80 }),
    });

    // 1st verdict commit -> Success
    const firstCommit = await bundle.adjudicationLedgerService.submitManualVerdict(
      taActor,
      adjReq.id,
      {
        winnerSide: "BLUE",
        reason: "Phán quyết hợp lệ lần đầu",
      }
    );
    expect(firstCommit.adjudication.status).toBe("DECIDED");
    expect(firstCommit.ledgerEntry.finishSequence).toBe(1);

    // 2nd verdict commit -> 409 CONFLICT (ADJUDICATION_ALREADY_RESOLVED)
    await expect(
      bundle.adjudicationLedgerService.submitManualVerdict(taActor, adjReq.id, {
        winnerSide: "RED",
        reason: "Cố đổi phán quyết lần hai",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: "ADJUDICATION_ALREADY_RESOLVED" },
    });

    // Attempt to settle the same match via recordNormalMatchFinish -> 409 MATCH_ALREADY_SETTLED_IN_LEDGER
    await expect(
      bundle.adjudicationLedgerService.recordNormalMatchFinish({
        tournamentId: tournament.id,
        matchId: "match-cas-single",
        blueParticipantId: "user-p1",
        redParticipantId: "user-p2",
        winnerSide: "RED",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: "MATCH_ALREADY_SETTLED_IN_LEDGER" },
    });

    // Ledger has exactly 1 entry for this matchId
    const ledger = bundle.adjudicationLedgerService.getLedgerEntries(tournament.id);
    const matchEntries = ledger.filter((e) => e.matchId === "match-cas-single");
    expect(matchEntries).toHaveLength(1);
    expect(matchEntries[0]?.finishSequence).toBe(1);
  });

  it("T029 & Cancel Order: Tournament cancellation cascades to WAITING adjudications and blocks further verdicts / new openings", async () => {
    const fixture = setupL08Fixture("2026-11-01T08:00:00.000Z");
    const { tournament } = await createRunningL08Tournament(fixture);
    const { bundle, taActor } = fixture;

    const adjReq = await bundle.adjudicationLedgerService.openManualAdjudicationRequest({
      tournamentId: tournament.id,
      matchId: "match-cancel-order",
      roomId: "room-cancel-order",
      blueParticipantId: "user-p1",
      redParticipantId: "user-p2",
      frozenSnapshot: canonicalSnapshot({ ply: 40 }),
    });

    expect(adjReq.status).toBe("WAITING");

    // Cancel tournament via lifecycleService
    const currentT = bundle.coreDraftService.getTournament(tournament.id);
    const cancelRes = await bundle.lifecycleService.cancelTournament(
      taActor,
      tournament.id,
      "Hủy giải đấu do sự cố bất khả kháng",
      currentT.revision
    );
    expect(cancelRes.cancelledAdjudicationsCount).toBe(1);

    // Adjudication request is CANCELLED
    const cancelledReq = bundle.adjudicationLedgerService.getAdjudicationRequest(adjReq.id);
    expect(cancelledReq?.status).toBe("CANCELLED");

    // TA attempts to submit verdict on cancelled request -> 409
    await expect(
      bundle.adjudicationLedgerService.submitManualVerdict(taActor, adjReq.id, {
        winnerSide: "BLUE",
        reason: "Phán quyết trên yêu cầu đã bị hủy",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
    });

    // Attempting to open a new adjudication on cancelled tournament -> 409
    await expect(
      bundle.adjudicationLedgerService.openManualAdjudicationRequest({
        tournamentId: tournament.id,
        matchId: "match-cancel-new",
        roomId: "room-cancel-new",
        blueParticipantId: "user-p3",
        redParticipantId: "user-p4",
      frozenSnapshot: canonicalSnapshot({ ply: 10 }),
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: "TOURNAMENT_NOT_ACCEPTING_ADJUDICATIONS" },
    });
  });

  it("T072, T073, T081: Ledger replay by finishSequence, scoreFloor clamping, and 6-level tie-break leaderboard snapshot", async () => {
    const fixture = setupL08Fixture("2026-11-01T08:00:00.000Z");
    const { tournament } = await createRunningL08Tournament(fixture, {
      initialScore: 50,
      initialElo: 1000,
      scoreFloor: 45, // Clamping floor: scores never drop below 45
      topNExportCount: 2,
    });
    const { bundle, taActor, setNow } = fixture;

    // Match 1 (Normal finish): user-p1 beats user-p2
    setNow("2026-11-01T08:10:00.000Z");
    const m1 = await bundle.adjudicationLedgerService.recordNormalMatchFinish({
      tournamentId: tournament.id,
      matchId: "match-seq-1",
      blueParticipantId: "user-p1",
      redParticipantId: "user-p2",
      winnerSide: "BLUE",
    });
    expect(m1.finishSequence).toBe(1);

    // Match 2 (Manual adjudication): user-p3 beats user-p4
    setNow("2026-11-01T08:20:00.000Z");
    const adj2 = await bundle.adjudicationLedgerService.openManualAdjudicationRequest({
      tournamentId: tournament.id,
      matchId: "match-seq-2",
      roomId: "room-seq-2",
      blueParticipantId: "user-p3",
      redParticipantId: "user-p4",
      frozenSnapshot: canonicalSnapshot({ ply: 100 }),
    });
    const v2 = await bundle.adjudicationLedgerService.submitManualVerdict(taActor, adj2.id, {
      winnerSide: "BLUE",
      reason: "Đấu thủ 3 thắng cờ tàn",
    });
    expect(v2.ledgerEntry.finishSequence).toBe(2);

    // Match 3 (Normal finish): user-p1 beats user-p3
    setNow("2026-11-01T08:30:00.000Z");
    const m3 = await bundle.adjudicationLedgerService.recordNormalMatchFinish({
      tournamentId: tournament.id,
      matchId: "match-seq-3",
      blueParticipantId: "user-p1",
      redParticipantId: "user-p3",
      winnerSide: "BLUE",
    });
    expect(m3.finishSequence).toBe(3);

    // Match 4 (Fallback finish): user-p4 beats user-p2
    setNow("2026-11-01T08:40:00.000Z");
    const adj4 = await bundle.adjudicationLedgerService.openManualAdjudicationRequest({
      tournamentId: tournament.id,
      matchId: "match-seq-4",
      roomId: "room-seq-4",
      blueParticipantId: "user-p4",
      redParticipantId: "user-p2",
      frozenSnapshot: canonicalSnapshot({ ply: 120 }),
      deadlineSeconds: 10,
    });
    // Fast-forward past deadline
    setNow("2026-11-01T08:40:15.000Z");
    const swept = await bundle.adjudicationLedgerService.sweepExpiredAdjudications(tournament.id);
    expect(swept.map((s) => s.id)).toContain(adj4.id);

    // Compute canonical leaderboard snapshot
    const leaderboard = bundle.adjudicationLedgerService.computeLeaderboardSnapshot(tournament.id);

    expect(leaderboard.lastFinishSequence).toBe(4);
    expect(leaderboard.standings).toHaveLength(4);

    // T073: Top N export takes exactly topNExportCount (2)
    expect(leaderboard.topNExport).toHaveLength(2);
    expect(leaderboard.topNExport[0]?.participantId).toBe("user-p1");
    expect(leaderboard.topNExport[0]?.rank).toBe(1);

    // T072: user-p2 lost 2 matches in a row, score clamped at >= scoreFloor (45)
    const p2Standing = leaderboard.standings.find((s) => s.participantId === "user-p2");
    expect(p2Standing).toBeDefined();
    expect(p2Standing?.tournamentScore).toBeGreaterThanOrEqual(45);
    expect(p2Standing?.losses).toBe(2);

    // Standings sort order: Rank 1 is user-p1 (2 wins, 0 losses)
    const p1Standing = leaderboard.standings.find((s) => s.participantId === "user-p1");
    expect(p1Standing?.rank).toBe(1);
    expect(p1Standing?.wins).toBe(2);
  });

  it("Sanitizes sensitive bot source code and secrets in frozen snapshot", async () => {
    const fixture = setupL08Fixture();
    const { tournament } = await createRunningL08Tournament(fixture);
    const { bundle } = fixture;

    const sensitiveSnapshot = {
      board: { cells: ["R1", "P2"] },
      sourceText: "def choose_move(board):\n    import os\n    return 'PASS'",
      privateKey: "sk_live_very_secret_bot_credential",
      turnNumber: 42,
    };

    const adjReq = await bundle.adjudicationLedgerService.openManualAdjudicationRequest({
      tournamentId: tournament.id,
      matchId: "match-sensitive-1",
      roomId: "room-sensitive-1",
      blueParticipantId: "user-p1",
      redParticipantId: "user-p2",
      frozenSnapshot: canonicalSnapshot(sensitiveSnapshot),
    });

    // Verify sourceText and privateKey are redacted
    expect(adjReq.frozenSnapshot.sourceText).toBe("[REDACTED]");
    expect(adjReq.frozenSnapshot.privateKey).toBe("[REDACTED]");
    expect(adjReq.frozenSnapshot.turnNumber).toBe(42);
    expect(adjReq.frozenSnapshot.board).toEqual({ cells: ["R1", "P2"] });
  });
});
