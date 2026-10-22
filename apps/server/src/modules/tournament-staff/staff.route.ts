import type { FastifyInstance, FastifyRequest } from "fastify";
import { AuthService } from "../auth/auth.service.js";
import { GUEST_SESSION_COOKIE, readCookie } from "../auth/auth.http.js";
import { AppError } from "../../shared/errors/app-error.js";
import { TournamentStaffService } from "./staff.service.js";

async function accountActor(request: FastifyRequest, auth: AuthService): Promise<{ userId: string }> {
  const sessionToken = readCookie(request);
  const guestToken = readCookie(request, GUEST_SESSION_COOKIE);
  const context = await auth.authenticateAny(sessionToken, guestToken);
  if (context.principal !== "ACCOUNT") {
    throw new AppError("UNAUTHORIZED", "Account authentication is required", 401, false, "INVALID");
  }
  return { userId: context.user.id };
}

export function registerTournamentStaffRoutes(
  app: FastifyInstance,
  auth: AuthService,
  service: TournamentStaffService,
): void {
  app.get<{ Params: { tournamentId: string } }>("/api/tournaments/:tournamentId/staff", async (request, reply) => {
    const actor = await accountActor(request, auth);
    return reply.send(await service.list(actor, request.params.tournamentId));
  });

  app.post<{ Params: { tournamentId: string }; Body: unknown }>(
    "/api/tournaments/:tournamentId/staff/invitations",
    async (request, reply) => {
      const actor = await accountActor(request, auth);
      const result = await service.createInvitation(actor, request.params.tournamentId, request.body);
      return reply.code(result.replayed ? 200 : 201).send(result);
    },
  );

  app.get<{ Params: { tournamentId: string } }>(
    "/api/tournaments/:tournamentId/staff/readiness",
    async (request, reply) => {
      const actor = await accountActor(request, auth);
      await service.assertOwnerForRoute(actor, request.params.tournamentId);
      return reply.send(await service.getRefereeReadiness(request.params.tournamentId));
    },
  );

  app.post<{ Params: { tournamentId: string } }>(
    "/api/tournaments/:tournamentId/staff/invitations/expire",
    async (request, reply) => {
      const actor = await accountActor(request, auth);
      return reply.send(await service.expirePendingInvitations(actor, request.params.tournamentId));
    },
  );

  app.post<{ Params: { tournamentId: string; assignmentId: string } }>(
    "/api/tournaments/:tournamentId/staff/assignments/:assignmentId/revoke",
    async (request, reply) => {
      const actor = await accountActor(request, auth);
      return reply.send(await service.revokeAssignment(actor, request.params.tournamentId, request.params.assignmentId));
    },
  );

  app.get<{ Params: { tournamentId: string; token: string } }>(
    "/api/tournaments/:tournamentId/staff/invitations/:token",
    async (request, reply) => {
      const actor = await accountActor(request, auth);
      return reply.send(await service.viewRecipient(actor, {
        tournamentId: request.params.tournamentId,
        token: request.params.token,
      }));
    },
  );

  app.post<{ Params: { tournamentId: string; token: string } }>(
    "/api/tournaments/:tournamentId/staff/invitations/:token/accept",
    async (request, reply) => {
      const actor = await accountActor(request, auth);
      return reply.send(await service.acceptInvitation(actor, {
        tournamentId: request.params.tournamentId,
        token: request.params.token,
      }));
    },
  );

  app.post<{ Params: { tournamentId: string; token: string } }>(
    "/api/tournaments/:tournamentId/staff/invitations/:token/reject",
    async (request, reply) => {
      const actor = await accountActor(request, auth);
      return reply.send(await service.rejectInvitation(actor, {
        tournamentId: request.params.tournamentId,
        token: request.params.token,
      }));
    },
  );
}
