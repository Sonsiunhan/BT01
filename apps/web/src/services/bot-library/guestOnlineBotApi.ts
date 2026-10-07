import type { BotLibraryCreateRequest, BotLibraryItem, BotRevision, BotRevisionTestResponse } from "@ottv2/contracts";
import { requestJson } from "../http/httpClient";

export function stageGuestOnlineBot(input: BotLibraryCreateRequest) {
  return requestJson<{ bot: BotLibraryItem; revision: BotRevision }>("/guest/bot-library/stage", { method: "POST", body: input });
}
export function testGuestOnlineBot(botId: string, revisionId: string) {
  return requestJson<BotRevisionTestResponse>(`/guest/bot-library/bots/${encodeURIComponent(botId)}/revisions/${encodeURIComponent(revisionId)}/test`, { method: "POST" });
}
export function clearGuestOnlineStaging() { return requestJson<void>("/guest/bot-library/staging", { method: "DELETE" }); }
