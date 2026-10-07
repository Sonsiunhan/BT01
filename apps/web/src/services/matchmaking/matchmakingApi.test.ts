import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../http/apiError";
import { joinMatchmakingQueue } from "./matchmakingApi";

const mocks = vi.hoisted(() => ({
  requestJson: vi.fn(),
  getMe: vi.fn(),
  ensureGuestSession: vi.fn(),
}));

vi.mock("../http/httpClient", () => ({ getJson: vi.fn(), requestJson: mocks.requestJson }));
vi.mock("../auth/authApi", () => ({ getMe: mocks.getMe }));
vi.mock("../guest/guestApi", () => ({ ensureGuestSession: mocks.ensureGuestSession }));
vi.mock("../session/clientIdentity", () => ({ getClientId: () => "client-p2" }));

describe("P2 Bot queue handshake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mocks.getMe.mockResolvedValue({ user: { id: "account-p2" } });
    mocks.ensureGuestSession.mockResolvedValue({ principal: "GUEST" });
    mocks.requestJson.mockResolvedValue({ queue: { queueId: "queue-p2" } });
  });

  it("sends the tested server Bot/revision IDs and never the local Guest IDs for an account", async () => {
    sessionStorage.setItem("ottv2:bot-queue-selection", JSON.stringify({ botId: "server-bot", revisionId: "server-rev", localBotId: "guest-bot", localRevisionId: "guest-rev" }));
    await joinMatchmakingQueue("BOT");
    expect(mocks.requestJson).toHaveBeenCalledWith("/matchmaking/queue", expect.objectContaining({
      method: "POST",
      body: { mode: "BOT", botId: "server-bot", revisionId: "server-rev" },
      headers: { "X-Client-Id": "client-p2" },
    }));
    expect(mocks.ensureGuestSession).not.toHaveBeenCalled();
  });

  it("bootstraps Guest and pins the expected principal while preserving the staged server IDs", async () => {
    mocks.getMe.mockRejectedValue(new ApiError("Guest", 401, "UNAUTHORIZED"));
    sessionStorage.setItem("ottv2:bot-queue-selection", JSON.stringify({ botId: "server-bot", revisionId: "server-rev", localBotId: "guest-bot", localRevisionId: "guest-rev" }));
    await joinMatchmakingQueue("BOT");
    expect(mocks.ensureGuestSession).toHaveBeenCalledTimes(1);
    expect(mocks.requestJson).toHaveBeenCalledWith("/matchmaking/queue", expect.objectContaining({
      body: { mode: "BOT", botId: "server-bot", revisionId: "server-rev" },
      headers: { "X-Client-Id": "client-p2", "X-Expected-Principal": "GUEST" },
    }));
  });

  it("keeps the Guest principal pin even when a stale cache lacks the local marker", async () => {
    mocks.getMe.mockRejectedValue(new ApiError("Guest", 401, "UNAUTHORIZED"));
    sessionStorage.setItem("ottv2:bot-queue-selection", JSON.stringify({ botId: "server-bot", revisionId: "server-rev" }));
    await joinMatchmakingQueue("BOT");
    expect(mocks.requestJson).toHaveBeenCalledWith("/matchmaking/queue", expect.objectContaining({ headers: { "X-Client-Id": "client-p2", "X-Expected-Principal": "GUEST" } }));
  });

  it("does not attach Bot selection fields to the ordinary queue", async () => {
    await joinMatchmakingQueue("UNRANKED");
    expect(mocks.requestJson).toHaveBeenCalledWith("/matchmaking/queue", expect.objectContaining({ body: { mode: "UNRANKED" } }));
  });
});
