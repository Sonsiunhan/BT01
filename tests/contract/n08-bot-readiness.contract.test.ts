import { describe, expect, it } from "vitest";
import {
  BotReadinessItemSchema,
  BotReadinessJobSchema,
  BotReadinessJobStateSchema,
  BotReadinessReceiptSchema,
  BotReadinessRecheckRequestSchema,
  BotReadinessSelectionRequestSchema,
  BotReadinessSnapshotSchema,
  BotReadinessStatusSchema,
} from "@ottv2/contracts";

const now = "2026-10-23T08:00:00.000Z";
const receipt = { receiptId: "11111111-1111-4111-8111-111111111111", outcome: "ACCEPTED", code: "READY", completedAt: now, safeMessage: "Bot đã sẵn sàng." };
const target = { targetContextRef: "brt_aaaaaaaaaaaaaaaaaaaaaaaa", configVersionNumber: 1, ruleVersion: "rps-v1", sdkVersion: "bot-sdk-v1", schemaVersion: "bot-state-v1", runtimeProfile: "WASMTIME_SUPERVISOR", policyVersion: "policy-v1", sourceDigestPrefix: "aaaaaaaaaaaa" };

describe("N08 bot readiness contract", () => {
  it("exposes only the canonical public state and queue state machines", () => {
    expect(BotReadinessStatusSchema.options).toEqual(["NOT_SUBMITTED", "PENDING", "CHECKING", "READY", "INCOMPATIBLE", "BLOCKED_INFRA", "STALE"]);
    expect(BotReadinessJobStateSchema.options).toEqual(["QUEUED", "CHECKING", "SUCCEEDED", "BOT_REJECTED", "BLOCKED_INFRA", "STALE", "CANCELLED"]);
    expect(BotReadinessStatusSchema.safeParse("MISSING").success).toBe(false);
    expect(BotReadinessStatusSchema.safeParse("INVALID").success).toBe(false);
    expect(BotReadinessJobStateSchema.safeParse("FAILED").success).toBe(false);
  });

  it("rejects client-supplied ownership and target authority", () => {
    expect(BotReadinessSelectionRequestSchema.safeParse({
      botId: "bot-1", revisionId: "rev-1", expectedEnrollmentRevision: 0, idempotencyKey: "select-01",
      ownerUserId: "attacker", sourceDigest: "a".repeat(64), targetContextRef: "brt_forged",
    }).success).toBe(false);
  });

  it("requires safe receipt/job projections and rejects private runtime data", () => {
    expect(BotReadinessReceiptSchema.safeParse({ ...receipt, sourceDigest: "private", privateLog: ["secret"], stderr: "secret" }).success).toBe(false);
    expect(BotReadinessJobSchema.safeParse({
      jobId: "22222222-2222-4222-8222-222222222222", tournamentId: "t-1", enrollmentId: "e-1", targetContextRef: target.targetContextRef,
      state: "SUCCEEDED", status: "READY", retryable: false, retryAfterMs: null, safeReason: "READY", receipt,
      createdAt: now, updatedAt: now, completedAt: now, diagnostic: "private",
    }).success).toBe(false);
  });

  it("models the not-applicable surface and metadata-only item projection", () => {
    expect(BotReadinessSnapshotSchema.parse({ tournamentId: "human", applicable: false, notApplicableMessage: "Không áp dụng.", items: [], nextCursor: null, evaluatedAt: now })).toMatchObject({ applicable: false });
    const item = BotReadinessItemSchema.parse({
      enrollmentId: "e-1", tournamentId: "t-1", personKey: "P1", displayName: "Người chơi", status: "READY", revision: 2,
      botId: "bot-1", revisionId: "rev-1", revisionNumber: 1, target, receipt, safeReason: "READY", retryable: false,
      retryAfterMs: null, permittedActions: { canSelect: false, canRecheck: true }, updatedAt: now,
    });
    const publicJson = JSON.stringify(item);
    // The public target deliberately carries a *truncated* source digest.  The
    // guard is against raw source and runtime diagnostics, not that safe
    // metadata field itself.
    expect(publicJson).not.toContain('"source":');
    expect(publicJson).not.toMatch(/memory|private|stderr|traceback/i);
  });

  it("requires a bounded recheck command", () => {
    expect(BotReadinessRecheckRequestSchema.safeParse({ enrollmentId: "e-1", expectedEnrollmentRevision: 1, idempotencyKey: "retry-01" }).success).toBe(true);
    expect(BotReadinessRecheckRequestSchema.safeParse({ enrollmentId: "e-1", expectedEnrollmentRevision: -1, idempotencyKey: "short" }).success).toBe(false);
  });
});
