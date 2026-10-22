import { describe, expect, it } from "vitest";
import {
  BotReadinessStatusSchema,
  BotReadinessReceiptSchema,
  BotReadinessSelectionRequestSchema,
  BotReadinessRecheckRequestSchema,
} from "@ottv2/contracts";

describe("N08 bot readiness contract", () => {
  it("exposes only the canonical public state machine", () => {
    expect(BotReadinessStatusSchema.options).toEqual([
      "NOT_SUBMITTED",
      "PENDING",
      "CHECKING",
      "READY",
      "INCOMPATIBLE",
      "BLOCKED_INFRA",
      "STALE",
    ]);
    expect(BotReadinessStatusSchema.safeParse("MISSING").success).toBe(false);
    expect(BotReadinessStatusSchema.safeParse("INVALID").success).toBe(false);
  });

  it("rejects client supplied ownership, digest and target fields", () => {
    const selection = BotReadinessSelectionRequestSchema.safeParse({
      botId: "bot-1",
      revisionId: "rev-1",
      expectedEnrollmentRevision: 0,
      idempotencyKey: "select-1",
      ownerUserId: "attacker",
      sourceDigest: "a".repeat(64),
      tournamentId: "forged-target",
    });
    expect(selection.success).toBe(false);
  });

  it("requires a bounded retry request and keeps receipts safe", () => {
    expect(BotReadinessRecheckRequestSchema.safeParse({
      enrollmentId: "enrollment-1",
      expectedEnrollmentRevision: 1,
      idempotencyKey: "retry-01",
    }).success).toBe(true);
    expect(BotReadinessReceiptSchema.safeParse({
      outcome: "ACCEPTED",
      code: "READY",
      completedAt: new Date().toISOString(),
      safeMessage: "Bot đã sẵn sàng.",
      sourceDigest: "private-source",
      privateLog: ["secret"],
    }).success).toBe(false);
  });
});
