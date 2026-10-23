import { describe, expect, it } from "vitest";
import { BotLibraryService } from "../../apps/server/src/modules/bot-library/bot-library.service.js";
import { BotReadinessService } from "../../apps/server/src/modules/tournament-bot-readiness/bot-readiness.service.js";
import { TournamentStateStore } from "../../apps/server/src/modules/tournament-foundation/tournament-store.js";

const source = `def choose_move(state, memory):\n    return state["legal_moves"][0], memory\n`;
const profile = { isolation: "WASMTIME_SUPERVISOR" as const, sourceParser: "ISOLATED_PARSER" as const, network: false as const, filesystem: false as const, secrets: false as const, applicationMounts: false as const };

function serviceFixture(mode: "ok" | "invalid" | "unavailable" = "ok") {
  const store = new TournamentStateStore({ clockFn: () => new Date("2026-10-23T08:00:00.000Z") });
  const library = new BotLibraryService(undefined, {
    adapter: {
      profile,
      async execute(request: any) {
        if (mode === "unavailable") throw new Error("provider down / private detail");
        if (mode === "invalid") return { move: { from: "z99", to: "z98" }, memory: null, computeMs: 1 };
        return { move: request.state.legalMoves[0], memory: null, computeMs: 1 };
      },
    },
  });
  const service = new BotReadinessService(store, library);
  return { store, library, service };
}

async function createReadyRecord(service: BotReadinessService, library: BotLibraryService, owner: string, enrollmentId: string) {
  const created = await library.createBot(owner, `Bot ${owner}`, source);
  const target = service.seedEnrollment({ tournamentId: "t-1", enrollmentId, userId: owner, personKey: enrollmentId });
  const queued = await service.selectBot({ userId: owner, roles: ["PLAYER"] }, "t-1", enrollmentId, {
    botId: created.bot.id,
    revisionId: created.revision.id,
    expectedEnrollmentRevision: 0,
    idempotencyKey: `select-${enrollmentId}`,
  });
  await service.executeJob(queued.job.jobId);
  return { target, created, queued };
}

