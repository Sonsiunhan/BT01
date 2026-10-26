import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { AppError } from "../../shared/errors/app-error.js";
import { readCookie } from "../auth/auth.http.js";
import { GUEST_SESSION_COOKIE, type AuthService } from "../auth/auth.service.js";
import type { AdjudicationLedgerService } from "./adjudication-ledger.service.js";
import type { TournamentStateStore } from "../tournament-foundation/tournament-store.js";

interface SessionUser {
  id: string;
  displayName?: string;
}

async function requireAccountUser(request: FastifyRequest, auth: AuthService): Promise<SessionUser> {
  const context = await auth.authenticateAny(
    readCookie(request),
    readCookie(request, GUEST_SESSION_COOKIE)
  );
  if (context.principal === "GUEST") {
    throw new AppError(
      "UNAUTHORIZED",
      "Khu vực giải đấu dành cho tài khoản người chơi đã kích hoạt, không dành cho phiên khách.",
      403,
      false,
      "INVALID",
      { reason: "FORBIDDEN_ROLE" }
    );
  }
  return context.user as unknown as SessionUser;
}

const TERMINAL_STATUSES = new Set(["ENDED", "FINALIZED", "CANCELLED"]);

/**
 * The roster module (D03/D04) persists enrollments directly to PostgreSQL while
 * CoreDraftService.enrollParticipant keeps them in the store — so the player's
 * enrollment list must merge BOTH sources (Prisma is the durable record).
 */
