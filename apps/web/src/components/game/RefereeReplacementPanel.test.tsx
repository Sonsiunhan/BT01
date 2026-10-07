import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MatchSnapshot } from "@ottv2/contracts";
import { renderWithProviders } from "../../test/renderWithProviders";
import { RefereeReplacementPanel } from "./RefereeReplacementPanel";

const match = { status: "PAUSED", refereeEnabled: true, refereeConnected: false, players: [{ userId: "blue", username: "blue", displayName: "Xanh", side: "BLUE" }, { userId: "red", username: "red", displayName: "Đỏ", side: "RED" }], replacementStatus: "IDLE", replacementCandidateUserId: null, replacementApprovedByUserIds: [] } as unknown as MatchSnapshot;

describe("R8 Referee replacement consent", () => {
  it("lets a player nominate an account while paused", () => {
    const onNominate = vi.fn();
    renderWithProviders(<RefereeReplacementPanel match={match} viewerSide="BLUE" isCandidate={false} disabled={false} onNominate={onNominate} onApprove={vi.fn()} onAccept={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Tài khoản đăng nhập"), { target: { value: "new-ref" } });
    fireEvent.click(screen.getByRole("button", { name: "Đề cử" }));
    expect(onNominate).toHaveBeenCalledWith("new-ref");
  });

  it("lets the nominated account accept only after both player approvals", () => {
    const onAccept = vi.fn();
    const nominated = { ...match, replacementStatus: "APPROVED", replacementCandidateUserId: "new-ref", replacementApprovedByUserIds: ["blue", "red"] } as unknown as MatchSnapshot;
    renderWithProviders(<RefereeReplacementPanel match={nominated} viewerSide={null} isCandidate disabled={false} onNominate={vi.fn()} onApprove={vi.fn()} onAccept={onAccept} />);
    fireEvent.click(screen.getByRole("button", { name: "Nhận vai trò Trọng tài" }));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });
});
