import { describe, expect, it } from "vitest";
import { createInitialState, type RuleState } from "@ottv2/game-rules";
import { DEFAULT_BOT_LIMITS } from "@ottv2/bot-sdk";
import { offlineLimitResult, offlineAuthorFaultResult } from "./offlineMatchPolicy";

describe("Offline finite match policy", () => {
  it("waits for the Red reply before adjudicating an exhausted whole-match budget", () => {
    const state: RuleState = { ...createInitialState(), currentTurn: "RED" };
    expect(offlineLimitResult(state, 1, DEFAULT_BOT_LIMITS.wholeMatchMs)).toBeNull();
    expect(offlineLimitResult(createInitialState(), 2, DEFAULT_BOT_LIMITS.wholeMatchMs)).toMatchObject({ winner: "RED", reason: "LIMIT_EXACT_TIE" });
  });
  it("caps full rounds and never invents a goal/extinction for limit decisions", () => {
    const result = offlineLimitResult(createInitialState(), DEFAULT_BOT_LIMITS.maxPlies, 1);
    expect(result).toMatchObject({ winner: "RED", reason: "LIMIT_EXACT_TIE", state: { status: "FINISHED", currentTurn: null, resultReason: null } });
  });
  it.each(["BLUE", "RED"] as const)("author fault by %s loses to the other side", (side) => {
    expect(offlineAuthorFaultResult(createInitialState(), side, "TURN_TIMEOUT").winner).toBe(side === "BLUE" ? "RED" : "BLUE");
  });
});
