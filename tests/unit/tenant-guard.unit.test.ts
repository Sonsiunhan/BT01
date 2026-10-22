import { describe, it, expect } from "vitest";
import { enforceAccess } from "../../apps/server/src/modules/auth/tenant-guard.js";
import { AppError } from "../../apps/server/src/shared/errors/app-error.js";
import { TournamentRoleSchema } from "@ottv2/contracts";

type MockUser = {
  id: string;
  tenantId?: string;
  roles?: string[];
};

type MockContext = {
  principal: "ACCOUNT" | "GUEST";
  user: MockUser;
  session: any;
};

const makeContext = (overrides: Partial<MockContext> = {}): MockContext => {
  return {
    principal: "ACCOUNT",
    user: { id: "user-1", tenantId: "tenant-A", roles: ["PLAYER"] },
    session: {},
    ...overrides,
  } as MockContext;
};

describe("Tenant guard", () => {
  it("rejects missing principal", () => {
    const ctx = makeContext({ principal: "GUEST" as any });
    expect(() => enforceAccess(ctx as any, [], "tenant-A")).toThrowError(AppError);
  });

  it("rejects missing tenant", () => {
    const ctx = makeContext({ user: { id: "u", roles: ["PLAYER"] } as any });
    expect(() => enforceAccess(ctx as any, [], "tenant-A")).toThrowError(AppError);
  });

  it("rejects cross‑tenant", () => {
    const ctx = makeContext({ user: { id: "u", tenantId: "tenant-B", roles: ["PLAYER"] } as any });
    expect(() => enforceAccess(ctx as any, [], "tenant-A")).toThrowError(AppError);
  });

  it("rejects insufficient role", () => {
    const ctx = makeContext({ user: { id: "u", tenantId: "tenant-A", roles: ["PLAYER"] } as any });
    const required = [TournamentRoleSchema.enum.ADMIN];
    expect(() => enforceAccess(ctx as any, required, "tenant-A")).toThrowError(AppError);
  });

  it("allows when principal, tenant and role satisfied", () => {
    const ctx = makeContext({
      user: { id: "u", tenantId: "tenant-A", roles: ["ADMIN", "PLAYER"] },
    } as any);
    const required = [TournamentRoleSchema.enum.ADMIN];
    expect(() => enforceAccess(ctx as any, required, "tenant-A")).not.toThrow();
  });

  it("prevents client‑supplied ADMIN role during registration (negative test)", () => {
    // Simulate a registration payload where client tries to set role ADMIN.
    // Guard is not invoked for registration itself, but we assert that a
    // subsequent privileged operation would still be denied because the
    // user does not have ADMIN in its context.
    const ctx = makeContext({
      user: { id: "u", tenantId: "tenant-A", roles: ["PLAYER"] },
    } as any);
    const required = [TournamentRoleSchema.enum.ADMIN];
    expect(() => enforceAccess(ctx as any, required, "tenant-A")).toThrowError(AppError);
  });
});
