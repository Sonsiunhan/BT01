import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearLocalData, exportLocalData, getLocalDataSummary } from "./localData";

vi.mock("./offlineKit", () => ({
  clearOfflineKit: vi.fn(async () => undefined),
  getOfflineKitStatus: vi.fn(async () => ({ version: "r15-test", ready: true, cached: 5, total: 5, missing: [], message: "sẵn sàng" })),
}));

describe("R15 local data controls", () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it("exports local-only data without account/cloud fields", async () => {
    const exported = await exportLocalData();
    expect(exported.scope).toBe("LOCAL_DEVICE_ONLY");
    expect(exported).not.toHaveProperty("account");
    expect(exported).not.toHaveProperty("password");
    expect(exported).toHaveProperty("guestProfile");
    expect(exported).toHaveProperty("offlineKit");
  });

  it("reports the exact clear categories and blocks an active local session", async () => {
    const summary = await getLocalDataSummary();
    expect(summary.categories).toEqual(["Guest identity", "Local saves", "Local history", "Bot Offline library", "Offline cache"]);
    localStorage.setItem("ottv2.local.active-session", JSON.stringify({ mode: "OFFLINE", state: { status: "PLAYING" } }));
    await expect(clearLocalData()).rejects.toMatchObject({ code: "ACTIVE_LOCAL_SESSION" });
  });

  it("clears only device stores after the active-session guard passes", async () => {
    localStorage.setItem("ottv2.local.profile", JSON.stringify({ displayName: "Guest-Old" }));
    localStorage.setItem("ottv2.local.history", JSON.stringify([{ localId: "h1" }]));
    await clearLocalData();
    expect(localStorage.getItem("ottv2.local.profile")).toBeNull();
    expect(localStorage.getItem("ottv2.local.history")).toBeNull();
  });
});
