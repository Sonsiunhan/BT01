import { describe, expect, it } from "vitest";
import {
  ContractPolicyEnvelopeSchema,
  DEFAULT_TOURNAMENT_RULE_PROFILE,
  type TournamentCoreConfig,
} from "@ottv2/contracts";
import {
  createTournamentRuntimeBundle,
  type TournamentRuntimeBundle,
} from "../../apps/server/src/modules/tournament-core/index.js";
import type { TournamentActorContext } from "../../apps/server/src/modules/tournament-foundation/tournament-store.js";

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

function buildCoreConfig(overrides?: Partial<TournamentCoreConfig>): TournamentCoreConfig {
  return {
    tournamentCode: "TOURNAMENT_C32",
    tournamentName: "Giải Đấu Cờ Thử Nghiệm",
    shortDescription: "",
    organizersText: "Khoa CNTT",
    competitionMode: "HUMAN_ONLINE",
    audienceScope: "PUBLIC_REGISTERED",
    allowedUnitCodes: [],
    registrationIntakeMode: "IMPORT_ONLY",
    maxParticipants: 8,
    minParticipantsToStart: 2,
    timezone: "Asia/Ho_Chi_Minh",
    registrationOpenAt: null,
    registrationCloseAt: null,
    checkinRequired: false,
    checkinOpenAt: null,
    checkinCloseAt: null,
    scheduledStartAt: "2026-11-01T08:00:00.000Z",
    scheduledEndAt: "2026-11-01T18:00:00.000Z",
    format: "ARENA_CONTINUOUS",
    pairingMethod: "SWISS_SCORE_ADJACENT",
    maxMatchesPerPlayer: null,
    maxPairMeetings: 2,
    rematchCooldownMinutes: 5,
    maxConcurrentMatches: 4,
    byeScorePoints: 0,
    spectatorPolicy: "PUBLIC_WATCH",
    chatPolicy: "SPECTATOR_MUTED",
    leaderboardVisibility: "LIVE_PUBLIC",
    topNExportCount: 2,
    finalizationMode: "AUTO_FINAL",
    scoringFormulaPreset: "ELO_WEIGHTED_V1",
    initialScore: 50,
    initialElo: 1000,
    kFactor: 32,
    scoreFloor: 0,
    botDeadlineAt: null,
    ...overrides,
  };
}

function setupL06Fixture() {
  let currentTime = new Date("2026-10-22T08:00:00.000Z");
  const clockFn = () => currentTime;
  const bundle = createTournamentRuntimeBundle({ clockFn });

  const adminActor: TournamentActorContext = {
    userId: "admin-sa-1",
    principalType: "USER",
    roles: ["ADMIN"],
  };

  const taActor: TournamentActorContext = {
    userId: "ta-owner-1",
    principalType: "USER",
    roles: ["PLAYER", "TOURNAMENT_ADMIN"],
  };

  const guestActor: TournamentActorContext = {
    userId: "guest-player-1",
    principalType: "GUEST",
    roles: ["GUEST"],
  };

  const outsideUserActor: TournamentActorContext = {
    userId: "outside-user-1",
    principalType: "USER",
    roles: ["PLAYER"],
  };

  const setNow = (iso: string) => {
    currentTime = new Date(iso);
  };

  return { bundle, setNow, adminActor, taActor, guestActor, outsideUserActor };
}

async function createStandardContract(
  bundle: TournamentRuntimeBundle,
  adminActor: TournamentActorContext,
  taActor: TournamentActorContext,
  contractCode = "HD_L06_2026"
) {
  const unit = await bundle.unitContractService.createUnit(adminActor, {
    unitCode: `UNIT_${contractCode}`,
    unitName: "CLB Cờ Khoa CNTT",
    unitType: "CLB",
    contactName: "Chủ Nhiệm CLB",
    contactEmail: "clb@example.edu.vn",
    status: "ACTIVE",
  });

  const contract = await bundle.unitContractService.createContract(adminActor, {
    contractCode,
    unitId: unit.id,
    validFrom: "2026-10-01T00:00:00.000Z",
    validTo: "2026-12-31T23:59:59.000Z",
    maxTournamentsTotal: 5,
    maxParticipantsPerTournament: 16,
    maxParticipantsTotal: 32,
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
    initialTaUserIds: [taActor.userId],
  });

  return { unit, contract };
}

