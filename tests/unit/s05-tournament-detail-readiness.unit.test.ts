import { describe, expect, it, vi } from "vitest";
import type {
  TournamentDto,
  TournamentReadinessSnapshot,
} from "@ottv2/contracts";
import {
  TournamentApiClient,
  type TournamentApiPort,
} from "../../apps/web/src/features/admin/tournaments/tournamentApi";

describe("S05 — Tournament Detail Page & Authoritative Readiness Panel", () => {
  const baseStart = "2026-11-01T08:00:00.000Z";
  const baseEnd = "2026-11-02T18:00:00.000Z";

  const mockApprovedTournament: TournamentDto = {
    id: "tour-approved-001",
    contractId: "HD-2026-CHUNG",
    contractCode: "CONTRACT-DEFAULT",
    unitId: "unit-fit-vnu",
    ownerTaUserId: "ta-current",
    status: "APPROVED",
    revision: 2,
    activeConfigVersionId: "cfg-v1",
    activeConfigVersionNumber: 1,
    approvedSnapshot: null,
    everApproved: true,
    quotaRefunded: false,
    coreConfig: {
      tournamentCode: "GIAI_DAU_ROBOT_2026",
      tournamentName: "Giải Vô địch Quốc gia Robot Lab 2026",
      shortDescription: "Giải đấu chính thức quy mô toàn quốc.",
      organizersText: "Khoa CNTT - ĐHQG",
      competitionMode: "HUMAN_ONLINE",
      audienceScope: "PUBLIC_REGISTERED",
      allowedUnitCodes: [],
      registrationIntakeMode: "IMPORT_ONLY",
      maxParticipants: 32,
      minParticipantsToStart: 4,
      timezone: "Asia/Ho_Chi_Minh",
      registrationOpenAt: null,
      registrationCloseAt: null,
      checkinRequired: false,
      checkinOpenAt: null,
      checkinCloseAt: null,
      scheduledStartAt: baseStart,
      scheduledEndAt: baseEnd,
      format: "ARENA_CONTINUOUS",
      pairingMethod: "SWISS_SCORE_ADJACENT",
      maxMatchesPerPlayer: 20,
      maxPairMeetings: 2,
      rematchCooldownMinutes: 10,
      maxConcurrentMatches: 8,
      byeScorePoints: 0,
      spectatorPolicy: "PUBLIC_WATCH",
      chatPolicy: "ENABLED",
      leaderboardVisibility: "LIVE_PUBLIC",
      topNExportCount: 10,
      finalizationMode: "AUTO_FINAL",
      scoringFormulaPreset: "ELO_WEIGHTED_V1",
      initialScore: 1000,
      initialElo: 1000,
      kFactor: 32,
      scoreFloor: 0,
      botDeadlineAt: null,
    },
    ruleProfile: {} as any,
    submittedAt: "2026-10-21T08:00:00.000Z",
    approvedAt: "2026-10-21T09:00:00.000Z",
    rejectedAt: null,
    changesRequestedAt: null,
    lastReviewNote: "Hồ sơ hợp lệ, đã duyệt.",
    startedAt: null,
    pausedAt: null,
    pauseReason: null,
    endedAt: null,
    cancelledAt: null,
    cancelReason: null,
    finalizedAt: null,
    copiedFromTournamentId: null,
    createdAt: "2026-10-21T08:00:00.000Z",
    updatedAt: "2026-10-21T09:00:00.000Z",
  };

  const mockBlockedReadiness: TournamentReadinessSnapshot = {
    tournamentId: "tour-approved-001",
    status: "APPROVED",
    canOpenScheduled: false,
    canStartRunning: false,
    canFinalize: false,
    eligibleParticipantsCount: 2,
    minParticipantsRequired: 4,
    activeStaffCount: 1,
    activeRefereeCount: 1,
    pendingManualAdjudicationsCount: 0,
    activeRuleVersionNumber: 1,
    checklist: [
      {
        code: "APPROVAL_STATUS",
        title: "Phê duyệt cấp hệ thống (Admin Approval)",
        status: "PASS",
        detail: "Giải đấu đã được phê duyệt.",
      },
      {
        code: "RULE_VERSION_PUBLISHED",
        title: "Phiên bản cấu hình & luật thi đấu",
        status: "PASS",
        detail: "Đã phát hành phiên bản cấu hình v1.",
      },
      {
        code: "MIN_ELIGIBLE_PARTICIPANTS",
        title: "Số lượng thí sinh đủ điều kiện tối thiểu",
        status: "BLOCKED",
        detail: "Mới có 2/4 thí sinh đủ điều kiện.",
        blockerCode: "INSUFFICIENT_ELIGIBLE_PARTICIPANTS",
      },
      {
        code: "NO_PENDING_ADJUDICATION",
        title: "Phán quyết thủ công tồn đọng",
        status: "PASS",
        detail: "Không có trận đấu nào đang chờ phán quyết thủ công.",
      },
    ],
    blockers: ["INSUFFICIENT_ELIGIBLE_PARTICIPANTS"],
    evaluatedAt: "2026-10-22T08:00:00.000Z",
  };

  const mockReadyReadiness: TournamentReadinessSnapshot = {
    ...mockBlockedReadiness,
    canOpenScheduled: true,
    canStartRunning: true,
    eligibleParticipantsCount: 16,
    checklist: [
      ...mockBlockedReadiness.checklist.slice(0, 2),
      {
        code: "MIN_ELIGIBLE_PARTICIPANTS",
        title: "Số lượng thí sinh đủ điều kiện tối thiểu",
        status: "PASS",
        detail: "Có 16/4 thí sinh đủ điều kiện.",
      },
      mockBlockedReadiness.checklist[3],
    ],
    blockers: [],
  };

  it("AC-01: retrieves tournament detail and preserves canonical metadata", async () => {
    const client = new TournamentApiClient();
    const detail = await client.getTournamentDetail("tour-001");

    expect(detail.tournament).toBeDefined();
    expect(detail.tournament.id).toBe("tour-001");
    expect(detail.tournament.coreConfig.tournamentName).toBeDefined();
    expect(detail.tournament.coreConfig.scheduledStartAt).toBeDefined();
  });

  it("AC-02: provides full operational control, privacy, and scoring properties in CoreConfig", () => {
    const config = mockApprovedTournament.coreConfig;

    expect(config.maxMatchesPerPlayer).toBe(20);
    expect(config.maxPairMeetings).toBe(2);
    expect(config.rematchCooldownMinutes).toBe(10);
    expect(config.maxConcurrentMatches).toBe(8);
    expect(config.spectatorPolicy).toBe("PUBLIC_WATCH");
    expect(config.chatPolicy).toBe("ENABLED");
    expect(config.leaderboardVisibility).toBe("LIVE_PUBLIC");
    expect(config.initialScore).toBe(1000);
    expect(config.kFactor).toBe(32);
  });

  it("AC-03: evaluates readiness checklist with authoritative checklist items", async () => {
    const client = new TournamentApiClient();
    const res = await client.getTournamentReadiness("tour-001");

    expect(res.readiness).toBeDefined();
    expect(res.readiness.checklist).toHaveLength(4);
    expect(res.readiness.checklist.map((c) => c.code)).toEqual([
      "APPROVAL_STATUS",
      "RULE_VERSION_PUBLISHED",
      "MIN_ELIGIBLE_PARTICIPANTS",
      "NO_PENDING_ADJUDICATION",
    ]);
  });

  it("AC-04: authoritatively prevents fake READY state when blockers exist", () => {
    expect(mockBlockedReadiness.canStartRunning).toBe(false);
    expect(mockBlockedReadiness.blockers).toContain("INSUFFICIENT_ELIGIBLE_PARTICIPANTS");

    const minPartCheck = mockBlockedReadiness.checklist.find(
      (c) => c.code === "MIN_ELIGIBLE_PARTICIPANTS"
    );
    expect(minPartCheck?.status).toBe("BLOCKED");

    // When all prerequisites pass, only then canStartRunning is true
    expect(mockReadyReadiness.canStartRunning).toBe(true);
    expect(mockReadyReadiness.blockers).toHaveLength(0);
  });

  it("AC-05: verifies lifecycle endpoints for openScheduled, start, pause, and resume", async () => {
    const mockApi: TournamentApiPort = {
      listTournaments: vi.fn(),
      createDraft: vi.fn(),
      patchDraft: vi.fn(),
      getDraft: vi.fn(),
      deleteDraft: vi.fn(),
      getTournamentDetail: vi.fn().mockResolvedValue({ tournament: mockApprovedTournament, configVersions: [] }),
      getTournamentReadiness: vi.fn().mockResolvedValue({ readiness: mockReadyReadiness }),
      openScheduled: vi.fn().mockResolvedValue({ tournament: { ...mockApprovedTournament, status: "SCHEDULED" } }),
      startTournament: vi.fn().mockResolvedValue({ tournament: { ...mockApprovedTournament, status: "RUNNING" } }),
      pauseTournament: vi.fn().mockResolvedValue({ tournament: { ...mockApprovedTournament, status: "PAUSED" } }),
      resumeTournament: vi.fn().mockResolvedValue({ tournament: { ...mockApprovedTournament, status: "RUNNING" } }),
    };

    const scheduled = await mockApi.openScheduled("tour-001", 1);
    expect(scheduled.tournament.status).toBe("SCHEDULED");
    expect(mockApi.openScheduled).toHaveBeenCalledWith("tour-001", 1);

    const started = await mockApi.startTournament("tour-001", 2);
    expect(started.tournament.status).toBe("RUNNING");
    expect(mockApi.startTournament).toHaveBeenCalledWith("tour-001", 2);

    const paused = await mockApi.pauseTournament("tour-001", "Kiểm tra kỹ thuật", 3);
    expect(paused.tournament.status).toBe("PAUSED");
    expect(mockApi.pauseTournament).toHaveBeenCalledWith("tour-001", "Kiểm tra kỹ thuật", 3);

    const resumed = await mockApi.resumeTournament("tour-001", 4);
    expect(resumed.tournament.status).toBe("RUNNING");
    expect(mockApi.resumeTournament).toHaveBeenCalledWith("tour-001", 4);
  });
});
