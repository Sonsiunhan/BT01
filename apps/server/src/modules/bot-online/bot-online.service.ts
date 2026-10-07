import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_BOT_LIMITS,
  BotOutputValidationError,
  RuntimeCancelledError,
  RuntimeNotProvenError,
  createIsolatedRuntimeHarness,
  decideLimitWinner,
  scoreLimitCriteria,
  type IsolatedRuntimeAdapter,
  type JsonValue,
} from "@ottv2/bot-sdk";
import type { BotOnlinePlayer, BotOnlineSnapshot, BotRevision, RoomDetail } from "@ottv2/contracts";
import { getLegalDestinations, type Coordinate, type PieceType, type RuleState, type Side } from "@ottv2/game-rules";

import { AppError } from "../../shared/errors/app-error.js";
import { BotLibraryService } from "../bot-library/bot-library.service.js";
import { MatchManager, type MatchActor } from "../match/match.manager.js";
import { WasmtimeBusyError, WasmtimeProviderError } from "./wasmtime.adapter.js";

type BotSlot = {
  userId: string;
  principal?: "ACCOUNT" | "GUEST";
  displayName: string;
  side: Side;
  botId: string;
  botName: string;
  activeRevisionId: string;
  activeRevisionNumber: number;
  pendingRevisionId: string | null;
  pendingRevisionNumber: number | null;
  memory: JsonValue;
  thinking: boolean;
  owner: boolean;
};

type PrivateCheckpoint = {
  sessionId: string;
  roomId: string;
  matchId?: string | null;
  slots: BotSlot[];
  moves: BotOnlineSnapshot["moves"];
  revisionNotice: string | null;
  lastCommittedStateVersion?: number;
  lastCommittedSequence?: number;
  activeComputeMs?: number;
};

export interface BotOnlineStatePersistence {
  load(roomId: string): PrivateCheckpoint | null;
  save(checkpoint: PrivateCheckpoint): void;
}

export class InMemoryBotOnlineStatePersistence implements BotOnlineStatePersistence {
  private readonly values = new Map<string, PrivateCheckpoint>();
  load(roomId: string): PrivateCheckpoint | null { const value = this.values.get(roomId); return value ? structuredClone(value) : null; }
  save(checkpoint: PrivateCheckpoint): void { this.values.set(checkpoint.roomId, structuredClone(checkpoint)); }
}

/**
 * Optional single-host private checkpoint adapter. It stores only revision
 * references and bot memory; source and logs never enter the public snapshot.
 * Render's ephemeral filesystem must not be described as restart durable.
 */
export class FileBotOnlineStatePersistence implements BotOnlineStatePersistence {
  constructor(private readonly directory: string) { mkdirSync(directory, { recursive: true }); }
  load(roomId: string): PrivateCheckpoint | null {
    const path = this.path(roomId);
    if (!existsSync(path)) return null;
    try { return JSON.parse(readFileSync(path, "utf8")) as PrivateCheckpoint; } catch { return null; }
  }
  save(checkpoint: PrivateCheckpoint): void {
    const path = this.path(checkpoint.roomId);
    const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
    writeFileSync(temporary, JSON.stringify(checkpoint), { encoding: "utf8", mode: 0o600 });
    renameSync(temporary, path);
  }
  private path(roomId: string): string { return join(this.directory, `${roomId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`); }
}

type Session = {
  sessionId: string;
  roomId: string;
  matchId: string | null;
  slots: Map<Side, BotSlot>;
  moves: BotOnlineSnapshot["moves"];
  revisionNotice: string | null;
  runtimeState: BotOnlineSnapshot["runtimeState"];
  inFlight: boolean;
  timer: NodeJS.Timeout | undefined;
  abortSignal: { aborted: boolean } | undefined;
  lastSnapshot: ReturnType<MatchManager["ensure"]> | null;
  activeComputeMs: number;
  lastCommittedStateVersion: number;
  lastCommittedSequence: number;
};

export type BotOnlineRuntime = ReturnType<typeof createIsolatedRuntimeHarness>;

