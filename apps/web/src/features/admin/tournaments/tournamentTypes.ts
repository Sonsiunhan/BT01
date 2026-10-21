// Tournament initialization P01 data contracts and DTO types

export type TournamentLifecycleStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "CHANGES_REQUESTED"
  | "REJECTED"
  | "APPROVED"
  | "ROSTER_OPEN"
  | "READY"
  | "RUNNING"
  | "PAUSED"
  | "ENDED"
  | "REVIEWING"
  | "FINALIZED"
  | "ARCHIVED"
  | "CANCELLED";

export type TournamentVisibility = "PRIVATE" | "PUBLIC" | "UNLISTED";

export interface TournamentReadinessSummary {
  state: "READY" | "BLOCKED" | "CHECKING";
  blockerCount: number;
}

export interface TournamentListItem {
  tournamentId: string;
  name: string;
  slug: string;
  status: TournamentLifecycleStatus;
  visibility: TournamentVisibility;
  startAt: string | null;
  endAt: string | null;
  timezone: string;
  ownerDisplay: string;
  unitId?: string;
  unitName?: string;
  participantCount?: number;
  maxParticipants?: number;
  readiness: TournamentReadinessSummary;
  permittedActions: string[];
  revision: string;
}

export interface TournamentListQuery {
  q?: string;
  statuses?: TournamentLifecycleStatus[];
  statusGroup?: "ALL" | "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "RUNNING" | "FINISHED";
  unitId?: string;
  page?: number;
  pageSize?: number;
  sort?: "CREATED_DESC" | "START_ASC" | "UPDATED_DESC";
}

export interface TournamentPageInfo {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface TournamentCapabilities {
  canCreate: boolean;
  canViewAudit: boolean;
  canManageContracts: boolean;
  isSuperAdmin?: boolean;
}

export interface TournamentListResponse {
  items: TournamentListItem[];
  page: TournamentPageInfo;
  capabilities: TournamentCapabilities;
  timestamp: string;
}
