import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  PrismaCommitPort,
  type CommitFailpoint,
} from "../../src/modules/match/commit/commit.prisma.js";
import { CommandLedger } from "../../src/modules/match/commit/command-ledger.js";
import type {
  CommitTransitionInput,
  BotPrivateCheckpoint,
} from "../../src/modules/match/commit/commit.port.js";

function createMockPrismaClient() {
  const tableData = {
    match: new Map<string, any>(),
    matchCheckpoint: new Map<string, any>(),
    matchEvent: [] as any[],
    botPrivateCheckpoint: new Map<string, any>(),
    commandLedgerEntry: new Map<string, any>(),
    matchSettlement: new Map<string, any>(),
    roomContext: new Map<string, any>(),
  };

  const createTx = () => ({
    match: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const id = where.id;
        const existing = tableData.match.get(id);
        const data = existing ? { ...existing, ...update } : { ...create };
        tableData.match.set(id, data);
        return data;
      }),
    },
    matchCheckpoint: {
      findFirst: vi.fn(async ({ where }: any) => {
        const list = Array.from(tableData.matchCheckpoint.values()).filter(
          (c) => c.roomId === where.roomId
        );
        list.sort((a, b) => b.stateVersion - a.stateVersion);
        return list[0] ?? null;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        return tableData.matchCheckpoint.get(where.matchId) ?? null;
      }),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const matchId = where.matchId;
        const existing = tableData.matchCheckpoint.get(matchId);
        const data = existing ? { ...existing, ...update } : { ...create };
        tableData.matchCheckpoint.set(matchId, data);
        return data;
      }),
    },
    matchEvent: {
      create: vi.fn(async ({ data }: any) => {
        tableData.matchEvent.push(data);
        return data;
      }),
    },
    botPrivateCheckpoint: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const key = `${where.matchId_botId.matchId}:${where.matchId_botId.botId}`;
        const existing = tableData.botPrivateCheckpoint.get(key);
        const data = existing ? { ...existing, ...update } : { ...create };
        tableData.botPrivateCheckpoint.set(key, data);
        return data;
      }),
    },
    commandLedgerEntry: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const k = where.principalId_targetId_operation_commandId;
        const key = `${k.principalId}:${k.targetId}:${k.operation}:${k.commandId}`;
        const existing = tableData.commandLedgerEntry.get(key);
        const data = existing ? { ...existing, ...update } : { ...create };
        tableData.commandLedgerEntry.set(key, data);
        return data;
      }),
    },
    matchSettlement: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const key = where.matchId;
        const existing = tableData.matchSettlement.get(key);
        const data = existing ? { ...existing, ...update } : { ...create };
        tableData.matchSettlement.set(key, data);
        return data;
      }),
    },
    roomContext: {
      update: vi.fn(async ({ where, data }: any) => {
        const existing = tableData.roomContext.get(where.id);
        if (existing) {
          const updated = { ...existing, ...data };
          tableData.roomContext.set(where.id, updated);
          return updated;
        }
        return null;
      }),
    },
  });

  const prisma = {
    $transaction: vi.fn(async (callback: any) => {
      // Snapshot state to simulate rollback on exception
      const snapshot = {
        match: new Map(tableData.match),
        matchCheckpoint: new Map(tableData.matchCheckpoint),
        matchEvent: [...tableData.matchEvent],
        botPrivateCheckpoint: new Map(tableData.botPrivateCheckpoint),
        commandLedgerEntry: new Map(tableData.commandLedgerEntry),
        matchSettlement: new Map(tableData.matchSettlement),
        roomContext: new Map(tableData.roomContext),
      };

      try {
        const tx = createTx();
        return await callback(tx);
      } catch (err) {
        // Rollback state completely
        tableData.match = snapshot.match;
        tableData.matchCheckpoint = snapshot.matchCheckpoint;
        tableData.matchEvent = snapshot.matchEvent;
        tableData.botPrivateCheckpoint = snapshot.botPrivateCheckpoint;
        tableData.commandLedgerEntry = snapshot.commandLedgerEntry;
        tableData.matchSettlement = snapshot.matchSettlement;
        tableData.roomContext = snapshot.roomContext;
        throw err;
      }
    }),
    commandLedgerEntry: {
      findUnique: vi.fn(async ({ where }: any) => {
        const k = where.principalId_targetId_operation_commandId;
        const key = `${k.principalId}:${k.targetId}:${k.operation}:${k.commandId}`;
        return tableData.commandLedgerEntry.get(key) ?? null;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        for (const entry of tableData.commandLedgerEntry.values()) {
          if (entry.commandId === where.commandId) return entry;
        }
        return null;
      }),
    },
    matchCheckpoint: {
      findUnique: vi.fn(async ({ where }: any) => {
        return tableData.matchCheckpoint.get(where.matchId) ?? null;
      }),
    },
    botPrivateCheckpoint: {
      findUnique: vi.fn(async ({ where }: any) => {
        const key = `${where.matchId_botId.matchId}:${where.matchId_botId.botId}`;
        return tableData.botPrivateCheckpoint.get(key) ?? null;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return Array.from(tableData.botPrivateCheckpoint.values()).filter(
          (c) => c.matchId === where.matchId
        );
      }),
    },
  } as unknown as PrismaClient;

  return { prisma, tableData };
}

