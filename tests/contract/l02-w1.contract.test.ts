import { describe, expect, it } from "vitest";
import {
  // Version
  PROTOCOL_VERSION_V2,
  ProtocolVersionSchema,
  
  // Modes & Actors (L-02.01)
  MatchEnvironmentSchema,
  MatchControllerSchema,
  GameModeConfigSchema,
  validateGameModeConfig,
  PrincipalKindSchema,
  RoomRoleSchema,
  RoomMemberContextSchema,
  
  // Command & ACK (L-02.03, L-02.04)
  CommandEnvelopeSchema,
  AckOutcomeSchema,
  AckEnvelopeSchema,
  MatchMoveCommandSchema,
  
  // Errors (L-02.11)
  ErrorSeverityV2Schema,
  PublicErrorCodeV2Schema,
  ErrorReasonV2Schema,
  ErrorDetailsV2Schema,
  ErrorEnvelopeV2Schema,
  
  // Snapshots & Pulse (L-02.05)
  CompactMatchSnapshotSchema,
  FullSyncSnapshotSchema,
  ClockPulseSchema,
  ViewerContextSchema,
  
  // Events & Cursor (L-02.06)
  EventScopeSchema,
  DomainEventEnvelopeSchema,
  formatEventCursor,
  parseEventCursor,
  
  // Bot ABI (L-02.09)
  BotStateDtoSchema,
  BotMoveResponseDtoSchema,
  TrustedInvocationDtoSchema,
  TrustedResultDtoSchema,
} from "@ottv2/contracts";

