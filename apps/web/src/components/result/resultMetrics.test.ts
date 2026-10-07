import { describe, expect, it } from "vitest";
import type { MatchSnapshot } from "@ottv2/contracts";
import { calculateActiveDurationSeconds } from "./resultMetrics";

describe("R18 result metrics", () => {
  it("excludes referee pause intervals from active match duration", () => {
    const match = {
      startedAt: 1_000,
      endedAt: 11_000,
      pauseElapsedMs: 0,
      publicTimeline: [
        { sequence: 2, type: "MATCH_PAUSED", timestamp: 4_000 },
        { sequence: 3, type: "MATCH_RESUMED", timestamp: 7_000 },
      ],
    } as MatchSnapshot;

    expect(calculateActiveDurationSeconds(match)).toBe(7);
  });
});
