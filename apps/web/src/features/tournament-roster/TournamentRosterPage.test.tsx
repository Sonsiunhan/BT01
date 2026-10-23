import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { TournamentRosterPage } from "./TournamentRosterPage";
import type { TournamentRosterApi } from "./tournamentRosterApi";

const mockEnrollments = [
  {
    id: "enr-1",
    tournamentId: "t-1",
    contractId: "c-1",
    personKey: "KHOA_CNTT:SV001",
    userId: null,
    displayName: "Nguyen Van A",
    unitCode: "KHOA_CNTT",
    email: "a@example.com",
    seedRating: 1200,
    eligibilityStatus: "ELIGIBLE",
    checkedInAt: null,
    botReadinessStatus: "NOT_REQUIRED",
    createdAt: "2026-10-23T08:00:00.000Z",
    updatedAt: "2026-10-23T08:00:00.000Z",
  },
];

const mockPreviewResponse = {
  totalRows: 2,
  validRows: 2,
  errorRows: 0,
  warningRows: 0,
  batchCapacity: 2000,
  fileName: "roster.csv",
  fileType: "CSV" as const,
  rows: [
    {
      rowNumber: 1,
      data: {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "SV001",
        full_name: "Nguyen Van A",
        username: "user_a",
        email: "a@example.com",
      },
      person_key: "KHOA_CNTT:SV001",
      valid: true,
      errors: [],
      warnings: [],
    },
    {
      rowNumber: 2,
      data: {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "SV002",
        full_name: "Tran Thi B",
        username: "user_b",
        email: "b@example.com",
      },
      person_key: "KHOA_CNTT:SV002",
      valid: true,
      errors: [],
      warnings: [],
    },
  ],
};

function createMockApi(overrides: Partial<TournamentRosterApi> = {}): TournamentRosterApi {
  return {
    listEnrollments: vi.fn().mockResolvedValue({ tournamentId: "t-1", enrollments: mockEnrollments }),
    preview: vi.fn().mockResolvedValue(mockPreviewResponse),
    commit: vi.fn().mockResolvedValue({
      success: true,
      tournamentId: "t-1",
      totalRows: 2,
      importedCount: 2,
      committedAt: "2026-10-23T08:30:00.000Z",
      outcomes: [
        {
          rowNumber: 1,
          person_key: "KHOA_CNTT:SV001",
          username: "user_a",
          displayName: "Nguyen Van A",
          unitCode: "KHOA_CNTT",
          status: "IMPORTED" as const,
          enrollmentId: "enr-1",
        },
      ],
    }),
    issueActivationToken: vi.fn().mockResolvedValue({
      enrollmentId: "enr-1",
      personKey: "KHOA_CNTT:SV001",
      claimToken: "ACT-TOKEN-123456",
      expiresAt: "2026-10-24T08:00:00.000Z",
      reissued: false,
    }),
    getActivationStatus: vi.fn().mockResolvedValue({
      enrollmentId: "enr-1",
      personKey: "KHOA_CNTT:SV001",
      status: "UNCLAIMED" as const,
    }),
    ...overrides,
  };
}

describe("P10 TournamentRosterPage", () => {
  it("renders page header and existing enrollments table", async () => {
    const api = createMockApi();
    renderWithProviders(<TournamentRosterPage apiClient={api} tournamentId="t-1" />);

    expect(await screen.findByTestId("tournament-roster-page")).toBeInTheDocument();
    expect(screen.getByText("KHOA_CNTT:SV001")).toBeInTheDocument();
    expect(screen.getByText("Nguyen Van A")).toBeInTheDocument();
    expect(screen.getByText("Chưa kích hoạt")).toBeInTheDocument();
  });

  it("shows empty state when no enrollments exist", async () => {
    const api = createMockApi({
      listEnrollments: vi.fn().mockResolvedValue({ tournamentId: "t-1", enrollments: [] }),
    });
    renderWithProviders(<TournamentRosterPage apiClient={api} tournamentId="t-1" />);

    expect(await screen.findByTestId("roster-empty")).toBeInTheDocument();
    expect(screen.getByText(/chưa có thí sinh nào/i)).toBeInTheDocument();
  });

  it("handles file selection, preview and commit workflow", async () => {
    const api = createMockApi();
    renderWithProviders(<TournamentRosterPage apiClient={api} tournamentId="t-1" />);

    await screen.findByTestId("tournament-roster-page");

    // Select file
    const file = new File(["unit_code,student_or_member_id,full_name,username,email\nKHOA_CNTT,SV001,Nguyen Van A,user_a,a@example.com"], "test.csv", { type: "text/csv" });
    const input = screen.getByTestId("roster-file-input");
    await userEvent.upload(input, file);

    // Click preview
    const previewBtn = screen.getByTestId("roster-preview-btn");
    await userEvent.click(previewBtn);

    // Check preview results
    await waitFor(() => {
      expect(api.preview).toHaveBeenCalled();
    });

    expect(await screen.findByTestId("roster-preview-result")).toBeInTheDocument();
    expect(screen.getByTestId("badge-valid")).toHaveTextContent("Hợp lệ: 2");

    // Click commit
    const commitBtn = screen.getByTestId("roster-commit-btn");
    await userEvent.click(commitBtn);

    await waitFor(() => {
      expect(api.commit).toHaveBeenCalled();
    });

    expect(await screen.findByTestId("roster-commit-outcome")).toHaveTextContent("Đã ghi nhận thành công 2 / 2 thí sinh.");
  });

  it("issues activation token and displays handoff banner", async () => {
    const api = createMockApi();
    renderWithProviders(<TournamentRosterPage apiClient={api} tournamentId="t-1" />);

    await screen.findByTestId("tournament-roster-page");

    const issueBtn = screen.getByTestId("issue-btn-enr-1");
    await userEvent.click(issueBtn);

    await waitFor(() => {
      expect(api.issueActivationToken).toHaveBeenCalledWith(
        expect.objectContaining({ enrollmentId: "enr-1" }),
      );
    });

    expect(await screen.findByTestId("token-handoff-banner")).toBeInTheDocument();
    expect(screen.getByTestId("claim-token-value")).toHaveTextContent("ACT-TOKEN-123456");
  });
});
