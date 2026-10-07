import { randomUUID } from "node:crypto";
import type { MatchBotAdjudication, MatchEventEnvelope, MatchEventType, MatchPauseCategory, MatchPauseReason, MatchPublicTimelineEvent, MatchRating, MatchReplacementStatus, MatchSnapshot, RoomDetail } from "@ottv2/contracts";
import { applyMove, createInitialState, type Coordinate, type RuleState, type Side } from "@ottv2/game-rules";

import { AppError } from "../../shared/errors/app-error.js";
import type { MatchCheckpoint, MatchPersistence, PersistedMove } from "./match.persistence.js";

export type MatchActor = { userId: string; username: string; displayName: string; principal?: "ACCOUNT" | "GUEST" };
type MatchPlayerState = MatchActor & { side: Side; ready: boolean; connected: boolean };
type MatchState = {
  matchId: string;
  roomId: string;
  hostUserId: string;
  mode: MatchSnapshot["mode"];
  playMode: "MANUAL" | "BOT";
  timerSeconds: number;
  players: MatchPlayerState[];
  ruleState: RuleState;
  status: MatchSnapshot["status"];
  clocksMs: Record<Side, number>;
  countdownEndsAt: number | null;
  turnStartedAt: number | null;
  startedAt: number | null;
  endedAt: number | null;
  sequence: number;
  stateVersion: number;
  resultReason: MatchSnapshot["resultReason"];
  botAdjudication: MatchBotAdjudication | null;
  winner: Side | null;
  rating: MatchRating | null;
  rematchRequests: Set<string>;
  rematchRequestedBy: Side | null;
  sideByUserId: Map<string, Side>;
  fastReadyUsers: Set<string>;
  expiredDisconnects: Set<string>;
  refereeEnabled: boolean;
  refereeUserId: string | null;
  refereeConnected: boolean;
  pauseReason: MatchPauseReason | null;
  pauseCategory: MatchPauseCategory | null;
  pausedAt: number | null;
  pausedByUserId: string | null;
  pausePhase: "COUNTDOWN" | "PLAYING" | null;
  pauseElapsedMs: number;
  resumeEndsAt: number | null;
  replacementStatus: MatchReplacementStatus;
  replacementCandidateUserId: string | null;
  replacementNominatedByUserId: string | null;
  replacementApprovedByUserIds: Set<string>;
  replacementExpiresAt: number | null;
  moves: PersistedMove[];
  publicTimeline: MatchPublicTimelineEvent[];
};

type MatchListener = (envelope: MatchEventEnvelope) => void;
type ActiveGameLock = { roomId: string; matchId: string; clientId: string; acquiredAt: number };
type SchedulerSubscriber = { onTick?: (snapshot: MatchSnapshot) => void | Promise<void>; roomProvider?: () => RoomDetail };

export class MatchManager {
  private static readonly REFEREE_PAUSE_MAX_MS = 10 * 60_000;
  private static readonly REFEREE_PAUSE_TOTAL_MAX_MS = 30 * 60_000;
  private readonly matches = new Map<string, MatchState>();
  private readonly listeners = new Map<string, Set<MatchListener>>();
  private readonly spectatorListeners = new Map<string, Set<MatchListener>>();
  private readonly connections = new Map<string, Map<string, Set<string>>>();
  private readonly refereeConnections = new Map<string, Set<string>>();
  private readonly disconnectTimers = new Map<string, Map<string, NodeJS.Timeout>>();
  private readonly disconnectDeadlines = new Map<string, Map<string, number>>();
  private readonly activeLocks = new Map<string, ActiveGameLock>();
  private readonly schedulerTimers = new Map<string, NodeJS.Timeout>();
  private readonly schedulerCallbacks = new Map<string, Map<number, SchedulerSubscriber>>();
  private nextSchedulerConsumer = 1;
  private readonly now: () => number;
  private readonly graceMs: number;
  private readonly persistence: MatchPersistence | undefined;

  constructor(now: () => number = Date.now, graceMs = 30_000, persistence?: MatchPersistence) {
    this.now = now;
    this.graceMs = graceMs;
    this.persistence = persistence;
  }

  ensure(room: RoomDetail): MatchSnapshot {
    if (room.members.length === 0 && !(room.refereeEnabled && room.refereeUserId)) throw new AppError("CONFLICT", "Phòng chưa có người chơi.", 409, false, "INVALID", { reason: "NO_PLAYERS" });
    let match = this.matches.get(room.roomId);
    if (!match) {
      const timerMs = room.timerSeconds * 1000;
      match = {
        matchId: randomUUID(),
        roomId: room.roomId,
        hostUserId: room.hostUserId ?? room.members[0]?.userId ?? "",
        mode: room.mode,
        playMode: room.playMode,
        timerSeconds: room.timerSeconds,
        players: [],
        ruleState: createInitialState(),
        status: "WAITING_READY",
        clocksMs: { BLUE: timerMs, RED: timerMs },
        countdownEndsAt: null,
        turnStartedAt: null,
        startedAt: null,
        endedAt: null,
        sequence: 0,
        stateVersion: 0,
        resultReason: null,
        botAdjudication: null,
        winner: null,
        rating: null,
        rematchRequests: new Set(),
        rematchRequestedBy: null,
        sideByUserId: new Map(),
        fastReadyUsers: new Set(),
        expiredDisconnects: new Set(),
        refereeEnabled: room.refereeEnabled ?? false,
        refereeUserId: room.refereeUserId ?? null,
        refereeConnected: room.refereeConnected ?? false,
        pauseReason: null,
        pauseCategory: null,
        pausedAt: null,
        pausedByUserId: null,
        pausePhase: null,
        pauseElapsedMs: 0,
        resumeEndsAt: null,
        replacementStatus: "IDLE",
        replacementCandidateUserId: null,
        replacementNominatedByUserId: null,
        replacementApprovedByUserIds: new Set(),
        replacementExpiresAt: null,
        moves: [],
        publicTimeline: [],
      };
      this.matches.set(room.roomId, match);
      const checkpoint = this.persistence?.load(room.roomId);
      if (checkpoint) this.restoreCheckpoint(match, checkpoint);
    }
    if (!match) throw new AppError("INTERNAL_ERROR", "Match state chưa sẵn sàng.", 500, true, "RECOVERABLE");
    match.hostUserId = room.hostUserId ?? room.members[0]?.userId ?? match.hostUserId;
    match.refereeEnabled = match.refereeEnabled || (room.refereeEnabled ?? false);
    if (match.refereeUserId === null && room.refereeUserId) match.refereeUserId = room.refereeUserId;
    this.syncPlayers(match, room);
    this.advance(match);
    this.persistCheckpoint(match);
    return this.snapshot(match);
  }

