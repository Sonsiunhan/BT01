import type { Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "../../shared/errors/app-error.js";

/**
 * The lifecycle store is in-process, while ACK/readiness state is durable.
 * This port gives a start transition one database transaction and a
 * transaction-scoped advisory lock shared with referee mutations. The
 * callback is deliberately small so this is a boundary, not a new domain
 * persistence abstraction.
 */
export interface TournamentStartTransaction {
  run<T>(
    tournamentId: string,
    callback: (transactionClient: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T>;
}

function retryRequired(): AppError {
  return new AppError(
    "CONFLICT",
    "Dữ liệu giải đấu đang thay đổi. Vui lòng thử lại.",
    409,
    true,
    "RECOVERABLE",
    { reason: "LIFECYCLE_RETRY_REQUIRED" },
  );
}

export class PrismaTournamentStartTransaction implements TournamentStartTransaction {
  constructor(private readonly db: PrismaClient) {}

  async run<T>(
    tournamentId: string,
    callback: (transactionClient: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.db.$transaction(async (tx) => {
          // The same key is acquired by staff accept/revoke/expiry. It orders
          // the readiness read and lifecycle commit against those mutations.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ottv2:tournament:${tournamentId}`}))`;
          return callback(tx);
        }, { isolationLevel: "Serializable" });
      } catch (error) {
        if ((error as { code?: string }).code !== "P2034") throw error;
        if (attempt >= 2) throw retryRequired();
      }
    }
  }
}
