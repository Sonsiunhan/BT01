import { describe, expect, it, vi } from "vitest";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { AuthService } from "../../src/modules/auth/auth.service.js";
import { registerHistoryRoutes } from "../../src/modules/history/history.route.js";
import type { MatchHistoryService } from "../../src/modules/history/history.service.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

function fakeReply(): FastifyReply {
  const reply = { header: vi.fn(), type: vi.fn(), status: vi.fn(), send: vi.fn() } as unknown as FastifyReply;
  for (const key of ["header", "type", "status"] as const) (reply[key] as unknown as ReturnType<typeof vi.fn>).mockReturnValue(reply);
  return reply;
}

describe("R13 history audit route", () => {
  it("returns a downloadable public audit while delegating authorization to the history service", async () => {
    const auth = { authenticate: vi.fn(async () => ({ user: { id: "viewer" } })) } as unknown as AuthService;
    const audit = { match: { matchId: "m1" }, replay: { available: false, moves: [], timeline: [], legacyFinalBoardOnly: true }, exportedAt: new Date().toISOString(), retention: { sourceUntil: null, logsUntil: null } };
    const history = { audit: vi.fn(async (userId: string, matchId: string) => { expect(userId).toBe("viewer"); expect(matchId).toBe("m1"); return audit; }) } as unknown as MatchHistoryService;
    const handlers = new Map<string, Handler>();
    const app = { get: (path: string, handler: Handler) => handlers.set("GET " + path, handler) } as unknown as FastifyInstance;
    await registerHistoryRoutes(app, auth, history);
    const handler = handlers.get("GET /history/:matchId/audit");
    if (!handler) throw new Error("missing audit handler");
    const reply = fakeReply();
    await handler({ params: { matchId: "m1" }, headers: {} } as unknown as FastifyRequest, reply);
    expect(reply.header).toHaveBeenCalledWith("content-disposition", "attachment; filename=ottv2-audit-m1.json");
    expect(reply.type).toHaveBeenCalledWith("application/json; charset=utf-8");
    expect(reply.send).toHaveBeenCalledWith(audit);
  });
});
