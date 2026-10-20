/**
 * apps/server/src/modules/capacity/capacity.hook.ts
 *
 * Fastify preHandler admission hook for automated load shedding (FRS-L07 Task L-07.03)
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { CapacityController } from "./capacity.controller.js";
import type { AdmissionPoolType } from "./capacity.types.js";

function classifyRoute(url: string, method: string): { pool?: AdmissionPoolType; isPriority?: boolean; isHealth?: boolean } | null {
  const path = url.split("?", 1)[0] ?? url;

  // 1. Health checks (counts toward recovery probe budget)
  if (path.startsWith("/health")) {
    return { isHealth: true };
  }

  // Bypass diagnostics and static web assets
  if (
    path.startsWith("/diagnostics") ||
    path === "/" ||
    path.startsWith("/assets") ||
    path.startsWith("/favicon")
  ) {
    return null;
  }

  // 2. Active Gameplay Moves (highest priority - protected gameplay reserve)
  if (path.includes("/moves") || path.includes("/referee/")) {
    return { pool: "pvp", isPriority: true };
  }

  // 3. Match Ready & Spectator
  if (path.startsWith("/matches/")) {
    return { pool: "pvp", isPriority: false };
  }

  // 4. Bot Online / Python execution
  if (path.startsWith("/bot-online") || path.startsWith("/bot-library")) {
    return { pool: "python", isPriority: false };
  }

  // 5. Lobby & Matchmaking & History (shed first during PRESSURE)
  if (
    path.startsWith("/rooms") ||
    path.startsWith("/matchmaking") ||
    path.startsWith("/history") ||
    path.startsWith("/profile") ||
    path.startsWith("/social")
  ) {
    return { pool: "lobby", isPriority: false };
  }

  return null;
}

export function registerCapacityAdmissionHook(
  app: FastifyInstance,
  controller: CapacityController
): void {
  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    // Re-evaluate system state periodically or per request
    controller.evaluateMetrics();

    const classification = classifyRoute(request.url, request.method);
    if (!classification) {
      return;
    }

    if (classification.isHealth) {
      controller.recordProbeSuccess();
      return;
    }

    if (!classification.pool) {
      return;
    }

    const principalId =
      (request.headers["x-client-id"] as string | undefined) ||
      (request.headers["x-ott-request"] as string | undefined) ||
      request.ip;

    const acquired = controller.acquire(
      classification.pool,
      principalId,
      classification.isPriority ?? false
    );

    if (!acquired) {
      const decision = controller.checkAdmission(
        classification.pool,
        principalId,
        classification.isPriority ?? false
      );
      const retryAfterSec = Math.max(1, Math.ceil((decision.retryAfterMs ?? 1000) / 1000));
      reply.header("Retry-After", retryAfterSec);

      return reply.status(503).send({
        code: "SERVICE_UNAVAILABLE",
        message: "Hệ thống đang quá tải. Vui lòng chờ.",
        retryable: true,
        severity: "RECOVERABLE",
        details: {
          reason: decision.reason ?? "CAPACITY_EXCEEDED",
          pool: classification.pool,
          retryAfterMs: decision.retryAfterMs ?? 1000,
        },
      });
    }

    (request.raw as { __capacityAcquired?: { pool: AdmissionPoolType; principalId?: string } }).__capacityAcquired = {
      pool: classification.pool,
      principalId,
    };
  });

  const releaseCapacity = (request: FastifyRequest) => {
    const rawReq = request.raw as { __capacityAcquired?: { pool: AdmissionPoolType; principalId?: string } };
    const acquired = rawReq.__capacityAcquired;
    if (acquired) {
      delete rawReq.__capacityAcquired;
      controller.release(acquired.pool, acquired.principalId);
    }
  };

  app.addHook("onResponse", async (request: FastifyRequest) => {
    releaseCapacity(request);
  });

  app.addHook("onError", async (request: FastifyRequest) => {
    releaseCapacity(request);
  });
}
