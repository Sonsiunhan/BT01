import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "../../shared/errors/app-error.js";

export type RetentionActor = {
  userId: string;
  role?: string;
};

export type RetentionScope = {
  tournamentId?: string;
  contractId?: string;
  tenantId?: string;
};

export type RetentionRunResult = {
  dryRun: boolean;
  scope: RetentionScope;
  eligible: {
    expiredRecoverySecrets: number;
    expiredStaffInvitations: number;
    expiredRosterIdempotency: number;
  };
  changed: {
    expiredRecoverySecrets: number;
    expiredStaffInvitations: number;
    expiredRosterIdempotency: number;
  };
  preserved: {
    newerRecoverySecrets: number;
    activeStaffAssignments: number;
    securityAndAuditEvidence: true;
    acknowledgements: true;
  };
};

type RetentionClock = { now?: () => Date; maxBatchSize?: number };
type RetentionTransaction = Prisma.TransactionClient;

const RECOVERY_STATUSES = ["VERIFIED", "RESOLVED", "CLOSED"] as const;

function fail(
  code: ConstructorParameters<typeof AppError>[0],
  message: string,
  statusCode: number,
  details: Record<string, unknown> = {},
): never {
  throw new AppError(code, message, statusCode, false, statusCode >= 500 ? "RECOVERABLE" : "INVALID", details);
}

function requireFiniteDate(value: Date): Date {
  if (!Number.isFinite(value.getTime())) fail("VALIDATION_ERROR", "Thời điểm retention không hợp lệ.", 400, { reason: "INVALID_RETENTION_CLOCK" });
  return value;
}

/**
 * D08-B enforcement over records that already have an authoritative expiry.
 * This is intentionally an explicit batch operation. It does not create a
 * scheduler, public route, migration, or second token lifecycle.
 */
export class RetentionEnforcementService {
  private readonly now: () => Date;
  private readonly maxBatchSize: number;

  constructor(private readonly db: PrismaClient, options: RetentionClock = {}) {
    this.now = options.now ?? (() => new Date());
    this.maxBatchSize = options.maxBatchSize ?? 500;
    if (!Number.isInteger(this.maxBatchSize) || this.maxBatchSize < 1 || this.maxBatchSize > 5000) {
      throw new Error("maxBatchSize must be an integer from 1 to 5000");
    }
  }

  async preview(actor: RetentionActor, scope: RetentionScope): Promise<RetentionRunResult> {
    return this.run(actor, scope, true);
  }

  async execute(actor: RetentionActor, scope: RetentionScope): Promise<RetentionRunResult> {
    return this.run(actor, scope, false);
  }

  private assertAuthority(actor: RetentionActor): void {
    if (!actor?.userId || actor.role !== "SYSTEM_ADMIN") {
      fail("UNAUTHORIZED", "Chỉ hệ thống được ủy quyền mới được chạy retention.", 403, { reason: "RETENTION_SYSTEM_ADMIN_REQUIRED" });
    }
  }

  private assertScopeShape(scope: RetentionScope): void {
    const hasTournament = Boolean(scope.tournamentId);
    const hasTenant = Boolean(scope.tenantId);
    if (hasTournament === hasTenant) {
      fail("VALIDATION_ERROR", "Retention phải có đúng một phạm vi tournament hoặc tenant.", 400, { reason: "RETENTION_SCOPE_REQUIRED" });
    }
    if (hasTournament && !scope.contractId) {
      fail("VALIDATION_ERROR", "Phạm vi tournament phải kèm contract.", 400, { reason: "RETENTION_CONTRACT_REQUIRED" });
    }
  }

  private async resolveTournamentScope(scope: RetentionScope): Promise<void> {
    if (!scope.tournamentId) return;
    const tournament = await this.db.tournament.findUnique({
      where: { id: scope.tournamentId },
      select: { id: true, contractId: true },
    });
    if (!tournament) fail("NOT_FOUND", "Không tìm thấy phạm vi retention.", 404, { reason: "RETENTION_SCOPE_NOT_FOUND" });
    if (tournament.contractId !== scope.contractId) {
      fail("UNAUTHORIZED", "Phạm vi retention không thuộc contract yêu cầu.", 403, { reason: "RETENTION_SCOPE_MISMATCH" });
    }
  }

