import { describe, expect, it } from "vitest";
import {
  ContractPolicyEnvelopeSchema,
  type CreateTournamentContractInput,
} from "@ottv2/contracts";
import {
  TournamentStateStore,
} from "../../apps/server/src/modules/tournament-foundation/tournament-store.js";
import { SanitizingAuditService } from "../../apps/server/src/modules/tournament-foundation/audit.port.js";
import { UnitContractService } from "../../apps/server/src/modules/tournament-foundation/unit-contract.service.js";

const policyEnvelope = ContractPolicyEnvelopeSchema.parse({
  allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
  turnSecondsMin: 10,
  turnSecondsMax: 60,
  totalMatchSecondsMin: 120,
  totalMatchSecondsMax: 1800,
  turnLimitMin: 40,
  turnLimitMax: 240,
  allowedNoProgressPlies: [40, 60],
  allowedRepetitionThresholds: [3, 4],
  allowedTieBreakPolicies: ["RANDOM_SEEDED", "MANUAL_REFEREE"],
});

function createContractInput(unitId: string): CreateTournamentContractInput {
  return {
    contractCode: "HD_L02_01",
    unitId,
    validFrom: "2026-10-01T00:00:00.000Z",
    validTo: "2026-11-15T23:59:59.000Z",
    maxTournamentsTotal: 2,
    maxParticipantsPerTournament: 8,
    maxParticipantsTotal: 16,
    allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
    policyEnvelope,
    technicalCaps: {
      botSourceMaxBytes: 65536,
      botRuntimeTimeoutMs: 1000,
      botMemoryLimitMb: 64,
      maxConcurrentMatchesPerTournament: 8,
      rosterImportMaxRows: 2000,
    },
    status: "ACTIVE",
    initialTaUserIds: ["ta-1"],
  };
}

describe("L02 foundation services", () => {
  it("enforces admin authority, unit reference protection, and TA binding scope", async () => {
    const store = new TournamentStateStore({
      clockFn: () => new Date("2026-10-21T08:00:00.000Z"),
    });
    const service = new UnitContractService(store);
    store.grantSystemRole("admin-1", "ADMIN");
    const admin = store.resolveAuthoritativeActor({ userId: "admin-1" });
    const outsider = store.resolveAuthoritativeActor({ userId: "user-1" });

    await expect(
      service.createUnit(outsider, {
        unitCode: "UNIT_A",
        unitName: "Đơn vị A",
        unitType: "KHOA",
        contactName: "Người phụ trách",
        contactEmail: "unit-a@example.edu.vn",
        status: "ACTIVE",
      })
    ).rejects.toMatchObject({ statusCode: 403 });

    const unit = await service.createUnit(admin, {
      unitCode: "UNIT_A",
      unitName: "Đơn vị A",
      unitType: "KHOA",
      contactName: "Người phụ trách",
      contactEmail: "unit-a@example.edu.vn",
      status: "ACTIVE",
    });
    const contract = await service.createContract(admin, createContractInput(unit.id));

    const ta = store.resolveAuthoritativeActor({ userId: "ta-1" });
    expect(ta.roles).toContain("TOURNAMENT_ADMIN");
    expect(service.listContracts({ taUserId: "ta-1" })).toHaveLength(1);

    await expect(service.deleteUnit(admin, unit.id)).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: "UNIT_REFERENCED_CANNOT_DELETE" },
    });
    expect(service.getContract(contract.id).quotaRemainingCount).toBe(2);
  });

  it("expires contracts against server time and keeps audit snapshots append-only and redacted", async () => {
    let now = "2026-10-21T08:00:00.000Z";
    const store = new TournamentStateStore({ clockFn: () => new Date(now) });
    const service = new UnitContractService(store);
    store.grantSystemRole("admin-1", "ADMIN");
    const admin = store.resolveAuthoritativeActor({ userId: "admin-1" });
    const unit = await service.createUnit(admin, {
      unitCode: "UNIT_B",
      unitName: "Đơn vị B",
      unitType: "VIEN",
      contactName: "Người phụ trách",
      contactEmail: "unit-b@example.edu.vn",
      status: "ACTIVE",
    });
    const contract = await service.createContract(admin, createContractInput(unit.id));

    now = "2026-11-16T00:00:00.000Z";
    expect(await service.expireContractsIfNeeded()).toBe(1);
    expect(service.getContract(contract.id).status).toBe("EXPIRED");

    const audit = new SanitizingAuditService();
    const record = audit.append({
      actorUserId: "admin-1",
      actorRole: "ADMIN",
      action: "L02_TEST",
      targetType: "CONTRACT",
      targetId: contract.id,
      beforeSnapshot: {
        passwordHash: "argon2id$secret",
        nested: {
          sourceText: "def choose_move(state): return 'A1-A2'",
          safeField: "kept",
        },
      },
      reason: "Rejection due to Bearer D11_UNSAFE_TOKEN_SENTINEL",
      nowIso: now,
    });

    expect(record.beforeSnapshot).toEqual({
      passwordHash: "[REDACTED]",
      nested: { sourceText: "[REDACTED]", safeField: "kept" },
    });
    expect(record.reason).toBe("[REDACTED]");
    expect(Object.isFrozen(record)).toBe(true);
    expect(audit.list({ targetId: contract.id })).toHaveLength(1);
  });
});