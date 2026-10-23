import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RosterService } from "../../src/modules/roster/roster.service.js";

const url = process.env.OTT_D09_TEST_DATABASE_URL;
const actor = { userId: "d09-owner", role: "TOURNAMENT_ADMIN" };
const scope = { tournamentId: "d09-tournament-a", contractId: "d09-contract-a" };
const rows = [{ unit_code: "D09", student_or_member_id: "001", full_name: "Synthetic A", username: "d09_a", email: "a@example.invalid" }];
const firstRow = rows[0]!;

describe.skipIf(!url)("D09-A real PostgreSQL import/security boundaries", () => {
  let db: PrismaClient;

  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url! });
    await db.user.create({ data: { id: actor.userId, username: "d09_owner", usernameNormalized: "d09_owner", fullName: "Synthetic owner", displayName: "Synthetic owner", passwordHash: "!unclaimed", recoveryCodeHash: "!unclaimed" } });
    await db.unit.create({ data: { id: "d09-unit-a", unitCode: "D09", unitName: "Synthetic D09", unitType: "CLB", contactName: "Synthetic", contactEmail: "synthetic@example.invalid" } });
    await db.unit.create({ data: { id: "d09-unit-b", unitCode: "D09B", unitName: "Synthetic D09B", unitType: "CLB", contactName: "Synthetic", contactEmail: "synthetic@example.invalid" } });
    for (const [id, code, unitId, unitCode] of [["d09-contract-a", "D09-A", "d09-unit-a", "D09"], ["d09-contract-b", "D09-B", "d09-unit-b", "D09B"]] as const) {
      await db.tournamentContract.create({ data: { id, contractCode: code, unitId, validFrom: new Date("2026-01-01"), validTo: new Date("2027-01-01"), maxTournamentsTotal: 4, maxParticipantsPerTournament: 20, maxParticipantsTotal: 40, allowedModes: [], policyEnvelope: { allowedUnits: [unitCode] }, technicalCaps: {} } });
    }
    await db.tournament.create({ data: { id: scope.tournamentId, tournamentCode: "D09-A-CUP", contractId: scope.contractId, unitId: "d09-unit-a", ownerTaUserId: actor.userId, coreConfig: {}, ruleProfile: {} } });
    await db.tournament.create({ data: { id: "d09-tournament-b", tournamentCode: "D09-B-CUP", contractId: "d09-contract-b", unitId: "d09-unit-b", ownerTaUserId: "d09-other-owner", coreConfig: {}, ruleProfile: {} } });
  });

  afterAll(async () => { await db?.$disconnect(); });

  it("persists one import, replays identical retries, and conflicts on changed payload", async () => {
    const service = new RosterService(db);
    const request = { tournamentId: scope.tournamentId, rows, idempotencyKey: "d09-real-retry" } as const;
    const first = await service.commitRosterImport(request, actor);
    const replay = await service.commitRosterImport(request, actor);
    expect(replay).toEqual(first);
    await expect(service.commitRosterImport({ ...request, rows: [{ ...firstRow, full_name: "Changed" }] }, actor)).rejects.toMatchObject({ statusCode: 409 });
    expect(await db.tournamentEnrollmentRecord.count({ where: { tournamentId: scope.tournamentId } })).toBe(1);
    expect(await db.commandLedgerEntry.count({ where: { targetId: scope.tournamentId, operation: "ROSTER_IMPORT_COMMIT" } })).toBe(1);
    const ledger = await db.commandLedgerEntry.findFirst({ where: { targetId: scope.tournamentId, operation: "ROSTER_IMPORT_COMMIT" } });
    expect(ledger?.payloadDigest).toBeTruthy();
    expect(JSON.stringify(ledger)).not.toContain("a@example.invalid");
  });

  it("rejects a foreign tournament before creating an enrollment", async () => {
    const service = new RosterService(db);
    await expect(service.commitRosterImport({ tournamentId: "d09-tournament-b", rows: [{ ...firstRow, unit_code: "D09B" }] }, actor)).rejects.toMatchObject({ statusCode: 403 });
    expect(await db.tournamentEnrollmentRecord.count({ where: { tournamentId: "d09-tournament-b" } })).toBe(0);
  });

});
