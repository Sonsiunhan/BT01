import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { TournamentAcknowledgementService } from "../../src/modules/tournament-acknowledgement/acknowledgement.service.js";
import { registerTournamentAcknowledgementRoutes } from "../../src/modules/tournament-acknowledgement/acknowledgement.route.js";
import { createRetentionPolicies, assessRetention, operationalUsability, canArchiveIdentity } from "../../src/modules/tournament-acknowledgement/retention.policy.js";
import { registerErrorHandler } from "../../src/plugins/error-handler.js";
import type { PrismaClient } from "@prisma/client";
import type { AuthService } from "../../src/modules/auth/auth.service.js";

const instant = new Date("2026-10-23T00:00:00Z");
function fixture() {
  const rows: any[] = [], audits: any[] = [];
  const versions: any[] = [{ id: "v1", tournamentId: "t1", versionNumber: 1, effectiveAt: new Date("2026-10-22"), coreConfigSnapshot: { rulesAckRequired: true, regulationsFull: "Điều lệ đầy đủ", rulesQuickSummary: "Tóm tắt" } }];
  const enrollment = { userId: "u1", tournamentId: "t1", contractId: "c1", eligibilityStatus: "ELIGIBLE" };
  const db: any = {
    tournament: { findFirst: async ({ where }: any) => where.id === "t1" && where.contractId === "c1" ? { id: "t1", contractId: "c1" } : null },
    tournamentEnrollmentRecord: { findFirst: async ({ where }: any) => where.userId === enrollment.userId && where.tournamentId === enrollment.tournamentId && where.contractId === enrollment.contractId ? { id: "e1" } : null },
    tournamentConfigVersionRecord: { findFirst: async ({ where }: any) => versions.filter(v => v.tournamentId === where.tournamentId && v.effectiveAt <= where.effectiveAt.lte).sort((a,b) => b.versionNumber - a.versionNumber)[0] ?? null },
    tournamentRulesAcknowledgement: {
      findUnique: async ({ where }: any) => rows.find(r => Object.entries(where.userId_contractId_tournamentId_configVersionId).every(([k,v]) => r[k] === v)) ?? null,
      create: async ({ data }: any) => { rows.push(data); return data; },
    },
    tournamentAuditLogRecord: { create: async ({ data }: any) => { audits.push(data); return data; } },
    $transaction: async (fn: any) => fn(db),
  };
  const actor = { userId: "u1", principal: "ACCOUNT" as const };
  const scope = { tournamentId: "t1", contractId: "c1" };
  const service = new TournamentAcknowledgementService(db as PrismaClient, { now: () => instant });
  return { db, rows, audits, versions, enrollment, actor, scope, service };
}

