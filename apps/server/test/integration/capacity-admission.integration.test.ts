import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { CapacityController } from "../../src/modules/capacity/capacity.controller.js";
import type { DatabasePort } from "../../src/plugins/prisma.js";
import { DisabledRealtimeAdapter } from "../../src/realtime/disabled.adapter.js";
import type { AppEnv } from "../../src/config/env.js";

const env: AppEnv = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 3001,
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgresql://user:password@localhost:5432/ottv2_test",
  CORS_ORIGINS: "http://localhost:5173",
  REALTIME_ADAPTER: "disabled",
  corsOrigins: ["http://localhost:5173"],
};

const mockDb: DatabasePort = {
  check: async () => 1,
  close: async () => {},
};

describe("Capacity Admission Integration Tests (L-07.03)", () => {
  let app: FastifyInstance;
  let capacity: CapacityController;

  beforeEach(async () => {
    capacity = new CapacityController({
      thresholds: {
        highEventLoopLagMs: 50,
        lowEventLoopLagMs: 20,
        highHeapPercent: 85,
        lowHeapPercent: 70,
        highRssBytes: 1024 * 1024 * 1024,
        lowRssBytes: 800 * 1024 * 1024,
        cooldownPeriodMs: 5000,
        recoveryProbeBudget: 3,
        reconnectJitterMaxMs: 1000,
      },
    });

    app = await buildApp({
      env,
      database: mockDb,
      realtime: new DisabledRealtimeAdapter(),
      capacityController: capacity,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it("exposes GET /diagnostics/capacity with system status", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/diagnostics/capacity",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.state).toBe("NORMAL");
    expect(body.pools.lobby).toBeDefined();
    expect(body.pools.pvp).toBeDefined();
    expect(body.pools.python).toBeDefined();
  });

  it("always allows health checks even during system PRESSURE", async () => {
    // Force into PRESSURE
    capacity.evaluateMetrics({
      eventLoopLagMs: 60,
      heapPercent: 50,
      rssBytes: 200_000_000,
    });
    expect(capacity.getState()).toBe("PRESSURE");

    // Health endpoint must continue responding with 200
    const healthRes = await app.inject({
      method: "GET",
      url: "/health",
    });
    expect(healthRes.statusCode).toBe(200);

    // Diagnostics must also remain accessible
    const diagRes = await app.inject({
      method: "GET",
      url: "/diagnostics/capacity",
    });
    expect(diagRes.statusCode).toBe(200);
    expect(diagRes.json().state).toBe("PRESSURE");
  });

  it("sheds lobby requests with 503 SERVICE_UNAVAILABLE and Retry-After header during PRESSURE", async () => {
    // Force into PRESSURE
    capacity.evaluateMetrics({
      eventLoopLagMs: 65,
      heapPercent: 50,
      rssBytes: 200_000_000,
    });
    expect(capacity.getState()).toBe("PRESSURE");

    // Attempting to access lobby / rooms
    const res = await app.inject({
      method: "GET",
      url: "/rooms",
      headers: {
        "x-client-id": "client-test-1",
      },
    });

    expect(res.statusCode).toBe(503);
    expect(res.headers["retry-after"]).toBeDefined();
    const body = res.json();
    expect(body.code).toBe("SERVICE_UNAVAILABLE");
    expect(body.retryable).toBe(true);
    expect(body.details.reason).toBe("SYSTEM_PRESSURE_LOBBY_SHED");
  });
});
