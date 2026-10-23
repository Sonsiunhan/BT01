import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  CreateSupportRequestInputSchema,
  D07SupportRequestStatusSchema,
  RecoveryTokenHandoffSchema,
  SupportRequestCreateResultSchema,
  SupportRequestListSchema,
  SupportRequestTransitionInputSchema,
  SupportRequestViewSchema,
  ConsumeRecoveryTokenInputSchema,
  ConsumeRecoveryTokenResultSchema,
  type CreateSupportRequestInput,
  type ConsumeRecoveryTokenInput,
  type ConsumeRecoveryTokenResult,
  type D07SupportRequestStatus,
  type RecoveryTokenHandoff,
  type SupportRequestCreateResult,
  type SupportRequestList,
  type SupportRequestTransitionInput,
  type SupportRequestView,
} from "@ottv2/contracts";
import { AppError } from "../../shared/errors/app-error.js";
import { createOpaqueToken, hashSecret, hashToken } from "../auth/auth.crypto.js";
import { AuthThrottle } from "../auth/auth.throttle.js";

const REQUEST_TYPE = "ACCOUNT_RECOVERY" as const;
const RESET_PURPOSE = "ACCOUNT_RECOVERY_RESET" as const;

export type SupportRecoveryActor = {
  userId: string;
  role?: string;
  tenantId?: string | null;
};

export type SupportServiceOptions = {
  /** BA+SA Section 15 candidate default; replace through configuration when approved. */
  resetTokenTtlMinutes?: number;
  /** BA+SA Section 15 candidate default; applies per target account and UTC day. */
  maxRequestsPerAccountPerDay?: number;
  now?: () => Date;
};

export function hashSupportRecoveryToken(rawToken: string): string {
  return hashToken(rawToken);
}

function fail(
  code: ConstructorParameters<typeof AppError>[0],
  message: string,
  statusCode: number,
  details: Record<string, unknown> = {},
): never {
  throw new AppError(
    code,
    message,
    statusCode,
    false,
    statusCode >= 500 ? "RECOVERABLE" : "INVALID",
    details,
  );
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function utcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function asDate(value: Date | string | null | undefined, fallback: Date): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  return fallback;
}

function parseContract<T>(parser: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: unknown[] } } }, value: unknown): T {
  const parsed = parser.safeParse(value);
  if (!parsed.success) {
    fail("VALIDATION_ERROR", "Dữ liệu yêu cầu không hợp lệ.", 400, { issues: parsed.error.issues });
  }
  return parsed.data;
}

function assertReasonContainsNoCredentialAssignment(reason: string): void {
  // A support description may explain a lost credential, but must not become a
  // transport for a plaintext password, recovery code, token, or OTP.
  if (/(?:password|passwd|mật\s*khẩu|mat\s*khau|recovery\s*code|token|otp)\s*(?::|=|\bis\b)\s*\S+/iu.test(reason)) {
    fail("VALIDATION_ERROR", "Không gửi mật khẩu hoặc mã bí mật trong yêu cầu hỗ trợ.", 400, {
      reason: "CREDENTIAL_MATERIAL_FORBIDDEN",
    });
  }
}

type TicketRecord = {
  id: string;
  tenantId?: string | null;
  requestType?: string;
  targetUserId: string;
  requesterUserId?: string | null;
  description: string;
  status: string;
  assignedOperatorUserId?: string | null;
  verificationReference?: string | null;
  createdAt: Date;
  updatedAt?: Date;
  verifiedAt?: Date | null;
  rejectedAt?: Date | null;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  recoveryTokenHash?: string | null;
  recoveryTokenPurpose?: string | null;
  recoveryTokenExpiresAt?: Date | null;
  recoveryTokenIssuedAt?: Date | null;
  recoveryTokenConsumedAt?: Date | null;
  idempotencyKey: string;
};

export class SupportRecoveryService {
  private readonly now: () => Date;
  private readonly resetTokenTtlMinutes: number;
  private readonly maxRequestsPerAccountPerDay: number;
  private readonly publicThrottle = new AuthThrottle();

