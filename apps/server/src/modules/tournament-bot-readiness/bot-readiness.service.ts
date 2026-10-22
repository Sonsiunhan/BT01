import { createHash, randomUUID } from "node:crypto";
import {
  BotReadinessItemSchema,
  BotReadinessJobSchema,
  BotReadinessReceiptSchema,
  BotReadinessSnapshotSchema,
  BotProofResultSchema,
  normalizeLegacyBotReadiness,
  type BotReadinessItem,
  type BotReadinessJob,
  type BotReadinessReceipt,
  type BotReadinessRecheckRequest,
  type BotReadinessSelectionRequest,
  type BotReadinessSnapshot,
  type BotProofMode,
  type BotProofResult,
} from "@ottv2/contracts";
import type { BotLibraryService } from "../bot-library/bot-library.service.js";
import { AppError } from "../../shared/errors/app-error.js";
import { assertTaContractOrTournamentAccess, type TournamentActorContext, type TournamentStateStore } from "../tournament-foundation/tournament-store.js";

type Target = {
  enrollmentId: string;
  tournamentId: string;
  userId: string;
  personKey: string;
  displayName: string;
  eligibilityStatus: "ELIGIBLE" | "PENDING_CLAIM" | "CHECKIN_PENDING" | "BOT_NOT_READY" | "DISQUALIFIED" | "WITHDRAWN";
  revision: number;
  updatedAt: string;
  legacyStatus?: "NOT_REQUIRED" | "READY" | "INVALID" | "MISSING";
};

type RecordValue = {
  target: Target;
  status: BotReadinessItem["status"];
  botId: string | null;
  revisionId: string | null;
  receipt: BotReadinessReceipt | null;
};

type IdempotencyEntry = { fingerprint: string; result: SelectionResult | RecheckResult };
type SelectionResult = BotReadinessItem & { job: BotReadinessJob; idempotent?: boolean };
type RecheckResult = SelectionResult;

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function error(code: AppError["code"], statusCode: number, message: string, details: Record<string, unknown> = {}): AppError {
  return new AppError(code, message, statusCode, code === "SERVICE_UNAVAILABLE", code === "CONFLICT" ? "RECOVERABLE" : "INVALID", details);
}

function safeReceipt(code: BotReadinessReceipt["code"], outcome: BotReadinessReceipt["outcome"], safeMessage: string, completedAt: string): BotReadinessReceipt {
  return BotReadinessReceiptSchema.parse({ code, outcome, safeMessage, completedAt });
}

/**
 * Server-owned readiness state. It deliberately keeps source and runtime logs
 * out of every public projection and commits enrollment pins only after the
 * isolated BotLibrary preflight has returned a trusted result.
 */
export class BotReadinessService {
  private readonly records = new Map<string, RecordValue>();
  private readonly targets = new Map<string, Target>();
  private readonly jobs = new Map<string, BotReadinessJob>();
  private readonly idempotency = new Map<string, IdempotencyEntry>();

  constructor(
    private readonly store: TournamentStateStore,
    private readonly library: BotLibraryService,
  ) {}

  assertDashboardAccess(actor: TournamentActorContext, tournamentId: string): void {
    if (actor.roles.includes("ADMIN")) return;
    const tournament = this.store.tournaments.get(tournamentId);
    const contract = tournament ? this.store.contracts.get(tournament.contractId) : undefined;
    if (!tournament || !contract) throw error("NOT_FOUND", 404, "Không tìm thấy giải đấu.");
    assertTaContractOrTournamentAccess(actor, contract, { mode: "OPERATE_EXISTING", tournament, serverNowIso: this.store.nowIso() });
  }

  seedEnrollment(input: { tournamentId: string; enrollmentId: string; userId: string; personKey: string; displayName?: string }): Target {
    const target: Target = {
      enrollmentId: input.enrollmentId,
      tournamentId: input.tournamentId,
      userId: input.userId,
      personKey: input.personKey,
      displayName: input.displayName ?? input.personKey,
      eligibilityStatus: "ELIGIBLE",
      revision: 0,
      updatedAt: this.store.nowIso(),
    };
    this.targets.set(target.enrollmentId, target);
    return target;
  }

