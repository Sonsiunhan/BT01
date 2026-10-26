import { describe, expect, it, vi } from "vitest";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { CapacityController } from "../../src/modules/capacity/capacity.controller.js";
import { registerCapacityAdmissionHook } from "../../src/modules/capacity/capacity.hook.js";
import { DEFAULT_BUDGET_PROFILE_V0 } from "../../src/config/budget-profile.js";

type HookHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

function createController(): CapacityController {
  return new CapacityController({
    profile: DEFAULT_BUDGET_PROFILE_V0,
    now: () => 1_000_000,
    thresholds: {
      highEventLoopLagMs: 50,
      lowEventLoopLagMs: 20,
      highHeapPercent: 85,
      lowHeapPercent: 70,
      highRssBytes: 1024 * 1024 * 1024,
      lowRssBytes: 800 * 1024 * 1024,
      cooldownPeriodMs: 5000,
      recoveryProbeBudget: 3,
      reconnectJitterMaxMs: 2000,
    },
  });
}

function capturePreHandlerHook(controller: CapacityController): HookHandler {
  const hooks = new Map<string, HookHandler>();
  const app = {
    addHook: (name: string, handler: HookHandler) => {
      hooks.set(name, handler);
    },
  } as unknown as FastifyInstance;
  registerCapacityAdmissionHook(app, controller);
  const preHandler = hooks.get("preHandler");
  if (!preHandler) throw new Error("preHandler capacity hook was not registered");
  return preHandler;
}

function fakeReply() {
  const reply: Record<string, unknown> = {};
  reply.header = vi.fn();
  reply.status = vi.fn(() => reply);
  reply.send = vi.fn();
  return reply as unknown as FastifyReply & {
    status: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };
}

function fakeRequest(options: { headers?: Record<string, string>; ip?: string } = {}): FastifyRequest {
  return {
    url: "/rooms/test-room",
    method: "POST",
    headers: options.headers ?? {},
    ip: options.ip ?? "203.0.113.7",
    raw: {} as Record<string, unknown>,
  } as unknown as FastifyRequest;
}

describe("Capacity admission hook — per-client principal id (L-07.03)", () => {
  it("uses each client's session cookie as its own admission bucket", async () => {
    const controller = createController();
    const acquireSpy = vi.spyOn(controller, "acquire");
    const preHandler = capturePreHandlerHook(controller);

    await preHandler(fakeRequest({ headers: { cookie: "ottv2_session=session-alice" } }), fakeReply());
    await preHandler(fakeRequest({ headers: { cookie: "ottv2_session=session-bob" } }), fakeReply());

    expect(acquireSpy).toHaveBeenCalledTimes(2);
    expect(acquireSpy.mock.calls[0]?.[1]).toBe("session-alice");
    expect(acquireSpy.mock.calls[1]?.[1]).toBe("session-bob");
    expect(acquireSpy.mock.calls[0]?.[1]).not.toBe(acquireSpy.mock.calls[1]?.[1]);
  });

  it("never uses the constant X-OTT-Request value \"1\" as a principal id", async () => {
    const controller = createController();
    const acquireSpy = vi.spyOn(controller, "acquire");
    const preHandler = capturePreHandlerHook(controller);

    await preHandler(fakeRequest({ headers: { "x-ott-request": "1" }, ip: "198.51.100.9" }), fakeReply());

    expect(acquireSpy).toHaveBeenCalledTimes(1);
    const principalId = acquireSpy.mock.calls[0]?.[1];
    expect(principalId).not.toBe("1");
    expect(principalId).toBe("198.51.100.9");
  });

  it("falls back to the guest session cookie before IP for guest principals", async () => {
    const controller = createController();
    const acquireSpy = vi.spyOn(controller, "acquire");
    const preHandler = capturePreHandlerHook(controller);

    await preHandler(fakeRequest({ headers: { cookie: "ottv2_guest=guest-token-9" } }), fakeReply());

    expect(acquireSpy.mock.calls[0]?.[1]).toBe("guest-token-9");
  });

  it("keeps x-client-id for machine clients that carry no session", async () => {
    const controller = createController();
    const acquireSpy = vi.spyOn(controller, "acquire");
    const preHandler = capturePreHandlerHook(controller);

    await preHandler(fakeRequest({ headers: { "x-client-id": "load-runner-1" } }), fakeReply());

    expect(acquireSpy.mock.calls[0]?.[1]).toBe("load-runner-1");
  });

  it("enforces the per-principal quota per session bucket, not globally across users", async () => {
    const controller = createController();
    const preHandler = capturePreHandlerHook(controller);
    const lobbyQuota = controller.getPool("lobby").perPrincipalQuota;

    // One principal fills its own quota; each extra in-flight request is shed with 503.
    for (let i = 0; i < lobbyQuota; i += 1) {
      const reply = fakeReply();
      await preHandler(fakeRequest({ headers: { cookie: "ottv2_session=session-alice" } }), reply);
      expect(reply.status).not.toHaveBeenCalled();
    }
    const shedReply = fakeReply();
    await preHandler(fakeRequest({ headers: { cookie: "ottv2_session=session-alice" } }), shedReply);
    expect(shedReply.status).toHaveBeenCalledWith(503);
    expect(shedReply.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: "SERVICE_UNAVAILABLE" })
    );

    // A different principal keeps its own bucket and is still admitted.
    const otherReply = fakeReply();
    await preHandler(fakeRequest({ headers: { cookie: "ottv2_session=session-bob" } }), otherReply);
    expect(otherReply.status).not.toHaveBeenCalled();
  });
});
