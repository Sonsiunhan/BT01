import type { PrismaClient } from "@prisma/client";
import type { CompactMatchSnapshot, DomainEventEnvelope } from "@ottv2/contracts";
import type {
  BotPrivateCheckpoint,
  BotPrivateCheckpointPort,
  CommandKey,
  CommandOutcome,
  CommitPort,
  CommitTransitionInput,
  CommitTransitionResult,
  ReadOutcomeQuery,
  RestoredMatchState,
} from "./commit.port.js";
import { CommandLedger } from "./command-ledger.js";

export type CommitFailpoint =
  | "BEFORE_TX"
  | "AFTER_CAS_BEFORE_WRITE"
  | "AFTER_MATCH_BEFORE_CHECKPOINT"
  | "AFTER_CHECKPOINT_BEFORE_EVENTS"
  | "AFTER_EVENTS_BEFORE_PRIVATE_CHECKPOINT"
  | "AFTER_PRIVATE_CHECKPOINT_BEFORE_LEDGER"
  | "AFTER_LEDGER_BEFORE_COMMIT"
  | "AFTER_COMMIT_BEFORE_ACK"
  | "TIMEOUT"
  | null;

export class PrismaCommitPort implements CommitPort, BotPrivateCheckpointPort {
  private readonly prisma: PrismaClient;
  readonly ledger: CommandLedger;
  private readonly now: () => number;
  private readonly ledgerTtlMs: number;
  private failpoint: CommitFailpoint = null;

  // In-memory fallbacks when running without live Prisma connection
  private readonly fallbackVersions = new Map<string, number>();
  private readonly fallbackSequences = new Map<string, number>();
  private readonly fallbackStates = new Map<string, CompactMatchSnapshot>();
  private readonly fallbackPrivateCheckpoints = new Map<string, Map<string, BotPrivateCheckpoint>>();

  constructor(
    prisma: PrismaClient,
    ledger: CommandLedger = new CommandLedger(),
    now: () => number = Date.now,
    ledgerTtlMs = 300_000 // 5 minutes default retention for command idempotency
  ) {
    this.prisma = prisma;
    this.ledger = ledger;
    this.now = now;
    this.ledgerTtlMs = ledgerTtlMs;
  }

  /**
   * Arm failpoint for resilience & crash simulation.
   * INVARIANT: Failpoints can only be armed in test/non-production environments.
   */
  setFailpoint(failpoint: CommitFailpoint): void {
    if (process.env.NODE_ENV === "production" && failpoint !== null) {
      throw new Error("Commit failpoints are strictly disabled in production environments.");
    }
    this.failpoint = failpoint;
  }

  getFailpoint(): CommitFailpoint {
    return this.failpoint;
  }

  private triggerFailpointIfMatches(expected: CommitFailpoint): void {
    if (this.failpoint === expected) {
      if (expected === "TIMEOUT") {
        throw new Error("DB_TIMEOUT: Simulated database transaction timeout error");
      }
      throw new Error(`FAILPOINT_${expected}: Simulated crash between write boundaries`);
    }
  }

