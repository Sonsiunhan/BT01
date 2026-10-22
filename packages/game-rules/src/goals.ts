import { isCoordinateInBoard } from "./coordinates.js";
import type {
  Coordinate,
  GoalProgressEvent,
  GoalProfile,
  GoalSeedContext,
  RuleProfile,
  RuleEventOrderInput,
  RuleEventOrderResult,
  RuleProgress,
  Side,
} from "./types.js";

export const GOAL_PRNG_POLICY_VERSION = "goal-prng-v1" as const;

const SIDES: readonly Side[] = ["BLUE", "RED"];
const UINT32_RANGE = 0x1_0000_0000;

function utf8Bytes(value: string): readonly number[] {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    let codePoint = value.charCodeAt(index);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      const low = value.charCodeAt(index + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (low - 0xdc00);
        index += 1;
      } else {
        codePoint = 0xfffd;
      }
    } else if (codePoint >= 0xdc00 && codePoint <= 0xdfff) {
      codePoint = 0xfffd;
    }
    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(0xf0 | (codePoint >> 18), 0x80 | ((codePoint >> 12) & 0x3f), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    }
  }
  return bytes;
}

function assertUnsigned32(value: number): number {
  return (value >>> 0);
}

export function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (const byte of utf8Bytes(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return assertUnsigned32(hash);
}

export function xorshift32(value: number): number {
  let state = assertUnsigned32(value) || 0x6d2b79f5;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return assertUnsigned32(state);
}

export function goalPrngIndex(
  context: GoalSeedContext,
  side: Side,
  purpose: string,
  roundSlot: number,
  candidateCount: number,
): number {
  if (context.policyVersion !== GOAL_PRNG_POLICY_VERSION) throw new Error("UNSUPPORTED_GOAL_POLICY");
  if (!Number.isInteger(roundSlot) || roundSlot < 0) throw new Error("INVALID_ROUND_SLOT");
  if (!Number.isInteger(candidateCount) || candidateCount <= 0) throw new Error("INVALID_CANDIDATE_COUNT");
  const domain = [context.policyVersion, context.matchKey, String(context.seed >>> 0), side, purpose, String(roundSlot)].join("|");
  const acceptanceLimit = Math.floor(UINT32_RANGE / candidateCount) * candidateCount;
  let random = xorshift32(fnv1a32(domain));
  while (random >= acceptanceLimit) random = xorshift32(random);
  return random % candidateCount;
}

function ownOccupiedCells(profile: RuleProfile, side: Side): ReadonlySet<Coordinate> {
  return new Set(profile.layout.filter((entry) => entry.side === side).map((entry) => entry.coordinate));
}

export function getGoalCandidates(profile: RuleProfile, side: Side): readonly Coordinate[] {
  const goal = profile.goalProfiles?.[side];
  if (goal === undefined) return [];
  if (goal.mode === "STATIC") return [goal.cell];
  if (goal.mode === "CYCLE") return [...goal.cells];
  const occupied = ownOccupiedCells(profile, side);
  return goal.candidateCells.filter((cell) => !occupied.has(cell));
}

function cycleSlot(roundIndex: number, interval: number): number {
  return Math.floor(roundIndex / interval);
}

export function getActiveGoal(
  profile: RuleProfile,
  side: Side,
  progress: Pick<RuleProgress, "roundIndex" | "seedContext"> = { roundIndex: 0, seedContext: profile.seedContext ?? null },
): Coordinate | null {
  const goal = profile.goalProfiles?.[side];
  if (goal === undefined) return null;
  if (goal.mode === "STATIC") return goal.cell;
  const candidates = getGoalCandidates(profile, side);
  if (candidates.length === 0) return null;
  const slot = cycleSlot(progress.roundIndex, goal.roundInterval);
  if (goal.mode === "CYCLE") return candidates[slot % candidates.length] ?? null;
  if (progress.seedContext === null) return null;
  return candidates[goalPrngIndex(progress.seedContext, side, "goal", slot, candidates.length)] ?? null;
}

export function createRuleProgress(profile: RuleProfile, seedContext = profile.seedContext ?? null, acceptedPlies = 0): RuleProgress {
  if (!Number.isInteger(acceptedPlies) || acceptedPlies < 0) throw new Error("INVALID_ACCEPTED_PLIES");
  const progress: RuleProgress = {
    acceptedPlies,
    roundIndex: Math.floor(acceptedPlies / 2),
    activeGoalBySide: {
      BLUE: getActiveGoal(profile, "BLUE", { roundIndex: Math.floor(acceptedPlies / 2), seedContext }),
      RED: getActiveGoal(profile, "RED", { roundIndex: Math.floor(acceptedPlies / 2), seedContext }),
    },
    seedContext,
  };
  return Object.freeze({
    ...progress,
    activeGoalBySide: Object.freeze({ ...progress.activeGoalBySide }),
    ...(seedContext === null ? {} : { seedContext: Object.freeze({ ...seedContext }) }),
  });
}

export function advanceRuleProgress(profile: RuleProfile, progress: RuleProgress): RuleProgress {
  return createRuleProgress(profile, progress.seedContext, progress.acceptedPlies + 1);
}

/** Restarting before any accepted ply reproduces the initial public schedule. */
export function restartRuleProgress(profile: RuleProfile, seedContext = profile.seedContext ?? null): RuleProgress {
  return createRuleProgress(profile, seedContext, 0);
}

export function replayRuleProgress(
  profile: RuleProfile,
  events: readonly GoalProgressEvent[],
  seedContext = profile.seedContext ?? null,
): RuleProgress {
  return events.reduce(
    (progress, event) => event.type === "ACCEPTED_MOVE" ? advanceRuleProgress(profile, progress) : progress,
    createRuleProgress(profile, seedContext),
  );
}

/** Replay only new committed events from an authoritative progress snapshot. */
export function replayRuleProgressFromCommitted(
  profile: RuleProfile,
  committedProgress: RuleProgress,
  events: readonly GoalProgressEvent[],
): RuleProgress {
  return events.reduce(
    (progress, event) => event.type === "ACCEPTED_MOVE" ? advanceRuleProgress(profile, progress) : progress,
    committedProgress,
  );
}

/**
 * Resolve the canonical boundary precedence without mutating a match state.
 * Lifecycle code owns clocks, commits and persistence; it can use this seam
 * after it has collected the authoritative facts for one command boundary.
 */
export function resolveRuleEventOrder(input: RuleEventOrderInput): RuleEventOrderResult {
  if (input.terminal) {
    return { kind: "TERMINAL_LOCKED", committed: false, winner: input.terminalWinner };
  }
  if (input.deadlineExpired) {
    return { kind: "REJECTED_DEADLINE", committed: false, winner: null };
  }
  if (input.naturalWinner !== null) {
    return { kind: "NATURAL_WIN", committed: true, winner: input.naturalWinner };
  }
  if (input.plyLimitReached) {
    return { kind: "PLY_LIMIT", committed: true, winner: null };
  }
  if (input.goalTickWinner !== null) {
    return { kind: "GOAL_TICK", committed: true, winner: input.goalTickWinner };
  }
  return { kind: "CONTINUE", committed: true, winner: null };
}

export function validateGoalProfile(profile: RuleProfile, side: Side): readonly { code: string; path: string; message: string }[] {
  const goal = profile.goalProfiles?.[side];
  if (goal === undefined) return [];
  const issues: { code: string; path: string; message: string }[] = [];
  const path = `goalProfiles.${side}`;
  const cells = goal.mode === "STATIC" ? [goal.cell] : goal.mode === "CYCLE" ? goal.cells : goal.candidateCells;
  if (goal.mode !== "STATIC" && (goal.roundInterval < 1 || !Number.isInteger(goal.roundInterval))) {
    issues.push({ code: "GOAL_INTERVAL_INVALID", path: `${path}.roundInterval`, message: "roundInterval phải là số nguyên dương." });
  }
  if (goal.mode !== "STATIC" && cells.length === 0) {
    issues.push({ code: "GOAL_CELLS_EMPTY", path: `${path}.${goal.mode === "CYCLE" ? "cells" : "candidateCells"}`, message: "Danh sách ô đích không được rỗng." });
  }
  const seen = new Set<string>();
  for (const [index, cell] of cells.entries()) {
    if (!isCoordinateInBoard(profile.board, cell)) issues.push({ code: "GOAL_OUT_OF_BOUNDS", path: `${path}.${goal.mode === "STATIC" ? "cell" : goal.mode === "CYCLE" ? "cells" : "candidateCells"}[${index}]`, message: "Ô đích phải nằm trong board profile." });
    if (seen.has(cell) && goal.mode === "CYCLE") issues.push({ code: "DUPLICATE_GOAL_CELL", path: `${path}[${index}]`, message: "Danh sách ô đích theo chu kỳ không được lặp ô." });
    seen.add(cell);
  }
  if (goal.mode === "CYCLE" && profile.winConditions?.includes("GOAL_REACHED") && goal.cells[0] !== undefined && profile.layout.some((entry) => entry.side === side && entry.coordinate === goal.cells[0])) {
    issues.push({ code: "INITIAL_OWN_GOAL", path: `${path}.cells[0]`, message: "Ô chu kỳ đầu tiên không được bị quân own chiếm ban đầu." });
  }
  if (goal.mode === "SEEDED" && goal.policyVersion !== GOAL_PRNG_POLICY_VERSION) {
    issues.push({ code: "UNSUPPORTED_GOAL_POLICY", path: `${path}.policyVersion`, message: "Policy seed chưa được đăng ký." });
  }
  if (goal.mode === "SEEDED" && (profile.seedContext === undefined || profile.seedContext.policyVersion !== goal.policyVersion)) {
    issues.push({ code: "MISSING_SEED_CONTEXT", path: "seedContext", message: "SEEDED cần seed context công khai khớp policy version." });
  }
  if (goal.mode === "SEEDED" && getGoalCandidates(profile, side).length === 0) {
    issues.push({ code: "SEEDED_GOAL_EMPTY_AFTER_FILTER", path: `${path}.candidateCells`, message: "SEEDED không còn candidate sau khi lọc ô own ban đầu." });
  }
  return issues;
}

export function goalProfilesHaveProgress(profile: RuleProfile): boolean {
  return SIDES.some((side) => profile.goalProfiles?.[side]?.mode === "CYCLE" || profile.goalProfiles?.[side]?.mode === "SEEDED");
}
