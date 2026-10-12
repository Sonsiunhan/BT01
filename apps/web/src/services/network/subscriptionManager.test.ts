import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SubscriptionManager } from "./subscriptionManager";
import { NetworkStore, type NetworkConnectionState } from "./networkStore";

class MockEventSource {
  public url: string;
  public readyState = 0; // CONNECTING
  public onopen: (() => void) | null = null;
  public onmessage: ((e: MessageEvent) => void) | null = null;
  public onerror: ((e: Event) => void) | null = null;
  public listeners: Record<string, ((e: any) => void)[]> = {};
  public isClosed = false;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = 1; // OPEN
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
    this.readyState = 2; // CLOSED
  }
}

describe("L04-W2 Subscription Manager & Network Store (SYNC-06)", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", MockEventSource as any);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("network store exposes 5 canonical states and notifies subscribers", () => {
    const store = new NetworkStore("CONNECTING");
    const states: NetworkConnectionState[] = [];

    const unsubscribe = store.subscribe((state) => states.push(state));

    store.setState("SYNCED");
    store.setState("RECONNECTING");
    store.setState("READ_ONLY");
    store.setState("FATAL");

    expect(states).toEqual(["SYNCED", "RECONNECTING", "READ_ONLY", "FATAL"]);
    unsubscribe();
  });

  it("shares a single EventSource connection across multiple consumers (reference counting)", async () => {
    const manager = new SubscriptionManager();

    const sub1 = manager.acquire("MATCH", "room-1", "/matches/room-1/events");
    const sub2 = manager.acquire("MATCH", "room-1", "/matches/room-1/events");

    // Only 1 underlying connection created
    expect(manager.activeConnectionCount).toBe(1);
    expect(manager.getConsumerCount("MATCH", "room-1")).toBe(2);

    // Release first consumer
    sub1.release();
    expect(manager.activeConnectionCount).toBe(1);
    expect(manager.getConsumerCount("MATCH", "room-1")).toBe(1);

    // Release second consumer
    sub2.release();

    // After cleanup window, connection is closed
    await new Promise((r) => setTimeout(r, 60));
    expect(manager.activeConnectionCount).toBe(0);
  });

  it("withstands React StrictMode remount without tearing down connection", async () => {
    const manager = new SubscriptionManager({ teardownGraceMs: 50 });

    const sub1 = manager.acquire("ROOM", "room-2", "/rooms/room-2/events");
    // StrictMode unmounts:
    sub1.release();

    // Immediate remount within grace period:
    const sub2 = manager.acquire("ROOM", "room-2", "/rooms/room-2/events");
    expect(manager.activeConnectionCount).toBe(1);

    await new Promise((r) => setTimeout(r, 60));
    // Connection stayed alive!
    expect(manager.activeConnectionCount).toBe(1);

    sub2.release();
    await new Promise((r) => setTimeout(r, 60));
    expect(manager.activeConnectionCount).toBe(0);
  });

  describe("SYNC-07 Client Session and Role Revocation", () => {
    it("handles revocation event from EventSource, sets FATAL, invokes cache cleaner, and halts reconnect", async () => {
      const manager = new SubscriptionManager();
      let cacheCleared = false;
      manager.onClearCache(() => {
        cacheCleared = true;
      });

      let currentState: NetworkConnectionState = "CONNECTING";
      const lease = manager.acquire("MATCH", "room-rev", "/matches/room-rev/events", {
        onStateChange: (state) => {
          currentState = state;
        },
      });

      await new Promise((r) => setTimeout(r, 10));
      expect(currentState).toBe("SYNCED");

      // Trigger revocation
      manager.revoke("MATCH", "room-rev", "SESSION_REVOKED");

      expect(currentState).toBe("FATAL");
      expect(lease.networkStore.isTerminal).toBe(true);
      expect(cacheCleared).toBe(true);

      // Verify no reconnect happens
      await new Promise((r) => setTimeout(r, 100));
      expect(currentState).toBe("FATAL");

      lease.release();
    });

    it("transitions to READ_ONLY when role is revoked", async () => {
      const manager = new SubscriptionManager();
      let currentState: NetworkConnectionState = "CONNECTING";
      const lease = manager.acquire("MATCH", "room-role", "/matches/room-role/events", {
        onStateChange: (state) => {
          currentState = state;
        },
      });

      await new Promise((r) => setTimeout(r, 10));
      expect(currentState).toBe("SYNCED");

      manager.revoke("MATCH", "room-role", "ROLE_REVOKED");
      expect(currentState).toBe("READ_ONLY");

      lease.release();
    });

    it("revokes all active connections when ottv2:session-expired is dispatched", async () => {
      const manager = new SubscriptionManager();
      const states: NetworkConnectionState[] = [];

      const lease = manager.acquire("MATCH", "room-exp", "/matches/room-exp/events", {
        onStateChange: (s) => states.push(s),
      });

      await new Promise((r) => setTimeout(r, 10));

      // Dispatch global session expired
      window.dispatchEvent(new CustomEvent("ottv2:session-expired"));

      expect(lease.networkStore.state).toBe("FATAL");
      expect(lease.networkStore.reason).toBe("SESSION_EXPIRED");

      lease.release();
    });
  });
});

