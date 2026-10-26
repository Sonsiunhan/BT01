import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  CreateTournamentChangeRequestInputSchema,
  evaluateRuleProfileEnvelope,
  PublishWithinEnvelopeRuleUpdateInputSchema,
  TournamentChangeRequestSchema,
  TournamentConfigVersionSchema,
  TournamentDtoSchema,
  TournamentReadinessSnapshotSchema,
  TournamentRuleProfileSchema,
  type ChangeRequestFieldDiff,
  type CreateTournamentChangeRequestInput,
  type PublishWithinEnvelopeRuleUpdateInput,
  type ReadinessChecklistItem,
  type TournamentChangeRequestDto,
  type TournamentConfigVersionDto,
  type TournamentDto,
  type TournamentReadinessSnapshot,
} from "@ottv2/contracts";
import { validateRuleProfileForPreview } from "@ottv2/game-rules";
import {
  assertTaContractOrTournamentAccess,
  createTournamentError,
  type TournamentActorContext,
  type TournamentStateStore,
} from "../tournament-foundation/tournament-store.js";
import type { AdjudicationLedgerService } from "./adjudication-ledger.service.js";
import type { TournamentAcknowledgementGuard } from "./acknowledgement-guard.js";
import type { TournamentStartTransaction } from "./lifecycle-transaction.js";
import {
  InMemoryReadinessSourcesAdapter,
  type ReadinessSourcesPort,
} from "./readiness-sources.port.js";
import {
  persistAdjudicationRequestToPrisma,
  persistChangeRequestToPrisma,
  persistConfigVersionToPrisma,
  persistTournamentToPrisma,
} from "../tournament-foundation/prisma-sync.js";
import type { PrismaClient } from "@prisma/client";

export class TournamentLifecycleService {
  private readonly readinessSourcesPort: ReadinessSourcesPort;

  constructor(
    private readonly store: TournamentStateStore,
    private readonly adjudicationLedgerService?: AdjudicationLedgerService,
    readinessSourcesPort?: ReadinessSourcesPort,
    private readonly acknowledgementGuard?: TournamentAcknowledgementGuard,
    private readonly startTransaction?: TournamentStartTransaction,
    private readonly database?: PrismaClient,
  ) {
    this.readinessSourcesPort =
      readinessSourcesPort ?? new InMemoryReadinessSourcesAdapter(store);
  }

  private assertExpectedRevision(
    tournament: TournamentDto,
    expectedRevision?: number
  ): void {
    if (expectedRevision !== undefined && expectedRevision !== tournament.revision) {
      throw createTournamentError({
        code: "CONFLICT",
        statusCode: 409,
        message: "Phiên bản giải đấu đã thay đổi. Vui lòng đồng bộ lại.",
        details: {
          reason: "STALE_VERSION",
          expectedRevision,
          currentRevision: tournament.revision,
          tournamentId: tournament.id,
        },
      });
    }
  }

  /**
   * BR-07 & T024: Creates a separate post-approval ChangeRequest without reverting
   * the tournament's own status to UNDER_REVIEW.
   */
  async createChangeRequest(
    actor: TournamentActorContext,
    tournamentId: string,
    rawInput: CreateTournamentChangeRequestInput
  ): Promise<TournamentChangeRequestDto> {
    const parsed = CreateTournamentChangeRequestInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      throw createTournamentError({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: firstIssue?.message ?? "Dữ liệu yêu cầu thay đổi cấu hình không hợp lệ.",
        details: {
          reason: "SCHEMA_VALIDATION_FAILED",
          field: String(firstIssue?.path[0] ?? "reason"),
        },
      });
    }

