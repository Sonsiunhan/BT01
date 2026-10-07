import type { CreateRoomRequest, JoinRoomRequest, RefereeInvite, RoomDetail, RoomSummary } from "@ottv2/contracts";
import { env } from "../../config/env";
import { getJson, requestJson } from "../http/httpClient";

export function getRooms(search?: string, limit = 100) {
  const params = new URLSearchParams();
  if (search?.trim()) params.set("search", search.trim());
  if (!search?.trim()) params.set("limit", String(limit));
  const query = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/rooms${query}`) as Promise<{ rooms: Array<RoomSummary | RoomDetail> }>;
}

export function getRoom(roomId: string) {
  return getJson(`/rooms/${encodeURIComponent(roomId)}`) as Promise<{ room: RoomDetail }>;
}

export function createRoom(input: CreateRoomRequest, idempotencyKey: string, expectedPrincipal?: "GUEST") {
  return requestJson<{ room: RoomDetail }>("/rooms", { method: "POST", body: input, headers: { "Idempotency-Key": idempotencyKey, ...(expectedPrincipal ? { "X-Expected-Principal": expectedPrincipal } : {}) } });
}

export function joinRoom(roomId: string, input: JoinRoomRequest, idempotencyKey: string) {
  return requestJson<{ room: RoomDetail }>(`/rooms/${encodeURIComponent(roomId)}/join`, { method: "POST", body: input, headers: { "Idempotency-Key": idempotencyKey } });
}

export function leaveRoom(roomId: string) {
  return requestJson<void>(`/rooms/${encodeURIComponent(roomId)}/leave`, { method: "POST" });
}

export function inviteReferee(roomId: string, targetUserId: string, ttlSeconds = 300) {
  return requestJson<{ invite: RefereeInvite }>(`/rooms/${encodeURIComponent(roomId)}/referee/invite`, { method: "POST", body: { targetUserId, ttlSeconds } });
}

export function getRefereeInvites() { return getJson("/rooms/referee/invites") as Promise<{ invites: RefereeInvite[] }>; }
export function acceptRefereeInvite(inviteId: string) { return requestJson<{ room: RoomDetail }>(`/rooms/referee/invites/${encodeURIComponent(inviteId)}/accept`, { method: "POST" }); }
export function declineRefereeInvite(inviteId: string) { return requestJson<{ invite: RefereeInvite }>(`/rooms/referee/invites/${encodeURIComponent(inviteId)}/decline`, { method: "POST" }); }

export function leaveReferee(roomId: string) {
  return requestJson<void>(`/rooms/${encodeURIComponent(roomId)}/referee/leave`, { method: "POST" });
}

export function subscribeToRooms(onRooms: (rooms: RoomSummary[]) => void, onError: () => void): () => void {
  const source = new EventSource(`${env.apiBaseUrl}/rooms/events`, { withCredentials: true });
  source.onmessage = (message) => { try { const payload = JSON.parse(message.data) as { type?: string; rooms?: RoomSummary[] }; if (payload.type === "ROOMS_SYNC" && Array.isArray(payload.rooms)) onRooms(payload.rooms); } catch { onError(); } };
  source.onerror = onError;
  return () => source.close();
}

export { env };
