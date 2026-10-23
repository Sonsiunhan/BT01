import { beforeEach, describe, expect, it } from "vitest";
import Fastify from "fastify";
import { CANDIDATE_POLICY_DEFAULTS_V1 } from "@ottv2/contracts";
import { RosterService } from "../../src/modules/roster/roster.service.js";
import { registerRosterRoutes } from "../../src/modules/roster/roster.route.js";

type Fixture = ReturnType<typeof createFixture>;

function createFixture() {
  const store = {
    tournaments: new Map<string, any>(),
    contracts: new Map<string, any>(),
    units: new Map<string, any>(),
    enrollments: new Map<string, any>(),
    ledger: new Map<string, any>(),
    audits: new Map<string, any>(),
  };
  const keyFor = (principalId: string, targetId: string, operation: string, commandId: string) => `${principalId}:${targetId}:${operation}:${commandId}`;
  const tx = () => ({
    tournamentEnrollmentRecord: {
      findMany: async ({ where }: any) => [...store.enrollments.values()].filter((row) => row.tournamentId === where.tournamentId && where.personKey.in.includes(row.personKey)),
      findFirst: async ({ where }: any) => [...store.enrollments.values()].find((row) => row.personKey === where.personKey && row.userId != null && row.contractId === where.contractId) ?? null,
      create: async ({ data }: any) => { const row = { ...data, createdAt: new Date(), updatedAt: new Date() }; store.enrollments.set(data.id, row); return row; },
    },
    user: { findUnique: async () => null },
    commandLedgerEntry: {
      create: async ({ data }: any) => { store.ledger.set(keyFor(data.principalId, data.targetId, data.operation, data.commandId), data); return data; },
    },
    tournamentAuditLogRecord: {
      create: async ({ data }: any) => { store.audits.set(data.id, data); return data; },
    },
  });
  const db = {
    unit: { findMany: async () => [...store.units.values()] },
    tournament: {
      findUnique: async ({ where }: any) => {
        const tournament = store.tournaments.get(where.id);
        if (!tournament) return null;
        const contract = store.contracts.get(tournament.contractId);
        return { ...tournament, unit: store.units.get(tournament.unitId), contract: contract ? { ...contract, taBindings: contract.taBindings ?? [] } : null };
      },
    },
    tournamentEnrollmentRecord: {
      count: async ({ where }: any) => [...store.enrollments.values()].filter((row) => where.tournamentId ? row.tournamentId === where.tournamentId : row.contractId === where.contractId).length,
    },
    commandLedgerEntry: {
      findUnique: async ({ where }: any) => {
        const p = where.principalId_targetId_operation_commandId;
        return store.ledger.get(keyFor(p.principalId, p.targetId, p.operation, p.commandId)) ?? null;
      },
    },
    $transaction: async (callback: (client: any) => Promise<unknown>) => callback(tx()),
  };
  return { db, store };
}

function seed(fixture: Fixture) {
  fixture.store.units.set("unit-a", { id: "unit-a", unitCode: "UNIT_A", status: "ACTIVE" });
  fixture.store.units.set("unit-b", { id: "unit-b", unitCode: "UNIT_B", status: "ACTIVE" });
  for (const [id, unitId, allowed] of [["contract-a", "unit-a", "UNIT_A"], ["contract-b", "unit-b", "UNIT_B"]] as const) {
    fixture.store.contracts.set(id, {
      id, unitId, status: "ACTIVE", validFrom: new Date("2026-01-01"), validTo: new Date("2026-12-31"),
      maxParticipantsPerTournament: 100, maxParticipantsTotal: 200, policyEnvelope: { allowedUnits: [allowed] },
      taBindings: [{ userId: `${id}-owner`, status: "ACTIVE" }],
    });
  }
  fixture.store.tournaments.set("tournament-a", { id: "tournament-a", contractId: "contract-a", unitId: "unit-a", ownerTaUserId: "contract-a-owner", status: "DRAFT", revision: 1 });
  fixture.store.tournaments.set("tournament-b", { id: "tournament-b", contractId: "contract-b", unitId: "unit-b", ownerTaUserId: "contract-b-owner", status: "DRAFT", revision: 1 });
}

const rows = [{ unit_code: "UNIT_A", student_or_member_id: "001", full_name: "Nguyen A", username: "user_a", email: "a@example.com" }];
const firstRow = rows[0]!;

