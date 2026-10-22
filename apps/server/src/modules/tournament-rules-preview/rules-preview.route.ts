import type { FastifyInstance } from "fastify";
import { TournamentRulePreviewRequestSchema } from "@ottv2/contracts";

import { AppError } from "../../shared/errors/app-error.js";
import { requireBody, readCookie } from "../auth/auth.http.js";
import { AuthService } from "../auth/auth.service.js";
import { TournamentRulesPreviewService } from "./rules-preview.service.js";

function tournamentIdFrom(request: { params: unknown }): string {
  const value = (request.params as { tournamentId?: unknown } | undefined)?.tournamentId;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError("VALIDATION_ERROR", "tournamentId là bắt buộc.", 400, false, "INVALID");
  }
  return value;
}

export async function registerTournamentRulesPreviewRoutes(
  app: FastifyInstance,
  auth: AuthService,
  service: TournamentRulesPreviewService,
): Promise<void> {
  app.post("/tournaments/:tournamentId/rule-profile/validate-preview", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    const tournamentId = tournamentIdFrom(request);
    const input = requireBody(request.body, TournamentRulePreviewRequestSchema);
    const result = await service.preview(context, tournamentId, input);
    return reply.status(200).send(result);
  });
}
