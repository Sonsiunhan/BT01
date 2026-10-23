import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RosterService } from "../../src/modules/roster/roster.service.js";

const url = process.env.OTT_D09_TEST_DATABASE_URL;
const actor = { userId: "d09b-owner", role: "TOURNAMENT_ADMIN" };
const scope = { contractId: "d09b-contract-a" };
const rows = [{ unit_code: "D09B", student_or_member_id: "001", full_name: "Synthetic D09-B", username: "d09b_a", email: "a@example.invalid" }];
const firstRow = rows[0]!;

describe.skipIf(!url)("D09-B real PostgreSQL concurrency and crash recovery", () => {
  let db: PrismaClient;

  async function createTournament(id: string, code: string) {
    await db.tournament.create({
      data: { id, tournamentCode: code, contractId: scope.contractId, unitId: "d09b-unit-a", ownerTaUserId: actor.userId, coreConfig: {}, ruleProfile: {} },
    });
  }

  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url! });
    await db.user.create({ data: { id: actor.userId, username: "d09b_owner", usernameNormalized: "d09b_owner", fullName: "Synthetic owner", displayName: "Synthetic owner", passwordHash: "!unclaimed", recoveryCodeHash: "!unclaimed" } });
    await db.unit.create({ data: { id: "d09b-unit-a", unitCode: "D09B", unitName: "Synthetic D09B", unitType: "CLB", contactName: "Synthetic", contactEmail: "synthetic@example.invalid" } });
    await db.tournamentContract.create({ data: { id: scope.contractId, contractCode: "D09B-A", unitId: "d09b-unit-a", validFrom: new Date("2026-01-01"), validTo: new Date("2027-01-01"), maxTournamentsTotal: 10, maxParticipantsPerTournament: 20, maxParticipantsTotal: 100, allowedModes: [], policyEnvelope: { allowedUnits: ["D09B"] }, technicalCaps: {} } });
  });

  afterAll(async () => { await db?.$disconnect(); });

  it("serializes concurrent same-key same-payload commits into one durable result", async () => {
    const tournamentId = "d09b-concurrent-same-key";
    await createTournament(tournamentId, "D09B-CONCURRENT-SAME");
    const request = { tournamentId, rows, idempotencyKey: "d09b-concurrent-same" } as const;
    const results = await Promise.allSettled([
      new RosterService(db).commitRosterImport(request, actor),
      new RosterService(db).commitRosterImport(request, actor),
      new RosterService(db).commitRosterImport(request, actor),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    expect(fulfilled).toHaveLength(3);
    expect((fulfilled[0] as PromiseFulfilledResult<unknown>).value).toEqual((fulfilled[1] as PromiseFulfilledResult<unknown>).value);
    expect((fulfilled[1] as PromiseFulfilledResult<unknown>).value).toEqual((fulfilled[2] as PromiseFulfilledResult<unknown>).value);
    expect(await db.tournamentEnrollmentRecord.count({ where: { tournamentId } })).toBe(1);
    expect(await db.commandLedgerEntry.count({ where: { targetId: tournamentId, operation: "ROSTER_IMPORT_COMMIT" } })).toBe(1);
    expect(await db.tournamentAuditLogRecord.count({ where: { targetId: tournamentId, action: "ROSTER_IMPORT_COMMIT" } })).toBe(1);
  });

  it("allows one concurrent payload to establish the key and rejects the incompatible payload", async () => {
    const tournamentId = "d09b-concurrent-different-payload";
    await createTournament(tournamentId, "D09B-CONCURRENT-DIFFERENT");
    const first = { tournamentId, rows, idempotencyKey: "d09b-concurrent-different" } as const;
    const changed = { ...first, rows: [{ ...firstRow, full_name: "Synthetic Changed" }] };
    const results = await Promise.allSettled([
      new RosterService(db).commitRosterImport(first, actor),
      new RosterService(db).commitRosterImport(changed, actor),
    ]);
    const successes = results.filter((result) => result.status === "fulfilled");
    const failures = results.filter((result) => result.status === "rejected");
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect((failures[0] as PromiseRejectedResult).reason).toMatchObject({ statusCode: 409, details: { reason: "IDEMPOTENCY_KEY_REUSED" } });
    expect(await db.tournamentEnrollmentRecord.count({ where: { tournamentId } })).toBe(1);
    expect(await db.commandLedgerEntry.count({ where: { targetId: tournamentId, operation: "ROSTER_IMPORT_COMMIT" } })).toBe(1);
    const ledger = await db.commandLedgerEntry.findFirst({ where: { targetId: tournamentId, operation: "ROSTER_IMPORT_COMMIT" } });
    expect(ledger?.payloadDigest).toBeTruthy();
  });

  it("uses database person_key uniqueness when different keys race for one logical identity", async () => {
    const tournamentId = "d09b-concurrent-duplicate-person";
    await createTournament(tournamentId, "D09B-CONCURRENT-DUPLICATE");
    const requestA = { tournamentId, rows, idempotencyKey: "d09b-duplicate-a" } as const;
    const requestB = { tournamentId, rows, idempotencyKey: "d09b-duplicate-b" } as const;
    const results = await Promise.allSettled([
      new RosterService(db).commitRosterImport(requestA, actor),
      new RosterService(db).commitRosterImport(requestB, actor),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const failures = results.filter((result) => result.status === "rejected");
    expect(failures).toHaveLength(1);
    expect((failures[0] as PromiseRejectedResult).reason).toMatchObject({ statusCode: 409, details: { reason: "DUPLICATE_PERSON_KEY" } });
    expect(await db.tournamentEnrollmentRecord.count({ where: { tournamentId } })).toBe(1);
    expect(await db.commandLedgerEntry.count({ where: { targetId: tournamentId, operation: "ROSTER_IMPORT_COMMIT" } })).toBe(1);
  });

  it("replays a committed result after the client loses the response", async () => {
    const tournamentId = "d09b-ambiguous-response";
    await createTournament(tournamentId, "D09B-AMBIGUOUS");
    const originalTransaction = db.$transaction.bind(db);
    let throwAfterCommit = true;
    (db as any).$transaction = async (callback: any, options?: any) => {
      const result = await originalTransaction(callback, options);
      if (throwAfterCommit) {
        throwAfterCommit = false;
        throw new Error("CLIENT_RESPONSE_LOST_AFTER_COMMIT");
      }
      return result;
    };
    try {
      const request = { tournamentId, rows, idempotencyKey: "d09b-ambiguous" } as const;
      const first = await new RosterService(db).commitRosterImport(request, actor);
      const replay = await new RosterService(db).commitRosterImport(request, actor);
      expect(replay).toEqual(first);
      expect(await db.tournamentEnrollmentRecord.count({ where: { tournamentId } })).toBe(1);
      expect(await db.commandLedgerEntry.count({ where: { targetId: tournamentId, operation: "ROSTER_IMPORT_COMMIT" } })).toBe(1);
      expect(await db.tournamentAuditLogRecord.count({ where: { targetId: tournamentId, action: "ROSTER_IMPORT_COMMIT" } })).toBe(1);
    } finally {
      (db as any).$transaction = originalTransaction;
    }
  });

  it("rolls back all import rows and audit when the worker fails before commit", async () => {
    const tournamentId = "d09b-worker-rollback";
    await createTournament(tournamentId, "D09B-ROLLBACK");
    const originalTransaction = db.$transaction.bind(db);
    (db as any).$transaction = async (callback: any, options?: any) => originalTransaction(async (tx: any) => {
      await callback(tx);
      throw new Error("WORKER_CRASH_BEFORE_COMMIT");
    }, options);
    try {
      await expect(new RosterService(db).commitRosterImport({ tournamentId, rows, idempotencyKey: "d09b-rollback" }, actor)).rejects.toThrow("WORKER_CRASH_BEFORE_COMMIT");
      expect(await db.tournamentEnrollmentRecord.count({ where: { tournamentId } })).toBe(0);
      expect(await db.commandLedgerEntry.count({ where: { targetId: tournamentId, operation: "ROSTER_IMPORT_COMMIT" } })).toBe(0);
      expect(await db.tournamentAuditLogRecord.count({ where: { targetId: tournamentId, action: "ROSTER_IMPORT_COMMIT" } })).toBe(0);
    } finally {
      (db as any).$transaction = originalTransaction;
    }
  });
});
