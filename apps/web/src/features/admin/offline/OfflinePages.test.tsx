import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OfflineHubPage from "./OfflineHubPage";
import OfflineBotsPage from "./OfflineBotsPage";
import OfflinePracticeHumanHumanPage from "./OfflinePracticeHumanHumanPage";
import OfflinePracticeHumanBotPage from "./OfflinePracticeHumanBotPage";
import * as offlineApi from "./offlineApi";
import * as botLibraryApi from "../../../services/bot-library/botLibraryApi";

vi.mock("./offlineApi", () => ({
  getOfflineCapabilities: vi.fn(),
  checkOfflineKit: vi.fn(),
}));

vi.mock("../../../services/bot-library/botLibraryApi", () => ({
  getBotLibrary: vi.fn(),
  createBot: vi.fn(),
  testBotRevision: vi.fn(),
}));

vi.mock("../../../services/bot-offline/botOfflineRunner", () => ({
  runOfflineBotTurn: vi.fn().mockResolvedValue({
    move: { from: "d2", to: "d3" },
    memory: null,
    computeMs: 15,
  }),
}));

describe("S08 — Offline Tools Frontend Components", () => {
  it("AC-S08-01: OfflineHubPage renders header, runtime banner, and four mode entries", async () => {
    vi.mocked(offlineApi.getOfflineCapabilities).mockResolvedValue({
      capabilities: {
        "offline.hub.read": true,
        "offline.bot.read": true,
        "offline.practice.humanBot": true,
        "offline.practice.humanHuman": true,
      },
      runtime: {
        status: "READY",
        policy: "NO_SERVER_RUNNER",
        isolation: "BROWSER_WORKER_CPYTHON",
      },
      modes: [
        {
          id: "BOT_LIBRARY",
          title: "Kho Bot của tôi",
          description: "Quản lí danh sách mã nguồn Bot cá nhân và theo dõi trạng thái tương thích.",
          route: "/admin/offline/bots",
          status: "ACTIVE",
        },
        {
          id: "BOT_VS_BOT",
          title: "Đấu Bot Offline (Bot – Bot)",
          description: "Môi trường giả lập hai Bot thi đấu đối kháng trực tiếp trong trình duyệt.",
          route: "/dau-chuong-trinh/offline",
          status: "ACTIVE",
        },
        {
          id: "PRACTICE_HUMAN_BOT",
          title: "Phòng tập Người – Bot",
          description: "Môi trường thi đấu luyện tập cục bộ giữa người chơi và Bot Python trong sandbox an toàn.",
          route: "/admin/offline/practice/human-bot",
          status: "ACTIVE",
        },
        {
          id: "PRACTICE_HUMAN_HUMAN",
          title: "Phòng tập Người – Người",
          description: "Chế độ chơi hai người trên cùng một thiết bị với bàn cờ Robot Lab.",
          route: "/admin/offline/practice/human-human",
          status: "ACTIVE",
        },
      ],
    });
    vi.mocked(offlineApi.checkOfflineKit).mockResolvedValue({
      ready: true,
      version: "1.0.0",
      cached: 5,
      total: 5,
      missing: [],
      message: "Sẵn sàng",
    });

    render(
      <MemoryRouter>
        <OfflineHubPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Trung tâm công cụ Offline")).toBeInTheDocument();
      expect(screen.getByText("Kho Bot của tôi")).toBeInTheDocument();
      expect(screen.getByText("Đấu Bot Offline (Bot – Bot)")).toBeInTheDocument();
      expect(screen.getByText("Phòng tập Người – Bot")).toBeInTheDocument();
      expect(screen.getByText("Phòng tập Người – Người")).toBeInTheDocument();
    });

    expect(screen.getByText("Cục bộ · Cô lập")).toBeInTheDocument();
  });

  it("AC-S08-02: OfflineHubPage displays access denied when missing offline.hub.read", async () => {
    vi.mocked(offlineApi.getOfflineCapabilities).mockResolvedValue({
      capabilities: {
        "offline.hub.read": false,
        "offline.bot.read": false,
        "offline.practice.humanBot": false,
        "offline.practice.humanHuman": false,
      },
      runtime: {
        status: "READY",
        policy: "NO_SERVER_RUNNER",
        isolation: "BROWSER_WORKER_CPYTHON",
      },
      modes: [],
    });
    vi.mocked(offlineApi.checkOfflineKit).mockResolvedValue({
      ready: false,
      version: "1.0.0",
      cached: 0,
      total: 5,
      missing: ["pyodide"],
      message: "Chưa tải kit",
    });

    render(
      <MemoryRouter>
        <OfflineHubPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Từ chối quyền truy cập")).toBeInTheDocument();
      expect(screen.getByText(/Tài khoản của bạn không có quyền/)).toBeInTheDocument();
    });
  });

  it("AC-S08-03: OfflineBotsPage displays bot library and upload control", async () => {
    vi.mocked(botLibraryApi.getBotLibrary).mockResolvedValue({
      quotaBytes: 1048576,
      usedBytes: 120,
      bots: [
        {
          id: "bot-admin-1",
          name: "Test Bot Admin",
          usedBytes: 120,
          createdAt: "2026-10-23T10:00:00.000Z",
          updatedAt: "2026-10-23T10:00:00.000Z",
          revisions: [
            {
              id: "rev-1",
              revisionNumber: 1,
              sourceDigest: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
              sourceBytes: 120,
              status: "READY",
              sdkVersion: "bot-sdk-v1",
              schemaVersion: "bot-state-v1",
              createdAt: "2026-10-23T10:00:00.000Z",
              updatedAt: "2026-10-23T10:00:00.000Z",
              memoryPolicy: "RESET_ON_NEW_REVISION",
              availability: ["OFFLINE"],
            },
          ],
        },
      ],
    });

    render(
      <MemoryRouter>
        <OfflineBotsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Kho Bot của tôi" })).toBeInTheDocument();
      expect(screen.getByText("Test Bot Admin")).toBeInTheDocument();
      expect(screen.getByText("Preflight Check")).toBeInTheDocument();
      expect(screen.getByText("Đấu trong Bot Offline")).toBeInTheDocument();
    });
  });

  it("AC-S08-04: OfflinePracticeHumanHumanPage renders 2P pass and play board", () => {
    render(
      <MemoryRouter>
        <OfflinePracticeHumanHumanPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Phòng tập Người – Người (Pass & Play)")).toBeInTheDocument();
    expect(screen.getByText("XANH (PLAYER 1)")).toBeInTheDocument();
    expect(screen.getByText("ĐỎ (PLAYER 2)")).toBeInTheDocument();
    expect(screen.getByText("Ván mới")).toBeInTheDocument();
  });

  it("AC-S08-05: OfflinePracticeHumanBotPage renders Human vs Bot arena", () => {
    render(
      <MemoryRouter>
        <OfflinePracticeHumanBotPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Phòng tập Người – Bot (Offline)")).toBeInTheDocument();
    expect(screen.getByText("XANH (BẠN)")).toBeInTheDocument();
    expect(screen.getByText("ĐỎ (BOT)")).toBeInTheDocument();
    expect(screen.getByText("Ván mới")).toBeInTheDocument();
  });
});
