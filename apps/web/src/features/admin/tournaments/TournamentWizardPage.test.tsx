import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { TournamentWizardPage } from "./TournamentWizardPage";
import type { TournamentApiPort } from "./tournamentApi";
import { DEFAULT_TOURNAMENT_RULE_PROFILE } from "@ottv2/contracts";

describe("S03 — TournamentWizardPage Component Tests", () => {
  let mockApiClient: TournamentApiPort;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient = {
      listTournaments: vi.fn(),
      createDraft: vi.fn().mockResolvedValue({
        id: "tour-draft-new-123",
        contractId: "HD-2026-CHUNG",
        contractCode: "CONTRACT-DEFAULT",
        unitId: "unit-fit-vnu",
        ownerTaUserId: "ta-current",
        status: "DRAFT",
        revision: 1,
        activeConfigVersionId: null,
        activeConfigVersionNumber: 0,
        approvedSnapshot: null,
        everApproved: false,
        quotaRefunded: false,
        coreConfig: {
          tournamentName: "Giải Vô địch Thử nghiệm 2026",
          tournamentCode: "GIAI_VO_DICH_THU_NGHIEM_2026",
          description: "Mô tả",
          bannerUrl: null,
          timeModel: "FIXED_WINDOW",
          timezone: "Asia/Ho_Chi_Minh",
          rosterOpenAt: null,
          rosterCloseAt: null,
          scheduledStartAt: "2026-11-01T08:00:00.000Z",
          scheduledEndAt: "2026-11-01T18:00:00.000Z",
          dailyPlayWindows: null,
          maintenanceBlackouts: null,
          maxMatchesPerPlayerPerDay: null,
          maxMatchesPerPlayerTotal: null,
          competitionMode: "HUMAN_ONLINE",
          pairingStrategy: "ARENA",
          stageCount: 1,
          expectedParticipants: 16,
          minParticipants: 4,
          maxParticipants: 32,
          allowedUnitCodes: [],
          scoringFormulaPreset: "ELO_WEIGHTED_V1",
          initialScore: 1000,
          initialElo: 1000,
          kFactor: 32,
          scoreFloor: 0,
          tieBreakOrder: ["TOURNAMENT_SCORE", "TOURNAMENT_ELO"],
          checkinRequired: false,
          checkinWindowMinutes: 30,
          botDeadlineAt: null,
          autoDisqualifyUncheckedIn: false,
          organizersText: "Khoa CNTT",
          regulationsText: "Điều lệ",
          contactChannel: "contact@fit.vnu.edu.vn",
          privacyMode: "ORGANIZATION_INTERNAL",
          audienceScope: "PUBLIC_REGISTERED",
          allowSpectators: true,
          refereeAssignmentMode: "ANY_AVAILABLE",
          minActiveReferees: 1,
          manualAdjudicationDeadlineSeconds: 300,
          manualAdjudicationFallbackPolicy: "RANDOM_SEEDED",
        },
        ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
        createdAt: "2026-10-22T08:00:00.000Z",
        updatedAt: "2026-10-22T08:00:00.000Z",
        submittedAt: null,
        approvedAt: null,
        scheduledAt: null,
        openedAt: null,
        pausedAt: null,
        endedAt: null,
        finalizedAt: null,
        cancelledAt: null,
        archivedAt: null,
      }),
      getDraft: vi.fn(),
      patchDraft: vi.fn().mockResolvedValue({ id: "tour-draft-123", revision: 2 } as never),
      deleteDraft: vi.fn(),
      getTournamentDetail: vi.fn(),
      getTournamentReadiness: vi.fn(),
      openScheduled: vi.fn(),
      startTournament: vi.fn(),
      pauseTournament: vi.fn(),
      resumeTournament: vi.fn(),
      listAuditLogs: vi.fn(),
      submitDraft: vi.fn().mockResolvedValue({
        tournament: {
          id: "tour-draft-123",
          status: "UNDER_REVIEW",
          revision: 2,
        },
      }),
    };
  });

  it("1. renders step 1 with name, slug, contract and unit fields", () => {
    renderWithProviders(<TournamentWizardPage apiClient={mockApiClient} />);

    expect(screen.getByTestId("tournament-wizard-page")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-name-input")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-slug-input")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-contract-input")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-unit-input")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-save-draft-btn")).toBeInTheDocument();
  });

  it("2. auto-suggests uppercase slug when typing tournament name", () => {
    renderWithProviders(<TournamentWizardPage apiClient={mockApiClient} />);

    const nameInput = screen.getByTestId("wizard-name-input");
    fireEvent.change(nameInput, { target: { value: "Giải Đấu Kỳ Môn 2026" } });

    const slugInput = screen.getByTestId("wizard-slug-input") as HTMLInputElement;
    expect(slugInput.value).toBe("GIAI_DAU_KY_MON_2026");
  });

  it("3. navigates across steps 1, 2, 3, 4 via Next/Prev buttons", () => {
    renderWithProviders(<TournamentWizardPage apiClient={mockApiClient} />);

    // Initially at Step 1
    expect(screen.getByText("Bước 1: Hồ sơ cơ bản & Đơn vị tổ chức")).toBeInTheDocument();

    // Click Next -> Step 2
    fireEvent.click(screen.getByTestId("wizard-next-step-btn"));
    expect(screen.getByText("Bước 2: Lịch trình & Thời gian tổ chức")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-start-at-input")).toBeInTheDocument();

    // Click Next -> Step 3
    fireEvent.click(screen.getByTestId("wizard-next-step-btn"));
    expect(screen.getByText("Bước 3: Quy mô & Thể thức thi đấu")).toBeInTheDocument();

    // Click Next -> Step 4
    fireEvent.click(screen.getByTestId("wizard-next-step-btn"));
    expect(screen.getByText("Bước 4: Tổng quan cấu hình bản nháp")).toBeInTheDocument();

    // Click Prev -> Step 3
    fireEvent.click(screen.getByTestId("wizard-prev-step-btn"));
    expect(screen.getByText("Bước 3: Quy mô & Thể thức thi đấu")).toBeInTheDocument();
  });

  it("4. calls createDraft when clicking save draft button on new draft", async () => {
    renderWithProviders(<TournamentWizardPage apiClient={mockApiClient} />);

    fireEvent.change(screen.getByTestId("wizard-name-input"), {
      target: { value: "Giải Vô địch Thử nghiệm 2026" },
    });

    fireEvent.click(screen.getByTestId("wizard-save-draft-btn"));

    await waitFor(() => {
      expect(mockApiClient.createDraft).toHaveBeenCalledTimes(1);
    });
  });

  it("5. renders conflict alert banner when server returns 409 CONFLICT", async () => {
    const conflictError = Object.assign(new Error("Bản nháp đã cũ"), { code: "CONFLICT", statusCode: 409 });
    vi.mocked(mockApiClient.createDraft).mockRejectedValueOnce(conflictError);

    renderWithProviders(<TournamentWizardPage apiClient={mockApiClient} />);

    fireEvent.change(screen.getByTestId("wizard-name-input"), {
      target: { value: "Giải Thử Nghiệm Xung Đột" },
    });

    fireEvent.click(screen.getByTestId("wizard-save-draft-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("wizard-conflict-banner")).toBeInTheDocument();
      expect(
        screen.getByText(/Xung đột phiên bản bản nháp \(Optimistic Concurrency Control\)/i)
      ).toBeInTheDocument();
    });
  });

  it("6. opens submit confirmation modal and calls submitDraft on confirm", async () => {
    renderWithProviders(
      <TournamentWizardPage
        apiClient={mockApiClient}
        initialData={{
          tournamentId: "tour-draft-123",
          expectedRevision: 1,
        }}
        initialStep={4}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("wizard-submit-draft-btn")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("wizard-submit-draft-btn"));

    await waitFor(() => expect(screen.getByTestId("wizard-submit-modal")).toBeInTheDocument());
    expect(screen.getByTestId("wizard-submission-note-input")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("wizard-submission-note-input"), {
      target: { value: "Đã rà soát đủ 5 round và nộp duyệt." },
    });

    fireEvent.click(screen.getByTestId("wizard-confirm-submit-btn"));

    await waitFor(() => {
      expect(mockApiClient.submitDraft).toHaveBeenCalledWith(
        "tour-draft-123",
        expect.objectContaining({
          expectedRevision: 2,
          submissionNote: "Đã rà soát đủ 5 round và nộp duyệt.",
        })
      );
      expect(mockApiClient.patchDraft).toHaveBeenCalledWith(
        "tour-draft-123",
        expect.objectContaining({ expectedRevision: 1, coreConfig: expect.objectContaining({ registrationOpenAt: null, registrationCloseAt: null }) })
      );
      expect(screen.getByTestId("wizard-submit-success-banner")).toBeInTheDocument();
      expect(screen.getByTestId("wizard-locked-banner")).toBeInTheDocument();
    });
  });

  it("7. renders conflict banner when submitting draft with mismatched revision", async () => {
    const conflictError = Object.assign(new Error("Bản nháp đã bị thay đổi"), {
      code: "CONFLICT",
      statusCode: 409,
    });
    vi.mocked(mockApiClient.submitDraft).mockRejectedValueOnce(conflictError);

    renderWithProviders(
      <TournamentWizardPage
        apiClient={mockApiClient}
        initialData={{
          tournamentId: "tour-draft-123",
          expectedRevision: 1,
        }}
        initialStep={4}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("wizard-submit-draft-btn")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("wizard-submit-draft-btn"));
    await waitFor(() => expect(screen.getByTestId("wizard-submit-modal")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("wizard-confirm-submit-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("wizard-conflict-banner")).toBeInTheDocument();
    });
  });
});
