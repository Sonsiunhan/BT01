import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchSnapshot } from "@ottv2/contracts";

import { useMatchNetwork, getNetworkBannerProps } from "./useMatchNetwork";
import { SubscriptionManager } from "./subscriptionManager";

class MockEventSource {
  public url: string;
  public readyState = 0;
  public onopen: (() => void) | null = null;
  public onmessage: ((e: MessageEvent) => void) | null = null;
  public onerror: ((e: Event) => void) | null = null;
  public listeners: Record<string, ((e: any) => void)[]> = {};
  public isClosed = false;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = 1;
      this.onopen?.();
    }, 0);
  }

  addEventListener(type: string, listener: (e: any) => void) {
    this.listeners[type] = this.listeners[type] ?? [];
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (e: any) => void) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
    }
  }

  close() {
    this.isClosed = true;
    this.readyState = 2;
  }
}

const mockSnapshot: MatchSnapshot = {
  matchId: "123e4567-e89b-12d3-a456-426614174000",
  roomId: "TEST01",
  mode: "UNRANKED",
  status: "PLAYING",
  players: [
    { userId: "u1", username: "u1", displayName: "Blue Player", side: "BLUE", ready: true, connected: true },
    { userId: "u2", username: "u2", displayName: "Red Player", side: "RED", ready: true, connected: true },
  ],
  board: {},
  pieceCounts: { BLUE: { R: 6, P: 6, S: 6 }, RED: { R: 6, P: 6, S: 6 } },
  currentTurn: "BLUE",
  winner: null,
  resultReason: null,
  clocksMs: { BLUE: 30000, RED: 30000 },
  timerSeconds: 30,
  countdownEndsAt: null,
  sequence: 5,
  stateVersion: 10,
  rating: null,
};

describe("L04-W3 Page Adapter Hook & Banner (SYNC-08)", () => {
  let manager: SubscriptionManager;

  beforeEach(() => {
    vi.stubGlobal("EventSource", MockEventSource as any);
    manager = new SubscriptionManager();
  });

  afterEach(() => {
    manager.closeAll();
    vi.unstubAllGlobals();
  });

  it("subscribes to match room and establishes SYNCED connection state", async () => {
    const { result } = renderHook(() =>
      useMatchNetwork({
        roomId: "room-abc",
        initialSnapshot: mockSnapshot,
        subscriptionManager: manager,
      })
    );

    expect(result.current.networkState).toBe("CONNECTING");
    expect(result.current.watermarkSequence).toBe(5);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.networkState).toBe("SYNCED");
    expect(result.current.bannerProps.visible).toBe(false);
  });

  it("handles PAUSED status and locks gameplay", () => {
    const { result } = renderHook(() =>
      useMatchNetwork({
        roomId: "room-abc",
        initialSnapshot: { ...mockSnapshot, status: "PAUSED" },
        subscriptionManager: manager,
      })
    );

    expect(result.current.isPaused).toBe(true);
    expect(result.current.isTerminal).toBe(false);
  });

  it("locks TERMINAL state: once FINISHED, late pulse or responses cannot restore PLAYING", () => {
    const { result } = renderHook(() =>
      useMatchNetwork({
        roomId: "room-abc",
        initialSnapshot: { ...mockSnapshot, status: "FINISHED", winner: "BLUE", resultReason: "EXTINCTION" },
        subscriptionManager: manager,
      })
    );

    expect(result.current.isTerminal).toBe(true);

    // Attempt to apply a late snapshot with PLAYING
    act(() => {
      result.current.applySnapshot({ ...mockSnapshot, status: "PLAYING" });
    });

    // Invariant: MUST remain FINISHED / terminal
    expect(result.current.isTerminal).toBe(true);
    expect(result.current.snapshot?.status).toBe("FINISHED");
  });

  it("resets state and reconnects cleanly on Rematch (roomId change)", async () => {
    let currentRoom = "room-1";
    const { result, rerender } = renderHook(() =>
      useMatchNetwork({
        roomId: currentRoom,
        initialSnapshot: mockSnapshot,
        subscriptionManager: manager,
      })
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(manager.getConsumerCount("MATCH", "room-1")).toBe(1);

    // Rematch to new room:
    currentRoom = "room-2";
    rerender();

    expect(manager.getConsumerCount("MATCH", "room-2")).toBe(1);

    // Old room consumer released after teardown window
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(manager.getConsumerCount("MATCH", "room-1")).toBe(0);
  });

  it("getNetworkBannerProps preserves accessible attributes without focus stealing", () => {
    const connectingBanner = getNetworkBannerProps("CONNECTING");
    expect(connectingBanner.role).toBe("status");
    expect(connectingBanner["aria-live"]).toBe("polite");
    expect(connectingBanner.tabIndex).toBe(-1);
    expect(connectingBanner.visible).toBe(true);
    expect(connectingBanner.message).toContain("Đang đồng bộ");

    const fatalBanner = getNetworkBannerProps("FATAL", "SESSION_EXPIRED");
    expect(fatalBanner.role).toBe("status");
    expect(fatalBanner["aria-live"]).toBe("polite");
    expect(fatalBanner.tabIndex).toBe(-1);
    expect(fatalBanner.variant).toBe("danger");
    expect(fatalBanner.message).toContain("Phiên đăng nhập đã hết hạn");

    const syncedBanner = getNetworkBannerProps("SYNCED");
    expect(syncedBanner.visible).toBe(false);
  });
});
