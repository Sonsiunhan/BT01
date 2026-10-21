// DTO definitions for D00 – Account / Roster / Staff / Support / Onboarding
import { z } from "zod";

/**
 * Principal summary for auth/session & actor matrix (D00 / L01).
 */
export const PrincipalSummarySchema = z.object({
  principalId: z.string().min(1),
  principalType: z.enum(["USER", "GUEST"]),
  email: z.string().email().nullable().optional(),
  displayName: z.string().min(1),
  tenantId: z.string().min(1).nullable().optional(),
  systemRoles: z.array(z.enum(["ADMIN", "SUPPORT"])).default([]),
  contractRoles: z
    .array(
      z.object({
        contractId: z.string().min(1),
        role: z.literal("TOURNAMENT_ADMIN"),
      })
    )
    .default([]),
  tournamentRoles: z
    .array(
      z.object({
        tournamentId: z.string().min(1),
        role: z.enum(["TOURNAMENT_ADMIN", "REFEREE", "STAFF", "PLAYER"]),
      })
    )
    .default([]),
});
export type PrincipalSummary = z.infer<typeof PrincipalSummarySchema>;

/**
 * Configurable TTL parameters for D00 Account / Roster / Staff / Support flows
 * (Per D00 hand-off-long.md & N00 Decision 6.2A: activation 24h, reset 30m, invite 72h, staging 24h, audit 365d).
 */
export const D00AccountTtlConfigSchema = z.object({
  activationTokenTtlSeconds: z.number().int().min(300).max(604800).default(86400),
  resetTokenTtlSeconds: z.number().int().min(300).max(86400).default(1800),
  staffInviteTtlSeconds: z.number().int().min(3600).max(1209600).default(259200),
  rosterStagingTtlSeconds: z.number().int().min(3600).max(604800).default(86400),
  supportAuditRetentionDays: z.number().int().min(30).max(3650).default(365),
});
export type D00AccountTtlConfig = z.infer<typeof D00AccountTtlConfigSchema>;

export const DEFAULT_D00_ACCOUNT_TTL_CONFIG: D00AccountTtlConfig = {
  activationTokenTtlSeconds: 86400,
  resetTokenTtlSeconds: 1800,
  staffInviteTtlSeconds: 259200,
  rosterStagingTtlSeconds: 86400,
  supportAuditRetentionDays: 365,
};

/**
 * Account onboarding DTO – used for bootstrap and claim flows (P09, P13).
 */
export interface AccountOnboardingDTO {
  /** Unique tenant identifier */
  tenantId: string;
  /** Identifier of the principal (user) */
  userId: string;
  /** Desired username or email */
  email: string;
  /** Account state before activation (e.g., "UNCLAIMED") */
  initialState: 'UNCLAIMED' | 'CLAIMED' | 'ACTIVE';
  /** Optional activation token (server‑generated, never exposed to client) */
  activationToken?: string | undefined;
  /** Timestamp when the token expires, if provided */
  activationExpiresAt?: string | undefined; // ISO 8601
}

export const AccountOnboardingDTOSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  email: z.string().trim().email(),
  initialState: z.enum(["UNCLAIMED", "CLAIMED", "ACTIVE"]),
  activationToken: z.string().min(1).optional(),
  activationExpiresAt: z.string().datetime().optional(),
});

/**
 * Roster import row DTO – each row from CSV/XLSX (P10).
 */
export interface RosterImportRowDTO {
  /** External identifier from source file */
  sourceRowId: string;
  /** Unique person key within the tournament */
  personKey: string;
  /** Display name of the participant */
  displayName: string;
  /** Email address (optional, may be synthetic) */
  email?: string | undefined;
  /** Additional custom fields (free‑form JSON) */
  metadata?: Record<string, unknown> | undefined;
  /** Validation errors for this row, if any */
  errors?: string[] | undefined;
}

export const RosterImportRowDTOSchema = z.object({
  sourceRowId: z.string().min(1),
  personKey: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  email: z.string().trim().email().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  errors: z.array(z.string()).optional(),
});

/**
 * Staff invitation DTO – invitation flow (P11, P17).
 */
