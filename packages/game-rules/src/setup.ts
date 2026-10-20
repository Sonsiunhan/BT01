import { BOARD_COORDINATES } from "./coordinates.js";
import type { Board, Piece, PieceCounts, PieceType, RuleState, Side, RulesVersion, SetupDescriptor } from "./types.js";

type SetupEntry = readonly [coordinate: string, type: PieceType];

const BLUE_SETUP: readonly SetupEntry[] = [
  ["b1", "R"], ["c1", "P"], ["d1", "S"],
  ["e1", "R"], ["f1", "P"], ["g1", "S"],
  ["h1", "R"], ["i1", "P"], ["a1", "S"],
];

const RED_SETUP: readonly SetupEntry[] = [
  ["a9", "P"], ["b9", "R"], ["c9", "S"],
  ["d9", "P"], ["e9", "R"], ["f9", "S"],
  ["g9", "P"], ["h9", "R"], ["i9", "S"],
];

function emptyBoard(): Record<string, Piece | null> {
  return Object.fromEntries(BOARD_COORDINATES.map((coordinate) => [coordinate, null]));
}

function emptyCounts(v2 = false): Record<Side, Record<PieceType, number>> {
  const c = v2 ? 6 : 3;
  return {
    BLUE: { R: c, P: c, S: c },
    RED: { R: c, P: c, S: c },
  };
}

function placeSetup(board: Record<string, Piece | null>, side: Side, setup: readonly SetupEntry[], ordinals?: Record<PieceType, number>): void {
  const ords = ordinals ?? { R: 0, P: 0, S: 0 };
  for (const [coordinate, type] of setup) {
    ords[type] += 1;
    board[coordinate] = { id: `${side.toLowerCase()}-${type.toLowerCase()}-${ords[type]}`, side, type };
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
      rank -= (waysP + waysR);
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

export function createInitialState(options?: { version?: RulesVersion; seed?: number }): RuleState {
  const version = options?.version ?? "rps-v1";
  const board = emptyBoard();
  
  if (version === "rps-v1") {
    placeSetup(board, "BLUE", BLUE_SETUP);
    placeSetup(board, "RED", RED_SETUP);
    const pieceCounts = emptyCounts(false);
    return {
      board: board as Board,
      pieceCounts: pieceCounts as PieceCounts,
      currentTurn: "BLUE",
      status: "PLAYING",
      winner: null,
      resultReason: null,
    };
  } else {
    const seed = options?.seed ?? 0;
    const row1Rank = Math.floor(seed / 1680) % 1680;
    const row2Rank = seed % 1680;
    
    const blueRow1 = unrankRow(row1Rank);
    const blueRow2 = unrankRow(row2Rank);
    const redRow9 = [...blueRow1].reverse();
    const redRow8 = [...blueRow2].reverse();
    
    const FILES = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
    
    const blueSetup: SetupEntry[] = [];
    const redSetup: SetupEntry[] = [];
    
    for (let i = 0; i < 9; i++) {
      blueSetup.push([`${FILES[i]}1`, blueRow1[i] as PieceType]);
      blueSetup.push([`${FILES[i]}2`, blueRow2[i] as PieceType]);
      redSetup.push([`${FILES[i]}9`, redRow9[i] as PieceType]);
      redSetup.push([`${FILES[i]}8`, redRow8[i] as PieceType]);
    }
    
    const blueOrds = { R: 0, P: 0, S: 0 };
    const redOrds = { R: 0, P: 0, S: 0 };
    
    placeSetup(board, "BLUE", blueSetup, blueOrds);
    placeSetup(board, "RED", redSetup, redOrds);
    
    const pieceCounts = emptyCounts(true);
    return {
      board: board as Board,
      pieceCounts: pieceCounts as PieceCounts,
      currentTurn: "BLUE",
      status: "PLAYING",
      winner: null,
      resultReason: null,
    };
  }
}

export function generateSetupSeed(readByte: () => number): number {
  const MAX_ACCEPT = 2822400 * 5; // 14112000
  for (let i = 0; i < 8; i++) {
    const b1 = readByte();
    const b2 = readByte();
    const b3 = readByte();
    
    // Ensure bytes are valid 0-255 (though injected source should guarantee this)
    const val = ((b1 & 0xff) << 16) | ((b2 & 0xff) << 8) | (b3 & 0xff);
    
    if (val < MAX_ACCEPT) {
      return val % 2822400;
    }
  }
  throw new Error("Failed to generate setup seed within 8 rejection sampling iterations");
}
