import { createHash, randomUUID } from "node:crypto";
import {
  evaluateRuleProfileEnvelope,
  RuleVersionDiffResponseSchema,
  RuleVersionItemSchema,
  RuleVersionListResponseSchema,
  TournamentChangeRequestSchema,
  TournamentConfigVersionSchema,
  TournamentDtoSchema,
  TournamentRuleProfileSchema,
  type ChangeRequestFieldDiff,
  type PublishRuleVersionInput,
  type PublishRuleVersionResponse,
  type RuleVersionDiffChange,
  type RuleVersionDiffResponse,
  type RuleVersionItem,
  type RuleVersionListResponse,
} from "@ottv2/contracts";
import { AppError } from "../../shared/errors/app-error.js";
import type { AuthContext } from "../auth/auth.service.js";
import type {
  RuleVersionListQuery,
  TournamentVersioningPort,
} from "../tournament-versioning/versioning.port.js";
import {
  assertTaContractOrTournamentAccess,
  type TournamentActorContext,
  type TournamentStateStore,
} from "../tournament-foundation/tournament-store.js";
import {
  persistChangeRequestToPrisma,
  persistConfigVersionToPrisma,
  persistTournamentToPrisma,
} from "../tournament-foundation/prisma-sync.js";
import type { PrismaClient } from "@prisma/client";

type IdempotencyRecord = {
  payloadHash: string;
  response: PublishRuleVersionResponse;
};

export class TournamentVersioningAdapter implements TournamentVersioningPort {
  private readonly idempotencyRecords = new Map<string, IdempotencyRecord>();

  constructor(
    private readonly store: TournamentStateStore,
    private readonly database?: PrismaClient
  ) {}

  private resolveActor(context: AuthContext): TournamentActorContext {
    return this.store.resolveAuthoritativeActor({
      userId: context.user.id,
      username: (context.user as any).username,
      principalType: context.principal === "GUEST" ? "GUEST" : "USER",
    });
  }

  async listVersions(
    context: AuthContext,
    tournamentId: string,
    query: RuleVersionListQuery
  ): Promise<RuleVersionListResponse> {
    const actor = this.resolveActor(context);
    const tournament = this.store.tournaments.get(tournamentId);
    if (!tournament) {
      throw new AppError(
        "NOT_FOUND",
        "Không tìm thấy giải đấu.",
        404,
        false,
        "INVALID",
        { reason: "RESOURCE_NOT_FOUND", tournamentId }
      );
    }

    const contract = this.store.contracts.get(tournament.contractId);
    if (contract && !actor.roles.includes("ADMIN")) {
      assertTaContractOrTournamentAccess(actor, contract, {
        mode: "OPERATE_EXISTING",
        tournament,
        serverNowIso: this.store.nowIso(),
      });
    }

    const allVersions = this.store.configVersions.get(tournamentId) ?? [];
    const limit = Math.max(1, Math.min(query.limit ?? 20, 100));

    let startIndex = 0;
    if (query.cursor) {
      const idx = allVersions.findIndex((v) => v.id === query.cursor);
      if (idx >= 0) {
        startIndex = idx + 1;
      }
    }

    const page = allVersions.slice(startIndex, startIndex + limit);
    const nextCursor =
      startIndex + limit < allVersions.length
        ? page[page.length - 1]?.id ?? null
        : null;

    const items: RuleVersionItem[] = page.map((v) => {
      const digest =
        (v as any).profileDigest ??
        createHash("sha256")
          .update(JSON.stringify(v.ruleProfileSnapshot))
          .digest("hex");
      return RuleVersionItemSchema.parse({
        id: v.id,
        tournamentId: v.tournamentId,
        versionNumber: v.versionNumber,
        profileRef: (v as any).profileRef ?? {
          draftId: v.id,
          revision: v.versionNumber,
        },
        profileDigest: digest,
        reason: v.changeSummary,
        effectiveAt: v.effectiveAt,
        createdAt: v.createdAt,
        immutable: true,
      });
    });

    return RuleVersionListResponseSchema.parse({
      items,
      nextCursor,
      configRevision: tournament.revision,
    });
  }

