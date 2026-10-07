import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import BotOfflinePage from "./BotOfflinePage";
import * as botLibraryApi from "../services/bot-library/botLibraryApi";
import { clearBotOfflineSession, getBotOfflineSession, setBotOfflineSession } from "../services/local/localGameStorage";
import { createInitialState } from "@ottv2/game-rules";
import { runOfflineBotTurn } from "../services/bot-offline/botOfflineRunner";
const runtimeGate = vi.hoisted(() => ({ ready: false, message: "Tạm khóa chạy Python Offline: sandbox của ứng dụng chưa được kiểm chứng." }));

vi.mock("../services/local/offlineKit", () => ({
  getOfflineKitStatus: vi.fn().mockResolvedValue({ version: "r11-test", ready: true, cached: 5, total: 5, missing: [], message: "Offline kit đã sẵn sàng trên thiết bị này." }),
  installOfflineKit: vi.fn().mockResolvedValue({ version: "r11-test", ready: true, cached: 5, total: 5, missing: [], message: "Offline kit đã sẵn sàng trên thiết bị này." }),
}));
vi.mock("../services/bot-offline/botOfflineRunner", () => ({
  OFFLINE_RUNTIME_STATUS: runtimeGate,
  BotOfflineRunnerError: class extends Error { code = "TEST"; },
  runOfflineBotTurn: vi.fn().mockResolvedValue({ move: { from: "b1", to: "b2" }, memory: { turns: 1 } }),
}));

