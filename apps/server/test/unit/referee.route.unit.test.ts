import { describe, expect, it, vi } from "vitest";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { AuthService } from "../../src/modules/auth/auth.service.js";
import { MatchManager, type MatchActor } from "../../src/modules/match/match.manager.js";
import { registerMatchRoutes } from "../../src/modules/match/match.route.js";
import { RoomManager, type RoomActor } from "../../src/modules/room/room.manager.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

const referee: RoomActor & MatchActor = { userId: "route-ref", username: "route_ref", displayName: "Ref", principal: "ACCOUNT" };
const blue: RoomActor & MatchActor = { userId: "route-blue", username: "route_blue", displayName: "Blue", principal: "ACCOUNT" };
const red: RoomActor & MatchActor = { userId: "route-red", username: "route_red", displayName: "Red", principal: "ACCOUNT" };
const guest: RoomActor & MatchActor = { userId: "route-guest", username: "route_guest", displayName: "Guest", principal: "GUEST" };
const outsider: RoomActor & MatchActor = { userId: "route-outsider", username: "route_outsider", displayName: "Outsider", principal: "ACCOUNT" };
const replacement: RoomActor & MatchActor = { userId: "route-replacement", username: "route_replacement", displayName: "Referee mới", principal: "ACCOUNT" };

function fakeReply(): FastifyReply {
  const reply = {
    status: vi.fn(),
    send: vi.fn(),
  } as unknown as FastifyReply;
  (reply.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(reply);
  return reply;
}

async function fixture(playerOne: RoomActor = blue, playerTwo: RoomActor = red) {
  const rooms = new RoomManager();
  const matches = new MatchManager(() => 20_000);
  const roomHost = playerOne.userId === guest.userId ? blue : playerOne;
  const created = await rooms.create(roomHost, {
    name: "R4 API",
    visibility: "PRIVATE",
    password: "secret",
    timerSeconds: 300,
    spectatorsEnabled: true,
    spectatorCapacity: 5,
    refereeEnabled: true,
  });
  const joined = new Set([roomHost.userId]);
  for (const player of [playerOne, playerTwo]) {
    if (joined.has(player.userId) || joined.size >= 2) continue;
    await rooms.join(player, created.roomId, { password: "secret" });
    joined.add(player.userId);
  }
  const invite = await rooms.inviteReferee(roomHost, created.roomId, referee.userId);
  await rooms.acceptRefereeInvite(referee, invite.inviteId);
  const room = rooms.search(created.roomId, referee.userId);
  matches.ensure(room);
  for (const player of room.members) matches.ready(room, player, true);
  matches.refereeConnected(room, referee, "route-client");

  let current: RoomActor = referee;
  const auth = {
    authenticate: vi.fn(async () => ({
      user: { id: current.userId, username: current.username, displayName: current.displayName },
      principal: current.principal ?? "ACCOUNT",
    })),
  } as unknown as AuthService;
  const handlers = new Map<string, Handler>();
  const app = {
    get: (path: string, handler: Handler) => handlers.set("GET " + path, handler),
    post: (path: string, handler: Handler) => handlers.set("POST " + path, handler),
  } as unknown as FastifyInstance;
  await registerMatchRoutes(app, auth, rooms, matches);

  async function call(path: string, actor: RoomActor, body: unknown = {}) {
    current = actor;
    const handler = handlers.get("POST " + path);
    if (!handler) throw new Error("missing handler " + path);
    const reply = fakeReply();
    const request = { params: { roomId: created.roomId }, headers: {}, body } as unknown as FastifyRequest;
    const result = await handler(request, reply);
    const sent = (reply.send as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    return { result: result ?? sent, reply };
  }

  return { roomId: created.roomId, room, rooms, matches, call };
}

describe("R4 Referee route ACL", () => {
  it("allows the appointed Referee to start after both players are Ready", async () => {
    const f = await fixture();
    const response = await f.call("/matches/:roomId/referee/start", referee);
    expect(response.result).toMatchObject({ match: { status: "COUNTDOWN", refereeUserId: referee.userId } });
  });

  it("denies player, Guest and outsider control of Referee endpoints", async () => {
    const playerFixture = await fixture();
    await expect(playerFixture.call("/matches/:roomId/referee/stop", blue)).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const guestFixture = await fixture(guest, red);
    await expect(guestFixture.call("/matches/:roomId/referee/stop", guest)).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const outsiderFixture = await fixture();
    await expect(outsiderFixture.call("/matches/:roomId/referee/stop", outsider)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects FastReady in a Referee room and never starts from player actions", async () => {
    const f = await fixture();
    const response = await f.call("/matches/:roomId/referee/start", referee);
    expect(response.result).toMatchObject({ match: { status: "COUNTDOWN" } });
    await expect(f.call("/matches/:roomId/fast-ready", blue)).rejects.toMatchObject({
      code: "CONFLICT",
      details: { reason: "REFEREE_START_REQUIRED" },
    });
  });

  it("keeps the selected public pause category in the authoritative snapshot", async () => {
    const f = await fixture();
    const started = await f.call("/matches/:roomId/referee/start", referee);
    expect(started.result).toMatchObject({ match: { status: "COUNTDOWN" } });
    const stopped = await f.call("/matches/:roomId/referee/stop", referee, { category: "RULE_QUESTION" });
    expect(stopped.result).toMatchObject({ match: { status: "PAUSED", pauseReason: "REFEREE", pauseCategory: "RULE_QUESTION" } });
  });

  it("requires both players to consent before an account accepts referee replacement", async () => {
    const f = await fixture();
    f.matches.start(f.room, referee);
    f.matches.ensure(f.room);
    f.matches.refereeDisconnected(f.room, referee, "route-client");
    f.rooms.markRefereeConnected(f.roomId, referee.userId, false);
    const nominated = await f.call("/matches/:roomId/referee/replacement/nominate", blue, { targetUserId: replacement.userId });
    expect(nominated.result).toMatchObject({ match: { replacementStatus: "NOMINATED", replacementCandidateUserId: replacement.userId } });
    await expect(f.call("/matches/:roomId/referee/replacement/accept", replacement)).rejects.toMatchObject({ details: { reason: "REPLACEMENT_CONSENT_REQUIRED" } });
    await f.call("/matches/:roomId/referee/replacement/approve", blue);
    await f.call("/matches/:roomId/referee/replacement/approve", red);
    const accepted = await f.call("/matches/:roomId/referee/replacement/accept", replacement);
    expect(accepted.result).toMatchObject({ match: { replacementStatus: "IDLE", refereeUserId: replacement.userId, refereeConnected: true } });
    expect(f.rooms.search(f.roomId, referee.userId).isReferee).toBe(false);
    expect(f.rooms.search(f.roomId, replacement.userId).isReferee).toBe(true);
  });
});