  getViewerSide(room: RoomDetail, userId: string): Side | null {
    const player = this.ensure(room).players.find((item) => item.userId === userId);
    return player?.side ?? null;
  }

  isReplacementCandidate(room: RoomDetail, userId: string): boolean {
    const match = this.ensure(room);
    return match.status === "PAUSED" && match.replacementCandidateUserId === userId;
  }

  /** One authoritative advancement loop per match; SSE subscribers never own clocks. */
  startScheduler(room: RoomDetail, onTick?: (snapshot: MatchSnapshot) => void | Promise<void>, roomProvider?: () => RoomDetail): () => void {
    this.ensure(room);
    const consumerId = this.nextSchedulerConsumer++;
    const callbacks = this.schedulerCallbacks.get(room.roomId) ?? new Map<number, SchedulerSubscriber>();
    const subscriber: SchedulerSubscriber = {};
    if (onTick) subscriber.onTick = onTick;
    if (roomProvider) subscriber.roomProvider = roomProvider;
    callbacks.set(consumerId, subscriber);
    this.schedulerCallbacks.set(room.roomId, callbacks);
    if (this.schedulerTimers.has(room.roomId)) return () => this.releaseScheduler(room.roomId, consumerId);
    const timer = setInterval(() => {
      try {
        const subscribers = [...(this.schedulerCallbacks.get(room.roomId)?.values() ?? [])];
        const match = this.matches.get(room.roomId);
        if (!match) return;
        let currentRoom: RoomDetail | undefined;
        for (const subscriber of subscribers) {
          try { currentRoom = subscriber.roomProvider?.() ?? room; break; }
          catch { void subscriber.onTick?.(this.snapshot(match)); }
        }
        if (!currentRoom) return;
        const snapshot = this.tick(currentRoom);
        for (const callback of subscribers) void callback.onTick?.(snapshot);
        if (snapshot.status === "FINISHED" || snapshot.status === "ABORTED") this.stopScheduler(room.roomId);
      } catch {
        // A terminal/revoked room is cleaned up by the owning route/store.
      }
    }, 1_000);
    timer.unref?.();
    this.schedulerTimers.set(room.roomId, timer);
    return () => this.releaseScheduler(room.roomId, consumerId);
  }

  stopScheduler(roomId: string): void {
    const timer = this.schedulerTimers.get(roomId);
    if (timer) clearInterval(timer);
    this.schedulerTimers.delete(roomId);
    this.schedulerCallbacks.delete(roomId);
  }

  private releaseScheduler(roomId: string, consumerId: number): void {
    const callbacks = this.schedulerCallbacks.get(roomId);
    callbacks?.delete(consumerId);
    if (callbacks && callbacks.size > 0) return;
    this.stopScheduler(roomId);
  }

  subscribe(roomId: string, listener: MatchListener): () => void {
    const listeners = this.listeners.get(roomId) ?? new Set<MatchListener>();
    listeners.add(listener);
    this.listeners.set(roomId, listeners);
    return () => { listeners.delete(listener); if (listeners.size === 0) this.listeners.delete(roomId); };
  }

  subscribeSpectator(roomId: string, listener: MatchListener): () => void {
    const listeners = this.spectatorListeners.get(roomId) ?? new Set<MatchListener>();
    listeners.add(listener);
    this.spectatorListeners.set(roomId, listeners);
    return () => { listeners.delete(listener); if (listeners.size === 0) this.spectatorListeners.delete(roomId); };
  }

  spectatorListenerCount(roomId: string): number {
    return this.spectatorListeners.get(roomId)?.size ?? 0;
  }

  acquireActiveLock(room: RoomDetail, userId: string, clientId = "server"): void {
    const match = this.getMatch(room);
    if (match.status === "FINISHED" || match.status === "ABORTED") return;
    const existing = this.activeLocks.get(userId);
    if (existing && (existing.roomId !== room.roomId || existing.clientId !== clientId)) {
      throw new AppError("CONFLICT", "Tài khoản đang có một match hoạt động ở nơi khác.", 409, false, "INVALID", { reason: "ACTIVE_GAME_LOCK", roomId: existing.roomId, matchId: existing.matchId });
    }
    this.activeLocks.set(userId, { roomId: room.roomId, matchId: match.matchId, clientId, acquiredAt: this.now() });
  }

  isActiveLocked(userId: string): boolean {
    return this.activeLocks.has(userId);
  }

  connect(room: RoomDetail, userId: string, clientId = "server"): void {
    const match = this.getMatch(room);
    if (match.expiredDisconnects.has(userId)) {
      throw new AppError("CONFLICT", "Thời gian kết nối lại của người chơi đã hết.", 409, false, "INVALID", { reason: "DISCONNECT_GRACE_EXPIRED" });
    }
    const roomConnections = this.connections.get(room.roomId) ?? new Map<string, Set<string>>();
    const userConnections = roomConnections.get(userId) ?? new Set<string>();
    const roomTimers = this.disconnectTimers.get(room.roomId);
    const wasDisconnected = roomTimers?.has(userId) ?? false;
    const timer = roomTimers?.get(userId);
    if (timer) clearTimeout(timer);
    roomTimers?.delete(userId);
    userConnections.add(clientId);
    roomConnections.set(userId, userConnections);
    this.connections.set(room.roomId, roomConnections);
    const player = this.player(match, userId);
    player.connected = true;
    if (wasDisconnected) {
      this.disconnectDeadlines.get(room.roomId)?.delete(userId);
      if (this.disconnectDeadlines.get(room.roomId)?.size === 0) this.disconnectDeadlines.delete(room.roomId);
      if (match.status === "PLAYING" && this.pendingDisconnects(match) === 0) match.turnStartedAt = this.now();
      const expiredOpponent = match.expiredDisconnects.values().next().value as string | undefined;
      if (expiredOpponent !== undefined) {
        this.finish(match, player.side, "DISCONNECT_TIMEOUT");
        match.expiredDisconnects.clear();
        this.emit(match, "MATCH_FINISHED");
        return;
      }
      this.emit(match, "PLAYER_RECONNECTED");
      this.emit(match, "STATE_RESYNC");
    }
  }

