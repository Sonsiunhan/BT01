import { describe, expect, it } from "vitest";
import type { MatchSnapshot } from "@ottv2/contracts";
import { guestBotHistoryRecord } from "./guestBotHistory";

const match = { matchId: "round-fixture", playMode: "BOT", status: "FINISHED", winner: "RED", timerSeconds: 300, startedAt: 1000, endedAt: 6000, players: [{ userId: "guest:opaque", displayName: "Khách", side: "BLUE" }, { userId: "account:other", displayName: "Đối thủ", side: "RED" }] } as MatchSnapshot;
describe("Guest Bot Online device history", () => {
  it("records only an authoritative Guest terminal summary with a stable upsert key", () => {
    expect(guestBotHistoryRecord(match, "BLUE")).toEqual({ localId: "guest-bot-online:round-fixture:BLUE", mode: "BOT_ONLINE", result: "LOSS", playerName: "Khách", opponentName: "Đối thủ", timerSeconds: 300, durationSeconds: 5, endedAt: new Date(6000).toISOString(), scoreDelta: 0 });
    expect(guestBotHistoryRecord(match, "RED")).toBeNull();
    expect(guestBotHistoryRecord({ ...match, status: "PLAYING" }, "BLUE")).toBeNull();
    expect(guestBotHistoryRecord({ ...match, playMode: "MANUAL" }, "BLUE")).toBeNull();
    expect(guestBotHistoryRecord(match, null)).toBeNull();
  });
  it("keeps infrastructure abort neutral, not a bot loss", () => {
    expect(guestBotHistoryRecord({ ...match, status: "ABORTED", winner: null }, "BLUE")?.result).toBe("DRAW");
  });
});