export async function registerMyTournamentRoutes(
  app: FastifyInstance,
  auth: AuthService,
  store: TournamentStateStore,
  adjudicationLedgerService: AdjudicationLedgerService,
  database?: PrismaClient
): Promise<void> {
  type EnrollmentView = {
    enrollmentId: string;
    personKey: string;
    displayName: string;
    unitCode: string;
    seedRating: number;
    eligibilityStatus: string;
    checkedInAt: string | null;
    pinnedBotRevisionId: string | null;
    botReadinessStatus: string;
  };

  type TournamentSummary = {
    id: string;
    tournamentCode: string;
    tournamentName: string;
    organizersText: string;
    status: string;
    revision: number;
    scheduledStartAt: string | null;
    scheduledEndAt: string | null;
    timezone: string;
    competitionMode: string;
    format: string | null;
    pairingMethod: string | null;
    maxParticipants: number | null;
    checkinRequired: boolean;
    checkinOpenAt: string | null;
    checkinCloseAt: string | null;
    leaderboardVisibility: string;
    startedAt: string | null;
    endedAt: string | null;
    cancelledAt: string | null;
  };

  const summaryFromCore = (t: {
    id: string;
    status: string;
    revision: number;
    coreConfig: Record<string, unknown> | null;
    startedAt: string | null;
    endedAt: string | null;
    cancelledAt: string | null;
  }): TournamentSummary => {
    const core = t.coreConfig ?? {};
    return {
      id: t.id,
      tournamentCode: String(core.tournamentCode ?? ""),
      tournamentName: String(core.tournamentName ?? ""),
      organizersText: String(core.organizersText ?? ""),
      status: t.status,
      revision: t.revision,
      scheduledStartAt: (core.scheduledStartAt as string) ?? null,
      scheduledEndAt: (core.scheduledEndAt as string) ?? null,
      timezone: String(core.timezone ?? "Asia/Ho_Chi_Minh"),
      competitionMode: String(core.competitionMode ?? "HUMAN_ONLINE"),
      format: (core.format as string) ?? null,
      pairingMethod: (core.pairingMethod as string) ?? null,
      maxParticipants: typeof core.maxParticipants === "number" ? core.maxParticipants : null,
      checkinRequired: Boolean(core.checkinRequired),
      checkinOpenAt: (core.checkinOpenAt as string) ?? null,
      checkinCloseAt: (core.checkinCloseAt as string) ?? null,
      leaderboardVisibility: String(core.leaderboardVisibility ?? "LIVE_PUBLIC"),
      startedAt: t.startedAt,
      endedAt: t.endedAt,
      cancelledAt: t.cancelledAt,
    };
  };

  const summaryFromDto = (t: Parameters<typeof summaryFromCore>[0] & { coreConfig: Record<string, unknown> }) =>
    summaryFromCore(t);

  const iso = (value: Date | string | null | undefined): string | null =>
    value === null || value === undefined ? null : value instanceof Date ? value.toISOString() : value;

  const enrollmentViewFromRow = (row: {
    id: string;
    personKey: string;
    displayName: string;
    unitCode: string;
    seedRating: number;
    eligibilityStatus: string;
    checkedInAt: Date | null;
    pinnedBotRevisionId: string | null;
    botReadinessStatus: string;
  }): EnrollmentView => ({
    enrollmentId: row.id,
    personKey: row.personKey,
    displayName: row.displayName,
    unitCode: row.unitCode,
    seedRating: row.seedRating,
    eligibilityStatus: row.eligibilityStatus,
    checkedInAt: iso(row.checkedInAt),
    pinnedBotRevisionId: row.pinnedBotRevisionId,
    botReadinessStatus: row.botReadinessStatus,
  });

  const enrollmentViewFromDto = (e: {
    id: string;
    personKey: string;
    displayName: string;
    unitCode: string;
    seedRating: number;
    eligibilityStatus: string;
    checkedInAt: string | null;
    pinnedBotRevisionId: string | null;
    botReadinessStatus: string;
  }): EnrollmentView => ({
    enrollmentId: e.id,
    personKey: e.personKey,
    displayName: e.displayName,
    unitCode: e.unitCode,
    seedRating: e.seedRating,
    eligibilityStatus: e.eligibilityStatus,
    checkedInAt: e.checkedInAt,
    pinnedBotRevisionId: e.pinnedBotRevisionId,
    botReadinessStatus: e.botReadinessStatus,
  });

  app.get("/api/me/tournaments", async (request, reply) => {
    const user = await requireAccountUser(request, auth);
    const items: Array<{ tournament: TournamentSummary; enrollment: EnrollmentView }> = [];
    const seenEnrollmentIds = new Set<string>();

    if (database) {
      const rows = await database.tournamentEnrollmentRecord.findMany({
        where: { userId: user.id },
        include: { tournament: true },
        orderBy: { createdAt: "asc" },
      });
      for (const row of rows) {
        seenEnrollmentIds.add(row.id);
        items.push({
          tournament: summaryFromCore({
            id: row.tournament.id,
            status: row.tournament.status,
            revision: row.tournament.revision,
            coreConfig: (row.tournament.coreConfig as Record<string, unknown>) ?? {},
            startedAt: iso(row.tournament.startedAt),
            endedAt: iso(row.tournament.endedAt),
            cancelledAt: iso(row.tournament.cancelledAt),
          }),
          enrollment: enrollmentViewFromRow(row),
        });
      }
    }

    // In-memory enrollments created this process (store path) not yet flushed.
    for (const enrollment of store.enrollments.values()) {
      if (enrollment.userId !== user.id || seenEnrollmentIds.has(enrollment.id)) continue;
      const tournament = store.tournaments.get(enrollment.tournamentId);
      if (!tournament) continue;
      seenEnrollmentIds.add(enrollment.id);
      items.push({
        tournament: summaryFromDto(tournament as unknown as Parameters<typeof summaryFromCore>[0] & { coreConfig: Record<string, unknown> }),
        enrollment: enrollmentViewFromDto(enrollment),
      });
    }

    items.sort((a, b) => a.tournament.tournamentName.localeCompare(b.tournament.tournamentName, "vi"));
    return reply.status(200).send({ items });
  });

  app.get<{ Params: { tournamentId: string } }>(
    "/api/me/tournaments/:tournamentId",
    async (request, reply) => {
      const user = await requireAccountUser(request, auth);
      const { tournamentId } = request.params;

      let summary: TournamentSummary | null = null;
      let enrollmentView: EnrollmentView | null = null;
      let enrollmentId: string | null = null;

      if (database) {
        const row = await database.tournamentEnrollmentRecord.findFirst({
          where: { tournamentId, userId: user.id },
          include: { tournament: true },
        });
        if (row) {
          summary = summaryFromCore({
            id: row.tournament.id,
            status: row.tournament.status,
            revision: row.tournament.revision,
            coreConfig: (row.tournament.coreConfig as Record<string, unknown>) ?? {},
            startedAt: iso(row.tournament.startedAt),
            endedAt: iso(row.tournament.endedAt),
            cancelledAt: iso(row.tournament.cancelledAt),
          });
          enrollmentView = enrollmentViewFromRow(row);
          enrollmentId = row.id;
        }
      }

      if (!summary || !enrollmentId) {
        const enrollment = Array.from(store.enrollments.values()).find(
          (e) => e.tournamentId === tournamentId && e.userId === user.id
        );
        const tournament = store.tournaments.get(tournamentId);
        if (enrollment && tournament) {
          summary = summaryFromDto(tournament as unknown as Parameters<typeof summaryFromCore>[0] & { coreConfig: Record<string, unknown> });
          enrollmentView = enrollmentViewFromDto(enrollment);
          enrollmentId = enrollment.id;
        }
      }

      if (!summary || !enrollmentView || !enrollmentId) {
        throw new AppError(
          "NOT_FOUND",
          "Bạn không có trong danh sách thí sinh của giải đấu này.",
          404,
          false,
          "INVALID",
          { reason: "RESOURCE_NOT_FOUND", tournamentId }
        );
      }

      // My matches: the pairing engine assigns participants by enrollment id.
      const nameByEnrollmentId = new Map<string, string>();
      if (database) {
        const rows = await database.tournamentEnrollmentRecord.findMany({
          where: { tournamentId },
          select: { id: true, displayName: true },
        });
        for (const row of rows) nameByEnrollmentId.set(row.id, row.displayName);
      }
      for (const e of store.enrollments.values()) {
        if (e.tournamentId === tournamentId) nameByEnrollmentId.set(e.id, e.displayName);
      }

      const myMatches = Array.from(store.matches.values())
        .filter(
          (m) =>
            m.tournamentId === tournamentId &&
            (m.blueParticipantId === enrollmentId || m.redParticipantId === enrollmentId)
        )
        .map((m) => {
          const mySide = m.blueParticipantId === enrollmentId ? "BLUE" : "RED";
          const opponentId = mySide === "BLUE" ? m.redParticipantId : m.blueParticipantId;
          return {
            matchId: m.matchId,
            roomId: m.roomId,
            mySide,
            opponentId,
            opponentName: nameByEnrollmentId.get(opponentId) ?? "Thí sinh",
            status: m.status,
            winnerSide: m.winnerSide,
            iWon: m.winnerSide === mySide,
            finishSequence: m.finishSequence,
            pinnedConfigVersionNumber: m.pinnedConfigVersionNumber,
            createdAt: m.createdAt,
            endedAt: m.endedAt,
          };
        })
        .sort((a, b) => (a.finishSequence ?? 0) - (b.finishSequence ?? 0));

      // Standings follow the tournament's leaderboard visibility policy.
      const visibility = summary.leaderboardVisibility;
      const isOver = TERMINAL_STATUSES.has(summary.status);
      let standings: unknown = null;
      let standingsHiddenReason: string | null = null;
      if (visibility === "HIDDEN_UNTIL_END" && !isOver) {
        standingsHiddenReason = "HIDDEN_UNTIL_END";
      } else {
        try {
          standings = adjudicationLedgerService.computeLeaderboardSnapshot(tournamentId);
        } catch {
          standings = null;
        }
      }

      return reply.status(200).send({
        tournament: summary,
        enrollment: enrollmentView,
        myMatches,
        standings,
        standingsHiddenReason,
      });
    }
  );
}