  constructor(
    private readonly db: PrismaClient,
    options: SupportServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.resetTokenTtlMinutes = options.resetTokenTtlMinutes ?? 30;
    this.maxRequestsPerAccountPerDay = options.maxRequestsPerAccountPerDay ?? 10;
    if (!Number.isFinite(this.resetTokenTtlMinutes) || this.resetTokenTtlMinutes <= 0) {
      throw new Error("resetTokenTtlMinutes must be a positive configured value");
    }
    if (!Number.isInteger(this.maxRequestsPerAccountPerDay) || this.maxRequestsPerAccountPerDay <= 0) {
      throw new Error("maxRequestsPerAccountPerDay must be a positive configured integer");
    }
  }

  private assertOperator(actor: SupportRecoveryActor): void {
    // The current Role enum has no SUPPORT_AGENT or tenant role assignment. Fail closed
    // to the existing system-admin authority until Long supplies the canonical scoped role.
    if (actor.role !== "SYSTEM_ADMIN") {
      fail("UNAUTHORIZED", "Bạn không có quyền truy cập hàng đợi hỗ trợ.", 403, {
        reason: "SUPPORT_OPERATOR_REQUIRED",
      });
    }
  }

  private assertTenantScope(actor: SupportRecoveryActor, ticket: TicketRecord): void {
    if (actor.tenantId && ticket.tenantId !== actor.tenantId) {
      fail("NOT_FOUND", "Không tìm thấy yêu cầu hỗ trợ.", 404, { reason: "SUPPORT_SCOPE_MISMATCH" });
    }
  }

  private async targetForRequest(
    actor: SupportRecoveryActor | null,
    input: CreateSupportRequestInput,
    tx: any,
  ): Promise<{ targetUserId: string; requesterUserId: string | null; tenantId: string | null } | null> {
    if (actor) {
      const user = await tx.user.findUnique({ where: { id: actor.userId }, select: { id: true } });
      if (!user) fail("UNAUTHORIZED", "Phiên tài khoản không còn hợp lệ.", 401, { reason: "ACTOR_NOT_FOUND" });
      return {
        targetUserId: user.id,
        requesterUserId: user.id,
        tenantId: actor.tenantId ?? null,
      };
    }

    // Public recovery accepts only the canonical username identifier. A missing
    // user deliberately returns null so the route can send the same response.
    if (!input.username) return null;
    const user = await tx.user.findUnique({
      where: { usernameNormalized: normalizeUsername(input.username) },
      select: { id: true },
    });
    if (!user) return null;
    return { targetUserId: user.id, requesterUserId: null, tenantId: null };
  }

  private view(ticket: TicketRecord): SupportRequestView {
    return SupportRequestViewSchema.parse({
      id: ticket.id,
      tenantId: ticket.tenantId ?? null,
      requestType: ticket.requestType ?? REQUEST_TYPE,
      targetUserId: ticket.targetUserId,
      requesterUserId: ticket.requesterUserId ?? null,
      status: ticket.status,
      reason: ticket.description,
      assignedOperatorUserId: ticket.assignedOperatorUserId ?? null,
      verificationReference: ticket.verificationReference ?? null,
      createdAt: asDate(ticket.createdAt, this.now()).toISOString(),
      updatedAt: asDate(ticket.updatedAt, asDate(ticket.createdAt, this.now())).toISOString(),
      verifiedAt: ticket.verifiedAt ? new Date(ticket.verifiedAt).toISOString() : null,
      rejectedAt: ticket.rejectedAt ? new Date(ticket.rejectedAt).toISOString() : null,
      resolvedAt: ticket.resolvedAt ? new Date(ticket.resolvedAt).toISOString() : null,
      closedAt: ticket.closedAt ? new Date(ticket.closedAt).toISOString() : null,
    });
  }

  private async audit(
    tx: any,
    actor: SupportRecoveryActor | null,
    action: string,
    ticket: TicketRecord,
    afterSnapshot: Record<string, unknown>,
  ): Promise<void> {
    await tx.tournamentAuditLogRecord.create({
      data: {
        id: randomUUID(),
        actorUserId: actor?.userId ?? "PUBLIC_RECOVERY",
        actorRole: actor?.role ?? "PUBLIC",
        action,
        targetType: "SUPPORT_RECOVERY",
        targetId: ticket.id,
        // Deliberately exclude description, token, token hash, and credentials.
        afterSnapshot: {
          requestType: ticket.requestType ?? REQUEST_TYPE,
          targetUserId: ticket.targetUserId,
          tenantId: ticket.tenantId ?? null,
          ...afterSnapshot,
        },
        reason: "D07-A support/recovery transition",
      },
    });
  }

