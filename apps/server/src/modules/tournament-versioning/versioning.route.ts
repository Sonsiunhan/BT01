import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  PublishRuleVersionInputSchema,
  PublishRuleVersionResponseSchema,
  RuleVersionDiffResponseSchema,
  RuleVersionListResponseSchema,
  type PublishRuleVersionInput,
  type PublishRuleVersionResponse,
  type RuleVersionDiffResponse,
  type RuleVersionListResponse,
} from "@ottv2/contracts";

import { AppError } from "../../shared/errors/app-error.js";
import { readCookie } from "../auth/auth.http.js";
import type { AuthContext, AuthService } from "../auth/auth.service.js";
import type { RuleVersionListQuery, TournamentVersioningPort } from "./versioning.port.js";
export type { TournamentVersioningPort } from "./versioning.port.js";

function requireTournamentId(request: FastifyRequest): string {
  const tournamentId = (request.params as { tournamentId?: unknown } | undefined)?.tournamentId;
  if (typeof tournamentId !== "string" || tournamentId.trim().length === 0) {
    throw new AppError("VALIDATION_ERROR", "tournamentId là bắt buộc.", 400, false, "INVALID");
  }
  return tournamentId;
}

function parseListQuery(request: FastifyRequest): RuleVersionListQuery {
  const query = (request.query as { cursor?: unknown; limit?: unknown } | undefined) ?? {};
  const rawLimit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
    throw new AppError("VALIDATION_ERROR", "limit phải là số nguyên trong khoảng 1..100.", 400, false, "INVALID");
  }
  if (query.cursor !== undefined && (typeof query.cursor !== "string" || query.cursor.length > 256)) {
    throw new AppError("VALIDATION_ERROR", "cursor không hợp lệ.", 400, false, "INVALID");
  }
  return query.cursor === undefined
    ? { limit: rawLimit }
    : { limit: rawLimit, cursor: query.cursor };
}

function requireVersioningActor(context: AuthContext): void {
  const role = (context.user as unknown as { role?: unknown }).role;
  if (context.principal !== "ACCOUNT" || !["TOURNAMENT_ADMIN", "SYSTEM_ADMIN"].includes(String(role))) {
    throw new AppError("UNAUTHORIZED", "Tài khoản không có quyền quản lý phiên bản luật.", 403, false, "INVALID");
  }
}

export async function registerTournamentRuleVersionRoutes(
  app: FastifyInstance,
  auth: AuthService,
  port: TournamentVersioningPort,
): Promise<void> {
  app.get<{ Params: { tournamentId: string }; Querystring: { cursor?: string; limit?: string } }>(
    "/tournaments/:tournamentId/rule-versions",
    async (request, reply) => {
      const context = await auth.authenticate(readCookie(request));
      requireVersioningActor(context);
      const result = await port.listVersions(context, requireTournamentId(request), parseListQuery(request));
      return reply.status(200).send(RuleVersionListResponseSchema.parse(result));
    },
  );

  app.get<{ Params: { tournamentId: string; versionId: string }; Querystring: { against?: string } }>(
    "/tournaments/:tournamentId/rule-versions/:versionId/diff",
    async (request, reply) => {
      const context = await auth.authenticate(readCookie(request));
      requireVersioningActor(context);
      const params = request.params;
      if (!params.versionId?.trim()) {
        throw new AppError("VALIDATION_ERROR", "versionId là bắt buộc.", 400, false, "INVALID");
      }
      const result = await port.diffVersions(context, requireTournamentId(request), params.versionId, request.query.against);
      return reply.status(200).send(RuleVersionDiffResponseSchema.parse(result));
    },
  );

  app.post<{ Params: { tournamentId: string }; Body: PublishRuleVersionInput }>(
    "/tournaments/:tournamentId/rule-versions/publish",
    async (request, reply) => {
      const context = await auth.authenticate(readCookie(request));
      requireVersioningActor(context);
      const input = PublishRuleVersionInputSchema.parse(request.body);
      const result = await port.publish(context, input, requireTournamentId(request));
      return reply.status(result.outcome === "PUBLISHED" ? 201 : 202).send(PublishRuleVersionResponseSchema.parse(result));
    },
  );
}