function actorFor(slot: BotSlot): MatchActor { return { userId: slot.userId, username: slot.botName, displayName: slot.displayName, principal: slot.principal ?? (slot.userId.startsWith("guest:") ? "GUEST" : "ACCOUNT") }; }
function hashSeed(sessionId: string, sequence: number): number { return Number.parseInt(createHash("sha256").update(`${sessionId}:${sequence}`).digest("hex").slice(0, 8), 16); }
function deriveMove(previous: ReturnType<MatchManager["ensure"]> | null, next: ReturnType<MatchManager["ensure"]>): BotOnlineSnapshot["moves"][number] | null {
  if (!previous || next.sequence <= previous.sequence) return null;
  const previousById = new Map(Object.entries(previous.board).filter((entry): entry is [Coordinate, NonNullable<typeof entry[1]>] => entry[1] !== null).map(([coordinate, piece]) => [piece.id, coordinate]));
  const nextById = new Map(Object.entries(next.board).filter((entry): entry is [Coordinate, NonNullable<typeof entry[1]>] => entry[1] !== null).map(([coordinate, piece]) => [piece.id, coordinate]));
  for (const [id, coordinate] of nextById) {
    const from = previousById.get(id);
    if (!from || from === coordinate) continue;
    const moved = next.board[coordinate];
    const captured = previous.board[coordinate];
    if (!moved) continue;
    return { sequence: next.sequence, side: moved.side, from, to: coordinate, captured: captured && captured.side !== moved.side ? captured.type : null };
  }
  return null;
}

function ruleStateForMatch(match: ReturnType<MatchManager["ensure"]>): RuleState {
  return { board: match.board as RuleState["board"], pieceCounts: match.pieceCounts, currentTurn: match.currentTurn, status: "PLAYING", winner: null, resultReason: null };
}

export class BotOnlineService {
  private readonly sessions = new Map<string, Session>();
  private readonly changingRooms = new Set<string>();

  private async changeFor<T>(roomId: string, work: () => Promise<T>): Promise<T> {
    if (this.changingRooms.has(roomId)) throw new AppError("CONFLICT", "Phòng đang cập nhật chiến thuật. Hãy thử lại.", 409, true, "RECOVERABLE");
    this.changingRooms.add(roomId);
    try { return await work(); } finally { this.changingRooms.delete(roomId); }
  }

  private revisionIds(session: Session): string[] {
    return [...session.slots.values()].flatMap(slot => [slot.activeRevisionId, ...(slot.pendingRevisionId ? [slot.pendingRevisionId] : [])]);
  }
  private readonly persistence: BotOnlineStatePersistence;
  private readonly runtime: BotOnlineRuntime;

  constructor(
    private readonly library: BotLibraryService,
    private readonly matches: MatchManager,
    options: { adapter?: IsolatedRuntimeAdapter; persistence?: BotOnlineStatePersistence; now?: () => number; resolveRoom?: (roomId: string, userId: string) => RoomDetail } = {},
  ) {
    this.persistence = options.persistence ?? new InMemoryBotOnlineStatePersistence();
    this.runtime = createIsolatedRuntimeHarness(options.adapter);
    this.now = options.now ?? Date.now;
    this.resolveRoom = options.resolveRoom;
  }

  private readonly now: () => number;
  private readonly resolveRoom: ((roomId: string, userId: string) => RoomDetail) | undefined;

  private currentPlayerRoom(room: RoomDetail, userId: string, side: Side, matchId: string): RoomDetail {
    const currentRoom = this.resolveRoom?.(room.roomId, userId) ?? room;
    if (!currentRoom.members.some((member) => member.userId === userId) || this.matches.getViewerSide(currentRoom, userId) !== side || this.matches.ensure(currentRoom).matchId !== matchId) {
      throw new AppError("CONFLICT", "Vai trò hoặc trận đấu đã thay đổi — phiên bản chưa áp dụng.", 409, false, "INVALID");
    }
    return currentRoom;
  }

