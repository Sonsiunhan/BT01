import { getBoardCoordinates, isCoordinateInBoard } from "./coordinates.js";
import { createRuleProgress, goalProfilesHaveProgress, validateGoalProfile } from "./goals.js";
import {
  MAX_BOARD_DIMENSION,
  MAX_LEAP_OFFSETS_PER_PROFILE,
  MAX_MOVEMENT_PATTERNS_PER_TYPE,
  MAX_RAY_DISTANCE_FOR_PREVIEW,
  MIN_BOARD_DIMENSION,
  createDefaultMovementProfiles,
} from "./profiles.js";
import type {
  Board,
  BoardSpec,
  GoalProfile,
  LayoutEntry,
  MovementPattern,
  Piece,
  PieceCounts,
  PieceType,
  RuleProfile,
  RuleProfileValidationCode,
  RuleProfileValidationIssue,
  RuleState,
  Side,
  RulesVersion,
} from "./types.js";

type SetupEntry = readonly [coordinate: string, type: PieceType];

const LEGACY_BOARD: BoardSpec = Object.freeze({ rows: 9, cols: 9 });
const BLUE_SETUP: readonly SetupEntry[] = [
  ["b5", "P"], ["c5", "R"],
  ["b4", "S"], ["c4", "S"], ["d4", "P"],
  ["c3", "R"], ["d3", "R"], ["e3", "S"],
  ["d2", "P"],
];
const RED_SETUP: readonly SetupEntry[] = [
  ["e8", "P"], ["f8", "S"],
  ["e7", "R"], ["f7", "S"], ["g7", "R"],
  ["f6", "P"], ["g6", "R"], ["h6", "P"],
  ["g5", "S"],
];
const SIDES: readonly Side[] = ["BLUE", "RED"];
const PIECE_TYPES: readonly PieceType[] = ["R", "P", "S"];

function emptyBoard(board: BoardSpec = LEGACY_BOARD): Record<string, Piece | null> {
  return Object.fromEntries(getBoardCoordinates(board).map((coordinate) => [coordinate, null]));
}

function emptyCounts(v2 = false): Record<Side, Record<PieceType, number>> {
  const count = v2 ? 6 : 3;
  return {
    BLUE: { R: count, P: count, S: count },
    RED: { R: count, P: count, S: count },
  };
}

function placeSetup(
  board: Record<string, Piece | null>,
  side: Side,
  setup: readonly SetupEntry[],
  ordinals?: Record<PieceType, number>,
  layout?: LayoutEntry[],
): void {
  const ords = ordinals ?? { R: 0, P: 0, S: 0 };
  for (const [coordinate, type] of setup) {
    ords[type] += 1;
    const id = `${side.toLowerCase()}-${type.toLowerCase()}-${ords[type]}`;
    board[coordinate] = { id, side, type };
    layout?.push({ id, side, type, coordinate: coordinate as LayoutEntry["coordinate"] });
  }
}

const f = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880];
function combinations(r: number, p: number, s: number): number {
  if (r < 0 || p < 0 || s < 0) return 0;
  return (f[r + p + s] || 1) / ((f[r] || 1) * (f[p] || 1) * (f[s] || 1));
}

export function unrankRow(rank: number): PieceType[] {
  let r = 3, p = 3, s = 3;
  const result: PieceType[] = [];
  for (let i = 0; i < 9; i++) {
    const waysP = combinations(r, p - 1, s);
    const waysR = combinations(r - 1, p, s);
    if (rank < waysP) {
      result.push("P");
      p--;
    } else if (rank < waysP + waysR) {
      result.push("R");
      rank -= waysP;
      r--;
    } else {
      result.push("S");
      rank -= waysP + waysR;
      s--;
    }
  }
  return result;
}

export function rankRow(pieces: PieceType[]): number {
  let r = 3, p = 3, s = 3;
  let rank = 0;
  for (const piece of pieces) {
    const waysP = combinations(r, p - 1, s);
    const waysR = combinations(r - 1, p, s);
    if (piece === "P") {
      p--;
    } else if (piece === "R") {
      rank += waysP;
      r--;
    } else if (piece === "S") {
      rank += waysP + waysR;
      s--;
    }
  }
  return rank;
}

