import { describe, expect, it } from "vitest";
import {
  ContractPolicyEnvelopeSchema,
  DEFAULT_TOURNAMENT_RULE_PROFILE,
  type TournamentCoreConfig,
} from "@ottv2/contracts";
import {
  applyMove,
  compareRuleStateOutcome,
  createInitialState,
  deriveTournamentComparatorMetrics,
  type ComparatorPolicy,
  type RuleState,
} from "@ottv2/game-rules";
import {
  createTournamentRuntimeBundle,
  type TournamentRuntimeBundle,
} from "../../apps/server/src/modules/tournament-core/index.js";
import type {
  PinnedMatchRecord,
  TournamentActorContext,
} from "../../apps/server/src/modules/tournament-foundation/tournament-store.js";

const POLICY: ComparatorPolicy = {
  version: "comparator-v1",
  criteriaOrder: ["WEIGHTED_MATERIAL", "GOAL_DISTANCE", "MOBILITY"],
  materialWeights: { R: 5, P: 3, S: 1 },
  goalDistanceEnabled: true,
  mobilityEnabled: true,
  eventPolicies: {
    noLegalMove: "COMPARE_CRITERIA",
    ownTurnViolation: "LOSS",
    infrastructure: "NEUTRAL",
  },
  drawEnabled: true,
  finalTiePolicy: "MANUAL",
  manual: { timeoutSeconds: 300, fallback: "SECOND_MOVER_WINS" },
};

let fixtureSequence = 0;

function nextFixtureSuffix(): string {
  fixtureSequence += 1;
  return String(fixtureSequence).padStart(2, "0");
}

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
  const suffix = nextFixtureSuffix();
  return {
    tournamentCode: `N10_${suffix}`,
    tournamentName: "N10 engine settlement integration",
    shortDescription: "Test-only disposable tournament",
    organizersText: "N10",
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
    scheduledEndAt: "2026-11-01T18:00:00.000Z",
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
    topNExportCount: 4,
    finalizationMode: "AUTO_FINAL",
    scoringFormulaPreset: "ELO_WEIGHTED_V1",
    initialScore: 1000,
    initialElo: 1000,
    kFactor: 32,
    scoreFloor: 0,
    botDeadlineAt: null,
    ...overrides,
  };
}

type Fixture = {
  bundle: TournamentRuntimeBundle;
  taActor: TournamentActorContext;
  tournamentId: string;
  blueParticipantId: string;
  redParticipantId: string;
  setNow: (iso: string) => void;
};

