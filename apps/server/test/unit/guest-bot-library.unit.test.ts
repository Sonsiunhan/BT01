import { describe, expect, it, vi } from "vitest";
import { BotLibraryService } from "../../src/modules/bot-library/bot-library.service.js";

const source = "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n";
describe("Guest Online private staging ownership", () => {
  it("allows a server-authenticated Guest owner without creating an account", async () => {
    const library = new BotLibraryService();
    const created = await library.createBot("guest:opaque-a", "Bot thử", source);
    expect(await library.source("guest:opaque-a", created.bot.id, created.revision.id)).toBe(source);
    expect(created.revision.sourceExpiresAt).not.toBeNull();
    expect(JSON.stringify(await library.list("guest:opaque-a"))).not.toContain(source);
    await expect(library.source("guest:opaque-b", created.bot.id, created.revision.id)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(library.source("account-a", created.bot.id, created.revision.id)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(library.testRevision("guest:opaque-a", created.bot.id, created.revision.id)).rejects.toMatchObject({ statusCode: 503 });
  });
  it("reclaims unused staging quota while preserving active/pending match references", async () => {
    const library = new BotLibraryService();
    const active = await library.stageGuest("guest:owner", "Active", source);
    const unused = await library.stageGuest("guest:owner", "Unused", source + "# alternate\n");
    await library.retainMatchRevisions("test-match", [active.revision.id]);
    await library.clearGuestStaging("guest:other");
    expect((await library.list("guest:owner")).bots).toHaveLength(2);
    await library.clearGuestStaging("guest:owner");
    expect((await library.list("guest:owner")).bots).toHaveLength(1);
    expect(await library.source("guest:owner", active.bot.id, active.revision.id)).toBe(source);
    await expect(library.source("guest:owner", unused.bot.id, unused.revision.id)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await library.retainMatchRevisions("test-match", []);
    await library.clearGuestStaging("guest:owner");
    expect((await library.list("guest:owner")).usedBytes).toBe(0);
  });
  it("removes expired Guest source and quota without pruning account libraries", async () => {
    const library = new BotLibraryService();
    await library.stageGuest("guest:owner", "Temporary", source);
    await library.createBot("account-owner", "Permanent", source);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 31 * 24 * 60 * 60 * 1000);
      await library.pruneExpiredGuestSources();
      expect((await library.list("guest:owner")).usedBytes).toBe(0);
      expect((await library.list("account-owner")).usedBytes).toBeGreaterThan(0);
    } finally { vi.useRealTimers(); }
  });
});
