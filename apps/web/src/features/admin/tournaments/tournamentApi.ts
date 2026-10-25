import {
  type TournamentListItem,
  type TournamentListQuery,
  type TournamentListResponse,
  type TournamentLifecycleStatus,
  createDefaultCoreConfig,
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
  DEFAULT_TOURNAMENT_RULE_PROFILE,
} from "@ottv2/contracts";

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

function isHttpError(error: unknown): error is TournamentHttpError {
  return error instanceof Error && "statusCode" in error && typeof error.statusCode === "number";
}

// Baseline fixture data for development and tests (complying with S00 / Robot Lab)
export const FIXTURE_TOURNAMENTS: TournamentListItem[] = [
  {
    tournamentId: "tour-001",
    name: "Giải Vô địch Quốc gia Robot Lab 2026",
    slug: "vld-robot-lab-2026",
    status: "RUNNING",
    visibility: "PUBLIC",
    startAt: "2026-10-21T08:00:00.000Z",
    endAt: "2026-10-24T18:00:00.000Z",
    timezone: "Asia/Ho_Chi_Minh",
    ownerDisplay: "Khoa CNTT - ĐHQG",
    unitId: "unit-dhqg",
    unitName: "Đại học Quốc gia",
    participantCount: 32,
    maxParticipants: 32,
    readiness: { state: "READY", blockerCount: 0 },
    permittedActions: ["view", "manage_matches", "pause", "incident"],
    revision: "rev-8",
  },
  {
    tournamentId: "tour-002",
    name: "Vòng loại Khu vực phía Bắc - Kỳ Môn Độn Giáp",
    slug: "vong-loai-bac-2026",
    status: "APPROVED",
    visibility: "PUBLIC",
    startAt: "2026-10-25T09:00:00.000Z",
    endAt: "2026-10-26T17:00:00.000Z",
    timezone: "Asia/Ho_Chi_Minh",
    ownerDisplay: "Học viện Kỹ thuật Quân sự",
    unitId: "unit-mta",
    unitName: "HV Kỹ thuật Quân sự",
    participantCount: 16,
    maxParticipants: 24,
    readiness: { state: "READY", blockerCount: 0 },
    permittedActions: ["view", "edit_schedule", "invite_staff"],
    revision: "rev-3",
  },
  {
    tournamentId: "tour-003",
    name: "Giải Giao hữu Tân sinh viên K22",
    slug: "giao-huu-k22",
    status: "DRAFT",
    visibility: "PRIVATE",
    startAt: null,
    endAt: null,
    timezone: "Asia/Ho_Chi_Minh",
    ownerDisplay: "CLB Trí tuệ Nhân tạo",
    unitId: "unit-clb-ai",
    unitName: "CLB AI",
    participantCount: 8,
    maxParticipants: 16,
    readiness: { state: "BLOCKED", blockerCount: 2 },
    permittedActions: ["view", "edit_draft", "delete_draft", "submit"],
    revision: "rev-1",
  },
  {
    tournamentId: "tour-004",
    name: "Giải Đấu Cúp Mùa Thu 2026",
    slug: "cup-mua-thu-2026",
    status: "UNDER_REVIEW",
    visibility: "UNLISTED",
    startAt: "2026-11-01T13:00:00.000Z",
    endAt: "2026-11-03T18:00:00.000Z",
    timezone: "Asia/Ho_Chi_Minh",
    ownerDisplay: "Viện Nghiên cứu Đổi mới Sáng tạo",
    unitId: "unit-vin",
    unitName: "Viện ĐMST",
    participantCount: 12,
    maxParticipants: 16,
    readiness: { state: "CHECKING", blockerCount: 1 },
    permittedActions: ["view"],
    revision: "rev-2",
  },
  {
    tournamentId: "tour-005",
    name: "Giải Thử nghiệm Thuật toán Minimax V2",
    slug: "thu-nghiem-minimax-v2",
    status: "FINALIZED",
    visibility: "PUBLIC",
    startAt: "2026-10-15T08:00:00.000Z",
    endAt: "2026-10-18T16:00:00.000Z",
    timezone: "Asia/Ho_Chi_Minh",
    ownerDisplay: "Phòng Thí nghiệm Robot Tự hành",
    unitId: "unit-dhqg",
    unitName: "Đại học Quốc gia",
    participantCount: 16,
    maxParticipants: 16,
    readiness: { state: "READY", blockerCount: 0 },
    permittedActions: ["view", "view_audit", "export_results"],
    revision: "rev-12",
  },
];


