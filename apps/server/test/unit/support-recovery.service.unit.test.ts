import { describe, expect, it } from "vitest";
import {
  SupportRecoveryService,
  hashSupportRecoveryToken,
} from "../../src/modules/support/support.service.js";
import { verifySecret } from "../../src/modules/auth/auth.crypto.js";

function fixture() {
  const users = new Map<string, any>([
    ["user-1", { id: "user-1", usernameNormalized: "owner", passwordHash: "password-hash-1" }],
    ["user-2", { id: "user-2", usernameNormalized: "other", passwordHash: "password-hash-2" }],
  ]);
  const tickets: any[] = [];
  const audits: any[] = [];
  const sessions: any[] = [
    { id: "session-1", userId: "user-1", revokedAt: null },
    { id: "session-2", userId: "user-2", revokedAt: null },
  ];
  let failCredentialUpdate = false;
  const db: any = {
    user: {
      findUnique: async ({ where }: any) => {
        if (where.id) return [...users.values()].find((user) => user.id === where.id) ?? null;
        if (where.usernameNormalized) return [...users.values()].find((user) => user.usernameNormalized === where.usernameNormalized) ?? null;
        return null;
      },
      update: async ({ where, data }: any) => {
        if (failCredentialUpdate) throw new Error("credential write failed");
        const user = [...users.values()].find((entry) => entry.id === where.id);
        if (!user) throw new Error("missing user");
        Object.assign(user, data);
        return user;
      },
    },
    supportRecoveryTicket: {
      findUnique: async ({ where }: any) => {
        if (where.id) return tickets.find((ticket) => ticket.id === where.id) ?? null;
        if (where.recoveryTokenHash) return tickets.find((ticket) => ticket.recoveryTokenHash === where.recoveryTokenHash) ?? null;
        const key = where.targetUserId_idempotencyKey;
        if (key) return tickets.find((ticket) => ticket.targetUserId === key.targetUserId && ticket.idempotencyKey === key.idempotencyKey) ?? null;
        return null;
      },
      findMany: async ({ where }: any) => tickets
        .filter((ticket) => !where.status || ticket.status === where.status)
        .filter((ticket) => !where.tenantId || ticket.tenantId === where.tenantId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      count: async ({ where }: any) => tickets.filter((ticket) => ticket.targetUserId === where.targetUserId && ticket.createdAt >= where.createdAt.gte).length,
      create: async ({ data }: any) => {
        const ticket = {
          ...data,
          tenantId: data.tenantId ?? null,
          requestType: data.requestType ?? "ACCOUNT_RECOVERY",
          requesterUserId: data.requesterUserId ?? null,
          assignedOperatorUserId: null,
          verificationReference: null,
          verifiedAt: null,
          rejectedAt: null,
          resolvedAt: null,
          closedAt: null,
          recoveryTokenHash: null,
          recoveryTokenPurpose: null,
          recoveryTokenExpiresAt: null,
          recoveryTokenIssuedAt: null,
          recoveryTokenConsumedAt: null,
          updatedAt: data.updatedAt ?? data.createdAt,
        };
        tickets.push(ticket);
        return ticket;
      },
      update: async ({ where, data }: any) => {
        const ticket = tickets.find((entry) => entry.id === where.id);
        if (!ticket) throw new Error("missing ticket");
        Object.assign(ticket, data);
        return ticket;
      },
      updateMany: async ({ where, data }: any) => {
        const ticket = tickets.find((entry) => {
          if (entry.id !== where.id) return false;
          if (where.status && entry.status !== where.status) return false;
          if (where.targetUserId && entry.targetUserId !== where.targetUserId) return false;
          if (where.requestType && entry.requestType !== where.requestType) return false;
          if (where.recoveryTokenPurpose && entry.recoveryTokenPurpose !== where.recoveryTokenPurpose) return false;
          if (where.recoveryTokenHash !== undefined && entry.recoveryTokenHash !== where.recoveryTokenHash) return false;
          if (where.recoveryTokenConsumedAt !== undefined && entry.recoveryTokenConsumedAt !== where.recoveryTokenConsumedAt) return false;
          if (where.recoveryTokenExpiresAt?.lte && !(entry.recoveryTokenExpiresAt && entry.recoveryTokenExpiresAt <= where.recoveryTokenExpiresAt.lte)) return false;
          if (where.recoveryTokenExpiresAt?.gt && !(entry.recoveryTokenExpiresAt && entry.recoveryTokenExpiresAt > where.recoveryTokenExpiresAt.gt)) return false;
          return true;
        });
        if (!ticket) return { count: 0 };
        Object.assign(ticket, data);
        return { count: 1 };
      },
    },
    session: {
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const session of sessions) {
          if (session.userId !== where.userId) continue;
          if (where.revokedAt === null && session.revokedAt !== null) continue;
          Object.assign(session, data);
          count += 1;
        }
        return { count };
      },
    },
    tournamentAuditLogRecord: {
      create: async ({ data }: any) => {
        audits.push(data);
        return data;
      },
    },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => {
      const ticketSnapshot = tickets.map((ticket) => ({ ...ticket }));
      const userSnapshot = [...users.entries()].map(([id, user]) => [id, { ...user }] as const);
      const sessionSnapshot = sessions.map((session) => ({ ...session }));
      const auditLength = audits.length;
      try {
        return await fn(db);
      } catch (error) {
        tickets.length = 0;
        tickets.push(...ticketSnapshot);
        users.clear();
        for (const [id, user] of userSnapshot) users.set(id, user);
        sessions.length = 0;
        sessions.push(...sessionSnapshot);
        audits.length = auditLength;
        throw error;
      }
    },
  };
  return { db, users, tickets, audits, sessions, setFailCredentialUpdate: (value: boolean) => { failCredentialUpdate = value; } };
}

