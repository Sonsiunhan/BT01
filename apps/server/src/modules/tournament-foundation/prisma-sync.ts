import type { PrismaClient } from "@prisma/client";
import type {
  TournamentStateStore,
} from "./tournament-store.js";
import {
  DEFAULT_TOURNAMENT_RULE_PROFILE,
  type TournamentContractDto,
  type TournamentDto,
  type UnitDto,
} from "@ottv2/contracts";

/**
 * Hydrates in-memory TournamentStateStore with records from PostgreSQL (Prisma).
 * Runs at Fastify server startup so that tournaments, contracts and units
 * are resilient across process restarts.
 */
export async function syncPrismaToTournamentStore(
  prisma: PrismaClient,
  store: TournamentStateStore
): Promise<{ unitsCount: number; contractsCount: number; tournamentsCount: number }> {
  let unitsCount = 0;
  let contractsCount = 0;
  let tournamentsCount = 0;

  try {
    // 1. Units
    const units = await prisma.unit.findMany();
    for (const u of units) {
      if (!store.units.has(u.id)) {
        const unitDto: UnitDto = {
          id: u.id,
          unitCode: u.unitCode,
          unitName: u.unitName,
          unitType: u.unitType as any,
          contactName: u.contactName,
          contactEmail: u.contactEmail,
          status: u.status as any,
          referencedContractsCount: 0,
          referencedTournamentsCount: 0,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
        };
        store.units.set(u.id, unitDto);
        unitsCount++;
      }
    }

    // 2. Contracts
    const contracts = await prisma.tournamentContract.findMany({
      include: {
        unit: true,
        taBindings: true,
      },
    });
    for (const c of contracts) {
      if (!store.contracts.has(c.id)) {
        const contractDto: TournamentContractDto = {
          id: c.id,
          contractCode: c.contractCode,
          unitId: c.unitId,
          unitCode: c.unit.unitCode,
          unitName: c.unit.unitName,
          status: c.status as any,
          validFrom: c.validFrom.toISOString(),
          validTo: c.validTo.toISOString(),
          maxTournamentsTotal: c.maxTournamentsTotal,
          quotaReservedCount: c.quotaReservedCount,
          quotaConsumedCount: c.quotaConsumedCount,
          quotaRemainingCount: Math.max(0, c.maxTournamentsTotal - (c.quotaReservedCount + c.quotaConsumedCount)),
          maxParticipantsPerTournament: c.maxParticipantsPerTournament,
          maxParticipantsTotal: c.maxParticipantsTotal,
          currentParticipantsTotal: 0,
          allowedModes: (c.allowedModes as any) ?? ["HUMAN_ONLINE"],
          policyEnvelope: (c.policyEnvelope as any) ?? {},
          technicalCaps: (c.technicalCaps as any) ?? {},
          taBindings: c.taBindings.map((b) => ({
            id: b.id,
            contractId: b.contractId,
            userId: b.userId,
            username: b.username ?? undefined,
            displayName: b.displayName ?? undefined,
            status: b.status as any,
            grantedByUserId: b.grantedByUserId,
            grantedAt: b.grantedAt.toISOString(),
            revokedAt: b.revokedAt?.toISOString() ?? null,
            revokeReason: b.revokeReason ?? null,
          })),
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        };
        store.contracts.set(c.id, contractDto);
        contractsCount++;
      }
    }

    // 3. Tournaments
    const tournaments = await prisma.tournament.findMany({
      include: {
        contract: true,
      },
    });
    const dbTourIds = new Set(tournaments.map((t) => t.id));
    for (const existingId of Array.from(store.tournaments.keys())) {
      if (!dbTourIds.has(existingId)) {
        store.tournaments.delete(existingId);
      }
    }
    for (const t of tournaments) {
      const tournamentDto: TournamentDto = {
        id: t.id,
        contractId: t.contractId,
        contractCode: t.contract.contractCode,
        unitId: t.unitId,
        ownerTaUserId: t.ownerTaUserId,
        status: t.status as any,
        revision: t.revision,
        coreConfig: (t.coreConfig as any) ?? {},
        ruleProfile: (t.ruleProfile as any) ?? DEFAULT_TOURNAMENT_RULE_PROFILE,
        activeConfigVersionId: t.activeConfigVersionId ?? null,
        activeConfigVersionNumber: t.activeConfigVersionNumber ?? 0,
        approvedSnapshot: (t.approvedSnapshot as any) ?? null,
        everApproved: t.everApproved,
        quotaRefunded: t.quotaRefunded,
        submittedAt: t.submittedAt?.toISOString() ?? null,
        approvedAt: t.approvedAt?.toISOString() ?? null,
        rejectedAt: t.rejectedAt?.toISOString() ?? null,
        changesRequestedAt: t.changesRequestedAt?.toISOString() ?? null,
        lastReviewNote: t.lastReviewNote ?? null,
        lastReviewFieldNotes: {},
        startedAt: t.startedAt?.toISOString() ?? null,
        pausedAt: t.pausedAt?.toISOString() ?? null,
        pauseReason: t.pauseReason ?? null,
        endedAt: t.endedAt?.toISOString() ?? null,
        cancelledAt: t.cancelledAt?.toISOString() ?? null,
        cancelReason: t.cancelReason ?? null,
        finalizedAt: t.finalizedAt?.toISOString() ?? null,
        copiedFromTournamentId: t.copiedFromTournamentId ?? null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      };
      store.tournaments.set(t.id, tournamentDto);
      tournamentsCount++;
    }

    // 4. Adjudication Requests
    const adjudications = await prisma.manualAdjudicationRequestRecord.findMany();
    for (const a of adjudications) {
      store.adjudicationRequests.set(a.id, {
        id: a.id,
        tournamentId: a.tournamentId,
        matchId: a.matchId,
        roomId: a.roomId,
        blueParticipantId: a.blueParticipantId,
        redParticipantId: a.redParticipantId,
        status: a.status as any,
        frozenSnapshot: a.frozenSnapshot as any,
        deadlineAt: a.deadlineAt.toISOString(),
        fallbackPolicy: a.fallbackPolicy as any,
        winnerSide: (a.winnerSide as any) ?? null,
        decidedByUserId: a.decidedByUserId ?? null,
        decisionReason: a.decisionReason ?? null,
        decidedAt: a.decidedAt?.toISOString() ?? null,
        finishSequence: a.finishSequence ?? null,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      });
    }

    // 5. Score Ledger Records
    const ledgerRecords = await prisma.tournamentScoreLedgerRecord.findMany({
      orderBy: { finishSequence: "asc" },
    });
    for (const l of ledgerRecords) {
      const list = store.scoreLedger.get(l.tournamentId) ?? [];
      if (!list.some((item) => item.id === l.id)) {
        list.push({
          id: l.id,
          tournamentId: l.tournamentId,
          matchId: l.matchId,
          finishSequence: l.finishSequence,
          blueParticipantId: l.blueParticipantId,
          redParticipantId: l.redParticipantId,
          winnerSide: l.winnerSide as any,
          resolutionSource: l.resolutionSource as any,
          blueEloBefore: l.blueEloBefore,
          blueEloAfter: l.blueEloAfter,
          blueScoreBefore: l.blueScoreBefore,
          blueScoreAfter: l.blueScoreAfter,
          redEloBefore: l.redEloBefore,
          redEloAfter: l.redEloAfter,
          redScoreBefore: l.redScoreBefore,
          redScoreAfter: l.redScoreAfter,
          finishedAt: l.finishedAt.toISOString(),
        });
        store.scoreLedger.set(l.tournamentId, list);
      }
    }

    // 6. Enrollments
    const enrollments = await prisma.tournamentEnrollmentRecord.findMany();
    for (const e of enrollments) {
      if (!store.enrollments.has(e.id)) {
        store.enrollments.set(e.id, {
          id: e.id,
          tournamentId: e.tournamentId,
          contractId: e.contractId,
          personKey: e.personKey,
          userId: e.userId ?? null,
          displayName: e.displayName,
          unitCode: e.unitCode,
          email: e.email ?? null,
          seedRating: e.seedRating,
          eligibilityStatus: e.eligibilityStatus as any,
          checkedInAt: e.checkedInAt?.toISOString() ?? null,
          pinnedBotRevisionId: e.pinnedBotRevisionId ?? null,
          botReadinessStatus: e.botReadinessStatus as any,
          createdAt: e.createdAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
        });
      }
    }

    // 7. Staff Assignments
    const staff = await prisma.tournamentStaffAssignmentRecord.findMany();
    for (const s of staff) {
      if (!store.staffAssignments.has(s.id)) {
        store.staffAssignments.set(s.id, {
          id: s.id,
          tournamentId: s.tournamentId,
          userId: s.userId,
          role: s.role as any,
          status: s.status as any,
          assignedRooms: (s.assignedRooms as any) ?? [],
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        });
      }
    }
  } catch (err) {
    // If table doesn't exist yet (e.g. before initial migration in test), log and continue safely
    console.warn("[syncPrismaToTournamentStore] Warning during database hydration:", (err as Error).message);
  }

  return { unitsCount, contractsCount, tournamentsCount };
}

