import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "./SettingsPage";
import { ApiError } from "../services/http/apiError";
import { renderWithProviders } from "../test/renderWithProviders";

const mocks = vi.hoisted(() => ({
  getMe: vi.fn(),
  getBlockedUsers: vi.fn(),
  getLocalDataSummary: vi.fn(),
  exportLocalData: vi.fn(),
  clearLocalData: vi.fn(),
  getOfflineKitStatus: vi.fn(),
  installOfflineKit: vi.fn(),
  clearOfflineKit: vi.fn(),
}));

vi.mock("../services/auth/authApi", () => ({ getMe: mocks.getMe, updateProfile: vi.fn(), changePassword: vi.fn() }));
vi.mock("../services/social/socialApi", () => ({ getBlockedUsers: mocks.getBlockedUsers, unblockUser: vi.fn() }));
vi.mock("../services/local/localData", () => ({ getLocalDataSummary: mocks.getLocalDataSummary, exportLocalData: mocks.exportLocalData, clearLocalData: mocks.clearLocalData }));
vi.mock("../services/local/offlineKit", () => ({ getOfflineKitStatus: mocks.getOfflineKitStatus, installOfflineKit: mocks.installOfflineKit, clearOfflineKit: mocks.clearOfflineKit }));

describe("R15 Settings output", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMe.mockRejectedValue(new ApiError("Bạn cần đăng nhập.", 401, "UNAUTHORIZED"));
    mocks.getBlockedUsers.mockResolvedValue({ users: [] });
    mocks.getLocalDataSummary.mockResolvedValue({ categories: ["Guest identity", "Local saves", "Local history", "Bot Offline library", "Offline cache"], counts: { history: 2, saves: 1, library: 0 }, activeSession: null });
    mocks.getOfflineKitStatus.mockResolvedValue({ version: "r15-test", ready: true, cached: 5, total: 5, missing: [], message: "Offline kit đã sẵn sàng." });
  });

  it("shows local-only export/clear controls without account data", async () => {
    renderWithProviders(<SettingsPage />, "/cai-dat?tab=local-data");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Dữ liệu trên thiết bị" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Xuất dữ liệu trên thiết bị" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xóa dữ liệu trên thiết bị" })).toBeInTheDocument();
    expect(screen.queryByText(/Mật khẩu hiện tại/)).not.toBeInTheDocument();
  });

  it("exposes Offline kit diagnostics in a collapsed technical section", async () => {
    renderWithProviders(<SettingsPage />, "/cai-dat?tab=diagnostics");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Chẩn đoán thiết bị" })).toBeInTheDocument());
    expect(screen.getByText("r15-test")).toBeInTheDocument();
    expect(screen.getByText("Offline kit đã sẵn sàng.")).toBeInTheDocument();
    expect(screen.getByText("Chi tiết kỹ thuật")).toBeInTheDocument();
  });

  it("shows a Robot Lab preview and supports roving keyboard tabs", async () => {
    renderWithProviders(<SettingsPage />, "/cai-dat?tab=appearance");
    const panel = await screen.findByRole("tabpanel", { name: "Giao diện" });
    expect(panel.querySelector('[data-settings-preview="robot-lab"]')).toBeInTheDocument();
    const tab = screen.getByRole("tab", { name: "Giao diện" });
    fireEvent.keyDown(tab, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Âm thanh" })).toHaveFocus();
    expect(screen.getByRole("tabpanel", { name: "Âm thanh" })).toBeInTheDocument();
  });

  it("requires explicit confirmation and shows a Guest active-session deletion error", async () => {
    mocks.clearLocalData.mockRejectedValue(Object.assign(new Error("active"), { code: "ACTIVE_LOCAL_SESSION" }));
    renderWithProviders(<SettingsPage />, "/cai-dat?tab=local-data");
    fireEvent.click(await screen.findByRole("button", { name: "Xóa dữ liệu trên thiết bị" }));
    expect(mocks.clearLocalData).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Xóa dữ liệu trên thiết bị?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận xóa" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Hãy tạm dừng hoặc kết thúc trận local");
  });

  it("does not silently hide account service failures behind the Guest hint", async () => {
    mocks.getMe.mockRejectedValue(new ApiError("Máy chủ đang bận. Hãy thử lại.", 503, "UNAVAILABLE"));
    renderWithProviders(<SettingsPage />, "/cai-dat?tab=appearance");
    expect(await screen.findByRole("alert")).toHaveTextContent("Máy chủ đang bận");
    expect(screen.getByRole("button", { name: "Thử lại tài khoản" })).toBeInTheDocument();
  });

  it("guards Offline cache deletion while a local session is active", async () => {
    mocks.getLocalDataSummary.mockResolvedValue({ counts: { history: 0, saves: 1, library: 1 }, activeSession: { mode: "BOT_OFFLINE" } });
    renderWithProviders(<SettingsPage />, "/cai-dat?tab=diagnostics");
    fireEvent.click(await screen.findByRole("button", { name: "Xóa cache Offline" }));
    expect(screen.getByRole("dialog", { name: "Xóa cache Offline?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận xóa cache" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("kết thúc trận local");
    expect(mocks.clearOfflineKit).not.toHaveBeenCalled();
  });
});
