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

export interface DraftFormData {
  tournamentId?: string;
  name: string;
  slug: string;
  description: string;
  contractId: string;
  organizerUnitId: string;
  visibility: TournamentVisibility;
  timeModel: "FIXED_WINDOW" | "MULTIDAY";
  timezone: string;
  rosterOpenAt: string;
  rosterCloseAt: string;
  startAt: string;
  endAt: string;
  competitionMode: "HUMAN_ONLINE" | "BOT_VS_BOT";
  pairingStrategy: "ARENA";
  minParticipants: number;
  maxParticipants: number;
  checkinRequired: boolean;
  expectedRevision?: number;
}

export function createDefaultCoreConfig(params: {
  tournamentCode: string;
  tournamentName: string;
  description?: string;
  organizersText?: string;
  competitionMode?: "HUMAN_ONLINE" | "BOT_VS_BOT";
  audienceScope?: "PUBLIC_REGISTERED" | "INTERNAL_UNIT" | "INVITED_LIST";
  scheduledStartAt: string;
  scheduledEndAt: string;
  maxParticipants?: number;
  minParticipantsToStart?: number;
  timezone?: string;
  checkinRequired?: boolean;
}) {
  return {
    tournamentCode: params.tournamentCode,
    tournamentName: params.tournamentName,
    shortDescription: params.description || "",
    organizersText: params.organizersText || "Ban Tổ chức Giải đấu",
    competitionMode: params.competitionMode || ("HUMAN_ONLINE" as const),
    audienceScope: params.audienceScope || ("PUBLIC_REGISTERED" as const),
    allowedUnitCodes: [] as string[],
    registrationIntakeMode: "IMPORT_ONLY" as const,
    maxParticipants: params.maxParticipants || 16,
    minParticipantsToStart: params.minParticipantsToStart || 2,
    timezone: params.timezone || "Asia/Ho_Chi_Minh",
    registrationOpenAt: null as string | null,
    registrationCloseAt: null as string | null,
    checkinRequired: Boolean(params.checkinRequired),
    checkinOpenAt: null as string | null,
    checkinCloseAt: null as string | null,
    scheduledStartAt: params.scheduledStartAt,
    scheduledEndAt: params.scheduledEndAt,
    format: "ARENA_CONTINUOUS" as const,
    pairingMethod: "SWISS_SCORE_ADJACENT" as const,
    maxMatchesPerPlayer: null as number | null,
    maxPairMeetings: 2,
    rematchCooldownMinutes: 5,
    maxConcurrentMatches: 8,
    byeScorePoints: 0,
    spectatorPolicy: "ROSTER_ONLY" as const,
    chatPolicy: "SPECTATOR_MUTED" as const,
    leaderboardVisibility: "LIVE_PUBLIC" as const,
    topNExportCount: 10,
    finalizationMode: "AUTO_FINAL" as const,
    scoringFormulaPreset: "ELO_WEIGHTED_V1" as const,
    initialScore: 1000,
    initialElo: 1000,
    kFactor: 32,
    scoreFloor: 0,
    botDeadlineAt: null as string | null,
  };
}

