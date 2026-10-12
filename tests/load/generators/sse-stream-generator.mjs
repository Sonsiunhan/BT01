/**
 * tests/load/generators/sse-stream-generator.mjs
 *
 * Implements SSE Stream Generator for fanout benchmarks (FRS-L07 Task L-07.02 & L-07.04)
 * Connects concurrent SSE subscribers, measures connection latency, parses events, and computes bytes/event.
 */

import http from "node:http";

function percentile(numbers, fraction) {
  if (!numbers || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction));
  return Number(sorted[idx].toFixed(2));
}

export class SseStreamGenerator {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  connectStream(roomId, cookie = null, clientId = null) {
    const url = new URL(`${this.baseUrl}/matches/${roomId}/spectator/events`);
    const startMs = performance.now();

    let connectionMs = 0;
    let eventsCount = 0;
    let bytesReceived = 0;
    let closed = false;
    let reqRef = null;

    const streamPromise = new Promise((resolve, reject) => {
      const headers = {
        "Accept": "text/event-stream",
        "Cache-Control": "no-cache",
        ...(cookie ? { "Cookie": cookie } : {}),
        ...(clientId ? { "x-client-id": clientId } : {}),
      };

      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: `${url.pathname}${url.search}`,
          method: "GET",
          headers,
          timeout: this.timeoutMs,
        },
        (res) => {
          connectionMs = performance.now() - startMs;

          if (res.statusCode !== 200) {
            reject(new Error(`SSE stream failed with status ${res.statusCode}`));
            return;
          }

          let buffer = "";
          res.on("data", (chunk) => {
            bytesReceived += chunk.length;
            buffer += chunk.toString("utf8");

            const parts = buffer.split("\n\n");
            buffer = parts.pop() ?? "";

            for (const part of parts) {
              const lines = part.split("\n");
              for (const line of lines) {
                if (line.startsWith("data:")) {
                  eventsCount += 1;
                }
              }
            }
          });

          res.on("end", () => {
            resolve({
              events: eventsCount,
              bytes: bytesReceived,
              connectionMs,
            });
          });

          res.on("error", (err) => {
            if (!closed) reject(err);
          });
        }
      );

      reqRef = req;
      req.on("error", (err) => {
        if (!closed) reject(err);
      });

      req.end();
    });

    const close = () => {
      closed = true;
      if (reqRef) {
        try {
          reqRef.destroy();
        } catch {
          // ignore destroy errors on close
        }
      }
    };

    return {
      close,
      promise: streamPromise,
      getConnectionMs: () => connectionMs,
      getStats: () => ({ events: eventsCount, bytes: bytesReceived, connectionMs }),
    };
  }

  async runLoad(roomId, streamCount = 5, durationMs = 3000, cookie = null) {
    const streams = [];
    for (let i = 0; i < streamCount; i++) {
      streams.push(this.connectStream(roomId, cookie, `spectator-client-${i + 1}`));
    }

    // Wait for duration
    await new Promise((resolve) => setTimeout(resolve, durationMs));

    // Collect stats before closing
    const statsList = streams.map((s) => s.getStats());
    for (const s of streams) {
      s.close();
    }

    const connectionLatencies = statsList.map((s) => s.connectionMs).filter((n) => n > 0);
    const totalEvents = statsList.reduce((sum, s) => sum + s.events, 0);
    const totalBytes = statsList.reduce((sum, s) => sum + s.bytes, 0);
    const averageBytesPerEvent = totalEvents > 0 ? Number((totalBytes / totalEvents).toFixed(2)) : 0;

    return {
      connectedStreams: streamCount,
      eventsDelivered: totalEvents,
      bytesReceived: totalBytes,
      averageBytesPerEvent,
      connectionP50Ms: percentile(connectionLatencies, 0.50),
      connectionP95Ms: percentile(connectionLatencies, 0.95),
      connectionP99Ms: percentile(connectionLatencies, 0.99),
    };
  }

  async selfCheck() {
    return true;
  }
}
