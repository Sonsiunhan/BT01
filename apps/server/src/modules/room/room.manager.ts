import { randomInt, randomUUID } from "node:crypto";
import type { CreateRoomRequest, JoinRoomRequest, RoomDetail, RoomSummary, SpectateRoomRequest, RoomPlayMode } from "@ottv2/contracts";

import { AppError } from "../../shared/errors/app-error.js";
import { hashSecret, verifySecret } from "../auth/auth.crypto.js";

const ROOM_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const FRIENDLY_ADJECTIVES = ["Neon", "Silent", "Crimson", "Silver", "Swift", "Lucky"];
const FRIENDLY_NOUNS = ["Hammer", "Lotus", "Fox", "Orbit", "Tiger", "Comet"];
const randomInviteId = () => `ref-${randomUUID()}`;

export type RoomActor = { userId: string; username: string; displayName: string; rating?: number; principal?: "ACCOUNT" | "GUEST" };
type RoomMember = RoomActor & { joinedAt: number; isHost: boolean; ready: boolean };
type Referee = RoomActor & { connected: boolean; joinedAt: number };
export type RefereeInvite = { inviteId: string; roomId: string; targetUserId: string; from: { userId: string; username: string; displayName: string }; role: "REFEREE"; expiresAt: number; status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" };
type RoomState = {
  roomId: string;
  roomGeneration: string;
  roomVersion: number;
  name: string;
  mode: "UNRANKED" | "RANKED";
  playMode: RoomPlayMode;
  visibility: "PUBLIC" | "PRIVATE";
  passwordHash?: string;
  timerSeconds: 30 | 60 | 300 | 600 | 1800 | 3600;
  spectatorsEnabled: boolean;
  spectatorCapacity?: 1 | 2 | 5 | 10 | 50 | 100;
  refereeEnabled: boolean;
  referee?: Referee;
  status: "WAITING" | "PLAYING" | "ENDED" | "ABORTED";
  members: RoomMember[];
  spectatorIds: Set<string>;
  createdAt: number;
  setupContext?: {
    setupDescriptor: { version: "rps-v2" | "rps-v1"; seed?: number };
    setupSignature?: string;
  };
  previousInitialSetup?: {
    setupSignature: string;
  };
};

type IdempotencyRecord = { fingerprint: string; roomId: string };

export class RoomManager {
  private readonly rooms = new Map<string, RoomState>();
  private readonly listeners = new Set<(rooms: RoomSummary[]) => void>();
  private readonly spectatorRevocations = new Map<string, Set<() => void>>();
  private readonly createIdempotency = new Map<string, IdempotencyRecord>();
  private readonly joinIdempotency = new Map<string, IdempotencyRecord>();
  private readonly refereeInvites = new Map<string, RefereeInvite>();
  private readonly roomLocks = new Map<string, Promise<void>>();

  subscribe(listener: (rooms: RoomSummary[]) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  private publish(): void { const rooms = this.list(100); for (const listener of this.listeners) listener(rooms); }

  private async runWithRoomLock<T>(roomId: string, action: () => Promise<T>): Promise<T> {
    const currentLock = this.roomLocks.get(roomId) ?? Promise.resolve();
    let release!: () => void;
    const nextLock = new Promise<void>((resolve) => { release = resolve; });
    const queuedLock = currentLock.then(() => nextLock);
    this.roomLocks.set(roomId, queuedLock);

    await currentLock;
    try {
      return await action();
    } finally {
      release();
      if (this.roomLocks.get(roomId) === queuedLock) {
        this.roomLocks.delete(roomId);
      }
    }
  }

  async create(actor: RoomActor, input: CreateRoomRequest, idempotencyKey?: string): Promise<RoomDetail> {
    const fingerprint = JSON.stringify(input);
    if (idempotencyKey) {
      const key = `${actor.userId}:${idempotencyKey}`;
      const previous = this.createIdempotency.get(key);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new AppError("CONFLICT", "Idempotency-Key đã được dùng cho yêu cầu khác.", 409, false, "INVALID");
        const existing = this.rooms.get(previous.roomId);
        if (existing) return this.serialize(existing, actor.userId);
      }
    }
    const roomId = this.generateRoomId();
    const roomGeneration = randomUUID();
    const roomVersion = 1;
    const passwordHash = input.password === undefined ? undefined : await hashSecret(input.password);
    const member: RoomMember = { ...actor, joinedAt: Date.now(), isHost: true, ready: false };
    const playMode = input.playMode ?? "MANUAL";
    const refereeEnabled = input.refereeEnabled ?? false;
    if (actor.principal === "GUEST" && (input.hostRole ?? "PLAYER") === "REFEREE") throw new AppError("UNAUTHORIZED", "Guest không thể làm trọng tài.", 403, false, "FATAL_SESSION", { reason: "GUEST_REFEREE_FORBIDDEN" });
    if (input.hostRole === "REFEREE" && !refereeEnabled) throw new AppError("VALIDATION_ERROR", "Bật trọng tài trước khi chọn vai trò Trọng tài.", 400, false, "INVALID");
    if (input.visibility === "PUBLIC" && refereeEnabled && input.hostRole === "REFEREE") throw new AppError("VALIDATION_ERROR", "Phòng có chủ phòng làm trọng tài phải là Private.", 400, false, "INVALID");

    const seed = Math.floor(Math.random() * 2822400);
    const room: RoomState = {
      roomId,
      roomGeneration,
      roomVersion,
      name: input.name?.trim() || this.generateFriendlyName(),
      mode: "UNRANKED",
      playMode,
      visibility: input.visibility,
      ...(passwordHash ? { passwordHash } : {}),
      timerSeconds: input.timerSeconds,
      spectatorsEnabled: input.spectatorsEnabled ?? false,
      ...(input.spectatorCapacity !== undefined ? { spectatorCapacity: input.spectatorCapacity } : {}),
      refereeEnabled,
      status: "WAITING",
      members: input.hostRole === "REFEREE" ? [] : [member],
      ...(input.hostRole === "REFEREE" ? { referee: { ...actor, connected: false, joinedAt: Date.now() } } : {}),
      spectatorIds: new Set(),
      createdAt: Date.now(),
      setupContext: {
        setupDescriptor: { version: "rps-v2", seed },
        setupSignature: `seed-${seed}`,
      },
    };
    this.rooms.set(roomId, room);
    if (idempotencyKey) this.createIdempotency.set(`${actor.userId}:${idempotencyKey}`, { fingerprint, roomId });
    this.publish();
    return this.serialize(room, actor.userId);
  }

  async createRanked(host: RoomActor, opponent: RoomActor, timerSeconds: 30 | 60 | 300 | 600 | 1800 | 3600 = 300): Promise<RoomDetail> {
    if (host.userId === opponent.userId) throw new AppError("CONFLICT", "Không thể ghép tài khoản với chính mình.", 409, false, "INVALID");
    const roomId = this.generateRoomId();
    const roomGeneration = randomUUID();
    const now = Date.now();
    const seed = Math.floor(Math.random() * 2822400);
    const room: RoomState = {
      roomId,
      roomGeneration,
      roomVersion: 1,
      name: "Ranked Quick Match",
      mode: "RANKED",
      playMode: "MANUAL",
      visibility: "PRIVATE",
      timerSeconds,
      spectatorsEnabled: false,
      refereeEnabled: false,
      status: "WAITING",
      members: [
        { ...host, joinedAt: now, isHost: true, ready: true },
        { ...opponent, joinedAt: now, isHost: false, ready: true },
      ],
      spectatorIds: new Set(),
      createdAt: now,
      setupContext: {
        setupDescriptor: { version: "rps-v2", seed },
        setupSignature: `seed-${seed}`,
      },
    };
    this.rooms.set(roomId, room);
    this.publish();
    return this.serialize(room, host.userId);
  }

  /** Roll back a ranked room that has never started when match admission fails. */
  discardRanked(roomId: string): void {
    const normalizedRoomId = roomId.trim().toUpperCase();
    const room = this.rooms.get(normalizedRoomId);
    if (!room || room.mode !== "RANKED" || room.status !== "WAITING") return;
    this.rooms.delete(normalizedRoomId);
    this.publish();
  }

  /** Roll back an unranked room created by a queue admission before gameplay starts. */
  discardUnranked(roomId: string): void {
    const normalizedRoomId = roomId.trim().toUpperCase();
    const room = this.rooms.get(normalizedRoomId);
    if (!room || room.mode !== "UNRANKED" || room.status !== "WAITING") return;
    this.rooms.delete(normalizedRoomId);
    this.publish();
  }

  list(limit = 8): RoomSummary[] {
    return [...this.rooms.values()]
      .filter((room) => room.visibility === "PUBLIC" && room.status === "WAITING" && room.members.length < 2)
      .sort((left, right) => left.createdAt - right.createdAt)
      .slice(0, Math.max(1, Math.min(limit, 100)))
      .map((room) => this.serialize(room, undefined));
  }

  search(roomId: string, viewerId?: string): RoomDetail {
    const room = this.rooms.get(roomId.trim().toUpperCase());
    if (!room) throw new AppError("NOT_FOUND", "Phòng đấu không tồn tại.", 404, false, "INVALID");
    return this.serialize(room, viewerId);
  }

  async join(actor: RoomActor, roomId: string, input: JoinRoomRequest, idempotencyKey?: string): Promise<RoomDetail> {
    return this.joinInternal(actor, roomId, input, idempotencyKey, false);
  }

  async joinByInvite(actor: RoomActor, roomId: string): Promise<RoomDetail> {
    return this.joinInternal(actor, roomId, {}, undefined, true);
  }

  async inviteReferee(actor: RoomActor, roomId: string, targetUserId: string, ttlMs = 5 * 60_000): Promise<RefereeInvite> {
    const room = this.getRoom(roomId);
    if (!room.refereeEnabled) throw new AppError("CONFLICT", "Phòng này không bật trọng tài.", 409, false, "INVALID", { reason: "REFEREE_DISABLED" });
    if (room.status !== "WAITING") throw new AppError("CONFLICT", "Cấu hình trọng tài đã bị khóa sau khi trận bắt đầu.", 409, false, "INVALID", { reason: "ROOM_CONFIG_LOCKED" });
    if (room.members.every((member) => member.userId !== actor.userId) && room.referee?.userId !== actor.userId) throw new AppError("UNAUTHORIZED", "Chỉ chủ phòng mới được mời trọng tài.", 403, false, "FATAL_SESSION", { reason: "ROOM_HOST_REQUIRED" });
    if (room.members.find((member) => member.isHost)?.userId !== actor.userId && room.referee?.userId !== actor.userId) throw new AppError("UNAUTHORIZED", "Chỉ chủ phòng mới được mời trọng tài.", 403, false, "FATAL_SESSION", { reason: "ROOM_HOST_REQUIRED" });
    if (actor.principal === "GUEST") throw new AppError("UNAUTHORIZED", "Guest không thể chỉ định trọng tài.", 403, false, "FATAL_SESSION", { reason: "GUEST_REFEREE_FORBIDDEN" });
    if (room.referee) throw new AppError("CONFLICT", "Phòng đã có trọng tài.", 409, false, "INVALID", { reason: "REFEREE_ALREADY_ASSIGNED" });
    if (room.members.some((member) => member.userId === targetUserId)) throw new AppError("CONFLICT", "Người chơi không thể đồng thời làm trọng tài.", 409, false, "INVALID", { reason: "PLAYER_REFEREE_CONFLICT" });
    const invite: RefereeInvite = { inviteId: randomInviteId(), roomId: room.roomId, targetUserId, from: { userId: actor.userId, username: actor.username, displayName: actor.displayName }, role: "REFEREE", expiresAt: Date.now() + ttlMs, status: "PENDING" };
    this.refereeInvites.set(invite.inviteId, invite);
    room.roomVersion += 1;
    this.publish();
    return { ...invite };
  }

  async acceptRefereeInvite(actor: RoomActor, inviteId: string): Promise<RoomDetail> {
    if (actor.principal === "GUEST") throw new AppError("UNAUTHORIZED", "Guest không thể làm trọng tài.", 403, false, "FATAL_SESSION", { reason: "GUEST_REFEREE_FORBIDDEN" });
    const invite = this.refereeInvites.get(inviteId);
    if (!invite || invite.status !== "PENDING") throw new AppError("NOT_FOUND", "Lời mời trọng tài không còn hiệu lực.", 404, false, "INVALID");
    if (invite.expiresAt <= Date.now()) { invite.status = "EXPIRED"; throw new AppError("CONFLICT", "Lời mời trọng tài đã hết hạn.", 409, false, "INVALID", { reason: "REFEREE_INVITE_EXPIRED" }); }
    if (invite.targetUserId !== actor.userId) throw new AppError("UNAUTHORIZED", "Lời mời này không dành cho bạn.", 403, false, "FATAL_SESSION", { reason: "REFEREE_INVITE_TARGET_MISMATCH" });
    const room = this.getRoom(invite.roomId);
    if (room.status !== "WAITING") throw new AppError("CONFLICT", "Không thể nhận trọng tài sau khi trận đã bắt đầu.", 409, false, "INVALID", { reason: "ROOM_CONFIG_LOCKED" });
    if (room.members.some((member) => member.userId === actor.userId)) throw new AppError("CONFLICT", "Người chơi không thể đồng thời làm trọng tài.", 409, false, "INVALID", { reason: "PLAYER_REFEREE_CONFLICT" });
    room.referee = { ...actor, connected: false, joinedAt: Date.now() };
    invite.status = "ACCEPTED";
    for (const other of this.refereeInvites.values()) if (other.roomId === room.roomId && other.inviteId !== invite.inviteId && other.status === "PENDING") other.status = "EXPIRED";
    room.roomVersion += 1;
    this.publish();
    return this.serialize(room, actor.userId);
  }

  refereeInvitesFor(targetUserId: string): RefereeInvite[] {
    const now = Date.now();
    return [...this.refereeInvites.values()]
      .filter((invite) => invite.targetUserId === targetUserId)
      .map((invite) => {
        if (invite.status === "PENDING" && invite.expiresAt <= now) invite.status = "EXPIRED";
        return invite;
      })
      .filter((invite) => invite.status === "PENDING")
      .map((invite) => ({ ...invite, from: { ...invite.from } }));
  }

  declineRefereeInvite(actor: RoomActor, inviteId: string): RefereeInvite {
    const invite = this.refereeInvites.get(inviteId);
    if (!invite || invite.targetUserId !== actor.userId || invite.status !== "PENDING") throw new AppError("NOT_FOUND", "Lời mời trọng tài không còn hiệu lực.", 404, false, "INVALID");
    invite.status = invite.expiresAt <= Date.now() ? "EXPIRED" : "DECLINED";
    return { ...invite };
  }

  isReferee(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId.trim().toUpperCase());
    return room?.referee?.userId === userId;
  }

  markRefereeConnected(roomId: string, userId: string, connected: boolean): void {
    const room = this.getRoom(roomId);
    if (room.referee?.userId !== userId) throw new AppError("UNAUTHORIZED", "Bạn không phải trọng tài của phòng này.", 403, false, "FATAL_SESSION", { reason: "REFEREE_REQUIRED" });
    room.referee.connected = connected;
    room.roomVersion += 1;
    this.publish();
  }

  leaveReferee(roomId: string, userId: string): void {
    const room = this.getRoom(roomId);
    if (room.referee?.userId !== userId) throw new AppError("CONFLICT", "Bạn không phải trọng tài của phòng này.", 409, false, "INVALID", { reason: "REFEREE_REQUIRED" });
    if (room.status !== "WAITING") throw new AppError("CONFLICT", "Không thể rời vai trò trọng tài sau khi trận bắt đầu.", 409, false, "INVALID", { reason: "ROOM_CONFIG_LOCKED" });
    delete room.referee;
    for (const invite of this.refereeInvites.values()) if (invite.roomId === room.roomId && invite.status === "PENDING") invite.status = "EXPIRED";
    room.roomVersion += 1;
    this.publish();
  }

  /** Atomically transfers the appointed Referee after the match-level consent gate passes. */
  replaceReferee(roomId: string, oldUserId: string, actor: RoomActor): void {
    const room = this.getRoom(roomId);
    if (!room.referee || room.referee.userId !== oldUserId) throw new AppError("CONFLICT", "Vai trò trọng tài đã thay đổi. Hãy đồng bộ lại phòng.", 409, false, "RECOVERABLE", { reason: "REFEREE_CHANGED" });
    if (actor.principal === "GUEST") throw new AppError("UNAUTHORIZED", "Guest không thể nhận vai trò trọng tài.", 403, false, "FATAL_SESSION", { reason: "GUEST_REFEREE_FORBIDDEN" });
    if (room.members.some((member) => member.userId === actor.userId)) throw new AppError("CONFLICT", "Người chơi không thể đồng thời làm trọng tài.", 409, false, "INVALID", { reason: "PLAYER_REFEREE_CONFLICT" });
    if (room.spectatorIds.has(actor.userId)) throw new AppError("CONFLICT", "Spectator phải rời chế độ xem trước khi nhận vai trò trọng tài.", 409, false, "INVALID", { reason: "SPECTATOR_REFEREE_CONFLICT" });
    room.referee = { ...actor, connected: true, joinedAt: Date.now() };
    for (const invite of this.refereeInvites.values()) if (invite.roomId === room.roomId && invite.status === "PENDING") invite.status = "EXPIRED";
    room.roomVersion += 1;
    this.publish();
  }

  async spectate(actor: RoomActor, roomId: string, input: SpectateRoomRequest): Promise<RoomDetail> {
    const normalizedRoomId = roomId.trim().toUpperCase();
    const room = this.rooms.get(normalizedRoomId);
    if (!room) throw new AppError("NOT_FOUND", "Phòng đấu không tồn tại.", 404, false, "INVALID");
    if (room.referee?.userId === actor.userId) throw new AppError("CONFLICT", "Trọng tài không thể tham gia cùng trận với vai trò spectator.", 409, false, "INVALID", { reason: "SPECTATOR_REFEREE_CONFLICT" });
    if (room.members.some((member) => member.userId === actor.userId)) {
      throw new AppError("CONFLICT", "Người chơi không thể vào cùng trận với vai trò spectator.", 409, false, "INVALID", { reason: "SPECTATOR_PLAYER_CONFLICT" });
    }
    if (!room.spectatorsEnabled) throw new AppError("CONFLICT", "Phòng này không cho phép spectator.", 409, false, "INVALID", { reason: "SPECTATOR_DISABLED" });
    if (room.passwordHash && (!input.password || !(await verifySecret(input.password, room.passwordHash)))) {
      throw new AppError("UNAUTHORIZED", "Mật khẩu phòng không đúng.", 401, false, "INVALID", { reason: "SPECTATOR_PASSWORD_REQUIRED" });
    }
    if (!room.spectatorIds.has(actor.userId) && room.spectatorCapacity !== undefined && room.spectatorIds.size >= room.spectatorCapacity) {
      throw new AppError("CONFLICT", "Phòng đã đạt sức chứa spectator.", 409, false, "INVALID", { reason: "SPECTATOR_CAPACITY", capacity: room.spectatorCapacity });
    }
    room.spectatorIds.add(actor.userId);
    this.publish();
    return this.serialize(room, undefined, true);
  }

  leaveSpectator(roomId: string, userId: string): void {
    const normalizedRoomId = roomId.trim().toUpperCase();
    const room = this.rooms.get(normalizedRoomId);
    const removed = room?.spectatorIds.delete(userId) ?? false;
    this.revokeSpectatorStreams(normalizedRoomId, userId);
    if (removed) this.publish();
  }

  isSpectator(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId.trim().toUpperCase());
    return room !== undefined && room.spectatorsEnabled && room.spectatorIds.has(userId) && !room.members.some((member) => member.userId === userId);
  }

  /** Room-role revocation only; authentication session lifecycle is handled separately. */
  subscribeSpectatorRevocation(roomId: string, userId: string, listener: () => void): () => void {
    const normalizedRoomId = roomId.trim().toUpperCase();
    if (!this.isSpectator(normalizedRoomId, userId)) { listener(); return () => {}; }
    const key = `${normalizedRoomId}:${userId}`;
    const listeners = this.spectatorRevocations.get(key) ?? new Set<() => void>();
    listeners.add(listener);
    this.spectatorRevocations.set(key, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && this.spectatorRevocations.get(key) === listeners) this.spectatorRevocations.delete(key);
    };
  }

  private revokeSpectatorStreams(roomId: string, userId: string): void {
    const key = `${roomId}:${userId}`;
    const listeners = this.spectatorRevocations.get(key);
    this.spectatorRevocations.delete(key);
    if (listeners) for (const listener of [...listeners]) listener();
  }

  spectatorView(roomId: string, userId: string): RoomDetail {
    const room = this.rooms.get(roomId.trim().toUpperCase());
    if (!room) throw new AppError("NOT_FOUND", "Phòng đấu không tồn tại.", 404, false, "INVALID");
    if (!this.isSpectator(room.roomId, userId)) throw new AppError("UNAUTHORIZED", "Bạn chưa được cấp quyền spectator cho phòng này.", 403, false, "INVALID", { reason: "SPECTATOR_ACCESS_REQUIRED" });
    return this.serialize(room, undefined, true);
  }

  private async joinInternal(actor: RoomActor, roomId: string, input: JoinRoomRequest, idempotencyKey: string | undefined, bypassPassword: boolean): Promise<RoomDetail> {
    const normalizedRoomId = roomId.trim().toUpperCase();
    return this.runWithRoomLock(normalizedRoomId, async () => {
      const room = this.rooms.get(normalizedRoomId);
      if (!room) throw new AppError("NOT_FOUND", "Phòng đấu không tồn tại.", 404, false, "INVALID");

      if (input.expectedGeneration && input.expectedGeneration !== room.roomGeneration) {
        throw new AppError("CONFLICT", "Phòng đã thay đổi phiên bản. Hãy làm mới.", 409, false, "INVALID", {
          reason: "STALE_ROOM_GENERATION",
          expectedGeneration: input.expectedGeneration,
          actualGeneration: room.roomGeneration,
        });
      }
      if (input.expectedVersion !== undefined && input.expectedVersion !== room.roomVersion) {
        throw new AppError("CONFLICT", "Phiên bản phòng không khớp. Hãy tải lại.", 409, false, "INVALID", {
          reason: "STALE_VERSION",
          expectedVersion: input.expectedVersion,
          actualVersion: room.roomVersion,
        });
      }

      const fingerprint = JSON.stringify({ roomId: normalizedRoomId, input });
      if (idempotencyKey) {
        const key = `${actor.userId}:${idempotencyKey}`;
        const previous = this.joinIdempotency.get(key);
        if (previous) {
          if (previous.fingerprint !== fingerprint) throw new AppError("CONFLICT", "Idempotency-Key đã được dùng cho yêu cầu khác.", 409, false, "INVALID");
          const existing = this.rooms.get(previous.roomId);
          if (existing) return this.serialize(existing, actor.userId);
        }
      }
      if (room.members.some((member) => member.userId === actor.userId)) return this.serialize(room, actor.userId);
      if (room.referee?.userId === actor.userId) throw new AppError("CONFLICT", "Trọng tài không thể đồng thời là người chơi.", 409, false, "INVALID", { reason: "PLAYER_REFEREE_CONFLICT" });
      if (room.members.length >= 2) throw new AppError("CONFLICT", "Phòng đã đủ người chơi.", 409, false, "INVALID");
      if (!bypassPassword && room.passwordHash && (!input.password || !(await verifySecret(input.password, room.passwordHash)))) {
        throw new AppError("UNAUTHORIZED", "Mật khẩu phòng không đúng.", 401, false, "INVALID");
      }
      if (room.members.length >= 2) throw new AppError("CONFLICT", "Phòng đã đủ người chơi.", 409, false, "INVALID");

      room.members.push({ ...actor, joinedAt: Date.now(), isHost: false, ready: false });
      room.roomVersion += 1;
      if (room.spectatorIds.delete(actor.userId)) this.revokeSpectatorStreams(normalizedRoomId, actor.userId);
      this.publish();
      if (idempotencyKey) this.joinIdempotency.set(`${actor.userId}:${idempotencyKey}`, { fingerprint, roomId: normalizedRoomId });
      return this.serialize(room, actor.userId);
    });
  }

  private getRoom(roomId: string): RoomState {
    const room = this.rooms.get(roomId.trim().toUpperCase());
    if (!room) throw new AppError("NOT_FOUND", "Phòng đấu không tồn tại.", 404, false, "INVALID");
    return room;
  }

  setReady(actor: RoomActor, roomId: string, ready: boolean): RoomDetail {
    const normalizedRoomId = roomId.trim().toUpperCase();
    const room = this.getRoom(normalizedRoomId);
    const member = room.members.find((m) => m.userId === actor.userId);
    if (!member) throw new AppError("CONFLICT", "Bạn không ở trong phòng này.", 409, false, "INVALID");
    if (room.status !== "WAITING") throw new AppError("CONFLICT", "Phòng đã bắt đầu trận đấu.", 409, false, "INVALID");
    member.ready = ready;
    room.roomVersion += 1;
    this.publish();
    return this.serialize(room, actor.userId);
  }

  canStart(roomId: string): { canStart: boolean; reason?: string } {
    const room = this.getRoom(roomId);
    if (room.status !== "WAITING") return { canStart: false, reason: "NOT_WAITING" };
    if (room.members.length < 2) return { canStart: false, reason: "WAITING_FOR_PLAYERS" };
    if (room.members.some((m) => !m.ready)) return { canStart: false, reason: "PLAYERS_NOT_READY" };
    if (room.refereeEnabled && (!room.referee || !room.referee.connected)) {
      return { canStart: false, reason: "REFEREE_NOT_CONNECTED" };
    }
    return { canStart: true };
  }

  leave(actor: RoomActor, roomId: string): RoomDetail | null {
    const normalizedRoomId = roomId.trim().toUpperCase();
    const room = this.rooms.get(normalizedRoomId);
    if (!room) throw new AppError("NOT_FOUND", "Phòng đấu không tồn tại.", 404, false, "INVALID");
    const index = room.members.findIndex((member) => member.userId === actor.userId);
    if (index === -1) throw new AppError("CONFLICT", "Bạn không ở trong phòng này.", 409, false, "INVALID");
    const wasHost = room.members[index]?.isHost ?? false;
    room.members.splice(index, 1);
    if (room.members.length === 0) {
      this.rooms.delete(normalizedRoomId);
      for (const userId of room.spectatorIds) this.revokeSpectatorStreams(normalizedRoomId, userId);
      this.publish();
      return null;
    }
    if (wasHost) {
      for (const [memberIndex, member] of room.members.entries()) member.isHost = memberIndex === 0;
    }
    room.roomVersion += 1;
    this.publish();
    return this.serialize(room, undefined);
  }

  /** Test/W4 seam: the Room Manager remains the only authority for lifecycle state. */
  markPlaying(roomId: string): void {
    const room = this.rooms.get(roomId.trim().toUpperCase());
    if (!room) throw new AppError("NOT_FOUND", "Phòng đấu không tồn tại.", 404, false, "INVALID");
    room.status = "PLAYING";
    room.roomVersion += 1;
    this.publish();
  }

  size(): number { return this.rooms.size; }

  private generateRoomId(): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      let id = "";
      for (let index = 0; index < 6; index += 1) id += ROOM_ID_ALPHABET[randomInt(ROOM_ID_ALPHABET.length)];
      if (!this.rooms.has(id)) return id;
    }
    throw new AppError("SERVICE_UNAVAILABLE", "Không thể cấp Room ID lúc này.", 503, true, "RECOVERABLE");
  }

  private generateFriendlyName(): string {
    const adjective = FRIENDLY_ADJECTIVES[randomInt(FRIENDLY_ADJECTIVES.length)] ?? "Neon";
    const noun = FRIENDLY_NOUNS[randomInt(FRIENDLY_NOUNS.length)] ?? "Hammer";
    return `${adjective} ${noun} ${randomInt(10, 100)}`;
  }

  private serialize(room: RoomState, viewerId: string | undefined, revealMembers = false): RoomDetail {
    const isMember = viewerId !== undefined && room.members.some((member) => member.userId === viewerId);
    const host = room.members.find((member) => member.isHost);
    const summary: RoomSummary = {
      roomId: room.roomId,
      roomGeneration: room.roomGeneration,
      roomVersion: room.roomVersion,
      name: room.name,
      players: room.members.length,
      playerCapacity: 2,
      waitingPlayerRating: room.members.find((member) => !member.isHost)?.rating ?? null,
      mode: room.mode,
      playMode: room.playMode,
      visibility: room.visibility,
      timerSeconds: room.timerSeconds,
      spectators: room.spectatorIds.size,
      spectatorsEnabled: room.spectatorsEnabled,
      spectatorCapacity: room.spectatorCapacity ?? null,
      refereeEnabled: room.refereeEnabled,
      refereeUserId: room.referee?.userId ?? null,
      refereeConnected: room.referee?.connected ?? false,
      status: room.status,
    };
    const isReferee = viewerId !== undefined && room.referee?.userId === viewerId;
    return {
      ...summary,
      hostUserId: host?.userId ?? null,
      isMember,
      requiresPassword: room.visibility === "PRIVATE" && !isMember && !isReferee,
      role: isReferee ? "REFEREE" : (isMember ? "PLAYER" : "SPECTATOR"),
      isReferee,
      referee: room.referee ? { userId: room.referee.userId, username: room.referee.username, displayName: room.referee.displayName, connected: room.referee.connected } : null,
      members: isMember || isReferee || revealMembers ? room.members.map(({ userId, username, displayName, isHost, ready }) => ({ userId, username, displayName, isHost, ready: ready ?? false })) : [],
      setupDescriptor: (isMember || isReferee) && room.setupContext ? room.setupContext.setupDescriptor : undefined,
    };
  }
}

export { ROOM_ID_ALPHABET };
