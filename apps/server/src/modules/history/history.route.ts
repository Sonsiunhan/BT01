import { HistoryQuerySchema } from "@ottv2/contracts";
import type { FastifyInstance } from "fastify";

import { requireBody, readCookie } from "../auth/auth.http.js";
import type { AuthService } from "../auth/auth.service.js";
import { MatchHistoryService } from "./history.service.js";

export async function registerHistoryRoutes(app: FastifyInstance, auth: AuthService, history: MatchHistoryService): Promise<void> {
  app.get("/history", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    const query = requireBody(request.query ?? {}, HistoryQuerySchema);
    return reply.status(200).send(await history.list(context.user.id, query));
  });

  app.get<{ Params: { matchId: string } }>("/history/:matchId", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    return reply.status(200).send(await history.detail(context.user.id, request.params.matchId));
  });

  app.get<{ Params: { matchId: string } }>("/history/:matchId/audit", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    const audit = await history.audit(context.user.id, request.params.matchId);
    return reply.header("content-disposition", `attachment; filename=ottv2-audit-${request.params.matchId}.json`).type("application/json; charset=utf-8").status(200).send(audit);
  });
}
