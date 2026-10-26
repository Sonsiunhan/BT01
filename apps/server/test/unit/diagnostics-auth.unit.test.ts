import { describe, expect, it, vi } from "vitest";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { AuthService } from "../../src/modules/auth/auth.service.js";
import { MetricsRegistry } from "../../src/modules/diagnostics/metrics.js";
import { registerMetricsRoute } from "../../src/modules/diagnostics/metrics.route.js";
import { assertDiagnosticsAdmin } from "../../src/modules/diagnostics/diagnostics-auth.js";
import { registerTournamentCoreRoutes } from "../../src/modules/tournament-core/tournament-core.route.js";
import { TournamentStateStore } from "../../src/modules/tournament-foundation/tournament-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

function fakeAuth(
  context:
    | { kind: "admin" }
    | { kind: "player" }
    | { kind: "guest" }
    | { kind: "anonymous" }
): AuthService {
  const impl = async () => {
    if (context.kind === "anonymous") {
      throw Object.assign(new Error("Bạn cần đăng nhập để tiếp tục."), { statusCode: 401 });
    }
    if (context.kind === "guest") {
      return {
        session: { id: "guest-session:1" },
        user: { id: "guest:1", role: null },
        principal: "GUEST",
      };
    }
    if (context.kind === "player") {
      return {
        session: { id: "s-1" },
        user: { id: "player-1", role: "USER", roles: [] },
        principal: "ACCOUNT",
      };
    }
    return {
      session: { id: "s-admin" },
      user: { id: "admin-1", role: "SYSTEM_ADMIN", roles: ["SYSTEM_ADMIN"] },
      principal: "ACCOUNT",
    };
  };
  return { authenticateAny: vi.fn(impl) } as unknown as AuthService;
}

function fakeRequest(headers: Record<string, string> = {}): FastifyRequest {
  return { headers, url: "/diagnostics/metrics", method: "GET" } as unknown as FastifyRequest;
}

