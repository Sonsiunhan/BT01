import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HistoryListResponse } from "@ottv2/contracts";

import HistoryPage from "./HistoryPage";
import * as historyApi from "../services/history/historyApi";
import * as localHistory from "../services/local/localGameStorage";
import { ApiError } from "../services/http/apiError";
import { renderWithProviders } from "../test/renderWithProviders";

const list: HistoryListResponse = {
  matches: [],
  nextCursor: null,
  hasMore: false,
  summary: { elo: 1000, wins: 0, losses: 0, total: 0, winRate: 0 },
};

describe("B7 history filters", () => {
  it("reloads device summaries when a terminal write commits after the page opens", async () => {
    vi.spyOn(historyApi, "getHistory").mockRejectedValue(new ApiError("Cần đăng nhập", 401));
    const read = vi.spyOn(localHistory, "getLocalHistory").mockResolvedValue([]);
    renderWithProviders(<HistoryPage />, "/lich-su?mode=BOT_ONLINE");
    await screen.findByText("Lịch sử Guest được lưu trên thiết bị này.");
    read.mockResolvedValue([{ localId: "late-summary", mode: "BOT_ONLINE", result: "WIN", playerName: "Khách Xanh", opponentName: "Khách Đỏ", timerSeconds: 300, durationSeconds: 5, endedAt: new Date().toISOString(), scoreDelta: 0 }]);
    window.dispatchEvent(new Event("ottv2:local-history-changed"));
    await screen.findByText("Bot Online · Guest");
  });
  it("keeps Guest device Bot results accessible without requiring an account", async () => {
    vi.spyOn(historyApi, "getHistory").mockRejectedValue(new ApiError("Cần đăng nhập", 401));
    vi.spyOn(localHistory, "getLocalHistory").mockResolvedValue([{ localId: "guest-bot-fixture", mode: "BOT_ONLINE", result: "WIN", playerName: "Khách Xanh", opponentName: "Khách Đỏ", timerSeconds: 300, durationSeconds: 5, endedAt: new Date().toISOString(), scoreDelta: 0 }]);
    renderWithProviders(<HistoryPage />, "/lich-su?mode=BOT_ONLINE");
    await screen.findByText("Lịch sử Guest được lưu trên thiết bị này.");
    expect(screen.getByText("Bot Online · Guest")).toBeInTheDocument();
  });
  it("keeps filter state in the route query while reloading the canonical list", async () => {
    const getHistory = vi.spyOn(historyApi, "getHistory").mockResolvedValue(list);
    renderWithProviders(<HistoryPage />, "/history?mode=RANKED&result=WIN&range=7D");

    await waitFor(() => expect(getHistory).toHaveBeenCalledWith({ mode: "RANKED", result: "WIN", range: "7D" }, expect.any(AbortSignal)));
    expect(document.querySelector(".robot-lab-history-page")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đấu máy" }));

    await waitFor(() => expect(getHistory).toHaveBeenLastCalledWith({ mode: "AI", result: "WIN", range: "7D" }, expect.any(AbortSignal)));
    expect(screen.getByRole("button", { name: "Đấu máy" })).toHaveClass("active");
  });
});
