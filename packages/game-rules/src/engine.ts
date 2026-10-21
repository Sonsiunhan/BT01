import { coordinateToPosition, getBoardCoordinates, isCoordinateInBoard, positionToCoordinate } from "./coordinates.js";
import { LEGACY_RULE_PROFILE } from "./profiles.js";
import type {
  Board,
  Coordinate,
  MoveCommand,
  MoveError,
  MoveResult,
  Piece,
  PieceCounts,
  PieceType,
  RuleProfile,
  RuleState,
  Side,
} from "./types.js";

export const CAPTURE_MATRIX: Readonly<Record<PieceType, PieceType>> = Object.freeze({
  R: "S",
  P: "R",
  S: "P",
});

const PIECE_TYPES: readonly PieceType[] = ["R", "P", "S"];

function profileForState(state: RuleState): RuleProfile {
  return state.ruleProfile ?? LEGACY_RULE_PROFILE;
}

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

function destinationError(source: Piece, destination: Piece | null): MoveError["code"] | null {
  if (destination === null) return null;
  if (destination.side === source.side) return "FRIENDLY_BLOCK";
  if (destination.type === source.type) return "SAME_TYPE_BLOCK";
  if (CAPTURE_MATRIX[source.type] !== destination.type) return "LOSING_ATTACKER";
  return null;
}

function pieceAt(state: RuleState, coordinate: string): Piece | null {
  return state.board[coordinate as Coordinate] ?? null;
}

function addDestination(destinations: CoordinateSet, coordinate: Coordinate): void {
  destinations.add(coordinate);
}

type CoordinateSet = Set<MoveCommand["to"]>;

function enumerateLegalDestinations(state: RuleState, side: Side, from: MoveCommand["from"]): readonly MoveCommand["to"][] {
  const profile = profileForState(state);
  const source = pieceAt(state, from);
  if (source === null) return [];
  const patterns = profile.movementProfiles[side][source.type];
  const position = coordinateToPosition(from);
  const destinations: CoordinateSet = new Set();

  for (const pattern of patterns) {
    if (pattern.kind === "LEAP") {
      for (const offset of pattern.offsets) {
        const target = positionToCoordinate(position.fileIndex + offset.fileDelta, position.rankIndex + offset.rankDelta, profile.board);
        if (target !== null && destinationError(source, pieceAt(state, target)) === null) addDestination(destinations, target);
      }
      continue;
    }

    for (const direction of pattern.directions) {
      for (let distance = pattern.minDistance; distance <= pattern.maxDistance; distance += 1) {
        const target = positionToCoordinate(
          position.fileIndex + direction.fileDelta * distance,
          position.rankIndex + direction.rankDelta * distance,
          profile.board,
        );
        if (target === null) break;

        if (!pattern.canJump) {
          let blocked = false;
          for (let step = 1; step < distance; step += 1) {
            const intermediate = positionToCoordinate(
              position.fileIndex + direction.fileDelta * step,
              position.rankIndex + direction.rankDelta * step,
              profile.board,
            );
            if (intermediate === null || pieceAt(state, intermediate) !== null) {
              blocked = true;
              break;
            }
          }
          if (blocked) break;
        }

        const destination = pieceAt(state, target);
        if (destinationError(source, destination) === null) addDestination(destinations, target);
        if (!pattern.canJump && destination !== null) break;
      }
    }
  }
  return [...destinations];
}

function canReachGeometry(state: RuleState, side: Side, from: MoveCommand["from"], to: MoveCommand["to"]): boolean {
  const profile = profileForState(state);
  const source = pieceAt(state, from);
  if (source === null) return false;
  const fromPosition = coordinateToPosition(from);
  const toPosition = coordinateToPosition(to);
  for (const pattern of profile.movementProfiles[side][source.type]) {
    if (pattern.kind === "LEAP") {
      if (pattern.offsets.some((offset) => fromPosition.fileIndex + offset.fileDelta === toPosition.fileIndex && fromPosition.rankIndex + offset.rankDelta === toPosition.rankIndex)) return true;
      continue;
    }
    for (const direction of pattern.directions) {
      const fileDelta = toPosition.fileIndex - fromPosition.fileIndex;
      const rankDelta = toPosition.rankIndex - fromPosition.rankIndex;
      for (let distance = pattern.minDistance; distance <= pattern.maxDistance; distance += 1) {
        if (fileDelta !== direction.fileDelta * distance || rankDelta !== direction.rankDelta * distance) continue;
        if (pattern.canJump) return true;
        for (let step = 1; step < distance; step += 1) {
          const intermediate = positionToCoordinate(
            fromPosition.fileIndex + direction.fileDelta * step,
            fromPosition.rankIndex + direction.rankDelta * step,
            profile.board,
          );
          if (intermediate === null || pieceAt(state, intermediate) !== null) return false;
        }
        return true;
      }
    }
  }
  return false;
}

