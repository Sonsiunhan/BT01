import { afterEach, describe, expect, it, vi } from "vitest";

import { getJson, requestJson } from "./httpClient";

describe("W5 HTTP session and network signals", () => {
  it("does not advertise an empty JSON document for bodyless preflight and delete requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    for (const method of ["POST", "DELETE"] as const) {
      await requestJson("/guest/bot-library/preflight", { method });
      const options = fetchMock.mock.calls.at(-1)![1];
      expect(options.body).toBeUndefined();
      expect(options.headers).not.toHaveProperty("Content-Type");
    }
    await requestJson("/guest/bot-library/stage", { method: "POST", body: { name: "Fixture" } });
    expect(fetchMock.mock.calls.at(-1)![1]).toMatchObject({ headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Fixture" }) });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    window.removeEventListener("ottv2:session-expired", () => undefined);
  });

  it("signals session expiry for protected API responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "expired", code: "UNAUTHORIZED" }), { status: 401, headers: { "Content-Type": "application/json" } })));
    const listener = vi.fn();
    window.addEventListener("ottv2:session-expired", listener);
    await expect(getJson("/matches/ROOM01")).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not turn the initial auth probe into a session-expired modal", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "not signed in", code: "UNAUTHORIZED" }), { status: 401, headers: { "Content-Type": "application/json" } })));
    const listener = vi.fn();
    window.addEventListener("ottv2:session-expired", listener);
    await expect(getJson("/auth/me")).rejects.toMatchObject({ status: 401 });
    expect(listener).not.toHaveBeenCalled();
  });
  it("allows explicit Guest library fallback without a global login modal", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Guest", code: "UNAUTHORIZED" }), { status: 401 })));
    const listener = vi.fn();
    window.addEventListener("ottv2:session-expired", listener);
    try {
      await expect(getJson("/bot-library", undefined, { handleUnauthorized: true })).rejects.toMatchObject({ status: 401 });
      expect(listener).not.toHaveBeenCalled();
    } finally { window.removeEventListener("ottv2:session-expired", listener); }
  });

  it("signals offline when the API cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    const listener = vi.fn();
    window.addEventListener("ottv2:network-state", listener);
    await expect(getJson("/matches/ROOM01")).rejects.toMatchObject({ message: "Không thể kết nối tới máy chủ." });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: { state: "OFFLINE" } }));
  });

  it("signals degraded and emits request telemetry for server failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "degraded", code: "SERVICE_UNAVAILABLE" }), { status: 503, headers: { "Content-Type": "application/json" } })));
    const network = vi.fn();
    const telemetry = vi.fn();
    window.addEventListener("ottv2:network-state", network);
    window.addEventListener("ottv2:ui-telemetry", telemetry);
    await expect(getJson("/health")).rejects.toMatchObject({ status: 503 });
    expect(network).toHaveBeenCalledWith(expect.objectContaining({ detail: { state: "DEGRADED" } }));
    const telemetryEvent = (telemetry.mock.calls[0]?.[0] as CustomEvent).detail as { name: string; detail?: Record<string, unknown> };
    expect(telemetryEvent).toMatchObject({ name: "http_request", detail: { state: "DEGRADED", status: 503 } });
  });

  it("injects X-OTT-Request header on GET and mutation requests", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    await getJson("/matches/ROOM01");
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("/matches/ROOM01"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-OTT-Request": "1",
          Accept: "application/json",
        }),
      })
    );

    await requestJson("/matches/ROOM01/moves", { method: "POST", body: { square: "E5" } });
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("/matches/ROOM01/moves"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-OTT-Request": "1",
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("preserves commandId via X-Command-Id header when specified", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ accepted: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await requestJson("/matches/ROOM01/moves", {
      method: "POST",
      body: { square: "E5" },
      commandId: "cmd-uuid-1234",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/matches/ROOM01/moves"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Command-Id": "cmd-uuid-1234",
        }),
      })
    );
  });

  it("does not dispatch ottv2:session-expired on 403 Forbidden", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ message: "Forbidden room action", code: "FORBIDDEN", severity: "ROOM_EXPIRED" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    const listener = vi.fn();
    window.addEventListener("ottv2:session-expired", listener);

    await expect(requestJson("/matches/ROOM01/moves", { method: "POST", body: {} })).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener("ottv2:session-expired", listener);
  });

  it("populates ApiError envelope fields (retryable, severity, details) from server error payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            message: "Nước đi không hợp lệ theo luật.",
            code: "RULE_VIOLATION",
            retryable: false,
            severity: "REJECTED_MOVE",
            details: { reason: "CANNOT_CAPTURE_OWN_PIECE", square: "E5" },
          }),
          { status: 422, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    let caughtError: unknown;
    try {
      await requestJson("/matches/ROOM01/moves", { method: "POST", body: {} });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toMatchObject({
      status: 422,
      code: "RULE_VIOLATION",
      retryable: false,
      severity: "REJECTED_MOVE",
      details: { reason: "CANNOT_CAPTURE_OWN_PIECE", square: "E5" },
    });
  });
});

