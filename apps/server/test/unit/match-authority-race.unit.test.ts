import { describe, expect, it, vi } from "vitest";

import { RoomManager, type RoomActor } from "../../src/modules/room/room.manager.js";
import { MatchManager, type MatchActor } from "../../src/modules/match/match.manager.js";

const host: RoomActor & MatchActor = { userId: "user-host", username: "host_user", displayName: "Host", principal: "ACCOUNT" };
const guest: RoomActor & MatchActor = { userId: "user-guest", username: "guest_user", displayName: "Guest", principal: "ACCOUNT" };
const referee: RoomActor & MatchActor = { userId: "user-ref", username: "ref_user", displayName: "Referee", principal: "ACCOUNT" };

async function createStandardMatch(manager: MatchManager, startNow = 1_000) {
  const rooms = new RoomManager();
  const created = await rooms.create(host, {
    name: "Race Test Room",
    visibility: "PUBLIC",
    timerSeconds: 30,
    spectatorsEnabled: false,
  });
  await rooms.join(guest, created.roomId, {});
  const room = rooms.search(created.roomId, host.userId);

  manager.ready(room, host, true);
  manager.ready(room, guest, true);
  manager.fastReady(room, host);
  manager.fastReady(room, guest);

  const snapshot = manager.ensure(room);
  expect(snapshot.status).toBe("PLAYING");
  expect(snapshot.ruleState?.currentTurn ?? snapshot.currentTurn).toBe("BLUE");
  return { rooms, room, snapshot };
}

async function createRefereeMatch(manager: MatchManager, startNow = 1_000) {
  const rooms = new RoomManager();
  const created = await rooms.create(referee, {
    name: "Ref Race Room",
    visibility: "PRIVATE",
    password: "secret",
    timerSeconds: 30,
    spectatorsEnabled: false,
    refereeEnabled: true,
    hostRole: "REFEREE",
  });
  await rooms.join(host, created.roomId, { password: "secret" });
  await rooms.join(guest, created.roomId, { password: "secret" });
  const room = rooms.search(created.roomId, referee.userId);

  manager.refereeConnected(room, referee);
  manager.ready(room, host, true);
  manager.ready(room, guest, true);
  manager.start(room, referee);

  return { rooms, room };
}

async function createBotMatch(manager: MatchManager) {
  const rooms = new RoomManager();
  const created = await rooms.create(host, {
    name: "Bot Race Room",
    visibility: "PUBLIC",
    timerSeconds: 30,
    spectatorsEnabled: false,
    playMode: "BOT",
  });
  await rooms.join(guest, created.roomId, {});
  const room = rooms.search(created.roomId, host.userId);

  manager.ready(room, host, true);
  manager.ready(room, guest, true);
  manager.fastReady(room, host);
  manager.fastReady(room, guest);

  const snapshot = manager.ensure(room);
  expect(snapshot.status).toBe("PLAYING");
  expect(snapshot.playMode).toBe("BOT");
  return { rooms, room, snapshot };
}