    return this.store.withLock(async () => {
      const tournament = this.store.tournaments.get(tournamentId);
      if (!tournament) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy giải đấu.",
          details: { reason: "RESOURCE_NOT_FOUND", tournamentId },
        });
      }

      const contract = this.store.contracts.get(tournament.contractId);
      if (!contract) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy hợp đồng.",
          details: { reason: "RESOURCE_NOT_FOUND", contractId: tournament.contractId },
        });
      }

      const nowIso = this.store.nowIso();
      assertTaContractOrTournamentAccess(actor, contract, {
        mode: "OPERATE_EXISTING",
        tournament,
        serverNowIso: nowIso,
      });

      const postApprovalStatuses = new Set([
        "APPROVED",
        "SCHEDULED",
        "RUNNING",
        "PAUSED",
      ]);
      if (!postApprovalStatuses.has(tournament.status)) {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: `Chỉ tạo ChangeRequest cho giải đấu đã được phê duyệt (trạng thái hiện tại: ${tournament.status}).`,
          details: {
            reason: "INVALID_STATE_TRANSITION",
            status: tournament.status,
            tournamentId,
          },
        });
      }

      for (const existingCr of this.store.changeRequests.values()) {
        if (existingCr.tournamentId === tournamentId && existingCr.status === "PENDING") {
          throw createTournamentError({
            code: "CONFLICT",
            statusCode: 409,
            message: "Giải đấu này đang có một yêu cầu thay đổi (ChangeRequest) chờ Admin duyệt.",
            details: {
              reason: "PENDING_CHANGE_REQUEST_EXISTS",
              tournamentId,
            },
          });
        }
      }

      const diffs: ChangeRequestFieldDiff[] = [];
      for (const [k, v] of Object.entries(parsed.data.proposedCoreConfigPatch ?? {})) {
        const beforeVal = (tournament.coreConfig as Record<string, unknown>)[k];
        if (JSON.stringify(beforeVal) !== JSON.stringify(v)) {
          diffs.push({
            fieldPath: `coreConfig.${k}`,
            label: k,
            beforeValue: beforeVal,
            afterValue: v,
            requiresAdminApproval: true,
          });
        }
      }
      for (const [k, v] of Object.entries(parsed.data.proposedRuleProfilePatch ?? {})) {
        const beforeVal = (tournament.ruleProfile as Record<string, unknown>)[k];
        if (JSON.stringify(beforeVal) !== JSON.stringify(v)) {
          diffs.push({
            fieldPath: `ruleProfile.${k}`,
            label: k,
            beforeValue: beforeVal,
            afterValue: v,
            requiresAdminApproval: true,
          });
        }
      }

      if (diffs.length === 0) {
        throw createTournamentError({
          code: "VALIDATION_ERROR",
          statusCode: 400,
          message: "Không có trường cấu hình nào thay đổi so với bản hiện hành.",
          details: { reason: "NO_DIFF_IN_CHANGE_REQUEST", tournamentId },
        });
      }

      const cr = TournamentChangeRequestSchema.parse({
        id: randomUUID(),
        tournamentId: tournament.id,
        tournamentCode: tournament.coreConfig.tournamentCode,
        tournamentName: tournament.coreConfig.tournamentName,
        contractId: tournament.contractId,
        requestedByTaUserId: actor.userId,
        status: "PENDING",
        reason: parsed.data.reason,
        proposedCoreConfigPatch: parsed.data.proposedCoreConfigPatch,
        proposedRuleProfilePatch: parsed.data.proposedRuleProfilePatch,
        effectiveAt: parsed.data.effectiveAt,
        diffs,
        reviewedByAdminUserId: null,
        reviewNote: null,
        reviewedAt: null,
        appliedConfigVersionId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      if (this.database) {
        await persistChangeRequestToPrisma(this.database, cr);
      }
      this.store.changeRequests.set(cr.id, cr);
      this.store.audit.append({
        actorUserId: actor.userId,
        actorRole: "TOURNAMENT_ADMIN",
        action: "CHANGE_REQUEST_CREATED",
        targetType: "CHANGE_REQUEST",
        targetId: cr.id,
        beforeSnapshot: null,
        afterSnapshot: cr,
        reason: cr.reason,
        correlationId: actor.correlationId ?? null,
        nowIso,
      });

      return cr;
    });
  }

  /**
   * BR-10 & T061: Allows TA to publish a rule update directly when it stays strictly
   * within the ContractPolicyEnvelope and effectiveAt >= serverNow.
   */
  async publishWithinEnvelopeRuleUpdate(
    actor: TournamentActorContext,
    tournamentId: string,
    rawInput: PublishWithinEnvelopeRuleUpdateInput
  ): Promise<{ tournament: TournamentDto; publishedVersion: TournamentConfigVersionDto }> {
    const parsed = PublishWithinEnvelopeRuleUpdateInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      throw createTournamentError({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: firstIssue?.message ?? "Dữ liệu phát hành phiên bản luật không hợp lệ.",
        details: {
          reason: "SCHEMA_VALIDATION_FAILED",
          field: String(firstIssue?.path[0] ?? "effectiveAt"),
        },
      });
    }

    return this.store.withLock(async () => {
      const tournament = this.store.tournaments.get(tournamentId);
      if (!tournament) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy giải đấu.",
          details: { reason: "RESOURCE_NOT_FOUND", tournamentId },
        });
      }

      const contract = this.store.contracts.get(tournament.contractId);
      if (!contract) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy hợp đồng.",
          details: { reason: "RESOURCE_NOT_FOUND", contractId: tournament.contractId },
        });
      }

      const nowIso = this.store.nowIso();
      assertTaContractOrTournamentAccess(actor, contract, {
        mode: "OPERATE_EXISTING",
        tournament,
        serverNowIso: nowIso,
      });

      if (parsed.data.expectedRevision !== tournament.revision) {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: "Phiên bản giải đấu đã thay đổi. Vui lòng đồng bộ lại.",
          details: {
            reason: "STALE_VERSION",
            expectedRevision: parsed.data.expectedRevision,
            currentRevision: tournament.revision,
            tournamentId,
          },
        });
      }

      if (Date.parse(parsed.data.effectiveAt) < Date.parse(nowIso)) {
        throw createTournamentError({
          code: "VALIDATION_ERROR",
          statusCode: 400,
          message: "Thời điểm áp dụng phiên bản luật mới (effectiveAt) không được nằm trong quá khứ.",
          details: {
            reason: "EFFECTIVE_AT_IN_PAST",
            field: "effectiveAt",
            tournamentId,
          },
        });
      }

      const mergedRules = TournamentRuleProfileSchema.parse({
        ...tournament.ruleProfile,
        ...parsed.data.ruleProfilePatch,
      });

      const envelopeCheck = evaluateRuleProfileEnvelope(
        mergedRules,
        contract.policyEnvelope
      );
      if (!envelopeCheck.withinEnvelope) {
        const first = envelopeCheck.violations[0]!;
        throw createTournamentError({
          code: "VALIDATION_ERROR",
          statusCode: 400,
          message: `${first.message} Thay đổi ngoài phạm vi hợp đồng không được phát hành trực tiếp.`,
          details: {
            reason: "RULE_PROFILE_OUTSIDE_CONTRACT_ENVELOPE",
            field: first.field,
            tournamentId,
          },
        });
      }

      const existingVersions = this.store.configVersions.get(tournament.id) ?? [];
      const nextVersionNumber = existingVersions.length + 1;
      const versionId = randomUUID();

      const publishedVersion = TournamentConfigVersionSchema.parse({
        id: versionId,
        tournamentId: tournament.id,
        versionNumber: nextVersionNumber,
        coreConfigSnapshot: tournament.coreConfig,
        ruleProfileSnapshot: mergedRules,
        effectiveAt: parsed.data.effectiveAt,
        publishedByUserId: actor.userId,
        changeSummary: parsed.data.changeSummary,
        createdAt: nowIso,
      });

      if (this.database) {
        await persistConfigVersionToPrisma(this.database, publishedVersion);
      }
      this.store.configVersions.set(tournament.id, [...existingVersions, publishedVersion]);

      const updatedTournament = TournamentDtoSchema.parse({
        ...tournament,
        ruleProfile: mergedRules,
        revision: tournament.revision + 1,
        activeConfigVersionId: versionId,
        activeConfigVersionNumber: nextVersionNumber,
        updatedAt: nowIso,
      });
      if (this.database) {
        await persistTournamentToPrisma(this.database, updatedTournament);
      }
      this.store.tournaments.set(tournament.id, updatedTournament);

      this.store.audit.append({
        actorUserId: actor.userId,
        actorRole: "TOURNAMENT_ADMIN",
        action: "RULE_VERSION_PUBLISHED",
        targetType: "RULE_VERSION",
        targetId: versionId,
        beforeSnapshot: { ruleProfile: tournament.ruleProfile },
        afterSnapshot: publishedVersion,
        reason: parsed.data.changeSummary,
        correlationId: actor.correlationId ?? null,
        nowIso,
      });

      return { tournament: updatedTournament, publishedVersion };
    });
  }

  /**
   * Builds an authoritative readiness snapshot from calculated participant and staff counts.
   */
  private buildReadinessSnapshot(
    tournament: TournamentDto,
    counts: { eligibleParticipantsCount: number; botNotReadyCount: number },
    staff: { activeStaffCount: number; activeRefereeCount: number }
  ): TournamentReadinessSnapshot {
    const tournamentId = tournament.id;
    const nowIso = this.store.nowIso();
    const { eligibleParticipantsCount, botNotReadyCount } = counts;
    const { activeStaffCount, activeRefereeCount } = staff;

    let pendingManualAdjudicationsCount = 0;
    this.adjudicationLedgerService?.sweepExpiredAdjudicationsSync(tournamentId);
    for (const adj of this.store.adjudicationRequests.values()) {
      if (adj.tournamentId === tournamentId && adj.status === "WAITING") {
        pendingManualAdjudicationsCount += 1;
      }
    }

    const checklist: ReadinessChecklistItem[] = [];
    const blockers: string[] = [];

    // 1. Approval status
    const isApprovedOrBeyond =
      tournament.status === "APPROVED" ||
      tournament.status === "SCHEDULED" ||
      tournament.status === "RUNNING" ||
      tournament.status === "PAUSED" ||
      tournament.status === "ENDED";
    if (isApprovedOrBeyond) {
      checklist.push({
        code: "APPROVAL_STATUS",
        title: "Phê duyệt cấp hệ thống (Admin Approval)",
        status: "PASS",
        detail: `Giải đấu đã được phê duyệt (${tournament.status}).`,
      });
    } else {
      checklist.push({
        code: "APPROVAL_STATUS",
        title: "Phê duyệt cấp hệ thống (Admin Approval)",
        status: "BLOCKED",
        detail: `Giải đấu chưa được phê duyệt (hiện tại: ${tournament.status}).`,
        blockerCode: "TOURNAMENT_NOT_APPROVED",
      });
      blockers.push("TOURNAMENT_NOT_APPROVED");
    }

    // 2. Published rule version
    if (tournament.activeConfigVersionNumber >= 1) {
      checklist.push({
        code: "RULE_VERSION_PUBLISHED",
        title: "Phiên bản cấu hình & luật thi đấu",
        status: "PASS",
        detail: `Đã phát hành phiên bản cấu hình v${tournament.activeConfigVersionNumber}.`,
      });
    } else {
      checklist.push({
        code: "RULE_VERSION_PUBLISHED",
        title: "Phiên bản cấu hình & luật thi đấu",
        status: "BLOCKED",
        detail: "Chưa có phiên bản cấu hình & luật nào được phát hành.",
        blockerCode: "NO_ACTIVE_RULE_VERSION",
      });
      blockers.push("NO_ACTIVE_RULE_VERSION");
    }

    // 3. Rule Profile validity (Engine N02)
    let ruleValid = true;
    let ruleErrorMessage = "";
    const rawProfile = tournament.ruleProfile as any;
    if (rawProfile && typeof rawProfile.board === "object" && rawProfile.board !== null && Array.isArray(rawProfile.layout)) {
      const issues = validateRuleProfileForPreview(rawProfile);
      if (issues.length > 0) {
        ruleValid = false;
        ruleErrorMessage = issues.map((i) => i.message).join("; ");
      }
    } else {
      const validVersions = new Set(["rps-v1", "rps-v2", "rps-custom-v1"]);
      if (!validVersions.has(tournament.ruleProfile.rulesVersion)) {
        ruleValid = false;
        ruleErrorMessage = `Phiên bản luật "${tournament.ruleProfile.rulesVersion}" không được hỗ trợ.`;
      }
    }

    if (ruleValid) {
      checklist.push({
        code: "RULE_PROFILE_VALID",
        title: "Tính hợp lệ của cấu hình luật thi đấu",
        status: "PASS",
        detail: "Cấu hình luật thi đấu hợp lệ theo engine.",
      });
    } else {
      checklist.push({
        code: "RULE_PROFILE_VALID",
        title: "Tính hợp lệ của cấu hình luật thi đấu",
        status: "BLOCKED",
        detail: `Cấu hình luật chưa hợp lệ: ${ruleErrorMessage}`,
        blockerCode: "RULE_PROFILE_INVALID",
      });
      blockers.push("RULE_PROFILE_INVALID");
    }

    // 4. Referee gate (if refereeRequired is toggled on)
    if (tournament.coreConfig.refereeRequired) {
      const minRef = tournament.coreConfig.minReadyOnlineReferees ?? 1;
      if (activeRefereeCount >= minRef) {
        checklist.push({
          code: "REFEREE_GATE",
          title: "Đội ngũ trọng tài được chấp thuận",
          status: "PASS",
          detail: `Có ${activeRefereeCount}/${minRef} trọng tài sẵn sàng điều hành.`,
        });
      } else {
        checklist.push({
          code: "REFEREE_GATE",
          title: "Đội ngũ trọng tài được chấp thuận",
          status: "BLOCKED",
          detail: `Cần ít nhất ${minRef} trọng tài accepted/active (hiện có: ${activeRefereeCount}).`,
          blockerCode: "INSUFFICIENT_ACCEPTED_REFEREES",
        });
        blockers.push("INSUFFICIENT_ACCEPTED_REFEREES");
      }
    }

    // 5. Minimum eligible participants
    const minRequired = tournament.coreConfig.minParticipantsToStart;
    if (eligibleParticipantsCount >= minRequired) {
      checklist.push({
        code: "MIN_ELIGIBLE_PARTICIPANTS",
        title: "Số lượng thí sinh đủ điều kiện tối thiểu",
        status: "PASS",
        detail: `Có ${eligibleParticipantsCount}/${minRequired} thí sinh đủ điều kiện.`,
      });
    } else {
      checklist.push({
        code: "MIN_ELIGIBLE_PARTICIPANTS",
        title: "Số lượng thí sinh đủ điều kiện tối thiểu",
        status: "BLOCKED",
        detail: `Mới có ${eligibleParticipantsCount}/${minRequired} thí sinh đủ điều kiện${botNotReadyCount > 0 ? ` (${botNotReadyCount} thí sinh chưa có Bot hợp lệ)` : ""}.`,
        blockerCode: "INSUFFICIENT_ELIGIBLE_PARTICIPANTS",
      });
      blockers.push("INSUFFICIENT_ELIGIBLE_PARTICIPANTS");
    }

    // 6. Bot readiness check (if BOT_VS_BOT)
    if (tournament.coreConfig.competitionMode === "BOT_VS_BOT") {
      if (botNotReadyCount === 0 && eligibleParticipantsCount > 0) {
        checklist.push({
          code: "BOT_READINESS",
          title: "Kiểm tra mã nguồn & runtime Bot",
          status: "PASS",
          detail: "Tất cả Bot của thí sinh đã sẵn sàng thi đấu.",
        });
      } else if (botNotReadyCount > 0) {
        checklist.push({
          code: "BOT_READINESS",
          title: "Kiểm tra mã nguồn & runtime Bot",
          status: "BLOCKED",
          detail: `Còn ${botNotReadyCount} thí sinh chưa hoàn thành kiểm tra Bot hợp lệ.`,
          blockerCode: "BOT_NOT_READY",
        });
        blockers.push("BOT_NOT_READY");
      }
    }

    // 7. Pending change requests
    let hasPendingCr = false;
    for (const cr of this.store.changeRequests.values()) {
      if (cr.tournamentId === tournamentId && cr.status === "PENDING") {
        hasPendingCr = true;
        break;
      }
    }
    if (hasPendingCr) {
      checklist.push({
        code: "PENDING_CHANGE_REQUESTS",
        title: "Yêu cầu thay đổi cấu hình đang chờ duyệt",
        status: "WARN",
        detail: "Có ChangeRequest đang chờ Admin phê duyệt.",
      });
    }

    // 8. Pending manual adjudications (blocks finalization)
    if (pendingManualAdjudicationsCount === 0) {
      checklist.push({
        code: "NO_PENDING_ADJUDICATION",
        title: "Phán quyết thủ công tồn đọng",
        status: "PASS",
        detail: "Không có trận đấu nào đang chờ phán quyết thủ công.",
      });
    } else {
      checklist.push({
        code: "NO_PENDING_ADJUDICATION",
        title: "Phán quyết thủ công tồn đọng",
        status: "WARN",
        detail: `Đang có ${pendingManualAdjudicationsCount} trận chờ TA phán quyết (chặn chốt giải).`,
        blockerCode: "PENDING_MANUAL_ADJUDICATION",
      });
    }

    const startBlockers = blockers.filter(
      (b) =>
        b === "TOURNAMENT_NOT_APPROVED" ||
        b === "NO_ACTIVE_RULE_VERSION" ||
        b === "RULE_PROFILE_INVALID" ||
        b === "INSUFFICIENT_ACCEPTED_REFEREES" ||
        b === "INSUFFICIENT_ELIGIBLE_PARTICIPANTS" ||
        b === "BOT_NOT_READY"
    );

    const canOpenScheduled =
      tournament.status === "APPROVED" &&
      !blockers.includes("TOURNAMENT_NOT_APPROVED") &&
      !blockers.includes("NO_ACTIVE_RULE_VERSION");

    const canStartRunning =
      (tournament.status === "APPROVED" || tournament.status === "SCHEDULED") &&
      startBlockers.length === 0;

    const canFinalize =
      tournament.status === "ENDED" && pendingManualAdjudicationsCount === 0;

    const readinessState =
      canOpenScheduled && canStartRunning && blockers.length === 0
        ? "READY"
        : "NOT_READY";

    return TournamentReadinessSnapshotSchema.parse({
      tournamentId,
      status: tournament.status,
      canOpenScheduled,
      canStartRunning,
      canFinalize,
      eligibleParticipantsCount,
      minParticipantsRequired: minRequired,
      activeStaffCount,
      activeRefereeCount,
      pendingManualAdjudicationsCount,
      activeRuleVersionNumber: tournament.activeConfigVersionNumber,
      checklist,
      blockers,
      evaluatedAt: nowIso,
      readinessState,
    });
  }

  /**
   * T025 & T026: Computes authoritative readiness from actual enrollments, bot readiness,
   * published rule versions, staff assignments, and pending manual adjudications.
   */
  evaluateReadiness(
    tournamentId: string,
    transactionClient?: Prisma.TransactionClient,
  ): TournamentReadinessSnapshot {
    const tournament = this.store.tournaments.get(tournamentId);
    if (!tournament) {
      throw createTournamentError({
        code: "NOT_FOUND",
        statusCode: 404,
        message: "Không tìm thấy giải đấu.",
        details: { reason: "RESOURCE_NOT_FOUND", tournamentId },
      });
    }

    const countsOrPromise = this.readinessSourcesPort.countParticipants(tournament, transactionClient);
    const staffOrPromise = this.readinessSourcesPort.countStaff(tournamentId, transactionClient);

    if (countsOrPromise instanceof Promise || staffOrPromise instanceof Promise) {
      const asyncPromise = (async () => {
        const counts = await countsOrPromise;
        const staff = await staffOrPromise;
        return this.buildReadinessSnapshot(tournament, counts, staff);
      })();
      return asyncPromise as any;
    }

    return this.buildReadinessSnapshot(
      tournament,
      countsOrPromise,
      staffOrPromise
    );
  }

  async openScheduled(
    actor: TournamentActorContext,
    tournamentId: string,
    expectedRevision?: number
  ): Promise<TournamentDto> {
    return this.store.withLock(async () => {
      const tournament = this.store.tournaments.get(tournamentId);
      if (!tournament) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy giải đấu.",
          details: { reason: "RESOURCE_NOT_FOUND", tournamentId },
        });
      }
      const contract = this.store.contracts.get(tournament.contractId)!;
      const nowIso = this.store.nowIso();
      assertTaContractOrTournamentAccess(actor, contract, {
        mode: "OPERATE_EXISTING",
        tournament,
        serverNowIso: nowIso,
      });
      this.assertExpectedRevision(tournament, expectedRevision);

      const readiness = this.evaluateReadiness(tournamentId);
      if (!readiness.canOpenScheduled) {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: "Giải đấu chưa đạt điều kiện chuyển sang SCHEDULED.",
          details: {
            reason: "READINESS_BLOCKED",
            blockerCode: readiness.blockers[0] ?? "TOURNAMENT_NOT_APPROVED",
            tournamentId,
          },
        });
      }

      const updated = TournamentDtoSchema.parse({
        ...tournament,
        status: "SCHEDULED",
        revision: tournament.revision + 1,
        updatedAt: nowIso,
      });
      this.store.tournaments.set(tournamentId, updated);
      this.store.audit.append({
        actorUserId: actor.userId,
        actorRole: "TOURNAMENT_ADMIN",
        action: "TOURNAMENT_SCHEDULED",
        targetType: "TOURNAMENT",
        targetId: tournamentId,
        beforeSnapshot: tournament,
        afterSnapshot: updated,
        correlationId: actor.correlationId ?? null,
        nowIso,
      });
      return updated;
    });
  }

  async startRunning(
    actor: TournamentActorContext,
    tournamentId: string,
    expectedRevision?: number
  ): Promise<TournamentDto> {
    return this.store.withLock(async () => {
      const before = this.store.tournaments.get(tournamentId);
      if (!before) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy giải đấu.",
          details: { reason: "RESOURCE_NOT_FOUND", tournamentId },
        });
      }
      const auditLength = this.store.auditRecords.length;
      let stagedCommit: { tournament: TournamentDto; before: TournamentDto; nowIso: string } | undefined;
      const applyInMemoryCommit = (commit: { tournament: TournamentDto; before: TournamentDto; nowIso: string }) => {
        this.store.tournaments.set(tournamentId, commit.tournament);
        this.store.audit.append({
          actorUserId: actor.userId,
          actorRole: "TOURNAMENT_ADMIN",
          action: "TOURNAMENT_STARTED",
          targetType: "TOURNAMENT",
          targetId: tournamentId,
          beforeSnapshot: commit.before,
          afterSnapshot: commit.tournament,
          correlationId: actor.correlationId ?? null,
          nowIso: commit.nowIso,
        });
      };

      const transition = async (transactionClient?: Prisma.TransactionClient): Promise<TournamentDto> => {
        const tournament = this.store.tournaments.get(tournamentId) ?? before;
        const contract = this.store.contracts.get(tournament.contractId)!;
        const nowIso = this.store.nowIso();
        assertTaContractOrTournamentAccess(actor, contract, {
          mode: "OPERATE_EXISTING",
          tournament,
          serverNowIso: nowIso,
        });
        this.assertExpectedRevision(tournament, expectedRevision);

        const readiness = await this.evaluateReadiness(tournamentId, transactionClient);
        if (!readiness.canStartRunning) {
          throw createTournamentError({
            code: "CONFLICT",
            statusCode: 409,
            message: `Giải đấu chưa đủ điều kiện bắt đầu (${readiness.blockers.join(", ")}).`,
            details: {
              reason: "READINESS_BLOCKED",
              blockerCode: readiness.blockers[0] ?? "INSUFFICIENT_ELIGIBLE_PARTICIPANTS",
              tournamentId,
            },
          });
        }

        if (this.acknowledgementGuard && tournament.activeConfigVersionId) {
          await this.acknowledgementGuard.assertReadyForStart(
            tournamentId,
            tournament.activeConfigVersionId,
            transactionClient,
          );
        }

        // Re-read every mutable readiness source after the ACK check. This
        // closes the in-process TOCTOU window where a referee is revoked while
        // the durable ACK transaction is in flight. The PostgreSQL boundary
        // additionally holds the shared advisory lock through this commit.
        const finalReadiness = await this.evaluateReadiness(tournamentId, transactionClient);
        if (!finalReadiness.canStartRunning) {
          throw createTournamentError({
            code: "CONFLICT",
            statusCode: 409,
            message: `Giải đấu chưa đủ điều kiện bắt đầu (${finalReadiness.blockers.join(", ")}).`,
            details: {
              reason: "READINESS_BLOCKED",
              blockerCode: finalReadiness.blockers[0] ?? "INSUFFICIENT_ELIGIBLE_PARTICIPANTS",
              tournamentId,
            },
          });
        }

        const updated = TournamentDtoSchema.parse({
          ...tournament,
          status: "RUNNING",
          revision: tournament.revision + 1,
          startedAt: tournament.startedAt ?? nowIso,
          updatedAt: nowIso,
        });

        if (transactionClient && "tournament" in transactionClient) {
          const durable = await transactionClient.tournament.updateMany({
            where: {
              id: tournamentId,
              status: { in: ["APPROVED", "SCHEDULED"] },
              revision: tournament.revision,
            },
            data: {
              status: "RUNNING",
              revision: { increment: 1 },
              startedAt: new Date(updated.startedAt ?? nowIso),
              updatedAt: new Date(nowIso),
            },
          });
          if (durable.count !== 1) {
            throw createTournamentError({
              code: "CONFLICT",
              statusCode: 409,
              message: "Trạng thái giải đấu đã thay đổi trong lúc bắt đầu.",
              details: { reason: "LIFECYCLE_CONCURRENT_UPDATE", tournamentId },
              retryable: true,
            });
          }
          await transactionClient.tournamentAuditLogRecord.create({
            data: {
              id: randomUUID(), actorUserId: actor.userId, actorRole: "TOURNAMENT_ADMIN",
              action: "TOURNAMENT_STARTED", targetType: "TOURNAMENT", targetId: tournamentId,
              beforeSnapshot: tournament, afterSnapshot: updated,
              correlationId: actor.correlationId ?? null, createdAt: new Date(nowIso),
            },
          });
        }

        if (transactionClient && "tournament" in transactionClient) {
          // Keep the process-local projection staged until the database
          // transaction has actually committed. This is essential when a
          // serializable retry (P2034) re-enters the callback.
          stagedCommit = { tournament: updated, before: tournament, nowIso };
        } else {
          applyInMemoryCommit({ tournament: updated, before: tournament, nowIso });
        }
        return updated;
      };

      try {
        const result = this.startTransaction
          ? await this.startTransaction.run(tournamentId, transition)
          : await transition();
        if (stagedCommit) applyInMemoryCommit(stagedCommit);
        return result;
      } catch (error) {
        // A boundary may explicitly mark a response as lost after durable
        // commit; apply the staged projection so a retry observes RUNNING.
        // Ordinary failures (including P2034 retries that ultimately exhaust)
        // restore the exact pre-transition state and audit length.
        if ((error as { committed?: boolean }).committed) {
          if (stagedCommit) applyInMemoryCommit(stagedCommit);
        } else {
          this.store.tournaments.set(tournamentId, before);
          this.store.auditRecords.splice(auditLength);
        }
        throw error;
      }
    });
  }

  /**
   * T027: PAUSED stops new match admission without altering scheduledEndAt.
   * Differentiates ADMISSION_PAUSE_ONLY (default) vs FULL_MATCH_STOP (freezes active matches).
   */
  async pauseTournament(
    actor: TournamentActorContext,
    tournamentId: string,
    reason: string,
    expectedRevision?: number,
    pauseMode: "ADMISSION_PAUSE_ONLY" | "FULL_MATCH_STOP" = "ADMISSION_PAUSE_ONLY"
  ): Promise<TournamentDto> {
    if (!reason || reason.trim().length < 3) {
      throw createTournamentError({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: "Vui lòng nhập lý do tạm dừng giải đấu (ít nhất 3 ký tự).",
        details: { reason: "SCHEMA_VALIDATION_FAILED", field: "reason" },
      });
    }

    return this.store.withLock(async () => {
      const tournament = this.store.tournaments.get(tournamentId);
      if (!tournament) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy giải đấu.",
          details: { reason: "RESOURCE_NOT_FOUND", tournamentId },
        });
      }
      const contract = this.store.contracts.get(tournament.contractId)!;
      const nowIso = this.store.nowIso();
      assertTaContractOrTournamentAccess(actor, contract, {
        mode: "OPERATE_EXISTING",
        tournament,
        serverNowIso: nowIso,
      });
      this.assertExpectedRevision(tournament, expectedRevision);

      if (tournament.status !== "RUNNING") {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: `Chỉ có thể tạm dừng khi giải đang RUNNING (hiện tại: ${tournament.status}).`,
          details: {
            reason: "INVALID_STATE_TRANSITION",
            status: tournament.status,
            tournamentId,
          },
        });
      }

      // If FULL_MATCH_STOP is requested, pause all in-progress matches for this tournament
      let stoppedMatchesCount = 0;
      if (pauseMode === "FULL_MATCH_STOP") {
        for (const [matchId, match] of this.store.matches.entries()) {
          if (match.tournamentId === tournamentId && match.status === "RUNNING") {
            this.store.matches.set(matchId, {
              ...match,
              status: "PAUSED",
            });
            stoppedMatchesCount += 1;
          }
        }
      }

      const updated = TournamentDtoSchema.parse({
        ...tournament,
        status: "PAUSED",
        revision: tournament.revision + 1,
        pausedAt: nowIso,
        pauseReason: reason.trim(),
        updatedAt: nowIso,
      });
      this.store.tournaments.set(tournamentId, updated);
      this.store.audit.append({
        actorUserId: actor.userId,
        actorRole: "TOURNAMENT_ADMIN",
        action: "TOURNAMENT_PAUSED",
        targetType: "TOURNAMENT",
        targetId: tournamentId,
        beforeSnapshot: tournament,
        afterSnapshot: updated,
        reason: `${reason.trim()} (mode: ${pauseMode}, stoppedMatches: ${stoppedMatchesCount})`,
        correlationId: actor.correlationId ?? null,
        nowIso,
      });
      return updated;
    });
  }

  async resumeTournament(
    actor: TournamentActorContext,
    tournamentId: string,
    expectedRevision?: number
  ): Promise<TournamentDto> {
    return this.store.withLock(async () => {
      const tournament = this.store.tournaments.get(tournamentId);
      if (!tournament) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy giải đấu.",
          details: { reason: "RESOURCE_NOT_FOUND", tournamentId },
        });
      }
      const contract = this.store.contracts.get(tournament.contractId)!;
      const nowIso = this.store.nowIso();
      assertTaContractOrTournamentAccess(actor, contract, {
        mode: "OPERATE_EXISTING",
        tournament,
        serverNowIso: nowIso,
      });
      this.assertExpectedRevision(tournament, expectedRevision);

      if (tournament.status !== "PAUSED") {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: `Chỉ có thể tiếp tục khi giải đang PAUSED (hiện tại: ${tournament.status}).`,
          details: {
            reason: "INVALID_STATE_TRANSITION",
            status: tournament.status,
            tournamentId,
          },
        });
      }

      // T028: If scheduledEndAt has already passed while PAUSED, transition to ENDED instead of RUNNING
      if (Date.parse(nowIso) >= Date.parse(tournament.coreConfig.scheduledEndAt)) {
        const ended = TournamentDtoSchema.parse({
          ...tournament,
          status: "ENDED",
          revision: tournament.revision + 1,
          endedAt: nowIso,
          updatedAt: nowIso,
        });
        this.store.tournaments.set(tournamentId, ended);
        return ended;
      }

      // Resume any matches of this tournament that were PAUSED
      for (const [matchId, match] of this.store.matches.entries()) {
        if (match.tournamentId === tournamentId && match.status === "PAUSED") {
          this.store.matches.set(matchId, {
            ...match,
            status: "RUNNING",
          });
        }
      }

      const updated = TournamentDtoSchema.parse({
        ...tournament,
        status: "RUNNING",
        revision: tournament.revision + 1,
        pausedAt: null,
        pauseReason: null,
        updatedAt: nowIso,
      });
      this.store.tournaments.set(tournamentId, updated);
      this.store.audit.append({
        actorUserId: actor.userId,
        actorRole: "TOURNAMENT_ADMIN",
        action: "TOURNAMENT_RESUMED",
        targetType: "TOURNAMENT",
        targetId: tournamentId,
        beforeSnapshot: tournament,
        afterSnapshot: updated,
        correlationId: actor.correlationId ?? null,
        nowIso,
      });
      return updated;
    });
  }

  /**
   * T028: Automatically transitions RUNNING or PAUSED tournaments to ENDED when
   * serverNow >= scheduledEndAt, without auto-extending scheduledEndAt.
   */
  async evaluateAutoEndAtWindow(serverNowIso?: string): Promise<TournamentDto[]> {
    return this.store.withLock(() => {
      const nowIso = serverNowIso ?? this.store.nowIso();
      const nowMs = Date.parse(nowIso);
      const endedTournaments: TournamentDto[] = [];

      for (const [id, tournament] of this.store.tournaments.entries()) {
        if (tournament.status !== "RUNNING" && tournament.status !== "PAUSED") {
          continue;
        }
        const scheduledEndMs = Date.parse(tournament.coreConfig.scheduledEndAt);
        if (nowMs >= scheduledEndMs) {
          const updated = TournamentDtoSchema.parse({
            ...tournament,
            status: "ENDED",
            revision: tournament.revision + 1,
            endedAt: nowIso,
            updatedAt: nowIso,
          });
          this.store.tournaments.set(id, updated);
          this.store.audit.append({
            actorUserId: "SYSTEM_SCHEDULER",
            actorRole: "ADMIN",
            action: "TOURNAMENT_AUTO_ENDED",
            targetType: "TOURNAMENT",
            targetId: id,
            beforeSnapshot: tournament,
            afterSnapshot: updated,
            reason: `Đã đến thời điểm kết thúc theo lịch (${tournament.coreConfig.scheduledEndAt})`,
            nowIso,
          });
          endedTournaments.push(updated);
        }
      }

      return endedTournaments;
    });
  }

  /**
   * T013 & T029: Cancels a tournament before ENDED.
   * - Never refunds quota if the tournament was ever APPROVED (everApproved === true).
   * - Atomically cancels all WAITING ManualAdjudicationRequests for this tournament.
   * - Atomically cancels all in-progress matches and pending change requests.
   */
  async cancelTournament(
    actor: TournamentActorContext,
    tournamentId: string,
    reason: string,
    expectedRevision?: number
  ): Promise<{
    tournament: TournamentDto;
    cancelledAdjudicationsCount: number;
    cancelledMatchesCount: number;
    cancelledChangeRequestsCount: number;
  }> {
    if (!reason || reason.trim().length < 3) {
      throw createTournamentError({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: "Bắt buộc nhập lý do hủy giải đấu (ít nhất 3 ký tự).",
        details: { reason: "SCHEMA_VALIDATION_FAILED", field: "reason" },
      });
    }

    return this.store.withLock(async () => {
      const tournament = this.store.tournaments.get(tournamentId);
      if (!tournament) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy giải đấu.",
          details: { reason: "RESOURCE_NOT_FOUND", tournamentId },
        });
      }

      const contract = this.store.contracts.get(tournament.contractId)!;
      const nowIso = this.store.nowIso();

      if (!actor.roles.includes("ADMIN")) {
        assertTaContractOrTournamentAccess(actor, contract, {
          mode: "OPERATE_EXISTING",
          tournament,
          serverNowIso: nowIso,
        });
      }
      this.assertExpectedRevision(tournament, expectedRevision);

      if (
        tournament.status === "ENDED" ||
        tournament.status === "CANCELLED" ||
        tournament.status === "ARCHIVED" ||
        tournament.status === "REJECTED"
      ) {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: `Không thể hủy giải đấu đã ở trạng thái kết thúc (${tournament.status}).`,
          details: {
            reason: "INVALID_STATE_TRANSITION",
            status: tournament.status,
            tournamentId,
          },
        });
      }

      // 1. Atomically cancel any WAITING manual adjudications (T029)
      let cancelledAdjudicationsCount = 0;
      for (const [adjId, adj] of this.store.adjudicationRequests.entries()) {
        if (adj.tournamentId === tournamentId && adj.status === "WAITING") {
          const cancelled = {
            ...adj,
            status: "CANCELLED",
            decisionReason: `Giải đấu bị hủy: ${reason.trim()}`,
            decidedAt: nowIso,
            updatedAt: nowIso,
          } as typeof adj;
          if (this.database) {
            await persistAdjudicationRequestToPrisma(this.database, cancelled);
          }
          this.store.adjudicationRequests.set(adjId, cancelled);
          cancelledAdjudicationsCount += 1;
        }
      }

      // 2. Atomically cancel any in-progress matches
      let cancelledMatchesCount = 0;
      for (const [matchId, match] of this.store.matches.entries()) {
        if (
          match.tournamentId === tournamentId &&
          (match.status === "RUNNING" ||
            match.status === "PAUSED" ||
            match.status === "PAUSED_ADJUDICATION")
        ) {
          this.store.matches.set(matchId, {
            ...match,
            status: "CANCELLED",
            endedAt: nowIso,
          });
          cancelledMatchesCount += 1;
        }
      }

      // 3. Atomically cancel any PENDING ChangeRequests
      let cancelledChangeRequestsCount = 0;
      for (const [crId, cr] of this.store.changeRequests.entries()) {
        if (cr.tournamentId === tournamentId && cr.status === "PENDING") {
          const cancelledCr = {
            ...cr,
            status: "CANCELLED",
            reviewNote: `Giải đấu bị hủy: ${reason.trim()}`,
            reviewedAt: nowIso,
            updatedAt: nowIso,
          } as typeof cr;
          if (this.database) {
            await persistChangeRequestToPrisma(this.database, cancelledCr);
          }
          this.store.changeRequests.set(crId, cancelledCr);
          cancelledChangeRequestsCount += 1;
        }
      }

      // 4. Notice: T013 — Quota refund invariant
      let quotaRefunded = tournament.quotaRefunded;
      if (!tournament.everApproved && !tournament.quotaRefunded) {
        contract.quotaReservedCount = Math.max(0, contract.quotaReservedCount - 1);
        quotaRefunded = true;
      }

      const updated = TournamentDtoSchema.parse({
        ...tournament,
        status: "CANCELLED",
        revision: tournament.revision + 1,
        quotaRefunded,
        cancelledAt: nowIso,
        cancelReason: reason.trim(),
        updatedAt: nowIso,
      });
      this.store.tournaments.set(tournamentId, updated);

      this.store.audit.append({
        actorUserId: actor.userId,
        actorRole: actor.roles.includes("ADMIN") ? "ADMIN" : "TOURNAMENT_ADMIN",
        action: "TOURNAMENT_CANCELLED",
        targetType: "TOURNAMENT",
        targetId: tournamentId,
        beforeSnapshot: tournament,
        afterSnapshot: updated,
        reason: reason.trim(),
        correlationId: actor.correlationId ?? null,
        nowIso,
      });

      return {
        tournament: updated,
        cancelledAdjudicationsCount,
        cancelledMatchesCount,
        cancelledChangeRequestsCount,
      };
    });
  }

  /**
   * T030: Finalizes an ENDED tournament only when zero WAITING ManualAdjudicationRequests remain.
   */
  async finalizeTournament(
    actor: TournamentActorContext,
    tournamentId: string,
    expectedRevision?: number
  ): Promise<TournamentDto> {
    return this.store.withLock(async () => {
      const tournament = this.store.tournaments.get(tournamentId);
      if (!tournament) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy giải đấu.",
          details: { reason: "RESOURCE_NOT_FOUND", tournamentId },
        });
      }
      const contract = this.store.contracts.get(tournament.contractId)!;
      const nowIso = this.store.nowIso();
      assertTaContractOrTournamentAccess(actor, contract, {
        mode: "OPERATE_EXISTING",
        tournament,
        serverNowIso: nowIso,
      });
      this.assertExpectedRevision(tournament, expectedRevision);

      if (tournament.status !== "ENDED") {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: `Chỉ có thể chốt kết quả khi giải đã ENDED (hiện tại: ${tournament.status}).`,
          details: {
            reason: "INVALID_STATE_TRANSITION",
            status: tournament.status,
            tournamentId,
          },
        });
      }

      this.adjudicationLedgerService?.sweepExpiredAdjudicationsSync(tournamentId);

      for (const adj of this.store.adjudicationRequests.values()) {
        if (adj.tournamentId === tournamentId && adj.status === "WAITING") {
          throw createTournamentError({
            code: "CONFLICT",
            statusCode: 409,
            message:
              "Chưa thể chốt giải đấu (AUTO_FINAL / TA_CONFIRMATION) khi vẫn còn trận đấu đang chờ phán quyết thủ công (WAITING).",
            details: {
              reason: "PENDING_MANUAL_ADJUDICATION",
              adjudicationRequestId: adj.id,
              tournamentId,
            },
          });
        }
      }

      const updated = TournamentDtoSchema.parse({
        ...tournament,
        status: "ARCHIVED",
        revision: tournament.revision + 1,
        finalizedAt: nowIso,
        updatedAt: nowIso,
      });
      this.store.tournaments.set(tournamentId, updated);
      this.store.audit.append({
        actorUserId: actor.userId,
        actorRole: "TOURNAMENT_ADMIN",
        action: "TOURNAMENT_FINALIZED",
        targetType: "TOURNAMENT",
        targetId: tournamentId,
        beforeSnapshot: tournament,
        afterSnapshot: updated,
        correlationId: actor.correlationId ?? null,
        nowIso,
      });
      return updated;
    });
  }

  /**
   * BR-07, T024: Allows the requesting TA or an Admin to cancel a PENDING ChangeRequest.
   */
  async cancelChangeRequest(
    actor: TournamentActorContext,
    tournamentId: string,
    changeRequestId: string,
    reason?: string
  ): Promise<TournamentChangeRequestDto> {
    return this.store.withLock(async () => {
      const cr = this.store.changeRequests.get(changeRequestId);
      if (!cr || cr.tournamentId !== tournamentId) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy yêu cầu thay đổi cấu hình (ChangeRequest).",
          details: { reason: "RESOURCE_NOT_FOUND", changeRequestId },
        });
      }

      if (cr.status !== "PENDING") {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: `ChangeRequest đang ở trạng thái "${cr.status}", chỉ có thể hủy khi đang PENDING.`,
          details: { reason: "INVALID_STATE_TRANSITION", status: cr.status },
        });
      }

      const tournament = this.store.tournaments.get(tournamentId);
      if (!tournament) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy giải đấu.",
          details: { reason: "RESOURCE_NOT_FOUND", tournamentId },
        });
      }

      const contract = this.store.contracts.get(tournament.contractId);
      const nowIso = this.store.nowIso();
      if (!actor.roles.includes("ADMIN")) {
        if (contract) {
          assertTaContractOrTournamentAccess(actor, contract, {
            mode: "OPERATE_EXISTING",
            tournament,
            serverNowIso: nowIso,
          });
        }
        if (cr.requestedByTaUserId !== actor.userId) {
          throw createTournamentError({
            code: "UNAUTHORIZED",
            statusCode: 403,
            message: "Bạn không có quyền hủy ChangeRequest do người khác tạo.",
            details: { reason: "FORBIDDEN_ROLE" },
          });
        }
      }

      const updatedCr = TournamentChangeRequestSchema.parse({
        ...cr,
        status: "CANCELLED",
        reviewNote: reason?.trim() || "TA chủ động hủy yêu cầu thay đổi.",
        reviewedAt: nowIso,
        updatedAt: nowIso,
      });
      if (this.database) {
        await persistChangeRequestToPrisma(this.database, updatedCr);
      }
      this.store.changeRequests.set(changeRequestId, updatedCr);

      this.store.audit.append({
        actorUserId: actor.userId,
        actorRole: actor.roles.includes("ADMIN") ? "ADMIN" : "TOURNAMENT_ADMIN",
        action: "CHANGE_REQUEST_CANCELLED",
        targetType: "CHANGE_REQUEST",
        targetId: changeRequestId,
        beforeSnapshot: cr,
        afterSnapshot: updatedCr,
        reason: reason?.trim() || "TA chủ động hủy yêu cầu thay đổi.",
        correlationId: actor.correlationId ?? null,
        nowIso,
      });

      return updatedCr;
    });
  }

  /**
   * T026: Scheduler tick that transitions SCHEDULED tournaments to RUNNING when
   * serverNow >= scheduledStartAt ONLY IF all readiness prerequisites pass.
   * If any blocker remains, preserves SCHEDULED and records the blockage.
   */
  async evaluateScheduledStart(serverNowIso?: string): Promise<{
    startedTournaments: TournamentDto[];
    blockedTournaments: TournamentDto[];
  }> {
    return this.store.withLock(async () => {
      const nowIso = serverNowIso ?? this.store.nowIso();
      const nowMs = Date.parse(nowIso);
      const startedTournaments: TournamentDto[] = [];
      const blockedTournaments: TournamentDto[] = [];

      for (const [id, tournament] of this.store.tournaments.entries()) {
        if (tournament.status !== "SCHEDULED") continue;
        const startMs = Date.parse(tournament.coreConfig.scheduledStartAt);
        if (nowMs >= startMs) {
          const readiness = this.evaluateReadiness(id);
          if (readiness.canStartRunning) {
            const updated = TournamentDtoSchema.parse({
              ...tournament,
              status: "RUNNING",
              revision: tournament.revision + 1,
              startedAt: tournament.startedAt ?? nowIso,
              updatedAt: nowIso,
            });
            this.store.tournaments.set(id, updated);
            this.store.audit.append({
              actorUserId: "SYSTEM_SCHEDULER",
              actorRole: "ADMIN",
              action: "TOURNAMENT_AUTO_STARTED",
              targetType: "TOURNAMENT",
              targetId: id,
              beforeSnapshot: tournament,
              afterSnapshot: updated,
              reason: "Lịch bắt đầu giải đã đến và điều kiện sẵn sàng đạt PASS (T026).",
              correlationId: null,
              nowIso,
            });
            startedTournaments.push(updated);
          } else {
            // T026: Do NOT start if blockers remain
            this.store.audit.append({
              actorUserId: "SYSTEM_SCHEDULER",
              actorRole: "ADMIN",
              action: "TOURNAMENT_START_BLOCKED",
              targetType: "TOURNAMENT",
              targetId: id,
              beforeSnapshot: tournament,
              afterSnapshot: tournament,
              reason: `Đã đến giờ bắt đầu nhưng giải đấu còn blocker chưa giải quyết: ${readiness.blockers.join(", ")}`,
              correlationId: null,
              nowIso,
            });
            blockedTournaments.push(tournament);
          }
        }
      }

      return { startedTournaments, blockedTournaments };
    });
  }
}
