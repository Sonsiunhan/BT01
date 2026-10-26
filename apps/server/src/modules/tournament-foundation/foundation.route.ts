import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type {
  AuditLogRecordDto,
  CreateTournamentContractInput,
  CreateUnitInput,
  GrantContractTaInput,
  RevokeContractTaInput,
  UpdateTournamentContractInput,
  UpdateUnitInput,
} from "@ottv2/contracts";
import { readCookie } from "../auth/auth.http.js";
import { GUEST_SESSION_COOKIE, type AuthService } from "../auth/auth.service.js";
import {
  assertAdminActor,
  type TournamentActorContext,
  type TournamentStateStore,
} from "./tournament-store.js";
import type { UnitContractService } from "./unit-contract.service.js";

export async function resolveTournamentRequestActor(
  request: FastifyRequest,
  auth: AuthService,
  store: TournamentStateStore
): Promise<TournamentActorContext> {
  const sessionToken = readCookie(request);
  const guestToken = readCookie(request, GUEST_SESSION_COOKIE);
  const context = await auth.authenticateAny(sessionToken, guestToken);
  const correlationId =
    typeof request.headers["x-command-id"] === "string"
      ? request.headers["x-command-id"]
      : undefined;

  const authUser = context.user as any;
  const userRoles: string[] = [];
  if (authUser?.role && typeof authUser.role === "string") {
    userRoles.push(authUser.role);
  }
  if (Array.isArray(authUser?.roles)) {
    for (const r of authUser.roles) {
      if (typeof r === "string") userRoles.push(r);
    }
  }

  return store.resolveAuthoritativeActor({
    userId: context.user.id,
    username: context.user.username,
    principalType: context.principal === "GUEST" ? "GUEST" : "USER",
    roles: userRoles,
    correlationId,
  });
}

