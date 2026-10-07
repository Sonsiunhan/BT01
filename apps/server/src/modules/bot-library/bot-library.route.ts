import { BotLibraryCreateRequestSchema, BotRevisionCreateRequestSchema } from "@ottv2/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";

import { requireBody, readCookie } from "../auth/auth.http.js";
import { GUEST_SESSION_COOKIE, type AuthService } from "../auth/auth.service.js";
import { AppError } from "../../shared/errors/app-error.js";
import { BotLibraryService } from "./bot-library.service.js";

async function accountId(auth: AuthService, request: FastifyRequest): Promise<string> {
  const context = await auth.authenticate(readCookie(request));
  if (context.principal !== "ACCOUNT") throw new AppError("UNAUTHORIZED", "Thư viện chiến thuật chỉ dành cho tài khoản.", 401, false, "FATAL_SESSION");
  return context.user.id;
}

export async function registerBotLibraryRoutes(app: FastifyInstance, auth: AuthService, library: BotLibraryService): Promise<void> {
  // Explicit Guest staging is separate from the account cloud library. Ignore
  // an account cookie here: an ongoing Guest match keeps its original owner.
  const guestId = async (request: FastifyRequest) => {
    const context = await auth.authenticateAny(undefined, readCookie(request, GUEST_SESSION_COOKIE));
    if (context.principal !== "GUEST") throw new AppError("UNAUTHORIZED", "Cần phiên Guest hợp lệ.", 401, false, "FATAL_SESSION");
    return context.user.id;
  };
  app.get("/guest/bot-library", async (request, reply) => reply.send(await library.list(await guestId(request))));
  app.delete("/guest/bot-library/staging", async (request, reply) => { await library.clearGuestStaging(await guestId(request)); return reply.status(204).send(); });
  app.post("/guest/bot-library/stage", async (request, reply) => {
    const input = requireBody(request.body, BotLibraryCreateRequestSchema);
    return reply.send(await library.stageGuest(await guestId(request), input.name, input.source));
  });
  app.post<{ Params: { botId: string; revisionId: string } }>("/guest/bot-library/bots/:botId/revisions/:revisionId/test", async (request, reply) => reply.send(await library.testRevision(await guestId(request), request.params.botId, request.params.revisionId)));
  app.get("/bot-library", async (request, reply) => reply.status(200).send(await library.list(await accountId(auth, request))));
  app.get("/bot-library/sdk", async (_request, reply) => reply.status(200).send(library.sdkDocs()));
  app.get<{ Params: { botId: string; revisionId: string } }>("/bot-library/bots/:botId/revisions/:revisionId/source", async (request, reply) => reply.status(200).send({ botId: request.params.botId, revisionId: request.params.revisionId, source: await library.source(await accountId(auth, request), request.params.botId, request.params.revisionId) }));
  app.post("/bot-library/bots", async (request, reply) => {
    const input = requireBody(request.body, BotLibraryCreateRequestSchema);
    return reply.status(201).send(await library.createBot(await accountId(auth, request), input.name, input.source));
  });
  app.post<{ Params: { botId: string } }>("/bot-library/bots/:botId/revisions", async (request, reply) => {
    const input = requireBody(request.body, BotRevisionCreateRequestSchema);
    return reply.status(201).send(await library.createRevision(await accountId(auth, request), request.params.botId, input.source));
  });
  app.post<{ Params: { botId: string; revisionId: string } }>("/bot-library/bots/:botId/revisions/:revisionId/test", async (request, reply) => reply.status(200).send(await library.testRevision(await accountId(auth, request), request.params.botId, request.params.revisionId)));
  app.delete<{ Params: { botId: string; revisionId: string } }>("/bot-library/bots/:botId/revisions/:revisionId", async (request, reply) => { await library.deleteRevision(await accountId(auth, request), request.params.botId, request.params.revisionId); return reply.status(204).send(); });
}