  disconnect(room: RoomDetail, userId: string, clientId = "server"): void {
    const match = this.getMatch(room);
    const roomConnections = this.connections.get(room.roomId);
    const userConnections = roomConnections?.get(userId);
    userConnections?.delete(clientId);
    if (userConnections && userConnections.size > 0) return;
    roomConnections?.delete(userId);
    const player = match.players.find((item) => item.userId === userId);
    if (!player) return;
    if (match.status === "WAITING_READY") {
      player.connected = false;
      this.releaseLock(userId, room.roomId, clientId);
      return;
    }
    if (match.status === "COUNTDOWN") {
      player.connected = false;
      player.ready = false;
      match.status = "WAITING_READY";
      match.countdownEndsAt = null;
      match.turnStartedAt = null;
      match.fastReadyUsers.clear();
      match.expiredDisconnects.clear();
      match.pauseReason = null;
      match.pauseCategory = null;
      match.pausedAt = null;
      match.pausedByUserId = null;
      match.pausePhase = null;
      match.pauseElapsedMs = 0;
      match.resumeEndsAt = null;
      match.stateVersion += 1;
      this.releaseLock(userId, room.roomId, clientId);
      this.emit(match, "PLAYER_DISCONNECTED");
      return;
    }
    if (match.status !== "PLAYING" && match.status !== "PAUSED" && match.status !== "RESUMING") return;
    player.connected = false;
    this.emit(match, "PLAYER_DISCONNECTED");
    const timers = this.disconnectTimers.get(room.roomId) ?? new Map<string, NodeJS.Timeout>();
    const timer = setTimeout(() => this.expireDisconnect(room.roomId, userId), this.graceMs);
    timers.set(userId, timer);
    this.disconnectTimers.set(room.roomId, timers);
    const deadlines = this.disconnectDeadlines.get(room.roomId) ?? new Map<string, number>();
    deadlines.set(userId, this.now() + this.graceMs);
    this.disconnectDeadlines.set(room.roomId, deadlines);
  }

  stop(): void {
    for (const timers of this.disconnectTimers.values()) for (const timer of timers.values()) clearTimeout(timer);
    this.disconnectTimers.clear();
    this.disconnectDeadlines.clear();
    for (const timer of this.schedulerTimers.values()) clearInterval(timer);
    this.schedulerTimers.clear();
    this.schedulerCallbacks.clear();
    this.connections.clear();
    this.refereeConnections.clear();
    this.listeners.clear();
    this.spectatorListeners.clear();
    this.activeLocks.clear();
  }

  /** Remove a just-created, never-started match when room admission cannot commit atomically. */
  discardUnstarted(roomId: string): void {
    const match = this.matches.get(roomId);
    if (!match || match.status !== "WAITING_READY" || match.sequence !== 0) return;
    for (const timer of this.disconnectTimers.get(roomId)?.values() ?? []) clearTimeout(timer);
    this.disconnectTimers.delete(roomId);
    this.disconnectDeadlines.delete(roomId);
    this.connections.delete(roomId);
    this.refereeConnections.delete(roomId);
    this.listeners.delete(roomId);
    this.spectatorListeners.delete(roomId);
    this.releaseLocks(roomId);
    this.matches.delete(roomId);
  }

  snapshotEvent(room: RoomDetail): MatchEventEnvelope {
    const match = this.getMatch(room);
    return this.createEnvelope(match, "MATCH_SNAPSHOT");
  }

  setRating(room: RoomDetail, rating: MatchRating): MatchSnapshot {
    const match = this.getMatch(room);
    match.rating = rating;
    this.emit(match, "RATING_UPDATED");
    return this.snapshot(match);
  }

  tick(room: RoomDetail): MatchSnapshot {
    const match = this.getMatch(room);
    this.advance(match, true);
    return this.snapshot(match);
  }

  ready(room: RoomDetail, actor: MatchActor, ready: boolean): MatchSnapshot {
    const match = this.getMatch(room);
    const player = this.player(match, actor.userId);
    if (match.status !== "WAITING_READY" && match.status !== "COUNTDOWN") throw this.invalidState("ready", match.status);
    player.ready = ready;
    if (!ready) { match.status = "WAITING_READY"; match.countdownEndsAt = null; match.turnStartedAt = null; match.fastReadyUsers.clear(); }
    this.emit(match, "PLAYER_READY");
    if (!match.refereeEnabled && match.players.length === 2 && match.players.every((item) => item.ready) && match.status === "WAITING_READY") {
      match.status = "COUNTDOWN";
      match.countdownEndsAt = this.now() + 3000;
      match.fastReadyUsers.clear();
      match.stateVersion += 1;
      this.emit(match, "COUNTDOWN_STARTED");
    }
    return this.snapshot(match);
  }

  fastReady(room: RoomDetail, actor: MatchActor): MatchSnapshot {
    const match = this.getMatch(room);
    if (match.refereeEnabled) throw new AppError("CONFLICT", "Phòng có trọng tài phải do trọng tài bấm Bắt đầu.", 409, false, "INVALID", { reason: "REFEREE_START_REQUIRED" });
    if (match.status !== "COUNTDOWN") throw this.invalidState("fast-ready", match.status);
    this.player(match, actor.userId);
    match.fastReadyUsers.add(actor.userId);
    if (match.players.length === 2 && match.players.every((player) => match.fastReadyUsers.has(player.userId))) {
      match.countdownEndsAt = this.now();
      this.advance(match);
    }
    return this.snapshot(match);
  }

  start(room: RoomDetail, actor: MatchActor): MatchSnapshot {
    const match = this.getMatch(room);
    this.assertReferee(match, actor);
    if (match.status !== "WAITING_READY") throw this.invalidState("start", match.status);
    if (match.players.length !== 2 || !match.players.every((player) => player.ready)) throw new AppError("CONFLICT", "Cả hai người chơi phải Sẵn sàng trước khi trọng tài bắt đầu.", 409, false, "INVALID", { reason: "PLAYERS_NOT_READY" });
    if (!match.refereeConnected) throw new AppError("CONFLICT", "Trọng tài chưa có mặt trong phòng.", 409, false, "INVALID", { reason: "REFEREE_NOT_PRESENT" });
    match.status = "COUNTDOWN";
    match.countdownEndsAt = this.now() + 3_000;
    match.fastReadyUsers.clear();
    match.stateVersion += 1;
    this.emit(match, "COUNTDOWN_STARTED");
    return this.snapshot(match);
  }

  refereeConnected(room: RoomDetail, actor: MatchActor, clientId = "server"): MatchSnapshot {
    const match = this.getMatch(room);
    this.assertReferee(match, actor);
    const clients = this.refereeConnections.get(room.roomId) ?? new Set<string>();
    const wasOffline = clients.size === 0;
    clients.add(clientId);
    this.refereeConnections.set(room.roomId, clients);
    match.refereeConnected = true;
    if (wasOffline) this.emit(match, "REFEREE_CONNECTED");
    return this.snapshot(match);
  }

