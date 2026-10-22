import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyReply, FastifyRequest } from "fastify";
import { RosterService } from "../../src/modules/roster/roster.service.js";
import { registerRosterRoutes } from "../../src/modules/roster/roster.route.js";
import { AppError } from "../../src/shared/errors/app-error.js";
import type { AuthService } from "../../src/modules/auth/auth.service.js";

// Helper to create in-memory database mock supporting transactions & rollbacks
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
      // D04-B: findFirst for person_key-based account reuse lookup across all tournaments
      findFirst: vi.fn(async ({ where }: any) => {
        const candidates: any[] = [];
        for (const record of store.enrollments.values()) {
          if (record.personKey === where.personKey) {
            if (where.userId?.not === null) {
              if (record.userId != null) candidates.push(record);
            } else {
              candidates.push(record);
            }
          }
        }
        if (candidates.length === 0) return null;
        const sorted = [...candidates].sort(
          (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
        );
        return sorted[0] ?? null;
      }),
      create: vi.fn(async ({ data }: any) => {
        store.enrollments.set(data.id, { ...data, createdAt: new Date(), updatedAt: new Date() });
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
      // Snapshot state to simulate atomic rollback
      const snapshot = {
        enrollments: new Map(store.enrollments),
        commandLedger: new Map(store.commandLedger),
        auditLogs: new Map(store.auditLogs),
      };

      try {
        const tx = createTx();
        return await callback(tx);
      } catch (err) {
        // Atomic rollback
        store.enrollments = snapshot.enrollments;
        store.commandLedger = snapshot.commandLedger;
        store.auditLogs = snapshot.auditLogs;
        throw err;
      }
    }),
  };

  return { prisma, store };
}