describe("Task L06 — Player Admission C32 & Common Authorization Gate Unit Tests", () => {
  it("T005: Admin is strictly prohibited from participating as an Online player across all entry points, even when no tournament is running", () => {
    const { bundle, adminActor } = setupL06Fixture();

    const actions = [
      "ONLINE_QUEUE_JOIN",
      "ONLINE_ROOM_CREATE",
      "ONLINE_ROOM_JOIN_PLAYER",
      "ONLINE_SEAT_UPGRADE_TO_PLAYER",
    ] as const;

    for (const action of actions) {
      const decision = bundle.admissionGateService.evaluateAdmission({
        principalType: adminActor.principalType ?? "USER",
        principalId: adminActor.userId,
        roles: adminActor.roles,
        action,
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reasonCode).toBe("ADMIN_CANNOT_PLAY_ONLINE");

      expect(() =>
        bundle.admissionGateService.assertAdmissionAllowed({
          principalType: adminActor.principalType ?? "USER",
          principalId: adminActor.userId,
          roles: adminActor.roles,
          action,
        })
      ).toThrowError();
    }

    // T005 Invariant: Admin is still permitted for Offline local play and Spectating
    const offlineDecision = bundle.admissionGateService.evaluateAdmission({
      principalType: adminActor.principalType ?? "USER",
      principalId: adminActor.userId,
      roles: adminActor.roles,
      action: "OFFLINE_LOCAL_MATCH",
    });
    expect(offlineDecision.allowed).toBe(true);

    const spectateDecision = bundle.admissionGateService.evaluateAdmission({
      principalType: adminActor.principalType ?? "USER",
      principalId: adminActor.userId,
      roles: adminActor.roles,
      action: "SPECTATE_ROOM",
    });
    expect(spectateDecision.allowed).toBe(true);
  });

  it("T075 (C32 Gate): Enforces strict tournament window locks when a tournament is RUNNING", async () => {
    const { bundle, adminActor, taActor, guestActor, outsideUserActor } =
      setupL06Fixture();

    const { contract } = await createStandardContract(
      bundle,
      adminActor,
      taActor,
      "HD_C32_RUNNING"
    );

    const draft = await bundle.coreDraftService.createDraft(taActor, {
      contractId: contract.id,
      coreConfig: buildCoreConfig({
        tournamentCode: "C32_RUNNING_2026",
        tournamentName: "Giải Đấu Cờ Robot Quốc Gia 2026",
        checkinRequired: true,
        checkinOpenAt: "2026-11-01T07:00:00.000Z",
        checkinCloseAt: "2026-11-01T07:55:00.000Z",
      }),
      ruleProfile: {
        ...DEFAULT_TOURNAMENT_RULE_PROFILE,
        tieBreakPolicy: "MANUAL_REFEREE",
      },
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
        note: "Hợp lệ",
      }
    );

    // Enroll participants
    const enr1 = await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "PK_001",
      userId: "enrolled-checkedin-1",
      displayName: "Thí Sinh 1 Đã Checkin",
      unitCode: "CLB",
      eligibilityStatus: "ELIGIBLE",
    });
    enr1.checkedInAt = "2026-11-01T07:30:00.000Z";

    const enr2 = await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "PK_002",
      userId: "enrolled-checkedin-2",
      displayName: "Thí Sinh 2 Đã Checkin",
      unitCode: "CLB",
      eligibilityStatus: "ELIGIBLE",
    });
    enr2.checkedInAt = "2026-11-01T07:35:00.000Z";

    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "PK_003",
      userId: "enrolled-notcheckedin-3",
      displayName: "Thí Sinh 3 Chưa Checkin",
      unitCode: "CLB",
      eligibilityStatus: "ELIGIBLE",
    });

    // Start tournament -> RUNNING
    await bundle.lifecycleService.startRunning(taActor, approved.id);

    // Assertion 1: Guest is blocked from queue/room creation
    const guestDecision = bundle.admissionGateService.evaluateAdmission({
      principalType: "GUEST",
      principalId: guestActor.userId,
      roles: ["GUEST"],
      action: "ONLINE_QUEUE_JOIN",
    });
    expect(guestDecision.allowed).toBe(false);
    expect(guestDecision.reasonCode).toBe(
      "GUEST_BLOCKED_DURING_TOURNAMENT_WINDOW"
    );

    // Assertion 2: Outside User is blocked from queue/room creation
    const outsideDecision = bundle.admissionGateService.evaluateAdmission({
      principalType: "USER",
      principalId: outsideUserActor.userId,
      roles: ["PLAYER"],
      action: "ONLINE_ROOM_CREATE",
    });
    expect(outsideDecision.allowed).toBe(false);
    expect(outsideDecision.reasonCode).toBe(
      "OUTSIDE_USER_BLOCKED_DURING_TOURNAMENT_WINDOW"
    );

    // Assertion 3: Enrolled participant who did not check in is blocked
    const notCheckedInDecision = bundle.admissionGateService.evaluateAdmission({
      principalType: "USER",
      principalId: "enrolled-notcheckedin-3",
      roles: ["PLAYER"],
      action: "ONLINE_QUEUE_JOIN",
    });
    expect(notCheckedInDecision.allowed).toBe(false);
    expect(notCheckedInDecision.reasonCode).toBe("PARTICIPANT_NOT_ELIGIBLE");

    // Assertion 4: Enrolled participant who checked in is allowed
    const checkedInDecision = bundle.admissionGateService.evaluateAdmission({
      principalType: "USER",
      principalId: "enrolled-checkedin-1",
      roles: ["PLAYER"],
      action: "ONLINE_QUEUE_JOIN",
    });
    expect(checkedInDecision.allowed).toBe(true);
    expect(checkedInDecision.reasonCode).toBe("ALLOWED");

    // Assertion 5: Offline matches remain available for everyone
    expect(
      bundle.admissionGateService.evaluateAdmission({
        principalType: "GUEST",
        principalId: guestActor.userId,
        roles: ["GUEST"],
        action: "OFFLINE_LOCAL_MATCH",
      }).allowed
    ).toBe(true);
  });

  it("T075 Reconnect Invariant: Preserves in-progress match reconnection for active participants while rejecting outsiders", async () => {
    const { bundle, taActor, adminActor, outsideUserActor } = setupL06Fixture();

    const { contract } = await createStandardContract(
      bundle,
      adminActor,
      taActor,
      "HD_C32_RECONNECT"
    );

    const draft = await bundle.coreDraftService.createDraft(taActor, {
      contractId: contract.id,
      coreConfig: buildCoreConfig({
        tournamentCode: "C32_RECONN_2026",
        tournamentName: "Giải Cờ Trực Tuyến 2026",
      }),
      ruleProfile: {
        ...DEFAULT_TOURNAMENT_RULE_PROFILE,
        tieBreakPolicy: "MANUAL_REFEREE",
      },
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
        note: "Duyệt",
      }
    );

    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "P_BLUE",
      userId: "player-blue-1",
      displayName: "Đấu Thủ Xanh",
      unitCode: "CLB",
      eligibilityStatus: "ELIGIBLE",
    });

    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "P_RED",
      userId: "player-red-2",
      displayName: "Đấu Thủ Đỏ",
      unitCode: "CLB",
      eligibilityStatus: "ELIGIBLE",
    });

    await bundle.lifecycleService.startRunning(taActor, approved.id);

    const { match } = await bundle.admissionGateService.createMatchWithPinnedVersion({
      tournamentId: approved.id,
      roomId: "room-live-101",
      blueParticipantId: "player-blue-1",
      redParticipantId: "player-red-2",
      matchId: "match-live-101",
    });

    // Blue player reconnects via matchId
    const blueDecision = bundle.admissionGateService.evaluateAdmission({
      principalType: "USER",
      principalId: "player-blue-1",
      roles: ["PLAYER"],
      action: "ONLINE_RECONNECT_EXISTING_MATCH",
      matchId: match.matchId,
    });
    expect(blueDecision.allowed).toBe(true);

    // Red player reconnects via roomId
    const redDecision = bundle.admissionGateService.evaluateAdmission({
      principalType: "USER",
      principalId: "player-red-2",
      roles: ["PLAYER"],
      action: "ONLINE_RECONNECT_EXISTING_MATCH",
      roomId: match.roomId,
    });
    expect(redDecision.allowed).toBe(true);

    // Outside player attempts to reconnect into someone else's match
    const outsiderDecision = bundle.admissionGateService.evaluateAdmission({
      principalType: "USER",
      principalId: outsideUserActor.userId,
      roles: ["PLAYER"],
      action: "ONLINE_RECONNECT_EXISTING_MATCH",
      matchId: match.matchId,
    });
    expect(outsiderDecision.allowed).toBe(false);
  });

  it("PAUSED State Lock & Automatic C32 Release on Tournament End", async () => {
    const { bundle, taActor, adminActor, guestActor, outsideUserActor, setNow } =
      setupL06Fixture();

    const { contract } = await createStandardContract(
      bundle,
      adminActor,
      taActor,
      "HD_C32_PAUSED"
    );

    const draft = await bundle.coreDraftService.createDraft(taActor, {
      contractId: contract.id,
      coreConfig: buildCoreConfig({
        tournamentCode: "C32_PAUSE_2026",
        tournamentName: "Giải Cờ BK",
        scheduledEndAt: "2026-11-01T12:00:00.000Z",
      }),
      ruleProfile: {
        ...DEFAULT_TOURNAMENT_RULE_PROFILE,
        tieBreakPolicy: "MANUAL_REFEREE",
      },
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
        note: "Duyệt",
      }
    );

    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "PK_BK_1",
      userId: "bk-user-1",
      displayName: "BK 1",
      unitCode: "CLB",
      eligibilityStatus: "ELIGIBLE",
    });

    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "PK_BK_2",
      userId: "bk-user-2",
      displayName: "BK 2",
      unitCode: "CLB",
      eligibilityStatus: "ELIGIBLE",
    });

    await bundle.lifecycleService.startRunning(taActor, approved.id);

    // 1. Pause tournament -> PAUSED lock
    await bundle.lifecycleService.pauseTournament(
      taActor,
      approved.id,
      "Tạm dừng kiểm tra kỹ thuật phòng máy"
    );

    const pausedDecision = bundle.admissionGateService.evaluateAdmission({
      principalType: "USER",
      principalId: "bk-user-1",
      roles: ["PLAYER"],
      action: "ONLINE_QUEUE_JOIN",
      tournamentId: approved.id,
    });
    expect(pausedDecision.allowed).toBe(false);
    expect(pausedDecision.reasonCode).toBe("TOURNAMENT_PAUSED_NO_NEW_ADMISSION");

    // 2. Tournament auto-ends or completes -> C32 automatically releases locks
    setNow("2026-11-01T12:05:00.000Z");
    await bundle.lifecycleService.evaluateAutoEndAtWindow();

    const currentT = bundle.coreDraftService.getTournament(approved.id);
    expect(currentT.status).toBe("ENDED");

    // Guest and outside user are now allowed into public queues
    const guestPostEndDecision = bundle.admissionGateService.evaluateAdmission({
      principalType: "GUEST",
      principalId: guestActor.userId,
      roles: ["GUEST"],
      action: "ONLINE_QUEUE_JOIN",
    });
    expect(guestPostEndDecision.allowed).toBe(true);

    const outsidePostEndDecision =
      bundle.admissionGateService.evaluateAdmission({
        principalType: "USER",
        principalId: outsideUserActor.userId,
        roles: ["PLAYER"],
        action: "ONLINE_QUEUE_JOIN",
      });
    expect(outsidePostEndDecision.allowed).toBe(true);

    // But Admin remains blocked from Online play (T005 permanent invariant)
    const adminDecision = bundle.admissionGateService.evaluateAdmission({
      principalType: adminActor.principalType ?? "USER",
      principalId: adminActor.userId,
      roles: adminActor.roles,
      action: "ONLINE_QUEUE_JOIN",
    });
    expect(adminDecision.allowed).toBe(false);
    expect(adminDecision.reasonCode).toBe("ADMIN_CANNOT_PLAY_ONLINE");
  });

  it("Spectator Policy & Referee Scope (T007) Boundary Enforcement", async () => {
    const { bundle, adminActor, taActor, outsideUserActor } = setupL06Fixture();

    const { contract } = await createStandardContract(
      bundle,
      adminActor,
      taActor,
      "HD_C32_STAFF_REF"
    );

    // Tournament with spectatorPolicy = STAFF_ONLY
    const draft = await bundle.coreDraftService.createDraft(taActor, {
      contractId: contract.id,
      coreConfig: buildCoreConfig({
        tournamentCode: "C32_STAFF_2026",
        tournamentName: "Giải Cờ Kín",
        spectatorPolicy: "STAFF_ONLY",
      }),
      ruleProfile: {
        ...DEFAULT_TOURNAMENT_RULE_PROFILE,
        tieBreakPolicy: "MANUAL_REFEREE",
      },
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
        note: "Duyệt",
      }
    );

    // Assign referee 1 to ROOM_A
    bundle.store.staffAssignments.set(`${approved.id}:ref-user-1`, {
      assignmentId: "assign-ref-1",
      tournamentId: approved.id,
      userId: "ref-user-1",
      role: "REFEREE",
      status: "ACTIVE",
      assignedRooms: ["ROOM_A"],
      assignedBy: taActor.userId,
      createdAt: "2026-10-22T08:00:00.000Z",
    });

    // 1. Spectator policy: Outside user cannot spectate STAFF_ONLY tournament
    const spectateOutside = bundle.admissionGateService.evaluateAdmission({
      principalType: "USER",
      principalId: outsideUserActor.userId,
      roles: ["PLAYER"],
      action: "SPECTATE_ROOM",
      tournamentId: approved.id,
    });
    expect(spectateOutside.allowed).toBe(false);
    expect(spectateOutside.reasonCode).toBe("SPECTATOR_RESTRICTED_BY_POLICY");

    // Referee / TA / Admin can spectate STAFF_ONLY
    const spectateRef = bundle.admissionGateService.evaluateAdmission({
      principalType: "USER",
      principalId: "ref-user-1",
      roles: ["REFEREE"],
      action: "SPECTATE_ROOM",
      tournamentId: approved.id,
    });
    expect(spectateRef.allowed).toBe(true);

    // 2. Referee Scope (T007):
    // Ref 1 can enter ROOM_A
    const refRoomA = bundle.admissionGateService.evaluateAdmission({
      principalType: "USER",
      principalId: "ref-user-1",
      roles: ["REFEREE"],
      action: "REFEREE_ENTER_ROOM",
      tournamentId: approved.id,
      roomId: "ROOM_A",
    });
    expect(refRoomA.allowed).toBe(true);

    // Ref 1 is NOT assigned to ROOM_B -> out of scope
    const refRoomB = bundle.admissionGateService.evaluateAdmission({
      principalType: "USER",
      principalId: "ref-user-1",
      roles: ["REFEREE"],
      action: "REFEREE_ENTER_ROOM",
      tournamentId: approved.id,
      roomId: "ROOM_B",
    });
    expect(refRoomB.allowed).toBe(false);
    expect(refRoomB.reasonCode).toBe("REFEREE_OUT_OF_SCOPE");

    // Outside user tries to enter room as referee
    const fakeRef = bundle.admissionGateService.evaluateAdmission({
      principalType: "USER",
      principalId: outsideUserActor.userId,
      roles: ["PLAYER"],
      action: "REFEREE_ENTER_ROOM",
      tournamentId: approved.id,
      roomId: "ROOM_A",
    });
    expect(fakeRef.allowed).toBe(false);
    expect(fakeRef.reasonCode).toBe("REFEREE_OUT_OF_SCOPE");
  });
});
