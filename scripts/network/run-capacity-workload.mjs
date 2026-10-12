#!/usr/bin/env node
/**
 * scripts/network/run-capacity-workload.mjs
 *
 * Implements FRS-L07 Wave L07-W4 Comprehensive Capacity & Failure Harness:
 * 1. Ramp Load Tiers (Warmup, 1k CCU equiv, 5k CCU equiv, 10k CCU equiv) with Safety Stop.
 *    INVARIANT: "rejected không tính là served".
 * 2. Soak Testing: Sustained gameplay, memory leak detection, and clean resource teardown.
 * 3. Spike Testing: Sudden burst join/reconnect with gameplay reserve protection.
 * 4. Fault Injections: Slow SSE isolation, subscriber throw isolation, lobby flood protection, DB outage fail-closed.
 * 5. Crash Boundaries: Boundary 1 rollback, Boundary 2 deduplication, Boundary 3 restart clock preservation.
 * 6. Generates full CP-5 Capacity Verification Summary.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { RampSoakSpikeScenario } from "../../tests/load/scenarios/ramp-soak-spike.mjs";
import { FaultInjectionScenario } from "../../tests/load/scenarios/fault-injection.mjs";

const PORT = 3400;
const HOST = "127.0.0.1";
const BASE_URL = `http://${HOST}:${PORT}`;
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

export async function runCapacityWorkload() {
  console.log("================================================================================");
  console.log("  Wave L07-W4: Ramp / Soak / Spike Load & Failure Injections (L-07.05 - L-07.08)");
  console.log("================================================================================");
  console.log(`[Host Architecture] Linux ${process.platform} ${process.arch}, Node ${process.version}`);
  console.log(`[Target URL]        ${BASE_URL}`);

  const { buildApp } = await import("../../apps/server/src/app.js");
  const { DisabledRealtimeAdapter } = await import("../../apps/server/src/realtime/disabled.adapter.js");
  const { AuthService } = await import("../../apps/server/src/modules/auth/auth.service.js");
  const { RoomManager } = await import("../../apps/server/src/modules/room/room.manager.js");
  const { MatchManager } = await import("../../apps/server/src/modules/match/match.manager.js");
  const { CapacityController } = await import("../../apps/server/src/modules/capacity/capacity.controller.js");
  const { InMemoryCommitPort } = await import("../../apps/server/src/modules/match/commit/commit.memory.js");
  const { CommandLedger } = await import("../../apps/server/src/modules/match/commit/command-ledger.js");

  const mockDatabase = {
    check: async () => 2,
    close: async () => {},
  };

  const testEnv = {
    NODE_ENV: "test",
    HOST,
    PORT,
    LOG_LEVEL: "silent",
    DATABASE_URL: "postgresql://disposable_user:pass@127.0.0.1:5432/ottv2_test_capacity",
    CORS_ORIGINS: "http://localhost:5173",
    REALTIME_ADAPTER: "disabled",
    corsOrigins: ["http://localhost:5173"],
  };

  const auth = new AuthService(undefined);
  const rooms = new RoomManager();
  const ledger = new CommandLedger();
  const commitPort = new InMemoryCommitPort(ledger, () => Date.now());
  const matches = new MatchManager(() => Date.now(), 15_000, undefined, commitPort, ledger);
  const capacityController = new CapacityController();

  const app = await buildApp({
    env: testEnv,
    database: mockDatabase,
    realtime: new DisabledRealtimeAdapter(),
    auth,
    rooms,
    matches,
    capacityController,
    commitPort,
    commandLedger: ledger,
  });

  await app.listen({ host: HOST, port: PORT });
  console.log(`  ✓ Workload test server listening on ${BASE_URL}`);

  const report = {
    executedAt: new Date().toISOString(),
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
    },
    rampTiers: {},
    soakTest: {},
    spikeTest: {},
    faultInjections: {},
    crashBoundaries: {},
    overallVerdict: "PENDING",
  };

  try {
    const rampScenario = new RampSoakSpikeScenario(BASE_URL);
    const faultScenario = new FaultInjectionScenario(BASE_URL);

    // =========================================================================
    // Part 1: Ramp Load Tiers (Warmup, 1k, 5k, 10k CCU equivalent)
    // =========================================================================
    console.log("\n[Part 1] Ramp Workload Tiers (L-07.05)");

    // 1.1 Warmup Tier
    const warmupResult = await rampScenario.executeRampTier("Warmup", 10, 2, 2);
    report.rampTiers.warmup = warmupResult;

    // 1.2 Tier 1: 1,000 CCU equivalent profile (50 concurrent VUs, 10 matches, 4 moves)
    const tier1Result = await rampScenario.executeRampTier("1,000 CCU Equiv", 50, 6, 4);
    report.rampTiers.tier1_1k = tier1Result;

    // 1.3 Tier 2: 5,000 CCU equivalent profile (150 concurrent VUs, 15 matches, 4 moves)
    const tier2Result = await rampScenario.executeRampTier("5,000 CCU Equiv", 150, 10, 4);
    report.rampTiers.tier2_5k = tier2Result;

    // 1.4 Tier 3: 10,000 CCU equivalent profile (300 concurrent VUs, 20 matches, 4 moves)
    const tier3Result = await rampScenario.executeRampTier("10,000 CCU Equiv", 300, 15, 4);
    report.rampTiers.tier3_10k = tier3Result;

    // =========================================================================
    // Part 2: Soak Testing (Sustained Gameplay & Cleanup Verification)
    // =========================================================================
    console.log("\n[Part 2] Soak Testing & Cleanup Gate (L-07.05)");
    const soakResult = await rampScenario.executeSoakTest(5, 2);
    report.soakTest = soakResult;

    // =========================================================================
    // Part 3: Spike Testing (Burst Join Surge & Load Shedding Protection)
    // =========================================================================
    console.log("\n[Part 3] Spike Testing & Gameplay Reserve Protection (L-07.05)");
    const spikeResult = await rampScenario.executeSpikeTest(25);
    report.spikeTest = spikeResult;

    // =========================================================================
    // Part 4: Fault Injections (L-07.06 & L-07.07)
    // =========================================================================
    console.log("\n[Part 4] Fault Injection & Isolation Suite (L-07.06 & L-07.07)");

    // Setup room for fault tests
    const blueGuest = await rampScenario.createGuest("FaultBlue");
    const redGuest = await rampScenario.createGuest("FaultRed");
    const fastSpec = await rampScenario.createGuest("FastSpec");
    const slowSpec = await rampScenario.createGuest("SlowSpec");

    const faultRoomRes = await rampScenario.httpRequest("POST", "/rooms", {
      name: "FaultRoom",
      visibility: "PUBLIC",
      timerSeconds: 300,
      spectatorsEnabled: true,
      spectatorCapacity: 10,
    }, { "Cookie": blueGuest.cookie, "X-Client-Id": blueGuest.clientId });
    const faultRoom = faultRoomRes.body?.room ?? faultRoomRes.body;
    const faultRoomId = faultRoom.roomId;
    await rampScenario.httpRequest("POST", `/rooms/${faultRoomId}/join`, {}, { "Cookie": redGuest.cookie, "X-Client-Id": redGuest.clientId });
    await rampScenario.httpRequest("POST", `/matches/${faultRoomId}/ready`, { ready: true }, { "Cookie": blueGuest.cookie, "X-Client-Id": blueGuest.clientId });
    await rampScenario.httpRequest("POST", `/matches/${faultRoomId}/ready`, { ready: true }, { "Cookie": redGuest.cookie, "X-Client-Id": redGuest.clientId });
    await rampScenario.httpRequest("POST", `/matches/${faultRoomId}/fast-ready`, {}, { "Cookie": blueGuest.cookie, "X-Client-Id": blueGuest.clientId });
    const faultFastRes = await rampScenario.httpRequest("POST", `/matches/${faultRoomId}/fast-ready`, {}, { "Cookie": redGuest.cookie, "X-Client-Id": redGuest.clientId });
    const faultVersion = faultFastRes.body?.match?.stateVersion ?? 2;

    // Join spectators
    await rampScenario.httpRequest("POST", `/rooms/${faultRoomId}/spectate`, {}, { "Cookie": fastSpec.cookie, "X-Client-Id": fastSpec.clientId });
    await rampScenario.httpRequest("POST", `/rooms/${faultRoomId}/spectate`, {}, { "Cookie": slowSpec.cookie, "X-Client-Id": slowSpec.clientId });

    const hostUserId = faultRoom.hostUserId ?? faultRoom.members?.[0]?.userId;
    const roomDetail = rooms.search(faultRoomId, hostUserId);
    const blueActor = { userId: hostUserId, username: "FaultBlue", displayName: "FaultBlue" };

    // 4.1 Slow SSE Isolation
    report.faultInjections.slowSse = await faultScenario.testSlowSseIsolation(
      faultRoomId,
      blueGuest.cookie,
      redGuest.cookie,
      fastSpec.cookie,
      slowSpec.cookie,
      blueGuest.clientId,
      faultVersion
    );

    // 4.2 Listener Throw Isolation (isolated room)
    const listenerBlue = { userId: "list-blue-id", username: "list-blue", displayName: "ListBlue" };
    const listenerRed = { userId: "list-red-id", username: "list-red", displayName: "ListRed" };
    const listenerRoom = await rooms.create(listenerBlue, { name: "ListenerFaultRoom", visibility: "PUBLIC", timerSeconds: 300 });
    await rooms.join(listenerRed, listenerRoom.roomId, {});
    const listenerRoomDetail = rooms.search(listenerRoom.roomId, listenerBlue.userId);
    matches.ensure(listenerRoomDetail);
    matches.ready(listenerRoomDetail, listenerBlue, true);
    matches.ready(listenerRoomDetail, listenerRed, true);
    matches.fastReady(listenerRoomDetail, listenerBlue);
    matches.fastReady(listenerRoomDetail, listenerRed);

    report.faultInjections.listenerThrow = await faultScenario.testSubscriberThrowIsolation(matches, listenerRoomDetail, listenerBlue);

    // 4.3 Lobby Flood Protection
    report.faultInjections.lobbyFlood = await faultScenario.testLobbyFloodProtection(capacityController, matches, roomDetail, blueActor);

    // 4.4 DB Outage Fail-Closed
    report.faultInjections.dbOutage = await faultScenario.testDbOutageFailClosed(commitPort, roomDetail, blueActor);

    // =========================================================================
    // Part 5: Crash Boundaries Re-verification (L-07.07)
    // =========================================================================
    console.log("\n[Part 5] Crash Boundaries Re-verification (L-07.07)");
    const {
      createRehearsalDb,
      rehearseBoundary1PreCommitKill,
      rehearseBoundary2PostCommitPreAckKill,
      rehearseBoundary3PostAckKill,
    } = await import("./kill-restart-rehearsal.mjs");
    const { PrismaCommitPort } = await import("../../apps/server/src/modules/match/commit/commit.prisma.js");
    const { MatchRecoveryManager } = await import("../../apps/server/src/modules/match/recovery/match-recovery.manager.js");

    const mockRehearsalDb = createRehearsalDb();
    const prismaCommitPort = new PrismaCommitPort(mockRehearsalDb.prisma, undefined, () => Date.now());
    const recoveryManager = new MatchRecoveryManager(mockRehearsalDb.prisma);

    const b1 = await rehearseBoundary1PreCommitKill(prismaCommitPort, mockRehearsalDb);
    const b2 = await rehearseBoundary2PostCommitPreAckKill(prismaCommitPort, mockRehearsalDb);
    const b3 = await rehearseBoundary3PostAckKill(prismaCommitPort, recoveryManager, mockRehearsalDb);

    report.crashBoundaries = {
      boundary1_preCommitRollback: b1.passed,
      boundary2_postCommitPreAckDeduplication: b2.passed,
      boundary3_postAckRestartRecovery: b3.passed,
    };

    console.log(`    * Boundary 1 (Pre-commit kill rollback):    ${b1.passed ? "PASS" : "FAIL"}`);
    console.log(`    * Boundary 2 (Post-commit pre-ACK dedup):   ${b2.passed ? "PASS" : "FAIL"}`);
    console.log(`    * Boundary 3 (Post-ACK restart recovery):   ${b3.passed ? "PASS" : "FAIL"}`);

    // =========================================================================
    // Overall Verdict Evaluation
    // =========================================================================
    const rampPass = tier1Result.verdict === "PASS" && tier2Result.verdict === "PASS" && tier3Result.verdict === "PASS";
    const soakPass = soakResult.verdict === "PASS";
    const spikePass = spikeResult.verdict === "PASS";
    const faultPass = Object.values(report.faultInjections).every((f) => f.passed);
    const crashPass = Object.values(report.crashBoundaries).every(Boolean);

    report.overallVerdict = rampPass && soakPass && spikePass && faultPass && crashPass ? "PASS" : "FAIL";

    console.log("\n================================================================================");
    console.log(`  CAPACITY & FAILURE SUITE VERDICT: ${report.overallVerdict}`);
    console.log("================================================================================");
    console.log(`  - Ramp Load Tiers (1k, 5k, 10k Equiv): ${rampPass ? "PASS" : "FAIL"}`);
    console.log(`  - Soak Test (Sustained & Teardown):    ${soakPass ? "PASS" : "FAIL"}`);
    console.log(`  - Spike Test (Gameplay Reserve Guard): ${spikePass ? "PASS" : "FAIL"}`);
    console.log(`  - Fault Injections & Isolations:       ${faultPass ? "PASS" : "FAIL"}`);
    console.log(`  - Crash Boundaries (B1, B2, B3):       ${crashPass ? "PASS" : "FAIL"}`);

    const resultPath = path.resolve(REPO_ROOT, "docs/team-handoff/network-core/capacity-workload-results.json");
    fs.writeFileSync(resultPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`\n  ✓ Saved workload report to: ${path.relative(REPO_ROOT, resultPath)}`);

    return report;
  } finally {
    await app.close();
  }
}

if (process.argv[1] && process.argv[1].endsWith("run-capacity-workload.mjs")) {
  runCapacityWorkload()
    .then((rep) => process.exit(rep.overallVerdict === "PASS" ? 0 : 1))
    .catch((err) => {
      console.error("FATAL: Capacity workload suite failed:", err);
      process.exit(1);
    });
}
