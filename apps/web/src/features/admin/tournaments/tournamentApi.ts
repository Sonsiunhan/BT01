import {
  type TournamentListItem,
  type TournamentListQuery,
  type TournamentListResponse,
  type TournamentCapabilities,
  type TournamentLifecycleStatus,
} from "./tournamentTypes";
import {
  type CreateTournamentDraftInput,
  type PatchTournamentDraftInput,
  type SubmitTournamentDraftInput,
  SubmitTournamentDraftInputSchema,
  type TournamentDto,
  type TournamentReadinessSnapshot,
  type TournamentConfigVersionDto,
  type AuditLogRecordDto,
  type TournamentLeaderboardSnapshotDto,
  type TournamentScoreLedgerEntryDto,
} from "@ottv2/contracts";
import { getMe } from "../../../services/auth/authApi";

type TournamentHttpError = Error & {
  statusCode: number;
  code: string;
  details?: unknown;
};

function createHttpError(body: unknown, statusCode: number, fallback: string, fallbackCode: string): TournamentHttpError {
  const payload = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  return Object.assign(
    new Error(typeof payload.message === "string" ? payload.message : fallback),
    {
      statusCode,
      code: typeof payload.code === "string" ? payload.code : fallbackCode,
      details: payload.details,
    },
  );
}

function createNetworkError(): TournamentHttpError {
  return Object.assign(
    new Error("Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại."),
    { statusCode: 0, code: "NETWORK_ERROR" },
  );
}

interface RequestJsonArgs {
  url: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  fallbackMessage: string;
  fallbackCode: string | ((statusCode: number) => string);
}

/**
 * Fetch wrapper trung thực: mọi lỗi mạng / HTTP non-ok đều ném ra ngoài,
 * không bao giờ tự chế dữ liệu thay thế.
 */
async function requestJson<T>(args: RequestJsonArgs): Promise<T> {
  let res: Response;
  try {
    res = await fetch(args.url, {
      method: args.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(args.body !== undefined ? { "Content-Type": "application/json" } : {}),
        "X-OTT-Request": "1",
      },
      credentials: "include",
      ...(args.body !== undefined ? { body: JSON.stringify(args.body) } : {}),
    });
  } catch {
    throw createNetworkError();
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw createHttpError(
      err,
      res.status,
      args.fallbackMessage,
      typeof args.fallbackCode === "function" ? args.fallbackCode(res.status) : args.fallbackCode,
    );
  }
  return await res.json() as T;
}

export interface TournamentApiPort {
  listTournaments(query?: TournamentListQuery): Promise<TournamentListResponse>;
  createDraft(input: CreateTournamentDraftInput): Promise<TournamentDto>;
  patchDraft(tournamentId: string, input: PatchTournamentDraftInput): Promise<TournamentDto>;
  getDraft(tournamentId: string): Promise<{ tournament: TournamentDto; configVersions: TournamentConfigVersionDto[] }>;
  deleteDraft(tournamentId: string): Promise<{ deleted: boolean; quotaRefunded: boolean }>;
  submitDraft(tournamentId: string, input: SubmitTournamentDraftInput): Promise<{ tournament: TournamentDto }>;

  // S05 Lifecycle and Readiness APIs
  getTournamentDetail(tournamentId: string): Promise<{ tournament: TournamentDto; configVersions: TournamentConfigVersionDto[] }>;
  getTournamentReadiness(tournamentId: string): Promise<{ readiness: TournamentReadinessSnapshot }>;
  getLeaderboard?(tournamentId: string): Promise<{ leaderboard: TournamentLeaderboardSnapshotDto }>;
  getMatches?(tournamentId: string): Promise<{ matches: TournamentScoreLedgerEntryDto[] }>;
  openScheduled(tournamentId: string, expectedRevision?: number): Promise<{ tournament: TournamentDto }>;
  startTournament(tournamentId: string, expectedRevision?: number): Promise<{ tournament: TournamentDto }>;
  pauseTournament(tournamentId: string, reason: string, expectedRevision?: number): Promise<{ tournament: TournamentDto }>;
  resumeTournament(tournamentId: string, expectedRevision?: number): Promise<{ tournament: TournamentDto }>;

