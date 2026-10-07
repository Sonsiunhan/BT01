import { describe, expect, it, vi } from "vitest";

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MatchManager, type MatchActor } from "../../src/modules/match/match.manager.js";
import { FileMatchPersistence, InMemoryMatchPersistence } from "../../src/modules/match/match.persistence.js";
import { RoomManager, type RoomActor } from "../../src/modules/room/room.manager.js";

const host: RoomActor & MatchActor = { userId: "match-host", username: "match_host", displayName: "Host" };
const guest: RoomActor & MatchActor = { userId: "match-guest", username: "match_guest", displayName: "Guest" };
const referee: RoomActor & MatchActor = { userId: "match-ref", username: "match_ref", displayName: "Referee", principal: "ACCOUNT" };

async function roomForMatch() {
  const rooms = new RoomManager();
  const created = await rooms.create(host, { name: "W4 match", visibility: "PUBLIC", timerSeconds: 30, spectatorsEnabled: false });
  await rooms.join(guest, created.roomId, {});
  return rooms.search(created.roomId, host.userId);
}

async function refereeRoomForMatch() {
  const rooms = new RoomManager();
  const created = await rooms.create(referee, { name: "R4 referee", visibility: "PRIVATE", password: "secret", timerSeconds: 30, spectatorsEnabled: false, refereeEnabled: true, hostRole: "REFEREE" });
  await rooms.join(host, created.roomId, { password: "secret" });
  await rooms.join(guest, created.roomId, { password: "secret" });
  return rooms.search(created.roomId, referee.userId);
}