  private assertBotRoom(room: RoomDetail): void {
    if (room.playMode !== "BOT") throw new AppError("CONFLICT", "Phòng này không phải phòng Đấu chương trình.", 409, false, "INVALID", { reason: "BOT_ROOM_REQUIRED" });
    if (room.mode !== "UNRANKED") throw new AppError("CONFLICT", "Đấu chương trình chỉ dùng cho phòng thường.", 409, false, "INVALID", { reason: "BOT_RANKED_FORBIDDEN" });
  }

  private async revision(ownerUserId: string, botId: string, revisionId: string): Promise<{ botName: string; revision: BotRevision; source: string }> {
    const library = await this.library.list(ownerUserId);
    const bot = library.bots.find((item) => item.id === botId);
    const revision = bot?.revisions.find((item) => item.id === revisionId);
    if (!bot || !revision) throw new AppError("NOT_FOUND", "Không tìm thấy bot hoặc revision.", 404, false, "INVALID");
    if (revision.status !== "PASSED") throw new AppError("CONFLICT", "Revision phải được kiểm tra thành công trước khi Sẵn sàng.", 409, false, "INVALID", { reason: "BOT_REVISION_NOT_TESTED", status: revision.status });
    // Historical PASSED metadata could have come from static-only validation.
    // Selection must attest the immutable source in the current isolated runtime.
    const tested = await this.library.testRevision(ownerUserId, botId, revisionId);
    if (tested.revision.status !== "PASSED") throw new AppError("CONFLICT", "Revision không hoàn tất nước thử sandbox hợp lệ.", 409, false, "INVALID", { reason: "BOT_REVISION_NOT_TESTED" });
    return { botName: bot.name, revision: tested.revision, source: await this.library.source(ownerUserId, botId, revisionId) };
  }

  private session(room: RoomDetail): Session {
    this.assertBotRoom(room);
    let session = this.sessions.get(room.roomId);
    if (!session) {
      const checkpoint = this.persistence.load(room.roomId);
      session = checkpoint ? {
        sessionId: checkpoint.sessionId,
        roomId: room.roomId,
        matchId: checkpoint.matchId ?? null,
        slots: new Map(checkpoint.slots.map((slot) => [slot.side, slot])),
        moves: checkpoint.moves,
        revisionNotice: checkpoint.revisionNotice,
        runtimeState: "READY",
        inFlight: false,
        lastSnapshot: null,
        activeComputeMs: checkpoint.activeComputeMs ?? 0,
        timer: undefined,
        abortSignal: undefined,
        lastCommittedStateVersion: checkpoint.lastCommittedStateVersion ?? 0,
        lastCommittedSequence: checkpoint.lastCommittedSequence ?? 0,
      } : { sessionId: randomUUID(), roomId: room.roomId, matchId: null, slots: new Map(), moves: [], revisionNotice: null, runtimeState: "READY", inFlight: false, lastSnapshot: null, activeComputeMs: 0, timer: undefined, abortSignal: undefined, lastCommittedStateVersion: 0, lastCommittedSequence: 0 };
      this.sessions.set(room.roomId, session);
    }
    return session;
  }

  private syncMatch(session: Session, match: ReturnType<MatchManager["ensure"]>): void {
    if (session.matchId === null) {
      session.matchId = match.matchId;
      this.persist(session);
      return;
    }
    if (session.matchId === match.matchId) return;
    if (session.abortSignal) session.abortSignal.aborted = true;
    if (session.timer) clearInterval(session.timer);
    session.timer = undefined;
    session.matchId = match.matchId;
    session.moves = [];
    session.revisionNotice = null;
    session.runtimeState = "READY";
    session.inFlight = false;
    session.abortSignal = undefined;
    session.lastSnapshot = null;
    session.activeComputeMs = 0;
    session.lastCommittedStateVersion = 0;
    session.lastCommittedSequence = 0;
    const previousSlots = new Map(session.slots);
    const rematchedSlots = new Map<Side, BotSlot>();
    for (const player of match.players) {
      const slot = [...previousSlots.values()].find((candidate) => candidate.userId === player.userId);
      if (!slot) continue;
      slot.side = player.side;
      slot.pendingRevisionId = null;
      slot.pendingRevisionNumber = null;
      slot.memory = null;
      slot.thinking = false;
      rematchedSlots.set(player.side, slot);
    }
    session.slots = rematchedSlots;
    this.persist(session);
  }

