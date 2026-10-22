import { z } from "zod";
import { PasswordSchema } from "../auth.js";

/**
 * D05-A — Roster Participant Activation & Account Handoff Contracts
 *
 * Authoritative BA/SA Section 7.5 (I5 — Roster, import và account reuse)
 * AccountOnboardingDTO canonical states: UNCLAIMED → CLAIMED → ACTIVE
 *
 * Key invariants:
 *  - Token is never returned in logs or public responses; only the claimant possesses the raw token.
 *  - Credential (password) is NOT set during D05-A activation; that is D05-B.
 *  - Identity is bound to person_key, never name/email merge.
 *  - Scope is always validated against the enrollment's contractId.
 */

// ---------------------------------------------------------------------------
// Issue Activation Token (admin-initiated — generates a claim token per enrollment)
// ---------------------------------------------------------------------------

export const IssueActivationTokenRequestSchema = z.object({
  /** Enrollment record to activate */
  enrollmentId: z.string().min(1, "enrollmentId is required"),
  /** Idempotency key — re-issuing with the same key returns the existing un-expired token record */
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
});

export type IssueActivationTokenRequest = z.infer<typeof IssueActivationTokenRequestSchema>;

export const IssueActivationTokenResponseSchema = z.object({
  enrollmentId: z.string(),
  personKey: z.string(),
  /** Opaque claim token — deliver to participant out-of-band (email, printed sheet, etc.) */
  claimToken: z.string(),
  /** ISO-8601 expiry timestamp */
  expiresAt: z.string().datetime(),
  /** Whether this response reused an existing unexpired token (idempotent re-issue) */
  reissued: z.boolean(),
});

export type IssueActivationTokenResponse = z.infer<typeof IssueActivationTokenResponseSchema>;

// ---------------------------------------------------------------------------
// Claim Activation (participant-initiated — presents token, sets initial identity)
// ---------------------------------------------------------------------------

export const ClaimActivationRequestSchema = z.object({
  /** Raw activation token received out-of-band */
  claimToken: z.string().min(1, "claimToken is required"),
  /**
   * Username chosen by the participant.
   * Must satisfy the canonical username format (3-32 chars, a-z0-9_-).
   */
  username: z.string().trim().min(3).max(32).regex(
    /^[a-zA-Z0-9_-]+$/,
    "Username can only contain letters, numbers, underscores and hyphens",
  ),
  /** Display name chosen by participant */
  displayName: z.string().trim().min(2).max(100),
  /**
   * NO password accepted here — D05-B handles credential setup.
   * Presence of a password field causes immediate rejection (plaintext password guard).
   */
});

export type ClaimActivationRequest = z.infer<typeof ClaimActivationRequestSchema>;

export const ClaimActivationResponseSchema = z.object({
  success: z.literal(true),
  enrollmentId: z.string(),
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  personKey: z.string(),
  claimedAt: z.string().datetime(),
  /** Claim state: NEWLY_ACTIVATED = new User record; LINKED_TO_EXISTING = existing user linked */
  outcome: z.enum(["NEWLY_ACTIVATED", "LINKED_TO_EXISTING"]),
});

export type ClaimActivationResponse = z.infer<typeof ClaimActivationResponseSchema>;

// ---------------------------------------------------------------------------
// Activation Status (admin query — inspect current activation state)
// ---------------------------------------------------------------------------

export const ActivationStatusSchema = z.enum([
  "UNCLAIMED",    // Enrollment exists, no token issued or token expired
  "TOKEN_ISSUED", // Valid un-expired token exists, not yet claimed
  "CLAIMED",      // User linked to enrollment; credential not yet set (D05-B pending)
  "ACTIVE",       // Credential set, account fully active (D05-B complete)
]);
export type ActivationStatus = z.infer<typeof ActivationStatusSchema>;

export const ActivationStatusResponseSchema = z.object({
  enrollmentId: z.string(),
  personKey: z.string(),
  status: ActivationStatusSchema,
  userId: z.string().optional(),
  tokenExpiresAt: z.string().datetime().optional(),
});

export type ActivationStatusResponse = z.infer<typeof ActivationStatusResponseSchema>;

// ---------------------------------------------------------------------------
// Setup Credential (D05-B participant-initiated — establishes real password & recovery code)
// ---------------------------------------------------------------------------

export const SetupCredentialRequestSchema = z.object({
  /** Raw activation claim token held by participant */
  claimToken: z.string().min(1, "claimToken is required"),
  /** Password satisfying canonical PasswordSchema (min 8 chars) */
  password: PasswordSchema,
});

export type SetupCredentialRequest = z.infer<typeof SetupCredentialRequestSchema>;

export const SetupCredentialResponseSchema = z.object({
  success: z.literal(true),
  userId: z.string(),
  username: z.string(),
  status: z.literal("ACTIVE"),
  /** One-time recovery code for the participant to record (omitted on replay) */
  recoveryCode: z.string().optional(),
  completedAt: z.string().datetime(),
});

export type SetupCredentialResponse = z.infer<typeof SetupCredentialResponseSchema>;