  private targetFor(tournamentId: string, enrollmentId: string): Target {
    const seeded = this.targets.get(enrollmentId);
    if (seeded) {
      if (seeded.tournamentId !== tournamentId) throw error("NOT_FOUND", 404, "Không tìm thấy đăng ký trong giải đấu.");
      return seeded;
    }
    const enrollment = this.store.enrollments.get(enrollmentId);
    if (!enrollment || enrollment.tournamentId !== tournamentId) throw error("NOT_FOUND", 404, "Không tìm thấy đăng ký trong giải đấu.");
    const target: Target = {
      enrollmentId: enrollment.id,
      tournamentId: enrollment.tournamentId,
      userId: enrollment.userId ?? "",
      personKey: enrollment.personKey,
      displayName: enrollment.displayName,
      eligibilityStatus: enrollment.eligibilityStatus,
      revision: 0,
      updatedAt: enrollment.updatedAt,
      legacyStatus: enrollment.botReadinessStatus,
    };
    this.targets.set(target.enrollmentId, target);
    return target;
  }

  private assertOwner(actor: TournamentActorContext, target: Target): void {
    if (!target.userId || actor.userId !== target.userId) throw error("UNAUTHORIZED", 403, "Chỉ chủ bot của đăng ký mới được chọn revision.", { reason: "BOT_OWNER_REQUIRED" });
  }

  private recordFor(target: Target): RecordValue {
    const existing = this.records.get(target.enrollmentId);
    if (existing) return existing;
    const created: RecordValue = { target, status: normalizeLegacyBotReadiness(target.legacyStatus ?? "MISSING"), botId: null, revisionId: null, receipt: null };
    this.records.set(target.enrollmentId, created);
    return created;
  }

  private publicItem(record: RecordValue): BotReadinessItem {
    return BotReadinessItemSchema.parse({
      enrollmentId: record.target.enrollmentId,
      tournamentId: record.target.tournamentId,
      personKey: record.target.personKey,
      displayName: record.target.displayName,
      status: record.status,
      revision: record.target.revision,
      botId: record.botId,
      revisionId: record.revisionId,
      receipt: record.receipt,
      updatedAt: record.target.updatedAt,
    });
  }

  getSnapshot(tournamentId: string, options?: { status?: BotReadinessItem["status"]; cursor?: string; limit?: number }): BotReadinessSnapshot {
    for (const target of this.targets.values()) if (target.tournamentId === tournamentId) this.recordFor(target);
    for (const enrollment of this.store.enrollments.values()) if (enrollment.tournamentId === tournamentId) this.recordFor(this.targetFor(tournamentId, enrollment.id));
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
    const items = [...this.records.values()]
      .filter((record) => record.target.tournamentId === tournamentId && (!options?.status || record.status === options.status))
      .sort((a, b) => a.target.enrollmentId.localeCompare(b.target.enrollmentId));
    const offset = options?.cursor ? Math.max(0, Number.parseInt(options.cursor, 10) || 0) : 0;
    const page = items.slice(offset, offset + limit).map((record) => this.publicItem(record));
    return BotReadinessSnapshotSchema.parse({ tournamentId, items: page, nextCursor: offset + page.length < items.length ? String(offset + page.length) : null, evaluatedAt: this.store.nowIso() });
  }

  getJob(jobId: string): BotReadinessJob {
    const job = this.jobs.get(jobId);
    if (!job) throw error("NOT_FOUND", 404, "Không tìm thấy lượt kiểm tra bot.");
    return job;
  }

  private idempotent(actor: TournamentActorContext, tournamentId: string, operation: string, idempotencyKey: string, payload: unknown): SelectionResult | undefined {
    const key = `${actor.userId}:${tournamentId}:${operation}:${idempotencyKey}`;
    const found = this.idempotency.get(key);
    if (!found) return undefined;
    const next = fingerprint(payload);
    if (found.fingerprint !== next) throw error("CONFLICT", 409, "Idempotency key đã được dùng cho payload khác.", { reason: "IDEMPOTENCY_PAYLOAD_MISMATCH" });
    return { ...found.result, idempotent: true };
  }

