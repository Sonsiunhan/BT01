import type {
  TournamentListItem,
  TournamentListQuery,
  TournamentListResponse,
  TournamentLifecycleStatus,
} from "./tournamentTypes";

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

export interface TournamentApiPort {
  listTournaments(query?: TournamentListQuery): Promise<TournamentListResponse>;
}

export class TournamentApiClient implements TournamentApiPort {
  private useRealApi: boolean = false;

  constructor(options?: { useRealApi?: boolean }) {
    if (options?.useRealApi !== undefined) {
      this.useRealApi = options.useRealApi;
    }
  }

  async listTournaments(query: TournamentListQuery = {}): Promise<TournamentListResponse> {
    if (this.useRealApi) {
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
          headers: { Accept: "application/json" },
        });

        if (res.ok) {
          const data = (await res.json()) as TournamentListResponse;
          return data;
        }
      } catch {
        // Fall back to client-filtered dataset when API is not running
      }
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
      return status === "APPROVED" || status === "READY" || status === "ROSTER_OPEN";
    case "RUNNING":
      return status === "RUNNING" || status === "PAUSED";
    case "FINISHED":
      return status === "ENDED" || status === "FINALIZED" || status === "ARCHIVED" || status === "CANCELLED" || status === "REJECTED";
    default:
      return true;
  }
}

export const defaultTournamentApi = new TournamentApiClient();
