import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "@ottv2/game-rules";
import type { MatchSnapshot, RoomDetail } from "@ottv2/contracts";
import { ApiError } from "../services/http/apiError";
import SpectatorPage from "./SpectatorPage";

const spectatorApi = vi.hoisted(() => ({
  requestSpectator: vi.fn(),
  getSpectatorMatch: vi.fn(),
  subscribeToSpectator: vi.fn(() => () => undefined),
  leaveSpectator: vi.fn(),
}));
const guestApi = vi.hoisted(() => ({ ensureGuestSession: vi.fn() }));

vi.mock("../services/rooms/spectatorApi", () => spectatorApi);
vi.mock("../services/guest/guestApi", () => guestApi);

function fixture(): { room: RoomDetail; match: MatchSnapshot } {
  const base = createInitialState();
  const match = {
    matchId: "00000000-0000-4000-8000-000000000001",
    roomId: "ROOM42",
    mode: "UNRANKED",
    playMode: "BOT",
    status: "PAUSED",
    players: [
      { userId: "blue", username: "blue", displayName: "Bot Xanh", side: "BLUE", ready: true, connected: true },
      { userId: "red", username: "red", displayName: "Bot Đỏ", side: "RED", ready: true, connected: true },
    ],
    board: base.board,
    pieceCounts: base.pieceCounts,
    currentTurn: "BLUE",
    winner: null,
    resultReason: null,
    clocksMs: { BLUE: 300_000, RED: 300_000 },
    timerSeconds: 300,
    countdownEndsAt: null,
    startedAt: 1000,
    endedAt: null,
    sequence: 4,
    stateVersion: 4,
    rating: null,
    refereeEnabled: true,
    refereeUserId: "referee",
    refereeConnected: true,
    pauseReason: "REFEREE",
    pauseCategory: "TECHNICAL_ISSUE",
    pausedAt: 2000,
    pauseElapsedMs: 12_000,
    resumeEndsAt: null,
    moves: [],
    publicTimeline: [
      { sequence: 1, type: "MATCH_STARTED", timestamp: 1000 },
      { sequence: 2, type: "BOT_REVISION_APPLIED", timestamp: 1100, side: "BLUE", revisionNumber: 3 },
      { sequence: 3, type: "PIECE_MOVE_ACCEPTED", timestamp: 1200, side: "BLUE" },
    ],
  } as MatchSnapshot;
  const room = {
    roomId: "ROOM42", name: "Phòng Robot", players: 2, playerCapacity: 2, waitingPlayerRating: null,
    mode: "UNRANKED", playMode: "BOT", visibility: "PUBLIC", timerSeconds: 300, spectators: 1,
    spectatorsEnabled: true, spectatorCapacity: 10, refereeEnabled: true, refereeUserId: "referee",
    refereeConnected: true, status: "PLAYING", hostUserId: "host", isMember: false, requiresPassword: false,
    role: "SPECTATOR", isReferee: false, referee: { userId: "referee", username: "ref", displayName: "Trọng tài", connected: true },
    members: [{ userId: "blue", username: "blue", displayName: "Bot Xanh", isHost: true }, { userId: "red", username: "red", displayName: "Bot Đỏ", isHost: false }],
  } as RoomDetail;
  return { room, match };
}

describe("SpectatorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const { room, match } = fixture();
    guestApi.ensureGuestSession.mockResolvedValue({ displayName: "Khách" });
    spectatorApi.requestSpectator.mockResolvedValue({ role: "SPECTATOR", room });
    spectatorApi.getSpectatorMatch.mockResolvedValue({ role: "SPECTATOR", room, match, viewerSide: null, spectatorCount: 1 });
    spectatorApi.leaveSpectator.mockResolvedValue(undefined);
  });

  it("renders public timeline and keeps the paused public board read-only", async () => {
    render(<MemoryRouter initialEntries={["/spectate/ROOM42"]}><Routes><Route path="/spectate/:roomId" element={<SpectatorPage />} /></Routes></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Phòng Robot" })).toBeInTheDocument();
    expect(document.querySelector(".robot-lab-spectator-page")).toBeInTheDocument();
    expect(screen.getByText(/Revision 3/)).toBeInTheDocument();
    expect(screen.getByText("Nước đi mới đã được chấp nhận")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tiếp tục" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rời phòng" })).toHaveAttribute("href", "/");
    expect(screen.getAllByRole("gridcell")).toHaveLength(81);
    expect(screen.getAllByRole("gridcell").every((cell) => (cell as HTMLButtonElement).disabled)).toBe(true);
  });

  it("distinguishes an unavailable spectator service without exposing diagnostics", async () => {
    spectatorApi.requestSpectator.mockRejectedValueOnce(new ApiError("upstream down", 503, "UPSTREAM_UNAVAILABLE"));
    render(<MemoryRouter initialEntries={["/spectate/ROOM42"]}><Routes><Route path="/spectate/:roomId" element={<SpectatorPage />} /></Routes></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Không thể xem trận" })).toBeInTheDocument();
    expect(screen.getByText("Dịch vụ xem trận đang tạm thời không khả dụng.")).toBeInTheDocument();
    expect(screen.queryByText(/upstream down|UPSTREAM_UNAVAILABLE|stack/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  });
});
