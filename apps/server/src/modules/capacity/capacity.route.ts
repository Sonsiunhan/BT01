/**
 * apps/server/src/modules/capacity/capacity.route.ts
 *
 * Exposes GET /diagnostics/capacity for runtime monitoring and runbook inspection.
 */

import type { FastifyInstance } from "fastify";
import type { CapacityController } from "./capacity.controller.js";

export async function registerCapacityRoute(
  app: FastifyInstance,
  controller: CapacityController
): Promise<void> {
  app.get("/diagnostics/capacity", async (_request, reply) => {
    controller.evaluateMetrics();
    const status = controller.getStatus();
    return reply.status(200).send(status);
  });
}
