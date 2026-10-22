import { describe, expect, it } from "vitest";
import { TournamentStaffService, hashStaffInvitationToken } from "../../src/modules/tournament-staff/staff.service.js";

function fixture() {
  const users = new Map([
    ["owner", { id: "owner", username: "owner", displayName: "Owner" }],
    ["staff-1", { id: "staff-1", username: "referee.one", displayName: "Referee One" }],
  ]);
  const invitations: any[] = [];
  const assignments: any[] = [];
  const audits: any[] = [];
  const tournament = {
    id: "t-1", contractId: "c-1", ownerTaUserId: "owner",
    contract: { taBindings: [{ id: "binding-1" }] },
  };
  const db: any = {
    tournament: { findUnique: async () => tournament },
    user: { findUnique: async ({ where }: any) => users.get(where.id) ?? null },
    tournamentStaffInvitation: {
      findUnique: async ({ where }: any) => invitations.find((x) => x.tournamentId === where.tournamentId_idempotencyKey.tournamentId && x.idempotencyKey === where.tournamentId_idempotencyKey.idempotencyKey) ?? null,
      findMany: async () => [...invitations],
    },
    tournamentStaffAssignmentRecord: {
      findMany: async () => [...assignments],
      findFirst: async ({ where }: any) => assignments.find((x) => x.invitationId === where.invitationId) ?? null,
    },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => fn({
      tournamentStaffInvitation: { create: async ({ data }: any) => (invitations.push({ ...data, createdAt: new Date("2026-01-01T00:00:00.000Z"), acceptedAt: null, declinedAt: null, revokedAt: null }), invitations.at(-1)) },
      tournamentStaffAssignmentRecord: { create: async ({ data }: any) => (assignments.push({ ...data, createdAt: new Date("2026-01-01T00:00:00.000Z"), assignedRooms: null }), assignments.at(-1)) },
      tournamentAuditLogRecord: { create: async ({ data }: any) => (audits.push(data), data) },
    }),
  };
  return { db, invitations, assignments, audits };
}

describe("D06-A tournament staff foundation", () => {
  const now = () => new Date("2026-01-01T00:00:00.000Z");

  it("allows scoped owner creation/listing and returns a one-time raw token", async () => {
    const f = fixture();
    const service = new TournamentStaffService(f.db, { now, invitationTtlHours: 2 });
    const handoff = await service.createInvitation({ userId: "owner" }, "t-1", { recipientUserId: "staff-1", role: "REFEREE" });
    expect(handoff.rawToken).toMatch(/^[0-9a-f]{64}$/);
    expect(f.invitations).toHaveLength(1);
    expect(f.invitations[0].tokenHash).toBe(hashStaffInvitationToken(handoff.rawToken!));
    expect(f.invitations[0].expiresAt.toISOString()).toBe("2026-01-01T02:00:00.000Z");
    expect(f.assignments[0].status).toBe("INVITED");
    expect(f.audits[0].afterSnapshot).not.toHaveProperty("rawToken");
    const listed = await service.list({ userId: "owner" }, "t-1");
    expect(listed.invitations[0]?.recipientUserId).toBe("staff-1");
  });

  it("is idempotent, preserves role, and never activates before acceptance", async () => {
    const f = fixture();
    const service = new TournamentStaffService(f.db, { now });
    const first = await service.createInvitation({ userId: "owner" }, "t-1", { recipientUserId: "staff-1", role: "STAFF", idempotencyKey: "retry-1" });
    const second = await service.createInvitation({ userId: "owner" }, "t-1", { recipientUserId: "staff-1", role: "STAFF", idempotencyKey: "retry-1" });
    expect(second.replayed).toBe(true);
    expect(second.rawToken).toBeNull();
    expect(f.invitations).toHaveLength(1);
    expect(f.invitations[0].role).toBe("STAFF");
    expect(f.assignments[0].status).toBe("INVITED");
    expect(first.invitation.assignmentId).toBe(f.assignments[0].id);
  });

  it("rejects out-of-scope owners, invalid recipients, and invalid roles", async () => {
    const f = fixture();
    const service = new TournamentStaffService(f.db, { now });
    await expect(service.createInvitation({ userId: "other" }, "t-1", { recipientUserId: "staff-1", role: "STAFF" })).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.createInvitation({ userId: "owner" }, "t-1", { recipientUserId: "missing", role: "STAFF" })).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.createInvitation({ userId: "owner" }, "t-1", { recipientUserId: "staff-1", role: "ADMIN" })).rejects.toMatchObject({ statusCode: 400 });
  });
});

