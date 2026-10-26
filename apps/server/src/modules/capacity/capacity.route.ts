/**
 * apps/server/src/modules/capacity/capacity.route.ts
 *
 * Exposes GET /diagnostics/capacity for runtime monitoring and runbook inspection.
 */

import type { FastifyInstance } from "fastify";
import type { AuthService } from "../auth/auth.service.js";
import type { CapacityController } from "./capacity.controller.js";
import { assertDiagnosticsAdmin } from "../diagnostics/diagnostics-auth.js";

export async function registerCapacityRoute(
  app: FastifyInstance,
  controller: CapacityController,
  auth: AuthService
): Promise<void> {
  app.get("/diagnostics/capacity", async (request, reply) => {
    await assertDiagnosticsAdmin(request, auth);
    controller.evaluateMetrics();
    const status = controller.getStatus();
    return reply.status(200).send(status);
  });
}
