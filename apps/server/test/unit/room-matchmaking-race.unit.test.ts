import { describe, expect, it } from "vitest";

import { RoomManager, type RoomActor } from "../../src/modules/room/room.manager.js";
import { MatchmakingManager } from "../../src/modules/matchmaking/matchmaking.manager.js";
import { MatchManager } from "../../src/modules/match/match.manager.js";

const host: RoomActor = { userId: "u-host", username: "host_user", displayName: "Host", principal: "ACCOUNT" };
const playerB: RoomActor = { userId: "u-player-b", username: "player_b", displayName: "Player B", principal: "ACCOUNT" };
const playerC: RoomActor = { userId: "u-player-c", username: "player_c", displayName: "Player C", principal: "ACCOUNT" };
const playerD: RoomActor = { userId: "u-player-d", username: "player_d", displayName: "Player D", principal: "ACCOUNT" };

describe("L03-W1 Race Harness - ROOM-01, ROOM-05, ROOM-06, ROOM-07", () => {
  describe("ROOM-01: Room Creation & Concurrent Join Races", () => {
    it("ROOM-01 [RACE-OVERFILL]: concurrent join on a single remaining slot must admit exactly one player and reject others with 409 CONFLICT without overfilling room", async () => {
      const roomManager = new RoomManager();
      // Host creates a room with password (forcing async hash/verify boundary)
      const room = await roomManager.create(
        host,
        {
          name: "Race Test Room",
          visibility: "PRIVATE",
          password: "secure-password",
          timerSeconds: 300,
          spectatorsEnabled: false,
        },
        "create-key-1"
      );

      expect(roomManager.search(room.roomId, host.userId).members).toHaveLength(1);

      // 3 players simultaneously attempt to join the only remaining slot (capacity = 2)
      const results = await Promise.allSettled([
        roomManager.join(playerB, room.roomId, { password: "secure-password" }, "join-key-b"),
        roomManager.join(playerC, room.roomId, { password: "secure-password" }, "join-key-c"),
        roomManager.join(playerD, room.roomId, { password: "secure-password" }, "join-key-d"),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // TARGET PROTOCOL 0.2 INVARIANT:
      // Exactly 1 player succeeds into the open slot.
      // The other 2 concurrent joins must fail with 409 CONFLICT (room full / slot occupied).
      // Room members count must remain strictly 2.
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(2);
      expect(roomManager.search(room.roomId, host.userId).members).toHaveLength(2);
    });

    it("ROOM-01 [VERSION-STALE]: room creation assigns roomGeneration/roomVersion and rejects join with stale generation/version", async () => {
      const roomManager = new RoomManager();
      const created = await roomManager.create(
        host,
        {
          name: "Versioned Room",
          visibility: "PUBLIC",
          timerSeconds: 300,
          spectatorsEnabled: false,
        },
        "create-key-ver"
      );

      // TARGET PROTOCOL 0.2 INVARIANT:
      // Room must expose a unique roomGeneration (UUID) and monotonic roomVersion (integer >= 1).
      expect((created as any).roomGeneration).toBeDefined();
      expect(typeof (created as any).roomGeneration).toBe("string");
      expect((created as any).roomVersion).toBeGreaterThanOrEqual(1);

      // Joining with a stale roomGeneration or stale version must be rejected with 409 STALE_VERSION / CONFLICT
      await expect(
        (roomManager as any).join(
          playerB,
          created.roomId,
          { expectedGeneration: "00000000-0000-0000-0000-000000000000", expectedVersion: 999 }
        )
      ).rejects.toMatchObject({
        code: "CONFLICT",
      });
    });
  });

  describe("ROOM-05: Matchmaking Reservation & Atomic Assignment Races", () => {
    it("ROOM-05 [ATOMIC-RESERVATION]: concurrent candidate matching serializes reservation deterministically without double-matching or orphan state", async () => {
      const rooms = new RoomManager();
      const matches = new MatchManager();
      const queue = new MatchmakingManager(rooms, matches);

      try {
        // Player B is waiting in queue
        const entryB = await queue.join(playerB, 1200, "client-b", "RANKED");
        expect(entryB.status).toBe("QUEUED");

        // Two opponents (host and player C) concurrently search for a match
        const [matchResult1, matchResult2] = await Promise.allSettled([
          queue.join(host, 1200, "client-host", "RANKED"),
          queue.join(playerC, 1200, "client-c", "RANKED"),
        ]);

        const fulfilled = [matchResult1, matchResult2].filter((r) => r.status === "fulfilled");
        expect(fulfilled.length).toBeGreaterThanOrEqual(1);

        // Player B must only be matched with ONE opponent
        const snapshotB = queue.get(entryB.queueId, playerB.userId);
        expect(snapshotB.status).toBe("MATCHED");
        expect(snapshotB.roomId).toBeTruthy();

        // One of host or player C gets MATCHED with player B; the other must remain QUEUED (no double match of B)
        const matchedEntry = [matchResult1, matchResult2]
          .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
          .map((r) => r.value);

        const matchedCount = matchedEntry.filter((e) => e.status === "MATCHED").length;
        const queuedCount = matchedEntry.filter((e) => e.status === "QUEUED").length;

        expect(matchedCount).toBe(1);
        expect(queuedCount).toBe(1);
      } finally {
        queue.stop();
        matches.stop();
      }
    });

    it("ROOM-05 [ROLLBACK-ATOMICITY]: commit failure rolls back reservations, releases locks, and leaves no orphan rooms or dangling capacity", async () => {
      const rooms = new RoomManager();
      const matches = new MatchManager();

      // Simulate a failure during room creation / commit
      const originalCreateRanked = rooms.createRanked.bind(rooms);
      rooms.createRanked = async () => {
        throw new Error("DB_COMMIT_TRANSACTION_FAILED");
      };

      const queue = new MatchmakingManager(rooms, matches);
      try {
        const candidate = await queue.join(playerB, 1000, "client-b", "RANKED");
        await expect(queue.join(host, 1000, "client-host", "RANKED")).rejects.toThrow("DB_COMMIT_TRANSACTION_FAILED");

        // Invariant: No orphan room created in RoomManager
        expect(rooms.size()).toBe(0);

        // Invariant: No active locks held in MatchManager
        expect(matches.isActiveLocked(host.userId)).toBe(false);
        expect(matches.isActiveLocked(playerB.userId)).toBe(false);

        // Candidate B must remain QUEUED or cleanly roll back without trapped reservation
        const candidateState = queue.get(candidate.queueId, playerB.userId);
        expect(candidateState.status).toBe("QUEUED");
      } finally {
        rooms.createRanked = originalCreateRanked;
        queue.stop();
        matches.stop();
      }
    });
  });

  describe("ROOM-06: Cancel vs Match Race", () => {
    it("ROOM-06 [CANCEL-WINS]: cancel commits before match -> queue marked CANCELLED, no subsequent match formed", async () => {
      const rooms = new RoomManager();
      const matches = new MatchManager();
      const queue = new MatchmakingManager(rooms, matches);

      try {
        const entryB = await queue.join(playerB, 1000, "client-b", "RANKED");
        expect(entryB.status).toBe("QUEUED");

        // Player B cancels before any match forms
        const cancelled = queue.cancel(entryB.queueId, playerB.userId);
        expect(cancelled.status).toBe("CANCELLED");

        // Player C joins with compatible rating
        const entryC = await queue.join(playerC, 1000, "client-c", "RANKED");

        // Target: Player C must NOT match with cancelled Player B; Player C remains QUEUED
        expect(entryC.status).toBe("QUEUED");
        expect(queue.get(entryB.queueId, playerB.userId).status).toBe("CANCELLED");
        expect(rooms.size()).toBe(0);
      } finally {
        queue.stop();
        matches.stop();
      }
    });

    it("ROOM-06 [MATCH-WINS]: match commits before cancel -> cancel returns assigned match snapshot rather than throwing MATCH_ALREADY_COMMITTED", async () => {
      const rooms = new RoomManager();
      const matches = new MatchManager();
      const queue = new MatchmakingManager(rooms, matches);

      try {
        const entryB = await queue.join(playerB, 1000, "client-b", "RANKED");

        // Player C joins and forms match with Player B
        const entryC = await queue.join(playerC, 1000, "client-c", "RANKED");
        expect(entryC.status).toBe("MATCHED");

        // TARGET PROTOCOL 0.2 / FRS-L03 §3 LINE 48 & §4 LINE 62 INVARIANT:
        // "Match thắng race: Cancel trả assignment đã commit; client mở trận, không rollback match hoặc báo đã hủy"
        // "Matched: Mở room/match được server gán, kể cả khi người dùng vừa bấm hủy"
        //
        // When match commits first, calling cancel() MUST return the authoritative assigned match snapshot
        // (status: "MATCHED" with roomId and matchId) rather than throwing 409 CONFLICT with MATCH_ALREADY_COMMITTED.
        const cancelResult = queue.cancel(entryB.queueId, playerB.userId);
        expect(cancelResult.status).toBe("MATCHED");
        expect(cancelResult.roomId).toBe(entryC.roomId);
        expect(cancelResult.matchId).toBeTruthy();
      } finally {
        queue.stop();
        matches.stop();
      }
    });
  });

  describe("ROOM-07: Lease Timeout & Cleanup Harness", () => {
    it("ROOM-07 [LEASE-EXPIRY]: expired queue lease transitions entry out of active pool and cleans up without manual intervention", async () => {
      let currentTime = 1_000_000;
      const rooms = new RoomManager();
      const matches = new MatchManager(() => currentTime);
      const queue = new MatchmakingManager(rooms, matches, () => currentTime);

      try {
        // Player B joins queue with lease
        const entryB = await queue.join(playerB, 1000, "client-b", "RANKED");
        expect(entryB.status).toBe("QUEUED");

        // TARGET PROTOCOL 0.2 INVARIANT:
        // Matchmaking entries have an authoritative lease expiration (e.g. leaseExpiresAt or 30s TTL).
        // Advance time past lease duration (+45 seconds) without renewal
        currentTime += 45_000;

        // Cleanup cycle runs (or automatic check)
        expect(typeof (queue as any).cleanupExpiredLeases).toBe("function");
        const cleanedCount = (queue as any).cleanupExpiredLeases();
        expect(cleanedCount).toBeGreaterThanOrEqual(1);

        // Entry should now be EXPIRED or CANCELLED, and no longer eligible for matching
        const snapshot = queue.get(entryB.queueId, playerB.userId);
        expect(["EXPIRED", "CANCELLED"]).toContain(snapshot.status);

        // Player B is now free to queue again (no stale queue lock or active lock)
        const reEntry = await queue.join(playerB, 1000, "client-b-new", "RANKED");
        expect(reEntry.status).toBe("QUEUED");
        expect(reEntry.queueId).not.toBe(entryB.queueId);
      } finally {
        queue.stop();
        matches.stop();
      }
    });

    it("ROOM-07 [CLEANUP-SAFETY]: periodic or batch cleanup purges expired unassigned entries without mutating or deleting committed matches", async () => {
      let currentTime = 1_000_000;
      const rooms = new RoomManager();
      const matches = new MatchManager(() => currentTime);
      const queue = new MatchmakingManager(rooms, matches, () => currentTime);

      try {
        // Match formed between Host and Player B
        await queue.join(host, 1000, "client-host", "RANKED");
        const matched = await queue.join(playerB, 1000, "client-b", "RANKED");
        expect(matched.status).toBe("MATCHED");

        // Player C joins queue later, stays unassigned
        currentTime += 10_000;
        const entryC = await queue.join(playerC, 2500, "client-c", "RANKED");
        expect(entryC.status).toBe("QUEUED");

        // Advance time to expire Player C's lease (+60 seconds)
        currentTime += 60_000;

        // Run batch cleanup
        expect(typeof (queue as any).cleanupExpiredLeases).toBe("function");
        (queue as any).cleanupExpiredLeases();

        // INVARIANT: Committed match between Host and Player B MUST NOT be deleted or altered!
        const snapshotHost = queue.get(matched.queueId, playerB.userId);
        expect(snapshotHost.status).toBe("MATCHED");
        expect(snapshotHost.roomId).toBe(matched.roomId);
        expect(rooms.search(matched.roomId!).players).toBe(2);
        expect(rooms.search(matched.roomId!, playerB.userId).members).toHaveLength(2);
      } finally {
        queue.stop();
        matches.stop();
      }
    });
  });
});
