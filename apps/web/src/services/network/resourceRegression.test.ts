import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DomainEventEnvelope } from "@ottv2/contracts";

import { SubscriptionManager } from "./subscriptionManager";
import { type PulseMessage } from "./reconciler";

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

describe("L04-W3 Resource Regression & Metrics (SYNC-09)", () => {
  let manager: SubscriptionManager;

  beforeEach(() => {
    vi.stubGlobal("EventSource", MockEventSource as any);
    manager = new SubscriptionManager({ teardownGraceMs: 30 });
  });

  afterEach(() => {
    manager.closeAll();
    vi.unstubAllGlobals();
  });

  it("verifies byte budget for domain events and clock pulses", () => {
    const moveEnvelope: DomainEventEnvelope = {
      protocolVersion: "0.2",
      messageId: "123e4567-e89b-12d3-a456-426614174000",
      type: "MOVE",
      timestamp: 1728640000000,
      scope: "MATCH",
      targetId: "ROOM-1234",
      sequence: 14,
      stateVersion: 28,
      payload: {
        from: "E2",
        to: "E3",
        side: "BLUE",
        piece: "R",
      },
    };

    const serializedMove = JSON.stringify(moveEnvelope);
    const moveBytes = new TextEncoder().encode(serializedMove).length;
    // SLO: Move event must be compact (< 350 bytes)
    expect(moveBytes).toBeLessThan(350);

    const pulse: PulseMessage = {
      anchorMs: 1728640001000,
      clocksMs: { BLUE: 29500, RED: 30000 },
      serverTime: 1728640001050,
    };
    const serializedPulse = JSON.stringify(pulse);
    const pulseBytes = new TextEncoder().encode(serializedPulse).length;
    // SLO: Pulse message must be minimal (< 120 bytes)
    expect(pulseBytes).toBeLessThan(120);
  });

  it("proves bounded stream count and zero memory leak across 10 consumer leases", async () => {
    const leases = [];
    const consumerCount = 10;

    // 10 components subscribe to the same match
    for (let i = 0; i < consumerCount; i++) {
      leases.push(
        manager.acquire("MATCH", "room-stress", "/matches/room-stress/events")
      );
    }

    // Invariant: Exactly 1 underlying connection is opened!
    expect(manager.activeConnectionCount).toBe(1);
    expect(manager.getConsumerCount("MATCH", "room-stress")).toBe(10);

    // Release 9 consumers
    for (let i = 0; i < 9; i++) {
      leases[i]?.release();
    }
    expect(manager.activeConnectionCount).toBe(1);
    expect(manager.getConsumerCount("MATCH", "room-stress")).toBe(1);

    // Release the final consumer
    leases[9]?.release();

    // After the teardown grace period (30ms), connection must be 0
    await new Promise((r) => setTimeout(r, 50));
    expect(manager.activeConnectionCount).toBe(0);
    expect(manager.getConsumerCount("MATCH", "room-stress")).toBe(0);
  });

  it("handles a burst of 200 events with low event-loop lag and listener isolation", async () => {
    let receivedCount = 0;
    const errorsCaught: any[] = [];

    const lease1 = manager.acquire("MATCH", "room-burst", "/matches/room-burst/events", {
      onEvent: () => {
        // Failing listener must not break other listeners
        throw new Error("Deliberate consumer fault");
      },
    });

    const lease2 = manager.acquire("MATCH", "room-burst", "/matches/room-burst/events", {
      onEvent: () => {
        receivedCount += 1;
      },
    });

    await new Promise((r) => setTimeout(r, 10));

    const startTime = performance.now();
    // Simulate high-frequency event stream dispatch
    for (let i = 0; i < 200; i++) {
      const msg = new MessageEvent("message", {
        data: JSON.stringify({ sequence: i + 1, type: "MOVE" }),
      });
      // Find underlying active event source
      const es = (manager as any).connections.get("MATCH:room-burst")?.eventSource;
      es?.onmessage?.(msg);
    }
    const elapsedMs = performance.now() - startTime;

    // Fast dispatch (< 50ms for 200 events)
    expect(elapsedMs).toBeLessThan(50);
    // Successful listener received all 200 events without interruption
    expect(receivedCount).toBe(200);

    lease1.release();
    lease2.release();
  });
});
