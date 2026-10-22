import { describe, expect, it, vi } from "vitest";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AppEnv } from "../../src/config/env.js";
import { AuthService, type AuthContext } from "../../src/modules/auth/auth.service.js";
import { registerAuthRoutes } from "../../src/modules/auth/auth.route.js";
import { AppError } from "../../src/shared/errors/app-error.js";

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

describe("D02-B — AuthService TA Management Unit Tests", () => {
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

  const mockExistingTa = {
    id: "ta-1",
    fullName: "Nguyễn Văn TA",
    displayName: "TA Nguyễn",
    username: "ta_nguyen",
    usernameNormalized: "ta_nguyen",
    role: "TOURNAMENT_ADMIN",
    passwordHash: "ta-hash",
    recoveryCodeHash: "ta-rec-hash",
    recoveryUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: { theme: "dark", avatarPreset: "robot", presenceVisibility: "FRIENDS", friendListVisibility: "PRIVATE", fullNameVisibility: "PRIVATE" },
    stats: { elo: 1200, rankedWins: 5, rankedLosses: 1, quickWins: 2, quickLosses: 0 },
  };

  const makeAuthContext = (user: any, principal: "ACCOUNT" | "GUEST" = "ACCOUNT"): AuthContext => ({
    session: { id: "s-1", userId: user.id, tokenHash: "th", remember: false, expiresAt: new Date(Date.now() + 10000), revokedAt: null, createdAt: new Date(), lastUsedAt: new Date() },
    user,
    principal,
  });

  describe("listTA", () => {
    it("rejects non-ACCOUNT principal with 401 UNAUTHORIZED", async () => {
      const service = new AuthService({} as never);
      const guestContext = makeAuthContext(mockSystemAdminUser, "GUEST");

      await expect(service.listTA(guestContext)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        statusCode: 401,
      });
    });

    it("rejects non-SYSTEM_ADMIN caller with 403 UNAUTHORIZED", async () => {
      const service = new AuthService({} as never);
      const userContext = makeAuthContext(mockRegularUser, "ACCOUNT");

      await expect(service.listTA(userContext)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        statusCode: 403,
      });
    });

    it("returns list of TA accounts without exposing secrets", async () => {
      const db = {
        user: {
          findMany: vi.fn(async () => [mockExistingTa]),
        },
      };

      const service = new AuthService(db as never);
      const saContext = makeAuthContext(mockSystemAdminUser, "ACCOUNT");

      const list = await service.listTA(saContext);

      expect(list).toHaveLength(1);
      expect(list[0].id).toBe("ta-1");
      expect(list[0].username).toBe("ta_nguyen");
      expect(list[0]).not.toHaveProperty("password");
      expect(list[0]).not.toHaveProperty("passwordHash");
      expect(list[0]).not.toHaveProperty("recoveryCodeHash");
      expect(db.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: "TOURNAMENT_ADMIN" },
        })
      );
    });
  });

  describe("createTA", () => {
    it("rejects non-SYSTEM_ADMIN caller with 403", async () => {
      const service = new AuthService({} as never);
      const userContext = makeAuthContext(mockRegularUser, "ACCOUNT");

      await expect(
        service.createTA(userContext, {
          fullName: "New TA",
          displayName: "New TA",
          username: "new_ta",
        })
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        statusCode: 403,
      });
    });

    it("rejects duplicate username with 409 CONFLICT", async () => {
      const db = {
        user: {
          findUnique: vi.fn(async () => mockExistingTa),
        },
      };

      const service = new AuthService(db as never);
      const saContext = makeAuthContext(mockSystemAdminUser, "ACCOUNT");

      await expect(
        service.createTA(saContext, {
          fullName: "Duplicate TA",
          displayName: "Duplicate TA",
          username: "ta_nguyen",
        })
      ).rejects.toMatchObject({
        code: "CONFLICT",
        statusCode: 409,
      });
    });

    it("creates TA with role TOURNAMENT_ADMIN and returns profile without secrets", async () => {
      const createdUser = {
        ...mockExistingTa,
        id: "ta-created-2",
        username: "ta_created",
        usernameNormalized: "ta_created",
      };

      const userFindUnique = vi.fn(async () => null);
      const userCreate = vi.fn(async () => createdUser);
      const db = {
        user: {
          findUnique: userFindUnique,
          create: userCreate,
        },
      };

      const service = new AuthService(db as never);
      const saContext = makeAuthContext(mockSystemAdminUser, "ACCOUNT");

      const result = await service.createTA(saContext, {
        fullName: "Created TA",
        displayName: "Created TA",
        username: "ta_created",
        password: "securePassword123!",
      });

      expect(userCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: "TOURNAMENT_ADMIN",
            username: "ta_created",
          }),
        })
      );
      expect(result.id).toBe("ta-created-2");
      expect(result).not.toHaveProperty("password");
      expect(result).not.toHaveProperty("passwordHash");
      expect(result).not.toHaveProperty("recoveryCodeHash");
    });
  });

  describe("bindTA", () => {
    it("rejects non-SYSTEM_ADMIN caller with 403", async () => {
      const service = new AuthService({} as never);
      const userContext = makeAuthContext(mockRegularUser, "ACCOUNT");

      await expect(
        service.bindTA(userContext, "ta-1", { contractId: "contract-1" })
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        statusCode: 403,
      });
    });

    it("rejects when TA does not exist with 404 NOT_FOUND", async () => {
      const db = {
        user: {
          findUnique: vi.fn(async () => null),
        },
      };

      const service = new AuthService(db as never);
      const saContext = makeAuthContext(mockSystemAdminUser, "ACCOUNT");

      await expect(
        service.bindTA(saContext, "non-existent-ta", { contractId: "contract-1" })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        statusCode: 404,
      });
    });

    it("rejects when target user is not a TOURNAMENT_ADMIN with 404 NOT_FOUND", async () => {
      const db = {
        user: {
          findUnique: vi.fn(async () => mockRegularUser),
        },
      };

      const service = new AuthService(db as never);
      const saContext = makeAuthContext(mockSystemAdminUser, "ACCOUNT");

      await expect(
        service.bindTA(saContext, "user-1", { contractId: "contract-1" })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        statusCode: 404,
      });
    });

    it("rejects when contract does not exist with 404 NOT_FOUND", async () => {
      const db = {
        user: {
          findUnique: vi.fn(async () => mockExistingTa),
        },
        tournamentContract: {
          findUnique: vi.fn(async () => null),
        },
      };

      const service = new AuthService(db as never);
      const saContext = makeAuthContext(mockSystemAdminUser, "ACCOUNT");

      await expect(
        service.bindTA(saContext, "ta-1", { contractId: "contract-non-existent" })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        statusCode: 404,
      });
    });

    it("successfully creates/updates TA contract binding", async () => {
      const now = new Date();
      const mockBinding = {
        id: "binding-1",
        contractId: "contract-100",
        userId: "ta-1",
        username: "ta_nguyen",
        displayName: "TA Nguyễn",
        status: "ACTIVE",
        grantedByUserId: "sa-1",
        grantedAt: now,
        revokedAt: null,
        revokeReason: null,
      };

      const db = {
        user: {
          findUnique: vi.fn(async () => mockExistingTa),
        },
        tournamentContract: {
          findUnique: vi.fn(async () => ({ id: "contract-100", contractCode: "CTR-2026-001" })),
        },
        tournamentContractTaBinding: {
          upsert: vi.fn(async () => mockBinding),
        },
      };

      const service = new AuthService(db as never);
      const saContext = makeAuthContext(mockSystemAdminUser, "ACCOUNT");

      const result = await service.bindTA(saContext, "ta-1", { contractId: "contract-100" });

      expect(db.tournamentContractTaBinding.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            contractId_userId: { contractId: "contract-100", userId: "ta-1" },
          },
        })
      );
      expect(result).toMatchObject({
        id: "binding-1",
        contractId: "contract-100",
        userId: "ta-1",
        status: "ACTIVE",
      });
    });
  });

  describe("revokeTA", () => {
    it("rejects non-SYSTEM_ADMIN caller with 403", async () => {
      const service = new AuthService({} as never);
      const userContext = makeAuthContext(mockRegularUser, "ACCOUNT");

      await expect(service.revokeTA(userContext, "ta-1")).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        statusCode: 403,
      });
    });

    it("rejects non-existent TA with 404 NOT_FOUND", async () => {
      const db = {
        user: {
          findUnique: vi.fn(async () => null),
        },
      };

      const service = new AuthService(db as never);
      const saContext = makeAuthContext(mockSystemAdminUser, "ACCOUNT");

      await expect(service.revokeTA(saContext, "non-existent-ta")).rejects.toMatchObject({
        code: "NOT_FOUND",
        statusCode: 404,
      });
    });

    it("demotes TA role to USER and revokes active contract bindings", async () => {
      const userUpdate = vi.fn(async () => ({ ...mockExistingTa, role: "USER" }));
      const bindingsUpdateMany = vi.fn(async () => ({ count: 2 }));

      const db = {
        user: {
          findUnique: vi.fn(async () => mockExistingTa),
          update: userUpdate,
        },
        tournamentContractTaBinding: {
          updateMany: bindingsUpdateMany,
        },
      };

      const service = new AuthService(db as never);
      const saContext = makeAuthContext(mockSystemAdminUser, "ACCOUNT");

      const result = await service.revokeTA(saContext, "ta-1");

      expect(userUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ta-1" },
          data: { role: "USER" },
        })
      );
      expect(bindingsUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "ta-1", status: "ACTIVE" },
          data: expect.objectContaining({ status: "REVOKED" }),
        })
      );
      expect(result).toEqual({
        success: true,
        userId: "ta-1",
        message: "Thu hồi quyền Tournament Admin thành công.",
      });
    });
  });
});