export const FIXTURE_AUDIT_LOGS: AuditLogRecordDto[] = [
  {
    id: "audit-001",
    actorUserId: "user-ta-01",
    actorRole: "TOURNAMENT_ADMIN",
    action: "CREATE_DRAFT",
    targetType: "TOURNAMENT",
    targetId: "tour-001",
    beforeSnapshot: null,
    afterSnapshot: {
      name: "Giải Vô địch Quốc gia Robot Lab 2026",
      status: "DRAFT",
    },
    reason: "Khởi tạo giải đấu mùa giải 2026",
    correlationId: "corr-001",
    createdAt: "2026-10-21T08:00:00.000Z",
  },
  {
    id: "audit-002",
    actorUserId: "user-admin-01",
    actorRole: "ADMIN",
    action: "APPROVE",
    targetType: "TOURNAMENT",
    targetId: "tour-001",
    beforeSnapshot: { status: "UNDER_REVIEW" },
    afterSnapshot: { status: "APPROVED" },
    reason: "Phê duyệt tổ chức giải đấu",
    correlationId: "corr-002",
    createdAt: "2026-10-21T09:00:00.000Z",
  },
  {
    id: "audit-003",
    actorUserId: "user-ta-01",
    actorRole: "TOURNAMENT_ADMIN",
    action: "PUBLISH_RULE_VERSION",
    targetType: "RULE_VERSION",
    targetId: "tour-001",
    beforeSnapshot: null,
    afterSnapshot: { versionNumber: 1, effectiveTime: "2026-10-21T09:30:00.000Z" },
    reason: "Công bố phiên bản luật tiêu chuẩn",
    correlationId: "corr-003",
    createdAt: "2026-10-21T09:30:00.000Z",
  },
  {
    id: "audit-004",
    actorUserId: "user-admin-01",
    actorRole: "ADMIN",
    action: "UPDATE_CONFIG",
    targetType: "CONTRACT",
    targetId: "HD-2026-CHUNG",
    beforeSnapshot: { maxTournaments: 5 },
    afterSnapshot: { maxTournaments: 10 },
    reason: "Nâng hạn mức số giải đấu theo phụ lục",
    correlationId: "corr-004",
    createdAt: "2026-10-20T10:00:00.000Z",
  },
];

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

export class TournamentApiClient implements TournamentApiPort {
  private useRealApi: boolean = true;

  constructor(options?: { useRealApi?: boolean }) {
    if (options?.useRealApi !== undefined) {
      this.useRealApi = options.useRealApi;
    }
  }

  async listTournaments(query: TournamentListQuery = {}): Promise<TournamentListResponse> {
    try {
      const params = new URLSearchParams();
      if (query.q) params.set("q", query.q);
      if (query.unitId) params.set("unitId", query.unitId);
      if (query.page) params.set("page", String(query.page));
      if (query.pageSize) params.set("pageSize", String(query.pageSize));
      if (query.sort) params.set("sort", query.sort);
      if (query.statuses && query.statuses.length > 0) {
        params.set("statuses", query.statuses.join(","));
      }

      const res = await fetch(`/api/tournaments?${params.toString()}`, {
        headers: { Accept: "application/json", "X-OTT-Request": "1" },
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tournaments)) {
          const serverItems: TournamentListItem[] = data.tournaments.map((t: any) => ({
            tournamentId: t.id,
            name: t.coreConfig?.tournamentName || t.coreConfig?.title || "Giải đấu",
            slug: t.coreConfig?.tournamentCode || t.id,
            status: t.status,
            visibility:
              t.coreConfig?.audienceScope === "PUBLIC_COMMUNITY" ||
              t.coreConfig?.audienceScope === "PUBLIC_REGISTERED"
                ? "PUBLIC"
                : "PRIVATE",
            startAt: t.coreConfig?.scheduledStartAt ?? null,
            endAt: t.coreConfig?.scheduledEndAt ?? null,
            timezone: t.coreConfig?.timezone || "Asia/Ho_Chi_Minh",
            ownerDisplay: t.coreConfig?.organizersText || "Ban Tổ chức",
            unitId: t.unitId,
            unitName: t.coreConfig?.organizersText || "Đơn vị",
            participantCount: t.coreConfig?.maxParticipants ?? 500,
            maxParticipants: t.coreConfig?.maxParticipants ?? 500,
            readiness: { state: "READY", blockerCount: 0 },
            permittedActions: ["view", "manage_matches", "pause", "incident"],
            revision: `rev-${t.revision ?? 1}`,
          }));
          return this.filterFixtures(query, serverItems);
        }
      }
    } catch {
      // Fall back to client-filtered dataset when API is not running
    }