  private async candidates(tx: RetentionTransaction, scope: RetentionScope, now: Date) {
    const recovery = scope.tenantId
      ? await tx.supportRecoveryTicket.findMany({
          where: {
            tenantId: scope.tenantId!,
            requestType: "ACCOUNT_RECOVERY",
            status: { in: [...RECOVERY_STATUSES] },
            recoveryTokenHash: { not: null },
            recoveryTokenExpiresAt: { lte: now },
          },
          select: { id: true, recoveryTokenExpiresAt: true },
          take: this.maxBatchSize,
        })
      : [];
    const invitations = scope.tournamentId
      ? await tx.tournamentStaffInvitation.findMany({
          where: { tournamentId: scope.tournamentId!, contractId: scope.contractId!, status: "INVITED", expiresAt: { lte: now } },
          select: { id: true, expiresAt: true },
          take: this.maxBatchSize,
        })
      : [];
    const idempotency = scope.tournamentId
      ? await tx.commandLedgerEntry.findMany({
          where: { targetId: scope.tournamentId!, operation: "ROSTER_IMPORT_COMMIT", expiresAt: { lte: now } },
          select: { id: true, expiresAt: true },
          take: this.maxBatchSize,
        })
      : [];

    let terminalTournamentEligible = false;
    if (scope.tournamentId && tx.tournament) {
      const tournament = await (tx.tournament as any).findUnique({
        where: { id: scope.tournamentId },
        select: { id: true, status: true, finalizedAt: true, cancelledAt: true },
      }) as { id: string; status: string; finalizedAt: Date | null; cancelledAt: Date | null } | null;
      if (tournament && (tournament.status === "FINALIZED" || tournament.status === "CANCELLED")) {
        const anchor = tournament.finalizedAt ?? tournament.cancelledAt;
        if (anchor && now.getTime() >= anchor.getTime() + 90 * 24 * 60 * 60 * 1000) {
          terminalTournamentEligible = true;
        }
      }
    }

    const auditCutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const expiredAudits = (scope.tournamentId && tx.tournamentAuditLogRecord && typeof tx.tournamentAuditLogRecord.findMany === "function")
      ? await tx.tournamentAuditLogRecord.findMany({
          where: { targetId: scope.tournamentId, createdAt: { lt: auditCutoff } },
          select: { id: true },
          take: this.maxBatchSize,
        })
      : [];

    return { recovery, invitations, idempotency, terminalTournamentEligible, expiredAudits };
  }

  private result(scope: RetentionScope, dryRun: boolean, candidates: Awaited<ReturnType<RetentionEnforcementService["candidates"]>>, changed: RetentionRunResult["changed"]): RetentionRunResult {
    return {
      dryRun,
      scope: { ...scope },
      eligible: {
        expiredRecoverySecrets: candidates.recovery.length,
        expiredStaffInvitations: candidates.invitations.length,
        expiredRosterIdempotency: candidates.idempotency.length,
      },
      changed,
      preserved: {
        newerRecoverySecrets: 0,
        activeStaffAssignments: 0,
        securityAndAuditEvidence: true,
        acknowledgements: true,
      },
    };
  }

