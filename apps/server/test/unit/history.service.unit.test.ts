import { describe, expect, it } from "vitest";

import { MatchHistoryService, toHistoryCard, toMatchProjection } from "../../src/modules/history/history.service.js";
import type { MatchSnapshot } from "@ottv2/contracts";

const finished: MatchSnapshot = {
  matchId: "11111111-1111-4111-8111-111111111111",
  roomId: "ABC234",
  hostUserId: "blue",
  mode: "UNRANKED",
  playMode: "BOT",
  status: "FINISHED",
  players: [
    { userId: "blue", username: "blue", displayName: "Xanh", side: "BLUE", ready: true, connected: true },
    { userId: "red", username: "red", displayName: "Đỏ", side: "RED", ready: true, connected: true },
  ],
  board: {},
  pieceCounts: { BLUE: { R: 0, P: 0, S: 0 }, RED: { R: 0, P: 0, S: 0 } },
  currentTurn: null,
  winner: "BLUE",
  resultReason: "GOAL_REACHED",
  clocksMs: { BLUE: 100, RED: 200 },
  timerSeconds: 30,
  countdownEndsAt: null,
  startedAt: 1_000,
  endedAt: 2_000,
  sequence: 3,
  stateVersion: 2,
  rating: null,
  moves: [{ sequence: 2, stateVersion: 2, side: "BLUE", from: "a1", to: "a2", capturedPieceId: null, committedAt: 1_500 }],
  publicTimeline: [
    { sequence: 1, type: "MATCH_STARTED", timestamp: 1_000 },
    { sequence: 2, type: "PIECE_MOVE_ACCEPTED", timestamp: 1_500, side: "BLUE" },
    { sequence: 3, type: "MATCH_FINISHED", timestamp: 2_000, reason: "GOAL_REACHED" },
  ],
  botAdjudication: { BLUE: { N: 3, P: 2, M: 5 }, RED: { N: 2, P: 1, M: 4 }, reason: "LIMIT_CRITERIA", trigger: "MAX_PLIES", faultSide: null },
};

const row = {
  id: finished.matchId,
  roomId: finished.roomId,
  mode: "UNRANKED",
  playMode: "BOT",
  status: "FINISHED",
  resultReason: "GOAL_REACHED",
  winnerSide: "BLUE",
  timerSeconds: 30,
  startedAt: new Date(1_000),
  endedAt: new Date(2_000),
  durationSeconds: 1,
  finalBoard: {},
  botAdjudication: { BLUE: { N: 3, P: 2, M: 5 }, RED: { N: 2, P: 1, M: 4 }, reason: "LIMIT_CRITERIA", trigger: "MAX_PLIES", faultSide: null },
  createdAt: new Date(1_000),
  players: [
    { id: "p1", matchId: finished.matchId, userId: "blue", username: "blue", displayName: "Xanh", side: "BLUE", isWinner: true, ratingBefore: null, ratingAfter: null, ratingDelta: null },
    { id: "p2", matchId: finished.matchId, userId: "red", username: "red", displayName: "Đỏ", side: "RED", isWinner: false, ratingBefore: null, ratingAfter: null, ratingDelta: null },
  ],
  moves: [{ id: "m1", matchId: finished.matchId, sequence: 2, stateVersion: 2, side: "BLUE", fromCoordinate: "a1", toCoordinate: "a2", capturedPieceId: null, committedAt: new Date(1_500) }],
  events: [
    { id: "e1", matchId: finished.matchId, sequence: 1, stateVersion: 1, type: "MATCH_STARTED", payload: { type: "MATCH_STARTED" }, createdAt: new Date(1_000) },
    { id: "e2", matchId: finished.matchId, sequence: 2, stateVersion: 2, type: "PIECE_MOVE_ACCEPTED", payload: { type: "PIECE_MOVE_ACCEPTED", side: "BLUE" }, createdAt: new Date(1_500) },
    { id: "e3", matchId: finished.matchId, sequence: 3, stateVersion: 2, type: "MATCH_FINISHED", payload: { type: "MATCH_FINISHED", reason: "GOAL_REACHED" }, createdAt: new Date(2_000) },
    { id: "e4", matchId: finished.matchId, sequence: 4, stateVersion: 2, type: "BOT_REVISION_APPLIED", payload: { type: "BOT_REVISION_APPLIED", side: "BLUE", revisionNumber: 2 }, createdAt: new Date(2_100) },
  ],
};

describe("R13 history replay and audit", () => {
  it("classifies Bot history and exposes only replay-safe public data", () => {
    const card = toHistoryCard(row as never, "blue");
    expect(card).toMatchObject({ mode: "BOT_ONLINE", source: "ACCOUNT", replayAvailable: true, moveCount: 1, botAdjudication: { reason: "LIMIT_CRITERIA", trigger: "MAX_PLIES", BLUE: { N: 3, P: 2, M: 5 } } });
    expect(JSON.stringify(card)).not.toContain("choose_move");
  });

  it("projects moves and sanitized public timeline without private source fields", () => {
    const projection = toMatchProjection(finished);
    expect(projection.playMode).toBe("BOT");
    expect(projection.moves).toMatchObject({ create: [expect.objectContaining({ fromCoordinate: "a1", toCoordinate: "a2" })] });
    expect((projection.events as { create: Array<{ type: string }> }).create).toEqual(expect.arrayContaining([expect.objectContaining({ type: "MATCH_STARTED" })]));
    expect(JSON.stringify(projection)).not.toContain("memory");
    expect(JSON.stringify(projection)).not.toContain("source");
  });

  it("returns replay and retention metadata for an authorized participant", async () => {
    const db = { match: { findUnique: async () => row } } as never;
    const service = new MatchHistoryService(db, () => 3_000);
    const audit = await service.audit("blue", finished.matchId);
    expect(audit.replay).toMatchObject({ available: true, legacyFinalBoardOnly: false });
    expect(audit.replay.moves[0]).toMatchObject({ from: "a1", to: "a2" });
    expect(audit.replay.timeline).toEqual(expect.arrayContaining([expect.objectContaining({ type: "BOT_REVISION_APPLIED", side: "BLUE", revisionNumber: 2 })]));
    expect(audit.retention.logsUntil).toBeTruthy();
  });
});
