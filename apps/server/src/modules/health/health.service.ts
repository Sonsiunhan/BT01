import {
  APPLICATION_VERSION,
  PROTOCOL_VERSION,
  type HealthComponent,
  type HealthResponse,
  type ComponentHealthResponse,
  type ServiceStatus,
} from "@ottv2/contracts";

import type { DatabasePort } from "../../plugins/prisma.js";
import type { RealtimePort } from "../../realtime/realtime.port.js";

const DATABASE_HEALTH_TIMEOUT_MS = 5_000;

async function databaseComponent(database: DatabasePort): Promise<HealthComponent> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    const latencyMs = await Promise.race([
      database.check(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("database health timeout")), DATABASE_HEALTH_TIMEOUT_MS);
      })
    ]);
    return { status: "ok", latencyMs };
  } catch {
    return { status: "degraded", reason: "unreachable" };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export type BotHealthProbe = () => Promise<HealthComponent> | HealthComponent;
export type TransportHealthProbe = () => Promise<HealthComponent> | HealthComponent;

export class HealthService {
  constructor(
    private readonly database: DatabasePort,
    private readonly realtime: RealtimePort,
    private readonly botProbe?: BotHealthProbe,
    private readonly transportProbe?: TransportHealthProbe
  ) {}

  async getHealth(): Promise<HealthResponse> {
    const database = await databaseComponent(this.database);
    const realtime = this.realtime.getStatus();
    const transportStatus: ServiceStatus = realtime.status === "ok" ? "ok" : "degraded";
    const transport: HealthComponent = this.transportProbe
      ? await this.transportProbe()
      : {
          status: transportStatus,
          ...(realtime.reason ? { reason: realtime.reason } : {}),
        };
    const bot: HealthComponent = this.botProbe
      ? await this.botProbe()
      : { status: "ok", reason: "standalone-or-unprobed" };

    const status: ServiceStatus =
      database.status === "ok" &&
      realtime.status === "ok" &&
      transport.status === "ok"
        ? "ok"
        : "degraded";

    return {
      status,
      service: "ottv2-server",
      version: APPLICATION_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      timestamp: new Date().toISOString(),
      components: {
        application: { status: "ok" },
        database,
        realtime,
        transport,
        bot,
      }
    };
  }

  async getApplicationHealth(): Promise<ComponentHealthResponse> {
    return {
      status: "ok",
      component: "application",
      service: "ottv2-server",
      timestamp: new Date().toISOString(),
      details: { status: "ok" },
    };
  }

  async getDatabaseHealth(): Promise<ComponentHealthResponse> {
    const details = await databaseComponent(this.database);
    return {
      status: details.status,
      component: "database",
      service: "ottv2-server",
      timestamp: new Date().toISOString(),
      details,
    };
  }

  async getTransportHealth(): Promise<ComponentHealthResponse> {
    const realtime = this.realtime.getStatus();
    const defaultStatus: ServiceStatus = realtime.status === "ok" ? "ok" : "degraded";
    const details: HealthComponent = this.transportProbe
      ? await this.transportProbe()
      : {
          status: defaultStatus,
          ...(realtime.reason ? { reason: realtime.reason } : {}),
        };
    return {
      status: details.status,
      component: "transport",
      service: "ottv2-server",
      timestamp: new Date().toISOString(),
      details,
    };
  }

  async getBotHealth(): Promise<ComponentHealthResponse> {
    const details: HealthComponent = this.botProbe
      ? await this.botProbe()
      : { status: "ok", reason: "standalone-or-unprobed" };
    return {
      status: details.status,
      component: "bot",
      service: "ottv2-server",
      timestamp: new Date().toISOString(),
      details,
    };
  }
}
