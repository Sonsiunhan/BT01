import { describe, expect, it, vi } from "vitest";
import { guestBotLibraryApi } from "./guestBotLibrary";
vi.mock("./guestBotStore", () => {
  const vault = { bots: [], sources: {}, nextRevision: {} };
  return { updateGuestBotVault: async (change: (value: unknown) => unknown) => change(vault) };
});

describe("Guest immutable local bot library", () => {
  const source = "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n";
  it("retains separate immutable revisions and exports only an exact local owner selection", async () => {
    const saved = await guestBotLibraryApi.createBot({ name: "Bot khách", source });
    const next = await guestBotLibraryApi.createBotRevision(saved.bot.id, { source: source + "# revision 2\n" });
    expect(next.revision.revisionNumber).toBe(2);
    expect((await guestBotLibraryApi.getBotSource(saved.bot.id, saved.revision.id)).source).toBe(source);
    expect((await guestBotLibraryApi.getBotLibrary()).bots.some(bot => bot.id === saved.bot.id)).toBe(true);
    await expect(guestBotLibraryApi.getBotSource("other-bot", saved.revision.id)).rejects.toThrow();
    await guestBotLibraryApi.deleteBotRevision(saved.bot.id, next.revision.id);
    const third = await guestBotLibraryApi.createBotRevision(saved.bot.id, { source });
    expect(third.revision.revisionNumber).toBe(3);
    await guestBotLibraryApi.deleteBotRevision(saved.bot.id, saved.revision.id);
    await guestBotLibraryApi.deleteBotRevision(saved.bot.id, third.revision.id);
  });
  it("does not certify static validation as executed preflight", async () => {
    const saved = await guestBotLibraryApi.createBot({ name: "Preflight", source });
    await expect(guestBotLibraryApi.testBotRevision(saved.bot.id, saved.revision.id)).rejects.toMatchObject({ code: "OFFLINE_SANDBOX_NOT_VERIFIED" });
    await guestBotLibraryApi.deleteBotRevision(saved.bot.id, saved.revision.id);
  });
});
