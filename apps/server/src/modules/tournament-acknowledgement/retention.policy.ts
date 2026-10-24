import type { PrismaClient } from "@prisma/client";
import {
  ArtifactRetentionPolicySchema, CANDIDATE_POLICY_DEFAULTS_V1,
  type ArtifactRetentionPolicy, type RetentionArtifact,
} from "@ottv2/contracts";

const HOUR = 60 * 60 * 1000, DAY = 24 * HOUR;
type PolicyOverrides = Partial<Record<RetentionArtifact, Partial<ArtifactRetentionPolicy>>>;
/** Policies are assessments only. No deletion or authority/grant changes occur here.
 * Existing token issuers remain owners of expiresAt; this never recomputes it.
 */
export function createRetentionPolicies(overrides: PolicyOverrides = {}): Record<RetentionArtifact, ArtifactRetentionPolicy> {
  const base = (artifact: RetentionArtifact, anchor: ArtifactRetentionPolicy["anchor"], retentionMs: number | null, operationalTtlMs: number | null, status: ArtifactRetentionPolicy["status"], source: string, appendOnly = false): ArtifactRetentionPolicy => ({ artifact, revision: 1, status, anchor, retentionMs, operationalTtlMs, appendOnly, preserveSharedIdentity: true, source });
  const policies: Record<RetentionArtifact, ArtifactRetentionPolicy> = {
    TOURNAMENT_DATA: base("TOURNAMENT_DATA", "MODULE_DEFINED", 90 * DAY, null, "CANONICAL", "BA/SA section12/F66: 90 actual days; lifecycle anchor requires Long confirmation"),
    RAW_IMPORT: base("RAW_IMPORT", "PARSE_COMPLETED_OR_FAILED", 0, null, "CANONICAL", "BA/SA section7.5/12: raw removed after parse/staging or failure; cleanup D08-B"),
    STAGING: base("STAGING", "CREATED_AT", DAY, DAY, "CANDIDATE_PENDING", "BA/SA section 15: staging24h candidate"),
    ACTIVATION: base("ACTIVATION", "MODULE_DEFINED", null, CANDIDATE_POLICY_DEFAULTS_V1.claimTokenTtlHours * HOUR, "CANDIDATE_PENDING", "Existing CANDIDATE_POLICY_DEFAULTS_V1.claimTokenTtlHours; section15 differs, confirmation pending"),
    STAFF_INVITATION: base("STAFF_INVITATION", "MODULE_DEFINED", null, CANDIDATE_POLICY_DEFAULTS_V1.invitationTtlHours * HOUR, "CANDIDATE_PENDING", "Existing CANDIDATE_POLICY_DEFAULTS_V1.invitationTtlHours"),
    RECOVERY: base("RECOVERY", "MODULE_DEFINED", null, HOUR / 2, "CANDIDATE_PENDING", "BA/SA section15 and D07 resetTokenTtlMinutes default30"),
    SUPPORT_EVIDENCE: base("SUPPORT_EVIDENCE", "RESOLVED_AT", 90 * DAY, null, "CANDIDATE_PENDING", "BA/SA section15 support evidence90days after resolution"),
    ACK_EVIDENCE: base("ACK_EVIDENCE", "MODULE_DEFINED", 90 * DAY, null, "CANONICAL", "BA/SA BR27/8.1A: 90 days tied to tournament lifecycle", true),
    AUDIT: base("AUDIT", "MODULE_DEFINED", 365 * DAY, null, "CANONICAL", "BA/SA section12/8.2A: 365 days from createdAt, append-only with retention boundary", true),
    SECURITY_RECORD: base("SECURITY_RECORD", "MODULE_DEFINED", null, null, "MODULE_POLICY_REQUIRED", "BA/SA F66: security/log TTL separately owned"),
  };
  for (const artifact of Object.keys(policies) as RetentionArtifact[]) {
    const policy = ArtifactRetentionPolicySchema.parse({ ...policies[artifact], ...overrides[artifact] });
    if (policy.artifact !== artifact || !policy.preserveSharedIdentity) throw new Error("Invalid retention scope");
    // Final durations cannot be silently changed by a caller or candidate override.
    if (artifact === "TOURNAMENT_DATA" && (policy.retentionMs !== 90 * DAY || policy.status !== "CANONICAL")) throw new Error("Tournament retention is fixed by BA/SA F66");
    if (artifact === "ACK_EVIDENCE" && (policy.retentionMs !== 90 * DAY || policy.status !== "CANONICAL" || !policy.appendOnly)) throw new Error("ACK evidence retention is fixed at 90 days by 8.1A");
    if (artifact === "AUDIT" && (policy.retentionMs !== 365 * DAY || policy.status !== "CANONICAL" || !policy.appendOnly)) throw new Error("Audit retention is fixed at 365 days by 8.2A");
    if (policies[artifact].status !== "CANONICAL" && policy.status === "CANONICAL") throw new Error("Candidate policy cannot be silently promoted");
    policies[artifact] = policy;
  }
  return policies;
}

/** Read server-provisioned durable configuration. No public policy mutation API.
 * Missing rows retain the explicit candidate/unspecified labels above.
 */
export async function readRetentionPolicies(db: PrismaClient) {
  const rows = await db.artifactRetentionPolicyRecord.findMany({ select: { artifact: true, policy: true } });
  const overrides: PolicyOverrides = {};
  for (const row of rows) {
    const policy = ArtifactRetentionPolicySchema.parse(row.policy);
    if (policy.artifact !== row.artifact) throw new Error("Retention policy key mismatch");
    overrides[policy.artifact] = policy;
  }
  return createRetentionPolicies(overrides);
}

export function operationalUsability(artifact: { expiresAt: Date; consumedAt: Date | null; revokedAt: Date | null }, now: Date): "USABLE" | "CONSUMED" | "REVOKED" | "EXPIRED" {
  if (artifact.revokedAt) return "REVOKED";
  if (artifact.consumedAt) return "CONSUMED";
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(artifact.expiresAt.getTime())) return "EXPIRED";
  return now.getTime() >= artifact.expiresAt.getTime() ? "EXPIRED" : "USABLE";
}

export function assessRetention(policy: ArtifactRetentionPolicy, anchor: Date | null, now: Date): "PRESERVE" | "POLICY_PENDING" | "RETAIN" | "ELIGIBLE_FOR_REVIEW" {
  if (policy.appendOnly || policy.retentionMs === null || anchor === null) return "PRESERVE";
  if (!Number.isFinite(anchor.getTime()) || !Number.isFinite(now.getTime())) return "PRESERVE";
  if (policy.status !== "CANONICAL") return "POLICY_PENDING";
  return now.getTime() >= anchor.getTime() + policy.retentionMs ? "ELIGIBLE_FOR_REVIEW" : "RETAIN";
}

/** All references, including other tournaments, must be checked by D08-B.
 * No account deletion or credential revocation is performed by this predicate.
 */
export function canArchiveIdentity(references: readonly { retentionElapsed: boolean; needsIdentity: boolean }[]): boolean {
  return references.every(reference => reference.retentionElapsed && !reference.needsIdentity);
}
