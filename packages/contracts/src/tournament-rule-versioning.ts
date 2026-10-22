import { z } from "zod";

export const ComparatorCriterionSchema = z.enum([
  "WEIGHTED_MATERIAL",
  "GOAL_DISTANCE",
  "MOBILITY",
]);
export type ComparatorCriterion = z.infer<typeof ComparatorCriterionSchema>;

export const ComparatorReasonCodeSchema = z.enum([
  "WEIGHTED_MATERIAL",
  "GOAL_DISTANCE",
  "MOBILITY",
  "FINAL_TIE_POLICY",
  "MANUAL_EXACT_TIE",
  "NO_LEGAL_MOVE_WIN",
  "NO_LEGAL_MOVE_LOSS",
  "NO_LEGAL_MOVE_DRAW",
  "INFRASTRUCTURE_NEUTRAL",
  "OWN_TURN_VIOLATION",
]);
export type ComparatorReasonCode = z.infer<typeof ComparatorReasonCodeSchema>;

const boundedWeight = z.number().finite().min(0).max(1000).refine(
  (value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-9,
  "Trọng số chỉ được có tối đa 3 chữ số thập phân.",
);

export const ComparatorPolicySchema = z.object({
  version: z.string().trim().min(1).max(64),
  criteriaOrder: z.array(ComparatorCriterionSchema).min(1).max(3).refine(
    (criteria) => new Set(criteria).size === criteria.length,
    "criteriaOrder không được lặp tiêu chí.",
  ),
  materialWeights: z.object({ R: boundedWeight, P: boundedWeight, S: boundedWeight }),
  goalDistanceEnabled: z.boolean(),
  mobilityEnabled: z.boolean(),
  eventPolicies: z.object({
    noLegalMove: z.enum(["COMPARE_CRITERIA", "WIN", "LOSS", "DRAW"]),
    ownTurnViolation: z.literal("LOSS"),
    infrastructure: z.literal("NEUTRAL"),
  }),
  drawEnabled: z.boolean(),
  finalTiePolicy: z.enum(["FIRST_MOVER_WINS", "SECOND_MOVER_WINS", "MANUAL"]),
  manual: z.object({
    timeoutSeconds: z.number().int().min(1).max(3600),
    fallback: z.enum(["FIRST_MOVER_WINS", "SECOND_MOVER_WINS", "DRAW"]),
  }),
}).superRefine((policy, ctx) => {
  if (!policy.goalDistanceEnabled && policy.criteriaOrder.includes("GOAL_DISTANCE")) {
    ctx.addIssue({ code: "custom", path: ["criteriaOrder"], message: "GOAL_DISTANCE đang tắt nhưng vẫn nằm trong criteriaOrder." });
  }
  if (!policy.mobilityEnabled && policy.criteriaOrder.includes("MOBILITY")) {
    ctx.addIssue({ code: "custom", path: ["criteriaOrder"], message: "MOBILITY đang tắt nhưng vẫn nằm trong criteriaOrder." });
  }
  if (!policy.drawEnabled && policy.eventPolicies.noLegalMove === "DRAW") {
    ctx.addIssue({ code: "custom", path: ["eventPolicies", "noLegalMove"], message: "NO_LEGAL_MOVE DRAW yêu cầu drawEnabled." });
  }
  if (!policy.drawEnabled && policy.manual.fallback === "DRAW") {
    ctx.addIssue({ code: "custom", path: ["manual", "fallback"], message: "Manual fallback DRAW yêu cầu drawEnabled." });
  }
  if (policy.materialWeights.R === 0 && policy.materialWeights.P === 0 && policy.materialWeights.S === 0) {
    ctx.addIssue({ code: "custom", path: ["materialWeights"], message: "Comparator không được có toàn bộ trọng số và tiêu chí bằng 0." });
  }
});
export type ComparatorPolicyDto = z.infer<typeof ComparatorPolicySchema>;

export const ComparatorGoalDistanceSchema = z.object({
  reachable: z.boolean(),
  distance: z.number().int().nonnegative().nullable(),
}).superRefine((value, ctx) => {
  if (value.reachable && value.distance === null) {
    ctx.addIssue({ code: "custom", path: ["distance"], message: "Goal reachable phải có distance." });
  }
  if (!value.reachable && value.distance !== null) {
    ctx.addIssue({ code: "custom", path: ["distance"], message: "Goal unreachable phải có distance null." });
  }
});
export const ComparatorSideMetricsSchema = z.object({
  materialByType: z.object({ R: z.number().int().nonnegative(), P: z.number().int().nonnegative(), S: z.number().int().nonnegative() }),
  goalDistance: ComparatorGoalDistanceSchema.nullable(),
  mobility: z.number().int().nonnegative(),
});
export const TournamentComparatorInputSchema = z.object({
  policy: ComparatorPolicySchema,
  firstMoverSide: z.enum(["BLUE", "RED"]),
  metrics: z.object({ BLUE: ComparatorSideMetricsSchema, RED: ComparatorSideMetricsSchema }),
  event: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("NO_LEGAL_MOVE"), side: z.enum(["BLUE", "RED"]) }),
    z.object({ kind: z.literal("OWN_TURN_VIOLATION"), side: z.enum(["BLUE", "RED"]) }),
    z.object({ kind: z.literal("INFRASTRUCTURE_FAILURE") }),
  ]).nullable(),
});
export type TournamentComparatorInputDto = z.infer<typeof TournamentComparatorInputSchema>;