  private slotFor(session: Session, room: RoomDetail, userId: string): BotSlot {
    const side = this.matches.getViewerSide(room, userId);
    if (!side) throw new AppError("UNAUTHORIZED", "Bạn không phải người chơi của phòng Bot.", 403, false, "FATAL_SESSION", { reason: "BOT_PLAYER_REQUIRED" });
    const slot = session.slots.get(side);
    if (!slot || slot.userId !== userId) throw new AppError("CONFLICT", "Hãy chọn bot cho đúng slot trước.", 409, false, "INVALID", { reason: "BOT_NOT_SELECTED" });
    return slot;
  }

  async select(room: RoomDetail, actor: MatchActor, botId: string, revisionId: string): Promise<BotOnlineSnapshot> {
    return this.changeFor(room.roomId, () => this.selectCandidate(room, actor, botId, revisionId));
  }

  private async selectCandidate(room: RoomDetail, actor: MatchActor, botId: string, revisionId: string): Promise<BotOnlineSnapshot> {
    const session = this.session(room);
    const match = this.matches.ensure(room);
    this.syncMatch(session, match);
    if (match.status !== "WAITING_READY") throw new AppError("CONFLICT", "Không thể đổi bot sau khi phòng đã bắt đầu chuẩn bị.", 409, false, "INVALID", { reason: "BOT_SELECTION_LOCKED" });
    const side = this.matches.getViewerSide(room, actor.userId);
    if (!side) throw new AppError("UNAUTHORIZED", "Bạn không phải người chơi của phòng Bot.", 403, false, "FATAL_SESSION", { reason: "BOT_PLAYER_REQUIRED" });
    const selected = await this.revision(actor.userId, botId, revisionId);
    room = this.currentPlayerRoom(room, actor.userId, side, match.matchId);
    if (this.matches.ensure(room).status !== "WAITING_READY") throw new AppError("CONFLICT", "Phòng đã bắt đầu chuẩn bị — không thể đổi bot.", 409, false, "INVALID");
    const previous = session.slots.get(side);
    const candidate: BotSlot = { userId: actor.userId, principal: actor.principal ?? "ACCOUNT", displayName: actor.displayName, side, botId, botName: selected.botName, activeRevisionId: revisionId, activeRevisionNumber: selected.revision.revisionNumber, pendingRevisionId: null, pendingRevisionNumber: null, memory: null, thinking: false, owner: true };
    // Persist references before publishing a selection. A failed storage write
    // must not grant Ready or leave an unacknowledged bot in the live session.
    const slots = new Map(session.slots); slots.set(side, candidate);
    await this.library.retainMatchRevisions(match.matchId, [...new Set([...this.revisionIds(session), ...[...slots.values()].flatMap(slot => [slot.activeRevisionId, ...(slot.pendingRevisionId ? [slot.pendingRevisionId] : [])])])]);
    room = this.currentPlayerRoom(room, actor.userId, side, match.matchId);
    if (this.matches.ensure(room).status !== "WAITING_READY" || session.slots.get(side) !== previous) throw new AppError("CONFLICT", "Phòng đã thay đổi — lựa chọn chưa được áp dụng.", 409, false, "INVALID");
    session.slots.set(side, candidate);
    session.runtimeState = "READY";
    this.persist(session);
    // Cleanup failure cannot turn an already committed selection into an HTTP
    // failure. Conservative extra pins remain until the next successful sweep.
    await this.library.retainMatchRevisions(match.matchId, this.revisionIds(session)).catch(() => undefined);
    return this.snapshot(room, actor.userId);
  }

  async upload(room: RoomDetail, actor: MatchActor, botId: string, source: string): Promise<BotOnlineSnapshot> {
    return this.changeFor(room.roomId, () => this.uploadCandidate(room, actor, botId, source));
  }

