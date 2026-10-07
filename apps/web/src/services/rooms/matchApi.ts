import type { MatchEventEnvelope, MatchPauseCategory, MatchSnapshot } from "@ottv2/contracts";
import { env } from "../../config/env";
import { getJson, requestJson } from "../http/httpClient";
import { getClientId } from "../session/clientIdentity";

export function getMatch(roomId: string) {
  return getJson(`/matches/${encodeURIComponent(roomId)}?clientId=${encodeURIComponent(getClientId())}`) as Promise<{ match: MatchSnapshot; viewerSide: "BLUE" | "RED" | null; replacementCandidate?: boolean }>;
}

export function setReady(roomId: string, ready: boolean) {
  return requestJson<{ match: MatchSnapshot }>(`/matches/${encodeURIComponent(roomId)}/ready`, { method: "POST", body: { ready }, headers: { "X-Client-Id": getClientId() } });
}

export function fastReady(roomId: string) { return requestJson<{ match: MatchSnapshot }>(`/matches/${encodeURIComponent(roomId)}/fast-ready`, { method: "POST", headers: { "X-Client-Id": getClientId() } }); }

export function startMatch(roomId: string) {
  return requestJson<{ match: MatchSnapshot }>(`/matches/${encodeURIComponent(roomId)}/referee/start`, { method: "POST", headers: { "X-Client-Id": getClientId() } });
}

export function stopMatch(roomId: string, category: MatchPauseCategory) {
  return requestJson<{ match: MatchSnapshot }>(`/matches/${encodeURIComponent(roomId)}/referee/stop`, { method: "POST", body: { category }, headers: { "X-Client-Id": getClientId() } });
}

export function resumeMatch(roomId: string) {
  return requestJson<{ match: MatchSnapshot }>(`/matches/${encodeURIComponent(roomId)}/referee/resume`, { method: "POST", headers: { "X-Client-Id": getClientId() } });
}

export function holdMatch(roomId: string) {
  return requestJson<{ match: MatchSnapshot }>(`/matches/${encodeURIComponent(roomId)}/referee/hold`, { method: "POST", headers: { "X-Client-Id": getClientId() } });
}

export function nominateRefereeReplacement(roomId: string, targetUserId: string) {
  return requestJson<{ match: MatchSnapshot }>(`/matches/${encodeURIComponent(roomId)}/referee/replacement/nominate`, { method: "POST", body: { targetUserId }, headers: { "X-Client-Id": getClientId() } });
}

export function approveRefereeReplacement(roomId: string) {
  return requestJson<{ match: MatchSnapshot }>(`/matches/${encodeURIComponent(roomId)}/referee/replacement/approve`, { method: "POST", headers: { "X-Client-Id": getClientId() } });
}

export function acceptRefereeReplacement(roomId: string) {
  return requestJson<{ match: MatchSnapshot }>(`/matches/${encodeURIComponent(roomId)}/referee/replacement/accept`, { method: "POST", headers: { "X-Client-Id": getClientId() } });
}

export function submitMove(roomId: string, from: string, to: string, stateVersion: number) {
  return requestJson<{ match: MatchSnapshot }>(`/matches/${encodeURIComponent(roomId)}/moves`, { method: "POST", body: { from, to, stateVersion }, headers: { "X-Client-Id": getClientId() } });
}

export function surrender(roomId: string, stateVersion: number) {
  return requestJson<{ match: MatchSnapshot }>(`/matches/${encodeURIComponent(roomId)}/surrender`, { method: "POST", body: { stateVersion }, headers: { "X-Client-Id": getClientId() } });
}

export function requestRematch(roomId: string, stateVersion: number) {
  return requestJson<{ match: MatchSnapshot }>(`/matches/${encodeURIComponent(roomId)}/rematch`, { method: "POST", body: { stateVersion }, headers: { "X-Client-Id": getClientId() } });
}

export function rejectRematch(roomId: string, stateVersion: number) {
  return requestJson<{ match: MatchSnapshot }>(`/matches/${encodeURIComponent(roomId)}/rematch/reject`, { method: "POST", body: { stateVersion }, headers: { "X-Client-Id": getClientId() } });
}

export function subscribeToMatch(roomId: string, onEvent: (event: MatchEventEnvelope) => void, onError: () => void): () => void {
  const source = new EventSource(`${env.apiBaseUrl}/matches/${encodeURIComponent(roomId)}/events?clientId=${encodeURIComponent(getClientId())}`, { withCredentials: true });
  source.onmessage = (message) => { try { onEvent(JSON.parse(message.data) as MatchEventEnvelope); } catch { onError(); } };
  source.onerror = onError;
  return () => source.close();
}