describe("W4 MatchManager", () => {
  it("assigns stable sides and starts a countdown exactly after both players ready", async () => {
    let now = 1_000;
    const manager = new MatchManager(() => now);
    const room = await roomForMatch();
    const events: string[] = [];
    manager.subscribe(room.roomId, (event) => events.push(event.type));
    expect(manager.ensure(room).players.map((player) => player.side)).toEqual(["BLUE", "RED"]);
    manager.ready(room, host, true);
    const countdown = manager.ready(room, guest, true);
    expect(countdown.status).toBe("COUNTDOWN");
    expect(events).toContain("COUNTDOWN_STARTED");
    now += 3_001;
    expect(manager.tick(room).status).toBe("PLAYING");
    expect(events).toContain("MATCH_STARTED");
  });

  it("starts countdown early only after both players fast-ready", async () => {
    const manager = new MatchManager(() => 2_000);
    const room = await roomForMatch();
    manager.ready(room, host, true);
    manager.ready(room, guest, true);
    expect(manager.fastReady(room, host).status).toBe("COUNTDOWN");
    expect(manager.fastReady(room, guest).status).toBe("PLAYING");
  });
  it("commits only authoritative moves and rejects stale state versions", async () => {
    let now = 2_000;
    const manager = new MatchManager(() => now);
    const room = await roomForMatch();
    manager.ready(room, host, true);
    manager.ready(room, guest, true);
    now += 3_001;
    const started = manager.tick(room);
    await expect(Promise.resolve().then(() => manager.move(room, host, "b1", "b2", started.stateVersion - 1))).rejects.toMatchObject({ code: "CONFLICT" });
    const moved = manager.move(room, host, "b1", "b2", started.stateVersion);
    expect(moved.board.b1).toBeNull();
    expect(moved.board.b2).toMatchObject({ side: "BLUE", type: "R" });
    expect(moved.currentTurn).toBe("RED");
  });

  it("finishes on surrender and resets only after both rematch requests", async () => {
    let now = 3_000;
    const manager = new MatchManager(() => now);
    const room = await roomForMatch();
    manager.ready(room, host, true);
    manager.ready(room, guest, true);
    now += 3_001;
    const started = manager.tick(room);
    const finished = manager.surrender(room, host, started.stateVersion);
    expect(finished.status).toBe("FINISHED");
    expect(finished.winner).toBe("RED");
    expect(finished.resultReason).toBe("SURRENDER");
    const waiting = manager.rematch(room, host, finished.stateVersion);
    expect(waiting.status).toBe("FINISHED");
    const rematch = manager.rematch(room, guest, waiting.stateVersion);
    expect(rematch.status).toBe("WAITING_READY");
    expect(rematch.winner).toBeNull();
    expect(rematch.players.every((player) => !player.ready)).toBe(true);
    expect(rematch.matchId).not.toBe(finished.matchId);
    expect(rematch.mode).toBe("UNRANKED");
    expect(rematch.players.find((player) => player.userId === host.userId)?.side).toBe("RED");
    expect(rematch.players.find((player) => player.userId === guest.userId)?.side).toBe("BLUE");
  });

  it("keeps an authoritative rematch request rejectable without resetting the board", async () => {
    let now = 3_500;
    const manager = new MatchManager(() => now);
    const room = await roomForMatch();
    manager.ready(room, host, true);
    manager.ready(room, guest, true);
    now += 3_001;
    const started = manager.tick(room);
    const finished = manager.surrender(room, host, started.stateVersion);
    const requested = manager.rematch(room, host, finished.stateVersion);
    expect(requested.rematchRequestedBy).toBe("BLUE");
    const rejected = manager.rejectRematch(room, guest, requested.stateVersion);
    expect(rejected.status).toBe("FINISHED");
    expect(rejected.rematchRequestedBy).toBeNull();
    expect(rejected.matchId).toBe(finished.matchId);
  });

  it("clears referee pause and replacement state when a rematch starts", async () => {
    let now = 6_000;
    const manager = new MatchManager(() => now);
    const room = await refereeRoomForMatch();
    manager.refereeConnected(room, referee);
    manager.ready(room, host, true);
    manager.ready(room, guest, true);
    manager.start(room, referee);
    now += 3_001;
    manager.tick(room);
    const paused = manager.stopByReferee(room, referee, "TECHNICAL_ISSUE");
    expect(paused.status).toBe("PAUSED");
    now += 2_000;
    manager.resumeByReferee(room, referee);
    now += 3_001;
    const resumed = manager.tick(room);
    expect(resumed.status).toBe("PLAYING");
    const finished = manager.surrender(room, host, resumed.stateVersion);
    const requested = manager.rematch(room, host, finished.stateVersion);
    const rematch = manager.rematch(room, guest, requested.stateVersion);
    expect(rematch.status).toBe("WAITING_READY");
    expect(rematch.pauseElapsedMs).toBe(0);
    expect(rematch.pauseReason).toBeNull();
    expect(rematch.pauseCategory).toBeNull();
    expect(rematch.pausedAt).toBeNull();
    expect(rematch.resumeEndsAt).toBeNull();
    expect(rematch.replacementStatus).toBe("IDLE");
  });

  it("emits disconnect/resync events and preserves the match during the grace window", async () => {
    let now = 4_000;
    const manager = new MatchManager(() => now, 100);
    const room = await roomForMatch();
    const events: string[] = [];
    manager.subscribe(room.roomId, (event) => events.push(event.type));
    manager.ready(room, host, true);
    manager.ready(room, guest, true);
    now += 3_001;
    manager.tick(room);
    manager.connect(room, host.userId, "tab-a");
    manager.connect(room, guest.userId, "tab-b");
    manager.disconnect(room, host.userId, "tab-a");
    expect(manager.ensure(room).players.find((player) => player.userId === host.userId)?.connected).toBe(false);
    expect(events).toContain("PLAYER_DISCONNECTED");
    manager.connect(room, host.userId, "tab-a");
    expect(manager.ensure(room).players.find((player) => player.userId === host.userId)?.connected).toBe(true);
    expect(events).toContain("PLAYER_RECONNECTED");
    expect(events).toContain("STATE_RESYNC");
    vi.useFakeTimers();
    manager.disconnect(room, host.userId, "tab-a");
    vi.advanceTimersByTime(99);
    expect(manager.ensure(room).status).toBe("PLAYING");
    manager.connect(room, host.userId, "tab-a");
    expect(manager.ensure(room).status).toBe("PLAYING");
    vi.useRealTimers();
  });

  it("forfeits the missing player after the disconnect grace window", async () => {
    vi.useFakeTimers();
    try {
      let now = 5_000;
      const manager = new MatchManager(() => now, 30);
      const room = await roomForMatch();
      const events: string[] = [];
      manager.subscribe(room.roomId, (event) => events.push(event.type));
      manager.ready(room, host, true);
      manager.ready(room, guest, true);
      now += 3_001;
      manager.tick(room);
      manager.connect(room, host.userId, "tab-a");
    manager.connect(room, guest.userId, "tab-b");
    manager.disconnect(room, host.userId, "tab-a");
    vi.advanceTimersByTime(31);
      const aborted = manager.ensure(room);
      expect(aborted.status).toBe("FINISHED");
      expect(aborted.winner).toBe("RED");
      expect(aborted.resultReason).toBe("DISCONNECT_TIMEOUT");
      expect(events).toContain("MATCH_FINISHED");
    } finally {
      vi.useRealTimers();
    }
  });

  it("freezes gameplay clocks during a single-player disconnect grace and forfeits the missing side", async () => {
    vi.useFakeTimers();
    try {
    let now = 5_500;
    const manager = new MatchManager(() => now, 30);
    const room = await roomForMatch();
    manager.ready(room, host, true);
    manager.ready(room, guest, true);
    now += 3_001;
    const started = manager.tick(room);
    manager.connect(room, host.userId, "tab-a");
    manager.connect(room, guest.userId, "tab-b");
    manager.disconnect(room, host.userId, "tab-a");
    now += 10_000;
    const duringGrace = manager.tick(room);
    expect(duringGrace.status).toBe("PLAYING");
    expect(duringGrace.clocksMs.BLUE).toBe(started.clocksMs.BLUE);
    expect(duringGrace.clocksMs.RED).toBe(started.clocksMs.RED);
    vi.advanceTimersByTime(31);
    const forfeited = manager.ensure(room);
    expect(forfeited.status).toBe("FINISHED");
    expect(forfeited.winner).toBe("RED");
    expect(forfeited.resultReason).toBe("DISCONNECT_TIMEOUT");
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts neutrally only when both players expire their independent disconnect grace", async () => {
    vi.useFakeTimers();
    try {
      let now = 6_500;
      const manager = new MatchManager(() => now, 30);
      const room = await roomForMatch();
      manager.ready(room, host, true);
      manager.ready(room, guest, true);
      now += 3_001;
      manager.tick(room);
      manager.connect(room, host.userId, "tab-a");
      manager.connect(room, guest.userId, "tab-b");
      manager.disconnect(room, host.userId, "tab-a");
      vi.advanceTimersByTime(10);
      manager.disconnect(room, guest.userId, "tab-b");
      vi.advanceTimersByTime(21);
      expect(manager.ensure(room).status).toBe("PLAYING");
      expect(manager.ensure(room).winner).toBeNull();
      vi.advanceTimersByTime(10);
      const aborted = manager.ensure(room);
      expect(aborted.status).toBe("ABORTED");
      expect(aborted.winner).toBeNull();
      expect(aborted.resultReason).toBe("DISCONNECT_TIMEOUT");
    } finally {
      vi.useRealTimers();
    }
  });

  it("enforces one active game lock per account and client", async () => {
    const manager = new MatchManager(() => 6_000);
    const room = await roomForMatch();
    manager.acquireActiveLock(room, host.userId, "tab-a");
    expect(() => manager.acquireActiveLock(room, host.userId, "tab-a")).not.toThrow();
    expect(() => manager.acquireActiveLock(room, host.userId, "tab-b")).toThrowError(expect.objectContaining({
      code: "CONFLICT",
      details: expect.objectContaining({ reason: "ACTIVE_GAME_LOCK" }),
    }));
  });

  it("fans out committed snapshots to spectator listeners without granting commands", async () => {
    const manager = new MatchManager(() => 7_000);
    const room = await roomForMatch();
    const received: string[] = [];
    const unsubs = Array.from({ length: 10 }, () => manager.subscribeSpectator(room.roomId, (event) => received.push(event.type)));
    manager.ensure(room);
    manager.ready(room, host, true);
    manager.ready(room, guest, true);
    expect(received).toContain("PLAYER_READY");
    expect(manager.spectatorListenerCount(room.roomId)).toBe(10);
    unsubs.forEach((unsubscribe) => unsubscribe());
    expect(manager.spectatorListenerCount(room.roomId)).toBe(0);
  });

  it("keeps 1/10/50/100 listener fan-out within the local harness budget", async () => {
    const manager = new MatchManager(() => 8_000);
    const room = await roomForMatch();
    for (const count of [1, 10, 50, 100]) {
      const received = { value: 0 };
      const unsubs = Array.from({ length: count }, () => manager.subscribeSpectator(room.roomId, () => { received.value += 1; }));
      const started = performance.now();
      manager.ready(room, host, true);
      const elapsed = performance.now() - started;
      expect(received.value).toBeGreaterThanOrEqual(count);
      expect(elapsed).toBeLessThan(100);
      unsubs.forEach((unsubscribe) => unsubscribe());
    }
  });

  it("requires the appointed referee to start, freezes clocks on Stop, and resumes through a server countdown", async () => {
    let now = 9_000;
    const manager = new MatchManager(() => now);
    const room = await refereeRoomForMatch();
    manager.ensure(room);
    manager.ready(room, host, true);
    const waiting = manager.ready(room, guest, true);
    expect(waiting.status).toBe("WAITING_READY");
    expect(() => manager.fastReady(room, host)).toThrowError(expect.objectContaining({ details: { reason: "REFEREE_START_REQUIRED" } }));
    manager.refereeConnected(room, referee);
    const countdown = manager.start(room, referee);
    expect(countdown.status).toBe("COUNTDOWN");
    now += 3_001;
    const started = manager.tick(room);
    expect(started.status).toBe("PLAYING");
    now += 100;
    const paused = manager.stopByReferee(room, referee);
    expect(paused.status).toBe("PAUSED");
    const clockAtPause = paused.clocksMs.BLUE;
    now += 10_000;
    expect(manager.tick(room).clocksMs.BLUE).toBe(clockAtPause);
    const resuming = manager.resumeByReferee(room, referee);
    expect(resuming.status).toBe("RESUMING");
    now += 3_001;
    expect(manager.tick(room).status).toBe("PLAYING");
    expect(manager.ensure(room).clocksMs.BLUE).toBe(clockAtPause);
  });

  it("keeps player disconnect grace independent while a referee pause is active", async () => {
    vi.useFakeTimers();
    try {
      let now = 12_000;
      const manager = new MatchManager(() => now, 30);
      const room = await refereeRoomForMatch();
      manager.ensure(room);
      manager.ready(room, host, true);
      manager.ready(room, guest, true);
      manager.refereeConnected(room, referee);
      manager.start(room, referee);
      now += 3_001;
      manager.tick(room);
      manager.connect(room, host.userId, "tab-a");
      manager.connect(room, guest.userId, "tab-b");
      now += 10;
      expect(manager.stopByReferee(room, referee).status).toBe("PAUSED");
      manager.disconnect(room, host.userId, "tab-a");
      now += 20_000;
      expect(manager.tick(room).status).toBe("PAUSED");
      vi.advanceTimersByTime(31);
      const forfeited = manager.ensure(room);
      expect(forfeited.status).toBe("FINISHED");
      expect(forfeited.winner).toBe("RED");
      expect(forfeited.resultReason).toBe("DISCONNECT_TIMEOUT");
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts neutrally when the referee pause exceeds its continuous allowance", async () => {
    vi.useFakeTimers();
    try {
      let now = 13_000;
      const manager = new MatchManager(() => now);
      const room = await refereeRoomForMatch();
      manager.ensure(room);
      manager.ready(room, host, true);
      manager.ready(room, guest, true);
      manager.refereeConnected(room, referee);
      manager.start(room, referee);
      now += 3_001;
      manager.tick(room);
      expect(manager.stopByReferee(room, referee).status).toBe("PAUSED");
      now += 10 * 60_000 + 1;
      const aborted = manager.ensure(room);
      expect(aborted.status).toBe("ABORTED");
      expect(aborted.winner).toBeNull();
      expect(aborted.resultReason).toBe("SERVER_INTERRUPTION");
    } finally {
      vi.useRealTimers();
    }
  });

  it("writes a checkpoint and accepted move replay that a new manager can restore", async () => {
    let now = 10_000;
    const persistence = new InMemoryMatchPersistence();
    const room = await roomForMatch();
    const first = new MatchManager(() => now, 30_000, persistence);
    first.ready(room, host, true);
    first.ready(room, guest, true);
    now += 3_001;
    const started = first.tick(room);
    const moved = first.move(room, host, "b1", "b2", started.stateVersion);
    expect(persistence.load(room.roomId)?.moves).toHaveLength(1);
    const second = new MatchManager(() => now, 30_000, persistence);
    const restored = second.ensure(room);
    expect(restored.matchId).toBe(moved.matchId);
    expect(restored.stateVersion).toBe(moved.stateVersion);
    expect(restored.board.b2).toMatchObject({ side: "BLUE", type: "R" });
    expect(restored.currentTurn).toBe("RED");
  });

  it("atomically persists checkpoint and event across manager restart with sequence fencing", async () => {
    const directory = mkdtempSync(join(tmpdir(), "ott-r4-persistence-"));
    try {
      let now = 10_500;
      const firstPersistence = new FileMatchPersistence(directory);
      const first = new MatchManager(() => now, 30_000, firstPersistence);
      const room = await roomForMatch();
      first.ready(room, host, true);
      first.ready(room, guest, true);
      now += 3_001;
      const started = first.tick(room);
      const moved = first.move(room, host, "b1", "b2", started.stateVersion);
      const checkpoint = firstPersistence.load(room.roomId);
      const events = firstPersistence.eventsFor(room.roomId);
      expect(checkpoint?.matchId).toBe(moved.matchId);
      expect(checkpoint?.sequence).toBe(moved.sequence);
      expect(events.at(-1)?.sequence).toBe(checkpoint?.sequence);
      expect(events.at(-1)?.type).toBe("PIECE_MOVE_ACCEPTED");

      const secondPersistence = new FileMatchPersistence(directory);
      const second = new MatchManager(() => now, 30_000, secondPersistence);
      const restored = second.ensure(room);
      expect(restored.matchId).toBe(moved.matchId);
      expect(restored.sequence).toBe(moved.sequence);
      expect(restored.board.b2).toMatchObject({ side: "BLUE", type: "R" });
      expect(() => secondPersistence.saveCheckpoint({ ...checkpoint!, sequence: checkpoint!.sequence - 1 })).toThrow(/stale checkpoint/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("keeps one scheduler per match even when multiple SSE clients subscribe", async () => {
    vi.useFakeTimers();
    try {
      const room = await roomForMatch();
      const manager = new MatchManager(() => 11_000);
      let ticks = 0;
      manager.startScheduler(room, () => { ticks += 1; });
      manager.startScheduler(room, () => { ticks += 100; });
      vi.advanceTimersByTime(1_000);
      expect(ticks).toBe(101);
      manager.stopScheduler(room.roomId);
    } finally {
      vi.useRealTimers();
    }
  });
});
