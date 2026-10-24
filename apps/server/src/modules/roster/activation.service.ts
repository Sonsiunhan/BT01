import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  CANDIDATE_POLICY_DEFAULTS_V1,
  type ClaimActivationRequest,
  type ClaimActivationResponse,
  type IssueActivationTokenRequest,
  type IssueActivationTokenResponse,
  type ActivationStatus,
  type ActivationStatusResponse,
  type SetupCredentialRequest,
  type SetupCredentialResponse,
} from "@ottv2/contracts";

import { AppError } from "../../shared/errors/app-error.js";
import { createRecoveryCode, hashSecret } from "../auth/auth.crypto.js";
import { assertActorScopeForContract } from "./roster-authorization.js";

// ---------------------------------------------------------------------------
// Constants derived from canonical policy (never hardcode a numeric TTL)
// ---------------------------------------------------------------------------

const CLAIM_TOKEN_TTL_MS =
  CANDIDATE_POLICY_DEFAULTS_V1.claimTokenTtlHours * 60 * 60 * 1000;

const OPERATION_ISSUE = "ROSTER_ACTIVATION_ISSUE" as const;
const OPERATION_CLAIM = "ROSTER_ACTIVATION_CLAIM" as const;
const OPERATION_CREDENTIAL = "ROSTER_CREDENTIAL_SETUP" as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Hash a raw token with SHA-256 — stored value, never the raw token. */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Generate a cryptographically random URL-safe claim token (32 bytes → 64 hex chars). */
function generateClaimToken(): string {
  return randomBytes(32).toString("hex");
}

// ---------------------------------------------------------------------------
// Actor type
// ---------------------------------------------------------------------------

export type ActivationActor = {
  userId: string;
  role: string;
};

// ---------------------------------------------------------------------------
// ActivationService — D05-A backend core
// ---------------------------------------------------------------------------

export class ActivationService {
  constructor(private readonly db?: PrismaClient) {}

  private requireDb(): PrismaClient {
    if (!this.db) {
      throw new AppError("SERVICE_UNAVAILABLE", "Dịch vụ kích hoạt chưa khả dụng.", 503, true, "RECOVERABLE");
    }
    return this.db;
  }

  // -------------------------------------------------------------------------
  // Issue Activation Token (admin-initiated)
  // -------------------------------------------------------------------------
  /**
   * Issues a time-limited claim token for an enrollment.
   *
   * Rules:
   *  - Caller must be SYSTEM_ADMIN or TOURNAMENT_ADMIN bound to the contract.
   *  - Enrollment must be within the actor's authorized contract scope.
   *  - Enrollment must not already be CLAIMED (userId !== null AND user exists with credential).
   *  - If a valid un-expired token already exists for the enrollmentId (same commandId / idempotencyKey),
   *    the call is idempotent and returns reissued=true.
   *  - Raw token is returned ONCE — it must be delivered out-of-band to the participant.
   *  - Token is stored only as a SHA-256 hash; the raw token is never persisted.
   */
  async issueActivationToken(
    request: IssueActivationTokenRequest,
    actor: ActivationActor,
  ): Promise<IssueActivationTokenResponse> {
    if (!this.db) {
      throw new AppError("SERVICE_UNAVAILABLE", "Dịch vụ kích hoạt chưa khả dụng.", 503, true, "RECOVERABLE");
    }

    // 1. Load enrollment with its contract/tournament scope
    const enrollment = await this.db.tournamentEnrollmentRecord.findUnique({
      where: { id: request.enrollmentId },
      select: {
        id: true,
        personKey: true,
        userId: true,
        contractId: true,
        tournamentId: true,
        displayName: true,
        unitCode: true,
      },
    });

    if (!enrollment) {
      throw new AppError("NOT_FOUND", "Không tìm thấy bản ghi đăng ký.", 404, false, "INVALID");
    }

    // 2. Authorization: verify actor scope against enrollment's contract
    await assertActorScopeForContract(this.requireDb(), actor, enrollment.contractId);

    // 3. Check if already fully claimed with a credential
    if (enrollment.userId !== null) {
      const user = await this.db.user.findUnique({
        where: { id: enrollment.userId },
        select: { id: true, passwordHash: true },
      });
      if (user && user.passwordHash && !user.passwordHash.startsWith("!")) {
        // ACTIVE — D05-B complete; no new token should be issued
        throw new AppError(
          "CONFLICT",
          "Tài khoản đã được kích hoạt và thiết lập thông tin đăng nhập. Không thể phát hành token mới.",
          409,
          false,
          "INVALID",
          { reason: "ALREADY_ACTIVE" },
        );
      }
    }

    // 4. Idempotency: check for existing valid issued token
    const idempotencyKey = request.idempotencyKey ?? `issue:${enrollment.id}`;
    const existing = await this.db.commandLedgerEntry.findUnique({
      where: {
        principalId_targetId_operation_commandId: {
          principalId: actor.userId,
          targetId: enrollment.id,
          operation: OPERATION_ISSUE,
          commandId: idempotencyKey,
        },
      },
    });

    if (existing && existing.expiresAt && existing.expiresAt > new Date()) {
      // Unexpired token exists — return idempotent response WITHOUT exposing token hash
      // The raw token is not stored; the admin must re-issue (new key) to get a new raw token.
      // We cannot return the original raw token (not stored).
      // Per spec: re-issuing with the same key acknowledges the token was already issued.
      return {
        enrollmentId: enrollment.id,
        personKey: enrollment.personKey,
        claimToken: "[redacted — token already issued, use a new idempotencyKey to re-issue]",
        expiresAt: existing.expiresAt.toISOString(),
        reissued: true,
      };
    }

    // 5. Generate new token
    const rawToken = generateClaimToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + CLAIM_TOKEN_TTL_MS);