describe("D08-A versioned acknowledgement", () => {
  it("queries only the authenticated enrolled actor and returns the exact published regulations", async () => {
    const f = fixture();
    expect(await f.service.status(f.actor, f.scope)).toMatchObject({ required: true, satisfied: false, configVersionId: "v1", regulationsFull: "Điều lệ đầy đủ", evidence: null });
  });
  it("persists exact scope/version/timestamp and returns deterministic retry evidence", async () => {
    const f = fixture();
    const first = await f.service.acknowledge(f.actor, f.scope, { configVersionId: "v1" });
    const second = await new TournamentAcknowledgementService(f.db, { now: () => instant }).acknowledge(f.actor, f.scope, { configVersionId: "v1" });
    expect(first.evidence).toEqual(second.evidence);
    expect(first).toMatchObject({ satisfied: true, evidence: { userId: "u1", acknowledgedAt: instant.toISOString(), configVersionId: "v1", contractId: "c1", tournamentId: "t1" } });
    expect(f.rows).toHaveLength(1); expect(f.audits).toHaveLength(1);
    await expect(f.service.assertAcknowledged(f.actor, f.scope, "v1")).resolves.toBeDefined();
  });
  it("old evidence never satisfies a newly effective version; future versions are excluded", async () => {
    const f = fixture();
    await f.service.acknowledge(f.actor, f.scope, { configVersionId: "v1" });
    f.versions.push({ ...f.versions[0], id: "v2", versionNumber: 2 });
    f.versions.push({ ...f.versions[0], id: "v3", versionNumber: 3, effectiveAt: new Date("2099-01-01") });
    expect(await f.service.status(f.actor, f.scope)).toMatchObject({ configVersionId: "v2", satisfied: false, evidence: null });
    await expect(f.service.acknowledge(f.actor, f.scope, { configVersionId: "v1" })).rejects.toMatchObject({ statusCode: 409 });
    await expect(f.service.assertAcknowledged(f.actor, f.scope, "v2")).rejects.toMatchObject({ statusCode: 409 });
    await expect(f.service.assertAcknowledged(f.actor, f.scope, "v1")).rejects.toMatchObject({ statusCode: 409 });
  });
  it("rejects another user's payload and browser controlled acknowledgement flags", async () => {
    const f = fixture();
    for (const body of [{ configVersionId: "v1", userId: "u2" }, { configVersionId: "v1", acknowledged: true }]) {
      await expect(f.service.acknowledge(f.actor, f.scope, body)).rejects.toMatchObject({ statusCode: 400 });
    }
    await expect(f.service.status({ userId: "u2", principal: "ACCOUNT" }, f.scope)).rejects.toMatchObject({ statusCode: 403 });
    await expect(f.service.status({ userId: "u1", principal: "GUEST" }, f.scope)).rejects.toMatchObject({ statusCode: 401 });
    expect(f.rows).toHaveLength(0);
  });
  it("rejects cross-tournament and cross-contract access without leaking scope", async () => {
    const f = fixture();
    for (const scope of [{ tournamentId: "t2", contractId: "c1" }, { tournamentId: "t1", contractId: "c2" }]) {
      await expect(f.service.status(f.actor, scope)).rejects.toMatchObject({ statusCode: 403 });
      await expect(f.service.acknowledge(f.actor, scope, { configVersionId: "v1" })).rejects.toMatchObject({ statusCode: 403 });
    }
  });
  it("minimizes persisted evidence, audit and DTO to stable IDs and server timestamp", async () => {
    const f = fixture();
    const result = await f.service.acknowledge({ ...f.actor, password: "SECRET", email: "PRIVATE" } as any, f.scope, { configVersionId: "v1" });
    const serialized = JSON.stringify([result, f.rows, f.audits]);
    for (const forbidden of ["SECRET", "PRIVATE", "password", "token", "recovery", "email", "displayName", "personKey"]) expect(serialized).not.toContain(forbidden);
    expect(f.audits[0]).toMatchObject({ actorUserId: "u1", action: "TOURNAMENT_RULES_ACKNOWLEDGED", createdAt: instant });
  });
  it("fails closed on unpublished legacy regulations or no effective version", async () => {
    const f = fixture();
    f.versions[0].coreConfigSnapshot = {};
    await expect(f.service.status(f.actor, f.scope)).rejects.toMatchObject({ statusCode: 409 });
    f.versions.length = 0;
    await expect(f.service.status(f.actor, f.scope)).rejects.toMatchObject({ statusCode: 409 });
  });
  it("respects immutable opt-out, independent of live mutable draft", async () => {
    const f = fixture(); f.versions[0].coreConfigSnapshot.rulesAckRequired = false;
    expect(await f.service.assertAcknowledged(f.actor, f.scope, "v1")).toMatchObject({ required: false, satisfied: true });
  });
  it("retries serialization/unique races and commits a single audit", async () => {
    const f = fixture(); let attempts = 0;
    f.db.$transaction = async (fn: any) => { if (attempts++ === 0) throw { code: "P2034" }; return fn(f.db); };
    await f.service.acknowledge(f.actor, f.scope, { configVersionId: "v1" });
    f.db.$transaction = async (fn: any) => { if (attempts++ === 2) throw { code: "P2002" }; return fn(f.db); };
    await f.service.acknowledge(f.actor, f.scope, { configVersionId: "v1" });
    expect(f.rows).toHaveLength(1); expect(f.audits).toHaveLength(1);
  });
  it("registers authenticated HTTP query/write routes independently of app.ts", async () => {
    const f = fixture(), app = Fastify({ logger: false }); registerErrorHandler(app);
    const auth = { authenticate: async (token?: string) => ({ principal: token === "ok" ? "ACCOUNT" : "GUEST", user: { id: "u1" } }) } as AuthService;
    registerTournamentAcknowledgementRoutes(app, auth, f.service);
    try {
      const url = "/api/contracts/c1/tournaments/t1/rules-ack";
      expect((await app.inject({ method: "GET", url })).statusCode).toBe(401);
      const headers = { cookie: "ottv2_session=ok" };
      expect((await app.inject({ method: "GET", url, headers })).json()).toMatchObject({ required: true, satisfied: false });
      expect((await app.inject({ method: "POST", url, headers, payload: { configVersionId: "v1", userId: "u2" } })).statusCode).toBe(400);
      expect((await app.inject({ method: "POST", url, headers, payload: { configVersionId: "v1" } })).json()).toMatchObject({ satisfied: true });
    } finally { await app.close(); }
  });
});