describe("L05-W1 Race Harness — Match Authority, Serialized Lane & Clocks (FRS-L05 §6 L-04.02, .04, .06, .08)", () => {
  describe("Race 1: L-04.02 [CONCURRENT-MOVES-IDEMPOTENCY]", () => {
    it("L-04.02 [LANE-QUEUE]: authority provides per-match serialized lane queue (dispatchCommand) rather than uncoordinated in-place mutations", async () => {
      let now = 10_000;
      const manager = new MatchManager(() => now);
      const { room } = await createStandardMatch(manager, now);

      // TARGET INVARIANT (FRS-L05 §2 & §6 L-04.02):
      // Authority must provide a serialized per-match lane (dispatchCommand)
      // which queues commands, stages next state, and verifies preconditions sequentially.
      expect(typeof (manager as any).dispatchCommand).toBe("function");
    });

    it("L-04.02 [IDEMPOTENT-RETRY]: retrying an already committed move with same commandId/version returns original ACK rather than throwing 409 STALE_STATE", async () => {
      let now = 10_000;
      const manager = new MatchManager(() => now);
      const { room, snapshot } = await createStandardMatch(manager, now);

      const targetVersion = snapshot.stateVersion;
      // Host (BLUE) makes a valid move from b1 to b2
      const firstResult = manager.move(room, host, "b1", "b2", targetVersion);
      expect(firstResult.stateVersion).toBe(targetVersion + 1);
      expect(firstResult.currentTurn).toBe("RED");

      // TARGET INVARIANT (FRS-L05 §2 line 36 & §6 L-04.02):
      // Network retry of the same command (same commandId/payload or same targetVersion retry)
      // must hit the Command Ledger fast-path and return the previously committed ACK.
      // Current legacy behavior throws AppError 409 CONFLICT: STALE_STATE ("Trạng thái bàn cờ đã thay đổi, hãy đồng bộ lại.").
      const retryResult = (manager as any).move(room, host, "b1", "b2", targetVersion, "cmd-move-1");
      expect(retryResult.stateVersion).toBe(firstResult.stateVersion);
      expect(retryResult.sequence).toBe(firstResult.sequence);
    });
  });

  describe("Race 2: L-04.02 / L-04.07 [MOVE-VS-REFEREE-STOP]", () => {
    it("L-04.02/07 [BARRIER-STOP]: referee Stop acts as immediate barrier, freezing clocks and blocking in-flight move mutation", async () => {
      let now = 20_000;
      const manager = new MatchManager(() => now);
      const { room } = await createRefereeMatch(manager, now);

      // Advance into PLAYING
      now += 3_001;
      manager.tick(room);
      const playing = manager.ensure(room);
      expect(playing.status).toBe("PLAYING");

      // Referee initiates Stop
      const stopped = manager.stopByReferee(room, referee, "TECHNICAL_ISSUE");
      expect(stopped.status).toBe("PAUSED");
      expect(stopped.pauseReason).toBe("REFEREE");

      // An in-flight move arriving with target version of before-stop must be rejected
      // without mutating the board or changing sequence
      await expect(
        Promise.resolve().then(() => manager.move(room, host, "b1", "b2", playing.stateVersion))
      ).rejects.toMatchObject({
        code: "CONFLICT",
      });

      const pausedSnap = manager.ensure(room);
      expect(pausedSnap.status).toBe("PAUSED");
      expect(pausedSnap.board.b1).not.toBeNull();
      expect(pausedSnap.clocksMs.BLUE).toBe(30_000);
    });

    it("L-04.07 [RESUME-INTERRUPT]: subsequent Stop during RESUMING countdown cancels resume immediately without advancing gameplay", async () => {
      let now = 25_000;
      const manager = new MatchManager(() => now);
      const { room } = await createRefereeMatch(manager, now);

      now += 3_001;
      manager.tick(room);
      manager.stopByReferee(room, referee, "TECHNICAL_ISSUE");

      // Referee issues Resume -> enters RESUMING with 3s countdown
      manager.resumeByReferee(room, referee);
      expect(manager.ensure(room).status).toBe("RESUMING");

      // Before 3s expires, referee stops again
      now += 1_000;
      const reStopped = manager.stopByReferee(room, referee, "TECHNICAL_ISSUE");
      expect(reStopped.status).toBe("PAUSED");
      expect(reStopped.resumeEndsAt).toBeNull();

      // Advancing past original resume deadline must not transition to PLAYING
      now += 3_000;
      manager.tick(room);
      expect(manager.ensure(room).status).toBe("PAUSED");
    });
  });

  describe("Race 3: L-04.04 [TIMEOUT-VS-SURRENDER]", () => {
    it("L-04.04 [TIMEOUT-PRECEDENCE]: turn deadline expiration takes strict precedence over late surrender", async () => {
      let now = 30_000;
      const manager = new MatchManager(() => now);
      const { room, snapshot } = await createStandardMatch(manager, now);

      // BLUE's turn starts at t=30_000 with 30s clock (expires at t=60_000).
      // Advance wall-clock time past expiration: t=61_500 (now expired by 1.5s).
      now = 61_500;

      // TARGET INVARIANT (FRS-L05 §3 line 58 & §6 L-04.04):
      // "Timeout đã hợp lệ trước command không được hồi sinh bởi timestamp client. Terminal: Một transition cuối".
      // When opponent RED calls surrender or BLUE calls surrender after deadline has elapsed,
      // the match must authoritatively finish with resultReason: "TIMEOUT" and winner: "RED" (BLUE lost on time),
      // and NOT recorded as a SURRENDER!
      // In current legacy code: Calling surrender() throws AppError 409 CONFLICT: INVALID_MATCH_STATE
      // because advance() finished the match during surrender's preamble and surrender rejected status != PLAYING.
      const finished = manager.surrender(room, host, snapshot.stateVersion);
      expect(finished.status).toBe("FINISHED");
      expect(finished.winner).toBe("RED");
      expect(finished.resultReason).toBe("TIMEOUT");
    });
  });

  describe("Race 4: L-04.04 [ZERO-SUBSCRIBER-CLOCK-PROGRESS]", () => {
    it("L-04.04 [ZERO-SUBSCRIBER-SCHEDULER]: clock advances and deadline triggers in background with zero SSE subscribers", async () => {
      vi.useFakeTimers();
      try {
        let now = 50_000;
        const manager = new MatchManager(() => now);
        const { room } = await createStandardMatch(manager, now);

        const events: string[] = [];
        manager.subscribe(room.roomId, (e) => events.push(e.type));

        // ZERO SSE clients connect to this room (startScheduler is never called!)
        // In FRS-L05 §3 line 47:
        // "Deadline scheduler: Độc lập subscriber; xử deadline gần nhất theo batch hữu hạn; recheck khi xử command, không dựa vào tick UI."
        // "L-04.04: Zero subscribers, background tab, delayed tick và queue wait vẫn đúng deadline".

        // Advance wall-clock and fake timers by 35 seconds (exceeding 30s turn timer)
        now += 35_000;
        vi.advanceTimersByTime(35_000);

        // TARGET INVARIANT:
        // Without any SSE subscriber, an independent deadline scheduler must be registered
        // and must automatically emit MATCH_FINISHED when deadline passes in the background.
        // Current legacy defect: No background timer exists (schedulerTimers has 0 timers).
        // Without external subscribers, no events are emitted and the room stalls in memory!
        const timerActive = ((manager as any).schedulerTimers?.has(room.roomId) ?? false) || ((manager as any).deadlineScheduler?.has(room.roomId) ?? false);
        expect(timerActive).toBe(true);
        expect(events).toContain("MATCH_FINISHED");
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("Race 5: L-04.06 [STAGGERED-DISCONNECT-GRACE]", () => {
    it("L-04.06 [STAGGERED-DISCONNECT-RECONNECT]: when first player grace expires while second is in grace, second player reconnect wins", async () => {
      vi.useFakeTimers();
      try {
        let now = 70_000;
        const manager = new MatchManager(() => now, 30_000);
        const { room } = await createStandardMatch(manager, now);

        // Connect both players initially
        manager.connect(room, host.userId, "tab-host");
        manager.connect(room, guest.userId, "tab-guest");

        // t=70_000: Player A (Host, BLUE) disconnects (grace ends at t=100_000)
        manager.disconnect(room, host.userId, "tab-host");

        // t=85_000: Player B (Guest, RED) disconnects (grace ends at t=115_000)
        now += 15_000;
        vi.advanceTimersByTime(15_000);
        manager.disconnect(room, guest.userId, "tab-guest");

        // t=100_000: Player A's grace expires (30s elapsed for A).
        // Player B still has 15s of grace remaining (until t=115_000).
        now += 15_000;
        vi.advanceTimersByTime(15_000);

        // At t=105_000: Player B reconnects!
        now += 5_000;
        vi.advanceTimersByTime(5_000);
        manager.connect(room, guest.userId, "tab-guest-new");

        // TARGET INVARIANT (FRS-L05 §3 lines 53-54 & §6 L-04.06):
        // "Khi bên đầu hết grace mà bên kia vẫn vắng trong grace: chờ bounded deadline còn lại. Bên kia kịp về -> bên quá hạn thua".
        // Player B reconnected in time -> Player B (RED) wins by DISCONNECT_TIMEOUT.
        const finished = manager.ensure(room);
        expect(finished.status).toBe("FINISHED");
        expect(finished.winner).toBe("RED");
        expect(finished.resultReason).toBe("DISCONNECT_TIMEOUT");
      } finally {
        vi.useRealTimers();
      }
    });

    it("L-04.06 [STAGGERED-DISCONNECT-BOTH-EXPIRED]: when both players expire their staggered grace, match neutral aborts", async () => {
      vi.useFakeTimers();
      try {
        let now = 120_000;
        const manager = new MatchManager(() => now, 30_000);
        const { room } = await createStandardMatch(manager, now);

        manager.connect(room, host.userId, "tab-host");
        manager.connect(room, guest.userId, "tab-guest");

        // t=120_000: Player A disconnects (deadline t=150_000)
        manager.disconnect(room, host.userId, "tab-host");

        // t=135_000: Player B disconnects (deadline t=165_000)
        now += 15_000;
        vi.advanceTimersByTime(15_000);
        manager.disconnect(room, guest.userId, "tab-guest");

        // Advance to t=165_000 (both grace periods have expired, neither returned)
        now += 30_000;
        vi.advanceTimersByTime(30_000);

        // TARGET INVARIANT (FRS-L05 §3 lines 53-54 & §6 L-04.06):
        // Both players expired -> neutral abort (ABORTED, winner: null, resultReason: "DISCONNECT_TIMEOUT").
        const aborted = manager.ensure(room);
        expect(aborted.status).toBe("ABORTED");
        expect(aborted.winner).toBeNull();
        expect(aborted.resultReason).toBe("DISCONNECT_TIMEOUT");
      } finally {
        vi.useRealTimers();
      }
    });

    it("L-04.06 [STAGGERED-DISCONNECT-QUEUE]: authority manages disconnect deadlines via unified deadline scheduler rather than ad-hoc timeout maps", async () => {
      const manager = new MatchManager();
      // TARGET INVARIANT (FRS-L05 §3 & §6 L-04.06):
      // Disconnect deadlines must be registered with the unified deadline scheduler
      // rather than ad-hoc uncoordinated NodeJS.Timeout maps.
      expect(typeof (manager as any).deadlineScheduler).toBe("object");
    });
  });

  describe("Race 6: L-04.08 [LATE-BOT-OUTPUT-EPOCH-FENCING]", () => {
    it("L-04.08 [EPOCH-FENCE-TURN]: late Bot output from a previous turn/epoch must be rejected after turn advances", async () => {
      let now = 200_000;
      const manager = new MatchManager(() => now);
      const { room, snapshot } = await createBotMatch(manager);

      const turn0Version = snapshot.stateVersion;

      // TARGET INVARIANT (FRS-L05 §2 line 40 & §6 L-04.08):
      // finishBotLimit / finishBotFault must validate epoch, invocationId, and stateVersion.
      // Currently, finishBotLimit ignores stateVersion, epoch, and invocationId entirely!
      // When Turn 0 advances to Turn 1:
      const moved = manager.move(room, host, "b1", "b2", turn0Version);
      expect(moved.stateVersion).toBe(turn0Version + 1);

      // Now late Bot output arrives claiming to finish the match based on turn 0 calculation:
      // It must be rejected with 409 CONFLICT (stale epoch/version) or fenced.
      // Current legacy behavior: finishBotLimit does NOT validate stateVersion, so it erroneously terminates the match!
      expect(() => {
        (manager as any).finishBotLimit(
          room,
          "BLUE",
          { BLUE: { N: 1, P: 1, M: 1 }, RED: { N: 0, P: 0, M: 0 }, reason: "CRITERIA", trigger: "TURN_LIMIT" },
          turn0Version // expected target version/epoch parameter
        );
      }).toThrow();

      // State version must remain at turn 1 and not prematurely terminated by stale turn 0 output
      expect(manager.ensure(room).stateVersion).toBe(turn0Version + 1);
    });

    it("L-04.08 [EPOCH-FENCE-REMATCH]: late Bot output from an earlier match must not terminate or mutate a rematched game", async () => {
      let now = 250_000;
      const manager = new MatchManager(() => now);
      const { room, snapshot } = await createBotMatch(manager);

      const oldMatchId = snapshot.matchId;

      // Finish first match via surrender and start rematch
      const surrendered = manager.surrender(room, host, snapshot.stateVersion);
      expect(surrendered.status).toBe("FINISHED");

      manager.rematch(room, host, surrendered.stateVersion);
      const rematched = manager.rematch(room, guest, surrendered.stateVersion);
      expect(rematched.status).toBe("WAITING_READY");
      expect(rematched.matchId).not.toBe(oldMatchId);

      // Ready up for the new match
      manager.ready(room, host, true);
      manager.ready(room, guest, true);
      manager.fastReady(room, host);
      manager.fastReady(room, guest);
      const newMatchSnap = manager.ensure(room);
      expect(newMatchSnap.status).toBe("PLAYING");

      // Late Bot output arrives with the oldMatchId
      // TARGET INVARIANT: Must validate matchId, rejecting stale output from previous match.
      // Current legacy behavior: finishBotLimit only checks roomId and status === "PLAYING",
      // so it will terminate the brand new rematched game!
      expect(() => {
        (manager as any).finishBotLimit(
          room,
          "BLUE",
          { BLUE: { N: 1, P: 1, M: 1 }, RED: { N: 0, P: 0, M: 0 }, reason: "CRITERIA", trigger: "TURN_LIMIT" },
          undefined,
          oldMatchId // stale matchId
        );
      }).toThrow();

      expect(manager.ensure(room).status).toBe("PLAYING");
      expect(manager.ensure(room).matchId).toBe(newMatchSnap.matchId);
    });
  });
});