describe("L02-W1 Contract 0.2-rc1 Suite", () => {
  describe("Protocol Version", () => {
    it("exports PROTOCOL_VERSION_V2 as 0.2 and validates against ProtocolVersionSchema", () => {
      expect(PROTOCOL_VERSION_V2).toBe("0.2");
      expect(ProtocolVersionSchema.safeParse("0.2").success).toBe(true);
      expect(ProtocolVersionSchema.safeParse("0.1").success).toBe(true);
      expect(ProtocolVersionSchema.safeParse("0.3").success).toBe(false);
    });
  });

  describe("Mode, Controller and Actor Contracts (L-02.01)", () => {
    it("validates legal mode configurations per matrix", () => {
      // Online Human vs Human Ranked (Account)
      const onlineRankedHuman = {
        environment: "ONLINE" as const,
        mode: "RANKED" as const,
        controllers: { BLUE: "HUMAN" as const, RED: "HUMAN" as const },
        training: false,
      };
      expect(GameModeConfigSchema.safeParse(onlineRankedHuman).success).toBe(true);
      expect(validateGameModeConfig(onlineRankedHuman, { isGuest: false }).valid).toBe(true);

      // Ranked is forbidden for Guest
      const guestRanked = validateGameModeConfig(onlineRankedHuman, { isGuest: true });
      expect(guestRanked.valid).toBe(false);
      expect(guestRanked.reason).toBe("GUEST_CANNOT_PLAY_RANKED");

      // Offline Human vs Human cannot be Ranked
      const offlineRanked = {
        environment: "OFFLINE" as const,
        mode: "RANKED" as const,
        controllers: { BLUE: "HUMAN" as const, RED: "HUMAN" as const },
        training: false,
      };
      expect(validateGameModeConfig(offlineRanked, { isGuest: false }).valid).toBe(false);

      // Bot vs Bot Online cannot be Ranked
      const botOnlineRanked = {
        environment: "ONLINE" as const,
        mode: "RANKED" as const,
        controllers: { BLUE: "PYTHON" as const, RED: "PYTHON" as const },
        training: false,
      };
      expect(validateGameModeConfig(botOnlineRanked, { isGuest: false }).valid).toBe(false);

      // Training mode allows Human vs Python or Python vs Python
      const trainingMode = {
        environment: "OFFLINE" as const,
        mode: "UNRANKED" as const,
        controllers: { BLUE: "HUMAN" as const, RED: "PYTHON" as const },
        training: true,
      };
      expect(validateGameModeConfig(trainingMode, { isGuest: false }).valid).toBe(true);
    });

    it("enforces actor role boundaries and principal invariants", () => {
      expect(RoomRoleSchema.safeParse("PLAYER").success).toBe(true);
      expect(RoomRoleSchema.safeParse("REFEREE").success).toBe(true);
      expect(RoomRoleSchema.safeParse("SPECTATOR").success).toBe(true);
      expect(RoomRoleSchema.safeParse("REPLACEMENT_CANDIDATE").success).toBe(true);
      expect(RoomRoleSchema.safeParse("ADMIN").success).toBe(false);

      // Guest cannot be Referee
      const guestReferee = {
        principalId: "guest_123",
        principalKind: "GUEST" as const,
        role: "REFEREE" as const,
        isHost: false,
      };
      expect(RoomMemberContextSchema.safeParse(guestReferee).success).toBe(false);

      // Valid account referee
      const accountReferee = {
        principalId: "usr_456",
        principalKind: "ACCOUNT" as const,
        role: "REFEREE" as const,
        isHost: true,
      };
      expect(RoomMemberContextSchema.safeParse(accountReferee).success).toBe(true);
    });
  });

  describe("HTTP Command & ACK Envelopes (L-02.03, L-02.04)", () => {
    it("validates command envelopes and prevents client-injected side/winner", () => {
      const validMoveCmd = {
        protocolVersion: "0.2",
        commandId: "11111111-1111-4111-8111-111111111111",
        matchId: "22222222-2222-4222-8222-222222222222",
        stateVersion: 17,
        payload: {
          from: "b2",
          to: "b3",
        },
      };
      expect(MatchMoveCommandSchema.safeParse(validMoveCmd).success).toBe(true);

      // Injected side or winner should be rejected
      const tamperedCmd = {
        ...validMoveCmd,
        payload: {
          from: "b2",
          to: "b3",
          side: "BLUE",
          winner: "BLUE",
        },
      };
      expect(MatchMoveCommandSchema.safeParse(tamperedCmd).success).toBe(false);
    });

    it("validates ACK envelope structure", () => {
      const ack = {
        protocolVersion: "0.2",
        commandId: "11111111-1111-4111-8111-111111111111",
        outcome: "COMMITTED" as const,
        targetId: "22222222-2222-4222-8222-222222222222",
        stateVersion: 18,
        sequence: 42,
        data: { success: true },
      };
      expect(AckEnvelopeSchema.safeParse(ack).success).toBe(true);
    });
  });

  describe("Error Envelope & Reason Catalog (L-02.11)", () => {
    it("validates standard error envelope with Vietnamese message and bounded details", () => {
      const err = {
        code: "CONFLICT",
        message: "Phiên bản trạng thái đã cũ, vui lòng đồng bộ lại",
        retryable: false,
        severity: "RECOVERABLE",
        details: {
          reason: "STALE_VERSION",
          targetId: "22222222-2222-4222-8222-222222222222",
          currentVersion: 18,
          submittedVersion: 17,
          retryAfterMs: 500,
        },
      };
      expect(ErrorEnvelopeV2Schema.safeParse(err).success).toBe(true);
    });

    it("enforces bounded issues list in validation errors", () => {
      const issues = Array.from({ length: 20 }, (_, i) => `Issue ${i}`);
      const errWithExcessIssues = {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu gửi lên không hợp lệ",
        retryable: false,
        severity: "INVALID",
        details: {
          reason: "SCHEMA_VALIDATION_FAILED",
          issues,
        },
      };
      // Must truncate or reject when > 16 issues
      expect(ErrorEnvelopeV2Schema.safeParse(errWithExcessIssues).success).toBe(false);
    });

    it("supports all required error codes and reasons from FRS-L02", () => {
      const codes = [
        "VALIDATION_ERROR",
        "UNAUTHORIZED",
        "CONFLICT",
        "RATE_LIMITED",
        "NOT_FOUND",
        "INTERNAL_ERROR",
        "SERVICE_UNAVAILABLE",
        "PROTOCOL_VERSION_MISMATCH",
      ];
      for (const code of codes) {
        expect(PublicErrorCodeV2Schema.safeParse(code).success).toBe(true);
      }

      const reasons = [
        "STALE_VERSION",
        "WRONG_TURN",
        "COMMAND_ID_REUSED",
        "COMMAND_EXPIRED",
        "MATCH_PAUSED",
        "MATCH_TERMINAL",
        "NO_LEGAL_MOVES",
        "GUEST_CANNOT_PLAY_RANKED",
        "GUEST_CANNOT_BE_REFEREE",
        "SETUP_VERSION_UNSUPPORTED",
        "RATE_LIMIT_EXCEEDED",
      ];
      for (const reason of reasons) {
        expect(ErrorReasonV2Schema.safeParse(reason).success).toBe(true);
      }
    });
  });

  describe("Snapshot, Full Sync & Clock Pulse Contracts (L-02.05)", () => {
    const emptyBoard = Object.fromEntries(
      Array.from({ length: 81 }, (_, i) => [
        `${String.fromCharCode(97 + (i % 9))}${Math.floor(i / 9) + 1}`,
        null,
      ])
    );

    it("compact live snapshot excludes whole move history and initial setup", () => {
      const compactSnapshot = {
        matchId: "22222222-2222-4222-8222-222222222222",
        roomId: "ROOM01",
        mode: "UNRANKED",
        status: "PLAYING",
        players: [
          { userId: "u1", username: "u1", displayName: "User 1", side: "BLUE", ready: true, connected: true },
          { userId: "u2", username: "u2", displayName: "User 2", side: "RED", ready: true, connected: true },
        ],
        board: emptyBoard,
        pieceCounts: { BLUE: { R: 6, P: 6, S: 6 }, RED: { R: 6, P: 6, S: 6 } },
        currentTurn: "BLUE",
        winner: null,
        resultReason: null,
        clocksMs: { BLUE: 30000, RED: 30000 },
        runningSide: "BLUE",
        serverTime: 1700000000000,
        sequence: 5,
        stateVersion: 5,
      };

      expect(CompactMatchSnapshotSchema.safeParse(compactSnapshot).success).toBe(true);
      
      // If historical moves are included, it should not be allowed on Compact schema
      const snapshotWithMoves = {
        ...compactSnapshot,
        moves: [{ sequence: 1, from: "a1", to: "a2" }],
      };
      expect(CompactMatchSnapshotSchema.safeParse(snapshotWithMoves).success).toBe(false);
    });

    it("full sync snapshot contains watermark and setup descriptor", () => {
      const fullSync = {
        matchId: "22222222-2222-4222-8222-222222222222",
        roomId: "ROOM01",
        mode: "UNRANKED",
        status: "PLAYING",
        players: [],
        board: emptyBoard,
        pieceCounts: { BLUE: { R: 6, P: 6, S: 6 }, RED: { R: 6, P: 6, S: 6 } },
        currentTurn: "BLUE",
        winner: null,
        resultReason: null,
        clocksMs: { BLUE: 30000, RED: 30000 },
        runningSide: "BLUE",
        serverTime: 1700000000000,
        sequence: 5,
        stateVersion: 5,
        setupDescriptor: {
          rulesVersion: "rps-v2",
          seed: 1411200,
        },
        watermark: {
          lastCommittedSequence: 5,
          lastCommittedStateVersion: 5,
          timestamp: 1700000000000,
        },
      };

      expect(FullSyncSnapshotSchema.safeParse(fullSync).success).toBe(true);
    });

    it("clock pulse is ephemeral and rejects board payload", () => {
      const pulse = {
        matchId: "22222222-2222-4222-8222-222222222222",
        stateVersion: 5,
        referenceSequence: 5,
        serverTime: 1700000001000,
        clocksMs: { BLUE: 29000, RED: 30000 },
        runningSide: "BLUE",
        pauseElapsedMs: 0,
        pulseSequence: 1,
      };
      expect(ClockPulseSchema.safeParse(pulse).success).toBe(true);

      const invalidPulseWithBoard = {
        ...pulse,
        board: emptyBoard,
      };
      expect(ClockPulseSchema.safeParse(invalidPulseWithBoard).success).toBe(false);
    });

    it("viewer context is calculated separately from shared snapshot", () => {
      const viewerCtx = {
        role: "PLAYER",
        viewerSide: "BLUE",
        isHost: true,
        allowedActions: ["MOVE", "SURRENDER", "STOP"],
      };
      expect(ViewerContextSchema.safeParse(viewerCtx).success).toBe(true);
    });
  });

  describe("Event Union & Cursor Format (L-02.06)", () => {
    it("formats and parses domain event cursors", () => {
      const cursor = formatEventCursor("MATCH", "match_uuid_123", 42);
      expect(cursor).toBe("MATCH:match_uuid_123:42");

      const parsed = parseEventCursor(cursor);
      expect(parsed).toEqual({
        scope: "MATCH",
        targetGeneration: "match_uuid_123",
        sequence: 42,
      });

      expect(parseEventCursor("INVALID_CURSOR")).toBeNull();
      expect(parseEventCursor("MATCH:uuid:-5")).toBeNull();
    });

    it("validates domain event envelope with typed scopes", () => {
      const event = {
        protocolVersion: "0.2",
        messageId: "11111111-1111-4111-8111-111111111111",
        type: "PIECE_MOVE_ACCEPTED",
        timestamp: 1700000000000,
        scope: "MATCH",
        targetId: "22222222-2222-4222-8222-222222222222",
        sequence: 7,
        stateVersion: 5,
        payload: {
          from: "b2",
          to: "b3",
          capturedPieceId: null,
        },
      };
      expect(DomainEventEnvelopeSchema.safeParse(event).success).toBe(true);
    });
  });

  describe("Bot ABI DTO Contracts (L-02.09)", () => {
    it("validates Bot state and move response DTOs", () => {
      const moveResp = {
        move: { from: "b2", to: "b3" },
        memory: { visitedNodes: 154, strategy: "aggressive" },
      };
      expect(BotMoveResponseDtoSchema.safeParse(moveResp).success).toBe(true);
    });

    it("validates trusted invocation and result DTOs", () => {
      const invocation = {
        matchId: "22222222-2222-4222-8222-222222222222",
        stateVersion: 10,
        invocationId: "33333333-3333-4333-8333-333333333333",
        turnToken: "token_abc123",
        activeRevision: "rev_v1",
        budgets: {
          computeMs: 1000,
          memoryMb: 128,
        },
      };
      expect(TrustedInvocationDtoSchema.safeParse(invocation).success).toBe(true);

      const result = {
        invocationId: "33333333-3333-4333-8333-333333333333",
        move: { from: "c2", to: "c3" },
        memory: { round: 5 },
        computeMs: 145,
      };
      expect(TrustedResultDtoSchema.safeParse(result).success).toBe(true);
    });
  });
});
