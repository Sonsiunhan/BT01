import { describe, expect, it } from "vitest";
import {
  // Error Catalog & Factory (L-02.11)
  ERROR_CATALOG_V2,
  createErrorEnvelopeV2,
  ErrorEnvelopeV2Schema,
  type ErrorReasonV2,
  
  // Fixtures & Drift Prevention (L-02.04, L-02.07, L-02.10, L-02.14)
  createMoveAckFixture,
  createCompactSnapshotFixture,
  createFullSyncSnapshotFixture,
  createClockPulseFixture,
  createViewerResponseFixture,
  createDomainEventFixture,
  createBotMoveResponseFixture,
  
  // Schemas for assertion
  AckEnvelopeSchema,
  CompactMatchSnapshotSchema,
  FullSyncSnapshotSchema,
  ClockPulseSchema,
  ViewerContextSchema,
  DomainEventEnvelopeSchema,
  BotMoveResponseDtoSchema,
} from "@ottv2/contracts";

describe("L02-W3 Contract Suite: Provider/Consumer Verification & Error Matrix", () => {
  describe("Error Matrix Verification (L-02.11)", () => {
    it("provides complete canonical error catalog for all rows in FRS-L02 Table 6", () => {
      const requiredReasons: ErrorReasonV2[] = [
        "SCHEMA_VALIDATION_FAILED",
        "ILLEGAL_MOVE",
        "INVALID_COORDINATES",
        "SESSION_REVOKED",
        "SESSION_EXPIRED",
        "INVALID_CREDENTIALS",
        "FORBIDDEN_ROLE",
        "GUEST_CANNOT_PLAY_RANKED",
        "GUEST_CANNOT_BE_REFEREE",
        "CONTROLLER_MISMATCH",
        "RESOURCE_NOT_FOUND",
        "ROOM_NOT_FOUND",
        "MATCH_NOT_FOUND",
        "STALE_VERSION",
        "WRONG_TURN",
        "COMMAND_ID_REUSED",
        "COMMAND_EXPIRED",
        "MATCH_PAUSED",
        "MATCH_TERMINAL",
        "PROTOCOL_VERSION_MISMATCH",
        "SETUP_VERSION_UNSUPPORTED",
        "PAYLOAD_TOO_LARGE",
        "SOURCE_TOO_LARGE",
        "RATE_LIMIT_EXCEEDED",
        "SETUP_ENTROPY_UNAVAILABLE",
        "SETUP_PERSIST_FAILED",
        "RUNTIME_UNAVAILABLE",
        "CAPACITY_EXCEEDED",
        "DATABASE_UNAVAILABLE",
        "SETUP_PREVIOUS_INVALID",
        "CHECKPOINT_RESTORE_FAILED",
        "RULE_STATE_INVALID",
        "SETUP_SEED_INVALID",
      ];

      for (const reason of requiredReasons) {
        const entry = ERROR_CATALOG_V2[reason];
        expect(entry, `Missing catalog entry for ${reason}`).toBeDefined();
        expect(entry.statusCode).toBeGreaterThanOrEqual(400);
        expect(entry.statusCode).toBeLessThan(600);
        expect(typeof entry.message).toBe("string");
        expect(entry.message.length).toBeGreaterThan(0);
      }
    });

    it("verifies retryability and severity semantics across all error rows", () => {
      // 400 Validation errors must be non-retryable and INVALID
      const valErr = createErrorEnvelopeV2("SCHEMA_VALIDATION_FAILED", {
        issues: ["Field x is required"],
      });
      expect(valErr.statusCode).toBe(400);
      expect(valErr.envelope.retryable).toBe(false);
      expect(valErr.envelope.severity).toBe("INVALID");
      expect(ErrorEnvelopeV2Schema.safeParse(valErr.envelope).success).toBe(true);

      // 401 Session revoked must be FATAL_SESSION
      const revokedErr = createErrorEnvelopeV2("SESSION_REVOKED");
      expect(revokedErr.statusCode).toBe(401);
      expect(revokedErr.envelope.severity).toBe("FATAL_SESSION");
      expect(revokedErr.envelope.retryable).toBe(false);

      // 401 Invalid credentials must be INVALID (not FATAL_SESSION, doesn't wipe existing session)
      const credsErr = createErrorEnvelopeV2("INVALID_CREDENTIALS");
      expect(credsErr.statusCode).toBe(401);
      expect(credsErr.envelope.severity).toBe("INVALID");

      // 403 Forbidden role must be INVALID
      const forbiddenErr = createErrorEnvelopeV2("FORBIDDEN_ROLE");
      expect(forbiddenErr.statusCode).toBe(403);
      expect(forbiddenErr.envelope.severity).toBe("INVALID");

      // 409 Conflict must be RECOVERABLE and non-retryable without resync
      const conflictErr = createErrorEnvelopeV2("STALE_VERSION", {
        currentVersion: 18,
        submittedVersion: 17,
      });
      expect(conflictErr.statusCode).toBe(409);
      expect(conflictErr.envelope.severity).toBe("RECOVERABLE");
      expect(conflictErr.envelope.retryable).toBe(false);
      expect(conflictErr.envelope.details.currentVersion).toBe(18);

      // 429 Rate limited must be RECOVERABLE and retryable with retryAfterMs
      const rateErr = createErrorEnvelopeV2("RATE_LIMIT_EXCEEDED", {
        retryAfterMs: 1500,
      });
      expect(rateErr.statusCode).toBe(429);
      expect(rateErr.envelope.retryable).toBe(true);
      expect(rateErr.envelope.severity).toBe("RECOVERABLE");
      expect(rateErr.envelope.details.retryAfterMs).toBe(1500);

      // 503 Service unavailable (transient infra) must be retryable
      const dbErr = createErrorEnvelopeV2("DATABASE_UNAVAILABLE");
      expect(dbErr.statusCode).toBe(503);
      expect(dbErr.envelope.retryable).toBe(true);
      expect(dbErr.envelope.severity).toBe("RECOVERABLE");

      // 503 Setup previous invalid (structural failure) must NOT be retryable
      const prevErr = createErrorEnvelopeV2("SETUP_PREVIOUS_INVALID");
      expect(prevErr.statusCode).toBe(503);
      expect(prevErr.envelope.retryable).toBe(false);
      expect(prevErr.envelope.severity).toBe("INVALID");

      // 500 Internal error must be non-retryable and INVALID
      const internalErr = createErrorEnvelopeV2("RULE_STATE_INVALID");
      expect(internalErr.statusCode).toBe(500);
      expect(internalErr.envelope.retryable).toBe(false);
      expect(internalErr.envelope.severity).toBe("INVALID");
    });
  });

  describe("Provider & Consumer Fixtures Verification (L-02.04, L-02.07, L-02.10, L-02.14)", () => {
    it("validates Move ACK fixture against AckEnvelopeSchema", () => {
      const ack = createMoveAckFixture({
        commandId: "11111111-1111-4111-8111-111111111111",
        matchId: "22222222-2222-4222-8222-222222222222",
        stateVersion: 10,
        sequence: 15,
      });
      expect(AckEnvelopeSchema.safeParse(ack).success).toBe(true);
      expect(ack.outcome).toBe("COMMITTED");
    });

    it("validates Compact Snapshot fixture without extraneous or private fields", () => {
      const compact = createCompactSnapshotFixture({
        matchId: "22222222-2222-4222-8222-222222222222",
        roomId: "ROOM01",
      });
      expect(CompactMatchSnapshotSchema.safeParse(compact).success).toBe(true);
    });

    it("validates Full Sync fixture with watermark and setup descriptor", () => {
      const fullSync = createFullSyncSnapshotFixture({
        matchId: "22222222-2222-4222-8222-222222222222",
        roomId: "ROOM01",
        seed: 1411200,
      });
      expect(FullSyncSnapshotSchema.safeParse(fullSync).success).toBe(true);
      expect(fullSync.setupDescriptor.rulesVersion).toBe("rps-v2");
    });

    it("validates Clock Pulse fixture rejecting board payload", () => {
      const pulse = createClockPulseFixture({
        matchId: "22222222-2222-4222-8222-222222222222",
        stateVersion: 10,
      });
      expect(ClockPulseSchema.safeParse(pulse).success).toBe(true);
    });

    it("validates Viewer Response fixture isolating role and permissions", () => {
      const viewer = createViewerResponseFixture({
        role: "PLAYER",
        side: "BLUE",
        isHost: true,
      });
      expect(ViewerContextSchema.safeParse(viewer).success).toBe(true);
      expect(viewer.allowedActions).toContain("MOVE");
    });

    it("validates Domain Event fixture across scopes", () => {
      const matchEvent = createDomainEventFixture("MATCH", {
        matchId: "22222222-2222-4222-8222-222222222222",
        type: "PIECE_MOVE_ACCEPTED",
        sequence: 12,
        stateVersion: 8,
      });
      expect(DomainEventEnvelopeSchema.safeParse(matchEvent).success).toBe(true);

      const roomEvent = createDomainEventFixture("ROOM", {
        roomId: "ROOM01",
        type: "ROOM_MEMBER_JOINED",
        sequence: 3,
        stateVersion: 1,
      });
      expect(DomainEventEnvelopeSchema.safeParse(roomEvent).success).toBe(true);
    });

    it("validates Bot Move Response fixture format", () => {
      const botResp = createBotMoveResponseFixture({
        from: "b2",
        to: "b3",
        memory: { round: 1 },
      });
      expect(BotMoveResponseDtoSchema.safeParse(botResp).success).toBe(true);
    });
  });
});
