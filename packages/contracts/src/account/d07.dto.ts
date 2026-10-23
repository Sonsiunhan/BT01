import { z } from "zod";
import { PasswordSchema } from "../auth.js";

/** D07-A — support queue and recovery foundation contracts. */
export const D07SupportRequestTypeSchema = z.literal("ACCOUNT_RECOVERY");
export type D07SupportRequestType = z.infer<typeof D07SupportRequestTypeSchema>;

export const D07SupportRequestStatusSchema = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "VERIFIED",
  "REJECTED",
  "RESOLVED",
  "ESCALATED",
  "CLOSED",
]);
export type D07SupportRequestStatus = z.infer<typeof D07SupportRequestStatusSchema>;

export const CreateSupportRequestInputSchema = z.object({
  /** Canonical account identifier for public recovery requests. Never a display name or email alias. */
  username: z.string().trim().min(1).max(128).optional(),
  reason: z.string().trim().min(1).max(2_000),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
});
export type CreateSupportRequestInput = z.infer<typeof CreateSupportRequestInputSchema>;

export const SupportRequestViewSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1).nullable(),
  requestType: D07SupportRequestTypeSchema,
  targetUserId: z.string().min(1),
  requesterUserId: z.string().min(1).nullable(),
  status: D07SupportRequestStatusSchema,
  reason: z.string().min(1),
  assignedOperatorUserId: z.string().min(1).nullable(),
  verificationReference: z.string().min(1).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  verifiedAt: z.string().datetime().nullable(),
  rejectedAt: z.string().datetime().nullable(),
  resolvedAt: z.string().datetime().nullable(),
  closedAt: z.string().datetime().nullable(),
});
export type SupportRequestView = z.infer<typeof SupportRequestViewSchema>;

export const SupportRequestCreateResultSchema = z.object({
  accepted: z.literal(true),
  requestId: z.string().min(1).nullable(),
  replayed: z.boolean(),
});
export type SupportRequestCreateResult = z.infer<typeof SupportRequestCreateResultSchema>;

export const SupportRequestListSchema = z.object({
  requests: z.array(SupportRequestViewSchema),
});
export type SupportRequestList = z.infer<typeof SupportRequestListSchema>;

export const SupportRequestTransitionInputSchema = z.object({
  action: z.enum(["IN_PROGRESS", "VERIFY", "REJECT", "RESOLVE", "CLOSE"]),
  verificationReference: z.string().trim().min(1).max(256).optional(),
});
export type SupportRequestTransitionInput = z.infer<typeof SupportRequestTransitionInputSchema>;

export const RecoveryTokenHandoffSchema = z.object({
  request: SupportRequestViewSchema,
  purpose: z.literal("ACCOUNT_RECOVERY_RESET"),
  expiresAt: z.string().datetime().nullable(),
  /** Present only on the first successful issue; never persisted or returned on replay. */
  rawToken: z.string().min(1).nullable(),
  replayed: z.boolean(),
});
export type RecoveryTokenHandoff = z.infer<typeof RecoveryTokenHandoffSchema>;

/** D07-B token-only account recovery execution. */
export const ConsumeRecoveryTokenInputSchema = z.object({
  token: z.string().trim().min(1).max(512),
  newPassword: PasswordSchema,
});
export type ConsumeRecoveryTokenInput = z.infer<typeof ConsumeRecoveryTokenInputSchema>;

export const ConsumeRecoveryTokenResultSchema = z.object({
  accepted: z.literal(true),
});
export type ConsumeRecoveryTokenResult = z.infer<typeof ConsumeRecoveryTokenResultSchema>;
