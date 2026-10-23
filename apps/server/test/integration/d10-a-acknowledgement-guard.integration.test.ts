import { describe, expect, it } from "vitest";
import { PrismaTournamentAcknowledgementGuard } from "../../src/modules/tournament-core/acknowledgement-guard.js";

function databaseFixture(overrides: Record<string, unknown> = {}) {
  const tx = {
    tournament: {
      findUnique: async () => ({ id: "tour-1", contractId: "contract-1", activeConfigVersionId: "version-2" }),
      findFirst: async () => ({ id: "tour-1" }),
    },
    tournamentConfigVersionRecord: {
      findUnique: async () => ({
        id: "version-2",
        tournamentId: "tour-1",
        versionNumber: 2,
        effectiveAt: new Date("2026-10-23T00:00:00.000Z"),
        coreConfigSnapshot: { rulesAckRequired: true, regulationsFull: "Điều lệ kiểm thử", rulesQuickSummary: "Tóm tắt" },
        ruleProfileSnapshot: {},
        publishedByUserId: "admin-1",
        changeSummary: "test",
        createdAt: new Date("2026-10-23T00:00:00.000Z"),
      }),
      findFirst: async () => ({
        id: "version-2", tournamentId: "tour-1", versionNumber: 2,
        effectiveAt: new Date("2026-10-23T00:00:00.000Z"),
        coreConfigSnapshot: { rulesAckRequired: true, regulationsFull: "Điều lệ kiểm thử", rulesQuickSummary: "Tóm tắt" },
      }),
    },
    tournamentEnrollmentRecord: {
      findMany: async () => [{ userId: "player-1" }],
      findFirst: async () => ({ id: "enrollment-1" }),
    },
    tournamentRulesAcknowledgement: {
      findUnique: async () => overrides.acknowledged ? ({ id: "ack-1", acknowledgedAt: new Date("2026-10-23T00:00:00.000Z"), evidenceKind: "AUTHENTICATED_EXPLICIT_ACK" }) : null,
    },
    $transaction: async (callback: (client: any) => Promise<unknown>) => callback(tx),
  };
  return tx;
}

describe("D10-A acknowledgement guard", () => {
  it("fails closed when an enrolled account has no current-version acknowledgement", async () => {
    const db = databaseFixture();
    const guard = new PrismaTournamentAcknowledgementGuard(db as any);

    await expect(guard.assertReadyForStart("tour-1", "version-2")).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: "RULES_ACK_REQUIRED" },
    });
  });

  it("accepts an acknowledgement only for the exact current version", async () => {
    const db = databaseFixture({ acknowledged: true });
    const guard = new PrismaTournamentAcknowledgementGuard(db as any);

    await expect(guard.assertReadyForStart("tour-1", "version-2")).resolves.toBeUndefined();
  });

  it("rejects a stale version before reading any client supplied ACK state", async () => {
    const db = databaseFixture({ acknowledged: true });
    const guard = new PrismaTournamentAcknowledgementGuard(db as any);

    await expect(guard.assertReadyForStart("tour-1", "version-1")).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: "STALE_RULE_VERSION" },
    });
  });
});
