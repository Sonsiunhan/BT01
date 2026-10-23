import type { TournamentStatus, TournamentDto } from "@ottv2/contracts";

// Canonical status from @ottv2/contracts + extended lifecycle UI states
export type TournamentLifecycleStatus =
  | TournamentStatus
  | "SUBMITTED"
  | "ROSTER_OPEN"
  | "READY"
  | "REVIEWING"
  | "FINALIZED";

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

/**
 * Converts a canonical backend TournamentDto into a P01 TournamentListItem
 */
export function tournamentDtoToListItem(dto: TournamentDto): TournamentListItem {
  const isDraftLike = dto.status === "DRAFT" || dto.status === "CHANGES_REQUESTED";
  return {
    tournamentId: dto.id,
    name: dto.coreConfig.tournamentName,
    slug: dto.coreConfig.tournamentCode,
    status: dto.status,
    visibility: dto.coreConfig.audienceScope === "PUBLIC_REGISTERED" ? "PUBLIC" : "PRIVATE",
    startAt: dto.coreConfig.scheduledStartAt,
    endAt: dto.coreConfig.scheduledEndAt,
    timezone: dto.coreConfig.timezone,
    ownerDisplay: dto.coreConfig.organizersText,
    unitId: dto.unitId,
    maxParticipants: dto.coreConfig.maxParticipants,
    readiness: {
      state:
        dto.status === "RUNNING" || dto.status === "SCHEDULED" || dto.status === "APPROVED"
          ? "READY"
          : isDraftLike
          ? "BLOCKED"
          : "CHECKING",
      blockerCount: isDraftLike ? 1 : 0,
    },
    permittedActions: isDraftLike ? ["view", "edit_draft"] : ["view"],
    revision: String(dto.revision),
  };
}
