import { randomUUID } from "node:crypto";
import {
  AdmissionCheckInputSchema,
  AdmissionDecisionSchema,
  type AdmissionCheckInput,
  type AdmissionDecision,
  type TournamentConfigVersionDto,
} from "@ottv2/contracts";
import {
  createTournamentError,
  type PinnedMatchRecord,
  type TournamentStateStore,
} from "../tournament-foundation/tournament-store.js";

const ONLINE_NEW_PLAYER_ACTIONS = new Set([
  "ONLINE_QUEUE_JOIN",
  "ONLINE_ROOM_CREATE",
  "ONLINE_ROOM_JOIN_PLAYER",
  "ONLINE_SEAT_UPGRADE_TO_PLAYER",
]);

export class AdmissionGateService {
  constructor(private readonly store: TournamentStateStore) {}

  /**
   * Evaluates C32 Online Admission Gate, Admin play restriction (T005),
   * Referee room scope (T007), Spectator policy, and PAUSED new-admission lock (T027, T075).
   */
  evaluateAdmission(rawInput: AdmissionCheckInput): AdmissionDecision {
    const input = AdmissionCheckInputSchema.parse(rawInput);

    // 1. Offline local matches are never blocked by C32 (T075)
    if (input.action === "OFFLINE_LOCAL_MATCH") {
      return AdmissionDecisionSchema.parse({
        allowed: true,
        reasonCode: "ALLOWED",
        message: "Chế độ Ngoại tuyến (Offline) luôn được phép.",
        activeTournamentIds: [],
      });
    }

    // 2. T005: Admin can never occupy an Online player seat or matchmaking queue
    if (
      input.roles.includes("ADMIN") &&
      ONLINE_NEW_PLAYER_ACTIONS.has(input.action)
    ) {
      return AdmissionDecisionSchema.parse({
        allowed: false,
        reasonCode: "ADMIN_CANNOT_PLAY_ONLINE",
        message:
          "Tài khoản Quản trị hệ thống (Admin) không được phép tham gia thi đấu trực tuyến với tư cách người chơi.",
        activeTournamentIds: [],
      });
    }

    // 3. Reconnecting to an already-started in-progress match is preserved (T075)
    if (input.action === "ONLINE_RECONNECT_EXISTING_MATCH") {
      const match = input.matchId
        ? this.store.matches.get(input.matchId)
        : input.roomId
        ? Array.from(this.store.matches.values()).find(
            (m) =>
              m.roomId === input.roomId &&
              (m.status === "RUNNING" || m.status === "PAUSED_ADJUDICATION")
          )
        : undefined;
      if (
        match &&
        (match.status === "RUNNING" || match.status === "PAUSED_ADJUDICATION") &&
        (match.blueParticipantId === input.principalId ||
          match.redParticipantId === input.principalId)
      ) {
        return AdmissionDecisionSchema.parse({
          allowed: true,
          reasonCode: "ALLOWED",
          message: "Cho phép kết nối lại (reconnect) vào trận đấu đang diễn ra.",
          activeTournamentIds: [match.tournamentId],
        });
      }
      return AdmissionDecisionSchema.parse({
        allowed: false,
        reasonCode: "PARTICIPANT_NOT_ELIGIBLE",
        message:
          "Không tìm thấy trận đấu đang diễn ra phù hợp để kết nối lại hoặc tài khoản không phải đấu thủ của trận đấu này.",
        activeTournamentIds: match?.tournamentId ? [match.tournamentId] : [],
      });
    }

    // 4. Referee scope check (T007)
    if (input.action === "REFEREE_ENTER_ROOM") {
      const targetTournamentId =
        input.tournamentId ??
        (input.roomId
          ? Array.from(this.store.matches.values()).find(
              (m) => m.roomId === input.roomId
            )?.tournamentId
          : undefined);

      if (!targetTournamentId) {
        return AdmissionDecisionSchema.parse({
          allowed: false,
          reasonCode: "REFEREE_OUT_OF_SCOPE",
          message: "Trọng tài cần được gán vào giải đấu cụ thể để vào phòng.",
          activeTournamentIds: [],
        });
      }
      const assignment = Array.from(this.store.staffAssignments.values()).find(
        (s) =>
          s.tournamentId === targetTournamentId &&
          s.userId === input.principalId &&
          s.role === "REFEREE" &&
          (s.status === "ACTIVE" || (s as any).status === "ACCEPTED")
      );
      if (
        !assignment ||
        (assignment.assignedRooms.length > 0 &&
          input.roomId &&
          !assignment.assignedRooms.includes(input.roomId))
      ) {
        return AdmissionDecisionSchema.parse({
          allowed: false,
          reasonCode: "REFEREE_OUT_OF_SCOPE",
          message: "Trọng tài không thuộc phạm vi phân công của giải đấu hoặc phòng này.",
          activeTournamentIds: [targetTournamentId],
        });
      }
      return AdmissionDecisionSchema.parse({
        allowed: true,
        reasonCode: "ALLOWED",
        message: "Trọng tài hợp lệ trong phạm vi giải đấu.",
        activeTournamentIds: [targetTournamentId],
      });
    }

    // 5. Spectator policy check
    if (input.action === "SPECTATE_ROOM") {
      const targetTournamentId =
        input.tournamentId ??
        (input.roomId
          ? Array.from(this.store.matches.values()).find(
              (m) => m.roomId === input.roomId
            )?.tournamentId
          : undefined);

      if (targetTournamentId) {
        const tournament = this.store.tournaments.get(targetTournamentId);
        if (tournament) {
          const policy = tournament.coreConfig.spectatorPolicy;
          const isStaffOrTaOrAdmin =
            input.roles.includes("ADMIN") ||
            tournament.ownerTaUserId === input.principalId ||
            Array.from(this.store.staffAssignments.values()).some(
              (s) =>
                s.tournamentId === tournament.id &&
                s.userId === input.principalId &&
                (s.status === "ACTIVE" || (s as any).status === "ACCEPTED")
            );

          if (policy === "DISABLED" && !isStaffOrTaOrAdmin) {
            return AdmissionDecisionSchema.parse({
              allowed: false,
              reasonCode: "SPECTATOR_RESTRICTED_BY_POLICY",
              message: "Giải đấu này đã tắt chế độ khán giả.",
              activeTournamentIds: [tournament.id],
            });
          }
          if (policy === "STAFF_ONLY" && !isStaffOrTaOrAdmin) {
            return AdmissionDecisionSchema.parse({
              allowed: false,
              reasonCode: "SPECTATOR_RESTRICTED_BY_POLICY",
              message: "Chỉ Ban tổ chức và Trọng tài mới được phép xem phòng giải đấu này.",
              activeTournamentIds: [tournament.id],
            });
          }
          if (policy === "ROSTER_ONLY" && !isStaffOrTaOrAdmin) {
            const inRoster = Array.from(this.store.enrollments.values()).some(
              (e) =>
                e.tournamentId === tournament.id &&
                e.userId === input.principalId &&
                e.eligibilityStatus === "ELIGIBLE"
            );
            if (!inRoster) {
              return AdmissionDecisionSchema.parse({
                allowed: false,
                reasonCode: "SPECTATOR_RESTRICTED_BY_POLICY",
                message: "Chỉ thí sinh thuộc danh sách giải đấu mới được xem trực tiếp.",
                activeTournamentIds: [tournament.id],
              });
            }
          }
        }
      }
      return AdmissionDecisionSchema.parse({
        allowed: true,
        reasonCode: "ALLOWED",
        message: "Cho phép vào xem phòng thi đấu.",
        activeTournamentIds: targetTournamentId ? [targetTournamentId] : [],
      });
    }

    // 6. C32 Window Check for new Online player actions (BR-15, T027, T075)
    const activeWindowTournaments = Array.from(
      this.store.tournaments.values()
    ).filter((t) => t.status === "RUNNING" || t.status === "PAUSED");
    const activeIds = activeWindowTournaments.map((t) => t.id);

    if (ONLINE_NEW_PLAYER_ACTIONS.has(input.action)) {
      if (input.tournamentId) {
        const targetTournament = this.store.tournaments.get(input.tournamentId);
        if (targetTournament?.status === "PAUSED") {
          return AdmissionDecisionSchema.parse({
            allowed: false,
            reasonCode: "TOURNAMENT_PAUSED_NO_NEW_ADMISSION",
            message:
              "Giải đấu đang tạm dừng (PAUSED), không tiếp nhận ghép cặp hoặc mở trận mới.",
            activeTournamentIds: activeIds,
          });
        }
      }

      if (activeWindowTournaments.length > 0) {
        if (input.principalType === "GUEST" || input.roles.includes("GUEST")) {
          return AdmissionDecisionSchema.parse({
            allowed: false,
            reasonCode: "GUEST_BLOCKED_DURING_TOURNAMENT_WINDOW",
            message:
              "Hệ thống đang trong khung giờ thi đấu giải chính thức (C32). Tài khoản Khách (Guest) chỉ có thể chơi Ngoại tuyến hoặc xem các phòng công khai.",
            activeTournamentIds: activeIds,
          });
        }

        // Check if USER is an eligible participant in an active RUNNING tournament
        const runningTournaments = activeWindowTournaments.filter(
          (t) =>
            t.status === "RUNNING" &&
            (!input.tournamentId || t.id === input.tournamentId)
        );

        if (runningTournaments.length === 0) {
          return AdmissionDecisionSchema.parse({
            allowed: false,
            reasonCode: "TOURNAMENT_PAUSED_NO_NEW_ADMISSION",
            message:
              "Giải đấu đang tạm dừng (PAUSED), không thể bắt đầu trận đấu trực tuyến mới.",
            activeTournamentIds: activeIds,
          });
        }

        let foundEnrollment = false;
        let isFullyEligible = false;

        for (const t of runningTournaments) {
          const enrollment = Array.from(this.store.enrollments.values()).find(
            (e) => e.tournamentId === t.id && e.userId === input.principalId
          );
          if (!enrollment) continue;
          foundEnrollment = true;

          const checkinOk = !t.coreConfig.checkinRequired || Boolean(enrollment.checkedInAt);
          const botOk =
            t.coreConfig.competitionMode === "HUMAN_ONLINE" ||
            enrollment.botReadinessStatus === "READY";

          if (enrollment.eligibilityStatus === "ELIGIBLE" && checkinOk && botOk) {
            isFullyEligible = true;
            break;
          }
        }

        if (!foundEnrollment) {
          return AdmissionDecisionSchema.parse({
            allowed: false,
            reasonCode: "OUTSIDE_USER_BLOCKED_DURING_TOURNAMENT_WINDOW",
            message:
              "Hệ thống đang dành tài nguyên cho giải đấu chính thức (C32). Tài khoản ngoài danh sách giải không thể ghép trận trực tuyến lúc này.",
            activeTournamentIds: activeIds,
          });
        }

        if (!isFullyEligible) {
          return AdmissionDecisionSchema.parse({
            allowed: false,
            reasonCode: "PARTICIPANT_NOT_ELIGIBLE",
            message:
              "Tài khoản của bạn thuộc danh sách giải nhưng chưa hoàn tất check-in hoặc Bot chưa sẵn sàng.",
            activeTournamentIds: activeIds,
          });
        }
      }
    }

    return AdmissionDecisionSchema.parse({
      allowed: true,
      reasonCode: "ALLOWED",
      message: "Đủ điều kiện tham gia.",
      activeTournamentIds: activeIds,
    });
  }

