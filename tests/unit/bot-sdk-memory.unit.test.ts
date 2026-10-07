import { describe, expect, it } from "vitest";
import { parseBotMemoryCompatibility } from "../../packages/bot-sdk/src/source-validation.js";

describe("bot memory compatibility declaration", () => {
  it("requires an explicit schema before preservation can be offered", () => {
    expect(parseBotMemoryCompatibility("def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n")).toEqual({ schema: null, defaultPolicy: "RESET_ON_NEW_REVISION" });
    expect(parseBotMemoryCompatibility("# ottv2-memory-schema: strategy-v2\ndef choose_move(state, memory):\n    return state['legal_moves'][0], memory\n")).toEqual({ schema: "strategy-v2", defaultPolicy: "PRESERVE_IF_COMPATIBLE" });
  });

  it("rejects malformed or overlong schema declarations", () => {
    expect(parseBotMemoryCompatibility("# ottv2-memory-schema: not valid\n")).toEqual({ schema: null, defaultPolicy: "RESET_ON_NEW_REVISION" });
    expect(parseBotMemoryCompatibility(`# ottv2-memory-schema: ${"x".repeat(65)}\n`)).toEqual({ schema: null, defaultPolicy: "RESET_ON_NEW_REVISION" });
  });
});