  async createRequest(
    actor: SupportRecoveryActor | null,
    rawInput: unknown,
    publicRateKey?: string,
  ): Promise<SupportRequestCreateResult> {
    const input = parseContract<CreateSupportRequestInput>(CreateSupportRequestInputSchema, rawInput);
    assertReasonContainsNoCredentialAssignment(input.reason);
    const now = this.now();
    if (!actor && publicRateKey) {
      const key = `support-recovery:${publicRateKey}`;
      this.publicThrottle.guard(key);
      // Public recovery requests are deliberately counted as attempts. The existing
      // bounded AuthThrottle then applies a short backoff without account enumeration.
      this.publicThrottle.failure(key);
    }
    const result = await this.db.$transaction(async (tx: any) => {
      const target = await this.targetForRequest(actor, input, tx);
      if (!target) return { accepted: true as const, requestId: null, replayed: false };

      const idempotencyKey = input.idempotencyKey
        ?? `auto-${hashToken(`${target.targetUserId}|${utcDayStart(now).toISOString()}|${input.reason.trim()}`)}`;
      const existing = await tx.supportRecoveryTicket.findUnique({
        where: {
          targetUserId_idempotencyKey: {
            targetUserId: target.targetUserId,
            idempotencyKey,
          },
        },
      });
      if (existing) {
        this.assertTenantScope(actor ?? { userId: "PUBLIC", role: "PUBLIC" }, existing);
        return { accepted: true as const, requestId: existing.id, replayed: true };
      }

      const requestCount = await tx.supportRecoveryTicket.count({
        where: {
          targetUserId: target.targetUserId,
          createdAt: { gte: utcDayStart(now) },
        },
      });
      if (requestCount >= this.maxRequestsPerAccountPerDay) {
        if (actor) {
          fail("RATE_LIMITED", "Yêu cầu hỗ trợ đã đạt giới hạn trong ngày.", 429, {
            reason: "SUPPORT_REQUEST_DAILY_LIMIT",
          });
        }
        return { accepted: true as const, requestId: null, replayed: false };
      }

      const data = {
        id: randomUUID(),
        tenantId: target.tenantId,
        requestType: REQUEST_TYPE,
        targetUserId: target.targetUserId,
        requesterUserId: target.requesterUserId,
        description: input.reason.trim(),
        status: "OPEN",
        idempotencyKey,
        createdAt: now,
        updatedAt: now,
      };
      let ticket: TicketRecord;
      try {
        ticket = await tx.supportRecoveryTicket.create({ data });
      } catch (error) {
        // The composite unique key is the durable retry guard. If a concurrent
        // request won the insert, return that record instead of creating a twin.
        if ((error as { code?: string })?.code !== "P2002") throw error;
        const raced = await tx.supportRecoveryTicket.findUnique({
          where: { targetUserId_idempotencyKey: { targetUserId: target.targetUserId, idempotencyKey } },
        });
        if (!raced) throw error;
        return { accepted: true as const, requestId: raced.id, replayed: true };
      }
      await this.audit(tx, actor, "SUPPORT_REQUEST_CREATED", ticket, { status: "OPEN" });
      return { accepted: true as const, requestId: ticket.id, replayed: false };
    });
    return SupportRequestCreateResultSchema.parse(result);
  }

  async listRequests(
    actor: SupportRecoveryActor,
    status?: D07SupportRequestStatus,
  ): Promise<SupportRequestList> {
    this.assertOperator(actor);
    if (status) parseContract<D07SupportRequestStatus>(D07SupportRequestStatusSchema, status);
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (actor.tenantId) where.tenantId = actor.tenantId;
    const tickets = await (this.db as any).supportRecoveryTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return SupportRequestListSchema.parse({ requests: tickets.map((ticket: TicketRecord) => this.view(ticket)) });
  }