describe("L06-W2 Prisma Commit Port Adapter (L-05.02, L-05.03, L-05.04, RULE-16)", () => {
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;
  let ledger: CommandLedger;
  let port: PrismaCommitPort;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    ledger = new CommandLedger();
    port = new PrismaCommitPort(mockPrisma.prisma, ledger, () => 1000);
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe("Atomic Commit & Idempotency", () => {
    it("commits match, checkpoint, events, bot checkpoint and ledger entry in a single atomic transaction", async () => {
      const privateCp: BotPrivateCheckpoint = {
        matchId: "match-1",
        botId: "bot-blue",
        revisionId: "rev-1",
        turnNumber: 1,
        seed: 12345,
        memory: { tree: [1, 2] },
      };

      const input: CommitTransitionInput = {
        commandKey: {
          principalId: "user-1",
          commandId: "cmd-1",
          targetId: "room-1",
          operation: "MOVE",
        },
        expectedVersion: 0,
        nextState: {
          matchId: "match-1",
          status: "PLAYING",
          rulesVersion: "rps-v1",
          setupVersion: "v1",
        },
        domainEvents: [
          {
            id: "ev-1",
            type: "MOVE_ACCEPTED",
            targetId: "room-1",
            sequence: 1,
            stateVersion: 1,
            timestamp: 1000,
          },
        ],
        privateCheckpoint: privateCp,
      };

      const result = await port.commitTransition(input);
      expect(result.outcome).toBe("COMMITTED");
      expect(result.stateVersion).toBe(1);
      expect(result.sequence).toBe(1);

      // Verify all tables were written atomically
      expect(mockPrisma.tableData.match.has("match-1")).toBe(true);
      expect(mockPrisma.tableData.matchCheckpoint.has("match-1")).toBe(true);
      expect(mockPrisma.tableData.matchEvent).toHaveLength(1);
      expect(mockPrisma.tableData.botPrivateCheckpoint.has("match-1:bot-blue")).toBe(true);
      expect(mockPrisma.tableData.commandLedgerEntry.size).toBe(1);

      // Verify command ledger entry has correct metadata
      const ledgerEntry = Array.from(mockPrisma.tableData.commandLedgerEntry.values())[0];
      expect(ledgerEntry.outcome).toBe("COMMITTED");
      expect(ledgerEntry.commandId).toBe("cmd-1");
      expect(ledgerEntry.stateVersion).toBe(1);
    });

    it("idempotently returns original outcome on duplicate command retry without re-executing writes", async () => {
      const input: CommitTransitionInput = {
        commandKey: {
          principalId: "user-1",
          commandId: "cmd-retry-1",
          targetId: "room-1",
          operation: "MOVE",
        },
        expectedVersion: 0,
        nextState: { matchId: "match-1", status: "PLAYING" },
        domainEvents: [],
      };

      // First call
      const firstResult = await port.commitTransition(input);
      expect(firstResult.outcome).toBe("COMMITTED");

      const txCallsBefore = (mockPrisma.prisma.$transaction as any).mock.calls.length;

      // Second call (retry)
      const retryResult = await port.commitTransition(input);
      expect(retryResult.outcome).toBe("COMMITTED");
      expect(retryResult.stateVersion).toBe(1);
      expect(retryResult.existingOutcome?.commandId).toBe("cmd-retry-1");

      // Verify $transaction was NOT called again (cached in ledger)
      const txCallsAfter = (mockPrisma.prisma.$transaction as any).mock.calls.length;
      expect(txCallsAfter).toBe(txCallsBefore);
    });

    it("detects CAS version conflict when expectedVersion mismatches current state", async () => {
      // First commit advances state to version 1
      await port.commitTransition({
        commandKey: {
          principalId: "user-1",
          commandId: "cmd-v1",
          targetId: "room-1",
          operation: "MOVE",
        },
        expectedVersion: 0,
        nextState: { matchId: "match-1" },
        domainEvents: [],
      });

      // Stale commit with expectedVersion = 0
      const staleResult = await port.commitTransition({
        commandKey: {
          principalId: "user-2",
          commandId: "cmd-stale",
          targetId: "room-1",
          operation: "MOVE",
        },
        expectedVersion: 0, // STALE! Current is 1
        nextState: { matchId: "match-1" },
        domainEvents: [],
      });

      expect(staleResult.outcome).toBe("CONFLICT");
      expect(staleResult.conflictReason).toBe("STALE_VERSION");
      expect(staleResult.stateVersion).toBe(1);
    });
  });

  describe("Failpoints & Atomic Rollback (L-05.02, L-05.03)", () => {
    const failpoints: CommitFailpoint[] = [
      "BEFORE_TX",
      "AFTER_CAS_BEFORE_WRITE",
      "AFTER_MATCH_BEFORE_CHECKPOINT",
      "AFTER_CHECKPOINT_BEFORE_EVENTS",
      "AFTER_EVENTS_BEFORE_PRIVATE_CHECKPOINT",
      "AFTER_PRIVATE_CHECKPOINT_BEFORE_LEDGER",
      "AFTER_LEDGER_BEFORE_COMMIT",
      "TIMEOUT",
    ];

    for (const fp of failpoints) {
      it(`Failpoint [${fp}] rolls back transaction completely leaving NO mixed state and returns UNKNOWN`, async () => {
        port.setFailpoint(fp);

        const input: CommitTransitionInput = {
          commandKey: {
            principalId: "user-fail",
            commandId: `cmd-fail-${fp}`,
            targetId: `room-${fp}`,
            operation: "MOVE",
          },
          expectedVersion: 0,
          nextState: { matchId: `match-${fp}`, status: "PLAYING" },
          domainEvents: [
            {
              id: "ev-fail",
              type: "MOVE_ACCEPTED",
              targetId: `room-${fp}`,
              sequence: 1,
              stateVersion: 1,
              timestamp: 1000,
            },
          ],
          privateCheckpoint: {
            matchId: `match-${fp}`,
            botId: "bot-fail",
            revisionId: "r1",
            turnNumber: 1,
            memory: {},
          },
        };

        const result = await port.commitTransition(input);
        expect(result.outcome).toBe("UNKNOWN");

        // CRITICAL INVARIANT: Zero mixed state left behind
        expect(mockPrisma.tableData.match.has(`match-${fp}`)).toBe(false);
        expect(mockPrisma.tableData.matchCheckpoint.has(`match-${fp}`)).toBe(false);
        expect(mockPrisma.tableData.matchEvent).toHaveLength(0);
        expect(mockPrisma.tableData.botPrivateCheckpoint.has(`match-${fp}:bot-fail`)).toBe(false);

        // Ledger records UNKNOWN outcome to protect idempotency and fence future operations
        const ledgerOutcome = port.ledger.get(input.commandKey);
        expect(ledgerOutcome).toBeDefined();
        expect(ledgerOutcome?.outcome).toBe("UNKNOWN");
      });
    }

    it("Failpoint [AFTER_COMMIT_BEFORE_ACK] commits to DB, throws crash error before ACK, and retry returns COMMITTED without re-execution", async () => {
      port.setFailpoint("AFTER_COMMIT_BEFORE_ACK");

      const input: CommitTransitionInput = {
        commandKey: {
          principalId: "user-ack-crash",
          commandId: "cmd-post-commit-kill",
          targetId: "room-ack",
          operation: "MOVE",
        },
        expectedVersion: 0,
        nextState: { matchId: "match-ack", status: "PLAYING" },
        domainEvents: [],
      };

      // Call fails with simulated crash before ACK
      await expect(port.commitTransition(input)).rejects.toThrowError(
        /FAILPOINT_AFTER_COMMIT_BEFORE_ACK/
      );

      // Invariant: DB WAS committed!
      expect(mockPrisma.tableData.match.has("match-ack")).toBe(true);
      expect(mockPrisma.tableData.matchCheckpoint.has("match-ack")).toBe(true);

      // Server restarts / recovers: clear failpoint
      port.setFailpoint(null);

      // Client retries with exact same commandKey
      const retryResult = await port.commitTransition(input);

      // Invariant: returns original COMMITTED outcome without re-executing
      expect(retryResult.outcome).toBe("COMMITTED");
      expect(retryResult.stateVersion).toBe(1);
    });

    it("Disallows setting failpoints in production environment", () => {
      process.env.NODE_ENV = "production";
      expect(() => port.setFailpoint("AFTER_CAS_BEFORE_WRITE")).toThrowError(
        /Commit failpoints are strictly disabled in production/
      );
    });
  });

  describe("Ledger Compaction & Unresolved Protection (L-05.04)", () => {
    it("Compaction preserves unresolved UNKNOWN outcomes while tombstoning/pruning expired entries", () => {
      const now = 1_000_000;
      const ledgerTest = new CommandLedger();

      // 1. Unresolved entry (UNKNOWN)
      ledgerTest.record(
        {
          commandId: "cmd-unknown",
          principalId: "u1",
          outcome: "UNKNOWN",
          stateVersion: 0,
          sequence: 0,
          ackPayload: null,
          committedAt: now - 500_000, // Very old
          expiresAt: now - 100_000,   // Expired
        },
        { principalId: "u1", commandId: "cmd-unknown", targetId: "r1", operation: "MOVE" }
      );

      // 2. Expired COMMITTED entry
      ledgerTest.record(
        {
          commandId: "cmd-committed-expired",
          principalId: "u2",
          outcome: "COMMITTED",
          stateVersion: 1,
          sequence: 1,
          ackPayload: { large: "data" },
          committedAt: now - 400_000,
          expiresAt: now - 50_000,
        },
        { principalId: "u2", commandId: "cmd-committed-expired", targetId: "r2", operation: "MOVE" }
      );

      // 3. Fresh COMMITTED entry
      ledgerTest.record(
        {
          commandId: "cmd-committed-fresh",
          principalId: "u3",
          outcome: "COMMITTED",
          stateVersion: 2,
          sequence: 2,
          ackPayload: { fresh: "data" },
          committedAt: now - 10_000,
          expiresAt: now + 200_000,
        },
        { principalId: "u3", commandId: "cmd-committed-fresh", targetId: "r3", operation: "MOVE" }
      );

      // Run compaction
      const compaction = ledgerTest.compact(now, 300_000);

      // INVARIANT: UNKNOWN is NEVER purged or tombstoned!
      expect(compaction.preservedUnresolvedCount).toBe(1);
      const unknownOutcome = ledgerTest.get({ principalId: "u1", commandId: "cmd-unknown", targetId: "r1", operation: "MOVE" });
      expect(unknownOutcome).toBeDefined();
      expect(unknownOutcome?.outcome).toBe("UNKNOWN");

      // Expired committed entry was converted to a tombstone
      expect(compaction.tombstonedCount).toBe(1);
      const tombstonedOutcome = ledgerTest.get({ principalId: "u2", commandId: "cmd-committed-expired", targetId: "r2", operation: "MOVE" });
      expect(tombstonedOutcome?.isTombstone).toBe(true);
      expect(tombstonedOutcome?.ackPayload).toBeNull(); // Large payload stripped

      // Fresh committed entry was untouched
      const freshOutcome = ledgerTest.get({ principalId: "u3", commandId: "cmd-committed-fresh", targetId: "r3", operation: "MOVE" });
      expect(freshOutcome?.isTombstone).toBeUndefined();
    });
  });

  describe("Bot Private Checkpoint Port & Restore", () => {
    it("saves and reads Bot private checkpoints durably", async () => {
      const cp: BotPrivateCheckpoint = {
        matchId: "match-durable-bot",
        botId: "bot-alpha",
        revisionId: "rev-2",
        turnNumber: 4,
        seed: 999,
        memory: { internalState: 42 },
      };

      await port.saveCheckpoint(cp);
      const read = await port.readCheckpoint("match-durable-bot", "bot-alpha");
      expect(read).toEqual(cp);

      const missing = await port.readCheckpoint("match-durable-bot", "bot-nonexistent");
      expect(missing).toBeNull();
    });

    it("restores match state with checkpoint, watermark and bot private checkpoints", async () => {
      // Seed checkpoint in DB
      mockPrisma.tableData.matchCheckpoint.set("match-restore-1", {
        matchId: "match-restore-1",
        roomId: "room-restore-1",
        sequence: 15,
        stateVersion: 5,
        rulesVersion: "rps-v1",
        initialSeed: 42,
        snapshot: { matchId: "match-restore-1", status: "PLAYING" },
        updatedAt: new Date(12345678),
      });

      // Seed bot private checkpoint in DB
      mockPrisma.tableData.botPrivateCheckpoint.set("match-restore-1:bot-1", {
        matchId: "match-restore-1",
        botId: "bot-1",
        revisionId: "rev-1",
        turnNumber: 5,
        seed: 42,
        memoryPayload: { node: "root" },
      });

      const restored = await port.restoreMatch("match-restore-1");
      expect(restored).not.toBeNull();
      expect(restored?.snapshot).toEqual({ matchId: "match-restore-1", status: "PLAYING" });
      expect(restored?.watermark.lastCommittedStateVersion).toBe(5);
      expect(restored?.watermark.lastCommittedSequence).toBe(15);
      expect(restored?.setupDescriptor.rulesVersion).toBe("rps-v1");
      expect(restored?.privateCheckpoints?.["bot-1"]).toBeDefined();
      expect(restored?.privateCheckpoints?.["bot-1"].memory).toEqual({ node: "root" });
    });
  });
});