function decisionFixture(status = "INVITED") {
  const rawToken = "a".repeat(64);
  const invitation: any = {
    id: "i-1", tournamentId: "t-1", contractId: "c-1", recipientUserId: "staff-1", role: "REFEREE",
    purpose: "TOURNAMENT_STAFF_INVITE", status, tokenHash: hashStaffInvitationToken(rawToken),
    expiresAt: new Date("2026-01-02T00:00:00.000Z"), createdAt: new Date("2026-01-01T00:00:00.000Z"),
    acceptedAt: status === "ACTIVE" ? new Date("2026-01-01T01:00:00.000Z") : null,
    declinedAt: status === "DECLINED" ? new Date("2026-01-01T01:00:00.000Z") : null, revokedAt: null,
  };
  const assignment: any = { id: "a-1", invitationId: "i-1", tournamentId: "t-1", userId: "staff-1", role: "REFEREE", status: status === "ACTIVE" ? "ACTIVE" : status === "DECLINED" ? "DECLINED" : "INVITED" };
  const audits: any[] = [];
  let transactionCalls = 0;
  const db: any = {
    tournamentStaffInvitation: {
      findFirst: async ({ where }: any) => where.tournamentId === invitation.tournamentId && where.tokenHash === invitation.tokenHash ? invitation : null,
      update: async ({ data }: any) => Object.assign(invitation, data),
    },
    tournament: { findUnique: async () => ({ id: "t-1", tournamentCode: "CUP-1", contractId: "c-1" }) },
    tournamentStaffAssignmentRecord: {
      findFirst: async () => assignment,
      update: async ({ data }: any) => Object.assign(assignment, data),
    },
    tournamentAuditLogRecord: { create: async ({ data }: any) => (audits.push(data), data) },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => {
      transactionCalls += 1;
      return fn(db);
    },
  };
  return { db, rawToken, invitation, assignment, audits, get transactionCalls() { return transactionCalls; } };
}