describe("N08 bot readiness service", () => {
  it("fails closed until the owner selects a revision, then atomically commits a trusted READY receipt", async () => {
    const { service, library } = serviceFixture();
    const created = await library.createBot("player-1", "Alpha", source);
    service.seedEnrollment({ tournamentId: "t-1", enrollmentId: "e-1", userId: "player-1", personKey: "P1" });

    expect(service.getSnapshot("t-1").items[0]).toMatchObject({ status: "NOT_SUBMITTED", safeReason: "NOT_SELECTED", target: null });
    const queued = await service.selectBot({ userId: "player-1", roles: ["PLAYER"] }, "t-1", "e-1", {
      botId: created.bot.id,
      revisionId: created.revision.id,
      expectedEnrollmentRevision: 0,
      idempotencyKey: "select-e-1",
    });
    expect(queued).toMatchObject({ item: { status: "PENDING" }, job: { state: "QUEUED", status: "PENDING" } });
    expect(queued.item.target).toMatchObject({ runtimeProfile: "WASMTIME_SUPERVISOR", sourceDigestPrefix: created.revision.sourceDigest.slice(0, 12) });

    const finished = await service.executeJob(queued.job.jobId);
    expect(finished).toMatchObject({ state: "SUCCEEDED", status: "READY", receipt: { outcome: "ACCEPTED", code: "READY" } });
    const item = service.getSnapshot("t-1").items[0]!;
    expect(item).toMatchObject({ status: "READY", revisionId: created.revision.id, receipt: { outcome: "ACCEPTED", code: "READY" } });
    expect(item.receipt?.receiptId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("returns a typed not-applicable surface for HUMAN_ONLINE and never labels it as missing Bot", () => {
    const { store, service } = serviceFixture();
    store.tournaments.set("human", {
      id: "human", coreConfig: { competitionMode: "HUMAN_ONLINE" }, ruleProfile: { rulesVersion: "rps-v1" }, activeConfigVersionNumber: 1,
    } as never);
    const snapshot = service.getSnapshot("human");
    expect(snapshot).toEqual(expect.objectContaining({ applicable: false, items: [], nextCursor: null }));
    expect(JSON.stringify(snapshot)).not.toContain("NOT_SUBMITTED");
  });

  it("allows the owning TA to enqueue a recheck, scopes job polling, and preserves idempotency/CAS", async () => {
    const { service, library } = serviceFixture();
    const { queued } = await createReadyRecord(service, library, "owner-1", "e-1");
    const ready = service.getSnapshot("t-1").items[0]!;
    const ta = { userId: "ta-1", roles: ["TOURNAMENT_ADMIN"] as const };
    const recheck = await service.requestRecheck(ta, "t-1", {
      enrollmentId: "e-1", expectedEnrollmentRevision: ready.revision, idempotencyKey: "recheck-e-1",
    });
    expect(recheck.job).toMatchObject({ state: "QUEUED", targetContextRef: queued.job.targetContextRef });
    expect(service.getJob(ta, recheck.job.jobId).jobId).toBe(recheck.job.jobId);
    expect(() => service.getJob({ userId: "other", roles: ["PLAYER"] }, recheck.job.jobId)).toThrowError();
    await expect(service.requestRecheck(ta, "t-1", {
      enrollmentId: "e-1", expectedEnrollmentRevision: ready.revision, idempotencyKey: "recheck-e-1",
    })).resolves.toMatchObject({ idempotent: true, job: { jobId: recheck.job.jobId } });
    await expect(service.requestRecheck(ta, "t-1", {
      enrollmentId: "different", expectedEnrollmentRevision: ready.revision, idempotencyKey: "recheck-e-1",
    })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("marks a stale target without committing READY when a new tournament config publishes during a job", async () => {
    const { store, service, library } = serviceFixture();
    store.tournaments.set("t-1", {
      id: "t-1", coreConfig: { competitionMode: "BOT_VS_BOT" }, ruleProfile: { rulesVersion: "rps-v1" }, activeConfigVersionNumber: 1,
    } as never);
    const created = await library.createBot("owner-1", "Alpha", source);
    service.seedEnrollment({ tournamentId: "t-1", enrollmentId: "e-1", userId: "owner-1", personKey: "P1" });
    const queued = await service.selectBot({ userId: "owner-1", roles: ["PLAYER"] }, "t-1", "e-1", { botId: created.bot.id, revisionId: created.revision.id, expectedEnrollmentRevision: 0, idempotencyKey: "stale-e-1" });
    store.tournaments.set("t-1", { ...(store.tournaments.get("t-1") as any), activeConfigVersionNumber: 2 });
    const job = await service.executeJob(queued.job.jobId);
    expect(job).toMatchObject({ state: "STALE", status: "STALE", receipt: { code: "TARGET_STALE", outcome: "CANCELLED" } });
    expect(service.getSnapshot("t-1").items[0]?.status).toBe("STALE");
  });

  it("classifies Bot-policy failures and provider failures without leaking diagnostics", async () => {
    const rejected = serviceFixture("invalid");
    const first = await createReadyRecord(rejected.service, rejected.library, "owner-1", "e-1");
    const rejectedJob = rejected.service.getJob({ userId: "owner-1", roles: ["PLAYER"] }, first.queued.job.jobId);
    expect(rejectedJob).toMatchObject({ state: "BOT_REJECTED", status: "INCOMPATIBLE", receipt: { outcome: "REJECTED" } });

    const unavailable = serviceFixture("unavailable");
    const second = await createReadyRecord(unavailable.service, unavailable.library, "owner-2", "e-2");
    const unavailableJob = unavailable.service.getJob({ userId: "owner-2", roles: ["PLAYER"] }, second.queued.job.jobId);
    expect(unavailableJob).toMatchObject({ state: "BLOCKED_INFRA", status: "BLOCKED_INFRA", retryable: true, retryAfterMs: expect.any(Number), receipt: { outcome: "FAILED", code: "PROVIDER_UNAVAILABLE" } });
    const publicJson = JSON.stringify(unavailable.service.getSnapshot("t-1"));
    expect(publicJson).not.toContain('"source":');
    expect(publicJson).not.toMatch(/private detail|stderr|traceback|environment/i);
  });

  it("recovers queued work after service recreation as a retryable infrastructure blocker", async () => {
    const { store, service, library } = serviceFixture();
    const created = await library.createBot("owner-1", "Alpha", source);
    service.seedEnrollment({ tournamentId: "t-1", enrollmentId: "e-1", userId: "owner-1", personKey: "P1" });
    const queued = await service.selectBot({ userId: "owner-1", roles: ["PLAYER"] }, "t-1", "e-1", { botId: created.bot.id, revisionId: created.revision.id, expectedEnrollmentRevision: 0, idempotencyKey: "recover-e-1" });
    const recovered = new BotReadinessService(store, library);
    expect(recovered.getJob({ userId: "owner-1", roles: ["PLAYER"] }, queued.job.jobId)).toMatchObject({ state: "BLOCKED_INFRA", retryable: true, receipt: { code: "PROVIDER_UNAVAILABLE" } });
  });

  it("runs Human–Python and Bot–Bot proofs through accepted canonical moves and N06 receipts", async () => {
    const { service, library } = serviceFixture();
    await createReadyRecord(service, library, "owner-1", "e-1");
    await createReadyRecord(service, library, "owner-2", "e-2");
    const ta = { userId: "ta-1", roles: ["TOURNAMENT_ADMIN"] as const };
    const humanPython = await service.runProof(ta, "t-1", "OFFLINE_HUMAN_PYTHON", ["e-1"]);
    const botBot = await service.runProof(ta, "t-1", "OFFLINE_BOT_VS_BOT", ["e-1", "e-2"]);
    expect(humanPython).toMatchObject({ status: "PASSED", acceptedTurns: 1, receiptIds: [expect.any(String)] });
    expect(botBot).toMatchObject({ status: "PASSED", acceptedTurns: 2, receiptIds: [expect.any(String), expect.any(String)] });
  });
});
