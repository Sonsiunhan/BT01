import { describe, it, expect, beforeEach } from "vitest";
import { CapacityController } from "../../src/modules/capacity/capacity.controller.js";
import { DEFAULT_BUDGET_PROFILE_V0 } from "../../src/config/budget-profile.js";

describe("CapacityController Unit Tests (L-07.03)", () => {
  let controller: CapacityController;
  let simulatedTime: number;

  beforeEach(() => {
    simulatedTime = 1_000_000;
    controller = new CapacityController({
      profile: DEFAULT_BUDGET_PROFILE_V0,
      now: () => simulatedTime,
      thresholds: {
        highEventLoopLagMs: 50,
        lowEventLoopLagMs: 20,
        highHeapPercent: 85,
        lowHeapPercent: 70,
        highRssBytes: 1024 * 1024 * 1024,
        lowRssBytes: 800 * 1024 * 1024,
        cooldownPeriodMs: 5000,
        recoveryProbeBudget: 3,
        reconnectJitterMaxMs: 2000,
      },
    });
  });

  describe("Initial State", () => {
    it("starts in NORMAL state", () => {
      expect(controller.getState()).toBe("NORMAL");
      const status = controller.getStatus();
      expect(status.state).toBe("NORMAL");
      expect(status.consecutiveSuccessfulProbes).toBe(0);
    });

    it("admits lobby, pvp, and python within limits in NORMAL state", () => {
      const lobbyDecision = controller.checkAdmission("lobby", "user-1");
      expect(lobbyDecision.admitted).toBe(true);

      const pvpDecision = controller.checkAdmission("pvp", "user-1");
      expect(pvpDecision.admitted).toBe(true);

      const pythonDecision = controller.checkAdmission("python", "match-1");
      expect(pythonDecision.admitted).toBe(true);
    });
  });

  describe("State Transition: NORMAL -> PRESSURE", () => {
    it("transitions to PRESSURE when event loop lag exceeds high threshold", () => {
      controller.evaluateMetrics({
        eventLoopLagMs: 55, // > 50ms high threshold
        heapPercent: 50,
        rssBytes: 200_000_000,
      });

      expect(controller.getState()).toBe("PRESSURE");
    });

    it("transitions to PRESSURE when heap percentage exceeds high threshold", () => {
      controller.evaluateMetrics({
        eventLoopLagMs: 10,
        heapPercent: 88, // > 85% high threshold
        rssBytes: 200_000_000,
      });

      expect(controller.getState()).toBe("PRESSURE");
    });
  });

  describe("Hysteresis Behavior: Staying in PRESSURE", () => {
    it("does NOT transition to RECOVERY if metrics fall below high threshold but remain above low threshold", () => {
      // Trigger PRESSURE
      controller.evaluateMetrics({
        eventLoopLagMs: 60,
        heapPercent: 50,
        rssBytes: 200_000_000,
      });
      expect(controller.getState()).toBe("PRESSURE");

      // Lag drops to 35ms (below high=50ms, but still above low=20ms)
      controller.evaluateMetrics({
        eventLoopLagMs: 35,
        heapPercent: 50,
        rssBytes: 200_000_000,
      });

      // Must remain in PRESSURE (hysteresis damping prevents flapping)
      expect(controller.getState()).toBe("PRESSURE");
    });
  });

  describe("State Transition: PRESSURE -> RECOVERY -> NORMAL", () => {
    it("transitions to RECOVERY when all metrics drop below low thresholds", () => {
      // Trigger PRESSURE
      controller.evaluateMetrics({
        eventLoopLagMs: 60,
        heapPercent: 50,
        rssBytes: 200_000_000,
      });
      expect(controller.getState()).toBe("PRESSURE");

      // Lag drops to 15ms (< low=20ms) and heap is 50% (< low=70%)
      controller.evaluateMetrics({
        eventLoopLagMs: 15,
        heapPercent: 50,
        rssBytes: 200_000_000,
      });

      expect(controller.getState()).toBe("RECOVERY");
    });

    it("relapses back to PRESSURE if metrics spike during RECOVERY", () => {
      // Go to RECOVERY
      controller.evaluateMetrics({ eventLoopLagMs: 60, heapPercent: 50, rssBytes: 200_000_000 });
      controller.evaluateMetrics({ eventLoopLagMs: 15, heapPercent: 50, rssBytes: 200_000_000 });
      expect(controller.getState()).toBe("RECOVERY");

      // Sudden spike
      controller.evaluateMetrics({ eventLoopLagMs: 55, heapPercent: 50, rssBytes: 200_000_000 });
      expect(controller.getState()).toBe("PRESSURE");
    });

    it("transitions from RECOVERY to NORMAL only when cooldown elapsed AND probe budget satisfied", () => {
      // Trigger PRESSURE then RECOVERY at t = 1,000,000
      controller.evaluateMetrics({ eventLoopLagMs: 60, heapPercent: 50, rssBytes: 200_000_000 });
      controller.evaluateMetrics({ eventLoopLagMs: 15, heapPercent: 50, rssBytes: 200_000_000 });
      expect(controller.getState()).toBe("RECOVERY");

      // Send 3 successful probes
      controller.recordProbeSuccess();
      controller.recordProbeSuccess();
      controller.recordProbeSuccess();

      // Time has not reached cooldown (cooldownPeriodMs = 5000)
      simulatedTime += 2000;
      controller.evaluateMetrics({ eventLoopLagMs: 15, heapPercent: 50, rssBytes: 200_000_000 });
      expect(controller.getState()).toBe("RECOVERY"); // still waiting cooldown

      // Advance time past cooldown
      simulatedTime += 4000; // total 6000ms > 5000ms
      controller.evaluateMetrics({ eventLoopLagMs: 15, heapPercent: 50, rssBytes: 200_000_000 });
      expect(controller.getState()).toBe("NORMAL");
    });
  });

  describe("Load Shedding & Gameplay Reserve in PRESSURE", () => {
    beforeEach(() => {
      // Force into PRESSURE
      controller.evaluateMetrics({ eventLoopLagMs: 60, heapPercent: 50, rssBytes: 200_000_000 });
      expect(controller.getState()).toBe("PRESSURE");
    });

    it("sheds lobby requests with 503 and retry-after in PRESSURE", () => {
      const decision = controller.checkAdmission("lobby", "user-1");
      expect(decision.admitted).toBe(false);
      expect(decision.reason).toBe("SYSTEM_PRESSURE_LOBBY_SHED");
      expect(decision.retryAfterMs).toBeGreaterThan(0);
    });

    it("sheds python requests in PRESSURE to protect host resources", () => {
      const decision = controller.checkAdmission("python", "match-1");
      expect(decision.admitted).toBe(false);
      expect(decision.reason).toBe("SYSTEM_PRESSURE_BOT_PREFLIGHT_SHED");
      expect(decision.retryAfterMs).toBeGreaterThan(0);
    });

    it("protects active gameplay moves (priority pvp) in PRESSURE", () => {
      // Active match move has isPriority = true
      const decision = controller.checkAdmission("pvp", "user-1", true);
      expect(decision.admitted).toBe(true);
    });
  });

  describe("Jittered Reconnect", () => {
    it("generates random jitter within configured bounds to prevent thundering herd", () => {
      for (let i = 0; i < 20; i++) {
        const jitter = controller.getJitteredRetryAfter(1000);
        expect(jitter).toBeGreaterThanOrEqual(1000);
        expect(jitter).toBeLessThanOrEqual(3000); // 1000 + 2000 max jitter
      }
    });
  });
});
