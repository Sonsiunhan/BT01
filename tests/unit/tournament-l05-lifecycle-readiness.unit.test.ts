import { describe, expect, it } from "vitest";
import {
  ContractPolicyEnvelopeSchema,
  DEFAULT_TOURNAMENT_RULE_PROFILE,
  type TournamentDto,
} from "@ottv2/contracts";
import {
  createTournamentRuntimeBundle,
  type TournamentRuntimeBundle,
} from "../../apps/server/src/modules/tournament-core/index.js";

const SAMPLE_ENVELOPE = ContractPolicyEnvelopeSchema.parse({
  allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
  turnSecondsMin: 10,
  turnSecondsMax: 60,
  totalMatchSecondsMin: 120,
  totalMatchSecondsMax: 1800,
  turnLimitMin: 40,
  turnLimitMax: 240,
  allowedNoProgressPlies: [40, 60, 80],
  allowedRepetitionThresholds: [3, 4],
  allowedTieBreakPolicies: [
    "RANDOM_SEEDED",
    "BLUE_ADVANTAGE",
    "RED_ADVANTAGE",
    "REPLAY_ONCE_THEN_SEEDED",
    "MANUAL_REFEREE",
  ],
});

function createSeededL05Fixture(initialIso = "2026-10-22T08:00:00.000Z") {
  let currentIso = initialIso;
  const bundle = createTournamentRuntimeBundle({
    clockFn: () => new Date(currentIso),
  });
  const setNow = (nextIso: string) => {
    currentIso = nextIso;
  };

  bundle.store.grantSystemRole("admin-sys", "ADMIN");
  const adminActor = bundle.store.resolveAuthoritativeActor({
    userId: "admin-sys",
    username: "sysadmin",
  });

  return { bundle, setNow, adminActor };
}