  private saveIdempotent(actor: TournamentActorContext, tournamentId: string, operation: string, idempotencyKey: string, payload: unknown, result: SelectionResult): void {
    this.idempotency.set(`${actor.userId}:${tournamentId}:${operation}:${idempotencyKey}`, { fingerprint: fingerprint(payload), result });
  }

  async selectBot(actor: TournamentActorContext, tournamentId: string, enrollmentId: string, input: BotReadinessSelectionRequest): Promise<SelectionResult> {
    const existing = this.idempotent(actor, tournamentId, "SELECT", input.idempotencyKey, { enrollmentId, ...input });
    if (existing) return existing;
    return this.store.withLock(async () => {
      const target = this.targetFor(tournamentId, enrollmentId);
      this.assertOwner(actor, target);
      if (target.eligibilityStatus === "WITHDRAWN" || target.eligibilityStatus === "DISQUALIFIED") throw error("CONFLICT", 409, "Không thể gắn bot cho đăng ký đã rút hoặc bị loại.", { reason: "ENROLLMENT_NOT_ELIGIBLE" });
      if (input.expectedEnrollmentRevision !== target.revision) throw error("CONFLICT", 409, "Đăng ký đã thay đổi; hãy tải lại trước khi chọn bot.", { reason: "STALE_ENROLLMENT_REVISION", currentRevision: target.revision });
      const library = await this.library.list(actor.userId);
      const bot = library.bots.find((candidate) => candidate.id === input.botId);
      const revision = bot?.revisions.find((candidate) => candidate.id === input.revisionId);
      if (!bot || !revision) throw error("NOT_FOUND", 404, "Không tìm thấy bot hoặc revision thuộc tài khoản của bạn.");
      if (revision.sourceExpiresAt && Date.parse(revision.sourceExpiresAt) <= Date.now()) throw error("CONFLICT", 409, "Revision bot đã hết hạn.", { reason: "REVISION_EXPIRED" });

      const record = this.recordFor(target);
      record.status = "CHECKING";
      record.botId = bot.id;
      record.revisionId = revision.id;
      const jobId = randomUUID();
      const now = this.store.nowIso();
      const targetContextRef = `${tournamentId}:${enrollmentId}:${target.revision + 1}`;
      let resultStatus: BotReadinessItem["status"] = "INCOMPATIBLE";
      let receipt: BotReadinessReceipt;
      try {
        if (revision.status === "INVALID" || revision.status === "FAILED") {
          receipt = safeReceipt("BOT_SOURCE_INVALID", "REJECTED", "Bot không tương thích với ABI hoặc mã nguồn không hợp lệ.", now);
        } else {
          const tested = await this.library.testRevision(actor.userId, bot.id, revision.id);
          if (tested.revision.status === "PASSED") {
            resultStatus = "READY";
            receipt = safeReceipt("READY", "ACCEPTED", "Bot đã vượt qua kiểm tra runtime cô lập.", this.store.nowIso());
          } else {
            receipt = safeReceipt("BOT_OUTPUT_REJECTED", "REJECTED", "Bot không tạo được nước hợp lệ trong giới hạn.", this.store.nowIso());
          }
        }
      } catch (cause) {
        if (cause instanceof AppError && (cause.code === "SERVICE_UNAVAILABLE" || cause.code === "CONFLICT")) {
          resultStatus = "BLOCKED_INFRA";
          receipt = safeReceipt(cause.details.reason === "BOT_RUNTIME_BUSY" ? "PROVIDER_BUSY" : "PROVIDER_UNAVAILABLE", "FAILED", "Runtime Bot hiện chưa sẵn sàng; có thể thử lại.", this.store.nowIso());
        } else {
          receipt = safeReceipt("BOT_OUTPUT_REJECTED", "REJECTED", "Bot không vượt qua kiểm tra an toàn.", this.store.nowIso());
        }
      }
      target.revision += 1;
      target.updatedAt = this.store.nowIso();
      record.status = resultStatus;
      record.receipt = receipt;
      this.updateLegacyEnrollment(target, resultStatus, revision.id);
      const job = BotReadinessJobSchema.parse({ jobId, tournamentId, enrollmentId, targetContextRef, state: receipt.outcome === "ACCEPTED" ? "SUCCEEDED" : resultStatus === "BLOCKED_INFRA" ? "FAILED" : "CANCELLED", status: resultStatus, retryAfterSeconds: resultStatus === "BLOCKED_INFRA" ? 30 : null, receipt, createdAt: now, updatedAt: target.updatedAt });
      this.jobs.set(jobId, job);
      const result: SelectionResult = { ...this.publicItem(record), job };
      this.saveIdempotent(actor, tournamentId, "SELECT", input.idempotencyKey, { enrollmentId, ...input }, result);
      return result;
    });
  }

