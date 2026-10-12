import { describe, expect, it, vi } from "vitest";
import { DeadlineScheduler, type ScheduledDeadline } from "../../src/modules/match/scheduler/index.js";

describe("DeadlineScheduler unit tests", () => {
  it("registers rooms and checks existence accurately", () => {
    const scheduler = new DeadlineScheduler();
    expect(scheduler.has("room-1")).toBe(false);

    scheduler.registerRoom("room-1");
    expect(scheduler.has("room-1")).toBe(true);

    scheduler.unregisterRoom("room-1");
    expect(scheduler.has("room-1")).toBe(false);
  });

  it("schedules, executes, and cancels deadlines by key and category", () => {
    vi.useFakeTimers();
    try {
      let now = 10_000;
      const scheduler = new DeadlineScheduler(() => now);

      let turnExecuted = false;
      let disconnectExecuted = false;

      scheduler.schedule({
        roomId: "room-1",
        key: "turn",
        category: "TURN",
        dueAt: 15_000,
        onDue: () => { turnExecuted = true; },
      });

      scheduler.schedule({
        roomId: "room-1",
        key: "disconnect:user-1",
        category: "DISCONNECT",
        dueAt: 20_000,
        onDue: () => { disconnectExecuted = true; },
      });

      expect(scheduler.has("room-1", "turn")).toBe(true);
      expect(scheduler.has("room-1", "disconnect:user-1")).toBe(true);
      expect(scheduler.getDeadlines("room-1")).toHaveLength(2);

      // Advance by 5s to t=15_000 (turn deadline expires)
      now += 5_000;
      vi.advanceTimersByTime(5_000);
      expect(turnExecuted).toBe(true);
      expect(disconnectExecuted).toBe(false);
      expect(scheduler.has("room-1", "turn")).toBe(false);

      // Cancel category DISCONNECT before t=20_000
      scheduler.cancelCategory("room-1", "DISCONNECT");
      expect(scheduler.has("room-1", "disconnect:user-1")).toBe(false);

      // Advance past t=20_000
      now += 10_000;
      vi.advanceTimersByTime(10_000);
      expect(disconnectExecuted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("starts and stops room interval ticks cleanly", () => {
    vi.useFakeTimers();
    try {
      const scheduler = new DeadlineScheduler();
      let ticks = 0;

      scheduler.startRoom("room-2", () => {
        ticks += 1;
      });

      vi.advanceTimersByTime(3_000);
      expect(ticks).toBe(3);

      scheduler.stopRoom("room-2");
      vi.advanceTimersByTime(3_000);
      expect(ticks).toBe(3); // does not increase after stopRoom

      // But room is still registered until unregisterRoom
      expect(scheduler.has("room-2")).toBe(true);
      scheduler.unregisterRoom("room-2");
      expect(scheduler.has("room-2")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stop() clears all rooms, timers, and scheduled deadlines", () => {
    vi.useFakeTimers();
    try {
      const scheduler = new DeadlineScheduler();
      scheduler.startRoom("room-a", () => {});
      scheduler.schedule({
        roomId: "room-a",
        key: "resume",
        category: "RESUME",
        dueAt: Date.now() + 5000,
        onDue: () => {},
      });

      expect(scheduler.has("room-a")).toBe(true);
      scheduler.stop();
      expect(scheduler.has("room-a")).toBe(false);
      expect(scheduler.getDeadlines("room-a")).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
