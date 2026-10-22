import { z } from "zod";

/**
 * Additive P04/N02 contract. The older TournamentRuleProfileSchema remains
 * the L01 timing/result policy contract; this schema describes the N01
 * engine profile without changing existing draft consumers.
 */
export const TournamentRulePreviewSchemaVersion = "tournament-rule-profile.v1" as const;
export const TournamentRulePreviewCapabilitiesVersion = "rules-preview.v1" as const;

export const TournamentRuleDirectionSystemSchema = z.enum(["ABSOLUTE", "RELATIVE"]);
export type TournamentRuleDirectionSystem = z.infer<typeof TournamentRuleDirectionSystemSchema>;

export const TournamentRuleSideSchema = z.enum(["BLUE", "RED"]);
export const TournamentRulePieceTypeSchema = z.enum(["R", "P", "S"]);
export const TournamentRuleCoordinateSchema = z
  .string()
  .regex(/^[a-o](?:[1-9]|1[0-5])$/, "Tọa độ phải có dạng a1..o15.");

export const TournamentRuleDirectionSchema = z.object({
  fileDelta: z.number().int(),
  rankDelta: z.number().int(),
});

const TournamentRuleRaySchema = z.object({
  kind: z.literal("RAY"),
  directions: z.array(TournamentRuleDirectionSchema).min(1).max(8),
  minDistance: z.number().int().min(1).max(15),
  maxDistance: z.number().int().min(1).max(15),
  canJump: z.boolean(),
});

const TournamentRuleLeapSchema = z.object({
  kind: z.literal("LEAP"),
  // Keep transport bounded above the engine cap so preview can report the
  // field-level LEAP_OFFSET_LIMIT_EXCEEDED issue.
  offsets: z.array(TournamentRuleDirectionSchema).max(512),
});

export const TournamentRuleMovementPatternSchema = z.discriminatedUnion("kind", [
  TournamentRuleRaySchema,
  TournamentRuleLeapSchema,
]);
export type TournamentRuleMovementPattern = z.infer<typeof TournamentRuleMovementPatternSchema>;

const TournamentRuleMovementProfileSchema = z.object({
  // Keep transport bounded above the engine cap so preview can report the
  // field-level PATTERN_LIMIT_EXCEEDED issue.
  R: z.array(TournamentRuleMovementPatternSchema).max(64),
  P: z.array(TournamentRuleMovementPatternSchema).max(64),
  S: z.array(TournamentRuleMovementPatternSchema).max(64),
});

const TournamentRuleLayoutEntrySchema = z.object({
  id: z.string().trim().min(1).max(80),
  side: TournamentRuleSideSchema,
  type: TournamentRulePieceTypeSchema,
  coordinate: TournamentRuleCoordinateSchema,
});

const TournamentRulePieceCountsSchema = z.object({
  BLUE: z.object({ R: z.number().int().nonnegative(), P: z.number().int().nonnegative(), S: z.number().int().nonnegative() }),
  RED: z.object({ R: z.number().int().nonnegative(), P: z.number().int().nonnegative(), S: z.number().int().nonnegative() }),
});

const TournamentStaticGoalSchema = z.object({
  mode: z.literal("STATIC"),
  cell: TournamentRuleCoordinateSchema,
});

const TournamentCycleGoalSchema = z.object({
  mode: z.literal("CYCLE"),
  cells: z.array(TournamentRuleCoordinateSchema).min(1).max(225),
  roundInterval: z.number().int().positive().max(1000),
});

const TournamentSeededGoalSchema = z.object({
  mode: z.literal("SEEDED"),
  candidateCells: z.array(TournamentRuleCoordinateSchema).min(1).max(225),
  roundInterval: z.number().int().positive().max(1000),
  policyVersion: z.string().trim().min(1).max(64),
});

export const TournamentRuleSeedContextSchema = z.object({
  seed: z.number().int().nonnegative().max(0xffffffff),
  matchKey: z.string().trim().min(1).max(128),
  policyVersion: z.literal("goal-prng-v1"),
});
export type TournamentRuleSeedContext = z.infer<typeof TournamentRuleSeedContextSchema>;

export const TournamentRuleGoalProfileSchema = z.discriminatedUnion("mode", [
  TournamentStaticGoalSchema,
  TournamentCycleGoalSchema,
  TournamentSeededGoalSchema,
]);
export type TournamentRuleGoalProfile = z.infer<typeof TournamentRuleGoalProfileSchema>;

export const TournamentEngineRuleProfileSchema = z.object({
  version: z.string().trim().min(1).max(64),
  directionSystem: TournamentRuleDirectionSystemSchema.default("ABSOLUTE"),
  board: z.object({
    rows: z.number().int(),
    cols: z.number().int(),
  }),
  initialTurn: TournamentRuleSideSchema.default("BLUE"),
  pieceCounts: TournamentRulePieceCountsSchema,
  layout: z.array(TournamentRuleLayoutEntrySchema).max(225),
  movementProfiles: z.object({
    BLUE: TournamentRuleMovementProfileSchema,
    RED: TournamentRuleMovementProfileSchema,
  }),
  winConditions: z.array(z.enum(["EXTINCTION", "GOAL_REACHED"])).max(2),
  goalProfiles: z.object({
    BLUE: TournamentRuleGoalProfileSchema.optional(),
    RED: TournamentRuleGoalProfileSchema.optional(),
  }).optional(),
  seedContext: TournamentRuleSeedContextSchema.optional(),
});
export type TournamentEngineRuleProfile = z.infer<typeof TournamentEngineRuleProfileSchema>;

