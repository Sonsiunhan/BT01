import { getJson } from "../../../services/http/httpClient";
import { getOfflineKitStatus, type OfflineKitStatus } from "../../../services/local/offlineKit";

export interface OfflineModeEntry {
  id: string;
  title: string;
  description: string;
  route: string;
  status: "ACTIVE" | "DISABLED" | "COMING_SOON";
}

export interface OfflineCapabilitiesResponse {
  capabilities: {
    "offline.hub.read": boolean;
    "offline.bot.read": boolean;
    "offline.practice.humanBot": boolean;
    "offline.practice.humanHuman": boolean;
  };
  runtime: {
    status: string;
    policy: string;
    isolation: string;
  };
  modes: OfflineModeEntry[];
}

export async function getOfflineCapabilities(signal?: AbortSignal): Promise<OfflineCapabilitiesResponse> {
  try {
    return await getJson("/admin/offline/capabilities", signal) as OfflineCapabilitiesResponse;
  } catch {
    // Fallback capabilities for offline / network degraded mode
    return {
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
    };
  }
}

export async function checkOfflineKit(): Promise<OfflineKitStatus> {
  return await getOfflineKitStatus();
}
