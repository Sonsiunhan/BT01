import type { FastifyInstance } from "fastify";
import { readCookie } from "../auth/auth.http.js";
import type { AuthService } from "../auth/auth.service.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { TournamentAcknowledgementService } from "./acknowledgement.service.js";

/** Integration-ready; app.ts registration intentionally belongs to Long. */
export function registerTournamentAcknowledgementRoutes(app: FastifyInstance, auth: AuthService, service: TournamentAcknowledgementService): void {
  const url = "/api/contracts/:contractId/tournaments/:tournamentId/rules-ack";
  type Scope = { contractId: string; tournamentId: string };
  app.get<{ Params: Scope }>(url, async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    if (context.principal !== "ACCOUNT") throw new AppError("UNAUTHORIZED", "Vui lòng đăng nhập bằng tài khoản thí sinh.", 401, false, "FATAL_SESSION");
    reply.header("Cache-Control", "no-store");
    return service.status({ userId: context.user.id, principal: context.principal }, request.params);
  });
  app.post<{ Params: Scope; Body: unknown }>(url, { bodyLimit: 4096 }, async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    if (context.principal !== "ACCOUNT") throw new AppError("UNAUTHORIZED", "Vui lòng đăng nhập bằng tài khoản thí sinh.", 401, false, "FATAL_SESSION");
    reply.header("Cache-Control", "no-store");
    return service.acknowledge({ userId: context.user.id, principal: context.principal }, request.params, request.body);
  });
}
