import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RetentionEnforcementService } from "../../src/modules/tournament-acknowledgement/retention.service.js";

const url = process.env.OTT_D08_TEST_DATABASE_URL;
const now = new Date("2026-10-23T00:00:00.000Z");
const actor = { userId: "d08b-system", role: "SYSTEM_ADMIN" };
const scope = { tournamentId: "d08b-tournament", contractId: "d08b-contract" };
const tenantId = "d08b-tenant";

describe.skipIf(!url)("D08-B real PostgreSQL retention enforcement", () => {
  let db: PrismaClient;
  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url! });
    await db.user.create({ data: { id: "d08b-user", username: "d08b_user", usernameNormalized: "d08b_user", fullName: "Synthetic", displayName: "Synthetic", passwordHash: "!unclaimed", recoveryCodeHash: "!unclaimed" } });
    await db.unit.create({ data: { id: "d08b-unit", unitCode: "D08B", unitName: "Synthetic", unitType: "CLB", contactName: "Synthetic", contactEmail: "synthetic@example.invalid" } });
    await db.tournamentContract.create({ data: { id: scope.contractId, contractCode: "D08B-CONTRACT", unitId: "d08b-unit", validFrom: new Date("2026-01-01"), validTo: new Date("2027-01-01"), maxTournamentsTotal: 2, maxParticipantsPerTournament: 2, maxParticipantsTotal: 4, allowedModes: [], policyEnvelope: {}, technicalCaps: {} } });
    await db.tournament.create({ data: { id: scope.tournamentId, tournamentCode: "D08B-CUP", contractId: scope.contractId, unitId: "d08b-unit", ownerTaUserId: actor.userId, coreConfig: {}, ruleProfile: {} } });
    await db.tournamentEnrollmentRecord.create({ data: { id: "d08b-enrollment", userId: "d08b-user", tournamentId: scope.tournamentId, contractId: scope.contractId, personKey: "D08B:001", displayName: "Synthetic", unitCode: "D08B" } });
    await db.tournamentConfigVersionRecord.create({ data: { id: "d08b-version", tournamentId: scope.tournamentId, versionNumber: 1, effectiveAt: new Date("2026-10-22"), coreConfigSnapshot: { rulesAckRequired: true, regulationsFull: "Synthetic", rulesQuickSummary: "Synthetic" }, ruleProfileSnapshot: {}, publishedByUserId: actor.userId, changeSummary: "Synthetic" } });
    await db.tournamentRulesAcknowledgement.create({ data: { userId: "d08b-user", contractId: scope.contractId, tournamentId: scope.tournamentId, configVersionId: "d08b-version" } });
    await db.supportRecoveryTicket.create({ data: { id: "d08b-recovery", tenantId, targetUserId: "d08b-user", description: "Synthetic support", idempotencyKey: "d08b-recovery-1", status: "VERIFIED", recoveryTokenHash: "d08b-recovery-hash", recoveryTokenPurpose: "ACCOUNT_RECOVERY_RESET", recoveryTokenIssuedAt: new Date("2026-10-20"), recoveryTokenExpiresAt: new Date("2026-10-22") } });
    await db.tournamentStaffInvitation.create({ data: { id: "d08b-invite", tournamentId: scope.tournamentId, contractId: scope.contractId, recipientUserId: "d08b-user", role: "REFEREE", status: "INVITED", tokenHash: "d08b-invite-hash", idempotencyKey: "d08b-invite-1", inviterUserId: actor.userId, expiresAt: new Date("2026-10-22") } });
    await db.tournamentStaffInvitation.create({ data: { id: "d08b-active-invite", tournamentId: scope.tournamentId, contractId: scope.contractId, recipientUserId: "d08b-user", role: "STAFF", status: "ACTIVE", tokenHash: "d08b-active-hash", idempotencyKey: "d08b-invite-2", inviterUserId: actor.userId, expiresAt: new Date("2026-10-20") } });
    await db.tournamentStaffAssignmentRecord.create({ data: { id: "d08b-active-assignment", tournamentId: scope.tournamentId, userId: "d08b-user", role: "STAFF", status: "ACTIVE", invitationId: "d08b-active-invite" } });
    await db.commandLedgerEntry.create({ data: { id: "d08b-ledger", principalId: actor.userId, targetId: scope.tournamentId, operation: "ROSTER_IMPORT_COMMIT", commandId: "d08b-import-1", outcome: "COMMITTED", stateVersion: 1, sequence: 1, ackPayload: { synthetic: true }, expiresAt: new Date("2026-10-22") } });
    await db.tournamentAuditLogRecord.create({ data: { id: "d08b-existing-audit", actorUserId: actor.userId, actorRole: "SYSTEM_ADMIN", action: "SYNTHETIC_AUDIT", targetType: "TOURNAMENT", targetId: scope.tournamentId, afterSnapshot: { synthetic: true } } });
  });
  afterAll(async () => { await db?.$disconnect(); });

  it("cleans expired secrets and operational records while preserving identities, rights, ACK, and audit", async () => {
    const service = new RetentionEnforcementService(db, { now: () => now });
    const dryRun = await service.preview(actor, scope);
    expect(dryRun.dryRun).toBe(true);
    expect(await db.supportRecoveryTicket.count({ where: { id: "d08b-recovery", recoveryTokenHash: { not: null } } })).toBe(1);
    const result = await service.execute(actor, scope);
    expect(result.changed).toEqual({ expiredRecoverySecrets: 0, expiredStaffInvitations: 1, expiredRosterIdempotency: 1 });
    // Recovery is tenant-scoped, so tournament cleanup never broadens into it.
    expect(await db.supportRecoveryTicket.findUniqueOrThrow({ where: { id: "d08b-recovery" } })).toMatchObject({ recoveryTokenHash: "d08b-recovery-hash" });
    await service.execute(actor, { tenantId });
    expect(await db.supportRecoveryTicket.findUniqueOrThrow({ where: { id: "d08b-recovery" } })).toMatchObject({ recoveryTokenHash: null, status: "VERIFIED" });
    expect(await db.tournamentStaffInvitation.findUniqueOrThrow({ where: { id: "d08b-invite" } })).toMatchObject({ status: "EXPIRED", tokenHash: "d08b-invite-hash" });
    expect(await db.tournamentStaffInvitation.findUniqueOrThrow({ where: { id: "d08b-active-invite" } })).toMatchObject({ status: "ACTIVE" });
    expect(await db.tournamentStaffAssignmentRecord.findUniqueOrThrow({ where: { id: "d08b-active-assignment" } })).toMatchObject({ status: "ACTIVE" });
    expect(await db.tournamentRulesAcknowledgement.count({ where: { tournamentId: scope.tournamentId } })).toBe(1);
    expect(await db.tournamentAuditLogRecord.count()).toBeGreaterThan(1);
    expect(await db.user.findUniqueOrThrow({ where: { id: "d08b-user" } })).toMatchObject({ username: "d08b_user" });
  });

  it("is retry-safe under concurrent cleanup and never deletes a newer record", async () => {
    const service = new RetentionEnforcementService(db, { now: () => now });
    const results = await Promise.all([service.execute(actor, scope), service.execute(actor, scope), service.execute(actor, scope)]);
    expect(results.every((result) => result.changed.expiredStaffInvitations === 0 && result.changed.expiredRosterIdempotency === 0)).toBe(true);
    expect(await db.tournamentStaffInvitation.count({ where: { status: "ACTIVE" } })).toBe(1);
    expect(await db.commandLedgerEntry.count({ where: { targetId: scope.tournamentId, operation: "ROSTER_IMPORT_COMMIT" } })).toBe(0);
  });

  it("rejects contract mismatch before any mutation", async () => {
    const service = new RetentionEnforcementService(db, { now: () => now });
    await expect(service.execute(actor, { tournamentId: scope.tournamentId, contractId: "foreign-contract" })).rejects.toMatchObject({ statusCode: 403 });
  });
});
