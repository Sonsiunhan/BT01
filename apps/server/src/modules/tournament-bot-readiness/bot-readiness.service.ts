import { createHash, randomUUID } from "node:crypto";
import {
  BOT_RUNTIME_POLICY_VERSION,
  createBotTurnState,
  DEFAULT_BOT_LIMITS,
  type BotMoveRecord,
  type JsonValue,
} from "@ottv2/bot-sdk";
import {
  applyMove,
  createInitialState,
  LEGACY_RULE_PROFILE,
  type Coordinate,
  type PieceType,
  type RuleProfile,
  type RuleState,
  type Side,
} from "@ottv2/game-rules";
import {
  BotProofResultSchema,
  BotReadinessItemSchema,
  BotReadinessJobSchema,
  BotReadinessReceiptSchema,
  BotReadinessSnapshotSchema,
  type BotProofMode,
  type BotProofResult,
  type BotReadinessItem,
  type BotReadinessJob,
  type BotReadinessReceipt,
  type BotReadinessRecheckRequest,
  type BotReadinessSafeReason,
  type BotReadinessSelectionRequest,
  type BotReadinessSnapshot,
  type BotReadinessStatus,
  type BotReadinessTarget,
  type BotRevision,
} from "@ottv2/contracts";

import type { BotLibraryService } from "../bot-library/bot-library.service.js";
import { AppError } from "../../shared/errors/app-error.js";
import {
  assertTaContractOrTournamentAccess,
  type TournamentActorContext,
  type TournamentStateStore,
} from "../tournament-foundation/tournament-store.js";

type EnrollmentTarget = {
  enrollmentId: string;
  tournamentId: string;
  userId: string;
  personKey: string;
  displayName: string;
  eligibilityStatus: "ELIGIBLE" | "PENDING_CLAIM" | "CHECKIN_PENDING" | "BOT_NOT_READY" | "DISQUALIFIED" | "WITHDRAWN";
  updatedAt: string;
};

type ReadinessRecord = {
  target: EnrollmentTarget;
  revision: number;
  status: BotReadinessStatus;
  botId: string | null;
  revisionId: string | null;
  revisionNumber: number | null;
  sourceDigest: string | null;
  context: BotReadinessTarget | null;
  receipt: BotReadinessReceipt | null;
  safeReason: BotReadinessSafeReason;
  retryable: boolean;
  retryAfterMs: number | null;
  updatedAt: string;
  activeJobId: string | null;
};

type StoredJob = BotReadinessJob & {
  requesterUserId: string;
  requesterKind: "OWNER" | "TA";
  botOwnerUserId: string;
  botId: string;
  revisionId: string;
  sourceDigest: string;
};

type IdempotencyEntry = { fingerprint: string; jobId: string };
type Persistence = {
  records: Map<string, ReadinessRecord>;
  seededTargets: Map<string, EnrollmentTarget>;
  jobs: Map<string, StoredJob>;
  idempotency: Map<string, IdempotencyEntry>;
  activeTargets: Map<string, string>;
};

type SelectionResult = { item: BotReadinessItem; job: BotReadinessJob; idempotent?: boolean };

const stateByStore = new WeakMap<TournamentStateStore, Persistence>();
const RETRY_AFTER_INFRA_MS = 30_000;

