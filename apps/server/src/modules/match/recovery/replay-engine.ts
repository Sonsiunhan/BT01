import {
  applyMove,
  createInitialState,
  type MoveCommand,
  type RuleState,
  type RulesVersion,
} from "@ottv2/game-rules";
import type { HistoryReplayMove } from "@ottv2/contracts";

export interface ReplayValidationInput {
  matchId: string;
  rulesVersion?: string | null;
  setupVersion?: string | null;
  initialBoard?: unknown;
  initialSeed?: number | null;
  moves: HistoryReplayMove[];
  finalBoard?: unknown;
  expectedWinner?: string | null;
  expectedResultReason?: string | null;
}

export interface ReplayValidationResult {
  valid: boolean;
  errorCode?:
    | "UNSUPPORTED_RULES_VERSION"
    | "CORRUPTED_REPLAY_CHAIN"
    | "FINAL_BOARD_MISMATCH"
    | "ILLEGAL_MOVE_IN_CHAIN"
    | "MISSING_INITIAL_STATE";
  errorMessage?: string;
  legacyFinalBoardOnly?: boolean;
  reconstructedBoard?: unknown;
  moveCount: number;
  finalWinner?: string | null;
}

const SUPPORTED_RULES_VERSIONS = new Set(["rps-v1", "rps-v2"]);

export class ReplayEngine {
  /**
   * Validates and reconstructs a match replay by re-executing accepted moves from actual initial board.
   * INVARIANT (FRS-L06 §5, L-05.09):
   * 1. Replays move chain in strict sequence order.
   * 2. Compares reconstructed final board with committed final board.
   * 3. Legacy matches with only final board and no moves are tagged legacyFinalBoardOnly without fabricating move chains.
   * 4. Unknown/corrupt versions are rejected and kept read-only as errors.
   */
  validateAndReconstruct(input: ReplayValidationInput): ReplayValidationResult {
    const rulesVersion = (input.rulesVersion ?? "rps-v1") as RulesVersion;

    // 1. Check supported rules version
    if (!SUPPORTED_RULES_VERSIONS.has(rulesVersion)) {
      return {
        valid: false,
        errorCode: "UNSUPPORTED_RULES_VERSION",
        errorMessage: `Phiên bản luật không được hỗ trợ hoặc bị hỏng: ${input.rulesVersion}`,
        moveCount: input.moves.length,
      };
    }

    // 2. Legacy final board only check
    if (input.moves.length === 0) {
      if (input.finalBoard) {
        return {
          valid: true,
          legacyFinalBoardOnly: true,
          reconstructedBoard: input.finalBoard,
          moveCount: 0,
          finalWinner: input.expectedWinner ?? null,
        };
      }
      return {
        valid: false,
        errorCode: "MISSING_INITIAL_STATE",
        errorMessage: "Trận đấu không có nước đi và thiếu thông tin bàn cờ cuối.",
        moveCount: 0,
      };
    }

    // 3. Initialize rule state from initial board or deterministic seed
    let currentState: RuleState;

    const initialBoardObj = input.initialBoard as any;
    const boardCells =
      initialBoardObj?.cells ??
      initialBoardObj?.board ??
      (typeof initialBoardObj === "object" && initialBoardObj !== null && !Array.isArray(initialBoardObj)
        ? initialBoardObj
        : null);

    if (boardCells && typeof boardCells === "object" && Object.keys(boardCells).length > 0) {
      const normalizedBoard: Record<string, any> = {};
      const columns = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
      for (const col of columns) {
        for (let row = 1; row <= 9; row++) {
          const coord = `${col}${row}`;
          normalizedBoard[coord] = boardCells[coord] ?? boardCells[coord.toUpperCase()] ?? null;
        }
      }
      currentState = {
        board: normalizedBoard as any,
        pieceCounts: initialBoardObj?.pieceCounts ?? {
          BLUE: { ROCK: 3, PAPER: 3, SCISSORS: 3, TRAP: 0 },
          RED: { ROCK: 3, PAPER: 3, SCISSORS: 3, TRAP: 0 },
        },
        currentTurn: initialBoardObj?.currentTurn ?? "BLUE",
        status: "PLAYING",
        winner: null,
        resultReason: null,
      };
    } else {
      // Fallback to canonical setup for version and seed
      currentState = createInitialState({
        version: rulesVersion,
        seed: input.initialSeed ?? 0,
      });
    }

    // 4. Enforce monotonic sequence order across move chain before execution
    let prevSeq = 0;
    for (let i = 0; i < input.moves.length; i++) {
      const move = input.moves[i]!;
      if (move.sequence <= prevSeq) {
        return {
          valid: false,
          errorCode: "CORRUPTED_REPLAY_CHAIN",
          errorMessage: `Chuỗi nước đi bị hỏng: thứ tự sequence không hợp lệ (nước ${i + 1} sequence ${move.sequence} <= ${prevSeq})`,
          moveCount: i,
        };
      }
      prevSeq = move.sequence;
    }

    // 5. Sequentially execute and verify move chain
    for (let i = 0; i < input.moves.length; i++) {
      const move = input.moves[i]!;

      const command: MoveCommand = {
        from: (move.from.toLowerCase() as any),
        to: (move.to.toLowerCase() as any),
        side: move.side,
      };

      try {
        const result = applyMove(currentState, command);
        if (result.kind === "rejected") {
          return {
            valid: false,
            errorCode: "ILLEGAL_MOVE_IN_CHAIN",
            errorMessage: `Nước đi không hợp lệ tại sequence ${move.sequence} (${move.from} -> ${move.to}): ${result.error.code}`,
            moveCount: i,
          };
        }
        currentState = result.state;
      } catch (err) {
        return {
          valid: false,
          errorCode: "ILLEGAL_MOVE_IN_CHAIN",
          errorMessage: `Lỗi thực thi nước đi tại sequence ${move.sequence}: ${(err as Error).message}`,
          moveCount: i,
        };
      }
    }

    // 5. Compare final board state if expected final board was supplied
    if (input.finalBoard && typeof input.finalBoard === "object") {
      const expectedCells = (input.finalBoard as any).cells ?? (input.finalBoard as any).board ?? input.finalBoard;
      const actualCells = currentState.board;

      if (expectedCells && typeof expectedCells === "object" && actualCells) {
        // Compare piece count or keys
        const expectedKeys = Object.keys(expectedCells);
        for (const coord of expectedKeys) {
          const expPiece = (expectedCells as any)[coord];
          const actPiece = (actualCells as any)[coord];
          if (expPiece && actPiece) {
            if (expPiece.side !== actPiece.side || expPiece.type !== actPiece.type) {
              return {
                valid: false,
                errorCode: "FINAL_BOARD_MISMATCH",
                errorMessage: `Bàn cờ tái hiện không khớp tại tọa độ ${coord}: mong đợi ${expPiece.side} ${expPiece.type}, thực tế ${actPiece.side} ${actPiece.type}`,
                moveCount: input.moves.length,
                reconstructedBoard: currentState.board,
              };
            }
          } else if (expPiece !== actPiece) {
            return {
              valid: false,
              errorCode: "FINAL_BOARD_MISMATCH",
              errorMessage: `Bàn cờ tái hiện lệch quân tại tọa độ ${coord}`,
              moveCount: input.moves.length,
              reconstructedBoard: currentState.board,
            };
          }
        }
      }
    }

    return {
      valid: true,
      moveCount: input.moves.length,
      reconstructedBoard: currentState.board,
      finalWinner: currentState.winner ?? input.expectedWinner ?? null,
    };
  }
}
