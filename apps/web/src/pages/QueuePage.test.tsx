import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { transferableAbortController } from "node:util";
import { createMemoryRouter, Link, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchmakingEventEnvelope, MatchmakingSnapshot } from "@ottv2/contracts";

import QueuePage from "./QueuePage";
import * as matchmakingApi from "../services/matchmaking/matchmakingApi";
import { ApiError } from "../services/http/apiError";
import { ToastProvider } from "../components/ui";

vi.mock("../services/matchmaking/matchmakingApi", () => ({ joinRankedQueue: vi.fn(), joinMatchmakingQueue: vi.fn(), getQueue: vi.fn(), cancelQueue: vi.fn(), subscribeToQueue: vi.fn() }));

function renderQueue(strict = false, mode = "RANKED") {
  const element = <><Link to="/">Đi tới trang chủ</Link><QueuePage /></>;
  const router = createMemoryRouter([
    { path: "/queue", element: strict ? <StrictMode>{element}</StrictMode> : element },
    { path: "/", element: <h1>Sảnh</h1> },
    { path: "/dau-chuong-trinh/online", element: <h1>Bot Online</h1> },
    { path: "/room/:roomId", element: <h1>Phòng đã ghép</h1> },
  ], { initialEntries: ["/", `/queue${mode !== "RANKED" ? `?mode=${mode}` : ""}`] });
  return { ...render(<ToastProvider><RouterProvider router={router} /></ToastProvider>), router };
}

const queue: MatchmakingSnapshot = {
  queueId: "00000000-0000-4000-8000-000000000005", mode: "RANKED", status: "QUEUED",
  player: { userId: "u1", username: "blue", displayName: "Blue", elo: 1000 }, opponent: null,
  range: 100, elapsedMs: 0, joinedAt: 1000, roomId: null, matchId: null,
};
const matched: MatchmakingSnapshot = {
  ...queue, status: "MATCHED", roomId: "ABC234", matchId: "00000000-0000-4000-8000-000000000006",
  opponent: { userId: "u2", username: "red", displayName: "Red", elo: 1000 },
};
const botQueue: MatchmakingSnapshot = { ...queue, mode: "BOT" };
const botMatched: MatchmakingSnapshot = { ...matched, mode: "BOT" };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => { resolve = accept; });
  return { promise, resolve };
}