describe("D07-A support queue and recovery foundation", () => {
  const now = () => new Date("2026-10-22T10:00:00.000Z");

  it("creates a durable request for the authenticated stable User.id and ignores a client target", async () => {
    const f = fixture();
    const service = new SupportRecoveryService(f.db, { now });
    const result = await service.createRequest(
      { userId: "user-1", role: "USER", tenantId: "tenant-a" },
      { username: "other", reason: "Không đăng nhập được", idempotencyKey: "req-1" },
    );
    expect(result).toMatchObject({ accepted: true, replayed: false });
    expect(f.tickets[0]).toMatchObject({ targetUserId: "user-1", requesterUserId: "user-1", tenantId: "tenant-a", status: "OPEN" });
    expect(f.users.get("user-1").passwordHash).toBe("password-hash-1");
  });

  it("keeps a public unknown-account response generic and creates no target record", async () => {
    const f = fixture();
    const service = new SupportRecoveryService(f.db, { now });
    const result = await service.createRequest(null, { username: "missing", reason: "Mất quyền truy cập" });
    expect(result).toEqual({ accepted: true, requestId: null, replayed: false });
    expect(f.tickets).toHaveLength(0);
  });

  it("rejects an authenticated request whose canonical User.id no longer exists", async () => {
    const f = fixture();
    const service = new SupportRecoveryService(f.db, { now });
    await expect(service.createRequest({ userId: "deleted-user", role: "USER" }, { reason: "Mất quyền truy cập" })).rejects.toMatchObject({ statusCode: 401 });
    expect(f.tickets).toHaveLength(0);
  });

  it("rejects credential material embedded in the support description", async () => {
    const f = fixture();
    const service = new SupportRecoveryService(f.db, { now });
    await expect(service.createRequest({ userId: "user-1", role: "USER" }, { reason: "password: plaintext-secret" })).rejects.toMatchObject({ statusCode: 400 });
    expect(f.tickets).toHaveLength(0);
  });

  it("resolves a public username to User.id without exposing the account in the route contract", async () => {
    const f = fixture();
    const service = new SupportRecoveryService(f.db, { now });
    const result = await service.createRequest(null, { username: "OWNER", reason: "Cần khôi phục" });
    expect(result.accepted).toBe(true);
    expect(f.tickets[0].targetUserId).toBe("user-1");
    expect(f.tickets[0].requesterUserId).toBeNull();
  });

  it("rejects queue access for USER and TOURNAMENT_ADMIN actors", async () => {
    const f = fixture();
    const service = new SupportRecoveryService(f.db, { now });
    await expect(service.listRequests({ userId: "user-1", role: "USER" })).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.listRequests({ userId: "user-1", role: "TOURNAMENT_ADMIN" })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("allows only SYSTEM_ADMIN to list the support queue", async () => {
    const f = fixture();
    const service = new SupportRecoveryService(f.db, { now });
    await service.createRequest({ userId: "user-1", role: "USER" }, { reason: "Mất credential", idempotencyKey: "q-1" });
    const result = await service.listRequests({ userId: "admin", role: "SYSTEM_ADMIN" });
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]?.targetUserId).toBe("user-1");
  });

  it("is idempotent for duplicate retries and does not create a second ticket", async () => {
    const f = fixture();
    const service = new SupportRecoveryService(f.db, { now });
    const first = await service.createRequest({ userId: "user-1", role: "USER" }, { reason: "Retry me", idempotencyKey: "same" });
    const second = await service.createRequest({ userId: "user-1", role: "USER" }, { reason: "Retry me", idempotencyKey: "same" });
    expect(second).toMatchObject({ requestId: first.requestId, replayed: true });
    expect(f.tickets).toHaveLength(1);
  });

  it("enforces the configured per-account daily request limit", async () => {
    const f = fixture();
    const service = new SupportRecoveryService(f.db, { now, maxRequestsPerAccountPerDay: 1 });
    await service.createRequest({ userId: "user-1", role: "USER" }, { reason: "First", idempotencyKey: "first" });
    await expect(service.createRequest({ userId: "user-1", role: "USER" }, { reason: "Second", idempotencyKey: "second" })).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("rejects invalid state transitions and requires verification evidence", async () => {
    const f = fixture();
    const service = new SupportRecoveryService(f.db, { now });
    const created = await service.createRequest({ userId: "user-1", role: "USER" }, { reason: "State", idempotencyKey: "state" });
    await expect(service.transitionRequest({ userId: "admin", role: "SYSTEM_ADMIN" }, created.requestId!, { action: "RESOLVE" })).rejects.toMatchObject({ statusCode: 409 });
    await service.transitionRequest({ userId: "admin", role: "SYSTEM_ADMIN" }, created.requestId!, { action: "IN_PROGRESS" });
    await expect(service.transitionRequest({ userId: "admin", role: "SYSTEM_ADMIN" }, created.requestId!, { action: "VERIFY" })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("supports verify then resolve while recording operator ownership and safe audit", async () => {
    const f = fixture();
    const service = new SupportRecoveryService(f.db, { now });
    const created = await service.createRequest({ userId: "user-1", role: "USER" }, { reason: "Verify", idempotencyKey: "verify" });
    const admin = { userId: "admin", role: "SYSTEM_ADMIN" } as const;
    await service.transitionRequest(admin, created.requestId!, { action: "IN_PROGRESS" });
    const verified = await service.transitionRequest(admin, created.requestId!, { action: "VERIFY", verificationReference: "CASE-42" });
    expect(verified.request).toMatchObject({ status: "VERIFIED", assignedOperatorUserId: "admin", verificationReference: "CASE-42" });
    const resolved = await service.transitionRequest(admin, created.requestId!, { action: "RESOLVE" });
    expect(resolved.request.status).toBe("RESOLVED");
    expect(f.audits.every((entry) => !JSON.stringify(entry).includes("password-hash"))).toBe(true);
  });

  it("does not issue a reset token before SA verification", async () => {
    const f = fixture();
    const service = new SupportRecoveryService(f.db, { now });
    const created = await service.createRequest({ userId: "user-1", role: "USER" }, { reason: "Token", idempotencyKey: "token" });
    await expect(service.issueResetToken({ userId: "admin", role: "SYSTEM_ADMIN" }, created.requestId!)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("stores only the recovery token hash and exposes raw token once after verification", async () => {
    const f = fixture();
    const service = new SupportRecoveryService(f.db, { now, resetTokenTtlMinutes: 30 });
    const created = await service.createRequest({ userId: "user-1", role: "USER" }, { reason: "Issue", idempotencyKey: "issue" });
    const admin = { userId: "admin", role: "SYSTEM_ADMIN" } as const;
    await service.transitionRequest(admin, created.requestId!, { action: "IN_PROGRESS" });
    await service.transitionRequest(admin, created.requestId!, { action: "VERIFY", verificationReference: "VERIFIED-1" });
    const handoff = await service.issueResetToken(admin, created.requestId!);
    expect(handoff.rawToken).toBeTruthy();
    expect(f.tickets[0].recoveryTokenHash).toBe(hashSupportRecoveryToken(handoff.rawToken!));
    expect(f.tickets[0]).not.toHaveProperty("rawToken");
    expect(f.audits.every((entry) => !JSON.stringify(entry).includes(handoff.rawToken!))).toBe(true);
    expect(f.audits.every((entry) => !JSON.stringify(entry).includes(f.tickets[0].recoveryTokenHash))).toBe(true);
  });

  it("does not re-expose an active raw token on retry and leaves credentials unchanged", async () => {
    const f = fixture();
    const service = new SupportRecoveryService(f.db, { now });
    const created = await service.createRequest({ userId: "user-1", role: "USER" }, { reason: "Replay", idempotencyKey: "replay" });
    const admin = { userId: "admin", role: "SYSTEM_ADMIN" } as const;
    await service.transitionRequest(admin, created.requestId!, { action: "IN_PROGRESS" });
    await service.transitionRequest(admin, created.requestId!, { action: "VERIFY", verificationReference: "VERIFIED-2" });
    const first = await service.issueResetToken(admin, created.requestId!);
    const second = await service.issueResetToken(admin, created.requestId!);
    expect(second).toMatchObject({ rawToken: null, replayed: true });
    expect(f.users.get("user-1").passwordHash).toBe("password-hash-1");
  });

  it("denies a tenant-scoped operator access to another tenant ticket", async () => {
    const f = fixture();
    const service = new SupportRecoveryService(f.db, { now });
    const created = await service.createRequest({ userId: "user-1", role: "USER", tenantId: "tenant-a" }, { reason: "Scope", idempotencyKey: "scope" });
    await expect(service.getRequest({ userId: "operator", role: "SYSTEM_ADMIN", tenantId: "tenant-b" }, created.requestId!)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects an invalid transition action through the contract parser", async () => {
    const f = fixture();
    const service = new SupportRecoveryService(f.db, { now });
    const created = await service.createRequest({ userId: "user-1", role: "USER" }, { reason: "Validation", idempotencyKey: "validation" });
    await expect(service.transitionRequest({ userId: "admin", role: "SYSTEM_ADMIN" }, created.requestId!, { action: "RESET_PASSWORD" })).rejects.toMatchObject({ statusCode: 400 });
  });
});

async function verifiedRecoveryFixture() {
  const f = fixture();
  const service = new SupportRecoveryService(f.db, { now: () => new Date("2026-10-22T10:00:00.000Z") });
  const admin = { userId: "admin", role: "SYSTEM_ADMIN" } as const;
  const created = await service.createRequest({ userId: "user-1", role: "USER" }, { reason: "Recovery execution", idempotencyKey: "d07-b" });
  await service.transitionRequest(admin, created.requestId!, { action: "IN_PROGRESS" });
  await service.transitionRequest(admin, created.requestId!, { action: "VERIFY", verificationReference: "EXT-VERIFY-1" });
  const handoff = await service.issueResetToken(admin, created.requestId!);
  return { f, service, admin, requestId: created.requestId!, token: handoff.rawToken! };
}

describe("D07-B token-only account recovery execution", () => {
  it("atomically replaces only the ticket target credential, consumes the token, resolves the ticket, and revokes sessions", async () => {
    const { f, service, requestId, token } = await verifiedRecoveryFixture();
    const result = await service.consumeRecoveryToken({ token, newPassword: "new-secure-password" });
    expect(result).toEqual({ accepted: true });
    expect(f.tickets[0]).toMatchObject({ id: requestId, status: "RESOLVED", recoveryTokenConsumedAt: expect.any(Date) });
    expect(await verifySecret("new-secure-password", f.users.get("user-1").passwordHash)).toBe(true);
    expect(await verifySecret("password-hash-1", f.users.get("user-1").passwordHash)).toBe(false);
    expect(f.sessions.find((session) => session.userId === "user-1")?.revokedAt).toEqual(expect.any(Date));
    expect(f.sessions.find((session) => session.userId === "user-2")?.revokedAt).toBeNull();
  });

  it("uses the token hash lookup and rejects an unknown raw token without account selection", async () => {
    const { f, service } = await verifiedRecoveryFixture();
    await expect(service.consumeRecoveryToken({ token: "unknown-token", newPassword: "new-secure-password" })).rejects.toMatchObject({ statusCode: 401, details: {} });
    expect(f.tickets[0].status).toBe("VERIFIED");
    expect(f.users.get("user-1").passwordHash).toBe("password-hash-1");
  });

  it("reuses the canonical password policy and rejects a weak new password before persistence", async () => {
    const { f, service, token } = await verifiedRecoveryFixture();
    await expect(service.consumeRecoveryToken({ token, newPassword: "short" })).rejects.toMatchObject({ statusCode: 400 });
    expect(f.tickets[0].status).toBe("VERIFIED");
    expect(f.users.get("user-1").passwordHash).toBe("password-hash-1");
  });

  it("rejects an expired token and leaves the credential and ticket unchanged", async () => {
    const { f, service, token } = await verifiedRecoveryFixture();
    f.tickets[0].recoveryTokenExpiresAt = new Date("2026-10-22T09:59:59.000Z");
    await expect(service.consumeRecoveryToken({ token, newPassword: "new-secure-password" })).rejects.toMatchObject({ statusCode: 401 });
    expect(f.tickets[0].status).toBe("VERIFIED");
    expect(f.tickets[0].recoveryTokenConsumedAt).toBeNull();
    expect(f.users.get("user-1").passwordHash).toBe("password-hash-1");
  });

  it("rejects a token with the wrong purpose", async () => {
    const { f, service, token } = await verifiedRecoveryFixture();
    f.tickets[0].recoveryTokenPurpose = "TOURNAMENT_STAFF_INVITE";
    await expect(service.consumeRecoveryToken({ token, newPassword: "new-secure-password" })).rejects.toMatchObject({ statusCode: 401 });
    expect(f.tickets[0].status).toBe("VERIFIED");
  });

  it("rejects rejected, closed, and already-resolved tickets even when the token hash matches", async () => {
    for (const status of ["REJECTED", "CLOSED", "RESOLVED"]) {
      const { f, service, token } = await verifiedRecoveryFixture();
      f.tickets[0].status = status;
      await expect(service.consumeRecoveryToken({ token, newPassword: "new-secure-password" })).rejects.toMatchObject({ statusCode: 401 });
      expect(f.users.get("user-1").passwordHash).toBe("password-hash-1");
    }
  });

  it("is replay-safe: a consumed token cannot be used again", async () => {
    const { f, service, token } = await verifiedRecoveryFixture();
    await service.consumeRecoveryToken({ token, newPassword: "new-secure-password" });
    await expect(service.consumeRecoveryToken({ token, newPassword: "another-secure-password" })).rejects.toMatchObject({ statusCode: 401 });
    expect(await verifySecret("new-secure-password", f.users.get("user-1").passwordHash)).toBe(true);
    expect(await verifySecret("another-secure-password", f.users.get("user-1").passwordHash)).toBe(false);
  });

  it("ignores client-supplied target identity and still changes only the token ticket owner", async () => {
    const { f, service, token } = await verifiedRecoveryFixture();
    await service.consumeRecoveryToken({ token, newPassword: "new-secure-password", userId: "user-2", username: "other", tenantId: "tenant-b" });
    expect(await verifySecret("new-secure-password", f.users.get("user-1").passwordHash)).toBe(true);
    expect(f.users.get("user-2").passwordHash).toBe("password-hash-2");
  });

  it("rolls back ticket consumption when credential persistence fails", async () => {
    const { f, service, token } = await verifiedRecoveryFixture();
    f.setFailCredentialUpdate(true);
    await expect(service.consumeRecoveryToken({ token, newPassword: "new-secure-password" })).rejects.toThrow("credential write failed");
    expect(f.tickets[0].status).toBe("VERIFIED");
    expect(f.tickets[0].recoveryTokenConsumedAt).toBeNull();
    expect(f.users.get("user-1").passwordHash).toBe("password-hash-1");
    expect(f.audits.some((entry) => entry.action === "SUPPORT_RECOVERY_COMPLETED")).toBe(false);
  });

  it("does not expose raw token, password, or credential hash in the completion audit", async () => {
    const { f, service, token } = await verifiedRecoveryFixture();
    await service.consumeRecoveryToken({ token, newPassword: "new-secure-password" });
    const completion = f.audits.find((entry) => entry.action === "SUPPORT_RECOVERY_COMPLETED");
    expect(completion).toBeDefined();
    const serialized = JSON.stringify(completion);
    expect(serialized).not.toContain(token);
    expect(serialized).not.toContain("new-secure-password");
    expect(serialized).not.toContain(f.tickets[0].recoveryTokenHash);
    expect(serialized).not.toContain("password-hash-1");
  });

  it("rejects a missing target account without creating a new User", async () => {
    const { f, service, token } = await verifiedRecoveryFixture();
    f.tickets[0].targetUserId = "deleted-user";
    await expect(service.consumeRecoveryToken({ token, newPassword: "new-secure-password" })).rejects.toMatchObject({ statusCode: 401 });
    expect(f.users.has("deleted-user")).toBe(false);
    expect(f.users.get("user-1").passwordHash).toBe("password-hash-1");
  });

  it("rejects a concurrent consume race when the conditional token claim loses", async () => {
    const { f, service, token } = await verifiedRecoveryFixture();
    const originalUpdateMany = f.db.supportRecoveryTicket.updateMany;
    f.db.supportRecoveryTicket.updateMany = async ({ where, data }: any) => {
      if (where.recoveryTokenHash) return { count: 0 };
      return originalUpdateMany({ where, data });
    };
    await expect(service.consumeRecoveryToken({ token, newPassword: "new-secure-password" })).rejects.toMatchObject({ statusCode: 401 });
    expect(f.users.get("user-1").passwordHash).toBe("password-hash-1");
    expect(f.tickets[0].status).toBe("VERIFIED");
  });
});
