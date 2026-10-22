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
import { registerTournamentStaffRoutes } from "../tournament-staff/staff.route.js";
import { TournamentStaffService } from "../tournament-staff/staff.service.js";

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
  staffService?: TournamentStaffService;
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
  const staffService = options?.database ? new TournamentStaffService(options.database) : undefined;

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
    staffService,
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
  if (bundle.staffService) registerTournamentStaffRoutes(app, auth, bundle.staffService);

  // C32 & T005 Hook on Online Matchmaking Queue, Room Creation/Join, Spectate and Seat Upgrade
  app.addHook("preHandler", async (request) => {
    if (request.method !== "POST") return;
    const urlPath = request.url.split("?", 1)[0] ?? "";

    let action:
      | "ONLINE_QUEUE_JOIN"
      | "ONLINE_ROOM_CREATE"
      | "ONLINE_ROOM_JOIN_PLAYER"
      | "ONLINE_SEAT_UPGRADE_TO_PLAYER"
      | "SPECTATE_ROOM"
      | "REFEREE_ENTER_ROOM"
      | null = null;
    let roomId: string | undefined;

    if (urlPath === "/matchmaking/queue") {
      action = "ONLINE_QUEUE_JOIN";
    } else if (urlPath === "/rooms") {
      const body = request.body as any;
      if (body && typeof body === "object" && body.hostRole === "REFEREE") {
        action = "REFEREE_ENTER_ROOM";
      } else {
        action = "ONLINE_ROOM_CREATE";
      }
    } else {
      const joinMatch = /^\/rooms\/([^/]+)\/join$/.exec(urlPath);
      if (joinMatch) {
        action = "ONLINE_ROOM_JOIN_PLAYER";
        roomId = joinMatch[1];
      } else {
        const spectateMatch = /^\/rooms\/([^/]+)\/spectate$/.exec(urlPath);
        if (spectateMatch) {
          action = "SPECTATE_ROOM";
          roomId = spectateMatch[1];
        } else {
          const seatMatch = /^\/rooms\/([^/]+)\/(?:seat|seat-upgrade|player-upgrade)$/.exec(urlPath);
          if (seatMatch) {
            action = "ONLINE_SEAT_UPGRADE_TO_PLAYER";
            roomId = seatMatch[1];
          } else if (/^\/rooms\/referee\/invites\/[^/]+\/accept$/.test(urlPath)) {
            action = "REFEREE_ENTER_ROOM";
          }
        }
      }
    }

    if (!action) return;

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
        roomId,
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
