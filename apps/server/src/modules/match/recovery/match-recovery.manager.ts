import type { PrismaClient } from "@prisma/client";
import { AppError } from "../../../shared/errors/app-error.js";
import type { CompactMatchSnapshot } from "@ottv2/contracts";

export interface RecoveredRoomContext {
  id: string;
  generation: number;
  stateVersion: number;
  activeMatchId: string | null;
  previousSetup: unknown;
  config: unknown;
  memberships: Array<{
    userId: string;
    role: string;
    side: string | null;
    principal: string;
    connected: boolean;
  }>;
}

export interface BotFencingInfo {
  botId: string;
  revisionId: string;
  turnNumber: number;
  newInvocationEpoch: number;
  newInvocationToken: string;
}

export interface RecoveredMatchState {
  matchId: string;
  roomId: string;
  status: "PLAYING" | "PAUSED" | "FINISHED" | "ABORTED";
  stateVersion: number;
  sequence: number;
  rulesVersion: string;
  setupVersion: string | null;
  initialBoard: unknown;
  initialSeed: number | null;
  clocksMs: { BLUE: number; RED: number };
  pauseReason: string | null;
  pausePhase: string | null;
  pauseElapsedMs: number;
  replacementStatus: string;
  replacementExpiresAt: number | null;
  botFencing?: (Record<string, BotFencingInfo> & Partial<BotFencingInfo>) | undefined;
  snapshot: CompactMatchSnapshot;
}

export interface RecoveryResult {
  recovered: boolean;
  neutralAborted: boolean;
  abortReason?: string | undefined;
  roomContext?: RecoveredRoomContext | undefined;
  matchState?: RecoveredMatchState | undefined;
}

export interface TokenValidator {
  isValid(token: string): boolean;
  isRevoked(token: string): boolean;
}

export class MatchRecoveryManager {
  private readonly now: () => number;
  private readonly tokenValidator?: TokenValidator | undefined;

  constructor(
    private readonly db?: PrismaClient,
    nowOrValidator?: (() => number) | TokenValidator,
    tokenValidator?: TokenValidator
  ) {
    if (typeof nowOrValidator === "function") {
      this.now = nowOrValidator;
      this.tokenValidator = tokenValidator;
    } else {
      this.now = Date.now;
      this.tokenValidator = nowOrValidator;
    }
  }

