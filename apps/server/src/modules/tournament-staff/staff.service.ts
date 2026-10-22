import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  CANDIDATE_POLICY_DEFAULTS_V1,
  CreateStaffInvitationInputSchema,
  StaffInvitationHandoffSchema,
  StaffInvitationDecisionSchema,
  StaffInvitationRecipientViewSchema,
  StaffInvitationViewSchema,
  StaffExpiryResultSchema,
  StaffReadinessSchema,
  StaffRevokeResultSchema,
  type StaffInvitationHandoff,
  type StaffInvitationDecision,
  type StaffInvitationRecipientView,
  type StaffInvitationView,
  type StaffExpiryResult,
  type StaffReadiness,
  type StaffRevokeResult,
} from "@ottv2/contracts";
import { AppError } from "../../shared/errors/app-error.js";

export type TournamentStaffActor = { userId: string };
export type StaffInvitationTokenInput = { tournamentId: string; token: string };

type StaffServiceOptions = {
  /** Candidate policy only; G0/G1 may replace this through configuration. */
  invitationTtlHours?: number;
  now?: () => Date;
};

const INVITATION_PURPOSE = "TOURNAMENT_STAFF_INVITE" as const;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function fail(code: ConstructorParameters<typeof AppError>[0], message: string, statusCode: number, details: Record<string, unknown> = {}): never {
  throw new AppError(code, message, statusCode, false, statusCode >= 500 ? "RECOVERABLE" : "INVALID", details);
}

export class TournamentStaffService {
  private readonly now: () => Date;
  private readonly invitationTtlHours: number;

  constructor(private readonly db: PrismaClient, options: StaffServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.invitationTtlHours = options.invitationTtlHours ?? CANDIDATE_POLICY_DEFAULTS_V1.invitationTtlHours;
    if (!Number.isFinite(this.invitationTtlHours) || this.invitationTtlHours <= 0) {
      throw new Error("invitationTtlHours must be a positive configured value");
    }
  }

