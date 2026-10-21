import {
  EXTENDED_FILES,
  EXTENDED_RANKS,
  FILES,
  RANKS,
  type BoardSpec,
  type Coordinate,
  type File,
  type Rank,
  type Side,
} from "./types.js";

const LEGACY_BOARD: BoardSpec = Object.freeze({ rows: 9, cols: 9 });

export const BOARD_COORDINATES: readonly Coordinate[] = Object.freeze(
  Array.from({ length: LEGACY_BOARD.rows }, (_, rankIndex) =>
    Array.from({ length: LEGACY_BOARD.cols }, (_, fileIndex) =>
      `${FILES[fileIndex]}${RANKS[rankIndex]}` as Coordinate,
    ),
  ).flat(),
);

export const GOAL_COORDINATES: Readonly<Record<Side, Coordinate>> = Object.freeze({
  BLUE: "i9",
  RED: "a1",
});

export type BoardPosition = Readonly<{
  fileIndex: number;
  rankIndex: number;
}>;

export function isCoordinate(value: unknown): value is Coordinate {
  // Preserve the legacy public validator; dynamic profiles use isExtendedCoordinate + board bounds.
  return typeof value === "string" && /^[a-i][1-9]$/.test(value);
}

export function isExtendedCoordinate(value: unknown): value is Coordinate {
  return typeof value === "string" && /^[a-o](?:[1-9]|1[0-5])$/.test(value);
}

export function getBoardCoordinates(board: BoardSpec): readonly Coordinate[] {
  return Object.freeze(
    Array.from({ length: board.rows }, (_, rankIndex) =>
      Array.from({ length: board.cols }, (_, fileIndex) =>
        `${EXTENDED_FILES[fileIndex]}${EXTENDED_RANKS[rankIndex]}` as Coordinate,
      ),
    ).flat(),
  );
}

export function isCoordinateInBoard(board: BoardSpec, coordinate: unknown): coordinate is Coordinate {
  if (!isExtendedCoordinate(coordinate)) return false;
  const { fileIndex, rankIndex } = coordinateToPosition(coordinate);
  return fileIndex >= 0 && fileIndex < board.cols && rankIndex >= 0 && rankIndex < board.rows;
}

export function coordinateToPosition(coordinate: Coordinate): BoardPosition {
  const match = /^([a-o])(\d+)$/.exec(coordinate);
  if (match === null) throw new Error("INVALID_COORDINATE");
  const file = match[1] as File;
  const rank = Number(match[2]) as Rank;
  return {
    fileIndex: EXTENDED_FILES.indexOf(file),
    rankIndex: EXTENDED_RANKS.indexOf(rank),
  };
}

export function positionToCoordinate(fileIndex: number, rankIndex: number, board: BoardSpec = LEGACY_BOARD): Coordinate | null {
  if (fileIndex < 0 || fileIndex >= board.cols || rankIndex < 0 || rankIndex >= board.rows) return null;
  const file = EXTENDED_FILES[fileIndex];
  const rank = EXTENDED_RANKS[rankIndex];
  if (file === undefined || rank === undefined) return null;
  return `${file}${rank}` as Coordinate;
}

export function rotateCoordinate180(coordinate: Coordinate, board: BoardSpec = LEGACY_BOARD): Coordinate {
  const { fileIndex, rankIndex } = coordinateToPosition(coordinate);
  return positionToCoordinate(board.cols - 1 - fileIndex, board.rows - 1 - rankIndex, board) as Coordinate;
}

export function adjacentCoordinates(from: Coordinate, board: BoardSpec = LEGACY_BOARD): readonly Coordinate[] {
  const { fileIndex, rankIndex } = coordinateToPosition(from);
  const coordinates: Coordinate[] = [];
  for (let rankDelta = -1; rankDelta <= 1; rankDelta += 1) {
    for (let fileDelta = -1; fileDelta <= 1; fileDelta += 1) {
      if (fileDelta === 0 && rankDelta === 0) continue;
      const coordinate = positionToCoordinate(fileIndex + fileDelta, rankIndex + rankDelta, board);
      if (coordinate !== null) coordinates.push(coordinate);
    }
  }
  return coordinates;
}
