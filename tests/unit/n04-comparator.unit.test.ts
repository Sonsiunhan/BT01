import { describe, expect, it } from "vitest";
import {
  compareTournamentOutcome,
  compareRuleStateOutcome,
  deriveTournamentComparatorMetrics,
  getLegalMoves,
  type ComparatorPolicy,
  type RuleProfile,
  type RuleState,
  type TournamentComparatorInput,
} from "@ottv2/game-rules";

const policy: ComparatorPolicy = {
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
  finalTiePolicy: "SECOND_MOVER_WINS",
  manual: { timeoutSeconds: 300, fallback: "SECOND_MOVER_WINS" },
};

function input(overrides: Partial<TournamentComparatorInput> = {}): TournamentComparatorInput {
  return {
    policy,
    firstMoverSide: "BLUE",
    metrics: {
      BLUE: { materialByType: { R: 1, P: 1, S: 1 }, goalDistance: { reachable: true, distance: 4 }, mobility: 6 },
      RED: { materialByType: { R: 1, P: 1, S: 1 }, goalDistance: { reachable: true, distance: 4 }, mobility: 6 },
    },
    event: null,
    ...overrides,
  };
}

describe("N04 comparator", () => {
  it("uses weighted material before later criteria", () => {
    const result = compareTournamentOutcome(input({
      metrics: {
        BLUE: { materialByType: { R: 2, P: 1, S: 1 }, goalDistance: { reachable: true, distance: 9 }, mobility: 1 },
        RED: { materialByType: { R: 1, P: 1, S: 1 }, goalDistance: { reachable: true, distance: 1 }, mobility: 99 },
      },
    }));
    expect(result).toMatchObject({ winnerSide: "BLUE", decidedBy: "WEIGHTED_MATERIAL" });
  });

  it("treats reachable goal as better than unreachable and lower distance as better", () => {
    const result = compareTournamentOutcome(input({
      metrics: {
        BLUE: { materialByType: { R: 1, P: 1, S: 1 }, goalDistance: { reachable: false, distance: null }, mobility: 99 },
        RED: { materialByType: { R: 1, P: 1, S: 1 }, goalDistance: { reachable: true, distance: 8 }, mobility: 1 },
      },
    }));
    expect(result).toMatchObject({ winnerSide: "RED", decidedBy: "GOAL_DISTANCE" });
  });

  it("uses the actual second mover policy on an exact tie", () => {
    const result = compareTournamentOutcome(input({ firstMoverSide: "RED" }));
    expect(result).toMatchObject({ winnerSide: "BLUE", decidedBy: "FINAL_TIE_POLICY", manualRequired: false });
  });

  it("does not invent a winner for an infrastructure event", () => {
    const result = compareTournamentOutcome(input({ event: { kind: "INFRASTRUCTURE_FAILURE" } }));
    expect(result).toMatchObject({ winnerSide: null, reasonCode: "INFRASTRUCTURE_NEUTRAL" });
  });

  it("applies explicit no-legal-move win/loss/draw policy before criteria", () => {
    expect(compareTournamentOutcome(input({ event: { kind: "NO_LEGAL_MOVE", side: "BLUE" }, policy: { ...policy, eventPolicies: { ...policy.eventPolicies, noLegalMove: "WIN" } } })).winnerSide).toBe("BLUE");
    expect(compareTournamentOutcome(input({ event: { kind: "NO_LEGAL_MOVE", side: "BLUE" }, policy: { ...policy, eventPolicies: { ...policy.eventPolicies, noLegalMove: "LOSS" } } })).winnerSide).toBe("RED");
    expect(compareTournamentOutcome(input({ event: { kind: "NO_LEGAL_MOVE", side: "BLUE" }, policy: { ...policy, eventPolicies: { ...policy.eventPolicies, noLegalMove: "DRAW" } } })).winnerSide).toBeNull();
    expect(() => compareTournamentOutcome(input({ policy: { ...policy, drawEnabled: false, eventPolicies: { ...policy.eventPolicies, noLegalMove: "DRAW" } } }))).toThrow(/drawEnabled/i);
  });

  it("requires manual authority for MANUAL exact tie and does not mutate inputs", () => {
    const metrics = input().metrics;
    const result = compareTournamentOutcome(input({ policy: { ...policy, finalTiePolicy: "MANUAL" } }));
    expect(result).toMatchObject({ winnerSide: null, reasonCode: "MANUAL_EXACT_TIE", manualRequired: true });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(metrics.BLUE)).toBe(false);
  });

  it("rejects unreachable metrics that carry a fake distance", () => {
    expect(() => compareTournamentOutcome(input({ metrics: {
      BLUE: { ...input().metrics.BLUE, goalDistance: { reachable: false, distance: 2 } },
      RED: input().metrics.RED,
    } }))).toThrow(/unreachable/i);
  });

  it("allows MANUAL exact-tie while drawEnabled is false", () => {
    const result = compareTournamentOutcome(input({
      policy: { ...policy, drawEnabled: false, finalTiePolicy: "MANUAL" },
    }));
    expect(result).toMatchObject({ winnerSide: null, reasonCode: "MANUAL_EXACT_TIE", manualRequired: true });
    expect(() => compareTournamentOutcome(input({
      policy: { ...policy, drawEnabled: false, finalTiePolicy: "MANUAL", manual: { ...policy.manual, fallback: "DRAW" } },
    }))).toThrow(/fallback DRAW/i);
  });

  it("rejects all-zero material weights even when later criteria are enabled", () => {
    expect(() => compareTournamentOutcome(input({
      policy: { ...policy, materialWeights: { R: 0, P: 0, S: 0 } },
    }))).toThrow(/trọng số/i);
  });

  it("derives goal distance and mobility from the authoritative rule state", () => {
    const movement = {
      R: [{ kind: "RAY" as const, directions: [{ fileDelta: 1, rankDelta: 0 }, { fileDelta: -1, rankDelta: 0 }, { fileDelta: 0, rankDelta: 1 }, { fileDelta: 0, rankDelta: -1 }], minDistance: 1, maxDistance: 2, canJump: true }],
      P: [],
      S: [],
    };
    const profile: RuleProfile = {
      version: "rps-custom-v1",
      board: { rows: 3, cols: 3 },
      pieceCounts: { BLUE: { R: 1, P: 0, S: 0 }, RED: { R: 1, P: 0, S: 0 } },
      layout: [
        { id: "blue-r", side: "BLUE", type: "R", coordinate: "a1" },
        { id: "red-r", side: "RED", type: "R", coordinate: "c3" },
      ],
      movementProfiles: { BLUE: movement, RED: movement },
      goalProfiles: { BLUE: { mode: "STATIC", cell: "c1" }, RED: { mode: "STATIC", cell: "a3" } },
      winConditions: ["GOAL_REACHED"],
    };
    const state: RuleState = {
      board: {
        a1: { id: "blue-r", side: "BLUE", type: "R" },
        b1: null, c1: null,
        a2: null, b2: null, c2: null,
        a3: null, b3: null,
        c3: { id: "red-r", side: "RED", type: "R" },
      },
      pieceCounts: profile.pieceCounts,
      currentTurn: "BLUE",
      status: "PLAYING",
      winner: null,
      resultReason: null,
      ruleProfile: profile,
    };
    const metrics = deriveTournamentComparatorMetrics(state);
    expect(metrics.BLUE.goalDistance).toEqual({ reachable: true, distance: 1 });
    expect(metrics.RED.goalDistance).toEqual({ reachable: true, distance: 1 });
    expect(metrics.BLUE.mobility).toBe(getLegalMoves(state, "BLUE").length);
    expect(metrics.RED.mobility).toBe(getLegalMoves(state, "RED").length);
    expect(compareRuleStateOutcome(state, policy, "BLUE").metrics).toEqual(metrics);
  });

  it("keeps goal-distance search separated by piece type on multi-piece states", () => {
    const profile: RuleProfile = {
      version: "rps-custom-v1",
      board: { rows: 3, cols: 3 },
      pieceCounts: { BLUE: { R: 1, P: 1, S: 0 }, RED: { R: 0, P: 0, S: 0 } },
      layout: [
        { id: "blue-r", side: "BLUE", type: "R", coordinate: "a1" },
        { id: "blue-p", side: "BLUE", type: "P", coordinate: "a2" },
      ],
      movementProfiles: {
        BLUE: {
          R: [{ kind: "LEAP", offsets: [{ fileDelta: 1, rankDelta: 0 }] }],
          P: [{ kind: "LEAP", offsets: [{ fileDelta: 0, rankDelta: 1 }] }],
          S: [],
        },
        RED: { R: [], P: [], S: [] },
      },
      goalProfiles: { BLUE: { mode: "STATIC", cell: "c1" } },
      winConditions: ["GOAL_REACHED"],
    };
    const state: RuleState = {
      board: {
        a1: { id: "blue-r", side: "BLUE", type: "R" }, b1: null, c1: null,
        a2: { id: "blue-p", side: "BLUE", type: "P" }, b2: null, c2: null,
        a3: null, b3: null, c3: null,
      },
      pieceCounts: profile.pieceCounts,
      currentTurn: "BLUE",
      status: "PLAYING",
      winner: null,
      resultReason: null,
      ruleProfile: profile,
    };
    expect(deriveTournamentComparatorMetrics(state).BLUE.goalDistance).toEqual({ reachable: true, distance: 2 });
  });
});
