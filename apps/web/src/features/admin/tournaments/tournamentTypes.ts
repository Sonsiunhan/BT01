import {
  type TournamentStatus,
  type TournamentDto,
  type TournamentCoreConfig,
  type TournamentReadinessSnapshot,
  type SpectatorPolicy,
  type ChatPolicy,
  type LeaderboardVisibility,
  normalizeTournamentCoreConfig,
} from "@ottv2/contracts";

export interface TournamentDetailData {
  tournament: TournamentDto;
  configVersions: unknown[];
  readiness?: TournamentReadinessSnapshot;
}

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
  /** "UNKNOWN" khi máy chủ không cung cấp dữ liệu sẵn sàng cho danh sách giải. */
  state: "READY" | "BLOCKED" | "CHECKING" | "UNKNOWN";
  /** null khi không xác định được số điểm nghẽn từ dữ liệu máy chủ. */
  blockerCount: number | null;
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
  /** null khi máy chủ không cung cấp số liệu thí sinh cho danh sách giải. */
  participantCount: number | null;
  maxParticipants: number | null;
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
  /**
   * null = không xác định được từ nguồn thực (máy chủ không có endpoint quyền
   * riêng cho tạo giải; client suy luận từ vai trò phiên đăng nhập).
   */
  canCreate: boolean | null;
  canViewAudit: boolean | null;
  canManageContracts: boolean | null;
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
    participantCount: null,
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

/**
 * Converts a backend TournamentDto into DraftFormData for wizard editing
 */
