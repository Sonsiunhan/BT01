import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { HistoryReplay } from "@ottv2/contracts";
import { ReplayPanel } from "./ReplayPanel";
import { renderWithProviders } from "../../test/renderWithProviders";

const replay: HistoryReplay = {
  available: true,
  legacyFinalBoardOnly: false,
  moves: [
    { sequence: 1, stateVersion: 1, side: "BLUE", from: "a1", to: "a2", capturedPieceId: null, committedAt: "2026-10-04T00:00:00.000Z" },
    { sequence: 2, stateVersion: 2, side: "RED", from: "i9", to: "i8", capturedPieceId: null, committedAt: "2026-10-04T00:00:01.000Z" },
  ],
  timeline: [{ sequence: 1, type: "MATCH_STARTED", timestamp: "2026-10-04T00:00:00.000Z" }],
};

describe("R13 replay controls", () => {
  it("keeps replay read-only and supports Play/Pause/Step without rotating the board", () => {
    renderWithProviders(<ReplayPanel replay={replay} finalBoard={null} />);
    expect(screen.getByRole("region", { name: "Replay trận đấu" })).toBeInTheDocument();
    expect(document.querySelector(".robot-lab-replay-panel")).toBeInTheDocument();
    expect(screen.getByText("Nước 0/2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Từng nước" }));
    expect(screen.getByText("Nước 1/2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Phát" }));
    expect(screen.getByRole("button", { name: "Tạm dừng" })).toBeInTheDocument();
    expect(screen.getByText(/canonical Xanh ở dưới/i)).toBeInTheDocument();
  });

  it("shows the old final-board-only fallback instead of fabricating moves", () => {
    renderWithProviders(<ReplayPanel replay={{ available: false, moves: [], timeline: [], legacyFinalBoardOnly: true }} finalBoard={null} />);
    expect(screen.getByText(/bản lưu cũ chỉ có vị trí cuối/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Từng nước" })).not.toBeInTheDocument();
  });
});