  private async uploadCandidate(room: RoomDetail, actor: MatchActor, botId: string, source: string): Promise<BotOnlineSnapshot> {
    const session = this.session(room);
    const match = this.matches.ensure(room);
    this.syncMatch(session, match);
    const slot = this.slotFor(session, room, actor.userId);
    if (slot.botId !== botId) throw new AppError("UNAUTHORIZED", "Revision không thuộc bot đang dùng trong phòng.", 403, false, "FATAL_SESSION", { reason: "BOT_REVISION_OWNER_MISMATCH" });
    if (match.status === "FINISHED" || match.status === "ABORTED") throw new AppError("CONFLICT", "Trận đã kết thúc — phiên bản chưa áp dụng.", 409, false, "INVALID", { reason: "MATCH_TERMINAL" });
    if (match.status === "PAUSED" || match.status === "RESUMING") throw new AppError("CONFLICT", "Trận đang dừng — phiên bản chưa áp dụng.", 409, false, "INVALID");
    // A transient preflight failure must be retryable with the same uploaded
    // file. Reuse its immutable owned revision rather than creating a duplicate
    // digest (which durable storage correctly rejects).
    const sourceDigest = createHash("sha256").update(source, "utf8").digest("hex");
    const existing = (await this.library.list(actor.userId)).bots.find(bot => bot.id === botId)?.revisions.find(revision => revision.sourceDigest === sourceDigest);
    if (existing?.id === slot.activeRevisionId) throw new AppError("CONFLICT", "Tệp này giống phiên bản đang chạy. Hãy chọn chiến thuật đã thay đổi.", 409, false, "INVALID");
    const created = existing ? { revision: existing } : await this.library.createRevision(actor.userId, botId, source);
    const tested = await this.library.testRevision(actor.userId, botId, created.revision.id);
    if (tested.revision.status !== "PASSED") throw new AppError("VALIDATION_ERROR", "Revision mới chưa vượt qua kiểm tra.", 400, false, "INVALID", { reason: "BOT_REVISION_INVALID" });
    room = this.currentPlayerRoom(room, actor.userId, slot.side, match.matchId);
    const current = this.matches.ensure(room);
    if (["FINISHED", "ABORTED", "PAUSED", "RESUMING"].includes(current.status) || session.slots.get(slot.side) !== slot) throw new AppError("CONFLICT", "Trạng thái trận đã thay đổi — phiên bản chỉ được lưu vào thư viện.", 409, false, "INVALID");
    const previousPending = slot.pendingRevisionId;
    await this.library.retainMatchRevisions(match.matchId, [...this.revisionIds(session), tested.revision.id]);
    room = this.currentPlayerRoom(room, actor.userId, slot.side, match.matchId);
    if (["FINISHED", "ABORTED", "PAUSED", "RESUMING"].includes(this.matches.ensure(room).status) || session.slots.get(slot.side) !== slot || slot.pendingRevisionId !== previousPending) throw new AppError("CONFLICT", "Trạng thái trận đã thay đổi — phiên bản chỉ được lưu vào thư viện.", 409, false, "INVALID");
    slot.pendingRevisionId = tested.revision.id;
    slot.pendingRevisionNumber = tested.revision.revisionNumber;
    session.revisionNotice = `${actor.displayName} đã xếp revision #${tested.revision.revisionNumber} cho lượt kế tiếp.`;
    this.persist(session);
    await this.library.retainMatchRevisions(match.matchId, this.revisionIds(session)).catch(() => undefined);
    return this.snapshot(room, actor.userId);
  }

  ready(room: RoomDetail, actor: MatchActor, ready: boolean): BotOnlineSnapshot {
    const session = this.session(room);
    this.syncMatch(session, this.matches.ensure(room));
    const slot = this.slotFor(session, room, actor.userId);
    if (ready) for (const side of ["BLUE", "RED"] as const) if (!session.slots.has(side)) throw new AppError("CONFLICT", "Cả hai bot phải được chọn và kiểm tra trước khi Sẵn sàng.", 409, false, "INVALID", { reason: "BOT_SLOTS_INCOMPLETE" });
    const snapshot = this.matches.ready(room, actor, ready);
    this.persist(session);
    if (snapshot.status === "COUNTDOWN" || snapshot.status === "PLAYING") this.start(room);
    void slot;
    return this.snapshot(room, actor.userId);
  }

