import { describe, expect, it } from "vitest";
import {
  applyMove,
  compareRuleStateOutcome,
  createInitialStateFromProfile,
  getLegalMoves,
  type MoveCommand,
  type ComparatorPolicy,
  type RuleProfile,
  type RuleState,
  type TournamentComparatorResult,
} from "@ottv2/game-rules";
import { createTournamentRuntimeBundle } from "../../apps/server/src/modules/tournament-core/index.js";
import { openExactTieAdjudicationFromEngine } from "../../apps/server/src/modules/tournament-core/engine-adjudication.adapter.js";
import type { TournamentActorContext } from "../../apps/server/src/modules/tournament-foundation/tournament-store.js";

const comparatorPolicy: ComparatorPolicy = {
  version: "comparator-v1",
  criteriaOrder: ["WEIGHTED_MATERIAL", "GOAL_DISTANCE", "MOBILITY"],
  materialWeights: { R: 5, P: 3, S: 1 },
  goalDistanceEnabled: true,
  mobilityEnabled: true,
  eventPolicies: { noLegalMove: "COMPARE_CRITERIA", ownTurnViolation: "LOSS", infrastructure: "NEUTRAL" },
  drawEnabled: true,
  finalTiePolicy: "MANUAL",
  manual: { timeoutSeconds: 5, fallback: "BLUE_ADVANTAGE" },
};

const symmetricProfile: RuleProfile = {
  version: "rps-custom-v1",
  board: { rows: 5, cols: 5 },
  initialTurn: "BLUE",
  pieceCounts: { BLUE: { R: 1, P: 0, S: 0 }, RED: { R: 1, P: 0, S: 0 } },
  layout: [
    { id: "blue-r", side: "BLUE", type: "R", coordinate: "a1" },
    { id: "red-r", side: "RED", type: "R", coordinate: "e5" },
  ],
  movementProfiles: {
    BLUE: { R: [{ kind: "RAY", directions: [{ fileDelta: -1, rankDelta: 0 }, { fileDelta: 1, rankDelta: 0 }, { fileDelta: 0, rankDelta: -1 }, { fileDelta: 0, rankDelta: 1 }], minDistance: 1, maxDistance: 1, canJump: false }], P: [{ kind: "RAY", directions: [], minDistance: 1, maxDistance: 1, canJump: false }], S: [{ kind: "RAY", directions: [], minDistance: 1, maxDistance: 1, canJump: false }] },
    RED: { R: [{ kind: "RAY", directions: [{ fileDelta: -1, rankDelta: 0 }, { fileDelta: 1, rankDelta: 0 }, { fileDelta: 0, rankDelta: -1 }, { fileDelta: 0, rankDelta: 1 }], minDistance: 1, maxDistance: 1, canJump: false }], P: [{ kind: "RAY", directions: [], minDistance: 1, maxDistance: 1, canJump: false }], S: [{ kind: "RAY", directions: [], minDistance: 1, maxDistance: 1, canJump: false }] },
  },
  winConditions: [],
  goalProfiles: { BLUE: { mode: "STATIC", cell: "e1" }, RED: { mode: "STATIC", cell: "a5" } },
};

function findAcceptedExactTie(): { state: RuleState; comparison: TournamentComparatorResult; acceptedMoves: readonly MoveCommand[] } {
  const initial = createInitialStateFromProfile(symmetricProfile);
  for (const blueMove of getLegalMoves(initial, "BLUE")) {
    const afterBlue = applyMove(initial, blueMove);
    if (afterBlue.kind !== "accepted") continue;
    for (const redMove of getLegalMoves(afterBlue.state, "RED")) {
      const afterRed = applyMove(afterBlue.state, redMove);
      if (afterRed.kind !== "accepted") continue;
      const comparison = compareRuleStateOutcome(afterRed.state, comparatorPolicy, "BLUE");
      if (comparison.manualRequired && comparison.reasonCode === "MANUAL_EXACT_TIE") {
        return { state: afterRed.state, comparison, acceptedMoves: [blueMove, redMove] };
      }
    }
  }
  throw new Error("NO_ACCEPTED_MOVE_EXACT_TIE_FOUND");
}

