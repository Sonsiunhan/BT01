import { describe, expect, it } from "vitest";
import {
  createInitialState,
  getLegalMoves,
  hasBasicGoalReachability,
  validateRuleProfileForPreview,
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

const ray = { kind: "RAY" as const, directions, minDistance: 1, maxDistance: 2, canJump: false };

function profile(): RuleProfile {
  return {
    version: "rps-custom-v1",
    directionSystem: "ABSOLUTE",
    board: { rows: 5, cols: 15 },
    initialTurn: "BLUE",
    pieceCounts: {
      BLUE: { R: 1, P: 0, S: 0 },
      RED: { R: 1, P: 0, S: 0 },
    },
    layout: [
      { id: "blue-r-1", side: "BLUE", type: "R", coordinate: "n5" },
      { id: "red-r-1", side: "RED", type: "R", coordinate: "b1" },
    ],
    movementProfiles: {
      BLUE: { R: [ray], P: [ray], S: [ray] },
      RED: { R: [ray], P: [ray], S: [ray] },
    },
    winConditions: ["GOAL_REACHED"],
    goalProfiles: {
      BLUE: { mode: "STATIC", cell: "o5" },
      RED: { mode: "STATIC", cell: "a1" },
    },
  };
}

describe("N02 game-rules preview harness", () => {
  it("exposes strict preview validation and rejects unsupported ray distance", () => {
    const invalid = {
      ...profile(),
      movementProfiles: {
        ...profile().movementProfiles,
        BLUE: { ...profile().movementProfiles.BLUE, R: [{ ...ray, maxDistance: 3 }] },
      },
    };
    expect(validateRuleProfileForPreview(invalid)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "RAY_DISTANCE_CAP_EXCEEDED" }),
      ]),
    );
  });

  it("returns deterministic legal moves for both sides and basic goal reachability", () => {
    const state = createInitialState({ profile: profile() });
    expect(getLegalMoves(state, "BLUE")).toContainEqual({ side: "BLUE", from: "n5", to: "o5" });
    expect(getLegalMoves(state, "RED")).toContainEqual({ side: "RED", from: "b1", to: "a1" });
    expect(hasBasicGoalReachability(profile(), "BLUE")).toBe(true);
    expect(hasBasicGoalReachability(profile(), "RED")).toBe(true);
  });
});
