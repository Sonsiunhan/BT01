/**
 * D05-A — Roster Participant Activation & Account Handoff Unit Tests
 *
 * Covers:
 *  1. Valid token issuance by authorized TA / System Admin
 *  2. Valid token claim creates minimal User without password, links to enrollment
 *  3. Expired token rejected with UNAUTHORIZED (TOKEN_EXPIRED)
 *  4. Invalid/tampered token rejected with UNAUTHORIZED (INVALID_TOKEN)
 *  5. Replay claim is idempotent, returning original outcome without creating duplicate users
 *  6. Reused/existing account linked to enrollment preserves existing credentials
 *  7. Credential not overwritten: already active account rejected with CONFLICT (ALREADY_ACTIVE)
 *  8. Contract/scope mismatch rejected with UNAUTHORIZED (OUT_OF_SCOPE)
 *  9. Retry/idempotency in token issuance returns existing token without duplicate ledger records
 * 10. Non-existent enrollment rejected with NOT_FOUND
 * 11. Plaintext password in claim request rejected before DB operations
 * 12. Raw claim token is NOT stored in command ledger or audit log (hash only)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivationService } from "../../src/modules/roster/activation.service.js";
import { AppError } from "../../src/shared/errors/app-error.js";
import { verifySecret } from "../../src/modules/auth/auth.crypto.js";
import { SetupCredentialRequestSchema } from "@ottv2/contracts";

// ---------------------------------------------------------------------------
// Mock Prisma factory for Activation tests
// ---------------------------------------------------------------------------
function createMockPrisma() {
  const store = {
    contracts: new Map<string, any>(),
    taBindings: new Map<string, any>(),
    enrollments: new Map<string, any>(),
    users: new Map<string, any>(),
    commandLedger: new Map<string, any>(),
    auditLogs: new Map<string, any>(),
  };

  const createTx = () => ({
    tournamentEnrollmentRecord: {
      findUnique: vi.fn(async ({ where }: any) => {
        return store.enrollments.get(where.id) ?? null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const record = store.enrollments.get(where.id);
        if (!record) return null;
        const updated = { ...record, ...data, updatedAt: new Date() };
        store.enrollments.set(where.id, updated);
        return updated;
      }),
    },

    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id) {
          return store.users.get(where.id) ?? null;
        }
        if (where.usernameNormalized) {
          for (const u of store.users.values()) {
            if (u.usernameNormalized === where.usernameNormalized) return u;
          }
        }
        return null;
      }),
      create: vi.fn(async ({ data }: any) => {
        store.users.set(data.id, {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return store.users.get(data.id);
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const u = store.users.get(where.id);
        if (!u) return null;
        Object.assign(u, data, { updatedAt: new Date() });
        return u;
      }),
    },

    commandLedgerEntry: {
      create: vi.fn(async ({ data }: any) => {
        store.commandLedger.set(data.id, { ...data });
        return data;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const entry = store.commandLedger.get(where.id);
        if (entry) {
          Object.assign(entry, data);
        }
        return entry;
      }),
    },

    tournamentAuditLogRecord: {
      create: vi.fn(async ({ data }: any) => {
        store.auditLogs.set(data.id, { ...data });
        return data;
      }),
    },
  });

  const prisma = {
    tournamentContract: {
      findUnique: vi.fn(async ({ where }: any) => {
        return store.contracts.get(where.id) ?? null;
      }),
    },

    tournamentContractTaBinding: {
      findFirst: vi.fn(async ({ where }: any) => {
        for (const b of store.taBindings.values()) {
          if (
            b.contractId === where.contractId &&
            b.userId === where.userId &&
            (!where.status || b.status === where.status)
          ) {
            return b;
          }
        }
        return null;
      }),
    },

    tournamentEnrollmentRecord: {
      findUnique: vi.fn(async ({ where }: any) => {
        return store.enrollments.get(where.id) ?? null;
      }),
    },

    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id) return store.users.get(where.id) ?? null;
        if (where.usernameNormalized) {
          for (const u of store.users.values()) {
            if (u.usernameNormalized === where.usernameNormalized) return u;
          }
        }
        return null;
      }),
    },

    commandLedgerEntry: {
      findUnique: vi.fn(async ({ where }: any) => {
        const p = where.principalId_targetId_operation_commandId;
        for (const entry of store.commandLedger.values()) {
          if (
            entry.principalId === p.principalId &&
            entry.targetId === p.targetId &&
            entry.operation === p.operation &&
            entry.commandId === p.commandId
          ) {
            return entry;
          }
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where, orderBy }: any) => {
        const matches: any[] = [];
        for (const entry of store.commandLedger.values()) {
          let ok = true;
          if (where.operation && entry.operation !== where.operation) ok = false;
          if (where.targetId && entry.targetId !== where.targetId) ok = false;
          if (where.payloadDigest && entry.payloadDigest !== where.payloadDigest) ok = false;
          if (where.outcome && entry.outcome !== where.outcome) ok = false;
          if (ok) matches.push(entry);
        }
        if (matches.length === 0) return null;
        if (orderBy?.expiresAt === "desc") {
          matches.sort((a, b) => new Date(b.expiresAt ?? 0).getTime() - new Date(a.expiresAt ?? 0).getTime());
        }
        return matches[0] ?? null;
      }),
    },

    $transaction: vi.fn(async (callback: any) => {
      const snapshot = {
        enrollments: new Map(store.enrollments),
        users: new Map(store.users),
        commandLedger: new Map(store.commandLedger),
        auditLogs: new Map(store.auditLogs),
      };
      try {
        const tx = createTx();
        return await callback(tx);
      } catch (err) {
        store.enrollments = snapshot.enrollments;
        store.users = snapshot.users;
        store.commandLedger = snapshot.commandLedger;
        store.auditLogs = snapshot.auditLogs;
        throw err;
      }
    }),
  };

  return { prisma: prisma as any, store };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
const VALID_FROM = new Date("2026-01-01T00:00:00Z");
const VALID_TO = new Date("2026-12-31T23:59:59Z");

function seedCommon(store: ReturnType<typeof createMockPrisma>["store"]) {
  store.contracts.set("contract-1", {
    id: "contract-1",
    contractCode: "CONTRACT-2026",
    unitId: "unit-1",
    status: "ACTIVE",
    validFrom: VALID_FROM,
    validTo: VALID_TO,
  });

  store.taBindings.set("binding-1", {
    id: "binding-1",
    contractId: "contract-1",
    userId: "ta-user-1",
    status: "ACTIVE",
  });

  store.enrollments.set("enr-1", {
    id: "enr-1",
    tournamentId: "tour-1",
    contractId: "contract-1",
    personKey: "KHOA_CNTT:20240001",
    userId: null,
    displayName: "Nguyễn Văn A",
    unitCode: "KHOA_CNTT",
    eligibilityStatus: "ELIGIBLE",
    createdAt: new Date(),
  });
}

describe("D05-A — Roster Participant Activation & Account Handoff", () => {
  let mock: ReturnType<typeof createMockPrisma>;
  let service: ActivationService;

  beforeEach(() => {
    mock = createMockPrisma();
    seedCommon(mock.store);
    service = new ActivationService(mock.prisma);
  });

  // -------------------------------------------------------------------------
  // 1. Valid issue + claim
  // -------------------------------------------------------------------------
  it("1. allows an authorized TA to issue a claim token and participant to claim it", async () => {
    // Step 1: TA issues token
    const issueRes = await service.issueActivationToken(
      { enrollmentId: "enr-1" },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );

    expect(issueRes.enrollmentId).toBe("enr-1");
    expect(issueRes.personKey).toBe("KHOA_CNTT:20240001");
    expect(issueRes.claimToken).toBeDefined();
    expect(issueRes.claimToken.length).toBe(64); // 32-byte hex
    expect(issueRes.reissued).toBe(false);

    // Step 2: Participant claims activation
    const claimRes = await service.claimActivation({
      claimToken: issueRes.claimToken,
      username: "nguyenvana",
      displayName: "Nguyễn Văn A",
    });

    expect(claimRes.success).toBe(true);
    expect(claimRes.outcome).toBe("NEWLY_ACTIVATED");
    expect(claimRes.username).toBe("nguyenvana");
    expect(claimRes.displayName).toBe("Nguyễn Văn A");
    expect(claimRes.userId).toBeDefined();

    // Verify enrollment is linked to newly created user
    const updatedEnrollment = mock.store.enrollments.get("enr-1");
    expect(updatedEnrollment.userId).toBe(claimRes.userId);

    // Verify user record has locked sentinel password (unusable)
    const createdUser = mock.store.users.get(claimRes.userId);
    expect(createdUser.passwordHash).toBe("!UNCLAIMED");
    expect(createdUser.recoveryCodeHash).toBe("!UNCLAIMED");
    expect(createdUser.role).toBe("USER");
  });

  // -------------------------------------------------------------------------
  // 2. Expired token rejected
  // -------------------------------------------------------------------------
  it("2. rejects claim when activation token is expired", async () => {
    const issueRes = await service.issueActivationToken(
      { enrollmentId: "enr-1" },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );

    // Artificially expire the issued token
    for (const entry of mock.store.commandLedger.values()) {
      if (entry.operation === "ROSTER_ACTIVATION_ISSUE") {
        entry.expiresAt = new Date(Date.now() - 1000); // 1s in the past
      }
    }

    await expect(
      service.claimActivation({
        claimToken: issueRes.claimToken,
        username: "nguyenvana",
        displayName: "Nguyễn Văn A",
      }),
    ).rejects.toThrow(AppError);

    try {
      await service.claimActivation({
        claimToken: issueRes.claimToken,
        username: "nguyenvana",
        displayName: "Nguyễn Văn A",
      });
    } catch (err: any) {
      expect(err.statusCode).toBe(401);
      expect(err.details?.reason).toBe("TOKEN_EXPIRED");
    }
  });

  // -------------------------------------------------------------------------
  // 3. Invalid / tampered token rejected
  // -------------------------------------------------------------------------
  it("3. rejects claim with non-existent or tampered token", async () => {
    await expect(
      service.claimActivation({
        claimToken: "non_existent_or_tampered_token_abcdef123456",
        username: "nguyenvana",
        displayName: "Nguyễn Văn A",
      }),
    ).rejects.toThrow(AppError);

    try {
      await service.claimActivation({
        claimToken: "non_existent_or_tampered_token_abcdef123456",
        username: "nguyenvana",
        displayName: "Nguyễn Văn A",
      });
    } catch (err: any) {
      expect(err.statusCode).toBe(401);
      expect(err.details?.reason).toBe("INVALID_TOKEN");
    }
  });

  // -------------------------------------------------------------------------
  // 4. Replay claim is idempotent
  // -------------------------------------------------------------------------
  it("4. handles replay of the same claim idempotently without creating duplicate users", async () => {
    const issueRes = await service.issueActivationToken(
      { enrollmentId: "enr-1" },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );

    const firstClaim = await service.claimActivation({
      claimToken: issueRes.claimToken,
      username: "nguyenvana",
      displayName: "Nguyễn Văn A",
    });

    const userCountAfterFirst = mock.store.users.size;

    // Second claim with exact same token
    const replayClaim = await service.claimActivation({
      claimToken: issueRes.claimToken,
      username: "nguyenvana",
      displayName: "Nguyễn Văn A",
    });

    expect(replayClaim.success).toBe(true);
    expect(replayClaim.userId).toBe(firstClaim.userId);
    expect(mock.store.users.size).toBe(userCountAfterFirst); // No duplicate user
  });

  it("handles concurrent claims with one durable account and a safe replay", async () => {
    const issueRes = await service.issueActivationToken(
      { enrollmentId: "enr-1" },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );

    // Hold both pre-transaction replay reads so neither request can observe
    // the winner before entering the serialized transaction boundary.
    const originalFindFirst = mock.prisma.commandLedgerEntry.findFirst;
    let claimReads = 0;
    let releaseReads!: () => void;
    const readsReady = new Promise<void>((resolve) => { releaseReads = resolve; });
    mock.prisma.commandLedgerEntry.findFirst = async (args: any) => {
      const result = await originalFindFirst(args);
      if (args.where?.operation === "ROSTER_ACTIVATION_CLAIM" && !result) {
        claimReads += 1;
        if (claimReads === 2) releaseReads();
        await readsReady;
      }
      return result;
    };

    // A real database serializes the claim transaction. Model that boundary
    // in the unit harness so the second transaction sees the first durable
    // user/claim and rolls back its own attempt.
    const originalTransaction = mock.prisma.$transaction;
    let queue = Promise.resolve();
    mock.prisma.$transaction = async (callback: any) => {
      const previous = queue;
      let release!: () => void;
      queue = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      try {
        return await originalTransaction(callback);
      } finally {
        release();
      }
    };

    const results = await Promise.all([
      service.claimActivation({ claimToken: issueRes.claimToken, username: "race-user", displayName: "Race User" }),
      service.claimActivation({ claimToken: issueRes.claimToken, username: "race-user", displayName: "Race User" }),
    ]);

    expect(results.every((result) => result.success)).toBe(true);
    expect(new Set(results.map((result) => result.userId)).size).toBe(1);
    expect(mock.store.users.size).toBe(1);
    expect([...mock.store.commandLedger.values()].filter((entry) => entry.operation === "ROSTER_ACTIVATION_CLAIM")).toHaveLength(1);
    expect([...mock.store.auditLogs.values()].filter((entry) => entry.action === "ROSTER_ACTIVATION_CLAIMED")).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // 5. Reused/existing account (from D04-B)
  // -------------------------------------------------------------------------
  it("5. links existing user account without password overwrite", async () => {
    // Seed an existing user from prior roster reuse
    mock.store.users.set("existing-user-1", {
      id: "existing-user-1",
      username: "reused_user",
      usernameNormalized: "reused_user",
      displayName: "Nguyễn Văn A",
      passwordHash: "!UNCLAIMED",
      recoveryCodeHash: "!UNCLAIMED",
    });

    // Enrollment already points to existing-user-1
    mock.store.enrollments.get("enr-1").userId = "existing-user-1";

    const issueRes = await service.issueActivationToken(
      { enrollmentId: "enr-1" },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );

    const claimRes = await service.claimActivation({
      claimToken: issueRes.claimToken,
      username: "reused_user",
      displayName: "Nguyễn Văn A",
    });

    expect(claimRes.outcome).toBe("LINKED_TO_EXISTING");
    expect(claimRes.userId).toBe("existing-user-1");
  });

  // -------------------------------------------------------------------------
  // 6. Credential not overwritten: already active account rejected
  // -------------------------------------------------------------------------
  it("6. rejects issuing new token or claiming if account is already ACTIVE with credentials", async () => {
    // Existing user who already set a real scrypt password in D05-B
    mock.store.users.set("active-user-1", {
      id: "active-user-1",
      username: "active_user",
      passwordHash: "scrypt$1234$abcdef", // active credential
    });
    mock.store.enrollments.get("enr-1").userId = "active-user-1";

    // Attempting to issue token must be rejected with 409 CONFLICT
    await expect(
      service.issueActivationToken(
        { enrollmentId: "enr-1" },
        { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
      ),
    ).rejects.toThrow(AppError);

    try {
      await service.issueActivationToken(
        { enrollmentId: "enr-1" },
        { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
      );
    } catch (err: any) {
      expect(err.statusCode).toBe(409);
      expect(err.details?.reason).toBe("ALREADY_ACTIVE");
    }

    // Verify existing passwordHash remains untouched
    expect(mock.store.users.get("active-user-1").passwordHash).toBe("scrypt$1234$abcdef");
  });

  // -------------------------------------------------------------------------
  // 7. Contract / scope mismatch
  // -------------------------------------------------------------------------
  it("7. rejects token issuance when TA is not bound to the enrollment contract", async () => {
    // Enrollment in another contract
    mock.store.contracts.set("contract-2", {
      id: "contract-2",
      status: "ACTIVE",
      validFrom: VALID_FROM,
      validTo: VALID_TO,
    });
    mock.store.enrollments.set("enr-other", {
      id: "enr-other",
      contractId: "contract-2",
      personKey: "OTHER:123",
      userId: null,
    });

    // TA is only bound to contract-1
    await expect(
      service.issueActivationToken(
        { enrollmentId: "enr-other" },
        { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
      ),
    ).rejects.toThrow(AppError);

    try {
      await service.issueActivationToken(
        { enrollmentId: "enr-other" },
        { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
      );
    } catch (err: any) {
      expect(err.statusCode).toBe(403);
      expect(err.details?.reason).toBe("OUT_OF_SCOPE");
    }
  });

  // -------------------------------------------------------------------------
  // 8. Retry / idempotency in token issuance
  // -------------------------------------------------------------------------
  it("8. re-issuing with same idempotencyKey returns existing token acknowledgement", async () => {
    const firstIssue = await service.issueActivationToken(
      { enrollmentId: "enr-1", idempotencyKey: "key-123" },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );
    expect(firstIssue.reissued).toBe(false);

    const secondIssue = await service.issueActivationToken(
      { enrollmentId: "enr-1", idempotencyKey: "key-123" },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );
    expect(secondIssue.reissued).toBe(true);
    expect(secondIssue.expiresAt).toBe(firstIssue.expiresAt);
  });

  // -------------------------------------------------------------------------
  // 9. Non-existent enrollment rejected with NOT_FOUND
  // -------------------------------------------------------------------------
  it("9. rejects token issuance for non-existent enrollment with 404 NOT_FOUND", async () => {
    await expect(
      service.issueActivationToken(
        { enrollmentId: "non-existent-id" },
        { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
      ),
    ).rejects.toThrow(AppError);

    try {
      await service.issueActivationToken(
        { enrollmentId: "non-existent-id" },
        { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
      );
    } catch (err: any) {
      expect(err.statusCode).toBe(404);
    }
  });

  // -------------------------------------------------------------------------
  // 10. Plaintext password in claim request rejected
  // -------------------------------------------------------------------------
  it("10. rejects claim request containing plaintext password field immediately", async () => {
    const issueRes = await service.issueActivationToken(
      { enrollmentId: "enr-1" },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );

    const maliciousClaim: any = {
      claimToken: issueRes.claimToken,
      username: "nguyenvana",
      displayName: "Nguyễn Văn A",
      password: "plaintext_secret_123",
    };

    await expect(service.claimActivation(maliciousClaim)).rejects.toThrow(AppError);

    try {
      await service.claimActivation(maliciousClaim);
    } catch (err: any) {
      expect(err.statusCode).toBe(400);
      expect(err.message).toContain("Không chấp nhận trường mật khẩu");
    }
  });

  // -------------------------------------------------------------------------
  // 11. Raw secret is NOT persisted in audit logs or ledger
  // -------------------------------------------------------------------------
  it("11. persists only token hashes and never raw claim tokens in ledger or audit records", async () => {
    const issueRes = await service.issueActivationToken(
      { enrollmentId: "enr-1" },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );

    const rawToken = issueRes.claimToken;

    // Check command ledger entries
    for (const entry of mock.store.commandLedger.values()) {
      expect(entry.payloadDigest).not.toBe(rawToken);
      expect(JSON.stringify(entry.ackPayload ?? {})).not.toContain(rawToken);
    }

    // Check audit logs
    for (const log of mock.store.auditLogs.values()) {
      expect(JSON.stringify(log.afterSnapshot ?? {})).not.toContain(rawToken);
    }
  });

  // -------------------------------------------------------------------------
  // 12. Activation status inspection
  // -------------------------------------------------------------------------
  it("12. returns correct lifecycle status via getActivationStatus", async () => {
    // Initial status: UNCLAIMED
    const initialStatus = await service.getActivationStatus("enr-1", {
      userId: "ta-user-1",
      role: "TOURNAMENT_ADMIN",
    });
    expect(initialStatus.status).toBe("UNCLAIMED");

    // After token issued: TOKEN_ISSUED
    const issueRes = await service.issueActivationToken(
      { enrollmentId: "enr-1" },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );
    const issuedStatus = await service.getActivationStatus("enr-1", {
      userId: "ta-user-1",
      role: "TOURNAMENT_ADMIN",
    });
    expect(issuedStatus.status).toBe("TOKEN_ISSUED");

    // After claim: CLAIMED
    await service.claimActivation({
      claimToken: issueRes.claimToken,
      username: "nguyenvana",
      displayName: "Nguyễn Văn A",
    });
    const claimedStatus = await service.getActivationStatus("enr-1", {
      userId: "ta-user-1",
      role: "TOURNAMENT_ADMIN",
    });
    expect(claimedStatus.status).toBe("CLAIMED");
  });

  // -------------------------------------------------------------------------
  // 13. D05-B: Setup real credential on CLAIMED account -> transitions to ACTIVE
  // -------------------------------------------------------------------------
  it("13. allows participant to setup real credentials on a CLAIMED account and transitions to ACTIVE", async () => {
    const issueRes = await service.issueActivationToken(
      { enrollmentId: "enr-1" },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );

    const claimRes = await service.claimActivation({
      claimToken: issueRes.claimToken,
      username: "nguyenvana",
      displayName: "Nguyễn Văn A",
    });
    expect(claimRes.outcome).toBe("NEWLY_ACTIVATED");

    // Setup credential
    const credRes = await service.setupCredential({
      claimToken: issueRes.claimToken,
      password: "SuperSecretPassword123!",
    });

    expect(credRes.success).toBe(true);
    expect(credRes.status).toBe("ACTIVE");
    expect(credRes.userId).toBe(claimRes.userId);
    expect(credRes.username).toBe("nguyenvana");
    expect(credRes.recoveryCode).toBeDefined();
    expect(credRes.recoveryCode).toMatch(/^OTTV2-/);

    // Verify User record in DB has real scrypt hashes
    const updatedUser = mock.store.users.get(claimRes.userId);
    expect(updatedUser.passwordHash).toMatch(/^scrypt\$/);
    expect(updatedUser.recoveryCodeHash).toMatch(/^scrypt\$/);
    expect(updatedUser.passwordHash).not.toContain("SuperSecretPassword123!");

    // Verify activation status transitions to ACTIVE
    const activeStatus = await service.getActivationStatus("enr-1", {
      userId: "ta-user-1",
      role: "TOURNAMENT_ADMIN",
    });
    expect(activeStatus.status).toBe("ACTIVE");
  });

  // -------------------------------------------------------------------------
  // 14. D05-B: Verify credentials can authenticate with auth crypto
  // -------------------------------------------------------------------------
  it("14. verifies participant password authenticates correctly via auth crypto verifySecret", async () => {
    const issueRes = await service.issueActivationToken(
      { enrollmentId: "enr-1" },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );

    const claimRes = await service.claimActivation({
      claimToken: issueRes.claimToken,
      username: "nguyenvana",
      displayName: "Nguyễn Văn A",
    });

    await service.setupCredential({
      claimToken: issueRes.claimToken,
      password: "ValidPassword123!",
    });

    const user = mock.store.users.get(claimRes.userId);
    const valid = await verifySecret("ValidPassword123!", user.passwordHash);
    expect(valid).toBe(true);

    const invalid = await verifySecret("WrongPassword123!", user.passwordHash);
    expect(invalid).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 15. D05-B: Rejects credential setup before claiming (TOKEN_ISSUED state)
  // -------------------------------------------------------------------------
  it("15. rejects setupCredential if enrollment has not been claimed yet", async () => {
    const issueRes = await service.issueActivationToken(
      { enrollmentId: "enr-1" },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );

    // Do NOT claim, jump directly to setupCredential
    await expect(
      service.setupCredential({
        claimToken: issueRes.claimToken,
        password: "ValidPassword123!",
      }),
    ).rejects.toThrow(AppError);

    try {
      await service.setupCredential({
        claimToken: issueRes.claimToken,
        password: "ValidPassword123!",
      });
    } catch (err: any) {
      expect(err.statusCode).toBe(409);
      expect(err.details?.reason).toBe("NOT_CLAIMED");
    }
  });

  // -------------------------------------------------------------------------
  // 16. D05-B: Rejects credential setup with invalid token
  // -------------------------------------------------------------------------
  it("16. rejects setupCredential when given an invalid or non-existent token", async () => {
    await expect(
      service.setupCredential({
        claimToken: "non_existent_token_12345678",
        password: "ValidPassword123!",
      }),
    ).rejects.toThrow(AppError);

    try {
      await service.setupCredential({
        claimToken: "non_existent_token_12345678",
        password: "ValidPassword123!",
      });
    } catch (err: any) {
      expect(err.statusCode).toBe(401);
      expect(err.details?.reason).toBe("INVALID_TOKEN");
    }
  });

  // -------------------------------------------------------------------------
  // 17. D05-B: Prevents credential overwrite on already ACTIVE account
  // -------------------------------------------------------------------------
  it("17. prevents credential overwrite on an already ACTIVE account via activation flow", async () => {
    // Seed an existing active user from D04-B reuse
    mock.store.users.set("user-active-1", {
      id: "user-active-1",
      username: "user_active",
      passwordHash: "scrypt$existing$originalhash",
      recoveryCodeHash: "scrypt$existing$recovhash",
    });
    mock.store.enrollments.get("enr-1").userId = "user-active-1";

    // Set a fake claim ledger entry
    mock.store.commandLedger.set("claim:enr-1", {
      id: "cmd-claim-1",
      principalId: "user-active-1",
      targetId: "enr-1",
      operation: "ROSTER_ACTIVATION_CLAIM",
      outcome: "CLAIMED",
    });

    // An issue entry
    mock.store.commandLedger.set("issue:enr-1", {
      id: "cmd-issue-1",
      principalId: "ta-user-1",
      targetId: "enr-1",
      operation: "ROSTER_ACTIVATION_ISSUE",
      payloadDigest: "somehash",
      outcome: "ISSUED",
    });

    await expect(
      service.setupCredential({
        claimToken: "sometoken",
        password: "NewPassword123!",
      }),
    ).rejects.toThrow(AppError);

    // Verify existing passwordHash remains untouched
    expect(mock.store.users.get("user-active-1").passwordHash).toBe("scrypt$existing$originalhash");
  });

  // -------------------------------------------------------------------------
  // 18. D05-B: Idempotent replay of setupCredential with same token
  // -------------------------------------------------------------------------
  it("18. handles replay of setupCredential idempotently without resetting password or exposing recoveryCode", async () => {
    const issueRes = await service.issueActivationToken(
      { enrollmentId: "enr-1" },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );

    await service.claimActivation({
      claimToken: issueRes.claimToken,
      username: "nguyenvana",
      displayName: "Nguyễn Văn A",
    });

    const firstSetup = await service.setupCredential({
      claimToken: issueRes.claimToken,
      password: "Password123!",
    });
    expect(firstSetup.recoveryCode).toBeDefined();

    const initialPasswordHash = mock.store.users.get(firstSetup.userId).passwordHash;

    // Second call with same token
    const replaySetup = await service.setupCredential({
      claimToken: issueRes.claimToken,
      password: "Password123!",
    });

    expect(replaySetup.success).toBe(true);
    expect(replaySetup.status).toBe("ACTIVE");
    expect(replaySetup.userId).toBe(firstSetup.userId);
    // Raw recovery code is omitted on replay (one-time handoff)
    expect(replaySetup.recoveryCode).toBeUndefined();

    // Password hash in DB must NOT have been re-computed or modified
    expect(mock.store.users.get(firstSetup.userId).passwordHash).toBe(initialPasswordHash);
  });

  // -------------------------------------------------------------------------
  // 19. D05-B: Schema enforces password policy (minimum 8 chars)
  // -------------------------------------------------------------------------
  it("19. rejects password shorter than 8 characters via schema validation", () => {
    const invalidInput = {
      claimToken: "token123",
      password: "short",
    };

    const parseResult = SetupCredentialRequestSchema.safeParse(invalidInput);
    expect(parseResult.success).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 20. D05-B: Raw password & recovery code never persisted in audit/ledger
  // -------------------------------------------------------------------------
  it("20. ensures raw password and recovery code are never persisted in command ledger or audit log", async () => {
    const issueRes = await service.issueActivationToken(
      { enrollmentId: "enr-1" },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );

    await service.claimActivation({
      claimToken: issueRes.claimToken,
      username: "nguyenvana",
      displayName: "Nguyễn Văn A",
    });

    const plainPassword = "SuperSecretPassword123!";
    const credRes = await service.setupCredential({
      claimToken: issueRes.claimToken,
      password: plainPassword,
    });

    const recoveryCode = credRes.recoveryCode!;

    // Check command ledger
    for (const entry of mock.store.commandLedger.values()) {
      const serialized = JSON.stringify(entry);
      expect(serialized).not.toContain(plainPassword);
      expect(serialized).not.toContain(recoveryCode);
    }

    // Check audit logs
    for (const log of mock.store.auditLogs.values()) {
      const serialized = JSON.stringify(log);
      expect(serialized).not.toContain(plainPassword);
      expect(serialized).not.toContain(recoveryCode);
    }
  });
});