function persistenceFor(store: TournamentStateStore): Persistence {
  const existing = stateByStore.get(store);
  if (existing) return existing;
  const created: Persistence = {
    records: new Map(),
    seededTargets: new Map(),
    jobs: new Map(),
    idempotency: new Map(),
    activeTargets: new Map(),
  };
  stateByStore.set(store, created);
  return created;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

function readinessKey(tournamentId: string, enrollmentId: string): string {
  return `${tournamentId}:${enrollmentId}`;
}

function activeTargetKey(tournamentId: string, enrollmentId: string, targetContextRef: string): string {
  return `${tournamentId}:${enrollmentId}:${targetContextRef}`;
}

function serviceError(
  code: AppError["code"],
  statusCode: number,
  message: string,
  details: Record<string, unknown> = {},
  retryable = false,
): AppError {
  return new AppError(code, message, statusCode, retryable, code === "CONFLICT" ? "RECOVERABLE" : "INVALID", details);
}

function safeReceipt(
  code: BotReadinessReceipt["code"],
  outcome: BotReadinessReceipt["outcome"],
  safeMessage: string,
  completedAt: string,
): BotReadinessReceipt {
  return BotReadinessReceiptSchema.parse({ receiptId: randomUUID(), code, outcome, safeMessage, completedAt });
}

function asSafeReason(code: BotReadinessReceipt["code"]): BotReadinessSafeReason {
  return code;
}

/**
 * Server-authoritative BOT_VS_BOT readiness queue.  The record maps are bound
 * to the tournament state store, rather than a route or UI instance, so a
 * freshly composed service recovers queued/checking work fail-closed.
 */
export class BotReadinessService {
  private readonly persistence: Persistence;

  constructor(
    private readonly store: TournamentStateStore,
    private readonly library: BotLibraryService,
  ) {
    this.persistence = persistenceFor(store);
    this.recoverInterruptedJobs();
  }

  /** Test-only adapter for fixtures that deliberately do not compose a full tournament. */
  seedEnrollment(input: { tournamentId: string; enrollmentId: string; userId: string; personKey: string; displayName?: string }): EnrollmentTarget {
    const target: EnrollmentTarget = {
      enrollmentId: input.enrollmentId,
      tournamentId: input.tournamentId,
      userId: input.userId,
      personKey: input.personKey,
      displayName: input.displayName ?? input.personKey,
      eligibilityStatus: "ELIGIBLE",
      updatedAt: this.store.nowIso(),
    };
    this.persistence.seededTargets.set(input.enrollmentId, target);
    return target;
  }

  assertDashboardAccess(actor: TournamentActorContext, tournamentId: string): void {
    if (actor.roles.includes("ADMIN")) return;
    const tournament = this.store.tournaments.get(tournamentId);
    const contract = tournament ? this.store.contracts.get(tournament.contractId) : undefined;
    if (!tournament || !contract) throw serviceError("NOT_FOUND", 404, "Không tìm thấy giải đấu.");
    assertTaContractOrTournamentAccess(actor, contract, { mode: "OPERATE_EXISTING", tournament, serverNowIso: this.store.nowIso() });
  }

  private isOwnerTa(actor: TournamentActorContext, tournamentId: string): boolean {
    if (!actor.roles.includes("TOURNAMENT_ADMIN") && !actor.roles.includes("ADMIN")) return false;
    const tournament = this.store.tournaments.get(tournamentId);
    const contract = tournament ? this.store.contracts.get(tournament.contractId) : undefined;
    if (!tournament) return true; // isolated service harness only
    if (!contract) return false;
    try {
      assertTaContractOrTournamentAccess(actor, contract, { mode: "OPERATE_EXISTING", tournament, serverNowIso: this.store.nowIso() });
      return true;
    } catch {
      return false;
    }
  }

  private assertOwnerTa(actor: TournamentActorContext, tournamentId: string): void {
    if (!this.store.tournaments.has(tournamentId)) {
      if (actor.roles.includes("TOURNAMENT_ADMIN") || actor.roles.includes("ADMIN")) return; // isolated service harness only
      throw serviceError("UNAUTHORIZED", 403, "Chỉ Tournament Admin sở hữu giải được thực hiện thao tác này.");
    }
    this.assertDashboardAccess(actor, tournamentId);
    if (!this.isOwnerTa(actor, tournamentId)) {
      throw serviceError("UNAUTHORIZED", 403, "Chỉ Tournament Admin sở hữu giải được yêu cầu kiểm tra lại.", { reason: "TOURNAMENT_OWNER_REQUIRED" });
    }
  }

  private tournamentIsBotVsBot(tournamentId: string): boolean {
    const tournament = this.store.tournaments.get(tournamentId);
    return !tournament || tournament.coreConfig.competitionMode === "BOT_VS_BOT";
  }

  private assertBotVsBot(tournamentId: string): void {
    if (!this.tournamentIsBotVsBot(tournamentId)) {
      throw serviceError("CONFLICT", 409, "Giải Người–Người không yêu cầu Bot readiness.", { reason: "BOT_READINESS_NOT_APPLICABLE" });
    }
  }

  private targetFor(tournamentId: string, enrollmentId: string): EnrollmentTarget {
    const seeded = this.persistence.seededTargets.get(enrollmentId);
    if (seeded) {
      if (seeded.tournamentId !== tournamentId) throw serviceError("NOT_FOUND", 404, "Không tìm thấy đăng ký trong giải đấu.");
      return seeded;
    }
    const enrollment = this.store.enrollments.get(enrollmentId);
    if (!enrollment || enrollment.tournamentId !== tournamentId) throw serviceError("NOT_FOUND", 404, "Không tìm thấy đăng ký trong giải đấu.");
    return {
      enrollmentId: enrollment.id,
      tournamentId: enrollment.tournamentId,
      userId: enrollment.userId ?? "",
      personKey: enrollment.personKey,
      displayName: enrollment.displayName,
      eligibilityStatus: enrollment.eligibilityStatus,
      updatedAt: enrollment.updatedAt,
    };
  }

  private recordFor(target: EnrollmentTarget): ReadinessRecord {
    const key = readinessKey(target.tournamentId, target.enrollmentId);
    const existing = this.persistence.records.get(key);
    if (existing) {
      existing.target = target;
      return existing;
    }
    const enrollment = this.store.enrollments.get(target.enrollmentId);
    const isReady = enrollment?.botReadinessStatus === "READY" && !!enrollment?.pinnedBotRevisionId;
    const revisionId = enrollment?.pinnedBotRevisionId ?? null;
    const rawDigest = revisionId ? revisionId.replace(/^rev-(?:wasi-)?/, "").slice(0, 12).padEnd(12, "0") : null;
    const tournament = this.store.tournaments.get(target.tournamentId);
    const tuple = isReady && revisionId ? {
      tournamentId: target.tournamentId,
      enrollmentId: target.enrollmentId,
      botId: `bot-${target.personKey.toLowerCase()}`,
      revisionId,
      sourceDigest: rawDigest,
      configVersionNumber: tournament?.activeConfigVersionNumber ?? 1,
      ruleVersion: tournament?.ruleProfile?.rulesVersion ?? "rps-v1",
      sdkVersion: "1.0.0",
      schemaVersion: "1.0.0",
      runtimeProfile: "WASMTIME_SUPERVISOR",
      policyVersion: "2026.1",
    } : null;
    const context: BotReadinessTarget | null = tuple && rawDigest ? {
      targetContextRef: `brt_${fingerprint(tuple).slice(0, 24)}`,
      configVersionNumber: tuple.configVersionNumber,
      ruleVersion: tuple.ruleVersion,
      sdkVersion: tuple.sdkVersion,
      schemaVersion: tuple.schemaVersion,
      runtimeProfile: "WASMTIME_SUPERVISOR",
      policyVersion: tuple.policyVersion,
      sourceDigestPrefix: rawDigest.slice(0, 12),
    } : null;
    const record: ReadinessRecord = {
      target,
      revision: isReady ? 1 : 0,
      status: isReady ? "READY" : "NOT_SUBMITTED",
      botId: isReady ? `bot-${target.personKey.toLowerCase()}` : null,
      revisionId,
      revisionNumber: isReady ? 1 : null,
      sourceDigest: rawDigest ? `sha256:${rawDigest.padEnd(64, "0")}` : null,
      context,
      receipt: isReady ? safeReceipt("READY", "ACCEPTED", "Bot đã vượt qua kiểm tra runtime cô lập.", target.updatedAt) : null,
      safeReason: isReady ? "READY" : "NOT_SELECTED",
      retryable: false,
      retryAfterMs: null,
      updatedAt: target.updatedAt,
      activeJobId: null,
    };
    this.persistence.records.set(key, record);
    return record;
  }

  private executableProfile(tournamentId: string): RuleProfile | undefined {
    const tournament = this.store.tournaments.get(tournamentId) as { engineRuleProfile?: RuleProfile; ruleProfile?: { rulesVersion?: string } } | undefined;
    // A published N04 engine profile, when available, is the only custom
    // profile the runtime may execute.  Existing rps-v1 tournaments have no
    // engine-profile payload in TournamentDto; passing `undefined` deliberately
    // selects createInitialState()'s canonical, populated rps-v1 setup.  Do not
    // construct an empty LEGACY_RULE_PROFILE board merely to alter its version.
    if (tournament?.engineRuleProfile) return tournament.engineRuleProfile;
    if (tournament?.ruleProfile?.rulesVersion && tournament.ruleProfile.rulesVersion !== LEGACY_RULE_PROFILE.version) {
      throw serviceError(
        "SERVICE_UNAVAILABLE",
        503,
        "Luật engine của phiên bản giải chưa sẵn sàng để kiểm tra Bot.",
        { reason: "ENGINE_PROFILE_UNAVAILABLE" },
        true,
      );
    }
    return undefined;
  }

  private makeContext(target: EnrollmentTarget, botId: string, revision: { id: string; sourceDigest: string; sdkVersion: string; schemaVersion: string }): BotReadinessTarget {
    const tournament = this.store.tournaments.get(target.tournamentId);
    const tuple = {
      tournamentId: target.tournamentId,
      enrollmentId: target.enrollmentId,
      botId,
      revisionId: revision.id,
      sourceDigest: revision.sourceDigest,
      configVersionNumber: tournament?.activeConfigVersionNumber ?? 0,
      ruleVersion: tournament?.ruleProfile.rulesVersion ?? LEGACY_RULE_PROFILE.version,
      sdkVersion: revision.sdkVersion,
      schemaVersion: revision.schemaVersion,
      runtimeProfile: "WASMTIME_SUPERVISOR",
      policyVersion: BOT_RUNTIME_POLICY_VERSION,
    };
    return {
      targetContextRef: `brt_${fingerprint(tuple).slice(0, 24)}`,
      configVersionNumber: tuple.configVersionNumber,
      ruleVersion: tuple.ruleVersion,
      sdkVersion: tuple.sdkVersion,
      schemaVersion: tuple.schemaVersion,
      runtimeProfile: "WASMTIME_SUPERVISOR",
      policyVersion: tuple.policyVersion,
      sourceDigestPrefix: revision.sourceDigest.slice(0, 12),
    };
  }

  private async ownedRevision(target: EnrollmentTarget, botId: string, revisionId: string): Promise<{ botId: string; revision: BotRevision }> {
    if (!target.userId) throw serviceError("CONFLICT", 409, "Đăng ký chưa được claim bởi chủ Bot.", { reason: "ENROLLMENT_UNCLAIMED" });
    const listing = await this.library.list(target.userId);
    const bot = listing.bots.find((candidate) => candidate.id === botId);
    const revision = bot?.revisions.find((candidate) => candidate.id === revisionId);
    if (!bot || !revision) throw serviceError("NOT_FOUND", 404, "Không tìm thấy Bot hoặc revision thuộc tài khoản đăng ký.");
    if (revision.sourceExpiresAt && Date.parse(revision.sourceExpiresAt) <= Date.now()) {
      throw serviceError("CONFLICT", 409, "Revision Bot đã hết hạn.", { reason: "REVISION_EXPIRED" });
    }
    return { botId: bot.id, revision };
  }

  private canOwner(actor: TournamentActorContext, target: EnrollmentTarget): boolean {
    return Boolean(target.userId) && actor.userId === target.userId;
  }

  private canRecheck(actor: TournamentActorContext, target: EnrollmentTarget): boolean {
    return this.canOwner(actor, target) || this.isOwnerTa(actor, target.tournamentId);
  }

  private publicItem(record: ReadinessRecord, actor?: TournamentActorContext): BotReadinessItem {
    const canOwner = actor ? this.canOwner(actor, record.target) : false;
    const canRecheck = actor ? this.canRecheck(actor, record.target) && record.botId !== null && record.revisionId !== null : false;
    return BotReadinessItemSchema.parse({
      enrollmentId: record.target.enrollmentId,
      tournamentId: record.target.tournamentId,
      personKey: record.target.personKey,
      displayName: record.target.displayName,
      status: record.status,
      revision: record.revision,
      botId: record.botId,
      revisionId: record.revisionId,
      revisionNumber: record.revisionNumber,
      target: record.context,
      receipt: record.receipt,
      safeReason: record.safeReason,
      retryable: record.retryable,
      retryAfterMs: record.retryAfterMs,
      permittedActions: { canSelect: canOwner, canRecheck },
      updatedAt: record.updatedAt,
    });
  }

  /**
   * Stored jobs carry owner and full-digest fields so the worker can make an
   * authoritative decision.  They must never cross the API boundary.
   */
  private publicJob(job: StoredJob): BotReadinessJob {
    return BotReadinessJobSchema.parse({
      jobId: job.jobId,
      tournamentId: job.tournamentId,
      enrollmentId: job.enrollmentId,
      targetContextRef: job.targetContextRef,
      state: job.state,
      status: job.status,
      retryable: job.retryable,
      retryAfterMs: job.retryAfterMs,
      safeReason: job.safeReason,
      receipt: job.receipt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
    });
  }

  getSnapshot(tournamentId: string, options?: { status?: BotReadinessStatus; cursor?: string; limit?: number }, actor?: TournamentActorContext): BotReadinessSnapshot {
    if (!this.tournamentIsBotVsBot(tournamentId)) {
      return BotReadinessSnapshotSchema.parse({
        tournamentId,
        applicable: false,
        notApplicableMessage: "Giải Người–Người không yêu cầu Bot readiness.",
        items: [],
        nextCursor: null,
        evaluatedAt: this.store.nowIso(),
      });
    }
    for (const seeded of this.persistence.seededTargets.values()) if (seeded.tournamentId === tournamentId) this.recordFor(seeded);
    for (const enrollment of this.store.enrollments.values()) if (enrollment.tournamentId === tournamentId) this.recordFor(this.targetFor(tournamentId, enrollment.id));
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
    if (options?.cursor !== undefined && !/^(0|[1-9]\d*)$/.test(options.cursor)) {
      throw serviceError("VALIDATION_ERROR", 400, "Cursor không hợp lệ.");
    }
    const offset = Number(options?.cursor ?? "0");
    const items = [...this.persistence.records.values()]
      .filter((record) => record.target.tournamentId === tournamentId && (!options?.status || record.status === options.status))
      .sort((a, b) => a.target.displayName.localeCompare(b.target.displayName, "vi") || a.target.enrollmentId.localeCompare(b.target.enrollmentId));
    const page = items.slice(offset, offset + limit).map((record) => this.publicItem(record, actor));
    return BotReadinessSnapshotSchema.parse({
      tournamentId,
      applicable: true,
      notApplicableMessage: null,
      items: page,
      nextCursor: offset + page.length < items.length ? String(offset + page.length) : null,
      evaluatedAt: this.store.nowIso(),
    });
  }

  getJob(actor: TournamentActorContext, jobId: string): BotReadinessJob {
    const job = this.persistence.jobs.get(jobId);
    if (!job) throw serviceError("NOT_FOUND", 404, "Không tìm thấy lượt kiểm tra Bot.");
    const target = this.targetFor(job.tournamentId, job.enrollmentId);
    if (!this.canOwner(actor, target) && !this.isOwnerTa(actor, target.tournamentId)) {
      throw serviceError("UNAUTHORIZED", 403, "Bạn không có quyền xem lượt kiểm tra Bot này.", { reason: "BOT_READINESS_JOB_FORBIDDEN" });
    }
    return this.publicJob(job);
  }

  private idempotent(actor: TournamentActorContext, tournamentId: string, operation: "SELECT" | "RECHECK", key: string, payload: unknown): SelectionResult | undefined {
    const stored = this.persistence.idempotency.get(`${actor.userId}:${tournamentId}:${operation}:${key}`);
    if (!stored) return undefined;
    if (stored.fingerprint !== fingerprint(payload)) {
      throw serviceError("CONFLICT", 409, "Idempotency key đã được dùng cho payload khác.", { reason: "IDEMPOTENCY_PAYLOAD_MISMATCH" });
    }
    const job = this.persistence.jobs.get(stored.jobId);
    if (!job) throw serviceError("CONFLICT", 409, "Lượt kiểm tra đã hết hiệu lực; hãy gửi yêu cầu mới.", { reason: "IDEMPOTENCY_RESULT_EXPIRED" });
    const item = this.publicItem(this.recordFor(this.targetFor(tournamentId, job.enrollmentId)), actor);
    return { item, job: this.publicJob(job), idempotent: true };
  }

  private saveIdempotent(actor: TournamentActorContext, tournamentId: string, operation: "SELECT" | "RECHECK", key: string, payload: unknown, jobId: string): void {
    this.persistence.idempotency.set(`${actor.userId}:${tournamentId}:${operation}:${key}`, { fingerprint: fingerprint(payload), jobId });
  }

  private updateLegacyEnrollment(target: EnrollmentTarget, status: BotReadinessStatus, revisionId: string | null, updatedAt: string): void {
    const enrollment = this.store.enrollments.get(target.enrollmentId);
    if (!enrollment) return;
    this.store.enrollments.set(target.enrollmentId, {
      ...enrollment,
      pinnedBotRevisionId: status === "READY" ? revisionId : null,
      botReadinessStatus: status === "READY" ? "READY" : status === "INCOMPATIBLE" ? "INVALID" : "MISSING",
      updatedAt,
    });
  }

  private mutateRecord(record: ReadinessRecord, patch: Partial<Pick<ReadinessRecord, "status" | "receipt" | "safeReason" | "retryable" | "retryAfterMs" | "activeJobId">>): void {
    Object.assign(record, patch);
    record.revision += 1;
    record.updatedAt = this.store.nowIso();
  }

  private newJob(input: {
    actor: TournamentActorContext;
    kind: "OWNER" | "TA";
    target: EnrollmentTarget;
    record: ReadinessRecord;
    context: BotReadinessTarget;
    botId: string;
    revisionId: string;
    sourceDigest: string;
  }): StoredJob {
    const now = this.store.nowIso();
    return {
      jobId: randomUUID(),
      tournamentId: input.target.tournamentId,
      enrollmentId: input.target.enrollmentId,
      targetContextRef: input.context.targetContextRef,
      state: "QUEUED",
      status: "PENDING",
      retryable: false,
      retryAfterMs: null,
      safeReason: "CHECK_QUEUED",
      receipt: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      requesterUserId: input.actor.userId,
      requesterKind: input.kind,
      botOwnerUserId: input.target.userId,
      botId: input.botId,
      revisionId: input.revisionId,
      sourceDigest: input.sourceDigest,
    };
  }

  private queue(
    actor: TournamentActorContext,
    operation: "SELECT" | "RECHECK",
    target: EnrollmentTarget,
    record: ReadinessRecord,
    bot: { id: string },
    revision: { id: string; revisionNumber: number; sourceDigest: string; sdkVersion: string; schemaVersion: string },
    idempotencyKey: string,
    payload: unknown,
  ): SelectionResult {
    const context = this.makeContext(target, bot.id, revision);
    const activeKey = activeTargetKey(target.tournamentId, target.enrollmentId, context.targetContextRef);
    const existingJobId = this.persistence.activeTargets.get(activeKey);
    if (existingJobId) {
      const job = this.persistence.jobs.get(existingJobId);
      if (job && (job.state === "QUEUED" || job.state === "CHECKING")) {
        this.saveIdempotent(actor, target.tournamentId, operation, idempotencyKey, payload, job.jobId);
        return { item: this.publicItem(record, actor), job: this.publicJob(job) };
      }
    }
    record.botId = bot.id;
    record.revisionId = revision.id;
    record.revisionNumber = revision.revisionNumber;
    record.sourceDigest = revision.sourceDigest;
    record.context = context;
    record.receipt = null;
    this.mutateRecord(record, { status: "PENDING", safeReason: "CHECK_QUEUED", retryable: false, retryAfterMs: null, activeJobId: null });
    this.updateLegacyEnrollment(target, "PENDING", null, record.updatedAt);
    const job = this.newJob({
      actor,
      kind: this.canOwner(actor, target) ? "OWNER" : "TA",
      target,
      record,
      context,
      botId: bot.id,
      revisionId: revision.id,
      sourceDigest: revision.sourceDigest,
    });
    record.activeJobId = job.jobId;
    this.persistence.jobs.set(job.jobId, job);
    this.persistence.activeTargets.set(activeKey, job.jobId);
    this.saveIdempotent(actor, target.tournamentId, operation, idempotencyKey, payload, job.jobId);
    return { item: this.publicItem(record, actor), job: this.publicJob(job) };
  }

  async selectBot(actor: TournamentActorContext, tournamentId: string, enrollmentId: string, input: BotReadinessSelectionRequest): Promise<SelectionResult> {
    this.assertBotVsBot(tournamentId);
    const payload = { enrollmentId, ...input };
    const replay = this.idempotent(actor, tournamentId, "SELECT", input.idempotencyKey, payload);
    if (replay) return replay;
    return this.store.withLock(async () => {
      const target = this.targetFor(tournamentId, enrollmentId);
      if (!this.canOwner(actor, target)) throw serviceError("UNAUTHORIZED", 403, "Chỉ chủ Bot của đăng ký mới được chọn revision.", { reason: "BOT_OWNER_REQUIRED" });
      if (target.eligibilityStatus !== "ELIGIBLE") {
        throw serviceError("CONFLICT", 409, "Chỉ đăng ký đã claim và hợp lệ mới được gắn Bot.", { reason: "ENROLLMENT_NOT_ELIGIBLE", eligibilityStatus: target.eligibilityStatus });
      }
      const record = this.recordFor(target);
      if (input.expectedEnrollmentRevision !== record.revision) {
        throw serviceError("CONFLICT", 409, "Trạng thái Bot đã thay đổi; hãy tải lại trước khi chọn revision.", { reason: "STALE_ENROLLMENT_REVISION", currentRevision: record.revision });
      }
      const owned = await this.ownedRevision(target, input.botId, input.revisionId);
      return this.queue(actor, "SELECT", target, record, { id: owned.botId }, owned.revision, input.idempotencyKey, payload);
    });
  }

  async requestRecheck(actor: TournamentActorContext, tournamentId: string, input: BotReadinessRecheckRequest): Promise<SelectionResult> {
    this.assertBotVsBot(tournamentId);
    const payload = { ...input };
    const replay = this.idempotent(actor, tournamentId, "RECHECK", input.idempotencyKey, payload);
    if (replay) return replay;
    return this.store.withLock(async () => {
      const target = this.targetFor(tournamentId, input.enrollmentId);
      const record = this.recordFor(target);
      if (!this.canRecheck(actor, target)) throw serviceError("UNAUTHORIZED", 403, "Bạn không có quyền yêu cầu kiểm tra lại Bot này.", { reason: "BOT_RECHECK_FORBIDDEN" });
      if (input.expectedEnrollmentRevision !== record.revision) {
        throw serviceError("CONFLICT", 409, "Trạng thái Bot đã thay đổi; hãy tải lại trước khi kiểm tra lại.", { reason: "STALE_ENROLLMENT_REVISION", currentRevision: record.revision });
      }
      if (!record.botId || !record.revisionId) throw serviceError("CONFLICT", 409, "Chưa có revision Bot để kiểm tra lại.", { reason: "BOT_REVISION_REQUIRED" });
      if (target.eligibilityStatus !== "ELIGIBLE") throw serviceError("CONFLICT", 409, "Đăng ký hiện không đủ điều kiện kiểm tra Bot.", { reason: "ENROLLMENT_NOT_ELIGIBLE" });
      const owned = await this.ownedRevision(target, record.botId, record.revisionId);
      return this.queue(actor, "RECHECK", target, record, { id: owned.botId }, owned.revision, input.idempotencyKey, payload);
    });
  }

  /** Starts a queued job. Routes schedule this after the 202 enqueue response. */
  async executeJob(jobId: string): Promise<BotReadinessJob> {
    const job = this.persistence.jobs.get(jobId);
    if (!job) throw serviceError("NOT_FOUND", 404, "Không tìm thấy lượt kiểm tra Bot.");
    if (job.state !== "QUEUED") return this.publicJob(job);
    const target = this.targetFor(job.tournamentId, job.enrollmentId);
    const record = this.recordFor(target);
    const requester: TournamentActorContext = this.store.resolveAuthoritativeActor({ userId: job.requesterUserId });
    const requesterAllowed = job.requesterKind === "OWNER"
      ? this.canOwner(requester, target)
      : this.isOwnerTa(requester, target.tournamentId);
    if (!requesterAllowed || !this.tournamentIsBotVsBot(job.tournamentId)) {
      return this.finishStale(job, record, "TARGET_STALE", "Quyền hoặc cấu hình giải đã thay đổi trước khi runtime bắt đầu.");
    }
    if (record.activeJobId !== job.jobId || record.context?.targetContextRef !== job.targetContextRef) {
      return this.finishStale(job, record, "TARGET_STALE", "Mục tiêu kiểm tra đã được thay thế bởi yêu cầu mới hơn.");
    }
    await this.store.withLock(async () => {
      if (job.state !== "QUEUED") return;
      job.state = "CHECKING";
      job.status = "CHECKING";
      job.safeReason = "CHECKING";
      job.updatedAt = this.store.nowIso();
      this.mutateRecord(record, { status: "CHECKING", safeReason: "CHECKING", retryable: false, retryAfterMs: null });
      this.updateLegacyEnrollment(target, "CHECKING", null, record.updatedAt);
    });

    let outcome: { status: BotReadinessStatus; jobState: StoredJob["state"]; receipt: BotReadinessReceipt; retryable: boolean; retryAfterMs: number | null };
    try {
      const profile = this.executableProfile(job.tournamentId);
      const tested = await this.library.testRevision(target.userId, job.botId, job.revisionId, profile ? { ruleProfile: profile } : undefined);
      if (tested.revision.status === "PASSED") {
        outcome = { status: "READY", jobState: "SUCCEEDED", receipt: safeReceipt("READY", "ACCEPTED", "Bot đã vượt qua kiểm tra runtime cô lập.", this.store.nowIso()), retryable: false, retryAfterMs: null };
      } else {
        outcome = { status: "INCOMPATIBLE", jobState: "BOT_REJECTED", receipt: safeReceipt("BOT_OUTPUT_REJECTED", "REJECTED", "Bot không tạo được nước hợp lệ trong policy gate.", this.store.nowIso()), retryable: false, retryAfterMs: null };
      }
    } catch (cause) {
      const app = cause instanceof AppError ? cause : undefined;
      const reason = typeof app?.details.reason === "string" ? app.details.reason : "";
      if (app?.code === "CONFLICT" && reason === "BOT_RUNTIME_BUSY") {
        outcome = { status: "BLOCKED_INFRA", jobState: "BLOCKED_INFRA", receipt: safeReceipt("PROVIDER_BUSY", "FAILED", "Runtime Bot đang bận; có thể thử lại sau.", this.store.nowIso()), retryable: true, retryAfterMs: RETRY_AFTER_INFRA_MS };
      } else if (app?.code === "SERVICE_UNAVAILABLE" || cause instanceof Error) {
        outcome = { status: "BLOCKED_INFRA", jobState: "BLOCKED_INFRA", receipt: safeReceipt("PROVIDER_UNAVAILABLE", "FAILED", "Runtime Bot hiện chưa sẵn sàng; có thể thử lại.", this.store.nowIso()), retryable: true, retryAfterMs: RETRY_AFTER_INFRA_MS };
      } else {
        outcome = { status: "INCOMPATIBLE", jobState: "BOT_REJECTED", receipt: safeReceipt("BOT_OUTPUT_REJECTED", "REJECTED", "Bot không vượt qua kiểm tra an toàn.", this.store.nowIso()), retryable: false, retryAfterMs: null };
      }
    }

    return this.store.withLock(async () => {
      const currentTarget = this.targetFor(job.tournamentId, job.enrollmentId);
      const currentRecord = this.recordFor(currentTarget);
      if (currentRecord.activeJobId !== job.jobId || currentRecord.context?.targetContextRef !== job.targetContextRef) {
        return this.finishStale(job, currentRecord, "TARGET_STALE", "Kết quả runtime không còn khớp mục tiêu hiện hành.");
      }
      try {
        const current = await this.ownedRevision(currentTarget, job.botId, job.revisionId);
        const currentContext = this.makeContext(currentTarget, current.botId, current.revision);
        if (current.revision.sourceDigest !== job.sourceDigest || currentContext.targetContextRef !== job.targetContextRef) {
          return this.finishStale(job, currentRecord, "TARGET_STALE", "Revision Bot hoặc cấu hình giải đã đổi trong lúc kiểm tra.");
        }
      } catch {
        return this.finishStale(job, currentRecord, "TARGET_STALE", "Revision Bot không còn hợp lệ để nhận kết quả kiểm tra.");
      }
      job.state = outcome.jobState;
      job.status = outcome.status;
      job.retryable = outcome.retryable;
      job.retryAfterMs = outcome.retryAfterMs;
      job.safeReason = asSafeReason(outcome.receipt.code);
      job.receipt = outcome.receipt;
      job.updatedAt = this.store.nowIso();
      job.completedAt = job.updatedAt;
      this.mutateRecord(currentRecord, {
        status: outcome.status,
        receipt: outcome.receipt,
        safeReason: asSafeReason(outcome.receipt.code),
        retryable: outcome.retryable,
        retryAfterMs: outcome.retryAfterMs,
        activeJobId: null,
      });
      this.persistence.activeTargets.delete(activeTargetKey(job.tournamentId, job.enrollmentId, job.targetContextRef));
      this.updateLegacyEnrollment(currentTarget, outcome.status, outcome.status === "READY" ? job.revisionId : null, currentRecord.updatedAt);
      return this.publicJob(job);
    });
  }

  private finishStale(job: StoredJob, record: ReadinessRecord, code: BotReadinessReceipt["code"], message: string): BotReadinessJob {
    const receipt = safeReceipt(code, "CANCELLED", message, this.store.nowIso());
    job.state = "STALE";
    job.status = "STALE";
    job.retryable = false;
    job.retryAfterMs = null;
    job.safeReason = asSafeReason(code);
    job.receipt = receipt;
    job.updatedAt = this.store.nowIso();
    job.completedAt = job.updatedAt;
    if (record.activeJobId === job.jobId) {
      this.mutateRecord(record, { status: "STALE", receipt, safeReason: asSafeReason(code), retryable: false, retryAfterMs: null, activeJobId: null });
      this.updateLegacyEnrollment(record.target, "STALE", null, record.updatedAt);
    }
    this.persistence.activeTargets.delete(activeTargetKey(job.tournamentId, job.enrollmentId, job.targetContextRef));
    return this.publicJob(job);
  }

  /** Restart recovery turns invisible in-flight work into a visible, retryable infrastructure blocker. */
  private recoverInterruptedJobs(): void {
    for (const job of this.persistence.jobs.values()) {
      if (job.state !== "QUEUED" && job.state !== "CHECKING") continue;
      const record = this.persistence.records.get(readinessKey(job.tournamentId, job.enrollmentId));
      const receipt = safeReceipt("PROVIDER_UNAVAILABLE", "FAILED", "Lượt kiểm tra bị gián đoạn; có thể thử lại.", this.store.nowIso());
      job.state = "BLOCKED_INFRA";
      job.status = "BLOCKED_INFRA";
      job.retryable = true;
      job.retryAfterMs = RETRY_AFTER_INFRA_MS;
      job.safeReason = "PROVIDER_UNAVAILABLE";
      job.receipt = receipt;
      job.updatedAt = this.store.nowIso();
      job.completedAt = job.updatedAt;
      this.persistence.activeTargets.delete(activeTargetKey(job.tournamentId, job.enrollmentId, job.targetContextRef));
      if (record?.activeJobId === job.jobId) {
        this.mutateRecord(record, { status: "BLOCKED_INFRA", receipt, safeReason: "PROVIDER_UNAVAILABLE", retryable: true, retryAfterMs: RETRY_AFTER_INFRA_MS, activeJobId: null });
        this.updateLegacyEnrollment(record.target, "BLOCKED_INFRA", null, record.updatedAt);
      }
    }
  }

  /**
   * A real N06 ABI consumer proof.  It applies accepted moves through the
   * canonical engine and returns only receipt ids, never Bot source or logs.
   */
  async runProof(actor: TournamentActorContext, tournamentId: string, mode: BotProofMode, enrollmentIds: string[]): Promise<BotProofResult> {
    this.assertOwnerTa(actor, tournamentId);
    this.assertBotVsBot(tournamentId);
    if (mode === "OFFLINE_HUMAN_PYTHON" && enrollmentIds.length !== 1) {
      throw serviceError("VALIDATION_ERROR", 400, "Proof Người–Python Bot cần đúng một đăng ký Bot.");
    }
    if (mode === "OFFLINE_BOT_VS_BOT" && enrollmentIds.length !== 2) {
      throw serviceError("VALIDATION_ERROR", 400, "Proof Bot–Bot cần đúng hai đăng ký Bot.");
    }
    const records = enrollmentIds.map((id) => this.recordFor(this.targetFor(tournamentId, id)));
    if (records.some((record) => record.status !== "READY" || !record.botId || !record.revisionId || !record.context)) {
      return BotProofResultSchema.parse({ mode, status: "BLOCKED", acceptedTurns: 0, receiptIds: [], safeMessage: "Proof bị chặn vì Bot chưa READY theo target hiện hành.", completedAt: this.store.nowIso() });
    }

    let profile: RuleProfile | undefined;
    try {
      profile = this.executableProfile(tournamentId);
    } catch {
      return BotProofResultSchema.parse({ mode, status: "BLOCKED", acceptedTurns: 0, receiptIds: [], safeMessage: "Proof bị chặn vì luật engine của giải chưa sẵn sàng.", completedAt: this.store.nowIso() });
    }
    let state: RuleState = profile ? createInitialState({ profile }) : createInitialState();
    const history: BotMoveRecord[] = [];
    const receiptIds: string[] = [];
    const memoryByEnrollment = new Map<string, JsonValue>();
    const matchId = randomUUID();
    const accepted = (side: Side, from: Coordinate, to: Coordinate): boolean => {
      const captured = state.board[to]?.type ?? null;
      const moved = applyMove(state, { side, from, to });
      if (moved.kind !== "accepted") return false;
      state = moved.state;
      history.push({ side, from, to, captured: captured as PieceType | null });
      return true;
    };
    const invoke = async (record: ReadinessRecord, side: Side): Promise<boolean> => {
      if (!record.botId || !record.revisionId) return false;
      const result = await this.library.runTrustedTurn({
        ownerUserId: record.target.userId,
        botId: record.botId,
        revisionId: record.revisionId,
        side,
        state,
        history,
        clocksMs: { BLUE: DEFAULT_BOT_LIMITS.wholeMatchMs, RED: DEFAULT_BOT_LIMITS.wholeMatchMs },
        memory: memoryByEnrollment.get(record.target.enrollmentId) ?? null,
        seed: history.length + 1,
        matchId,
        stateVersion: history.length,
      });
      if (result.receipt.outcome !== "ACCEPTED") return false;
      if (!accepted(side, result.move.from as Coordinate, result.move.to as Coordinate)) return false;
      memoryByEnrollment.set(record.target.enrollmentId, result.memory);
      receiptIds.push(result.receipt.receiptId);
      return true;
    };

    try {
      if (mode === "OFFLINE_HUMAN_PYTHON") {
        const humanState = createBotTurnState(state, "BLUE", history, { BLUE: DEFAULT_BOT_LIMITS.wholeMatchMs, RED: DEFAULT_BOT_LIMITS.wholeMatchMs });
        const humanMove = humanState.legalMoves[0];
        if (!humanMove || !accepted("BLUE", humanMove.from, humanMove.to) || !(await invoke(records[0]!, "RED"))) {
          throw new Error("human-python-proof-rejected");
        }
      } else {
        if (!(await invoke(records[0]!, "BLUE")) || !(await invoke(records[1]!, "RED"))) {
          throw new Error("bot-bot-proof-rejected");
        }
      }
      return BotProofResultSchema.parse({ mode, status: "PASSED", acceptedTurns: receiptIds.length, receiptIds, safeMessage: "Proof Offline đã có nước đi hợp lệ và receipt N06 từ runtime cô lập.", completedAt: this.store.nowIso() });
    } catch {
      return BotProofResultSchema.parse({ mode, status: "BLOCKED", acceptedTurns: 0, receiptIds: [], safeMessage: "Proof bị chặn vì runtime không thể tạo lượt Bot hợp lệ trong policy gate.", completedAt: this.store.nowIso() });
    }
  }
}
