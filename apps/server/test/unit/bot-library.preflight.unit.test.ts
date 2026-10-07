import { describe, expect, it, vi } from "vitest";
import type { IsolatedRuntimeAdapter } from "@ottv2/bot-sdk";
import { BotLibraryService } from "../../src/modules/bot-library/bot-library.service.js";

const source = "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n";
const owner = "preflight-owner";
function adapter(execute: IsolatedRuntimeAdapter["execute"]): IsolatedRuntimeAdapter {
  return { profile: { isolation: "WASMTIME_SUPERVISOR", sourceParser: "ISOLATED_PARSER", network: false, filesystem: false, secrets: false, applicationMounts: false }, execute };
}

describe("Online library real isolated preflight boundary", () => {
  it("never promotes static validation to PASSED when the runtime is absent", async () => {
    const library = new BotLibraryService();
    const created = await library.createBot(owner, "No runtime", source);
    await expect(library.testRevision(owner, created.bot.id, created.revision.id)).rejects.toMatchObject({ statusCode: 503 });
    expect((await library.list(owner)).bots[0]?.revisions[0]?.status).toBe("READY");
  });

  it("executes both canonical sides with private empty memory and returns only a legal preview", async () => {
    const execute = vi.fn<IsolatedRuntimeAdapter["execute"]>(async request => ({ move: request.state.legalMoves[0]!, memory: null }));
    const library = new BotLibraryService(undefined, { adapter: adapter(execute) });
    const created = await library.createBot(owner, "Both sides", source);
    const result = await library.testRevision(owner, created.bot.id, created.revision.id);
    expect(result.revision.status).toBe("PASSED");
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls.map(([request]) => request.state.side)).toEqual(["BLUE", "RED"]);
    for (const [request] of execute.mock.calls) {
      expect(request).toMatchObject({ phase: "PREFLIGHT", memory: null, seed: 42 });
      expect(request.state.history).toEqual([]);
    }
    expect(result.legalPreview).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain(source);
  });

  it("rejects an illegal runtime move rather than accepting valid-looking source", async () => {
    const library = new BotLibraryService(undefined, { adapter: adapter(async () => ({ move: { from: "a1", to: "i9" }, memory: null })) });
    const created = await library.createBot(owner, "Illegal", source);
    const result = await library.testRevision(owner, created.bot.id, created.revision.id);
    expect(result.revision.status).toBe("FAILED");
    expect(result.legalPreview).toEqual([]);
  });

  it("fails closed on infrastructure failure without exposing provider diagnostics", async () => {
    const library = new BotLibraryService(undefined, { adapter: adapter(async () => { throw new Error("PRIVATE_PROVIDER_PATH_AND_SOURCE"); }) });
    const created = await library.createBot(owner, "Provider fail", source);
    await expect(library.testRevision(owner, created.bot.id, created.revision.id)).rejects.toMatchObject({ statusCode: 503, message: expect.not.stringContaining("PRIVATE_PROVIDER") });
    expect((await library.list(owner)).bots[0]?.revisions[0]?.status).not.toBe("PASSED");
  });

  it("checks ownership before invoking the runtime", async () => {
    const execute = vi.fn<IsolatedRuntimeAdapter["execute"]>(async request => ({ move: request.state.legalMoves[0]!, memory: null }));
    const library = new BotLibraryService(undefined, { adapter: adapter(execute) });
    const created = await library.createBot(owner, "Private", source);
    await expect(library.testRevision("other", created.bot.id, created.revision.id)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(execute).not.toHaveBeenCalled();
  });

  it("requires a valid move from Red too rather than granting PASS from Blue alone", async () => {
    const library = new BotLibraryService(undefined, { adapter: adapter(async request => ({ move: request.state.side === "BLUE" ? request.state.legalMoves[0]! : { from: "a1", to: "i9" }, memory: null })) });
    const created = await library.createBot(owner, "Red invalid", source);
    expect((await library.testRevision(owner, created.bot.id, created.revision.id)).revision.status).toBe("FAILED");
  });

  it("rejects a concurrent preflight and releases admission after completion", async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const execute = vi.fn<IsolatedRuntimeAdapter["execute"]>(async request => { await gate; return { move: request.state.legalMoves[0]!, memory: null }; });
    const library = new BotLibraryService(undefined, { adapter: adapter(execute) });
    const created = await library.createBot(owner, "Single preflight", source);
    const first = library.testRevision(owner, created.bot.id, created.revision.id);
    await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());
    await expect(library.testRevision(owner, created.bot.id, created.revision.id)).rejects.toMatchObject({ details: { reason: "BOT_RUNTIME_BUSY" } });
    release();
    expect((await first).revision.status).toBe("PASSED");
    expect((await library.testRevision(owner, created.bot.id, created.revision.id)).revision.status).toBe("PASSED");
  });
});
