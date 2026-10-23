import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ActivationService } from "../../src/modules/roster/activation.service.js";
import { RosterService } from "../../src/modules/roster/roster.service.js";

const url = process.env.OTT_D13A_TEST_DATABASE_URL;

describe.skipIf(!url)("D13-A real PostgreSQL roster authorization and activation TTL", () => {
  let db: PrismaClient;

  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url! });

    await db.user.createMany({
      data: [
        {
          id: "d13a-ta-a",
          username: "d13a_ta_a",
          usernameNormalized: "d13a_ta_a",
          fullName: "D13A Tournament Admin",
          displayName: "D13A Tournament Admin",
          passwordHash: "!unclaimed",
          recoveryCodeHash: "!unclaimed",
          role: "TOURNAMENT_ADMIN",
        },
        {
          id: "d13a-system",
          username: "d13a_system",
          usernameNormalized: "d13a_system",
          fullName: "D13A System Admin",
          displayName: "D13A System Admin",
          passwordHash: "!unclaimed",
          recoveryCodeHash: "!unclaimed",
          role: "SYSTEM_ADMIN",
        },
      ],
    });

    await db.unit.createMany({
      data: [
        { id: "d13a-unit-a", unitCode: "D13A", unitName: "D13A Unit", unitType: "CLB", contactName: "D13A", contactEmail: "d13a-a@example.invalid" },
        { id: "d13a-unit-b", unitCode: "D13B", unitName: "D13B Unit", unitType: "CLB", contactName: "D13A", contactEmail: "d13a-b@example.invalid" },
        { id: "d13a-unit-c", unitCode: "D13C", unitName: "D13C Unit", unitType: "CLB", contactName: "D13A", contactEmail: "d13a-c@example.invalid" },
      ],
    });

    for (const [id, code, unitId] of [
      ["d13a-contract-a", "D13A-CONTRACT-A", "d13a-unit-a"],
      ["d13a-contract-b", "D13A-CONTRACT-B", "d13a-unit-b"],
      ["d13a-contract-c", "D13A-CONTRACT-C", "d13a-unit-c"],
    ] as const) {
      await db.tournamentContract.create({
        data: {
          id,
          contractCode: code,
          unitId,
          validFrom: new Date("2026-01-01T00:00:00Z"),
          validTo: new Date("2027-01-01T00:00:00Z"),
          maxTournamentsTotal: 10,
          maxParticipantsPerTournament: 20,
          maxParticipantsTotal: 60,
          allowedModes: [],
          policyEnvelope: {},
          technicalCaps: {},
        },
      });
    }

    await db.tournamentContractTaBinding.create({
      data: {
        id: "d13a-binding-a",
        contractId: "d13a-contract-a",
        userId: "d13a-ta-a",
        username: "d13a_ta_a",
        displayName: "D13A Tournament Admin",
        status: "ACTIVE",
        grantedByUserId: "d13a-system",
      },
    });

    await db.tournament.createMany({
      data: [
        { id: "d13a-tournament-a", tournamentCode: "D13A-TOURNAMENT-A", contractId: "d13a-contract-a", unitId: "d13a-unit-a", ownerTaUserId: "d13a-ta-a", coreConfig: {}, ruleProfile: {} },
        { id: "d13a-tournament-b", tournamentCode: "D13A-TOURNAMENT-B", contractId: "d13a-contract-b", unitId: "d13a-unit-b", ownerTaUserId: "d13a-ta-a", coreConfig: {}, ruleProfile: {} },
        { id: "d13a-tournament-c", tournamentCode: "D13A-TOURNAMENT-C", contractId: "d13a-contract-c", unitId: "d13a-unit-c", ownerTaUserId: "d13a-ta-a", coreConfig: {}, ruleProfile: {} },
      ],
    });

    await db.tournamentEnrollmentRecord.createMany({
      data: [
        { id: "d13a-enrollment-a", tournamentId: "d13a-tournament-a", contractId: "d13a-contract-a", personKey: "D13A:001", displayName: "D13A A", unitCode: "D13A" },
        { id: "d13a-enrollment-b", tournamentId: "d13a-tournament-b", contractId: "d13a-contract-b", personKey: "D13B:001", displayName: "D13A B", unitCode: "D13B" },
        { id: "d13a-enrollment-c", tournamentId: "d13a-tournament-c", contractId: "d13a-contract-c", personKey: "D13C:001", displayName: "D13A C", unitCode: "D13C" },
        { id: "d13a-activation-before", tournamentId: "d13a-tournament-a", contractId: "d13a-contract-a", personKey: "D13A:002", displayName: "Before expiry", unitCode: "D13A" },
        { id: "d13a-activation-exact", tournamentId: "d13a-tournament-a", contractId: "d13a-contract-a", personKey: "D13A:003", displayName: "Exact expiry", unitCode: "D13A" },
        { id: "d13a-activation-after", tournamentId: "d13a-tournament-a", contractId: "d13a-contract-a", personKey: "D13A:004", displayName: "After expiry", unitCode: "D13A" },
      ],
    });
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("enforces Tournament Admin contract scope for roster reads without mutation", async () => {
    const roster = new RosterService(db);
    const actor = { userId: "d13a-ta-a", role: "TOURNAMENT_ADMIN" };
    const before = {
      enrollments: await db.tournamentEnrollmentRecord.count(),
      commands: await db.commandLedgerEntry.count(),
      audits: await db.tournamentAuditLogRecord.count(),
    };

    await expect(roster.listEnrollments("d13a-tournament-a", actor)).resolves.toHaveLength(4);
    await expect(roster.listEnrollments("d13a-tournament-b", actor)).rejects.toMatchObject({ statusCode: 403 });
    await expect(roster.listEnrollments("d13a-tournament-c", actor)).rejects.toMatchObject({ statusCode: 403 });
    await expect(roster.listEnrollments("d13a-tournament-a", { userId: "d13a-player", role: "USER" }))
      .rejects.toMatchObject({ statusCode: 403 });
    await expect(roster.listEnrollments("d13a-tournament-a", { userId: "d13a-system", role: "SYSTEM_ADMIN" }))
      .resolves.toHaveLength(4);
    await expect(roster.listEnrollments("d13a-missing", { userId: "d13a-system", role: "SYSTEM_ADMIN" }))
      .rejects.toMatchObject({ statusCode: 404 });
    await expect(roster.listEnrollments("%%%", { userId: "d13a-system", role: "SYSTEM_ADMIN" }))
      .rejects.toMatchObject({ statusCode: 404 });

    expect(await db.tournamentEnrollmentRecord.count()).toBe(before.enrollments);
    expect(await db.commandLedgerEntry.count()).toBe(before.commands);
    expect(await db.tournamentAuditLogRecord.count()).toBe(before.audits);
  });

  it("issues 24-hour activation tokens, honors expiry boundaries, and preserves replay/privacy", async () => {
    const activation = new ActivationService(db);
    const actor = { userId: "d13a-ta-a", role: "TOURNAMENT_ADMIN" };
    const issued = await activation.issueActivationToken(
      { enrollmentId: "d13a-activation-before", idempotencyKey: "d13a-before" },
      actor,
    );
    const issuedAt = Date.now();
    const expiresAt = new Date(issued.expiresAt).getTime();
    expect(expiresAt - issuedAt).toBeGreaterThan(24 * 60 * 60 * 1000 - 5_000);
    expect(expiresAt - issuedAt).toBeLessThan(24 * 60 * 60 * 1000 + 5_000);

    const ledger = await db.commandLedgerEntry.findFirst({ where: { targetId: "d13a-activation-before", operation: "ROSTER_ACTIVATION_ISSUE" } });
    const audits = await db.tournamentAuditLogRecord.findMany({ where: { targetId: "d13a-activation-before" } });
    expect(ledger?.payloadDigest).toBeTruthy();
    expect(JSON.stringify({ ledger, audits })).not.toContain(issued.claimToken);

    const claimed = await activation.claimActivation({
      claimToken: issued.claimToken,
      username: "d13a_before",
      displayName: "D13A Before",
    });
    expect(claimed.outcome).toBe("NEWLY_ACTIVATED");
    await expect(activation.claimActivation({
      claimToken: issued.claimToken,
      username: "d13a_before",
      displayName: "D13A Before",
    })).resolves.toMatchObject({ userId: claimed.userId, outcome: "LINKED_TO_EXISTING" });

    const exact = await activation.issueActivationToken(
      { enrollmentId: "d13a-activation-exact", idempotencyKey: "d13a-exact" },
      actor,
    );
    await db.commandLedgerEntry.updateMany({
      where: { targetId: "d13a-activation-exact", operation: "ROSTER_ACTIVATION_ISSUE" },
      data: { expiresAt: new Date() },
    });
    await expect(activation.claimActivation({
      claimToken: exact.claimToken,
      username: "d13a_exact",
      displayName: "D13A Exact",
    })).rejects.toMatchObject({ statusCode: 401, details: { reason: "TOKEN_EXPIRED" } });

    const after = await activation.issueActivationToken(
      { enrollmentId: "d13a-activation-after", idempotencyKey: "d13a-after" },
      actor,
    );
    await db.commandLedgerEntry.updateMany({
      where: { targetId: "d13a-activation-after", operation: "ROSTER_ACTIVATION_ISSUE" },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    await expect(activation.claimActivation({
      claimToken: after.claimToken,
      username: "d13a_after",
      displayName: "D13A After",
    })).rejects.toMatchObject({ statusCode: 401, details: { reason: "TOKEN_EXPIRED" } });

    expect(JSON.stringify(await db.commandLedgerEntry.findMany({ where: { operation: "ROSTER_ACTIVATION_ISSUE" } })))
      .not.toContain(exact.claimToken);
    expect(JSON.stringify(await db.tournamentAuditLogRecord.findMany({ where: { targetType: "ENROLLMENT" } })))
      .not.toContain(after.claimToken);
  });
});
