import type { FastifyInstance } from "fastify";
import {
  AdmissionCheckInputSchema,
  type AdmissionCheckInput,
  type ApprovalDecisionInput,
  type CreateTournamentChangeRequestInput,
  type CreateTournamentDraftInput,
  type PatchTournamentDraftInput,
  type PublishWithinEnvelopeRuleUpdateInput,
  type SubmitManualAdjudicationVerdictInput,
  type SubmitTournamentDraftInput,
} from "@ottv2/contracts";
import type { AuthService } from "../auth/auth.service.js";
import { resolveTournamentRequestActor } from "../tournament-foundation/foundation.route.js";
import {
  assertAdminActor,
  createTournamentError,
  type TournamentActorContext,
  type TournamentStateStore,
} from "../tournament-foundation/tournament-store.js";
import type { AdjudicationLedgerService } from "./adjudication-ledger.service.js";
import type { AdmissionGateService } from "./admission-gate.service.js";
import type { ApprovalService } from "./approval.service.js";
import type { CoreDraftService } from "./core-draft.service.js";
import type { TournamentLifecycleService } from "./lifecycle.service.js";

const UNAPPROVED_STATUSES = new Set([
  "DRAFT",
  "UNDER_REVIEW",
  "CHANGES_REQUESTED",
  "REJECTED",
]);

export function canViewExactTieAdjudications(
  actor: TournamentActorContext,
  ownerTaUserId: string
): boolean {
  return actor.principalType === "USER" &&
    actor.roles.includes("TOURNAMENT_ADMIN") &&
    ownerTaUserId === actor.userId;
}

function canViewTournamentOperationalDetails(
  actor: TournamentActorContext,
  tournamentId: string,
  ownerTaUserId: string,
  store: TournamentStateStore
): boolean {
  if (actor.roles.includes("ADMIN") || ownerTaUserId === actor.userId) return true;
  return Array.from(store.staffAssignments.values()).some(
    (assignment) => assignment.tournamentId === tournamentId &&
      assignment.userId === actor.userId &&
      assignment.status === "ACTIVE"
  );
}

