import { createInitialState, type Coordinate, type RuleState } from "@ottv2/game-rules";
import { setLocalSession, getLocalHistory } from "../services/local/localGameStorage";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import LocalGamePage from "./LocalGamePage";

describe("R11 local manual and AI compatibility", () => {
  beforeEach(() => localStorage.clear());

  it("starts Offline 2P on the canonical board with local-only state", async () => {
    renderWithProviders(<LocalGamePage mode="OFFLINE" />, "/offline");

    expect(await screen.findByRole("heading", { name: "Hai người một máy" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu ván" }));

    expect(screen.getByText("Không có kết nối lại · trạng thái local là nguồn sự thật của ván này.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Bàn cờ, góc nhìn phe Xanh" })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /Ô a1, Quân Kéo phe Xanh/ })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /Ô i9, Quân Kéo phe Đỏ/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("gridcell", { name: /Ô a1, Quân Kéo phe Xanh/ }));
    fireEvent.click(screen.getByRole("gridcell", { name: /Ô a2, trống/ }));
    expect(screen.getByText("Lượt phe Đỏ")).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /Ô a2, Quân Kéo phe Xanh/ })).toBeInTheDocument();
  }, 15000);

  it("keeps AI view canonical and presents the local bot without a server mode", async () => {
    renderWithProviders(<LocalGamePage mode="AI" />, "/ai");

    expect(await screen.findByRole("heading", { name: "Đấu với máy" })).toBeInTheDocument();
    expect(screen.getByText("Bot thường" )).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu ván" }));

    expect(screen.getByRole("region", { name: "Bàn cờ, góc nhìn phe Xanh" })).toBeInTheDocument();
    expect(screen.getByText("Không có kết nối lại · trạng thái local là nguồn sự thật của ván này.")).toBeInTheDocument();
  });

  it("exposes surrender button during active game and stays visible without being covered", async () => {
    renderWithProviders(<LocalGamePage mode="OFFLINE" />, "/offline");
    fireEvent.click(await screen.findByRole("button", { name: "Bắt đầu ván" }));

    expect(screen.getByRole("button", { name: "Đầu hàng" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thoát ván" })).toBeInTheDocument();
  });
});

describe("test-v0.2 local canonical blocked-turn integration", () => {
  beforeEach(() => localStorage.clear());
  it.each(["AI", "OFFLINE"] as const)("resolves restored blocked %s turn through canonical rules", async (mode) => {
    const state = createInitialState();
    const board = Object.fromEntries(Object.keys(state.board).map(coordinate => [coordinate, null])) as Record<Coordinate, RuleState["board"][Coordinate]>;
    const counts = { BLUE: { R: 0, P: 0, S: 0 }, RED: { R: 0, P: 0, S: 0 } };
    const entries = [
      ["c1", "RED", "R"], ["c2", "RED", "R"], ["a3", "RED", "R"], ["b3", "RED", "R"], ["c3", "RED", "R"],
      ["a1", "RED", "P"], ["b1", "RED", "P"], ["a2", "RED", "S"], ["b2", "RED", "S"],
      ["d1", "BLUE", "R"], ["d3", "BLUE", "R"], ["a4", "BLUE", "R"], ["c4", "BLUE", "R"],
      ["d2", "BLUE", "P"], ["b4", "BLUE", "P"], ["d4", "BLUE", "P"], ["h7", "BLUE", "S"],
    ] as const;
    for (const [coordinate, side, type] of entries) {
      counts[side][type]++;
      board[coordinate] = { id: coordinate, side, type };
    }
    await setLocalSession({
      mode, setup: { blueName: "Xanh", redName: "Đỏ", timerSeconds: 60 },
      state: { ...state, board, pieceCounts: counts, currentTurn: "RED" },
      clocks: { BLUE: 60, RED: 60 }, remaining: 60, savedAt: new Date().toISOString(),
    });
    renderWithProviders(<LocalGamePage mode={mode} />, mode === "AI" ? "/ai" : "/offline");
    expect(await screen.findByRole("heading", { name: "CHIẾN THẮNG" })).toBeInTheDocument();
    expect(screen.getByText("Đối thủ không còn nước đi hợp lệ.")).toBeInTheDocument();
    await waitFor(async () => expect((await getLocalHistory())[0]?.result).toBe("WIN"));
  });
});