export async function registerTournamentFoundationRoutes(
  app: FastifyInstance,
  auth: AuthService,
  store: TournamentStateStore,
  unitContractService: UnitContractService,
  database?: PrismaClient
): Promise<void> {
  // P06: Units Management (/api/admin/units)
  app.get("/api/admin/units", async (request, reply) => {
    const actor = await resolveTournamentRequestActor(request, auth, store);
    assertAdminActor(actor);
    const units = unitContractService.listUnits();
    return reply.status(200).send({ units });
  });

  app.post<{ Body: CreateUnitInput }>("/api/admin/units", async (request, reply) => {
    const actor = await resolveTournamentRequestActor(request, auth, store);
    const unit = await unitContractService.createUnit(actor, request.body);
    return reply.status(201).send({ unit });
  });

  app.patch<{ Params: { unitId: string }; Body: UpdateUnitInput }>(
    "/api/admin/units/:unitId",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const unit = await unitContractService.updateUnit(
        actor,
        request.params.unitId,
        request.body
      );
      return reply.status(200).send({ unit });
    }
  );

  app.delete<{ Params: { unitId: string } }>(
    "/api/admin/units/:unitId",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const result = await unitContractService.deleteUnit(
        actor,
        request.params.unitId
      );
      return reply.status(200).send(result);
    }
  );

  // P07: Contracts Management (/api/admin/contracts)
  app.get<{
    Querystring: { unitId?: string; status?: string; taUserId?: string };
  }>("/api/admin/contracts", async (request, reply) => {
    const actor = await resolveTournamentRequestActor(request, auth, store);
    assertAdminActor(actor);
    await unitContractService.expireContractsIfNeeded();
    const contracts = unitContractService.listContracts(request.query);
    return reply.status(200).send({ contracts });
  });

  app.get<{ Params: { contractId: string } }>(
    "/api/admin/contracts/:contractId",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      assertAdminActor(actor);
      const contract = unitContractService.getContract(request.params.contractId);
      return reply.status(200).send({ contract });
    }
  );

  app.post<{ Body: CreateTournamentContractInput }>(
    "/api/admin/contracts",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const contract = await unitContractService.createContract(
        actor,
        request.body
      );
      return reply.status(201).send({ contract });
    }
  );

  app.patch<{ Params: { contractId: string }; Body: UpdateTournamentContractInput }>(
    "/api/admin/contracts/:contractId",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const contract = await unitContractService.updateContract(
        actor,
        request.params.contractId,
        request.body
      );
      return reply.status(200).send({ contract });
    }
  );

  app.post<{ Params: { contractId: string }; Body: GrantContractTaInput }>(
    "/api/admin/contracts/:contractId/ta-bindings",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const contract = await unitContractService.grantTaBinding(
        actor,
        request.params.contractId,
        request.body
      );
      return reply.status(200).send({ contract });
    }
  );

  app.post<{
    Params: { contractId: string; userId: string };
    Body: RevokeContractTaInput;
  }>(
    "/api/admin/contracts/:contractId/ta-bindings/:userId/revoke",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const contract = await unitContractService.revokeTaBinding(
        actor,
        request.params.contractId,
        request.params.userId,
        request.body
      );
      return reply.status(200).send({ contract });
    }
  );

  // P14: Audit Logs Read Endpoint (/api/admin/audit-logs)
  app.get<{
    Querystring: {
      targetType?:
        | "UNIT"
        | "CONTRACT"
        | "CONTRACT_TA_BINDING"
        | "TOURNAMENT"
        | "CHANGE_REQUEST"
        | "RULE_VERSION"
        | "ADJUDICATION";
      targetId?: string;
      actorUserId?: string;
    };
  }>("/api/admin/audit-logs", async (request, reply) => {
    const actor = await resolveTournamentRequestActor(request, auth, store);
    assertAdminActor(actor);
    const filter = {
      targetType: request.query.targetType,
      targetId: request.query.targetId,
      actorUserId: request.query.actorUserId,
    };

    // With a configured database, the durable TournamentAuditLogRecord table is
    // the authoritative read path (staff/roster/activation modules write there
    // too). In-memory records from this process are merged in by id so records
    // whose write-through has not landed yet remain visible immediately.
    if (database) {
      const where: Record<string, string> = {};
      if (filter.targetType) where.targetType = filter.targetType;
      if (filter.targetId) where.targetId = filter.targetId;
      if (filter.actorUserId) where.actorUserId = filter.actorUserId;
      const rows = await database.tournamentAuditLogRecord.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 1000,
      });
      const dbLogs: AuditLogRecordDto[] = rows.map((row) => ({
        id: row.id,
        actorUserId: row.actorUserId,
        actorRole: row.actorRole as AuditLogRecordDto["actorRole"],
        action: row.action,
        targetType: row.targetType as AuditLogRecordDto["targetType"],
        targetId: row.targetId,
        beforeSnapshot: (row.beforeSnapshot as Record<string, unknown> | null) ?? null,
        afterSnapshot: (row.afterSnapshot as Record<string, unknown> | null) ?? null,
        reason: row.reason ?? null,
        correlationId: row.correlationId ?? null,
        createdAt: row.createdAt.toISOString(),
      }));
      const seenIds = new Set(dbLogs.map((r) => r.id));
      const memoryLogs = store.audit.list(filter).filter((r) => !seenIds.has(r.id));
      const logs = [...dbLogs, ...memoryLogs].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
      return reply.status(200).send({ logs });
    }

    const logs = store.audit.list(filter);
    return reply.status(200).send({ logs });
  });

  // P15: Offline Hub Capabilities & Modes (/api/admin/offline/capabilities)
  app.get("/api/admin/offline/capabilities", async (request, reply) => {
    const actor = await resolveTournamentRequestActor(request, auth, store);
    assertAdminActor(actor);
    return reply.status(200).send({
      capabilities: {
        "offline.hub.read": true,
        "offline.bot.read": true,
        "offline.practice.humanBot": true,
        "offline.practice.humanHuman": true,
      },
      runtime: {
        status: "READY",
        policy: "NO_SERVER_RUNNER",
        isolation: "BROWSER_WORKER_CPYTHON",
      },
      modes: [
        {
          id: "BOT_LIBRARY",
          title: "Kho Bot của tôi",
          description: "Quản lí danh sách mã nguồn Bot cá nhân và theo dõi trạng thái tương thích.",
          route: "/admin/offline/bots",
          status: "ACTIVE",
        },
        {
          id: "BOT_VS_BOT",
          title: "Đấu Bot Offline (Bot – Bot)",
          description: "Môi trường giả lập hai Bot thi đấu đối kháng trực tiếp trong trình duyệt.",
          route: "/dau-chuong-trinh/offline",
          status: "ACTIVE",
        },
        {
          id: "PRACTICE_HUMAN_BOT",
          title: "Phòng tập Người – Bot",
          description: "Môi trường thi đấu luyện tập cục bộ giữa người chơi và Bot Python trong sandbox an toàn.",
          route: "/admin/offline/practice/human-bot",
          status: "ACTIVE",
        },
        {
          id: "PRACTICE_HUMAN_HUMAN",
          title: "Phòng tập Người – Người",
          description: "Chế độ chơi hai người trên cùng một thiết bị với bàn cờ Robot Lab.",
          route: "/admin/offline/practice/human-human",
          status: "ACTIVE",
        },
      ],
    });
  });
}
