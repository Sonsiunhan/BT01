import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "@ottv2/game-rules";
import { createBotTurnState } from "@ottv2/bot-sdk";
import { runOfflineBotTurn } from "./botOfflineRunner";

describe("Offline production runtime security gate", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not launch a same-origin worker while the production sandbox is unproven", async () => {
    const worker = vi.fn();
    vi.stubGlobal("Worker", worker);
    await expect(runOfflineBotTurn({
      source: "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n",
      state: createBotTurnState(createInitialState(), "BLUE", [], { BLUE: 30000, RED: 30000 }, 1),
      memory: null,
    })).rejects.toMatchObject({ code: "OFFLINE_SANDBOX_NOT_VERIFIED" });
    expect(worker).not.toHaveBeenCalled();
  });
});
