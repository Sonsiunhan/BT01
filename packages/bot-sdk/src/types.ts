import type { Board, Coordinate, PieceType, Side } from "@ottv2/game-rules";
import type { BotExecutionReceipt } from "@ottv2/contracts";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type BotMove = Readonly<{ from: Coordinate; to: Coordinate }>;

export type BotMoveRecord = Readonly<{
  side: Side;
  from: Coordinate;
  to: Coordinate;
  captured: PieceType | null;
}>;

/** Public state passed to choose_move(state, memory). No opponent memory/logs. */
export type BotTurnState = Readonly<{
  sdkVersion: string;
  schemaVersion: string;
  side: Side;
  board: Board;
  legalMoves: readonly BotMove[];
  dimensions: Readonly<{ rows: number; cols: number }>;
  goals: Readonly<{ BLUE: Coordinate | null; RED: Coordinate | null }>;
  rules: Readonly<{ version: string; winConditions: readonly ("EXTINCTION" | "GOAL_REACHED")[] }>;
  turnNumber: number;
  clocksMs: Readonly<{ BLUE: number; RED: number }>;
  history: readonly BotMoveRecord[];
}>;

export type BotInvocationRequest = Readonly<{
  source: string;
  state: BotTurnState;
  memory: JsonValue;
  seed: number;
  /** Trusted host phase; never taken from a player's payload. */
  phase?: "PREFLIGHT" | "TURN";
  /** Host-only receipt identity; ignored if supplied by player source. */
  receiptContext?: Omit<BotExecutionReceipt, "outcome" | "computeMs" | "errorCode">;
}>;

export type BotInvocationResult = Readonly<{
  move: BotMove;
  memory: JsonValue;
  /** Supervisor measurement, overwritten by the trusted adapter, never Bot output. */
  computeMs?: number;
  /** Host-generated immutable evidence; never accepted from Bot output. */
  receipt?: BotExecutionReceipt;
}>;
