import { describe, expect, it } from "vitest";
import { MetricsRegistry, normalizeRoutePath } from "../../src/modules/diagnostics/metrics.js";

describe("L07-W1: MetricsRegistry Bounded Cardinality & Quantiles (L-07.01)", () => {
  it("normalizes dynamic IDs into parameterized template paths", () => {
    expect(normalizeRoutePath("/matches/123e4567-e89b-12d3-a456-426614174000/moves")).toBe("/matches/:id/moves");
    expect(normalizeRoutePath("/rooms/room-abc-xyz/join")).toBe("/rooms/:id/join");
    expect(normalizeRoutePath("/users/user-12345/profile")).toBe("/users/:id/profile");
    expect(normalizeRoutePath("/matches/match-42-test/events?cursor=1")).toBe("/matches/:id/events");
    expect(normalizeRoutePath("/health")).toBe("/health");
  });

  it("strictly bounds route label cardinality to MAX_ROUTES (100) preventing memory exhaustion", () => {
    const metrics = new MetricsRegistry();

    // Generate 150 unique paths
    for (let i = 0; i < 150; i++) {
      metrics.observeHttp("GET", `/distinct-route-${i}`, 200, 5);
    }

    const snapshot = metrics.snapshot();
    // Route count must not exceed 101 (100 routes + 1 fallback "OTHER /*")
    expect(snapshot.routes.length).toBeLessThanOrEqual(101);

    const otherRoute = snapshot.routes.find((r) => r.method === "OTHER" && r.path === "/*");
    expect(otherRoute).toBeDefined();
    expect(otherRoute?.count).toBeGreaterThanOrEqual(50);
  });

  it("calculates accurate latency percentiles: p50, p90, p95, p99", () => {
    const metrics = new MetricsRegistry();
    // Insert 100 samples with latencies 1ms to 100ms
    for (let i = 1; i <= 100; i++) {
      metrics.observeHttp("POST", "/matches/:id/moves", 200, i);
    }

    const snapshot = metrics.snapshot();
    const route = snapshot.routes.find((r) => r.path === "/matches/:id/moves");
    expect(route).toBeDefined();
    expect(route?.count).toBe(100);
    expect(route?.p50Ms).toBe(50);
    expect(route?.p90Ms).toBe(90);
    expect(route?.p95Ms).toBe(95);
    expect(route?.p99Ms).toBe(99);
  });

  it("captures system resource utilization and event loop lag", () => {
    const metrics = new MetricsRegistry();
    metrics.observeHttp("GET", "/health", 200, 2);

    const snapshot = metrics.snapshot();
    expect(snapshot.resources).toBeDefined();
    expect(snapshot.resources?.rssBytes).toBeGreaterThan(0);
    expect(snapshot.resources?.heapUsedBytes).toBeGreaterThan(0);
    expect(snapshot.resources?.eventLoopLagMs).toBeGreaterThanOrEqual(0);
  });

  it("tracks SSE fanout events, bytes transferred, and averageBytesPerEvent", () => {
    const metrics = new MetricsRegistry();
    metrics.streamOpened();
    metrics.streamOpened();
    expect(metrics.snapshot().activeStreams).toBe(2);

    metrics.recordFanout(10, 3000); // 10 events, 3000 bytes
    const snapshot = metrics.snapshot();
    expect(snapshot.fanoutEvents).toBe(10);
    expect(snapshot.fanoutBytes).toBe(3000);
    expect(snapshot.averageBytesPerEvent).toBe(300);

    metrics.streamClosed();
    expect(metrics.snapshot().activeStreams).toBe(1);
  });
});
