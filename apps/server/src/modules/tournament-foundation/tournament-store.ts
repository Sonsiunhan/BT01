import type {
  AuditLogRecordDto,
  ManualAdjudicationRequestDto,
  TournamentChangeRequestDto,
  TournamentConfigVersionDto,
  TournamentContractDto,
  TournamentDto,
  TournamentEnrollmentDto,
  TournamentRole,
  TournamentScoreLedgerEntryDto,
  TournamentStaffAssignmentDto,
  UnitDto,
} from "@ottv2/contracts";
import { AppError, type ErrorCode, type ErrorSeverity } from "../../shared/errors/app-error.js";
import { SanitizingAuditService, type AuditPort } from "./audit.port.js";
import type { PrismaClient } from "@prisma/client";

export function createTournamentError(options: {
  code: ErrorCode;
  statusCode: number;
  message: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
  severity?: ErrorSeverity;
}): AppError {
  return new AppError(
    options.code,
    options.message,
    options.statusCode,
    options.retryable ?? false,
    options.severity ?? (options.code === "CONFLICT" ? "RECOVERABLE" : "INVALID"),
    options.details ?? {}
  );
}

export interface TournamentActorContext {
  userId: string;
  roles: TournamentRole[];
  principalType?: "USER" | "GUEST" | undefined;
  correlationId?: string | undefined;
}

export interface PinnedMatchRecord {
  matchId: string;
  roomId: string;
  tournamentId: string;
  pinnedConfigVersionId: string;
  pinnedConfigVersionNumber: number;
  blueParticipantId: string;
  redParticipantId: string;
  status: "RUNNING" | "PAUSED" | "PAUSED_ADJUDICATION" | "FINISHED" | "CANCELLED";
  winnerSide: "BLUE" | "RED" | null;
  finishSequence: number | null;
  createdAt: string;
  endedAt: string | null;
}

/**
 * Serialized transactional state store for Tournament Initialization.
 * Uses an async mutex queue (`withLock`) to guarantee true serializable isolation
 * for quota reservations, CAS revision updates, adjudication verdicts, and finish_sequence allocation.
 */
export class TournamentStateStore {
  readonly units = new Map<string, UnitDto>();
  readonly contracts = new Map<string, TournamentContractDto>();
  readonly tournaments = new Map<string, TournamentDto>();
  readonly configVersions = new Map<string, TournamentConfigVersionDto[]>();
  readonly changeRequests = new Map<string, TournamentChangeRequestDto>();
  readonly enrollments = new Map<string, TournamentEnrollmentDto>();
  readonly staffAssignments = new Map<string, TournamentStaffAssignmentDto>();
  readonly adjudicationRequests = new Map<string, ManualAdjudicationRequestDto>();
  readonly scoreLedger = new Map<string, TournamentScoreLedgerEntryDto[]>();
  readonly finishSequenceCounters = new Map<string, number>();
  readonly matches = new Map<string, PinnedMatchRecord>();
  readonly systemRoles = new Map<string, Set<TournamentRole>>();
  readonly auditRecords: AuditLogRecordDto[] = [];
  readonly audit: AuditPort;

  private lockChain: Promise<void> = Promise.resolve();
  private clockFn: () => Date = () => new Date();

  constructor(options?: { clockFn?: (() => Date) | undefined; database?: PrismaClient | undefined }) {
    if (options?.clockFn) {
      this.clockFn = options.clockFn;
    }
    this.audit = new SanitizingAuditService(this.auditRecords, options?.database ?? undefined);
  }

  nowIso(): string {
    return this.clockFn().toISOString();
  }

  setClock(clockFn: () => Date): void {
    this.clockFn = clockFn;
  }

