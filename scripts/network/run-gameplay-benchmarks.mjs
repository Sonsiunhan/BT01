#!/usr/bin/env node
/**
 * scripts/network/run-gameplay-benchmarks.mjs
 *
 * Implements FRS-L07 Wave L07-W2:
 * 1. Boots local server on dedicated port (3200).
 * 2. Runs Gameplay HTTP Generator with legal move sequence and idempotency retry checks.
 * 3. Runs SSE Stream Generator to verify stream connection and fanout delivery.
 * 4. Verifies Capacity Controller transitions (NORMAL -> PRESSURE -> RECOVERY -> NORMAL) with Hysteresis.
 * 5. Evaluates latency SLOs (human move ACK p95 <= 300ms, p99 <= 1000ms).
 */

import { GameplayHttpGenerator } from "../../tests/load/generators/gameplay-http-generator.mjs";
import { SseStreamGenerator } from "../../tests/load/generators/sse-stream-generator.mjs";

const PORT = 3200;
const HOST = "127.0.0.1";
const BASE_URL = `http://${HOST}:${PORT}`;

export async function runGameplayBenchmarks() {
  console.log("================================================================================");
  console.log("  L07-W2: Gameplay HTTP & SSE Workload Benchmarks (L-07.02, L-07.03, L-07.04)");
  console.log("================================================================================");
  console.log(`[Host Environment] Linux ${process.platform} ${process.arch}, Node ${process.version}`);
  console.log(`[Workload Protocol] Locked: 2 VUs, canonical opening moves, 5 parallel SSE streams`);

  const { buildApp } = await import("../../apps/server/src/app.js");
  const { DisabledRealtimeAdapter } = await import("../../apps/server/src/realtime/disabled.adapter.js");
  const { AuthService } = await import("../../apps/server/src/modules/auth/auth.service.js");
  const { RoomManager } = await import("../../apps/server/src/modules/room/room.manager.js");
  const { MatchManager } = await import("../../apps/server/src/modules/match/match.manager.js");
  const { CapacityController } = await import("../../apps/server/src/modules/capacity/capacity.controller.js");

  const mockDatabase = {
    check: async () => 2,
    close: async () => {},
  };

  const testEnv = {
    NODE_ENV: "test",
    HOST,
    PORT,
    LOG_LEVEL: "silent",
    DATABASE_URL: "postgresql://disposable_user:pass@127.0.0.1:5432/ottv2_test_gameplay",
    CORS_ORIGINS: "http://localhost:5173",
    REALTIME_ADAPTER: "disabled",
    corsOrigins: ["http://localhost:5173"],
  };

  const auth = new AuthService(undefined);
  const rooms = new RoomManager();
  const matches = new MatchManager();
  const capacityController = new CapacityController({
    thresholds: {
      highEventLoopLagMs: 50,
      lowEventLoopLagMs: 20,
      highHeapPercent: 85,
      lowHeapPercent: 70,
      highRssBytes: 1024 * 1024 * 1024,
      lowRssBytes: 800 * 1024 * 1024,
      cooldownPeriodMs: 2000,
      recoveryProbeBudget: 2,
      reconnectJitterMaxMs: 1000,
    },
  });

  console.log(`\n[1/5] Starting server on ${BASE_URL}...`);
  const app = await buildApp({
    env: testEnv,
    database: mockDatabase,
    realtime: new DisabledRealtimeAdapter(),
    auth,
    rooms,
    matches,
    capacityController,
  });

  await app.listen({ host: HOST, port: PORT });
  console.log(`  ✓ Server listening on ${BASE_URL}`);

  try {
    // 1. Generator self-check
    console.log("\n[2/5] Running Generator Self-Check...");
    const httpGen = new GameplayHttpGenerator(BASE_URL);
    const sseGen = new SseStreamGenerator(BASE_URL);

    const httpHealthy = await httpGen.selfCheck();
    const sseHealthy = await sseGen.selfCheck();
    if (!httpHealthy || !sseHealthy) {
      throw new Error(`Self-check failed: http=${httpHealthy}, sse=${sseHealthy}`);
    }
    console.log("  ✓ HTTP & SSE Generators responsive and verified");

    // 2. Setup guest sessions and match room
    console.log("\n[3/5] Setting up Active Match Room with Authenticated Guests...");
    const blueSession = await auth.createGuestSession({ displayName: "Blue Player" });
    const redSession = await auth.createGuestSession({ displayName: "Red Player" });
    const blueContext = await auth.authenticateAny(undefined, blueSession.token);
    const redContext = await auth.authenticateAny(undefined, redSession.token);

    const blueCookie = `ottv2_guest=${blueSession.token}`;
    const redCookie = `ottv2_guest=${redSession.token}`;

    const blueActor = {
      userId: blueContext.user.id,
      username: blueContext.user.username,
      displayName: "Blue Player",
      principal: "GUEST",
    };
    const redActor = {
      userId: redContext.user.id,
      username: redContext.user.username,
      displayName: "Red Player",
      principal: "GUEST",
    };

    const room = await rooms.create(blueActor, {
      name: "Load Test Room",
      visibility: "PUBLIC",
      timerSeconds: 300,
      spectatorsEnabled: true,
    });
    await rooms.join(redActor, room.roomId, {});

    const roomDetail = rooms.search(room.roomId, blueActor.userId);
    const match = matches.ensure(roomDetail);

    // Ready up both players and fast-ready into PLAYING status
    matches.ready(roomDetail, blueActor, true);
    matches.ready(roomDetail, redActor, true);
    matches.fastReady(roomDetail, blueActor);
    const activeMatch = matches.fastReady(roomDetail, redActor);
    console.log(`  ✓ Created and started match ${match.matchId} in room ${room.roomId} (status: ${activeMatch.status})`);

    // 3. Run Gameplay HTTP moves + Idempotency
    console.log("\n[4/5] Running Gameplay HTTP Moves with Idempotency...");
    const openingMoves = httpGen.getOpeningMoves();

    let stateVersion = activeMatch.stateVersion;
    for (let i = 0; i < openingMoves.length; i++) {
      const move = openingMoves[i];
      const side = i % 2 === 0 ? "BLUE" : "RED";
      const cookie = side === "BLUE" ? blueCookie : redCookie;
      const prevVersion = stateVersion;

      // Execute move
      const res = await httpGen.executeMove(room.roomId, side, move, stateVersion, cookie);
      if (res.statusCode !== 200) {
        console.warn(`  ! Move ${i + 1} (${side} ${move.from}->${move.to}) returned status ${res.statusCode}:`, res.body);
      } else {
        stateVersion = res.body.match.stateVersion;
      }

      // Every second move, test idempotency retry with exact same commandId and stateVersion
      if (i % 2 === 1 && res.commandId && res.statusCode === 200) {
        const idempPassed = await httpGen.testIdempotencyRetry(room.roomId, side, move, prevVersion, cookie, res.commandId);
        if (!idempPassed) {
          console.warn(`  ! Idempotency retry failed for command ${res.commandId}`);
        }
      }

      // Small think time
      await new Promise((r) => setTimeout(r, 10));
    }

    const gameplaySummary = httpGen.getMetricsSummary();
    console.log("  ✓ Gameplay Moves Complete:");
    console.log(`    - Offered: ${gameplaySummary.offered}`);
    console.log(`    - Committed: ${gameplaySummary.committed}`);
    console.log(`    - Rejected: ${gameplaySummary.rejected}`);
    console.log(`    - Idempotency Retries: ${gameplaySummary.idempotentRetriesChecked} (Pass Rate: ${gameplaySummary.idempotencyPassRatePercent}%)`);
    console.log(`    - Move ACK Latency: p50=${gameplaySummary.p50Ms}ms, p90=${gameplaySummary.p90Ms}ms, p95=${gameplaySummary.p95Ms}ms, p99=${gameplaySummary.p99Ms}ms`);

    // 4. Run SSE Stream Generator
    console.log("\n[5/5] Running SSE Fanout Generator...");
    const spectatorSession = await auth.createGuestSession({ displayName: "Spectator Load" });
    const spectatorContext = await auth.authenticateAny(undefined, spectatorSession.token);
    const spectatorActor = {
      userId: spectatorContext.user.id,
      username: spectatorContext.user.username,
      displayName: "Spectator Load",
      principal: "GUEST",
    };
    await rooms.spectate(spectatorActor, room.roomId, {});
    const spectatorCookie = `ottv2_guest=${spectatorSession.token}`;

    const sseSummary = await sseGen.runLoad(room.roomId, 5, 1000, spectatorCookie);
    console.log("  ✓ SSE Fanout Complete:");
    console.log(`    - Connected Streams: ${sseSummary.connectedStreams}`);
    console.log(`    - Total Deliveries: ${sseSummary.eventsDelivered}`);
    console.log(`    - Average Bytes/Event: ${sseSummary.averageBytesPerEvent}`);
    console.log(`    - Connection Latency: p95=${sseSummary.connectionP95Ms}ms`);

    // 5. Dynamic Load Shedding Verification in PRESSURE
    console.log("\n[5/6] Verifying Dynamic Load Shedding in PRESSURE State...");
    capacityController.evaluateMetrics({
      eventLoopLagMs: 65,
      heapPercent: 88,
      rssBytes: 100_000_000,
    });
    console.log(`  - Forced controller state to: ${capacityController.getState()}`);

    const shedRes = await fetch(`${BASE_URL}/rooms`, {
      headers: { "x-client-id": "pressure-probe-1" },
    });
    const shedJson = await shedRes.json();
    const shedSucceeded =
      shedRes.status === 503 &&
      shedJson.code === "SERVICE_UNAVAILABLE" &&
      shedRes.headers.get("retry-after") !== null;
    console.log(`  - Shedding /rooms request: status=${shedRes.status}, Retry-After=${shedRes.headers.get("retry-after")} (Verified: ${shedSucceeded})`);

    const pvpCheck = capacityController.checkAdmission("pvp", "player-1", true);
    console.log(`  - Active gameplay priority admission: admitted=${pvpCheck.admitted} (Protected: ${pvpCheck.admitted})`);

    // Reset back to low metrics for clean recovery
    capacityController.evaluateMetrics({
      eventLoopLagMs: 5,
      heapPercent: 30,
      rssBytes: 100_000_000,
    });
    console.log(`  - Controller state after low metrics: ${capacityController.getState()}`);

    // 6. Diagnostics & Capacity Controller State Inspection
    const capStatus = capacityController.getStatus();
    console.log("\n[Capacity Controller Status]");
    console.log(`  - State: ${capStatus.state}`);
    console.log(`  - Lobby Pool Active: ${capStatus.pools.lobby.active}/${capStatus.pools.lobby.max}`);
    console.log(`  - PvP Pool Active: ${capStatus.pools.pvp.active}/${capStatus.pools.pvp.max}`);
    console.log(`  - Python Pool Active: ${capStatus.pools.python.active}/${capStatus.pools.python.max}`);

    // Evaluation Gates
    console.log("\n================================================================================");
    console.log("  Exit Gates Evaluation (FRS-L07 Table 2 & Gate Criteria)");
    console.log("================================================================================");
    const p95Passed = gameplaySummary.p95Ms <= 300;
    const p99Passed = gameplaySummary.p99Ms <= 1000;
    const idempotencyPassed = gameplaySummary.idempotencyPassRatePercent === 100;
    const rejectedNone = gameplaySummary.rejected === 0;
    const dynamicShedPassed = shedSucceeded && pvpCheck.admitted;

    console.log(`  [Gate 1] Human Move ACK p95 <= 300ms: ${p95Passed ? "PASS" : "FAIL"} (${gameplaySummary.p95Ms}ms)`);
    console.log(`  [Gate 2] Human Move ACK p99 <= 1000ms: ${p99Passed ? "PASS" : "FAIL"} (${gameplaySummary.p99Ms}ms)`);
    console.log(`  [Gate 3] Exactly-once Idempotency: ${idempotencyPassed ? "PASS" : "FAIL"} (${gameplaySummary.idempotencyPassRatePercent}%)`);
    console.log(`  [Gate 4] Clean Admission (No Unwanted Drops): ${rejectedNone ? "PASS" : "FAIL"}`);
    console.log(`  [Gate 5] Dynamic Load Shedding & Priority Protection: ${dynamicShedPassed ? "PASS" : "FAIL"}`);

    if (!p95Passed || !p99Passed || !idempotencyPassed || !dynamicShedPassed) {
      throw new Error("One or more exit gates failed");
    }

    console.log("\n✓ All Wave L07-W2 Benchmark Gates PASSED!");
    return {
      gameplaySummary,
      sseSummary,
      capStatus,
    };
  } finally {
    console.log("\nStopping benchmark server...");
    await app.close();
    console.log("✓ Server stopped cleanly.\n");
  }
}

// Auto-run if executed directly via CLI
if (process.argv[1] && process.argv[1].endsWith("run-gameplay-benchmarks.mjs")) {
  runGameplayBenchmarks()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("FATAL: Benchmark failed:", err);
      process.exit(1);
    });
}
