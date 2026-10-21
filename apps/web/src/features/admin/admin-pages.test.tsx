import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_TOURNAMENT_RULE_PROFILE } from "@ottv2/contracts";
import { ApiError } from "../../services/http/apiError";
import { ApprovalsAdminPage } from "./approvals/ApprovalsAdminPage";
import { ContractsAdminPage } from "./contracts/ContractsAdminPage";
import {
  LONG_ADMIN_ROUTE_META,
  LONG_ADMIN_ROUTE_PATHS,
} from "./long-route-meta";
import { LongAdminRoutes } from "./long-routes";
import type { TournamentAdminApiPort } from "./services/tournamentAdminApi";
import { UnitsAdminPage } from "./units/UnitsAdminPage";

function createMockAdminApi(
  overrides: Partial<TournamentAdminApiPort> = {}
): TournamentAdminApiPort {
  return {
    listUnits: vi.fn().mockResolvedValue({
      units: [
        {
          id: "unit-1",
          unitCode: "KHOA_CNTT",
          unitName: "Khoa Công nghệ Thông tin",
          unitType: "KHOA",
          contactName: "Nguyễn Văn A",
          contactEmail: "cntt@example.edu.vn",
          status: "ACTIVE",
          referencedContractsCount: 1,
          referencedTournamentsCount: 0,
          createdAt: "2026-10-21T08:00:00.000Z",
          updatedAt: "2026-10-21T08:00:00.000Z",
        },
      ],
    }),
    createUnit: vi.fn().mockImplementation(async (input) => ({
      unit: {
        id: "unit-2",
        ...input,
        referencedContractsCount: 0,
        referencedTournamentsCount: 0,
        createdAt: "2026-10-21T08:05:00.000Z",
        updatedAt: "2026-10-21T08:05:00.000Z",
      },
    })),
    updateUnit: vi.fn().mockImplementation(async (id, patch) => ({
      unit: {
        id,
        unitCode: "KHOA_CNTT",
        unitName: "Khoa Công nghệ Thông tin",
        unitType: "KHOA",
        contactName: "Nguyễn Văn A",
        contactEmail: "cntt@example.edu.vn",
        status: patch.status ?? "INACTIVE",
        referencedContractsCount: 1,
        referencedTournamentsCount: 0,
        createdAt: "2026-10-21T08:00:00.000Z",
        updatedAt: "2026-10-21T08:10:00.000Z",
      },
    })),
    deleteUnit: vi.fn().mockRejectedValue(
      new ApiError(
        "Không thể xóa đơn vị đang được tham chiếu bởi Hợp đồng hoặc Giải đấu.",
        409,
        "CONFLICT"
      )
    ),
    listContracts: vi.fn().mockResolvedValue({
      contracts: [
        {
          id: "contract-1",
          contractCode: "HD_CNTT_2026",
          unitId: "unit-1",
          unitCode: "KHOA_CNTT",
          unitName: "Khoa Công nghệ Thông tin",
          status: "ACTIVE",
          validFrom: "2026-10-01T00:00:00.000Z",
          validTo: "2027-06-30T23:59:59.000Z",
          maxTournamentsTotal: 3,
          quotaReservedCount: 1,
          quotaConsumedCount: 1,
          quotaRemainingCount: 2,
          maxParticipantsPerTournament: 128,
          maxParticipantsTotal: 300,
          currentParticipantsTotal: 24,
          allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
          policyEnvelope: {
            allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT", "HYBRID"],
            turnSecondsMin: 10,
            turnSecondsMax: 60,
            totalMatchSecondsMin: 120,
            totalMatchSecondsMax: 1800,
            turnLimitMin: 40,
            turnLimitMax: 240,
            allowedNoProgressPlies: [40, 60, 80],
            allowedRepetitionThresholds: [3, 4],
            allowedTieBreakPolicies: ["RANDOM_SEEDED", "MANUAL_REFEREE"],
          },
          technicalCaps: {
            botSourceMaxBytes: 65536,
            botRuntimeTimeoutMs: 1000,
            botMemoryLimitMb: 64,
            maxConcurrentMatchesPerTournament: 16,
            rosterImportMaxRows: 2000,
          },
          taBindings: [
            {
              id: "bind-1",
              contractId: "contract-1",
              userId: "ta-cntt-01",
              status: "ACTIVE",
              grantedByUserId: "admin-1",
              grantedAt: "2026-10-21T08:00:00.000Z",
              revokedAt: null,
              revokeReason: null,
            },
          ],
          createdAt: "2026-10-21T08:00:00.000Z",
          updatedAt: "2026-10-21T08:00:00.000Z",
        },
      ],
    }),
    createContract: vi.fn(),
    updateContract: vi.fn(),
    grantContractTa: vi.fn().mockResolvedValue({
      contract: {
        id: "contract-1",
        contractCode: "HD_CNTT_2026",
        unitId: "unit-1",
        unitCode: "KHOA_CNTT",
        status: "ACTIVE",
        validFrom: "2026-10-01T00:00:00.000Z",
        validTo: "2027-06-30T23:59:59.000Z",
        maxTournamentsTotal: 3,
        quotaReservedCount: 1,
        quotaConsumedCount: 1,
        quotaRemainingCount: 2,
        maxParticipantsPerTournament: 128,
        maxParticipantsTotal: 300,
        currentParticipantsTotal: 24,
        allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
        policyEnvelope: {
          allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT", "HYBRID"],
          turnSecondsMin: 10,
          turnSecondsMax: 60,
          totalMatchSecondsMin: 120,
          totalMatchSecondsMax: 1800,
          turnLimitMin: 40,
          turnLimitMax: 240,
          allowedNoProgressPlies: [40, 60, 80],
          allowedRepetitionThresholds: [3, 4],
          allowedTieBreakPolicies: ["RANDOM_SEEDED", "MANUAL_REFEREE"],
        },
        technicalCaps: {
          botSourceMaxBytes: 65536,
          botRuntimeTimeoutMs: 1000,
          botMemoryLimitMb: 64,
          maxConcurrentMatchesPerTournament: 16,
          rosterImportMaxRows: 2000,
        },
        taBindings: [
          {
            id: "bind-1",
            contractId: "contract-1",
            userId: "ta-cntt-01",
            status: "ACTIVE",
            grantedByUserId: "admin-1",
            grantedAt: "2026-10-21T08:00:00.000Z",
            revokedAt: null,
            revokeReason: null,
          },
          {
            id: "bind-2",
            contractId: "contract-1",
            userId: "ta-cntt-02",
            status: "ACTIVE",
            grantedByUserId: "admin-1",
            grantedAt: "2026-10-21T08:15:00.000Z",
            revokedAt: null,
            revokeReason: null,
          },
        ],
        createdAt: "2026-10-21T08:00:00.000Z",
        updatedAt: "2026-10-21T08:15:00.000Z",
      },
    }),
    revokeContractTa: vi.fn(),
    listApprovals: vi.fn().mockResolvedValue({
      initialSubmissions: [
        {
          id: "tour-1",
          contractId: "contract-1",
          contractCode: "HD_CNTT_2026",
          unitId: "unit-1",
          ownerTaUserId: "ta-cntt-01",
          status: "UNDER_REVIEW",
          revision: 2,
          coreConfig: {
            tournamentCode: "OTT_CNTT_2026",
            tournamentName: "Giải Vô địch CNTT 2026",
            shortDescription: "Giải mùa thu",
            organizersText: "Khoa CNTT",
            competitionMode: "HUMAN_ONLINE",
            audienceScope: "PUBLIC_REGISTERED",
            allowedUnitCodes: [],
            registrationIntakeMode: "IMPORT_ONLY",
            maxParticipants: 64,
            minParticipantsToStart: 8,
            timezone: "Asia/Ho_Chi_Minh",
            registrationOpenAt: null,
            registrationCloseAt: null,
            checkinRequired: false,
            checkinOpenAt: null,
            checkinCloseAt: null,
            scheduledStartAt: "2026-11-15T08:00:00.000Z",
            scheduledEndAt: "2026-11-15T17:00:00.000Z",
            format: "ARENA_CONTINUOUS",
            pairingMethod: "SWISS_SCORE_ADJACENT",
            maxMatchesPerPlayer: null,
            maxPairMeetings: 2,
            rematchCooldownMinutes: 5,
            maxConcurrentMatches: 8,
            byeScorePoints: 0,
            spectatorPolicy: "PUBLIC_WATCH",
            chatPolicy: "SPECTATOR_MUTED",
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
          ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
          activeConfigVersionId: null,
          activeConfigVersionNumber: 0,
          approvedSnapshot: null,
          everApproved: false,
          quotaRefunded: false,
          submittedAt: "2026-10-21T08:00:00.000Z",
          approvedAt: null,
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
          createdAt: "2026-10-21T07:50:00.000Z",
          updatedAt: "2026-10-21T08:00:00.000Z",
        },
      ],
      changeRequests: [
        {
          id: "cr-1",
          tournamentId: "tour-2",
          tournamentCode: "OTT_ACTIVE_01",
          tournamentName: "Giải Đang Chạy 01",
          contractId: "contract-1",
          requestedByTaUserId: "ta-cntt-01",
          status: "PENDING",
          reason: "Tăng số trận đồng thời lên 12",
          effectiveAt: "2026-11-01T00:00:00.000Z",
          diffs: [
            {
              fieldPath: "coreConfig.maxConcurrentMatches",
              label: "maxConcurrentMatches",
              beforeValue: 8,
              afterValue: 12,
              requiresAdminApproval: true,
            },
          ],
          reviewedByAdminUserId: null,
          reviewNote: null,
          reviewedAt: null,
          appliedConfigVersionId: null,
          createdAt: "2026-10-21T08:00:00.000Z",
          updatedAt: "2026-10-21T08:00:00.000Z",
        },
      ],
    }),
    decideInitialApproval: vi.fn().mockImplementation(async (_id, input) => ({
      tournament: {
        id: "tour-1",
        contractId: "contract-1",
        contractCode: "HD_CNTT_2026",
        unitId: "unit-1",
        ownerTaUserId: "ta-cntt-01",
        status:
          input.decision === "APPROVE"
            ? "APPROVED"
            : input.decision === "REJECT"
            ? "REJECTED"
            : "CHANGES_REQUESTED",
        revision: 3,
        coreConfig: {
          tournamentCode: "OTT_CNTT_2026",
          tournamentName: "Giải Vô địch CNTT 2026",
          shortDescription: "Giải mùa thu",
          organizersText: "Khoa CNTT",
          competitionMode: "HUMAN_ONLINE",
          audienceScope: "PUBLIC_REGISTERED",
          allowedUnitCodes: [],
          registrationIntakeMode: "IMPORT_ONLY",
          maxParticipants: 64,
          minParticipantsToStart: 8,
          timezone: "Asia/Ho_Chi_Minh",
          registrationOpenAt: null,
          registrationCloseAt: null,
          checkinRequired: false,
          checkinOpenAt: null,
          checkinCloseAt: null,
          scheduledStartAt: "2026-11-15T08:00:00.000Z",
          scheduledEndAt: "2026-11-15T17:00:00.000Z",
          format: "ARENA_CONTINUOUS",
          pairingMethod: "SWISS_SCORE_ADJACENT",
          maxMatchesPerPlayer: null,
          maxPairMeetings: 2,
          rematchCooldownMinutes: 5,
          maxConcurrentMatches: 8,
          byeScorePoints: 0,
          spectatorPolicy: "PUBLIC_WATCH",
          chatPolicy: "SPECTATOR_MUTED",
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
        ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
        activeConfigVersionId: "v-1",
        activeConfigVersionNumber: 1,
        approvedSnapshot: null,
        everApproved: input.decision === "APPROVE",
        quotaRefunded: input.decision === "REJECT",
        submittedAt: "2026-10-21T08:00:00.000Z",
        approvedAt: "2026-10-21T08:30:00.000Z",
        rejectedAt: null,
        changesRequestedAt: null,
        lastReviewNote: input.note ?? null,
        startedAt: null,
        pausedAt: null,
        pauseReason: null,
        endedAt: null,
        cancelledAt: null,
        cancelReason: null,
        finalizedAt: null,
        copiedFromTournamentId: null,
        createdAt: "2026-10-21T07:50:00.000Z",
        updatedAt: "2026-10-21T08:30:00.000Z",
      },
    })),
    decideChangeRequest: vi.fn().mockResolvedValue({
      changeRequest: {
        id: "cr-1",
        tournamentId: "tour-2",
        tournamentCode: "OTT_ACTIVE_01",
        tournamentName: "Giải Đang Chạy 01",
        contractId: "contract-1",
        requestedByTaUserId: "ta-cntt-01",
        status: "APPROVED",
        reason: "Tăng số trận đồng thời lên 12",
        effectiveAt: "2026-11-01T00:00:00.000Z",
        diffs: [],
        reviewedByAdminUserId: "admin-1",
        reviewNote: "Đã duyệt",
        reviewedAt: "2026-10-21T08:40:00.000Z",
        appliedConfigVersionId: "v-2",
        createdAt: "2026-10-21T08:00:00.000Z",
        updatedAt: "2026-10-21T08:40:00.000Z",
      },
    }),
    ...overrides,
  };
}

describe("L03 & L04 — Admin Pages P06, P07, P08 & Click-Path Audit", () => {
  it("exports canonical route metadata for P06, P07, and P08 in long-routes.tsx", () => {
    expect(LONG_ADMIN_ROUTE_PATHS).toEqual({
      units: "/admin/units",
      contracts: "/admin/contracts",
      approvals: "/admin/approvals",
    });
    expect(LONG_ADMIN_ROUTE_META.map((r) => r.pageCode)).toEqual(["P06", "P07", "P08"]);
    expect(typeof LongAdminRoutes).toBe("function");
  });

  it("P06 UnitsAdminPage: renders units, creates a new unit, and displays 409 conflict when deleting a referenced unit (T002)", async () => {
    const api = createMockAdminApi();
    render(<UnitsAdminPage api={api} />);

    await waitFor(() => {
      expect(screen.getByTestId("unit-row-KHOA_CNTT")).toBeInTheDocument();
    });

    // Attempt to delete referenced unit -> displays 409 error banner
    fireEvent.click(screen.getByRole("button", { name: "Xóa" }));
    await waitFor(() => {
      expect(screen.getByTestId("unit-error-banner")).toHaveTextContent(
        /Không thể xóa đơn vị đang được tham chiếu/
      );
    });

    // Create a new unit
    fireEvent.change(screen.getByLabelText(/Mã đơn vị \(F01\)/), {
      target: { value: "CLB_ROBOT" },
    });
    fireEvent.change(screen.getByLabelText(/Tên đơn vị \(F02\)/), {
      target: { value: "CLB Robot Lab" },
    });
    fireEvent.change(screen.getByLabelText(/Người liên hệ \(F04\)/), {
      target: { value: "Trần Thị B" },
    });
    fireEvent.change(screen.getByLabelText(/Email liên hệ \(F05\)/), {
      target: { value: "robot@example.edu.vn" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tạo đơn vị" }));

    await waitFor(() => {
      expect(screen.getByTestId("unit-success-banner")).toHaveTextContent(
        /Đã tạo đơn vị "CLB_ROBOT" thành công/
      );
      expect(screen.getByTestId("unit-row-CLB_ROBOT")).toBeInTheDocument();
    });
  });

  it("P06 UnitsAdminPage: renders 403 forbidden state when non-Admin accesses page", async () => {
    const api = createMockAdminApi({
      listUnits: vi
        .fn()
        .mockRejectedValue(
          new ApiError(
            "Chỉ Quản trị hệ thống (Admin) mới được phép thực hiện thao tác này.",
            403,
            "UNAUTHORIZED"
          )
        ),
    });
    render(<UnitsAdminPage api={api} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Truy cập bị từ chối \(403\)/);
    });
  });

  it("P07 ContractsAdminPage: renders quota & envelope summary, grants TA, and enforces mandatory revoke reason", async () => {
    const api = createMockAdminApi();
    render(<ContractsAdminPage api={api} />);

    await waitFor(() => {
      expect(screen.getByTestId("contract-card-HD_CNTT_2026")).toBeInTheDocument();
    });

    expect(screen.getByTestId("quota-summary-HD_CNTT_2026")).toHaveTextContent(
      /Đã giữ 1\/3/
    );

    // Attempt to revoke TA without reason -> shows client validation banner
    fireEvent.click(screen.getByRole("button", { name: "Thu hồi TA" }));
    expect(screen.getByTestId("contract-error-banner")).toHaveTextContent(
      /Vui lòng nhập lý do thu hồi quyền TA/
    );

    // Grant new TA
    fireEvent.change(
      screen.getByLabelText(/Gán thêm Quản trị giải \(TA\) vào hợp đồng/),
      { target: { value: "ta-cntt-02" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Gán quyền TA" }));

    await waitFor(() => {
      expect(screen.getByTestId("contract-success-banner")).toHaveTextContent(
        /Đã gán quyền TA cho "ta-cntt-02"/
      );
      expect(screen.getByTestId("ta-binding-ta-cntt-02")).toBeInTheDocument();
    });
  });

  it("P08 ApprovalsAdminPage: enforces mandatory note on REJECT/REQUEST_CHANGES (T022), approves initial submission with expectedRevision, and switches to ChangeRequest tab (T024)", async () => {
    const api = createMockAdminApi();
    render(<ApprovalsAdminPage api={api} />);

    await waitFor(() => {
      expect(
        screen.getByTestId("submission-card-OTT_CNTT_2026")
      ).toBeInTheDocument();
    });

    // Clicking REJECT without note is blocked with T022 validation alert
    fireEvent.click(
      screen.getByRole("button", {
        name: /Từ chối & Hoàn hạn mức \(REJECTED\)/,
      })
    );
    expect(screen.getByTestId("approval-error-banner")).toHaveTextContent(
      /Bắt buộc nhập lý do \(ít nhất 3 ký tự\)/
    );
    expect(api.decideInitialApproval).not.toHaveBeenCalled();

    // Approve initial submission -> sends expectedRevision: 2
    fireEvent.click(
      screen.getByRole("button", { name: /Phê duyệt \(APPROVED\)/ })
    );
    await waitFor(() => {
      expect(api.decideInitialApproval).toHaveBeenCalledWith("tour-1", {
        decision: "APPROVE",
        expectedRevision: 2,
        note: undefined,
      });
      expect(screen.getByTestId("approval-success-banner")).toHaveTextContent(
        /trạng thái APPROVED/
      );
    });

    // Switch to ChangeRequest tab and approve cr-1
    fireEvent.click(
      screen.getByRole("tab", { name: /Yêu cầu thay đổi sau duyệt/ })
    );
    await waitFor(() => {
      expect(screen.getByTestId("cr-card-OTT_ACTIVE_01")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Duyệt ChangeRequest" }));
    await waitFor(() => {
      expect(api.decideChangeRequest).toHaveBeenCalledWith("cr-1", {
        decision: "APPROVE",
        note: undefined,
      });
    });
  });
});
