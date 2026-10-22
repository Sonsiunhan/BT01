import type { FastifyInstance } from "fastify";
import {
  BotReadinessRecheckRequestSchema,
  BotReadinessSelectionRequestSchema,
  BotReadinessStatusSchema,
  BotProofModeSchema,
} from "@ottv2/contracts";
import { requireBody } from "../auth/auth.http.js";
import type { AuthService } from "../auth/auth.service.js";
import { resolveTournamentRequestActor } from "../tournament-foundation/foundation.route.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { TournamentStateStore } from "../tournament-foundation/tournament-store.js";
import { BotReadinessService } from "./bot-readiness.service.js";

function assertOperator(actor: Awaited<ReturnType<typeof resolveTournamentRequestActor>>): void {
  if (!actor.roles.includes("ADMIN") && !actor.roles.includes("TOURNAMENT_ADMIN")) {
    throw new AppError("UNAUTHORIZED", "Chỉ quản trị giải mới được xem bảng trạng thái Bot.", 403, false, "FATAL_SESSION", { reason: "TOURNAMENT_ADMIN_REQUIRED" });
  }
}

export async function registerBotReadinessRoutes(app: FastifyInstance, auth: AuthService, store: TournamentStateStore, service: BotReadinessService): Promise<void> {
  app.get<{ Params: { tournamentId: string }; Querystring: { status?: string; cursor?: string; limit?: string } }>("/api/tournaments/:tournamentId/bot-readiness", async (request, reply) => {
    const actor = await resolveTournamentRequestActor(request, auth, store);
    assertOperator(actor);
    service.assertDashboardAccess(actor, request.params.tournamentId);
    const status = request.query.status ? BotReadinessStatusSchema.parse(request.query.status) : undefined;
    const options: { status?: typeof status; cursor?: string; limit?: number } = {};
    if (status) options.status = status;
    if (request.query.cursor) options.cursor = request.query.cursor;
    if (request.query.limit) options.limit = Number(request.query.limit);
    const snapshot = service.getSnapshot(request.params.tournamentId, options);
    return reply.status(200).send({ snapshot });
  });

  app.put<{ Params: { tournamentId: string; enrollmentId: string } }>("/api/tournaments/:tournamentId/enrollments/:enrollmentId/bot", async (request, reply) => {
    const actor = await resolveTournamentRequestActor(request, auth, store);
    const body = requireBody(request.body, BotReadinessSelectionRequestSchema);
    const result = await service.selectBot(actor, request.params.tournamentId, request.params.enrollmentId, body);
    return reply.status(200).send({ item: result, job: result.job });
  });

  app.post<{ Params: { tournamentId: string } }>("/api/tournaments/:tournamentId/bot-readiness/rechecks", async (request, reply) => {
    const actor = await resolveTournamentRequestActor(request, auth, store);
    const body = requireBody(request.body, BotReadinessRecheckRequestSchema);
    const result = await service.requestRecheck(actor, request.params.tournamentId, body);
    return reply.status(202).send({ item: result, job: result.job });
  });

  app.get<{ Params: { tournamentId: string; jobId: string } }>("/api/tournaments/:tournamentId/bot-readiness/jobs/:jobId", async (request, reply) => {
    const actor = await resolveTournamentRequestActor(request, auth, store);
    assertOperator(actor);
    service.assertDashboardAccess(actor, request.params.tournamentId);
    const job = service.getJob(request.params.jobId);
    if (job.tournamentId !== request.params.tournamentId) throw new AppError("NOT_FOUND", "Không tìm thấy lượt kiểm tra bot.", 404, false, "INVALID");
    return reply.status(200).send({ job });
  });

  app.post<{ Params: { tournamentId: string }; Body: { mode: string; enrollmentIds: string[] } }>("/api/tournaments/:tournamentId/bot-readiness/proofs", async (request, reply) => {
    const actor = await resolveTournamentRequestActor(request, auth, store);
    assertOperator(actor);
    service.assertDashboardAccess(actor, request.params.tournamentId);
    const mode = BotProofModeSchema.parse(request.body?.mode);
    const enrollmentIds = Array.isArray(request.body?.enrollmentIds) ? request.body.enrollmentIds : [];
    const proof = await service.runProof(actor, request.params.tournamentId, mode, enrollmentIds);
    return reply.status(200).send({ proof });
  });
}
