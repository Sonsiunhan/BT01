import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  CANDIDATE_POLICY_DEFAULTS_V1,
  RosterCommitRequestSchema,
  RosterPreviewRequestSchema,
} from "@ottv2/contracts";

import { readCookie, requireBody } from "../auth/auth.http.js";
import type { AuthService } from "../auth/auth.service.js";
import { AppError } from "../../shared/errors/app-error.js";
import { decodeFileBuffer, type RosterService } from "./roster.service.js";

export async function registerRosterRoutes(
  app: FastifyInstance,
  auth: AuthService,
  service: RosterService,
): Promise<void> {
  // Preview endpoint (D03 - read only, no commits)
  app.post(
    "/admin/roster/preview",
    { bodyLimit: Math.ceil((CANDIDATE_POLICY_DEFAULTS_V1.rosterImportMaxBytes * 4) / 3) + 64 * 1024 },
    async (request: FastifyRequest, reply) => {
      // 1. Authenticate and enforce administrative authorization
      const cookie = readCookie(request);
      const context = await auth.authenticate(cookie);

      if (context.principal !== "ACCOUNT") {
        throw new AppError(
          "UNAUTHORIZED",
          "Vui lòng đăng nhập bằng tài khoản quản trị.",
          401,
          false,
          "FATAL_SESSION",
        );
      }

      const userRole = context.user.role;
      const isSystemAdmin = userRole === "SYSTEM_ADMIN";
      const isTournamentAdmin = userRole === "TOURNAMENT_ADMIN";

      if (!isSystemAdmin && !isTournamentAdmin) {
        throw new AppError(
          "UNAUTHORIZED",
          "Chỉ quản trị hệ thống hoặc quản trị giải đấu được xem trước danh sách.",
          403,
          false,
          "INVALID",
        );
      }

      // 2. Parse request input
      let buffer: Buffer;
      let fileName: string;
      let allowedUnits = await service.readAllowedUnits(context.user.id, userRole);
      let maxRows: number | undefined;

      if (Buffer.isBuffer(request.body)) {
        buffer = request.body;
        fileName =
          (request.headers["x-file-name"] as string) ||
          (request.query as any)?.fileName ||
          "roster.csv";
      } else {
        const input = requireBody(request.body, RosterPreviewRequestSchema);
        fileName = input.fileName;
        buffer = decodeFileBuffer(input.fileContent, fileName);
        // Client filters may narrow the persisted scope, but cannot grant access.
        if (input.allowedUnits) {
          const requested = new Set(input.allowedUnits.map((unit) => unit.trim().toUpperCase()));
          allowedUnits = allowedUnits.filter((unit) => requested.has(unit.trim().toUpperCase()));
        }
        maxRows = input.maxRows;
      }

      // 3. Execute preview (never writes to DB)
      const result = await service.previewRoster(buffer, fileName, {
        allowedUnits,
        ...(maxRows !== undefined ? { maxRows } : {}),
      });

      return reply.status(200).send(result);
    },
  );

  // Commit endpoint (D04-A - transactional import commit & idempotency boundary)
  app.post(
    "/admin/roster/commit",
    { bodyLimit: Math.ceil((CANDIDATE_POLICY_DEFAULTS_V1.rosterImportMaxBytes * 4) / 3) + 64 * 1024 },
    async (request: FastifyRequest, reply) => {
      // 1. Authenticate and enforce administrative authorization
      const cookie = readCookie(request);
      const context = await auth.authenticate(cookie);

      if (context.principal !== "ACCOUNT") {
        throw new AppError(
          "UNAUTHORIZED",
          "Vui lòng đăng nhập bằng tài khoản quản trị.",
          401,
          false,
          "FATAL_SESSION",
        );
      }

      const userRole = context.user.role;
      const isSystemAdmin = userRole === "SYSTEM_ADMIN";
      const isTournamentAdmin = userRole === "TOURNAMENT_ADMIN";

      if (!isSystemAdmin && !isTournamentAdmin) {
        throw new AppError(
          "UNAUTHORIZED",
          "Chỉ quản trị hệ thống hoặc quản trị giải đấu được thực hiện import danh sách.",
          403,
          false,
          "INVALID",
        );
      }

      // 2. Parse request input
      const input = requireBody(request.body, RosterCommitRequestSchema);

      // 3. Execute transactional commit with idempotency
      const result = await service.commitRosterImport(input, {
        userId: context.user.id,
        role: userRole,
      });

      return reply.status(200).send(result);
    },
  );
}