describe("D06-B recipient invitation flow", () => {
  const now = () => new Date("2026-01-01T02:00:00.000Z");

  it("views only a valid recipient invitation and rejects another user or token", async () => {
    const f = decisionFixture();
    const service = new TournamentStaffService(f.db, { now });
    const view = await service.viewRecipient({ userId: "staff-1" }, { tournamentId: "t-1", token: f.rawToken });
    expect(view).toMatchObject({ id: "i-1", tournamentCode: "CUP-1", role: "REFEREE", status: "INVITED" });
    expect(view).not.toHaveProperty("tokenHash");
    await expect(service.viewRecipient({ userId: "other" }, { tournamentId: "t-1", token: f.rawToken })).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.viewRecipient({ userId: "staff-1" }, { tournamentId: "t-1", token: "b".repeat(64) })).rejects.toMatchObject({ statusCode: 401 });
  });

  it("accepts atomically, activates only the linked assignment, and is idempotent", async () => {
    const f = decisionFixture();
    const service = new TournamentStaffService(f.db, { now });
    const accepted = await service.acceptInvitation({ userId: "staff-1" }, { tournamentId: "t-1", token: f.rawToken });
    expect(accepted.invitation.status).toBe("ACTIVE");
    expect(f.assignment.status).toBe("ACTIVE");
    expect(f.invitation.acceptedAt).toEqual(now());
    expect(f.audits[0].afterSnapshot).not.toHaveProperty("token");
    expect(f.audits[0].afterSnapshot).not.toHaveProperty("tokenHash");
    expect(f.transactionCalls).toBe(1);
    const replay = await service.acceptInvitation({ userId: "staff-1" }, { tournamentId: "t-1", token: f.rawToken });
    expect(replay.replayed).toBe(true);
    expect(f.assignment.status).toBe("ACTIVE");
  });

  it("rejects atomically, is idempotent, and blocks opposite transitions", async () => {
    const f = decisionFixture();
    const service = new TournamentStaffService(f.db, { now });
    const declined = await service.rejectInvitation({ userId: "staff-1" }, { tournamentId: "t-1", token: f.rawToken });
    expect(declined.invitation.status).toBe("DECLINED");
    expect(f.assignment.status).toBe("DECLINED");
    expect((await service.rejectInvitation({ userId: "staff-1" }, { tournamentId: "t-1", token: f.rawToken })).replayed).toBe(true);
    await expect(service.acceptInvitation({ userId: "staff-1" }, { tournamentId: "t-1", token: f.rawToken })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects expired and cross-scope invitations without granting a role", async () => {
    const expired = decisionFixture();
    expired.invitation.expiresAt = new Date("2025-12-31T23:00:00.000Z");
    const service = new TournamentStaffService(expired.db, { now });
    await expect(service.acceptInvitation({ userId: "staff-1" }, { tournamentId: "t-1", token: expired.rawToken })).rejects.toMatchObject({ statusCode: 409 });
    expect(expired.assignment.status).toBe("INVITED");
    await expect(service.viewRecipient({ userId: "staff-1" }, { tournamentId: "other-tournament", token: expired.rawToken })).rejects.toMatchObject({ statusCode: 401 });
    const crossContract = decisionFixture();
    crossContract.db.tournament.findUnique = async () => ({ id: "t-1", tournamentCode: "CUP-1", contractId: "different-contract" });
    const crossContractService = new TournamentStaffService(crossContract.db, { now });
    await expect(crossContractService.viewRecipient({ userId: "staff-1" }, { tournamentId: "t-1", token: crossContract.rawToken })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects accept after an existing decline and reject after an existing acceptance", async () => {
    const declined = decisionFixture("DECLINED");
    const serviceDeclined = new TournamentStaffService(declined.db, { now });
    await expect(serviceDeclined.acceptInvitation({ userId: "staff-1" }, { tournamentId: "t-1", token: declined.rawToken })).rejects.toMatchObject({ statusCode: 409 });
    const accepted = decisionFixture("ACTIVE");
    const serviceAccepted = new TournamentStaffService(accepted.db, { now });
    await expect(serviceAccepted.rejectInvitation({ userId: "staff-1" }, { tournamentId: "t-1", token: accepted.rawToken })).rejects.toMatchObject({ statusCode: 409 });
  });
});

function lifecycleFixture({ assignmentStatus = "ACTIVE", invitationStatus = assignmentStatus, invitationExpiresAt = "2026-01-02T00:00:00.000Z", readinessRoles = ["REFEREE"] as string[] } = {}) {
  const rawToken = "c".repeat(64);
  const invitation: any = {
    id: "i-c", tournamentId: "t-1", contractId: "c-1", recipientUserId: "staff-1", role: "REFEREE",
    purpose: "TOURNAMENT_STAFF_INVITE", status: invitationStatus, tokenHash: hashStaffInvitationToken(rawToken),
    expiresAt: new Date(invitationExpiresAt), createdAt: new Date("2026-01-01T00:00:00.000Z"),
    acceptedAt: invitationStatus === "ACTIVE" ? new Date("2026-01-01T01:00:00.000Z") : null,
    declinedAt: invitationStatus === "DECLINED" ? new Date("2026-01-01T01:00:00.000Z") : null,
    revokedAt: invitationStatus === "REVOKED" ? new Date("2026-01-01T01:00:00.000Z") : null,
  };
  const assignment: any = { id: "a-c", invitationId: "i-c", tournamentId: "t-1", userId: "staff-1", role: "REFEREE", status: assignmentStatus, updatedAt: new Date("2026-01-01T00:00:00.000Z") };
  const unrelated = { id: "a-other", invitationId: null, tournamentId: "t-1", userId: "staff-2", role: "STAFF", status: "ACTIVE" };
  const audits: any[] = [];
  const tournament = { id: "t-1", tournamentCode: "CUP-1", contractId: "c-1", ownerTaUserId: "owner", contract: { taBindings: [{ id: "binding-1" }] } };
  const db: any = {
    tournament: { findUnique: async () => tournament },
    tournamentStaffInvitation: {
      findFirst: async ({ where }: any) => where.tokenHash === invitation.tokenHash && where.tournamentId === invitation.tournamentId ? invitation : null,
      findUnique: async ({ where }: any) => where.id === invitation.id ? invitation : null,
      findMany: async ({ where }: any) => where.status === "INVITED" && invitation.status === "INVITED" && invitation.expiresAt <= where.expiresAt.lte ? [invitation] : [],
      updateMany: async ({ where, data }: any) => {
        if (where.id !== invitation.id || (where.status && where.status.in && !where.status.in.includes(invitation.status)) || (where.status && typeof where.status === "string" && where.status !== invitation.status)) return { count: 0 };
        Object.assign(invitation, data);
        return { count: 1 };
      },
      update: async ({ data }: any) => Object.assign(invitation, data),
    },
    tournamentStaffAssignmentRecord: {
      findUnique: async ({ where }: any) => where.id === assignment.id ? assignment : null,
      findFirst: async ({ where }: any) => where.invitationId === invitation.id ? assignment : null,
      findMany: async ({ where }: any) => where.status === "ACTIVE" ? readinessRoles.map((role) => ({ role })) : [assignment, unrelated].filter((row) => row.status === where.status),
      updateMany: async ({ where, data }: any) => {
        if (where.id !== assignment.id || where.tournamentId !== assignment.tournamentId || (where.status?.in && !where.status.in.includes(assignment.status))) return { count: 0 };
        Object.assign(assignment, data);
        return { count: 1 };
      },
      update: async ({ data }: any) => Object.assign(assignment, data),
    },
    tournamentAuditLogRecord: { create: async ({ data }: any) => (audits.push(data), data) },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => fn(db),
  };
  return { db, rawToken, invitation, assignment, unrelated, audits, tournament };
}

describe("D06-C revoke, expiry, and readiness", () => {
  const now = () => new Date("2026-01-01T02:00:00.000Z");

  it("owner revokes active referee atomically and preserves identity/unrelated assignment", async () => {
    const f = lifecycleFixture();
    const service = new TournamentStaffService(f.db, { now });
    const result = await service.revokeAssignment({ userId: "owner" }, "t-1", "a-c");
    expect(result).toMatchObject({ assignmentId: "a-c", userId: "staff-1", role: "REFEREE", status: "REVOKED", replayed: false });
    expect(f.assignment.status).toBe("REVOKED");
    expect(f.invitation.status).toBe("REVOKED");
    expect(f.unrelated.status).toBe("ACTIVE");
    expect(f.audits[0].afterSnapshot).not.toHaveProperty("tokenHash");
    expect((await service.revokeAssignment({ userId: "owner" }, "t-1", "a-c")).replayed).toBe(true);
    await expect(service.acceptInvitation({ userId: "staff-1" }, { tournamentId: "t-1", token: f.rawToken })).rejects.toMatchObject({ statusCode: 409 });
    expect(f.assignment.status).toBe("REVOKED");
  });

  it("revokes a pending invitation without deleting the recipient identity", async () => {
    const f = lifecycleFixture({ assignmentStatus: "INVITED", invitationStatus: "INVITED" });
    const service = new TournamentStaffService(f.db, { now });
    const result = await service.revokeAssignment({ userId: "owner" }, "t-1", "a-c");
    expect(result.userId).toBe("staff-1");
    expect(f.assignment.status).toBe("REVOKED");
    expect(f.invitation.status).toBe("REVOKED");
  });

  it("rejects unauthorized, cross-tournament, and cross-contract revoke attempts", async () => {
    const f = lifecycleFixture();
    const service = new TournamentStaffService(f.db, { now });
    await expect(service.revokeAssignment({ userId: "other" }, "t-1", "a-c")).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.revokeAssignment({ userId: "owner" }, "other-tournament", "a-c")).rejects.toMatchObject({ statusCode: 404 });
    f.tournament.contractId = "different-contract";
    f.tournament.contract.taBindings = [];
    await expect(service.revokeAssignment({ userId: "owner" }, "t-1", "a-c")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("expires only pending invitations and prevents later acceptance", async () => {
    const f = lifecycleFixture({ assignmentStatus: "INVITED", invitationStatus: "INVITED", invitationExpiresAt: "2026-01-01T01:00:00.000Z" });
    const service = new TournamentStaffService(f.db, { now });
    const expired = await service.expirePendingInvitations({ userId: "owner" }, "t-1");
    expect(expired.expiredInvitationIds).toEqual(["i-c"]);
    expect(f.invitation.status).toBe("EXPIRED");
    expect(f.assignment.status).toBe("INVITED");
    await expect(service.acceptInvitation({ userId: "staff-1" }, { tournamentId: "t-1", token: f.rawToken })).rejects.toMatchObject({ statusCode: 409 });
    expect((await service.expirePendingInvitations({ userId: "owner" }, "t-1")).expiredInvitationIds).toEqual([]);
  });

  it("does not deactivate an already accepted active assignment when expiry is later passed", async () => {
    const f = lifecycleFixture({ assignmentStatus: "ACTIVE", invitationStatus: "ACTIVE", invitationExpiresAt: "2025-12-31T01:00:00.000Z" });
    const service = new TournamentStaffService(f.db, { now });
    expect((await service.expirePendingInvitations({ userId: "owner" }, "t-1")).expiredInvitationIds).toEqual([]);
    expect(f.invitation.status).toBe("ACTIVE");
    expect(f.assignment.status).toBe("ACTIVE");
  });

  it("reports only active referees for the correct tournament contract", async () => {
    const referee = new TournamentStaffService(lifecycleFixture({ readinessRoles: ["REFEREE", "STAFF"] }).db, { now });
    await expect(referee.getRefereeReadiness("t-1", "c-1")).resolves.toMatchObject({ activeRefereeCount: 1, hasAcceptedReferee: true });
    const invited = new TournamentStaffService(lifecycleFixture({ assignmentStatus: "INVITED", invitationStatus: "INVITED", readinessRoles: [] }).db, { now });
    await expect(invited.getRefereeReadiness("t-1")).resolves.toMatchObject({ activeRefereeCount: 0, hasAcceptedReferee: false });
    const declined = new TournamentStaffService(lifecycleFixture({ assignmentStatus: "DECLINED", invitationStatus: "DECLINED", readinessRoles: [] }).db, { now });
    await expect(declined.getRefereeReadiness("t-1")).resolves.toMatchObject({ activeRefereeCount: 0, hasAcceptedReferee: false });
    const revoked = new TournamentStaffService(lifecycleFixture({ assignmentStatus: "REVOKED", invitationStatus: "REVOKED", readinessRoles: [] }).db, { now });
    await expect(revoked.getRefereeReadiness("t-1")).resolves.toMatchObject({ activeRefereeCount: 0, hasAcceptedReferee: false });
    const staff = new TournamentStaffService(lifecycleFixture({ readinessRoles: ["STAFF"] }).db, { now });
    await expect(staff.getRefereeReadiness("t-1")).resolves.toMatchObject({ activeRefereeCount: 0, hasAcceptedReferee: false });
    await expect(referee.getRefereeReadiness("t-1", "other-contract")).rejects.toMatchObject({ statusCode: 403 });
  });
});
