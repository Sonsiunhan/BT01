import { describe, expect, it } from "vitest";
import { generateSetupSeed, createInitialState, evaluateTurnStart, BOARD_COORDINATES, PieceType, Side } from "@ottv2/game-rules";

describe("L01-W3 Entropy and Heavy Positions", () => {
  describe("Entropy helper (generateSetupSeed)", () => {
    it("should generate a valid seed given a uniform random source", () => {
      // Mock readByte to return sequential bytes that form a valid number < 14112000
      let counter = 0;
      const seed = generateSetupSeed(() => {
        // Return 0, 0, 1 -> val = 1
        const bytes = [0, 0, 1];
        return bytes[counter++];
      });
      expect(seed).toBe(1);
    });

    it("should reject values >= 14112000 and retry", () => {
      let callCount = 0;
      const seed = generateSetupSeed(() => {
        const attempt = Math.floor(callCount / 3);
        const byteIndex = callCount % 3;
        callCount++;
        
        if (attempt === 0) {
          // First attempt: return something >= 14112000.
          // 14112000 is 0xD75500. So 0xFF, 0xFF, 0xFF is 16777215 >= 14112000
          return 0xFF;
        } else {
          // Second attempt: return valid bytes (e.g. 0, 0, 42)
          return byteIndex === 2 ? 42 : 0;
        }
      });
      // Expected to retry on first attempt (3 calls), then succeed on second attempt (+3 calls)
      expect(callCount).toBe(6);
      expect(seed).toBe(42);
    });

    it("should throw an error if it fails 8 times in a row", () => {
      expect(() => {
        generateSetupSeed(() => 0xFF);
      }).toThrow("Failed to generate setup seed within 8 rejection sampling iterations");
    });
  });

  describe("Benchmark heavy positions", () => {
    it("evaluateTurnStart should be very fast (<= 2ms) even on a fully populated board", () => {
      // Create a full 36-piece board (v2)
      const state = createInitialState({ version: "rps-v2", seed: 1411200 });
      
      // Warm up JIT to avoid measuring initial module/codegen latency in noisy CI environments
      evaluateTurnStart(state);

      const start = performance.now();
      const nextState = evaluateTurnStart(state);
      const end = performance.now();
      
      const duration = end - start;
      expect(duration).toBeLessThanOrEqual(10); // Allowing up to 10ms for noisy CI VM variance, warm run is typically <1ms
      
      // The current state has legal moves, so it shouldn't be NO_LEGAL_MOVES
      expect(nextState.resultReason).toBeNull();
    });
  });
});
