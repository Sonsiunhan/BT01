import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ContractPolicyEnvelopeSchema,
  DEFAULT_TOURNAMENT_RULE_PROFILE,
  TournamentDtoSchema,
} from "@ottv2/contracts";
import {
  createTournamentRuntimeBundle,
  PrismaTournamentAcknowledgementGuard,
} from "../../src/modules/tournament-core/index.js";
import { TournamentStaffService, hashStaffInvitationToken } from "../../src/modules/tournament-staff/staff.service.js";

const url = process.env.OTT_D10B_TEST_DATABASE_URL;
const OWNER = "d10b-owner";
const REFEREE = "d10b-referee";
const PLAYER_A = "d10b-player-a";
const PLAYER_B = "d10b-player-b";
const UNIT = "d10b-unit";
const CONTRACT = "d10b-contract";
const ACTOR = { userId: OWNER, role: "TOURNAMENT_ADMIN" as const };
const envelope = ContractPolicyEnvelopeSchema.parse({
  allowedModes: ["HUMAN_ONLINE"], turnSecondsMin: 10, turnSecondsMax: 60,
  totalMatchSecondsMin: 120, totalMatchSecondsMax: 1800, turnLimitMin: 40, turnLimitMax: 240,
  allowedNoProgressPlies: [40, 60], allowedRepetitionThresholds: [3],
  allowedTieBreakPolicies: ["RANDOM_SEEDED"],
});

function coreConfig(code: string) {
  return {
    tournamentCode: code, tournamentName: code, shortDescription: "D10-B", organizersText: "D10-B",
    competitionMode: "HUMAN_ONLINE", audienceScope: "PUBLIC_REGISTERED", allowedUnitCodes: [],
    registrationIntakeMode: "IMPORT_ONLY", maxParticipants: 4, minParticipantsToStart: 2,
    timezone: "Asia/Ho_Chi_Minh", registrationOpenAt: null, registrationCloseAt: null,
    checkinRequired: false, checkinOpenAt: null, checkinCloseAt: null,
    scheduledStartAt: "2026-10-23T12:00:00.000Z", scheduledEndAt: "2026-10-23T18:00:00.000Z",
    format: "ARENA_CONTINUOUS", pairingMethod: "SWISS_SCORE_ADJACENT", maxMatchesPerPlayer: null,
    maxPairMeetings: 2, rematchCooldownMinutes: 5, maxConcurrentMatches: 2, byeScorePoints: 0,
    spectatorPolicy: "PUBLIC_WATCH", chatPolicy: "ENABLED", leaderboardVisibility: "LIVE_PUBLIC",
    topNExportCount: 3, finalizationMode: "AUTO_FINAL", scoringFormulaPreset: "ELO_WEIGHTED_V1",
    initialScore: 1000, initialElo: 1000, kFactor: 32, scoreFloor: 0, botDeadlineAt: null,
    refereeRequired: true, minReadyOnlineReferees: 1,
  };
}

function storeContract() {
  return {
    id: CONTRACT, contractCode: "D10B-CONTRACT", unitId: UNIT, status: "ACTIVE",
    validFrom: "2026-01-01T00:00:00.000Z", validTo: "2027-01-01T00:00:00.000Z",
    maxTournamentsTotal: 20, quotaReservedCount: 0, quotaConsumedCount: 0,
    maxParticipantsPerTournament: 4, maxParticipantsTotal: 100, allowedModes: ["HUMAN_ONLINE"],
    policyEnvelope: envelope, technicalCaps: {}, taBindings: [{ id: "d10b-binding", userId: OWNER, status: "ACTIVE" }],
  };
}

