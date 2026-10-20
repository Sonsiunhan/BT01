import {
  ComponentHealthResponseSchema,
  HealthResponseSchema,
  SystemInventorySchema,
} from "@ottv2/contracts";
import { describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";
import type { AppEnv } from "../../src/config/env.js";
import type { DatabasePort } from "../../src/plugins/prisma.js";
import { DisabledRealtimeAdapter } from "../../src/realtime/disabled.adapter.js";

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

function database(check: DatabasePort["check"]): DatabasePort {
  return { check, close: async () => {} };
}

describe("L07-W1: Segregated Health & Diagnostics Routes (L-06A.01, L-07.01)", () => {
  it("GET /health returns consolidated health response", async () => {
    const app = await buildApp({
      env,
      database: database(async () => 3),
      realtime: new DisabledRealtimeAdapter(),
    });
    const response = await app.inject({ method: "GET", url: "/health" });
    const health = HealthResponseSchema.parse(response.json());
    expect(response.statusCode).toBe(200);
    expect(health.components.database).toEqual({ status: "ok", latencyMs: 3 });
    expect(health.components.application.status).toBe("ok");
    expect(health.components.transport).toBeDefined();
    await app.close();
  });

  it("GET /health/app and /health/liveness verify application process liveness", async () => {
    const app = await buildApp({
      env,
      database: database(async () => 1),
      realtime: new DisabledRealtimeAdapter(),
    });

    const resApp = await app.inject({ method: "GET", url: "/health/app" });
    expect(resApp.statusCode).toBe(200);
    const bodyApp = ComponentHealthResponseSchema.parse(resApp.json());
    expect(bodyApp.component).toBe("application");
    expect(bodyApp.status).toBe("ok");

    const resLiveness = await app.inject({ method: "GET", url: "/health/liveness" });
    expect(resLiveness.statusCode).toBe(200);
    const bodyLiveness = ComponentHealthResponseSchema.parse(resLiveness.json());
    expect(bodyLiveness.status).toBe("ok");

    await app.close();
  });

  it("GET /health/db returns 200 on healthy database and 503 on failure without credential leakage", async () => {
    // 1. Healthy database check
    const healthyApp = await buildApp({
      env,
      database: database(async () => 4),
      realtime: new DisabledRealtimeAdapter(),
    });
    const resOk = await healthyApp.inject({ method: "GET", url: "/health/db" });
    expect(resOk.statusCode).toBe(200);
    const bodyOk = ComponentHealthResponseSchema.parse(resOk.json());
    expect(bodyOk.component).toBe("database");
    expect(bodyOk.status).toBe("ok");
    expect(bodyOk.details.latencyMs).toBe(4);
    await healthyApp.close();

    // 2. Degraded database check
    const marker = "postgresql://secret-user:super-secret-password@db.local:5432/db";
    const degradedApp = await buildApp({
      env,
      database: database(async () => {
        throw new Error(marker);
      }),
      realtime: new DisabledRealtimeAdapter(),
    });
    const resFail = await degradedApp.inject({ method: "GET", url: "/health/db" });
    expect(resFail.statusCode).toBe(503);
    expect(resFail.body).not.toContain(marker);
    const bodyFail = ComponentHealthResponseSchema.parse(resFail.json());
    expect(bodyFail.component).toBe("database");
    expect(bodyFail.status).toBe("degraded");
    expect(bodyFail.details.reason).toBe("unreachable");
    await degradedApp.close();
  });

  it("GET /health/transport checks transport readiness", async () => {
    const app = await buildApp({
      env,
      database: database(async () => 1),
      realtime: new DisabledRealtimeAdapter(),
    });
    const response = await app.inject({ method: "GET", url: "/health/transport" });
    const body = ComponentHealthResponseSchema.parse(response.json());
    expect(body.component).toBe("transport");
    expect(response.statusCode).toBe(503); // degraded because DisabledRealtimeAdapter
    await app.close();
  });

  it("GET /health/bot checks bot runtime readiness", async () => {
    const app = await buildApp({
      env,
      database: database(async () => 1),
      realtime: new DisabledRealtimeAdapter(),
    });
    const response = await app.inject({ method: "GET", url: "/health/bot" });
    const body = ComponentHealthResponseSchema.parse(response.json());
    expect(body.component).toBe("bot");
    expect(response.statusCode).toBe(503); // degraded because Wasmtime runtime unconfigured in default test
    await app.close();
  });

  it("GET /diagnostics/inventory exports system inventory with ownership and no secret leaks", async () => {
    const app = await buildApp({
      env,
      database: database(async () => 2),
      realtime: new DisabledRealtimeAdapter(),
    });
    const response = await app.inject({ method: "GET", url: "/diagnostics/inventory" });
    expect(response.statusCode).toBe(200);

    const inventory = SystemInventorySchema.parse(response.json());
    expect(inventory.service).toBe("ottv2-server");
    expect(inventory.nodeVersion).toBe(process.version);
    expect(inventory.platform).toBe(process.platform);

    // Verify component ownership mapping
    expect(inventory.components.application.owner).toContain("Long");
    expect(inventory.components.database.owner).toContain("Long");
    expect(inventory.components.transport.owner).toContain("Long");
    expect(inventory.components.bot.owner).toContain("Nam");

    // Verify zero credential leaks in environment keys
    const serialized = JSON.stringify(inventory);
    expect(serialized).not.toMatch(/postgresql:\/\/[^:]+:[^@]+@/i);
    expect(serialized).not.toContain("super-secret-password");

    await app.close();
  });

  it("uses the public envelope for unknown routes", async () => {
    const app = await buildApp({
      env,
      database: database(async () => 1),
      realtime: new DisabledRealtimeAdapter(),
    });
    const response = await app.inject({ method: "GET", url: "/missing" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      code: "NOT_FOUND",
      retryable: false,
      severity: "INVALID",
      details: {},
    });
    await app.close();
  });
});
