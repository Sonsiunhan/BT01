import { adjacentCoordinates, coordinateToPosition, GOAL_COORDINATES, isCoordinate, BOARD_COORDINATES } from "./coordinates.js";
import type {
  Board,
  MoveCommand,
  MoveError,
  MoveResult,
  Piece,
  PieceCounts,
  PieceType,
  RuleState,
  Side,
} from "./types.js";

export const CAPTURE_MATRIX: Readonly<Record<PieceType, PieceType>> = Object.freeze({
  R: "S",
  P: "R",
  S: "P",
});

const PIECE_TYPES: readonly PieceType[] = ["R", "P", "S"];

function otherSide(side: Side): Side {
  return side === "BLUE" ? "RED" : "BLUE";
}

function rejection(state: RuleState, code: MoveError["code"]): MoveResult {
  return { kind: "rejected", state, error: { code } };
}

function cloneBoard(board: Board): Record<string, Piece | null> {
  return Object.fromEntries(Object.entries(board));
}

function cloneCounts(pieceCounts: PieceCounts): Record<Side, Record<PieceType, number>> {
  return {
    BLUE: { ...pieceCounts.BLUE },
    RED: { ...pieceCounts.RED },
  };
}

function isOneStep(from: MoveCommand["from"], to: MoveCommand["to"]): boolean {
  const fromPosition = coordinateToPosition(from);
  const toPosition = coordinateToPosition(to);
  return Math.max(
    Math.abs(toPosition.fileIndex - fromPosition.fileIndex),
    Math.abs(toPosition.rankIndex - fromPosition.rankIndex),
  ) === 1;
}

function destinationError(source: Piece, destination: Piece | null): MoveError["code"] | null {
  if (destination === null) return null;
  if (destination.side === source.side) return "FRIENDLY_BLOCK";
  if (destination.type === source.type) return "SAME_TYPE_BLOCK";
  if (CAPTURE_MATRIX[source.type] !== destination.type) return "LOSING_ATTACKER";
  return null;
}

function validateMove(state: RuleState, command: MoveCommand): MoveError["code"] | null {
  if (state.status === "FINISHED") return "GAME_OVER";
  if (!isCoordinate(command.from) || !isCoordinate(command.to)) return "OUT_OF_BOUNDS";
  if (state.currentTurn !== command.side) return "WRONG_TURN";

  const source = state.board[command.from];
  if (source === null) return "NO_PIECE";
  if (source.side !== command.side) return "NOT_OWNER";
  if (!isOneStep(command.from, command.to)) return "NOT_ONE_STEP";
  return destinationError(source, state.board[command.to]);
}

function createsExtinction(counts: Record<Side, Record<PieceType, number>>, winner: Side): boolean {
  const defeated = otherSide(winner);
  return PIECE_TYPES.some((type) => counts[defeated][type] === 0);
}

export function getLegalDestinations(state: RuleState, side: Side, from: unknown): readonly MoveCommand["to"][] {
  if (state.status === "FINISHED" || state.currentTurn !== side || !isCoordinate(from)) return [];
  const source = state.board[from];
  if (source === null || source.side !== side) return [];
  return adjacentCoordinates(from).filter((to) => validateMove(state, { side, from, to }) === null);
}

export function hasLegalMove(state: RuleState, side: Side): boolean {
  if (state.status === "FINISHED") return false;
  if (state.currentTurn !== side) return false;
  
  for (const from of BOARD_COORDINATES) {
    const source = state.board[from];
    if (source !== null && source.side === side) {
      if (getLegalDestinations(state, side, from).length > 0) {
        return true;
      }
    }
  }
  return false;
}

export function evaluateTurnStart(state: RuleState): RuleState {
  if (state.status === "FINISHED" || state.currentTurn === null) return state;
  
  if (!hasLegalMove(state, state.currentTurn)) {
    return Object.freeze({
      ...state,
      status: "FINISHED",
      winner: otherSide(state.currentTurn),
      resultReason: "NO_LEGAL_MOVES",
      currentTurn: null
    });
  }
  
  return state;
}

function freezeState(state: RuleState): RuleState {
  Object.freeze(state.board);
  Object.freeze(state.pieceCounts.BLUE);
  Object.freeze(state.pieceCounts.RED);
  Object.freeze(state.pieceCounts);
  return Object.freeze(state);
}

export function applyMove(state: RuleState, command: MoveCommand): MoveResult {
  const error = validateMove(state, command);
  if (error !== null) return rejection(state, error);

  const source = state.board[command.from];
  if (source === null) return rejection(state, "NO_PIECE");
  const captured = state.board[command.to];
  const board = cloneBoard(state.board);
  board[command.from] = null;
  board[command.to] = source;

  const pieceCounts = cloneCounts(state.pieceCounts);
  if (captured !== null) pieceCounts[captured.side][captured.type] -= 1;

  const extinction = createsExtinction(pieceCounts, command.side);
  const reachedGoal = GOAL_COORDINATES[command.side] === command.to;
  
  let winner = extinction || reachedGoal ? command.side : null;
  let resultReason = extinction ? "EXTINCTION" : reachedGoal ? "GOAL_REACHED" : null;
  let nextTurn = winner === null ? otherSide(command.side) : null;
  let status = winner === null ? "PLAYING" : "FINISHED";

  let nextState: RuleState;

  if (winner === null && nextTurn !== null) {
    const tempState: RuleState = {
      board: board as Board,
      pieceCounts: pieceCounts as PieceCounts,
      currentTurn: nextTurn,
      status: status as any,
      winner,
      resultReason: resultReason as any,
    };
    if (!hasLegalMove(tempState, nextTurn)) {
      nextState = {
        board: board as Board,
        pieceCounts: pieceCounts as PieceCounts,
        currentTurn: null,
        status: "FINISHED",
        winner: command.side,
        resultReason: "NO_LEGAL_MOVES",
      };
    } else {
      nextState = tempState;
    }
  } else {
    nextState = {
      board: board as Board,
      pieceCounts: pieceCounts as PieceCounts,
      currentTurn: nextTurn,
      status: status as any,
      winner,
      resultReason: resultReason as any,
    };
  }

  return {
    kind: "accepted",
    state: freezeState(nextState),
    move: {
      pieceId: source.id,
      side: command.side,
      from: command.from,
      to: command.to,
      capturedPieceId: captured?.id ?? null,
    },
  };
}
