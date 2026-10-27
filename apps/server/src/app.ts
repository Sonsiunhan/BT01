import { randomInt, randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";

import { loadEnv, type AppEnv } from "./config/env.js";
import { loadGeneratedBotRuntimeConfig } from "./config/bot-runtime.js";
import { registerHealthRoute } from "./modules/health/health.route.js";
import { HealthService } from "./modules/health/health.service.js";
import { registerAuthRoutes } from "./modules/auth/auth.route.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { registerProfileRoutes } from "./modules/profile/profile.route.js";
import { registerRoomRoutes } from "./modules/room/room.route.js";
import { RoomManager, type RoomState } from "./modules/room/room.manager.js";
import { registerMatchRoutes } from "./modules/match/match.route.js";
import { MatchManager } from "./modules/match/match.manager.js";
import { FileMatchPersistence, type MatchPersistence } from "./modules/match/match.persistence.js";
import { registerMatchmakingRoutes } from "./modules/matchmaking/matchmaking.route.js";
import { MatchmakingManager } from "./modules/matchmaking/matchmaking.manager.js";
import { RatingService } from "./modules/rating/rating.service.js";
import { MatchHistoryService } from "./modules/history/history.service.js";
import { registerHistoryRoutes } from "./modules/history/history.route.js";
import { SocialService } from "./modules/social/social.service.js";
import { registerSocialRoutes } from "./modules/social/social.route.js";
import { GuestImportService } from "./modules/guest/guest-import.service.js";
import { registerGuestImportRoutes } from "./modules/guest/guest-import.route.js";
import { MetricsRegistry } from "./modules/diagnostics/metrics.js";
import { registerMetricsRoute } from "./modules/diagnostics/metrics.route.js";
import { registerR3ProviderRoute } from "./modules/diagnostics/r3-provider.route.js";
import { InventoryService } from "./modules/diagnostics/inventory.service.js";
import { registerInventoryRoute } from "./modules/diagnostics/inventory.route.js";
import { BotLibraryService, type BotLibraryDatabase } from "./modules/bot-library/bot-library.service.js";
import { registerBotLibraryRoutes } from "./modules/bot-library/bot-library.route.js";
import { CapacityController, registerCapacityAdmissionHook, registerCapacityRoute } from "./modules/capacity/index.js";
import { BotOnlineService, FileBotOnlineStatePersistence } from "./modules/bot-online/bot-online.service.js";
import { createWasmtimeCpythonAdapter, DEFAULT_CPYTHON_WASM_SHA256, DEFAULT_WASMTIME_LINUX_SHA256 } from "./modules/bot-online/wasmtime.adapter.js";
import { registerBotOnlineRoutes } from "./modules/bot-online/bot-online.route.js";
import {
  createTournamentRuntimeBundle,
  registerTournamentInitializationRoutes,
  type TournamentRuntimeBundle,
} from "./modules/tournament-core/index.js";
import { registerTournamentRulesPreviewRoutes } from "./modules/tournament-rules-preview/rules-preview.route.js";
import { PrismaTournamentPreviewScopeReader, TournamentRulesPreviewService } from "./modules/tournament-rules-preview/rules-preview.service.js";
import { RosterService, ActivationService, registerRosterRoutes } from "./modules/roster/index.js";
import { registerTournamentRuleVersionRoutes } from "./modules/tournament-versioning/versioning.route.js";
import type { TournamentVersioningPort } from "./modules/tournament-versioning/versioning.port.js";
import { registerTournamentAcknowledgementRoutes } from "./modules/tournament-acknowledgement/acknowledgement.route.js";
import { TournamentAcknowledgementService } from "./modules/tournament-acknowledgement/acknowledgement.service.js";
import { RetentionEnforcementService } from "./modules/tournament-acknowledgement/retention.service.js";
import { PrismaTournamentAcknowledgementGuard } from "./modules/tournament-core/acknowledgement-guard.js";
import { syncPrismaToTournamentStore } from "./modules/tournament-foundation/prisma-sync.js";
import { registerCors } from "./plugins/cors.js";
import { csrfMiddleware } from "./modules/auth/csrf.middleware.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerWebApp } from "./plugins/web-app.js";
import { PrismaDatabase, type DatabasePort } from "./plugins/prisma.js";
import { DisabledRealtimeAdapter } from "./realtime/disabled.adapter.js";
import { PlayHtmlAdapter } from "./realtime/playhtml.adapter.js";
import type { RealtimePort } from "./realtime/realtime.port.js";
import type { CommitPort, CommandLedger } from "./modules/match/commit/index.js";

export type BuildAppOptions = {
  env?: AppEnv;
  database?: DatabasePort;
  realtime?: RealtimePort;
  auth?: AuthService;
  rooms?: RoomManager;
  matches?: MatchManager;
  commitPort?: CommitPort;
  commandLedger?: CommandLedger;
  matchPersistence?: MatchPersistence;
  matchmaking?: MatchmakingManager;
  history?: MatchHistoryService;
  social?: SocialService;
  guestImport?: GuestImportService;
  metrics?: MetricsRegistry;
  capacityController?: CapacityController;
  botLibrary?: BotLibraryService;
  botOnline?: BotOnlineService;
  tournamentBundle?: TournamentRuntimeBundle;
  tournamentRulesPreview?: TournamentRulesPreviewService;
  rosterService?: RosterService;
  activationService?: ActivationService;
  /** L05-owned canonical version store; N04 only registers its typed adapter. */
  tournamentVersioning?: TournamentVersioningPort;
};

function createRealtime(env: AppEnv, app: FastifyInstance): RealtimePort {
  if (env.REALTIME_ADAPTER === "disabled") return new DisabledRealtimeAdapter();
  return new PlayHtmlAdapter(
    {
      ...(env.PLAYHTML_ENDPOINT ? { endpoint: env.PLAYHTML_ENDPOINT } : {}),
      ...(env.PLAYHTML_PROJECT_ID ? { projectId: env.PLAYHTML_PROJECT_ID } : {})
    },
    app.log
  );
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const env = options.env ?? loadEnv();
  const app = Fastify({
    logger: env.NODE_ENV === "test" ? false : { level: env.LOG_LEVEL }
  });
  const database = options.database ?? new PrismaDatabase();
  const realtime = options.realtime ?? createRealtime(env, app);
  const auth = options.auth ?? new AuthService(database instanceof PrismaDatabase ? database.client : undefined);
  const rooms = options.rooms ?? new RoomManager();
  const matchPersistence = options.matchPersistence ?? (env.MATCH_PERSISTENCE_DIR ? new FileMatchPersistence(env.MATCH_PERSISTENCE_DIR) : undefined);
  const matches = options.matches ?? new MatchManager(Date.now, 30_000, matchPersistence, options.commitPort, options.commandLedger);
  const matchmaking = options.matchmaking ?? new MatchmakingManager(rooms, matches);
  const rating = new RatingService(database instanceof PrismaDatabase ? database.client : undefined);
  const history = options.history ?? new MatchHistoryService(database instanceof PrismaDatabase ? database.client : undefined);
  const social = options.social ?? new SocialService(database instanceof PrismaDatabase ? database.client : undefined, rooms);
  const rosterService = options.rosterService ?? new RosterService(database instanceof PrismaDatabase ? database.client : undefined);
  const activationService = options.activationService ?? new ActivationService(database instanceof PrismaDatabase ? database.client : undefined);
  const guestImport = options.guestImport ?? new GuestImportService(database instanceof PrismaDatabase ? database.client : undefined);
  const metrics = options.metrics ?? new MetricsRegistry();
  const capacity = options.capacityController ?? new CapacityController({ metrics });
  // An explicitly configured runtime is all-or-nothing. A partial env setup
  // must fail closed instead of silently falling back to a build handoff.
  const hasExplicitRuntime = Boolean(
    env.BOT_WASMTIME_PATH || env.BOT_CPYTHON_WASI_DIR || env.BOT_WASMTIME_SHA256 ||
    env.BOT_CPYTHON_WASM_SHA256 || env.BOT_RUNTIME_WORK_DIR,
  );
  const generatedRuntime = hasExplicitRuntime ? undefined : await loadGeneratedBotRuntimeConfig();
  const runtimePaths = env.BOT_WASMTIME_PATH && env.BOT_CPYTHON_WASI_DIR
    ? { wasmtimePath: env.BOT_WASMTIME_PATH, cpythonDir: env.BOT_CPYTHON_WASI_DIR, wasmtimeSha256: env.BOT_WASMTIME_SHA256 ?? DEFAULT_WASMTIME_LINUX_SHA256, cpythonWasmSha256: env.BOT_CPYTHON_WASM_SHA256 ?? DEFAULT_CPYTHON_WASM_SHA256 }
    : generatedRuntime;
  const botRuntimeAdapter = runtimePaths
    ? createWasmtimeCpythonAdapter({ ...runtimePaths, ...(env.BOT_RUNTIME_WORK_DIR ? { workDir: env.BOT_RUNTIME_WORK_DIR } : {}) })
    : undefined;
  const botLibrary = options.botLibrary ?? new BotLibraryService(database instanceof PrismaDatabase ? database.client as unknown as BotLibraryDatabase : undefined, botRuntimeAdapter ? { adapter: botRuntimeAdapter } : {});
  const botOnline = options.botOnline ?? (env.MATCH_PERSISTENCE_DIR
    ? new BotOnlineService(botLibrary, matches, { resolveRoom: (roomId, userId) => rooms.search(roomId, userId), persistence: new FileBotOnlineStatePersistence(`${env.MATCH_PERSISTENCE_DIR}/bot-online`), ...(botRuntimeAdapter ? { adapter: botRuntimeAdapter } : {}) })
    : new BotOnlineService(botLibrary, matches, { resolveRoom: (roomId, userId) => rooms.search(roomId, userId), ...(botRuntimeAdapter ? { adapter: botRuntimeAdapter } : {}) }));
  const tournamentRulesPreview = options.tournamentRulesPreview
    ?? (database instanceof PrismaDatabase ? new TournamentRulesPreviewService(new PrismaTournamentPreviewScopeReader(database.client)) : undefined);
  const acknowledgementService = database instanceof PrismaDatabase
    ? new TournamentAcknowledgementService(database.client)
    : undefined;

  await registerCors(app, env.corsOrigins);
  registerErrorHandler(app);
  const tournamentBundle = options.tournamentBundle ?? createTournamentRuntimeBundle({
    database: database instanceof PrismaDatabase ? database.client : undefined,
    botLibrary,
    ...(acknowledgementService ? { acknowledgementGuard: new PrismaTournamentAcknowledgementGuard((database as PrismaDatabase).client, acknowledgementService) } : {}),
  });
  if (database instanceof PrismaDatabase) {
    await syncPrismaToTournamentStore(database.client, tournamentBundle.store, { seedDefaultOnEmpty: true });
  }

  rooms.setFallbackRoomResolver((roomId: string) => {
    const normalized = roomId.trim().toUpperCase();
    const match = Array.from(tournamentBundle.store.matches.values()).find(
      (m) => m.roomId.trim().toUpperCase() === normalized
    );
    if (!match) return null;

    const tournament = tournamentBundle.store.tournaments.get(match.tournamentId);
    const blueEnrollment = tournamentBundle.store.enrollments.get(match.blueParticipantId);
    const redEnrollment = tournamentBundle.store.enrollments.get(match.redParticipantId);

    const blueUserId = blueEnrollment?.userId ?? match.blueParticipantId;
    const redUserId = redEnrollment?.userId ?? match.redParticipantId;
    const blueName = blueEnrollment?.displayName ?? "Người chơi Xanh";
    const redName = redEnrollment?.displayName ?? "Người chơi Đỏ";

    const seed = randomInt(2_822_400);
    const now = Date.now();
    const isBot = tournament?.coreConfig?.competitionMode === "BOT_VS_BOT";

    const fallbackRoom: RoomState = {
      roomId: normalized,
      roomGeneration: randomUUID(),
      roomVersion: 1,
      name: tournament ? `${tournament.coreConfig.tournamentName} - ${normalized}` : `Phòng thi đấu ${normalized}`,
      mode: "UNRANKED",
      playMode: isBot ? "BOT" : "MANUAL",
      visibility: "PUBLIC",
      timerSeconds: 300,
      spectatorsEnabled: true,
      refereeEnabled: false,
      status: "WAITING",
      members: [
        {
          userId: blueUserId,
          username: blueName,
          displayName: blueName,
          rating: blueEnrollment?.seedRating ?? 1000,
          principal: "ACCOUNT",
          joinedAt: now,
          isHost: true,
          ready: false,
        },
        {
          userId: redUserId,
          username: redName,
          displayName: redName,
          rating: redEnrollment?.seedRating ?? 1000,
          principal: "ACCOUNT",
          joinedAt: now,
          isHost: false,
          ready: false,
        },
      ],
      spectatorIds: new Set(),
      createdAt: now,
      setupContext: {
        setupDescriptor: { version: "rps-v2", seed },
        setupSignature: `seed-${seed}`,
      },
    };

    if (isBot) {
      queueMicrotask(async () => {
        try {
          const blueLib = await botLibrary.list(blueUserId);
          const blueBot = blueLib.bots.find((b) => b.revisions.some((r) => r.status === "PASSED"));
          const blueRev = blueBot?.revisions.find((r) => r.status === "PASSED");
          if (blueBot && blueRev) {
            await botOnline.select(
              rooms.search(normalized, blueUserId),
              { userId: blueUserId, username: blueName, displayName: blueName, principal: "ACCOUNT" },
              blueBot.id,
              blueRev.id
            );
          }
          const redLib = await botLibrary.list(redUserId);
          const redBot = redLib.bots.find((b) => b.revisions.some((r) => r.status === "PASSED"));
          const redRev = redBot?.revisions.find((r) => r.status === "PASSED");
          if (redBot && redRev) {
            await botOnline.select(
              rooms.search(normalized, redUserId),
              { userId: redUserId, username: redName, displayName: redName, principal: "ACCOUNT" },
              redBot.id,
              redRev.id
            );
          }
        } catch {
          // ignore error if bot cannot be selected
        }
      });
    }

    return fallbackRoom;
  });

  await registerTournamentInitializationRoutes(app, auth, tournamentBundle);
  // Register API diagnostics before the SPA catch-all so provider evidence
  // remains reachable even on Fastify/router versions that prefer insertion
  // order when resolving wildcard GET routes.
  await registerR3ProviderRoute(app);
  await registerWebApp(app);
  registerCapacityAdmissionHook(app, capacity);
  await registerAuthRoutes(app, auth, env);
  await registerProfileRoutes(app, auth, social);
  await registerRoomRoutes(app, auth, rooms);
  await registerMatchRoutes(app, auth, rooms, matches, rating, history, metrics, botOnline);
  await registerMatchmakingRoutes(app, auth, matchmaking, botLibrary);
  await registerHistoryRoutes(app, auth, history);
  await registerSocialRoutes(app, auth, social, env.corsOrigins);
  await registerGuestImportRoutes(app, auth, guestImport, env.NODE_ENV === "production");
  await registerBotLibraryRoutes(app, auth, botLibrary);
  await registerBotOnlineRoutes(app, auth, rooms, botOnline);
  if (tournamentRulesPreview) await registerTournamentRulesPreviewRoutes(app, auth, tournamentRulesPreview);
  if (acknowledgementService) registerTournamentAcknowledgementRoutes(app, auth, acknowledgementService);
  await registerRosterRoutes(app, auth, rosterService, activationService);
  const tournamentVersioning = options.tournamentVersioning ?? tournamentBundle.versioningAdapter;
  await registerTournamentRuleVersionRoutes(app, auth, tournamentVersioning);
  const botProbe = () => ({
    status: botRuntimeAdapter ? ("ok" as const) : ("degraded" as const),
    reason: botRuntimeAdapter ? undefined : "wasmtime-unconfigured",
  });
  const healthService = new HealthService(database, realtime, botProbe);
  const inventoryService = new InventoryService(healthService);

  await registerMetricsRoute(app, metrics, auth);
  await registerInventoryRoute(app, inventoryService, auth);
  await registerCapacityRoute(app, capacity, auth);
  await registerHealthRoute(app, healthService);
  // Guest uploads are temporary, not an account cloud library. Keep this
  // bounded sweep independent of user traffic; never prune live references.
  const guestSourceSweep = setInterval(() => {
    void botLibrary.pruneExpiredGuestSources().catch(() => app.log.warn("Guest source cleanup unavailable"));
  }, 60 * 60 * 1000);
  guestSourceSweep.unref();
  // D12-F03/F04: run the D08 retention enforcement (terminal tournaments older
  // than 90 days, audit logs older than 365 days) on a bounded hourly sweep.
  // Best-effort: a transient database failure is logged and retried next tick.
  let retentionSweep: NodeJS.Timeout | undefined;
  if (database instanceof PrismaDatabase) {
    const retentionService = new RetentionEnforcementService(database.client);
    retentionSweep = setInterval(() => {
      void retentionService
        .runScheduledRetentionSweep({ userId: "system:retention", role: "SYSTEM_ADMIN" })
        .catch((err) => app.log.warn({ err }, "Retention sweep unavailable"));
    }, 60 * 60 * 1000);
    retentionSweep.unref();
  }
  app.addHook("onReady", async () => realtime.start());
  app.addHook("onRequest", csrfMiddleware(env.corsOrigins));
  app.addHook("onResponse", async (request, reply) => {
    const path = request.routeOptions.url ?? request.url.split("?", 1)[0] ?? "/";
    const bytes = Number(reply.getHeader("content-length") ?? 0) || 0;
    const durationMs = typeof reply.elapsedTime === "number" && reply.elapsedTime >= 0 ? reply.elapsedTime : 0;
    metrics.observeHttp(request.method, path, reply.statusCode, durationMs, bytes);
  });
  app.addHook("onClose", async () => {
    clearInterval(guestSourceSweep);
    if (retentionSweep) clearInterval(retentionSweep);
    matches.stop();
    botOnline.stopAll();
    matchmaking.stop();
    history.stop();
    social.presence.stop();
    await realtime.stop();
    await database.close();
  });
  return app;
}
