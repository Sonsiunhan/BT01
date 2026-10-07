import type { BotLibraryCreateRequest, BotLibraryListResponse, BotRevisionCreateRequest, BotRevisionTestResponse, BotSdkDocsResponse, BotSourceResponse } from "@ottv2/contracts";
import { getJson, requestJson } from "../http/httpClient";
import { guestBotLibraryApi } from "./guestBotLibrary";

export function getBotLibrary(signal?: AbortSignal) { return getJson("/bot-library", signal, { handleUnauthorized: true }) as Promise<BotLibraryListResponse>; }
export function getBotSdkDocs(signal?: AbortSignal) { return getJson("/bot-library/sdk", signal) as Promise<BotSdkDocsResponse>; }
export function getBotSource(botId: string, revisionId: string, signal?: AbortSignal) { if (botId.startsWith("guest-bot:")) return guestBotLibraryApi.getBotSource(botId, revisionId, signal); return getJson(`/bot-library/bots/${encodeURIComponent(botId)}/revisions/${encodeURIComponent(revisionId)}/source`, signal) as Promise<BotSourceResponse>; }
export function createBot(input: BotLibraryCreateRequest) { return requestJson<{ bot: BotLibraryListResponse["bots"][number]; revision: BotLibraryListResponse["bots"][number]["revisions"][number] }>("/bot-library/bots", { method: "POST", body: input }); }
export function createBotRevision(botId: string, input: BotRevisionCreateRequest) { return requestJson<{ bot: BotLibraryListResponse["bots"][number]; revision: BotLibraryListResponse["bots"][number]["revisions"][number] }>(`/bot-library/bots/${encodeURIComponent(botId)}/revisions`, { method: "POST", body: input }); }
export function testBotRevision(botId: string, revisionId: string) { return requestJson<BotRevisionTestResponse>(`/bot-library/bots/${encodeURIComponent(botId)}/revisions/${encodeURIComponent(revisionId)}/test`, { method: "POST" }); }
export function deleteBotRevision(botId: string, revisionId: string) { return requestJson<void>(`/bot-library/bots/${encodeURIComponent(botId)}/revisions/${encodeURIComponent(revisionId)}`, { method: "DELETE" }); }