function seedRuntime(clockFn: () => Date) {
  const bundle = createTournamentRuntimeBundle({ clockFn });
  const tournamentId = "n10-engine-tournament";
  const matchId = `n10-match-${Math.random().toString(36).slice(2)}`;
  bundle.store.tournaments.set(tournamentId, {
    id: tournamentId,
    contractId: "n10-contract",
    contractCode: "N10_CONTRACT",
    unitId: "n10-unit",
    ownerTaUserId: "ta-owner",
    status: "RUNNING",
    revision: 1,
    coreConfig: { initialElo: 1000, initialScore: 100, kFactor: 32, scoreFloor: 0, topNExportCount: 2 } as never,
    ruleProfile: { manualAdjudicationDeadlineSeconds: 5, manualAdjudicationFallbackPolicy: "BLUE_ADVANTAGE" } as never,
    activeConfigVersionId: "n10-config",
    activeConfigVersionNumber: 1,
    approvedSnapshot: null,
    everApproved: true,
    quotaRefunded: false,
    submittedAt: null,
    approvedAt: null,
    rejectedAt: null,
    changesRequestedAt: null,
    lastReviewNote: null,
    lastReviewFieldNotes: {},
    startedAt: "2026-10-23T08:00:00.000Z",
    pausedAt: null,
    pauseReason: null,
    endedAt: null,
    cancelledAt: null,
    cancelReason: null,
    finalizedAt: null,
    copiedFromTournamentId: null,
    createdAt: "2026-10-23T08:00:00.000Z",
    updatedAt: "2026-10-23T08:00:00.000Z",
  } as never);
  bundle.store.contracts.set("n10-contract", {
    id: "n10-contract",
    contractCode: "N10_CONTRACT",
    unitId: "n10-unit",
    status: "ACTIVE",
    validFrom: "2026-01-01T00:00:00.000Z",
    validTo: "2027-01-01T00:00:00.000Z",
    maxTournamentsTotal: 10,
    quotaReservedCount: 1,
    quotaConsumedCount: 1,
    quotaRemainingCount: 9,
    maxParticipantsPerTournament: 16,
    maxParticipantsTotal: 100,
    currentParticipantsTotal: 2,
    allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
    policyEnvelope: {} as never,
    technicalCaps: {} as never,
    taBindings: [{ userId: "ta-owner", status: "ACTIVE", assignedAt: "2026-01-01T00:00:00.000Z", revokedAt: null }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as never);
  bundle.store.matches.set(matchId, {
    matchId,
    roomId: "n10-room",
    tournamentId,
    pinnedConfigVersionId: "n10-config",
    pinnedConfigVersionNumber: 1,
    blueParticipantId: "blue-player",
    redParticipantId: "red-player",
    status: "RUNNING",
    winnerSide: null,
    finishSequence: null,
    createdAt: "2026-10-23T08:00:00.000Z",
    endedAt: null,
  });
  return { bundle, tournamentId, matchId };
}

const taActor: TournamentActorContext = { userId: "ta-owner", roles: ["TOURNAMENT_ADMIN"] };

describe("N10 — real engine to adjudication settlement boundary", () => {
  it("records accepted engine moves before opening WAITING and settles exactly once manually", async () => {
    const { state, comparison, acceptedMoves } = findAcceptedExactTie();
    expect(comparison.manualRequired).toBe(true);
    expect(acceptedMoves).toHaveLength(2);
    expect(acceptedMoves.map(({ from, to }) => `${from}->${to}`)).toEqual([
      expect.any(String),
      expect.any(String),
    ]);

    const { bundle, tournamentId, matchId } = seedRuntime(() => new Date("2026-10-23T08:00:00.000Z"));
    const request = await openExactTieAdjudicationFromEngine({
      ledgerService: bundle.adjudicationLedgerService,
      state,
      policy: comparatorPolicy,
      firstMoverSide: "BLUE",
      tournamentId,
      matchId,
      roomId: "n10-room",
      blueParticipantId: "blue-player",
      redParticipantId: "red-player",
    });
    expect(request.status).toBe("WAITING");
    expect(request.frozenSnapshot).toMatchObject({
      sideToMove: state.currentTurn,
      ruleVersion: "rps-custom-v1",
      tieIndicators: { blue: { pieceCounts: { R: 1, P: 0, S: 0 } } },
    });

    const settled = await bundle.adjudicationLedgerService.submitManualVerdict(taActor, request.id, {
      winnerSide: "BLUE",
      reason: "Bằng tuyệt đối theo comparator canonical; TA chốt BLUE.",
    });
    expect(settled.adjudication.status).toBe("DECIDED");
    expect(settled.ledgerEntry.resolutionSource).toBe("MANUAL_ADJUDICATION");
    expect(bundle.store.scoreLedger.get(tournamentId)).toHaveLength(1);
    expect(bundle.store.matches.get(matchId)).toMatchObject({ status: "FINISHED", winnerSide: "BLUE", finishSequence: 1 });

    await expect(bundle.adjudicationLedgerService.submitManualVerdict(taActor, request.id, {
      winnerSide: "RED",
      reason: "Không được ghi đè kết quả đã chốt.",
    })).rejects.toMatchObject({ statusCode: 409 });
    expect(bundle.store.scoreLedger.get(tournamentId)).toHaveLength(1);
  });

  it("uses the server clock for the timeout branch after the same accepted-move trace", async () => {
    let now = new Date("2026-10-23T08:00:00.000Z");
    const { state } = findAcceptedExactTie();
    const { bundle, tournamentId, matchId } = seedRuntime(() => now);
    const request = await openExactTieAdjudicationFromEngine({
      ledgerService: bundle.adjudicationLedgerService,
      state,
      policy: comparatorPolicy,
      firstMoverSide: "BLUE",
      tournamentId,
      matchId,
      roomId: "n10-room",
      blueParticipantId: "blue-player",
      redParticipantId: "red-player",
      deadlineSeconds: 5,
    });
    now = new Date("2026-10-23T08:00:06.000Z");
    const resolved = await bundle.adjudicationLedgerService.sweepExpiredAdjudications(tournamentId);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ id: request.id, status: "FALLBACK_APPLIED", winnerSide: "BLUE" });
    expect(bundle.store.scoreLedger.get(tournamentId)).toHaveLength(1);
    expect(bundle.store.matches.get(matchId)).toMatchObject({ status: "FINISHED", winnerSide: "BLUE", finishSequence: 1 });
  });
});