  async diffVersions(
    context: AuthContext,
    tournamentId: string,
    versionId: string,
    againstVersionId?: string
  ): Promise<RuleVersionDiffResponse> {
    const actor = this.resolveActor(context);
    const tournament = this.store.tournaments.get(tournamentId);
    if (!tournament) {
      throw new AppError(
        "NOT_FOUND",
        "Không tìm thấy giải đấu.",
        404,
        false,
        "INVALID",
        { reason: "RESOURCE_NOT_FOUND", tournamentId }
      );
    }

    const contract = this.store.contracts.get(tournament.contractId);
    if (contract && !actor.roles.includes("ADMIN")) {
      assertTaContractOrTournamentAccess(actor, contract, {
        mode: "OPERATE_EXISTING",
        tournament,
        serverNowIso: this.store.nowIso(),
      });
    }

    const allVersions = this.store.configVersions.get(tournamentId) ?? [];
    const targetVersion = allVersions.find((v) => v.id === versionId);
    if (!targetVersion) {
      throw new AppError(
        "NOT_FOUND",
        `Không tìm thấy phiên bản luật với id ${versionId}.`,
        404,
        false,
        "INVALID",
        { reason: "VERSION_NOT_FOUND", versionId }
      );
    }

    let baseVersion = againstVersionId
      ? allVersions.find((v) => v.id === againstVersionId)
      : allVersions.find((v) => v.versionNumber === targetVersion.versionNumber - 1);

    if (!baseVersion && allVersions.length > 0) {
      baseVersion = allVersions[0];
    }

    const changes: RuleVersionDiffChange[] = [];
    const baseProfile = (baseVersion?.ruleProfileSnapshot ?? {}) as Record<string, unknown>;
    const targetProfile = targetVersion.ruleProfileSnapshot as Record<string, unknown>;

    const allKeys = new Set([...Object.keys(baseProfile), ...Object.keys(targetProfile)]);
    for (const key of allKeys) {
      const beforeVal = baseProfile[key];
      const afterVal = targetProfile[key];
      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        changes.push({
          path: `ruleProfile.${key}`,
          before: beforeVal,
          after: afterVal,
          impact: "NEW_MATCHES_ONLY",
        });
      }
    }

    const baseDigest = createHash("sha256")
      .update(JSON.stringify(baseProfile))
      .digest("hex");
    const targetDigest = createHash("sha256")
      .update(JSON.stringify(targetProfile))
      .digest("hex");

