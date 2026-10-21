import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AllowedModeSchema,
  AccountOnboardingDTOSchema,
  ApprovalDecisionInputSchema,
  CANDIDATE_POLICY_DEFAULTS_V1,
  ContractPolicyEnvelopeSchema,
  CreateTournamentContractInputSchema,
  CreateUnitInputSchema,
  DEFAULT_TOURNAMENT_RULE_PROFILE,
  evaluateRuleProfileEnvelope,
  normalizeTournamentCoreConfig,
  RosterImportRowDTOSchema,
  StaffInvitationDTOSchema,
  SupportRequestDTOSchema,
  TournamentCoreConfigSchema,
  TournamentRuleProfileSchema,
  validateTournamentCoreConfigSemantics,
} from "@ottv2/contracts";
// @ts-expect-error -- mjs script helper imported for contract safety verification
import { runGuardSelfCheck, validateDisposableDbUrl } from "../../scripts/network/disposable-db.mjs";

const sampleEnvelope = ContractPolicyEnvelopeSchema.parse({
  allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
  turnSecondsMin: 10,
  turnSecondsMax: 60,
  totalMatchSecondsMin: 120,
  totalMatchSecondsMax: 1800,
  turnLimitMin: 40,
  turnLimitMax: 200,
  allowedNoProgressPlies: [40, 60, 80],
  allowedRepetitionThresholds: [3, 4],
  allowedTieBreakPolicies: ["RANDOM_SEEDED", "MANUAL_REFEREE"],
});