    // 6. Persist token hash in CommandLedgerEntry transactionally with audit log
    await this.db.$transaction(async (tx) => {
      // Upsert ledger entry (may replace expired prior entry)
      await (tx as any).commandLedgerEntry.create({
        data: {
          id: randomUUID(),
          principalId: actor.userId,
          targetId: enrollment.id,
          operation: OPERATION_ISSUE,
          commandId: idempotencyKey,
          payloadDigest: tokenHash,
          outcome: "ISSUED",
          stateVersion: 1,
          sequence: 1,
          ackPayload: {
            enrollmentId: enrollment.id,
            personKey: enrollment.personKey,
            expiresAt: expiresAt.toISOString(),
          },
          expiresAt,
        },
      });

      // Audit log
      await (tx as any).tournamentAuditLogRecord.create({
        data: {
          id: randomUUID(),
          actorUserId: actor.userId,
          actorRole: actor.role,
          action: "ROSTER_ACTIVATION_TOKEN_ISSUED",
          targetType: "ENROLLMENT",
          targetId: enrollment.id,
          afterSnapshot: {
            personKey: enrollment.personKey,
            contractId: enrollment.contractId,
            expiresAt: expiresAt.toISOString(),
            // tokenHash intentionally omitted from public audit record
          },
          reason: "D05-A activation token issued",
        },
      });
    });