    return RuleVersionDiffResponseSchema.parse({
      baseVersionId: baseVersion?.id ?? targetVersion.id,
      targetVersionId: targetVersion.id,
      changes,
      sameDigest: baseDigest === targetDigest,
      oldMatchesUnaffected: true,
    });
  }

  async publish(
    context: AuthContext,
    input: PublishRuleVersionInput,
    tournamentId: string
  ): Promise<PublishRuleVersionResponse> {
    const actor = this.resolveActor(context);

    // Compute input payload hash for idempotency checking
    const payloadHash = createHash("sha256")
      .update(
        JSON.stringify({
          tournamentId,
          expectedRevision: input.expectedRevision,
          profileRef: input.profileRef,
          profileDigest: input.profileDigest,
          reason: input.reason,
          effectiveAt: input.effectiveAt,
        })
      )
      .digest("hex");

    const existingRecord = this.idempotencyRecords.get(input.idempotencyKey);
    if (existingRecord) {
      if (existingRecord.payloadHash === payloadHash) {
        return existingRecord.response;
      }
      throw new AppError(
        "CONFLICT",
        "Idempotency key đã dùng cho payload khác.",
        409,
        false,
        "RECOVERABLE",
        { reason: "IDEMPOTENCY_CONFLICT", idempotencyKey: input.idempotencyKey }
      );
    }

    return this.store.withLock(async () => {
      const tournament = this.store.tournaments.get(tournamentId);
      if (!tournament) {
        throw new AppError(
          "NOT_FOUND",
          "Không tìm thấy giải đấu.",
          404,
          false,
          "INVALID",
          { reason: "RESOURCE_NOT_FOUND", tournamentId }
        );
      }

      const contract = this.store.contracts.get(tournament.contractId);
      if (!contract) {
        throw new AppError(
          "NOT_FOUND",
          "Không tìm thấy hợp đồng của giải đấu.",
          404,
          false,
          "INVALID",
          { reason: "CONTRACT_NOT_FOUND", contractId: tournament.contractId }
        );
      }

      const nowIso = this.store.nowIso();
      if (!actor.roles.includes("ADMIN")) {
        assertTaContractOrTournamentAccess(actor, contract, {
          mode: "OPERATE_EXISTING",
          tournament,
          serverNowIso: nowIso,
        });
      }

      if (input.expectedRevision !== tournament.revision) {
        throw new AppError(
          "CONFLICT",
          "Phiên bản giải đấu đã thay đổi. Vui lòng đồng bộ lại.",
          409,
          false,
          "RECOVERABLE",
          {
            reason: "STALE_VERSION",
            expectedRevision: input.expectedRevision,
            currentRevision: tournament.revision,
            tournamentId,
          }
        );
      }

      if (Date.parse(input.effectiveAt) < Date.parse(nowIso)) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Thời điểm áp dụng phiên bản luật mới (effectiveAt) không được nằm trong quá khứ.",
          400,
          false,
          "INVALID",
          {
            reason: "EFFECTIVE_AT_IN_PAST",
            field: "effectiveAt",
            effectiveAt: input.effectiveAt,
          }
        );
      }

      const mergedRules = TournamentRuleProfileSchema.parse({
        ...tournament.ruleProfile,
      });

      const envelopeCheck = evaluateRuleProfileEnvelope(
        mergedRules,
        contract.policyEnvelope
      );

      let response: PublishRuleVersionResponse;

      if (!envelopeCheck.withinEnvelope) {
        // Outside envelope -> Requires ChangeRequest (BR-07, T024, T017)
        const diffs: ChangeRequestFieldDiff[] = envelopeCheck.violations.map((v) => ({
          fieldPath: `ruleProfile.${v.field}`,
          label: v.field,
          beforeValue: (tournament.ruleProfile as Record<string, unknown>)[v.field],
          afterValue: (mergedRules as Record<string, unknown>)[v.field],
          requiresAdminApproval: true,
        }));

        const cr = TournamentChangeRequestSchema.parse({
          id: randomUUID(),
          tournamentId: tournament.id,
          tournamentCode: tournament.coreConfig.tournamentCode,
          tournamentName: tournament.coreConfig.tournamentName,
          contractId: tournament.contractId,
          requestedByTaUserId: actor.userId,
          status: "PENDING",
          reason: input.reason,
          proposedRuleProfilePatch: mergedRules,
          effectiveAt: input.effectiveAt,
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
          actorRole: actor.roles.includes("ADMIN") ? "ADMIN" : "TOURNAMENT_ADMIN",
          action: "CHANGE_REQUEST_CREATED",
          targetType: "CHANGE_REQUEST",
          targetId: cr.id,
          beforeSnapshot: null,
          afterSnapshot: cr,
          reason: cr.reason,
          correlationId: actor.correlationId ?? null,
          nowIso,
        });

        response = {
          outcome: "CHANGE_REQUEST_REQUIRED",
          changeRequestId: cr.id,
          reason: `Thay đổi quy tắc thi đấu nằm ngoài trần hợp đồng: ${envelopeCheck.violations.map((v) => v.message).join("; ")}`,
        };
      } else {
        // Within envelope -> Publish new immutable version directly
        const existingVersions = this.store.configVersions.get(tournament.id) ?? [];
        const nextVersionNumber = existingVersions.length + 1;
        const versionId = randomUUID();

        const publishedVersion = TournamentConfigVersionSchema.parse({
          id: versionId,
          tournamentId: tournament.id,
          versionNumber: nextVersionNumber,
          coreConfigSnapshot: tournament.coreConfig,
          ruleProfileSnapshot: mergedRules,
          effectiveAt: input.effectiveAt,
          publishedByUserId: actor.userId,
          changeSummary: input.reason,
          createdAt: nowIso,
        });

        (publishedVersion as any).profileRef = input.profileRef;
        (publishedVersion as any).profileDigest = input.profileDigest;

        if (this.database) {
          await persistConfigVersionToPrisma(this.database, publishedVersion);
        }
        this.store.configVersions.set(tournament.id, [...existingVersions, publishedVersion]);

        const updatedTournament = TournamentDtoSchema.parse({
          ...tournament,
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
          actorRole: actor.roles.includes("ADMIN") ? "ADMIN" : "TOURNAMENT_ADMIN",
          action: "RULE_VERSION_PUBLISHED",
          targetType: "RULE_VERSION",
          targetId: versionId,
          beforeSnapshot: { ruleProfile: tournament.ruleProfile },
          afterSnapshot: publishedVersion,
          reason: input.reason,
          correlationId: actor.correlationId ?? null,
          nowIso,
        });

        const versionItem: RuleVersionItem = {
          id: versionId,
          tournamentId: tournament.id,
          versionNumber: nextVersionNumber,
          profileRef: input.profileRef,
          profileDigest: input.profileDigest,
          reason: input.reason,
          effectiveAt: input.effectiveAt,
          createdAt: nowIso,
          immutable: true,
        };

        response = {
          outcome: "PUBLISHED",
          version: versionItem,
        };
      }

      this.idempotencyRecords.set(input.idempotencyKey, {
        payloadHash,
        response,
      });

      return response;
    });
  }
}
