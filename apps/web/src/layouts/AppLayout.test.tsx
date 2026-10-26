import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppLayout } from "./AppLayout";
import { renderWithProviders } from "../test/renderWithProviders";

const mocks = vi.hoisted(() => ({ getMe: vi.fn() }));

vi.mock("../services/auth/authApi", () => ({
  getMe: mocks.getMe,
  logout: vi.fn(async () => undefined),
}));
vi.mock("../services/health/healthApi", () => ({
  getHealth: vi.fn(async () => ({ status: "ok" })),
  isCoreServiceReady: vi.fn(() => true),
}));

function renderPlayerShell(path: string) {
  return renderWithProviders(
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/lich-su" element={<div data-testid="player-probe">player-page</div>} />
        <Route path="/staff/invitations/:tournamentId/:token" element={<div data-testid="invitation-probe">invitation-page</div>} />
        <Route path="/admin/tournaments" element={<div data-testid="admin-probe">admin-console</div>} />
      </Route>
    </Routes>,
    path,
  );
}

describe("AppLayout — strict role separation redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chuyển phiên admin từ URL người chơi về Console Quản trị", async () => {
    mocks.getMe.mockResolvedValue({ user: { id: "sa-1", role: "SYSTEM_ADMIN", displayName: "UITest Admin" } });
    renderPlayerShell("/lich-su");

    await waitFor(() => expect(screen.getByTestId("admin-probe")).toBeInTheDocument());
    expect(screen.queryByTestId("player-probe")).not.toBeInTheDocument();
  });

  it("chuyển cả phiên TOURNAMENT_ADMIN (TA)", async () => {
    mocks.getMe.mockResolvedValue({ user: { id: "ta-1", role: "TOURNAMENT_ADMIN", displayName: "UITest TA" } });
    renderPlayerShell("/lich-su");

    await waitFor(() => expect(screen.getByTestId("admin-probe")).toBeInTheDocument());
  });

  it("người chơi thường vẫn ở lại trang người chơi", async () => {
    mocks.getMe.mockResolvedValue({ user: { id: "p-1", role: "USER", displayName: "UITest Player" } });
    renderPlayerShell("/lich-su");

    await waitFor(() => expect(screen.getByTestId("player-probe")).toBeInTheDocument());
    expect(screen.queryByTestId("admin-probe")).not.toBeInTheDocument();
  });

  it("khách/ẩn danh không bị chuyển hướng", async () => {
    mocks.getMe.mockRejectedValue(new Error("Bạn cần đăng nhập để tiếp tục."));
    renderPlayerShell("/lich-su");

    await waitFor(() => expect(screen.getByTestId("player-probe")).toBeInTheDocument());
    expect(screen.queryByTestId("admin-probe")).not.toBeInTheDocument();
  });

  it("admin mở link thư mời trọng tài vẫn đến đúng trang nhận lời (luồng token)", async () => {
    mocks.getMe.mockResolvedValue({ user: { id: "sa-1", role: "SYSTEM_ADMIN", displayName: "UITest Admin" } });
    renderPlayerShell("/staff/invitations/tour-1/tok-abc");

    await waitFor(() => expect(screen.getByTestId("invitation-probe")).toBeInTheDocument());
    expect(screen.queryByTestId("admin-probe")).not.toBeInTheDocument();
  });
});
