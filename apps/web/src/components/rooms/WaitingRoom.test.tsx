import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MatchSnapshot } from "@ottv2/contracts";
import { renderWithProviders } from "../../test/renderWithProviders";
import { WaitingRoom } from "./WaitingRoom";

const match = {
  matchId: "00000000-0000-4000-8000-000000000001",
  roomId: "ABC234",
  hostUserId: "blue-id",
  mode: "UNRANKED",
  status: "WAITING_READY",
  players: [
    { userId: "blue-id", username: "blue", displayName: "Xanh", side: "BLUE", ready: true, connected: true },
    { userId: "red-id", username: "red", displayName: "Đỏ", side: "RED", ready: true, connected: true },
  ],
  board: {}, pieceCounts: { BLUE: { R: 3, P: 3, S: 3 }, RED: { R: 3, P: 3, S: 3 } }, currentTurn: null,
  winner: null, resultReason: null, clocksMs: { BLUE: 300000, RED: 300000 }, timerSeconds: 300,
  countdownEndsAt: null, sequence: 0, stateVersion: 0, rating: null,
  refereeEnabled: true, refereeUserId: "ref-id", refereeConnected: true,
} as MatchSnapshot;

describe("R7 WaitingRoom role gates", () => {
  it("shows separate referee/spectator rows and enables Start only for the referee", () => {
    const onStart = vi.fn();
    renderWithProviders(<WaitingRoom match={match} viewerSide={null} isRefereeViewer spectatorEnabled spectatorCount={2} spectatorCapacity={10} disabled={false} copyStatus="idle" onCopy={vi.fn()} onLeave={vi.fn()} onReady={vi.fn()} onStart={onStart} leavePending={false} />);

    expect(screen.getByText("TRỌNG TÀI")).toBeInTheDocument();
    expect(document.querySelector(".waiting-visual-grid")).toBeInTheDocument();
    expect(screen.getByLabelText("Khán giả")).toHaveTextContent("2 / 10");
    const start = screen.getByRole("button", { name: "Bắt đầu trận" });
    expect(start).toBeEnabled();
    fireEvent.click(start);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Cả hai người chơi đã sẵn sàng/i)).toBeInTheDocument();
  });

  it("does not expose referee Start to a player and keeps the gate visible", () => {
    renderWithProviders(<WaitingRoom match={match} viewerSide="BLUE" spectatorEnabled={false} disabled={false} copyStatus="idle" onCopy={vi.fn()} onLeave={vi.fn()} onReady={vi.fn()} onStart={vi.fn()} leavePending={false} />);
    expect(screen.queryByRole("button", { name: "Bắt đầu trận" })).not.toBeInTheDocument();
    expect(document.querySelector(".waiting-hint")).toHaveTextContent("Chờ trọng tài bấm Bắt đầu");
  });
});