  refereeDisconnected(room: RoomDetail, actor: MatchActor, clientId = "server"): MatchSnapshot {
    const match = this.getMatch(room);
    this.assertReferee(match, actor);
    const clients = this.refereeConnections.get(room.roomId);
    clients?.delete(clientId);
    if (clients && clients.size > 0) return this.snapshot(match);
    this.refereeConnections.delete(room.roomId);
    match.refereeConnected = false;
    if (match.status === "COUNTDOWN" || match.status === "PLAYING" || match.status === "RESUMING") this.pauseInternal(match, actor.userId, "REFEREE", "TECHNICAL_ISSUE");
    this.emit(match, "REFEREE_DISCONNECTED");
    return this.snapshot(match);
  }

  stopByReferee(room: RoomDetail, actor: MatchActor, category: MatchPauseCategory = "TECHNICAL_ISSUE"): MatchSnapshot {
    const match = this.getMatch(room);
    this.assertReferee(match, actor);
    if (match.status !== "COUNTDOWN" && match.status !== "PLAYING" && match.status !== "RESUMING") throw this.invalidState("stop", match.status);
    this.pauseInternal(match, actor.userId, "REFEREE", category);
    return this.snapshot(match);
  }

  resumeByReferee(room: RoomDetail, actor: MatchActor): MatchSnapshot {
    const match = this.getMatch(room);
    this.assertReferee(match, actor);
    this.advance(match);
    if (match.status !== "PAUSED") throw this.invalidState("resume", match.status);
    if (!match.refereeConnected) throw new AppError("CONFLICT", "Trọng tài chưa kết nối lại.", 409, false, "RECOVERABLE", { reason: "REFEREE_NOT_PRESENT" });
    if (this.pendingDisconnects(match) > 0 || match.expiredDisconnects.size > 0) throw new AppError("CONFLICT", "Chưa thể tiếp tục khi còn người chơi đang mất kết nối.", 409, false, "RECOVERABLE", { reason: "PLAYER_DISCONNECT_PENDING" });
    match.status = "RESUMING";
    match.resumeEndsAt = this.now() + 3_000;
    match.stateVersion += 1;
    this.emit(match, "RESUME_STARTED");
    return this.snapshot(match);
  }

  holdPause(room: RoomDetail, actor: MatchActor): MatchSnapshot {
    const match = this.getMatch(room);
    this.assertReferee(match, actor);
    this.advance(match);
    if (match.status !== "RESUMING") throw this.invalidState("hold-pause", match.status);
    match.status = "PAUSED";
    match.resumeEndsAt = null;
    match.stateVersion += 1;
    this.emit(match, "MATCH_PAUSED");
    return this.snapshot(match);
  }

  nominateRefereeReplacement(room: RoomDetail, actor: MatchActor, targetUserId: string): MatchSnapshot {
    const match = this.getMatch(room);
    this.assertReplacementPlayer(match, actor);
    this.assertReplacementWindow(match);
    const target = targetUserId.trim();
    if (!target || match.players.some((player) => player.userId === target) || target === match.refereeUserId) throw new AppError("CONFLICT", "Tài khoản đề cử phải là người ngoài trận và khác trọng tài cũ.", 409, false, "INVALID", { reason: "REPLACEMENT_TARGET_INVALID" });
    match.replacementStatus = "NOMINATED";
    match.replacementCandidateUserId = target;
    match.replacementNominatedByUserId = actor.userId;
    match.replacementApprovedByUserIds.clear();
    match.replacementExpiresAt = this.now() + 5 * 60_000;
    match.stateVersion += 1;
    this.emit(match, "REFEREE_REPLACEMENT_NOMINATED");
    return this.snapshot(match);
  }

  approveRefereeReplacement(room: RoomDetail, actor: MatchActor): MatchSnapshot {
    const match = this.getMatch(room);
    this.assertReplacementPlayer(match, actor);
    this.assertReplacementWindow(match);
    this.assertReplacementCandidate(match);
    match.replacementApprovedByUserIds.add(actor.userId);
    match.replacementStatus = match.players.every((player) => match.replacementApprovedByUserIds.has(player.userId)) ? "APPROVED" : "NOMINATED";
    match.stateVersion += 1;
    this.emit(match, "REFEREE_REPLACEMENT_APPROVED");
    return this.snapshot(match);
  }

  acceptRefereeReplacement(room: RoomDetail, actor: MatchActor): MatchSnapshot {
    const match = this.getMatch(room);
    if (actor.principal === "GUEST") throw new AppError("UNAUTHORIZED", "Guest không thể nhận vai trò trọng tài.", 403, false, "FATAL_SESSION", { reason: "GUEST_REFEREE_FORBIDDEN" });
    this.assertReplacementWindow(match);
    this.assertReplacementCandidate(match);
    if (match.replacementStatus !== "APPROVED" || actor.userId !== match.replacementCandidateUserId) throw new AppError("CONFLICT", "Cả hai người chơi phải chấp thuận trước khi tài khoản được đề cử nhận vai trò.", 409, false, "RECOVERABLE", { reason: "REPLACEMENT_CONSENT_REQUIRED" });
    match.refereeUserId = actor.userId;
    match.refereeConnected = true;
    match.replacementStatus = "IDLE";
    match.replacementCandidateUserId = null;
    match.replacementNominatedByUserId = null;
    match.replacementApprovedByUserIds.clear();
    match.replacementExpiresAt = null;
    match.stateVersion += 1;
    return this.snapshot(match);
  }

  publishRefereeReplacement(room: RoomDetail): MatchSnapshot {
    const match = this.getMatch(room);
    match.sequence += 1;
    const envelope = this.createEnvelope(match, "REFEREE_REPLACED");
    if (this.persistence?.commitEvent) this.persistence.commitEvent(this.checkpoint(match), envelope);
    else {
      this.persistence?.appendEvent(envelope);
      this.persistCheckpoint(match);
    }
    for (const listener of this.listeners.get(match.roomId) ?? []) listener(envelope);
    for (const listener of this.spectatorListeners.get(match.roomId) ?? []) listener(envelope);
    return this.snapshot(match);
  }
  move(room: RoomDetail, actor: MatchActor, from: Coordinate, to: Coordinate, stateVersion: number): MatchSnapshot {
    const match = this.getMatch(room);
    this.advance(match, true);
    const player = this.player(match, actor.userId);
    this.assertVersion(match, stateVersion);
    if (match.status !== "PLAYING") throw this.invalidState("move", match.status);
    if (match.ruleState.currentTurn !== player.side) throw new AppError("CONFLICT", "Chưa tới lượt của bạn.", 409, false, "INVALID", { reason: "WRONG_TURN", event: "PIECE_MOVE_REJECTED" });
    const result = applyMove(match.ruleState, { side: player.side, from, to });
    if (result.kind === "rejected") {
      this.emit(match, "PIECE_MOVE_REJECTED");
      throw new AppError("VALIDATION_ERROR", "Nước đi không hợp lệ.", 400, false, "INVALID", { reason: "MOVE_REJECTED", moveCode: result.error.code, event: "PIECE_MOVE_REJECTED" });
    }
    match.ruleState = result.state;
    match.moves.push({ sequence: match.sequence + 1, stateVersion: match.stateVersion + 1, side: player.side, from, to, capturedPieceId: result.move.capturedPieceId, committedAt: this.now() });
    match.stateVersion += 1;
    match.turnStartedAt = this.now();
    if (result.state.status === "FINISHED") {
      match.status = "FINISHED";
      match.winner = result.state.winner;
      match.resultReason = result.state.resultReason;
      match.endedAt = this.now();
      this.releaseLocks(match.roomId);
    }
    this.emit(match, "PIECE_MOVE_ACCEPTED");
    if (match.status === "FINISHED") this.emit(match, "MATCH_FINISHED");
    return this.snapshot(match);
  }

