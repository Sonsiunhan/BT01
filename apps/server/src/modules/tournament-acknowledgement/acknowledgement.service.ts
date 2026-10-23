import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  AcknowledgeRulesRequestSchema, PublishedRegulationsSchema,
  RulesAcknowledgementEvidenceSchema, RulesAcknowledgementStatusSchema,
  type RulesAcknowledgementStatus,
} from "@ottv2/contracts";
import { AppError } from "../../shared/errors/app-error.js";

/** Only constructed from authenticated server context; never from request body. */
export type AcknowledgementActor = { userId: string; principal: "ACCOUNT" | "GUEST" };
export type AcknowledgementScope = { tournamentId: string; contractId: string };

function conflict(reason: string): AppError {
  return new AppError("CONFLICT", "Điều lệ chưa được công bố hoặc phiên bản đã thay đổi. Vui lòng tải lại.", 409, false, "RECOVERABLE", { reason });
}

export class TournamentAcknowledgementService {
  constructor(private readonly db: PrismaClient, private readonly options: { now?: () => Date } = {}) {}

  private async current(tx: Prisma.TransactionClient, actor: AcknowledgementActor, scope: AcknowledgementScope) {
    if (actor.principal !== "ACCOUNT" || !actor.userId) {
      throw new AppError("UNAUTHORIZED", "Vui lòng đăng nhập bằng tài khoản thí sinh.", 401, false, "FATAL_SESSION");
    }
    // Generic denial for both absent and foreign scopes. Roles do not bypass ownership.
    const tournament = await tx.tournament.findFirst({
      where: { id: scope.tournamentId, contractId: scope.contractId },
      select: { id: true },
    });
    const enrollment = tournament && await tx.tournamentEnrollmentRecord.findFirst({
      where: { tournamentId: scope.tournamentId, contractId: scope.contractId, userId: actor.userId },
      select: { id: true },
    });
    if (!enrollment) throw new AppError("UNAUTHORIZED", "Bạn không có quyền xác nhận điều lệ trong phạm vi này.", 403, false, "INVALID");
    const now = this.options.now?.() ?? new Date();
    const version = await tx.tournamentConfigVersionRecord.findFirst({
      where: { tournamentId: scope.tournamentId, effectiveAt: { lte: now } },
      orderBy: { versionNumber: "desc" },
      select: { id: true, versionNumber: true, effectiveAt: true, coreConfigSnapshot: true },
    });
    if (!version) throw conflict("NO_EFFECTIVE_RULE_VERSION");
    const regulations = PublishedRegulationsSchema.safeParse(version.coreConfigSnapshot);
    if (!regulations.success) throw conflict("REGULATIONS_NOT_PUBLISHED");
    return { version, regulations: regulations.data, now };
  }

  private async read(tx: Prisma.TransactionClient, actor: AcknowledgementActor, scope: AcknowledgementScope) {
    const current = await this.current(tx, actor, scope);
    const key = { userId: actor.userId, contractId: scope.contractId, tournamentId: scope.tournamentId, configVersionId: current.version.id };
    const evidence = await tx.tournamentRulesAcknowledgement.findUnique({
      where: { userId_contractId_tournamentId_configVersionId: key },
      select: { id: true, userId: true, contractId: true, tournamentId: true, configVersionId: true, acknowledgedAt: true, evidenceKind: true },
    });
    return { ...current, key, evidence };
  }

  private dto(scope: AcknowledgementScope, state: Awaited<ReturnType<TournamentAcknowledgementService["read"]>>): RulesAcknowledgementStatus {
    return RulesAcknowledgementStatusSchema.parse({
      contractId: scope.contractId, tournamentId: scope.tournamentId,
      configVersionId: state.version.id, versionNumber: state.version.versionNumber,
      effectiveAt: state.version.effectiveAt.toISOString(),
      regulationsFull: state.regulations.regulationsFull, rulesQuickSummary: state.regulations.rulesQuickSummary,
      required: state.regulations.rulesAckRequired,
      satisfied: !state.regulations.rulesAckRequired || state.evidence !== null,
      evidence: state.evidence ? RulesAcknowledgementEvidenceSchema.parse({
        id: state.evidence.id, ...state.key, acknowledgedAt: state.evidence.acknowledgedAt.toISOString(), evidenceKind: state.evidence.evidenceKind,
      }) : null,
    });
  }

  /** Serializable read/write + natural uniqueness: one evidence and audit per exact version.
   * Retry the whole transaction so scope/version are revalidated after a concurrent publish.
   */
  private async transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.db.$transaction(fn, { isolationLevel: "Serializable" }); }
      catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== "P2034" && code !== "P2002") throw error;
        if (attempt >= 2) throw new AppError("CONFLICT", "Dữ liệu đang thay đổi. Vui lòng thử lại.", 409, true, "RECOVERABLE", { reason: "ACK_RETRY_REQUIRED" });
      }
    }
  }

  async status(actor: AcknowledgementActor, scope: AcknowledgementScope): Promise<RulesAcknowledgementStatus> {
    return this.transaction(async tx => this.dto(scope, await this.read(tx, actor, scope)));
  }

  async acknowledge(actor: AcknowledgementActor, scope: AcknowledgementScope, body: unknown): Promise<RulesAcknowledgementStatus> {
    const parsed = AcknowledgeRulesRequestSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Chỉ gửi mã phiên bản điều lệ cần xác nhận.", 400, false, "INVALID");
    return this.transaction(async tx => {
      const state = await this.read(tx, actor, scope);
      if (parsed.data.configVersionId !== state.version.id) throw conflict("STALE_RULE_VERSION");
      if (!state.evidence) {
        state.evidence = await tx.tournamentRulesAcknowledgement.create({
          data: { id: randomUUID(), ...state.key, acknowledgedAt: state.now, evidenceKind: "AUTHENTICATED_EXPLICIT_ACK" },
        });
        await tx.tournamentAuditLogRecord.create({ data: {
          id: randomUUID(), actorUserId: actor.userId, actorRole: "PLAYER",
          action: "TOURNAMENT_RULES_ACKNOWLEDGED", targetType: "RULE_VERSION", targetId: state.version.id,
          afterSnapshot: { ...state.key, evidenceId: state.evidence.id, transition: "ACKNOWLEDGED", acknowledgedAt: state.now.toISOString() },
          createdAt: state.now,
        } });
      }
      return this.dto(scope, state);
    });
  }

  /** Server-only admission primitive. Consumer must pass its pinned version and invoke
   * within its admission consistency boundary; never re-check existing matches.
   * L07/Long owns atomic match creation and production store integration.
   */
  async assertAcknowledged(actor: AcknowledgementActor, scope: AcknowledgementScope, expectedVersionId: string, tx?: Prisma.TransactionClient): Promise<RulesAcknowledgementStatus> {
    const check = async (client: Prisma.TransactionClient) => {
      const state = await this.read(client, actor, scope);
      if (expectedVersionId !== state.version.id) throw conflict("STALE_RULE_VERSION");
      if (state.regulations.rulesAckRequired && !state.evidence) {
        throw new AppError("CONFLICT", "Bạn cần xác nhận điều lệ hiện hành trước khi tạo trận mới.", 409, false, "RECOVERABLE", { reason: "RULES_ACK_REQUIRED" });
      }
      return this.dto(scope, state);
    };
    return tx ? check(tx) : this.transaction(check);
  }
}
