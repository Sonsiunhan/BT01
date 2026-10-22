import { describe, expect, it, vi } from "vitest";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AuthService } from "../../apps/server/src/modules/auth/auth.service.js";
import { AppError } from "../../apps/server/src/shared/errors/app-error.js";
import {
  registerTournamentRuleVersionRoutes,
  type TournamentVersioningPort,
} from "../../apps/server/src/modules/tournament-versioning/versioning.route.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

function reply(): FastifyReply {
  const result = { status: vi.fn(), send: vi.fn() } as unknown as FastifyReply;
  (result.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(result);
  return result;
}

describe("N04 versioning route adapter", () => {
  it("delegates publish with authoritative actor and exact request", async () => {
    const handlers = new Map<string, Handler>();
    const app = {
      get: (path: string, handler: Handler) => handlers.set(`GET ${path}`, handler),
      post: (path: string, handler: Handler) => handlers.set(`POST ${path}`, handler),
    } as unknown as FastifyInstance;
    const auth = { authenticate: vi.fn(async () => ({ principal: "ACCOUNT", user: { id: "ta-1", role: "TOURNAMENT_ADMIN" } })) } as unknown as AuthService;
    const port: TournamentVersioningPort = {
      listVersions: vi.fn(async () => ({ items: [], nextCursor: null, configRevision: 4 })),
      diffVersions: vi.fn(async () => ({ baseVersionId: "v1", targetVersionId: "v2", changes: [], sameDigest: false, oldMatchesUnaffected: true })),
      publish: vi.fn(async (_context, request) => ({ outcome: "PUBLISHED", version: {
        id: "v-2", tournamentId: "t-1", versionNumber: 2,
        profileRef: request.profileRef, profileDigest: request.profileDigest,
        reason: request.reason, effectiveAt: request.effectiveAt,
        createdAt: "2026-10-22T10:00:00.000Z", immutable: true,
      } })),
    };
    await registerTournamentRuleVersionRoutes(app, auth, port);
    const handler = handlers.get("POST /tournaments/:tournamentId/rule-versions/publish");
    if (!handler) throw new Error("publish route missing");
    const request = {
      params: { tournamentId: "t-1" },
      body: { expectedRevision: 4, profileRef: { draftId: "draft-4", revision: 7 }, profileDigest: "a".repeat(64), reason: "Cập nhật comparator theo điều lệ đã duyệt", effectiveAt: "2026-10-24T08:00:00.000Z", idempotencyKey: "publish-4" },
      headers: {},
    } as unknown as FastifyRequest;
    await handler(request, reply());
    expect(port.publish).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ id: "ta-1" }) }), expect.objectContaining({ expectedRevision: 4 }), "t-1");
  });

  it("enforces bounded list limits at the route boundary", async () => {
    const handlers = new Map<string, Handler>();
    const app = { get: (path: string, handler: Handler) => handlers.set(`GET ${path}`, handler), post: vi.fn() } as unknown as FastifyInstance;
    const auth = { authenticate: vi.fn(async () => ({ principal: "ACCOUNT", user: { id: "ta-1", role: "TOURNAMENT_ADMIN" } })) } as unknown as AuthService;
    const port = { listVersions: vi.fn(), diffVersions: vi.fn(), publish: vi.fn() } as unknown as TournamentVersioningPort;
    await registerTournamentRuleVersionRoutes(app, auth, port);
    const handler = handlers.get("GET /tournaments/:tournamentId/rule-versions");
    if (!handler) throw new Error("list route missing");
    await expect(handler({ params: { tournamentId: "t-1" }, query: { limit: 1000 }, headers: {} } as unknown as FastifyRequest, reply())).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("forwards scoped list and diff reads only for an operator role", async () => {
    const handlers = new Map<string, Handler>();
    const app = { get: (path: string, handler: Handler) => handlers.set(`GET ${path}`, handler), post: vi.fn() } as unknown as FastifyInstance;
    const auth = { authenticate: vi.fn(async () => ({ principal: "ACCOUNT", user: { id: "ta-1", role: "TOURNAMENT_ADMIN" } })) } as unknown as AuthService;
    const port: TournamentVersioningPort = {
      listVersions: vi.fn(async () => ({ items: [], nextCursor: null, configRevision: 4 })),
      diffVersions: vi.fn(async () => ({ baseVersionId: "v1", targetVersionId: "v2", changes: [], sameDigest: false, oldMatchesUnaffected: true })),
      publish: vi.fn(),
    };
    await registerTournamentRuleVersionRoutes(app, auth, port);
    await handlers.get("GET /tournaments/:tournamentId/rule-versions")?.({ params: { tournamentId: "t-1" }, query: { limit: "20" }, headers: {} } as unknown as FastifyRequest, reply());
    await handlers.get("GET /tournaments/:tournamentId/rule-versions/:versionId/diff")?.({ params: { tournamentId: "t-1", versionId: "v2" }, query: { against: "v1" }, headers: {} } as unknown as FastifyRequest, reply());
    expect(port.listVersions).toHaveBeenCalledWith(expect.anything(), "t-1", { limit: 20, cursor: undefined });
    expect(port.diffVersions).toHaveBeenCalledWith(expect.anything(), "t-1", "v2", "v1");
  });

  it("denies guest and player principals before touching the port", async () => {
    const handlers = new Map<string, Handler>();
    const app = { get: (path: string, handler: Handler) => handlers.set(`GET ${path}`, handler), post: vi.fn() } as unknown as FastifyInstance;
    const auth = { authenticate: vi.fn(async () => ({ principal: "GUEST", user: { id: "guest-1", role: "PLAYER" } })) } as unknown as AuthService;
    const port = { listVersions: vi.fn(), diffVersions: vi.fn(), publish: vi.fn() } as unknown as TournamentVersioningPort;
    await registerTournamentRuleVersionRoutes(app, auth, port);
    const handler = handlers.get("GET /tournaments/:tournamentId/rule-versions");
    if (!handler) throw new Error("list route missing");
    await expect(handler({ params: { tournamentId: "t-1" }, query: {}, headers: {} } as unknown as FastifyRequest, reply())).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(port.listVersions).not.toHaveBeenCalled();
  });

  it("preserves the canonical idempotency conflict from L05", async () => {
    const handlers = new Map<string, Handler>();
    const app = { get: vi.fn(), post: (path: string, handler: Handler) => handlers.set(`POST ${path}`, handler) } as unknown as FastifyInstance;
    const auth = { authenticate: vi.fn(async () => ({ principal: "ACCOUNT", user: { id: "ta-1", role: "TOURNAMENT_ADMIN" } })) } as unknown as AuthService;
    const port: TournamentVersioningPort = {
      listVersions: vi.fn(), diffVersions: vi.fn(),
      publish: vi.fn(async () => { throw new AppError("CONFLICT", "Idempotency key đã dùng cho payload khác.", 409, false, "RECOVERABLE", { reason: "IDEMPOTENCY_CONFLICT" }); }),
    };
    await registerTournamentRuleVersionRoutes(app, auth, port);
    const handler = handlers.get("POST /tournaments/:tournamentId/rule-versions/publish");
    if (!handler) throw new Error("publish route missing");
    const body = { expectedRevision: 4, profileRef: { draftId: "draft-4", revision: 7 }, profileDigest: "a".repeat(64), reason: "Cập nhật comparator theo điều lệ đã duyệt", effectiveAt: "2026-10-24T08:00:00.000Z", idempotencyKey: "publish-4" };
    await expect(handler({ params: { tournamentId: "t-1" }, body, headers: {} } as unknown as FastifyRequest, reply())).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409, details: { reason: "IDEMPOTENCY_CONFLICT" } });
  });
});