describe("L05 — Lifecycle, ChangeRequest & Authoritative Readiness Aggregate", () => {
  async function setupApprovedTournament(
    fixture: ReturnType<typeof createSeededL05Fixture>,
    options?: {
      competitionMode?: "HUMAN_ONLINE" | "BOT_VS_BOT";
      refereeRequired?: boolean;
      minReadyOnlineReferees?: number;
      minParticipantsToStart?: number;
    }
  ): Promise<{ tournament: TournamentDto; taActor: any; contract: any }> {
    const { bundle, adminActor } = fixture;
    const randSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const unit = await bundle.unitContractService.createUnit(adminActor, {
      unitCode: `UNIT_${randSuffix}`,
      unitName: "Đơn vị khảo thí",
      unitType: "KHOA",
      contactName: "Trưởng ban A",
      contactEmail: "admin@example.edu.vn",
      status: "ACTIVE",
    });

    const contract = await bundle.unitContractService.createContract(adminActor, {
      contractCode: `HD_${randSuffix}`,
      unitId: unit.id,
      validFrom: "2026-10-01T00:00:00.000Z",
      validTo: "2026-12-31T23:59:59.000Z",
      maxTournamentsTotal: 10,
      maxParticipantsPerTournament: 16,
      maxParticipantsTotal: 30,
      allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
      policyEnvelope: SAMPLE_ENVELOPE,
      technicalCaps: {
        botSourceMaxBytes: 65536,
        botRuntimeTimeoutMs: 1000,
        botMemoryLimitMb: 64,
        maxConcurrentMatchesPerTournament: 8,
        rosterImportMaxRows: 2000,
      },
      status: "ACTIVE",
      initialTaUserIds: ["ta-l05"],
    });

    const taActor = bundle.store.resolveAuthoritativeActor({ userId: "ta-l05" });

    const draft = await bundle.coreDraftService.createDraft(taActor, {
      contractId: contract.id,
      coreConfig: {
        tournamentCode: `CODE_${randSuffix}`,
        tournamentName: "Giải Đấu L05",
        shortDescription: "Mô tả giải đấu L05",
        organizersText: "Ban Tổ Chức",
        competitionMode: options?.competitionMode ?? "HUMAN_ONLINE",
        audienceScope: "PUBLIC_REGISTERED",
        allowedUnitCodes: [],
        registrationIntakeMode: "IMPORT_ONLY",
        maxParticipants: 16,
        minParticipantsToStart: options?.minParticipantsToStart ?? 2,
        timezone: "Asia/Ho_Chi_Minh",
        registrationOpenAt: null,
        registrationCloseAt: null,
        checkinRequired: false,
        checkinOpenAt: null,
        checkinCloseAt: null,
        scheduledStartAt: "2026-10-22T12:00:00.000Z",
        scheduledEndAt: "2026-10-22T18:00:00.000Z",
        format: "ARENA_CONTINUOUS",
        pairingMethod: "SWISS_SCORE_ADJACENT",
        maxMatchesPerPlayer: null,
        maxPairMeetings: 2,
        rematchCooldownMinutes: 5,
        maxConcurrentMatches: 4,
        byeScorePoints: 0,
        spectatorPolicy: "PUBLIC_WATCH",
        chatPolicy: "ENABLED",
        leaderboardVisibility: "LIVE_PUBLIC",
        topNExportCount: 3,
        finalizationMode: "AUTO_FINAL",
        scoringFormulaPreset: "ELO_WEIGHTED_V1",
        initialScore: 1000,
        initialElo: 1000,
        kFactor: 32,
        scoreFloor: 0,
        botDeadlineAt: null,
        refereeRequired: options?.refereeRequired ?? false,
        minReadyOnlineReferees: options?.minReadyOnlineReferees ?? 1,
      },
      ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
    });

    const submitted = await bundle.coreDraftService.submitDraft(taActor, draft.id, {
      expectedRevision: draft.revision,
    });

    const approved = await bundle.approvalService.decideInitialApproval(
      adminActor,
      draft.id,
      {
        decision: "APPROVE",
        expectedRevision: submitted.revision,
        note: "Hồ sơ hợp lệ, phê duyệt giải.",
      }
    );

    return { tournament: approved, taActor, contract };
  }

  it("T025 / Q1: Readiness aggregate authoritatively computes readinessState without fake READY", async () => {
    const fixture = createSeededL05Fixture();
    const { tournament, taActor } = await setupApprovedTournament(fixture, {
      minParticipantsToStart: 2,
    });

    // 1. Initial approved state: zero enrolled participants -> NOT_READY
    const r1 = fixture.bundle.lifecycleService.evaluateReadiness(tournament.id);
    expect(r1.status).toBe("APPROVED");
    expect(r1.canOpenScheduled).toBe(true);
    expect(r1.canStartRunning).toBe(false);
    expect(r1.readinessState).toBe("NOT_READY");
    expect(r1.blockers).toContain("INSUFFICIENT_ELIGIBLE_PARTICIPANTS");

    // 2. Q2 rule: enroll participant without userId (unclaimed / unactivated) -> NOT counted toward eligible count!
    fixture.bundle.store.enrollments.set("enr-1", {
      id: "enr-1",
      tournamentId: tournament.id,
      contractId: tournament.contractId,
      personKey: "P01",
      userId: null, // Unactivated account
      displayName: "Nguyễn Chưa Kích Hoạt",
      unitCode: "UNIT_1",
      email: null,
      seedRating: 1000,
      eligibilityStatus: "ELIGIBLE",
      checkedInAt: null,
      pinnedBotRevisionId: null,
      botReadinessStatus: "NOT_REQUIRED",
      createdAt: fixture.bundle.store.nowIso(),
      updatedAt: fixture.bundle.store.nowIso(),
    });

    const r2 = fixture.bundle.lifecycleService.evaluateReadiness(tournament.id);
    expect(r2.eligibleParticipantsCount).toBe(0);
    expect(r2.readinessState).toBe("NOT_READY");

    // 3. Link account (userId is set) -> counted as eligible
    await fixture.bundle.coreDraftService.enrollParticipant(taActor, tournament.id, {
      personKey: "P02",
      userId: "user-active-1",
      displayName: "Thí Sinh 1",
      unitCode: "UNIT_1",
    });
    await fixture.bundle.coreDraftService.enrollParticipant(taActor, tournament.id, {
      personKey: "P03",
      userId: "user-active-2",
      displayName: "Thí Sinh 2",
      unitCode: "UNIT_1",
    });

    const r3 = fixture.bundle.lifecycleService.evaluateReadiness(tournament.id);
    expect(r3.eligibleParticipantsCount).toBe(2);
    expect(r3.canStartRunning).toBe(true);
    expect(r3.blockers).toHaveLength(0);
    expect(r3.readinessState).toBe("READY");
  });

  it("T025 / Q5: Enforces referee gate when refereeRequired is enabled", async () => {
    const fixture = createSeededL05Fixture();
    const { tournament, taActor } = await setupApprovedTournament(fixture, {
      refereeRequired: true,
      minReadyOnlineReferees: 2,
      minParticipantsToStart: 2,
    });

    await fixture.bundle.coreDraftService.enrollParticipant(taActor, tournament.id, {
      personKey: "P01",
      userId: "user-1",
      displayName: "Người chơi 1",
      unitCode: "U1",
    });
    await fixture.bundle.coreDraftService.enrollParticipant(taActor, tournament.id, {
      personKey: "P02",
      userId: "user-2",
      displayName: "Người chơi 2",
      unitCode: "U1",
    });

    // Zero active referees -> BLOCKED on INSUFFICIENT_ACCEPTED_REFEREES
    const r1 = fixture.bundle.lifecycleService.evaluateReadiness(tournament.id);
    expect(r1.canStartRunning).toBe(false);
    expect(r1.blockers).toContain("INSUFFICIENT_ACCEPTED_REFEREES");
    expect(r1.readinessState).toBe("NOT_READY");

    // Add 1 referee (still < 2)
    fixture.bundle.store.staffAssignments.set("staff-1", {
      id: "staff-1",
      tournamentId: tournament.id,
      userId: "ref-1",
      role: "REFEREE",
      status: "ACTIVE",
      assignedRooms: [],
      createdAt: fixture.bundle.store.nowIso(),
      updatedAt: fixture.bundle.store.nowIso(),
    });

    const r2 = fixture.bundle.lifecycleService.evaluateReadiness(tournament.id);
    expect(r2.activeRefereeCount).toBe(1);
    expect(r2.blockers).toContain("INSUFFICIENT_ACCEPTED_REFEREES");
    expect(r2.readinessState).toBe("NOT_READY");

    // Add 2nd referee -> passes referee gate -> READY
    fixture.bundle.store.staffAssignments.set("staff-2", {
      id: "staff-2",
      tournamentId: tournament.id,
      userId: "ref-2",
      role: "REFEREE",
      status: "ACTIVE",
      assignedRooms: [],
      createdAt: fixture.bundle.store.nowIso(),
      updatedAt: fixture.bundle.store.nowIso(),
    });

    const r3 = fixture.bundle.lifecycleService.evaluateReadiness(tournament.id);
    expect(r3.activeRefereeCount).toBe(2);
    expect(r3.blockers).not.toContain("INSUFFICIENT_ACCEPTED_REFEREES");
    expect(r3.canStartRunning).toBe(true);
    expect(r3.readinessState).toBe("READY");
  });

  it("T024 / BR-07: ChangeRequest lifecycle, cancellation, and validation guard on approval", async () => {
    const fixture = createSeededL05Fixture();
    const { tournament, taActor } = await setupApprovedTournament(fixture);

    // 1. Create a separate ChangeRequest
    const cr = await fixture.bundle.lifecycleService.createChangeRequest(
      taActor,
      tournament.id,
      {
        reason: "Đề nghị mở rộng số lượng thí sinh",
        effectiveAt: "2026-10-22T10:00:00.000Z",
        proposedCoreConfigPatch: { maxConcurrentMatches: 6 },
      }
    );
    expect(cr.status).toBe("PENDING");
    // BR-07: Tournament status does NOT revert to UNDER_REVIEW
    expect(fixture.bundle.coreDraftService.getTournament(tournament.id).status).toBe(
      "APPROVED"
    );

    // 2. TA can cancel their own PENDING ChangeRequest
    const cancelled = await fixture.bundle.lifecycleService.cancelChangeRequest(
      taActor,
      tournament.id,
      cr.id,
      "Hủy do không cần thiết nữa"
    );
    expect(cancelled.status).toBe("CANCELLED");

    // Cannot cancel again (must be PENDING)
    await expect(
      fixture.bundle.lifecycleService.cancelChangeRequest(
        taActor,
        tournament.id,
        cr.id
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: "INVALID_STATE_TRANSITION" },
    });

    // 3. Create another ChangeRequest with invalid semantic parameters (e.g. minParticipantsToStart > maxParticipants)
    const cr2 = await fixture.bundle.lifecycleService.createChangeRequest(
      taActor,
      tournament.id,
      {
        reason: "Thay đổi số lượng tối đa",
        effectiveAt: "2026-10-22T10:00:00.000Z",
        proposedCoreConfigPatch: { maxParticipants: 3, minParticipantsToStart: 8 },
      }
    );

    // Admin approval re-checks semantic validity and rejects with 400 VALIDATION_ERROR
    await expect(
      fixture.bundle.approvalService.decideChangeRequest(
        fixture.adminActor,
        cr2.id,
        {
          decision: "APPROVE",
          note: "Phê duyệt thay đổi cấu hình",
        }
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      details: { reason: "SEMANTIC_VALIDATION_FAILED" },
    });
  });

  it("T026: Scheduler tick evaluateScheduledStart does NOT start if blockers remain", async () => {
    const fixture = createSeededL05Fixture("2026-10-22T11:00:00.000Z");
    const { tournament, taActor } = await setupApprovedTournament(fixture, {
      minParticipantsToStart: 4,
    });

    // Open SCHEDULED
    const scheduled = await fixture.bundle.lifecycleService.openScheduled(
      taActor,
      tournament.id
    );
    expect(scheduled.status).toBe("SCHEDULED");

    // Advance clock past scheduledStartAt (12:00:00.000Z)
    fixture.setNow("2026-10-22T12:01:00.000Z");

    // 1. Blocker: 0 participants enrolled (< 4) -> evaluateScheduledStart preserves SCHEDULED
    const tick1 = await fixture.bundle.lifecycleService.evaluateScheduledStart();
    expect(tick1.startedTournaments).toHaveLength(0);
    expect(tick1.blockedTournaments.map((t) => t.id)).toContain(tournament.id);
    expect(
      fixture.bundle.coreDraftService.getTournament(tournament.id).status
    ).toBe("SCHEDULED");

    // 2. Resolve blocker: enroll 4 eligible participants
    for (let i = 1; i <= 4; i++) {
      await fixture.bundle.coreDraftService.enrollParticipant(taActor, tournament.id, {
        personKey: `P_TICK_${i}`,
        userId: `user_tick_${i}`,
        displayName: `Thí sinh ${i}`,
        unitCode: "U1",
      });
    }

    // Now all blockers resolved -> tick transitions tournament to RUNNING
    const tick2 = await fixture.bundle.lifecycleService.evaluateScheduledStart();
    expect(tick2.startedTournaments.map((t) => t.id)).toContain(tournament.id);
    expect(
      fixture.bundle.coreDraftService.getTournament(tournament.id).status
    ).toBe("RUNNING");
  });

  it("N04 / L05: TournamentVersioningAdapter executes canonical publish with CAS, envelope check and idempotency", async () => {
    const fixture = createSeededL05Fixture("2026-10-22T08:00:00.000Z");
    const { tournament, taActor } = await setupApprovedTournament(fixture);
    const adapter = fixture.bundle.versioningAdapter;

    const authContext = {
      principal: "ACCOUNT" as const,
      user: { id: "ta-l05", role: "TOURNAMENT_ADMIN" as const } as any,
    };

    // 1. List versions: initially has v1 from approval
    const listRes = await adapter.listVersions(authContext, tournament.id, {
      limit: 10,
    });
    expect(listRes.items).toHaveLength(1);
    expect(listRes.items[0]!.versionNumber).toBe(1);
    expect(listRes.items[0]!.immutable).toBe(true);

    // 2. CAS Conflict: expectedRevision doesn't match
    await expect(
      adapter.publish(
        authContext,
        {
          expectedRevision: 999,
          profileRef: { draftId: "draft-x", revision: 1 },
          profileDigest: "a".repeat(64),
          reason: "Cập nhật luật thi đấu",
          effectiveAt: "2026-10-22T09:00:00.000Z",
          idempotencyKey: "key-cas-1",
        },
        tournament.id
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: "STALE_VERSION" },
    });

    // 3. Past effectiveAt rejection
    await expect(
      adapter.publish(
        authContext,
        {
          expectedRevision: tournament.revision,
          profileRef: { draftId: "draft-x", revision: 1 },
          profileDigest: "a".repeat(64),
          reason: "Cập nhật luật thi đấu",
          effectiveAt: "2026-10-20T00:00:00.000Z", // Past date
          idempotencyKey: "key-past-1",
        },
        tournament.id
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      details: { reason: "EFFECTIVE_AT_IN_PAST" },
    });

    // 4. Valid within-envelope publish
    const publishRes = await adapter.publish(
      authContext,
      {
        expectedRevision: tournament.revision,
        profileRef: { draftId: "draft-x", revision: 2 },
        profileDigest: "b".repeat(64),
        reason: "Cập nhật luật thi đấu trong phạm vi hợp đồng",
        effectiveAt: "2026-10-22T10:00:00.000Z",
        idempotencyKey: "key-publish-1",
      },
      tournament.id
    );
    expect(publishRes.outcome).toBe("PUBLISHED");
    if (publishRes.outcome === "PUBLISHED") {
      expect(publishRes.version.versionNumber).toBe(2);
      expect(publishRes.version.immutable).toBe(true);
    }

    // 5. Idempotent replay: sending the exact same payload returns identical result
    const replayRes = await adapter.publish(
      authContext,
      {
        expectedRevision: tournament.revision,
        profileRef: { draftId: "draft-x", revision: 2 },
        profileDigest: "b".repeat(64),
        reason: "Cập nhật luật thi đấu trong phạm vi hợp đồng",
        effectiveAt: "2026-10-22T10:00:00.000Z",
        idempotencyKey: "key-publish-1",
      },
      tournament.id
    );
    expect(replayRes).toEqual(publishRes);

    // 6. Idempotency conflict: same key with different payload -> 409 CONFLICT
    await expect(
      adapter.publish(
        authContext,
        {
          expectedRevision: tournament.revision,
          profileRef: { draftId: "draft-other", revision: 9 },
          profileDigest: "c".repeat(64),
          reason: "Lý do khác",
          effectiveAt: "2026-10-22T10:00:00.000Z",
          idempotencyKey: "key-publish-1",
        },
        tournament.id
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: "IDEMPOTENCY_CONFLICT" },
    });
  });
});
