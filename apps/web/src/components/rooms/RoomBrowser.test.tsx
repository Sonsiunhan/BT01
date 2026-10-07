import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { RoomBrowser } from "./RoomBrowser";

const mocks = vi.hoisted(() => ({ getRooms: vi.fn(), subscribeToRooms: vi.fn(), createRoom: vi.fn(), joinRoom: vi.fn(), navigate: vi.fn() }));
vi.mock("../../services/rooms/roomApi", () => mocks);
vi.mock("../../services/guest/guestApi", () => ({ ensureGuestSession: vi.fn().mockResolvedValue({}) }));
vi.mock("react-router-dom", async () => { const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom"); return { ...actual, useNavigate: () => mocks.navigate }; });

const rooms = Array.from({ length: 10 }, (_, index) => ({
  roomId: `A${String(index).padStart(5, "0")}`,
  name: `Room ${String(index + 1).padStart(2, "0")}`,
  players: index % 3,
  playerCapacity: 2 as const,
  waitingPlayerRating: null,
  mode: "UNRANKED" as const,
  playMode: index % 2 === 0 ? "MANUAL" as const : "BOT" as const,
  visibility: "PUBLIC" as const,
  timerSeconds: 300 as const,
  spectators: 0,
  spectatorsEnabled: index === 0,
  spectatorCapacity: index === 0 ? 10 as const : null,
  refereeEnabled: index === 0,
  refereeUserId: null,
  refereeConnected: false,
  status: "WAITING" as const,
}));

describe("R6 RoomBrowser full list", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.getRooms.mockResolvedValue({ rooms }); mocks.subscribeToRooms.mockReturnValue(() => undefined); mocks.createRoom.mockResolvedValue({ room: { roomId: "BOT123", playMode: "BOT", role: "PLAYER" } }); });

  it("renders filters, room role badges and an unclipped load-more grid", async () => {
    renderWithProviders(<RoomBrowser variant="full" />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Danh sách Phòng Online" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Tất cả" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Trọng tài")).toBeInTheDocument();
    expect(screen.getByText("Khán giả")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xem thêm phòng" })).toBeInTheDocument();
    expect(document.querySelector(".room-browser-full .room-grid-scroll")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Đấu chương trình" }));
    expect(screen.getByRole("button", { name: "Đấu chương trình" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Room 02")).toBeInTheDocument();
    expect(screen.queryByText("Room 01")).not.toBeInTheDocument();
  });

  it("exposes the R7 mode and independent referee/host role choices in create flow", async () => {
    renderWithProviders(<RoomBrowser variant="full" openCreateOnMount />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Tạo phòng đấu" })).toBeInTheDocument());
    expect(screen.getByRole("radio", { name: /Chơi trực tiếp/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Đấu chương trình/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Có Trọng tài/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Cho phép spectator/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /Đấu chương trình/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Có Trọng tài/i }));
    expect(screen.getByRole("radio", { name: /Tôi làm Người chơi/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Tôi làm Trọng tài/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Tôi làm Trọng tài/i }));
    expect(screen.getByText(/chủ phòng làm trọng tài cần phòng Private/i)).toBeInTheDocument();
  });

  it("keeps Bot custom-room creation discoverable without promoting it on Bot Online", async () => {
    renderWithProviders(<RoomBrowser variant="full" openCreateOnMount />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Tạo phòng đấu" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("radio", { name: /Đấu chương trình/i }));
    const createButtons = screen.getAllByRole("button", { name: "Tạo phòng" });
    fireEvent.click(createButtons[createButtons.length - 1]);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/dau-chuong-trinh/online?room=BOT123"));
  });
});
