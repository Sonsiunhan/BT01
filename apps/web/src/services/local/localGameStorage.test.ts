import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "@ottv2/game-rules";
import { clearLocalSession, clearBotOfflineSession, getBotOfflineSession, getGuestProfile, getLocalSession, migrateLegacyGuestSessionToOffline, setBotOfflineSession, setLocalSession, type BotOfflineSessionSnapshot, type LocalSessionSnapshot } from "./localGameStorage";

describe("local session persistence", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips an in-progress mode and clears it after leave/finish", async () => {
    const session: LocalSessionSnapshot = {
      mode: "OFFLINE",
      setup: { blueName: "Xanh", redName: "Đỏ", timerSeconds: 60 },
      state: createInitialState(),
      clocks: { BLUE: 52, RED: 60 },
      remaining: 52,
      savedAt: new Date().toISOString(),
    };
    await setLocalSession(session);
    await expect(getLocalSession("OFFLINE")).resolves.toMatchObject({ mode: "OFFLINE", remaining: 52, setup: session.setup });
    await clearLocalSession("OFFLINE");
    await expect(getLocalSession("OFFLINE")).resolves.toBeNull();
  });

  it("creates one stable Guest identity when no profile exists", async () => {
    await expect(getGuestProfile()).resolves.toMatchObject({ displayName: expect.stringMatching(/^Khách /) });
    const first = await getGuestProfile();
    const second = await getGuestProfile();
    expect(first).toEqual(second);
  });

  it("copies a legacy Guest session into Offline2P without deleting the source", async () => {
    const legacy: LocalSessionSnapshot = {
      mode: "GUEST",
      setup: { blueName: "Khách", redName: "Đỏ", timerSeconds: 60 },
      state: createInitialState(),
      clocks: { BLUE: 52, RED: 60 },
      remaining: 52,
      savedAt: new Date().toISOString(),
    };
    await setLocalSession(legacy);
    const migrated = await migrateLegacyGuestSessionToOffline();
    expect(migrated?.mode).toBe("OFFLINE");
    await expect(getLocalSession("GUEST")).resolves.toMatchObject({ mode: "GUEST" });
    await expect(getLocalSession("OFFLINE")).resolves.toMatchObject({ mode: "OFFLINE" });
    await clearLocalSession("OFFLINE");
    await expect(migrateLegacyGuestSessionToOffline()).resolves.toBeNull();
  });

  it("persists Bot Offline checkpoints as paused and can clear them", async () => {
    const checkpoint: BotOfflineSessionSnapshot = {
      state: createInitialState(),
      clocks: { BLUE: 30_000, RED: 30_000 },
      history: [],
      memories: { BLUE: { turns: 0 }, RED: null },
      slots: {
        BLUE: { source: "def choose_move(state, memory):\\n    return state['legal_moves'][0], memory", fileName: "blue.py", revision: "r1", ready: true },
        RED: { source: "def choose_move(state, memory):\\n    return state['legal_moves'][0], memory", fileName: "red.py", revision: "r1", ready: true },
      },
      status: "RUNNING",
      speedMs: 450,
      savedAt: new Date().toISOString(),
    };
    await setBotOfflineSession(checkpoint);
    await expect(getBotOfflineSession()).resolves.toMatchObject({ status: "PAUSED", slots: { BLUE: { revision: "r1" } } });
    await clearBotOfflineSession();
    await expect(getBotOfflineSession()).resolves.toBeNull();
  });

  it("surfaces local storage quota failure instead of silently losing a checkpoint", async () => {
    vi.stubGlobal("indexedDB", undefined);
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("quota", "QuotaExceededError"); });
    await expect(setBotOfflineSession({
      state: createInitialState(), clocks: { BLUE: 30_000, RED: 30_000 }, history: [], memories: { BLUE: null, RED: null },
      slots: { BLUE: { source: "", fileName: "blue.py", revision: "r1", ready: false }, RED: { source: "", fileName: "red.py", revision: "r1", ready: false } },
      status: "PAUSED", speedMs: 450, savedAt: new Date().toISOString(),
    })).rejects.toThrow("LOCAL_STORAGE_QUOTA");
    setItem.mockRestore();
    vi.unstubAllGlobals();
  });

  it("does not acknowledge a saved session before its IndexedDB transaction commits", async () => {
    const request: { onsuccess?: () => void; result?: undefined } = {};
    const transaction: { oncomplete?: () => void; objectStore: () => { put: () => typeof request } } = { objectStore: () => ({ put: () => request }) };
    const close = vi.fn();
    const opening: { onsuccess?: () => void; result: unknown } = { result: { transaction: () => transaction, close } };
    vi.stubGlobal("indexedDB", { open: () => { queueMicrotask(() => opening.onsuccess?.()); return opening; } });
    try {
      let acknowledged = false;
      const save = setLocalSession({ mode: "OFFLINE", setup: { blueName: "Xanh", redName: "Đỏ", timerSeconds: 60 }, state: createInitialState(), clocks: { BLUE: 60, RED: 60 }, remaining: 60, savedAt: new Date().toISOString() }).then(() => { acknowledged = true; });
      await vi.waitFor(() => expect(request.onsuccess).toBeTypeOf("function"));
      request.onsuccess?.();
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(acknowledged).toBe(false);
      transaction.oncomplete?.();
      await save;
      expect(acknowledged).toBe(true);
      expect(close).toHaveBeenCalledOnce();
    } finally { vi.unstubAllGlobals(); }
  });
});