  async getRequest(actor: SupportRecoveryActor, requestId: string): Promise<SupportRequestView> {
    this.assertOperator(actor);
    const ticket = await (this.db as any).supportRecoveryTicket.findUnique({ where: { id: requestId } });
    if (!ticket) fail("NOT_FOUND", "Không tìm thấy yêu cầu hỗ trợ.", 404, { reason: "SUPPORT_REQUEST_NOT_FOUND" });
    this.assertTenantScope(actor, ticket);
    return this.view(ticket);
  }

  async transitionRequest(
    actor: SupportRecoveryActor,
    requestId: string,
    rawInput: unknown,
  ): Promise<{ request: SupportRequestView; replayed: boolean }> {
    this.assertOperator(actor);
    const input = parseContract<SupportRequestTransitionInput>(SupportRequestTransitionInputSchema, rawInput);
    const result = await (this.db as any).$transaction(async (tx: any) => {
      const ticket = await tx.supportRecoveryTicket.findUnique({ where: { id: requestId } });
      if (!ticket) fail("NOT_FOUND", "Không tìm thấy yêu cầu hỗ trợ.", 404, { reason: "SUPPORT_REQUEST_NOT_FOUND" });
      this.assertTenantScope(actor, ticket);

      const nextStatus: Record<SupportRequestTransitionInput["action"], D07SupportRequestStatus> = {
        IN_PROGRESS: "IN_PROGRESS",
        VERIFY: "VERIFIED",
        REJECT: "REJECTED",
        RESOLVE: "RESOLVED",
        CLOSE: "CLOSED",
      };
      const targetStatus = nextStatus[input.action];
      if (ticket.status === targetStatus) return { ticket, replayed: true };
      const allowed: Record<string, string[]> = {
        OPEN: ["IN_PROGRESS", "REJECTED"],
        IN_PROGRESS: ["VERIFIED", "REJECTED"],
        VERIFIED: ["RESOLVED"],
        RESOLVED: ["CLOSED"],
        REJECTED: ["CLOSED"],
        ESCALATED: ["IN_PROGRESS", "CLOSED"],
        CLOSED: [],
      };
      if (!allowed[ticket.status]?.includes(targetStatus)) {
        fail("CONFLICT", "Yêu cầu hỗ trợ không ở trạng thái có thể chuyển tiếp.", 409, {
          reason: "SUPPORT_REQUEST_STATE_CONFLICT",
          status: ticket.status,
          requestedStatus: targetStatus,
        });
      }
      if (input.action === "VERIFY" && !input.verificationReference) {
        fail("VALIDATION_ERROR", "Thiếu mã tham chiếu xác minh.", 400, { reason: "VERIFICATION_REFERENCE_REQUIRED" });
      }
      const timestamp = this.now();
      const updateData: Record<string, unknown> = {
        status: targetStatus,
        assignedOperatorUserId: actor.userId,
        updatedAt: timestamp,
      };
      if (input.action === "VERIFY") {
        updateData.verifiedAt = timestamp;
        updateData.verificationReference = input.verificationReference;
      } else if (input.action === "REJECT") {
        updateData.rejectedAt = timestamp;
      } else if (input.action === "RESOLVE") {
        updateData.resolvedAt = timestamp;
      } else if (input.action === "CLOSE") {
        updateData.closedAt = timestamp;
      }
      const changed = await tx.supportRecoveryTicket.updateMany({
        where: { id: ticket.id, status: ticket.status },
        data: updateData,
      });
      if (changed.count !== 1) {
        const current = await tx.supportRecoveryTicket.findUnique({ where: { id: ticket.id } });
        if (current?.status === targetStatus) return { ticket: current, replayed: true };
        fail("CONFLICT", "Yêu cầu hỗ trợ đã thay đổi trong lúc xử lý.", 409, { reason: "SUPPORT_REQUEST_RACE" });
      }
      const updated = await tx.supportRecoveryTicket.findUnique({ where: { id: ticket.id } });
      if (!updated) fail("NOT_FOUND", "Không tìm thấy yêu cầu hỗ trợ.", 404, { reason: "SUPPORT_REQUEST_NOT_FOUND" });
      await this.audit(tx, actor, `SUPPORT_REQUEST_${targetStatus}`, updated, {
        beforeStatus: ticket.status,
        status: targetStatus,
        verificationReference: input.action === "VERIFY" ? input.verificationReference : undefined,
      });
      return { ticket: updated, replayed: false };
    });
    return { request: this.view(result.ticket), replayed: result.replayed };
  }