export function selectSetupSeed(row1Rank: number, row2Rank: number): number {
  return row1Rank * 1680 + row2Rank;
}

function validationIssue(code: RuleProfileValidationCode, path: string, message: string): RuleProfileValidationIssue {
  return { code, path, message };
}

function countLayout(layout: readonly LayoutEntry[]): Record<Side, Record<PieceType, number>> {
  const result: Record<Side, Record<PieceType, number>> = {
    BLUE: { R: 0, P: 0, S: 0 },
    RED: { R: 0, P: 0, S: 0 },
  };
  for (const entry of layout) result[entry.side][entry.type] += 1;
  return result;
}

function validatePattern(
  pattern: MovementPattern,
  path: string,
  issues: RuleProfileValidationIssue[],
): number {
  if (pattern.kind === "RAY") {
    if (!Number.isInteger(pattern.minDistance) || !Number.isInteger(pattern.maxDistance) || pattern.minDistance < 1 || pattern.maxDistance < pattern.minDistance) {
      issues.push(validationIssue("INVALID_DISTANCE", path, "RAY distance phải là số nguyên hữu hạn với 1 ≤ minDistance ≤ maxDistance."));
    }
    for (const [index, direction] of pattern.directions.entries()) {
      const valid = Number.isInteger(direction.fileDelta)
        && Number.isInteger(direction.rankDelta)
        && Math.abs(direction.fileDelta) <= 1
        && Math.abs(direction.rankDelta) <= 1
        && (direction.fileDelta !== 0 || direction.rankDelta !== 0);
      if (!valid) issues.push(validationIssue("INVALID_DIRECTION", `${path}.directions[${index}]`, "Direction RAY phải là vector 8 hướng khác không."));
    }
    return 0;
  }

  let offsets = 0;
  for (const [index, offset] of pattern.offsets.entries()) {
    offsets += 1;
    const valid = Number.isInteger(offset.fileDelta)
      && Number.isInteger(offset.rankDelta)
      && (offset.fileDelta !== 0 || offset.rankDelta !== 0);
    if (!valid) issues.push(validationIssue("INVALID_LEAP_OFFSET", `${path}.offsets[${index}]`, "LEAP offset phải là vector nguyên khác không."));
  }
  return offsets;
}