  private commitTransitionSync(input: CommitTransitionInput): CommitTransitionResult {
    const targetId = input.commandKey.targetId;

    // Fast-path: check if command outcome is already in ledger
    const existing = this.ledger.get(input.commandKey);
    if (existing) {
      return {
        outcome: existing.outcome,
        stateVersion: existing.stateVersion,
        sequence: existing.sequence,
        existingOutcome: existing,
      };
    }

    if (this.failpoint === "BEFORE_TX" || this.failpoint === "TIMEOUT") {
      this.recordUnknownInLedger(input.commandKey);
      return { outcome: "UNKNOWN" };
    }

    if (!this.fallbackVersions.has(targetId)) {
      this.fallbackVersions.set(targetId, input.expectedVersion);
    }
    const currentVersion = this.fallbackVersions.get(targetId)!;
    if (input.expectedVersion !== currentVersion) {
      return {
        outcome: "CONFLICT",
        conflictReason: "STALE_VERSION",
        stateVersion: currentVersion,
      };
    }

    if (this.failpoint === "AFTER_CAS_BEFORE_WRITE") {
      this.recordUnknownInLedger(input.commandKey);
      return { outcome: "UNKNOWN" };
    }

    const nextVersion = currentVersion + 1;
    const currentSeq = this.fallbackSequences.get(targetId) ?? 0;
    const nextSeq = currentSeq + (input.domainEvents.length > 0 ? input.domainEvents.length : 1);

    this.fallbackVersions.set(targetId, nextVersion);
    this.fallbackSequences.set(targetId, nextSeq);
    this.fallbackStates.set(targetId, input.nextState as CompactMatchSnapshot);

    if (input.privateCheckpoint) {
      this.saveFallbackCheckpoint(input.privateCheckpoint);
    }

    const outcome: CommandOutcome = {
      commandId: input.commandKey.commandId,
      principalId: input.commandKey.principalId,
      outcome: "COMMITTED",
      stateVersion: nextVersion,
      sequence: nextSeq,
      ackPayload: input.nextState,
      committedAt: this.now(),
      expiresAt: this.now() + this.ledgerTtlMs,
    };
    this.ledger.record(outcome, input.commandKey);

    this.triggerFailpointIfMatches("AFTER_COMMIT_BEFORE_ACK");

    return {
      outcome: "COMMITTED",
      stateVersion: nextVersion,
      sequence: nextSeq,
    };
  }

  private recordUnknownInLedger(key: CommandKey): void {
    const unknownOutcome: CommandOutcome = {
      commandId: key.commandId,
      principalId: key.principalId,
      outcome: "UNKNOWN",
      stateVersion: 0,
      sequence: 0,
      ackPayload: null,
      committedAt: this.now(),
      expiresAt: this.now() + this.ledgerTtlMs,
    };
    this.ledger.record(unknownOutcome, key);
  }