describe("R1 queue exit", () => {
  it("enqueues the ordinary mode rather than silently joining Ranked", async () => {
    vi.mocked(matchmakingApi.joinMatchmakingQueue).mockResolvedValue({ queue: { ...queue, mode: "UNRANKED" } });
    renderQueue(false, "UNRANKED");
    await screen.findByRole("heading", { name: "Đang tìm đối thủ" });
    expect(matchmakingApi.joinMatchmakingQueue).toHaveBeenCalledWith("UNRANKED");
    expect(matchmakingApi.joinRankedQueue).not.toHaveBeenCalled();
    expect(screen.queryByText("GHÉP TRẬN XẾP HẠNG")).not.toBeInTheDocument();
  });
  beforeEach(() => {
    // jsdom signals are not accepted by Node's native Request, used by the data router.
    vi.stubGlobal("AbortController", class {
      private controller = transferableAbortController();
      signal = this.controller.signal;
      abort(reason?: unknown) { this.controller.abort(reason); }
    });
    vi.clearAllMocks();
    vi.mocked(matchmakingApi.joinRankedQueue).mockResolvedValue({ queue });
    vi.mocked(matchmakingApi.joinMatchmakingQueue).mockResolvedValue({ queue: botQueue });
    vi.mocked(matchmakingApi.subscribeToQueue).mockReturnValue(vi.fn());
    vi.mocked(matchmakingApi.getQueue).mockResolvedValue({ queue });
    vi.mocked(matchmakingApi.cancelQueue).mockResolvedValue({ queue: { ...queue, status: "CANCELLED" } });
  });
  afterEach(async () => { cleanup(); await new Promise((resolve) => window.setTimeout(resolve, 5)); vi.unstubAllGlobals(); });

  it("uses a calm, explicit search stage instead of a decorative radar", async () => {
    renderQueue();
    await screen.findByRole("heading", { name: "Đang tìm đối thủ" });
    expect(screen.getByText("GIAI ĐOẠN TÌM TRẬN")).toBeInTheDocument();
    expect(screen.getByText("Máy chủ đang ghép cặp phù hợp. Bạn có thể huỷ bất cứ lúc nào.")).toBeInTheDocument();
    expect(screen.getByText("ĐANG TÌM")).toBeInTheDocument();
    expect(document.querySelectorAll(".scanner-ring")).toHaveLength(0);
    expect(document.querySelector(".queue-visual-shell")).toBeInTheDocument();
    expect(document.querySelector('[data-robot="queue-host"]')).toBeInTheDocument();
  });

  it("keeps Bot queue unranked and routes a found room through Bot revision selection", async () => {
    vi.mocked(matchmakingApi.joinMatchmakingQueue).mockResolvedValue({ queue: botMatched });
    vi.mocked(matchmakingApi.getQueue).mockResolvedValue({ queue: botMatched });
    const { router } = renderQueue(false, "BOT");
    await waitFor(() => expect(router.state.location.pathname).toBe("/dau-chuong-trinh/online"));
  });

  it("does not invent Elo for a Bot match-found screen", async () => {
    vi.mocked(matchmakingApi.joinMatchmakingQueue).mockResolvedValue({ queue: botMatched });
    vi.mocked(matchmakingApi.getQueue).mockResolvedValue({ queue: botMatched });
    renderQueue(false, "BOT");
    await screen.findByRole("heading", { name: "ĐÃ TÌM THẤY ĐỐI THỦ" });
    expect(screen.getAllByText(/Không xếp hạng/)).toHaveLength(2);
    expect(screen.queryByText(/1000 Elo/)).not.toBeInTheDocument();
  });

  it("awaits authoritative cancellation for Về sảnh and disables duplicate exits", async () => {
    const response = deferred<{ queue: MatchmakingSnapshot }>();
    const cancel = vi.mocked(matchmakingApi.cancelQueue).mockReturnValue(response.promise);
    const { router } = renderQueue();
    fireEvent.click(await screen.findByRole("button", { name: "Về sảnh" }));
    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
    expect(router.state.location.pathname).toBe("/queue");
    expect(screen.getByRole("button", { name: "Đang huỷ…" })).toBeDisabled();
    await act(async () => response.resolve({ queue: { ...queue, status: "CANCELLED" } }));
    expect(router.state.location.pathname).toBe("/");
  });

  it("cleans up an admission that resolves after the page leaves", async () => {
    const admission = deferred<{ queue: MatchmakingSnapshot }>();
    vi.mocked(matchmakingApi.joinRankedQueue).mockReturnValue(admission.promise);
    const view = renderQueue();
    view.unmount();
    await act(async () => admission.resolve({ queue }));
    await waitFor(() => expect(matchmakingApi.cancelQueue).toHaveBeenCalledWith(queue.queueId));
  });

  it("resyncs canonical status after a failed cancellation without claiming success", async () => {
    vi.mocked(matchmakingApi.cancelQueue).mockRejectedValue(new ApiError("Mất kết nối"));
    vi.mocked(matchmakingApi.getQueue).mockResolvedValue({ queue: matched });
    const { router } = renderQueue();
    fireEvent.click(await screen.findByRole("button", { name: "Huỷ tìm trận" }));
    await screen.findByRole("heading", { name: "ĐÃ TÌM THẤY ĐỐI THỦ" });
    expect(screen.getByText("ĐÃ GHÉP ĐỐI THỦ")).toBeInTheDocument();
    expect(screen.getByText("Blue")).toBeInTheDocument();
    expect(screen.getByText("Red")).toBeInTheDocument();
    expect(screen.getByText("XANH")).toBeInTheDocument();
    expect(screen.getByText("ĐỎ")).toBeInTheDocument();
    expect(matchmakingApi.getQueue).toHaveBeenCalledWith(queue.queueId);
    await waitFor(() => expect(router.state.location.pathname).toBe("/room/ABC234"));
  });

  it("ignores a foreign generation even when its sequence is newer", async () => {
    let onEvent!: (event: MatchmakingEventEnvelope) => void;
    vi.mocked(matchmakingApi.subscribeToQueue).mockImplementation((_id, receive) => { onEvent = receive; return vi.fn(); });
    const { router } = renderQueue();
    await screen.findByRole("heading", { name: "Đang tìm đối thủ" });
    await act(async () => onEvent({ protocolVersion: "0.1", messageId: "00000000-0000-4000-8000-000000000007", type: "MATCH_FOUND", timestamp: 1000, sequence: 100, queueId: "00000000-0000-4000-8000-000000000099", payload: { ...matched, queueId: "00000000-0000-4000-8000-000000000099" } }));
    expect(screen.getByRole("heading", { name: "Đang tìm đối thủ" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/queue");
  });

  it.each(["link", "back"])("blocks %s navigation until cancellation is acknowledged", async (kind) => {
    const response = deferred<{ queue: MatchmakingSnapshot }>();
    vi.mocked(matchmakingApi.cancelQueue).mockReturnValue(response.promise);
    const { router } = renderQueue();
    await screen.findByRole("heading", { name: "Đang tìm đối thủ" });
    if (kind === "link") fireEvent.click(screen.getByRole("link", { name: "Đi tới trang chủ" }));
    else await act(async () => { void router.navigate(-1); });
    await waitFor(() => expect(matchmakingApi.cancelQueue).toHaveBeenCalledTimes(1));
    expect(router.state.location.pathname).toBe("/queue");
    await act(async () => response.resolve({ queue: { ...queue, status: "CANCELLED" } }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("blocks query-mode navigation until the current queue is cancelled", async () => {
    const response = deferred<{ queue: MatchmakingSnapshot }>();
    vi.mocked(matchmakingApi.cancelQueue).mockReturnValue(response.promise);
    const { router } = renderQueue(false, "RANKED");
    await screen.findByRole("heading", { name: "Đang tìm đối thủ" });
    await act(async () => { void router.navigate("/queue?mode=BOT"); });
    await waitFor(() => expect(matchmakingApi.cancelQueue).toHaveBeenCalledTimes(1));
    expect(router.state.location.search).toBe("");
    await act(async () => response.resolve({ queue: { ...queue, status: "CANCELLED" } }));
    await waitFor(() => expect(router.state.location.search).toBe("?mode=BOT"));
  });

  it("resets the admission generation after a mode change and cancels the new queue", async () => {
    const firstCancel = deferred<{ queue: MatchmakingSnapshot }>();
    const secondCancel = deferred<{ queue: MatchmakingSnapshot }>();
    const nextQueue: MatchmakingSnapshot = { ...botQueue, queueId: "00000000-0000-4000-8000-000000000009" };
    vi.mocked(matchmakingApi.joinMatchmakingQueue).mockResolvedValue({ queue: nextQueue });
    vi.mocked(matchmakingApi.cancelQueue).mockReturnValueOnce(firstCancel.promise).mockReturnValue(secondCancel.promise);
    const { router } = renderQueue(false, "RANKED");
    await screen.findByRole("heading", { name: "Đang tìm đối thủ" });
    await act(async () => { void router.navigate("/queue?mode=BOT"); });
    await waitFor(() => expect(matchmakingApi.cancelQueue).toHaveBeenCalledWith(queue.queueId));
    await act(async () => firstCancel.resolve({ queue: { ...queue, status: "CANCELLED" } }));
    await waitFor(() => expect(router.state.location.search).toBe("?mode=BOT"));
    await waitFor(() => expect(matchmakingApi.joinMatchmakingQueue).toHaveBeenCalledWith("BOT"));
    await screen.findByText("GHÉP BOT ONLINE · KHÔNG XẾP HẠNG");

    await act(async () => { void router.navigate("/queue?mode=RANKED"); });
    await waitFor(() => expect(matchmakingApi.cancelQueue).toHaveBeenCalledWith(nextQueue.queueId));
    expect(router.state.location.search).toBe("?mode=BOT");
    await act(async () => secondCancel.resolve({ queue: { ...nextQueue, status: "CANCELLED" } }));
    await waitFor(() => expect(router.state.location.search).toBe("?mode=RANKED"));
  });

  it("does not cancel an admission reused by StrictMode effect remount", async () => {
    const admission = deferred<{ queue: MatchmakingSnapshot }>();
    vi.mocked(matchmakingApi.joinRankedQueue).mockReturnValue(admission.promise);
    renderQueue(true);
    await act(async () => admission.resolve({ queue }));
    await screen.findByRole("heading", { name: "Đang tìm đối thủ" });
    expect(matchmakingApi.joinRankedQueue).toHaveBeenCalledTimes(1);
    expect(matchmakingApi.cancelQueue).not.toHaveBeenCalled();
  });

  it("waits for a pending join and cancels its returned generation before leaving", async () => {
    const admission = deferred<{ queue: MatchmakingSnapshot }>();
    vi.mocked(matchmakingApi.joinRankedQueue).mockReturnValue(admission.promise);
    const { router } = renderQueue();
    fireEvent.click(screen.getByRole("link", { name: "Đi tới trang chủ" }));
    expect(router.state.location.pathname).toBe("/queue");
    await act(async () => admission.resolve({ queue }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(matchmakingApi.cancelQueue).toHaveBeenCalledTimes(1);
    expect(matchmakingApi.cancelQueue).toHaveBeenCalledWith(queue.queueId);
  });

  it("recognizes a cancellation whose response was lost from the canonical snapshot", async () => {
    vi.mocked(matchmakingApi.cancelQueue).mockRejectedValue(new ApiError("Mất kết nối"));
    vi.mocked(matchmakingApi.getQueue).mockResolvedValue({ queue: { ...queue, status: "CANCELLED" } });
    const { router } = renderQueue();
    fireEvent.click(await screen.findByRole("button", { name: "Huỷ tìm trận" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(matchmakingApi.getQueue).toHaveBeenCalledWith(queue.queueId);
  });

  it("keeps the queued page and retry enabled when cancellation cannot be confirmed", async () => {
    vi.mocked(matchmakingApi.cancelQueue).mockRejectedValue(new ApiError("Không kết nối được"));
    vi.mocked(matchmakingApi.getQueue).mockRejectedValue(new ApiError("Chưa đồng bộ được"));
    const { router } = renderQueue();
    await screen.findByRole("heading", { name: "Đang tìm đối thủ" });
    fireEvent.click(screen.getByRole("link", { name: "Đi tới trang chủ" }));
    await screen.findByRole("alert");
    expect(router.state.location.pathname).toBe("/queue");
    await waitFor(() => expect(screen.getByRole("button", { name: "Huỷ tìm trận" })).toBeEnabled());
    expect(screen.queryByText("Đã huỷ tìm trận.")).not.toBeInTheDocument();
  });

  it("resyncs a temporary transport loss without cancelling the queued admission", async () => {
    let onError!: () => void;
    vi.mocked(matchmakingApi.subscribeToQueue).mockImplementation((_id, _receive, fail) => { onError = fail; return vi.fn(); });
    renderQueue();
    await screen.findByRole("heading", { name: "Đang tìm đối thủ" });
    await act(async () => onError());
    expect(matchmakingApi.getQueue).toHaveBeenCalledWith(queue.queueId);
    expect(matchmakingApi.cancelQueue).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Đang tìm đối thủ" })).toBeInTheDocument();
  });

  it("recovers a committed match on SSE reconnect without sending cancellation", async () => {
    let onOpen!: () => void;
    vi.mocked(matchmakingApi.subscribeToQueue).mockImplementation((_id, _receive, _fail, open) => { onOpen = open!; return vi.fn(); });
    vi.mocked(matchmakingApi.getQueue).mockResolvedValue({ queue: matched });
    const { router } = renderQueue();
    await screen.findByRole("heading", { name: "Đang tìm đối thủ" });
    await act(async () => onOpen());
    await waitFor(() => expect(router.state.location.pathname).toBe("/room/ABC234"));
    expect(matchmakingApi.cancelQueue).not.toHaveBeenCalled();
  });
});