describe("L01 — Tournament Initialization Shared Contracts & Expand-Only Migration", () => {
  it("accepts only human versus human or bot versus bot tournament modes", () => {
    expect(AllowedModeSchema.safeParse("HUMAN_ONLINE").success).toBe(true);
    expect(AllowedModeSchema.safeParse("BOT_VS_BOT").success).toBe(true);
    expect(AllowedModeSchema.safeParse("HYBRID").success).toBe(false);
  });
  it("validates P06 Unit creation inputs and rejects lowercase/invalid unitCode", () => {
    const valid = CreateUnitInputSchema.safeParse({
      unitCode: "KHOA_CNTT_01",
      unitName: "Khoa Công nghệ Thông tin",
      unitType: "KHOA",
      contactName: "Nguyễn Văn A",
      contactEmail: "cntt@example.edu.vn",
    });
    expect(valid.success).toBe(true);

    const invalid = CreateUnitInputSchema.safeParse({
      unitCode: "khoa cntt",
      unitName: "A",
      unitType: "KHOA",
      contactName: "B",
      contactEmail: "bad-email",
    });
    expect(invalid.success).toBe(false);
  });

  it("validates P07 TournamentContract inputs including validFrom < validTo and participant ceilings", () => {
    const valid = CreateTournamentContractInputSchema.safeParse({
      contractCode: "HD_CNTT_2026",
      unitId: "unit-1",
      validFrom: "2026-10-01T00:00:00.000Z",
      validTo: "2026-12-31T23:59:59.000Z",
      maxTournamentsTotal: 3,
      maxParticipantsPerTournament: 128,
      maxParticipantsTotal: 300,
      allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
      policyEnvelope: sampleEnvelope,
    });
    expect(valid.success).toBe(true);

    const invalidDates = CreateTournamentContractInputSchema.safeParse({
      contractCode: "HD_CNTT_2026",
      unitId: "unit-1",
      validFrom: "2026-12-31T23:59:59.000Z",
      validTo: "2026-10-01T00:00:00.000Z",
      maxTournamentsTotal: 3,
      maxParticipantsPerTournament: 500,
      maxParticipantsTotal: 300,
      allowedModes: ["HUMAN_ONLINE"],
      policyEnvelope: sampleEnvelope,
    });
    expect(invalidDates.success).toBe(false);
  });

  it("T071: normalizes conditional fields in TournamentCoreConfig when parent toggles change", () => {
    const raw = TournamentCoreConfigSchema.parse({
      tournamentCode: "OTT_FALL_2026",
      tournamentName: "Giải Mùa Thu 2026",
      shortDescription: "Giải đấu cấp Khoa",
      organizersText: "CLB AI & Khoa CNTT",
      competitionMode: "HUMAN_ONLINE",
      audienceScope: "PUBLIC_REGISTERED",
      allowedUnitCodes: ["KHOA_CNTT_01", "CLB_AI"],
      registrationIntakeMode: "IMPORT_ONLY",
      maxParticipants: 64,
      minParticipantsToStart: 8,
      checkinRequired: false,
      checkinOpenAt: "2026-11-01T07:00:00.000Z",
      checkinCloseAt: "2026-11-01T07:45:00.000Z",
      scheduledStartAt: "2026-11-01T08:00:00.000Z",
      scheduledEndAt: "2026-11-01T12:00:00.000Z",
      botDeadlineAt: "2026-11-01T06:00:00.000Z",
    });

    const normalized = normalizeTournamentCoreConfig(raw);
    expect(normalized.allowedUnitCodes).toEqual([]);
    expect(normalized.checkinOpenAt).toBeNull();
    expect(normalized.checkinCloseAt).toBeNull();
    expect(normalized.botDeadlineAt).toBeNull();

    const semanticIssues = validateTournamentCoreConfigSemantics(normalized, {
      requireFutureStartAt: true,
      serverNowIso: "2026-10-21T00:00:00.000Z",
    });
    expect(semanticIssues).toHaveLength(0);
  });

  it("T017 & T061: evaluates RuleProfile strictly against ContractPolicyEnvelope", () => {
    const within = evaluateRuleProfileEnvelope(DEFAULT_TOURNAMENT_RULE_PROFILE, sampleEnvelope);
    expect(within.withinEnvelope).toBe(true);
    expect(within.violations).toHaveLength(0);

    const outOfEnvelope = TournamentRuleProfileSchema.parse({
      ...DEFAULT_TOURNAMENT_RULE_PROFILE,
      turnSeconds: 90,
      noProgressPlies: 100,
      tieBreakPolicy: "BLUE_ADVANTAGE",
    });
    const check = evaluateRuleProfileEnvelope(outOfEnvelope, sampleEnvelope);
    expect(check.withinEnvelope).toBe(false);
    expect(check.violations.map((v) => v.field)).toEqual([
      "turnSeconds",
      "noProgressPlies",
      "tieBreakPolicy",
    ]);
  });

  it("T022: requires mandatory note when Admin rejects or requests changes", () => {
    expect(
      ApprovalDecisionInputSchema.safeParse({
        decision: "APPROVE",
        expectedRevision: 1,
      }).success
    ).toBe(true);

    expect(
      ApprovalDecisionInputSchema.safeParse({
        decision: "REJECT",
        expectedRevision: 1,
      }).success
    ).toBe(false);

    expect(
      ApprovalDecisionInputSchema.safeParse({
        decision: "REQUEST_CHANGES",
        expectedRevision: 1,
        note: "Vui lòng cập nhật lại lịch thi đấu.",
      }).success
    ).toBe(true);
  });

  it("exposes candidate policy defaults tagged with G0_PENDING_CONFIRMATION and D00 DTO schemas", () => {
    expect(CANDIDATE_POLICY_DEFAULTS_V1.g0ApprovalStatus).toBe("G0_PENDING_CONFIRMATION");
    expect(CANDIDATE_POLICY_DEFAULTS_V1.scoringFormulaPreset).toBe("ELO_WEIGHTED_V1");
    expect(CANDIDATE_POLICY_DEFAULTS_V1.manualAdjudicationDeadlineSeconds).toBe(300);

    expect(
      AccountOnboardingDTOSchema.safeParse({
        tenantId: "unit-1",
        userId: "user-1",
        email: "sv01@example.edu.vn",
        initialState: "UNCLAIMED",
      }).success
    ).toBe(true);
    expect(
      RosterImportRowDTOSchema.safeParse({
        sourceRowId: "row-1",
        personKey: "SV001",
        displayName: "Trần Thị B",
      }).success
    ).toBe(true);
    expect(
      StaffInvitationDTOSchema.safeParse({
        invitationId: "inv-1",
        tenantId: "unit-1",
        staffEmail: "referee@example.edu.vn",
        role: "REFEREE",
        expiresAt: "2026-10-25T00:00:00.000Z",
        token: "tok-123",
        status: "PENDING",
      }).success
    ).toBe(true);
    expect(
      SupportRequestDTOSchema.safeParse({
        requestId: "req-1",
        tenantId: "unit-1",
        userId: "user-1",
        description: "Cần cấp lại mã kích hoạt",
        status: "OPEN",
        createdAt: "2026-10-21T00:00:00.000Z",
      }).success
    ).toBe(true);
  });

  it("verifies L01 SQL migration is strictly expand-only and disposable DB guard blocks default DB", () => {
    const sqlPath = resolve(
      process.cwd(),
      "prisma/migrations/20261021100000_l01_tournament_initialization/migration.sql"
    );
    const sql = readFileSync(sqlPath, "utf8");

    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT)\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).toContain('CREATE TABLE "Unit"');
    expect(sql).toContain('CREATE TABLE "TournamentContract"');
    expect(sql).toContain('CREATE TABLE "TournamentContractTaBinding"');
    expect(sql).toContain('CREATE TABLE "Tournament"');
    expect(sql).toContain('CREATE TABLE "TournamentConfigVersionRecord"');
    expect(sql).toContain('CREATE TABLE "TournamentChangeRequestRecord"');
    expect(sql).toContain('CREATE TABLE "TournamentEnrollmentRecord"');
    expect(sql).toContain('CREATE TABLE "TournamentStaffAssignmentRecord"');
    expect(sql).toContain('CREATE TABLE "ManualAdjudicationRequestRecord"');
    expect(sql).toContain('CREATE TABLE "TournamentScoreLedgerRecord"');
    expect(sql).toContain('CREATE TABLE "TournamentAuditLogRecord"');
    expect(sql).toContain('ALTER TABLE "Match" ADD COLUMN "finishSequence" INTEGER');

    const guardCheck = runGuardSelfCheck();
    expect(guardCheck.passed).toBe(true);

    expect(() =>
      validateDisposableDbUrl("postgresql://postgres:postgres@localhost:5432/ott")
    ).toThrow(/lacks required disposable marker/);

    expect(
      validateDisposableDbUrl("postgresql://postgres:postgres@127.0.0.1:5432/ott_l01_test", {
        databaseUrl: "postgresql://postgres:postgres@127.0.0.1:5432/ott",
      }).sanitizedIdentifier
    ).toMatchObject({
      host: "127.0.0.1",
      database: "ott_l01_test",
      disposable: true,
    });
  });
});
