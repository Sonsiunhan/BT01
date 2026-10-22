import { describe, expect, it } from "vitest";
import { applyMove, createInitialState, createRuleProgress, replayRuleProgress, replayRuleProgressFromCommitted, resolveRuleEventOrder, restartRuleProgress, type Coordinate, type GoalProgressEvent, type RuleProfile } from "@ottv2/game-rules";

const ray = {
  kind: "RAY" as const,
  directions: [
    { fileDelta: -1, rankDelta: 0 },
    { fileDelta: 1, rankDelta: 0 },
    { fileDelta: 0, rankDelta: -1 },
    { fileDelta: 0, rankDelta: 1 },
  ],
  minDistance: 1,
  maxDistance: 1,
  canJump: false,
};

function cycleProfile(cells: readonly Coordinate[] = ["c3", "b3"]): RuleProfile {
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
    goalProfiles: {
      BLUE: { mode: "CYCLE", cells, roundInterval: 1 },
      RED: { mode: "STATIC", cell: "a5" },
    },
    seedContext: { seed: 17, matchKey: "n03-q17", policyVersion: "goal-prng-v1" },
  };
}

function seededProfile(): RuleProfile {
  const profile = cycleProfile();
  return {
    ...profile,
    goalProfiles: {
      BLUE: { mode: "SEEDED", candidateCells: ["a3", "b3", "c3"], roundInterval: 1, policyVersion: "goal-prng-v1" },
      RED: { mode: "SEEDED", candidateCells: ["a5", "b5"], roundInterval: 1, policyVersion: "goal-prng-v1" },
    },
    seedContext: { seed: 17, matchKey: "n03-q18", policyVersion: "goal-prng-v1" },
  };
}

