import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AuthContext } from "../../src/modules/auth/auth.service.js";
import { AuthService } from "../../src/modules/auth/auth.service.js";
import { BotLibraryService } from "../../src/modules/bot-library/bot-library.service.js";
import { registerBotReadinessRoutes } from "../../src/modules/tournament-bot-readiness/bot-readiness.route.js";
import { BotReadinessService } from "../../src/modules/tournament-bot-readiness/bot-readiness.service.js";
import { TournamentStateStore } from "../../src/modules/tournament-foundation/tournament-store.js";
import { registerErrorHandler } from "../../src/plugins/error-handler.js";
import { BotReadinessItemSchema, BotReadinessJobSchema, BotReadinessSnapshotSchema } from "@ottv2/contracts";

const now = "2026-10-23T08:00:00.000Z";
const source = "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n";
const runtimeProfile = { isolation: "WASMTIME_SUPERVISOR" as const, sourceParser: "ISOLATED_PARSER" as const, network: false as const, filesystem: false as const, secrets: false as const, applicationMounts: false as const };

class TestAuthService extends AuthService {
  override async authenticate(token: string | undefined): Promise<AuthContext> {
    const userId = token === "other-token" ? "other-user" : "ta-1";
    const user = { id: userId, role: token === "other-token" ? "PLAYER" : "TOURNAMENT_ADMIN", username: userId, profile: null, stats: null } as never;
    return { principal: "ACCOUNT", user, session: {} as never };
  }
}

function responseJson(response: { body: string }): Record<string, unknown> {
  return JSON.parse(response.body) as Record<string, unknown>;
}

describe("N08 — bot readiness HTTP boundary", () => {
  let app: ReturnType<typeof Fastify>;
  let store: TournamentStateStore;
  let readiness: BotReadinessService;
  let library: BotLibraryService;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    registerErrorHandler(app);
    const auth = new TestAuthService();
    store = new TournamentStateStore({ clockFn: () => new Date(now) });
    store.contracts.set("contract-1", { id: "contract-1", status: "ACTIVE", validFrom: "2026-01-01T00:00:00.000Z", validTo: "2027-01-01T00:00:00.000Z", taBindings: [{ userId: "ta-1", status: "ACTIVE" }] } as never);
    store.tournaments.set("t-1", { id: "t-1", contractId: "contract-1", ownerTaUserId: "ta-1", coreConfig: { competitionMode: "BOT_VS_BOT" }, ruleProfile: { rulesVersion: "rps-v1" }, activeConfigVersionNumber: 1 } as never);
    library = new BotLibraryService(undefined, {
      adapter: {
        profile: runtimeProfile,
        async execute(request) {
          return { move: request.state.legalMoves[0]!, memory: null, computeMs: 1 };
        },
      },
    });
    readiness = new BotReadinessService(store, library);
    readiness.seedEnrollment({ tournamentId: "t-1", enrollmentId: "e-1", userId: "ta-1", personKey: "P1", displayName: "Thí sinh Một" });
    readiness.seedEnrollment({ tournamentId: "t-1", enrollmentId: "e-2", userId: "ta-1", personKey: "P2", displayName: "Thí sinh Hai" });
    await registerBotReadinessRoutes(app, auth, store, readiness);
    await app.ready();
  });

  afterEach(async () => { await app.close(); });

  it("serializes a scoped paginated snapshot, selection and TA recheck without private runtime data", async () => {
    const bot = await library.createBot("ta-1", "Bot Một", source);
    const list = await app.inject({ method: "GET", url: "/api/tournaments/t-1/bot-readiness?limit=1", headers: { cookie: "ottv2_session=ta-token" } });
    expect(list.statusCode).toBe(200);
    const listBody = responseJson(list);
    const snapshot = BotReadinessSnapshotSchema.parse(listBody.snapshot);
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.nextCursor).toBe("1");
    expect(JSON.stringify(listBody)).not.toContain('"source":');

    const selected = await app.inject({ method: "PUT", url: "/api/tournaments/t-1/enrollments/e-1/bot", headers: { cookie: "ottv2_session=ta-token", "content-type": "application/json" }, payload: { botId: bot.bot.id, revisionId: bot.revision.id, expectedEnrollmentRevision: 0, idempotencyKey: "http-select-e1" } });
    expect(selected.statusCode).toBe(202);
    const selectedBody = responseJson(selected);
    const selectedItem = BotReadinessItemSchema.parse(selectedBody.item);
    const selectedJob = BotReadinessJobSchema.parse(selectedBody.job);
    expect(selectedItem.target?.sourceDigestPrefix).toBe(bot.revision.sourceDigest.slice(0, 12));
    expect(JSON.stringify(selectedBody)).not.toMatch(/stderr|traceback|privateLog|"source":/i);

    const latest = await app.inject({ method: "GET", url: "/api/tournaments/t-1/bot-readiness?limit=100", headers: { cookie: "ottv2_session=ta-token" } });
    const latestItem = BotReadinessSnapshotSchema.parse(responseJson(latest).snapshot).items.find((item) => item.enrollmentId === "e-1")!;
    const recheck = await app.inject({ method: "POST", url: "/api/tournaments/t-1/bot-readiness/rechecks", headers: { cookie: "ottv2_session=ta-token", "content-type": "application/json" }, payload: { enrollmentId: "e-1", expectedEnrollmentRevision: latestItem.revision, idempotencyKey: "http-recheck-e1" } });
    expect(recheck.statusCode).toBe(202);
    const recheckJob = BotReadinessJobSchema.parse(responseJson(recheck).job);
    expect(recheckJob.targetContextRef).toBe(selectedJob.targetContextRef);

    let job = recheckJob;
    for (let attempt = 0; attempt < 20 && (job.state === "QUEUED" || job.state === "CHECKING"); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      const polled = await app.inject({ method: "GET", url: `/api/tournaments/t-1/bot-readiness/jobs/${job.jobId}`, headers: { cookie: "ottv2_session=ta-token" } });
      expect(polled.statusCode).toBe(200);
      job = BotReadinessJobSchema.parse(responseJson(polled).job);
    }
    expect(job.status).toBe("READY");

    const forbidden = await app.inject({ method: "GET", url: `/api/tournaments/t-1/bot-readiness/jobs/${job.jobId}`, headers: { cookie: "ottv2_session=other-token" } });
    expect(forbidden.statusCode).toBe(403);
  });

  it("returns safe 400 validation and typed not-applicable responses", async () => {
    const invalid = await app.inject({ method: "GET", url: "/api/tournaments/t-1/bot-readiness?status=BAD", headers: { cookie: "ottv2_session=ta-token" } });
    expect(invalid.statusCode).toBe(400);
    expect(responseJson(invalid).code).toBe("VALIDATION_ERROR");

    store.tournaments.set("human", { id: "human", contractId: "contract-1", ownerTaUserId: "ta-1", coreConfig: { competitionMode: "HUMAN_ONLINE" }, ruleProfile: { rulesVersion: "rps-v1" }, activeConfigVersionNumber: 1 } as never);
    const human = await app.inject({ method: "GET", url: "/api/tournaments/human/bot-readiness", headers: { cookie: "ottv2_session=ta-token" } });
    expect(human.statusCode).toBe(200);
    expect(BotReadinessSnapshotSchema.parse(responseJson(human).snapshot)).toMatchObject({ applicable: false, items: [] });
  });
});