describe("D04-A — Roster Import Commit & Idempotency Boundary", () => {
  let mock: ReturnType<typeof createMockPrisma>;
  let service: RosterService;

  const NOW = new Date("2026-10-22T10:00:00Z");
  const VALID_FROM = new Date("2026-01-01T00:00:00Z");
  const VALID_TO = new Date("2026-12-31T23:59:59Z");

  beforeEach(() => {
    mock = createMockPrisma();
    service = new RosterService(mock.prisma as any);

    // Seed active unit
    mock.store.units.set("unit-1", {
      id: "unit-1",
      unitCode: "KHOA_CNTT",
      unitName: "Khoa CNTT",
      status: "ACTIVE",
    });

    // Seed active contract
    mock.store.contracts.set("contract-1", {
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

    // Seed TA binding
    mock.store.taBindings.set("binding-1", {
      id: "binding-1",
      contractId: "contract-1",
      userId: "ta-user-1",
      status: "ACTIVE",
    });

    // Seed tournament
    mock.store.tournaments.set("tour-1", {
      id: "tour-1",
      tournamentCode: "TOURNAMENT-2026",
      contractId: "contract-1",
      unitId: "unit-1",
      ownerTaUserId: "ta-user-1",
      status: "DRAFT",
      revision: 1,
    });
  });

  // 1. Successful explicit commit
  it("1. performs a successful explicit commit and persists enrollment records", async () => {
    const rows = [
      {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "00123",
        full_name: "Nguyen Van A",
        username: "nguyenvana",
        email: "a@domain.com",
      },
      {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "00124",
        full_name: "Tran Thi B",
        username: "tranthib",
      },
    ];

    const result = await service.commitRosterImport(
      {
        tournamentId: "tour-1",
        rows,
        idempotencyKey: "cmd-commit-1",
      },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );

    expect(result.success).toBe(true);
    expect(result.tournamentId).toBe("tour-1");
    expect(result.totalRows).toBe(2);
    expect(result.importedCount).toBe(2);
    expect(result.outcomes).toHaveLength(2);
    expect(result.outcomes[0].person_key).toBe("KHOA_CNTT:00123");
    expect(result.outcomes[0].status).toBe("IMPORTED");
    expect(result.outcomes[1].person_key).toBe("KHOA_CNTT:00124");

    // Verified in mock store
    expect(mock.store.enrollments.size).toBe(2);
    const savedList = Array.from(mock.store.enrollments.values());
    expect(savedList.map((e) => e.personKey)).toEqual(["KHOA_CNTT:00123", "KHOA_CNTT:00124"]);
    expect(savedList[0].displayName).toBe("Nguyen Van A");
    expect(savedList[0].unitCode).toBe("KHOA_CNTT");
    expect(savedList[0].seedRating).toBe(1000);
    expect(savedList[0].eligibilityStatus).toBe("ELIGIBLE");
  });

  // 2. Preview does not commit
  it("2. preview does not commit or persist any account/enrollment records", async () => {
    const csvContent = Buffer.from(
      "unit_code,student_or_member_id,full_name,username\nKHOA_CNTT,00123,Nguyen Van A,nguyenvana",
      "utf-8",
    );

    const previewResult = await service.previewRoster(csvContent, "roster.csv", {
      allowedUnits: ["KHOA_CNTT"],
    });

    expect(previewResult.totalRows).toBe(1);
    expect(previewResult.validRows).toBe(1);

    // Store must remain completely empty!
    expect(mock.store.enrollments.size).toBe(0);
    expect(mock.store.commandLedger.size).toBe(0);
    expect(mock.store.auditLogs.size).toBe(0);
  });

  // 3. Unauthorized commit rejected
  it("3. rejects unauthorized commit from non-admin role or unbound TA", async () => {
    const rows = [
      {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "00123",
        full_name: "Nguyen Van A",
        username: "nguyenvana",
      },
    ];

    // Non-admin USER role
    await expect(
      service.commitRosterImport(
        { tournamentId: "tour-1", rows },
        { userId: "normal-user", role: "USER" },
      ),
    ).rejects.toThrowError(AppError);

    // TA belonging to another scope
    await expect(
      service.commitRosterImport(
        { tournamentId: "tour-1", rows },
        { userId: "other-ta", role: "TOURNAMENT_ADMIN" },
      ),
    ).rejects.toThrowError(/quyền quản trị giải đấu/);

    expect(mock.store.enrollments.size).toBe(0);
  });

  // 4. Out-of-scope commit rejected
  it("4. rejects commit when row contains out-of-scope unit code", async () => {
    const rows = [
      {
        unit_code: "UNKNOWN_OUTSIDE_UNIT",
        student_or_member_id: "00123",
        full_name: "Nguyen Van A",
        username: "nguyenvana",
      },
    ];

    await expect(
      service.commitRosterImport(
        { tournamentId: "tour-1", rows },
        { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
      ),
    ).rejects.toThrowError(/nằm ngoài phạm vi/);

    expect(mock.store.enrollments.size).toBe(0);
  });

  // 5. Capacity / quota rechecked at commit
  it("5. rechecks capacity and quota authoritatively at commit time", async () => {
    // Set contract maxParticipantsPerTournament to 2
    mock.store.contracts.get("contract-1").maxParticipantsPerTournament = 2;

    // Pre-populate tournament with 2 existing enrollments
    mock.store.enrollments.set("en-1", {
      id: "en-1",
      tournamentId: "tour-1",
      contractId: "contract-1",
      personKey: "KHOA_CNTT:EX01",
    });
    mock.store.enrollments.set("en-2", {
      id: "en-2",
      tournamentId: "tour-1",
      contractId: "contract-1",
      personKey: "KHOA_CNTT:EX02",
    });

    const rows = [
      {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "00123",
        full_name: "Nguyen Van A",
        username: "nguyenvana",
      },
    ];

    await expect(
      service.commitRosterImport(
        { tournamentId: "tour-1", rows },
        { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
      ),
    ).rejects.toThrowError(/vượt quá hạn mức tối đa/);

    // Enrollment count should still be 2 (none added)
    expect(mock.store.enrollments.size).toBe(2);
  });

  // 6. Duplicate/repeated commit is idempotent
  it("6. duplicate commit request with same idempotencyKey is idempotent", async () => {
    const rows = [
      {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "00123",
        full_name: "Nguyen Van A",
        username: "nguyenvana",
      },
    ];

    // First commit
    const res1 = await service.commitRosterImport(
      {
        tournamentId: "tour-1",
        rows,
        idempotencyKey: "idem-key-abc",
      },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );
    expect(res1.success).toBe(true);
    expect(mock.store.enrollments.size).toBe(1);

    // Second repeated commit with same idempotencyKey
    const res2 = await service.commitRosterImport(
      {
        tournamentId: "tour-1",
        rows,
        idempotencyKey: "idem-key-abc",
      },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );

    expect(res2.success).toBe(true);
    expect(res2.importedCount).toBe(1);
    // Crucial: enrollments must NOT duplicate!
    expect(mock.store.enrollments.size).toBe(1);
  });

  // 7. Retry does not create duplicate records
  it("7. client retry does not create duplicate account/enrollment records", async () => {
    const rows = [
      {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "00999",
        full_name: "Le Van C",
        username: "levanc",
      },
    ];

    const key = "retry-token-xyz";

    await service.commitRosterImport(
      { tournamentId: "tour-1", rows, idempotencyKey: key },
      { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
    );

    // Retry 3 times
    for (let i = 0; i < 3; i++) {
      const retryRes = await service.commitRosterImport(
        { tournamentId: "tour-1", rows, idempotencyKey: key },
        { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
      );
      expect(retryRes.success).toBe(true);
    }

    expect(mock.store.enrollments.size).toBe(1);
  });

  // 8. Transaction failure does not leave partial import
  it("8. transaction failure rolls back completely without leaving partial import", async () => {
    const rows = [
      {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "00101",
        full_name: "User 1",
        username: "user1",
      },
      {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "00102",
        full_name: "User 2",
        username: "user2",
      },
    ];

    // Mock failure during transaction on 2nd create call
    let callCount = 0;
    const originalCreate = mock.prisma.$transaction;
    mock.prisma.$transaction = vi.fn(async (cb: any) => {
      return originalCreate(async (tx: any) => {
        const origEnrollmentCreate = tx.tournamentEnrollmentRecord.create;
        tx.tournamentEnrollmentRecord.create = vi.fn(async (args: any) => {
          callCount++;
          if (callCount === 2) {
            throw new Error("DATABASE_CRASH_MIDWAY");
          }
          return origEnrollmentCreate(args);
        });
        return cb(tx);
      });
    });

    await expect(
      service.commitRosterImport(
        { tournamentId: "tour-1", rows },
        { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
      ),
    ).rejects.toThrowError("DATABASE_CRASH_MIDWAY");

    // Must be completely rolled back to 0!
    expect(mock.store.enrollments.size).toBe(0);
    expect(mock.store.commandLedger.size).toBe(0);
  });

  // 9. Duplicate person_key handled according to canonical spec
  it("9. duplicate person_key is rejected both in-batch and against existing DB records", async () => {
    // 9a: In-batch duplicate
    const inBatchDupes = [
      {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "SAME_ID",
        full_name: "Student One",
        username: "studentone",
      },
      {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "SAME_ID",
        full_name: "Student Two",
        username: "studenttwo",
      },
    ];

    await expect(
      service.commitRosterImport(
        { tournamentId: "tour-1", rows: inBatchDupes },
        { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
      ),
    ).rejects.toThrowError(/Trùng khóa định danh person_key/);

    expect(mock.store.enrollments.size).toBe(0);

    // 9b: Duplicate against existing DB record
    mock.store.enrollments.set("existing-1", {
      id: "existing-1",
      tournamentId: "tour-1",
      contractId: "contract-1",
      personKey: "KHOA_CNTT:ALREADY_HERE",
      displayName: "Already Enrolled",
      unitCode: "KHOA_CNTT",
    });

    const newRowConflicting = [
      {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "ALREADY_HERE",
        full_name: "Duplicate Person",
        username: "dupusername",
      },
    ];

    await expect(
      service.commitRosterImport(
        { tournamentId: "tour-1", rows: newRowConflicting },
        { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
      ),
    ).rejects.toThrowError(/đã được ghi danh trong giải đấu này/);

    // Total enrollments remains 1 (the original pre-existing one)
    expect(mock.store.enrollments.size).toBe(1);
  });

  // 10. Plaintext password is never accepted/persisted
  it("10. plaintext password in rows or file headers is strictly rejected and never persisted", async () => {
    // 10a: Password in rows
    const rowsWithPass = [
      {
        unit_code: "KHOA_CNTT",
        student_or_member_id: "00123",
        full_name: "Nguyen Van A",
        username: "nguyenvana",
        password: "SecretPassword123!",
      },
    ];

    await expect(
      service.commitRosterImport(
        { tournamentId: "tour-1", rows: rowsWithPass },
        { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
      ),
    ).rejects.toThrowError(/chứa trường mật khẩu/);

    expect(mock.store.enrollments.size).toBe(0);

    // 10b: Password in file content
    const csvWithPassword = Buffer.from(
      "unit_code,student_or_member_id,full_name,username,mat_khau\nKHOA_CNTT,00123,Nguyen Van A,nguyenvana,123456",
      "utf-8",
    ).toString("base64");

    await expect(
      service.commitRosterImport(
        {
          tournamentId: "tour-1",
          fileName: "roster.csv",
          fileContent: csvWithPassword,
        },
        { userId: "ta-user-1", role: "TOURNAMENT_ADMIN" },
      ),
    ).rejects.toThrowError(/mẫu cũ có chứa mật khẩu/);

    expect(mock.store.enrollments.size).toBe(0);
  });

  // Safe account reuse boundary
  it("links existing user when matching username exists, without creating password/credentials", async () => {
    mock.store.users.set("user-existing-id", {
      id: "user-existing-id",
      username: "nguyenvana",
      usernameNormalized: "nguyenvana",
      fullName: "Existing User A",
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

    expect(result.success).toBe(true);
    expect(result.outcomes[0].status).toBe("LINKED_EXISTING");
    expect(result.outcomes[0].userId).toBe("user-existing-id");

    const saved = mock.store.enrollments.get(result.outcomes[0].enrollmentId!);
    expect(saved.userId).toBe("user-existing-id");
  });

  describe("Route POST /admin/roster/commit", () => {
    let routeHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

    const fakeApp = {
      post: vi.fn((path: string, _options: unknown, handler?: any) => {
        const fn = handler || _options;
        if (path === "/admin/roster/commit") {
          routeHandler = fn;
        }
      }),
    };

    const fakeReply = () => {
      const rep: any = {
        statusCode: 200,
        status: vi.fn().mockImplementation((code) => {
          rep.statusCode = code;
          return rep;
        }),
        send: vi.fn().mockImplementation((data) => data),
      };
      return rep;
    };

    it("enforces authentication and authorization guard on commit endpoint", async () => {
      const mockAuth = {
        authenticate: vi.fn().mockResolvedValue({
          principal: "GUEST",
        }),
      } as unknown as AuthService;

      await registerRosterRoutes(fakeApp as any, mockAuth, service);

      const req = {
        headers: {},
        body: {
          tournamentId: "tour-1",
          rows: [
            {
              unit_code: "KHOA_CNTT",
              student_or_member_id: "001",
              full_name: "A",
              username: "usera",
            },
          ],
        },
      } as FastifyRequest;

      await expect(routeHandler(req, fakeReply())).rejects.toThrowError(
        /Vui lòng đăng nhập bằng tài khoản quản trị/,
      );
    });
  });
});
