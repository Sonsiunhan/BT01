import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { BotLibraryItem, BotRevision, BotSdkDocsResponse } from "@ottv2/contracts";

import BotWorkbenchPage from "./BotWorkbenchPage";
import * as botLibraryApi from "../services/bot-library/botLibraryApi";
import { guestBotLibraryApi } from "../services/bot-library/guestBotLibrary";
import { ApiError } from "../services/http/apiError";
import { renderWithProviders } from "../test/renderWithProviders";

const revision: BotRevision = {
  id: "rev-1", revisionNumber: 1, status: "READY" as const, sdkVersion: "r3", schemaVersion: "1", sourceDigest: "a".repeat(64), sourceBytes: 86,
  createdAt: "2026-10-04T01:00:00.000Z", updatedAt: "2026-10-04T01:00:00.000Z", memoryPolicy: "RESET_ON_NEW_REVISION", availability: ["ONLINE", "OFFLINE"],
};
const bot: BotLibraryItem = { id: "bot-1", name: "Bot xanh", createdAt: revision.createdAt, updatedAt: revision.updatedAt, usedBytes: revision.sourceBytes, revisions: [revision] };
const sdkDocs: BotSdkDocsResponse = { sdkVersion: "r3", schemaVersion: "1", allowlist: ["math"], template: "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n", limits: { sourceBytes: 65536, memoryBytes: 8192, perTurnMs: 500, wholeMatchMs: 30000 } };

describe("R9 Robot Lab Workbench", () => {
  it("hands the actual bot/revision selection to preparation instead of claiming success in a toast", async () => {
    vi.spyOn(botLibraryApi, "getBotLibrary").mockResolvedValue({ bots: [bot], quotaBytes: 262144, usedBytes: revision.sourceBytes });
    vi.spyOn(botLibraryApi, "getBotSdkDocs").mockResolvedValue(sdkDocs);
    function Harness() { const location = useLocation(); return location.pathname === "/bot-lab" ? <BotWorkbenchPage /> : <p data-testid="destination">{location.pathname}{location.search}</p>; }
    render(<MemoryRouter initialEntries={["/bot-lab"]}><Harness /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Workbench chiến thuật" });
    fireEvent.click(screen.getByRole("button", { name: "Dùng Offline" }));
    expect(await screen.findByTestId("destination")).toHaveTextContent("/dau-chuong-trinh/offline?botId=bot-1&revisionId=rev-1");
  });
  it("renders private three-region workbench with states, SDK docs and safe source actions", async () => {
    vi.spyOn(botLibraryApi, "getBotLibrary").mockResolvedValue({ bots: [bot], quotaBytes: 262144, usedBytes: revision.sourceBytes });
    vi.spyOn(botLibraryApi, "getBotSdkDocs").mockResolvedValue(sdkDocs);
    vi.spyOn(botLibraryApi, "getBotSource").mockResolvedValue({ botId: bot.id, revisionId: revision.id, source: "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n" });
    renderWithProviders(<BotWorkbenchPage />, "/bot-lab");
    expect(await screen.findByRole("heading", { name: "Workbench chiến thuật" })).toBeInTheDocument();
    expect(document.querySelector(".robot-lab-bot-workbench")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Danh sách bot" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Nạp chiến thuật" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Kiểm tra và nhật ký riêng" })).toBeInTheDocument();
    expect(screen.getByText("Bot xanh")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xem mã nguồn" }));
    expect(await screen.findByText(/def choose_move/)).toBeInTheDocument();
    expect(screen.getByText("Chỉ chủ sở hữu mới xem được mã nguồn.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dùng Online" })).not.toBeDisabled();
  });

  it("shows explicit empty, invalid and quota/error states instead of hiding failures", async () => {
    vi.spyOn(botLibraryApi, "getBotLibrary").mockResolvedValueOnce({ bots: [], quotaBytes: 262144, usedBytes: 0 });
    vi.spyOn(botLibraryApi, "getBotSdkDocs").mockResolvedValue({ ...sdkDocs, allowlist: [], template: "" });
    renderWithProviders(<BotWorkbenchPage />, "/bot-lab");
    expect(await screen.findByText("Chưa có chiến thuật nào")).toBeInTheDocument();
    expect(screen.getByText(/0 B \/ 256 KiB/)).toBeInTheDocument();
  });

  it("uses a separate local Guest library after an explicit unauthenticated response", async () => {
    vi.spyOn(botLibraryApi, "getBotLibrary").mockRejectedValueOnce(new ApiError("Thư viện chiến thuật chỉ dành cho tài khoản.", 401, "UNAUTHORIZED"));
    vi.spyOn(guestBotLibraryApi, "getBotLibrary").mockResolvedValue({ bots: [], quotaBytes: 262144, usedBytes: 0 });
    renderWithProviders(<BotWorkbenchPage />, "/bot-lab");
    expect(await screen.findByText(/Thư viện Guest lưu riêng/)).toBeInTheDocument();
    expect(screen.getByText("Chưa có chiến thuật nào")).toBeInTheDocument();
  });
  it("does not disguise a server outage as Guest library fallback", async () => {
    vi.spyOn(botLibraryApi, "getBotLibrary").mockRejectedValueOnce(new ApiError("Máy chủ tạm lỗi.", 503, "UNAVAILABLE"));
    const guest = vi.spyOn(guestBotLibraryApi, "getBotLibrary"); guest.mockClear();
    renderWithProviders(<BotWorkbenchPage />, "/bot-lab");
    expect(await screen.findByRole("alert")).toHaveTextContent("Máy chủ tạm lỗi.");
    expect(guest).not.toHaveBeenCalled();
  });
});