describe("N03 Q17/Q18 fixtures", () => {
  it("Q17: goal tick onto occupied cell does not capture or auto-win", () => {
    const initial = createInitialState({ profile: cycleProfile() });
    expect(initial.status).toBe("PLAYING");
    expect(initial.board.a3).toMatchObject({ id: "blue-r-1" });
    expect(initial.progress?.activeGoalBySide.BLUE).toBe("c3");
    const blue = applyMove(initial, { side: "BLUE", from: "a3", to: "b3" });
    expect(blue.kind).toBe("accepted");
    if (blue.kind !== "accepted") return;
    const red = applyMove(blue.state, { side: "RED", from: "e5", to: "d5" });
    expect(red.kind).toBe("accepted");
    if (red.kind !== "accepted") return;
    expect(red.state.progress?.roundIndex).toBe(1);
    expect(red.state.progress?.activeGoalBySide.BLUE).toBe("b3");
    expect(red.state.status).toBe("PLAYING");
    expect(red.state.board.b3).toMatchObject({ id: "blue-r-1" });
    expect(resolveRuleEventOrder({
      terminal: false,
      terminalWinner: null,
      deadlineExpired: false,
      naturalWinner: null,
      plyLimitReached: false,
      goalTickWinner: null,
    })).toEqual({ kind: "CONTINUE", committed: true, winner: null });
  });

  it("Q18: replay ignores pause/rejection and preserves public seeded schedule", () => {
    const profile = seededProfile();
    const first = createInitialState({ profile });
    const second = createInitialState({ profile });
    expect(first.progress).toEqual(second.progress);
    expect(first.progress?.acceptedPlies).toBe(0);
    expect(first.progress?.activeGoalBySide.BLUE).not.toBe("a3");
    const rejected = applyMove(first, { side: "RED", from: "e5", to: "d5" });
    expect(rejected.kind).toBe("rejected");
    expect(rejected.state).toBe(first);
    expect(first.progress?.acceptedPlies).toBe(0);
    const events: readonly GoalProgressEvent[] = [
      { type: "ACCEPTED_MOVE", side: "BLUE" },
      { type: "PAUSED" },
      { type: "REJECTED_MOVE", side: "RED" },
      { type: "RESUMED" },
      { type: "WALL_TIME", durationMs: 2_000 },
      { type: "QUEUE_TIME", durationMs: 500 },
      { type: "ACCEPTED_MOVE", side: "RED" },
    ];
    const replayed = replayRuleProgress(profile, events);
    expect(replayed.acceptedPlies).toBe(2);
    expect(replayed.roundIndex).toBe(1);
    expect(replayed.activeGoalBySide).toEqual(replayRuleProgress(profile, [
      { type: "ACCEPTED_MOVE", side: "BLUE" },
      { type: "ACCEPTED_MOVE", side: "RED" },
    ]).activeGoalBySide);
    expect(restartRuleProgress(profile)).toEqual(createRuleProgress(profile));
  });

  it("dynamic goals use the current goal and do not award a stale previous goal", () => {
    const initial = createInitialState({ profile: cycleProfile(["b3", "c3"]) });
    const reached = applyMove(initial, { side: "BLUE", from: "a3", to: "b3" });
    expect(reached.kind).toBe("accepted");
    if (reached.kind !== "accepted") return;
    expect(reached.state.status).toBe("FINISHED");
    expect(reached.state.resultReason).toBe("GOAL_REACHED");

    const first = applyMove(createInitialState({ profile: cycleProfile() }), { side: "BLUE", from: "a3", to: "b3" });
    expect(first.kind).toBe("accepted");
    if (first.kind !== "accepted") return;
    const second = applyMove(first.state, { side: "RED", from: "e5", to: "d5" });
    expect(second.kind).toBe("accepted");
    if (second.kind !== "accepted") return;
    expect(second.state.status).toBe("PLAYING");
    expect(second.state.progress?.activeGoalBySide.BLUE).toBe("b3");
  });

  it("dynamic goal fields have no win effect when GOAL_REACHED is disabled", () => {
    const profile: RuleProfile = { ...cycleProfile(), winConditions: [] };
    const result = applyMove(createInitialState({ profile }), { side: "BLUE", from: "a3", to: "b3" });
    expect(result.kind).toBe("accepted");
    if (result.kind !== "accepted") return;
    expect(result.state.status).toBe("PLAYING");
    expect(result.state.winner).toBeNull();
  });

  it("progress is independent of which side takes the first ply", () => {
    const profile: RuleProfile = { ...cycleProfile(), initialTurn: "RED" };
    const initial = createInitialState({ profile });
    const red = applyMove(initial, { side: "RED", from: "e5", to: "d5" });
    expect(red.kind).toBe("accepted");
    if (red.kind !== "accepted") return;
    expect(red.state.progress?.acceptedPlies).toBe(1);
    expect(red.state.progress?.roundIndex).toBe(0);
    const blue = applyMove(red.state, { side: "BLUE", from: "a3", to: "b3" });
    expect(blue.kind).toBe("accepted");
    if (blue.kind !== "accepted") return;
    expect(blue.state.progress?.acceptedPlies).toBe(2);
    expect(blue.state.progress?.roundIndex).toBe(1);
  });

  it("committed progress stays mid-round when hard compute stops before another accepted ply", () => {
    const profile = cycleProfile();
    const committed = createRuleProgress(profile, profile.seedContext, 1);
    const stopped = replayRuleProgressFromCommitted(profile, committed, []);
    expect(stopped).toEqual(committed);
    expect(stopped.acceptedPlies).toBe(1);
    expect(stopped.roundIndex).toBe(0);
    const continued = replayRuleProgressFromCommitted(profile, committed, [{ type: "ACCEPTED_MOVE", side: "RED" }]);
    expect(continued.acceptedPlies).toBe(2);
    expect(continued.roundIndex).toBe(1);
  });

  it("event order: late command rejects first, then natural win, ply limit, and goal tick", () => {
    expect(resolveRuleEventOrder({
      terminal: false,
      terminalWinner: null,
      deadlineExpired: true,
      naturalWinner: "BLUE",
      plyLimitReached: true,
      goalTickWinner: "RED",
    })).toEqual({ kind: "REJECTED_DEADLINE", committed: false, winner: null });

    expect(resolveRuleEventOrder({
      terminal: false,
      terminalWinner: null,
      deadlineExpired: false,
      naturalWinner: "BLUE",
      plyLimitReached: true,
      goalTickWinner: "RED",
    })).toEqual({ kind: "NATURAL_WIN", committed: true, winner: "BLUE" });

    expect(resolveRuleEventOrder({
      terminal: false,
      terminalWinner: null,
      deadlineExpired: false,
      naturalWinner: null,
      plyLimitReached: true,
      goalTickWinner: "RED",
    })).toEqual({ kind: "PLY_LIMIT", committed: true, winner: null });

    expect(resolveRuleEventOrder({
      terminal: false,
      terminalWinner: null,
      deadlineExpired: false,
      naturalWinner: null,
      plyLimitReached: false,
      goalTickWinner: "RED",
    })).toEqual({ kind: "GOAL_TICK", committed: true, winner: "RED" });
  });

  it("event order: a terminal snapshot cannot be overwritten by later signals", () => {
    expect(resolveRuleEventOrder({
      terminal: true,
      terminalWinner: "BLUE",
      deadlineExpired: true,
      naturalWinner: "RED",
      plyLimitReached: true,
      goalTickWinner: "RED",
    })).toEqual({ kind: "TERMINAL_LOCKED", committed: false, winner: "BLUE" });
  });
});
