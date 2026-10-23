import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../services/http/apiError";
import { InvitationAcceptancePage } from "../tournament-staff/InvitationAcceptancePage";
import { RulesAcknowledgementPage } from "../account/RulesAcknowledgementPage";
import SupportRecoveryPage from "../admin/support/SupportRecoveryPage";
import type { RulesAcknowledgementApi } from "../account/rulesAcknowledgementApi";
import type { RecoveryApi } from "../../services/support/recoveryApi";

const invitation = {
  id: "invite-1", tournamentId: "tournament-1", tournamentCode: "CUP-1", role: "REFEREE" as const,
  purpose: "TOURNAMENT_STAFF_INVITE" as const, status: "INVITED" as const,
  expiresAt: "2099-12-31T00:00:00.000Z", createdAt: "2026-10-23T00:00:00.000Z",
  acceptedAt: null, declinedAt: null,
};

type InvitationApi = NonNullable<Parameters<typeof InvitationAcceptancePage>[0]>["apiClient"];

function renderInvitation(api: InvitationApi) {
  return render(<MemoryRouter><InvitationAcceptancePage apiClient={api} tournamentId="tournament-1" token="opaque-token" /></MemoryRouter>);
}

describe("D09-C frontend security integration", () => {
  it("sends one staff decision during a double submit and renders the authoritative result", async () => {
    let resolve!: (value: unknown) => void;
    const acceptInvitation = vi.fn().mockReturnValue(new Promise((done) => { resolve = done; }));
    const api = {
      viewInvitation: vi.fn().mockResolvedValue(invitation),
      acceptInvitation,
      rejectInvitation: vi.fn(),
    } as unknown as InvitationApi;
    renderInvitation(api);
    const accept = await screen.findByRole("button", { name: "Chấp nhận" });
    fireEvent.click(accept);
    fireEvent.click(accept);
    expect(acceptInvitation).toHaveBeenCalledTimes(1);
    resolve({ invitation: { ...invitation, status: "ACTIVE" }, replayed: false });
    expect(await screen.findByTestId("invitation-status")).toHaveTextContent("ACTIVE");
  });

  it("does not render internal invitation diagnostics or raw token material", async () => {
    const api = {
      viewInvitation: vi.fn().mockRejectedValue(new ApiError("PrismaClientKnownRequestError token=opaque-token", 500)),
      acceptInvitation: vi.fn(), rejectInvitation: vi.fn(),
    } as unknown as InvitationApi;
    renderInvitation(api);
    expect(await screen.findByTestId("invitation-error")).toHaveTextContent("Không thể tải lời mời");
    expect(screen.queryByText(/PrismaClient|opaque-token/)).not.toBeInTheDocument();
    expect(screen.queryByText("opaque-token")).not.toBeInTheDocument();
  });

  it("acknowledges exactly once and never treats client state as authority", async () => {
    const status = {
      contractId: "contract-1", tournamentId: "tournament-1", configVersionId: "version-4", versionNumber: 4,
      effectiveAt: "2026-10-23T00:00:00.000Z", regulationsFull: "Điều lệ hiện hành", rulesQuickSummary: null,
      required: true, satisfied: false, evidence: null,
    };
    const acknowledge = vi.fn().mockResolvedValue({ ...status, satisfied: true, evidence: {
      id: "evidence-1", userId: "server-user", contractId: status.contractId, tournamentId: status.tournamentId,
      configVersionId: status.configVersionId, acknowledgedAt: "2026-10-23T00:00:01.000Z", evidenceKind: "AUTHENTICATED_EXPLICIT_ACK",
    } });
    const api: RulesAcknowledgementApi = { getStatus: vi.fn().mockResolvedValue(status), acknowledge };
    render(<MemoryRouter><RulesAcknowledgementPage {...{ contractId: status.contractId, tournamentId: status.tournamentId }} apiClient={api} /></MemoryRouter>);
    const button = await screen.findByRole("button", { name: "Xác nhận điều lệ phiên bản hiện hành" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(acknowledge).toHaveBeenCalledTimes(1);
    await screen.findByTestId("rules-ack-status");
    expect(acknowledge).toHaveBeenCalledWith(status.contractId, status.tournamentId, status.configVersionId);
  });

  it("hides internal recovery queue diagnostics behind safe UI copy", async () => {
    const api = {
      list: vi.fn().mockRejectedValue(new ApiError("Prisma stack password=secret", 500)),
      request: vi.fn(), reset: vi.fn(), detail: vi.fn(), transition: vi.fn(), issueResetToken: vi.fn(),
    } as unknown as RecoveryApi;
    render(<MemoryRouter><SupportRecoveryPage api={api} /></MemoryRouter>);
    expect(await screen.findByTestId("support-recovery-error")).toHaveTextContent("Không thể tải hàng đợi hỗ trợ");
    expect(screen.queryByText(/Prisma stack|password=secret/)).not.toBeInTheDocument();
  });
});
