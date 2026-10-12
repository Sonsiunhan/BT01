import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { RoomManager, type RoomActor } from "../../src/modules/room/room.manager.js";
import { MatchManager, type MatchActor } from "../../src/modules/match/match.manager.js";
import { PrismaCommitPort } from "../../src/modules/match/commit/commit.prisma.js";
import { CommandLedger } from "../../src/modules/match/commit/command-ledger.js";
import { buildApp } from "../../src/app.js";
import type { AppEnv } from "../../src/config/env.js";
import type { DatabasePort } from "../../src/plugins/prisma.js";
import { DisabledRealtimeAdapter } from "../../src/realtime/disabled.adapter.js";
import { AppError } from "../../src/shared/errors/app-error.js";

const testEnv: AppEnv = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 3001,
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgresql://user:password@localhost:5432/ottv2_test",
  CORS_ORIGINS: "http://localhost:5173",
  REALTIME_ADAPTER: "disabled",
  corsOrigins: ["http://localhost:5173"],
};

const hostA: RoomActor & MatchActor = { userId: "user-host-a", username: "host_a", displayName: "Host A", principal: "ACCOUNT" };
const guestA: RoomActor & MatchActor = { userId: "user-guest-a", username: "guest_a", displayName: "Guest A", principal: "ACCOUNT" };
const hostB: RoomActor & MatchActor = { userId: "user-host-b", username: "host_b", displayName: "Host B", principal: "ACCOUNT" };
const guestB: RoomActor & MatchActor = { userId: "user-guest-b", username: "guest_b", displayName: "Guest B", principal: "ACCOUNT" };

