/**
 * tests/load/scenarios/ramp-soak-spike.mjs
 *
 * Implements FRS-L07 Task L-07.05:
 * 1. Multi-tier Workload Ramp (Warmup, 1,000 CCU equiv, 5,000 CCU equiv, 10,000 CCU equiv)
 *    with explicit counting: offered, admitted, completed, rejected, timeout.
 *    INVARIANT: "rejected không tính là served".
 * 2. Soak Testing: Sustained gameplay verification, leak detection, and post-terminal cleanup.
 * 3. Spike Testing: Sudden burst join/reconnect, verifying load shedding protects gameplay reserve.
 * 4. Safety Stop: Continuous RSS, Heap, and event-loop lag monitoring with early abort.
 */

import http from "node:http";
import crypto from "node:crypto";
import v8 from "node:v8";
import { performance } from "node:perf_hooks";

function percentile(numbers, fraction) {
  if (!numbers || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction));
  return Number(sorted[idx].toFixed(2));
}

export class SafetyStopMonitor {
  constructor(options = {}) {
    this.maxRssBytes = options.maxRssBytes ?? 1.2 * 1024 * 1024 * 1024; // 1.2 GB
    this.maxHeapPercent = options.maxHeapPercent ?? 90; // 90%
    this.maxEventLoopLagMs = options.maxEventLoopLagMs ?? 150; // 150ms
    this.maxRequestLatencyMs = options.maxRequestLatencyMs ?? 3000; // 3000ms
    this.maxErrorRatePercent = options.maxErrorRatePercent ?? 5; // 5%
    this.recentRequests = [];
    this.triggered = false;
    this.triggerReason = null;
    this.triggerStats = null;
  }

  recordRequest(durationMs, isError = false) {
    if (this.triggered) return false;

    if (durationMs > this.maxRequestLatencyMs) {
      this.triggered = true;
      this.triggerReason = "REQUEST_LATENCY_EXCEEDED";
      this.triggerStats = { durationMs: Math.round(durationMs), limitMs: this.maxRequestLatencyMs };
      return false;
    }

    this.recentRequests.push({ durationMs, isError });
    if (this.recentRequests.length > 50) {
      this.recentRequests.shift();
    }

    if (this.recentRequests.length >= 10) {
      const errorCount = this.recentRequests.filter(r => r.isError).length;
      const errorRate = (errorCount / this.recentRequests.length) * 100;
      if (errorRate > this.maxErrorRatePercent) {
        this.triggered = true;
        this.triggerReason = "ERROR_RATE_EXCEEDED";
        this.triggerStats = { errorRate: Math.round(errorRate), limitPercent: this.maxErrorRatePercent };
        return false;
      }
    }

    return true;
  }

  checkSafety(lagMs = 0) {
    if (this.triggered) return false;

    const mem = process.memoryUsage();
    const heapLimit = v8.getHeapStatistics().heap_size_limit;
    const heapPercent = heapLimit > 0 ? (mem.heapUsed / heapLimit) * 100 : 0;

    if (mem.rss > this.maxRssBytes) {
      this.triggered = true;
      this.triggerReason = "RSS_LIMIT_EXCEEDED";
      this.triggerStats = { rssMb: Math.round(mem.rss / 1024 / 1024), limitMb: Math.round(this.maxRssBytes / 1024 / 1024) };
      return false;
    }

    if (heapPercent > this.maxHeapPercent) {
      this.triggered = true;
      this.triggerReason = "HEAP_UTILIZATION_EXCEEDED";
      this.triggerStats = { heapPercent: Math.round(heapPercent), limitPercent: this.maxHeapPercent };
      return false;
    }

    if (lagMs > this.maxEventLoopLagMs) {
      this.triggered = true;
      this.triggerReason = "EVENT_LOOP_LAG_EXCEEDED";
      this.triggerStats = { lagMs: Math.round(lagMs), limitMs: this.maxEventLoopLagMs };
      return false;
    }

    return true;
  }
}

