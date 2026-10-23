import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  CANDIDATE_POLICY_DEFAULTS_V1,
  ClaimActivationRequestSchema,
  IssueActivationTokenRequestSchema,
  RosterCommitRequestSchema,
  RosterPreviewRequestSchema,
  SetupCredentialRequestSchema,
} from "@ottv2/contracts";

import { readCookie, requireBody } from "../auth/auth.http.js";
import type { AuthService } from "../auth/auth.service.js";
import { AppError } from "../../shared/errors/app-error.js";
import { decodeFileBuffer, type RosterService } from "./roster.service.js";
import { ActivationService } from "./activation.service.js";

export async function registerRosterRoutes(
  app: FastifyInstance,
  auth: AuthService,
  service: RosterService,
  activation?: ActivationService,
): Promise<void> {
  const actService =
    activation ?? ((service as any).db ? new ActivationService((service as any).db) : undefined);

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

  // -------------------------------------------------------------------------
  // D05-A Activation Endpoints
  // -------------------------------------------------------------------------

  // Issue activation token (admin / TA only)
  app.post(
    "/admin/roster/activation/issue",
    async (request: FastifyRequest, reply) => {
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
          "Chỉ quản trị hệ thống hoặc quản trị giải đấu được phát hành token kích hoạt.",
          403,
          false,
          "INVALID",
        );
      }

      const input = requireBody(request.body, IssueActivationTokenRequestSchema);
      const targetService = actService;
      if (!targetService) {
        throw new AppError("SERVICE_UNAVAILABLE", "Dịch vụ kích hoạt chưa sẵn sàng.", 503, true, "RECOVERABLE");
      }

      const result = await targetService.issueActivationToken(input, {
        userId: context.user.id,
        role: userRole,
      });

      return reply.status(200).send(result);
    },
  );

  // Claim activation token (participant — public with raw token, NO password)
  app.post(
    "/roster/activation/claim",
    async (request: FastifyRequest, reply) => {
      // Reject plaintext password or secret before schema parse
      const raw = request.body as Record<string, unknown> | undefined;
      if (raw && typeof raw === "object") {
        const forbiddenKeys = ["password", "mat_khau", "matkhau", "pass", "pwd", "secret"];
        if (forbiddenKeys.some((k) => k in raw && raw[k] !== undefined)) {
          throw new AppError(
            "VALIDATION_ERROR",
            "Không chấp nhận trường mật khẩu trong yêu cầu kích hoạt.",
            400,
            false,
            "INVALID",
          );
        }
      }

      const input = requireBody(request.body, ClaimActivationRequestSchema);
      const targetService = actService;
      if (!targetService) {
        throw new AppError("SERVICE_UNAVAILABLE", "Dịch vụ kích hoạt chưa sẵn sàng.", 503, true, "RECOVERABLE");
      }

      const result = await targetService.claimActivation(input);
      return reply.status(200).send(result);
    },
  );

  // Setup credentials (participant — presents claimToken + password)
  app.post(
    "/roster/activation/credential",
    async (request: FastifyRequest, reply) => {
      const input = requireBody(request.body, SetupCredentialRequestSchema);
      const targetService = actService;
      if (!targetService) {
        throw new AppError("SERVICE_UNAVAILABLE", "Dịch vụ kích hoạt chưa sẵn sàng.", 503, true, "RECOVERABLE");
      }

      const result = await targetService.setupCredential(input);
      return reply.status(200).send(result);
    },
  );

  // Setup credentials alias endpoint
  app.post(
    "/roster/activation/setup-credential",
    async (request: FastifyRequest, reply) => {
      const input = requireBody(request.body, SetupCredentialRequestSchema);
      const targetService = actService;
      if (!targetService) {
        throw new AppError("SERVICE_UNAVAILABLE", "Dịch vụ kích hoạt chưa sẵn sàng.", 503, true, "RECOVERABLE");
      }

      const result = await targetService.setupCredential(input);
      return reply.status(200).send(result);
    },
  );

  // Get activation status (admin / TA only)
  if (typeof app.get === "function") {
    app.get(
      "/admin/roster/activation/:enrollmentId",
      async (request: FastifyRequest, reply) => {
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
            "Chỉ quản trị hệ thống hoặc quản trị giải đấu được xem trạng thái kích hoạt.",
            403,
            false,
            "INVALID",
          );
        }

        const enrollmentId = (request.params as any).enrollmentId;
        if (!enrollmentId || typeof enrollmentId !== "string") {
          throw new AppError("VALIDATION_ERROR", "Thiếu enrollmentId.", 400, false, "INVALID");
        }

        const targetService = actService;
        if (!targetService) {
          throw new AppError("SERVICE_UNAVAILABLE", "Dịch vụ kích hoạt chưa sẵn sàng.", 503, true, "RECOVERABLE");
        }

        const result = await targetService.getActivationStatus(enrollmentId, {
          userId: context.user.id,
          role: userRole,
        });

        return reply.status(200).send(result);
      },
    );

    const listHandler = async (request: FastifyRequest, reply: any) => {
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
      if (userRole !== "SYSTEM_ADMIN" && userRole !== "TOURNAMENT_ADMIN") {
        throw new AppError(
          "UNAUTHORIZED",
          "Chỉ quản trị hệ thống hoặc quản trị giải đấu được xem danh sách thí sinh.",
          403,
          false,
          "INVALID",
        );
      }

      const tournamentId = (request.params as { tournamentId?: unknown }).tournamentId;
      if (typeof tournamentId !== "string" || !tournamentId) {
        throw new AppError("VALIDATION_ERROR", "Thiếu tournamentId.", 400, false, "INVALID");
      }

      const enrollments = await service.listEnrollments(tournamentId);
      return reply.status(200).send({ tournamentId, enrollments });
    };

    app.get("/admin/tournaments/:tournamentId/roster", listHandler);
    app.get("/admin/roster/:tournamentId", listHandler);
  }
}