    // Client-side filtering logic matching server contract
    return this.filterFixtures(query);
  }

  public filterFixtures(query: TournamentListQuery = {}, customItems?: TournamentListItem[]): TournamentListResponse {
    let filtered = [...(customItems ?? FIXTURE_TOURNAMENTS)];

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
      capabilities: {
        canCreate: true,
        canViewAudit: true,
        canManageContracts: true,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async createDraft(input: CreateTournamentDraftInput): Promise<TournamentDto> {
    try {
      const res = await fetch("/api/tournaments/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-OTT-Request": "1" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      if (res.ok) {
        const body = await res.json();
        return body.tournament;
      }
      const err = await res.json().catch(() => ({}));
      throw createHttpError(err, res.status, "Không thể tạo bản nháp giải đấu", "CREATE_DRAFT_FAILED");
    } catch (error: unknown) {
      if (isHttpError(error)) throw error;
      // In offline / test-fixture mode, generate a mock TournamentDto
      const now = new Date().toISOString();
      const mockDto: TournamentDto = {
        id: `draft-${Date.now()}`,
        contractId: input.contractId,
        contractCode: "CONTRACT-DEFAULT",
        unitId: "unit-001",
        ownerTaUserId: "ta-current",
        status: "DRAFT",
        revision: 1,
        activeConfigVersionId: null,
        activeConfigVersionNumber: 0,
        approvedSnapshot: null,
        everApproved: false,
        quotaRefunded: false,
        coreConfig: input.coreConfig,
        ruleProfile: input.ruleProfile || DEFAULT_TOURNAMENT_RULE_PROFILE,
        submittedAt: null,
        approvedAt: null,
        rejectedAt: null,
        changesRequestedAt: null,
        lastReviewNote: null,
        lastReviewFieldNotes: {},
        startedAt: null,
        pausedAt: null,
        pauseReason: null,
        endedAt: null,
        cancelledAt: null,
        cancelReason: null,
        finalizedAt: null,
        copiedFromTournamentId: null,
        createdAt: now,
        updatedAt: now,
      };
      return mockDto;
    }
  }

  async getDraft(tournamentId: string): Promise<{ tournament: TournamentDto; configVersions: TournamentConfigVersionDto[] }> {
    try {
      const res = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}`, {
        headers: { Accept: "application/json", "X-OTT-Request": "1" },
        credentials: "include",
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => ({}));
      throw createHttpError(err, res.status, "Không thể tải bản nháp", "GET_DRAFT_FAILED");
    } catch (error: unknown) {
      if (isHttpError(error)) throw error;
      // Fixture fallback
      const found = FIXTURE_TOURNAMENTS.find((t) => t.tournamentId === tournamentId);
      const now = new Date().toISOString();
      const mock: TournamentDto = {
        id: tournamentId,
        contractId: "contract-001",
        contractCode: "CONTRACT-DEFAULT",
        unitId: found?.unitId || "unit-001",
        ownerTaUserId: "ta-current",
        status: found?.status && ["DRAFT", "CHANGES_REQUESTED", "UNDER_REVIEW", "APPROVED", "SCHEDULED", "RUNNING", "PAUSED", "ENDED", "CANCELLED", "FINALIZED", "ARCHIVED", "REJECTED"].includes(found.status)
          ? found.status as TournamentDto["status"]
          : "DRAFT",
        revision: 1,
        activeConfigVersionId: null,
        activeConfigVersionNumber: 0,
        approvedSnapshot: null,
        everApproved: false,
        quotaRefunded: false,
        coreConfig: createDefaultCoreConfig({
          tournamentName: found?.name || "Giải đấu nháp",
          tournamentCode: found?.slug || "giai-dau-nhap",
          description: "Mô tả giải đấu nháp",
          timezone: found?.timezone || "Asia/Ho_Chi_Minh",
          scheduledStartAt: found?.startAt || now,
          scheduledEndAt: found?.endAt || new Date(Date.now() + 86400000 * 7).toISOString(),
          competitionMode: "HUMAN_ONLINE",
          maxParticipants: found?.maxParticipants || 32,
          minParticipantsToStart: 4,
          organizersText: found?.ownerDisplay || "Đơn vị tổ chức",
          audienceScope: found?.visibility === "PUBLIC" ? "PUBLIC_REGISTERED" : "INTERNAL_UNIT",
        }),
        ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
        submittedAt: null,
        approvedAt: null,
        rejectedAt: null,
        changesRequestedAt: null,
        lastReviewNote: null,
        lastReviewFieldNotes: {},
        startedAt: null,
        pausedAt: null,
        pauseReason: null,
        endedAt: null,
        cancelledAt: null,
        cancelReason: null,
        finalizedAt: null,
        copiedFromTournamentId: null,
        createdAt: now,
        updatedAt: now,
      };
      return { tournament: mock, configVersions: [] };
    }
  }

  async patchDraft(tournamentId: string, input: PatchTournamentDraftInput): Promise<TournamentDto> {
    const res = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-OTT-Request": "1" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const body = await res.json();
      return body.tournament;
    }
    const err = await res.json().catch(() => ({}));
    throw createHttpError(err, res.status, "Không thể cập nhật bản nháp giải đấu", res.status === 409 ? "CONFLICT" : "PATCH_DRAFT_FAILED");
  }

  async deleteDraft(tournamentId: string): Promise<{ deleted: boolean; quotaRefunded: boolean }> {
    const res = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}`, {
      method: "DELETE",
      headers: { "X-OTT-Request": "1" },
      credentials: "include",
    });
    if (res.ok) {
      return await res.json();
    }
    const err = await res.json().catch(() => ({}));
    throw createHttpError(err, res.status, "Không thể xóa bản nháp giải đấu", "DELETE_DRAFT_FAILED");
  }

  async submitDraft(tournamentId: string, input: SubmitTournamentDraftInput): Promise<{ tournament: TournamentDto }> {
    SubmitTournamentDraftInputSchema.parse(input);
    try {
      const res = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-OTT-Request": "1" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => ({}));
      throw createHttpError(
        err,
        res.status,
        "Không thể nộp duyệt bản nháp giải đấu",
        res.status === 409 ? "CONFLICT" : "SUBMIT_DRAFT_FAILED"
      );
    } catch (error: unknown) {
      if (isHttpError(error)) throw error;
      // Fixture / Offline fallback
      const item = FIXTURE_TOURNAMENTS.find((t) => t.tournamentId === tournamentId);
      if (item) {
        item.status = "UNDER_REVIEW";
        item.revision = `rev-${(parseInt(item.revision.replace("rev-", ""), 10) || 1) + 1}`;
      }
    const mockTournament: TournamentDto = {
      id: tournamentId,
      contractId: "HD-2026-CHUNG",
      contractCode: "CONTRACT-DEFAULT",
      unitId: "unit-dhqg",
      ownerTaUserId: "user-ta-01",
      status: "UNDER_REVIEW",
      revision: (input.expectedRevision ?? 1) + 1,
      activeConfigVersionId: null,
      activeConfigVersionNumber: 0,
      approvedSnapshot: null,
      everApproved: false,
      quotaRefunded: false,
      coreConfig: createDefaultCoreConfig({
        tournamentName: item?.name || "Giải đấu thử nghiệm",
        tournamentCode: item?.slug || "giai-dau-thu-nghiem",
        description: "Mô tả giải đấu",
        timezone: item?.timezone || "Asia/Ho_Chi_Minh",
        scheduledStartAt: item?.startAt || new Date().toISOString(),
        scheduledEndAt: item?.endAt || new Date(Date.now() + 86400000 * 7).toISOString(),
        competitionMode: "HUMAN_ONLINE",
        maxParticipants: item?.maxParticipants || 32,
        minParticipantsToStart: 4,
        organizersText: item?.ownerDisplay || "Ban Tổ chức Giải đấu",
        audienceScope: item?.visibility === "PUBLIC" ? "PUBLIC_REGISTERED" : "INTERNAL_UNIT",
      }),
      ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      approvedAt: null,
      rejectedAt: null,
      changesRequestedAt: null,
      lastReviewNote: null,
      lastReviewFieldNotes: {},
      startedAt: null,
      pausedAt: null,
      pauseReason: null,
      endedAt: null,
      cancelledAt: null,
      cancelReason: null,
      finalizedAt: null,
      copiedFromTournamentId: null,
    };
    return { tournament: mockTournament };
  }
}

  async getTournamentDetail(tournamentId: string): Promise<{ tournament: TournamentDto; configVersions: TournamentConfigVersionDto[] }> {
    return this.getDraft(tournamentId);
  }

  async getTournamentReadiness(tournamentId: string): Promise<{ readiness: TournamentReadinessSnapshot }> {
    try {
      const res = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}/readiness`, {
        headers: { Accept: "application/json", "X-OTT-Request": "1" },
        credentials: "include",
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => ({}));
      throw createHttpError(err, res.status, "Không thể kiểm tra điều kiện sẵn sàng", "GET_READINESS_FAILED");
    } catch (error: unknown) {
      if (isHttpError(error)) throw error;
      // Fixture / Offline fallback
      const found = FIXTURE_TOURNAMENTS.find((t) => t.tournamentId === tournamentId);
      const isApproved = found?.status === "APPROVED" || found?.status === "RUNNING";
      const isRunning = found?.status === "RUNNING";
      const count = found?.participantCount || 0;
      const minReq = 4;
      const blockers: string[] = [];
      if (!isApproved) blockers.push("TOURNAMENT_NOT_APPROVED");
      if (count < minReq) blockers.push("INSUFFICIENT_ELIGIBLE_PARTICIPANTS");

      const mockSnapshot: TournamentReadinessSnapshot = {
        tournamentId,
        status: found?.status && ["DRAFT", "CHANGES_REQUESTED", "UNDER_REVIEW", "APPROVED", "SCHEDULED", "RUNNING", "PAUSED", "ENDED", "CANCELLED", "FINALIZED", "ARCHIVED", "REJECTED"].includes(found.status)
          ? found.status as TournamentDto["status"]
          : "DRAFT",
        canOpenScheduled: isApproved && blockers.length === 0,
        canStartRunning: isApproved && count >= minReq,
        canFinalize: isRunning,
        eligibleParticipantsCount: count,
        minParticipantsRequired: minReq,
        activeStaffCount: 2,
        activeRefereeCount: 1,
        pendingManualAdjudicationsCount: 0,
        activeRuleVersionNumber: 1,
        checklist: [
          {
            code: "APPROVAL_STATUS",
            title: "Phê duyệt cấp hệ thống (Admin Approval)",
            status: isApproved ? "PASS" : "BLOCKED",
            detail: isApproved ? "Giải đấu đã được phê duyệt." : "Giải đấu chưa được phê duyệt.",
            blockerCode: isApproved ? undefined : "TOURNAMENT_NOT_APPROVED",
          },
          {
            code: "RULE_VERSION_PUBLISHED",
            title: "Phiên bản cấu hình & luật thi đấu",
            status: "PASS",
            detail: "Đã phát hành phiên bản cấu hình v1.",
          },
          {
            code: "MIN_ELIGIBLE_PARTICIPANTS",
            title: "Số lượng thí sinh đủ điều kiện tối thiểu",
            status: count >= minReq ? "PASS" : "BLOCKED",
            detail: `Có ${count}/${minReq} thí sinh đủ điều kiện.`,
            blockerCode: count >= minReq ? undefined : "INSUFFICIENT_ELIGIBLE_PARTICIPANTS",
          },
          {
            code: "NO_PENDING_ADJUDICATION",
            title: "Phán quyết thủ công tồn đọng",
            status: "PASS",
            detail: "Không có trận đấu nào đang chờ phán quyết thủ công.",
          },
        ],
        blockers,
        evaluatedAt: new Date().toISOString(),
      };
      return { readiness: mockSnapshot };
    }
  }

  async getLeaderboard(tournamentId: string): Promise<{ leaderboard: TournamentLeaderboardSnapshotDto }> {
    const res = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}/leaderboard`, {
      headers: { Accept: "application/json", "X-OTT-Request": "1" },
      credentials: "include",
    });
    if (res.ok) {
      return await res.json();
    }
    const err = await res.json().catch(() => ({}));
    throw createHttpError(err, res.status, "Không thể tải bảng xếp hạng giải đấu", "GET_LEADERBOARD_FAILED");
  }

  async getMatches(tournamentId: string): Promise<{ matches: TournamentScoreLedgerEntryDto[] }> {
    const res = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}/matches`, {
      headers: { Accept: "application/json", "X-OTT-Request": "1" },
      credentials: "include",
    });
    if (res.ok) {
      return await res.json();
    }
    const err = await res.json().catch(() => ({}));
    throw createHttpError(err, res.status, "Không thể tải nhật ký trận đấu", "GET_MATCHES_FAILED");
  }

  async openScheduled(tournamentId: string, expectedRevision?: number): Promise<{ tournament: TournamentDto }> {
    const res = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}/open-scheduled`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-OTT-Request": "1" },
      credentials: "include",
      body: JSON.stringify({ expectedRevision }),
    });
    if (res.ok) {
      return await res.json();
    }
    const err = await res.json().catch(() => ({}));
    throw createHttpError(err, res.status, "Không thể chuyển giải sang trạng thái mở lịch trình", "OPEN_SCHEDULED_FAILED");
  }

  async startTournament(tournamentId: string, expectedRevision?: number): Promise<{ tournament: TournamentDto }> {
    const res = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-OTT-Request": "1" },
      credentials: "include",
      body: JSON.stringify({ expectedRevision }),
    });
    if (res.ok) {
      return await res.json();
    }
    const err = await res.json().catch(() => ({}));
    throw createHttpError(err, res.status, "Không thể bắt đầu giải đấu", "START_TOURNAMENT_FAILED");
  }

  async pauseTournament(tournamentId: string, reason: string, expectedRevision?: number): Promise<{ tournament: TournamentDto }> {
    const res = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}/pause`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-OTT-Request": "1" },
      credentials: "include",
      body: JSON.stringify({ reason, expectedRevision }),
    });
    if (res.ok) {
      return await res.json();
    }
    const err = await res.json().catch(() => ({}));
    throw createHttpError(err, res.status, "Không thể tạm dừng giải đấu", "PAUSE_TOURNAMENT_FAILED");
  }

  async resumeTournament(tournamentId: string, expectedRevision?: number): Promise<{ tournament: TournamentDto }> {
    const res = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-OTT-Request": "1" },
      credentials: "include",
      body: JSON.stringify({ expectedRevision }),
    });
    if (res.ok) {
      return await res.json();
    }
    const err = await res.json().catch(() => ({}));
    throw createHttpError(err, res.status, "Không thể tiếp tục giải đấu", "RESUME_TOURNAMENT_FAILED");
  }

  async listAuditLogs(filter?: {
    targetType?: string;
    targetId?: string;
    actorUserId?: string;
  }): Promise<{ logs: AuditLogRecordDto[] }> {
    try {
      const params = new URLSearchParams();
      if (filter?.targetType) params.set("targetType", filter.targetType);
      if (filter?.targetId) params.set("targetId", filter.targetId);
      const qs = params.toString();
      const res = await fetch(`/api/admin/audit-logs${qs ? `?${qs}` : ""}`, {
        method: "GET",
        headers: { "Content-Type": "application/json", "X-OTT-Request": "1" },
        credentials: "include",
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback to fixture data on network failure
    }

    let records = [...FIXTURE_AUDIT_LOGS];
    if (filter?.targetType) {
      records = records.filter((r) => r.targetType === filter.targetType);
    }
    if (filter?.targetId) {
      records = records.filter((r) => r.targetId === filter.targetId);
    }
    if (filter?.actorUserId) {
      records = records.filter((r) => r.actorUserId === filter.actorUserId);
    }
    return { logs: records };
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