  ensureDefaultSeed(): void {
    if (this.units.size === 0) {
      const nowIso = this.nowIso();
      const defaultUnit: UnitDto = {
        id: "unit-fit-vnu",
        unitCode: "UNIT-FIT-VNU",
        unitName: "Khoa Công nghệ Thông tin - Trường ĐH Công nghệ, ĐHQGHN",
        unitType: "KHOA",
        contactName: "Ban Quản trị FIT",
        contactEmail: "contact@fit.vnu.edu.vn",
        status: "ACTIVE",
        referencedContractsCount: 0,
        referencedTournamentsCount: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      this.units.set(defaultUnit.id, defaultUnit);
    }

    if (this.contracts.size === 0) {
      const nowIso = this.nowIso();
      const defaultContract: TournamentContractDto = {
        id: "HD-2026-CHUNG",
        contractCode: "HD-2026-CHUNG",
        unitId: "unit-fit-vnu",
        unitCode: "UNIT-FIT-VNU",
        unitName: "Khoa Công nghệ Thông tin - Trường ĐH Công nghệ, ĐHQGHN",
        status: "ACTIVE",
        validFrom: "2026-01-01T00:00:00.000Z",
        validTo: "2030-12-31T23:59:59.000Z",
        maxTournamentsTotal: 100,
        quotaReservedCount: 0,
        quotaConsumedCount: 0,
        quotaRemainingCount: 100,
        maxParticipantsPerTournament: 256,
        maxParticipantsTotal: 1000,
        currentParticipantsTotal: 0,
        allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
        policyEnvelope: {
          allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
          turnSecondsMin: 5,
          turnSecondsMax: 300,
          totalMatchSecondsMin: 30,
          totalMatchSecondsMax: 3600,
          turnLimitMin: 10,
          turnLimitMax: 500,
          allowedNoProgressPlies: [10, 20, 30, 40, 50, 60, 80, 100],
          allowedRepetitionThresholds: [2, 3, 4, 5, 6],
          allowedTieBreakPolicies: [
            "RANDOM_SEEDED",
            "BLUE_ADVANTAGE",
            "RED_ADVANTAGE",
            "REPLAY_ONCE_THEN_SEEDED",
            "MANUAL_REFEREE",
          ],
        },
        technicalCaps: {
          botSourceMaxBytes: 65536,
          botRuntimeTimeoutMs: 1000,
          botMemoryLimitMb: 64,
          maxConcurrentMatchesPerTournament: 16,
          rosterImportMaxRows: 2000,
        },
        taBindings: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      this.contracts.set(defaultContract.id, defaultContract);
    }
  }

  async withLock<T>(fn: () => Promise<T> | T): Promise<T> {
    let release!: () => void;
    const nextLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previousLock = this.lockChain;
    this.lockChain = previousLock.catch(() => {}).then(() => nextLock);

    await previousLock.catch(() => {});
    try {
      return await fn();
    } finally {
      release();
    }
  }

  allocateFinishSequence(tournamentId: string): number {
    const current = this.finishSequenceCounters.get(tournamentId) ?? 0;
    const next = current + 1;
    this.finishSequenceCounters.set(tournamentId, next);
    return next;
  }

  grantSystemRole(userId: string, role: TournamentRole): void {
    const existing = this.systemRoles.get(userId) ?? new Set<TournamentRole>();
    existing.add(role);
    this.systemRoles.set(userId, existing);
  }

  revokeSystemRole(userId: string, role: TournamentRole): void {
    const existing = this.systemRoles.get(userId);
    if (existing) {
      existing.delete(role);
    }
  }

  /**
   * T001: Computes authoritative roles strictly from server-side state
   * (systemRoles, contract TA bindings, and tournament staff assignments).
   * Never trusts roles passed in URL, headers, or request body.
   */
  resolveAuthoritativeActor(params: {
    userId: string;
    username?: string | undefined;
    principalType?: "USER" | "GUEST" | undefined;
    roles?: string[] | undefined;
    correlationId?: string | undefined;
  }): TournamentActorContext {
    if (params.principalType === "GUEST") {
      return {
        userId: params.userId,
        principalType: "GUEST",
        roles: ["GUEST"],
        correlationId: params.correlationId,
      };
    }

    const roles = new Set<TournamentRole>(["PLAYER"]);
    const sys = this.systemRoles.get(params.userId);
    if (sys) {
      for (const r of sys) roles.add(r);
    }
    if (params.roles) {
      for (const r of params.roles) {
        if (r === "ADMIN" || r === "SYSTEM_ADMIN") {
          roles.add("ADMIN");
        }
        if (r === "TOURNAMENT_ADMIN") {
          roles.add("TOURNAMENT_ADMIN");
        }
      }
    }

    for (const c of this.contracts.values()) {
      if (c.taBindings.some((b) => b.userId === params.userId && b.status === "ACTIVE")) {
        roles.add("TOURNAMENT_ADMIN");
      }
    }

    for (const s of this.staffAssignments.values()) {
      if (s.userId === params.userId && s.status === "ACTIVE") {
        roles.add(s.role);
      }
    }

    return {
      userId: params.userId,
      principalType: "USER",
      roles: Array.from(roles),
      correlationId: params.correlationId,
    };
  }
}

export function assertAdminActor(actor: TournamentActorContext): void {
  if (!actor.roles.includes("ADMIN")) {
    throw createTournamentError({
      code: "UNAUTHORIZED",
      statusCode: 403,
      message: "Chỉ Quản trị hệ thống (Admin) mới được phép thực hiện thao tác này.",
      details: { reason: "FORBIDDEN_ROLE" },
    });
  }
}

export function hasActiveTaBindingForContract(
  actor: TournamentActorContext,
  contract: TournamentContractDto
): boolean {
  return contract.taBindings.some(
    (b) => b.userId === actor.userId && b.status === "ACTIVE"
  );
}

/**
 * Enforces TA / Admin scoping on a Contract & Tournament (BR-01..BR-04, T006, T008, T009, T018):
 * - For creating a NEW draft, the actor must have an ACTIVE TA binding on an ACTIVE, non-expired contract.
 * - For operating an EXISTING tournament that they own (`ownerTaUserId === actor.userId`),
 *   contract expiry does NOT strip their operational access to that existing tournament,
 *   unless their TA binding was explicitly REVOKED (`status === "REVOKED"`).
 */
export function assertTaContractOrTournamentAccess(
  actor: TournamentActorContext,
  contract: TournamentContractDto,
  options: {
    mode: "NEW_DRAFT" | "OPERATE_EXISTING" | "ADJUDICATE_MATCH";
    tournament?: TournamentDto;
    serverNowIso: string;
  }
): void {
  // T059: Admin is strictly forbidden from adjudicating matches directly; only owner TA can adjudicate
  if (options.mode === "ADJUDICATE_MATCH") {
    if (!options.tournament || options.tournament.ownerTaUserId !== actor.userId) {
      throw createTournamentError({
        code: "UNAUTHORIZED",
        statusCode: 403,
        message: "Chỉ Quản trị giải (TA) sở hữu giải đấu mới được phép phán quyết trận đấu này.",
        details: {
          reason: "FORBIDDEN_ROLE",
          tournamentId: options.tournament?.id ?? "",
        },
      });
    }
    const binding = contract.taBindings.find((b) => b.userId === actor.userId);
    if (!binding || binding.status === "REVOKED") {
      throw createTournamentError({
        code: "UNAUTHORIZED",
        statusCode: 403,
        message: "Quyền Quản trị giải (TA) của bạn trên hợp đồng này đã bị thu hồi.",
        details: {
          reason: "FORBIDDEN_ROLE",
          contractId: contract.id,
        },
      });
    }
    return;
  }

  const isAdmin = actor.roles.includes("ADMIN");
  const binding = contract.taBindings.find((b) => b.userId === actor.userId);
  if (!isAdmin && (!binding || binding.status !== "ACTIVE")) {
    throw createTournamentError({
      code: "UNAUTHORIZED",
      statusCode: 403,
      message: "Bạn không có quyền Quản trị giải (TA) đang hoạt động trên hợp đồng này.",
      details: {
        reason: "FORBIDDEN_ROLE",
        contractId: contract.id,
      },
    });
  }

  const nowMs = Date.parse(options.serverNowIso);
  const validFromMs = Date.parse(contract.validFrom);
  const validToMs = Date.parse(contract.validTo);
  const isContractExpired = nowMs > validToMs || contract.status === "EXPIRED";

  if (options.mode === "NEW_DRAFT") {
    if (contract.status === "REVOKED") {
      throw createTournamentError({
        code: "CONFLICT",
        statusCode: 409,
        message: "Hợp đồng đã bị thu hồi, không thể tạo giải mới.",
        details: { reason: "CONTRACT_REVOKED", contractId: contract.id },
      });
    }
    if (isContractExpired || nowMs < validFromMs || contract.status !== "ACTIVE") {
      throw createTournamentError({
        code: "CONFLICT",
        statusCode: 409,
        message: "Hợp đồng chưa có hiệu lực hoặc đã hết hạn, không thể tạo giải mới.",
        details: { reason: "CONTRACT_NOT_ACTIVE", contractId: contract.id },
      });
    }
    return;
  }

  // OPERATE_EXISTING: must own the tournament or have ADMIN role
  if (options.tournament && options.tournament.ownerTaUserId !== actor.userId && !isAdmin) {
    throw createTournamentError({
      code: "UNAUTHORIZED",
      statusCode: 403,
      message: "Bạn không thể thao tác trên giải đấu thuộc hợp đồng/TA khác.",
      details: {
        reason: "FORBIDDEN_ROLE",
        tournamentId: options.tournament.id,
      },
    });
  }
}