  // S06 Audit Logs API
  listAuditLogs(filter?: {
    targetType?: string;
    targetId?: string;
    actorUserId?: string;
  }): Promise<{ logs: AuditLogRecordDto[] }>;
}

/**
 * Ánh xạ trung thực một TournamentDto của máy chủ (endpoint GET /api/tournaments)
 * sang TournamentListItem cho UI. Trường mà máy chủ không cung cấp (số thí sinh,
 * trạng thái sẵn sàng, quyền hành động) ánh xạ về trạng thái "không xác định",
 * KHÔNG bịa giá trị.
 */
export function mapServerTournamentListItem(t: unknown): TournamentListItem {
  const raw = (t && typeof t === "object" ? t : {}) as Record<string, unknown>;
  const core = (raw.coreConfig && typeof raw.coreConfig === "object" ? raw.coreConfig : {}) as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id : "";
  const audienceScope = typeof core.audienceScope === "string" ? core.audienceScope : undefined;
  return {
    tournamentId: id,
    name: (core.tournamentName as string) || (core.title as string) || "Giải đấu",
    slug: (core.tournamentCode as string) || id,
    status: raw.status as TournamentLifecycleStatus,
    visibility:
      audienceScope === "PUBLIC_COMMUNITY" || audienceScope === "PUBLIC_REGISTERED"
        ? "PUBLIC"
        : "PRIVATE",
    startAt: (core.scheduledStartAt as string) ?? null,
    endAt: (core.scheduledEndAt as string) ?? null,
    timezone: (core.timezone as string) || "Asia/Ho_Chi_Minh",
    ownerDisplay: (core.organizersText as string) || "Ban Tổ chức",
    unitId: typeof raw.unitId === "string" ? raw.unitId : undefined,
    // Máy chủ không trả tên đơn vị trong danh sách giải -> để trống, không bịa.
    participantCount: null,
    maxParticipants: typeof core.maxParticipants === "number" ? core.maxParticipants : null,
    readiness: { state: "UNKNOWN", blockerCount: null },
    permittedActions: ["view"],
    revision: `rev-${raw.revision ?? 1}`,
    lastReviewNote: typeof raw.lastReviewNote === "string" ? raw.lastReviewNote : null,
  };
}

/**
 * Suy luận quyền từ phiên đăng nhập thực (GET /auth/me). Không có endpoint
 * máy chủ riêng cho "quyền tạo giải", nên client chỉ báo cáo những gì biết
 * chắc: vai trò quản trị. Khi không xác định được -> null (unknown).
 */
async function resolveCapabilitiesFromSession(): Promise<TournamentCapabilities> {
  try {
    const me = await getMe();
    const user = me?.user as (Record<string, unknown> & { role?: string; roles?: string[] }) | undefined;
    const roles: string[] = [];
    if (typeof user?.role === "string") roles.push(user.role);
    if (Array.isArray(user?.roles)) {
      for (const r of user.roles) {
        if (typeof r === "string") roles.push(r);
      }
    }
    const isAdmin = roles.includes("ADMIN") || roles.includes("SYSTEM_ADMIN") || roles.includes("TOURNAMENT_ADMIN");
    return {
      canCreate: isAdmin,
      canViewAudit: null,
      canManageContracts: null,
    };
  } catch {
    return { canCreate: null, canViewAudit: null, canManageContracts: null };
  }
}

/**
 * Bộ lọc + phân trang thuần túy áp dụng LÊN KẾT QUẢ THẬT từ máy chủ
 * (máy chủ chưa hỗ trợ lọc/phân trang cho danh sách giải).
 */