describe("D08-A retention and expiry foundation (fake time)", () => {
  it("keeps fixed 90 actual days for tournament data and configurable candidate module TTLs", () => {
    const policies = createRetentionPolicies({ STAGING: { retentionMs: 1234 } });
    expect(policies.TOURNAMENT_DATA).toMatchObject({ retentionMs: 90 * 86400000, status: "CANONICAL" });
    expect(policies.STAGING).toMatchObject({ retentionMs: 1234, status: "CANDIDATE_PENDING" });
    expect(policies.RAW_IMPORT).toMatchObject({ retentionMs: 0, anchor: "PARSE_COMPLETED_OR_FAILED", status: "CANONICAL" });
    expect(() => createRetentionPolicies({ TOURNAMENT_DATA: { retentionMs: 1 } })).toThrow();
    expect(() => createRetentionPolicies({ STAGING: { retentionMs: -1 } })).toThrow();
    expect(() => createRetentionPolicies({ STAGING: { status: "CANONICAL" } })).toThrow();
  });
  it("expiry disables unused credentials at the exact deadline but never deletes evidence", () => {
    const artifact = { expiresAt: instant, consumedAt: null, revokedAt: null };
    expect(operationalUsability(artifact, instant)).toBe("EXPIRED");
    expect(operationalUsability({ ...artifact, expiresAt: new Date(NaN) }, instant)).toBe("EXPIRED");
    expect(operationalUsability({ ...artifact, consumedAt: new Date("2026-10-22") }, instant)).toBe("CONSUMED");
    expect(assessRetention(createRetentionPolicies().ACTIVATION, instant, instant)).toBe("PRESERVE");
    expect(assessRetention(createRetentionPolicies().STAGING, instant, instant)).toBe("POLICY_PENDING");
    expect(assessRetention(createRetentionPolicies().AUDIT, instant, new Date("2099-01-01"))).toBe("PRESERVE");
  });
  it("does not revoke established account/staff state and preserves shared identities", () => {
    expect(operationalUsability({ expiresAt: instant, consumedAt: new Date("2026-10-22"), revokedAt: null }, new Date("2099-01-01"))).toBe("CONSUMED");
    expect(canArchiveIdentity([{ retentionElapsed: true, needsIdentity: false }, { retentionElapsed: false, needsIdentity: true }])).toBe(false);
    expect(canArchiveIdentity([{ retentionElapsed: true, needsIdentity: false }])).toBe(true);
  });
  it("treats retention as a non-destructive assessment, preserves missing anchors/references", () => {
    const policy = createRetentionPolicies().TOURNAMENT_DATA;
    expect(assessRetention(policy, instant, new Date(instant.getTime() + 90 * 86400000 - 1))).toBe("RETAIN");
    expect(assessRetention(policy, instant, new Date(instant.getTime() + 90 * 86400000))).toBe("ELIGIBLE_FOR_REVIEW");
    expect(assessRetention(policy, null, new Date("2099-01-01"))).toBe("PRESERVE");
  });
});
