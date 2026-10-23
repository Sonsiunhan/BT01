import { render, screen, waitFor } from "@testing-library/react";
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
});
