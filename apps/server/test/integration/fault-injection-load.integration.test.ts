import { describe, expect, it } from "vitest";
import { MatchManager } from "../../src/modules/match/match.manager.js";
import { RoomManager } from "../../src/modules/room/room.manager.js";
import { CapacityController } from "../../src/modules/capacity/capacity.controller.js";
import { InMemoryCommitPort } from "../../src/modules/match/commit/commit.memory.js";
import { CommandLedger } from "../../src/modules/match/commit/command-ledger.js";
import { FaultInjectionScenario } from "../../../../tests/load/scenarios/fault-injection.mjs";
import {
  createRehearsalDb,
  rehearseBoundary1PreCommitKill,
  rehearseBoundary2PostCommitPreAckKill,
  rehearseBoundary3PostAckKill,
} from "../../../../scripts/network/kill-restart-rehearsal.mjs";
import { PrismaCommitPort } from "../../src/modules/match/commit/commit.prisma.js";
import { MatchRecoveryManager } from "../../src/modules/match/recovery/match-recovery.manager.js";

describe("L07-W4: Fault Injections, Isolations & Crash Boundaries (L-07.06 & L-07.07)", () => {
  it("L-04.11 / L-07.06: listener throwing an unhandled error does not crash or interrupt match progress", async () => {
    const rooms = new RoomManager();
    const ledger = new CommandLedger();
    const matches = new MatchManager(() => Date.now(), 15_000, undefined, undefined, ledger);

    const blueActor = { userId: "fault-user-1", username: "u1", displayName: "d1" };
    const redActor = { userId: "fault-user-2", username: "u2", displayName: "d2" };

    const room = await rooms.create(blueActor, { name: "ListenerFaultRoom", visibility: "PUBLIC", timerSeconds: 300 });
    await rooms.join(redActor, room.roomId, {});
    const roomDetail = rooms.search(room.roomId, blueActor.userId);

    matches.ensure(roomDetail);
    matches.ready(roomDetail, blueActor, true);
    matches.ready(roomDetail, redActor, true);
    matches.fastReady(roomDetail, blueActor);
    matches.fastReady(roomDetail, redActor);

    const faultScenario = new FaultInjectionScenario("http://127.0.0.1:3000");
    const result = await faultScenario.testSubscriberThrowIsolation(matches, roomDetail, blueActor);

    expect(result.passed).toBe(true);
    expect(result.moveSucceeded).toBe(true);
    expect(result.survivingListenerReceived).toBe(true);
  });

  it("L-07.03 / L-07.06: lobby flood trips controller into PRESSURE, shedding lobby while preserving PvP reserve", async () => {
    const rooms = new RoomManager();
    const ledger = new CommandLedger();
    const matches = new MatchManager(() => Date.now(), 15_000, undefined, undefined, ledger);
    const capacityController = new CapacityController();

    const blueActor = { userId: "flood-blue", username: "fb", displayName: "fb" };
    const redActor = { userId: "flood-red", username: "fr", displayName: "fr" };

    const room = await rooms.create(blueActor, { name: "FloodRoom", visibility: "PUBLIC", timerSeconds: 300 });
    await rooms.join(redActor, room.roomId, {});
    const roomDetail = rooms.search(room.roomId, blueActor.userId);

    const faultScenario = new FaultInjectionScenario("http://127.0.0.1:3000");
    const result = await faultScenario.testLobbyFloodProtection(capacityController, matches, roomDetail, blueActor);

    expect(result.passed).toBe(true);
    expect(result.controllerState).toBe("PRESSURE");
    expect(result.lobbyRejected).toBe(true);
    expect(result.pvpAdmitted).toBe(true);
  });

  it("L-05.03 / L-07.07: DB outage causes staged commit to fail closed without emitting fake ACKs", async () => {
    const rooms = new RoomManager();
    const ledger = new CommandLedger();
    const commitPort = new InMemoryCommitPort(ledger, () => Date.now());
    const matches = new MatchManager(() => Date.now(), 15_000, undefined, commitPort, ledger);

    const blueActor = { userId: "db-fail-blue", username: "dfb", displayName: "dfb" };
    const redActor = { userId: "db-fail-red", username: "dfr", displayName: "dfr" };

    const room = await rooms.create(blueActor, { name: "DBOutageRoom", visibility: "PUBLIC", timerSeconds: 300 });
    await rooms.join(redActor, room.roomId, {});
    const roomDetail = rooms.search(room.roomId, blueActor.userId);

    matches.ensure(roomDetail);
    matches.ready(roomDetail, blueActor, true);
    matches.ready(roomDetail, redActor, true);
    matches.fastReady(roomDetail, blueActor);
    matches.fastReady(roomDetail, redActor);

    const faultScenario = new FaultInjectionScenario("http://127.0.0.1:3000");
    const result = await faultScenario.testDbOutageFailClosed(commitPort, roomDetail as any, blueActor, matches);

    expect(result.passed).toBe(true);
    expect(result.caughtUnknown).toBe(true);
    expect(result.laneLocked).toBe(true);
    expect(result.appErrorThrown).toBe(true);
  });

  it("L-07.07: Crash boundaries 1, 2, 3 maintain zero ACKed move loss and zero clock deduction penalty", async () => {
    const mockDb = createRehearsalDb();
    const commitPort = new PrismaCommitPort(mockDb.prisma as any, undefined, () => Date.now());
    const recoveryManager = new MatchRecoveryManager(mockDb.prisma as any);

    const b1 = await rehearseBoundary1PreCommitKill(commitPort, mockDb);
    const b2 = await rehearseBoundary2PostCommitPreAckKill(commitPort, mockDb);
    const b3 = await rehearseBoundary3PostAckKill(commitPort, recoveryManager, mockDb);

    expect(b1.passed).toBe(true);
    expect(b2.passed).toBe(true);
    expect(b3.passed).toBe(true);
    expect(b3.clocksPreservedWithoutOutagePenalty).toBe(true);
    expect(b3.zeroAckedMovesLost).toBe(true);
  });
});