  private async assertOwnerScope(actor: TournamentStaffActor, tournamentId: string) {
    const tournament = await this.db.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        contractId: true,
        ownerTaUserId: true,
        contract: { select: { taBindings: { where: { userId: actor.userId, status: "ACTIVE" }, select: { id: true } } } },
      },
    });
    if (!tournament) fail("NOT_FOUND", "Không tìm thấy giải đấu.", 404, { reason: "RESOURCE_NOT_FOUND", tournamentId });
    if (tournament.ownerTaUserId !== actor.userId || tournament.contract.taBindings.length === 0) {
      fail("UNAUTHORIZED", "Bạn không có quyền quản trị nhân sự của giải đấu này.", 403, { reason: "FORBIDDEN_SCOPE", tournamentId });
    }
    return tournament;
  }

  async assertOwnerForRoute(actor: TournamentStaffActor, tournamentId: string): Promise<void> {
    await this.assertOwnerScope(actor, tournamentId);
  }

  private async recipient(userId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { id: true, username: true, displayName: true } });
    if (!user) fail("NOT_FOUND", "Không tìm thấy tài khoản nhận lời mời.", 404, { reason: "RECIPIENT_NOT_FOUND", recipientUserId: userId });
    return user;
  }

  private view(invitation: any, user: { id: string; username: string; displayName: string }, assignmentId: string | null): StaffInvitationView {
    return StaffInvitationViewSchema.parse({
      id: invitation.id,
      tournamentId: invitation.tournamentId,
      contractId: invitation.contractId,
      recipientUserId: invitation.recipientUserId,
      recipientUsername: user.username,
      recipientDisplayName: user.displayName,
      role: invitation.role,
      purpose: INVITATION_PURPOSE,
      status: invitation.status === "INVITED" && invitation.expiresAt <= this.now() ? "EXPIRED" : invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      inviterUserId: invitation.inviterUserId,
      assignmentId,
      createdAt: invitation.createdAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
      declinedAt: invitation.declinedAt?.toISOString() ?? null,
      revokedAt: invitation.revokedAt?.toISOString() ?? null,
    });
  }

  private recipientView(invitation: any, tournament: { id: string; tournamentCode: string }): StaffInvitationRecipientView {
    return StaffInvitationRecipientViewSchema.parse({
      id: invitation.id,
      tournamentId: tournament.id,
      tournamentCode: tournament.tournamentCode,
      role: invitation.role,
      purpose: INVITATION_PURPOSE,
      status: invitation.status === "INVITED" && invitation.expiresAt <= this.now() ? "EXPIRED" : invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
      declinedAt: invitation.declinedAt?.toISOString() ?? null,
    });
  }

  private async findRecipientInvitation(actor: TournamentStaffActor, input: StaffInvitationTokenInput, tx: any = this.db) {
    if (!input.token || input.token.length < 32) fail("UNAUTHORIZED", "Invitation token không hợp lệ.", 401, { reason: "INVALID_INVITATION_TOKEN" });
    const invitation = await tx.tournamentStaffInvitation.findFirst({
      where: { tournamentId: input.tournamentId, tokenHash: hashToken(input.token) },
    });
    if (!invitation) fail("UNAUTHORIZED", "Invitation token không hợp lệ.", 401, { reason: "INVALID_INVITATION_TOKEN" });
    const tournament = await tx.tournament.findUnique({
      where: { id: input.tournamentId },
      select: { id: true, tournamentCode: true, contractId: true },
    });
    if (!tournament || invitation.contractId !== tournament.contractId) {
      fail("UNAUTHORIZED", "Invitation không thuộc scope hợp lệ.", 403, { reason: "INVITATION_SCOPE_MISMATCH" });
    }
    if (invitation.recipientUserId !== actor.userId) {
      fail("UNAUTHORIZED", "Invitation không dành cho tài khoản này.", 403, { reason: "INVITATION_RECIPIENT_MISMATCH" });
    }
    return { invitation, tournament };
  }

  async viewRecipient(actor: TournamentStaffActor, input: StaffInvitationTokenInput): Promise<StaffInvitationRecipientView> {
    const { invitation, tournament } = await this.findRecipientInvitation(actor, input);
    return this.recipientView(invitation, tournament);
  }

  private assertActionable(invitation: any, action: "ACCEPT" | "REJECT"): void {
    if (invitation.status === "INVITED" && invitation.expiresAt > this.now()) return;
    if (invitation.status === "ACTIVE" && action === "ACCEPT") return;
    if (invitation.status === "DECLINED" && action === "REJECT") return;
    if (invitation.status === "INVITED" && invitation.expiresAt <= this.now()) {
      fail("CONFLICT", "Invitation đã hết hạn.", 409, { reason: "INVITATION_EXPIRED" });
    }
    fail("CONFLICT", "Invitation không còn ở trạng thái có thể xử lý.", 409, { reason: "INVITATION_STATE_CONFLICT", status: invitation.status });
  }

  private async decide(actor: TournamentStaffActor, input: StaffInvitationTokenInput, action: "ACCEPT" | "REJECT"): Promise<StaffInvitationDecision> {
    const result = await this.db.$transaction(async (tx) => {
      const { invitation, tournament } = await this.findRecipientInvitation(actor, input, tx);
      this.assertActionable(invitation, action);
      if ((action === "ACCEPT" && invitation.status === "ACTIVE") || (action === "REJECT" && invitation.status === "DECLINED")) {
        return { invitation, tournament, replayed: true };
      }
      const assignment = await tx.tournamentStaffAssignmentRecord.findFirst({ where: { invitationId: invitation.id } });
      if (!assignment || assignment.tournamentId !== invitation.tournamentId || assignment.userId !== invitation.recipientUserId || assignment.role !== invitation.role) {
        fail("CONFLICT", "Staff assignment không nhất quán với invitation.", 409, { reason: "ASSIGNMENT_MISMATCH" });
      }
      const timestamp = this.now();
      const nextStatus = action === "ACCEPT" ? "ACTIVE" : "DECLINED";
      const invitationUpdate = await tx.tournamentStaffInvitation.update({
        where: { id: invitation.id },
        data: action === "ACCEPT" ? { status: "ACTIVE", acceptedAt: timestamp } : { status: "DECLINED", declinedAt: timestamp },
      });
      await tx.tournamentStaffAssignmentRecord.update({
        where: { id: assignment.id },
        data: { status: nextStatus },
      });
      await tx.tournamentAuditLogRecord.create({
        data: {
          id: randomUUID(),
          actorUserId: actor.userId,
          actorRole: "USER",
          action: action === "ACCEPT" ? "STAFF_INVITATION_ACCEPTED" : "STAFF_INVITATION_DECLINED",
          targetType: "STAFF",
          targetId: invitation.id,
          afterSnapshot: { tournamentId: invitation.tournamentId, contractId: invitation.contractId, role: invitation.role, status: nextStatus, assignmentId: assignment.id },
          reason: `D06-B staff invitation ${action.toLowerCase()}`,
        },
      });
      return { invitation: invitationUpdate, tournament, replayed: false };
    });
    return StaffInvitationDecisionSchema.parse({ invitation: this.recipientView(result.invitation, result.tournament), replayed: result.replayed });
  }

  acceptInvitation(actor: TournamentStaffActor, input: StaffInvitationTokenInput): Promise<StaffInvitationDecision> {
    return this.decide(actor, input, "ACCEPT");
  }

  rejectInvitation(actor: TournamentStaffActor, input: StaffInvitationTokenInput): Promise<StaffInvitationDecision> {
    return this.decide(actor, input, "REJECT");
  }

  async revokeAssignment(actor: TournamentStaffActor, tournamentId: string, assignmentId: string): Promise<StaffRevokeResult> {
    await this.assertOwnerScope(actor, tournamentId);
    const result = await this.db.$transaction(async (tx) => {
      const assignment = await tx.tournamentStaffAssignmentRecord.findUnique({ where: { id: assignmentId } });
      if (!assignment || assignment.tournamentId !== tournamentId) {
        fail("NOT_FOUND", "Không tìm thấy staff assignment trong tournament này.", 404, { reason: "ASSIGNMENT_NOT_FOUND", tournamentId, assignmentId });
      }
      const invitation = assignment.invitationId
        ? await tx.tournamentStaffInvitation.findUnique({ where: { id: assignment.invitationId } })
        : null;
      if (assignment.status === "REVOKED" && (!invitation || invitation.status === "REVOKED")) {
        return { assignment, invitation, revokedAt: invitation?.revokedAt ?? assignment.updatedAt ?? this.now(), replayed: true };
      }
      if (!["INVITED", "ACTIVE"].includes(assignment.status)) {
        fail("CONFLICT", "Assignment không ở trạng thái có thể revoke.", 409, { reason: "ASSIGNMENT_STATE_CONFLICT", status: assignment.status });
      }
      const revokedAt = this.now();
      const assignmentUpdate = await tx.tournamentStaffAssignmentRecord.updateMany({
        where: { id: assignment.id, tournamentId, status: { in: ["INVITED", "ACTIVE"] } },
        data: { status: "REVOKED" },
      });
      if (assignmentUpdate.count !== 1) {
        const current = await tx.tournamentStaffAssignmentRecord.findUnique({ where: { id: assignment.id } });
        if (current?.status === "REVOKED") return { assignment: current, invitation, revokedAt, replayed: true };
        fail("CONFLICT", "Assignment đã thay đổi trong lúc revoke.", 409, { reason: "STAFF_ASSIGNMENT_RACE" });
      }
      let updatedInvitation = invitation;
      if (invitation && ["INVITED", "ACTIVE"].includes(invitation.status)) {
        const invitationUpdate = await tx.tournamentStaffInvitation.updateMany({
          where: { id: invitation.id, status: { in: ["INVITED", "ACTIVE"] } },
          data: { status: "REVOKED", revokedAt },
        });
        if (invitationUpdate.count !== 1) {
          const currentInvitation = await tx.tournamentStaffInvitation.findUnique({ where: { id: invitation.id } });
          if (currentInvitation?.status === "REVOKED") updatedInvitation = currentInvitation;
          else fail("CONFLICT", "Invitation đã thay đổi trong lúc revoke.", 409, { reason: "STAFF_INVITATION_RACE" });
        } else {
          updatedInvitation = { ...invitation, status: "REVOKED", revokedAt };
        }
      }
      await tx.tournamentAuditLogRecord.create({
        data: {
          id: randomUUID(), actorUserId: actor.userId, actorRole: "TOURNAMENT_ADMIN",
          action: "STAFF_ASSIGNMENT_REVOKED", targetType: "STAFF", targetId: assignment.id,
          afterSnapshot: { tournamentId, assignmentId: assignment.id, invitationId: invitation?.id ?? null, userId: assignment.userId, role: assignment.role, status: "REVOKED", revokedAt: revokedAt.toISOString() },
          reason: "D06-C staff assignment revoked",
        },
      });
      return { assignment: { ...assignment, status: "REVOKED" }, invitation: updatedInvitation, revokedAt, replayed: false };
    });
    return StaffRevokeResultSchema.parse({
      tournamentId,
      assignmentId,
      invitationId: result.invitation?.id ?? null,
      userId: result.assignment.userId,
      role: result.assignment.role,
      status: "REVOKED",
      revokedAt: result.revokedAt.toISOString(),
      replayed: result.replayed,
    });
  }

  async expirePendingInvitations(actor: TournamentStaffActor, tournamentId: string): Promise<StaffExpiryResult> {
    await this.assertOwnerScope(actor, tournamentId);
    const now = this.now();
    const expiredIds = await this.db.$transaction(async (tx) => {
      const candidates = await tx.tournamentStaffInvitation.findMany({
        where: { tournamentId, status: "INVITED", expiresAt: { lte: now } },
        select: { id: true },
      });
      const changed: string[] = [];
      for (const candidate of candidates) {
        const update = await tx.tournamentStaffInvitation.updateMany({
          where: { id: candidate.id, tournamentId, status: "INVITED", expiresAt: { lte: now } },
          data: { status: "EXPIRED" },
        });
        if (update.count !== 1) continue;
        changed.push(candidate.id);
        await tx.tournamentAuditLogRecord.create({
          data: {
            id: randomUUID(), actorUserId: actor.userId, actorRole: "TOURNAMENT_ADMIN",
            action: "STAFF_INVITATION_EXPIRED", targetType: "STAFF", targetId: candidate.id,
            afterSnapshot: { tournamentId, invitationId: candidate.id, status: "EXPIRED" },
            reason: "D06-C pending staff invitation expiry",
          },
        });
      }
      return changed;
    });
    return StaffExpiryResultSchema.parse({ tournamentId, expiredInvitationIds: expiredIds });
  }

  async getRefereeReadiness(tournamentId: string, expectedContractId?: string): Promise<StaffReadiness> {
    const tournament = await this.db.tournament.findUnique({ where: { id: tournamentId }, select: { id: true, contractId: true } });
    if (!tournament) fail("NOT_FOUND", "Không tìm thấy giải đấu.", 404, { reason: "RESOURCE_NOT_FOUND", tournamentId });
    if (expectedContractId && expectedContractId !== tournament.contractId) {
      fail("UNAUTHORIZED", "Tournament không thuộc contract scope yêu cầu.", 403, { reason: "CONTRACT_SCOPE_MISMATCH", tournamentId });
    }
    const records = await this.db.tournamentStaffAssignmentRecord.findMany({
      where: { tournamentId, status: "ACTIVE" },
      select: { role: true },
    });
    const activeRefereeCount = records.filter((record: { role: string }) => record.role === "REFEREE").length;
    return StaffReadinessSchema.parse({ tournamentId, contractId: tournament.contractId, activeRefereeCount, hasAcceptedReferee: activeRefereeCount > 0 });
  }

  async list(actor: TournamentStaffActor, tournamentId: string): Promise<{ invitations: StaffInvitationView[]; assignments: Array<{ id: string; tournamentId: string; userId: string; role: string; status: string; assignedRooms: unknown }> }> {
    await this.assertOwnerScope(actor, tournamentId);
    const [invitations, assignments] = await Promise.all([
      this.db.tournamentStaffInvitation.findMany({ where: { tournamentId }, orderBy: { createdAt: "desc" } }),
      this.db.tournamentStaffAssignmentRecord.findMany({ where: { tournamentId }, orderBy: { createdAt: "desc" } }),
    ]);
    const users = new Map((await Promise.all([...new Set(invitations.map((i: any) => i.recipientUserId)), ...assignments.map((a: any) => a.userId)].map((id) => this.recipient(id)))).map((u) => [u.id, u]));
    return {
      invitations: invitations.map((invitation: any) => this.view(invitation, users.get(invitation.recipientUserId)!, assignments.find((a: any) => a.invitationId === invitation.id)?.id ?? null)),
      assignments: assignments.map((assignment: any) => ({ id: assignment.id, tournamentId: assignment.tournamentId, userId: assignment.userId, role: assignment.role, status: assignment.status, assignedRooms: assignment.assignedRooms ?? [] })),
    };
  }

  async createInvitation(actor: TournamentStaffActor, tournamentId: string, rawInput: unknown): Promise<StaffInvitationHandoff> {
    const input = CreateStaffInvitationInputSchema.safeParse(rawInput);
    if (!input.success) fail("VALIDATION_ERROR", input.error.issues[0]?.message ?? "Dữ liệu lời mời không hợp lệ.", 400, { reason: "SCHEMA_VALIDATION_FAILED" });
    const tournament = await this.assertOwnerScope(actor, tournamentId);
    const user = await this.recipient(input.data.recipientUserId);
    const idempotencyKey = input.data.idempotencyKey ?? `staff:${input.data.recipientUserId}:${input.data.role}`;
    const existing = await this.db.tournamentStaffInvitation.findUnique({ where: { tournamentId_idempotencyKey: { tournamentId, idempotencyKey } } });
    if (existing) {
      const assignment = await this.db.tournamentStaffAssignmentRecord.findFirst({ where: { invitationId: existing.id }, select: { id: true } });
      return StaffInvitationHandoffSchema.parse({ invitation: this.view(existing, user, assignment?.id ?? null), rawToken: null, replayed: true });
    }

    const now = this.now();
    const expiresAt = new Date(now.getTime() + this.invitationTtlHours * 60 * 60 * 1000);
    const rawToken = generateToken();
    const invitationId = randomUUID();
    const assignmentId = randomUUID();
    try {
      const created = await this.db.$transaction(async (tx) => {
        const invitation = await (tx as any).tournamentStaffInvitation.create({ data: {
          id: invitationId, tournamentId, contractId: tournament.contractId, recipientUserId: user.id,
          role: input.data.role, purpose: INVITATION_PURPOSE, status: "INVITED", tokenHash: hashToken(rawToken),
          idempotencyKey, inviterUserId: actor.userId, expiresAt,
        } });
        const assignment = await (tx as any).tournamentStaffAssignmentRecord.create({ data: {
          id: assignmentId, tournamentId, userId: user.id, role: input.data.role, status: "INVITED", invitationId,
        } });
        await (tx as any).tournamentAuditLogRecord.create({ data: {
          id: randomUUID(), actorUserId: actor.userId, actorRole: "TOURNAMENT_ADMIN", action: "STAFF_INVITATION_CREATED",
          targetType: "STAFF", targetId: invitationId, afterSnapshot: {
            tournamentId, contractId: tournament.contractId, recipientUserId: user.id, role: input.data.role,
            purpose: INVITATION_PURPOSE, status: "INVITED", expiresAt: expiresAt.toISOString(), assignmentId,
          }, reason: "D06-A staff invitation created",
        } });
        return { invitation, assignment };
      });
      return StaffInvitationHandoffSchema.parse({ invitation: this.view(created.invitation, user, created.assignment.id), rawToken, replayed: false });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "P2002") {
        const retry = await this.db.tournamentStaffInvitation.findUnique({ where: { tournamentId_idempotencyKey: { tournamentId, idempotencyKey } } });
        if (retry) {
          const assignment = await this.db.tournamentStaffAssignmentRecord.findFirst({ where: { invitationId: retry.id }, select: { id: true } });
          return StaffInvitationHandoffSchema.parse({ invitation: this.view(retry, user, assignment?.id ?? null), rawToken: null, replayed: true });
        }
      }
      throw error;
    }
  }
}

export { hashToken as hashStaffInvitationToken };
