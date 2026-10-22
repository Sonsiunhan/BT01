import type { FastifyInstance, FastifyRequest } from "fastify";
import { AuthService } from "../auth/auth.service.js";
import { GUEST_SESSION_COOKIE, readCookie } from "../auth/auth.http.js";
import { AppError } from "../../shared/errors/app-error.js";
import {
  D07SupportRequestStatusSchema,
  type D07SupportRequestStatus,
} from "@ottv2/contracts";
import { SupportRecoveryService, type SupportRecoveryActor } from "./support.service.js";

async function optionalAccountActor(
  request: FastifyRequest,
  auth: AuthService,
): Promise<SupportRecoveryActor | null> {
  const accountToken = readCookie(request);
  const guestToken = readCookie(request, GUEST_SESSION_COOKIE);
  if (!accountToken && !guestToken) return null;
  try {
    const context = await auth.authenticateAny(accountToken, guestToken);
    if (context.principal !== "ACCOUNT") return null;
    return {
      userId: context.user.id,
      role: String((context.user as any).role ?? "USER"),
    };
  } catch {
    // The public endpoint deliberately keeps the account-enumeration response generic.
    return null;
  }
}

async function operatorActor(
  request: FastifyRequest,
  auth: AuthService,
): Promise<SupportRecoveryActor> {
  const accountToken = readCookie(request);
  const guestToken = readCookie(request, GUEST_SESSION_COOKIE);
  const context = await auth.authenticateAny(accountToken, guestToken);
  if (context.principal !== "ACCOUNT") {
    throw new AppError("UNAUTHORIZED", "Account authentication is required", 401, false, "INVALID");
  }
  return {
    userId: context.user.id,
    role: String((context.user as any).role ?? "USER"),
  };
}

export function registerSupportRecoveryRoutes(
  app: FastifyInstance,
  auth: AuthService,
  service: SupportRecoveryService,
): void {
  app.post<{ Body: unknown }>(
    "/api/account-access/recovery-requests",
    async (request, reply) => {
      const actor = await optionalAccountActor(request, auth);
      await service.createRequest(actor, request.body, request.ip);
      // Always return the same public envelope regardless of whether the account exists.
      return reply.code(202).send({ accepted: true });
    },
  );

  app.post<{ Body: unknown }>(
    "/api/account-access/recovery/reset",
    async (request, reply) => {
      const result = await service.consumeRecoveryToken(request.body, request.ip);
      return reply.send(result);
    },
  );

  app.get<{ Querystring: { status?: string } }>(
    "/api/admin/support/recovery-requests",
    async (request) => {
      const actor = await operatorActor(request, auth);
      let status: D07SupportRequestStatus | undefined;
      if (request.query.status) {
        const parsed = D07SupportRequestStatusSchema.safeParse(request.query.status);
        if (!parsed.success) {
          throw new AppError("VALIDATION_ERROR", "Trạng thái hàng đợi không hợp lệ.", 400, false, "INVALID", { issues: parsed.error.issues });
        }
        status = parsed.data;
      }
      return service.listRequests(actor, status);
    },
  );

  app.get<{ Params: { requestId: string } }>(
    "/api/admin/support/recovery-requests/:requestId",
    async (request) => service.getRequest(await operatorActor(request, auth), request.params.requestId),
  );

  app.post<{ Params: { requestId: string }; Body: unknown }>(
    "/api/admin/support/recovery-requests/:requestId/transition",
    async (request) => service.transitionRequest(
      await operatorActor(request, auth),
      request.params.requestId,
      request.body,
    ),
  );

  app.post<{ Params: { requestId: string } }>(
    "/api/admin/support/recovery-requests/:requestId/reset-token",
    async (request) => service.issueResetToken(await operatorActor(request, auth), request.params.requestId),
  );
}