export function applyListQuery(
  query: TournamentListQuery = {},
  items: TournamentListItem[],
  capabilities: TournamentCapabilities,
): TournamentListResponse {
  let filtered = [...items];

  // 1. Text search (by name or slug)
  if (query.q && query.q.trim()) {
    const qLower = query.q.trim().toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.name.toLowerCase().includes(qLower) ||
        t.slug.toLowerCase().includes(qLower) ||
        t.ownerDisplay.toLowerCase().includes(qLower)
    );
  }

  // 2. Status Group filtering
  if (query.statusGroup && query.statusGroup !== "ALL") {
    filtered = filtered.filter((t) => matchesStatusGroup(t.status, query.statusGroup!));
  } else if (query.statuses && query.statuses.length > 0) {
    filtered = filtered.filter((t) => query.statuses!.includes(t.status));
  }

  // 3. Unit filter
  if (query.unitId) {
    filtered = filtered.filter((t) => t.unitId === query.unitId);
  }

  // 4. Pagination
  const page = Math.max(1, query.page || 1);
  const pageSize = Math.max(1, query.pageSize || 10);
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (page - 1) * pageSize;
  const paginatedItems = filtered.slice(startIndex, startIndex + pageSize);

  return {
    items: paginatedItems,
    page: {
      currentPage: page,
      pageSize,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    capabilities,
    timestamp: new Date().toISOString(),
  };
}

export class TournamentApiClient implements TournamentApiPort {
  async listTournaments(query: TournamentListQuery = {}): Promise<TournamentListResponse> {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.unitId) params.set("unitId", query.unitId);
    if (query.page) params.set("page", String(query.page));
    if (query.pageSize) params.set("pageSize", String(query.pageSize));
    if (query.sort) params.set("sort", query.sort);
    if (query.statuses && query.statuses.length > 0) {
      params.set("statuses", query.statuses.join(","));
    }
    const qs = params.toString();

    const [data, capabilities] = await Promise.all([
      requestJson<{ tournaments: unknown[]; capabilities?: TournamentCapabilities }>({
        url: `/api/tournaments${qs ? `?${qs}` : ""}`,
        fallbackMessage: "Không thể tải danh sách giải đấu",
        fallbackCode: "LIST_TOURNAMENTS_FAILED",
      }),
      resolveCapabilitiesFromSession(),
    ]);

    if (!data || !Array.isArray(data.tournaments)) {
      throw createHttpError(
        data,
        502,
        "Phản hồi danh sách giải đấu từ máy chủ không hợp lệ",
        "LIST_TOURNAMENTS_INVALID_RESPONSE",
      );
    }

