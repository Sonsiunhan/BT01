import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RefereePauseOverlay, RefereeControlPanel } from "./RefereePauseOverlay";
import { renderWithProviders } from "../../test/renderWithProviders";

describe("R8 Referee pause controls", () => {
  it("offers only the referee a stop action with three public reason groups", () => {
    const onStop = vi.fn();
    renderWithProviders(<RefereeControlPanel status="PLAYING" isReferee onStop={onStop} disabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Dừng trận" }));
    expect(screen.getByRole("radiogroup", { name: "Lý do dừng trận" })).toBeInTheDocument();
    expect(screen.getByLabelText("Sự cố kỹ thuật")).toBeInTheDocument();
    expect(screen.getByLabelText("Thắc mắc luật")).toBeInTheDocument();
    expect(screen.getByLabelText("Lý do khác")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Thắc mắc luật" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận dừng" }));
    expect(onStop).toHaveBeenCalledWith("RULE_QUESTION");
  });

  it("keeps the pause overlay non-dismissible and hides Resume from players", () => {
    renderWithProviders(<RefereePauseOverlay status="PAUSED" pauseReason="REFEREE" pauseElapsedMs={12_000} isReferee={false} onResume={vi.fn()} onHold={vi.fn()} />);
    expect(document.querySelector(".robot-lab-pause-overlay")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Trận đấu đã dừng" })).toBeInTheDocument();
    expect(screen.getByText("00:12")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tiếp tục" })).not.toBeInTheDocument();
    expect(screen.getByText(/Trọng tài đang xử lý/i)).toBeInTheDocument();
  });

  it("shows the three-second preparation and lets the referee keep the match paused", () => {
    const onHold = vi.fn();
    renderWithProviders(<RefereePauseOverlay status="RESUMING" pauseReason="REFEREE" pauseElapsedMs={1_000} resumeEndsAt={Date.now() + 2_500} isReferee onResume={vi.fn()} onHold={onHold} />);
    expect(screen.getByText(/Chuẩn bị tiếp tục/i)).toBeInTheDocument();
    const hold = screen.getByRole("button", { name: "Giữ dừng" });
    expect(hold).toBeEnabled();
    fireEvent.click(hold);
    expect(onHold).toHaveBeenCalledTimes(1);
  });

  it("does not let Resume clear an infrastructure blocker", () => {
    renderWithProviders(<RefereePauseOverlay status="PAUSED" pauseReason="INFRASTRUCTURE" pauseElapsedMs={3_000} isReferee onResume={vi.fn()} onHold={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Tiếp tục" })).not.toBeInTheDocument();
    expect(screen.getByText(/điều kiện liên quan/i)).toBeInTheDocument();
  });
});
