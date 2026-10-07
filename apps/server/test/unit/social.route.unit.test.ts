import { describe, expect, it, vi } from "vitest";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { AuthService } from "../../src/modules/auth/auth.service.js";
import { registerSocialRoutes } from "../../src/modules/social/social.route.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

describe("R12 social presence route", () => {
  it("uses the configured CORS origin for presence SSE instead of localhost", async () => {
    const handlers = new Map<string, Handler>();
    const app = { get: (path: string, handler: Handler) => handlers.set("GET " + path, handler), post: vi.fn(), delete: vi.fn() } as unknown as FastifyInstance;
    const auth = { authenticate: vi.fn(async () => ({ user: { id: "viewer", username: "viewer", displayName: "Viewer" }, principal: "ACCOUNT" })) } as unknown as AuthService;
    const social = { subscribePresence: vi.fn(async () => () => undefined), markOnline: vi.fn(async () => undefined) } as never;
    await registerSocialRoutes(app, auth, social, ["https://arena.example", "https://ott-v2.onrender.com"]);
    const handler = handlers.get("GET /social/presence/events");
    if (!handler) throw new Error("missing presence handler");
    const raw = { writeHead: vi.fn(), write: vi.fn(), on: vi.fn() };
    const reply = { raw, hijack: vi.fn() } as unknown as FastifyReply;
    await handler({ headers: { origin: "https://arena.example" }, raw } as unknown as FastifyRequest, reply);
    expect(raw.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ "Access-Control-Allow-Origin": "https://arena.example", Vary: "Origin" }));
    expect(raw.writeHead.mock.calls[0]?.[1]?.["Access-Control-Allow-Origin"]).not.toBe("http://localhost:3000");
  });
});