  surrender(room: RoomDetail, actor: MatchActor, stateVersion: number): MatchSnapshot {
    const match = this.getMatch(room);
    this.advance(match, true);
    const player = this.player(match, actor.userId);
    this.assertVersion(match, stateVersion);
    if (match.status !== "PLAYING") throw this.invalidState("surrender", match.status);
    this.finish(match, player.side === "BLUE" ? "RED" : "BLUE", "SURRENDER");
    this.emit(match, "PLAYER_SURRENDERED");
    this.emit(match, "MATCH_FINISHED");
    return this.snapshot(match);
  }

  finishBotLimit(room: RoomDetail, winner: Side, adjudication: MatchBotAdjudication): MatchSnapshot {
    const match = this.getMatch(room);
    if (match.playMode !== "BOT") throw new AppError("CONFLICT", "Chỉ trận Đấu chương trình mới có thể phân định giới hạn.", 409, false, "INVALID", { reason: "BOT_MATCH_REQUIRED" });
    if (match.status !== "PLAYING") return this.snapshot(match);
    this.finish(match, winner, adjudication.reason === "LIMIT_EXACT_TIE" ? "BOT_LIMIT_EXACT_TIE" : "BOT_LIMIT_CRITERIA");
    match.botAdjudication = adjudication;
    this.emit(match, "MATCH_FINISHED");
    return this.snapshot(match);
  }

  finishBotFault(room: RoomDetail, actor: MatchActor, stateVersion: number): MatchSnapshot {
    const match = this.getMatch(room);
    const player = this.player(match, actor.userId);
    this.assertVersion(match, stateVersion);
    if (match.playMode !== "BOT") throw new AppError("CONFLICT", "Chỉ trận Đấu chương trình mới có lỗi chiến thuật.", 409, false, "INVALID", { reason: "BOT_MATCH_REQUIRED" });
    if (match.status !== "PLAYING") return this.snapshot(match);
    this.finish(match, player.side === "BLUE" ? "RED" : "BLUE", "BOT_AUTHOR_FAULT");
    match.botAdjudication = { BLUE: { N: 0, P: 0, M: 0 }, RED: { N: 0, P: 0, M: 0 }, reason: "AUTHOR_FAULT", trigger: "AUTHOR_FAULT", faultSide: player.side };
    this.emit(match, "MATCH_FINISHED");
    return this.snapshot(match);
  }

  recordBotRevision(room: RoomDetail, side: Side, revisionNumber: number): MatchSnapshot {
    const match = this.getMatch(room);
    if (match.playMode !== "BOT") throw new AppError("CONFLICT", "Chỉ trận Đấu chương trình mới có timeline revision.", 409, false, "INVALID", { reason: "BOT_MATCH_REQUIRED" });
    if (!Number.isInteger(revisionNumber) || revisionNumber < 1) throw new AppError("VALIDATION_ERROR", "Revision Bot không hợp lệ.", 400, false, "INVALID", { reason: "BOT_REVISION_INVALID" });
    if (match.status !== "PLAYING") return this.snapshot(match);
    this.emit(match, "BOT_REVISION_APPLIED", { side, revisionNumber });
    return this.snapshot(match);
  }

  abortBotInfrastructure(room: RoomDetail): MatchSnapshot {
    const match = this.getMatch(room);
    if (match.status === "FINISHED" || match.status === "ABORTED") return this.snapshot(match);
    match.status = "ABORTED";
    match.winner = null;
    match.resultReason = "BOT_INFRASTRUCTURE";
    match.botAdjudication = { BLUE: { N: 0, P: 0, M: 0 }, RED: { N: 0, P: 0, M: 0 }, reason: "INFRASTRUCTURE", trigger: "INFRASTRUCTURE", faultSide: null };
    match.ruleState = { ...match.ruleState, status: "FINISHED", currentTurn: null, winner: null, resultReason: null };
    match.stateVersion += 1;
    match.endedAt = this.now();
    this.releaseLocks(match.roomId);
    this.emit(match, "MATCH_ABORTED");
    return this.snapshot(match);
  }

  rematch(room: RoomDetail, actor: MatchActor, stateVersion: number): MatchSnapshot {
    const match = this.getMatch(room);
    const player = this.player(match, actor.userId);
    this.assertVersion(match, stateVersion);
    if (match.status !== "FINISHED") throw this.invalidState("rematch", match.status);
    match.rematchRequests.add(player.userId);
    match.rematchRequestedBy ??= player.side;
    this.emit(match, "REMATCH_REQUESTED");
    if (match.players.length === 2 && match.rematchRequests.size === 2) {
      match.matchId = randomUUID();
      match.ruleState = createInitialState();
      match.status = "WAITING_READY";
      match.mode = "UNRANKED";
      match.clocksMs = { BLUE: match.timerSeconds * 1000, RED: match.timerSeconds * 1000 };
      match.countdownEndsAt = null;
      match.turnStartedAt = null;
      match.winner = null;
      match.resultReason = null;
      match.botAdjudication = null;
      match.rating = null;
      match.players.forEach((item) => {
        item.side = item.side === "BLUE" ? "RED" : "BLUE";
        match.sideByUserId.set(item.userId, item.side);
      });
      match.startedAt = null;
      match.endedAt = null;
      match.pauseReason = null;
      match.pauseCategory = null;
      match.pausedAt = null;
      match.pausedByUserId = null;
      match.pausePhase = null;
      match.pauseElapsedMs = 0;
      match.resumeEndsAt = null;
      match.replacementStatus = "IDLE";
      match.replacementCandidateUserId = null;
      match.replacementNominatedByUserId = null;
      match.replacementApprovedByUserIds.clear();
      match.replacementExpiresAt = null;
      match.rematchRequests.clear();
      match.rematchRequestedBy = null;
      match.fastReadyUsers.clear();
      match.players.forEach((item) => { item.ready = false; });
      match.moves = [];
      match.publicTimeline = [];
      match.stateVersion = 0;
      this.emit(match, "MATCH_SNAPSHOT");
    }
    return this.snapshot(match);
  }