export function validateRuleProfile(profile: RuleProfile): readonly RuleProfileValidationIssue[] {
  const issues: RuleProfileValidationIssue[] = [];
  const board = profile.board;
  if (!Number.isInteger(board.rows) || !Number.isInteger(board.cols)) {
    issues.push(validationIssue("BOARD_DIMENSION_NOT_INTEGER", "board", "Số hàng/cột phải là số nguyên."));
  } else if (board.rows < MIN_BOARD_DIMENSION || board.rows > MAX_BOARD_DIMENSION || board.cols < MIN_BOARD_DIMENSION || board.cols > MAX_BOARD_DIMENSION) {
    issues.push(validationIssue("BOARD_DIMENSION_OUT_OF_RANGE", "board", `Mỗi chiều bàn phải nằm trong khoảng ${MIN_BOARD_DIMENSION}..${MAX_BOARD_DIMENSION}.`));
  }

  const seenCoordinates = new Set<string>();
  const seenIds = new Set<string>();
  const actualCounts = countLayout(profile.layout);
  for (const [index, entry] of profile.layout.entries()) {
    if (!isCoordinateInBoard(board, entry.coordinate)) issues.push(validationIssue("LAYOUT_OUT_OF_BOUNDS", `layout[${index}].coordinate`, "Quân phải nằm trong board profile."));
    if (seenCoordinates.has(entry.coordinate)) issues.push(validationIssue("LAYOUT_COLLISION", `layout[${index}].coordinate`, "Không được có hai quân trên cùng một ô."));
    seenCoordinates.add(entry.coordinate);
    if (seenIds.has(entry.id)) issues.push(validationIssue("LAYOUT_DUPLICATE_ID", `layout[${index}].id`, "ID quân phải duy nhất trong layout."));
    seenIds.add(entry.id);
  }

  for (const side of SIDES) {
    for (const type of PIECE_TYPES) {
      const patterns = profile.movementProfiles?.[side]?.[type];
      if (actualCounts[side][type] !== profile.pieceCounts[side][type]) {
        issues.push(validationIssue("COUNTS_MISMATCH", `pieceCounts.${side}.${type}`, "pieceCounts phải khớp layout explicit."));
      }
      if (!Array.isArray(patterns) || patterns.length === 0) {
        issues.push(validationIssue("MISSING_MOVEMENT_PROFILE", `movementProfiles.${side}.${type}`, "Mỗi side × type phải có movement profile."));
        continue;
      }
      if (patterns.length > MAX_MOVEMENT_PATTERNS_PER_TYPE) {
        issues.push(validationIssue("PATTERN_LIMIT_EXCEEDED", `movementProfiles.${side}.${type}`, `Không vượt quá ${MAX_MOVEMENT_PATTERNS_PER_TYPE} patterns.`));
      }
      patterns.forEach((pattern, patternIndex) => validatePattern(pattern, `movementProfiles.${side}.${type}[${patternIndex}]`, issues));
    }
  }

  const leapOffsets = SIDES.flatMap((side) => PIECE_TYPES.flatMap((type) => profile.movementProfiles?.[side]?.[type] ?? []))
    .filter((pattern): pattern is Extract<MovementPattern, { kind: "LEAP" }> => pattern.kind === "LEAP")
    .reduce((total, pattern) => total + pattern.offsets.length, 0);
  if (leapOffsets > MAX_LEAP_OFFSETS_PER_PROFILE) issues.push(validationIssue("LEAP_OFFSET_LIMIT_EXCEEDED", "movementProfiles", `Tổng LEAP offsets không vượt quá ${MAX_LEAP_OFFSETS_PER_PROFILE} cho một profile.`));

  for (const side of SIDES) {
    const goal: GoalProfile | undefined = profile.goalProfiles?.[side];
    for (const goalIssue of validateGoalProfile(profile, side)) {
      issues.push(validationIssue(goalIssue.code as RuleProfileValidationCode, goalIssue.path, goalIssue.message));
    }
    if (goal?.mode === "STATIC" && profile.winConditions?.includes("GOAL_REACHED") && profile.layout.some((entry) => entry.side === side && entry.coordinate === goal.cell)) {
      issues.push(validationIssue("INITIAL_OWN_GOAL", `goalProfiles.${side}.cell`, "Không đặt quân own trên đích tĩnh ban đầu."));
    }
  }
  return Object.freeze(issues);
}