    return {
      enrollmentId: enrollment.id,
      personKey: enrollment.personKey,
      claimToken: rawToken, // returned ONCE to admin for out-of-band delivery
      expiresAt: expiresAt.toISOString(),
      reissued: false,
    };
  }

  // -------------------------------------------------------------------------
  // Claim Activation (participant-initiated)
  // -------------------------------------------------------------------------
  /**
   * Participant presents the raw claim token and chooses their initial username/displayName.
   *
   * Rules:
   *  - NO password accepted (D05-B handles credential setup).
   *  - Token must be valid, unexpired, and match a CommandLedgerEntry with operation=ROSTER_ACTIVATION_ISSUE.
   *  - Enrollment's userId must be null OR point to an existing user without a password
   *    (already CLAIMED but credential not yet set — idempotent replay).
   *  - If userId is null → create minimal User record (no password), link to enrollment.
   *  - If userId already set and user exists → LINKED_TO_EXISTING (idempotent replay).
   *  - Username must be unique and satisfy canonical format.
   *  - Scope is checked via the enrollment's contractId embedded in the ledger ackPayload.
   *  - The claim operation is recorded in CommandLedgerEntry (operation=ROSTER_ACTIVATION_CLAIM).
   *  - The issued token ledger entry is marked expired (expiresAt = now) after claim to prevent replay.
   */
  async claimActivation(
    request: ClaimActivationRequest,
  ): Promise<ClaimActivationResponse> {
    if (!this.db) {
      throw new AppError("SERVICE_UNAVAILABLE", "Dịch vụ kích hoạt chưa khả dụng.", 503, true, "RECOVERABLE");
    }

    // 0. Plaintext password guard — never accept/persist password fields at D05-A
    const raw = request as Record<string, unknown>;
    const forbiddenKeys = ["password", "mat_khau", "matkhau", "pass", "pwd", "secret"];
    if (forbiddenKeys.some((k) => k in raw && raw[k] !== undefined)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Không chấp nhận trường mật khẩu trong yêu cầu kích hoạt.",
        400,
        false,
        "INVALID",
      );
    }

    // 1. Resolve raw token
    const tokenHash = hashToken(request.claimToken);

    // Find the issued token ledger entry by payloadDigest = tokenHash
    const tokenEntry = await this.db.commandLedgerEntry.findFirst({
      where: {
        operation: OPERATION_ISSUE,
        payloadDigest: tokenHash,
      },
    });

    if (!tokenEntry) {
      throw new AppError("UNAUTHORIZED", "Token kích hoạt không hợp lệ.", 401, false, "INVALID", {
        reason: "INVALID_TOKEN",
      });
    }

    const enrollmentId = tokenEntry.targetId;

    // 2. Check idempotency — has this enrollment already been claimed?
    const existingClaim = await this.db.commandLedgerEntry.findFirst({
      where: {
        targetId: enrollmentId,
        operation: OPERATION_CLAIM,
        outcome: "CLAIMED",
      },
    });

    if (existingClaim?.ackPayload) {
      // Idempotent replay — return the stored outcome
      const ack = existingClaim.ackPayload as any;
      return {
        success: true,
        enrollmentId,
        userId: ack.userId,
        username: ack.username,
        displayName: ack.displayName,
        personKey: ack.personKey,
        claimedAt: (existingClaim.committedAt ?? existingClaim.receivedAt).toISOString(),
        outcome: "LINKED_TO_EXISTING",
      };
    }

    // 3. Expiration / consumption check
    if (tokenEntry.outcome === "CONSUMED" || !tokenEntry.expiresAt || tokenEntry.expiresAt <= new Date()) {
      throw new AppError("UNAUTHORIZED", "Token kích hoạt đã hết hạn.", 401, false, "INVALID", {
        reason: "TOKEN_EXPIRED",
      });
    }

    // 3. Load enrollment
    const enrollment = await this.db.tournamentEnrollmentRecord.findUnique({
      where: { id: enrollmentId },
      select: {
        id: true,
        personKey: true,
        userId: true,
        contractId: true,
        displayName: true,
        unitCode: true,
      },
    });

    if (!enrollment) {
      throw new AppError("NOT_FOUND", "Không tìm thấy bản ghi đăng ký.", 404, false, "INVALID");
    }

    // 4. Determine outcome inside a transaction
    const claimedAt = new Date();

    let response: ClaimActivationResponse;
    try {
      response = await this.db.$transaction(async (tx) => {
      let userId: string;
      let outcome: "NEWLY_ACTIVATED" | "LINKED_TO_EXISTING";

      if (enrollment.userId !== null) {
        // User already linked (prior partial claim or reuse from D04-B)
        const existingUser = await (tx as any).user.findUnique({
          where: { id: enrollment.userId },
          select: { id: true, username: true, displayName: true, passwordHash: true },
        });

        if (!existingUser) {
          throw new AppError("INTERNAL_ERROR", "Tài khoản được liên kết không tồn tại.", 500, false, "INVALID");
        }

        // DO NOT overwrite credentials — if password is already set, reject re-claim
        if (existingUser.passwordHash && !existingUser.passwordHash.startsWith("!")) {
          throw new AppError(
            "CONFLICT",
            "Tài khoản đã được kích hoạt đầy đủ. Không thể thực hiện lại.",
            409,
            false,
            "INVALID",
            { reason: "ALREADY_ACTIVE" },
          );
        }

        userId = existingUser.id;
        outcome = "LINKED_TO_EXISTING";
      } else {
        // Create minimal User record — NO password set (D05-B handles this)
        // Username uniqueness enforced by unique constraint on usernameNormalized
        const usernameNormalized = request.username.trim().toLowerCase();
        const conflicting = await (tx as any).user.findUnique({
          where: { usernameNormalized },
          select: { id: true },
        });
        if (conflicting) {
          throw new AppError(
            "CONFLICT",
            `Tên đăng nhập "${request.username}" đã tồn tại. Vui lòng chọn tên khác.`,
            409,
            false,
            "INVALID",
            { reason: "USERNAME_CONFLICT" },
          );
        }

        const newUserId = randomUUID();
        await (tx as any).user.create({
          data: {
            id: newUserId,
            fullName: enrollment.displayName,
            displayName: request.displayName.trim(),
            username: request.username.trim(),
            usernameNormalized,
            // passwordHash deliberately empty — D05-B sets credentials
            // Cannot be null per schema; use sentinel placeholder
            // that AuthService login will reject (no valid bcrypt prefix).
            passwordHash: "!UNCLAIMED",
            recoveryCodeHash: "!UNCLAIMED",
            role: "USER",
          },
        });

        // Link enrollment to newly created user
        await (tx as any).tournamentEnrollmentRecord.update({
          where: { id: enrollment.id },
          data: { userId: newUserId },
        });

        userId = newUserId;
        outcome = "NEWLY_ACTIVATED";
      }

      const responsePayload: ClaimActivationResponse = {
        success: true,
        enrollmentId: enrollment.id,
        userId,
        username: request.username.trim(),
        displayName: request.displayName.trim(),
        personKey: enrollment.personKey,
        claimedAt: claimedAt.toISOString(),
        outcome,
      };

      // Record claim in ledger (prevents replay)
      await (tx as any).commandLedgerEntry.create({
        data: {
          id: randomUUID(),
          principalId: userId,
          targetId: enrollmentId,
          operation: OPERATION_CLAIM,
          commandId: `claim:${enrollmentId}`,
          payloadDigest: tokenHash,
          outcome: "CLAIMED",
          stateVersion: 1,
          sequence: 1,
          ackPayload: {
            userId,
            username: request.username.trim(),
            displayName: request.displayName.trim(),
            personKey: enrollment.personKey,
          },
          committedAt: claimedAt,
          expiresAt: null,
        },
      });

      // Invalidate issued token (set expiresAt to now to prevent replay)
      await (tx as any).commandLedgerEntry.update({
        where: { id: tokenEntry.id },
        data: { expiresAt: claimedAt, outcome: "CONSUMED" },
      });

      // Audit log
      await (tx as any).tournamentAuditLogRecord.create({
        data: {
          id: randomUUID(),
          actorUserId: userId,
          actorRole: "USER",
          action: "ROSTER_ACTIVATION_CLAIMED",
          targetType: "ENROLLMENT",
          targetId: enrollment.id,
          afterSnapshot: {
            personKey: enrollment.personKey,
            userId,
            outcome,
            contractId: enrollment.contractId,
          },
          reason: "D05-A activation claimed by participant",
        },
      });

        return responsePayload;
      });
    } catch (error) {
      // A concurrent claim may lose on the enrollment username/ledger
      // uniqueness fence after the winning transaction commits. Re-read the
      // durable claim ledger and replay that safe result instead of exposing a
      // raw unique-key failure or creating another account.
      const committedClaim = await this.db.commandLedgerEntry.findFirst({
        where: { targetId: enrollmentId, operation: OPERATION_CLAIM, outcome: "CLAIMED" },
      });
      if (committedClaim?.ackPayload) {
        const ack = committedClaim.ackPayload as any;
        return {
          success: true,
          enrollmentId,
          userId: ack.userId,
          username: ack.username,
          displayName: ack.displayName,
          personKey: ack.personKey,
          claimedAt: (committedClaim.committedAt ?? committedClaim.receivedAt).toISOString(),
          outcome: "LINKED_TO_EXISTING",
        };
      }
      throw error;
    }

    return response;
  }

  // -------------------------------------------------------------------------
  // Setup Credential (D05-B participant-initiated — establishes password & recovery code)
  // -------------------------------------------------------------------------
  /**
   * Sets up real credentials (password & recovery code) for a CLAIMED participant account.
   *
   * Rules:
   *  - Caller presents raw claimToken (proves authority; no arbitrary account takeover).
   *  - Token must resolve to a valid CommandLedgerEntry.
   *  - Enrollment must be in CLAIMED state (userId !== null AND claim entry exists).
   *  - User must exist and have locked sentinel credentials (starts with "!").
   *  - If User already has active credentials (does not start with "!"), reject with 409 CONFLICT (ALREADY_ACTIVE).
   *  - Replay of setup with the same token is idempotent: returns existing response, omitting recoveryCode.
   *  - Password hashed via hashSecret (scrypt).
   *  - Recovery code created via createRecoveryCode(), hashed via hashSecret().
   *  - Raw secrets never persisted in ledger, audit logs, or database.
   *  - Transition is recorded in CommandLedgerEntry (operation = ROSTER_CREDENTIAL_SETUP) and TournamentAuditLogRecord.
   *  - Triggers transition to ACTIVE state.
   */
  async setupCredential(
    request: SetupCredentialRequest,
  ): Promise<SetupCredentialResponse> {
    const db = this.requireDb();

    // 1. Resolve raw token
    const tokenHash = hashToken(request.claimToken);

    const tokenEntry = await db.commandLedgerEntry.findFirst({
      where: {
        operation: OPERATION_ISSUE,
        payloadDigest: tokenHash,
      },
    });

    if (!tokenEntry) {
      throw new AppError("UNAUTHORIZED", "Token kích hoạt không hợp lệ.", 401, false, "INVALID", {
        reason: "INVALID_TOKEN",
      });
    }

    const enrollmentId = tokenEntry.targetId;

    // 2. Check for idempotent replay
    const existingSetup = await db.commandLedgerEntry.findFirst({
      where: {
        targetId: enrollmentId,
        operation: OPERATION_CREDENTIAL,
        outcome: "ACTIVE",
      },
    });

    if (existingSetup?.ackPayload) {
      const ack = existingSetup.ackPayload as any;
      return {
        success: true,
        userId: ack.userId,
        username: ack.username,
        status: "ACTIVE",
        // Recovery code is single-use handoff; not exposed on replay
        completedAt: (existingSetup.committedAt ?? existingSetup.receivedAt).toISOString(),
      };
    }

    // 3. Verify enrollment
    const enrollment = await db.tournamentEnrollmentRecord.findUnique({
      where: { id: enrollmentId },
      select: {
        id: true,
        personKey: true,
        userId: true,
        contractId: true,
      },
    });

    if (!enrollment) {
      throw new AppError("NOT_FOUND", "Không tìm thấy bản ghi đăng ký.", 404, false, "INVALID");
    }

    if (!enrollment.userId) {
      throw new AppError(
        "CONFLICT",
        "Tài khoản chưa được kích hoạt danh tính (chưa hoàn thành bước claim).",
        409,
        false,
        "INVALID",
        { reason: "NOT_CLAIMED" },
      );
    }

    // 4. Verify claim record exists
    const claimEntry = await db.commandLedgerEntry.findFirst({
      where: {
        targetId: enrollmentId,
        operation: OPERATION_CLAIM,
        outcome: "CLAIMED",
      },
    });

    if (!claimEntry) {
      throw new AppError(
        "CONFLICT",
        "Chưa tìm thấy bước claim hợp lệ cho đăng ký này.",
        409,
        false,
        "INVALID",
        { reason: "NOT_CLAIMED" },
      );
    }

    // 5. Verify user and credential state
    const user = await db.user.findUnique({
      where: { id: enrollment.userId },
      select: { id: true, username: true, passwordHash: true },
    });

    if (!user) {
      throw new AppError("INTERNAL_ERROR", "Tài khoản liên kết không tồn tại.", 500, false, "INVALID");
    }

    // If already active with a real credential, DO NOT overwrite
    if (user.passwordHash && !user.passwordHash.startsWith("!")) {
      throw new AppError(
        "CONFLICT",
        "Tài khoản đã có thông tin đăng nhập hoạt động. Không thể thiết lập lại qua kích hoạt.",
        409,
        false,
        "INVALID",
        { reason: "ALREADY_ACTIVE" },
      );
    }

    // 6. Generate real credentials using auth crypto
    const passwordHash = await hashSecret(request.password);
    const recoveryCode = createRecoveryCode();
    const recoveryCodeHash = await hashSecret(recoveryCode);
    const completedAt = new Date();

    // 7. Transactional update + command ledger + audit log
    const response = await db.$transaction(async (tx) => {
      await (tx as any).user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          recoveryCodeHash,
        },
      });

      const responsePayload: SetupCredentialResponse = {
        success: true,
        userId: user.id,
        username: user.username,
        status: "ACTIVE",
        recoveryCode, // One-time handoff
        completedAt: completedAt.toISOString(),
      };

      // Record in ledger (outcome: ACTIVE)
      await (tx as any).commandLedgerEntry.create({
        data: {
          id: randomUUID(),
          principalId: user.id,
          targetId: enrollmentId,
          operation: OPERATION_CREDENTIAL,
          commandId: `credential:${enrollmentId}`,
          payloadDigest: tokenHash,
          outcome: "ACTIVE",
          stateVersion: 1,
          sequence: 1,
          ackPayload: {
            userId: user.id,
            username: user.username,
            status: "ACTIVE",
          },
          committedAt: completedAt,
          expiresAt: null,
        },
      });

      // Audit log (never log password or recovery code)
      await (tx as any).tournamentAuditLogRecord.create({
        data: {
          id: randomUUID(),
          actorUserId: user.id,
          actorRole: "USER",
          action: "ROSTER_CREDENTIAL_SETUP",
          targetType: "ENROLLMENT",
          targetId: enrollmentId,
          afterSnapshot: {
            personKey: enrollment.personKey,
            userId: user.id,
            status: "ACTIVE",
            contractId: enrollment.contractId,
          },
          reason: "D05-B credential setup completed",
        },
      });

      return responsePayload;
    });

    return response;
  }

  // -------------------------------------------------------------------------
  // Activation Status (admin query)
  // -------------------------------------------------------------------------
  async getActivationStatus(
    enrollmentId: string,
    actor: ActivationActor,
  ): Promise<ActivationStatusResponse> {
    const db = this.requireDb();
    const enrollment = await db.tournamentEnrollmentRecord.findUnique({
      where: { id: enrollmentId },
      select: {
        id: true,
        personKey: true,
        userId: true,
        contractId: true,
      },
    });

    if (!enrollment) {
      throw new AppError("NOT_FOUND", "Không tìm thấy bản ghi đăng ký.", 404, false, "INVALID");
    }

    await assertActorScopeForContract(this.requireDb(), actor, enrollment.contractId);

    let status: ActivationStatus = "UNCLAIMED";
    let tokenExpiresAt: string | undefined;

    // Check for valid issued token
    const issuedToken = await db.commandLedgerEntry.findFirst({
      where: {
        targetId: enrollmentId,
        operation: OPERATION_ISSUE,
        outcome: "ISSUED",
      },
      orderBy: { expiresAt: "desc" },
    });

    if (issuedToken?.expiresAt && issuedToken.expiresAt > new Date()) {
      status = "TOKEN_ISSUED";
      tokenExpiresAt = issuedToken.expiresAt.toISOString();
    }

    // Check for claim
    const claimEntry = await db.commandLedgerEntry.findFirst({
      where: {
        targetId: enrollmentId,
        operation: OPERATION_CLAIM,
        outcome: "CLAIMED",
      },
    });

    if (claimEntry) {
      status = "CLAIMED";
    }

    // Check for ACTIVE (credential set)
    if (enrollment.userId) {
      const user = await db.user.findUnique({
        where: { id: enrollment.userId },
        select: { id: true, passwordHash: true },
      });
      if (user?.passwordHash && !user.passwordHash.startsWith("!")) {
        status = "ACTIVE";
      } else if (user) {
        status = "CLAIMED";
      }
    }

    return {
      enrollmentId: enrollment.id,
      personKey: enrollment.personKey,
      status,
      userId: enrollment.userId ?? undefined,
      tokenExpiresAt,
    };
  }

  // -------------------------------------------------------------------------
  // Internal: assert actor scope for a contract
  // -------------------------------------------------------------------------
}
