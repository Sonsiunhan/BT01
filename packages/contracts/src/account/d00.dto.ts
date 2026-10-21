import { z } from "zod";

// DTO definitions for D00 – Account / Roster / Staff / Support / Onboarding

export const AccountOnboardingDTOSchema = z.object({
  /** Unique tenant identifier */
  tenantId: z.string().min(1),
  /** Identifier of the principal (user) */
  userId: z.string().min(1),
  /** Desired username or email */
  email: z.string().min(1),
  /** Account state before activation (e.g., "UNCLAIMED") */
  initialState: z.enum(["UNCLAIMED", "CLAIMED", "ACTIVE"]),
  /** Optional activation token (server‑generated, never exposed to client) */
  activationToken: z.string().min(1).optional(),
  /** Timestamp when the token expires, if provided (ISO 8601) */
  activationExpiresAt: z.string().datetime().optional(),
});
export type AccountOnboardingDTO = z.infer<typeof AccountOnboardingDTOSchema>;

export const RosterImportRowDTOSchema = z.object({
  /** External identifier from source file */
  sourceRowId: z.string().min(1),
  /** Unique person key within the tournament */
  personKey: z.string().min(1),
  /** Display name of the participant */
  displayName: z.string().min(1),
  /** Email address (optional, may be synthetic) */
  email: z.string().email().optional(),
  /** Additional custom fields (free‑form JSON) */
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** Validation errors for this row, if any */
  errors: z.array(z.string()).optional(),
});
export type RosterImportRowDTO = z.infer<typeof RosterImportRowDTOSchema>;

export const StaffInvitationDTOSchema = z.object({
  /** Invitation identifier (UUID) */
  invitationId: z.string().min(1),
  /** Tenant where the staff will operate */
  tenantId: z.string().min(1),
  /** Email of the invited staff member */
  staffEmail: z.string().email(),
  /** Role being offered (e.g., "REFEREE", "STAFF") */
  role: z.string().min(1),
  /** Expiration timestamp of the invitation (ISO 8601) */
  expiresAt: z.string().datetime(),
  /** Single‑use token for acceptance */
  token: z.string().min(1),
  /** Current status */
  status: z.enum(["PENDING", "ACCEPTED", "DECLINED", "REVOKED", "EXPIRED"]),
  /** Optional notes from the inviter */
  notes: z.string().optional(),
});
export type StaffInvitationDTO = z.infer<typeof StaffInvitationDTOSchema>;

export const SupportRequestDTOSchema = z.object({
  /** Unique request identifier */
  requestId: z.string().min(1),
  /** Tenant context */
  tenantId: z.string().min(1),
  /** Identifier of the user who opened the request */
  userId: z.string().min(1),
  /** Free‑form description of the issue */
  description: z.string().min(1),
  /** Current status of the request */
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "ESCALATED", "CLOSED"]),
  /** Timestamp of creation (ISO 8601) */
  createdAt: z.string().datetime(),
  /** Timestamp when the request was resolved (optional, ISO 8601) */
  resolvedAt: z.string().datetime().optional(),
  /** Optional internal notes for support agents */
  notes: z.string().optional(),
});
export type SupportRequestDTO = z.infer<typeof SupportRequestDTOSchema>;