export function validateRuleProfileForPreview(profile: RuleProfile): readonly RuleProfileValidationIssue[] {
  const issues = [...validateRuleProfile(profile)];
  if (!profile.winConditions || profile.winConditions.length === 0) {
    issues.push(validationIssue("WIN_CONDITION_REQUIRED", "winConditions", "Phải bật ít nhất một điều kiện thắng."));
  }
  if (profile.winConditions?.includes("EXTINCTION")) {
    for (const side of SIDES) {
      for (const type of PIECE_TYPES) {
        if (profile.pieceCounts[side][type] <= 0) {
          issues.push(validationIssue("EXTINCTION_REQUIRES_ALL_TYPES", "pieceCounts." + side + "." + type, "EXTINCTION yêu cầu mỗi bên có đủ R/P/S ban đầu."));
        }
      }
    }
  }
  if (profile.winConditions?.includes("GOAL_REACHED")) {
    for (const side of SIDES) {
      if (profile.goalProfiles?.[side] === undefined) {
        issues.push(validationIssue("MISSING_GOAL_PROFILE", "goalProfiles." + side, "GOAL_REACHED cần goal profile cho cả hai bên."));
      }
    }
  }
  for (const side of SIDES) {
    for (const type of PIECE_TYPES) {
      for (const [patternIndex, pattern] of (profile.movementProfiles?.[side]?.[type] ?? []).entries()) {
        if (pattern.kind === "RAY" && Number.isInteger(pattern.maxDistance) && pattern.maxDistance > MAX_RAY_DISTANCE_FOR_PREVIEW) {
          issues.push(validationIssue("RAY_DISTANCE_CAP_EXCEEDED", "movementProfiles." + side + "." + type + "[" + patternIndex + "].maxDistance", "RAY maxDistance không vượt quá " + MAX_RAY_DISTANCE_FOR_PREVIEW + " trong preview giải đấu."));
        }
        if (pattern.kind === "LEAP") {
          const seen = new Set<string>();
          for (const [offsetIndex, offset] of pattern.offsets.entries()) {
            const key = String(offset.fileDelta) + ":" + String(offset.rankDelta);
            if (seen.has(key)) issues.push(validationIssue("DUPLICATE_LEAP_OFFSET", "movementProfiles." + side + "." + type + "[" + patternIndex + "].offsets[" + offsetIndex + "]", "LEAP offset trùng không làm tăng mobility."));
            seen.add(key);
          }
        }
      }
    }
  }
  return Object.freeze(issues);
}

export class RuleProfileValidationError extends Error {
  readonly issues: readonly RuleProfileValidationIssue[];

  constructor(issues: readonly RuleProfileValidationIssue[]) {
    super("INVALID_RULE_PROFILE");
    this.name = "RuleProfileValidationError";
    this.issues = issues;
  }
}

function freezePattern(pattern: MovementPattern): MovementPattern {
  if (pattern.kind === "RAY") return Object.freeze({ ...pattern, directions: Object.freeze(pattern.directions.map((direction) => Object.freeze({ ...direction }))) });
  return Object.freeze({ ...pattern, offsets: Object.freeze(pattern.offsets.map((offset) => Object.freeze({ ...offset }))) });
}

function cloneAndFreezeProfile(profile: RuleProfile): RuleProfile {
  const freezeMovement = (side: Side) => Object.freeze({
    R: Object.freeze(profile.movementProfiles[side].R.map(freezePattern)),
    P: Object.freeze(profile.movementProfiles[side].P.map(freezePattern)),
    S: Object.freeze(profile.movementProfiles[side].S.map(freezePattern)),
  });
  const frozenGoalProfiles: Partial<Record<Side, GoalProfile>> = {};
  for (const side of SIDES) {
    const goal = profile.goalProfiles?.[side];
    if (goal?.mode === "STATIC") frozenGoalProfiles[side] = Object.freeze({ ...goal });
    if (goal?.mode === "CYCLE") frozenGoalProfiles[side] = Object.freeze({ ...goal, cells: Object.freeze([...goal.cells]) });
    if (goal?.mode === "SEEDED") frozenGoalProfiles[side] = Object.freeze({ ...goal, candidateCells: Object.freeze([...goal.candidateCells]) });
  }
  return Object.freeze({
    ...profile,
    board: Object.freeze({ ...profile.board }),
    pieceCounts: Object.freeze({ BLUE: Object.freeze({ ...profile.pieceCounts.BLUE }), RED: Object.freeze({ ...profile.pieceCounts.RED }) }),
    layout: Object.freeze(profile.layout.map((entry) => Object.freeze({ ...entry }))),
    movementProfiles: Object.freeze({ BLUE: freezeMovement("BLUE"), RED: freezeMovement("RED") }),
    winConditions: Object.freeze([...(profile.winConditions ?? [])]),
    ...(profile.goalProfiles === undefined ? {} : { goalProfiles: Object.freeze(frozenGoalProfiles) }),
    ...(profile.seedContext === undefined ? {} : { seedContext: Object.freeze({ ...profile.seedContext }) }),
  });
}

