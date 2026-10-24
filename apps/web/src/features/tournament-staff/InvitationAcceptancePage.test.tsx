import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { InvitationAcceptancePage } from "./InvitationAcceptancePage";
import { tournamentStaffApi } from "./tournamentStaffApi";

const baseInvitation = { id: "i-1", tournamentId: "t-1", tournamentCode: "CUP-1", role: "REFEREE" as const, purpose: "TOURNAMENT_STAFF_INVITE" as const, status: "INVITED" as const, expiresAt: "2099-12-31T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z", acceptedAt: null, declinedAt: null };
function makeApi(overrides: Partial<typeof tournamentStaffApi> = {}) {
  return { viewInvitation: vi.fn().mockResolvedValue(baseInvitation), acceptInvitation: vi.fn().mockResolvedValue({ invitation: { ...baseInvitation, status: "ACTIVE" }, replayed: false }), rejectInvitation: vi.fn().mockResolvedValue({ invitation: { ...baseInvitation, status: "DECLINED" }, replayed: false }), list: vi.fn(), readiness: vi.fn(), createInvitation: vi.fn(), revoke: vi.fn(), expire: vi.fn(), ...overrides } as unknown as typeof tournamentStaffApi;
}

describe("P17 InvitationAcceptancePage", () => {
  it("renders a valid invitation and accepts it", async () => {
    const api = makeApi();
    renderWithProviders(<InvitationAcceptancePage apiClient={api} tournamentId="t-1" token="raw-token" />);
    expect(await screen.findByTestId("invitation-page")).toBeInTheDocument();
    expect(screen.getByText("CUP-1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Chấp nhận" }));
    await waitFor(() => expect(api.acceptInvitation).toHaveBeenCalledWith("t-1", "raw-token"));
    expect(await screen.findByTestId("invitation-status")).toHaveTextContent("ACTIVE");
  });

  it("rejects a valid invitation", async () => {
    const api = makeApi();
    renderWithProviders(<InvitationAcceptancePage apiClient={api} tournamentId="t-1" token="raw-token" />);
    await screen.findByTestId("invitation-page");
    await userEvent.click(screen.getByRole("button", { name: "Từ chối" }));
    await waitFor(() => expect(api.rejectInvitation).toHaveBeenCalledWith("t-1", "raw-token"));
    expect(await screen.findByTestId("invitation-status")).toHaveTextContent("DECLINED");
  });

  it.each(["EXPIRED", "REVOKED", "DECLINED", "ACTIVE"] as const)("shows finalized state %s without action buttons", async (status) => {
    const api = makeApi({ viewInvitation: vi.fn().mockResolvedValue({ ...baseInvitation, status }) });
    renderWithProviders(<InvitationAcceptancePage apiClient={api} tournamentId="t-1" token="raw-token" />);
    expect(await screen.findByTestId("invitation-status")).toHaveTextContent(status);
    expect(screen.queryByRole("button", { name: "Chấp nhận" })).not.toBeInTheDocument();
  });

  it("shows invalid/network errors and retries", async () => {
    const api = makeApi({ viewInvitation: vi.fn().mockRejectedValueOnce(new Error("Token không hợp lệ")).mockResolvedValueOnce(baseInvitation) });
    renderWithProviders(<InvitationAcceptancePage apiClient={api} tournamentId="t-1" token="bad-token" />);
    expect(await screen.findByTestId("invitation-error")).toHaveTextContent("Không thể tải lời mời.");
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByTestId("invitation-page")).toBeInTheDocument();
  });

  it("shows server action errors with a retry path", async () => {
    const api = makeApi({ acceptInvitation: vi.fn().mockRejectedValue(new Error("Không thể cập nhật lời mời.")) });
    renderWithProviders(<InvitationAcceptancePage apiClient={api} tournamentId="t-1" token="raw-token" />);
    await screen.findByTestId("invitation-page");
    await userEvent.click(screen.getByRole("button", { name: "Chấp nhận" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể cập nhật lời mời");
  });
});
