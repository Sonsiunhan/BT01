import { describe, expect, it, vi } from "vitest";

import { AuthService } from "../../src/modules/auth/auth.service.js";

describe("R4 auth session lifecycle", () => {
  it("notifies active stream owners when the authenticated session logs out", async () => {
    const session = {
      id: "session-r4",
      userId: "user-r4",
      tokenHash: "stored-hash",
      remember: true,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };
    const db = {
      session: {
        findUnique: vi.fn(async () => session),
        update: vi.fn(async () => session),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      user: {
        findUnique: vi.fn(async () => ({
          id: session.userId,
          fullName: "R4",
          displayName: "R4",
          username: "r4",
          usernameNormalized: "r4",
          passwordHash: "",
          recoveryCodeHash: "",
          recoveryUsedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          profile: null,
          stats: null,
        })),
      },
    };
    const service = new AuthService(db as never);
    const context = await service.authenticate("r4-token");
    const revoked = vi.fn();
    service.subscribeSessionRevocation(context.session.id, revoked);
    await service.logout("r4-token");
    expect(revoked).toHaveBeenCalledTimes(1);
  });

  it("does not notify after a stream unsubscribes", async () => {
    const session = {
      id: "session-r4-unsub",
      userId: "user-r4-unsub",
      tokenHash: "stored-hash",
      remember: true,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };
    const db = {
      session: {
        findUnique: vi.fn(async () => session),
        update: vi.fn(async () => session),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      user: {
        findUnique: vi.fn(async () => ({ ...session, fullName: "R4", displayName: "R4", username: "r4", usernameNormalized: "r4", profile: null, stats: null })),
      },
    };
    const service = new AuthService(db as never);
    const context = await service.authenticate("r4-token-unsub");
    const revoked = vi.fn();
    const unsubscribe = service.subscribeSessionRevocation(context.session.id, revoked);
    unsubscribe();
    await service.logout("r4-token-unsub");
    expect(revoked).not.toHaveBeenCalled();
  });
});