describe("diagnostics — guard quản trị viên (P14/A4)", () => {
  it("admin (ACCOUNT + role SYSTEM_ADMIN) đọc được metrics", async () => {
    const handlers = new Map<string, Handler>();
    const app = {
      get: (path: string, handler: Handler) => handlers.set(`GET ${path}`, handler),
    } as unknown as FastifyInstance;
    await registerMetricsRoute(app, new MetricsRegistry(), fakeAuth({ kind: "admin" }));

    const handler = handlers.get("GET /diagnostics/metrics")!;
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as unknown as FastifyReply;
    await handler(fakeRequest(), reply);
    expect(reply.status).toHaveBeenCalledWith(200);
  });

  it("người chơi thường bị chặn 403, guest bị chặn 403", async () => {
    const handlers = new Map<string, Handler>();
    const app = {
      get: (path: string, handler: Handler) => handlers.set(`GET ${path}`, handler),
    } as unknown as FastifyInstance;
    await registerMetricsRoute(app, new MetricsRegistry(), fakeAuth({ kind: "player" }));

    const handler = handlers.get("GET /diagnostics/metrics")!;
    await expect(handler(fakeRequest(), {} as FastifyReply)).rejects.toMatchObject({
      statusCode: 403,
    });

    const guestHandlers = new Map<string, Handler>();
    const guestApp = {
      get: (path: string, handler: Handler) => guestHandlers.set(`GET ${path}`, handler),
    } as unknown as FastifyInstance;
    await registerMetricsRoute(guestApp, new MetricsRegistry(), fakeAuth({ kind: "guest" }));
    await expect(
      (guestHandlers.get("GET /diagnostics/metrics")!)(fakeRequest(), {} as FastifyReply)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("vô danh bị authenticateAny từ chối 401", async () => {
    const handlers = new Map<string, Handler>();
    const app = {
      get: (path: string, handler: Handler) => handlers.set(`GET ${path}`, handler),
    } as unknown as FastifyInstance;
    await registerMetricsRoute(app, new MetricsRegistry(), fakeAuth({ kind: "anonymous" }));

    const handler = handlers.get("GET /diagnostics/metrics")!;
    await expect(handler(fakeRequest(), {} as FastifyReply)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("assertDiagnosticsAdmin chặn guest dù guest mang roles giả mạo", async () => {
    const guestAuth = {
      authenticateAny: vi.fn(async () => ({
        session: { id: "guest-session:1" },
        user: { id: "guest:1", role: "SYSTEM_ADMIN", roles: ["SYSTEM_ADMIN"] },
        principal: "GUEST",
      })),
    } as unknown as AuthService;
    await expect(assertDiagnosticsAdmin(fakeRequest(), guestAuth)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

describe("tournament-core route — leaderboard/matches yêu cầu quyền xem vận hành", () => {
  function buildRouteHarness(actorContext: {
    userId: string;
    roles: string[];
    principalType?: "USER" | "GUEST";
  }) {
    const store = {
      resolveAuthoritativeActor: (params: {
        userId: string;
        roles?: string[];
        principalType?: "USER" | "GUEST";
      }) => ({
        userId: params.userId,
        roles: params.roles ?? [],
        principalType: params.principalType ?? "USER",
      }),
      staffAssignments: new Map(),
    } as unknown as TournamentStateStore;

    const auth =
      actorContext.roles.length > 0 || actorContext.principalType === "GUEST"
        ? ({
            authenticateAny: vi.fn(async () => ({
              session: { id: "s-1" },
              user: { id: actorContext.userId },
              principal: actorContext.principalType === "GUEST" ? "GUEST" : "ACCOUNT",
            })),
          } as unknown as AuthService)
        : ({
            authenticateAny: vi.fn(async () => {
              throw Object.assign(new Error("Bạn cần đăng nhập để tiếp tục."), { statusCode: 401 });
            }),
          } as unknown as AuthService);

    const tournament = {
      id: "tour-1",
      ownerTaUserId: "ta-1",
    };
    const coreDraftService = {
      getTournament: vi.fn(() => tournament),
    };
    const adjudicationLedgerService = {
      computeLeaderboardSnapshot: vi.fn(() => ({ tournamentId: "tour-1", standings: [] })),
      getLedgerEntries: vi.fn(() => []),
    };
    const handlers = new Map<string, Handler>();
    const app = {
      get: (path: string, handler: Handler) => handlers.set(`GET ${path}`, handler),
      post: (path: string, handler: Handler) => handlers.set(`POST ${path}`, handler),
      patch: (path: string, handler: Handler) => handlers.set(`PATCH ${path}`, handler),
      delete: (path: string, handler: Handler) => handlers.set(`DELETE ${path}`, handler),
    } as unknown as FastifyInstance;

    registerTournamentCoreRoutes(app, auth, store, {
      coreDraftService: coreDraftService as never,
      approvalService: {} as never,
      lifecycleService: {} as never,
      admissionGateService: {} as never,
      adjudicationLedgerService: adjudicationLedgerService as never,
    });

    return { handlers, coreDraftService, adjudicationLedgerService };
  }

  it("TA sở hữu giải đọc được leaderboard", async () => {
    const { handlers, adjudicationLedgerService } = buildRouteHarness({
      userId: "ta-1",
      roles: ["TOURNAMENT_ADMIN"],
    });
    const handler = handlers.get("GET /api/tournaments/:tournamentId/leaderboard")!;
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as unknown as FastifyReply;
    await handler(
      { params: { tournamentId: "tour-1" }, headers: {} } as unknown as FastifyRequest,
      reply
    );
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(adjudicationLedgerService.computeLeaderboardSnapshot).toHaveBeenCalledWith("tour-1");
  });

  it("người dùng ngoài bị chặn 403 và không đọc được ledger", async () => {
    const { handlers, adjudicationLedgerService } = buildRouteHarness({
      userId: "random-player",
      roles: ["PLAYER"],
    });
    const handler = handlers.get("GET /api/tournaments/:tournamentId/matches")!;
    await expect(
      handler(
        { params: { tournamentId: "tour-1" }, headers: {} } as unknown as FastifyRequest,
        {} as FastifyReply
      )
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(adjudicationLedgerService.getLedgerEntries).not.toHaveBeenCalled();
  });

  it("vô danh bị 401 trước khi đụng vào dữ liệu", async () => {
    const { handlers, adjudicationLedgerService } = buildRouteHarness({
      userId: "",
      roles: [],
    });
    const handler = handlers.get("GET /api/tournaments/:tournamentId/leaderboard")!;
    await expect(
      handler(
        { params: { tournamentId: "tour-1" }, headers: {} } as unknown as FastifyRequest,
        {} as FastifyReply
      )
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(adjudicationLedgerService.computeLeaderboardSnapshot).not.toHaveBeenCalled();
  });
});
