import { Prisma, type PrismaClient } from "@prisma/client";

export const SOURCE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const PRIVATE_LOGS_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface GcReport {
  purgedPrivateMemoriesCount: number;
  purgedTemporaryMatchesCount: number;
  preservedLibrarySourceCount: number;
  runAt: number;
}

export interface PublicCanaryExport {
  matchId: string;
  roomId: string;
  mode: string;
  status: string;
  winner: string | null;
  resultReason: string | null;
  durationSeconds: number;
  publicTimeline: any[];
  moves: any[];
  exportedAt: string;
  // Strictly whitelisted: NO code, NO memoryPayload, NO logs, NO passwords/tokens
}

export class RetentionGcService {
  constructor(
    private readonly db?: PrismaClient,
    private readonly now: () => number = Date.now
  ) {}

  isSourceExpired(endedAt: Date | number, now: number = this.now()): boolean {
    const endedTime = endedAt instanceof Date ? endedAt.getTime() : endedAt;
    return now - endedTime > SOURCE_RETENTION_MS;
  }

  isPrivateLogExpired(createdAt: Date | number, now: number = this.now()): boolean {
    const createdTime = createdAt instanceof Date ? createdAt.getTime() : createdAt;
    return now - createdTime > PRIVATE_LOGS_RETENTION_MS;
  }

  /**
   * Generates a sanitized public audit / replay export with strict field whitelist.
   * INVARIANT (FRS-L06 §5, §6, L-05.10):
   * Public exports NEVER include private bot code, memoryPayload, invocationTokens, or internal logs.
   */
  async canaryExport(matchId: string): Promise<PublicCanaryExport | null> {
    if (!this.db) return null;

    const match = await this.db.match.findUnique({
      where: { id: matchId },
      include: { moves: true, events: true },
    });
    if (!match) return null;

    const sanitizedMoves = (match.moves ?? []).map((m) => ({
      sequence: m.sequence,
      stateVersion: m.stateVersion,
      side: m.side,
      from: m.fromCoordinate,
      to: m.toCoordinate,
      capturedPieceId: m.capturedPieceId,
      committedAt: m.committedAt.toISOString(),
    }));

    const sanitizedTimeline = (match.events ?? []).map((e) => {
      const p = (e.payload as any) ?? {};
      return {
        sequence: e.sequence,
        type: e.type,
        timestamp: e.createdAt.toISOString(),
        ...(p.side ? { side: p.side } : {}),
        ...(p.reason ? { reason: p.reason } : {}),
        ...(p.revisionNumber ? { revisionNumber: p.revisionNumber } : {}),
      };
    });

    return {
      matchId: match.id,
      roomId: match.roomId,
      mode: match.mode,
      status: match.status,
      winner: match.winnerSide,
      resultReason: match.resultReason,
      durationSeconds: match.durationSeconds ?? 0,
      publicTimeline: sanitizedTimeline,
      moves: sanitizedMoves,
      exportedAt: new Date(this.now()).toISOString(),
    };
  }

  /**
   * Batch Garbage Collection for expired private data and expired temporary matches.
   * INVARIANT (FRS-L06 §3, L-05.10):
   * 1. Physical removal of private memory after retention period (7 days).
   * 2. NEVER garbage-collects BotLibrary source code or active revisions.
   */
  async runBatchGc(options: { dryRun?: boolean; now?: number } = {}): Promise<GcReport> {
    const currentTime = options.now ?? this.now();
    const privateCutoff = new Date(currentTime - PRIVATE_LOGS_RETENTION_MS);
    const sourceCutoff = new Date(currentTime - SOURCE_RETENTION_MS);

    if (!this.db) {
      return {
        purgedPrivateMemoriesCount: 0,
        purgedTemporaryMatchesCount: 0,
        preservedLibrarySourceCount: 0,
        runAt: currentTime,
      };
    }

    let purgedPrivateMemoriesCount = 0;
    let purgedTemporaryMatchesCount = 0;
    let preservedLibrarySourceCount = 0;

    // 1. Purge expired private bot checkpoints (older than 7 days)
    if (typeof this.db.botPrivateCheckpoint?.updateMany === "function") {
      if (options.dryRun) {
        const toPurge = await this.db.botPrivateCheckpoint.count({
          where: {
            createdAt: { lt: privateCutoff },
            memoryPayload: { not: Prisma.DbNull },
          },
        });
        purgedPrivateMemoriesCount = toPurge;
      } else {
        const updateResult = await this.db.botPrivateCheckpoint.updateMany({
          where: {
            createdAt: { lt: privateCutoff },
            memoryPayload: { not: Prisma.DbNull },
          },
          data: {
            memoryPayload: Prisma.DbNull,
            budgetRemaining: Prisma.DbNull,
          },
        });
        purgedPrivateMemoriesCount = updateResult.count;
      }
    }

    // 2. Count preserved user BotLibrary source code (MUST NEVER BE PURGED)
    if (typeof this.db.botLibrary?.count === "function") {
      preservedLibrarySourceCount = await this.db.botLibrary.count();
    }

    // 3. Purge temporary guest matches older than 30 days and clean orphaned MatchSettlement
    if (typeof this.db.match?.deleteMany === "function") {
      if (options.dryRun) {
        purgedTemporaryMatchesCount = await this.db.match.count({
          where: {
            endedAt: { lt: sourceCutoff },
            mode: "UNRANKED",
          },
        });
      } else {
        if (typeof this.db.match?.findMany === "function" && typeof this.db.matchSettlement?.deleteMany === "function") {
          const expiredMatches = await this.db.match.findMany({
            where: {
              endedAt: { lt: sourceCutoff },
              mode: "UNRANKED",
            },
            select: { id: true },
          });
          const matchIds = expiredMatches.map((m) => m.id);
          if (matchIds.length > 0) {
            await this.db.matchSettlement.deleteMany({
              where: { matchId: { in: matchIds } },
            });
          }
        }

        const deleteResult = await this.db.match.deleteMany({
          where: {
            endedAt: { lt: sourceCutoff },
            mode: "UNRANKED",
          },
        });
        purgedTemporaryMatchesCount = deleteResult.count;
      }
    }

    return {
      purgedPrivateMemoriesCount,
      purgedTemporaryMatchesCount,
      preservedLibrarySourceCount,
      runAt: currentTime,
    };
  }
}