  /**
   * Enforces admission decision or throws an AppError (403/409).
   */
  assertAdmissionAllowed(rawInput: AdmissionCheckInput): AdmissionDecision {
    const decision = this.evaluateAdmission(rawInput);
    if (!decision.allowed) {
      const isConflict =
        decision.reasonCode === "TOURNAMENT_PAUSED_NO_NEW_ADMISSION";
      throw createTournamentError({
        code: isConflict ? "CONFLICT" : "UNAUTHORIZED",
        statusCode: isConflict ? 409 : 403,
        message: decision.message,
        details: {
          reason: decision.reasonCode,
          blockerCode: decision.reasonCode,
        },
      });
    }
    return decision;
  }

  /**
   * T062: Resolves the effective TournamentConfigVersion at `matchCreatedAtIso`
   * (`version.effectiveAt <= matchCreatedAtIso` with highest `versionNumber`)
   * and pins it onto the newly created match so later rule updates never mutate in-progress matches.
   */
  async createMatchWithPinnedVersion(input: {
    tournamentId: string;
    roomId: string;
    blueParticipantId: string;
    redParticipantId: string;
    matchId?: string;
    createdAtIso?: string;
  }): Promise<{ match: PinnedMatchRecord; pinnedVersion: TournamentConfigVersionDto }> {
    return this.store.withLock(() => {
      const tournament = this.store.tournaments.get(input.tournamentId);
      if (!tournament) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy giải đấu.",
          details: { reason: "RESOURCE_NOT_FOUND", tournamentId: input.tournamentId },
        });
      }

