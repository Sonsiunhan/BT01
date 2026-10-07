import { CreateRoomRequestSchema, InviteRefereeRequestSchema, JoinRoomRequestSchema, SpectateRoomRequestSchema } from "@ottv2/contracts";
import type { FastifyInstance } from "fastify";

import { requireBody, readCookie } from "../auth/auth.http.js";
import { GUEST_SESSION_COOKIE, type AuthService } from "../auth/auth.service.js";
import { AppError } from "../../shared/errors/app-error.js";
import { RoomManager, type RoomActor } from "./room.manager.js";

function idempotencyKey(request: { headers: Record<string, string | string[] | undefined> }): string | undefined {
  const value = request.headers["idempotency-key"];
  return Array.isArray(value) ? value[0] : value;
}

function actorOf(context: Awaited<ReturnType<AuthService["authenticate"]>>): RoomActor {
  return { userId: context.user.id, username: context.user.username, displayName: context.user.displayName, rating: context.user.stats?.elo ?? 1000, principal: context.principal };
}

export async function authenticateRoom(auth: AuthService, rooms: RoomManager, request: Parameters<typeof readCookie>[0]) {
  const accountToken = readCookie(request);
  const guestToken = readCookie(request, GUEST_SESSION_COOKIE);
  if (!guestToken) return auth.authenticate(accountToken);
  let guest: Awaited<ReturnType<AuthService["authenticate"]>>;
  try { guest = await auth.authenticateAny(undefined, guestToken); }
  catch { if (accountToken) return auth.authenticate(accountToken); throw new AppError("UNAUTHORIZED", "Phiên khách không hợp lệ.", 401, false, "FATAL_SESSION"); }
  const roomId = (request.params as { roomId?: string } | undefined)?.roomId;
  if (roomId) {
    try {
      const room = rooms.search(roomId, guest.user.id);
      if (room.isMember || room.isReferee || rooms.isSpectator(roomId, guest.user.id)) return guest;
    } catch { /* account auth below handles non-existent/unauthorized room access */ }
  }
  if (accountToken) return auth.authenticate(accountToken);
  return guest;
}

function assertGuestRoomAllowed(context: Awaited<ReturnType<AuthService["authenticate"]>>, mode: "UNRANKED" | "RANKED"): void {
  if (context.principal === "GUEST" && mode === "RANKED") throw new AppError("UNAUTHORIZED", "Guest chỉ có thể tham gia phòng thường.", 403, false, "FATAL_SESSION", { reason: "ACCOUNT_REQUIRED_RANKED" });
}

export async function registerRoomRoutes(app: FastifyInstance, auth: AuthService, rooms: RoomManager): Promise<void> {
  app.get<{ Querystring: { search?: string; limit?: string } }>("/rooms", async (request, reply) => {
    if (request.query.search?.trim()) return reply.status(200).send({ rooms: [rooms.search(request.query.search, undefined)] });
    const limit = request.query.limit ? Number.parseInt(request.query.limit, 10) : 8;
    return reply.status(200).send({ rooms: rooms.list(Number.isFinite(limit) ? limit : 8) });
  });

  app.get("/rooms/events", (request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
    const write = (items: ReturnType<RoomManager["list"]>) => reply.raw.write(`data: ${JSON.stringify({ type: "ROOMS_SYNC", rooms: items })}\n\n`);
    write(rooms.list(100));
    const unsubscribe = rooms.subscribe(write);
    const heartbeat = setInterval(() => reply.raw.write(": keep-alive\n\n"), 20000);
    request.raw.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
  });
  app.get<{ Params: { roomId: string } }>("/rooms/:roomId", async (request, reply) => {
    // The waiting room needs the viewer's authoritative role. Public browse
    // summaries remain anonymous, but this member-scoped detail endpoint must
    // serialize PLAYER/REFEREE/SPECTATOR correctly so the client cannot infer
    // referee controls from a null viewerSide (which spectators also use).
    const context = await authenticateRoom(auth, rooms, request);
    return reply.status(200).send({ room: rooms.search(request.params.roomId, context.user.id) });
  });

  app.post("/rooms", async (request, reply) => {
    const context = await authenticateRoom(auth, rooms, request);
    const input = requireBody(request.body, CreateRoomRequestSchema);
    // This header can only reject a stale preparation; it never grants a role.
    if (request.headers["x-expected-principal"] === "GUEST" && context.principal !== "GUEST") throw new AppError("CONFLICT", "Danh tính đã thay đổi. Hãy chọn và kiểm tra Bot lại.", 409, false, "INVALID");
    const room = await rooms.create(actorOf(context), input, idempotencyKey(request));
    return reply.status(201).send({ room });
  });

  app.post<{ Params: { roomId: string } }>("/rooms/:roomId/join", async (request, reply) => {
    const context = await authenticateRoom(auth, rooms, request);
    assertGuestRoomAllowed(context, rooms.search(request.params.roomId).mode);
    const input = requireBody(request.body ?? {}, JoinRoomRequestSchema);
    const room = await rooms.join(actorOf(context), request.params.roomId, input, idempotencyKey(request));
    return reply.status(200).send({ room });
  });

  app.post<{ Params: { roomId: string } }>("/rooms/:roomId/spectate", async (request, reply) => {
    const context = await authenticateRoom(auth, rooms, request);
    assertGuestRoomAllowed(context, rooms.search(request.params.roomId).mode);
    const input = requireBody(request.body ?? {}, SpectateRoomRequestSchema);
    const room = await rooms.spectate(actorOf(context), request.params.roomId, input);
    return reply.status(200).send({ role: "SPECTATOR", room });
  });

  app.post<{ Params: { roomId: string } }>("/rooms/:roomId/referee/invite", async (request, reply) => {
    const context = await authenticateRoom(auth, rooms, request);
    const input = requireBody(request.body, InviteRefereeRequestSchema);
    const invite = await rooms.inviteReferee(actorOf(context), request.params.roomId, input.targetUserId, input.ttlSeconds * 1000);
    return reply.status(201).send({ invite });
  });

  app.get("/rooms/referee/invites", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    return reply.status(200).send({ invites: rooms.refereeInvitesFor(context.user.id) });
  });

  app.post<{ Params: { inviteId: string } }>("/rooms/referee/invites/:inviteId/accept", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    const room = await rooms.acceptRefereeInvite(actorOf(context), request.params.inviteId);
    return reply.status(200).send({ room });
  });

  app.post<{ Params: { inviteId: string } }>("/rooms/referee/invites/:inviteId/decline", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    const invite = rooms.declineRefereeInvite(actorOf(context), request.params.inviteId);
    return reply.status(200).send({ invite });
  });

  app.post<{ Params: { roomId: string } }>("/rooms/:roomId/spectate/leave", async (request, reply) => {
    const context = await authenticateRoom(auth, rooms, request);
    rooms.leaveSpectator(request.params.roomId, context.user.id);
    return reply.status(204).send();
  });

  app.post<{ Params: { roomId: string } }>("/rooms/:roomId/leave", async (request, reply) => {
    const context = await authenticateRoom(auth, rooms, request);
    const result = rooms.leave(actorOf(context), request.params.roomId);
    if (!result) return reply.status(204).send();
    return reply.status(200).send({ room: result });
  });

  app.post<{ Params: { roomId: string } }>("/rooms/:roomId/referee/leave", async (request, reply) => {
    const context = await authenticateRoom(auth, rooms, request);
    rooms.leaveReferee(request.params.roomId, context.user.id);
    return reply.status(204).send();
  });
}
