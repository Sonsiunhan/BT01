import { describe, expect, it } from "vitest";
import { createInitialState, LEGACY_RULE_PROFILE, type RuleProfile } from "@ottv2/game-rules";
import {
  BotExecutionReceiptSchema,
  BotStateDtoSchema,
} from "@ottv2/contracts";
import {
  BOT_OFFLINE_RUNTIME_VERSION,
  BOT_RUNTIME_POLICY_VERSION,
  createBotExecutionReceipt,
  createBotTurnState,
} from "@ottv2/bot-sdk";
import { buildPythonRunner } from "../../apps/server/src/modules/bot-online/python.runner.js";

const dynamicProfile: RuleProfile = {
  ...LEGACY_RULE_PROFILE,
  version: "custom-10x10-v1",
  board: { rows: 10, cols: 10 },
  goalProfiles: {
    BLUE: { mode: "STATIC", cell: "j10" },
    RED: { mode: "STATIC", cell: "a1" },
  },
};

describe("N06 Bot ABI and trusted receipt", () => {
  it("projects active dimensions, goals, rules and dynamic legal moves", () => {
    const initial = createInitialState();
    const state = { ...initial, ruleProfile: dynamicProfile };
    const turn = createBotTurnState(state, "BLUE", [], { BLUE: 30_000, RED: 30_000 }, 1);

    expect(turn.dimensions).toEqual({ rows: 10, cols: 10 });
    expect(turn.goals).toEqual({ BLUE: "j10", RED: "a1" });
    expect(turn.rules).toEqual({ version: "custom-10x10-v1", winConditions: ["EXTINCTION", "GOAL_REACHED"] });
    expect(turn.legalMoves.length).toBeGreaterThan(0);
    expect(BotStateDtoSchema.safeParse(turn).success).toBe(true);
    expect(JSON.parse(JSON.stringify(turn))).toEqual(turn);
  });

  it("creates a host-bound receipt with immutable identity and runtime versions", () => {
    const receipt = createBotExecutionReceipt({
      receiptId: "11111111-1111-4111-8111-111111111111",
      ownerId: "guest:profile-1",
      botId: "bot-1",
      revisionId: "rev-1",
      sourceDigest: "a".repeat(64),
      ruleVersion: "custom-10x10-v1",
      sdkVersion: "0.1.0",
      schemaVersion: "1",
      runtimeVersion: BOT_OFFLINE_RUNTIME_VERSION,
      policyVersion: BOT_RUNTIME_POLICY_VERSION,
      phase: "TURN",
      matchId: "22222222-2222-4222-8222-222222222222",
      stateVersion: 4,
      invocationId: "33333333-3333-4333-8333-333333333333",
      timestamp: "2026-10-22T12:00:00.000Z",
    }, { outcome: "ACCEPTED", computeMs: 12 });

    expect(BotExecutionReceiptSchema.parse(receipt)).toEqual(receipt);
    expect(receipt.ownerId).toBe("guest:profile-1");
    expect(receipt.sourceDigest).toBe("a".repeat(64));
    expect(Object.isFrozen(receipt)).toBe(true);
  });

  it("publishes the same state through snake_case aliases in the Python wrapper", () => {
    const initial = createInitialState();
    const state = createBotTurnState(initial, "BLUE", [], { BLUE: 30_000, RED: 30_000 }, 1);
    const source = buildPythonRunner({
      source: "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n",
      state,
      memory: null,
      seed: 1,
      phase: "PREFLIGHT",
    });

    expect(source).toContain("board_dimensions");
    expect(source).toContain("goal_cells");
    expect(source).toContain("rule_version");
    expect(source).toContain("win_conditions");
    expect(source).toContain("if isinstance(_result, tuple) and len(_result) == 2");
  });
});

