import { describe, expect, it } from "vitest";
import {
  ContractPolicyEnvelopeSchema,
  DEFAULT_TOURNAMENT_RULE_PROFILE,
} from "@ottv2/contracts";
import { TournamentLifecycleService } from "../../apps/server/src/modules/tournament-core/lifecycle.service.js";
import { createTournamentRuntimeBundle } from "../../apps/server/src/modules/tournament-core/index.js";

const envelope = ContractPolicyEnvelopeSchema.parse({
  allowedModes: ["HUMAN_ONLINE"],
  turnSecondsMin: 10, turnSecondsMax: 60,
  totalMatchSecondsMin: 120, totalMatchSecondsMax: 1800,
  turnLimitMin: 40, turnLimitMax: 240,
  allowedNoProgressPlies: [40, 60], allowedRepetitionThresholds: [3],
  allowedTieBreakPolicies: ["RANDOM_SEEDED"],
});

async function fixture() {
  const bundle = createTournamentRuntimeBundle({ clockFn: () => new Date("2026-10-23T08:00:00.000Z") });
  bundle.store.grantSystemRole("admin", "ADMIN");
  const admin = bundle.store.resolveAuthoritativeActor({ userId: "admin" });
  const unit = await bundle.unitContractService.createUnit(admin, {
    unitCode: "D10B_RACE", unitName: "D10-B race", unitType: "CLB",
    contactName: "D10-B", contactEmail: "d10b@example.invalid", status: "ACTIVE",
  });
  const contract = await bundle.unitContractService.createContract(admin, {
    contractCode: "D10B-RACE-CONTRACT", unitId: unit.id,
    validFrom: "2026-01-01T00:00:00.000Z", validTo: "2027-01-01T00:00:00.000Z",
    maxTournamentsTotal: 2, maxParticipantsPerTournament: 4, maxParticipantsTotal: 8,
    allowedModes: ["HUMAN_ONLINE"], policyEnvelope: envelope,
    technicalCaps: { botSourceMaxBytes: 65536, botRuntimeTimeoutMs: 1000, botMemoryLimitMb: 64, maxConcurrentMatchesPerTournament: 4, rosterImportMaxRows: 100 },
    status: "ACTIVE", initialTaUserIds: ["ta"],
  });
  const ta = bundle.store.resolveAuthoritativeActor({ userId: "ta" });
  const draft = await bundle.coreDraftService.createDraft(ta, {
    contractId: contract.id,
    coreConfig: {
      tournamentCode: "D10B-RACE", tournamentName: "D10-B race", shortDescription: "",
      organizersText: "D10-B", competitionMode: "HUMAN_ONLINE", audienceScope: "PUBLIC_REGISTERED",
      allowedUnitCodes: [], registrationIntakeMode: "IMPORT_ONLY", maxParticipants: 4,
      minParticipantsToStart: 2, timezone: "Asia/Ho_Chi_Minh", registrationOpenAt: null,
      registrationCloseAt: null, checkinRequired: false, checkinOpenAt: null, checkinCloseAt: null,
      scheduledStartAt: "2026-10-23T12:00:00.000Z", scheduledEndAt: "2026-10-23T18:00:00.000Z",
      format: "ARENA_CONTINUOUS", pairingMethod: "SWISS_SCORE_ADJACENT", maxMatchesPerPlayer: null,
      maxPairMeetings: 2, rematchCooldownMinutes: 5, maxConcurrentMatches: 2, byeScorePoints: 0,
      spectatorPolicy: "PUBLIC_WATCH", chatPolicy: "ENABLED", leaderboardVisibility: "LIVE_PUBLIC",
      topNExportCount: 3, finalizationMode: "AUTO_FINAL", scoringFormulaPreset: "ELO_WEIGHTED_V1",
      initialScore: 1000, initialElo: 1000, kFactor: 32, scoreFloor: 0, botDeadlineAt: null,
      refereeRequired: true, minReadyOnlineReferees: 1,
    },
    ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
  });
  const submitted = await bundle.coreDraftService.submitDraft(ta, draft.id, { expectedRevision: draft.revision });
  const tournament = await bundle.approvalService.decideInitialApproval(admin, draft.id, { decision: "APPROVE", expectedRevision: submitted.revision, note: "D10-B" });
  for (const [id, userId] of [["enr-1", "player-1"], ["enr-2", "player-2"]] as const) {
    bundle.store.enrollments.set(id, {
      id, tournamentId: tournament.id, contractId: contract.id, personKey: id,
      userId, displayName: userId, unitCode: unit.unitCode, email: null, seedRating: 1000,
      eligibilityStatus: "ELIGIBLE", checkedInAt: null, pinnedBotRevisionId: null,
      botReadinessStatus: "NOT_REQUIRED", createdAt: bundle.store.nowIso(), updatedAt: bundle.store.nowIso(),
    });
  }
  const assignment = {
    id: "assignment-1", tournamentId: tournament.id, userId: "referee-1", role: "REFEREE" as const,
    status: "ACTIVE" as const, assignedRooms: [], createdAt: bundle.store.nowIso(), updatedAt: bundle.store.nowIso(),
  };
  bundle.store.staffAssignments.set(assignment.id, assignment);
  return { bundle, tournament, ta, assignment };
}