describe("D09-A — import/security/privacy integration boundaries", () => {
  let fixture: Fixture;
  let service: RosterService;

  beforeEach(() => {
    fixture = createFixture();
    seed(fixture);
    service = new RosterService(fixture.db as any);
  });

  it("commits an authorized scoped import and records only safe audit evidence", async () => {
    const result = await service.commitRosterImport({ tournamentId: "tournament-a", rows, idempotencyKey: "d09-key-1" }, { userId: "contract-a-owner", role: "TOURNAMENT_ADMIN" });
    expect(result.success).toBe(true);
    expect(fixture.store.enrollments.size).toBe(1);
    const audit = [...fixture.store.audits.values()][0];
    expect(audit).toMatchObject({ actorUserId: "contract-a-owner", targetId: "tournament-a", action: "ROSTER_IMPORT_COMMIT" });
    expect(JSON.stringify(audit)).not.toMatch(/password|token|source|secret|email/i);
  });

  it("rejects an unauthorised actor before writing", async () => {
    await expect(service.commitRosterImport({ tournamentId: "tournament-a", rows }, { userId: "other-user", role: "TOURNAMENT_ADMIN" })).rejects.toMatchObject({ statusCode: 403 });
    expect(fixture.store.enrollments.size).toBe(0);
  });

  it("rejects an unauthenticated commit request at the route boundary", async () => {
    const app = Fastify();
    const auth = { authenticate: async () => ({ principal: "GUEST", user: { id: "guest", role: "USER" } }) } as any;
    await registerRosterRoutes(app, auth, new RosterService());
    try {
      const response = await app.inject({ method: "POST", url: "/admin/roster/commit", payload: { tournamentId: "tournament-a", rows } });
      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("rejects cross-tournament/contract access even when the payload names a foreign unit", async () => {
    await expect(service.commitRosterImport({ tournamentId: "tournament-b", rows: [{ ...firstRow, unit_code: "UNIT_B", userId: "contract-a-owner" } as any] }, { userId: "contract-a-owner", role: "TOURNAMENT_ADMIN" })).rejects.toMatchObject({ statusCode: 403 });
    expect(fixture.store.enrollments.size).toBe(0);
  });

  it("does not trust a payload userId to choose the actor identity", async () => {
    const result = await service.commitRosterImport({ tournamentId: "tournament-a", rows: [{ ...firstRow, userId: "victim-user" } as any] }, { userId: "contract-a-owner", role: "TOURNAMENT_ADMIN" });
    expect(result.outcomes[0]?.userId).toBeUndefined();
    expect([...fixture.store.audits.values()][0]?.actorUserId).toBe("contract-a-owner");
  });

  it("rejects duplicate person keys in one request", async () => {
    await expect(service.commitRosterImport({ tournamentId: "tournament-a", rows: [firstRow, { ...firstRow, username: "user_b" }] }, { userId: "contract-a-owner", role: "TOURNAMENT_ADMIN" })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects synthetic large input at the upload byte boundary", async () => {
    const oversized = Buffer.alloc(CANDIDATE_POLICY_DEFAULTS_V1.rosterImportMaxBytes + 1, 65);
    await expect(service.previewRoster(oversized, "large.csv")).rejects.toMatchObject({ statusCode: 413 });
  });

  it("rejects legacy password columns without echoing the secret", async () => {
    const secret = "D09-PRIVATE-PASSWORD";
    try {
      await service.previewRoster(Buffer.from(`unit_code,student_or_member_id,full_name,username,password\nUNIT_A,001,Nguyen A,user_a,${secret}`), "legacy.csv");
      throw new Error("expected validation failure");
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
      expect(JSON.stringify(error)).not.toContain(secret);
    }
  });

  it("replays an identical retry once and does not create a second enrollment", async () => {
    const request = { tournamentId: "tournament-a", rows, idempotencyKey: "d09-retry-1" } as const;
    const first = await service.commitRosterImport(request, { userId: "contract-a-owner", role: "TOURNAMENT_ADMIN" });
    const second = await service.commitRosterImport(request, { userId: "contract-a-owner", role: "TOURNAMENT_ADMIN" });
    expect(second).toEqual(first);
    expect(fixture.store.enrollments.size).toBe(1);
  });

  it("rejects a changed payload that reuses an idempotency key", async () => {
    await service.commitRosterImport({ tournamentId: "tournament-a", rows, idempotencyKey: "d09-retry-conflict" }, { userId: "contract-a-owner", role: "TOURNAMENT_ADMIN" });
    await expect(service.commitRosterImport({ tournamentId: "tournament-a", rows: [{ ...firstRow, full_name: "Changed Name" }], idempotencyKey: "d09-retry-conflict" }, { userId: "contract-a-owner", role: "TOURNAMENT_ADMIN" })).rejects.toMatchObject({ statusCode: 409 });
    expect(fixture.store.enrollments.size).toBe(1);
  });

  it("does not expose source, token, password or private email in the response", async () => {
    const result = await service.commitRosterImport({ tournamentId: "tournament-a", rows: [{ ...firstRow, email: "private@example.com", source: "private source", token: "raw-token" } as any] }, { userId: "contract-a-owner", role: "TOURNAMENT_ADMIN" });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("private source");
    expect(serialized).not.toContain("raw-token");
    expect(serialized).not.toContain("private@example.com");
  });
});
