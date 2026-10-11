import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProfilePage from "./ProfilePage";
import { renderWithProviders } from "../test/renderWithProviders";
import { ApiError } from "../services/http/apiError";

const mocks = vi.hoisted(() => ({
  getMe: vi.fn(),
  getPublicProfile: vi.fn(),
  getGuestProfile: vi.fn(),
  getLocalHistory: vi.fn(),
}));

vi.mock("../services/auth/authApi", () => ({ getMe: mocks.getMe, getPublicProfile: mocks.getPublicProfile, updateProfile: vi.fn() }));
vi.mock("../services/local/localGameStorage", () => ({ getGuestProfile: mocks.getGuestProfile, getLocalHistory: mocks.getLocalHistory }));

describe("R14 Profile output", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("shows the persistent Guest identity and local record without inventing rank", async () => {
    mocks.getMe.mockRejectedValue(new ApiError("Bạn cần đăng nhập để tiếp tục.", 401, "UNAUTHORIZED"));
    mocks.getGuestProfile.mockResolvedValue({ displayName: "Khách Sao Bắc" });
    mocks.getLocalHistory.mockResolvedValue([
      { localId: "g1", mode: "GUEST", result: "WIN", playerName: "Khách Sao Bắc", opponentName: "Bot mẫu", timerSeconds: 30, durationSeconds: 42, endedAt: "2026-10-04T08:00:00.000Z", scoreDelta: 0 },
      { localId: "g2", mode: "AI", result: "LOSS", playerName: "Khách Sao Bắc", opponentName: "AI", timerSeconds: 30, durationSeconds: 30, endedAt: "2026-10-03T08:00:00.000Z", scoreDelta: 0 },
    ]);

    renderWithProviders(<ProfilePage />, "/ho-so");

    await waitFor(() => expect(screen.getByRole("heading", { name: "Khách Sao Bắc" })).toBeInTheDocument());
    expect(document.querySelector(".robot-lab-profile-shell")).toBeInTheDocument();
    expect(screen.getByText("Hồ sơ Guest trên thiết bị")).toBeInTheDocument();
    expect(screen.getByText("2 ván local")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Đăng nhập để đồng bộ" })).toHaveAttribute("href", "/dang-nhap?returnTo=%2Fho-so");
    expect(screen.queryByText(/Rank/)).not.toBeInTheDocument();
  });

  it("keeps ranked Elo separate from Bot results on an account profile", async () => {
    mocks.getMe.mockResolvedValue({ user: {
      id: "user-1", fullName: "Người Chơi", displayName: "Blue", username: "blue", theme: "dark", avatarPreset: "robot",
      privacy: { presenceVisibility: "FRIENDS", friendListVisibility: "PRIVATE", fullNameVisibility: "PRIVATE" },
      stats: { elo: 1400, rankedWins: 10, rankedLosses: 4, quickWins: 2, quickLosses: 1 },
      botStats: { wins: 7, losses: 3 },
    } });

    renderWithProviders(<ProfilePage />, "/ho-so");

    await waitFor(() => expect(screen.getByRole("heading", { name: "Blue" })).toBeInTheDocument());
    expect(document.querySelector(".robot-lab-profile-shell")).toBeInTheDocument();
    expect(screen.getByText("ĐẤU BOT · KHÔNG XẾP HẠNG")).toBeInTheDocument();
    expect(screen.getByText("7 thắng · 3 thua")).toBeInTheDocument();
    expect(screen.getByText("Bot không thay đổi Elo Ranked")).toBeInTheDocument();
  });

  it("shows server error state on 500 without redirecting to login (PROFILE-01)", async () => {
    mocks.getMe.mockRejectedValue(new ApiError("Lỗi kết nối máy chủ, vui lòng thử lại.", 500, "INTERNAL_ERROR"));

    renderWithProviders(<ProfilePage />, "/ho-so");

    await waitFor(() => expect(screen.getByRole("heading", { name: "Lỗi kết nối máy chủ" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Đăng nhập" })).not.toBeInTheDocument();
  });

  it("shows friendly robot empty state on 404 public profile instead of crash or login (PLAYER-01)", async () => {
    mocks.getPublicProfile.mockRejectedValue(new ApiError("Không tìm thấy người chơi.", 404, "NOT_FOUND"));

    renderWithProviders(
      <Routes>
        <Route path="/profile/:username" element={<ProfilePage />} />
      </Routes>,
      "/profile/ghost_player"
    );

    await waitFor(() => expect(screen.getByRole("heading", { name: "Không tìm thấy người chơi" })).toBeInTheDocument());
    expect(screen.getByText(/Người chơi "@ghost_player" không tồn tại/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Khám phá phòng chơi" })).toBeInTheDocument();
  });
});