  rejectRematch(room: RoomDetail, actor: MatchActor, stateVersion: number): MatchSnapshot {
    const match = this.getMatch(room);
    this.player(match, actor.userId);
    this.assertVersion(match, stateVersion);
    if (match.status !== "FINISHED") throw this.invalidState("reject-rematch", match.status);
    if (match.rematchRequests.size === 0) throw this.invalidState("reject-rematch", match.status);
    match.rematchRequests.clear();
    match.rematchRequestedBy = null;
    this.emit(match, "REMATCH_REJECTED");
    return this.snapshot(match);
  }

  size(): number { return this.matches.size; }

  private getMatch(room: RoomDetail): MatchState {
    this.ensure(room);
    const match = this.matches.get(room.roomId);
    if (!match) throw new AppError("INTERNAL_ERROR", "Match state chưa sẵn sàng.", 500, true, "RECOVERABLE");
    return match;
  }

  private syncPlayers(match: MatchState, room: RoomDetail): void {
    const members = room.members.slice(0, 2);
    for (const [index, member] of members.entries()) {
      const defaultSide: Side = member.userId === room.hostUserId || index === 0 ? "BLUE" : "RED";
      const side = match.sideByUserId.get(member.userId) ?? defaultSide;
      match.sideByUserId.set(member.userId, side);
      const existing = match.players.find((item) => item.userId === member.userId);
      if (existing) { existing.username = member.username; existing.displayName = member.displayName; existing.side = side; continue; }
      match.players.push({ userId: member.userId, username: member.username, displayName: member.displayName, side, ready: false, connected: false });
      if (match.players.length > 2) match.players.splice(2);
    }
  }

  private player(match: MatchState, userId: string): MatchPlayerState {
    const player = match.players.find((item) => item.userId === userId);
    if (!player) throw new AppError("UNAUTHORIZED", "Bạn không phải người chơi của match này.", 403, false, "FATAL_SESSION", { reason: "NOT_MATCH_MEMBER" });
    return player;
  }

  private assertVersion(match: MatchState, stateVersion: number): void {
    if (stateVersion !== match.stateVersion) throw new AppError("CONFLICT", "Trạng thái bàn cờ đã thay đổi, hãy đồng bộ lại.", 409, true, "RECOVERABLE", { reason: "STALE_STATE", stateVersion: match.stateVersion, event: "STATE_RESYNC" });
  }

  private invalidState(command: string, status: MatchState["status"]): AppError {
    return new AppError("CONFLICT", `Không thể thực hiện ${command} ở trạng thái ${status}.`, 409, false, "INVALID", { reason: "INVALID_MATCH_STATE", status });
  }

  private assertReferee(match: MatchState, actor: MatchActor): void {
    if (!match.refereeEnabled || match.refereeUserId !== actor.userId || actor.principal === "GUEST") {
      throw new AppError("UNAUTHORIZED", "Chỉ trọng tài được chỉ định mới có quyền điều khiển trận.", 403, false, "FATAL_SESSION", { reason: "REFEREE_REQUIRED" });
    }
  }

  private assertReplacementWindow(match: MatchState): void {
    this.advance(match);
    if (match.status !== "PAUSED" || match.pauseReason !== "REFEREE" || match.refereeConnected) throw new AppError("CONFLICT", "Chỉ có thể thay thế trọng tài khi trận đang dừng vì trọng tài vắng mặt.", 409, false, "RECOVERABLE", { reason: "REPLACEMENT_WINDOW_CLOSED" });
    if (match.replacementExpiresAt !== null && this.now() >= match.replacementExpiresAt) {
      match.replacementStatus = "IDLE";
      match.replacementCandidateUserId = null;
      match.replacementNominatedByUserId = null;
      match.replacementApprovedByUserIds.clear();
      match.replacementExpiresAt = null;
      throw new AppError("CONFLICT", "Thời hạn khôi phục trọng tài đã hết.", 409, false, "RECOVERABLE", { reason: "REPLACEMENT_EXPIRED" });
    }
  }

  private assertReplacementCandidate(match: MatchState): void {
    if (!match.replacementCandidateUserId) throw new AppError("CONFLICT", "Chưa có tài khoản được đề cử làm trọng tài mới.", 409, false, "RECOVERABLE", { reason: "REPLACEMENT_NOT_NOMINATED" });
  }

  private assertReplacementPlayer(match: MatchState, actor: MatchActor): void {
    if (actor.principal === "GUEST") throw new AppError("UNAUTHORIZED", "Guest không thể đề cử hoặc chấp thuận trọng tài thay thế.", 403, false, "FATAL_SESSION", { reason: "GUEST_REPLACEMENT_FORBIDDEN" });
    if (!match.players.some((player) => player.userId === actor.userId)) throw new AppError("UNAUTHORIZED", "Chỉ người chơi trong trận mới có thể xác nhận thay thế.", 403, false, "FATAL_SESSION", { reason: "PLAYER_REQUIRED" });
  }

  private restoreCheckpoint(match: MatchState, checkpoint: MatchCheckpoint): void {
    const snapshot = checkpoint.snapshot;
    match.matchId = snapshot.matchId;
    match.status = snapshot.status;
    match.players = snapshot.players.map((player) => ({ ...player }));
    match.ruleState = { board: snapshot.board as RuleState["board"], pieceCounts: snapshot.pieceCounts, currentTurn: snapshot.currentTurn, status: snapshot.status === "FINISHED" || snapshot.status === "ABORTED" ? "FINISHED" : "PLAYING", winner: snapshot.winner, resultReason: null };
    match.clocksMs = { ...snapshot.clocksMs };
    match.countdownEndsAt = snapshot.countdownEndsAt;
    match.startedAt = snapshot.startedAt ?? null;
    match.endedAt = snapshot.endedAt ?? null;
    match.sequence = checkpoint.sequence;
    match.stateVersion = checkpoint.stateVersion;
    match.resultReason = snapshot.resultReason;
    match.botAdjudication = snapshot.botAdjudication ?? null;
    match.playMode = snapshot.playMode ?? "MANUAL";
    match.winner = snapshot.winner;
    match.pauseReason = snapshot.pauseReason ?? null;
    match.pauseCategory = snapshot.pauseCategory ?? null;
    match.pausedAt = snapshot.pausedAt ?? null;
    match.pausedByUserId = snapshot.pausedByUserId ?? null;
    match.pausePhase = snapshot.pausePhase ?? null;
    match.pauseElapsedMs = snapshot.pauseElapsedMs ?? 0;
    match.resumeEndsAt = snapshot.resumeEndsAt ?? null;
    match.replacementStatus = snapshot.replacementStatus ?? "IDLE";
    match.replacementCandidateUserId = snapshot.replacementCandidateUserId ?? null;
    match.replacementNominatedByUserId = snapshot.replacementNominatedByUserId ?? null;
    match.replacementApprovedByUserIds = new Set(snapshot.replacementApprovedByUserIds ?? []);
    match.replacementExpiresAt = snapshot.replacementExpiresAt ?? null;
    match.moves = [...checkpoint.moves];
    match.publicTimeline = [...(snapshot.publicTimeline ?? [])];
    match.expiredDisconnects = new Set(checkpoint.expiredDisconnects);
    const deadlines = new Map(Object.entries(checkpoint.disconnectDeadlines));
    if (deadlines.size > 0) {
      this.disconnectDeadlines.set(match.roomId, deadlines);
      const timers = new Map<string, NodeJS.Timeout>();
      for (const [userId, deadline] of deadlines) timers.set(userId, setTimeout(() => this.expireDisconnect(match.roomId, userId), Math.max(0, deadline - this.now())));
      this.disconnectTimers.set(match.roomId, timers);
    }
    match.turnStartedAt = match.status === "PLAYING" ? this.now() : null;
    for (const player of match.players) match.sideByUserId.set(player.userId, player.side);
  }

