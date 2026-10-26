import { describe, expect, it, vi } from "vitest";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { AuthService } from "../../src/modules/auth/auth.service.js";
import { SanitizingAuditService } from "../../src/modules/tournament-foundation/audit.port.js";
import { registerTournamentFoundationRoutes } from "../../src/modules/tournament-foundation/foundation.route.js";
import type { TournamentStateStore } from "../../src/modules/tournament-foundation/tournament-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

/**
 * Harness tối giản cho route audit-logs: bắt handler đăng ký trên FastifyInstance giả,
 * gọi trực tiếp với query để kiểm tra chính việc nối tham số -> bộ lọc.
 */
async function buildAuditLogsHarness() {
  const audit = new SanitizingAuditService();
  const store = {
    resolveAuthoritativeActor: (params: {
      userId: string;
      username?: string;
      principalType?: "USER" | "GUEST";
      roles?: string[];
      correlationId?: string;
    }) => ({
      userId: params.userId,
      roles: ["ADMIN"],
      principalType: "USER" as const,
      correlationId: params.correlationId,
    }),
    audit,
  } as unknown as TournamentStateStore;

  const auth = {
    authenticateAny: vi.fn(async () => ({
      user: { id: "admin-1", username: "admin01" },
      principal: "ACCOUNT",
    })),
  } as unknown as AuthService;

  const handlers = new Map<string, Handler>();
  const app = {
    get: (path: string, handler: Handler) => handlers.set(`GET ${path}`, handler),
    post: (path: string, handler: Handler) => handlers.set(`POST ${path}`, handler),
    patch: (path: string, handler: Handler) => handlers.set(`PATCH ${path}`, handler),
    delete: (path: string, handler: Handler) => handlers.set(`DELETE ${path}`, handler),
  } as unknown as FastifyInstance;

  // Route audit-logs không đụng vào unitContractService trong thân handler.
  await registerTournamentFoundationRoutes(app, auth, store, {} as never);

  const handler = handlers.get("GET /api/admin/audit-logs");
  if (!handler) throw new Error("missing GET /api/admin/audit-logs handler");

  async function call(query: Record<string, string>) {
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as unknown as FastifyReply;
    const request = { query, headers: {} } as unknown as FastifyRequest;
    const result = await handler(request, reply);
    const sent = (reply.send as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    return (result ?? sent) as {
      logs: Array<{ actorUserId: string; targetId: string; targetType: string; action: string }>;
    };
  }

  return { audit, call };
}

describe("foundation.route — GET /api/admin/audit-logs (P14)", () => {
  it("trả toàn bộ bản ghi khi không có bộ lọc", async () => {
    const { audit, call } = await buildAuditLogsHarness();
    audit.append({
      actorUserId: "ta-1",
      actorRole: "TOURNAMENT_ADMIN",
      action: "CREATE_DRAFT",
      targetType: "TOURNAMENT",
      targetId: "tour-1",
    });
    audit.append({
      actorUserId: "ta-2",
      actorRole: "TOURNAMENT_ADMIN",
      action: "CREATE_DRAFT",
      targetType: "TOURNAMENT",
      targetId: "tour-2",
    });

    const res = await call({});
    expect(res.logs).toHaveLength(2);
  });

  it("chấp nhận actorUserId và lọc bản ghi theo người thực hiện", async () => {
    const { audit, call } = await buildAuditLogsHarness();
    audit.append({
      actorUserId: "ta-1",
      actorRole: "TOURNAMENT_ADMIN",
      action: "CREATE_DRAFT",
      targetType: "TOURNAMENT",
      targetId: "tour-1",
    });
    audit.append({
      actorUserId: "ta-2",
      actorRole: "TOURNAMENT_ADMIN",
      action: "CREATE_DRAFT",
      targetType: "TOURNAMENT",
      targetId: "tour-2",
    });
    audit.append({
      actorUserId: "ta-1",
      actorRole: "TOURNAMENT_ADMIN",
      action: "PUBLISH_RULE_VERSION",
      targetType: "RULE_VERSION",
      targetId: "tour-1",
    });

    const res = await call({ actorUserId: "ta-1" });
    expect(res.logs).toHaveLength(2);
    expect(res.logs.every((l) => l.actorUserId === "ta-1")).toBe(true);
    expect(res.logs.map((l) => l.action).sort()).toEqual(["CREATE_DRAFT", "PUBLISH_RULE_VERSION"]);
  });

  it("kết hợp actorUserId với targetType/targetId cho truy vấn phạm vi giải đấu", async () => {
    const { audit, call } = await buildAuditLogsHarness();
    audit.append({
      actorUserId: "ta-1",
      actorRole: "TOURNAMENT_ADMIN",
      action: "CREATE_DRAFT",
      targetType: "TOURNAMENT",
      targetId: "tour-1",
    });
    audit.append({
      actorUserId: "ta-1",
      actorRole: "TOURNAMENT_ADMIN",
      action: "PUBLISH_RULE_VERSION",
      targetType: "RULE_VERSION",
      targetId: "tour-1",
    });
    audit.append({
      actorUserId: "ta-2",
      actorRole: "TOURNAMENT_ADMIN",
      action: "CREATE_DRAFT",
      targetType: "TOURNAMENT",
      targetId: "tour-1",
    });

    const res = await call({
      actorUserId: "ta-1",
      targetType: "TOURNAMENT",
      targetId: "tour-1",
    });
    expect(res.logs).toHaveLength(1);
    expect(res.logs[0]).toMatchObject({
      actorUserId: "ta-1",
      targetType: "TOURNAMENT",
      targetId: "tour-1",
      action: "CREATE_DRAFT",
    });
  });
});
