/**
 * D04-B — Account Reuse & Retry Behavior for Roster Import
 *
 * Tests the canonical person_key-based account reuse boundary:
 *  - Existing person_key → reuse existing userId from prior enrollment
 *  - Existing credentials unchanged — no password reset, no credential creation
 *  - Same name / email but different person_key → NOT merged
 *  - Different unit_code → different person_key → NOT merged
 *  - New person/account → enrollment with userId = null (D05 activates)
 *  - Repeated import → no duplicate account/enrollment
 *  - Retry after failure → safe/idempotent
 *  - Transaction failure → no partial state
 *  - Plaintext password rejected
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { RosterService } from "../../src/modules/roster/roster.service.js";
import { AppError } from "../../src/shared/errors/app-error.js";

// ---------------------------------------------------------------------------
// Mock Prisma factory — extended to support D04-B scenarios
// ---------------------------------------------------------------------------
function createMockPrisma() {
  const store = {
    tournaments: new Map<string, any>(),
    contracts: new Map<string, any>(),
    units: new Map<string, any>(),
    taBindings: new Map<string, any>(),
    enrollments: new Map<string, any>(),
    users: new Map<string, any>(),
    commandLedger: new Map<string, any>(),
    auditLogs: new Map<string, any>(),
  };

  const createTx = () => ({
    tournamentEnrollmentRecord: {
      /** Find enrollments that conflict on personKey within this tournament */
      findMany: vi.fn(async ({ where }: any) => {
        const results: any[] = [];
        for (const record of store.enrollments.values()) {
          if (record.tournamentId === where.tournamentId) {
            if (where.personKey?.in && where.personKey.in.includes(record.personKey)) {
              results.push(record);
            }
          }
        }
        return results;
      }),

      /**
       * D04-B: findFirst looks for any prior enrollment for this person_key
       * (across ALL tournaments) that has a linked userId.
       */
      findFirst: vi.fn(async ({ where, orderBy }: any) => {
        // Collect all matching enrollments for this personKey that have a userId
        const candidates: any[] = [];
        for (const record of store.enrollments.values()) {
          if (record.personKey === where.personKey) {
            if (where.userId?.not === null) {
              // Condition: userId is NOT null
              if (record.userId != null) candidates.push(record);
            } else {
              candidates.push(record);
            }
          }
        }
        if (candidates.length === 0) return null;
        // Sort desc by createdAt to honour orderBy: { createdAt: "desc" }
        const sorted = [...candidates].sort(
          (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
        );
        return sorted[0] ?? null;
      }),

      create: vi.fn(async ({ data }: any) => {
        store.enrollments.set(data.id, {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return store.enrollments.get(data.id);
      }),

      count: vi.fn(async ({ where }: any) => {
        let count = 0;
        for (const record of store.enrollments.values()) {
          if (where.tournamentId && record.tournamentId === where.tournamentId) count++;
          else if (where.contractId && record.contractId === where.contractId) count++;
        }
        return count;
      }),
    },

    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.usernameNormalized) {
          for (const u of store.users.values()) {
            if (u.usernameNormalized === where.usernameNormalized) return u;
          }
        }
        return null;
      }),
    },

    commandLedgerEntry: {
      create: vi.fn(async ({ data }: any) => {
        const key = `${data.principalId}:${data.targetId}:${data.operation}:${data.commandId}`;
        store.commandLedger.set(key, { ...data });
        return data;
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
    unit: {
      findMany: vi.fn(async () => Array.from(store.units.values())),
    },

    tournament: {
      findUnique: vi.fn(async ({ where }: any) => {
        const t = store.tournaments.get(where.id);
        if (!t) return null;
        const contract = store.contracts.get(t.contractId);
        const unit = store.units.get(t.unitId);
        const bindings = Array.from(store.taBindings.values()).filter(
          (b) => b.contractId === t.contractId,
        );
        return {
          ...t,
          unit,
          contract: contract ? { ...contract, taBindings: bindings } : null,
        };
      }),
    },

    tournamentEnrollmentRecord: {
      count: vi.fn(async ({ where }: any) => {
        let count = 0;
        for (const record of store.enrollments.values()) {
          if (where.tournamentId && record.tournamentId === where.tournamentId) count++;
          else if (where.contractId && record.contractId === where.contractId) count++;
        }
        return count;
      }),
    },

    commandLedgerEntry: {
      findUnique: vi.fn(async ({ where }: any) => {
        const p = where.principalId_targetId_operation_commandId;
        const key = `${p.principalId}:${p.targetId}:${p.operation}:${p.commandId}`;
        return store.commandLedger.get(key) || null;
      }),
    },

    $transaction: vi.fn(async (callback: any) => {
      const snapshot = {
        enrollments: new Map(store.enrollments),
        commandLedger: new Map(store.commandLedger),
        auditLogs: new Map(store.auditLogs),
      };
      try {
        const tx = createTx();
        return await callback(tx);
      } catch (err) {
        store.enrollments = snapshot.enrollments;
        store.commandLedger = snapshot.commandLedger;
        store.auditLogs = snapshot.auditLogs;
        throw err;
      }
    }),
  };

  return { prisma, store };
}

// ---------------------------------------------------------------------------
// Common fixture helpers
// ---------------------------------------------------------------------------
const VALID_FROM = new Date("2026-01-01T00:00:00Z");
const VALID_TO = new Date("2026-12-31T23:59:59Z");

function seedCommon(store: ReturnType<typeof createMockPrisma>["store"]) {
  store.units.set("unit-1", {
    id: "unit-1",
    unitCode: "KHOA_CNTT",
    unitName: "Khoa CNTT",
    status: "ACTIVE",
  });

  store.contracts.set("contract-1", {
    id: "contract-1",
    contractCode: "CONTRACT-2026",
    unitId: "unit-1",
    status: "ACTIVE",
    validFrom: VALID_FROM,
    validTo: VALID_TO,
    maxParticipantsPerTournament: 100,
    maxParticipantsTotal: 500,
    policyEnvelope: { allowedUnits: ["KHOA_CNTT"] },
  });

  store.taBindings.set("binding-1", {
    id: "binding-1",
    contractId: "contract-1",
    userId: "ta-user-1",
    status: "ACTIVE",
  });

  store.tournaments.set("tour-1", {
    id: "tour-1",
    tournamentCode: "TOURNAMENT-2026",
    contractId: "contract-1",
    unitId: "unit-1",
    ownerTaUserId: "ta-user-1",
    status: "DRAFT",
    revision: 1,
  });

  // Second tournament (same contract) for cross-tournament reuse tests
  store.tournaments.set("tour-2", {
    id: "tour-2",
    tournamentCode: "TOURNAMENT-2026-B",
    contractId: "contract-1",
    unitId: "unit-1",
    ownerTaUserId: "ta-user-1",
    status: "DRAFT",
    revision: 1,
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe("D04-B — Account Reuse & Retry Boundary", () => {
  let mock: ReturnType<typeof createMockPrisma>;
  let service: RosterService;

  beforeEach(() => {
    mock = createMockPrisma();
    service = new RosterService(mock.prisma as any);
    seedCommon(mock.store);
  });

  // --------------------------------------------------------------------------
  // 1. Existing person_key → reuse existing userId from prior enrollment
  // --------------------------------------------------------------------------
  it("1. reuses the userId from a prior enrollment when the same person_key exists in another tournament", async () => {
    // Person was already enrolled in tour-2 and has a linked userId
    mock.store.enrollments.set("prior-enroll-1", {
      id: "prior-enroll-1",
      tournamentId: "tour-2",
      contractId: "contract-1",
      personKey: "KHOA_CNTT:00123",
      userId: "existing-user-id",
      displayName: "Nguyen Van A",
      unitCode: "KHOA_CNTT",
      createdAt: new Date("2026-09-01T00:00:00Z"),
      updatedAt: new Date("2026-09-01T00:00:00Z"),
    });

    // No User in users store — reuse comes from prior enrollment, not from user table lookup
    const rows = [
      {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "00123",
        full_name: "Nguyen Van A",
        username: "nguyenvana",
      },
    ];

    const result = await service.commitRosterImport(
      { tournamentId: "tour-1", rows },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );

    expect(result.success).toBe(true);
    expect(result.outcomes[0].status).toBe("LINKED_EXISTING");
    expect(result.outcomes[0].userId).toBe("existing-user-id");

    const saved = mock.store.enrollments.get(result.outcomes[0].enrollmentId!);
    expect(saved.userId).toBe("existing-user-id");
  });

  // --------------------------------------------------------------------------
  // 2. Existing credentials are unchanged
  // --------------------------------------------------------------------------
  it("2. does not modify credentials of an existing linked user — passwordHash is never touched", async () => {
    mock.store.users.set("user-abc", {
      id: "user-abc",
      username: "nguyenvana",
      usernameNormalized: "nguyenvana",
      fullName: "Nguyen Van A",
      passwordHash: "$2b$12$ORIGINAL_HASH",
    });

    const rows = [
      {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "00123",
        full_name: "Nguyen Van A",
        username: "nguyenvana",
      },
    ];

    const result = await service.commitRosterImport(
      { tournamentId: "tour-1", rows },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );

    // User linked correctly
    expect(result.outcomes[0].status).toBe("LINKED_EXISTING");
    expect(result.outcomes[0].userId).toBe("user-abc");

    // The user record in store is UNTOUCHED — we never wrote to users table
    const userRecord = mock.store.users.get("user-abc");
    expect(userRecord.passwordHash).toBe("$2b$12$ORIGINAL_HASH");

    // No user.update or user.create calls happened
    // (The tx.user mock only has findUnique — if update existed and was called it would throw)
  });

  // --------------------------------------------------------------------------
  // 3. Same name but different person_key → NOT merged
  // --------------------------------------------------------------------------
  it("3. does not merge persons with same full_name but different person_key", async () => {
    // Existing enrollment for PERSON A with userId
    mock.store.enrollments.set("enroll-person-a", {
      id: "enroll-person-a",
      tournamentId: "tour-2",
      contractId: "contract-1",
      personKey: "KHOA_CNTT:PERSON_A",
      userId: "user-for-person-a",
      displayName: "Nguyen Van Shared Name",
      unitCode: "KHOA_CNTT",
      createdAt: new Date("2026-09-01T00:00:00Z"),
      updatedAt: new Date("2026-09-01T00:00:00Z"),
    });

    // Different student_or_member_id → different person_key → must NOT inherit userId
    const rows = [
      {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "PERSON_B", // Different ID → different person
        full_name: "Nguyen Van Shared Name", // Same name — must NOT trigger merge
        username: "different_username",
      },
    ];

    const result = await service.commitRosterImport(
      { tournamentId: "tour-1", rows },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );

    expect(result.success).toBe(true);
    // Must be IMPORTED (no user linked), not LINKED_EXISTING via name
    expect(result.outcomes[0].status).toBe("IMPORTED");
    expect(result.outcomes[0].userId).toBeUndefined();
    expect(result.outcomes[0].person_key).toBe("KHOA_CNTT:PERSON_B");
  });

  // --------------------------------------------------------------------------
  // 4. Different unit_code → different person_key → NOT merged
  // --------------------------------------------------------------------------
  it("4. does not merge persons with different unit_code even if student_id matches", async () => {
    // Person in KHOA_CNTT with userId
    mock.store.enrollments.set("enroll-unit-a", {
      id: "enroll-unit-a",
      tournamentId: "tour-2",
      contractId: "contract-1",
      personKey: "KHOA_CNTT:SHARED_STUDENT_ID",
      userId: "user-in-unit-a",
      displayName: "Student X",
      unitCode: "KHOA_CNTT",
      createdAt: new Date("2026-09-01T00:00:00Z"),
      updatedAt: new Date("2026-09-01T00:00:00Z"),
    });

    // Add a second allowed unit to the policy for this test
    (mock.store.contracts.get("contract-1") as any).policyEnvelope = {
      allowedUnits: ["KHOA_CNTT", "KHOA_TOAN"],
    };
    mock.store.units.set("unit-2", {
      id: "unit-2",
      unitCode: "KHOA_TOAN",
      unitName: "Khoa Toan",
      status: "ACTIVE",
    });

    // Same student_or_member_id but different unit → personKey is "KHOA_TOAN:SHARED_STUDENT_ID"
    const rows = [
      {
        unit_code: "KHOA_TOAN",
        student_or_member_id: "SHARED_STUDENT_ID",
        full_name: "Student X",
        username: "studentx_toan",
      },
    ];

    const result = await service.commitRosterImport(
      { tournamentId: "tour-1", rows },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );

    expect(result.success).toBe(true);
    // Must be IMPORTED: "KHOA_TOAN:SHARED_STUDENT_ID" has no prior enrollment
    expect(result.outcomes[0].status).toBe("IMPORTED");
    expect(result.outcomes[0].userId).toBeUndefined();
    expect(result.outcomes[0].person_key).toBe("KHOA_TOAN:SHARED_STUDENT_ID");
  });

  // --------------------------------------------------------------------------
  // 5. New person/account → enrollment with userId = null
  // --------------------------------------------------------------------------
  it("5. creates enrollment with userId = null for a completely new person (no prior enrollment, no user)", async () => {
    const rows = [
      {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "BRAND_NEW_00001",
        full_name: "Brand New Student",
        username: "brandnew",
      },
    ];

    const result = await service.commitRosterImport(
      { tournamentId: "tour-1", rows },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );

    expect(result.success).toBe(true);
    expect(result.outcomes[0].status).toBe("IMPORTED");
    expect(result.outcomes[0].userId).toBeUndefined();

    const saved = mock.store.enrollments.get(result.outcomes[0].enrollmentId!);
    expect(saved.userId).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 6. Repeated import → no duplicate account/enrollment
  // --------------------------------------------------------------------------
  it("6. repeated commit of the same batch with same idempotencyKey creates no duplicate enrollments", async () => {
    const rows = [
      {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "00501",
        full_name: "Repeat Student",
        username: "repeatstudent",
      },
    ];
    const key = "idem-key-repeat-001";

    const r1 = await service.commitRosterImport(
      { tournamentId: "tour-1", rows, idempotencyKey: key },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );
    expect(r1.success).toBe(true);
    expect(mock.store.enrollments.size).toBe(1);

    const r2 = await service.commitRosterImport(
      { tournamentId: "tour-1", rows, idempotencyKey: key },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );
    expect(r2.success).toBe(true);
    expect(r2.importedCount).toBe(1);
    // Critical: still exactly 1 enrollment
    expect(mock.store.enrollments.size).toBe(1);
  });

  // --------------------------------------------------------------------------
  // 7. Retry after failure → safe / idempotent (no idempotencyKey path)
  // --------------------------------------------------------------------------
  it("7. without idempotencyKey, a retry after failure does not create duplicate enrollments if person_key is already committed", async () => {
    const rows = [
      {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "00502",
        full_name: "Retry Student",
        username: "retrystudent",
      },
    ];

    // First commit succeeds
    await service.commitRosterImport(
      { tournamentId: "tour-1", rows },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );
    expect(mock.store.enrollments.size).toBe(1);

    // Second attempt (same person_key) is rejected as CONFLICT — DB uniqueness prevents duplicate
    await expect(
      service.commitRosterImport(
        { tournamentId: "tour-1", rows },
        { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
      ),
    ).rejects.toThrowError(/đã được ghi danh trong giải đấu này/);

    // Still only 1 enrollment
    expect(mock.store.enrollments.size).toBe(1);
  });

  // --------------------------------------------------------------------------
  // 8. Transaction failure → no partial state
  // --------------------------------------------------------------------------
  it("8. mid-transaction failure rolls back completely — no partial enrollments or ledger entries", async () => {
    const rows = [
      {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "00601",
        full_name: "User A",
        username: "usera",
      },
      {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "00602",
        full_name: "User B",
        username: "userb",
      },
    ];

    let callCount = 0;
    const originalTx = mock.prisma.$transaction;
    mock.prisma.$transaction = vi.fn(async (cb: any) => {
      return originalTx(async (tx: any) => {
        const origCreate = tx.tournamentEnrollmentRecord.create;
        tx.tournamentEnrollmentRecord.create = vi.fn(async (args: any) => {
          callCount++;
          if (callCount === 2) {
            throw new Error("SIMULATED_CRASH_MIDWAY");
          }
          return origCreate(args);
        });
        return cb(tx);
      });
    });

    await expect(
      service.commitRosterImport(
        { tournamentId: "tour-1", rows },
        { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
      ),
    ).rejects.toThrowError("SIMULATED_CRASH_MIDWAY");

    expect(mock.store.enrollments.size).toBe(0);
    expect(mock.store.commandLedger.size).toBe(0);
    expect(mock.store.auditLogs.size).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 9. Plaintext password rejected
  // --------------------------------------------------------------------------
  it("9. any commit containing a plaintext password field is rejected before any DB write", async () => {
    const rowsWithPassword = [
      {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "00701",
        full_name: "Secret Student",
        username: "secretstudent",
        password: "MySuperSecret123",
      },
    ];

    await expect(
      service.commitRosterImport(
        { tournamentId: "tour-1", rows: rowsWithPassword },
        { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
      ),
    ).rejects.toThrow(AppError);

    await expect(
      service.commitRosterImport(
        { tournamentId: "tour-1", rows: rowsWithPassword },
        { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
      ),
    ).rejects.toThrowError(/chứa trường mật khẩu/);

    expect(mock.store.enrollments.size).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 10. person_key reuse takes priority over username-based lookup
  // --------------------------------------------------------------------------
  it("10. person_key reuse from prior enrollment takes priority over username lookup", async () => {
    // Prior enrollment links person_key to user-from-prior-enroll
    mock.store.enrollments.set("prior-enroll-priority", {
      id: "prior-enroll-priority",
      tournamentId: "tour-2",
      contractId: "contract-1",
      personKey: "KHOA_CNTT:PRI001",
      userId: "user-from-prior-enroll",
      displayName: "Priority Person",
      unitCode: "KHOA_CNTT",
      createdAt: new Date("2026-09-01T00:00:00Z"),
      updatedAt: new Date("2026-09-01T00:00:00Z"),
    });

    // There is also a User in the users table with the same username but different id
    mock.store.users.set("user-by-username", {
      id: "user-by-username",
      username: "priorityperson",
      usernameNormalized: "priorityperson",
      fullName: "Priority Person",
    });

    const rows = [
      {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "PRI001",
        full_name: "Priority Person",
        username: "priorityperson",
      },
    ];

    const result = await service.commitRosterImport(
      { tournamentId: "tour-1", rows },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );

    // person_key-based reuse wins
    expect(result.outcomes[0].status).toBe("LINKED_EXISTING");
    expect(result.outcomes[0].userId).toBe("user-from-prior-enroll");
  });
});