  async issueResetToken(actor: SupportRecoveryActor, requestId: string): Promise<RecoveryTokenHandoff> {
    this.assertOperator(actor);
    const result = await (this.db as any).$transaction(async (tx: any) => {
      const ticket = await tx.supportRecoveryTicket.findUnique({ where: { id: requestId } });
      if (!ticket) fail("NOT_FOUND", "Không tìm thấy yêu cầu hỗ trợ.", 404, { reason: "SUPPORT_REQUEST_NOT_FOUND" });
      this.assertTenantScope(actor, ticket);
      if (ticket.status !== "VERIFIED") {
        fail("CONFLICT", "Chỉ yêu cầu đã được xác minh mới được cấp mã khôi phục.", 409, {
          reason: "SUPPORT_REQUEST_NOT_VERIFIED",
          status: ticket.status,
        });
      }
      const now = this.now();
      if (ticket.recoveryTokenConsumedAt) {
        fail("CONFLICT", "Mã khôi phục đã được sử dụng.", 409, { reason: "RECOVERY_TOKEN_CONSUMED" });
      }
      if (ticket.recoveryTokenHash && ticket.recoveryTokenExpiresAt && ticket.recoveryTokenExpiresAt > now) {
        return { ticket, rawToken: null, replayed: true };
      }
      const rawToken = createOpaqueToken(32);
      const expiresAt = new Date(now.getTime() + this.resetTokenTtlMinutes * 60_000);
      const updateData = {
        recoveryTokenHash: hashSupportRecoveryToken(rawToken),
        recoveryTokenPurpose: RESET_PURPOSE,
        recoveryTokenIssuedAt: now,
        recoveryTokenExpiresAt: expiresAt,
        recoveryTokenConsumedAt: null,
        updatedAt: now,
      };
      const changed = await tx.supportRecoveryTicket.updateMany({
        where: ticket.recoveryTokenHash
          ? { id: ticket.id, status: "VERIFIED", recoveryTokenHash: ticket.recoveryTokenHash, recoveryTokenExpiresAt: { lte: now } }
          : { id: ticket.id, status: "VERIFIED", recoveryTokenHash: null },
        data: updateData,
      });
      if (changed.count !== 1) {
        const current = await tx.supportRecoveryTicket.findUnique({ where: { id: ticket.id } });
        if (current?.recoveryTokenConsumedAt) {
          fail("CONFLICT", "Mã khôi phục đã được sử dụng.", 409, { reason: "RECOVERY_TOKEN_CONSUMED" });
        }
        if (current?.recoveryTokenHash && current.recoveryTokenExpiresAt && current.recoveryTokenExpiresAt > now) {
          return { ticket: current, rawToken: null, replayed: true };
        }
        fail("CONFLICT", "Mã khôi phục đã thay đổi trong lúc xử lý.", 409, { reason: "RECOVERY_TOKEN_RACE" });
      }
      const updated = await tx.supportRecoveryTicket.findUnique({ where: { id: ticket.id } });
      if (!updated) fail("NOT_FOUND", "Không tìm thấy yêu cầu hỗ trợ.", 404, { reason: "SUPPORT_REQUEST_NOT_FOUND" });
      await this.audit(tx, actor, "SUPPORT_RECOVERY_TOKEN_ISSUED", updated, {
        status: updated.status,
        purpose: RESET_PURPOSE,
        expiresAt: expiresAt.toISOString(),
      });
      return { ticket: updated, rawToken, replayed: false };
    });
    return RecoveryTokenHandoffSchema.parse({
      request: this.view(result.ticket),
      purpose: RESET_PURPOSE,
      expiresAt: result.ticket.recoveryTokenExpiresAt
        ? new Date(result.ticket.recoveryTokenExpiresAt).toISOString()
        : null,
      rawToken: result.rawToken,
      replayed: result.replayed,
    });
  }

