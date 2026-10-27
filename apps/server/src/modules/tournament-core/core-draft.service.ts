import { randomUUID } from "node:crypto";
import {
  CreateTournamentDraftInputSchema,
  DEFAULT_TOURNAMENT_RULE_PROFILE,
  evaluateRuleProfileEnvelope,
  normalizeTournamentCoreConfig,
  PatchTournamentDraftInputSchema,
  SubmitTournamentDraftInputSchema,
  TournamentCoreConfigSchema,
  TournamentDtoSchema,
  TournamentEnrollmentSchema,
  TournamentRuleProfileSchema,
  validateTournamentCoreConfigSemantics,
  type CreateTournamentDraftInput,
  type PatchTournamentDraftInput,
  type SubmitTournamentDraftInput,
  type TournamentContractDto,
  type TournamentCoreConfig,
  type TournamentDto,
  type TournamentEnrollmentDto,
  type TournamentRuleProfile,
} from "@ottv2/contracts";
import {
  assertTaContractOrTournamentAccess,
  createTournamentError,
  type TournamentActorContext,
  type TournamentStateStore,
} from "../tournament-foundation/tournament-store.js";

import type { PrismaClient } from "@prisma/client";
import {
  deleteTournamentFromPrisma,
  persistContractToPrisma,
  persistTournamentToPrisma,
} from "../tournament-foundation/prisma-sync.js";

export class CoreDraftService {
  constructor(
    private readonly store: TournamentStateStore,
    private readonly database?: PrismaClient
  ) {}

  private validateAgainstContract(
    contract: TournamentContractDto,
    coreConfig: TournamentCoreConfig,
    ruleProfile: TournamentRuleProfile,
    options?: { requireFutureStartAt?: boolean; serverNowIso?: string }
  ): void {
    const semanticIssues = validateTournamentCoreConfigSemantics(coreConfig, options);
    if (semanticIssues.length > 0) {
      const first = semanticIssues[0]!;
      throw createTournamentError({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: first.message,
        details: {
          reason: "SCHEMA_VALIDATION_FAILED",
          field: first.field,
        },
      });
    }

    if (!contract.allowedModes.includes(coreConfig.competitionMode)) {
      throw createTournamentError({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: `Chế độ thi đấu "${coreConfig.competitionMode}" không nằm trong danh sách cho phép của hợp đồng (${contract.allowedModes.join(", ")}).`,
        details: {
          reason: "MODE_NOT_ALLOWED_BY_CONTRACT",
          field: "competitionMode",
          contractId: contract.id,
        },
      });
    }

    if (coreConfig.maxParticipants > contract.maxParticipantsPerTournament) {
      throw createTournamentError({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: `Số người tham gia tối đa (${coreConfig.maxParticipants}) vượt quá trần mỗi giải của hợp đồng (${contract.maxParticipantsPerTournament}).`,
        details: {
          reason: "MAX_PARTICIPANTS_EXCEEDS_CONTRACT_CAP",
          field: "maxParticipants",
          contractId: contract.id,
        },
      });
    }

    if (
      coreConfig.maxConcurrentMatches >
      contract.technicalCaps.maxConcurrentMatchesPerTournament
    ) {
      throw createTournamentError({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: `Số trận đồng thời tối đa (${coreConfig.maxConcurrentMatches}) vượt quá trần kỹ thuật của hợp đồng (${contract.technicalCaps.maxConcurrentMatchesPerTournament}).`,
        details: {
          reason: "CONCURRENT_MATCHES_EXCEEDS_CONTRACT_CAP",
          field: "maxConcurrentMatches",
          contractId: contract.id,
        },
      });
    }

    const envelopeCheck = evaluateRuleProfileEnvelope(
      ruleProfile,
      contract.policyEnvelope
    );
    if (!envelopeCheck.withinEnvelope) {
      const first = envelopeCheck.violations[0]!;
      throw createTournamentError({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: first.message,
        details: {
          reason: "RULE_PROFILE_OUTSIDE_CONTRACT_ENVELOPE",
          field: first.field,
          contractId: contract.id,
        },
      });
    }
  }

