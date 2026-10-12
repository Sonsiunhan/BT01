import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerErrorHandler } from "../../src/plugins/error-handler.js";
import { AppError } from "../../src/shared/errors/app-error.js";

describe("public error boundary privacy (W3)", () => {
  it("keeps bounded operational fields and removes source/secret details", async () => {
    const app = Fastify({ logger: false });
    registerErrorHandler(app);
    app.get("/canary", async () => {
      throw new AppError("UNAUTHORIZED", "Không được phép.", 403, false, "INVALID", {
        reason: "ACCESS_DENIED",
        stateVersion: 4,
        secret: "CANARY_AUDIT_NOT_A_REAL_SECRET",
        source: "private python source",
        input: { password: "do-not-return" },
        stack: "private stack",
      });
    });

    const response = await app.inject({ method: "GET", url: "/canary" });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      code: "UNAUTHORIZED",
      message: "Không được phép.",
      retryable: false,
      severity: "INVALID",
      details: { reason: "ACCESS_DENIED", stateVersion: 4 },
    });
    expect(response.body).not.toContain("CANARY_AUDIT_NOT_A_REAL_SECRET");
    expect(response.body).not.toContain("private python source");
    await app.close();
  });
});