describe("D02-B — HTTP Routes for TA Management", () => {
  const env: AppEnv = {
    NODE_ENV: "test",
    PORT: 3000,
    HOST: "127.0.0.1",
  } as unknown as AppEnv;

  const mockTaItem = {
    id: "ta-item-1",
    fullName: "Tournament Admin 1",
    displayName: "TA One",
    username: "ta_one",
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

    async function call(method: "POST" | "GET" | "DELETE", path: string, cookie?: string, body?: unknown, params?: Record<string, string>) {
      const handler = handlers.get(`${method} ${path}`);
      if (!handler) throw new Error(`Handler not found for ${method} ${path}`);
      const reply = fakeReply();
      const request = {
        headers: cookie ? { cookie } : {},
        body,
        params: params ?? {},
        ip: "127.0.0.1",
      } as unknown as FastifyRequest;
      const res = await handler(request, reply);
      const sent = (reply.send as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
      const statusCode = (reply.status as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] ?? 200;
      return { statusCode, body: sent ?? res };
    }

    return { call };
  }

  describe("GET /admin/ta", () => {
    it("denies unauthenticated request with 401", async () => {
      const serviceMock: Partial<AuthService> = {
        authenticate: vi.fn(async () => {
          throw new AppError("UNAUTHORIZED", "Bạn cần đăng nhập để tiếp tục.", 401, false, "FATAL_SESSION");
        }),
      };
      const { call } = await setupApp(serviceMock);

      await expect(call("GET", "/admin/ta")).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        statusCode: 401,
      });
    });

    it("denies non-SYSTEM_ADMIN request with 403", async () => {
      const serviceMock: Partial<AuthService> = {
        authenticate: vi.fn(async () => ({ user: { id: "u-1", role: "USER" }, principal: "ACCOUNT" } as any)),
        listTA: vi.fn(async () => {
          throw new AppError("UNAUTHORIZED", "Only System Admin can perform this operation", 403, false, "INVALID");
        }),
      };
      const { call } = await setupApp(serviceMock);

      await expect(call("GET", "/admin/ta", "ottv2_session=valid")).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        statusCode: 403,
      });
    });

    it("returns 200 with TA list for SYSTEM_ADMIN", async () => {
      const serviceMock: Partial<AuthService> = {
        authenticate: vi.fn(async () => ({ user: { id: "sa-1", role: "SYSTEM_ADMIN" }, principal: "ACCOUNT" } as any)),
        listTA: vi.fn(async () => [mockTaItem]),
      };
      const { call } = await setupApp(serviceMock);

      const res = await call("GET", "/admin/ta", "ottv2_session=valid");
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ items: [mockTaItem] });
      expect(res.body.items[0]).not.toHaveProperty("password");
      expect(res.body.items[0]).not.toHaveProperty("passwordHash");
    });
  });

  describe("POST /admin/ta", () => {
    it("denies unauthenticated request with 401", async () => {
      const serviceMock: Partial<AuthService> = {
        authenticate: vi.fn(async () => {
          throw new AppError("UNAUTHORIZED", "Chưa đăng nhập", 401, false, "FATAL_SESSION");
        }),
      };
      const { call } = await setupApp(serviceMock);

      await expect(call("POST", "/admin/ta", undefined, { fullName: "A", displayName: "B", username: "c" })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        statusCode: 401,
      });
    });

    it("validates request body and rejects invalid data with 400 VALIDATION_ERROR", async () => {
      const serviceMock: Partial<AuthService> = {
        authenticate: vi.fn(async () => ({ user: { id: "sa-1", role: "SYSTEM_ADMIN" }, principal: "ACCOUNT" } as any)),
      };
      const { call } = await setupApp(serviceMock);

      // Username too short and full name missing
      await expect(
        call("POST", "/admin/ta", "ottv2_session=valid", { username: "a" })
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        statusCode: 400,
      });
    });

    it("creates TA and returns 201 with created user profile", async () => {
      const serviceMock: Partial<AuthService> = {
        authenticate: vi.fn(async () => ({ user: { id: "sa-1", role: "SYSTEM_ADMIN" }, principal: "ACCOUNT" } as any)),
        createTA: vi.fn(async () => mockTaItem),
      };
      const { call } = await setupApp(serviceMock);

      const res = await call("POST", "/admin/ta", "ottv2_session=valid", {
        fullName: "Tournament Admin 1",
        displayName: "TA One",
        username: "ta_one",
      });

      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual({ user: mockTaItem });
      expect(res.body.user).not.toHaveProperty("password");
      expect(res.body.user).not.toHaveProperty("passwordHash");
    });
  });

  describe("POST /admin/ta/:taId/bind", () => {
    it("validates request body and rejects missing contractId with 400 VALIDATION_ERROR", async () => {
      const serviceMock: Partial<AuthService> = {
        authenticate: vi.fn(async () => ({ user: { id: "sa-1", role: "SYSTEM_ADMIN" }, principal: "ACCOUNT" } as any)),
      };
      const { call } = await setupApp(serviceMock);

      await expect(
        call("POST", "/admin/ta/:taId/bind", "ottv2_session=valid", {}, { taId: "ta-1" })
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        statusCode: 400,
      });
    });

    it("binds contract to TA and returns 200 with binding result", async () => {
      const mockBindingRes = {
        id: "binding-xyz",
        contractId: "contract-1",
        userId: "ta-1",
        status: "ACTIVE" as const,
        grantedAt: new Date().toISOString(),
      };

      const serviceMock: Partial<AuthService> = {
        authenticate: vi.fn(async () => ({ user: { id: "sa-1", role: "SYSTEM_ADMIN" }, principal: "ACCOUNT" } as any)),
        bindTA: vi.fn(async () => mockBindingRes),
      };
      const { call } = await setupApp(serviceMock);

      const res = await call("POST", "/admin/ta/:taId/bind", "ottv2_session=valid", { contractId: "contract-1" }, { taId: "ta-1" });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ binding: mockBindingRes });
    });
  });

  describe("DELETE /admin/ta/:taId", () => {
    it("revokes TA role and returns 200 with success status", async () => {
      const mockRevokeRes = {
        success: true,
        userId: "ta-1",
        message: "Thu hồi quyền Tournament Admin thành công.",
      };

      const serviceMock: Partial<AuthService> = {
        authenticate: vi.fn(async () => ({ user: { id: "sa-1", role: "SYSTEM_ADMIN" }, principal: "ACCOUNT" } as any)),
        revokeTA: vi.fn(async () => mockRevokeRes),
      };
      const { call } = await setupApp(serviceMock);

      const res = await call("DELETE", "/admin/ta/:taId", "ottv2_session=valid", undefined, { taId: "ta-1" });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(mockRevokeRes);
    });
  });
});
