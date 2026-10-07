import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import HomePage from "./HomePage";

const mocks = vi.hoisted(() => ({
  getHealth: vi.fn(),
  isCoreServiceReady: vi.fn(),
  getMe: vi.fn(),
}));

vi.mock("../services/health/healthApi", () => mocks);
vi.mock("../services/auth/authApi", () => ({ getMe: mocks.getMe }));
vi.mock("../components/rooms/RoomBrowser", () => ({ RoomBrowser: () => <section aria-label="Room Browser mock"><h2>Danh sách Phòng Online</h2></section> }));
vi.mock("../components/social/FriendsPreview", () => ({ FriendsPreview: ({ authState }: { authState: string }) => <section aria-label={`Friends Preview ${authState}`}>{authState === "guest" && <span>Thêm bạn để CHAN!</span>}</section> }));

const user = {
  id: "user-1",
  fullName: "Nguyễn Blue",
  displayName: "Blue",
  username: "blue",
  theme: "dark" as const,
  avatarPreset: "arena" as const,
  stats: { elo: 1460, rankedWins: 12, rankedLosses: 8, quickWins: 2, quickLosses: 1 },
};

describe("R6 Homepage / Robot Lab lobby", () => {
  beforeEach(() => { vi.clearAllMocks(); window.localStorage.clear(); });

  it("keeps the Robot Lab two-column/tab contract and transforms the CTA for guests", async () => {
    mocks.getHealth.mockResolvedValue({ service: "ottv2", status: "ok", components: { realtime: { status: "ok" } } });
    mocks.isCoreServiceReady.mockReturnValue(true);
    mocks.getMe.mockRejectedValue(new Error("guest"));

    renderWithProviders(<HomePage />);

    await waitFor(() => expect(screen.getByText("Khách đấu trường")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "TÌM TRẬN" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Chơi trực tiếp" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Đấu chương trình" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("link", { name: /TÌM TRẬN/ })).toHaveAttribute("href", "/queue?mode=UNRANKED");
    expect(screen.getByRole("button", { name: "Đấu thường" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Xếp hạng" })).toBeDisabled();
    expect(screen.getByText(/Đấu với máy/)).toBeInTheDocument();
    expect(screen.getByText("Offline 2P")).toBeInTheDocument();
    expect(screen.getByText("Tập luyện")).toBeInTheDocument();
    expect(screen.queryByText("Bot Online")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Robot chủ nhà Robot Lab" })).toBeInTheDocument();
    expect(screen.getByTestId("robot-lab-hero-host")).toBeInTheDocument();
    expect(document.querySelector(".home-lobby-hero .hero-orb")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Đấu chương trình" }));
    expect(screen.getByText("Bot Online")).toBeInTheDocument();
    expect(screen.getByText("Tìm đối thủ Bot sau khi kiểm tra code")).toBeInTheDocument();
    expect(screen.queryByText("Đấu bot qua phòng custom")).not.toBeInTheDocument();
    expect(screen.getByText("Bot Offline")).toBeInTheDocument();
    expect(screen.getByText("Thư viện Bot")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ĐẤU BOT ONLINE/ })).toHaveAttribute("href", "/dau-chuong-trinh/online");
    expect(screen.queryByRole("button", { name: "Xếp hạng" })).not.toBeInTheDocument();
    expect(screen.getByText("Danh sách Phòng Online")).toBeInTheDocument();
    expect(screen.getByText("Thêm bạn để CHAN!")).toBeInTheDocument();
    expect(screen.queryByText("Mở dossier")).not.toBeInTheDocument();
    expect(screen.queryByText("Ghép đối thủ theo Elo")).not.toBeInTheDocument();
    expect(screen.queryByText("Không cần hover")).not.toBeInTheDocument();
    expect(screen.queryByText("SYSTEM-PULSE")).not.toBeInTheDocument();
    expect(screen.queryByText("Guest Arena")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Room Browser mock" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Friends Preview guest" })).toBeInTheDocument();
  });

  it("renders the authenticated profile, rank and ranked CTA", async () => {
    mocks.getHealth.mockResolvedValue({ service: "ottv2", status: "ok", components: { realtime: { status: "ok" } } });
    mocks.isCoreServiceReady.mockReturnValue(true);
    mocks.getMe.mockResolvedValue({ user });

    renderWithProviders(<HomePage />);

    await waitFor(() => expect(screen.getByText("Blue")).toBeInTheDocument());
    expect(screen.getByLabelText("Rank GOLD")).toBeInTheDocument();
    expect(screen.getByText("Chào Blue. Bạn đã sẵn sàng CHAN chưa?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xếp hạng" })).not.toBeDisabled();
    expect(screen.getByRole("link", { name: /TÌM TRẬN/ })).toHaveAttribute("href", "/queue");
    expect(screen.getByRole("region", { name: "Friends Preview authenticated" })).toBeInTheDocument();
  });
});
