import { z } from "zod";

/**
 * Public, fail-closed readiness state for a BOT_VS_BOT tournament enrollment.
 * Storage-only legacy values are deliberately not members of this enum.
 */
export const BotReadinessStatusSchema = z.enum([
  "NOT_SUBMITTED",
  "PENDING",
  "CHECKING",
  "READY",
  "INCOMPATIBLE",
  "BLOCKED_INFRA",
  "STALE",
]);
export type BotReadinessStatus = z.infer<typeof BotReadinessStatusSchema>;

export const BotReadinessReceiptOutcomeSchema = z.enum(["ACCEPTED", "REJECTED", "FAILED", "CANCELLED"]);
export type BotReadinessReceiptOutcome = z.infer<typeof BotReadinessReceiptOutcomeSchema>;

/** Only safe, operator-facing fault codes. Never return provider diagnostics. */
export const BotReadinessReceiptCodeSchema = z.enum([
  "READY",
  "BOT_SOURCE_INVALID",
  "BOT_ABI_INCOMPATIBLE",
  "BOT_OUTPUT_REJECTED",
  "BOT_LIMIT_EXCEEDED",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_BUSY",
  "PROVIDER_CRASH",
  "RUNTIME_HASH_MISMATCH",
  "TARGET_STALE",
]);
export type BotReadinessReceiptCode = z.infer<typeof BotReadinessReceiptCodeSchema>;

export const BotReadinessSafeReasonSchema = z.enum([
  "NOT_SELECTED",
  "NOT_APPLICABLE",
  "CHECK_QUEUED",
  "CHECKING",
  ...BotReadinessReceiptCodeSchema.options,
]);
export type BotReadinessSafeReason = z.infer<typeof BotReadinessSafeReasonSchema>;

/** A safe projection of the server-generated target tuple; it contains no source. */
export const BotReadinessTargetSchema = z.object({
  targetContextRef: z.string().regex(/^brt_[a-f0-9]{24}$/),
  configVersionNumber: z.number().int().nonnegative(),
  ruleVersion: z.string().min(1).max(80),
  sdkVersion: z.string().min(1).max(80),
  schemaVersion: z.string().min(1).max(80),
  runtimeProfile: z.literal("WASMTIME_SUPERVISOR"),
  policyVersion: z.string().min(1).max(80),
  sourceDigestPrefix: z.string().regex(/^[a-f0-9]{12}$/),
}).strict();
export type BotReadinessTarget = z.infer<typeof BotReadinessTargetSchema>;

export const BotReadinessReceiptSchema = z.object({
  receiptId: z.string().uuid(),
  outcome: BotReadinessReceiptOutcomeSchema,
  code: BotReadinessReceiptCodeSchema,
  completedAt: z.string().datetime(),
  safeMessage: z.string().min(1).max(240),
}).strict();
export type BotReadinessReceipt = z.infer<typeof BotReadinessReceiptSchema>;

export const BotReadinessPermittedActionsSchema = z.object({
  canSelect: z.boolean(),
  canRecheck: z.boolean(),
}).strict();
export type BotReadinessPermittedActions = z.infer<typeof BotReadinessPermittedActionsSchema>;

export const BotReadinessSelectionRequestSchema = z.object({
  botId: z.string().min(1),
  revisionId: z.string().min(1),
  expectedEnrollmentRevision: z.number().int().nonnegative(),
  idempotencyKey: z.string().trim().min(8).max(128),
}).strict();
export type BotReadinessSelectionRequest = z.infer<typeof BotReadinessSelectionRequestSchema>;

export const BotReadinessRecheckRequestSchema = z.object({
  enrollmentId: z.string().min(1),
  expectedEnrollmentRevision: z.number().int().nonnegative(),
  idempotencyKey: z.string().trim().min(8).max(128),
}).strict();
export type BotReadinessRecheckRequest = z.infer<typeof BotReadinessRecheckRequestSchema>;

export const BotReadinessItemSchema = z.object({
  enrollmentId: z.string().min(1),
  tournamentId: z.string().min(1),
  personKey: z.string().min(1),
  displayName: z.string().min(1),
  status: BotReadinessStatusSchema,
  /** Server CAS revision for readiness commands; never accepted from a client as authority. */
  revision: z.number().int().nonnegative(),
  botId: z.string().nullable(),
  revisionId: z.string().nullable(),
  revisionNumber: z.number().int().positive().nullable(),
  target: BotReadinessTargetSchema.nullable(),
  receipt: BotReadinessReceiptSchema.nullable(),
  safeReason: BotReadinessSafeReasonSchema,
  retryable: z.boolean(),
  retryAfterMs: z.number().int().positive().nullable(),
  permittedActions: BotReadinessPermittedActionsSchema,
  updatedAt: z.string().datetime(),
}).strict();
export type BotReadinessItem = z.infer<typeof BotReadinessItemSchema>;

/** `applicable=false` is the only public result for HUMAN_ONLINE. */
export const BotReadinessSnapshotSchema = z.object({
  tournamentId: z.string().min(1),
  applicable: z.boolean(),
  notApplicableMessage: z.string().min(1).max(240).nullable(),
  items: z.array(BotReadinessItemSchema),
  nextCursor: z.string().nullable(),
  evaluatedAt: z.string().datetime(),
}).strict();
export type BotReadinessSnapshot = z.infer<typeof BotReadinessSnapshotSchema>;

export const BotReadinessJobStateSchema = z.enum([
  "QUEUED",
  "CHECKING",
  "SUCCEEDED",
  "BOT_REJECTED",
  "BLOCKED_INFRA",
  "STALE",
  "CANCELLED",
]);
export type BotReadinessJobState = z.infer<typeof BotReadinessJobStateSchema>;

export const BotReadinessJobSchema = z.object({
  jobId: z.string().uuid(),
  tournamentId: z.string().min(1),
  enrollmentId: z.string().min(1),
  targetContextRef: z.string().regex(/^brt_[a-f0-9]{24}$/),
  state: BotReadinessJobStateSchema,
  status: BotReadinessStatusSchema,
  retryable: z.boolean(),
  retryAfterMs: z.number().int().positive().nullable(),
  safeReason: BotReadinessSafeReasonSchema,
  receipt: BotReadinessReceiptSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
}).strict();
export type BotReadinessJob = z.infer<typeof BotReadinessJobSchema>;

export const BotProofModeSchema = z.enum(["OFFLINE_HUMAN_PYTHON", "OFFLINE_BOT_VS_BOT"]);
export type BotProofMode = z.infer<typeof BotProofModeSchema>;

export const BotProofResultSchema = z.object({
  mode: BotProofModeSchema,
  status: z.enum(["PASSED", "BLOCKED"]),
  acceptedTurns: z.number().int().nonnegative(),
  receiptIds: z.array(z.string().uuid()),
  safeMessage: z.string().min(1).max(240),
  completedAt: z.string().datetime(),
}).strict();
export type BotProofResult = z.infer<typeof BotProofResultSchema>;

export function normalizeLegacyBotReadiness(value: "NOT_REQUIRED" | "READY" | "INVALID" | "MISSING"): BotReadinessStatus {
  if (value === "READY") return "READY";
  if (value === "INVALID") return "INCOMPATIBLE";
  return "NOT_SUBMITTED";
}
