import { z } from "zod";

/** D06-A — tournament-scoped staff/referee invitation contracts. */
export const D06StaffRoleSchema = z.enum(["REFEREE", "STAFF"]);
export type D06StaffRole = z.infer<typeof D06StaffRoleSchema>;

export const D06InvitationStatusSchema = z.enum([
  "INVITED",
  "ACTIVE",
  "DECLINED",
  "REVOKED",
  "EXPIRED",
]);
export type D06InvitationStatus = z.infer<typeof D06InvitationStatusSchema>;

export const CreateStaffInvitationInputSchema = z.object({
  recipientUserId: z.string().trim().min(1),
  role: D06StaffRoleSchema,
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
});
export type CreateStaffInvitationInput = z.infer<typeof CreateStaffInvitationInputSchema>;

export const StaffInvitationViewSchema = z.object({
  id: z.string().min(1),
  tournamentId: z.string().min(1),
  contractId: z.string().min(1),
  recipientUserId: z.string().min(1),
  recipientUsername: z.string().min(1),
  recipientDisplayName: z.string().min(1),
  role: D06StaffRoleSchema,
  purpose: z.literal("TOURNAMENT_STAFF_INVITE"),
  status: D06InvitationStatusSchema,
  expiresAt: z.string().datetime(),
  inviterUserId: z.string().min(1),
  assignmentId: z.string().nullable(),
  createdAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
  declinedAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
});
export type StaffInvitationView = z.infer<typeof StaffInvitationViewSchema>;

export const StaffInvitationHandoffSchema = z.object({
  invitation: StaffInvitationViewSchema,
  /** Present only on the first successful create handoff; never persisted. */
  rawToken: z.string().min(1).nullable(),
  replayed: z.boolean(),
});
export type StaffInvitationHandoff = z.infer<typeof StaffInvitationHandoffSchema>;

export const StaffInvitationRecipientViewSchema = z.object({
  id: z.string().min(1),
  tournamentId: z.string().min(1),
  tournamentCode: z.string().min(1),
  role: D06StaffRoleSchema,
  purpose: z.literal("TOURNAMENT_STAFF_INVITE"),
  status: D06InvitationStatusSchema,
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
  declinedAt: z.string().datetime().nullable(),
});
export type StaffInvitationRecipientView = z.infer<typeof StaffInvitationRecipientViewSchema>;

export const StaffInvitationDecisionSchema = z.object({
  invitation: StaffInvitationRecipientViewSchema,
  replayed: z.boolean(),
});
export type StaffInvitationDecision = z.infer<typeof StaffInvitationDecisionSchema>;

export const StaffRevokeResultSchema = z.object({
  tournamentId: z.string().min(1),
  assignmentId: z.string().min(1),
  invitationId: z.string().min(1).nullable(),
  userId: z.string().min(1),
  role: D06StaffRoleSchema,
  status: z.literal("REVOKED"),
  revokedAt: z.string().datetime(),
  replayed: z.boolean(),
});
export type StaffRevokeResult = z.infer<typeof StaffRevokeResultSchema>;

export const StaffExpiryResultSchema = z.object({
  tournamentId: z.string().min(1),
  expiredInvitationIds: z.array(z.string().min(1)),
});
export type StaffExpiryResult = z.infer<typeof StaffExpiryResultSchema>;

export const StaffReadinessSchema = z.object({
  tournamentId: z.string().min(1),
  contractId: z.string().min(1),
  activeRefereeCount: z.number().int().nonnegative(),
  hasAcceptedReferee: z.boolean(),
});
export type StaffReadiness = z.infer<typeof StaffReadinessSchema>;
