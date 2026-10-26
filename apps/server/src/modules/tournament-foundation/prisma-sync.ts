import type { PrismaClient } from "@prisma/client";
import type {
  TournamentStateStore,
} from "./tournament-store.js";
import {
  DEFAULT_TOURNAMENT_RULE_PROFILE,
  type ManualAdjudicationRequestDto,
  type TournamentChangeRequestDto,
  type TournamentConfigVersionDto,
  type TournamentContractDto,
  type TournamentDto,
  type TournamentScoreLedgerEntryDto,
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

    // 8. Config versions (published rule/config snapshots must survive restarts)
    const versions = await prisma.tournamentConfigVersionRecord.findMany({
      orderBy: [{ tournamentId: "asc" }, { versionNumber: "asc" }],
    });
    for (const v of versions) {
      const list = store.configVersions.get(v.tournamentId) ?? [];
      if (!list.some((x) => x.id === v.id)) {
        list.push({
          id: v.id,
          tournamentId: v.tournamentId,
          versionNumber: v.versionNumber,
          coreConfigSnapshot: v.coreConfigSnapshot as any,
          ruleProfileSnapshot: v.ruleProfileSnapshot as any,
          effectiveAt: v.effectiveAt.toISOString(),
          publishedByUserId: v.publishedByUserId,
          changeSummary: v.changeSummary,
          createdAt: v.createdAt.toISOString(),
        });
        store.configVersions.set(v.tournamentId, list);
      }
    }

    // 9. Change requests (the approval queue must survive restarts)
    const changeRequests = await prisma.tournamentChangeRequestRecord.findMany({
      orderBy: { createdAt: "asc" },
    });
    for (const cr of changeRequests) {
      if (store.changeRequests.has(cr.id)) continue;
      const owner = store.tournaments.get(cr.tournamentId);
      store.changeRequests.set(cr.id, {
        id: cr.id,
        tournamentId: cr.tournamentId,
        tournamentCode: owner?.coreConfig?.tournamentCode ?? cr.tournamentId,
        tournamentName: owner?.coreConfig?.tournamentName ?? "Giải đấu",
        contractId: cr.contractId,
        requestedByTaUserId: cr.requestedByTaUserId,
        status: cr.status as any,
        reason: cr.reason,
        proposedCoreConfigPatch: (cr.proposedCoreConfigPatch as any) ?? undefined,
        proposedRuleProfilePatch: (cr.proposedRuleProfilePatch as any) ?? undefined,
        effectiveAt: cr.effectiveAt.toISOString(),
        diffs: (cr.diffs as any) ?? [],
        reviewedByAdminUserId: cr.reviewedByAdminUserId ?? null,
        reviewNote: cr.reviewNote ?? null,
        reviewedAt: cr.reviewedAt?.toISOString() ?? null,
        appliedConfigVersionId: cr.appliedConfigVersionId ?? null,
        createdAt: cr.createdAt.toISOString(),
        updatedAt: cr.updatedAt.toISOString(),
      });
    }

    // 10. Rebuild finish-sequence counters from the persisted score ledger so a
    // restart cannot allocate a duplicate finish_sequence for the same tournament.
    for (const [tournamentId, entries] of store.scoreLedger) {
      const maxSequence = entries.reduce((max, e) => Math.max(max, e.finishSequence ?? 0), 0);
      if (maxSequence > 0) {
        store.finishSequenceCounters.set(tournamentId, maxSequence);
      }
    }
  } catch (err) {
    // Fail fast: booting with an empty authoritative store would let referees and
    // admins operate on data that no longer matches PostgreSQL. app.ts awaits this
    // inside `if (database instanceof PrismaDatabase)`, so a Prisma-less server is
    // unaffected and a configured database must be reachable before startup finishes.
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Không thể nạp dữ liệu giải đấu từ PostgreSQL khi khởi động: ${message}`, { cause: err });
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
    // Fail closed: the in-memory store is only mutated by callers AFTER this
    // upsert resolves, so a failed persist must abort the whole operation
    // instead of leaving PostgreSQL silently out of sync until the next restart.
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Không thể lưu giải đấu vào PostgreSQL: ${message}`, { cause: err });
  }
}

