import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { AuditLogsViewerPage } from "./AuditLogsViewerPage";
import type { TournamentApiPort } from "./tournamentApi";
import type { AuditLogRecordDto } from "@ottv2/contracts";

describe("S06 — AuditLogsViewerPage Component Tests", () => {
  let mockApiClient: TournamentApiPort;

  const mockLogs: AuditLogRecordDto[] = [
    {
      id: "audit-001",
      actorUserId: "user-ta-01",
      actorRole: "TOURNAMENT_ADMIN",
      action: "CREATE_DRAFT",
      targetType: "TOURNAMENT",
      targetId: "tour-001",
      beforeSnapshot: null,
      afterSnapshot: {
        tournamentName: "Giải Vô địch Quốc gia Robot Lab 2026",
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
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient = {
      listTournaments: vi.fn(),
      createDraft: vi.fn(),
      patchDraft: vi.fn(),
      getDraft: vi.fn(),
      deleteDraft: vi.fn(),
      getTournamentDetail: vi.fn(),
      getTournamentReadiness: vi.fn(),
      openScheduled: vi.fn(),
      startTournament: vi.fn(),
      pauseTournament: vi.fn(),
      resumeTournament: vi.fn(),
      listAuditLogs: vi.fn().mockResolvedValue({ logs: mockLogs }),
      submitDraft: vi.fn(),
    };
  });

  it("1. renders system-wide audit page header and audit table", async () => {
    renderWithProviders(<AuditLogsViewerPage apiClient={mockApiClient} />);

    await waitFor(() => {
      expect(screen.getByTestId("audit-page-title")).toHaveTextContent("Nhật ký kiểm toán hệ thống");
      expect(screen.getByText(/Tìm thấy/i)).toBeInTheDocument();
    });

    expect(screen.getByText("CREATE_DRAFT")).toBeInTheDocument();
    expect(screen.getByText("APPROVE")).toBeInTheDocument();
    expect(screen.getByText("PUBLISH_RULE_VERSION")).toBeInTheDocument();
  });

  it("2. renders tournament-scoped mode when tournamentId prop is provided", async () => {
    renderWithProviders(
      <AuditLogsViewerPage apiClient={mockApiClient} tournamentId="tour-001" />
    );

    await waitFor(() => {
      expect(screen.getByTestId("audit-page-title")).toHaveTextContent("Nhật ký kiểm toán giải đấu");
      expect(screen.getByText("Quay lại")).toBeInTheDocument();
    });

    expect(mockApiClient.listAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        targetId: "tour-001",
      })
    );
  });

  it("3. filters audit records by targetType and calls API", async () => {
    renderWithProviders(<AuditLogsViewerPage apiClient={mockApiClient} />);

    await waitFor(() => {
      expect(screen.getByTestId("audit-page-title")).toBeInTheDocument();
    });

    const select = screen.getByTestId("filter-target-type-select");
    fireEvent.change(select, { target: { value: "RULE_VERSION" } });

    await waitFor(() => {
      expect(mockApiClient.listAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: "RULE_VERSION",
        })
      );
    });
  });

  it("4. opens snapshot inspector modal when clicking 'Xem chi tiết'", async () => {
    renderWithProviders(<AuditLogsViewerPage apiClient={mockApiClient} />);

    await waitFor(() => {
      expect(screen.getByText("CREATE_DRAFT")).toBeInTheDocument();
    });

    const detailBtn = await screen.findByTestId("view-audit-detail-audit-001");
    fireEvent.click(detailBtn);

    await waitFor(() => {
      expect(screen.getByTestId("audit-snapshot-modal")).toBeInTheDocument();
      expect(screen.getByTestId("audit-modal-title")).toHaveTextContent("Chi tiết bản ghi kiểm toán");
    });

    // Close modal
    const closeBtn = screen.getByRole("button", { name: "Đóng" });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("audit-snapshot-modal")).not.toBeInTheDocument();
    });
  });

  it("5. renders empty state when no audit records match", async () => {
    vi.mocked(mockApiClient.listAuditLogs).mockResolvedValueOnce({ logs: [] });

    renderWithProviders(<AuditLogsViewerPage apiClient={mockApiClient} />);

    await waitFor(() => {
      expect(
        screen.getByText("Không tìm thấy bản ghi kiểm toán nào")
      ).toBeInTheDocument();
    });
  });
});
