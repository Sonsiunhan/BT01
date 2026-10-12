import { describe, expect, it } from "vitest";
import { MatchLane } from "../../src/modules/match/lane/match-lane.js";
import { AppError } from "../../src/shared/errors/app-error.js";

describe("MatchLane (L05-W2 — Per-match Serialized Bounded Lane)", () => {
  it("executes tasks strictly sequentially in FIFO order without interleaving", async () => {
    const lane = new MatchLane({ roomId: "room-1" });
    const order: number[] = [];

    const task1 = lane.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push(1);
      return "one";
    });

    const task2 = lane.enqueue(async () => {
      order.push(2);
      return "two";
    });

    const task3 = lane.enqueue(async () => {
      order.push(3);
      return "three";
    });

    const results = await Promise.all([task1, task2, task3]);
    expect(results).toEqual(["one", "two", "three"]);
    expect(order).toEqual([1, 2, 3]);
  });

  it("enforces bounded queue depth and rejects with 429 when maxQueueDepth is exceeded", async () => {
    const lane = new MatchLane({ roomId: "room-limit", maxQueueDepth: 2 });

    // Block the queue with a slow task
    let unblock!: () => void;
    const hanging = new Promise<void>((resolve) => { unblock = resolve; });
    const blocker = lane.enqueue(() => hanging);

    // Enqueue 2 tasks (up to maxQueueDepth = 2)
    const taskA = lane.enqueue(async () => "a");
    const taskB = lane.enqueue(async () => "b");

    // 3rd task exceeds depth 2 -> must reject with RATE_LIMITED / 429
    await expect(lane.enqueue(async () => "overflow")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      statusCode: 429,
    });

    unblock();
    await Promise.all([blocker, taskA, taskB]);
  });

  it("locks on UNKNOWN commit outcome and rejects subsequent mutations until unlocked", async () => {
    const lane = new MatchLane({ roomId: "room-unknown" });

    lane.lockOnUnknown("TRANSACTION_TIMEOUT");
    expect(lane.isLocked).toBe(true);

    await expect(lane.enqueue(async () => "should-not-run")).rejects.toMatchObject({
      code: "CONFLICT",
      statusCode: 409,
    });

    lane.unlock();
    expect(lane.isLocked).toBe(false);

    const result = await lane.enqueue(async () => "recovered");
    expect(result).toBe("recovered");
  });

  it("clears pending queue on room teardown and rejects pending tasks with CONFLICT", async () => {
    const lane = new MatchLane({ roomId: "room-clear" });

    let unblock!: () => void;
    const hanging = new Promise<void>((resolve) => { unblock = resolve; });
    const blocker = lane.enqueue(() => hanging);

    const pending = lane.enqueue(async () => "pending-task");
    lane.clear();

    await expect(pending).rejects.toMatchObject({
      code: "CONFLICT",
    });

    unblock();
    await blocker;
  });
});