export interface StaffInvitationDTO {
  /** Invitation identifier (UUID) */
  invitationId: string;
  /** Tenant where the staff will operate */
  tenantId: string;
  /** Email of the invited staff member */
  staffEmail: string;
  /** Role being offered (e.g., "REFEREE", "STAFF") */
  role: string;
  /** Expiration timestamp of the invitation */
  expiresAt: string; // ISO 8601
  /** Single‑use token for acceptance */
  token: string;
  /** Current status */
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED' | 'EXPIRED';
  /** Optional notes from the inviter */
  notes?: string | undefined;
}

export const StaffInvitationDTOSchema = z.object({
  invitationId: z.string().min(1),
  tenantId: z.string().min(1),
  staffEmail: z.string().trim().email(),
  role: z.string().min(1),
  expiresAt: z.string().datetime(),
  token: z.string().min(1),
  status: z.enum(["PENDING", "ACCEPTED", "DECLINED", "REVOKED", "EXPIRED"]),
  notes: z.string().optional(),
});

/**
 * Support request DTO – support flow (P12).
 * Fields chosen based on clarification: requestId, tenantId, userId, description, status, createdAt, resolvedAt, notes.
 */
export interface SupportRequestDTO {
  /** Unique request identifier */
  requestId: string;
  /** Tenant context */
  tenantId: string;
  /** Identifier of the user who opened the request */
  userId: string;
  /** Free‑form description of the issue */
  description: string;
  /** Current status of the request */
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ESCALATED' | 'CLOSED';
  /** Timestamp of creation */
  createdAt: string; // ISO 8601
  /** Timestamp when the request was resolved (optional) */
  resolvedAt?: string | undefined; // ISO 8601
  /** Optional internal notes for support agents */
  notes?: string | undefined;
}

export const SupportRequestDTOSchema = z.object({
  requestId: z.string().min(1),
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  description: z.string().trim().min(1),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "ESCALATED", "CLOSED"]),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

/**
 * D00 Synthetic Fixtures per docs/tournament-initialization/account/fixtures/spec.md.
 * Zero real PII; strictly synthetic test identifiers.
 */
