import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { TournamentDetailPage } from "./TournamentDetailPage";
import type { TournamentApiPort } from "./tournamentApi";
import type { TournamentDto, TournamentReadinessSnapshot } from "@ottv2/contracts";

describe("S05 — TournamentDetailPage Component Tests", () => {
  let mockApiClient: TournamentApiPort;

  const mockTournament: TournamentDto = {
    id: "tour-001",
    contractId: "HD-2026-CHUNG",
    contractCode: "CONTRACT-DEFAULT",
    unitId: "unit-fit-vnu",
    ownerTaUserId: "ta-current",
    status: "APPROVED",
    revision: 2,
    activeConfigVersionId: "cfg-1",
    activeConfigVersionNumber: 1,
    approvedSnapshot: null,
    everApproved: true,
    quotaRefunded: false,
    coreConfig: {
      tournamentCode: "GIAI_DAU_ROBOT_2026",
      tournamentName: "Giải Vô địch Quốc gia Robot Lab 2026",
      shortDescription: "Mô tả chi tiết giải đấu",
      organizersText: "Khoa CNTT - ĐHQG",
      competitionMode: "HUMAN_ONLINE",
      audienceScope: "PUBLIC_REGISTERED",
      allowedUnitCodes: [],
      registrationIntakeMode: "IMPORT_ONLY",
      maxParticipants: 32,
      minParticipantsToStart: 4,
      timezone: "Asia/Ho_Chi_Minh",
      registrationOpenAt: null,
      registrationCloseAt: null,
      checkinRequired: false,
      checkinOpenAt: null,
      checkinCloseAt: null,
      scheduledStartAt: "2026-11-01T08:00:00.000Z",
      scheduledEndAt: "2026-11-02T18:00:00.000Z",
      format: "ARENA_CONTINUOUS",
      pairingMethod: "SWISS_SCORE_ADJACENT",
      maxMatchesPerPlayer: 20,
      maxPairMeetings: 2,
      rematchCooldownMinutes: 10,
      maxConcurrentMatches: 8,
      byeScorePoints: 0,
      spectatorPolicy: "PUBLIC_WATCH",
      chatPolicy: "ENABLED",
      leaderboardVisibility: "LIVE_PUBLIC",
      topNExportCount: 10,
      finalizationMode: "AUTO_FINAL",
      scoringFormulaPreset: "ELO_WEIGHTED_V1",
      initialScore: 1000,
      initialElo: 1000,
      kFactor: 32,
      scoreFloor: 0,
      botDeadlineAt: null,
    },
    ruleProfile: {} as any,
    submittedAt: "2026-10-21T08:00:00.000Z",
    approvedAt: "2026-10-21T09:00:00.000Z",
    rejectedAt: null,
    changesRequestedAt: null,
    lastReviewNote: null,
    startedAt: null,
    pausedAt: null,
    pauseReason: null,
    endedAt: null,
    cancelledAt: null,
    cancelReason: null,
    finalizedAt: null,
    copiedFromTournamentId: null,
    createdAt: "2026-10-21T08:00:00.000Z",
    updatedAt: "2026-10-21T09:00:00.000Z",
  };

  const mockReadiness: TournamentReadinessSnapshot = {
    tournamentId: "tour-001",
    status: "APPROVED",
    canOpenScheduled: true,
    canStartRunning: true,
    canFinalize: false,
    eligibleParticipantsCount: 16,
    minParticipantsRequired: 4,
    activeStaffCount: 2,
    activeRefereeCount: 1,
    pendingManualAdjudicationsCount: 0,
    activeRuleVersionNumber: 1,
    checklist: [
      {
        code: "APPROVAL_STATUS",
        title: "Phê duyệt cấp hệ thống (Admin Approval)",
        status: "PASS",
        detail: "Giải đấu đã được phê duyệt.",
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
        status: "PASS",
        detail: "Có 16/4 thí sinh đủ điều kiện.",
      },
      {
        code: "NO_PENDING_ADJUDICATION",
        title: "Phán quyết thủ công tồn đọng",
        status: "PASS",
        detail: "Không có trận đấu nào đang chờ phán quyết thủ công.",
      },
    ],
    blockers: [],
    evaluatedAt: "2026-10-22T08:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient = {
      listTournaments: vi.fn(),
      createDraft: vi.fn(),
      patchDraft: vi.fn(),
      getDraft: vi.fn(),
      deleteDraft: vi.fn(),
      getTournamentDetail: vi.fn().mockResolvedValue({ tournament: mockTournament, configVersions: [] }),
      getTournamentReadiness: vi.fn().mockResolvedValue({ readiness: mockReadiness }),
      openScheduled: vi.fn().mockResolvedValue({ tournament: { ...mockTournament, status: "SCHEDULED" } }),
      startTournament: vi.fn().mockResolvedValue({ tournament: { ...mockTournament, status: "RUNNING" } }),
      pauseTournament: vi.fn().mockResolvedValue({ tournament: { ...mockTournament, status: "PAUSED" } }),
      resumeTournament: vi.fn().mockResolvedValue({ tournament: { ...mockTournament, status: "RUNNING" } }),
    };
  });

  it("1. renders tournament detail header, name, and status badge", async () => {
    renderWithProviders(<TournamentDetailPage apiClient={mockApiClient} />);

    await waitFor(() => {
      expect(screen.getByTestId("tournament-detail-page")).toBeInTheDocument();
      expect(screen.getByTestId("tournament-detail-name")).toHaveTextContent("Giải Vô địch Quốc gia Robot Lab 2026");
      expect(screen.getByTestId("tournament-status-badge")).toHaveTextContent("APPROVED (r2)");
    });
  });

  it("2. switches across Overview, Config, and Readiness tabs", async () => {
    renderWithProviders(<TournamentDetailPage apiClient={mockApiClient} />);

    await waitFor(() => {
      expect(screen.getByTestId("panel-overview")).toBeInTheDocument();
    });

    // Switch to Config tab
    fireEvent.click(screen.getByTestId("tab-config-btn"));
    expect(screen.getByTestId("panel-config")).toBeInTheDocument();
    expect(screen.getByText("Kiểm soát vận hành (Operational Controls)")).toBeInTheDocument();

    // Switch to Readiness tab
    fireEvent.click(screen.getByTestId("tab-readiness-btn"));
    expect(screen.getByTestId("panel-readiness")).toBeInTheDocument();
    expect(screen.getByTestId("readiness-overall-status")).toHaveTextContent("ĐỦ ĐIỀU KIỆN SẴN SÀNG KHỞI CHẠY (READY)");
  });

  it("3. renders authoritative readiness checklist cards from server", async () => {
    renderWithProviders(<TournamentDetailPage apiClient={mockApiClient} />);

    await waitFor(() => {
      expect(screen.getByTestId("tab-readiness-btn")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("tab-readiness-btn"));

    expect(screen.getByTestId("readiness-check-APPROVAL_STATUS")).toBeInTheDocument();
    expect(screen.getByTestId("readiness-check-RULE_VERSION_PUBLISHED")).toBeInTheDocument();
    expect(screen.getByTestId("readiness-check-MIN_ELIGIBLE_PARTICIPANTS")).toBeInTheDocument();
    expect(screen.getByTestId("readiness-check-NO_PENDING_ADJUDICATION")).toBeInTheDocument();
  });

  it("4. calls startTournament when clicking start tournament button on ready state", async () => {
    renderWithProviders(<TournamentDetailPage apiClient={mockApiClient} />);

    await waitFor(() => {
      expect(screen.getByTestId("action-start-tournament-btn")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("action-start-tournament-btn"));

    await waitFor(() => {
      expect(mockApiClient.startTournament).toHaveBeenCalled();
    });
  });

  it("5. renders blocked readiness state without fake ready indicator when blockers exist", async () => {
    mockApiClient.getTournamentReadiness = vi.fn().mockResolvedValue({
      readiness: {
        ...mockReadiness,
        canStartRunning: false,
        canOpenScheduled: false,
        eligibleParticipantsCount: 1,
        checklist: [
          ...mockReadiness.checklist.slice(0, 2),
          {
            code: "MIN_ELIGIBLE_PARTICIPANTS",
            title: "Số lượng thí sinh đủ điều kiện tối thiểu",
            status: "BLOCKED",
            detail: "Mới có 1/4 thí sinh đủ điều kiện.",
            blockerCode: "INSUFFICIENT_ELIGIBLE_PARTICIPANTS",
          },
          mockReadiness.checklist[3],
        ],
        blockers: ["INSUFFICIENT_ELIGIBLE_PARTICIPANTS"],
      },
    });

    renderWithProviders(<TournamentDetailPage apiClient={mockApiClient} />);

    await waitFor(() => {
      expect(screen.getByTestId("tab-readiness-btn")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("tab-readiness-btn"));

    expect(screen.getByTestId("readiness-overall-status")).toHaveTextContent("CHƯA ĐỦ ĐIỀU KIỆN KHỞI CHẠY (BLOCKED)");
    expect(screen.getByTestId("readiness-blockers-list")).toBeInTheDocument();
    expect(screen.getByText("INSUFFICIENT_ELIGIBLE_PARTICIPANTS")).toBeInTheDocument();
  });
});
