import { describe, expect, it, vi } from "vitest";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { RosterService } from "../../src/modules/roster/roster.service.js";
import { registerRosterRoutes } from "../../src/modules/roster/roster.route.js";
import type { AuthService, AuthContext } from "../../src/modules/auth/auth.service.js";

function fakeReply(): FastifyReply {
  const reply = {
    status: vi.fn(),
    send: vi.fn(),
  } as unknown as FastifyReply;
  (reply.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(reply);
  (reply.send as unknown as ReturnType<typeof vi.fn>).mockReturnValue(reply);
  return reply;
}

describe("D03 / D04 — Roster Enrollment List API Tests", () => {
  it("returns enrollments for a tournament when authenticated as TOURNAMENT_ADMIN", async () => {
    const mockEnrollments = [
      {
        id: "enr-1",
        tournamentId: "tour-100",
        personKey: "KHOA_CNTT:SV001",
        displayName: "Nguyen Van A",
        unitCode: "KHOA_CNTT",
        seedRating: 1200,
        eligibilityStatus: "ELIGIBLE",
        createdAt: new Date(),
      },
    ];

    const mockDb = {
      tournamentEnrollmentRecord: {
        findMany: vi.fn().mockResolvedValue(mockEnrollments),
      },
    } as any;

    const service = new RosterService(mockDb);

    const routes: Record<string, (req: FastifyRequest, reply: FastifyReply) => Promise<any>> = {};
    const app = {
      post: vi.fn(),
      get: vi.fn((path: string, handler: any) => {
        routes[path] = handler;
      }),
    } as unknown as FastifyInstance;

    const auth = {
      authenticate: vi.fn().mockResolvedValue({
        principal: "ACCOUNT",
        user: { id: "ta-user-1", role: "TOURNAMENT_ADMIN" },
      } as AuthContext),
    } as unknown as AuthService;

    await registerRosterRoutes(app, auth, service);

    const handler = routes["/admin/tournaments/:tournamentId/roster"];
    expect(handler).toBeDefined();

    const request = {
      headers: { cookie: "session=valid" },
      params: { tournamentId: "tour-100" },
    } as unknown as FastifyRequest;

    const reply = fakeReply();
    await handler(request, reply);

    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({
      tournamentId: "tour-100",
      enrollments: mockEnrollments,
    });
  });

  it("rejects unauthorized access when not an admin role", async () => {
    const service = new RosterService();

    const routes: Record<string, (req: FastifyRequest, reply: FastifyReply) => Promise<any>> = {};
    const app = {
      post: vi.fn(),
      get: vi.fn((path: string, handler: any) => {
        routes[path] = handler;
      }),
    } as unknown as FastifyInstance;

    const auth = {
      authenticate: vi.fn().mockResolvedValue({
        principal: "ACCOUNT",
        user: { id: "player-1", role: "PLAYER" },
      } as AuthContext),
    } as unknown as AuthService;

    await registerRosterRoutes(app, auth, service);

    const handler = routes["/admin/tournaments/:tournamentId/roster"];
    const request = {
      headers: { cookie: "session=player" },
      params: { tournamentId: "tour-100" },
    } as unknown as FastifyRequest;

    const reply = fakeReply();
    await expect(handler(request, reply)).rejects.toThrow(/Chỉ quản trị hệ thống hoặc quản trị giải đấu/);
  });
});