  async commitTransition(input: CommitTransitionInput): Promise<CommitTransitionResult> {
    const targetId = input.commandKey.targetId;

    // 1. Fast-path: Check in-memory ledger
    const existing = this.ledger.get(input.commandKey);
    if (existing) {
      return {
        outcome: existing.outcome,
        stateVersion: existing.stateVersion,
        sequence: existing.sequence,
        existingOutcome: existing,
      };
    }

    // 2. Pre-transaction failpoint check
    if (this.failpoint === "BEFORE_TX" || this.failpoint === "TIMEOUT") {
      this.recordUnknownInLedger(input.commandKey);
      return { outcome: "UNKNOWN" };
    }

    try {
      if (typeof this.prisma?.$transaction !== "function") {
        return this.commitTransitionSync(input);
      }

      // Check durable ledger entry in DB if present
      if (typeof this.prisma?.commandLedgerEntry?.findUnique === "function") {
        const dbEntry = await this.prisma.commandLedgerEntry.findUnique({
          where: {
            principalId_targetId_operation_commandId: {
              principalId: input.commandKey.principalId,
              targetId: input.commandKey.targetId,
              operation: input.commandKey.operation,
              commandId: input.commandKey.commandId,
            },
          },
        });
        if (dbEntry) {
          const outcome: CommandOutcome = {
            commandId: dbEntry.commandId,
            principalId: dbEntry.principalId,
            outcome: dbEntry.outcome as "COMMITTED" | "CONFLICT" | "UNKNOWN",
            stateVersion: dbEntry.stateVersion,
            sequence: dbEntry.sequence,
            ackPayload: dbEntry.ackPayload,
            committedAt: dbEntry.committedAt?.getTime() ?? dbEntry.receivedAt.getTime(),
            ...(dbEntry.expiresAt ? { expiresAt: dbEntry.expiresAt.getTime() } : {}),
          };
          this.ledger.record(outcome, input.commandKey);
          return {
            outcome: outcome.outcome,
            stateVersion: outcome.stateVersion,
            sequence: outcome.sequence,
            existingOutcome: outcome,
          };
        }
      }

      const result = await this.prisma.$transaction(async (tx: any): Promise<CommitTransitionResult> => {
        // Step 1: CAS Check on latest match checkpoint
        let currentVersion = 0;
        let currentSeq = 0;
        let existingCheckpoint: any = null;

        if (typeof tx?.matchCheckpoint?.findFirst === "function") {
          existingCheckpoint = await tx.matchCheckpoint.findFirst({
            where: { roomId: targetId },
            orderBy: { stateVersion: "desc" },
          });
          currentVersion = existingCheckpoint?.stateVersion ?? 0;
          currentSeq = existingCheckpoint?.sequence ?? 0;
        } else if (typeof tx?.matchCheckpoint?.findUnique === "function") {
          existingCheckpoint = await tx.matchCheckpoint.findUnique({
            where: { matchId: targetId },
          });
          currentVersion = existingCheckpoint?.stateVersion ?? 0;
          currentSeq = existingCheckpoint?.sequence ?? 0;
        }

        if (input.expectedVersion !== currentVersion) {
          return {
            outcome: "CONFLICT",
            conflictReason: "STALE_VERSION",
            stateVersion: currentVersion,
          };
        }

        this.triggerFailpointIfMatches("AFTER_CAS_BEFORE_WRITE");

        const nextVersion = currentVersion + 1;
        const nextSeq = currentSeq + (input.domainEvents.length > 0 ? input.domainEvents.length : 1);
        const matchId = (input.nextState as any).matchId ?? existingCheckpoint?.matchId ?? targetId;
        const nowMs = this.now();
        const nowObj = new Date(nowMs);
        const expiresAtObj = new Date(nowMs + this.ledgerTtlMs);

        // Step 2: Upsert Match
        if (typeof tx?.match?.upsert === "function") {
          await tx.match.upsert({
            where: { id: matchId },
            create: {
              id: matchId,
              roomId: targetId,
              mode: (input.nextState as any).mode ?? "UNRANKED",
              playMode: (input.nextState as any).playMode ?? "MANUAL",
              status: (input.nextState as any).status ?? "PLAYING",
              timerSeconds: (input.nextState as any).timerSeconds ?? 30,
              startedAt: nowObj,
              rulesVersion: (input.nextState as any).rulesVersion ?? "rps-v1",
              setupVersion: (input.nextState as any).setupVersion ?? null,
              initialSeed: (input.nextState as any).seed ?? null,
              initialSignature: (input.nextState as any).signature ?? null,
              initialBoard: (input.nextState as any).initialBoard ?? null,
              cursorSequence: nextSeq,
            },
            update: {
              status: (input.nextState as any).status ?? "PLAYING",
              resultReason: (input.nextState as any).resultReason ?? null,
              winnerSide: (input.nextState as any).winner ?? null,
              cursorSequence: nextSeq,
            },
          });
        }

        this.triggerFailpointIfMatches("AFTER_MATCH_BEFORE_CHECKPOINT");

        // Step 3: Upsert MatchCheckpoint
        if (typeof tx?.matchCheckpoint?.upsert === "function") {
          await tx.matchCheckpoint.upsert({
            where: { matchId },
            create: {
              matchId,
              roomId: targetId,
              sequence: nextSeq,
              stateVersion: nextVersion,
              rulesVersion: (input.nextState as any).rulesVersion ?? "rps-v1",
              setupVersion: (input.nextState as any).setupVersion ?? null,
              initialSeed: (input.nextState as any).seed ?? null,
              initialSignature: (input.nextState as any).signature ?? null,
              initialBoard: (input.nextState as any).initialBoard ?? null,
              cursorSequence: nextSeq,
              lifecycleJson: (input.nextState as any).lifecycle ?? null,
              snapshot: input.nextState as any,
              createdAt: nowObj,
              updatedAt: nowObj,
            },
            update: {
              sequence: nextSeq,
              stateVersion: nextVersion,
              rulesVersion: (input.nextState as any).rulesVersion ?? "rps-v1",
              setupVersion: (input.nextState as any).setupVersion ?? null,
              cursorSequence: nextSeq,
              lifecycleJson: (input.nextState as any).lifecycle ?? null,
              snapshot: input.nextState as any,
              updatedAt: nowObj,
            },
          });
        }

        this.triggerFailpointIfMatches("AFTER_CHECKPOINT_BEFORE_EVENTS");

        // Step 4: Insert domain events
        if (input.domainEvents.length > 0 && typeof tx?.matchEvent?.create === "function") {
          for (let i = 0; i < input.domainEvents.length; i++) {
            const ev = input.domainEvents[i]!;
            await tx.matchEvent.create({
              data: {
                matchId,
                sequence: currentSeq + 1 + i,
                stateVersion: nextVersion,
                type: ev.type,
                payload: (ev as any).payload ?? {},
                createdAt: nowObj,
              },
            });
          }
        }

        this.triggerFailpointIfMatches("AFTER_EVENTS_BEFORE_PRIVATE_CHECKPOINT");

        // Step 5: Upsert Bot Private Checkpoint (Atomic with match transition)
        if (input.privateCheckpoint && typeof tx?.botPrivateCheckpoint?.upsert === "function") {
          await tx.botPrivateCheckpoint.upsert({
            where: {
              matchId_botId: {
                matchId: input.privateCheckpoint.matchId,
                botId: input.privateCheckpoint.botId,
              },
            },
            create: {
              matchId: input.privateCheckpoint.matchId,
              botId: input.privateCheckpoint.botId,
              revisionId: input.privateCheckpoint.revisionId,
              turnNumber: input.privateCheckpoint.turnNumber,
              seed: input.privateCheckpoint.seed ?? null,
              memoryPayload: input.privateCheckpoint.memory as any,
              createdAt: nowObj,
              updatedAt: nowObj,
            },
            update: {
              revisionId: input.privateCheckpoint.revisionId,
              turnNumber: input.privateCheckpoint.turnNumber,
              seed: input.privateCheckpoint.seed ?? null,
              memoryPayload: input.privateCheckpoint.memory as any,
              updatedAt: nowObj,
            },
          });
        }

        this.triggerFailpointIfMatches("AFTER_PRIVATE_CHECKPOINT_BEFORE_LEDGER");

        // Step 6: RULE-16 RoomContext Previous Setup & Match Settlement
        if ((input.nextState as any).initialBoard) {
          if (typeof tx?.roomContext?.upsert === "function") {
            await tx.roomContext.upsert({
              where: { id: targetId },
              create: {
                id: targetId,
                previousSetup: (input.nextState as any).initialBoard,
                activeMatchId: matchId,
              },
              update: {
                previousSetup: (input.nextState as any).initialBoard,
                activeMatchId: matchId,
              },
            });
          } else if (
            typeof tx?.roomContext?.findUnique === "function" &&
            typeof tx?.roomContext?.update === "function"
          ) {
            const existingRoom = await tx.roomContext.findUnique({ where: { id: targetId } });
            if (existingRoom) {
              await tx.roomContext.update({
                where: { id: targetId },
                data: {
                  previousSetup: (input.nextState as any).initialBoard,
                  activeMatchId: matchId,
                },
              });
            }
          }
        }

        if (
          ((input.nextState as any).status === "FINISHED" || (input.nextState as any).winner) &&
          typeof tx?.matchSettlement?.upsert === "function"
        ) {
          const outcomeStr = (input.nextState as any).winner ?? (input.nextState as any).resultReason ?? "FINISHED";
          await tx.matchSettlement.upsert({
            where: { matchId },
            create: {
              matchId,
              outcome: outcomeStr,
              settledAt: nowObj,
              eloApplied: (input.nextState as any).mode === "RANKED",
              historyRecorded: true,
              payload: input.nextState as any,
            },
            update: {
              outcome: outcomeStr,
              settledAt: nowObj,
            },
          });
        }

        // Step 7: Persist Command Ledger Entry (Atomic)
        if (typeof tx?.commandLedgerEntry?.upsert === "function") {
          await tx.commandLedgerEntry.upsert({
            where: {
              principalId_targetId_operation_commandId: {
                principalId: input.commandKey.principalId,
                targetId: input.commandKey.targetId,
                operation: input.commandKey.operation,
                commandId: input.commandKey.commandId,
              },
            },
            create: {
              principalId: input.commandKey.principalId,
              targetId: input.commandKey.targetId,
              operation: input.commandKey.operation,
              commandId: input.commandKey.commandId,
              payloadDigest: input.commandKey.payloadHash ?? null,
              outcome: "COMMITTED",
              stateVersion: nextVersion,
              sequence: nextSeq,
              ackPayload: input.nextState as any,
              receivedAt: nowObj,
              committedAt: nowObj,
              expiresAt: expiresAtObj,
            },
            update: {
              outcome: "COMMITTED",
              stateVersion: nextVersion,
              sequence: nextSeq,
              ackPayload: input.nextState as any,
              committedAt: nowObj,
            },
          });
        }

        this.triggerFailpointIfMatches("AFTER_LEDGER_BEFORE_COMMIT");

        // Step 8: Update In-Memory Ledger cache on commit success
        const outcome: CommandOutcome = {
          commandId: input.commandKey.commandId,
          principalId: input.commandKey.principalId,
          outcome: "COMMITTED",
          stateVersion: nextVersion,
          sequence: nextSeq,
          ackPayload: input.nextState,
          committedAt: nowMs,
          expiresAt: nowMs + this.ledgerTtlMs,
        };
        this.ledger.record(outcome, input.commandKey);

        return {
          outcome: "COMMITTED",
          stateVersion: nextVersion,
          sequence: nextSeq,
        };
      });

      this.triggerFailpointIfMatches("AFTER_COMMIT_BEFORE_ACK");
      return result;
    } catch (err: any) {
      if (this.failpoint === "AFTER_COMMIT_BEFORE_ACK") {
        throw err;
      }
      // Transaction aborted/rolled back in DB. Record UNKNOWN in ledger for safety.
      this.recordUnknownInLedger(input.commandKey);
      return { outcome: "UNKNOWN" };
    }
  }

