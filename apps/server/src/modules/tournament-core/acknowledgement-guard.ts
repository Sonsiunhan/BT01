import type { Prisma, PrismaClient } from "@prisma/client";
import { PublishedRegulationsSchema } from "@ottv2/contracts";
import { AppError } from "../../shared/errors/app-error.js";
import {
  TournamentAcknowledgementService,
  type AcknowledgementActor,
} from "../tournament-acknowledgement/acknowledgement.service.js";

/**
 * Server-side gate for the lifecycle boundary. The lifecycle store owns the
 * transition, while this guard reads the durable account/enrollment/ACK
 * records in one serializable database transaction immediately before that
 * transition. D10-B owns the cross-store fault/race proof.
 */
export interface TournamentAcknowledgementGuard {
  assertReadyForStart(
    tournamentId: string,
    expectedVersionId: string,
    transactionClient?: Prisma.TransactionClient,
  ): Promise<void>;
}

function staleVersion(): AppError {
  return new AppError(
    "CONFLICT",
    "Phiên bản điều lệ đã thay đổi. Vui lòng tải lại.",
    409,
    false,
    "RECOVERABLE",
    { reason: "STALE_RULE_VERSION" },
  );
}

export class PrismaTournamentAcknowledgementGuard implements TournamentAcknowledgementGuard {
  private readonly acknowledgementService: TournamentAcknowledgementService;

  constructor(
    private readonly db: PrismaClient,
    acknowledgementService?: TournamentAcknowledgementService,
  ) {
    this.acknowledgementService = acknowledgementService ?? new TournamentAcknowledgementService(db);
  }

  async assertReadyForStart(
    tournamentId: string,
    expectedVersionId: string,
    transactionClient?: Prisma.TransactionClient,
  ): Promise<void> {
    const check = async (tx: Prisma.TransactionClient) => {
          const tournament = await tx.tournament.findUnique({
            where: { id: tournamentId },
            select: { id: true, contractId: true, activeConfigVersionId: true },
          });
          if (!tournament || tournament.activeConfigVersionId !== expectedVersionId) throw staleVersion();

          const version = await tx.tournamentConfigVersionRecord.findUnique({
            where: { id: expectedVersionId },
            select: { id: true, tournamentId: true, coreConfigSnapshot: true },
          });
          if (!version || version.tournamentId !== tournamentId) throw staleVersion();
          const regulations = PublishedRegulationsSchema.safeParse(version.coreConfigSnapshot);
          if (!regulations.success) {
            throw new AppError(
              "CONFLICT",
              "Điều lệ chưa được công bố hoặc không hợp lệ.",
              409,
              false,
              "RECOVERABLE",
              { reason: "REGULATIONS_NOT_PUBLISHED" },
            );
          }
          if (!regulations.data.rulesAckRequired) return;

          const enrollments = await tx.tournamentEnrollmentRecord.findMany({
            where: { tournamentId, contractId: tournament.contractId, eligibilityStatus: "ELIGIBLE", userId: { not: null } },
            select: { userId: true },
          });
          for (const enrollment of enrollments) {
            if (!enrollment.userId) continue;
            const actor: AcknowledgementActor = { userId: enrollment.userId, principal: "ACCOUNT" };
            await this.acknowledgementService.assertAcknowledged(
              actor,
              { tournamentId, contractId: tournament.contractId },
              expectedVersionId,
              tx,
            );
          }
        };

    if (transactionClient) {
      await check(transactionClient);
      return;
    }
    for (let attempt = 0; ; attempt += 1) {
      try {
        await this.db.$transaction(check, { isolationLevel: "Serializable" });
        return;
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== "P2034" || attempt >= 2) throw error;
      }
    }
  }
}

