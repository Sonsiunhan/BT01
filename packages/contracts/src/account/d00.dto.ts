// DTO definitions for D00 – Account / Roster / Staff / Support / Onboarding

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
  activationToken?: string;
  /** Timestamp when the token expires, if provided */
  activationExpiresAt?: string; // ISO 8601
}

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
  email?: string;
  /** Additional custom fields (free‑form JSON) */
  metadata?: Record<string, unknown>;
  /** Validation errors for this row, if any */
  errors?: string[];
}

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
  notes?: string;
}

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
  resolvedAt?: string; // ISO 8601
  /** Optional internal notes for support agents */
  notes?: string;
}
