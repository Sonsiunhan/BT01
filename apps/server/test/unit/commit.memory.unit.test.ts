import { describe, expect, it } from "vitest";
import { InMemoryCommitPort } from "../../src/modules/match/commit/commit.memory.js";
import { CommandLedger } from "../../src/modules/match/commit/command-ledger.js";

describe("InMemoryCommitPort (L05-W2 — In-Memory Commit Port Adapter)", () => {
  it("commits transition atomically, increments stateVersion and sequence, and records in ledger", async () => {
    const ledger = new CommandLedger();
    const port = new InMemoryCommitPort(ledger, () => 5000);

    const input = {
      commandKey: {
        principalId: "user-blue",
        commandId: "cmd-move-1",
        targetId: "match-100",
        operation: "MOVE",
      },
      expectedVersion: 0,
      nextState: { matchId: "match-100", status: "PLAYING", stateVersion: 1 },
      domainEvents: [],
    };

    const result = await port.commitTransition(input);
    expect(result.outcome).toBe("COMMITTED");
    expect(result.stateVersion).toBe(1);
    expect(result.sequence).toBe(1);

    // Fast-path duplicate check: repeating same command returns existing outcome
    const retry = await port.commitTransition(input);
    expect(retry.outcome).toBe("COMMITTED");
    expect(retry.stateVersion).toBe(1);
    expect(retry.sequence).toBe(1);
    expect(retry.existingOutcome?.commandId).toBe("cmd-move-1");

    // Read outcome query
    const read = await port.readOutcome({
      principalId: "user-blue",
      commandId: "cmd-move-1",
    });
    expect(read?.outcome).toBe("COMMITTED");
    expect(read?.stateVersion).toBe(1);
  });

  it("detects CAS version conflict when expectedVersion does not match current state", async () => {
    const port = new InMemoryCommitPort();

    // First commit advances version to 1
    await port.commitTransition({
      commandKey: { principalId: "u1", commandId: "c1", targetId: "m1", operation: "MOVE" },
      expectedVersion: 0,
      nextState: {},
      domainEvents: [],
    });

    // Second commit with stale expectedVersion = 0 must fail with CONFLICT
    const staleResult = await port.commitTransition({
      commandKey: { principalId: "u2", commandId: "c2", targetId: "m1", operation: "MOVE" },
      expectedVersion: 0, // stale version!
      nextState: {},
      domainEvents: [],
    });

    expect(staleResult.outcome).toBe("CONFLICT");
    expect(staleResult.conflictReason).toBe("STALE_VERSION");
    expect(staleResult.stateVersion).toBe(1);

    // Commit with matching expectedVersion = 1 succeeds
    const okResult = await port.commitTransition({
      commandKey: { principalId: "u2", commandId: "c2", targetId: "m1", operation: "MOVE" },
      expectedVersion: 1, // matches current version
      nextState: {},
      domainEvents: [],
    });

    expect(okResult.outcome).toBe("COMMITTED");
    expect(okResult.stateVersion).toBe(2);
  });

  it("saves and reads Bot private checkpoints", async () => {
    const port = new InMemoryCommitPort();
    const checkpoint = {
      matchId: "match-bot-1",
      botId: "bot-alpha",
      revisionId: "rev-3",
      memory: { lastMoves: ["b1", "b2"] },
      turnNumber: 5,
    };

    await port.saveCheckpoint(checkpoint);
    const read = await port.readCheckpoint("match-bot-1", "bot-alpha");
    expect(read).toEqual(checkpoint);

    const missing = await port.readCheckpoint("match-bot-1", "bot-beta");
    expect(missing).toBeNull();
  });
});
