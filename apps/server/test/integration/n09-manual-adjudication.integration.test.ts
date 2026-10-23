import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ManualAdjudicationViewSchema, type ManualAdjudicationRequestDto } from "@ottv2/contracts";
import type { AuthContext } from "../../src/modules/auth/auth.service.js";
import { AuthService } from "../../src/modules/auth/auth.service.js";
import { createTournamentRuntimeBundle } from "../../src/modules/tournament-core/index.js";
import { registerTournamentCoreRoutes } from "../../src/modules/tournament-core/tournament-core.route.js";
import { TournamentStateStore } from "../../src/modules/tournament-foundation/tournament-store.js";
import { registerErrorHandler } from "../../src/plugins/error-handler.js";

class TestAuthService extends AuthService {
  override async authenticate(token: string | undefined): Promise<AuthContext> {
    const users: Record<string, { id: string; role: string }> = {
      "ta-token": { id: "ta-1", role: "TOURNAMENT_ADMIN" },
      "admin-token": { id: "admin-1", role: "ADMIN" },
      "ref-token": { id: "ref-1", role: "REFEREE" },
      "player-token": { id: "player-1", role: "PLAYER" },
    };
    const user = users[token ?? ""] ?? users["player-token"]!;
    return { principal: "ACCOUNT", user: { ...user, username: user.id, profile: null, stats: null } as never, session: {} as never };
  }
}

const request: ManualAdjudicationRequestDto = {
  id: "adj-http-1", tournamentId: "t-http", matchId: "match-http", roomId: "room-http",
  blueParticipantId: "enrollment-blue", redParticipantId: "enrollment-red", status: "WAITING",
  frozenSnapshot: {
    board: { rows: 5, columns: 5, cells: [{ row: 0, column: 0, side: "BLUE", pieceType: "R" }] },
    sideToMove: "BLUE", ruleVersion: "v3",
    tieIndicators: { blue: { materialByType: { R: 1, P: 0, S: 0 }, goalDistance: { reachable: true, distance: 1 }, mobility: 1 }, red: { materialByType: { R: 1, P: 0, S: 0 }, goalDistance: { reachable: true, distance: 1 }, mobility: 1 } },
    privateBotSource: "never-return-this",
  },
  deadlineAt: "2026-10-23T09:00:00.000Z", fallbackPolicy: "RANDOM_SEEDED", winnerSide: null,
  decidedByUserId: null, decisionReason: null, decidedAt: null, finishSequence: null,
  createdAt: "2026-10-23T08:00:00.000Z", updatedAt: "2026-10-23T08:00:00.000Z",
};

describe("N09 — manual adjudication HTTP boundary", () => {
  let app: ReturnType<typeof Fastify>;
  let store: TournamentStateStore;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    registerErrorHandler(app);
    const auth = new TestAuthService();
    store = new TournamentStateStore({ clockFn: () => new Date("2026-10-23T08:30:00.000Z") });
    store.contracts.set("contract-http", { id: "contract-http", status: "ACTIVE", validFrom: "2026-01-01T00:00:00.000Z", validTo: "2027-01-01T00:00:00.000Z", taBindings: [{ userId: "ta-1", status: "ACTIVE" }] } as never);
    store.tournaments.set("t-http", { id: "t-http", contractId: "contract-http", ownerTaUserId: "ta-1", coreConfig: { competitionMode: "BOT_VS_BOT" }, ruleProfile: { rulesVersion: "v3" }, activeConfigVersionNumber: 1 } as never);
    store.enrollments.set("enrollment-blue", { id: "enrollment-blue", tournamentId: "t-http", displayName: "Blue label" } as never);
    store.enrollments.set("enrollment-red", { id: "enrollment-red", tournamentId: "t-http", displayName: "Red label" } as never);
    store.adjudicationRequests.set(request.id, request);
    const bundle = createTournamentRuntimeBundle({ store });
    await registerTournamentCoreRoutes(app, auth, store, bundle);
    await app.ready();
  });

  afterEach(async () => { await app.close(); });

  it("returns the typed safe projection only to the owner TA", async () => {
    const allowed = await app.inject({ method: "GET", url: "/api/tournaments/t-http/adjudications", headers: { cookie: "ottv2_session=ta-token" } });
    expect(allowed.statusCode).toBe(200);
    const item = (allowed.json() as { adjudications: unknown[] }).adjudications[0];
    const view = ManualAdjudicationViewSchema.parse(item);
    expect(view.blueParticipant.label).toBe("Blue label");
    expect(JSON.stringify(item)).not.toContain("privateBotSource");
    expect(JSON.stringify(item)).not.toContain("frozenSnapshot");

    for (const token of ["admin-token", "ref-token", "player-token"]) {
      const denied = await app.inject({ method: "GET", url: "/api/tournaments/t-http/adjudications", headers: { cookie: `ottv2_session=${token}` } });
      expect(denied.statusCode).toBe(403);
    }
  });

  it("rejects a verdict when the stopped-match snapshot is incomplete", async () => {
    store.adjudicationRequests.set("adj-http-incomplete", {
      ...request,
      id: "adj-http-incomplete",
      frozenSnapshot: {
        board: { rows: 5, columns: 5, cells: [{ row: 0, column: 0, side: "BLUE", pieceType: "R" }] },
        sideToMove: "BLUE",
        ruleVersion: "v3",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/tournaments/adjudications/adj-http-incomplete/verdict",
      headers: { cookie: "ottv2_session=ta-token", "content-type": "application/json" },
      payload: { winnerSide: "BLUE", reason: "Snapshot thiếu metrics" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ details: { reason: "ADJUDICATION_SNAPSHOT_INCOMPLETE" } });
    expect(store.scoreLedger.get("t-http") ?? []).toHaveLength(0);
  });
});
