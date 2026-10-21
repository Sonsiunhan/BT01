import { describe, expect, it, vi } from "vitest";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AppEnv } from "../../apps/server/src/config/env.js";
import { AuthService, type AuthContext } from "../../apps/server/src/modules/auth/auth.service.js";
import { registerAuthRoutes } from "../../apps/server/src/modules/auth/auth.route.js";
import { AppError } from "../../apps/server/src/shared/errors/app-error.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

function fakeReply(): FastifyReply {
  const reply = {
    status: vi.fn(),
    send: vi.fn(),
    header: vi.fn(),
  } as unknown as FastifyReply;
  (reply.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(reply);
  (reply.send as unknown as ReturnType<typeof vi.fn>).mockReturnValue(reply);
  (reply.header as unknown as ReturnType<typeof vi.fn>).mockReturnValue(reply);
  return reply;
}

describe("D02 — AuthService.bootstrapTA unit tests", () => {
  const mockSystemAdminUser = {
    id: "sa-1",
    fullName: "System Administrator",
    displayName: "Admin SA",
    username: "system_admin",
    usernameNormalized: "system_admin",
    role: "SYSTEM_ADMIN",
    passwordHash: "secret-hash",
    recoveryCodeHash: "rec-hash",
    recoveryUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: null,
    stats: null,
  };

  const mockRegularUser = {
    ...mockSystemAdminUser,
    id: "user-1",
    username: "regular_user",
    role: "USER",
  };

  const makeAuthContext = (user: any, principal: "ACCOUNT" | "GUEST" = "ACCOUNT"): AuthContext => ({
    session: { id: "s-1", userId: user.id, tokenHash: "th", remember: false, expiresAt: new Date(Date.now() + 10000), revokedAt: null, createdAt: new Date(), lastUsedAt: new Date() },
    user,
    principal,
  });

  it("rejects non-ACCOUNT principal (e.g. GUEST)", async () => {
    const service = new AuthService({} as never);
    const guestContext = makeAuthContext(mockSystemAdminUser, "GUEST");

    await expect(service.bootstrapTA(guestContext)).rejects.toThrowError(AppError);
    await expect(service.bootstrapTA(guestContext)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      statusCode: 401,
    });
  });

  it("rejects caller without SYSTEM_ADMIN role", async () => {
    const service = new AuthService({} as never);
    const userContext = makeAuthContext(mockRegularUser, "ACCOUNT");

    await expect(service.bootstrapTA(userContext)).rejects.toThrowError(AppError);
    await expect(service.bootstrapTA(userContext)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      statusCode: 403,
    });
  });

  it("is idempotent: returns existing TA if one already exists", async () => {
    const existingTA = {
      id: "ta-existing-id",
      fullName: "Tournament Admin",
      displayName: "Tournament Admin",
      username: "ta_existing",
      usernameNormalized: "ta_existing",
      role: "TOURNAMENT_ADMIN",
      passwordHash: "existing-hash",
      recoveryCodeHash: "existing-rec",
      recoveryUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      profile: { theme: "system", avatarPreset: "robot", presenceVisibility: "FRIENDS", friendListVisibility: "PRIVATE", fullNameVisibility: "PRIVATE" },
      stats: { elo: 1000, rankedWins: 0, rankedLosses: 0, quickWins: 0, quickLosses: 0 },
    };

    const userFindFirst = vi.fn(async () => existingTA);
    const userCreate = vi.fn();
    const db = {
      user: {
        findFirst: userFindFirst,
        create: userCreate,
      },
    };

    const service = new AuthService(db as never);
    const saContext = makeAuthContext(mockSystemAdminUser, "ACCOUNT");

    const result = await service.bootstrapTA(saContext);

    expect(userFindFirst).toHaveBeenCalledTimes(1);
    expect(userCreate).not.toHaveBeenCalled();
    expect(result.id).toBe("ta-existing-id");
    expect(result.username).toBe("ta_existing");
    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("recoveryCodeHash");
  });

  it("creates a new TA when none exists, without exposing secrets", async () => {
    const createdTA = {
      id: "ta-new-id",
      fullName: "Tournament Admin",
      displayName: "Tournament Admin",
      username: "ta_new",
      usernameNormalized: "ta_new",
      role: "TOURNAMENT_ADMIN",
      passwordHash: "generated-hash",
      recoveryCodeHash: "generated-rec",
      recoveryUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      profile: { theme: "system", avatarPreset: "robot", presenceVisibility: "FRIENDS", friendListVisibility: "PRIVATE", fullNameVisibility: "PRIVATE" },
      stats: { elo: 1000, rankedWins: 0, rankedLosses: 0, quickWins: 0, quickLosses: 0 },
    };

    const userFindFirst = vi.fn(async () => null);
    const userCreate = vi.fn(async () => createdTA);
    const db = {
      user: {
        findFirst: userFindFirst,
        create: userCreate,
      },
    };

    const service = new AuthService(db as never);
    const saContext = makeAuthContext(mockSystemAdminUser, "ACCOUNT");

    const result = await service.bootstrapTA(saContext);

    expect(userFindFirst).toHaveBeenCalledTimes(1);
    expect(userCreate).toHaveBeenCalledTimes(1);
    expect(userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: "TOURNAMENT_ADMIN",
          fullName: "Tournament Admin",
          displayName: "Tournament Admin",
        }),
      })
    );
    expect(result.id).toBe("ta-new-id");
    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("recoveryCodeHash");
  });
});

