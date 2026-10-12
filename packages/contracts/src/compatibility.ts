import { CompactMatchSnapshotSchema, type CompactMatchSnapshot } from "./snapshot.js";
import { MatchSnapshotSchema, type MatchSnapshot } from "./match.js";

export function adaptSnapshotV1ToV2(
  snapshotV1: Record<string, any>,
  serverTime = Date.now()
): CompactMatchSnapshot {
  if (snapshotV1.protocolVersion && snapshotV1.protocolVersion !== "0.1") {
    throw new Error(`Unsupported protocol version: ${snapshotV1.protocolVersion}`);
  }

  const v2Candidate = {
    matchId: snapshotV1.matchId,
    roomId: snapshotV1.roomId,
    mode: snapshotV1.mode,
    status: snapshotV1.status,
    players: snapshotV1.players,
    board: snapshotV1.board,
    pieceCounts: snapshotV1.pieceCounts,
    currentTurn: snapshotV1.currentTurn,
    winner: snapshotV1.winner,
    resultReason: snapshotV1.resultReason,
    clocksMs: snapshotV1.clocksMs,
    runningSide: snapshotV1.runningSide ?? (snapshotV1.status === "PLAYING" ? snapshotV1.currentTurn : null),
    serverTime: snapshotV1.serverTime ?? serverTime,
    sequence: snapshotV1.sequence,
    stateVersion: snapshotV1.stateVersion,
    countdownEndsAt: snapshotV1.countdownEndsAt ?? null,
    startedAt: snapshotV1.startedAt ?? null,
    endedAt: snapshotV1.endedAt ?? null,
    pauseReason: snapshotV1.pauseReason ?? null,
    pauseCategory: snapshotV1.pauseCategory ?? null,
    pausedAt: snapshotV1.pausedAt ?? null,
    pausePhase: snapshotV1.pausePhase ?? null,
    pauseElapsedMs: snapshotV1.pauseElapsedMs ?? 0,
    resumeEndsAt: snapshotV1.resumeEndsAt ?? null,
    replacementStatus: snapshotV1.replacementStatus ?? "IDLE",
  };

  return CompactMatchSnapshotSchema.parse(v2Candidate);
}

export function adaptSnapshotV2ToV1(
  snapshotV2: CompactMatchSnapshot
): MatchSnapshot {
  const v1Candidate = {
    matchId: snapshotV2.matchId,
    roomId: snapshotV2.roomId,
    mode: snapshotV2.mode,
    playMode: "MANUAL" as const,
    status: snapshotV2.status,
    players: snapshotV2.players,
    board: snapshotV2.board,
    pieceCounts: snapshotV2.pieceCounts,
    currentTurn: snapshotV2.currentTurn,
    winner: snapshotV2.winner,
    resultReason: snapshotV2.resultReason,
    clocksMs: snapshotV2.clocksMs,
    timerSeconds: 30,
    countdownEndsAt: snapshotV2.countdownEndsAt ?? null,
    startedAt: snapshotV2.startedAt ?? null,
    endedAt: snapshotV2.endedAt ?? null,
    sequence: snapshotV2.sequence,
    stateVersion: snapshotV2.stateVersion,
    rating: null,
    pauseReason: snapshotV2.pauseReason ?? null,
    pauseCategory: snapshotV2.pauseCategory ?? null,
    pausedAt: snapshotV2.pausedAt ?? null,
    pausePhase: snapshotV2.pausePhase ?? null,
    pauseElapsedMs: snapshotV2.pauseElapsedMs ?? 0,
    resumeEndsAt: snapshotV2.resumeEndsAt ?? null,
    replacementStatus: snapshotV2.replacementStatus ?? "IDLE",
  };

  return MatchSnapshotSchema.parse(v1Candidate);
}
