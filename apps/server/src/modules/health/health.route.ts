import { ComponentHealthResponseSchema, HealthResponseSchema } from "@ottv2/contracts";
import type { FastifyInstance } from "fastify";

import type { HealthService } from "./health.service.js";

export async function registerHealthRoute(app: FastifyInstance, service: HealthService): Promise<void> {
  // 1. Consolidated Health Check (aggregates all components)
  app.get("/health", async (_request, reply) => {
    const response = HealthResponseSchema.parse(await service.getHealth());
    return reply.status(200).send(response);
  });

  // 2. Segregated Application Liveness Check
  app.get("/health/app", async (_request, reply) => {
    const response = ComponentHealthResponseSchema.parse(await service.getApplicationHealth());
    return reply.status(200).send(response);
  });

  app.get("/health/liveness", async (_request, reply) => {
    const response = ComponentHealthResponseSchema.parse(await service.getApplicationHealth());
    return reply.status(200).send(response);
  });

  // 3. Segregated Database Readiness Check (503 on degraded / unreachable)
  app.get("/health/db", async (_request, reply) => {
    const response = ComponentHealthResponseSchema.parse(await service.getDatabaseHealth());
    const statusCode = response.status === "ok" ? 200 : 503;
    return reply.status(statusCode).send(response);
  });

  // 4. Segregated Transport Readiness Check (503 on degraded)
  app.get("/health/transport", async (_request, reply) => {
    const response = ComponentHealthResponseSchema.parse(await service.getTransportHealth());
    const statusCode = response.status === "ok" ? 200 : 503;
    return reply.status(statusCode).send(response);
  });

  // 5. Segregated Bot Runtime Readiness Check (503 on degraded / unavailable)
  app.get("/health/bot", async (_request, reply) => {
    const response = ComponentHealthResponseSchema.parse(await service.getBotHealth());
    const statusCode = response.status === "ok" ? 200 : 503;
    return reply.status(statusCode).send(response);
  });
}