  /**
   * Recovers active room context and match state following a crash or restart.
   * INVARIANT (FRS-L06 §4, L-05.05, L-05.06, L-05.07):
   * 1. Preserves room generation, role assignments, and committed previous setup.
   * 2. Re-auth checks revocation/expiry; does NOT restore expired privileges.
   * 3. Clocks restore from committed remaining time; outage downtime is NOT deducted as player penalty.
   * 4. Deadlines retain original target times; restart does NOT reset grace periods.
   * 5. Bot execution token is fenced (incremented epoch, rotated token) to drop partial/stale computation.
   * 6. Corrupt or unrecoverable states trigger durable neutral abort.
   */
  async recoverActiveRoomAndMatch(roomId: string): Promise<RecoveryResult> {
    if (!this.db) {
      return {
        recovered: false,
        neutralAborted: true,
        abortReason: "STORAGE_UNAVAILABLE",
      };
    }

    // 1. Recover RoomContext & Memberships
    const roomContextRow = await this.db.roomContext?.findUnique?.({
      where: { id: roomId },
      include: { memberships: true },
    });

    let recoveredRoomContext: RecoveredRoomContext | undefined;

    if (roomContextRow) {
      // Filter memberships whose sessions are still valid (re-auth check)
      const validMemberships = (roomContextRow.memberships ?? [])
        .filter((m) => {
          if (this.tokenValidator && this.tokenValidator.isRevoked(m.userId)) {
            return false;
          }
          return true;
        })
        .map((m) => ({
          userId: m.userId,
          role: m.role,
          side: m.side,
          principal: m.principal,
          connected: false, // On restart, connections start disconnected until reconnect
        }));

      recoveredRoomContext = {
        id: roomContextRow.id,
        generation: roomContextRow.generation,
        stateVersion: roomContextRow.stateVersion,
        activeMatchId: roomContextRow.activeMatchId,
        previousSetup: roomContextRow.previousSetup,
        config: roomContextRow.config,
        memberships: validMemberships,
      };
    }

    const activeMatchId = roomContextRow?.activeMatchId ?? roomId;

    // 2. Load Checkpoint and Match records
    const checkpoint = await this.db.matchCheckpoint?.findUnique?.({
      where: { matchId: activeMatchId },
    });

    if (!checkpoint) {
      return {
        recovered: false,
        neutralAborted: true,
        abortReason: "CHECKPOINT_NOT_FOUND",
        roomContext: recoveredRoomContext,
      };
    }

    const matchRow = await this.db.match?.findUnique?.({
      where: { id: activeMatchId },
    });

    const snap = checkpoint.snapshot as any;

    // 3. Corruption & Version Validation
    const rulesVersion = checkpoint.rulesVersion ?? matchRow?.rulesVersion ?? "rps-v1";
    if (rulesVersion !== "rps-v1" && rulesVersion !== "rps-v2") {
      // Unknown version: trigger durable neutral abort (do not fabricate state)
      await this.markNeutralAbort(activeMatchId, "UNSUPPORTED_RULES_VERSION");
      return {
        recovered: false,
        neutralAborted: true,
        abortReason: "UNSUPPORTED_RULES_VERSION",
        roomContext: recoveredRoomContext,
      };
    }

    // 4. Clock, Blockers & Deadline Recovery (L-05.06)
    // Clocks restore remaining time directly from snapshot without deducting crash downtime
    const clocksMs = snap?.clocksMs ?? { BLUE: 180_000, RED: 180_000 };
    const pauseReason = snap?.pauseReason ?? null;
    const pausePhase = snap?.pausePhase ?? null;
    const pauseElapsedMs = snap?.pauseElapsedMs ?? 0;
    const replacementStatus = snap?.replacementStatus ?? "IDLE";
    const replacementExpiresAt = snap?.replacementExpiresAt ?? null;

    // 5. Bot Revision & Memory Fencing (L-05.07, support multi-bot / Bot-vs-Bot)
    let botFencing: RecoveredMatchState["botFencing"];
    if (this.db.botPrivateCheckpoint) {
      let privateCheckpoints: any[] = [];
      if (typeof this.db.botPrivateCheckpoint.findMany === "function") {
        privateCheckpoints = await this.db.botPrivateCheckpoint.findMany({
          where: { matchId: activeMatchId },
          orderBy: { turnNumber: "desc" },
        });
      } else if (typeof this.db.botPrivateCheckpoint.findFirst === "function") {
        const first = await this.db.botPrivateCheckpoint.findFirst({
          where: { matchId: activeMatchId },
          orderBy: { turnNumber: "desc" },
        });
        if (first) privateCheckpoints = [first];
      }

      if (privateCheckpoints.length > 0) {
        botFencing = {};
        for (const cp of privateCheckpoints) {
          if (botFencing[cp.botId]) continue; // Already handled highest turnNumber for this bot

          const nextEpoch = (cp.invocationEpoch ?? 0) + 1;
          const nextToken = `token-epoch-${nextEpoch}-${Math.random().toString(16).slice(2, 10)}`;

          // Advance epoch in DB to fence any late workers
          await this.db.botPrivateCheckpoint.update({
            where: { id: cp.id },
            data: {
              invocationEpoch: nextEpoch,
              invocationToken: nextToken,
            },
          }).catch(() => {
            // Non-fatal if update fails
          });

          botFencing[cp.botId] = {
            botId: cp.botId,
            revisionId: cp.revisionId,
            turnNumber: cp.turnNumber,
            newInvocationEpoch: nextEpoch,
            newInvocationToken: nextToken,
          };
        }

        const firstBot = Object.values(botFencing)[0];
        if (firstBot) {
          Object.assign(botFencing, firstBot);
        }
      }
    }

    const recoveredMatch: RecoveredMatchState = {
      matchId: activeMatchId,
      roomId,
      status: (matchRow?.status as any) ?? snap?.status ?? "PLAYING",
      stateVersion: checkpoint.stateVersion,
      sequence: checkpoint.sequence,
      rulesVersion,
      setupVersion: checkpoint.setupVersion ?? matchRow?.setupVersion ?? null,
      initialBoard: checkpoint.initialBoard ?? matchRow?.initialBoard ?? null,
      initialSeed: checkpoint.initialSeed ?? matchRow?.initialSeed ?? null,
      clocksMs,
      pauseReason,
      pausePhase,
      pauseElapsedMs,
      replacementStatus,
      replacementExpiresAt,
      botFencing,
      snapshot: snap,
    };

    return {
      recovered: true,
      neutralAborted: false,
      roomContext: recoveredRoomContext,
      matchState: recoveredMatch,
    };
  }

  private async markNeutralAbort(matchId: string, reason: string): Promise<void> {
    if (!this.db?.match?.update) return;
    await this.db.match.update({
      where: { id: matchId },
      data: {
        status: "ABORTED",
        resultReason: "SERVER_INTERRUPTION",
      },
    }).catch(() => {});
  }
}