function isLegacyProfile(profile: RuleProfile): boolean {
  return profile.version === "rps-v1" || profile.version === "rps-v2";
}

function validateMove(state: RuleState, command: MoveCommand): MoveError["code"] | null {
  const profile = profileForState(state);
  if (!isCoordinateInBoard(profile.board, command.from) || !isCoordinateInBoard(profile.board, command.to)) return "OUT_OF_BOUNDS";
  if (state.status === "FINISHED") return "GAME_OVER";
  if (state.currentTurn !== command.side) return "WRONG_TURN";

  const source = pieceAt(state, command.from);
  if (source === null) return "NO_PIECE";
  if (source.side !== command.side) return "NOT_OWNER";
  if (enumerateLegalDestinations(state, command.side, command.from).includes(command.to)) return null;
  if (canReachGeometry(state, command.side, command.from, command.to)) {
    const destination = pieceAt(state, command.to);
    const destinationRejection = destinationError(source, destination);
    if (destinationRejection !== null) return destinationRejection;
  }
  return isLegacyProfile(profile) ? "NOT_ONE_STEP" : "ILLEGAL_MOVEMENT";
}

function createsExtinction(counts: Record<Side, Record<PieceType, number>>, winner: Side): boolean {
  const defeated = otherSide(winner);
  return PIECE_TYPES.some((type) => counts[defeated][type] === 0);
}

function hasWinCondition(profile: RuleProfile, condition: "EXTINCTION" | "GOAL_REACHED"): boolean {
  return profile.winConditions?.includes(condition) ?? false;
}

function staticGoal(profile: RuleProfile, side: Side): MoveCommand["to"] | null {
  const goal = profile.goalProfiles?.[side];
  return goal?.mode === "STATIC" ? goal.cell : null;
}

export function getLegalDestinations(state: RuleState, side: Side, from: unknown): readonly MoveCommand["to"][] {
  const profile = profileForState(state);
  if (state.status === "FINISHED" || state.currentTurn !== side || !isCoordinateInBoard(profile.board, from)) return [];
  const source = pieceAt(state, from);
  if (source === null || source.side !== side) return [];
  return enumerateLegalDestinations(state, side, from);
}

export function hasLegalMove(state: RuleState, side: Side): boolean {
  const profile = profileForState(state);
  if (state.status === "FINISHED" || state.currentTurn !== side) return false;
  for (const from of getBoardCoordinates(profile.board)) {
    const source = pieceAt(state, from);
    if (source !== null && source.side === side && enumerateLegalDestinations(state, side, from).length > 0) return true;
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
      currentTurn: null,
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

  const profile = profileForState(state);
  const source = pieceAt(state, command.from);
  if (source === null) return rejection(state, "NO_PIECE");
  const captured = pieceAt(state, command.to);
  const board = cloneBoard(state.board);
  board[command.from] = null;
  board[command.to] = source;

  const pieceCounts = cloneCounts(state.pieceCounts);
  if (captured !== null) pieceCounts[captured.side][captured.type] -= 1;

  const extinction = hasWinCondition(profile, "EXTINCTION") && createsExtinction(pieceCounts, command.side);
  const reachedGoal = hasWinCondition(profile, "GOAL_REACHED") && staticGoal(profile, command.side) === command.to;
  const winner = extinction || reachedGoal ? command.side : null;
  const resultReason = extinction ? "EXTINCTION" : reachedGoal ? "GOAL_REACHED" : null;
  const nextTurn = winner === null ? otherSide(command.side) : null;
  const status = winner === null ? "PLAYING" : "FINISHED";

  let nextState: RuleState;
  if (winner === null && nextTurn !== null) {
    const tempState: RuleState = {
      board: board as Board,
      pieceCounts: pieceCounts as PieceCounts,
      currentTurn: nextTurn,
      status,
      winner,
      resultReason,
      ruleProfile: profile,
    };
    if (!hasLegalMove(tempState, nextTurn)) {
      nextState = {
        board: board as Board,
        pieceCounts: pieceCounts as PieceCounts,
        currentTurn: null,
        status: "FINISHED",
        winner: command.side,
        resultReason: "NO_LEGAL_MOVES",
        ruleProfile: profile,
      };
    } else {
      nextState = tempState;
    }
  } else {
    nextState = {
      board: board as Board,
      pieceCounts: pieceCounts as PieceCounts,
      currentTurn: nextTurn,
      status,
      winner,
      resultReason,
      ruleProfile: profile,
    };
  }

  return {
    kind: "accepted",
    state: freezeState(nextState),
    move: {
      pieceId: source.id,
      side: source.side,
      from: command.from,
      to: command.to,
      capturedPieceId: captured?.id ?? null,
    },
  };
}
