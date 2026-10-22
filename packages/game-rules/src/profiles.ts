import type {
  DirectionVector,
  MovementPattern,
  MovementProfiles,
  PieceCounts,
  RuleProfile,
} from "./types.js";

export const MIN_BOARD_DIMENSION = 5;
export const MAX_BOARD_DIMENSION = 15;
export const MAX_MOVEMENT_PATTERNS_PER_TYPE = 16;
export const MAX_LEAP_OFFSETS_PER_PROFILE = 225;
/** Tournament preview policy cap; legacy engine profiles keep their old range. */
export const MAX_RAY_DISTANCE_FOR_PREVIEW = 2;

/** The order is part of the deterministic legal-move contract. */
export const ALL_DIRECTIONS: readonly DirectionVector[] = Object.freeze([
  { fileDelta: -1, rankDelta: -1 },
  { fileDelta: 0, rankDelta: -1 },
  { fileDelta: 1, rankDelta: -1 },
  { fileDelta: -1, rankDelta: 0 },
  { fileDelta: 1, rankDelta: 0 },
  { fileDelta: -1, rankDelta: 1 },
  { fileDelta: 0, rankDelta: 1 },
  { fileDelta: 1, rankDelta: 1 },
]);

const LEGACY_RAY: MovementPattern = Object.freeze({
  kind: "RAY" as const,
  directions: ALL_DIRECTIONS,
  minDistance: 1,
  maxDistance: 1,
  canJump: false,
});

export function createDefaultMovementProfiles(): MovementProfiles {
  return {
    BLUE: { R: [LEGACY_RAY], P: [LEGACY_RAY], S: [LEGACY_RAY] },
    RED: { R: [LEGACY_RAY], P: [LEGACY_RAY], S: [LEGACY_RAY] },
  };
}

const LEGACY_COUNTS: PieceCounts = Object.freeze({
  BLUE: Object.freeze({ R: 3, P: 3, S: 3 }),
  RED: Object.freeze({ R: 3, P: 3, S: 3 }),
});

/** Fallback used by old fixtures that construct a RuleState without a profile. */
export const LEGACY_RULE_PROFILE: RuleProfile = Object.freeze({
  version: "rps-v1",
  board: Object.freeze({ rows: 9, cols: 9 }),
  initialTurn: "BLUE",
  pieceCounts: LEGACY_COUNTS,
  layout: [],
  movementProfiles: createDefaultMovementProfiles(),
  winConditions: ["EXTINCTION", "GOAL_REACHED"] as const,
  goalProfiles: Object.freeze({
    BLUE: Object.freeze({ mode: "STATIC" as const, cell: "i9" }),
    RED: Object.freeze({ mode: "STATIC" as const, cell: "a1" }),
  }),
});

