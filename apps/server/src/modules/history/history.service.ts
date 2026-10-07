import type { Prisma, PrismaClient } from "@prisma/client";
import { MatchBoardSchema, MatchBotAdjudicationSchema, type HistoryAuditResponse, type HistoryDetailResponse, type HistoryListResponse, type HistoryMatchCard, type HistoryQuery, type HistoryReplay, type MatchSnapshot } from "@ottv2/contracts";

import { AppError } from "../../shared/errors/app-error.js";

type MatchWithPlayers = Prisma.MatchGetPayload<{ include: { players: true; moves: true; events: true } }>;
type HistoryRow = MatchWithPlayers;

function unavailable(): never {
  throw new AppError("SERVICE_UNAVAILABLE", "Lịch sử đấu hiện chưa sẵn sàng.", 503, true, "RECOVERABLE");
}

function resultFor(row: HistoryRow, viewerId: string): HistoryMatchCard["result"] {
  if (row.status === "ABORTED" || row.resultReason === "SERVER_INTERRUPTION") return "ABORTED";
  return row.players.find((player) => player.userId === viewerId)?.isWinner ? "WIN" : "LOSS";
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function playerProjection(row: HistoryRow, userId: string) {
  const player = row.players.find((item) => item.userId === userId);
  if (!player) return null;
  return {
    userId: player.userId,
    username: player.username,
    displayName: player.displayName,
    side: player.side as "BLUE" | "RED",
    isViewer: player.userId === userId,
    isWinner: player.isWinner,
    ratingBefore: player.ratingBefore,
    ratingAfter: player.ratingAfter,
    ratingDelta: player.ratingDelta,
  };
}

function historyMode(row: HistoryRow): HistoryMatchCard["mode"] {
  if (row.playMode === "BOT") return "BOT_ONLINE";
  return row.mode as HistoryMatchCard["mode"];
}

function replayFor(row: HistoryRow): HistoryReplay {
  const moves = (row.moves ?? []).map((move) => ({
    sequence: move.sequence,
    stateVersion: move.stateVersion,
    side: move.side as "BLUE" | "RED",
    from: move.fromCoordinate,
    to: move.toCoordinate,
    capturedPieceId: move.capturedPieceId,
    committedAt: move.committedAt.toISOString(),
  }));
  const timeline = (row.events ?? []).flatMap((event) => {
    const payload = event.payload as { type?: unknown; side?: unknown; reason?: unknown };
    if (payload.type !== "MATCH_STARTED" && payload.type !== "PIECE_MOVE_ACCEPTED" && payload.type !== "MATCH_PAUSED" && payload.type !== "MATCH_RESUMED" && payload.type !== "REFEREE_REPLACED" && payload.type !== "BOT_REVISION_APPLIED" && payload.type !== "MATCH_FINISHED" && payload.type !== "MATCH_ABORTED") return [];
    const side: "BLUE" | "RED" | undefined = payload.side === "BLUE" || payload.side === "RED" ? payload.side : undefined;
    const reason: string | undefined = typeof payload.reason === "string" ? payload.reason : undefined;
    const revisionNumber: number | undefined = typeof (payload as { revisionNumber?: unknown }).revisionNumber === "number" && Number.isInteger((payload as { revisionNumber?: number }).revisionNumber) && (payload as { revisionNumber: number }).revisionNumber > 0 ? (payload as { revisionNumber: number }).revisionNumber : undefined;
    return [{
      sequence: event.sequence,
      type: payload.type,
      timestamp: event.createdAt.toISOString(),
      ...(side ? { side } : {}),
      ...(reason ? { reason } : {}),
      ...(revisionNumber ? { revisionNumber } : {}),
    }] as const;
  });
  return { available: moves.length > 0, moves, timeline, legacyFinalBoardOnly: moves.length === 0 };
}

export function toHistoryCard(row: HistoryRow, viewerId: string): HistoryMatchCard {
  const viewer = playerProjection(row, viewerId);
  if (!viewer) throw new AppError("NOT_FOUND", "Không tìm thấy trận đấu.", 404, false, "INVALID");
  const opponent = row.players.find((item) => item.userId !== viewerId);
  const endedAt = row.endedAt ?? row.createdAt;
  const durationSeconds = row.durationSeconds ?? (row.startedAt ? Math.max(0, Math.round((endedAt.getTime() - row.startedAt.getTime()) / 1000)) : 0);
  return {
    matchId: row.id,
    roomId: row.roomId,
    mode: historyMode(row),
    status: row.status as "FINISHED" | "ABORTED",
    result: resultFor(row, viewerId),
    resultReason: row.resultReason as HistoryMatchCard["resultReason"],
    winner: row.winnerSide as HistoryMatchCard["winner"],
    viewer,
    opponent: opponent ? playerProjection(row, opponent.userId) : null,
    timerSeconds: row.timerSeconds,
    startedAt: iso(row.startedAt),
    endedAt: endedAt.toISOString(),
    durationSeconds,
    ratingDelta: viewer.ratingDelta,
    finalBoard: MatchBoardSchema.safeParse(row.finalBoard).success ? MatchBoardSchema.parse(row.finalBoard) : null,
    source: "ACCOUNT",
    replayAvailable: (row.moves?.length ?? 0) > 0,
    moveCount: row.moves?.length ?? 0,
    ...(MatchBotAdjudicationSchema.safeParse(row.botAdjudication).success ? { botAdjudication: MatchBotAdjudicationSchema.parse(row.botAdjudication) } : {}),
  };
}

export function toMatchProjection(match: MatchSnapshot, playMode: "MANUAL" | "BOT" = match.playMode ?? "MANUAL"): Prisma.MatchCreateInput {
  const endedAt = match.endedAt ? new Date(match.endedAt) : new Date();
  const startedAt = match.startedAt ? new Date(match.startedAt) : null;
  return {
    id: match.matchId,
    roomId: match.roomId,
    mode: match.mode,
    playMode,
    status: match.status === "ABORTED" ? "ABORTED" : "FINISHED",
    resultReason: match.resultReason,
    winnerSide: match.winner,
    timerSeconds: match.timerSeconds,
    startedAt,
    endedAt,
    durationSeconds: startedAt ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)) : 0,
    finalBoard: match.board,
    ...(match.botAdjudication ? { botAdjudication: match.botAdjudication } : {}),
    players: {
      create: match.players.map((player) => ({
        userId: player.userId,
        username: player.username,
        displayName: player.displayName,
        side: player.side,
        isWinner: match.winner ? match.winner === player.side : null,
        ...(match.rating && player.side === "BLUE" ? { ratingBefore: match.rating.blueBefore, ratingAfter: match.rating.blueAfter, ratingDelta: match.rating.blueDelta } : {}),
        ...(match.rating && player.side === "RED" ? { ratingBefore: match.rating.redBefore, ratingAfter: match.rating.redAfter, ratingDelta: match.rating.redDelta } : {}),
      })),
    },
    ...(match.moves && match.moves.length > 0 ? { moves: { create: match.moves.map((move) => ({ sequence: move.sequence, stateVersion: move.stateVersion, side: move.side, fromCoordinate: move.from, toCoordinate: move.to, capturedPieceId: move.capturedPieceId, committedAt: new Date(move.committedAt) })) } } : {}),
    ...(match.publicTimeline && match.publicTimeline.length > 0 ? { events: { create: match.publicTimeline.map((event) => ({ sequence: event.sequence, stateVersion: match.stateVersion, type: event.type, payload: { type: event.type, ...(event.side ? { side: event.side } : {}), ...(event.reason ? { reason: event.reason } : {}) }, createdAt: new Date(event.timestamp) })) } } : {}),
  };
}

