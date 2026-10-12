import { describe, expect, it } from "vitest";
import {
  // Projections & Canary Scan (L-02.08)
  canaryScan,
  projectPublicSnapshot,
  projectViewerResponse,
  
  // Compatibility Adapter (L-02.12)
  adaptSnapshotV1ToV2,
  adaptSnapshotV2ToV1,
  
  // Bounds & Pagination (L-02.13)
  validateJsonDepth,
  validateUtf8ByteLength,
  PaginationQuerySchema,
  createPaginatedResponseSchema,
  MAX_JSON_PAYLOAD_BYTES,
  MAX_SOURCE_BYTES,
  z,
} from "@ottv2/contracts";


describe("L02-W2 Contract Suite: Projections, Compatibility & Bounds", () => {
  describe("Visibility Projections and Canary Scan (L-02.08)", () => {
    it("canaryScan detects sensitive keys and canary string values", () => {
      const cleanData = {
        matchId: "11111111-1111-4111-8111-111111111111",
        board: { a1: null },
        score: 42,
      };
      expect(canaryScan(cleanData).clean).toBe(true);
      expect(canaryScan(cleanData).leaks).toHaveLength(0);

      // Leaks via sensitive keys
      const dirtyKeyData = {
        matchId: "11111111-1111-4111-8111-111111111111",
        pythonSource: "import os",
        botMemory: { secret: 123 },
      };
      const keyScan = canaryScan(dirtyKeyData);
      expect(keyScan.clean).toBe(false);
      expect(keyScan.leaks).toContain("pythonSource");
      expect(keyScan.leaks).toContain("botMemory");

      // Leaks via canary token values
      const dirtyValueData = {
        info: "prefix __CANARY_SECRET_TOKEN__ suffix",
      };
      const valScan = canaryScan(dirtyValueData);
      expect(valScan.clean).toBe(false);
      expect(valScan.leaks.some((l) => l.includes("__CANARY_SECRET_TOKEN__"))).toBe(true);
    });

    it("projectPublicSnapshot uses strict whitelist and eliminates private internal fields", () => {
      const emptyBoard = Object.fromEntries(
        Array.from({ length: 81 }, (_, i) => [
          `${String.fromCharCode(97 + (i % 9))}${Math.floor(i / 9) + 1}`,
          null,
        ])
      );

      const rawInternalState = {
        matchId: "22222222-2222-4222-8222-222222222222",
        roomId: "ROOM01",
        mode: "UNRANKED" as const,
        status: "PLAYING" as const,
        players: [
          { userId: "u1", username: "u1", displayName: "User 1", side: "BLUE" as const, ready: true, connected: true },
          { userId: "u2", username: "u2", displayName: "User 2", side: "RED" as const, ready: true, connected: true },
        ],
        board: emptyBoard,
        pieceCounts: { BLUE: { R: 6, P: 6, S: 6 }, RED: { R: 6, P: 6, S: 6 } },
        currentTurn: "BLUE" as const,
        winner: null,
        resultReason: null,
        clocksMs: { BLUE: 30000, RED: 30000 },
        runningSide: "BLUE" as const,
        serverTime: 1700000000000,
        sequence: 1,
        stateVersion: 1,
        // Private fields that must be stripped:
        sourceCode: "def choose_move(): pass",
        privateMemory: { weights: [0.1, 0.2] },
        turnToken: "super_secret_token",
        internalLogs: ["debug log 1"],
      };

      const publicSnapshot = projectPublicSnapshot(rawInternalState);

      // Must be clean of canaries
      expect(canaryScan(publicSnapshot).clean).toBe(true);
      expect((publicSnapshot as any).sourceCode).toBeUndefined();
      expect((publicSnapshot as any).privateMemory).toBeUndefined();
      expect((publicSnapshot as any).turnToken).toBeUndefined();
      expect((publicSnapshot as any).internalLogs).toBeUndefined();
      expect(publicSnapshot.matchId).toBe(rawInternalState.matchId);
      expect(publicSnapshot.status).toBe("PLAYING");
    });

    it("projectViewerResponse isolates viewer-specific context", () => {
      const response = projectViewerResponse({
        principalId: "u1",
        role: "PLAYER",
        side: "BLUE",
        isHost: true,
        matchStatus: "PLAYING",
        currentTurn: "BLUE",
      });

      expect(response).toEqual({
        role: "PLAYER",
        viewerSide: "BLUE",
        isHost: true,
        allowedActions: expect.arrayContaining(["MOVE", "SURRENDER"]),
      });
    });
  });

  describe("Compatibility Adapter 0.1 <-> 0.2 (L-02.12)", () => {
    const emptyBoard = Object.fromEntries(
      Array.from({ length: 81 }, (_, i) => [
        `${String.fromCharCode(97 + (i % 9))}${Math.floor(i / 9) + 1}`,
        null,
      ])
    );

    const snapshotV1 = {
      matchId: "33333333-3333-4333-8333-333333333333",
      roomId: "ROOM02",
      mode: "UNRANKED" as const,
      playMode: "MANUAL" as const,
      status: "PLAYING" as const,
      players: [
        { userId: "u1", username: "u1", displayName: "User 1", side: "BLUE" as const, ready: true, connected: true },
      ],
      board: emptyBoard,
      pieceCounts: { BLUE: { R: 3, P: 3, S: 3 }, RED: { R: 3, P: 3, S: 3 } },
      currentTurn: "BLUE" as const,
      winner: null,
      resultReason: null,
      clocksMs: { BLUE: 30000, RED: 30000 },
      timerSeconds: 30,
      countdownEndsAt: null,
      sequence: 2,
      stateVersion: 1,
      rating: null,
    };

    it("adaptSnapshotV1ToV2 converts 0.1 snapshot to 0.2 compact format", () => {
      const v2 = adaptSnapshotV1ToV2(snapshotV1, 1700000000000);
      expect(v2.matchId).toBe(snapshotV1.matchId);
      expect(v2.stateVersion).toBe(1);
      expect(v2.serverTime).toBe(1700000000000);
      expect(v2.runningSide).toBe("BLUE");
    });

    it("adaptSnapshotV2ToV1 converts 0.2 snapshot to 0.1 legacy format", () => {
      const snapshotV2 = adaptSnapshotV1ToV2(snapshotV1, 1700000000000);
      const backToV1 = adaptSnapshotV2ToV1(snapshotV2);
      expect(backToV1.matchId).toBe(snapshotV1.matchId);
      expect(backToV1.playMode).toBe("MANUAL");
      expect(backToV1.timerSeconds).toBe(30);
    });

    it("rejects unknown versions safely", () => {
      expect(() => adaptSnapshotV1ToV2({ ...snapshotV1, protocolVersion: "9.9" } as any, 1000)).toThrow();
    });
  });

  describe("Bounds and Pagination (L-02.13)", () => {
    it("validateJsonDepth enforces max depth of 10 to prevent DoS recursion", () => {
      const shallow = { a: { b: { c: 1 } } };
      expect(validateJsonDepth(shallow, 10)).toBe(true);

      // Create object with depth 12
      let deep: any = { leaf: true };
      for (let i = 0; i < 12; i++) {
        deep = { child: deep };
      }
      expect(validateJsonDepth(deep, 10)).toBe(false);
    });

    it("validateUtf8ByteLength counts UTF-8 bytes accurately", () => {
      // 4 bytes in ASCII
      expect(validateUtf8ByteLength("test", 10)).toBe(true);
      expect(validateUtf8ByteLength("test", 3)).toBe(false);

      // Vietnamese characters: 'ế' is 3 bytes in UTF-8
      const vnStr = "Tiếng Việt";
      const byteLen = new TextEncoder().encode(vnStr).length;
      expect(validateUtf8ByteLength(vnStr, byteLen)).toBe(true);
      expect(validateUtf8ByteLength(vnStr, byteLen - 1)).toBe(false);

      expect(MAX_JSON_PAYLOAD_BYTES).toBe(128 * 1024);
      expect(MAX_SOURCE_BYTES).toBe(64 * 1024);
    });

    it("PaginationQuerySchema and createPaginatedResponseSchema enforce bounds", () => {
      expect(PaginationQuerySchema.safeParse({ limit: 20 }).success).toBe(true);
      expect(PaginationQuerySchema.safeParse({ limit: 100 }).success).toBe(false); // Max 50
      expect(PaginationQuerySchema.safeParse({ limit: -1 }).success).toBe(false);

      const StringPageSchema = createPaginatedResponseSchema(z.string());
      const validPage = {
        items: ["item1", "item2"],
        nextCursor: "cursor_abc",
        hasMore: true,
      };
      expect(StringPageSchema.safeParse(validPage).success).toBe(true);

      const invalidPage = {
        items: [123],
        nextCursor: null,
        hasMore: false,
      };
      expect(StringPageSchema.safeParse(invalidPage).success).toBe(false);
    });
  });
});