describe("R11 Bot Offline", () => {
  beforeEach(() => { runtimeGate.ready = false; });
  it("can resume a restored match using a validated pending replacement without resetting the board", async () => {
    runtimeGate.ready = true;
    const source = "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n";
    await setBotOfflineSession({ state: createInitialState(), clocks: { BLUE: 30000, RED: 30000 }, history: [], memories: { BLUE: null, RED: null }, slots: { BLUE: { source, fileName: "blue.py", revision: "old-blue", ready: true }, RED: { source, fileName: "red.py", revision: "old-red", ready: true } }, pendingSlots: { BLUE: { source: source + "# pending\n", fileName: "blue.py", revision: "new-blue", ready: true } }, status: "PAUSED", speedMs: 450, savedAt: new Date().toISOString() });
    vi.mocked(runOfflineBotTurn).mockClear().mockImplementation(async input => ({ move: input.state.legalMoves[0]!, memory: null, computeMs: 1 }));
    renderWithProviders(<BotOfflinePage />, "/dau-chuong-trinh/offline");
    await screen.findByText(/Đã khôi phục checkpoint/);
    for (const button of screen.getAllByRole("button", { name: "Kiểm tra" })) fireEvent.click(button);
    await waitFor(() => { for (const button of screen.getAllByRole("button", { name: "Sẵn sàng" })) expect(button).not.toBeDisabled(); });
    for (const button of screen.getAllByRole("button", { name: "Sẵn sàng" })) fireEvent.click(button);
    let complete!: (value: Awaited<ReturnType<typeof runOfflineBotTurn>>) => void;
    vi.mocked(runOfflineBotTurn).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "Chạy" }));
    await waitFor(() => expect(runOfflineBotTurn).toHaveBeenCalledTimes(3));
    fireEvent.click(screen.getByRole("button", { name: "Tạm dừng" }));
    complete({ move: { from: "a1", to: "a2" }, memory: null, computeMs: 1 });
    await waitFor(async () => expect((await getBotOfflineSession())?.history).toHaveLength(1));
    expect((await getBotOfflineSession())?.slots.BLUE.revision).toBe("new-blue");
    await clearBotOfflineSession();
  });
  it("keeps Step single-flight and disables Run until the current invocation finishes", async () => {
    await clearBotOfflineSession(); runtimeGate.ready = true;
    vi.mocked(runOfflineBotTurn).mockImplementation(async input => ({ move: input.state.legalMoves[0]!, memory: null, computeMs: 1 }));
    renderWithProviders(<BotOfflinePage />, "/dau-chuong-trinh/offline");
    await screen.findByRole("heading", { name: "Bot Offline" });
    for (const button of screen.getAllByRole("button", { name: "Bot mẫu" })) fireEvent.click(button);
    for (const button of screen.getAllByRole("button", { name: "Kiểm tra" })) fireEvent.click(button);
    await waitFor(() => { for (const button of screen.getAllByRole("button", { name: "Sẵn sàng" })) expect(button).not.toBeDisabled(); });
    for (const button of screen.getAllByRole("button", { name: "Sẵn sàng" })) fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: "Ván mới" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Từng nước" })).not.toBeDisabled());
    let complete!: (value: Awaited<ReturnType<typeof runOfflineBotTurn>>) => void;
    vi.mocked(runOfflineBotTurn).mockClear().mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "Từng nước" }));
    await screen.findByText("Đang tính lượt Xanh…");
    expect(screen.getByRole("button", { name: "Chạy" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Từng nước" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Chạy" }));
    expect(runOfflineBotTurn).toHaveBeenCalledTimes(1);
    complete({ move: { from: "a1", to: "a2" }, memory: null, computeMs: 1 });
    await waitFor(async () => expect((await getBotOfflineSession())?.history).toHaveLength(1));
    await clearBotOfflineSession();
  });
  it("activates an immutable pending revision only on its next own turn and resets memory", async () => {
    await clearBotOfflineSession(); runtimeGate.ready = true;
    vi.mocked(runOfflineBotTurn).mockImplementation(async input => ({ move: input.state.legalMoves[0]!, memory: { count: 1 }, computeMs: 1 }));
    renderWithProviders(<BotOfflinePage />, "/dau-chuong-trinh/offline");
    await screen.findByRole("heading", { name: "Bot Offline" });
    for (const button of screen.getAllByRole("button", { name: "Bot mẫu" })) fireEvent.click(button);
    for (const button of screen.getAllByRole("button", { name: "Kiểm tra" })) fireEvent.click(button);
    await waitFor(() => { for (const button of screen.getAllByRole("button", { name: "Sẵn sàng" })) expect(button).not.toBeDisabled(); });
    for (const button of screen.getAllByRole("button", { name: "Sẵn sàng" })) fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: "Ván mới" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Từng nước" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Từng nước" }));
    await waitFor(async () => expect((await getBotOfflineSession())?.history).toHaveLength(1));
    const activeRevision = (await getBotOfflineSession())!.slots.BLUE.revision;
    fireEvent.change(screen.getAllByRole("textbox")[0]!, { target: { value: "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n# updated\n" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Kiểm tra" })[0]!);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Sẵn sàng" })[0]).not.toBeDisabled());
    fireEvent.click(screen.getAllByRole("button", { name: "Sẵn sàng" })[0]!);
    await waitFor(async () => {
      const saved = await getBotOfflineSession();
      expect(saved?.pendingSlots?.BLUE?.ready).toBe(true);
      expect(saved?.slots.BLUE.revision).toBe(activeRevision);
      expect(saved?.history).toHaveLength(1);
    });
    fireEvent.click(screen.getByRole("button", { name: "Từng nước" }));
    await waitFor(async () => expect((await getBotOfflineSession())?.history).toHaveLength(2));
    expect((await getBotOfflineSession())?.slots.BLUE.revision).toBe(activeRevision);
    expect((await getBotOfflineSession())?.pendingSlots?.BLUE?.ready).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Từng nước" }));
    await waitFor(async () => expect((await getBotOfflineSession())?.history).toHaveLength(3));
    expect((await getBotOfflineSession())?.slots.BLUE.revision).not.toBe(activeRevision);
    expect((await getBotOfflineSession())?.pendingSlots?.BLUE).toBeUndefined();
    expect(vi.mocked(runOfflineBotTurn).mock.calls.at(-1)?.[0].memory).toBeNull();
    await clearBotOfflineSession();
  });
  it("preserves memory only when the pending revision declares the same schema and the player opts in", async () => {
    await clearBotOfflineSession(); runtimeGate.ready = true;
    const sourceV1 = "# ottv2-memory-schema: sample-v1\ndef choose_move(state, memory):\n    return state['legal_moves'][0], memory\n";
    const sourceV2 = "# ottv2-memory-schema: sample-v1\ndef choose_move(state, memory):\n    return state['legal_moves'][0], memory\n# revision-2\n";
    const calls: Array<{ source: string; memory: unknown }> = [];
    vi.mocked(runOfflineBotTurn).mockImplementation(async input => {
      calls.push({ source: input.source, memory: input.memory });
      const previous = input.memory && typeof input.memory === "object" && "counter" in input.memory ? Number((input.memory as { counter?: unknown }).counter) : 0;
      return { move: input.state.legalMoves[0]!, memory: { counter: previous + 1 }, computeMs: 1 };
    });
    renderWithProviders(<BotOfflinePage />, "/dau-chuong-trinh/offline");
    await screen.findByRole("heading", { name: "Bot Offline" });
    for (const button of screen.getAllByRole("button", { name: "Bot mẫu" })) fireEvent.click(button);
    // Replace both samples with a declared compatible schema so the policy is explicit.
    fireEvent.change(screen.getAllByRole("textbox")[0]!, { target: { value: sourceV1 } });
    fireEvent.change(screen.getAllByRole("textbox")[1]!, { target: { value: sourceV1 } });
    for (const button of screen.getAllByRole("button", { name: "Kiểm tra" })) fireEvent.click(button);
    await waitFor(() => { for (const button of screen.getAllByRole("button", { name: "Sẵn sàng" })) expect(button).not.toBeDisabled(); });
    for (const button of screen.getAllByRole("button", { name: "Sẵn sàng" })) fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: "Ván mới" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Từng nước" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Từng nước" }));
    await waitFor(async () => expect((await getBotOfflineSession())?.history).toHaveLength(1));
    const firstBlueMemory = calls.find(call => call.source === sourceV1 && call.memory === null);
    expect(firstBlueMemory).toBeDefined();

    fireEvent.change(screen.getAllByRole("textbox")[0]!, { target: { value: sourceV2 } });
    const preserve = screen.getAllByRole("checkbox")[0]!;
    expect(preserve).not.toBeDisabled();
    fireEvent.click(preserve);
    expect(preserve).toBeChecked();
    fireEvent.click(screen.getAllByRole("button", { name: "Kiểm tra" })[0]!);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Sẵn sàng" })[0]).not.toBeDisabled());
    fireEvent.click(screen.getAllByRole("button", { name: "Sẵn sàng" })[0]!);
    await waitFor(async () => expect((await getBotOfflineSession())?.pendingSlots?.BLUE?.memoryPolicy).toBe("PRESERVE_IF_COMPATIBLE"));

    // Red's turn does not activate Blue's pending revision; the following Blue turn must retain counter=1.
    fireEvent.click(screen.getByRole("button", { name: "Từng nước" }));
    await waitFor(async () => expect((await getBotOfflineSession())?.history).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "Từng nước" }));
    await waitFor(async () => expect((await getBotOfflineSession())?.history).toHaveLength(3));
    const activatedBlueCall = calls.filter(call => call.source === sourceV2).at(-1);
    expect(activatedBlueCall?.memory).toEqual({ counter: 1 });
    expect((await getBotOfflineSession())?.pendingSlots?.BLUE).toBeUndefined();
    await clearBotOfflineSession();
  });
  it("preserves restored source/checkpoint but clears stale Ready and disables execution", async () => {
    const source = "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n";
    await setBotOfflineSession({
      state: createInitialState(), clocks: { BLUE: 30000, RED: 30000 }, history: [],
      memories: { BLUE: { retained: true }, RED: null },
      slots: { BLUE: { source, fileName: "blue.py", revision: "rev-blue", ready: true }, RED: { source, fileName: "red.py", revision: "rev-red", ready: true } },
      status: "PAUSED", speedMs: 450, savedAt: new Date().toISOString(),
    });
    renderWithProviders(<BotOfflinePage />, "/dau-chuong-trinh/offline");
    await screen.findByText(/Đã khôi phục checkpoint/);
    expect(screen.getAllByRole("textbox")[0]).toHaveValue(source);
    for (const button of screen.getAllByRole("button", { name: "Sẵn sàng" })) expect(button).toBeDisabled();
    for (const name of ["Ván mới", "Chạy", "Từng nước"]) expect(screen.getByRole("button", { name })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Xuất checkpoint" })).not.toBeDisabled();
    await clearBotOfflineSession();
  });
  it("imports an owner-scoped Workbench selection into exactly one unready local slot", async () => {
    await clearBotOfflineSession();
    const source = "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n";
    const getSource = vi.spyOn(botLibraryApi, "getBotSource").mockResolvedValue({ botId: "bot-1", revisionId: "rev-1", source });
    renderWithProviders(<BotOfflinePage />, "/dau-chuong-trinh/offline?botId=bot-1&revisionId=rev-1");
    fireEvent.click(await screen.findByRole("button", { name: "Nạp vào slot Xanh" }));
    await waitFor(() => expect(screen.getAllByRole("textbox")[0]).toHaveValue(source));
    expect(screen.getAllByRole("textbox")[1]).toHaveValue("");
    expect(getSource).toHaveBeenCalledWith("bot-1", "rev-1", expect.anything());
    expect(screen.getAllByRole("button", { name: "Sẵn sàng" })[0]).toBeDisabled();
    expect(screen.getByRole("button", { name: "Từng nước" })).toBeDisabled();
    getSource.mockRestore();
  });
  it("shows offline kit, two independent slots and safe observation controls", async () => {
    renderWithProviders(<BotOfflinePage />, "/dau-chuong-trinh/offline");
    expect(await screen.findByRole("heading", { name: "Bot Offline" })).toBeInTheDocument();
    expect(document.querySelector(".robot-lab-bot-offline")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Offline kit" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Bot Xanh" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Bot Đỏ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xuất checkpoint" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Từng nước" })).toBeDisabled();
    fireEvent.click(screen.getAllByRole("button", { name: "Bot mẫu" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Kiểm tra" })[0]);
    expect(await screen.findByText(/Kiểm tra tĩnh SDK đạt; chưa phải preflight thực thi/)).toBeInTheDocument();
  });

  it("never grants Ready from static validation or executes a bot while sandbox is unproven", async () => {
    vi.mocked(runOfflineBotTurn).mockClear();
    renderWithProviders(<BotOfflinePage />, "/dau-chuong-trinh/offline");
    await screen.findByRole("heading", { name: "Bot Offline" });
    for (const button of screen.getAllByRole("button", { name: "Bot mẫu" })) fireEvent.click(button);
    for (const button of screen.getAllByRole("button", { name: "Kiểm tra" })) fireEvent.click(button);
    for (const button of screen.getAllByRole("button", { name: "Sẵn sàng" })) expect(button).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ván mới" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Từng nước" })).toBeDisabled();
    expect(runOfflineBotTurn).not.toHaveBeenCalled();
  });
});