  start(room: RoomDetail): void {
    const session = this.session(room);
    this.syncMatch(session, this.matches.ensure(room));
    if (session.timer || session.runtimeState === "UNAVAILABLE") return;
    session.timer = setInterval(() => { void this.tick(room); }, 150);
    session.timer.unref?.();
  }

  stop(roomId: string): void {
    const session = this.sessions.get(roomId);
    if (session?.abortSignal) session.abortSignal.aborted = true;
    if (session?.timer) clearInterval(session.timer);
    if (session) session.timer = undefined;
  }

  pause(roomId: string): void {
    const session = this.sessions.get(roomId);
    if (!session) return;
    if (session.abortSignal) session.abortSignal.aborted = true;
    session.runtimeState = "PAUSED";
    this.persist(session);
  }

  stopAll(): void { for (const roomId of this.sessions.keys()) this.stop(roomId); }

  async step(room: RoomDetail): Promise<BotOnlineSnapshot> {
    const session = this.session(room);
    await this.tick(room);
    return this.snapshot(room, room.members[0]?.userId ?? "");
  }

  async tick(room: RoomDetail): Promise<void> {
    const session = this.session(room);
    if (session.inFlight) return;
    const match = this.matches.tick(room);
    this.syncMatch(session, match);
    if (match.status !== "PLAYING" || !match.currentTurn || match.winner) { if (["FINISHED", "ABORTED"].includes(match.status)) { this.stop(room.roomId); await this.library.retainMatchRevisions(match.matchId, []); } return; }
    if (session.lastCommittedStateVersion > match.stateVersion || session.lastCommittedSequence > match.sequence) {
      // A restored private checkpoint must never be allowed to commit against
      // an older authoritative MatchManager snapshot.  Stop fail-closed until
      // the room is reconciled instead of risking a duplicate move.
      session.runtimeState = "UNAVAILABLE";
      this.stop(room.roomId);
      this.persist(session);
      return;
    }
    const slot = session.slots.get(match.currentTurn);
    if (!slot) return;
    if (session.activeComputeMs >= DEFAULT_BOT_LIMITS.wholeMatchMs && (match.moves?.length ?? 0) > 0 && match.currentTurn === "BLUE") {
      const state = ruleStateForMatch(match);
      const decision = decideLimitWinner(scoreLimitCriteria(state, "BLUE"), scoreLimitCriteria(state, "RED"));
      this.matches.finishBotLimit(room, decision.winner, { BLUE: decision.BLUE, RED: decision.RED, reason: decision.reason, trigger: "WHOLE_MATCH_LIMIT", faultSide: null });
      await this.library.retainMatchRevisions(match.matchId, []);
      session.runtimeState = "READY";
      this.stop(room.roomId);
      this.persist(session);
      return;
    }
    session.inFlight = true;
    slot.thinking = true;
    session.runtimeState = "THINKING";
    this.persist(session);
    const stateVersion = match.stateVersion;
    const abortSignal = { aborted: false };
    session.abortSignal = abortSignal;
    try {
      if (slot.pendingRevisionId) await this.activatePending(room, slot, match.matchId, stateVersion, abortSignal);
      const beforeCompute = this.matches.ensure(room);
      if (abortSignal.aborted || beforeCompute.matchId !== match.matchId || beforeCompute.status !== "PLAYING" || beforeCompute.stateVersion !== stateVersion) return;
      const source = await this.library.source(slot.userId, slot.botId, slot.activeRevisionId);
      const ruleState: RuleState = { board: match.board as RuleState["board"], pieceCounts: match.pieceCounts, currentTurn: match.currentTurn, status: "PLAYING", winner: match.winner, resultReason: match.resultReason === "EXTINCTION" || match.resultReason === "GOAL_REACHED" ? match.resultReason : null };
      const legalMoves = Object.keys(match.board).flatMap((from) => getLegalDestinations(ruleState, slot.side, from).map((to) => ({ from: from as Coordinate, to })));
      const invocationStartedAt = this.now();
      const result = await this.runtime.runTurn({ source, state: { sdkVersion: DEFAULT_BOT_LIMITS.sdkVersion, schemaVersion: DEFAULT_BOT_LIMITS.schemaVersion, side: slot.side, board: ruleState.board, legalMoves, turnNumber: match.sequence, clocksMs: match.clocksMs, history: session.moves.map((move) => ({ side: move.side, from: move.from as Coordinate, to: move.to as Coordinate, captured: move.captured as PieceType | null })) }, memory: slot.memory, seed: hashSeed(session.sessionId, match.sequence) }, abortSignal);
      const current = this.matches.ensure(room);
      if (abortSignal.aborted || current.matchId !== match.matchId || current.status !== "PLAYING" || current.stateVersion !== stateVersion || current.currentTurn !== slot.side) return;
      const moved = this.matches.move(room, actorFor(slot), result.move.from, result.move.to, stateVersion);
      // Only accepted computation counts; bootstrap and referee-cancelled work
      // are excluded by the production supervisor's trusted measurement.
      session.activeComputeMs += Number.isFinite(result.computeMs) && result.computeMs! >= 0 ? result.computeMs! : Math.max(0, this.now() - invocationStartedAt);
      slot.memory = result.memory;
      session.lastCommittedStateVersion = moved.stateVersion;
      session.lastCommittedSequence = moved.sequence;
      const move = deriveMove(match, moved);
      if (move) session.moves = [...session.moves, move].slice(-DEFAULT_BOT_LIMITS.maxPlies);
      if (moved.status === "PLAYING" && moved.currentTurn === "BLUE" && (moved.moves?.length ?? 0) >= DEFAULT_BOT_LIMITS.maxPlies) {
        const state = ruleStateForMatch(moved);
        const decision = decideLimitWinner(scoreLimitCriteria(state, "BLUE"), scoreLimitCriteria(state, "RED"));
        this.matches.finishBotLimit(room, decision.winner, { BLUE: decision.BLUE, RED: decision.RED, reason: decision.reason, trigger: "MAX_PLIES", faultSide: null });
        await this.library.retainMatchRevisions(match.matchId, []);
        session.runtimeState = "READY";
        this.stop(room.roomId);
        this.persist(session);
        return;
      }
      session.runtimeState = "READY";
      // Retire superseded active revisions after the accepted move; temporary
      // source/quota must not stay pinned until the entire match ends. Cleanup
      // failure is conservative retention, not an author bot fault.
      await this.library.retainMatchRevisions(match.matchId, moved.status === "FINISHED" || moved.status === "ABORTED" ? [] : this.revisionIds(session)).catch(() => undefined);
      this.persist(session);
    } catch (error) {
      // An old invocation must not fault or unlock a newer round/invocation.
      if (session.abortSignal !== abortSignal || session.matchId !== match.matchId || this.matches.ensure(room).matchId !== match.matchId) return;
      if (error instanceof RuntimeCancelledError) { session.runtimeState = "PAUSED"; return; }
      if (error instanceof WasmtimeBusyError) { session.runtimeState = "READY"; return; }
      if (error instanceof RuntimeNotProvenError || error instanceof WasmtimeProviderError) { this.matches.abortBotInfrastructure(room); session.runtimeState = "UNAVAILABLE"; this.stop(room.roomId); await this.library.retainMatchRevisions(match.matchId, []); return; }
      if (error instanceof BotOutputValidationError) {
        try { this.matches.finishBotFault(room, actorFor(slot), stateVersion); } catch { /* terminal race wins */ }
        session.runtimeState = "FAILED";
      } else { this.matches.abortBotInfrastructure(room); session.runtimeState = "FAILED"; }
      await this.library.retainMatchRevisions(match.matchId, []);
      this.persist(session);
    } finally {
      if (session.abortSignal === abortSignal && session.matchId === match.matchId) {
        slot.thinking = false;
        session.inFlight = false;
        session.abortSignal = undefined;
        this.persist(session);
      }
    }
  }

