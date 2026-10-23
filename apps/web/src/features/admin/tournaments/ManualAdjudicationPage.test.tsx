import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ManualAdjudicationPage from "./ManualAdjudicationPage";

const now = "2026-10-23T08:00:00.000Z";
const item = {
  id: "adj-1", tournamentId: "t-1", matchId: "m-1", roomId: "room-1",
  blueParticipant: { id: "blue-1", label: "Blue Bot" }, redParticipant: { id: "red-1", label: "Red Bot" },
  status: "WAITING", board: null, sideToMove: "BLUE", tieIndicators: null, ruleVersion: "v3",
  deadlineAt: "2026-10-23T09:00:00.000Z", fallbackPolicy: "RANDOM_SEEDED", winnerSide: null,
  reason: null, resolutionSource: null, decidedByUserId: null, finishedAtIso: null, finishSequence: null,
  createdAt: now, updatedAt: now,
};
const completeItem = {
  ...item,
  board: {
    rows: 2,
    columns: 2,
    cells: [
      { row: 0, column: 0, side: "BLUE", pieceType: "R" },
      { row: 1, column: 1, side: "RED", pieceType: "S" },
    ],
  },
  tieIndicators: {
    blue: { materialByType: { R: 1, P: 0, S: 0 }, goalDistance: { reachable: true, distance: 2 }, mobility: 1 },
    red: { materialByType: { R: 0, P: 0, S: 1 }, goalDistance: { reachable: false, distance: null }, mobility: 1 },
  },
};

function renderPage() {
  return render(<MemoryRouter initialEntries={["/admin/tournaments/t-1/adjudications"]}>
    <Routes><Route path="/admin/tournaments/:tournamentId/adjudications" element={<ManualAdjudicationPage />} /></Routes>
  </MemoryRouter>);
}

describe("P05 ManualAdjudicationPage", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ adjudications: [item] }), { status: 200 }))));
  afterEach(() => vi.unstubAllGlobals());

  it("renders a waiting request and never displays raw snapshot fields", async () => {
    renderPage();
    expect(await screen.findByText("Phân xử trận hòa tuyệt đối")).toBeInTheDocument();
    expect(screen.getByText("Blue Bot")).toBeInTheDocument();
    expect(screen.getByText("Chờ phán quyết")).toBeInTheDocument();
    expect(screen.queryByText("frozenSnapshot")).not.toBeInTheDocument();
  });

  it("shows forbidden state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Không có quyền" }), { status: 403 })));
    renderPage();
    await waitFor(() => expect(screen.getByText("Không có quyền")).toBeInTheDocument());
  });

  it("renders canonical board positions and comparator metrics", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ adjudications: [completeItem] }), { status: 200 })));
    renderPage();
    expect(await screen.findByLabelText("Bàn cờ 2×2")).toBeInTheDocument();
    expect(screen.getByText("BR")).toBeInTheDocument();
    expect(screen.getByText("R/P/S: 0/0/1", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/không tới được/)).toBeInTheDocument();
    expect(screen.getAllByText("Mobility:", { exact: false })).toHaveLength(2);
  });

  it("shows submit conflict and refreshes the list", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ adjudications: [completeItem] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Trạng thái trận đã thay đổi" }), { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ adjudications: [{ ...completeItem, status: "DECIDED", winnerSide: "BLUE", reason: "Đã xử lý ở phiên khác", resolutionSource: "MANUAL" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    await screen.findByLabelText("Bàn cờ 2×2");
    fireEvent.click(screen.getByRole("radio", { name: "BLUE" }));
    fireEvent.change(screen.getByLabelText("Lý do phán quyết (3–1000 ký tự)"), { target: { value: "Xác nhận theo snapshot" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi phán quyết" }));
    await waitFor(() => expect(screen.getByText("Trạng thái trận đã thay đổi")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(screen.getByText("Đã quyết định")).toBeInTheDocument();
  });
});
