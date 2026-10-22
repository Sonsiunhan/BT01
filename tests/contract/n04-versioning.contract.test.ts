import { describe, expect, it } from "vitest";
import {
  ComparatorGoalDistanceSchema,
  ComparatorPolicySchema,
  PublishRuleVersionInputSchema,
  RuleVersionDiffResponseSchema,
  RuleVersionListResponseSchema,
} from "@ottv2/contracts";

describe("N04 versioning contracts", () => {
  it("accepts the bounded publish boundary", () => {
    const result = PublishRuleVersionInputSchema.parse({
      expectedRevision: 4,
      profileRef: { draftId: "draft-4", revision: 7 },
      profileDigest: "a".repeat(64),
      reason: "Cập nhật comparator theo điều lệ đã duyệt",
      effectiveAt: "2026-10-24T08:00:00.000Z",
      idempotencyKey: "publish-4",
    });
    expect(result.expectedRevision).toBe(4);
  });

  it("keeps pagination and diff responses machine-checkable", () => {
    expect(RuleVersionListResponseSchema.parse({ items: [], nextCursor: null, configRevision: 4 })).toEqual({
      items: [], nextCursor: null, configRevision: 4,
    });
    expect(RuleVersionDiffResponseSchema.parse({
      baseVersionId: "v1", targetVersionId: "v2", changes: [], sameDigest: false, oldMatchesUnaffected: true,
    }).oldMatchesUnaffected).toBe(true);
  });

  it("rejects invalid digest, excessive reason and inconsistent goal reachability", () => {
    expect(() => PublishRuleVersionInputSchema.parse({
      expectedRevision: 4, profileRef: { draftId: "draft-4", revision: 7 }, profileDigest: "bad", reason: "ok", effectiveAt: "2026-10-24T08:00:00.000Z", idempotencyKey: "publish-4",
    })).toThrow();
    expect(() => ComparatorGoalDistanceSchema.parse({ reachable: false, distance: 2 })).toThrow();
  });

  it("keeps MANUAL exact-tie independent from drawEnabled and rejects all-zero weights", () => {
    const base = {
      version: "comparator-v1",
      criteriaOrder: ["GOAL_DISTANCE"],
      materialWeights: { R: 1, P: 0, S: 0 },
      goalDistanceEnabled: true,
      mobilityEnabled: false,
      eventPolicies: { noLegalMove: "COMPARE_CRITERIA", ownTurnViolation: "LOSS", infrastructure: "NEUTRAL" },
      drawEnabled: false,
      finalTiePolicy: "MANUAL",
      manual: { timeoutSeconds: 300, fallback: "SECOND_MOVER_WINS" },
    } as const;
    expect(ComparatorPolicySchema.parse(base)).toMatchObject({ finalTiePolicy: "MANUAL", drawEnabled: false });
    expect(() => ComparatorPolicySchema.parse({ ...base, materialWeights: { R: 0, P: 0, S: 0 } })).toThrow(/trọng số/i);
    expect(() => ComparatorPolicySchema.parse({ ...base, eventPolicies: { ...base.eventPolicies, noLegalMove: "DRAW" } })).toThrow(/drawEnabled/i);
    expect(() => ComparatorPolicySchema.parse({ ...base, manual: { timeoutSeconds: 300, fallback: "DRAW" } })).toThrow(/drawEnabled/i);
  });
});