export async function persistTournamentToPrisma(
  prisma: PrismaClient,
  t: TournamentDto
): Promise<void> {
  try {
    await prisma.tournament.upsert({
      where: { id: t.id },
      update: {
        tournamentCode: t.coreConfig.tournamentCode,
        contractId: t.contractId,
        unitId: t.unitId,
        ownerTaUserId: t.ownerTaUserId,
        status: t.status,
        revision: t.revision,
        coreConfig: t.coreConfig as any,
        ruleProfile: t.ruleProfile as any,
        activeConfigVersionId: t.activeConfigVersionId,
        activeConfigVersionNumber: t.activeConfigVersionNumber,
        approvedSnapshot: t.approvedSnapshot as any,
        everApproved: t.everApproved,
        quotaRefunded: t.quotaRefunded,
        submittedAt: t.submittedAt ? new Date(t.submittedAt) : null,
        approvedAt: t.approvedAt ? new Date(t.approvedAt) : null,
        rejectedAt: t.rejectedAt ? new Date(t.rejectedAt) : null,
        changesRequestedAt: t.changesRequestedAt ? new Date(t.changesRequestedAt) : null,
        lastReviewNote: t.lastReviewNote,
        startedAt: t.startedAt ? new Date(t.startedAt) : null,
        pausedAt: t.pausedAt ? new Date(t.pausedAt) : null,
        pauseReason: t.pauseReason,
        endedAt: t.endedAt ? new Date(t.endedAt) : null,
        cancelledAt: t.cancelledAt ? new Date(t.cancelledAt) : null,
        cancelReason: t.cancelReason,
        finalizedAt: t.finalizedAt ? new Date(t.finalizedAt) : null,
        copiedFromTournamentId: t.copiedFromTournamentId,
      },
      create: {
        id: t.id,
        tournamentCode: t.coreConfig.tournamentCode,
        contractId: t.contractId,
        unitId: t.unitId,
        ownerTaUserId: t.ownerTaUserId,
        status: t.status,
        revision: t.revision,
        coreConfig: t.coreConfig as any,
        ruleProfile: t.ruleProfile as any,
        activeConfigVersionId: t.activeConfigVersionId,
        activeConfigVersionNumber: t.activeConfigVersionNumber,
        approvedSnapshot: t.approvedSnapshot as any,
        everApproved: t.everApproved,
        quotaRefunded: t.quotaRefunded,
        submittedAt: t.submittedAt ? new Date(t.submittedAt) : null,
        approvedAt: t.approvedAt ? new Date(t.approvedAt) : null,
        rejectedAt: t.rejectedAt ? new Date(t.rejectedAt) : null,
        changesRequestedAt: t.changesRequestedAt ? new Date(t.changesRequestedAt) : null,
        lastReviewNote: t.lastReviewNote,
        startedAt: t.startedAt ? new Date(t.startedAt) : null,
        pausedAt: t.pausedAt ? new Date(t.pausedAt) : null,
        pauseReason: t.pauseReason,
        endedAt: t.endedAt ? new Date(t.endedAt) : null,
        cancelledAt: t.cancelledAt ? new Date(t.cancelledAt) : null,
        cancelReason: t.cancelReason,
        finalizedAt: t.finalizedAt ? new Date(t.finalizedAt) : null,
        copiedFromTournamentId: t.copiedFromTournamentId,
      },
    });
  } catch (err) {
    console.warn("[persistTournamentToPrisma] Warning persisting tournament:", (err as Error).message);
  }
}

export async function deleteTournamentFromPrisma(
  prisma: PrismaClient,
  tournamentId: string
): Promise<void> {
  try {
    await prisma.tournament.delete({ where: { id: tournamentId } });
  } catch (err) {
    console.warn("[deleteTournamentFromPrisma] Warning deleting tournament:", (err as Error).message);
  }
}

