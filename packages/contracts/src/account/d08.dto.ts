import { z } from "zod";

/** F63 / BR-27: stored inside the existing immutable coreConfigSnapshot.
 * Missing legacy fields are deliberately not interpreted as published consent.
 */
export const PublishedRegulationsSchema = z.object({
  rulesAckRequired: z.boolean(),
  regulationsFull: z.string().trim().min(1),
  rulesQuickSummary: z.string().default(""),
});
export const AcknowledgeRulesRequestSchema = z.object({
  configVersionId: z.string().min(1),
}).strict();
export type AcknowledgeRulesRequest = z.infer<typeof AcknowledgeRulesRequestSchema>;

export const RulesAcknowledgementEvidenceSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  contractId: z.string().min(1),
  tournamentId: z.string().min(1),
  configVersionId: z.string().min(1),
  acknowledgedAt: z.string().datetime(),
  evidenceKind: z.literal("AUTHENTICATED_EXPLICIT_ACK"),
});
export type RulesAcknowledgementEvidence = z.infer<typeof RulesAcknowledgementEvidenceSchema>;
export const RulesAcknowledgementStatusSchema = z.object({
  contractId: z.string().min(1),
  tournamentId: z.string().min(1),
  configVersionId: z.string().min(1),
  versionNumber: z.number().int().positive(),
  effectiveAt: z.string().datetime(),
  regulationsFull: z.string(),
  rulesQuickSummary: z.string(),
  required: z.boolean(),
  satisfied: z.boolean(),
  evidence: RulesAcknowledgementEvidenceSchema.nullable(),
});
export type RulesAcknowledgementStatus = z.infer<typeof RulesAcknowledgementStatusSchema>;

export const RetentionArtifactSchema = z.enum([
  "TOURNAMENT_DATA", "RAW_IMPORT", "STAGING", "ACTIVATION", "STAFF_INVITATION",
  "RECOVERY", "SUPPORT_EVIDENCE", "ACK_EVIDENCE", "AUDIT", "SECURITY_RECORD",
]);
export type RetentionArtifact = z.infer<typeof RetentionArtifactSchema>;
export const ArtifactRetentionPolicySchema = z.object({
  artifact: RetentionArtifactSchema,
  revision: z.number().int().positive(),
  status: z.enum(["CANONICAL", "CANDIDATE_PENDING", "MODULE_POLICY_REQUIRED"]),
  anchor: z.enum(["TOURNAMENT_TERMINAL", "PARSE_COMPLETED_OR_FAILED", "CREATED_AT", "RESOLVED_AT", "MODULE_DEFINED"]),
  // null means unspecified/preserve, never an infinite authorization or permission to delete.
  retentionMs: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
  operationalTtlMs: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
  appendOnly: z.boolean(),
  preserveSharedIdentity: z.literal(true),
  source: z.string().min(1),
}).strict();
export type ArtifactRetentionPolicy = z.infer<typeof ArtifactRetentionPolicySchema>;
