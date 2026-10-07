import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BotOnlinePage from "./BotOnlinePage";
import { ApiError } from "../services/http/apiError";

const mocks = vi.hoisted(() => ({
  getMe: vi.fn(), getBotLibrary: vi.fn(), getBotSdkDocs: vi.fn(), createBot: vi.fn(), testBotRevision: vi.fn(), createRoom: vi.fn(), getBotOnline: vi.fn(), selectBotOnline: vi.fn(), navigate: vi.fn(), guestLibrary: vi.fn(), guestSource: vi.fn(), ensureGuest: vi.fn(), stage: vi.fn(), guestTest: vi.fn(), guestSdkDocs: vi.fn(), guestCreateBot: vi.fn(),
}));

vi.mock("../services/auth/authApi", () => ({ getMe: mocks.getMe }));
vi.mock("../services/bot-library/botLibraryApi", () => ({ getBotLibrary: mocks.getBotLibrary, getBotSdkDocs: mocks.getBotSdkDocs, createBot: mocks.createBot, testBotRevision: mocks.testBotRevision }));
vi.mock("../services/rooms/roomApi", () => ({ createRoom: mocks.createRoom }));
vi.mock("../services/bot-online/botOnlineApi", () => ({ getBotOnline: mocks.getBotOnline, selectBotOnline: mocks.selectBotOnline }));
vi.mock("../services/guest/guestApi", () => ({ ensureGuestSession: mocks.ensureGuest }));
vi.mock("../services/bot-library/guestBotLibrary", () => ({ guestBotLibraryApi: { getBotLibrary: mocks.guestLibrary, getBotSource: mocks.guestSource, getBotSdkDocs: mocks.guestSdkDocs, createBot: mocks.guestCreateBot } }));
vi.mock("../services/bot-library/guestOnlineBotApi", () => ({ stageGuestOnlineBot: mocks.stage, testGuestOnlineBot: mocks.guestTest }));
vi.mock("react-router-dom", async () => { const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom"); return { ...actual, useNavigate: () => mocks.navigate }; });

const bot = { id: "bot-1", name: "Bot mẫu", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), usedBytes: 70, revisions: [{ id: "rev-1", revisionNumber: 1, status: "READY", sdkVersion: "1", schemaVersion: "1", sourceDigest: "a".repeat(64), sourceBytes: 70, memoryPolicy: "RESET_ON_NEW_REVISION", availability: ["ONLINE"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] };

describe("R10 Bot Online preparation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mocks.getMe.mockResolvedValue({ user: { id: "u1" } });
    mocks.getBotLibrary.mockResolvedValue({ bots: [bot], quotaBytes: 262144, usedBytes: 70 });
    mocks.getBotSdkDocs.mockResolvedValue({ template: "def choose_move(state, memory): return state['legal_moves'][0], memory" });
    mocks.createBot.mockResolvedValue({ bot, revision: bot.revisions[0] });
    mocks.testBotRevision.mockResolvedValue({ revision: { ...bot.revisions[0], status: "PASSED" }, legalPreview: [], privateLog: [] });
    mocks.createRoom.mockResolvedValue({ room: { roomId: "ABC123" } });
    mocks.getBotOnline.mockResolvedValue({ snapshot: { status: "WAITING_READY" } });
    mocks.selectBotOnline.mockResolvedValue({ snapshot: {} });
  });

  it("lets an empty library load the sample before matchmaking", async () => {
    mocks.getBotLibrary.mockResolvedValue({ bots: [], quotaBytes: 262144, usedBytes: 0 });
    render(<MemoryRouter><BotOnlinePage /></MemoryRouter>);
    await screen.findByText("Chưa có bot trong thư viện");
    fireEvent.click(screen.getByRole("button", { name: "Dùng bot mẫu" }));
    await waitFor(() => expect(mocks.createBot).toHaveBeenCalledWith(expect.objectContaining({ name: expect.stringContaining("Bot mẫu Robot Lab"), source: expect.stringContaining("choose_move") })));
  });

  it("keeps matchmaking separate from custom room configuration", async () => {
    render(<MemoryRouter><BotOnlinePage /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Chuẩn bị Bot Online" });
    expect(screen.queryByRole("checkbox", { name: "Có Trọng tài" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo phòng Bot Online" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tải file Python")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tìm trận Online" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Tạo phòng riêng" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra code" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Tìm trận Online" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Tìm trận Online" }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/queue?mode=BOT"));
    expect(mocks.createRoom).not.toHaveBeenCalled();
  });

  it("shows private test feedback without enabling matchmaking on failed code", async () => {
    mocks.testBotRevision.mockResolvedValueOnce({ revision: { ...bot.revisions[0], status: "FAILED", validationMessage: "Nước đi không hợp lệ." }, legalPreview: [], privateLog: ["Chọn một nước trong legal_moves."] });
    render(<MemoryRouter><BotOnlinePage /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Chuẩn bị Bot Online" });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra code" }));
    await screen.findByText("Chọn một nước trong legal_moves.");
    expect(screen.getByRole("button", { name: "Tìm trận Online" })).toBeDisabled();
  });

  it("stages only the selected local Guest revision, uses Online preflight and binds server IDs", async () => {
    mocks.getMe.mockRejectedValue(new ApiError("Guest", 401, "UNAUTHORIZED"));
    mocks.ensureGuest.mockResolvedValue({ principal: "GUEST" });
    const guestBot = { ...bot, id: "guest-bot:local", revisions: [{ ...bot.revisions[0], id: "guest-rev:local" }] };
    mocks.guestLibrary.mockResolvedValue({ bots: [guestBot] });
    mocks.guestSource.mockResolvedValue({ source: "FIXED_FIXTURE_SOURCE" });
    mocks.stage.mockResolvedValue({ bot: { id: "server-bot" }, revision: { id: "server-rev" } });
    mocks.guestTest.mockResolvedValue({ revision: { status: "PASSED" }, legalPreview: [], privateLog: [] });
    render(<MemoryRouter initialEntries={["/dau-chuong-trinh/online?custom=1"]}><BotOnlinePage /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Tạo phòng Bot riêng" });
    expect(mocks.stage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra code" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Tạo phòng Bot Online" })).not.toBeDisabled());
    expect(mocks.stage).toHaveBeenCalledWith({ name: "Bot mẫu", source: "FIXED_FIXTURE_SOURCE" });
    expect(mocks.guestTest).toHaveBeenCalledWith("server-bot", "server-rev");
    expect(mocks.testBotRevision).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Tạo phòng Bot Online" }));
    await waitFor(() => expect(mocks.selectBotOnline).toHaveBeenCalledWith("ABC123", { botId: "server-bot", revisionId: "server-rev" }));
  });

  it("revokes Guest preparation if login changes before creating a new room", async () => {
    mocks.getMe.mockRejectedValueOnce(new ApiError("Guest", 401));
    mocks.guestLibrary.mockResolvedValue({ bots: [{ ...bot, id: "guest-bot:local", revisions: [{ ...bot.revisions[0], id: "guest-rev:local" }] }] });
    mocks.guestSource.mockResolvedValue({ source: "FIXED_FIXTURE_SOURCE" });
    mocks.stage.mockResolvedValue({ bot: { id: "server-bot" }, revision: { id: "server-rev" } });
    mocks.guestTest.mockResolvedValue({ revision: { status: "PASSED" }, legalPreview: [], privateLog: [] });
    render(<MemoryRouter initialEntries={["/dau-chuong-trinh/online?custom=1"]}><BotOnlinePage /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Tạo phòng Bot riêng" });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra code" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Tạo phòng Bot Online" })).not.toBeDisabled());
    mocks.getMe.mockResolvedValue({ user: { id: "account-after-login" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo phòng Bot Online" }));
    await screen.findByText(/Bạn vừa đăng nhập/);
    expect(mocks.createRoom).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Tạo phòng Bot Online" })).toBeDisabled();
  });

  it("keeps a successful preflight when refreshed library objects have new identities", async () => {
    mocks.getBotLibrary.mockImplementation(async () => ({ bots: [structuredClone(bot)], quotaBytes: 262144, usedBytes: 70 }));
    render(<MemoryRouter initialEntries={["/dau-chuong-trinh/online?custom=1"]}><BotOnlinePage /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Tạo phòng Bot riêng" });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra code" }));
    await waitFor(() => expect(mocks.getBotLibrary).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "Tạo phòng Bot Online" })).not.toBeDisabled());
  });

  it("does not treat cached queue selection as preflight evidence", async () => {
    sessionStorage.setItem("ottv2:bot-queue-selection", JSON.stringify({ botId: "bot-1", revisionId: "rev-1" }));
    render(<MemoryRouter initialEntries={["/dau-chuong-trinh/online?room=ROOM42"]}><BotOnlinePage /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Chọn Bot vào phòng" });
    expect(screen.getByRole("button", { name: "Gắn Bot & vào phòng" })).toBeDisabled();
  });

  it("revokes previous readiness when a repeated preflight fails", async () => {
    render(<MemoryRouter initialEntries={["/dau-chuong-trinh/online?custom=1"]}><BotOnlinePage /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Tạo phòng Bot riêng" });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra code" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Tạo phòng Bot Online" })).not.toBeDisabled());
    mocks.testBotRevision.mockRejectedValueOnce(new Error("runtime unavailable"));
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra code" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Tạo phòng Bot Online" })).toBeDisabled();
  });

  it("requires preflight before creating the Bot room and exposes clear Robot Lab states", async () => {
    render(<MemoryRouter initialEntries={["/dau-chuong-trinh/online?custom=1"]}><BotOnlinePage /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Tạo phòng Bot riêng" })).toBeInTheDocument();
    expect(document.querySelector(".robot-lab-bot-online")).toBeInTheDocument();
    const create = screen.getByRole("button", { name: "Tạo phòng Bot Online" });
    expect(create).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra code" }));
    await waitFor(() => expect(mocks.testBotRevision).toHaveBeenCalledWith("bot-1", "rev-1"));
    await waitFor(() => expect(create).not.toBeDisabled());
    fireEvent.click(create);
    await waitFor(() => expect(mocks.createRoom).toHaveBeenCalledWith(expect.objectContaining({ playMode: "BOT", refereeEnabled: false }), expect.any(String), undefined));
    expect(mocks.selectBotOnline).toHaveBeenCalledWith("ABC123", { botId: "bot-1", revisionId: "rev-1" });
    expect(mocks.navigate).toHaveBeenCalledWith("/phong/ABC123");
  });

  it("routes a joined Bot room through the same preflight and slot selection gate", async () => {
    render(<MemoryRouter initialEntries={["/dau-chuong-trinh/online?room=ROOM42"]}><BotOnlinePage /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Chọn Bot vào phòng" })).toBeInTheDocument();
    const attach = screen.getByRole("button", { name: "Gắn Bot & vào phòng" });
    expect(attach).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra code" }));
    await waitFor(() => expect(attach).not.toBeDisabled());
    fireEvent.click(attach);
    await waitFor(() => expect(mocks.selectBotOnline).toHaveBeenCalledWith("ROOM42", { botId: "bot-1", revisionId: "rev-1" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/phong/ROOM42");
  });

  it("does not attach a stale queue selection after the room leaves the waiting state", async () => {
    render(<MemoryRouter initialEntries={["/dau-chuong-trinh/online?room=ROOM42"]}><BotOnlinePage /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Chọn Bot vào phòng" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra code" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Gắn Bot & vào phòng" })).not.toBeDisabled());
    mocks.getBotOnline.mockResolvedValueOnce({ snapshot: { status: "PLAYING" } });
    fireEvent.click(screen.getByRole("button", { name: "Gắn Bot & vào phòng" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Phòng đã bắt đầu"));
    expect(mocks.selectBotOnline).not.toHaveBeenCalled();
  });

  it("consumes the queue handoff after the server accepts the revision", async () => {
    sessionStorage.setItem("ottv2:bot-queue-selection", JSON.stringify({ botId: "bot-1", revisionId: "rev-1" }));
    render(<MemoryRouter initialEntries={["/dau-chuong-trinh/online?room=ROOM42"]}><BotOnlinePage /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Chọn Bot vào phòng" });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra code" }));
    const attach = await screen.findByRole("button", { name: "Gắn Bot & vào phòng" });
    await waitFor(() => expect(attach).not.toBeDisabled());
    fireEvent.click(attach);
    await waitFor(() => expect(mocks.selectBotOnline).toHaveBeenCalledWith("ROOM42", { botId: "bot-1", revisionId: "rev-1" }));
    expect(sessionStorage.getItem("ottv2:bot-queue-selection")).toBeNull();
  });
});
