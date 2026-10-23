import type { Prisma, PrismaClient } from "@prisma/client";
import type { TournamentDto } from "@ottv2/contracts";
import type { TournamentStateStore } from "../tournament-foundation/tournament-store.js";

export interface ReadinessParticipantCounts {
  eligibleParticipantsCount: number;
  botNotReadyCount: number;
  totalEnrolledCount: number;
}

export interface ReadinessStaffCounts {
  activeStaffCount: number;
  activeRefereeCount: number;
}

export interface ReadinessSourcesPort {
  countParticipants(
    tournament: TournamentDto,
    transactionClient?: Prisma.TransactionClient,
  ): Promise<ReadinessParticipantCounts> | ReadinessParticipantCounts;
  countStaff(
    tournamentId: string,
    transactionClient?: Prisma.TransactionClient,
  ): Promise<ReadinessStaffCounts> | ReadinessStaffCounts;
}

export class InMemoryReadinessSourcesAdapter implements ReadinessSourcesPort {
  constructor(private readonly store: TournamentStateStore) {}

  countParticipants(tournament: TournamentDto): ReadinessParticipantCounts {
    let eligibleParticipantsCount = 0;
    let botNotReadyCount = 0;
    let totalEnrolledCount = 0;

    for (const e of this.store.enrollments.values()) {
      if (e.tournamentId !== tournament.id) continue;
      totalEnrolledCount += 1;
      if (e.eligibilityStatus !== "ELIGIBLE") continue;
      // Q2 Decision: Only count participants who have linked user accounts (claimed / activated)
      if (!e.userId) continue;
      if (tournament.coreConfig.checkinRequired && !e.checkedInAt) continue;
      if (
        tournament.coreConfig.competitionMode === "BOT_VS_BOT" &&
        e.botReadinessStatus !== "READY"
      ) {
        botNotReadyCount += 1;
        continue;
      }
      eligibleParticipantsCount += 1;
    }

    return {
      eligibleParticipantsCount,
      botNotReadyCount,
      totalEnrolledCount,
    };
  }

  countStaff(tournamentId: string): ReadinessStaffCounts {
    let activeStaffCount = 0;
    let activeRefereeCount = 0;

    for (const s of this.store.staffAssignments.values()) {
      if (s.tournamentId !== tournamentId || s.status !== "ACTIVE") continue;
      if (s.role === "REFEREE") activeRefereeCount += 1;
      else activeStaffCount += 1;
    }

    return { activeStaffCount, activeRefereeCount };
  }
}

export class PrismaReadinessSourcesAdapter implements ReadinessSourcesPort {
  constructor(private readonly db: PrismaClient) {}

  async countParticipants(tournament: TournamentDto, transactionClient?: Prisma.TransactionClient): Promise<ReadinessParticipantCounts> {
    const client = transactionClient ?? this.db;
    const records = await client.tournamentEnrollmentRecord.findMany({
      where: { tournamentId: tournament.id },
      select: {
        id: true,
        userId: true,
        eligibilityStatus: true,
        checkedInAt: true,
        botReadinessStatus: true,
      },
    });

    let eligibleParticipantsCount = 0;
    let botNotReadyCount = 0;

    for (const r of records) {
      if (r.eligibilityStatus !== "ELIGIBLE") continue;
      // Q2 Decision: Only count participants who have linked user accounts (claimed / activated)
      if (!r.userId) continue;
      if (tournament.coreConfig.checkinRequired && !r.checkedInAt) continue;
      if (
        tournament.coreConfig.competitionMode === "BOT_VS_BOT" &&
        r.botReadinessStatus !== "READY"
      ) {
        botNotReadyCount += 1;
        continue;
      }
      eligibleParticipantsCount += 1;
    }

    return {
      eligibleParticipantsCount,
      botNotReadyCount,
      totalEnrolledCount: records.length,
    };
  }

  async countStaff(tournamentId: string, transactionClient?: Prisma.TransactionClient): Promise<ReadinessStaffCounts> {
    const client = transactionClient ?? this.db;
    const records = await client.tournamentStaffAssignmentRecord.findMany({
      where: { tournamentId, status: "ACTIVE" },
      select: { role: true },
    });

    let activeStaffCount = 0;
    let activeRefereeCount = 0;

    for (const r of records) {
      if (r.role === "REFEREE") activeRefereeCount += 1;
      else activeStaffCount += 1;
    }

    return { activeStaffCount, activeRefereeCount };
  }
}