    const items = data.tournaments.map(mapServerTournamentListItem);
    const finalCapabilities: TournamentCapabilities = {
      ...capabilities,
      ...(data.capabilities && typeof data.capabilities === "object" ? data.capabilities : {}),
    };
    return applyListQuery(query, items, finalCapabilities);
  }

  async createDraft(input: CreateTournamentDraftInput): Promise<TournamentDto> {
    const body = await requestJson<{ tournament: TournamentDto }>({
      url: "/api/tournaments/drafts",
      method: "POST",
      body: input,
      fallbackMessage: "Không thể tạo bản nháp giải đấu",
      fallbackCode: "CREATE_DRAFT_FAILED",
    });
    return body.tournament;
  }

  async getDraft(tournamentId: string): Promise<{ tournament: TournamentDto; configVersions: TournamentConfigVersionDto[] }> {
    return requestJson<{ tournament: TournamentDto; configVersions: TournamentConfigVersionDto[] }>({
      url: `/api/tournaments/${encodeURIComponent(tournamentId)}`,
      fallbackMessage: "Không thể tải bản nháp",
      fallbackCode: "GET_DRAFT_FAILED",
    });
  }

  async patchDraft(tournamentId: string, input: PatchTournamentDraftInput): Promise<TournamentDto> {
    const body = await requestJson<{ tournament: TournamentDto }>({
      url: `/api/tournaments/${encodeURIComponent(tournamentId)}`,
      method: "PATCH",
      body: input,
      fallbackMessage: "Không thể cập nhật bản nháp giải đấu",
      fallbackCode: (status) => (status === 409 ? "CONFLICT" : "PATCH_DRAFT_FAILED"),
    });
    return body.tournament;
  }

  async deleteDraft(tournamentId: string): Promise<{ deleted: boolean; quotaRefunded: boolean }> {
    return requestJson<{ deleted: boolean; quotaRefunded: boolean }>({
      url: `/api/tournaments/${encodeURIComponent(tournamentId)}`,
      method: "DELETE",
      fallbackMessage: "Không thể xóa bản nháp giải đấu",
      fallbackCode: "DELETE_DRAFT_FAILED",
    });
  }

  async submitDraft(tournamentId: string, input: SubmitTournamentDraftInput): Promise<{ tournament: TournamentDto }> {
    SubmitTournamentDraftInputSchema.parse(input);
    return requestJson<{ tournament: TournamentDto }>({
      url: `/api/tournaments/${encodeURIComponent(tournamentId)}/submit`,
      method: "POST",
      body: input,
      fallbackMessage: "Không thể nộp duyệt bản nháp giải đấu",
      fallbackCode: (status) => (status === 409 ? "CONFLICT" : "SUBMIT_DRAFT_FAILED"),
    });
  }

  async getTournamentDetail(tournamentId: string): Promise<{ tournament: TournamentDto; configVersions: TournamentConfigVersionDto[] }> {
    return this.getDraft(tournamentId);
  }

  async getTournamentReadiness(tournamentId: string): Promise<{ readiness: TournamentReadinessSnapshot }> {
    return requestJson<{ readiness: TournamentReadinessSnapshot }>({
      url: `/api/tournaments/${encodeURIComponent(tournamentId)}/readiness`,
      fallbackMessage: "Không thể kiểm tra điều kiện sẵn sàng",
      fallbackCode: "GET_READINESS_FAILED",
    });
  }

  async getLeaderboard(tournamentId: string): Promise<{ leaderboard: TournamentLeaderboardSnapshotDto }> {
    return requestJson<{ leaderboard: TournamentLeaderboardSnapshotDto }>({
      url: `/api/tournaments/${encodeURIComponent(tournamentId)}/leaderboard`,
      fallbackMessage: "Không thể tải bảng xếp hạng giải đấu",
      fallbackCode: "GET_LEADERBOARD_FAILED",
    });
  }

  async getMatches(tournamentId: string): Promise<{ matches: TournamentScoreLedgerEntryDto[] }> {
    return requestJson<{ matches: TournamentScoreLedgerEntryDto[] }>({
      url: `/api/tournaments/${encodeURIComponent(tournamentId)}/matches`,
      fallbackMessage: "Không thể tải nhật ký trận đấu",
      fallbackCode: "GET_MATCHES_FAILED",
    });
  }

  async openScheduled(tournamentId: string, expectedRevision?: number): Promise<{ tournament: TournamentDto }> {
    return requestJson<{ tournament: TournamentDto }>({
      url: `/api/tournaments/${encodeURIComponent(tournamentId)}/open-scheduled`,
      method: "POST",
      body: { expectedRevision },
      fallbackMessage: "Không thể chuyển giải sang trạng thái mở lịch trình",
      fallbackCode: "OPEN_SCHEDULED_FAILED",
    });
  }

  async startTournament(tournamentId: string, expectedRevision?: number): Promise<{ tournament: TournamentDto }> {
    return requestJson<{ tournament: TournamentDto }>({
      url: `/api/tournaments/${encodeURIComponent(tournamentId)}/start`,
      method: "POST",
      body: { expectedRevision },
      fallbackMessage: "Không thể bắt đầu giải đấu",
      fallbackCode: "START_TOURNAMENT_FAILED",
    });
  }

  async pauseTournament(tournamentId: string, reason: string, expectedRevision?: number): Promise<{ tournament: TournamentDto }> {
    return requestJson<{ tournament: TournamentDto }>({
      url: `/api/tournaments/${encodeURIComponent(tournamentId)}/pause`,
      method: "POST",
      body: { reason, expectedRevision },
      fallbackMessage: "Không thể tạm dừng giải đấu",
      fallbackCode: "PAUSE_TOURNAMENT_FAILED",
    });
  }

  async resumeTournament(tournamentId: string, expectedRevision?: number): Promise<{ tournament: TournamentDto }> {
    return requestJson<{ tournament: TournamentDto }>({
      url: `/api/tournaments/${encodeURIComponent(tournamentId)}/resume`,
      method: "POST",
      body: { expectedRevision },
      fallbackMessage: "Không thể tiếp tục giải đấu",
      fallbackCode: "RESUME_TOURNAMENT_FAILED",
    });
  }

  async listAuditLogs(filter?: {
    targetType?: string;
    targetId?: string;
    actorUserId?: string;
  }): Promise<{ logs: AuditLogRecordDto[] }> {
    const params = new URLSearchParams();
    if (filter?.targetType) params.set("targetType", filter.targetType);
    if (filter?.targetId) params.set("targetId", filter.targetId);
    if (filter?.actorUserId) params.set("actorUserId", filter.actorUserId);
    const qs = params.toString();
    return requestJson<{ logs: AuditLogRecordDto[] }>({
      url: `/api/admin/audit-logs${qs ? `?${qs}` : ""}`,
      fallbackMessage: "Không thể tải dữ liệu nhật ký kiểm toán",
      fallbackCode: "LIST_AUDIT_LOGS_FAILED",
    });
  }
}

