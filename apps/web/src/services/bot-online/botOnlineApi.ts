import type { BotOnlineSelectRequest, BotOnlineSnapshot, BotOnlineUploadRequest } from "@ottv2/contracts";
import { getJson, requestJson } from "../http/httpClient";

export function getBotOnline(roomId: string, signal?: AbortSignal) { return getJson(`/bot-online/${encodeURIComponent(roomId)}`, signal) as Promise<{ snapshot: BotOnlineSnapshot }>; }
export function selectBotOnline(roomId: string, input: BotOnlineSelectRequest) { return requestJson<{ snapshot: BotOnlineSnapshot }>(`/bot-online/${encodeURIComponent(roomId)}/select`, { method: "POST", body: input }); }
export function uploadBotOnline(roomId: string, input: BotOnlineUploadRequest) { return requestJson<{ snapshot: BotOnlineSnapshot }>(`/bot-online/${encodeURIComponent(roomId)}/upload`, { method: "POST", body: input }); }
export function setBotOnlineReady(roomId: string, ready: boolean) { return requestJson<{ snapshot: BotOnlineSnapshot }>(`/bot-online/${encodeURIComponent(roomId)}/ready`, { method: "POST", body: { ready } }); }
export function stepBotOnline(roomId: string) { return requestJson<{ snapshot: BotOnlineSnapshot }>(`/bot-online/${encodeURIComponent(roomId)}/step`, { method: "POST", body: {} }); }
