import { describe, expect, it } from "vitest";
import {
  normalizeTournamentCoreConfig,
  validateTournamentCoreConfigSemantics,
  type TournamentCoreConfig,
} from "@ottv2/contracts";
import {
  createDefaultCoreConfig,
  type DraftFormData,
} from "../../apps/web/src/features/admin/tournaments/tournamentTypes";
import {
  saveLocalDraftBuffer,
  getLocalDraftBuffer,
  clearLocalDraftBuffer,
} from "../../apps/web/src/features/admin/tournaments/tournamentApi";

describe("S04 — Extended Tournament Form Groups & Conditional Validation", () => {
  const baseStart = "2026-11-01T08:00:00.000Z";
  const baseEnd = "2026-11-02T18:00:00.000Z";

  it("AC-01: validates conditional rules for INTERNAL_UNIT, check-in window and bot deadline", () => {
    // 1. INTERNAL_UNIT requires at least one unit code
    const internalConfig = createDefaultCoreConfig({
      tournamentCode: "TOUR_INTERNAL",
      tournamentName: "Giải Nội Bộ Khoa",
      audienceScope: "INTERNAL_UNIT",
      allowedUnitCodes: [],
      scheduledStartAt: baseStart,
      scheduledEndAt: baseEnd,
    });
    const issuesInternal = validateTournamentCoreConfigSemantics(internalConfig);
    expect(issuesInternal.some((i) => i.field === "allowedUnitCodes")).toBe(true);

    // 2. checkinRequired requires valid checkinOpenAt and checkinCloseAt <= scheduledStartAt
    const checkinInvalidConfig = createDefaultCoreConfig({
      tournamentCode: "TOUR_CHECKIN",
      tournamentName: "Giải Có Điểm Danh",
      scheduledStartAt: baseStart,
      scheduledEndAt: baseEnd,
      checkinRequired: true,
      checkinOpenAt: "2026-11-01T08:15:00.000Z", // After start!
      checkinCloseAt: "2026-11-01T08:30:00.000Z",
    });
    const issuesCheckin = validateTournamentCoreConfigSemantics(checkinInvalidConfig);
    expect(issuesCheckin.some((i) => i.field === "checkinCloseAt" || i.field === "checkinOpenAt")).toBe(true);

    // 3. BOT_VS_BOT requires botDeadlineAt <= scheduledStartAt
    const botDeadlineInvalidConfig = createDefaultCoreConfig({
      tournamentCode: "TOUR_BOT",
      tournamentName: "Giải Bot Đại Chiến",
      competitionMode: "BOT_VS_BOT",
      scheduledStartAt: baseStart,
      scheduledEndAt: baseEnd,
      botDeadlineAt: "2026-11-01T09:00:00.000Z", // After start!
    });
    const issuesBot = validateTournamentCoreConfigSemantics(botDeadlineInvalidConfig);
    expect(issuesBot.some((i) => i.field === "botDeadlineAt")).toBe(true);
  });

  it("AC-02: normalizes conditional fields when parent scope/mode toggles change", () => {
    // When audienceScope !== "INTERNAL_UNIT", allowedUnitCodes is cleared
    const rawPublicConfig: TournamentCoreConfig = {
      ...createDefaultCoreConfig({
        tournamentCode: "TOUR_PUBLIC",
        tournamentName: "Giải Công Khai",
        audienceScope: "PUBLIC_REGISTERED",
        scheduledStartAt: baseStart,
        scheduledEndAt: baseEnd,
      }),
      allowedUnitCodes: ["unit-cntt", "unit-toan"],
    };
    const normalizedPublic = normalizeTournamentCoreConfig(rawPublicConfig);
    expect(normalizedPublic.allowedUnitCodes).toEqual([]);

    // When checkinRequired === false, checkinOpenAt and checkinCloseAt are cleared
    const rawNoCheckinConfig: TournamentCoreConfig = {
      ...createDefaultCoreConfig({
        tournamentCode: "TOUR_NO_CHECKIN",
        tournamentName: "Giải Không Checkin",
        scheduledStartAt: baseStart,
        scheduledEndAt: baseEnd,
        checkinRequired: false,
      }),
      checkinOpenAt: "2026-11-01T07:00:00.000Z",
      checkinCloseAt: "2026-11-01T07:45:00.000Z",
    };
    const normalizedNoCheckin = normalizeTournamentCoreConfig(rawNoCheckinConfig);
    expect(normalizedNoCheckin.checkinOpenAt).toBeNull();
    expect(normalizedNoCheckin.checkinCloseAt).toBeNull();

    // When competitionMode === "HUMAN_ONLINE", botDeadlineAt is cleared
    const rawHumanConfig: TournamentCoreConfig = {
      ...createDefaultCoreConfig({
        tournamentCode: "TOUR_HUMAN",
        tournamentName: "Giải Đấu Người",
        competitionMode: "HUMAN_ONLINE",
        scheduledStartAt: baseStart,
        scheduledEndAt: baseEnd,
      }),
      botDeadlineAt: "2026-11-01T07:00:00.000Z",
    };
    const normalizedHuman = normalizeTournamentCoreConfig(rawHumanConfig);
    expect(normalizedHuman.botDeadlineAt).toBeNull();
  });

  it("AC-03: reports zero semantic issues when all conditional fields are valid", () => {
    const validConfig = createDefaultCoreConfig({
      tournamentCode: "TOUR_VALID_ALL",
      tournamentName: "Giải Đấu Hợp Lệ Hoàn Chỉnh",
      audienceScope: "INTERNAL_UNIT",
      allowedUnitCodes: ["unit-fit-vnu"],
      competitionMode: "BOT_VS_BOT",
      botDeadlineAt: "2026-11-01T06:00:00.000Z", // 2 hours before start
      checkinRequired: true,
      checkinOpenAt: "2026-11-01T07:00:00.000Z",
      checkinCloseAt: "2026-11-01T07:50:00.000Z", // 10 mins before start
      scheduledStartAt: baseStart,
      scheduledEndAt: baseEnd,
      minParticipantsToStart: 4,
      maxParticipants: 32,
    });

    const issues = validateTournamentCoreConfigSemantics(validConfig);
    expect(issues).toHaveLength(0);
  });

  it("AC-04: maps operational control, scoring, and privacy groups into coreConfig", () => {
    const customConfig = createDefaultCoreConfig({
      tournamentCode: "TOUR_CONTROL",
      tournamentName: "Giải Cấu Hình Kiểm Soát",
      scheduledStartAt: baseStart,
      scheduledEndAt: baseEnd,
      maxMatchesPerPlayer: 10,
      maxPairMeetings: 3,
      rematchCooldownMinutes: 15,
      maxConcurrentMatches: 12,
      spectatorPolicy: "PUBLIC_WATCH",
      chatPolicy: "ENABLED",
      leaderboardVisibility: "LIVE_PUBLIC",
      initialScore: 1200,
      initialElo: 1200,
      kFactor: 24,
      scoreFloor: 100,
      byeScorePoints: 1,
    });

    expect(customConfig.maxMatchesPerPlayer).toBe(10);
    expect(customConfig.maxPairMeetings).toBe(3);
    expect(customConfig.rematchCooldownMinutes).toBe(15);
    expect(customConfig.maxConcurrentMatches).toBe(12);
    expect(customConfig.spectatorPolicy).toBe("PUBLIC_WATCH");
    expect(customConfig.chatPolicy).toBe("ENABLED");
    expect(customConfig.leaderboardVisibility).toBe("LIVE_PUBLIC");
    expect(customConfig.initialScore).toBe(1200);
    expect(customConfig.initialElo).toBe(1200);
    expect(customConfig.kFactor).toBe(24);
    expect(customConfig.scoreFloor).toBe(100);
    expect(customConfig.byeScorePoints).toBe(1);
  });

  it("AC-05: preserves all extended S04 form groups across Local Storage buffer save & recovery", () => {
    const draftId = "test-s04-resilience";
    const extendedForm: DraftFormData = {
      tournamentId: draftId,
      name: "Giải Khôi Phục Dữ Liệu S04",
      slug: "GIAI_KHOI_PHUC_S04",
      description: "Mô tả đầy đủ",
      contractId: "HD-2026-S04",
      organizerUnitId: "unit-fit-vnu",
      visibility: "PRIVATE",
      timeModel: "MULTIDAY",
      timezone: "Asia/Ho_Chi_Minh",
      rosterOpenAt: "2026-10-25T08:00:00.000Z",
      rosterCloseAt: "2026-10-30T18:00:00.000Z",
      startAt: baseStart,
      endAt: baseEnd,
      competitionMode: "BOT_VS_BOT",
      pairingStrategy: "ARENA",
      minParticipants: 8,
      maxParticipants: 64,
      checkinRequired: true,
      allowedUnitCodes: ["unit-khtn", "unit-bachkhoa"],
      checkinOpenAt: "2026-11-01T07:00:00.000Z",
      checkinCloseAt: "2026-11-01T07:50:00.000Z",
      botDeadlineAt: "2026-11-01T06:00:00.000Z",
      organizersText: "Ban Tổ chức Kỳ thi ACM",
      regulationsText: "Điều lệ thi đấu ACM mở rộng",
      contactChannel: "hotro@acm.edu.vn",
      maxMatchesPerPlayer: 15,
      maxPairMeetings: 2,
      rematchCooldownMinutes: 10,
      maxConcurrentMatches: 16,
      spectatorPolicy: "PUBLIC_WATCH",
      chatPolicy: "SPECTATOR_MUTED",
      leaderboardVisibility: "LIVE_PUBLIC",
      initialScore: 1500,
      initialElo: 1500,
      kFactor: 32,
      scoreFloor: 0,
      byeScorePoints: 0,
    };

    saveLocalDraftBuffer(draftId, extendedForm);
    const recovered = getLocalDraftBuffer(draftId);

    expect(recovered).not.toBeNull();
    expect(recovered?.allowedUnitCodes).toEqual(["unit-khtn", "unit-bachkhoa"]);
    expect(recovered?.checkinOpenAt).toBe("2026-11-01T07:00:00.000Z");
    expect(recovered?.checkinCloseAt).toBe("2026-11-01T07:50:00.000Z");
    expect(recovered?.botDeadlineAt).toBe("2026-11-01T06:00:00.000Z");
    expect(recovered?.maxMatchesPerPlayer).toBe(15);
    expect(recovered?.rematchCooldownMinutes).toBe(10);
    expect(recovered?.spectatorPolicy).toBe("PUBLIC_WATCH");

    clearLocalDraftBuffer(draftId);
    expect(getLocalDraftBuffer(draftId)).toBeNull();
  });
});
