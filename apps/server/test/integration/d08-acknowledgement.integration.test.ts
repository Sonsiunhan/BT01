import { PrismaClient } from "@prisma/client";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { TournamentAcknowledgementService } from "../../src/modules/tournament-acknowledgement/acknowledgement.service.js";
import { createRetentionPolicies, readRetentionPolicies } from "../../src/modules/tournament-acknowledgement/retention.policy.js";

// Dedicated runner provisions a fresh localhost-only cluster. Never loads .env.
const url = process.env.OTT_D08_TEST_DATABASE_URL;
const parsed = url ? new URL(url) : null;
if (parsed && (parsed.hostname !== "127.0.0.1" || !/^\/ottv2_d08_test_\d+$/.test(parsed.pathname) || url === process.env.DATABASE_URL)) {
  throw new Error("D08 requires a distinct, explicitly identified disposable database");
}
const now = new Date("2026-10-23T00:00:00Z");
const actor = { userId: "d08-u1", principal: "ACCOUNT" as const };
const scope = { contractId: "d08-c1", tournamentId: "d08-t1" };
const regulations = { rulesAckRequired: true, regulationsFull: "Điều lệ phiên bản một", rulesQuickSummary: "Tóm tắt" };

describe.skipIf(!url)("D08-A real PostgreSQL durability and transaction boundaries", () => {
  let db: PrismaClient;
  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url! });
    await db.user.create({ data: { id: actor.userId, username: "d08_synthetic", usernameNormalized: "d08_synthetic", fullName: "Synthetic", displayName: "Synthetic", passwordHash: "!unclaimed", recoveryCodeHash: "!unclaimed" } });
    await db.unit.create({ data: { id: "d08-unit", unitCode: "D08", unitName: "Synthetic", unitType: "CLB", contactName: "Synthetic", contactEmail: "synthetic@example.invalid" } });
    await db.tournamentContract.create({ data: { id: scope.contractId, contractCode: "D08-CONTRACT", unitId: "d08-unit", validFrom: new Date("2026-01-01"), validTo: new Date("2027-01-01"), maxTournamentsTotal: 2, maxParticipantsPerTournament: 2, maxParticipantsTotal: 4, allowedModes: [], policyEnvelope: {}, technicalCaps: {} } });
    await db.tournament.create({ data: { id: scope.tournamentId, tournamentCode: "D08-CUP", contractId: scope.contractId, unitId: "d08-unit", ownerTaUserId: "synthetic-owner", coreConfig: {}, ruleProfile: {} } });
    await db.tournamentConfigVersionRecord.create({ data: { id: "d08-v1", tournamentId: scope.tournamentId, versionNumber: 1, effectiveAt: new Date("2026-10-22"), coreConfigSnapshot: regulations, ruleProfileSnapshot: {}, publishedByUserId: "synthetic-owner", changeSummary: "Synthetic version" } });
    await db.tournamentEnrollmentRecord.create({ data: { id: "d08-e1", userId: actor.userId, tournamentId: scope.tournamentId, contractId: scope.contractId, personKey: "D08:001", displayName: "Synthetic", unitCode: "D08" } });
  });
  afterAll(async () => { await db?.$disconnect(); });

  it("writes durable evidence once under concurrent retries and survives client restart", async () => {
    const service = new TournamentAcknowledgementService(db, { now: () => now });
    const attempts = await Promise.allSettled(Array.from({ length: 6 }, () => service.acknowledge(actor, scope, { configVersionId: "d08-v1" })));
    expect(attempts.filter(r => r.status === "fulfilled").length).toBeGreaterThan(0);
    for (const attempt of attempts) if (attempt.status === "rejected") expect(attempt.reason).toMatchObject({ statusCode: 409, retryable: true });
    const replay = await service.acknowledge(actor, scope, { configVersionId: "d08-v1" });
    expect(await db.tournamentRulesAcknowledgement.count()).toBe(1);
    expect(await db.tournamentAuditLogRecord.count({ where: { action: "TOURNAMENT_RULES_ACKNOWLEDGED" } })).toBe(1);
    const restarted = new PrismaClient({ datasourceUrl: url! });
    try {
      expect(await new TournamentAcknowledgementService(restarted, { now: () => now }).status(actor, scope)).toEqual(replay);
    } finally { await restarted.$disconnect(); }
    const evidence = await db.tournamentRulesAcknowledgement.findMany();
    expect(Object.keys(evidence[0]!).sort()).toEqual(["id", "userId", "contractId", "tournamentId", "configVersionId", "acknowledgedAt", "evidenceKind"].sort());
  });
  it("does not roll old evidence forward and rejects stale or foreign scopes", async () => {
    const service = new TournamentAcknowledgementService(db, { now: () => now });
    await db.tournamentConfigVersionRecord.create({ data: { id: "d08-v2", tournamentId: scope.tournamentId, versionNumber: 2, effectiveAt: now, coreConfigSnapshot: { ...regulations, regulationsFull: "Điều lệ phiên bản hai" }, ruleProfileSnapshot: {}, publishedByUserId: "synthetic-owner", changeSummary: "Synthetic new version" } });
    expect(await service.status(actor, scope)).toMatchObject({ configVersionId: "d08-v2", satisfied: false, evidence: null });
    await expect(service.acknowledge(actor, scope, { configVersionId: "d08-v1" })).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.status(actor, { ...scope, contractId: "foreign" })).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.status({ userId: "foreign", principal: "ACCOUNT" }, scope)).rejects.toMatchObject({ statusCode: 403 });
  });
  it("rolls back evidence if audit fails, with no partial acknowledgement", async () => {
    const broken = db.$extends({ query: { tournamentAuditLogRecord: { async create() { throw new Error("synthetic audit failure"); } } } });
    await expect(new TournamentAcknowledgementService(broken as unknown as PrismaClient, { now: () => now }).acknowledge(actor, scope, { configVersionId: "d08-v2" })).rejects.toThrow("synthetic audit failure");
    expect(await db.tournamentRulesAcknowledgement.count({ where: { configVersionId: "d08-v2" } })).toBe(0);
    expect(await db.tournamentAuditLogRecord.count()).toBe(1);
  });
  it("lets admission check share the consumer transaction and rolls its work back on failure", async () => {
    const service = new TournamentAcknowledgementService(db, { now: () => now });
    await expect(db.$transaction(async tx => {
      await tx.tournament.update({ where: { id: scope.tournamentId }, data: { revision: { increment: 1 } } });
      await service.assertAcknowledged(actor, scope, "d08-v2", tx);
    }, { isolationLevel: "Serializable" })).rejects.toMatchObject({ statusCode: 409 });
    expect((await db.tournament.findUniqueOrThrow({ where: { id: scope.tournamentId } })).revision).toBe(1);
    await service.acknowledge(actor, scope, { configVersionId: "d08-v2" });
  });
  it("loads configurable durable metadata, preserving candidate and separate audit policy", async () => {
    const policy = { ...createRetentionPolicies().STAGING, revision: 2, retentionMs: 1234 };
    await db.artifactRetentionPolicyRecord.create({ data: { artifact: "STAGING", policy } });
    expect((await readRetentionPolicies(db)).STAGING).toEqual(policy);
    expect((await readRetentionPolicies(db)).AUDIT).toMatchObject({ appendOnly: true, retentionMs: null });
  });
});
