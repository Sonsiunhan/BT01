import { describe, it, expect, beforeEach } from "vitest";
import { AdmissionPool } from "../../src/modules/capacity/admission.pool.js";

describe("AdmissionPool Unit Tests (L-07.03)", () => {
  describe("Lobby Pool Concurrency & Quotas", () => {
    let pool: AdmissionPool;

    beforeEach(() => {
      // Lobby pool: maxConcurrency = 10, perPrincipalQuota = 2, reserved = 0
      pool = new AdmissionPool("lobby", 10, 2, 0);
    });

    it("admits requests up to max concurrency and per-principal quota", () => {
      expect(pool.acquire("user-1")).toBe(true);
      expect(pool.acquire("user-1")).toBe(true);
      // user-1 reaches quota of 2
      expect(pool.acquire("user-1")).toBe(false);

      // user-2 can still acquire
      expect(pool.acquire("user-2")).toBe(true);
      expect(pool.getOccupancy().active).toBe(3);

      // Releasing user-1 frees quota
      pool.release("user-1");
      expect(pool.getOccupancy().active).toBe(2);
      expect(pool.acquire("user-1")).toBe(true);
    });

    it("rejects when pool reaches max concurrency even if principal has quota", () => {
      const smallPool = new AdmissionPool("lobby", 3, 2, 0);
      expect(smallPool.acquire("user-1")).toBe(true);
      expect(smallPool.acquire("user-2")).toBe(true);
      expect(smallPool.acquire("user-3")).toBe(true);
      expect(smallPool.getOccupancy().active).toBe(3);

      // Now pool is full
      expect(smallPool.acquire("user-4")).toBe(false);
      expect(smallPool.acquire("user-1")).toBe(false); // even though user-1 has quota 1 left
    });
  });

  describe("Python Pool Authoritative Gate (maxActivePythonMatches = 1)", () => {
    it("strictly limits python pool to exactly 1 concurrent active match", () => {
      const pythonPool = new AdmissionPool("python", 1, 1, 0);
      expect(pythonPool.acquire("python-bot-match-1")).toBe(true);
      expect(pythonPool.getOccupancy().active).toBe(1);

      // Second match must be rejected to enforce the security isolation gate
      expect(pythonPool.acquire("python-bot-match-2")).toBe(false);

      // Release match 1 allows match 2
      pythonPool.release("python-bot-match-1");
      expect(pythonPool.getOccupancy().active).toBe(0);
      expect(pythonPool.acquire("python-bot-match-2")).toBe(true);
    });
  });

  describe("PvP Pool Gameplay Reserve", () => {
    it("protects reserved slots for priority active match moves/updates", () => {
      // PvP pool: max = 5, quota = 2, reserved = 2 (slots 4 and 5 reserved for priority gameplay)
      const pvpPool = new AdmissionPool("pvp", 5, 2, 2);

      // Non-priority admissions (e.g. creating new matches)
      expect(pvpPool.acquire("p1", false)).toBe(true);
      expect(pvpPool.acquire("p2", false)).toBe(true);
      expect(pvpPool.acquire("p3", false)).toBe(true);
      expect(pvpPool.getOccupancy().active).toBe(3);

      // Non-priority request is rejected because remaining 2 slots are reserved
      expect(pvpPool.acquire("p4", false)).toBe(false);

      // Priority request (active gameplay move / reconnection) CAN use reserved slots
      expect(pvpPool.acquire("p4", true)).toBe(true);
      expect(pvpPool.acquire("p5", true)).toBe(true);
      expect(pvpPool.getOccupancy().active).toBe(5);

      // Beyond total capacity, even priority requests are rejected
      expect(pvpPool.acquire("p6", true)).toBe(false);
    });
  });
});
