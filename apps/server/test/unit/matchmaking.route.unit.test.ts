import { request } from "node:http";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type { AuthService } from "../../src/modules/auth/auth.service.js";
import { registerCors } from "../../src/plugins/cors.js";
import { MatchManager } from "../../src/modules/match/match.manager.js";
import { RoomManager } from "../../src/modules/room/room.manager.js";
import { MatchmakingManager } from "../../src/modules/matchmaking/matchmaking.manager.js";
import { registerMatchmakingRoutes } from "../../src/modules/matchmaking/matchmaking.route.js";
import { GUEST_SESSION_COOKIE } from "../../src/modules/auth/auth.service.js";
import type { BotLibraryService } from "../../src/modules/bot-library/bot-library.service.js";

describe("R1 queue SSE authorization and CORS", () => {
  it("keeps Bot queue admission bound to the authenticated principal", async () => {
    const app = Fastify();
    const matches = new MatchManager();
    const matchmaking = new MatchmakingManager(new RoomManager(), matches);
    const account = { user: { id: "account:bot", username: "bot_account", displayName: "Bot account" }, principal: "ACCOUNT" };
    const auth = { authenticate: async () => account } as unknown as AuthService;
    const library = {
      source: async () => "fixed-private-source",
      list: async () => ({ bots: [{ id: "00000000-0000-4000-8000-000000000101", revisions: [{ id: "00000000-0000-4000-8000-000000000102", status: "PASSED" }] }] }),
    } as unknown as BotLibraryService;
    await registerMatchmakingRoutes(app, auth, matchmaking, library);
    try {
      const staleGuest = await app.inject({ method: "POST", url: "/matchmaking/queue", headers: { "x-expected-principal": "GUEST" }, payload: { mode: "BOT", botId: "00000000-0000-4000-8000-000000000101", revisionId: "00000000-0000-4000-8000-000000000102" } });
      expect(staleGuest.statusCode).toBe(409);
      const admitted = await app.inject({ method: "POST", url: "/matchmaking/queue", payload: { mode: "BOT", botId: "00000000-0000-4000-8000-000000000101", revisionId: "00000000-0000-4000-8000-000000000102" } });
      expect(admitted.statusCode).toBe(200);
      expect(admitted.json().queue.mode).toBe("BOT");
    } finally { await app.close(); matchmaking.stop(); matches.stop(); }
  });

  it("allows a cookie Guest to cancel ordinary matchmaking after login without admitting Ranked", async () => {
    const app = Fastify();
    const matches = new MatchManager();
    const matchmaking = new MatchmakingManager(new RoomManager(), matches);
    const guest = { user: { id: "guest:test", username: "guest_test", displayName: "Khách" }, principal: "GUEST" };
    const account = { user: { id: "account:test", username: "account_test", displayName: "Tài khoản" }, principal: "ACCOUNT" };
    const auth = { authenticate: async () => account, authenticateAny: async (token?: string) => token ? account : guest } as unknown as AuthService;
    await registerMatchmakingRoutes(app, auth, matchmaking);
    try {
      const cookie = `${GUEST_SESSION_COOKIE}=guest-token`;
      const joined = await app.inject({ method: "POST", url: "/matchmaking/queue", headers: { cookie }, payload: { mode: "UNRANKED" } });
      expect(joined.statusCode).toBe(200);
      const queueId = joined.json().queue.queueId as string;
      expect(joined.json().queue.player.userId).toBe("guest:test");
      const cancelled = await app.inject({ method: "DELETE", url: `/matchmaking/queue/${queueId}`, headers: { cookie: `${cookie}; ottv2_session=account-token` } });
      expect(cancelled.statusCode).toBe(200);
      expect(cancelled.json().queue.status).toBe("CANCELLED");
      const denied = await app.inject({ method: "POST", url: "/matchmaking/queue", headers: { cookie }, payload: { mode: "RANKED" } });
      expect(denied.statusCode).toBe(403);
    } finally { await app.close(); matchmaking.stop(); matches.stop(); }
  });
  it("uses configured origins and rejects unknown queues before opening a stream", async () => {
    const app = Fastify();
    const matches = new MatchManager();
    const matchmaking = new MatchmakingManager(new RoomManager(), matches);
    const user = { id: "queue-user", username: "queue_user", displayName: "Queue User", stats: { elo: 1000 } };
    let currentUser = user;
    const auth = { authenticate: async () => ({ user: currentUser }) } as unknown as AuthService;
    const queue = await matchmaking.join({ userId: user.id, username: user.username, displayName: user.displayName }, 1000);
    await registerCors(app, ["https://ott.example"]);
    await registerMatchmakingRoutes(app, auth, matchmaking);
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    try {
      for (const origin of ["https://ott.example", "https://untrusted.example"]) {
        const headers = await new Promise<Record<string, string | string[] | undefined>>((resolve, reject) => {
          const client = request(`${address}/matchmaking/queue/${queue.queueId}/events`, { headers: { Origin: origin } }, (response) => {
            response.once("data", () => { resolve(response.headers); client.destroy(); });
          });
          client.on("error", reject);
          client.end();
        });
        expect(headers["access-control-allow-origin"]).toBe(origin === "https://ott.example" ? origin : undefined);
        if (origin === "https://ott.example") expect(headers["access-control-allow-credentials"]).toBe("true");
      }
      const missing = await app.inject({ url: "/matchmaking/queue/00000000-0000-4000-8000-000000000099/events" });
      expect(missing.statusCode).toBe(404);
      expect(missing.headers["content-type"]).toContain("application/json");
      currentUser = { ...user, id: "outsider" };
      const denied = await app.inject({ url: `/matchmaking/queue/${queue.queueId}/events` });
      expect(denied.statusCode).toBe(404);
      expect(denied.headers["content-type"]).toContain("application/json");
    } finally {
      await app.close();
      matchmaking.stop();
      matches.stop();
    }
  });

  it("keeps a queue SSE stream alive after the request input has completed", async () => {
    const app = Fastify();
    const matches = new MatchManager();
    const matchmaking = new MatchmakingManager(new RoomManager(), matches);
    const blue = { id: "queue-blue", username: "queue_blue", displayName: "Queue Blue", stats: { elo: 1000 } };
    const red = { id: "queue-red", username: "queue_red", displayName: "Queue Red", stats: { elo: 1000 } };
    const auth = { authenticate: async () => ({ user: blue }) } as unknown as AuthService;
    const queue = await matchmaking.join({ userId: blue.id, username: blue.username, displayName: blue.displayName }, 1000, "client-blue");
    await registerCors(app, ["https://ott.example"]);
    await registerMatchmakingRoutes(app, auth, matchmaking);
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    let client: ReturnType<typeof request> | undefined;
    try {
      const found = await new Promise<boolean>((resolve, reject) => {
        let joined = false;
        let buffer = "";
        const timeout = setTimeout(() => reject(new Error("Queue SSE did not deliver MATCH_FOUND after request completion.")), 2_000);
        client = request(`${address}/matchmaking/queue/${queue.queueId}/events`, (response) => {
          response.setEncoding("utf8");
          response.on("data", (chunk: string) => {
            buffer += chunk;
            if (!joined && buffer.includes('"type":"QUEUE_JOINED"')) {
              joined = true;
              setTimeout(() => { void matchmaking.join({ userId: red.id, username: red.username, displayName: red.displayName }, 1000, "client-red"); }, 50);
            }
            if (buffer.includes('"type":"MATCH_FOUND"')) {
              clearTimeout(timeout);
              resolve(true);
            }
          });
        });
        client.on("error", reject);
        client.end();
      });
      expect(found).toBe(true);
    } finally {
      client?.destroy();
      await app.close();
      matchmaking.stop();
      matches.stop();
    }
  });
});