  private invalidRecoveryToken(reason: string): never {
    // Keep token existence, account identity, purpose and lifecycle state
    // indistinguishable to the public caller.
    void reason;
    fail("UNAUTHORIZED", "Mã khôi phục không hợp lệ hoặc đã hết hạn.", 401);
  }

  /**
   * D07-B token-only reset execution. The token is the sole caller authority;
   * target identity is read from the persisted ticket after hash lookup.
   */
  async consumeRecoveryToken(rawInput: unknown, publicRateKey?: string): Promise<ConsumeRecoveryTokenResult> {
    const input = parseContract<ConsumeRecoveryTokenInput>(ConsumeRecoveryTokenInputSchema, rawInput);
    const tokenHash = hashSupportRecoveryToken(input.token);
    const throttleKey = `support-recovery-consume:${publicRateKey ?? tokenHash}`;
    this.publicThrottle.guard(throttleKey);
    this.publicThrottle.failure(throttleKey);
    const passwordHash = await hashSecret(input.newPassword);
    const now = this.now();

    const result = await (this.db as any).$transaction(async (tx: any) => {
      const ticket = await tx.supportRecoveryTicket.findUnique({ where: { recoveryTokenHash: tokenHash } });
      if (!ticket) this.invalidRecoveryToken("RECOVERY_TOKEN_NOT_FOUND");
      if (ticket.requestType !== REQUEST_TYPE) this.invalidRecoveryToken("RECOVERY_TOKEN_PURPOSE_MISMATCH");
      if (ticket.recoveryTokenPurpose !== RESET_PURPOSE) this.invalidRecoveryToken("RECOVERY_TOKEN_PURPOSE_MISMATCH");
      if (ticket.status !== "VERIFIED") this.invalidRecoveryToken("RECOVERY_TICKET_STATE_INVALID");
      if (ticket.recoveryTokenConsumedAt) this.invalidRecoveryToken("RECOVERY_TOKEN_CONSUMED");
      if (!ticket.recoveryTokenExpiresAt || ticket.recoveryTokenExpiresAt <= now) this.invalidRecoveryToken("RECOVERY_TOKEN_EXPIRED");
      if (!ticket.targetUserId) this.invalidRecoveryToken("RECOVERY_TARGET_MISSING");

      const user = await tx.user.findUnique({ where: { id: ticket.targetUserId }, select: { id: true } });
      if (!user) this.invalidRecoveryToken("RECOVERY_TARGET_NOT_FOUND");

      const consumed = await tx.supportRecoveryTicket.updateMany({
        where: {
          id: ticket.id,
          targetUserId: ticket.targetUserId,
          status: "VERIFIED",
          requestType: REQUEST_TYPE,
          recoveryTokenPurpose: RESET_PURPOSE,
          recoveryTokenHash: tokenHash,
          recoveryTokenConsumedAt: null,
          recoveryTokenExpiresAt: { gt: now },
        },
        data: {
          status: "RESOLVED",
          recoveryTokenConsumedAt: now,
          resolvedAt: now,
          updatedAt: now,
        },
      });
      if (consumed.count !== 1) this.invalidRecoveryToken("RECOVERY_TOKEN_RACE_OR_REPLAY");

      // All credential and token finalization writes are in the same authoritative
      // transaction. Any failure rolls back both sides.
      await tx.user.update({ where: { id: ticket.targetUserId }, data: { passwordHash } });
      await tx.session.updateMany({
        where: { userId: ticket.targetUserId, revokedAt: null },
        data: { revokedAt: now },
      });

      const finalized = await tx.supportRecoveryTicket.findUnique({ where: { id: ticket.id } });
      if (!finalized) this.invalidRecoveryToken("RECOVERY_TICKET_NOT_FOUND_AFTER_UPDATE");
      await this.audit(tx, { userId: ticket.targetUserId, role: "RECOVERY_TOKEN", tenantId: ticket.tenantId ?? null }, "SUPPORT_RECOVERY_COMPLETED", finalized, {
        status: "RESOLVED",
        consumedAt: now.toISOString(),
        purpose: RESET_PURPOSE,
      });
      return { accepted: true as const };
    });

    return ConsumeRecoveryTokenResultSchema.parse(result);
  }
}
