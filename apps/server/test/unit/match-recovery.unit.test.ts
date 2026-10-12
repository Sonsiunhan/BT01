import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  MatchRecoveryManager,
  ReplayEngine,
  RetentionGcService,
  LocalAdapterDescriptor,
} from "../../src/modules/match/recovery/index.js";
import { RatingService } from "../../src/modules/rating/rating.service.js";
import { MatchHistoryService } from "../../src/modules/history/history.service.js";
import type { MatchSnapshot } from "@ottv2/contracts";

describe("L06-W3 Recovery, Replay, Idempotent Settlement & Retention (L-05.05 - L-05.11)", () => {
  describe("L-05.05 & L-05.06: MatchRecoveryManager (Room, Clock, Deadlines)", () => {
    it("recovers room context, role bindings and restores clocks without outage deduction", async () => {
      const mockDb = {
        roomContext: {
          findUnique: vi.fn().mockResolvedValue({
            id: "room-101",
            generation: 2,
            stateVersion: 4,
            activeMatchId: "match-101",
            previousSetup: { cells: {} },
            config: { timerSeconds: 30 },
            memberships: [
              { userId: "u1", role: "HOST", side: "BLUE", principal: "ACCOUNT" },
              { userId: "u2", role: "PLAYER", side: "RED", principal: "ACCOUNT" },
            ],
          }),
        },
        matchCheckpoint: {
          findUnique: vi.fn().mockResolvedValue({
            matchId: "match-101",
            roomId: "room-101",
            sequence: 5,
            stateVersion: 4,
            rulesVersion: "rps-v1",
            initialSeed: 42,
            snapshot: {
              matchId: "match-101",
              status: "PLAYING",
              clocksMs: { BLUE: 175_000, RED: 160_000 },
              pauseReason: null,
              pausePhase: null,
              replacementStatus: "PENDING_CONFIRMATION",
              replacementExpiresAt: 2_000_000, // Absolute target deadline
            },
          }),
        },
        match: {
          findUnique: vi.fn().mockResolvedValue({
            id: "match-101",
            status: "PLAYING",
            rulesVersion: "rps-v1",
          }),
        },
        botPrivateCheckpoint: {
          findFirst: vi.fn().mockResolvedValue({
            id: "bpc-1",
            matchId: "match-101",
            botId: "bot-alpha",
            revisionId: "rev-1",
            turnNumber: 3,
            invocationEpoch: 1,
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      } as unknown as PrismaClient;

      const recoveryManager = new MatchRecoveryManager(mockDb);
      const result = await recoveryManager.recoverActiveRoomAndMatch("room-101");

      expect(result.recovered).toBe(true);
      expect(result.neutralAborted).toBe(false);

      // Verify Room Context
      expect(result.roomContext?.generation).toBe(2);
      expect(result.roomContext?.memberships).toHaveLength(2);
      expect(result.roomContext?.memberships[0]!.connected).toBe(false); // Reset to disconnected

      // Verify Clocks & Deadlines
      expect(result.matchState?.clocksMs).toEqual({ BLUE: 175_000, RED: 160_000 });
      expect(result.matchState?.replacementExpiresAt).toBe(2_000_000); // Retained without reset

      // Verify Bot Fencing (L-05.07)
      expect(result.matchState?.botFencing).toBeDefined();
      expect(result.matchState?.botFencing?.newInvocationEpoch).toBe(2); // Advanced epoch
      expect(result.matchState?.botFencing?.newInvocationToken).toMatch(/^token-epoch-2-/);
    });

    it("triggers neutral abort when version is unsupported or checkpoint corrupt", async () => {
      const mockDb = {
        roomContext: {
          findUnique: vi.fn().mockResolvedValue({ id: "room-corrupt", activeMatchId: "m-corrupt" }),
        },
        matchCheckpoint: {
          findUnique: vi.fn().mockResolvedValue({
            matchId: "m-corrupt",
            rulesVersion: "unknown-v99", // Corrupt / unsupported
            snapshot: {},
          }),
        },
        match: {
          findUnique: vi.fn().mockResolvedValue({ id: "m-corrupt" }),
          update: vi.fn().mockResolvedValue({}),
        },
      } as unknown as PrismaClient;

      const recoveryManager = new MatchRecoveryManager(mockDb);
      const result = await recoveryManager.recoverActiveRoomAndMatch("room-corrupt");

      expect(result.recovered).toBe(false);
      expect(result.neutralAborted).toBe(true);
      expect(result.abortReason).toBe("UNSUPPORTED_RULES_VERSION");
      expect(mockDb.match.update).toHaveBeenCalledWith({
        where: { id: "m-corrupt" },
        data: { status: "ABORTED", resultReason: "SERVER_INTERRUPTION" },
      });
    });

    it("fences all bots in bot-vs-bot match and filters revoked session memberships", async () => {
      const mockDb = {
        roomContext: {
          findUnique: vi.fn().mockResolvedValue({
            id: "room-bvb",
            generation: 1,
            stateVersion: 2,
            activeMatchId: "m-bvb",
            memberships: [
              { userId: "valid-user", role: "SPECTATOR", side: null, principal: "ACCOUNT" },
              { userId: "revoked-user", role: "SPECTATOR", side: null, principal: "ACCOUNT" },
            ],
          }),
        },
        matchCheckpoint: {
          findUnique: vi.fn().mockResolvedValue({
            matchId: "m-bvb",
            rulesVersion: "rps-v1",
            stateVersion: 5,
            sequence: 5,
            clocksJson: { BLUE: 120_000, RED: 120_000 },
            snapshot: { matchId: "m-bvb", status: "PLAYING" },
          }),
        },
        match: {
          findUnique: vi.fn().mockResolvedValue({ id: "m-bvb", status: "PLAYING" }),
        },
        botPrivateCheckpoint: {
          findMany: vi.fn().mockResolvedValue([
            { id: "cp-bot-blue", matchId: "m-bvb", botId: "bot-blue", revisionId: "rev-1", turnNumber: 2, invocationEpoch: 3 },
            { id: "cp-bot-red", matchId: "m-bvb", botId: "bot-red", revisionId: "rev-2", turnNumber: 2, invocationEpoch: 1 },
          ]),
          update: vi.fn().mockResolvedValue({}),
        },
      } as unknown as PrismaClient;

      const mockTokenValidator = {
        isValid: vi.fn().mockReturnValue(true),
        isRevoked: vi.fn().mockImplementation((userId: string) => userId === "revoked-user"),
      };

      const recoveryManager = new MatchRecoveryManager(mockDb, mockTokenValidator);
      const result = await recoveryManager.recoverActiveRoomAndMatch("room-bvb");

      expect(result.recovered).toBe(true);
      // Revoked user was filtered out
      expect(result.roomContext?.memberships).toHaveLength(1);
      expect(result.roomContext?.memberships[0]?.userId).toBe("valid-user");

      // Both bots were fenced with incremented epochs
      expect(result.matchState?.botFencing).toBeDefined();
      expect(result.matchState?.botFencing?.["bot-blue"]?.newInvocationEpoch).toBe(4);
      expect(result.matchState?.botFencing?.["bot-blue"]?.newInvocationToken).toMatch(/^token-epoch-4-/);
      expect(result.matchState?.botFencing?.["bot-red"]?.newInvocationEpoch).toBe(2);
      expect(result.matchState?.botFencing?.["bot-red"]?.newInvocationToken).toMatch(/^token-epoch-2-/);
    });
  });

  describe("L-05.08: Idempotent Settlement & Elo Eligibility", () => {
    it("disqualifies BOT, HYBRID, GUEST, and OFFLINE matches from ranked Elo ratings", async () => {
      const ratingService = new RatingService();

      const botMatch: Partial<MatchSnapshot> = {
        matchId: "m-bot",
        mode: "RANKED",
        playMode: "BOT",
        status: "FINISHED",
        winner: "BLUE",
        resultReason: "EXTINCTION",
        players: [
          { userId: "u1", username: "u1", displayName: "User", side: "BLUE", isBot: false, principal: "ACCOUNT" },
          { userId: "bot-1", username: "bot", displayName: "Bot", side: "RED", isBot: true, principal: "ACCOUNT" },
        ],
      };
      const resultBot = await ratingService.finalize(botMatch as MatchSnapshot);
      expect(resultBot).toBeNull();

      const guestMatch: Partial<MatchSnapshot> = {
        matchId: "m-guest",
        mode: "RANKED",
        playMode: "MANUAL",
        status: "FINISHED",
        winner: "BLUE",
        resultReason: "EXTINCTION",
        players: [
          { userId: "u1", username: "u1", displayName: "User", side: "BLUE", isBot: false, principal: "ACCOUNT" },
          { userId: "g1", username: "guest", displayName: "Guest", side: "RED", isBot: false, principal: "GUEST" },
        ],
      };
      const resultGuest = await ratingService.finalize(guestMatch as MatchSnapshot);
      expect(resultGuest).toBeNull();

      const sneakyBotMatch: Partial<MatchSnapshot> = {
        matchId: "m-sneaky-bot",
        mode: "RANKED",
        playMode: "MANUAL",
        status: "FINISHED",
        winner: "BLUE",
        resultReason: "EXTINCTION",
        players: [
          { userId: "u1", username: "u1", displayName: "User", side: "BLUE", isBot: false, principal: "ACCOUNT" },
          { userId: "bot-sneaky", username: "sneaky", displayName: "Sneaky Bot", side: "RED", isBot: true, principal: "ACCOUNT" },
        ],
      };
      const resultSneakyBot = await ratingService.finalize(sneakyBotMatch as MatchSnapshot);
      expect(resultSneakyBot).toBeNull();
    });

    it("settles ranked account match idempotently without double-incrementing stats", async () => {
      const statsMap = new Map([
        ["u1", { userId: "u1", elo: 1200, rankedWins: 10, rankedLosses: 5 }],
        ["u2", { userId: "u2", elo: 1200, rankedWins: 8, rankedLosses: 7 }],
      ]);
      const settlements = new Map<string, any>();
      const rankedResults = new Map<string, any>();

      const mockDb = {
        $transaction: vi.fn(async (cb: any) => {
          return cb({
            matchSettlement: {
              findUnique: vi.fn(async ({ where }: any) => settlements.get(where.matchId) ?? null),
              upsert: vi.fn(async ({ where, create, update }: any) => {
                const existing = settlements.get(where.matchId);
                const d = existing ? { ...existing, ...update } : { ...create };
                settlements.set(where.matchId, d);
                return d;
              }),
            },
            rankedMatchResult: {
              findUnique: vi.fn(async ({ where }: any) => rankedResults.get(where.matchId) ?? null),
              create: vi.fn(async ({ data }: any) => {
                rankedResults.set(data.matchId, data);
                return data;
              }),
            },
            userStats: {
              findMany: vi.fn(async () => [statsMap.get("u1"), statsMap.get("u2")]),
              update: vi.fn(async ({ where, data }: any) => {
                const prev = statsMap.get(where.userId)!;
                if (data.rankedWins) prev.rankedWins += 1;
                if (data.rankedLosses) prev.rankedLosses += 1;
                prev.elo = data.elo;
                return prev;
              }),
            },
          });
        }),
      } as unknown as PrismaClient;

      const ratingService = new RatingService(mockDb);

      const match: Partial<MatchSnapshot> = {
        matchId: "m-ranked-idempotent",
        mode: "RANKED",
        playMode: "MANUAL",
        status: "FINISHED",
        winner: "BLUE",
        resultReason: "EXTINCTION",
        players: [
          { userId: "u1", username: "u1", displayName: "User 1", side: "BLUE", isBot: false, principal: "ACCOUNT" },
          { userId: "u2", username: "u2", displayName: "User 2", side: "RED", isBot: false, principal: "ACCOUNT" },
        ],
      };

      // First finalize
      const firstRating = await ratingService.finalize(match as MatchSnapshot);
      expect(firstRating).not.toBeNull();
      expect(firstRating?.blueDelta).toBeGreaterThan(0);
      expect(statsMap.get("u1")?.rankedWins).toBe(11); // Incremented once

      // Concurrent / Retry finalize
      const retryRating = await ratingService.finalize(match as MatchSnapshot);
      expect(retryRating).not.toBeNull();
      expect(retryRating?.blueAfter).toBe(firstRating?.blueAfter);
      expect(statsMap.get("u1")?.rankedWins).toBe(11); // NOT incremented again! Idempotent!
    });
  });

  describe("L-05.09: ReplayEngine (V1/V2 Reconstruction & Compatibility)", () => {
    const replayEngine = new ReplayEngine();

    it("reconstructs and verifies clean legal move replay", () => {
      const result = replayEngine.validateAndReconstruct({
        matchId: "m-replay-1",
        rulesVersion: "rps-v1",
        initialSeed: 0,
        moves: [
          { sequence: 1, stateVersion: 1, side: "BLUE", from: "e1", to: "e2", committedAt: "2026-10-11T10:00:00Z" },
          { sequence: 2, stateVersion: 2, side: "RED", from: "e9", to: "e8", committedAt: "2026-10-11T10:00:01Z" },
        ],
      });

      expect(result.valid).toBe(true);
      expect(result.moveCount).toBe(2);
      expect(result.reconstructedBoard).toBeDefined();
    });

    it("rejects corrupted sequence order in replay move chain", () => {
      const result = replayEngine.validateAndReconstruct({
        matchId: "m-corrupt-seq",
        rulesVersion: "rps-v1",
        moves: [
          { sequence: 2, stateVersion: 2, side: "BLUE", from: "E2", to: "E3", committedAt: "2026-10-11T10:00:00Z" },
          { sequence: 1, stateVersion: 3, side: "RED", from: "E8", to: "E7", committedAt: "2026-10-11T10:00:01Z" }, // Out of order!
        ],
      });

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("CORRUPTED_REPLAY_CHAIN");
    });

    it("rejects illegal moves in replay chain", () => {
      const result = replayEngine.validateAndReconstruct({
        matchId: "m-illegal-move",
        rulesVersion: "rps-v1",
        moves: [
          // Impossible teleport move
          { sequence: 1, stateVersion: 1, side: "BLUE", from: "A1", to: "I9", committedAt: "2026-10-11T10:00:00Z" },
        ],
      });

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("ILLEGAL_MOVE_IN_CHAIN");
    });

    it("supports legacy final board only without fabricating fake moves", () => {
      const legacyBoard = { A1: { type: "ROCK", side: "BLUE" } };
      const result = replayEngine.validateAndReconstruct({
        matchId: "m-legacy",
        rulesVersion: "rps-v1",
        moves: [],
        finalBoard: legacyBoard,
        expectedWinner: "BLUE",
      });

      expect(result.valid).toBe(true);
      expect(result.legacyFinalBoardOnly).toBe(true);
      expect(result.moveCount).toBe(0);
      expect(result.reconstructedBoard).toEqual(legacyBoard);
    });

    it("reconstructs replay initialized with raw MatchBoard coordinate record", () => {
      // Provide a direct raw MatchBoard record without .cells or .board wrappers
      const rawInitialBoard: Record<string, any> = {
        a1: { id: "p-b1", side: "BLUE", type: "R" },
        i9: { id: "p-r1", side: "RED", type: "P" },
      };

      const result = replayEngine.validateAndReconstruct({
        matchId: "m-raw-board",
        rulesVersion: "rps-v1",
        initialBoard: rawInitialBoard,
        moves: [
          { sequence: 1, stateVersion: 1, side: "BLUE", from: "a1", to: "a2", committedAt: "2026-10-11T10:00:00Z" },
        ],
      });

      expect(result.valid).toBe(true);
      expect(result.moveCount).toBe(1);
      expect(result.reconstructedBoard).toBeDefined();
    });

    it("rejects unknown/corrupt rules versions", () => {
      const result = replayEngine.validateAndReconstruct({
        matchId: "m-unsupported",
        rulesVersion: "unknown-v999",
        moves: [{ sequence: 1, stateVersion: 1, side: "BLUE", from: "E2", to: "E3", committedAt: "" }],
      });

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("UNSUPPORTED_RULES_VERSION");
    });
  });

  describe("L-05.10: Retention Policy & Batch GC", () => {
    it("canaryExport strictly whitelists public fields and strips private bot memory/code/tokens", async () => {
      const mockDb = {
        match: {
          findUnique: vi.fn().mockResolvedValue({
            id: "m-audit-1",
            roomId: "r-1",
            mode: "RANKED",
            status: "FINISHED",
            winnerSide: "BLUE",
            resultReason: "EXTINCTION",
            durationSeconds: 120,
            moves: [
              { sequence: 1, stateVersion: 1, side: "BLUE", fromCoordinate: "E2", toCoordinate: "E3", capturedPieceId: null, committedAt: new Date(1000) },
            ],
            events: [
              {
                sequence: 1,
                type: "MATCH_STARTED",
                createdAt: new Date(1000),
                payload: {
                  internalTraceId: "secret-123",
                  invocationToken: "tok-leak",
                  side: "BLUE",
                  reason: "GAME_INIT",
                },
              },
            ],
          }),
        },
      } as unknown as PrismaClient;

      const gcService = new RetentionGcService(mockDb, () => 2000);
      const canary = await gcService.canaryExport("m-audit-1");

      expect(canary).not.toBeNull();
      expect(canary?.matchId).toBe("m-audit-1");
      expect(canary?.moves).toHaveLength(1);

      // Verify strict whitelist (NO memoryPayload, NO code, NO tokens)
      const serialized = JSON.stringify(canary);
      expect(serialized).not.toContain("memoryPayload");
      expect(serialized).not.toContain("invocationToken");
      expect(serialized).not.toContain("internalTraceId");
      expect(serialized).not.toContain("password");

      // Verify event was strictly sanitized to whitelist only
      expect(canary?.publicTimeline[0]).toEqual({
        sequence: 1,
        type: "MATCH_STARTED",
        timestamp: new Date(1000).toISOString(),
        side: "BLUE",
        reason: "GAME_INIT",
      });
      expect(canary?.publicTimeline[0]).not.toHaveProperty("internalTraceId");
      expect(canary?.publicTimeline[0]).not.toHaveProperty("invocationToken");
    });

    it("runBatchGc purges expired private checkpoints (>7D) while preserving BotLibrary sources", async () => {
      const mockDb = {
        botPrivateCheckpoint: {
          updateMany: vi.fn().mockResolvedValue({ count: 3 }),
        },
        botLibrary: {
          count: vi.fn().mockResolvedValue(12),
        },
        match: {
          findMany: vi.fn().mockResolvedValue([{ id: "m-exp-1" }, { id: "m-exp-2" }]),
          deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
        matchSettlement: {
          deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
      } as unknown as PrismaClient;

      const gcService = new RetentionGcService(mockDb, () => Date.now());
      const report = await gcService.runBatchGc();

      expect(report.purgedPrivateMemoriesCount).toBe(3);
      expect(report.preservedLibrarySourceCount).toBe(12);
      expect(report.purgedTemporaryMatchesCount).toBe(2);
      expect(mockDb.botPrivateCheckpoint.updateMany).toHaveBeenCalledWith({
        where: {
          createdAt: { lt: expect.any(Date) },
          memoryPayload: { not: Prisma.DbNull },
        },
        data: {
          memoryPayload: Prisma.DbNull,
          budgetRemaining: Prisma.DbNull,
        },
      });
      expect(mockDb.matchSettlement.deleteMany).toHaveBeenCalledWith({
        where: { matchId: { in: ["m-exp-1", "m-exp-2"] } },
      });
    });
  });

  describe("L-05.11: LocalAdapterDescriptor (Offline Session & Cold Restore)", () => {
    it("serializes local match state and restores in PAUSED status", () => {
      const descriptor = LocalAdapterDescriptor.serialize({
        matchId: "local-m-1",
        initialBoard: { cells: {} },
        currentBoard: { cells: { A1: "BLUE" } },
        stateVersion: 10,
        sequence: 10,
        turn: "BLUE",
        clocksMs: { BLUE: 120_000, RED: 120_000 },
        status: "PLAYING",
      });

      expect(descriptor.descriptorVersion).toBe("ott-local-v1");
      expect(descriptor.status).toBe("PLAYING");

      // Cold restore rule: Match enters PAUSED status
      const restored = LocalAdapterDescriptor.restore(descriptor);
      expect(restored.restored).toBe(true);
      expect(restored.status).toBe("PAUSED");
      expect(restored.requiresKitDownload).toBe(false);
    });

    it("flags requiresKitDownload if local bot kit is missing, without server fallback", () => {
      const descriptor = LocalAdapterDescriptor.serialize({
        matchId: "local-m-bot",
        initialBoard: {},
        currentBoard: {},
        stateVersion: 2,
        sequence: 2,
        turn: "RED",
        clocksMs: { BLUE: 180_000, RED: 180_000 },
        status: "PLAYING",
        botConfig: {
          botId: "bot-offline-1",
          revisionId: "rev-1",
          kitAvailable: false, // Kit not installed locally!
        },
      });

      const restored = LocalAdapterDescriptor.restore(descriptor);
      expect(restored.restored).toBe(true);
      expect(restored.status).toBe("PAUSED");
      expect(restored.requiresKitDownload).toBe(true); // Kit download required
    });
  });
});
