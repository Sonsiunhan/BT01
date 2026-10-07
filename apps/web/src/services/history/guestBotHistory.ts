import type { MatchSnapshot } from "@ottv2/contracts";
import type { Side } from "@ottv2/game-rules";
import type { LocalHistoryRecord } from "../local/localGameStorage";

/** Device summary from authoritative public result; never stores private bot data. */
export function guestBotHistoryRecord(match: MatchSnapshot, viewerSide: Side | null): LocalHistoryRecord | null {
  if (!viewerSide || match.playMode !== "BOT" || !["FINISHED", "ABORTED"].includes(match.status)) return null;
  const viewer = match.players.find(player => player.side === viewerSide);
  const opponent = match.players.find(player => player.side !== viewerSide);
  if (!viewer?.userId.startsWith("guest:")) return null;
  return {
    localId: `guest-bot-online:${match.matchId}:${viewerSide}`, mode: "BOT_ONLINE",
    result: match.winner ? match.winner === viewerSide ? "WIN" : "LOSS" : "DRAW",
    playerName: viewer.displayName, opponentName: opponent?.displayName ?? "Đối thủ",
    timerSeconds: match.timerSeconds, durationSeconds: match.startedAt && match.endedAt ? Math.max(0, Math.round((match.endedAt - match.startedAt) / 1000)) : 0,
    endedAt: new Date(match.endedAt ?? Date.now()).toISOString(), scoreDelta: 0,
  };
}