function createMockPrisma(): PrismaClient {
  return {
    $transaction: vi.fn(async (callback: any) => {
      return callback({
        matchCheckpoint: {
          upsert: vi.fn().mockResolvedValue({}),
          findUnique: vi.fn().mockResolvedValue(null),
        },
        domainEvent: {
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      });
    }),
    matchCheckpoint: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaClient;
}

async function createStandardMatch(manager: MatchManager, host: RoomActor & MatchActor, guest: RoomActor & MatchActor, name: string) {
  const rooms = new RoomManager();
  const created = await rooms.create(host, {
    name,
    visibility: "PUBLIC",
    timerSeconds: 30,
    spectatorsEnabled: true,
  });
  await rooms.join(guest, created.roomId, {});
  const room = rooms.search(created.roomId, host.userId);

  manager.ready(room, host, true);
  manager.ready(room, guest, true);
  manager.fastReady(room, host);
  manager.fastReady(room, guest);

  const snapshot = manager.ensure(room);
  expect(snapshot.status).toBe("PLAYING");
  return { rooms, room, snapshot };
}

describe("L05-W4 Authority Durable & Isolation Integration (L-04.03, L-04.11)", () => {
  it("L-04.03: Commit failpoint UNKNOWN locks Room A lane while leaving Room B completely intact", async () => {
    const mockPrisma = createMockPrisma();
    const ledger = new CommandLedger();
    const prismaPort = new PrismaCommitPort(mockPrisma, ledger);
    const manager = new MatchManager(Date.now, 30_000, undefined, prismaPort, ledger);

    const matchA = await createStandardMatch(manager, hostA, guestA, "Room A");
    const matchB = await createStandardMatch(manager, hostB, guestB, "Room B");

    // Both start at stateVersion 2 after ready & fastReady countdown finish
    const snapA1 = manager.ensure(matchA.room);
    const snapB1 = manager.ensure(matchB.room);
    expect(snapA1.stateVersion).toBe(2);
    expect(snapB1.stateVersion).toBe(2);

    // Set failpoint on commit port to simulate network/DB timeout during commit
    prismaPort.setFailpoint("TIMEOUT");

    // Room A move fails with 500 COMMIT_UNKNOWN
    let thrownError: AppError | null = null;
    try {
      await manager.dispatchCommand(matchA.room.roomId, {
        type: "MOVE",
        room: matchA.room,
        actor: hostA,
        from: "b1",
        to: "b2",
        stateVersion: snapA1.stateVersion,
      });
    } catch (err) {
      thrownError = err as AppError;
    }

    expect(thrownError).toBeInstanceOf(AppError);
    expect(thrownError?.statusCode).toBe(500);
    expect((thrownError?.details as any)?.reason).toBe("COMMIT_UNKNOWN");

    // Verify Room A's lane is locked on unknown
    const laneA = manager.getLane(matchA.room.roomId);
    expect(laneA.isLocked).toBe(true);

    // Subsequent command in Room A is rejected with 409 LANE_UNKNOWN_LOCKED
    await expect(
      manager.dispatchCommand(matchA.room.roomId, {
        type: "MOVE",
        room: matchA.room,
        actor: hostA,
        from: "b1",
        to: "b2",
        stateVersion: snapA1.stateVersion,
      })
    ).rejects.toThrowError(/Trận đấu bị khóa tạm thời/);

    // Critical Isolation check: Room B's lane is NOT locked and can proceed once failpoint is cleared
    const laneB = manager.getLane(matchB.room.roomId);
    expect(laneB.isLocked).toBe(false);

    prismaPort.setFailpoint(null);

    // Room B executes a move successfully without any disturbance from Room A's lock
    const snapB2 = await manager.dispatchCommand(matchB.room.roomId, {
      type: "MOVE",
      room: matchB.room,
      actor: hostB,
      from: "b1",
      to: "b2",
      stateVersion: snapB1.stateVersion,
    });
    expect(snapB2.stateVersion).toBe(3);

    // Room A stateVersion is still 2 (unmutated preserved state)
    const snapA_preserved = manager.ensure(matchA.room);
    expect(snapA_preserved.stateVersion).toBe(2);

    // Once Room A is operator/reconcile unlocked, it can resume
    laneA.unlock();
    expect(laneA.isLocked).toBe(false);
    const snapA2 = await manager.dispatchCommand(matchA.room.roomId, {
      type: "MOVE",
      room: matchA.room,
      actor: hostA,
      from: "b1",
      to: "b2",
      stateVersion: snapA1.stateVersion,
    });
    expect(snapA2.stateVersion).toBe(3);

    manager.stop();
  });

  it("L-04.03: Command ledger fast-path deduplicates retried moves idempotently", async () => {
    const mockPrisma = createMockPrisma();
    const ledger = new CommandLedger();
    const prismaPort = new PrismaCommitPort(mockPrisma, ledger);
    const manager = new MatchManager(Date.now, 30_000, undefined, prismaPort, ledger);

    const match = await createStandardMatch(manager, hostA, guestA, "Room Idempotent");
    const initialSnap = manager.ensure(match.room);
    const cmdId = "client-move-cmd-001";

    // First attempt commits
    const snap1 = await manager.dispatchCommand(match.room.roomId, {
      type: "MOVE",
      room: match.room,
      actor: hostA,
      from: "b1",
      to: "b2",
      stateVersion: initialSnap.stateVersion,
      commandId: cmdId,
    });
    expect(snap1.stateVersion).toBe(3);

    // Immediate retry with the same commandId returns identical cached outcome
    const snap2 = await manager.dispatchCommand(match.room.roomId, {
      type: "MOVE",
      room: match.room,
      actor: hostA,
      from: "b1",
      to: "b2",
      stateVersion: initialSnap.stateVersion, // even with old stateVersion!
      commandId: cmdId,
    });
    expect(snap2.stateVersion).toBe(3);
    expect(snap2.sequence).toBe(snap1.sequence);

    manager.stop();
  });

  it("L-04.11: Move spam in Room A triggers 429 LANE_QUEUE_FULL without impacting Room B", async () => {
    const mockPrisma = createMockPrisma();
    const ledger = new CommandLedger();
    const prismaPort = new PrismaCommitPort(mockPrisma, ledger);
    const manager = new MatchManager(Date.now, 30_000, undefined, prismaPort, ledger);

    const matchA = await createStandardMatch(manager, hostA, guestA, "Room Spam A");
    const matchB = await createStandardMatch(manager, hostB, guestB, "Room Healthy B");

    const laneA = manager.getLane(matchA.room.roomId);

    // Fill Room A's queue: 1 task processing + 50 tasks waiting in queue = 51 tasks enqueued
    let releaseAll: () => void = () => {};
    const unblockPromise = new Promise<void>((resolve) => {
      releaseAll = resolve;
    });
    const enqueuedPromises: Promise<unknown>[] = [];

    for (let i = 0; i < 51; i++) {
      const p = laneA.enqueue(() => unblockPromise);
      enqueuedPromises.push(p);
    }

    expect(laneA.queueDepth).toBe(50); // Exactly at maxQueueDepth

    // The 52nd task in Room A must be rejected synchronously with 429 RATE_LIMITED
    let spamError: AppError | null = null;
    try {
      await laneA.enqueue(async () => "overflow");
    } catch (err) {
      spamError = err as AppError;
    }

    expect(spamError).toBeInstanceOf(AppError);
    expect(spamError?.statusCode).toBe(429);
    expect((spamError?.details as any)?.reason).toBe("LANE_QUEUE_FULL");

    // Critical Isolation check: Room B's lane has independent depth and processes normally
    const snapB1 = manager.ensure(matchB.room);
    const snapB2 = await manager.dispatchCommand(matchB.room.roomId, {
      type: "MOVE",
      room: matchB.room,
      actor: hostB,
      from: "b1",
      to: "b2",
      stateVersion: snapB1.stateVersion,
    });
    expect(snapB2.stateVersion).toBe(3);

    // Release queued tasks in Room A to drain the queue
    releaseAll();
    await Promise.all(enqueuedPromises);

    // Room A lane queue is drained; new commands can be accepted
    expect(laneA.queueDepth).toBe(0);
    const snapA1 = manager.ensure(matchA.room);
    const snapA2 = await manager.dispatchCommand(matchA.room.roomId, {
      type: "MOVE",
      room: matchA.room,
      actor: hostA,
      from: "b1",
      to: "b2",
      stateVersion: snapA1.stateVersion,
    });
    expect(snapA2.stateVersion).toBe(3);

    manager.stop();
  });

  it("L-04.11: Faulty subscriber throwing unhandled error is isolated and does not abort match or affect others", async () => {
    const mockPrisma = createMockPrisma();
    const ledger = new CommandLedger();
    const prismaPort = new PrismaCommitPort(mockPrisma, ledger);
    const manager = new MatchManager(Date.now, 30_000, undefined, prismaPort, ledger);

    const matchA = await createStandardMatch(manager, hostA, guestA, "Room Faulty Listener A");
    const matchB = await createStandardMatch(manager, hostB, guestB, "Room Normal Listener B");

    let faultyListenerCalls = 0;
    let healthyListenerACalls = 0;
    let healthyListenerBCalls = 0;

    // Faulty listener in Room A throws error
    manager.subscribe(matchA.room.roomId, () => {
      faultyListenerCalls++;
      throw new Error("Malfunctioning spectator socket stream exploded!");
    });

    // Well-behaved listener in Room A
    manager.subscribe(matchA.room.roomId, () => {
      healthyListenerACalls++;
    });

    // Well-behaved listener in Room B
    manager.subscribe(matchB.room.roomId, () => {
      healthyListenerBCalls++;
    });

    const snapA1 = manager.ensure(matchA.room);

    // Executing move in Room A must succeed despite the faulty listener
    const snapA = await manager.dispatchCommand(matchA.room.roomId, {
      type: "MOVE",
      room: matchA.room,
      actor: hostA,
      from: "b1",
      to: "b2",
      stateVersion: snapA1.stateVersion,
    });

    expect(snapA.stateVersion).toBe(3);
    expect(faultyListenerCalls).toBeGreaterThan(0);
    expect(healthyListenerACalls).toBeGreaterThan(0);

    const snapB1 = manager.ensure(matchB.room);

    // Move in Room B also executes and its listener receives events
    const snapB = await manager.dispatchCommand(matchB.room.roomId, {
      type: "MOVE",
      room: matchB.room,
      actor: hostB,
      from: "b1",
      to: "b2",
      stateVersion: snapB1.stateVersion,
    });

    expect(snapB.stateVersion).toBe(3);
    expect(healthyListenerBCalls).toBeGreaterThan(0);

    manager.stop();
  });

  it("Wiring: buildApp respects custom commitPort and commandLedger options", async () => {
    const mockPrisma = createMockPrisma();
    const ledger = new CommandLedger();
    const prismaPort = new PrismaCommitPort(mockPrisma, ledger);
    const mockDb: DatabasePort = {
      check: async () => 1,
      close: async () => {},
    };

    const app = await buildApp({
      env: testEnv,
      database: mockDb,
      realtime: new DisabledRealtimeAdapter(),
      commitPort: prismaPort,
      commandLedger: ledger,
    });

    expect(app).toBeDefined();
    await app.ready();
    await app.close();
  });
});