  private persistCheckpoint(match: MatchState): void {
    if (!this.persistence) return;
    this.persistence.saveCheckpoint(this.checkpoint(match));
  }

  private checkpoint(match: MatchState): MatchCheckpoint {
    return { roomId: match.roomId, matchId: match.matchId, sequence: match.sequence, stateVersion: match.stateVersion, snapshot: this.snapshot(match), moves: match.moves, disconnectDeadlines: Object.fromEntries(this.disconnectDeadlines.get(match.roomId) ?? []), expiredDisconnects: [...match.expiredDisconnects] };
  }

  private pauseInternal(match: MatchState, actorId: string, reason: MatchPauseReason, category: MatchPauseCategory | null = null): void {
    if (match.status === "PAUSED") return;
    const phase = match.status === "COUNTDOWN" || match.status === "PLAYING" ? match.status : match.pausePhase;
    if (phase === null) return;
    if (match.status === "PLAYING") this.advance(match, true);
    if (match.status === "FINISHED" || match.status === "ABORTED") return;
    match.pausePhase = phase;
    match.status = "PAUSED";
    match.pauseReason = reason;
    match.pauseCategory = category;
    match.pausedAt ??= this.now();
    match.pausedByUserId = actorId;
    match.resumeEndsAt = null;
    match.countdownEndsAt = null;
    match.turnStartedAt = null;
    match.stateVersion += 1;
    this.emit(match, "MATCH_PAUSED");
  }

  private advance(match: MatchState, emitClock = false): void {
    const now = this.now();
    if ((match.status === "PAUSED" || match.status === "RESUMING") && this.pauseLimitExceeded(match, now)) {
      this.abortPause(match);
      return;
    }
    if (match.status === "RESUMING" && match.resumeEndsAt !== null && now >= match.resumeEndsAt) {
      if (this.pendingDisconnects(match) > 0 || match.expiredDisconnects.size > 0) return;
      const phase = match.pausePhase ?? "PLAYING";
      match.status = phase;
      match.resumeEndsAt = null;
      if (phase === "PLAYING") match.turnStartedAt = now;
      if (phase === "COUNTDOWN") match.countdownEndsAt = now + 3_000;
      if (match.pausedAt !== null) match.pauseElapsedMs += Math.max(0, now - match.pausedAt);
      match.pauseReason = null;
      match.pauseCategory = null;
      match.pausedAt = null;
      match.pausedByUserId = null;
      match.pausePhase = null;
      match.stateVersion += 1;
      this.emit(match, "MATCH_RESUMED");
    }
    if (match.status === "PAUSED" || match.status === "RESUMING") return;
    if (match.status === "COUNTDOWN" && match.countdownEndsAt !== null && now >= match.countdownEndsAt) {
      match.status = "PLAYING";
      match.countdownEndsAt = null;
      match.turnStartedAt = now;
      match.startedAt = now;
      match.stateVersion += 1;
      this.emit(match, "MATCH_STARTED");
    }
    if (match.status !== "PLAYING" || match.turnStartedAt === null || match.ruleState.currentTurn === null) return;
    if (this.pendingDisconnects(match) > 0 || match.expiredDisconnects.size > 0) return;
    const elapsed = Math.max(0, now - match.turnStartedAt);
    if (elapsed === 0) return;
    const side = match.ruleState.currentTurn;
    match.clocksMs[side] = Math.max(0, match.clocksMs[side] - elapsed);
    match.turnStartedAt = now;
    if (match.clocksMs[side] === 0) {
      this.finish(match, side === "BLUE" ? "RED" : "BLUE", "TIMEOUT");
      this.emit(match, "MATCH_FINISHED");
      return;
    }
    if (emitClock) this.emit(match, "CLOCK_TICK");
  }

  private finish(match: MatchState, winner: Side, reason: "TIMEOUT" | "SURRENDER" | "DISCONNECT_TIMEOUT" | "BOT_AUTHOR_FAULT" | "BOT_LIMIT_CRITERIA" | "BOT_LIMIT_EXACT_TIE"): void {
    match.status = "FINISHED";
    match.winner = winner;
    match.resultReason = reason;
    match.ruleState = { ...match.ruleState, status: "FINISHED", currentTurn: null, winner, resultReason: null };
    match.stateVersion += 1;
    match.turnStartedAt = null;
    match.endedAt = this.now();
    this.clearDisconnectState(match.roomId);
    this.releaseLocks(match.roomId);
  }

  private expireDisconnect(roomId: string, userId: string): void {
    const match = this.matches.get(roomId);
    const roomTimers = this.disconnectTimers.get(roomId);
    roomTimers?.delete(userId);
    if (!match || (match.status !== "COUNTDOWN" && match.status !== "PLAYING" && match.status !== "PAUSED" && match.status !== "RESUMING") || this.connections.get(roomId)?.get(userId)?.size) return;
    this.disconnectDeadlines.get(roomId)?.delete(userId);
    match.expiredDisconnects.add(userId);
    const other = match.players.find((player) => player.userId !== userId);
    if (other && match.expiredDisconnects.has(other.userId)) {
      this.abortDisconnect(match);
      return;
    }
    const otherIsInGrace = other !== undefined && !other.connected && (this.disconnectDeadlines.get(roomId)?.has(other.userId) ?? false);
    if (!other || other.connected || !otherIsInGrace) {
      const winner = other?.side ?? (match.players.find((player) => player.userId === userId)?.side === "BLUE" ? "RED" : "BLUE");
      this.finish(match, winner, "DISCONNECT_TIMEOUT");
      match.expiredDisconnects.clear();
      this.emit(match, "MATCH_FINISHED");
      return;
    }
  }

