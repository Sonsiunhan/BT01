import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { TournamentStaffPage } from "./TournamentStaffPage";
import { tournamentStaffApi } from "./tournamentStaffApi";

const invitation = { id: "i-1", tournamentId: "t-1", contractId: "c-1", recipientUserId: "user-1", recipientUsername: "user", recipientDisplayName: "User", role: "REFEREE" as const, purpose: "TOURNAMENT_STAFF_INVITE" as const, status: "INVITED" as const, expiresAt: "2026-12-31T00:00:00.000Z", inviterUserId: "owner", assignmentId: "a-1", createdAt: "2026-01-01T00:00:00.000Z", acceptedAt: null, declinedAt: null, revokedAt: null };
const baseList = { invitations: [invitation], assignments: [{ id: "a-1", tournamentId: "t-1", userId: "user-1", role: "REFEREE", status: "INVITED", assignedRooms: [] }] };

function makeApi(overrides: Partial<typeof tournamentStaffApi> = {}) {
  return {
    list: vi.fn().mockResolvedValue(baseList),
    readiness: vi.fn().mockResolvedValue({ tournamentId: "t-1", contractId: "c-1", activeRefereeCount: 0, hasAcceptedReferee: false }),
    createInvitation: vi.fn().mockResolvedValue({ invitation, rawToken: "secret-token", replayed: false }),
    revoke: vi.fn().mockResolvedValue({ tournamentId: "t-1", assignmentId: "a-1", invitationId: "i-1", userId: "user-1", role: "REFEREE", status: "REVOKED", revokedAt: "2026-01-01T00:00:00.000Z", replayed: false }),
    expire: vi.fn(), viewInvitation: vi.fn(), acceptInvitation: vi.fn(), rejectInvitation: vi.fn(),
    ...overrides,
  } as unknown as typeof tournamentStaffApi;
}

describe("P11 TournamentStaffPage", () => {
  it("renders assignments, invitations, roles and readiness", async () => {
    renderWithProviders(<TournamentStaffPage apiClient={makeApi()} tournamentId="t-1" />);
    expect(await screen.findByTestId("tournament-staff-page")).toBeInTheDocument();
    expect(screen.getAllByText("Trọng tài (REFEREE)")).toHaveLength(2);
    expect(screen.getByTestId("staff-readiness")).toHaveTextContent("Chưa có trọng tài");
  });

  it("shows loading and supports retry after a list error", async () => {
    let reject!: (error: Error) => void;
    const pending = new Promise<never>((_, nextReject) => { reject = nextReject; });
    const api = makeApi({ list: vi.fn().mockReturnValueOnce(pending).mockResolvedValue(baseList) });
    renderWithProviders(<TournamentStaffPage apiClient={api} tournamentId="t-1" />);
    expect(screen.getByTestId("tournament-staff-loading")).toBeInTheDocument();
    reject(new Error("network"));
    expect(await screen.findByTestId("tournament-staff-error")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByTestId("tournament-staff-page")).toBeInTheDocument();
  });

  it.each([["REFEREE"], ["STAFF"]] as const)("invites stable recipient identity as %s", async (selectedRole) => {
    const api = makeApi();
    renderWithProviders(<TournamentStaffPage apiClient={api} tournamentId="t-1" />);
    await screen.findByTestId("tournament-staff-page");
    await userEvent.type(screen.getByLabelText("Recipient User ID"), "recipient-42");
    await userEvent.selectOptions(screen.getByLabelText("Staff role"), selectedRole);
    await userEvent.click(screen.getByRole("button", { name: "Tạo lời mời" }));
    await waitFor(() => expect(api.createInvitation).toHaveBeenCalledWith("t-1", { recipientUserId: "recipient-42", role: selectedRole }));
    expect(screen.getByTestId("invitation-handoff")).toHaveTextContent("secret-token");
    expect(window.localStorage.getItem("secret-token")).toBeNull();
  });

  it("refreshes authoritative state after revoke", async () => {
    const api = makeApi({ list: vi.fn().mockResolvedValueOnce(baseList).mockResolvedValueOnce({ invitations: [], assignments: [] }) });
    renderWithProviders(<TournamentStaffPage apiClient={api} tournamentId="t-1" />);
    await screen.findByTestId("tournament-staff-page");
    await userEvent.click(screen.getByRole("button", { name: "Thu hồi" }));
    await waitFor(() => expect(api.revoke).toHaveBeenCalledWith("t-1", "a-1"));
    await waitFor(() => expect(screen.getByTestId("staff-empty")).toBeInTheDocument());
  });
});
