import type { MatchSnapshot } from "@ottv2/contracts";
import type { Side } from "@ottv2/game-rules";

/**
 * Match timestamps are epoch milliseconds. Public pause/resume markers are
 * preferred when available; the authoritative aggregate pauseElapsedMs is a
 * safe fallback for older snapshots and is never added to active play time.
 */
export function calculateActiveDurationSeconds(match: Pick<MatchSnapshot, "startedAt" | "endedAt" | "pauseElapsedMs" | "publicTimeline">): number {
  if (!match.startedAt || !match.endedAt) return 0;
  const elapsedMs = Math.max(0, match.endedAt - match.startedAt);
  let pauseStartedAt: number | null = null;
  let timelinePauseMs = 0;
  for (const event of [...(match.publicTimeline ?? [])].sort((left, right) => left.timestamp - right.timestamp)) {
    if (event.type === "MATCH_PAUSED") pauseStartedAt ??= event.timestamp;
    if (event.type === "MATCH_RESUMED" && pauseStartedAt !== null) {
      timelinePauseMs += Math.max(0, event.timestamp - pauseStartedAt);
      pauseStartedAt = null;
    }
  }
  if (pauseStartedAt !== null) timelinePauseMs += Math.max(0, match.endedAt - pauseStartedAt);
  const pauseMs = Math.max(match.pauseElapsedMs ?? 0, timelinePauseMs);
  return Math.floor(Math.max(0, elapsedMs - pauseMs) / 1000);
}

export function calculateResultStats(match: Pick<MatchSnapshot, "startedAt" | "endedAt" | "pauseElapsedMs" | "publicTimeline" | "moves">, viewerSide: Side | null, fallbackMoveCount = 0) {
  const moves = match.moves ?? [];
  return {
    moves: Math.max(fallbackMoveCount, moves.length),
    captures: moves.filter((move) => move.capturedPieceId !== null && move.side === viewerSide).length,
    piecesLost: moves.filter((move) => move.capturedPieceId !== null && move.side !== viewerSide).length,
    durationSeconds: calculateActiveDurationSeconds(match),
  };
}