  async requestRecheck(actor: TournamentActorContext, tournamentId: string, input: BotReadinessRecheckRequest): Promise<RecheckResult> {
    const target = this.targetFor(tournamentId, input.enrollmentId);
    const record = this.recordFor(target);
    if (!record.botId || !record.revisionId) throw error("CONFLICT", 409, "Chưa có revision bot để kiểm tra lại.", { reason: "BOT_REVISION_REQUIRED" });
    const selected = await this.selectBot(actor, tournamentId, input.enrollmentId, { botId: record.botId, revisionId: record.revisionId, expectedEnrollmentRevision: input.expectedEnrollmentRevision, idempotencyKey: input.idempotencyKey });
    return selected;
  }

  async runProof(actor: TournamentActorContext, tournamentId: string, mode: BotProofMode, enrollmentIds: string[]): Promise<BotProofResult> {
    if (!actor.roles.includes("TOURNAMENT_ADMIN") && !actor.roles.includes("ADMIN")) throw error("UNAUTHORIZED", 403, "Chỉ quản trị giải mới được chạy proof runtime.");
    if (mode === "OFFLINE_BOT_VS_BOT" && enrollmentIds.length < 2) throw error("VALIDATION_ERROR", 400, "Proof Bot–Bot cần hai đăng ký đã chọn bot.");
    const targets = enrollmentIds.map((id) => this.targetFor(tournamentId, id));
    const passed = targets.length > 0 && targets.every((target) => this.recordFor(target).status === "READY");
    if (passed) {
      for (const target of targets) {
        const record = this.recordFor(target);
        if (!record.botId || !record.revisionId) {
          return BotProofResultSchema.parse({ mode, status: "BLOCKED", safeMessage: "Proof bị chặn vì chưa có revision đã ghim.", completedAt: this.store.nowIso() });
        }
        try {
          const library = await this.library.list(target.userId);
          const bot = library.bots.find((candidate) => candidate.id === record.botId);
          const revision = bot?.revisions.find((candidate) => candidate.id === record.revisionId);
          if (!bot || !revision || revision.status === "INVALID" || revision.status === "FAILED") throw new Error("revision-not-ready");
          const tested = await this.library.testRevision(target.userId, bot.id, revision.id);
          if (tested.revision.status !== "PASSED") throw new Error("runtime-proof-failed");
        } catch {
          return BotProofResultSchema.parse({ mode, status: "BLOCKED", safeMessage: "Proof bị chặn vì runtime chưa thể hoàn tất trong policy gate.", completedAt: this.store.nowIso() });
        }
      }
    }
    return BotProofResultSchema.parse({ mode, status: passed ? "PASSED" : "BLOCKED", safeMessage: passed ? "Proof Offline đã chạy với runtime cô lập và policy gate." : "Proof bị chặn vì runtime hoặc bot chưa READY.", completedAt: this.store.nowIso() });
  }

  private updateLegacyEnrollment(target: Target, status: BotReadinessItem["status"], revisionId: string): void {
    const enrollment = this.store.enrollments.get(target.enrollmentId);
    if (!enrollment) return;
    this.store.enrollments.set(target.enrollmentId, {
      ...enrollment,
      pinnedBotRevisionId: revisionId,
      botReadinessStatus: status === "READY" ? "READY" : status === "INCOMPATIBLE" ? "INVALID" : "MISSING",
      updatedAt: target.updatedAt,
    });
  }
}
