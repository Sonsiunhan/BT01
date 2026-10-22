import {
  BindTaContractRequestSchema,
  BootstrapTaRequestSchema,
  ChangePasswordRequestSchema,
  CreateTaAccountRequestSchema,
  LoginRequestSchema,
  RecoverRequestSchema,
  RegisterRequestSchema,
} from "@ottv2/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { AppEnv } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";
import { requireBody, clearSessionCookie, readCookie, setSessionCookie } from "./auth.http.js";
import { AuthService } from "./auth.service.js";

export async function registerAuthRoutes(app: FastifyInstance, service: AuthService, env: AppEnv): Promise<void> {
  const secure = env.NODE_ENV === "production";

  app.post("/auth/register", async (request, reply) => {
    const input = requireBody(request.body, RegisterRequestSchema);
    const result = await service.register(input);
    setSessionCookie(reply, result.token, true, secure);
    return reply.status(201).send({ user: result.user, recoveryCode: result.recoveryCode });
  });

  app.post("/auth/login", async (request, reply) => {
    const input = requireBody(request.body, LoginRequestSchema);
    const result = await service.login(input, request.ip);
    setSessionCookie(reply, result.token, result.remember, secure);
    return reply.status(200).send({ user: result.user });
  });

  app.post("/auth/logout", async (request, reply) => {
    await service.logout(readCookie(request));
    clearSessionCookie(reply, secure);
    return reply.status(204).send();
  });

  app.post("/auth/recover", async (request, reply) => {
    const input = requireBody(request.body, RecoverRequestSchema);
    const result = await service.recover(input, request.ip);
    clearSessionCookie(reply, secure);
    return reply.status(200).send(result);
  });

  app.post("/auth/password", async (request, reply) => {
    const context = await service.authenticate(readCookie(request));
    const input = requireBody(request.body, ChangePasswordRequestSchema);
    await service.changePassword(context, input);
    return reply.status(204).send();
  });

  app.get("/auth/me", async (request, reply) => {
    const context = await service.authenticate(readCookie(request));
    return reply.status(200).send({ user: await service.self(context) });
  });

  const handleBootstrapTa = async (request: FastifyRequest, reply: FastifyReply) => {
    const context = await service.authenticate(readCookie(request));
    if (request.body !== undefined && request.body !== null) {
      requireBody(request.body, BootstrapTaRequestSchema);
    }
    const result = await service.bootstrapTA(context);
    return reply.status(200).send({ user: result });
  };

  app.post("/admin/bootstrap-ta", handleBootstrapTa);
  app.post("/auth/bootstrap-ta", handleBootstrapTa);

  // TA Management Endpoints (D02-B)
  app.get("/admin/ta", async (request, reply) => {
    const context = await service.authenticate(readCookie(request));
    const items = await service.listTA(context);
    return reply.status(200).send({ items });
  });

  app.post("/admin/ta", async (request, reply) => {
    const context = await service.authenticate(readCookie(request));
    const input = requireBody(request.body, CreateTaAccountRequestSchema);
    const user = await service.createTA(context, input);
    return reply.status(201).send({ user });
  });

  app.post("/admin/ta/:taId/bind", async (request, reply) => {
    const context = await service.authenticate(readCookie(request));
    const { taId } = request.params as { taId: string };
    if (!taId) throw new AppError("VALIDATION_ERROR", "taId is required", 400, false, "INVALID");
    const input = requireBody(request.body, BindTaContractRequestSchema);
    const binding = await service.bindTA(context, taId, input);
    return reply.status(200).send({ binding });
  });

  app.delete("/admin/ta/:taId", async (request, reply) => {
    const context = await service.authenticate(readCookie(request));
    const { taId } = request.params as { taId: string };
    if (!taId) throw new AppError("VALIDATION_ERROR", "taId is required", 400, false, "INVALID");
    const result = await service.revokeTA(context, taId);
    return reply.status(200).send(result);
  });
}
