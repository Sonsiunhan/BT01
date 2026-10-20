/**
 * tests/load/generators/gameplay-http-generator.mjs
 *
 * Implements Gameplay HTTP Generator with Legal Moves & Idempotency (FRS-L07 Task L-07.02 & L-07.04)
 * Generates valid moves, tests idempotency replays, measures ACK latency, and provides self-check.
 */

import http from "node:http";
import crypto from "node:crypto";

function percentile(numbers, fraction) {
  if (!numbers || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction));
  return Number(sorted[idx].toFixed(2));
}

export class GameplayHttpGenerator {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.thinkTimeMs = options.thinkTimeMs ?? 20;

    this.stats = {
      offered: 0,
      admitted: 0,
      committed: 0,
      rejected: 0,
      timeouts: 0,
      idempotentRetriesChecked: 0,
      idempotentRetriesPassed: 0,
      latenciesMs: [],
    };
  }

  async httpRequest(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}${path}`);
      const payload = body ? JSON.stringify(body) : null;

      const reqHeaders = {
        "Accept": "application/json",
        ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        ...headers,
      };

      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: `${url.pathname}${url.search}`,
          method,
          headers: reqHeaders,
          timeout: this.timeoutMs,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            let json = null;
            try {
              json = data ? JSON.parse(data) : null;
            } catch {
              json = data;
            }
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: json,
            });
          });
        }
      );

      req.on("error", (err) => reject(err));
      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`Request timeout after ${this.timeoutMs}ms`));
      });

      if (payload) req.write(payload);
      req.end();
    });
  }

  /**
   * Generates a predefined canonical opening sequence of legal moves
   */
  getOpeningMoves() {
    return [
      { from: "e1", to: "e2" }, // Turn 1 (BLUE)
      { from: "e9", to: "e8" }, // Turn 2 (RED)
      { from: "d1", to: "d2" }, // Turn 3 (BLUE)
      { from: "d9", to: "d8" }, // Turn 4 (RED)
      { from: "f1", to: "f2" }, // Turn 5 (BLUE)
      { from: "f9", to: "f8" }, // Turn 6 (RED)
      { from: "e2", to: "e3" }, // Turn 7 (BLUE)
      { from: "e8", to: "e7" }, // Turn 8 (RED)
      { from: "d2", to: "d3" }, // Turn 9 (BLUE)
      { from: "d8", to: "d7" }, // Turn 10 (RED)
    ];
  }

  async executeMove(roomId, side, move, stateVersion, cookie, commandId = null) {
    const cmdId = commandId ?? crypto.randomUUID();
    const headers = {
      "X-OTT-Request": `req-${cmdId}`,
      "X-Client-Id": `client-${side.toLowerCase()}`,
      ...(cookie ? { "Cookie": cookie } : {}),
    };

    const payload = {
      from: move.from,
      to: move.to,
      stateVersion,
    };

    this.stats.offered += 1;
    const startMs = performance.now();

    try {
      const res = await this.httpRequest("POST", `/matches/${roomId}/moves`, payload, headers);
      const elapsedMs = performance.now() - startMs;

      if (res.statusCode === 200) {
        this.stats.admitted += 1;
        this.stats.committed += 1;
        this.stats.latenciesMs.push(elapsedMs);
      } else if (res.statusCode === 503 || res.statusCode === 429) {
        this.stats.rejected += 1;
      } else {
        this.stats.admitted += 1; // Reached server logic (even if 400 validation)
      }

      return {
        statusCode: res.statusCode,
        body: res.body,
        durationMs: elapsedMs,
        commandId: cmdId,
      };
    } catch (err) {
      this.stats.timeouts += 1;
      return {
        statusCode: 504,
        error: err.message,
        durationMs: performance.now() - startMs,
        commandId: cmdId,
      };
    }
  }

  async testIdempotencyRetry(roomId, side, move, stateVersion, cookie, commandId) {
    this.stats.idempotentRetriesChecked += 1;
    const retryRes = await this.executeMove(roomId, side, move, stateVersion, cookie, commandId);

    // Idempotent retry must return 200 without changing outcome
    if (retryRes.statusCode === 200) {
      this.stats.idempotentRetriesPassed += 1;
      return true;
    }
    return false;
  }

  getMetricsSummary() {
    const lats = this.stats.latenciesMs;
    return {
      offered: this.stats.offered,
      admitted: this.stats.admitted,
      committed: this.stats.committed,
      rejected: this.stats.rejected,
      timeouts: this.stats.timeouts,
      idempotentRetriesChecked: this.stats.idempotentRetriesChecked,
      idempotentRetriesPassed: this.stats.idempotentRetriesPassed,
      idempotencyPassRatePercent:
        this.stats.idempotentRetriesChecked > 0
          ? Number(((this.stats.idempotentRetriesPassed / this.stats.idempotentRetriesChecked) * 100).toFixed(1))
          : 100,
      p50Ms: percentile(lats, 0.50),
      p90Ms: percentile(lats, 0.90),
      p95Ms: percentile(lats, 0.95),
      p99Ms: percentile(lats, 0.99),
    };
  }

  async selfCheck() {
    // Quick self-verification checking endpoint responsiveness
    try {
      const res = await this.httpRequest("GET", "/health");
      return res.statusCode === 200;
    } catch {
      return false;
    }
  }
}