async function createRunningFixture(initialIso = "2026-10-22T08:00:00.000Z"): Promise<Fixture> {
  let currentIso = initialIso;
  const bundle = createTournamentRuntimeBundle({ clockFn: () => new Date(currentIso) });
  const adminActor: TournamentActorContext = { userId: "n10-admin", roles: ["ADMIN"] };
  const taActor: TournamentActorContext = { userId: "n10-ta", roles: ["TOURNAMENT_ADMIN"] };
  bundle.store.grantSystemRole(adminActor.userId, "ADMIN");
  bundle.store.grantSystemRole(taActor.userId, "TOURNAMENT_ADMIN");

  const suffix = nextFixtureSuffix();
  const unit = await bundle.unitContractService.createUnit(adminActor, {
    unitCode: `N10_UNIT_${suffix}`,
    unitName: "N10 Test Unit",
    unitType: "KHOA",
    contactName: "N10",
    contactEmail: "n10@example.edu.vn",
    status: "ACTIVE",
  });
  const contract = await bundle.unitContractService.createContract(adminActor, {
    contractCode: `N10_CONTRACT_${suffix}`,
    unitId: unit.id,
    validFrom: "2026-10-01T00:00:00.000Z",
    validTo: "2026-12-31T23:59:59.000Z",
    maxTournamentsTotal: 4,
    maxParticipantsPerTournament: 4,
    maxParticipantsTotal: 8,
    allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
    policyEnvelope: SAMPLE_ENVELOPE,
    technicalCaps: {
      botSourceMaxBytes: 65536,
      botRuntimeTimeoutMs: 1000,
      botMemoryLimitMb: 64,
      maxConcurrentMatchesPerTournament: 4,
      rosterImportMaxRows: 2000,
    },
    status: "ACTIVE",
    initialTaUserIds: [taActor.userId],
  });
  const draft = await bundle.coreDraftService.createDraft(taActor, {
    contractId: contract.id,
    coreConfig: buildCoreConfig(),
    ruleProfile: {
      ...DEFAULT_TOURNAMENT_RULE_PROFILE,
      tieBreakPolicy: "MANUAL_REFEREE",
      manualAdjudicationDeadlineSeconds: 30,
      manualAdjudicationFallbackPolicy: "BLUE_ADVANTAGE",
    },
  });
  const submitted = await bundle.coreDraftService.submitDraft(taActor, draft.id, {
    expectedRevision: draft.revision,
  });
  const approved = await bundle.approvalService.decideInitialApproval(adminActor, draft.id, {
    decision: "APPROVE",
    expectedRevision: submitted.revision,
  });
  await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
    personKey: "N10_BLUE",
    userId: "n10-blue",
    displayName: "N10 Blue",
    unitCode: unit.unitCode,
  });
  await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
    personKey: "N10_RED",
    userId: "n10-red",
    displayName: "N10 Red",
    unitCode: unit.unitCode,
  });
  currentIso = "2026-11-01T08:00:00.000Z";
  const running = await bundle.lifecycleService.startRunning(taActor, approved.id);
  return {
    bundle,
    taActor,
    tournamentId: running.id,
    blueParticipantId: "n10-blue",
    redParticipantId: "n10-red",
    setNow: (iso: string) => { currentIso = iso; },
  };
}

function advanceAcceptedMoves(): { state: RuleState; moves: string[] } {
  let state = createInitialState();
  const moves: string[] = [];
  for (const command of [
    { side: "BLUE" as const, from: "b1" as const, to: "b2" as const },
    { side: "RED" as const, from: "b9" as const, to: "b8" as const },
  ]) {
    const result = applyMove(state, command);
    if (result.kind !== "accepted") throw new Error(`N10 harness expected accepted move: ${result.error.code}`);
    state = result.state;
    moves.push(`${command.side}:${command.from}->${command.to}`);
  }
  return { state, moves };
}

function addRunningMatch(fixture: Fixture, matchId: string): void {
  const now = fixture.bundle.store.nowIso();
  const match: PinnedMatchRecord = {
    matchId,
    roomId: `${matchId}-room`,
    tournamentId: fixture.tournamentId,
    pinnedConfigVersionId: "n10-pinned-config",
    pinnedConfigVersionNumber: 1,
    blueParticipantId: fixture.blueParticipantId,
    redParticipantId: fixture.redParticipantId,
    status: "RUNNING",
    winnerSide: null,
    finishSequence: null,
    createdAt: now,
    endedAt: null,
  };
  fixture.bundle.store.matches.set(matchId, match);
}

function snapshotFromState(state: RuleState, outcome: ReturnType<typeof compareRuleStateOutcome>) {
  const files = "abcdefghi";
  const cells = Object.entries(state.board).map(([coordinate, piece]) => ({
    row: Number(coordinate.slice(1)) - 1,
    column: files.indexOf(coordinate[0] ?? ""),
    side: piece?.side ?? null,
    pieceType: piece?.type ?? null,
  }));
  return {
    board: { rows: state.ruleProfile?.board.rows ?? 9, columns: state.ruleProfile?.board.cols ?? 9, cells },
    sideToMove: state.currentTurn,
    tieIndicators: outcome.metrics,
    ruleVersion: state.ruleProfile?.version ?? "rps-v1",
    acceptedMoves: 2,
  };
}