  private async activatePending(room: RoomDetail, slot: BotSlot, matchId: string, stateVersion: number, signal: { aborted: boolean }): Promise<void> {
    if (!slot.pendingRevisionId) return;
    const pendingRevisionId = slot.pendingRevisionId;
    const next = await this.library.list(slot.userId);
    const current = this.matches.ensure(room);
    if (signal.aborted || current.matchId !== matchId || current.status !== "PLAYING" || current.stateVersion !== stateVersion || slot.pendingRevisionId !== pendingRevisionId) return;
    const bot = next.bots.find((item) => item.id === slot.botId);
    const revision = bot?.revisions.find((item) => item.id === pendingRevisionId);
    if (!bot || !revision || revision.status !== "PASSED") { slot.pendingRevisionId = null; slot.pendingRevisionNumber = null; return; }
    slot.activeRevisionId = revision.id;
    slot.activeRevisionNumber = revision.revisionNumber;
    slot.botName = bot.name;
    slot.pendingRevisionId = null;
    slot.pendingRevisionNumber = null;
    slot.memory = null;
    this.matches.recordBotRevision(room, slot.side, slot.activeRevisionNumber);
    this.session(room).revisionNotice = `${slot.displayName} đang dùng revision #${revision.revisionNumber} từ lượt này.`;
  }