export async function deleteTournamentFromPrisma(
  prisma: PrismaClient,
  tournamentId: string
): Promise<void> {
  try {
    await prisma.tournament.delete({ where: { id: tournamentId } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Không thể xóa giải đấu khỏi PostgreSQL: ${message}`, { cause: err });
  }
}

export async function persistUnitToPrisma(prisma: PrismaClient, u: UnitDto): Promise<void> {
  try {
    await prisma.unit.upsert({
      where: { id: u.id },
      update: {
        unitCode: u.unitCode,
        unitName: u.unitName,
        unitType: u.unitType,
        contactName: u.contactName,
        contactEmail: u.contactEmail,
        status: u.status,
      },
      create: {
        id: u.id,
        unitCode: u.unitCode,
        unitName: u.unitName,
        unitType: u.unitType,
        contactName: u.contactName,
        contactEmail: u.contactEmail,
        status: u.status,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Không thể lưu đơn vị vào PostgreSQL: ${message}`, { cause: err });
  }
}

export async function deleteUnitFromPrisma(prisma: PrismaClient, unitId: string): Promise<void> {
  try {
    await prisma.unit.delete({ where: { id: unitId } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Không thể xóa đơn vị khỏi PostgreSQL: ${message}`, { cause: err });
  }
}

/**
 * Upserts the contract row and mirrors the in-memory TA binding list:
 * every DTO binding is upserted by id, and DB rows that no longer exist in the
 * DTO are removed. The service layer only mutates the store after this resolves.
 */
export async function persistContractToPrisma(
  prisma: PrismaClient,
  c: TournamentContractDto
): Promise<void> {
  try {
    const row = {
      contractCode: c.contractCode,
      unitId: c.unitId,
      status: c.status,
      validFrom: new Date(c.validFrom),
      validTo: new Date(c.validTo),
      maxTournamentsTotal: c.maxTournamentsTotal,
      quotaReservedCount: c.quotaReservedCount,
      quotaConsumedCount: c.quotaConsumedCount,
      maxParticipantsPerTournament: c.maxParticipantsPerTournament,
      maxParticipantsTotal: c.maxParticipantsTotal,
      allowedModes: c.allowedModes as any,
      policyEnvelope: c.policyEnvelope as any,
      technicalCaps: c.technicalCaps as any,
    };
    await prisma.tournamentContract.upsert({
      where: { id: c.id },
      update: row,
      create: { id: c.id, ...row },
    });

    for (const b of c.taBindings) {
      const bindingRow = {
        contractId: c.id,
        userId: b.userId,
        username: b.username ?? null,
        displayName: b.displayName ?? null,
        status: b.status,
        grantedByUserId: b.grantedByUserId,
        grantedAt: new Date(b.grantedAt),
        revokedAt: b.revokedAt ? new Date(b.revokedAt) : null,
        revokeReason: b.revokeReason ?? null,
      };
      await prisma.tournamentContractTaBinding.upsert({
        where: { id: b.id },
        update: bindingRow,
        create: { id: b.id, ...bindingRow },
      });
    }

    const keepIds = c.taBindings.map((b) => b.id);
    await prisma.tournamentContractTaBinding.deleteMany({
      where: { contractId: c.id, id: { notIn: keepIds } },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Không thể lưu hợp đồng vào PostgreSQL: ${message}`, { cause: err });
  }
}

export async function persistChangeRequestToPrisma(
  prisma: PrismaClient,
  cr: TournamentChangeRequestDto
): Promise<void> {
  try {
    const row = {
      tournamentId: cr.tournamentId,
      contractId: cr.contractId,
      requestedByTaUserId: cr.requestedByTaUserId,
      status: cr.status,
      reason: cr.reason,
      proposedCoreConfigPatch: (cr.proposedCoreConfigPatch as any) ?? null,
      proposedRuleProfilePatch: (cr.proposedRuleProfilePatch as any) ?? null,
      effectiveAt: new Date(cr.effectiveAt),
      diffs: cr.diffs as any,
      reviewedByAdminUserId: cr.reviewedByAdminUserId ?? null,
      reviewNote: cr.reviewNote ?? null,
      reviewedAt: cr.reviewedAt ? new Date(cr.reviewedAt) : null,
      appliedConfigVersionId: cr.appliedConfigVersionId ?? null,
    };
    await prisma.tournamentChangeRequestRecord.upsert({
      where: { id: cr.id },
      update: row,
      create: { id: cr.id, ...row },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Không thể lưu yêu cầu thay đổi vào PostgreSQL: ${message}`, { cause: err });
  }
}

export async function persistConfigVersionToPrisma(
  prisma: PrismaClient,
  v: TournamentConfigVersionDto
): Promise<void> {
  try {
    const row = {
      tournamentId: v.tournamentId,
      versionNumber: v.versionNumber,
      coreConfigSnapshot: v.coreConfigSnapshot as any,
      ruleProfileSnapshot: v.ruleProfileSnapshot as any,
      effectiveAt: new Date(v.effectiveAt),
      publishedByUserId: v.publishedByUserId,
      changeSummary: v.changeSummary,
    };
    await prisma.tournamentConfigVersionRecord.upsert({
      where: { id: v.id },
      update: row,
      create: { id: v.id, ...row },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Không thể lưu phiên bản luật vào PostgreSQL: ${message}`, { cause: err });
  }
}

export async function persistAdjudicationRequestToPrisma(
  prisma: PrismaClient,
  a: ManualAdjudicationRequestDto
): Promise<void> {
  try {
    const row = {
      tournamentId: a.tournamentId,
      matchId: a.matchId,
      roomId: a.roomId,
      blueParticipantId: a.blueParticipantId,
      redParticipantId: a.redParticipantId,
      status: a.status,
      frozenSnapshot: a.frozenSnapshot as any,
      deadlineAt: new Date(a.deadlineAt),
      fallbackPolicy: a.fallbackPolicy,
      winnerSide: a.winnerSide ?? null,
      decidedByUserId: a.decidedByUserId ?? null,
      decisionReason: a.decisionReason ?? null,
      decidedAt: a.decidedAt ? new Date(a.decidedAt) : null,
      finishSequence: a.finishSequence ?? null,
    };
    await prisma.manualAdjudicationRequestRecord.upsert({
      where: { id: a.id },
      update: row,
      create: { id: a.id, ...row },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Không thể lưu yêu cầu phán quyết vào PostgreSQL: ${message}`, { cause: err });
  }
}

export async function persistScoreLedgerEntryToPrisma(
  prisma: PrismaClient,
  e: TournamentScoreLedgerEntryDto
): Promise<void> {
  try {
    const row = {
      tournamentId: e.tournamentId,
      matchId: e.matchId,
      finishSequence: e.finishSequence,
      blueParticipantId: e.blueParticipantId,
      redParticipantId: e.redParticipantId,
      winnerSide: e.winnerSide,
      resolutionSource: e.resolutionSource,
      blueEloBefore: e.blueEloBefore,
      blueEloAfter: e.blueEloAfter,
      blueScoreBefore: e.blueScoreBefore,
      blueScoreAfter: e.blueScoreAfter,
      redEloBefore: e.redEloBefore,
      redEloAfter: e.redEloAfter,
      redScoreBefore: e.redScoreBefore,
      redScoreAfter: e.redScoreAfter,
      finishedAt: new Date(e.finishedAt),
    };
    await prisma.tournamentScoreLedgerRecord.upsert({
      where: { id: e.id },
      update: row,
      create: { id: e.id, ...row },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Không thể lưu sổ điểm vào PostgreSQL: ${message}`, { cause: err });
  }
}

