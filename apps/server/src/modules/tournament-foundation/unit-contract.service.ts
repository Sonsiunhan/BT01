import { randomUUID } from "node:crypto";
import {
  CreateTournamentContractInputSchema,
  CreateUnitInputSchema,
  GrantContractTaInputSchema,
  RevokeContractTaInputSchema,
  TournamentContractSchema,
  UnitSchema,
  UpdateTournamentContractInputSchema,
  UpdateUnitInputSchema,
  type CreateTournamentContractInput,
  type CreateUnitInput,
  type GrantContractTaInput,
  type RevokeContractTaInput,
  type TournamentContractDto,
  type UnitDto,
  type UpdateTournamentContractInput,
  type UpdateUnitInput,
} from "@ottv2/contracts";
import {
  assertAdminActor,
  createTournamentError,
  type TournamentActorContext,
  type TournamentStateStore,
} from "./tournament-store.js";
import {
  deleteUnitFromPrisma,
  persistContractToPrisma,
  persistUnitToPrisma,
} from "./prisma-sync.js";
import type { PrismaClient } from "@prisma/client";

export class UnitContractService {
  constructor(
    private readonly store: TournamentStateStore,
    private readonly database?: PrismaClient
  ) {}

  private enrichUnit(unit: UnitDto): UnitDto {
    let referencedContractsCount = 0;
    let referencedTournamentsCount = 0;
    for (const c of this.store.contracts.values()) {
      if (c.unitId === unit.id) referencedContractsCount += 1;
    }
    for (const t of this.store.tournaments.values()) {
      if (t.unitId === unit.id) referencedTournamentsCount += 1;
    }
    return {
      ...unit,
      referencedContractsCount,
      referencedTournamentsCount,
    };
  }

  private enrichContract(contract: TournamentContractDto): TournamentContractDto {
    const unit = this.store.units.get(contract.unitId);
    let currentParticipantsTotal = 0;
    for (const e of this.store.enrollments.values()) {
      if (e.contractId !== contract.id) continue;
      const t = this.store.tournaments.get(e.tournamentId);
      if (!t || t.status === "REJECTED" || t.status === "CANCELLED") continue;
      if (e.eligibilityStatus !== "WITHDRAWN" && e.eligibilityStatus !== "DISQUALIFIED") {
        currentParticipantsTotal += 1;
      }
    }
    const quotaRemainingCount = Math.max(
      0,
      contract.maxTournamentsTotal - contract.quotaReservedCount
    );
    return {
      ...contract,
      unitCode: unit?.unitCode ?? contract.unitCode,
      unitName: unit?.unitName ?? contract.unitName,
      quotaRemainingCount,
      currentParticipantsTotal,
    };
  }

  async createUnit(
    actor: TournamentActorContext,
    rawInput: CreateUnitInput
  ): Promise<UnitDto> {
    assertAdminActor(actor);
    const parsed = CreateUnitInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      throw createTournamentError({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: firstIssue?.message ?? "Dữ liệu đơn vị không hợp lệ.",
        details: {
          reason: "SCHEMA_VALIDATION_FAILED",
          field: String(firstIssue?.path[0] ?? "unitCode"),
        },
      });
    }