// Local draft buffer persistence helpers for offline recovery and network resilience
const DRAFT_BUFFER_PREFIX = "ottv2_tournament_draft_buffer_";
const memoryStorage = new Map<string, string>();

function getStorageItem(key: string): string | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // fallback
  }
  return memoryStorage.get(key) ?? null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch {
    // fallback
  }
  memoryStorage.set(key, value);
}

function removeStorageItem(key: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(key);
      return;
    }
  } catch {
    // fallback
  }
  memoryStorage.delete(key);
}

export function saveLocalDraftBuffer<T>(key: string, data: T): void {
  setStorageItem(`${DRAFT_BUFFER_PREFIX}${key}`, JSON.stringify(data));
}

/**
 * Resolves the current authenticated user id (uncached so a logout/login in
 * the same SPA session is honored). Draft buffers are namespaced by this id to
 * prevent one account's in-progress form from leaking into another account's
 * wizard on a shared browser.
 */
export async function getSessionIdentity(): Promise<string | null> {
  try {
    const me = await getMe();
    const user = me?.user as { id?: string } | undefined;
    return typeof user?.id === "string" && user.id ? user.id : null;
  } catch {
    return null;
  }
}

export function getLocalDraftBuffer<T>(key: string): T | null {
  const item = getStorageItem(`${DRAFT_BUFFER_PREFIX}${key}`);
  if (!item) return null;
  try {
    return JSON.parse(item) as T;
  } catch {
    return null;
  }
}

export function clearLocalDraftBuffer(key: string): void {
  removeStorageItem(`${DRAFT_BUFFER_PREFIX}${key}`);
}

export function matchesStatusGroup(
  status: TournamentLifecycleStatus,
  group: "ALL" | "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "RUNNING" | "FINISHED"
): boolean {
  switch (group) {
    case "ALL":
      return true;
    case "DRAFT":
      return status === "DRAFT" || status === "CHANGES_REQUESTED";
    case "PENDING_REVIEW":
      return status === "SUBMITTED" || status === "UNDER_REVIEW";
    case "APPROVED":
      return status === "APPROVED" || status === "READY" || status === "ROSTER_OPEN" || status === "SCHEDULED";
    case "RUNNING":
      return status === "RUNNING" || status === "PAUSED";
    case "FINISHED":
      return status === "ENDED" || status === "FINALIZED" || status === "ARCHIVED" || status === "CANCELLED" || status === "REJECTED";
    default:
      return true;
  }
}

export const defaultTournamentApi = new TournamentApiClient();
