import { beforeEach, describe, expect, it } from "vitest";
import { clearActiveMatchHint, readActiveMatchHint, saveActiveMatchHint } from "./activeMatchHint";

describe("R6 active match resume hint", () => {
  beforeEach(() => window.localStorage.clear());

  it("stores only a resumable room hint and expires stale client data", () => {
    saveActiveMatchHint({ roomId: "ABC123", mode: "UNRANKED", status: "PLAYING" });
    expect(readActiveMatchHint()).toMatchObject({ roomId: "ABC123", status: "PLAYING" });
    const saved = readActiveMatchHint()!;
    expect(readActiveMatchHint(saved.updatedAt + 24 * 60 * 60 * 1000 + 1)).toBeNull();
    expect(window.localStorage.getItem("ottv2:active-match-hint")).toBeNull();
  });

  it("can be cleared when the player leaves or the match reaches a terminal state", () => {
    saveActiveMatchHint({ roomId: "ABC123", mode: "UNRANKED", status: "PAUSED" });
    clearActiveMatchHint();
    expect(readActiveMatchHint()).toBeNull();
  });
});
