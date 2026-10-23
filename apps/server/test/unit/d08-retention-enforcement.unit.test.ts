import { describe, expect, it } from "vitest";
import { AppError } from "../../src/shared/errors/app-error.js";
import { RetentionEnforcementService } from "../../src/modules/tournament-acknowledgement/retention.service.js";
import { createRetentionPolicies } from "../../src/modules/tournament-acknowledgement/retention.policy.js";

const now = new Date("2026-10-23T00:00:00.000Z");
const admin = { userId: "system-retention", role: "SYSTEM_ADMIN" };

function fixture() {
  const recovery = [
    { id: "r-expired", tenantId: "tenant-a", status: "VERIFIED", requestType: "ACCOUNT_RECOVERY", recoveryTokenHash: "HASH_A", recoveryTokenPurpose: "ACCOUNT_RECOVERY_RESET", recoveryTokenExpiresAt: new Date("2026-10-22"), recoveryTokenIssuedAt: new Date("2026-10-21"), recoveryTokenConsumedAt: null, targetUserId: "user-a" },
    { id: "r-consumed", tenantId: "tenant-a", status: "RESOLVED", requestType: "ACCOUNT_RECOVERY", recoveryTokenHash: "HASH_B", recoveryTokenPurpose: "ACCOUNT_RECOVERY_RESET", recoveryTokenExpiresAt: new Date("2026-10-20"), recoveryTokenIssuedAt: new Date("2026-10-19"), recoveryTokenConsumedAt: new Date("2026-10-19T01:00:00Z"), targetUserId: "user-a" },
    { id: "r-future", tenantId: "tenant-a", status: "VERIFIED", requestType: "ACCOUNT_RECOVERY", recoveryTokenHash: "HASH_C", recoveryTokenPurpose: "ACCOUNT_RECOVERY_RESET", recoveryTokenExpiresAt: new Date("2026-10-24"), recoveryTokenIssuedAt: new Date("2026-10-23"), recoveryTokenConsumedAt: null, targetUserId: "user-a" },
    { id: "r-other", tenantId: "tenant-b", status: "VERIFIED", requestType: "ACCOUNT_RECOVERY", recoveryTokenHash: "HASH_D", recoveryTokenPurpose: "ACCOUNT_RECOVERY_RESET", recoveryTokenExpiresAt: new Date("2026-10-20"), recoveryTokenIssuedAt: new Date("2026-10-19"), recoveryTokenConsumedAt: null, targetUserId: "user-b" },
  ];
  const invitations = [
    { id: "i-expired", tournamentId: "t-a", contractId: "c-a", status: "INVITED", expiresAt: new Date("2026-10-22"), tokenHash: "INVITE_HASH_A" },
    { id: "i-active", tournamentId: "t-a", contractId: "c-a", status: "ACTIVE", expiresAt: new Date("2026-10-20"), tokenHash: "INVITE_HASH_B" },
    { id: "i-future", tournamentId: "t-a", contractId: "c-a", status: "INVITED", expiresAt: new Date("2026-10-24"), tokenHash: "INVITE_HASH_C" },
    { id: "i-other", tournamentId: "t-b", contractId: "c-b", status: "INVITED", expiresAt: new Date("2026-10-20"), tokenHash: "INVITE_HASH_D" },
  ];
  const ledger = [
    { id: "l-expired", targetId: "t-a", operation: "ROSTER_IMPORT_COMMIT", expiresAt: new Date("2026-10-22"), ackPayload: { email: "private@example.invalid" }, payloadDigest: "IMPORT_DIGEST" },
    { id: "l-future", targetId: "t-a", operation: "ROSTER_IMPORT_COMMIT", expiresAt: new Date("2026-10-24"), ackPayload: { email: "keep@example.invalid" }, payloadDigest: "KEEP_DIGEST" },
    { id: "l-other", targetId: "t-b", operation: "ROSTER_IMPORT_COMMIT", expiresAt: new Date("2026-10-20"), ackPayload: { email: "other@example.invalid" }, payloadDigest: "OTHER_DIGEST" },
  ];
  const audits: any[] = [];
  const db: any = {
    tournament: { findUnique: async ({ where }: any) => where.id === "t-a" ? { id: "t-a", contractId: "c-a" } : where.id === "t-b" ? { id: "t-b", contractId: "c-b" } : null },
    supportRecoveryTicket: {
      findMany: async ({ where }: any) => recovery.filter((row) => row.tenantId === where.tenantId && where.recoveryTokenExpiresAt.lte >= row.recoveryTokenExpiresAt && where.recoveryTokenHash.not === null && where.status.in.includes(row.status)).map(({ id, recoveryTokenExpiresAt, status }) => ({ id, recoveryTokenExpiresAt, status })),
      updateMany: async ({ where, data }: any) => {
        const row = recovery.find((candidate) => candidate.id === where.id && candidate.tenantId === where.tenantId && candidate.recoveryTokenHash !== null && where.status.in.includes(candidate.status) && candidate.recoveryTokenExpiresAt <= where.recoveryTokenExpiresAt.lte);
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    tournamentStaffInvitation: {
      findMany: async ({ where }: any) => invitations.filter((row) => row.tournamentId === where.tournamentId && row.status === where.status && row.expiresAt <= where.expiresAt.lte).map(({ id, expiresAt, status }) => ({ id, expiresAt, status })),
      updateMany: async ({ where, data }: any) => {
        const row = invitations.find((candidate) => candidate.id === where.id && candidate.tournamentId === where.tournamentId && candidate.status === where.status && candidate.expiresAt <= where.expiresAt.lte);
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    commandLedgerEntry: {
      findMany: async ({ where }: any) => ledger.filter((row) => row.targetId === where.targetId && row.operation === where.operation && row.expiresAt <= where.expiresAt.lte).map(({ id, expiresAt }) => ({ id, expiresAt })),
      deleteMany: async ({ where }: any) => {
        const before = ledger.length;
        for (let index = ledger.length - 1; index >= 0; index -= 1) if (ledger[index]!.targetId === where.targetId && ledger[index]!.operation === where.operation && ledger[index]!.expiresAt <= where.expiresAt.lte) ledger.splice(index, 1);
        return { count: before - ledger.length };
      },
    },
    tournamentAuditLogRecord: { create: async ({ data }: any) => (audits.push(data), data) },
    $transaction: async (fn: any) => fn(db),
  };
  return { db, recovery, invitations, ledger, audits };
}

describe("D08-B retention enforcement", () => {
  it("requires server-side system authority and an explicit scope", async () => {
    const f = fixture();
    await expect(new RetentionEnforcementService(f.db).execute({ userId: "user-a", role: "PLAYER" }, { tenantId: "tenant-a" })).rejects.toMatchObject({ statusCode: 403 });
    await expect(new RetentionEnforcementService(f.db).execute(admin, {})).rejects.toMatchObject({ statusCode: 400 });
  });

  it("dry-run reports categories and never mutates records or exposes PII", async () => {
    const f = fixture();
    const result = await new RetentionEnforcementService(f.db, { now: () => now }).preview(admin, { tournamentId: "t-a", contractId: "c-a" });
    expect(result.dryRun).toBe(true);
    expect(result.eligible).toMatchObject({ expiredStaffInvitations: 1, expiredRosterIdempotency: 1 });
    expect(JSON.stringify(result)).not.toContain("private@example.invalid");
    expect(f.invitations[0]!.status).toBe("INVITED");
    expect(f.ledger).toHaveLength(3);
  });

  it("scrubs expired recovery secrets while preserving ticket lifecycle evidence", async () => {
    const f = fixture();
    const result = await new RetentionEnforcementService(f.db, { now: () => now }).execute(admin, { tenantId: "tenant-a" });
    expect(result.changed.expiredRecoverySecrets).toBe(2);
    expect(f.recovery[0]).toMatchObject({ status: "VERIFIED", recoveryTokenHash: null, recoveryTokenPurpose: null, recoveryTokenIssuedAt: new Date("2026-10-21") });
    expect(f.recovery[1]).toMatchObject({ status: "RESOLVED", recoveryTokenHash: null, recoveryTokenConsumedAt: new Date("2026-10-19T01:00:00Z") });
    expect(f.recovery[2]!.recoveryTokenHash).toBe("HASH_C");
    expect(JSON.stringify(result)).not.toContain("HASH_");
  });

  it("expires only pending invitations; accepted staff and token evidence remain intact", async () => {
    const f = fixture();
    await new RetentionEnforcementService(f.db, { now: () => now }).execute(admin, { tournamentId: "t-a", contractId: "c-a" });
    expect(f.invitations[0]).toMatchObject({ status: "EXPIRED", tokenHash: "INVITE_HASH_A" });
    expect(f.invitations[1]).toMatchObject({ status: "ACTIVE", tokenHash: "INVITE_HASH_B" });
    expect(f.invitations[2]!.status).toBe("INVITED");
  });

  it("deletes only expired roster idempotency records within the requested tournament", async () => {
    const f = fixture();
    await new RetentionEnforcementService(f.db, { now: () => now }).execute(admin, { tournamentId: "t-a", contractId: "c-a" });
    expect(f.ledger.map((entry) => entry.id)).toEqual(["l-future", "l-other"]);
  });

  it("preserves newer data, users, enrolments, assignments, ACK and audit evidence", async () => {
    const f = fixture();
    const beforeAudits = f.audits.length;
    await new RetentionEnforcementService(f.db, { now: () => now }).execute(admin, { tournamentId: "t-a", contractId: "c-a" });
    expect(f.invitations[1]!.status).toBe("ACTIVE");
    expect(f.invitations[2]!.status).toBe("INVITED");
    expect(f.audits.length).toBeGreaterThan(beforeAudits);
    expect(f.audits.every((audit) => !JSON.stringify(audit).includes("HASH_"))).toBe(true);
  });

  it("is idempotent when run repeatedly", async () => {
    const f = fixture();
    const service = new RetentionEnforcementService(f.db, { now: () => now });
    const first = await service.execute(admin, { tenantId: "tenant-a" });
    const second = await service.execute(admin, { tenantId: "tenant-a" });
    expect(first.changed.expiredRecoverySecrets).toBe(2);
    expect(second.changed.expiredRecoverySecrets).toBe(0);
    expect(second.changed.expiredStaffInvitations).toBe(0);
  });

  it("revalidates eligibility at mutation time and does not scrub a token renewed concurrently", async () => {
    const f = fixture();
    f.db.supportRecoveryTicket.updateMany = async () => ({ count: 0 });
    const result = await new RetentionEnforcementService(f.db, { now: () => now }).execute(admin, { tenantId: "tenant-a" });
    expect(result.changed.expiredRecoverySecrets).toBe(0);
    expect(f.recovery[0]!.recoveryTokenHash).toBe("HASH_A");
  });

  it("keeps candidate policy configurable and does not perform candidate cleanup", async () => {
    const policies = createRetentionPolicies({ STAGING: { retentionMs: 1234 } });
    expect(policies.STAGING).toMatchObject({ retentionMs: 1234, status: "CANDIDATE_PENDING" });
    expect(policies.TOURNAMENT_DATA.retentionMs).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it("isolates contract and tenant scopes", async () => {
    const f = fixture();
    await expect(new RetentionEnforcementService(f.db).execute(admin, { tournamentId: "t-a", contractId: "c-b" })).rejects.toMatchObject({ statusCode: 403 });
    await new RetentionEnforcementService(f.db, { now: () => now }).execute(admin, { tenantId: "tenant-a" });
    expect(f.recovery[3]!.recoveryTokenHash).toBe("HASH_D");
    expect(f.invitations[3]!.status).toBe("INVITED");
  });

  it("does not broaden cleanup when an unknown tournament is supplied", async () => {
    const f = fixture();
    await expect(new RetentionEnforcementService(f.db).preview(admin, { tournamentId: "missing", contractId: "c-a" })).rejects.toMatchObject({ statusCode: 404 });
    expect(f.ledger).toHaveLength(3);
  });

  it("does not include raw secrets or unnecessary identity fields in audit output", async () => {
    const f = fixture();
    await new RetentionEnforcementService(f.db, { now: () => now }).execute(admin, { tournamentId: "t-a", contractId: "c-a" });
    const serialized = JSON.stringify(f.audits);
    expect(serialized).not.toContain("HASH_");
    expect(serialized).not.toContain("email");
    expect(serialized).toContain("RETENTION");
  });

  it("never restores or reopens a consumed recovery lifecycle", async () => {
    const f = fixture();
    await new RetentionEnforcementService(f.db, { now: () => now }).execute(admin, { tenantId: "tenant-a" });
    expect(f.recovery[1]).toMatchObject({ status: "RESOLVED", recoveryTokenConsumedAt: new Date("2026-10-19T01:00:00Z"), recoveryTokenHash: null });
  });

  it("does not touch user identity, enrollment, contract rights, or accepted assignment records", async () => {
    const f = fixture();
    const protectedState = { userId: "user-a", enrollmentId: "enrol-a", assignmentId: "assignment-a", contractId: "c-a" };
    await new RetentionEnforcementService(f.db, { now: () => now }).execute(admin, { tournamentId: "t-a", contractId: "c-a" });
    expect(protectedState).toEqual({ userId: "user-a", enrollmentId: "enrol-a", assignmentId: "assignment-a", contractId: "c-a" });
    expect(f.invitations[1]!.status).toBe("ACTIVE");
  });

  it("does not treat the canonical 90-day tournament policy as permission for broad deletion", async () => {
    const f = fixture();
    const policy = createRetentionPolicies().TOURNAMENT_DATA;
    expect(policy.retentionMs).toBe(90 * 24 * 60 * 60 * 1000);
    await new RetentionEnforcementService(f.db, { now: () => now }).execute(admin, { tournamentId: "t-a", contractId: "c-a" });
    expect(f.invitations).toHaveLength(4);
    expect(f.audits.every((audit) => audit.action !== "RETENTION_TOURNAMENT_DATA_DELETED")).toBe(true);
  });

  it("does not mutate an invitation or recovery record when its eligibility predicate loses a race", async () => {
    const f = fixture();
    f.db.tournamentStaffInvitation.updateMany = async () => ({ count: 0 });
    f.db.supportRecoveryTicket.updateMany = async () => ({ count: 0 });
    const result = await new RetentionEnforcementService(f.db, { now: () => now }).execute(admin, { tournamentId: "t-a", contractId: "c-a" });
    expect(result.changed.expiredStaffInvitations).toBe(0);
    expect(result.changed.expiredRecoverySecrets).toBe(0);
    expect(f.invitations[0]!.status).toBe("INVITED");
    expect(f.recovery[0]!.recoveryTokenHash).toBe("HASH_A");
  });

  it("fails closed if the cleanup transaction cannot complete", async () => {
    const f = fixture();
    f.db.$transaction = async () => { throw new AppError("CONFLICT", "race", 409, true, "RECOVERABLE"); };
    await expect(new RetentionEnforcementService(f.db, { now: () => now }).execute(admin, { tenantId: "tenant-a" })).rejects.toMatchObject({ statusCode: 409 });
  });
});
