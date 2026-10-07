import { BotOnlineSelectRequestSchema, BotOnlineStepRequestSchema, BotOnlineUploadRequestSchema, ReadyMatchRequestSchema } from "@ottv2/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";

import { requireBody } from "../auth/auth.http.js";
import { authenticateRoom } from "../room/room.route.js";
import type { AuthService } from "../auth/auth.service.js";
import { AppError } from "../../shared/errors/app-error.js";
import { RoomManager } from "../room/room.manager.js";
import { BotOnlineService } from "./bot-online.service.js";

function actorOf(context: Awaited<ReturnType<AuthService["authenticate"]>>) {
  return { userId: context.user.id, username: context.user.username, displayName: context.user.displayName, principal: context.principal } as const;
}

async function playerRoom(auth: AuthService, rooms: RoomManager, request: FastifyRequest<{ Params: { roomId: string } }>) {
  const context = await authenticateRoom(auth, rooms, request);
  const room = rooms.search(request.params.roomId, context.user.id);
  if (!room.isMember && !room.isReferee && !rooms.isSpectator(room.roomId, context.user.id)) throw new AppError("UNAUTHORIZED", "Bạn không có quyền xem phòng Bot này.", 403, false, "FATAL_SESSION", { reason: "BOT_ROOM_ACCESS_REQUIRED" });
  return { context, room };
}

export async function registerBotOnlineRoutes(app: FastifyInstance, auth: AuthService, rooms: RoomManager, service: BotOnlineService): Promise<void> {
  app.get<{ Params: { roomId: string } }>("/bot-online/:roomId", async (request, reply) => {
    const { context, room } = await playerRoom(auth, rooms, request);
    return reply.status(200).send({ snapshot: service.snapshot(room, context.user.id) });
  });

  app.post<{ Params: { roomId: string } }>("/bot-online/:roomId/select", async (request, reply) => {
    const { context, room } = await playerRoom(auth, rooms, request);
    const input = requireBody(request.body, BotOnlineSelectRequestSchema);
    return reply.status(200).send({ snapshot: await service.select(room, actorOf(context), input.botId, input.revisionId) });
  });

  app.post<{ Params: { roomId: string } }>("/bot-online/:roomId/upload", async (request, reply) => {
    const { context, room } = await playerRoom(auth, rooms, request);
    const input = requireBody(request.body, BotOnlineUploadRequestSchema);
    return reply.status(200).send({ snapshot: await service.upload(room, actorOf(context), input.botId, input.source) });
  });

  app.post<{ Params: { roomId: string } }>("/bot-online/:roomId/ready", async (request, reply) => {
    const { context, room } = await playerRoom(auth, rooms, request);
    const input = requireBody(request.body, ReadyMatchRequestSchema);
    return reply.status(200).send({ snapshot: service.ready(room, actorOf(context), input.ready) });
  });

  app.post<{ Params: { roomId: string } }>("/bot-online/:roomId/step", async (request, reply) => {
    const { context, room } = await playerRoom(auth, rooms, request);
    requireBody(request.body ?? {}, BotOnlineStepRequestSchema);
    if (!room.isMember) throw new AppError("UNAUTHORIZED", "Chỉ người chơi của phòng Bot mới có thể yêu cầu bước tính.", 403, false, "FATAL_SESSION", { reason: "BOT_PLAYER_REQUIRED" });
    await service.step(room);
    return reply.status(200).send({ snapshot: service.snapshot(room, context.user.id) });
  });
}
