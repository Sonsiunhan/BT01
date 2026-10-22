import { z } from "zod";

/** Public, fail-closed readiness state machine for tournament bot enrollment. */
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

export const BotReadinessReceiptSchema = z.object({
  outcome: BotReadinessReceiptOutcomeSchema,
  code: BotReadinessReceiptCodeSchema,
  completedAt: z.string().datetime(),
  safeMessage: z.string().min(1).max(240),
}).strict();
export type BotReadinessReceipt = z.infer<typeof BotReadinessReceiptSchema>;

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
  revision: z.number().int().nonnegative(),
  botId: z.string().nullable(),
  revisionId: z.string().nullable(),
  receipt: BotReadinessReceiptSchema.nullable(),
  updatedAt: z.string().datetime(),
}).strict();
export type BotReadinessItem = z.infer<typeof BotReadinessItemSchema>;

export const BotReadinessSnapshotSchema = z.object({
  tournamentId: z.string().min(1),
  items: z.array(BotReadinessItemSchema),
  nextCursor: z.string().nullable(),
  evaluatedAt: z.string().datetime(),
}).strict();
export type BotReadinessSnapshot = z.infer<typeof BotReadinessSnapshotSchema>;

export const BotReadinessJobStateSchema = z.enum(["PENDING", "CHECKING", "SUCCEEDED", "FAILED", "CANCELLED"]);
export type BotReadinessJobState = z.infer<typeof BotReadinessJobStateSchema>;

export const BotReadinessJobSchema = z.object({
  jobId: z.string().min(1),
  tournamentId: z.string().min(1),
  enrollmentId: z.string().min(1),
  targetContextRef: z.string().min(1),
  state: BotReadinessJobStateSchema,
  status: BotReadinessStatusSchema,
  retryAfterSeconds: z.number().int().nonnegative().nullable(),
  receipt: BotReadinessReceiptSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
export type BotReadinessJob = z.infer<typeof BotReadinessJobSchema>;

export const BotProofModeSchema = z.enum(["OFFLINE_HUMAN_PYTHON", "OFFLINE_BOT_VS_BOT"]);
export type BotProofMode = z.infer<typeof BotProofModeSchema>;

export const BotProofResultSchema = z.object({
  mode: BotProofModeSchema,
  status: z.enum(["PASSED", "BLOCKED"]),
  safeMessage: z.string().min(1).max(240),
  completedAt: z.string().datetime(),
}).strict();
export type BotProofResult = z.infer<typeof BotProofResultSchema>;

export function normalizeLegacyBotReadiness(value: "NOT_REQUIRED" | "READY" | "INVALID" | "MISSING"): BotReadinessStatus {
  if (value === "READY") return "READY";
  if (value === "INVALID") return "INCOMPATIBLE";
  if (value === "MISSING") return "NOT_SUBMITTED";
  return "NOT_SUBMITTED";
}
