import { randomUUID } from "node:crypto";
import {
  ApprovalDecisionInputSchema,
  ApprovedTournamentSnapshotSchema,
  evaluateRuleProfileEnvelope,
  normalizeTournamentCoreConfig,
  TournamentChangeRequestSchema,
  TournamentConfigVersionSchema,
  TournamentCoreConfigSchema,
  TournamentDtoSchema,
  TournamentRuleProfileSchema,
  validateTournamentCoreConfigSemantics,
  type ApprovalDecisionInput,
  type ChangeRequestFieldDiff,
  type TournamentChangeRequestDto,
  type TournamentConfigVersionDto,
  type TournamentContractDto,
  type TournamentDto,
} from "@ottv2/contracts";
import {
  assertAdminActor,
  createTournamentError,
  type TournamentActorContext,
  type TournamentStateStore,
} from "../tournament-foundation/tournament-store.js";
import type { PrismaClient } from "@prisma/client";
import { persistTournamentToPrisma } from "../tournament-foundation/prisma-sync.js";

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  for (const value of Object.values(obj as Record<string, unknown>)) {
    if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

function sanitizeFieldNotes(
  raw?: Record<string, string>
): Record<string, string> {
  if (!raw) return {};
  const cleaned: Record<string, string> = {};
  for (const [key, val] of Object.entries(raw)) {
    const trimmedKey = key.trim();
    const trimmedVal = val.trim();
    if (trimmedKey.length > 0 && trimmedVal.length > 0) {
      cleaned[trimmedKey] = trimmedVal;
    }
  }
  return cleaned;
}

export interface ApprovalDetailView {
  tournament: TournamentDto;
  contract: TournamentContractDto;
  envelopeCheck: ReturnType<typeof evaluateRuleProfileEnvelope>;
  scheduleCheck: ReturnType<typeof validateTournamentCoreConfigSemantics>;
  contractBoundsCheck: {
    modeAllowed: boolean;
    maxParticipantsWithinCap: boolean;
    maxConcurrentMatchesWithinCap: boolean;
  };
  diffsFromPreviousApproval: ChangeRequestFieldDiff[];
  configVersions: TournamentConfigVersionDto[];
  changeRequests: TournamentChangeRequestDto[];
}

export class ApprovalService {
  constructor(
    private readonly store: TournamentStateStore,
    private readonly database?: PrismaClient
  ) {}

  getApprovalDetail(
    actor: TournamentActorContext,
    tournamentId: string
  ): ApprovalDetailView {
    assertAdminActor(actor);
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
        message: "Không tìm thấy hợp đồng của giải đấu.",
        details: { reason: "RESOURCE_NOT_FOUND", contractId: tournament.contractId },
      });
    }

    const nowIso = this.store.nowIso();
    const envelopeCheck = evaluateRuleProfileEnvelope(
      tournament.ruleProfile,
      contract.policyEnvelope
    );
    const scheduleCheck = validateTournamentCoreConfigSemantics(
      tournament.coreConfig,
      {
        requireFutureStartAt: true,
        serverNowIso: nowIso,
      }
    );
    const contractBoundsCheck = {
      modeAllowed: contract.allowedModes.includes(
        tournament.coreConfig.competitionMode
      ),
      maxParticipantsWithinCap:
        tournament.coreConfig.maxParticipants <=
        contract.maxParticipantsPerTournament,
      maxConcurrentMatchesWithinCap:
        tournament.coreConfig.maxConcurrentMatches <=
        contract.technicalCaps.maxConcurrentMatchesPerTournament,
    };

    const diffsFromPreviousApproval: ChangeRequestFieldDiff[] = [];
    if (tournament.approvedSnapshot) {
      const prevCore = tournament.approvedSnapshot.coreConfig as Record<string, unknown>;
      const currCore = tournament.coreConfig as Record<string, unknown>;
      for (const key of Object.keys(currCore)) {
        if (JSON.stringify(prevCore[key]) !== JSON.stringify(currCore[key])) {
          diffsFromPreviousApproval.push({
            fieldPath: `coreConfig.${key}`,
            label: key,
            beforeValue: prevCore[key],
            afterValue: currCore[key],
            requiresAdminApproval: true,
          });
        }
      }
      const prevRules = tournament.approvedSnapshot.ruleProfile as Record<string, unknown>;
      const currRules = tournament.ruleProfile as Record<string, unknown>;
      for (const key of Object.keys(currRules)) {
        if (JSON.stringify(prevRules[key]) !== JSON.stringify(currRules[key])) {
          diffsFromPreviousApproval.push({
            fieldPath: `ruleProfile.${key}`,
            label: key,
            beforeValue: prevRules[key],
            afterValue: currRules[key],
            requiresAdminApproval: true,
          });
        }
      }
    }

    const configVersions = this.store.configVersions.get(tournament.id) ?? [];
    const changeRequests = Array.from(this.store.changeRequests.values()).filter(
      (cr) => cr.tournamentId === tournament.id
    );

    return {
      tournament,
      contract,
      envelopeCheck,
      scheduleCheck,
      contractBoundsCheck,
      diffsFromPreviousApproval,
      configVersions,
      changeRequests,
    };
  }

  listApprovalQueue(filter?: { status?: string }): {
    initialSubmissions: TournamentDto[];
    changeRequests: TournamentChangeRequestDto[];
  } {
    const initialSubmissions = Array.from(this.store.tournaments.values()).filter(
      (t) => {
        if (filter?.status) return t.status === filter.status;
        return (
          t.status === "UNDER_REVIEW" ||
          t.status === "CHANGES_REQUESTED" ||
          t.status === "APPROVED" ||
          t.status === "REJECTED"
        );
      }
    );

    const changeRequests = Array.from(this.store.changeRequests.values()).filter(
      (cr) => {
        if (filter?.status) return cr.status === filter.status;
        return true;
      }
    );

    return { initialSubmissions, changeRequests };
  }

  async decideInitialApproval(
    actor: TournamentActorContext,
    tournamentId: string,
    rawInput: ApprovalDecisionInput
  ): Promise<TournamentDto> {
    assertAdminActor(actor);
    const parsed = ApprovalDecisionInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      throw createTournamentError({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: firstIssue?.message ?? "Quyết định phê duyệt không hợp lệ.",
        details: {
          reason: "SCHEMA_VALIDATION_FAILED",
          field: String(firstIssue?.path[0] ?? "note"),
        },
      });
    }

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

      if (tournament.status !== "UNDER_REVIEW") {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: `Chỉ có thể phê duyệt giải đấu đang ở trạng thái UNDER_REVIEW (hiện tại: ${tournament.status}).`,
          details: {
            reason: "INVALID_STATE_TRANSITION",
            status: tournament.status,
            tournamentId,
          },
        });
      }

      if (parsed.data.expectedRevision !== tournament.revision) {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: "Bản ghi giải đấu đã thay đổi phiên bản. Vui lòng đồng bộ lại trước khi duyệt.",
          details: {
            reason: "STALE_VERSION",
            expectedRevision: parsed.data.expectedRevision,
            currentRevision: tournament.revision,
            tournamentId,
          },
        });
      }

      const contract = this.store.contracts.get(tournament.contractId);
      if (!contract) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy hợp đồng của giải đấu.",
          details: { reason: "RESOURCE_NOT_FOUND", contractId: tournament.contractId },
        });
      }

      const nowIso = this.store.nowIso();
      const decision = parsed.data.decision;
      const note = parsed.data.note?.trim() || null;
      const fieldNotes = sanitizeFieldNotes(parsed.data.fieldNotes);

      if (decision === "APPROVE") {
        if (
          contract.status !== "ACTIVE" ||
          Date.parse(contract.validTo) < Date.parse(nowIso)
        ) {
          throw createTournamentError({
            code: "CONFLICT",
            statusCode: 409,
            message: "Hợp đồng đã hết hạn hoặc không còn hiệu lực, không thể phê duyệt giải đấu.",
            details: {
              reason: "CONTRACT_NOT_ACTIVE",
              contractId: contract.id,
              tournamentId,
            },
          });
        }

        const semanticIssues = validateTournamentCoreConfigSemantics(
          tournament.coreConfig,
          {
            requireFutureStartAt: true,
            serverNowIso: nowIso,
          }
        );
        if (semanticIssues.length > 0) {
          throw createTournamentError({
            code: "CONFLICT",
            statusCode: 409,
            message: semanticIssues[0]!.message,
            details: {
              reason: "STALE_SCHEDULE_AT_APPROVAL",
              field: semanticIssues[0]!.field,
              tournamentId,
            },
          });
        }

        const envelopeCheck = evaluateRuleProfileEnvelope(
          tournament.ruleProfile,
          contract.policyEnvelope
        );
        if (!envelopeCheck.withinEnvelope) {
          throw createTournamentError({
            code: "VALIDATION_ERROR",
            statusCode: 400,
            message: envelopeCheck.violations[0]!.message,
            details: {
              reason: "RULE_PROFILE_OUTSIDE_CONTRACT_ENVELOPE",
              field: envelopeCheck.violations[0]!.field,
              tournamentId,
            },
          });
        }

        const existingVersions = this.store.configVersions.get(tournament.id) ?? [];
        const versionNumber = existingVersions.length + 1;
        const versionId = randomUUID();
        const configVersion = deepFreeze(
          TournamentConfigVersionSchema.parse({
            id: versionId,
            tournamentId: tournament.id,
            versionNumber,
            coreConfigSnapshot: structuredClone(tournament.coreConfig),
            ruleProfileSnapshot: structuredClone(tournament.ruleProfile),
            effectiveAt: nowIso,
            publishedByUserId: actor.userId,
            changeSummary: `Phê duyệt cấu hình giải đấu ban đầu (v${versionNumber})`,
            createdAt: nowIso,
          })
        );

        this.store.configVersions.set(tournament.id, [...existingVersions, configVersion]);

        const approvedSnapshot = deepFreeze(
          ApprovedTournamentSnapshotSchema.parse({
            approvedAt: nowIso,
            approvedByUserId: actor.userId,
            approvalNote: note,
            fieldNotes,
            contractId: contract.id,
            contractCode: contract.contractCode,
            unitId: contract.unitId,
            coreConfig: structuredClone(tournament.coreConfig),
            ruleProfile: structuredClone(tournament.ruleProfile),
            configVersionId: versionId,
            configVersionNumber: versionNumber,
          })
        );

        // Mark quota consumed once on initial approval (cannot be refunded even if later CANCELLED — BR-05, T013)
        if (!tournament.everApproved) {
          this.store.contracts.set(contract.id, {
            ...contract,
            quotaConsumedCount: contract.quotaConsumedCount + 1,
            updatedAt: nowIso,
          });
        }

        const updated = TournamentDtoSchema.parse({
          ...tournament,
          status: "APPROVED",
          revision: tournament.revision + 1,
          activeConfigVersionId: versionId,
          activeConfigVersionNumber: versionNumber,
          approvedSnapshot,
          everApproved: true,
          approvedAt: nowIso,
          lastReviewNote: note,
          lastReviewFieldNotes: fieldNotes,
          updatedAt: nowIso,
        });
        const updatedWithFrozenSnapshot: TournamentDto = {
          ...updated,
          approvedSnapshot,
        };

        this.store.tournaments.set(tournamentId, updatedWithFrozenSnapshot);
        if (this.database) {
          persistTournamentToPrisma(this.database, updatedWithFrozenSnapshot).catch(() => {});
        }
        this.store.audit.append({
          actorUserId: actor.userId,
          actorRole: "ADMIN",
          action: "TOURNAMENT_APPROVED",
          targetType: "TOURNAMENT",
          targetId: tournamentId,
          beforeSnapshot: tournament,
          afterSnapshot: updatedWithFrozenSnapshot,
          reason: note,
          correlationId: actor.correlationId ?? null,
          nowIso,
        });

        return updatedWithFrozenSnapshot;
      }

      if (decision === "REJECT") {
        let quotaRefunded = tournament.quotaRefunded;
        if (!tournament.everApproved && !tournament.quotaRefunded) {
          const nextReserved = Math.max(0, contract.quotaReservedCount - 1);
          this.store.contracts.set(contract.id, {
            ...contract,
            quotaReservedCount: nextReserved,
            quotaRemainingCount: Math.max(0, contract.maxTournamentsTotal - nextReserved),
            updatedAt: nowIso,
          });
          quotaRefunded = true;
        }

        const updated = TournamentDtoSchema.parse({
          ...tournament,
          status: "REJECTED",
          revision: tournament.revision + 1,
          quotaRefunded,
          rejectedAt: nowIso,
          lastReviewNote: note,
          lastReviewFieldNotes: fieldNotes,
          updatedAt: nowIso,
        });

        this.store.tournaments.set(tournamentId, updated);
        if (this.database) {
          persistTournamentToPrisma(this.database, updated).catch(() => {});
        }
        this.store.audit.append({
          actorUserId: actor.userId,
          actorRole: "ADMIN",
          action: "TOURNAMENT_REJECTED",
          targetType: "TOURNAMENT",
          targetId: tournamentId,
          beforeSnapshot: tournament,
          afterSnapshot: updated,
          reason: note,
          correlationId: actor.correlationId ?? null,
          nowIso,
        });

        return updated;
      }

      // REQUEST_CHANGES
      const updated = TournamentDtoSchema.parse({
        ...tournament,
        status: "CHANGES_REQUESTED",
        revision: tournament.revision + 1,
        changesRequestedAt: nowIso,
        lastReviewNote: note,
        lastReviewFieldNotes: fieldNotes,
        updatedAt: nowIso,
      });

      this.store.tournaments.set(tournamentId, updated);
      if (this.database) {
        persistTournamentToPrisma(this.database, updated).catch(() => {});
      }
      this.store.audit.append({
        actorUserId: actor.userId,
        actorRole: "ADMIN",
        action: "TOURNAMENT_CHANGES_REQUESTED",
        targetType: "TOURNAMENT",
        targetId: tournamentId,
        beforeSnapshot: tournament,
        afterSnapshot: updated,
        reason: note,
        correlationId: actor.correlationId ?? null,
        nowIso,
      });

      return updated;
    });
  }

  async decideChangeRequest(
    actor: TournamentActorContext,
    changeRequestId: string,
    rawInput: {
      decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES";
      note?: string;
    }
  ): Promise<TournamentChangeRequestDto> {
    assertAdminActor(actor);
    if (
      (rawInput.decision === "REJECT" || rawInput.decision === "REQUEST_CHANGES") &&
      (!rawInput.note || rawInput.note.trim().length < 3)
    ) {
      throw createTournamentError({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: "Bắt buộc nhập lý do (ít nhất 3 ký tự) khi Từ chối hoặc Yêu cầu chỉnh sửa ChangeRequest.",
        details: { reason: "SCHEMA_VALIDATION_FAILED", field: "note" },
      });
    }

    return this.store.withLock(() => {
      const cr = this.store.changeRequests.get(changeRequestId);
      if (!cr) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy yêu cầu thay đổi cấu hình (ChangeRequest).",
          details: { reason: "RESOURCE_NOT_FOUND" },
        });
      }

      if (cr.status !== "PENDING") {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: `ChangeRequest đã ở trạng thái "${cr.status}", không thể duyệt lại.`,
          details: { reason: "INVALID_STATE_TRANSITION", status: cr.status },
        });
      }

      const tournament = this.store.tournaments.get(cr.tournamentId);
      if (!tournament) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy giải đấu của ChangeRequest.",
          details: { reason: "RESOURCE_NOT_FOUND", tournamentId: cr.tournamentId },
        });
      }

      const nowIso = this.store.nowIso();
      const note = rawInput.note?.trim() || null;
      const contract = this.store.contracts.get(tournament.contractId);

      if (rawInput.decision === "APPROVE") {
        const mergedCore = normalizeTournamentCoreConfig(
          TournamentCoreConfigSchema.parse({
            ...tournament.coreConfig,
            ...(cr.proposedCoreConfigPatch ?? {}),
          })
        );
        const mergedRules = TournamentRuleProfileSchema.parse({
          ...tournament.ruleProfile,
          ...(cr.proposedRuleProfilePatch ?? {}),
        });

        const semanticIssues = validateTournamentCoreConfigSemantics(mergedCore, {
          serverNowIso: nowIso,
        });
        if (semanticIssues.length > 0) {
          throw createTournamentError({
            code: "VALIDATION_ERROR",
            statusCode: 400,
            message: `Cấu hình sau thay đổi không hợp lệ: ${semanticIssues.map((i) => i.message).join("; ")}`,
            details: { reason: "SEMANTIC_VALIDATION_FAILED", issues: semanticIssues },
          });
        }

        if (contract) {
          if (!contract.allowedModes.includes(mergedCore.competitionMode)) {
            throw createTournamentError({
              code: "VALIDATION_ERROR",
              statusCode: 400,
              message: `Chế độ "${mergedCore.competitionMode}" không được hợp đồng cho phép.`,
              details: { reason: "COMPETITION_MODE_NOT_ALLOWED" },
            });
          }
          if (mergedCore.maxParticipants > contract.maxParticipantsPerTournament) {
            throw createTournamentError({
              code: "VALIDATION_ERROR",
              statusCode: 400,
              message: `Số lượng tối đa (${mergedCore.maxParticipants}) vượt trần hợp đồng (${contract.maxParticipantsPerTournament}).`,
              details: { reason: "MAX_PARTICIPANTS_EXCEEDED" },
            });
          }
        }

        const existingVersions = this.store.configVersions.get(tournament.id) ?? [];
        const nextVersionNumber = existingVersions.length + 1;
        const versionId = randomUUID();
        const effectiveAtIso =
          Date.parse(cr.effectiveAt) >= Date.parse(nowIso) ? cr.effectiveAt : nowIso;

        const newVersion = TournamentConfigVersionSchema.parse({
          id: versionId,
          tournamentId: tournament.id,
          versionNumber: nextVersionNumber,
          coreConfigSnapshot: mergedCore,
          ruleProfileSnapshot: mergedRules,
          effectiveAt: effectiveAtIso,
          publishedByUserId: actor.userId,
          changeSummary: `ChangeRequest được duyệt: ${cr.reason}`,
          createdAt: nowIso,
        });
        this.store.configVersions.set(tournament.id, [...existingVersions, newVersion]);

        // Important (BR-07, T024): Tournament status stays APPROVED / SCHEDULED / RUNNING / PAUSED
        const updatedTournament = TournamentDtoSchema.parse({
          ...tournament,
          coreConfig: mergedCore,
          ruleProfile: mergedRules,
          revision: tournament.revision + 1,
          activeConfigVersionId: versionId,
          activeConfigVersionNumber: nextVersionNumber,
          approvedSnapshot: tournament.approvedSnapshot
            ? {
                ...tournament.approvedSnapshot,
                coreConfig: mergedCore,
                ruleProfile: mergedRules,
                configVersionId: versionId,
                configVersionNumber: nextVersionNumber,
              }
            : null,
          updatedAt: nowIso,
        });
        this.store.tournaments.set(tournament.id, updatedTournament);
        if (this.database) {
          persistTournamentToPrisma(this.database, updatedTournament).catch(() => {});
        }

        const updatedCr = TournamentChangeRequestSchema.parse({
          ...cr,
          status: "APPROVED",
          reviewedByAdminUserId: actor.userId,
          reviewNote: note,
          reviewedAt: nowIso,
          appliedConfigVersionId: versionId,
          updatedAt: nowIso,
        });
        this.store.changeRequests.set(changeRequestId, updatedCr);

        this.store.audit.append({
          actorUserId: actor.userId,
          actorRole: "ADMIN",
          action: "CHANGE_REQUEST_APPROVED",
          targetType: "CHANGE_REQUEST",
          targetId: changeRequestId,
          beforeSnapshot: cr,
          afterSnapshot: updatedCr,
          reason: note,
          correlationId: actor.correlationId ?? null,
          nowIso,
        });

        return updatedCr;
      }

      const nextStatus =
        rawInput.decision === "REJECT" ? "REJECTED" : "CHANGES_REQUESTED";
      const updatedCr = TournamentChangeRequestSchema.parse({
        ...cr,
        status: nextStatus,
        reviewedByAdminUserId: actor.userId,
        reviewNote: note,
        reviewedAt: nowIso,
        updatedAt: nowIso,
      });
      this.store.changeRequests.set(changeRequestId, updatedCr);

      this.store.audit.append({
        actorUserId: actor.userId,
        actorRole: "ADMIN",
        action:
          nextStatus === "REJECTED"
            ? "CHANGE_REQUEST_REJECTED"
            : "CHANGE_REQUEST_CHANGES_REQUESTED",
        targetType: "CHANGE_REQUEST",
        targetId: changeRequestId,
        beforeSnapshot: cr,
        afterSnapshot: updatedCr,
        reason: note,
        correlationId: actor.correlationId ?? null,
        nowIso,
      });

      return updatedCr;
    });
  }
}