  snapshot(room: RoomDetail, viewerUserId?: string): BotOnlineSnapshot {
    const session = this.session(room);
    const match = this.matches.ensure(room);
    this.syncMatch(session, match);
    const publicSlots: BotOnlinePlayer[] = (room.members.slice(0, 2).map((member, index) => {
      const side: Side = this.matches.getViewerSide(room, member.userId) ?? (index === 0 ? "BLUE" : "RED");
      const slot = session.slots.get(side);
      return { userId: member.userId, displayName: member.displayName, side, botId: slot && slot.userId === viewerUserId ? slot.botId : null, botName: slot?.botName ?? "Chưa chọn bot", activeRevisionId: slot?.activeRevisionId ?? "pending", activeRevisionNumber: slot?.activeRevisionNumber ?? 1, pendingRevisionId: slot?.pendingRevisionId ?? null, pendingRevisionNumber: slot?.pendingRevisionNumber ?? null, thinking: slot?.thinking ?? false, connected: true, owner: slot?.userId === viewerUserId };
    }) as BotOnlinePlayer[]);
    while (publicSlots.length < 2) publicSlots.push({ userId: `empty-${publicSlots.length}`, displayName: "Đang chờ người chơi", side: publicSlots.length === 0 ? "BLUE" : "RED", botName: "Chưa chọn bot", activeRevisionId: "pending", activeRevisionNumber: 1, pendingRevisionId: null, pendingRevisionNumber: null, thinking: false, connected: false, owner: false });
    const runtimeState = match.status === "PAUSED" || match.status === "RESUMING" ? "PAUSED" : session.runtimeState;
    return { sessionId: session.sessionId, roomId: room.roomId, mode: match.mode, status: match.status, board: match.board, currentTurn: match.currentTurn, winner: match.winner, resultReason: match.resultReason, sequence: match.sequence, stateVersion: match.stateVersion, players: publicSlots, moves: session.moves, limits: { perTurnMs: DEFAULT_BOT_LIMITS.perTurnMs, wholeMatchMs: DEFAULT_BOT_LIMITS.wholeMatchMs, maxTurns: DEFAULT_BOT_LIMITS.maxTurns, deterministicSeed: DEFAULT_BOT_LIMITS.deterministicSeed }, revisionNotice: session.revisionNotice, runtimeState };
  }

  private persist(session: Session): void {
    this.persistence.save({ matchId: session.matchId, sessionId: session.sessionId, roomId: session.roomId, slots: [...session.slots.values()].map((slot) => ({ ...slot })), moves: session.moves, revisionNotice: session.revisionNotice, lastCommittedStateVersion: session.lastCommittedStateVersion, lastCommittedSequence: session.lastCommittedSequence, activeComputeMs: session.activeComputeMs });
  }
}
