import type { RuleState, Side } from "@ottv2/game-rules";
import { DEFAULT_BOT_LIMITS, decideLimitWinner, isFullRoundBoundary, scoreLimitCriteria, type LimitDecision } from "@ottv2/bot-sdk";

export type OfflineMatchEnding = { winner: Side; reason: string; state: RuleState; criteria?: LimitDecision };
function finish(state: RuleState, winner: Side): RuleState {
  // Non-board endings must not be reported as a canonical goal/extinction.
  return { ...state, status: "FINISHED", currentTurn: null, winner, resultReason: null };
}
export function offlineLimitResult(state: RuleState, completedTurns: number, activeComputeMs: number): OfflineMatchEnding | null {
  if (state.status !== "PLAYING" || !isFullRoundBoundary(state.currentTurn, completedTurns)) return null;
  if (completedTurns < DEFAULT_BOT_LIMITS.maxPlies && completedTurns / 2 < DEFAULT_BOT_LIMITS.maxRounds && activeComputeMs < DEFAULT_BOT_LIMITS.wholeMatchMs) return null;
  const criteria = decideLimitWinner(scoreLimitCriteria(state, "BLUE"), scoreLimitCriteria(state, "RED"));
  return { winner: criteria.winner, reason: criteria.reason, state: finish(state, criteria.winner), criteria };
}
export function offlineAuthorFaultResult(state: RuleState, side: Side, code: string): OfflineMatchEnding {
  const winner = side === "BLUE" ? "RED" : "BLUE";
  return { winner, reason: code, state: finish(state, winner) };
}
export function isOfflineAuthorFault(code: string): boolean {
  return ["TURN_TIMEOUT", "BOT_RUNTIME_FAILED", "ILLEGAL_OUTPUT", "ILLEGAL_MOVE", "OUTPUT_BUDGET", "FORBIDDEN_API", "IMPORT_NOT_ALLOWED"].includes(code);
}