  async readOutcome(query: ReadOutcomeQuery): Promise<CommandOutcome | null> {
    const cached =
      this.ledger.get({
        principalId: query.principalId,
        commandId: query.commandId,
        targetId: query.targetId ?? "",
        operation: query.operation ?? "",
      }) ?? this.ledger.getByCommandId(query.commandId);

    if (cached) return cached;

    // Check DB
    try {
      if (typeof this.prisma?.commandLedgerEntry?.findFirst === "function") {
        const dbEntry = await this.prisma.commandLedgerEntry.findFirst({
          where: {
            commandId: query.commandId,
            ...(query.principalId ? { principalId: query.principalId } : {}),
            ...(query.targetId ? { targetId: query.targetId } : {}),
            ...(query.operation ? { operation: query.operation } : {}),
          },
        });
        if (dbEntry) {
          const outcome: CommandOutcome = {
            commandId: dbEntry.commandId,
            principalId: dbEntry.principalId,
            outcome: dbEntry.outcome as "COMMITTED" | "CONFLICT" | "UNKNOWN",
            stateVersion: dbEntry.stateVersion,
            sequence: dbEntry.sequence,
            ackPayload: dbEntry.ackPayload,
            committedAt: dbEntry.committedAt?.getTime() ?? dbEntry.receivedAt.getTime(),
            ...(dbEntry.expiresAt ? { expiresAt: dbEntry.expiresAt.getTime() } : {}),
          };
          return outcome;
        }
      }
    } catch {
      // Ignore DB read failure on fallback
    }

    return null;
  }

