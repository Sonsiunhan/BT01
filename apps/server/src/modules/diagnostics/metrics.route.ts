import { MetricsSnapshotSchema } from "@ottv2/contracts";
import type { FastifyInstance } from "fastify";
import type { AuthService } from "../auth/auth.service.js";
import { MetricsRegistry } from "./metrics.js";
import { assertDiagnosticsAdmin } from "./diagnostics-auth.js";

export async function registerMetricsRoute(
  app: FastifyInstance,
  metrics: MetricsRegistry,
  auth: AuthService
): Promise<void> {
  app.get("/diagnostics/metrics", async (request, reply) => {
    await assertDiagnosticsAdmin(request, auth);
    return reply.status(200).send(MetricsSnapshotSchema.parse(metrics.snapshot()));
  });
}
