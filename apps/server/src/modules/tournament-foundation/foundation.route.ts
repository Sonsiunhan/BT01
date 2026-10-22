import type { FastifyInstance, FastifyRequest } from "fastify";
import type {
  CreateTournamentContractInput,
  CreateUnitInput,
  GrantContractTaInput,
  RevokeContractTaInput,
  UpdateTournamentContractInput,
  UpdateUnitInput,
} from "@ottv2/contracts";
import { readCookie } from "../auth/auth.http.js";
import { GUEST_SESSION_COOKIE, type AuthService } from "../auth/auth.service.js";
import {
  assertAdminActor,
  type TournamentActorContext,
  type TournamentStateStore,
} from "./tournament-store.js";
import type { UnitContractService } from "./unit-contract.service.js";

export async function resolveTournamentRequestActor(
  request: FastifyRequest,
  auth: AuthService,
  store: TournamentStateStore
): Promise<TournamentActorContext> {
  const sessionToken = readCookie(request);
  const guestToken = readCookie(request, GUEST_SESSION_COOKIE);
  const context = await auth.authenticateAny(sessionToken, guestToken);
  const correlationId =
    typeof request.headers["x-command-id"] === "string"
      ? request.headers["x-command-id"]
      : undefined;

  return store.resolveAuthoritativeActor({
    userId: context.user.id,
    username: context.user.username,
    principalType: context.principal === "GUEST" ? "GUEST" : "USER",
    correlationId,
  });
}

export async function registerTournamentFoundationRoutes(
  app: FastifyInstance,
  auth: AuthService,
  store: TournamentStateStore,
  unitContractService: UnitContractService
): Promise<void> {
  // P06: Units Management (/api/admin/units)
  app.get("/api/admin/units", async (request, reply) => {
    const actor = await resolveTournamentRequestActor(request, auth, store);
    assertAdminActor(actor);
    const units = unitContractService.listUnits();
    return reply.status(200).send({ units });
  });

  app.post<{ Body: CreateUnitInput }>("/api/admin/units", async (request, reply) => {
    const actor = await resolveTournamentRequestActor(request, auth, store);
    const unit = await unitContractService.createUnit(actor, request.body);
    return reply.status(201).send({ unit });
  });

  app.patch<{ Params: { unitId: string }; Body: UpdateUnitInput }>(
    "/api/admin/units/:unitId",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const unit = await unitContractService.updateUnit(
        actor,
        request.params.unitId,
        request.body
      );
      return reply.status(200).send({ unit });
    }
  );

  app.delete<{ Params: { unitId: string } }>(
    "/api/admin/units/:unitId",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const result = await unitContractService.deleteUnit(
        actor,
        request.params.unitId
      );
      return reply.status(200).send(result);
    }
  );

  // P07: Contracts Management (/api/admin/contracts)
  app.get<{
    Querystring: { unitId?: string; status?: string; taUserId?: string };
  }>("/api/admin/contracts", async (request, reply) => {
    const actor = await resolveTournamentRequestActor(request, auth, store);
    assertAdminActor(actor);
    await unitContractService.expireContractsIfNeeded();
    const contracts = unitContractService.listContracts(request.query);
    return reply.status(200).send({ contracts });
  });

  app.get<{ Params: { contractId: string } }>(
    "/api/admin/contracts/:contractId",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      assertAdminActor(actor);
      const contract = unitContractService.getContract(request.params.contractId);
      return reply.status(200).send({ contract });
    }
  );

  app.post<{ Body: CreateTournamentContractInput }>(
    "/api/admin/contracts",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const contract = await unitContractService.createContract(
        actor,
        request.body
      );
      return reply.status(201).send({ contract });
    }
  );

  app.patch<{ Params: { contractId: string }; Body: UpdateTournamentContractInput }>(
    "/api/admin/contracts/:contractId",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const contract = await unitContractService.updateContract(
        actor,
        request.params.contractId,
        request.body
      );
      return reply.status(200).send({ contract });
    }
  );

  app.post<{ Params: { contractId: string }; Body: GrantContractTaInput }>(
    "/api/admin/contracts/:contractId/ta-bindings",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const contract = await unitContractService.grantTaBinding(
        actor,
        request.params.contractId,
        request.body
      );
      return reply.status(200).send({ contract });
    }
  );

  app.post<{
    Params: { contractId: string; userId: string };
    Body: RevokeContractTaInput;
  }>(
    "/api/admin/contracts/:contractId/ta-bindings/:userId/revoke",
    async (request, reply) => {
      const actor = await resolveTournamentRequestActor(request, auth, store);
      const contract = await unitContractService.revokeTaBinding(
        actor,
        request.params.contractId,
        request.params.userId,
        request.body
      );
      return reply.status(200).send({ contract });
    }
  );

  // P14: Audit Logs Read Endpoint (/api/admin/audit-logs)
  app.get<{
    Querystring: {
      targetType?:
        | "UNIT"
        | "CONTRACT"
        | "CONTRACT_TA_BINDING"
        | "TOURNAMENT"
        | "CHANGE_REQUEST"
        | "RULE_VERSION"
        | "ADJUDICATION";
      targetId?: string;
    };
  }>("/api/admin/audit-logs", async (request, reply) => {
    const actor = await resolveTournamentRequestActor(request, auth, store);
    assertAdminActor(actor);
    const logs = store.audit.list({
      targetType: request.query.targetType,
      targetId: request.query.targetId,
    });
    return reply.status(200).send({ logs });
  });
}
