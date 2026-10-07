import { MatchmakingEventEnvelopeSchema, type MatchmakingEventEnvelope, type MatchmakingMode, type MatchmakingSnapshot } from "@ottv2/contracts";

import { env } from "../../config/env";
import { getJson, requestJson } from "../http/httpClient";
import { getClientId } from "../session/clientIdentity";
import { ensureGuestSession } from "../guest/guestApi";
import { getMe } from "../auth/authApi";
import { ApiError } from "../http/apiError";

export function joinRankedQueue() {
  return joinMatchmakingQueue("RANKED");
}

export async function joinMatchmakingQueue(mode: MatchmakingMode) {
  let guestPrincipal = false;
  if (mode === "UNRANKED" || mode === "BOT") {
    try { await getMe(); }
    catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      await ensureGuestSession();
      guestPrincipal = true;
    }
  }
  let selection: { botId?: string; revisionId?: string; localBotId?: string } | null = null;
  if (mode === "BOT") {
    try { selection = JSON.parse(sessionStorage.getItem("ottv2:bot-queue-selection") ?? "null") as { botId?: string; revisionId?: string; localBotId?: string } | null; } catch { /* server remains authority */ }
  }
  return requestJson<{ queue: MatchmakingSnapshot }>("/matchmaking/queue", { method: "POST", body: { mode, ...(mode === "BOT" ? { botId: selection?.botId, revisionId: selection?.revisionId } : {}) }, headers: { "X-Client-Id": getClientId(), ...(mode === "BOT" && guestPrincipal ? { "X-Expected-Principal": "GUEST" } : {}) } });
}

export function getQueue(queueId: string) {
  return getJson(`/matchmaking/queue/${encodeURIComponent(queueId)}`) as Promise<{ queue: MatchmakingSnapshot }>;
}

export function cancelQueue(queueId: string) {
  return requestJson<{ queue: MatchmakingSnapshot }>(`/matchmaking/queue/${encodeURIComponent(queueId)}`, { method: "DELETE", headers: { "X-Client-Id": getClientId() } });
}

export function subscribeToQueue(queueId: string, onEvent: (event: MatchmakingEventEnvelope) => void, onError: () => void, onOpen?: () => void): () => void {
  const source = new EventSource(`${env.apiBaseUrl}/matchmaking/queue/${encodeURIComponent(queueId)}/events?clientId=${encodeURIComponent(getClientId())}`, { withCredentials: true });
  source.onmessage = (message) => {
    try {
      const event = MatchmakingEventEnvelopeSchema.parse(JSON.parse(message.data));
      if (event.queueId === queueId && event.payload.queueId === queueId) onEvent(event);
    } catch { onError(); }
  };
  source.onerror = onError;
  source.onopen = () => onOpen?.();
  return () => source.close();
}