describe("N10 — real engine move to manual/timeout settlement", () => {
  it("proves accepted moves -> canonical exact comparator tie -> WAITING -> one manual ledger settlement", async () => {
    const fixture = await createRunningFixture();
    const { state, moves } = advanceAcceptedMoves();
    const outcome = compareRuleStateOutcome(state, POLICY, "BLUE");
    expect(moves).toEqual(["BLUE:b1->b2", "RED:b9->b8"]);
    expect(deriveTournamentComparatorMetrics(state)).toEqual(outcome.metrics);
    expect(outcome).toMatchObject({
      winnerSide: null,
      reasonCode: "MANUAL_EXACT_TIE",
      manualRequired: true,
    });

    const matchId = "n10-manual-engine-match";
    addRunningMatch(fixture, matchId);
    const request = await fixture.bundle.adjudicationLedgerService.openManualAdjudicationRequest({
      tournamentId: fixture.tournamentId,
      matchId,
      roomId: `${matchId}-room`,
      blueParticipantId: fixture.blueParticipantId,
      redParticipantId: fixture.redParticipantId,
      frozenSnapshot: snapshotFromState(state, outcome),
    });
    expect(request.status).toBe("WAITING");
    expect(request.frozenSnapshot.acceptedMoves).toBe(2);
    expect(fixture.bundle.store.matches.get(matchId)?.status).toBe("PAUSED_ADJUDICATION");

    const decided = await fixture.bundle.adjudicationLedgerService.submitManualVerdict(
      fixture.taActor,
      request.id,
      { winnerSide: "BLUE", reason: "TA adjudicates the exact tie from the engine state" },
    );
    expect(decided.adjudication.status).toBe("DECIDED");
    expect(decided.adjudication.winnerSide).toBe("BLUE");
    expect(decided.ledgerEntry.resolutionSource).toBe("MANUAL_ADJUDICATION");
    expect(decided.ledgerEntry.finishSequence).toBe(1);
    expect(fixture.bundle.store.matches.get(matchId)).toMatchObject({
      status: "FINISHED",
      winnerSide: "BLUE",
      finishSequence: 1,
    });

    await expect(fixture.bundle.adjudicationLedgerService.submitManualVerdict(
      fixture.taActor,
      request.id,
      { winnerSide: "RED", reason: "duplicate" },
    )).rejects.toMatchObject({ statusCode: 409, details: { reason: "ADJUDICATION_ALREADY_RESOLVED" } });
    const ledger = fixture.bundle.adjudicationLedgerService.getLedgerEntries(fixture.tournamentId);
    expect(ledger.filter((entry) => entry.matchId === matchId)).toHaveLength(1);
    expect(fixture.bundle.adjudicationLedgerService.computeLeaderboardSnapshot(fixture.tournamentId).lastFinishSequence).toBe(1);
  });

  it("proves the same real engine tie reaches WAITING -> server-clock fallback exactly once", async () => {
    const fixture = await createRunningFixture();
    const { state } = advanceAcceptedMoves();
    const outcome = compareRuleStateOutcome(state, POLICY, "BLUE");
    expect(outcome.manualRequired).toBe(true);

    const matchId = "n10-timeout-engine-match";
    addRunningMatch(fixture, matchId);
    const request = await fixture.bundle.adjudicationLedgerService.openManualAdjudicationRequest({
      tournamentId: fixture.tournamentId,
      matchId,
      roomId: `${matchId}-room`,
      blueParticipantId: fixture.blueParticipantId,
      redParticipantId: fixture.redParticipantId,
      frozenSnapshot: snapshotFromState(state, outcome),
      deadlineSeconds: 30,
    });
    expect(request.status).toBe("WAITING");
    fixture.setNow("2026-11-01T08:00:31.000Z");
    const resolved = await fixture.bundle.adjudicationLedgerService.sweepExpiredAdjudications(fixture.tournamentId);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({
      id: request.id,
      status: "FALLBACK_APPLIED",
      winnerSide: "BLUE",
      finishSequence: 1,
    });
    expect(fixture.bundle.store.matches.get(matchId)).toMatchObject({ status: "FINISHED", winnerSide: "BLUE", finishSequence: 1 });
    expect(fixture.bundle.adjudicationLedgerService.getLedgerEntries(fixture.tournamentId)).toHaveLength(1);
    expect(await fixture.bundle.adjudicationLedgerService.sweepExpiredAdjudications(fixture.tournamentId)).toHaveLength(0);
  });

  it("serializes manual-vs-timeout and cancellation races without duplicate ledger entries", async () => {
    const fixture = await createRunningFixture();
    const { state } = advanceAcceptedMoves();
    const outcome = compareRuleStateOutcome(state, POLICY, "BLUE");
    const matchId = "n10-race-engine-match";
    addRunningMatch(fixture, matchId);
    const request = await fixture.bundle.adjudicationLedgerService.openManualAdjudicationRequest({
      tournamentId: fixture.tournamentId,
      matchId,
      roomId: `${matchId}-room`,
      blueParticipantId: fixture.blueParticipantId,
      redParticipantId: fixture.redParticipantId,
      frozenSnapshot: snapshotFromState(state, outcome),
      deadlineSeconds: 30,
    });
    fixture.setNow("2026-11-01T08:00:31.000Z");
    const [manual, timeout] = await Promise.allSettled([
      fixture.bundle.adjudicationLedgerService.submitManualVerdict(
        fixture.taActor,
        request.id,
        { winnerSide: "RED", reason: "race" },
      ),
      fixture.bundle.adjudicationLedgerService.sweepExpiredAdjudications(fixture.tournamentId),
    ]);
    const stored = fixture.bundle.adjudicationLedgerService.getAdjudicationRequest(request.id);
    expect(stored?.status).toMatch(/DECIDED|FALLBACK_APPLIED/);
    expect(stored?.finishSequence).toBe(1);
    expect(fixture.bundle.adjudicationLedgerService.getLedgerEntries(fixture.tournamentId)).toHaveLength(1);
    expect([manual.status, timeout.status]).toContain("fulfilled");
    if (manual.status === "fulfilled") {
      expect(manual.value.adjudication.status).toBe("DECIDED");
    }
    if (timeout.status === "fulfilled") {
      expect(timeout.value.every((item) => item.status === "FALLBACK_APPLIED")).toBe(true);
    }

    const cancelledFixture = await createRunningFixture();
    const cancelledMatchId = "n10-cancel-engine-match";
    addRunningMatch(cancelledFixture, cancelledMatchId);
    const cancelledRequest = await cancelledFixture.bundle.adjudicationLedgerService.openManualAdjudicationRequest({
      tournamentId: cancelledFixture.tournamentId,
      matchId: cancelledMatchId,
      roomId: `${cancelledMatchId}-room`,
      blueParticipantId: cancelledFixture.blueParticipantId,
      redParticipantId: cancelledFixture.redParticipantId,
      frozenSnapshot: snapshotFromState(state, outcome),
    });
    const tournament = cancelledFixture.bundle.coreDraftService.getTournament(cancelledFixture.tournamentId);
    const cancelled = await cancelledFixture.bundle.lifecycleService.cancelTournament(
      cancelledFixture.taActor,
      cancelledFixture.tournamentId,
      "N10 cancellation race",
      tournament.revision,
    );
    expect(cancelled.cancelledAdjudicationsCount).toBe(1);
    expect(cancelledFixture.bundle.adjudicationLedgerService.getAdjudicationRequest(cancelledRequest.id)?.status).toBe("CANCELLED");
    expect(cancelledFixture.bundle.adjudicationLedgerService.getLedgerEntries(cancelledFixture.tournamentId)).toHaveLength(0);
  });
});
