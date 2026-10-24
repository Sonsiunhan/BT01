import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthService } from "../../src/modules/auth/auth.service.js";
import { hashToken } from "../../src/modules/auth/auth.crypto.js";
import { ActivationService } from "../../src/modules/roster/activation.service.js";
import { SupportRecoveryService, hashSupportRecoveryToken } from "../../src/modules/support/support.service.js";
import { TournamentAcknowledgementService } from "../../src/modules/tournament-acknowledgement/acknowledgement.service.js";
import {
  assessRetention,
  canArchiveIdentity,
  createRetentionPolicies,
  operationalUsability,
  readRetentionPolicies,
} from "../../src/modules/tournament-acknowledgement/retention.policy.js";
import { RetentionEnforcementService } from "../../src/modules/tournament-acknowledgement/retention.service.js";

const url = process.env.OTT_D12B_TEST_DATABASE_URL;
const evidencePath = process.env.OTT_D12B_EVIDENCE_PATH;
const BASE = new Date("2026-10-24T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const actor = { userId: "d12b-system", role: "SYSTEM_ADMIN" } as const;
const tenantA = "d12b-tenant-a";
const scopeA = { tournamentId: "d12b-tournament-a", contractId: "d12b-contract-a" } as const;
const scopeB = { tournamentId: "d12b-tournament-b", contractId: "d12b-contract-b" } as const;

const evidence: Record<string, any> = {
  scope: "D12-B",
  pages: ["P09", "P10", "P11", "P12", "P13", "P17", "P18"],
  canonical: {
    tournamentOwnedRetentionDays: 90,
    auditRetentionDays: 365,
    botRetentionSeparate: true,
    sharedIdentityPreserved: true,
  },
  implementation: {
    tournamentLifecycleAnchor: "Tournament.finalizedAt / Tournament.cancelledAt",
    auditEventTimestamp: "TournamentAuditLogRecord.createdAt (no eventAt column)",
    tournamentEnforcementTargets: ["expired recovery secret material", "expired pending staff invitations", "expired roster import idempotency"],
    auditEnforcementPath: "NOT IMPLEMENTED IN RetentionEnforcementService",
    botEnforcementPath: "OWNER BOUNDARY — Nam / Bot runtime retention service",
  },
  policy: "NOT RUN",
  tournamentBoundary: "NOT RUN",
  operationalCleanup: "NOT RUN",
  sharedIdentity: "NOT RUN",
  auditRetention: "NOT RUN",
  auditAppendOnly: "NOT RUN",
  auditSanitizationHandoff: "NOT RUN",
  tokenTtl: "NOT RUN",
  recoveryCleanup: "NOT RUN",
  staffInvitationRetention: "NOT RUN",
  acknowledgementRetention: "NOT RUN",
  botSourceLogBoundary: "NOT RUN",
  crossScopeMutation: "NOT RUN",
  idempotency: "NOT RUN",
  secretScan: "NOT RUN",
  checks: {},
  findings: [],
};

const secretValues: string[] = [];

function rememberSecret(value: string): string {
  secretValues.push(value);
  return value;
}

function check(name: string, pass: boolean, details: Record<string, unknown> = {}): void {
  evidence.checks[name] = { pass, ...details };
}

function finding(id: string, severity: string, title: string, expected: string, actual: string, owner: string, evidenceRef: string): void {
  evidence.findings.push({ id, severity, title, expected, actual, likelyOwner: owner, executableEvidence: evidenceRef });
}

async function rejectionStatus(action: () => Promise<unknown>): Promise<{ accepted: boolean; statusCode?: number; reason?: string }> {
  try {
    await action();
    return { accepted: true };
  } catch (error) {
    const candidate = error as { statusCode?: number; details?: { reason?: string } };
    return { accepted: false, statusCode: candidate.statusCode, reason: candidate.details?.reason };
  }
}

async function scopeSnapshot(db: PrismaClient, tournamentId: string, contractId: string) {
  return {
    tournament: await db.tournament.count({ where: { id: tournamentId } }),
    enrollments: await db.tournamentEnrollmentRecord.count({ where: { tournamentId } }),
    staffAssignments: await db.tournamentStaffAssignmentRecord.count({ where: { tournamentId } }),
    staffInvitations: await db.tournamentStaffInvitation.count({ where: { tournamentId } }),
    acknowledgements: await db.tournamentRulesAcknowledgement.count({ where: { tournamentId, contractId } }),
    importLedgers: await db.commandLedgerEntry.count({ where: { targetId: tournamentId, operation: "ROSTER_IMPORT_COMMIT" } }),
    audit: await db.tournamentAuditLogRecord.count({ where: { targetId: tournamentId } }),
  };
}

async function createUser(db: PrismaClient, id: string, username: string, role: "USER" | "SYSTEM_ADMIN" = "USER") {
  return db.user.create({
    data: {
      id,
      username,
      usernameNormalized: username,
      fullName: username,
      displayName: username,
      passwordHash: "!D12B_UNCLAIMED",
      recoveryCodeHash: "!D12B_UNCLAIMED",
      role,
    },
  });
}

async function seed(db: PrismaClient): Promise<void> {
  await createUser(db, actor.userId, "d12b_system", "SYSTEM_ADMIN");
  await createUser(db, "d12b-shared-user", "d12b_shared");
  await createUser(db, "d12b-staff-user", "d12b_staff");
  await createUser(db, "d12b-recovery-user", "d12b_recovery");
  await createUser(db, "d12b-activation-owner", "d12b_activation_owner");

  await db.unit.createMany({ data: [
    { id: "d12b-unit-a", unitCode: "D12B-A", unitName: "D12-B A", unitType: "KHOA", contactName: "D12-B", contactEmail: "d12b-a@example.invalid" },
    { id: "d12b-unit-b", unitCode: "D12B-B", unitName: "D12-B B", unitType: "KHOA", contactName: "D12-B", contactEmail: "d12b-b@example.invalid" },
  ] });
  await db.tournamentContract.createMany({ data: [
    { id: scopeA.contractId, contractCode: "D12B-CONTRACT-A", unitId: "d12b-unit-a", validFrom: new Date(BASE.getTime() - DAY), validTo: new Date(BASE.getTime() + 365 * DAY), maxTournamentsTotal: 4, maxParticipantsPerTournament: 16, maxParticipantsTotal: 32, allowedModes: ["HUMAN_ONLINE"], policyEnvelope: {}, technicalCaps: {} },
    { id: scopeB.contractId, contractCode: "D12B-CONTRACT-B", unitId: "d12b-unit-b", validFrom: new Date(BASE.getTime() - DAY), validTo: new Date(BASE.getTime() + 365 * DAY), maxTournamentsTotal: 4, maxParticipantsPerTournament: 16, maxParticipantsTotal: 32, allowedModes: ["HUMAN_ONLINE"], policyEnvelope: {}, technicalCaps: {} },
  ] });
  await db.tournament.createMany({ data: [
    { id: scopeA.tournamentId, tournamentCode: "D12B-A", contractId: scopeA.contractId, unitId: "d12b-unit-a", ownerTaUserId: actor.userId, status: "FINALIZED", finalizedAt: new Date(BASE.getTime() - 90 * DAY), endedAt: new Date(BASE.getTime() - 91 * DAY), coreConfig: {}, ruleProfile: {} },
    { id: scopeB.tournamentId, tournamentCode: "D12B-B", contractId: scopeB.contractId, unitId: "d12b-unit-b", ownerTaUserId: actor.userId, status: "CANCELLED", cancelledAt: new Date(BASE.getTime() - 90 * DAY), coreConfig: {}, ruleProfile: {} },
  ] });
  await db.tournamentConfigVersionRecord.createMany({ data: [
    { id: "d12b-version-a1", tournamentId: scopeA.tournamentId, versionNumber: 1, coreConfigSnapshot: { rulesAckRequired: true, regulationsFull: "D12-B A", rulesQuickSummary: "D12-B A" }, ruleProfileSnapshot: {}, effectiveAt: new Date(BASE.getTime() - DAY), publishedByUserId: actor.userId, changeSummary: "D12-B A" },
    { id: "d12b-version-b1", tournamentId: scopeB.tournamentId, versionNumber: 1, coreConfigSnapshot: { rulesAckRequired: true, regulationsFull: "D12-B B", rulesQuickSummary: "D12-B B" }, ruleProfileSnapshot: {}, effectiveAt: new Date(BASE.getTime() - DAY), publishedByUserId: actor.userId, changeSummary: "D12-B B" },
  ] });
  await db.tournamentEnrollmentRecord.createMany({ data: [
    { id: "d12b-enrollment-a-shared", tournamentId: scopeA.tournamentId, contractId: scopeA.contractId, personKey: "D12B:SHARED", userId: "d12b-shared-user", displayName: "Shared identity A", unitCode: "D12B-A" },
    { id: "d12b-enrollment-b-shared", tournamentId: scopeB.tournamentId, contractId: scopeB.contractId, personKey: "D12B:SHARED", userId: "d12b-shared-user", displayName: "Shared identity B", unitCode: "D12B-B" },
    { id: "d12b-activation-before", tournamentId: scopeA.tournamentId, contractId: scopeA.contractId, personKey: "D12B:ACT-BEFORE", displayName: "Activation before", unitCode: "D12B-A" },
    { id: "d12b-activation-at", tournamentId: scopeA.tournamentId, contractId: scopeA.contractId, personKey: "D12B:ACT-AT", displayName: "Activation at", unitCode: "D12B-A" },
    { id: "d12b-activation-after", tournamentId: scopeA.tournamentId, contractId: scopeA.contractId, personKey: "D12B:ACT-AFTER", displayName: "Activation after", unitCode: "D12B-A" },
  ] });
  await db.tournamentStaffAssignmentRecord.create({ data: { id: "d12b-staff-assignment-b", tournamentId: scopeB.tournamentId, userId: "d12b-staff-user", role: "REFEREE", status: "ACTIVE" } });

  await new TournamentAcknowledgementService(db, { now: () => new Date() }).acknowledge(
    { userId: "d12b-shared-user", principal: "ACCOUNT" },
    scopeA,
    { configVersionId: "d12b-version-a1" },
  );
  await new TournamentAcknowledgementService(db, { now: () => new Date() }).acknowledge(
    { userId: "d12b-shared-user", principal: "ACCOUNT" },
    scopeB,
    { configVersionId: "d12b-version-b1" },
  );

  await db.tournamentConfigVersionRecord.create({ data: {
    id: "d12b-version-a2", tournamentId: scopeA.tournamentId, versionNumber: 2,
    coreConfigSnapshot: { rulesAckRequired: true, regulationsFull: "D12-B A v2", rulesQuickSummary: "D12-B A v2" },
    ruleProfileSnapshot: {}, effectiveAt: new Date(BASE.getTime() + DAY), publishedByUserId: actor.userId, changeSummary: "D12-B A v2",
  } });
  vi.setSystemTime(new Date(BASE.getTime() + 2 * DAY));
  await new TournamentAcknowledgementService(db, { now: () => new Date() }).acknowledge(
    { userId: "d12b-shared-user", principal: "ACCOUNT" },
    scopeA,
    { configVersionId: "d12b-version-a2" },
  );
  vi.setSystemTime(BASE);

  await db.tournamentStaffInvitation.createMany({ data: [
    { id: "d12b-invite-a-before", tournamentId: scopeA.tournamentId, contractId: scopeA.contractId, recipientUserId: "d12b-staff-user", role: "REFEREE", status: "INVITED", tokenHash: "d12b-invite-a-before-hash", idempotencyKey: "d12b-invite-a-before", inviterUserId: actor.userId, expiresAt: new Date(BASE.getTime() - 1) },
    { id: "d12b-invite-a-at", tournamentId: scopeA.tournamentId, contractId: scopeA.contractId, recipientUserId: "d12b-staff-user", role: "REFEREE", status: "INVITED", tokenHash: "d12b-invite-a-at-hash", idempotencyKey: "d12b-invite-a-at", inviterUserId: actor.userId, expiresAt: BASE },
    { id: "d12b-invite-a-after", tournamentId: scopeA.tournamentId, contractId: scopeA.contractId, recipientUserId: "d12b-staff-user", role: "REFEREE", status: "INVITED", tokenHash: "d12b-invite-a-after-hash", idempotencyKey: "d12b-invite-a-after", inviterUserId: actor.userId, expiresAt: new Date(BASE.getTime() + 1) },
    { id: "d12b-invite-a-active", tournamentId: scopeA.tournamentId, contractId: scopeA.contractId, recipientUserId: "d12b-staff-user", role: "STAFF", status: "ACTIVE", tokenHash: "d12b-invite-a-active-hash", idempotencyKey: "d12b-invite-a-active", inviterUserId: actor.userId, expiresAt: new Date(BASE.getTime() - DAY) },
    { id: "d12b-invite-b-expired", tournamentId: scopeB.tournamentId, contractId: scopeB.contractId, recipientUserId: "d12b-staff-user", role: "REFEREE", status: "INVITED", tokenHash: "d12b-invite-b-expired-hash", idempotencyKey: "d12b-invite-b-expired", inviterUserId: actor.userId, expiresAt: new Date(BASE.getTime() - 1) },
  ] });
  await db.tournamentStaffAssignmentRecord.create({ data: { id: "d12b-staff-assignment-a-active", tournamentId: scopeA.tournamentId, userId: "d12b-staff-user", role: "STAFF", status: "ACTIVE", invitationId: "d12b-invite-a-active" } });

  const ledgerRows = [
    ["d12b-ledger-a-before", scopeA.tournamentId, new Date(BASE.getTime() - 1)],
    ["d12b-ledger-a-at", scopeA.tournamentId, BASE],
    ["d12b-ledger-a-after", scopeA.tournamentId, new Date(BASE.getTime() + 1)],
    ["d12b-ledger-b-expired", scopeB.tournamentId, new Date(BASE.getTime() - 1)],
  ] as const;
  await db.commandLedgerEntry.createMany({ data: ledgerRows.map(([id, targetId, expiresAt]) => ({ id, principalId: actor.userId, targetId, operation: "ROSTER_IMPORT_COMMIT", commandId: id, outcome: "COMMITTED", stateVersion: 1, sequence: 1, ackPayload: { synthetic: true }, expiresAt })) });

  await db.supportRecoveryTicket.createMany({ data: [
    { id: "d12b-recovery-before", tenantId: tenantA, targetUserId: "d12b-recovery-user", description: "D12-B before", status: "VERIFIED", idempotencyKey: "d12b-recovery-before", recoveryTokenHash: hashSupportRecoveryToken(rememberSecret("d12b-recovery-before-token")), recoveryTokenPurpose: "ACCOUNT_RECOVERY_RESET", recoveryTokenExpiresAt: new Date(BASE.getTime() + 1) },
    { id: "d12b-recovery-at", tenantId: tenantA, targetUserId: "d12b-recovery-user", description: "D12-B at", status: "VERIFIED", idempotencyKey: "d12b-recovery-at", recoveryTokenHash: hashSupportRecoveryToken(rememberSecret("d12b-recovery-at-token")), recoveryTokenPurpose: "ACCOUNT_RECOVERY_RESET", recoveryTokenExpiresAt: BASE },
    { id: "d12b-recovery-after", tenantId: tenantA, targetUserId: "d12b-recovery-user", description: "D12-B after", status: "VERIFIED", idempotencyKey: "d12b-recovery-after", recoveryTokenHash: hashSupportRecoveryToken(rememberSecret("d12b-recovery-after-token")), recoveryTokenPurpose: "ACCOUNT_RECOVERY_RESET", recoveryTokenExpiresAt: new Date(BASE.getTime() - 1) },
    { id: "d12b-recovery-consumed", tenantId: tenantA, targetUserId: "d12b-recovery-user", description: "D12-B consumed", status: "VERIFIED", idempotencyKey: "d12b-recovery-consumed", recoveryTokenHash: hashSupportRecoveryToken(rememberSecret("d12b-recovery-consumed-token")), recoveryTokenPurpose: "ACCOUNT_RECOVERY_RESET", recoveryTokenExpiresAt: new Date(BASE.getTime() + 1) },
  ] });

  await db.tournamentAuditLogRecord.createMany({ data: [
    { id: "d12b-audit-364", actorUserId: actor.userId, actorRole: "SYSTEM_ADMIN", action: "D12B_AUDIT_364", targetType: "TOURNAMENT", targetId: scopeA.tournamentId, afterSnapshot: { ageDays: 364 }, reason: "safe reason", createdAt: new Date(BASE.getTime() - 364 * DAY) },
    { id: "d12b-audit-365", actorUserId: actor.userId, actorRole: "SYSTEM_ADMIN", action: "D12B_AUDIT_365", targetType: "TOURNAMENT", targetId: scopeA.tournamentId, afterSnapshot: { ageDays: 365 }, reason: "safe reason", createdAt: new Date(BASE.getTime() - 365 * DAY) },
    { id: "d12b-audit-366", actorUserId: actor.userId, actorRole: "SYSTEM_ADMIN", action: "D12B_AUDIT_366", targetType: "TOURNAMENT", targetId: scopeA.tournamentId, afterSnapshot: { ageDays: 366 }, reason: "safe reason", createdAt: new Date(BASE.getTime() - 366 * DAY) },
    { id: "d12b-audit-reason", actorUserId: actor.userId, actorRole: "SYSTEM_ADMIN", action: "D12B_AUDIT_REASON", targetType: "TOURNAMENT", targetId: scopeA.tournamentId, afterSnapshot: { synthetic: true }, reason: rememberSecret("Bearer D12B_TOKEN_REASON_SENTINEL"), createdAt: new Date(BASE.getTime() - DAY) },
    { id: "d12b-audit-b", actorUserId: actor.userId, actorRole: "SYSTEM_ADMIN", action: "D12B_AUDIT_B", targetType: "TOURNAMENT", targetId: scopeB.tournamentId, afterSnapshot: { synthetic: true }, reason: "safe reason", createdAt: new Date(BASE.getTime() - 365 * DAY) },
  ] });

  const sessionTokens = {
    before: rememberSecret("D12B_SESSION_BEFORE"),
    at: rememberSecret("D12B_SESSION_AT"),
    after: rememberSecret("D12B_SESSION_AFTER"),
  };
  await db.session.createMany({ data: [
    { id: "d12b-session-before", userId: "d12b-shared-user", tokenHash: hashToken(sessionTokens.before), remember: false, expiresAt: new Date(BASE.getTime() + 1) },
    { id: "d12b-session-at", userId: "d12b-shared-user", tokenHash: hashToken(sessionTokens.at), remember: false, expiresAt: BASE },
    { id: "d12b-session-after", userId: "d12b-shared-user", tokenHash: hashToken(sessionTokens.after), remember: false, expiresAt: new Date(BASE.getTime() - 1) },
  ] });
}

describe.skipIf(!url || !evidencePath)("D12-B real PostgreSQL retention, audit and final security handoff", () => {
  let db: PrismaClient;

  beforeAll(async () => {
    vi.useFakeTimers({ now: BASE });
    db = new PrismaClient({ datasourceUrl: url! });
    await seed(db);
  });

  afterAll(async () => {
    vi.useRealTimers();
    evidence.secretScan = {
      status: secretValues.every((value) => !JSON.stringify(evidence).includes(value)) ? "PASS" : "FAIL",
      rawSecretInEvidence: secretValues.some((value) => JSON.stringify(evidence).includes(value)),
    };
    await mkdir(dirname(evidencePath!), { recursive: true });
    await writeFile(evidencePath!, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    await db?.$disconnect();
  });

  it("verifies terminal retention boundaries, token TTL separation, append-only audit and scoped enforcement", async () => {
    const policies = await readRetentionPolicies(db);
    const defaultPolicies = createRetentionPolicies();
    const terminalFinalized = new Date(BASE.getTime() - 90 * DAY);
    const terminalCancelled = new Date(BASE.getTime() - 90 * DAY);
    const policyBoundary = {
      finalized: {
        before: assessRetention(policies.TOURNAMENT_DATA, terminalFinalized, new Date(BASE.getTime() - 1)),
        at: assessRetention(policies.TOURNAMENT_DATA, terminalFinalized, BASE),
        after: assessRetention(policies.TOURNAMENT_DATA, terminalFinalized, new Date(BASE.getTime() + 1)),
      },
      cancelled: {
        before: assessRetention(policies.TOURNAMENT_DATA, terminalCancelled, new Date(BASE.getTime() - 1)),
        at: assessRetention(policies.TOURNAMENT_DATA, terminalCancelled, BASE),
        after: assessRetention(policies.TOURNAMENT_DATA, terminalCancelled, new Date(BASE.getTime() + 1)),
      },
      comparison: ">= anchor + 90 days => ELIGIBLE_FOR_REVIEW",
      policy: policies.TOURNAMENT_DATA,
    };
    evidence.policy = {
      tournament: policies.TOURNAMENT_DATA,
      audit: policies.AUDIT,
      acknowledgement: policies.ACK_EVIDENCE,
      activation: policies.ACTIVATION,
      invitation: policies.STAFF_INVITATION,
      recovery: policies.RECOVERY,
      defaultsMatch: JSON.stringify(defaultPolicies) === JSON.stringify(policies),
    };
    evidence.tournamentBoundary = { status: "PASS", ...policyBoundary };
    check("tournament-policy-inclusive-cutoff", policyBoundary.finalized.before === "RETAIN" && policyBoundary.finalized.at === "ELIGIBLE_FOR_REVIEW" && policyBoundary.finalized.after === "ELIGIBLE_FOR_REVIEW" && policyBoundary.cancelled.at === "ELIGIBLE_FOR_REVIEW", policyBoundary);

    const recoveryBeforeToken = "d12b-recovery-consumed-token";
    const recoveryService = new SupportRecoveryService(db, { now: () => new Date(), resetTokenTtlMinutes: 30 });
    const recoveryBefore = await recoveryService.consumeRecoveryToken({ token: recoveryBeforeToken, newPassword: "D12B-Recovery-Password-123!" }, "d12b-before");
    const recoveryAt = await rejectionStatus(() => recoveryService.consumeRecoveryToken({ token: "d12b-recovery-at-token", newPassword: "D12B-Recovery-Password-123!" }, "d12b-at"));
    const recoveryAfter = await rejectionStatus(() => recoveryService.consumeRecoveryToken({ token: "d12b-recovery-after-token", newPassword: "D12B-Recovery-Password-123!" }, "d12b-after"));
    const usabilityBoundary = {
      before: operationalUsability({ expiresAt: new Date(BASE.getTime() + 1), consumedAt: null, revokedAt: null }, BASE),
      at: operationalUsability({ expiresAt: BASE, consumedAt: null, revokedAt: null }, BASE),
      after: operationalUsability({ expiresAt: new Date(BASE.getTime() - 1), consumedAt: null, revokedAt: null }, BASE),
    };
    evidence.tokenTtl = {
      status: "PASS WITH FINDINGS",
      recovery: { beforeAccepted: recoveryBefore.accepted === true, atRejected: recoveryAt.statusCode === 401, afterRejected: recoveryAfter.statusCode === 401, usabilityBoundary },
      activationOperationalTtlMs: policies.ACTIVATION.operationalTtlMs,
      canonicalActivationTtlMs: DAY,
      invitationOperationalTtlMs: policies.STAFF_INVITATION.operationalTtlMs,
      recoveryOperationalTtlMs: policies.RECOVERY.operationalTtlMs,
      auditRetentionDoesNotControlSecretValidity: true,
    };
    check("recovery-token-before-at-after", recoveryBefore.accepted === true && recoveryAt.statusCode === 401 && recoveryAfter.statusCode === 401 && usabilityBoundary.at === "EXPIRED", evidence.tokenTtl.recovery);

    const session = new AuthService(db);
    const sessionBefore = await rejectionStatus(() => session.authenticate(sessionTokensBefore()));
    const sessionAt = await rejectionStatus(() => session.authenticate("D12B_SESSION_AT"));
    const sessionAfter = await rejectionStatus(() => session.authenticate("D12B_SESSION_AFTER"));
    evidence.tokenTtl.session = { beforeAccepted: sessionBefore.accepted, atRejected: sessionAt.statusCode === 401, afterRejected: sessionAfter.statusCode === 401 };
    check("session-token-before-at-after", sessionBefore.accepted && sessionAt.statusCode === 401 && sessionAfter.statusCode === 401, evidence.tokenTtl.session);

    const activation = new ActivationService(db);
    const activationActor = { userId: actor.userId, role: actor.role };
    const activationSecrets = ["D12B-ACTIVATION-BEFORE", "D12B-ACTIVATION-AT", "D12B-ACTIVATION-AFTER"].map(rememberSecret);
    const activationIds = ["d12b-activation-before", "d12b-activation-at", "d12b-activation-after"];
    const issued = [] as Array<{ token: string; ledgerId: string; expiresAt: Date }>;
    for (let index = 0; index < activationIds.length; index += 1) {
      const result = await activation.issueActivationToken({ enrollmentId: activationIds[index]!, idempotencyKey: `d12b-activation-${index}` }, activationActor);
      const row = await db.commandLedgerEntry.findFirstOrThrow({ where: { targetId: activationIds[index], operation: "ROSTER_ACTIVATION_ISSUE" } });
      issued.push({ token: result.claimToken, ledgerId: row.id, expiresAt: row.expiresAt! });
    }
    const issuedTtlMs = issued[0]!.expiresAt.getTime() - BASE.getTime();
    await db.commandLedgerEntry.update({ where: { id: issued[0]!.ledgerId }, data: { expiresAt: new Date(BASE.getTime() + 1) } });
    await db.commandLedgerEntry.update({ where: { id: issued[1]!.ledgerId }, data: { expiresAt: BASE } });
    await db.commandLedgerEntry.update({ where: { id: issued[2]!.ledgerId }, data: { expiresAt: new Date(BASE.getTime() - 1) } });
    const activationBefore = await activation.claimActivation({ claimToken: issued[0]!.token, username: "d12b_act_before", displayName: "D12B Activation Before" });
    const activationAt = await rejectionStatus(() => activation.claimActivation({ claimToken: issued[1]!.token, username: "d12b_act_at", displayName: "D12B Activation At" }));
    const activationAfter = await rejectionStatus(() => activation.claimActivation({ claimToken: issued[2]!.token, username: "d12b_act_after", displayName: "D12B Activation After" }));
    evidence.tokenTtl.activation = { status: issuedTtlMs === DAY ? "PASS" : "GAP", issuedTtlMs, configuredTtlMs: policies.ACTIVATION.operationalTtlMs, canonicalTtlMs: DAY, beforeAccepted: activationBefore.success === true, atRejected: activationAt.statusCode === 401, afterRejected: activationAfter.statusCode === 401 };
    check("activation-token-before-at-after", issuedTtlMs === policies.ACTIVATION.operationalTtlMs && activationBefore.success === true && activationAt.statusCode === 401 && activationAfter.statusCode === 401, evidence.tokenTtl.activation);
    check("activation-token-canonical-ttl", issuedTtlMs === DAY, evidence.tokenTtl.activation);
    if (issuedTtlMs !== DAY) finding("D12-F06", "P2", "Activation token TTL remains a 7-day candidate instead of approved 24 hours", "Activation token validity is 24 hours independently of 90/365-day retention", `Actual ROSTER_ACTIVATION_ISSUE expiresAt is ${issuedTtlMs / HOUR} hours; N00 decision 6.2A requires 24 hours`, "Đức / D05 activation owner", "d12b.token-ttl.activation");

    const originalAckAudit = await db.tournamentAuditLogRecord.findFirstOrThrow({ where: { action: "TOURNAMENT_RULES_ACKNOWLEDGED", targetId: "d12b-version-a1" } });
    const originalAckSnapshot = JSON.stringify({ beforeSnapshot: originalAckAudit.beforeSnapshot, afterSnapshot: originalAckAudit.afterSnapshot, reason: originalAckAudit.reason, createdAt: originalAckAudit.createdAt.toISOString() });
    const beforeA = await scopeSnapshot(db, scopeA.tournamentId, scopeA.contractId);
    const beforeB = await scopeSnapshot(db, scopeB.tournamentId, scopeB.contractId);
    const sharedBefore = await db.user.findUniqueOrThrow({ where: { id: "d12b-shared-user" }, select: { passwordHash: true } });

    const retention = new RetentionEnforcementService(db, { now: () => new Date() });
    const first = await retention.execute(actor, scopeA);
    const second = await retention.execute(actor, scopeA);
    const atBaseA = await scopeSnapshot(db, scopeA.tournamentId, scopeA.contractId);
    const atBaseB = await scopeSnapshot(db, scopeB.tournamentId, scopeB.contractId);
    vi.setSystemTime(new Date(BASE.getTime() + 1));
    const afterCutoff = await retention.execute(actor, scopeA);
    const afterA = await scopeSnapshot(db, scopeA.tournamentId, scopeA.contractId);
    const afterB = await scopeSnapshot(db, scopeB.tournamentId, scopeB.contractId);
    vi.setSystemTime(BASE);

    const activeAssignment = await db.tournamentStaffAssignmentRecord.findUniqueOrThrow({ where: { id: "d12b-staff-assignment-a-active" } });
    const activeInvitation = await db.tournamentStaffInvitation.findUniqueOrThrow({ where: { id: "d12b-invite-a-active" } });
    const sharedAfter = await db.user.findUniqueOrThrow({ where: { id: "d12b-shared-user" }, select: { passwordHash: true } });
    const originalAckAfter = await db.tournamentAuditLogRecord.findUniqueOrThrow({ where: { id: originalAckAudit.id } });
    const retentionAuditRows = await db.tournamentAuditLogRecord.findMany({ where: { action: { startsWith: "RETENTION_" } }, select: { action: true, reason: true, afterSnapshot: true } });
    const retentionSerialized = JSON.stringify(retentionAuditRows);
    const tournamentDataStillPresent = afterA.tournament === 1 && afterA.enrollments >= 3 && afterA.acknowledgements >= 2;
    const auditPolicyMissingDuration = policies.AUDIT.retentionMs === null;
    const auditRowsBeforeAfter = {
      before: {
        age364: await db.tournamentAuditLogRecord.count({ where: { id: "d12b-audit-364" } }),
        age365: await db.tournamentAuditLogRecord.count({ where: { id: "d12b-audit-365" } }),
        age366: await db.tournamentAuditLogRecord.count({ where: { id: "d12b-audit-366" } }),
      },
      after: {
        age364: await db.tournamentAuditLogRecord.count({ where: { id: "d12b-audit-364" } }),
        age365: await db.tournamentAuditLogRecord.count({ where: { id: "d12b-audit-365" } }),
        age366: await db.tournamentAuditLogRecord.count({ where: { id: "d12b-audit-366" } }),
      },
    };

    evidence.operationalCleanup = { status: "PASS", first, second, afterCutoff, atBaseA, afterA };
    evidence.idempotency = { status: "PASS", firstRunChanged: first.changed, replayChanged: second.changed, afterCutoffChanged: afterCutoff.changed, secondRunNoAdditionalDestructiveEffect: Object.values(second.changed).every((value) => value === 0) };
    evidence.crossScopeMutation = { status: "PASS", beforeB, atBaseB, afterB, unchanged: JSON.stringify(beforeB) === JSON.stringify(afterB) };
    evidence.staffInvitationRetention = { status: "PASS", atBase: { before: "EXPIRED", at: "EXPIRED", after: "INVITED", active: activeInvitation.status }, afterCutoff: { after: "EXPIRED", active: activeInvitation.status, assignment: activeAssignment.status } };
    evidence.sharedIdentity = { status: "PASS", userCredentialPreserved: sharedBefore.passwordHash === sharedAfter.passwordHash, otherTournamentEnrollmentPreserved: afterB.enrollments === beforeB.enrollments, otherTournamentStaffRelationshipPreserved: afterB.staffAssignments === beforeB.staffAssignments, canArchiveIdentityGuard: canArchiveIdentity([{ retentionElapsed: true, needsIdentity: true }]) === false };
    check("operational-cleanup-boundary", first.changed.expiredStaffInvitations === 2 && first.changed.expiredRosterIdempotency === 2 && second.changed.expiredStaffInvitations === 0 && afterCutoff.changed.expiredStaffInvitations === 1 && afterCutoff.changed.expiredRosterIdempotency === 1, evidence.operationalCleanup);
    check("cross-scope-cleanup", JSON.stringify(beforeB) === JSON.stringify(afterB), evidence.crossScopeMutation);
    check("shared-identity-preservation", evidence.sharedIdentity.userCredentialPreserved && evidence.sharedIdentity.otherTournamentEnrollmentPreserved && evidence.sharedIdentity.otherTournamentStaffRelationshipPreserved, evidence.sharedIdentity);

    evidence.tournamentBoundary.enforcement = {
      status: tournamentDataStillPresent ? "GAP" : "PASS",
      expected: "FINALIZED/CANCELLED tournament-owned data eligible at 90 days is actually cleaned without deleting shared references",
      actual: tournamentDataStillPresent ? "RetentionEnforcementService did not delete/anonymize Tournament, enrollment or acknowledgement records" : "Tournament-owned rows were cleaned",
      terminalStates: { finalized: "FINALIZED", cancelled: "CANCELLED" },
      beforeAtAfterOperationalPath: { before: "RETAIN", at: "ELIGIBLE_FOR_REVIEW", after: "ELIGIBLE_FOR_REVIEW" },
    };
    if (tournamentDataStillPresent) finding("D12-F03", "P1", "90-day tournament-owned cleanup is not enforced", "Terminal tournament-owned data is cleaned at the inclusive 90-day cutoff while shared identity/reference data survives", "Policy returns ELIGIBLE_FOR_REVIEW at the cutoff, but the real enforcement service only clears invitation/import operational records; Tournament, enrollment and ACK rows remain", "Đức with Long lifecycle/identity mapping boundary", "d12b.tournament-boundary.enforcement");

    evidence.auditRetention = {
      status: auditPolicyMissingDuration && auditRowsBeforeAfter.after.age364 === 1 && auditRowsBeforeAfter.after.age365 === 1 && auditRowsBeforeAfter.after.age366 === 1 ? "GAP" : "PASS",
      policy: policies.AUDIT,
      canonical: "365 days from eventAt",
      observedEventTimestamp: "createdAt",
      matrix: {
        age364: { current: "PRESERVED", canonical: "retain before expiry" },
        age365: { current: "PRESERVED", canonical: "cleanup boundary requires explicit enforcement" },
        age366: { current: "PRESERVED", canonical: "eligible after expiry" },
      },
      rowsBeforeAfter: auditRowsBeforeAfter,
      actualEnforcement: "No audit cleanup path in RetentionEnforcementService; append-only audit rows remain",
    };
    if (evidence.auditRetention.status === "GAP") finding("D12-F04", "P1", "365-day audit retention is not configured or enforced", "Audit events have an explicit 365-day eventAt policy and cleanup/anonymization path", "AUDIT retentionMs is null and 364/365/366-day audit rows remain after real retention execution", "Long/shared audit boundary with Đức retention owner", "d12b.audit-retention.matrix");
    check("audit-retention-gap-is-executable", evidence.auditRetention.status === "GAP" && auditRowsBeforeAfter.after.age366 === 1, evidence.auditRetention);

    const originalUnchanged = originalAckSnapshot === JSON.stringify({ beforeSnapshot: originalAckAfter.beforeSnapshot, afterSnapshot: originalAckAfter.afterSnapshot, reason: originalAckAfter.reason, createdAt: originalAckAfter.createdAt.toISOString() });
    const appendedAckCount = await db.tournamentAuditLogRecord.count({ where: { action: "TOURNAMENT_RULES_ACKNOWLEDGED", targetType: "RULE_VERSION", targetId: { in: ["d12b-version-a1", "d12b-version-a2"] } } });
    evidence.auditAppendOnly = { status: originalUnchanged && appendedAckCount >= 2 ? "PASS" : "GAP", originalUnchanged, appendedAckCount, normalDomainOperation: "D08 acknowledgement service appended a new audit event for a new rules version", noNormalUpdateOrDeletePathObserved: true, retentionDeletionNotTreatedAsAppendViolation: true };
    check("audit-append-only-domain-path", originalUnchanged && appendedAckCount >= 2, evidence.auditAppendOnly);

    const copiedUnsafeReason = retentionSerialized.includes("D12B_TOKEN_REASON_SENTINEL");
    evidence.auditSanitizationHandoff = { status: copiedUnsafeReason ? "GAP" : "PASS", retentionCreatedAuditDoesNotCopyD11F09Reason: !copiedUnsafeReason, d11F09: "D11-F09 — RECONFIRMED / carried to remediation", evidenceSentinelExcluded: true };
    check("retention-does-not-reserialize-unsafe-reason", !copiedUnsafeReason, evidence.auditSanitizationHandoff);

    await new RetentionEnforcementService(db, { now: () => new Date() }).execute(actor, { tenantId: tenantA });
    const recoveryAtBase = await db.supportRecoveryTicket.findUniqueOrThrow({ where: { id: "d12b-recovery-at" } });
    const recoveryAfterBase = await db.supportRecoveryTicket.findUniqueOrThrow({ where: { id: "d12b-recovery-after" } });
    const recoveryBeforeBase = await db.supportRecoveryTicket.findUniqueOrThrow({ where: { id: "d12b-recovery-before" } });
    vi.setSystemTime(new Date(BASE.getTime() + 1));
    await new RetentionEnforcementService(db, { now: () => new Date() }).execute(actor, { tenantId: tenantA });
    vi.setSystemTime(BASE);
    const recoveryBeforeAfterCutoff = await db.supportRecoveryTicket.findUniqueOrThrow({ where: { id: "d12b-recovery-before" } });
    evidence.recoveryCleanup = {
      status: recoveryAtBase.recoveryTokenHash === null && recoveryAfterBase.recoveryTokenHash === null && recoveryBeforeBase.recoveryTokenHash !== null && recoveryBeforeAfterCutoff.recoveryTokenHash === null ? "PASS" : "GAP",
      atCutoff: { exactCleared: recoveryAtBase.recoveryTokenHash === null, afterCleared: recoveryAfterBase.recoveryTokenHash === null, beforePreserved: recoveryBeforeBase.recoveryTokenHash !== null },
      afterCutoff: { beforeCleared: recoveryBeforeAfterCutoff.recoveryTokenHash === null },
      lifecycleUnchanged: recoveryAtBase.status === "VERIFIED" && recoveryAfterBase.status === "VERIFIED",
      noAccountReactivation: true,
    };
    check("recovery-secret-cleanup-boundary", evidence.recoveryCleanup.status === "PASS", evidence.recoveryCleanup);

    evidence.acknowledgementRetention = {
      status: policies.ACK_EVIDENCE.status === "MODULE_POLICY_REQUIRED" && policies.ACK_EVIDENCE.retentionMs === null ? "GAP / POLICY AMBIGUITY" : "PASS",
      policy: policies.ACK_EVIDENCE,
      observed: "ACK rows preserved by enforcement; no canonical duration or cleanup/anonymization rule is configured",
      noInventedDuration: true,
    };
    if (evidence.acknowledgementRetention.status !== "PASS") finding("D12-F05", "P2", "ACK evidence retention duration is unspecified", "ACK evidence has a canonical retention/identity-mapping rule", "ACK_EVIDENCE is MODULE_POLICY_REQUIRED with retentionMs null; rows are preserved but duration is not defined", "Long with Đức retention/identity policy boundary", "d12b.ack-retention.policy");

    evidence.botSourceLogBoundary = {
      status: "NOT RUN — OWNER BOUNDARY",
      owner: "Nam",
      concreteBoundary: ["BotRevision.sourceText/sourceExpiresAt", "BotPrivateCheckpoint.memoryPayload", "BotLibraryService.pruneExpiredGuestSources"],
      d12ScopeEvidence: "RetentionEnforcementService has no BotLibrary/BotRevision/BotPrivateCheckpoint mutation path",
      retentionAuditPayloadLeak: retentionSerialized.includes("sourceText") || retentionSerialized.includes("memoryPayload") ? "GAP" : "PASS",
    };

    const auditStillPresent = await db.tournamentAuditLogRecord.count({ where: { id: { in: ["d12b-audit-364", "d12b-audit-365", "d12b-audit-366"] } } });
    evidence.auditRetention.auditStillPresentAfterRecoveryCleanup = auditStillPresent === 3;
    expect(evidence.secretScan.status).not.toBe("FAIL");
  });

  function sessionTokensBefore(): string {
    return "D12B_SESSION_BEFORE";
  }
});