  async createDraft(
    actor: TournamentActorContext,
    rawInput: CreateTournamentDraftInput
  ): Promise<TournamentDto> {
    const parsed = CreateTournamentDraftInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      throw createTournamentError({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: firstIssue?.message ?? "Dữ liệu tạo bản nháp giải đấu không hợp lệ.",
        details: {
          reason: "SCHEMA_VALIDATION_FAILED",
          field: String(firstIssue?.path.join(".") ?? "coreConfig"),
        },
      });
    }

    return this.store.withLock(async () => {
      let contract = this.store.contracts.get(parsed.data.contractId);
      if (!contract) {
        for (const c of this.store.contracts.values()) {
          if (
            c.contractCode.toUpperCase() === parsed.data.contractId.toUpperCase() ||
            c.id === parsed.data.contractId
          ) {
            contract = c;
            break;
          }
        }
      }
      if (!contract) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy hợp đồng.",
          details: {
            reason: "RESOURCE_NOT_FOUND",
            contractId: parsed.data.contractId,
          },
        });
      }

      const nowIso = this.store.nowIso();
      assertTaContractOrTournamentAccess(actor, contract, {
        mode: "NEW_DRAFT",
        serverNowIso: nowIso,
      });

      const normalizedCore = normalizeTournamentCoreConfig(parsed.data.coreConfig);
      const ruleProfile = TournamentRuleProfileSchema.parse(
        parsed.data.ruleProfile ?? DEFAULT_TOURNAMENT_RULE_PROFILE
      );

      for (const existing of this.store.tournaments.values()) {
        if (
          existing.coreConfig.tournamentCode.toUpperCase() ===
          normalizedCore.tournamentCode.toUpperCase()
        ) {
          throw createTournamentError({
            code: "CONFLICT",
            statusCode: 409,
            message: `Mã giải đấu "${normalizedCore.tournamentCode}" đã tồn tại.`,
            details: {
              reason: "TOURNAMENT_CODE_DUPLICATE",
              field: "tournamentCode",
            },
          });
        }
      }

      this.validateAgainstContract(contract, normalizedCore, ruleProfile, {
        requireFutureStartAt: false,
        serverNowIso: nowIso,
      });

      // Atomic quota check and reservation (BR-05, T011, T012)
      if (contract.quotaReservedCount >= contract.maxTournamentsTotal) {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: `Hợp đồng "${contract.contractCode}" đã hết hạn mức tạo giải (${contract.quotaReservedCount}/${contract.maxTournamentsTotal}).`,
          details: {
            reason: "CONTRACT_QUOTA_EXHAUSTED",
            contractId: contract.id,
            quotaRemaining: 0,
          },
        });
      }

      const nextReserved = contract.quotaReservedCount + 1;
      const updatedContract: TournamentContractDto = {
        ...contract,
        quotaReservedCount: nextReserved,
        quotaRemainingCount: Math.max(0, contract.maxTournamentsTotal - nextReserved),
        updatedAt: nowIso,
      };

      const tournament = TournamentDtoSchema.parse({
        id: randomUUID(),
        contractId: contract.id,
        contractCode: contract.contractCode,
        unitId: contract.unitId,
        ownerTaUserId: actor.userId,
        status: "DRAFT",
        revision: 1,
        coreConfig: normalizedCore,
        ruleProfile,
        activeConfigVersionId: null,
        activeConfigVersionNumber: 0,
        approvedSnapshot: null,
        everApproved: false,
        quotaRefunded: false,
        submittedAt: null,
        approvedAt: null,
        rejectedAt: null,
        changesRequestedAt: null,
        lastReviewNote: null,
        startedAt: null,
        pausedAt: null,
        pauseReason: null,
        endedAt: null,
        cancelledAt: null,
        cancelReason: null,
        finalizedAt: null,
        copiedFromTournamentId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      if (this.database) {
        await persistContractToPrisma(this.database, updatedContract);
        await persistTournamentToPrisma(this.database, tournament);
      }
      this.store.contracts.set(contract.id, updatedContract);
      this.store.tournaments.set(tournament.id, tournament);
      this.store.audit.append({
        actorUserId: actor.userId,
        actorRole: actor.roles.includes("ADMIN") ? "ADMIN" : "TOURNAMENT_ADMIN",
        action: "TOURNAMENT_DRAFT_CREATED",
        targetType: "TOURNAMENT",
        targetId: tournament.id,
        beforeSnapshot: null,
        afterSnapshot: tournament,
        correlationId: actor.correlationId ?? null,
        nowIso,
      });

      return tournament;
    });
  }

  async patchDraft(
    actor: TournamentActorContext,
    tournamentId: string,
    rawInput: PatchTournamentDraftInput
  ): Promise<TournamentDto> {
    const parsed = PatchTournamentDraftInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      throw createTournamentError({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: firstIssue?.message ?? "Dữ liệu cập nhật bản nháp không hợp lệ.",
        details: {
          reason: "SCHEMA_VALIDATION_FAILED",
          field: String(firstIssue?.path.join(".") ?? "expectedRevision"),
        },
      });
    }

    return this.store.withLock(async () => {
      const existing = this.store.tournaments.get(tournamentId);
      if (!existing) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy giải đấu.",
          details: { reason: "RESOURCE_NOT_FOUND", tournamentId },
        });
      }

      const contract = this.store.contracts.get(existing.contractId);
      if (!contract) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy hợp đồng của giải đấu.",
          details: { reason: "RESOURCE_NOT_FOUND", contractId: existing.contractId },
        });
      }

      const nowIso = this.store.nowIso();
      assertTaContractOrTournamentAccess(actor, contract, {
        mode: "OPERATE_EXISTING",
        tournament: existing,
        serverNowIso: nowIso,
      });

      if (existing.status !== "DRAFT" && existing.status !== "CHANGES_REQUESTED") {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: `Chỉ có thể chỉnh sửa trực tiếp khi giải ở trạng thái DRAFT hoặc CHANGES_REQUESTED (hiện tại: ${existing.status}).`,
          details: {
            reason: "INVALID_STATE_TRANSITION",
            status: existing.status,
            tournamentId,
          },
        });
      }

      if (parsed.data.expectedRevision !== existing.revision) {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: "Phiên bản cấu hình giải đấu đã thay đổi. Vui lòng tải lại trước khi lưu.",
          details: {
            reason: "STALE_VERSION",
            expectedRevision: parsed.data.expectedRevision,
            currentRevision: existing.revision,
            tournamentId,
          },
        });
      }

      const mergedCore = normalizeTournamentCoreConfig(
        TournamentCoreConfigSchema.parse({
          ...existing.coreConfig,
          ...(parsed.data.coreConfig ?? {}),
        })
      );
      const mergedRules = TournamentRuleProfileSchema.parse({
        ...existing.ruleProfile,
        ...(parsed.data.ruleProfile ?? {}),
      });

      this.validateAgainstContract(contract, mergedCore, mergedRules, {
        requireFutureStartAt: false,
        serverNowIso: nowIso,
      });

      const updated = TournamentDtoSchema.parse({
        ...existing,
        coreConfig: mergedCore,
        ruleProfile: mergedRules,
        revision: existing.revision + 1,
        updatedAt: nowIso,
      });

      if (this.database) {
        await persistTournamentToPrisma(this.database, updated);
      }
      this.store.tournaments.set(tournamentId, updated);
      this.store.audit.append({
        actorUserId: actor.userId,
        actorRole: actor.roles.includes("ADMIN") ? "ADMIN" : "TOURNAMENT_ADMIN",
        action: "TOURNAMENT_DRAFT_UPDATED",
        targetType: "TOURNAMENT",
        targetId: tournamentId,
        beforeSnapshot: existing,
        afterSnapshot: updated,
        correlationId: actor.correlationId ?? null,
        nowIso,
      });

      return updated;
    });
  }

  async deleteDraft(
    actor: TournamentActorContext,
    tournamentId: string
  ): Promise<{ deleted: true; quotaRefunded: boolean }> {
    return this.store.withLock(async () => {
      const existing = this.store.tournaments.get(tournamentId);
      if (!existing) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy giải đấu.",
          details: { reason: "RESOURCE_NOT_FOUND", tournamentId },
        });
      }

      const contract = this.store.contracts.get(existing.contractId);
      if (!contract) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy hợp đồng.",
          details: { reason: "RESOURCE_NOT_FOUND", contractId: existing.contractId },
        });
      }

      const nowIso = this.store.nowIso();
      assertTaContractOrTournamentAccess(actor, contract, {
        mode: "OPERATE_EXISTING",
        tournament: existing,
        serverNowIso: nowIso,
      });

      if (existing.status !== "DRAFT") {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: `Chỉ có thể xóa giải đấu ở trạng thái DRAFT (hiện tại: ${existing.status}).`,
          details: {
            reason: "INVALID_STATE_TRANSITION",
            status: existing.status,
            tournamentId,
          },
        });
      }

      // Refund quota once (T012)
      let quotaRefunded = false;
      let refundedContract: TournamentContractDto | null = null;
      if (!existing.quotaRefunded && !existing.everApproved) {
        const nextReserved = Math.max(0, contract.quotaReservedCount - 1);
        refundedContract = {
          ...contract,
          quotaReservedCount: nextReserved,
          quotaRemainingCount: Math.max(0, contract.maxTournamentsTotal - nextReserved),
          updatedAt: nowIso,
        };
        quotaRefunded = true;
      }

      if (this.database) {
        if (refundedContract) {
          await persistContractToPrisma(this.database, refundedContract);
        }
        await deleteTournamentFromPrisma(this.database, tournamentId);
      }
      if (refundedContract) {
        this.store.contracts.set(contract.id, refundedContract);
      }
      this.store.tournaments.delete(tournamentId);
      this.store.audit.append({
        actorUserId: actor.userId,
        actorRole: actor.roles.includes("ADMIN") ? "ADMIN" : "TOURNAMENT_ADMIN",
        action: "TOURNAMENT_DRAFT_DELETED",
        targetType: "TOURNAMENT",
        targetId: tournamentId,
        beforeSnapshot: existing,
        afterSnapshot: null,
        correlationId: actor.correlationId ?? null,
        nowIso,
      });

      return { deleted: true, quotaRefunded };
    });
  }

  /**
   * T023: REJECTED is terminal for that record, but TA can copy it into a new DRAFT
   * (which reserves a fresh quota slot on the contract).
   */
  async copyRejectedToDraft(
    actor: TournamentActorContext,
    rejectedTournamentId: string,
    newTournamentCode: string
  ): Promise<TournamentDto> {
    const source = this.store.tournaments.get(rejectedTournamentId);
    if (!source) {
      throw createTournamentError({
        code: "NOT_FOUND",
        statusCode: 404,
        message: "Không tìm thấy giải đấu nguồn để tạo bản sao.",
        details: { reason: "RESOURCE_NOT_FOUND", tournamentId: rejectedTournamentId },
      });
    }
    if (source.status !== "REJECTED") {
      throw createTournamentError({
        code: "CONFLICT",
        statusCode: 409,
        message: "Chỉ hỗ trợ tạo bản nháp mới từ giải đấu đã bị từ chối (REJECTED).",
        details: {
          reason: "INVALID_STATE_TRANSITION",
          status: source.status,
          tournamentId: rejectedTournamentId,
        },
      });
    }

    const created = await this.createDraft(actor, {
      contractId: source.contractId,
      coreConfig: {
        ...source.coreConfig,
        tournamentCode: newTournamentCode,
      },
      ruleProfile: source.ruleProfile,
    });

    return this.store.withLock(async () => {
      const updated: TournamentDto = {
        ...created,
        copiedFromTournamentId: rejectedTournamentId,
      };
      if (this.database) {
        await persistTournamentToPrisma(this.database, updated);
      }
      this.store.tournaments.set(updated.id, updated);
      return updated;
    });
  }

  async submitDraft(
    actor: TournamentActorContext,
    tournamentId: string,
    rawInput: SubmitTournamentDraftInput
  ): Promise<TournamentDto> {
    const parsed = SubmitTournamentDraftInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw createTournamentError({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: parsed.error.issues[0]?.message ?? "Dữ liệu gửi duyệt không hợp lệ.",
        details: { reason: "SCHEMA_VALIDATION_FAILED", field: "expectedRevision" },
      });
    }

    return this.store.withLock(async () => {
      const existing = this.store.tournaments.get(tournamentId);
      if (!existing) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy giải đấu.",
          details: { reason: "RESOURCE_NOT_FOUND", tournamentId },
        });
      }

      const contract = this.store.contracts.get(existing.contractId);
      if (!contract) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy hợp đồng.",
          details: { reason: "RESOURCE_NOT_FOUND", contractId: existing.contractId },
        });
      }

      const nowIso = this.store.nowIso();
      assertTaContractOrTournamentAccess(actor, contract, {
        mode: "NEW_DRAFT",
        tournament: existing,
        serverNowIso: nowIso,
      });

      if (existing.ownerTaUserId !== actor.userId && !actor.roles.includes("ADMIN")) {
        throw createTournamentError({
          code: "UNAUTHORIZED",
          statusCode: 403,
          message: "Chỉ Quản trị giải (TA) sở hữu giải đấu hoặc Quản trị viên mới được gửi duyệt.",
          details: { reason: "FORBIDDEN_ROLE", tournamentId },
        });
      }

      if (existing.status !== "DRAFT" && existing.status !== "CHANGES_REQUESTED") {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: `Giải đấu ở trạng thái "${existing.status}" không thể gửi duyệt.`,
          details: {
            reason: "INVALID_STATE_TRANSITION",
            status: existing.status,
            tournamentId,
          },
        });
      }

      if (parsed.data.expectedRevision !== existing.revision) {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: "Phiên bản bản nháp đã cũ. Vui lòng đồng bộ lại trước khi gửi duyệt.",
          details: {
            reason: "STALE_VERSION",
            expectedRevision: parsed.data.expectedRevision,
            currentRevision: existing.revision,
            tournamentId,
          },
        });
      }

      this.validateAgainstContract(
        contract,
        existing.coreConfig,
        existing.ruleProfile,
        {
          requireFutureStartAt: true,
          serverNowIso: nowIso,
        }
      );

      const updated = TournamentDtoSchema.parse({
        ...existing,
        status: "UNDER_REVIEW",
        revision: existing.revision + 1,
        submittedAt: nowIso,
        updatedAt: nowIso,
      });

      if (this.database) {
        await persistTournamentToPrisma(this.database, updated);
      }
      this.store.tournaments.set(tournamentId, updated);
      this.store.audit.append({
        actorUserId: actor.userId,
        actorRole: actor.roles.includes("ADMIN") ? "ADMIN" : "TOURNAMENT_ADMIN",
        action: "TOURNAMENT_SUBMITTED_FOR_REVIEW",
        targetType: "TOURNAMENT",
        targetId: tournamentId,
        beforeSnapshot: existing,
        afterSnapshot: updated,
        reason: parsed.data.submissionNote ?? null,
        correlationId: actor.correlationId ?? null,
        nowIso,
      });

      return updated;
    });
  }

  /**
   * T015 & T016: Enforces both per-tournament participant cap and contract-wide total participant cap
   * when adding/enrolling a participant into a tournament.
   */
  async enrollParticipant(
    actor: TournamentActorContext,
    tournamentId: string,
    input: {
      personKey: string;
      userId?: string | null;
      displayName: string;
      unitCode: string;
      email?: string | null;
      seedRating?: number;
      eligibilityStatus?: TournamentEnrollmentDto["eligibilityStatus"];
      botReadinessStatus?: TournamentEnrollmentDto["botReadinessStatus"];
    }
  ): Promise<TournamentEnrollmentDto> {
    return this.store.withLock(() => {
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

      // Count active enrollments in this tournament and across the contract
      let tournamentCount = 0;
      let contractTotalCount = 0;

      for (const e of this.store.enrollments.values()) {
        if (e.eligibilityStatus === "WITHDRAWN" || e.eligibilityStatus === "DISQUALIFIED") {
          continue;
        }
        const t = this.store.tournaments.get(e.tournamentId);
        if (!t || t.status === "REJECTED" || t.status === "CANCELLED") {
          continue;
        }
        if (e.tournamentId === tournamentId) {
          if (e.personKey === input.personKey) {
            throw createTournamentError({
              code: "CONFLICT",
              statusCode: 409,
              message: `Thí sinh "${input.personKey}" đã tồn tại trong danh sách giải đấu.`,
              details: { reason: "DUPLICATE_PERSON_KEY", tournamentId },
            });
          }
          tournamentCount += 1;
        }
        if (e.contractId === contract.id) {
          contractTotalCount += 1;
        }
      }

      const tournamentCap = Math.min(
        tournament.coreConfig.maxParticipants,
        contract.maxParticipantsPerTournament
      );
      if (tournamentCount + 1 > tournamentCap) {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: `Đã vượt trần số người tham gia của giải đấu (${tournamentCap}).`,
          details: {
            reason: "TOURNAMENT_PARTICIPANT_CAP_EXCEEDED",
            tournamentId,
            limit: tournamentCap,
          },
        });
      }

      if (contractTotalCount + 1 > contract.maxParticipantsTotal) {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: `Đã vượt tổng trần người tham gia toàn hợp đồng (${contract.maxParticipantsTotal}).`,
          details: {
            reason: "CONTRACT_TOTAL_PARTICIPANT_CAP_EXCEEDED",
            contractId: contract.id,
            limit: contract.maxParticipantsTotal,
          },
        });
      }

      if (
        tournament.coreConfig.audienceScope === "INTERNAL_UNIT" &&
        !tournament.coreConfig.allowedUnitCodes.includes(input.unitCode)
      ) {
        throw createTournamentError({
          code: "VALIDATION_ERROR",
          statusCode: 400,
          message: `Đơn vị "${input.unitCode}" của thí sinh không thuộc phạm vi đơn vị cho phép của giải.`,
          details: {
            reason: "UNIT_OUTSIDE_AUDIENCE_SCOPE",
            unitCode: input.unitCode,
            tournamentId,
          },
        });
      }

      const enrollment = TournamentEnrollmentSchema.parse({
        id: randomUUID(),
        tournamentId,
        contractId: contract.id,
        personKey: input.personKey,
        userId: input.userId ?? null,
        displayName: input.displayName,
        unitCode: input.unitCode,
        email: input.email ?? null,
        seedRating: input.seedRating ?? tournament.coreConfig.initialElo,
        eligibilityStatus: input.eligibilityStatus ?? "ELIGIBLE",
        checkedInAt: tournament.coreConfig.checkinRequired ? null : nowIso,
        pinnedBotRevisionId: null,
        botReadinessStatus:
          input.botReadinessStatus ??
          (tournament.coreConfig.competitionMode === "HUMAN_ONLINE"
            ? "NOT_REQUIRED"
            : "MISSING"),
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      this.store.enrollments.set(enrollment.id, enrollment);
      return enrollment;
    });
  }

  getTournament(tournamentId: string): TournamentDto {
    const t = this.store.tournaments.get(tournamentId);
    if (!t) {
      throw createTournamentError({
        code: "NOT_FOUND",
        statusCode: 404,
        message: "Không tìm thấy giải đấu.",
        details: { reason: "RESOURCE_NOT_FOUND", tournamentId },
      });
    }
    return t;
  }

  listTournaments(filter?: {
    contractId?: string;
    status?: string;
    ownerTaUserId?: string;
  }): TournamentDto[] {
    return Array.from(this.store.tournaments.values()).filter((t) => {
      if (filter?.contractId && t.contractId !== filter.contractId) return false;
      if (filter?.status && t.status !== filter.status) return false;
      if (filter?.ownerTaUserId && t.ownerTaUserId !== filter.ownerTaUserId) return false;
      return true;
    });
  }
}