describe("D10-B lifecycle cross-stream races", () => {
  it("blocks start when referee readiness is revoked during the ACK boundary", async () => {
    const f = await fixture();
    const guard = {
      assertReadyForStart: async () => {
        f.assignment.status = "REVOKED";
      },
    };
    const service = new TournamentLifecycleService(
      f.bundle.store,
      f.bundle.adjudicationLedgerService,
      f.bundle.readinessSourcesPort,
      guard,
    );

    await expect(service.startRunning(f.ta, f.tournament.id)).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: "READINESS_BLOCKED", blockerCode: "INSUFFICIENT_ACCEPTED_REFEREES" },
    });
    expect(f.bundle.store.tournaments.get(f.tournament.id)?.status).toBe("APPROVED");
    expect(f.bundle.store.auditRecords.filter((entry) => entry.action === "TOURNAMENT_STARTED")).toHaveLength(0);
  });

  it("serializes concurrent start attempts into one transition and one success audit", async () => {
    const f = await fixture();
    const service = new TournamentLifecycleService(
      f.bundle.store,
      f.bundle.adjudicationLedgerService,
      f.bundle.readinessSourcesPort,
    );
    const outcomes = await Promise.allSettled(
      Array.from({ length: 8 }, () => service.startRunning(f.ta, f.tournament.id)),
    );
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(7);
    expect(f.bundle.store.tournaments.get(f.tournament.id)?.status).toBe("RUNNING");
    expect(f.bundle.store.auditRecords.filter((entry) => entry.action === "TOURNAMENT_STARTED")).toHaveLength(1);
  });

  it("rolls back staged lifecycle state and audit when the transaction fails", async () => {
    const f = await fixture();
    const boundary = {
      run: async (_tournamentId: string, callback: (tx: any) => Promise<unknown>) => {
        await callback({});
        throw new Error("D10B_FAIL_BEFORE_COMMIT");
      },
    };
    const service = new TournamentLifecycleService(
      f.bundle.store,
      f.bundle.adjudicationLedgerService,
      f.bundle.readinessSourcesPort,
      undefined,
      boundary,
    );
    await expect(service.startRunning(f.ta, f.tournament.id)).rejects.toThrow("D10B_FAIL_BEFORE_COMMIT");
    expect(f.bundle.store.tournaments.get(f.tournament.id)?.status).toBe("APPROVED");
    expect(f.bundle.store.auditRecords.filter((entry) => entry.action === "TOURNAMENT_STARTED")).toHaveLength(0);
  });

  it("keeps committed state after an explicitly marked lost response and does not duplicate on retry", async () => {
    const f = await fixture();
    let calls = 0;
    const boundary = {
      run: async (_tournamentId: string, callback: (tx: any) => Promise<unknown>) => {
        calls += 1;
        const result = await callback({});
        if (calls === 1) {
          const error = new Error("D10B_RESPONSE_LOST_AFTER_COMMIT") as Error & { committed?: boolean };
          error.committed = true;
          throw error;
        }
        return result;
      },
    };
    const service = new TournamentLifecycleService(
      f.bundle.store,
      f.bundle.adjudicationLedgerService,
      f.bundle.readinessSourcesPort,
      undefined,
      boundary,
    );
    await expect(service.startRunning(f.ta, f.tournament.id)).rejects.toThrow("D10B_RESPONSE_LOST_AFTER_COMMIT");
    expect(f.bundle.store.tournaments.get(f.tournament.id)?.status).toBe("RUNNING");
    await expect(service.startRunning(f.ta, f.tournament.id)).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: "READINESS_BLOCKED" },
    });
    expect(f.bundle.store.auditRecords.filter((entry) => entry.action === "TOURNAMENT_STARTED")).toHaveLength(1);
  });
});
