import { describe, expect, it, vi } from "vitest";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { TournamentRulePreviewRequestSchema, TournamentRulePreviewSchemaVersion } from "@ottv2/contracts";
import type { AuthService } from "../../src/modules/auth/auth.service.js";
import { registerTournamentRulesPreviewRoutes } from "../../src/modules/tournament-rules-preview/rules-preview.route.js";
import { TournamentRulesPreviewService } from "../../src/modules/tournament-rules-preview/rules-preview.service.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

function reply(): FastifyReply {
  const result = { status: vi.fn(), send: vi.fn() } as unknown as FastifyReply;
  (result.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(result);
  return result;
}

function body() {
  const ray = { kind: "RAY" as const, directions: [{ fileDelta: 1, rankDelta: 0 }, { fileDelta: -1, rankDelta: 0 }], minDistance: 1, maxDistance: 2, canJump: false };
  return {
    expectedConfigRevision: 3,
    draftRevision: 7,
    profile: {
      schemaVersion: TournamentRulePreviewSchemaVersion,
      engineProfileVersion: "rps-custom-v1",
      profile: {
        version: "rps-custom-v1",
        directionSystem: "ABSOLUTE",
        board: { rows: 5, cols: 15 },
        initialTurn: "BLUE",
        pieceCounts: { BLUE: { R: 1, P: 0, S: 0 }, RED: { R: 1, P: 0, S: 0 } },
        layout: [
          { id: "blue-r-1", side: "BLUE", type: "R", coordinate: "n5" },
          { id: "red-r-1", side: "RED", type: "R", coordinate: "b1" },
        ],
        movementProfiles: {
          BLUE: { R: [ray], P: [ray], S: [ray] },
          RED: { R: [ray], P: [ray], S: [ray] },
        },
        winConditions: ["GOAL_REACHED"],
        goalProfiles: { BLUE: { mode: "STATIC", cell: "o5" }, RED: { mode: "STATIC", cell: "a1" } },
      },
    },
  };
}

describe("N02 rule preview route", () => {
  it("authenticates before parsing and returns the engine preview", async () => {
    const handlers = new Map<string, Handler>();
    const app = { post: (path: string, handler: Handler) => handlers.set(path, handler) } as unknown as FastifyInstance;
    const auth = { authenticate: vi.fn(async () => ({ principal: "ACCOUNT", user: { id: "ta-1", role: "TOURNAMENT_ADMIN" } })) } as unknown as AuthService;
    const service = new TournamentRulesPreviewService({
      read: async () => ({ tournamentId: "t-1", contractId: "c-1", ownerTaUserId: "ta-1", revision: 3, activeContractBinding: true }),
    });
    await registerTournamentRulesPreviewRoutes(app, auth, service);
    const handler = handlers.get("/tournaments/:tournamentId/rule-profile/validate-preview");
    if (!handler) throw new Error("route missing");
    const response = reply();
    await handler({ params: { tournamentId: "t-1" }, body: body(), headers: {} } as unknown as FastifyRequest, response);
    expect(auth.authenticate).toHaveBeenCalledOnce();
    expect((response.send as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0]).toMatchObject({ valid: true, tournamentId: "t-1" });
  });

  it("rejects malformed body through the shared validation envelope", async () => {
    const handlers = new Map<string, Handler>();
    const app = { post: (path: string, handler: Handler) => handlers.set(path, handler) } as unknown as FastifyInstance;
    const auth = { authenticate: vi.fn(async () => ({ principal: "ACCOUNT", user: { id: "ta-1", role: "TOURNAMENT_ADMIN" } })) } as unknown as AuthService;
    const service = new TournamentRulesPreviewService({ read: async () => null });
    await registerTournamentRulesPreviewRoutes(app, auth, service);
    const handler = handlers.get("/tournaments/:tournamentId/rule-profile/validate-preview");
    if (!handler) throw new Error("route missing");
    await expect(handler({ params: { tournamentId: "t-1" }, body: { expectedConfigRevision: 0 }, headers: {} } as unknown as FastifyRequest, reply())).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