export class MatchHistoryService {
  private readonly pending = new Map<string, { match: MatchSnapshot; playMode: "MANUAL" | "BOT" }>();
  private readonly retryTimer?: NodeJS.Timeout;

  constructor(private readonly db?: PrismaClient, private readonly now: () => number = Date.now) {
    if (db) this.retryTimer = setInterval(() => { void this.flush(); }, 5_000);
  }

  async record(match: MatchSnapshot, playMode: "MANUAL" | "BOT" = match.playMode ?? "MANUAL"): Promise<void> {
    if (match.status !== "FINISHED" && match.status !== "ABORTED") return;
    if (!this.db) {
      this.pending.set(match.matchId, { match, playMode });
      return;
    }
    try {
      await this.write(match, playMode);
      this.pending.delete(match.matchId);
    } catch {
      this.pending.set(match.matchId, { match, playMode });
    }
  }

  async flush(): Promise<number> {
    if (!this.db || this.pending.size === 0) return 0;
    let flushed = 0;
    for (const [matchId, pending] of [...this.pending.entries()]) {
      try {
        await this.write(pending.match, pending.playMode);
        this.pending.delete(matchId);
        flushed += 1;
      } catch {
        // Keep the item queued; the next timer tick retries it.
      }
    }
    return flushed;
  }