      if (tournament.status !== "RUNNING") {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: `Chỉ có thể khởi tạo trận đấu mới khi giải đang RUNNING (hiện tại: ${tournament.status}).`,
          details: {
            reason: "TOURNAMENT_NOT_RUNNING",
            status: tournament.status,
            tournamentId: input.tournamentId,
          },
        });
      }

      const createdAtIso = input.createdAtIso ?? this.store.nowIso();
      const createdAtMs = Date.parse(createdAtIso);

      const versions = this.store.configVersions.get(input.tournamentId) ?? [];
      const eligibleVersions = versions
        .filter((v) => Date.parse(v.effectiveAt) <= createdAtMs)
        .sort((a, b) => b.versionNumber - a.versionNumber);

      const pinnedVersion = eligibleVersions[0] ?? versions[versions.length - 1];
      if (!pinnedVersion) {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: "Giải đấu chưa có phiên bản cấu hình/luật nào có hiệu lực.",
          details: {
            reason: "NO_ACTIVE_RULE_VERSION",
            tournamentId: input.tournamentId,
          },
        });
      }

      const match: PinnedMatchRecord = {
        matchId: input.matchId ?? randomUUID(),
        roomId: input.roomId,
        tournamentId: input.tournamentId,
        pinnedConfigVersionId: pinnedVersion.id,
        pinnedConfigVersionNumber: pinnedVersion.versionNumber,
        blueParticipantId: input.blueParticipantId,
        redParticipantId: input.redParticipantId,
        status: "RUNNING",
        winnerSide: null,
        finishSequence: null,
        createdAt: createdAtIso,
        endedAt: null,
      };

      this.store.matches.set(match.matchId, match);
      return { match, pinnedVersion };
    });
  }
}