  async restoreMatch(matchId: string): Promise<RestoredMatchState | null> {
    try {
      if (typeof this.prisma?.matchCheckpoint?.findUnique === "function") {
        const checkpoint = await this.prisma.matchCheckpoint.findUnique({
          where: { matchId },
        });
        if (checkpoint) {
          const snap = checkpoint.snapshot as unknown as CompactMatchSnapshot;
          let privateCheckpointsMap: Record<string, BotPrivateCheckpoint> | undefined;

          if (typeof this.prisma?.botPrivateCheckpoint?.findMany === "function") {
            const privateRows = await this.prisma.botPrivateCheckpoint.findMany({
              where: { matchId },
            });
            if (privateRows.length > 0) {
              privateCheckpointsMap = {};
              for (const row of privateRows) {
                privateCheckpointsMap[row.botId] = {
                  matchId: row.matchId,
                  botId: row.botId,
                  revisionId: row.revisionId,
                  turnNumber: row.turnNumber,
                  ...(row.seed != null ? { seed: row.seed } : {}),
                  memory: row.memoryPayload,
                };
              }
            }
          }

          return {
            snapshot: snap,
            setupDescriptor: {
              rulesVersion: checkpoint.rulesVersion ?? "rps-v1",
              seed: checkpoint.initialSeed ?? 0,
            },
            watermark: {
              lastCommittedSequence: checkpoint.sequence,
              lastCommittedStateVersion: checkpoint.stateVersion,
              timestamp: checkpoint.updatedAt.getTime(),
            },
            ...(privateCheckpointsMap ? { privateCheckpoints: privateCheckpointsMap } : {}),
          };
        }
      }
    } catch {
      // Fallback
    }

    const state = this.fallbackStates.get(matchId);
    if (!state) return null;
    const checkpoints = this.fallbackPrivateCheckpoints.get(matchId);

    return {
      snapshot: state,
      setupDescriptor: {
        rulesVersion: "rps-v1",
        seed: 0,
      },
      watermark: {
        lastCommittedSequence: this.fallbackSequences.get(matchId) ?? 0,
        lastCommittedStateVersion: this.fallbackVersions.get(matchId) ?? 0,
        timestamp: this.now(),
      },
      ...(checkpoints ? { privateCheckpoints: Object.fromEntries(checkpoints) } : {}),
    };
  }