function profileForSetup(version: RulesVersion, pieceCounts: PieceCounts, layout: readonly LayoutEntry[]): RuleProfile {
  return {
    version,
    board: LEGACY_BOARD,
    initialTurn: "BLUE",
    pieceCounts,
    layout,
    movementProfiles: createDefaultMovementProfiles(),
    winConditions: ["EXTINCTION", "GOAL_REACHED"],
    goalProfiles: {
      BLUE: { mode: "STATIC", cell: "i9" },
      RED: { mode: "STATIC", cell: "a1" },
    },
  };
}

function stateFromProfile(profile: RuleProfile, immutable = true): RuleState {
  const issues = validateRuleProfile(profile);
  if (issues.length > 0) throw new RuleProfileValidationError(issues);
  const board = emptyBoard(profile.board);
  for (const entry of profile.layout) {
    const piece = { id: entry.id, side: entry.side, type: entry.type };
    board[entry.coordinate] = immutable ? Object.freeze(piece) : piece;
  }
  const frozenProfile = cloneAndFreezeProfile(profile);
  const frozenBoard = (immutable ? Object.freeze(board) : board) as Board;
  const progress = goalProfilesHaveProgress(frozenProfile) ? createRuleProgress(frozenProfile) : undefined;
  const state: RuleState = {
    board: frozenBoard,
    pieceCounts: frozenProfile.pieceCounts,
    currentTurn: frozenProfile.initialTurn ?? "BLUE",
    status: "PLAYING",
    winner: null,
    resultReason: null,
    ruleProfile: frozenProfile,
    ...(progress === undefined ? {} : { progress }),
  };
  return immutable ? Object.freeze(state) : state;
}

export function createInitialStateFromProfile(profile: RuleProfile): RuleState {
  return stateFromProfile(profile);
}

export function createInitialState(options?: { version?: RulesVersion; seed?: number; profile?: RuleProfile }): RuleState {
  if (options?.profile !== undefined) return createInitialStateFromProfile(options.profile);
  const version = options?.version ?? "rps-v1";
  const layout: LayoutEntry[] = [];
  const board = emptyBoard();

  if (version === "rps-v1") {
    placeSetup(board, "BLUE", BLUE_SETUP, undefined, layout);
    placeSetup(board, "RED", RED_SETUP, undefined, layout);
    return stateFromProfile(profileForSetup(version, emptyCounts(false) as PieceCounts, layout), false);
  }

  const seed = options?.seed ?? 0;
  const row1Rank = Math.floor(seed / 1680) % 1680;
  const row2Rank = seed % 1680;
  const files = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  const blueRow1 = unrankRow(row1Rank);
  const blueRow2 = unrankRow(row2Rank);
  const redRow9 = [...blueRow1].reverse();
  const redRow8 = [...blueRow2].reverse();
  const blueSetup: SetupEntry[] = [];
  const redSetup: SetupEntry[] = [];
  for (let i = 0; i < 9; i++) {
    blueSetup.push([`${files[i]}1`, blueRow1[i] as PieceType]);
    blueSetup.push([`${files[i]}2`, blueRow2[i] as PieceType]);
    redSetup.push([`${files[i]}9`, redRow9[i] as PieceType]);
    redSetup.push([`${files[i]}8`, redRow8[i] as PieceType]);
  }
  placeSetup(board, "BLUE", blueSetup, { R: 0, P: 0, S: 0 }, layout);
  placeSetup(board, "RED", redSetup, { R: 0, P: 0, S: 0 }, layout);
  return stateFromProfile(profileForSetup(version, emptyCounts(true) as PieceCounts, layout), false);
}

export function generateSetupSeed(readByte: () => number): number {
  const MAX_ACCEPT = 2822400 * 5;
  for (let i = 0; i < 8; i++) {
    const b1 = readByte();
    const b2 = readByte();
    const b3 = readByte();
    const val = ((b1 & 0xff) << 16) | ((b2 & 0xff) << 8) | (b3 & 0xff);
    if (val < MAX_ACCEPT) return val % 2822400;
  }
  throw new Error("Failed to generate setup seed within 8 rejection sampling iterations");
}