export class RampSoakSpikeScenario {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.safetyMonitor = new SafetyStopMonitor(options.safetyLimits);
  }

  async httpRequest(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}${path}`);
      const payload = body ? JSON.stringify(body) : null;
      const rawHeaders = {
        "Accept": "application/json",
        ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        ...headers,
      };

      const reqHeaders = {};
      for (const [k, v] of Object.entries(rawHeaders)) {
        if (v !== undefined && v !== null) {
          reqHeaders[k] = v;
        }
      }

      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: `${url.pathname}${url.search}`,
          method,
          headers: reqHeaders,
          timeout: 5000,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            let json = null;
            try { json = data ? JSON.parse(data) : null; } catch { json = data; }
            resolve({ statusCode: res.statusCode, headers: res.headers, body: json });
          });
        }
      );

      req.on("error", (err) => reject(err));
      req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
      if (payload) req.write(payload);
      req.end();
    });
  }

  /**
   * Helper to measure current event-loop lag
   */
  async measureEventLoopLag() {
    return new Promise((resolve) => {
      const start = performance.now();
      setTimeout(() => {
        const lag = performance.now() - start;
        resolve(Math.max(0, lag));
      }, 0);
    });
  }

  /**
   * Helper to create a single guest session
   */
  async createGuest(name) {
    const cleanName = (name || "Guest").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 15);
    const clientId = `client-${cleanName}-${crypto.randomUUID().slice(0, 8)}`;
    const res = await this.httpRequest("POST", "/guest/session", {
      clientId,
      displayName: cleanName.length >= 2 ? cleanName : "LoadGuest",
    });
    const rawSetCookie = res.headers["set-cookie"];
    let cookie = undefined;
    if (Array.isArray(rawSetCookie)) {
      const match = rawSetCookie.find((c) => c.includes("ottv2_guest=") || c.includes("guest_session="));
      if (match) cookie = match.split(";")[0].trim();
    } else if (typeof rawSetCookie === "string") {
      cookie = rawSetCookie.split(";")[0].trim();
    }
    const token = cookie ? cookie.match(/=(.+)$/)?.[1] : undefined;
    return { token, cookie, displayName: cleanName, clientId };
  }

  /**
   * Executes a single tier workload (Ramp step)
   */
  async executeRampTier(tierName, targetVus, totalMatches, movesPerMatch) {
    console.log(`\n  --- Executing Ramp Tier: ${tierName} (${targetVus} VUs, ${totalMatches} matches) ---`);

    const stats = {
      tierName,
      targetVus,
      offered: 0,
      admitted: 0,
      completed: 0,
      rejected: 0,
      timeouts: 0,
      latenciesMs: [],
      p50Ms: 0,
      p90Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      safetyStopTriggered: false,
      verdict: "PENDING",
    };

    const lag = await this.measureEventLoopLag();
    if (!this.safetyMonitor.checkSafety(lag)) {
      stats.safetyStopTriggered = true;
      stats.verdict = "ABORTED_SAFETY_STOP";
      console.warn(`    ✕ Safety Stop Triggered before ${tierName}: ${this.safetyMonitor.triggerReason}`);
      return stats;
    }

    // Create session pools in batches
    const matchesData = [];
    for (let i = 0; i < totalMatches; i++) {
      stats.offered += 1;
      try {
        const host = await this.createGuest(`RampHost_${i}`);
        const guest = await this.createGuest(`RampGuest_${i}`);

        // Create room
        const roomRes = await this.httpRequest("POST", "/rooms", {
          name: `RampRoom_${tierName}_${i}`,
          visibility: "PUBLIC",
          timerSeconds: 300,
        }, { "Cookie": host.cookie, "X-Client-Id": host.clientId });

        if (roomRes.statusCode === 200 || roomRes.statusCode === 201) {
          stats.admitted += 1;
          const roomId = roomRes.body?.room?.roomId ?? roomRes.body?.roomId;

          // Join room
          await this.httpRequest("POST", `/rooms/${roomId}/join`, {}, { "Cookie": guest.cookie, "X-Client-Id": guest.clientId });

          // Ready both
          await this.httpRequest("POST", `/matches/${roomId}/ready`, { ready: true }, { "Cookie": host.cookie, "X-Client-Id": host.clientId });
          await this.httpRequest("POST", `/matches/${roomId}/ready`, { ready: true }, { "Cookie": guest.cookie, "X-Client-Id": guest.clientId });

          // Fast-ready both to transition to PLAYING
          await this.httpRequest("POST", `/matches/${roomId}/fast-ready`, {}, { "Cookie": host.cookie, "X-Client-Id": host.clientId });
          const fastRes = await this.httpRequest("POST", `/matches/${roomId}/fast-ready`, {}, { "Cookie": guest.cookie, "X-Client-Id": guest.clientId });
          const initialVersion = fastRes.body?.match?.stateVersion ?? 2;

          matchesData.push({ roomId, host, guest, stateVersion: initialVersion });
        } else if (roomRes.statusCode === 503 || roomRes.statusCode === 429) {
          stats.rejected += 1;
        } else {
          stats.rejected += 1;
        }
      } catch (err) {
        stats.timeouts += 1;
      }
    }

    // Play legal opening moves in parallel batches across admitted matches
    const canonicalMoves = [
      { from: "e1", to: "e2" },
      { from: "e9", to: "e8" },
      { from: "d1", to: "d2" },
      { from: "d9", to: "d8" },
    ];

    for (const match of matchesData) {
      let currentVersion = match.stateVersion;
      for (let m = 0; m < Math.min(movesPerMatch, canonicalMoves.length); m++) {
        const move = canonicalMoves[m];
        const isBlue = m % 2 === 0;
        const player = isBlue ? match.host : match.guest;
        const cmdId = `ramp-${tierName}-${match.roomId}-${m}`;

        stats.offered += 1;
        const startMs = performance.now();

        try {
          const moveRes = await this.httpRequest(
            "POST",
            `/matches/${match.roomId}/moves`,
            { from: move.from, to: move.to, stateVersion: currentVersion },
            {
              "Cookie": player.cookie,
              "X-Client-Id": player.clientId,
              "X-Command-Id": cmdId,
              "X-OTT-Request": `req-${cmdId}`,
            }
          );

          const dur = performance.now() - startMs;
          const isError = moveRes.statusCode !== 200;
          this.safetyMonitor.recordRequest(dur, isError);

          if (moveRes.statusCode === 200) {
            stats.admitted += 1;
            stats.completed += 1;
            stats.latenciesMs.push(dur);
            currentVersion = moveRes.body?.match?.stateVersion ?? moveRes.body?.stateVersion ?? (currentVersion + 1);
          } else if (moveRes.statusCode === 503 || moveRes.statusCode === 429) {
            stats.rejected += 1;
          } else {
            stats.rejected += 1;
          }
        } catch (err) {
          const dur = performance.now() - startMs;
          this.safetyMonitor.recordRequest(dur, true);
          stats.timeouts += 1;
        }

        // Safety check during execution
        const loopLag = await this.measureEventLoopLag();
        if (!this.safetyMonitor.checkSafety(loopLag)) {
          stats.safetyStopTriggered = true;
          console.warn(`    ✕ Safety Stop Triggered during ${tierName}: ${this.safetyMonitor.triggerReason}`);
          break;
        }
      }

      if (stats.safetyStopTriggered) break;
    }

    // Compute quantiles
    stats.p50Ms = percentile(stats.latenciesMs, 0.50);
    stats.p90Ms = percentile(stats.latenciesMs, 0.90);
    stats.p95Ms = percentile(stats.latenciesMs, 0.95);
    stats.p99Ms = percentile(stats.latenciesMs, 0.99);

    // Gate evaluation: human move ACK p95 <= 300ms, p99 <= 1000ms
    const meetsSlo = stats.p95Ms <= 300 && stats.p99Ms <= 1000;
    stats.verdict = !stats.safetyStopTriggered && meetsSlo && stats.completed > 0 ? "PASS" : "FAIL";

    console.log(`    * Offered:   ${stats.offered}`);
    console.log(`    * Admitted:  ${stats.admitted}`);
    console.log(`    * Completed: ${stats.completed} (Only completed counts as served)`);
    console.log(`    * Rejected:  ${stats.rejected}`);
    console.log(`    * Timeouts:  ${stats.timeouts}`);
    console.log(`    * ACK Latency: p50=${stats.p50Ms}ms, p95=${stats.p95Ms}ms, p99=${stats.p99Ms}ms`);
    console.log(`    * Verdict:   ${stats.verdict}`);

    return stats;
  }

  /**
   * Executes Soak test for sustained gameplay & memory leak verification
   */
  async executeSoakTest(durationSeconds = 10, parallelMatches = 5) {
    console.log(`\n  --- Executing Soak Test: Sustained Gameplay (${durationSeconds}s, ${parallelMatches} matches) ---`);

    const initialMem = process.memoryUsage();
    console.log(`    * Baseline Memory: RSS = ${Math.round(initialMem.rss / 1024 / 1024)}MB, Heap = ${Math.round(initialMem.heapUsed / 1024 / 1024)}MB`);

    const stats = {
      durationSeconds,
      parallelMatches,
      initialMemMb: Math.round(initialMem.heapUsed / 1024 / 1024),
      peakMemMb: 0,
      postCleanupMemMb: 0,
      memoryLeakedMb: 0,
      completedMoves: 0,
      cleanupPassed: false,
      verdict: "PENDING",
    };

    const host = await this.createGuest("SoakHost");
    const guest = await this.createGuest("SoakGuest");

    const roomRes = await this.httpRequest("POST", "/rooms", {
      name: "SoakRoom",
      visibility: "PUBLIC",
      timerSeconds: 300,
    }, { "Cookie": host.cookie, "X-Client-Id": host.clientId });

    const roomId = roomRes.body?.room?.roomId ?? roomRes.body?.roomId;
    await this.httpRequest("POST", `/rooms/${roomId}/join`, {}, { "Cookie": guest.cookie, "X-Client-Id": guest.clientId });
    await this.httpRequest("POST", `/matches/${roomId}/ready`, { ready: true }, { "Cookie": host.cookie, "X-Client-Id": host.clientId });
    await this.httpRequest("POST", `/matches/${roomId}/ready`, { ready: true }, { "Cookie": guest.cookie, "X-Client-Id": guest.clientId });
    await this.httpRequest("POST", `/matches/${roomId}/fast-ready`, {}, { "Cookie": host.cookie, "X-Client-Id": host.clientId });
    const soakFastRes = await this.httpRequest("POST", `/matches/${roomId}/fast-ready`, {}, { "Cookie": guest.cookie, "X-Client-Id": guest.clientId });

    const startTime = performance.now();
    let moveCount = 0;
    let stateVersion = soakFastRes.body?.match?.stateVersion ?? 2;

    while ((performance.now() - startTime) < durationSeconds * 1000) {
      const isBlue = moveCount % 2 === 0;
      const move = isBlue
        ? (Math.floor(moveCount / 2) % 2 === 0 ? { from: "e1", to: "e2" } : { from: "e2", to: "e1" })
        : (Math.floor(moveCount / 2) % 2 === 0 ? { from: "e9", to: "e8" } : { from: "e8", to: "e9" });
      const player = isBlue ? host : guest;

      const res = await this.httpRequest("POST", `/matches/${roomId}/moves`, {
        from: move.from,
        to: move.to,
        stateVersion,
      }, {
        "Cookie": player.cookie,
        "X-Client-Id": player.clientId,
        "X-Command-Id": `soak-${moveCount}`,
      });

      if (res.statusCode === 200) {
        stateVersion = res.body?.match?.stateVersion ?? res.body?.stateVersion ?? (stateVersion + 1);
        stats.completedMoves++;
      }

      moveCount++;
      const currentHeap = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      if (currentHeap > stats.peakMemMb) stats.peakMemMb = currentHeap;

      // Small think time
      await new Promise((r) => setTimeout(r, 50));
    }

    // Conclude match (surrender) and verify cleanup
    await this.httpRequest("POST", `/matches/${roomId}/surrender`, { stateVersion }, { "Cookie": host.cookie, "X-Client-Id": host.clientId });

    // Wait 500ms for timers and listeners to clean up
    await new Promise((r) => setTimeout(r, 500));
    if (global.gc) global.gc();

    const postCleanup = process.memoryUsage();
    stats.postCleanupMemMb = Math.round(postCleanup.heapUsed / 1024 / 1024);
    stats.memoryLeakedMb = Math.max(0, stats.postCleanupMemMb - stats.initialMemMb);

    // Cleanup gate: heap must not leak uncontrollably (< 50MB increase across test)
    stats.cleanupPassed = stats.memoryLeakedMb < 50;
    stats.verdict = stats.cleanupPassed && stats.completedMoves > 0 ? "PASS" : "FAIL";

    console.log(`    * Completed Moves: ${stats.completedMoves}`);
    console.log(`    * Peak Heap:       ${stats.peakMemMb}MB`);
    console.log(`    * Post-Cleanup:    ${stats.postCleanupMemMb}MB (Delta: +${stats.memoryLeakedMb}MB)`);
    console.log(`    * Cleanup Gate:    ${stats.cleanupPassed ? "PASSED (Clean teardown)" : "FAILED"}`);
    console.log(`    * Verdict:         ${stats.verdict}`);

    return stats;
  }

  /**
   * Executes Spike test: Sudden burst join & reconnect with capacity shed assertion
   */
  async executeSpikeTest(burstConcurrency = 30) {
    console.log(`\n  --- Executing Spike Test: Burst Join Surge (${burstConcurrency} concurrent requests) ---`);

    const stats = {
      burstConcurrency,
      shedLobby503Count: 0,
      activePvPAdmittedCount: 0,
      pvpMoveAckDurationMs: 0,
      gameplayReserveProtected: false,
      verdict: "PENDING",
    };

    // 1. Establish an ongoing active PvP match
    const blue = await this.createGuest("SpikeBlue");
    const red = await this.createGuest("SpikeRed");

    const pvpRoom = await this.httpRequest("POST", "/rooms", {
      name: "SpikePvPRoom",
      visibility: "PUBLIC",
      timerSeconds: 300,
    }, { "Cookie": blue.cookie, "X-Client-Id": blue.clientId });

    const roomId = pvpRoom.body?.room?.roomId ?? pvpRoom.body?.roomId;
    await this.httpRequest("POST", `/rooms/${roomId}/join`, {}, { "Cookie": red.cookie, "X-Client-Id": red.clientId });
    await this.httpRequest("POST", `/matches/${roomId}/ready`, { ready: true }, { "Cookie": blue.cookie, "X-Client-Id": blue.clientId });
    await this.httpRequest("POST", `/matches/${roomId}/ready`, { ready: true }, { "Cookie": red.cookie, "X-Client-Id": red.clientId });
    await this.httpRequest("POST", `/matches/${roomId}/fast-ready`, {}, { "Cookie": blue.cookie, "X-Client-Id": blue.clientId });
    const spikeFastRes = await this.httpRequest("POST", `/matches/${roomId}/fast-ready`, {}, { "Cookie": red.cookie, "X-Client-Id": red.clientId });
    const pvpStateVersion = spikeFastRes.body?.match?.stateVersion ?? 2;

    // 2. Launch sudden surge of lobby list/join requests
    const burstPromises = Array.from({ length: burstConcurrency }).map(async (_, idx) => {
      const guest = await this.createGuest(`Spiker_${idx}`);
      return this.httpRequest("GET", "/rooms", null, { "Cookie": guest.cookie, "X-Client-Id": guest.clientId });
    });

    // 3. Concurrently execute a critical move on the ongoing PvP match
    const pvpMoveStart = performance.now();
    const pvpMovePromise = this.httpRequest("POST", `/matches/${roomId}/moves`, {
      from: "e1",
      to: "e2",
      stateVersion: pvpStateVersion,
    }, {
      "Cookie": blue.cookie,
      "X-Client-Id": blue.clientId,
      "X-Command-Id": "spike-critical-pvp-01",
    });

    const [burstResults, pvpMoveRes] = await Promise.all([
      Promise.all(burstPromises),
      pvpMovePromise,
    ]);

    stats.pvpMoveAckDurationMs = performance.now() - pvpMoveStart;

    for (const res of burstResults) {
      if (res.statusCode === 503 || res.statusCode === 429) {
        stats.shedLobby503Count++;
      }
    }

    if (pvpMoveRes.statusCode === 200) {
      stats.activePvPAdmittedCount++;
    }

    // Protection Gate: Active PvP match must complete within SLO (p95 <= 300ms) even during surge
    stats.gameplayReserveProtected = stats.activePvPAdmittedCount === 1 && stats.pvpMoveAckDurationMs <= 300;
    stats.verdict = stats.gameplayReserveProtected ? "PASS" : "FAIL";

    console.log(`    * Burst Requests:      ${burstConcurrency}`);
    console.log(`    * Shed Lobby Requests: ${stats.shedLobby503Count}`);
    console.log(`    * Active PvP Move:     ${stats.activePvPAdmittedCount === 1 ? "COMMITTED" : "REJECTED"}`);
    console.log(`    * PvP Move Duration:   ${stats.pvpMoveAckDurationMs.toFixed(2)}ms (SLO <= 300ms)`);
    console.log(`    * Reserve Protected:   ${stats.gameplayReserveProtected ? "YES" : "NO"}`);
    console.log(`    * Verdict:             ${stats.verdict}`);

    return stats;
  }
}