export const TournamentRuleProfileWidgetSchema = z.object({
  schemaVersion: z.literal(TournamentRulePreviewSchemaVersion),
  engineProfileVersion: z.string().trim().min(1).max(64),
  baseTemplateId: z.string().trim().min(1).max(80).optional(),
  sameMovementForBothSides: z.boolean().default(false),
  profile: TournamentEngineRuleProfileSchema,
});
export type TournamentRuleProfileWidget = z.infer<typeof TournamentRuleProfileWidgetSchema>;

export const TournamentRulePreviewRequestSchema = z.object({
  expectedConfigRevision: z.number().int().positive(),
  draftRevision: z.number().int().positive(),
  profile: TournamentRuleProfileWidgetSchema,
});
export type TournamentRulePreviewRequest = z.infer<typeof TournamentRulePreviewRequestSchema>;

export const RulePreviewIssueCodeSchema = z.enum([
  "BOARD_DIMENSION_NOT_INTEGER",
  "BOARD_DIMENSION_OUT_OF_RANGE",
  "LAYOUT_OUT_OF_BOUNDS",
  "LAYOUT_COLLISION",
  "LAYOUT_DUPLICATE_ID",
  "COUNTS_MISMATCH",
  "MISSING_MOVEMENT_PROFILE",
  "PATTERN_LIMIT_EXCEEDED",
  "LEAP_OFFSET_LIMIT_EXCEEDED",
  "INVALID_DIRECTION",
  "INVALID_DISTANCE",
  "RAY_DISTANCE_CAP_EXCEEDED",
  "INVALID_LEAP_OFFSET",
  "DUPLICATE_LEAP_OFFSET",
  "GOAL_OUT_OF_BOUNDS",
  "INITIAL_OWN_GOAL",
  "WIN_CONDITION_REQUIRED",
  "EXTINCTION_REQUIRES_ALL_TYPES",
  "MISSING_GOAL_PROFILE",
  "UNSUPPORTED_VERSION",
  "UNSUPPORTED_CAPABILITY",
  "INITIAL_NO_LEGAL_MOVES",
  "GOAL_UNREACHABLE",
  "GOAL_CELLS_EMPTY",
  "DUPLICATE_GOAL_CELL",
  "GOAL_INTERVAL_INVALID",
  "UNSUPPORTED_GOAL_POLICY",
  "MISSING_SEED_CONTEXT",
  "SEEDED_GOAL_EMPTY_AFTER_FILTER",
  "SEED_POLICY_MISMATCH",
]);
export type RulePreviewIssueCode = z.infer<typeof RulePreviewIssueCodeSchema>;

export const RulePreviewIssueSchema = z.object({
  path: z.string().min(1),
  code: RulePreviewIssueCodeSchema,
  messageKey: z.string().min(1),
  message: z.string().min(1),
});
export type RulePreviewIssue = z.infer<typeof RulePreviewIssueSchema>;

export const RulePreviewCheckStatusSchema = z.enum(["PASS", "FAIL", "NOT_CHECKED"]);
export type RulePreviewCheckStatus = z.infer<typeof RulePreviewCheckStatusSchema>;

export const RulePreviewChecksSchema = z.object({
  structural: RulePreviewCheckStatusSchema,
  initialNonTerminal: RulePreviewCheckStatusSchema,
  initialLegalMoves: RulePreviewCheckStatusSchema,
  goalReachability: RulePreviewCheckStatusSchema,
  runtime: z.literal("NOT_CHECKED"),
});

export const RulePreviewMoveSchema = z.object({
  from: TournamentRuleCoordinateSchema,
  to: TournamentRuleCoordinateSchema,
});

export const RulePreviewProgressSchema = z.object({
  acceptedPlies: z.number().int().nonnegative(),
  roundIndex: z.number().int().nonnegative(),
  activeGoalBySide: z.object({
    BLUE: TournamentRuleCoordinateSchema.nullable(),
    RED: TournamentRuleCoordinateSchema.nullable(),
  }),
  seedContext: TournamentRuleSeedContextSchema.nullable(),
});

export const RulePreviewGoalReachabilitySchema = z.object({
  BLUE: z.array(z.object({ cell: TournamentRuleCoordinateSchema, status: RulePreviewCheckStatusSchema })),
  RED: z.array(z.object({ cell: TournamentRuleCoordinateSchema, status: RulePreviewCheckStatusSchema })),
});

export const TournamentRulePreviewResponseSchema = z.object({
  tournamentId: z.string().min(1),
  contractId: z.string().min(1),
  expectedConfigRevision: z.number().int().positive(),
  draftRevision: z.number().int().positive(),
  schemaVersion: z.literal(TournamentRulePreviewSchemaVersion),
  engineProfileVersion: z.string().min(1),
  capabilitiesVersion: z.literal(TournamentRulePreviewCapabilitiesVersion),
  profileDigest: z.string().regex(/^[a-f0-9]{64}$/),
  normalizedProfile: TournamentEngineRuleProfileSchema.nullable(),
  valid: z.boolean(),
  errors: z.array(RulePreviewIssueSchema),
  warnings: z.array(RulePreviewIssueSchema),
  checks: RulePreviewChecksSchema,
  progress: RulePreviewProgressSchema,
  goalReachabilityBySide: RulePreviewGoalReachabilitySchema,
  legalMovesBySide: z.object({
    BLUE: z.array(RulePreviewMoveSchema),
    RED: z.array(RulePreviewMoveSchema),
  }),
  runtimeStatus: z.literal("NOT_CHECKED"),
});
export type TournamentRulePreviewResponse = z.infer<typeof TournamentRulePreviewResponseSchema>;
