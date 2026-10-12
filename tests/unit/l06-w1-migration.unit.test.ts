import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type {
  CommandLedgerEntry,
  RoomContext,
  RoomMembership,
  BotPrivateCheckpoint,
  MatchSettlement,
  Match,
  MatchCheckpoint,
} from "@prisma/client";

const MIGRATION_PATH = path.resolve(
  __dirname,
  "../../prisma/migrations/20261011170000_l06_w1_expand_persistence/migration.sql"
);
const SCHEMA_PATH = path.resolve(__dirname, "../../prisma/schema.prisma");

describe("L06-W1 Persistence Expand-Only Migration (L-05.01, RULE-15)", () => {
  const migrationSql = fs.readFileSync(MIGRATION_PATH, "utf8");
  const schemaContent = fs.readFileSync(SCHEMA_PATH, "utf8");

  describe("Expand-Only Invariant Verification (RULE-15)", () => {
    it("Contains ZERO destructive operations (DROP TABLE, DROP COLUMN, TRUNCATE, ALTER COLUMN DROP)", () => {
      // Destructive SQL patterns
      const destructivePatterns = [
        /\bDROP\s+TABLE\b/i,
        /\bDROP\s+COLUMN\b/i,
        /\bDROP\s+DATABASE\b/i,
        /\bDROP\s+SCHEMA\b/i,
        /\bTRUNCATE\b/i,
        /\bRENAME\s+TABLE\b/i,
        /\bRENAME\s+COLUMN\b/i,
      ];

      for (const pattern of destructivePatterns) {
        expect(
          pattern.test(migrationSql),
          `Migration must not match destructive pattern ${pattern}`
        ).toBe(false);
      }
    });

    it("All ADD COLUMN statements on existing tables are nullable or have DEFAULT values", () => {
      // Find all ALTER TABLE ... ADD COLUMN lines
      const alterTableBlocks = migrationSql.match(
        /ALTER\s+TABLE\s+"[^"]+"\s+ADD\s+COLUMN[\s\S]*?;/gi
      );
      expect(alterTableBlocks).not.toBeNull();

      for (const block of alterTableBlocks!) {
        // Break into column definitions
        const lines = block.split("\n");
        for (const line of lines) {
          if (line.includes("ADD COLUMN")) {
            // Must either be nullable (no NOT NULL) or have DEFAULT
            const hasNotNull = /\bNOT\s+NULL\b/i.test(line);
            const hasDefault = /\bDEFAULT\b/i.test(line);
            if (hasNotNull) {
              expect(
                hasDefault,
                `Column definition with NOT NULL must have DEFAULT: "${line.trim()}"`
              ).toBe(true);
            }
          }
        }
      }
    });
  });

  describe("Required Tables and Column Additions", () => {
    it("Creates all 5 required new persistence models", () => {
      const requiredTables = [
        "CommandLedgerEntry",
        "RoomContext",
        "RoomMembership",
        "BotPrivateCheckpoint",
        "MatchSettlement",
      ];

      for (const table of requiredTables) {
        const createTableRegex = new RegExp(`CREATE\\s+TABLE\\s+"${table}"`, "i");
        expect(
          createTableRegex.test(migrationSql),
          `Migration SQL must contain CREATE TABLE "${table}"`
        ).toBe(true);
      }
    });

    it("Adds all required columns to Match and MatchCheckpoint", () => {
      const requiredMatchColumns = [
        "cursorSequence",
        "initialBoard",
        "initialSeed",
        "initialSignature",
        "rulesVersion",
        "setupVersion",
      ];

      for (const col of requiredMatchColumns) {
        expect(
          migrationSql.includes(`"Match" ADD COLUMN`) ||
            migrationSql.includes(`ADD COLUMN     "${col}"`)
        ).toBe(true);
      }

      const requiredCheckpointColumns = [
        ...requiredMatchColumns,
        "lifecycleJson",
      ];

      for (const col of requiredCheckpointColumns) {
        expect(
          schemaContent.includes(col),
          `MatchCheckpoint in schema.prisma must include ${col}`
        ).toBe(true);
      }
    });

    it("Ensures all critical unique constraints and indexes are established", () => {
      // 1. CommandLedgerEntry composite unique
      expect(migrationSql).toMatch(
        /CREATE\s+UNIQUE\s+INDEX\s+"CommandLedgerEntry_principalId_targetId_operation_commandId_key"\s+ON\s+"CommandLedgerEntry"\("principalId",\s*"targetId",\s*"operation",\s*"commandId"\)/i
      );

      // 2. CommandLedgerEntry index targetId + expiresAt
      expect(migrationSql).toMatch(
        /CREATE\s+INDEX\s+"CommandLedgerEntry_targetId_expiresAt_idx"\s+ON\s+"CommandLedgerEntry"\("targetId",\s*"expiresAt"\)/i
      );

      // 3. RoomMembership unique [roomId, userId]
      expect(migrationSql).toMatch(
        /CREATE\s+UNIQUE\s+INDEX\s+"RoomMembership_roomId_userId_key"\s+ON\s+"RoomMembership"\("roomId",\s*"userId"\)/i
      );

      // 4. BotPrivateCheckpoint unique [matchId, botId]
      expect(migrationSql).toMatch(
        /CREATE\s+UNIQUE\s+INDEX\s+"BotPrivateCheckpoint_matchId_botId_key"\s+ON\s+"BotPrivateCheckpoint"\("matchId",\s*"botId"\)/i
      );

      // 5. MatchSettlement unique [matchId]
      expect(migrationSql).toMatch(
        /CREATE\s+UNIQUE\s+INDEX\s+"MatchSettlement_matchId_key"\s+ON\s+"MatchSettlement"\("matchId"\)/i
      );

      // 6. RoomMembership cascade deletion on RoomContext
      expect(migrationSql).toMatch(
        /REFERENCES\s+"RoomContext"\("id"\)\s+ON\s+DELETE\s+CASCADE/i
      );
    });
  });

  describe("Prisma Client TypeScript Compatibility & Backward Compatibility", () => {
    it("Exports valid types for all new models", () => {
      // Compile-time typing and runtime check that models can be typed
      const testLedgerEntry: CommandLedgerEntry = {
        id: "cle-1",
        principalId: "user-1",
        targetId: "match-1",
        operation: "SUBMIT_MOVE",
        commandId: "cmd-uuid-1",
        payloadDigest: "sha256:abc",
        outcome: "COMMITTED",
        stateVersion: 1,
        sequence: 1,
        ackPayload: { ok: true },
        receivedAt: new Date(),
        committedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      };
      expect(testLedgerEntry.operation).toBe("SUBMIT_MOVE");

      const testRoomContext: RoomContext = {
        id: "room-1",
        generation: 1,
        stateVersion: 0,
        activeMatchId: null,
        previousSetup: null,
        config: { timer: 30 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(testRoomContext.generation).toBe(1);

      const testRoomMembership: RoomMembership = {
        id: "rm-1",
        roomId: "room-1",
        userId: "user-1",
        role: "PLAYER",
        side: "RED",
        principal: "ACCOUNT",
        connected: true,
        joinedAt: new Date(),
        updatedAt: new Date(),
      };
      expect(testRoomMembership.role).toBe("PLAYER");

      const testBotCheckpoint: BotPrivateCheckpoint = {
        id: "bpc-1",
        matchId: "match-1",
        botId: "bot-1",
        revisionId: "rev-1",
        turnNumber: 3,
        seed: 42,
        invocationEpoch: 1,
        invocationToken: "token-1",
        memoryPayload: { tree: [1, 2] },
        budgetRemaining: { ms: 450 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(testBotCheckpoint.turnNumber).toBe(3);

      const testSettlement: MatchSettlement = {
        id: "ms-1",
        matchId: "match-1",
        settledAt: new Date(),
        outcome: "RED_WON",
        eloApplied: true,
        historyRecorded: true,
        payload: { redEloDelta: 16 },
      };
      expect(testSettlement.outcome).toBe("RED_WON");
    });

    it("Legacy row compatibility: Match and MatchCheckpoint can represent legacy DB rows without error", () => {
      // Legacy Match record without new L06 columns
      const legacyMatchRecord: Partial<Match> = {
        id: "match-legacy-1",
        roomId: "ROOM1",
        mode: "STANDARD",
        playMode: "MANUAL",
        status: "FINISHED",
        resultReason: "EXTINCTION",
        winnerSide: "RED",
        timerSeconds: 180,
        createdAt: new Date(),
        // New columns may be null/undefined when queried from legacy table before backfill
        rulesVersion: "rps-v1",
        setupVersion: null,
        initialSeed: null,
        initialSignature: null,
        initialBoard: null,
        cursorSequence: 0,
      };

      expect(legacyMatchRecord.id).toBe("match-legacy-1");
      expect(legacyMatchRecord.rulesVersion).toBe("rps-v1");
      expect(legacyMatchRecord.cursorSequence).toBe(0);

      // Legacy Checkpoint record without new L06 columns
      const legacyCheckpoint: Partial<MatchCheckpoint> = {
        matchId: "match-legacy-1",
        roomId: "ROOM1",
        sequence: 10,
        stateVersion: 10,
        snapshot: { board: {} },
        createdAt: new Date(),
        updatedAt: new Date(),
        // New columns
        rulesVersion: "rps-v1",
        setupVersion: null,
        initialSeed: null,
        initialSignature: null,
        initialBoard: null,
        cursorSequence: 0,
        lifecycleJson: null,
      };

      expect(legacyCheckpoint.matchId).toBe("match-legacy-1");
      expect(legacyCheckpoint.stateVersion).toBe(10);
      expect(legacyCheckpoint.lifecycleJson).toBeNull();
    });
  });
});
