import { describe, expect, it, vi } from "vitest";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { AuthService } from "../../src/modules/auth/auth.service.js";
import { BotLibraryService } from "../../src/modules/bot-library/bot-library.service.js";
import { registerBotLibraryRoutes } from "../../src/modules/bot-library/bot-library.route.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

const account = { userId: "r9-account", principal: "ACCOUNT" as const };
const otherAccount = { userId: "r9-other", principal: "ACCOUNT" as const };
const guest = { userId: "r9-guest", principal: "GUEST" as const };

function fakeReply(): FastifyReply {
  const reply = { status: vi.fn(), send: vi.fn() } as unknown as FastifyReply;
  (reply.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(reply);
  return reply;
}

describe("R9 Bot Library private API", () => {
  function fixture() {
    let current = account;
    const auth = {
      authenticate: vi.fn(async () => ({ user: { id: current.userId }, principal: current.principal })),
    } as unknown as AuthService;
    const library = new BotLibraryService();
    const handlers = new Map<string, Handler>();
    const app = {
      get: (path: string, handler: Handler) => handlers.set("GET " + path, handler),
      post: (path: string, handler: Handler) => handlers.set("POST " + path, handler),
      delete: (path: string, handler: Handler) => handlers.set("DELETE " + path, handler),
    } as unknown as FastifyInstance;
    return { auth, library, handlers, app, setActor: (actor: typeof account) => { current = actor; } };
  }

  it("rejects Guests and keeps the source private to its owner", async () => {
    const f = fixture();
    await registerBotLibraryRoutes(f.app, f.auth, f.library);
    const list = f.handlers.get("GET /bot-library");
    const source = f.handlers.get("GET /bot-library/bots/:botId/revisions/:revisionId/source");
    if (!list || !source) throw new Error("missing R9 handlers");
    f.setActor(guest);
    await expect(list({ headers: {} } as FastifyRequest, fakeReply())).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    f.setActor(account);
    const created = await f.library.createBot(account.userId, "Bot chiến thuật", "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n");
    f.setActor(otherAccount);
    await expect(source({ params: { botId: created.bot.id, revisionId: created.revision.id }, headers: {} } as unknown as FastifyRequest, fakeReply())).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("runs the SDK preflight and returns immutable revision metadata without source in list", async () => {
    const f = fixture();
    await registerBotLibraryRoutes(f.app, f.auth, f.library);
    const create = f.handlers.get("POST /bot-library/bots");
    const list = f.handlers.get("GET /bot-library");
    if (!create || !list) throw new Error("missing R9 handlers");
    const reply = fakeReply();
    const source = "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n";
    await create({ body: { name: "Bot xanh", source }, headers: {} } as unknown as FastifyRequest, reply);
    const payload = (reply.send as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as { bot: { revisions: Array<Record<string, unknown>> }; revision: Record<string, unknown> };
    expect(payload.revision).toMatchObject({ status: "READY", sdkVersion: expect.any(String), schemaVersion: expect.any(String), sourceDigest: expect.stringMatching(/^[a-f0-9]{64}$/), sourceBytes: source.length });
    expect(payload.revision).not.toHaveProperty("source");
    const listReply = fakeReply();
    await list({ headers: {} } as unknown as FastifyRequest, listReply);
    const listed = (listReply.send as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as { bots: Array<{ revisions: Array<Record<string, unknown>> }> };
    expect(listed.bots[0]?.revisions[0]).not.toHaveProperty("source");
  });

  it("blocks deletion of an active revision and exposes SDK docs/template privately", async () => {
    const f = fixture();
    await registerBotLibraryRoutes(f.app, f.auth, f.library);
    const created = await f.library.createBot(account.userId, "Active", "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n");
    f.library.markRevisionActive(created.revision.id);
    const remove = f.handlers.get("DELETE /bot-library/bots/:botId/revisions/:revisionId");
    const sdk = f.handlers.get("GET /bot-library/sdk");
    if (!remove || !sdk) throw new Error("missing R9 handlers");
    await expect(remove({ params: { botId: created.bot.id, revisionId: created.revision.id }, headers: {} } as unknown as FastifyRequest, fakeReply())).rejects.toMatchObject({ code: "CONFLICT" });
    const sdkReply = fakeReply();
    await sdk({ headers: {} } as unknown as FastifyRequest, sdkReply);
    expect((sdkReply.send as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0]).toMatchObject({ sdkVersion: expect.any(String), template: expect.stringContaining("choose_move"), allowlist: expect.arrayContaining(["math"]) });
  });
});