export function tournamentDtoToDraftFormData(dto: TournamentDto): Partial<DraftFormData> {
  return {
    tournamentId: dto.id,
    name: dto.coreConfig.tournamentName,
    slug: dto.coreConfig.tournamentCode,
    description: dto.coreConfig.shortDescription || "",
    contractId: dto.contractId,
    organizerUnitId: dto.unitId,
    visibility: dto.coreConfig.audienceScope === "PUBLIC_REGISTERED" ? "PUBLIC" : "PRIVATE",
    timezone: dto.coreConfig.timezone,
    startAt: dto.coreConfig.scheduledStartAt || "",
    endAt: dto.coreConfig.scheduledEndAt || "",
    rosterOpenAt: dto.coreConfig.registrationOpenAt || "",
    rosterCloseAt: dto.coreConfig.registrationCloseAt || "",
    competitionMode: dto.coreConfig.competitionMode,
    minParticipants: dto.coreConfig.minParticipantsToStart,
    maxParticipants: dto.coreConfig.maxParticipants,
    checkinRequired: dto.coreConfig.checkinRequired,
    allowedUnitCodes: dto.coreConfig.allowedUnitCodes || [],
    checkinOpenAt: dto.coreConfig.checkinOpenAt || "",
    checkinCloseAt: dto.coreConfig.checkinCloseAt || "",
    botDeadlineAt: dto.coreConfig.botDeadlineAt || "",
    organizersText: dto.coreConfig.organizersText || "Ban Tổ chức Giải đấu",
    maxMatchesPerPlayer: dto.coreConfig.maxMatchesPerPlayer ?? null,
    maxPairMeetings: dto.coreConfig.maxPairMeetings ?? 2,
    rematchCooldownMinutes: dto.coreConfig.rematchCooldownMinutes ?? 5,
    maxConcurrentMatches: dto.coreConfig.maxConcurrentMatches ?? 8,
    byeScorePoints: dto.coreConfig.byeScorePoints ?? 0,
    spectatorPolicy: dto.coreConfig.spectatorPolicy || "ROSTER_ONLY",
    chatPolicy: dto.coreConfig.chatPolicy || "SPECTATOR_MUTED",
    leaderboardVisibility: dto.coreConfig.leaderboardVisibility || "LIVE_PUBLIC",
    initialScore: dto.coreConfig.initialScore ?? 1000,
    initialElo: dto.coreConfig.initialElo ?? 1000,
    kFactor: dto.coreConfig.kFactor ?? 32,
    scoreFloor: dto.coreConfig.scoreFloor ?? 0,
    expectedRevision: dto.revision,
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

  // S04 Extended Form Groups
  allowedUnitCodes?: string[];
  checkinOpenAt?: string | null;
  checkinCloseAt?: string | null;
  botDeadlineAt?: string | null;
  organizersText?: string;
  regulationsText?: string;
  contactChannel?: string;
  maxMatchesPerPlayer?: number | null;
  maxPairMeetings?: number;
  rematchCooldownMinutes?: number;
  maxConcurrentMatches?: number;
  byeScorePoints?: number;
  spectatorPolicy?: SpectatorPolicy;
  chatPolicy?: ChatPolicy;
  leaderboardVisibility?: LeaderboardVisibility;
  initialScore?: number;
  initialElo?: number;
  kFactor?: number;
  scoreFloor?: number;
}

export function createDefaultCoreConfig(params: {
  tournamentCode: string;
  tournamentName: string;
  description?: string;
  organizersText?: string;
  competitionMode?: "HUMAN_ONLINE" | "BOT_VS_BOT";
  audienceScope?: "PUBLIC_REGISTERED" | "INTERNAL_UNIT" | "INVITED_LIST";
  allowedUnitCodes?: string[];
  scheduledStartAt: string;
  scheduledEndAt: string;
  maxParticipants?: number;
  minParticipantsToStart?: number;
  timezone?: string;
  checkinRequired?: boolean;
  checkinOpenAt?: string | null;
  checkinCloseAt?: string | null;
  botDeadlineAt?: string | null;
  maxMatchesPerPlayer?: number | null;
  maxPairMeetings?: number;
  rematchCooldownMinutes?: number;
  maxConcurrentMatches?: number;
  byeScorePoints?: number;
  spectatorPolicy?: SpectatorPolicy;
  chatPolicy?: ChatPolicy;
  leaderboardVisibility?: LeaderboardVisibility;
  initialScore?: number;
  initialElo?: number;
  kFactor?: number;
  scoreFloor?: number;
}): TournamentCoreConfig {
  const raw: TournamentCoreConfig = {
    tournamentCode: params.tournamentCode,
    tournamentName: params.tournamentName,
    shortDescription: params.description || "",
    organizersText: params.organizersText || "Ban Tổ chức Giải đấu",
    competitionMode: params.competitionMode || ("HUMAN_ONLINE" as const),
    audienceScope: params.audienceScope || ("PUBLIC_REGISTERED" as const),
    allowedUnitCodes: params.allowedUnitCodes || [],
    registrationIntakeMode: "IMPORT_ONLY" as const,
    maxParticipants: params.maxParticipants || 16,
    minParticipantsToStart: params.minParticipantsToStart || 2,
    timezone: params.timezone || "Asia/Ho_Chi_Minh",
    registrationOpenAt: null as string | null,
    registrationCloseAt: null as string | null,
    checkinRequired: Boolean(params.checkinRequired),
    checkinOpenAt: params.checkinOpenAt || null,
    checkinCloseAt: params.checkinCloseAt || null,
    scheduledStartAt: params.scheduledStartAt,
    scheduledEndAt: params.scheduledEndAt,
    format: "ARENA_CONTINUOUS" as const,
    pairingMethod: "SWISS_SCORE_ADJACENT" as const,
    maxMatchesPerPlayer: params.maxMatchesPerPlayer ?? null,
    maxPairMeetings: params.maxPairMeetings ?? 2,
    rematchCooldownMinutes: params.rematchCooldownMinutes ?? 5,
    maxConcurrentMatches: params.maxConcurrentMatches ?? 8,
    byeScorePoints: params.byeScorePoints ?? 0,
    spectatorPolicy: params.spectatorPolicy || ("ROSTER_ONLY" as const),
    chatPolicy: params.chatPolicy || ("SPECTATOR_MUTED" as const),
    leaderboardVisibility: params.leaderboardVisibility || ("LIVE_PUBLIC" as const),
    topNExportCount: 10,
    finalizationMode: "AUTO_FINAL" as const,
    scoringFormulaPreset: "ELO_WEIGHTED_V1" as const,
    initialScore: params.initialScore ?? 1000,
    initialElo: params.initialElo ?? 1000,
    kFactor: params.kFactor ?? 32,
    scoreFloor: params.scoreFloor ?? 0,
    botDeadlineAt: params.botDeadlineAt || null,
  };

  return normalizeTournamentCoreConfig(raw);
}

