import { describe, expect, it, vi } from "vitest";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { AuthService } from "../../src/modules/auth/auth.service.js";
import { registerRoomRoutes } from "../../src/modules/room/room.route.js";
import { RoomManager, type RoomActor } from "../../src/modules/room/room.manager.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

const host: RoomActor = { userId: "r7-host", username: "r7_host", displayName: "Chủ phòng", principal: "ACCOUNT" };
const referee: RoomActor = { userId: "r7-ref", username: "r7_ref", displayName: "Trọng tài", principal: "ACCOUNT" };

function fakeReply(): FastifyReply {
  const reply = { status: vi.fn(), send: vi.fn() } as unknown as FastifyReply;
  (reply.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(reply);
  return reply;
}

describe("R7 room detail role serialization", () => {
  it("returns the authenticated viewer role instead of treating every null-side viewer as a spectator", async () => {
    const rooms = new RoomManager();
    const created = await rooms.create(host, { name: "R7 role", visibility: "PRIVATE", password: "secret", timerSeconds: 300, refereeEnabled: true, spectatorsEnabled: false });
    const invite = await rooms.inviteReferee(host, created.roomId, referee.userId);
    await rooms.acceptRefereeInvite(referee, invite.inviteId);

    let current = host;
    const auth = {
      authenticate: vi.fn(async () => ({ user: { id: current.userId, username: current.username, displayName: current.displayName }, principal: current.principal ?? "ACCOUNT" })),
    } as unknown as AuthService;
    const handlers = new Map<string, Handler>();
    const app = {
      get: (path: string, handler: Handler) => handlers.set("GET " + path, handler),
      post: (path: string, handler: Handler) => handlers.set("POST " + path, handler),
    } as unknown as FastifyInstance;
    await registerRoomRoutes(app, auth, rooms);
    const handler = handlers.get("GET /rooms/:roomId");
    if (!handler) throw new Error("missing room detail handler");

    const read = async (actor: RoomActor) => {
      current = actor;
      const reply = fakeReply();
      const request = { params: { roomId: created.roomId }, headers: {} } as unknown as FastifyRequest;
      await handler(request, reply);
      return (reply.send as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as { room: { role: string; isReferee: boolean } };
    };

    expect(await read(host)).toMatchObject({ room: { role: "PLAYER", isReferee: false } });
    expect(await read(referee)).toMatchObject({ room: { role: "REFEREE", isReferee: true } });
  });

  it("exposes only the authenticated account's pending referee inbox", async () => {
    const rooms = new RoomManager();
    const target: RoomActor = { userId: "r7-target", username: "r7_target", displayName: "Target", principal: "ACCOUNT" };
    const created = await rooms.create(host, { name: "R12 inbox", visibility: "PRIVATE", password: "secret", timerSeconds: 300, refereeEnabled: true, spectatorsEnabled: false });
    const invite = await rooms.inviteReferee(host, created.roomId, target.userId);
    let current = target;
    const auth = { authenticate: vi.fn(async () => ({ user: { id: current.userId, username: current.username, displayName: current.displayName }, principal: current.principal ?? "ACCOUNT" })) } as unknown as AuthService;
    const handlers = new Map<string, Handler>();
    const app = { get: (path: string, handler: Handler) => handlers.set("GET " + path, handler), post: (path: string, handler: Handler) => handlers.set("POST " + path, handler) } as unknown as FastifyInstance;
    await registerRoomRoutes(app, auth, rooms);
    const handler = handlers.get("GET /rooms/referee/invites");
    if (!handler) throw new Error("missing referee inbox handler");
    const reply = fakeReply();
    await handler({ headers: {} } as unknown as FastifyRequest, reply);
    expect((reply.send as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0]).toEqual({ invites: [expect.objectContaining({ inviteId: invite.inviteId, targetUserId: target.userId, from: { userId: host.userId, username: host.username, displayName: host.displayName } })] });
  });
});