  private pendingDisconnects(match: MatchState): number {
    return this.disconnectDeadlines.get(match.roomId)?.size ?? 0;
  }

  private abortDisconnect(match: MatchState): void {
    match.status = "ABORTED";
    match.winner = null;
    match.resultReason = "DISCONNECT_TIMEOUT";
    match.ruleState = { ...match.ruleState, status: "FINISHED", currentTurn: null, winner: null, resultReason: null };
    match.stateVersion += 1;
    match.turnStartedAt = null;
    match.endedAt = this.now();
    match.expiredDisconnects.clear();
    this.clearDisconnectState(match.roomId);
    this.releaseLocks(match.roomId);
    this.emit(match, "MATCH_ABORTED");
  }

  private pauseLimitExceeded(match: MatchState, now: number): boolean {
    if (match.pauseReason !== "REFEREE" || match.pausedAt === null) return false;
    const continuous = Math.max(0, now - match.pausedAt);
    const total = match.pauseElapsedMs + continuous;
    return continuous >= MatchManager.REFEREE_PAUSE_MAX_MS || total >= MatchManager.REFEREE_PAUSE_TOTAL_MAX_MS;
  }

  private abortPause(match: MatchState): void {
    match.status = "ABORTED";
    match.winner = null;
    match.resultReason = "SERVER_INTERRUPTION";
    match.ruleState = { ...match.ruleState, status: "FINISHED", currentTurn: null, winner: null, resultReason: null };
    match.stateVersion += 1;
    match.turnStartedAt = null;
    match.endedAt = this.now();
    this.clearDisconnectState(match.roomId);
    this.releaseLocks(match.roomId);
    this.emit(match, "MATCH_ABORTED");
  }

  private clearDisconnectState(roomId: string): void {
    for (const timer of this.disconnectTimers.get(roomId)?.values() ?? []) clearTimeout(timer);
    this.disconnectTimers.delete(roomId);
    this.disconnectDeadlines.delete(roomId);
  }

  private releaseLocks(roomId: string): void {
    for (const [userId, lock] of this.activeLocks.entries()) if (lock.roomId === roomId) this.activeLocks.delete(userId);
  }

  private releaseLock(userId: string, roomId: string, clientId: string): void {
    const lock = this.activeLocks.get(userId);
    if (lock?.roomId === roomId && lock.clientId === clientId) this.activeLocks.delete(userId);
  }

  private snapshot(match: MatchState): MatchSnapshot {
    return {
      matchId: match.matchId,
      roomId: match.roomId,
      hostUserId: match.hostUserId,
      mode: match.mode,
      playMode: match.playMode,
      status: match.status,
      players: match.players.map(({ userId, username, displayName, side, ready, connected }) => ({ userId, username, displayName, side, ready, connected })),
      board: match.ruleState.board,
      pieceCounts: match.ruleState.pieceCounts,
      currentTurn: match.ruleState.currentTurn,
      winner: match.winner,
      resultReason: match.resultReason,
      botAdjudication: match.botAdjudication,
      clocksMs: { ...match.clocksMs },
      timerSeconds: match.timerSeconds,
      countdownEndsAt: match.countdownEndsAt,
      ...(match.startedAt !== null ? { startedAt: match.startedAt } : { startedAt: null }),
      ...(match.endedAt !== null ? { endedAt: match.endedAt } : { endedAt: null }),
      sequence: match.sequence,
      stateVersion: match.stateVersion,
      rating: match.rating,
      rematchRequestedBy: match.rematchRequestedBy,
      refereeEnabled: match.refereeEnabled,
      refereeUserId: match.refereeUserId,
      refereeConnected: match.refereeConnected,
      pauseReason: match.pauseReason,
      pauseCategory: match.pauseCategory,
      pausedAt: match.pausedAt,
      pausedByUserId: match.pausedByUserId,
      pausePhase: match.pausePhase,
      pauseElapsedMs: match.pauseElapsedMs,
      resumeEndsAt: match.resumeEndsAt,
      replacementStatus: match.replacementStatus,
      replacementCandidateUserId: match.replacementCandidateUserId,
      replacementNominatedByUserId: match.replacementNominatedByUserId,
      replacementApprovedByUserIds: [...match.replacementApprovedByUserIds],
      replacementExpiresAt: match.replacementExpiresAt,
      moves: match.moves.map((move) => ({ ...move })),
      publicTimeline: match.publicTimeline.map((event) => ({ ...event })),
    };
  }

  private emit(match: MatchState, type: MatchEventType, timelineMeta: { side?: Side; revisionNumber?: number } = {}): void {
    match.sequence += 1;
    const publicType: MatchPublicTimelineEvent["type"] | null = type === "MATCH_STARTED" || type === "PIECE_MOVE_ACCEPTED" || type === "MATCH_PAUSED" || type === "MATCH_RESUMED" || type === "REFEREE_REPLACED" || type === "BOT_REVISION_APPLIED" || type === "MATCH_FINISHED" || type === "MATCH_ABORTED" ? type : null;
    if (publicType) {
      const latestMove = match.moves.at(-1);
      match.publicTimeline.push({
        sequence: match.sequence,
        type: publicType,
        timestamp: this.now(),
        ...(publicType === "PIECE_MOVE_ACCEPTED" && latestMove ? { side: latestMove.side } : {}),
        ...(publicType === "BOT_REVISION_APPLIED" && timelineMeta.side ? { side: timelineMeta.side, revisionNumber: timelineMeta.revisionNumber } : {}),
        ...(publicType === "MATCH_FINISHED" || publicType === "MATCH_ABORTED" ? { reason: match.resultReason } : {}),
        ...(publicType === "MATCH_PAUSED" && match.pauseCategory ? { reason: match.pauseCategory } : {}),
      });
    }
    const envelope = this.createEnvelope(match, type);
    if (this.persistence?.commitEvent) this.persistence.commitEvent(this.checkpoint(match), envelope);
    else {
      this.persistence?.appendEvent(envelope);
      this.persistCheckpoint(match);
    }
    for (const listener of this.listeners.get(match.roomId) ?? []) listener(envelope);
    for (const listener of this.spectatorListeners.get(match.roomId) ?? []) listener(envelope);
  }

  private createEnvelope(match: MatchState, type: MatchEventType): MatchEventEnvelope {
    return {
      protocolVersion: "0.1",
      messageId: randomUUID(),
      type,
      timestamp: this.now(),
      roomId: match.roomId,
      matchId: match.matchId,
      sequence: match.sequence,
      stateVersion: match.stateVersion,
      payload: this.snapshot(match),
    };
  }
}