export const D00_SYNTHETIC_FIXTURES = {
  actors: [
    {
      principalId: "FIX-SYS-ADMIN",
      principalType: "USER" as const,
      email: "sysadmin@ott.test",
      displayName: "System Admin",
      tenantId: "TENANT-001",
      systemRoles: ["ADMIN" as const],
    },
    {
      principalId: "FIX-TOUR-ADMIN",
      principalType: "USER" as const,
      email: "tadmin@ott.test",
      displayName: "Tournament Admin",
      tenantId: "TENANT-001",
      systemRoles: [],
    },
    {
      principalId: "FIX-REFEREE",
      principalType: "USER" as const,
      email: "referee@ott.test",
      displayName: "Referee",
      tenantId: "TENANT-001",
      systemRoles: [],
    },
    {
      principalId: "FIX-GUEST",
      principalType: "GUEST" as const,
      email: "guest@ott.test",
      displayName: "Guest User",
      tenantId: "TENANT-001",
      systemRoles: [],
    },
    {
      principalId: "FIX-STAFF",
      principalType: "USER" as const,
      email: "staff@ott.test",
      displayName: "Staff Member",
      tenantId: "TENANT-001",
      systemRoles: [],
    },
    {
      principalId: "FIX-SUPPORT",
      principalType: "USER" as const,
      email: "support@ott.test",
      displayName: "Support Agent",
      tenantId: "TENANT-001",
      systemRoles: ["SUPPORT" as const],
    },
  ],
  onboardingTokens: [
    {
      tenantId: "TENANT-001",
      userId: "FIX-TOUR-ADMIN",
      email: "tadmin@ott.test",
      initialState: "UNCLAIMED" as const,
      activationToken: "ACT-VALID-001",
      activationExpiresAt: "2026-10-22T15:00:00.000Z",
    },
    {
      tenantId: "TENANT-001",
      userId: "FIX-GUEST",
      email: "guest@ott.test",
      initialState: "UNCLAIMED" as const,
      activationToken: "ACT-EXPIRED-002",
      activationExpiresAt: "2026-10-20T15:00:00.000Z",
    },
    {
      tenantId: "TENANT-001",
      userId: "FIX-STAFF",
      email: "staff@ott.test",
      initialState: "UNCLAIMED" as const,
      activationToken: "ACT-REVOKED-003",
      activationExpiresAt: "2026-10-22T15:00:00.000Z",
    },
  ],
  staffInvitations: [
    {
      invitationId: "STAFF-INV-001",
      tenantId: "TENANT-001",
      staffEmail: "referee@ott.test",
      role: "REFEREE",
      expiresAt: "2026-10-24T15:00:00.000Z",
      token: "STAFF-INV-001",
      status: "PENDING" as const,
    },
    {
      invitationId: "STAFF-INV-002",
      tenantId: "TENANT-001",
      staffEmail: "staff@ott.test",
      role: "STAFF",
      expiresAt: "2026-10-24T15:00:00.000Z",
      token: "STAFF-INV-002",
      status: "ACCEPTED" as const,
    },
    {
      invitationId: "STAFF-INV-003",
      tenantId: "TENANT-001",
      staffEmail: "declined@ott.test",
      role: "REFEREE",
      expiresAt: "2026-10-24T15:00:00.000Z",
      token: "STAFF-INV-003",
      status: "DECLINED" as const,
    },
    {
      invitationId: "STAFF-INV-004",
      tenantId: "TENANT-001",
      staffEmail: "revoked@ott.test",
      role: "REFEREE",
      expiresAt: "2026-10-20T15:00:00.000Z",
      token: "STAFF-INV-004",
      status: "REVOKED" as const,
    },
  ],
  supportRequests: [
    {
      requestId: "SUPPORT-001",
      tenantId: "TENANT-001",
      userId: "FIX-GUEST",
      description: "Unable to claim account",
      status: "OPEN" as const,
      createdAt: "2026-10-21T10:00:00.000Z",
    },
    {
      requestId: "SUPPORT-002",
      tenantId: "TENANT-001",
      userId: "FIX-TOUR-ADMIN",
      description: "Need quota adjustment",
      status: "IN_PROGRESS" as const,
      createdAt: "2026-10-21T10:30:00.000Z",
    },
    {
      requestId: "SUPPORT-003",
      tenantId: "TENANT-001",
      userId: "FIX-REFEREE",
      description: "Resolved login issue",
      status: "RESOLVED" as const,
      createdAt: "2026-10-21T09:00:00.000Z",
      resolvedAt: "2026-10-21T11:00:00.000Z",
    },
  ],
  rosterRows: [
    { sourceRowId: "1", personKey: "PK-001", displayName: "Alice Nguyen", email: "alice@ott.test" },
    { sourceRowId: "2", personKey: "PK-002", displayName: "Bob Tran", email: "bob@ott.test" },
    { sourceRowId: "3", personKey: "PK-002", displayName: "Bob Duplicate", email: "bob2@ott.test", errors: ["DUPLICATE_PERSON_KEY"] },
    { sourceRowId: "4", personKey: "PK-004", displayName: "Charlie Le", errors: ["INVALID_EMAIL"] },
    { sourceRowId: "5", personKey: "PK-005", displayName: "", email: "eve@ott.test", errors: ["MISSING_DISPLAY_NAME"] },
    { sourceRowId: "6", personKey: "PK-006", displayName: "Frank Pham", email: "frank@ott.test", metadata: { extraColumn: "value1" } },
    { sourceRowId: "7", personKey: "PK-007", displayName: "Grace Ho", email: "grace@ott.test", metadata: { rating: 1500, club: "ChessClub" } },
    { sourceRowId: "8", personKey: "PK-008", displayName: "Henry Vu", email: "henry@ott.test" },
    { sourceRowId: "9", personKey: "PK-009", displayName: "Ivy Dang", email: "ivy@ott.test" },
    { sourceRowId: "10", personKey: "PK-010", displayName: "Jack Bui", email: "jack@ott.test", errors: ["QUOTA_EXCEEDED"] },
  ],
} as const;
