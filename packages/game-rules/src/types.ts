/** Legacy 9×9 presentation constants; keep these stable for existing UI consumers. */
export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h", "i"] as const;
export const EXTENDED_FILES = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o"] as const;
export type File = typeof EXTENDED_FILES[number];

/** Legacy 9×9 presentation constants; keep these stable for existing UI consumers. */
export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const EXTENDED_RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;
export type Rank = typeof EXTENDED_RANKS[number];

export type Coordinate = `${File}${Rank}`;
export type Side = "BLUE" | "RED";
export type PieceType = "R" | "P" | "S";
export type RuleStatus = "PLAYING" | "FINISHED";
export type ResultReason = "EXTINCTION" | "GOAL_REACHED" | "NO_LEGAL_MOVES" | null;

export type RulesVersion = "rps-v1" | "rps-v2";

export type BoardSpec = Readonly<{
  rows: number;
  cols: number;
}>;

export type DirectionVector = Readonly<{
  fileDelta: number;
  rankDelta: number;
}>;

export type RayPattern = Readonly<{
  kind: "RAY";
  directions: readonly DirectionVector[];
  minDistance: number;
  maxDistance: number;
  canJump: boolean;
}>;

export type LeapPattern = Readonly<{
  kind: "LEAP";
  offsets: readonly DirectionVector[];
}>;

export type MovementPattern = RayPattern | LeapPattern;
export type MovementProfile = Readonly<Record<PieceType, readonly MovementPattern[]>>;
export type MovementProfiles = Readonly<Record<Side, MovementProfile>>;

export type WinCondition = "EXTINCTION" | "GOAL_REACHED";

export type StaticGoalProfile = Readonly<{
  mode: "STATIC";
  cell: Coordinate;
}>;

export type GoalProfile = StaticGoalProfile;

export type LayoutEntry = Readonly<{
  id: string;
  side: Side;
  type: PieceType;
  coordinate: Coordinate;
}>;

export type RuleProfile = Readonly<{
  version: string;
  /** Builder metadata; preview normalizes RELATIVE profiles to explicit vectors. */
  directionSystem?: "ABSOLUTE" | "RELATIVE";
  board: BoardSpec;
  initialTurn?: Side;
  pieceCounts: PieceCounts;
  layout: readonly LayoutEntry[];
  movementProfiles: MovementProfiles;
  winConditions?: readonly WinCondition[];
  goalProfiles?: Readonly<Partial<Record<Side, GoalProfile>>>;
}>;

export type RuleProfileValidationCode =
  | "BOARD_DIMENSION_OUT_OF_RANGE"
  | "BOARD_DIMENSION_NOT_INTEGER"
  | "LAYOUT_OUT_OF_BOUNDS"
  | "LAYOUT_COLLISION"
  | "LAYOUT_DUPLICATE_ID"
  | "COUNTS_MISMATCH"
  | "MISSING_MOVEMENT_PROFILE"
  | "PATTERN_LIMIT_EXCEEDED"
  | "LEAP_OFFSET_LIMIT_EXCEEDED"
  | "INVALID_DIRECTION"
  | "INVALID_DISTANCE"
  | "RAY_DISTANCE_CAP_EXCEEDED"
  | "INVALID_LEAP_OFFSET"
  | "DUPLICATE_LEAP_OFFSET"
  | "GOAL_OUT_OF_BOUNDS"
  | "INITIAL_OWN_GOAL"
  | "WIN_CONDITION_REQUIRED"
  | "EXTINCTION_REQUIRES_ALL_TYPES"
  | "MISSING_GOAL_PROFILE";

export type RuleProfileValidationIssue = Readonly<{
  code: RuleProfileValidationCode;
  path: string;
  message: string;
}>;

export type SetupDescriptor = Readonly<{
  version: RulesVersion;
  seed?: number;
}>;

export type Piece = Readonly<{
  id: string;
  side: Side;
  type: PieceType;
}>;

export type Board = Readonly<Record<Coordinate, Piece | null>>;
export type SidePieceCounts = Readonly<Record<PieceType, number>>;
export type PieceCounts = Readonly<Record<Side, SidePieceCounts>>;

export type RuleState = Readonly<{
  board: Board;
  pieceCounts: PieceCounts;
  currentTurn: Side | null;
  status: RuleStatus;
  winner: Side | null;
  resultReason: ResultReason;
  ruleProfile?: RuleProfile;
}>;

export type MoveCommand = Readonly<{
  side: Side;
  from: Coordinate;
  to: Coordinate;
}>;

export type MoveRejectionCode =
  | "OUT_OF_BOUNDS"
  | "NOT_ONE_STEP"
  | "ILLEGAL_MOVEMENT"
  | "NO_PIECE"
  | "NOT_OWNER"
  | "WRONG_TURN"
  | "GAME_OVER"
  | "FRIENDLY_BLOCK"
  | "SAME_TYPE_BLOCK"
  | "LOSING_ATTACKER";

export type MoveError = Readonly<{
  code: MoveRejectionCode;
}>;

export type MoveSummary = Readonly<{
  pieceId: string;
  side: Side;
  from: Coordinate;
  to: Coordinate;
  capturedPieceId: string | null;
}>;

export type MoveResult =
  | Readonly<{
      kind: "accepted";
      state: RuleState;
      move: MoveSummary;
    }>
  | Readonly<{
      kind: "rejected";
      state: RuleState;
      error: MoveError;
    }>;
