import { describe, expect, it } from "vitest";
import { CommandLedger } from "../../src/modules/match/commit/command-ledger.js";
import type { CommandKey, CommandOutcome } from "../../src/modules/match/commit/commit.port.js";

describe("CommandLedger (L05-W2 — Idempotent Outcome Ledger)", () => {
  it("records and retrieves command outcomes by CommandKey and commandId", () => {
    const ledger = new CommandLedger();
    const key: CommandKey = {
      principalId: "user-1",
      commandId: "cmd-100",
      targetId: "match-1",
      operation: "MOVE",
    };
    const outcome: CommandOutcome = {
      commandId: "cmd-100",
      principalId: "user-1",
      outcome: "COMMITTED",
      stateVersion: 2,
      sequence: 5,
      ackPayload: { ok: true },
      committedAt: 1234567890,
    };

    expect(ledger.has(key)).toBe(false);
    ledger.record(outcome, key);

    expect(ledger.has(key)).toBe(true);
    expect(ledger.get(key)).toEqual(outcome);
    expect(ledger.getByCommandId("cmd-100")).toEqual(outcome);
    expect(ledger.getByCommandId("non-existent")).toBeUndefined();
  });

  it("evicts oldest entries when exceeding maxPerTarget bound", () => {
    const ledger = new CommandLedger(2); // max 2 entries for this target
    const targetId = "match-bounded";

    for (let i = 1; i <= 3; i++) {
      const key: CommandKey = {
        principalId: "user-1",
        commandId: `cmd-${i}`,
        targetId,
        operation: "MOVE",
      };
      const outcome: CommandOutcome = {
        commandId: `cmd-${i}`,
        principalId: "user-1",
        outcome: "COMMITTED",
        stateVersion: i,
        sequence: i,
        ackPayload: { index: i },
        committedAt: 1000 + i,
      };
      ledger.record(outcome, key);
    }

    // cmd-1 should be evicted (maxPerTarget = 2)
    expect(ledger.getByCommandId("cmd-1")).toBeUndefined();
    expect(ledger.getByCommandId("cmd-2")).toBeDefined();
    expect(ledger.getByCommandId("cmd-3")).toBeDefined();
  });

  it("clears entries for a specific targetId or clears all", () => {
    const ledger = new CommandLedger();
    const keyA: CommandKey = { principalId: "u1", commandId: "c1", targetId: "room-a", operation: "MOVE" };
    const keyB: CommandKey = { principalId: "u2", commandId: "c2", targetId: "room-b", operation: "MOVE" };

    ledger.record({ commandId: "c1", principalId: "u1", outcome: "COMMITTED", stateVersion: 1, sequence: 1, ackPayload: {}, committedAt: 1 }, keyA);
    ledger.record({ commandId: "c2", principalId: "u2", outcome: "COMMITTED", stateVersion: 1, sequence: 1, ackPayload: {}, committedAt: 1 }, keyB);

    ledger.clear("room-a");
    expect(ledger.has(keyA)).toBe(false);
    expect(ledger.has(keyB)).toBe(true);

    ledger.clear();
    expect(ledger.has(keyB)).toBe(false);
    expect(ledger.size()).toBe(0);
  });
});