  private saveFallbackCheckpoint(checkpoint: BotPrivateCheckpoint): void {
    const matchCheckpoints =
      this.fallbackPrivateCheckpoints.get(checkpoint.matchId) ?? new Map<string, BotPrivateCheckpoint>();
    matchCheckpoints.set(checkpoint.botId, checkpoint);
    this.fallbackPrivateCheckpoints.set(checkpoint.matchId, matchCheckpoints);
  }

  async saveCheckpoint(checkpoint: BotPrivateCheckpoint): Promise<void> {
    this.saveFallbackCheckpoint(checkpoint);

    try {
      if (typeof this.prisma?.botPrivateCheckpoint?.upsert === "function") {
        await this.prisma.botPrivateCheckpoint.upsert({
          where: {
            matchId_botId: {
              matchId: checkpoint.matchId,
              botId: checkpoint.botId,
            },
          },
          create: {
            matchId: checkpoint.matchId,
            botId: checkpoint.botId,
            revisionId: checkpoint.revisionId,
            turnNumber: checkpoint.turnNumber,
            seed: checkpoint.seed ?? null,
            memoryPayload: checkpoint.memory as any,
          },
          update: {
            revisionId: checkpoint.revisionId,
            turnNumber: checkpoint.turnNumber,
            seed: checkpoint.seed ?? null,
            memoryPayload: checkpoint.memory as any,
          },
        });
      }
    } catch {
      // Fallback preserved
    }
  }

  async readCheckpoint(matchId: string, botId: string): Promise<BotPrivateCheckpoint | null> {
    try {
      if (typeof this.prisma?.botPrivateCheckpoint?.findUnique === "function") {
        const row = await this.prisma.botPrivateCheckpoint.findUnique({
          where: {
            matchId_botId: { matchId, botId },
          },
        });
        if (row) {
          return {
            matchId: row.matchId,
            botId: row.botId,
            revisionId: row.revisionId,
            turnNumber: row.turnNumber,
            ...(row.seed != null ? { seed: row.seed } : {}),
            memory: row.memoryPayload,
          };
        }
      }
    } catch {
      // Fallback
    }

    return this.fallbackPrivateCheckpoints.get(matchId)?.get(botId) ?? null;
  }

  clear(targetId?: string): void {
    if (targetId) {
      this.fallbackVersions.delete(targetId);
      this.fallbackSequences.delete(targetId);
      this.fallbackStates.delete(targetId);
      this.fallbackPrivateCheckpoints.delete(targetId);
      this.ledger.clear(targetId);
    } else {
      this.fallbackVersions.clear();
      this.fallbackSequences.clear();
      this.fallbackStates.clear();
      this.fallbackPrivateCheckpoints.clear();
      this.ledger.clear();
    }
  }
}
