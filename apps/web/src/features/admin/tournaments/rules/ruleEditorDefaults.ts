import type { TournamentEngineRuleProfile, TournamentRuleProfileWidget, TournamentRuleMovementPattern } from "@ottv2/contracts";
import type { RuleEditorSide } from "./ruleEditorTypes";

type RayPattern = Extract<TournamentRuleMovementPattern, { kind: "RAY" }>;
type LeapPattern = Extract<TournamentRuleMovementPattern, { kind: "LEAP" }>;

const orthogonalRay: RayPattern = {
  kind: "RAY",
  directions: [
    { fileDelta: 1, rankDelta: 0 },
    { fileDelta: -1, rankDelta: 0 },
    { fileDelta: 0, rankDelta: 1 },
    { fileDelta: 0, rankDelta: -1 },
  ],
  minDistance: 1,
  maxDistance: 3,
  canJump: false,
};

const diagonalRay: RayPattern = {
  kind: "RAY",
  directions: [
    { fileDelta: 1, rankDelta: 1 },
    { fileDelta: 1, rankDelta: -1 },
    { fileDelta: -1, rankDelta: 1 },
    { fileDelta: -1, rankDelta: -1 },
  ],
  minDistance: 1,
  maxDistance: 3,
  canJump: false,
};

const knightLeap: LeapPattern = {
  kind: "LEAP",
  offsets: [
    { fileDelta: 1, rankDelta: 2 },
    { fileDelta: 2, rankDelta: 1 },
    { fileDelta: -1, rankDelta: 2 },
    { fileDelta: -2, rankDelta: 1 },
    { fileDelta: 1, rankDelta: -2 },
    { fileDelta: 2, rankDelta: -1 },
    { fileDelta: -1, rankDelta: -2 },
    { fileDelta: -2, rankDelta: -1 },
  ],
};

export const MOVEMENT_PRESETS = {
  ORTHOGONAL_RAY: orthogonalRay,
  DIAGONAL_RAY: diagonalRay,
  KNIGHT_LEAP: knightLeap,
} as const;

export type MovementPresetId = keyof typeof MOVEMENT_PRESETS;

function sideProfile(): TournamentEngineRuleProfile["movementProfiles"]["BLUE"] {
  return {
    R: [{ ...orthogonalRay, directions: orthogonalRay.directions.map((direction) => ({ ...direction })) }],
    P: [{ ...diagonalRay, directions: diagonalRay.directions.map((direction) => ({ ...direction })) }],
    S: [{ ...knightLeap, offsets: knightLeap.offsets.map((offset) => ({ ...offset })) }],
  };
}

function sideGoal(side: RuleEditorSide) {
  return {
    mode: "STATIC" as const,
    cell: side === "BLUE" ? "a5" : "e1",
  };
}

export function createDefaultRuleEditorValue(): TournamentRuleProfileWidget {
  return {
    schemaVersion: "tournament-rule-profile.v1",
    engineProfileVersion: "rps-engine-v1",
    baseTemplateId: "rps-canonical-v1",
    sameMovementForBothSides: false,
    profile: {
      version: "rps-custom-v1",
      directionSystem: "ABSOLUTE",
      board: { rows: 5, cols: 5 },
      initialTurn: "BLUE",
      pieceCounts: {
        BLUE: { R: 1, P: 1, S: 1 },
        RED: { R: 1, P: 1, S: 1 },
      },
      layout: [
        { id: "blue-r-1", side: "BLUE", type: "R", coordinate: "a1" },
        { id: "blue-p-1", side: "BLUE", type: "P", coordinate: "b1" },
        { id: "blue-s-1", side: "BLUE", type: "S", coordinate: "c1" },
        { id: "red-r-1", side: "RED", type: "R", coordinate: "e5" },
        { id: "red-p-1", side: "RED", type: "P", coordinate: "d5" },
        { id: "red-s-1", side: "RED", type: "S", coordinate: "c5" },
      ],
      movementProfiles: {
        BLUE: sideProfile(),
        RED: sideProfile(),
      },
      winConditions: ["EXTINCTION", "GOAL_REACHED"],
      goalProfiles: { BLUE: sideGoal("BLUE"), RED: sideGoal("RED") },
    },
  };
}