    return this.store.withLock(async () => {
      for (const existing of this.store.units.values()) {
        if (existing.unitCode.toUpperCase() === parsed.data.unitCode.toUpperCase()) {
          throw createTournamentError({
            code: "CONFLICT",
            statusCode: 409,
            message: `Mã đơn vị "${parsed.data.unitCode}" đã tồn tại.`,
            details: {
              reason: "UNIT_CODE_DUPLICATE",
              field: "unitCode",
              unitCode: parsed.data.unitCode,
            },
          });
        }
      }

      const now = this.store.nowIso();
      const unit = UnitSchema.parse({
        id: randomUUID(),
        unitCode: parsed.data.unitCode,
        unitName: parsed.data.unitName,
        unitType: parsed.data.unitType,
        contactName: parsed.data.contactName,
        contactEmail: parsed.data.contactEmail,
        status: parsed.data.status,
        referencedContractsCount: 0,
        referencedTournamentsCount: 0,
        createdAt: now,
        updatedAt: now,
      });

      if (this.database) {
        await persistUnitToPrisma(this.database, unit);
      }
      this.store.units.set(unit.id, unit);
      this.store.audit.append({
        actorUserId: actor.userId,
        actorRole: "ADMIN",
        action: "UNIT_CREATED",
        targetType: "UNIT",
        targetId: unit.id,
        beforeSnapshot: null,
        afterSnapshot: unit,
        correlationId: actor.correlationId ?? null,
        nowIso: now,
      });

      return this.enrichUnit(unit);
    });
  }

  async updateUnit(
    actor: TournamentActorContext,
    unitId: string,
    rawInput: UpdateUnitInput
  ): Promise<UnitDto> {
    assertAdminActor(actor);
    const parsed = UpdateUnitInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      throw createTournamentError({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: firstIssue?.message ?? "Dữ liệu cập nhật đơn vị không hợp lệ.",
        details: {
          reason: "SCHEMA_VALIDATION_FAILED",
          field: String(firstIssue?.path[0] ?? "unitName"),
        },
      });
    }

    return this.store.withLock(async () => {
      const existing = this.store.units.get(unitId);
      if (!existing) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy đơn vị.",
          details: { reason: "RESOURCE_NOT_FOUND" },
        });
      }

      const now = this.store.nowIso();
      const updated: UnitDto = UnitSchema.parse({
        ...existing,
        ...parsed.data,
        updatedAt: now,
      });

      if (this.database) {
        await persistUnitToPrisma(this.database, updated);
      }
      this.store.units.set(unitId, updated);
      this.store.audit.append({
        actorUserId: actor.userId,
        actorRole: "ADMIN",
        action: "UNIT_UPDATED",
        targetType: "UNIT",
        targetId: unitId,
        beforeSnapshot: existing,
        afterSnapshot: updated,
        correlationId: actor.correlationId ?? null,
        nowIso: now,
      });

      return this.enrichUnit(updated);
    });
  }

  async deleteUnit(actor: TournamentActorContext, unitId: string): Promise<{ deleted: true }> {
    assertAdminActor(actor);
    return this.store.withLock(async () => {
      const existing = this.store.units.get(unitId);
      if (!existing) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy đơn vị.",
          details: { reason: "RESOURCE_NOT_FOUND" },
        });
      }

      const enriched = this.enrichUnit(existing);
      if (
        enriched.referencedContractsCount > 0 ||
        enriched.referencedTournamentsCount > 0
      ) {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message:
            "Không thể xóa đơn vị đang được tham chiếu bởi Hợp đồng hoặc Giải đấu. Vui lòng chuyển trạng thái sang INACTIVE hoặc SUSPENDED.",
          details: {
            reason: "UNIT_REFERENCED_CANNOT_DELETE",
            unitCode: existing.unitCode,
          },
        });
      }

      if (this.database) {
        await deleteUnitFromPrisma(this.database, unitId);
      }
      this.store.units.delete(unitId);
      this.store.audit.append({
        actorUserId: actor.userId,
        actorRole: "ADMIN",
        action: "UNIT_DELETED",
        targetType: "UNIT",
        targetId: unitId,
        beforeSnapshot: existing,
        afterSnapshot: null,
        correlationId: actor.correlationId ?? null,
        nowIso: this.store.nowIso(),
      });

      return { deleted: true };
    });
  }

  listUnits(): UnitDto[] {
    return Array.from(this.store.units.values()).map((u) => this.enrichUnit(u));
  }

  getUnit(unitId: string): UnitDto {
    const unit = this.store.units.get(unitId);
    if (!unit) {
      throw createTournamentError({
        code: "NOT_FOUND",
        statusCode: 404,
        message: "Không tìm thấy đơn vị.",
        details: { reason: "RESOURCE_NOT_FOUND" },
      });
    }
    return this.enrichUnit(unit);
  }

  async createContract(
    actor: TournamentActorContext,
    rawInput: CreateTournamentContractInput
  ): Promise<TournamentContractDto> {
    assertAdminActor(actor);
    const parsed = CreateTournamentContractInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      throw createTournamentError({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: firstIssue?.message ?? "Dữ liệu hợp đồng không hợp lệ.",
        details: {
          reason: "SCHEMA_VALIDATION_FAILED",
          field: String(firstIssue?.path[0] ?? "contractCode"),
        },
      });
    }

    return this.store.withLock(async () => {
      const unit = this.store.units.get(parsed.data.unitId);
      if (!unit) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy đơn vị chủ quản cho hợp đồng.",
          details: { reason: "RESOURCE_NOT_FOUND", field: "unitId" },
        });
      }
      if (unit.status !== "ACTIVE") {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: "Không thể tạo hợp đồng mới cho đơn vị đang INACTIVE hoặc SUSPENDED.",
          details: { reason: "UNIT_NOT_ACTIVE", unitCode: unit.unitCode },
        });
      }

      for (const existing of this.store.contracts.values()) {
        if (existing.contractCode.toUpperCase() === parsed.data.contractCode.toUpperCase()) {
          throw createTournamentError({
            code: "CONFLICT",
            statusCode: 409,
            message: `Mã hợp đồng "${parsed.data.contractCode}" đã tồn tại.`,
            details: {
              reason: "CONTRACT_CODE_DUPLICATE",
              field: "contractCode",
            },
          });
        }
      }

      const now = this.store.nowIso();
      const contractId = randomUUID();
      const taBindings = parsed.data.initialTaUserIds.map((userId) => ({
        id: randomUUID(),
        contractId,
        userId,
        username: userId,
        displayName: `TA ${userId}`,
        status: "ACTIVE" as const,
        grantedByUserId: actor.userId,
        grantedAt: now,
        revokedAt: null,
        revokeReason: null,
      }));

      const contract = TournamentContractSchema.parse({
        id: contractId,
        contractCode: parsed.data.contractCode,
        unitId: unit.id,
        unitCode: unit.unitCode,
        unitName: unit.unitName,
        status: parsed.data.status,
        validFrom: parsed.data.validFrom,
        validTo: parsed.data.validTo,
        maxTournamentsTotal: parsed.data.maxTournamentsTotal,
        quotaReservedCount: 0,
        quotaConsumedCount: 0,
        quotaRemainingCount: parsed.data.maxTournamentsTotal,
        maxParticipantsPerTournament: parsed.data.maxParticipantsPerTournament,
        maxParticipantsTotal: parsed.data.maxParticipantsTotal,
        currentParticipantsTotal: 0,
        allowedModes: parsed.data.allowedModes,
        policyEnvelope: parsed.data.policyEnvelope,
        technicalCaps: parsed.data.technicalCaps,
        taBindings,
        createdAt: now,
        updatedAt: now,
      });

      if (this.database) {
        await persistContractToPrisma(this.database, contract);
      }
      this.store.contracts.set(contract.id, contract);
      this.store.audit.append({
        actorUserId: actor.userId,
        actorRole: "ADMIN",
        action: "CONTRACT_CREATED",
        targetType: "CONTRACT",
        targetId: contract.id,
        beforeSnapshot: null,
        afterSnapshot: contract,
        correlationId: actor.correlationId ?? null,
        nowIso: now,
      });

      return this.enrichContract(contract);
    });
  }

  async updateContract(
    actor: TournamentActorContext,
    contractId: string,
    rawInput: UpdateTournamentContractInput
  ): Promise<TournamentContractDto> {
    assertAdminActor(actor);
    const parsed = UpdateTournamentContractInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      throw createTournamentError({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: firstIssue?.message ?? "Dữ liệu cập nhật hợp đồng không hợp lệ.",
        details: {
          reason: "SCHEMA_VALIDATION_FAILED",
          field: String(firstIssue?.path[0] ?? "status"),
        },
      });
    }

    return this.store.withLock(async () => {
      const existing = this.store.contracts.get(contractId);
      if (!existing) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy hợp đồng.",
          details: { reason: "RESOURCE_NOT_FOUND", contractId },
        });
      }

      const nextMaxTournaments =
        parsed.data.maxTournamentsTotal ?? existing.maxTournamentsTotal;
      if (nextMaxTournaments < existing.quotaReservedCount) {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: `Không thể hạ tổng hạn mức giải (${nextMaxTournaments}) xuống thấp hơn số hạn mức đã giữ chỗ (${existing.quotaReservedCount}).`,
          details: {
            reason: "QUOTA_FLOOR_VIOLATION",
            contractId,
            field: "maxTournamentsTotal",
          },
        });
      }

      const now = this.store.nowIso();
      const updated = TournamentContractSchema.parse({
        ...existing,
        ...parsed.data,
        updatedAt: now,
      });

      if (this.database) {
        await persistContractToPrisma(this.database, updated);
      }
      this.store.contracts.set(contractId, updated);
      this.store.audit.append({
        actorUserId: actor.userId,
        actorRole: "ADMIN",
        action: "CONTRACT_UPDATED",
        targetType: "CONTRACT",
        targetId: contractId,
        beforeSnapshot: existing,
        afterSnapshot: updated,
        reason: parsed.data.statusReason ?? null,
        correlationId: actor.correlationId ?? null,
        nowIso: now,
      });

      return this.enrichContract(updated);
    });
  }

  async grantTaBinding(
    actor: TournamentActorContext,
    contractId: string,
    rawInput: GrantContractTaInput
  ): Promise<TournamentContractDto> {
    assertAdminActor(actor);
    const parsed = GrantContractTaInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw createTournamentError({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: parsed.error.issues[0]?.message ?? "Thông tin gán TA không hợp lệ.",
        details: { reason: "SCHEMA_VALIDATION_FAILED", field: "userId" },
      });
    }

    return this.store.withLock(async () => {
      const existing = this.store.contracts.get(contractId);
      if (!existing) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy hợp đồng.",
          details: { reason: "RESOURCE_NOT_FOUND", contractId },
        });
      }

      const now = this.store.nowIso();
      const currentIdx = existing.taBindings.findIndex(
        (b) => b.userId === parsed.data.userId
      );
      const nextBindings = [...existing.taBindings];

      if (currentIdx >= 0) {
        nextBindings[currentIdx] = {
          ...nextBindings[currentIdx]!,
          status: "ACTIVE",
          grantedByUserId: actor.userId,
          grantedAt: now,
          revokedAt: null,
          revokeReason: null,
        };
      } else {
        nextBindings.push({
          id: randomUUID(),
          contractId,
          userId: parsed.data.userId,
          username: parsed.data.username ?? parsed.data.userId,
          displayName: parsed.data.displayName ?? `TA ${parsed.data.userId}`,
          status: "ACTIVE",
          grantedByUserId: actor.userId,
          grantedAt: now,
          revokedAt: null,
          revokeReason: null,
        });
      }

      const updated: TournamentContractDto = {
        ...existing,
        taBindings: nextBindings,
        updatedAt: now,
      };
      if (this.database) {
        await persistContractToPrisma(this.database, updated);
      }
      this.store.contracts.set(contractId, updated);

      this.store.audit.append({
        actorUserId: actor.userId,
        actorRole: "ADMIN",
        action: "CONTRACT_TA_GRANTED",
        targetType: "CONTRACT_TA_BINDING",
        targetId: `${contractId}:${parsed.data.userId}`,
        beforeSnapshot: { taBindings: existing.taBindings },
        afterSnapshot: { taBindings: updated.taBindings },
        correlationId: actor.correlationId ?? null,
        nowIso: now,
      });

      return this.enrichContract(updated);
    });
  }

  async revokeTaBinding(
    actor: TournamentActorContext,
    contractId: string,
    targetUserId: string,
    rawInput: RevokeContractTaInput
  ): Promise<TournamentContractDto> {
    assertAdminActor(actor);
    const parsed = RevokeContractTaInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw createTournamentError({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: parsed.error.issues[0]?.message ?? "Vui lòng nhập lý do thu hồi TA.",
        details: { reason: "SCHEMA_VALIDATION_FAILED", field: "reason" },
      });
    }

    return this.store.withLock(async () => {
      const existing = this.store.contracts.get(contractId);
      if (!existing) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy hợp đồng.",
          details: { reason: "RESOURCE_NOT_FOUND", contractId },
        });
      }

      const idx = existing.taBindings.findIndex((b) => b.userId === targetUserId);
      if (idx < 0) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Người dùng này chưa được gán quyền TA trên hợp đồng.",
          details: { reason: "RESOURCE_NOT_FOUND", contractId },
        });
      }

      const now = this.store.nowIso();
      const nextBindings = [...existing.taBindings];
      nextBindings[idx] = {
        ...nextBindings[idx]!,
        status: "REVOKED",
        revokedAt: now,
        revokeReason: parsed.data.reason,
      };

      const updated: TournamentContractDto = {
        ...existing,
        taBindings: nextBindings,
        updatedAt: now,
      };
      if (this.database) {
        await persistContractToPrisma(this.database, updated);
      }
      this.store.contracts.set(contractId, updated);

      this.store.audit.append({
        actorUserId: actor.userId,
        actorRole: "ADMIN",
        action: "CONTRACT_TA_REVOKED",
        targetType: "CONTRACT_TA_BINDING",
        targetId: `${contractId}:${targetUserId}`,
        beforeSnapshot: { taBindings: existing.taBindings },
        afterSnapshot: { taBindings: updated.taBindings },
        reason: parsed.data.reason,
        correlationId: actor.correlationId ?? null,
        nowIso: now,
      });

      return this.enrichContract(updated);
    });
  }

  /**
   * T008 & T018: Marks contracts whose validTo < serverNow as EXPIRED without revoking
   * TA operations on already-created tournaments under that contract.
   */
  async expireContractsIfNeeded(serverNowIso?: string): Promise<number> {
    return this.store.withLock(async () => {
      const nowIso = serverNowIso ?? this.store.nowIso();
      const nowMs = Date.parse(nowIso);
      let expiredCount = 0;

      for (const [id, contract] of this.store.contracts.entries()) {
        if (contract.status === "ACTIVE" && Date.parse(contract.validTo) < nowMs) {
          const updated: TournamentContractDto = {
            ...contract,
            status: "EXPIRED",
            updatedAt: nowIso,
          };
          if (this.database) {
            await persistContractToPrisma(this.database, updated);
          }
          this.store.contracts.set(id, updated);
          expiredCount += 1;
        }
      }
      return expiredCount;
    });
  }

  listContracts(filter?: { unitId?: string; status?: string; taUserId?: string }): TournamentContractDto[] {
    return Array.from(this.store.contracts.values())
      .filter((c) => {
        if (filter?.unitId && c.unitId !== filter.unitId) return false;
        if (filter?.status && c.status !== filter.status) return false;
        if (
          filter?.taUserId &&
          !c.taBindings.some((b) => b.userId === filter.taUserId && b.status === "ACTIVE")
        ) {
          return false;
        }
        return true;
      })
      .map((c) => this.enrichContract(c));
  }

  getContract(contractId: string): TournamentContractDto {
    const contract = this.store.contracts.get(contractId);
    if (!contract) {
      throw createTournamentError({
        code: "NOT_FOUND",
        statusCode: 404,
        message: "Không tìm thấy hợp đồng.",
        details: { reason: "RESOURCE_NOT_FOUND", contractId },
      });
    }
    return this.enrichContract(contract);
  }
}