export async function registerTournamentCoreRoutes(
  app: FastifyInstance,
  auth: AuthService,
  store: TournamentStateStore,
  services: {
    coreDraftService: CoreDraftService;
    approvalService: ApprovalService;
    lifecycleService: TournamentLifecycleService;
    admissionGateService: AdmissionGateService;
    adjudicationLedgerService: AdjudicationLedgerService;
  }
): Promise<void> {
  const {
    coreDraftService,
    approvalService,
    lifecycleService,
    admissionGateService,
    adjudicationLedgerService,
  } = services;

  // 1. Draft & Tournament CRUD (/api/tournaments)
  app.get<{
    Querystring: { contractId?: string; status?: string; ownerTaUserId?: string };
  }>("/api/tournaments", async (request, reply) => {
    const actor = await resolveTournamentRequestActor(request, auth, store);
    await lifecycleService.evaluateScheduledStart();
    await lifecycleService.evaluateAutoEndAtWindow();
    const all = coreDraftService.listTournaments(request.query);
    const tournaments = all.filter((t) => {
      if (!UNAPPROVED_STATUSES.has(t.status)) return true;
      return actor.roles.includes("ADMIN") || t.ownerTaUserId === actor.userId;
    });
    return reply.status(200).send({ tournaments });
  });

  app.get<{ Params: { tournamentId: string } }>(
    "/api/tournaments/:tournamentId",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      await lifecycleService.evaluateScheduledStart();
      await lifecycleService.evaluateAutoEndAtWindow();
      const tournament = coreDraftService.getTournament(request.params.tournamentId);
      if (
        UNAPPROVED_STATUSES.has(tournament.status) &&
        !actor.roles.includes("ADMIN") &&
        tournament.ownerTaUserId !== actor.userId
      ) {
        throw createTournamentError({
          code: "UNAUTHORIZED",
          statusCode: 403,
          message: "Bạn không có quyền xem bản nháp giải đấu của đơn vị/TA khác.",
          details: { reason: "FORBIDDEN_ROLE", tournamentId: tournament.id },
        });
      }
      const versions = store.configVersions.get(tournament.id) ?? [];
      return reply.status(200).send({ tournament, configVersions: versions });
    }
  );

  app.post<{ Body: CreateTournamentDraftInput }>(
    "/api/tournaments/drafts",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const tournament = await coreDraftService.createDraft(actor, request.body);
      return reply.status(201).send({ tournament });
    }
  );

  app.patch<{ Params: { tournamentId: string }; Body: PatchTournamentDraftInput }>(
    "/api/tournaments/:tournamentId",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const tournament = await coreDraftService.patchDraft(
        actor,
        request.params.tournamentId,
        request.body
      );
      return reply.status(200).send({ tournament });
    }
  );

  app.delete<{ Params: { tournamentId: string } }>(
    "/api/tournaments/:tournamentId",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const result = await coreDraftService.deleteDraft(
        actor,
        request.params.tournamentId
      );
      return reply.status(200).send(result);
    }
  );

  app.post<{
    Params: { tournamentId: string };
    Body: { newTournamentCode: string };
  }>("/api/tournaments/:tournamentId/copy-to-draft", async (request, reply) => {
    const actor = await resolveTournamentRequestActor(request, auth, store);
    const tournament = await coreDraftService.copyRejectedToDraft(
      actor,
      request.params.tournamentId,
      request.body.newTournamentCode
    );
    return reply.status(201).send({ tournament });
  });

  app.post<{ Params: { tournamentId: string }; Body: SubmitTournamentDraftInput }>(
    "/api/tournaments/:tournamentId/submit",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const tournament = await coreDraftService.submitDraft(
        actor,
        request.params.tournamentId,
        request.body
      );
      return reply.status(200).send({ tournament });
    }
  );

  // 2. P08: Approvals & ChangeRequests (/api/admin/approvals)
  app.get<{ Querystring: { status?: string } }>(
    "/api/admin/approvals",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      assertAdminActor(actor);
      const queue = await approvalService.listApprovalQueue(request.query);
      return reply.status(200).send(queue);
    }
  );

  app.get<{ Params: { tournamentId: string } }>(
    "/api/admin/approvals/:tournamentId",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const detail = approvalService.getApprovalDetail(
        actor,
        request.params.tournamentId
      );
      return reply.status(200).send(detail);
    }
  );

  app.post<{ Params: { tournamentId: string }; Body: ApprovalDecisionInput }>(
    "/api/admin/approvals/:tournamentId/decision",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const tournament = await approvalService.decideInitialApproval(
        actor,
        request.params.tournamentId,
        request.body
      );
      return reply.status(200).send({ tournament });
    }
  );

  app.post<{
    Params: { tournamentId: string };
    Body: CreateTournamentChangeRequestInput;
  }>("/api/tournaments/:tournamentId/change-requests", async (request, reply) => {
    const actor = await resolveTournamentRequestActor(request, auth, store);
    const changeRequest = await lifecycleService.createChangeRequest(
      actor,
      request.params.tournamentId,
      request.body
    );
    return reply.status(201).send({ changeRequest });
  });

  app.post<{
    Params: { tournamentId: string; changeRequestId: string };
    Body?: { reason?: string };
  }>(
    "/api/tournaments/:tournamentId/change-requests/:changeRequestId/cancel",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const changeRequest = await lifecycleService.cancelChangeRequest(
        actor,
        request.params.tournamentId,
        request.params.changeRequestId,
        request.body?.reason
      );
      return reply.status(200).send({ changeRequest });
    }
  );

  app.post<{
    Params: { changeRequestId: string };
    Body: { decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES"; note?: string };
  }>(
    "/api/admin/change-requests/:changeRequestId/decision",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const changeRequest = await approvalService.decideChangeRequest(
        actor,
        request.params.changeRequestId,
        request.body
      );
      return reply.status(200).send({ changeRequest });
    }
  );

  // 3. Within-Envelope Rule Update & Readiness & Lifecycle
  app.post<{
    Params: { tournamentId: string };
    Body: PublishWithinEnvelopeRuleUpdateInput;
  }>("/api/tournaments/:tournamentId/rule-versions", async (request, reply) => {
    const actor = await resolveTournamentRequestActor(request, auth, store);
    const result = await lifecycleService.publishWithinEnvelopeRuleUpdate(
      actor,
      request.params.tournamentId,
      request.body
    );
    return reply.status(200).send(result);
  });

  app.get<{ Params: { tournamentId: string } }>(
    "/api/tournaments/:tournamentId/readiness",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const tournament = coreDraftService.getTournament(request.params.tournamentId);
      if (
        !canViewTournamentOperationalDetails(
          actor,
          tournament.id,
          tournament.ownerTaUserId,
          store
        )
      ) {
        throw createTournamentError({
          code: "UNAUTHORIZED",
          statusCode: 403,
          message: "Bạn không có quyền xem trạng thái vận hành của giải đấu này.",
          details: { reason: "FORBIDDEN_ROLE", tournamentId: tournament.id },
        });
      }
      const readiness = await lifecycleService.evaluateReadiness(
        request.params.tournamentId
      );
      return reply.status(200).send({ readiness });
    }
  );

  app.post<{ Params: { tournamentId: string }; Body?: { expectedRevision?: number } }>(
    "/api/tournaments/:tournamentId/open-scheduled",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const tournament = await lifecycleService.openScheduled(
        actor,
        request.params.tournamentId,
        request.body?.expectedRevision
      );
      return reply.status(200).send({ tournament });
    }
  );

  app.post<{ Params: { tournamentId: string }; Body?: { expectedRevision?: number } }>(
    "/api/tournaments/:tournamentId/start",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const tournament = await lifecycleService.startRunning(
        actor,
        request.params.tournamentId,
        request.body?.expectedRevision
      );
      return reply.status(200).send({ tournament });
    }
  );

  app.post<{
    Params: { tournamentId: string };
    Body: {
      reason: string;
      pauseMode?: "ADMISSION_PAUSE_ONLY" | "FULL_MATCH_STOP";
      expectedRevision?: number;
    };
  }>(
    "/api/tournaments/:tournamentId/pause",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const tournament = await lifecycleService.pauseTournament(
        actor,
        request.params.tournamentId,
        request.body?.reason ?? "",
        request.body?.expectedRevision,
        request.body?.pauseMode
      );
      return reply.status(200).send({ tournament });
    }
  );

  app.post<{ Params: { tournamentId: string }; Body?: { expectedRevision?: number } }>(
    "/api/tournaments/:tournamentId/resume",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const tournament = await lifecycleService.resumeTournament(
        actor,
        request.params.tournamentId,
        request.body?.expectedRevision
      );
      return reply.status(200).send({ tournament });
    }
  );

  app.post<{
    Params: { tournamentId: string };
    Body: { reason: string; expectedRevision?: number };
  }>(
    "/api/tournaments/:tournamentId/cancel",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const result = await lifecycleService.cancelTournament(
        actor,
        request.params.tournamentId,
        request.body?.reason ?? "",
        request.body?.expectedRevision
      );
      return reply.status(200).send(result);
    }
  );

  app.post<{ Params: { tournamentId: string }; Body?: { expectedRevision?: number } }>(
    "/api/tournaments/:tournamentId/finalize",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const tournament = await lifecycleService.finalizeTournament(
        actor,
        request.params.tournamentId,
        request.body?.expectedRevision
      );
      return reply.status(200).send({ tournament });
    }
  );

  // 4. Admission Gate C32 & Match Version Pinning
  app.post<{ Body: AdmissionCheckInput }>(
    "/api/tournaments/admission/check",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const body = AdmissionCheckInputSchema.parse(request.body);
      // Identity and roles are derived from the authenticated server context;
      // request payload values are limited to the requested operation/scope.
      const decision = admissionGateService.evaluateAdmission({
        ...body,
        principalType: actor.principalType === "GUEST" ? "GUEST" : "USER",
        principalId: actor.userId,
        roles: actor.roles,
      });
      return reply.status(200).send({ decision });
    }
  );

  // 5. Manual Adjudication & Score/Elo Replay Leaderboard
  app.get<{ Params: { tournamentId: string } }>(
    "/api/tournaments/:tournamentId/adjudications",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const tournament = coreDraftService.getTournament(request.params.tournamentId);
      if (
        !canViewExactTieAdjudications(
          actor,
          tournament.ownerTaUserId
        )
      ) {
        throw createTournamentError({
          code: "UNAUTHORIZED",
          statusCode: 403,
          message: "Bạn không có quyền xem danh sách phán quyết của giải đấu này.",
          details: { reason: "FORBIDDEN_ROLE", tournamentId: tournament.id },
        });
      }
      await adjudicationLedgerService.sweepExpiredAdjudications(
        request.params.tournamentId
      );
      const adjudications = Array.from(store.adjudicationRequests.values()).filter(
        (a) => a.tournamentId === request.params.tournamentId
      ).map((adjudication) => adjudicationLedgerService.toManualAdjudicationView(adjudication));
      return reply.status(200).send({ adjudications });
    }
  );

  app.post<{
    Params: { adjudicationRequestId: string };
    Body: SubmitManualAdjudicationVerdictInput;
  }>(
    "/api/tournaments/adjudications/:adjudicationRequestId/verdict",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const result = await adjudicationLedgerService.submitManualVerdict(
        actor,
        request.params.adjudicationRequestId,
        request.body
      );
      return reply.status(200).send({
        ...result,
        adjudication: adjudicationLedgerService.toManualAdjudicationView(result.adjudication),
      });
    }
  );

  app.get<{ Params: { tournamentId: string } }>(
    "/api/tournaments/:tournamentId/leaderboard",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const tournament = coreDraftService.getTournament(request.params.tournamentId);
      if (
        !canViewTournamentOperationalDetails(
          actor,
          tournament.id,
          tournament.ownerTaUserId,
          store
        )
      ) {
        throw createTournamentError({
          code: "UNAUTHORIZED",
          statusCode: 403,
          message: "Bạn không có quyền xem bảng xếp hạng của giải đấu này.",
          details: { reason: "FORBIDDEN_ROLE", tournamentId: tournament.id },
        });
      }
      const leaderboard = adjudicationLedgerService.computeLeaderboardSnapshot(
        request.params.tournamentId
      );
      return reply.status(200).send({ leaderboard });
    }
  );

  app.get<{ Params: { tournamentId: string } }>(
    "/api/tournaments/:tournamentId/matches",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const tournament = coreDraftService.getTournament(request.params.tournamentId);
      if (
        !canViewTournamentOperationalDetails(
          actor,
          tournament.id,
          tournament.ownerTaUserId,
          store
        )
      ) {
        throw createTournamentError({
          code: "UNAUTHORIZED",
          statusCode: 403,
          message: "Bạn không có quyền xem danh sách trận của giải đấu này.",
          details: { reason: "FORBIDDEN_ROLE", tournamentId: tournament.id },
        });
      }
      const matches = adjudicationLedgerService.getLedgerEntries(
        request.params.tournamentId
      );
      return reply.status(200).send({ matches });
    }
  );
}
