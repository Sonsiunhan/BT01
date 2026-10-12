import {
  APPLICATION_VERSION,
  PROTOCOL_VERSION,
  type SystemInventory,
} from "@ottv2/contracts";

import type { HealthService } from "../health/health.service.js";

export class InventoryService {
  private readonly startedAt = new Date().toISOString();

  constructor(private readonly healthService?: HealthService) {}

  async getInventory(): Promise<SystemInventory> {
    const health = this.healthService ? await this.healthService.getHealth() : null;

    // Filter environment variable keys to prevent any secret or value leakage
    const environmentKeys = Object.keys(process.env).sort();

    const components: SystemInventory["components"] = {
      application: {
        status: "ok",
        owner: "Long (App Core & Lifecycle)",
        latencyMs: 0,
        details: "Node.js Fastify HTTP/SSE application server",
      },
      database: {
        status: health?.components?.database?.status === "ok" ? "ok" : "degraded",
        owner: "Long (Prisma & PostgreSQL Persistence)",
        latencyMs: health?.components?.database?.latencyMs,
        details: health?.components?.database?.reason ?? "PostgreSQL relational persistence",
      },
      transport: {
        status: health?.components?.transport?.status === "ok" ? "ok" : "degraded",
        owner: "Long (HTTP/SSE Transport & Backpressure Hub)",
        details: health?.components?.transport?.reason ?? "Server-Sent Events & Fastify HTTP",
      },
      bot: {
        status: health?.components?.bot?.status === "ok" ? "ok" : "degraded",
        owner: "Nam (Wasmtime Python Runtime Sandbox)",
        details: health?.components?.bot?.reason ?? "Wasmtime + CPython WASI / Pyodide sandbox",
      },
    };

    return {
      service: "ottv2-server",
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      packageVersion: APPLICATION_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      startedAt: this.startedAt,
      uptimeSeconds: Number(process.uptime().toFixed(1)),
      environmentKeys,
      components,
      build: {
        gitCommit: process.env.GIT_COMMIT ?? "main@dbda8a9",
        buildTime: process.env.BUILD_TIME ?? new Date().toISOString(),
      },
    };
  }
}