describe.skipIf(!url)("D10-B real PostgreSQL lifecycle boundary", () => {
  let db: PrismaClient;
  const now = new Date("2026-10-23T08:00:00.000Z");

  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url! });
    await db.user.createMany({ data: [
      { id: OWNER, username: "d10b_owner", usernameNormalized: "d10b_owner", fullName: "D10-B owner", displayName: "D10-B owner", passwordHash: "!unclaimed", recoveryCodeHash: "!unclaimed" },
      { id: REFEREE, username: "d10b_referee", usernameNormalized: "d10b_referee", fullName: "D10-B referee", displayName: "D10-B referee", passwordHash: "!unclaimed", recoveryCodeHash: "!unclaimed" },
      { id: PLAYER_A, username: "d10b_player_a", usernameNormalized: "d10b_player_a", fullName: "D10-B player A", displayName: "D10-B player A", passwordHash: "!unclaimed", recoveryCodeHash: "!unclaimed" },
      { id: PLAYER_B, username: "d10b_player_b", usernameNormalized: "d10b_player_b", fullName: "D10-B player B", displayName: "D10-B player B", passwordHash: "!unclaimed", recoveryCodeHash: "!unclaimed" },
    ] });
    await db.unit.create({ data: { id: UNIT, unitCode: "D10B", unitName: "D10-B", unitType: "CLB", contactName: "D10-B", contactEmail: "d10b@example.invalid" } });
    await db.tournamentContract.create({
      data: {
        id: CONTRACT, contractCode: "D10B-CONTRACT", unitId: UNIT,
        validFrom: new Date("2026-01-01"), validTo: new Date("2027-01-01"),
        maxTournamentsTotal: 20, maxParticipantsPerTournament: 4, maxParticipantsTotal: 100,
        allowedModes: ["HUMAN_ONLINE"], policyEnvelope: envelope, technicalCaps: {},
        taBindings: { create: { id: "d10b-binding", userId: OWNER, username: "d10b_owner", displayName: "D10-B owner", grantedByUserId: OWNER, status: "ACTIVE" } },
      },
    });
  });

  afterAll(async () => { await db?.$disconnect(); });

  async function seed(
    id: string,
    options: { activeReferee?: boolean; withAcknowledgements?: boolean } = {},
  ) {
    const versionId = `${id}-version-1`;
    const config = coreConfig(id.toUpperCase());
    await db.tournament.create({ data: {
      id, tournamentCode: id.toUpperCase(), contractId: CONTRACT, unitId: UNIT, ownerTaUserId: OWNER,
      status: "APPROVED", revision: 1, coreConfig: config, ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
      activeConfigVersionId: versionId, activeConfigVersionNumber: 1,
    } });
    await db.tournamentConfigVersionRecord.create({ data: {
      id: versionId, tournamentId: id, versionNumber: 1,
      coreConfigSnapshot: { rulesAckRequired: true, regulationsFull: `D10-B regulations ${id}`, rulesQuickSummary: "D10-B" },
      ruleProfileSnapshot: DEFAULT_TOURNAMENT_RULE_PROFILE, effectiveAt: new Date("2026-01-01"),
      publishedByUserId: OWNER, changeSummary: "D10-B fixture",
    } });
    await db.tournamentEnrollmentRecord.createMany({ data: [
      { id: `${id}-enr-a`, tournamentId: id, contractId: CONTRACT, personKey: `${id}-a`, userId: PLAYER_A, displayName: "A", unitCode: "D10B", eligibilityStatus: "ELIGIBLE" },
      { id: `${id}-enr-b`, tournamentId: id, contractId: CONTRACT, personKey: `${id}-b`, userId: PLAYER_B, displayName: "B", unitCode: "D10B", eligibilityStatus: "ELIGIBLE" },
    ] });
    if (options.withAcknowledgements !== false) {
      await db.tournamentRulesAcknowledgement.createMany({ data: [
        { id: `${id}-ack-a`, userId: PLAYER_A, contractId: CONTRACT, tournamentId: id, configVersionId: versionId },
        { id: `${id}-ack-b`, userId: PLAYER_B, contractId: CONTRACT, tournamentId: id, configVersionId: versionId },
      ] });
    }
    const invitationId = `${id}-invitation`;
    const assignmentId = `${id}-assignment`;
    const rawInvitationToken = id === "d10b-accept-race" ? "a".repeat(64) : `${id}-raw-token`;
    await db.tournamentStaffInvitation.create({ data: {
      id: invitationId, tournamentId: id, contractId: CONTRACT, recipientUserId: REFEREE,
      role: "REFEREE", status: options.activeReferee === false ? "INVITED" : "ACTIVE",
      tokenHash: hashStaffInvitationToken(rawInvitationToken), idempotencyKey: `${id}-staff`, inviterUserId: OWNER,
      expiresAt: new Date("2026-12-01"), acceptedAt: options.activeReferee === false ? null : now,
    } });
    await db.tournamentStaffAssignmentRecord.create({ data: {
      id: assignmentId, tournamentId: id, userId: REFEREE, role: "REFEREE",
      status: options.activeReferee === false ? "INVITED" : "ACTIVE", invitationId,
    } });

    const bundle = createTournamentRuntimeBundle({
      database: db,
      acknowledgementGuard: new PrismaTournamentAcknowledgementGuard(db),
    });
    bundle.store.contracts.set(CONTRACT, storeContract() as any);
    bundle.store.tournaments.set(id, TournamentDtoSchema.parse({
      id, tournamentCode: id.toUpperCase(), contractCode: "D10B-CONTRACT", contractId: CONTRACT, unitId: UNIT, ownerTaUserId: OWNER,
      status: "APPROVED", revision: 1, coreConfig: config, ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
      activeConfigVersionId: versionId, activeConfigVersionNumber: 1, approvedSnapshot: null,
      everApproved: true, quotaRefunded: false, submittedAt: now.toISOString(), approvedAt: now.toISOString(),
      rejectedAt: null, changesRequestedAt: null, lastReviewNote: null, lastReviewFieldNotes: {},
      startedAt: null, pausedAt: null, pauseReason: null, endedAt: null, cancelledAt: null, cancelReason: null,
      finalizedAt: null, copiedFromTournamentId: null, createdAt: now.toISOString(), updatedAt: now.toISOString(),
    }));
    return { bundle, versionId, assignmentId };
  }

  it("serializes concurrent starts into one durable transition and one audit", async () => {
    const f = await seed("d10b-concurrent-start");
    const actor = f.bundle.store.resolveAuthoritativeActor({ userId: OWNER });
    const results = await Promise.allSettled([
      f.bundle.lifecycleService.startRunning(actor, "d10b-concurrent-start"),
      f.bundle.lifecycleService.startRunning(actor, "d10b-concurrent-start"),
      f.bundle.lifecycleService.startRunning(actor, "d10b-concurrent-start"),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(2);
    expect((await db.tournament.findUniqueOrThrow({ where: { id: "d10b-concurrent-start" } })).status).toBe("RUNNING");
    expect(await db.tournamentAuditLogRecord.count({ where: { targetId: "d10b-concurrent-start", action: "TOURNAMENT_STARTED" } })).toBe(1);
    const audit = await db.tournamentAuditLogRecord.findMany({ where: { targetId: "d10b-concurrent-start", action: "TOURNAMENT_STARTED" }, select: { beforeSnapshot: true, afterSnapshot: true, reason: true } });
    expect(JSON.stringify(audit)).not.toMatch(/rawToken|password|credentialHash|tokenHash/i);
  });

  it("re-enters authoritative validation after a serialization conflict", async () => {
    const f = await seed("d10b-serialization-retry");
    const actor = f.bundle.store.resolveAuthoritativeActor({ userId: OWNER });
    const original = db.$transaction.bind(db);
    let conflict = true;
    (db as any).$transaction = async (callback: any, options?: any) => {
      if (conflict) {
        conflict = false;
        const error = new Error("D10B_SERIALIZATION_CONFLICT") as Error & { code?: string };
        error.code = "P2034";
        throw error;
      }
      return original(callback, options);
    };
    try {
      await expect(f.bundle.lifecycleService.startRunning(actor, "d10b-serialization-retry")).resolves.toMatchObject({ status: "RUNNING" });
      expect((await db.tournament.findUniqueOrThrow({ where: { id: "d10b-serialization-retry" } })).status).toBe("RUNNING");
      expect(await db.tournamentAuditLogRecord.count({ where: { targetId: "d10b-serialization-retry", action: "TOURNAMENT_STARTED" } })).toBe(1);
    } finally {
      (db as any).$transaction = original;
    }
  });

  it("orders start against referee revoke at the shared advisory-lock boundary", async () => {
    const f = await seed("d10b-revoke-race");
    const actor = f.bundle.store.resolveAuthoritativeActor({ userId: OWNER });
    const staff = new TournamentStaffService(db);
    const [start, revoke] = await Promise.allSettled([
      f.bundle.lifecycleService.startRunning(actor),
      staff.revokeAssignment(ACTOR, "d10b-revoke-race", f.assignmentId),
    ]);
    const tournament = await db.tournament.findUniqueOrThrow({ where: { id: "d10b-revoke-race" } });
    const assignment = await db.tournamentStaffAssignmentRecord.findUniqueOrThrow({ where: { id: f.assignmentId } });
    if (start.status === "fulfilled") {
      expect(tournament.status).toBe("RUNNING");
      expect(assignment.status).toBe("REVOKED");
      expect(await db.tournamentAuditLogRecord.count({ where: { targetId: "d10b-revoke-race", action: "TOURNAMENT_STARTED" } })).toBe(1);
    } else {
      expect(tournament.status).toBe("APPROVED");
      expect(assignment.status).toBe("REVOKED");
      expect(await db.tournamentAuditLogRecord.count({ where: { targetId: "d10b-revoke-race", action: "TOURNAMENT_STARTED" } })).toBe(0);
    }
    expect(revoke.status).toBe("fulfilled");
  });

  it("fails closed when the authoritative config version changes during start", async () => {
    const f = await seed("d10b-ack-race");
    await db.tournamentConfigVersionRecord.create({ data: {
      id: "d10b-ack-race-version-2", tournamentId: "d10b-ack-race", versionNumber: 2,
      coreConfigSnapshot: { rulesAckRequired: true, regulationsFull: "D10-B version 2", rulesQuickSummary: "v2" },
      ruleProfileSnapshot: DEFAULT_TOURNAMENT_RULE_PROFILE, effectiveAt: new Date("2026-10-23T09:00:00.000Z"),
      publishedByUserId: OWNER, changeSummary: "D10-B version race",
    } });
    const actor = f.bundle.store.resolveAuthoritativeActor({ userId: OWNER });
    const update = db.tournament.update({ where: { id: "d10b-ack-race" }, data: { activeConfigVersionId: "d10b-ack-race-version-2", activeConfigVersionNumber: 2 } });
    const start = f.bundle.lifecycleService.startRunning(actor, "d10b-ack-race");
    const [updated, started] = await Promise.allSettled([update, start]);
    expect(updated.status).toBe("fulfilled");
    if (started.status === "rejected") {
      expect(started.reason).toMatchObject({ statusCode: 409, details: { reason: "STALE_RULE_VERSION" } });
      expect((await db.tournament.findUniqueOrThrow({ where: { id: "d10b-ack-race" } })).status).toBe("APPROVED");
      expect(await db.tournamentAuditLogRecord.count({ where: { targetId: "d10b-ack-race", action: "TOURNAMENT_STARTED" } })).toBe(0);
    } else {
      // The lifecycle transaction acquired the advisory boundary first; the
      // version update then happened after a valid v1 transition.
      expect((await db.tournament.findUniqueOrThrow({ where: { id: "d10b-ack-race" } })).status).toBe("RUNNING");
      expect(await db.tournamentAuditLogRecord.count({ where: { targetId: "d10b-ack-race", action: "TOURNAMENT_STARTED" } })).toBe(1);
    }
  });

  it("rolls back durable lifecycle and audit on an injected pre-commit failure", async () => {
    const f = await seed("d10b-rollback");
    const actor = f.bundle.store.resolveAuthoritativeActor({ userId: OWNER });
    const original = db.$transaction.bind(db);
    (db as any).$transaction = async (callback: any, options?: any) => original(async (tx: any) => {
      await callback(tx);
      throw new Error("D10B_FAIL_BEFORE_COMMIT");
    }, options);
    try {
      await expect(f.bundle.lifecycleService.startRunning(actor, "d10b-rollback")).rejects.toThrow("D10B_FAIL_BEFORE_COMMIT");
      expect((await db.tournament.findUniqueOrThrow({ where: { id: "d10b-rollback" } })).status).toBe("APPROVED");
      expect(await db.tournamentAuditLogRecord.count({ where: { targetId: "d10b-rollback", action: "TOURNAMENT_STARTED" } })).toBe(0);
      expect(f.bundle.store.tournaments.get("d10b-rollback")?.status).toBe("APPROVED");
    } finally {
      (db as any).$transaction = original;
    }
  });

  it("replays safely after durable success with a lost response", async () => {
    const f = await seed("d10b-ambiguous");
    const actor = f.bundle.store.resolveAuthoritativeActor({ userId: OWNER });
    const original = db.$transaction.bind(db);
    let lose = true;
    (db as any).$transaction = async (callback: any, options?: any) => {
      const result = await original(callback, options);
      if (lose) {
        lose = false;
        const error = new Error("D10B_RESPONSE_LOST_AFTER_COMMIT") as Error & { committed?: boolean };
        error.committed = true;
        throw error;
      }
      return result;
    };
    try {
      await expect(f.bundle.lifecycleService.startRunning(actor, "d10b-ambiguous")).rejects.toThrow("D10B_RESPONSE_LOST_AFTER_COMMIT");
      expect((await db.tournament.findUniqueOrThrow({ where: { id: "d10b-ambiguous" } })).status).toBe("RUNNING");
      await expect(f.bundle.lifecycleService.startRunning(actor, "d10b-ambiguous")).rejects.toMatchObject({ details: { reason: "READINESS_BLOCKED" } });
      expect(await db.tournamentAuditLogRecord.count({ where: { targetId: "d10b-ambiguous", action: "TOURNAMENT_STARTED" } })).toBe(1);
    } finally {
      (db as any).$transaction = original;
    }
  });

  it("keeps foreign ACK and referee state from satisfying this tournament", async () => {
    const f = await seed("d10b-foreign", { activeReferee: false, withAcknowledgements: false });
    const actor = f.bundle.store.resolveAuthoritativeActor({ userId: OWNER });
    await expect(f.bundle.lifecycleService.startRunning(actor, "d10b-foreign")).rejects.toMatchObject({ statusCode: 409 });
    expect((await db.tournament.findUniqueOrThrow({ where: { id: "d10b-foreign" } })).status).toBe("APPROVED");
    expect(await db.tournamentAuditLogRecord.count({ where: { targetId: "d10b-foreign", action: "TOURNAMENT_STARTED" } })).toBe(0);
  });

  it("rejects a foreign-tournament ACK even when local participant/referee readiness passes", async () => {
    const f = await seed("d10b-foreign-ack-target", { activeReferee: true, withAcknowledgements: false });
    await db.tournament.create({ data: {
      id: "d10b-foreign-ack-source", tournamentCode: "D10B-FOREIGN-ACK-SOURCE", contractId: CONTRACT, unitId: UNIT, ownerTaUserId: OWNER,
      status: "APPROVED", coreConfig: coreConfig("D10B-FOREIGN-ACK-SOURCE"), ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
      activeConfigVersionId: "d10b-foreign-ack-source-version", activeConfigVersionNumber: 1,
    } });
    await db.tournamentConfigVersionRecord.create({ data: {
      id: "d10b-foreign-ack-source-version", tournamentId: "d10b-foreign-ack-source", versionNumber: 1,
      coreConfigSnapshot: { rulesAckRequired: true, regulationsFull: "foreign", rulesQuickSummary: "foreign" },
      ruleProfileSnapshot: DEFAULT_TOURNAMENT_RULE_PROFILE, effectiveAt: new Date("2026-01-01"), publishedByUserId: OWNER, changeSummary: "foreign",
    } });
    await db.tournamentEnrollmentRecord.create({ data: {
      id: "d10b-foreign-ack-source-enrollment", tournamentId: "d10b-foreign-ack-source", contractId: CONTRACT,
      personKey: "foreign-player", userId: PLAYER_A, displayName: "Foreign", unitCode: "D10B", eligibilityStatus: "ELIGIBLE",
    } });
    await db.tournamentRulesAcknowledgement.create({ data: {
      id: "d10b-foreign-ack-source-ack", userId: PLAYER_A, contractId: CONTRACT, tournamentId: "d10b-foreign-ack-source", configVersionId: "d10b-foreign-ack-source-version",
    } });
    const actor = f.bundle.store.resolveAuthoritativeActor({ userId: OWNER });
    await expect(f.bundle.lifecycleService.startRunning(actor, "d10b-foreign-ack-target")).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: "RULES_ACK_REQUIRED" },
    });
    expect((await db.tournament.findUniqueOrThrow({ where: { id: "d10b-foreign-ack-target" } })).status).toBe("APPROVED");
    expect(await db.tournamentAuditLogRecord.count({ where: { targetId: "d10b-foreign-ack-target", action: "TOURNAMENT_STARTED" } })).toBe(0);
  });

  it("serializes concurrent referee acceptance into one ACTIVE assignment", async () => {
    const f = await seed("d10b-accept-race", { activeReferee: false });
    const staff = new TournamentStaffService(db);
    const token = "a".repeat(64);
    const results = await Promise.allSettled([
      staff.acceptInvitation({ userId: REFEREE }, { tournamentId: "d10b-accept-race", token }),
      staff.acceptInvitation({ userId: REFEREE }, { tournamentId: "d10b-accept-race", token }),
    ]);
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    expect(results.filter((result) => result.status === "fulfilled" && !(result.value as any).replayed)).toHaveLength(1);
    expect((await db.tournamentStaffAssignmentRecord.findUniqueOrThrow({ where: { id: f.assignmentId } })).status).toBe("ACTIVE");
    expect(await db.tournamentAuditLogRecord.count({ where: { targetId: "d10b-accept-race-invitation", action: "STAFF_INVITATION_ACCEPTED" } })).toBe(1);
  });
});