  pendingCount(): number { return this.pending.size; }

  async list(userId: string, query: HistoryQuery): Promise<HistoryListResponse> {
    const db = this.db;
    if (!db) unavailable();
    const where = this.whereFor(userId, query);
    const rows = await db.match.findMany({
      where,
      include: { players: true, moves: true, events: true },
      orderBy: [{ endedAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const summaryRows = await db.match.findMany({ where, include: { players: true, moves: true, events: true }, orderBy: { endedAt: "desc" } });
    const cards = page.map((row) => toHistoryCard(row, userId));
    const summary = await this.summary(db, summaryRows, userId);
    return { matches: cards, nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null, hasMore, summary };
  }

  async detail(userId: string, matchId: string): Promise<HistoryDetailResponse> {
    const db = this.db;
    if (!db) unavailable();
    const row = await db.match.findUnique({ where: { id: matchId }, include: { players: true, moves: true, events: true } });
    if (!row || !row.players.some((player) => player.userId === userId)) throw new AppError("NOT_FOUND", "Không tìm thấy trận đấu.", 404, false, "INVALID");
    const card = toHistoryCard(row, userId);
    return { match: { ...card, players: row.players.map((player) => playerProjection(row, player.userId)!).filter(Boolean), replay: replayFor(row) } };
  }

  async audit(userId: string, matchId: string): Promise<HistoryAuditResponse> {
    const detail = await this.detail(userId, matchId);
    const endedAt = new Date(detail.match.endedAt).getTime();
    const replay = detail.match.replay ?? { available: false, moves: [], timeline: [], legacyFinalBoardOnly: true };
    return {
      match: detail.match,
      replay,
      exportedAt: new Date(this.now()).toISOString(),
      retention: {
        sourceUntil: new Date(endedAt + 30 * 24 * 60 * 60 * 1000).toISOString(),
        logsUntil: new Date(endedAt + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    };
  }

  stop(): void {
    if (this.retryTimer) clearInterval(this.retryTimer);
  }

  private async write(match: MatchSnapshot, playMode: "MANUAL" | "BOT"): Promise<void> {
    const db = this.db;
    if (!db) unavailable();
    const data = toMatchProjection(match, playMode);
    await db.$transaction(async (tx) => {
      const existing = await tx.match.findUnique({ where: { id: match.matchId }, include: { players: true } });
      if (!existing) {
        await tx.match.create({ data });
        return;
      }
      if (!match.rating) return;
      for (const player of match.players) {
        const rating = player.side === "BLUE" ? { ratingBefore: match.rating.blueBefore, ratingAfter: match.rating.blueAfter, ratingDelta: match.rating.blueDelta } : { ratingBefore: match.rating.redBefore, ratingAfter: match.rating.redAfter, ratingDelta: match.rating.redDelta };
        await tx.matchPlayer.updateMany({ where: { matchId: match.matchId, userId: player.userId }, data: rating });
      }
    });
  }

  private whereFor(userId: string, query: HistoryQuery): Prisma.MatchWhereInput {
    const where: Prisma.MatchWhereInput = { players: { some: { userId } } };
    if (query.mode !== "ALL") {
      if (query.mode === "BOT_ONLINE") { where.mode = "UNRANKED"; where.playMode = "BOT"; }
      else if (query.mode === "BOT_OFFLINE") { where.mode = "__LOCAL_ONLY__"; }
      else if (query.mode === "OFFLINE" || query.mode === "AI" || query.mode === "GUEST") { where.mode = query.mode; }
      else where.mode = query.mode;
    }
    if (query.result === "WIN") where.players = { some: { userId, isWinner: true } };
    if (query.result === "LOSS") where.players = { some: { userId, isWinner: false } };
    if (query.range !== "ALL") {
      const days = query.range === "7D" ? 7 : 30;
      where.endedAt = { gte: new Date(this.now() - days * 24 * 60 * 60 * 1000) };
    }
    return where;
  }

  private async summary(db: PrismaClient, rows: HistoryRow[], userId: string): Promise<HistoryListResponse["summary"]> {
    const wins = rows.filter((row) => resultFor(row, userId) === "WIN").length;
    const losses = rows.filter((row) => resultFor(row, userId) === "LOSS").length;
    const stats = await db.userStats.findUnique({ where: { userId } });
    const total = wins + losses;
    return { elo: stats?.elo ?? 1000, wins, losses, total: rows.length, winRate: total ? Math.round((wins / total) * 1000) / 10 : 0 };
  }
}
