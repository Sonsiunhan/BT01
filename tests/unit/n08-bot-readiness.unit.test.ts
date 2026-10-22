import { describe, expect, it } from "vitest";
import { BotLibraryService } from "../../apps/server/src/modules/bot-library/bot-library.service.js";
import { TournamentStateStore } from "../../apps/server/src/modules/tournament-foundation/tournament-store.js";
import { BotReadinessService } from "../../apps/server/src/modules/tournament-bot-readiness/bot-readiness.service.js";

const source = `def choose_move(state, memory):\n    return state["legal_moves"][0], memory\n`;

describe("N08 bot readiness service", () => {
  it("runs the accepted Offline Human–Python and Bot–Bot proof through the isolated adapter contract", async () => {
    const adapter = {
      profile: { isolation: "WASMTIME_SUPERVISOR" as const, sourceParser: "ISOLATED_PARSER" as const, network: false as const, filesystem: false as const, secrets: false as const, applicationMounts: false as const },
      async execute(request: any) { return { move: request.state.legalMoves[0], memory: null, computeMs: 1 }; },
    };
    const store = new TournamentStateStore();
    const library = new BotLibraryService(undefined, { adapter });
    const first = await library.createBot("player-1", "Alpha", source);
    const second = await library.createBot("player-2", "Beta", source);
    const service = new BotReadinessService(store, library);
    const one = service.seedEnrollment({ tournamentId: "t-1", enrollmentId: "e-1", userId: "player-1", personKey: "P1" });
    const two = service.seedEnrollment({ tournamentId: "t-1", enrollmentId: "e-2", userId: "player-2", personKey: "P2" });
    const actor1 = { userId: "player-1", roles: ["PLAYER"] as const };
    const actor2 = { userId: "player-2", roles: ["PLAYER"] as const };
    await service.selectBot(actor1, "t-1", one.enrollmentId, { botId: first.bot.id, revisionId: first.revision.id, expectedEnrollmentRevision: 0, idempotencyKey: "proof-select-1" });
    await service.selectBot(actor2, "t-1", two.enrollmentId, { botId: second.bot.id, revisionId: second.revision.id, expectedEnrollmentRevision: 0, idempotencyKey: "proof-select-2" });
    const proofActor = { userId: "ta-1", roles: ["TOURNAMENT_ADMIN"] as const };
    const humanPython = await service.runProof(proofActor, "t-1", "OFFLINE_HUMAN_PYTHON", [one.enrollmentId]);
    const botBot = await service.runProof(proofActor, "t-1", "OFFLINE_BOT_VS_BOT", [one.enrollmentId, two.enrollmentId]);
    expect(humanPython.status).toBe("PASSED");
    expect(botBot.status).toBe("PASSED");
  });

  it("does not claim READY before an owner selects a revision and runtime proof passes", async () => {
    const store = new TournamentStateStore({ clockFn: () => new Date("2026-10-23T08:00:00.000Z") });
    const library = new BotLibraryService();
    const { bot, revision } = await library.createBot("player-1", "Alpha", source);
    const service = new BotReadinessService(store, library);
    const enrollment = service.seedEnrollment({
      tournamentId: "t-1", enrollmentId: "e-1", userId: "player-1", personKey: "P1",
    });

    expect(service.getSnapshot("t-1").items[0]?.status).toBe("NOT_SUBMITTED");
    const result = await service.selectBot({ userId: "player-1", roles: ["PLAYER"] }, "t-1", enrollment.enrollmentId, {
      botId: bot.id, revisionId: revision.id, expectedEnrollmentRevision: enrollment.revision,
      idempotencyKey: "select-1",
    });
    expect(result.status).toBe("BLOCKED_INFRA");
    expect(service.getSnapshot("t-1").items[0]?.status).not.toBe("READY");
  });

  it("rejects stale compare-and-set and idempotency payload reuse", async () => {
    const store = new TournamentStateStore();
    const library = new BotLibraryService();
    const { bot, revision } = await library.createBot("player-1", "Alpha", source);
    const service = new BotReadinessService(store, library);
    const enrollment = service.seedEnrollment({ tournamentId: "t-1", enrollmentId: "e-1", userId: "player-1", personKey: "P1" });
    const input = { botId: bot.id, revisionId: revision.id, expectedEnrollmentRevision: enrollment.revision, idempotencyKey: "select-1" };
    await service.selectBot({ userId: "player-1", roles: ["PLAYER"] }, "t-1", enrollment.enrollmentId, input);
    await expect(service.selectBot({ userId: "player-1", roles: ["PLAYER"] }, "t-1", enrollment.enrollmentId, input)).resolves.toMatchObject({ idempotent: true });
    await expect(service.selectBot({ userId: "player-1", roles: ["PLAYER"] }, "t-1", enrollment.enrollmentId, { ...input, botId: "different" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(service.requestRecheck({ userId: "player-1", roles: ["PLAYER"] }, "t-1", { enrollmentId: enrollment.enrollmentId, expectedEnrollmentRevision: 0, idempotencyKey: "retry-01" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("never exposes source, private logs or diagnostics in the public snapshot", () => {
    const service = new BotReadinessService(new TournamentStateStore(), new BotLibraryService());
    service.seedEnrollment({ tournamentId: "t-1", enrollmentId: "e-1", userId: "player-1", personKey: "P1" });
    const snapshot = service.getSnapshot("t-1");
    expect(JSON.stringify(snapshot)).not.toContain("privateLog");
    expect(JSON.stringify(snapshot)).not.toContain("source");
  });
});