export const TournamentComparatorResultSchema = z.object({
  winnerSide: z.enum(["BLUE", "RED"]).nullable(),
  reasonCode: ComparatorReasonCodeSchema,
  decidedBy: z.union([ComparatorCriterionSchema, z.literal("FINAL_TIE_POLICY"), z.literal("EVENT")]),
  manualRequired: z.boolean(),
  firstMoverSide: z.enum(["BLUE", "RED"]),
  secondMoverSide: z.enum(["BLUE", "RED"]),
  metrics: z.object({ BLUE: ComparatorSideMetricsSchema, RED: ComparatorSideMetricsSchema }),
});
export type TournamentComparatorResultDto = z.infer<typeof TournamentComparatorResultSchema>;

export const RuleVersionProfileRefSchema = z.object({
  draftId: z.string().trim().min(1).max(128),
  revision: z.number().int().positive(),
});
export type RuleVersionProfileRef = z.infer<typeof RuleVersionProfileRefSchema>;

export const RuleVersionItemSchema = z.object({
  id: z.string().min(1),
  tournamentId: z.string().min(1),
  versionNumber: z.number().int().positive(),
  profileRef: RuleVersionProfileRefSchema,
  profileDigest: z.string().regex(/^[a-f0-9]{64}$/),
  reason: z.string().min(1).max(1000),
  effectiveAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  immutable: z.literal(true),
});
export type RuleVersionItem = z.infer<typeof RuleVersionItemSchema>;

export const RuleVersionListResponseSchema = z.object({
  items: z.array(RuleVersionItemSchema),
  nextCursor: z.string().nullable(),
  configRevision: z.number().int().nonnegative(),
});
export type RuleVersionListResponse = z.infer<typeof RuleVersionListResponseSchema>;

export const RuleVersionDiffChangeSchema = z.object({
  path: z.string().min(1),
  before: z.unknown(),
  after: z.unknown(),
  impact: z.enum(["MATCHES_PINNED", "NEW_MATCHES_ONLY", "DISPLAY_ONLY"]),
});
export const RuleVersionDiffResponseSchema = z.object({
  baseVersionId: z.string().min(1),
  targetVersionId: z.string().min(1),
  changes: z.array(RuleVersionDiffChangeSchema),
  sameDigest: z.boolean(),
  oldMatchesUnaffected: z.literal(true),
});
export type RuleVersionDiffResponse = z.infer<typeof RuleVersionDiffResponseSchema>;

export const PublishRuleVersionInputSchema = z.object({
  expectedRevision: z.number().int().positive(),
  profileRef: RuleVersionProfileRefSchema,
  profileDigest: z.string().regex(/^[a-f0-9]{64}$/),
  reason: z.string().trim().min(3).max(1000),
  effectiveAt: z.string().datetime(),
  idempotencyKey: z.string().trim().min(8).max(128),
});
export type PublishRuleVersionInput = z.infer<typeof PublishRuleVersionInputSchema>;

export const PublishRuleVersionResponseSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("PUBLISHED"), version: RuleVersionItemSchema }),
  z.object({ outcome: z.literal("CHANGE_REQUEST_REQUIRED"), changeRequestId: z.string().min(1), reason: z.string().min(1) }),
]);
export type PublishRuleVersionResponse = z.infer<typeof PublishRuleVersionResponseSchema>;
