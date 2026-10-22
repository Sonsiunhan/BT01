import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { AuthService } from "../auth/auth.service.js";
import {
  registerTournamentFoundationRoutes,
  resolveTournamentRequestActor,
} from "../tournament-foundation/foundation.route.js";
import { TournamentStateStore } from "../tournament-foundation/tournament-store.js";
import { UnitContractService } from "../tournament-foundation/unit-contract.service.js";
import { AdjudicationLedgerService } from "./adjudication-ledger.service.js";
import { AdmissionGateService } from "./admission-gate.service.js";
import { ApprovalService } from "./approval.service.js";
import { CoreDraftService } from "./core-draft.service.js";
import { TournamentLifecycleService } from "./lifecycle.service.js";
import { registerTournamentCoreRoutes } from "./tournament-core.route.js";
import {
  InMemoryReadinessSourcesAdapter,
  PrismaReadinessSourcesAdapter,
  type ReadinessSourcesPort,
} from "./readiness-sources.port.js";
import { TournamentVersioningAdapter } from "./tournament-versioning.adapter.js";

export interface TournamentRuntimeBundle {
  store: TournamentStateStore;
  unitContractService: UnitContractService;
  coreDraftService: CoreDraftService;
  approvalService: ApprovalService;
  lifecycleService: TournamentLifecycleService;
  admissionGateService: AdmissionGateService;
  adjudicationLedgerService: AdjudicationLedgerService;
  readinessSourcesPort: ReadinessSourcesPort;
  versioningAdapter: TournamentVersioningAdapter;
}

export function createTournamentRuntimeBundle(options?: {
  clockFn?: (() => Date) | undefined;
  store?: TournamentStateStore | undefined;
  database?: PrismaClient | undefined;
  readinessSourcesPort?: ReadinessSourcesPort | undefined;
}): TournamentRuntimeBundle {
  const store = options?.store ?? new TournamentStateStore({ clockFn: options?.clockFn });
  const unitContractService = new UnitContractService(store);
  const coreDraftService = new CoreDraftService(store);
  const approvalService = new ApprovalService(store);
  const adjudicationLedgerService = new AdjudicationLedgerService(store);
  const readinessSourcesPort =
    options?.readinessSourcesPort ??
    (options?.database
      ? new PrismaReadinessSourcesAdapter(options.database)
      : new InMemoryReadinessSourcesAdapter(store));
  const lifecycleService = new TournamentLifecycleService(
    store,
    adjudicationLedgerService,
    readinessSourcesPort
  );
  const admissionGateService = new AdmissionGateService(store);
  const versioningAdapter = new TournamentVersioningAdapter(store);

  return {
    store,
    unitContractService,
    coreDraftService,
    approvalService,
    lifecycleService,
    admissionGateService,
    adjudicationLedgerService,
    readinessSourcesPort,
    versioningAdapter,
  };
}

export async function registerTournamentInitializationRoutes(
  app: FastifyInstance,
  auth: AuthService,
  bundle: TournamentRuntimeBundle
): Promise<void> {
  await registerTournamentFoundationRoutes(
    app,
    auth,
    bundle.store,
    bundle.unitContractService
  );
  await registerTournamentCoreRoutes(app, auth, bundle.store, {
    coreDraftService: bundle.coreDraftService,
    approvalService: bundle.approvalService,
    lifecycleService: bundle.lifecycleService,
    admissionGateService: bundle.admissionGateService,
    adjudicationLedgerService: bundle.adjudicationLedgerService,
  });

  // C32 & T005 Hook on Online Matchmaking Queue and Room Player Creation/Join
  app.addHook("preHandler", async (request) => {
    if (request.method !== "POST") return;
    const urlPath = request.url.split("?", 1)[0] ?? "";

    let action:
      | "ONLINE_QUEUE_JOIN"
      | "ONLINE_ROOM_CREATE"
      | "ONLINE_ROOM_JOIN_PLAYER"
      | null = null;
    if (urlPath === "/matchmaking/queue") {
      action = "ONLINE_QUEUE_JOIN";
    } else if (urlPath === "/rooms") {
      action = "ONLINE_ROOM_CREATE";
    } else if (/^\/rooms\/[^/]+\/join$/.test(urlPath)) {
      action = "ONLINE_ROOM_JOIN_PLAYER";
    }

    if (!action) return;

    const hasActiveWindow = Array.from(bundle.store.tournaments.values()).some(
      (t) => t.status === "RUNNING" || t.status === "PAUSED"
    );
    const hasConfiguredSystemAdmins = bundle.store.systemRoles.size > 0;
    if (!hasActiveWindow && !hasConfiguredSystemAdmins) {
      return;
    }

    try {
      const actor = await resolveTournamentRequestActor(
        request,
        auth,
        bundle.store
      );
      bundle.admissionGateService.assertAdmissionAllowed({
        principalType: actor.principalType ?? "USER",
        principalId: actor.userId,
        roles: actor.roles,
        action,
      });
    } catch (err) {
      // Only rethrow if it is our admission gate error (403/409); let route handler handle unauthenticated 401
      if (
        err &&
        typeof err === "object" &&
        "statusCode" in err &&
        (err.statusCode === 403 || err.statusCode === 409)
      ) {
        throw err;
      }
    }
  });
}

export {
  TournamentStateStore,
  UnitContractService,
  CoreDraftService,
  ApprovalService,
  TournamentLifecycleService,
  AdmissionGateService,
  AdjudicationLedgerService,
  ReadinessSourcesPort,
  InMemoryReadinessSourcesAdapter,
  PrismaReadinessSourcesAdapter,
  TournamentVersioningAdapter,
};