  private async serializable<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== "P2034" && code !== "P2002") throw error;
        if (attempt >= 2) {
          fail("CONFLICT", "Retention đang chạy đồng thời. Vui lòng thử lại.", 409, { reason: "RETENTION_RETRY_REQUIRED" });
        }
      }
    }
  }

  private async run(actor: RetentionActor, scope: RetentionScope, dryRun: boolean): Promise<RetentionRunResult> {
    this.assertAuthority(actor);
    this.assertScopeShape(scope);
    await this.resolveTournamentScope(scope);
    const now = requireFiniteDate(this.now());

    if (dryRun) {
      const candidates = await this.db.$transaction((tx) => this.candidates(tx, scope, now));
      return this.result(scope, true, candidates, { expiredRecoverySecrets: 0, expiredStaffInvitations: 0, expiredRosterIdempotency: 0 });
    }

    return this.serializable(() => this.db.$transaction(async (tx) => {
      // Read candidates and mutate with the same expiry predicates. A dry-run
      // result is never reused as authority for this transaction.
      const candidates = await this.candidates(tx, scope, now);
      let expiredRecoverySecrets = 0;
      let expiredStaffInvitations = 0;

      for (const candidate of candidates.recovery) {
        const update = await tx.supportRecoveryTicket.updateMany({
          where: {
            id: candidate.id,
            tenantId: scope.tenantId!,
            requestType: "ACCOUNT_RECOVERY",
            status: { in: [...RECOVERY_STATUSES] },
            recoveryTokenHash: { not: null },
            recoveryTokenExpiresAt: { lte: now },
          },
          // Keep lifecycle timestamps and consumedAt as safe evidence. Clear
          // only the obsolete secret material and its purpose label.
          data: { recoveryTokenHash: null, recoveryTokenPurpose: null, updatedAt: now },
        });
        if (update.count !== 1) continue;
        expiredRecoverySecrets += 1;
        await tx.tournamentAuditLogRecord.create({
          data: {
            id: randomUUID(), actorUserId: actor.userId, actorRole: "SYSTEM_ADMIN",
            action: "RETENTION_RECOVERY_SECRET_CLEARED", targetType: "SUPPORT_RECOVERY", targetId: candidate.id,
            afterSnapshot: { transition: "EXPIRED_SECRET_MATERIAL_CLEARED", expiredAt: candidate.recoveryTokenExpiresAt?.toISOString() ?? null },
            reason: "D08-B expired recovery secret minimization",
          },
        });
      }

      for (const candidate of candidates.invitations) {
        const update = await tx.tournamentStaffInvitation.updateMany({
          where: { id: candidate.id, tournamentId: scope.tournamentId!, contractId: scope.contractId!, status: "INVITED", expiresAt: { lte: now } },
          data: { status: "EXPIRED" },
        });
        if (update.count !== 1) continue;
        expiredStaffInvitations += 1;
        await tx.tournamentAuditLogRecord.create({
          data: {
            id: randomUUID(), actorUserId: actor.userId, actorRole: "SYSTEM_ADMIN",
            action: "RETENTION_STAFF_INVITATION_EXPIRED", targetType: "STAFF", targetId: candidate.id,
            afterSnapshot: { tournamentId: scope.tournamentId!, transition: "INVITED_TO_EXPIRED" },
            reason: "D08-B expired pending invitation enforcement",
          },
        });
      }

      const deleted = scope.tournamentId
        ? await tx.commandLedgerEntry.deleteMany({
            where: { targetId: scope.tournamentId!, operation: "ROSTER_IMPORT_COMMIT", expiresAt: { lte: now } },
          })
        : { count: 0 };
      if (deleted.count > 0) {
        await tx.tournamentAuditLogRecord.create({
          data: {
            id: randomUUID(), actorUserId: actor.userId, actorRole: "SYSTEM_ADMIN",
            action: "RETENTION_IMPORT_IDEMPOTENCY_CLEARED", targetType: "TOURNAMENT", targetId: scope.tournamentId!,
            afterSnapshot: { transition: "EXPIRED_IMPORT_IDEMPOTENCY_CLEARED", count: deleted.count },
            reason: "D08-B expired import idempotency cleanup",
          },
        });
      }

      if (candidates.terminalTournamentEligible) {
        if (tx.tournamentRulesAcknowledgement && typeof tx.tournamentRulesAcknowledgement.deleteMany === "function") {
          await tx.tournamentRulesAcknowledgement.deleteMany({
            where: { tournamentId: scope.tournamentId! },
          });
        }
        if (tx.tournamentEnrollmentRecord && typeof tx.tournamentEnrollmentRecord.deleteMany === "function") {
          await tx.tournamentEnrollmentRecord.deleteMany({
            where: { tournamentId: scope.tournamentId! },
          });
        }
        await tx.tournamentAuditLogRecord.create({
          data: {
            id: randomUUID(),
            actorUserId: actor.userId,
            actorRole: "SYSTEM_ADMIN",
            action: "RETENTION_TOURNAMENT_OWNED_CLEANED",
            targetType: "TOURNAMENT",
            targetId: scope.tournamentId!,
            afterSnapshot: {
              transition: "TERMINAL_TOURNAMENT_DATA_CLEANED",
              tournamentId: scope.tournamentId!,
            },
            reason: "D12-F03 90-day terminal tournament cleanup",
          },
        });
      }

      if (candidates.expiredAudits.length > 0 && tx.tournamentAuditLogRecord && typeof tx.tournamentAuditLogRecord.deleteMany === "function") {
        await tx.tournamentAuditLogRecord.deleteMany({
          where: {
            id: { in: candidates.expiredAudits.map((a: { id: string }) => a.id) },
          },
        });
      }

      return this.result(scope, false, candidates, {
        expiredRecoverySecrets,
        expiredStaffInvitations,
        expiredRosterIdempotency: deleted.count,
      });
    }, { isolationLevel: "Serializable" }));
  }

  /**
   * Performs an automated retention sweep across all terminal tournaments
   * (>90 days finalized or cancelled) and purges audit logs (>365 days).
   * Safe to call from a scheduled maintenance worker or cron task (D12-F03, D12-F04).
   */
  async runScheduledRetentionSweep(actor: RetentionActor): Promise<{
    cleanedTournaments: number;
    purgedAuditLogs: number;
  }> {
    this.assertAuthority(actor);
    const now = requireFiniteDate(this.now());
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const threeSixtyFiveDaysAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const eligibleTournaments = await this.db.tournament.findMany({
      where: {
        OR: [
          { status: "FINALIZED", finalizedAt: { lte: ninetyDaysAgo } },
          { status: "CANCELLED", cancelledAt: { lte: ninetyDaysAgo } },
        ],
      },
      select: { id: true, contractId: true },
    });

    let cleanedTournaments = 0;
    for (const t of eligibleTournaments) {
      await this.execute(actor, { tournamentId: t.id, contractId: t.contractId });
      cleanedTournaments += 1;
    }

    const purgedAudits = await this.db.tournamentAuditLogRecord.deleteMany({
      where: { createdAt: { lt: threeSixtyFiveDaysAgo } },
    });

    return {
      cleanedTournaments,
      purgedAuditLogs: purgedAudits.count,
    };
  }
}
