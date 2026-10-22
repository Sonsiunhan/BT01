import { describe, expect, it } from "vitest";
import {
  advanceRuleProgress,
  createInitialState,
  createRuleProgress,
  fnv1a32,
  goalPrngIndex,
  getGoalCandidates,
  getActiveGoal,
  replayRuleProgress,
  validateRuleProfile,
  type GoalProgressEvent,
  type RuleProfile,
} from "@ottv2/game-rules";

const directions = [
  { fileDelta: -1, rankDelta: -1 },
  { fileDelta: 0, rankDelta: -1 },
  { fileDelta: 1, rankDelta: -1 },
  { fileDelta: -1, rankDelta: 0 },
  { fileDelta: 1, rankDelta: 0 },
  { fileDelta: -1, rankDelta: 1 },
  { fileDelta: 0, rankDelta: 1 },
  { fileDelta: 1, rankDelta: 1 },
] as const;

const ray = { kind: "RAY" as const, directions, minDistance: 1, maxDistance: 1, canJump: false };

function profile(goals: RuleProfile["goalProfiles"]): RuleProfile {
  return {
    version: "rps-custom-v1",
    board: { rows: 5, cols: 5 },
    initialTurn: "BLUE",
    pieceCounts: { BLUE: { R: 1, P: 0, S: 0 }, RED: { R: 1, P: 0, S: 0 } },
    layout: [
      { id: "blue-r-1", side: "BLUE", type: "R", coordinate: "a3" },
      { id: "red-r-1", side: "RED", type: "R", coordinate: "e5" },
    ],
    movementProfiles: {
      BLUE: { R: [ray], P: [ray], S: [ray] },
      RED: { R: [ray], P: [ray], S: [ray] },
    },
    winConditions: ["GOAL_REACHED"],
    goalProfiles: goals,
    seedContext: { seed: 17, matchKey: "n03-q18", policyVersion: "goal-prng-v1" },
  };
}

describe("N03 goal scheduling and replay", () => {
  it("pins FNV-1a32 to UTF-8 bytes for non-ASCII domain values", () => {
    expect(fnv1a32("é")).toBe(513665217);
  });

  it("uses CYCLE index 0, advances on full rounds and wraps without auto-win", () => {
    const ruleProfile = profile({
      BLUE: { mode: "CYCLE", cells: ["c3", "e3", "a3"], roundInterval: 1 },
      RED: { mode: "STATIC", cell: "a5" },
    });
    const initial = createInitialState({ profile: ruleProfile });
    expect(initial.status).toBe("PLAYING");
    expect(initial.winner).toBeNull();
    expect(initial.progress?.activeGoalBySide.BLUE).toBe("c3");

    const progress1 = advanceRuleProgress(ruleProfile, initial.progress!);
    expect(progress1.roundIndex).toBe(0);
    const progress2 = advanceRuleProgress(ruleProfile, progress1);
    expect(progress2.roundIndex).toBe(1);
    expect(progress2.activeGoalBySide.BLUE).toBe("e3");
    const progress6 = Array.from({ length: 4 }).reduce(
      (current) => advanceRuleProgress(ruleProfile, current),
      progress2,
    );
    expect(progress6.roundIndex).toBe(3);
    expect(progress6.activeGoalBySide.BLUE).toBe("c3");
  });

  it("filters own initial cells before SEEDED sampling and replays the same public sequence", () => {
    const ruleProfile = profile({
      BLUE: { mode: "SEEDED", candidateCells: ["a3", "b3", "c3"], roundInterval: 1, policyVersion: "goal-prng-v1" },
      RED: { mode: "SEEDED", candidateCells: ["a1", "b1"], roundInterval: 2, policyVersion: "goal-prng-v1" },
    });
    expect(getGoalCandidates(ruleProfile, "BLUE")).toEqual(["b3", "c3"]);
    const first = createRuleProgress(ruleProfile);
    const second = createRuleProgress(ruleProfile);
    expect(first).toEqual(second);
    expect(first.activeGoalBySide.BLUE).not.toBe("a3");
    expect(goalPrngIndex({ seed: 17, matchKey: "n03-q18", policyVersion: "goal-prng-v1" }, "BLUE", "goal", 0, 2)).toBe(0);
    expect(goalPrngIndex({ seed: 17, matchKey: "n03-q18", policyVersion: "goal-prng-v1" }, "RED", "goal", 0, 2)).toBe(1);
    expect(goalPrngIndex({ seed: 17, matchKey: "n03-q18", policyVersion: "goal-prng-v1" }, "BLUE", "other", 0, 2)).toBe(1);
    expect(getActiveGoal(ruleProfile, "BLUE", first)).toBe(first.activeGoalBySide.BLUE);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.activeGoalBySide)).toBe(true);
    expect(Object.isFrozen(first.seedContext)).toBe(true);

    const events: readonly GoalProgressEvent[] = [
      { type: "ACCEPTED_MOVE", side: "BLUE" },
      { type: "PAUSED" },
      { type: "REJECTED_MOVE", side: "RED" },
      { type: "RESUMED" },
      { type: "ACCEPTED_MOVE", side: "RED" },
    ];
    const replayed = replayRuleProgress(ruleProfile, events);
    expect(replayed.acceptedPlies).toBe(2);
    expect(replayed.roundIndex).toBe(1);
    expect(replayed.activeGoalBySide).toEqual(advanceRuleProgress(ruleProfile, advanceRuleProgress(ruleProfile, first)).activeGoalBySide);
    expect(first.acceptedPlies).toBe(0);
  });

  it("allows repeated and one-cell SEEDED candidates but rejects an empty filtered set", () => {
    const repeated = profile({
      BLUE: { mode: "SEEDED", candidateCells: ["b3", "b3"], roundInterval: 1, policyVersion: "goal-prng-v1" },
      RED: { mode: "STATIC", cell: "a5" },
    });
    expect(getGoalCandidates(repeated, "BLUE")).toEqual(["b3", "b3"]);
    const oneCell = profile({
      BLUE: { mode: "SEEDED", candidateCells: ["b3"], roundInterval: 1, policyVersion: "goal-prng-v1" },
      RED: { mode: "STATIC", cell: "a5" },
    });
    expect(createRuleProgress(oneCell).activeGoalBySide.BLUE).toBe("b3");
    const empty = profile({
      BLUE: { mode: "SEEDED", candidateCells: ["a3"], roundInterval: 1, policyVersion: "goal-prng-v1" },
      RED: { mode: "STATIC", cell: "a5" },
    });
    expect(validateRuleProfile(empty).map((issue) => issue.code)).toContain("SEEDED_GOAL_EMPTY_AFTER_FILTER");
  });
});
