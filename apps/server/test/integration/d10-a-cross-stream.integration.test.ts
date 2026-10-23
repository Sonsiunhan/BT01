import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RosterService } from "../../src/modules/roster/roster.service.js";
import { ActivationService } from "../../src/modules/roster/activation.service.js";
import { TournamentStaffService } from "../../src/modules/tournament-staff/staff.service.js";
import { TournamentAcknowledgementService } from "../../src/modules/tournament-acknowledgement/acknowledgement.service.js";
import { PrismaTournamentAcknowledgementGuard } from "../../src/modules/tournament-core/acknowledgement-guard.js";

const url = process.env.OTT_D10A_TEST_DATABASE_URL;

describe.skipIf(!url)("D10-A real PostgreSQL cross-stream account flow", () => {
  let db: PrismaClient;
  let enrollmentId: string;
  let claimToken: string;

  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url! });
    await db.user.createMany({ data: [
      { id: "d10a-owner", username: "d10a_owner", usernameNormalized: "d10a_owner", fullName: "D10A owner", displayName: "D10A owner", passwordHash: "!unclaimed", recoveryCodeHash: "!unclaimed" },
      { id: "d10a-referee", username: "d10a_referee", usernameNormalized: "d10a_referee", fullName: "D10A referee", displayName: "D10A referee", passwordHash: "!unclaimed", recoveryCodeHash: "!unclaimed" },
    ] });
    await db.unit.create({ data: { id: "d10a-unit", unitCode: "D10A", unitName: "D10A unit", unitType: "CLB", contactName: "D10A", contactEmail: "d10a@example.invalid" } });
    await db.tournamentContract.create({
      data: {
        id: "d10a-contract", contractCode: "D10A-CONTRACT", unitId: "d10a-unit", validFrom: new Date("2026-01-01"), validTo: new Date("2027-01-01"),
        maxTournamentsTotal: 4, maxParticipantsPerTournament: 8, maxParticipantsTotal: 16,
        allowedModes: ["HUMAN_ONLINE"], policyEnvelope: { allowedUnits: ["D10A"] }, technicalCaps: {},
        taBindings: { create: { id: "d10a-binding", userId: "d10a-owner", username: "d10a_owner", displayName: "D10A owner", grantedByUserId: "d10a-owner", status: "ACTIVE" } },
      },
    });
    await db.tournament.create({ data: {
      id: "d10a-tournament", tournamentCode: "D10A-TOURNAMENT", contractId: "d10a-contract", unitId: "d10a-unit", ownerTaUserId: "d10a-owner", status: "APPROVED",
      coreConfig: { rulesAckRequired: true, regulationsFull: "Điều lệ D10-A", rulesQuickSummary: "D10-A" }, ruleProfile: {}, activeConfigVersionId: "d10a-version-1", activeConfigVersionNumber: 1,
    } });
    await db.tournamentConfigVersionRecord.create({ data: {
      id: "d10a-version-1", tournamentId: "d10a-tournament", versionNumber: 1,
      coreConfigSnapshot: { rulesAckRequired: true, regulationsFull: "Điều lệ D10-A", rulesQuickSummary: "D10-A" }, ruleProfileSnapshot: {},
      effectiveAt: new Date("2026-01-01"), publishedByUserId: "d10a-owner", changeSummary: "D10-A fixture",
    } });
  });

  afterAll(async () => { await db?.$disconnect(); });

  it("keeps import, claim, staff acceptance, current ACK and audit in their authoritative scopes", async () => {
    const roster = await new RosterService(db).commitRosterImport({
      tournamentId: "d10a-tournament",
      idempotencyKey: "d10a-import-1",
      rows: [{ unit_code: "D10A", student_or_member_id: "001", full_name: "Synthetic D10A", username: "d10a_player", email: "player@example.invalid" }],
    }, { userId: "d10a-owner", role: "TOURNAMENT_ADMIN" });
    enrollmentId = roster.outcomes[0]!.enrollmentId;
    expect(await db.tournamentEnrollmentRecord.count({ where: { tournamentId: "d10a-tournament" } })).toBe(1);

    const issued = await new ActivationService(db).issueActivationToken({ enrollmentId, idempotencyKey: "d10a-activation-1" }, { userId: "d10a-owner", role: "TOURNAMENT_ADMIN" });
    claimToken = issued.claimToken;
    const claimed = await new ActivationService(db).claimActivation({ claimToken, username: "d10a_player", displayName: "Synthetic D10A" });
    expect(claimed.outcome).toBe("NEWLY_ACTIVATED");

    const staff = new TournamentStaffService(db);
    const invitation = await staff.createInvitation({ userId: "d10a-owner" }, "d10a-tournament", { recipientUserId: "d10a-referee", role: "REFEREE", idempotencyKey: "d10a-ref-1" });
    expect(invitation.rawToken).toBeTruthy();
    await staff.acceptInvitation({ userId: "d10a-referee" }, { tournamentId: "d10a-tournament", token: invitation.rawToken! });
    await expect(staff.getRefereeReadiness("d10a-tournament", "d10a-contract")).resolves.toMatchObject({ activeRefereeCount: 1, hasAcceptedReferee: true });
    await staff.revokeAssignment({ userId: "d10a-owner" }, "d10a-tournament", invitation.invitation.assignmentId!);
    await expect(staff.getRefereeReadiness("d10a-tournament", "d10a-contract")).resolves.toMatchObject({ activeRefereeCount: 0, hasAcceptedReferee: false });

    const ack = new TournamentAcknowledgementService(db);
    const guard = new PrismaTournamentAcknowledgementGuard(db, ack);
    await expect(guard.assertReadyForStart("d10a-tournament", "d10a-version-1")).rejects.toMatchObject({ details: { reason: "RULES_ACK_REQUIRED" } });
    await ack.acknowledge({ userId: claimed.userId, principal: "ACCOUNT" }, { tournamentId: "d10a-tournament", contractId: "d10a-contract" }, { configVersionId: "d10a-version-1" });
    await expect(guard.assertReadyForStart("d10a-tournament", "d10a-version-1")).resolves.toBeUndefined();

    const audit = await db.tournamentAuditLogRecord.findMany({ where: { targetId: { in: [enrollmentId, "d10a-tournament"] } }, select: { afterSnapshot: true, reason: true } });
    const auditText = JSON.stringify(audit);
    expect(auditText).not.toContain(claimToken);
    expect(auditText).not.toContain("password");
    expect(await db.tournamentRulesAcknowledgement.count({ where: { tournamentId: "d10a-tournament", configVersionId: "d10a-version-1" } })).toBe(1);
  });
});