describe("D02 — HTTP route /admin/bootstrap-ta", () => {
  const env: AppEnv = {
    NODE_ENV: "test",
    PORT: 3000,
    HOST: "127.0.0.1",
  } as unknown as AppEnv;

  const mockSaProfile = {
    id: "sa-1",
    fullName: "System Admin",
    displayName: "Admin SA",
    username: "system_admin",
    theme: "system" as const,
    avatarPreset: "robot" as const,
    privacy: { presenceVisibility: "FRIENDS" as const, friendListVisibility: "PRIVATE" as const, fullNameVisibility: "PRIVATE" as const },
    stats: { elo: 1000, rankedWins: 0, rankedLosses: 0, quickWins: 0, quickLosses: 0 },
    botStats: { wins: 0, losses: 0 },
  };

  const mockTaProfile = {
    id: "ta-bootstrapped-id",
    fullName: "Tournament Admin",
    displayName: "Tournament Admin",
    username: "ta_bootstrapped",
    theme: "system" as const,
    avatarPreset: "robot" as const,
    privacy: { presenceVisibility: "FRIENDS" as const, friendListVisibility: "PRIVATE" as const, fullNameVisibility: "PRIVATE" as const },
    stats: { elo: 1000, rankedWins: 0, rankedLosses: 0, quickWins: 0, quickLosses: 0 },
    botStats: { wins: 0, losses: 0 },
  };

  async function setupApp(serviceMock: Partial<AuthService>) {
    const handlers = new Map<string, Handler>();
    const app = {
      get: (path: string, handler: Handler) => handlers.set("GET " + path, handler),
      post: (path: string, handler: Handler) => handlers.set("POST " + path, handler),
      delete: (path: string, handler: Handler) => handlers.set("DELETE " + path, handler),
    } as unknown as FastifyInstance;

    await registerAuthRoutes(app, serviceMock as AuthService, env);

    async function call(method: "POST" | "GET", path: string, cookie?: string, body?: unknown) {
      const handler = handlers.get(`${method} ${path}`);
      if (!handler) throw new Error(`Handler not found for ${method} ${path}`);
      const reply = fakeReply();
      const request = {
        headers: cookie ? { cookie } : {},
        body,
        ip: "127.0.0.1",
      } as unknown as FastifyRequest;
      const res = await handler(request, reply);
      const sent = (reply.send as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
      const statusCode = (reply.status as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] ?? 200;
      return { statusCode, body: sent ?? res };
    }

    return { call };
  }

  it("denies access when unauthenticated (missing cookie)", async () => {
    const serviceMock: Partial<AuthService> = {
      authenticate: vi.fn(async () => {
        throw new AppError("UNAUTHORIZED", "Bạn cần đăng nhập để tiếp tục.", 401, false, "FATAL_SESSION");
      }),
      bootstrapTA: vi.fn(),
    };

    const { call } = await setupApp(serviceMock);

    await expect(call("POST", "/admin/bootstrap-ta")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      statusCode: 401,
    });
    expect(serviceMock.bootstrapTA).not.toHaveBeenCalled();
  });

  it("denies access when user is not SYSTEM_ADMIN", async () => {
    const serviceMock: Partial<AuthService> = {
      authenticate: vi.fn(async () => ({
        user: { id: "user-1", username: "player1", role: "USER" },
        principal: "ACCOUNT",
      } as any)),
      bootstrapTA: vi.fn(async () => {
        throw new AppError("UNAUTHORIZED", "Only System Admin can bootstrap TA", 403, false, "INVALID");
      }),
    };

    const { call } = await setupApp(serviceMock);

    await expect(call("POST", "/admin/bootstrap-ta", "ottv2_session=valid-user-token")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      statusCode: 403,
    });
  });

  it("allows SYSTEM_ADMIN and returns bootstrapped TA account without secrets", async () => {
    const serviceMock: Partial<AuthService> = {
      authenticate: vi.fn(async () => ({
        user: { id: "sa-1", username: "admin", role: "SYSTEM_ADMIN" },
        principal: "ACCOUNT",
      } as any)),
      bootstrapTA: vi.fn(async () => mockTaProfile),
    };

    const { call } = await setupApp(serviceMock);

    const response = await call("POST", "/admin/bootstrap-ta", "ottv2_session=valid-sa-token", {});

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ user: mockTaProfile });
    expect(response.body.user).not.toHaveProperty("password");
    expect(response.body.user).not.toHaveProperty("passwordHash");
    expect(response.body.user).not.toHaveProperty("recoveryCodeHash");
    expect(serviceMock.bootstrapTA).toHaveBeenCalledTimes(1);
  });

  it("also supports /auth/bootstrap-ta route alias with same behavior", async () => {
    const serviceMock: Partial<AuthService> = {
      authenticate: vi.fn(async () => ({
        user: { id: "sa-1", username: "admin", role: "SYSTEM_ADMIN" },
        principal: "ACCOUNT",
      } as any)),
      bootstrapTA: vi.fn(async () => mockTaProfile),
    };

    const { call } = await setupApp(serviceMock);

    const response = await call("POST", "/auth/bootstrap-ta", "ottv2_session=valid-sa-token");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ user: mockTaProfile });
  });

  it("validates request body against DTO schema when body is provided", async () => {
    const serviceMock: Partial<AuthService> = {
      authenticate: vi.fn(async () => ({
        user: { id: "sa-1", username: "admin", role: "SYSTEM_ADMIN" },
        principal: "ACCOUNT",
      } as any)),
      bootstrapTA: vi.fn(async () => mockTaProfile),
    };

    const { call } = await setupApp(serviceMock);

    // Valid optional reason in body
    const validRes = await call("POST", "/admin/bootstrap-ta", "ottv2_session=valid-sa-token", { reason: "Initial tournament bootstrap" });
    expect(validRes.statusCode).toBe(200);

    // Invalid body with wrong type
    await expect(
      call("POST", "/admin/bootstrap-ta", "ottv2_session=valid-sa-token", { reason: 12345 })
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
    });
  });
});
